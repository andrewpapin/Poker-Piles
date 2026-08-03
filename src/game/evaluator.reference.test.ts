import { describe, expect, it } from 'vitest';
import { categorize5, evaluateHand } from './evaluator';
import { buildDeck } from './deck';
import { mulberry32 } from './rng';
import { CATEGORY_POINTS, RANKS, SUITS } from './types';
import type { Card, HandCategory, NormalCard } from './types';

/**
 * The evaluator only ever considers wild identities in suits it already holds, on the
 * reasoning that a flush must land in a suit some natural card already occupies.
 * This checks that shortcut against an unrestricted search over all 52 identities.
 */

const ALL_IDENTITIES: NormalCard[] = SUITS.flatMap((suit) =>
  RANKS.map((rank) => ({ id: `${rank}${suit}`, kind: 'normal' as const, rank, suit })),
);

function* combos<T>(items: readonly T[], k: number): Generator<T[]> {
  if (k === 0) {
    yield [];
    return;
  }
  const idx = new Array<number>(k).fill(0);
  for (;;) {
    yield idx.map((i) => items[i]);
    let i = k - 1;
    while (i >= 0 && idx[i] === items.length - 1) i--;
    if (i < 0) return;
    const next = idx[i] + 1;
    for (let j = i; j < k; j++) idx[j] = next;
  }
}

/** Unrestricted reference search: every wild may become any of the 52 identities. */
function referenceCategory(cards: Card[]): HandCategory {
  const naturals = cards.filter((c): c is NormalCard => c.kind === 'normal');
  const wilds = cards.length - naturals.length;
  if (wilds === 0) return categorize5(naturals);

  let best: HandCategory = 'HIGH_CARD';
  for (const assignment of combos(ALL_IDENTITIES, wilds)) {
    const category = categorize5([...naturals, ...assignment]);
    if (CATEGORY_POINTS[category] > CATEGORY_POINTS[best]) best = category;
  }
  return best;
}

describe('wild candidate reduction', () => {
  it('matches an unrestricted 52-identity search on random hands', () => {
    const naturals = buildDeck().filter((c): c is NormalCard => c.kind === 'normal');
    const rng = mulberry32(20260803);
    const wild = (n: number): Card => ({ id: `w${n}`, kind: 'wild' });

    for (let trial = 0; trial < 200; trial++) {
      // 1-3 wilds, topped up with distinct naturals to a full five cards.
      const wildCount = 1 + Math.floor(rng() * 3);
      const hand: Card[] = Array.from({ length: wildCount }, (_, i) => wild(i + 1));
      const used = new Set<string>();
      while (hand.length < 5) {
        const card = naturals[Math.floor(rng() * naturals.length)];
        if (used.has(card.id)) continue;
        used.add(card.id);
        hand.push(card);
      }

      expect(evaluateHand(hand).category).toBe(referenceCategory(hand));
    }
  });

  it('matches on every four-wild hand, where the reduction bites hardest', () => {
    // Four wilds leave a single natural card, and suits are interchangeable under
    // relabeling when only one is present — so one suit covers all 52 such hands.
    const oneOfEachRank = RANKS.map(
      (rank): NormalCard => ({ id: `${rank}S`, kind: 'normal', rank, suit: 'S' }),
    );

    for (const natural of oneOfEachRank) {
      const hand: Card[] = [
        { id: 'w1', kind: 'wild' },
        { id: 'w2', kind: 'wild' },
        { id: 'w3', kind: 'wild' },
        { id: 'w4', kind: 'wild' },
        natural,
      ];
      expect(evaluateHand(hand).category).toBe(referenceCategory(hand));
    }
  });
});
