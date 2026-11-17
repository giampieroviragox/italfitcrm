-- Google Calendar integration and team agenda. All three tables are reachable
-- only by the application server (service role); signed-in users have no
-- direct access.

-- One Google connection per team member. The refresh token is encrypted by the
-- application (AES-GCM) before it is stored.
create table public.crm_google_connections (
  admin_id text primary key references public.crm_admins(id) on delete cascade,
  google_email text not null,
  calendar_id text not null default 'primary',
  calendar_name text,
  refresh_token text not null,
  connected_at timestamptz not null default now(),
  last_sync_at timestamptz,
  last_error text
);

-- Which Google event mirrors which CRM item in a member's calendar, with a hash
-- of the last content written, so updates and deletions never duplicate events.
create table public.crm_google_links (
  admin_id text not null references public.crm_google_connections(admin_id) on delete cascade,
  ref text not null,
  google_event_id text not null,
  hash text not null,
  primary key (admin_id, ref)
);

-- Team agenda: calls and appointments between team members.
create table public.crm_events (
  id text primary key,
  payload jsonb not null check (payload->>'id' = id)
);

do $$ declare t text; begin
 foreach t in array array['crm_google_connections','crm_google_links','crm_events'] loop
  execute format('alter table public.%I enable row level security', t);
  execute format('revoke all on public.%I from anon, authenticated', t);
  execute format('grant all on public.%I to service_role', t);
 end loop;
end $$;
