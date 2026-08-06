# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Poker Piles is a daily, single-player poker puzzle for the browser (like Wordle). Fifty-six
cards — a standard deck plus four wilds — are dealt into 8 piles of 7, only the top card of
each pile face up. The player plays up to 5 cards at a time as a poker hand, drawn from the
pile tops and from two **hold slots** where a card can be banked for a later hand. Every pile
drawn from flips its next card, piles skipped stay put, and play continues until the board is
empty. The puzzle is derived entirely from the UTC date, so the same deal is served to everyone
and resets at midnight UTC.

The game is playable entirely client-side — no accounts, no leaderboard, and every rule, deal and
score is computed in the browser. The one exception is score collection: when a run finishes, its
score is posted anonymously to a Supabase project so the results sheet can show the day's average
across everyone. That call is strictly best-effort and strictly additive — it happens after the run
is over, it never gates or alters play, and every failure path resolves to "hide the average line".
Offline, the game is unchanged.

## Commands

```bash
npm install
npm run dev        # dev server
npm test           # run the vitest suite once (129 tests, ~7s)
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
src/net/         the only network I/O: anonymous score upload + the daily average
src/components/  presentational React components — no game rules
src/App.tsx      the only stateful component: one useReducer plus a little local UI state
src/styles.css   the entire stylesheet, ~1500 lines, hand-written, no CSS framework
src/fonts/       the self-hosted Outfit variable subset (woff2)
src/test/        shared vitest setup — jest-dom matchers and DOM polyfills for jsdom specs only
supabase/migrations/  the score-collection schema, applied to the hosted project
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
| `evaluator.ts` | `evaluateHand()`: hand categorization and optimal wild-card resolution, memoized via a bounded (`CACHE_LIMIT`, FIFO-evicted) cache keyed on sorted card identities |
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
| `Results.tsx` | The end-of-run *page* — not an overlay: it replaces the play area once the run is over. Score, per-category counts, per-hand list, the day's average, Play again / Share |

`src/net/`:

| Module | Responsibility |
| --- | --- |
| `config.ts` | The Supabase project URL and publishable key, with `VITE_`-prefixed env overrides |
| `scores.ts` | `submitRun()`/`fetchDailySummary()` over `fetch`, plus `clientId()` — the browser's anonymous id |

Nothing under `src/game/` imports `src/net/`; the wiring lives in `App.tsx`, which keeps the game
rules pure and the game itself complete offline. See "Score collection" below for the contract.

Data flow: `App.tsx` seeds state via `todayKey()` + `loadGame()`/`initGame()`, holds it in a
single `useReducer(gameReducer, ...)`, and passes derived values (`selectedCards`,
`selectedPileIndices`, `selectedHeldIndices`, `livePileCount`, `heldCount`) down. All game
mutation goes through `dispatch` with the eight `GameAction` variants (`toggle`, `toggleHeld`,
`hold`, `clear`, `submit`, `giveUp`, `markRecorded`, `newGame`). Every state change schedules a
`saveGame` write in a `useEffect`, debounced (`SAVE_DELAY_MS`) rather than fired on every tap, and
flushed immediately on `visibilitychange`/`pagehide` so a tab closed mid-burst doesn't lose the
debounce window — see PP-21. Either way, a backgrounded tab silently picks its run back up.

`App.tsx` renders one of two screens off `state.status`: the play screen (header, board, hold
tray, hand bar) or, once the run is `complete`, the results page (header with its score block
suppressed, then `Results` in the play area's place). The shell — `.app`, its `--cw` derivation
and the `HowToPlay` overlay — is common to both; only the flexible middle row differs.

`App.tsx` also holds five pieces of purely-presentational state that deliberately do **not**
live in the reducer, because none of them affect the game: `showHelp`, the scored-hand `toast`,
`armedHoldSlot`, and the `community`/`communityPending` pair behind the daily-average line.
`armedHoldSlot` is the interaction state behind the two-way hold gesture — tap a card then an
empty slot, or tap an empty slot then a card. The reducer only ever sees the resulting `hold`
action with a resolved slot index.

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
place so a returning player doesn't lose a run. Validation is deep, not just top-level — every
card, pile, hold slot, selection entry and hand result is checked before the reducer ever sees
it (BACKLOG PP-2). The `GAME_KEY` payload additionally carries its own explicit `version` field
(`GAME_VERSION`), independent of the `v2` key prefix above — that prefix bumps only when a
*score* stops being comparable, this versions the save's *shape*; a save with no `version` field
predates the discriminator and still runs through the migrations above, while a `version` that
doesn't match is discarded outright rather than guessed at (BACKLOG PP-8). Nothing survives a
new UTC day — `loadStats`/`loadGame` both compare `dateKey` and start fresh on mismatch — so
there is no streak or cross-day history by design.

One key is deliberately **outside** the version prefix: `pokerpiles:clientId`, the browser's
anonymous id for score collection (minted in `net/scores.ts`, not `game/storage.ts`, so `game/`
stays free of randomness). The `v2` prefix is bumped when a stored *score* stops being comparable;
this identifies the browser, not a run, and resetting it would let one player's replays land in
the daily average as several separate scores.

### Score collection

When a run completes, `App.tsx` posts `{ client id, score, hands, gaveUp }` to the Supabase RPC
`submit_run` and renders the day's average back on the results sheet. The whole feature is
governed by one rule: **it is additive and best-effort — the game must be complete without it.**

- **`src/game/` never imports `src/net/`.** The game logic stays pure and DOM-free, and the whole
  suite still runs with no network and no DOM. The wiring lives only in `App.tsx`.
- **Every failure resolves to `null`, never a throw.** Offline, blocked by an extension, request
  timed out (8s), project paused, malformed payload — all the same to the caller, which simply
  omits the average line. Nothing about this may ever gate, delay, or alter play.
- **The server owns the truth.** `submit_run` stamps `date_key` from the UTC clock rather than
  trusting the request, bounds the score, and keeps **one row per client id per day** via a unique
  constraint with `on conflict do nothing`. So a replay, a reload of a finished run, or a retried
  submit are all safe — the first finished run of the day is the one that counts, and duplicates
  come back with the current numbers to display rather than double-counting. That is why there is
  no local "already uploaded" flag to drift out of sync: `App.tsx` guards only within a session
  (`submittedRef`, keyed by date), and a submit that failed while offline just succeeds next load.
- **The `runs` table is sealed.** RLS is on with *no policies at all*, and `anon`'s table grants
  are revoked, so the publishable key can reach exactly the two `security definer` functions
  (`submit_run`, `daily_summary`) and nothing else. Raw rows and client ids are not readable by
  anyone holding the key. Supabase's linter flags "RLS enabled, no policy" and "public can execute
  SECURITY DEFINER function" — both are this design working as intended, not findings to fix.
- **The publishable key is committed on purpose** (`net/config.ts`). It identifies the project, it
  does not authorise anything; safety comes from the lockdown above, not from secrecy. Hiding it
  in a build secret would buy nothing and would silently disable scoring for any fork that didn't
  set the variable. `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` override it.
- **The schema is checked in** under `supabase/migrations/`, mirroring what is applied to the
  hosted project. It is the reviewable copy — change the SQL there and apply the same migration,
  rather than editing the database by hand and letting the two drift.
- **What this is not:** the client id is not identity and is never displayed or shared, there is
  still no login and no leaderboard, and the share text is untouched — it stays spoiler-free.
  Determined abuse (clearing storage to submit repeatedly) is possible and knowingly accepted;
  the bar here is "an honest average", not an anti-cheat system.

## UI and styling conventions

- **One stylesheet, no framework.** `src/styles.css` is organised into commented sections
  (Shell, Header, Board, Card, Hold tray, Hand bar, Sheets, Results, Motion, then the landscape
  and desktop layouts, then reduced motion). Tokens are CSS custom properties on `:root`, with a
  second palette under `:root[data-theme='dark']`. There are two themes, and unlike earlier in
  this project's history they are genuine opposites: **Party** (the default, on `:root`, carried
  by the stored theme value `'light'`) is near-black with saturated neon and declares
  `color-scheme: dark`; **Light** (`data-theme='dark'`) is a bright, violet-accented room built
  from the "Velvet Nebula" palette (white cards on an off-white ground, indigo/red/orange/teal
  suits) and declares `color-scheme: light`. Both still carry the same elevation ladder
  (`--surface` → `--surface-sunk` → `--surface-raise` → `--card`, each a step further from the
  ground), just climbing toward white instead of away from it in Light, and Light leans on real
  drop shadows (`--sh-card`, `--sh-lift`, ...) rather than hairlines-only, since shadows read on a
  light ground the way they don't on a near-black one. The theme is an explicit choice made with
  the header toggle, stamped onto `<html>` before first paint by the inline script in
  `index.html` and persisted at `pokerpiles:v2:theme`; the system `prefers-color-scheme` is only
  consulted for a player who has never toggled. The stored values are still `'light' | 'dark'`
  because they are load-bearing across `index.html`, `game/storage.ts` and existing saves — read
  them as "Party" and "Light" (the `'dark'` stored value no longer means a dark theme). Both
  `meta[name="theme-color"]` and `meta[name="color-scheme"]` in `index.html` are flipped by the
  bootstrap script and mirrored live by the effect in `App.tsx`, since Light actually needs the UA
  to render scrollbars/form controls light rather than dark.
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
- **The accent sits outside the four suit hues** so "selected" is not misread as a suit, but it
  is a near miss in both themes: Party's accent pink and its heart rose are neighbours, and
  Light's accent violet and its spade indigo are too. Selection leans on the ring, the inset
  stroke and the lift as much as on hue in both cases; keep all three if you touch
  `.pile--selected .card`.
- Accessibility is partial and known-incomplete: `aria-label`/`aria-pressed` are used
  throughout, but the `HowToPlay` overlay declares `aria-modal` without implementing focus
  trapping or Escape, and scoring is not announced to assistive tech. See BACKLOG PP-3 through
  PP-5 before "fixing" these piecemeal.
- Motion respects `prefers-reduced-motion` by zeroing durations rather than removing animations,
  so fill modes still land and elements don't get stranded mid-transition.

## Testing conventions

Tests are colocated with the module (`src/game/foo.test.ts`) and cover `game/` and `net/`.
`storage.ts` is covered by `storage.test.ts` against a `Map`-backed `localStorage` stub
(round-trip, rejection paths, migrations, and the private-mode throw paths). `net/scores.test.ts`
stubs `fetch` and `localStorage` the same way — it pins the request shape (notably that no date
is ever sent) and, mostly, that **every** failure mode resolves to `null` rather than throwing,
since that is the property keeping the results sheet renderable offline. No test in the suite
makes a real network call; keep it that way. These `game/`/`net/` tests are plain vitest with no
DOM environment, which is only possible because `game/` is pure; keep it that way.
`evaluator.reference.test.ts` is a property-style oracle test rather than an example test — it
exists specifically to guard the wild-resolution shortcut, so it should be kept passing rather
than trimmed for speed.

`vite.config.ts`'s `test.environment` defaults to `node` for exactly that reason — the pure suite
above stays fast and DOM-free. Component and `App.tsx` specs opt into `jsdom` per file via a
`// @vitest-environment jsdom` docblock at the top of the file instead, so only they pay for a
DOM. `src/test/setup.ts` is the shared setup file: it's a no-op under `node` (everything in it is
guarded behind `typeof window !== 'undefined'`) and under `jsdom` it registers
`@testing-library/jest-dom`'s matchers, polyfills `matchMedia`/`requestAnimationFrame` (jsdom has
neither, and `Header`'s theme bootstrap and score count-up both need them to exist), and runs
`cleanup()` plus a `localStorage` clear after every test. `App.test.tsx` and
`src/components/*.test.tsx` (`HandBar`, `HowToPlay`, `ErrorBoundary`) are this layer — this was
BACKLOG PP-15; App-level wiring (hold-slot arming both tap orders, the toast/announcement
lifecycle, the confirm-guarded restart and give-up, the `complete` → `Results` transition, and
that StrictMode's double-invoke doesn't double-record a play or double-submit a score) and the
PP-3 dialog contract (focus-in, Tab trap, Escape, `inert` toggle, focus restoration) both now have
regression coverage rather than resting on the one-time manual verification recorded in
`BACKLOG.md`. `net/scores`'s `submitRun` is mocked in `App.test.tsx` for the same reason as
above — no test may make a real network call.

