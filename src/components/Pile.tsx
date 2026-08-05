import type { CSSProperties } from 'react';
import { CardFace, cardLabel } from './CardFace';
import { topCard } from '../game/deck';
import { PILE_SIZE } from '../game/types';
import type { Pile as PileType } from '../game/types';

type Props = {
  pile: PileType;
  index: number;
  selected: boolean;
  disabled: boolean;
  holdEnabled: boolean;
  onToggle: (index: number) => void;
  onHold: (index: number) => void;
};

/**
 * The buried cards, drawn as offset card backs behind the face card. Each layer
 * is absolutely positioned inside a zero-height frame, so however many there
 * are they contribute nothing to layout — the pile's height comes from the face
 * card plus a constant reserve, and the board never reflows as piles drain.
 */
function StackBacks({ buried }: { buried: number }) {
  return (
    <span className="pile-backs" aria-hidden="true">
      {Array.from({ length: buried }, (_, i) => (
        <i key={i} style={{ '--i': i } as CSSProperties} />
      ))}
    </span>
  );
}

/** A downward chevron into a tray: bank this card for a later hand. */
function HoldIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M12 3v10" />
      <path d="m7.5 9.5 4.5 4.5 4.5-4.5" />
      <path d="M4 18.5h16" />
    </svg>
  );
}

export function Pile({ pile, index, selected, disabled, holdEnabled, onToggle, onHold }: Props) {
  const card = topCard(pile);

  if (!card) {
    // Kept in the flow at full size so the 4x2 grid holds its shape as it
    // drains — a cleared pile reads as "done", not as a hole in the board.
    return (
      <div className="pile pile--spent" aria-hidden="true">
        <span className="pile-stack">
          <span className="card card--ghost" />
        </span>
      </div>
    );
  }

  const buried = pile.length - 1;
  return (
    <div className={`pile${selected ? ' pile--selected' : ''}`}>
      <button
        type="button"
        className="pile-select"
        onClick={() => onToggle(index)}
        disabled={disabled}
        aria-pressed={selected}
        aria-label={`Pile ${index + 1}, ${cardLabel(card)}, ${buried} card${
          buried === 1 ? '' : 's'
        } beneath`}
      >
        <span className="pile-stack">
          <StackBacks buried={Math.min(buried, PILE_SIZE - 1)} />
          {/* Keyed on the card so a newly revealed top card replays its flip. */}
          <CardFace key={card.id} card={card} />
        </span>
      </button>
      {/* A sibling of the select button, not a child: nesting interactive
          elements is invalid, and the card needs to stay one big tap target. */}
      <button
        type="button"
        className="pile-hold"
        onClick={() => onHold(index)}
        disabled={!holdEnabled}
        aria-label={`Hold ${cardLabel(card)} from pile ${index + 1}`}
      >
        <HoldIcon />
      </button>
    </div>
  );
}
