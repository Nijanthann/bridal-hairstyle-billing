# Complete Guide: Hosting on Render

This project is fully configured and ready for 1-click deployment to **[Render.com](https://render.com)**.

---

## Included Render Configurations

- **`render.yaml`**: Pre-configured Render Blueprint with build/start commands and auto-generated JWT secrets.
- **`.node-version`**: Pinned to Node `22.12.0` (required for Node's high-speed native SQLite database).
- **`package.json`**: Configured with `"engines": { "node": ">=22.5.0" }`, `"start": "node server.js"`, and `"build": "npm install"`.
- **`server.js`**: Bound to `0.0.0.0` and dynamic cloud `PORT` (e.g. 10000 on Render).
- **`db.js`**: Auto-creates directories and database on startup, supporting optional Render Disks via `DATABASE_PATH`.

---

## Step 1: Push Project to GitHub

Your code is already committed to git on the `main` branch. To push it to your GitHub repository:

### Option A: Using GitHub CLI (Fastest)
1. In your terminal, grant write access:
   ```bash
   gh auth refresh -s repo
   ```
   *(A browser window will open — click **Authorize**)*
2. Push your code:
   ```bash
   git push -u origin main --force
   ```

### Option B: Using Personal Access Token or VS Code
1. In the VS Code / Antigravity IDE left sidebar, click the **Source Control** icon (branch icon).
2. Click **Publish Branch** or **Sync Changes** to push directly to GitHub.
3. Or update your GitHub Personal Access Token at [github.com/settings/tokens](https://github.com/settings/tokens) with `repo` scope.

---

## Step 2: Deploy on Render

1. Log in or create a free account at **[dashboard.render.com](https://dashboard.render.com/)**.
2. Click the blue **New +** button in the top right and select **Web Service**.
3. Choose **Build and deploy from a Git repository**.
4. Connect your GitHub account and select your repository:
   - `bridal-hairstyle-billing` (or your chosen repository name).
5. Fill in the deployment settings:
   - **Name**: `bridal-billing-studio` (or any custom name)
   - **Region**: Closest to your users (e.g., `Singapore` or `Frankfurt` or `Oregon`)
   - **Branch**: `main`
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: `Free`
6. Scroll down to **Environment Variables** and add:
   | Key | Value | Notes |
   | :--- | :--- | :--- |
   | `NODE_VERSION` | `22.12.0` | **Mandatory** for Node native SQLite |
   | `JWT_SECRET` | *(Any random 32-character string)* | For securing user sessions |
7. Click **Deploy Web Service**!

---

## Step 3: Deployment Verification

Render will build and deploy your service in about 1–2 minutes. You will see build logs like:
```text
==> Running build command 'npm install'...
==> Starting service with 'npm start'...
Bridal Billing Studio is running!
Host: 0.0.0.0 | Port: 10000
==> Your service is live at https://bridal-billing-studio.onrender.com
```

You can now open your live URL on your phone, tablet, or laptop and share it with your team!

---

## Step 4: Optional Email Verification Setup (SMTP)

For password reset verification codes, the system works out-of-the-box in demo mode. To deliver real verification emails to users' inboxes, add these environment variables in your Render Dashboard under **Environment Variables**:

| Variable | Example Value | Description |
| :--- | :--- | :--- |
| `SMTP_HOST` | `smtp.gmail.com` or `smtp.sendgrid.net` | Your SMTP mail server |
| `SMTP_PORT` | `587` | Port (587 for TLS, 465 for SSL) |
| `SMTP_USER` | `yourstudio@gmail.com` | Email address or API username |
| `SMTP_PASS` | `abcd efgh ijkl mnop` | Google App Password or SMTP key |
| `SMTP_FROM` | `"Bridal Billing" <yourstudio@gmail.com>` | Sender display name and email |

> If using Gmail, generate an **App Password** in your Google Account Security settings (under 2-Step Verification -> App Passwords).

---

## Optional: Persistent Storage (Render Disk)

On Render's Free tier, the SQLite database will reset if the web service restarts due to inactivity. If you want invoices to persist permanently without resetting:

1. In your Render Dashboard, click your Web Service.
2. Go to **Disks** in the left menu.
3. Click **Add Disk**:
   - **Name**: `billing-data`
   - **Mount Path**: `/var/data`
   - **Size**: `1 GB` (or more)
4. In **Environment Variables**, add:
   - `DATABASE_PATH`: `/var/data/bridal_billing.db`
5. Click **Save Changes**. The server will automatically use the persistent disk for SQLite!
