-- Ensure hero images are unique across the full News set (20 posts).
-- Idempotent: updates by slug.
-- This also removes dependency on any broken Wikimedia hero URLs.

-- Product updates & features (4)
update news_posts set
  hero_image_url = 'https://images.pexels.com/photos/5668886/pexels-photo-5668886.jpeg?auto=compress&cs=tinysrgb&w=1600',
  hero_image_alt = 'Professional working on a laptop',
  hero_image_credit = 'Image: Pexels (free license).'
where deleted_at is null and slug = 'welcome-to-locallink-news';

update news_posts set
  hero_image_url = 'https://images.pexels.com/photos/1267338/pexels-photo-1267338.jpeg?auto=compress&cs=tinysrgb&w=1600',
  hero_image_alt = 'Warehouse worker using a forklift',
  hero_image_credit = 'Image: Pexels (free license).'
where deleted_at is null and slug = 'locallink-employers-worker-pools-shifts-attendance-v1';

update news_posts set
  hero_image_url = 'https://images.pexels.com/photos/8961133/pexels-photo-8961133.jpeg?auto=compress&cs=tinysrgb&w=1600',
  hero_image_alt = 'Team reviewing a blueprint on site',
  hero_image_credit = 'Image: Pexels (free license).'
where deleted_at is null and slug = 'product-update-services-menu-navigation';

update news_posts set
  hero_image_url = 'https://images.pexels.com/photos/14367421/pexels-photo-14367421.jpeg?auto=compress&cs=tinysrgb&w=1600',
  hero_image_alt = 'Construction workers collaborating on site',
  hero_image_credit = 'Image: Pexels (free license).'
where deleted_at is null and slug = 'locallink-product-updates-reliability-no-shows-accountability';

-- Africa economics (5)
update news_posts set
  hero_image_url = 'https://images.pexels.com/photos/9879938/pexels-photo-9879938.jpeg?auto=compress&cs=tinysrgb&w=1600',
  hero_image_alt = 'Professional at work',
  hero_image_credit = 'Image: Pexels (free license).'
where deleted_at is null and slug = 'ghana-macro-reset-hard-work-after-the-headline';

update news_posts set
  hero_image_url = 'https://images.pexels.com/photos/19926733/pexels-photo-19926733.jpeg?auto=compress&cs=tinysrgb&w=1600',
  hero_image_alt = 'Worker near stacked shipping containers',
  hero_image_credit = 'Image: Pexels (free license).'
where deleted_at is null and slug = 'ecowas-trade-underbuilt-infrastructure-economics-of-moving-things';

update news_posts set
  hero_image_url = 'https://images.pexels.com/photos/4792521/pexels-photo-4792521.jpeg?auto=compress&cs=tinysrgb&w=1600',
  hero_image_alt = 'Worker fixing electrical wiring',
  hero_image_credit = 'Image: Pexels (free license).'
where deleted_at is null and slug = 'ghana-commodities-triangle-cocoa-gold-oil-growth-trap';

update news_posts set
  hero_image_url = 'https://images.pexels.com/photos/7567536/pexels-photo-7567536.jpeg?auto=compress&cs=tinysrgb&w=1600',
  hero_image_alt = 'Phone showing financial chart',
  hero_image_credit = 'Image: Pexels (free license).'
where deleted_at is null and slug = 'ecowas-eco-currency-politics-harder-than-economics';

update news_posts set
  hero_image_url = 'https://images.pexels.com/photos/8853502/pexels-photo-8853502.jpeg?auto=compress&cs=tinysrgb&w=1600',
  hero_image_alt = 'Technician working on solar panels',
  hero_image_credit = 'Image: Pexels (free license).'
where deleted_at is null and slug = 'power-prices-productivity-energy-ghana-underrated-variable';

-- Articles (11)
update news_posts set
  hero_image_url = 'https://images.pexels.com/photos/3585088/pexels-photo-3585088.jpeg?auto=compress&cs=tinysrgb&w=1600',
  hero_image_alt = 'Hands using a smartphone',
  hero_image_credit = 'Image: Pexels (free license).'
