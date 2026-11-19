
alter policy "users can view own profile" on public.user_profiles
  using (id = (select auth.uid()));
alter policy "users can insert own profile" on public.user_profiles
  with check (id = (select auth.uid()));
alter policy "users can update own profile" on public.user_profiles
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));
