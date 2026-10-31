-- Dedicated, single-organization CRM. All writes run through the authenticated
-- application server and a compare-and-swap transaction; no public write API.
create table public.crm_access (
 user_id uuid primary key references auth.users(id) on delete cascade,
 role text not null check(role in ('owner','admin','student')),
 record_id text not null,
 active boolean not null default true,
 invited_at timestamptz not null default now(),
 accepted_at timestamptz,
 unique(role,record_id)
);
create unique index crm_one_owner on public.crm_access(role) where role='owner';
create table public.crm_meta (id integer primary key check(id=1), revision bigint not null default 0, updated_at timestamptz not null default now());
insert into public.crm_meta(id) values(1);
create table public.crm_tiers(id text primary key, payload jsonb not null check(payload->>'id'=id));
create table public.crm_properties(id text primary key, payload jsonb not null check(payload->>'id'=id));
create table public.crm_admins(id text primary key, payload jsonb not null check(payload->>'id'=id));
create table public.crm_students(
 id text primary key,payload jsonb not null check(payload->>'id'=id),
 tier_id text generated always as(payload->>'tierId') stored not null references public.crm_tiers(id),
 email text generated always as(lower(trim(payload->>'email'))) stored not null unique
);
create index crm_students_tier on public.crm_students(tier_id);
create unique index crm_admin_email on public.crm_admins(lower(trim(payload->>'email')));
create table public.crm_property_values(student_id text references public.crm_students(id),property_id text references public.crm_properties(id),value jsonb not null,primary key(student_id,property_id));
create index crm_values_property on public.crm_property_values(property_id);
create table public.crm_notes(id text primary key,student_id text not null references public.crm_students(id),payload jsonb not null);
create index crm_notes_student on public.crm_notes(student_id);
create table public.crm_activities(id text primary key,student_id text not null references public.crm_students(id),payload jsonb not null);
create index crm_activities_student on public.crm_activities(student_id);
create table public.crm_plans(id text primary key,payload jsonb not null check(payload->>'id'=id));
create table public.crm_assignments(
 id text primary key,payload jsonb not null check(payload->>'id'=id),
 student_id text generated always as(payload->>'studentId') stored not null references public.crm_students(id),
 plan_id text generated always as(payload->>'planId') stored not null references public.crm_plans(id),
 month text generated always as(payload->>'month') stored not null check(month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
 unique(student_id,month)
);
create index crm_assignments_plan on public.crm_assignments(plan_id);
create table public.crm_lessons(id text primary key,payload jsonb not null check(payload->>'id'=id));
create table public.crm_bookings(
 id text primary key,payload jsonb not null check(payload->>'id'=id),
 student_id text generated always as(payload->>'studentId') stored not null references public.crm_students(id),
 lesson_id text generated always as(payload->>'lessonId') stored not null references public.crm_lessons(id),
 unique(student_id,lesson_id)
);
create index crm_bookings_lesson on public.crm_bookings(lesson_id);
create table public.crm_preferences(user_id uuid primary key references auth.users(id) on delete cascade,payload jsonb not null default '{}');

alter table public.crm_access enable row level security;
create policy access_self_read on public.crm_access for select to authenticated using(user_id=(select auth.uid()));
grant select on public.crm_access to authenticated;
revoke all on public.crm_access from anon;
alter table public.crm_preferences enable row level security;
create policy preferences_self_read on public.crm_preferences for select to authenticated using(user_id=(select auth.uid()));
grant select on public.crm_preferences to authenticated;
revoke all on public.crm_preferences from anon;
-- Internal CRM rows contain notes and contact information. Only staff may read
-- them directly. Student endpoints return a separate, minimal projection.
do $$ declare t text; begin
 foreach t in array array['crm_meta','crm_tiers','crm_properties','crm_admins','crm_students','crm_property_values','crm_notes','crm_activities','crm_plans','crm_assignments','crm_lessons','crm_bookings'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from anon, authenticated',t);
 execute format('grant select on public.%I to authenticated',t);
 execute format('create policy staff_read on public.%I for select to authenticated using (exists(select 1 from public.crm_access a where a.user_id=(select auth.uid()) and a.active and a.role in (''owner'',''admin'')))',t);
 end loop;
end $$;
revoke insert,update,delete on public.crm_access,public.crm_preferences from authenticated;
grant all on all tables in schema public to service_role;

create function public.crm_read(p_actor uuid) returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('revision',(select revision from public.crm_meta where id=1),'state',
 jsonb_build_object(
 'version',1,
 'students',coalesce((select jsonb_agg(s.payload || jsonb_build_object(
 'properties',coalesce((select jsonb_object_agg(v.property_id,v.value) from public.crm_property_values v where v.student_id=s.id),'{}'::jsonb),
 'notes',coalesce((select jsonb_agg(n.payload order by n.payload->>'createdAt',n.id) from public.crm_notes n where n.student_id=s.id),'[]'::jsonb),
 'history',coalesce((select jsonb_agg(h.payload order by h.payload->>'createdAt',h.id) from public.crm_activities h where h.student_id=s.id),'[]'::jsonb),
 'access',(select jsonb_build_object('status',case when a.accepted_at is null then 'invited' else 'active' end,'invitedAt',a.invited_at) from public.crm_access a where a.record_id=s.id and a.role='student' and a.active)
 ) order by s.payload->>'joinedAt' desc,s.id) from public.crm_students s),'[]'::jsonb),
 'admins',coalesce((select jsonb_agg(x.payload || jsonb_build_object('access',(select jsonb_build_object('status',case when a.accepted_at is null then 'invited' else 'active' end,'invitedAt',a.invited_at) from public.crm_access a where a.record_id=x.id and a.role in ('owner','admin') and a.active)) order by x.id) from public.crm_admins x),'[]'::jsonb),
 'tiers',coalesce((select jsonb_agg(payload order by id) from public.crm_tiers),'[]'::jsonb),
 'properties',coalesce((select jsonb_agg(payload order by id) from public.crm_properties),'[]'::jsonb),
 'plans',coalesce((select jsonb_agg(payload order by id) from public.crm_plans),'[]'::jsonb),
 'assignments',coalesce((select jsonb_agg(payload order by id) from public.crm_assignments),'[]'::jsonb),
 'lessons',coalesce((select jsonb_agg(payload order by id) from public.crm_lessons),'[]'::jsonb),
 'bookings',coalesce((select jsonb_agg(payload order by id) from public.crm_bookings),'[]'::jsonb)
 ) || coalesce((select payload from public.crm_preferences where user_id=p_actor),'{}'::jsonb));
$$;
revoke all on function public.crm_read(uuid) from public,anon,authenticated;
grant execute on function public.crm_read(uuid) to service_role;

create function public.crm_write(p_actor uuid,p_expected bigint,p_state jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
declare revision_now bigint; c text; table_name text; student jsonb; item jsonb; property record; begin
 if not exists(select 1 from public.crm_access where user_id=p_actor and active) then raise exception 'Accesso negato' using errcode='42501';end if;
 select revision into revision_now from public.crm_meta where id=1 for update;
 if revision_now<>p_expected then raise exception 'Il CRM è stato aggiornato altrove. Ricarica e riprova.' using errcode='40001';end if;
 for c,table_name in values ('tiers','crm_tiers'),('properties','crm_properties'),('admins','crm_admins'),('plans','crm_plans'),('lessons','crm_lessons') loop
 execute format('insert into public.%I(id,payload) select x->>''id'',x-''access'' from jsonb_array_elements($1) x on conflict(id) do update set payload=excluded.payload where %I.payload is distinct from excluded.payload',table_name,table_name) using coalesce(p_state->c,'[]'::jsonb);
 end loop;
 for student in select * from jsonb_array_elements(p_state->'students') loop
 insert into public.crm_students(id,payload) values(student->>'id',student-'properties'-'notes'-'history'-'access') on conflict(id) do update set payload=excluded.payload where crm_students.payload is distinct from excluded.payload;
 delete from public.crm_property_values where student_id=student->>'id' and not ((student->'properties') ? property_id);
 for property in select * from jsonb_each(student->'properties') loop
 insert into public.crm_property_values(student_id,property_id,value) values(student->>'id',property.key,property.value) on conflict(student_id,property_id) do update set value=excluded.value where crm_property_values.value is distinct from excluded.value;
 end loop;
 for item in select * from jsonb_array_elements(coalesce(student->'notes','[]'::jsonb)) loop
 insert into public.crm_notes(id,student_id,payload) values(item->>'id',student->>'id',item) on conflict(id) do nothing;
 end loop;
 for item in select * from jsonb_array_elements(coalesce(student->'history','[]'::jsonb)) loop
 insert into public.crm_activities(id,student_id,payload) values(item->>'id',student->>'id',item) on conflict(id) do nothing;
 end loop;
 end loop;
 for c,table_name in values ('assignments','crm_assignments'),('bookings','crm_bookings') loop
 execute format('insert into public.%I(id,payload) select x->>''id'',x from jsonb_array_elements($1) x on conflict(id) do update set payload=excluded.payload where %I.payload is distinct from excluded.payload',table_name,table_name) using coalesce(p_state->c,'[]'::jsonb);
 end loop;
 -- Archiving revokes student access immediately; restoring re-enables the link.
 update public.crm_access a set active=not coalesce((s.payload->>'archived')::boolean,false) from public.crm_students s where a.role='student' and a.record_id=s.id;
 insert into public.crm_preferences(user_id,payload) values(p_actor,jsonb_strip_nulls(jsonb_build_object('views',p_state->'views','directory',p_state->'directory','activeViewId',p_state->'activeViewId'))) on conflict(user_id) do update set payload=excluded.payload;
 update public.crm_meta set revision=revision+1,updated_at=now() where id=1;
 return public.crm_read(p_actor);
end $$;
revoke all on function public.crm_write(uuid,bigint,jsonb) from public,anon,authenticated;
grant execute on function public.crm_write(uuid,bigint,jsonb) to service_role;
