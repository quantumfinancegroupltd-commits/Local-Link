# Product hardening checklist

**Short answer:** For **internal/demo and controlled partners**, you're in good shape. For a **full public launch**, the items below are what's left.

---

## Already in place

- **Auth & RBAC** — JWT (15 min access + 30 day refresh), role checks, protected routes, login/register/password-reset rate limits  
- **JWT refresh** — Access tokens expire in 15 minutes; refresh tokens auto-rotate via `POST /api/refresh`. Frontend axios interceptor retries transparently on 401.
- **Security** — CORS from env, Helmet (CSP, frameAncestors), bcrypt, parameterized SQL, no `dangerouslySetInnerHTML`, async auth middleware (no race conditions)  
- **Config** — Placeholder secrets rejected in production; strict config  
- **Rate limiting** — Auth, uploads, posts; global limit in production  
- **Health & ops** — `/api/health`, `/api/ready`; error logging; 502 runbook; deploy + rollback docs  
- **Error tracking** — Sentry hook in place; set `SENTRY_DSN` and call `GET /api/health/sentry-test` to verify (see ENV_VARS.md)  
- **Testing** — Smoke (health, auth, profile, timeline, marketplace, artisans); all-9-roles script; E2E checklists  
- **Docs** — ENV_VARS.md, ROLLBACK.md, PRODUCTION_READINESS_REPORT, PLATFORM_SCORE  
- **Client-side validation** — Login and Register forms validate before submission with inline error messages  
- **Accessibility** — Skip link, ARIA landmarks (banner/main/contentinfo), aria-invalid on form fields  
- **Stable demo users** — Re-running `seed-demo-users.js` updates demo users in place (no delete/re-insert), so user IDs stay the same and sessions/feed keep working. See [DEPLOY_TO_LOCALLINK.md](./DEPLOY_TO_LOCALLINK.md) for seeding and "feed looks old" (cache / log out and log in again).

So for **current scope** (internal/demo/controlled), no extra hardening is **required** before use.

---

## If you want to harden further (full public launch)

### High impact

| Item | Why | Effort |
|------|-----|--------|
| **Media storage (S3/R2/Cloudinary)** | Local uploads don't scale or survive server loss | Medium |
| **Transactional messaging (email/SMS)** | Quotes, orders, disputes need reliable user notifications | High |

### Medium impact

| Item | Why | Effort |
|------|-----|--------|
| **API versioning** (e.g. `/api/v1/`) | Safe, non-breaking changes over time | Low-medium |
| **CSRF posture** | Document or add tokens if you add cookie-based auth | Low (doc) / medium (tokens) |
| **WAF / DDoS** | Rate limits help; WAF/Cloudflare add another layer for public traffic | Low (e.g. Cloudflare in front) |
| **Structured metrics** | Health-detail or metrics endpoint for alerting (latency, errors) | Low |

### Nice to have

- **OpenAPI / API reference** — Easier for partners and frontend  
- **More unit tests** — Auth, escrow, company, jobs  
- **Down migrations or rollback strategy** — For risky schema changes  

---

## Do we need to do anything right now?

- **No**, if you're staying with internal/demo or controlled partners: you're already hardened enough.  
- **Yes**, if you're moving to full public launch: prioritise **media storage** and **transactional messaging** (see PRODUCTION_READINESS_REPORT and EXTERNAL_INTEGRATIONS_ROADMAP).

See also: [PRODUCTION_READINESS_REPORT.md](./PRODUCTION_READINESS_REPORT.md), [PLATFORM_SCORE.md](./PLATFORM_SCORE.md), [ROLLBACK.md](./ROLLBACK.md).
