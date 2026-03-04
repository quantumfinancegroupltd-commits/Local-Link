# LocalLink — External Integrations: Cost Report for Full Production Launch

**Purpose:** Single reference for all external services needed to move from internal/demo to **full production**, with costings and a final price range.

**Audience:** Decision-makers and ops.  
**Currency:** USD unless stated. Ghana-specific options noted where relevant.  
**Last updated:** February 2025.

---

## Executive summary

| Category | Services needed | Low (monthly) | High (monthly) | Notes |
|----------|-----------------|---------------|----------------|-------|
| **Media storage** | S3, R2, or Cloudinary | $0 | $89+ | Free tiers available; scale with usage. |
| **Error tracking** | Sentry | $0 | $26 | Free tier sufficient for launch. |
| **Transactional messaging** | SMS + Email (Termii/Twilio + SendGrid) | $15 | $80+ | Depends on volume; Ghana-focused vs global. |
| **Payments** | Paystack (already in code) | % of GMV | % of GMV | No fixed monthly; 1.95% Ghana MoMo + your platform fee. |
| **Backups** | S3 / R2 / B2 | $0–5 | $15 | Often same bucket as media. |
| **Uptime monitoring** | UptimeRobot | $0 | $0 | Free tier. |
| **Analytics** (optional) | PostHog / Plausible / GA4 | $0 | $9 | Free options cover launch. |
| **Log aggregation** (optional) | Axiom / Logtail | $0 | $25 | Free tiers; add when scaling. |

**Total estimated monthly (full production, conservative):** **$15 – $150**  
**Total estimated monthly (recommended “launch” stack):** **$20 – $50**

One-time implementation (if outsourced): roughly **$1,500 – $4,000** (media + Sentry + messaging + backups + monitoring). In-house: roadmap estimates ~8–12 hours total.

---

## 1. Media storage (required for production)

**Why:** Local disk uploads are a single point of failure; post images, job photos, and profile assets must survive restarts and scale.

| Provider | Pricing model | Launch estimate (e.g. 20–50 GB) | Scale (e.g. 200 GB) | Notes |
|----------|----------------|--------------------------------|---------------------|------|
| **AWS S3** | ~$0.023/GB/mo + requests | **~$1–2/mo** | ~$5–10/mo | Best fit if you’re already on AWS/EC2. |
| **Cloudflare R2** | $0.015/GB/mo, **zero egress** | **~$0–1/mo** (10 GB free) | ~$3–5/mo | S3-compatible; good for high traffic. |
| **Backblaze B2** | ~$0.005/GB/mo, low egress | **~$0.50–1/mo** | ~$1–3/mo | Cheapest; S3-compatible. |
| **Cloudinary** | Free 25 GB + 25 GB bandwidth, then ~$89/mo | **$0** (free tier) | **$89+/mo** | Images only; transforms/CDN included. |

**Recommendation:** **Cloudflare R2** or **AWS S3** for durability and cost. Use **Cloudinary** only if you want built-in image optimisation and can stay within free tier.

**Implementation:** 2–3 hours (env vars, `backend/src/services/storage`, optional migration script).  
**Code:** `STORAGE_DRIVER=s3` + S3/R2 env vars (see ENV_VARS.md).

---

## 2. Error tracking & monitoring (required for production)

**Why:** Know when things break before users report them; debug with stack traces and context.

| Provider | Free tier | Paid (typical) | Notes |
|----------|-----------|----------------|-------|
| **Sentry** | 5k errors/mo, 1 project | **$26/mo** (Team, 50k errors) | Recommended; DSN already in code. |
| **Rollbar** | 5k events/mo | **$12/mo** | Simpler, cheaper. |

**Recommendation:** **Sentry** free tier at launch; upgrade to Team when you need more events or team features.

**Implementation:** 1–2 hours (SENTRY_DSN backend + frontend, source maps).  
**Code:** Sentry hook present; set `SENTRY_DSN` and verify via `GET /api/health/sentry-test`.

---

## 3. Transactional messaging — SMS & email (required for production)

**Why:** Quotes, orders, delivery, and disputes need reliable SMS/email so users are notified even when they’re not in the app.

### 3.1 SMS (Ghana / West Africa)

| Provider | Pricing (Ghana) | 500 SMS/mo | 2,000 SMS/mo | 10,000 SMS/mo | Notes |
|----------|-----------------|------------|--------------|---------------|-------|
| **Termii** | Per-SMS (Ghana rates; contact for exact) | **~$5–15** | **~$20–40** | **~$80–150** | Ghana/Nigeria-focused; SMS + WhatsApp. |
| **Twilio** | **$0.3065/msg** outbound (Ghana) | **~$153** | **~$613** | **~$3,065** | Reliable; expensive in Ghana. |
| **Africa’s Talking** | Varies by country | **~$10–25** | **~$40–80** | **~$150–300** | East/West Africa; check Ghana. |

