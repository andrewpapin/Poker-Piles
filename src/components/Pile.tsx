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
  /** A hold slot is armed: tapping this pile's top card banks it there instead of selecting it. */
  holdArmed: boolean;
  onToggle: (index: number) => void;
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

export function Pile({ pile, index, selected, disabled, holdArmed, onToggle }: Props) {
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
  const buriedLabel = `${buried} card${buried === 1 ? '' : 's'} beneath`;
  return (
    <div className={`pile${selected ? ' pile--selected' : ''}${holdArmed ? ' pile--hold-armed' : ''}`}>
      <button
        type="button"
        className="pile-select"
        onClick={() => onToggle(index)}
        disabled={disabled}
        aria-pressed={selected}
        aria-label={
          holdArmed
            ? `Hold ${cardLabel(card)} from pile ${index + 1}`
            : `Pile ${index + 1}, ${cardLabel(card)}, ${buriedLabel}`
        }
      >
        <span className="pile-stack">
          <StackBacks buried={Math.min(buried, PILE_SIZE - 1)} />
          {/* Keyed on the card so a newly revealed top card replays its flip. */}
          <CardFace key={card.id} card={card} />
        </span>
      </button>
    </div>
  );
}
