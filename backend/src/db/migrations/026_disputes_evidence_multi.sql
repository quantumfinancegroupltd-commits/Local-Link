-- Dispute evidence + allow multiple disputes over time (but only one open/under_review per escrow)

alter table if exists disputes
add column if not exists evidence jsonb,
add column if not exists resolved_by uuid references users(id) on delete set null,
add column if not exists resolved_at timestamptz;

-- The original table used escrow_id UNIQUE; relax it.
do $$
begin
  -- drop unique constraint if it exists (name may vary)
  if exists (
    select 1
    from pg_constraint
    where conrelid = 'disputes'::regclass
      and contype = 'u'
      and array_length(conkey, 1) = 1
  ) then
    -- best-effort: try common name from pg when declared as "escrow_id uuid unique"
    begin
      alter table disputes drop constraint if exists disputes_escrow_id_key;
    exception when others then
      -- ignore
    end;
  end if;
end $$;

-- Enforce: only one active dispute per escrow (open or under_review)
create unique index if not exists uq_disputes_active_per_escrow
on disputes(escrow_id)
where status in ('open','under_review');


