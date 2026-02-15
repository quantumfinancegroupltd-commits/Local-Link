-- Idempotency key for escrow intents (deposit initialization)

do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_name = 'escrow_transactions' and column_name = 'idempotency_key'
  ) then
    alter table escrow_transactions add column idempotency_key text;
  end if;
end $$;

create unique index if not exists uniq_escrow_buyer_idempotency
  on escrow_transactions(buyer_id, idempotency_key)
  where idempotency_key is not null and length(idempotency_key) > 0;

