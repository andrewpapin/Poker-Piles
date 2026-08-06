// Shared setup for every test file. The pure game/net suite runs in the
// default `node` environment (no `window`), so everything DOM-only here is
// guarded — it only runs for the component/App specs that opt into jsdom.
import { afterEach } from 'vitest';

if (typeof window !== 'undefined') {
  await import('@testing-library/jest-dom/vitest');
  const { cleanup } = await import('@testing-library/react');

  // jsdom implements neither of these; Header's score count-up and the
  // theme bootstrap both need them to exist at all, not to be accurate.
  if (!window.matchMedia) {
    window.matchMedia = ((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
  }
  if (!window.requestAnimationFrame) {
    window.requestAnimationFrame = (cb: FrameRequestCallback) =>
      setTimeout(() => cb(performance.now()), 0) as unknown as number;
    window.cancelAnimationFrame = (id: number) => clearTimeout(id);
  }

  afterEach(() => {
    cleanup();
    window.localStorage.clear();
  });
}
