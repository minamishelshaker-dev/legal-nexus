
create index if not exists idx_job_positions_created_by
 on public.job_positions(created_by);
create index if not exists idx_job_positions_department_org_fk
 on public.job_positions(department_id, organization_id);
create index if not exists idx_position_assignments_assigned_by
 on public.position_assignments(assigned_by);
create index if not exists idx_position_assignments_position_org_fk
 on public.position_assignments(position_id, organization_id);
