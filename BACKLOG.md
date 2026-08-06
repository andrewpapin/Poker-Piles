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
contract, hand-result announcements, spent-pile visibility) — PP-15, the component/
integration test layer — PP-6, the UTC rollover prompt — and PP-8, PP-9, PP-11, PP-12, PP-17,
PP-20, PP-21, PP-22 and PP-23 — see **Resolved** below.

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

### PP-15 · No component or integration tests

`vite.config.ts` now carries a `test` block: `environment: 'node'` by default (so the pure
`game/`/`net/` suite stays DOM-free and fast) with `setupFiles: ['./src/test/setup.ts']`.
Component and `App.tsx` specs opt into `jsdom` per file via a `// @vitest-environment jsdom`
docblock — `src/App.test.tsx`, `src/ErrorBoundary.test.tsx`, `src/components/HandBar.test.tsx`
and `src/components/HowToPlay.test.tsx`, 21 tests in total. `src/test/setup.ts` registers
`@testing-library/jest-dom`'s matchers, polyfills `matchMedia`/`requestAnimationFrame` (absent
from jsdom; `Header`'s theme bootstrap and score count-up both need them), and runs
`cleanup()` plus a `localStorage` clear after every test — guarded behind `typeof window !==
'undefined'` so it's a no-op for the `node`-environment files.

Covered: hold-slot arming in both tap orders (card-then-slot and slot-then-card), the toast +
`aria-live` announcement lifecycle including its 1100ms auto-dismiss, the confirm-guarded
restart (and that a fresh game with no progress never prompts) and give-up, the `complete` →
`Results` transition with `net/scores`'s `submitRun` mocked (no test may make a real network
call), the theme toggle persisting to `localStorage`, and — the specific concern the `recordedRef`
/ `submittedRef` guards in `App.tsx` exist for — that mounting under `StrictMode` does not
double-record a play or double-submit a score. `HowToPlay.test.tsx` separately regression-tests
the PP-3 dialog contract (focus-in on open, Tab trapped in the sheet, Escape closes, background
`inert` while mounted and un-inert with focus restored on close), which had only been checked
once by hand. `HandBar.test.tsx` pins that its live preview (the one component allowed to call
`evaluateHand` directly) never drifts from what the evaluator itself returns.

**Value.** Catches regressions in the actual on-screen experience — holding a card, seeing
the results page, restarting a run — the kind of bug you'd only notice by clicking around,
before it ever reaches a player. It also turns two things that were previously verified once by
hand (the PP-3 dialog contract, the StrictMode double-invoke guards) into something CI checks
on every change.

### PP-8 · Storage schema has no version discriminator

`src/game/storage.ts` now writes an explicit `version` field into the `GAME_KEY` payload
(`GAME_VERSION`, currently `1`), independent of the `v2` key prefix — which versions when a
*score* stops being comparable, not when the save's *shape* changes. `loadGame` discards a
save whose `version` doesn't match (a future build's shape this one doesn't know how to read)
rather than guessing; a save with no `version` field predates the discriminator and still runs
through the existing shape-sniffing migrations (numeric `selected`, missing `held`/
`pileHoldIndex`/`recorded`). Covered by the existing round-trip test in `storage.test.ts`,
which pins that a fresh save still loads back byte-for-byte.

**Value.** The next time the saved-game shape changes, an old save either migrates cleanly or
is discarded outright — it can no longer reach the reducer half-shaped from a future version
this build has never seen.

### PP-9 · Evaluator memo cache never evicts

`src/game/evaluator.ts`'s module-level cache is now bounded (`CACHE_LIMIT = 5000`) with simple
FIFO eviction — `Map` preserves insertion order, so the oldest entry is dropped once the cache
grows past the limit. A normal session never gets close to it; this only matters if the
evaluator is ever driven by a solver or batch analysis.

**Value.** Closes off the only unbounded-growth path in the game logic, at no cost to normal
play — a session's actual hand count stays far under the cap.

### PP-11 · No Content-Security-Policy

`index.html` now sets a restrictive `<meta http-equiv="Content-Security-Policy">` (the only
lever available — GitHub Pages serves static files with no response headers to set):
`default-src 'self'`, `img-src 'self' data:` (the favicon and manifest icon are inline data
URIs), `connect-src 'self' https://*.supabase.co` (score collection), `base-uri 'none'`,
`form-action 'none'`. Two directives needed a closer look rather than the plain `'self'` the
original fix sketch proposed: `style-src` carries `'unsafe-inline'` because `HandBar`'s tier
meter sets a CSS custom property via React's `style` prop, and `script-src` allow-lists the
inline theme-bootstrap script in `index.html` by exact SHA-256 hash rather than reaching for
`'unsafe-inline'` there too. Verified against the actual built bundle (not the dev server) with
a scripted headless-Chromium session listening for `securitypolicyviolation` events while
exercising pile selection, the How to play sheet and the theme toggle — zero violations.

**Value.** If a future change ever accidentally introduced a way to inject a script, the
browser now simply refuses to run it instead of it becoming a real vulnerability for players.

### PP-12 · Deploy workflow pins actions by major tag

Every `uses:` step in `.github/workflows/deploy.yml` and `.github/workflows/ci.yml` is now
pinned to a full commit SHA within its current major version, with the version in a trailing
comment (e.g. `actions/checkout@11d5960a326750d5838078e36cf38b85af677262 # v4.4.0`) — resolved
directly from each action's tags rather than assumed. Dependabot (PP-17) will keep these
current, opening a PR that bumps both the SHA and the comment.

**Value.** A compromised or unexpectedly-changed GitHub Action can no longer silently run
during deployment just because it still answers to the same version tag.

### PP-17 · No Dependabot or CodeQL

