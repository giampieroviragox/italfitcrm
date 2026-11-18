-- Record-level sync: every record has a version and a change number, writes
-- touch only the records that changed, and clients read differences.
--
-- Additive on purpose: the previous crm_read / crm_write / crm_remove keep
-- working until the new app is live; a later migration removes them.
--
-- Concurrency model
--  * Each record carries `version`. A writer states the version it saw
--    (`expected`); a different current version is a conflict on that record
--    only. Edits to different records never conflict.
--  * `crm_apply` holds one advisory lock for the (short) write phase so change
--    numbers (`seq`) follow commit order. A reader that has seen `seq = n`
--    has seen every change up to n. The slow part (reading, validating) is
--    outside the lock.
--  * Conflicts use SQLSTATE PT409 (HTTP 409 through PostgREST). 40001, the
--    usual serialization code, makes PostgREST retry until the gateway times
--    out after two minutes.
--  * Capacity of a lesson is checked here, inside the lock, because two
--    people booking the last place validate against the same old state.

-- ---------------------------------------------------------------- columns ---
do $$
declare t text;
begin
  foreach t in array array['crm_tiers','crm_properties','crm_admins','crm_students',
    'crm_plans','crm_assignments','crm_lessons','crm_bookings'] loop
    execute format('alter table public.%I add column if not exists version bigint not null default 1', t);
    execute format('alter table public.%I add column if not exists seq bigint not null default 0', t);
    execute format('create index if not exists %I on public.%I (seq)', t || '_seq', t);
  end loop;
end $$;

-- Workout logs live in their own column: list reads never decompress them.
alter table public.crm_students add column if not exists heavy jsonb not null default '{}'::jsonb;

-- Removed records, so clients can drop them when reading differences.
create table if not exists public.crm_tombstones (
  kind text not null,
  id text not null,
  seq bigint not null,
  primary key (kind, id)
);
create index if not exists crm_tombstones_seq on public.crm_tombstones (seq);
alter table public.crm_tombstones enable row level security;
revoke all on public.crm_tombstones from public, anon, authenticated;

-- The activity feed on the home page reads the latest events across students.
create index if not exists crm_activities_recent
  on public.crm_activities ((payload->>'createdAt') desc);
-- Bookings are counted per lesson to enforce capacity.
create index if not exists crm_bookings_lesson_active
  on public.crm_bookings (lesson_id) where not coalesce((payload->>'cancelled')::boolean, false);

-- ----------------------------------------------------------- JSON helpers ---
drop function if exists public.crm_student_json(public.crm_students, boolean);

-- A student as the browser sees it. Heavy, unbounded parts (workout logs,
-- notes, activity history) are only included when `p_detail` is true. The
-- arguments are scalars on purpose: passing the whole row would decompress
-- the heavy column for every student of every list.
create or replace function public.crm_student_json(p_id text, p_payload jsonb, p_heavy jsonb, p_detail boolean)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select (p_payload - 'workoutEntries')
    || jsonb_build_object(
      'properties', coalesce((select jsonb_object_agg(v.property_id, v.value)
        from public.crm_property_values v where v.student_id = p_id), '{}'::jsonb),
      'access', (select jsonb_build_object(
          'status', case when a.accepted_at is null then 'invited' else 'active' end,
          'invitedAt', a.invited_at)
        from public.crm_access a where a.record_id = p_id and a.role = 'student' and a.active))
    || case when p_detail then jsonb_build_object(
      -- Rows not moved yet still hold the logs in the payload.
      'workoutEntries', coalesce(p_heavy->'workoutEntries', p_payload->'workoutEntries', '[]'::jsonb),
      'notes', coalesce((select jsonb_agg(n.payload order by n.payload->>'createdAt', n.id)
        from public.crm_notes n where n.student_id = p_id), '[]'::jsonb),
      'history', coalesce((select jsonb_agg(h.payload order by h.payload->>'createdAt', h.id)
        from public.crm_activities h where h.student_id = p_id), '[]'::jsonb))
    else '{}'::jsonb end
$$;

