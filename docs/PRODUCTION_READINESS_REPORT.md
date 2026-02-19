# LocalLink — Production Readiness Report

**Purpose**: Brutally honest assessment of what is ready for production, what is not, and what must be done before external integrations or public launch.

**Last updated**: Feb 2025 (post–company-permission fix and E2E audit).

---

## Executive summary

| Area | Status | Notes |
|------|--------|------|
| Auth & RBAC | ✅ OK | Login/register, JWT, role-based redirects; company workspace permission fixed with backfill + frontend fallback. |
| Company (Employer) flows | ✅ Fixed | Owner permission bug addressed; migration + frontend ensure owners can edit profile and post jobs. |
| Buyer / Artisan (Skilled Labour) | ✅ Covered | E2E checklist + smoke script + Playwright buyer-job flow. |
| Farmer / Marketplace | ✅ Covered | Checklist + smoke; marketplace product detail E2E exists. |
| Corporate hiring (company jobs) | ⚠️ New in checklist | No automated E2E yet; manual checklist added; must run migration 108 on production. |
| External integrations | ❌ Not production-ready | Paystack optional; no S3/R2 media; no Sentry; no transactional email/SMS. See EXTERNAL_INTEGRATIONS_ROADMAP.md. |
| Security & ops | ⚠️ Partial | Rate limits on auth/uploads/posts; JWT required on protected routes; no WAF, no DDoS hardening. |
| Observability | ⚠️ Minimal | Health/ready endpoints; no APM, no structured error reporting to external service. |

**Verdict**: Safe for **internal/demo and controlled external integrations** (e.g. partners with test accounts) **after** you run migration 108 and deploy the latest frontend/backend. **Not** “production-ready” for full public launch until media storage, monitoring, and transactional messaging are in place (see roadmap).

---

## 1. What was fixed (company workspace permission)

**Problem**: Company owners saw “Your workspace role doesn’t have permission to edit the company profile” and could not post jobs after saving the company profile.

**Root cause**: Some company owners had no row in `company_members` (e.g. created before seed/migration backfill, or backfill missed them). Backend and frontend both had fallbacks for “owner by `owner_user_id`”, but production DB state and/or stale frontend role could still leave `workspace_role` null.

**Fixes applied**:

1. **Backend**
   - **Migration 108** (`108_backfill_company_owners_members.sql`): Backfills `company_members` so every `companies.owner_user_id` has an `owner` row. Safe to run multiple times.
   - Backend already had: `workspaceRoleForUserInCompany` returns `'owner'` when user is `companies.owner_user_id`; `resolveCompanyIdForReq` allows owner access even without `company_members`.

2. **Frontend**
   - **Role source**: `myWorkspaceRole` now uses role from both auth context and **GET /profile/me** (`profileMeRole`), so stale localStorage without `role` no longer blocks owner treatment.
   - **Company context**: Owner fallback uses `access?.company_id || company?.id`, so once the company is loaded (or access has company_id), owner is inferred.
   - **Jobs loading**: Jobs list is loaded when we have company context from access or from GET /company/me, not only when `workspace_role` is present in access response.
   - **Hiring tab**: Clear permission banner when user cannot post jobs; form hidden when no permission; `postJob` guard to avoid submitting without permission.

**What you must do**:

- **Run migrations on production** (so 108 runs):  
  `docker compose -f docker-compose.selfhost.yml run --rm api npm run migrate`
- **Redeploy** frontend and backend so the new logic and migration are live.
- **Verify**: Log in as a company user (e.g. seed Ama Serwaa), save company profile, open Hiring, post a job — no permission message, job appears.

---

## 2. End-to-end testing coverage

### 2.1 Automated

- **Playwright (frontend/e2e)**  
  - `smoke-public.spec.js`: home, marketplace, providers.  
  - `buyer-job-flow.spec.js`: buyer posts job (no media).  
  - `marketplace-product-detail.spec.js`, `money-flows.spec.js`: product detail and money flows.  
  - **Gap**: No Playwright test for company dashboard (login as company, save profile, post job).

