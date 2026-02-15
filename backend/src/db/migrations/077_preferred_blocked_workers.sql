-- Enterprise Mode: preferred + blocked workers (private employer flags)

alter table employer_worker_notes
  add column if not exists preferred boolean not null default false,
  add column if not exists blocked boolean not null default false;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'chk_employer_worker_notes_preferred_blocked'
  ) then
    alter table employer_worker_notes
      add constraint chk_employer_worker_notes_preferred_blocked
      check (not (preferred and blocked));
  end if;
end $$;

create index if not exists idx_employer_worker_notes_preferred
  on employer_worker_notes(company_id, updated_at desc)
  where preferred = true;

create index if not exists idx_employer_worker_notes_blocked
  on employer_worker_notes(company_id, updated_at desc)
  where blocked = true;

