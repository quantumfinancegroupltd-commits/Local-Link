# Getting https://locallink.agency/ to its best

Checklist to run the live site at its best. Do these in order.

---

## 1. Production database

- [ ] **Get the real production `DATABASE_URL`**  
  From your host: Supabase (Project → Settings → Database → Connection string), Railway, Render, or wherever the live API’s DB is. Use the **pooler** URL if you have one (e.g. Supabase port 5432 pooler).

- [ ] **Run migrations on production (from your Mac)**  
  Replace the placeholder with your actual URL (no `USER`, `PASSWORD`, or `postgres.xxxx` placeholders):

  ```bash
  cd backend
  DATABASE_URL="postgresql://postgres.PROJECT_REF:YOUR_DB_PASSWORD@HOST:5432/postgres" npm run migrate
  ```

  When it prints “Migrations complete.”, the live DB has the latest schema (feature flags, jobs scheduling, artisan job_categories, etc.).

---

## 2. Backend (API) env vars

On the platform that runs the Node API for locallink.agency, set:

| Variable | Required | Notes |
|----------|----------|--------|
| `DATABASE_URL` | Yes | Same URL you used for migrate. |
| `NODE_ENV` | Yes | Set to `production`. |
| `JWT_SECRET` | Yes | Strong random string (not `dev_secret_change_me`). |
| `CORS_ORIGINS` | Yes | `https://locallink.agency` (add `https://www.locallink.agency` if you use www). |
| `ADMIN_BOOTSTRAP_SECRET` | Yes | Strong secret for admin bootstrap (not a placeholder). |
| `APP_BASE_URL` | Recommended | `https://locallink.agency` (for payment redirects, reset-password links). |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_FROM` | For password reset | Without these, “forgot password” says “email sent” but no email is delivered. Use a transactional provider (SendGrid, Mailgun, Resend, SES) or your mail server; see `backend/.env.example`. |
| `SENTRY_DSN` | Optional | For error tracking. |
| `PAYSTACK_SECRET_KEY` | When using Paystack | For escrow payments. |

Redeploy or restart the API after changing env vars.

---

## 3. Frontend build (API URL)

The frontend calls the API using `VITE_API_BASE_URL` **at build time**.

- **If the API is on the same domain as the site** (e.g. locallink.agency with `/api` proxied to the backend):  
  You can leave `VITE_API_BASE_URL` unset so it defaults to `/api`.

- **If the API is on a different URL** (e.g. `https://api.locallink.agency`):  
  Set when building:

  ```bash
  cd frontend
  VITE_API_BASE_URL=https://api.locallink.agency/api npm run build
  ```

  Your host (Vercel, Netlify, etc.) may let you set `VITE_API_BASE_URL` in the dashboard so every build uses it.

---

## 4. Deploy

- [ ] **Backend:** Deploy the backend (push to main if auto-deploy is on, or trigger a deploy). Ensure it uses the production env vars above and the same `DATABASE_URL` you used for migrate.

- [ ] **Frontend:** Deploy the frontend so https://locallink.agency serves the latest build (with `VITE_API_BASE_URL` set if needed).

- [ ] **Verify:**  
  - `GET https://your-api-url/api/health` → `{ "ok": true }`  
  - `GET https://your-api-url/api/ready` → `{ "ok": true }` (checks DB).  
  - Open https://locallink.agency/ and confirm: Events & Domestic are clickable, Register shows updated roles, and you can log in.

---

## 5. Optional (best level)

- **Sentry:** Set `SENTRY_DSN` on the backend (and optionally frontend) for error tracking.
- **Admin:** Create an admin user via bootstrap (see backend README) and use Admin → Flags to turn verticals on/off.
- **Paystack:** When you’re ready for live payments, set `PAYSTACK_SECRET_KEY` and webhook URL in Paystack dashboard.

---

## Quick reference: run from home

```bash
# 1. Push latest code (triggers deploy if connected)
cd /Users/richardholland/Desktop/LocalLink
git add -A && git commit -m "Your message" && git push origin main

# 2. Run migrations on production DB (use real URL)
cd backend
DATABASE_URL="postgresql://..." npm run migrate

# 3. Restart API if it doesn’t auto-restart; then check
curl -s https://your-api-url/api/health
curl -s https://your-api-url/api/ready
```

After 1–4, https://locallink.agency/ is in strong production shape. Step 5 gets it to “best.”
