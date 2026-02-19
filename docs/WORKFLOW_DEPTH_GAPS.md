# Workflow depth gaps — pre–external-integration

**Verdict:** The platform is **wide but shallow**. Each role’s workflow is ~50–60% of what it should be before touching external integrations. **Depth score: 58/100.**  
**Core issue:** Every role is missing its “power user” workflow. A buyer who posts 20 jobs has the same experience as a first-time buyer. An artisan earning ₵10K/month has the same tools as a new signup. No depth for engaged users — and engaged users are the business.

Almost everything below is **pure product work** — no Stripe, Maps, or SMS required. It’s forms, views, state, and logic; patterns already exist in the codebase.

Use this doc as the **pre-integration product backlog**: prioritise by role (e.g. buyer first as revenue source) and by impact (e.g. rebook, templates, analytics).

---

## BUYER — Most underdeveloped relative to importance

Buyer is the revenue source but has the thinnest experience.

| Gap | What’s missing |
|-----|----------------|
| Saved/favourite providers | No “my trusted providers” list; can browse only |
| Job templates | Same form every time; no memory of past jobs (e.g. “house cleaning every week”) |
| Order history / spend analytics | How much spent? On what? With whom? |
| Rebook on completed job | No one-tap rebook — highest-converting action on marketplaces, absent |
| Budget tracking | No visibility if e.g. “₵500 this month across jobs” |
| Draft management | Autosave exists but no drafts list/UI to return to |
| Proactive job matching | No “based on your last job, you may need X again” |
| Multi-quote comparison | Quotes seen individually, not side-by-side |
| Private job posting | All jobs visible to all artisans; no “post only to vetted providers” |

---

## ARTISAN — Wallet exists, career tools don’t

| Gap | What’s missing |
|-----|----------------|
| Quote templates | Every quote written from scratch every time |
| Job calendar view | Assigned jobs have no calendar layout; only status tabs |
| Earnings goal + progress | “I want to earn ₵2000 this month” with tracking |
| Profile completion score | No nudge to complete skills, services, bio |
| Instant-book toggle | High-trust artisans can’t offer immediate confirmation without quote cycle |
| Package/bundle services | Only individual services; no “3-room clean + iron + laundry” as one SKU |
| Client notes | No private notes on buyers (“always tips well”, “difficult access”) |
| Quote follow-up | No nudge to buyer if quoted 24h ago with no response |

---

## FARMER / FLORIST — Running a business blind

| Gap | What’s missing |
|-----|----------------|
| Sales analytics | Which products sell most? What day? Avg order value? |
| Product performance view | Views vs orders conversion per listing |
| Bulk product editing | Seasonal price updates = edit every listing individually |
| Pre-order / coming soon | Can’t list “Strawberries in 3 weeks, pre-order now” |
| Minimum order value | Farmer can’t set e.g. “min ₵50 order” for viable delivery |
| Delivery zone control | Can’t say “I only deliver to Accra Central and Osu” |
| Storefront branding | No custom banner, tagline, “about my farm” separate from user profile |
| Repeat customer recognition | No “this buyer has ordered from me 5 times” |

---

## DRIVER — Treated as an afterthought

| Gap | What’s missing |
|-----|----------------|
| Shift/availability scheduling | Can go online/offline but can’t set “Tues–Thurs 8am–5pm” |
| Delivery history + performance | On-time rate, distance, earnings per km |
| Preferred zone | Driver in Tema shouldn’t see deliveries in Kumasi |
| Multi-stop batching | Every delivery claimed individually; no route optimisation |
| Proof of delivery photo | No photo-documentation of successful delivery (artisans have work proof) |
| Fuel cost calculator | No tool to see if a delivery is worth claiming |
| Driver ratings from buyers | Artisans get reviewed; drivers don’t |

---

## COMPANY — The payroll cliff-edge

| Gap | What’s missing |
|-----|----------------|
| Timesheet aggregation | Shifts + check-ins exist but no “worker X completed 14h this week” |
| Shift rating/feedback | No company rating of worker or worker rating of shift after completion |
| Worker performance history | No record of reliable vs no-show, who was rated well |
| Shift cost forecasting | No “this schedule will cost ~₵X” before committing |
| Candidate pipeline stages | No “interview scheduled”, “offer sent”, “offer accepted” |
| Bulk shift creation | No CSV/template upload for shifts |
| Company-to-company referral | No B2B “recommend another business” network effect |
| Onboarding checklist for new workers | No document/task checklist when adding to workforce list |

---

## ADMIN — Flying blind on the business

| Gap | What’s missing |
|-----|----------------|
| Revenue dashboard | GMV, take rate, net revenue, trend — none |
| User growth charts | New signups by role, activation, churn signals |
| Cohort analysis | Which acquisition month retains best artisans? |
| Content moderation queue | Approve/reject workflow; not just keyword filtering |
| Platform health score | Is liquidity healthy? Jobs quoted within X hours? |
| Bulk communication | Can’t target “all unverified artisans” or “buyers inactive 30 days” |
| A/B or feature flags by segment | Flags are platform-wide only |

---

## CROSS-CUTTING (role-agnostic)

| Gap | What’s missing |
|-----|----------------|
| Notification preferences | Users can’t choose what/how they’re notified |
| In-app search | No global search across providers, products, jobs, companies |
| Dark mode / accessibility settings | — |
| Onboarding checklist / progress | No guided “complete your profile” steps for new artisans |
| Platform leaderboard / “top providers” | No social proof at platform level |
| Job/product sharing | No native share-to-WhatsApp for listings (huge for Ghana) |
| Multi-language toggle | Significant non–English-first populations in Ghana |
| Offline PWA behaviour | Mobile-first; when connectivity drops, UX breaks completely |

---

*Source: product depth assessment. Prioritise by role (buyer first) and by leverage (rebook, templates, analytics, then power-user workflows).*
