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
 * What `e.stack ?? String(e)` yields for a thrown value, as a string.
 *
 * The `??` tests whether a `stack` property is *there* and never what type it is, so a thrown
 * `{ stack: 42 }` is reported as `42` — the spike hands the number to `die`, whose `+` coerces it.
 * `String()` is that coercion made explicit, because {@link die} takes a string. Reading the
 * property's *type* instead would report `[object Object]` for that value.
 * Why: preserved, see Q-0090 AC-3.
 *
 * One divergence, deliberate: a thrown `null` or `undefined` is reported as `null` / `undefined`,
 * where `e.stack` raises a `TypeError` inside the spike's own `catch` handler.
 */
const stackOf = (error: unknown): string => {
  const stack = (error as { stack?: unknown } | null | undefined)?.stack;
  return String(stack ?? error);
};

/**
 * The handler an unexpected throw reaches, so a crash prints a Node stack through the error path
 * rather than as an unhandled rejection.
 *
 * Preserved from `spike/bin/harness.js:569`, which is `main().catch((e) => die(e.stack ?? String(e)))`.
 * The binary that wires it to the frame's entry does not exist yet and is Q-0096's; the behaviour is
 * declared and tested here so no sibling command ticket has to invent it.
 */
export function dieOnUnexpected(error: unknown): never {
  return die(stackOf(error));
}
