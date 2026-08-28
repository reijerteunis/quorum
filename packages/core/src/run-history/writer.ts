/**
 * Everything a run writes under `.quorum/runs/<run id>/`, and nothing else in `core` writes there.
 *
 * The subsystem's one rule is that **a run that started is a run that ended**. Initialisation is
 * therefore exclusive and refuses by name before a single byte of a `start` line exists — a refusal
 * thrown after one is how the "run that started and then stopped existing" gap was re-opened inside
 * its own fix — and every terminal path funnels through {@link RunHistory.terminal}, so a signal
 * handler and a run catch can both be pointed at the same set the step path has already finalised.
 *
 * It is drivable without an engine, because the engine does not exist yet: the caller hands over a
 * {@link RunStart} and a {@link RunHistoryHost} and gets a handle back. The host is where warnings
 * go, which is the faithful port rather than a divergence — the spike already injects `ctx.ui.warn`,
 * so a command's output is unchanged and a test can collect what would have been printed.
 *
 * Why: behaviour preserved from spike/src/engine.js:325-450, :625-632 and :744-752 — see
 * `harness/port-charter.md` §2, Q-0049.
 */
import fs from 'node:fs';
import path from 'node:path';

import {
  MANIFEST_FILE, OCCURRENCE_DIR, OUTPUT_FILE, RUNS_LOG_FILE, RUN_HISTORY_ROOT,
  occurrenceDirName, runIdOf,
} from '@quorum/shared';

import { parseFrontmatter } from '../backlog/backlog.js';
import type { TicketRecord } from '../backlog/backlog.js';
import { ensureExcluded } from '../git/git.js';
import { FlowError } from '../lint/lint.js';
import { rollup } from './manifest.js';
import type { Occurrence, OccurrenceKind, RunManifest, RunStatus } from './manifest.js';

/** What a run states about itself before it is allowed to write anything. */
export interface RunStart {
  /** Absolute path of the repository the run history is written into. */
  repoDir: string;
  /**
   * The ticket, as the backlog loaded it. Its `dir` locates `ticket.md` and `runs.log`, and its
   * `meta.stage` is the stage the persisted-stage guard compares the file against.
   */
  ticket: TicketRecord;
  /** The run number this run was allocated — {@link nextRunId}'s answer. */
  run: number;
  /** The flow's `name`. */
  flow: string;
  /** Absolute path of the flow file; the writer relativises it. */
  flowFile: string;
}

/**
 * Where a non-fatal warning goes.
 *
 * A callback rather than a global printer, because what a command prints is externally observable
 * and the spike already injects this channel as `ctx.ui.warn`. A test passes a collector, which is
 * how "the warning must name the failed path" is an assertion rather than a stub of a global.
 */
export interface RunHistoryHost {
  /** One sentence naming what could not be written, and the run continues. */
  warn(message: string): void;
}

/** What a caller knows about an occurrence at the moment it allocates one. */
export interface OccurrenceFields {
  /** The role the step runs as. */
  role?: string | null;
  /** The adapter that runs it — non-null exactly for `kind: 'adapter'`. */
  adapter?: string | null;
  /** The model the step pinned. */
  model?: string | null;
  /** The branch the work happens on. */
  branch?: string | null;
  /**
   * The working directory, **absolute**. The writer relativises it and answers `null` for the
   * repository root, so "persist only project-relative paths" is a property of one function rather
   * than a rule four call sites must not forget.
   */
  worktree?: string | null;
}

/** One run's history on disk, from the moment its directory exists until it is finalised. */
export interface RunHistory {
  /** Absolute path of the run directory. */
  readonly dir: string;
  /** The one in-memory snapshot every replacement serialises; authoritative if a write fails. */
  readonly manifest: RunManifest;
  /**
   * Allocates the next occurrence, creates its directory, and adds it to the run.
   *
   * It allocates only when asked, which is this module's half of "gates and fan-out parents
   * allocate no occurrence" — there is no path here that allocates on its own.
   *
   * @param step the step being performed; only its `id` is read.
   * @param kind what is performing the work.
   * @param fields what the caller already knows, `worktree` absolute.
   */
  allocate(step: { id: string }, kind: OccurrenceKind, fields?: OccurrenceFields): Occurrence;
  /**
   * Ends an occurrence: assigns `fields`, then `status` and `duration_ms`, guarantees its
   * `output.txt`, recomputes the roll-up and replaces the manifest.
   *
   * Calling it twice does nothing the second time, which is what makes the run catch and the signal
   * handler safe to point at an occurrence the step path has already finished.
   *
   * @param occurrence the occurrence to end; one this handle did not allocate is ignored.
   * @param status the terminal status, which `fields` cannot override.
   * @param fields the outcome — `usage`, `error`, `attempts`, `verdict`.
   */
  terminal(occurrence: Occurrence, status: RunStatus, fields?: Partial<Occurrence>): void;
  /**
   * Writes an artifact beside an occurrence, byte for byte.
   *
   * @param occurrence the occurrence whose directory it belongs in.
   * @param name the file name — `prompt.txt` or `output.txt`.
   * @param text the exact bytes, as `String(text)` renders them. A string is written unchanged:
   *   nothing is normalised, trimmed, truncated or re-serialised. It is `unknown` rather than
   *   `string` because the ported conversion is the behaviour — a caller that reaches this from
   *   JavaScript with a string-convertible value writes its text, and does not fail the write.
   */
  persist(occurrence: Occurrence, name: string, text: unknown): void;
  /**
   * Ends the run: `status`, `ended_at`, `duration_ms` and `stage.after`, then the roll-up and the
   * manifest.
   *
   * @param status the run's outcome, whichever of the seven it is.
   * @param stageAfter the stage the ticket was left at.
   */
  finalise(status: RunStatus, stageAfter: string | null): void;
}

