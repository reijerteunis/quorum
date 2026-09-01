/**
 * Every status this CLI can exit with, in one place, plus the map from a run's terminal status to
 * the code that reports it.
 *
 * The spike decides these in nine places — `die` at `spike/bin/harness.js:124`, the two
 * `process.exit(ok ? 0 : 1)` pairs at `:404` and `:460`, the lint preflight at `:548`, the
 * three-way expression at `:557`, four `process.exitCode = 1` assignments on the `runs` paths, and
 * the engine's own `process.exit(130)` at `spike/src/engine.js:111`. A shell script wrapping
 * `quorum run` reads one number and has to be told what it means, so the meanings are owned here
 * rather than re-decided by each command as it is ported.
 */
import type { RunTerminalEvent } from '@quorum/shared';

/** The command did what it was asked, and a run that finished did not abort. */
export const SUCCESS = 0;

/** Something went wrong: a bad argument, a missing project, an unreadable file, a failed run. */
export const ERROR = 1;

/** A human was there and chose to stop the run. */
export const ABORTED = 2;

/**
 * Nobody was there: the run reached a gate for which no answer was available.
 *
 * Distinct from {@link ERROR} on purpose — somebody who supplied a word that is not an answer *was*
 * there, and that stays an error. See Q-0040, and "A run nobody answered is undecided, and keeps
 * the branch it proved" (2026-09-01).
 */
export const UNDECIDED = 3;

/**
 * The run was interrupted by a signal, reported as the shell convention 128 + SIGINT.
 *
 * A row of this table and nothing more: `core` installs no signal handler (Q-0050 AC-5), and the
 * handler that produces this code is Q-0094's to place. See Q-0090 AC-4(d).
 */
export const SIGNAL = 130;

/** Every code this CLI is allowed to exit with, so a sixth one cannot be written by accident. */
export type ExitCode =
  | typeof SUCCESS
  | typeof ERROR
  | typeof ABORTED
  | typeof UNDECIDED
  | typeof SIGNAL;

/**
 * What each terminal run status exits with.
 *
 * Keyed by `RunTerminalEvent['status']` so a seventh status added to `@quorum/shared`'s terminal
 * event fails to compile here rather than falling through to {@link SUCCESS} — which is exactly how
 * `regressed` came to share `completed`'s code. `packages/shared`'s union is the authority and this
 * is a reader of it; `exit.test.ts` derives the key set from that schema rather than transcribing
 * it.
 */
export const EXIT_CODE_FOR_STATUS: Readonly<Record<RunTerminalEvent['status'], ExitCode>> = {
  completed: SUCCESS,
  // Why: preserved defect, see Q-0090 AC-4(c). `spike/bin/harness.js:557` names only `aborted` and
  // `undecided`, so `regressed` reaches the fallthrough and reports success. Registered rather than
  // fixed, and routed to Q-0090's GA-4 successor together with the unknown-command zero.
  regressed: SUCCESS,
  aborted: ABORTED,
  undecided: UNDECIDED,
  failed: ERROR,
  interrupted: SIGNAL,
};
