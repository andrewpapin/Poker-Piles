export type Suit = 'S' | 'H' | 'D' | 'C';

/** Ranks are stored 2..14 with Ace high (14). The wheel (A-2-3-4-5) is handled in the evaluator. */
export type Rank = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14;

export type NormalCard = { id: string; kind: 'normal'; rank: Rank; suit: Suit };
export type WildCard = { id: string; kind: 'wild' };
export type Card = NormalCard | WildCard;

/** A pile is a stack: the LAST element is the face-up top card. */
export type Pile = Card[];

export type HandCategory =
  | 'ROYAL_FLUSH'
  | 'STRAIGHT_FLUSH'
  | 'FOUR_OF_A_KIND'
  | 'FULL_HOUSE'
  | 'FLUSH'
  | 'STRAIGHT'
  | 'THREE_OF_A_KIND'
  | 'TWO_PAIR'
  | 'PAIR'
  | 'HIGH_CARD';

export type HandResult = {
  category: HandCategory;
  /** Score before any partial-hand penalty. */
  basePoints: number;
  /** Final score: basePoints, halved and rounded for hands of fewer than 5 cards. */
  score: number;
  cardCount: number;
  /** True when the hand had fewer than 5 cards and took the 50% penalty. */
  partial: boolean;
};

export const CATEGORY_POINTS: Record<HandCategory, number> = {
  ROYAL_FLUSH: 200,
  STRAIGHT_FLUSH: 100,
  FOUR_OF_A_KIND: 60,
  FULL_HOUSE: 40,
  FLUSH: 30,
  STRAIGHT: 25,
  THREE_OF_A_KIND: 15,
  TWO_PAIR: 10,
  PAIR: 5,
  HIGH_CARD: 1,
};

export const CATEGORY_LABELS: Record<HandCategory, string> = {
  ROYAL_FLUSH: 'Royal Flush',
  STRAIGHT_FLUSH: 'Straight Flush',
  FOUR_OF_A_KIND: 'Four of a Kind',
  FULL_HOUSE: 'Full House',
  FLUSH: 'Flush',
  STRAIGHT: 'Straight',
  THREE_OF_A_KIND: 'Three of a Kind',
  TWO_PAIR: 'Two Pair',
  PAIR: 'Pair',
  HIGH_CARD: 'High Card',
};

/**
 * Presentation tier, 0 (weakest) to 4 (strongest). Collapses the ten-rung
 * category ladder into five steps that can be shown as countable cells in the
 * UI and as coloured blocks in the share text — the two places that need a
 * coarse "how good was that?" without printing a points table.
 */
export const CATEGORY_TIER: Record<HandCategory, 0 | 1 | 2 | 3 | 4> = {
  HIGH_CARD: 0,
  PAIR: 1,
  TWO_PAIR: 1,
  THREE_OF_A_KIND: 2,
  STRAIGHT: 2,
  FLUSH: 2,
  FULL_HOUSE: 3,
  FOUR_OF_A_KIND: 3,
  STRAIGHT_FLUSH: 4,
  ROYAL_FLUSH: 4,
};

export const TIER_COUNT = 5;

export const SUITS: Suit[] = ['S', 'H', 'D', 'C'];
export const RANKS: Rank[] = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];

export const SUIT_GLYPHS: Record<Suit, string> = { S: '♠', H: '♥', D: '♦', C: '♣' };

export const RANK_LABELS: Record<Rank, string> = {
  2: '2',
  3: '3',
  4: '4',
  5: '5',
  6: '6',
  7: '7',
  8: '8',
  9: '9',
  10: '10',
  11: 'J',
  12: 'Q',
  13: 'K',
  14: 'A',
};

export const PILE_COUNT = 8;
export const PILE_SIZE = 7;
export const MAX_HAND_SIZE = 5;
export const WILD_COUNT = 4;
export const HOLD_SLOT_COUNT = 2;
