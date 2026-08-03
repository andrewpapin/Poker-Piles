import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { Board } from './components/Board';
import { HandBar } from './components/HandBar';
import { Header } from './components/Header';
import { HowToPlay } from './components/HowToPlay';
import { Results } from './components/Results';
import { todayKey } from './game/rng';
import {
  cardsRemaining,
  gameReducer,
  initGame,
  livePileCount,
  selectedCards,
} from './game/reducer';
import type { GameState } from './game/reducer';
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
  const recordedRef = useRef<GameState | null>(null);

  useEffect(() => {
    saveGame(state);
  }, [state]);

  useEffect(() => {
    // Guarded by state identity so a completed run is only ever counted once.
    if (state.status !== 'complete' || recordedRef.current === state) return;
    recordedRef.current = state;
    setStats(recordRun(state.dateKey, state.total));
  }, [state]);

  const handleNewGame = useCallback(() => {
    clearGame();
    dispatch({ type: 'newGame', dateKey: todayKey() });
  }, []);

  const closeHelp = useCallback(() => {
    markHelpSeen();
    setShowHelp(false);
  }, []);

  const selection = selectedCards(state);

  return (
    <div className="app">
      <Header
        dateKey={state.dateKey}
        total={state.total}
        handsPlayed={state.hands.length}
        cardsLeft={cardsRemaining(state)}
        onNewGame={handleNewGame}
        onHelp={() => setShowHelp(true)}
      />

      <main className="main">
        <Board
          piles={state.piles}
          selected={state.selected}
          onToggle={(pile) => dispatch({ type: 'toggle', pile })}
        />
      </main>

      <HandBar
        cards={selection}
        livePiles={livePileCount(state)}
        onClear={() => dispatch({ type: 'clear' })}
        onSubmit={() => dispatch({ type: 'submit' })}
      />

      {showHelp && <HowToPlay onClose={closeHelp} />}

      {state.status === 'complete' && !showHelp && (
        <Results
          dateKey={state.dateKey}
          total={state.total}
          hands={state.hands}
          stats={stats ?? loadStats(state.dateKey)}
          onPlayAgain={handleNewGame}
        />
      )}
    </div>
  );
}
