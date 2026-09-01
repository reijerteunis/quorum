/**
 * The frame's entry: parse the command line, dispatch, and leave the exit status alone.
 *
 * **It returns nothing rather than a code**, which is the spike's shape and not an oversight. A
 * `main` returning a number would have to be spent as `process.exit(main(argv))`, and that call
 * overrides `process.exitCode` — collapsing the two mechanisms `fail.ts` exists to keep apart, and
 * losing the output the soft path is there to preserve. So a command that must stop now calls
 * `die`, a command that failed but has more to say calls `failSoftly`, and everything else returns
 * and lets the process exit on its own status. See Q-0090 AC-5.
 *
 * **It is `async` with nothing to await**, because `spike/bin/harness.js:569` is
 * `main().catch(…)`: the uncaught-rejection path is part of what this frame preserves, and it needs
 * a promise to attach to. The binary that wires the two together does not exist yet — a `bin`
 * target is Q-0096's, together with everything else about making this workspace emit JavaScript.
 *
 * **No command is implemented here.** `board`, `lint`, `validate` and `adapters` are Q-0091's;
 * `runs` is Q-0092's; `init` and `ticket` are Q-0093's; `run` and its gate reader are Q-0094's.
 */
import { parseArgv } from './argv.js';
import { COMMANDS, HELP, isCommand, type Command } from './commands.js';

/**
 * What each command does.
 *
 * Keyed by {@link Command}, so the table and {@link COMMANDS} cannot drift: a handler added without
 * its name fails to compile, and a name added without its handler fails to compile too. That is the
 * coupling `commands.test.ts` relies on when it checks the help against the same set.
 */
const HANDLERS: Readonly<Record<Command, () => void>> = {
  help: () => {
    console.log(HELP);
  },
};

/**
 * Run one command line. `argv` is `process.argv.slice(2)` when a binary calls it, and a literal
 * array when a test does — the parser reads nothing from the environment, so the two are the same.
 *
 * An unknown or absent command prints the help and returns, so the process exits 0. Why: preserved,
 * see Q-0090 AC-6 — `spike/bin/harness.js:560–562` is a `default:` branch that prints usage and
 * returns. It is registered as a defect rather than carried quietly: a shell script cannot tell
 * "did the thing" from "did not understand you". The successor is Q-0090's GA-4.
 */
export async function main(argv: readonly string[]): Promise<void> {
  const { cmd } = parseArgv(argv);
  if (cmd !== undefined && isCommand(cmd)) {
    HANDLERS[cmd]();
    return;
  }
  console.log(HELP);
}
