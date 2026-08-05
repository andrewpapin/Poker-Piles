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
  const recordedRef = useRef<GameState | null>(null);
  const prevHandCountRef = useRef(state.hands.length);

  useEffect(() => {
    saveGame(state);
  }, [state]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute(
      'content',
      theme === 'dark' ? '#141311' : '#09090b',
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

  return (
    <div className="app">
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

      {showHelp && <HowToPlay onClose={closeHelp} />}

      {state.status === 'complete' && !showHelp && (
        <Results
          dateKey={state.dateKey}
          total={state.total}
          hands={state.hands}
          gaveUp={state.gaveUp}
          stats={stats ?? loadStats(state.dateKey)}
          onPlayAgain={handleNewGame}
        />
      )}
    </div>
  );
}
