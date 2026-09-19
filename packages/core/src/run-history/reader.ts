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

import { isOneName, pathInside } from '../backlog/confine.js';
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
 * A row whose totals are **both** null while its cache fields are populated is therefore a manifest
 * no adapter can produce — it is malformed, and `null` is the honest reading of absent summands
 * rather than a defect to repair here. Ruled rather than changed; see Q-0037.
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

/**
 * What {@link readRun} answers with: one run, or one of the two ways it is not one.
 *
 * Discriminated on `outcome` so a caller cannot render a manifest it was not given, and so the two
 * failures stay distinguishable — they print different sentences and only one of them names the
 * token's target at all.
 *
 * - `run` carries the resolved `directory`, the `manifestPath` that was read, and the parsed
 *   `manifest`. The document is a cast and never a check, exactly as {@link RunEntry.manifest} is:
 *   nothing beyond `JSON.parse` has been proved about it, and `validateArtifact` against the frozen
 *   schema is the job that proves more.
 * - `malformed` carries the parser's own `message`, so the sentence a caller prints names what the
 *   parser actually objected to rather than a paraphrase of it. It covers an absent `manifest.json`
 *   as well as an unparseable one, because a directory under the runs root with no manifest in it
 *   fails in the same place and with the same kind of sentence.
 * - `not-a-run` carries nothing at all, which is {@link resolveRunDirectory}'s `null` contract: it
 *   discloses nothing about what the token pointed at, including whether anything is there.
 */
export type RunRead =
  | {
    /** The token named a directory inside the runs root and its manifest parsed. */
    outcome: 'run';
    /** The resolved run directory, symlinks and all. */
    directory: string;
    /** Absolute path of the manifest that was read. */
    manifestPath: string;
    /** The parsed document — a cast, never a check. */
    manifest: RunManifest;
  }
  | {
    /** The token named a directory inside the runs root and its manifest could not be read. */
    outcome: 'malformed';
    /** The resolved run directory. */
    directory: string;
    /** Absolute path of the manifest that was attempted. */
    manifestPath: string;
    /** The parser's own words, so a caller quotes rather than paraphrases them. */
    message: string;
  }
  | {
    /** The token named nothing inside the runs root, and nothing more is said about it. */
    outcome: 'not-a-run';
  };

/**
 * The one run a token names, read from the runs root and from nowhere else.
 *
 * **It reads exactly one file.** {@link readRunsDir} parses every sibling manifest, which couples a
 * single-run request to the health and size of a store that may hold a year of history — and to
 * whether a stranger's damaged directory is sitting next to the one that was asked for. So a detail
 * request never goes through it (Q-0034 AC-13), and this is what it goes through instead.
 *
 * **Confinement and the read are one call, deliberately.** The alternative — publishing
 * {@link resolveRunDirectory} beside a `readRunManifest(dir)` — puts a path-returning function on
 * the public surface whose only correct use is to be opened immediately, and leaves a caller free to
 * resolve a token lexically and read anyway, which is the defect that guard exists to close. Ruled
 * rather than offered; see Q-0092 merged.md OQ-1.
 *
 * Writes nothing, creates nothing, and repairs nothing: an incomplete or damaged manifest is
 * reported as it stands.
 *
 * @param runsRoot absolute path of the runs root.
 * @param token the run id as it was typed.
 */
export function readRun(runsRoot: string, token: string): RunRead {
  const directory = resolveRunDirectory(runsRoot, token);
  if (directory === null) return { outcome: 'not-a-run' };
  const manifestPath = path.join(directory, MANIFEST_FILE);
  try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as RunManifest;
    return { outcome: 'run', directory, manifestPath, manifest };
  } catch (error) {
    return { outcome: 'malformed', directory, manifestPath, message: messageText(error) };
  }
}

/**
 * One file an occurrence retained: the leaf name it is asked for by, and its size on disk.
 *
 * The name is one name and never a path, which is what makes a listing addressable: a caller hands
 * back exactly this string and {@link readRetainedFile} joins it onto a directory the caller never
 * sees.
 */
export interface RetainedFile {
  /** The leaf name, as the occurrence's own directory holds it. */
  name: string;
  /** The file's size in bytes, from `lstat`. Nothing in a listing opens a file. */
  bytes: number;
}

