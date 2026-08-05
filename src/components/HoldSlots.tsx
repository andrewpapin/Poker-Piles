import { CardFace, cardLabel } from './CardFace';
import { MAX_HAND_SIZE } from '../game/types';
import type { Card } from '../game/types';

type Props = {
  held: (Card | null)[];
  selected: number[];
  selectedCount: number;
  /** The empty slot currently armed for holding, or null if none is. */
  armedSlot: number | null;
  onToggle: (slot: number) => void;
  onArm: (slot: number) => void;
};

export function HoldSlots({ held, selected, selectedCount, armedSlot, onToggle, onArm }: Props) {
  return (
    <div className="hold-tray">
      <span className="hold-tray-label" aria-hidden="true">
        Hold
      </span>
      <div className="hold-slots">
        {held.map((card, i) => {
          if (!card) {
            const armed = armedSlot === i;
            return (
              <button
                key={i}
                type="button"
                className={`card card--ghost hold-slot-empty${armed ? ' hold-slot-empty--armed' : ''}`}
                onClick={() => onArm(i)}
                aria-pressed={armed}
                aria-label={
                  armed ? `Hold slot ${i + 1}, armed — tap a card to hold it here` : `Hold slot ${i + 1}, empty`
                }
              >
                <span className="hold-slot-empty-plus" aria-hidden="true">
                  +
                </span>
              </button>
            );
          }

          const isSelected = selected.includes(i);
          return (
            <button
              key={i}
              type="button"
              className={`hold-slot${isSelected ? ' hold-slot--selected' : ''}`}
              onClick={() => onToggle(i)}
              disabled={selectedCount >= MAX_HAND_SIZE && !isSelected}
              aria-pressed={isSelected}
              aria-label={`Hold slot ${i + 1}, ${cardLabel(card)}`}
            >
              <CardFace key={card.id} card={card} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
