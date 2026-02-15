-- Enterprise Mode v1: company workspaces (multi-user) + company audit logs.

create table if not exists company_members (
  company_id uuid not null references companies(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  workspace_role text not null default 'ops', -- owner | ops | hr | finance | supervisor
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(company_id, user_id)
);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'chk_company_members_role'
  ) then
    alter table company_members
      add constraint chk_company_members_role
      check (workspace_role in ('owner','ops','hr','finance','supervisor'));
  end if;
end $$;

create index if not exists idx_company_members_user_id on company_members(user_id);
create index if not exists idx_company_members_company_id on company_members(company_id);

-- Backfill: owners become workspace owners.
insert into company_members (company_id, user_id, workspace_role, created_by)
select c.id, c.owner_user_id, 'owner', c.owner_user_id
from companies c
where c.owner_user_id is not null
on conflict do nothing;

create table if not exists company_audit_logs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id) on delete cascade,
  actor_user_id uuid references users(id) on delete set null,
  action text not null,
  target_type text,
  target_id text,
  meta jsonb,
  ip text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists idx_company_audit_logs_created_at on company_audit_logs(created_at desc);
create index if not exists idx_company_audit_logs_company_id on company_audit_logs(company_id, created_at desc);
create index if not exists idx_company_audit_logs_actor_user_id on company_audit_logs(actor_user_id, created_at desc);

