/**
 * The six colour functions every line of CLI output goes through.
 *
 * Preserved sequence for sequence from `spike/bin/harness.js:44`, which is one line declaring all
 * six. Two limits come with them and are reported rather than fixed (Q-0090 AC-3): there is no TTY
 * test, so the escapes are written unchanged into a pipe or a file, and neither `NO_COLOR` nor
 * `FORCE_COLOR` is honoured. Adding either is a behaviour change and a colour policy this ticket
 * was not sent to decide — see Q-0090's non-goal 11.
 */

/** Wraps `body` in `code`, and closes with the reset the spike closes every span with. */
const span = (code: string, body: string): string => `\x1b[${code}m${body}\x1b[0m`;

/** The palette, spelled as the spike spells it: one call per colour, no nesting, no state. */
export const c = {
  dim: (s: string): string => span('2', s),
  bold: (s: string): string => span('1', s),
  amber: (s: string): string => span('33', s),
  green: (s: string): string => span('32', s),
  red: (s: string): string => span('31', s),
  teal: (s: string): string => span('36', s),
};
