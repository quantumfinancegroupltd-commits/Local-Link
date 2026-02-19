-- Ensure every company owner has a company_members row (fixes "no permission" for owners).
-- Safe to run multiple times (uses ON CONFLICT DO NOTHING / NOT EXISTS).

insert into company_members (company_id, user_id, workspace_role, created_by, updated_at)
select c.id, c.owner_user_id, 'owner', c.owner_user_id, now()
from companies c
where c.owner_user_id is not null
  and not exists (
    select 1 from company_members cm
    where cm.company_id = c.id and cm.user_id = c.owner_user_id
  )
on conflict (company_id, user_id) do update set workspace_role = 'owner', updated_at = now();
