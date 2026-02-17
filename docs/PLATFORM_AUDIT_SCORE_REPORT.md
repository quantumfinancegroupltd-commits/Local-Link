# LocalLink — Platform Audit Score Report

**Overall score: 72 / 100** — *Solid Foundation, Execution Gaps*

**Auditor:** Claude Sonnet 4.6  
**Scope:** Feature completeness, UX, architecture, monetisation, scale-readiness  
**Date:** Feb 17, 2026

LocalLink is a genuinely ambitious multi-sided marketplace covering six distinct user roles, escrow-protected payments, a social layer, and vertical-specific flows. The architecture is coherent. But the platform is running on manual rails — payouts, dispute resolution, and driver ops all require admin intervention — and several critical monetisation and retention mechanisms are absent or skeletal.

**Stage:** Late Beta / Pre-PMF

---

## 10-Dimension Breakdown

| Dimension | Score | Verdict |
|-----------|-------|---------|
| Role Architecture | 88 | Excellent — 6 well-differentiated roles, vertical toggle is smart |
| Job & Escrow Flow | 84 | Solid state machine, auto-release, dispute tooling |
| B2B / Company Layer | 78 | Surprisingly complete — geo-fenced shifts, recurring series |
| Trust & Verification | 74 | Ghana Card KYC, trust pages, reviews — good foundation |
| Marketplace (Products) | 70 | Florist fields are nice; no stock management is a real problem |
| Admin & Operations | 68 | Feature flags + audit log are mature; everything else is manual |
| Social & Discovery | 64 | Feed + follow graph is a differentiator, but no algorithm |
| Payments & Monetisation | 62 | Escrow is right; all payouts are manual; no subscription tier |
| Driver Logistics | 58 | Fundamentals exist; no dispatch, no live tracking, purely passive |
| Retention & Growth | 44 | Biggest gap — no push, referrals, rebook loops, or email drip |

---

## The 3 Things That Will Move the Needle Most

1. **Automate payouts (Paystack Transfer API)** — Manual payouts don't scale past ~50 active providers and destroy trust.
2. **Build rebook + re-engagement loops** — You're acquiring users and letting them evaporate; the escrow release moment is a perfect re-engagement trigger.
3. **Artisan Pro subscription** — A clean recurring revenue stream that also gives supply-side users a reason to stay invested in the platform.

---

## Dimension Details

### Role Architecture — 88

Six well-differentiated roles (Guest, Buyer, Artisan, Farmer/Florist, Driver, Company, Admin). Role-based routing is clean. The Florist-as-vertical pattern is clever — reusing Farmer with a mode toggle avoids code duplication. Company + Shifts + Workforce is a full B2B vertical embedded in the product.

- ✅ 6 roles  
- ✅ Vertical toggle  
- ⚠️ Role-switch not mentioned  

### Job & Escrow Flow — 84

New → Quoted → Assigned → In Progress → Completed state machine is solid. Escrow via Paystack is correct. Auto-release timer (72h) is good friction removal. Work-proof uploads, dispute with evidence, and no-show reporting are all there.

- ✅ Auto-release  
- ✅ Dispute + evidence  
- ❌ No milestone payments  
- ❌ No cancellation policy engine  

### Marketplace (Products) — 70

Produce + flowers covered. 12-image upload, category filters, distance-based delivery fee, florist-specific checkout fields (occasion, gift message, delivery date) — all solid. But no stock management, no inventory automation, no search with full-text, no wishlisting, no product recommendations, and no repeat-order flow.

- ✅ Florist fields  
- ✅ Distance fee calc  
- ❌ No stock control  
- ❌ No search  
- ❌ No wishlist  

### Payments & Monetisation — 62

Paystack integration for escrow and orders is correct. Fee tiers (8% jobs, 5% produce, ~17% delivery) are explicitly modelled. But all payouts are manual — admin marks paid after out-of-band MoMo/bank transfer. No buyer wallet, no subscription/pro tier for artisans, no dynamic pricing, no platform revenue dashboards.

- ✅ Multi-fee model  
- ✅ Paystack escrow  
- ❌ All payouts manual  
- ❌ No artisan subscription  
- ❌ No revenue analytics  

### Trust & Verification — 74

