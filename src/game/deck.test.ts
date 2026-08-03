import { describe, expect, it } from 'vitest';
import { buildDeck, dealPiles, topCard } from './deck';
import { mulberry32, rngFromSeed, todayKey, xmur3 } from './rng';
import { PILE_COUNT, PILE_SIZE } from './types';

describe('rng', () => {
  it('is deterministic for a given seed', () => {
    const a = rngFromSeed('2026-08-03');
    const b = rngFromSeed('2026-08-03');
    const seqA = Array.from({ length: 20 }, a);
    const seqB = Array.from({ length: 20 }, b);
    expect(seqA).toEqual(seqB);
  });

  it('produces different sequences for different seeds', () => {
    const a = Array.from({ length: 20 }, rngFromSeed('2026-08-03'));
    const b = Array.from({ length: 20 }, rngFromSeed('2026-08-04'));
    expect(a).not.toEqual(b);
  });

  it('stays within [0, 1)', () => {
    const rng = mulberry32(xmur3('spread'));
    for (let i = 0; i < 5000; i++) {
      const value = rng();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('keys the puzzle off the UTC date', () => {
    // 23:30 in New York on Aug 3 is already Aug 4 in UTC.
    expect(todayKey(new Date('2026-08-04T03:30:00Z'))).toBe('2026-08-04');
    expect(todayKey(new Date('2026-08-03T00:00:00Z'))).toBe('2026-08-03');
  });
});

describe('deck', () => {
  it('holds 52 naturals plus 4 wilds, all distinct', () => {
    const deck = buildDeck();
    expect(deck).toHaveLength(56);
    expect(deck.filter((c) => c.kind === 'wild')).toHaveLength(4);
    expect(new Set(deck.map((c) => c.id)).size).toBe(56);
  });
});

describe('dealPiles', () => {
  it('deals 8 piles of 7', () => {
    const piles = dealPiles('2026-08-03');
    expect(piles).toHaveLength(PILE_COUNT);
    for (const pile of piles) expect(pile).toHaveLength(PILE_SIZE);
  });

  it('is an exact permutation of the deck — nothing lost or duplicated', () => {
    const dealt = dealPiles('2026-08-03')
      .flat()
      .map((c) => c.id)
      .sort();
    const expected = buildDeck()
      .map((c) => c.id)
      .sort();
    expect(dealt).toEqual(expected);
  });

  it('gives every player the same board for the same date', () => {
    const first = dealPiles('2026-08-03');
    const second = dealPiles('2026-08-03');
    expect(second).toEqual(first);
  });

  it('gives a different board on a different date', () => {
    const today = dealPiles('2026-08-03').flat().map((c) => c.id);
    const tomorrow = dealPiles('2026-08-04').flat().map((c) => c.id);
    expect(tomorrow).not.toEqual(today);
  });

  it('actually shuffles rather than dealing the deck in order', () => {
    const dealt = dealPiles('2026-08-03').flat().map((c) => c.id);
    expect(dealt).not.toEqual(buildDeck().map((c) => c.id));
  });

  it('exposes the last card of a pile as the face-up top', () => {
    const pile = dealPiles('2026-08-03')[0];
    expect(topCard(pile)).toBe(pile[pile.length - 1]);
    expect(topCard([])).toBeNull();
  });
});
