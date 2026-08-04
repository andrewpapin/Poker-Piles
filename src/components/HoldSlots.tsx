import { CardFace, cardLabel } from './CardFace';
import { MAX_HAND_SIZE } from '../game/types';
import type { Card } from '../game/types';

type Props = {
  held: (Card | null)[];
  selected: number[];
  selectedCount: number;
  onToggle: (slot: number) => void;
};

export function HoldSlots({ held, selected, selectedCount, onToggle }: Props) {
  return (
    <div className="hold-slots">
      {held.map((card, i) => {
        if (!card) {
          return (
            <span key={i} className="card card--ghost hold-slot-empty" aria-label={`Hold slot ${i + 1}, empty`} />
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
  );
}
