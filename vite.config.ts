import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base must match the GitHub repo name exactly — Pages paths are case-sensitive.
export default defineConfig({
  base: '/Poker-Piles/',
  plugins: [react()],
});
