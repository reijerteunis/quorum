// The one Vitest configuration. Every package's `vitest.config.js` re-exports this file, so a
// package can be run on its own (`pnpm --filter @quorum/core test`) without diverging from it.
//
// The include is Vitest's own default, taken by reference rather than transcribed, and it is
// deliberately not narrowed. Discovery is the point: qa-red proves a red phase by writing NEW test
// files and asserting the suite fails, so a pattern that collects none of them leaves `pnpm test`
// green and `integrate --expect fail` looping to a gate having proved nothing. The reasoning
// arrived here from the runner of the second suite this repository used to have, which discovered
// its own directory and whose header carried the argument; Q-0103 deleted that tree, and the
// argument survives it because the property is the workspace's now. Until Q-0054 this narrowed the
// include to `src`, and a red test written to `packages/core/test/x.test.ts`, to
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
// BOTH lists carry it, and the reason the client one was once absent is worth keeping. Until
// 2026-09-12 only `ssr.resolve` did, on a measurement that the client list was "redundant here" —
// true while every test ran in Vitest's node environment, which resolves through Vite's SERVER
// pipeline. A test file carrying `// @vitest-environment jsdom` resolves through the CLIENT one
// instead, and Q-0014 landed the first of those. It passed only because `apps/web` imported no
// workspace package; the moment Q-0120 gave it `@quorum/shared`, that file stopped loading at all —
// "Failed to resolve import" before a single test ran, while every node-environment suite beside it
// stayed green. So the redundancy was real and it expired; a measurement is true of the tree it was
// taken on. Reproduced and fixed on a clone with no `packages/shared/dist`, which is the only tree
// that discriminates: 1 file failed with "no tests" before, 35 passed after.
// The default list is spread rather than replaced — narrowing it to one condition would strip
// `module`, `node` and `import` and break every other resolution in the workspace. Removing
// `quorum-source` from either array is what turns it red: `@quorum/core` then resolves to a `dist/`
// nothing has built, and Vite reports "Failed to resolve entry for package".
import { defaultClientConditions, defaultServerConditions } from 'vite';
import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    conditions: ['quorum-source', ...defaultClientConditions],
  },
  ssr: {
    resolve: {
      conditions: ['quorum-source', ...defaultServerConditions],
    },
  },
  test: {
    include: [...configDefaults.include],
    // The include matches `.js` as well as `.ts`, and Vitest's own `exclude` default is
    // `node_modules` and `.git` only — so once Q-0097 gave the workspace an emit, an emitted
    // `dist/**/*.test.js` would be COLLECTED AND EXECUTED, from a directory at a different depth
    // from its source, making every path such a test derives from its own location wrong.
    //
    // The primary mechanism is that no test file is emitted at all: each emitting package's
    // `tsconfig.build.json` excludes `src/**/*.test.ts`. This is defence in depth, and it is a
    // widening of the EXCLUDE rather than a narrowing of the include — the include is still Vitest's
    // own default, taken by reference, and `packages/core/src/test-discovery.test.ts` still refuses a
    // narrowing of it. A red phase writes TypeScript under `src/` or `test/`, never under a
    // gitignored emit directory, so no discovery guarantee moves. Q-0097 AC-23.
    exclude: [...configDefaults.exclude, '**/dist/**'],
    // The budget a test gets, CHOSEN rather than inherited. Until 2026-09-11 no file in this
    // workspace declared one, so Vitest's 5000 ms default governed — a number nobody selected,
    // asserting nothing deliberate about any test here.
    //
    // Measured on a passing run under full-workspace load: the slowest test in the corpus,
    // `adapters/codex.test.ts` AC-4, takes **3685 ms** and is more than twice the next slowest. It
    // earns that honestly — it loops four option combinations and each one writes a CLI stub and
    // SPAWNS it, so it is four sequential subprocesses. Against 5000 ms that is 26% headroom, and
    // any suite added anywhere in the workspace consumes it. Measured across two windows on the same
    // branch and the same 5000 ms value: **5 consecutive failures** in one and a clean pass in
    // another, against 2 failures in 17 runs before Q-0074's two source-walking registers landed.
    // The verdict tracks what else the machine is doing and nothing in the commit — stated this way
    // because the first reading of it here was "deterministic", and it is not.
    //
    // **This does not weaken what runs**, which is what Q-0102's GO-2 forbids — every test, file and
    // assertion is unchanged, and a hang still fails. What it replaces is an ACCIDENTAL oracle with
    // a chosen one. 20000 ms is ~5x the measured worst case, which is headroom for a loaded CI
    // runner without being a number that could never fire.
    //
    // Why a single workspace value rather than a per-file override: the next expensive test would
    // otherwise inherit the accidental default again, which is how this arrived. See Q-0102.
    testTimeout: 20_000,
  },
});
