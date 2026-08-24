// The one Vitest configuration. Every package's `vitest.config.js` re-exports this file, so a
// package can be run on its own (`pnpm --filter @quorum/core test`) without diverging from it.
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
  },
});
