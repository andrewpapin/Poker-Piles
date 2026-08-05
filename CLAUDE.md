# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Poker Piles is a daily, single-player poker puzzle for the browser (like Wordle). Fifty-six
cards — a standard deck plus four wilds — are dealt into 8 piles of 7, only the top card of
each pile face up. The player plays up to 5 cards at a time as a poker hand, drawn from the
pile tops and from two **hold slots** where a card can be banked for a later hand. Every pile
drawn from flips its next card, piles skipped stay put, and play continues until the board is
empty. The puzzle is derived entirely from the UTC date, so the same deal is served to everyone
and resets at midnight UTC. Fully client-side: no backend, no accounts, no leaderboard, no
network I/O of any kind at runtime.

## Commands

```bash
npm install
npm run dev        # dev server
npm test           # run the vitest suite once (72 tests, ~7s)
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

Nearly all of the suite's wall-clock time is `evaluator.reference.test.ts`, which brute-forces
wild resolution against an unrestricted search; the other four files together run in well under
a second. When iterating on non-evaluator code, filter it out rather than waiting on it.

There is no lint script and no formatter config — `npm run build` is the source of truth for
correctness (`tsc -b` with `strict`, `noUnusedLocals`, `noUnusedParameters`,
`noFallthroughCasesInSwitch` all on in `tsconfig.app.json`). Match the surrounding style by
hand: single quotes, semicolons, 2-space indent, ~100 column comments.

## Repository layout

```
src/game/        pure game logic — no React, no DOM (except share.ts's clipboard fallback)
src/components/  presentational React components — no game rules
src/App.tsx      the only stateful component: one useReducer plus a little local UI state
src/styles.css   the entire stylesheet, ~1500 lines, hand-written, no CSS framework
src/fonts/       the self-hosted Outfit variable subset (woff2)
BACKLOG.md       prioritized audit findings, items numbered PP-1..PP-23 (stable IDs)
```

## Architecture

The core design principle: **game logic is pure and UI-free**, so it is fully testable without
touching React or the DOM. Everything under `src/game/` has zero knowledge of components; every
React component under `src/components/` only renders state and dispatches actions — no game
rules live in components. The one place this is bent is `HandBar`, which calls `evaluateHand`
directly to preview the live selection; it reads the evaluator, it does not re-implement it.

`src/game/` modules and how they compose:

| Module | Responsibility |
| --- | --- |
| `rng.ts` | `xmur3` string hash + `mulberry32` PRNG; also `todayKey()`, the UTC date string that seeds everything |
| `deck.ts` | `buildDeck()` (canonical 56-card deck), `shuffle()` (Fisher-Yates), `dealPiles(dateKey)`, `topCard()` — the whole deal is a pure function of the date |
| `evaluator.ts` | `evaluateHand()`: hand categorization and optimal wild-card resolution, memoized via a cache keyed on sorted card identities |
| `reducer.ts` | `gameReducer`/`GameState`/`GameAction`, plus the derived selectors (`selectedCards`, `selectedPileIndices`, `selectedHeldIndices`, `heldCount`, `openHoldSlot`, `cardsRemaining`, `livePileCount`) |
| `share.ts` | `formatPuzzleDate()` and `buildShareText()` (spoiler-free: title, score, link — never a rank, suit or category name); `shareResults()` uses the Web Share API with a clipboard, then `execCommand` textarea, fallback |
| `storage.ts` | localStorage persistence for daily stats, the first-visit help flag, and an in-progress run; every access is try/catch-guarded since Safari private mode throws on write |
| `types.ts` | Shared types (`Card`, `Pile`, `HandCategory`, `HandResult`) and constants (`CATEGORY_POINTS`, `CATEGORY_LABELS`, `CATEGORY_TIER`, `TIER_COUNT`, `FIVE_CARD_ONLY`, `PILE_COUNT`, `PILE_SIZE`, `MAX_HAND_SIZE`, `WILD_COUNT`, `HOLD_SLOT_COUNT`, `RANK_LABELS`, `RANK_WORDS`, `SUIT_GLYPHS`) |

`src/components/`:

| Component | Renders |
| --- | --- |
| `Header.tsx` | Title, puzzle date, animated score count-up, and the give-up / help / restart icon buttons |
| `Board.tsx` | The 4×2 grid of piles; decides per-pile `disabled` from selection capacity and hold-arming |
| `Pile.tsx` | One pile: the offset card backs, the face-up `CardFace`, and the remaining-count chip |
| `CardFace.tsx` | A single card face (rank index, drawn suit pip, spelled-out rank wordmark) and `cardLabel()` for a11y strings |
| `HoldSlots.tsx` | The two hold slots — an occupied slot is a selectable card, an empty one is an armable "+" target |
| `HandBar.tsx` | Live readout of the current selection (category, points, five-step tier meter) and the Clear / Play hand buttons |
| `HowToPlay.tsx` | The rules sheet: a five-bullet lockup plus the full scoring ladder, rendered from `CATEGORY_POINTS` |
| `Results.tsx` | The end-of-run *page* — not an overlay: it replaces the play area once the run is over. Score, per-category counts, per-hand list, Play again / Share |

Data flow: `App.tsx` seeds state via `todayKey()` + `loadGame()`/`initGame()`, holds it in a
single `useReducer(gameReducer, ...)`, and passes derived values (`selectedCards`,
`selectedPileIndices`, `selectedHeldIndices`, `livePileCount`, `heldCount`) down. All game
mutation goes through `dispatch` with the eight `GameAction` variants (`toggle`, `toggleHeld`,
`hold`, `clear`, `submit`, `giveUp`, `markRecorded`, `newGame`). Every state change is persisted
to localStorage via `saveGame` in a `useEffect`, so a backgrounded tab silently picks its run
back up.

`App.tsx` renders one of two screens off `state.status`: the play screen (header, board, hold
tray, hand bar) or, once the run is `complete`, the results page (header with its score block
suppressed, then `Results` in the play area's place). The shell — `.app`, its `--cw` derivation
and the `HowToPlay` overlay — is common to both; only the flexible middle row differs.

`App.tsx` also holds three pieces of purely-presentational state that deliberately do **not**
live in the reducer, because none of them affect the game: `showHelp`, the scored-hand `toast`,
and `armedHoldSlot`. That last one is the interaction state behind the two-way hold gesture —
tap a card then an empty slot, or tap an empty slot then a card. The reducer only ever sees the
resulting `hold` action with a resolved slot index.

### Key invariants worth knowing before touching game logic

- **A pile is a stack**: the *last* array element is the face-up top card (`topCard()` in
  `deck.ts`). Only the top card of a pile is ever selectable, so "at most one card per pile" in
  a hand holds by construction — the reducer doesn't need to enforce it separately.
- **The 5-card cap is shared across origins.** A selection entry is
  `{ origin: 'pile' | 'held', index }`, and `MAX_HAND_SIZE` bounds the combined list, so two
  held cards plus three pile cards is a legal full hand.
- **A hand can be played from hold slots alone.** The run is complete only when every pile *and*
  every hold slot is empty (`submit`'s `exhausted` check) — emptying the board while a card is
  still banked must leave the game playing. There is a reducer test pinning this; it is the
  easiest end-of-run bug to reintroduce.
- **`hold` can never end the game**, since banking a card only ever fills a slot, so that branch
  deliberately leaves `status` untouched. It *does* drop any selection pointing at the source
  pile, otherwise a stale entry would silently start referring to the card revealed underneath.
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
  `bestCategoryPartial`; `FIVE_CARD_ONLY` in `types.ts` names the categories it excludes. The
  rules sheet does not mark those rows — its copy was cut back to the five-bullet lockup, so the
  only place the split surfaces in the UI is `HandBar`'s "no straights or flushes" note, which
  appears once pile count plus held count drops below 5.
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
  Card 0. Declaration order is best-to-worst and both `HowToPlay` and `Results` rely on it
  (`Object.keys(CATEGORY_POINTS)`) — reordering the object reorders the UI.

### Persistence

Keys are namespaced and versioned: `pokerpiles:v2:stats`, `pokerpiles:v2:game`,
`pokerpiles:v2:seenHelp`. The bump to `v2` came with the scoring change — a run or best score
recorded under the old size-scaled rules isn't comparable to one scored under these, so the old
keys were abandoned rather than migrated. **Any future change that alters what a score means
should bump the prefix again** rather than migrate.

Within a version, `loadGame` migrates rather than discards where it can: saves predating hold
slots lack `held` and store `selected` as bare pile-index numbers, and both are repaired in
place so a returning player doesn't lose a run. Its validation is top-level only, which is a
known gap (BACKLOG PP-2). Nothing survives a new UTC day — `loadStats`/`loadGame` both compare
`dateKey` and start fresh on mismatch — so there is no streak or cross-day history by design.

## UI and styling conventions

- **One stylesheet, no framework.** `src/styles.css` is organised into commented sections
  (Shell, Header, Board, Card, Hold tray, Hand bar, Sheets, Results, Motion, then the landscape
  and desktop layouts, then reduced motion). Tokens are CSS custom properties on `:root`, with a
  second palette under `:root[data-theme='dark']`. There are two themes and both are
  dark-grounded: **Party** (the default, on `:root`, carried by the stored theme value `'light'`)
  is near-black with saturated neon; **night** (`data-theme='dark'`) is warm and dimmed. Neither
  is an inversion — card faces go dark in both, and both declare `color-scheme: dark`. The theme
  is an explicit choice made with the header toggle, stamped onto `<html>` before first paint by
  the inline script in `index.html` and persisted at `pokerpiles:v2:theme`; the system
  `prefers-color-scheme` is only consulted for a player who has never toggled. The stored values
  are still `'light' | 'dark'` because they are load-bearing across `index.html`,
  `game/storage.ts` and existing saves — read them as "Party" and "night".
- **The whole game fits one screen at every size, and the page never scrolls**
  (`html, body { overflow: hidden }`). This is guaranteed by `--cw`, the width of one card,
  derived in `.app` as the `min()` of a width-derived and a height-derived value so whichever
  axis is scarce wins. Everything else — card radius, pip size, stack offsets, hold-slot size —
  is computed from `--cw` in `em`/`calc`. If you add or resize chrome, update the `--header-h` /
  `--holds-h` / `--handbar-h` estimates that feed `--board-h`. The results page obeys the same
  rule the other way round: it takes the play area's row and scrolls only `.results-body`
  internally, so a long run's hand list never pushes Play again / Share off-screen.
- **Suits and icons are drawn as inline SVG paths, never typed as Unicode.** `♠♥♦♣` are missing
  from most webfont latin subsets, and several mobile platforms promote `♥`/`♦` to colour emoji.
  Same reasoning for the restart/help/flag glyphs in `Header`. (`SUIT_GLYPHS` still exists in
  `types.ts` but nothing renders it.)
- **The 5-step tier ramp (`CATEGORY_TIER`, `TIER_COUNT`, `--tier-0..4`) is shared vocabulary**
  between `HandBar`'s live meter and `Results`' per-hand rows, so a hand looks the same colour
  wherever it appears. It exists to convey "how good was that?" without printing a points table.
- **The accent sits outside the four suit hues** so "selected" is not misread as a suit — cleanly
  so in the night theme (indigo against white/rose/amber/green), less so in Party, where the
  accent pink and the heart rose are neighbours. Selection there leans on the ring, the inset
  stroke and the lift as much as on hue; keep all three if you touch `.pile--selected .card`.
- Accessibility is partial and known-incomplete: `aria-label`/`aria-pressed` are used
  throughout, but the `HowToPlay` overlay declares `aria-modal` without implementing focus
  trapping or Escape, and scoring is not announced to assistive tech. See BACKLOG PP-3 through
  PP-5 before "fixing" these piecemeal.
- Motion respects `prefers-reduced-motion` by zeroing durations rather than removing animations,
  so fill modes still land and elements don't get stranded mid-transition.

## Testing conventions

Tests are colocated with the module (`src/game/foo.test.ts`) and cover `game/` only — there are
no component or integration tests yet (BACKLOG PP-15). `storage.ts` is covered by
`storage.test.ts` against a `Map`-backed `localStorage` stub (round-trip, rejection paths,
migrations, and the private-mode throw paths); PP-15's App-level wiring is still open.
They are plain vitest with no DOM environment, which is only possible because `game/` is pure;
keep it that way. `evaluator.reference.test.ts` is a property-style oracle test rather than an
example test — it exists specifically to guard the wild-resolution shortcut, so it should be
kept passing rather than trimmed for speed.

## Deployment

Pushes to `main` build and publish to GitHub Pages via `.github/workflows/deploy.yml` (runs
`npm ci`, `npm test`, then `npm run build` before deploying). Pull requests run the same
three steps via `.github/workflows/ci.yml` (no deploy step), so a broken PR fails its check
rather than merging silently. The site serves from `https://andrewpapin.github.io/Poker-Piles/`, which
is why `vite.config.ts` sets `base: '/Poker-Piles/'` — GitHub Pages paths are case-sensitive and
must match the repo name exactly. For the same reason the manifest and icon are referenced with
relative paths in `index.html`, and the favicon is an inline data URI (no path to get wrong).

## Working in this repo

- `BACKLOG.md` is the standing to-do list, written from a full audit. Items have stable IDs
  (`PP-1`..`PP-23`) meant to be cited in commit messages and PR titles. It also records a
  **"Verified sound — do not re-audit"** list and a **"Deliberate non-goals"** list (predictable
  daily seed, no backend/accounts/sync) — check both before reporting something as a bug. Note
  that a few of its references have themselves aged: it describes a `finishGame` action that has
  since been replaced by `giveUp`.
- `README.md` is currently stale on the rules — it still documents High Card as 1 point, claims
  short hands score half, and predates hold slots entirely. Treat `types.ts` and this file as
  authoritative, and fix the README if you touch scoring copy.
- Commit messages are sentence-case imperative prose, no prefixes ("Score hands by category
  alone, not by hand size", "Move the remaining-count chip off the card, into the stack's
  bottom-right"). Match that rather than a `type(scope):` convention.
