# LocalLink

LocalLink is a marketplace and jobs platform (buyers, artisans, farmers, drivers, companies).

## Repo layout

- **backend/** — Node/Express API (Postgres, JWT, Paystack, etc.)
- **frontend/** — React SPA (Vite)
- **scripts/** — Smoke test, run-all-tests
- **docs/** — Testing, UAT checklist, production readiness, seed logins

## Testing (run from project root)

From home: `cd ~/Desktop/LocalLink` (Mac). On server use `cd ~/LocalLink`. Then:

```bash
# Smoke only — production
BASE_URL=https://locallink.agency ./scripts/smoke-test.sh

# Smoke only — local API (e.g. gateway on 8080)
BASE_URL=http://localhost:8080 ./scripts/smoke-test.sh

# Full smoke (quote + escrow + farmer) — need a real admin JWT (see below)
SMOKE_FULL=1 SMOKE_ADMIN_TOKEN='eyJ...' BASE_URL=https://locallink.agency ./scripts/smoke-test.sh

# Full smoke and then delete the created test users (soft-delete) so prod stays clean
SMOKE_FULL=1 SMOKE_CLEANUP=1 SMOKE_ADMIN_TOKEN='eyJ...' BASE_URL=https://locallink.agency ./scripts/smoke-test.sh

# One command: smoke (default prod URL); add E2E on Mac with RUN_E2E=1
./scripts/run-all-tests.sh
RUN_E2E=1 ./scripts/run-all-tests.sh

# Playwright E2E (Mac, from project root)
cd frontend && npm run e2e
```

**Get admin token for full smoke:** You need a **real** production admin account (email + password). Either:

**Option A — Get token, then run smoke (replace the two values in the first command):**
```bash
# 1) Replace myadmin@example.com and YourActualPassword with your real admin email and password:
TOKEN=$(curl -sS -X POST https://locallink.agency/api/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"myadmin@example.com","password":"YourActualPassword"}' | python3 -c "import sys,json; print(json.load(sys.stdin).get('token',''))")
# 2) Run full smoke (uses that token):
cd ~/Desktop/LocalLink
SMOKE_FULL=1 SMOKE_ADMIN_TOKEN="$TOKEN" BASE_URL=https://locallink.agency ./scripts/smoke-test.sh
```

**Option B — If you already have the token string** (starts with `eyJ...`), run:
```bash
cd ~/Desktop/LocalLink
SMOKE_FULL=1 SMOKE_ADMIN_TOKEN='eyJ...paste_full_token_here...' BASE_URL=https://locallink.agency ./scripts/smoke-test.sh
```

See **[docs/100_PERCENT_TESTING.md](docs/100_PERCENT_TESTING.md)** for the full checklist and CI details.

## CI

On push/PR, GitHub Actions runs backend unit tests, frontend build, and a **full API smoke** job (Postgres + API + bootstrap admin + smoke script).
