# LocalLink — Benefits by user type (comprehensive & honest)

This document describes **what each user type actually gets**: tools, operations, scheduling, payments, and limitations. It is written to be **accurate and blunt** — no oversell, no hiding gaps.

**Contents:** Overview → At a glance (current vs target) → Do verticals have unique dashboards? → Feature matrix → What’s not done (by theme) → What would “done” look like? → Buyer-side gaps → Recommendations (what to build first) → Codebase pointers → Per-role benefits (Buyer … Admin) → Cross-cutting → Summary.

---

## At a glance: current state vs target state (one page)

| Vertical | Current state (one sentence) | Target state (one sentence) |
|----------|------------------------------|-----------------------------|
| **Events & Catering** | Same artisan pipeline as everyone else; category “Events & Catering” and event-date field only. No calendar, no event workflow, no staff/equipment. | Artisans have an event calendar and event-level workflow (menu, head count, equipment); buyers have “my events” and optional deposit/balance; ops see “events this week”. |
| **Domestic (cleaning)** | Same artisan pipeline; category “Domestic Services” and recurring as a field. No schedule view, no access instructions, no “rebook same slot”. | Artisans have a recurring schedule view and per-client access instructions; buyers have “my recurring cleanings” and one-click rebook; optional recurring billing. |
| **Florist** | Same farmer dashboard as produce; “Flowers” category and bouquet/stem units. No delivery-date view, no occasions, no message card. | Florists see orders by delivery date and occasion; buyers can choose occasion and delivery date/message; “flower delivery” is a first-class flow. |

**Cross-cutting today:** One dashboard per role (artisan, farmer); category is a filter; escrow and payouts are shared and manual. **Cross-cutting target:** Vertical-specific views and workflows where they add the most value; same trust and escrow underneath; auto-payout or clear payout SLA for all providers.

---

## Overview: user types

| Role | Who they are | Primary use case |
|------|----------------|------------------|
| **Buyer** | Individuals or small businesses hiring for one-off or recurring work, or buying produce | Post jobs (catering, cleaning, repairs, etc.); buy from marketplace |
| **Artisan** | Service providers: caterers, cleaners, handymen, event staff | Get job leads, quote, get booked, do work, get paid via escrow |
| **Farmer / Florist** | Sellers of produce, flowers, plants | List products; receive orders; optional delivery; get paid |
| **Driver** | Delivery partners | Claim delivery jobs; update status; earn delivery fees |
| **Company** | Employers hiring staff and managing shifts | Company profile; post job roles; manage applicants; create shifts; assign workers; track attendance |
| **Admin** | Platform operators | Feature flags; disputes; payouts; moderation; analytics |

---

## Do Events, Catering, Cleaning, and Florist have unique dashboards and ops?

**Short answer: No.** There are **no vertical-specific dashboards or ops** for Events & Catering, Domestic (cleaning/laundry), or Florist. They all use the **same** dashboards and flows; the only difference is **category** (a dropdown or filter) and a few **optional fields** on the job or product form.

| Vertical | Role | Dashboard they use | What’s unique in the product |
|----------|------|--------------------|------------------------------|
| **Events & Catering** | Artisan | **ArtisanDashboard** (same as cleaners, plumbers, etc.) | Job category “Events & Catering”; buyer form has event-date field and catering-specific placeholders. Artisan can tick “Events & Catering” in their profile (job_categories) so “Matches your services” shows on new jobs. |
| **Domestic (cleaning / laundry)** | Artisan | **ArtisanDashboard** (same as above) | Job category “Domestic Services”; buyer form has recurring and cleaning-specific placeholders; “Book again” link after a completed Domestic job. Artisan can tick “Domestic Services” in job_categories. |
| **Florist** | Farmer | **FarmerDashboard** (same as vegetable/produce sellers) | Product category “Flowers” and units like “bouquet”, “stem”. No separate florist dashboard, no occasions/orders-by-date, no florist-specific ops. |

So: **caterers and cleaners share one artisan pipeline**; **florists and produce farmers share one farmer dashboard**. There is no “Caterer dashboard”, “Cleaning ops”, or “Florist dashboard” — and a lot is **not** built specifically for them.

---

## What’s still not done for each vertical (honest gap list)

### Events & Catering (artisan = caterer, event staff, equipment)

**Shared today:** One ArtisanDashboard; filter by category “Events & Catering”; job_categories so matching jobs rank higher; buyer can set event date and catering description.

**Not done for them:**

