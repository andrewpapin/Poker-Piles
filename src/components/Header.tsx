import { useEffect, useRef, useState } from 'react';
import { formatPuzzleDate } from '../game/share';
import type { Theme } from '../game/storage';

type Props = {
  dateKey: string;
  total: number;
  handsPlayed: number;
  theme: Theme;
  onNewGame: () => void;
  onHelp: () => void;
  onGiveUp: () => void;
  onToggleTheme: () => void;
  canGiveUp: boolean;
};

/** Animates toward `value` instead of snapping, so a scored hand feels earned. */
function useCountUp(value: number, duration = 700): number {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);

  useEffect(() => {
    const from = fromRef.current;
    if (from === value) return;

    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - t) ** 4;
      setDisplay(Math.round(from + (value - from) * eased));
      if (t < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        fromRef.current = value;
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  return display;
}

export function Header({
  dateKey,
  total,
  handsPlayed,
  theme,
  onNewGame,
  onHelp,
  onGiveUp,
  onToggleTheme,
  canGiveUp,
}: Props) {
  const displayTotal = useCountUp(total);
  // True only while the count-up is running, which is exactly when the score
  // should swell — no key, no remount, no extra timer.
  const counting = displayTotal !== total;

  return (
    <header className="header">
      <div className="header-row">
        <div className="wordmark">
          <h1 className="header-title">Poker Piles</h1>
          <span className="header-date">{formatPuzzleDate(dateKey)}</span>
        </div>
        <div className="header-tools">
          <button
            type="button"
            className="icon-btn"
            onClick={onToggleTheme}
            aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          >
            {theme === 'dark' ? (
              /* Sun: the action this button performs is "switch to light". */
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.3"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                focusable="false"
              >
                <circle cx="12" cy="12" r="4" />
                <path d="M12 3v1.6M12 19.4V21M4.9 4.9l1.13 1.13M17.97 17.97 19.1 19.1M3 12h1.6M19.4 12H21M4.9 19.1l1.13-1.13M17.97 6.03 19.1 4.9" />
              </svg>
            ) : (
              /* Crescent moon: the action this button performs is "switch to dark". */
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.3"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                focusable="false"
              >
                <path d="M20.2 14.4A8.6 8.6 0 1 1 9.6 3.8a6.8 6.8 0 0 0 10.6 10.6z" />
              </svg>
            )}
          </button>
          {canGiveUp && (
            <button
              type="button"
              className="icon-btn"
              onClick={onGiveUp}
              aria-label="Give up"
              title="End the run here — remaining cards are discarded"
            >
              {/* A white flag: the run ends on its current score, nothing is played out. */}
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.3"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                focusable="false"
              >
                <path d="M6 21V4" />
                <path d="M6 4.8h11l-2.6 4.1L17 13H6z" />
              </svg>
            </button>
          )}
          <button type="button" className="icon-btn" onClick={onHelp} aria-label="How to play">
            {/* Drawn rather than typed, for the same reason as the restart arrow. */}
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.3"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              focusable="false"
            >
              <path d="M9.2 9a2.9 2.9 0 1 1 3.9 2.7c-.7.3-1.1 1-1.1 1.8v.6" />
              <path d="M12 17.6h.01" />
            </svg>
          </button>
          <button type="button" className="icon-btn" onClick={onNewGame} aria-label="Restart">
            {/* An inline glyph instead of the ↺ character, which several mobile
                system fonts render inconsistently or drop entirely. */}
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.3"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              focusable="false"
            >
              <path d="M20 12a8 8 0 1 1-2.34-5.66" />
              <path d="M20 4v5h-5" />
            </svg>
          </button>
        </div>
      </div>

      <div className="header-stats">
        <span className={`score${counting ? ' score--live' : ''}`} aria-label={`Score ${total}`}>
          {displayTotal}
        </span>
        <span className="header-meta">
          {handsPlayed} hand{handsPlayed === 1 ? '' : 's'} played
        </span>
      </div>
    </header>
  );
}
