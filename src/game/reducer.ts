import { dealPiles, topCard } from './deck';
import { evaluateHand } from './evaluator';
import { MAX_HAND_SIZE } from './types';
import type { Card, HandResult, Pile } from './types';

export type GameState = {
  /** UTC date key identifying the puzzle, e.g. "2026-08-03". */
  dateKey: string;
  piles: Pile[];
  /** Indices of the piles whose face-up card is currently selected, in tap order. */
  selected: number[];
  hands: HandResult[];
  total: number;
  status: 'playing' | 'complete';
};

export type GameAction =
  | { type: 'toggle'; pile: number }
  | { type: 'clear' }
  | { type: 'submit' }
  | { type: 'newGame'; dateKey: string };

export function initGame(dateKey: string): GameState {
  return {
    dateKey,
    piles: dealPiles(dateKey),
    selected: [],
    hands: [],
    total: 0,
    status: 'playing',
  };
}

/** The face-up cards backing the current selection, in tap order. */
export function selectedCards(state: GameState): Card[] {
  return state.selected
    .map((i) => topCard(state.piles[i]))
    .filter((c): c is Card => c !== null);
}

export function cardsRemaining(state: GameState): number {
  return state.piles.reduce((sum, pile) => sum + pile.length, 0);
}

/** Piles that still hold cards — the cap on how large the next hand can be. */
export function livePileCount(state: GameState): number {
  return state.piles.filter((pile) => pile.length > 0).length;
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'toggle': {
      if (state.status !== 'playing') return state;
      const pile = state.piles[action.pile];
      if (!pile || pile.length === 0) return state;

      if (state.selected.includes(action.pile)) {
        return { ...state, selected: state.selected.filter((i) => i !== action.pile) };
      }
      // Only a pile's top card is ever selectable, so "one card per pile" holds by construction.
      if (state.selected.length >= MAX_HAND_SIZE) return state;
      return { ...state, selected: [...state.selected, action.pile] };
    }

    case 'clear':
      return state.selected.length === 0 ? state : { ...state, selected: [] };

    case 'submit': {
      if (state.status !== 'playing' || state.selected.length === 0) return state;

      const result = evaluateHand(selectedCards(state));
      const taken = new Set(state.selected);
      const piles = state.piles.map((pile, i) => (taken.has(i) ? pile.slice(0, -1) : pile));
      const exhausted = piles.every((pile) => pile.length === 0);

      return {
        ...state,
        piles,
        selected: [],
        hands: [...state.hands, result],
        total: state.total + result.score,
        status: exhausted ? 'complete' : 'playing',
      };
    }

    case 'newGame':
      return initGame(action.dateKey);

    default:
      return state;
  }
}
