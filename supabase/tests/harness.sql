do $$ begin if not exists (select from pg_roles where rolname='anon') then create role anon nologin; end if; if not exists (select from pg_roles where rolname='authenticated') then create role authenticated nologin; end if; end $$;
create schema auth;
create table auth.users (id uuid primary key, email text);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
grant usage on schema auth to anon, authenticated;
grant usage on schema public to anon, authenticated;
-- Supabase gives anon and authenticated full table rights by default and relies on RLS; copy that.
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant all on functions to anon, authenticated;
insert into auth.users values ('11111111-1111-1111-1111-111111111111','owner@x.com'),('22222222-2222-2222-2222-222222222222','member@x.com'),('33333333-3333-3333-3333-333333333333','outsider@x.com');
