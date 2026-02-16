-- UTM and device for analytics (no external service)

alter table analytics_events
  add column if not exists utm_source text,
  add column if not exists utm_medium text,
  add column if not exists utm_campaign text,
  add column if not exists device_type text;

create index if not exists idx_analytics_events_utm_source on analytics_events(utm_source) where utm_source is not null;
create index if not exists idx_analytics_events_device_type on analytics_events(device_type) where device_type is not null;
