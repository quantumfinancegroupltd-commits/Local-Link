-- Upgrade News hero images to reliable sources + deepen content.
-- Idempotent: updates by slug (no duplicate inserts).

do $$
begin
  -- 1) Welcome post (deeper + valid image)
  update news_posts
  set
    category = 'Announcements',
    summary = 'What LocalLink News is for: product updates, safety guidance, hiring playbooks, and practical Ghana-first guides.',
    hero_image_url = 'https://images.pexels.com/photos/1422408/pexels-photo-1422408.jpeg?auto=compress&cs=tinysrgb&w=1600',
    hero_image_alt = 'Modern glass building in Accra',
    hero_image_credit = 'Image: Pexels (free license).',
    body = E'LocalLink News is the knowledge layer of the platform.\n\nIf the marketplace is where transactions happen, News is where we make those transactions safer, clearer, and more successful.\n\nWhat we will publish here\n\n1) Product updates (real updates, not marketing)\n- What changed\n- Why it changed\n- What you should do differently (if anything)\n\n2) Safety + scam prevention for Ghana\n- How to avoid off-platform payment traps\n- How to protect your phone number and identity\n- What to do when a job or order goes wrong\n\n3) Hiring and workforce playbooks (for SMEs + operations teams)\n- How to write a job post that attracts the right applicants\n- How to schedule shifts without chaos\n- How to reduce no-shows with simple attendance proof\n\n4) Marketplace and produce guides\n- Buying fresh produce with less waste\n- How sellers/farmers can build repeat buyers\n- Delivery expectations that reduce disputes\n\nWhat we won’t do\n- Clickbait\n- Long essays with no actionable steps\n- Copy/paste “global advice” that doesn’t fit Ghana\n\nHow to use News (best practice)\n- Buyers: read the safety checklists before your first paid job\n- Providers/workers: use the reliability guides to avoid penalties and build trust fast\n- Employers: use the shift and attendance playbooks to reduce no-shows and protect your payroll\n\nIf you want a topic covered, send it via Support in-app. We’ll turn the most common questions into clear guides.',
    updated_at = now()
  where slug = 'welcome-to-locallink-news' and deleted_at is null;

  -- 2) Employers v1 post (deeper + valid image)
  update news_posts
  set
    category = 'Product updates',
    summary = 'Employers v1 adds worker pools, shift scheduling, attendance proof, bulk actions, and replacement routing.',
    hero_image_url = 'https://images.pexels.com/photos/3184306/pexels-photo-3184306.jpeg?auto=compress&cs=tinysrgb&w=1600',
    hero_image_alt = 'Team collaborating in an office',
    hero_image_credit = 'Image: Pexels (free license).',
    body = E'LocalLink Employers (v1) is built for a Ghana reality:\n\n- hiring through WhatsApp groups\n- “someone will come tomorrow” uncertainty\n- paper attendance\n- no performance memory\n- cash leakage and payment disputes\n\nThe goal is simple: predictability.\n\nWhat’s included in Employers v1\n\nA) Worker pools (private)\nCreate private lists like:\n- Preferred Cleaners\n- Event Crew\n- Trusted Drivers\n- Warehouse Packers\n\nEach pool supports:\n- fast re-hiring\n- internal notes and ratings (your team only)\n- performance memory (attendance, no-shows, completed work)\n\nB) Shift scheduling (v1)\nCreate a shift block:\n- title, role tag, headcount\n- location\n- start/end time\n\nThen invite workers from a pool.\n\nC) Worker-side “My shifts”\nWorkers can:\n- accept or decline invitations\n- check in/out\n\nD) Attendance proof (lightweight, not surveillance)\nYou can enable:\n1) Check-in code (QR/code)\n- show the code on site\n- worker enters it from “My shifts”\n\n2) Geo check-in\n- require worker location within a radius\n\nE) Bulk supervisor actions\nSelect multiple workers and:\n- set checked_out\n- confirm no_show\n- close a shift fast when you’re busy\n\nF) Replacement routing\nTwo one-click actions from your pool:\n- Fill remaining (auto-invite missing slots to reach headcount)\n- Replace no-shows (invite replacements without exceeding headcount)\n\nWhy this matters\n- It reduces day-of chaos\n- It makes no-shows measurable and enforceable\n- It creates professional memory that compounds over time\n\nWhere to find it\nEmployers → Company dashboard → Scheduling',
    updated_at = now()
  where slug = 'locallink-employers-worker-pools-shifts-attendance-v1' and deleted_at is null;

  -- 3) Safety checklist (deeper + valid image)
  update news_posts
  set
    category = 'Guides',
    summary = 'A Ghana-first checklist that prevents the most common hiring and marketplace scams.',
    hero_image_url = 'https://images.pexels.com/photos/17302468/pexels-photo-17302468.jpeg?auto=compress&cs=tinysrgb&w=1600',
    hero_image_alt = 'Fresh produce at a market stall',
    hero_image_credit = 'Image: Pexels (free license).',
    body = E'In Ghana, the biggest marketplace risks are predictable:\n\n- paying off-platform\n- unclear job scope\n- “I’ll come later” no-shows\n- identity uncertainty\n- pressure tactics\n\nUse this 10-point checklist. It prevents most scams and most disputes.\n\n1) Keep the conversation in-app\nIf it’s not in the chat, it didn’t happen.\n\n2) Avoid off-platform payments\nEscrow exists for a reason: it reduces ghosting and payment chasing.\n\n3) Confirm the scope in writing\nWhat exactly will be done? What is included? What is excluded?\n\n4) Confirm the location + time window\nUse an arrival window (e.g. 9:00–9:30).\n\n5) Agree materials responsibility\nWho buys what? When? With receipts?\n\n6) Use milestones for larger jobs\nDon’t pay 100% upfront for multi-day work.\n\n7) Use simple proof\nPhotos, or a completion confirmation, depending on risk.\n\n8) Watch for pressure tactics\n“Send now or I’ll leave” is a red flag.\n\n9) Don’t share sensitive documents in chat\nUse the platform verification flow.\n\n10) Review after completion\nReviews and endorsements are how good people win.\n\nIf you’re an employer: use shifts + check-in (code/geo) so attendance is clear.\nIf you’re a worker: accept only what you can truly attend. Declining early is better than no-showing.\n\nThis is how trust becomes real infrastructure.',
    updated_at = now()
  where slug = 'hiring-safely-in-ghana-10-checks' and deleted_at is null;

  -- 4) Add a deeper Ghana-specific long-form article (insert if missing)
  insert into news_posts (title, slug, body, status, published_at, category, summary, hero_image_url, hero_image_alt, hero_image_credit)
  select
    'Ghana home repairs: how to scope, price, and avoid disputes (buyers + artisans)',
    'ghana-home-repairs-scope-price-avoid-disputes',
    E'This guide is written for how home repairs actually happen in Ghana — not how they happen in a textbook.\n\nIf you’re hiring a plumber, electrician, carpenter, mason, or mechanic, the number-one cause of disputes is not “bad work”. It’s unclear scope.\n\nPart 1: The 5 questions that define scope\n\n1) What is the exact problem?\nBad: “My sink is leaking.”\nGood: “Kitchen sink trap leaks when tap runs; leak appears at joint under basin.”\n\n2) What is success?\nExample: “No leak after 10 minutes running; joints dry; sealant neat.”\n\n3) What materials are required?\nList them. If the provider supplies materials, ask for a receipt photo.\n\n4) What is the timeline?\nSame day? Two visits? Is drying time required?\n\n5) What is the total cost and what does it include?\nIf cost can change, define the rule:\n- “Any additional cost must be approved in chat before work continues.”\n\nPart 2: Pricing reality in Ghana\n\nPricing varies by:\n- location (Accra vs regional)\n- urgency (same-day emergency)\n- complexity (hidden pipe vs visible pipe)\n- material costs (which move)\n\nSo do this:\n- Ask for a range\n- Ask what would push it up\n- Confirm the range in chat\n\nPart 3: How to use escrow and milestones\n\nFor bigger jobs:\n- split payments by milestones\n- require proof per milestone (photo or confirmation)\n\nExample milestones for a small renovation:\n1) materials delivered\n2) core work complete\n3) finishing complete\n\nPart 4: Arrival windows and no-shows\n\nA marketplace is only real if people show up.\n- set an arrival window\n- require check-in for shifts/appointments\n- if someone can’t make it, they must decline early\n\nPart 5: What to do when something goes wrong\n\nIf there’s an issue:\n- stay in chat\n- upload photos\n- be specific (“this joint still leaks”)\n\nClarity reduces arguments and speeds up resolution.\n\nIf you’re a provider:\n- confirm scope before starting\n- don’t accept jobs you can’t attend\n- communicate early\n\nThis is how you build repeat customers in Ghana.',
    'published',
    now() - interval '1 days',
    'Guides',
    'A Ghana-first playbook for scoping work, setting milestones, and preventing disputes for home repairs.',
    'https://images.pexels.com/photos/8853502/pexels-photo-8853502.jpeg?auto=compress&cs=tinysrgb&w=1600',
    'Technician installing solar panels',
    'Image: Pexels (free license).'
  where not exists (select 1 from news_posts where slug = 'ghana-home-repairs-scope-price-avoid-disputes' and deleted_at is null);
end $$;