/**
 * One occurrence's retained files, under the sequence number a caller addresses it by.
 *
 * `step_id` keeps the manifest's own name because it carries the manifest's own value unaltered,
 * which is the convention `WireRunHistoryOccurrence` states on the wire; `seq` is derived, and it
 * is the identity — an occurrence's directory is never named to a caller, and never taken from one.
 */
export interface RetainedOccurrence {
  /** {@link occurrenceSeq} of the occurrence's recorded directory. */
  seq: number;
  /** The step's id, or `''` where the manifest carried none — a cast, never a check. */
  step_id: string;
  /** The files, sorted by name. Empty where the directory exists and holds none. */
  files: RetainedFile[];
}

/**
 * One occurrence a listing could not name files for, and why.
 *
 * **The message names the condition and never the recorded directory.** That value is the untrusted
 * one here, and quoting a refused `../escape` back would put a path nobody asked for into an answer
 * — the disclosure `resolveRunDirectory`'s `null` contract already refuses one level up.
 */
export interface RetainedWarning {
  /** The occurrence's sequence number, which is what a caller would have addressed it by. */
  seq: number;
  /** Its step id, so a collision names both occurrences rather than one number twice. */
  step_id: string;
  /** One sentence naming the condition. */
  message: string;
}

/**
 * What {@link listRetainedFiles} answers with: one run's retained files, or one of the two ways it
 * is not a run — {@link RunRead}'s own three outcomes, narrowed to what this question needs.
 */
export type RetainedRead =
  | {
    /** The token named a run whose manifest parsed, and every occurrence was considered. */
    outcome: 'listing';
    /** One entry per addressable occurrence, in the manifest's own order. */
    occurrences: RetainedOccurrence[];
    /** Every occurrence this listing could not name files for. */
    warnings: RetainedWarning[];
  }
  | {
    /** The manifest could not be read. */
    outcome: 'malformed';
    /** The parser's own words, quoted rather than paraphrased. */
    message: string;
  }
  | {
    /** The token named nothing inside the runs root, and nothing more is said about it. */
    outcome: 'not-a-run';
  };

/**
 * What {@link readRetainedFile} answers with — one file's bytes, or exactly why not.
 *
 * Eight outcomes rather than a `null`, because a surface choosing a status has to tell them apart
 * and `null` would make it choose by matching prose. **`not-an-occurrence-file` and `no-such-file`
 * are never collapsed**: the first says the name was never this occurrence's, the second that it was
 * and is no longer — a distinction the store makes on its own, this product's run history having
 * grown by six files while this ticket's own requirement was being measured.
 */
export type RetainedFileRead =
  | {
    /** The name was one of this occurrence's and its bytes were read. */
    outcome: 'file';
    /** The leaf name that was read, echoed so a caller reports what it got. */
    name: string;
    /** Every byte of it, undecoded: a caller that must characterise them needs what was read. */
    bytes: Buffer;
  }
  | { /** The manifest could not be read. */ outcome: 'malformed'; message: string }
  | { /** The token named nothing inside the runs root. */ outcome: 'not-a-run' }
  | { /** The supplied name is not one leaf name, so nothing was opened. */ outcome: 'not-a-file-name' }
  | { /** No occurrence of this run answers to that sequence number. */ outcome: 'no-such-occurrence' }
  | { /** More than one does, so none of them can be addressed by it. */ outcome: 'ambiguous-occurrence' }
  | { /** Its recorded directory is not inside this run's own. */ outcome: 'unsafe-occurrence-directory' }
  | { /** The name is not in this request's own enumeration of that directory. */ outcome: 'not-an-occurrence-file' }
  | { /** It was, and nothing regular stands at it now. */ outcome: 'no-such-file' };

/** What a listing says about an occurrence whose recorded directory is not a path at all. */
const NOT_A_PATH = 'the manifest records no directory for this occurrence, so nothing was named for it';

/** …one that resolves outside the run's own directory, lexically or through a link. */
const OUTSIDE_RUN = "this occurrence's recorded directory is not inside the run's own directory, so nothing in it was named";

/** …one that is simply not there, which a run interrupted between allocating and persisting leaves. */
const NO_DIRECTORY = "this occurrence's recorded directory is not there";

