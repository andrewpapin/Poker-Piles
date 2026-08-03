import { describe, expect, it } from 'vitest';
import { topCard } from './deck';
import {
  cardsRemaining,
  gameReducer,
  initGame,
  livePileCount,
  selectedCards,
} from './reducer';
import type { GameState } from './reducer';
import { PILE_COUNT, PILE_SIZE } from './types';

const SEED = '2026-08-03';
const play = (state: GameState, ...piles: number[]): GameState =>
  gameReducer(piles.reduce((s, p) => gameReducer(s, { type: 'toggle', pile: p }), state), {
    type: 'submit',
  });

describe('initGame', () => {
  it('starts with a full board and an empty scoreboard', () => {
    const state = initGame(SEED);
    expect(cardsRemaining(state)).toBe(PILE_COUNT * PILE_SIZE);
    expect(livePileCount(state)).toBe(PILE_COUNT);
    expect(state).toMatchObject({ selected: [], hands: [], total: 0, status: 'playing' });
  });
});

describe('selection', () => {
  it('toggles a pile on and back off', () => {
    let state = gameReducer(initGame(SEED), { type: 'toggle', pile: 3 });
    expect(state.selected).toEqual([3]);
    state = gameReducer(state, { type: 'toggle', pile: 3 });
    expect(state.selected).toEqual([]);
  });

  it('caps the selection at five piles', () => {
    let state = initGame(SEED);
    for (let i = 0; i < PILE_COUNT; i++) state = gameReducer(state, { type: 'toggle', pile: i });
    expect(state.selected).toEqual([0, 1, 2, 3, 4]);
  });

  it('ignores empty piles', () => {
    const state = initGame(SEED);
    const emptied: GameState = { ...state, piles: state.piles.map((p, i) => (i === 0 ? [] : p)) };
    expect(gameReducer(emptied, { type: 'toggle', pile: 0 }).selected).toEqual([]);
  });

  it('resolves the selection to each pile face-up card, in tap order', () => {
    const state = gameReducer(gameReducer(initGame(SEED), { type: 'toggle', pile: 5 }), {
      type: 'toggle',
      pile: 1,
    });
    expect(selectedCards(state)).toEqual([topCard(state.piles[5]), topCard(state.piles[1])]);
  });

  it('clears the selection', () => {
    const state = gameReducer(initGame(SEED), { type: 'toggle', pile: 2 });
    expect(gameReducer(state, { type: 'clear' }).selected).toEqual([]);
  });
});

describe('submitting a hand', () => {
  it('removes exactly one card from each chosen pile and leaves the rest alone', () => {
    const before = initGame(SEED);
    const after = play(before, 0, 2, 4);

    expect(after.piles[0]).toHaveLength(PILE_SIZE - 1);
    expect(after.piles[2]).toHaveLength(PILE_SIZE - 1);
    expect(after.piles[4]).toHaveLength(PILE_SIZE - 1);
    expect(after.piles[1]).toEqual(before.piles[1]);
    expect(cardsRemaining(after)).toBe(PILE_COUNT * PILE_SIZE - 3);
  });

  it('reveals the next card on a drawn pile and holds it on a skipped one', () => {
    const before = initGame(SEED);
    const after = play(before, 0);
    expect(topCard(after.piles[0])).toEqual(before.piles[0][PILE_SIZE - 2]);
    expect(topCard(after.piles[1])).toEqual(topCard(before.piles[1]));
  });

  it('records the hand, adds its score, and clears the selection', () => {
    const after = play(initGame(SEED), 0, 1, 2, 3, 4);
    expect(after.hands).toHaveLength(1);
    expect(after.total).toBe(after.hands[0].score);
    expect(after.selected).toEqual([]);
  });

  it('does nothing when no cards are selected', () => {
    const state = initGame(SEED);
    expect(gameReducer(state, { type: 'submit' })).toBe(state);
  });
});

describe('a full run', () => {
  it('drains all 56 cards, completes, then freezes', () => {
    let state = initGame(SEED);
    let guard = 0;

    while (state.status === 'playing' && guard++ < 100) {
      const live = state.piles
        .map((pile, i) => (pile.length > 0 ? i : -1))
        .filter((i) => i >= 0)
        .slice(0, 5);
      state = play(state, ...live);
    }

    expect(state.status).toBe('complete');
    expect(cardsRemaining(state)).toBe(0);
    // 56 cards across hands of at most 5 needs at least 12 hands.
    expect(state.hands.length).toBeGreaterThanOrEqual(12);
    expect(state.hands.reduce((sum, h) => sum + h.score, 0)).toBe(state.total);

    // A finished board accepts nothing further.
    expect(gameReducer(state, { type: 'toggle', pile: 0 })).toBe(state);
    expect(gameReducer(state, { type: 'submit' })).toBe(state);
  });

  it('forces partial hands once fewer than five piles survive', () => {
    let state = initGame(SEED);
    // Drain the first three piles by hammering only those.
    for (let i = 0; i < PILE_SIZE; i++) state = play(state, 0, 1, 2);
    expect(livePileCount(state)).toBe(PILE_COUNT - 3);

    // Five piles remain, so a full hand is still reachable...
    state = play(state, 3, 4, 5, 6, 7);
    expect(state.hands[state.hands.length - 1].partial).toBe(false);

    // ...but draining another pile strands the rest as partials.
    let drained = state;
    while (drained.piles[3].length > 0) drained = play(drained, 3);
    expect(livePileCount(drained)).toBe(4);
    const forced = play(drained, 4, 5, 6, 7);
    expect(forced.hands[forced.hands.length - 1].partial).toBe(true);
  });
});

describe('newGame', () => {
  it('redeals the same board for the same day', () => {
    const played = play(initGame(SEED), 0, 1, 2);
    const restarted = gameReducer(played, { type: 'newGame', dateKey: SEED });
    expect(restarted).toEqual(initGame(SEED));
  });
});
