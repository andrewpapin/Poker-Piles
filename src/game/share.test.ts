import { describe, expect, it } from 'vitest';
import { buildShareText, formatPuzzleDate } from './share';
import type { HandResult } from './types';

const result = (category: HandResult['category'], cardCount: number, score: number): HandResult => ({
  category,
  score,
  cardCount,
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
    result('THREE_OF_A_KIND', 3, 15),
    result('PAIR', 2, 5),
  ];

  it('summarises the run as name, date, score and a link', () => {
    expect(buildShareText('2026-08-03', 187, hands)).toBe(
      ['Poker Piles — Aug 3', 'Score: 187 (3 hands)', '', 'https://andrewpapin.github.io/Poker-Piles/'].join('\n'),
    );
  });

  it('ends with a link back to the game', () => {
    expect(buildShareText('2026-08-03', 187, hands)).toMatch(/https:\/\/andrewpapin\.github\.io\/Poker-Piles\/$/);
  });

  it('handles a run with no hands played', () => {
    expect(buildShareText('2026-08-03', 0, [])).toBe(
      ['Poker Piles — Aug 3', 'Score: 0', '', 'https://andrewpapin.github.io/Poker-Piles/'].join('\n'),
    );
  });

  it('leaks no ranks, suits or hand names', () => {
    const text = buildShareText('2026-08-03', 187, hands);
    expect(text).not.toMatch(/[♠♥♦♣]/);
    expect(text).not.toMatch(/Full House|Three of a Kind|Pair/);
    // No bare rank tokens — the only digits belong to the score, date and hand count.
    expect(text.replace('187', '').replace('Aug 3', '').replace('3 hands', '')).not.toMatch(/\d/);
  });
});
