import { dealPiles, topCard } from './deck';
import { evaluateHand } from './evaluator';
import { HOLD_SLOT_COUNT, MAX_HAND_SIZE } from './types';
import type { Card, HandResult, Pile } from './types';

/** A tap targets either a pile's face-up top card or a banked card in a hold slot. */
export type SelectionEntry =
  | { origin: 'pile'; index: number }
  | { origin: 'held'; index: number };

export type GameState = {
  /** UTC date key identifying the puzzle, e.g. "2026-08-03". */
  dateKey: string;
  piles: Pile[];
  /** Cards banked out of a pile for a later hand; length is always HOLD_SLOT_COUNT. */
  held: (Card | null)[];
  /** Entries currently selected for the in-progress hand, in tap order. */
  selected: SelectionEntry[];
  hands: HandResult[];
  total: number;
  status: 'playing' | 'complete';
};

export type GameAction =
  | { type: 'toggle'; pile: number }
  | { type: 'toggleHeld'; slot: number }
  | { type: 'hold'; pile: number }
  | { type: 'clear' }
  | { type: 'submit' }
  | { type: 'newGame'; dateKey: string };

export function initGame(dateKey: string): GameState {
  return {
    dateKey,
    piles: dealPiles(dateKey),
    held: Array(HOLD_SLOT_COUNT).fill(null),
    selected: [],
    hands: [],
    total: 0,
    status: 'playing',
  };
}

/** The cards backing the current selection (pile-origin or held-origin), in tap order. */
export function selectedCards(state: GameState): Card[] {
  return state.selected
    .map((entry) => (entry.origin === 'pile' ? topCard(state.piles[entry.index]) : state.held[entry.index]))
    .filter((c): c is Card => c !== null);
}

/** Pile indices currently selected, for components that only render pile state. */
export function selectedPileIndices(state: GameState): number[] {
  return state.selected.filter((e) => e.origin === 'pile').map((e) => e.index);
}

/** Hold-slot indices currently selected, for components that only render held state. */
export function selectedHeldIndices(state: GameState): number[] {
  return state.selected.filter((e) => e.origin === 'held').map((e) => e.index);
}

export function heldCount(state: GameState): number {
  return state.held.filter((c) => c !== null).length;
}

/** Index of the first empty hold slot, or -1 if both are occupied. */
export function openHoldSlot(state: GameState): number {
  return state.held.findIndex((c) => c === null);
}

export function cardsRemaining(state: GameState): number {
  return state.piles.reduce((sum, pile) => sum + pile.length, 0);
}

/** Piles that still hold cards — one factor in how large the next hand can be. */
export function livePileCount(state: GameState): number {
  return state.piles.filter((pile) => pile.length > 0).length;
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'toggle': {
      if (state.status !== 'playing') return state;
      const pile = state.piles[action.pile];
      if (!pile || pile.length === 0) return state;

      const already = state.selected.some((e) => e.origin === 'pile' && e.index === action.pile);
      if (already) {
        return {
          ...state,
          selected: state.selected.filter((e) => !(e.origin === 'pile' && e.index === action.pile)),
        };
      }
      // Only a pile's top card is ever selectable, so "one card per pile" holds by construction.
      if (state.selected.length >= MAX_HAND_SIZE) return state;
      return { ...state, selected: [...state.selected, { origin: 'pile', index: action.pile }] };
    }

    case 'toggleHeld': {
      if (state.status !== 'playing') return state;
      if (state.held[action.slot] == null) return state;

      const already = state.selected.some((e) => e.origin === 'held' && e.index === action.slot);
      if (already) {
        return {
          ...state,
          selected: state.selected.filter((e) => !(e.origin === 'held' && e.index === action.slot)),
        };
      }
      if (state.selected.length >= MAX_HAND_SIZE) return state;
      return { ...state, selected: [...state.selected, { origin: 'held', index: action.slot }] };
    }

    case 'hold': {
      if (state.status !== 'playing') return state;
      const pile = state.piles[action.pile];
      const card = pile ? topCard(pile) : null;
      if (!card) return state;
      // The card is about to move; a stale selection pointing at this pile would silently
      // start referring to whatever card is revealed underneath.
      if (state.selected.some((e) => e.origin === 'pile' && e.index === action.pile)) return state;

      const slot = openHoldSlot(state);
      if (slot === -1) return state;

      const piles = state.piles.map((p, i) => (i === action.pile ? p.slice(0, -1) : p));
      const held = state.held.map((c, i) => (i === slot ? card : c));
      // Banking a card can only ever fill a slot, never empty every pile *and* every hold slot
      // at once, so this action can never complete the game — status is left untouched.
      return { ...state, piles, held };
    }

    case 'clear':
      return state.selected.length === 0 ? state : { ...state, selected: [] };

    case 'submit': {
      if (state.status !== 'playing' || state.selected.length === 0) return state;

      const result = evaluateHand(selectedCards(state));
      const takenPiles = new Set(state.selected.filter((e) => e.origin === 'pile').map((e) => e.index));
      const takenHeld = new Set(state.selected.filter((e) => e.origin === 'held').map((e) => e.index));

      const piles = state.piles.map((pile, i) => (takenPiles.has(i) ? pile.slice(0, -1) : pile));
      const held = state.held.map((card, i) => (takenHeld.has(i) ? null : card));
      const exhausted = piles.every((pile) => pile.length === 0) && held.every((c) => c === null);

      return {
        ...state,
        piles,
        held,
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
