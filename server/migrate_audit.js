const Database = require('better-sqlite3');
const db = new Database('./db/hms.db');
const tables = db.pragma('table_info(audit_logs)');
if (tables.length === 0) {
  db.exec(`CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    user_name TEXT,
    user_role TEXT,
    action TEXT NOT NULL,
    entity TEXT,
    entity_id TEXT,
    details TEXT,
    ip TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );`);
  console.log('Created audit_logs table');
} else { console.log('audit_logs already exists'); }
