# Poker Piles — Backlog

Derived from a full audit (code review, security check, best practices) on 2026-08-05,
covering every file under `src/`, plus `index.html`, `styles.css`, `vite.config.ts`, the
tsconfigs, `public/manifest.webmanifest`, `.github/workflows/deploy.yml`, the test suite
and `package-lock.json`.

**Headline.** This is a well-built small app. The game logic is genuinely pure and well
tested — 70 tests across rng, deck, evaluator, reducer and share, all green, including a
reference test that validates the wild-suit-reduction shortcut against an unrestricted
52-identity search. There is no XSS surface, no network I/O, no secrets and no tracking. The real work
is concentrated in three places:

1. **The persistence layer** — the only untested module, and the one that can brick the app.
2. **Accessibility** — the two modals declare `aria-modal` without implementing any of the
   contract, and scoring is never announced.
3. **Process** — pull requests currently merge with zero automated checks.

Items are numbered `PP-n` and the numbers are stable: reference them in commit messages
and PR titles. Sizes are rough: **S** ≈ under an hour, **M** ≈ half a day, **L** ≈ more.

**Suggested first three:** PP-13 (CI on pull requests), then PP-1, then PP-2. PP-13 goes
first because it protects every fix that follows it.

---

## P0 — Correctness bugs

Both are confirmed by reading the code path, not inferred.

### PP-1 · Refreshing the results screen inflates the play count — S

Finishing a run and reloading the page records the run again, once per reload.

**Evidence.** `src/App.tsx:51-56` records a completed run, guarded only by
`recordedRef.current === state` — an in-memory object-identity check. `saveGame` persists
the completed state (`src/App.tsx:47-49`), so `bootstrap()` (`src/App.tsx:31-35`)
rehydrates a `status: 'complete'` state on the next load with a fresh, empty ref. The
guard cannot fire, and `recordRun` increments `plays` again (`src/game/storage.ts:55-65`).

