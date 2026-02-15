-- Expand escrow status enum to support full workflow (internal logic; provider integrations later)
do $$
begin
  if not exists (
    select 1 from pg_enum e join pg_type t on t.oid = e.enumtypid
    where t.typname = 'escrow_status' and e.enumlabel = 'created'
  ) then
    alter type escrow_status add value 'created';
  end if;

  if not exists (
    select 1 from pg_enum e join pg_type t on t.oid = e.enumtypid
    where t.typname = 'escrow_status' and e.enumlabel = 'in_progress'
  ) then
    alter type escrow_status add value 'in_progress';
  end if;

  if not exists (
    select 1 from pg_enum e join pg_type t on t.oid = e.enumtypid
    where t.typname = 'escrow_status' and e.enumlabel = 'completed_pending_confirmation'
  ) then
    alter type escrow_status add value 'completed_pending_confirmation';
  end if;
end $$;


