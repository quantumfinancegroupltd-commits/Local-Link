do $$
begin
  if not exists (select 1 from pg_type where typname = 'resume_entry_kind') then
    create type resume_entry_kind as enum ('experience','education','certification','qualification','award');
  end if;
end $$;

create table if not exists user_resume_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  kind resume_entry_kind not null,
  org_name text,
  title text,
  field text,
  location text,
  start_date date,
  end_date date,
  description text,
  url text,
  sort_order int not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_resume_entries_user on user_resume_entries(user_id, kind, sort_order, start_date desc, created_at desc);
create index if not exists idx_resume_entries_kind on user_resume_entries(kind);


