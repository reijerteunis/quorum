/**
 * Reading `.quorum/runs/` back — and writing nothing at all.
 *
 * "It never repairs or infers persisted state" is the reader contract's first paragraph, and this
 * being a file of its own is what turns that sentence into a property: it reaches for no filesystem
 * write of any kind, and it does not import `./writer.js`, so a daemon can read history without
 * linking the code that creates directories. An incomplete run is reported as it stands; a stray
 * temporary file beside a manifest is left where it is; a missing field is not defaulted.
 *
 * **Parsing is not validity.** A manifest of `{}` parses, and used to render as a run with every
 * field blank while a type mismatch deeper in took the whole listing — valid siblings included —
 * down with it. {@link manifestShapeError} proves only enough to sort and render; full conformance
 * stays `harness validate`'s job against the frozen contract.
 *
 * Why: behaviour preserved from spike/bin/harness.js:130-200 and :547-554 — see
 * `harness/port-charter.md` §§2 and 7, Q-0049.
 */
import fs from 'node:fs';
import path from 'node:path';

import { MANIFEST_FILE, OCCURRENCE_DIR } from '@quorum/shared';

import type { RunManifest, VendorRollup } from './manifest.js';

/**
 * What a run id looks like when a human types one at a command line: anchored and case-sensitive,
 * so `q-0011` and `Q-11` are not ticket ids.
 */
export const TICKET_ID_PATTERN = /^[A-Z]+-[0-9]{4}$/;

/** Where {@link occurrenceSeq} finds an occurrence's sequence number. */
const OCCURRENCE_SEQUENCE = new RegExp(`^${OCCURRENCE_DIR}/(\\d+)-`);

/** One run found under the runs root, with the document that was read for it. */
export interface RunEntry {
  /** The run directory's name, which is also the manifest's `run_id` on any manifest we wrote. */
  runId: string;
  /** Absolute path of the manifest that was read. */
  manifestPath: string;
  /**
   * The parsed document.
   *
   * A cast, never a check: {@link manifestShapeError} has proved five things about it and nothing
   * more, so a hand-edited file can still carry a field of the wrong type. That is deliberate —
   * refusing one here would make a listing fail on a sibling's damage, which is the defect the
   * per-entry `try` below exists to prevent.
   */
  manifest: RunManifest;
}

/** One run the listing could not read, and why. */
export interface RunWarning {
  /** The run directory's name. */
  runId: string;
  /** One sentence: a shape error, a missing manifest, or a parse failure with the parser's own words. */
  message: string;
}

/** One property off whatever was thrown, or `undefined` when it carried none. */
const errorProperty = (error: unknown, key: 'message' | 'code'): unknown =>
  typeof error === 'object' && error !== null && key in error
    ? (error as Record<string, unknown>)[key]
    : undefined;

/** The `message` of whatever was thrown, rendered as the spike's own message templates render it. */
const messageText = (error: unknown): string => String(errorProperty(error, 'message'));

/**
 * Resolves symlinks, and answers `null` when the path does not exist or cannot be resolved.
 *
 * The filesystem half of the confinement guard: `path.resolve` does no filesystem work at all, so a
 * lexical comparison cannot see through a link.
 */
const realPath = (target: string): string | null => {
  try {
    return fs.realpathSync(target);
  } catch {
    return null;
  }
};

/**
 * Enough shape to sort and render a run, and no more.
 *
 * @param manifest whatever `JSON.parse` produced.
 * @returns one of four sentences, or `null` when the document is usable.
 */
export function manifestShapeError(manifest: unknown): string | null {
  if (manifest === null || typeof manifest !== 'object' || Array.isArray(manifest)) return `${MANIFEST_FILE} is not an object`;
  const document = manifest as Record<string, unknown>;
  const missing = ['run_id', 'ticket_id', 'status'].filter((key) => typeof document[key] !== 'string');
  if (missing.length) return `${MANIFEST_FILE} is missing or mistyped: ${missing.join(', ')}`;
  if (!Array.isArray(document.steps)) return `${MANIFEST_FILE} steps is not an array`;
  if (!Array.isArray(document.rollup)) return `${MANIFEST_FILE} rollup is not an array`;
  return null;
}

/**
 * Every run under `runsRoot`, and every reason one could not be read.
 *
 * Each manifest is parsed inside its own `try`, so one damaged sibling cannot take a listing down.
 * A missing root is not a warning — it is a store that has never been written to.
 *
 * @param runsRoot absolute path of `.quorum/runs`.
 * @returns the runs in directory order, unsorted; {@link sortRuns} decides the order.
 */
