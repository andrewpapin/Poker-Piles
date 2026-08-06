import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { formatPuzzleDate } from '../game/share';
import type { Theme } from '../game/storage';

type Props = {
  dateKey: string;
  total: number;
  handsPlayed: number;
  theme: Theme;
  version: string;
  onNewGame: () => void;
  onHelp: () => void;
  onGiveUp: () => void;
  onToggleTheme: () => void;
  canGiveUp: boolean;
  /** False once the run is over, when the results page states the score itself. */
  showStats: boolean;
};

const FOCUSABLE_SELECTOR = 'button:not([disabled])';

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
  version,
  onNewGame,
  onHelp,
  onGiveUp,
  onToggleTheme,
  canGiveUp,
  showStats,
}: Props) {
  const displayTotal = useCountUp(total);
  // True only while the count-up is running, which is exactly when the score
  // should swell — no key, no remount, no extra timer.
  const counting = displayTotal !== total;

  const [menuOpen, setMenuOpen] = useState(false);
  // Screen-space coordinates for the popover, taken from the hamburger
  // button when it opens. Needed because the popover is portaled to
  // `document.body` (see below) rather than positioned relative to
  // `.header-tools`, so plain CSS `position: absolute` can't reach it.
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuBtnRef = useRef<HTMLButtonElement>(null);

  // The button sits at the header's near corner in every layout — top-right
  // on mobile, top-left on the desktop rail (see styles.css) — so a fixed
  // "hang off the right edge" anchor overflows off-screen on desktop.
  // Instead: grow rightward from the button's left edge when there's room,
  // otherwise hang leftward off the button's right edge, then clamp to the
  // viewport as a last resort. `MENU_WIDTH` mirrors `.menu-popover`'s CSS
  // `min-width`; `max-width: calc(100vw - ...)` in that same rule is the
  // safety net if the popover ever renders wider than this estimate.
  const openMenu = () => {
    const rect = menuBtnRef.current?.getBoundingClientRect();
    if (!rect) return;
    const MENU_WIDTH = 210;
    const MARGIN = 8;
    const left =
      window.innerWidth - rect.left >= MENU_WIDTH + MARGIN ? rect.left : rect.right - MENU_WIDTH;
    setMenuPos({
      top: rect.bottom + 8,
      left: Math.max(MARGIN, Math.min(left, window.innerWidth - MENU_WIDTH - MARGIN)),
    });
    setMenuOpen(true);
  };

  const closeMenu = () => setMenuOpen(false);

  // Focus the first item on open, trap Tab inside the popover, close on
  // Escape, an outside click, or a resize/orientation change (which would
  // leave `menuPos` stale), and hand focus back to the hamburger button.
  // Lighter than HowToPlay's dialog (no backdrop, no `inert`) since this is a
  // menu sitting over the header, not a modal blocking the board.
  useEffect(() => {
    if (!menuOpen) return;

    const menu = menuRef.current;
    const focusable = menu
      ? Array.from(menu.querySelectorAll<HTMLButtonElement>(FOCUSABLE_SELECTOR))
      : [];
    focusable[0]?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setMenuOpen(false);
        menuBtnRef.current?.focus();
        return;
      }
      if (e.key !== 'Tab' || focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (menu?.contains(target) || menuBtnRef.current?.contains(target)) return;
      setMenuOpen(false);
    };

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('mousedown', onPointerDown);
    window.addEventListener('resize', closeMenu);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('resize', closeMenu);
    };
  }, [menuOpen]);

  const runAndClose = (action: () => void) => {
    setMenuOpen(false);
    action();
  };

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
            ref={menuBtnRef}
            className="icon-btn"
            onClick={() => (menuOpen ? closeMenu() : openMenu())}
            aria-label="Menu"
            aria-haspopup="true"
            aria-expanded={menuOpen}
          >
            {/* Three bars rather than the ☰ character, for the same reason
                every other header glyph here is drawn instead of typed. */}
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
              <path d="M4 6.5h16M4 12h16M4 17.5h16" />
            </svg>
          </button>

          {menuOpen && menuPos && createPortal(
            <div
              className="menu-popover"
              ref={menuRef}
              style={{ top: menuPos.top, left: menuPos.left }}
            >
              <button
                type="button"
                className="menu-item"
                onClick={() => runAndClose(onToggleTheme)}
              >
                {theme === 'dark' ? (
                  /* Sparkle: the action this button performs is "switch to party".
                     (The `light` theme value is the Party palette — see styles.css.) */
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
                    <path d="M10 3.5C10 7 12.5 9.5 16 9.5 12.5 9.5 10 12 10 15.5 10 12 7.5 9.5 4 9.5 7.5 9.5 10 7 10 3.5z" />
                    <path
                      strokeWidth="1.9"
                      d="M17.5 14c0 1.4 1.1 2.5 2.5 2.5-1.4 0-2.5 1.1-2.5 2.5 0-1.4-1.1-2.5-2.5-2.5 1.4 0 2.5-1.1 2.5-2.5z"
                    />
                  </svg>
                ) : (
                  /* Sun: the action this button performs is "switch to light".
                     (The `dark` theme value is the light-grounded palette — see styles.css.) */
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
                    <circle cx="12" cy="12" r="4.2" />
                    <path d="M12 3.5v2.1M12 18.4v2.1M4.9 4.9l1.5 1.5M17.6 17.6l1.5 1.5M3.5 12h2.1M18.4 12h2.1M4.9 19.1l1.5-1.5M17.6 6.4l1.5-1.5" />
                  </svg>
                )}
                {theme === 'dark' ? 'Switch to party theme' : 'Switch to light theme'}
              </button>

              {canGiveUp && (
                <button
                  type="button"
                  className="menu-item"
                  onClick={() => runAndClose(onGiveUp)}
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
                  Give up
                </button>
              )}

              <button type="button" className="menu-item" onClick={() => runAndClose(onHelp)}>
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
                How to play
              </button>

              <button
                type="button"
                className="menu-item"
                onClick={() => runAndClose(onNewGame)}
              >
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
                Restart
              </button>

              <div className="menu-divider" role="separator" />
              <div className="menu-version">Poker Piles {version}</div>
            </div>,
            document.body,
          )}
        </div>
      </div>

      {showStats && (
        <div className="header-stats">
          <span className={`score${counting ? ' score--live' : ''}`} aria-label={`Score ${total}`}>
            {displayTotal}
          </span>
          <span className="header-meta">
            {handsPlayed} hand{handsPlayed === 1 ? '' : 's'} played
          </span>
        </div>
      )}
    </header>
  );
}
