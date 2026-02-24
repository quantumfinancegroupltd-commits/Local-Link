# LocalLink — External Integrations Roadmap

**Goal**: Connect all external services needed for production-grade platform operations.

---

## Priority 1: CRITICAL (Blocking user experience)

### 1.1 Media Storage/CDN
**Why**: Local disk uploads are a single point of failure. If EC2 disk fills or crashes, all media is lost.

**Options**:
- **AWS S3** (recommended for EC2)
  - Cost: ~$0.023/GB/month + $0.005/1000 requests
  - Pros: Native AWS integration, reliable, cheap
  - Cons: Slightly more complex setup
- **Cloudflare R2** (zero egress fees)
  - Cost: ~$0.015/GB/month, zero egress
  - Pros: Cheaper for high traffic, S3-compatible API
  - Cons: Newer service, less mature tooling
- **Cloudinary** (image optimization built-in)
  - Cost: Free tier (25GB, 25GB bandwidth), then ~$89/month
  - Pros: Auto-optimization, transformations, CDN included
  - Cons: More expensive at scale, vendor lock-in

**Implementation**:
1. Create S3 bucket (or R2 bucket)
2. Add AWS credentials to `docker-compose.selfhost.yml`
3. Update `backend/src/services/storage/index.js` to use S3/R2 adapter
4. Migrate existing uploads (optional script)
5. Update `docker-compose.selfhost.yml` to remove `locallink_uploads` volume

**Time**: 2-3 hours

---

### 1.2 Monitoring + Error Tracking
**Why**: Without visibility, you won't know when things break. Users will report issues before you see them.

**Options**:
- **Sentry** (recommended)
  - Cost: Free tier (5K errors/month), then $26/month
  - Pros: Best-in-class error tracking, source maps, release tracking
  - Cons: Can get expensive at scale
- **Rollbar** (alternative)
  - Cost: Free tier (5K events/month), then $12/month
  - Pros: Simpler, cheaper
  - Cons: Less feature-rich
- **Self-hosted** (Grafana + Loki + Prometheus)
  - Cost: Free (server resources)
  - Pros: Full control, no per-event costs
  - Cons: Setup complexity, maintenance overhead

**Implementation**:
1. Create Sentry account + project
2. Install `@sentry/node` + `@sentry/react` packages
3. Add `SENTRY_DSN` to backend/frontend env
4. Initialize Sentry in `backend/src/server.js` and `frontend/src/main.jsx`
5. Add source map upload to build process
6. Test error reporting

**Time**: 1-2 hours

---

### 1.3 Web Push (browser notifications) — implemented
**Status**: Done. Users can enable push on the Notifications page; when new in-app notifications are created, a browser push is sent (best-effort). Requires `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` in backend env (generate with `npx web-push generate-vapid-keys`). Service worker: `frontend/public/sw.js`; subscribe API: `POST /api/notifications/push-subscribe`.

---

### 1.4 Transactional Messaging (SMS/Email/WhatsApp)
**Why**: Users need notifications for job quotes, order confirmations, delivery updates, disputes. Web push covers browser users; SMS/email reach users who are offline or prefer those channels.

**Options**:
- **Termii** (Ghana-focused, SMS + WhatsApp)
  - Cost: ~₵0.05/SMS, WhatsApp pricing varies
  - Pros: Ghana-specific, WhatsApp Business API
  - Cons: Less known globally
- **Twilio** (global, SMS + WhatsApp)
  - Cost: ~$0.0075/SMS (Ghana), WhatsApp pricing varies
  - Pros: Reliable, well-documented, global
  - Cons: More expensive
- **SendGrid** (email only)
  - Cost: Free tier (100 emails/day), then $15/month (40K emails)
  - Pros: Best email deliverability
  - Cons: SMS/WhatsApp requires separate service

**Implementation**:
1. Create Termii/Twilio account
2. Add API keys to `docker-compose.selfhost.yml`
3. Create `backend/src/services/messaging/` module
4. Wire into key events:
   - Job quote received → SMS buyer
   - Quote accepted → SMS artisan
   - Order placed → SMS farmer
   - Delivery assigned → SMS driver + buyer
   - Dispute opened → Email admin
5. Add admin "Send test message" button

**Time**: 3-4 hours

---

## Priority 2: HIGH (Operational safety)

### 2.1 Offsite Backups (Automated)
**Why**: Local backups on EC2 are vulnerable. If EC2 is compromised or deleted, backups are gone.

**Options**:
- **AWS S3** (if using S3 for media)
  - Cost: ~$0.023/GB/month (standard) or $0.004/GB/month (Glacier)
  - Pros: Same account, easy automation
  - Cons: AWS lock-in