/** …and one the operating system refused, named by its code alone so no path is quoted back. */
const unreadableDirectory = (code: unknown): string =>
  `this occurrence's recorded directory could not be read (${typeof code === 'string' ? code : 'no error code'})`;

/**
 * …and a sequence number more than one occurrence answers to.
 *
 * Reachable rather than hypothetical: {@link occurrenceSeq} answers `Number.MAX_SAFE_INTEGER` for a
 * directory name whose `steps/NNN-` prefix it cannot read, so two unreadable entries collide. Both
 * are named and neither is addressable, because *more than one* is not *none* — answering either
 * would serve one occurrence's file under the other's number.
 */
const sharedSequence = (seq: number): string =>
  `this occurrence shares sequence number ${String(seq)} with another, so neither can be addressed`;

/**
 * `O_NOFOLLOW` where the platform defines it, and nothing where it does not.
 *
 * **The blind spot is stated rather than left to be found** (Q-0135 E-3): Node leaves this constant
 * undefined on Windows, where the final-component symlink a listed name may have been replaced by is
 * therefore followed. Every environment this repository runs in — `ubuntu-latest` on CI and darwin
 * for development — defines it, and this product has never claimed Windows support (Q-0098).
 */
const NO_FOLLOW: number = fs.constants.O_NOFOLLOW ?? 0;

/** An open that failed because nothing this function may read stands at the name. */
const unopenable = (code: unknown): boolean =>
  code === 'ENOENT' || code === 'ENOTDIR' || code === 'ELOOP' || code === 'EISDIR';

/**
 * Whether `name` is a leaf this module will join onto a directory.
 *
 * {@link isOneName} is the shipped predicate and refuses `''`, `.`, `..` and anything whose basename
 * differs from it; the backslash clause is beside it because `path.basename` is platform-specific
 * and a POSIX basename of `a\b` is the whole string.
 *
 * **It governs both directions, which is what keeps them one answer.** It decides what a name a
 * caller supplies may be, and it decides what {@link retainedIn} will *offer* — so nothing this
 * module lists is a name it would then refuse to open. Applying it on one side alone is the defect
 * review round 1 found: a listing that names a file no request can fetch.
 */
const isRetainedName = (name: string): boolean =>
  isOneName(name) && !name.includes('/') && !name.includes('\\');

/** One occurrence of a manifest, as much of it as a retained-file read needs. */
interface ManifestOccurrence {
  seq: number;
  step_id: string;
  /** Whatever the manifest carried — a cast, never a check, so it may not be a string at all. */
  occurrence_dir: unknown;
}

/**
 * Every occurrence a manifest records, read off a document nothing has validated.
 *
 * `readRun`'s own JSDoc calls the parsed manifest *"a cast, never a check"*, and
 * {@link manifestShapeError} does not run on a single-run read at all — so `steps` may not be an
 * array and an element may not be an object. Both are guarded here rather than trusted, which is the
 * guard `read.ts` needed two review rounds to get right for the roll-up.
 */
function manifestOccurrences(manifest: RunManifest): ManifestOccurrence[] {
  const steps: unknown = (manifest as { steps?: unknown }).steps;
  if (!Array.isArray(steps)) return [];
  return steps
    .filter((step): step is Record<string, unknown> => typeof step === 'object' && step !== null)
    .map((step) => ({
      seq: occurrenceSeq(typeof step.occurrence_dir === 'string' ? step.occurrence_dir : null),
      step_id: typeof step.step_id === 'string' ? step.step_id : '',
      occurrence_dir: step.occurrence_dir,
    }));
}

/** The sequence numbers more than one occurrence answers to, and which none of them may be addressed by. */
function collidingSeqs(occurrences: readonly ManifestOccurrence[]): Set<number> {
  const counted = new Map<number, number>();
  for (const occurrence of occurrences) counted.set(occurrence.seq, (counted.get(occurrence.seq) ?? 0) + 1);
  return new Set([...counted].filter(([, count]) => count > 1).map(([seq]) => seq));
}

/** What one occurrence's directory yielded: where it is and what it holds, or why neither. */
type OccurrenceFiles =
  | { directory: string; files: RetainedFile[] }
  | { problem: { unsafe: boolean; message: string } };

