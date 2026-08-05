import { dealPiles, topCard } from './deck';
import { evaluateHand } from './evaluator';
import { HOLD_SLOT_COUNT, MAX_HAND_SIZE, PILE_COUNT } from './types';
import type { Card, HandResult, Pile } from './types';

/** A tap targets either a pile's face-up top card or a banked card in a hold slot. */
export type SelectionEntry =
  | { origin: 'pile'; index: number }
  | { origin: 'held'; index: number };

export type GameState = {
  /** UTC date key identifying the puzzle, e.g. "2026-08-03". */
  dateKey: string;
  piles: Pile[];
  /**
   * Cards banked for a later hand. Starts at HOLD_SLOT_COUNT (the fixed hold
   * tray) and grows by one slot every time a pile drains for the first time —
   * see `pileHoldIndex`. Every consumer here treats it as an opaque array of
   * nullable slots, so growth needs no other reducer changes.
   */
  held: (Card | null)[];
  /**
   * Parallel to `piles`. Null until a pile drains naturally (via `submit` or
   * `hold`), at which point it holds that pile's index into `held` — the
   * extra hold slot it became. A pile emptied by `giveUp` is never assigned
   * one, since the run is already over by then.
   */
  pileHoldIndex: (number | null)[];
  /** Entries currently selected for the in-progress hand, in tap order. */
  selected: SelectionEntry[];
  hands: HandResult[];
  total: number;
  status: 'playing' | 'complete';
  /** True when the run ended via `giveUp` rather than by clearing the board. */
  gaveUp: boolean;
};

export type GameAction =
  | { type: 'toggle'; pile: number }
  | { type: 'toggleHeld'; slot: number }
  | { type: 'hold'; pile: number; slot?: number }
  | { type: 'clear' }
  | { type: 'submit' }
  | { type: 'giveUp' }
  | { type: 'newGame'; dateKey: string };

export function initGame(dateKey: string): GameState {
  return {
    dateKey,
    piles: dealPiles(dateKey),
    held: Array(HOLD_SLOT_COUNT).fill(null),
    pileHoldIndex: Array(PILE_COUNT).fill(null),
    selected: [],
    hands: [],
    total: 0,
    status: 'playing',
    gaveUp: false,
  };
}

/**
 * A pile that just drained for the first time becomes an extra hold slot in
 * its own right. Appends one new slot to `held` per newly-drained pile and
 * records the mapping in `pileHoldIndex` — the only place either array grows,
 * so the two never drift out of lockstep.
 */
function growHoldForDrainedPiles(
  piles: Pile[],
  held: (Card | null)[],
  pileHoldIndex: (number | null)[],
): { held: (Card | null)[]; pileHoldIndex: (number | null)[] } {
  let nextHeld = held;
  let nextIndex = pileHoldIndex;
  piles.forEach((pile, i) => {
    if (pile.length === 0 && nextIndex[i] === null) {
      if (nextHeld === held) nextHeld = [...held];
      if (nextIndex === pileHoldIndex) nextIndex = [...pileHoldIndex];
      nextIndex[i] = nextHeld.length;
      nextHeld.push(null);
    }
  });
  return { held: nextHeld, pileHoldIndex: nextIndex };
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

      // A specific slot is passed when the player armed it explicitly (tapped
      // the empty slot, then the card); otherwise fall back to the first open one.
      const slot = action.slot ?? openHoldSlot(state);
      if (slot === -1 || state.held[slot] != null) return state;

      const piles = state.piles.map((p, i) => (i === action.pile ? p.slice(0, -1) : p));
      const heldAfterBank = state.held.map((c, i) => (i === slot ? card : c));
      // Banking the last card of a pile drains it just like playing it would,
      // so it converts into its own extra hold slot the same way.
      const { held, pileHoldIndex } = growHoldForDrainedPiles(piles, heldAfterBank, state.pileHoldIndex);
      // The card is about to move; a stale selection pointing at this pile would silently
      // start referring to whatever card is revealed underneath, so drop it — this is also
      // how "select a card, then tap an empty hold slot" banks the selected card.
      const selected = state.selected.some((e) => e.origin === 'pile' && e.index === action.pile)
        ? state.selected.filter((e) => !(e.origin === 'pile' && e.index === action.pile))
        : state.selected;
      // Banking a card can only ever fill a slot, never empty every pile *and* every hold slot
      // at once, so this action can never complete the game — status is left untouched.
      return { ...state, piles, held, pileHoldIndex, selected };
    }

    case 'clear':
      return state.selected.length === 0 ? state : { ...state, selected: [] };

    case 'submit': {
      if (state.status !== 'playing' || state.selected.length === 0) return state;

      const result = evaluateHand(selectedCards(state));
      const takenPiles = new Set(state.selected.filter((e) => e.origin === 'pile').map((e) => e.index));
      const takenHeld = new Set(state.selected.filter((e) => e.origin === 'held').map((e) => e.index));

      const piles = state.piles.map((pile, i) => (takenPiles.has(i) ? pile.slice(0, -1) : pile));
      const heldAfterPlay = state.held.map((card, i) => (takenHeld.has(i) ? null : card));
      const { held, pileHoldIndex } = growHoldForDrainedPiles(piles, heldAfterPlay, state.pileHoldIndex);
      const exhausted = piles.every((pile) => pile.length === 0) && held.every((c) => c === null);

      return {
        ...state,
        piles,
        held,
        pileHoldIndex,
        selected: [],
        hands: [...state.hands, result],
        total: state.total + result.score,
        status: exhausted ? 'complete' : 'playing',
      };
    }

    case 'giveUp': {
      if (state.status !== 'playing') return state;

      // A forfeit, not an auto-play: the remaining cards are discarded unscored.
      // Playing them out singly would score nothing anyway (a lone card is a High
      // Card, worth zero) and would only bury the run's real hands under a stack
      // of zero-point rows in the results sheet.
      return {
        ...state,
        piles: state.piles.map(() => []),
        held: state.held.map(() => null),
        selected: [],
        gaveUp: true,
        status: 'complete',
      };
    }

    case 'newGame':
      return initGame(action.dateKey);

    default:
      return state;
  }
}
