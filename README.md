# Aarav Traders – Load Accounts

A mobile-first Progressive Web App (PWA) built specifically for a 3-partner coal and briquette trading firm in India.

The application allows all 3 partners to track truck loads, purchases, freight, sales, shortage, profit, and party ledger balances in real-time on their mobile phones with zero lag.

---

## Architecture & Tech Stack

- **Frontend & Runtime:** React 19, TypeScript, Vite 8, TanStack Router, TanStack Query (with Supabase Realtime cache invalidation).
- **Styling & Design System:** Tailwind CSS v4 with custom **Clean Ledger** (light theme) and **Dark Industrial** (dark theme), 48px+ touch targets, native date pickers, numeric inputs, safe-area padding for mobile viewports.
- **Database & Backend:** Supabase Postgres.
  - **Authoritative SQL Views:** All financial calculations (Pre-GST purchase, GST, Freight, Sale, Profit, Shortage, Overdue flags, and Balances) are computed in database views (`load_details_view`, `monthly_reports_view`, `unsold_stock_view`, `party_balances_view`) using exact `numeric` types (no floating-point rounding errors).
  - **Integrity Triggers:** Database trigger `trg_validate_payment` (executing function `public.validate_payment_not_exceeding_bill()`) automatically rejects any payment that would cause total payments to exceed the bill total. Trigger `trg_validate_load_update` (executing `public.validate_load_update_not_below_paid()`) prevents editing load tons or rates below amounts already paid.
  - **Invite-Only Security:** Postgres trigger on `auth.users` checks `public.allowed_emails` before allowing partner access.
  - **Row Level Security (RLS):** Enabled across all tables and views, gating read and write access strictly to verified `firm_members`. Unauthenticated users and non-members receive zero rows. Hard deletes are prevented (soft-delete via `deleted_at`).
  - **Audit Logging:** Database triggers record old/new JSON snapshots and the acting user for every write operation in `public.audit_logs`.
- **Offline & PWA Support:** Installable web manifest (`public/manifest.webmanifest`), local draft autosave for the 3-step wizard, and offline write queue.

---

## Business Logic & Exact Formulas

Each **Load** represents one truck in three parts:

1. **Purchase:** Material (`coal` or `briquette`), supplier, tons bought, buy rate (₹/ton, ex-GST).
   - `purchase_amount = tons_bought × buy_rate`
   - `purchase_gst = purchase_amount × gst_rate` (Coal: 18%, Briquette: 5% from `settings`)
   - `purchase_total = purchase_amount + purchase_gst`
2. **Truck / Freight:** Transport agency, truck number, tons loaded (defaults to tons bought), freight rate (₹/ton).
   - `freight_amount = tons_loaded × freight_rate` (No GST on freight)
