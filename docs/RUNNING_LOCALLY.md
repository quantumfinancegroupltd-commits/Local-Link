 # Running LocalLink locally

## Prerequisites

- Node 18+
- PostgreSQL (e.g. Homebrew: `brew install postgresql@14` then `brew services start postgresql@14`)

## One-time setup

1. **Create the database**
   ```bash
   createdb locallink
   ```
   (On Mac with default Postgres, your system user is usually allowed; otherwise use the postgres user.)

2. **Backend env**
   ```bash
   cd backend
   cp .env.example .env
   # Edit .env: replace USER in DATABASE_URL with your Mac username, e.g.:
   # DATABASE_URL=postgresql://richardholland@localhost:5432/locallink
   # (If you leave USER literally, you'll get: error: role "USER" does not exist)
   ```

3. **Run migrations**
   ```bash
   npm run migrate
   ```

4. **Install frontend deps** (if not done)
   ```bash
   cd ../frontend && npm install
   ```

## Run for development

**Terminal 1 — backend**
```bash
cd backend
npm run dev
```
API: http://localhost:4000 (loads `.env` automatically).

**Terminal 2 — frontend**
```bash
cd frontend
npm run dev
```
App: http://localhost:5173 (proxies `/api` to backend).

## Demo data (landing page products, services, jobs)

After migrations, seed demo users so the **landing page** shows sample products (Farmers & Florists), services (Provider services), and jobs (Employers — open roles):

```bash
cd backend
node scripts/seed-demo-users.js
```

Password for all demo logins: **Ghana2025!**

**Check that the APIs return data** (with backend and frontend running):

- Products: `curl -s http://localhost:5173/api/products` (or `http://localhost:4000/api/products` if calling backend directly)
- Services: `curl -s http://localhost:5173/api/marketplace/services`
- Jobs: `curl -s "http://localhost:5173/api/corporate/jobs?limit=5"`

Each should return a JSON array with at least one item. If they’re empty, re-run the seed and ensure it completes without errors.

**Production (e.g. locallink.agency):** Build the frontend with the API on the same origin (do **not** set `VITE_API_BASE_URL` to localhost). Use `/api` or leave unset so requests go to `https://locallink.agency/api/...`. Ensure Caddy (or your proxy) forwards `/api/*` to the backend, then run the seed on the server and reload the landing page.

## AI Assistant (optional)

The **LocalLink AI Assistant** (floating chat button and Support page “Ask LocalLink AI”) answers platform questions using OpenAI. To enable it:

1. Add to `backend/.env`: `OPENAI_API_KEY=sk-...` (from [OpenAI](https://platform.openai.com/api-keys)).
2. Restart the backend.

Without `OPENAI_API_KEY`, the assistant still appears but returns a message asking users to use Support or contact LocalLink.

## Troubleshooting

- **Port 4000 in use:** `lsof -ti :4000 | xargs kill`
- **Database "does not exist":** Create it with `createdb locallink` and set `DATABASE_URL` in `.env`.
- **"role postgres does not exist":** On Mac, use your system username in the URL, e.g. `postgresql://richardholland@localhost:5432/locallink`.
- **Landing page shows no products/services/jobs:** Run `node scripts/seed-demo-users.js` from `backend`, then verify the three API URLs above return arrays. Ensure the frontend was built with `VITE_API_BASE_URL` unset or `/api` so requests hit the same origin.