- No **event calendar** or “my events” view (e.g. see all jobs by date).
- No **event-specific workflow** (e.g. menu confirmation, head count lock, equipment checklist).
- No **staff/crew assignment** per event (e.g. assign 3 waiters to one job).
- No **inventory or equipment list** (chairs, tents, etc.) tied to a job.
- Recurring is a **field on the job**, not a first-class “recurring event” or “seasonal calendar”.
- No **caterer-specific analytics** (events per month, revenue by event type).
- **Same escrow and payout** as every other artisan — no event-specific release rules or deposits.

### Domestic / Cleaning / Laundry (artisan = cleaner, laundry)

**Shared today:** One ArtisanDashboard; filter by “Domestic Services”; job_categories; buyer can set recurring and cleaning description; “Book again” for same buyer.

**Not done for them:**

- No **recurring schedule view** (e.g. “every Tuesday at 9am” as a calendar or list).
- No **cleaning checklist or scope** per job (e.g. rooms, tasks) — just free text.
- No **access instructions** template (e.g. key code, gate) stored per client/job.
- No **client recurring profile** (e.g. “same client, every week” as one managed relationship).
- **Book again** is a link to post a new job with category pre-filled — not “rebook this exact recurring slot”.
- No **domestic-specific ops** (e.g. no-show grace for recurring, or “replace cleaner” flow).
- Same **manual payout** as all artisans.

### Florist (farmer role)

**Shared today:** FarmerDashboard; product categories include “Flowers”; units include “bouquet”, “stem”; list/edit products, orders, wallet, withdraw.

**Not done for them:**

- No **florist-specific dashboard** (e.g. “Orders by occasion” or “Delivery dates”).
- No **occasions** (e.g. Valentine’s, Mother’s Day, funeral) as first-class filters or prompts.
- No **order-by-date** or **delivery-date** prominence (e.g. “Orders due tomorrow”).
- No **bouquet builder** or **recipe** (e.g. stems per bouquet); just one product = one listing.
- **Same product form** as produce (name, category, quantity, unit, price, media) — no flower-specific fields (e.g. vase, message card).
- No **florist-specific analytics** (e.g. sales by occasion, peak days).
- **Same marketplace and orders** as all farmers; delivery is generic (driver claim), not “flower delivery by 10am”.
- Image upload and product limits are the same as produce; no special handling for florists.

### Summary: one dashboard per role, category is just a filter

| Role | Dashboards that exist | Vertical-specific? |
|------|------------------------|--------------------|
| Artisan (caterer, cleaner, handyman, etc.) | **1** (ArtisanDashboard) | **No** — same pipeline; category filter + job_categories for ranking. |
| Farmer (produce + florist) | **1** (FarmerDashboard) | **No** — same products/orders/wallet; florist uses “Flowers” category and bouquet/stem units. |

So: **nothing is “done for them” in the sense of dedicated dashboards or vertical ops.** What they get is: **shared flows plus category and a few fields**. The rest (event calendar, recurring schedule view, florist occasions, cleaning checklists, etc.) is **not built yet**.

---

## Feature matrix: Events & Catering vs Domestic vs Florist

| Capability | Events & Catering | Domestic (cleaning) | Florist |
|------------|-------------------|---------------------|---------|
| **Dedicated dashboard** | No (shared ArtisanDashboard) | No (shared ArtisanDashboard) | No (shared FarmerDashboard) |
| **Category in product** | Yes (job category + job_categories on profile) | Yes (job category + job_categories) | Yes (product category “Flowers”, units bouquet/stem) |
| **Calendar or date-first view** | No | No | No |
| **Recurring as first-class** | No (field on job only) | No (field on job only) | N/A (one-off orders only) |
| **Vertical-specific form fields** | Partial (event date, placeholders) | Partial (recurring, placeholders) | Partial (flowers, bouquet unit) |
| **Checklist / scope per job** | No | No | N/A |
| **Occasions or delivery-date prominence** | No | No | No |
| **Staff/crew or equipment per job** | No | No | N/A |
| **Access instructions per client** | No | No | N/A |
| **“Book again” / rebook same slot** | Link to new job (category pre-filled) | Link to new job (category pre-filled) | N/A |
| **Vertical-specific payments** | No (same escrow) | No (same escrow) | No (same order flow) |
| **Vertical-specific analytics** | No | No | No |
| **Wallet & payout** | Same as all artisans (manual) | Same as all artisans (manual) | Same as all farmers (manual) |

**Legend:** “Partial” = some UI copy or one or two fields; no dedicated flow or view.

---

## What’s not done, by theme (expanded)

