do $$
begin
  if not exists (select 1 from pg_type where typname = 'support_ticket_status') then
    create type support_ticket_status as enum ('open','pending_user','pending_admin','resolved','closed');
  end if;
  if not exists (select 1 from pg_type where typname = 'support_ticket_priority') then
    create type support_ticket_priority as enum ('low','normal','high','urgent');
  end if;
  if not exists (select 1 from pg_type where typname = 'support_ticket_category') then
    create type support_ticket_category as enum ('general','account','jobs','orders','delivery','escrow','verification','payouts','fraud','dispute');
  end if;
  if not exists (select 1 from pg_type where typname = 'support_event_visibility') then
    create type support_event_visibility as enum ('internal','customer');
  end if;
end $$;

create table if not exists support_tickets (
  id uuid primary key default gen_random_uuid(),
  requester_user_id uuid references users(id) on delete set null,
  created_by_user_id uuid references users(id) on delete set null,
  assigned_admin_user_id uuid references users(id) on delete set null,
  category support_ticket_category not null default 'general',
  status support_ticket_status not null default 'open',
  priority support_ticket_priority not null default 'normal',
  subject text not null,
  description text,
  related_type text, -- 'job' | 'order' | 'dispute' | 'user' | etc.
  related_id text,
  tags jsonb,
  last_activity_at timestamptz default now(),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_support_tickets_status on support_tickets(status, priority, last_activity_at desc);
create index if not exists idx_support_tickets_requester on support_tickets(requester_user_id, last_activity_at desc);
create index if not exists idx_support_tickets_assigned on support_tickets(assigned_admin_user_id, last_activity_at desc);
create index if not exists idx_support_tickets_category on support_tickets(category, last_activity_at desc);

create table if not exists support_ticket_events (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references support_tickets(id) on delete cascade,
  author_user_id uuid references users(id) on delete set null,
  visibility support_event_visibility not null default 'customer',
  body text not null,
  created_at timestamptz default now()
);

create index if not exists idx_support_ticket_events_ticket on support_ticket_events(ticket_id, created_at asc);


