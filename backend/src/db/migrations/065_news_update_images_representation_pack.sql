-- Update seeded News hero images to a set that better matches LocalLink's audience.
-- Goal: mostly Black representation, with a small mix of other backgrounds.
-- Idempotent: updates by slug.

update news_posts
set
  hero_image_url = 'https://images.pexels.com/photos/5669604/pexels-photo-5669604.jpeg?auto=compress&cs=tinysrgb&w=1600',
  hero_image_alt = 'Businesswoman working at an office desk',
  hero_image_credit = 'Image: Pexels (free license).'
where deleted_at is null
  and slug = 'welcome-to-locallink-news';

update news_posts
set
  hero_image_url = 'https://images.pexels.com/photos/19926733/pexels-photo-19926733.jpeg?auto=compress&cs=tinysrgb&w=1600',
  hero_image_alt = 'Worker near stacked shipping containers in a warehouse',
  hero_image_credit = 'Image: Pexels (free license).'
where deleted_at is null
  and slug = 'locallink-employers-worker-pools-shifts-attendance-v1';

update news_posts
set
  hero_image_url = 'https://images.pexels.com/photos/4971945/pexels-photo-4971945.jpeg?auto=compress&cs=tinysrgb&w=1600',
  hero_image_alt = 'Person using a phone while shopping',
  hero_image_credit = 'Image: Pexels (free license).'
where deleted_at is null
  and slug = 'hiring-safely-in-ghana-10-checks';

update news_posts
set
  hero_image_url = 'https://images.pexels.com/photos/7567443/pexels-photo-7567443.jpeg?auto=compress&cs=tinysrgb&w=1600',
  hero_image_alt = 'Phone and laptop showing financial data',
  hero_image_credit = 'Image: Pexels (free license).'
where deleted_at is null
  and slug = 'why-escrow-matters-safer-payments';

update news_posts
set
  hero_image_url = 'https://images.pexels.com/photos/17302468/pexels-photo-17302468.jpeg?auto=compress&cs=tinysrgb&w=1600',
  hero_image_alt = 'Fresh produce displayed at a market',
  hero_image_credit = 'Image: Pexels (free license).'
where deleted_at is null
  and slug = 'buying-fresh-produce-online-tips';

update news_posts
set
  hero_image_url = 'https://images.pexels.com/photos/14367421/pexels-photo-14367421.jpeg?auto=compress&cs=tinysrgb&w=1600',
  hero_image_alt = 'Construction workers collaborating on site',
  hero_image_credit = 'Image: Pexels (free license).'
where deleted_at is null
  and slug = 'locallink-product-updates-reliability-no-shows-accountability';

-- News pack (059)
update news_posts
set
  hero_image_url = 'https://images.pexels.com/photos/8961133/pexels-photo-8961133.jpeg?auto=compress&cs=tinysrgb&w=1600',
  hero_image_alt = 'Team reviewing a blueprint on site',
  hero_image_credit = 'Image: Pexels (free license).'
where deleted_at is null
  and slug = 'product-update-services-menu-navigation';

update news_posts
set
  hero_image_url = 'https://images.pexels.com/photos/8961127/pexels-photo-8961127.jpeg?auto=compress&cs=tinysrgb&w=1600',
  hero_image_alt = 'Two people discussing plans at a worksite',
  hero_image_credit = 'Image: Pexels (free license).'
where deleted_at is null
  and slug = 'how-to-post-a-job-that-gets-right-applicants-ghana';

update news_posts
set
  hero_image_url = 'https://images.pexels.com/photos/14367421/pexels-photo-14367421.jpeg?auto=compress&cs=tinysrgb&w=1600',
  hero_image_alt = 'Construction workers collaborating on site',
  hero_image_credit = 'Image: Pexels (free license).'
where deleted_at is null
  and slug = 'for-workers-avoid-no-show-penalties-build-trust';

update news_posts
set
  hero_image_url = 'https://images.pexels.com/photos/4971945/pexels-photo-4971945.jpeg?auto=compress&cs=tinysrgb&w=1600',
  hero_image_alt = 'Person using a phone while shopping',
  hero_image_credit = 'Image: Pexels (free license).'
where deleted_at is null
  and slug = 'farmers-sellers-7-ways-increase-repeat-buyers';

-- Ghana series (062)
update news_posts
set
  hero_image_url = 'https://images.pexels.com/photos/5668886/pexels-photo-5668886.jpeg?auto=compress&cs=tinysrgb&w=1600',
  hero_image_alt = 'Professional working on a laptop',
  hero_image_credit = 'Image: Pexels (free license).'
where deleted_at is null
  and slug = 'how-digital-labour-platforms-reshape-work-in-ghana';

update news_posts
set
  hero_image_url = 'https://images.pexels.com/photos/4971945/pexels-photo-4971945.jpeg?auto=compress&cs=tinysrgb&w=1600',
  hero_image_alt = 'Person using a phone while shopping',
  hero_image_credit = 'Image: Pexels (free license).'
where deleted_at is null
  and slug = 'from-whatsapp-groups-to-verified-digital-workplaces-ghana';

update news_posts
set
  hero_image_url = 'https://images.pexels.com/photos/7567443/pexels-photo-7567443.jpeg?auto=compress&cs=tinysrgb&w=1600',
  hero_image_alt = 'Phone and laptop showing financial data',
  hero_image_credit = 'Image: Pexels (free license).'
where deleted_at is null
  and slug = 'why-escrow-and-dispute-systems-matter-ghana-gig-economy';

update news_posts
set
  hero_image_url = 'https://images.pexels.com/photos/8488029/pexels-photo-8488029.jpeg?auto=compress&cs=tinysrgb&w=1600',
  hero_image_alt = 'Skilled worker using hand tools',
  hero_image_credit = 'Image: Pexels (free license).'
where deleted_at is null
  and slug = 'how-skills-verification-unlocks-opportunity-ghana';

update news_posts
set
  hero_image_url = 'https://images.pexels.com/photos/8961065/pexels-photo-8961065.jpeg?auto=compress&cs=tinysrgb&w=1600',
  hero_image_alt = 'Team discussing plans on a worksite',
  hero_image_credit = 'Image: Pexels (free license).'
where deleted_at is null
  and slug = 'what-digital-work-marketplaces-mean-for-ghana-future';

