/**
 * `quorum init [dir]` — the shipped templates into `<dir>/harness`, an empty `<dir>/backlog` beside
 * them, and the branch this checkout is on written into the config. The first command an adopter
 * runs.
 *
 * **The scaffolding is `core`'s and the resolution is this module's**, which is the whole of what
 * this file does. `initProject` copies, creates, refuses and edits; what is added here is where the
 * templates are, what the refusal prints, and the two lines a stranger reads afterwards.
 *
 * **The templates are read, never duplicated.** `packages/cli/templates/harness` is a mirror of
 * `spike/templates/harness`, asserted byte for byte in `templates.test.ts`, and both are the shipped
 * flows — so an adopter's first `harness/flows` carries the scoped write paths Q-0086 to Q-0088
 * landed rather than a stale copy of the artifact-overwrite defect they closed.
 *
 * **Nothing about the resolution consults the environment.** `TEMPLATES` is relative to this
 * module's own location and to nothing else, so it answers `packages/cli/templates/harness` whether
 * the suite resolves `src/` through the `quorum-source` condition or a plain `node` process resolves
 * `dist/`. That is the depth decision *"The emit serves the binary, and no test verdict moves behind
 * it"* (2026-09-02) clause (e) fixed for exactly this ticket, and `quorum.ts`'s own header carries
 * the reasoning.
 */
import path from 'node:path';

import { initProject, ProjectExistsError } from '@quorum/core';

import { c } from './colour.js';
import { die } from './fail.js';
import type { CommandHandler } from './main.js';

/**
 * The shipped template tree, resolved from this module's own location.
 *
 * A `URL` rather than a path, and handed to `core` as one: `fs.cpSync` takes `string | URL` for its
 * source, so the whole of the filesystem work — and `node:url` with it — stays in `@quorum/core`,
 * which is what lets `frame.source.test.ts`'s package-wide ban on IO modules go on holding for every
 * production module in this package. `frame.source.test.ts` permits this one module, and only this
 * one, to resolve its own location.
 */
const TEMPLATES = new URL('../templates/harness/', import.meta.url);

/**
 * What `init` prints when it has scaffolded, preserved from `spike/bin/harness.js:338`.
 *
 * Why: preserved — the three commands are named `harness`, which the binary is not called. That
 * class is **Q-0100**'s, which exists to rule it once for the board's hint, `ProjectNotFoundError`'s
 * sentence, `validate`'s usage line and this one, rather than once per command. Renaming it here
 * would be this ticket pre-deciding that ruling while three other sentences still disagree.
 */
const NEXT_STEPS = '  next: harness adapters · harness ticket new "…" · harness run requirements T-0001';

/** Scaffold `harness/` and `backlog/` in `rest[0]`, or in the working directory when there is none. */
export const init: CommandHandler = ({ rest }) => {
  const dir = path.resolve(rest[0] ?? '.');
  try {
    initProject(dir, TEMPLATES);
  } catch (error) {
    // The refusal is a sentence and an exit code, not the Node stack `dieOnUnexpected` would print
    // for an uncaught throw. Anything else is a defect and stays visible as one.
    if (!(error instanceof ProjectExistsError)) throw error;
    die(error.message);
  }
  console.log(`${c.green('✓')} harness/ and backlog/ created in ${dir}\n${NEXT_STEPS}`);
};
