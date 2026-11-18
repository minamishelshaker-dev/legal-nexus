create or replace function private.guard_investigation_minutes()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_org uuid;
begin
  if old.status = 'approved' then
    raise exception 'Approved investigation minutes are immutable; create a new version';
  end if;

  if new.investigation_id is distinct from old.investigation_id
     or new.session_id is distinct from old.session_id
     or new.version_no is distinct from old.version_no
     or new.created_by is distinct from old.created_by
     or new.supersedes_id is distinct from old.supersedes_id
     or new.created_at is distinct from old.created_at then
    raise exception 'Investigation minute identity and version lineage cannot be changed';
  end if;

  if old.status = 'submitted' then
    if new.status <> 'approved'
       or new.content is distinct from old.content then
      raise exception 'Submitted investigation minutes are immutable; create a new version';
    end if;
  end if;

  if new.status = 'approved' then
    select organization_id into v_org
    from public.administrative_investigations
    where id = new.investigation_id;

    if not private.has_org_role(v_org, array['owner','admin','legal_manager']) then
      raise exception 'Only legal leadership can approve investigation minutes';
    end if;

    if new.approved_by is distinct from auth.uid() then
      raise exception 'Approver must be the authenticated user';
    end if;

    if new.approved_at is null then
      new.approved_at := now();
    end if;
  elsif new.approved_by is not null or new.approved_at is not null then
    raise exception 'Approval metadata can only be set when approving minutes';
  end if;

  return new;
end;
$function$;