create or replace function public.crm_admin_json(x public.crm_admins)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select x.payload || jsonb_build_object('access', (
    select jsonb_build_object(
      'status', case when a.accepted_at is null then 'invited' else 'active' end,
      'invitedAt', a.invited_at)
    from public.crm_access a
    where a.record_id = x.id and a.role in ('owner', 'admin') and a.active))
$$;

-- ------------------------------------------------------------------ reads ---
-- Everything the team needs, without heavy student detail.
create or replace function public.crm_load(p_actor uuid) returns jsonb
language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'revision', (select revision from public.crm_meta where id = 1),
    'versions', jsonb_build_object(
      'students', coalesce((select jsonb_object_agg(id, version) from public.crm_students), '{}'::jsonb),
      'admins', coalesce((select jsonb_object_agg(id, version) from public.crm_admins), '{}'::jsonb),
      'tiers', coalesce((select jsonb_object_agg(id, version) from public.crm_tiers), '{}'::jsonb),
      'properties', coalesce((select jsonb_object_agg(id, version) from public.crm_properties), '{}'::jsonb),
      'plans', coalesce((select jsonb_object_agg(id, version) from public.crm_plans), '{}'::jsonb),
      'assignments', coalesce((select jsonb_object_agg(id, version) from public.crm_assignments), '{}'::jsonb),
      'lessons', coalesce((select jsonb_object_agg(id, version) from public.crm_lessons), '{}'::jsonb),
      'bookings', coalesce((select jsonb_object_agg(id, version) from public.crm_bookings), '{}'::jsonb)),
    'state', jsonb_build_object(
      'version', 1,
      'students', coalesce((select jsonb_agg(public.crm_student_json(s.id, s.payload, null, false)
        order by s.payload->>'joinedAt' desc, s.id) from public.crm_students s), '[]'::jsonb),
      'admins', coalesce((select jsonb_agg(public.crm_admin_json(x) order by x.id)
        from public.crm_admins x), '[]'::jsonb),
      'tiers', coalesce((select jsonb_agg(payload order by id) from public.crm_tiers), '[]'::jsonb),
      'properties', coalesce((select jsonb_agg(payload order by id) from public.crm_properties), '[]'::jsonb),
      'plans', coalesce((select jsonb_agg(payload order by id) from public.crm_plans), '[]'::jsonb),
      'assignments', coalesce((select jsonb_agg(payload order by id) from public.crm_assignments), '[]'::jsonb),
      'lessons', coalesce((select jsonb_agg(payload order by id) from public.crm_lessons), '[]'::jsonb),
      'bookings', coalesce((select jsonb_agg(payload order by id) from public.crm_bookings), '[]'::jsonb)
    ) || coalesce((select payload from public.crm_preferences where user_id = p_actor), '{}'::jsonb))
$$;

-- Only what changed after `p_since`, as `{ v: version, r: record }` pairs.
create or replace function public.crm_load_changes(p_actor uuid, p_since bigint) returns jsonb
language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'revision', (select revision from public.crm_meta where id = 1),
    'changes', jsonb_build_object(
      'students', coalesce((select jsonb_agg(jsonb_build_object('v', s.version, 'r', public.crm_student_json(s.id, s.payload, null, false)))
        from public.crm_students s where s.seq > p_since), '[]'::jsonb),
      'admins', coalesce((select jsonb_agg(jsonb_build_object('v', x.version, 'r', public.crm_admin_json(x)))
        from public.crm_admins x where x.seq > p_since), '[]'::jsonb),
      'tiers', coalesce((select jsonb_agg(jsonb_build_object('v', version, 'r', payload))
        from public.crm_tiers where seq > p_since), '[]'::jsonb),
      'properties', coalesce((select jsonb_agg(jsonb_build_object('v', version, 'r', payload))
        from public.crm_properties where seq > p_since), '[]'::jsonb),
      'plans', coalesce((select jsonb_agg(jsonb_build_object('v', version, 'r', payload))
        from public.crm_plans where seq > p_since), '[]'::jsonb),
      'assignments', coalesce((select jsonb_agg(jsonb_build_object('v', version, 'r', payload))
        from public.crm_assignments where seq > p_since), '[]'::jsonb),
      'lessons', coalesce((select jsonb_agg(jsonb_build_object('v', version, 'r', payload))
        from public.crm_lessons where seq > p_since), '[]'::jsonb),
      'bookings', coalesce((select jsonb_agg(jsonb_build_object('v', version, 'r', payload))
        from public.crm_bookings where seq > p_since), '[]'::jsonb)),
    'removed', coalesce((select jsonb_agg(jsonb_build_object('k', kind, 'id', id))
      from public.crm_tombstones where seq > p_since), '[]'::jsonb),
    'preferences', coalesce((select payload from public.crm_preferences where user_id = p_actor), '{}'::jsonb))