Gaps grouped by **scheduling**, **payments**, **ops**, **UX/forms**, **analytics**, and **buyer experience** so you can prioritise by theme.

### Scheduling & calendar

| Gap | Events & Catering | Domestic | Florist |
|-----|-------------------|----------|---------|
| Calendar view (my jobs/orders by date) | Missing | Missing | Missing |
| Recurring schedule as a first-class list or calendar | N/A (one-off events) | Missing | N/A |
| “Slots” or “recurring series” for same client | Missing (could be “same client, multiple events”) | Missing | N/A |
| Delivery-date or “due by” prominence | Event date on job only | N/A | Missing (no “deliver by” focus) |
| Reminders or nudges (e.g. event in 7 days, cleaning tomorrow) | Missing | Missing | Missing |

### Payments & money

| Gap | Events & Catering | Domestic | Florist |
|-----|-------------------|----------|---------|
| Deposit vs balance (e.g. 30% now, 70% on event day) | Missing (single escrow only) | Missing | N/A |
| Recurring billing (e.g. weekly cleaning auto-charge) | N/A | Missing | N/A |
| Vertical-specific release rules (e.g. release 50% on setup) | Missing | Missing | N/A |
| Auto-payout to provider (MoMo/bank) | Missing (all roles) | Missing | Missing |

### Ops & admin

| Gap | Events & Catering | Domestic | Florist |
|-----|-------------------|----------|---------|
| Ops view “Events this week” / “Cleanings due” / “Flower orders by date” | Missing | Missing | Missing |
| Bulk actions (e.g. confirm all tomorrow’s deliveries) | Missing | Missing | Missing |
| Vertical-specific dispute reasons or resolution flows | Missing | Missing | Missing |
| SLA or escalation (e.g. payout within 24h) | Missing (all roles) | Missing | Missing |

### UX & forms

| Gap | Events & Catering | Domestic | Florist |
|-----|-------------------|----------|---------|
| Event workflow (menu confirm, head count lock, equipment list) | Missing | N/A | N/A |
| Cleaning checklist or scope (rooms, tasks) | N/A | Missing | N/A |
| Access instructions (key, gate code) per client/job | N/A | Missing | N/A |
| Florist: occasions (Valentine’s, sympathy), message card, vase | N/A | N/A | Missing |
| Florist: bouquet “recipe” or stem count | N/A | N/A | Missing |
| Staff/crew assignment per event | Missing | N/A | N/A |
| Equipment/inventory per job (chairs, tents) | Missing | N/A | N/A |

### Analytics & reporting

| Gap | Events & Catering | Domestic | Florist |
|-----|-------------------|----------|---------|
| Revenue or jobs by period (e.g. events this month) | Missing | Missing | Missing |
| By category or type (e.g. weddings vs corporate) | Missing | Missing (e.g. cleaning vs laundry) | Missing (e.g. by occasion) |
| Export tailored to vertical (e.g. events CSV with date, client, amount) | Partial (generic export) | Partial | Partial (orders CSV) |

### Buyer experience

| Gap | When booking / buying |
|-----|------------------------|
| **Caterer** | No “my upcoming events” view; no menu/head count confirmation step; no deposit vs balance; single escrow only. |
| **Cleaner** | No “my recurring cleanings” or calendar; “Book again” = new job, not “same slot next week”; no saved access instructions per provider. |
| **Florist** | No “order by occasion” or “deliver on date”; no message card or delivery-time preference in a prominent flow; same checkout as produce. |

---

## What would “done” look like? (target state per vertical)

Short, concrete description of a **target state** so the gap is explicit.

### Events & Catering (caterer / event staff)

- **Artisan:** A dedicated **Events** view or dashboard: calendar of my events (by date), each event showing client, venue, head count, menu/equipment status. Ability to add staff/crew to an event and track who’s confirmed. Optional equipment checklist (chairs, tents, etc.) per event. Payments: optional deposit + balance (e.g. 50% on confirm, 50% on event day). Notifications: “Event in 7 days”, “Head count locked”.
- **Buyer:** “My events” list or calendar; a clear **event workflow**: post → quotes → accept → (optional) menu/head count confirm → pay deposit → pay balance (or single escrow). Reminders before event day.
- **Ops/Admin:** View “Events this week”, filter by category; optional event-specific dispute reasons.

### Domestic / Cleaning / Laundry

