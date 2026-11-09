const express = require('express');
const crypto = require('crypto');

const GAME_MAP = Object.freeze({
  freefire_normal: 'com.dts.freefireth',
  freefire_max: 'com.dts.freefiremax'
});

const MAX_FILE_BYTES = 32 * 1024 * 1024;
const BINARY_MIME = 'application/octet-stream';

function normalizeText(value, maxLength) {
  return String(value || '')
    .trim()
    .slice(0, maxLength);
}

function normalizeGame(value) {
  const game = normalizeText(value, 64).toLowerCase();

  if (
    Object.prototype.hasOwnProperty.call(
      GAME_MAP,
      game
    )
  ) {
    return game;
  }

  return null;
}

function normalizeId(value) {
  const id = Number(value);

  if (!Number.isSafeInteger(id) || id < 1) {
    return null;
  }

  return id;
}

function normalizeOptionalFileRoute(value, slot) {
  if (typeof value !== 'string' || value.length > 4096) {
    throw new Error('La ruta del archivo ' + slot + ' no es válida.');
  }
  const route = value.trim().replace(/\/+$/, '');
  if (!route) {
    if (value.trim()) throw new Error('Usa una ruta relativa dentro del contenedor del juego.');
    return null;
  }
  if (/^[\/]|[\\:\x00-\x1f\x7f]/.test(route) ||
      route.split('/').some(part => !part || part === '.' || part === '..')) {
    throw new Error('Usa una ruta relativa dentro del contenedor del juego, sin puntos ni carpetas vacías.');
  }
  return route;
}