**Recommendation:** **Termii** for Ghana-focused launch (better local pricing and WhatsApp option). Use Twilio only if you need a single global provider and can absorb higher SMS cost.

### 3.2 Email (transactional)

| Provider | Free tier | Paid (typical) | Notes |
|----------|-----------|----------------|-------|
| **SendGrid** | 100 emails/day | **$15/mo** (40k/mo) | Strong deliverability. |
| **Resend** | 3k/mo | **$20/mo** (50k) | Developer-friendly. |
| **Amazon SES** | 62k/mo (from EC2) | **~$0.10/1k** | Cheapest at scale; more setup. |

**Recommendation:** **SendGrid** or **Resend** for launch; move to **SES** if volume grows.

### 3.3 Combined messaging (monthly estimate)

| Scenario | SMS (Termii) | Email (SendGrid) | **Total** |
|----------|--------------|------------------|-----------|
| Launch (low volume) | ~$10–20 (500–1k SMS) | $0 (free tier) | **~$10–20** |
| Growth | ~$40–80 (2k SMS) | $15 | **~$55–95** |
| Scale | ~$150+ (10k SMS) | $15–30 | **~$165–180** |

---

## 4. Payments — Paystack (already integrated)

**Why:** Escrow (jobs) and orders (marketplace) use Paystack; no extra “integration” fee beyond implementation already done.

| Item | Cost | Notes |
|------|------|-------|
| **Paystack (Ghana)** | **1.95%** per Mobile Money transaction | No monthly fee; pay per transaction. |
| **Card / international** | ~3.9% + fixed (see Paystack pricing) | If you enable card. |
| **Transfers (payouts)** | ~₵10–50 per transfer (Nigeria band; Ghana band similar) | When you automate payouts (e.g. Transfer API). |
| **LocalLink platform fee** | 8% jobs, 5% orders (configurable) | Your revenue; not Paystack. |

**Recommendation:** Use existing Paystack integration; plan **Paystack Transfer API** (or equivalent) for automated payouts when moving off manual admin payouts (see PLATFORM_AUDIT_SCORE_REPORT).

**Monthly cost:** **$0** fixed; **variable** = % of GMV (Paystack) + transfer fees when you automate.

---

## 5. Offsite backups (highly recommended)

**Why:** DB and critical data must survive server loss or compromise.

| Option | Pricing | 20 GB/mo | 100 GB/mo | Notes |
|--------|---------|----------|-----------|-------|
| **AWS S3 (Standard)** | ~$0.023/GB | **~$0.50** | **~$2.30** | Same account as media if using S3. |
| **AWS S3 (Glacier)** | ~$0.004/GB | **~$0.08** | **~$0.40** | Retrieval delay + fee. |
| **Backblaze B2** | ~$0.005/GB | **~$0.10** | **~$0.50** | Very cheap. |
| **Cloudflare R2** | $0.015/GB, zero egress | **~$0.30** | **~$1.50** | If already using R2. |

**Recommendation:** One S3/R2/B2 bucket for backups; script `backup_db.sh` to upload after local backup; 30-day retention.  
**Implementation:** 1–2 hours.  
**Monthly:** **~$0–5** for typical DB + file backups.

---

## 6. Uptime monitoring (recommended)

**Why:** Know when the site or API is down before users report it.

| Provider | Free tier | Paid | Notes |
|----------|-----------|------|-------|
| **UptimeRobot** | 50 monitors, 5-min checks | — | **$0**; email/SMS alerts. |
| **Pingdom** | — | **$10/mo** | 1-min checks. |
| **Better Uptime** | Limited free | **$18+/mo** | Status page + incidents. |

**Recommendation:** **UptimeRobot** free: e.g. `https://locallink.agency/api/health` and `https://locallink.agency/api/ready` every 5 min.  
**Monthly:** **$0**.

---

## 7. Analytics (optional at launch)

**Why:** Understand funnels, retention, and behaviour.

| Provider | Free tier | Paid | Notes |
|----------|-----------|------|-------|
| **Google Analytics 4** | Free | — | **$0**; privacy/complexity trade-offs. |
| **Plausible** | — | **$9/mo** (10k pageviews) | Privacy-focused, simple. |
| **PostHog** | Self-host free / cloud | **~$0.000225/event** | Product analytics + feature flags. |

**Recommendation:** **GA4** or **Plausible** at launch.  
**Monthly:** **$0–9**.

---

