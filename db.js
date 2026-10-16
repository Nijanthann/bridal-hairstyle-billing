const fs = require('fs');
const path = require('path');
let SQLiteDatabase;
try {
  SQLiteDatabase = require('better-sqlite3');
} catch (e) {
  const { DatabaseSync } = require('node:sqlite');
  SQLiteDatabase = DatabaseSync;
}

const defaultDbName = 'bridal_billing.db';
const dbPath = process.env.DATABASE_PATH || path.join(__dirname, defaultDbName);
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}
const db = new SQLiteDatabase(dbPath);

// Initialize tables
function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      business_name TEXT DEFAULT 'Bridal Studio',
      tagline TEXT DEFAULT 'Bridal Hairstyling & Makeup Studio',
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
  `);
}

initDb();

module.exports = db;
