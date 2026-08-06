/// <reference types="vitest/config" />
import { execSync } from 'node:child_process';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Deploys land on main as a real merge commit ("Merge pull request #N from
// ..."), so the most recent one in history names the PR that's live — a
// simple, honest stand-in for a release number with no extra bookkeeping to
// keep in sync. Falls back to 'dev' for direct commits, a shallow clone with
// no matching history, or no git at all.
function resolveReleaseVersion(): string {
  try {
    const subject = execSync('git log -1 --grep="^Merge pull request #" --format=%s', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    const match = subject.match(/^Merge pull request #(\d+)/);
    return match ? `PR #${match[1]}` : 'dev';
  } catch {
    return 'dev';
  }
}

// base must match the GitHub repo name exactly — Pages paths are case-sensitive.
export default defineConfig({
  base: '/Poker-Piles/',
  plugins: [react()],
  define: {
    __RELEASE_VERSION__: JSON.stringify(resolveReleaseVersion()),
  },
  test: {
    // The pure game/net suite needs no DOM and stays in the default `node`
    // environment so it keeps running fast; component/App specs opt into
    // jsdom individually via a `// @vitest-environment jsdom` docblock.
    environment: 'node',
    setupFiles: ['./src/test/setup.ts'],
  },
});
