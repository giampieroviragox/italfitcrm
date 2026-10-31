import type { Database } from "./database.types";
import "server-only";
import { supabaseFetch } from "./fetch";
import { createClient } from "@supabase/supabase-js";
import { supabasePublicConfig } from "./config";
export function createAdminClient() {
  const { url } = supabasePublicConfig();
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key) throw new Error("Chiave server Supabase non configurata.");
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: supabaseFetch },
  });
}
