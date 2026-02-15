-- Autopilot safety: per-shift opt-out (coverage auto-fill).

alter table shift_blocks
  add column if not exists coverage_auto_fill_disabled boolean not null default false;

create index if not exists idx_shift_blocks_company_autofill_disabled on shift_blocks(company_id, start_at asc)
  where coverage_auto_fill_disabled = true;

