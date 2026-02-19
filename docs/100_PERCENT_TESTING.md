# 100% testing — critical paths and regression

This doc is the single place for **full** critical-path and regression coverage: API smoke (including quote/escrow/farmer), Playwright E2E, manual UAT, and CI.

---

## 1. Full API smoke (quote + escrow + farmer product)

Run the smoke script with an admin token so the script can mark test users as ID-verified and the full quote/escrow and farmer-product flows run (no skips).

**Get an admin token:** bootstrap once (if no admin exists) or log in as admin.

```bash
# Production
SMOKE_FULL=1 SMOKE_ADMIN_TOKEN='<admin_jwt>' BASE_URL=https://locallink.agency ./scripts/smoke-test.sh

# Local API (e.g. after starting backend on 4000)
SMOKE_FULL=1 SMOKE_ADMIN_TOKEN='<admin_jwt>' BASE_URL=http://localhost:4000 ./scripts/smoke-test.sh
```

**Bootstrap admin (first time only):**  
`POST /api/bootstrap/admin` with body `{ "secret": "<ADMIN_BOOTSTRAP_SECRET>", "name", "email", "password" }`.  
If admin already exists (409), use normal login to get a token.

**Delete smoke test users after the run:** Set `SMOKE_CLEANUP=1` (with `SMOKE_ADMIN_TOKEN`). The script soft-deletes the buyer, artisan, farmer, and company users it created so production doesn’t accumulate test accounts.

```bash
SMOKE_FULL=1 SMOKE_CLEANUP=1 SMOKE_ADMIN_TOKEN='<admin_jwt>' BASE_URL=https://locallink.agency ./scripts/smoke-test.sh
```

**Remove "Smoke Test Ltd" companies and their roles from the DB (one-off):** On the server, the most reliable way is via the DB container (no .env or host psql needed): `cd ~/LocalLink && docker compose -f docker-compose.selfhost.yml exec db psql -U locallink -d locallink -c "delete from companies where name = 'Smoke Test Ltd';"` (adjust `-U`/`-d` if your DB user/database differ). Alternatively: Node script in API container after `build api`, or `psql "$DATABASE_URL" -f scripts/delete-smoke-test-company.sql` if DATABASE_URL is set on the host.

---

## 2. Playwright E2E (Mac)

Run on your Mac (backend on 4000, frontend on 5173 or set `E2E_BASE_URL`):

```bash
cd frontend && npm run e2e:install   # once
cd frontend && npm run e2e
```

Or from repo root:  
`RUN_E2E=1 BASE_URL=http://localhost:8080 ./scripts/run-all-tests.sh`  
(E2E is skipped on environments without `npm`, e.g. server.)

---

## 3. Manual UAT checklist

Follow [E2E_UAT_CHECKLIST.md](./E2E_UAT_CHECKLIST.md) in order: public pages, buyer, artisan, farmer, driver, company (employer), admin. Use [SEED_DEMO_LOGINS.md](./SEED_DEMO_LOGINS.md) for demo accounts if seeded.

---

## 4. CI (GitHub Actions)

`.github/workflows/ci.yml` runs:

- **Backend** unit tests  
- **Frontend** build  
- **Smoke** job: Postgres + migrations + API, bootstrap admin (or login), then **full** smoke test (`SMOKE_FULL=1` + `SMOKE_ADMIN_TOKEN`) so quote/escrow and farmer product are exercised in CI.

Playwright E2E is not run in CI; run it locally for UI regression.

---

## Quick reference

| Goal              | Command / action |
|-------------------|------------------|
| Full smoke local  | `SMOKE_FULL=1 SMOKE_ADMIN_TOKEN=<token> BASE_URL=http://localhost:4000 ./scripts/smoke-test.sh` |
| Full smoke prod   | `SMOKE_FULL=1 SMOKE_ADMIN_TOKEN=<token> BASE_URL=https://locallink.agency ./scripts/smoke-test.sh` |
| E2E (Mac)         | `cd frontend && npm run e2e` or `RUN_E2E=1 ./scripts/run-all-tests.sh` |
| Manual UAT        | [E2E_UAT_CHECKLIST.md](./E2E_UAT_CHECKLIST.md) |
| CI                | Push/PR → backend tests, frontend build, full smoke job |

For more detail (prerequisites, run order, what each test covers), see [TESTING.md](./TESTING.md).
