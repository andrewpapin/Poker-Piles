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

**Suggested first three (done):** PP-13 (CI on pull requests), PP-1, and PP-2 (bundled with
PP-7) have been fixed — see **Resolved** below.

**Also resolved:** PP-3, PP-4 and PP-5 — the full P1 accessibility list (the rules-sheet dialog
contract, hand-result announcements, spent-pile visibility) — see **Resolved** below.

---

## Resolved

### PP-13 · CI never runs on pull requests

Added `.github/workflows/ci.yml`, triggered on `pull_request` against `main`, running
`npm ci`, `npm test`, `npm run build`. `deploy.yml` is untouched and still tests before
deploying, so main keeps a second safety net.

**Value.** Catches a broken change before it reaches the live site, rather than after players
are already looking at it.

### PP-1 · Refreshing the results screen inflates the play count

`GameState` gained a persisted `recorded: boolean` field (`src/game/reducer.ts`), set via a
new `markRecorded` action once the completion effect in `App.tsx` has called `recordRun`.
Because it's part of the saved state rather than an in-memory ref, a reload of a completed
run no longer re-triggers `recordRun`. The in-memory `recordedRef` check stays alongside it
as a same-session short-circuit. `loadGame` defaults `recorded` to `false` for saves that
predate this field. Covered by `src/game/storage.test.ts` and a `markRecorded` case in
`reducer.test.ts`.

**Value.** Your stats stay honest — reloading the results page after finishing a run no
longer secretly counts as an extra game played.

### PP-2 · A malformed saved game bricks the app with no recovery path

`loadGame` (`src/game/storage.ts`) now validates every field, not just top-level shape: card
identity and rank/suit ranges inside every pile and hold slot, `selected` entries against
the current `piles`/`held` bounds, hand results against `CATEGORY_POINTS`, and `status`
against the known enum. Any failure discards the save (`null`) instead of handing the
reducer/evaluator a shape that throws. `src/main.tsx` also wraps `<App/>` in a new
`src/ErrorBoundary.tsx`, whose fallback offers a "Start a fresh deal" button that clears the
save and reloads — a backstop for whatever the deep validation doesn't anticipate. Covered
by `src/game/storage.test.ts`.

**Value.** If your saved game ever gets corrupted (a browser quirk, an interrupted save),
you get a "start a fresh deal" button instead of a blank, broken page with no way out short
of manually clearing site data.

### PP-7 · `selectedCards`'s type guard is unsound

Fixed as part of PP-2: `src/game/reducer.ts`'s `selectedCards` now filters with
`c != null` instead of `c !== null`, so a stray `undefined` held-slot entry can no longer
slip through and reach the evaluator.

**Value.** Closes off a rare crash-in-waiting where an empty hold slot could confuse the
scoring engine and hand you a wrong result for a hand you played.

### PP-3 · The rules sheet claims `aria-modal` but implements none of the contract

`HowToPlay` (`src/components/HowToPlay.tsx`) now moves focus into the sheet on mount, traps
Tab within its focusable elements, closes on Escape, and restores focus to whatever opened it
on unmount. The trap and the `inert` toggle below live in the *same* effect cleanup rather than
two effects on separate components — an element can't take focus while still marked `inert`,
and effect-cleanup ordering across a parent/child boundary isn't something to lean on for that
sequencing. `App.tsx` passes a `backgroundRef` (a new `appContentRef` wrapping everything except
the overlay, via a `display: contents` `.app-content` div so it doesn't disturb `.app`'s grid)
that `HowToPlay` marks `inert` for as long as it's mounted, so the claim in `aria-modal="true"`
is now actually true — verified with a scripted Chromium session exercising focus-on-open,
Tab-trapping, Escape-to-close, `inert` toggling, and focus restoration on close.

**Value.** Screen-reader and keyboard-only players can actually use the "How to play" sheet
— tab through it, close it with Escape, and not get trapped behind it or lose their place
on the board underneath.

### PP-4 · Playing a hand is never announced

`App.tsx` now renders a visually-hidden (`.sr-only`) `role="status" aria-live="polite"` region
alongside the existing (still `aria-hidden`) toast, textually echoing the same content each time
a hand is played — e.g. "Two Pair, 10 points — total 85". The visible toast is unchanged.

**Value.** Screen-reader players hear what hand they just played and how many points it
scored, instead of silence after every move — previously the only feedback was a toast they
couldn't perceive.

### PP-5 · Spent piles are hidden from assistive tech

The force-emptied pile branch in `src/components/Pile.tsx` no longer sets `aria-hidden="true"`
on the whole pile; the decorative ghost card and the count label keep it, and the pile itself
now carries a `.sr-only` text node ("Pile 3, empty") so which piles ran dry stays legible to
assistive tech. Note for future work: this branch (a pile emptied by `giveUp` that never grew an
extra hold slot) is currently unreachable in the shipped UI — `giveUp` always completes the run
in the same reducer step, and the finished screen replaces the whole play area with `Results`
rather than continuing to render `Board`. Fixed anyway since it's the correct markup regardless
and costs nothing; flagged here rather than deleting the branch, which is out of scope for this
pass.

