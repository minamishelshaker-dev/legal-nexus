
create index if not exists idx_investigations_decision_maker on public.administrative_investigations(decision_maker_user_id);
create index if not exists idx_investigations_investigator on public.administrative_investigations(investigator_user_id);
create index if not exists idx_investigations_org_entity on public.administrative_investigations(organization_id, corporate_entity_id);
create index if not exists idx_audit_actor on public.audit_events(actor_user_id);
create index if not exists idx_contracts_org_entity on public.contracts(organization_id, corporate_entity_id);
create index if not exists idx_contracts_responsible_user on public.contracts(responsible_user_id);
create index if not exists idx_entities_parent on public.corporate_entities(parent_entity_id);
create index if not exists idx_departments_parent on public.departments(parent_department_id);
create index if not exists idx_documents_uploaded_by on public.documents(uploaded_by);
create index if not exists idx_matters_org_entity on public.legal_matters(organization_id, corporate_entity_id);
create index if not exists idx_matters_owner on public.legal_matters(owner_user_id);

drop policy if exists "members can view contracts" on public.contracts;
drop policy if exists "members can view entities" on public.corporate_entities;
drop policy if exists "members can view departments" on public.departments;
drop policy if exists "members can view legal matters" on public.legal_matters;
