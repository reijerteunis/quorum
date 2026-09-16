/**
 * `quorum board` — every ticket by stage, and where each one's code actually is.
 *
 * **Two different facts sit on one row.** The stage is the ticket's own claim about its position in
 * the state machine; the token beside it is git's answer about that ticket's branch, derived on this
 * invocation and stored nowhere. `stage: reviewed` and `main:not-contained(+12)` are routinely both
 * true, and this is the only surface that says so. See Q-0036.
 *
 * **The computation is `core`'s, the sentences are `@quorum/shared`'s, and what is left here is the
 * terminal.** {@link containment} probes the repository once and answers per branch; the three
 * tokens are the closed vocabulary `@quorum/shared`'s `ContainmentResult` declares, and the board
 * says **contained** and never "merged", "landed" or "shipped" (`docs/GLOSSARY.md`). A branch name
 * out of agent-written frontmatter is handed to that interface as a value and is never assembled
 * into a git argument here.
 *
 * **Since Q-0105 there is a third fact, and it belongs to the repository rather than to a row.**
 * {@link pushLag} answers where the base branch itself stands against the upstream it tracks, on the
 * same terms as containment — derived from git on this invocation, stored nowhere, and selected from
 * a closed set. It renders as at most one dim legend and most often as nothing at all; see
 * `pushLagSentence` in `@quorum/shared` for why silence is the common case and why it is never a
 * reassurance.
 *
 * **Q-0017 moved five declarations out of this file and changed no printed byte.**
 * `ALWAYS_RENDERED`, `BRANCH_EXPECTED`, the containment token, the `indeterminate` legend and the
 * push-lag sentence are `@quorum/shared`'s now, because `apps/web` renders the same board and every
 * one of those rules was bought here after a failure. What stays is this surface's own grammar: the
 * `· <name> = ` legend prefix, the space that separates a token from a row, and `c.dim`. A screen
 * that re-derived any of the five would be a second register free to drift — and the two surfaces
 * disagreeing about one repository is the failure a board exists to prevent rather than to cause.
 *
 * The sixth rule, {@link COST_LEGEND}, stayed here because that package may name no vendor in code;
 * `board.test.ts` holds the browser's copy of it byte-identical to this one instead.
 *
 * Why: behaviour preserved from `spike/bin/harness.js:353–398` (Q-0099 AC-3 to AC-6).
 */
import path from 'node:path';

import { containment, lintFlowDirectory, loadProject, ProjectNotFoundError, pushLag } from '@quorum/core';
import {
  ALWAYS_RENDERED, BRANCH_EXPECTED, containmentToken, indeterminateLegend, pushLagSentence, STAGES,
  type Flow, type Ticket,
} from '@quorum/shared';

import type { FlagValue } from './argv.js';
import { c } from './colour.js';
import { dieNoProject } from './fail.js';
import type { CommandHandler } from './main.js';

/**
 * The whole project this command reads, or the spike's sentence and a hard exit where none is there.
 *
 * Why: divergence 3 — a fifth copy of `lint.ts`'s block rather than a shared helper, because a frame
 * module naming `loadProject` is what `frame.source.test.ts`'s AC-10 partition forbids (Q-0099 AC-3);
 * and this command needs all four fields where `lint.ts`'s helper answers one directory.
 * The message is `core`'s, rendered unaltered — this module composes no recovery advice of its own,
 * which is what keeps one sentence in one place. `--project` is passed through per Q-0091 erratum
 * E-6.
 */
function projectOf(project: FlagValue | readonly FlagValue[] | undefined): ReturnType<typeof loadProject> {
  try {
    return loadProject(project as string | undefined);
  } catch (error) {
    if (!(error instanceof ProjectNotFoundError)) throw error;
    return dieNoProject(error.message);
  }
}

/** What {@link flowsIn} read: the flows it could use, and the files the linter refused. */
interface FlowIndex {
  /** The flows whose file lints clean, in filename order — the set a column's hint is chosen from. */
  flows: Flow[];
  /** The basenames of the files that failed to load or lint, in the same order. */
  unreadable: string[];
}

