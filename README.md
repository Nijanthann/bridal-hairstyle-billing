# 🌸 Bridal Billing Studio with Multi-User Authentication

A full-stack professional billing and invoice studio tailored specifically for bridal hairstylists, makeup artists, and event service businesses.

---

## 🌟 Key Features

### 1. 👥 Multi-User Authentication & Separate Logins
- Each user (stylist/studio owner) has their own **isolated credentials and database records**.
- Invoices created by User A are **never visible** to User B.
- Includes pre-configured demo accounts for instant 1-click testing:
  - **User 1 (Deepz Hairstylist)**: `deepa` / `password123`
  - **User 2 (Ananya Bridal Studio)**: `ananya` / `password123`
- Full **Sign Up / Registration** to create unlimited new user accounts.

### 2. 📊 Executive Financial Dashboard
- **Key Financial Metrics**:
  - **Total Billed**: Total revenue across all client events.
  - **Received (Advance/Paid)**: Actual funds collected in bank/cash.
  - **Balance Due (Pending)**: Outstanding receivables from clients.
  - **Invoices Issued**: Total count, with status breakdown (Paid, Partially Paid, Unpaid).
- **Collection Progress Bar**: Visual percentage breakdown of received vs. pending payments.
- **Recent Invoices**: Quick preview and instant settlement actions.

### 3. 📑 Invoices Management Module
- View all past billing records stored in SQLite database.
- **Status Tabs**: Filter by `All Invoices`, `Paid`, `Partially Paid`, `Unpaid`.
- **Real-Time Search**: Search instantly by Invoice #, Bride Name, Venue, or Phone number.
- **Sorting Options**: Sort by date (newest/oldest) or total amount (high/low).
- **Row Actions**:
  - **Record Payment**: Settle full balance or partial payment with notes.
  - **View & Edit**: Load existing invoice back into the live editor to modify lines or rates.
  - **Duplicate**: Clone an existing invoice for a new booking in one click.
  - **Print / PDF**: Direct print or PDF export with A4 portrait styling.
  - **WhatsApp Share**: Direct WhatsApp message generation with prefilled balance & payment info.
  - **Delete**: Remove invoice with confirmation.
  - **Export CSV**: Download a spreadsheet of all invoices for accounting.

### 4. ✍️ Luxury Bridal Invoice Studio & Live A4 Preview
- High-fidelity A4 paper layout with luxury gold and stone typography.
- Auto-generates sequential invoice numbers based on your custom prefix (e.g., `BH-001`, `ABS-001`).
- Dynamic line item addition, removal, quantity, and rate calculation.
- **Dynamic UPI QR Code**: Uses your UPI ID to encode the exact balance due into a scannable QR code.
- Bank transfer & IFSC details, terms & conditions, and Instagram link.

### 5. ⚙️ Studio & UPI Settings
- Customize your business name, phone, address, tagline, Instagram handle.
- Set bank account details and UPI ID.
- Set custom invoice prefix.

---

## 🚀 How to Run

1. Open a terminal in this directory:
   ```bash
   cd C:\Users\admin\.gemini\antigravity-ide\scratch\zoho-bridal-billing
   ```
2. Start the server:
   ```bash
   npm start
   ```
   *(Or double-click `start.bat`)*

3. Open your browser and go to:
   ```
   http://localhost:3000
   ```

---

## 🔐 Demo Credentials
| Name | Username | Password | Studio |
| :--- | :--- | :--- | :--- |
| **Deeparubini P** | `deepa` | `password123` | Deepz Hairstylist |
| **Ananya Sharma** | `ananya` | `password123` | Ananya Bridal Studio |
