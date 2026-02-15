-- Company Ops alerts + weekly digest settings (v0).

alter table company_ops_settings
  add column if not exists coverage_alert_enabled boolean not null default true,
  add column if not exists coverage_alert_lookahead_hours int not null default 72,
  add column if not exists coverage_alert_min_open_slots int not null default 1,
  add column if not exists coverage_alert_last_sent_at timestamptz,
  add column if not exists reliability_alert_enabled boolean not null default true,
  add column if not exists reliability_alert_threshold_noshow_pct int not null default 30,
  add column if not exists reliability_alert_last_sent_at timestamptz,
  add column if not exists weekly_digest_enabled boolean not null default true,
  add column if not exists weekly_digest_last_sent_at timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'chk_company_ops_settings_coverage_lookahead_hours') then
    alter table company_ops_settings
      add constraint chk_company_ops_settings_coverage_lookahead_hours check (coverage_alert_lookahead_hours >= 12 and coverage_alert_lookahead_hours <= 336);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'chk_company_ops_settings_coverage_min_open_slots') then
    alter table company_ops_settings
      add constraint chk_company_ops_settings_coverage_min_open_slots check (coverage_alert_min_open_slots >= 1 and coverage_alert_min_open_slots <= 500);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'chk_company_ops_settings_reliability_threshold') then
    alter table company_ops_settings
      add constraint chk_company_ops_settings_reliability_threshold check (reliability_alert_threshold_noshow_pct >= 10 and reliability_alert_threshold_noshow_pct <= 95);
  end if;
end $$;

create index if not exists idx_company_ops_settings_coverage_alerts on company_ops_settings(coverage_alert_enabled, coverage_alert_last_sent_at);
create index if not exists idx_company_ops_settings_weekly_digest on company_ops_settings(weekly_digest_enabled, weekly_digest_last_sent_at);

