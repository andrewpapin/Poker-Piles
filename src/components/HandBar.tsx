import type { CSSProperties } from 'react';
import { evaluateHand } from '../game/evaluator';
import {
  CATEGORY_LABELS,
  CATEGORY_POINTS,
  CATEGORY_TIER,
  MAX_HAND_SIZE,
  TIER_COUNT,
} from '../game/types';
import type { Card } from '../game/types';

type Props = {
  cards: Card[];
  livePiles: number;
  heldCount: number;
  handsPlayed: number;
  onClear: () => void;
  onSubmit: () => void;
};

/** Hand strength as a five-step meter — the same vocabulary the results sheet uses. */
function Tiers({ tier }: { tier: number | null }) {
  return (
    <span className={`tiers${tier === null ? ' tiers--idle' : ''}`} aria-hidden="true">
      {Array.from({ length: TIER_COUNT }, (_, i) => (
        <i
          key={i}
          className={tier !== null && i <= tier ? 'on' : undefined}
          // Staggers the fill so the meter fills left-to-right rather than at once.
          style={{ '--i': i } as CSSProperties}
        />
      ))}
    </span>
  );
}

export function HandBar({ cards, livePiles, heldCount, handsPlayed, onClear, onSubmit }: Props) {
  const hand = cards.length > 0 ? evaluateHand(cards) : null;
  // Once piles and held cards combined can't reach 5, a short hand is forced rather than a mistake.
  const forcedPartial = livePiles + heldCount < MAX_HAND_SIZE;

  let note: string;
  if (hand) {
    note = hand.partial
      ? `${hand.cardCount} of ${MAX_HAND_SIZE} · halved from ${CATEGORY_POINTS[hand.category]}`
      : 'Full hand';
  } else if (forcedPartial) {
    note =
      heldCount > 0
        ? `${livePiles} pile${livePiles === 1 ? '' : 's'} + ${heldCount} held left · short hands halve`
        : `${livePiles} pile${livePiles === 1 ? '' : 's'} left · short hands halve`;
  } else if (handsPlayed === 0) {
    note = 'One card per pile';
  } else {
    // The opening instruction has done its job — stop repeating it every turn.
    note = ' ';
  }

  return (
    <div className="handbar">
      <div className="readout">
        <div className="readout-hand">
          <span className={`readout-name${hand ? '' : ' readout-name--idle'}`}>
            {hand ? CATEGORY_LABELS[hand.category] : 'Select up to five'}
          </span>
          <span className="readout-note">{note}</span>
        </div>
        <div className="readout-value">
          <span className={`readout-pts${hand ? '' : ' readout-pts--idle'}`}>
            {hand ? hand.score : '—'}
          </span>
          <Tiers tier={hand ? CATEGORY_TIER[hand.category] : null} />
        </div>
      </div>

      <div className="handbar-actions">
        <button
          type="button"
          className="btn btn--clear"
          onClick={onClear}
          disabled={cards.length === 0}
          aria-label="Clear selection"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            aria-hidden="true"
            focusable="false"
          >
            <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />
          </svg>
          {/* Shown only on desktop, where the button goes full-width in the rail
              and an unlabelled glyph in a wide bar reads as a mystery control. */}
          <span className="btn-clear-label">Clear</span>
        </button>
        <button
          type="button"
          className="btn btn--primary"
          onClick={onSubmit}
          disabled={cards.length === 0}
        >
          Play hand
        </button>
      </div>
    </div>
  );
}
