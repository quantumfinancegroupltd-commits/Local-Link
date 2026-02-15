# LocalLink Backend (Production-ready foundation)

## Requirements
- Node.js 18+
- Postgres (local, Supabase, Render, etc.)

## Environment variables
- **DATABASE_URL**: Postgres connection string
- **JWT_SECRET**: secret for signing auth tokens
- **CORS_ORIGINS**: comma-separated allowlist for production (e.g. `https://locallink.app,https://www.locallink.app`)
- **PAYSTACK_SECRET_KEY**: Paystack secret key (used for API calls + webhook signature verification)
- **PAYSTACK_WEBHOOK_SECRET**: (legacy) treated as PAYSTACK secret key if PAYSTACK_SECRET_KEY not set
- **FLUTTERWAVE_WEBHOOK_HASH**: Flutterwave webhook hash (for signature verification)

### Recommended production values
- **JWT_SECRET**: generate a strong secret (32+ chars), e.g.:
  - `openssl rand -base64 32`
- **CORS_ORIGINS**: set to your Vercel domains, e.g.:
  - `https://locallink.vercel.app,https://locallink-<your-team>.vercel.app`

## Install
```bash
cd backend
npm install
```

## Run migrations
```bash
cd backend
DATABASE_URL="postgres://..." npm run migrate
```

## Run dev server
```bash
cd backend
DATABASE_URL="postgres://..." JWT_SECRET="change_me" npm run dev
```

## Health / readiness
- `GET /api/health` → process is up
- `GET /api/ready` → DB connectivity check (returns 503 if DB down)

## Webhooks (scaffolded)
- `POST /api/webhooks/paystack` (verifies `x-paystack-signature`)
- `POST /api/webhooks/flutterwave` (verifies `verif-hash`)

Both endpoints also write idempotent records to `webhook_events`.

## Paystack (foundation)
- `POST /api/escrow/jobs/:jobId/deposit` with body `{"amount":123,"provider":"paystack"}`
  - Creates escrow row, initializes Paystack transaction, returns `authorization_url` + `reference`
  - When Paystack webhook `charge.success` arrives, escrow is updated to `held`

## Deploy (Recommended): Render + Supabase
1) Push this repo to GitHub
2) In Render: **New → Blueprint** and select the repo (Render will pick up `render.yaml`)
3) In the Render service env vars, set:
   - `DATABASE_URL` (Supabase Postgres URI)
   - `JWT_SECRET` (strong)
   - `CORS_ORIGINS` (your Vercel URL(s))
   - `PAYSTACK_WEBHOOK_SECRET` / `FLUTTERWAVE_WEBHOOK_HASH` (when you enable payments)
4) Deploy
5) Verify:
   - `GET https://<render-service>.onrender.com/api/health`
   - `GET https://<render-service>.onrender.com/api/ready`


