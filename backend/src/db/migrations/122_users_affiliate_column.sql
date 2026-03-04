-- Add users.affiliate_id (referral tracking). Index is in 122_users_affiliate_id.sql.
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'users' and column_name = 'affiliate_id'
  ) then
    alter table public.users add column affiliate_id uuid references affiliates(id) on delete set null;
  end if;
end $$;