- **Backblaze B2** (cheaper alternative)
  - Cost: ~$0.005/GB/month, zero egress
  - Pros: Very cheap, S3-compatible
  - Cons: Less integrated with AWS
- **Cloudflare R2** (if using R2 for media)
  - Cost: ~$0.015/GB/month, zero egress
  - Pros: Same account, zero egress
  - Cons: Newer service

**Implementation**:
1. Create S3 bucket (or B2/R2) for backups
2. Update `scripts/backup_db.sh` to upload to S3 after local backup
3. Add retention policy (keep last 30 days, delete older)
4. Test restore from S3
5. Update cron job

**Time**: 1-2 hours

---

### 2.2 Uptime Monitoring
**Why**: Know immediately if the site goes down (before users complain).

**Options**:
- **UptimeRobot** (free tier)
  - Cost: Free (50 monitors, 5-min checks)
  - Pros: Simple, free, email/SMS alerts
  - Cons: Limited features
- **Pingdom** (paid)
  - Cost: $10/month (1 check, 1-min interval)
  - Pros: More features, better reporting
  - Cons: Paid
- **Better Uptime** (self-hosted)
  - Cost: Free (server resources)
  - Pros: Full control
  - Cons: Setup/maintenance

**Implementation**:
1. Create UptimeRobot account
2. Add monitors:
   - `https://locallink.agency/api/health` (every 5 min)
   - `https://locallink.agency/api/ready` (every 5 min)
3. Configure alerts (email + SMS)
4. Test downtime detection

**Time**: 15 minutes

---

## Priority 3: NICE-TO-HAVE (Growth + ops)

### 3.1 Analytics
**Why**: Understand user behavior, conversion funnels, retention.

**Options**:
- **PostHog** (self-hosted or cloud)
  - Cost: Free (self-hosted) or $0.000225/event (cloud)
  - Pros: Product analytics + feature flags + session replay
  - Cons: Can be complex
- **Plausible** (privacy-focused)
  - Cost: $9/month (10K pageviews)
  - Pros: Simple, GDPR-compliant, lightweight
  - Cons: Less feature-rich
- **Google Analytics 4** (free)
  - Cost: Free
  - Pros: Free, powerful
  - Cons: Privacy concerns, complex

**Implementation**:
1. Create PostHog/Plausible account
2. Add tracking script to `frontend/src/App.jsx`
3. Track key events (job posted, quote submitted, order placed)
4. Set up dashboards

**Time**: 2-3 hours

---

### 3.2 Log Aggregation
**Why**: Centralized logs make debugging production issues faster.

**Options**:
- **Axiom** (modern, fast)
  - Cost: Free tier (500MB/day), then $25/month
  - Pros: Fast queries, good UX
  - Cons: Newer service
- **Logtail** (simple)
  - Cost: Free tier (50MB/day), then $20/month
  - Pros: Simple, good for small apps
  - Cons: Less powerful
- **Self-hosted** (Grafana Loki)
  - Cost: Free (server resources)
  - Pros: Full control
  - Cons: Setup/maintenance

**Implementation**:
1. Create Axiom/Logtail account
2. Install `@axiomhq/pino` or `@logtail/pino`
3. Update `backend/src/app.js` to use log shipper
4. Test log ingestion

**Time**: 1-2 hours

---

## Implementation Order (Recommended)

### Week 1: Critical
1. **Media Storage** (S3) — 2-3 hours
2. **Monitoring** (Sentry) — 1-2 hours
3. **Messaging** (Termii/Twilio) — 3-4 hours

### Week 2: Safety
4. **Offsite Backups** (S3) — 1-2 hours
5. **Uptime Monitoring** (UptimeRobot) — 15 min

### Week 3: Growth
6. **Analytics** (PostHog) — 2-3 hours
7. **Log Aggregation** (optional) — 1-2 hours

---

## Cost Summary (Monthly)

| Service | Tier | Monthly Cost |
|---------|------|--------------|
| **AWS S3** (media + backups) | ~50GB | ~$1.50 |
| **Sentry** | Free tier | $0 |
| **Termii/Twilio** | ~1000 SMS | ~$5-10 |
| **UptimeRobot** | Free tier | $0 |
| **PostHog** | Self-hosted | $0 |
| **Total** | | **~$6-12/month** |

---

## Next Steps

1. **Choose services** (I recommend: S3, Sentry, Termii, UptimeRobot)
2. **Create accounts** and get API keys
3. **Start with Media Storage** (highest risk mitigation)
4. **Then Monitoring** (visibility)
5. **Then Messaging** (user experience)

Ready to start? Let me know which services you want to integrate first, and I'll implement them step-by-step.

