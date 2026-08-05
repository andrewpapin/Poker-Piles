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
  stats: DailyStats | null;
  onPlayAgain: () => void;
};

export function Results({ dateKey, total, hands, stats, onPlayAgain }: Props) {
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
    <div className="overlay" role="dialog" aria-modal="true" aria-label="Run complete">
      <div className="sheet">
        <p className="sheet-eyebrow">Deck cleared</p>
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

        <div className="sheet-actions">
          <button type="button" className="btn btn--ghost" onClick={onPlayAgain}>
            Play again
          </button>
          <button type="button" className="btn btn--primary" onClick={handleShare}>
            {shareLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
