# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Poker Piles is a daily, single-player poker puzzle for the browser (like Wordle). Fifty-six
cards — a standard deck plus four wilds — are dealt into 8 piles of 7, only the top card of
each pile face up. The player plays up to 5 top cards at a time as a poker hand; every pile
drawn from flips its next card, piles skipped stay put, and play continues until the deck runs
out. The puzzle is derived entirely from the UTC date, so the same deal is served to everyone
and resets at midnight UTC. Fully client-side: no backend, no accounts, no leaderboard.

## Commands

```bash
npm install
npm run dev        # dev server
npm test           # run the vitest suite once
npm run test:watch # vitest in watch mode
npm run build      # tsc -b (typecheck) then vite build into dist/
npm run preview    # serve the built bundle
```

Requires Node 22 (matches CI in `.github/workflows/deploy.yml`).

To run a single test file or a specific test, use vitest's normal filtering, e.g.:
```bash
npx vitest run src/game/evaluator.test.ts
npx vitest run -t "some test name"
```

There is no separate lint script — `npm run build` is the source of truth for type
correctness (`tsc -b` with `strict`, `noUnusedLocals`, `noUnusedParameters`,
`noFallthroughCasesInSwitch` all on in `tsconfig.app.json`).

## Architecture

The core design principle: **game logic is pure and UI-free**, so it is fully testable without
touching React or the DOM. Everything under `src/game/` has zero knowledge of components; every
React component under `src/components/` only renders state and dispatches actions — no game
rules live in components.

`src/game/` modules and how they compose:

| Module | Responsibility |
| --- | --- |
| `rng.ts` | `xmur3` string hash + `mulberry32` PRNG; also `todayKey()`, the UTC date string that seeds everything |
| `deck.ts` | `buildDeck()` (canonical 56-card deck), `shuffle()`, `dealPiles(dateKey)` — the whole deal is a pure function of the date |
| `evaluator.ts` | `evaluateHand()`: hand categorization and optimal wild-card resolution, memoized via a cache keyed on sorted card identities |
| `reducer.ts` | `gameReducer`/`GameState`/`GameAction`: selection, hold slots, submitting a hand, giving up, detecting end-of-run |
| `share.ts` | Spoiler-free share text: a block grid of per-hand tiers (never a rank, suit or category name); Web Share API with a clipboard (and `execCommand` textarea) fallback |
| `storage.ts` | localStorage persistence for stats and an in-progress run; every access is try/catch-guarded since Safari private mode throws on write |
| `types.ts` | Shared types (`Card`, `Pile`, `HandCategory`, `HandResult`, `GameState` shape helpers) and constants (`CATEGORY_POINTS`, `CATEGORY_TIER`, `PILE_COUNT`, `PILE_SIZE`, `MAX_HAND_SIZE`, `WILD_COUNT`) |

Data flow: `App.tsx` seeds state via `todayKey()` + `loadGame()`/`initGame()`, holds it in a
single `useReducer(gameReducer, ...)`, and passes derived values (`selectedCards`,
`livePileCount`) down to `Board`, `HandBar`, `Header`, `Results`. All mutation goes through
`dispatch` with the `GameAction` variants (`toggle`, `toggleHeld`, `hold`, `clear`, `submit`,
`giveUp`, `newGame`). Every
state change is persisted to localStorage via `saveGame` in a `useEffect`, so a backgrounded
tab silently picks its run back up.

### Key invariants worth knowing before touching game logic

- **A pile is a stack**: the *last* array element is the face-up top card (`topCard()` in
  `deck.ts`). Only the top card of a pile is ever selectable, so "at most one card per pile" in
  a hand holds by construction — the reducer doesn't need to enforce it separately.
- **Wilds are fully wild** and always resolved to whichever rank/suit scores highest
  (`bestCategory5`/`bestCategoryPartial` in `evaluator.ts`). The candidate-suit search is
  restricted to suits already present among the natural cards in the hand — a flush must land
  in a suit some natural card already holds. `evaluator.reference.test.ts` verifies this
  shortcut against an unrestricted 52-identity search, so preserve that invariant (and its
  test) if you touch wild resolution.
- **Hand size never scales the score.** A hand is worth its category and nothing else, so a pair
  is 5 points whether it came from two cards or from five. What hand size *does* decide is which
  categories are reachable: fewer than 5 cards is restricted to rank-based categories (Four of a
  Kind down to High Card), because a straight, flush or full house is inherently a 5-card
  pattern. That split lives in `categorize5` vs. `categorizePartial`, and `bestCategory5` vs.
  `bestCategoryPartial`; `FIVE_CARD_ONLY` in `types.ts` names the categories it excludes, and the
  rules sheet marks them from that same set.
- **High Card is worth 0, and that is load-bearing.** Because every one of the 56 cards is
  eventually played, the quantity that governs strategy is points *per card*, not per hand. A
  non-zero High Card would make chopping a run into single-card hands score better than playing
  full ones (the old rules paid 1 point a card for exactly that), and it is what keeps padding a
  hand with dead cards free rather than profitable — spare cards are a board-churn decision, not
  a scoring one. Don't raise it without re-deriving that.
- **Determinism**: `dealPiles(dateKey)` must stay a pure function of the date string for the
  daily-puzzle guarantee to hold — never introduce `Math.random()` or wall-clock reads into
  `game/` outside of `rng.ts`'s `todayKey()`.
- **`giveUp` is a forfeit, not an auto-play**: it discards the remaining cards unscored and sets
  `gaveUp`, which `Results` reads. It deliberately does not fabricate one-card hands for the
  remainder — under this scoring they would all be worth 0 and would bury the run's real hands.
- Scoring table (`CATEGORY_POINTS` in `types.ts`): Royal Flush 200, Straight Flush 100, Four of
  a Kind 60, Full House 40, Flush 30, Straight 25, Three of a Kind 15, Two Pair 10, Pair 5, High
  Card 0.

## Deployment

Pushes to `main` build and publish to GitHub Pages via `.github/workflows/deploy.yml` (runs
`npm test` then `npm run build` before deploying). The site serves from
`https://andrewpapin.github.io/Poker-Piles/`, which is why `vite.config.ts` sets
`base: '/Poker-Piles/'` — GitHub Pages paths are case-sensitive and must match the repo name
exactly.
