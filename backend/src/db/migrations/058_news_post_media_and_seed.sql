-- News post media fields + starter content pack.

alter table news_posts
  add column if not exists category text,
  add column if not exists summary text,
  add column if not exists hero_image_url text,
  add column if not exists hero_image_alt text,
  add column if not exists hero_image_credit text;

-- Seed a starter set of published posts if none exist.
-- Idempotent: only runs when table has zero rows.
do $$
begin
  if (select count(*) from news_posts where deleted_at is null) = 0 then
    insert into news_posts (title, slug, body, status, published_at, category, summary, hero_image_url, hero_image_alt, hero_image_credit)
    values
      (
        'Welcome to LocalLink News: what we’ll publish here',
        'welcome-to-locallink-news',
        E'LocalLink News is where we share:\n\n- Product updates (what’s new, what changed, and why)\n- Safety + scam prevention guidance for buyers and providers\n- Hiring and workforce tips for Ghanaian SMEs and employers\n- Market and farming tips that help you buy/sell smarter\n\nWhat you can expect:\n- Clear, practical updates (no hype)\n- Short “what changed” summaries\n- Links to the exact feature so you can try it immediately\n\nIf you ever spot an issue or have a request, send it via Support in the app. We read everything.',
        'published',
        now() - interval '12 days',
        'Announcements',
        'A quick introduction to what LocalLink News is for, and what we will publish here.',
        'https://images.pexels.com/photos/5668886/pexels-photo-5668886.jpeg?auto=compress&cs=tinysrgb&w=1600',
        'Professional working on a laptop',
        'Image: Pexels (free license).'
      ),
      (
        'LocalLink Employers: worker pools, shifts, and attendance (v1)',
        'locallink-employers-worker-pools-shifts-attendance-v1',
        E'We’re rolling out LocalLink Employers (v1) to make hiring more predictable for companies and teams in Ghana.\n\nWhat’s included in v1:\n\n1) Worker pools (private)\n- Create private lists like “Preferred Cleaners” or “Event Crew”\n- Add workers from applicants or manually\n- Keep internal notes and ratings (only your company sees this)\n\n2) Shift scheduling (v1)\n- Create a shift block (title, role tag, headcount, location, start/end)\n- Invite workers from a selected pool\n- Workers can accept/decline from “My shifts”\n\n3) Attendance proof\n- Optional check-in code (simple QR/code entry)\n- Optional geo check-in (radius around your shift location)\n- Bulk actions for supervisors (set multiple statuses fast)\n- One-click “Fill remaining” + “Replace no-shows” from your pool\n\nWhy this matters:\n- Less chaos on the day\n- Better workforce memory over time\n- Fewer no-shows (and clearer consequences)\n\nWhere to find it:\nEmployers → Company dashboard → Scheduling',
        'published',
        now() - interval '10 days',
        'Product updates',
        'Employers can now manage private worker pools, schedule shifts, track attendance, and invite replacements quickly.',
        'https://images.pexels.com/photos/1267338/pexels-photo-1267338.jpeg?auto=compress&cs=tinysrgb&w=1600',
        'Warehouse worker using a forklift',
        'Image: Pexels (free license).'
      ),
      (
        'Hiring safely in Ghana: 10 checks that prevent most scams',
        'hiring-safely-in-ghana-10-checks',
        E'Trust is built with small habits.\n\nHere are 10 checks that prevent most marketplace scams and misunderstandings:\n\n1) Keep chat in-app\n- It protects your timeline and helps support if anything goes wrong.\n\n2) Don’t pay off-platform\n- Use escrow for paid work. It protects both sides.\n\n3) Confirm the job details (in writing)\n- Location, date/time window, scope, and price.\n\n4) Ask for proof of similar work\n- Photos, references, or verified work history.\n\n5) Agree the “arrival window”\n- Example: “Arrive between 9:00 and 9:30.”\n\n6) Avoid full upfront payments\n- For bigger jobs: use milestones.\n\n7) Use simple completion proof\n- Photo of completed work or a code confirmation.\n\n8) Watch for “pressure tactics”\n- Anyone rushing you to pay immediately is a red flag.\n\n9) Don’t share sensitive documents in chat\n- ID photos should only be uploaded in the verification flow.\n\n10) Leave a review after completion\n- It’s how good people rise and bad actors get filtered.\n\nIf you want, we’ll publish a short checklist you can share with your family and staff.',
        'published',
        now() - interval '9 days',
        'Guides',
        'A practical checklist that prevents the most common scams and misunderstandings when hiring for work in Ghana.',
        'https://images.pexels.com/photos/3585088/pexels-photo-3585088.jpeg?auto=compress&cs=tinysrgb&w=1600',
        'Hands using a smartphone',
        'Image: Pexels (free license).'
      ),
      (
        'Why escrow matters: safer payments for buyers and providers',
        'why-escrow-matters-safer-payments',
        E'In many Ghanaian transactions, the biggest risk is not “bad work” — it’s unclear payment expectations.\n\nEscrow makes the agreement simple:\n- Buyer funds the job/order into escrow\n- Work happens\n- Buyer confirms completion\n- Funds are released to the provider\n\nWhat escrow prevents:\n- Buyers paying upfront and getting ghosted\n- Providers doing work and chasing payment\n- Endless arguments about “what was agreed”\n\nWhat escrow does NOT do:\n- It does not replace communication.\n- It does not solve unclear scope.\n\nBest practice:\nFor bigger jobs, split into milestones.\nExample:\n- 30% after materials delivered\n- 40% after core work completed\n- 30% after final finishing\n\nThis reduces disputes and makes good providers more willing to take serious work.',
        'published',
        now() - interval '8 days',
        'Trust & payments',
        'A plain-language explanation of why escrow protects both sides in Ghana’s real-world hiring and delivery environment.',
        'https://images.pexels.com/photos/7567443/pexels-photo-7567443.jpeg?auto=compress&cs=tinysrgb&w=1600',
        'Hands holding a smartphone beside a laptop',
        'Image: Pexels (free license).'
      ),
      (
        'Buying fresh produce online: how to reduce waste and get better value',
        'buying-fresh-produce-online-tips',
        E'Buying produce online can be great — if you avoid two common problems:\n\n1) “Fresh” that isn’t actually fresh\n2) Unclear delivery expectations\n\nTips that help immediately:\n- Prefer sellers with consistent delivery history\n- Ask for a photo update on the day (for high-value orders)\n- Order by “meal plan”, not by impulse (reduces spoilage)\n- Use clear packaging requests (e.g. “no bruised tomatoes”)\n- Track delivery status and ETA (especially in traffic-heavy areas)\n\nFor farmers and sellers:\n- Update stock honestly\n- Under-promise and over-deliver\n- Deliver cleanly and consistently — that’s how trust compounds\n\nWe’ll keep publishing short “buyer + seller” tips like this because they improve outcomes for everyone.',
        'published',
        now() - interval '6 days',
        'Marketplace',
        'Practical tips for buyers (and sellers) to reduce waste and improve outcomes when ordering produce online.',
        'https://images.pexels.com/photos/17302468/pexels-photo-17302468.jpeg?auto=compress&cs=tinysrgb&w=1600',
        'Fresh fruits and vegetables at a market',
        'Image: Pexels (free license).'
      ),
      (
        'LocalLink product updates: reliability, no-shows, and accountability',
        'locallink-product-updates-reliability-no-shows-accountability',
        E'No-shows kill marketplaces.\n\nSo we’re building reliability into the system, not just into “rules”.\n\nWhat’s new:\n- Shift no-show detection (after a grace window)\n- Employer tools to record attendance and outcomes\n- Replacement routing from a private pool (“Fill remaining” / “Replace no-shows”)\n\nWhy we’re doing it:\n- Buyers and employers need predictability\n- Providers deserve fair, consistent enforcement\n- The platform must reward showing up and finishing work\n\nThis is how LocalLink becomes more than listings — it becomes infrastructure.',
        'published',
        now() - interval '4 days',
        'Product updates',
        'A quick update on the reliability tools we’re adding to reduce no-shows and improve completion rates.',
        'https://images.pexels.com/photos/14367421/pexels-photo-14367421.jpeg?auto=compress&cs=tinysrgb&w=1600',
        'Construction workers collaborating on site',
        'Image: Pexels (free license).'
      );
  end if;
end $$;

