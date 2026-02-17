-- Enterprise: add auditor role (read-only) for finance/compliance.

alter table company_members drop constraint if exists chk_company_members_role;
alter table company_members
  add constraint chk_company_members_role
  check (workspace_role in ('owner','ops','hr','finance','supervisor','auditor'));

alter table company_member_invites drop constraint if exists chk_company_member_invites_role;
alter table company_member_invites
  add constraint chk_company_member_invites_role
  check (workspace_role in ('owner','ops','hr','finance','supervisor','auditor'));
