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

  it('summarises the run Wordle-style', () => {
    expect(buildShareText('2026-08-03', 187, hands)).toBe(
      ['🎴 Poker Piles — Aug 3', 'Score: 187', '', '🂠🂠🂠🂠🂠 Full House', '🂠🂠🂠 Three of a Kind', '🂠🂠 Pair'].join(
        '\n',
      ),
    );
  });

  it('uses one card back per card played', () => {
    const line = buildShareText('2026-08-03', 40, [result('FLUSH', 5, 30)]).split('\n')[3];
    expect(line.startsWith('🂠🂠🂠🂠🂠 ')).toBe(true);
  });

  it('leaks no ranks or suits', () => {
    const text = buildShareText('2026-08-03', 187, hands);
    expect(text).not.toMatch(/[♠♥♦♣]/);
    // No bare rank tokens — the only digits belong to the score and the date.
    expect(text.replace('Score: 187', '').replace('Aug 3', '')).not.toMatch(/\d/);
  });
});
