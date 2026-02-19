# Environment variables

Reference for backend (API) environment variables. The source of truth is `backend/src/config.js`; this doc is a readable summary.

## Required in production

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | Postgres connection string (e.g. `postgresql://user:pass@host:5432/db`) |
| `JWT_SECRET` | Secret for signing JWTs; must be strong, not a placeholder |
| `ADMIN_BOOTSTRAP_SECRET` | Secret for `POST /api/bootstrap/admin` (first admin only); must be strong |
| `CORS_ORIGINS` | Comma-separated allowed origins (e.g. `https://locallink.agency,https://www.locallink.agency`) |

## Server / runtime

| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_ENV` | `development` | `production` enables prod checks and rate limiting |
| `PORT` | `4000` | API listen port |

## Database (optional tuning)

| Variable | Default | Description |
|----------|---------|-------------|
| `PG_POOL_MAX` | `10` | Max connections in pool |
| `PG_POOL_IDLE_TIMEOUT_MS` | `30000` | Idle timeout (ms) |
| `PG_POOL_CONN_TIMEOUT_MS` | `5000` | Connect timeout (ms) |
| `PG_STATEMENT_TIMEOUT_MS` | `30000` | Per-query timeout (ms) |

## Auth & CORS

| Variable | Default | Description |
|----------|---------|-------------|
| `CORS_ORIGINS` | (empty) | Comma-separated origins; required in production |

## Payments (optional)

| Variable | Description |
|----------|-------------|
| `PAYSTACK_SECRET_KEY` | Paystack secret key |
| `PAYSTACK_WEBHOOK_SECRET` | Paystack webhook signing secret |
| `FLUTTERWAVE_WEBHOOK_HASH` | Flutterwave webhook hash |
| `APP_BASE_URL` | Public app URL (e.g. for payment redirects) |

## Email (optional)

| Variable | Description |
|----------|-------------|
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | SMTP for password reset etc. |
| `SMTP_SECURE` | `true` / `false` |
| `PASSWORD_RESET_TTL_MINUTES` | Reset link TTL (default 30) |

## Platform & delivery

| Variable | Default | Description |
|----------|---------|-------------|
| `PLATFORM_FEE_PCT_JOB` | `0.08` | Job escrow fee (8%) |
| `PLATFORM_FEE_PCT_ORDER` | `0.05` | Order fee (5%) |
| `PLATFORM_FEE_PCT_DELIVERY` | `0.1667` | Delivery cut |
| `DELIVERY_BASE_FEE`, `DELIVERY_RATE_PER_KM`, `DELIVERY_SPEED_KMH` | (see config) | Delivery fee formula |
| `AUTO_RELEASE_JOB_HOURS` | `72` | Auto-release job escrow (hours) |
| `AUTO_CONFIRM_DELIVERY_HOURS` | `48` | Auto-confirm delivery (hours) |

## Storage (optional)

| Variable | Default | Description |
|----------|---------|-------------|
| `STORAGE_DRIVER` | `local` | `local` or `s3` |
| `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_ENDPOINT`, etc. | — | For S3/R2 uploads |

## Observability (optional)

| Variable | Description |
|----------|-------------|
| `SENTRY_DSN` | Sentry DSN for error tracking |

## Feature flags / workers

| Variable | Default | Description |
|----------|---------|-------------|
| `SCHEDULERS_ENABLED` | `true` | Enable cron-style schedulers |
| `WEBHOOK_QUEUE_ENABLED` | `true` | Enable webhook queue |
| `WEBHOOK_QUEUE_MAX_ATTEMPTS` | `10` | Max retries per webhook |

Other feature/scheduling vars (e.g. `SHIFT_*`, `COMPANY_OPS_*`) are in `backend/src/config.js`.

## Transactional messaging (optional)

| Variable | Description |
|----------|-------------|
| `TERMII_API_KEY`, `TERMII_SENDER_ID` | Termii SMS |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` | Twilio SMS |

---

*Generated from config schema. For exact defaults and coercion, see `backend/src/config.js`.*