Ghana Card + selfie verification, tiered trust badges, escrow protection, review system, and public trust pages are all present. Public verification explanations (/trust/escrow, /trust/verification, /trust/reviews) build buyer confidence.

- ✅ ID + selfie KYC  
- ✅ Trust pages  
- ⚠️ Review enforcement unclear  
- ❌ No background checks  

### Logistics / Driver Layer — 58

Driver profile, approval, online/offline toggle, claim delivery, status updates (Picked Up → On Way → Delivered), auto-confirm after 48h, wallet — all fundamentals present. But no in-app navigation, no live GPS tracking for buyer, no estimated delivery time, no delivery batching, and driver supply is entirely passive (drivers claim; no dispatch algorithm).

- ✅ Claim flow  
- ✅ Auto-confirm 48h  
- ❌ No live tracking  
- ❌ No ETA  
- ❌ No dispatch algo  

### B2B / Company Layer — 78

Surprisingly complete: workforce lists, shift creation with geo-fence, recurring shift series, check-in codes, no-show grace periods, job posting, application pipeline with shortlist/reject/hire, message templates. Gaps: no in-app payroll execution, analytics depth is "placeholder," and payroll UI is described as coming later.

- ✅ Shift + geo-fence  
- ✅ Recurring series  
- ✅ Application pipeline  
- ❌ No in-app payroll  
- ⚠️ Analytics shallow  

### Social & Discovery — 64

Feed, posts, likes, comments, follow system, People discovery, and public profiles with availability calendars and reviews all exist. This is a real differentiator vs purely transactional competitors. But there's no algorithm or curation for the feed, no hashtags or search within feed, no stories/highlights, and no referral or viral growth mechanic.

- ✅ Social feed  
- ✅ Follow graph  
- ✅ Availability calendar  
- ❌ No feed algorithm  
- ❌ No referral loop  

### Admin & Operations — 68

Separate admin auth, feature flags for vertical rollout, dispute resolution tools, payout management, user moderation with keyword filters, driver approval, audit log, and stuck-signal monitoring (escrows > 12h, payouts > 6h) are well-considered. Problem: everything is manual. There is no automation, no alert routing, no SLA enforcement.

- ✅ Feature flags  
- ✅ Audit log  
- ✅ Stuck signals  
- ❌ 100% manual ops  
- ❌ No SLA automation  

### Retention & Growth — 44

This is the biggest gap. There are no push notifications, no re-engagement emails, no loyalty/rewards programme, no referral scheme, no seasonal promotions, no artisan badges for milestones, no buyer rebooking prompts, no "you worked with X — rebook them" flow, and no cohort analytics. Acquisition funnels and retention mechanics are almost entirely absent from the feature list.

- ❌ No push notifications  
- ❌ No referral scheme  
- ❌ No rebook flow  
- ❌ No loyalty  
- ❌ No email drip  

---

## Critical Findings

| # | Finding | Severity |
|---|---------|----------|
| 01 | **All payouts are manually processed by admin.** Every artisan, farmer, and driver withdrawal requires an admin to manually send money via MoMo or bank transfer and mark it paid. At scale this becomes the #1 bottleneck and trust-destroyer. Automated payout rails (Paystack Transfer API, Flutterwave Payouts, or Chimoney) must be a priority. | Critical |
| 02 | **No retention or re-engagement mechanisms.** The platform has no push notifications, no post-job email sequences, no "rebook your last provider" prompt, and no loyalty incentive. Without these, the cost of acquiring each user is paid once and they churn. | Critical |
| 03 | **Dispute resolution is entirely human-mediated with no tooling.** Admins receive evidence uploads but have no structured resolution wizard, no resolution SLA, no automatic escrow hold extension during dispute, and no appeals process. | Critical |
| 04 | **No inventory or stock management for marketplace.** Farmers must manually edit their listing when out of stock. No quantity tracking, no sold-out state, no back-in-stock notification. | Major |
| 05 | **Driver logistics is entirely passive — no dispatch.** Drivers claim from a list. No algorithm routing the closest online driver, no guaranteed pickup SLA, no driver notification when a relevant delivery becomes available. | Major |
| 06 | **No subscription or premium tier for providers.** Artisans and farmers pay a per-transaction fee only. No "Pro" tier for featured placement, lower fees, or advanced analytics. | Major |
| 07 | **Recurring jobs are metadata only — no automated billing.** A buyer can mark a job "weekly recurring" but the platform does not auto-create the next job or charge the buyer. | Major |
| 08 | **No full-text search across marketplace or provider directory.** Browse and filter exist, but no keyword search for products or providers. | Major |
| 09 | **No analytics for providers or buyers.** Artisans have wallet and transactions but no earnings charts, quote conversion rate, profile views, or booking trends. Farmers have no order volume analytics. | Minor |
| 10 | **HEIC image upload known to fail** — documented limitation. iPhone users default to HEIC; on a mobile-first market like Ghana this affects a meaningful proportion of seller uploads. | Minor |

