
create index if not exists idx_departments_parent_same_org
  on public.departments (parent_department_id, organization_id)
  where parent_department_id is not null;

create index if not exists idx_entities_parent_same_org
  on public.corporate_entities (parent_entity_id, organization_id)
  where parent_entity_id is not null;
