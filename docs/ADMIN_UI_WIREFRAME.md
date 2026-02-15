## Admin UI wireframe logic (execution-grade)

### Core principle
Admin UI exists to keep LocalLink alive under real-world Ghana conditions:
- fast decision-making
- clear state transitions
- auditability (who did what, when)
- minimal but powerful controls

---

## Navigation / sections (recommended)

### A) Overview (North Star + risk)
**Cards**
- **North Star (WER)**: weekly escrow releases
- **Dispute rate** (opened / escrow created)
- **Cancellation rate** (orders + jobs)
- **Delivery health**: delivered→confirmed conversion
- **Phone leakage attempts** (policy_events)

**Actions**
- None (read-only)

### B) Feature flags (vertical unlocks)
**List**: `feature_flags`
- key, enabled, description, updated_at, updated_by

**Actions**
- Toggle enabled
- (Optional later) edit description

### C) Users & verification
**List**: users + verification tier
- filter by role, verified, tier

**Actions**
- Verify user
- Set verification tier
- (Later) restrict/suspend user (drivers already support status)

### D) Disputes (money safety)
**List**: disputes + joined escrow info
- status, reason, details, evidence links, opened at, resolved at
- filter: open/under_review/resolved

**Actions**
- Resolve: release / refund / split
- Attach admin note
- (Later) request more evidence (dispute_messages)

### E) Deliveries (ops control)
**List**: deliveries + order info
- status, driver, pickup/dropoff, fee

**Actions**
- Assign driver (manual dispatch)
- (Later) reassign driver + incident logging

### F) Payouts (financial ops)
**List**: payouts
- pending/paid/cancelled

**Actions**
- mark paid
- cancel (refund to wallet)

---

## State machine rules (what buttons should be shown)

### Dispute resolution buttons
Show “Resolve” only when:
- dispute.status in ('open','under_review')

Disable “Resolve” when:
- escrow.status already released/refunded

### Delivery assignment
Show “Assign driver” only when:
- delivery.status in ('created','driver_assigned') (reassignment optional later)

### Feature flags
Toggling a flag should:
- be immediate
- update Home page doors on next refresh (client fetches `/api/features`)

---

## Error handling UX (must-have)
- All destructive actions require confirmation (modal/confirm)
- On 409 conflicts (e.g., “active dispute blocks confirm”), show the API message verbatim
- On 500 errors, show `reqId` (already returned by backend)


