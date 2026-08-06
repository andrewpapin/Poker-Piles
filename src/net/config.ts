/**
 * Supabase connection details for the anonymous score collection.
 *
 * These are committed on purpose. The publishable key is the browser-facing
 * half of a Supabase project — it identifies the project, it does not
 * authorise anything. Every table here is behind row-level security with no
 * policies at all, so the key can reach exactly two security-definer
 * functions (`submit_run` and `daily_summary`) and nothing else. Hiding it in
 * a build secret would buy no safety and would silently disable scoring for
 * anyone who forked or cloned the repo without setting the variable.
 *
 * The env overrides exist so a fork can point at its own project without
 * editing source.
 */
export const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL ?? 'https://rumfabbkwtuewyyyfleb.supabase.co';

export const SUPABASE_PUBLISHABLE_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? 'sb_publishable_fVzPxqFfF62a7uA73IVEqQ_qSf316_P';

/** Give up on a request well before a stalled network can hold up the results sheet. */
export const REQUEST_TIMEOUT_MS = 8000;
