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
// `quorum-source` is the workspace-only export condition. `@quorum/core` publishes `./src/index.ts`
// under it and `./dist/index.js` by default, so this line is what decides that the workspace suites
// keep proving TypeScript source while Node and a packed install get the emitted artifact — see
// "The emit serves the binary, and no test verdict moves behind it" (2026-09-02), clause (b).
//
// It is `ssr.resolve` and not `resolve` because Vitest's node environment resolves through Vite's
// server pipeline; setting the client list as well was measured to be redundant here and dropped.
// The default list is spread rather than replaced — narrowing it to one condition would strip
// `module`, `node` and `import` and break every other resolution in the workspace. Removing
// `quorum-source` from this array is what turns it red: `@quorum/core` then resolves to a `dist/`
// nothing has built, and Vite reports "Failed to resolve entry for package".
import { defaultServerConditions } from 'vite';
import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  ssr: {
    resolve: {
      conditions: ['quorum-source', ...defaultServerConditions],
    },
  },
  test: {
    include: [...configDefaults.include],
  },
});
