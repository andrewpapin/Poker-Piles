import { CATEGORY_POINTS, MAX_HAND_SIZE, RANKS, SUITS } from './types';
import type { Card, HandCategory, HandResult, NormalCard, Rank, Suit } from './types';

/**
 * Hand evaluation, independent of any UI.
 *
 * Two regimes:
 *  - 5 cards: the full poker ladder, including straights and flushes.
 *  - fewer than 5 cards: rank-based categories only (a straight or a flush is a
 *    5-card pattern by definition), then a flat 50% penalty.
 *
 * Wild cards are always resolved to whatever identity scores highest.
 */

/** Yields every multiset of size k drawn from items (order within a hand is irrelevant). */
function* combosWithReplacement<T>(items: readonly T[], k: number): Generator<T[]> {
  if (k === 0) {
    yield [];
    return;
  }
  const n = items.length;
  if (n === 0) return;
  const idx = new Array<number>(k).fill(0);
  for (;;) {
    yield idx.map((i) => items[i]);
    let i = k - 1;
    while (i >= 0 && idx[i] === n - 1) i--;
    if (i < 0) return;
    const next = idx[i] + 1;
    for (let j = i; j < k; j++) idx[j] = next;
  }
}

/** Rank -> how many times it appears, sorted descending by count. */
function rankCounts(ranks: readonly Rank[]): number[] {
  const counts = new Map<Rank, number>();
  for (const r of ranks) counts.set(r, (counts.get(r) ?? 0) + 1);
  return [...counts.values()].sort((a, b) => b - a);
}

function isStraight(ranks: readonly Rank[]): boolean {
  const unique = [...new Set(ranks)].sort((a, b) => a - b);
  if (unique.length !== MAX_HAND_SIZE) return false;
  if (unique[unique.length - 1] - unique[0] === MAX_HAND_SIZE - 1) return true;
  // The wheel: A-2-3-4-5, where the Ace plays low.
  return unique.join(',') === '2,3,4,5,14';
}

/** Categorises exactly 5 concrete (non-wild) cards. */
export function categorize5(cards: readonly NormalCard[]): HandCategory {
  const ranks = cards.map((c) => c.rank);
  const flush = cards.every((c) => c.suit === cards[0].suit);
  const straight = isStraight(ranks);

  if (straight && flush) {
    const low = Math.min(...ranks);
    // A royal is the only straight flush whose low card is a ten.
    return low === 10 ? 'ROYAL_FLUSH' : 'STRAIGHT_FLUSH';
  }

  const counts = rankCounts(ranks);
  if (counts[0] === 4) return 'FOUR_OF_A_KIND';
  if (counts[0] === 3 && counts[1] === 2) return 'FULL_HOUSE';
  if (flush) return 'FLUSH';
  if (straight) return 'STRAIGHT';
  if (counts[0] === 3) return 'THREE_OF_A_KIND';
  if (counts[0] === 2 && counts[1] === 2) return 'TWO_PAIR';
  if (counts[0] === 2) return 'PAIR';
  return 'HIGH_CARD';
}

/**
 * Categorises fewer than 5 cards using rank patterns only.
 * Straights and flushes are unreachable here, by design.
 */
export function categorizePartial(ranks: readonly Rank[]): HandCategory {
  const counts = rankCounts(ranks);
  if (counts[0] >= 4) return 'FOUR_OF_A_KIND';
  if (counts[0] === 3) return 'THREE_OF_A_KIND';
  if (counts[0] === 2 && counts[1] === 2) return 'TWO_PAIR';
  if (counts[0] === 2) return 'PAIR';
  return 'HIGH_CARD';
}

function isWild(card: Card): card is Extract<Card, { kind: 'wild' }> {
  return card.kind === 'wild';
}

/**
 * Candidate identities a wild may take in a 5-card hand.
 *
 * Suit only ever matters for flushes, and a flush needs all five cards to share
 * one suit — so that suit must be a suit already held by a natural card. Since
 * the deck holds only 4 wilds, every hand has at least one natural, which keeps
 * this set small exactly when the number of wilds (and thus the combinatorics)
 * is large.
 */
function candidateCards(naturals: readonly NormalCard[]): NormalCard[] {
  const suits: Suit[] = naturals.length > 0 ? [...new Set(naturals.map((c) => c.suit))] : SUITS;
  const out: NormalCard[] = [];
  for (const suit of suits) {
    for (const rank of RANKS) {
      out.push({ id: `x${rank}${suit}`, kind: 'normal', rank, suit });
    }
  }
  return out;
}

/** Best category reachable from a 5-card hand once wilds are resolved optimally. */
function bestCategory5(cards: readonly Card[]): HandCategory {
  const naturals = cards.filter((c): c is NormalCard => !isWild(c));
  const wildCount = cards.length - naturals.length;
  if (wildCount === 0) return categorize5(naturals);

  let best: HandCategory = 'HIGH_CARD';
  let bestPoints = -1;
  for (const assignment of combosWithReplacement(candidateCards(naturals), wildCount)) {
    const category = categorize5([...naturals, ...assignment]);
    const points = CATEGORY_POINTS[category];
    if (points > bestPoints) {
      bestPoints = points;
      best = category;
      if (category === 'ROYAL_FLUSH') break; // Nothing scores higher.
    }
  }
  return best;
}

/** Best category reachable from fewer than 5 cards. Suits are irrelevant here. */
function bestCategoryPartial(cards: readonly Card[]): HandCategory {
  const naturalRanks = cards.filter((c): c is NormalCard => !isWild(c)).map((c) => c.rank);
  const wildCount = cards.length - naturalRanks.length;
  if (wildCount === 0) return categorizePartial(naturalRanks);

  let best: HandCategory = 'HIGH_CARD';
  let bestPoints = -1;
  for (const assignment of combosWithReplacement(RANKS, wildCount)) {
    const category = categorizePartial([...naturalRanks, ...assignment]);
    const points = CATEGORY_POINTS[category];
    if (points > bestPoints) {
      bestPoints = points;
      best = category;
      if (category === 'FOUR_OF_A_KIND') break; // The ceiling for a partial hand.
    }
  }
  return best;
}

/** Wilds are interchangeable, so they collapse to a single token in the cache key. */
function cacheKey(cards: readonly Card[]): string {
  return cards
    .map((c) => (isWild(c) ? 'W' : `${c.rank}${c.suit}`))
    .sort()
    .join('|');
}

const cache = new Map<string, HandResult>();

/**
 * Scores 1-5 cards, resolving any wilds in the player's favour.
 * Hands of fewer than 5 cards take a flat 50% penalty, rounded to the nearest point.
 */
export function evaluateHand(cards: readonly Card[]): HandResult {
  if (cards.length < 1 || cards.length > MAX_HAND_SIZE) {
    throw new Error(`A hand must hold 1-${MAX_HAND_SIZE} cards, got ${cards.length}`);
  }

  const key = cacheKey(cards);
  const cached = cache.get(key);
  if (cached) return cached;

  const partial = cards.length < MAX_HAND_SIZE;
  const category = partial ? bestCategoryPartial(cards) : bestCategory5(cards);
  const basePoints = CATEGORY_POINTS[category];
  const result: HandResult = {
    category,
    basePoints,
    score: partial ? Math.round(basePoints * 0.5) : basePoints,
    cardCount: cards.length,
    partial,
  };

  cache.set(key, result);
  return result;
}
