-- Recurring shifts: save auto-invite + auto-generate settings per series.

alter table company_shift_series
  add column if not exists auto_fill_list_id uuid references employer_worker_lists(id) on delete set null,
  add column if not exists auto_fill_mode text not null default 'headcount', -- headcount | count
  add column if not exists auto_fill_count int,
  add column if not exists auto_generate_enabled boolean not null default false,
  add column if not exists auto_generate_days int not null default 14,
  add column if not exists auto_generated_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'chk_company_shift_series_autofill_mode'
  ) then
    alter table company_shift_series
      add constraint chk_company_shift_series_autofill_mode
      check (auto_fill_mode in ('headcount','count'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'chk_company_shift_series_autofill_count'
  ) then
    alter table company_shift_series
      add constraint chk_company_shift_series_autofill_count
      check (auto_fill_mode <> 'count' or (auto_fill_count is not null and auto_fill_count >= 1 and auto_fill_count <= 200));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'chk_company_shift_series_autogen_days'
  ) then
    alter table company_shift_series
      add constraint chk_company_shift_series_autogen_days
      check (auto_generate_days >= 1 and auto_generate_days <= 90);
  end if;
end $$;

create index if not exists idx_company_shift_series_autogen
  on company_shift_series(company_id, auto_generated_at asc)
  where auto_generate_enabled = true and status = 'active';

