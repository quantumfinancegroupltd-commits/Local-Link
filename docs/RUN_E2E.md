# Run E2E Tests — Step by Step

## Problem summary

- **403 on register/bootstrap**: The API on port 4000 is in production mode (e.g. from `docker-compose.diag.yml`). Production CORS only allows specific origins; Playwright hits `http://localhost:5173` (or 5176), which is rejected.
- **Port 4000 in use**: Another process (often diag stack) is using it. The dev backend cannot start.
- **Port mismatch**: Playwright expects frontend on 5173, but Vite may start on 5176 if 5173–5175 are busy.

## Fix: run dev stack only

### 1. Stop anything using port 4000

```bash
cd ~/Desktop/LocalLink
docker compose -f docker-compose.diag.yml down
```

Or, if diag wasn’t used, find and stop what’s on 4000:

```bash
lsof -i :4000
# Kill the PID shown
kill <PID>
```

### 2. Ensure Postgres is running (for dev)

```bash
cd ~/Desktop/LocalLink
docker compose up -d
```

### 3. Start backend (development mode = permissive CORS)

```bash
cd ~/Desktop/LocalLink/backend
ADMIN_BOOTSTRAP_SECRET=dev_only_change_me DATABASE_URL=postgresql://locallink:locallink@127.0.0.1:5433/locallink npm run dev
```

Leave this running in its own terminal.

### 4. Run E2E tests

In a new terminal:

```bash
cd ~/Desktop/LocalLink/frontend
npm run e2e
```

- If you started the frontend manually, use:  
  `E2E_BASE_URL=http://localhost:5176 npm run e2e`  
  (replace 5176 with the actual port Vite shows)
- If you didn’t start the frontend, Playwright will start it via `webServer`.

### 5. Optional: API smoke test

```bash
cd ~/Desktop/LocalLink/backend
npm run api-smoke
```

## One-line summary

1. `docker compose -f docker-compose.diag.yml down`
2. `docker compose up -d`
3. Backend: `cd backend && ADMIN_BOOTSTRAP_SECRET=dev_only_change_me DATABASE_URL=postgresql://locallink:locallink@127.0.0.1:5433/locallink npm run dev`
4. E2E: `cd frontend && npm run e2e`
