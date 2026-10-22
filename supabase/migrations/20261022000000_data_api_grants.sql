-- Supabase stops giving new tables and functions to the Data API automatically on 2026-10-30:
-- tables keep only TRUNCATE/REFERENCES/TRIGGER, sequences lose USAGE/SELECT and functions lose
-- EXECUTE (even for PUBLIC). The migrations before this one relied on the automatic grants, so this
-- writes the access they produced down explicitly.
--
-- It only runs on a database built under the new rules. The signal: the tables below got
-- service_role access only from the automatic grants, so on any database built before the change
-- (every live one) service_role can read them, and nothing here runs. Access tightened by hand on a
-- live database is therefore never touched. On a rebuild it restores exactly what the old rules gave.
do $$
begin
  if exists (
    select 1 from unnest(array['public.availability_status', 'public.google_calendar_tokens', 'public.notification_subscriptions', 'public.users']) as t(name)
    where to_regclass(t.name) is null or has_table_privilege('service_role', t.name, 'select')
  ) then
    raise notice 'Data API grants: database built under the automatic grants, nothing to do';
    return;
  end if;
  grant all on public.availability_status to anon, authenticated, service_role;
  grant all on public.google_calendar_tokens to anon, authenticated, service_role;
  grant all on public.notification_subscriptions to anon, authenticated, service_role;
  grant all on public.users to anon, authenticated, service_role;
  grant execute on function public.handle_new_user() to anon, authenticated, public, service_role;
  grant execute on function public.touch_updated_at() to anon, authenticated, public, service_role;
end $$;