**Why it matters.** `plays` is user-visible: `Results.tsx:40` gates the "· best today N"
line on `stats.plays > 1`, so a single run plus one refresh makes the app claim a second
play that never happened. `bestScore` survives (it's a `Math.max` of the same value), so
the damage is confined to the counter and the line it drives — but it is wrong, and it is
wrong on the most ordinary user action there is.

**Fix sketch.** Move the guard out of memory and into the persisted state: add a
`recorded: boolean` to `GameState` (set in the `submit`/`finishGame` reducer branches or
by the recording effect), and skip `recordRun` when it is already set. Keep the in-memory
ref as a cheap short-circuit. Covered naturally by the PP-14 storage tests.

### PP-2 · A malformed saved game bricks the app with no recovery path — M

A saved game that doesn't match the current shape throws on load, white-screens the app,
and is reloaded on every subsequent visit — so the game stays dead until the user manually
clears site data.

**Evidence.** `loadGame` (`src/game/storage.ts:98-118`) validates only the top level:
array-ness of `piles`/`hands`/`selected`, `piles.length === PILE_COUNT`, and
`typeof total === 'number'`. It never bounds-checks the indices inside `selected`, never
validates the card objects inside piles, and never checks `status`. Two concrete throws:

- An out-of-range **pile** index reaches `topCard(state.piles[i])` with `pile === undefined`
  → `pile.length` throws (`src/game/deck.ts:44-46`, via `selectedCards`,
  `src/game/reducer.ts:46-50`).
- An out-of-range **held** index is worse. `state.held[i]` is `undefined`, and the guard
  `.filter((c): c is Card => c !== null)` (`src/game/reducer.ts:49`) passes `undefined`
  straight through — it only excludes `null`. `evaluateHand` then throws on `card.kind`
  (`src/game/evaluator.ts:85-87`).

Compounding it: `src/main.tsx` renders `<App/>` with no error boundary, so any throw during
render is a blank page with no message and no reset control.

**Why it matters.** No in-app path produces such a state today — the exposure is tampering,
a partially-written save, or, far more likely, **any future change to the shape of
`GameState`**. The hold-slots feature already changed that shape once and needed a hand-
written migration (`src/game/storage.ts:113-116`) to avoid exactly this. The next such
change ships a permanent white screen to every returning player, and the failure is
self-perpetuating across reloads.

**Fix sketch.** Two independent layers, both worth having:

1. Validate `loadGame` deeply — card objects, `status`, and every `selected` index against
   `piles.length` / `HOLD_SLOT_COUNT` — and return `null` (discard the save) on any failure.
   Discarding a save is always recoverable; crashing is not.
2. Add an error boundary in `src/main.tsx` whose fallback calls `clearGame()` and offers a
   "start a fresh deal" button, so even an unanticipated throw is one tap from recovery.

Fix `reducer.ts:49`'s unsound predicate as part of this (see PP-7).

---

## P1 — Accessibility

### PP-3 · Modals claim `aria-modal` but implement none of the contract — M

**Evidence.** `src/components/HowToPlay.tsx:8` and `src/components/Results.tsx:34` both set
`role="dialog" aria-modal="true"`. Neither moves focus into the dialog on open, traps focus
inside it, closes on Escape, restores focus to the trigger on close, or marks the board
behind as `inert`. A grep for `onKeyDown`, `Escape` or `autoFocus` across `src/` returns
nothing.

**Why it matters.** `aria-modal="true"` tells assistive tech that everything outside is
unavailable — while the DOM says otherwise. Keyboard users tab straight out of the overlay
into the board underneath and interact with a game they can't see. The how-to-play sheet
opens automatically on a first visit, so this is the first thing a keyboard user meets.

**Fix sketch.** One small `useModal` hook shared by both sheets: focus the sheet on mount,
cycle Tab within it, close on Escape, restore focus on unmount, and set `inert` on `.app`
while open. `HowToPlay` closes via `onClose`; `Results` has no dismiss action today, so
decide whether Escape should close it at all or only trap focus.

### PP-4 · Playing a hand is never announced — S

**Evidence.** No `aria-live` region exists anywhere in `src/` (verified by grep). The
hand-result toast is explicitly `aria-hidden="true"` (`src/App.tsx:159`), and the running
score is an `aria-label` on a non-interactive `<span>` (`src/components/Header.tsx:128`) —
inconsistently supported by AT on a span with no role, and announcing nothing on change
regardless.

**Why it matters.** A screen reader user plays a hand and receives no feedback about what it
was or what it scored. That is the game's entire feedback loop.

**Fix sketch.** A visually-hidden `aria-live="polite"` region that announces the last hand
("Two Pair, 10 points — total 85") when `state.hands` grows. The toast can stay
`aria-hidden`; the live region carries the same content textually.

### PP-5 · Spent piles are hidden from assistive tech — S

**Evidence.** A drained pile renders with `aria-hidden="true"` on the whole element
(`src/components/Pile.tsx:40`).

**Why it matters.** Which piles have run dry is the core strategic signal — it drives
whether a full five-card hand is still reachable. Hiding it entirely removes that
information non-visually, and the count of live piles is exactly what the HandBar note
communicates to sighted players.

**Fix sketch.** Keep the decorative card ghost `aria-hidden`, but expose the pile itself as
a disabled control or a plain text node: "Pile 3, empty".

---

## P2 — Robustness

### PP-6 · No UTC rollover handling in an open tab — M

**Evidence.** `dateKey` is captured once at bootstrap (`src/App.tsx:32`) and never revisited.

**Why it matters.** A tab left open across midnight UTC keeps playing yesterday's puzzle
under yesterday's header date, and files the result under the old day via `recordRun`.
Meanwhile the "Restart" button calls `todayKey()` fresh (`src/App.tsx:81`), so it silently
swaps in a completely different deal — the same button does two different things depending
on the clock. Mobile users background tabs for days; this is not an edge case.

**Fix sketch.** Poll `todayKey()` on `visibilitychange` (and on a low-frequency interval);
when it differs from `state.dateKey`, surface a "new puzzle available" prompt rather than
yanking the board mid-run.

### PP-7 · `selectedCards`'s type guard is unsound — S

**Evidence.** `src/game/reducer.ts:49` narrows with `(c): c is Card => c !== null`, which
admits `undefined`. The array is typed `Card[]` but can hold `undefined` at runtime.

**Why it matters.** It is the mechanism behind half of PP-2, and it is simply the wrong
predicate — `c != null` is the correct one. Worth fixing independently of PP-2 so the type
system stops lying about this array.

**Fix sketch.** `(c): c is Card => c != null`.

### PP-8 · Storage schema has no version discriminator — S

**Evidence.** `src/game/storage.ts:10-12` pins `:v1:` into the key names, but the hold-slots
feature changed `GameState` without bumping it — handled instead by an inline migration
(`src/game/storage.ts:113-116`) that infers "old save" from a missing `held` field and a
`selected` array of raw numbers.

**Why it matters.** Shape-sniffing works once. It doesn't compose: the second and third
migrations have to distinguish schema versions from each other, not just from "current".

**Fix sketch.** Store an explicit `version` field inside the payload, migrate known older
versions, discard anything unrecognised. Pairs naturally with PP-2's deep validation.

### PP-9 · Evaluator memo cache never evicts — S

**Evidence.** `src/game/evaluator.ts:157` is a module-level `Map` with no bound, shared
across `newGame`.

**Why it matters.** Bounded in practice by the number of distinct hands a session actually
plays, so this is a note rather than a leak — recorded so it isn't re-discovered. It only
becomes real if the evaluator is ever driven by a solver or a batch analysis.

**Fix sketch.** Cap it (simple FIFO eviction past N entries), or leave it and delete this
item deliberately.

---

## P2 — Security

**No vulnerabilities found in the application itself.** No `dangerouslySetInnerHTML`, no
`innerHTML`, no `eval`/`new Function`, no `fetch` or other network I/O, no third-party
scripts, no analytics, no secrets, and no user-supplied text rendered anywhere (all verified
by grep across `src/` and `index.html`). Every byte of data stays on the device. The items
below are hardening, not remediation.

### PP-10 · `esbuild@0.21.5` carries a dev-server advisory — M

**Evidence.** `package-lock.json` resolves `esbuild@0.21.5` via `vite@5.4.21`, which is
affected by GHSA-67mh-4wv8-2f99: the dev server sets permissive CORS, letting any website
the developer visits read responses from a running `npm run dev`.

**Why it matters.** **Development-only, moderate severity** — the flaw is in the dev server
and is absent from the production bundle, so the deployed site is unaffected. It only fixes
forward: esbuild ≥ 0.25 requires Vite 6+.

**Fix sketch.** Fold into a single dependency-refresh pass — Vite 5 → 7, Vitest 2 → 3,
React 18 → 19 — each with its own migration notes, done deliberately rather than in one
sweep. Run `npm audit` afterwards and record the result.

### PP-11 · No Content-Security-Policy — S

**Evidence.** `index.html` sets no CSP, and GitHub Pages cannot set response headers, so a
`<meta http-equiv="Content-Security-Policy">` is the only available lever.

**Why it matters.** Low value today given there is no dynamic content — but it is nearly
free and forecloses a whole class of future mistakes.

**Fix sketch.** A restrictive meta CSP: `default-src 'self'`, `img-src 'self' data:` (the
favicon is a data URI), `style-src 'self'`, `script-src 'self'`. Verify against the built
bundle, not just the dev server, since Vite's dev transform differs.

### PP-12 · Deploy workflow pins actions by major tag — S

**Evidence.** `.github/workflows/deploy.yml:22-43` uses `actions/checkout@v4`,
`actions/setup-node@v4`, `actions/configure-pages@v5`, `actions/upload-pages-artifact@v3`,
`actions/deploy-pages@v4`.

**Why it matters.** A mutable tag means the workflow runs whatever that tag points at today.
The workflow's `permissions` block is already correctly minimized (`contents: read`,
`pages: write`, `id-token: write`), so this is the remaining supply-chain gap.

