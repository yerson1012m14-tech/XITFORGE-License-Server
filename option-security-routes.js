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
    await pool.query(`ALTER TABLE xf_option_warnings ADD COLUMN IF NOT EXISTS warning_message TEXT NOT NULL DEFAULT ''`);
    await pool.query(`ALTER TABLE xf_option_warnings ADD COLUMN IF NOT EXISTS status_color TEXT NOT NULL DEFAULT 'green'`);
  }

  app.get('/api/admin/option-warnings', requireAdmin, async (req, res, next) => {
    try {
      const { rows } = await pool.query(`
        SELECT o.id, o.name, o.game, o.category, o.enabled AS option_enabled,
               COALESCE(w.enabled, FALSE) AS warning_enabled,
               COALESCE(w.warning_message, '') AS warning_message,
               COALESCE(w.status_color, 'green') AS status_color
          FROM app_options o
          LEFT JOIN xf_option_warnings w ON w.option_id = o.id
         ORDER BY o.game, o.category, o.name, o.id
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
      const message = req.body.message;
      const color = req.body.statusColor;
      if ((message !== undefined && (typeof message !== 'string' || message.length > 500 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(message))) ||
          (color !== undefined && !['green', 'yellow', 'red'].includes(color))) {
        return res.status(400).json({ ok: false, error: 'invalid_presentation' });
      }
      const { rows } = await pool.query(`
        INSERT INTO xf_option_warnings (option_id, enabled, warning_message, status_color, updated_at)
        SELECT id, $2::BOOLEAN, COALESCE($3::TEXT, ''), COALESCE($4::TEXT, 'green'), NOW() FROM app_options
         WHERE id = $1
        ON CONFLICT (option_id) DO UPDATE
           SET enabled = EXCLUDED.enabled,
               warning_message = COALESCE($3::TEXT, xf_option_warnings.warning_message),
               status_color = COALESCE($4::TEXT, xf_option_warnings.status_color), updated_at = NOW()
        RETURNING option_id, enabled, warning_message, status_color
      `, [id, req.body.enabled, message === undefined ? null : message.trim(), color === undefined ? null : color]);
      if (rows.length !== 1) {
        return res.status(404).json({ ok: false, error: 'option_not_found' });
      }
      return res.json({ ok: true, optionId: rows[0].option_id, warningEnabled: rows[0].enabled, warningMessage: rows[0].warning_message, statusColor: rows[0].status_color });
    } catch (error) { return next(error); }
  });

  app.get('/api/app/options', requirePaidSession, async (req, res, next) => {
    try {
      const { rows } = await pool.query(`SELECT option_id, warning_message, status_color FROM xf_option_warnings`);
      res.set('Cache-Control', 'no-store');
      const presentation = new Map(rows.map(row => [String(row.option_id), row]));
      const send = res.json.bind(res);
      res.json = body => {
        if (body && Array.isArray(body.options)) body.options = body.options.map(option => {
          const row = presentation.get(String(option.id));
          return { ...option, warningMessage: row?.warning_message || '', statusColor: row?.status_color || 'green' };
        });
        return send(body);
      };
      return next();
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
               COALESCE(w.warning_message, '') AS warning_message,
               COALESCE(w.status_color, 'green') AS status_color,
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
        ok: true, authorized: true, optionId: id,
        warnOnActivate: option.warning_enabled,
        warningMessage: option.warning_message, statusColor: option.status_color,
        licenseExpiresAt: option.license_expires_at
      });
    } catch (error) { return next(error); }
  });

  return { ensureTable };
}
module.exports = { registerOptionSecurityRoutes };
