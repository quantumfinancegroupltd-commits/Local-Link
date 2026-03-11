import { Link } from 'react-router-dom'
import { useRef } from 'react'
import { usePageMeta } from '../../components/ui/seo.js'
import { openAssistant } from '../../components/assistant/AssistantFab.jsx'
import { Button } from '../../components/ui/FormControls.jsx'

// Professional SVG icons (24x24, currentColor)
const IconSearch = () => (
  <svg className="h-6 w-6 shrink-0 text-brand-emerald" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden>
    <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.2-5.2M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z" />
  </svg>
)
const IconChart = () => (
  <svg className="h-6 w-6 shrink-0 text-brand-emerald" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 13h2v6H3v-6zm4 2h2v4H7v-4zm4-6h2v10h-2V9zm4 2h2v8h-2v-8z" />
  </svg>
)
const IconBuilding = () => (
  <svg className="h-6 w-6 shrink-0 text-brand-emerald" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v5m-4 0h4" />
  </svg>
)
const IconMapPin = () => (
  <svg className="h-6 w-6 shrink-0 text-brand-emerald" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden>
    <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657 13.414 20.9a1.998 1.998 0 0 1-2.827 0l-4.244-4.243a8 8 0 1 1 11.314 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 1 1-6 0 3 3 0 0 1 6 0z" />
  </svg>
)
const IconBriefcase = () => (
  <svg className="h-6 w-6 shrink-0 text-brand-emerald" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden>
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 13.255A23.931 23.931 0 0 1 12 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2m4 6h.01M5 20h14a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2z" />
  </svg>
)
const IconUser = () => (
  <svg className="h-6 w-6 shrink-0 text-brand-emerald" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden>
    <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0zM12 14a7 7 0 0 0-7 7h14a7 7 0 0 0-7-7z" />
  </svg>
)
const IconMic = () => (
  <svg className="h-6 w-6 shrink-0 text-brand-emerald" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 0 1-14 0v2a7 7 0 1 1 14 0v-2zm-7 4v3m0 0v3m0-3h3m-3 0H9" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3a3 3 0 0 1 3 3v4a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3z" />
  </svg>
)
const IconLightbulb = () => (
  <svg className="h-6 w-6 shrink-0 text-brand-emerald" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636-.707.707M21 12h-1M4 12H3m3.343-5.657-.707-.707m2.828 9.9a5 5 0 1 1 7.072 0l-.548.547A3.374 3.374 0 0 0 14 18.469V19a2 2 0 1 1-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
  </svg>
)
const IconGlobe = () => (
  <svg className="h-6 w-6 shrink-0 text-brand-emerald" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.055 11H5a2 2 0 0 1 2 2v1a2 2 0 0 0 2 2 2 2 0 0 1 2 2v2.945M8 3.935V5.5A2.5 2.5 0 0 0 10.5 8h.5a2 2 0 0 1 2 2 2 2 0 1 0 4 0 2 2 0 0 1 2-2h1.064M15 20.488V18a2 2 0 0 1 2-2h3.064M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
  </svg>
)

const EXAMPLE_QUESTIONS = [
  'Find a plumber in Accra',
  'What does cement cost in Ghana right now?',
  'Show me electricians near Tema',
  'What are the top construction companies in Kumasi?',
  "What is happening in Ghana's labour market?",
  'Hwehwɛ obi a ɔyɛ adwuma wɔ Accra',
]

const FEATURES = [
  { Icon: IconSearch, title: 'Business Discovery', desc: 'Find trusted local service providers instantly.', examples: 'Plumbers, carpenters, electricians, construction firms, suppliers. YAO can recommend the best providers based on location and reputation.' },
  { Icon: IconChart, title: 'Economic Insights', desc: 'Access insights from LocalLink Economist reports and business data.', examples: 'Construction pricing, labour market trends, regional industry growth, small business data.' },
  { Icon: IconBuilding, title: 'Construction Intelligence', desc: 'Developers and contractors can ask YAO about construction materials prices, labour availability, cost estimates, and regional price differences.', examples: null },
  { Icon: IconMapPin, title: 'Location Intelligence', desc: 'YAO understands location context across Ghana.', examples: '"Find carpenters near East Legon" · "Construction companies in Kumasi" · "Electrical suppliers in Tema"', },
  { Icon: IconBriefcase, title: 'Business Support', desc: 'Entrepreneurs can ask how to register a business, find suppliers, hire skilled labour, and get marketing and growth advice.', examples: null },
]

const INDUSTRIES = [
  { title: 'Construction', desc: 'Contractors, engineers, and developers use YAO for cost insights and supplier discovery.' },
  { title: 'Skilled Trades', desc: 'Electricians, carpenters, plumbers and technicians become easier to find.' },
  { title: 'Small Businesses', desc: 'Entrepreneurs can get guidance on growth and operations.' },
  { title: 'Real Estate', desc: 'Developers and investors gain access to pricing insights.' },
  { title: 'Policy & Research', desc: 'Institutions and analysts can access economic insights through LocalLink Economist.' },
]