- **Backend**  
  - Unit-style: `algorithms.test.js`, `policy.test.js`.  
  - No API integration tests for `/corporate/*` or company workspace role.

- **scripts/smoke-test.sh**  
  - Health/ready (asserts `"ok"` in health response), register buyer/artisan/farmer, buyer job → quote → accept → escrow, farmer product, optional order.  
  - **Company flow**: register company user, POST `/api/corporate/company/me` (create company profile), POST `/api/corporate/company/jobs` (post a job). Fails fast if company profile or job post returns error.

### 2.2 Manual (E2E_UAT_CHECKLIST.md)

- **Release gates**: Health, auth, RBAC, tier-1 flows (skilled labour + marketplace), uploads, admin.
- **Sections**: Public, Buyer, Artisan, Farmer, Driver, Disputes, Admin.
- **New**: **Company (Employer)** section added: company login, no permission message on profile/hiring, save profile, post job, applications, workspace roles.

**Recommendation**: Before calling “production-ready” for employers, add at least one Playwright test: company login → dashboard → save profile → post job (and optionally extend smoke-test.sh with one company flow).

---

## 3. Security & reliability (honest)

- **Auth**: JWT with role; protected routes return 401 without valid token. Login/register rate-limited. Password reset rate-limited.
- **Company**: Workspace role enforced on backend (`requireWorkspaceRole`); owner fallback by `owner_user_id` and migration 108.
- **Uploads**: Rate limits on media/base64/private; types and size limits applied.
- **Gaps**: No WAF; no DDoS mitigation beyond simple rate limits; no CSP or security headers doc; no formal penetration test. For “external integrations” with trusted partners this is often acceptable; for open public launch, harden further.

---

## 4. External integrations (production readiness)

From **EXTERNAL_INTEGRATIONS_ROADMAP.md** and codebase:

- **Paystack**: Optional; used for escrow/orders when configured; smoke test skips order step if not set.
- **Media**: Local disk (e.g. `locallink_uploads`). **Not production-ready** for scale or durability; roadmap recommends S3/R2/Cloudinary.
- **Monitoring / errors**: Sentry mentioned in roadmap; not required for app to run. **Not production-ready** for 24/7 ops without error tracking and health monitoring.
- **Transactional messaging**: No SMS/email/WhatsApp integration in code. **Not production-ready** for user notifications (quotes, orders, disputes) without this.

So: **external integrations** (payment, storage, messaging, monitoring) are **not** all in place. The **platform code** (auth, company, jobs, marketplace, buyer/artisan/farmer flows) can be considered **ready for controlled external integrations** once migration 108 is run and the permission fix is deployed.

---

## 5. Checklist before “production-ready” and external integrations

- [ ] **Run migration 108** on production DB (backfill company_members for owners).
- [ ] **Deploy** latest backend and frontend (company permission + profileMeRole + jobs loading).
- [ ] **Manual pass** of E2E_UAT_CHECKLIST.md including **Company (Employer)** (login → profile → hiring → post job).
- [ ] **Smoke-test.sh** against staging/production API (health, register, job flow, product, optional escrow/order).
- [ ] **Optional but recommended**: One Playwright E2E for company: login → company dashboard → save profile → post job.
- [ ] **Before full public launch**: Media storage (S3/R2), error tracking (e.g. Sentry), transactional messaging (email/SMS/WhatsApp), and monitoring/alerting (e.g. health/ready + logs).

---

## 6. Summary

- **Company workspace permission**: Fixed with migration 108, backend owner fallback, and frontend role/context fallbacks; deploy + run migration and verify with checklist.
- **E2E**: Broad manual checklist and some Playwright/smoke coverage; company flow is in the checklist but not yet in automated E2E.
- **Production readiness**: OK for **internal/demo and controlled external integrations** after the above steps. **Full production** (public launch, payments, notifications, durability) depends on external integrations and ops (media, monitoring, messaging) as in the roadmap.
