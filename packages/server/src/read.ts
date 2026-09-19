/**
 * The read-only surface: what project is open, what tickets exist, which flows are runnable, and
 * what previous runs did.
 *
 * **Everything here is already on `@quorum/core`'s barrel** — this file adds no domain logic and
 * owns no state. That is why it is the last of Q-0013's three children rather than the first: it
 * needed nothing added to `core`, so it could not block the two that did.
 *
 * **It writes nothing, and that is a boundary rather than an omission.** No ticket is created, no
 * stage moves, no flow is edited. *"Flows are YAML files in the project; the UI edits files and
 * never holds the truth"* — an editing surface is a later ticket, and putting one here would make
 * this the truth by accident.
 *
 * **History is rooted at `/history`, not at `/runs`.** `POST /runs/:id/*` already exists and its
 * `:id` is the host's live handle, while a run-history id is `<TICKET>-<n>`; two id spaces on one
 * path shape is a trap for a client and for whoever adds the next route.
 * `docs/04-architecture.md` names *"REST for project/backlog/flows/history"*, so the word is the
 * document's too.
 *
 * **Q-0127 added the two routes that answer for ONE ticket**, and they are the first here that take
 * something other than a token from a client: `GET /tickets/:id` names and measures a ticket's
 * folder without opening a file in it, and `GET /tickets/:id/file` reads one of the files it named.
 * Two routes rather than one because a ticket folder is 3.1 MB at this backlog's largest — a single
 * route returning everything would put an unbounded body on a wire — and because no pattern
 * `Backlog.readFiles` accepts can enumerate a folder at all. There is no cap anywhere: what stands
 * in for one is that nothing large is fetched until a reader names that file with its size in front
 * of them.
 *
 * **Q-0137 added the two that answer for what a RUN retained**, in that pair's shape and for its
 * reasons at a store fifty times the size: `GET /history/:id/retained` names and measures every
 * occurrence's retained files without opening one, and `GET /history/:id/file` reads one of them.
 * They are two routes rather than a widening of `GET /history/:id` because that route is mission
 * control's, read on every load of a screen that will never fetch a retained file, and because
 * widening it would retire its own documented property — *"It reads exactly one file."*
 * **Neither composes a filesystem path.** A client supplies a run token, an occurrence's sequence
 * number and one leaf name; `core` resolves the run, confines the occurrence directory the manifest
 * records, enumerates it for that request and opens the file — so the one untrusted value here, the
 * `occurrence_dir` nothing on the read path validates, never crosses this boundary in either
 * direction. Why: ruled at that ticket's requirements gate, `requirements/errata.md` E-1 — a route
 * may serve a file under `.quorum/`, which `GET /history` has been doing since Q-0119, and no
 * decision entry is owed.
 *
 * Why: deliberate addition, not preservation — Q-0119.
 */
import path from 'node:path';

import {
  containment, isIncomplete, isOneName, lintFlowDirectory, listRetainedFiles, listTicketFiles,
  occurrenceSeq, pushLag, readRetainedFile, readRun, readRunsDir, readTicketFileBytes, sortRuns,
  vendorTokenTotal,
  type Project, type RetainedFileRead, type RunEntry, type TicketRecord, type VendorRollup,
} from '@quorum/core';
import { Hono } from 'hono';

import {
  MANIFEST_FILE, RUN_HISTORY_ROOT, wireRunHistoryRowSchema,
  type TicketHistoryEntry, type WireFlow, type WireFlowList, type WireRefusal,
  type WireRunHistoryList, type WireRunHistoryRetained, type WireRunHistoryRetainedText,
  type WireRunHistoryRow, type WireRunHistoryWarning, type WireTicket,
  type WireTicketDetail, type WireTicketFile, type WireTicketList,
} from '@quorum/shared';

import { badRequest } from './wire.js';

export type {
  WireFlow, WireFlowList, WireRunHistoryList, WireRunHistoryRetained, WireRunHistoryRetainedText,
  WireRunHistoryRow, WireTicket, WireTicketDetail, WireTicketFile, WireTicketList,
};



/**
 * The rows of a manifest's roll-up that are usable, which is not the same as the ones it carries.
 *
 * `readRun` parses and does not validate — its own JSDoc says *"a cast, never a check"* — so this
 * reads what is there rather than what the type promises. A row is usable when it is an object
 * whose `vendor` is a string, that being the one field read by name.
 */
function rollupRows(rollup: unknown): VendorRollup[] {
  if (!Array.isArray(rollup)) return [];
  return rollup.filter((row): row is VendorRollup =>
    typeof row === 'object' && row !== null && typeof (row as { vendor?: unknown }).vendor === 'string');
}

