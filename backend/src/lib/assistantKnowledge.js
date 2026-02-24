/**
 * LocalLink platform knowledge for the AI assistant (Phase 1 – support).
 * Keeps answers grounded and avoids hallucination.
 */
export const ASSISTANT_KNOWLEDGE = `
## LocalLink platform – support knowledge

### Escrow (Trust Wallet)
- Escrow holds money safely until the job is done or delivery is confirmed. It protects both buyer and provider.
- For jobs (skilled labour): Buyer posts a job, accepts a quote, funds escrow. Provider completes the job. Buyer confirms and funds are released (minus platform fee).
- For orders (produce + delivery): Buyer places order; escrow holds funds. Delivery happens; buyer confirms and funds release to farmer and driver.
- When providers get paid: After release, providers withdraw to Mobile Money or bank. Payouts are processed within 5 business days.
- Currency: GHS (Ghana Cedis).

### Verification tiers
- Unverified: Basic account. Providers cannot accept paid work or withdraw until verified.
- Bronze: ID verified (e.g. Ghana Card) + early history. Required for accepting paid work and listing produce.
- Silver: Stronger verification + proven outcomes.
- Gold: Highest trust tier; best for recurring or high-stakes work.
- Unverified → Bronze: Submit Ghana Card (ID) verification via profile. Bronze → Silver/Gold: Complete jobs, earn reviews, submit more evidence via profile.

### Disputes
- If something goes wrong, user can open a dispute with evidence. Escrow is frozen until an admin resolves it.
- Resolution is done by admins; the assistant cannot approve or release escrow.

### Posting a job (how to hire)
- Buyers go to the platform and post a job (title, description, location, budget). Providers can send quotes. Buyer accepts a quote and funds escrow. Work is done; buyer confirms; funds release.
- Employers (companies) can post roles via the Employers / Jobs section and manage applicants.

### Withdrawals
- Providers withdraw from their wallet to Mobile Money or bank after escrow release. Payouts within 5 business days.

### Support
- For issues the assistant cannot resolve, users can open a support ticket from the Support page. Keep payments and coordination on the platform for safety and escrow protection.
- Do not encourage sharing phone numbers or payment outside the platform before work is done and escrow is released.

### Drivers
- Drivers claim available deliveries from the driver dashboard. Completed deliveries release escrow; drivers get paid per delivery.
- Withdrawals: same as other providers; after release, withdraw to Mobile Money or bank. Payouts within 5 business days.
- Verification: Bronze or higher required to claim paid deliveries.

### Admin / moderators
- Admins resolve disputes from the admin dashboard: review evidence, release to buyer or provider, or refund. The assistant cannot resolve disputes.
- Admin can view user metrics, support tickets, and platform health. Suggest opening the Admin dashboard for these tasks.
`
