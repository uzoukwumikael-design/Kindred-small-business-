-- Kindling: run this once in the Supabase SQL editor (Dashboard > SQL Editor > New query > paste > Run).
-- One row per signed-in user holds their saved week. Row Level Security means a signed-in user can only
-- ever read or change their own row, even though the app talks to the database straight from the browser.

create table if not exists public.kindling_state (
  user_id uuid primary key references auth.users (id) on delete cascade,
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  constraint kindling_state_size check (octet_length(state::text) < 200000)
);

-- Safe to run again on a table you already created: adds the version counter used to detect edits from two devices.
alter table public.kindling_state add column if not exists version integer not null default 1;

alter table public.kindling_state enable row level security;

drop policy if exists "kindling_select_own" on public.kindling_state;
drop policy if exists "kindling_insert_own" on public.kindling_state;
drop policy if exists "kindling_update_own" on public.kindling_state;
drop policy if exists "kindling_delete_own" on public.kindling_state;

create policy "kindling_select_own" on public.kindling_state
  for select to authenticated using ((select auth.uid()) = user_id);

create policy "kindling_insert_own" on public.kindling_state
  for insert to authenticated with check ((select auth.uid()) = user_id);

create policy "kindling_update_own" on public.kindling_state
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "kindling_delete_own" on public.kindling_state
  for delete to authenticated using ((select auth.uid()) = user_id);


-- ====================================================================================================
-- Crews: several signed-in people edit one shared week.
-- Rules: every member can edit the shared week. Only the owner can invite, rename, remove people or delete.
-- Nothing is written to these tables directly except the shared week itself; everything else goes through
-- the functions below, which check who is asking.
-- ====================================================================================================

create table if not exists public.kindling_teams (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'My crew' check (char_length(name) between 1 and 60),
  owner_id uuid not null references auth.users (id) on delete cascade,
  invite_code text not null unique default replace(gen_random_uuid()::text, '-', ''),
  state jsonb not null default '{}'::jsonb,
  version integer not null default 1,
  updated_at timestamptz not null default now(),
  constraint kindling_teams_size check (octet_length(state::text) < 200000)
);