/**
 * Every roll-up element narrowed to the four fields a listing row carries, and **none of them
 * dropped**.
 *
 * **Deliberately not {@link rollupRows}, which filters — and filtering is right where that is used
 * and wrong here.** The detail route derives `tokensByVendor` from it and sends the manifest whole
 * beside it, so an element it could not read is still in front of a reader. On the listing the
 * projection IS the answer: a filter there makes this route decide that a manifest holding a row it
 * cannot read describes a run with fewer vendors, so `rollup: [42]` would list as a perfectly good
 * run that billed nobody. It would also make the two routes disagree about one file, since
 * `wireRunHistorySchema` declares `manifest.rollup` over {@link wireVendorRollupSchema}'s elements
 * and a browser therefore refuses that same manifest on the detail.
 *
 * So an element that is not an object crosses **as it stands** and one that is has its four fields
 * read off whatever is there: either way {@link wireRunHistoryRowSchema} is what judges it, and a
 * run it refuses is NAMED in `warnings` with the parser's own words rather than misreported as one
 * with an empty roll-up.
 */
function listingRollup(rollup: readonly unknown[]): unknown[] {
  return rollup.map((row) => {
    // Handed on unchanged so the schema names what it found. Reading `.vendor` off `null` would
    // throw, and substituting an empty object here would report a damaged row as a missing one.
    if (typeof row !== 'object' || row === null) return row;
    const fields = row as Partial<VendorRollup>;
    return {
      vendor: fields.vendor,
      cost_usd: fields.cost_usd,
      unpriced_steps: fields.unpriced_steps,
      step_count: fields.step_count,
    };
  });
}

/**
 * One listing row for one run, or the sentence saying why this route could not compose one.
 *
 * **It parses with the schema the response is declared against, rather than checking fields by
 * hand.** `readRunsDir` proves five things about a manifest — `run_id`, `ticket_id` and `status` are
 * strings, `steps` and `rollup` are arrays — and this route answers with more than that: an instant,
 * an end, a duration and four measures a vendor row. `readRun`'s own JSDoc calls the parsed document
 * *"a cast, never a check"*, so every one of those can be of the wrong type on a hand-edited file.
 * Executing {@link wireRunHistoryRowSchema} here is what makes the declaration a promise; it also
 * covers a field a later ticket adds without anyone remembering to check it.
 *
 * **A run it cannot compose is NAMED rather than dropped, and it does not take the listing with
 * it.** That is `failSoftly`'s distinction applied one level in from where `readRunsDir` already
 * applies it: a store a reader could partly read is not an error, and the difference between a
 * listing and a detail is the blast radius — `GET /history/:id` answers about one run, so a damaged
 * manifest there is one unparseable response, while a single damaged manifest here would otherwise
 * make every run in the store unreadable at once. The channel is the one already declared for it,
 * whose own contract is *"a shape error, a missing manifest, or a parse failure with the parser's
 * own words"*, and this produces the first and the third.
 *
 * **What this refuses that `readRunsDir` accepts has a rate nobody has measured, and the claim is
 * bounded accordingly.** The requirements run measured **0 of 171** run directories unreadable by
 * `readRunsDir`; it did not measure how many fail THIS check, and this worktree cannot — a run
 * store is gitignored and is not in it. What is known instead is stronger than a count and does not
 * rot: every constraint applied here is one `GET /history/:id` has already been applying to real
 * manifests since Q-0135 — `started_at` a non-empty string, `ended_at` a string or `null`,
 * `duration_ms` and `cost_usd` non-negative or `null`, the two roll-up counts non-negative
 * integers — so a manifest this refuses is one that route was already refusing, and the difference
 * this makes is where the refusal lands rather than how often.
 *
 * **That last sentence is a property of `listingRollup` rather than of this function alone**, and it
 * was false while this projected through `rollupRows`: a roll-up element that is not an object was
 * dropped here and refused there, so one manifest read as a run with no billed vendors on the
 * listing and as an unparseable body on the detail. Review round 1's first finding.
 */
function historyRow(run: RunEntry): WireRunHistoryRow | string {
  const parsed = wireRunHistoryRowSchema.safeParse({
    id: run.runId,
    ticket: run.manifest.ticket_id,
    flow: run.manifest.flow,
    status: run.manifest.status,
    // Reported, never repaired: `docs/04-architecture.md` is explicit that a server must not tidy a
    // `running` manifest it meets on read. A run that was interrupted looks incomplete because it
    // IS, and saying so is the whole value of the field.
    incomplete: isIncomplete(run.manifest),
    started_at: run.manifest.started_at,
    ended_at: run.manifest.ended_at,
    duration_ms: run.manifest.duration_ms,
    // A count and never the array: the occurrences themselves are `GET /history/:id`'s, and putting
    // them on every row of a listing is the 170-reads-or-a-megabyte choice this route exists to
    // avoid having to make. `steps` is an array here without a guard, and that is one of the five
    // things `manifestShapeError` proves before `readRunsDir` puts an entry in `runs` at all — a
    // document failing it is already in `warnings` and never reaches this function.
    occurrenceCount: run.manifest.steps.length,
    // Narrowed to the four a surface renders and never the manifest's rows as they sit on disk,
    // which measured 581 B a row against 369 B — and narrowed WITHOUT dropping, so a row this route
    // cannot read refuses the whole listing row rather than shrinking the roll-up in silence. See
    // `listingRollup`, which is why this is not `rollupRows`.
    rollup: listingRollup(run.manifest.rollup),
  });
  return parsed.success ? parsed.data : `${MANIFEST_FILE} does not describe a run this listing can report (${parsed.error.message})`;
}

