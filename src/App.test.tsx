// @vitest-environment jsdom
import { StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import App from './App';
import { todayKey } from './game/rng';
import { loadStats, markHelpSeen } from './game/storage';
import { submitRun } from './net/scores';
import type { DailySummary } from './net/scores';

vi.mock('./net/scores', () => ({ submitRun: vi.fn() }));

const PILE_LABEL = /^Pile \d+, /;

function pileButtons() {
  return screen.getAllByRole('button', { name: PILE_LABEL });
}

/** Pulls the card label out of a live pile's aria-label, e.g. "Pile 1, King of clubs, 6 cards beneath". */
function cardLabelOf(pileButton: HTMLElement): string {
  const label = pileButton.getAttribute('aria-label') ?? '';
  const match = label.match(/^Pile \d+, (.+), \d+ cards? beneath$/);
  if (!match) throw new Error(`unexpected pile label: ${label}`);
  return match[1];
}

describe('App', () => {
  const dateKey = todayKey();

  beforeEach(() => {
    window.localStorage.clear();
    // Otherwise the How to play overlay opens on every fresh mount (it's a
    // first-visit default) and its scoring ladder duplicates every category
    // label the tests look for.
    markHelpSeen();
    vi.mocked(submitRun).mockReset().mockResolvedValue(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('deals a fresh playing board', () => {
    render(<App />);
    expect(pileButtons()).toHaveLength(8);
    expect(screen.getByLabelText('Score 0')).toBeInTheDocument();
    expect(screen.getByText('0 hands played')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Give up' })).toBeInTheDocument();
  });

  it('selecting a single card previews High Card, and playing it scores, toasts and announces it', async () => {
    render(<App />);
    const [firstPile] = pileButtons();

    fireEvent.click(firstPile);
    expect(firstPile).toHaveAttribute('aria-pressed', 'true');
    // A lone card can only ever be a High Card — nothing else is reachable from one card.
    expect(screen.getByText('High Card')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Play hand' }));

    expect(screen.getByText('1 hand played')).toBeInTheDocument();
    expect(screen.getByText('+0')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('High Card, 0 points — total 0');

    // The toast is on an 1100ms timer; let it actually clear rather than
    // asserting only that it appeared.
    await waitFor(() => expect(screen.queryByText('+0')).not.toBeInTheDocument(), { timeout: 2000 });
  }, 3000);

  it('arms an empty hold slot, then banks the next pile tap there', () => {
    render(<App />);
    const [firstPile] = pileButtons();
    const label = cardLabelOf(firstPile);

    const slot = screen.getByRole('button', { name: 'Hold slot 1, empty' });
    fireEvent.click(slot);
    expect(screen.getByRole('button', { name: 'Hold slot 1, armed — tap a card to hold it here' })).toBeInTheDocument();

    fireEvent.click(firstPile);
    expect(screen.getByRole('button', { name: `Hold slot 1, ${label}` })).toBeInTheDocument();
  });

  it('selecting a card then tapping an empty slot banks it directly, clearing the selection', () => {
    render(<App />);
    const [firstPile] = pileButtons();
    const label = cardLabelOf(firstPile);

    fireEvent.click(firstPile);
    expect(firstPile).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(screen.getByRole('button', { name: 'Hold slot 1, empty' }));

    expect(screen.getByRole('button', { name: `Hold slot 1, ${label}` })).toBeInTheDocument();
    // The selection that pointed at the now-banked pile must not dangle.
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('gives up after confirmation, ends the run, and submits the score exactly once', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const summary: DailySummary = { average: 12.3, plays: 4 };
    vi.mocked(submitRun).mockResolvedValue(summary);

    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Give up' }));

    expect(screen.getByText('Gave up')).toBeInTheDocument();
    await waitFor(() => expect(submitRun).toHaveBeenCalledTimes(1));
    expect(submitRun).toHaveBeenCalledWith({ score: 0, hands: 0, gaveUp: true });
    expect(loadStats(dateKey).plays).toBe(1);
  });

  it('declining the restart confirm leaves progress in place; accepting it resets the board', () => {
    render(<App />);
    const [firstPile] = pileButtons();
    fireEvent.click(firstPile);
    expect(firstPile).toHaveAttribute('aria-pressed', 'true');

    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    fireEvent.click(screen.getByRole('button', { name: 'Restart' }));
    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(pileButtons()[0]).toHaveAttribute('aria-pressed', 'true');

    confirmSpy.mockReturnValue(true);
    fireEvent.click(screen.getByRole('button', { name: 'Restart' }));
    expect(pileButtons().every((btn) => btn.getAttribute('aria-pressed') === 'false')).toBe(true);
  });

  it('restarting a fresh game (no progress) never prompts for confirmation', () => {
    const confirmSpy = vi.spyOn(window, 'confirm');
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Restart' }));
    expect(confirmSpy).not.toHaveBeenCalled();
  });

  it('does not double-record or double-submit a completed run under StrictMode', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.mocked(submitRun).mockResolvedValue({ average: 0, plays: 1 });

    render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Give up' }));

    await waitFor(() => expect(submitRun).toHaveBeenCalled());
    expect(submitRun).toHaveBeenCalledTimes(1);
    expect(loadStats(dateKey).plays).toBe(1);
  });

  it('toggles and persists the theme', () => {
    render(<App />);
    expect(document.documentElement.dataset.theme).toBe('light');
    fireEvent.click(screen.getByRole('button', { name: 'Switch to night theme' }));
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(window.localStorage.getItem('pokerpiles:v2:theme')).toBe('dark');
    expect(screen.getByRole('button', { name: 'Switch to party theme' })).toBeInTheDocument();
  });
});
