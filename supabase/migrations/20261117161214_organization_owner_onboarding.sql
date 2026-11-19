
alter table public.organizations
  add column if not exists created_by uuid references auth.users(id) on delete restrict;

alter table public.organizations
  alter column created_by set not null;

create or replace function private.add_organization_creator_as_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.organization_memberships
    (organization_id, user_id, membership_role, status)
  values
    (new.id, new.created_by, 'owner', 'active');
  return new;
end;
$$;

revoke all on function private.add_organization_creator_as_owner() from public, anon, authenticated;

drop trigger if exists trg_add_organization_creator_as_owner on public.organizations;
create trigger trg_add_organization_creator_as_owner
after insert on public.organizations
for each row execute function private.add_organization_creator_as_owner();

alter policy "members can view their organizations" on public.organizations
  using (private.is_org_member(id) or created_by = (select auth.uid()));

create policy "authenticated users can create their own organization"
on public.organizations
for insert
to authenticated
with check (created_by = (select auth.uid()));
