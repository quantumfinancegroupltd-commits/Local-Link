# Where is the data?

All data the admin dashboard (and the rest of the app) shows comes from **one place**: the **Postgres database** the backend is connected to.

## What happened to last week’s analytics (e.g. Countries: UK, Ghana, ZA)?

The **Countries** card (and all traffic analytics) comes from the **`analytics_events`** table in that same Postgres database. Each time someone loads a page, the frontend calls `POST /api/analytics/track` and the backend inserts a row with `country` set from the visitor’s IP (geoip-lite). The Admin “Countries” view is just a count of those rows by `country` for the last N days.

**If you used to see UK, Ghana, South Africa (ZA) and now you see no countries, the rows that represented that traffic are no longer in the database the API is using.** Nothing in the LocalLink codebase deletes or truncates `analytics_events`; the app only inserts. So in practice one of these happened:

1. **The API was switched to a different database**  
   The server’s `DATABASE_URL` was changed (e.g. new deploy, new Supabase project, or env change). The **current** database is empty or new; the **old** database still has the UK/Ghana/ZA data, but the app is no longer connected to it.

2. **The database was replaced or reset**  
   The same Postgres instance was recreated, restored from an older backup (without analytics), or reset (e.g. “Reset project” in Supabase). That wipes all tables, including `analytics_events`.

**What you can do:**

- **Get the data back:** Point the production API back at the database that had last week’s data (if you still have its connection string and it’s intact). That restores all app data, including analytics.
- **Confirm which DB you’re using:** On the server that runs the API, check the value of `DATABASE_URL`. Compare it to any previous config or Supabase project URL; if it’s different, that explains the “missing” data.
- **If the old database is gone:** There is no way to recover that analytics data unless you have a backup of that database. Going forward, new traffic will fill `analytics_events` again (and Countries will repopulate as visitors hit the site).

---

## Investigating whether you need to restore data

Use the **data audit** to see row counts and date ranges for key tables. That tells you if the connected DB has data and how recent it is.

### Option 1: Admin dashboard (when logged in as admin)

1. Open **Admin → Overview**.
2. Scroll to the **“Data audit — restore check”** card.
3. Check the table: **Rows**, **Earliest**, **Latest** for each entity (e.g. `analytics_events`, `users`, `orders`).
4. If **analytics_events** has 0 rows or a **Latest** date older than when you last had traffic, the API is likely pointed at a different or reset DB — consider restoring or re-pointing `DATABASE_URL` at the DB that had the data.

### Option 2: Data-audit API (with admin token)

```bash
curl -s -H "Authorization: Bearer YOUR_ADMIN_JWT" "https://locallink.agency/api/admin/data-audit"
```

Returns JSON with `tables`: for each table, `rows`, `earliest`, `latest`. Same interpretation as above.

### Option 3: CLI script (against any DB, no API)

Run the script against the database you care about. **Use your real connection string** (from the server’s env or Supabase dashboard), not the placeholder `...`.

From the **repo root**:

```bash
cd backend
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DATABASE" node scripts/data-audit.js
```

If you’re already in the `backend` folder, omit the `cd backend`:

```bash
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DATABASE" node scripts/data-audit.js
```

Replace `USER`, `PASSWORD`, `HOST`, and `DATABASE` with your actual Postgres details (e.g. from Supabase: Project Settings → Database → Connection string). The script prints a text table of counts and date ranges. Use it to compare two databases (e.g. current production vs a backup) or to confirm the production DB has no/old data before restoring.

## How it works

1. **Backend** (Node API) connects to Postgres using the `DATABASE_URL` environment variable (see `backend/src/db/pool.js`).
2. When you open **https://locallink.agency** and log in as admin, the browser sends requests to `/api/...` on the same domain. That is served by the **production** backend (e.g. in Docker as `api:4000`).
3. So the data you see in Admin is whatever is in the database that **production**’s `DATABASE_URL` points to.

## If admin shows “no data” or empty lists

Then the database that the **running API** is using has little or no data. Common causes:

1. **New or different database**  
   Production was pointed at a new Postgres instance (e.g. new Supabase project, new RDS). New DB = empty tables (except migrations + bootstrap admin).

2. **Database was reset**  
   Migrations were run on a fresh DB, or a backup was restored from an empty state.

3. **Wrong environment**  
   If you’re testing **locally**, your local backend uses the `DATABASE_URL` from your **local** `.env`. So you’d see whatever is in that DB (often empty or demo-only), not production data.

## How to verify

1. **Confirm which DB production uses**  
   On the server that runs the API (e.g. EC2, Docker host), check the environment for `DATABASE_URL`. That’s the database Admin is reading from when you use the live site.

2. **Check data summary in Admin**  
   In the Admin dashboard, open the **System / status** (or equivalent) view. The API now returns a `data_summary` with row counts (`users`, `jobs`, `orders`, `products`). If those are all 0 (or very low), the connected DB is effectively empty.

