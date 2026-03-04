-- News category pack: Hiring guides, Worker spotlight, Employer tips, Safety & compliance, Legal & pay.
-- Idempotent: each insert runs only if the slug does not exist.

-- ═══ HIRING GUIDES ═══
insert into news_posts (title, slug, body, status, published_at, category, summary, hero_image_url, hero_image_alt, hero_image_credit)
select
  'How to hire a mason in Ghana without getting burned: the complete checklist',
  'hire-mason-ghana-checklist',
  E'Masonry scams cost Ghanaian homeowners millions every year. This step-by-step guide covers vetting credentials, writing watertight contracts, setting payment milestones, and what to do when work goes wrong — before you pay a single pesewa.\n\nKey steps:\n- Verify experience with similar projects (ask for photos and references)\n- Agree scope and materials in writing\n- Use escrow and milestones (e.g. 30% after foundation, 40% after walls, 30% after finishing)\n- Inspect at each stage before releasing funds\n\nLocalLink helps by holding funds in escrow until you confirm completion.',
  'published',
  now() - interval '5 days',
  'Hiring guides',
  'A step-by-step guide to vetting masons, setting milestones, and avoiding common scams when building or repairing in Ghana.',
  'https://images.pexels.com/photos/2219024/pexels-photo-2219024.jpeg?auto=compress&cs=tinysrgb&w=1600',
  'Construction worker with brick',
  'Image: Pexels (free license).'
where not exists (select 1 from news_posts where slug = 'hire-mason-ghana-checklist' and deleted_at is null);

insert into news_posts (title, slug, body, status, published_at, category, summary, hero_image_url, hero_image_alt, hero_image_credit)
select
  'Hiring an electrician in Accra: licences, load checks, and red flags',
  'hire-electrician-accra-licences-red-flags',
  E'Ghana''s electrical code requires certified installers. Here''s how to verify credentials before an electrician touches your wiring.\n\n- Ask for proof of certification (ECG or recognised training)\n- Check load capacity for your property\n- Get a written quote with scope and materials\n- Red flags: cash-only, no receipt, pressure to skip inspection\n\nUsing LocalLink means verified profiles and escrow so you only release payment after work is confirmed.',
  'published',
  now() - interval '7 days',
  'Hiring guides',
  'How to verify electricians and avoid unsafe or unlicensed work in Accra.',
  'https://images.pexels.com/photos/442150/pexels-photo-442150.jpeg?auto=compress&cs=tinysrgb&w=1600',
  'Electrician at work',
  'Image: Pexels (free license).'
where not exists (select 1 from news_posts where slug = 'hire-electrician-accra-licences-red-flags' and deleted_at is null);

insert into news_posts (title, slug, body, status, published_at, category, summary, hero_image_url, hero_image_alt, hero_image_credit)
select
  'Plumbers in Ghana: 6 questions to ask before the job starts',
  'plumbers-ghana-6-questions',
  E'From pipe material to pressure testing — the questions that separate professionals from chancers.\n\n1) What pipe and fitting standards do you use?\n2) How do you test for leaks before closing up?\n3) Can you provide a warranty or comeback if there’s a fault?\n4) Do you work with a mate or alone? (Affects timeline.)\n5) What’s included in the quote (materials, labour, disposal)?\n6) When can you start and how long will it take?\n\nGet answers in writing and use escrow so payment follows completion.',
  'published',
  now() - interval '9 days',
  'Hiring guides',
  'Six essential questions to ask before hiring a plumber in Ghana.',
  'https://images.pexels.com/photos/2219024/pexels-photo-2219024.jpeg?auto=compress&cs=tinysrgb&w=1600',
  'Plumber at work',
  'Image: Pexels (free license).'
where not exists (select 1 from news_posts where slug = 'plumbers-ghana-6-questions' and deleted_at is null);

insert into news_posts (title, slug, body, status, published_at, category, summary, hero_image_url, hero_image_alt, hero_image_credit)
select
  'Domestic workers in Ghana: legal obligations every employer must know in 2026',
  'domestic-workers-ghana-legal-obligations-2026',
  E'The law changed. Most employers don''t know it yet. This guide covers the Labour Act requirements for cooks, nannies, cleaners, and drivers employed in private homes — written in plain language, not legalese.\n\n- Written contract or letter of appointment\n- Minimum wage and pay frequency\n- Rest days and leave\n- Termination and notice\n\nLocalLink helps households and workers agree terms clearly and keep records for both sides.',
  'published',
  now() - interval '11 days',
  'Hiring guides',
  'Labour Act requirements for employing domestic workers in Ghana, in plain language.',
  'https://images.pexels.com/photos/6646917/pexels-photo-6646917.jpeg?auto=compress&cs=tinysrgb&w=1600',
  'Household and helper',
  'Image: Pexels (free license).'
