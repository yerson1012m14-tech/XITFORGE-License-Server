'use strict';

const { randomBytes, timingSafeEqual } = require('node:crypto');
const { activePaidLicense, paidBearer, sha256 } = require('./license-auth');

const proxyTokenPattern = /^xfp_[0-9a-f]{64}$/;

function createProxyAuth(pool, { introspectionSecret }) {
  const configured = typeof introspectionSecret === 'string' &&
    /^[\x21-\x7e]{32,256}$/.test(introspectionSecret);
  const serviceAuthorization = configured ? Buffer.from(sha256(`Bearer ${introspectionSecret}`), 'hex') : null;

  async function ensureTable() {
    await pool.query(`
      ALTER TABLE licenses ADD COLUMN IF NOT EXISTS proxy_generation BIGINT NOT NULL DEFAULT 0;
      CREATE TABLE IF NOT EXISTS xf_proxy_grants (
        token_hash TEXT PRIMARY KEY,
        license_id BIGINT NOT NULL REFERENCES licenses(id) ON DELETE CASCADE,
        activation_id BIGINT NOT NULL REFERENCES activations(id) ON DELETE CASCADE,
        key_hash TEXT NOT NULL,
        license_generation BIGINT NOT NULL,
        redeem_until TIMESTAMPTZ NOT NULL,
        valid_until TIMESTAMPTZ
      );
      CREATE INDEX IF NOT EXISTS xf_proxy_grants_license_idx ON xf_proxy_grants (license_id);
      CREATE INDEX IF NOT EXISTS xf_proxy_grants_activation_idx ON xf_proxy_grants (activation_id);
      CREATE INDEX IF NOT EXISTS xf_proxy_grants_expiry_idx ON xf_proxy_grants ((COALESCE(valid_until, redeem_until)));
    `);
  }

  function unavailable(res, error) {
    if (error) console.error('Proxy authorization database unavailable', error.code || error.name);
    return res.status(503).json({ ok: false, error: 'proxy_authorization_unavailable' });
  }

  function prepare(req, res, next) {
    res.setHeader('Cache-Control', 'no-store');
    if (!configured) return unavailable(res);
    next();
  }

  async function issue(req, res) {
    const bearer = paidBearer(req);
    if (!bearer) return res.status(401).json({ ok: false, error: 'authorization_required' });

    try {
      const proxyToken = `xfp_${randomBytes(32).toString('hex')}`;
      const { rows } = await pool.query(`
        INSERT INTO xf_proxy_grants (token_hash, license_id, activation_id, key_hash, license_generation, redeem_until)
        SELECT $1, l.id, a.id, l.key_hash, l.proxy_generation, LEAST(l.expires_at, NOW() + INTERVAL '5 minutes')
        FROM xf_auth_sessions s
        JOIN licenses l ON l.id = s.license_id
        JOIN activations a ON a.license_id = l.id AND a.device_hash = s.device_hash
        WHERE s.token_hash = $2 AND s.scope = 'paid' AND s.expires_at > NOW()
          AND ${activePaidLicense}
        RETURNING redeem_until AS expires_at
      `, [sha256(proxyToken), sha256(bearer)]);
      if (rows.length !== 1) return res.status(403).json({ ok: false, error: 'license_invalid_or_expired' });
      return res.json({ ok: true, proxyToken, expiresAt: rows[0].expires_at.toISOString() });
    } catch (error) {
      return unavailable(res, error);
    }
  }

  async function introspect(req, res) {
    const supplied = Buffer.from(sha256(req.get('Authorization') || ''), 'hex');
    if (!timingSafeEqual(supplied, serviceAuthorization)) {
      return res.status(401).json({ ok: false, error: 'authorization_required' });
    }
    const { token, phase } = req.body || {};
    if (typeof token !== 'string' || !proxyTokenPattern.test(token) || (phase !== 'open' && phase !== 'check')) {
      return res.status(400).json({ ok: false, error: 'invalid_request' });
    }

    const currentGrant = `g.token_hash = $1 AND g.license_id = l.id AND g.key_hash = l.key_hash
      AND g.license_generation = l.proxy_generation
      AND a.id = g.activation_id AND a.license_id = l.id AND ${activePaidLicense}`;
    try {
      const { rows } = await pool.query(phase === 'open' ? `
        UPDATE xf_proxy_grants g
        SET valid_until = LEAST(l.expires_at, NOW() + INTERVAL '12 hours')
        FROM licenses l, activations a
        WHERE ${currentGrant} AND g.valid_until IS NULL AND g.redeem_until > NOW()
        RETURNING g.valid_until AS expires_at
      ` : `
        SELECT LEAST(g.valid_until, l.expires_at) AS expires_at
        FROM xf_proxy_grants g, licenses l, activations a
        WHERE ${currentGrant} AND g.valid_until > NOW()
      `, [sha256(token)]);
      if (rows.length !== 1) return res.status(403).json({ ok: false, error: 'proxy_session_invalid' });
      return res.json({ ok: true, expiresAt: rows[0].expires_at.toISOString() });
    } catch (error) {
      return unavailable(res, error);
    }
  }

  function startCleanup() {
    if (!configured) return;
    async function clean() {
      try {
        await pool.query('DELETE FROM xf_proxy_grants WHERE COALESCE(valid_until, redeem_until) <= NOW()');
      } catch (error) {
        console.error('Proxy grant cleanup failed', error.code || error.name);
      }
      setTimeout(clean, 60_000).unref();
    }
    setTimeout(clean, 60_000).unref();
  }

  return { ensureTable, prepare, issue, introspect, startCleanup };
}

module.exports = { createProxyAuth };
