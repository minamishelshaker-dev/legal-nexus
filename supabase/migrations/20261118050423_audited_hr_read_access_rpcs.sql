
-- Route sensitive HR reads through audited RPCs rather than direct table SELECT.
revoke select on public.employee_records from authenticated;
revoke select on public.employment_history from authenticated;
revoke select on public.employee_documents from authenticated;
revoke select on public.employee_document_versions from authenticated;

drop policy "HR managers can view employee records" on public.employee_records;
drop policy "HR managers can view employment history" on public.employment_history;
drop policy "HR managers can view employee documents" on public.employee_documents;
drop policy "HR managers can view employee document versions" on public.employee_document_versions;

create or replace function public.list_employee_records(
  p_organization_id uuid,
  p_search text default null,
  p_status text default null,
  p_department_id uuid default null,
  p_limit integer default 100,
  p_offset integer default 0
)
returns setof public.employee_records
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_limit integer := least(greatest(coalesce(p_limit,100),1),200);
  v_offset integer := greatest(coalesce(p_offset,0),0);
begin
  if v_actor is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if not private.has_hr_sensitive_role(p_organization_id) then
    raise exception 'Only authorized HR managers can view employee records' using errcode = '42501';
  end if;

  insert into public.audit_events (
    organization_id, actor_user_id, action, resource_type, resource_id, metadata
  ) values (
    p_organization_id, v_actor, 'hr.employee_records.list_viewed',
    'employee_records', p_organization_id::text,
    jsonb_build_object('search_used', coalesce(p_search,'') <> '',
      'status_filter', p_status, 'department_filter', p_department_id,
      'limit', v_limit, 'offset', v_offset)
  );

  return query
  select e.*
  from public.employee_records e
  where e.organization_id = p_organization_id
    and (p_status is null or e.employment_status = p_status)
    and (p_department_id is null or e.department_id = p_department_id)
    and (
      nullif(trim(p_search),'') is null
      or e.full_name ilike '%' || trim(p_search) || '%'
      or e.employee_number ilike '%' || trim(p_search) || '%'
      or coalesce(e.work_email,'') ilike '%' || trim(p_search) || '%'
    )
  order by e.created_at desc
  limit v_limit offset v_offset;
end;
$function$;

create or replace function public.get_employee_history(
  p_organization_id uuid,
  p_employee_id uuid
)
returns setof public.employment_history
language plpgsql
security definer
set search_path = ''
as $function$
declare v_actor uuid := auth.uid();
begin
  if v_actor is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if not private.has_hr_sensitive_role(p_organization_id) then
    raise exception 'Only authorized HR managers can view employment history' using errcode = '42501';
  end if;
  if not exists (select 1 from public.employee_records e where e.id=p_employee_id and e.organization_id=p_organization_id) then
    raise exception 'Employee not found in this organization' using errcode = 'P0002';
  end if;
  insert into public.audit_events(organization_id,actor_user_id,action,resource_type,resource_id,metadata)
  values(p_organization_id,v_actor,'hr.employee_history.viewed','employee',p_employee_id::text,'{}'::jsonb);
  return query select h.* from public.employment_history h
    where h.organization_id=p_organization_id and h.employee_id=p_employee_id
    order by h.effective_date desc,h.created_at desc;
end;
$function$;

create or replace function public.get_employee_documents(
  p_organization_id uuid,
  p_employee_id uuid
)
returns setof public.employee_documents
language plpgsql
security definer
set search_path = ''
as $function$
declare v_actor uuid := auth.uid();
begin
  if v_actor is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if not private.has_hr_sensitive_role(p_organization_id) then
    raise exception 'Only authorized HR managers can view employee documents' using errcode = '42501';
  end if;
  if not exists (select 1 from public.employee_records e where e.id=p_employee_id and e.organization_id=p_organization_id) then
    raise exception 'Employee not found in this organization' using errcode = 'P0002';
  end if;
  insert into public.audit_events(organization_id,actor_user_id,action,resource_type,resource_id,metadata)
  values(p_organization_id,v_actor,'hr.employee_documents.list_viewed','employee',p_employee_id::text,'{}'::jsonb);
  return query select d.* from public.employee_documents d
    where d.organization_id=p_organization_id and d.employee_id=p_employee_id
    order by d.updated_at desc;
end;
$function$;

create or replace function public.get_employee_document_versions(
  p_organization_id uuid,
  p_employee_document_id uuid
)
returns setof public.employee_document_versions
language plpgsql
security definer
set search_path = ''
as $function$
declare v_actor uuid := auth.uid();
begin
  if v_actor is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if not private.has_hr_sensitive_role(p_organization_id) then
    raise exception 'Only authorized HR managers can view employee document versions' using errcode = '42501';
  end if;
  if not exists (select 1 from public.employee_documents d where d.id=p_employee_document_id and d.organization_id=p_organization_id) then
    raise exception 'Employee document not found in this organization' using errcode = 'P0002';
  end if;
  insert into public.audit_events(organization_id,actor_user_id,action,resource_type,resource_id,metadata)
  values(p_organization_id,v_actor,'hr.employee_document_versions.viewed','employee_document',p_employee_document_id::text,'{}'::jsonb);
  return query select v.* from public.employee_document_versions v
    where v.organization_id=p_organization_id and v.employee_document_id=p_employee_document_id
    order by v.version_number desc;
end;
$function$;

revoke all on function public.list_employee_records(uuid,text,text,uuid,integer,integer) from public,anon;
revoke all on function public.get_employee_history(uuid,uuid) from public,anon;
revoke all on function public.get_employee_documents(uuid,uuid) from public,anon;
revoke all on function public.get_employee_document_versions(uuid,uuid) from public,anon;
grant execute on function public.list_employee_records(uuid,text,text,uuid,integer,integer) to authenticated;
grant execute on function public.get_employee_history(uuid,uuid) to authenticated;
grant execute on function public.get_employee_documents(uuid,uuid) to authenticated;
grant execute on function public.get_employee_document_versions(uuid,uuid) to authenticated;