where not exists (select 1 from news_posts where slug = 'domestic-workers-ghana-legal-obligations-2026' and deleted_at is null);

-- ═══ WORKER SPOTLIGHT ═══
insert into news_posts (title, slug, body, status, published_at, category, summary, hero_image_url, hero_image_alt, hero_image_credit)
select
  'How Kofi went from odd jobs to GH₵ 8,000/month on LocalLink',
  'worker-spotlight-kofi-odd-jobs-to-8000',
  E'Kofi Mensah, 34, was doing daily labour in Kumasi''s building trade, never knowing where the next job would come from. Eighteen months after joining LocalLink, he runs a crew of four and has more work than he can handle.\n\nHis five habits: show up on time every time, send photos of completed work, keep chat in-app, ask for reviews, and say no to jobs he can''t do well.\n\n"LocalLink changed everything. Now employers find me."',
  'published',
  now() - interval '4 days',
  'Worker spotlight',
  'One worker''s journey from casual labour to steady income and a small team — and the habits that made the difference.',
  'https://images.pexels.com/photos/3184292/pexels-photo-3184292.jpeg?auto=compress&cs=tinysrgb&w=1600',
  'Worker with tools',
  'Image: Pexels (free license).'
where not exists (select 1 from news_posts where slug = 'worker-spotlight-kofi-odd-jobs-to-8000' and deleted_at is null);

insert into news_posts (title, slug, body, status, published_at, category, summary, hero_image_url, hero_image_alt, hero_image_credit)
select
  'From Tema to Accra: Abena''s catering business, built one booking at a time',
  'worker-spotlight-abena-catering',
  E'How a home cook turned a side hustle into a 12-person catering operation using LocalLink''s marketplace tools.\n\nAbena started with small orders — office lunches, family events. She kept her calendar updated, responded fast, and asked every client for a review. Within a year she had a core team and a waiting list for big events.\n\n"Build trust first. The rest follows."',
  'published',
  now() - interval '6 days',
  'Worker spotlight',
  'A caterer''s path from home kitchen to a full team and steady bookings.',
  'https://images.pexels.com/photos/3535383/pexels-photo-3535383.jpeg?auto=compress&cs=tinysrgb&w=1600',
  'Catering and food prep',
  'Image: Pexels (free license).'
where not exists (select 1 from news_posts where slug = 'worker-spotlight-abena-catering' and deleted_at is null);

insert into news_posts (title, slug, body, status, published_at, category, summary, hero_image_url, hero_image_alt, hero_image_credit)
select
  'The plumber who bought a house: Emmanuel''s five-year plan',
  'worker-spotlight-emmanuel-plumber-house',
  E'Steady verified jobs, transparent pay, and a savings goal. Meet Emmanuel Asante and his methodical path to owning property in Kasoa.\n\nEmmanuel joined LocalLink in 2021. He only accepts jobs he can finish to a high standard, always checks in and out on shifts, and has over 200 five-star reviews. Last year he put a down payment on a plot and started building.\n\n"Escrow meant I could plan. I knew when the money would land."',
  'published',
  now() - interval '12 days',
  'Worker spotlight',
  'How one plumber used verified work and escrow to save and buy a house.',
  'https://images.pexels.com/photos/2219024/pexels-photo-2219024.jpeg?auto=compress&cs=tinysrgb&w=1600',
  'Tradesperson at work',
  'Image: Pexels (free license).'
where not exists (select 1 from news_posts where slug = 'worker-spotlight-emmanuel-plumber-house' and deleted_at is null);

-- ═══ EMPLOYER TIPS ═══
insert into news_posts (title, slug, body, status, published_at, category, summary, hero_image_url, hero_image_alt, hero_image_credit)
select
  'Scaling from 5 to 50 workers: what Ghanaian SMEs get wrong about workforce management',
  'employer-tips-scaling-5-to-50-workers',
  E'The jump from a small crew to a real workforce is where most Ghanaian SMEs hit a wall — poor attendance tracking, inconsistent pay, no documentation.\n\nWe spoke to 15 employers who scaled successfully on LocalLink. Common lessons: use one platform for roster, shifts, and pay; document everything; and build a core pool you can rely on before expanding.\n\nWorker pools and shift scheduling in LocalLink Employers are built for this.',
  'published',
  now() - interval '3 days',
  'Employer tips',
  'Lessons from employers who scaled from a small crew to a larger workforce on LocalLink.',
  'https://images.pexels.com/photos/3184291/pexels-photo-3184291.jpeg?auto=compress&cs=tinysrgb&w=1600',
  'Team meeting',
  'Image: Pexels (free license).'
