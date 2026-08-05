import { CATEGORY_LABELS, CATEGORY_POINTS } from '../game/types';
import type { HandCategory } from '../game/types';

const LADDER = Object.keys(CATEGORY_POINTS) as HandCategory[];

export function HowToPlay({ onClose }: { onClose: () => void }) {
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label="How to play">
      <div className="sheet">
        <p className="sheet-eyebrow">How to play</p>
        <ul className="rules">
          <li>Eight piles of seven. Only each pile's top card is face up.</li>
          <li>
            Tap up to <strong>5</strong> face-up cards — at most one per pile — then play them as a
            poker hand.
          </li>
          <li>Every pile you draw from flips its next card. Piles you skip stay put.</li>
          <li>
            Tap an empty <strong>hold</strong> slot, then a card — or a card, then an empty slot —
            to bank it there. Held cards flip the pile beneath them straight away and can join any
            later hand.
          </li>
          <li>
            Four <strong>wilds</strong> are shuffled in. A wild becomes whatever rank and suit
            scores you the most.
          </li>
          <li>
            Hands of fewer than 5 cards score <strong>half</strong>, and only count pairs, trips and
            quads — no short straights or flushes. Spread your picks to keep piles alive.
          </li>
          <li>Same deal for everyone, every day. Resets at midnight UTC.</li>
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
