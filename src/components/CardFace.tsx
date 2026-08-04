import { RANK_LABELS, SUIT_GLYPHS } from '../game/types';
import type { Card } from '../game/types';

export function cardLabel(card: Card): string {
  if (card.kind === 'wild') return 'Wild card';
  const suitNames = { S: 'spades', H: 'hearts', D: 'diamonds', C: 'clubs' } as const;
  return `${RANK_LABELS[card.rank]} of ${suitNames[card.suit]}`;
}

export function CardFace({ card }: { card: Card }) {
  if (card.kind === 'wild') {
    return (
      <span className="card card--wild">
        <span className="card-rank">★</span>
        <span className="card-suit">Wild</span>
      </span>
    );
  }

  return (
    <span className={`card card--suit-${card.suit.toLowerCase()}`}>
      <span className="card-rank">{RANK_LABELS[card.rank]}</span>
      <span className="card-suit">{SUIT_GLYPHS[card.suit]}</span>
    </span>
  );
}