where not exists (select 1 from news_posts where slug = 'employer-tips-scaling-5-to-50-workers' and deleted_at is null);

insert into news_posts (title, slug, body, status, published_at, category, summary, hero_image_url, hero_image_alt, hero_image_credit)
select
  'Writing a job brief that attracts quality workers on LocalLink',
  'employer-tips-job-brief-quality-workers',
  E'Vague briefs get vague workers. Here''s the exact format top employers use — and why specificity wins every time.\n\nInclude: role in one sentence, location and start date, pay range, what success looks like (outputs, not traits), and how you''ll confirm attendance. Keep it under 200 words. Add a clear title like "Warehouse packer, Tema, 5 days/week".\n\nWe see 3x more qualified applicants when these five elements are in the post.',
  'published',
  now() - interval '8 days',
  'Employer tips',
  'How to write job posts that attract the right applicants on LocalLink.',
  'https://images.pexels.com/photos/7688336/pexels-photo-7688336.jpeg?auto=compress&cs=tinysrgb&w=1600',
  'Person writing',
  'Image: Pexels (free license).'
where not exists (select 1 from news_posts where slug = 'employer-tips-job-brief-quality-workers' and deleted_at is null);

insert into news_posts (title, slug, body, status, published_at, category, summary, hero_image_url, hero_image_alt, hero_image_credit)
select
  'How to build a recurring worker pool and stop re-hiring from scratch',
  'employer-tips-recurring-worker-pool',
  E'The best employers on LocalLink don''t search every time. They build a pre-vetted bench of workers and just call them up.\n\nSteps: after a successful job, add the worker to a private pool (e.g. "Event crew", "Warehouse regulars"). Use notes to record strengths and availability. When you post a shift, invite from the pool first. You get faster fills and fewer no-shows because they already know you and your standards.\n\nWorker pools in LocalLink Employers make this simple.',
  'published',
  now() - interval '13 days',
  'Employer tips',
  'Why and how to build a recurring worker pool instead of hiring from scratch every time.',
  'https://images.pexels.com/photos/3184360/pexels-photo-3184360.jpeg?auto=compress&cs=tinysrgb&w=1600',
  'Team collaboration',
  'Image: Pexels (free license).'
where not exists (select 1 from news_posts where slug = 'employer-tips-recurring-worker-pool' and deleted_at is null);

-- ═══ SAFETY & COMPLIANCE ═══
insert into news_posts (title, slug, body, status, published_at, category, summary, hero_image_url, hero_image_alt, hero_image_credit)
select
  'Construction site safety in Ghana: what the law requires and what it looks like on the ground',
  'safety-construction-ghana-law-and-reality',
  E'Ghana''s Factories, Offices and Shops Act sets clear obligations for site safety — but enforcement is patchy and workers often bear the cost of failures.\n\nThis guide breaks down what employers are legally required to provide, what workers are entitled to demand, and how LocalLink''s verification system helps close the gap between law and reality.\n\nTopics: PPE, first aid, site access, and injury reporting.',
  'published',
  now() - interval '2 days',
  'Safety & compliance',
  'Legal obligations for construction site safety in Ghana and how they play out in practice.',
  'https://images.pexels.com/photos/14367425/pexels-photo-14367425.jpeg?auto=compress&cs=tinysrgb&w=1600',
  'Construction workers in safety gear',
  'Image: Pexels (free license).'
where not exists (select 1 from news_posts where slug = 'safety-construction-ghana-law-and-reality' and deleted_at is null);

insert into news_posts (title, slug, body, status, published_at, category, summary, hero_image_url, hero_image_alt, hero_image_credit)
select
  'PPE in Ghana: who pays, who provides, and what''s non-negotiable',
  'safety-ppe-ghana-who-pays',
  E'Helmets, boots, gloves, eye protection — the law is clear on who''s responsible. Most employers in Ghana don''t know it yet.\n\nEmployers must provide PPE where the job requires it. Workers must use it. Cost cannot be deducted from wages. We outline the rules and how to agree PPE in job briefs and contracts so both sides are protected.\n\nLocalLink encourages employers to specify PPE in the post so workers know what to expect.',
  'published',
  now() - interval '10 days',
  'Safety & compliance',
  'Who must provide and pay for PPE in Ghana, and what workers can insist on.',
  'https://images.pexels.com/photos/14367421/pexels-photo-14367421.jpeg?auto=compress&cs=tinysrgb&w=1600',
  'Worker in safety helmet',
  'Image: Pexels (free license).'
where not exists (select 1 from news_posts where slug = 'safety-ppe-ghana-who-pays' and deleted_at is null);

