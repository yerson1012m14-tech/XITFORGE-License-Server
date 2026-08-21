const express = require('express');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');

const app = express();

const PORT = Number(process.env.PORT || 3000);

const ADMIN_PASSWORD =
  process.env.ADMIN_PASSWORD || '';

const ADMIN_TOKEN_SECRET =
  process.env.ADMIN_TOKEN_SECRET || '';

const PUBLIC_BASE_URL =
  process.env.PUBLIC_BASE_URL ||
  `http://localhost:${PORT}`;

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

const dataDir =
  path.join(__dirname, 'data');

fs.mkdirSync(dataDir, {
  recursive: true
});

const db =
  new DatabaseSync(
    path.join(dataDir, 'licenses.db')
  );

db.exec(`
  PRAGMA journal_mode = WAL;

  CREATE TABLE IF NOT EXISTS licenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key_hash TEXT NOT NULL UNIQUE,
    key_prefix TEXT NOT NULL,
    key_last4 TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    expires_at TEXT NULL,
    device_limit INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  ) STRICT;

  CREATE TABLE IF NOT EXISTS activations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    license_id INTEGER NOT NULL,
    device_hash TEXT NOT NULL,
    activated_at TEXT NOT NULL,
    last_seen_at TEXT NOT NULL,
    UNIQUE(license_id, device_hash),
    FOREIGN KEY(license_id)
      REFERENCES licenses(id)
      ON DELETE CASCADE
  ) STRICT;

  CREATE INDEX IF NOT EXISTS idx_licenses_key_hash
    ON licenses(key_hash);

  CREATE INDEX IF NOT EXISTS idx_activations_license
    ON activations(license_id);
`);

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

function getLicenseByHash(
  keyHash
) {

  return db
    .prepare(`
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
      WHERE key_hash = ?
    `)
    .get(keyHash);
}

function isExpired(
  expiresAt
) {

  return Boolean(
    expiresAt &&
    Date.now() >=
      new Date(expiresAt).getTime()
  );
}

function getActivationCount(
  licenseId
) {

  const row =
    db
      .prepare(`
        SELECT COUNT(*) AS count
        FROM activations
        WHERE license_id = ?
      `)
      .get(licenseId);

  return Number(
    row?.count || 0
  );
}

/*
 * HEALTH
 */

app.get(
  '/api/health',
  (req, res) => {

    res.json({
      ok: true,
      service:
        'XITFORGE License API',
      time:
        nowIso()
    });
  }
);

/*
 * LICENSE VALIDATION
 *
 * deviceId is expected to be the
 * identifierForVendor generated by iOS.
 *
 * The raw identifier is NEVER stored.
 * Only SHA-256(deviceId) is stored.
 */

app.post(
  '/api/license/validate',
  rateLimit({
    windowMs: 60_000,
    max: 60
  }),
  (req, res) => {

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

    /*
     * Don't accept an empty or
     * obviously invalid device ID.
     */
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
      getLicenseByHash(
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

    /*
     * Hash the device identifier
     * before storing/looking it up.
     */
    const deviceHash =
      hashValue(deviceId);

    const existing =
      db
        .prepare(`
          SELECT
            id,
            activated_at,
            last_seen_at
          FROM activations
          WHERE license_id = ?
            AND device_hash = ?
        `)
        .get(
          license.id,
          deviceHash
        );

    /*
     * Device already associated
     * with this license.
     */
    if (existing) {

      db
        .prepare(`
          UPDATE activations
          SET last_seen_at = ?
          WHERE id = ?
        `)
        .run(
          nowIso(),
          existing.id
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
     * New device.
     */
    const activationCount =
      getActivationCount(
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

    db
      .prepare(`
        INSERT INTO activations
          (
            license_id,
            device_hash,
            activated_at,
            last_seen_at
          )
        VALUES (?, ?, ?, ?)
      `)
      .run(
        license.id,
        deviceHash,
        timestamp,
        timestamp
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
);

/*
 * ADMIN LOGIN
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
 * LIST LICENSES
 */

app.get(
  '/api/admin/licenses',
  requireAdmin,
  (req, res) => {

    const rows =
      db
        .prepare(`
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
              SELECT COUNT(*)
              FROM activations a
              WHERE a.license_id = l.id
            ) AS devices
          FROM licenses l
          ORDER BY l.id DESC
        `)
        .all();

    res.json({
      ok: true,
      licenses: rows
    });
  }
);

/*
 * CREATE LICENSE
 */

app.post(
  '/api/admin/licenses',
  requireAdmin,
  (req, res) => {

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

    db
      .prepare(`
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
          (?, ?, ?, 'active',
           ?, ?, ?, ?)
      `)
      .run(
        hashValue(normalized),
        normalized.slice(
          0,
          9
        ),
        normalized.slice(
          -4
        ),
        expiresAt,
        deviceLimit,
        timestamp,
        timestamp
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
          timestamp
      });
  }
);

/*
 * REVOKE
 */

app.post(
  '/api/admin/licenses/:id/revoke',
  requireAdmin,
  (req, res) => {

    const id =
      Number(
        req.params.id
      );

    const result =
      db
        .prepare(`
          UPDATE licenses
          SET
            status = 'revoked',
            updated_at = ?
          WHERE id = ?
        `)
        .run(
          nowIso(),
          id
        );

    if (
      Number(result.changes) !== 1
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
  }
);

/*
 * REACTIVATE
 */

app.post(
  '/api/admin/licenses/:id/reactivate',
  requireAdmin,
  (req, res) => {

    const id =
      Number(
        req.params.id
      );

    const row =
      db
        .prepare(`
          SELECT expires_at
          FROM licenses
          WHERE id = ?
        `)
        .get(id);

    if (!row) {

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
        row.expires_at
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

    const result =
      db
        .prepare(`
          UPDATE licenses
          SET
            status = 'active',
            updated_at = ?
          WHERE id = ?
        `)
        .run(
          nowIso(),
          id
        );

    if (
      Number(result.changes) !== 1
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
  }
);

/*
 * EXTEND
 */

app.post(
  '/api/admin/licenses/:id/extend',
  requireAdmin,
  (req, res) => {

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

    const row =
      db
        .prepare(`
          SELECT expires_at
          FROM licenses
          WHERE id = ?
        `)
        .get(id);

    if (!row) {

      return res
        .status(404)
        .json({
          ok: false,
          error:
            'License not found'
        });
    }

    const base =
      row.expires_at &&
      !isExpired(
        row.expires_at
      )
        ? new Date(
            row.expires_at
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

    db
      .prepare(`
        UPDATE licenses
        SET
          expires_at = ?,
          updated_at = ?
        WHERE id = ?
      `)
      .run(
        expiresAt,
        nowIso(),
        id
      );

    res.json({
      ok: true,
      expiresAt
    });
  }
);

/*
 * VIEW ACTIVATIONS
 */

app.get(
  '/api/admin/licenses/:id/activations',
  requireAdmin,
  (req, res) => {

    const id =
      Number(
        req.params.id
      );

    const rows =
      db
        .prepare(`
          SELECT
            activated_at,
            last_seen_at
          FROM activations
          WHERE license_id = ?
          ORDER BY last_seen_at DESC
        `)
        .all(id);

    res.json({
      ok: true,
      activations:
        rows
    });
  }
);

app.use(
  express.static(
    path.join(
      __dirname,
      'public'
    )
  )
);

app.listen(
  PORT,
  () => {
    console.log(
      `XITFORGE License Server running on ${PUBLIC_BASE_URL}`
    );
  }
);