/**
 * The flows in `<harnessDir>/flows`, which is where a column's hint comes from.
 *
 * **A file that failed to load or lint is carried out rather than dropped**, which is Q-0055's half
 * of this function. Taking only the flows made that file vanish from the board entirely, hint and
 * all, with nothing said — so a stage whose only flow had a defect looked exactly like a stage no
 * flow consumes. This function is where the two were conflated, so it is where they are separated;
 * deciding what to say about the second list is {@link unreadableFlowsLegend}'s.
 *
 * **The classifier is `problems`, and `flow` answers a different question.** `lintFlowDirectory`
 * keeps the parsed flow on a record that loaded and then appends the cross-flow problems — a
 * missing, cyclic or ambiguous target — to that same record, so `flow !== undefined` means *it
 * parsed* rather than *it linted*. A flow with a dangling `goto: flow:…` would otherwise keep a
 * `→ quorum run` hint for a command `run.ts`'s own directory lint refuses, and be named nowhere.
 * Classified this way the two lists partition the records, which is what lets the legend say that a
 * refused flow has no hint above rather than that some do not.
 *
 * Why: divergence 1 — the records arrive sorted where the spike's own directory read is unspecified,
 * so the first flow consuming a stage is chosen deterministically; no rendered byte moves and a
 * latent non-determinism goes (Q-0099 AC-3).
 * Why: divergence 2 — a missing directory is a narrow `ENOENT` catch where the spike guards with
 * `fs.existsSync`, because no production module in this package may import `node:fs`. Anything else
 * — a `flows` that is a file, a permissions failure, a lint crash — propagates, as it does in the
 * spike, rather than being reported as "no hint" (Q-0099 AC-3).
 */