where deleted_at is null and slug = 'hiring-safely-in-ghana-10-checks';

update news_posts set
  hero_image_url = 'https://images.pexels.com/photos/7567443/pexels-photo-7567443.jpeg?auto=compress&cs=tinysrgb&w=1600',
  hero_image_alt = 'Hands holding a smartphone beside a laptop',
  hero_image_credit = 'Image: Pexels (free license).'
where deleted_at is null and slug = 'why-escrow-matters-safer-payments';

update news_posts set
  hero_image_url = 'https://images.pexels.com/photos/17302468/pexels-photo-17302468.jpeg?auto=compress&cs=tinysrgb&w=1600',
  hero_image_alt = 'Fresh fruits and vegetables at a market',
  hero_image_credit = 'Image: Pexels (free license).'
where deleted_at is null and slug = 'buying-fresh-produce-online-tips';

update news_posts set
  hero_image_url = 'https://images.pexels.com/photos/8961127/pexels-photo-8961127.jpeg?auto=compress&cs=tinysrgb&w=1600',
  hero_image_alt = 'Two people discussing plans at a worksite',
  hero_image_credit = 'Image: Pexels (free license).'
where deleted_at is null and slug = 'how-to-post-a-job-that-gets-right-applicants-ghana';

update news_posts set
  hero_image_url = 'https://images.pexels.com/photos/14367425/pexels-photo-14367425.jpeg?auto=compress&cs=tinysrgb&w=1600',
  hero_image_alt = 'Construction workers in hard hats at a building site',
  hero_image_credit = 'Image: Pexels (free license).'
where deleted_at is null and slug = 'for-workers-avoid-no-show-penalties-build-trust';

update news_posts set
  hero_image_url = 'https://images.pexels.com/photos/9811486/pexels-photo-9811486.jpeg?auto=compress&cs=tinysrgb&w=1600',
  hero_image_alt = 'Person selecting fruit at a market',
  hero_image_credit = 'Image: Pexels (free license).'
where deleted_at is null and slug = 'farmers-sellers-7-ways-increase-repeat-buyers';

update news_posts set
  hero_image_url = 'https://images.pexels.com/photos/20500461/pexels-photo-20500461.jpeg?auto=compress&cs=tinysrgb&w=1600',
  hero_image_alt = 'Skilled worker at work',
  hero_image_credit = 'Image: Pexels (free license).'
where deleted_at is null and slug = 'how-digital-labour-platforms-reshape-work-in-ghana';

update news_posts set
  hero_image_url = 'https://images.pexels.com/photos/4971945/pexels-photo-4971945.jpeg?auto=compress&cs=tinysrgb&w=1600',
  hero_image_alt = 'Person using a phone while shopping',
  hero_image_credit = 'Image: Pexels (free license).'
where deleted_at is null and slug = 'from-whatsapp-groups-to-verified-digital-workplaces-ghana';

update news_posts set
  hero_image_url = 'https://images.pexels.com/photos/7567221/pexels-photo-7567221.jpeg?auto=compress&cs=tinysrgb&w=1600',
  hero_image_alt = 'Business analysis papers and laptop on a desk',
  hero_image_credit = 'Image: Pexels (free license).'
where deleted_at is null and slug = 'why-escrow-and-dispute-systems-matter-ghana-gig-economy';

update news_posts set
  hero_image_url = 'https://images.pexels.com/photos/8488029/pexels-photo-8488029.jpeg?auto=compress&cs=tinysrgb&w=1600',
  hero_image_alt = 'Worker using hand tools',
  hero_image_credit = 'Image: Pexels (free license).'
where deleted_at is null and slug = 'how-skills-verification-unlocks-opportunity-ghana';

update news_posts set
  hero_image_url = 'https://images.pexels.com/photos/8961065/pexels-photo-8961065.jpeg?auto=compress&cs=tinysrgb&w=1600',
  hero_image_alt = 'Engineers in hard hats discussing a project',
  hero_image_credit = 'Image: Pexels (free license).'
where deleted_at is null and slug = 'what-digital-work-marketplaces-mean-for-ghana-future';

