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
      <div className="pile pile--empty" aria-label={`Pile ${index + 1}, empty`}>
        <span className="pile-empty-mark">—</span>
      </div>
    );
  }

  const buried = pile.length - 1;
  return (
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
      <span className="pile-count" aria-hidden="true">
        {pile.length}
      </span>
    </button>
  );
}
