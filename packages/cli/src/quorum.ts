#!/usr/bin/env node
/**
 * The `quorum` binary: the one file `package.json`'s `bin` key points at, and the only module in
 * this package with a side effect at import time.
 *
 * **Its depth below the package root is load-bearing and is ruled rather than chosen.** It emits to
 * `dist/quorum.js`, exactly one directory below `packages/cli`, so that `path.join(here, '..')`
 * resolves to the *package root*. `spike/bin/harness.js:321` resolves the shipped templates as
 * `path.join(here, '..', 'templates', 'harness')` — relative to the binary's own file — so
 * Q-0093's `init` will read them from `<package>/templates/`. A target at `dist/bin/quorum.js`
 * would put them inside the emit that this package's own `build` script deletes with `rm -rf dist`
 * on every run. See *"The emit serves the binary, and no test verdict moves behind it"*
 * (2026-09-02), clause (e), which fixes the depth so Q-0093 inherits it rather than discovering it.
 *
 * **The shebang is the first bytes of the file**, which is a property of the emitted artifact and
 * not of this source: `tsc` preserves a leading shebang, and `package.test.ts` proves it by reading
 * the emitted file rather than by citing the compiler. The executable bit is set by this package's
 * `build` script, because `tsc` sets none — and `build.test.ts` proves it survives a cache replay,
 * since a `build` task with real `outputs` gives an artifact *back* rather than re-deriving it.
 *
 * **Nothing here decides an exit code.** `main` returns rather than exiting so that `die` and
 * `failSoftly` stay two mechanisms (see `fail.ts`), and the unhandled-rejection path is
 * `main().catch(dieOnUnexpected)` — `spike/bin/harness.js:569` verbatim in shape, which is why
 * `main` is awaited here rather than called and dropped.
 */
import { dieOnUnexpected } from './fail.js';
import { main } from './main.js';

await main(process.argv.slice(2)).catch(dieOnUnexpected);