/**
 * The sum of a ticket's own billed history, or `null` where it has no history at all.
 *
 * The same arithmetic `packages/cli/src/board.ts` already prints, with one deliberate difference:
 * that surface renders `$0.00` for a ticket nothing has run, and this answers `null`. **Nothing has
 * run is not the claim that it cost nothing**, which is the `n/a`-never-`0` rule every other measure
 * on this transport is under; an empty `history` array is the same case as an absent one and takes
 * the same answer.
 *
 * A `null` entry cost is summed as zero, exactly as the board does. That is what the cost legend
 * beside the figure exists to disclose: a vendor that reports no price contributes nothing here, and
 * a ticket file cannot see its own incompleteness. See *"Codex cost is reported as tokens, never
 * priced locally"* (2026-08-22).
 *
 * **The consequence, stated rather than left to be composed** (Q-0127 AC-14(b)): a ticket whose
 * history is entirely unpriced sums to `0` and renders `$0.00`, indistinguishable from one that
 * really cost nothing. That is ratified rather than repaired, for three reasons. `WireTicket`'s own
 * JSDoc already rules the question — the figure carries no vendor breakdown and no count of unpriced
 * runs, because a ticket file records one figure and cannot see its own incompleteness, and what
 * names that is the legend. The **mixed** case is the same shape at a higher frequency: a history
 * with one priced entry and one unpriced already renders a partial sum as a total, so answering
 * `null` here would leave one function applying two rules to one question. And the field is
 * `billedCostUsd`: for a ticket every run of which was codex, nothing *was* billed, while `null`
 * means *nothing has run* — two different facts that answering `null` would collapse. Measured
 * before it was ratified: **zero tickets in this backlog have an entirely unpriced history**, so it
 * is latent rather than live. Changing it is a wire contract's to change, with an entry of its own.
 */
function billedCostOf(history: TicketHistoryEntry[] | undefined): number | null {
  if (history === undefined || history.length === 0) return null;
  return history.reduce((total, entry) => total + (entry.cost ?? 0), 0);
}

/**
 * The four fields a ticket must have produced before either ticket route answers for it.
 *
 * `parseFrontmatter` falls open — no delimiters means the whole file becomes the body with empty
 * frontmatter, silently — and `Backlog.read` asserts rather than parses, so a damaged `ticket.md`
 * reads as a ticket with no fields at all. That is Q-0060, which is open and which this does not
 * fix: the parser is untouched and shared with `harness/roles/*.md`, so the refusal is HERE, at the
 * boundary, and reaches nothing else.
 *
 * **The listing does the opposite deliberately.** `GET /tickets` renders a damaged ticket, named by
 * its `folder`, because a board that hides one is wrong about the one question a board answers
 * (Q-0017 AC-8). A row on the board and a refusal on its page is the coherent pair: the listing says
 * the ticket is there, and the page says its file did not yield one.
 */
const TICKET_FIELDS = ['id', 'title', 'stage', 'owner'] as const;

/** What a client can do about a path this route will not read. The surface's, not `core`'s. */
const FILE_REMEDY = 'ask this ticket for its files and request one of the paths it names';

/** The ticket `token` names, or the refusal that says why neither ticket route will answer for it. */
type TicketLookup =
  | { readonly record: TicketRecord }
  | { readonly refusal: WireRefusal; readonly status: 400 | 404 | 422 };

/**
 * The ticket `token` resolves to, checked the same way for both routes.
 *
 * **Three refusals, each decided by a predicate and never by an error's prose.** `Backlog.dirOf`
 * raises a plain `Error` for *this token is not one name* and another for *no such ticket*, so a
 * route choosing between 400 and 404 by matching those sentences would be coupled to `core`'s
 * wording — which is why `isOneName` is asked first, on the string alone, before anything is
 * opened. What remains for `dirOf` to raise is then the one condition that means *no folder*.
 */
function ticketFor(project: Project, token: string): TicketLookup {
  if (!isOneName(token)) {
    return {
      status: 400,
      refusal: badRequest(
        'not-a-ticket-token',
        `${JSON.stringify(token)} is not a ticket token: a ticket is one folder directly under the backlog root`,
        null,
      ),
    };
  }
  try {
    project.backlog.dirOf(token);
  } catch {
    return { status: 404, refusal: badRequest('no-such-ticket', `no ticket under ${JSON.stringify(token)}`, null) };
  }
  let record: TicketRecord;
  try {
    record = project.backlog.read(token);
  } catch {
    // The frontmatter could not be parsed at all, or `ticket.md` could not be read. The reader's own
    // diagnostic is deliberately not carried: `package.test.ts`'s register pins one `.message`
    // receiver per file in this package, and what a client needs here is which file and which
    // ticket rather than a YAML parser's line and column.
    return { status: 422, refusal: badRequest('malformed-ticket', malformed(token, 'ticket.md could not be read as a ticket'), null) };
  }
  const meta = record.meta as unknown as Record<string, unknown>;
  const missing = TICKET_FIELDS.filter((field) => {
    const value = meta[field];
    return typeof value !== 'string' || value.trim() === '';
  });
  if (missing.length) {
    return {
      status: 422,
      refusal: badRequest('malformed-ticket', malformed(token, `ticket.md yielded no ${missing.join(', no ')}`), null),
    };
  }
  if (meta.id !== token) {
    // The ticket that answered is not the ticket that was asked for. `dirOf` resolves a folder whose
    // name BEGINS with the token and a hyphen, so this is the case where a folder's name and its
    // file's id disagree — and answering it would report one ticket under another's id.
    return {
      status: 422,
      refusal: badRequest('malformed-ticket', malformed(token, `ticket.md declares id ${JSON.stringify(String(meta.id))}`), null),
    };
  }
  return { record };
}