3. **Same URL, same DB**  
   As long as you use **https://locallink.agency** (and don’t change the backend’s `DATABASE_URL`), you’re always looking at the same database. Data isn’t “lost” to another server—it’s either in that DB or that DB was replaced/emptied.

## Restoring or seeding data

- **Demo users (e.g. Ghana2025!)**  
  Seed the **same** database the production API uses:

  ```bash
  cd backend
  DATABASE_URL="<production-database-url>" node scripts/seed-demo-users.js
  ```

  Use the **exact** `DATABASE_URL` that the production backend uses (from the server env or your hosting dashboard). Never point production at a local DB.

- **First admin only**  
  If there are no admin users, create one with the bootstrap endpoint (see `SELF_HOSTING.md` / `docs/ENV_VARS.md`).

- **Backups**  
  Restore from a backup of the **same** Postgres instance (or the one you intend to set as `DATABASE_URL`) if you need to recover previously existing data.

---

## Supabase shows “No tables in schema” / empty public schema

If the **Table Editor** shows “The public schema doesn’t have any tables”, the database has no LocalLink schema yet. Create it by running migrations from your machine against that database.

1. **Get your Supabase connection string**  
   Supabase → your project → **Settings** → **Database** → Connection string (URI). Replace `[YOUR-PASSWORD]` with your database password.

2. **Run migrations** (from the repo, in the `backend` folder):

   ```bash
   cd backend
   DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@db.bjrxwtvceihqykkwzxku.supabase.co:5432/postgres" npm run migrate
   ```

   Use your real password and host (your project may have a different host). This creates all LocalLink tables (users, jobs, orders, analytics_events, etc.).

3. **Create the first admin** (bootstrap). Start your API with that `DATABASE_URL` and `ADMIN_BOOTSTRAP_SECRET` set, then:

   ```bash
   curl -X POST https://locallink.agency/api/bootstrap/admin -H "Content-Type: application/json" -d '{"secret":"YOUR_ADMIN_BOOTSTRAP_SECRET","name":"Admin","email":"admin@locallink.agency","password":"YourSecurePassword"}'
   ```

   (Use your actual API URL and secret.) Then you can log in at `/admin/login`.

4. **Optional: seed demo users** (demo logins with password `Ghana2025!`):

   ```bash
   DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@db.bjrxwtvceihqykkwzxku.supabase.co:5432/postgres" node scripts/seed-demo-users.js
   ```

After step 2, Supabase Table Editor will show all tables; after 3 you can log in as admin; after 4 you can use the demo accounts.

---

## Server-side: where the API points (DATABASE_URL) and fixing admin email

### Where the server gets its database URL

On the **server** that runs locallink.agency (e.g. EC2), the API and worker read the database URL from a **`.env` file** in the same directory as `docker-compose.selfhost.yml`:

- **Path:** `~/LocalLink/.env` (or wherever you run docker compose from).
- **Variable:** `DATABASE_URL`

So:

- If `DATABASE_URL` is **not** set in that `.env`, the app uses the default: the **local Docker Postgres** (`postgresql://locallink:locallink@db:5432/locallink`). That’s a database inside the server; if you never ran migrations or seed there, it can be empty or old.
- If `DATABASE_URL` **is** set (e.g. to a Supabase URI), the app uses **that** database. So “where the data went” = whatever database that URL points at (and whether that DB was reset or replaced).

To **point the app back** at the database that had your data:

1. SSH to the server.
2. Open `~/LocalLink/.env` and set `DATABASE_URL` to the **connection string of the database you want** (e.g. the Supabase project that had UK/Ghana/ZA analytics). If you don’t have that URL anymore (e.g. old project deleted), you can’t point back to it.
3. Restart the API and worker so they pick up the new env:
   ```bash
   cd ~/LocalLink && docker compose -f docker-compose.selfhost.yml up -d api worker
   ```
4. Optionally run the data-audit script **with that same URL** from your Mac to confirm the DB has data:
   ```bash
   DATABASE_URL="postgresql://..." node scripts/data-audit.js
   ```

### Logging in with admin@locallink.agency instead of the Gmail address

If the admin user in the database was created with **locallinkagencygh@gmail.com** and you want to log in with **admin@locallink.agency**:

1. Run the one-off script against the **same** database the API uses (use the same `DATABASE_URL` as on the server, or run on the server after `cd ~/LocalLink/backend` and using the same `.env`):
   ```bash
   cd backend
   DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@db.bjrxwtvceihqykkwzxku.supabase.co:5432/postgres" node scripts/update-admin-email.js
   ```
   That updates the admin user’s email to **admin@locallink.agency**. The password stays the same.

2. Log in at **https://locallink.agency/admin/login** with **admin@locallink.agency** and your existing password.

To use a different “old” or “new” email, set env before running the script:

```bash
OLD_EMAIL=locallinkagencygh@gmail.com NEW_EMAIL=admin@locallink.agency DATABASE_URL="postgresql://..." node scripts/update-admin-email.js
```
