/**
 * The command line, parsed exactly as `spike/bin/harness.js:25–42` parses it.
 *
 * Deliberately not a library. Two of the behaviours below are defects a well-behaved parser would
 * silently fix — a single-dash token is a positional, and `--` swallows the token after it instead
 * of terminating the flags — and fixing either before a single command is ported would change flag
 * semantics under the eight commands that are about to arrive. They are preserved and pinned in
 * `argv.test.ts`, one row each, so a later change to them is a deliberate act. Why: preserved
 * defects, see Q-0090 AC-2 behaviours 4 and 5.
 */

/** What a flag carries: the token after it, or `true` when the next token is another flag. */
export type FlagValue = string | true;

/** The flag that accumulates. Every other flag is last-wins. */
export const GATE_ANSWER = 'gate-answer';

/** One command line, split into the four things the commands read. */
export interface ParsedArgv {
  /** The first positional, or `undefined` when there is none. */
  readonly cmd: string | undefined;
  /** Every positional after the first, in order, with nothing de-duplicated. */
  readonly rest: readonly string[];
  /**
   * Every flag seen. `gate-answer` holds an array; every other key holds its last value.
   *
   * Nothing is coerced to a number: a value is the token as it was typed, or the boolean `true`.
   */
  readonly flags: Readonly<Record<string, FlagValue | FlagValue[]>>;
  /**
   * Every `--gate-answer` in command-line order, as a copy taken at parse time.
   *
   * A non-interactive run may cross several gates in one invocation and each needs its own answer,
   * which is why this one flag accumulates where every other is last-wins. See Q-0033.
   */
  readonly gateAnswers: readonly FlagValue[];
}

/**
 * Split `argv` — already sliced past the node executable and the script — into {@link ParsedArgv}.
 *
 * There is no parse error, because the spike has none: an unrecognised shape becomes a flag or a
 * positional, and the command decides what to do with it. Inventing one here would be a behaviour
 * change, not a port.
 */
export function parseArgv(argv: readonly string[]): ParsedArgv {
  const flags: Record<string, FlagValue | FlagValue[]> = {};
  const positional: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token.startsWith('--')) {
      const key = token.slice(2);
      const next = argv[i + 1];
      const value: FlagValue = next && !next.startsWith('--') ? argv[++i] : true;
      if (key === GATE_ANSWER) {
        const seen = flags[key];
        flags[key] = [...(Array.isArray(seen) ? seen : []), value];
      } else {
        flags[key] = value;
      }
    } else {
      positional.push(token);
    }
  }
  const [cmd, ...rest] = positional;
  const answers = flags[GATE_ANSWER];
  return { cmd, rest, flags, gateAnswers: Array.isArray(answers) ? [...answers] : [] };
}
