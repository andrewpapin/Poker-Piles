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
import { CATEGORY_LABELS } from './game/types';
import {
  clearGame,
  hasSeenHelp,
  loadGame,
  loadStats,
  markHelpSeen,
  recordRun,
  saveGame,
} from './game/storage';
import type { DailyStats } from './game/storage';

function bootstrap(): GameState {
  const dateKey = todayKey();
  // Silently pick up an interrupted run so a backgrounded tab does not lose it.
  return loadGame(dateKey) ?? initGame(dateKey);
}

export default function App() {
  const [state, dispatch] = useReducer(gameReducer, undefined, bootstrap);
  const [stats, setStats] = useState<DailyStats | null>(null);
  const [showHelp, setShowHelp] = useState(() => !hasSeenHelp());
  const [toast, setToast] = useState<{ id: number; label: string; score: number } | null>(null);
  // Which empty hold slot is armed to receive the next card tapped on the board.
  const [armedHoldSlot, setArmedHoldSlot] = useState<number | null>(null);
  const recordedRef = useRef<GameState | null>(null);
  const prevHandCountRef = useRef(state.hands.length);

  useEffect(() => {
    saveGame(state);
  }, [state]);

  useEffect(() => {
    // Guarded by state identity so a completed run is only ever counted once.
    if (state.status !== 'complete' || recordedRef.current === state) return;
    recordedRef.current = state;
    setStats(recordRun(state.dateKey, state.total));
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

  return (
    <div className="app">
      <Header
        dateKey={state.dateKey}
        total={state.total}
        handsPlayed={state.hands.length}
        lastHand={state.hands.length > 0 ? state.hands[state.hands.length - 1] : null}
        onNewGame={handleNewGame}
        onHelp={() => setShowHelp(true)}
        onGiveUp={handleGiveUp}
        canGiveUp={state.status === 'playing'}
      />

      <main className="main">
        <Board
          piles={state.piles}
          selectedPiles={selectedPileIndices(state)}
          selectedCount={state.selected.length}
          holdArmed={armedHoldSlot !== null}
          onToggle={handlePileTap}
        />
        <HoldSlots
          held={state.held}
          selected={selectedHeldIndices(state)}
          selectedCount={state.selected.length}
          armedSlot={armedHoldSlot}
          onToggle={(slot) => dispatch({ type: 'toggleHeld', slot })}
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
        handsPlayed={state.hands.length}
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
