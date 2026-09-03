/**
 * `quorum ticket new "<title>"` — one ticket folder, at the id the backlog it is standing in comes
 * to next.
 *
 * **The allocation is `core`'s and is not re-specified here.** `Backlog.nextId` reads the one prefix
 * the backlog's tickets already carry and refuses rather than guessing when it cannot read one;
 * `Backlog.create` refuses a taken id and an occupied folder rather than allocating around either.
 * That table is Q-0080's, it is asserted from `spike/test/q0080-allocation.json` — the one copy both
 * trees read — and a second description of it here is the transcription defect this repository keeps
 * paying for. What this module claims is the **binary half**: that the CLI reaches that behaviour,
 * and that a refusal is one line and an exit code rather than a stack trace.
 *
 * **Four preserved defects reach this command, and none of them is repaired here** (ground rule 3).
 * Each is pinned in `ticket.test.ts` so a later fix is a deliberate act:
 *
 * 1. *`owner` defaults to `process.env.USER`* (`packages/core/src/backlog/backlog.ts:190`), which is
 *    the one value guaranteed not to identify the person a ticket belongs to on a shared or CI
 *    machine. Corrected by hand in this repository's backlog three times and reproduced every time.
 *    Why: preserved defect, see Q-0093 AC-13(a); whether the product should default an owner at all
 *    is product behaviour and is its successor's.
 * 2. *`--owner` with no following value is the boolean `true`*, because `argv.ts:54` gives a flag
 *    the value `true` when the next token is another flag or absent, and `create`'s destructuring
 *    default fires only on `undefined` — so the frontmatter reads `owner: true`.
 * 3. *`--intent` with no value reaches `intent.trim()` on a boolean*, and the `catch` below turns
 *    the resulting `TypeError` into `die('intent.trim is not a function')` — a JavaScript message on
 *    a user-facing path.
 * 4. *`--id` with no value is coerced by `String(true)` to `'true'`* and refused as
 *    `not a ticket id: 'true'`. Deliberate in the spike: the coercion is what makes every non-string
 *    reach one grammar rather than several.
 *
 * Why: behaviour preserved from `spike/bin/harness.js:340–352` (Q-0093 AC-2, AC-3).
 */
import path from 'node:path';

import { loadProject, ProjectNotFoundError, type Backlog } from '@quorum/core';

import type { FlagValue } from './argv.js';
import { c } from './colour.js';
import { die } from './fail.js';
import type { CommandHandler } from './main.js';

/**
 * The backlog this command allocates in, or the spike's sentence and a hard exit where no project
 * is there.
 *
 * Six lines duplicated from `lint.ts` and `runs.ts` rather than shared, and the duplication is
 * forced rather than accepted: a helper module holding it would be a *frame* module naming
 * `loadProject`, which `frame.source.test.ts`'s AC-10 partition forbids.
 *
 * The project is resolved through `loadProject` and nowhere else — ancestor discovery, `--project`
 * and a configured `backlog.path` all included, which is why this module constructs no `backlog/`
 * path of its own. Q-0091 erratum E-6 governs the argument: the spike reads that flag *inside* its
 * own `loadProject`, so passing it here is what keeps `--project` deciding which backlog is written.
 *
 * Why: preserved — `core`'s message names the binary `harness`, which this one is not called. That
 * whole class is Q-0100's.
 */
function backlogOf(project: FlagValue | readonly FlagValue[] | undefined): Backlog {
  try {
    return loadProject(project as string | undefined).backlog;
  } catch (error) {
    if (!(error instanceof ProjectNotFoundError)) throw error;
    return die(error.message);
  }
}

/** The usage line, preserved from `spike/bin/harness.js:342`. Why: the binary name is Q-0100's. */
const USAGE = 'usage: harness ticket new "<title>" --intent "..." [--id Q-0081]';

/** Allocate one ticket folder and print where it landed. */
export const ticket: CommandHandler = ({ rest, flags }) => {
  const backlog = backlogOf(flags.project);
  if (rest[0] !== 'new') die(USAGE);
  const title = rest[1];
  if (!title) die('title required');
  // An id the backlog refuses to allocate, or a folder it refuses to overwrite, is a sentence and an
  // exit code — not the Node stack `dieOnUnexpected` would print. The four argument expressions are
  // the spike's, preserved rather than paraphrased: three of them are the defects above.
  //
  // The success line is outside the `try`, where the spike puts it: a throw from the printing is a
  // defect and must stay visible as one rather than being reported as a refusal the backlog made.
  let created: ReturnType<Backlog['create']>;
  try {
    created = backlog.create({
      title,
      intent: (flags.intent ?? title) as string,
      owner: flags.owner as string | undefined,
      id: flags.id === undefined ? undefined : String(flags.id),
    });
  } catch (error) {
    return die((error as Error).message);
  }
  console.log(`${c.green('✓')} ${created.meta.id} created at ${path.relative(process.cwd(), created.dir)} (stage: draft)`);
};
