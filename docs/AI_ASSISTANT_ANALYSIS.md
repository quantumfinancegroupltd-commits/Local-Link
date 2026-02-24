# AI Assistant — “Is this the best we can do?” analysis

**Scope:** Current implementation vs. ideal “conception → completion” experience.

---

## What we have now

| Layer | Current state |
|-------|----------------|
| **Model** | GPT-4o-mini, 600 max tokens, temp 0.3, knowledge-grounded. |
| **Conversation** | Multi-turn in one session: frontend sends `history` (last 20 messages, 800 chars each), backend passes to OpenAI so the assistant can reference earlier messages. |
| **Search** | Every turn: search products (name/category), providers (profile + artisan_services title/category/description), jobs (title/description/location/company/tags). Results injected as “LIVE LISTINGS” in the system prompt. |
| **Cards** | Frontend renders product, provider, and job cards under assistant replies when the API returns `suggested_*`. Cards link to real pages. |
| **Prompt** | System prompt: platform knowledge, “conception to completion” guidance, rules (no inventing listings, 1–2 sentences when cards show, no off-platform payment). User role in session. |
| **Persistence** | None. Closing the panel or refreshing loses the thread. |
| **Actions** | Read-only. No posting jobs, no creating orders, no releasing escrow from the assistant. |

So: we can go back and forth in one session, get relevant cards when the user asks for produce/services/jobs, and the model is instructed to guide from idea through to “what happens when work is done.” That’s a strong Phase 1+.

---

## Gaps and limitations

### 1. Search is current-message only

- We only run search on the **latest** user message.
- So “I need a plasterer” → we search “plasterer” and show cards. If the next message is “how do I hire one?” we search “how do I hire one” and get no listings; the model can still answer from history, but we don’t re-use “plasterer” to keep showing plasterer cards.
- **Improvement:** When building the query for search, consider the **last user message that was clearly a search intent** (e.g. “need a X”, “looking for Y”) and/or merge keywords from the last 1–2 turns so follow-ups like “show me those again” or “how do I hire one?” still get relevant listings.

### 2. No conversation persistence

- History lives only in React state. Refresh or closing the panel loses the thread.
- **Improvement:** Optional persistence: e.g. store last N messages in `localStorage` keyed by session or user, or backend `conversation_id` + messages in DB for logged-in users, and restore on open. Improves “come back later” and “continue where we left off.”

### 3. No deep links into app flows

- We tell the user “post a job” or “tap a card to view profile” but we don’t hand them a direct link to “post job” or “post job with title pre-filled.”
- **Improvement:** Add to knowledge (and prompt): exact paths like “Post a job: /post-job” or “Marketplace: /marketplace”. Model can say “You can post a job here: [link]” when appropriate. Optional: backend returns `suggested_actions: [{ label, url }]` and frontend shows them as buttons.

### 4. No structured “next step” suggestions

- After “Here are some plasterers”, we could suggest the logical next step: “Post a job”, “View marketplace”, “How escrow works.”
- **Improvement:** Either (a) prompt the model to end with one suggested next question when useful, and show it as a chip, or (b) backend/frontend heuristics: if we showed providers, suggest “How do I post a job?” and “How does escrow work?” as quick replies.

### 5. Token and context limits

- System prompt + knowledge + LIVE LISTINGS + 20×800-char history can approach context limits on long chats; 600 tokens for the reply can cut off long answers.
- **Improvement:** Trim or summarize very old history (e.g. keep last 10 full messages, summarize older into 1–2 sentences), or cap total system+history size. Slightly increase `max_tokens` if we want 2–3 paragraph answers in rare cases.

### 6. No “assist into action” (draft job / pre-fill)

- User still has to leave the chat and fill forms. We don’t create drafts or pre-fill “post job” from the conversation.
- **Improvement (Phase 2):** Tool/action: e.g. “Create a draft job” from the conversation (title/location/description extracted), user reviews and submits on the real form. Keeps control with the user but reduces friction.

### 7. Knowledge is static

- `ASSISTANT_KNOWLEDGE` is fixed. We don’t inject “your open jobs” or “your pending orders” for the current user.
- **Improvement:** For logged-in users, optionally add a short “User context” block (e.g. “Open jobs: 2. Pending orders: 1.”) so the assistant can say “You have 2 open jobs” and point to them.

### 8. Provider cards don’t show “post job for this”

- Provider card links to profile. We don’t offer “Post a job and invite this provider” from the chat.
- **Improvement:** Provider card could include a “Post job” link with a query param or state that pre-selects “invite this artisan” on the post-job page, if the product supports it.

---

## Prioritized “best we can do” roadmap

| Priority | Change | Effort | Impact |
|----------|--------|--------|--------|
| **P1** | Search from conversation: use last search-intent message or merge recent keywords so follow-ups keep showing relevant cards. | Low | High – fixes “how do I hire one?” losing cards. |
| **P1** | Persist conversation in `localStorage` (and optionally in DB for logged-in users) so the thread survives refresh/close. | Low–medium | High – “continue where we left off.” |
| **P2** | Add suggested next steps: after showing cards, show 1–2 chips (“How do I post a job?”, “How does escrow work?”). | Low | Medium – clearer path through the funnel. |
| **P2** | Deep links in knowledge + optional `suggested_actions` in API (e.g. `{ label: "Post a job", url: "/post-job" }`) and render as buttons. | Low | Medium – one tap to the right screen. |
| **P3** | User context for logged-in users: open jobs count, pending orders, so the assistant can reference “your 2 jobs.” | Medium | Medium – more personal and actionable. |
| **P3** | Phase 2 tool: “draft job” from conversation (extract title/location/description), user reviews and submits on real form. | Medium | High – real “assist through process.” |
| **P4** | Slightly larger `max_tokens` and/or summarise very old history to avoid truncation in long chats. | Low | Low–medium. |

---

## Summary

- **Current:** Multi-turn chat, conversation history, live product/provider/job cards, and a prompt that guides from conception to completion. No persistence, no actions, search only on current message.
- **Best we can do without new “control”:** Add search-from-conversation, persistence (localStorage + optional DB), suggested next-step chips, and deep links / suggested actions. That gets you a robust “assisted conversation” that feels continuous and actionable.
- **Best we can do with light control:** On top of the above, add one assistive action (e.g. draft job) with user confirmation. The assistant stays “assist,” but the user gets a direct path from chat to the right form with fields pre-filled.

The analysis above is the best we can do **analytically**; implementing P1 and P2 would already make the assistant feel close to “best we can do” for a read-only, conversation-driven experience.
