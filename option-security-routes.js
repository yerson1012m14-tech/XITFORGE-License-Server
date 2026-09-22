'use strict';

/* Independent add-on: does not rewrite the existing two-file and restore endpoints. */
function registerOptionSecurityRoutes({ app, pool, requireAdmin, requirePaidSession }) {
  async function ensureTable() {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS xf_option_warnings (
        option_id BIGINT PRIMARY KEY REFERENCES app_options(id) ON DELETE CASCADE,
        enabled BOOLEAN NOT NULL DEFAULT FALSE,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
  }

  app.get('/api/admin/option-warnings', requireAdmin, async (req, res, next) => {
    try {
      const { rows } = await pool.query(`
        SELECT o.id, o.name, o.game, o.category, o.enabled AS option_enabled,
               COALESCE(w.enabled, FALSE) AS warning_enabled
          FROM app_options o
          LEFT JOIN xf_option_warnings w ON w.option_id = o.id
         WHERE o.category = 'aimbot'
         ORDER BY o.game, o.name, o.id
      `);
      res.set('Cache-Control', 'no-store');
      return res.json({ ok: true, options: rows });
    } catch (error) { return next(error); }
  });

  app.put('/api/admin/options/:id/warning', requireAdmin, async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isSafeInteger(id) || id < 1 || typeof req.body?.enabled !== 'boolean') {
        return res.status(400).json({ ok: false, error: 'invalid_option_or_enabled' });
      }
      const { rows } = await pool.query(`
        INSERT INTO xf_option_warnings (option_id, enabled, updated_at)
        SELECT id, $2::BOOLEAN, NOW() FROM app_options
         WHERE id = $1 AND category = 'aimbot'
        ON CONFLICT (option_id) DO UPDATE
           SET enabled = EXCLUDED.enabled, updated_at = NOW()
        RETURNING option_id, enabled
      `, [id, req.body.enabled]);
      if (rows.length !== 1) {
        return res.status(404).json({ ok: false, error: 'aimbot_option_not_found' });
      }
      return res.json({ ok: true, optionId: rows[0].option_id, warningEnabled: rows[0].enabled });
    } catch (error) { return next(error); }
  });

  /* The check is tied to the exact option, not to a user-controlled premium flag. */
  app.post('/api/app/options/:id/authorize', requirePaidSession, async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isSafeInteger(id) || id < 1) {
        return res.status(400).json({ ok: false, authorized: false, error: 'invalid_option' });
      }
      const { rows } = await pool.query(`
        SELECT o.id, o.category, o.game, o.enabled,
               COALESCE(w.enabled, FALSE) AS warning_enabled,
               l.expires_at AS license_expires_at
          FROM app_options o
          LEFT JOIN xf_option_warnings w ON w.option_id = o.id
          JOIN licenses l ON l.id = $2
         WHERE o.id = $1 AND o.enabled = TRUE
           AND l.status = 'active' AND l.expires_at > NOW()
         LIMIT 1
      `, [id, req.xfLicenseId]);
      if (rows.length !== 1) {
        return res.status(403).json({ ok: false, authorized: false, error: 'option_or_license_unavailable' });
      }
      const option = rows[0];
      res.set('Cache-Control', 'no-store');
      return res.json({
        ok: true, authorized: true, optionId: option.id,
        warnOnActivate: option.category === 'aimbot' && option.warning_enabled,
        licenseExpiresAt: option.license_expires_at
      });
    } catch (error) { return next(error); }
  });

  return { ensureTable };
}
module.exports = { registerOptionSecurityRoutes };
