-- Ensure products.updated_at is maintained on edits (optional but helpful)
-- If you prefer app-managed timestamps only, we can remove this later.

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

do $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgname = 'trg_products_updated_at'
  ) then
    create trigger trg_products_updated_at
    before update on products
    for each row execute function set_updated_at();
  end if;
end $$;