- **Artisan:** A **Recurring** or **Schedule** view: list or calendar of my recurring jobs (e.g. “Every Tue 9am – Acme Corp”). Per client/job: saved access instructions (key code, gate). Optional cleaning checklist or scope (rooms, tasks) that buyer and artisan can agree on. “Rebook same slot” = one click to create next occurrence (or a series), not just “post new job”.
- **Buyer:** “My recurring services” with next dates; “Book again” for the **same** cleaner at the **same** slot (or choose next date). Saved access instructions per provider. Optional recurring billing (e.g. charge every week).
- **Ops/Admin:** “Recurring cleanings due this week”; no-show or replace-cleaner flow for recurring.

### Florist

- **Florist (seller):** A **Florist** or **Orders by date** view: orders grouped by **delivery date** or **occasion** (e.g. Valentine’s, sympathy). Product form: occasion, message card, vase option, “deliver by” date. Optional bouquet builder (stems, recipe). Analytics: sales by occasion, peak days.
- **Buyer:** Marketplace **by occasion** or “Send for Valentine’s” with delivery-date prominence; at checkout: delivery date, time window (e.g. morning), message card. Clear “flower delivery” positioning (e.g. “Delivery by 10am”).
- **Ops/Admin:** “Flower orders by delivery date”; occasion-level reporting.

---

## Buyer-side gaps (when using each vertical)

What the **buyer** does **not** get today when they book a caterer, a cleaner, or buy from a florist.

- **Booking a caterer / event:** No “my events” dashboard; no structured event workflow (menu confirm, head count lock); no deposit vs balance; no event-day reminders; no way to see “event checklist” (equipment, staff) in one place.
- **Booking a cleaner / recurring:** No “my recurring cleanings” or calendar; “Book again” creates a **new** job (category pre-filled), not the same slot with the same provider; no saved access details per provider; no recurring payment (each job is pay-per-job).
- **Buying from a florist:** Same marketplace flow as produce; no “by occasion” or “deliver on [date]”; no prominent message card or delivery-time preference; no “flower delivery by 10am” promise; delivery is generic (driver claims when available).

---

## Recommendations: what to build first

Prioritised so you can focus on the highest impact per vertical. **P0** = foundational for that vertical to feel “done”; **P1** = strong next step; **P2** = polish.

| Priority | Vertical | What to build | Why |
|----------|----------|----------------|------|
| **P0** | Events & Catering | **Event calendar (or “my events” list by date) for artisans** | Caterers think in dates; pipeline-by-status is not how they plan. |
| **P0** | Domestic | **Recurring schedule view for artisans** (list or calendar of recurring jobs) | Cleaners live by “every Tuesday at 9am”; without it, recurring is just a label. |
| **P0** | Florist | **Orders by delivery date** (and optionally by occasion) for farmers | Florists need “what’s due tomorrow” and “Valentine’s orders”, not only “all orders”. |
| **P1** | Events & Catering | Event-specific form: menu/head count confirm, optional equipment checklist | Reduces last-minute chaos and disputes. |
| **P1** | Domestic | **Access instructions** per client/job (or per buyer–artisan pair) | Critical for cleaners; today it’s free text only. |
| **P1** | Florist | **Occasion + delivery date + message** at listing or checkout | Buyers send flowers “for Valentine’s” or “deliver on Friday”; product form and checkout don’t surface this. |
| **P1** | All (artisan/farmer) | **Auto-payout** (e.g. MoMo integration) or clear payout SLA | Manual payout is the single biggest ops pain across all provider types. |
| **P2** | Events & Catering | Deposit vs balance (e.g. 30% / 70%) or multi-step release | Common in events; not required for MVP. |
| **P2** | Domestic | “Rebook this slot” (one-click next occurrence or series) | Better than “Book again” → new job. |
| **P2** | Florist | Bouquet builder or “recipe” (stems per product) | Nice-to-have; delivery-date and occasion matter more first. |

---

## Codebase pointers (where the shared logic lives)

So you can add vertical-specific logic or new views without guessing.

