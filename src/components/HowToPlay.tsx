import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';
import { CATEGORY_LABELS, CATEGORY_POINTS } from '../game/types';
import type { HandCategory } from '../game/types';

const LADDER = Object.keys(CATEGORY_POINTS) as HandCategory[];

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

type Props = {
  onClose: () => void;
  /** Everything behind the sheet, made `inert` for as long as this is mounted. */
  backgroundRef?: RefObject<HTMLElement | null>;
};

export function HowToPlay({ onClose, backgroundRef }: Props) {
  const sheetRef = useRef<HTMLDivElement>(null);

  // Move focus in on open, trap Tab inside the sheet, close on Escape, and
  // hand focus back to whatever opened the sheet once it's gone. The `inert`
  // toggle lives in this same effect (rather than a separate one keyed off
  // whether the sheet is shown) so it is guaranteed to clear *before*
  // `previouslyFocused.focus()` runs on close — an element can't take focus
  // while still marked inert, and effect cleanup order across components
  // isn't something to lean on for that.
  useEffect(() => {
    const background = backgroundRef?.current;
    if (background) background.inert = true;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const sheet = sheetRef.current;
    const focusable = sheet
      ? Array.from(sheet.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
      : [];
    (focusable[0] ?? sheet)?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
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

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      if (background) background.inert = false;
      previouslyFocused?.focus();
    };
  }, [onClose, backgroundRef]);

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="howto-title">
      <div className="sheet" ref={sheetRef} tabIndex={-1}>
        <header className="howto-lockup">
          <h2 className="howto-title" id="howto-title">
            Play poker hands. Score points.
          </h2>
          <p className="howto-sub">More points good. Less points bad.</p>
        </header>

        <section className="howto-card">
          <h3 className="sheet-eyebrow">How to play</h3>
          <ul className="rules">
            <li>
              Tap cards to make the <strong>best hand</strong>.
            </li>
            <li>
              <strong>Wilds</strong> substitute for any card.
            </li>
            <li>
              <strong>Holds</strong> save a card for a future hand.
            </li>
            <li>An emptied pile becomes an extra hold pile.</li>
            <li>Game over when you run out of cards.</li>
            <li>Same deal for everyone, every day. Resets at midnight UTC.</li>
          </ul>
        </section>

        <section className="howto-card">
          <h3 className="sheet-eyebrow">Scoring</h3>
          {/* Two columns, filled top-to-bottom, so the ladder reads strongest-first
              down the left and the whole sheet still clears the fold on a phone. */}
          <dl className="ladder">
            {LADDER.map((category) => (
              <div key={category} className="ladder-row">
                <dt>{CATEGORY_LABELS[category]}</dt>
                <dd>{CATEGORY_POINTS[category]}</dd>
              </div>
            ))}
          </dl>
        </section>

        <div className="sheet-actions">
          <button type="button" className="btn btn--primary" onClick={onClose}>
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