insert into news_posts (title, slug, body, status, published_at, category, summary, hero_image_url, hero_image_alt, hero_image_credit)
select
  'Workplace injury in Ghana: your rights, NHIS, and what to do in the first 24 hours',
  'safety-workplace-injury-ghana-rights',
  E'Most injured workers in Ghana don''t know their rights. A practical, plain-language guide to what happens next.\n\nIn the first 24 hours: report to the employer, seek medical care (NHIS covers many cases), and keep any evidence (photos, names of witnesses). Employers have duties to report and to support medical care. We explain the steps and where to get help.\n\nThis is not legal advice — it''s a starting point so you know what to ask for.',
  'published',
  now() - interval '16 days',
  'Safety & compliance',
  'Rights and practical steps after a workplace injury in Ghana.',
  'https://images.pexels.com/photos/7578801/pexels-photo-7578801.jpeg?auto=compress&cs=tinysrgb&w=1600',
  'Medical and care',
  'Image: Pexels (free license).'
where not exists (select 1 from news_posts where slug = 'safety-workplace-injury-ghana-rights' and deleted_at is null);

-- ═══ LEGAL & PAY ═══
insert into news_posts (title, slug, body, status, published_at, category, summary, hero_image_url, hero_image_alt, hero_image_credit)
select
  'Ghana minimum wage 2026: what skilled workers should actually be earning',
  'legal-minimum-wage-2026-skilled-trades',
  E'The National Daily Minimum Wage for 2026 is GH₵ 18.15. But for skilled tradespeople — welders, tilers, electricians, masons — the floor is much higher, and most workers are being underpaid against market rates.\n\nWe break down trade-by-trade benchmarks, how to read a pay slip, and a negotiation script that works. Knowing the market helps both workers and employers agree fair pay.\n\nLocalLink does not set rates, but we publish guidance so both sides can negotiate from fact.',
  'published',
  now() - interval '1 day',
  'Legal & pay',
  'Minimum wage and skilled-trade benchmarks in Ghana for 2026, plus negotiation tips.',
  'https://images.pexels.com/photos/7567443/pexels-photo-7567443.jpeg?auto=compress&cs=tinysrgb&w=1600',
  'Hands with smartphone and laptop',
  'Image: Pexels (free license).'
where not exists (select 1 from news_posts where slug = 'legal-minimum-wage-2026-skilled-trades' and deleted_at is null);

insert into news_posts (title, slug, body, status, published_at, category, summary, hero_image_url, hero_image_alt, hero_image_credit)
select
  'Do you need a written contract for casual labour in Ghana? The answer might surprise you',
  'legal-written-contract-casual-labour-ghana',
  E'Under Ghana''s Labour Act, even a one-day job carries legal obligations. Here''s what a basic verbal agreement actually commits you to.\n\nWe explain when a contract is required, what must be in it, and what happens if there is nothing in writing. Written terms protect both sides: the worker knows pay and scope, the employer has a record. LocalLink job posts and escrow flows create a paper trail that supports this.',
  'published',
  now() - interval '14 days',
  'Legal & pay',
  'When and why to put casual labour agreements in writing under Ghanaian law.',
  'https://images.pexels.com/photos/7688336/pexels-photo-7688336.jpeg?auto=compress&cs=tinysrgb&w=1600',
  'Contract or document',
  'Image: Pexels (free license).'
where not exists (select 1 from news_posts where slug = 'legal-written-contract-casual-labour-ghana' and deleted_at is null);

insert into news_posts (title, slug, body, status, published_at, category, summary, hero_image_url, hero_image_alt, hero_image_credit)
select
  'Mobile money for worker pay: SSNIT, tax, and the audit trail you need',
  'legal-momo-worker-pay-ssnit-tax',
  E'Paying workers via MoMo is fast and convenient — but if you''re not keeping the right records, you''re exposed.\n\nWe outline what to record (amount, date, worker ID, purpose), how long to keep it, and how it interacts with SSNIT and tax. Many employers assume short-term hires are exempt; the rules are nuanced. LocalLink payouts and escrow create a clear trail that helps both employers and workers stay compliant.',
  'published',
  now() - interval '19 days',
  'Legal & pay',
  'How to pay workers via Mobile Money while keeping the records you need for SSNIT and tax.',
  'https://images.pexels.com/photos/4968631/pexels-photo-4968631.jpeg?auto=compress&cs=tinysrgb&w=1600',
  'Mobile phone and payment',
  'Image: Pexels (free license).'
where not exists (select 1 from news_posts where slug = 'legal-momo-worker-pay-ssnit-tax' and deleted_at is null);
