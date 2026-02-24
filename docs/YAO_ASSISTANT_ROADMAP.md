# YAO Assistant — Product Roadmap & Review

**Current score: 86 / 100**  
**Goal: 95+ with live data, support workflows, predictive suggestions.**

This doc captures the product review and turns it into a clear roadmap so YAO becomes a serious competitive feature and the control center of LocalLink.

---

## Why This Is Strong

- **Context aware** — Role-based prompts, knowledge, and deep links
- **Action oriented** — Chips and links reduce “blank chat” and funnel friction
- **Reduces support load** — Triage and self-serve before tickets
- **Guides new users** — Onboarding and next-step suggestions
- **Scales with marketplace complexity** — Role separation (buyer, artisan, farmer, driver, company, admin)

Most marketplaces don’t implement this until Series B. LocalLink is ahead.

---

## What We Did Right (Keep Doing)

| Area | What we did | Why it matters |
|------|----------------|----------------|
| **Suggestion chips** | Role-specific opening prompts (e.g. admin: “Review disputes”, “View metrics”) | Prevents blank chat; same pattern as Intercom/Zendesk |
| **Role-based deep links** | “Find providers”, “My services”, “Open deliveries”, “Admin dashboard”, etc. | Assistant as navigation; removes funnel friction |
| **Role-specific knowledge** | Separate guidance for admin, company, driver, buyer, provider in system prompt + ASSISTANT_KNOWLEDGE | Feels built into the product, not generic |
| **Correct routing** | e.g. `/buyer/jobs/new` for Post a job | Bad links kill trust |

---

## Implemented: Intent Layer

- **`backend/src/lib/assistantIntent.js`** — Keyword-based intent detection: PAYMENT, DISPUTE, HIRING, DELIVERY, ACCOUNT, LISTINGS, ADMIN_OPS, GENERAL.
- **System prompt** — When intent is detected, `getIntentGuidance(intent)` adds short instructions (e.g. DISPUTE → suggest support ticket; PAYMENT → escrow/payouts).
- **Suggested actions** — `getIntentActions(intent, userRole)` adds intent-based deep links (e.g. DISPUTE → Open a support ticket; DELIVERY + buyer → My orders).

This gives consistent routing and sets the base for live data and support triage later.

---

## Target Architecture

Evolve from “Q&A only” to:

```
User
  ↓
Role detection (done)
  ↓
Intent detection (add)
  ↓
Knowledge layer (done + expand)
  ↓
Action engine (add: triage, live data, commands)
  ↓
Deep link / API / support workflow
```

**Critical upgrade: intent categories.**

Map user messages to intents, then map intents to actions, links, and knowledge:

| Intent | Examples | Actions / links | Knowledge |
|--------|----------|------------------|-----------|
| PAYMENT | “refund”, “when do I get paid”, “escrow” | Wallet, withdrawals, escrow release | Escrow, payouts |
| DISPUTE | “complaint”, “fraud”, “cancel”, “issue” | Open support ticket, Admin disputes | Dispute flow, evidence |
| HIRING | “find a cleaner”, “post a job”, “quote” | Find providers, Post job, Jobs board | How to hire, escrow |
| DELIVERY | “where is my order”, “track”, “driver” | Orders, driver view | Delivery, tracking |
| ACCOUNT | “verify”, “profile”, “withdraw” | Profile, verification, wallet | Verification tiers, KYC |
| LISTINGS | “list produce”, “my services”, “boost” | Marketplace, Artisan services, Farmer | Listing quality, visibility |

This makes responses consistent and enables auto-triage (e.g. DISPUTE → support workflow).

---

## The Next 10 Improvements (High Impact)

### 1. Context awareness
- **Idea:** Assistant knows current page (e.g. order detail, driver dashboard).
- **Example:** Buyer on order page → chips: “Track this order”, “Contact driver”, “Report issue”.
- **Implementation:** Frontend sends `context: { page, entityId }` with chat request; backend adds context to prompt and suggests page-specific actions.

### 2. Live data access (game changer)
- **Idea:** Answer from real platform data, not generic text.
- **Example:** “Where is my order?” → “Your order from Abena Farms is on the way. Driver: Yaw Boateng.”
- **Implementation:** Intent = DELIVERY + order in context → backend fetches order + delivery + driver, injects into prompt or structured reply.

