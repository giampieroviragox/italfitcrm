-- Application conflicts are not database serialization failures.
create or replace function public.crm_write(p_actor uuid,p_expected bigint,p_state jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
declare revision_now bigint; c text; table_name text; student jsonb; item jsonb; property record; begin
 if not exists(select 1 from public.crm_access where user_id=p_actor and active) then raise exception 'Accesso negato' using errcode='42501';end if;
 select revision into revision_now from public.crm_meta where id=1 for update;
 if revision_now<>p_expected then raise exception 'Il CRM è stato aggiornato altrove. Ricarica e riprova.' using errcode='PT409';end if;
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

create or replace function public.crm_link_access(p_actor uuid,p_user uuid,p_role text,p_record text,p_email text) returns jsonb language plpgsql security invoker set search_path='' as $$
declare staff_role text; record_payload jsonb; begin
 select role into staff_role from public.crm_access where user_id=p_actor and active;
 if staff_role not in ('owner','admin') or staff_role is null or (p_role='admin' and staff_role<>'owner') or p_role not in ('student','admin') then raise exception 'Accesso negato' using errcode='42501'; end if;
 perform revision from public.crm_meta where id=1 for update;
 if p_role='student' then select payload into record_payload from public.crm_students where id=p_record;else select payload into record_payload from public.crm_admins where id=p_record;end if;
 if record_payload is null or lower(trim(record_payload->>'email'))<>lower(trim(p_email)) or coalesce((record_payload->>'archived')::boolean,false) or record_payload->>'role'='owner' then raise exception 'La scheda è cambiata. Ricarica e riprova.' using errcode='PT409';end if;
 if exists(select 1 from public.crm_access where user_id=p_user and (record_id<>p_record or role<>p_role)) then raise exception 'L’account è già collegato a un altro ruolo o scheda.' using errcode='23505';end if;
 insert into public.crm_access(user_id,role,record_id) values(p_user,p_role,p_record) on conflict(user_id) do update set invited_at=now();
 if p_role='admin' then update public.crm_admins set payload=jsonb_set(payload,'{status}','"active"'::jsonb) where id=p_record;end if;
 update public.crm_meta set revision=revision+1,updated_at=now() where id=1;
 return public.crm_read(p_actor);
end $$;

