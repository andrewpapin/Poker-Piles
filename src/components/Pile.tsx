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

export function Pile({ pile, index, selected, disabled, holdEnabled, onToggle, onHold }: Props) {
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
        {/* Keyed on the card so a newly revealed top card replays its entrance. */}
        <CardFace key={card.id} card={card} />
        <StackRules buried={Math.min(buried, PILE_SIZE - 1)} />
      </button>
      <button
        type="button"
        className="pile-hold"
        onClick={() => onHold(index)}
        disabled={!holdEnabled}
        aria-label={`Hold ${cardLabel(card)} from pile ${index + 1}`}
      >
        Hold
      </button>
    </div>
  );
}