/** How every malformed-ticket refusal reads: which ticket was asked for, and what its file did. */
const malformed = (token: string, what: string): string =>
  `${JSON.stringify(token)} does not read as a ticket: ${what}`;

/** Why `rel` is not a path this route will look up, or `null` where it is one to look up. */
function notAFilePath(rel: string): string | null {
  if (rel === '') return 'no path was asked for';
  // A `*` is refused even where a file legitimately carries one in its name: this route reads ONE
  // file, and a client that expected a pattern would take one answer for the whole match.
  if (rel.includes('*')) return `${JSON.stringify(rel)} is a pattern, and this route reads one file`;
  if (rel.endsWith('/')) return `${JSON.stringify(rel)} names a directory, and this route reads one file`;
  if (path.isAbsolute(rel)) return `${JSON.stringify(rel)} is an absolute path, and a file of a ticket is named relative to it`;
  return null;
}

/** A path that is well formed and is not one of this ticket's files. */
const notListed = (rel: string): string => `${JSON.stringify(rel)} is not a file this ticket holds`;

/**
 * `bytes` as UTF-8 text, or `null` where they are not well-formed UTF-8.
 *
 * **Fatal, whole and over the bytes that were read.** `readFileSync(file, 'utf8')` substitutes
 * U+FFFD and does not throw, so a `.DS_Store` inside a ticket folder — which a file manager creates
 * unbidden — would be served corrupted rather than refused. A decode of a PREFIX would cut a
 * multi-byte character in half and report a valid file as binary, and a byte-length comparison
 * against a second `stat` would make the verdict a function of two moments. One read, one verdict.
 *
 * Note what this is NOT: a test for the replacement character. Three files under this repository's
 * own backlog contain U+FFFD legitimately, and **sixteen of the 1,797 files its run history
 * retains** — so a scan for that character would report sixteen real prompts as binary on the day it
 * shipped. Zero files in either store fail the decode below, which is why the criterion behind it
 * cannot be learned from this machine and is pinned against a constructed fixture instead.
 *
 * One function for both stores rather than one per route, which is the reuse Q-0137 was asked for by
 * name: a UTF-8 verdict must be taken with the decoder that will serve the bytes, and two decoders
 * would be two answers — `iconv` and `TextDecoder` already disagree about a file under this backlog
 * that round-trips byte for byte.
 */
