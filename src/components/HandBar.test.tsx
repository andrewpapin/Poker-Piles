// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { HandBar } from './HandBar';
import { evaluateHand } from '../game/evaluator';
import { CATEGORY_LABELS } from '../game/types';
import type { Card } from '../game/types';

// A plain pair, unambiguous no matter how the evaluator's internals change —
// no straight/flush/trips is reachable from these five ranks and suits.
const PAIR_HAND: Card[] = [
  { id: '7S', kind: 'normal', rank: 7, suit: 'S' },
  { id: '7H', kind: 'normal', rank: 7, suit: 'H' },
  { id: '2D', kind: 'normal', rank: 2, suit: 'D' },
  { id: '4C', kind: 'normal', rank: 4, suit: 'C' },
  { id: '9S', kind: 'normal', rank: 9, suit: 'S' },
];

describe('HandBar', () => {
  it('renders idle when nothing is selected', () => {
    const { container } = render(
      <HandBar cards={[]} livePiles={8} heldCount={0} onClear={vi.fn()} onSubmit={vi.fn()} />,
    );
    expect(screen.getByText('—')).toBeInTheDocument();
    // The name line holds a non-breaking space rather than going empty, so the
    // readout doesn't change height when a selection starts or clears.
    expect(container.querySelector('.readout-name')?.textContent).toBe(' ');
    expect(screen.getByRole('button', { name: 'Clear selection' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Play hand' })).toBeDisabled();
  });

  it('is the one component allowed to call the evaluator directly — its preview must match it exactly', () => {
    const expected = evaluateHand(PAIR_HAND);
    render(
      <HandBar cards={PAIR_HAND} livePiles={8} heldCount={0} onClear={vi.fn()} onSubmit={vi.fn()} />,
    );
    expect(screen.getByText(CATEGORY_LABELS[expected.category])).toBeInTheDocument();
    expect(screen.getByText(String(expected.score))).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Clear selection' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Play hand' })).toBeEnabled();
  });

  it('flags that straights and flushes are unreachable once piles + held drop below 5', () => {
    render(
      <HandBar cards={PAIR_HAND.slice(0, 2)} livePiles={3} heldCount={1} onClear={vi.fn()} onSubmit={vi.fn()} />,
    );
    expect(screen.getByText('3 piles + 1 held left · no straights or flushes')).toBeInTheDocument();
  });

  it('stays quiet once 5+ cards are still reachable', () => {
    const { container } = render(
      <HandBar cards={[]} livePiles={5} heldCount={0} onClear={vi.fn()} onSubmit={vi.fn()} />,
    );
    expect(container.querySelector('.readout-note')?.textContent).toBe(' ');
  });

  it('wires Clear and Play hand to their callbacks', () => {
    const onClear = vi.fn();
    const onSubmit = vi.fn();
    render(<HandBar cards={PAIR_HAND} livePiles={8} heldCount={0} onClear={onClear} onSubmit={onSubmit} />);

    fireEvent.click(screen.getByRole('button', { name: 'Clear selection' }));
    fireEvent.click(screen.getByRole('button', { name: 'Play hand' }));

    expect(onClear).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});
