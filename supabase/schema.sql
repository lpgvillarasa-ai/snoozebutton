-- Boss Availability — Supabase schema
-- Run in the Supabase SQL editor (or via supabase db push) on a fresh project.

-- =========================================================================
-- Extensions
-- =========================================================================
create extension if not exists "pgcrypto";

-- =========================================================================
-- Enums
-- =========================================================================
do $$ begin
  create type user_role as enum ('boss', 'admin', 'viewer');
exception when duplicate_object then null; end $$;

do $$ begin
  create type manual_override_kind as enum ('available', 'unavailable');
exception when duplicate_object then null; end $$;

-- =========================================================================
-- users (mirrors auth.users)
-- =========================================================================
create table if not exists public.users (
  id          uuid primary key references auth.users(id) on delete cascade,
  name        text,
  email       text unique not null,
  role        user_role not null default 'viewer',
  created_at  timestamptz not null default now()
);

-- =========================================================================
-- availability_status — one row per boss
-- =========================================================================
create table if not exists public.availability_status (
  id                   uuid primary key default gen_random_uuid(),
  boss_user_id         uuid not null references public.users(id) on delete cascade,
  status_message       text,
  snooze_until         timestamptz,
  calendar_busy_until  timestamptz,
  manual_override      manual_override_kind,
  updated_at           timestamptz not null default now(),
  unique (boss_user_id)
);

-- Note: the effective status is derived from (manual_override, snooze_until,
-- calendar_busy_until) by `resolveStatus()` on read. Do not cache it.

create index if not exists availability_status_boss_idx
  on public.availability_status (boss_user_id);

-- =========================================================================
-- notification_subscriptions — Web Push subscriptions
-- =========================================================================
create table if not exists public.notification_subscriptions (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references public.users(id) on delete cascade,
  subscription_data  jsonb not null,
  endpoint           text generated always as (subscription_data->>'endpoint') stored,
  created_at         timestamptz not null default now(),
  unique (endpoint)
);

create index if not exists notification_subs_user_idx
  on public.notification_subscriptions (user_id);

-- =========================================================================
-- google_calendar_tokens — boss-only, server-side access
-- =========================================================================
create table if not exists public.google_calendar_tokens (
  user_id        uuid primary key references public.users(id) on delete cascade,
  access_token   text not null,
  refresh_token  text,
  expiry_date    bigint,
  scope          text,
  updated_at     timestamptz not null default now()
);

-- =========================================================================
-- Trigger: auto-mirror new auth users into public.users
-- =========================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  boss_emails text := coalesce(current_setting('app.boss_emails', true), '');
  is_boss boolean := position(lower(new.email) in lower(boss_emails)) > 0
                     and length(boss_emails) > 0;
begin
  insert into public.users (id, email, name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    case when is_boss then 'boss'::user_role else 'viewer'::user_role end
  )
  on conflict (id) do update
    set email = excluded.email,
        name  = coalesce(excluded.name, public.users.name);

  -- ensure the boss has an availability row
  if is_boss then
    insert into public.availability_status (boss_user_id)
    values (new.id)
    on conflict (boss_user_id) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =========================================================================
-- Trigger: keep updated_at fresh
-- =========================================================================
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists touch_availability_status on public.availability_status;
create trigger touch_availability_status
  before update on public.availability_status
  for each row execute function public.touch_updated_at();

drop trigger if exists touch_google_tokens on public.google_calendar_tokens;
create trigger touch_google_tokens
  before update on public.google_calendar_tokens
  for each row execute function public.touch_updated_at();

-- =========================================================================
-- Realtime
-- =========================================================================
alter publication supabase_realtime add table public.availability_status;

-- =========================================================================
-- Row Level Security
-- =========================================================================
alter table public.users                       enable row level security;
alter table public.availability_status         enable row level security;
alter table public.notification_subscriptions  enable row level security;
alter table public.google_calendar_tokens      enable row level security;

-- users: anyone signed in can read; nobody can write from the client.
-- Inserts come from the auth.users trigger (security definer); role changes
-- happen via the service-role admin client in /auth/callback.
-- (No update/insert/delete policy = no client write access.)
drop policy if exists "users select all signed in" on public.users;
create policy "users select all signed in"
  on public.users for select
  to authenticated
  using (true);

drop policy if exists "users update own" on public.users;

-- availability_status: any signed-in user can read; only the boss row owner can write.
drop policy if exists "availability read all signed in" on public.availability_status;
create policy "availability read all signed in"
  on public.availability_status for select
  to authenticated
  using (true);

drop policy if exists "availability boss insert own" on public.availability_status;
create policy "availability boss insert own"
  on public.availability_status for insert
  to authenticated
  with check (auth.uid() = boss_user_id);

