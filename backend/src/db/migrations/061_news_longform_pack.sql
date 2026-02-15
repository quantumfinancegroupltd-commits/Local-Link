-- Add a long-form Ghana-first content pack for /news.
-- Idempotent: inserts by slug if missing.

do $$
begin
  insert into news_posts (title, slug, body, status, published_at, category, summary, hero_image_url, hero_image_alt, hero_image_credit)
  select
    'Ghana SME hiring: a practical playbook for reliable staffing (without WhatsApp chaos)',
    'ghana-sme-hiring-playbook-reliable-staffing',
    E'This is a Ghana-first hiring playbook for small and medium businesses (shops, warehouses, restaurants, schools, construction teams, logistics).\n\nIf you hire through WhatsApp groups only, you will eventually face:\n- no-shows\n- “I’m on my way” delays\n- last-minute replacements\n- no performance memory\n- disputes about pay and time\n\nThis playbook fixes that using simple structure.\n\nPART 1 — Define the job in 60 seconds\nWrite the job in this format:\n- Role: Warehouse packer\n- Location: Tema (Comm 12)\n- Shift: 7:00–17:00\n- Start: Monday\n- Pay: GHS range per day\n- Requirements: safety shoes, can lift X kg\n\nPART 2 — Use a headcount + time window\nInstead of “Need workers tomorrow”, say:\n- Headcount: 10\n- Arrival window: 6:45–7:15\n- Work start: 7:15\n\nPART 3 — Use attendance proof (light)\nPick one:\n- Check-in code (QR/code entry)\n- Geo check-in (radius)\n\nAttendance proof does two things:\n- it protects workers from false claims\n- it protects employers from “ghost staff”\n\nPART 4 — Always plan replacements\nPlan for 10–20% no-show risk if you do not have a trusted pool.\nCreate a private pool:\n- Preferred workers\n- Backup workers\n\nPART 5 — Build performance memory\nTrack 3 metrics per worker:\n- Attendance rate\n- No-show count\n- Completion reliability\n\nThen use that memory for future hiring. This is how you reduce chaos month after month.\n\nPART 6 — Pay clarity prevents disputes\nIf pay is daily:\n- confirm amount\n- confirm when paid\nIf pay is milestone:\n- confirm milestones\n- confirm proof needed\n\nIf you do these steps, your hiring becomes predictable.\n\nLocalLink Employers is designed to do this without forcing heavy HR software.\n\nWhere to start:\nEmployers → Company dashboard → Worker pools + Scheduling',
    'published',
    now() - interval '18 hours',
    'Guides',
    'A Ghana-first hiring playbook for SMEs: define roles, attendance proof, replacements, performance memory, and clear pay rules.',
    'https://images.pexels.com/photos/3184465/pexels-photo-3184465.jpeg?auto=compress&cs=tinysrgb&w=1600',
    'Team working together',
    'Image: Pexels (free license).'
  where not exists (select 1 from news_posts where slug = 'ghana-sme-hiring-playbook-reliable-staffing' and deleted_at is null);

  insert into news_posts (title, slug, body, status, published_at, category, summary, hero_image_url, hero_image_alt, hero_image_credit)
  select
    'Escrow in Ghana: when to use it, when to use milestones, and how to avoid payment fights',
    'escrow-ghana-when-to-use-milestones',
    E'In Ghana, payment fights usually happen for one of three reasons:\n- unclear scope\n- unclear timing\n- unclear proof of completion\n\nEscrow fixes timing and proof.\nMilestones fix scope changes.\n\nWHEN TO USE ESCROW (single release)\nUse escrow for:\n- one-day jobs\n- fixed scope work\n- standard produce orders\n\nRule: buyer funds, provider delivers, buyer confirms.\n\nWHEN TO USE MILESTONES\nUse milestones for:\n- multi-day work\n- renovations\n- projects with materials and stages\n\nExample milestone plan:\n1) Materials delivered (photo + receipt)\n2) Core work complete (photo proof)\n3) Finishing complete (final confirmation)\n\nHOW TO AVOID PAYMENT FIGHTS\n1) Confirm scope in chat\n2) Confirm what is excluded\n3) Confirm what triggers extra cost\n4) Confirm the proof required\n5) Confirm the release rule\n\nIf you do this, disputes drop sharply — and good providers become willing to take larger work.',
    'published',
    now() - interval '15 hours',
    'Trust & payments',
    'A clear Ghana-first guide to escrow vs milestone payments and how to reduce payment disputes.',
    'https://images.pexels.com/photos/17302468/pexels-photo-17302468.jpeg?auto=compress&cs=tinysrgb&w=1600',
    'Fresh produce on display',
    'Image: Pexels (free license).'
  where not exists (select 1 from news_posts where slug = 'escrow-ghana-when-to-use-milestones' and deleted_at is null);
end $$;

