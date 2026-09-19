'use strict';

const GAME_MAP = Object.freeze({
  freefire_normal: 'com.dts.freefireth',
  freefire_max: 'com.dts.freefiremax'
});

function normalizeText(value, maxLength) {
  return String(value || '')
    .trim()
    .slice(0, maxLength);
}

function normalizeId(value) {
  const id = Number(value);

  if (!Number.isSafeInteger(id) || id < 1) {
    return null;
  }

  return id;
}

function normalizeGame(value) {
  const game =
    normalizeText(value, 64)
      .toLowerCase();

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
  const value =
    normalizeText(route, 2048);

  if (!value) {
    return null;
  }

  if (
    value.includes('\\') ||
    value.includes('\0') ||
    value.startsWith('/') ||
    value.includes('..')
  ) {
    return null;
  }

  return value.replace(
    /^\/+|\/+$/g,
    ''
  );
}

function validateFileName(value) {
  const fileName =
    normalizeText(value, 255);

  if (!fileName) {
    return null;
  }

  if (
    fileName === '.' ||
    fileName === '..' ||
    fileName.includes('/') ||
    fileName.includes('\\') ||
    fileName.includes('\0')
  ) {
    return null;
  }

  return fileName;
}

function registerDeleteFileRoutes({
  app,
  pool,
  requireAdmin
}) {

  async function ensureTable() {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS app_delete_files (
        id BIGSERIAL PRIMARY KEY,

        option_id BIGINT NOT NULL
          REFERENCES app_options(id)
          ON DELETE CASCADE,

        route TEXT NOT NULL,

        file_name TEXT NOT NULL,

        created_at TIMESTAMPTZ NOT NULL,

        updated_at TIMESTAMPTZ NOT NULL,

        CONSTRAINT app_delete_files_unique_rule
          UNIQUE (
            option_id,
            route,
            file_name
          )
      );
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS
        idx_app_delete_files_option
      ON app_delete_files(
        option_id,
        id
      );
    `);

    console.log(
      'PostgreSQL delete-on-deactivate rules initialized.'
    );
  }


  /*
   * =========================================================
   * ADMIN - LIST
   * =========================================================
   */

  app.get(
    '/api/admin/delete-files',
    requireAdmin,
    async (req, res) => {
      try {
        const result =
          await pool.query(`
            SELECT
              d.id,
              d.option_id,
              d.route,
              d.file_name,
              d.created_at,
              d.updated_at,
              o.name AS option_name,
              o.game,
              o.category
            FROM app_delete_files d
            INNER JOIN app_options o
              ON o.id = d.option_id
            ORDER BY
              o.game ASC,
              o.sort_order ASC,
              d.id ASC
          `);

        res.json({
          ok: true,
          deleteFiles:
            result.rows.map(row => ({
              id:
                Number(row.id),

              optionId:
                Number(row.option_id),

              optionName:
                row.option_name,

              game:
                row.game,

              category:
                row.category ||
                'holograma',

              bundleId:
                GAME_MAP[row.game],

              route:
                row.route,

              fileName:
                row.file_name,

              createdAt:
                row.created_at,

              updatedAt:
                row.updated_at
            }))
        });

      } catch (error) {
        console.error(
          'List delete-on-deactivate files error:',
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
   * ADMIN - CREATE / UPSERT
   * =========================================================
   */

  app.post(
    '/api/admin/delete-files',
    requireAdmin,
    async (req, res) => {
      try {
        const optionId =
          normalizeId(
            req.body.optionId
          );

        const route =
          validateRoute(
            req.body.route
          );

        const fileName =
          validateFileName(
            req.body.fileName
          );

        if (!optionId) {
          return res
            .status(400)
            .json({
              ok: false,
              error:
                'Selecciona una opción válida'
            });
        }

        if (!route) {
          return res
            .status(400)
            .json({
              ok: false,
              error:
                'Ruta inválida'
            });
        }

        if (!fileName) {
          return res
            .status(400)
            .json({
              ok: false,
              error:
                'Nombre de archivo inválido'
            });
        }

        const optionResult =
          await pool.query(
            `
              SELECT
                id,
                name,
                game,
                category
              FROM app_options
              WHERE id = $1
              LIMIT 1
            `,
            [optionId]
          );

        if (
          optionResult.rows.length === 0
        ) {
          return res
            .status(404)
            .json({
              ok: false,
              error:
                'La opción no existe'
            });
        }

        const option =
          optionResult.rows[0];

        const now =
          new Date().toISOString();

        const result =
          await pool.query(
            `
              INSERT INTO app_delete_files (
                option_id,
                route,
                file_name,
                created_at,
                updated_at
              )
              VALUES (
                $1,
                $2,
                $3,
                $4,
                $4
              )
              ON CONFLICT (
                option_id,
                route,
                file_name
              )
              DO UPDATE SET
                updated_at =
                  EXCLUDED.updated_at
              RETURNING
                id,
                option_id,
                route,
                file_name,
                created_at,
                updated_at
            `,
            [
              optionId,
              route,
              fileName,
              now
            ]
          );

        const row =
          result.rows[0];

        res.status(201).json({
          ok: true,

          deleteFile: {
            id:
              Number(row.id),

            optionId:
              Number(row.option_id),

            optionName:
              option.name,

            game:
              option.game,

            category:
              option.category ||
              'holograma',

            bundleId:
              GAME_MAP[
                option.game
              ],

            route:
              row.route,

            fileName:
              row.file_name,

            createdAt:
              row.created_at,

            updatedAt:
              row.updated_at
          }
        });

      } catch (error) {
        console.error(
          'Create delete-on-deactivate file error:',
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
   * ADMIN - DELETE RULE
   * =========================================================
   */

  app.delete(
    '/api/admin/delete-files/:id',
    requireAdmin,
    async (req, res) => {
      try {
        const id =
          normalizeId(
            req.params.id
          );

        if (!id) {
          return res
            .status(400)
            .json({
              ok: false,
              error: 'ID inválido'
            });
        }

        const result =
          await pool.query(
            `
              DELETE FROM app_delete_files
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
                'Regla no encontrada'
            });
        }

        res.json({
          ok: true
        });

      } catch (error) {
        console.error(
          'Delete delete-on-deactivate rule error:',
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
   * PUBLIC - RULES FOR XITFORGE IPA
   * =========================================================
   */

  app.get(
    '/api/app/delete-files',
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
                d.id,
                d.option_id,
                d.route,
                d.file_name,
                d.updated_at,
                o.name AS option_name,
                o.category
              FROM app_delete_files d
              INNER JOIN app_options o
                ON o.id = d.option_id
              WHERE o.game = $1
              ORDER BY
                o.sort_order ASC,
                d.id ASC
            `,
            [game]
          );

        res.json({
          ok: true,
          game,
          bundleId:
            GAME_MAP[game],

          deleteFiles:
            result.rows.map(row => ({
              id:
                Number(row.id),

              optionId:
                Number(row.option_id),

              optionName:
                row.option_name,

              category:
                row.category ||
                'holograma',

              bundleId:
                GAME_MAP[game],

              route:
                row.route,

              fileName:
                row.file_name,

              updatedAt:
                row.updated_at
            }))
        });

      } catch (error) {
        console.error(
          'Public delete-on-deactivate files error:',
          error
        );

        res.status(500).json({
          ok: false,
          error: 'Database error'
        });
      }
    }
  );

  return {
    ensureTable
  };
}

module.exports = {
  registerDeleteFileRoutes
};