---

## What's Working Well

- **Multi-vertical architecture** — Domestic, Events, Marketplace, Logistics, and B2B all under one roof, with feature flags to roll verticals in/out.
- **Escrow-first trust model** — Building escrow from day one is the right call. Auto-release timer reduces admin burden.
- **Availability calendar on public profiles** — Buyers can self-qualify before reaching out, reducing wasted quote cycles.
- **Florist vertical is well-considered** — Occasion/gift-message/delivery-date at checkout and by-date tab default are thoughtful.
- **B2B shift management is genuinely complete** — Recurring shifts, geo-fenced check-in, no-show tracking, workforce lists.
- **Book-from-profile pre-fill flow** — "Book" CTA pre-filling job form with service + invited artisan ID is an excellent conversion optimisation.
- **Separate admin auth + audit log** — Operational maturity. Feature flags for vertical enablement support staged rollout.
- **Public trust pages** — /trust/escrow, /trust/verification, /trust/reviews as shareable, linkable pages for marketing.

---

## Top 10 Priority Recommendations

| # | Recommendation | Impact |
|---|----------------|--------|
| 1 | **Automate Payouts via Paystack Transfer API** — Replace manual MoMo/bank with automated payout rails. Set thresholds for auto-pay vs manual review for large amounts. | Revenue · Trust |
| 2 | **Build Rebook & Re-engagement Loops** — Email + push after job completion: "Rebook [Artisan name]?". 7-day and 30-day win-back. Escrow release = re-engagement trigger + NPS + rebook CTA. | Retention · LTV |
| 3 | **Introduce Artisan Pro / Featured Tier** — Monthly subscription: featured placement, reduced fee (e.g. 5%), profile badge, analytics dashboard, priority dispute resolution. | Monetisation |
| 4 | **Add Real Inventory Management** — Quantity tracking, auto-hide when stock = 0, restock notification. Prevents overselling and order cancellations. | Ops · Quality |
| 5 | **Implement Driver Dispatch Algorithm** — Notify nearest online driver via push when delivery is created. Auto-assign if unclaimed after N minutes. ETA to buyer and farmer. | Logistics · NPS |
| 6 | **Automate Recurring Jobs** — Weekly/monthly recurring jobs auto-generate next instance on completion + auto-charge from saved card. Core of Domestic Services value prop. | Retention · GMV |
| 7 | **Full-text Search with Relevance Ranking** — Postgres FTS or Meilisearch across providers, products, job categories. Geosearch radius + category + availability as filters. | Discovery · Conversion |
| 8 | **Provider Analytics Dashboard** — Profile views, quote conversion rate, earnings trend, best-performing service, top categories. Supply-side retention. | Supply Retention |
| 9 | **Referral Programme** — Unique referral links for buyers and artisans. Credit on first completed job. High-ROI growth mechanic currently absent. | Growth · CAC |
| 10 | **Fix HEIC / Mobile Image Uploads** — Convert HEIC to JPEG server-side (Sharp.js or Cloudinary). Quick win for mobile-first sellers. | Quick Win · Supply |

---

## Summary

**72 / 100** — LocalLink is architecturally ahead of where most marketplace startups are at this stage. Six roles, escrow, social layer, and B2B shift management in one product is genuinely rare. The path to 85+ is clear: automate payouts, build retention loops, add a subscription tier, and implement real search. None of these require reinvention — they require execution of what's already designed.

---

*Report derived from full codebase and feature audit. See also [BENEFITS_BY_USER_TYPE.md](./BENEFITS_BY_USER_TYPE.md) and [FULL_FEATURE_LIST_BY_USER_TYPE.md](./FULL_FEATURE_LIST_BY_USER_TYPE.md).*
