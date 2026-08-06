type Props = {
  onStart: () => void;
  onDismiss: () => void;
};

/** Non-blocking notice that the daily puzzle has rolled over to a new UTC date
 *  since this run began — a tab left open (or backgrounded) across midnight.
 *  Never swaps the board out from under a run in progress on its own; it only
 *  offers to switch, so "Not now" is a real option and the stale run can be
 *  finished on purpose if the player chooses. */
export function RolloverBanner({ onStart, onDismiss }: Props) {
  return (
    <div className="rollover-banner" role="status" aria-live="polite">
      <span className="rollover-banner-text">Today&rsquo;s puzzle has changed since you started.</span>
      <div className="rollover-banner-actions">
        <button type="button" className="rollover-banner-btn rollover-banner-btn--primary" onClick={onStart}>
          Play it
        </button>
        <button type="button" className="rollover-banner-btn" onClick={onDismiss}>
          Not now
        </button>
      </div>
    </div>
  );
}
