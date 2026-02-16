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
   # Edit .env: set DATABASE_URL, e.g.:
   # DATABASE_URL=postgresql://YOUR_MAC_USER@localhost:5432/locallink
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

## Troubleshooting

- **Port 4000 in use:** `lsof -ti :4000 | xargs kill`
- **Database "does not exist":** Create it with `createdb locallink` and set `DATABASE_URL` in `.env`.
- **"role postgres does not exist":** On Mac, use your system username in the URL, e.g. `postgresql://richardholland@localhost:5432/locallink`.
