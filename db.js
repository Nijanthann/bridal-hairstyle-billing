const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const bcrypt = require('bcryptjs');

const defaultDbName = fs.existsSync(path.join(__dirname, 'zoho_billing.db')) ? 'zoho_billing.db' : 'bridal_billing.db';
const dbPath = process.env.DATABASE_PATH || path.join(__dirname, defaultDbName);
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}
const db = new DatabaseSync(dbPath);

// Initialize tables
function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      business_name TEXT DEFAULT 'Deepz Hairstylist',
      tagline TEXT DEFAULT 'Bridal Hairstyling & Saree Draping',
      phone TEXT DEFAULT '+91 98945 70313',
      email_contact TEXT DEFAULT 'hello@deepzstyling.com',
      city TEXT DEFAULT 'Tiruppur',
      upi_id TEXT DEFAULT 'deeparubinipalanisamy@oksbi',
      bank_name TEXT DEFAULT 'Karur Vysya Bank',
      acc_name TEXT DEFAULT 'Deeparubini P',
      acc_no TEXT DEFAULT '1643155000112456',
      ifsc TEXT DEFAULT 'KVBL0001643',
      instagram TEXT DEFAULT 'deepzhairstylist',
      invoice_prefix TEXT DEFAULT 'BH-',
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

  seedDemoUsers();
}

function seedDemoUsers() {
  const userCheck = db.prepare('SELECT COUNT(*) as count FROM users').get();
  if (userCheck.count === 0) {
    console.log('Seeding demo users and invoices for multi-user bridal billing...');
    const salt = bcrypt.genSaltSync(10);
    const passHash = bcrypt.hashSync('password123', salt);

    // User 1: Deepa (Deepz Hairstylist)
    const insUser = db.prepare(`
      INSERT INTO users (username, email, password_hash, name, business_name, tagline, phone, email_contact, city, upi_id, bank_name, acc_name, acc_no, ifsc, instagram, invoice_prefix)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const user1 = insUser.run(
      'deepa',
      'deepa@deepzstyling.com',
      passHash,
      'Deeparubini P',
      'Deepz Hairstylist',
      'Bridal Hairstyling & Saree Draping',
      '+91 98945 70313',
      'hello@deepzstyling.com',
      'Tiruppur',
      'deeparubinipalanisamy@oksbi',
      'Karur Vysya Bank',
      'Deeparubini P',
      '1643155000112456',
      'KVBL0001643',
      'deepzhairstylist',
      'BH-'
    );

    // User 2: Ananya (Ananya Bridal Studio)
    const user2 = insUser.run(
      'ananya',
      'ananya@bridalstudio.in',
      passHash,
      'Ananya Sharma',
      'Ananya Bridal Studio',
      'Luxury Bridal Hair, Makeup & Couture Styling',
      '+91 98765 43210',
      'bookings@ananyabridal.com',
      'Coimbatore',
      'ananya.bridal@icici',
      'HDFC Bank',
      'Ananya Sharma Studio',
      '50100234567890',
      'HDFC0001234',
      'ananyabridalstudio',
      'ABS-'
    );

    // Seed realistic invoices for User 1 (Deepa)
    const insInv = db.prepare(`
      INSERT INTO invoices (user_id, invoice_number, invoice_date, service_date, client_name, client_phone, client_email, event_venue, event_location, services_json, subtotal, discount, total_amount, advance_paid, balance_due, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // Invoice 1 for Deepa: Partially Paid
    insInv.run(
      Number(user1.lastInsertRowid),
      'BH-024',
      '2026-10-10',
      '2026-10-25',
      'Pooja Sundaram',
      '9876543210',
      'pooja.sundaram@gmail.com',
      'Sri Krishna Mahal',
      'Tiruppur',
      JSON.stringify([
        { desc: 'Bridal Hairstyling', qty: 1, rate: 12000, amount: 12000 },
        { desc: 'Hair Trial', qty: 1, rate: 3000, amount: 3000 },
        { desc: 'Bridesmaid Hairstyling', qty: 3, rate: 2500, amount: 7500 },
        { desc: 'Travel Charges', qty: 1, rate: 2000, amount: 2000 }
      ]),
      24500,
      1000,
      23500,
      10000,
      13500,
      'PARTIALLY_PAID'
    );

    // Invoice 2 for Deepa: Fully Paid
    insInv.run(
      Number(user1.lastInsertRowid),
      'BH-023',
      '2026-10-02',
      '2026-10-08',
      'Kavitha Ramesh',
      '9944123456',
      'kavitha.ramesh@yahoo.com',
      'Le Meridien',
      'Coimbatore',
      JSON.stringify([
        { desc: 'Bridal Hairstyling & Muhurtham', qty: 1, rate: 15000, amount: 15000 },
        { desc: 'Family Hairstyling', qty: 4, rate: 2000, amount: 8000 }
      ]),
      23000,
      0,
      23000,
      23000,
      0,
      'PAID'
    );

    // Invoice 3 for Deepa: Unpaid
    insInv.run(
      Number(user1.lastInsertRowid),
      'BH-025',
      '2026-10-15',
      '2026-11-04',
      'Divya Natesan',
      '9843054321',
      'divya.natesan@outlook.com',
      'Grand Palace Convention',
      'Erode',
      JSON.stringify([
        { desc: 'Bridal Hairstyling', qty: 1, rate: 14000, amount: 14000 },
        { desc: 'Additional Reception Touchup', qty: 1, rate: 4500, amount: 4500 }
      ]),
      18500,
      500,
      18000,
      0,
      18000,
      'UNPAID'
    );

    // Seed invoices for User 2 (Ananya) - showing isolated per-user records
    insInv.run(
      Number(user2.lastInsertRowid),
      'ABS-101',
      '2026-10-12',
      '2026-10-30',
      'Meera Krishnan',
      '9790123456',
      'meera.k@gmail.com',
      'The Residency Towers',
      'Coimbatore',
      JSON.stringify([
        { desc: 'Full Bridal Couture Hair & Saree', qty: 1, rate: 25000, amount: 25000 },
        { desc: 'Sangeet Hairstyling', qty: 1, rate: 8000, amount: 8000 }
      ]),
      33000,
      2000,
      31000,
      15000,
      16000,
      'PARTIALLY_PAID'
    );

    console.log('Database seeded with demo users (deepa / password123, ananya / password123)');
  }
}

initDb();

module.exports = db;
