import { Link } from 'react-router-dom'
import { Button, Card } from '../../components/ui/FormControls.jsx'

export function AffiliatesLanding() {
  return (
    <div className="mx-auto max-w-4xl space-y-16">
      {/* Hero */}
      <section className="text-center">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-4xl">
          Earn Every Time Someone Uses LocalLink.
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-600 dark:text-slate-400">
          Join the LocalLink Affiliate Program and get paid when the people you refer complete their first month on the
          platform.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <Link to="/affiliates/register">
            <Button>Apply Now</Button>
          </Link>
          <Link to="/login?redirect=/affiliates/dashboard">
            <Button variant="secondary">Login</Button>
          </Link>
        </div>
        <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">No fees. No upfront cost. Performance-based earnings.</p>
      </section>

      {/* How You Earn */}
      <section id="how-it-works" className="scroll-mt-8">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">How You Earn</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-5">
          {[
            { step: 1, text: 'Apply to become an affiliate.' },
            { step: 2, text: 'Get approved and access your dashboard.' },
            { step: 3, text: 'Create your unique referral link or promo code.' },
            { step: 4, text: 'Share it on social media, WhatsApp, YouTube, or in your community.' },
            { step: 5, text: 'Earn commission when your referrals complete their first month.' },
          ].map(({ step, text }) => (
            <Card key={step} className="text-center">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                {step}
              </span>
              <p className="mt-2 text-sm text-slate-700 dark:text-slate-400">{text}</p>
            </Card>
          ))}
        </div>
        <p className="mt-4 text-sm font-medium text-slate-600 dark:text-slate-400">Simple. Transparent. Trackable.</p>
      </section>

      {/* Earning Potential */}
      <section>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Your Earning Potential</h2>
        <Card className="mt-6">
          <ul className="space-y-3 text-slate-700 dark:text-slate-400">
            <li className="flex items-center gap-2">
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">Refer 10 active users</span>
              <span>→ Earn 7% commission</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">Refer 25 active users</span>
              <span>→ Earn 10% commission</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">Refer 50+ active users</span>
              <span>→ Earn 15% commission</span>
            </li>
          </ul>
          <p className="mt-4 text-sm text-slate-600 dark:text-slate-400">Paid monthly. Track everything in your dashboard.</p>
        </Card>
      </section>

      {/* Who This Is For */}
      <section id="ambassadors">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Perfect For</h2>
        <ul className="mt-4 grid gap-2 sm:grid-cols-2 md:grid-cols-3">
          {[
            'YouTubers',
            'TikTok creators',
            'Community leaders',
            'Estate WhatsApp admins',
            'Students',
            'Marketing agencies',
            'Influencers',
          ].map((item) => (
            <li key={item} className="flex items-center gap-2 text-slate-700 dark:text-slate-400">
              <span className="text-emerald-500 dark:text-emerald-400">•</span>
              {item}
            </li>
          ))}
        </ul>
        <p className="mt-4 text-slate-600 dark:text-slate-400">If you have an audience, you can earn.</p>
      </section>

      {/* What You Get */}
      <section>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">What You Get</h2>
        <ul className="mt-4 flex flex-wrap gap-3">
          {[
            'Personal dashboard',
            'Real-time tracking',
            'Custom promo codes',
            'Unique referral links',
            'Monthly payouts',
            'Dedicated support',
          ].map((item) => (
            <li
              key={item}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-300"
            >
              <span className="text-emerald-600 dark:text-emerald-400">✔</span> {item}
            </li>
          ))}
        </ul>
      </section>

      {/* Trust Block */}
      <section>
        <Card className="border-emerald-100 bg-emerald-50/50 dark:border-emerald-500/20 dark:bg-emerald-900/20">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Why LocalLink?</h2>
          <ul className="mt-3 space-y-1 text-slate-700 dark:text-slate-300">
            <li>• Escrow-protected payments</li>
            <li>• Verified professionals</li>
            <li>• Growing across Accra</li>
            <li>• Built for trust</li>
          </ul>
          <p className="mt-4 font-medium text-slate-800 dark:text-slate-200">When your audience wins, you win.</p>
        </Card>
      </section>

      {/* Final CTA */}
      <section className="text-center">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Start Earning Today.</h2>
        <Link to="/affiliates/register" className="mt-6 inline-block">
          <Button>Apply to Become an Affiliate</Button>
        </Link>
        <p className="mt-4 text-sm text-slate-600 dark:text-slate-400">
          By applying you agree to our <Link to="/affiliate-terms" className="text-emerald-600 underline dark:text-emerald-400">Affiliate Terms</Link>.
        </p>
      </section>
    </div>
  )
}
