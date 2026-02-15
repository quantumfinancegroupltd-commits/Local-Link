-- Shift check-in codes (QR/code check-in v1)

alter table shift_blocks
  add column if not exists checkin_code_hash text,
  add column if not exists checkin_last_rotated_at timestamptz;

create index if not exists shift_blocks_checkin_enabled_idx
  on shift_blocks (company_id, checkin_last_rotated_at desc)
  where checkin_code_hash is not null;

