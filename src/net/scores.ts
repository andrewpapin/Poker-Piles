import { REQUEST_TIMEOUT_MS, SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from './config';

/**
 * The game's only network I/O: publishing a finished run's score and reading
 * back the day's average. Everything here is best-effort by design — every
 * entry point resolves to `null` rather than throwing, because a player with
 * no signal, a blocked request or a paused database must still get their
 * results sheet. Nothing in `src/game/` imports this module; the wiring lives
 * in `App.tsx`, so the game rules stay pure and offline-complete.
 *
 * There are no accounts, so a run is attributed to a random client id this
 * module mints once per browser. It identifies nobody — it exists only so the
 * server can keep one score per browser per day, and it is never displayed,
 * shared or sent anywhere but the `submit_run` call.
 */

/** Today's community numbers, as returned by both RPCs. */
export type DailySummary = {
  /** Mean score across every run counted today, to one decimal place. */
  average: number;
  /** How many runs that average is over — 1 means the player is the first in. */
  plays: number;
};

export type FinishedRun = {
  score: number;
  hands: number;
  gaveUp: boolean;
};

/**
 * Deliberately unversioned, unlike the `pokerpiles:v2:*` game keys. Those are
 * bumped when a stored *score* stops being comparable; this identifies the
 * browser, not a run, and resetting it would let one player's replays land as
 * several separate scores in the daily average.
 */
const CLIENT_ID_KEY = 'pokerpiles:clientId';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function randomUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // iOS Safari below 15.4 has getRandomValues but not randomUUID. Build a
  // v4 UUID by hand rather than dropping those players out of the average.
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  const groups = [
    [0, 8],
    [8, 12],
    [12, 16],
    [16, 20],
    [20, 32],
  ] as const;
  return groups.map(([from, to]) => hex.slice(from, to)).join('-');
}

/**
 * The browser's anonymous id, minted on first use. A malformed or missing
 * value is replaced rather than trusted — the server types the column as
 * `uuid` and would reject anything else, costing the player their entry.
 * If localStorage is unavailable (Safari private mode throws on write) the
 * id is still returned, so the run counts; it just won't dedupe on replay.
 */
export function clientId(): string {
  try {
    const stored = localStorage.getItem(CLIENT_ID_KEY);
    if (stored && UUID_RE.test(stored)) return stored;
  } catch {
    // Unreadable storage — fall through and mint a throwaway id.
  }
  const minted = randomUuid();
  try {
    localStorage.setItem(CLIENT_ID_KEY, minted);
  } catch {
    // Ignored: the run still counts, it just can't be deduped later.
  }
  return minted;
}

/** Coerces PostgREST's numeric output, which may arrive as a JSON string. */
function toNumber(value: unknown): number | null {
  const n = typeof value === 'string' ? Number(value) : value;
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
}

function toSummary(payload: unknown): DailySummary | null {
  // Both functions `returns table (...)`, which PostgREST renders as an array
  // of one row.
  const row = Array.isArray(payload) ? payload[0] : payload;
  if (typeof row !== 'object' || row === null) return null;
  const average = toNumber((row as Record<string, unknown>).average);
  const plays = toNumber((row as Record<string, unknown>).plays);
  if (average === null || plays === null || plays < 0) return null;
  return { average, plays };
}

async function rpc(fn: string, body: Record<string, unknown>): Promise<DailySummary | null> {
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) return null;

  // AbortSignal.timeout is too new to rely on across the mobile browsers this
  // targets, so the timer is wired up by hand.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!response.ok) return null;
    return toSummary(await response.json());
  } catch {
    // Offline, blocked, aborted, or malformed JSON — all the same to a caller
    // that just hides the community line.
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Publishes a finished run and returns the day's numbers including it.
 *
 * The date is stamped server-side from the UTC clock, and the server keeps
 * only the first run per browser per day — a replay still gets an answer to
 * display, it just doesn't move the average. That makes this safe to call on
 * every completion, including one restored from a reload, with no local
 * "already uploaded" bookkeeping to drift out of sync.
 */
export function submitRun(run: FinishedRun): Promise<DailySummary | null> {
  if (!Number.isFinite(run.score) || run.score < 0) return Promise.resolve(null);
  return rpc('submit_run', {
    p_client_id: clientId(),
    p_score: Math.round(run.score),
    p_hands: Math.round(run.hands),
    p_gave_up: run.gaveUp,
  });
}

/**
 * Today's average without contributing a run. The game only ever needs the
 * write path (`submitRun` returns the same numbers), but the read half is the
 * other server function and is what any "check today's average" surface would use.
 */
export function fetchDailySummary(): Promise<DailySummary | null> {
  return rpc('daily_summary', {});
}