### 3. Auto-support triage
- **Idea:** Keywords like “refund”, “complaint”, “fraud”, “cancel” trigger support workflow.
- **Implementation:** Intent = DISPUTE (or keyword match) → suggest “Open a support ticket” + prefill category; optionally create draft ticket.

### 4. Revenue-generating prompts
- **Idea:** After key actions (e.g. order placed), assistant suggests next purchase.
- **Example:** “Need anything else today?” → Cleaning, Catering, Delivery.
- **Implementation:** Post-action event or context “just_completed_order” → reply + chips for cross-sell categories.

### 5. Provider growth assistant
- **Idea:** For artisans/farmers: “How can I get more bookings?” → improve profile, add photos, lower response time, enable instant booking.
- **Implementation:** Intent = LISTINGS + role = artisan/farmer → knowledge + deep links to profile, services, analytics.

### 6. Admin command mode
- **Idea:** Admins get power tools: “Show stuck escrows”, “List disputes older than 48h”, “Flag suspicious users”.
- **Implementation:** Intent = ADMIN_OPS + role = admin → backend queries (escrows, disputes, users), returns structured summary + links to admin pages.

### 7. Fraud detection assistant
- **Idea:** Surface anomalies: same device, high refund rate, suspicious location.
- **Implementation:** Admin-only; backend aggregates risk signals, assistant can “List high-risk orders” or “Flag user X” with link to admin.

### 8. Onboarding mode
- **Idea:** New users get step-by-step (e.g. artisan: Create profile → Upload ID → First quote → Withdrawals).
- **Implementation:** `context: { onboarding: true, role, completedSteps }` → reply and chips only for next step; deep links to each step.

### 9. Smart suggestions (behavior-based)
- **Idea:** Farmer with no orders → “Promote your listing.” Company with empty workforce → “Add workers to assign shifts.”
- **Implementation:** Backend has light analytics (e.g. no orders in 30 days); inject into context; assistant suggests one concrete action + link.

### 10. Voice assistant (future)
- **Idea:** “YAO find a carpenter near me” — huge in Africa.
- **Implementation:** Already have transcribe + TTS; add voice-first entry (e.g. FAB long-press = voice) and optional voice-only flow.

---

## Intent Categories (Implementation Priority)

Add a small intent layer so the assistant can branch consistently:

1. **Classify** each user message into one of: PAYMENT, DISPUTE, HIRING, DELIVERY, ACCOUNT, LISTINGS, ADMIN_OPS, GENERAL.
2. **Map** intent → which knowledge slice + which actions/links to include.
3. **Triage:** DISPUTE → support workflow; ADMIN_OPS + admin → command path.

Ways to implement intent:
- **Lightweight:** Keyword/regex rules (e.g. “refund” → PAYMENT; “complaint” → DISPUTE).
- **Stronger:** Small classifier (e.g. OpenAI with a single “intent” call, or local model) returning one label, then backend uses it for routing.

---

## Monetization Opportunities

- **Promoted providers** — “Top rated cleaner near you” (sponsored).
- **Featured listings** — “Boost your listing for GHS 10.”
- **Premium company tools** — Advanced hiring/analytics behind paywall.

Assistant can surface these only when relevant (intent + role).

---

## Risks & Mitigation

| Risk | Mitigation |
|------|------------|
| Over-automation | Keep “Open a support ticket” and human handoff visible |
| Wrong answers | Stick to platform knowledge; no hallucination of data |
| Broken deep links | Test links in smoke/E2E; validate routes in app |
| Slow responses | Keep replies short; use streaming if needed |

---

## Score Breakdown (Current)

| Dimension | Score | Notes |
|-----------|-------|------|
| UX | 90 | Chips, deep links, role-aware |
| Architecture | 82 | Add intent layer, action engine |
| Scalability | 84 | Role + intent scales with features |
| Business impact | 88 | Support reduction, funnel, future GMV |

**Missing for 95+:** Live data access, automated support workflows, predictive suggestions.

---

## Summary

YAO is on track to become the **control center** of LocalLink — an operating system for local commerce. Next steps:

1. **Add intent categories** and map intents to actions/links/knowledge.
2. **Introduce context** (page, entity, onboarding step) from frontend.
3. **Add live data** for high-value intents (e.g. “Where is my order?”).
4. **Auto-triage** DISPUTE (and similar) into support workflow.

This doc should live next to the assistant code and be updated as each improvement ships.
