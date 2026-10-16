const express = require('express');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
const db = require('./db');
const { authMiddleware, generateToken } = require('./authMiddleware');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Email Transporter Config
function createMailTransporter() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT) || 587;
  const user = process.env.SMTP_USER || process.env.EMAIL_USER;
  const pass = process.env.SMTP_PASS || process.env.EMAIL_PASS;
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;

  if (host && user && pass) {
    return nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass }
    });
  } else if (user && pass && user.includes('@gmail.com')) {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: { user, pass }
    });
  }
  return null;
}

async function sendVerificationEmail(toEmail, code, userName) {
  const transporter = createMailTransporter();
  const fromAddress = process.env.SMTP_FROM || process.env.SMTP_USER || '"Bridal Billing Studio" <no-reply@bridalstudio.com>';
  
  const subject = `Your Password Reset Verification Code: ${code} - Bridal Billing Studio`;
  const textContent = `Hello ${userName || 'Artist'},\n\nYour password reset verification code is: ${code}\n\nThis code is valid for 15 minutes. If you did not request this code, please ignore this email.\n\nBridal Billing Studio`;
  
  const htmlContent = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 500px; margin: 0 auto; padding: 24px; border: 1px solid #E7E5E4; border-radius: 12px; background: #ffffff;">
      <div style="text-align: center; margin-bottom: 20px;">
        <h2 style="margin: 0; color: #1C1917; font-size: 20px;">🌸 Bridal Billing Studio</h2>
        <p style="margin: 4px 0 0 0; color: #78716C; font-size: 13px;">Password Reset Request</p>
      </div>
      <div style="background-color: #FBF9F7; border: 1px solid #EAE5DE; border-radius: 8px; padding: 20px; text-align: center; margin-bottom: 20px;">
        <p style="margin: 0 0 10px 0; color: #44403C; font-size: 13px;">Here is your 6-digit verification code:</p>
        <div style="font-size: 32px; font-weight: 800; letter-spacing: 6px; color: #9B7026; padding: 8px 16px; background: #ffffff; border: 1px dashed #D4AF37; border-radius: 8px; display: inline-block;">
          ${code}
        </div>
        <p style="margin: 10px 0 0 0; color: #A8A29E; font-size: 11px;">Expires in 15 minutes</p>
      </div>
      <p style="color: #78716C; font-size: 12px; line-height: 1.5; margin: 0 0 16px 0;">
        Enter this verification code in the billing studio to choose your new password. If you didn't request a password reset, your account is safe and you can ignore this email.
      </p>
      <div style="border-top: 1px solid #F5F5F4; padding-top: 14px; text-align: center; color: #A8A29E; font-size: 11px;">
        Bridal Billing & Client Invoicing Studio
      </div>
    </div>
  `;

  if (transporter) {
    try {
      await transporter.sendMail({
        from: fromAddress,
        to: toEmail,
        subject,
        text: textContent,
        html: htmlContent
      });
      console.log(`[EMAIL] Verification code successfully sent via SMTP to ${toEmail}`);
      return { sent: true, method: 'smtp' };
    } catch (err) {
      console.error(`[EMAIL ERROR] Failed to send email via SMTP to ${toEmail}:`, err.message);
      return { sent: false, error: err.message, method: 'fallback' };
    }
  } else {
    console.log(`[DEV/DEMO EMAIL] No SMTP credentials configured. Verification code for ${toEmail}: ${code}`);
    return { sent: false, method: 'demo' };
  }
}

// Helper to determine invoice status
function calculateStatus(total, advance) {
  const t = Number(total) || 0;
  const a = Number(advance) || 0;
  const bal = Math.max(0, t - a);
  if (bal <= 0 && t > 0) return 'PAID';
  if (a > 0 && bal > 0) return 'PARTIALLY_PAID';
  return 'UNPAID';
}

// ================= AUTH ROUTES =================

// Register
app.post('/api/auth/register', (req, res) => {
  try {
    const {
      username,
      email,
      password,
      name,
      business_name,
      tagline,
      phone,
      city,
      upi_id,
      bank_name,
      acc_name,
      acc_no,
      ifsc,
      invoice_prefix
    } = req.body;

    if (!username || !email || !password || !name) {
      return res.status(400).json({ error: 'Username, email, password, and your name are required.' });
    }

    const cleanUsername = username.trim().toLowerCase();
    const cleanEmail = email.trim().toLowerCase();

    // Check existing
    const existing = db.prepare('SELECT id FROM users WHERE username = ? OR email = ?').get(cleanUsername, cleanEmail);
    if (existing) {
      return res.status(400).json({ error: 'Username or email already exists. Please log in.' });
    }

    const salt = bcrypt.genSaltSync(10);
    const password_hash = bcrypt.hashSync(password, salt);

    const insertStmt = db.prepare(`
      INSERT INTO users (
        username, email, password_hash, name,
        business_name, tagline, phone, city,
        upi_id, bank_name, acc_name, acc_no, ifsc, invoice_prefix
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = insertStmt.run(
      cleanUsername,
      cleanEmail,
      password_hash,
      name.trim(),
      (business_name || '').trim(),
      (tagline || '').trim(),
      (phone || '').trim(),
      (city || '').trim(),
      upi_id || '',
      bank_name || '',
      acc_name || '',
      acc_no || '',
      ifsc || '',
      invoice_prefix || 'INV-'
    );

    const user = db.prepare('SELECT id, username, email, name, business_name, tagline, phone, email_contact, city, upi_id, bank_name, acc_name, acc_no, ifsc, instagram, invoice_prefix, terms FROM users WHERE id = ?').get(Number(result.lastInsertRowid));
    const token = generateToken(user);

    res.json({ token, user, message: 'Registration successful!' });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Internal server error during registration.' });
  }
});

