import { CATEGORY_LABELS, CATEGORY_POINTS } from '../game/types';
import type { HandCategory } from '../game/types';

const LADDER = Object.keys(CATEGORY_POINTS) as HandCategory[];

export function HowToPlay({ onClose }: { onClose: () => void }) {
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="howto-title">
      <div className="sheet">
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
