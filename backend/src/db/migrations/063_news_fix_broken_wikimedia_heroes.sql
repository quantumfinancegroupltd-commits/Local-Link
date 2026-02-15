-- Fix broken Wikimedia thumbnail hero images (several of the seeded URLs 404).
-- Replace with stable, royalty-free Pexels images (served via /api/news/image proxy).
-- Idempotent: only updates specific slugs.

update news_posts
set
  hero_image_url = 'https://images.pexels.com/photos/1422408/pexels-photo-1422408.jpeg?auto=compress&cs=tinysrgb&w=1600',
  hero_image_alt = 'City street traffic',
  hero_image_credit = 'Image: Pexels (free license).'
where deleted_at is null
  and slug = 'product-update-services-menu-navigation';

update news_posts
set
  hero_image_url = 'https://images.pexels.com/photos/196652/pexels-photo-196652.jpeg?auto=compress&cs=tinysrgb&w=1600',
  hero_image_alt = 'Shipping containers at a port',
  hero_image_credit = 'Image: Pexels (free license).'
where deleted_at is null
  and slug = 'how-to-post-a-job-that-gets-right-applicants-ghana';

update news_posts
set
  hero_image_url = 'https://images.pexels.com/photos/416405/pexels-photo-416405.jpeg?auto=compress&cs=tinysrgb&w=1600',
  hero_image_alt = 'Construction workers at a job site',
  hero_image_credit = 'Image: Pexels (free license).'
where deleted_at is null
  and slug = 'for-workers-avoid-no-show-penalties-build-trust';

update news_posts
set
  hero_image_url = 'https://images.pexels.com/photos/17302468/pexels-photo-17302468.jpeg?auto=compress&cs=tinysrgb&w=1600',
  hero_image_alt = 'Fresh produce at a market stall',
  hero_image_credit = 'Image: Pexels (free license).'
where deleted_at is null
  and slug = 'farmers-sellers-7-ways-increase-repeat-buyers';