// Login
app.post('/api/auth/login', (req, res) => {
  try {
    const { login, password } = req.body;
    if (!login || !password) {
      return res.status(400).json({ error: 'Please enter username/email and password.' });
    }

    const cleanLogin = login.trim().toLowerCase();
    const user = db.prepare('SELECT * FROM users WHERE LOWER(username) = ? OR LOWER(email) = ?').get(cleanLogin, cleanLogin);

    if (!user) {
      return res.status(401).json({ error: 'User not found with this username or email.' });
    }

    const validPassword = bcrypt.compareSync(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid password. Please check your credentials.' });
    }

    delete user.password_hash;
    const token = generateToken(user);

    res.json({ token, user, message: `Welcome back, ${user.name}!` });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error during login.' });
  }
});

// Forgot Password - Step 1: Send Verification Code to Email
app.post('/api/auth/forgot-password/send-code', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || !email.trim()) {
      return res.status(400).json({ error: 'Please enter your registered email address.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const user = db.prepare('SELECT id, name, username, email FROM users WHERE LOWER(email) = ?').get(cleanEmail);
    if (!user) {
      return res.status(404).json({ error: 'No account found matching this email address. Please check and try again.' });
    }

    // Generate secure 6-digit verification code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 15 * 60 * 1000; // 15 mins expiry

    // Invalidate any prior unused codes for this email
    db.prepare('UPDATE password_resets SET used = 1 WHERE LOWER(email) = ? AND used = 0').run(cleanEmail);

    // Save new code to database
    db.prepare('INSERT INTO password_resets (email, code, expires_at) VALUES (?, ?, ?)').run(cleanEmail, code, expiresAt);

    // Send email via SMTP or demo fallback
    const result = await sendVerificationEmail(cleanEmail, code, user.name);

    if (result.sent) {
      res.json({
        success: true,
        message: `Verification code sent to ${cleanEmail}. Please check your inbox and spam folder.`,
        email: cleanEmail,
        delivery: 'smtp'
      });
    } else {
      res.json({
        success: true,
        message: `Verification code generated for ${cleanEmail}.`,
        email: cleanEmail,
        demoCode: code,
        delivery: result.method
      });
    }
  } catch (err) {
    console.error('Send reset code error:', err);
    res.status(500).json({ error: 'Failed to send verification code. Please try again.' });
  }
});

