/**
 * The dev server and bundler configuration for the shell.
 *
 * Two plugins and nothing else. There is no `build` section and no `base`, because this package
 * declares no `build` script: what the daemon serves is Q-0122's, together with the ruling on
 * whether a served bundle is an emitted artifact at all. Proxying the daemon's routes so the app
 * can reach them same-origin is the live connection's, not the shell's.
 */
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
});
