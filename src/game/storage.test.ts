import { beforeEach, describe, expect, it } from 'vitest';
import { initGame } from './reducer';
import {
  clearGame,
  hasSeenHelp,
  loadGame,
  loadStats,
  markHelpSeen,
  recordRun,
  saveGame,
} from './storage';
import type { Card, HandResult } from './types';

const SEED = '2026-08-03';
const GAME_KEY = 'pokerpiles:v2:game';

/** A Map-backed Storage stub, with per-method overrides for exercising the
 * Safari-private-mode paths where a real localStorage throws. */
function makeFakeStorage(overrides: Partial<Storage> = {}): Storage {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear: () => store.clear(),
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    key: (index: number) => [...store.keys()][index] ?? null,
    removeItem: (key: string) => {
      store.delete(key);
    },
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    ...overrides,
  };
}

beforeEach(() => {
  globalThis.localStorage = makeFakeStorage();
});

describe('saveGame / loadGame', () => {
  it('round-trips an in-progress game', () => {
    const state = initGame(SEED);
    saveGame(state);
    expect(loadGame(SEED)).toEqual(state);
  });

  it('returns null when nothing is saved', () => {
    expect(loadGame(SEED)).toBeNull();
  });

  it('discards a save for a different UTC day', () => {
    saveGame(initGame(SEED));
    expect(loadGame('2026-08-04')).toBeNull();
  });

  it('clears a saved game', () => {
    saveGame(initGame(SEED));
    clearGame();
    expect(loadGame(SEED)).toBeNull();
  });

  it('migrates a legacy selected array of bare pile-index numbers', () => {
    const state = initGame(SEED);
    localStorage.setItem(GAME_KEY, JSON.stringify({ ...state, selected: [0, 2] }));
    expect(loadGame(SEED)?.selected).toEqual([
      { origin: 'pile', index: 0 },
      { origin: 'pile', index: 2 },
    ]);
  });

  it('defaults recorded to false for a save predating PP-1', () => {
    const state = initGame(SEED);
    const { recorded: _recorded, ...legacy } = state;
    localStorage.setItem(GAME_KEY, JSON.stringify(legacy));
    expect(loadGame(SEED)?.recorded).toBe(false);
  });

  it('rejects an out-of-range pile index in selected', () => {
    const state = initGame(SEED);
    saveGame({ ...state, selected: [{ origin: 'pile', index: 99 }] });
    expect(loadGame(SEED)).toBeNull();
  });

  it('rejects an out-of-range held index in selected', () => {
    const state = initGame(SEED);
    saveGame({ ...state, selected: [{ origin: 'held', index: 5 }] });
    expect(loadGame(SEED)).toBeNull();
  });

  it('rejects a malformed card inside a pile', () => {
    const state = initGame(SEED);
    const badCard = { id: 'x', kind: 'normal', rank: 99, suit: 'S' } as unknown as Card;
    const piles = state.piles.map((p, i) => (i === 0 ? [...p.slice(0, -1), badCard] : p));
    saveGame({ ...state, piles });
    expect(loadGame(SEED)).toBeNull();
  });

  it('rejects a tampered hand score', () => {
    const state = initGame(SEED);
    const hands: HandResult[] = [{ category: 'PAIR', score: 999, cardCount: 2 }];
    saveGame({ ...state, hands });
    expect(loadGame(SEED)).toBeNull();
  });

  it('rejects an unrecognised status', () => {
    const state = initGame(SEED);
    localStorage.setItem(GAME_KEY, JSON.stringify({ ...state, status: 'bogus' }));
    expect(loadGame(SEED)).toBeNull();
  });

  it('rejects a negative total', () => {
    const state = initGame(SEED);
    saveGame({ ...state, total: -5 });
    expect(loadGame(SEED)).toBeNull();
  });
});

describe('stats', () => {
  it('starts at zero for a fresh day', () => {
    expect(loadStats(SEED)).toEqual({ dateKey: SEED, lastScore: 0, bestScore: 0, plays: 0 });
  });

  it('accumulates plays and tracks the best score across calls', () => {
    recordRun(SEED, 40);
    const after = recordRun(SEED, 25);
    expect(after).toEqual({ dateKey: SEED, lastScore: 25, bestScore: 40, plays: 2 });
  });

  it('resets stats for a new day', () => {
    recordRun(SEED, 40);
    expect(loadStats('2026-08-04').plays).toBe(0);
  });
});

describe('help flag', () => {
  it('is unseen until marked', () => {
    expect(hasSeenHelp()).toBe(false);
    markHelpSeen();
    expect(hasSeenHelp()).toBe(true);
  });
});

describe('private-mode / quota failures', () => {
  it('swallows a throwing setItem rather than crashing the caller', () => {
    globalThis.localStorage = makeFakeStorage({
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
    });
    expect(() => saveGame(initGame(SEED))).not.toThrow();
    expect(() => recordRun(SEED, 10)).not.toThrow();
    expect(() => markHelpSeen()).not.toThrow();
  });

  it('swallows a throwing getItem rather than crashing the caller', () => {
    globalThis.localStorage = makeFakeStorage({
      getItem: () => {
        throw new Error('SecurityError');
      },
    });
    expect(() => loadGame(SEED)).not.toThrow();
    expect(loadGame(SEED)).toBeNull();
    expect(hasSeenHelp()).toBe(false);
  });
});