$$;

-- Workout logs, notes and history of one student (loaded when a profile opens).
create or replace function public.crm_load_detail(p_student text) returns jsonb
language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'revision', (select revision from public.crm_meta where id = 1),
    'student', (select public.crm_student_json(s.id, s.payload, s.heavy, true) from public.crm_students s where s.id = p_student))
$$;

-- Latest activity across students, for the home page.
create or replace function public.crm_recent_activity(p_limit integer) returns jsonb
language sql stable security invoker set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('student', t.student_id, 'event', t.payload)), '[]'::jsonb)
  from (select student_id, payload from public.crm_activities
        order by payload->>'createdAt' desc limit greatest(1, least(p_limit, 200))) t
$$;

-- What a student's own session needs: their record in full, their bookings,
-- upcoming lessons and per-lesson occupancy. Nothing about other students.
create or replace function public.crm_load_scope(p_student text) returns jsonb
language sql stable security invoker set search_path = '' as $$
  with mine as (
    select b.payload, b.id, b.version, b.lesson_id from public.crm_bookings b where b.student_id = p_student
  ), seen as (
    select l.id, l.version, l.payload from public.crm_lessons l
    where (l.payload->>'startsAt')::timestamptz > now() - interval '1 day'
       or l.id in (select lesson_id from mine)
  ), mine_assignments as (
    select a.id, a.version, a.payload, a.plan_id from public.crm_assignments a where a.student_id = p_student
  )
  select jsonb_build_object(
    'revision', (select revision from public.crm_meta where id = 1),
    'versions', jsonb_build_object(
      'students', coalesce((select jsonb_object_agg(id, version) from public.crm_students where id = p_student), '{}'::jsonb),
      'assignments', coalesce((select jsonb_object_agg(id, version) from mine_assignments), '{}'::jsonb),
      'lessons', coalesce((select jsonb_object_agg(id, version) from seen), '{}'::jsonb),
      'bookings', coalesce((select jsonb_object_agg(id, version) from mine), '{}'::jsonb),
      'plans', coalesce((select jsonb_object_agg(p.id, p.version) from public.crm_plans p
        where p.id in (select plan_id from mine_assignments)), '{}'::jsonb),
      'tiers', coalesce((select jsonb_object_agg(id, version) from public.crm_tiers), '{}'::jsonb),
      'properties', coalesce((select jsonb_object_agg(id, version) from public.crm_properties), '{}'::jsonb),
      'admins', coalesce((select jsonb_object_agg(id, version) from public.crm_admins), '{}'::jsonb)),
    'occupancy', coalesce((select jsonb_object_agg(lesson_id, n) from (
        select b.lesson_id, count(*) n from public.crm_bookings b
        where b.lesson_id in (select id from seen)
          and not coalesce((b.payload->>'cancelled')::boolean, false)
        group by b.lesson_id) o), '{}'::jsonb),
    'state', jsonb_build_object(
      'version', 1,
      'students', coalesce((select jsonb_agg(public.crm_student_json(s.id, s.payload, s.heavy, true))
        from public.crm_students s where s.id = p_student), '[]'::jsonb),
      'admins', coalesce((select jsonb_agg(public.crm_admin_json(x) order by x.id) from public.crm_admins x), '[]'::jsonb),
      'tiers', coalesce((select jsonb_agg(payload order by id) from public.crm_tiers), '[]'::jsonb),
      'properties', coalesce((select jsonb_agg(payload order by id) from public.crm_properties), '[]'::jsonb),
      'plans', coalesce((select jsonb_agg(p.payload order by p.id) from public.crm_plans p
        where p.id in (select plan_id from mine_assignments)), '[]'::jsonb),
      'assignments', coalesce((select jsonb_agg(payload order by id) from mine_assignments), '[]'::jsonb),
      'lessons', coalesce((select jsonb_agg(payload order by id) from seen), '[]'::jsonb),
      'bookings', coalesce((select jsonb_agg(payload order by id) from mine), '[]'::jsonb)))
