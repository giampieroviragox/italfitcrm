create function public.crm_link_access(p_actor uuid,p_user uuid,p_role text,p_record text,p_email text) returns jsonb language plpgsql security invoker set search_path='' as $$
declare staff_role text; record_payload jsonb; begin
 select role into staff_role from public.crm_access where user_id=p_actor and active;
 if staff_role not in ('owner','admin') or staff_role is null or (p_role='admin' and staff_role<>'owner') or p_role not in ('student','admin') then raise exception 'Accesso negato' using errcode='42501'; end if;
 perform revision from public.crm_meta where id=1 for update;
 if p_role='student' then select payload into record_payload from public.crm_students where id=p_record;else select payload into record_payload from public.crm_admins where id=p_record;end if;
 if record_payload is null or lower(trim(record_payload->>'email'))<>lower(trim(p_email)) or coalesce((record_payload->>'archived')::boolean,false) or record_payload->>'role'='owner' then raise exception 'La scheda è cambiata. Ricarica e riprova.' using errcode='40001';end if;
 if exists(select 1 from public.crm_access where user_id=p_user and (record_id<>p_record or role<>p_role)) then raise exception 'L’account è già collegato a un altro ruolo o scheda.' using errcode='23505';end if;
 insert into public.crm_access(user_id,role,record_id) values(p_user,p_role,p_record) on conflict(user_id) do update set invited_at=now();
 if p_role='admin' then update public.crm_admins set payload=jsonb_set(payload,'{status}','"active"'::jsonb) where id=p_record;end if;
 update public.crm_meta set revision=revision+1,updated_at=now() where id=1;
 return public.crm_read(p_actor);
end $$;
revoke all on function public.crm_link_access(uuid,uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.crm_link_access(uuid,uuid,text,text,text) to service_role;
