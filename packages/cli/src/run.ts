/**
 * `quorum run <flow> <ticket>` — the command the product exists for.
 *
 * **It consumes a stream where its five siblings call a function.** `runFlow` returns a lazy,
 * single-consumer `AsyncIterable<Event>` (Q-0050's one authorised behaviour change), so this module
 * renders the trace itself through `trace.ts`, answers gates out of band through `gate.ts`, and
 * reads the run's outcome off the final `terminal` event rather than off a returned value. The
 * spike's `ui` object had all three jobs (`spike/bin/harness.js:63–127`); the mapping between the
 * two shapes is Q-0094's Appendix B.
 *
 * **It owns the signal handler, because `core` installs none** (Q-0050 AC-5, `engine/types.ts`).
 * `spike/src/engine.js:113–114` registers `SIGINT` and `SIGTERM` and exits 130 inside the handler;
 * here the handler aborts the `AbortController` whose signal `runFlow` was given, and the run ends
 * `interrupted` through `core`'s own path so the terminal record and the run history survive. The
 * handlers are installed when the run starts and removed when it ends, never at module scope —
 * `frame.source.test.ts`'s AC-4(d) block names this file by identity and counts listeners before and
 * after loading the package to prove it.
 *
 * **The exit code is the terminal event's, through the table that already exists.**
 * {@link EXIT_CODE_FOR_STATUS} was extracted from `spike/bin/harness.js:557`'s three-way expression
 * for exactly this call site, so a second table or an inline ternary here would be that expression
 * spelled twice. 3 for `undecided` is the code a script reads to tell "nobody was there" from "I
 * chose to stop this" (2) and from "it failed" (1) — see Q-0040.
 */
import path from 'node:path';

import {
  FlowError, IntegrationError, lintDirectory, loadFlowByName, loadProject, overrideAdapters,
  ProjectNotFoundError, runFlow,
} from '@quorum/core';
import type { Event, RunTerminalEvent } from '@quorum/shared';

import type { FlagValue } from './argv.js';
import { EXIT_CODE_FOR_STATUS, ERROR, type ExitCode } from './exit.js';
import { die } from './fail.js';
import { createGateReader, type GateReader } from './gate.js';
import { renderFlowReport } from './lint.js';
import type { CommandHandler } from './main.js';
import { renderEvent } from './trace.js';

/**
 * The usage line, preserved verbatim from `spike/bin/harness.js:536`.
 *
 * Why: preserved — it says `harness`, which the binary is not called. Q-0100 owns that class and
 * this is its fifth instance, after the three in that ticket's body and Q-0093's `init` next-steps
 * line; `validate.ts:62` and `ticket.ts:68` both keep theirs, so spelling this one `quorum` would
 * make one command disagree with its two neighbours while pre-empting the ruling.
 */
const USAGE = 'usage: harness run <flow> <ticket> [--auto] [--dry] [--base <ref>] [--adapter mock]'
  + ' [--verbose] [--gate-answer advance|retry|abort]';

/** What driving one run's event stream produced. */
export interface RunTrace {
  /** The last `terminal` event seen, or `undefined` where the stream produced none. */
  readonly terminal: RunTerminalEvent | undefined;
  /**
   * How the stream closed: `null` where it ended cleanly, and otherwise what it threw.
   *
   * Wrapped rather than reported as `unknown | undefined`, because a run may legitimately close
   * with a thrown `undefined` and that is still a failure.
   */
  readonly closed: { readonly error: unknown } | null;
}

/**
 * Render every event of one run and cue the gate reader, in one asynchronous iteration.
 *
 * **Nothing in the body awaits**, and that is R-5 rather than a style: `runFlow` is lazy and
 * single-consumer, so a loop that stopped pulling to await an answer would deadlock the gate it was
 * waiting on. The answer travels out of band through {@link GateReader.answerGate}; all this loop
 * owes a gate is the banner, and {@link GateReader.announce} is how it says the banner is out.
 *
 * **It returns the closing error rather than throwing it**, so a caller has the terminal event
 * *and* the failure. The channel drains before it rejects (`packages/core/src/engine/channel.ts`),
 * which is what makes both available at once; a `for await` that threw would leave the terminal
 * event on the floor and take AC-10(4)'s interrupted branch with it.
 *
 * Exported so AC-9(2) has a subject: no `runFlow` ends without a terminal event, so the only way to
 * show {@link exitCodeFor} refusing to report success over an absent outcome is to hand this
 * function a stream that does.
 */
