import type { CSSProperties } from 'react';
import { CardFace, cardLabel } from './CardFace';
import { topCard } from '../game/deck';
import { MAX_HAND_SIZE, PILE_SIZE } from '../game/types';
import type { Card, Pile as PileType } from '../game/types';

type Props = {
  pile: PileType;
  index: number;
  selected: boolean;
  disabled: boolean;
  /** A hold slot is armed: tapping this pile's top card banks it there instead of selecting it. */
  holdArmed: boolean;
  onToggle: (index: number) => void;
  /**
   * This pile's own extra hold slot, once it has drained naturally — null
   * until then (or forever, if the pile was force-emptied by giving up).
   */
  holdSlot: number | null;
  /** The card banked in `holdSlot`, if any. */
  heldCard: Card | null;
  heldSelected: boolean;
  selectedCount: number;
  armedHoldSlot: number | null;
  onArmHold: (slot: number) => void;
  onToggleHeld: (slot: number) => void;
};

/**
 * A subtle depth cue: one hairline-thin edge per buried card, staggered
 * behind and below the face card, so the exact remaining count reads at a
 * glance without a numeral. Each edge is absolutely positioned inside a
 * zero-height frame, so however many there are they contribute nothing to
 * layout — the pile's height comes from the face card plus a constant
 * reserve, and the board never reflows as piles drain.
 */
function StackEdges({ buried }: { buried: number }) {
  return (
    <span className="pile-backs" aria-hidden="true">
      {Array.from({ length: buried }, (_, i) => (
        <i key={i} style={{ '--i': i } as CSSProperties} />
      ))}
    </span>
  );
}

export function Pile({
  pile,
  index,
  selected,
  disabled,
  holdArmed,
  onToggle,
  holdSlot,
  heldCard,
  heldSelected,
  selectedCount,
  armedHoldSlot,
  onArmHold,
  onToggleHeld,
}: Props) {
  const card = topCard(pile);

  if (!card) {
    // A pile that drained naturally becomes an extra hold pile right where it
    // sat — still kept in the flow at full size so the 4x2 grid holds its
    // shape, but now interactive instead of a dead placeholder.
    if (holdSlot !== null) {
      if (!heldCard) {
        const armed = armedHoldSlot === holdSlot;
        return (
          <div className="pile pile--hold-slot">
            <button
              type="button"
              className={`pile-select pile-hold-empty${armed ? ' pile-hold-empty--armed' : ''}`}
              onClick={() => onArmHold(holdSlot)}
              aria-pressed={armed}
              aria-label={
                armed
                  ? `Extra hold pile ${index + 1}, armed — tap a card to hold it here`
                  : `Extra hold pile ${index + 1}, empty`
              }
            >
              <span className="pile-stack">
                <span className="card card--ghost pile-hold-empty-plus" aria-hidden="true">
                  +
                </span>
              </span>
            </button>
          </div>
        );
      }

      return (
        <div className={`pile pile--hold-slot${heldSelected ? ' pile--selected' : ''}`}>
          <button
            type="button"
            className="pile-select"
            onClick={() => onToggleHeld(holdSlot)}
            disabled={selectedCount >= MAX_HAND_SIZE && !heldSelected}
            aria-pressed={heldSelected}
            aria-label={`Extra hold pile ${index + 1}, ${cardLabel(heldCard)}`}
          >
            <span className="pile-stack">
              <CardFace key={heldCard.id} card={heldCard} />
            </span>
          </button>
        </div>
      );
    }

    // Force-emptied by giving up, never drained through play — stays inert.
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
          <StackEdges buried={Math.min(buried, PILE_SIZE - 1)} />
          {/* Keyed on the card so a newly revealed top card replays its flip. */}
          <CardFace key={card.id} card={card} />
        </span>
      </button>
    </div>
  );
}
