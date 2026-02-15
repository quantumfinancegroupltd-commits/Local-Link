# LocalLink Frontend E2E (Playwright)

## Run locally

1. **Stop anything on port 4000** (e.g. diag stack), so the dev backend can bind:
   ```bash
   docker compose -f docker-compose.diag.yml down
   ```

2. **Start backend** (port 4000, dev mode = permissive CORS):
   ```bash
   cd backend
   ADMIN_BOOTSTRAP_SECRET=dev_only_change_me DATABASE_URL=postgresql://locallink:locallink@127.0.0.1:5433/locallink npm run dev
   ```

3. **Start frontend** (optional — Playwright can start it via webServer):

   ```bash
   cd frontend
   npm run dev
   ```
   If frontend runs on a different port (e.g. 5176), run e2e with: `E2E_BASE_URL=http://localhost:5176 npm run e2e`

4. **Install Playwright browsers** (once per machine):

   ```bash
   cd frontend
   npm run e2e:install
   ```

5. **Run tests**:

   ```bash
   cd frontend
   npm run e2e
   ```

   Default base URL: `http://localhost:5173`. Override: `E2E_BASE_URL=http://localhost:8080 npm run e2e`

## Run against production

```bash
cd frontend
E2E_BASE_URL="https://locallink.agency" npm run e2e
```

Notes:
- Tests create their own disposable users via `/api/register`.
- Payment flows (Paystack redirect) are intentionally not executed here.


