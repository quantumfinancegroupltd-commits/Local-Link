# Onboarding Adverts Page

## Overview
Instagram-style marketing page with 20 professional adverts designed to onboard both skilled laborers (artisans) and buyers.

## Access
- **URL**: `http://localhost:5173/onboarding` or `http://localhost:5173/adverts`
- **Port**: 5173 (configured in `frontend/vite.config.js`)

## Features
- ✅ 20 Instagram-style square cards
- ✅ 10 adverts targeting artisans
- ✅ 10 adverts targeting buyers
- ✅ Filter tabs (All / For Artisans / For Buyers)
- ✅ Royalty-free images from Unsplash
- ✅ Hover effects and smooth animations
- ✅ Responsive grid layout (1-5 columns based on screen size)
- ✅ Professional gradient overlays for text readability
- ✅ Direct CTAs linking to registration with role pre-selection

## Design Highlights
- **Instagram-style**: Square aspect ratio cards with image + text overlay
- **Gradient overlays**: Black gradient from bottom ensures text is always readable
- **Hover effects**: Images scale on hover, cards lift with shadow
- **Badge system**: Color-coded badges ("For Artisans" / "For Buyers")
- **Professional imagery**: All images from Unsplash (royalty-free)

## Advert Themes

### Artisan Adverts (10)
1. Get Paid Faster
2. Build Your Reputation
3. More Jobs, Less Hassle
4. Trust & Safety First
5. Work When You Want
6. Showcase Your Skills
7. Fair Pricing, Fair Pay
8. Grow Your Business
9. Verified Professionals
10. Your Success, Our Mission

### Buyer Adverts (10)
1. Find Trusted Artisans
2. Get Multiple Quotes
3. Protected Payments
4. Quality Guaranteed
5. Fast & Easy
6. Local Professionals
7. No Hidden Fees
8. Dispute Resolution
9. From Plumbing to Painting
10. Your Home, Our Priority

## Technical Details
- **Component**: `frontend/src/pages/onboarding/OnboardingAdverts.jsx`
- **Route**: `/onboarding` and `/adverts` (both work)
- **Styling**: Tailwind CSS with custom utilities
- **Images**: Unsplash CDN (optimized with `w=800&h=800&fit=crop&q=80`)

## Running Locally
```bash
cd frontend
npm run dev
# Server starts on http://localhost:5173
```

## Next Steps
- [ ] Add analytics tracking to CTA clicks
- [ ] A/B test different copy variations
- [ ] Add video adverts (optional)
- [ ] Integrate with actual registration flow
- [ ] Add social sharing buttons