/**
 * One occurrence's directory, confined and enumerated — and nothing in it opened.
 *
 * **{@link pathInside} and deliberately not `isFolderIn`.** That predicate requires the candidate to
 * sit *directly* inside the root, one component down, and an occurrence directory is
 * `steps/NNN-<step id>` — two. It would refuse every legitimate occurrence there is, which is a
 * failure that looks safe and is total. `pathInside` is strictly inside at any depth, refuses an
 * absolute `rel`, and resolves the deepest existing ancestor so a link standing at the destination
 * is refused rather than followed.
 *
 * **The value confined is the manifest's, not a client's**, which is the difference from
 * `GET /tickets/:id/file` worth stating where the code is: there the untrusted string arrives over
 * HTTP, and here it arrives from a file this product wrote and re-checks nowhere else — nothing on
 * the read path validates an occurrence field, and `contracts/run-manifest.ts` looks at
 * `occurrence_dir` only for duplicates and only under `quorum validate`.
 *
 * A directory entry that is not a **regular file** is skipped rather than measured: a directory, a
 * socket and a symlink have no size to report and no bytes to serve. `lstat` rather than `stat`, so
 * the symlink is judged as itself rather than as whatever it points at.
 *
 * **And so is an entry {@link isRetainedName} refuses**, which is what makes the listing and the
 * read one answer rather than two: a name this module would not join onto a directory is a name no
 * request can fetch, so offering it would be a listing that names a file and then refuses it.
 * **What that drops is one shape and it is stated rather than left to be found** (Q-0135 E-3):
 * `readdir` never answers `''`, `.`, `..` or a name holding `/`, so the only reachable case is a
 * POSIX file whose own name contains a backslash — which `persist` cannot create, its two callers
 * passing constants, and which therefore means somebody put it there by hand.
 */
function retainedIn(runDirectory: string, occurrenceDir: unknown): OccurrenceFiles {
  if (typeof occurrenceDir !== 'string') return { problem: { unsafe: false, message: NOT_A_PATH } };
  const directory = pathInside(runDirectory, occurrenceDir);
  if (directory === null) return { problem: { unsafe: true, message: OUTSIDE_RUN } };
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(directory, { withFileTypes: true });
  } catch (error) {
    const code = errorProperty(error, 'code');
    const missing = code === 'ENOENT' || code === 'ENOTDIR';
    return { problem: { unsafe: false, message: missing ? NO_DIRECTORY : unreadableDirectory(code) } };
  }
  const files: RetainedFile[] = [];
  for (const entry of entries) {
    if (!isRetainedName(entry.name)) continue;
    const found = fs.lstatSync(path.join(directory, entry.name), { throwIfNoEntry: false });
    if (found === undefined || !found.isFile()) continue;
    files.push({ name: entry.name, bytes: found.size });
  }
  files.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  return { directory, files };
}

/**
 * Every retained file of every occurrence of one run, named and measured — and none of them opened.
 *
 * **May a route serve a file under `.quorum/`? Yes, and no decision entry is owed.** The gitignore
 * fact does not discriminate: `.quorum/` and `.harness/` are adjacent lines of one `.gitignore` and
 * git tracks nothing under either, so the reasoning Q-0127's erratum E-1 used to exclude `.harness/`
 * from a *backlog* route would make `GET /history` a violation too — and that has shipped since
 * Q-0119. What discriminates is that `.quorum/` is named as the database in
 * `harness/rules.md`, and that Q-0127 forwarded this subject here by name.
 * Why: ruled at this ticket's requirements gate, `requirements/errata.md` E-1.
 *
 * **It opens exactly one file, and that file is the manifest.** Nothing an occurrence retained is
 * opened: a name comes from `readdir` and a size from `lstat`, so the largest thing this answers is
 * a few hundred bytes about a run whose retained text reaches 3.5 MB. What a reader receives is
 * bounded by their own next act rather than by a cap nobody is told about, which is Q-0127's answer
 * to the same question at a folder fifty times the size.
 *
 * **A single refused occurrence never takes the run's listing with it.** It is named in `warnings`
 * and the rest are answered, which is `failSoftly`'s distinction one level in from where
 * {@link readRunsDir} already applies it.
 *
 * Writes nothing, creates nothing and repairs nothing — including a manifest whose `occurrence_dir`
 * is refused, which goes on being reported by `readRun` exactly as it stands.
 *
 * @param runsRoot absolute path of the runs root.
 * @param token the run id as it was typed.
 */