create table if not exists public.kindling_members (
  team_id uuid not null references public.kindling_teams (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  email text not null default '',
  joined_at timestamptz not null default now(),
  primary key (team_id, user_id)
);

create index if not exists kindling_members_user_idx on public.kindling_members (user_id);

alter table public.kindling_teams enable row level security;
alter table public.kindling_members enable row level security;

-- Checks membership without tripping over the members table's own security rules.
create or replace function public.is_team_member(t uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.kindling_members m
    where m.team_id = t and m.user_id = (select auth.uid())
  );
$$;

drop policy if exists "teams_select_member" on public.kindling_teams;
drop policy if exists "teams_update_member" on public.kindling_teams;
drop policy if exists "members_select_teammates" on public.kindling_members;

create policy "teams_select_member" on public.kindling_teams
  for select to authenticated using (public.is_team_member(id));

create policy "teams_update_member" on public.kindling_teams
  for update to authenticated
  using (public.is_team_member(id))
  with check (public.is_team_member(id));

create policy "members_select_teammates" on public.kindling_members
  for select to authenticated using (public.is_team_member(team_id));

-- Members may read the shared week and change only the week itself. The invite code, owner and name
-- are not readable or writable directly, so a member cannot hand out invites or take over the crew.
revoke all on public.kindling_teams from anon, authenticated;
revoke all on public.kindling_members from anon, authenticated;
grant select (id, name, owner_id, state, version, updated_at) on public.kindling_teams to authenticated;
grant update (state, version, updated_at) on public.kindling_teams to authenticated;
grant select on public.kindling_members to authenticated;

create or replace function public.create_team(team_name text, initial_state jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := (select auth.uid());
  new_id uuid;
begin
  if uid is null then raise exception 'sign in first' using errcode = '28000'; end if;
  if (select count(*) from public.kindling_teams where owner_id = uid) >= 5 then
    raise exception 'you can own up to 5 crews' using errcode = 'P0001';
  end if;
  insert into public.kindling_teams (name, owner_id, state)
  values (left(coalesce(nullif(trim(team_name), ''), 'My crew'), 60), uid, coalesce(initial_state, '{}'::jsonb))
  returning id into new_id;
  insert into public.kindling_members (team_id, user_id, email)
  values (new_id, uid, coalesce((select auth.jwt()) ->> 'email', ''));
  return new_id;
end;
$$;

create or replace function public.join_team(code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := (select auth.uid());
  t uuid;
begin
  if uid is null then raise exception 'sign in first' using errcode = '28000'; end if;
  select id into t from public.kindling_teams where invite_code = code;
  if t is null then raise exception 'that invite link is not valid any more' using errcode = 'P0002'; end if;
  if (select count(*) from public.kindling_members where team_id = t) >= 20
     and not exists (select 1 from public.kindling_members where team_id = t and user_id = uid) then
    raise exception 'this crew is full' using errcode = 'P0001';
  end if;
  insert into public.kindling_members (team_id, user_id, email)
  values (t, uid, coalesce((select auth.jwt()) ->> 'email', ''))
  on conflict (team_id, user_id) do nothing;
  return t;
end;
$$;

create or replace function public.get_invite(t uuid)
returns text
language plpgsql
security definer
stable
set search_path = public
as $$
declare code text;
begin
  select invite_code into code from public.kindling_teams where id = t and owner_id = (select auth.uid());
  if code is null then raise exception 'only the owner can see the invite link' using errcode = '42501'; end if;
  return code;
end;
$$;

create or replace function public.regenerate_invite(t uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare code text := replace(gen_random_uuid()::text, '-', '');
begin
  update public.kindling_teams set invite_code = code where id = t and owner_id = (select auth.uid());
  if not found then raise exception 'only the owner can change the invite link' using errcode = '42501'; end if;
  return code;
end;
$$;

create or replace function public.rename_team(t uuid, new_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.kindling_teams
  set name = left(coalesce(nullif(trim(new_name), ''), 'My crew'), 60)
  where id = t and owner_id = (select auth.uid());
  if not found then raise exception 'only the owner can rename the crew' using errcode = '42501'; end if;
end;
$$;

create or replace function public.remove_member(t uuid, member uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare uid uuid := (select auth.uid());
begin
  if not exists (select 1 from public.kindling_teams where id = t and owner_id = uid) then
    raise exception 'only the owner can remove people' using errcode = '42501';
  end if;
  if member = uid then raise exception 'the owner cannot be removed' using errcode = 'P0001'; end if;
  delete from public.kindling_members where team_id = t and user_id = member;
end;
$$;

create or replace function public.leave_team(t uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare uid uuid := (select auth.uid());
begin
  if exists (select 1 from public.kindling_teams where id = t and owner_id = uid) then
    raise exception 'the owner cannot leave. Delete the crew instead.' using errcode = 'P0001';
  end if;
  delete from public.kindling_members where team_id = t and user_id = uid;
end;
$$;

create or replace function public.delete_team(t uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.kindling_teams where id = t and owner_id = (select auth.uid());
  if not found then raise exception 'only the owner can delete the crew' using errcode = '42501'; end if;
end;
$$;

-- Only signed-in people may call these.
revoke all on function public.create_team(text, jsonb), public.join_team(text), public.get_invite(uuid),
  public.regenerate_invite(uuid), public.rename_team(uuid, text), public.remove_member(uuid, uuid),
  public.leave_team(uuid), public.delete_team(uuid), public.is_team_member(uuid) from public, anon;
grant execute on function public.create_team(text, jsonb), public.join_team(text), public.get_invite(uuid),
  public.regenerate_invite(uuid), public.rename_team(uuid, text), public.remove_member(uuid, uuid),
  public.leave_team(uuid), public.delete_team(uuid), public.is_team_member(uuid) to authenticated;


-- ====================================================================================================
-- Weekly summary email: opt-in preferences.
-- A person turns it on themselves (never on by default). The daily job that sends the emails runs on your
-- server with the service role key, so people cannot edit when an email was last sent.
-- ====================================================================================================

create table if not exists public.kindling_prefs (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text not null check (char_length(email) between 3 and 254),
  weekly_email boolean not null default false,
  weekday smallint not null default 1 check (weekday between 0 and 6), -- 0 = Sunday ... 6 = Saturday
  consented_at timestamptz,
  last_sent_on date,
  last_kind text,
  updated_at timestamptz not null default now()
);

alter table public.kindling_prefs enable row level security;

drop policy if exists "prefs_select_own" on public.kindling_prefs;
drop policy if exists "prefs_insert_own" on public.kindling_prefs;
drop policy if exists "prefs_update_own" on public.kindling_prefs;
drop policy if exists "prefs_delete_own" on public.kindling_prefs;

create policy "prefs_select_own" on public.kindling_prefs
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "prefs_insert_own" on public.kindling_prefs
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "prefs_update_own" on public.kindling_prefs
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "prefs_delete_own" on public.kindling_prefs
  for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on public.kindling_prefs from anon, authenticated;
grant select, delete on public.kindling_prefs to authenticated;
grant insert (user_id, email, weekly_email, weekday, consented_at, updated_at) on public.kindling_prefs to authenticated;
grant update (email, weekly_email, weekday, consented_at, updated_at) on public.kindling_prefs to authenticated;


-- ====================================================================================================
-- Training data layer (opt-in).
-- Someone must switch it on in their account, and then share examples one at a time after seeing exactly what
-- will be sent. Private-looking details and names are masked before anything leaves their browser.
-- Rules enforced here, not only in the app:
--   * a row can be added only by a person who has consented, and only for themselves, up to 200 rows
--   * people can read and delete their own rows, never edit them
--   * turning consent off deletes all of that person's rows, and so does deleting their account
-- The export script reads this table with the service role key. Nobody else can.
-- ====================================================================================================

create table if not exists public.kindling_training_consent (
  user_id uuid primary key references auth.users (id) on delete cascade,
  consented boolean not null default false,
  consented_at timestamptz,
  policy_version smallint not null default 1,
  updated_at timestamptz not null default now()
);

create table if not exists public.kindling_training_examples (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  workflow text not null check (char_length(workflow) between 1 and 40),
  channel text not null check (channel in ('whatsapp', 'text', 'email', 'dm')),
  language text not null check (language in ('english', 'pidgin', 'yoruba', 'igbo', 'hausa', 'match')),
  note text not null check (char_length(note) between 8 and 1500),
  draft text not null check (char_length(draft) <= 6000),
  final text not null check (char_length(final) between 2 and 6000),
  facts_used text[] not null default '{}' check (cardinality(facts_used) <= 12),
  needs text[] not null default '{}' check (cardinality(needs) <= 12),
  brackets_before smallint not null default 0 check (brackets_before between 0 and 50),
  issues smallint not null default 0 check (issues between 0 and 50),
  edit_ratio real check (edit_ratio between 0 and 1),
  source text not null check (source in ('live', 'template'))
);

create index if not exists kindling_training_examples_user_idx on public.kindling_training_examples (user_id);

alter table public.kindling_training_consent enable row level security;
alter table public.kindling_training_examples enable row level security;

create or replace function public.has_training_consent()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(
    (select c.consented from public.kindling_training_consent c where c.user_id = (select auth.uid())),
    false
  );
$$;

create or replace function public.training_example_count()
returns bigint
language sql
security definer
stable
set search_path = public
as $$
  select count(*) from public.kindling_training_examples where user_id = (select auth.uid());
$$;

drop policy if exists "consent_select_own" on public.kindling_training_consent;
drop policy if exists "consent_insert_own" on public.kindling_training_consent;
drop policy if exists "consent_update_own" on public.kindling_training_consent;
drop policy if exists "consent_delete_own" on public.kindling_training_consent;
drop policy if exists "examples_select_own" on public.kindling_training_examples;
drop policy if exists "examples_insert_consented" on public.kindling_training_examples;
drop policy if exists "examples_delete_own" on public.kindling_training_examples;

create policy "consent_select_own" on public.kindling_training_consent
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "consent_insert_own" on public.kindling_training_consent
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "consent_update_own" on public.kindling_training_consent
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "consent_delete_own" on public.kindling_training_consent
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy "examples_select_own" on public.kindling_training_examples
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "examples_insert_consented" on public.kindling_training_examples
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and public.has_training_consent()
    and public.training_example_count() < 200
  );
create policy "examples_delete_own" on public.kindling_training_examples
  for delete to authenticated using ((select auth.uid()) = user_id);

-- Withdrawing consent deletes everything that person shared, even if their browser never asks.
create or replace function public.forget_training_examples()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.consented is false then
    delete from public.kindling_training_examples where user_id = new.user_id;
  end if;
  return new;
end;
$$;

drop trigger if exists kindling_forget_on_withdraw on public.kindling_training_consent;
create trigger kindling_forget_on_withdraw
  after insert or update of consented on public.kindling_training_consent
  for each row execute function public.forget_training_examples();

revoke all on public.kindling_training_consent from anon, authenticated;
revoke all on public.kindling_training_examples from anon, authenticated;
grant select, delete on public.kindling_training_consent to authenticated;
grant insert (user_id, consented, consented_at, policy_version, updated_at) on public.kindling_training_consent to authenticated;
grant update (consented, consented_at, policy_version, updated_at) on public.kindling_training_consent to authenticated;
grant select, delete on public.kindling_training_examples to authenticated;
grant insert (user_id, workflow, channel, language, note, draft, final, facts_used, needs, brackets_before, issues, edit_ratio, source)
  on public.kindling_training_examples to authenticated;
revoke all on function public.has_training_consent(), public.training_example_count() from public, anon;
grant execute on function public.has_training_consent(), public.training_example_count() to authenticated;


-- ====================================================================================================
-- Usage counts: how often each feature is used per day. No user id, no IP address, nothing identifying.
-- Only the server (service role) can add or read them.
-- ====================================================================================================

create table if not exists public.kindling_event_counts (
  day date not null default (now() at time zone 'utc')::date,
  event text not null check (event in (
    'visit','pricing_view','quick_draft','week_built','draft_created','send_clicked','example_kept',
    'account_created','crew_created','weekly_email_on','install_accepted','feedback_sent')),
  count bigint not null default 0,
  primary key (day, event)
);

alter table public.kindling_event_counts enable row level security;
revoke all on public.kindling_event_counts from anon, authenticated;

create or replace function public.bump_event(ev text)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.kindling_event_counts (day, event, count)
  values ((now() at time zone 'utc')::date, ev, 1)
  on conflict (day, event) do update set count = public.kindling_event_counts.count + 1;
$$;

revoke all on function public.bump_event(text) from public, anon, authenticated;
