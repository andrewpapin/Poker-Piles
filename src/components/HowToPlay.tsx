import { CATEGORY_LABELS, CATEGORY_POINTS } from '../game/types';
import type { HandCategory } from '../game/types';

const LADDER = Object.keys(CATEGORY_POINTS) as HandCategory[];

export function HowToPlay({ onClose }: { onClose: () => void }) {
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label="How to play">
      <div className="sheet">
        <p className="sheet-eyebrow">How to play</p>
        <ul className="rules">
          <li>8 piles of 7 cards. Only the top card of each pile is face up.</li>
          <li>
            Tap up to <strong>5</strong> face-up cards (one per pile) and play them as a poker
            hand.
          </li>
          <li>Piles you play from flip their next card. Piles you skip stay put.</li>
          <li>
            Tap a card, then an empty <strong>hold</strong> slot, to bank it for later — that flips
            the pile beneath it right away.
          </li>
          <li>
            4 <strong>wilds</strong> are mixed in. Each one becomes whatever rank and suit scores
            best.
          </li>
          <li>
            Hands under 5 cards score <strong>half</strong>, and only pairs, trips and quads count
            — no straights or flushes.
          </li>
          <li>Same puzzle for everyone, every day. Resets at midnight UTC.</li>
        </ul>

        {/* Two columns so the whole ladder — and the dismiss button — clear the fold on a small phone. */}
        <dl className="ladder">
          {LADDER.map((category) => (
            <div key={category} className="ladder-row">
              <dt>{CATEGORY_LABELS[category]}</dt>
              <dd>{CATEGORY_POINTS[category]}</dd>
            </div>
          ))}
        </dl>

        <div className="sheet-actions">
          <button type="button" className="btn btn--primary" onClick={onClose}>
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
