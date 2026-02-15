import { useState } from 'react'
import { Link } from 'react-router-dom'

function proxiedImage(url) {
  const u = String(url || '').trim()
  if (!u) return null
  if (u.startsWith('data:') || u.startsWith('/')) return u
  return `/api/news/image?src=${encodeURIComponent(u)}`
}

// Instagram-style advert card component
function AdvertCard({ advert }) {
  const [imageLoaded, setImageLoaded] = useState(false)

  return (
    <div className="group relative aspect-square overflow-hidden rounded-lg bg-white shadow-md transition-all duration-300 hover:shadow-xl">
      {/* Image with overlay gradient */}
      <div className="relative h-full w-full">
        <img
          src={proxiedImage(advert.image)}
          alt={advert.title}
          className={`h-full w-full object-cover transition-transform duration-500 group-hover:scale-110 ${
            imageLoaded ? 'opacity-100' : 'opacity-0'
          }`}
          onLoad={() => setImageLoaded(true)}
          onError={() => setImageLoaded(true)}
          loading="lazy"
          referrerPolicy="no-referrer"
        />
        {/* Gradient overlay for text readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
        
        {/* Loading placeholder */}
        {!imageLoaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-200">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-blue-600" />
          </div>
        )}

        {/* Content overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
          {/* Badge */}
          <div className="mb-2 inline-block rounded-full bg-blue-600 px-3 py-1 text-xs font-semibold uppercase tracking-wide">
            {advert.badge}
          </div>
          
          {/* Title */}
          <h3 className="mb-2 text-lg font-bold leading-tight drop-shadow-lg">
            {advert.title}
          </h3>
          
          {/* Description */}
          <p className="mb-3 line-clamp-2 text-sm leading-relaxed text-white/95 drop-shadow-md">
            {advert.description}
          </p>
          
          {/* CTA Button */}
          <Link
            to={advert.ctaLink}
            className="inline-flex items-center gap-1 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-blue-600 shadow-lg transition-all hover:bg-blue-50 hover:scale-105"
          >
            {advert.ctaText}
            <span className="text-base">→</span>
          </Link>
        </div>
      </div>

      {/* Decorative corner accent */}
      <div className="absolute top-0 right-0 h-16 w-16 bg-gradient-to-br from-blue-500/20 to-transparent" />
    </div>
  )
}

