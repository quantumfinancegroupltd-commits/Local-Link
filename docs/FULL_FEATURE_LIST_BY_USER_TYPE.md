# LocalLink — Full Feature List by User Type

**Purpose:** Exhaustive list of every feature, screen, and capability per user type. No stone unturned.

**Source:** Codebase (routes, pages, APIs) + [BENEFITS_BY_USER_TYPE.md](./BENEFITS_BY_USER_TYPE.md).  
**Last generated:** 2025-02.

---

## Table of contents

1. [Guest / Unauthenticated](#1-guest--unauthenticated)
2. [Buyer](#2-buyer)
3. [Artisan (Provider)](#3-artisan-provider)
4. [Farmer](#4-farmer)
5. [Florist (Farmer vertical)](#5-florist-farmer-vertical)
6. [Driver](#6-driver)
7. [Company (Employer)](#7-company-employer)
8. [Admin](#8-admin)
9. [Shared / Cross-cutting](#9-shared--cross-cutting)
10. [Public routes (all)](#10-public-routes-all)

---

## 1. Guest / Unauthenticated

| Feature | Description |
|--------|-------------|
| **Home** | `/` — Landing, vertical tiles (Events, Domestic, Florist, B2B, Logistics), trust copy, CTA. |
| **Login** | `/login` — Email + password; redirect param support. |
| **Register** | `/register` — Role selection (buyer, artisan, farmer, driver, company); email, name, password; optional referral code (?ref= or ?referral=). |
| **Forgot password** | `/forgot-password` — Request reset email (SMTP-dependent). |
| **Reset password** | `/reset-password` — Set new password via token. |
| **Onboarding** | `/onboarding` — Role-based intro / value prop. |
| **Onboarding adverts** | `/adverts` — Marketing / ad content. |
| **Corporate landing** | `/corporate` — B2B / hiring landing. |
| **Jobs board (public)** | `/jobs` — Browse company job postings; apply (may require login). |
| **Job detail (public)** | `/jobs/:id` — Single job posting; apply. |
| **Company public** | `/c/:slug` — Public company page (jobs, about). |
| **Marketplace browse** | `/marketplace` — Browse products (produce/flowers); filter by category, location, price, tier. |
| **Product detail** | `/marketplace/products/:id` — View product; sign-in required to order. |
| **Providers (public)** | `/providers` — Browse artisan/provider cards; link to public profile. |
| **Public profile** | `/u/:id` — View any user’s public profile (posts, about, services, availability, reviews). |
| **About** | `/about` — Static about page. |
| **Contact** | `/contact` — Contact form/info. |
| **Careers** | `/careers` — Careers page. |
| **News** | `/news` — News listing. |
| **News post** | `/news/:slug` — Single article. |
| **Trust: Escrow** | `/trust/escrow` — How escrow works. |
| **Trust: Verification** | `/trust/verification` — Verification tiers. |
| **Trust: Reviews** | `/trust/reviews` — How reviews work. |

---

## 2. Buyer

### Routes & access

| Route | Description |
|-------|-------------|
| `/buyer` | Buyer “today” / home. |
| `/buyer/jobs` | My jobs list (all jobs I posted). |
| `/buyer/jobs/new` | Post a new job. |
| `/buyer/jobs/:id` | Job detail (quotes, accept, lifecycle). |
| `/buyer/jobs/:id/escrow` | Fund escrow, release, dispute. |
| `/buyer/payments/paystack` | Paystack callback after payment. |
| `/buyer/providers` | Browse/save providers (artisans). |
| `/buyer/orders` | Marketplace orders (status, tracking). |

### Job posting

| Feature | Detail |
|--------|--------|
| **Title, description** | Required; rich text. |
| **Category** | Skilled Labour, Events & Catering, Domestic Services, etc. (JOB_CATEGORIES_TIER1). |
| **Location** | Address + optional place ID, lat/lng. |
| **Budget** | Optional; helps providers quote. |
| **Media** | Optional photos/video (upload). |
| **Event date** | For Events & Catering. |
| **Recurring** | Weekly/monthly + end date for Domestic. |
| **Access instructions** | E.g. key code, gate (cleaning). |
| **Event fields** | Head count, menu notes, equipment (catering). |
| **Draft autosave** | Local draft for post-job form. |
| **Pre-fill from provider** | From artisan profile “Book” → pre-fill service/title; optional `invited_artisan_user_id`. |

### Job lifecycle (buyer side)

| Feature | Detail |
|--------|--------|
| **View quotes** | See all quotes per job; provider profile, amount, message. |
| **Accept quote** | One acceptance; job assigned; prompted to fund escrow. |
| **Pay (Paystack)** | Card / mobile money; funds go to escrow. |
| **Job states** | New → Quoted → Assigned → In progress → Completed (or Cancelled, Disputed). |
| **Release escrow** | After artisan marks complete; release to provider (minus platform fee). |
| **Dispute** | Open dispute; upload evidence; admin resolves. |
| **Report no-show** | For assigned job; support ticket. |
| **Cancel** | When allowed by state. |

### Marketplace & orders

| Feature | Detail |
|--------|--------|
| **Browse marketplace** | `/marketplace` — filter category, location, price, verification; full-text search via API. |
| **Product detail** | Quantity, delivery address, delivery fee quote (distance-based); out-of-stock → "Notify me when back in stock". |
| **Florist-only fields** | For category Flowers/Plants: delivery date (optional), occasion (dropdown), gift/card message. |
| **Place order** | Pay via Paystack; order created; farmer notified. |
| **Orders list** | `/buyer/orders` — status: pending, confirmed, dispatched, delivered, cancelled. |
| **Delivery tracking** | When driver assigned; status updates. |
| **Order disputes** | Evidence; admin resolution. |

### Providers & discovery

| Feature | Detail |
|--------|--------|
| **Browse providers** | `/buyer/providers` — search, location, tier, rating. |
| **Provider card** | Name, profession, location, trust badge, verification, rating. |
| **Public profile** | `/u/:id` — services, availability calendar, reviews, “Book” CTA. |
| **Book from profile** | Direct link to post job with artisan + service pre-filled. |

### Reviews & trust

| Feature | Detail |
|--------|--------|
| **Leave review** | `/reviews/leave` — after job/order; rating + text. |
| **View reviews** | On public profiles; trust/reviews page. |

### Shared (buyer has access)

| Feature | Detail |
|--------|--------|
| **Profile** | `/profile` → MyProfile (buyer view). |
| **Messages** | `/messages` — inbox; thread by job/order. |
| **Notifications** | `/notifications`. |
| **Support** | `/support` — tickets. |
| **Feed** | `/feed` — social feed. |
| **People** | `/people` — discover users. |
| **Company invite** | `/company/invite` — accept company invite (e.g. for shifts). |
| **Company dashboard** | `/company` — if invited; view as non-company. |
| **My shifts** | `/shifts` — shifts assigned to me (e.g. as worker). |

### Payments & money (buyer)

| Item | Detail |
|------|--------|
| **In** | N/A (buyer pays in). |
| **Out** | Pay per job (escrow) and per order (marketplace) via Paystack. |
| **Fees** | Job escrow: platform fee (e.g. 8%) on released amount. Order: included in price; platform fee on seller side. |
| **No buyer wallet** | Each job/order is a separate payment. |

### Limitations (buyer)

- No in-app buyer wallet; no standing order or subscription.
- Recurring is job metadata only; no automated recurring billing.
- Dispute resolution is admin-mediated.
- Marketplace delivery depends on drivers; no guaranteed same-day.
- Paystack must be configured for payments.

---

## 3. Artisan (Provider)

### Routes & access

| Route | Description |
|-------|-------------|
| `/artisan` | Artisan dashboard (pipeline, wallet, quick actions). |
| `/artisan/jobs/:id` | Job detail: quote, start, complete, proof, escrow. |
| `/artisan/jobs/:id/escrow` | Escrow view (release/dispute by buyer; artisan sees status). |
| `/artisan/services` | CRUD productized services (fixed price, duration, image). |
| `/artisan/availability` | Set availability calendar (dates available for booking). |
| `/artisan/analytics` | Profile views, quotes sent, jobs completed, conversion rate, wallet balance, earnings. |

### Job pipeline

| Feature | Detail |
|--------|--------|
| **Tabs** | All, New, Quoted, Booked, In progress, Completed, By date, etc. |
| **Filters** | Category, search. |
| **New jobs** | Open jobs; “Matches your services” when category in artisan job_categories. |
| **Submit quote** | Amount, message, optional availability text, warranty, materials. |
| **Invited jobs** | When job has invited_artisan_id (from “Book” on profile); only that artisan sees it in pipeline. |
| **Start job** | Mark job in progress (after escrow funded). |
| **Mark complete** | Triggers buyer release or dispute. |
| **Work proof** | Upload before/after photos or video + note; visible to buyer and in disputes. |

### Productized services (artisan)

| Feature | Detail |
|--------|--------|
| **List services** | Title, description, price, currency, duration (days/hours/minutes), category, image. |
| **Add service** | Image upload (optional); duration as days + hours + minutes. |
| **Edit / remove** | Per service. |
| **Display** | On public profile; duration shown in hierarchy (e.g. “1 week”, “2 hours 30 minutes”). |
| **Book from profile** | Buyer can “Book” → pre-fill job with service details + invited artisan. |

### Availability (artisan)

| Feature | Detail |
|--------|--------|
| **Set availability** | Calendar: mark dates available for bookings. |
| **Controls** | Prev/next month, Today, month/year dropdown; click date to toggle. |
| **Past dates** | Disabled (cannot change). |
| **Profile display** | Public profile shows availability calendar (read-only); visitors can browse months. |

### Wallet & payouts

| Feature | Detail |
|--------|--------|
| **Balance** | Available, pending (in escrow), completed this month. |
| **Withdraw** | Request withdrawal (amount, method: MoMo/bank); creates payout for admin. |
| **Transactions** | List of credits (from released escrow). |
| **Payouts** | List of withdrawal requests; status (pending/paid/cancelled). |
| **Fees** | Platform fee (e.g. 8%) deducted before wallet credit. |

### Disputes & verification

| Feature | Detail |
|--------|--------|
| **Disputes** | View disputed jobs; submit evidence; admin resolves. |
| **ID verification** | `/verify` — Ghana Card + selfie for trust badge. |

### Profile & reputation

| Feature | Detail |
|--------|--------|
| **Public profile** | `/u/:id` — services, availability, reviews, skills, job categories; "Pro" badge when premium. |
| **My profile** | `/profile` — edit bio, skills, service area, job categories, links, resume, badges; referral code + invite link. |
| **Reviews** | `/reviews` — reviews received. |
| **Analytics** | `/artisan/analytics` — profile views, quotes sent, jobs completed, conversion rate, wallet, earnings. |

### Export & tools

| Feature | Detail |
|--------|--------|
| **Export pipeline** | CSV of jobs (filtered view). |
| **Copy link** | Share pipeline link (e.g. for support). |

### Shared (artisan has access)

| Feature | Detail |
|--------|--------|
| **Messages** | Inbox, thread (by job). |
| **Notifications** | In-app. |
| **Support** | Tickets. |
| **Feed, People** | Social. |
| **Company** | If invited; company dashboard, shifts. |
| **My shifts** | `/shifts` — shifts assigned. |

### Limitations (artisan)

- Payouts manual (admin marks paid).
- No built-in calendar view of jobs by date (pipeline by status only).
- Cannot see other artisans’ quotes; only that job has quotes.
- Auto-release: escrow may auto-release after configured hours if buyer does nothing.

---

## 4. Farmer

### Routes & access

| Route | Description |
|-------|-------------|
| `/farmer` | Farmer dashboard (vertical toggle: Farmer / Florist). |
| `/farmer/orders` | Orders list; tabs (e.g. by status, by date). |
| `/farmer/products/new` | Add product. |
| `/farmer/products/:id/edit` | Edit product. |

### Dashboard (farmer)

| Feature | Detail |
|--------|--------|
| **Vertical toggle** | “View as: Farmer | Florist” (stored in localStorage). |
| **Summary cards** | Wallet balance, pending, completed this month. |
| **Quick actions** | List produce, Orders, Messages. |
| **Farm location** | Prompt to set if missing (profile). |
| **Verify banner** | ID verification CTA. |

### Products (listings)

| Feature | Detail |
|--------|--------|
| **Fields** | Name, category (vegetables, fruits, flowers, plants, grains, poultry, other), quantity, unit (kg, crate, bunch, bouquet, stem, etc.), price, image/media. |
| **Media** | Up to 12 files, 50MB each; image/video; or photo URL fallback. |
| **Recipe** | Optional (e.g. bouquet contents). |
| **Florist default** | When vertical is florist, new product can default to Flowers + bouquet. |
| **Status** | Active/draft; hide from marketplace. |

### Orders

| Feature | Detail |
|--------|--------|
| **List** | By status (pending, confirmed, dispatched, delivered, cancelled) or by date. |
| **Confirm** | Confirm order. |
| **Dispatch** | Mark dispatched; optional delivery request. |
| **Deliver** | Mark delivered (or driver confirms). |
| **Delivery date** | Shown when buyer set requested_delivery_date (florist flow). |
| **Occasion / message** | Shown when buyer set occasion or gift_message (florist flow). |

### Wallet & payouts

| Feature | Detail |
|--------|--------|
| **Same model as artisan** | Available, pending, completed; withdraw request; admin marks paid. |
| **Fee** | e.g. 5% platform fee on orders. |

### Shared (farmer)

- Profile, messages, notifications, support, feed, people, verify, company (if invited), shifts.

### Limitations (farmer)

- Payouts manual.
- Delivery depends on drivers claiming; no guaranteed window.

### Recent improvements (farmer)

- **Inventory:** Quantity enforced on order; decremented when payment succeeds; status set to out_of_stock when quantity = 0. Restock notifications: buyers can subscribe; when product goes back in stock, in-app notification.
- **HEIC:** iPhone HEIC images converted to JPEG on upload.

---

## 5. Florist (Farmer vertical)

Florists use the **same** farmer account and dashboard; “Florist” is a **view mode** (vertical) with different copy and behaviour.

| Feature | Detail |
|--------|--------|
| **Dashboard label** | “Florist”; subtitle about delivery date and occasion. |
| **Orders open in “By date”** | FarmerOrders defaults to by-date tab when vertical is florist. |
| **List flowers** | Same product form; category Flowers/Plants; units bouquet, stem. |
| **Buyer checkout (florist products)** | Only when product category is Flowers or Plants: delivery date (optional), occasion (dropdown), gift/card message (optional). |
| **Order display** | requested_delivery_date, occasion, gift_message shown in farmer order detail. |
| **No separate florist dashboard** | Same FarmerDashboard; no “orders by occasion” filter or florist-only analytics. |

---

## 6. Driver

### Routes & access

| Route | Description |
|-------|-------------|
| `/driver` | Driver dashboard (profile, online, deliveries, wallet). |

### Profile & approval

| Feature | Detail |
|--------|--------|
| **Driver profile** | Vehicle type, operating area, radius; submit for admin approval. |
| **Approval** | Until approved, cannot go online or claim deliveries. |

### Delivery lifecycle

| Feature | Detail |
|--------|--------|
| **Go online / offline** | Toggle; optional GPS for ranking. |
| **Available deliveries** | List of delivery jobs (pickup/dropoff, fee). |
| **Claim** | Claim a delivery. |
| **Status updates** | Picked up → On the way → Delivered. |
| **Fee** | Base + per-km; platform cut (e.g. ~16.67%); released when delivery confirmed (or auto-confirm after e.g. 48h). |

### Wallet & disputes

| Feature | Detail |
|--------|--------|
| **Wallet** | Available (from released fees), pending; withdraw request; admin marks paid. |
| **Disputes** | Delivery disputes; admin resolution. |

### Shared (driver)

- Verify, messages, notifications, support, profile, feed, people, company (if invited), shifts.

### Limitations (driver)

- Admin approval required to earn.
- Payouts manual.
- No guaranteed delivery volume; no in-app navigation.

---

## 7. Company (Employer)

### Routes & access

| Route | Description |
|-------|-------------|
| `/company` | Company dashboard (multi-company switch). |
| `/company/public` | Redirect to own public company page. |
| `/company/invite` | Accept invite to a company. |
| `/c/:slug` | Public company page (any company). |

### Company profile

| Feature | Detail |
|--------|--------|
| **Profile** | Name, industry, size, website, location, description, logo, cover. |
| **Public page** | For candidates; jobs, about. |

### Job roles (hiring)

| Feature | Detail |
|--------|--------|
| **Post jobs** | Title, location, type (full-time, part-time, etc.), mode (onsite/remote), pay range, pay period, benefits, description, tags. |
| **Jobs board** | `/jobs` — public listing; apply. |
| **Applications** | Per job: view, shortlist, contact, reject, hire; notes; rate (preferred/blocked). |
| **Templates** | Message templates for applicants. |

### Workforce & shifts

| Feature | Detail |
|--------|--------|
| **Workforce lists** | Create lists (e.g. Waiters, Cleaners); add workers by user. |
| **Shifts** | Create shift: title, role, location, start/end, headcount, optional geo-fence. |
| **Assign workers** | Assign users to shifts. |
| **Check-in codes** | Generate codes; workers check in (code or geo). |
| **Recurring** | Templates + series; auto-generate shift instances (e.g. next 12 weeks). |
| **No-show** | Configurable grace; mark no-show. |
| **Payroll** | UI for pay period, term, etc.; no in-app payment execution. |

### Ops & insights

| Feature | Detail |
|--------|--------|
| **Ops settings** | No-show grace, complete grace, series auto-gen; some set by admin. |
| **Analytics** | Basic counts, alerts (no-shows, gaps); depth varies. |

### Limitations (company)

- No in-app payroll; pay workers outside platform.
- Some payroll/insights fields “coming later” or placeholders.

---

## 8. Admin

### Routes & access

| Route | Description |
|-------|-------------|
| `/admin` | Admin dashboard (gate). |
| `/admin/login` | Admin login (separate auth). |
| `/admin/set-password` | Set admin password. |

### Feature flags & config

| Feature | Detail |
|--------|--------|
| **Feature flags** | Enable/disable verticals (e.g. B2B, logistics) and toggles; affects Home “Coming soon” etc. |

### Disputes

| Feature | Detail |
|--------|--------|
| **List disputes** | Job and delivery escrow disputes. |
| **Resolve** | View evidence; release to provider, refund buyer, or split. |

### Payouts

| Feature | Detail |
|--------|--------|
| **List payouts** | All withdrawal requests (artisan, farmer, driver). |
| **Mark paid** | After sending money externally (MoMo, bank). |
| **Cancel** | Cancel payout; money stays in wallet. |

### Users & moderation

| Feature | Detail |
|--------|--------|
| **Users** | View users, roles; suspend/unsuspend. |
| **Moderation** | Posts, comments, keyword filters; block/flag. |
| **Driver approval** | Approve/reject driver profiles. |

### Analytics & ops

| Feature | Detail |
|--------|--------|
| **Dashboard** | Counts (users, jobs, orders, escrows, payouts pending); stuck signals (e.g. escrow > 12h, payouts > 6h); scheduler health. |
| **Audit** | Audit log for admin actions. |

### Limitations (admin)

- All payouts and dispute resolution are manual; no auto-payout or automated dispute rules.

---

## 9. Shared / Cross-cutting

### Auth & account

| Feature | Detail |
|--------|--------|
| **Register** | Role: buyer, artisan, farmer, driver, company. |
| **Login / logout** | Email/password; redirect. |
| **Forgot / reset password** | Email-based (SMTP). |
| **Profile** | `/profile` — MyProfile (role-specific fields); referral code + "Copy referral link" for all roles. |
| **Public profile** | `/u/:id` — view any user (posts, about, services, availability, reviews). |
| **Follow** | Follow users; private profile request (if enabled). |
| **Referral** | Each user has a referral code; share link; referrer gets wallet credit when referee completes first job (artisan). |

### Messaging & notifications

| Feature | Detail |
|--------|--------|
| **Inbox** | `/messages` — conversations by job/order/thread. |
| **Thread** | `/messages/:type/:id` — conversation view. |
| **Notifications** | `/notifications` — in-app. |

### Support & trust

| Feature | Detail |
|--------|--------|
| **Support** | `/support` — create/view tickets; reply; attachments (artisan, farmer, driver, admin; buyer via other flows). |
| **Trust: Escrow** | `/trust/escrow` — how escrow works. |
| **Trust: Verification** | `/trust/verification` — verification tiers. |
| **Trust: Reviews** | `/trust/reviews` — how reviews work. |
| **ID verification** | `/verify` — Ghana Card + selfie (artisan, farmer, driver). |

### Social & discovery

| Feature | Detail |
|--------|--------|
| **Feed** | `/feed` — social feed (posts, likes, comments). |
| **People** | `/people` — discover users. |

### Company & shifts (non-company roles)

| Feature | Detail |
|--------|--------|
| **Company invite** | `/company/invite` — accept invite (buyer, artisan, farmer, driver). |
| **Company dashboard** | `/company` — access if member. |
| **My shifts** | `/shifts` — view shifts assigned to me (buyer, artisan, farmer, driver). |

### Payments (cross-cutting)

| Flow | Fee (example) | Escrow | Payout |
|------|----------------|--------|--------|
| Job (buyer → artisan) | 8% | Paystack | Wallet → manual withdraw |
| Order (marketplace) | 5% | Paystack | Wallet → manual withdraw |
| Delivery | ~16.67% of fee | Yes | Wallet → manual withdraw |

- **Auto-release:** Jobs e.g. 72h after complete; deliveries e.g. 48h after delivery.
- **Escrow:** Protects both sides; release or dispute.

---

## 10. Public routes (all)

| Route | Who | Description |
|-------|-----|-------------|
| `/` | All | Home. |
| `/login`, `/register` | All | Auth. |
| `/forgot-password`, `/reset-password` | All | Password. |
| `/onboarding`, `/adverts` | All | Onboarding. |
| `/corporate`, `/jobs`, `/jobs/:id` | All | Corporate/jobs. |
| `/c/:slug` | All | Company public. |
| `/marketplace`, `/marketplace/products/:id` | All | Marketplace. |
| `/providers` | All | Provider list. |
| `/u/:id` | All | Public profile. |
| `/about`, `/contact`, `/careers` | All | Static. |
| `/news`, `/news/:slug` | All | News. |
| `/trust/escrow`, `/trust/verification`, `/trust/reviews` | All | Trust. |

---

## Summary matrix (screens per role)

| Role   | Dedicated routes | Shared routes |
|--------|------------------|----------------|
| Buyer  | /buyer, /buyer/jobs, /buyer/jobs/new, /buyer/jobs/:id, /buyer/jobs/:id/escrow, /buyer/payments/paystack, /buyer/providers, /buyer/orders | profile, messages, notifications, support, feed, people, company, shifts, reviews/leave |
| Artisan| /artisan, /artisan/jobs/:id, /artisan/jobs/:id/escrow, /artisan/services, /artisan/availability, /artisan/analytics | profile, messages, notifications, support, feed, people, company, shifts, verify, reviews |
| Farmer | /farmer, /farmer/orders, /farmer/products/new, /farmer/products/:id/edit | profile, messages, notifications, support, feed, people, company, shifts, verify |
| Driver | /driver | profile, messages, notifications, support, feed, people, company, shifts, verify |
| Company| /company, /company/public, /company/invite | profile (→ company/public), messages, notifications, support, feed, people |
| Admin  | /admin, /admin/login, /admin/set-password | — |

---

*End of full feature list. For gaps and target state, see [BENEFITS_BY_USER_TYPE.md](./BENEFITS_BY_USER_TYPE.md).*