/**
 * Each occurrence's monotonic start time, deliberately NOT a field on the occurrence itself.
 *
 * Every occurrence lives in `manifest.steps`, and the whole array is re-serialised on each terminal
 * occurrence — so a bookkeeping field stamped on a *still-running* occurrence reaches
 * `manifest.json` and violates the schema's `additionalProperties: false`. It hid because the old
 * code deleted the field just before its own write: only a sibling finishing first, or a kill in
 * that window, persisted it, and the latter permanently. A side table cannot leak into
 * `JSON.stringify` at all.
 *
 * Why: preserved design, see Q-0034 — a class field, a TypeScript `private` and a symbol-keyed
 * property each reintroduce it.
 */
const occurrenceStart = new WeakMap<Occurrence, number>();

/** A path relative to `root`, POSIX-separated whatever the platform wrote it. */
const relative = (root: string, target: string): string => path.relative(root, target).split(path.sep).join('/');

/** One property off whatever was thrown, or `undefined` when it carried none. */
const errorProperty = (error: unknown, key: 'message' | 'code'): unknown =>
  typeof error === 'object' && error !== null && key in error
    ? (error as Record<string, unknown>)[key]
    : undefined;

/** The `message` of whatever was thrown, rendered as the spike's own message templates render it. */
const messageText = (error: unknown): string => String(errorProperty(error, 'message'));

/**
 * `stage` off a parsed frontmatter block, whatever the YAML held.
 *
 * Deliberately not narrowed to a string: the guard compares the value the file carries, and a
 * damaged file carrying a number must still stop the run rather than read as an absent stage.
 */
const persistedStageOf = (meta: unknown): unknown =>
  typeof meta === 'object' && meta !== null ? (meta as Record<string, unknown>).stage : undefined;

/**
 * Whether an artifact is already there — a **regular file**, and not merely a name in use.
 *
 * `existsSync` answers true for a directory, and a directory called `output.txt` is not the
 * `output.txt` every occurrence is guaranteed. Any other stat failure answers false as well, so the
 * write is attempted and the write's own failure is what warns: this predicate is called from the
 * one funnel every terminal outcome passes through, and it must not be able to throw.
 */
const isExistingFile = (target: string): boolean => {
  try {
    return fs.statSync(target).isFile();
  } catch {
    return false;
  }
};

/**
 * The working directory as the manifest carries it: relative, and `null` for the repository root.
 *
 * `path.relative(root, root)` is the empty string, which the schema refuses — so the root is the
 * `null` case rather than a zero-length path.
 */
const worktreeOf = (repoDir: string, worktree: string | null | undefined): string | null => {
  if (worktree == null) return null;
  const rel = relative(repoDir, worktree);
  return rel === '' ? null : rel;
};

/**
 * The run number to allocate next: one past the highest this ticket has ever used.
 *
 * **Both sources, and this is the point.** `history` gains an entry only when a run completes or
 * regresses, so deriving from it alone hands a failed run's number to the next one and the audit
 * trail cannot tell them apart. `runs.log` is the append-only record of every attempt.
 *
 * @param ticket the ticket, for its folder and its history.
 * @returns 1 where there is neither a log nor a history entry.
 */
