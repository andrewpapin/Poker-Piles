import { CardFace, cardLabel } from './CardFace';
import { topCard } from '../game/deck';
import type { Pile as PileType } from '../game/types';

type Props = {
  pile: PileType;
  index: number;
  selected: boolean;
  disabled: boolean;
  onToggle: (index: number) => void;
};

export function Pile({ pile, index, selected, disabled, onToggle }: Props) {
  const card = topCard(pile);

  if (!card) {
    return (
      <div className="pile-slot">
        <div className="pile pile--empty" aria-label={`Pile ${index + 1}, empty`}>
          <span className="pile-empty-mark">—</span>
        </div>
        {/* Non-breaking space reserves the label row so empty piles don't reflow the grid. */}
        <span className="pile-count" aria-hidden="true">
          &nbsp;
        </span>
      </div>
    );
  }

  const buried = pile.length - 1;
  return (
    <div className="pile-slot">
      <button
        type="button"
        className={`pile pile--card${selected ? ' pile--selected' : ''}`}
        onClick={() => onToggle(index)}
        disabled={disabled}
        aria-pressed={selected}
        aria-label={`Pile ${index + 1}, ${cardLabel(card)}, ${buried} card${
          buried === 1 ? '' : 's'
        } beneath`}
      >
        {/* Keyed on the card so a newly revealed top card replays the flip. */}
        <span key={card.id} className="pile-card">
          <CardFace card={card} />
        </span>
      </button>
      <span className="pile-count" aria-hidden="true">
        {pile.length} left
      </span>
    </div>
  );
}
