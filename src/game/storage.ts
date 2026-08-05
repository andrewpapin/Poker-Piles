import { HOLD_SLOT_COUNT, PILE_COUNT } from './types';
import type { GameState, SelectionEntry } from './reducer';

/**
 * Local-only persistence. Nothing is synced anywhere and nothing survives a new
 * UTC day, so there is no streak or cross-day history here (deferred past v1).
 * Every access is guarded: Safari private mode throws on localStorage writes.
 */

/**
 * Bumped to v2 with the scoring change: a run or a best-score saved under the
 * old size-scaled rules is not comparable to one scored under these, so the old
 * keys are abandoned rather than migrated. The help key rides along so returning
 * players are shown the changed rules once.
 */
const STATS_KEY = 'pokerpiles:v2:stats';
const GAME_KEY = 'pokerpiles:v2:game';
const HELP_KEY = 'pokerpiles:v2:seenHelp';

export type DailyStats = {
  dateKey: string;
  lastScore: number;
  bestScore: number;
  plays: number;
};

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage unavailable or full — the game plays fine without it.
  }
}

function remove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // Ignored, same reasoning as above.
  }
}

export function loadStats(dateKey: string): DailyStats {
  const stored = readJson<DailyStats>(STATS_KEY);
  if (stored && stored.dateKey === dateKey && typeof stored.bestScore === 'number') {
    return stored;
  }
  return { dateKey, lastScore: 0, bestScore: 0, plays: 0 };
}

/** Records a finished run against today's puzzle. */
export function recordRun(dateKey: string, score: number): DailyStats {
  const current = loadStats(dateKey);
  const updated: DailyStats = {
    dateKey,
    lastScore: score,
    bestScore: Math.max(current.bestScore, score),
    plays: current.plays + 1,
  };
  writeJson(STATS_KEY, updated);
  return updated;
}

/** The rules sheet opens by itself only on a player's very first visit. */
export function hasSeenHelp(): boolean {
  try {
    return localStorage.getItem(HELP_KEY) === '1';
  } catch {
    return false;
  }
}

export function markHelpSeen(): void {
  try {
    localStorage.setItem(HELP_KEY, '1');
  } catch {
    // Ignored — worst case the sheet greets them again next visit.
  }
}

export function saveGame(state: GameState): void {
  writeJson(GAME_KEY, state);
}

export function clearGame(): void {
  remove(GAME_KEY);
}

/**
 * Restores an in-progress run so a backgrounded mobile tab does not lose it.
 * Anything stale or malformed is discarded rather than trusted. Saves from before hold slots
 * existed lack `held` and store `selected` as plain pile-index numbers — those are migrated
 * in place rather than discarded, so a returning player doesn't lose their run over it.
 */
export function loadGame(dateKey: string): GameState | null {
  const stored = readJson<GameState & { selected: unknown[] }>(GAME_KEY);
  if (
    !stored ||
    stored.dateKey !== dateKey ||
    !Array.isArray(stored.piles) ||
    stored.piles.length !== PILE_COUNT ||
    !Array.isArray(stored.hands) ||
    !Array.isArray(stored.selected) ||
    typeof stored.total !== 'number' ||
    (stored.held !== undefined && (!Array.isArray(stored.held) || stored.held.length !== HOLD_SLOT_COUNT))
  ) {
    return null;
  }

  const held = stored.held ?? Array(HOLD_SLOT_COUNT).fill(null);
  const selected: SelectionEntry[] = stored.selected.map((e) =>
    typeof e === 'number' ? { origin: 'pile', index: e } : (e as SelectionEntry),
  );
  return { ...stored, held, selected, gaveUp: stored.gaveUp ?? false };
}
