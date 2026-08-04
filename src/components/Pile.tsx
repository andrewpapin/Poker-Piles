import { CardFace, cardLabel } from './CardFace';
import { topCard } from '../game/deck';
import { PILE_SIZE } from '../game/types';
import type { Pile as PileType } from '../game/types';

type Props = {
  pile: PileType;
  index: number;
  selected: boolean;
  disabled: boolean;
  onToggle: (index: number) => void;
};

/**
 * A pile renders as its face-up card over one rule per buried card. The rules
 * are the depth readout — countable at a glance, which is why no number is
 * printed. The rule row is height-reserved to a full pile so the board never
 * reflows as piles drain.
 */
function StackRules({ buried }: { buried: number }) {
  return (
    <span className="stack" aria-hidden="true">
      {Array.from({ length: buried }, (_, i) => (
        <i key={i} />
      ))}
    </span>
  );
}

export function Pile({ pile, index, selected, disabled, onToggle }: Props) {
  const card = topCard(pile);

  if (!card) {
    return (
      <div className="pile pile--spent" aria-label={`Pile ${index + 1}, empty`}>
        <span className="card card--ghost" />
        <StackRules buried={0} />
      </div>
    );
  }

  const buried = pile.length - 1;
  return (
    <button
      type="button"
      className={`pile${selected ? ' pile--selected' : ''}`}
      onClick={() => onToggle(index)}
      disabled={disabled}
      aria-pressed={selected}
      aria-label={`Pile ${index + 1}, ${cardLabel(card)}, ${buried} card${
        buried === 1 ? '' : 's'
      } beneath`}
    >
      {/* Keyed on the card so a newly revealed top card replays its entrance. */}
      <CardFace key={card.id} card={card} />
      <StackRules buried={Math.min(buried, PILE_SIZE - 1)} />
    </button>
  );
}