| What | Where (frontend) | Where (backend) |
|------|-------------------|-----------------|
| **Artisan dashboard (single for all)** | `frontend/src/pages/artisan/ArtisanDashboard.jsx` | `GET /jobs/mine` in `backend/src/routes/jobs.js` (ranked by job_categories) |
| **Artisan job detail & quote** | `ArtisanJobDetail.jsx`, `ArtisanJobEscrow.jsx` | `jobs.js`, `quotes.js`, `escrow.js` |
| **Job categories & Events/Domestic** | `frontend/src/lib/jobCategories.js` (JOB_CATEGORIES_TIER1); `BuyerPostJob.jsx` (category-specific placeholders, event date, recurring) | `artisans.job_categories` (migration 093); jobs table has category, event_date, recurring metadata |
| **Farmer dashboard (single for all)** | `frontend/src/pages/farmer/FarmerDashboard.jsx`, `FarmerListProduct.jsx`, `FarmerEditProduct.jsx`, `FarmerOrders.jsx` | `GET /products/mine`, `GET /orders`, `products.js`, `orders.js` |
| **Product categories (incl. flowers)** | `frontend/src/lib/productCategories.js` (PRODUCT_CATEGORIES, PRODUCT_UNITS) | Products table: category, unit, etc. |
| **Buyer: post job, job detail, escrow** | `BuyerPostJob.jsx`, `BuyerJobDetail.jsx`, `BuyerJobEscrow.jsx` | `jobs.js`, `quotes.js`, `escrow.js` |
| **Wallet & payouts (shared)** | Artisan/Farmer/Driver dashboards: wallet section, withdraw form | `wallets.js`, `admin.js` (payouts list, mark paid/cancel) |

To add **vertical-specific** views (e.g. “Events calendar” for artisans), you’d add new routes and components (e.g. `ArtisanEventsCalendar.jsx` or a tab in ArtisanDashboard) and optionally new API endpoints (e.g. `GET /jobs/mine?view=calendar&category=Events%20%26%20Catering`). The existing **job** and **order** data already has category and dates; the gap is **views and workflows**, not raw data.

---

## 1. Buyer

### What you get

- **Post a job** — Title, description, category (Skilled Labour, Events & Catering, Domestic Services, etc.), location, optional media (photos/video), event date or recurring pattern. Draft autosaves.
- **Receive quotes** — Artisans submit quotes; you see provider profiles and amounts. You accept one quote; the job is then “assigned” to that artisan.
- **Pay with escrow** — After accepting a quote, you fund the agreed amount via **Paystack** (card/mobile money). Money is held in escrow, not sent directly to the artisan. Protects you: release only when work is done (or dispute if not).
- **Job lifecycle** — Open → quoted → assigned → in progress → completed. You can cancel (when allowed), report no-show, and after completion you can release escrow or open a dispute.
- **Release or dispute** — When the artisan marks the job complete, you can **release** funds (they go to the artisan’s wallet minus platform fee) or **open a dispute** (work not done, etc.). Disputes go to admin for resolution.
- **Marketplace** — Browse produce/flowers by category and location. Place orders (buy now). Pay via Paystack; order goes to farmer; optional same-day delivery (driver) if available.
- **Orders dashboard** — See all orders, status (pending, confirmed, dispatched, delivered), and delivery tracking when a driver is assigned.
- **Providers list** — Save and revisit providers you’ve worked with (“Book again”).
- **Reviews** — Leave a review after a job; see reviews on providers.

### Payments & money

- **In** — You pay by **Paystack** (card or mobile money). No in-app “wallet” for you; each job/order is paid when you fund escrow or checkout.
- **Out** — You don’t receive money; you only pay for jobs and orders.
- **Fees** — Platform fee on jobs is **8%** of the escrowed amount (configurable). You see the quote amount; the artisan receives quote minus fee after release.

### Scheduling & ops

- **One-off jobs** — Full support: post once, get quotes, book, do escrow, complete.
- **Recurring / event date** — Job form supports “event date” and recurring options (e.g. weekly cleaning). The **job** can be recurring; there is **no** separate “standing order” or “subscription” product yet — so recurring is expressed as job metadata and intent, not automated repeat billing.
- **“Create standing order” / “Enable escrow wallet”** — Shown in the UI but **disabled** (“Coming soon”). So today you get single-job and single-order flows only.

### Honest limitations

- No buyer wallet: every job/order is a separate payment.
- No automated recurring payments; recurring is descriptive on the job, not a subscription product.
- Dispute resolution is **admin-mediated**, not automated.
- Marketplace delivery depends on drivers being available and claimed; no guarantee of same-day.
- If Paystack is not configured, payment endpoints return 501 and you cannot complete escrow or orders.

---

## 2. Artisan (caterers, cleaners, handymen, event staff)

### What you get