**Value.** Screen-reader players are told which piles ran dry, instead of the board going
silently blank where a pile used to be.

---

## P0 — Correctness bugs

None open.

---

## P1 — Accessibility

None open — see PP-3, PP-4, PP-5 under **Resolved**.

---

## P2 — Robustness

### PP-6 · No UTC rollover handling in an open tab — M

**Evidence.** `dateKey` is captured once at bootstrap (`src/App.tsx:32`) and never revisited.

**Why it matters.** A tab left open across midnight UTC keeps playing yesterday's puzzle
under yesterday's header date, and files the result under the old day via `recordRun`.
Meanwhile the "Restart" button calls `todayKey()` fresh (`src/App.tsx:81`), so it silently
swaps in a completely different deal — the same button does two different things depending
on the clock. Mobile users background tabs for days; this is not an edge case.

**Value.** If you leave the tab open past midnight UTC, you can keep playing "today's"
puzzle without realizing it's actually yesterday's, and your finished run could get filed
under the wrong day. A rollover prompt keeps "today's puzzle" meaning the same thing to you
as it does to everyone else playing the shared daily deal.

**Fix sketch.** Poll `todayKey()` on `visibilitychange` (and on a low-frequency interval);
when it differs from `state.dateKey`, surface a "new puzzle available" prompt rather than
yanking the board mid-run.

### PP-8 · Storage schema has no version discriminator — S

**Evidence.** `src/game/storage.ts:10-12` pins `:v1:` into the key names, but the hold-slots
feature changed `GameState` without bumping it — handled instead by an inline migration
(`src/game/storage.ts:113-116`) that infers "old save" from a missing `held` field and a
`selected` array of raw numbers.

**Why it matters.** Shape-sniffing works once. It doesn't compose: the second and third
migrations have to distinguish schema versions from each other, not just from "current".

**Value.** Makes future updates to the saved-game format safe to ship — protects your
in-progress game from ever loading in a broken, half-migrated state the next time the app
changes.

**Fix sketch.** Store an explicit `version` field inside the payload, migrate known older
versions, discard anything unrecognised. Pairs naturally with PP-2's deep validation.

### PP-9 · Evaluator memo cache never evicts — S

**Evidence.** `src/game/evaluator.ts:157` is a module-level `Map` with no bound, shared
across `newGame`.

**Why it matters.** Bounded in practice by the number of distinct hands a session actually
plays, so this is a note rather than a leak — recorded so it isn't re-discovered. It only
becomes real if the evaluator is ever driven by a solver or a batch analysis.

**Value.** No effect on normal play — a session never evaluates enough distinct hands to
notice. Recorded so a future contributor doesn't waste time "discovering" and re-flagging
the same non-issue.

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

**Value.** No effect on players — the site you actually visit is unaffected either way. Only
protects a developer's own machine while they're running the dev server locally.

**Fix sketch.** Fold into a single dependency-refresh pass — Vite 5 → 7, Vitest 2 → 3,
React 18 → 19 — each with its own migration notes, done deliberately rather than in one
sweep. Run `npm audit` afterwards and record the result.

### PP-11 · No Content-Security-Policy — S

**Evidence.** `index.html` sets no CSP, and GitHub Pages cannot set response headers, so a
`<meta http-equiv="Content-Security-Policy">` is the only available lever.

**Why it matters.** Low value today given there is no dynamic content — but it is nearly
free and forecloses a whole class of future mistakes.

**Value.** An almost-free safety net: if a future change ever accidentally introduced a way
to inject a script, the browser would simply refuse to run it instead of it becoming a real
vulnerability for players.

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

**Value.** Stops a compromised or unexpectedly-changed GitHub Action from silently running
during deployment — protects the pipeline that publishes the game, not the game itself.

**Fix sketch.** Pin to full commit SHAs with the version in a trailing comment, and let
Dependabot (PP-17) keep them current.

---

## P2 — Testing and CI

### PP-14 · `storage.ts` has zero tests — M

**Status: partially done.** `src/game/storage.test.ts` now exists, covering round-trip
save/load, rejection of a stale `dateKey`, rejection of the malformed shapes deep validation
now catches (bad card, out-of-range `selected` index, tampered hand score, unknown
`status`, negative `total`), the numeric-`selected` migration, the `recorded` migration, the
`setItem`/`getItem`-throws private-mode paths, and `recordRun` accumulating `plays` and
`bestScore` across calls. What CLAUDE.md's untested-module note originally flagged is
closed; PP-15's broader App-level integration coverage is still open.

**Value.** Gives confidence that a future code change can't quietly corrupt your saved game
or your stats without a test catching it first.

### PP-15 · No component or integration tests — L

**Evidence.** No jsdom environment is configured (`vite.config.ts` has no `test` block) and
`@testing-library/react` is not a dependency.