$$;

-- The student behind a login, or null when the account is not a student's.
create or replace function public.crm_load_scope_user(p_user uuid) returns jsonb
language sql stable security invoker set search_path = '' as $$
  select public.crm_load_scope(a.record_id)
  from public.crm_access a
  where a.user_id = p_user and a.role = 'student' and a.active
$$;

-- ----------------------------------------------------------------- writes ---
-- Version-checked insert or update of one record. Returns its new version.
-- `changed` is set when something was really written.
create or replace function public.crm_put(p_table text, p_kind text, p_item jsonb, p_rev bigint, out changed boolean, out version bigint)
language plpgsql security invoker set search_path = '' as $$
declare
  rid text := p_item->>'id';
  exp bigint := nullif(p_item->>'expected', '')::bigint;
  cur bigint; n integer; cn text;
begin
  if exp is null then
    begin
      execute format('insert into public.%I (id, payload, version, seq) values ($1, $2, 1, $3)', p_table)
        using rid, p_item->'payload', p_rev;
    exception when unique_violation then
      get stacked diagnostics cn = constraint_name;
      if cn like '%\_pkey' then
        raise exception 'conflict' using errcode = 'PT409', detail = p_kind || ':' || rid;
      end if;
      raise;
    end;
    changed := true; version := 1; return;
  end if;
  execute format('update public.%I set payload = $1, version = version + 1, seq = $2
                  where id = $3 and version = $4 and payload is distinct from $1', p_table)
    using p_item->'payload', p_rev, rid, exp;
  get diagnostics n = row_count;
  if n = 1 then changed := true; version := exp + 1; return; end if;
  execute format('select version from public.%I where id = $1', p_table) into cur using rid;
  if cur is distinct from exp then
    raise exception 'conflict' using errcode = 'PT409', detail = p_kind || ':' || rid;
  end if;
  changed := false; version := exp;
end $$;

-- Applies a set of record changes in one transaction.
--
-- p_changes = {
--   tiers|properties|admins|plans|lessons|assignments|bookings:
--     [{id, expected: version|null, payload}],
--   students: [{id, expected, payload, properties?: {id: value}, heavy?: {...},
--               notes?: [new], history?: [new]}],
--   removed: {assignments: [ids], plans: [ids]},
--   capacity: [{lesson, max}],
--   preferences: {...}
-- }
-- Returns {revision, versions: {kind: {id: version}}}.
create or replace function public.crm_apply(p_actor uuid, p_changes jsonb) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  rev bigint; any_change boolean := false; touched boolean;
  coll text; tbl text; item jsonb; r record; n integer; sid text; cur_v bigint; cur_p jsonb; new_p jsonb;
  prop record; ev jsonb; versions jsonb := '{}'::jsonb; guard jsonb; ids text[]; cn text;
  cur_h jsonb; new_h jsonb;
begin
  if not exists (select 1 from public.crm_access where user_id = p_actor and active) then
    raise exception 'Accesso negato' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtext('crm_apply'));
  select revision + 1 into rev from public.crm_meta where id = 1;

  -- Removals first: assignments carry the student's workout logs with them.
  ids := coalesce(array(select jsonb_array_elements_text(p_changes->'removed'->'assignments')), '{}');
  if cardinality(ids) > 0 then
    update public.crm_students s
       set heavy = jsonb_set(s.heavy, '{workoutEntries}', coalesce((
             select jsonb_agg(e) from jsonb_array_elements(
               coalesce(s.heavy->'workoutEntries', s.payload->'workoutEntries', '[]'::jsonb)) e
             where not (e->>'assignmentId' = any (ids))), '[]'::jsonb), true),
           payload = s.payload - 'workoutEntries',
           version = s.version + 1, seq = rev
     where (s.heavy ? 'workoutEntries' or s.payload ? 'workoutEntries')
       and s.id in (select a.student_id from public.crm_assignments a where a.id = any (ids));
    delete from public.crm_assignments where id = any (ids);
    get diagnostics n = row_count;
    if n > 0 then
      any_change := true;
      insert into public.crm_tombstones (kind, id, seq) select 'assignments', x, rev from unnest(ids) x
        on conflict (kind, id) do update set seq = excluded.seq;
    end if;
  end if;
  ids := coalesce(array(select jsonb_array_elements_text(p_changes->'removed'->'plans')), '{}');
  if cardinality(ids) > 0 then
    if exists (select 1 from public.crm_assignments where plan_id = any (ids)) then
      raise exception 'Il piano è assegnato: rimuovi prima le assegnazioni o archivialo.' using errcode = '23503';
    end if;
    delete from public.crm_plans where id = any (ids);
    get diagnostics n = row_count;
    if n > 0 then
      any_change := true;
      insert into public.crm_tombstones (kind, id, seq) select 'plans', x, rev from unnest(ids) x
        on conflict (kind, id) do update set seq = excluded.seq;
    end if;
  end if;

  -- Reference data and lessons, in dependency order.
  for coll, tbl in values ('tiers','crm_tiers'),('properties','crm_properties'),('admins','crm_admins'),
                          ('plans','crm_plans'),('lessons','crm_lessons') loop
    for item in select * from jsonb_array_elements(coalesce(p_changes->coll, '[]'::jsonb)) loop
      select * into r from public.crm_put(tbl, coll, item, rev);
      if r.changed then any_change := true; end if;
      versions := jsonb_set(versions, array[coll], coalesce(versions->coll, '{}'::jsonb) || jsonb_build_object(item->>'id', r.version), true);
    end loop;
  end loop;

  -- Students: payload, property values and new notes / history entries.
  for item in select * from jsonb_array_elements(coalesce(p_changes->'students', '[]'::jsonb)) loop
    sid := item->>'id';
    touched := false;
    if nullif(item->>'expected', '') is null then
      begin
        insert into public.crm_students (id, payload, heavy, version, seq)
          values (sid, (item->'payload') - 'workoutEntries', coalesce(item->'heavy', '{}'::jsonb), 1, rev);
      exception when unique_violation then
        get stacked diagnostics cn = constraint_name;
        if cn like '%\_pkey' then
          raise exception 'conflict' using errcode = 'PT409', detail = 'students:' || (item->>'id');
        end if;
        raise;
      end;
      cur_v := 1; touched := true;
    else
      select version, payload, heavy into cur_v, cur_p, cur_h from public.crm_students where id = sid for update;
      if cur_v is distinct from (item->>'expected')::bigint then
        raise exception 'conflict' using errcode = 'PT409', detail = 'students:' || sid;
      end if;
      -- Light payload replaces the stored one; heavy parts only change when sent.
      new_p := (item->'payload') - 'workoutEntries';
      new_h := cur_h;
      -- Logs not moved out of the payload yet go to their column on first write.
      if cur_p ? 'workoutEntries' and not (cur_h ? 'workoutEntries') then
        new_h := new_h || jsonb_build_object('workoutEntries', cur_p->'workoutEntries');
      end if;
      new_h := new_h || coalesce(item->'heavy', '{}'::jsonb);
      if new_p is distinct from (cur_p - 'workoutEntries') or new_h is distinct from cur_h
         or cur_p ? 'workoutEntries' then
        touched := true;
      end if;
    end if;
    if jsonb_typeof(item->'properties') = 'object' then
      delete from public.crm_property_values
       where student_id = sid and not ((item->'properties') ? property_id);
      get diagnostics n = row_count;
      if n > 0 then touched := true; end if;
      for prop in select key, value from jsonb_each(item->'properties') loop
        insert into public.crm_property_values (student_id, property_id, value)
          values (sid, prop.key, prop.value)
          on conflict (student_id, property_id) do update set value = excluded.value
          where public.crm_property_values.value is distinct from excluded.value;
        get diagnostics n = row_count;
        if n > 0 then touched := true; end if;
      end loop;
    end if;
    for ev in select * from jsonb_array_elements(coalesce(item->'notes', '[]'::jsonb)) loop
      insert into public.crm_notes (id, student_id, payload) values (ev->>'id', sid, ev) on conflict (id) do nothing;
      get diagnostics n = row_count;
      if n > 0 then touched := true; end if;
    end loop;
    for ev in select * from jsonb_array_elements(coalesce(item->'history', '[]'::jsonb)) loop
      insert into public.crm_activities (id, student_id, payload) values (ev->>'id', sid, ev) on conflict (id) do nothing;
      get diagnostics n = row_count;
      if n > 0 then touched := true; end if;
    end loop;
    if touched and nullif(item->>'expected', '') is not null then
      update public.crm_students set payload = new_p, heavy = new_h, version = version + 1, seq = rev where id = sid;
      cur_v := cur_v + 1;
    end if;
    if touched then any_change := true; end if;
    versions := jsonb_set(versions, array['students'], coalesce(versions->'students', '{}'::jsonb) || jsonb_build_object(sid, cur_v), true);
  end loop;

  -- Records that depend on students and lessons.
  for coll, tbl in values ('assignments','crm_assignments'),('bookings','crm_bookings') loop
    for item in select * from jsonb_array_elements(coalesce(p_changes->coll, '[]'::jsonb)) loop
      select * into r from public.crm_put(tbl, coll, item, rev);
      if r.changed then any_change := true; end if;
      versions := jsonb_set(versions, array[coll], coalesce(versions->coll, '{}'::jsonb) || jsonb_build_object(item->>'id', r.version), true);
    end loop;
  end loop;

  -- Capacity is checked against the real, current bookings.
  for guard in select * from jsonb_array_elements(coalesce(p_changes->'capacity', '[]'::jsonb)) loop
    select count(*) into n from public.crm_bookings b
     where b.lesson_id = guard->>'lesson' and not coalesce((b.payload->>'cancelled')::boolean, false);
    if n > (guard->>'max')::integer then
      raise exception 'capacity:%', guard->>'lesson' using errcode = 'P0001';
    end if;
  end loop;

  if jsonb_typeof(p_changes->'preferences') = 'object' then
    insert into public.crm_preferences (user_id, payload) values (p_actor, p_changes->'preferences')
      on conflict (user_id) do update set payload = excluded.payload;
  end if;

  if any_change then
    update public.crm_meta set revision = rev, updated_at = now() where id = 1;
  else
    rev := rev - 1;
  end if;
  return jsonb_build_object('revision', rev, 'versions', versions);
