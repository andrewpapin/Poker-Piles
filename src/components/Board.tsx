import { Pile } from './Pile';
import { topCard } from '../game/deck';
import { MAX_HAND_SIZE } from '../game/types';
import type { Pile as PileType } from '../game/types';

type Props = {
  piles: PileType[];
  selectedPiles: number[];
  selectedCount: number;
  holdAvailable: boolean;
  onToggle: (index: number) => void;
  onHold: (index: number) => void;
};

export function Board({ piles, selectedPiles, selectedCount, holdAvailable, onToggle, onHold }: Props) {
  const atCapacity = selectedCount >= MAX_HAND_SIZE;

  return (
    <div className="board">
      {piles.map((pile, i) => {
        const isSelected = selectedPiles.includes(i);
        return (
          <Pile
            key={i}
            pile={pile}
            index={i}
            selected={isSelected}
            // At five cards you can still deselect, just not add a sixth.
            disabled={atCapacity && !isSelected}
            // Holding doesn't touch the hand selection, so it stays available at capacity.
            holdEnabled={topCard(pile) !== null && !isSelected && holdAvailable}
            onToggle={onToggle}
            onHold={onHold}
          />
        );
      })}
    </div>
  );
}
