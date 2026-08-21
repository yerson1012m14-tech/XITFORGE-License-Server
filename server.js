const express = require('express');
const crypto = require('crypto');
const path = require('path');
const { Pool } = require('pg');
const { registerOptionsRoutes } = require('./options-routes');

const app = express();

const PORT = Number(process.env.PORT || 3000);

const ADMIN_PASSWORD =
  process.env.ADMIN_PASSWORD || '';

const ADMIN_TOKEN_SECRET =
  process.env.ADMIN_TOKEN_SECRET || '';

const PUBLIC_BASE_URL =
  process.env.PUBLIC_BASE_URL ||
  `http://localhost:${PORT}`;

const DATABASE_URL =
  process.env.DATABASE_URL || '';

if (!DATABASE_URL) {
  console.error('ERROR: DATABASE_URL is not configured.');
  process.exit(1);
}

if (
  !ADMIN_PASSWORD ||
  ADMIN_PASSWORD === 'change-this-password'
) {
  console.warn(
    'WARNING: Set a strong ADMIN_PASSWORD in the environment before public deployment.'
  );
}

if (
  !ADMIN_TOKEN_SECRET ||
  ADMIN_TOKEN_SECRET.length < 32
) {
  console.warn(
    'WARNING: Set ADMIN_TOKEN_SECRET to a random secret of at least 32 characters.'
  );
}

/*
 * ---------------------------------------------------------
 * POSTGRESQL
 * ---------------------------------------------------------
 */

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  },
  max: 5,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000
});

/*
 * ---------------------------------------------------------
 * DATABASE INITIALIZATION
 * ---------------------------------------------------------
 */

