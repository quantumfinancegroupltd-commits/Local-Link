-- More starter content for News (idempotent).
-- Inserts each post only if its slug does not already exist.

do $$
begin
  -- Product updates / announcements
  insert into news_posts (title, slug, body, status, published_at, category, summary, hero_image_url, hero_image_alt, hero_image_credit)
  select
    'Product update: Services menu, clearer navigation, fewer clashes',
    'product-update-services-menu-navigation',
    E'We’ve improved the top navigation to make LocalLink easier to use on all screen sizes.\n\nWhat changed:\n- “Today” now shows first for buyers\n- “Services” groups Providers, Produce, and Employers\n- Cleaner layout on smaller screens (no overlap)\n\nWhy this matters:\n- Faster access to what users actually want\n- Less confusion for first-time users\n- Better performance and fewer mis-clicks on mobile\n\nIf you have a navigation suggestion, send it through Support — we’ll keep improving.',
    'published',
    now() - interval '3 days',
    'Product updates',
    'Navigation improvements: Today first, Services dropdown, and better behavior on smaller screens.',
    'https://images.pexels.com/photos/8961133/pexels-photo-8961133.jpeg?auto=compress&cs=tinysrgb&w=1600',
    'Team reviewing a blueprint on site',
    'Image: Pexels (free license).'
  where not exists (select 1 from news_posts where slug = 'product-update-services-menu-navigation' and deleted_at is null);

  insert into news_posts (title, slug, body, status, published_at, category, summary, hero_image_url, hero_image_alt, hero_image_credit)
  select
    'How to post a job that gets the right applicants (Ghana SME edition)',
    'how-to-post-a-job-that-gets-right-applicants-ghana',
    E'If you’ve ever posted a role and got “wrong” applicants, it’s usually because the job post is missing the 5 things people need to self-select.\n\nInclude these:\n\n1) Role in one sentence\nExample: “Need a warehouse packer for morning shifts, 5 days/week.”\n\n2) Location + start date\nBe specific: “Tema, Comm. 12, start Monday.”\n\n3) Pay range (even if flexible)\nA range gets better applicants than “negotiable”.\n\n4) What success looks like\nExample: “Pack 200 parcels/day, low error rate, on-time attendance.”\n\n5) How you’ll confirm attendance\nUse LocalLink shifts + check-in (code/geo) so everyone is clear.\n\nBonus:\n- Keep requirements realistic\n- Avoid long essays\n- Reply fast in the first 24 hours\n\nWe’ll keep publishing templates you can copy/paste for common roles.',
    'published',
    now() - interval '2 days',
    'Guides',
    'A practical checklist for Ghanaian SMEs posting roles (warehouse, logistics, trades) to get better applicants.',
    'https://images.pexels.com/photos/8961127/pexels-photo-8961127.jpeg?auto=compress&cs=tinysrgb&w=1600',
    'Two people discussing plans at a worksite',
    'Image: Pexels (free license).'
  where not exists (select 1 from news_posts where slug = 'how-to-post-a-job-that-gets-right-applicants-ghana' and deleted_at is null);

  -- Provider / worker education
  insert into news_posts (title, slug, body, status, published_at, category, summary, hero_image_url, hero_image_alt, hero_image_credit)
  select
    'For workers: how to avoid no-show penalties and build trust fast',
    'for-workers-avoid-no-show-penalties-build-trust',
    E'If you want more consistent work on LocalLink, reliability matters more than anything else.\n\nDo these 6 things:\n\n1) Accept only what you can do\nIf you’re not sure, decline early.\n\n2) Communicate early\nIf you’ll be late, say it quickly in chat.\n\n3) Use check-in/out\nShifts: check in when you arrive and check out when done.\n\n4) Avoid off-platform payments\nKeep everything in-app to protect yourself.\n\n5) Finish cleanly\nUpload proof if requested and complete the flow.\n\n6) Ask for reviews and endorsements\nAfter completed work, request a review and (where relevant) skill endorsements.\n\nThis is how your professional identity compounds over time.',
    'published',
    now() - interval '2 days',
    'Guides',
    'Practical steps workers can follow to reduce missed jobs and build a stronger reputation on LocalLink.',
    'https://images.pexels.com/photos/14367425/pexels-photo-14367425.jpeg?auto=compress&cs=tinysrgb&w=1600',
    'Construction workers in hard hats at a building site',
    'Image: Pexels (free license).'
  where not exists (select 1 from news_posts where slug = 'for-workers-avoid-no-show-penalties-build-trust' and deleted_at is null);

  -- Marketplace education
  insert into news_posts (title, slug, body, status, published_at, category, summary, hero_image_url, hero_image_alt, hero_image_credit)
  select
    'Farmers and sellers: 7 ways to increase repeat buyers',
    'farmers-sellers-7-ways-increase-repeat-buyers',
    E'Repeat buyers are the difference between “random orders” and stable income.\n\nHere are 7 things that help immediately:\n\n1) Honest stock\nIf you’re out, update it.\n\n2) Clear sizes\nExample: “Plantain (medium)”, “Tomatoes (1kg bag)”.\n\n3) Photos that match reality\nAvoid old or borrowed photos.\n\n4) Fast confirmation\nReply quickly after an order comes in.\n\n5) Packaging matters\nClean, consistent packaging reduces complaints.\n\n6) Delivery expectations\nBe honest about time windows.\n\n7) Handle mistakes professionally\nIf something is missing, offer a replacement or partial refund quickly.\n\nIf you do this consistently, you’ll build a reputation that competitors cannot copy.',
    'published',
    now() - interval '1 days',
    'Marketplace',
    'Simple, Ghana-realistic habits for farmers and sellers to earn repeat customers.',
    'https://images.pexels.com/photos/9811486/pexels-photo-9811486.jpeg?auto=compress&cs=tinysrgb&w=1600',
    'Person selecting fruit at a market',
    'Image: Pexels (free license).'
  where not exists (select 1 from news_posts where slug = 'farmers-sellers-7-ways-increase-repeat-buyers' and deleted_at is null);

end $$;

