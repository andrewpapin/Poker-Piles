import { describe, expect, it } from 'vitest';
import { evaluateHand } from './evaluator';
import type { Card, HandCategory, Rank, Suit } from './types';

const RANK_FROM_LABEL: Record<string, Rank> = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
  T: 10, J: 11, Q: 12, K: 13, A: 14,
};

let wildSeq = 0;

/** "AS" -> ace of spades, "TH" -> ten of hearts, "W" -> a wild. */
function c(code: string): Card {
  if (code === 'W') return { id: `w${++wildSeq}`, kind: 'wild' };
  const rank = RANK_FROM_LABEL[code[0]];
  const suit = code[1] as Suit;
  return { id: code, kind: 'normal', rank, suit };
}

const hand = (...codes: string[]) => evaluateHand(codes.map(c));

describe('natural 5-card hands', () => {
  const CASES: Array<[string[], HandCategory, number]> = [
    [['TS', 'JS', 'QS', 'KS', 'AS'], 'ROYAL_FLUSH', 200],
    [['5H', '6H', '7H', '8H', '9H'], 'STRAIGHT_FLUSH', 100],
    [['AH', '2H', '3H', '4H', '5H'], 'STRAIGHT_FLUSH', 100],
    [['9S', '9H', '9D', '9C', '2S'], 'FOUR_OF_A_KIND', 60],
    [['4S', '4H', '4D', 'KC', 'KS'], 'FULL_HOUSE', 40],
    [['2C', '5C', '9C', 'JC', 'KC'], 'FLUSH', 30],
    [['7S', '8H', '9D', 'TC', 'JS'], 'STRAIGHT', 25],
    [['QS', 'QH', 'QD', '3C', '8S'], 'THREE_OF_A_KIND', 15],
    [['JS', 'JH', '4D', '4C', '9S'], 'TWO_PAIR', 10],
    [['AS', 'AH', '6D', '9C', '3S'], 'PAIR', 5],
    [['2S', '5H', '9D', 'JC', 'KS'], 'HIGH_CARD', 1],
  ];

  it.each(CASES)('scores %s as %s', (codes, category, score) => {
    const result = hand(...codes);
    expect(result.category).toBe(category);
    expect(result.score).toBe(score);
    expect(result.partial).toBe(false);
  });

  it('treats the wheel as a straight but not a king-high wrap', () => {
    expect(hand('AS', '2H', '3D', '4C', '5S').category).toBe('STRAIGHT');
    expect(hand('QS', 'KH', 'AD', '2C', '3S').category).toBe('HIGH_CARD');
  });

  it('ranks a straight flush above the quads it contains no part of', () => {
    expect(hand('2D', '3D', '4D', '5D', '6D').score).toBeGreaterThan(
      hand('2S', '2H', '2D', '2C', '9S').score,
    );
  });
});

describe('wild resolution', () => {
  it('builds around the one natural card four wilds are stuck with', () => {
    // A seven cannot be part of a royal, so the wilds make the best straight flush instead.
    expect(hand('W', 'W', 'W', 'W', '7C')).toMatchObject({
      category: 'STRAIGHT_FLUSH',
      score: 100,
    });
    // An ace can, so the same four wilds go all the way.
    expect(hand('W', 'W', 'W', 'W', 'AS')).toMatchObject({
      category: 'ROYAL_FLUSH',
      score: 200,
    });
  });

  it('completes a royal flush from one wild', () => {
    expect(hand('TS', 'JS', 'QS', 'KS', 'W').category).toBe('ROYAL_FLUSH');
  });

  it('completes a straight flush from one wild', () => {
    expect(hand('5H', '6H', '7H', '9H', 'W').category).toBe('STRAIGHT_FLUSH');
  });

  it('fills a flush when the suits line up but the ranks do not', () => {
    const result = hand('2H', '7H', '9H', 'JH', 'W');
    expect(result.category).toBe('FLUSH');
    expect(result.score).toBe(30);
  });

  it('settles for a straight when one off-suit card rules the flush out', () => {
    const result = hand('5H', '6H', '7H', '8C', 'W');
    expect(result.category).toBe('STRAIGHT');
    expect(result.score).toBe(25);
  });

  it('makes quads rather than a full house when both are available', () => {
    const result = hand('9S', '9H', '9D', 'KC', 'W');
    expect(result.category).toBe('FOUR_OF_A_KIND');
  });

  it('makes a full house from two pair plus a wild', () => {
    expect(hand('9S', '9H', 'KD', 'KC', 'W').category).toBe('FULL_HOUSE');
  });

  it('never scores below a pair with a wild in hand', () => {
    expect(hand('2S', '5H', '9D', 'JC', 'W').category).toBe('PAIR');
  });

  it('is unaffected by which wild instances are used', () => {
    expect(hand('W', 'W', '9D', 'JC', '3S')).toEqual(hand('W', 'W', '9D', 'JC', '3S'));
  });
});

describe('partial hands', () => {
  it('halves the score and rounds to the nearest point', () => {
    expect(hand('9S', '9H', '9D', '9C')).toMatchObject({
      category: 'FOUR_OF_A_KIND',
      basePoints: 60,
      score: 30,
      partial: true,
    });
    expect(hand('QS', 'QH', 'QD').score).toBe(8); // 15 * 0.5 = 7.5
    expect(hand('AS', 'AH').score).toBe(3); // 5 * 0.5 = 2.5
    expect(hand('AS').score).toBe(1); // 1 * 0.5 = 0.5
    expect(hand('JS', 'JH', '4D', '4C').score).toBe(5); // two pair, 10 * 0.5
  });

  it('never reports a straight or a flush, however suited', () => {
    expect(hand('2C', '5C', '9C', 'JC').category).toBe('HIGH_CARD');
    expect(hand('8S', '9S', 'TS', 'JS').category).toBe('HIGH_CARD');
    expect(hand('7S', '8H', '9D').category).toBe('HIGH_CARD');
  });

  it('resolves wilds in partial hands too', () => {
    expect(hand('9S', '9H', '9D', 'W').category).toBe('FOUR_OF_A_KIND');
    expect(hand('KS', 'W', 'W').category).toBe('THREE_OF_A_KIND');
    expect(hand('W', 'W', 'W', 'W').category).toBe('FOUR_OF_A_KIND');
    expect(hand('W').category).toBe('HIGH_CARD');
    // Both wilds pile onto the king for trips, rather than splitting into two pair.
    expect(hand('KS', 'QH', 'W', 'W').category).toBe('THREE_OF_A_KIND');
  });
});

describe('input guarding', () => {
  it('rejects hands outside 1-5 cards', () => {
    expect(() => evaluateHand([])).toThrow();
    expect(() => hand('2S', '3S', '4S', '5S', '6S', '7S')).toThrow();
  });
});
