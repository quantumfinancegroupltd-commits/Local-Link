-- Fix broken Wikimedia thumbnail hero images from the initial seed pack (migration 058).
-- Wikimedia thumb URLs in those seeds now 404; replace with stable, royalty-free Pexels images.
-- Idempotent: updates by slug.

update news_posts
set
  hero_image_url = 'https://images.pexels.com/photos/3184306/pexels-photo-3184306.jpeg?auto=compress&cs=tinysrgb&w=1600',
  hero_image_alt = 'Colleagues collaborating',
  hero_image_credit = 'Image: Pexels (free license).'
where deleted_at is null
  and slug = 'welcome-to-locallink-news';

update news_posts
set
  hero_image_url = 'https://images.pexels.com/photos/4481537/pexels-photo-4481537.jpeg?auto=compress&cs=tinysrgb&w=1600',
  hero_image_alt = 'Warehouse workers moving packages',
  hero_image_credit = 'Image: Pexels (free license).'
where deleted_at is null
  and slug = 'locallink-employers-worker-pools-shifts-attendance-v1';

update news_posts
set
  hero_image_url = 'https://images.pexels.com/photos/3184639/pexels-photo-3184639.jpeg?auto=compress&cs=tinysrgb&w=1600',
  hero_image_alt = 'Person using a phone outdoors',
  hero_image_credit = 'Image: Pexels (free license).'
where deleted_at is null
  and slug = 'hiring-safely-in-ghana-10-checks';

update news_posts
set
  hero_image_url = 'https://images.pexels.com/photos/4968638/pexels-photo-4968638.jpeg?auto=compress&cs=tinysrgb&w=1600',
  hero_image_alt = 'Mobile payments on a phone',
  hero_image_credit = 'Image: Pexels (free license).'
where deleted_at is null
  and slug = 'why-escrow-matters-safer-payments';

update news_posts
set
  hero_image_url = 'https://images.pexels.com/photos/17302468/pexels-photo-17302468.jpeg?auto=compress&cs=tinysrgb&w=1600',
  hero_image_alt = 'Fresh produce at a market stall',
  hero_image_credit = 'Image: Pexels (free license).'
where deleted_at is null
  and slug = 'buying-fresh-produce-online-tips';

update news_posts
set
  hero_image_url = 'https://images.pexels.com/photos/416405/pexels-photo-416405.jpeg?auto=compress&cs=tinysrgb&w=1600',
  hero_image_alt = 'Construction workers at a job site',
  hero_image_credit = 'Image: Pexels (free license).'
where deleted_at is null
  and slug = 'locallink-product-updates-reliability-no-shows-accountability';

