-- Team roles and permissions (super admin, admin, coach) are enforced by the
-- application server, which reads the CRM with the service role and filters it
-- per member. Signed-in users therefore no longer read CRM tables directly:
-- otherwise a coach could bypass the filtering through the Supabase API.
-- crm_access and crm_preferences keep their "own row" read policies.
do $$ declare t text; begin
 foreach t in array array['crm_meta','crm_tiers','crm_properties','crm_admins','crm_students','crm_property_values','crm_notes','crm_activities','crm_plans','crm_assignments','crm_lessons','crm_bookings'] loop
  execute format('drop policy if exists staff_read on public.%I', t);
  execute format('revoke select on public.%I from authenticated', t);
 end loop;
end $$;
