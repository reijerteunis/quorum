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
/**
 * The flags that take no value, so a token after one of them is a positional and not its value.
 *
 * **Hand-maintained, and the residual is stated rather than hidden**: nothing in this package
 * declares a flag schema, so a new valueless flag is added here by whoever adds it, and one that is
 * forgotten keeps the old behaviour of swallowing the next token. What makes that bounded is
 * `argv.test.ts`, which pins the *effect* for every member — so the set going stale is a missing
 * entry rather than a silent change to the ones that are here. Deriving it would need a schema this
 * frame deliberately does not have (Q-0090 non-goal 13: no argument-parsing library).
 *
 * `gate-answer` is absent on purpose: it takes a value and accumulates, which is the one flag whose
 * repetition is meaningful.
 */
const VALUELESS = new Set(['auto', 'dry', 'help', 'json', 'no-open', 'probe', 'verbose']);

export function parseArgv(argv: readonly string[]): ParsedArgv {
  const flags: Record<string, FlagValue | FlagValue[]> = {};
  const positional: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token.startsWith('--')) {
      const key = token.slice(2);
      const next = argv[i + 1];
      // **A flag that takes no value never consumes the token after it**, which is what stops
      // `quorum runs --json Q-0124` reading the ticket as the flag's value and then listing every
      // run because `rest` is empty. Measured across the real set before this was written:
      // `runs --json <id>`, `board --verbose <id>`, `run --dry <flow> <id>` and `run --auto <flow>
      // <id>` all silently discarded a positional the operator typed.
      //
      // **Not a preserved defect, which is why it is fixed here rather than pinned.** Q-0090 AC-2's
      // preserved behaviours are the single-dash token (4), the bare `--` (5) and the empty-string
      // value (2); none of them is this, and `argv.test.ts`'s clause 2 pins consumption for a flag
      // that genuinely takes a value — `--adapter mock` — which is unchanged. What was never
      // examined is a *valueless* flag meeting a positional. Q-0126 closed one instance inside
      // `open.ts`; this closes the class one layer down, which is where the parser can see it.
      const value: FlagValue = !VALUELESS.has(key) && next && !next.startsWith('--') ? argv[++i] : true;
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
