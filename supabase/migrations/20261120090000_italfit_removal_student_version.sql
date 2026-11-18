-- Removing an assignment while the same call also writes the student (the history
-- entry) bumped the student version twice and always ended in PT409. The removal
-- step now leaves the version of such students to the student step.
CREATE OR REPLACE FUNCTION public.crm_apply(p_actor uuid, p_changes jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  rev bigint; any_change boolean := false; touched boolean;
  coll text; tbl text; item jsonb; r record; n integer; sid text; cur_v bigint; cur_p jsonb; new_p jsonb;
  prop record; ev jsonb; versions jsonb := '{}'::jsonb; guard jsonb; ids text[]; cn text;
  cur_h jsonb; new_h jsonb; sids text[]; rm_students text[];
begin
  if not exists (select 1 from public.crm_access where user_id = p_actor and active) then
    raise exception 'Accesso negato' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtext('crm_apply'));
  select revision + 1 into rev from public.crm_meta where id = 1;

  -- Removals first: assignments carry the student's workout logs with them.
  -- A student written in the same call keeps its version here: the student step
  -- below checks `expected` against it and then bumps it once.
  sids := coalesce(array(select x->>'id' from jsonb_array_elements(coalesce(p_changes->'students', '[]'::jsonb)) x), '{}');
  ids := coalesce(array(select jsonb_array_elements_text(p_changes->'removed'->'assignments')), '{}');
  if cardinality(ids) > 0 then
    with upd as (
      update public.crm_students s
         set heavy = jsonb_set(s.heavy, '{workoutEntries}', coalesce((
               select jsonb_agg(e) from jsonb_array_elements(
                 coalesce(s.heavy->'workoutEntries', s.payload->'workoutEntries', '[]'::jsonb)) e
               where not (e->>'assignmentId' = any (ids))), '[]'::jsonb), true),
             payload = s.payload - 'workoutEntries',
             version = case when s.id = any (sids) then s.version else s.version + 1 end,
             seq = case when s.id = any (sids) then s.seq else rev end
       where (s.payload ? 'workoutEntries'
              or exists (select 1 from jsonb_array_elements(coalesce(s.heavy->'workoutEntries', '[]'::jsonb)) e
                          where e->>'assignmentId' = any (ids)))
         and s.id in (select a.student_id from public.crm_assignments a where a.id = any (ids))
      returning s.id
    )
    select array_agg(id) into rm_students from upd;
    rm_students := coalesce(rm_students, '{}');
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
      if sid = any (coalesce(rm_students, '{}')) then touched := true; end if;
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
end $function$;