// Forgot Password - Step 2: Verify Code and Reset Password
app.post('/api/auth/forgot-password/reset-password', (req, res) => {
  try {
    const { email, code, new_password } = req.body;
    if (!email || !code || !new_password) {
      return res.status(400).json({ error: 'Email, verification code, and new password are required.' });
    }

    if (new_password.length < 4) {
      return res.status(400).json({ error: 'New password must be at least 4 characters long.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanCode = code.trim();

    // Find active, unused code
    const resetRecord = db.prepare(`
      SELECT * FROM password_resets 
      WHERE LOWER(email) = ? AND code = ? AND used = 0 
      ORDER BY id DESC LIMIT 1
    `).get(cleanEmail, cleanCode);

    if (!resetRecord) {
      return res.status(400).json({ error: 'Invalid verification code. Please check and try again.' });
    }

    if (Date.now() > resetRecord.expires_at) {
      return res.status(400).json({ error: 'This verification code has expired. Please request a new code.' });
    }

    const user = db.prepare('SELECT * FROM users WHERE LOWER(email) = ?').get(cleanEmail);
    if (!user) {
      return res.status(404).json({ error: 'User account not found.' });
    }

    // Update password
    const salt = bcrypt.genSaltSync(10);
    const password_hash = bcrypt.hashSync(new_password, salt);

    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(password_hash, user.id);
    db.prepare('UPDATE password_resets SET used = 1 WHERE id = ?').run(resetRecord.id);

    delete user.password_hash;
    const token = generateToken(user);

    res.json({
      success: true,
      token,
      user,
      message: 'Password reset successfully! You are now logged in.'
    });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: 'Internal server error during password reset.' });
  }
});

// Backward-compatible unified forgot-password endpoint
app.post('/api/auth/forgot-password', (req, res) => {
  try {
    const { email, code, login, verification, new_password } = req.body;

    // If code is provided, use code verification flow
    if (code && (email || login)) {
      const targetEmail = (email || login).trim().toLowerCase();
      const cleanCode = code.trim();

      if (!new_password || new_password.length < 4) {
        return res.status(400).json({ error: 'New password must be at least 4 characters long.' });
      }

      const resetRecord = db.prepare(`
        SELECT * FROM password_resets 
        WHERE LOWER(email) = ? AND code = ? AND used = 0 
        ORDER BY id DESC LIMIT 1
      `).get(targetEmail, cleanCode);

      if (!resetRecord) {
        return res.status(400).json({ error: 'Invalid verification code.' });
      }

      if (Date.now() > resetRecord.expires_at) {
        return res.status(400).json({ error: 'Verification code has expired.' });
      }

      const user = db.prepare('SELECT * FROM users WHERE LOWER(email) = ?').get(targetEmail);
      if (!user) return res.status(404).json({ error: 'User not found.' });

      const salt = bcrypt.genSaltSync(10);
      const password_hash = bcrypt.hashSync(new_password, salt);
      db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(password_hash, user.id);
      db.prepare('UPDATE password_resets SET used = 1 WHERE id = ?').run(resetRecord.id);

      delete user.password_hash;
      const token = generateToken(user);
      return res.json({ token, user, message: 'Password reset successfully! You are now logged in.' });
    }

    // Fallback: identity verification info
    if (!login || !verification || !new_password) {
      return res.status(400).json({ error: 'Please enter your username/email, account verification info, and new password.' });
    }

    if (new_password.length < 4) {
      return res.status(400).json({ error: 'New password must be at least 4 characters long.' });
    }

    const cleanLogin = login.trim().toLowerCase();
    const cleanVerif = verification.trim().toLowerCase();
    const cleanDigits = verification.replace(/[^0-9]/g, '');

    const user = db.prepare('SELECT * FROM users WHERE LOWER(username) = ? OR LOWER(email) = ?').get(cleanLogin, cleanLogin);
    if (!user) {
      return res.status(404).json({ error: 'No account found matching this username or email.' });
    }

    const userName = (user.name || '').trim().toLowerCase();
    const userPhoneDigits = (user.phone || '').replace(/[^0-9]/g, '');
    const userBiz = (user.business_name || '').trim().toLowerCase();
    const userUsername = (user.username || '').trim().toLowerCase();
    const userEmail = (user.email || '').trim().toLowerCase();

    const nameMatch = userName.length > 0 && (userName === cleanVerif || userName.includes(cleanVerif) || cleanVerif.includes(userName));
    const phoneMatch = cleanDigits.length >= 5 && userPhoneDigits.includes(cleanDigits);
    const bizMatch = userBiz.length > 0 && (userBiz === cleanVerif || userBiz.includes(cleanVerif));
    const crossMatch = cleanVerif === userUsername || cleanVerif === userEmail;

    if (!nameMatch && !phoneMatch && !bizMatch && !crossMatch) {
      return res.status(400).json({
        error: 'Verification failed. Please enter your registered full name, phone number, or studio name to verify ownership.'
      });
    }

    const salt = bcrypt.genSaltSync(10);
    const password_hash = bcrypt.hashSync(new_password, salt);

    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(password_hash, user.id);

    delete user.password_hash;
    const token = generateToken(user);

    res.json({
      token,
      user,
      message: 'Password reset successfully! You are now logged in.'
    });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ error: 'Internal server error during password reset.' });
  }
});

