import { Pile } from './Pile';
import { MAX_HAND_SIZE } from '../game/types';
import type { Card, Pile as PileType } from '../game/types';

type Props = {
  piles: PileType[];
  selectedPiles: number[];
  selectedCount: number;
  /** A hold slot is armed: the next pile tap banks a card instead of selecting it. */
  holdArmed: boolean;
  onToggle: (index: number) => void;
  /** Parallel to `piles` — each pile's own extra hold slot, once it has drained. */
  pileHoldIndex: (number | null)[];
  held: (Card | null)[];
  selectedHeldIndices: number[];
  armedHoldSlot: number | null;
  onArmHold: (slot: number) => void;
  onToggleHeld: (slot: number) => void;
};

export function Board({
  piles,
  selectedPiles,
  selectedCount,
  holdArmed,
  onToggle,
  pileHoldIndex,
  held,
  selectedHeldIndices,
  armedHoldSlot,
  onArmHold,
  onToggleHeld,
}: Props) {
  const atCapacity = selectedCount >= MAX_HAND_SIZE;

  return (
    <div className="board">
      {piles.map((pile, i) => {
        const isSelected = selectedPiles.includes(i);
        const holdSlot = pileHoldIndex[i];
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
            holdSlot={holdSlot}
            heldCard={holdSlot !== null ? held[holdSlot] : null}
            heldSelected={holdSlot !== null && selectedHeldIndices.includes(holdSlot)}
            selectedCount={selectedCount}
            armedHoldSlot={armedHoldSlot}
            onArmHold={onArmHold}
            onToggleHeld={onToggleHeld}
          />
        );
      })}
    </div>
  );
}
