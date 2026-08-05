import { useState } from 'react';
import { buildShareText, shareResults } from '../game/share';
import { CATEGORY_LABELS, CATEGORY_POINTS, CATEGORY_TIER, TIER_COUNT } from '../game/types';
import type { HandCategory, HandResult } from '../game/types';
import type { DailyStats } from '../game/storage';

// Best-to-worst order for the summary, matching CATEGORY_POINTS' declaration order.
const CATEGORY_ORDER = Object.keys(CATEGORY_POINTS) as HandCategory[];

type Props = {
  dateKey: string;
  total: number;
  hands: HandResult[];
  gaveUp: boolean;
  stats: DailyStats | null;
  onPlayAgain: () => void;
};

/**
 * The end-of-run screen. It is a page, not an overlay: it takes the play area's
 * place in the shell once the run is over, so nothing is left showing behind it.
 */
export function Results({ dateKey, total, hands, gaveUp, stats, onPlayAgain }: Props) {
  const [shareLabel, setShareLabel] = useState('Share');

  async function handleShare() {
    const outcome = await shareResults(buildShareText(dateKey, total, hands));
    if (outcome === 'shared') return;
    setShareLabel(outcome === 'copied' ? 'Copied' : 'Copy failed');
    setTimeout(() => setShareLabel('Share'), 2000);
  }

  const counts = new Map<HandCategory, number>();
  for (const hand of hands) {
    counts.set(hand.category, (counts.get(hand.category) ?? 0) + 1);
  }

  return (
    <main className="results-page">
      <div className="results-body">
        <h2 className="results-eyebrow">{gaveUp ? 'Gave up' : 'Deck cleared'}</h2>
        <p className="results-score">{total}</p>
        <p className="results-best">
          {hands.length} hand{hands.length === 1 ? '' : 's'}
          {stats && stats.plays > 1 ? ` · best today ${stats.bestScore}` : ''}
        </p>

        <ul className="results-summary">
          {CATEGORY_ORDER.filter((category) => counts.has(category)).map((category) => (
            <li key={category} className="results-summary-chip" data-tier={CATEGORY_TIER[category]}>
              <span className="results-summary-count">{counts.get(category)}</span>
              <span className="results-summary-name">{CATEGORY_LABELS[category]}</span>
            </li>
          ))}
        </ul>

        <ol className="results-list">
          {hands.map((hand, i) => (
            // The tier drives a colour ramp that matches the blocks in the share
            // text, so the score card and the pasted grid read as one artefact.
            <li key={i} className="results-row" data-tier={CATEGORY_TIER[hand.category]}>
              <span className="results-tier" aria-hidden="true">
                {Array.from({ length: TIER_COUNT }, (_, slot) => (
                  <i key={slot} className={slot <= CATEGORY_TIER[hand.category] ? 'on' : undefined} />
                ))}
              </span>
              <span className="results-name">{CATEGORY_LABELS[hand.category]}</span>
              <span className="results-points">{hand.score}</span>
            </li>
          ))}
        </ol>
      </div>

      <div className="results-actions">
        <button type="button" className="btn btn--ghost" onClick={onPlayAgain}>
          Play again
        </button>
        <button type="button" className="btn btn--primary" onClick={handleShare}>
          {shareLabel}
        </button>
      </div>
    </main>
  );
}
