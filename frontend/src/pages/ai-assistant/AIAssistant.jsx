import { Link } from 'react-router-dom'
import { useRef } from 'react'
import { usePageMeta } from '../../components/ui/seo.js'
import { openAssistant } from '../../components/assistant/AssistantFab.jsx'

const EXAMPLE_QUESTIONS = [
  'Find a plumber in Accra',
  'What does cement cost in Ghana right now?',
  'Show me electricians near Tema',
  'What are the top construction companies in Kumasi?',
  "What is happening in Ghana's labour market?",
]

const FEATURES = [
  {
    icon: '🔎',
    title: 'Business Discovery',
    desc: 'Find trusted local service providers instantly.',
    examples: 'Plumbers, carpenters, electricians, construction firms, suppliers. YAO can recommend the best providers based on location and reputation.',
  },
  {
    icon: '📊',
    title: 'Economic Insights',
    desc: 'Access insights from LocalLink Economist reports and business data.',
    examples: 'Construction pricing, labour market trends, regional industry growth, small business data.',
  },
  {
    icon: '🏗',
    title: 'Construction Intelligence',
    desc: 'Developers and contractors can ask YAO about construction materials prices, labour availability, cost estimates, and regional price differences.',
    examples: null,
  },
  {
    icon: '📍',
    title: 'Location Intelligence',
    desc: 'YAO understands location context across Ghana.',
    examples: '"Find carpenters near East Legon" · "Construction companies in Kumasi" · "Electrical suppliers in Tema"',
  },
  {
    icon: '🤝',
    title: 'Business Support',
    desc: 'Entrepreneurs can ask how to register a business, find suppliers, hire skilled labour, and get marketing and growth advice.',
    examples: null,
  },
]

const INDUSTRIES = [
  { title: 'Construction', desc: 'Contractors, engineers, and developers use YAO for cost insights and supplier discovery.' },
  { title: 'Skilled Trades', desc: 'Electricians, carpenters, plumbers and technicians become easier to find.' },
  { title: 'Small Businesses', desc: 'Entrepreneurs can get guidance on growth and operations.' },
  { title: 'Real Estate', desc: 'Developers and investors gain access to pricing insights.' },
  { title: 'Policy & Research', desc: 'Institutions and analysts can access economic insights through LocalLink Economist.' },
]

const FUTURE_FEATURES = [
  { icon: '🧑🏿‍💻', title: 'Meta Human Avatar', desc: 'A realistic digital AI persona that users can interact with visually — AI news presenter, economic analyst, business assistant.' },
  { icon: '🎙', title: 'Voice Conversations', desc: 'Users will be able to speak directly with YAO. e.g. "YAO, find construction companies near me."' },
  { icon: '🧠', title: 'Deep Economic Intelligence', desc: 'YAO will analyze market trends, industry data, and economic reports to generate real-time insights for businesses and policymakers.' },
  { icon: '🌍', title: 'African Economic Knowledge Engine', desc: 'Over time YAO will become a knowledge engine for Africa\'s real economy, starting with Ghana.' },
]