const FUTURE_FEATURES = [
  { Icon: IconUser, title: 'Meta Human Avatar', desc: 'A realistic digital AI persona that users can interact with visually — AI news presenter, economic analyst, business assistant.' },
  { Icon: IconMic, title: 'Voice Conversations', desc: 'Users will be able to speak directly with YAO. e.g. "YAO, find construction companies near me."' },
  { Icon: IconLightbulb, title: 'Deep Economic Intelligence', desc: 'YAO will analyze market trends, industry data, and economic reports to generate real-time insights for businesses and policymakers.' },
  { Icon: IconGlobe, title: 'African Economic Knowledge Engine', desc: 'Over time YAO will become a knowledge engine for Africa\'s real economy, starting with Ghana.' },
]

export function AIAssistant() {
  const capabilitiesRef = useRef(null)
  usePageMeta({ title: 'YAO — AI Assistant • LocalLink', description: "LocalLink's intelligent AI assistant for Ghana. Speak or type in English or Twi. Discover businesses, construction pricing, economic insights, and skilled workers." })

  function scrollToCapabilities() {
    capabilitiesRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <div className="min-h-screen bg-white dark:bg-black">
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-slate-200 dark:border-white/10 bg-gradient-to-b from-slate-50 to-white dark:from-black dark:to-black">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(16,185,129,0.08),transparent)] dark:bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(34,197,94,0.12),transparent)]" />
        <div className="relative mx-auto max-w-4xl px-4 py-20 sm:py-28 text-center">
          <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-5xl md:text-6xl">
            Meet YAO
          </h1>
          <p className="mt-4 text-xl font-semibold text-brand-emerald">
            The AI Assistant for Ghana&apos;s Real Economy
          </p>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-600 dark:text-slate-400">
            A powerful AI built to help people and businesses across Ghana access information, services, and opportunities instantly.
          </p>
          <p className="mx-auto mt-4 max-w-2xl text-slate-600 dark:text-slate-400">
            Whether you&apos;re looking for skilled workers, business insights, construction pricing, or economic data — YAO connects you instantly.
          </p>
          <p className="mx-auto mt-3 max-w-2xl text-base font-medium text-brand-emerald">
            Speak or type in English or Twi — YAO responds in your language.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Button type="button" onClick={openAssistant} className="px-6 py-3.5 text-base shadow-md ring-2 ring-white/20">
              Try YAO
            </Button>
            <Button type="button" variant="secondary" onClick={scrollToCapabilities} className="px-6 py-3.5 text-base">
              Explore Capabilities
            </Button>
          </div>
        </div>
      </section>

      {/* What YAO Does */}
      <section ref={capabilitiesRef} className="border-b border-slate-200 dark:border-white/10 bg-white dark:bg-black">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:py-24">
          <h2 className="text-center text-3xl font-bold text-slate-900 dark:text-white sm:text-4xl">
            An AI Built for Ghana&apos;s Real Economy
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-center text-slate-600 dark:text-slate-400">
            Unlike generic chatbots, YAO understands the LocalLink ecosystem — connecting people with real businesses, services, and economic insights.
          </p>
          <p className="mx-auto mt-3 max-w-2xl text-center text-sm font-medium text-brand-emerald">
            Use Twi or English — type or speak; YAO replies in the language you use.
          </p>
          <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="rounded-2xl border border-slate-200 bg-slate-50/50 p-6 dark:border-white/10 dark:bg-white/5 dark:backdrop-blur-sm"
              >
                <f.Icon />
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
      <section className="border-b border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black">
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
                className="rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm hover:border-brand-emerald/50 hover:bg-brand-emerald/10 hover:text-slate-900 dark:border-white/20 dark:bg-white/10 dark:text-slate-200 dark:hover:border-brand-emerald/50 dark:hover:bg-brand-emerald/20 dark:hover:text-white dark:backdrop-blur-sm"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* How YAO Powers the Platform */}
      <section className="border-b border-slate-200 dark:border-white/10 bg-white dark:bg-black">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:py-24">
          <h2 className="text-center text-3xl font-bold text-slate-900 dark:text-white">
            AI + Marketplace + Economic Intelligence
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-center text-slate-600 dark:text-slate-400">
            YAO sits at the center of the LocalLink ecosystem.
          </p>
          <div className="mt-12 flex flex-col items-center gap-4 text-center">
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-8 py-4 dark:border-white/10 dark:bg-white/5 dark:backdrop-blur-sm">Users</div>
            <div className="text-slate-400">↓</div>
            <div className="rounded-xl border-2 border-brand-emerald bg-brand-gradient px-8 py-4 font-semibold text-white shadow-sm dark:backdrop-blur-sm">
              YAO AI Assistant
            </div>
            <div className="text-slate-400">↓</div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-8 py-4 dark:border-white/10 dark:bg-white/5 dark:backdrop-blur-sm">LocalLink Marketplace</div>
            <div className="text-slate-400">↓</div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-8 py-4 dark:border-white/10 dark:bg-white/5 dark:backdrop-blur-sm">Businesses / Skilled Workers</div>
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
      <section className="border-b border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:py-24">
          <h2 className="text-center text-3xl font-bold text-slate-900 dark:text-white">
            Built for the Real Economy
          </h2>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {INDUSTRIES.map((i) => (
              <div key={i.title} className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-white/10 dark:bg-white/5 dark:backdrop-blur-sm">
                <h3 className="font-semibold text-slate-900 dark:text-white">{i.title}</h3>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{i.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* YAO in Action (mock chat) */}
      <section className="border-b border-slate-200 dark:border-white/10 bg-white dark:bg-black">
        <div className="mx-auto max-w-2xl px-4 py-16 sm:py-24">
          <h2 className="text-center text-3xl font-bold text-slate-900 dark:text-white">
            YAO in Action
          </h2>
          <div className="mt-10 rounded-2xl border border-slate-200 bg-slate-50 p-6 shadow-lg dark:border-white/10 dark:bg-white/5 dark:backdrop-blur-sm">
            <div className="space-y-4">
              <div className="ml-4 mr-12 rounded-2xl bg-white px-4 py-3 text-sm text-slate-700 shadow dark:bg-white/10 dark:text-slate-200 dark:backdrop-blur-sm">
                <span className="text-xs font-semibold text-slate-400">User</span>
                <p className="mt-1">What is the average cement price in Ghana?</p>
              </div>
              <div className="mr-4 ml-12 rounded-2xl bg-brand-gradient px-4 py-3 text-sm text-white shadow">
                <span className="text-xs font-semibold text-white/90">YAO</span>
                <p className="mt-1">
                  The average cement price is currently between GH₵90 – GH₵105 depending on region and supplier.
                  Would you like me to find suppliers near you?
                </p>
              </div>
              <div className="ml-4 mr-12 rounded-2xl bg-white px-4 py-3 text-sm text-slate-700 shadow dark:bg-white/10 dark:text-slate-200 dark:backdrop-blur-sm">
                <span className="text-xs font-semibold text-slate-400">User</span>
                <p className="mt-1">Yes</p>
              </div>
              <div className="mr-4 ml-12 rounded-2xl bg-brand-gradient px-4 py-3 text-sm text-white shadow">
                <span className="text-xs font-semibold text-white/90">YAO</span>
                <p className="mt-1">Here are suppliers near Accra.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Economist integration */}
      <section className="border-b border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black">
        <div className="mx-auto max-w-4xl px-4 py-16 sm:py-24 text-center">
          <h2 className="text-3xl font-bold text-slate-900 dark:text-white">
            Powered by LocalLink Economist Data
          </h2>
          <p className="mt-4 text-slate-600 dark:text-slate-400">
            YAO can reference insights from labour market reports, construction pricing index, economic sector research, and regional development reports — providing contextual economic intelligence rather than generic answers.
          </p>
          <Link
            to="/economist"
            className="mt-6 inline-block text-base font-semibold text-brand-emerald hover:opacity-90 dark:text-brand-emerald"
          >
            Explore LocalLink Economist →
          </Link>
        </div>
      </section>

      {/* Coming Soon: Future */}
      <section className="border-b border-slate-200 dark:border-white/10 bg-white dark:bg-black">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:py-24">
          <h2 className="text-center text-3xl font-bold text-slate-900 dark:text-white">
            The Future of YAO
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-center text-slate-600 dark:text-slate-400">
            YAO is just getting started. In the future, YAO will evolve into a fully interactive Meta Human AI assistant.
          </p>
          <div className="mx-auto mt-10 max-w-md">
            <img
              src="/yao-metahuman.png"
              alt="YAO Meta Human — a realistic digital AI persona for LocalLink"
              className="w-full rounded-2xl border border-slate-200 shadow-lg dark:border-white/10"
              loading="lazy"
            />
          </div>
          <div className="mt-12 grid gap-6 sm:grid-cols-2">
            {FUTURE_FEATURES.map((f) => (
              <div
                key={f.title}
                className="rounded-2xl border border-slate-200 bg-slate-50/50 p-6 dark:border-white/10 dark:bg-white/5 dark:backdrop-blur-sm"
              >
                <f.Icon />
                <h3 className="mt-3 font-semibold text-slate-900 dark:text-white">{f.title}</h3>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="bg-gradient-to-b from-white to-slate-50 dark:from-black dark:to-black">
        <div className="mx-auto max-w-3xl px-4 py-20 sm:py-28 text-center">
          <h2 className="text-3xl font-bold text-slate-900 dark:text-white sm:text-4xl">
            Experience the Future of Local Intelligence
          </h2>
          <p className="mt-4 text-lg text-slate-600 dark:text-slate-400">
            LocalLink is building the infrastructure for how people discover businesses, services, and economic knowledge across Ghana. YAO is the first step.
          </p>
          <Button type="button" onClick={openAssistant} className="mt-8 px-8 py-4 text-lg shadow-md ring-2 ring-white/20">
            Try YAO
          </Button>
          <p className="mt-8 text-xs text-slate-500 dark:text-slate-500">
            YAO is currently in development and will continue expanding with new capabilities across the LocalLink ecosystem.
          </p>
        </div>
      </section>
    </div>
  )
}
