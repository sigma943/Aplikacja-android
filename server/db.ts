import Database from 'better-sqlite3';
import path from 'path';

let db: Database.Database;

export function initDb() {
  const dbPath = path.join(process.cwd(), 'data', 'db.sqlite');
  db = new Database(dbPath);

  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS slots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      url TEXT NOT NULL,
      max_offers INTEGER DEFAULT 50,
      active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS offers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slot_id INTEGER,
      offer_id TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      price REAL,
      currency TEXT DEFAULT 'PLN',
      city TEXT,
      posted_at TEXT,
      url TEXT NOT NULL,
      images_dir TEXT,
      images_count INTEGER DEFAULT 0,
      status TEXT DEFAULT 'active',
      added_at TEXT DEFAULT CURRENT_TIMESTAMP,
      sold_detected_at TEXT,
      lifetime_days REAL,
      description TEXT,
      parameters TEXT,
      FOREIGN KEY (slot_id) REFERENCES slots(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_offers_slot_status ON offers(slot_id, status);
    CREATE INDEX IF NOT EXISTS idx_offers_offer_id ON offers(offer_id);
    CREATE INDEX IF NOT EXISTS idx_offers_added_at ON offers(added_at);

    CREATE TABLE IF NOT EXISTS price_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      offer_id TEXT,
      price REAL,
      checked_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (offer_id) REFERENCES offers(offer_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS run_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_type TEXT,
      slot_id INTEGER,
      started_at TEXT DEFAULT CURRENT_TIMESTAMP,
      finished_at TEXT,
      new_offers INTEGER DEFAULT 0,
      sold_found INTEGER DEFAULT 0,
      price_drops INTEGER DEFAULT 0,
      errors INTEGER DEFAULT 0,
      notes TEXT,
      FOREIGN KEY (slot_id) REFERENCES slots(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      offer_id TEXT,
      type TEXT, 
      message TEXT,
      is_read INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (offer_id) REFERENCES offers(offer_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);

  // Seed default settings
  const defaultSettings = [
    { key: 'theme_primary', value: '#F5A623' },
    { key: 'theme_bg', value: '#0A0A0A' },
    { key: 'theme_surface', value: '#141414' },
    { key: 'theme_border', value: '#222222' },
    { key: 'theme_text', value: '#FFFFFF' },
    { key: 'theme_text_muted', value: '#9CA3AF' },
    { key: 'theme_mode', value: 'dark' },
    { key: 'refresh_interval_stats', value: '30000' },
    { key: 'auto_check_enabled', value: 'true' },
    { key: 'glass_morphism', value: 'true' }
  ];

  const checkStmt = db.prepare('SELECT COUNT(*) as count FROM settings WHERE key = ?');
  const insertStmt = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)');

  for (const s of defaultSettings) {
    const { count } = checkStmt.get(s.key) as any;
    if (count === 0) {
      insertStmt.run(s.key, s.value);
    }
  }

  // Migration: Add description and parameters if they don't exist
  const tableInfo = db.prepare("PRAGMA table_info(offers)").all() as any[];
  const hasDescription = tableInfo.some(col => col.name === 'description');
  const hasParameters = tableInfo.some(col => col.name === 'parameters');

  if (!hasDescription) {
    db.exec("ALTER TABLE offers ADD COLUMN description TEXT");
  }
  if (!hasParameters) {
    db.exec("ALTER TABLE offers ADD COLUMN parameters TEXT");
  }

  // Migration: Add exclude_words to slots
  const slotsTableInfo = db.prepare("PRAGMA table_info(slots)").all() as any[];
  const hasExcludeWords = slotsTableInfo.some(col => col.name === 'exclude_words');
  if (!hasExcludeWords) {
    db.exec("ALTER TABLE slots ADD COLUMN exclude_words TEXT DEFAULT ''");
  }

  // Cleanup: Remove insane prices (> 1M) that were likely parsing errors
  db.exec("UPDATE offers SET price = NULL WHERE price > 1000000");
  db.exec("DELETE FROM price_history WHERE price > 1000000");
}

export function getDb() {
  if (!db) {
    initDb();
  }
  return db;
}
