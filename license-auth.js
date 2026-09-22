
'use strict';

const crypto = require('crypto');

function sha256(value) {
  return crypto
    .createHash('sha256')
    .update(value, 'utf8')
    .digest('hex');
}

function createLicenseAuth(pool) {
  async function ensureTable() {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS xf_auth_sessions (
        token_hash TEXT PRIMARY KEY,
        license_id BIGINT NOT NULL
          REFERENCES licenses(id) ON DELETE CASCADE,
        device_hash TEXT NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS xf_auth_sessions_license_idx
      ON xf_auth_sessions (license_id)
    `);
  }

  // Solo debe llamarse DESPUÉS de que el servidor valide la key.
  async function issueSession(licenseId, deviceId) {
    const id = Number(licenseId);

    if (
      !Number.isSafeInteger(id) ||
      id <= 0 ||
      typeof deviceId !== 'string' ||
      deviceId.length < 8 ||
      deviceId.length > 256
    ) {
      return null;
    }

    const token =
      'xf2_' + crypto.randomBytes(32).toString('hex');

    const result = await pool.query(
      `
        INSERT INTO xf_auth_sessions (
          token_hash,
          license_id,
          device_hash,
          expires_at
        )
        SELECT
          $1,
          l.id,
          $3,
          LEAST(
            l.expires_at,
            NOW() + INTERVAL '5 minutes'
          )
        FROM licenses l
        WHERE l.id = $2
          AND l.status = 'active'
          AND l.expires_at > NOW()

          -- El dispositivo debe estar vinculado a la licencia.
          AND EXISTS (
            SELECT 1
            FROM activations a
            WHERE a.license_id = l.id
              AND a.device_hash = $3
          )

          -- Las keys gratis antiguas no reciben autorización.
          AND NOT EXISTS (
            SELECT 1
            FROM xf_free_claims f
            WHERE f.license_id = l.id
          )

        RETURNING expires_at
      `,
      [sha256(token), id, sha256(deviceId)]
    );

    if (result.rows.length !== 1) {
      return null;
    }

    return {
      token,
      expiresAt: result.rows[0].expires_at
    };
  }

  // Middleware para proteger las rutas de opciones y descargas.
  async function requirePaidSession(req, res, next) {
    try {
      const authorization =
        req.get('Authorization') || '';

      const match = /^Bearer (xf2_[0-9a-f]{64})$/.exec(
        authorization
      );

      if (!match) {
        return res.status(401).json({
          ok: false,
          error: 'authorization_required'
        });
      }

      const result = await pool.query(
        `
          SELECT l.id
          FROM xf_auth_sessions s
          JOIN licenses l
            ON l.id = s.license_id
          WHERE s.token_hash = $1
            AND s.expires_at > NOW()
            AND l.status = 'active'
            AND l.expires_at > NOW()

            -- La vinculación del dispositivo sigue vigente.
            AND EXISTS (
              SELECT 1
              FROM activations a
              WHERE a.license_id = l.id
                AND a.device_hash = s.device_hash
            )

            -- Nunca autorizar licencias gratuitas.
            AND NOT EXISTS (
              SELECT 1
              FROM xf_free_claims f
              WHERE f.license_id = l.id
            )
          LIMIT 1
        `,
        [sha256(match[1])]
      );

      if (result.rows.length !== 1) {
        return res.status(403).json({
          ok: false,
          error: 'license_invalid_or_expired'
        });
      }

      req.xfLicenseId = result.rows[0].id;
      next();
    } catch (error) {
      next(error);
    }
  }

  return {
    ensureTable,
    issueSession,
    requirePaidSession
  };
}

module.exports = { createLicenseAuth };