- **Job pipeline** — One dashboard showing: **new** (open jobs you haven’t quoted), **quoted** (you submitted a quote), **booked** (buyer accepted your quote), **in progress**, **completed**, **paid**, **disputed**, **rejected**. Filter by category and search.
- **Submit quotes** — Open a job, enter your amount and optional message, submit. Buyer can accept or reject. If accepted, the job is assigned to you and the buyer is prompted to fund escrow.
- **Start / complete job** — When escrow is held, you mark “Start job” then “Mark complete”. Buyer then releases or disputes.
- **Work proof** — You can attach proof (photo/video + note) to the job for the buyer and for disputes.
- **Wallet** — Balance from released escrow (after platform fee). You see **available balance**, **pending (in escrow)**, and **completed this month**. You can **request a withdrawal** (e.g. MoMo); the request is created and appears in **admin**. Admin marks it **paid** when they’ve sent the money — so **payouts are manual** (no automatic MoMo push yet).
- **Disputes** — If the buyer opens a dispute, you see it; admin reviews and can release to you, refund buyer, or split.
- **Verification** — Optional ID verification (Ghana Card + selfie) for a trust badge.
- **Profile & reviews** — Public profile, reviews from buyers, “Book again” from past buyers.
- **Export** — Export your pipeline (CSV) for your own records.

### Payments & money

- **In** — You earn when the buyer **releases** escrow after you mark the job complete. Amount = accepted quote minus **8%** platform fee (configurable). Money lands in your **in-app wallet**.
- **Out** — You request a **withdrawal** (amount + method e.g. MoMo + phone). Payout is created with status **pending**. **Admin** must mark it **paid** after sending money externally. So: **no automatic payout**; you rely on ops to process withdrawals.
- **Fees** — 8% of job value is taken before your wallet is credited.

### Scheduling & ops

- **No built-in calendar** — You see jobs by status in the pipeline, not a calendar view. Event date and recurring info are on the job; you manage your own schedule.
- **Notifications** — In-app (and optional SMS if configured) when your quote is accepted.
- **“Coming soon”** — Some wallet/export or future features may still be labelled “Coming soon” in the UI.

### Honest limitations

- Payouts are **manual**: you request, admin pays you outside the system and marks paid. No guaranteed SLA.
- No automatic scheduling or calendar; you track jobs in the pipeline.
- Quote visibility: buyers see all quotes; you don’t see other artisans’ quotes, only that you’re competing.
- Auto-release: if the buyer doesn’t release or dispute, escrow can **auto-release** after a configured number of hours (e.g. 72), so you get paid even if the buyer forgets — good for you, but be aware it’s time-based.

---

## 3. Farmer / Florist

### What you get

- **List products** — Name, category (e.g. vegetables, flowers), quantity, unit (kg, bunch, etc.), price, optional media (images/video, up to 12 files, 50MB each). Optional “Photo URL” fallback. Listings appear on the **marketplace**.
- **Edit / delete listings** — Update details, add/remove media, or hide from marketplace.
- **Orders** — Buyers place orders from your listings. You see orders in **Farmer orders** with status: pending, confirmed, dispatched, delivered, cancelled. You can confirm, dispatch (and optionally request delivery), and mark delivered (or driver does).
- **Delivery** — Orders can have a delivery leg. A **driver** can claim the delivery; you and the buyer see status (e.g. picked up, on the way, delivered). Delivery fee is separate (driver earns it; platform takes a cut).
- **Wallet** — Same model as artisan: **available balance** (from completed orders, after platform fee), **pending** (orders in progress / escrow), **completed this month**. **Withdraw** creates a payout request; **admin marks it paid** when they send money.
- **Disputes** — Order or delivery disputes appear in wallet/disputes; admin resolves.
- **Verification** — Optional ID verification for trust badge.
- **Export** — Export orders (CSV).

### Payments & money

- **In** — When an order is paid (buyer pays via Paystack), money is held; when order is delivered (and any delivery escrow released), your share (order value minus **5%** platform fee on orders, configurable) is credited to your wallet.
- **Out** — Same as artisan: **request withdrawal** → admin processes and **marks paid**. No automatic MoMo/bank transfer.
- **Fees** — **5%** platform fee on marketplace orders (configurable).

### Scheduling & ops

- **No inventory system** — You set quantity and price; when you’re out of stock you edit or hide the listing. No automatic stock deduction.
- **Upload limits** — Max 12 files per product, 50MB per file. Supported: JPEG, PNG, WebP, AVIF, GIF, MP4, WebM, QuickTime. If upload fails, the UI now shows the **exact error** (file type, size, or “content did not match image type”).
- **Recurring** — No “subscription” or standing order from buyers; each order is one-off.

### Honest limitations

- Payouts are **manual** (request → admin pays and marks paid).
- No inventory or stock automation; you manage availability by editing listings.
- Image upload can fail on some phones (e.g. HEIC); saving as JPEG or using the Photo URL fallback helps.
- Delivery depends on drivers being online and claiming; no guaranteed delivery window.