export function nextRunId(ticket: TicketRecord): number {
  // `run` is required in the ticket schema and optional here: the fallback is what a hand-written
  // history entry without one gets, and the schema being loose is exactly why one can exist.
  const entries = (ticket.meta.history ?? []) as { run?: number }[];
  const fromHistory = entries.reduce((highest, entry) => Math.max(highest, entry.run ?? 0), 0);
  let fromLog = 0;
  const logPath = path.join(ticket.dir, RUNS_LOG_FILE);
  if (fs.existsSync(logPath)) {
    for (const match of fs.readFileSync(logPath, 'utf8').matchAll(/\brun=(\d+)\b/g)) {
      fromLog = Math.max(fromLog, Number(match[1]));
    }
  }
  return Math.max(fromHistory, fromLog) + 1;
}

/**
 * Creates the run directory, writes the first manifest, and hands back the handle.
 *
 * The order is the contract, not an implementation detail: the persisted-stage guard, then the
 * history root, then the run directory **non**-recursively so that a collision is detected rather
 * than joined, then `steps/`, then the manifest object, then the `.quorum/` exclusion, and only
 * then the first — fatal — write.
 *
 * **A refusal modifies nothing.** After the collision refusal the existing run directory is
 * untouched, and after any of the others no manifest exists at all.
 *
 * @param start what the run is.
 * @param host where a later non-fatal warning goes.
 * @returns the handle every subsequent write goes through.
 * @throws {FlowError} on a stage conflict, a runs root that could not be created, an existing or
 *   uncreatable run directory, or a first write that fails — each naming what it refused, and the
 *   paths in each message POSIX-separated whatever the platform.
 */
