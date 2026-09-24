-- Trackline — Supabase schema
-- Run this once in your Supabase project's SQL editor (Project → SQL Editor → New query).

-- One row per project. The whole project (charts, chat log, etc.) is stored as
-- a single jsonb blob in `data`, mirroring the shape already used in the
-- browser's localStorage — see newProjectState() in app.js.
create table if not exists public.projects (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  type text,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
create index if not exists projects_user_id_idx on public.projects(user_id);

alter table public.projects enable row level security;

create policy "Users can view their own projects"
  on public.projects for select
  using (auth.uid() = user_id);

create policy "Users can insert their own projects"
  on public.projects for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own projects"
  on public.projects for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own projects"
  on public.projects for delete
  using (auth.uid() = user_id);

-- Tracks how many chat/AI-assistant requests each user has made today.
-- No client-facing RLS policy — this table is only touched server-side
-- (api/chat.js) using the service role key, which bypasses RLS.
create table if not exists public.chat_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null default current_date,
  count int not null default 0,
  primary key (user_id, day)
);
alter table public.chat_usage enable row level security;

-- Atomically increments today's usage count and reports the new count plus
-- whether the user is still within their daily limit. `security definer` lets
-- it write to chat_usage even though RLS on that table has no policies for
-- normal roles; it's only ever invoked by the serverless function with the
-- service role key.
drop function if exists public.increment_chat_usage(uuid, int);
create function public.increment_chat_usage(p_user_id uuid, p_limit int)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_count int;
begin
  insert into public.chat_usage (user_id, day, count)
  values (p_user_id, current_date, 1)
  on conflict (user_id, day)
  do update set count = chat_usage.count + 1
  returning count into current_count;

  return jsonb_build_object('count', current_count, 'allowed', current_count <= p_limit);
end;
$$;

-- Read-only lookup of today's usage count, without incrementing it — used to
-- show a usage bar in the UI before the user has sent a message today.
create or replace function public.get_chat_usage(p_user_id uuid)
returns int
language sql
security definer
set search_path = public
as $$
  select coalesce((select count from public.chat_usage where user_id = p_user_id and day = current_date), 0);
$$;

-- Extra abuse-prevention layer: caps AI assistant requests per IP address over
-- a rolling 7-day window, independent of the per-account cap above, so
-- spinning up multiple accounts from the same connection doesn't bypass the
-- per-account limit. One row per request (not one row per IP+day) so the
-- window can slide continuously rather than resetting at a fixed boundary.
create table if not exists public.chat_usage_ip (
  id bigserial primary key,
  ip text not null,
  created_at timestamptz not null default now()
);
create index if not exists chat_usage_ip_ip_idx on public.chat_usage_ip(ip, created_at);
alter table public.chat_usage_ip enable row level security;

create or replace function public.increment_ip_usage(p_ip text, p_limit int, p_window_days int default 7)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_count int;
begin
  -- Opportunistic cleanup: drop rows outside anyone's window so this table doesn't grow unbounded.
  delete from public.chat_usage_ip where created_at < now() - ((p_window_days + 1) || ' days')::interval;

  insert into public.chat_usage_ip (ip) values (p_ip);

  select count(*) into current_count
  from public.chat_usage_ip
  where ip = p_ip and created_at >= now() - (p_window_days || ' days')::interval;

  return jsonb_build_object('count', current_count, 'allowed', current_count <= p_limit);
end;
$$;