---

## 4. Driver

### What you get

- **Driver profile** — Vehicle type (e.g. bike), operating area, radius (km). You submit for **admin approval**. Until approved, you cannot go online or claim deliveries.
- **Go online / offline** — When approved, you turn on “online” (optionally with GPS). You then see **available deliveries** (pickup/dropoff, fee) and can **claim** one. Going offline stops new assignments.
- **Delivery lifecycle** — Claimed → pickup (you mark picked up) → on the way → delivered. Buyer/farmer can see status. Delivery fee is held in escrow and released when the delivery is confirmed (or auto-confirmed after a set time, e.g. 48 hours).
- **Wallet** — **Available balance** (from released delivery fees) and **pending** (deliveries in progress). Delivery fee is calculated (e.g. base + per-km); platform takes a **~16.67%** cut (configurable). You **withdraw** via the same wallet as artisans/farmers — in the UI it may say “Withdrawals are enabled in Seller Dashboard (Wallet → Payouts)” meaning the same wallet/payout flow: request → admin marks paid.
- **Disputes** — If a delivery is disputed (e.g. not received, wrong item), admin can resolve; your fee may be held or adjusted.
- **Verification** — Optional ID verification.
- **Export** — Export deliveries (CSV).

### Payments & money

- **In** — You earn the **delivery fee** (formula: base fee + rate per km × distance; configurable). After the delivery is confirmed (or auto-confirmed), the fee minus platform cut is credited to your wallet.
- **Out** — Same manual payout flow: request withdrawal → admin pays and marks paid.
- **Fees** — Platform takes about **16.67%** of the delivery fee (configurable as `PLATFORM_FEE_PCT_DELIVERY`).

### Scheduling & ops

- **No shift-based scheduling** — You are not “scheduled” for slots; you go online and claim available deliveries. Suited to gig-style delivery.
- **GPS** — Optional; used to show you “available” deliveries (e.g. by proximity). If you don’t grant location, you may still see deliveries but without distance ranking.
- **Auto-offline** — System can mark you offline if you’re idle (e.g. no activity for a while), so you don’t stay “online” indefinitely.

### Honest limitations

- **Admin approval required** — You cannot earn until your driver profile is approved.
- Payouts are **manual** (request → admin marks paid).
- No guaranteed volume of deliveries; depends on orders and other drivers.
- No in-app navigation; you use external maps for directions.

---

## 5. Company (Employer)

### What you get

- **Company profile** — Name, industry, size range, website, location, description, logo, cover image. Public page for candidates. You can have multiple companies (switch by `company_id`).
- **Post job roles** — Job title, location, type (full-time, part-time, etc.), mode (onsite, remote), pay range, pay period, benefits, description, tags. Jobs appear on the **Jobs board**; candidates apply.
- **Applications** — View applicants per job; shortlist, contact, reject, or mark hired. Optional templates for messages. You can add private notes and rate applicants (preferred, blocked).
- **Workforce lists** — Create lists (e.g. “Waiters”, “Cleaners”) and add workers (by user). Used to organise who can be assigned to shifts.
- **Shifts** — Create a **shift**: title, role tag, location, start/end time, headcount, optional geo-fence (radius around a point). Workers can be **assigned** to the shift. You can generate **check-in codes**; workers check in (with optional geo check-in). Shifts can be edited/cancelled.
- **Recurring scheduling** — **Templates** define a repeating pattern (e.g. “Weekly cleaning”, role, location, headcount). You create a **series** from a template (e.g. next 12 weeks); the system can **auto-generate** shift instances. You can skip or adjust dates. Good for recurring staff (cleaners, event staff).
- **Ops** — Shift no-show grace (hours), shift complete grace, series auto-generation interval, coverage auto-fill (experimental). Admin can set some of these; company sees the behaviour.
- **Payroll** — UI exists for payroll-related views (e.g. pay period, job term, schedule text, benefits) but some fields or flows may be “not migrated yet” or simplified; payroll is partly there for future use rather than full run-the-business payroll today.
- **Insights / analytics** — Basic analytics and ops alerts (e.g. no-shows, gaps) where implemented; depth varies.

### Payments & money

- **No in-app payroll** — You do not pay workers through LocalLink for shifts. You record who worked (assignments, check-in); payment to staff is **outside** the platform (cash, bank, etc.). So: **scheduling and attendance**, not payment execution.
- **Job postings** — Hiring jobs (apply for a role) are free to post in the current model; there is no “promote job” or paid placement described in the codebase.