end $$;

-- Accepting or linking an account changes what the student / member looks
-- like (their `access` state), so those records get a new version too.
create or replace function public.crm_touch(p_kind text, p_id text) returns void
language plpgsql security invoker set search_path = '' as $$
declare rev bigint;
begin
  perform pg_advisory_xact_lock(hashtext('crm_apply'));
  select revision + 1 into rev from public.crm_meta where id = 1;
  if p_kind = 'students' then
    update public.crm_students set version = version + 1, seq = rev where id = p_id;
  else
    update public.crm_admins set version = version + 1, seq = rev where id = p_id;
  end if;
  update public.crm_meta set revision = rev, updated_at = now() where id = 1;
end $$;

create or replace function public.crm_accept_access_v2(p_actor uuid) returns void
language plpgsql security invoker set search_path = '' as $$
declare account public.crm_access; person jsonb; event_id text;
begin
  select * into account from public.crm_access where user_id = p_actor and active for update;
  if account.user_id is null then raise exception 'Accesso negato' using errcode = '42501'; end if;
  if account.accepted_at is not null then return; end if;
  perform pg_advisory_xact_lock(hashtext('crm_apply'));
  update public.crm_access set accepted_at = clock_timestamp() where user_id = p_actor;
  if account.role = 'student' then
    select payload into person from public.crm_students where id = account.record_id;
    event_id := gen_random_uuid()::text;
    insert into public.crm_activities (id, student_id, payload) values (event_id, account.record_id, jsonb_build_object(
      'id', event_id, 'text', 'Accesso studente attivato', 'actorId', account.record_id,
      'actorName', concat_ws(' ', person->>'firstName', person->>'lastName'), 'createdAt', clock_timestamp()));
    update public.crm_students
       set payload = jsonb_set(payload, '{revision}', to_jsonb(coalesce((payload->>'revision')::bigint, 0) + 1))
     where id = account.record_id;
    perform public.crm_touch('students', account.record_id);
  else
    perform public.crm_touch('admins', account.record_id);
  end if;
