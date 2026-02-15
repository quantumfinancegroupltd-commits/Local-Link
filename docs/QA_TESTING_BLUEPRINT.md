# LocalLink — QA Testing Blueprint

**Philosophy**: Instrumentation > Testing > Audit > Iteration.  
Without observability, testing is blind. Without structured tests, audits are shallow.

---

## 1. Three Types of Testing

| Type | Purpose |
|------|---------|
| **Functional correctness** | Does the flow work? (Happy path) |
| **Edge cases & breakpoints** | What happens when payment fails? Webhook times out? |
| **UX & trust clarity** | Empty states, error states, loading states, microcopy |
| **Enterprise workflow consistency** | Role-based permissions, reporting accuracy, scheduling |
| **Trust system integrity** | Trust scores, policy events, dispute transparency |

---

## 2. Recommended Stack

- **Playwright** — browser automation (E2E)
- **API smoke script** — health, ready, auth boundaries (`backend/scripts/api-smoke.mjs`)
- **Central logging** — pino-http + request IDs (already in place)
- **Structured events** — escrow state, dispute resolution, payout events (logged via audit)

---

## 3. Phase 1 — Instrumentation (Before Deep Testing)

| Check | Status |
|-------|--------|
| Request IDs (`x-request-id`) | ✓ |
| Central error logging (pino-http) | ✓ |
| DB health probe (`/api/ready`) | ✓ |
| Admin audit log for money/admin actions | ✓ |
| Escrow state transitions in meta | ✓ |
| Background job run logging (schedulers) | ✓ |
| **To add** | Structured escrow/ledger event log for reconciliation |

---

## 4. Phase 2 — Automated Flow Tests (Playwright)

### Critical money flows (no Paystack redirect)

| Test | Location | Role |
|------|----------|------|
| Buyer orders page loads | `e2e/money-flows.spec.js` | buyer |
| Buyer jobs page loads | `e2e/money-flows.spec.js` | buyer |
| Artisan pipeline + wallet | `e2e/money-flows.spec.js` | artisan |
| Farmer orders pipeline | `e2e/money-flows.spec.js` | farmer |
| Driver deliveries pipeline | `e2e/money-flows.spec.js` | driver |
| Admin dashboard loads | `e2e/money-flows.spec.js` | admin |
| Buyer post job | `e2e/buyer-job-flow.spec.js` | buyer |
| Marketplace product detail | `e2e/marketplace-product-detail.spec.js` | buyer |

### Run

1. **Start backend** (with admin bootstrap for admin tests):
   ```bash
   cd backend
   ADMIN_BOOTSTRAP_SECRET=dev_only_change_me npm run dev
   ```
2. **Start frontend** (Vite default port 5173 — safe for Chromium):
   ```bash
   cd frontend
   npm run dev
   ```
3. **Run E2E** (default base URL: http://localhost:5173):
   ```bash
   cd frontend
   npm run e2e
   ```
   Or with explicit base URL:
   ```bash
   E2E_BASE_URL=http://localhost:5173 npm run e2e
   ```

**Note:** Port 5060 is blocked by Chromium (`ERR_UNSAFE_PORT`). Use 5173 (Vite default) for E2E.

---

## 5. Phase 3 — API Smoke (Backend)

```bash
cd backend
API_BASE_URL=http://localhost:4000 node scripts/api-smoke.mjs
```

Checks: `/api/health`, `/api/ready`, unauthed `/api/wallets/me` → 401, unauthed `/api/escrow/disputes` → 401.

---

## 6. Phase 4 — AI Audit Layer

After tests run, feed logs + results into Cursor and ask:

> List structural weaknesses, UX inconsistencies, failure points, trust risk exposures.

---

## 7. Structured QA Checklist (Abridged)

### UI/UX
- [ ] Empty states (no jobs, no orders, no providers)
- [ ] Error states (API failure, network timeout)
- [ ] Loading states (spinners, skeletons)
- [ ] Mobile scaling (breakpoints)
- [ ] Button clarity (primary vs secondary)
- [ ] Microcopy consistency

### Trust System
- [ ] Trust score recalculation timing
- [ ] Snapshot integrity
- [ ] Policy event visibility
- [ ] Dispute transparency (evidence, timeline)

### Enterprise Mode
- [ ] Role-based permissions (owner/ops/supervisor/viewer)
- [ ] Reporting accuracy (CSV export matches UI)
- [ ] Scheduling logic (series, coverage, autopilot)
- [ ] Escrow aggregation (multi-escrow orders)

### Ops & Resilience
- [ ] Webhook failure handling
- [ ] Scheduler crash recovery
- [ ] Payment timeout behavior
- [ ] Job stuck in "pending" handling

### Edge Cases
- [ ] Delete account mid-dispute
- [ ] Cancel job after confirmation
- [ ] Double booking prevention
- [ ] Repeated escrow funding (idempotency)
- [ ] Spam attempt (rate limits)

---

## 8. E2E Prerequisites

| Requirement | Purpose |
|-------------|---------|
| Backend running on 4000 | API proxy, auth, bootstrap |
| Frontend running on **5173** | Chromium-safe port (5060 is blocked) |
| `ADMIN_BOOTSTRAP_SECRET=dev_only_change_me` | Admin tests (ensureAdmin) |
| `E2E_API_BASE_URL` (optional) | API base for auth/bootstrap; defaults to `baseURL/api` |

Admin tests call `/api/admin/bootstrap` to create an admin user. Without `ADMIN_BOOTSTRAP_SECRET`, the backend returns 501 and those tests fail.

---

## 9. Role-Based Test Accounts

| Role | Use for |
|------|---------|
| Buyer | Post job, place order, pay escrow, cancel, dispute |
| Artisan | Quote, start job, upload proof, complete |
| Farmer | List product, manage orders, delivery tracking |
| Driver | Claim delivery, go online, update status |
| Company (owner) | Create profile, hire, schedule, ops |
| Admin | Bootstrap, disputes, payouts, feature flags, audit |

---

## 10. Full Simulation Flow (Manual / Semi-Automated)

1. Register
2. Verify email (or skip in dev)
3. Complete profile
4. Post job / Place order
5. Accept quote / Assign provider
6. Fund escrow (Paystack dev mode or mock)
7. Cancel / Dispute scenarios
8. Review / Rehire
9. Schedule recurring (company)
10. Switch roles
11. Export report (CSV)
12. Trigger alerts (ops coverage)

---

## 11. Platform Readiness Scorecard (Internal)

| Dimension | Weight | Score 1–10 | Notes |
|-----------|--------|------------|-------|
| Functional correctness | 30% | | Happy paths work |
| Edge case handling | 20% | | Timeouts, failures, idempotency |
| UX/Trust clarity | 20% | | Empty/error/loading states |
| Enterprise consistency | 15% | | RBAC, reporting, scheduling |
| Observability | 15% | | Logs, audit, health |

Target: **90+** for production readiness.