// Main page component
export function OnboardingAdverts() {
  // 20 Instagram-style adverts: mix of artisan and buyer focused
  const adverts = [
    // ARTISAN ADVERTS (10)
    {
      badge: 'For Artisans',
      title: 'Get Paid Faster',
      description: 'Escrow protection means you get paid when work is done. No more chasing payments.',
      image: 'https://images.pexels.com/photos/7567443/pexels-photo-7567443.jpeg?auto=compress&cs=tinysrgb&w=1600',
      ctaText: 'Join as Artisan',
      ctaLink: '/register?role=artisan',
      target: 'artisan',
    },
    {
      badge: 'For Artisans',
      title: 'Build Your Reputation',
      description: 'Verified reviews from real customers. Showcase your skills and get more jobs.',
      image: 'https://images.pexels.com/photos/5669604/pexels-photo-5669604.jpeg?auto=compress&cs=tinysrgb&w=1600',
      ctaText: 'Create Profile',
      ctaLink: '/register?role=artisan',
      target: 'artisan',
    },
    {
      badge: 'For Artisans',
      title: 'More Jobs, Less Hassle',
      description: 'Get matched with customers in your area. Set your rates and work on your terms.',
      image: 'https://images.pexels.com/photos/8961065/pexels-photo-8961065.jpeg?auto=compress&cs=tinysrgb&w=1600',
      ctaText: 'Start Earning',
      ctaLink: '/register?role=artisan',
      target: 'artisan',
    },
    {
      badge: 'For Artisans',
      title: 'Trust & Safety First',
      description: 'All payments held in escrow. Dispute protection for both you and your customers.',
      image: 'https://images.pexels.com/photos/3585088/pexels-photo-3585088.jpeg?auto=compress&cs=tinysrgb&w=1600',
      ctaText: 'Learn More',
      ctaLink: '/register?role=artisan',
      target: 'artisan',
    },
    {
      badge: 'For Artisans',
      title: 'Work When You Want',
      description: 'Accept quotes that fit your schedule. No pressure, just quality work.',
      image: 'https://images.pexels.com/photos/5668886/pexels-photo-5668886.jpeg?auto=compress&cs=tinysrgb&w=1600',
      ctaText: 'Get Started',
      ctaLink: '/register?role=artisan',
      target: 'artisan',
    },
    {
      badge: 'For Artisans',
      title: 'Showcase Your Skills',
      description: 'Upload photos of your work. Let customers see what you can do before they hire.',
      image: 'https://images.pexels.com/photos/8488029/pexels-photo-8488029.jpeg?auto=compress&cs=tinysrgb&w=1600',
      ctaText: 'Join Now',
      ctaLink: '/register?role=artisan',
      target: 'artisan',
    },
    {
      badge: 'For Artisans',
      title: 'Fair Pricing, Fair Pay',
      description: 'Set your own rates. No hidden fees. You keep what you earn (minus small platform fee).',
      image: 'https://images.pexels.com/photos/8961133/pexels-photo-8961133.jpeg?auto=compress&cs=tinysrgb&w=1600',
      ctaText: 'Sign Up Free',
      ctaLink: '/register?role=artisan',
      target: 'artisan',
    },
    {
      badge: 'For Artisans',
      title: 'Grow Your Business',
      description: 'Connect with customers who need your skills. Build a steady stream of work.',
      image: 'https://images.pexels.com/photos/14367421/pexels-photo-14367421.jpeg?auto=compress&cs=tinysrgb&w=1600',
      ctaText: 'Start Today',
      ctaLink: '/register?role=artisan',
      target: 'artisan',
    },
    {
      badge: 'For Artisans',
      title: 'Verified Professionals',
      description: 'Get verified and stand out. Customers trust verified artisans more.',
      image: 'https://images.pexels.com/photos/8487400/pexels-photo-8487400.jpeg?auto=compress&cs=tinysrgb&w=1600',
      ctaText: 'Get Verified',
      ctaLink: '/register?role=artisan',
      target: 'artisan',
    },
    {
      badge: 'For Artisans',
      title: 'Your Success, Our Mission',
      description: 'We built LocalLink to help skilled workers thrive. Join thousands earning more.',
      image: 'https://images.pexels.com/photos/5669603/pexels-photo-5669603.jpeg?auto=compress&cs=tinysrgb&w=1600',
      ctaText: 'Join Community',
      ctaLink: '/register?role=artisan',
      target: 'artisan',
    },
    
    // BUYER ADVERTS (10)
    {
      badge: 'For Buyers',
      title: 'Find Trusted Artisans',
      description: 'Browse verified professionals. Read reviews. Compare quotes. Hire with confidence.',
      image: 'https://images.pexels.com/photos/8961127/pexels-photo-8961127.jpeg?auto=compress&cs=tinysrgb&w=1600',
      ctaText: 'Find Artisans',
      ctaLink: '/register?role=buyer',
      target: 'buyer',
    },
    {
      badge: 'For Buyers',
      title: 'Get Multiple Quotes',
      description: 'Post your job once. Get quotes from multiple artisans. Choose the best fit.',
      image: 'https://images.pexels.com/photos/8961065/pexels-photo-8961065.jpeg?auto=compress&cs=tinysrgb&w=1600',
      ctaText: 'Post a Job',
      ctaLink: '/register?role=buyer',
      target: 'buyer',
    },
    {
      badge: 'For Buyers',
      title: 'Protected Payments',
      description: 'Your money is held safely in escrow. Only released when work is completed to your satisfaction.',
      image: 'https://images.pexels.com/photos/7567443/pexels-photo-7567443.jpeg?auto=compress&cs=tinysrgb&w=1600',
      ctaText: 'Learn How',
      ctaLink: '/register?role=buyer',
      target: 'buyer',
    },
    {
      badge: 'For Buyers',
      title: 'Quality Guaranteed',
      description: 'All artisans are verified. Reviews from real customers. Dispute protection included.',
      image: 'https://images.pexels.com/photos/5669604/pexels-photo-5669604.jpeg?auto=compress&cs=tinysrgb&w=1600',
      ctaText: 'Browse Now',
      ctaLink: '/register?role=buyer',
      target: 'buyer',
    },
    {
      badge: 'For Buyers',
      title: 'Fast & Easy',
      description: 'Post a job in minutes. Get quotes within hours. Start work the same day.',
      image: 'https://images.pexels.com/photos/19926733/pexels-photo-19926733.jpeg?auto=compress&cs=tinysrgb&w=1600',
      ctaText: 'Get Started',
      ctaLink: '/register?role=buyer',
      target: 'buyer',
    },
    {
      badge: 'For Buyers',
      title: 'Local Professionals',
      description: 'Find artisans in your area. Support local businesses. Build your community.',
      image: 'https://images.pexels.com/photos/5668886/pexels-photo-5668886.jpeg?auto=compress&cs=tinysrgb&w=1600',
      ctaText: 'Search Local',
      ctaLink: '/register?role=buyer',
      target: 'buyer',
    },
    {
      badge: 'For Buyers',
      title: 'No Hidden Fees',
      description: 'Transparent pricing. See quotes upfront. Pay only when you accept. Simple.',
      image: 'https://images.pexels.com/photos/3585088/pexels-photo-3585088.jpeg?auto=compress&cs=tinysrgb&w=1600',
      ctaText: 'See Pricing',
      ctaLink: '/register?role=buyer',
      target: 'buyer',
    },
    {
      badge: 'For Buyers',
      title: 'Dispute Resolution',
      description: 'If something goes wrong, we help. Fair disputes. Fast resolution. You\'re protected.',
      image: 'https://images.pexels.com/photos/5910703/pexels-photo-5910703.jpeg?auto=compress&cs=tinysrgb&w=1600',
      ctaText: 'Join Free',
      ctaLink: '/register?role=buyer',
      target: 'buyer',
    },
    {
      badge: 'For Buyers',
      title: 'From Plumbing to Painting',
      description: 'Electricians, carpenters, plumbers, painters, and more. All in one place.',
      image: 'https://images.pexels.com/photos/8488029/pexels-photo-8488029.jpeg?auto=compress&cs=tinysrgb&w=1600',
      ctaText: 'Explore Skills',
      ctaLink: '/register?role=buyer',
      target: 'buyer',
    },
    {
      badge: 'For Buyers',
      title: 'Your Home, Our Priority',
      description: 'Connect with skilled professionals who care about quality. Get the job done right.',
      image: 'https://images.pexels.com/photos/4971945/pexels-photo-4971945.jpeg?auto=compress&cs=tinysrgb&w=1600',
      ctaText: 'Start Hiring',
      ctaLink: '/register?role=buyer',
      target: 'buyer',
    },
  ]

  const [filter, setFilter] = useState('all') // 'all', 'artisan', 'buyer'

  const filteredAdverts = filter === 'all' 
    ? adverts 
    : adverts.filter(a => a.target === filter)

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/80 backdrop-blur-md">
        <div className="mx-auto max-w-7xl px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">LocalLink</h1>
              <p className="text-sm text-slate-600">Connect. Trust. Grow.</p>
            </div>
            <div className="flex gap-3">
              <Link
                to="/register"
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-blue-700"
              >
                Get Started
              </Link>
              <Link
                to="/login"
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition-all hover:bg-slate-50"
              >
                Sign In
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="mx-auto max-w-7xl px-4 py-12 text-center">
        <h2 className="mb-4 text-5xl font-bold text-slate-900">
          Ghana's Trusted Marketplace
        </h2>
        <p className="mx-auto max-w-2xl text-xl text-slate-600">
          Connect skilled artisans with customers who need quality work. Protected payments. Verified professionals. Real reviews.
        </p>
      </section>

      {/* Filter Tabs */}
      <section className="mx-auto max-w-7xl px-4 pb-6">
        <div className="flex justify-center gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`rounded-full px-6 py-2 text-sm font-semibold transition-all ${
              filter === 'all'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            All Adverts
          </button>
          <button
            onClick={() => setFilter('artisan')}
            className={`rounded-full px-6 py-2 text-sm font-semibold transition-all ${
              filter === 'artisan'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            For Artisans
          </button>
          <button
            onClick={() => setFilter('buyer')}
            className={`rounded-full px-6 py-2 text-sm font-semibold transition-all ${
              filter === 'buyer'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            For Buyers
          </button>
        </div>
      </section>

      {/* Instagram-style Grid */}
      <section className="mx-auto max-w-7xl px-4 pb-16">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {filteredAdverts.map((advert, index) => (
            <AdvertCard key={index} advert={advert} index={index} />
          ))}
        </div>
      </section>

      {/* Footer CTA */}
      <section className="border-t border-slate-200 bg-white py-12">
        <div className="mx-auto max-w-7xl px-4 text-center">
          <h3 className="mb-4 text-3xl font-bold text-slate-900">Ready to Get Started?</h3>
          <p className="mb-6 text-lg text-slate-600">
            Join thousands of artisans and customers building trust in Ghana.
          </p>
          <div className="flex justify-center gap-4">
            <Link
              to="/register?role=artisan"
              className="rounded-lg bg-blue-600 px-8 py-3 text-lg font-semibold text-white transition-all hover:bg-blue-700 hover:shadow-lg"
            >
              Join as Artisan
            </Link>
            <Link
              to="/register?role=buyer"
              className="rounded-lg border-2 border-blue-600 px-8 py-3 text-lg font-semibold text-blue-600 transition-all hover:bg-blue-50"
            >
              Join as Buyer
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}

