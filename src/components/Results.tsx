import { useState } from 'react';
import { buildShareText, shareResults } from '../game/share';
import { CATEGORY_LABELS, MAX_HAND_SIZE } from '../game/types';
import type { HandResult } from '../game/types';
import type { DailyStats } from '../game/storage';

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
    setShareLabel(outcome === 'copied' ? 'Copied!' : 'Copy failed');
    setTimeout(() => setShareLabel('Share'), 2000);
  }

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label="Run complete">
      <div className="sheet">
        <p className="sheet-eyebrow">Deck cleared</p>
        <p className="results-score">{total}</p>
        {stats && stats.plays > 1 && (
          <p className="results-best">Best today: {stats.bestScore} · {stats.plays} runs</p>
        )}

        <ol className="results-list">
          {hands.map((hand, i) => (
            <li key={i} className="results-row">
              {/* Five slots, filled to the number of cards played, so a short hand reads
                  as short at a glance. Drawn in CSS — the 🂠 glyph is missing on some
                  devices, and the share text is where it belongs. */}
              <span className="results-cards" aria-hidden="true">
                {Array.from({ length: MAX_HAND_SIZE }, (_, slot) => (
                  <i key={slot} className={slot < hand.cardCount ? 'pip' : 'pip pip--empty'} />
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
