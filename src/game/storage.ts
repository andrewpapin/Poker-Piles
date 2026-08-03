import { PILE_COUNT } from './types';
import type { GameState } from './reducer';

/**
 * Local-only persistence. Nothing is synced anywhere and nothing survives a new
 * UTC day, so there is no streak or cross-day history here (deferred past v1).
 * Every access is guarded: Safari private mode throws on localStorage writes.
 */

const STATS_KEY = 'pokerpiles:v1:stats';
const GAME_KEY = 'pokerpiles:v1:game';
const HELP_KEY = 'pokerpiles:v1:seenHelp';

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
 * Anything stale or malformed is discarded rather than trusted.
 */
export function loadGame(dateKey: string): GameState | null {
  const stored = readJson<GameState>(GAME_KEY);
  if (
    !stored ||
    stored.dateKey !== dateKey ||
    !Array.isArray(stored.piles) ||
    stored.piles.length !== PILE_COUNT ||
    !Array.isArray(stored.hands) ||
    !Array.isArray(stored.selected) ||
    typeof stored.total !== 'number'
  ) {
    return null;
  }
  return stored;
}
