import { PILE_COUNT, PILE_SIZE, RANKS, SUITS, WILD_COUNT } from './types';
import type { Card, Pile } from './types';
import { rngFromSeed } from './rng';
import type { Rng } from './rng';

/** The 56-card deck: a standard 52 plus 4 fully-wild cards. Always in canonical order. */
export function buildDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ id: `${rank}${suit}`, kind: 'normal', rank, suit });
    }
  }
  for (let i = 0; i < WILD_COUNT; i++) {
    deck.push({ id: `w${i + 1}`, kind: 'wild' });
  }
  return deck;
}

/** Fisher-Yates, driven entirely by the supplied generator. Returns a new array. */
export function shuffle<T>(cards: readonly T[], rng: Rng): T[] {
  const out = cards.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * The whole deal is a pure function of the date string.
 * Each pile holds 7 cards; the last element is the face-up top card.
 */
export function dealPiles(seed: string): Pile[] {
  const shuffled = shuffle(buildDeck(), rngFromSeed(seed));
  const piles: Pile[] = [];
  for (let i = 0; i < PILE_COUNT; i++) {
    piles.push(shuffled.slice(i * PILE_SIZE, (i + 1) * PILE_SIZE));
  }
  return piles;
}

/** The face-up card of a pile, or null when the pile is exhausted. */
export function topCard(pile: Pile): Card | null {
  return pile.length > 0 ? pile[pile.length - 1] : null;
}
