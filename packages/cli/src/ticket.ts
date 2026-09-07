/**
 * `quorum ticket new "<title>"` — one ticket folder, at the id the backlog it is standing in comes
 * to next.
 *
 * **The allocation is `core`'s and is not re-specified here.** `Backlog.nextId` reads the one prefix
 * the backlog's tickets already carry and refuses rather than guessing when it cannot read one;
 * `Backlog.create` refuses a taken id and an occupied folder rather than allocating around either.
 * That table is Q-0080's, it is asserted from `packages/core/src/backlog/q0080-allocation.json` —
 * the one copy, moved there by Q-0107 AC-8 — and a second description of it here is the
 * transcription defect this repository keeps paying for. What this module claims is the **binary half**: that the CLI reaches that behaviour,
 * and that a refusal is one line and an exit code rather than a stack trace.
 *
 * **Four defects reached this command; Q-0112 repaired the two about `owner` and the other two are
 * preserved** (ground rule 3). Each is pinned in `ticket.test.ts` so a later fix is a deliberate act,
 * and the repaired pair is listed with them because the argument coercion beneath them is unchanged:
 * a reader meeting only the repair would not know that `--owner` still *arrives* as `true`.
 *
 * 1. ~~*`owner` defaults to `process.env.USER`*~~ — **repaired.** `core` reads no environment for an
 *    identity; the default is `unknown` and this module resolves the name. See *"A ticket's owner is
 *    supplied, never guessed"* (2026-09-08).
 * 2. ~~*`--owner` with no following value is the boolean `true`*~~ — **repaired at the write
 *    boundary, not at the flag.** `argv.ts:54` still gives a valueless flag `true`; what changed is
 *    that a boolean is no longer a name, so {@link resolveOwner} ignores it and `create` refuses it
 *    if it ever arrives from anywhere else.
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

import { configuredUser, loadProject, ProjectNotFoundError, type Backlog } from '@quorum/core';

import type { FlagValue } from './argv.js';
import { c } from './colour.js';
import { die, dieNoProject } from './fail.js';
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
 * The message is `core`'s, rendered unaltered — this module composes no recovery advice of its own,
 * which is what keeps one sentence in one place.
 */
function projectOf(project: FlagValue | readonly FlagValue[] | undefined): ReturnType<typeof loadProject> {
  try {
    return loadProject(project as string | undefined);
  } catch (error) {
    if (!(error instanceof ProjectNotFoundError)) throw error;
    return dieNoProject(error.message);
  }
}

/**
 * Who the ticket belongs to: the flag if it was given a name, then git's, then nobody.
 *
 * **The policy is this surface's and the fact is `core`'s.** `configuredUser` answers what git is
 * configured to call this user and `null` where nothing is configured; deciding that this is the
 * owner, and what to do when there is no answer, is the CLI's. `core` reads no environment for an
 * identity — it stamped `process.env.USER`, the operating-system account, which named a person on
 * nobody's machine and eleven tickets in this backlog. Q-0112.
 *
 * A flag with no value after it is `true` (`argv.ts:54`), which is not a name and is not treated as
 * one; `create` refuses it if it ever arrives, which is the guarantee M3's server inherits.
 */
const resolveOwner = (flag: FlagValue | readonly FlagValue[] | undefined, repoDir: string): string | undefined =>
  (typeof flag === 'string' && flag.trim() ? flag : configuredUser(repoDir) ?? undefined);

/** The usage line: the argument shape from `spike/bin/harness.js:342`, named `quorum` per Q-0100. */
const USAGE = 'usage: quorum ticket new "<title>" --intent "..." [--id Q-0081]';

/** Allocate one ticket folder and print where it landed. */
export const ticket: CommandHandler = ({ rest, flags }) => {
  const { backlog, repoDir } = projectOf(flags.project);
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
      owner: resolveOwner(flags.owner, repoDir),
      id: flags.id === undefined ? undefined : String(flags.id),
    });
  } catch (error) {
    return die((error as Error).message);
  }
  console.log(`${c.green('✓')} ${created.meta.id} created at ${path.relative(process.cwd(), created.dir)} (stage: draft)`);
};
