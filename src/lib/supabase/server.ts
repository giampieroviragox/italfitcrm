import type { Database } from "./database.types";
import "server-only";
import { supabaseFetch } from "./fetch";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabasePublicConfig } from "./config";
export async function createSessionClient() {
  const cookieStore = await cookies();
  const { url, key } = supabasePublicConfig();
  return createServerClient<Database>(url, key, {
    global: { fetch: supabaseFetch },
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          /* Server components cannot set cookies; proxy refreshes the session. */
        }
      },
    },
  });
}
