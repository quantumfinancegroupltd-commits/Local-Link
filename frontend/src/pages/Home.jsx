import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth.js'
import { FARMER_FLORIST_MARKETPLACE_LABEL, roleHomePath } from '../lib/roles.js'
import { http } from '../api/http.js'
import { ProductCard } from '../components/marketplace/ProductCard.jsx'
import { ServiceCard } from '../components/marketplace/ServiceCard.jsx'
import './Home.css'

function LogoIcon({ size = 34, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none" className={className}>
      <rect width="36" height="36" rx="8" fill="#16A34A" />
      <path d="M12 15h12l-2 9H14L12 15z" stroke="white" strokeWidth="1.7" strokeLinejoin="round" fill="none" />
      <path d="M15.5 15c0-1.38 1.12-2.5 2.5-2.5s2.5 1.12 2.5 2.5" stroke="white" strokeWidth="1.7" strokeLinecap="round" fill="none" />
      <circle cx="16.5" cy="20.5" r="1" fill="white" />
      <circle cx="19.5" cy="20.5" r="1" fill="white" />
    </svg>
  )
}

function ArrowRight({ w = 13, h = 13 }) {
  return (
    <svg width={w} height={h} viewBox="0 0 16 16" fill="none">
      <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function moneyRange(j) {
  const min = j?.pay_min != null ? Number(j.pay_min) : null
  const max = j?.pay_max != null ? Number(j.pay_max) : null
  const c = j?.currency || 'GHS'
  const per = String(j?.pay_period || '').trim().toLowerCase()
  const suffix = per ? ` / ${per}` : ''
  if (min == null && max == null) return null
  if (min != null && max != null) return `${c} ${min.toFixed(0)}–${max.toFixed(0)}${suffix}`
  if (min != null) return `${c} ${min.toFixed(0)}+${suffix}`
  return `${c} up to ${max.toFixed(0)}${suffix}`
}

const HOW_TABS = [
  { id: 'buyer', label: 'For Buyers' },
  { id: 'artisan', label: 'For Artisans' },
  { id: 'farmer', label: 'For Farmers' },
  { id: 'driver', label: 'For Drivers' },
  { id: 'company', label: 'For Companies' },
]

export function Home() {
  const { isAuthed, user } = useAuth()
  const [activeTab, setActiveTab] = useState('buyer')
  const [products, setProducts] = useState([])
  const [services, setServices] = useState([])
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all([
      http.get('/products').then((r) => (Array.isArray(r.data) ? r.data : r.data?.products ?? [])).catch(() => []),
      http.get('/marketplace/services').then((r) => (Array.isArray(r.data) ? r.data : [])).catch(() => []),
      http.get('/corporate/jobs', { params: { limit: 15 } }).then((r) => (Array.isArray(r.data) ? r.data : [])).catch(() => []),
    ]).then(([prods, svcs, jbs]) => {
      if (!cancelled) {
        setProducts(prods.slice(0, 8))
        setServices(svcs.slice(0, 8))
        setJobs(jbs.slice(0, 6))
      }
    }).finally(() => {
      if (!cancelled) setLoading(false)
    })
    return () => { cancelled = true }
  }, [])

  const revealRef = useRef(null)
  useEffect(() => {
    const el = revealRef.current
    if (!el) return
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) e.target.classList.add('ll-in')
        })
      },
      { threshold: 0.05, rootMargin: '0px 0px -40px 0px' }
    )
    el.querySelectorAll('.ll-reveal').forEach((node) => io.observe(node))
    return () => io.disconnect()
  }, [])

  if (isAuthed) return <Navigate to={roleHomePath(user?.role)} replace />

  return (
    <div className="ll-landing" ref={revealRef} style={{ background: 'var(--ll-bg)', minHeight: '100%' }}>
      {/* HERO */}
      <section className="ll-hero">
        <div className="ll-wrap">
          <div className="ll-hero-card ll-reveal">
            <div className="ll-hero-eyebrow">
              <div className="ll-hero-pulse" />
              Trusted local services & supplies — Ghana-ready
            </div>
            <h1 className="ll-hero-title">
              Hire a professional.<br />Buy fresh produce.<br />Find employees.
            </h1>
            <p className="ll-hero-sub">
              LocalLink is a trust + payment + coordination layer: verification tiers, escrow-style payments (Trust Wallet), delivery, and real reviews.
            </p>
            <div className="ll-hero-ctas">
              <Link to="/register?role=buyer" className="ll-btn ll-btn-green ll-btn-lg">Hire a professional</Link>
              <Link to="/marketplace" className="ll-btn ll-btn-outline ll-btn-lg">Buy fresh produce</Link>
              <Link to="/corporate" className="ll-btn ll-btn-outline ll-btn-lg">For employers</Link>
              <Link to="/login" className="ll-btn ll-btn-ghost ll-btn-lg">Login</Link>
            </div>
            <div className="ll-hero-role-row">
              <span className="ll-hero-role-label">Join as a provider:</span>
              <Link to="/register?role=artisan" className="ll-role-chip">Artisan / Professional</Link>
              <Link to="/register?role=farmer" className="ll-role-chip">Farmer / Florist</Link>
              <Link to="/register?role=driver" className="ll-role-chip">Delivery Driver</Link>
              <Link to="/register?role=company" className="ll-role-chip">Employer / Company</Link>
            </div>
          </div>
          <div className="ll-stats-row ll-reveal ll-d1">
            <div className="ll-stat-box"><div className="ll-stat-num">2,400+</div><div className="ll-stat-lbl">Verified providers</div></div>
            <div className="ll-stat-box"><div className="ll-stat-num">GHS 1.2M+</div><div className="ll-stat-lbl">Paid to artisans</div></div>
            <div className="ll-stat-box"><div className="ll-stat-num">8,000+</div><div className="ll-stat-lbl">Jobs completed</div></div>
            <div className="ll-stat-box"><div className="ll-stat-num">12 cities</div><div className="ll-stat-lbl">Across Ghana</div></div>
          </div>
        </div>
      </section>

      {/* VERTICALS */}
      <section className="ll-section">
        <div className="ll-wrap">
          <div className="ll-sec-hdr ll-reveal">
            <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--ll-muted)', marginBottom: 4, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Launch focus</p>
            <h2 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.022em', color: 'var(--ll-ink)', marginBottom: 6 }}>Hire, buy, employ — plus events & domestic.</h2>
            <p className="ll-sec-sub">Skilled labour, produce & flowers, and employers are live with scheduling and escrow. More verticals unlock later.</p>
          </div>
          <div className="ll-vert-grid">
            <Link to="/providers" className="ll-vert-card ll-reveal ll-d1">
              <div className="ll-vert-img" style={{ height: 210 }}>
                <img src="https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=600&q=80&auto=format&fit=crop" alt="Electrician at work" loading="lazy" />
                <div className="ll-vert-overlay" />
                <span className="ll-vert-pill"><span className="ll-badge ll-badge-grey">Explore</span></span>
              </div>
              <div className="ll-vert-body">
                <div className="ll-vert-title">Hire a Professional (Skilled Labour)</div>
                <div className="ll-vert-desc">Plumber, electrician, carpenter, mason, AC servicing.</div>
                <span className="ll-vert-cta">Explore <ArrowRight /></span>
              </div>
            </Link>
            <Link to="/marketplace" className="ll-vert-card ll-reveal ll-d2">
              <div className="ll-vert-img" style={{ height: 210 }}>
                <img src="https://images.unsplash.com/photo-1540420773420-3366772f4999?w=600&q=80&auto=format&fit=crop" alt="Fresh produce" loading="lazy" />
                <div className="ll-vert-overlay" />
                <span className="ll-vert-pill"><span className="ll-badge ll-badge-grey">Explore</span></span>
              </div>
              <div className="ll-vert-body">
                <div className="ll-vert-title">Buy Fresh Produce & Flowers ({FARMER_FLORIST_MARKETPLACE_LABEL} + Delivery)</div>
                <div className="ll-vert-desc">Browse listings, order, and track delivery — with escrow protection.</div>
                <span className="ll-vert-cta">Explore <ArrowRight /></span>
              </div>
            </Link>
            <div className="ll-vert-pair ll-reveal ll-d3">
              <Link to="/jobs" className="ll-vert-card">
                <div className="ll-vert-img" style={{ height: 120 }}>
                  <img src="https://images.unsplash.com/photo-1573164713347-df9f1bf5f756?w=600&q=80&auto=format&fit=crop" alt="Business team" loading="lazy" />
                  <div className="ll-vert-overlay" />
                  <span className="ll-vert-pill"><span className="ll-badge ll-badge-grey">Explore</span></span>
                </div>
                <div className="ll-vert-body" style={{ padding: 13 }}>
                  <div className="ll-vert-title" style={{ fontSize: 14 }}>Employers (Post jobs)</div>
                  <div className="ll-vert-desc" style={{ fontSize: 12, marginBottom: 8 }}>Post roles, track applicants, reduce no-shows.</div>
                  <span className="ll-vert-cta" style={{ fontSize: 12 }}>Explore →</span>
                </div>
              </Link>
              <Link to="/register?role=buyer&category=events" className="ll-vert-card">
                <div className="ll-vert-img" style={{ height: 120 }}>
                  <img src="https://images.unsplash.com/photo-1555244162-803834f70033?w=600&q=80&auto=format&fit=crop" alt="Events catering" loading="lazy" />
                  <div className="ll-vert-overlay" />
                  <span className="ll-vert-pill"><span className="ll-badge ll-badge-grey">Explore</span></span>
                </div>
                <div className="ll-vert-body" style={{ padding: 13 }}>
                  <div className="ll-vert-title" style={{ fontSize: 14 }}>Events, domestic services & more</div>
                  <div className="ll-vert-desc" style={{ fontSize: 12, marginBottom: 8 }}>Caterers and cleaners — scheduling + escrow.</div>
                  <span className="ll-vert-cta" style={{ fontSize: 12 }}>Explore →</span>
                </div>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* PROVIDER SERVICES */}
      <section className="ll-section" style={{ paddingTop: 0 }}>
        <div className="ll-wrap">
          <div className="ll-sec-hdr ll-reveal">
            <div className="ll-sec-hdr-row">
              <h2 className="ll-sec-title">Provider services</h2>
              <Link to="/providers" className="ll-see-all">See all <ArrowRight /></Link>
            </div>
          </div>
          <div className="ll-prov-grid">
            {loading
              ? Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="ll-reveal" style={{ background: 'var(--ll-surface)', border: '1px solid var(--ll-border)', borderRadius: 16, minHeight: 320 }} />
                ))
              : services.slice(0, 4).map((s) => (
                  <div key={s.id} className="ll-reveal">
                    <ServiceCard service={s} />
                  </div>
                ))}
          </div>
        </div>
      </section>

      {/* FARMERS & FLORISTS */}
      <section className="ll-section" style={{ background: 'var(--ll-surface)', borderTop: '1px solid var(--ll-border)', borderBottom: '1px solid var(--ll-border)' }}>
        <div className="ll-wrap">
          <div className="ll-sec-hdr ll-reveal">
            <div className="ll-sec-hdr-row">
              <h2 className="ll-sec-title">Farmers & Florists</h2>
              <Link to="/marketplace" className="ll-see-all">See all <ArrowRight /></Link>
            </div>
          </div>
          <div className="ll-market-grid">
            {loading
              ? Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="ll-reveal" style={{ background: 'var(--ll-surface)', border: '1px solid var(--ll-border)', borderRadius: 16, minHeight: 260 }} />
                ))
              : products.slice(0, 4).map((p) => (
                  <div key={p.id} className="ll-reveal">
                    <ProductCard product={p} />
                  </div>
                ))}
          </div>
        </div>
      </section>

      {/* EMPLOYERS OPEN ROLES */}
      <section className="ll-section">
        <div className="ll-wrap">
          <div className="ll-sec-hdr ll-reveal">
            <div className="ll-sec-hdr-row">
              <h2 className="ll-sec-title">Employers — open roles</h2>
              <Link to="/jobs" className="ll-see-all">See all <ArrowRight /></Link>
            </div>
          </div>
          <div className="ll-jobs-grid ll-reveal">
            {loading
              ? Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} style={{ background: 'var(--ll-surface)', border: '1px solid var(--ll-border)', borderRadius: 14, padding: 20, minHeight: 140 }} />
                ))
              : jobs.slice(0, 3).map((j) => (
                  <Link key={j.id} to={`/jobs/${j.id}`} className="ll-job-card">
                    <div className="ll-job-title">{j.title}</div>
                    <div className="ll-job-company">{j.company_name || 'Company'} · {j.location || 'Ghana'}</div>
                    <div className="ll-job-salary">{moneyRange(j) || '—'}</div>
                    <div className="ll-job-tags">
                      <span className="ll-badge ll-badge-grey">{j.employment_type || 'Full-time'}</span>
                      <span className="ll-badge ll-badge-green">Hiring</span>
                    </div>
                    <span className="ll-job-cta">View role <ArrowRight w={12} h={12} /></span>
                  </Link>
                ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="ll-section ll-how-sec">
        <div className="ll-wrap">
          <div className="ll-sec-hdr ll-reveal">
            <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--ll-ink)', marginBottom: 6 }}>How it works</h2>
            <p className="ll-sec-sub">Every transaction is protected. Nobody pays until the job is done right.</p>
          </div>
          <div className="ll-tab-wrap ll-reveal">
            {HOW_TABS.map((t) => (
              <button key={t.id} type="button" className={`ll-tab ${activeTab === t.id ? 'll-active' : ''}`} onClick={() => setActiveTab(t.id)}>{t.label}</button>
            ))}
          </div>

          {activeTab === 'buyer' && (
            <div className="ll-how-panel ll-active ll-reveal">
              <div className="ll-steps">
                <div className="ll-step"><div className="ll-step-n">01</div><div><h4>Post your job</h4><p>Describe what you need — cleaning, catering, repairs. Add photos, budget, and location in 2 minutes.</p></div></div>
                <div className="ll-step"><div className="ll-step-n">02</div><div><h4>Receive and compare quotes</h4><p>Verified local professionals send quotes with price, timeline, and a message. Review profiles and ratings.</p></div></div>
                <div className="ll-step"><div className="ll-step-n">03</div><div><h4>Pay into escrow</h4><p>Funds held securely until you're satisfied. Your money is never released until the job is done right.</p></div></div>
                <div className="ll-step"><div className="ll-step-n">04</div><div><h4>Release & review</h4><p>Happy? Release payment and leave a review. Not satisfied? Open a dispute — we'll resolve it fairly.</p></div></div>
              </div>
              <div className="ll-mock-panel">
                <div className="ll-mock-card">
                  <div className="ll-mock-ico" style={{ background: '#F0FDF4' }}>📋</div>
                  <div className="ll-mock-t"><div className="ll-mock-name">Deep clean – 3 bedroom house</div><div className="ll-mock-sub">East Legon · Budget: GHS 200–300</div></div>
                  <span className="ll-badge ll-badge-gold" style={{ fontSize: 10 }}>3 Quotes</span>
                </div>
                <div className="ll-mock-card">
                  <div className="ll-mock-ico" style={{ overflow: 'hidden', padding: 0 }}>👤</div>
                  <div className="ll-mock-t"><div className="ll-mock-name">Ama Asante</div><div className="ll-mock-sub">★★★★★ · 127 jobs · GHS 250</div></div>
                  <span className="ll-badge ll-badge-green" style={{ fontSize: 10 }}>Verified ✓</span>
                </div>
                <div className="ll-mock-escrow">
                  <div className="ll-mec-lbl">Escrow Balance</div>
                  <div className="ll-mec-amt">GHS 250.00</div>
                  <div className="ll-mec-st">Held securely · Release when satisfied</div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'artisan' && (
            <div className="ll-how-panel ll-active ll-reveal">
              <div className="ll-steps">
                <div className="ll-step"><div className="ll-step-n">01</div><div><h4>Build your profile</h4><p>List services with prices, set availability, upload your Ghana Card for a verified trust badge.</p></div></div>
                <div className="ll-step"><div className="ll-step-n">02</div><div><h4>Browse & quote jobs</h4><p>See jobs matching your skills. Submit quotes with price, timeline, and a personal message to the buyer.</p></div></div>
                <div className="ll-step"><div className="ll-step-n">03</div><div><h4>Complete & prove the work</h4><p>Upload before/after photos as proof. Mark complete — buyer gets notified to release payment.</p></div></div>
                <div className="ll-step"><div className="ll-step-n">04</div><div><h4>Earn to your wallet</h4><p>Funds hit your LocalLink wallet. Withdraw anytime via MoMo or bank. Build your reputation, earn more.</p></div></div>
              </div>
              <div className="ll-mock-panel">
                <div className="ll-mock-card"><div className="ll-mock-ico" style={{ background: '#FEF9C3' }}>🔧</div><div className="ll-mock-t"><div className="ll-mock-name">Electrical fault diagnosis</div><div className="ll-mock-sub">Airport Hills · GHS 180 offered</div></div><span className="ll-badge ll-badge-green" style={{ fontSize: 10 }}>New</span></div>
                <div className="ll-mock-card"><div className="ll-mock-ico" style={{ background: '#F0FDF4' }}>💰</div><div className="ll-mock-t"><div className="ll-mock-name">Wallet Balance</div><div className="ll-mock-sub">Available to withdraw</div></div><span style={{ fontSize: 16, fontWeight: 800, color: 'var(--ll-green)' }}>GHS 1,840</span></div>
                <div className="ll-mock-escrow"><div className="ll-mec-lbl">This month</div><div className="ll-mec-amt">GHS 3,200</div><div className="ll-mec-st">↑ 24% from last month · 12 jobs</div></div>
              </div>
            </div>
          )}

          {activeTab === 'farmer' && (
            <div className="ll-how-panel ll-active ll-reveal">
              <div className="ll-steps">
                <div className="ll-step"><div className="ll-step-n">01</div><div><h4>List your produce</h4><p>Add products with photos, prices, and quantities. Set your farm location for distance-based delivery pricing.</p></div></div>
                <div className="ll-step"><div className="ll-step-n">02</div><div><h4>Receive orders</h4><p>Buyers discover your listings on the marketplace and order directly. You're notified instantly.</p></div></div>
                <div className="ll-step"><div className="ll-step-n">03</div><div><h4>Confirm & dispatch</h4><p>Confirm the order, pack it, mark dispatched. A local driver can handle delivery if you need one.</p></div></div>
                <div className="ll-step"><div className="ll-step-n">04</div><div><h4>Get paid</h4><p>Payment released to your wallet on delivery. Withdraw to MoMo anytime. Build repeat customers.</p></div></div>
              </div>
              <div className="ll-mock-panel">
                <div className="ll-mock-card"><div className="ll-mock-ico" style={{ background: '#F0FDF4' }}>🌱</div><div className="ll-mock-t"><div className="ll-mock-name">Organic Tomatoes — 5kg</div><div className="ll-mock-sub">Dodowa Farm · GHS 45/crate</div></div><span className="ll-badge ll-badge-green" style={{ fontSize: 10 }}>Active</span></div>
                <div className="ll-mock-card"><div className="ll-mock-ico" style={{ background: '#FEF9C3' }}>📦</div><div className="ll-mock-t"><div className="ll-mock-name">Order #1042 — Kofi Mensah</div><div className="ll-mock-sub">2× crates · East Legon · Paid</div></div><span className="ll-badge ll-badge-gold" style={{ fontSize: 10 }}>Dispatch</span></div>
                <div className="ll-mock-escrow" style={{ background: '#166534' }}><div className="ll-mec-lbl">Today's Orders</div><div className="ll-mec-amt">6 orders</div><div className="ll-mec-st">GHS 540 incoming · 2 pending dispatch</div></div>
              </div>
            </div>
          )}

          {activeTab === 'driver' && (
            <div className="ll-how-panel ll-active ll-reveal">
              <div className="ll-steps">
                <div className="ll-step"><div className="ll-step-n">01</div><div><h4>Apply & get approved</h4><p>Submit your vehicle type and operating area. Admin approves your profile — usually within 24 hours.</p></div></div>
                <div className="ll-step"><div className="ll-step-n">02</div><div><h4>Go online, claim deliveries</h4><p>Toggle online to see available deliveries near you. Review fee, pickup, and dropoff before claiming.</p></div></div>
                <div className="ll-step"><div className="ll-step-n">03</div><div><h4>Deliver & confirm</h4><p>Pick up, deliver, mark complete. Status updates keep buyer and farmer informed throughout.</p></div></div>
                <div className="ll-step"><div className="ll-step-n">04</div><div><h4>Earn per delivery</h4><p>Delivery fee hits your wallet after confirmation. Withdraw to MoMo whenever. No minimums.</p></div></div>
              </div>
              <div className="ll-mock-panel">
                <div className="ll-mock-card"><div className="ll-mock-ico" style={{ background: '#EFF6FF' }}>📍</div><div className="ll-mock-t"><div className="ll-mock-name">Delivery: Osu → Cantonments</div><div className="ll-mock-sub">4.2km · Fee: GHS 18 · Flowers</div></div><span className="ll-badge ll-badge-gold" style={{ fontSize: 10 }}>Claim</span></div>
                <div className="ll-mock-card"><div className="ll-mock-ico" style={{ background: '#F0FDF4' }}>✓</div><div className="ll-mock-t"><div className="ll-mock-name">Delivered — Order #1041</div><div className="ll-mock-sub">Confirmed by buyer · GHS 18 earned</div></div><span className="ll-badge ll-badge-green" style={{ fontSize: 10 }}>Paid</span></div>
                <div className="ll-mock-escrow" style={{ background: '#1E3A8A' }}><div className="ll-mec-lbl">Today's Earnings</div><div className="ll-mec-amt">GHS 124</div><div className="ll-mec-st">7 deliveries · 62km covered</div></div>
              </div>
            </div>
          )}

          {activeTab === 'company' && (
            <div className="ll-how-panel ll-active ll-reveal">
              <div className="ll-steps">
                <div className="ll-step"><div className="ll-step-n">01</div><div><h4>Build workforce lists</h4><p>Create lists by role — Waiters, Cleaners, Security. Add workers and invite them to the platform.</p></div></div>
                <div className="ll-step"><div className="ll-step-n">02</div><div><h4>Create and assign shifts</h4><p>Set location, start/end time, headcount. Recurring series, geo-fenced check-in, and auto-flag no-shows.</p></div></div>
                <div className="ll-step"><div className="ll-step-n">03</div><div><h4>Track attendance</h4><p>Workers check in with a code or GPS. No-shows flagged automatically after your configurable grace period.</p></div></div>
                <div className="ll-step"><div className="ll-step-n">04</div><div><h4>Post jobs & hire</h4><p>Post permanent or contract roles to our jobs board. Manage applications, shortlist, and hire.</p></div></div>
              </div>
              <div className="ll-mock-panel">
                <div className="ll-mock-card"><div className="ll-mock-ico" style={{ background: '#F5F3FF' }}>📅</div><div className="ll-mock-t"><div className="ll-mock-name">Evening Service — Sat 14 Dec</div><div className="ll-mock-sub">12 waiters · Labone · 6PM–11PM</div></div><span className="ll-badge ll-badge-green" style={{ fontSize: 10 }}>Confirmed</span></div>
                <div className="ll-mock-card"><div className="ll-mock-ico" style={{ background: '#F0FDF4' }}>👥</div><div className="ll-mock-t"><div className="ll-mock-name">Check-ins: 11/12</div><div className="ll-mock-sub">1 no-show flagged · Grace: 15min</div></div><span className="ll-badge ll-badge-gold" style={{ fontSize: 10 }}>Live</span></div>
                <div className="ll-mock-escrow" style={{ background: '#1E1B4B' }}><div className="ll-mec-lbl">This Month</div><div className="ll-mec-amt">48 shifts</div><div className="ll-mec-st">94% attendance · 6 open roles</div></div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* TRUST PILLARS */}
      <section className="ll-section">
        <div className="ll-wrap">
          <div className="ll-trust-grid ll-reveal">
            <div className="ll-trust-card">
              <div className="ll-trust-ico">🛡️</div>
              <div className="ll-trust-title">Verified providers, farmers & florists</div>
              <div className="ll-trust-desc">Bronze / Silver / Gold trust tiers. Ghana Card + selfie verification gives buyers real confidence before hiring.</div>
              <Link to="/trust/verification" className="ll-trust-link">Verification tiers <ArrowRight w={11} h={11} /></Link>
            </div>
            <div className="ll-trust-card">
              <div className="ll-trust-ico">🔒</div>
              <div className="ll-trust-title">Secure escrow payments</div>
              <div className="ll-trust-desc">Funds held until completion/delivery. Auto-release after 72h. Full dispute resolution if anything goes wrong.</div>
              <Link to="/trust/escrow" className="ll-trust-link">How escrow works <ArrowRight w={11} h={11} /></Link>
            </div>
            <div className="ll-trust-card">
              <div className="ll-trust-ico">⭐</div>
              <div className="ll-trust-title">Real reviews</div>
              <div className="ll-trust-desc">Reputation that can't be faked. Every review is tied to a real completed transaction — no anonymous ratings.</div>
              <Link to="/trust/reviews" className="ll-trust-link">How reviews work <ArrowRight w={11} h={11} /></Link>
            </div>
            <div className="ll-trust-card">
              <div className="ll-trust-ico">💬</div>
              <div className="ll-trust-title">Local support</div>
              <div className="ll-trust-desc">Help via WhatsApp and phone (coming next). Real humans who understand the Ghanaian market.</div>
              <Link to="/contact" className="ll-trust-link">Contact us <ArrowRight w={11} h={11} /></Link>
            </div>
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="ll-section" style={{ paddingTop: 0 }}>
        <div className="ll-wrap">
          <div className="ll-testi-wrap ll-reveal">
            <div className="ll-testi-label">Early users</div>
            <div className="ll-testi-grid">
              <div className="ll-testi-card"><div className="ll-testi-stars">★★★★★</div><div className="ll-testi-quote">"I hired a plumber and ordered vegetables in one place. No stress."</div><div className="ll-testi-author">— Early user, Accra</div></div>
              <div className="ll-testi-card"><div className="ll-testi-stars">★★★★★</div><div className="ll-testi-quote">"The verification badges make it easy to trust who I'm paying."</div><div className="ll-testi-author">— SME owner, Kumasi</div></div>
              <div className="ll-testi-card"><div className="ll-testi-stars">★★★★★</div><div className="ll-testi-quote">"Escrow is exactly what Ghana needs for work and deliveries."</div><div className="ll-testi-author">— Landlord, Tema</div></div>
            </div>
          </div>
        </div>
      </section>

      {/* EARN WITH LOCALLINK */}
      <section className="ll-section ll-earn-sec">
        <div className="ll-wrap">
          <div className="ll-earn-inner ll-reveal">
            <div>
              <div className="ll-earn-eyebrow">For providers</div>
              <h2 className="ll-earn-title">Your skills.<br />Your hours.<br />Your money.</h2>
              <p className="ll-earn-sub">Thousands of buyers across Ghana are looking for exactly what you offer. Join as a verified provider and start earning — on your schedule, in your area.</p>
              <div className="ll-earn-roles">
                <Link to="/register?role=artisan" className="ll-earn-role">
                  <div className="ll-earn-role-ico">🔧</div>
                  <div><div className="ll-earn-role-name">Artisan / Skilled Professional</div><div className="ll-earn-role-sub">Electrician, plumber, cleaner, caterer, builder…</div></div>
                  <span className="ll-earn-arrow"><ArrowRight w={14} h={14} /></span>
                </Link>
                <Link to="/register?role=farmer" className="ll-earn-role">
                  <div className="ll-earn-role-ico">🌾</div>
                  <div><div className="ll-earn-role-name">Farmer / Florist</div><div className="ll-earn-role-sub">Sell produce and flowers directly to local buyers</div></div>
                  <span className="ll-earn-arrow"><ArrowRight w={14} h={14} /></span>
                </Link>
                <Link to="/register?role=driver" className="ll-earn-role">
                  <div className="ll-earn-role-ico">🚗</div>
                  <div><div className="ll-earn-role-name">Delivery Driver</div><div className="ll-earn-role-sub">Claim deliveries near you, earn per trip</div></div>
                  <span className="ll-earn-arrow"><ArrowRight w={14} h={14} /></span>
                </Link>
              </div>
              <Link to="/register" className="ll-btn ll-btn-green ll-btn-lg" style={{ marginTop: 24 }}>Start earning today <ArrowRight w={14} h={14} /></Link>
            </div>
            <div className="ll-ew">
              <div className="ll-ew-hdr"><span className="ll-ew-lbl">Your Earnings</span><span className="ll-ew-period">This month</span></div>
              <div className="ll-ew-amount">GHS 4,820</div>
              <div className="ll-ew-change">↑ 31% from last month</div>
              <div className="ll-ew-bars">
                {[42, 58, 36, 70, 52, 84, 66, 100].map((h, i) => (
                  <div key={i} className="ll-ew-bar"><div className="ll-ew-fill" style={{ height: `${h}%` }} /></div>
                ))}
              </div>
              <div className="ll-ew-jobs">
                <div className="ll-ew-job"><span className="ll-ew-job-n">🏠 Deep clean — East Legon</span><span className="ll-ew-job-a">GHS 280</span></div>
                <div className="ll-ew-job"><span className="ll-ew-job-n">⚡ Electrical repair — Airport Hills</span><span className="ll-ew-job-a">GHS 450</span></div>
                <div className="ll-ew-job"><span className="ll-ew-job-n">🍽️ Catering — Cantonments</span><span className="ll-ew-job-a">GHS 1,200</span></div>
                <div className="ll-ew-job"><span className="ll-ew-job-n">🔧 Plumbing — Tema</span><span className="ll-ew-job-a">GHS 380</span></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* B2B STRIP */}
      <div className="ll-b2b-strip">
        <div className="ll-wrap">
          <div className="ll-b2b-inner ll-reveal">
            <div>
              <div className="ll-b2b-eyebrow">For businesses</div>
              <h2 className="ll-b2b-title">Run your workforce from one place.</h2>
              <p className="ll-b2b-sub">Post jobs, create shifts, track attendance, and manage your casual and permanent workforce — without the spreadsheets.</p>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <Link to="/corporate" className="ll-btn ll-btn-green ll-btn-md">See business features</Link>
                <Link to="/register?role=company" className="ll-btn ll-btn-outline ll-btn-md">Create company account</Link>
              </div>
            </div>
            <div className="ll-b2b-feats">
              <div className="ll-b2b-feat">✓ Geo-fenced check-in</div>
              <div className="ll-b2b-feat">✓ Recurring shifts</div>
              <div className="ll-b2b-feat">✓ Workforce lists</div>
              <div className="ll-b2b-feat">✓ Post to jobs board</div>
              <div className="ll-b2b-feat">✓ Attendance tracking</div>
              <div className="ll-b2b-feat">✓ No-show auto-flag</div>
            </div>
          </div>
        </div>
      </div>

      {/* OFFLINE */}
      <section className="ll-section" style={{ padding: '36px 0' }}>
        <div className="ll-wrap">
          <div className="ll-offline-card ll-reveal">
            <div>
              <div className="ll-offline-title">Offline-first</div>
              <div className="ll-offline-sub">No smartphone? No problem. Post jobs or orders via WhatsApp or call us (coming next).</div>
            </div>
            <div className="ll-offline-btns">
              <a href="https://wa.me/233000000000" className="ll-wa-btn" target="_blank" rel="noopener noreferrer">WhatsApp us</a>
              <Link to="/contact" className="ll-btn ll-btn-ghost ll-btn-md">Call support</Link>
            </div>
          </div>
        </div>
      </section>

      {/* COMING BANNER */}
      <div className="ll-coming-banner">
        <strong>Coming next:</strong> real wallet balances, escrow transactions, subscriptions, and offline channels (WhatsApp/SMS).
      </div>

      {/* FOOTER */}
      <footer className="ll-foot">
        <div className="ll-wrap">
          <div className="ll-foot-grid">
            <div>
              <div className="ll-foot-logo">
                <LogoIcon size={28} />
                <span className="ll-foot-logo-name">LocalLink</span>
              </div>
              <p className="ll-foot-tagline">The trusted operating system for local work & supply. Built for Ghana 🇬🇭</p>
            </div>
            <div>
              <div className="ll-foot-col-title">Company</div>
              <ul className="ll-foot-links"><li><Link to="/about">About</Link></li><li><Link to="/contact">Contact</Link></li><li><Link to="/careers">Careers</Link></li></ul>
            </div>
            <div>
              <div className="ll-foot-col-title">Trust</div>
              <ul className="ll-foot-links"><li><Link to="/trust/escrow">How escrow works</Link></li><li><Link to="/trust/verification">Verification tiers</Link></li><li><Link to="/trust/reviews">Reviews</Link></li></ul>
            </div>
            <div>
              <div className="ll-foot-col-title">Get started</div>
              <ul className="ll-foot-links"><li><Link to="/register?role=artisan">Become an artisan</Link></li><li><Link to="/register?role=farmer">Become a farmer or florist</Link></li><li><Link to="/register?role=driver">Become a driver</Link></li><li><Link to="/register?role=buyer">Post a job</Link></li></ul>
            </div>
            <div>
              <div className="ll-foot-col-title">Explore</div>
              <ul className="ll-foot-links"><li><Link to="/providers">Browse providers</Link></li><li><Link to="/marketplace">Marketplace</Link></li><li><Link to="/jobs">Jobs board</Link></li><li><Link to="/corporate">For business</Link></li><li><Link to="/news">News</Link></li></ul>
            </div>
          </div>
          <div className="ll-foot-bottom">
            <div className="ll-foot-copy">© 2025 LocalLink. All rights reserved.</div>
            <div className="ll-foot-build">LocalLink — Hire. Buy. Grow. Locally.</div>
          </div>
        </div>
      </footer>
    </div>
  )
}
