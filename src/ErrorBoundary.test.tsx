// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ErrorBoundary } from './ErrorBoundary';
import * as storage from './game/storage';

function Bomb(): never {
  throw new Error('boom');
}

describe('ErrorBoundary', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // React and the boundary's own componentDidCatch both log the crash —
    // expected noise for this test, not something to let spam the run.
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('renders children when nothing has thrown', () => {
    render(
      <ErrorBoundary>
        <p>All fine</p>
      </ErrorBoundary>,
    );
    expect(screen.getByText('All fine')).toBeInTheDocument();
  });

  it('catches a render throw and shows the fallback instead of a blank screen', () => {
    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>,
    );
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start a fresh deal' })).toBeInTheDocument();
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it('the fallback button clears the saved game and reloads', () => {
    const clearGameSpy = vi.spyOn(storage, 'clearGame').mockImplementation(() => {});
    // jsdom's `window.location` isn't a plain configurable property, so
    // `reload` can't be spied on directly — swap the whole object out.
    const originalLocation = window.location;
    const reloadSpy = vi.fn();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...originalLocation, reload: reloadSpy },
    });

    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Start a fresh deal' }));

    expect(clearGameSpy).toHaveBeenCalledTimes(1);
    expect(reloadSpy).toHaveBeenCalledTimes(1);

    clearGameSpy.mockRestore();
    Object.defineProperty(window, 'location', { configurable: true, value: originalLocation });
  });
});
