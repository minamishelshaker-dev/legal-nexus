
create index if not exists idx_inv_statements_session_parent on public.investigation_statements(session_id, investigation_id);
create index if not exists idx_inv_minutes_session_parent on public.investigation_minutes(session_id, investigation_id);
create index if not exists idx_inv_decisions_recommendation_parent on public.investigation_decisions(recommendation_id, investigation_id);

revoke all on public.organization_invitations from public, anon, authenticated;
grant select on public.organization_invitations to authenticated;

revoke all on
  public.investigation_sessions,
  public.investigation_statements,
  public.investigation_evidence,
  public.investigation_minutes,
  public.investigation_recommendations,
  public.investigation_decisions,
  public.investigation_appeals
from public, anon, authenticated;

grant select, insert, update on
  public.investigation_sessions,
  public.investigation_statements,
  public.investigation_evidence,
  public.investigation_minutes,
  public.investigation_recommendations,
  public.investigation_appeals
to authenticated;

grant select, insert on public.investigation_decisions to authenticated;
