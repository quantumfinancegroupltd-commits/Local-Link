-- Trust Score V2: event ledger + snapshots (for explainable, auditable trust)

create table if not exists trust_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  actor_user_id uuid references users(id) on delete set null,
  component text not null, -- identity|reliability|quality|integrity|responsiveness|tenure|manual
  kind text not null,
  points numeric(8,2) not null,
  meta jsonb,
  dedupe_key text,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists trust_events_user_time_idx on trust_events(user_id, occurred_at desc);
create index if not exists trust_events_component_time_idx on trust_events(component, occurred_at desc);
create index if not exists trust_events_kind_time_idx on trust_events(kind, occurred_at desc);
create unique index if not exists trust_events_user_dedupe_unique on trust_events(user_id, dedupe_key) where dedupe_key is not null;

create table if not exists trust_snapshots (
  user_id uuid primary key references users(id) on delete cascade,
  score_100 numeric(5,2) not null default 0,
  band text not null default 'restricted',
  components jsonb not null default '{}'::jsonb,
  computed_at timestamptz not null default now()
);

create index if not exists trust_snapshots_band_idx on trust_snapshots(band);
create index if not exists trust_snapshots_computed_at_idx on trust_snapshots(computed_at desc);

-- Optional history table for charts/trends (can be pruned later)
create table if not exists trust_snapshot_history (
  id bigserial primary key,
  user_id uuid not null references users(id) on delete cascade,
  score_100 numeric(5,2) not null,
  band text not null,
  components jsonb not null,
  computed_at timestamptz not null default now()
);

create index if not exists trust_snapshot_history_user_time_idx on trust_snapshot_history(user_id, computed_at desc);

