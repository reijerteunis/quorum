/**
 * The two ways this CLI reports a failure, kept apart because they are two mechanisms and not one
 * number spelled twice.
 *
 * {@link die} exits immediately, which truncates whatever the process had not finished writing.
 * {@link failSoftly} sets the status and lets the process finish writing, which is what the spike's
 * four `process.exitCode = 1` assignments on the `runs` paths rely on
 * (`spike/bin/harness.js:499`, `:517`, `:523`, `:531`): a listing that reports a store warning
 * still prints the listing. A port collapsing the two into one call loses that output — see
 * Q-0090 AC-5, whose test demonstrates the difference rather than asserting it.
 */
import { c } from './colour.js';
import { ERROR } from './exit.js';

/**
 * Print a message to stderr and stop the process immediately with {@link ERROR}.
 *
 * Preserved verbatim from `spike/bin/harness.js:124`, including the space *inside* the red span,
 * which every other call site in that file puts outside it. Why: preserved defect, see Q-0090 AC-3.
 */
export function die(message: string): never {
  console.error(c.red('✗ ') + message);
  process.exit(ERROR);
}

/**
 * Record that the command failed without stopping it, so pending output still reaches the terminal.
 *
 * The counterpart to {@link die}, and never a synonym for it.
 */
export function failSoftly(): void {
  process.exitCode = ERROR;
}

/**
 * The handler an unexpected throw reaches, so a crash prints a Node stack through the error path.
 *
 * `spike/bin/harness.js:569` is `main().catch((e) => die(e.stack ?? String(e)))`, and four of its
 * behaviours belong to that exact expression rather than to the idea behind it, each measured
 * against it: the property access is unguarded, so a thrown `null` or `undefined` **raises** before
 * `die` is reached; the `??` tests whether `stack` is *there* and never what type it is, so
 * `{ stack: 42 }` is reported as `42`; the fallback is `String(e)`, so a thrown symbol prints as
 * `Symbol(s)`; and a symbol-valued `stack` reaches `die`, where the `+` **raises** because it cannot
 * coerce one. The expression is therefore written out rather than paraphrased, and the coercion is
 * left where the spike leaves it — inside {@link die}. Why: preserved, see Q-0090 AC-3.
 *
 * The two raising rows are a defect and are reported rather than repaired here: the one path that
 * exists to turn a crash into a message replaces it with a different crash. Ground rule 3.
 *
 * The binary that wires this to the frame's entry does not exist yet and is Q-0096's; the behaviour
 * is declared and tested here so no sibling command ticket has to invent it.
 */
export function dieOnUnexpected(error: unknown): never {
  const message: unknown = (error as { stack?: unknown }).stack ?? String(error);
  // The assertion is the point rather than a convenience: `die` takes a string, and this is the one
  // call site that may hand it something else, so the `+` inside `die` performs the same coercion —
  // and raises the same TypeError on a symbol — that the spike's does.
  return die(message as string);
}
