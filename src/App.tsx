import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { Board } from './components/Board';
import { HandBar } from './components/HandBar';
import { Header } from './components/Header';
import { HoldSlots } from './components/HoldSlots';
import { HowToPlay } from './components/HowToPlay';
import { Results } from './components/Results';
import { todayKey } from './game/rng';
import {
  gameReducer,
  heldCount,
  initGame,
  livePileCount,
  selectedCards,
  selectedHeldIndices,
  selectedPileIndices,
} from './game/reducer';
import type { GameState } from './game/reducer';
import { CATEGORY_LABELS, HOLD_SLOT_COUNT } from './game/types';
import {
  clearGame,
  hasSeenHelp,
  loadGame,
  loadStats,
  loadTheme,
  markHelpSeen,
  recordRun,
  saveGame,
  saveTheme,
} from './game/storage';
import type { DailyStats, Theme } from './game/storage';
import { submitRun } from './net/scores';
import type { DailySummary } from './net/scores';

function bootstrap(): GameState {
  const dateKey = todayKey();
  // Silently pick up an interrupted run so a backgrounded tab does not lose it.
  return loadGame(dateKey) ?? initGame(dateKey);
}

// The inline script in index.html already stamped `data-theme` on <html>
// before first paint (reading the same storage key, falling back to the
// system preference); this just mirrors that starting point into React state
// so later toggles have something to flip.
function bootstrapTheme(): Theme {
  return loadTheme() ?? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
}

