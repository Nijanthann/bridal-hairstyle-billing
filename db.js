const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');

const defaultDbName = 'bridal_billing.db';
const dbPath = process.env.DATABASE_PATH || path.join(__dirname, defaultDbName);
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

let dbInstance = null;

function saveToDisk() {
  if (!dbInstance) return;
  try {
    const data = dbInstance.export();
    fs.writeFileSync(dbPath, Buffer.from(data));
  } catch (err) {
    console.error('Error saving SQLite to disk:', err);
  }
}

async function initDb() {
  if (dbInstance) return dbInstance;
  const SQL = await initSqlJs();
  if (fs.existsSync(dbPath)) {
    try {
      const fileBuffer = fs.readFileSync(dbPath);
      dbInstance = new SQL.Database(fileBuffer);
    } catch (e) {
      console.warn('Could not read existing database, creating fresh:', e.message);
      dbInstance = new SQL.Database();
    }
  } else {
    dbInstance = new SQL.Database();
  }

  // Create tables
  dbInstance.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      business_name TEXT DEFAULT '',
      tagline TEXT DEFAULT '',
      phone TEXT DEFAULT '',
      email_contact TEXT DEFAULT '',
      city TEXT DEFAULT '',
      upi_id TEXT DEFAULT '',
      bank_name TEXT DEFAULT '',
      acc_name TEXT DEFAULT '',
      acc_no TEXT DEFAULT '',
      ifsc TEXT DEFAULT '',
      instagram TEXT DEFAULT '',
      invoice_prefix TEXT DEFAULT 'INV-',
      terms TEXT DEFAULT '["Booking is confirmed after receipt of the advance payment.","Balance payment is due on or before the service date.","Advance payment is non-refundable.","Cancellation terms apply as agreed at the time of booking.","Travel charges may apply depending on the location.","Additional services requested on the event day will be charged separately."]',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      invoice_number TEXT NOT NULL,
      invoice_date TEXT NOT NULL,
      service_date TEXT,
      client_name TEXT NOT NULL,
      client_phone TEXT,
      client_email TEXT,
      event_venue TEXT,
      event_location TEXT,
      services_json TEXT NOT NULL,
      subtotal REAL NOT NULL DEFAULT 0,
      discount REAL NOT NULL DEFAULT 0,
      total_amount REAL NOT NULL DEFAULT 0,
      advance_paid REAL NOT NULL DEFAULT 0,
      balance_due REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'UNPAID',
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_invoices_user ON invoices(user_id);
    CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_user_num ON invoices(user_id, invoice_number COLLATE NOCASE);

    CREATE TABLE IF NOT EXISTS password_resets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL,
      code TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      used INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_password_resets_email ON password_resets(email);
  `);

  saveToDisk();
  return dbInstance;
}

const db = {
  prepare(sql) {
    return {
      run(...params) {
        if (!dbInstance) throw new Error('Database not initialized');
        const raw = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
        const flatParams = raw.map(p => (p === undefined ? null : p));
        dbInstance.run(sql, flatParams);
        let lastId = 0;
        try {
          const res = dbInstance.exec('SELECT last_insert_rowid() as id');
          if (res && res[0] && res[0].values && res[0].values[0]) {
            lastId = res[0].values[0][0];
          }
        } catch (e) {}
        saveToDisk();
        return { changes: 1, lastInsertRowid: lastId };
      },
      get(...params) {
        if (!dbInstance) throw new Error('Database not initialized');
        const raw = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
        const flatParams = raw.map(p => (p === undefined ? null : p));
        const stmt = dbInstance.prepare(sql);
        try {
          stmt.bind(flatParams);
          if (stmt.step()) {
            return stmt.getAsObject();
          }
          return undefined;
        } finally {
          stmt.free();
        }
      },
      all(...params) {
        if (!dbInstance) throw new Error('Database not initialized');
        const raw = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
        const flatParams = raw.map(p => (p === undefined ? null : p));
        const stmt = dbInstance.prepare(sql);
        const rows = [];
        try {
          stmt.bind(flatParams);
          while (stmt.step()) {
            rows.push(stmt.getAsObject());
          }
          return rows;
        } finally {
          stmt.free();
        }
      }
    };
  },
  exec(sql) {
    if (!dbInstance) throw new Error('Database not initialized');
    dbInstance.run(sql);
    saveToDisk();
  }
};

db.initDb = initDb;
db.db = db;

module.exports = db;
