# LocalLink competitiveness assessment

Comparison vs. LinkedIn, Checkatrade, Monster/Reed/CV Library, and Amazon-style marketplaces — and what would close the gap.

---

## Executive summary

| Versus | LocalLink as % competitive | In one line |
|--------|----------------------------|-------------|
| **LinkedIn** (professional network + jobs) | **~35%** | You have jobs, profiles, endorsements, feed, messaging — but no recruiter tools, no “connections” graph, no learning/certifications, no salary insights, no company pages at LinkedIn scale. |
| **Checkatrade** (trusted trades) | **~50%** | You have verified artisans, reviews, escrow, bookings, quotes — but no guarantee scheme, no “Find a tradesperson” SEO funnel, no trade-specific categories/quals, weaker brand trust. |
| **Monster / Reed / CV Library** (job boards) | **~45%** | You have job posts, applicants, shortlist, company dashboard, shifts — but no CV parsing, no ATS integration, no job alerts, no salary bands/benchmarks, no recruiter branding. |
| **Amazon** (marketplace + delivery) | **~30%** | You have products, orders, search, delivery flow, escrow — but no reviews on products, no 1-click, no recommendations, no fulfilment network, no returns/refunds flow. |

**Overall (blended): LocalLink today is roughly 38–42% “competitive”** with the best-in-class in each of those categories **in their core domain**. As a **single integrated platform** (local services + jobs + produce + B2B hiring + social), LocalLink is differentiated; the gap is depth and polish in each vertical, plus scale/trust/ops.

---

## 1. Where LocalLink is strong (vs. these platforms)

- **Multi-vertical in one place:** Services, produce, B2C jobs (buyer–artisan), B2B jobs (company hiring), delivery, feed, messaging — no single competitor does all of this in one product.
- **Trust stack:** Verification tiers, ID verification, reviews, escrow, disputes, keyword moderation, support tickets — comparable in *shape* to Checkatrade/Amazon trust.
- **Money flows:** Escrow (jobs + orders), Paystack, wallets, platform fees, affiliate commissions — real payments, not just leads.
- **Roles and dashboards:** Buyer, artisan, farmer, driver, company, admin, affiliate — each has a real workflow (post job, quote, assign, escrow; list products; run shifts; etc.).
- **Discovery:** Search (products + providers), filters, map (products/services/jobs), match algorithm for artisans, saved providers, job templates.
- **Content and authority:** News, About/Contact/Careers, verification/trust/escrow pages — supports SEO and trust.
- **Admin and ops:** User management, disputes, moderation, support, payouts, feature flags, audit-style tooling.

So **foundation and breadth** are good; the shortfall is **depth per vertical** and **production-grade scale/UX**.

---

## 2. Gaps to close (prioritised)

### Critical (blockers for “feels like” a top platform)

| Gap | Why it matters | Comparable to |
|-----|----------------|---------------|
| **Transactional comms** | Quotes, orders, disputes, escrow releases need email (and ideally SMS) so users don’t miss critical steps. | All: Monster, Checkatrade, Amazon send emails. |
| **Media storage (S3/R2/Cloudinary)** | Uploads must be durable and CDN-served; local files don’t scale or survive. | All. |
| **Product reviews** | Marketplace has reviews for jobs/orders but not per-product; trust and SEO suffer. | Amazon, Checkatrade. |
| **Returns/refunds policy and flow** | Clear policy + UI for “request return/refund” and admin resolution. | Amazon, marketplaces. |

### High impact (clear competitiveness gains)

| Gap | Why it matters | Comparable to |
|-----|----------------|---------------|
| **Job alerts / saved searches** | “Notify me when a job matching X is posted” — core expectation on job boards. | Monster, Reed, CV Library. |
| **CV upload + profile** | Job seekers need a CV and a profile that companies can view; you have work history but not “CV” as first-class. | LinkedIn, Reed, CV Library. |
| **Recruiter/company branding** | Company page, logo, “Why work with us,” featured jobs — you have company page; needs polish and prominence. | LinkedIn, Reed. |
| **Category/qualification depth** | Trades and services need subcategories and “qualified for X” (e.g. gas-safe, certified electrician). | Checkatrade. |
| **Guarantee or insurance messaging** | “Verified” is good; “Guarantee” or “insured work” (even as messaging) increases conversion. | Checkatrade. |
| **Recommendations and “people also viewed”** | “Others who viewed this also viewed…” and “Recommended for you” on products/services/jobs. | Amazon, LinkedIn. |
| **Sitemap + robots + structured data** | JobPosting, Product, LocalBusiness schema and sitemaps for jobs/products/pages. | All (SEO). |

### Medium impact (polish and retention)

| Gap | Why it matters |
|-----|----------------|
| **PWA / installable** | manifest.json, install prompt — better mobile retention. |
| **Consistent list API** | `{ items, next, total }` and cursor/offset docs — easier clients and future apps. |
| **API versioning** | `/api/v1/` and compatibility policy — safe evolution. |
| **In-app notifications** | You have push and inbox; ensure every critical action (quote, assignment, release, dispute) triggers a clear in-app + email. |
| **Onboarding nudges** | After signup: “Complete your profile,” “Add your first service,” “Post your first job” — short wizard or checklist. |
| **Empty states and error copy** | Every list/detail has a clear empty state and actionable error messages (already started; extend everywhere). |

### Lower priority (scale and brand)

