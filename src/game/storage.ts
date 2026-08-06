import { CATEGORY_POINTS, HOLD_SLOT_COUNT, PILE_COUNT, PILE_SIZE } from './types';
import type { Card, HandCategory, HandResult, Pile } from './types';
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
// Keep this key literal in sync with the inline bootstrap script in index.html,
// which reads it before React (and this module) ever loads, to paint the right
// theme on first frame instead of flashing the wrong one then swapping.
const THEME_KEY = 'pokerpiles:v2:theme';

/** `'light'` is the default Party palette (dark-grounded); `'dark'` is the
 *  light-grounded theme (see styles.css). The values are stored in
 *  localStorage and read by the inline script in index.html, so they stay
 *  as-is even though `'dark'` no longer means a dark theme. */
export type Theme = 'light' | 'dark';

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

/**
 * Deep validation for a saved `GameState`, so a malformed or tampered save is
 * discarded rather than trusted — see PP-2. `loadGame`'s old top-level-only
 * checks let an out-of-range `selected` index or a bogus card reach the
 * reducer/evaluator and throw, white-screening the app with no recovery path.
 * Discarding a bad save is always recoverable; crashing on it is not.
 */

const VALID_SUITS = new Set(['S', 'H', 'D', 'C']);
const VALID_CATEGORIES = new Set(Object.keys(CATEGORY_POINTS) as HandCategory[]);

function isValidCard(value: unknown): value is Card {
  if (typeof value !== 'object' || value === null) return false;
  const card = value as Record<string, unknown>;
  if (typeof card.id !== 'string') return false;
  if (card.kind === 'wild') return true;
  return (
    card.kind === 'normal' &&
    typeof card.rank === 'number' &&
    Number.isInteger(card.rank) &&
    card.rank >= 2 &&
    card.rank <= 14 &&
    typeof card.suit === 'string' &&
    VALID_SUITS.has(card.suit)
  );
}

function isValidPile(value: unknown): value is Pile {
  return Array.isArray(value) && value.length <= PILE_SIZE && value.every(isValidCard);
}

function isValidHeldSlot(value: unknown): value is Card | null {
  return value === null || isValidCard(value);
}

function isValidHandResult(value: unknown): value is HandResult {
  if (typeof value !== 'object' || value === null) return false;
  const hand = value as Record<string, unknown>;
  return (
    typeof hand.category === 'string' &&
    VALID_CATEGORIES.has(hand.category as HandCategory) &&
    hand.score === CATEGORY_POINTS[hand.category as HandCategory] &&
    typeof hand.cardCount === 'number' &&
    Number.isInteger(hand.cardCount) &&
    hand.cardCount >= 1 &&
    hand.cardCount <= 5
  );
}

function isValidSelectionEntry(value: unknown, pileCount: number, heldCount: number): value is SelectionEntry {
  if (typeof value !== 'object' || value === null) return false;
  const entry = value as Record<string, unknown>;
  if (typeof entry.index !== 'number' || !Number.isInteger(entry.index)) return false;
  if (entry.origin === 'pile') return entry.index >= 0 && entry.index < pileCount;
  if (entry.origin === 'held') return entry.index >= 0 && entry.index < heldCount;
  return false;
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

/** The explicit theme choice, if the player has ever toggled it — absent otherwise. */
export function loadTheme(): Theme | null {
  try {
    const raw = localStorage.getItem(THEME_KEY);
    return raw === 'light' || raw === 'dark' ? raw : null;
  } catch {
    return null;
  }
}

export function saveTheme(theme: Theme): void {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // Ignored — worst case the choice doesn't survive a reload.
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
 * Anything stale or malformed is discarded rather than trusted — every field
 * is validated, not just top-level shape, since a bad `selected` index or a
 * bogus card reaches the reducer/evaluator and throws (PP-2). Saves from
 * before hold slots existed lack `held` and store `selected` as plain
 * pile-index numbers — those are migrated in place rather than discarded, so
 * a returning player doesn't lose their run over it. Saves from before
 * drained piles could become extra hold slots lack `pileHoldIndex` (and
 * `held` may be shorter than a run that has since grown past
 * HOLD_SLOT_COUNT) — both are defaulted too. Saves from before PP-1 lack
 * `recorded` — defaulted to false, which re-records that one run at most.
 */
export function loadGame(dateKey: string): GameState | null {
  const stored = readJson<Record<string, unknown>>(GAME_KEY);
  if (!stored || stored.dateKey !== dateKey) return null;

  if (!Array.isArray(stored.piles) || stored.piles.length !== PILE_COUNT || !stored.piles.every(isValidPile)) {
    return null;
  }
  if (!Array.isArray(stored.hands) || !stored.hands.every(isValidHandResult)) return null;
  if (typeof stored.total !== 'number' || !Number.isFinite(stored.total) || stored.total < 0) return null;
  if (stored.status !== 'playing' && stored.status !== 'complete') return null;
  if (stored.gaveUp !== undefined && typeof stored.gaveUp !== 'boolean') return null;
  if (stored.recorded !== undefined && typeof stored.recorded !== 'boolean') return null;

  const held = stored.held ?? Array(HOLD_SLOT_COUNT).fill(null);
  if (!Array.isArray(held) || held.length < HOLD_SLOT_COUNT || !held.every(isValidHeldSlot)) return null;

  const pileHoldIndex = stored.pileHoldIndex ?? Array(PILE_COUNT).fill(null);
  if (
    !Array.isArray(pileHoldIndex) ||
    pileHoldIndex.length !== PILE_COUNT ||
    !pileHoldIndex.every((i) => i === null || (typeof i === 'number' && Number.isInteger(i) && i >= 0 && i < held.length))
  ) {
    return null;
  }

  if (!Array.isArray(stored.selected)) return null;
  const selected: SelectionEntry[] = stored.selected.map((e) =>
    typeof e === 'number' ? { origin: 'pile', index: e } : (e as SelectionEntry),
  );
  if (!selected.every((e) => isValidSelectionEntry(e, PILE_COUNT, held.length))) return null;

  return {
    dateKey,
    piles: stored.piles,
    held,
    pileHoldIndex,
    selected,
    hands: stored.hands,
    total: stored.total,
    status: stored.status,
    gaveUp: stored.gaveUp ?? false,
    recorded: stored.recorded ?? false,
  };
}
