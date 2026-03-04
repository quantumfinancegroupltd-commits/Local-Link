import { Link } from 'react-router-dom'
import { Card } from '../../components/ui/FormControls.jsx'

export function AffiliateTerms() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link to="/affiliates" className="text-sm text-emerald-600 hover:underline dark:text-emerald-400">
          ← Back to Affiliates
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">Affiliate Terms</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Last updated: March 2025. By applying or participating you agree to these terms.</p>
      </div>

      <Card className="prose prose-slate max-w-none space-y-6 text-sm dark:prose-invert">
        <section>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">1. Commission structure</h2>
          <p>
            Commission is paid on platform fees from referred users’ first 30 days only. Rates are tier-based: 7% for
            10+ active users, 10% for 25+, 15% for 50+ in a given month. Commission applies to LocalLink’s platform fee
            only, not total GMV. Rates may be updated with 30 days’ notice.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">2. Payment cycle</h2>
          <p>
            Payouts run monthly. Minimum withdrawal is $50 (or equivalent). Methods include MoMo and bank transfer.
            You must request payout from your dashboard; we do not auto-pay below threshold.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900">3. Fraud and abuse</h2>
          <p>
            Self-referrals, fake signups, multiple accounts, and bot traffic are prohibited. Commission only counts
            after a referred user’s first successful transaction and may be subject to verification (e.g. KYC, phone
            uniqueness, IP checks). We may withhold or revoke commission and terminate your affiliate status for
            suspected fraud.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">4. Termination</h2>
          <p>
            We may suspend or terminate the program or your participation at any time. Approved commission for
            qualifying referrals before termination will be paid according to the payment cycle. We reserve the right
            to change commission rates, thresholds, or program rules with notice.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">5. Brand usage</h2>
          <p>
            You may use LocalLink’s name, logo, and approved creative only in connection with the affiliate program and
            in line with any brand guidelines we provide. You may not make misleading claims or imply that LocalLink
            endorses you beyond the affiliate relationship.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">6. Contact</h2>
          <p>
            Questions about the program or these terms: <Link to="/contact" className="text-emerald-600 underline dark:text-emerald-400">Contact us</Link>.
          </p>
        </section>
      </Card>
    </div>
  )
}
