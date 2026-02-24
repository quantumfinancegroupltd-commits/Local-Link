# LocalLink AI Assistant — Audit & Roadmap

**Date:** Feb 2026  
**Scope:** GPT usage, AI workflows, platform control, onboarding, and “best we can do” next steps.

---

## 1. Is GPT working?

**Yes.** Production and local:

- **Endpoint:** `POST /api/assistant/chat` (body: `{ message }`).
- **Model:** OpenAI `gpt-4o-mini`, 500 max tokens, temp 0.3.
- **Config:** `OPENAI_API_KEY` in backend `.env` (local and production server).
- **Behaviour:** Returns knowledge-grounded answers; without the key, returns a friendly “not configured” message.

**Verification:**  
`curl -X POST https://locallink.agency/api/assistant/chat -H "Content-Type: application/json" -d '{"message":"How does escrow work?"}'` returns a proper platform answer (escrow for jobs vs orders, release, fees).

---

## 2. Current AI workflows (what exists today)

| Flow | Description | Where |
|------|-------------|--------|
| **Support Q&A** | User sends a message → backend adds role + knowledge → OpenAI → reply shown in chat. | Floating button (AssistantFab), Support page “Ask LocalLink AI”. |

**That’s the only AI workflow.** No tools, no server-side conversation history, no other GPT touchpoints.

---

## 3. Does the AI control or assist on the platform?

**Assist (yes, limited):**

- **Support:** Answers “How does escrow work?”, “How do I post a job?”, verification, disputes, withdrawals using `ASSISTANT_KNOWLEDGE`.
- **Placement:** Available on all app pages (floating button) and on Support (“Open AI Assistant”).
- **Safety:** System prompt forbids off-platform payment/contact before escrow release; directs account/sensitive issues to support tickets.

**Assist (updated):**

- **Live listings:** The assistant has **read-only access to products and providers** for suggestions. When the user says e.g. "I need some tomatoes" or "looking for a plumber", the backend searches the database (products by name/category, providers by name/skills/area), injects the results into the prompt, and the model suggests specific listings with names, prices, and links (e.g. `/marketplace/products/:id`, `/u/:id`). It does not create orders or jobs—it only suggests; the user still browses or posts a job.

**Control (no):**

- The assistant **does not** create jobs, release escrow, send messages, or change any platform state.
- It is **read-only**: it can suggest from live data but cannot book, order, or pay.

So: **AI assists via answers and live product/provider suggestions; it does not control the platform.**

---

## 4. Is the AI used in onboarding?

**No.** Current onboarding has no AI:

- **`/onboarding`** — Static path cards (Buyer / Produce / Employer) and links to Register or Marketplace/Jobs.
- **`/adverts`** — Static Instagram-style cards (For Artisans / For Buyers) with CTAs to `/register?role=...`.
- **`/register`** — Form (name, email, phone, password, role). Post-register redirect uses `intent` (e.g. `fix` → post job, `produce` → marketplace) but no LLM.

No chatbot, no AI-suggested role, no guided step-by-step, no personalised next step.

---

## 5. Is this the best we can do?

**No.** The current setup is a solid **Phase 1 (support/knowledge)**. To get closer to “best we can do,” consider the following.

### 5.1 Quick wins (no new backend “control”)

- **Onboarding:** Add a small “Not sure where to start? Ask the AI” on `/onboarding` or `/register` that opens the same assistant (e.g. “I need a plumber” / “I want to sell vegetables”) so the first touch is AI-assisted without changing backend.
- **Suggested prompts by role:** In `AssistantChat`, vary `SUGGESTED` by `user?.role` (e.g. buyers: “How do I post a job?”; artisans: “How do I get paid?”).
- **Conversation persistence:** Optional: store conversation_id and last N messages on the server so the thread survives refresh (still no “control,” just better UX).

### 5.2 Phase 2 — Job-creation assistant (assist + light control)

- **Tool: create_job (or draft_job).** User says “I need a plumber in East Legon next week.” Assistant calls a backend endpoint (with structured params from the model) to create a **draft** job or pre-fill the post-job form; user reviews and submits. AI “assists” by reducing friction; control stays with the user and the form.
- **Backend:** New route e.g. `POST /api/assistant/actions/draft-job` (auth required), validated, writes to DB only as draft or pre-fill payload.

### 5.3 Phase 3 — Smart matching (assist, not full control)

- **Tool: suggest_providers.** “Find me cleaners in Accra” → assistant calls an API that returns a list of matching providers (location, category, verification); reply includes a short list and deep links. No automatic booking; user still chooses and posts/books.
- **Backend:** Reuse or extend existing search/marketplace APIs; optional ranking with simple scoring (distance, tier, reviews).

### 5.4 Later — Business automation

- Scheduled or event-driven summaries (e.g. “Weekly escrow summary” for companies), or in-app “Explain this dispute” for admins. These can stay read-only (no escrow release by AI) and use the same chat endpoint or dedicated ones.

---

## 6. Summary table

| Area | Status | Notes |
|------|--------|--------|
| **GPT working** | Yes | `/api/assistant/chat`, gpt-4o-mini, key set locally + prod. |
| **AI workflows** | 1 | Support Q&A only. |
| **AI control** | None | Read-only; no tools, no platform actions. |
| **AI in onboarding** | No | Static pages and form only. |
| **Best we can do?** | No | Phase 1 done; Phase 2 (draft job), Phase 3 (suggest providers), onboarding entry point, and role-based prompts are natural next steps. |

---

## 7. Recommended next steps (priority)

1. **Document** — Add this audit (or a short link) to the main deploy/runbooks so the team knows what the AI does and doesn’t do.
2. **Onboarding entry** — Add “Ask the AI” on `/onboarding` (or register) that opens the existing assistant; no backend change.
3. **Role-based prompts** — Pass `user?.role` to the chat UI and show different suggested questions per role.
4. **Phase 2** — Design and implement one tool (e.g. draft job) with a dedicated action endpoint and clear user confirmation step.

Once those are in place, you’ll have a clearer path to “best we can do” while keeping the platform safe and user-in-control.
