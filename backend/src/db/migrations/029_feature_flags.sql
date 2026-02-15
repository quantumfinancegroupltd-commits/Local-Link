-- Feature flags (vertical unlocks without rebuilds)

create table if not exists feature_flags (
  key text primary key,
  enabled boolean not null default false,
  description text,
  updated_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_feature_flags_enabled on feature_flags(enabled);

-- Seed known flags (safe / idempotent)
insert into feature_flags (key, enabled, description)
values
  ('vertical_events', false, 'Enable Events & Catering door'),
  ('vertical_domestic', false, 'Enable Domestic & Recurring Services door'),
  ('vertical_b2b_supply', false, 'Enable Business Sourcing door'),
  ('vertical_logistics', false, 'Enable Logistics-as-a-Service door')
on conflict (key) do nothing;


