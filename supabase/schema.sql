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

-- Collaborators invited onto a project. role='editor' can read/write everything
-- except renaming/deleting the project or managing who's invited; role='viewer'
-- can only read. This table (and the policies below that reference it) is what
-- makes shared projects possible — see invite_member() further down.
create table if not exists public.project_members (
  project_id text not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  role text not null check (role in ('editor', 'viewer')),
  added_at timestamptz not null default now(),
  primary key (project_id, user_id)
);
create index if not exists project_members_user_id_idx on public.project_members(user_id);
alter table public.project_members enable row level security;

create policy "Owners and members can view membership"
  on public.project_members for select
  using (
    auth.uid() = user_id
    or exists (select 1 from public.projects p where p.id = project_members.project_id and p.user_id = auth.uid())
  );

create policy "Owners manage membership"
  on public.project_members for insert
  with check (exists (select 1 from public.projects p where p.id = project_members.project_id and p.user_id = auth.uid()));

create policy "Owners update membership"
  on public.project_members for update
  using (exists (select 1 from public.projects p where p.id = project_members.project_id and p.user_id = auth.uid()))
  with check (exists (select 1 from public.projects p where p.id = project_members.project_id and p.user_id = auth.uid()));

create policy "Owners remove members, members remove themselves"
  on public.project_members for delete
  using (
    auth.uid() = user_id
    or exists (select 1 from public.projects p where p.id = project_members.project_id and p.user_id = auth.uid())
  );

-- Superseded by the membership-aware policies below (dropped so re-running
-- this script against an already-set-up project doesn't leave redundant
-- owner-only policies sitting alongside the new ones).
drop policy if exists "Users can view their own projects" on public.projects;
drop policy if exists "Users can update their own projects" on public.projects;
drop policy if exists "Users can delete their own projects" on public.projects;

create policy "Owners and members can view projects"
  on public.projects for select
  using (
    auth.uid() = user_id
    or exists (select 1 from public.project_members pm where pm.project_id = projects.id and pm.user_id = auth.uid())
  );

create policy "Users can insert their own projects"
  on public.projects for insert
  with check (auth.uid() = user_id);

create policy "Owners and editors can update projects"
  on public.projects for update
  using (
    auth.uid() = user_id
    or exists (select 1 from public.project_members pm where pm.project_id = projects.id and pm.user_id = auth.uid() and pm.role = 'editor')
  )
  with check (
    auth.uid() = user_id
    or exists (select 1 from public.project_members pm where pm.project_id = projects.id and pm.user_id = auth.uid() and pm.role = 'editor')
  );

create policy "Only owners can delete projects"
  on public.projects for delete
  using (auth.uid() = user_id);

-- Upserts a project without ever changing its owner (user_id) on conflict — the
-- client used to do a raw upsert that always set user_id to the CURRENT caller,
-- which would silently reassign ownership if a collaborator ever saved a shared
-- project. security invoker (the default) means RLS above still applies per-caller.
create or replace function public.upsert_project(p_id text, p_name text, p_type text, p_data jsonb)
returns void
language plpgsql
set search_path = public
as $$
begin
  insert into public.projects (id, user_id, name, type, data, updated_at)
  values (p_id, auth.uid(), p_name, p_type, p_data, now())
  on conflict (id) do update set
    name = excluded.name,
    type = excluded.type,
    data = excluded.data,
    updated_at = now();
end;
$$;

-- Invites an existing Trackline account (by email) onto a project as an editor
-- or viewer. security definer is required here to look up auth.users by email,
-- which regular roles can't query directly — this is Supabase's documented
-- pattern for email-based invites. No email is sent; the invitee must already
-- have an account (consistent with the rest of this app having no email service).
create or replace function public.invite_member(p_project_id text, p_email text, p_role text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target_user_id uuid;
  is_owner boolean;
begin
  if p_role not in ('editor', 'viewer') then
    return jsonb_build_object('error', 'Invalid role.');
  end if;

  select exists(select 1 from public.projects where id = p_project_id and user_id = auth.uid()) into is_owner;
  if not is_owner then
    return jsonb_build_object('error', 'Only the project owner can invite collaborators.');
  end if;

  select id into target_user_id from auth.users where lower(email) = lower(p_email) limit 1;
  if target_user_id is null then
    return jsonb_build_object('error', 'No Trackline account found for that email — ask them to sign up first, then invite them.');
  end if;

  if target_user_id = auth.uid() then
    return jsonb_build_object('error', 'You already own this project.');
  end if;

  insert into public.project_members (project_id, user_id, email, role)
  values (p_project_id, target_user_id, lower(p_email), p_role)
  on conflict (project_id, user_id) do update set role = excluded.role;

  return jsonb_build_object('ok', true);
end;
$$;

-- Live sync: lets collaborators see each other's changes without a manual reload.
-- Wrapped so re-running this script is safe (ALTER PUBLICATION ... ADD TABLE
-- errors if the table is already in the publication).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'projects'
  ) then
    alter publication supabase_realtime add table public.projects;
  end if;
end;
$$;

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
