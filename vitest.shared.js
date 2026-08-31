// The one Vitest configuration. Every package's `vitest.config.js` re-exports this file, so a
// package can be run on its own (`pnpm --filter @quorum/core test`) without diverging from it.
//
// The include is Vitest's own default, taken by reference rather than transcribed, and it is
// deliberately not narrowed. Discovery is the point: qa-red proves a red phase by writing NEW test
// files and asserting the suite fails, so a pattern that collects none of them leaves `pnpm test`
// green and `integrate --expect fail` looping to a gate having proved nothing — which is the
// reasoning `spike/test/run.js`'s own header carries, arriving on the workspace side. Until Q-0054
// this narrowed the include to `src`, and a red test written to `packages/core/test/x.test.ts`, to
// `packages/core/x.test.ts` or as `packages/core/src/x.test.js` was collected by nothing at all.
//
// `packages/core/src/test-discovery.test.ts` is what fails when a `*.test.ts` lands somewhere
// nothing collects, and what refuses a narrowing — it reads this declaration rather than assuming
// it, so restoring the old one turns three behavioural assertions red rather than none.
import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: [...configDefaults.include],
  },
});
