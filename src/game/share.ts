import { CATEGORY_TIER } from './types';
import type { HandResult } from './types';

/**
 * One block per hand, coloured by tier. These five are all long-standing
 * emoji with near-universal font coverage — unlike U+1F0A0 PLAYING CARD BACK,
 * which is absent on many devices and used to render as tofu in the one place
 * the text is guaranteed to land on someone else's phone.
 */
const TIER_BLOCKS = ['⬜', '🟨', '🟧', '🟥', '🟪'] as const;

/** Hands per row: keeps a full ~14-hand run to two rows instead of 14 lines. */
const BLOCKS_PER_ROW = 8;

/** "2026-08-03" -> "Aug 3". Parsed as UTC so it matches the puzzle key exactly. */
export function formatPuzzleDate(dateKey: string): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

/**
 * A spoiler-free, Wordle-style summary: a block grid of hand tiers and the
 * score. Deliberately never mentions a rank, a suit, or a category name —
 * naming the hands both leaked the shape of the run and made the text far too
 * long to be worth pasting.
 */
export function buildShareText(dateKey: string, total: number, hands: HandResult[]): string {
  const header = [`Poker Piles · ${formatPuzzleDate(dateKey)} — ${total}`];
  if (hands.length === 0) return header.join('\n');

  header.push(`${hands.length} hand${hands.length === 1 ? '' : 's'}`, '');

  const blocks = hands.map((hand) => TIER_BLOCKS[CATEGORY_TIER[hand.category]]);
  const rows: string[] = [];
  for (let i = 0; i < blocks.length; i += BLOCKS_PER_ROW) {
    rows.push(blocks.slice(i, i + BLOCKS_PER_ROW).join(''));
  }
  return [...header, ...rows].join('\n');
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