| Gap | Why it matters |
|-----|----------------|
| **Salary bands / benchmarks** | Job boards often show “Salary range for this role” or market data. |
| **Learning/certifications** | LinkedIn Learning / credentials; you have experience badges — could extend to “certifications.” |
| **ATS / recruiter integrations** | Export applicants, webhooks for “new applicant” — for larger employers. |
| **Multi-currency / multi-country** | If you expand beyond Ghana, currency and locale. |

---

## 3. Design and UX developments that add the most

1. **Trust and clarity**
   - Verification badges and “What verified means” on every relevant surface (service card, profile, job post).
   - Escrow explained in one line at point of payment: “Your payment is held until the work is done.”
   - Clear status for every flow: job (posted → quoted → assigned → in progress → completed), order (placed → confirmed → dispatched → delivered), dispute (open → under review → resolved).

2. **Discovery and relevance**
   - Search that feels instant (debounce, suggestions, recent searches already there).
   - Filters that map to how people think: “Under 50 km,” “Verified only,” “Available this week,” “Price range.”
   - “Recommended for you” and “Based on your recent views” (needs tracking + backend).

3. **Mobile-first**
   - Tap targets and spacing for thumbs; primary actions (Book, Apply, Pay) always visible or one tap away.
   - One-column layouts on small screens; sticky CTAs where it helps.
   - Push and in-app notifications that deep-link to the right screen (job, order, message).

4. **Consistency**
   - Same card pattern for “service” vs “product” vs “job” where it makes sense (image, title, key meta, CTA).
   - Same empty states: illustration or icon + title + short explanation + primary action.
   - Same loading (skeleton or spinner) and error (message + retry/back) patterns.

5. **Onboarding and activation**
   - Role-specific “Get started” (e.g. buyer: “Find a service”; artisan: “Add your first service”; company: “Post your first job”).
   - Progress or checklist: “Profile 80% complete,” “Add a photo to get more views.”

---

## 4. Suggested development order (to raise competitiveness)

**Phase 1 (foundation)**  
- Transactional email (and SMS if feasible) for quotes, orders, escrow, disputes.  
- Media storage (S3/R2/Cloudinary) and migrate uploads.  
- Product reviews (model + API + UI on product detail).  
- Returns/refunds: policy page + “Request return” and admin resolution.

**Phase 2 (depth in each vertical)**  
- Job alerts / saved searches for job seekers.  
- CV upload + “Apply with CV” and company-facing applicant profile.  
- Richer categories and “qualifications” for services.  
- Recommendations (“Similar services,” “Others also viewed”).  
- SEO: sitemap, robots, JobPosting/Product/LocalBusiness schema.

**Phase 3 (polish and retention)**  
- PWA (manifest + install).  
- Onboarding wizard/checklist and activation emails.  
- Consistent list API and API versioning.  
- Salary bands or “typical range” for job posts (if data exists).

**Phase 4 (scale and brand)**  
- Guarantee/insurance messaging.  
- ATS-style export or webhooks for companies.  
- Learning/certifications if you want to lean into “credentials.”

---

## 6. Progress tracker

Use this section to mark items as you ship. Update **Last updated** when you edit.

**Last updated:** (fill in when you edit)

### Critical

| Gap | Status | Notes |
|-----|--------|-------|
| **Transactional comms (email/SMS)** | **Done** | Order confirmed, quote received, escrow released emails via mailer (SMTP from env). |
| Media storage (S3/R2/Cloudinary) | Not started | S3/R2 already wired in storage driver; set STORAGE_DRIVER=s3 + S3_* to use. |
| **Product reviews** | **Done** | Migration 128, API /api/reviews/products, product detail shows summary + list + Leave review. |
| **Returns/refunds policy and flow** | **Done** | /trust/returns policy page; "Request return/refund" from buyer orders opens support ticket (category=orders). |

### High impact

| Gap | Status | Notes |
|-----|--------|-------|
| **Job alerts / saved searches** | **Done** | Migration 129, GET/POST/DELETE /api/corporate/job-alerts; "Notify me when jobs match" on Jobs board; new job posts trigger in-app notification to matching subscribers. |
| CV upload + profile | Not started | |
| Recruiter/company branding | Not started | |
| Category/qualification depth | Not started | |
| Guarantee/insurance messaging | Not started | |
| Recommendations (Similar, Also viewed) | Not started | |
| **Sitemap + robots** | **Done** | frontend/public/robots.txt and sitemap.xml with main routes. Per-page schema (JobPosting, Product) can be added later. |

### Phase 3 and 4

| Gap | Status | Notes |
|-----|--------|-------|
| PWA / installable | Not started | |
| Consistent list API + API versioning | Not started | |
| Onboarding nudges | Not started | |
| Salary bands / benchmarks | Not started | |
| ATS / recruiter integrations | Not started | |

---

## 5. Bottom line

- **Percentage:** LocalLink is about **38–42%** competitive with the best-in-class in each reference platform’s *core* domain (LinkedIn, Checkatrade, Monster/Reed, Amazon), but it’s **one platform** doing jobs + services + produce + B2B hiring + social.
- **Biggest gaps:** Reliable transactional comms, durable media storage, product-level reviews, returns/refunds, job alerts, CV-centric job seeker experience, and SEO/sitemap/schema. Closing these would move the needle the most.
- **Design focus:** Trust and clarity, discovery and relevance, mobile-first, consistency, and onboarding/activation will make the platform feel more “finished” and user-friendly.

This doc can be updated as you ship the above (e.g. “Transactional email: done; Product reviews: done”) and re-scored annually (e.g. “Checkatrade-like: 50% → 65%”).
