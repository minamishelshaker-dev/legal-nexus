
alter table public.departments
  drop constraint if exists departments_parent_department_id_fkey;

alter table public.departments
  add constraint departments_parent_department_same_org_fkey
  foreign key (parent_department_id, organization_id)
  references public.departments (id, organization_id)
  on delete set null (parent_department_id);

alter table public.corporate_entities
  drop constraint if exists corporate_entities_parent_entity_id_fkey;

alter table public.corporate_entities
  add constraint corporate_entities_parent_entity_same_org_fkey
  foreign key (parent_entity_id, organization_id)
  references public.corporate_entities (id, organization_id)
  on delete set null (parent_entity_id);
