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