// Change Password (for logged-in users)
app.post('/api/auth/change-password', authMiddleware, (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password) {
      return res.status(400).json({ error: 'Please enter your current password and new password.' });
    }

    if (new_password.length < 4) {
      return res.status(400).json({ error: 'New password must be at least 4 characters long.' });
    }

    const user = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const isValid = bcrypt.compareSync(current_password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'Current password is incorrect.' });
    }

    const salt = bcrypt.genSaltSync(10);
    const newHash = bcrypt.hashSync(new_password, salt);
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(newHash, req.user.id);

    res.json({ message: 'Password updated successfully!' });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ error: 'Internal server error while changing password.' });
  }
});

// Get current user info
app.get('/api/auth/me', authMiddleware, (req, res) => {
  res.json({ user: req.user });
});

// Update Studio profile & banking details
app.put('/api/auth/profile', authMiddleware, (req, res) => {
  try {
    const {
      name,
      business_name,
      tagline,
      phone,
      email_contact,
      city,
      upi_id,
      bank_name,
      acc_name,
      acc_no,
      ifsc,
      instagram,
      invoice_prefix,
      terms
    } = req.body;

    const updateStmt = db.prepare(`
      UPDATE users SET
        name = COALESCE(?, name),
        business_name = COALESCE(?, business_name),
        tagline = COALESCE(?, tagline),
        phone = COALESCE(?, phone),
        email_contact = COALESCE(?, email_contact),
        city = COALESCE(?, city),
        upi_id = COALESCE(?, upi_id),
        bank_name = COALESCE(?, bank_name),
        acc_name = COALESCE(?, acc_name),
        acc_no = COALESCE(?, acc_no),
        ifsc = COALESCE(?, ifsc),
        instagram = COALESCE(?, instagram),
        invoice_prefix = COALESCE(?, invoice_prefix),
        terms = COALESCE(?, terms)
      WHERE id = ?
    `);

    updateStmt.run(
      name,
      business_name,
      tagline,
      phone,
      email_contact,
      city,
      upi_id,
      bank_name,
      acc_name,
      acc_no,
      ifsc,
      instagram,
      invoice_prefix,
      typeof terms === 'string' ? terms : JSON.stringify(terms),
      req.userId
    );

    const updatedUser = db.prepare('SELECT id, username, email, name, business_name, tagline, phone, email_contact, city, upi_id, bank_name, acc_name, acc_no, ifsc, instagram, invoice_prefix, terms FROM users WHERE id = ?').get(req.userId);
    res.json({ user: updatedUser, message: 'Studio profile saved successfully!' });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ error: 'Failed to update profile settings.' });
  }
});

