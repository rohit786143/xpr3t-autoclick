# AutoClick Engine — Next.js + Prisma (SQLite) + Playwright 24h Automation

A full-stack Next.js 14 web application with Tailwind CSS, Prisma (SQLite), and Playwright for managing user accounts and running automated 24-hour background click routines with persistent per-user browser profiles (`user_data_dir`).

---

## Project Architecture

```text
├── app/
│   ├── admin/
│   │   ├── login/page.tsx         # Admin Login UI (/admin/login)
│   │   └── dashboard/page.tsx     # Admin Management Panel (/admin/dashboard)
│   ├── demo-target/page.tsx       # Built-in simulated target portal for testing
│   ├── api/
│   │   ├── auth/login/route.ts    # Admin authentication (bcrypt + JWT cookie)
│   │   ├── auth/logout/route.ts   # Clear admin session
│   │   ├── users/route.ts         # List all users & create new user
│   │   ├── users/[id]/route.ts    # Update or delete user & clean up session dir
│   │   ├── users/[id]/trigger/    # Manually trigger/test Playwright bot for 1 user
│   │   └── worker/run-all/        # Trigger batch run for all active users
├── lib/
│   ├── db/index.ts                # Prisma SQLite client singleton
│   ├── auth.ts                    # JWT session signing & verification (jose)
│   └── crypto.ts                  # bcrypt hashing & AES-256-GCM credential encryption
├── prisma/
│   ├── schema.prisma              # User, Admin, and RunLog models
│   └── seed.ts                    # Seeds default admin & sample demo user
├── workers/
│   └── bot.ts                     # Playwright worker (persistent user_data_dir & 24h loop)
├── middleware.ts                  # Route protection for /admin/* and /api/*
└── .env                           # Environment configuration
```

---

## Environment Variables (`.env`)

```env
# SQLite Database URL
DATABASE_URL="file:./dev.db"

# JWT Secret for Admin Authentication
JWT_SECRET="super-secret-autoclick-jwt-key-2026-secure"

# AES-256-GCM Secret for Target Site Credentials
ENCRYPTION_SECRET="autoclick-aes-256-gcm-secret-key-2026"

# Default Admin Credentials
ADMIN_USERNAME="admin"
ADMIN_PASSWORD="AdminPassword123!"

# Playwright Worker Settings
PLAYWRIGHT_HEADLESS="true"
USER_DATA_BASE_DIR="./.playwright-sessions"
WORKER_INTERVAL_HOURS="24"
```

---

## Setup & Installation

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Install Playwright Chromium browser (if not already installed):**
   ```bash
   npx playwright install chromium
   ```

3. **Initialize SQLite database and seed default Admin & Demo User:**
   ```bash
   npm run db:push
   npm run db:seed
   ```

4. **Start the Next.js Web Application:**
   ```bash
   npm run dev
   ```
   - Open `http://localhost:3000/admin/login`
   - Sign in with `admin` / `AdminPassword123!`

5. **Start the 24-Hour Background Playwright Worker:**
   ```bash
   # Continuous 24-hour background loop:
   npm run worker

   # Or run a single pass over all active users and exit:
   npm run worker:once
   ```

