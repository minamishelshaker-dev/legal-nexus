
grant select, insert, update on
  public.investigation_sessions,
  public.investigation_statements,
  public.investigation_evidence,
  public.investigation_minutes,
  public.investigation_recommendations,
  public.investigation_decisions,
  public.investigation_appeals
to authenticated;