// Demo accounts list for instant one-click switching
app.get('/api/auth/demo-users', (req, res) => {
  const users = db.prepare('SELECT id, username, name, business_name, tagline, phone FROM users ORDER BY id ASC LIMIT 5').all();
  res.json({ demoUsers: users });
});

// ================= DASHBOARD & STATS =================

app.get('/api/dashboard/stats', authMiddleware, (req, res) => {
  try {
    const userId = req.userId;

    const stats = db.prepare(`
      SELECT
        COUNT(*) as total_invoices,
        COALESCE(SUM(total_amount), 0) as total_invoiced,
        COALESCE(SUM(advance_paid), 0) as total_received,
        COALESCE(SUM(balance_due), 0) as total_balance_due,
        COUNT(CASE WHEN status = 'PAID' THEN 1 END) as count_paid,
        COUNT(CASE WHEN status = 'PARTIALLY_PAID' THEN 1 END) as count_partially_paid,
        COUNT(CASE WHEN status = 'UNPAID' THEN 1 END) as count_unpaid
      FROM invoices
      WHERE user_id = ?
    `).get(userId);

    const recentInvoices = db.prepare(`
      SELECT id, invoice_number, invoice_date, service_date, client_name, client_phone, total_amount, advance_paid, balance_due, status
      FROM invoices
      WHERE user_id = ?
      ORDER BY id DESC
      LIMIT 5
    `).all(userId);

    res.json({
      stats: {
        totalInvoices: Number(stats.total_invoices),
        totalInvoiced: Number(stats.total_invoiced),
        totalReceived: Number(stats.total_received),
        totalBalanceDue: Number(stats.total_balance_due),
        countPaid: Number(stats.count_paid),
        countPartiallyPaid: Number(stats.count_partially_paid),
        countUnpaid: Number(stats.count_unpaid)
      },
      recentInvoices
    });
  } catch (err) {
    console.error('Stats error:', err);
    res.status(500).json({ error: 'Failed to retrieve dashboard metrics.' });
  }
});

// ================= INVOICES MANAGEMENT =================

// List invoices with filter, search, sort
app.get('/api/invoices', authMiddleware, (req, res) => {
  try {
    const userId = req.userId;
    const { search, status, sort } = req.query;

    let query = 'SELECT * FROM invoices WHERE user_id = ?';
    const params = [userId];

    if (status && status !== 'ALL') {
      query += ' AND status = ?';
      params.push(status.toUpperCase());
    }

    if (search && search.trim()) {
      const s = `%${search.trim()}%`;
      query += ' AND (invoice_number LIKE ? OR client_name LIKE ? OR client_phone LIKE ? OR event_venue LIKE ?)';
      params.push(s, s, s, s);
    }

    if (sort === 'amount_desc') {
      query += ' ORDER BY total_amount DESC';
    } else if (sort === 'amount_asc') {
      query += ' ORDER BY total_amount ASC';
    } else if (sort === 'date_asc') {
      query += ' ORDER BY invoice_date ASC, id ASC';
    } else {
      query += ' ORDER BY invoice_date DESC, id DESC';
    }

    const invoices = db.prepare(query).all(...params);

    const formatted = invoices.map(inv => ({
      ...inv,
      services: JSON.parse(inv.services_json || '[]')
    }));

    res.json({ invoices: formatted });
  } catch (err) {
    console.error('List invoices error:', err);
    res.status(500).json({ error: 'Failed to fetch invoices.' });
  }
});

