-- Plans run in four-week cycles: a student can have two cycles starting in the
-- same calendar month, and guided programs run in parallel with personalized
-- plans. The "one plan per student per month" rule is dropped; overlaps on the
-- same track are rejected by the server (assertFitnessTransition).
do $$
declare
  c text;
begin
  for c in
    select con.conname
    from pg_constraint con
    where con.conrelid = 'public.crm_assignments'::regclass
      and con.contype = 'u'
      and (
        select array_agg(att.attname::text order by att.attname)
        from unnest(con.conkey) as k(attnum)
        join pg_attribute att
          on att.attrelid = con.conrelid and att.attnum = k.attnum
      ) = array['month', 'student_id']
  loop
    execute format('alter table public.crm_assignments drop constraint %I', c);
  end loop;
end
$$;

create index if not exists crm_assignments_student
  on public.crm_assignments (student_id);
