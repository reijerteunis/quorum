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
 * **It is `async` and it awaits what it dispatched to**, because `spike/bin/harness.js:569` is
 * `main().catch(…)`: the uncaught-rejection path is part of what this frame preserves, and it needs
 * a promise to attach to. The spike's `run` case awaits the engine inside `main`'s own body, so a
 * failing command reaches that `catch`; a dispatch that called a handler without awaiting would
 * resolve `main` first and leave the rejection detached, where Node's unhandled-rejection path
 * prints it instead of `fail.ts`'s `dieOnUnexpected`. The binary that wires the two together does
 * not exist yet — a `bin` target is Q-0096's, together with everything else about making this
 * workspace emit JavaScript.
 *
 * **No command is implemented here**, and six now exist beside it: `lint` and `validate` are
 * Q-0091's, `runs` is Q-0092's, `init` and `ticket` are Q-0093's, and `run` — with the gate reader
 * and the signal handler under it — is Q-0094's, each in one module of its own, dispatched through
 * {@link HANDLERS}. `board` and `adapters` are Q-0099's.
 */
import { parseArgv, type ParsedArgv } from './argv.js';
import { COMMANDS, HELP, isCommand, type Command } from './commands.js';
import { init } from './init.js';
import { lint } from './lint.js';
import { run } from './run.js';
import { runs } from './runs.js';
import { ticket } from './ticket.js';
import { validate } from './validate.js';

/**
 * What one command does with a parsed command line.
 *
 * It is handed the whole {@link ParsedArgv} because the spike's eight cases read `cmd`, `rest`,
 * `flags` and `gateAnswers` out of module scope (`spike/bin/harness.js:40–42`), so every one of them
 * sees all four. A handler given only its own name would leave Q-0091 to Q-0094 either parsing argv
 * a second time or widening this contract, which is the duplication the frame exists to prevent.
 *
 * It may return a promise, and {@link main} awaits it: `run` is asynchronous, and a command's
 * failure has to arrive at `main().catch(dieOnUnexpected)` rather than as a detached rejection.
 */
export type CommandHandler = (argv: ParsedArgv) => void | Promise<void>;

/**
 * What each command does.
 *
 * Keyed by {@link Command}, so the table and {@link COMMANDS} cannot drift: a handler added without
 * its name fails to compile, and a name added without its handler fails to compile too. That is the
 * coupling `commands.test.ts` relies on when it checks the help against the same set.
 *
 * Exported because it is the frame's registry rather than an implementation detail: Q-0091 to
 * Q-0094 each add their entry to it, and `main.test.ts` reaches through it to exercise the dispatch
 * — that a handler receives the parsed command line, and that an asynchronous one is waited for —
 * over the registered set rather than over a command written for the test.
 */
export const HANDLERS: Readonly<Record<Command, CommandHandler>> = {
  help: () => {
    console.log(HELP);
  },
  init,
  ticket,
  run,
  lint,
  validate,
  runs,
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
  const parsed = parseArgv(argv);
  const { cmd } = parsed;
  if (cmd !== undefined && isCommand(cmd)) {
    await HANDLERS[cmd](parsed);
    return;
  }
  console.log(HELP);
}
