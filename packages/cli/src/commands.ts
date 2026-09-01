/**
 * The set of commands the frame dispatches, and the help text that lists them.
 *
 * **The help is owned data.** `spike/bin/harness.js:561` produces it by reading the binary's own
 * source file — `fs.readFileSync(fileURLToPath(import.meta.url))`, lines 1 to 10, with `// `
 * stripped. That mechanism cannot survive a build under any emit strategy, because emitted
 * JavaScript does not carry the comment block at those line numbers, so it is replaced here rather
 * than left to arrive as a surprise inside Q-0096.
 *
 * **The list holds only what the frame dispatches**, which today is the help itself. Listing the
 * eight commands the spike has would be a green tick over a subject that does not exist: every one
 * of them would fall through to this same text and exit 0, so an invocation would look like success
 * for a command that is not there. Q-0091 to Q-0094 each add their line as their command lands,
 * preserving the spike header's wording and ordering at that point. `commands.test.ts` derives the
 * names out of {@link HELP} and refuses one that is not in {@link COMMANDS}.
 */

/** Every command name {@link HELP} may mention and the frame's dispatch table must handle. */
export const COMMANDS = ['help'] as const;

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
 * correctly the first time.
 */
export const HELP = `quorum — Quorum's command line.

usage: quorum <command> [options]

commands:
  quorum help                             print this message`;
