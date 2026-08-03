# Poker Piles

A daily, single-player poker puzzle for the browser. Same deal for everyone, every day.

Fifty-six cards — a standard deck plus four wilds — are dealt into 8 piles of 7. Only each
pile's top card is face up. Play up to 5 of them at a time, at most one per pile, as a poker
hand. Every pile you draw from flips its next card; piles you skip stay put. Keep going until
the deck runs out.

The tension: spreading your picks keeps piles alive, while hammering a few piles strands the
end of the run in partial hands, which score half.

Fully client-side — no backend, no accounts, no leaderboard. The puzzle is derived from the
UTC date, so it is computed in the browser and resets at midnight UTC.

## Running it

```bash
npm install
npm run dev      # dev server
npm test         # unit tests
npm run build    # production bundle into dist/
npm run preview  # serve the built bundle
```

Requires Node 22.

## How it is put together

Game logic is pure and UI-free, so it can be tested on its own:

| Module | Responsibility |
| --- | --- |
| `src/game/rng.ts` | `xmur3` string hash + `mulberry32` PRNG, and the UTC date key |
| `src/game/deck.ts` | Builds the 56-card deck and deals it — a pure function of the date |
| `src/game/evaluator.ts` | Hand detection, wild resolution, partial-hand scaling |
| `src/game/reducer.ts` | Game state: selection, submitting a hand, end of run |
| `src/game/share.ts` | Spoiler-free share text, Web Share API with a clipboard fallback |
| `src/game/storage.ts` | Local-only stats and in-progress run |

React components under `src/components/` only render state and dispatch actions.

### Scoring

Royal Flush 200 · Straight Flush 100 · Four of a Kind 60 · Full House 40 · Flush 30 ·
Straight 25 · Three of a Kind 15 · Two Pair 10 · Pair 5 · High Card 1

Hands of fewer than 5 cards score **half**, rounded to the nearest point, and are limited to
rank-based categories — Four of a Kind, Three of a Kind, Two Pair, Pair, High Card. A straight
or a flush is a five-card pattern, so neither is reachable in a short hand.

Wilds are fully wild: the evaluator resolves each one to whatever rank and suit scores highest.
It only searches suits already present in the hand, since a flush must land in a suit some
natural card already holds — `evaluator.reference.test.ts` checks that shortcut against an
unrestricted search over all 52 identities.

## Deployment

Pushes to `main` build and publish to GitHub Pages via `.github/workflows/deploy.yml`.

This needs one manual step, once: **Settings → Pages → Source: GitHub Actions**. The site then
serves from `https://andrewpapin.github.io/Poker-Piles/`, which is why `vite.config.ts` sets
`base: '/Poker-Piles/'` — Pages paths are case-sensitive and must match the repo name.