export function initialiseRunHistory(start: RunStart, host: RunHistoryHost): RunHistory {
  const started = new Date();
  const { repoDir, ticket } = start;
  const runId = runIdOf(ticket.meta.id, start.run);
  const runsRoot = path.join(repoDir, RUN_HISTORY_ROOT);
  const runDir = path.join(runsRoot, runId);

  // A stale in-memory ticket snapshot must not fork a second timeline once this writer has
  // persisted history. It compares with the ticket FILE rather than with an earlier outcome entry,
  // because a backward edge legitimately makes the current stage differ from the preceding
  // `stage_after`. Not the collision refusal below: a narrower, separate check that happens to fire
  // first, and conflating the two is what let this look implemented when it was not.
  //
  // Why: preserved as-is, see Q-0037 — unreachable from the command line, where every path loads
  // the ticket from the file this re-reads, and reachable from a caller that builds a ticket record
  // itself, which is what the daemon will be.
  const persistedStage = fs.existsSync(runsRoot)
    ? persistedStageOf(parseFrontmatter(fs.readFileSync(path.join(ticket.dir, 'ticket.md'), 'utf8')).meta)
    : null;
  if (persistedStage && persistedStage !== ticket.meta.stage) {
    throw new FlowError(`run directory allocation refused: ticket stage conflicts with persisted run history (${String(persistedStage)} != ${ticket.meta.stage})`);
  }

  // `recursive: true` is satisfied by a directory that already exists, so a failure here is the path
  // not being a directory at all, or the filesystem refusing — never the collision the next refusal
  // describes, whose sentence would send a reader to move the wrong path. It refuses by name for the
  // same reason that one does: an untranslated errno reaches the caller as a stack trace rather than
  // as a sentence it can act on.
  try {
    fs.mkdirSync(runsRoot, { recursive: true });
  } catch (error) {
    throw new FlowError(`run directory allocation refused: could not create ${relative(repoDir, runsRoot)} (${messageText(error)})`);
  }
  try {
    fs.mkdirSync(runDir, { recursive: false });
  } catch (error) {
    // State only what is provable. Ids are allocated from runs.log, whose `start` line is written
    // before this directory is created, so a genuinely concurrent run takes the next id rather than
    // colliding; what is left is a directory outliving its log line, or a sub-second race. This
    // does not make the engine safe for concurrent runs, which is Q-0039 and still open.
    if (errorProperty(error, 'code') === 'EEXIST') {
      throw new FlowError(`run directory allocation refused: ${relative(repoDir, runDir)} already exists. Run ids are allocated from runs.log, so a directory without a matching log line usually means an interrupted run whose runs.log was truncated or restored from an older copy — or a second run started within the same second. Move or delete that directory to re-use the id.`);
    }
    throw new FlowError(`run directory allocation refused: could not create ${relative(repoDir, runDir)} (${messageText(error)})`);
  }
  fs.mkdirSync(path.join(runDir, OCCURRENCE_DIR));

  const manifest: RunManifest = {
    schema_version: 1,
    run_id: runId,
    ticket_id: ticket.meta.id,
    ticket_path: relative(repoDir, path.join(ticket.dir, 'ticket.md')),
    flow: start.flow,
    flow_file: relative(repoDir, start.flowFile),
    stage: { before: ticket.meta.stage, after: null },
    started_at: started.toISOString(),
    ended_at: null,
    duration_ms: null,
    status: 'running',
    steps: [],
    rollup: [],
  };

  let sequence = 0;
  const active = new Set<Occurrence>();

  /**
   * Replaces the manifest atomically: a complete same-directory temporary file, fsynced and closed,
   * then renamed over the target. The sequence is the contract, not merely the outcome, and no
   * successful path writes the manifest in place.
   */
  const replaceManifest = ({ fatal = false } = {}): void => {
    const target = path.join(runDir, MANIFEST_FILE);
    const temporary = `${target}.tmp`;
    let fd: number | undefined;
    try {
      fd = fs.openSync(temporary, 'w');
      fs.writeFileSync(fd, `${JSON.stringify(manifest, null, 2)}\n`);
      fs.fsyncSync(fd);
      fs.closeSync(fd);
      fd = undefined;
      fs.renameSync(temporary, target);
    } catch (error) {
      if (fd != null) {
        try { fs.closeSync(fd); } catch { /* best effort */ }
      }
      if (fatal) throw new FlowError(`could not initialise run history at ${target}: ${messageText(error)}`);
      host.warn(`could not persist run history at ${target}: ${messageText(error)}`);
    }
  };

  const history: RunHistory = {
    dir: runDir,
    manifest,

    allocate(step, kind, fields = {}) {
      const occurrenceDir = occurrenceDirName(++sequence, step.id);
      fs.mkdirSync(path.join(runDir, occurrenceDir));
      const occurrence: Occurrence = {
        step_id: step.id,
        occurrence_dir: occurrenceDir,
        kind,
        role: fields.role ?? null,
        adapter: fields.adapter ?? null,
        model: fields.model ?? null,
        branch: fields.branch ?? null,
        worktree: worktreeOf(repoDir, fields.worktree),
        started_at: new Date().toISOString(),
        duration_ms: null,
        attempts: 0,
        status: 'running',
        verdict: null,
        error: null,
        usage: null,
      };
      occurrenceStart.set(occurrence, Date.now());
      manifest.steps.push(occurrence);
      active.add(occurrence);
      return occurrence;
    },

    terminal(occurrence, status, fields = {}) {
      if (!active.has(occurrence)) return;
      const from = occurrenceStart.get(occurrence);
      Object.assign(occurrence, fields, {
        status,
        duration_ms: from == null ? 0 : Math.max(0, Date.now() - from),
      });
      active.delete(occurrence);
      // The one funnel every outcome passes through, which is why the guaranteed `output.txt` lives
      // here rather than in each writer of one: every previous writer sat behind something that
      // could throw first. Guarded like `persist`, so a broken history directory warns and never
      // discards a step the vendor has already billed.
      const outputPath = path.join(runDir, occurrence.occurrence_dir, OUTPUT_FILE);
      if (!isExistingFile(outputPath)) {
        try {
          fs.writeFileSync(outputPath, '');
        } catch (error) {
          host.warn(`could not persist run history at ${outputPath}: ${messageText(error)}`);
        }
      }
      // Whole-list, and therefore quadratic in occurrence count.
      // Why: preserved, see Q-0037 — reported rather than optimised in passing.
      manifest.rollup = rollup(manifest.steps);
      replaceManifest();
    },

    persist(occurrence, name, text) {
      const target = path.join(runDir, occurrence.occurrence_dir, name);
      try {
        // Exactly the bytes it was given, and nothing else done to them: an occurrence's
        // `prompt.txt` and `output.txt` are what was sent and what came back. `String` is the
        // ported conversion rather than a formality — `writeFileSync` throws on a value that is not
        // a string or a buffer, so narrowing it away would turn a JavaScript caller's artifact into
        // a lost one.
        fs.writeFileSync(target, String(text));
      } catch (error) {
        host.warn(`could not persist run history at ${target}: ${messageText(error)}`);
      }
    },

    finalise(status, stageAfter) {
      const ended = new Date();
      manifest.status = status;
      manifest.ended_at = ended.toISOString();
      // The same `Date` that produced `started_at`. Two clock readings would differ by a
      // millisecond and fail the semantic pass, which requires the identity exactly. The clamp is
      // preserved, so a backwards clock surfaces there rather than as a negative number here.
      manifest.duration_ms = Math.max(0, ended.getTime() - started.getTime());
      manifest.stage = { before: manifest.stage.before, after: stageAfter };
      manifest.rollup = rollup(manifest.steps);
      replaceManifest();
    },
  };

  ensureExcluded(repoDir, '.quorum/');
  replaceManifest({ fatal: true });
  return history;
}
