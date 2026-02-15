-- Ghana future-of-work series + trust infrastructure explainers.
-- Idempotent: inserts by slug if missing.

do $$
begin
  insert into news_posts (title, slug, body, status, published_at, category, summary, hero_image_url, hero_image_alt, hero_image_credit)
  select
    'How digital labour platforms are reshaping work in Ghana',
    'how-digital-labour-platforms-reshape-work-in-ghana',
    E'In the last decade, Ghana’s workforce has been changing quietly.\n\nSkilled people who used to rely purely on word-of-mouth now rely on:\n- WhatsApp groups\n- Facebook listings\n- community referrals\n- quick cash arrangements\n\nThat system works — until it doesn’t.\n\nThe biggest problems are predictable:\n- unreliable job flow (good workers still struggle to get consistent work)\n- no digital record of skill or history\n- payment uncertainty (especially for first-time transactions)\n- low repeat business because there is no “professional memory”\n\n## The informal workforce reality\nA huge share of work in Ghana happens informally. That means:\n- skills exist, but proof is weak\n- referrals exist, but scale is limited\n- disputes get settled emotionally, not consistently\n\n## Why digital labour platforms matter\nA real platform does 4 things at the same time:\n\n1) Aggregates supply and demand\n- buyers can find workers and produce without guessing\n\n2) Verifies identity\n- confidence is higher when people are real and accountable\n\n3) Protects payments\n- escrow prevents ghosting and payment chasing\n\n4) Creates reputation memory\n- work history, reviews, endorsements, and attendance build a professional story over time\n\n## What LocalLink brings (Ghana-first, not generic)\nLocalLink is designed around Ghana’s real constraints:\n- trust gaps between strangers\n- inconsistent connectivity\n- high off-platform leakage via phone/WhatsApp\n- no-show risk\n\nSo the platform focuses on:\n- verification\n- escrow\n- structured workflows\n- accountability\n\n## The long-term impact\nDigital labour platforms aren’t “just apps”. In a country where informal work dominates, they become infrastructure:\n- workers build a portable reputation\n- buyers get predictable outcomes\n- employers can manage casual labour without chaos\n\n## What to do next\n- If you’re a worker: verify, respond fast, and finish cleanly.\n- If you’re a buyer: keep payments in escrow and confirm scope in chat.\n- If you’re an employer: use worker pools + shifts + attendance proof.\n\nCTA:\nJoin LocalLink and build a professional identity that compounds.',
    'published',
    now() - interval '10 hours',
    'Insights',
    'A Ghana-first look at how platforms like LocalLink turn informal work into structured, trusted, repeatable opportunity.',
    'https://images.pexels.com/photos/20500461/pexels-photo-20500461.jpeg?auto=compress&cs=tinysrgb&w=1600',
    'Skilled worker at work',
    'Image: Pexels (free license).'
  where not exists (select 1 from news_posts where slug = 'how-digital-labour-platforms-reshape-work-in-ghana' and deleted_at is null);

  insert into news_posts (title, slug, body, status, published_at, category, summary, hero_image_url, hero_image_alt, hero_image_credit)
  select
    'From WhatsApp groups to verified digital workplaces: a new era for skilled workers in Ghana',
    'from-whatsapp-groups-to-verified-digital-workplaces-ghana',
    E'Ghana’s informal hiring landscape is powerful — and chaotic.\n\nWhatsApp groups, Facebook posts, and community referrals are fast, but they usually lack:\n- verification\n- accountability\n- work history\n- consistent dispute resolution\n\nThat creates the same cycle:\n- buyers fear no-shows and poor quality\n- workers fear payment delays and misunderstandings\n\n## The status quo (and its hidden costs)\nWhen hiring is informal:\n- good workers waste time chasing leads\n- buyers waste time re-explaining the same job\n- disputes get settled inconsistently\n- repeat hiring becomes a memory game\n\n## What “trust-first” actually means\nA trust-first marketplace is not about slogans.\nIt’s a system with enforced rails:\n\n1) Verified identity\n2) In-app messaging (so there is a record)\n3) Escrow protection\n4) Dispute handling (structured, not emotional)\n5) Reputation memory (history that compounds)\n\n## What LocalLink changes\nLocalLink turns informal hiring into a verified workflow:\n- profiles that are harder to fake\n- safer payments via escrow\n- a job/shift timeline that reduces confusion\n- consequences for no-shows and bad behavior\n\n## Economic upside for workers\nWhen work becomes documented:\n- repeat clients increase\n- pricing confidence increases\n- workers build a portfolio\n- employers can re-hire faster\n\nCTA:\nMove from “chasing referrals” to building a reputation. Use LocalLink.',
    'published',
    now() - interval '8 hours',
    'Insights',
    'Why trust-first rails (verification + escrow + history) beat informal WhatsApp hiring over time in Ghana.',
    'https://images.pexels.com/photos/4971945/pexels-photo-4971945.jpeg?auto=compress&cs=tinysrgb&w=1600',
    'Person using a phone while shopping',
    'Image: Pexels (free license).'
  where not exists (select 1 from news_posts where slug = 'from-whatsapp-groups-to-verified-digital-workplaces-ghana' and deleted_at is null);

  insert into news_posts (title, slug, body, status, published_at, category, summary, hero_image_url, hero_image_alt, hero_image_credit)
  select
    'Why escrow and dispute systems are critical for Ghana’s gig economy',
    'why-escrow-and-dispute-systems-matter-ghana-gig-economy',
    E'Traditionally in Ghana, trust comes from relationships.\nBut when buyers and providers meet digitally for the first time, the risk increases.\n\nTwo things break marketplaces quickly:\n- payment disputes\n- no-shows\n\n## The problem with trustless transactions\nWithout protection:\n- buyers risk paying and getting ghosted\n- workers risk doing work and chasing payment\n- disagreements turn into long chat fights\n\n## What escrow actually does (plain language)\nEscrow is a third-party holding system:\n1) Buyer funds the job/order\n2) Work happens\n3) Buyer confirms completion\n4) Funds are released\n\nEscrow aligns incentives:\n- workers are motivated to finish\n- buyers are motivated to confirm\n\n## Why dispute systems matter\nDisputes are inevitable.\nThe question is whether you resolve them:\n- informally (inconsistent)\n- or structurally (fair + repeatable)\n\nA good dispute system needs:\n- a clear job timeline\n- evidence options (photo, code confirmation)\n- admin mediation when needed\n- consistent outcomes\n\n## LocalLink’s trust infrastructure\nLocalLink combines:\n- verified workflows\n- escrow\n- dispute handling\n- trust scoring (reliability signals)\n\nThat is how a marketplace becomes predictable.\n\nCTA:\nProtect your work and your money — use escrow and keep communication in-app.',
    'published',
    now() - interval '7 hours',
    'Trust & payments',
    'Escrow + structured disputes are not “nice-to-have” — they’re infrastructure for digital work in Ghana.',
    'https://images.pexels.com/photos/7567221/pexels-photo-7567221.jpeg?auto=compress&cs=tinysrgb&w=1600',
    'Business analysis papers and laptop on a desk',
    'Image: Pexels (free license).'
  where not exists (select 1 from news_posts where slug = 'why-escrow-and-dispute-systems-matter-ghana-gig-economy' and deleted_at is null);

  insert into news_posts (title, slug, body, status, published_at, category, summary, hero_image_url, hero_image_alt, hero_image_credit)
  select
    'How skills verification unlocks economic opportunity in Ghana',
    'how-skills-verification-unlocks-opportunity-ghana',
    E'In a world where anyone can claim anything, verification is economic power.\n\nFor Ghana’s informal workforce, verification is not a badge for vanity.\nIt is a way to:\n- reduce buyer uncertainty\n- increase repeat work\n- earn higher rates over time\n\n## The verification problem\nBuyers and employers often can’t tell the difference between:\n- unverified providers\n- unproven skills\n- inflated self-descriptions\n\nThat creates:\n- cancellations\n- disputes\n- lower earnings for honest workers\n\n## What verification should mean on LocalLink\nVerification is a layered proof system:\n- identity verification (who you are)\n- work history (what you’ve done)\n- transaction-backed endorsements (what you’re trusted for)\n\n## Why this changes earnings\nWhen the buyer is confident:\n- they accept faster\n- they argue less\n- they hire again\n\nOver time, the verified provider builds a professional narrative:\n- history\n- badges\n- endorsements\n- reliability\n\nCTA:\nGet verified and turn your skill into a documented asset.',
    'published',
    now() - interval '6 hours',
    'Insights',
    'Verification turns skill into visible proof — which increases trust, repeat work, and long-term earnings.',
    'https://images.pexels.com/photos/8488029/pexels-photo-8488029.jpeg?auto=compress&cs=tinysrgb&w=1600',
    'Worker using hand tools',
    'Image: Pexels (free license).'
  where not exists (select 1 from news_posts where slug = 'how-skills-verification-unlocks-opportunity-ghana' and deleted_at is null);

  insert into news_posts (title, slug, body, status, published_at, category, summary, hero_image_url, hero_image_alt, hero_image_credit)
  select
    'What the rise of digital work marketplaces means for Ghana’s future',
    'what-digital-work-marketplaces-mean-for-ghana-future',
    E'Work is becoming more flexible, more digital, and more reputation-driven.\n\nGhana is positioned to lead West Africa’s digital labour evolution — but only if platforms solve trust.\n\n## The transformation\nGlobally:\n- payments are moving online\n- reputation is becoming an asset\n- platforms route work, not just listings\n\nIn Ghana, demand exists — but trust and structure are the blockers.\n\n## What changes when work is structured\nWhen work becomes platform-mediated:\n- workers build portable reputation\n- buyers get predictable outcomes\n- employers can manage casual labour with data\n- disputes are resolved faster\n\n## What LocalLink is building\nLocalLink focuses on:\n- trust rails (verification, escrow, disputes)\n- operational tools (shifts, attendance proof, replacement routing)\n- professional memory (history, endorsements, badges)\n\nThis is how “informal” becomes visible and repeatable.\n\n## The long-term opportunity\nIf done right, digital marketplaces unlock:\n- economic inclusion\n- workforce mobility\n- SME growth in services/logistics\n- better matching and reduced waste\n\nCTA:\nBe part of the future of work in Ghana — build your identity on LocalLink.',
    'published',
    now() - interval '5 hours',
    'Insights',
    'A Ghana-first view of how digital marketplaces can formalize reputation, reduce friction, and expand opportunity.',
    'https://images.pexels.com/photos/8961065/pexels-photo-8961065.jpeg?auto=compress&cs=tinysrgb&w=1600',
    'Engineers in hard hats discussing a project',
    'Image: Pexels (free license).'
  where not exists (select 1 from news_posts where slug = 'what-digital-work-marketplaces-mean-for-ghana-future' and deleted_at is null);
end $$;

