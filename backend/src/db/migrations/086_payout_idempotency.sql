-- Idempotency for payouts (withdrawals) to prevent double-creates on retries

do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_name = 'payouts' and column_name = 'idempotency_key'
  ) then
    alter table payouts add column idempotency_key text;
  end if;
end $$;

create unique index if not exists uniq_payouts_user_idempotency
  on payouts(user_id, idempotency_key)
  where idempotency_key is not null and length(idempotency_key) > 0;