3. **Sale (Optional / Deferred):** Buyer, sale date, tons received (can be less than tons bought due to transit loss), sale rate (₹/ton, ex-GST), credit days (defaults to buyer's last used credit days or 30).
   - `due_date = sale_date + credit_days`
   - `sale_amount = tons_received × sale_rate`
   - `sale_gst = sale_amount × gst_rate`
   - `sale_total = sale_amount + sale_gst`
   - `profit = sale_amount - purchase_amount - freight_amount` (Pre-GST profit)
   - `profit_per_ton = profit ÷ tons_received`
   - `shortage_tons = tons_bought - tons_received`
4. **Payments & Ledger:**
   - 3 payment categories: `purchase` (to supplier), `freight` (to agency), `sale` (from buyer).
   - Modes: `UPI` or `Cheque` with reference numbers.
   - Pending balance: `bill_total - total_payments`.
   - Overdue: `sale pending > 0 AND due_date < CURRENT_DATE`.

---

## Test Cases (Automated Verification)

The core formulas and edge cases are validated with automated tests in `src/test/business-logic.test.ts`:

1. **Standard Load:** 22 t × ₹7,000 purchase (₹1,54,000) + 22 t × ₹1,600 freight (₹35,200) + 22 t × ₹9,000 sale (₹1,98,000) → **Profit: ₹8,800** (₹400/t).
2. **Transit Shortage:** Same load but 21.5 t received at destination → Sale: ₹1,93,500, Shortage: 0.5 t, **Profit: ₹4,300** (₹200/t).
3. **GST Differential:**
   - Briquette @ 5%: ₹1,54,000 purchase → GST ₹7,700, Total ₹1,61,700.
   - Coal @ 18%: ₹1,54,000 purchase → GST ₹27,720, Total ₹1,81,720.
4. **Security & RLS Isolation:** Validated in `src/test/rls-security.test.ts` to ensure logged-out users and non-members are completely blocked from read/write operations.

Run the test suite anytime:

```sh
npm test
```

---

## Environment Variables

Create a `.env` file in the project root:

```ini
# Supabase Project Connection
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your_anon_key

# Optional (Only for server-side scripts / CI migrations - NEVER expose to client):
# SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...
```

> **Security Note:** Never commit `SUPABASE_SERVICE_ROLE_KEY` to git or client code. Only `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` belong in client environment variables.

---

## Database Setup & Recreation

The entire database schema, views, triggers, and RLS policies can be recreated on any empty Supabase project using a single SQL file.

### Option A: Consolidated Script (Recommended for initial setup)

Open the **SQL Editor** in your Supabase dashboard and run the contents of:

```
supabase/schema.sql
```

### Option B: Versioned Migrations

If using the Supabase CLI:

```sh
supabase db push
```

Or review individual migration files in `supabase/migrations/`:

- `20261122000001_create_schema.sql` (Tables, constraints, soft-delete, indexes, Realtime publication)
- `20261122000002_create_triggers.sql` (Overpayment protection, audit logger, invite-only signup trigger)
- `20261122000003_create_views.sql` (Authoritative calculation views)
- `20261122000004_initial_config.sql` (Settings row: Coal 18%, Briquette 5%, 30 credit days)
- `20261122000005_create_rls_policies.sql` (Role-based policies for `firm_members`)

---

## Setting Up the Shared Partner Login in Supabase

Aarav Traders uses a single shared email + password login so all 3 partners share the same firm account, stay signed in on their phones, and view the same ledger in realtime.

Follow these 4 steps in your [Supabase Dashboard](https://supabase.com/dashboard):

### Step 1: Create the User Account

1. Open your Supabase Project Dashboard.
2. Go to **Authentication** (left sidebar) $\rightarrow$ **Users**.
3. Click the **"Add user"** button $\rightarrow$ select **"Create user"**.
4. In the dialog:
   - **Email:** Enter the shared firm email (e.g., `partners@aaravtraders.in` or your chosen email).
   - **Password:** Enter a strong, long password shared among the partners.
   - **Auto Confirm User:** Turn this toggle **ON** (so no email confirmation link is needed).
5. Click **"Create user"**.

### Step 2: Authorize the Email in Database (Whitelist & Firm Members)

Open the **SQL Editor** in Supabase and run this snippet to whitelist the email and ensure the user is an authorized firm member:

```sql
-- 1. Add shared email to the allowed_emails whitelist
INSERT INTO public.allowed_emails (email, role)
VALUES ('partners@aaravtraders.in', 'partner') -- replace with your actual email
ON CONFLICT (email) DO NOTHING;

-- 2. Fallback SQL: Link auth.users ID directly to firm_members
-- (Ensures membership is active even if the signup trigger was bypassed by manual admin creation)
INSERT INTO public.firm_members (user_id, email, role)
SELECT id, email, 'partner'
FROM auth.users
WHERE LOWER(email) = LOWER('partners@aaravtraders.in') -- replace with your actual email
ON CONFLICT (email) DO UPDATE
SET user_id = EXCLUDED.user_id, role = 'partner';
```

### Step 3: Turn OFF "Allow new users to sign up"

1. In the Supabase Dashboard, go to **Authentication** $\rightarrow$ **Configuration** (or **Settings** $\rightarrow$ **Auth Providers**).
2. Under **User Signups**, toggle **OFF** `"Allow new users to sign up"`.
3. Click **Save**.
   > **Why this matters:** Turning this setting off completely disables the public sign-up endpoint (`supabase.auth.signUp()`). No outsider or automated bot can create accounts on your project, even if they inspect your frontend code and find your project URL or public anon key. Only users explicitly created by you in the Supabase Dashboard can sign in.

### Step 4: How to Change the Password Later

If the partners ever need to rotate or change their password:

- **Method A (Supabase Dashboard):**
  1. Go to **Authentication** $\rightarrow$ **Users**.
  2. Click the three dots `...` next to the user $\rightarrow$ select **"Send password reset"** or click on the user and select **"Reset password"** / **"Generate new password"**.
- **Method B (Instant SQL in SQL Editor):**
  ```sql
  -- Instantly update password for the shared account
  UPDATE auth.users
  SET encrypted_password = crypt('YOUR_NEW_SECURE_PASSWORD_HERE', gen_salt('bf'))
  WHERE LOWER(email) = LOWER('partners@aaravtraders.in');
  ```

---

## Local Development

```sh
# 1. Install dependencies
npm install

# 2. Run automated tests
npm test

# 3. Type check & build
npx tsc --noEmit
npm run build

# 4. Start local development server
npm run dev
```

Visit `http://localhost:5173` on your browser or mobile phone (via local network IP).

---

## Deployment Guide (Vercel)

The application uses Vite with TanStack Start and Nitro configured specifically for Vercel deployment (`nitro: { preset: "vercel" }`).

### Step-by-Step Vercel Setup:

1. Push your repository to your GitHub account (or Git provider).
2. Go to the [Vercel Dashboard](https://vercel.com) and click **"Add New Project"**.
3. Import the `pixel-perfect-replica-21507b4e` repository.
4. In **Project Settings > Build & Development Settings**:
   - **Framework Preset**: **Other** (or Auto-detect)
   - **Build Command**: `npm run build`
   - **Output Directory**: **Leave Override OFF (Default / Blank)**. Do NOT override this field to `.vercel/output` or `dist`. Nitro's Vercel preset outputs directly to `.vercel/output` according to Vercel's Build Output API v3 standard, which Vercel's build engine automatically detects and deploys as serverless functions and static assets without requiring a manual output directory override.
5. In **Environment Variables**, add:
   - `VITE_SUPABASE_URL`: Your Supabase Project URL (e.g. `https://xxxx.supabase.co`)
   - `VITE_SUPABASE_PUBLISHABLE_KEY`: Your Supabase public anon key (`sb_publishable_...` or `eyJ...`)
   - _(Optional, for backend functions/scripts only - NEVER expose to client)_: `SUPABASE_SERVICE_ROLE_KEY`
6. Click **Deploy**. Vercel will build and deploy the serverless functions and static PWA assets.

---

## Final Manual Checklist for Lead Partner

Before handing off the app to all 3 partners, complete these steps in your Supabase & Vercel dashboards:

- [ ] **Run `supabase/schema.sql`** in your Supabase project's SQL Editor to create all tables, views, triggers, and RLS policies.
- [ ] **Run the Partner Emails SQL snippet** above to add the 3 partner email addresses into `allowed_emails`.
- [ ] **Configure Supabase Auth Settings**:
  - In **Authentication > Providers > Email**: Enable Email provider, choose "Confirm email" or OTP/Magic Link.
  - In **Authentication > URL Configuration**: Set **Site URL** to your Vercel production domain (e.g., `https://aarav-traders.vercel.app`). Add `http://localhost:5173/**` to **Redirect URLs** for local testing.
  - Disable third-party public signups (signups from emails not in `allowed_emails` will fail automatically).
- [ ] **Install as PWA**: On each partner's phone (Android Chrome or iOS Safari), open the site URL, tap the browser menu, and select **Add to Home Screen** to install the full-screen app.
- [ ] **Set up Custom Domain & SSL**: Map your firm's domain in Vercel DNS settings if desired.
- [ ] **Two-Phone Testing**: Follow the step-by-step test script in [TESTING.md](file:///d:/pixel-perfect-replica-21507b4e/TESTING.md) to verify real-time sync across devices.