function normalizeThirdFileName(value) {
  const name = String(value ?? 'file3.bin').trim();
  if (!name || name === '.' || name === '..' ||
      Buffer.byteLength(name) > 255 || /[\/\\:"\x00-\x1f\x7f]/.test(name)) {
    return null;
  }
  return name;
}

function normalizeFileMime(value) {
  const mime = normalizeText(value, 120);
  return /^[\w!#$&^.+-]+\/[\w!#$&^.+-]+$/.test(mime) ? mime : BINARY_MIME;
}

function registerTwoFileOptionRoutes({
  app,
  pool,
  requireAdmin
}) {

  async function ensureTable() {
    await pool.query(`
      ALTER TABLE app_options
        ADD COLUMN IF NOT EXISTS file2_name TEXT;

      ALTER TABLE app_options
        ADD COLUMN IF NOT EXISTS file2_mime_type TEXT;

      ALTER TABLE app_options
        ADD COLUMN IF NOT EXISTS file2_size BIGINT NOT NULL DEFAULT 0;

      ALTER TABLE app_options
        ADD COLUMN IF NOT EXISTS file2_data BYTEA;

      ALTER TABLE app_options
        ADD COLUMN IF NOT EXISTS file2_route TEXT;

      ALTER TABLE app_options
        ADD COLUMN IF NOT EXISTS file3_name TEXT,
        ADD COLUMN IF NOT EXISTS file3_mime_type TEXT,
        ADD COLUMN IF NOT EXISTS file3_size BIGINT NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS file3_data BYTEA,
        ADD COLUMN IF NOT EXISTS file3_route TEXT;
    `);

    console.log(
      'PostgreSQL optional option-file columns initialized.'
    );
  }

  /*
   * =========================================================
   * ADMIN - LIST OPTIONS
   *
   * Registered before the original options-routes.js GET route
   * so the panel receives all file slots without changing the
   * existing create/edit/status logic.
   * =========================================================
   */

  app.get(
    '/api/admin/options',
    requireAdmin,
    async (req, res) => {
      try {
        const result = await pool.query(`
          SELECT
            id,
            name,
            description,
            game,
            tunnel_bundle_id,
            category,
            route,
            file_name,
            mime_type,
            file_size,
            file2_name,
            file2_route,
            file2_mime_type,
            file2_size,
            file3_name,
            file3_route,
            file3_mime_type,
            file3_size,
            enabled,
            sort_order,
            created_at,
            updated_at,
            (file_data IS NOT NULL) AS has_file,
            (file2_data IS NOT NULL) AS has_file2,
            (file3_data IS NOT NULL) AS has_file3
          FROM app_options
          ORDER BY
            sort_order ASC,
            id ASC
        `);

        res.json({
          ok: true,
          options: result.rows.map(row => ({
            id: Number(row.id),
            name: row.name,
            description: row.description,
            game: row.game,
            category: row.category || 'holograma',
            bundleId: GAME_MAP[row.game],
            tunnelBundleId: row.tunnel_bundle_id || null,
            route: row.route,

            fileName: row.file_name,
            mimeType: row.mime_type,
            fileSize: Number(row.file_size || 0),
            hasFile: Boolean(row.has_file),

            file2Name: row.file2_name,
            file2Route: row.file2_route || '',
            file2MimeType: row.file2_mime_type,
            file2Size: Number(row.file2_size || 0),
            hasFile2: Boolean(row.has_file2),

            file3Name: row.file3_name,
            file3Route: row.file3_route || '',
            file3MimeType: row.file3_mime_type,
            file3Size: Number(row.file3_size || 0),
            hasFile3: Boolean(row.has_file3),

            enabled: Boolean(row.enabled),
            sortOrder: Number(row.sort_order || 0),
            createdAt: row.created_at,
            updatedAt: row.updated_at
          }))
        });
      } catch (error) {
        console.error(
          'List app options with optional files error:',
          error
        );

        res.status(500).json({
          ok: false,
          error: 'Database error'
        });
      }
    }
  );

  app.put('/api/admin/options/:id/file2-route', requireAdmin, async (req, res) => {
    const id = normalizeId(req.params.id);
    if (!id) return res.status(400).json({ ok: false, error: 'Invalid option id' });
    let route;
    try {
      route = normalizeOptionalFileRoute(req.body?.file2Route, 2);
    } catch (error) {
      return res.status(400).json({ ok: false, error: error.message });
    }
    try {
      const result = await pool.query(`
        UPDATE app_options SET file2_route = $1, updated_at = NOW()
        WHERE id = $2 RETURNING id, file2_route
      `, [route, id]);
      if (!result.rows.length) return res.status(404).json({ ok: false, error: 'Option not found' });
      res.json({ ok: true, file2Route: result.rows[0].file2_route || '' });
    } catch (error) {
      console.error('Update second file route error:', error);
      res.status(500).json({ ok: false, error: 'Database error' });
    }
  });

  app.put('/api/admin/options/:id/file3-route', requireAdmin, async (req, res) => {
    const id = normalizeId(req.params.id);
    if (!id) return res.status(400).json({ ok: false, error: 'Invalid option id' });
    let route;
    try {
      route = normalizeOptionalFileRoute(req.body?.file3Route, 3);
    } catch (error) {
      return res.status(400).json({ ok: false, error: error.message });
    }
    try {
      const { rows } = await pool.query(
        'UPDATE app_options SET file3_route = $1, updated_at = NOW() ' +
        'WHERE id = $2 RETURNING file3_route',
        [route, id]
      );
      if (!rows.length) return res.status(404).json({ ok: false, error: 'Option not found' });
      return res.json({ ok: true, file3Route: rows[0].file3_route || '' });
    } catch (error) {
      console.error('Update third file route error:', error);
      return res.status(500).json({ ok: false, error: 'Database error' });
    }
  });

  app.post(
    '/api/admin/options/:id/file3',
    requireAdmin,
    express.raw({ type: BINARY_MIME, limit: '32mb' }),
    async (req, res) => {
      const id = normalizeId(req.params.id);
      if (!id) return res.status(400).json({ ok: false, error: 'Invalid option id' });

      const buffer = req.body;
      if (!Buffer.isBuffer(buffer) || !buffer.length) {
        return res.status(400).json({ ok: false, error: 'File is empty' });
      }
      if (buffer.length > MAX_FILE_BYTES) {
        return res.status(413).json({ ok: false, error: 'El archivo 3 supera 32 MB.' });
      }

      const fileName = normalizeThirdFileName(req.get('x-file-name'));
      if (!fileName) {
        return res.status(400).json({ ok: false, error: 'El nombre del archivo 3 no es válido.' });
      }
      const mimeType = normalizeFileMime(req.get('x-file-mime'));
      const routeHeader = req.get('x-file-route');
      let route = null;
      try {
        if (routeHeader !== undefined) {
          route = normalizeOptionalFileRoute(decodeURIComponent(routeHeader), 3);
        }
      } catch (error) {
        return res.status(400).json({ ok: false, error: 'La ruta del archivo 3 no es válida.' });
      }

      try {
        const { rows } = await pool.query(
          'UPDATE app_options ' +
          'SET file3_name = $1, file3_mime_type = $2, file3_size = $3, file3_data = $4, ' +
          'file3_route = CASE WHEN $5::BOOLEAN THEN $6::TEXT ELSE file3_route END, ' +
          'updated_at = NOW() WHERE id = $7 ' +
          'RETURNING file3_name, file3_mime_type, file3_size, file3_route, updated_at',
          [fileName, mimeType, buffer.length, buffer, routeHeader !== undefined, route, id]
        );
        if (!rows.length) return res.status(404).json({ ok: false, error: 'Option not found' });
        const row = rows[0];
        return res.json({
          ok: true,
          id,
          file3Name: row.file3_name,
          file3MimeType: row.file3_mime_type,
          file3Size: Number(row.file3_size),
          file3Route: row.file3_route || '',
          updatedAt: row.updated_at,
          sha256: crypto.createHash('sha256').update(buffer).digest('hex')
        });
      } catch (error) {
        console.error('Upload third option file error:', error);
        return res.status(500).json({ ok: false, error: 'Database error' });
      }
    }
  );

  app.delete('/api/admin/options/:id/file3', requireAdmin, async (req, res) => {
    const id = normalizeId(req.params.id);
    if (!id) return res.status(400).json({ ok: false, error: 'Invalid option id' });
    try {
      const { rows } = await pool.query(
        'UPDATE app_options ' +
        'SET file3_name = NULL, file3_mime_type = NULL, file3_size = 0, file3_data = NULL, ' +
        'updated_at = NOW() WHERE id = $1 RETURNING id',
        [id]
      );
      if (!rows.length) return res.status(404).json({ ok: false, error: 'Option not found' });
      return res.json({ ok: true, id, slot: 3 });
    } catch (error) {
      console.error('Delete third option file error:', error);
      return res.status(500).json({ ok: false, error: 'Database error' });
    }
  });

  /*
   * =========================================================
   * ADMIN - UPLOAD FILE 2
   * =========================================================
   */

  app.post(
    '/api/admin/options/:id/file2',
    requireAdmin,
    express.raw({
      type: 'application/octet-stream',
      limit: '32mb'
    }),
    async (req, res) => {
      try {
        const id = normalizeId(req.params.id);

        if (!id) {
          return res.status(400).json({
            ok: false,
            error: 'Invalid option id'
          });
        }

        const buffer =
          Buffer.isBuffer(req.body)
            ? req.body
            : Buffer.alloc(0);

        if (buffer.length === 0) {
          return res.status(400).json({
            ok: false,
            error: 'File is empty'
          });
        }

        const fileName =
          normalizeText(
            req.get('x-file-name') || 'file2.bin',
            255
          );

        const mimeType =
          normalizeText(
            req.get('x-file-mime') ||
              'application/octet-stream',
            120
          );

        const now = new Date().toISOString();

        const result = await pool.query(
          `
            UPDATE app_options
            SET
              file2_name = $1,
              file2_mime_type = $2,
              file2_size = $3,
              file2_data = $4,
              updated_at = $5
            WHERE id = $6
            RETURNING
              id,
              file2_name,
              file2_mime_type,
              file2_size,
              updated_at
          `,
          [
            fileName,
            mimeType,
            buffer.length,
            buffer,
            now,
            id
          ]
        );

        if (result.rowCount !== 1) {
          return res.status(404).json({
            ok: false,
            error: 'Option not found'
          });
        }

        res.json({
          ok: true,
          id,
          file2Name:
            result.rows[0].file2_name,
          file2MimeType:
            result.rows[0].file2_mime_type,
          file2Size:
            Number(result.rows[0].file2_size || 0),
          updatedAt:
            result.rows[0].updated_at,
          sha256:
            crypto
              .createHash('sha256')
              .update(buffer)
              .digest('hex')
        });
      } catch (error) {
        console.error(
          'Upload second option file error:',
          error
        );

        res.status(500).json({
          ok: false,
          error: 'Database error'
        });
      }
    }
  );

  /*
   * =========================================================
   * ADMIN - DELETE FILE 1 ONLY
   * =========================================================
   */

  app.delete(
    '/api/admin/options/:id/file',
    requireAdmin,
    async (req, res) => {
      try {
        const id = normalizeId(req.params.id);

        if (!id) {
          return res.status(400).json({
            ok: false,
            error: 'Invalid option id'
          });
        }

        const result = await pool.query(
          `
            UPDATE app_options
            SET
              file_name = NULL,
              mime_type = NULL,
              file_size = 0,
              file_data = NULL,
              updated_at = $1
            WHERE id = $2
            RETURNING id
          `,
          [
            new Date().toISOString(),
            id
          ]
        );

        if (result.rowCount !== 1) {
          return res.status(404).json({
            ok: false,
            error: 'Option not found'
          });
        }

        res.json({
          ok: true,
          id,
          slot: 1
        });
      } catch (error) {
        console.error(
          'Delete first option file error:',
          error
        );

        res.status(500).json({
          ok: false,
          error: 'Database error'
        });
      }
    }
  );

  /*
   * =========================================================
   * ADMIN - DELETE FILE 2 ONLY
   * =========================================================
   */

  app.delete(
    '/api/admin/options/:id/file2',
    requireAdmin,
    async (req, res) => {
      try {
        const id = normalizeId(req.params.id);

        if (!id) {
          return res.status(400).json({
            ok: false,
            error: 'Invalid option id'
          });
        }

        const result = await pool.query(
          `
            UPDATE app_options
            SET
              file2_name = NULL,
              file2_mime_type = NULL,
              file2_size = 0,
              file2_data = NULL,
              updated_at = $1
            WHERE id = $2
            RETURNING id
          `,
          [
            new Date().toISOString(),
            id
          ]
        );

        if (result.rowCount !== 1) {
          return res.status(404).json({
            ok: false,
            error: 'Option not found'
          });
        }

        res.json({
          ok: true,
          id,
          slot: 2
        });
      } catch (error) {
        console.error(
          'Delete second option file error:',
          error
        );

        res.status(500).json({
          ok: false,
          error: 'Database error'
        });
      }
    }
  );

  /*
   * =========================================================
   * PUBLIC - OPTIONS FOR IPA
   *
   * Keeps the old fileUrl fields for compatibility and adds:
   *   file2Name / file2Size / file2Url
   *   files[] with every file currently stored.
   * =========================================================
   */

  app.get(
    '/api/app/options',
    async (req, res) => {
      try {
        const game =
          normalizeGame(req.query.game);

        if (!game) {
          return res.status(400).json({
            ok: false,
            error: 'game is required'
          });
        }

        const result = await pool.query(
          `
            SELECT
              id,
              name,
              description,
              game,
              tunnel_bundle_id,
              category,
              route,
              file_name,
              file_size,
              file2_name,
              file2_size,
              file2_route,
              file3_name,
              file3_size,
              file3_route,
              updated_at,
              (file_data IS NOT NULL) AS has_file,
              (file2_data IS NOT NULL) AS has_file2,
              (file3_data IS NOT NULL) AS has_file3
            FROM app_options
            WHERE game = $1
              AND enabled = TRUE
            ORDER BY
              sort_order ASC,
              id ASC
          `,
          [game]
        );

        const baseUrl =
          process.env.PUBLIC_BASE_URL || '';

        res.json({
          ok: true,
          game,
          bundleId: GAME_MAP[game],
          options: result.rows.map(row => {
            const id = Number(row.id);

            const file1Url =
              `${baseUrl}/api/app/options/${id}/file`;

            const file2Url =
              `${baseUrl}/api/app/options/${id}/file2`;

            const files = [];

            if (row.has_file) {
              files.push({
                slot: 1,
                fileName: row.file_name,
                route: row.route,
                fileSize:
                  Number(row.file_size || 0),
                fileUrl: file1Url
              });
            }

            if (row.has_file2) {
              files.push({
                slot: 2,
                fileName: row.file2_name,
                route: row.file2_route || row.route,
                fileSize:
                  Number(row.file2_size || 0),
                fileUrl: file2Url
              });
            }

            if (row.has_file3) {
              files.push({
                slot: 3,
                fileName: row.file3_name,
                route: row.file3_route || row.route,
                fileSize: Number(row.file3_size || 0),
                fileUrl: baseUrl + '/api/app/options/' + id + '/file3'
              });
            }

            return {
              id,
              name: row.name,
              description: row.description,
              game: row.game,
              category:
                row.category || 'holograma',
              bundleId:
                GAME_MAP[row.game],
              tunnelBundleId:
                row.tunnel_bundle_id || null,
              route: row.route,

              // Old contract preserved.
              fileName: row.file_name,
              fileSize:
                Number(row.file_size || 0),
              fileUrl: file1Url,

              // New optional second file.
              file2Name: row.file2_name,
              file2Route: row.file2_route || row.route,
              file2Size:
                Number(row.file2_size || 0),
              file2Url:
                row.has_file2
                  ? file2Url
                  : null,

              // Easier contract for future clients.
              files,

              updatedAt: row.updated_at
            };
          })
        });
      } catch (error) {
        console.error(
          'Public app options with optional files error:',
          error
        );

        res.status(500).json({
          ok: false,
          error: 'Database error'
        });
      }
    }
  );

  /*
   * =========================================================
   * PUBLIC - DOWNLOAD FILE 2
   * =========================================================
   */

  app.get(
    '/api/app/options/:id/file2',
    async (req, res) => {
      try {
        const id = normalizeId(req.params.id);

        if (!id) {
          return res.status(400).json({
            ok: false,
            error: 'Invalid option id'
          });
        }

        const result = await pool.query(
          `
            SELECT
              file2_name,
              file2_mime_type,
              file2_size,
              file2_data
            FROM app_options
            WHERE id = $1
              AND enabled = TRUE
            LIMIT 1
          `,
          [id]
        );

        if (
          result.rows.length === 0 ||
          !result.rows[0].file2_data
        ) {
          return res.status(404).json({
            ok: false,
            error: 'File not found'
          });
        }

        const row = result.rows[0];

        res.setHeader(
          'Content-Type',
          row.file2_mime_type ||
            'application/octet-stream'
        );

        res.setHeader(
          'Content-Length',
          String(
            row.file2_size ||
            row.file2_data.length
          )
        );

        const safeFileName =
          String(
            row.file2_name ||
              'file2.bin'
          ).replace(/"/g, '');

        res.setHeader(
          'Content-Disposition',
          `attachment; filename="${safeFileName}"`
        );

        res.send(row.file2_data);
      } catch (error) {
        console.error(
          'Download second option file error:',
          error
        );

        res.status(500).json({
          ok: false,
          error: 'Database error'
        });
      }
    }
  );

  app.get('/api/app/options/:id/file3', async (req, res) => {
    const id = normalizeId(req.params.id);
    if (!id) return res.status(400).json({ ok: false, error: 'Invalid option id' });
    try {
      const { rows } = await pool.query(
        'SELECT file3_name, file3_mime_type, file3_data FROM app_options ' +
        'WHERE id = $1 AND enabled = TRUE LIMIT 1',
        [id]
      );
      const row = rows[0];
      if (!row?.file3_data) return res.status(404).json({ ok: false, error: 'File not found' });
      res.setHeader('Content-Type', normalizeFileMime(row.file3_mime_type));
      res.setHeader('Content-Length', String(row.file3_data.length));
      res.setHeader('Content-Disposition', 'attachment; filename="' +
        (normalizeThirdFileName(row.file3_name) || 'file3.bin') + '"');
      return res.send(row.file3_data);
    } catch (error) {
      console.error('Download third option file error:', error);
      return res.status(500).json({ ok: false, error: 'Database error' });
    }
  });

  return {
    ensureTable
  };
}

module.exports = {
  registerTwoFileOptionRoutes
};

