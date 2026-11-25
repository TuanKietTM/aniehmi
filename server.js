/**
 * ANIE-HMI Server – Backend API for CMS data synchronization
 * 
 * All CMS data is stored in SQLite (anie_cms.db) so that:
 * - Admin changes on CMS are persisted on the server
 * - All client Showcase instances fetch the same data
 * - Any browser/machine sees the latest data
 */

const express = require('express');
const { createClient } = require('@libsql/client');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const { promisify } = require('util');
const scrypt = promisify(crypto.scrypt);

const app = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ─────────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: '10mb' })); // large for base64 images

// Behind Render's proxy: needed for correct client IPs (rate limiting)
app.set('trust proxy', 1);

// Serve ONLY the front-end files (never the whole project folder: it holds server.js, the SQLite DB, ...)
const PAGE_FILES = { '/': 'index.html', '/index.html': 'index.html', '/cms': 'cms.html', '/cms.html': 'cms.html' };
const ASSET_FILES = ['app.js', 'style.css'];
for (const [route, file] of Object.entries(PAGE_FILES)) {
  app.get(route, (req, res) => {
    if (file === 'cms.html') res.set('X-Robots-Tag', 'noindex, nofollow');
    res.sendFile(path.join(__dirname, file));
  });
}
for (const file of ASSET_FILES) {
  app.get('/' + file, (req, res) => res.sendFile(path.join(__dirname, file)));
}

// Create uploads directory if not exists
const UPLOADS_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Serve uploaded files statically
app.use('/uploads', express.static(UPLOADS_DIR));

// ── Multer configuration for file uploads ──────────────────
// Logos are kept in memory (5MB cap) and persisted in the database (see cms_files)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept only image files
    const allowedTypes = /jpeg|jpg|png|gif|webp|svg/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (extname && mimetype) {
      return cb(null, true);
    } else {
      cb(new Error('Chỉ chấp nhận file ảnh (jpeg, jpg, png, gif, webp, svg)'));
    }
  }
});

// ── Video upload + FFmpeg → HLS (.m3u8) ────────────────────
const { spawn } = require('child_process');
const os = require('os');
// ffmpeg-static ships a binary (Render has no system ffmpeg); FFMPEG_PATH overrides
let FFMPEG_BIN = process.env.FFMPEG_PATH;
if (!FFMPEG_BIN) {
  try { FFMPEG_BIN = require('ffmpeg-static'); } catch (e) { /* fall back to PATH */ }
}
FFMPEG_BIN = FFMPEG_BIN || 'ffmpeg';
// Disk is ephemeral on Render: only used as scratch space, HLS output is stored in the DB
const VIDEO_TMP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'anie-video-'));
const VIDEO_MIME = { '.m3u8': 'application/vnd.apple.mpegurl', '.ts': 'video/mp2t' };

let ffmpegAvailable = false;
spawn(FFMPEG_BIN, ['-version'])
  .on('error', () => console.warn('[WARN] FFmpeg not found – /api/upload-video disabled (set FFMPEG_PATH or install ffmpeg)'))
  .on('close', (code) => { ffmpegAvailable = code === 0; });

const videoUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, VIDEO_TMP_DIR),
    filename: (req, file, cb) => cb(null, `${uuidv4()}${path.extname(file.originalname).toLowerCase()}`)
  }),
  limits: { fileSize: 300 * 1024 * 1024 }, // 300MB
  fileFilter: (req, file, cb) => {
    const okExt = /\.(mp4|webm|ogg|ogv|mov|m4v|mkv|avi)$/i.test(file.originalname);
    if (okExt && /^video\//.test(file.mimetype)) return cb(null, true);
    cb(new Error('Chỉ chấp nhận file video (mp4, webm, ogg, mov, m4v, mkv, avi)'));
  }
});

