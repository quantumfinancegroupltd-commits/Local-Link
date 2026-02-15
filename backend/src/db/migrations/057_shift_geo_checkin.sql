-- Shift geo check-in (optional)

alter table shift_blocks
  add column if not exists checkin_geo_required boolean not null default false,
  add column if not exists checkin_geo_radius_m int,
  add column if not exists checkin_geo_lat numeric,
  add column if not exists checkin_geo_lng numeric;

create index if not exists shift_blocks_geo_checkin_required_idx
  on shift_blocks (company_id, start_at desc)
  where checkin_geo_required = true;