export async function consumeRun(
  events: AsyncIterable<Event>,
  reader: GateReader,
  verbose: boolean,
): Promise<RunTrace> {
  let terminal: RunTerminalEvent | undefined;
  try {
    for await (const event of events) {
      renderEvent(event, verbose);
      if (event.type === 'gate') reader.announce(event.gateId);
      if (event.type === 'terminal') terminal = event;
    }
  } catch (error) {
    return { terminal, closed: { error } };
  }
  return { terminal, closed: null };
}

/**
 * The code one run's terminal event earns, or a hard failure where the stream produced none.
 *
 * A terminal event is required and never inferred: an iterable that merely finished says nothing
 * about what the run concluded, and exiting 0 on it would be a silent false green — the one failure
 * mode the exit-code contract cannot survive. Q-0094 AC-9(2).
 */
export function exitCodeFor(terminal: RunTerminalEvent | undefined): ExitCode {
  if (terminal === undefined) {
    return die('the run produced no terminal event, so its outcome is unknown — not reported as success');
  }
  return EXIT_CODE_FOR_STATUS[terminal.status];
}

/** Where the gate reader reads from and prompts, and how it decides a human is there. */
export interface GateTerminal {
  input?: NodeJS.ReadableStream;
  output?: NodeJS.WritableStream;
  isTTY?: () => boolean;
}

/**
 * `quorum run …`, with the terminal its gate reader speaks to supplied rather than assumed.
 *
 * {@link run} is this with the process's own streams, which is every invocation outside a test.
 * The parameter exists because three of the reader's five sites are reachable only when stdin is a
 * terminal, and the spike reaches them by spawning the binary under a preload that sets
 * `process.stdin.isTTY` — a route this package may not take (see `gate.ts`).
 */