function flowsIn(harnessDir: string): FlowIndex {
  try {
    const records = lintFlowDirectory(path.join(harnessDir, 'flows'));
    return {
      // A record with no problem always carries a flow, every failure path recording one, so the
      // second clause narrows the type rather than adding to the rule.
      flows: records.flatMap((record) => (record.problems.length || record.flow === undefined ? [] : [record.flow])),
      unreadable: records.filter((record) => record.problems.length).map((record) => path.basename(record.file)),
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    return { flows: [], unreadable: [] };
  }
}

/**
 * The flow files this board could not read, or nothing at all.
 *
 * **It names them and says nothing about the others**, which is the whole shape of it. A flow that
 * fails to load or lint has no `→ quorum run` hint above, and until Q-0055 that absence was
 * indistinguishable from a stage no flow consumes — the board's own silence standing for two
 * different facts. This line separates them by reporting only the one it knows.
 *
 * Under the same rule push lag is under: **it may warn and it may never reassure.** It carries no
 * count of problems, no verdict about the readable files, and nothing resembling "all flows valid"
 * — `quorum lint` is the check and this is a report, so an empty list prints nothing at all and
 * silence still means only that there was nothing to say. See *"The board reports push lag, and
 * never a CI conclusion"* (2026-09-06), whose asymmetry this follows.
 *
 * It borrows none of containment's grammar either: no `<base>:` token, no per-row annotation.
 */
const unreadableFlowsLegend = (unreadable: readonly string[]): string | null => (unreadable.length === 0
  ? null
  : `· could not read = ${unreadable.join(', ')} — a flow that fails to load or lint has no`
    + ' → quorum run hint above; quorum lint says why');

/**
 * What a billed cost figure cannot see, in the sentence that has to travel with it.
 *
 * A ticket's own `history` records the price a vendor reported, and a vendor that reports none
 * contributes nothing to it — measured over this repository, 276 of 665 billed occurrences, every
 * one of them on the token-only vendor. So the figure omits two fifths of the work and this sentence
 * is the only thing that says so: an unlabelled total reads as the cost of the run. See *"Codex cost
 * is reported as tokens, never priced locally"* (2026-08-22).
 *
 * **This is the one board rule Q-0017 could NOT move to `@quorum/shared`**, and the reason is a
 * landed guard rather than an oversight: `events.test.ts`'s AC-9 refuses a vendor name in code
 * anywhere under that package, because vendor identity there is one neutral, open label. So
 * `apps/web/src/backlog-board.tsx` carries the same sentence and `board.test.ts` holds the two
 * byte-identical — one register kept by a guard instead of by an import, which is Q-0068 AC-6's
 * arrangement at a second site.
 */
export const COST_LEGEND =
  'billed cost where the vendor reports one; steps on token-only vendors (codex) are not included';

/**
 * One ticket's line: its id, its title, and the dim span carrying everything measured about it.
 *
 * `cost` is the same sum `@quorum/server` sends a browser as `billedCostUsd`, with one deliberate
 * divergence recorded rather than repaired: this prints `$0.00` where a ticket has no history at
 * all, and the wire sends `null`. Nothing has run is not the claim that it cost nothing, so the
 * wire's answer is the right one — but not a printed byte of this command moves on this ticket
 * (Q-0017 non-goal 7), so the divergence is registered here and belongs to whoever is sent to
 * change what `quorum board` prints.
 */
const row = (meta: Ticket, annotation: string): string => {
  const cost = (meta.history ?? []).reduce((total, entry) => total + (entry.cost ?? 0), 0);
  const iterations = JSON.stringify(meta.iterations ?? {});
  return `  ${c.teal(meta.id)} ${meta.title}  `
    + c.dim(`owner=${meta.owner} cost=$${cost.toFixed(2)} iter=${iterations}${annotation}`);
};

/** The tickets by stage, each row annotated with where its branch stands against the base branch. */
export const board: CommandHandler = ({ flags }) => {
  const { backlog, harnessDir, repoDir, config } = projectOf(flags.project);
  const tickets = backlog.list();
  const { flows, unreadable } = flowsIn(harnessDir);
  const base = config.repo?.base_branch ?? 'main';
  const where = containment(repoDir, base);
  let anyIndeterminate = false;
  for (const stage of STAGES) {
    const column = tickets.filter((ticket) => ticket.meta.stage === stage);
    if (!column.length && !ALWAYS_RENDERED.includes(stage)) continue;
    const next = flows.find((flow) => flow.consumes === stage);
    // The empty span is the spike's too: a column with no consuming flow emits `dim('')`.
    console.log(c.bold(stage.padEnd(14)) + c.dim(next ? `→ quorum run ${next.name} <id>` : ''));
    for (const ticket of column) {
      const found = where?.stateOf(ticket.meta.branch);
      const spot = found?.reason === 'no branch' && !BRANCH_EXPECTED.has(ticket.meta.stage)
        ? null
        : found;
      if (spot?.state === 'indeterminate') anyIndeterminate = true;
      // The token is `@quorum/shared`'s and the separating space is this surface's: a terminal row
      // and a table cell separate differently, and the sentence is what the two must share.
      console.log(row(ticket.meta, spot == null ? '' : ` ${containmentToken(spot, base)}`));
    }
  }
  // First of the legends, because it is the only one that explains something MISSING from the
  // output above rather than qualifying something in it: a column whose hint is absent because its
  // flow could not be read is the reader's most urgent question, and it is answered nowhere else.
  const unread = unreadableFlowsLegend(unreadable);
  if (unread !== null) console.log(c.dim(unread));
  // The roll-up can only see vendors that report a price, and saying so is the whole point of the
  // tokens-only decision (2026-08-22): an unlabelled total reads as the cost of the run.
  if (tickets.some((ticket) => (ticket.meta.history ?? []).length)) {
    console.log(c.dim(`· cost = ${COST_LEGEND}`));
  }
  // Indeterminate means git could not answer here, not that the code is missing — a fresh or shallow
  // clone legitimately cannot say. Armed by a row that actually rendered one, so a suppressed
  // `no branch` never prints a legend for a token nobody saw.
  if (anyIndeterminate) {
    console.log(c.dim(`· indeterminate = ${indeterminateLegend(base)}`));
  }
  // The one repository-level fact on this board: where the base itself stands against its upstream.
  // Unconditional on the tickets, because it is a property of the repository rather than of any row
  // — an empty backlog can still be holding commits nobody has pushed.
  const lag = pushLag(repoDir, base);
  const sentence = lag === null ? null : pushLagSentence(lag, base);
  if (sentence !== null) console.log(c.dim(`· push lag = ${sentence}`));
};
