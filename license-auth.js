'use strict';

const crypto = require('crypto');

function sha256(value) {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

function createLicenseAuth(pool) {
  async function ensureTable() {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS xf_auth_sessions (
        token_hash TEXT PRIMARY KEY,
        license_id BIGINT NOT NULL REFERENCES licenses(id) ON DELETE CASCADE,
        device_hash TEXT NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        scope TEXT NOT NULL DEFAULT 'paid'
      )
    `);
    await pool.query(`ALTER TABLE xf_auth_sessions ADD COLUMN IF NOT EXISTS scope TEXT NOT NULL DEFAULT 'paid'`);
    await pool.query(`CREATE INDEX IF NOT EXISTS xf_auth_sessions_license_idx ON xf_auth_sessions (license_id)`);
  }

  function checkIdAndDevice(licenseId, deviceId) {
    const id = Number(licenseId);
    return Number.isSafeInteger(id) && id > 0 && typeof deviceId === 'string' &&
      deviceId.length >= 8 && deviceId.length <= 256 ? id : null;
  }

  async function issueSession(licenseId, deviceId) {
    const id = checkIdAndDevice(licenseId, deviceId);
    if (id === null) return null;
    const token = 'xf2_' + crypto.randomBytes(32).toString('hex');
    const { rows } = await pool.query(`
      INSERT INTO xf_auth_sessions (token_hash, license_id, device_hash, expires_at, scope)
      SELECT $1, l.id, $3, LEAST(l.expires_at, NOW() + INTERVAL '5 minutes'), 'paid'
      FROM licenses l WHERE l.id = $2 AND l.status = 'active' AND l.expires_at > NOW()
        AND EXISTS (SELECT 1 FROM activations a WHERE a.license_id = l.id AND a.device_hash = $3)
        AND NOT EXISTS (SELECT 1 FROM xf_free_claims f WHERE f.license_id = l.id)
      RETURNING expires_at
    `, [sha256(token), id, sha256(deviceId)]);
    return rows.length === 1 ? { token, expiresAt: rows[0].expires_at } : null;
  }

  async function issueCleanupSession(licenseId, deviceId) {
    const id = checkIdAndDevice(licenseId, deviceId);
    if (id === null) return null;
    const token = 'xf2_' + crypto.randomBytes(32).toString('hex');
    const { rows } = await pool.query(`
      INSERT INTO xf_auth_sessions (token_hash, license_id, device_hash, expires_at, scope)
      SELECT $1, l.id, $3, NOW() + INTERVAL '15 minutes', 'cleanup'
      FROM licenses l WHERE l.id = $2
        AND EXISTS (SELECT 1 FROM activations a WHERE a.license_id = l.id AND a.device_hash = $3)
      RETURNING expires_at
    `, [sha256(token), id, sha256(deviceId)]);
    return rows.length === 1 ? { token, expiresAt: rows[0].expires_at } : null;
  }

  async function requirePaidSession(req, res, next) {
    try {
      const match = /^Bearer (xf2_[0-9a-f]{64})$/.exec(req.get('Authorization') || '');
      if (!match) return res.status(401).json({ ok: false, error: 'authorization_required' });
      const { rows } = await pool.query(`
        SELECT l.id FROM xf_auth_sessions s JOIN licenses l ON l.id = s.license_id
        WHERE s.token_hash = $1 AND s.scope = 'paid' AND s.expires_at > NOW()
          AND l.status = 'active' AND l.expires_at > NOW()
          AND EXISTS (SELECT 1 FROM activations a WHERE a.license_id = l.id AND a.device_hash = s.device_hash)
          AND NOT EXISTS (SELECT 1 FROM xf_free_claims f WHERE f.license_id = l.id)
        LIMIT 1
      `, [sha256(match[1])]);
      if (rows.length !== 1) return res.status(403).json({ ok: false, error: 'license_invalid_or_expired' });
      req.xfLicenseId = rows[0].id;
      next();
    } catch (error) { next(error); }
  }

  return { ensureTable, issueSession, issueCleanupSession, requirePaidSession };
}
module.exports = { createLicenseAuth };