export function runOn(terminal: GateTerminal): CommandHandler {
  // Three of `ParsedArgv`'s four fields, because `cmd` is the key this handler was reached through:
  // `main.ts` dispatches `HANDLERS[cmd](parsed)`, so it is `'run'` by construction here and binding
  // it would be a dead name rather than a read. Q-0091's AC-2 is the precedent for which half of
  // AC-1(3) binds — no command re-parses the command line, which `frame.source.test.ts` enforces —
  // and `main.test.ts` pins all four fields arriving, `cmd` among them.
  return async ({ rest, flags, gateAnswers }) => {
    const [flowName, ticketId] = rest;
    if (!flowName || !ticketId) die(USAGE);
    // A bare `--base` parses to `true`: it names no revision, so it is refused rather than coerced
    // into the string "true" and interpolated into a diff range. Refused here, beside the other
    // argument validation and before any project is opened, so a malformed command fails before
    // anything is read from disk. Why: preserved, see `spike/bin/harness.js:539` and Q-0077 B5.
    const base = flags.base;
    if (base === true) die('--base needs a revision: harness run <flow> <ticket> --base <ref>');

    const project = openProject(flags.project);
    // Fresh from disk, before the ticket is loaded, before anything is written, and before
    // `--adapter` rewrites any step's adapter in memory — a directory that declares a legitimate
    // cross-vendor panel must not appear single-vendor because execution later overrides every step
    // to the same adapter. Why: preserved, see `spike/bin/harness.js:543–548` and Q-0033.
    const { ok, records } = lintDirectory(path.join(project.harnessDir, 'flows'));
    if (!ok) {
      for (const record of records) console.log(renderFlowReport(record));
      // The spike prints the report and stops, with no `✗` line of its own — `die` would add one it
      // never printed. Hard rather than soft: nothing further is worth running.
      process.exit(ERROR);
    }
    const flow = loadFlowByName(flowName, project.harnessDir);
    if (flags.adapter) {
      // `flags.adapter` is `FlagValue`, so a valueless `--adapter` is the boolean `true` and every
      // declaring step is pointed at it. Why: preserved defect — the spike refuses no such thing
      // (`spike/bin/harness.js:550`), and inventing a second refusal beside `--base`'s would be a
      // behaviour change on a flag a script may already pass.
      const name = flags.adapter as string;
      overrideAdapters(flow, name);
      project.config.adapterOverride = name;
    }
    const ticket = project.backlog.read(ticketId);

    const cancellation = new AbortController();
    // The reader is given the same signal the engine gets, because an interrupt has to reach a
    // reader parked on a question: `SIGINT` arrives at readline as its own event and `SIGTERM`
    // arrives nowhere, so without this the handle would outlive the run. Q-0094 AC-7(7).
    const reader = createGateReader({ answers: gateAnswers, signal: cancellation.signal, ...terminal });
    // The reason is a STRING and is load-bearing: `interruptionNote`
    // (`packages/core/src/engine/engine.ts:161–165`) reads `signal.reason` only when it is a
    // non-empty string, and that is how the spike's `received SIGINT` note reaches `runs.log`.
    // Aborting with nothing, or with an `Error`, silently substitutes the thrown message.
    const onSigint = (): void => cancellation.abort('received SIGINT');
    const onSigterm = (): void => cancellation.abort('received SIGTERM');
    process.on('SIGINT', onSigint);
    process.on('SIGTERM', onSigterm);
    let trace: RunTrace;
    try {
      trace = await consumeRun(runFlow({
        flow,
        ticket,
        // `Project` carries its backlog as a member and the options want both by name, so the
        // spike's `...proj` spread does not port.
        project,
        backlog: project.backlog,
        dry: Boolean(flags.dry),
        auto: Boolean(flags.auto),
        answerGate: reader.answerGate,
        signal: cancellation.signal,
        ...(typeof base === 'string' ? { base } : {}),
      }), reader, Boolean(flags.verbose));
    } finally {
      process.off('SIGINT', onSigint);
      process.off('SIGTERM', onSigterm);
    }

    if (trace.closed === null) process.exit(exitCodeFor(trace.terminal));
    // An interrupted run has already printed its own line and its terminal record is written; the
    // throw that follows it is the engine's rethrow of the cancellation and is not a message a
    // maintainer needs. The spike prints no `✗` here either, because its `process.exit(130)` fires
    // inside the signal handler before the throw propagates (`spike/src/engine.js:106–114`).
    if (trace.terminal?.status === 'interrupted') process.exit(EXIT_CODE_FOR_STATUS.interrupted);
    const { error } = trace.closed;
    // One red sentence and exit 1, with no stack — including for a failure raised before any
    // terminal event, which is the stage precondition at `engine.ts:189–191`. Anything else is
    // rethrown so `main().catch(dieOnUnexpected)` prints its stack, which is what a bad `--adapter`
    // name gets: the adapter registry raises a plain `Error` for a name it does not know. Why:
    // preserved, see `spike/bin/harness.js:559`.
    if (error instanceof FlowError || error instanceof IntegrationError) die(error.message);
    throw error;
  };
}

/**
 * The project this run is against, or the spike's sentence and a hard exit where none is there.
 *
 * `loadProject` throws where the CLI's own version called `die`; uncaught, the sentence would reach
 * `dieOnUnexpected` and print a Node stack. `lint.ts` catches it the same way and for the same
 * reason, and the message is `core`'s byte for byte, `harness` included.
 */
function openProject(project: FlagValue | readonly FlagValue[] | undefined): ReturnType<typeof loadProject> {
  try {
    return loadProject(project as string | undefined);
  } catch (error) {
    if (!(error instanceof ProjectNotFoundError)) throw error;
    return die(error.message);
  }
}

/** `quorum run <flow> <ticket> …` against this process's own terminal. */
export const run: CommandHandler = runOn({});