export function AIAssistant() {
  const capabilitiesRef = useRef(null)
  usePageMeta({ title: 'YAO — AI Assistant • LocalLink', description: "LocalLink's intelligent AI assistant for Ghana. Discover businesses, construction pricing, economic insights, and skilled workers." })

  function scrollToCapabilities() {
    capabilitiesRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950">
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-slate-200 dark:border-white/10 bg-gradient-to-b from-slate-50 to-white dark:from-slate-900 dark:to-slate-950">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(16,185,129,0.08),transparent)] dark:bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(16,185,129,0.12),transparent)]" />
        <div className="relative mx-auto max-w-4xl px-4 py-20 sm:py-28 text-center">
          <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-5xl md:text-6xl">
            Meet YAO
          </h1>
          <p className="mt-4 text-xl font-semibold text-emerald-600 dark:text-emerald-400">
            The AI Assistant for Ghana&apos;s Real Economy
          </p>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-600 dark:text-slate-400">
            A powerful AI built to help people and businesses across Ghana access information, services, and opportunities instantly.
          </p>
          <p className="mx-auto mt-4 max-w-2xl text-slate-600 dark:text-slate-400">
            Whether you&apos;re looking for skilled workers, business insights, construction pricing, or economic data — YAO connects you instantly.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <button
              type="button"
              onClick={openAssistant}
              className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-6 py-3.5 text-base font-semibold text-white shadow-lg shadow-emerald-600/25 hover:bg-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 dark:focus:ring-offset-slate-950"
            >
              Try YAO
            </button>
            <button
              type="button"
              onClick={scrollToCapabilities}
              className="inline-flex items-center justify-center rounded-xl border-2 border-slate-300 bg-white px-6 py-3.5 text-base font-semibold text-slate-700 hover:border-slate-400 hover:bg-slate-50 dark:border-white/20 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
            >
              Explore Capabilities
            </button>
          </div>
        </div>
      </section>

      {/* What YAO Does */}
      <section ref={capabilitiesRef} className="border-b border-slate-200 dark:border-white/10 bg-white dark:bg-slate-950">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:py-24">
          <h2 className="text-center text-3xl font-bold text-slate-900 dark:text-white sm:text-4xl">
            An AI Built for Ghana&apos;s Real Economy
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-center text-slate-600 dark:text-slate-400">
            Unlike generic chatbots, YAO understands the LocalLink ecosystem — connecting people with real businesses, services, and economic insights.
          </p>
          <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="rounded-2xl border border-slate-200 bg-slate-50/50 p-6 dark:border-white/10 dark:bg-white/5"
              >
                <span className="text-2xl" aria-hidden>{f.icon}</span>
                <h3 className="mt-3 text-lg font-semibold text-slate-900 dark:text-white">{f.title}</h3>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{f.desc}</p>
                {f.examples && (
                  <p className="mt-3 text-xs text-slate-500 dark:text-slate-500">{f.examples}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Example Questions */}
      <section className="border-b border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-900/50">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:py-24">
          <h2 className="text-center text-3xl font-bold text-slate-900 dark:text-white">
            Ask YAO Anything
          </h2>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            {EXAMPLE_QUESTIONS.map((q) => (
              <button
                key={q}
                type="button"
                onClick={openAssistant}
                className="rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800 dark:border-white/20 dark:bg-white/5 dark:text-slate-200 dark:hover:border-emerald-500/50 dark:hover:bg-emerald-500/10 dark:hover:text-emerald-300"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* How YAO Powers the Platform */}
      <section className="border-b border-slate-200 dark:border-white/10 bg-white dark:bg-slate-950">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:py-24">
          <h2 className="text-center text-3xl font-bold text-slate-900 dark:text-white">
            AI + Marketplace + Economic Intelligence
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-center text-slate-600 dark:text-slate-400">
            YAO sits at the center of the LocalLink ecosystem.
          </p>
          <div className="mt-12 flex flex-col items-center gap-4 text-center">
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-8 py-4 dark:border-white/10 dark:bg-white/5">Users</div>
            <div className="text-slate-400">↓</div>
            <div className="rounded-xl border-2 border-emerald-500 bg-emerald-50 px-8 py-4 font-semibold text-emerald-800 dark:border-emerald-400 dark:bg-emerald-500/20 dark:text-emerald-200">
              YAO AI Assistant
            </div>
            <div className="text-slate-400">↓</div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-8 py-4 dark:border-white/10 dark:bg-white/5">LocalLink Marketplace</div>
            <div className="text-slate-400">↓</div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-8 py-4 dark:border-white/10 dark:bg-white/5">Businesses / Skilled Workers</div>
          </div>
          <ul className="mx-auto mt-10 max-w-md list-inside list-disc text-center text-sm text-slate-600 dark:text-slate-400">
            <li>LocalLink directory</li>
            <li>LocalLink services</li>
            <li>LocalLink Economist insights</li>
            <li>Job opportunities</li>
            <li>Contractors & suppliers</li>
          </ul>
        </div>
      </section>

      {/* Industries */}
      <section className="border-b border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-900/50">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:py-24">
          <h2 className="text-center text-3xl font-bold text-slate-900 dark:text-white">
            Built for the Real Economy
          </h2>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {INDUSTRIES.map((i) => (
              <div key={i.title} className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-white/10 dark:bg-slate-950">
                <h3 className="font-semibold text-slate-900 dark:text-white">{i.title}</h3>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{i.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* YAO in Action (mock chat) */}
      <section className="border-b border-slate-200 dark:border-white/10 bg-white dark:bg-slate-950">
        <div className="mx-auto max-w-2xl px-4 py-16 sm:py-24">
          <h2 className="text-center text-3xl font-bold text-slate-900 dark:text-white">
            YAO in Action
          </h2>
          <div className="mt-10 rounded-2xl border border-slate-200 bg-slate-50 p-6 shadow-lg dark:border-white/10 dark:bg-slate-900/50">
            <div className="space-y-4">
              <div className="ml-4 mr-12 rounded-2xl bg-white px-4 py-3 text-sm text-slate-700 shadow dark:bg-slate-800 dark:text-slate-200">
                <span className="text-xs font-semibold text-slate-400">User</span>
                <p className="mt-1">What is the average cement price in Ghana?</p>
              </div>
              <div className="mr-4 ml-12 rounded-2xl bg-emerald-600 px-4 py-3 text-sm text-white shadow">
                <span className="text-xs font-semibold text-emerald-200">YAO</span>
                <p className="mt-1">
                  The average cement price is currently between GH₵90 – GH₵105 depending on region and supplier.
                  Would you like me to find suppliers near you?
                </p>
              </div>
              <div className="ml-4 mr-12 rounded-2xl bg-white px-4 py-3 text-sm text-slate-700 shadow dark:bg-slate-800 dark:text-slate-200">
                <span className="text-xs font-semibold text-slate-400">User</span>
                <p className="mt-1">Yes</p>
              </div>
              <div className="mr-4 ml-12 rounded-2xl bg-emerald-600 px-4 py-3 text-sm text-white shadow">
                <span className="text-xs font-semibold text-emerald-200">YAO</span>
                <p className="mt-1">Here are suppliers near Accra.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Economist integration */}
      <section className="border-b border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-900/50">
        <div className="mx-auto max-w-4xl px-4 py-16 sm:py-24 text-center">
          <h2 className="text-3xl font-bold text-slate-900 dark:text-white">
            Powered by LocalLink Economist Data
          </h2>
          <p className="mt-4 text-slate-600 dark:text-slate-400">
            YAO can reference insights from labour market reports, construction pricing index, economic sector research, and regional development reports — providing contextual economic intelligence rather than generic answers.
          </p>
          <Link
            to="/economist"
            className="mt-6 inline-block text-base font-semibold text-emerald-600 hover:text-emerald-500 dark:text-emerald-400 dark:hover:text-emerald-300"
          >
            Explore LocalLink Economist →
          </Link>
        </div>
      </section>

      {/* Coming Soon: Future */}
      <section className="border-b border-slate-200 dark:border-white/10 bg-white dark:bg-slate-950">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:py-24">
          <h2 className="text-center text-3xl font-bold text-slate-900 dark:text-white">
            The Future of YAO
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-center text-slate-600 dark:text-slate-400">
            YAO is just getting started. In the future, YAO will evolve into a fully interactive Meta Human AI assistant.
          </p>
          <div className="mt-12 grid gap-6 sm:grid-cols-2">
            {FUTURE_FEATURES.map((f) => (
              <div
                key={f.title}
                className="rounded-2xl border border-slate-200 bg-slate-50/50 p-6 dark:border-white/10 dark:bg-white/5"
              >
                <span className="text-2xl" aria-hidden>{f.icon}</span>
                <h3 className="mt-3 font-semibold text-slate-900 dark:text-white">{f.title}</h3>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="bg-gradient-to-b from-white to-slate-50 dark:from-slate-950 dark:to-slate-900">
        <div className="mx-auto max-w-3xl px-4 py-20 sm:py-28 text-center">
          <h2 className="text-3xl font-bold text-slate-900 dark:text-white sm:text-4xl">
            Experience the Future of Local Intelligence
          </h2>
          <p className="mt-4 text-lg text-slate-600 dark:text-slate-400">
            LocalLink is building the infrastructure for how people discover businesses, services, and economic knowledge across Ghana. YAO is the first step.
          </p>
          <button
            type="button"
            onClick={openAssistant}
            className="mt-8 inline-flex items-center justify-center rounded-xl bg-emerald-600 px-8 py-4 text-lg font-semibold text-white shadow-lg shadow-emerald-600/25 hover:bg-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 dark:focus:ring-offset-slate-950"
          >
            Try YAO
          </button>
          <p className="mt-8 text-xs text-slate-500 dark:text-slate-500">
            YAO is currently in development and will continue expanding with new capabilities across the LocalLink ecosystem.
          </p>
        </div>
      </section>
    </div>
  )
}
