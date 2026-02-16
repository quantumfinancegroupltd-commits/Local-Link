-- Events & Catering: scheduled date/time; Domestic: recurring frequency
alter table if exists jobs
  add column if not exists scheduled_at timestamptz,
  add column if not exists scheduled_end_at timestamptz,
  add column if not exists recurring_frequency text,
  add column if not exists recurring_end_date date;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'jobs_recurring_frequency_chk') then
    alter table jobs add constraint jobs_recurring_frequency_chk
      check (recurring_frequency is null or recurring_frequency in ('weekly', 'monthly'));
  end if;
end $$;

create index if not exists idx_jobs_scheduled_at on jobs(scheduled_at) where scheduled_at is not null;
create index if not exists idx_jobs_recurring on jobs(recurring_frequency) where recurring_frequency is not null;