// Helper to calculate smart auto-detected next invoice number for user
function getNextInvoiceNumber(userId, customPrefix) {
  const user = db.prepare('SELECT invoice_prefix FROM users WHERE id = ?').get(userId);
  const prefix = (customPrefix || (user && user.invoice_prefix) || 'INV-').trim();

  // Query all existing invoice numbers for this user
  const rows = db.prepare('SELECT invoice_number FROM invoices WHERE user_id = ?').all(userId);
  
  let maxNum = 0;
  const cleanPrefix = prefix.toLowerCase();
  let prefixMatchedAny = false;

  for (const r of rows) {
    const invNo = (r.invoice_number || '').trim();
    // Check if invoice starts with the prefix
    if (cleanPrefix && invNo.toLowerCase().startsWith(cleanPrefix)) {
      prefixMatchedAny = true;
      const numPart = invNo.slice(prefix.length).replace(/[^0-9]/g, '');
      if (numPart) {
        const n = parseInt(numPart, 10);
        if (!isNaN(n) && n > maxNum) maxNum = n;
      }
    }
  }

  // If prefix had no matches and prefix is default, fallback to checking trailing numbers
  if (!prefixMatchedAny && cleanPrefix === 'inv-') {
    for (const r of rows) {
      const match = (r.invoice_number || '').match(/(\d+)$/);
      if (match) {
        const n = parseInt(match[1], 10);
        if (!isNaN(n) && n > maxNum) maxNum = n;
      }
    }
  }

  let candidateNum = maxNum + 1;
  let formatted = `${prefix}${String(candidateNum).padStart(3, '0')}`;

  // Collision check to guarantee unique next number
  while (db.prepare('SELECT id FROM invoices WHERE user_id = ? AND invoice_number = ?').get(userId, formatted)) {
    candidateNum++;
    formatted = `${prefix}${String(candidateNum).padStart(3, '0')}`;
  }

  return formatted;
}

// Next auto invoice number for user (Smart Auto-Detection)
app.get('/api/invoices/next-number', authMiddleware, (req, res) => {
  try {
    const nextNumber = getNextInvoiceNumber(req.userId, req.query.prefix || req.user.invoice_prefix);
    res.json({ nextInvoiceNumber: nextNumber });
  } catch (err) {
    console.error('Next invoice number detection error:', err);
    res.json({ nextInvoiceNumber: 'INV-001' });
  }
});

// Get single invoice
app.get('/api/invoices/:id', authMiddleware, (req, res) => {
  try {
    const invoice = db.prepare('SELECT * FROM invoices WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found.' });
    }

    invoice.services = JSON.parse(invoice.services_json || '[]');
    res.json({ invoice });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get invoice.' });
  }
});

