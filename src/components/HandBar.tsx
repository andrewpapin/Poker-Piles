import { evaluateHand } from '../game/evaluator';
import { CATEGORY_LABELS, MAX_HAND_SIZE } from '../game/types';
import type { Card } from '../game/types';

type Props = {
  cards: Card[];
  livePiles: number;
  onClear: () => void;
  onSubmit: () => void;
};

export function HandBar({ cards, livePiles, onClear, onSubmit }: Props) {
  const hand = cards.length > 0 ? evaluateHand(cards) : null;
  // Once fewer than 5 piles hold cards, a short hand is forced rather than a mistake.
  const forcedPartial = livePiles < MAX_HAND_SIZE;

  return (
    <div className="handbar">
      <div className="handbar-preview">
        {hand ? (
          <>
            <span className="handbar-category">{CATEGORY_LABELS[hand.category]}</span>
            <span className="handbar-points">
              {hand.score} {hand.score === 1 ? 'pt' : 'pts'}
              {hand.partial && (
                <span className="handbar-penalty">
                  {forcedPartial ? ' · partial −50%' : ` · ${cards.length}/5 −50%`}
                </span>
              )}
            </span>
          </>
        ) : (
          <span className="handbar-hint">
            {forcedPartial
              ? `Tap up to ${livePiles} card${livePiles === 1 ? '' : 's'} — partial hands score half`
              : 'Tap up to 5 cards, one per pile'}
          </span>
        )}
      </div>

      <div className="handbar-actions">
        <button
          type="button"
          className="btn btn--ghost"
          onClick={onClear}
          disabled={cards.length === 0}
        >
          Clear
        </button>
        <button
          type="button"
          className="btn btn--primary"
          onClick={onSubmit}
          disabled={cards.length === 0}
        >
          Play hand
        </button>
      </div>
    </div>
  );
}