function convertToHLS(inputPath, outDir) {
  return new Promise((resolve, reject) => {
    fs.mkdirSync(outDir, { recursive: true });
    const args = [
      '-y', '-i', inputPath,
      '-map', '0:v:0', '-map', '0:a:0?',
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23',
      '-vf', "scale='min(1280,iw)':-2", '-pix_fmt', 'yuv420p',
      '-c:a', 'aac', '-b:a', '128k', '-ac', '2',
      '-f', 'hls', '-hls_time', '6', '-hls_playlist_type', 'vod',
      '-hls_segment_filename', path.join(outDir, 'seg_%04d.ts'),
      path.join(outDir, 'index.m3u8')
    ];
    const ff = spawn(FFMPEG_BIN, args);
    let stderr = '';
    ff.stderr.on('data', (d) => { stderr = (stderr + d).slice(-2000); });
    ff.on('error', reject);
    ff.on('close', (code) => code === 0 ? resolve() : reject(new Error(`FFmpeg exit ${code}: ${stderr.slice(-400)}`)));
  });
}

// ── Turso / LibSQL Setup ──────────────────────────────────
let db;
const TURSO_DATABASE_URL = process.env.TURSO_DATABASE_URL;
const TURSO_AUTH_TOKEN = process.env.TURSO_AUTH_TOKEN;
let DB_PATH = '';

if (TURSO_DATABASE_URL && TURSO_AUTH_TOKEN) {
  console.log('[INFO] Connecting to Turso cloud database...');
  db = createClient({
    url: TURSO_DATABASE_URL,
    authToken: TURSO_AUTH_TOKEN
  });
  DB_PATH = 'Turso Cloud Database';
} else {
  console.log('[INFO] Using local SQLite database for development...');
  const DATA_DIR = path.join(__dirname, 'data');
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  DB_PATH = path.join(DATA_DIR, 'anie_cms.db');
  db = createClient({ url: `file:${DB_PATH}` });
  db.execute('PRAGMA journal_mode = WAL');
  db.execute('PRAGMA foreign_keys = ON');
}

// Create the tables that store CMS data as JSON blobs
// Each "table" in the CMS maps to a row here: table_name → json data
db.execute(`
  CREATE TABLE IF NOT EXISTS cms_data (
    table_name TEXT PRIMARY KEY,
    data       TEXT NOT NULL DEFAULT '[]'
  );
`);
db.execute(`
  CREATE TABLE IF NOT EXISTS cms_schemas (
    table_name TEXT PRIMARY KEY,
    schema     TEXT NOT NULL DEFAULT '[]'
  );
`);
// Small uploaded files (logos) as BLOB so they survive Render's ephemeral disk
db.execute(`
  CREATE TABLE IF NOT EXISTS cms_files (
    file_name    TEXT PRIMARY KEY,
    content_type TEXT NOT NULL,
    data         BLOB NOT NULL
  );
`);
// HLS playlists + segments (BLOB) so videos survive Render's ephemeral disk
db.execute(`
  CREATE TABLE IF NOT EXISTS cms_videos (
    video_id     TEXT NOT NULL,
    file_name    TEXT NOT NULL,
    content_type TEXT NOT NULL,
    data         BLOB NOT NULL,
    PRIMARY KEY (video_id, file_name)
  );
`);
db.execute(`
  CREATE TABLE IF NOT EXISTS cms_settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL DEFAULT ''
  );
`);