## 8. Log aggregation (optional at launch)

**Why:** Centralised logs speed up debugging in production.

| Provider | Free tier | Paid | Notes |
|----------|-----------|------|-------|
| **Axiom** | 500 MB/day | **$25/mo** | Good UX. |
| **Logtail** | 50 MB/day | **$20/mo** | Simple. |
| **Grafana Loki** | Self-hosted | Server cost | Full control. |

**Recommendation:** Add when team size or incident volume justifies it.  
**Monthly:** **$0** (free tier) or **$20–25**.

---

## 9. Optional: WAF / DDoS (if going fully public)

**Why:** Extra layer on top of rate limits for open internet traffic.

| Option | Cost | Notes |
|--------|------|-------|
| **Cloudflare (Pro)** | **$20/mo** | WAF, DDoS, CDN. |
| **AWS WAF** | Pay per rule + request | More config, more cost. |

**Recommendation:** Consider **Cloudflare** in front of locallink.agency if you expect high or volatile traffic.  
**Monthly:** **$0–20**.

---

## 10. Summary tables

### 10.1 Minimum “launch” stack (recommended)

| # | Service | Purpose | Monthly cost (est.) |
|---|---------|---------|----------------------|
| 1 | **Cloudflare R2** or **AWS S3** | Media storage | $0–2 |
| 2 | **Sentry** | Error tracking | $0 (free tier) |
| 3 | **Termii** | SMS (Ghana) | $10–25 |
| 4 | **SendGrid** (or Resend) | Transactional email | $0 (free tier) |
| 5 | **UptimeRobot** | Uptime checks | $0 |
| 6 | **S3/R2/B2** (or same as media) | DB + file backups | $0–2 |
| 7 | **Paystack** | Payments (existing) | Variable (% of GMV) |

**Subtotal (fixed):** **~$10–30/mo**  
**Variable:** Paystack (% of GMV) + SMS/email as volume grows.

---

### 10.2 Full production stack (with optional services)

| # | Service | Monthly low | Monthly high |
|---|---------|-------------|--------------|
| 1 | Media (R2/S3) | $0 | $10 |
| 2 | Sentry | $0 | $26 |
| 3 | SMS (Termii) | $10 | $150 |
| 4 | Email (SendGrid) | $0 | $30 |
| 5 | Backups | $0 | $5 |
| 6 | Uptime | $0 | $0 |
| 7 | Analytics | $0 | $9 |
| 8 | Logs (optional) | $0 | $25 |
| 9 | WAF/Cloudflare (optional) | $0 | $20 |
| 10 | Paystack | Variable | Variable |

**Total (excluding Paystack):** **~$15–150/mo** depending on volume and options.  
**Typical “full production” range:** **~$20–50/mo** at early scale.

---

### 10.3 One-time implementation effort (order of magnitude)

| Task | Hours (in-house) | External cost (indicative) |
|------|-------------------|----------------------------|
| Media storage (S3/R2) | 2–3 | $200–500 |
| Sentry (backend + frontend) | 1–2 | $100–250 |
| Messaging (Termii + SendGrid + events) | 3–5 | $400–1,000 |
| Backups to S3/R2 | 1–2 | $100–250 |
| Uptime (UptimeRobot) | 0.25 | $0–50 |
| Analytics (e.g. Plausible/GA4) | 1–2 | $100–250 |
| **Total** | **~8–15 hours** | **~$1,500–4,000** (if outsourced) |

---

## 11. Final price summary

- **Ongoing (monthly):**  
  - **Launch:** **~$15–35** (storage + Sentry free + Termii + email free + backups + uptime).  
  - **Full production (with optional analytics/logs/WAF):** **~$20–50** typical, up to **~$150** at higher messaging/scale.

- **Payments:** **$0** fixed; **variable** = Paystack % (e.g. 1.95% Ghana MoMo) + transfer fees when payouts are automated.

- **One-time:** **~$1,500–4,000** if outsourced; **~8–15 hours** if done in-house (see EXTERNAL_INTEGRATIONS_ROADMAP.md for order of implementation).

---

## 12. Next steps

1. **Confirm stack:** Media (R2 vs S3), SMS (Termii vs Twilio), email (SendGrid vs Resend).  
2. **Create accounts** and add API keys to env (see ENV_VARS.md).  
3. **Implement in order:** Media → Sentry → Messaging → Backups → Uptime (roadmap § Implementation Order).  
4. **Revisit** when scaling: Sentry Team, higher SMS/email tiers, log aggregation, Cloudflare Pro.

For implementation details and env vars, see **EXTERNAL_INTEGRATIONS_ROADMAP.md** and **ENV_VARS.md**.