end $$;

create or replace function public.crm_link_access_v2(p_actor uuid, p_user uuid, p_role text, p_record text, p_email text)
returns void language plpgsql security invoker set search_path = '' as $$
declare staff_role text; staff_record text; staff_name text; record_payload jsonb; event_id text; had_access boolean;
begin
  select role, record_id into staff_role, staff_record from public.crm_access where user_id = p_actor and active;
  if staff_role not in ('owner', 'admin') or staff_role is null
     or (p_role = 'admin' and staff_role <> 'owner') or p_role not in ('student', 'admin') then
    raise exception 'Accesso negato' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtext('crm_apply'));
  if p_role = 'student' then select payload into record_payload from public.crm_students where id = p_record;
  else select payload into record_payload from public.crm_admins where id = p_record; end if;
  if record_payload is null or lower(trim(record_payload->>'email')) <> lower(trim(p_email))
     or coalesce((record_payload->>'archived')::boolean, false) or record_payload->>'role' = 'owner' then
    raise exception 'La scheda è cambiata. Ricarica e riprova.' using errcode = 'PT409';
  end if;
  if exists (select 1 from public.crm_access where user_id = p_user and (record_id <> p_record or role <> p_role)) then
    raise exception 'L’account è già collegato a un altro ruolo o scheda.' using errcode = '23505';
  end if;
  had_access := exists (select 1 from public.crm_access where role = p_role and record_id = p_record);
  insert into public.crm_access (user_id, role, record_id) values (p_user, p_role, p_record)
    on conflict (user_id) do update set invited_at = now();
  if p_role = 'student' then
    select payload->>'name' into staff_name from public.crm_admins where id = staff_record;
    event_id := gen_random_uuid()::text;
    insert into public.crm_activities (id, student_id, payload) values (event_id, p_record, jsonb_build_object(
      'id', event_id, 'text', case when had_access then 'Link di accesso rigenerato' else 'Invito di accesso preparato' end,
      'actorId', staff_record, 'actorName', coalesce(staff_name, 'Amministratore'), 'createdAt', clock_timestamp()));
    update public.crm_students
       set payload = jsonb_set(payload, '{revision}', to_jsonb(coalesce((payload->>'revision')::bigint, 0) + 1))
     where id = p_record;
    perform public.crm_touch('students', p_record);
  else
    update public.crm_admins set payload = jsonb_set(payload, '{status}', '"active"'::jsonb) where id = p_record;
    perform public.crm_touch('admins', p_record);
  end if;
end $$;

-- Server-only, like the rest of the data layer.
do $$
declare f text;
begin
  foreach f in array array[
    'crm_student_json(text, jsonb, jsonb, boolean)', 'crm_admin_json(public.crm_admins)',
    'crm_load(uuid)', 'crm_load_changes(uuid, bigint)', 'crm_load_detail(text)',
    'crm_recent_activity(integer)', 'crm_load_scope(text)', 'crm_load_scope_user(uuid)',
    'crm_put(text, text, jsonb, bigint)', 'crm_apply(uuid, jsonb)', 'crm_touch(text, text)',
    'crm_accept_access_v2(uuid)', 'crm_link_access_v2(uuid, uuid, text, text, text)'] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
end $$;