export function readRunsDir(runsRoot: string): { runs: RunEntry[]; warnings: RunWarning[] } {
  const runs: RunEntry[] = [];
  const warnings: RunWarning[] = [];
  if (!fs.existsSync(runsRoot)) return { runs, warnings };
  // `withFileTypes` gives `lstat` semantics, so a symlink to a sibling run directory is skipped
  // from a listing in silence while `resolveRunDirectory` accepts it. Two answers to one question.
  // Why: preserved, see Q-0049 AC-13 — reported rather than reconciled in passing.
  for (const entry of fs.readdirSync(runsRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const runId = entry.name;
    const manifestPath = path.join(runsRoot, runId, MANIFEST_FILE);
    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as RunManifest;
      const shape = manifestShapeError(manifest);
      if (shape) warnings.push({ runId, message: shape });
      else runs.push({ runId, manifestPath, manifest });
    } catch (error) {
      const missing = errorProperty(error, 'code') === 'ENOENT';
      warnings.push({ runId, message: missing ? `missing ${MANIFEST_FILE}` : `malformed ${MANIFEST_FILE} (${messageText(error)})` });
    }
  }
  return { runs, warnings };
}

/**
 * Newest first, then by `run_id` ascending in **plain string order** — which is why, with equal
 * timestamps, `Q-0011-10` precedes `Q-0011-2`. Deliberate, and pinned.
 *
 * @param runs the entries to order; neither the array nor the manifests in it are mutated.
 * @returns a new array.
 */
export function sortRuns(runs: readonly RunEntry[]): RunEntry[] {
  /** What the ordering reads, as a document that has only passed {@link manifestShapeError} may carry it. */
  type Ordered = { started_at?: string | null; run_id?: string | null };
  const ordered = (entry: RunEntry): Ordered => entry.manifest as Ordered;
  return [...runs].sort((a, b) => {
    const sa = ordered(a).started_at ?? '';
    const sb = ordered(b).started_at ?? '';
    if (sa !== sb) return sa < sb ? 1 : -1;
    const ra = ordered(a).run_id ?? a.runId;
    const rb = ordered(b).run_id ?? b.runId;
    return ra < rb ? -1 : ra > rb ? 1 : 0;
  });
}

/**
 * Whether a run never reached a terminal state — `running`, or no `ended_at`.
 *
 * A kill outright leaves exactly that on disk, and it is reported rather than repaired: nothing in
 * this module completes, deletes or terminalises an incomplete run.
 */
export function isIncomplete(manifest: RunManifest): boolean {
  return manifest.status === 'running' || manifest.ended_at == null;
}

/**
 * An occurrence's sequence number, for ordering a run's steps.
 *
 * @param occurrenceDir the occurrence's `steps/NNN-…` path.
 * @returns the number, or `Number.MAX_SAFE_INTEGER` when it cannot be read — so an unparseable
 *   entry sorts last rather than first.
 */
export function occurrenceSeq(occurrenceDir: string | null | undefined): number {
  const match = OCCURRENCE_SEQUENCE.exec(occurrenceDir ?? '');
  return match ? parseInt(match[1], 10) : Number.MAX_SAFE_INTEGER;
}

/**
 * One roll-up row's token total: input plus output over the values actually reported.
 *
 * **The cache measures are a breakdown and never summands.** The adapter has already folded both of
 * them into `input_tokens` before a manifest sees one, so adding them back double-counts — roughly
 * a 35% overstatement of the M0 figures, in the one number run history exists to report. The
 * fixture that missed it left both cache fields null.
 *
 * @returns the sum, or `null` only when **both** totals are null.
 */
export function vendorTokenTotal(row: VendorRollup): number | null {
  const parts = [row.input_tokens, row.output_tokens].filter((value): value is number => value != null);
  return parts.length ? parts.reduce((a, b) => a + b, 0) : null;
}

/**
 * The directory a run id token names, or `null` if it names anything else.
 *
 * A run id names a directory **directly inside** the runs root and nothing else. Joining a raw token
 * let `..`, a leading `/` or an absolute path walk out of it — every directory on the filesystem
 * holding a `manifest.json` was then accepted as a run, and the parsed document was echoed back.
 *
 * **Lexical confinement is necessary and not sufficient.** `path.resolve` does no filesystem work
 * and `statSync` follows links, so a single-segment symlink inside the runs root passes every string
 * test and still reads a manifest anywhere on disk. Both sides are resolved for real and the results
 * compared, and the caller reads the manifest from the path returned here rather than from the
 * lexical one.
 *
 * @param runsRoot absolute path of `.quorum/runs`.
 * @param token the run id as it was typed.
 * @returns the resolved directory, or `null` — which discloses nothing about what the token pointed
 *   at.
 */
export function resolveRunDirectory(runsRoot: string, token: string): string | null {
  if (token !== path.basename(token) || ['', '.', '..'].includes(token)) return null;
  const realRoot = realPath(runsRoot);
  const realDir = realPath(path.resolve(path.resolve(runsRoot), token));
  if (realRoot == null || realDir == null) return null;
  if (path.dirname(realDir) !== realRoot) return null;
  if (!fs.existsSync(realDir) || !fs.statSync(realDir).isDirectory()) return null;
  return realDir;
}
