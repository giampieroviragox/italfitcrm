-- Explicit, staff-only removal of plan assignments and never-assigned plans.
-- crm_write only upserts, so removals happen here in the same transaction as
-- the state write (history entries, cleaned workout logs) and revision check.
create or replace function public.crm_remove(p_actor uuid,p_expected bigint,p_state jsonb,p_assignments text[],p_plans text[]) returns jsonb language plpgsql security invoker set search_path='' as $$
declare revision_now bigint; begin
 if not exists(select 1 from public.crm_access where user_id=p_actor and active and role in ('owner','admin')) then raise exception 'Accesso negato' using errcode='42501';end if;
 select revision into revision_now from public.crm_meta where id=1 for update;
 if revision_now<>p_expected then raise exception 'Il CRM è stato aggiornato altrove. Ricarica e riprova.' using errcode='PT409';end if;
 if exists(select 1 from jsonb_array_elements(coalesce(p_state->'assignments','[]'::jsonb)) x where x->>'id'=any(coalesce(p_assignments,'{}')))
  or exists(select 1 from jsonb_array_elements(coalesce(p_state->'plans','[]'::jsonb)) x where x->>'id'=any(coalesce(p_plans,'{}')))
 then raise exception 'Lo stato contiene ancora i record da rimuovere.' using errcode='22023';end if;
 delete from public.crm_assignments where id=any(coalesce(p_assignments,'{}'));
 if exists(select 1 from public.crm_assignments where plan_id=any(coalesce(p_plans,'{}'))) then raise exception 'Il piano è assegnato: rimuovi prima le assegnazioni o archivialo.' using errcode='23503';end if;
 delete from public.crm_plans where id=any(coalesce(p_plans,'{}'));
 return public.crm_write(p_actor,p_expected,p_state);
end $$;
revoke all on function public.crm_remove(uuid,bigint,jsonb,text[],text[]) from public,anon,authenticated;
grant execute on function public.crm_remove(uuid,bigint,jsonb,text[],text[]) to service_role;
