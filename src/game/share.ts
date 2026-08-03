import { CATEGORY_LABELS } from './types';
import type { HandResult } from './types';

const CARD_BACK = '🂠';

/** "2026-08-03" -> "Aug 3". Parsed as UTC so it matches the puzzle key exactly. */
export function formatPuzzleDate(dateKey: string): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

/**
 * A spoiler-free, Wordle-style summary: hand types and score only.
 * Deliberately never mentions a rank or a suit.
 */
export function buildShareText(dateKey: string, total: number, hands: HandResult[]): string {
  const lines = [`🎴 Poker Piles — ${formatPuzzleDate(dateKey)}`, `Score: ${total}`, ''];
  for (const hand of hands) {
    lines.push(`${CARD_BACK.repeat(hand.cardCount)} ${CATEGORY_LABELS[hand.category]}`);
  }
  return lines.join('\n');
}

export type ShareOutcome = 'shared' | 'copied' | 'failed';

/** Native share sheet on mobile, clipboard everywhere else. */
export async function shareResults(text: string): Promise<ShareOutcome> {
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({ text });
      return 'shared';
    } catch (err) {
      // A user-cancelled share sheet is not an error worth falling back from.
      if (err instanceof Error && err.name === 'AbortError') return 'shared';
    }
  }

  try {
    await navigator.clipboard.writeText(text);
    return 'copied';
  } catch {
    return copyViaTextarea(text) ? 'copied' : 'failed';
  }
}

/** Last-resort clipboard path for browsers without the async clipboard API. */
function copyViaTextarea(text: string): boolean {
  if (typeof document === 'undefined') return false;
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.style.position = 'fixed';
  area.style.opacity = '0';
  document.body.appendChild(area);
  area.select();
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  }
  document.body.removeChild(area);
  return ok;
}
