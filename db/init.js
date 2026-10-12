const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = process.env.DB_PATH || path.join(__dirname, 'res.sqlite');
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS leads (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  name        TEXT NOT NULL,
  business    TEXT,
  phone       TEXT,
  email       TEXT NOT NULL,
  trade       TEXT,
  area        TEXT,
  website     TEXT,
  plan        TEXT,
  message     TEXT,
  source      TEXT,
  status      TEXT NOT NULL DEFAULT 'new',
  notes       TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_leads_created ON leads(created_at);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
`);

// Add columns introduced after first deploy (safe to run every start).
const have = new Set(db.prepare('PRAGMA table_info(leads)').all().map((c) => c.name));
if (!have.has('facebook')) db.exec("ALTER TABLE leads ADD COLUMN facebook TEXT NOT NULL DEFAULT ''");
if (!have.has('link_check')) db.exec("ALTER TABLE leads ADD COLUMN link_check TEXT NOT NULL DEFAULT ''");

module.exports = { db, dbPath };