**Fix sketch.** Pin to full commit SHAs with the version in a trailing comment, and let
Dependabot (PP-18) keep them current.

---

## P2 — Testing and CI

### PP-13 · CI never runs on pull requests — S

**Evidence.** `.github/workflows/deploy.yml:3-6` triggers on `push: [main]` and
`workflow_dispatch` only.

**Why it matters.** Every PR in this repo merges without a single automated check. Tests run
*after* the merge, as part of deploying — so the first signal that main is broken is a
failed deploy. This is the cheapest fix in the backlog and the one that protects all the
others; it belongs first.

**Fix sketch.** Add `pull_request:` to the trigger with a job that runs `npm ci`,
`npm test`, `npm run build`, and gate the Pages steps behind
`if: github.event_name != 'pull_request'`. Or split CI and deploy into two workflows.

### PP-14 · `storage.ts` has zero tests — M

**Evidence.** The test suite covers rng, deck, evaluator, reducer and share. There is no
`storage.test.ts`.

**Why it matters.** It is the only untested module and it holds both P0 bugs. Specifically
untested: `loadGame`'s validation and rejection paths, the legacy-save migration, the
quota/private-mode `catch` blocks, and `recordRun`'s accumulation across calls.

**Fix sketch.** Tests against a fake `localStorage` (a `Map`-backed stub on `globalThis`,
plus one that throws on `setItem` to exercise the Safari-private-mode path). Cover:
round-trip save/load; rejection of a stale `dateKey`; rejection of every malformed shape;
the numeric-`selected` migration; and `recordRun` incrementing `plays` exactly once per
completed run (which is the regression test for PP-1).