drop policy if exists "availability boss update own" on public.availability_status;
create policy "availability boss update own"
  on public.availability_status for update
  to authenticated
  using (auth.uid() = boss_user_id);

-- notification_subscriptions: each user manages their own.
drop policy if exists "subs manage own" on public.notification_subscriptions;
create policy "subs manage own"
  on public.notification_subscriptions for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- google_calendar_tokens: never client-readable. Service role only.
-- (no policies = no client access; service role bypasses RLS)

-- ---------------------------------------------------------------------------
-- Data API grants
-- ---------------------------------------------------------------------------
-- Supabase stops giving new tables and functions to the Data API automatically on 2026-10-30.
-- The migrations before this one relied on that, so this file writes the same access down
-- explicitly. Each grant is filled in only when that role has no access to the object yet:
-- on a live database (built under the old rules) it changes nothing, and on a database rebuilt
-- from these files after 2026-10-30 it restores exactly what the live one has from them.
-- `anon` (anyone, not signed in) is only filled in where no role had any access, so access
-- that was tightened by hand on a live database is never reopened.
create temp table api_access_before as
  select c.oid as obj, r.rolname as role
    from pg_class c join pg_namespace n on n.oid = c.relnamespace,
         lateral (select a.grantee from aclexplode(c.relacl) a
                  union select a.grantee from pg_attribute t, aclexplode(t.attacl) a where t.attrelid = c.oid) g
         join pg_roles r on r.oid = g.grantee
   where n.nspname = 'public' and r.rolname in ('anon', 'authenticated', 'service_role')
  union
  select p.oid, r.rolname
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace, aclexplode(p.proacl) a join pg_roles r on r.oid = a.grantee
   where n.nspname = 'public' and r.rolname in ('anon', 'authenticated', 'service_role');

create function pg_temp.fill_api_access(p_obj oid, p_role text, p_stmt text) returns void
language plpgsql as $$
begin
  if p_obj is null then return; end if;  -- object not in this database
  if exists (select 1 from api_access_before where obj = p_obj and role = p_role) then return; end if;
  if p_role = 'anon' and exists (select 1 from api_access_before where obj = p_obj) then return; end if;
  execute p_stmt;
end $$;

select pg_temp.fill_api_access(to_regclass('public.availability_status'), 'anon', 'grant all on public.availability_status to anon');
select pg_temp.fill_api_access(to_regclass('public.availability_status'), 'authenticated', 'grant all on public.availability_status to authenticated');
select pg_temp.fill_api_access(to_regclass('public.availability_status'), 'service_role', 'grant all on public.availability_status to service_role');
select pg_temp.fill_api_access(to_regclass('public.google_calendar_tokens'), 'anon', 'grant all on public.google_calendar_tokens to anon');
select pg_temp.fill_api_access(to_regclass('public.google_calendar_tokens'), 'authenticated', 'grant all on public.google_calendar_tokens to authenticated');
select pg_temp.fill_api_access(to_regclass('public.google_calendar_tokens'), 'service_role', 'grant all on public.google_calendar_tokens to service_role');
select pg_temp.fill_api_access(to_regclass('public.notification_subscriptions'), 'anon', 'grant all on public.notification_subscriptions to anon');
select pg_temp.fill_api_access(to_regclass('public.notification_subscriptions'), 'authenticated', 'grant all on public.notification_subscriptions to authenticated');
select pg_temp.fill_api_access(to_regclass('public.notification_subscriptions'), 'service_role', 'grant all on public.notification_subscriptions to service_role');
select pg_temp.fill_api_access(to_regclass('public.users'), 'anon', 'grant all on public.users to anon');
select pg_temp.fill_api_access(to_regclass('public.users'), 'authenticated', 'grant all on public.users to authenticated');
select pg_temp.fill_api_access(to_regclass('public.users'), 'service_role', 'grant all on public.users to service_role');
select pg_temp.fill_api_access(to_regprocedure('public.handle_new_user()'), 'anon', 'grant execute on function public.handle_new_user() to anon');
select pg_temp.fill_api_access(to_regprocedure('public.handle_new_user()'), 'authenticated', 'grant execute on function public.handle_new_user() to authenticated');
select pg_temp.fill_api_access(to_regprocedure('public.handle_new_user()'), 'service_role', 'grant execute on function public.handle_new_user() to service_role');
select pg_temp.fill_api_access(to_regprocedure('public.touch_updated_at()'), 'anon', 'grant execute on function public.touch_updated_at() to anon');
select pg_temp.fill_api_access(to_regprocedure('public.touch_updated_at()'), 'authenticated', 'grant execute on function public.touch_updated_at() to authenticated');
select pg_temp.fill_api_access(to_regprocedure('public.touch_updated_at()'), 'service_role', 'grant execute on function public.touch_updated_at() to service_role');

drop function pg_temp.fill_api_access(oid, text, text);
drop table api_access_before;