// Create new invoice
app.post('/api/invoices', authMiddleware, (req, res) => {
  try {
    const userId = req.userId;
    let {
      invoice_number,
      invoice_date,
      service_date,
      client_name,
      client_phone,
      client_email,
      event_venue,
      event_location,
      services,
      discount,
      advance_paid,
      notes
    } = req.body;

    if (!invoice_number || !invoice_number.trim()) {
      invoice_number = getNextInvoiceNumber(userId);
    } else {
      invoice_number = invoice_number.trim();
    }

    // Check for duplicate invoice number for this user
    const existingInv = db.prepare('SELECT id FROM invoices WHERE user_id = ? AND LOWER(invoice_number) = ?').get(userId, invoice_number.toLowerCase());
    if (existingInv) {
      return res.status(400).json({ error: `Invoice number "${invoice_number}" already exists. Duplicate invoice numbers are not allowed.` });
    }

    if (!client_name || !client_name.trim()) {
      return res.status(400).json({ error: 'Client name is required.' });
    }

    const servicesList = Array.isArray(services) ? services : [];
    let subtotal = 0;
    servicesList.forEach(s => {
      const q = Number(s.qty) || 1;
      const r = Number(s.rate) || 0;
      subtotal += q * r;
    });

    const disc = Number(discount) || 0;
    const adv = Number(advance_paid) || 0;
    const total = Math.max(0, subtotal - disc);
    const bal = Math.max(0, total - adv);
    const status = calculateStatus(total, adv);

    const insertStmt = db.prepare(`
      INSERT INTO invoices (
        user_id, invoice_number, invoice_date, service_date,
        client_name, client_phone, client_email, event_venue, event_location,
        services_json, subtotal, discount, total_amount, advance_paid, balance_due,
        status, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = insertStmt.run(
      userId,
      invoice_number.trim(),
      invoice_date || new Date().toISOString().split('T')[0],
      service_date || '',
      client_name.trim(),
      client_phone || '',
      client_email || '',
      event_venue || '',
      event_location || '',
      JSON.stringify(servicesList),
      subtotal,
      disc,
      total,
      adv,
      bal,
      status,
      notes || ''
    );

    const created = db.prepare('SELECT * FROM invoices WHERE id = ?').get(Number(result.lastInsertRowid));
    created.services = servicesList;

    res.json({ invoice: created, message: 'Invoice created successfully!' });
  } catch (err) {
    console.error('Create invoice error:', err);
    res.status(500).json({ error: 'Failed to create invoice.' });
  }
});

// Update existing invoice
app.put('/api/invoices/:id', authMiddleware, (req, res) => {
  try {
    const userId = req.userId;
    const invId = req.params.id;

    const existing = db.prepare('SELECT id FROM invoices WHERE id = ? AND user_id = ?').get(invId, userId);
    if (!existing) {
      return res.status(404).json({ error: 'Invoice not found.' });
    }

    const {
      invoice_number,
      invoice_date,
      service_date,
      client_name,
      client_phone,
      client_email,
      event_venue,
      event_location,
      services,
      discount,
      advance_paid,
      notes
    } = req.body;

    if (invoice_number && invoice_number.trim()) {
      const cleanNum = invoice_number.trim();
      const duplicateCheck = db.prepare('SELECT id FROM invoices WHERE user_id = ? AND LOWER(invoice_number) = ? AND id != ?').get(userId, cleanNum.toLowerCase(), invId);
      if (duplicateCheck) {
        return res.status(400).json({ error: `Invoice number "${cleanNum}" is already used by another invoice. Duplicate invoice numbers are not allowed.` });
      }
    }

    const servicesList = Array.isArray(services) ? services : [];
    let subtotal = 0;
    servicesList.forEach(s => {
      const q = Number(s.qty) || 1;
      const r = Number(s.rate) || 0;
      subtotal += q * r;
    });

    const disc = Number(discount) || 0;
    const adv = Number(advance_paid) || 0;
    const total = Math.max(0, subtotal - disc);
    const bal = Math.max(0, total - adv);
    const status = calculateStatus(total, adv);

    const updateStmt = db.prepare(`
      UPDATE invoices SET
        invoice_number = ?,
        invoice_date = ?,
        service_date = ?,
        client_name = ?,
        client_phone = ?,
        client_email = ?,
        event_venue = ?,
        event_location = ?,
        services_json = ?,
        subtotal = ?,
        discount = ?,
        total_amount = ?,
        advance_paid = ?,
        balance_due = ?,
        status = ?,
        notes = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND user_id = ?
    `);

    updateStmt.run(
      (invoice_number || '').trim(),
      invoice_date || '',
      service_date || '',
      (client_name || '').trim(),
      client_phone || '',
      client_email || '',
      event_venue || '',
      event_location || '',
      JSON.stringify(servicesList),
      subtotal,
      disc,
      total,
      adv,
      bal,
      status,
      notes || '',
      Number(invId),
      Number(userId)
    );

    const updated = db.prepare('SELECT * FROM invoices WHERE id = ?').get(invId);
    updated.services = servicesList;

    res.json({ invoice: updated, message: 'Invoice updated successfully!' });
  } catch (err) {
    console.error('Update invoice error:', err);
    res.status(500).json({ error: 'Failed to update invoice.' });
  }
});

// Record Payment (e.g. Settle balance or Partial payment)
app.post('/api/invoices/:id/record-payment', authMiddleware, (req, res) => {
  try {
    const userId = req.userId;
    const invId = req.params.id;
    const { amountPaid, notes } = req.body;

    const invoice = db.prepare('SELECT * FROM invoices WHERE id = ? AND user_id = ?').get(invId, userId);
    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found.' });
    }

    const additionalPayment = Number(amountPaid) || 0;
    if (additionalPayment <= 0) {
      return res.status(400).json({ error: 'Please enter a valid payment amount.' });
    }

    const newAdvance = invoice.advance_paid + additionalPayment;
    const newBalance = Math.max(0, invoice.total_amount - newAdvance);
    const newStatus = calculateStatus(invoice.total_amount, newAdvance);

    const newNotes = notes
      ? (invoice.notes ? `${invoice.notes}\n[Payment received: ₹${additionalPayment} - ${notes}]` : `[Payment received: ₹${additionalPayment} - ${notes}]`)
      : (invoice.notes ? `${invoice.notes}\n[Payment received: ₹${additionalPayment}]` : `[Payment received: ₹${additionalPayment}]`);

    const updateStmt = db.prepare(`
      UPDATE invoices SET
        advance_paid = ?,
        balance_due = ?,
        status = ?,
        notes = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND user_id = ?
    `);

    updateStmt.run(newAdvance, newBalance, newStatus, newNotes, invId, userId);

    const updated = db.prepare('SELECT * FROM invoices WHERE id = ?').get(invId);
    res.json({ invoice: updated, message: `Payment of ₹${additionalPayment.toLocaleString('en-IN')} recorded successfully!` });
  } catch (err) {
    console.error('Record payment error:', err);
    res.status(500).json({ error: 'Failed to record payment.' });
  }
});

// Delete invoice
app.delete('/api/invoices/:id', authMiddleware, (req, res) => {
  try {
    const userId = req.userId;
    const invId = req.params.id;

    const delStmt = db.prepare('DELETE FROM invoices WHERE id = ? AND user_id = ?');
    const result = delStmt.run(invId, userId);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Invoice not found or already deleted.' });
    }

    res.json({ message: 'Invoice deleted successfully!' });
  } catch (err) {
    console.error('Delete invoice error:', err);
    res.status(500).json({ error: 'Failed to delete invoice.' });
  }
});

// Export CSV
app.get('/api/export/csv', authMiddleware, (req, res) => {
  try {
    const invoices = db.prepare('SELECT invoice_number, invoice_date, service_date, client_name, client_phone, client_email, total_amount, advance_paid, balance_due, status FROM invoices WHERE user_id = ? ORDER BY invoice_date DESC').all(req.userId);

    const header = ['Invoice Number', 'Invoice Date', 'Service Date', 'Client Name', 'Phone', 'Email', 'Total Amount (INR)', 'Advance Paid (INR)', 'Balance Due (INR)', 'Status'];
    const rows = invoices.map(i => [
      `"${i.invoice_number}"`,
      `"${i.invoice_date}"`,
      `"${i.service_date || ''}"`,
      `"${(i.client_name || '').replace(/"/g, '""')}"`,
      `"${i.client_phone || ''}"`,
      `"${i.client_email || ''}"`,
      i.total_amount,
      i.advance_paid,
      i.balance_due,
      `"${i.status}"`
    ]);

    const csvContent = [header.join(','), ...rows.map(r => r.join(','))].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=invoices_${req.user.username}_${new Date().toISOString().split('T')[0]}.csv`);
    res.send(csvContent);
  } catch (err) {
    res.status(500).send('Export failed');
  }
});

// SPA fallback (compatible with Express 5)
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

async function startServer() {
  await db.initDb();
  const HOST = '0.0.0.0';
  app.listen(PORT, HOST, () => {
    console.log(`=======================================================`);
    console.log(`🌸 Bridal Billing Studio is running!`);
    console.log(`🌐 Host: ${HOST} | Port: ${PORT}`);
    console.log(`=======================================================`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
