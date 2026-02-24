# Product hardening checklist

**Short answer:** For **internal/demo and controlled partners**, you’re in good shape. For a **full public launch**, the items below are what’s left.

---

## Already in place

- **Auth & RBAC** — JWT, role checks, protected routes, login/register/password-reset rate limits  
- **Security** — CORS from env, Helmet (CSP, frameAncestors), bcrypt, parameterized SQL, no `dangerouslySetInnerHTML`  
- **Config** — Placeholder secrets rejected in production; strict config  
- **Rate limiting** — Auth, uploads, posts; global limit in production  
- **Health & ops** — `/api/health`, `/api/ready`; error logging; 502 runbook; deploy + rollback docs  
- **Testing** — Smoke (health, auth, profile, timeline, marketplace, artisans); all-9-roles script; E2E checklists  
- **Docs** — ENV_VARS.md, ROLLBACK.md, PRODUCTION_READINESS_REPORT, PLATFORM_SCORE  

So for **current scope** (internal/demo/controlled), no extra hardening is **required** before use.

---

## If you want to harden further (full public launch)

### High impact

| Item | Why | Effort |
|------|-----|--------|
| **JWT refresh or shorter expiry + revocation** | 30-day expiry with no refresh/blocklist is risky for public; stolen tokens live long | Medium |
| **Media storage (S3/R2/Cloudinary)** | Local uploads don’t scale or survive server loss | Medium |
| **Error tracking (e.g. Sentry)** | You already have the hook; set `SENTRY_DSN` and verify events | Low |
| **Transactional messaging (email/SMS)** | Quotes, orders, disputes need reliable user notifications | High |

### Medium impact

| Item | Why | Effort |
|------|-----|--------|
| **API versioning** (e.g. `/api/v1/`) | Safe, non-breaking changes over time | Low–medium |
| **CSRF posture** | Document or add tokens if you add cookie-based auth | Low (doc) / medium (tokens) |
| **WAF / DDoS** | Rate limits help; WAF/Cloudflare add another layer for public traffic | Low (e.g. Cloudflare in front) |
| **Structured metrics** | Health-detail or metrics endpoint for alerting (latency, errors) | Low |

### Nice to have

- **OpenAPI / API reference** — Easier for partners and frontend  
- **More unit tests** — Auth, escrow, company, jobs  
- **Down migrations or rollback strategy** — For risky schema changes  
- **A11y pass** — Labels, focus, skip links  

---

## Do we need to do anything right now?

- **No**, if you’re staying with internal/demo or controlled partners: you’re already hardened enough.  
- **Yes**, if you’re moving to full public launch: prioritise **JWT refresh/revocation**, **media storage**, **Sentry**, and **transactional messaging** (see PRODUCTION_READINESS_REPORT and EXTERNAL_INTEGRATIONS_ROADMAP).

See also: [PRODUCTION_READINESS_REPORT.md](./PRODUCTION_READINESS_REPORT.md), [PLATFORM_SCORE.md](./PLATFORM_SCORE.md), [ROLLBACK.md](./ROLLBACK.md).
