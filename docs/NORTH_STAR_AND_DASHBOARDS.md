## North Star metric (Launch: Ghana-realistic)

### North Star: **Weekly Escrow Releases (WER)**

**Definition (exact):**

Count of `escrow_transactions` rows where:
- `status = 'released'`
- and `updated_at` falls within the week window.

Why this is the right North Star for LocalLink:
- It measures **completed outcomes** across **both engines** (jobs + produce/orders).
- It is **hard to fake** (requires real workflow completion).
- It correlates with **trust**, **retention**, and **revenue** (platform fee applies on release).

Notes:
- Refunds are not counted as North Star (refunds indicate failure/rework, even if “fair”).
- Auto-release and buyer-confirm release are both included (they represent “settled outcomes”).

---

## Supporting dashboards (what to track alongside WER)

### 1) Growth & activation
- **New users** (by role): `users.role`
- **Weekly active users**: `users.last_active_at` within 7 days
- **Buyer activation**
  - Buyers who **posted a job** OR **placed an order** within 7 days of signup

### 2) Marketplace liquidity (supply/demand health)
**Jobs**
- Jobs posted: `jobs.created_at`
- Jobs assigned: `jobs.status='assigned'`
- Jobs completed: `jobs.status='completed'`
- Quote acceptance rate: accepted quotes / jobs with >=1 quote

**Produce**
- Products listed: `products.created_at` (status='available')
- Orders created: `orders.created_at`
- Deliveries assigned/picked up/delivered/confirmed: `deliveries.status`

### 3) Trust & risk (must stay low)
- **Dispute rate**:
  - disputes opened / total escrows created
- **Cancellation rate**:
  - cancelled jobs + cancelled orders / total created
- **Phone leakage attempts**:
  - `policy_events.kind='phone_leak'`

### 4) Ops & logistics quality (delivery UX)
- Delivery confirmation rate: confirmed / delivered
- Delivery time-to-confirm: `deliveries.confirmed_at - deliveries.delivered_at`

---

## KPI endpoint contract (used by Admin Dashboard)

### `GET /api/admin/metrics/overview?from=YYYY-MM-DD&to=YYYY-MM-DD`

Returns:
- `north_star.weekly_escrow_releases`
- `kpis` counts for the window
- `rates` computed ratios (e.g. dispute rate)

### `GET /api/admin/metrics/timeseries?metric=wer&bucket=day&from=...&to=...`

Returns a list of `{ bucket_start, value }` for charting.


