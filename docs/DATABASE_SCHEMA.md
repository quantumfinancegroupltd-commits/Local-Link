## Database schema (exact)

The authoritative schema snapshot is:
- `docs/schema.sql` (generated from the running selfhost Postgres via `pg_dump --schema-only`)

This is the best source when you need the **exact** set of tables/columns/types/constraints/indexes currently deployed.

### High-signal tables (what matters operationally)

- **Users + auth**
  - `users` (roles, verification, trust_score, last_active_at)

- **Wallet + escrow**
  - `wallets`
  - `escrow_transactions` (single source of truth for money state)
  - `payouts`

- **Jobs (skilled labour)**
  - `jobs` (+ `category`, `media`, geo fields)
  - `quotes`

- **Produce marketplace**
  - `products` (+ `media`)
  - `orders` (+ dropoff geo fields)
  - `deliveries` (+ status timeline)
  - `delivery_location_updates`

- **Trust & enforcement**
  - `disputes` (+ evidence, resolution, resolved_at/by)
  - `verification_levels`, `verification_requests`
  - `policy_events` (phone leak attempts, cancellations, etc.)
  - `reviews`

- **Social**
  - `user_profiles`
  - `user_posts`, `user_post_likes`, `user_post_comments`

- **Platform ops**
  - `feature_flags` (vertical unlocks without redeploy)
  - `webhook_events`
  - `schema_migrations`


