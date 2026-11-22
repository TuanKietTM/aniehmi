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

const app = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ─────────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: '10mb' })); // large for base64 images

// Serve static files (anie-hmi.html etc.) from project root
app.use(express.static(path.join(__dirname)));

// Create uploads directory if not exists
const UPLOADS_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Serve uploaded files statically
app.use('/uploads', express.static(UPLOADS_DIR));

// ── Multer configuration for file uploads ──────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    // Generate unique filename with original extension
    const uniqueSuffix = uuidv4();
    const ext = path.extname(file.originalname);
    cb(null, `logo-${uniqueSuffix}${ext}`);
  }
});

const upload = multer({
  storage: storage,
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
db.execute(`
  CREATE TABLE IF NOT EXISTS cms_settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL DEFAULT ''
  );
`);

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
app.put('/api/data/:tableName', async (req, res) => {
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
app.put('/api/data', async (req, res) => {
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
app.put('/api/schemas', async (req, res) => {
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
app.post('/api/reset', async (req, res) => {
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
app.put('/api/settings/:key', async (req, res) => {
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

/**
 * POST /api/upload-logo
 * Uploads a logo file to the server and returns its URL
 */
app.post('/api/upload-logo', upload.single('logo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'Không có file ảnh được tải lên' });
    }
    
    // Get slot from request body (1 or 2)
    const slot = req.body.slot || '1';
    
    // Generate the public URL for the uploaded logo
    const logoUrl = `/uploads/${req.file.filename}`;
    
    // Save the logo URL to settings based on slot
    const settingKey = slot === '1' ? 'logo1_url' : 'logo2_url';
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
 * DELETE /api/logo/:slot
 * Deletes a specific logo from the server and database
 */
app.delete('/api/logo/:slot', async (req, res) => {
  try {
    const { slot } = req.params;
    const settingKey = slot === '1' ? 'logo1_url' : 'logo2_url';
    
    // Get current logo URL from settings
    const result = await db.execute('SELECT value FROM cms_settings WHERE key = ?', [settingKey]);
    
    if (result.rows.length > 0 && result.rows[0].value) {
      const currentUrl = result.rows[0].value;
      
      // Only delete if it's a local uploads file
      if (currentUrl.startsWith('/uploads/')) {
        const filename = currentUrl.split('/').pop();
        const filePath = path.join(UPLOADS_DIR, filename);
        
        // Delete file if exists
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }
      
      // Remove from database
      await db.execute('DELETE FROM cms_settings WHERE key = ?', [settingKey]);
    }
    
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

// ── Fallback: serve anie-hmi.html for any non-API route ───
app.use((req, res) => {
  if (!req.path.startsWith('/api/')) {
    res.sendFile(path.join(__dirname, 'anie-hmi.html'));
  }
});

// ── Start Server ──────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🟢  ANIE-HMI Server running at http://localhost:${PORT}`);
  console.log(`    📄  Showcase:  http://localhost:${PORT}/anie-hmi.html`);
  console.log(`    🔗  API:       http://localhost:${PORT}/api/data`);
  console.log(`    💾  Database:  ${DB_PATH}\n`);
});