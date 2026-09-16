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
 * Why: deliberate addition, not preservation — Q-0119.
 */
import path from 'node:path';

import {
  containment, isIncomplete, lintFlowDirectory, occurrenceSeq, pushLag,
  readRun, readRunsDir, sortRuns, vendorTokenTotal, type Project, type VendorRollup,
} from '@quorum/core';
import { Hono } from 'hono';

import {
  RUN_HISTORY_ROOT,
  type TicketHistoryEntry, type WireFlow, type WireFlowList, type WireTicket, type WireTicketList,
} from '@quorum/shared';

import { badRequest } from './wire.js';

export type { WireFlow, WireFlowList, WireTicket, WireTicketList };



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
 */
function billedCostOf(history: TicketHistoryEntry[] | undefined): number | null {
  if (history === undefined || history.length === 0) return null;
  return history.reduce((total, entry) => total + (entry.cost ?? 0), 0);
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
    const tickets: WireTicket[] = project.backlog.list().map((ticket) => ({
      id: String(ticket.meta.id),
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
    }));
    const body: WireTicketList = { tickets, pushLag: lag, baseBranch: base };
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
