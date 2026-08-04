import { describe, expect, it } from 'vitest';
import { buildShareText, formatPuzzleDate } from './share';
import type { HandResult } from './types';

const result = (category: HandResult['category'], cardCount: number, score: number): HandResult => ({
  category,
  basePoints: score,
  score,
  cardCount,
  partial: cardCount < 5,
});

describe('formatPuzzleDate', () => {
  it('renders the key in UTC, never the local timezone', () => {
    expect(formatPuzzleDate('2026-08-03')).toBe('Aug 3');
    expect(formatPuzzleDate('2026-01-01')).toBe('Jan 1');
    expect(formatPuzzleDate('2026-12-31')).toBe('Dec 31');
  });
});

describe('buildShareText', () => {
  const hands = [
    result('FULL_HOUSE', 5, 40),
    result('THREE_OF_A_KIND', 3, 8),
    result('PAIR', 2, 3),
  ];

  it('summarises the run as a block grid', () => {
    expect(buildShareText('2026-08-03', 187, hands)).toBe(
      ['Poker Piles · Aug 3 — 187', '3 hands', '', '🟥🟧🟨'].join('\n'),
    );
  });

  it('uses one block per hand, coloured by tier', () => {
    const grid = buildShareText('2026-08-03', 1, [result('HIGH_CARD', 5, 1)]).split('\n')[3];
    expect(grid).toBe('⬜');
    const royal = buildShareText('2026-08-03', 200, [result('ROYAL_FLUSH', 5, 200)]).split('\n')[3];
    expect(royal).toBe('🟪');
  });

  it('wraps at eight hands so a full run stays short', () => {
    const run = Array.from({ length: 14 }, () => result('PAIR', 5, 5));
    const lines = buildShareText('2026-08-03', 70, run).split('\n');
    // Header, count, blank, then exactly two grid rows — not fourteen.
    expect(lines).toHaveLength(5);
    expect(lines[3]).toHaveLength([...'🟨'].length * 8 * 2);
    expect([...lines[4]].length).toBe([...'🟨'].length * 6);
  });

  it('handles a run with no hands played', () => {
    expect(buildShareText('2026-08-03', 0, [])).toBe('Poker Piles · Aug 3 — 0');
  });

  it('uses only emoji with broad device coverage — never the card-back glyph', () => {
    const every = (
      ['ROYAL_FLUSH', 'FOUR_OF_A_KIND', 'FLUSH', 'TWO_PAIR', 'HIGH_CARD'] as const
    ).map((c) => result(c, 5, 1));
    expect(buildShareText('2026-08-03', 5, every)).not.toMatch(/\u{1F0A0}/u);
  });

  it('leaks no ranks, suits or hand names', () => {
    const text = buildShareText('2026-08-03', 187, hands);
    expect(text).not.toMatch(/[♠♥♦♣]/);
    expect(text).not.toMatch(/Full House|Three of a Kind|Pair/);
    // No bare rank tokens — the only digits belong to the score, date and hand count.
    expect(text.replace('187', '').replace('Aug 3', '').replace('3 hands', '')).not.toMatch(/\d/);
  });
});