### Scheduling & ops

- **Shifts** — Full support: create, assign, check-in (code or geo), complete. Recurring via templates + series.
- **No-shows** — Configurable grace period (e.g. 4 hours) after shift start; you can mark no-show; used for reliability signals.
- **Geo check-in** — Optional; worker must be within radius of shift location to check in. Helps with remote/onsite verification.

### Honest limitations

- **No payroll run in-app** — You track who worked; you pay them elsewhere.
- Some payroll/insights fields are “coming later” or “not migrated yet” in the backend; the UI may show placeholders or fallbacks.
- Company “ops” settings (e.g. auto-fill, grace periods) depend on admin/feature configuration.
- Invite/workspace model: you may need to invite users to your company to assign them to shifts; flow exists but can be heavy for very small teams.

---

## 6. Admin

### What you get

- **Feature flags** — Enable/disable verticals (e.g. B2B supply, logistics) and other toggles. Controls what appears as “live” vs “Coming soon” on the home page and elsewhere.
- **Disputes** — List and resolve escrow disputes (job and delivery). View evidence; release to provider, refund buyer, or split. Resolution is **manual** and authoritative.
- **Payouts** — List withdrawal requests (artisans, farmers, drivers). **Mark paid** when you’ve sent money (MoMo, bank, etc.) or **cancel** (money goes back to wallet). No automatic payout integration; you are the bridge.
- **Users & roles** — View users, roles, suspend/unsuspend. Bootstrap admin user via secret.
- **Moderation** — Posts, comments, keyword filters. Block or flag content.
- **Analytics & ops** — Dashboard with counts (users, jobs, orders, escrows, payouts pending), stuck signals (e.g. escrow pending payment > 12h, payouts stuck > 6h), scheduler health. Helps you spot stuck money or failing jobs.
- **Driver approval** — Approve or reject driver profiles so they can go online.
- **Audit** — Audit log for admin actions (disputes, payouts, etc.) for accountability.

### Honest limitations

- **Payouts are manual** — You must process every withdrawal outside the system and then mark it paid. No MoMo/bank API integration for auto-payout.
- **Dispute resolution is manual** — No automated rules; you decide based on evidence.
- **No built-in CRM or ticketing** — You use the admin dashboard and any external tools you prefer for support.

---

## Cross-cutting: fees, escrow, and trust

| Flow | Platform fee (default) | Escrow | Payout to provider |
|------|-------------------------|--------|---------------------|
| **Job** (buyer → artisan) | 8% | Yes (Paystack) | To wallet → manual withdrawal |
| **Order** (marketplace) | 5% | Yes (Paystack) | To wallet → manual withdrawal |
| **Delivery** | ~16.67% of delivery fee | Yes | To wallet → manual withdrawal |

- **Escrow** — Buyer/farmer pays; money is held until release (or dispute, or auto-release after configured hours). Protects both sides.
- **Auto-release** — Jobs: e.g. 72 hours after artisan marks complete if buyer doesn’t act. Deliveries: e.g. 48 hours after delivery if not disputed. Reduces “stuck” money.
- **Trust** — Optional ID verification (Ghana Card + selfie), reviews, and public profiles. No algorithmic “trust score” yet; it’s reputation and verification badges.

---

## Summary table: “What do I get?” and “What’s missing?”

| User type | Strongest benefits | Main gaps / manual bits |
|-----------|--------------------|--------------------------|
| **Buyer** | Post jobs, get quotes, pay with escrow (Paystack), release/dispute, marketplace, orders | No wallet; no standing order; no recurring auto-pay; dispute = admin |
| **Artisan** | Pipeline, quote, get booked, escrow release, wallet, withdraw request, proof, reviews | Payout = admin marks paid; no calendar; no auto-payout |
| **Farmer** | List products, orders, delivery link, wallet, withdraw request | Payout = admin marks paid; no inventory; upload limits |
| **Driver** | Profile, go online, claim deliveries, status updates, delivery fee to wallet | Admin approval needed; payout = admin marks paid; no auto-payout |
| **Company** | Profile, post jobs, applications, workforce lists, shifts, recurring series, check-in | No in-app payroll; some payroll/insights “later”; invite flow can be heavy |
| **Admin** | Flags, disputes, payouts (mark paid/cancel), moderation, analytics, driver approval | All payout and dispute resolution is manual |

---

*Document version: 2025-02. Reflects the codebase and behaviour as of the last review; product and config may change.*
