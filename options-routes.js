const express = require('express');
const crypto = require('crypto');

const GAME_MAP = Object.freeze({
  freefire_normal: 'com.dts.freefireth',
  freefire_max: 'com.dts.freefiremax'
});

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

function validateRoute(route) {
  const value = normalizeText(route, 2048);

  if (!value) {
    return null;
  }

  if (value.includes('\\')) {
    return null;
  }

  if (value.includes('\0')) {
    return null;
  }

  if (value.startsWith('/')) {
    return null;
  }

  if (value.includes('..')) {
    return null;
  }

  return value.replace(/^\/+|\/+$/g, '');
}

function registerOptionsRoutes({
  app,
  pool,
  requireAdmin
}) {

  async function ensureTable() {

    await pool.query(`
      CREATE TABLE IF NOT EXISTS app_options (
        id BIGSERIAL PRIMARY KEY,

        name TEXT NOT NULL,

        description TEXT NOT NULL
          DEFAULT '',

        game TEXT NOT NULL,

        route TEXT NOT NULL,

        file_name TEXT,

        mime_type TEXT,

        file_size BIGINT NOT NULL
          DEFAULT 0,

        file_data BYTEA,

        enabled BOOLEAN NOT NULL
          DEFAULT TRUE,

        sort_order INTEGER NOT NULL
          DEFAULT 0,

        created_at TIMESTAMPTZ NOT NULL,

        updated_at TIMESTAMPTZ NOT NULL,

        CONSTRAINT app_options_game_check
          CHECK (
            game IN (
              'freefire_normal',
              'freefire_max'
            )
          )
      );
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS
        idx_app_options_game_enabled
      ON app_options(
        game,
        enabled,
        sort_order,
        id
      );
    `);

    console.log(
      'PostgreSQL app options table initialized.'
    );
  }

  /*
   * =========================================================
   * ADMIN - LIST OPTIONS
   * =========================================================
   */

  app.get(
    '/api/admin/options',
    requireAdmin,
    async (req, res) => {

      try {

        const result =
          await pool.query(`
            SELECT
              id,
              name,
              description,
              game,
              route,
              file_name,
              mime_type,
              file_size,
              enabled,
              sort_order,
              created_at,
              updated_at,
              (
                file_data IS NOT NULL
              ) AS has_file
            FROM app_options
            ORDER BY
              sort_order ASC,
              id ASC
          `);

        res.json({
          ok: true,

          options:
            result.rows.map(row => ({
              id:
                Number(row.id),

              name:
                row.name,

              description:
                row.description,

              game:
                row.game,

              bundleId:
                GAME_MAP[row.game],

              route:
                row.route,

              fileName:
                row.file_name,

              mimeType:
                row.mime_type,

              fileSize:
                Number(
                  row.file_size || 0
                ),

              hasFile:
                Boolean(
                  row.has_file
                ),

              enabled:
                Boolean(
                  row.enabled
                ),

              sortOrder:
                Number(
                  row.sort_order || 0
                ),

              createdAt:
                row.created_at,

              updatedAt:
                row.updated_at
            }))
        });

      } catch (error) {

        console.error(
          'List app options error:',
          error
        );

        res
          .status(500)
          .json({
            ok: false,
            error:
              'Database error'
          });
      }
    }
  );

  /*
   * =========================================================
   * ADMIN - CREATE OPTION
   * =========================================================
   */

  app.post(
    '/api/admin/options',
    requireAdmin,
    async (req, res) => {

      try {

        const name =
          normalizeText(
            req.body.name,
            120
          );

        const description =
          normalizeText(
            req.body.description,
            500
          );

        const game =
          normalizeGame(
            req.body.game
          );

        const route =
          validateRoute(
            req.body.route
          );

        const sortOrder =
          Math.max(
            -100000,
            Math.min(
              100000,
              Number(
                req.body.sortOrder
              ) || 0
            )
          );

        if (!name) {

          return res
            .status(400)
            .json({
              ok: false,
              error:
                'name is required'
            });
        }

        if (!game) {

          return res
            .status(400)
            .json({
              ok: false,
              error:
                'game is invalid'
            });
        }

        if (!route) {

          return res
            .status(400)
            .json({
              ok: false,
              error:
                'route is invalid'
            });
        }

        const timestamp =
          new Date().toISOString();

        const result =
          await pool.query(
            `
              INSERT INTO app_options
                (
                  name,
                  description,
                  game,
                  route,
                  enabled,
                  sort_order,
                  created_at,
                  updated_at
                )
              VALUES
                (
                  $1,
                  $2,
                  $3,
                  $4,
                  TRUE,
                  $5,
                  $6,
                  $6
                )
              RETURNING
                id,
                name,
                description,
                game,
                route,
                enabled,
                sort_order,
                created_at,
                updated_at
            `,
            [
              name,
              description,
              game,
              route,
              sortOrder,
              timestamp
            ]
          );

        const row =
          result.rows[0];

        res
          .status(201)
          .json({
            ok: true,

            option: {
              id:
                Number(row.id),

              name:
                row.name,

              description:
                row.description,

              game:
                row.game,

              bundleId:
                GAME_MAP[row.game],

              route:
                row.route,

              enabled:
                Boolean(
                  row.enabled
                ),

              sortOrder:
                Number(
                  row.sort_order
                ),

              createdAt:
                row.created_at,

              updatedAt:
                row.updated_at,

              hasFile:
                false,

              fileName:
                null,

              fileSize:
                0
            }
          });

      } catch (error) {

        console.error(
          'Create app option error:',
          error
        );

        res
          .status(500)
          .json({
            ok: false,
            error:
              'Database error'
          });
      }
    }
  );

  /*
   * =========================================================
   * ADMIN - UPDATE OPTION
   * =========================================================
   */

  app.put(
    '/api/admin/options/:id',
    requireAdmin,
    async (req, res) => {

      try {

        const id =
          Number(
            req.params.id
          );

        if (
          !Number.isInteger(id) ||
          id <= 0
        ) {

          return res
            .status(400)
            .json({
              ok: false,
              error:
                'Invalid option id'
            });
        }

        const name =
          normalizeText(
            req.body.name,
            120
          );

        const description =
          normalizeText(
            req.body.description,
            500
          );

        const game =
          normalizeGame(
            req.body.game
          );

        const route =
          validateRoute(
            req.body.route
          );

        const sortOrder =
          Math.max(
            -100000,
            Math.min(
              100000,
              Number(
                req.body.sortOrder
              ) || 0
            )
          );

        if (
          !name ||
          !game ||
          !route
        ) {

          return res
            .status(400)
            .json({
              ok: false,
              error:
                'Invalid option data'
            });
        }

        const result =
          await pool.query(
            `
              UPDATE app_options
              SET
                name = $1,
                description = $2,
                game = $3,
                route = $4,
                sort_order = $5,
                updated_at = $6
              WHERE id = $7
              RETURNING
                id,
                name,
                description,
                game,
                route,
                enabled,
                sort_order,
                updated_at
            `,
            [
              name,
              description,
              game,
              route,
              sortOrder,
              new Date().toISOString(),
              id
            ]
          );

        if (
          result.rowCount !== 1
        ) {

          return res
            .status(404)
            .json({
              ok: false,
              error:
                'Option not found'
            });
        }

        const row =
          result.rows[0];

        res.json({
          ok: true,

          option: {
            id:
              Number(row.id),

            name:
              row.name,

            description:
              row.description,

            game:
              row.game,

            bundleId:
              GAME_MAP[row.game],

            route:
              row.route,

            enabled:
              Boolean(
                row.enabled
              ),

            sortOrder:
              Number(
                row.sort_order
              ),

            updatedAt:
              row.updated_at
          }
        });

      } catch (error) {

        console.error(
          'Update app option error:',
          error
        );

        res
          .status(500)
          .json({
            ok: false,
            error:
              'Database error'
          });
      }
    }
  );

  /*
   * =========================================================
   * ADMIN - ENABLE / DISABLE
   * =========================================================
   */

  app.patch(
    '/api/admin/options/:id/status',
    requireAdmin,
    async (req, res) => {

      try {

        const id =
          Number(
            req.params.id
          );

        const enabled =
          Boolean(
            req.body.enabled
          );

        const result =
          await pool.query(
            `
              UPDATE app_options
              SET
                enabled = $1,
                updated_at = $2
              WHERE id = $3
              RETURNING
                id,
                enabled,
                updated_at
            `,
            [
              enabled,
              new Date().toISOString(),
              id
            ]
          );

        if (
          result.rowCount !== 1
        ) {

          return res
            .status(404)
            .json({
              ok: false,
              error:
                'Option not found'
            });
        }

        res.json({
          ok: true,
          id,
          enabled,
          updatedAt:
            result.rows[0]
              .updated_at
        });

      } catch (error) {

        console.error(
          'Toggle app option error:',
          error
        );

        res
          .status(500)
          .json({
            ok: false,
            error:
              'Database error'
          });
      }
    }
  );

  /*
   * =========================================================
   * ADMIN - DELETE
   * =========================================================
   */

  app.delete(
    '/api/admin/options/:id',
    requireAdmin,
    async (req, res) => {

      try {

        const id =
          Number(
            req.params.id
          );

        const result =
          await pool.query(
            `
              DELETE FROM app_options
              WHERE id = $1
            `,
            [id]
          );

        if (
          result.rowCount !== 1
        ) {

          return res
            .status(404)
            .json({
              ok: false,
              error:
                'Option not found'
            });
        }

        res.json({
          ok: true
        });

      } catch (error) {

        console.error(
          'Delete app option error:',
          error
        );

        res
          .status(500)
          .json({
            ok: false,
            error:
              'Database error'
          });
      }
    }
  );

  /*
   * =========================================================
   * ADMIN - UPLOAD FILE
   *
   * El archivo se guarda en PostgreSQL como BYTEA.
   * =========================================================
   */

  app.post(
    '/api/admin/options/:id/file',
    requireAdmin,

    express.raw({
      type:
        'application/octet-stream',

      limit:
        '32mb'
    }),

    async (req, res) => {

      try {

        const id =
          Number(
            req.params.id
          );

        const buffer =
          Buffer.isBuffer(
            req.body
          )
            ? req.body
            : Buffer.alloc(0);

        if (
          !Number.isInteger(id) ||
          id <= 0
        ) {

          return res
            .status(400)
            .json({
              ok: false,
              error:
                'Invalid option id'
            });
        }

        if (
          buffer.length === 0
        ) {

          return res
            .status(400)
            .json({
              ok: false,
              error:
                'File is empty'
            });
        }

        const fileName =
          normalizeText(
            req.get(
              'x-file-name'
            ) ||
            'file.bin',
            255
          );

        const mimeType =
          normalizeText(
            req.get(
              'x-file-mime'
            ) ||
            'application/octet-stream',
            120
          );

        const now =
          new Date().toISOString();

        const result =
          await pool.query(
            `
              UPDATE app_options
              SET
                file_name = $1,
                mime_type = $2,
                file_size = $3,
                file_data = $4,
                updated_at = $5
              WHERE id = $6
              RETURNING
                id,
                file_name,
                mime_type,
                file_size,
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

        if (
          result.rowCount !== 1
        ) {

          return res
            .status(404)
            .json({
              ok: false,
              error:
                'Option not found'
            });
        }

        res.json({
          ok: true,

          id,

          fileName:
            result.rows[0]
              .file_name,

          mimeType:
            result.rows[0]
              .mime_type,

          fileSize:
            Number(
              result.rows[0]
                .file_size
            ),

          updatedAt:
            result.rows[0]
              .updated_at,

          sha256:
            crypto
              .createHash(
                'sha256'
              )
              .update(buffer)
              .digest('hex')
        });

      } catch (error) {

        console.error(
          'Upload option file error:',
          error
        );

        res
          .status(500)
          .json({
            ok: false,
            error:
              'Database error'
          });
      }
    }
  );

  /*
   * =========================================================
   * PUBLIC - OPTIONS FOR IPA
   * =========================================================
   */

  app.get(
    '/api/app/options',
    async (req, res) => {

      try {

        const game =
          normalizeGame(
            req.query.game
          );

        if (!game) {

          return res
            .status(400)
            .json({
              ok: false,
              error:
                'game is required'
            });
        }

        const result =
          await pool.query(
            `
              SELECT
                id,
                name,
                description,
                game,
                route,
                file_name,
                file_size,
                updated_at
              FROM app_options
              WHERE game = $1
                AND enabled = TRUE
              ORDER BY
                sort_order ASC,
                id ASC
            `,
            [game]
          );

        res.json({
          ok: true,

          game,

          bundleId:
            GAME_MAP[game],

          options:
            result.rows.map(
              row => ({
                id:
                  Number(
                    row.id
                  ),

                name:
                  row.name,

                description:
                  row.description,

                game:
                  row.game,

                bundleId:
                  GAME_MAP[
                    row.game
                  ],

                route:
                  row.route,

                fileName:
                  row.file_name,

                fileSize:
                  Number(
                    row.file_size ||
                    0
                  ),

                updatedAt:
                  row.updated_at,

                fileUrl:
                  `${
                    process.env.PUBLIC_BASE_URL ||
                    ''
                  }/api/app/options/${
                    row.id
                  }/file`
              })
            )
        });

      } catch (error) {

        console.error(
          'Public app options error:',
          error
        );

        res
          .status(500)
          .json({
            ok: false,
            error:
              'Database error'
          });
      }
    }
  );

  /*
   * =========================================================
   * PUBLIC - DOWNLOAD FILE
   * =========================================================
   */

  app.get(
    '/api/app/options/:id/file',
    async (req, res) => {

      try {

        const id =
          Number(
            req.params.id
          );

        const result =
          await pool.query(
            `
              SELECT
                file_name,
                mime_type,
                file_size,
                file_data
              FROM app_options
              WHERE id = $1
                AND enabled = TRUE
              LIMIT 1
            `,
            [id]
          );

        if (
          result.rows.length === 0 ||
          !result.rows[0]
            .file_data
        ) {

          return res
            .status(404)
            .json({
              ok: false,
              error:
                'File not found'
            });
        }

        const row =
          result.rows[0];

        res.setHeader(
          'Content-Type',
          row.mime_type ||
            'application/octet-stream'
        );

        res.setHeader(
          'Content-Length',
          String(
            row.file_size ||
            row.file_data.length
          )
        );

        const safeFileName =
          String(
            row.file_name ||
            'file.bin'
          ).replace(
            /"/g,
            ''
          );

        res.setHeader(
          'Content-Disposition',
          `attachment; filename="${safeFileName}"`
        );

        res.send(
          row.file_data
        );

      } catch (error) {

        console.error(
          'Download option file error:',
          error
        );

        res
          .status(500)
          .json({
            ok: false,
            error:
              'Database error'
          });
      }
    }
  );

  return {
    ensureTable
  };
}

module.exports = {
  GAME_MAP,
  registerOptionsRoutes
};