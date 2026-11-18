-- Closes the move to record-level sync. Apply once the new app has been live
-- and checked: it moves the workout logs out of the student payload and
-- removes the whole-state functions, so rolling back to the previous app is no
-- longer possible after this.

-- Workout logs go to their own column (list reads never decompress them).
update public.crm_students
   set heavy = heavy || jsonb_build_object('workoutEntries', payload->'workoutEntries'),
       payload = payload - 'workoutEntries'
 where payload ? 'workoutEntries' and not (heavy ? 'workoutEntries');
update public.crm_students
   set payload = payload - 'workoutEntries'
 where payload ? 'workoutEntries';

-- The whole-state functions are replaced by crm_load*, crm_apply and the v2 access functions.
drop function if exists public.crm_read(uuid);
drop function if exists public.crm_write(uuid, bigint, jsonb);
drop function if exists public.crm_remove(uuid, bigint, jsonb, text[], text[]);
drop function if exists public.crm_accept_access(uuid);
drop function if exists public.crm_link_access(uuid, uuid, text, text, text);
