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
 * Why: deliberate addition, not preservation — Q-0119.
 */
import path from 'node:path';

import {
  containment, isIncomplete, isOneName, lintFlowDirectory, listTicketFiles, occurrenceSeq, pushLag,
  readRun, readRunsDir, readTicketFileBytes, sortRuns, vendorTokenTotal,
  type Project, type TicketRecord, type VendorRollup,
} from '@quorum/core';
import { Hono } from 'hono';

import {
  RUN_HISTORY_ROOT,
  type TicketHistoryEntry, type WireFlow, type WireFlowList, type WireRefusal, type WireTicket,
  type WireTicketDetail, type WireTicketFile, type WireTicketList,
} from '@quorum/shared';

import { badRequest } from './wire.js';

export type {
  WireFlow, WireFlowList, WireTicket, WireTicketDetail, WireTicketFile, WireTicketList,
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
 * own backlog contain U+FFFD legitimately, so a scan for that character would report hand-written
 * markdown as binary on the day it shipped.
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
    const { runs, warnings } = readRunsDir(path.join(project.repoDir, RUN_HISTORY_ROOT));
    // The listing is returned WITH its warnings rather than instead of them — `failSoftly`'s
    // distinction in `packages/cli/src/fail.ts`, which this is the HTTP analogue of. A store a
    // reader could partly read is not an error, and answering 500 would hide every run it could.
    return c.json({
      runs: sortRuns(runs).map((run) => ({
        id: run.runId,
        ticket: run.manifest.ticket_id,
        flow: run.manifest.flow,
        status: run.manifest.status,
        // Reported, never repaired: `docs/04-architecture.md` is explicit that a server must not
        // tidy a `running` manifest it meets on read. A run that was interrupted looks incomplete
        // because it IS, and saying so is the whole value of the field.
        incomplete: isIncomplete(run.manifest),
      })),
      warnings,
    });
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

  return app;
}
