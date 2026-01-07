do $$
begin
  if not exists (select 1 from pg_type where typname = 'verification_tier') then
    create type verification_tier as enum ('unverified','bronze','silver','gold');
  end if;
  if not exists (select 1 from pg_type where typname = 'subscription_status') then
    create type subscription_status as enum ('active','paused','cancelled');
  end if;
end $$;

create table if not exists verification_levels (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references users(id) on delete cascade,
  level verification_tier not null default 'unverified',
  evidence jsonb,
  updated_by uuid references users(id) on delete set null,
  updated_at timestamptz default now(),
  created_at timestamptz default now()
);

create table if not exists subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  type varchar(64) not null, -- e.g., weekly_produce, handyman_plan
  status subscription_status not null default 'active',
  interval varchar(16) not null default 'weekly', -- weekly/monthly
  renewal_date date,
  meta jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_subscriptions_user on subscriptions(user_id);


