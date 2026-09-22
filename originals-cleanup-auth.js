'use strict';

const crypto = require('crypto');
const tokenPattern = /^Bearer (xf2_[0-9a-f]{64})$/;

/* Only restores original files: a previously authenticated device may
   retrieve originals after revocation/expiry, for up to 24 hours after
   its last successful validation. Does NOT authorize premium options. */
function createOriginalsCleanupAuth(pool) {
  return async function originalsCleanupAuth(req, res, next) {
    try {
      const match = tokenPattern.exec(req.get('Authorization') || '');
      if (!match) return res.status(401).json({ ok: false, error: 'authorization_required' });
      const tokenHash = crypto.createHash('sha256').update(match[1]).digest('hex');
      const { rows } = await pool.query(`
        SELECT s.license_id
          FROM xf_auth_sessions s
          JOIN licenses l ON l.id = s.license_id
         WHERE s.token_hash = $1
           AND s.created_at > NOW() - INTERVAL '24 hours'
           AND EXISTS (
             SELECT 1 FROM activations a
              WHERE a.license_id = s.license_id
                AND a.device_hash = s.device_hash
           )
         LIMIT 1
      `, [tokenHash]);
      if (rows.length !== 1) return res.status(403).json({ ok: false, error: 'cleanup_unavailable' });
      req.xfLicenseId = rows[0].license_id;
      return next();
    } catch (error) { return next(error); }
  };
}
module.exports = { createOriginalsCleanupAuth };
