# LocalLink — Comprehensive Testing Guide

This document describes how to run **all** tests (API smoke, Playwright E2E, and manual UAT) and in what order for a full workflow check.

**Single-page 100% summary:** [100_PERCENT_TESTING.md](./100_PERCENT_TESTING.md) — full smoke command, Playwright, UAT checklist, CI.

---

## Quick reference

| Test type | Where to run | Command |
|-----------|--------------|--------|
| **API smoke** | Server or Mac (with API reachable) | `BASE_URL=https://locallink.agency ./scripts/smoke-test.sh` |
| **Playwright E2E** | Mac (backend on 4000, frontend on 5173 or use E2E_BASE_URL) | `cd frontend && npm run e2e` |
| **Manual UAT** | Browser | Follow [E2E_UAT_CHECKLIST.md](./E2E_UAT_CHECKLIST.md) |

---

## 1. Prerequisites

- **API smoke**: `curl`, `python3` (for `json_get`). API must be reachable at `$BASE_URL/api` (e.g. `https://locallink.agency/api` or `http://localhost:8080/api`).
- **Playwright E2E**: Node 20, backend running on port **4000**, frontend on **5173** (or set `E2E_BASE_URL` to your frontend URL). Browsers: `cd frontend && npm run e2e:install` (once per machine).

---

## 2. Recommended test run order (full workflow)

Do these in order for a release or pre–external-integration check.

### Step 1: API smoke test

Verifies health, auth, buyer job, company profile + job, and (when applicable) quote/escrow, farmer product, order.

**Against production:**

```bash
BASE_URL=https://locallink.agency ./scripts/smoke-test.sh
```

**Against local API (e.g. gateway on 8080):**

```bash
BASE_URL=http://localhost:8080 ./scripts/smoke-test.sh
```

**Expected:** `✅ Smoke test passed.`  
Note: Without an admin token, quote/escrow and farmer product may be skipped when ID verification is required; company flow always runs.

**Full smoke (quote + escrow + farmer product)** — use when you have an admin token (e.g. from bootstrap or login):

```bash
SMOKE_FULL=1 SMOKE_ADMIN_TOKEN='<admin_jwt>' BASE_URL=https://locallink.agency ./scripts/smoke-test.sh
# Or against local API:
SMOKE_FULL=1 SMOKE_ADMIN_TOKEN='<admin_jwt>' BASE_URL=http://localhost:4000 ./scripts/smoke-test.sh
```

### Step 2: Playwright E2E (UI + API)

Runs all specs under `frontend/e2e/`: public pages, buyer job, marketplace product detail, money flows (buyer/artisan/farmer/driver dashboards), company dashboard, and (when not skipped) admin/marketplace with ID verification.

**Local (backend on 4000, frontend started by Playwright on 5173):**

```bash
cd frontend
npm run e2e:install   # once
npm run e2e
```

**Against a running frontend (e.g. production):**

```bash
cd frontend
E2E_BASE_URL=https://locallink.agency npm run e2e
```

**Note:** Tests that need admin bootstrap or ID verification are skipped when `E2E_BASE_URL` contains `locallink.agency` (see `E2E_SKIP_ADMIN=1` or URL check in specs).

**Optional – run one suite:**

```bash
npm run e2e -- smoke-public
npm run e2e -- company-dashboard
npm run e2e -- buyer-job-flow
npm run e2e -- money-flows
```

### Step 3: Manual UAT (checklist)

Go through [E2E_UAT_CHECKLIST.md](./E2E_UAT_CHECKLIST.md) in order:

1. Public browsing (home, providers, marketplace, public profile)
2. Buyer (onboarding, post job, quotes, escrow, cancel/delete)
3. Artisan (profile, discover jobs, messaging)
4. Farmer (profile, listing, orders)
5. Driver (online/offline, deliveries)
6. Disputes / refunds (if applicable)
7. **Company (Employer)** — login (e.g. seed ama.serwaa@demo.locallink.agency / Ghana2025!), profile save, Hiring tab, post job, applications
8. Admin (login, set password, payouts, feature flags)

Use [SEED_DEMO_LOGINS.md](./SEED_DEMO_LOGINS.md) for demo accounts if seeded.

---

## 3. Run-all script (optional)

From repo root:

```bash
# Smoke only (default):
./scripts/run-all-tests.sh
BASE_URL=https://locallink.agency ./scripts/run-all-tests.sh

# Smoke + Playwright E2E (E2E_BASE_URL defaults to BASE_URL):
RUN_E2E=1 BASE_URL=https://locallink.agency ./scripts/run-all-tests.sh
RUN_E2E=1 BASE_URL=http://localhost:8080 ./scripts/run-all-tests.sh
```

Smoke always runs; E2E runs only when `RUN_E2E=1`.

---

## 4. What each test type covers

| Area | Smoke (API) | Playwright E2E | Manual UAT |
|------|--------------|----------------|------------|
| Health / ready | ✅ | — | — |
| Register (buyer, artisan, farmer, driver, company) | ✅ | Via helpers | ✅ |
| Buyer job + quote + escrow | ✅ (quote skipped if ID required) | Buyer job post | Full flow |
| Farmer product | ✅ (skipped if ID required) | Product detail + order UI | Full flow |
| Company profile + job | ✅ | ✅ (dashboard + post job) | ✅ |
| Public pages (home, marketplace, providers) | — | ✅ | ✅ |
| Buyer/artisan/farmer/driver dashboards | — | ✅ (load) | ✅ |
| Admin | — | ✅ (load, skipped on prod) | ✅ |
| Disputes / payouts / feature flags | — | — | ✅ |
| Uploads, cancel/delete rules, messaging | — | — | ✅ |

---

## 5. CI

GitHub Actions (`.github/workflows/ci.yml`) runs:

- **Backend:** `npm test` (unit tests)
- **Frontend:** `npm run build`
- **Smoke:** After backend + frontend, a **smoke** job starts Postgres, runs migrations, starts the API, bootstraps an admin (or logs in if already exists), then runs the **full** smoke test (`SMOKE_FULL=1` + `SMOKE_ADMIN_TOKEN`) so quote/escrow and farmer product flows run without being skipped for ID verification.

Playwright E2E is **not** run in CI (requires browser; run locally with `RUN_E2E=1 ./scripts/run-all-tests.sh` on your Mac).

---

## 6. Production readiness

After all tests pass, see [PRODUCTION_READINESS_REPORT.md](./PRODUCTION_READINESS_REPORT.md) for what is ready for production and what is left (media storage, monitoring, transactional messaging, etc.).
