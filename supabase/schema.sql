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
  create type effective_status as enum ('available', 'unavailable', 'snoozed', 'calendar_busy');
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
  current_status       effective_status not null default 'available',
  status_message       text,
  snooze_until         timestamptz,
  calendar_busy_until  timestamptz,
  manual_override      manual_override_kind,
  updated_at           timestamptz not null default now(),
  unique (boss_user_id)
);

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
    insert into public.availability_status (boss_user_id, current_status)
    values (new.id, 'available')
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

-- users: anyone signed in can read; user can update own row.
drop policy if exists "users select all signed in" on public.users;
create policy "users select all signed in"
  on public.users for select
  to authenticated
  using (true);

drop policy if exists "users update own" on public.users;
create policy "users update own"
  on public.users for update
  to authenticated
  using (auth.uid() = id);

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
