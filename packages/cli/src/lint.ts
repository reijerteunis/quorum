/**
 * `quorum lint` — every flow file in the project's `harness/flows`, one line each, and a non-zero
 * status if any of them is wrong, so a broken flow is found before a run bills a vendor.
 *
 * **The walk belongs to `core` and the rendering belongs here**, which is the whole of what this
 * module is. {@link lintDirectory} answers `{ ok, records }` with no marker, colour, indentation or
 * escape byte anywhere, having already split each multi-line lint message into problems and
 * stripped their leading hyphens — the same records reach M3's WebSocket and M4's flow editor,
 * where an escape byte is a defect. So the only thing added below is the marker, the colour and the
 * two-space indent: exactly what the spike's own local `lintDirectory`
 * (`spike/bin/harness.js:296–311`) added, and a second copy of the flattening would be the
 * transcription defect this repository keeps paying for.
 *
 * **The aggregate verdict goes through {@link failSoftly}**, where the spike ends the case in
 * `process.exit(ok ? 0 : 1)` (`spike/bin/harness.js:404`). The external status is identical in
 * every case; what differs is that everything is already printed by the time the verdict is known,
 * and the soft path is what lets that output finish reaching a pipe. A ruled divergence on
 * `fail.ts`'s own recorded reason — see Q-0091 AC-6.
 */
import path from 'node:path';

import { lintDirectory, loadProject, ProjectNotFoundError, type FlowFileReport } from '@quorum/core';

import type { FlagValue } from './argv.js';
import { c } from './colour.js';
import { die, failSoftly } from './fail.js';
import type { CommandHandler } from './main.js';

/**
 * The directory this command lints, or the spike's sentence and a hard exit where no project is
 * there.
 *
 * `loadProject` throws {@link ProjectNotFoundError} where the CLI's own version called `die` — a
 * library may not stop its host — so the sentence reaches the terminal only if somebody catches it.
 * Uncaught it would reach `dieOnUnexpected` and print a Node stack, which is a visible regression
 * against the spike. The message is `core`'s, byte for byte, including the `harness` the binary is
 * not called: Why: preserved defect, see `backlog/Q-0091-…/requirements/merged.md` OQ-2, whose
 * successor owns every user-facing occurrence of the old name at once.
 *
 * @param project `--project`'s value, passed through as `spike/bin/harness.js:52` passes it. A flag
 *   given with no value is the boolean `true`, and `path.resolve(true)` raises inside `loadProject`
 *   exactly as it raises in the spike. Why: preserved defect — coercing it here would answer
 *   `<cwd>/true` and lint the wrong project instead of stopping.
 */
function flowsDir(project: FlagValue | readonly FlagValue[] | undefined): string {
  try {
    return path.join(loadProject(project as string | undefined).harnessDir, 'flows');
  } catch (error) {
    if (!(error instanceof ProjectNotFoundError)) throw error;
    return die(error.message);
  }
}

/** One file's outcome: a green tick, or a red cross with each problem indented beneath it. */
const render = (record: FlowFileReport): string => (record.problems.length === 0
  ? `${c.green('✓')} ${record.filename}`
  : [`${c.red('✗')} ${record.filename}`, ...record.problems.map((problem) => `  - ${problem}`)].join('\n'));

/** Lint the whole flow directory, print one block per file, and fail if any file has a problem. */
export const lint: CommandHandler = ({ flags }) => {
  const { ok, records } = lintDirectory(flowsDir(flags.project));
  for (const record of records) console.log(render(record));
  if (!ok) failSoftly();
};
