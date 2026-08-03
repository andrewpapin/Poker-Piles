import { Pile } from './Pile';
import { MAX_HAND_SIZE } from '../game/types';
import type { Pile as PileType } from '../game/types';

type Props = {
  piles: PileType[];
  selected: number[];
  onToggle: (index: number) => void;
};

export function Board({ piles, selected, onToggle }: Props) {
  const atCapacity = selected.length >= MAX_HAND_SIZE;

  return (
    <div className="board">
      {piles.map((pile, i) => {
        const isSelected = selected.includes(i);
        return (
          <Pile
            key={i}
            pile={pile}
            index={i}
            selected={isSelected}
            // At five cards you can still deselect, just not add a sixth.
            disabled={atCapacity && !isSelected}
            onToggle={onToggle}
          />
        );
      })}
    </div>
  );
}