// ── Member accounts (register → admin approval → login) ───
// Roles: admin | member.  Status: pending | approved | rejected.
// The first admin comes from CMS_ADMIN_EMAIL + CMS_ADMIN_PASSWORD (set them on Render).
const TOKEN_TTL_MS = 12 * 60 * 60 * 1000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const authReady = (async () => {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS cms_users (
      id            TEXT PRIMARY KEY,
      email         TEXT NOT NULL UNIQUE,
      name          TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role          TEXT NOT NULL DEFAULT 'member',
      status        TEXT NOT NULL DEFAULT 'pending',
      created_at    TEXT NOT NULL
    );
  `);
  // Kept out of cms_settings because GET /api/data returns every setting publicly
  await db.execute(`
    CREATE TABLE IF NOT EXISTS cms_secrets (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  const adminEmail = (process.env.CMS_ADMIN_EMAIL || '').trim().toLowerCase();
  const adminPassword = process.env.CMS_ADMIN_PASSWORD || '';
  if (adminEmail && adminPassword.length >= 8) {
    const hash = await hashPassword(adminPassword);
    const existing = await db.execute({ sql: 'SELECT id FROM cms_users WHERE email = ?', args: [adminEmail] });
    if (existing.rows.length) {
      await db.execute({
        sql: "UPDATE cms_users SET password_hash = ?, role = 'admin', status = 'approved' WHERE email = ?",
        args: [hash, adminEmail]
      });
    } else {
      await db.execute({
        sql: "INSERT INTO cms_users (id, email, name, password_hash, role, status, created_at) VALUES (?, ?, 'Quản trị viên', ?, 'admin', 'approved', ?)",
        args: [uuidv4(), adminEmail, hash, new Date().toISOString()]
      });
    }
    console.log(`[INFO] CMS admin account ready: ${adminEmail}`);
  } else {
    const admins = await db.execute("SELECT COUNT(*) AS cnt FROM cms_users WHERE role = 'admin' AND status = 'approved'");
    if (admins.rows[0].cnt === 0) {
      console.warn('[WARN] No CMS admin exists. Set CMS_ADMIN_EMAIL and CMS_ADMIN_PASSWORD (min 8 chars) to create one.');
    }
  }
})().catch((err) => console.error('[ERROR] auth setup failed:', err));

async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(password, salt, 64);
  return `${salt.toString('hex')}:${key.toString('hex')}`;
}

async function verifyPassword(password, stored) {
  const [saltHex, keyHex] = String(stored || '').split(':');
  if (!saltHex || !keyHex) return false;
  const expected = Buffer.from(keyHex, 'hex');
  const actual = await scrypt(password, Buffer.from(saltHex, 'hex'), expected.length);
  return crypto.timingSafeEqual(actual, expected);
}

let secretPromise;
function getAuthSecret() {
  if (process.env.CMS_SECRET) return Promise.resolve(process.env.CMS_SECRET);
  if (!secretPromise) {
    secretPromise = (async () => {
      await authReady;
      const r = await db.execute("SELECT value FROM cms_secrets WHERE key = 'token_secret'");
      if (r.rows.length) return r.rows[0].value;
      const secret = crypto.randomBytes(32).toString('hex');
      await db.execute({ sql: "INSERT OR IGNORE INTO cms_secrets (key, value) VALUES ('token_secret', ?)", args: [secret] });
      const again = await db.execute("SELECT value FROM cms_secrets WHERE key = 'token_secret'");
      return again.rows[0].value;
    })();
  }
  return secretPromise;
}

const b64url = (buf) => Buffer.from(buf).toString('base64url');

