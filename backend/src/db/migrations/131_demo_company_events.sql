-- Two demo events for the demo company (owner ama.serwaa@demo.locallink.agency), industry-relevant.

insert into company_events (company_id, title, description, location, starts_at, ends_at, image_url)
select c.id,
  'Workplace Safety & Compliance Briefing',
  'Join us for a 90-minute session on safety standards, PPE, and compliance for casual and shift workers. Refreshments provided.',
  'Accra Office, East Legon',
  (date_trunc('day', now()) + interval '14 days' + time '10:00') at time zone 'Africa/Accra',
  (date_trunc('day', now()) + interval '14 days' + time '11:30') at time zone 'Africa/Accra',
  'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=320&h=180&fit=crop'
from companies c
join users u on u.id = c.owner_user_id and u.email = 'ama.serwaa@demo.locallink.agency' and u.deleted_at is null
where not exists (select 1 from company_events e where e.company_id = c.id and e.title = 'Workplace Safety & Compliance Briefing' limit 1)
limit 1;

insert into company_events (company_id, title, description, location, starts_at, ends_at, image_url)
select c.id,
  'Quarterly All-Hands: Staff & Hiring Update',
  'Update on hiring, new roles, and Q2 priorities. Open to all current and prospective workers. Q&A after.',
  'Demo Company HQ, Accra',
  (date_trunc('day', now()) + interval '28 days' + time '14:00') at time zone 'Africa/Accra',
  (date_trunc('day', now()) + interval '28 days' + time '15:30') at time zone 'Africa/Accra',
  'https://images.unsplash.com/photo-1511578314322-379afb476865?w=320&h=180&fit=crop'
from companies c
join users u on u.id = c.owner_user_id and u.email = 'ama.serwaa@demo.locallink.agency' and u.deleted_at is null
where not exists (select 1 from company_events e where e.company_id = c.id and e.title = 'Quarterly All-Hands: Staff & Hiring Update' limit 1)
limit 1;
