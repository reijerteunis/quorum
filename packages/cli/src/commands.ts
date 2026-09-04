/**
 * The set of commands the frame dispatches, and the help text that lists them.
 *
 * **The help is owned data.** `spike/bin/harness.js:561` produces it by reading the binary's own
 * source file — `fs.readFileSync(fileURLToPath(import.meta.url))`, lines 1 to 10, with `// `
 * stripped. That mechanism cannot survive a build under any emit strategy, because emitted
 * JavaScript does not carry the comment block at those line numbers, so it is replaced here rather
 * than left to arrive as a surprise inside Q-0096.
 *
 * **The list holds only what the frame dispatches.** Listing the eight commands the spike has would
 * be a green tick over a subject that does not exist: an unregistered one falls through to this same
 * text and exits 0, so the invocation would look like success for a command that is not there.
 * Q-0091 to Q-0094 each add their line as their command lands, preserving the spike header's wording
 * and ordering at that point. `commands.test.ts` derives the names out of {@link HELP} and refuses
 * one that is not in {@link COMMANDS}.
 *
 * **Q-0091 adds `lint` and `validate`**, in the spike header's own relative order (`:6` and `:8`).
 * `help` keeps the first line it has held since Q-0090 because the spike's header has no such line
 * at all, so no ordering of that file's is being changed; `board`, `adapters`, `init`, `ticket` and
 * `run` insert around them as their own tickets land.
 *
 * **Q-0092 adds `runs`, last**, because `spike/bin/harness.js:10` is the last line of that header
 * and this file preserves its ordering wherever the spike has one.
 *
 * **Q-0093 adds `init` and `ticket`, above `lint`**, for the same reason: `spike/bin/harness.js:3`
 * and `:4` precede `:7`, so the two writing commands insert rather than append. `board`, `adapters`
 * and `run` are the three still to arrive, and each takes its own place in that order.
 *
 * **Q-0094 adds `run`, between `ticket` and `lint`**, which is the spike header's own order:
 * `spike/bin/harness.js:6` is `run` and `:7` is `lint`. `board` and `adapters` are the two still to
 * arrive, and Q-0099 inserts each at its place in that order.
 */

/** Every command name {@link HELP} may mention and the frame's dispatch table must handle. */
export const COMMANDS = ['help', 'init', 'ticket', 'run', 'lint', 'validate', 'runs'] as const;

/** One of {@link COMMANDS}. */
export type Command = (typeof COMMANDS)[number];

/** Whether `name` is a command the frame dispatches. */
export const isCommand = (name: string): name is Command =>
  COMMANDS.some((command) => command === name);

/**
 * What `quorum`, `quorum --help` and any unrecognised command print.
 *
 * The product is Quorum and the binary is `quorum`; neither is called a harness, which
 * `.claude/rules/product-boundaries.md` forbids and the spike's own header does. That is not a fix
 * for Q-0068 — whose subject is the BYOS refusal string in the adapters — but new text written
 * correctly the first time. Each line carries the *information* of the spike header's counterpart
 * — what the command takes and what it does — rewritten rather than transcribed for that reason.
 */
export const HELP = `quorum — Quorum's command line.

usage: quorum <command> [options]

commands:
  quorum help                             print this message
  quorum init [dir]                       copy the shipped templates into <dir>/harness/ and create backlog/
  quorum ticket new "<title>"             create a ticket at the backlog's next id [--intent --owner --id]
  quorum run <flow> <ticket>              run a flow [--auto --dry --base --adapter --verbose --gate-answer]; exits 2 aborted, 3 gate unanswered
  quorum lint                             lint the whole flow directory (structure + cross-flow edges)
  quorum validate <schema.json> <file…>   check artifacts against a contract; exit 1 on failure
  quorum runs [ticket|run-id] [--json]    run history: list, filter by ticket, or show one run`;
