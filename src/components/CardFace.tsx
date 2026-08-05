import { RANK_LABELS } from '../game/types';
import type { Card, Suit } from '../game/types';

export function cardLabel(card: Card): string {
  if (card.kind === 'wild') return 'Wild card';
  const suitNames = { S: 'spades', H: 'hearts', D: 'diamonds', C: 'clubs' } as const;
  return `${RANK_LABELS[card.rank]} of ${suitNames[card.suit]}`;
}

/**
 * Suits are drawn, not typed. The Unicode glyphs ♠♥♦♣ are absent from most
 * webfont latin subsets and several mobile platforms promote ♥ and ♦ to colour
 * emoji, which at pip size renders a glossy 3D heart in the middle of a playing
 * card. Paths make every suit deterministic and scale to any card size.
 */
const SUIT_PATHS: Record<Suit, string> = {
  S: 'M12 2.2C12 2.2 4.6 8.6 4.6 13.1c0 2.6 1.9 4.5 4.3 4.5 1.2 0 2.2-.5 2.8-1.2-.2 2.1-1.1 3.8-2.5 4.9v.5h5.6v-.5c-1.4-1.1-2.3-2.8-2.5-4.9.6.7 1.6 1.2 2.8 1.2 2.4 0 4.3-1.9 4.3-4.5C19.4 8.6 12 2.2 12 2.2z',
  H: 'M12 21.4C8.6 18.6 2.6 14.3 2.6 9.4 2.6 6.2 4.9 4 7.7 4c2 0 3.5 1.1 4.3 2.5C12.8 5.1 14.3 4 16.3 4c2.8 0 5.1 2.2 5.1 5.4 0 4.9-6 9.2-9.4 12z',
  D: 'M12 2.2 20 12l-8 9.8L4 12z',
  C: 'M12 2.2a3.9 3.9 0 0 0-3.1 6.3 3.9 3.9 0 1 0 .7 6.5c.6 0 1.2-.1 1.7-.4-.2 2.1-1.1 3.8-2.5 4.9v.5h6.4v-.5c-1.4-1.1-2.3-2.8-2.5-4.9.5.3 1.1.4 1.7.4a3.9 3.9 0 1 0 .7-6.5A3.9 3.9 0 0 0 12 2.2z',
};

const STAR_PATH =
  'M12 2.4 14.9 8.3 21.4 9.2 16.7 13.8 17.8 20.3 12 17.2 6.2 20.3 7.3 13.8 2.6 9.2 9.1 8.3z';

function Pip({ suit, className }: { suit: Suit; className: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d={SUIT_PATHS[suit]} fill="currentColor" />
    </svg>
  );
}

function Star({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d={STAR_PATH} fill="currentColor" />
    </svg>
  );
}

/**
 * A card carries its value twice — a bare rank index in the top-left and the
 * same rank repeated along the bottom edge, where the wild card prints its
 * wordmark — around one large centred pip. The index is rank-only: the suit is
 * already unmistakable from the centre pip, and a second small pip under the
 * number only crowded it. Everything inside is sized in `em` off the font-size
 * the parent sets on `.card`, so the same component serves a board pile and a
 * hold slot without a size prop.
 */
export function CardFace({ card }: { card: Card }) {
  if (card.kind === 'wild') {
    return (
      <span className="card card--wild">
        <span className="card-index" aria-hidden="true">
          <Star className="card-index-pip" />
        </span>
        <Star className="card-pip" />
        <span className="card-wordmark" aria-hidden="true">
          Wild
        </span>
      </span>
    );
  }

  return (
    <span className={`card card--suit-${card.suit.toLowerCase()}`}>
      <span className="card-index" aria-hidden="true">
        <span className="card-index-rank">{RANK_LABELS[card.rank]}</span>
      </span>
      <Pip suit={card.suit} className="card-pip" />
      <span className="card-wordmark card-wordmark--rank" aria-hidden="true">
        {RANK_LABELS[card.rank]}
      </span>
    </span>
  );
}