### PP-15 · No component or integration tests — L

**Evidence.** No jsdom environment is configured (`vite.config.ts` has no `test` block) and
`@testing-library/react` is not a dependency.

**Why it matters.** The reducer is thoroughly covered, but nothing verifies the wiring in
`App.tsx` — hold-slot arming in both tap orders, the toast lifecycle and its timer cleanup,
the `complete` → `Results` transition, the confirm-guarded restart. That wiring is where the
recent features actually live.

**Fix sketch.** Add `jsdom` + `@testing-library/react` and a `test: { environment: 'jsdom' }`
block in `vite.config.ts`, then cover the handful of App-level flows above. Keep the pure
game tests in the default environment so they stay fast.

### PP-16 · No linter — M

**Evidence.** No ESLint config; `CLAUDE.md` states `npm run build` is the source of truth for
correctness.

**Why it matters.** `tsc` is not a linter. It won't catch `react-hooks/exhaustive-deps`
violations, and `eslint-plugin-jsx-a11y` would have flagged PP-3 through PP-5 automatically —
which is the argument for adding it: these classes of bug recur, and a linter catches them
for free on every future change.

**Fix sketch.** ESLint flat config with `typescript-eslint`, `react-hooks` and `jsx-a11y`,
wired into the PP-13 CI job and exposed as `npm run lint`.

### PP-17 · No Dependabot or CodeQL — S

**Evidence.** `.github/` contains only `workflows/deploy.yml`.

**Fix sketch.** `.github/dependabot.yml` for `npm` and `github-actions` (weekly), and
GitHub's default CodeQL setup for JavaScript/TypeScript.

---

## P3 — Polish, PWA, hygiene

### PP-18 · PWA is incomplete — M

`public/manifest.webmanifest` ships one SVG icon marked `"purpose": "any maskable"`, with no
PNG 192/512 fallbacks and no `apple-touch-icon` link in `index.html` — so an iOS home-screen
add falls back to a page screenshot. There is no service worker either, so a game whose logic
is entirely client-side still cannot be played offline. Add PNG icons, an `apple-touch-icon`,
and consider a minimal precaching service worker (the whole bundle is small enough to cache
outright).

### PP-19 · No `og:image` — S

