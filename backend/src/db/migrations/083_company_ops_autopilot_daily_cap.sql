-- Autopilot safety: per-company daily invite cap.

alter table company_ops_settings
  add column if not exists coverage_auto_fill_max_invites_per_day int not null default 200;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'chk_company_ops_settings_max_invites_per_day') then
    alter table company_ops_settings
      add constraint chk_company_ops_settings_max_invites_per_day check (coverage_auto_fill_max_invites_per_day >= 1 and coverage_auto_fill_max_invites_per_day <= 2000);
  end if;
end $$;

