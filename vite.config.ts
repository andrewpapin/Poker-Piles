/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base must match the GitHub repo name exactly — Pages paths are case-sensitive.
export default defineConfig({
  base: '/Poker-Piles/',
  plugins: [react()],
  test: {
    // The pure game/net suite needs no DOM and stays in the default `node`
    // environment so it keeps running fast; component/App specs opt into
    // jsdom individually via a `// @vitest-environment jsdom` docblock.
    environment: 'node',
    setupFiles: ['./src/test/setup.ts'],
  },
});
