export const supabaseConfigured = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
);
if (
  process.env.VERCEL &&
  process.env.VERCEL_ENV !== "preview" &&
  !supabaseConfigured
) {
  throw new Error(
    "Configura Supabase nell’ambiente di deployment prima di pubblicare Italfit.",
  );
}
export function supabasePublicConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
    key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Supabase non configurato.");
  return { url, key };
}
export function appUrl() {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://127.0.0.1:3000";
}