## Deployment

Pushes to `main` build and publish to GitHub Pages via `.github/workflows/deploy.yml` (runs
`npm ci`, `npm test`, then `npm run build` before deploying). Pull requests run the same
three steps via `.github/workflows/ci.yml` (no deploy step), so a broken PR fails its check
rather than merging silently. The site serves from `https://andrewpapin.github.io/Poker-Piles/`, which
is why `vite.config.ts` sets `base: '/Poker-Piles/'` — GitHub Pages paths are case-sensitive and
must match the repo name exactly. For the same reason the manifest and icon are referenced with
relative paths in `index.html`, and the favicon is an inline data URI (no path to get wrong).
Both workflows, plus `.github/workflows/codeql.yml`, pin every `uses:` step to a full commit SHA
with the version in a trailing comment rather than a mutable tag (BACKLOG PP-12); the SHA is
resolved from the action's own tags, not assumed. `.github/dependabot.yml` watches `npm` and
`github-actions` weekly and will open the PRs that keep those pins current (BACKLOG PP-17).

`index.html` also carries a `Content-Security-Policy` meta tag — the only lever GitHub Pages
allows, since it serves static files with no response headers to set (BACKLOG PP-11). Most
directives are locked to `'self'`; `style-src` needs `'unsafe-inline'` for `HandBar`'s inline
`style` prop, and `script-src` allow-lists the theme-bootstrap script in `index.html`'s `<head>`
by exact SHA-256 hash instead. If that inline script's text ever changes, its hash in the CSP
`content` attribute has to change with it, or the script silently stops running (harmless —
`App.tsx`'s own theme bootstrap still takes over on mount — but worth knowing before debugging a
"theme flashes on load" report).

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