export function listRetainedFiles(runsRoot: string, token: string): RetainedRead {
  const read = readRun(runsRoot, token);
  if (read.outcome === 'not-a-run') return { outcome: 'not-a-run' };
  if (read.outcome === 'malformed') return { outcome: 'malformed', message: read.message };
  const occurrences: RetainedOccurrence[] = [];
  const warnings: RetainedWarning[] = [];
  const recorded = manifestOccurrences(read.manifest);
  const colliding = collidingSeqs(recorded);
  for (const occurrence of recorded) {
    const named = { seq: occurrence.seq, step_id: occurrence.step_id };
    if (colliding.has(occurrence.seq)) {
      warnings.push({ ...named, message: sharedSequence(occurrence.seq) });
      continue;
    }
    const found = retainedIn(read.directory, occurrence.occurrence_dir);
    if ('problem' in found) warnings.push({ ...named, message: found.problem.message });
    else occurrences.push({ ...named, files: found.files });
  }
  return { outcome: 'listing', occurrences, warnings };
}

/**
 * One named file of one occurrence of one run, as the bytes on disk.
 *
 * **Membership is enumerated for this invocation and never taken from a caller.** A name the
 * enumeration this call performed does not hold is refused before anything is opened, so a listing a
 * client fetched earlier grants nothing — which is what makes a file the writer *could* have created
 * and did not unreadable, `persist` taking the artifact's name as a plain `string` parameter and
 * confining it nowhere.
 *
 * **Bytes and never text.** `readFileSync(file, 'utf8')` substitutes U+FFFD and does not throw, so a
 * caller that must decide whether these bytes are text has to be handed what was actually read. The
 * verdict is then taken once, over one read.
 *
 * **Opened once, `fstat`ed on the descriptor, and read from it** — `readTicketFileBytes`'s
 * discipline, which is Q-0122's TOCTOU fix reused rather than re-derived: a `statSync` followed by
 * an open by name measures one moment and serves another. {@link NO_FOLLOW} closes the half that
 * leaves: a listed name replaced by a symlink between the enumeration above and this open is refused
 * rather than having its target served, and the target is not read to find that out.
 *
 * Every other failure propagates: a file this process may not open is not a file that is not there.
 *
 * @param runsRoot absolute path of the runs root.
 * @param token the run id as it was typed.
 * @param seq the occurrence's sequence number, as {@link listRetainedFiles} answered it.
 * @param name one leaf name, as that listing named it.
 */
export function readRetainedFile(
  runsRoot: string,
  token: string,
  seq: number,
  name: string,
): RetainedFileRead {
  if (!isRetainedName(name)) return { outcome: 'not-a-file-name' };
  const read = readRun(runsRoot, token);
  if (read.outcome === 'not-a-run') return { outcome: 'not-a-run' };
  if (read.outcome === 'malformed') return { outcome: 'malformed', message: read.message };
  const matches = manifestOccurrences(read.manifest).filter((occurrence) => occurrence.seq === seq);
  if (matches.length === 0) return { outcome: 'no-such-occurrence' };
  if (matches.length > 1) return { outcome: 'ambiguous-occurrence' };
  const found = retainedIn(read.directory, matches[0].occurrence_dir);
  if ('problem' in found) {
    // A directory that is absent or unreadable enumerated nothing, so no name is one this occurrence
    // holds — which is a true sentence about the name that was asked for. Only the confinement
    // refusal is reported as itself, because it is the one a caller must not read as *not there*.
    return { outcome: found.problem.unsafe ? 'unsafe-occurrence-directory' : 'not-an-occurrence-file' };
  }
  if (!found.files.some((file) => file.name === name)) return { outcome: 'not-an-occurrence-file' };
  let handle: number;
  try {
    handle = fs.openSync(path.join(found.directory, name), fs.constants.O_RDONLY | NO_FOLLOW);
  } catch (error) {
    if (unopenable(errorProperty(error, 'code'))) return { outcome: 'no-such-file' };
    throw error;
  }
  try {
    if (!fs.fstatSync(handle).isFile()) return { outcome: 'no-such-file' };
    return { outcome: 'file', name, bytes: fs.readFileSync(handle) };
  } finally {
    fs.closeSync(handle);
  }
}
