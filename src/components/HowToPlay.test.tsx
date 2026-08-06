// @vitest-environment jsdom
import { useRef, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { HowToPlay } from './HowToPlay';

/** Mirrors how App.tsx wires this up: a background ref plus an open flag it flips shut. */
function Harness() {
  const bgRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  return (
    <div>
      <div ref={bgRef}>
        <button onClick={() => setOpen(true)}>Trigger</button>
      </div>
      {open && <HowToPlay onClose={() => setOpen(false)} backgroundRef={bgRef} />}
    </div>
  );
}

describe('HowToPlay — dialog contract (PP-3 regression)', () => {
  it('moves focus into the sheet and marks the background inert on open', () => {
    render(<Harness />);
    const trigger = screen.getByRole('button', { name: 'Trigger' });
    fireEvent.click(trigger);

    const gotIt = screen.getByRole('button', { name: 'Got it' });
    expect(document.activeElement).toBe(gotIt);
    expect(trigger.closest('div')).toHaveProperty('inert', true);
  });

  it('closes on Escape', () => {
    const onClose = vi.fn();
    render(<HowToPlay onClose={onClose} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('traps Tab within the sheet instead of letting focus escape to the page', () => {
    render(<HowToPlay onClose={vi.fn()} />);
    const gotIt = screen.getByRole('button', { name: 'Got it' });
    expect(document.activeElement).toBe(gotIt);

    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(gotIt);

    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(gotIt);
  });

  it('un-inerts the background and restores focus to the opener on close', () => {
    render(<Harness />);
    const trigger = screen.getByRole('button', { name: 'Trigger' });
    const background = trigger.closest('div') as HTMLDivElement;
    // jsdom's fireEvent.click doesn't move focus the way a real click does, so
    // the "opener had focus" precondition has to be set up explicitly here.
    trigger.focus();
    fireEvent.click(trigger);
    expect(background).toHaveProperty('inert', true);

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(background).toHaveProperty('inert', false);
    expect(document.activeElement).toBe(trigger);
  });
});
