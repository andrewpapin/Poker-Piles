import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { clearGame } from './game/storage';

type Props = { children: ReactNode };
type State = { hasError: boolean };

/**
 * Last-resort recovery for an unanticipated render throw — see PP-2. `loadGame`
 * validates deeply and should never hand the app a state that crashes it, but
 * this is the backstop for whatever that validation doesn't anticipate, so a
 * white screen is never the end state.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Poker Piles crashed:', error, info.componentStack);
  }

  private handleReset = (): void => {
    clearGame();
    window.location.reload();
  };

  render(): ReactNode {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="overlay" role="alertdialog" aria-modal="true" aria-labelledby="crash-title">
        <div className="sheet">
          <header className="howto-lockup">
            <h2 className="howto-title" id="crash-title">
              Something went wrong
            </h2>
            <p className="howto-sub">Your saved game couldn't be restored.</p>
          </header>
          <div className="sheet-actions">
            <button type="button" className="btn btn--primary" onClick={this.handleReset}>
              Start a fresh deal
            </button>
          </div>
        </div>
      </div>
    );
  }
}