export default function App() {
  const [state, dispatch] = useReducer(gameReducer, undefined, bootstrap);
  const [stats, setStats] = useState<DailyStats | null>(null);
  const [showHelp, setShowHelp] = useState(() => !hasSeenHelp());
  const [theme, setTheme] = useState<Theme>(bootstrapTheme);
  const [toast, setToast] = useState<{ id: number; label: string; score: number } | null>(null);
  // Which empty hold slot is armed to receive the next card tapped on the board.
  const [armedHoldSlot, setArmedHoldSlot] = useState<number | null>(null);
  const [community, setCommunity] = useState<DailySummary | null>(null);
  const [communityPending, setCommunityPending] = useState(false);
  const recordedRef = useRef<GameState | null>(null);
  const prevHandCountRef = useRef(state.hands.length);
  // Everything but the HowToPlay overlay itself, so it can be made `inert`
  // while the overlay is open — `aria-modal="true"` claims the background is
  // unreachable, so the DOM needs to actually make that true.
  const appContentRef = useRef<HTMLDivElement>(null);
  // The puzzle this session has already published a score for. Keyed by date
  // rather than a boolean so a tab left open across midnight UTC publishes
  // again for the new puzzle.
  const submittedRef = useRef<string | null>(null);

  useEffect(() => {
    saveGame(state);
  }, [state]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute(
      'content',
      theme === 'dark' ? '#f4f6fb' : '#09090b',
    );
    document.querySelector('meta[name="color-scheme"]')?.setAttribute(
      'content',
      theme === 'dark' ? 'light' : 'dark',
    );
    saveTheme(theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((current) => (current === 'dark' ? 'light' : 'dark'));
  }, []);

  useEffect(() => {
    // `state.recorded` guards across reloads (it's persisted); `recordedRef`
    // additionally guards within a single session against StrictMode's
    // double-invoke of this effect racing the `markRecorded` dispatch below.
    if (state.status !== 'complete' || state.recorded || recordedRef.current === state) return;
    recordedRef.current = state;
    setStats(recordRun(state.dateKey, state.total));
    dispatch({ type: 'markRecorded' });
  }, [state]);

  // Publish the finished run and read back today's average with it included.
  // Unlike the local stats above this deliberately ignores `state.recorded`
  // and fires for any completed run on screen, a reloaded one included: the
  // server keeps only the first run per browser per day, so a duplicate call
  // costs a request and returns the numbers to display rather than
  // double-counting. That leaves no local "already uploaded" flag to drift,
  // and a submit that failed while offline simply succeeds on the next load.
  // `submittedRef` is set before the request so StrictMode's double-invoke in
  // dev doesn't fire two of them.
  useEffect(() => {
    if (state.status !== 'complete' || submittedRef.current === state.dateKey) return;
    submittedRef.current = state.dateKey;
    setCommunityPending(true);
    submitRun({ score: state.total, hands: state.hands.length, gaveUp: state.gaveUp }).then(
      (summary) => {
        setCommunity(summary);
        setCommunityPending(false);
      },
    );
  }, [state.status, state.dateKey, state.total, state.hands.length, state.gaveUp]);

  useEffect(() => {
    if (state.hands.length > prevHandCountRef.current) {
      const last = state.hands[state.hands.length - 1];
      const id = Date.now();
      setToast({ id, label: CATEGORY_LABELS[last.category], score: last.score });
      const timer = setTimeout(() => {
        setToast((current) => (current?.id === id ? null : current));
      }, 1100);
      prevHandCountRef.current = state.hands.length;
      return () => clearTimeout(timer);
    }
    prevHandCountRef.current = state.hands.length;
  }, [state.hands]);

  const handleNewGame = useCallback(() => {
    // A run in progress is one mis-tap away from the reset button — confirm before wiping it.
    const hasProgress =
      state.hands.length > 0 || state.selected.length > 0 || state.held.some((c) => c !== null);
    if (hasProgress && !window.confirm("Restart today's puzzle? Your current run will be lost.")) {
      return;
    }
    clearGame();
    setArmedHoldSlot(null);
    // Let the replay publish too. The server ignores it (the first run of the
    // day is the one that counts) but still answers with the current average,
    // so the second results page isn't blank.
    submittedRef.current = null;
    setCommunity(null);
    dispatch({ type: 'newGame', dateKey: todayKey() });
  }, [state.hands.length, state.selected.length, state.held]);

  const closeHelp = useCallback(() => {
    markHelpSeen();
    setShowHelp(false);
  }, []);

  const handleGiveUp = useCallback(() => {
    if (!window.confirm('Give up? Your remaining cards are discarded and the run ends on your current score.')) {
      return;
    }
    setArmedHoldSlot(null);
    dispatch({ type: 'giveUp' });
  }, []);

  // Tapping a pile either selects it for the hand, or — if a hold slot is armed —
  // banks its top card there instead. Either way the arming is consumed by the tap.
  const handlePileTap = useCallback(
    (pile: number) => {
      if (armedHoldSlot !== null) {
        dispatch({ type: 'hold', pile, slot: armedHoldSlot });
        setArmedHoldSlot(null);
        return;
      }
      dispatch({ type: 'toggle', pile });
    },
    [armedHoldSlot],
  );

  // Tapping an empty hold slot either banks the most recently selected pile card
  // there directly — the "select a card, then the slot" order — or, with nothing
  // selected, arms the slot for the reverse order ("slot, then a card").
  const handleArmHoldSlot = useCallback(
    (slot: number) => {
      const lastPileSelection = [...state.selected].reverse().find((e) => e.origin === 'pile');
      if (lastPileSelection) {
        dispatch({ type: 'hold', pile: lastPileSelection.index, slot });
        setArmedHoldSlot(null);
        return;
      }
      setArmedHoldSlot((current) => (current === slot ? null : slot));
    },
    [state.selected],
  );

  const selection = selectedCards(state);
  const heldSelection = selectedHeldIndices(state);
  const toggleHeld = useCallback((slot: number) => dispatch({ type: 'toggleHeld', slot }), []);
  // Textual echo of the visual toast, for screen readers — the toast itself
  // stays `aria-hidden` since this carries the same content as prose.
  const handAnnouncement = toast
    ? `${toast.label}, ${toast.score} point${toast.score === 1 ? '' : 's'} — total ${state.total}`
    : '';

  // A finished run replaces the play area outright — board, hold tray and hand
  // bar all go, and the results page takes the shell's flexible row.
  const finished = state.status === 'complete';

  if (finished) {
    return (
      <div className="app app--finished">
        <div className="app-content" ref={appContentRef}>
          <Header
            dateKey={state.dateKey}
            total={state.total}
            handsPlayed={state.hands.length}
            theme={theme}
            onNewGame={handleNewGame}
            onHelp={() => setShowHelp(true)}
            onGiveUp={handleGiveUp}
            onToggleTheme={toggleTheme}
            canGiveUp={false}
            showStats={false}
          />

          <Results
            dateKey={state.dateKey}
            total={state.total}
            hands={state.hands}
            gaveUp={state.gaveUp}
            stats={stats ?? loadStats(state.dateKey)}
            community={community}
            communityPending={communityPending}
            onPlayAgain={handleNewGame}
          />
        </div>

        {showHelp && <HowToPlay onClose={closeHelp} backgroundRef={appContentRef} />}
      </div>
    );
  }

  return (
    <div className="app">
      <div className="app-content" ref={appContentRef}>
        <Header
          dateKey={state.dateKey}
          total={state.total}
          handsPlayed={state.hands.length}
          theme={theme}
          onNewGame={handleNewGame}
          onHelp={() => setShowHelp(true)}
          onGiveUp={handleGiveUp}
          onToggleTheme={toggleTheme}
          canGiveUp={state.status === 'playing'}
          showStats
        />

        <main className="main">
          <Board
            piles={state.piles}
            selectedPiles={selectedPileIndices(state)}
            selectedCount={state.selected.length}
            holdArmed={armedHoldSlot !== null}
            onToggle={handlePileTap}
            pileHoldIndex={state.pileHoldIndex}
            held={state.held}
            selectedHeldIndices={heldSelection}
            armedHoldSlot={armedHoldSlot}
            onArmHold={handleArmHoldSlot}
            onToggleHeld={toggleHeld}
          />
          <HoldSlots
            held={state.held.slice(0, HOLD_SLOT_COUNT)}
            selected={heldSelection.filter((i) => i < HOLD_SLOT_COUNT)}
            selectedCount={state.selected.length}
            armedSlot={armedHoldSlot}
            onToggle={toggleHeld}
            onArm={handleArmHoldSlot}
          />
          {toast && (
            <div className="hand-toast" key={toast.id} aria-hidden="true">
              <span className="hand-toast-name">{toast.label}</span>
              <span className="hand-toast-points">+{toast.score}</span>
            </div>
          )}
          <div className="sr-only" role="status" aria-live="polite">
            {handAnnouncement}
          </div>
        </main>

        <HandBar
          cards={selection}
          livePiles={livePileCount(state)}
          heldCount={heldCount(state)}
          onClear={() => dispatch({ type: 'clear' })}
          onSubmit={() => {
            setArmedHoldSlot(null);
            dispatch({ type: 'submit' });
          }}
        />
      </div>

      {showHelp && <HowToPlay onClose={closeHelp} backgroundRef={appContentRef} />}
    </div>
  );
}
