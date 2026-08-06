/// <reference types="vite/client" />

// Declared explicitly rather than left to `vite/client`'s index signature, so
// a typo in an env var name is a build error instead of a silent `undefined`.
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Stamped in at build time by vite.config.ts from the latest
// "Merge pull request #N" commit on main — see the header menu's version line.
declare const __RELEASE_VERSION__: string;