async function initializeDatabase() {

  const client = await pool.connect();

  try {

    /*
     * LICENCIAS
     */

    await client.query(`
      CREATE TABLE IF NOT EXISTS licenses (
        id BIGSERIAL PRIMARY KEY,
        key_hash TEXT NOT NULL UNIQUE,
        key_prefix TEXT NOT NULL,
        key_last4 TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        expires_at TIMESTAMPTZ NULL,
        device_limit INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMPTZ NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL
      );
    `);

    /*
     * ACTIVACIONES
     */

    await client.query(`
      CREATE TABLE IF NOT EXISTS activations (
        id BIGSERIAL PRIMARY KEY,
        license_id BIGINT NOT NULL
          REFERENCES licenses(id)
          ON DELETE CASCADE,
        device_hash TEXT NOT NULL,
        activated_at TIMESTAMPTZ NOT NULL,
        last_seen_at TIMESTAMPTZ NOT NULL,
        UNIQUE(license_id, device_hash)
      );
    `);

    /*
     * INDICES DE LICENCIAS
     */

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_licenses_key_hash
      ON licenses(key_hash);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_activations_license
      ON activations(license_id);
    `);

    console.log('PostgreSQL license database initialized.');

  } finally {

    client.release();
  }
}

/*
 * ---------------------------------------------------------
 * EXPRESS
 * ---------------------------------------------------------
 */

app.use(
  express.json({
    limit: '32kb'
  })
);

app.use(
  express.urlencoded({
    extended: false
  })
);

/*
 * ---------------------------------------------------------
 * HELPERS
 * ---------------------------------------------------------
 */

function nowIso() {
  return new Date().toISOString();
}

function normalizeKey(value) {

  return String(value || '')
    .trim()
    .toUpperCase();
}

function isValidKeyFormat(key) {

  return /^[A-Z0-9]{4}(?:-[A-Z0-9]{4}){3}$/
    .test(key);
}

function hashValue(value) {

  return crypto
    .createHash('sha256')
    .update(String(value), 'utf8')
    .digest('hex');
}

function generateKey() {

  const alphabet =
    'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

  const chunk = () => {

    let out = '';

    for (
      let i = 0;
      i < 4;
      i++
    ) {

      out += alphabet[
        crypto.randomInt(
          0,
          alphabet.length
        )
      ];
    }

    return out;
  };

  return [
    chunk(),
    chunk(),
    chunk(),
    chunk()
  ].join('-');
}

function isExpired(expiresAt) {

  return Boolean(
    expiresAt &&
    Date.now() >=
      new Date(expiresAt).getTime()
  );
}

/*
 * ---------------------------------------------------------
 * ADMIN TOKEN
 * ---------------------------------------------------------
 */

function signAdminToken(payload) {

  const body =
    Buffer
      .from(
        JSON.stringify(payload),
        'utf8'
      )
      .toString('base64url');

  const sig =
    crypto
      .createHmac(
        'sha256',
        ADMIN_TOKEN_SECRET
      )
      .update(body)
      .digest('base64url');

  return `${body}.${sig}`;
}

function verifyAdminToken(token) {

  if (
    !token ||
    !ADMIN_TOKEN_SECRET
  ) {
    return false;
  }

  const parts =
    String(token).split('.');

  if (parts.length !== 2) {
    return false;
  }

  const [
    body,
    sig
  ] = parts;

  const expected =
    crypto
      .createHmac(
        'sha256',
        ADMIN_TOKEN_SECRET
      )
      .update(body)
      .digest('base64url');

  if (
    sig.length !==
    expected.length
  ) {
    return false;
  }

  try {

    if (
      !crypto.timingSafeEqual(
        Buffer.from(sig),
        Buffer.from(expected)
      )
    ) {
      return false;
    }

  } catch {

    return false;
  }

  try {

    const payload =
      JSON.parse(
        Buffer
          .from(body, 'base64url')
          .toString('utf8')
      );

    if (
      payload.role !== 'admin'
    ) {
      return false;
    }

    if (
      typeof payload.exp !==
      'number'
    ) {
      return false;
    }

    if (
      Date.now() >
      payload.exp
    ) {
      return false;
    }

    return true;

  } catch {

    return false;
  }
}

function requireAdmin(
  req,
  res,
  next
) {

  const header =
    String(
      req.get('authorization') ||
      ''
    );

  const token =
    header.startsWith('Bearer ')
      ? header.slice(7)
      : '';

  if (!verifyAdminToken(token)) {

    return res
      .status(401)
      .json({
        ok: false,
        error: 'Unauthorized'
      });
  }

  next();
}

/*
 * ---------------------------------------------------------
 * RATE LIMIT
 * ---------------------------------------------------------
 */

const rateBuckets =
  new Map();

function rateLimit({
  windowMs,
  max
}) {

  return (
    req,
    res,
    next
  ) => {

    const ip =
      req.ip ||
      req.socket.remoteAddress ||
      'unknown';

    const routeKey =
      `${req.path}:${ip}`;

    const now =
      Date.now();

    const entry =
      rateBuckets.get(routeKey);

    if (
      !entry ||
      now - entry.startedAt >
        windowMs
    ) {

      rateBuckets.set(
        routeKey,
        {
          startedAt: now,
          count: 1
        }
      );

      return next();
    }

    entry.count += 1;

    if (
      entry.count > max
    ) {

      return res
        .status(429)
        .json({
          ok: false,
          error:
            'Too many requests. Try again later.'
        });
    }

    next();
  };
}

/*
 * ---------------------------------------------------------
 * LICENSE QUERIES
 * ---------------------------------------------------------
 */

async function getLicenseByHash(
  keyHash
) {

  const result =
    await pool.query(
      `
        SELECT
          id,
          key_prefix,
          key_last4,
          status,
          expires_at,
          device_limit,
          created_at,
          updated_at
        FROM licenses
        WHERE key_hash = $1
        LIMIT 1
      `,
      [keyHash]
    );

  return result.rows[0] || null;
}

async function getActivationCount(
  licenseId
) {

  const result =
    await pool.query(
      `
        SELECT COUNT(*)::int AS count
        FROM activations
        WHERE license_id = $1
      `,
      [licenseId]
    );

  return Number(
    result.rows[0]?.count || 0
  );
}

/*
 * ---------------------------------------------------------
 * HEALTH
 * ---------------------------------------------------------
 */

app.get(
  '/api/health',
  async (req, res) => {

    try {

      await pool.query('SELECT 1');

      res.json({
        ok: true,
        service:
          'XITFORGE License API',
        database:
          'postgresql',
        time:
          nowIso()
      });

    } catch (error) {

      console.error(
        'Health check failed:',
        error
      );

      res
        .status(503)
        .json({
          ok: false,
          error:
            'Database unavailable'
        });
    }
  }
);

/*
 * ---------------------------------------------------------
 * LICENSE VALIDATION
 *
 * deviceId = identifierForVendor
 *
 * Only SHA-256(deviceId) is stored.
 * ---------------------------------------------------------
 */

app.post(
  '/api/license/validate',
  rateLimit({
    windowMs: 60_000,
    max: 60
  }),
  async (req, res) => {

    try {

      const key =
        normalizeKey(
          req.body.key
        );

      const deviceId =
        String(
          req.body.deviceId ||
          ''
        ).trim();

      if (
        !isValidKeyFormat(key)
      ) {

        return res
          .status(400)
          .json({
            ok: false,
            valid: false,
            reason:
              'invalid_format'
          });
      }

      if (
        deviceId.length < 8 ||
        deviceId.length > 256
      ) {

        return res
          .status(400)
          .json({
            ok: false,
            valid: false,
            reason:
              'invalid_device'
          });
      }

      const license =
        await getLicenseByHash(
          hashValue(key)
        );

      if (!license) {

        return res.json({
          ok: true,
          valid: false,
          reason:
            'not_found'
        });
      }

      if (
        license.status !==
        'active'
      ) {

        return res.json({
          ok: true,
          valid: false,
          reason:
            'revoked'
        });
      }

      if (
        isExpired(
          license.expires_at
        )
      ) {

        return res.json({
          ok: true,
          valid: false,
          reason:
            'expired',
          expiresAt:
            license.expires_at
        });
      }

      const deviceHash =
        hashValue(deviceId);

      /*
       * Is this exact device already
       * linked to this license?
       */

      const existing =
        await pool.query(
          `
            SELECT
              id,
              activated_at,
              last_seen_at
            FROM activations
            WHERE license_id = $1
              AND device_hash = $2
            LIMIT 1
          `,
          [
            license.id,
            deviceHash
          ]
        );

      if (
        existing.rows.length > 0
      ) {

        await pool.query(
          `
            UPDATE activations
            SET last_seen_at = $1
            WHERE id = $2
          `,
          [
            nowIso(),
            existing.rows[0].id
          ]
        );

        return res.json({
          ok: true,
          valid: true,
          expiresAt:
            license.expires_at,
          keyPrefix:
            license.key_prefix
        });
      }

      /*
       * Is another device already
       * using this key?
       */

      const activationCount =
        await getActivationCount(
          license.id
        );

      if (
        activationCount >=
        license.device_limit
      ) {

        return res.json({
          ok: true,
          valid: false,
          reason:
            'device_limit'
        });
      }

      const timestamp =
        nowIso();

      await pool.query(
        `
          INSERT INTO activations
            (
              license_id,
              device_hash,
              activated_at,
              last_seen_at
            )
          VALUES
            ($1, $2, $3, $4)
        `,
        [
          license.id,
          deviceHash,
          timestamp,
          timestamp
        ]
      );

      return res.json({
        ok: true,
        valid: true,
        expiresAt:
          license.expires_at,
        keyPrefix:
          license.key_prefix
      });

    } catch (error) {

      console.error(
        'License validation error:',
        error
      );

      return res
        .status(500)
        .json({
          ok: false,
          valid: false,
          reason:
            'server_error'
        });
    }
  }
);

/*
 * ---------------------------------------------------------
 * ADMIN LOGIN
 * ---------------------------------------------------------
 */

app.post(
  '/api/admin/login',
  rateLimit({
    windowMs:
      10 * 60_000,
    max: 10
  }),
  (req, res) => {

    const password =
      String(
        req.body.password ||
        ''
      );

    const supplied =
      Buffer.from(
        password
      );

    const expected =
      Buffer.from(
        ADMIN_PASSWORD ||
        ''
      );

    const passwordMatches =
      supplied.length ===
        expected.length &&
      crypto.timingSafeEqual(
        supplied,
        expected
      );

    if (!passwordMatches) {

      return res
        .status(401)
        .json({
          ok: false,
          error:
            'Invalid password'
        });
    }

    const token =
      signAdminToken({
        role: 'admin',
        exp:
          Date.now() +
          8 * 60 * 60 * 1000
      });

    res.json({
      ok: true,
      token
    });
  }
);

/*
 * ---------------------------------------------------------
 * LIST LICENSES
 * ---------------------------------------------------------
 */

app.get(
  '/api/admin/licenses',
  requireAdmin,
  async (req, res) => {

    try {

      const result =
        await pool.query(
          `
            SELECT
              l.id,
              l.key_prefix,
              l.key_last4,
              l.status,
              l.expires_at,
              l.device_limit,
              l.created_at,
              l.updated_at,
              (
                SELECT COUNT(*)::int
                FROM activations a
                WHERE a.license_id = l.id
              ) AS devices
            FROM licenses l
            ORDER BY l.id DESC
          `
        );

      res.json({
        ok: true,
        licenses:
          result.rows
      });

    } catch (error) {

      console.error(
        'List licenses error:',
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
 * ---------------------------------------------------------
 * CREATE LICENSE
 * ---------------------------------------------------------
 */

app.post(
  '/api/admin/licenses',
  requireAdmin,
  async (req, res) => {

    try {

      const durationDays =
        Number(
          req.body.durationDays
        );

      const deviceLimit =
        Math.max(
          1,
          Math.min(
            100,
            Number(
              req.body.deviceLimit
            ) || 1
          )
        );

      const allowed = [
        0,
        1,
        7,
        30,
        365
      ];

      if (
        !allowed.includes(
          durationDays
        )
      ) {

        return res
          .status(400)
          .json({
            ok: false,
            error:
              'durationDays must be one of 0, 1, 7, 30, 365'
          });
      }

      const key =
        generateKey();

      const normalized =
        normalizeKey(key);

      const timestamp =
        nowIso();

      let expiresAt =
        null;

      if (
        durationDays > 0
      ) {

        expiresAt =
          new Date(
            Date.now() +
            durationDays *
              24 *
              60 *
              60 *
              1000
          ).toISOString();
      }

      const result =
        await pool.query(
          `
            INSERT INTO licenses
              (
                key_hash,
                key_prefix,
                key_last4,
                status,
                expires_at,
                device_limit,
                created_at,
                updated_at
              )
            VALUES
              (
                $1,
                $2,
                $3,
                'active',
                $4,
                $5,
                $6,
                $7
              )
            RETURNING id
          `,
          [
            hashValue(normalized),
            normalized.slice(0, 9),
            normalized.slice(-4),
            expiresAt,
            deviceLimit,
            timestamp,
            timestamp
          ]
        );

      res
        .status(201)
        .json({
          ok: true,
          key: normalized,
          status: 'active',
          expiresAt,
          deviceLimit,
          createdAt:
            timestamp,
          id:
            result.rows[0].id
        });

    } catch (error) {

      console.error(
        'Create license error:',
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
 * ---------------------------------------------------------
 * REVOKE
 * ---------------------------------------------------------
 */

app.post(
  '/api/admin/licenses/:id/revoke',
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
            UPDATE licenses
            SET
              status = 'revoked',
              updated_at = $1
            WHERE id = $2
          `,
          [
            nowIso(),
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
              'License not found'
          });
      }

      res.json({
        ok: true
      });

    } catch (error) {

      console.error(
        'Revoke license error:',
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
 * ---------------------------------------------------------
 * REACTIVATE
 * ---------------------------------------------------------
 */

app.post(
  '/api/admin/licenses/:id/reactivate',
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
            SELECT expires_at
            FROM licenses
            WHERE id = $1
            LIMIT 1
          `,
          [id]
        );

      if (
        result.rows.length === 0
      ) {

        return res
          .status(404)
          .json({
            ok: false,
            error:
              'License not found'
          });
      }

      if (
        isExpired(
          result.rows[0].expires_at
        )
      ) {

        return res
          .status(400)
          .json({
            ok: false,
            error:
              'Cannot reactivate an expired license without extending it'
          });
      }

      await pool.query(
        `
          UPDATE licenses
          SET
            status = 'active',
            updated_at = $1
          WHERE id = $2
        `,
        [
          nowIso(),
          id
        ]
      );

      res.json({
        ok: true
      });

    } catch (error) {

      console.error(
        'Reactivate license error:',
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
 * ---------------------------------------------------------
 * EXTEND
 * ---------------------------------------------------------
 */

app.post(
  '/api/admin/licenses/:id/extend',
  requireAdmin,
  async (req, res) => {

    try {

      const id =
        Number(
          req.params.id
        );

      const days =
        Number(
          req.body.days
        );

      if (
        !Number.isInteger(days) ||
        days < 1 ||
        days > 3650
      ) {

        return res
          .status(400)
          .json({
            ok: false,
            error:
              'days must be an integer between 1 and 3650'
          });
      }

      const result =
        await pool.query(
          `
            SELECT expires_at
            FROM licenses
            WHERE id = $1
            LIMIT 1
          `,
          [id]
        );

      if (
        result.rows.length === 0
      ) {

        return res
          .status(404)
          .json({
            ok: false,
            error:
              'License not found'
          });
      }

      const currentExpiration =
        result.rows[0].expires_at;

      const base =
        currentExpiration &&
        !isExpired(
          currentExpiration
        )
          ? new Date(
              currentExpiration
            ).getTime()
          : Date.now();

      const expiresAt =
        new Date(
          base +
          days *
            24 *
            60 *
            60 *
            1000
        ).toISOString();

      await pool.query(
        `
          UPDATE licenses
          SET
            expires_at = $1,
            updated_at = $2
          WHERE id = $3
        `,
        [
          expiresAt,
          nowIso(),
          id
        ]
      );

      res.json({
        ok: true,
        expiresAt
      });

    } catch (error) {

      console.error(
        'Extend license error:',
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
 * ---------------------------------------------------------
 * VIEW ACTIVATIONS
 * ---------------------------------------------------------
 */

app.get(
  '/api/admin/licenses/:id/activations',
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
            SELECT
              activated_at,
              last_seen_at
            FROM activations
            WHERE license_id = $1
            ORDER BY last_seen_at DESC
          `,
          [id]
        );

      res.json({
        ok: true,
        activations:
          result.rows
      });

    } catch (error) {

      console.error(
        'View activations error:',
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
 * ---------------------------------------------------------
 * DYNAMIC APP OPTIONS
 * ---------------------------------------------------------
 *
 * Esto conecta tu panel con options-routes.js.
 *
 * El módulo crea:
 *
 *   app_options
 *
 * y las rutas:
 *
 *   /api/admin/options
 *   /api/admin/options/:id
 *   /api/admin/options/:id/status
 *   /api/admin/options/:id/file
 *
 *   /api/app/options
 *   /api/app/options/:id/file
 *
 * Las rutas administrativas requieren el mismo
 * Bearer token del panel de licencias.
 * ---------------------------------------------------------
 */

let optionsDatabaseReady = null;

try {

  const optionsModule =
    registerOptionsRoutes({
      app,
      pool,
      requireAdmin
    });

  optionsDatabaseReady =
    optionsModule.ensureTable();

} catch (error) {

  console.error(
    'Failed to register app options routes:',
    error
  );

  process.exit(1);
}

/*
 * ---------------------------------------------------------
 * STATIC PANEL
 * ---------------------------------------------------------
 */

app.use(
  express.static(
    path.join(
      __dirname,
      'public'
    )
  )
);

/*
 * ---------------------------------------------------------
 * START SERVER
 * ---------------------------------------------------------
 */

async function startServer() {

  try {

    await initializeDatabase();

    /*
     * Esperar también a que la tabla
     * de opciones esté creada.
     */

    await optionsDatabaseReady;

    app.listen(
      PORT,
      () => {

        console.log(
          `XITFORGE License Server running on ${PUBLIC_BASE_URL}`
        );

        console.log(
          'XITFORGE App Options API ready.'
        );

      }
    );

  } catch (error) {

    console.error(
      'Failed to initialize server:',
      error
    );

    process.exit(1);
  }
}

startServer();