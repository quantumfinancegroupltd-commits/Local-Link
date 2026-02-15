# LocalLink — E2E Testing / System Testing / UAT Checklist

This document is the **release-candidate gate** for LocalLink.

Terminology (pick based on context):
- **End-to-end (E2E) testing**: verifies real user workflows across the full stack (UI → API → DB).
- **System testing**: tests the complete integrated system against requirements (often overlaps with E2E).
- **UAT (User Acceptance Testing)**: E2E testing performed from the business/user perspective (pass/fail sign-off).

---

## Release Candidate (RC) pass/fail gates (must pass)

- **Availability**: `GET /api/health` returns `{"ok":true}` via gateway.
- **Auth**: register/login works for buyer/artisan/farmer/driver, and `/api/me` returns the user.
- **RBAC**: protected pages redirect correctly (buyers can’t access farmer/driver dashboards, etc).
- **Tier‑1 flows**:
  - Skilled Labour: buyer posts job → artisan quotes → buyer accepts → escrow page loads.
  - Farm Produce: marketplace browse → product detail → (buyer) can reach order UI and see delivery fee quote (if coords available).
- **Uploads**: job media upload + profile/cover upload work for png/jpg/webp/gif/mp4/mov (and any allowed extra types).
- **Admin**: admin login works; if `must_change_password=true` then `/admin/set-password` is forced; audit log writes appear after admin actions.

---

## Manual E2E/UAT test scripts (do in this order)

### Public browsing (no login)
- **Home**: landing loads, “Get started” works, no console-breaking errors.
- **Providers list (public)**: `/providers` loads read-only; cards render; profile links open.
- **Marketplace (public)**: `/marketplace` loads; search + filters change results; product cards open.
- **Public profile (public)**: `/u/:id` loads; cover/bio/links show; posts render; likes/comments visible.

### Buyer (Skilled Labour)
- **Onboarding**: register buyer → lands on buyer “Today”.
- **Post job (no media)**: create job with title/desc/location/budget → job detail loads.
- **Post job (with media)**: attach multiple images/videos → job created; media grid shows.
- **Quotes**: log in as artisan → submit quote → buyer sees it → buyer accepts.
- **Escrow screen**: buyer opens “Trust Wallet (escrow)” screen for the job (payment may require Paystack).
- **Cancel + delete rules**:
  - Cancel an open job.
  - Delete is visible for `open/cancelled/completed` and works (job disappears from list).
  - Delete is NOT available for mid-flow states (in progress, disputed, etc).

### Artisan
- **Artisan profile exists**: artisan can create profile once; dashboards load.
- **Discover jobs**: sees nearby/open jobs; job detail loads; can quote without “create artisan profile” errors.
- **Messaging**: can open messages thread for a job when applicable.

### Farmer (Marketplace supply)
- **Create farmer profile**: set farm location + coordinates (Places).
- **Create listing**: add product with multiple media → product appears on public marketplace.
- **Edit listing**: edit fields + media; verify updates reflect on product detail.
- **Delete/cancel listing**: remove listing; it disappears from public marketplace.
- **Manage orders**: `/farmer/orders` loads; orders show buyer details; delivery tracking components render if present.

### Driver dispatch (internal)
- **Go online/offline**: driver can toggle status.
- **Radius filtering**: driver sees available deliveries within radius.
- **Buyer tracking**: buyer order tracking shows driver online status + freshness when assigned.

### Disputes / cancellations / refunds (internal logic)
- **Create dispute**: from eligible state create a dispute; evidence attaches; dispute appears in admin queue.
- **Auto-resolution timers**: verify auto-confirm/auto-release behave correctly when no dispute; halt when dispute exists.
- **Admin resolution**: resolve dispute; correct state transitions; audit log row created.

### Admin
- **Login + forced password change**: first login forces `/admin/set-password` then redirects to dashboard.
- **Payout queue**: see pending payouts; mark paid/cancel; verify audit log entries appear.
- **Feature flags**: change a flag; verify it updates in app; audit log row exists.

---

## “Done enough for production” (internal-only) checklist

If any of these are failing, we’re not “done”, even if the UI looks good:
- **Logs**: gateway/api logs are clean (no repeated 5xx, no crash loops).
- **Uploads**: large uploads do not return `413` (gateway and nginx body size aligned).
- **Security**: rate limiting triggers on login; JWT-protected routes reject missing/invalid tokens.
- **DB migrations**: all migrations applied; no startup migration errors.


