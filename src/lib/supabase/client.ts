"use client";
import type { Database } from "./database.types";

import { createBrowserClient } from "@supabase/ssr";
import { supabasePublicConfig } from "./config";
export function createBrowserSessionClient() {
  const { url, key } = supabasePublicConfig();
  return createBrowserClient<Database>(url, key);
}
