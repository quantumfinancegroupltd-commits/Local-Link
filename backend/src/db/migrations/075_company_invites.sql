-- Enterprise Mode v1.1: company workspace invites (email-based) + acceptance.

create table if not exists company_member_invites (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  email text not null,
  workspace_role text not null default 'ops',
  token_hash text not null,
  invited_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '14 days'),
  accepted_at timestamptz,
  accepted_by uuid references users(id) on delete set null,
  revoked_at timestamptz,
  revoked_by uuid references users(id) on delete set null
);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'chk_company_member_invites_role'
  ) then
    alter table company_member_invites
      add constraint chk_company_member_invites_role
      check (workspace_role in ('owner','ops','hr','finance','supervisor'));
  end if;
end $$;

-- Avoid multiple active invites per email per company.
create unique index if not exists uq_company_member_invites_active
  on company_member_invites(company_id, lower(email))
  where accepted_at is null and revoked_at is null;

create index if not exists idx_company_member_invites_company on company_member_invites(company_id, created_at desc);
create index if not exists idx_company_member_invites_token_hash on company_member_invites(token_hash);