`.github/dependabot.yml` now watches both `npm` and `github-actions` weekly. A new
`.github/workflows/codeql.yml` runs GitHub's default CodeQL analysis for
`javascript-typescript` on push to `main`, on every pull request, and weekly on a schedule (to
catch newly-published advisories against code that hasn't changed) — its own `actions/checkout`
and `github/codeql-action/*` steps are SHA-pinned the same way as PP-12.

**Value.** Known vulnerabilities in a dependency, or a simple code-scanning finding, now
surface automatically on a weekly cadence instead of only at the next manual audit.

### PP-20 · Webfont isn't preloaded

`index.html` now carries a `<link rel="preload" as="font" type="font/woff2" crossorigin>`
pointing at `/src/fonts/outfit-latin.woff2`; Vite rewrites it at build time to the same hashed
asset URL the CSS bundle already emits for `@font-face`, so there's exactly one copy of the
file, fetched once, and discovered before the stylesheet's `@font-face` rule would otherwise
be the first thing to request it.

**Value.** The title and card text no longer flash from a fallback font to the real one on
first load — a small but visible polish on the very first impression of the page.

### PP-21 · Every selection toggle rewrites the whole board to localStorage

The `saveGame` effect in `App.tsx` is now debounced (`SAVE_DELAY_MS = 250`) instead of firing
on every state change, so a burst of taps writes the board once rather than once per tap.
Flushed immediately on `visibilitychange` (to `hidden`) and `pagehide` as well as the debounce
timer, so a tab closed mid-burst still persists its last state rather than losing whatever
hadn't reached the 250ms trailing edge yet.

**Value.** Not noticeable to players today; avoids doing pointless work on every single tap so
the game stays snappy if it's ever run on a slower or older device, without weakening the
"a backgrounded tab doesn't lose its run" guarantee the debounce could otherwise have cost.

### PP-23 · `CLAUDE.md` has drifted from the code

Re-audited against the current file and found already accurate on all three points this item
originally raised: `share.ts`'s description matches `buildShareText`'s actual spoiler-free
output (title, score, link — no tier grid), the hold-slot mechanic and `HOLD_SLOT_COUNT` are
documented in both the architecture table and the invariants section, and the `GameAction`
surface is listed correctly as all eight current variants. The drift this item described was
fixed as a side effect of other work (the hold-slot and `markRecorded` features being
documented as they were built) without ever citing PP-23. No changes needed; recorded here so
the item isn't re-flagged by a future audit working from a stale copy of this list.

**Value.** Confirms the steering document future work relies on is accurate, without spending
effort re-fixing something already fixed.

### PP-6 · No UTC rollover handling in an open tab

`App.tsx` polls `todayKey()` against `state.dateKey` — once on mount, on a 60-second interval,
and on every `visibilitychange` — so a tab left open (or backgrounded) across midnight UTC
notices within about a minute rather than never. On a mismatch it surfaces a dismissible
`RolloverBanner` ("Today's puzzle has changed since you started" / Play it / Not now) instead
of yanking the board out from under a run in progress; declining or ignoring it leaves the
stale run playable on purpose, same as before. "Play it" and the header's Restart button both
route through the same `handleNewGame`, which now picks a rollover-specific confirm message
when `state.dateKey` no longer matches `todayKey()` — so Restart itself stopped silently
swapping in a different deal without asking, closing the "the same button does two different
things depending on the clock" gap the original writeup flagged.

A second, previously-unflagged consequence of the same root cause is fixed alongside it:
`submit_run` stamps `date_key` from the server's own clock rather than trusting the request
(see CLAUDE.md's "Score collection"), so a run that finished under a UTC date that had already
rolled over was landing in *today's* community average despite being scored against a
different day's deck. The completion effect in `App.tsx` now skips `submitRun` outright when
`state.dateKey !== todayKey()`, so a stale run can no longer corrupt the shared average — it
just doesn't get a submission, the same as any other best-effort failure. Covered by four new
cases in `src/App.test.tsx` (banner surfacing and acceptance, dismiss suppressing it rather
than resurfacing on the next poll tick, the rollover-aware Restart confirm text, and the
stale-submission skip), driven with fake timers rather than the real clock.

**Value.** If you leave the tab open past midnight UTC, you're told the puzzle has moved on
instead of unknowingly grinding out yesterday's deal, and if you finish that stale run anyway
it no longer sneaks into today's shared average under a score nobody else's board could have
produced.

### PP-22 · No LICENSE file

Added a root `LICENSE` (MIT) and a `"license": "MIT"` field in `package.json`, per the repo
owner's choice.

**Value.** Makes clear to anyone who finds this on GitHub what they're actually allowed to do
with the code — previously, by default copyright law, the honest answer was nothing.

---

## P0 — Correctness bugs

None open.

---

## P1 — Accessibility

None open — see PP-3, PP-4, PP-5 under **Resolved**.

---

## P2 — Robustness

None open — see PP-6 under **Resolved**.

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

---

## P2 — Testing and CI

### PP-14 · `storage.ts` has zero tests — M

**Status: done.** `src/game/storage.test.ts` now exists, covering round-trip
save/load, rejection of a stale `dateKey`, rejection of the malformed shapes deep validation
now catches (bad card, out-of-range `selected` index, tampered hand score, unknown
`status`, negative `total`), the numeric-`selected` migration, the `recorded` migration, the
`setItem`/`getItem`-throws private-mode paths, and `recordRun` accumulating `plays` and
`bestScore` across calls. What CLAUDE.md's untested-module note originally flagged is
closed; see PP-15 below for the App-level integration coverage that used to be the remaining gap.

**Value.** Gives confidence that a future code change can't quietly corrupt your saved game
or your stats without a test catching it first.

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