async function signToken(userId) {
  const payload = b64url(JSON.stringify({ u: userId, e: Date.now() + TOKEN_TTL_MS }));
  const sig = crypto.createHmac('sha256', await getAuthSecret()).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

/** Returns the approved user behind the Bearer token, or null. Re-checks the DB so revocation is immediate. */
async function authenticate(req) {
  const m = (req.headers.authorization || '').match(/^Bearer ([\w-]+\.[\w-]+)$/);
  if (!m) return null;
  const [payload, sig] = m[1].split('.');
  const expected = crypto.createHmac('sha256', await getAuthSecret()).update(payload).digest();
  const given = Buffer.from(sig, 'base64url');
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return null;
  let data;
  try { data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')); } catch (e) { return null; }
  if (!data || typeof data.u !== 'string' || !(data.e > Date.now())) return null;
  await authReady;
  const r = await db.execute({ sql: 'SELECT id, email, name, role, status FROM cms_users WHERE id = ?', args: [data.u] });
  const user = r.rows[0];
  return user && user.status === 'approved' ? { id: user.id, email: user.email, name: user.name, role: user.role } : null;
}

function requireMember(req, res, next) {
  authenticate(req).then((user) => {
    if (!user) return res.status(401).json({ success: false, error: 'Cần đăng nhập bằng tài khoản đã được duyệt' });
    req.user = user;
    next();
  }).catch((err) => { console.error('[ERROR] auth:', err.message); res.status(500).json({ success: false, error: 'Lỗi xác thực' }); });
}

function requireAdmin(req, res, next) {
  requireMember(req, res, () => {
    if (req.user.role !== 'admin') return res.status(403).json({ success: false, error: 'Chỉ quản trị viên được phép' });
    next();
  });
}

/** Tiny in-memory per-IP limiter for the public endpoints. */
function rateLimit(name, max, windowMs) {
  const hits = new Map();
  return (req, res, next) => {
    const now = Date.now();
    const key = `${name}:${req.ip}`;
    const entry = hits.get(key);
    if (!entry || entry.reset < now) hits.set(key, { count: 1, reset: now + windowMs });
    else if (++entry.count > max) return res.status(429).json({ success: false, error: 'Quá nhiều yêu cầu, vui lòng thử lại sau' });
    if (hits.size > 5000) for (const [k, v] of hits) if (v.reset < now) hits.delete(k);
    next();
  };
}

app.post('/api/auth/register', rateLimit('register', 5, 60 * 60 * 1000), async (req, res) => {
  try {
    await authReady;
    const name = String(req.body.name || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    if (name.length < 2 || name.length > 80) return res.status(400).json({ success: false, error: 'Họ tên phải từ 2 đến 80 ký tự' });
    if (!EMAIL_RE.test(email) || email.length > 120) return res.status(400).json({ success: false, error: 'Email không hợp lệ' });
    if (password.length < 8 || password.length > 100) return res.status(400).json({ success: false, error: 'Mật khẩu phải từ 8 đến 100 ký tự' });
    const exists = await db.execute({ sql: 'SELECT id FROM cms_users WHERE email = ?', args: [email] });
    if (exists.rows.length) return res.status(409).json({ success: false, error: 'Email này đã được đăng ký' });
    await db.execute({
      sql: "INSERT INTO cms_users (id, email, name, password_hash, role, status, created_at) VALUES (?, ?, ?, ?, 'member', 'pending', ?)",
      args: [uuidv4(), email, name, await hashPassword(password), new Date().toISOString()]
    });
    res.json({ success: true, message: 'Đã gửi đăng ký. Tài khoản cần được quản trị viên duyệt trước khi đăng nhập.' });
  } catch (err) {
    console.error('[ERROR] POST /api/auth/register:', err.message);
    res.status(500).json({ success: false, error: 'Không đăng ký được' });
  }
});

const DUMMY_HASH = `${'0'.repeat(32)}:${'0'.repeat(128)}`;
app.post('/api/auth/login', rateLimit('login', 20, 15 * 60 * 1000), async (req, res) => {
  try {
    await authReady;
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    const r = await db.execute({ sql: 'SELECT * FROM cms_users WHERE email = ?', args: [email] });
    const user = r.rows[0];
    const ok = await verifyPassword(password, user ? user.password_hash : DUMMY_HASH);
    if (!user || !ok) return res.status(401).json({ success: false, error: 'Email hoặc mật khẩu không đúng' });
    if (user.status === 'pending') {
      return res.status(403).json({ success: false, status: 'pending', error: 'Tài khoản đang chờ quản trị viên duyệt.' });
    }
    if (user.status !== 'approved') {
      return res.status(403).json({ success: false, status: user.status, error: 'Tài khoản không được phép truy cập. Vui lòng liên hệ quản trị viên.' });
    }
    res.json({
      success: true,
      token: await signToken(user.id),
      user: { id: user.id, email: user.email, name: user.name, role: user.role }
    });
  } catch (err) {
    console.error('[ERROR] POST /api/auth/login:', err.message);
    res.status(500).json({ success: false, error: 'Không đăng nhập được' });
  }
});

app.get('/api/auth/me', requireMember, (req, res) => res.json({ success: true, user: req.user }));

app.get('/api/admin/users', requireAdmin, async (req, res) => {
  try {
    const r = await db.execute('SELECT id, email, name, role, status, created_at FROM cms_users ORDER BY created_at DESC');
    res.json({ success: true, users: r.rows.map((u) => ({ ...u })) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.put('/api/admin/users/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    if (id === req.user.id) return res.status(400).json({ success: false, error: 'Không thể tự thay đổi tài khoản của mình' });
    const { status, role } = req.body || {};
    if (status !== undefined && !['pending', 'approved', 'rejected'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Trạng thái không hợp lệ' });
    }
    if (role !== undefined && !['admin', 'member'].includes(role)) {
      return res.status(400).json({ success: false, error: 'Vai trò không hợp lệ' });
    }
    if (status === undefined && role === undefined) return res.status(400).json({ success: false, error: 'Không có thay đổi' });
    const target = await db.execute({ sql: 'SELECT status FROM cms_users WHERE id = ?', args: [id] });
    if (!target.rows.length) return res.status(404).json({ success: false, error: 'Không tìm thấy tài khoản' });
    if (role === 'admin' && (status ?? target.rows[0].status) !== 'approved') {
      return res.status(400).json({ success: false, error: 'Chỉ có thể đặt quyền quản trị cho tài khoản đã duyệt' });
    }
    if (status !== undefined) await db.execute({ sql: 'UPDATE cms_users SET status = ? WHERE id = ?', args: [status, id] });
    if (role !== undefined) await db.execute({ sql: 'UPDATE cms_users SET role = ? WHERE id = ?', args: [role, id] });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete('/api/admin/users/:id', requireAdmin, async (req, res) => {
  try {
    if (req.params.id === req.user.id) return res.status(400).json({ success: false, error: 'Không thể xóa chính mình' });
    await db.execute({ sql: 'DELETE FROM cms_users WHERE id = ?', args: [req.params.id] });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/** Public contact/partnership form: appends one entry server-side, so guests never need write access. */
app.post('/api/partner-request', rateLimit('partner', 5, 60 * 60 * 1000), async (req, res) => {
  try {
    const clip = (v, n) => String(v || '').trim().slice(0, n);
    const name = clip(req.body.name, 150);
    const contact = clip(req.body.contact, 200);
    if (!name || !contact) return res.status(400).json({ success: false, error: 'Vui lòng nhập tên đơn vị và thông tin liên hệ' });
    const entry = {
      cover_url: '', title: name, entry_type: 'Partner Institution',
      date_or_spec: clip(req.body.spec, 150), summary: contact, content: clip(req.body.notes, 2000)
    };
    const r = await db.execute({ sql: "SELECT data FROM cms_data WHERE table_name = 'news_collaboration'", args: [] });
    const rows = r.rows.length ? JSON.parse(r.rows[0].data) : [];
    rows.push(entry);
    await db.execute({
      sql: "INSERT OR REPLACE INTO cms_data (table_name, data) VALUES ('news_collaboration', ?)",
      args: [JSON.stringify(rows)]
    });
    res.json({ success: true });
  } catch (err) {
    console.error('[ERROR] POST /api/partner-request:', err.message);
    res.status(500).json({ success: false, error: 'Không gửi được yêu cầu' });
  }
});

// ── Seed Data ─────────────────────────────────────────────
// The initial seed data (same as INITIAL_SEED_DB from the HTML).
// We only seed if the database is empty.
const TABLES = [
  'people',
  'research_domains',
  'projects_tasks',
  'products',
  'publications',
  'resources_networking'
];

async function isFreshDatabase() {
  const result = await db.execute('SELECT COUNT(*) as cnt FROM cms_data');
  return result.rows[0].cnt === 0;
}

async function seedDatabase() {
  const seedPath = path.join(__dirname, 'seed-data.json');
  if (!fs.existsSync(seedPath)) {
    console.warn('[WARN] seed-data.json not found – skipping seed');
    return;
  }
  const seed = JSON.parse(fs.readFileSync(seedPath, 'utf-8'));

  for (const tbl of TABLES) {
    if (seed.data && seed.data[tbl]) {
      await db.execute(
        'INSERT OR REPLACE INTO cms_data (table_name, data) VALUES (?, ?)',
        [tbl, JSON.stringify(seed.data[tbl])]
      );
    }
    if (seed.schemas && seed.schemas[tbl]) {
      await db.execute(
        'INSERT OR REPLACE INTO cms_schemas (table_name, schema) VALUES (?, ?)',
        [tbl, JSON.stringify(seed.schemas[tbl])]
      );
    }
  }
  console.log('[INFO] Database seeded with initial data');
}

(async () => {
  if (await isFreshDatabase()) {
    await seedDatabase();
  }
})();

// ── API Routes ────────────────────────────────────────────

/**
 * GET /api/data
 * Returns ALL tables' data + schemas + settings in one request.
 * This is what the Showcase client calls on load.
 */
app.get('/api/data', async (req, res) => {
  try {
    const dataResult = await db.execute('SELECT table_name, data FROM cms_data');
    const schemaResult = await db.execute('SELECT table_name, schema FROM cms_schemas');
    const settingsResult = await db.execute('SELECT key, value FROM cms_settings');

    const data = {};
    for (const row of dataResult.rows) {
      data[row.table_name] = JSON.parse(row.data);
    }

    const schemas = {};
    for (const row of schemaResult.rows) {
      schemas[row.table_name] = JSON.parse(row.schema);
    }
    
    const settings = {};
    for (const row of settingsResult.rows) {
      settings[row.key] = row.value;
    }

    res.json({ success: true, data, schemas, settings });
  } catch (err) {
    console.error('[ERROR] GET /api/data:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/data/:tableName
 * Returns data for a single table.
 */
app.get('/api/data/:tableName', async (req, res) => {
  try {
    const { tableName } = req.params;
    const result = await db.execute('SELECT data FROM cms_data WHERE table_name = ?', [tableName]);
    if (result.rows.length === 0) {
      return res.json({ success: true, data: [] });
    }
    res.json({ success: true, data: JSON.parse(result.rows[0].data) });
  } catch (err) {
    console.error(`[ERROR] GET /api/data/${req.params.tableName}:`, err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * PUT /api/data/:tableName
 * Replaces the entire data array for a table.
 * Called by CMS after any CRUD operation.
 */
app.put('/api/data/:tableName', requireMember, async (req, res) => {
  try {
    const { tableName } = req.params;
    const { data } = req.body;
    if (!Array.isArray(data)) {
      return res.status(400).json({ success: false, error: 'data must be an array' });
    }
    await db.execute(
      'INSERT OR REPLACE INTO cms_data (table_name, data) VALUES (?, ?)',
      [tableName, JSON.stringify(data)]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(`[ERROR] PUT /api/data/${req.params.tableName}:`, err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * PUT /api/data  (bulk)
 * Replaces ALL tables at once. Used by "commitDatabase" on client.
 */
app.put('/api/data', requireMember, async (req, res) => {
  try {
    const { data } = req.body;
    if (!data || typeof data !== 'object') {
      return res.status(400).json({ success: false, error: 'data must be an object of arrays' });
    }
    for (const [tbl, rows] of Object.entries(data)) {
      await db.execute(
        'INSERT OR REPLACE INTO cms_data (table_name, data) VALUES (?, ?)',
        [tbl, JSON.stringify(rows)]
      );
    }
    res.json({ success: true });
  } catch (err) {
    console.error('[ERROR] PUT /api/data (bulk):', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/schemas
 * Returns all table schemas.
 */
app.get('/api/schemas', async (req, res) => {
  try {
    const result = await db.execute('SELECT table_name, schema FROM cms_schemas');
    const schemas = {};
    for (const row of result.rows) {
      schemas[row.table_name] = JSON.parse(row.schema);
    }
    res.json({ success: true, schemas });
  } catch (err) {
    console.error('[ERROR] GET /api/schemas:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * PUT /api/schemas
 * Replaces all schemas. Called by CMS after schema changes.
 */
app.put('/api/schemas', requireMember, async (req, res) => {
  try {
    const { schemas } = req.body;
    if (!schemas || typeof schemas !== 'object') {
      return res.status(400).json({ success: false, error: 'schemas must be an object' });
    }
    for (const [tbl, cols] of Object.entries(schemas)) {
      await db.execute(
        'INSERT OR REPLACE INTO cms_schemas (table_name, schema) VALUES (?, ?)',
        [tbl, JSON.stringify(cols)]
      );
    }
    res.json({ success: true });
  } catch (err) {
    console.error('[ERROR] PUT /api/schemas:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/reset
 * Resets the database to initial seed data.
 */
app.post('/api/reset', requireAdmin, async (req, res) => {
  try {
    await db.execute('DELETE FROM cms_data');
    await db.execute('DELETE FROM cms_schemas');
    await seedDatabase();
    res.json({ success: true, message: 'Database reset to seed data' });
  } catch (err) {
    console.error('[ERROR] POST /api/reset:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/settings/:key
 */
app.get('/api/settings/:key', async (req, res) => {
  try {
    const result = await db.execute('SELECT value FROM cms_settings WHERE key = ?', [req.params.key]);
    res.json({ success: true, value: result.rows.length > 0 ? result.rows[0].value : null });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * PUT /api/settings/:key
 */
app.put('/api/settings/:key', requireMember, async (req, res) => {
  try {
    const { value } = req.body;
    await db.execute(
      'INSERT OR REPLACE INTO cms_settings (key, value) VALUES (?, ?)',
      [req.params.key, value || '']
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/** Deletes the file behind a logo setting (DB row, or legacy file on disk). */
async function removeStoredLogo(settingKey) {
  const result = await db.execute({ sql: 'SELECT value FROM cms_settings WHERE key = ?', args: [settingKey] });
  const currentUrl = result.rows.length > 0 ? String(result.rows[0].value || '') : '';
  const filename = path.basename(currentUrl);
  if (currentUrl.startsWith('/uploads/logos/')) {
    await db.execute({ sql: 'DELETE FROM cms_files WHERE file_name = ?', args: [filename] });
  } else if (currentUrl.startsWith('/uploads/logo-')) { // legacy: stored on disk
    fs.rm(path.join(UPLOADS_DIR, filename), { force: true }, () => {});
  }
}

/**
 * GET /uploads/logos/:file – serves logo images from the database
 */
app.get('/uploads/logos/:file', async (req, res) => {
  try {
    const { file } = req.params;
    if (!/^[\w-]+\.\w+$/.test(file)) return res.sendStatus(404);
    const r = await db.execute({ sql: 'SELECT content_type, data FROM cms_files WHERE file_name = ?', args: [file] });
    if (r.rows.length === 0) return res.sendStatus(404);
    res.set({ 'Content-Type': r.rows[0].content_type, 'Cache-Control': 'public, max-age=31536000, immutable' });
    res.send(Buffer.from(r.rows[0].data));
  } catch (err) {
    console.error('[ERROR] GET /uploads/logos:', err.message);
    res.sendStatus(500);
  }
});

/**
 * POST /api/upload-logo
 * Uploads a logo file to the server and returns its URL
 */
app.post('/api/upload-logo', requireMember, upload.single('logo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'Không có file ảnh được tải lên' });
    }
    
    // Get slot from request body (1 or 2)
    const slot = req.body.slot || '1';
    
    // Persist the image in the database and build its public URL
    const ext = path.extname(req.file.originalname).toLowerCase();
    const filename = `logo-${uuidv4()}${ext}`;
    await db.execute({
      sql: 'INSERT OR REPLACE INTO cms_files (file_name, content_type, data) VALUES (?, ?, ?)',
      args: [filename, req.file.mimetype, req.file.buffer]
    });
    req.file.filename = filename;
    const logoUrl = `/uploads/logos/${filename}`;

    // Save the logo URL to settings based on slot (and drop the slot's previous logo file)
    const settingKey = slot === '1' ? 'logo1_url' : 'logo2_url';
    await removeStoredLogo(settingKey);
    await db.execute(
      'INSERT OR REPLACE INTO cms_settings (key, value) VALUES (?, ?)',
      [settingKey, logoUrl]
    );
    
    // Return success response with the logo URL
    res.json({ 
      success: true, 
      url: logoUrl,
      filename: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size,
      slot: slot
    });
  } catch (err) {
    console.error('[ERROR] POST /api/upload-logo:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/upload-video
 * Receives a video file, transcodes it with FFmpeg into HLS and returns the .m3u8 URL.
 */
app.post('/api/upload-video', requireMember, (req, res) => {
  videoUpload.single('video')(req, res, async (uploadErr) => {
    if (uploadErr) {
      return res.status(400).json({ success: false, error: uploadErr.message });
    }
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'Không có file video được tải lên' });
    }
    const tmpPath = req.file.path;
    if (!ffmpegAvailable) {
      fs.rm(tmpPath, { force: true }, () => {});
      return res.status(503).json({ success: false, error: 'Server chưa cài FFmpeg' });
    }
    const id = uuidv4();
    const outDir = path.join(VIDEO_TMP_DIR, id);
    try {
      await convertToHLS(tmpPath, outDir);
      // Store segments first, playlist last, so a partial upload is never playable
      const files = fs.readdirSync(outDir).sort((a, b) => (a.endsWith('.m3u8') ? 1 : 0) - (b.endsWith('.m3u8') ? 1 : 0));
      for (const name of files) {
        await db.execute({
          sql: 'INSERT OR REPLACE INTO cms_videos (video_id, file_name, content_type, data) VALUES (?, ?, ?, ?)',
          args: [id, name, VIDEO_MIME[path.extname(name)] || 'application/octet-stream', fs.readFileSync(path.join(outDir, name))]
        });
      }
      res.json({
        success: true,
        url: `/uploads/videos/${id}/index.m3u8`,
        originalName: req.file.originalname,
        size: req.file.size
      });
    } catch (err) {
      console.error('[ERROR] POST /api/upload-video:', err.message);
      db.execute({ sql: 'DELETE FROM cms_videos WHERE video_id = ?', args: [id] }).catch(() => {});
      res.status(500).json({ success: false, error: 'Chuyển đổi HLS thất bại' });
    } finally {
      fs.rm(tmpPath, { force: true }, () => {});
      fs.rm(outDir, { recursive: true, force: true }, () => {});
    }
  });
});

/**
 * GET /uploads/videos/:id/:file  – serves HLS playlist/segments from the database
 */
app.get('/uploads/videos/:id/:file', async (req, res) => {
  try {
    const { id, file } = req.params;
    if (!/^[\w-]+$/.test(id) || !/^[\w.-]+\.(m3u8|ts)$/.test(file)) return res.sendStatus(404);
    const r = await db.execute({ sql: 'SELECT content_type, data FROM cms_videos WHERE video_id = ? AND file_name = ?', args: [id, file] });
    if (r.rows.length === 0) return res.sendStatus(404);
    res.set({
      'Content-Type': r.rows[0].content_type,
      'Cache-Control': 'public, max-age=31536000, immutable'
    });
    res.send(Buffer.from(r.rows[0].data));
  } catch (err) {
    console.error('[ERROR] GET /uploads/videos:', err.message);
    res.sendStatus(500);
  }
});

/**
 * DELETE /api/logo/:slot
 * Deletes a specific logo from the server and database
 */
app.delete('/api/logo/:slot', requireMember, async (req, res) => {
  try {
    const { slot } = req.params;
    const settingKey = slot === '1' ? 'logo1_url' : 'logo2_url';
    
    await removeStoredLogo(settingKey);
    await db.execute('DELETE FROM cms_settings WHERE key = ?', [settingKey]);

    res.json({ success: true, message: `Logo ${slot} đã được xóa` });
  } catch (err) {
    console.error('[ERROR] DELETE /api/logo/:slot:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/logo
 * Returns all logo URLs
 */
app.get('/api/logo', async (req, res) => {
  try {
    const result = await db.execute('SELECT key, value FROM cms_settings WHERE key IN (?, ?)', ['logo1_url', 'logo2_url']);
    const logos = { logo1_url: null, logo2_url: null };
    
    for (const row of result.rows) {
      logos[row.key] = row.value;
    }
    
    res.json({ success: true, logos });
  } catch (err) {
    console.error('[ERROR] GET /api/logo:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Fallback: unknown API → JSON 404, anything else → public site ───
app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ success: false, error: 'Not found' });
  }
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ── Start Server ──────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🟢  ANIE-HMI Server running at http://localhost:${PORT}`);
  console.log(`    📄  Showcase:  http://localhost:${PORT}/`);
  console.log(`    🔐  ANIE CMS:  http://localhost:${PORT}/cms`);
  console.log(`    🔗  API:       http://localhost:${PORT}/api/data`);
  console.log(`    💾  Database:  ${DB_PATH}\n`);
});