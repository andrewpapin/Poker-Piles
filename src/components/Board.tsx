import { Pile } from './Pile';
import { MAX_HAND_SIZE } from '../game/types';
import type { Pile as PileType } from '../game/types';

type Props = {
  piles: PileType[];
  selectedPiles: number[];
  selectedCount: number;
  /** A hold slot is armed: the next pile tap banks a card instead of selecting it. */
  holdArmed: boolean;
  onToggle: (index: number) => void;
};

export function Board({ piles, selectedPiles, selectedCount, holdArmed, onToggle }: Props) {
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
            // Holding doesn't touch the hand selection, so capacity never blocks it.
            disabled={!holdArmed && atCapacity && !isSelected}
            holdArmed={holdArmed && !isSelected}
            onToggle={onToggle}
          />
        );
      })}
    </div>
  );
}
