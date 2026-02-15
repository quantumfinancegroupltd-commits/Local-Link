-- Transaction-backed skill endorsements (buyer -> provider) after verified completion.

create table if not exists skill_endorsements (
  id uuid primary key default gen_random_uuid(),
  provider_user_id uuid not null references users(id) on delete cascade,
  endorser_user_id uuid not null references users(id) on delete cascade,
  context_type text not null, -- 'job' | 'order'
  context_id uuid not null,
  skill text not null,
  created_at timestamptz not null default now()
);

create index if not exists skill_endorsements_provider_idx on skill_endorsements(provider_user_id, created_at desc);
create index if not exists skill_endorsements_context_idx on skill_endorsements(context_type, context_id);

-- Prevent farming: one endorser can endorse a given skill once per transaction context.
create unique index if not exists uq_skill_endorsements_unique
on skill_endorsements(endorser_user_id, context_type, context_id, skill);