**Why it matters.** The reducer is thoroughly covered, but nothing verifies the wiring in
`App.tsx` — hold-slot arming in both tap orders, the toast lifecycle and its timer cleanup,
the `complete` → `Results` transition, the confirm-guarded restart. That wiring is where the
recent features actually live.

**Value.** Catches regressions in the actual on-screen experience — holding a card, seeing
the results page, restarting a run — the kind of bug you'd only notice by clicking around,
before it ever reaches a player.

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

**Value.** Catches whole classes of accessibility and React bugs — the exact kind PP-3
through PP-5 were — automatically on every change, instead of relying on another manual
audit to rediscover them.

**Fix sketch.** ESLint flat config with `typescript-eslint`, `react-hooks` and `jsx-a11y`,
wired into the PP-13 CI job and exposed as `npm run lint`.

### PP-17 · No Dependabot or CodeQL — S

**Evidence.** `.github/` contains only `workflows/deploy.yml`.

**Value.** Surfaces known security vulnerabilities in dependencies and simple code-scanning
findings automatically, instead of only finding them the next time someone happens to run a
manual audit.

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

**Value.** Lets you add Poker Piles to your phone's home screen with an actual icon instead
of a screenshot, and eventually open it with no signal — useful for a game meant to be a
daily habit.

### PP-19 · No `og:image` — S

`index.html:29-42` sets Open Graph and Twitter card text but no image, so shared links render
as bare text. Sharing is the app's growth mechanic (`share.ts` exists precisely to be pasted
into a chat), which makes the missing preview image disproportionately costly. Add a static
1200×630 card and reference it with an absolute URL.

**Value.** When you share your result link in a chat, it shows an inviting preview image
instead of bare text — sharing is how the game spreads, and a bare-text link is easy to
scroll past.

### PP-20 · Webfont isn't preloaded — S

`styles.css:8-14` declares `@font-face` with `font-display: swap`, and the font is only
discovered after the CSS parses — guaranteeing a flash of fallback text on first paint. Add
`<link rel="preload" as="font" type="font/woff2" crossorigin>` for
`src/fonts/outfit-latin.woff2` (via the Vite-emitted hashed URL).

**Value.** The title and card text no longer flash from a fallback font to the real one on
first load — a small but visible polish on the very first impression of the page.

### PP-21 · Every selection toggle rewrites the whole board to localStorage — S

`src/App.tsx:47-49` runs `saveGame(state)` on every state change, serializing all 56 cards
just to record that a card was tapped. Negligible in absolute terms; avoidable by persisting
on meaningful transitions (submit, hold, finish, new game) or debouncing the effect.

**Value.** Not noticeable to players today; avoids doing pointless work on every single tap
so the game stays snappy if it's ever run on a slower or older device.

### PP-22 · No LICENSE file — S

The repo is public with no license, which by default means no one may use, copy or modify it.
Add one if that isn't the intent.

**Value.** Makes clear to anyone who finds this on GitHub what they're actually allowed to do
with the code — right now, by default copyright law, the honest answer is nothing.

### PP-23 · `CLAUDE.md` has drifted from the code — S

Three concrete mismatches, in the file whose entire job is steering future work:

- It describes `share.ts` as producing "a block grid of per-hand tiers"; `buildShareText`
  (`src/game/share.ts:18-22`) emits only a title line, a score line and the URL. The tier
  grid is gone.
- The hold-slot mechanic and `HOLD_SLOT_COUNT` are absent from both the architecture table
  and the invariants section, despite being central to play.
- The documented `GameAction` surface lists four variants (`toggle`, `clear`, `submit`,
  `newGame`); there are now seven — `toggleHeld`, `hold` and `finishGame` are missing.

**Value.** Keeps the steering document that future work (including Claude's own sessions)
relies on accurate, so the next change is guided by what the code actually does instead of
stale claims — a wrong doc here costs everyone who reads it next, not just whoever wrote it.

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
  the "same deal for everyone, derived from the date" design. Anonymous score collection
  does not change the call: the average is a shared curiosity, not a leaderboard, and no
  score is server-verified. Revisit only if scores ever become genuinely competitive.
- **Still no accounts and no sync.** The one server dependency is anonymous score
  collection (see CLAUDE.md's "Score collection"): a completed run posts its score so the
  results sheet can show the day's average. Consequences accepted and unchanged — local
  stats are still per-device, nothing survives clearing site data, and the game plays
  fully offline. The privacy surface stays deliberately tiny: what leaves the browser is
  a score, a hand count, a gave-up flag and a random id that identifies nobody.
- **Score submission is not tamper-proof, knowingly.** The server stamps the date, bounds
  the score and keeps one row per browser per day, which is enough for an honest average.
  Someone clearing site data to submit repeatedly can still skew it. Building anti-cheat
  for a puzzle with no leaderboard would cost more than it protects.
- **`finishGame` plays each remaining card as its own single-card hand**
  (`src/game/reducer.ts:163-191`), which is deliberately not score-maximising. It is an
  escape hatch, not an autoplayer.
