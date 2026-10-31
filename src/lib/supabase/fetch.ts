import "server-only";
// Bound upstream waits and never cache authenticated responses.
export const supabaseFetch: typeof fetch = (input, init) => {
  const deadline = AbortSignal.timeout(15000);
  const signal = init?.signal
    ? AbortSignal.any([init.signal, deadline])
    : deadline;
  return fetch(input, { ...init, signal, cache: "no-store" });
};