function asUtf8(bytes: Buffer): string | null {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

/** A file whose bytes this route cannot characterise, named rather than served substituted. */
const notUtf8 = (rel: string): string =>
  `${JSON.stringify(rel)} is not well-formed UTF-8, so this route cannot serve it as text`;

/** What a client can do about an occurrence or a name the retained-file route will not read. */
const RETAINED_REMEDY = 'ask this run for what its occurrences retained and request one of the names it lists';

/** The query keys `GET /history/:id/file` accepts, and the whole of what it accepts. */
const RETAINED_FILE_QUERY: readonly string[] = ['occurrence', 'name'];

/**
 * The same for `GET /history/:id/retained`, which is answered by the run token alone and so accepts
 * nothing — an empty set rather than an absent check, which is what makes it refuse a key.
 */
const RETAINED_LISTING_QUERY: readonly string[] = [];

/**
 * Why a retained route will not read the query it was given, or `null` where every key in it is one
 * that route accepts.
 *
 * **A declared set rather than a register of forbidden spellings**, which is what makes
 * *"`occurrence_dir` is not an input under any spelling"* a property rather than a list somebody
 * has to keep adding to: `occurrenceDir`, `dir`, `path`, `Occurrence` and anything nobody has
 * thought of are all refused by not being one of the names the route declares. It is *"Unknown keys
 * are refused where Quorum owns the key set, and preserved where it does not"* (2026-08-25) applied
 * to a request rather than to a body — Quorum owns both of these queries entirely.
 *
 * **Both routes, and the listing is review round 2's major.** It was left answering 200 over a key
 * it does not read, on the reasoning that its answer is a function of the run token alone so an
 * unread key there misleads nobody. AC-6 says both routes reject the directory under every
 * spelling, and *ignored* is not *rejected*: a client that sent one and was answered 200 has been
 * told its request was understood, which is the same sentence the file route stopped telling one
 * round earlier.
 *
 * **The code is `unknown-field`, which is `http.ts`'s own for this condition** — a request carrying
 * a key a route does not accept, there in a body and here in a query. One condition gets one code:
 * two sibling routes answering two codes for one thing is what round 1 fixed for `no-such-run`,
 * where a client would have had to know which route it had asked. It is not a tenth member of
 * AC-5's nine, which answer for a malformed VALUE or for what `core` found — an unaccepted key is
 * refused before either is read.
 */
function unexpectedQuery(
  given: Readonly<Record<string, string>>,
  accepted: readonly string[],
): WireRefusal | null {
  const unknown = Object.keys(given).filter((key) => !accepted.includes(key)).sort();
  if (unknown.length === 0) return null;
  return badRequest(
    'unknown-field',
    `the query carries ${unknown.map((key) => JSON.stringify(key)).join(', ')}, which this route does not accept`,
    accepted.length === 0
      ? 'remove it; this route accepts no query value'
      : `remove it; this route accepts ${[...accepted].join(', ')}`,
  );
}

/**
 * A base-10 non-negative safe integer, or `null` for anything else a query value can be.
 *
 * Anchored on the digits rather than on `Number`, which accepts a sign, a fractional part, an
 * exponent, a hexadecimal prefix, whitespace and the empty string — every one of which would make a
 * client's `+1`, `1.0` or `0x1` address an occurrence it did not name.
 */
function sequenceValue(given: string): number | null {
  if (!/^[0-9]+$/.test(given)) return null;
  const value = Number(given);
  return Number.isSafeInteger(value) ? value : null;
}

/** Why `given` is not an occurrence this route will look up, or `null` where it is one. */
const notASequence = (given: string): string =>
  `${JSON.stringify(given)} is not an occurrence: an occurrence of a run is named by the sequence number its listing carries`;

/**
 * Why `name` is not a retained file this route will look up, or `null` where it is one.
 *
 * A leaf and never a path, which is the difference from `GET /tickets/:id/file`'s `?path=`: a
 * ticket's file is named relative to its folder and holds separators, while a retained file sits
 * directly in its occurrence's own directory and is one name. `core` refuses the same shapes again
 * at the join — this is what turns the refusal into a status and a sentence rather than replacing it.
 */
function notARetainedName(name: string): string | null {
  if (name === '') return 'no file was asked for';
  if (name === '.' || name === '..') return `${JSON.stringify(name)} names a directory, and this route reads one file`;
  if (name.includes('/') || name.includes('\\')) {
    return `${JSON.stringify(name)} is a path, and a retained file is named by one name`;
  }
  return null;
}

/** The status and the sentence for each way `core` refuses a retained-file read. */
type RetainedRefusal = Exclude<RetainedFileRead, { outcome: 'file' | 'malformed' }>['outcome'];

/**
 * How each of those becomes an answer — a code a client switches on, a status, and a condition.
 *
 * **Decided by a discriminant and never by matching an error's prose**, which is `ticketFor`'s rule
 * at a second surface: `core` answers one of eight outcomes and each maps to exactly one row here,
 * so a reworded sentence in `core` cannot silently move a status.
 *
 * **The code is declared rather than taken from the outcome's own name**, and one row is why: a
 * token naming no run is `core`'s `not-a-run` and this transport's **`no-such-run`**, which is what
 * the listing route beside this one has answered since Q-0119 and what `GET /history/:id` answers.
 * Deriving the code from the outcome made the two routes answer two codes for one condition, and a
 * client switching on it would have had to know which route it had asked.
 *
 * `not-an-occurrence-file` and `no-such-file` are two rows and are never collapsed. The first says
 * the name was never this occurrence's — including where its directory is gone, which enumerated
 * nothing — and the second that it was named by this request's own listing and has stopped being a
 * regular file since. A listed name replaced by a symlink is the second, and its target is not read.
 *
 * **The remedy is per row and three rows have none**, which is *"A `core` error names the
 * condition; the remedy belongs to the surface"* (2026-09-07) read the way round it is usually
 * needed: a surface that has nothing useful to say says nothing. Telling a reader to ask a run for
 * its retained files is advice on four rows and nonsense on the three where the run is not there,
 * where its own record refused the directory, and where the listing already reports that the
 * number they asked for is not addressable at all.
 *
 * **Every outcome `core` can answer with has a row by construction**: {@link RetainedRefusal} is
 * derived from that union, so a ninth outcome fails to compile here rather than falling through to
 * a status nobody chose. `not-a-file-name` is reachable from `core` alone — the route refuses a
 * malformed name first, with the same predicate — and is kept as the second of the two refusals
 * rather than deleted, because a caller other than this route gets the same answer.
 */
const RETAINED_REFUSAL: Readonly<Record<RetainedRefusal, {
  code: string;
  status: 400 | 404 | 409 | 422;
  condition: (seq: number, name: string) => string;
  remedy: string | null;
}>> = {
  'not-a-run': {
    code: 'no-such-run',
    status: 404,
    condition: () => 'no run history under that token',
    remedy: null,
  },
  'not-a-file-name': {
    code: 'not-a-file-name',
    status: 400,
    condition: (_seq, name) => notARetainedName(name) ?? 'no file was asked for',
    remedy: RETAINED_REMEDY,
  },
  'no-such-occurrence': {
    code: 'no-such-occurrence',
    status: 404,
    condition: (seq) => `no occurrence of this run carries sequence number ${String(seq)}`,
    remedy: RETAINED_REMEDY,
  },
  'ambiguous-occurrence': {
    code: 'ambiguous-occurrence',
    status: 409,
    condition: (seq) => `more than one occurrence of this run carries sequence number ${String(seq)}, so none of them can be addressed by it`,
    remedy: null,
  },
  'unsafe-occurrence-directory': {
    code: 'unsafe-occurrence-directory',
    status: 422,
    condition: () => "this occurrence's recorded directory is not inside the run's own directory, so nothing in it was read",
    remedy: null,
  },
  'not-an-occurrence-file': {
    code: 'not-an-occurrence-file',
    status: 400,
    condition: (_seq, name) => `${JSON.stringify(name)} is not a file this occurrence retained`,
    remedy: RETAINED_REMEDY,
  },
  'no-such-file': {
    code: 'no-such-file',
    status: 404,
    condition: (_seq, name) => `${JSON.stringify(name)} is no longer a file this occurrence retained`,
    remedy: RETAINED_REMEDY,
  },
};

/**
 * One ticket, as every route here reports it — the **one** projection the listing and the detail
 * both go through.
 *
 * Widened from an inline literal at Q-0127 rather than copied: `GET /tickets/:id` answers with the
 * same row `GET /tickets` carries for that ticket, and two projections would let a board card and a
 * page header disagree about one ticket, which is the failure a board exists to prevent.
 *
 * `?? ''` on four of the fields and NOT `String(ticket.meta.id)`, which answers the literal
 * "undefined" for a `ticket.md` `parseFrontmatter` fell open on — an id a reader cannot tell from a
 * real one, and one that two damaged tickets would share. The identity that survives that case is
 * `folder`, which comes from the directory rather than the file. `stage` keeps its `String()`
 * deliberately: what the file claimed is what a client must be able to NAME (Q-0017 AC-8), and ""
 * would say the file was silent where it was not.
 */
function ticketRow(ticket: TicketRecord, spot: ReturnType<typeof containment>): WireTicket {
  return {
    id: String(ticket.meta.id ?? ''),
    folder: ticket.folder,
    title: String(ticket.meta.title ?? ''),
    stage: String(ticket.meta.stage),
    owner: String(ticket.meta.owner ?? ''),
    branch: String(ticket.meta.branch ?? ''),
    // `stateOf` answers `null` where it was asked nothing, which is not the same as an
    // indeterminate answer and is carried through rather than flattened.
    containment: spot?.stateOf(ticket.meta.branch) ?? null,
    // Copied rather than computed: the loop counters the ticket already holds. There is no
    // denominator here and there must not be one — a step's `max_iterations` lives inside a flow
    // file and `GET /flows` carries no steps, so a `1/3` would be a number nobody measured.
    iterations: ticket.meta.iterations ?? {},
    billedCostUsd: billedCostOf(ticket.meta.history),
  };
}

/**
 * Containment and push lag for one invocation.
 *
 * **Computed per request and never cached**, which is the whole of what
 * *"Containment is derived from git on each board invocation, never stored"* (2026-08-24) and
 * *"The board reports push lag, and never a CI conclusion"* (2026-09-06) require. A cache here would
 * make them stored facts, which both entries forbid by name — and a stale one would report an
 * ancestry that was true when it was written, which is worse than reporting none.
 */
function gitFacts(project: Project): {
  spot: ReturnType<typeof containment>;
  lag: ReturnType<typeof pushLag>;
  base: string;
} {
  const base = project.config.repo?.base_branch ?? 'main';
  // The ref travels with the answers it was computed against. A containment answer is spelled
  // `<base>:contained` and a push-lag sentence names the base, so a client holding the states
  // without the ref can render neither — and re-deriving it from a second route would be a client
  // guessing which base THESE answers used.
  return { spot: containment(project.repoDir, base), lag: pushLag(project.repoDir, base), base };
}

/** The read-only routes, mounted on an app that already carries the run routes. */
export function mountRead(app: Hono, project: Project): Hono {
  app.get('/project', (c) => c.json({
    repoDir: project.repoDir,
    harnessDir: project.harnessDir,
    baseBranch: project.config.repo?.base_branch ?? 'main',
  }));

  app.get('/tickets', (c) => {
    const { spot, lag, base } = gitFacts(project);
    const tickets: WireTicket[] = project.backlog.list().map((ticket) => ticketRow(ticket, spot));
    const body: WireTicketList = { tickets, pushLag: lag, baseBranch: base };
    return c.json(body);
  });

  app.get('/tickets/:id', (c) => {
    const found = ticketFor(project, c.req.param('id') ?? '');
    if ('refusal' in found) return c.json(found.refusal, found.status);
    const { files, excluded } = listTicketFiles(project.backlog.root, found.record);
    // No push lag and no base branch. Push lag is a repository-level fact and belongs on the
    // listing that renders it; the base branch travels with the containment answers it was computed
    // against, which is that listing's envelope. A second claim of either here would be a second
    // place to be wrong about one repository.
    const body: WireTicketDetail = {
      ticket: ticketRow(found.record, gitFacts(project).spot),
      files,
      excluded,
    };
    return c.json(body);
  });

  app.get('/tickets/:id/file', (c) => {
    const found = ticketFor(project, c.req.param('id') ?? '');
    if ('refusal' in found) return c.json(found.refusal, found.status);
    // The path is a QUERY value rather than a path segment, because a relative path holds `/` —
    // `dev/chore/run-2/implement-iter-1.md` is four segments — and a segment would mean the client
    // encoding and this route decoding, which is precisely where a confinement bypass hides. What
    // arrives here is handed to `core` as it stands.
    const rel = c.req.query('path') ?? '';
    const shape = notAFilePath(rel);
    if (shape !== null) return c.json(badRequest('not-a-file-path', shape, FILE_REMEDY), 400);
    // Derived for THIS request, so membership is a fact of the same request rather than of a
    // listing the client fetched earlier — and a path this listing does not hold is refused before
    // anything is opened, which is what makes `.harness/` unreadable as well as unnamed.
    const { files } = listTicketFiles(project.backlog.root, found.record);
    if (!files.some((file) => file.rel === rel)) {
      return c.json(badRequest('not-a-file-path', notListed(rel), FILE_REMEDY), 400);
    }
    // Confinement stays underneath: membership says this route named the path, and `core` says it
    // is inside the ticket folder. Neither replaces the other, and a link planted at a listed name
    // is refused there rather than here.
    const bytes = readTicketFileBytes(project.backlog.root, found.record, rel);
    if (bytes === null) {
      // Narrow and real rather than a dead row: the path was in the listing this request derived,
      // so what this answers is a file that stopped being one between the two — which is also why
      // the body below reports the size of what was READ and never the size that was listed.
      return c.json(badRequest('no-such-file', `${JSON.stringify(rel)} is no longer a file of this ticket`, null), 404);
    }
    const text = asUtf8(bytes);
    if (text === null) {
      return c.json(badRequest('unsupported-file-encoding', notUtf8(rel), null), 422);
    }
    const body: WireTicketFile = { rel, bytes: bytes.length, text };
    return c.json(body);
  });

  app.get('/flows', (c) => {
    // A flow the linter refuses is NAMED and not hidden (Q-0055 AC-16), and the classifier is
    // `problems.length` rather than `flow !== undefined`: `lintFlowDirectory` RETAINS `flow` when
    // it appends cross-flow problems, so a cyclic or ambiguous flow would otherwise read as
    // runnable. That exact mistake is what Q-0055's review round 1 found.
    // The FLOWS directory, not the harness directory — measured against `board.ts:88`, which is
    // the only other caller. Passing the harness dir lints `harness.yaml` itself and reports one
    // record named "harness", which is what the first version of this did.
    const report = lintFlowDirectory(path.join(project.harnessDir, 'flows'));
    const body: WireFlowList = {
      flows: report.map((record): WireFlow => ({
        // `file` is what a `FlowRecord` carries; a `name` lives on the parsed flow, which a refused
        // record does not have. Taking the basename means a refused flow is still NAMED, which is
        // the whole point of listing it.
        name: path.basename(record.file, path.extname(record.file)),
        runnable: record.problems.length === 0,
        consumes: record.flow?.consumes ?? null,
        produces: record.flow?.produces ?? null,
        problems: record.problems,
      })),
    };
    return c.json(body);
  });

  app.get('/history', (c) => {
    const { runs, warnings: unreadable } = readRunsDir(path.join(project.repoDir, RUN_HISTORY_ROOT));
    const rows: WireRunHistoryRow[] = [];
    const warnings: WireRunHistoryWarning[] = [...unreadable];
    for (const run of sortRuns(runs)) {
      const row = historyRow(run);
      if (typeof row === 'string') warnings.push({ runId: run.runId, message: row });
      else rows.push(row);
    }
    // The listing is returned WITH its warnings rather than instead of them — `failSoftly`'s
    // distinction in `packages/cli/src/fail.ts`, which this is the HTTP analogue of. A store a
    // reader could partly read is not an error, and answering 500 would hide every run it could.
    const body: WireRunHistoryList = { runs: rows, warnings };
    return c.json(body);
  });

  app.get('/history/:id', (c) => {
    const token = c.req.param('id') ?? '';
    const read = readRun(path.join(project.repoDir, RUN_HISTORY_ROOT), token);
    // Three outcomes, and the two failures are told apart rather than collapsed: a token naming no
    // run directory is a 404, and one whose manifest could not be parsed is a 422 carrying the
    // reader's own message. Answering 404 to both would report a run that IS there as absent, which
    // is *"A probe that could not answer is not a negative"* (2026-09-10) at this surface.
    if (read.outcome === 'not-a-run') {
      return c.json(badRequest('no-such-run', `no run history under ${JSON.stringify(token)}`, null), 404);
    }
    if (read.outcome === 'malformed') {
      return c.json(badRequest('malformed-manifest', read.message, null), 422);
    }
    return c.json({
      id: read.manifest.run_id,
      manifest: read.manifest,
      incomplete: isIncomplete(read.manifest),
      // Per vendor, never blended: *"Codex cost is reported as tokens, never priced locally"*
      // (2026-08-22). The manifest's own roll-up is one row per vendor and `vendorTokenTotal`
      // reduces ONE row, so summing across rows here would compose exactly the figure that entry
      // refuses — a priced vendor and a token-only one in one number.
      // `readRun`'s own JSDoc calls the parsed document *"a cast, never a check"*, so a hand-edited
      // manifest can carry a `rollup` that is not an array — and `.map()` on it throws where nothing
      // catches, turning one damaged file into a 500 with a stack. Guarded rather than trusted: an
      // unusable roll-up reports no vendors, and the manifest travels whole beside it so a reader
      // still sees what is actually on disk.
      tokensByVendor: Object.fromEntries(
        // The ELEMENTS too, not just the array. Round 2 of the review: `Array.isArray` alone lets
        // `[1, 2, 3]` through, and a number has no `vendor` — so the guard moved the throw from the
        // `.map` to inside it rather than removing it. A row is usable only if it is an object
        // whose `vendor` is a string, which is the one field this reads by name.
        rollupRows(read.manifest.rollup).map((row) => [row.vendor, vendorTokenTotal(row)]),
      ),
      // The sequence number each occurrence's directory carries, which is what orders them for a
      // reader: `occurrenceSeq` reads a directory NAME, not an occurrence.
      steps: (Array.isArray(read.manifest.steps) ? read.manifest.steps : [])
        .filter((step): step is typeof step => typeof step === 'object' && step !== null)
        .map((step) => ({ ...step, seq: occurrenceSeq(step.occurrence_dir) })),
    });
  });

  app.get('/history/:id/retained', (c) => {
    const token = c.req.param('id') ?? '';
    // The keys first, and this route's accepted set is empty: it is answered by the run token
    // alone, so a query value is a selection its sender believes it made. Refused rather than
    // ignored — `occurrence_dir` is not an input to EITHER route under any spelling, and a 200 over
    // a key nobody read tells a client its request was understood.
    const unexpected = unexpectedQuery(c.req.query(), RETAINED_LISTING_QUERY);
    if (unexpected !== null) return c.json(unexpected, 400);
    const read = listRetainedFiles(path.join(project.repoDir, RUN_HISTORY_ROOT), token);
    // The two failures are told apart exactly as `GET /history/:id` tells them apart, and for its
    // reason: answering 404 to both reports a run that IS there as absent.
    if (read.outcome === 'not-a-run') {
      return c.json(badRequest('no-such-run', `no run history under ${JSON.stringify(token)}`, null), 404);
    }
    if (read.outcome === 'malformed') {
      return c.json(badRequest('malformed-manifest', read.message, null), 422);
    }
    // 200 WITH its warnings rather than instead of them, which is the `failSoftly` distinction the
    // listing above already applies to a store — here applied to one run's occurrences, so a single
    // refused directory does not cost a reader the other fifty-four.
    const body: WireRunHistoryRetained = { occurrences: read.occurrences, warnings: read.warnings };
    return c.json(body);
  });

  app.get('/history/:id/file', (c) => {
    const token = c.req.param('id') ?? '';
    // Two QUERY values and no path segment. The occurrence is addressed by the sequence number its
    // listing carries and never by `occurrence_dir`: that field crosses to a browser today only
    // because the detail route spreads a whole manifest occurrence through a loose schema, and it is
    // absent even from that schema's own enumeration of what crosses — so taking it back would
    // ratify an accident as a contract, and would hand this route the one untrusted string it exists
    // to keep out of a client's hands.
    // The keys first, so a request naming something this route does not accept is refused rather
    // than served from the two it does understand while the third is dropped in silence.
    const unexpected = unexpectedQuery(c.req.query(), RETAINED_FILE_QUERY);
    if (unexpected !== null) return c.json(unexpected, 400);
    const asked = c.req.query('occurrence') ?? '';
    const name = c.req.query('name') ?? '';
    // Both are validated before any retained file is read, so a malformed request opens nothing.
    const seq = sequenceValue(asked);
    if (seq === null) return c.json(badRequest('not-a-file-name', notASequence(asked), RETAINED_REMEDY), 400);
    const shape = notARetainedName(name);
    if (shape !== null) return c.json(badRequest('not-a-file-name', shape, RETAINED_REMEDY), 400);
    const read = readRetainedFile(path.join(project.repoDir, RUN_HISTORY_ROOT), token, seq, name);
    if (read.outcome === 'malformed') return c.json(badRequest('malformed-manifest', read.message, null), 422);
    if (read.outcome !== 'file') {
      const refusal = RETAINED_REFUSAL[read.outcome];
      return c.json(badRequest(refusal.code, refusal.condition(seq, name), refusal.remedy), refusal.status);
    }
    const text = asUtf8(read.bytes);
    if (text === null) return c.json(badRequest('unsupported-file-encoding', notUtf8(read.name), null), 422);
    // The size of what was READ and never the size that was listed: this store grows under a reader
    // in ordinary operation, so the listing is what a reader chooses by rather than a promise about
    // what arrives.
    const body: WireRunHistoryRetainedText = { name: read.name, bytes: read.bytes.length, text };
    return c.json(body);
  });

  return app;
}