`index.html:29-42` sets Open Graph and Twitter card text but no image, so shared links render
as bare text. Sharing is the app's growth mechanic (`share.ts` exists precisely to be pasted
into a chat), which makes the missing preview image disproportionately costly. Add a static
1200×630 card and reference it with an absolute URL.

### PP-20 · Webfont isn't preloaded — S

`styles.css:8-14` declares `@font-face` with `font-display: swap`, and the font is only
discovered after the CSS parses — guaranteeing a flash of fallback text on first paint. Add
`<link rel="preload" as="font" type="font/woff2" crossorigin>` for
`src/fonts/outfit-latin.woff2` (via the Vite-emitted hashed URL).

### PP-21 · Every selection toggle rewrites the whole board to localStorage — S

`src/App.tsx:47-49` runs `saveGame(state)` on every state change, serializing all 56 cards
just to record that a card was tapped. Negligible in absolute terms; avoidable by persisting
on meaningful transitions (submit, hold, finish, new game) or debouncing the effect.

### PP-22 · No LICENSE file — S

The repo is public with no license, which by default means no one may use, copy or modify it.
Add one if that isn't the intent.

### PP-23 · `CLAUDE.md` has drifted from the code — S

Three concrete mismatches, in the file whose entire job is steering future work:

- It describes `share.ts` as producing "a block grid of per-hand tiers"; `buildShareText`
  (`src/game/share.ts:18-22`) emits only a title line, a score line and the URL. The tier
  grid is gone.
- The hold-slot mechanic and `HOLD_SLOT_COUNT` are absent from both the architecture table
  and the invariants section, despite being central to play.
- The documented `GameAction` surface lists four variants (`toggle`, `clear`, `submit`,
  `newGame`); there are now seven — `toggleHeld`, `hold` and `finishGame` are missing.

---

## Verified sound — do not re-audit

Checked closely and found correct. Recorded so future passes don't re-litigate settled ground:

- **"At most one card per pile" holds by construction** — only a pile's top card is ever
  selectable, so the reducer correctly does not enforce it separately.
- **Wild resolution is correct**, including the suit-restriction shortcut (a flush must land
  in a suit some natural card already holds), which `evaluator.reference.test.ts` validates
  against an unrestricted 52-identity search. The worst-case search is ~1,820 combinations —
  no performance concern.
- **The wheel (A-2-3-4-5) is handled**, and royal flushes are correctly discriminated from
  straight flushes by low card.
- **The shuffle is unbiased** (textbook Fisher-Yates) and `dealPiles` is verified to be an
  exact permutation of the deck — nothing lost or duplicated.
- **The evaluator's memo key is collision-free**: wilds collapse to a token, naturals to
  rank+suit, sorted and joined, with hand size implicit in the segment count.
- **Hold-slot edge cases are handled and tested**, including the one that matters — the game
  stays live when every pile is empty but a hold slot is still occupied.
- **CSS is in good shape**: dark mode, `prefers-reduced-motion` (zeroing durations rather
  than killing animations, so fill modes still land), and `:focus-visible` rings on every
  interactive element.
- **The deploy workflow's permissions are correctly minimized**, and concurrency is set to
  let an in-flight deploy finish rather than cancelling mid-publish.

---

## Deliberate non-goals

Recorded as decisions, not debt:

- **The daily seed is trivially predictable.** `xmur3(dateKey)` (`src/game/rng.ts:36-38`)
  means anyone can compute any day's deal in advance, past or future. This is inherent to
  the "same deal for everyone, derived from the date, no backend" design and is harmless
  with no leaderboard. It would need revisiting only if scores ever became competitive or
  server-verified.
- **No backend, no accounts, no sync.** Consequences accepted: stats are per-device, and
  nothing survives clearing site data. This is also why the app has no privacy surface at
  all — a genuine strength worth preserving.
- **`finishGame` plays each remaining card as its own single-card hand**
  (`src/game/reducer.ts:163-191`), which is deliberately not score-maximising. It is an
  escape hatch, not an autoplayer.
