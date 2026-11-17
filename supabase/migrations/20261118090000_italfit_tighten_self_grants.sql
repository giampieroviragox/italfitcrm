-- Signed-in users only need to read their own access row and preferences.
-- Remove the leftover TRUNCATE, REFERENCES and TRIGGER privileges.
revoke truncate, references, trigger on public.crm_access, public.crm_preferences from authenticated;
