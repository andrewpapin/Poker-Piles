import { useEffect, useRef, useState } from 'react';
import { formatPuzzleDate } from '../game/share';
import type { HandResult } from '../game/types';

type Props = {
  dateKey: string;
  total: number;
  handsPlayed: number;
  lastHand: HandResult | null;
  onNewGame: () => void;
  onHelp: () => void;
};

/** Animates toward `value` instead of snapping, so a scored hand feels earned. */
function useCountUp(value: number, duration = 500): number {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);

  useEffect(() => {
    const from = fromRef.current;
    if (from === value) return;

    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - t) ** 3;
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

export function Header({ dateKey, total, handsPlayed, lastHand, onNewGame, onHelp }: Props) {
  const displayTotal = useCountUp(total);

  return (
    <header className="header">
      <div className="header-row">
        <h1 className="header-title">
          Poker Piles <span className="header-date">{formatPuzzleDate(dateKey)}</span>
        </h1>
        <div className="header-tools">
          <button type="button" className="icon-btn" onClick={onHelp} aria-label="How to play">
            ?
          </button>
          <button type="button" className="icon-btn" onClick={onNewGame} aria-label="Restart">
            ↺
          </button>
        </div>
      </div>

      <div className="header-stats">
        <span className="score" aria-label={`Score ${total}`}>
          {displayTotal}
        </span>
        <span className="header-meta">
          {lastHand
            ? `Hand ${handsPlayed} · ${lastHand.score} pt${lastHand.score === 1 ? '' : 's'}`
            : 'Ready to play'}
        </span>
      </div>
    </header>
  );
}
