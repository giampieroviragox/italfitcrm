-- Access events share the same lock, revision and transaction as CRM updates.
create or replace function public.crm_link_access(p_actor uuid,p_user uuid,p_role text,p_record text,p_email text) returns jsonb language plpgsql security invoker set search_path='' as $$
declare staff_role text; staff_record text; staff_name text; record_payload jsonb; event_id text; had_access boolean; begin
 select role,record_id into staff_role,staff_record from public.crm_access where user_id=p_actor and active;
 if staff_role not in ('owner','admin') or staff_role is null or (p_role='admin' and staff_role<>'owner') or p_role not in ('student','admin') then raise exception 'Accesso negato' using errcode='42501'; end if;
 perform revision from public.crm_meta where id=1 for update;
 if p_role='student' then select payload into record_payload from public.crm_students where id=p_record;else select payload into record_payload from public.crm_admins where id=p_record;end if;
 if record_payload is null or lower(trim(record_payload->>'email'))<>lower(trim(p_email)) or coalesce((record_payload->>'archived')::boolean,false) or record_payload->>'role'='owner' then raise exception 'La scheda è cambiata. Ricarica e riprova.' using errcode='PT409';end if;
 if exists(select 1 from public.crm_access where user_id=p_user and (record_id<>p_record or role<>p_role)) then raise exception 'L’account è già collegato a un altro ruolo o scheda.' using errcode='23505';end if;
 had_access := exists(select 1 from public.crm_access where role=p_role and record_id=p_record);
 insert into public.crm_access(user_id,role,record_id) values(p_user,p_role,p_record) on conflict(user_id) do update set invited_at=now();
 if p_role='student' then
   select payload->>'name' into staff_name from public.crm_admins where id=staff_record;
   event_id := gen_random_uuid()::text;
   insert into public.crm_activities(id,student_id,payload) values(event_id,p_record,jsonb_build_object(
     'id',event_id,'text',case when had_access then 'Link di accesso rigenerato' else 'Invito di accesso preparato' end,
     'actorId',staff_record,'actorName',coalesce(staff_name,'Amministratore'),'createdAt',clock_timestamp()));
   update public.crm_students set payload=jsonb_set(payload,'{revision}',to_jsonb(coalesce((payload->>'revision')::bigint,0)+1)) where id=p_record;
 end if;
 if p_role='admin' then update public.crm_admins set payload=jsonb_set(payload,'{status}','"active"'::jsonb) where id=p_record;end if;
 update public.crm_meta set revision=revision+1,updated_at=now() where id=1;
 return public.crm_read(p_actor);
end $$;


-- Called only after the server verifies the SSR user and their active access.
create function public.crm_accept_access(p_actor uuid) returns void
language plpgsql security invoker set search_path='' as $$
declare account public.crm_access; person jsonb; event_id text;
begin
  perform revision from public.crm_meta where id=1 for update;
  select * into account from public.crm_access where user_id=p_actor and active for update;
  if account.user_id is null then raise exception 'Accesso negato' using errcode='42501'; end if;
  if account.accepted_at is not null then return; end if;
  update public.crm_access set accepted_at=clock_timestamp() where user_id=p_actor;
  if account.role='student' then
    select payload into person from public.crm_students where id=account.record_id;
    event_id := gen_random_uuid()::text;
    insert into public.crm_activities(id,student_id,payload) values(event_id,account.record_id,jsonb_build_object(
      'id',event_id,'text','Accesso studente attivato','actorId',account.record_id,
      'actorName',concat_ws(' ',person->>'firstName',person->>'lastName'),'createdAt',clock_timestamp()));
    update public.crm_students set payload=jsonb_set(payload,'{revision}',to_jsonb(coalesce((payload->>'revision')::bigint,0)+1)) where id=account.record_id;
  end if;
  update public.crm_meta set revision=revision+1,updated_at=now() where id=1;
end $$;
revoke all on function public.crm_accept_access(uuid) from public,anon,authenticated;
grant execute on function public.crm_accept_access(uuid) to service_role;
