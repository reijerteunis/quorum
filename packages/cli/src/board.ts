/**
 * `quorum board` — every ticket by stage, and where each one's code actually is.
 *
 * **Two different facts sit on one row.** The stage is the ticket's own claim about its position in
 * the state machine; the token beside it is git's answer about that ticket's branch, derived on this
 * invocation and stored nowhere. `stage: reviewed` and `main:not-contained(+12)` are routinely both
 * true, and this is the only surface that says so. See Q-0036.
 *
 * **The computation is `core`'s and the rendering is this module's**, which is the whole of what
 * this file is. {@link containment} probes the repository once and answers per branch; the three
 * tokens below are the closed vocabulary `@quorum/shared`'s `ContainmentResult` declares, and the
 * board says **contained** and never "merged", "landed" or "shipped" (`docs/GLOSSARY.md`). A branch
 * name out of agent-written frontmatter is handed to that interface as a value and is never
 * assembled into a git argument here.
 *
 * **Since Q-0105 there is a third fact, and it belongs to the repository rather than to a row.**
 * {@link pushLag} answers where the base branch itself stands against the upstream it tracks, on the
 * same terms as containment — derived from git on this invocation, stored nowhere, and selected from
 * a closed set. It renders as at most one dim legend and most often as nothing at all; see
 * {@link pushLagLegend} for why silence is the common case and why it is never a reassurance.
 *
 * Why: behaviour preserved from `spike/bin/harness.js:353–398` (Q-0099 AC-3 to AC-6).
 */
import path from 'node:path';

import { containment, lintFlowDirectory, loadProject, ProjectNotFoundError, pushLag } from '@quorum/core';
import { STAGES, type ContainmentResult, type Flow, type PushLagResult, type Ticket } from '@quorum/shared';

import type { FlagValue } from './argv.js';
import { c } from './colour.js';
import { die } from './fail.js';
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
    return die(error.message);
  }
}

/**
 * The flows in `<harnessDir>/flows`, which is where a column's hint comes from.
 *
 * Why: divergence 1 — the records arrive sorted where the spike's own directory read is unspecified,
 * so the first flow consuming a stage is chosen deterministically; no rendered byte moves and a
 * latent non-determinism goes (Q-0099 AC-3).
 * Why: divergence 2 — a missing directory is a narrow `ENOENT` catch where the spike guards with
 * `fs.existsSync`, because no production module in this package may import `node:fs`. Anything else
 * — a `flows` that is a file, a permissions failure, a lint crash — propagates, as it does in the
 * spike, rather than being reported as "no hint" (Q-0099 AC-3).
 */
function flowsIn(harnessDir: string): Flow[] {
  try {
    return lintFlowDirectory(path.join(harnessDir, 'flows'))
      .flatMap((record) => (record.flow === undefined ? [] : [record.flow]));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    return [];
  }
}

/**
 * The stages whose column renders even when it holds nothing.
 *
 * The three a project has before any work has moved: a board that showed a stranger nothing at all
 * would answer "there is no backlog" where the truth is "there is nothing in it yet".
 */
const ALWAYS_RENDERED: readonly string[] = ['draft', 'requirements', 'solutioned'];

/**
 * The stages at which a branch that does not exist is worth saying.
 *
 * Every ticket names a branch from creation and only an `integrate` step ever creates one, so most
 * name a ref that is not there. Reporting all of them would drown the column; reporting them where
 * the stage claims the work is done separates code nobody can locate from a ticket nobody has
 * started. See Q-0070.
 */
const BRANCH_EXPECTED: ReadonlySet<string> = new Set([
  'solutioned', 'red', 'green', 'reviewed', 'qa-passed', 'deployed',
]);

/** One containment answer as the board writes it, with the leading space that separates it. */
const token = (spot: ContainmentResult, base: string): string => {
  if (spot.state === 'contained') return ` ${base}:contained`;
  if (spot.state === 'not-contained') return ` ${base}:not-contained(+${String(spot.ahead)})`;
  return ` ${base}:indeterminate(${spot.reason})`;
};

/**
 * The push-lag legend, or nothing at all.
 *
 * **Silence means git answered and there was nothing to say** — never that anything was checked
 * anywhere. Two states are silent and they are silent for different reasons: `pushed`, where the
 * upstream already holds every commit the base does, and `no remote`, where the repository has
 * nowhere to push and an adopter who has just run `quorum init` would otherwise meet a line about a
 * remote they do not have. Everything else prints, because an instrument that cannot answer has to
 * say so: reporting success over an unexamined subject is the failure of 2026-08-25.
 *
 * The asymmetry is the design. A `git push` updates the tracking ref locally, so absent a fetch this
 * count can only be too large — which is why the sentence carries *as of the last fetch* and why
 * **this line may warn and may never reassure**. It names commits that have not been pushed and it
 * makes no claim about anything having been run elsewhere; a reader who takes it for one is
 * repeating the failure the ticket was opened for. See "The board reports push lag, and never a CI
 * conclusion" (2026-09-06).
 *
 * It borrows none of containment's grammar: no `<base>:` token, so a repository-level fact can never
 * be misread as an annotation about a ticket, and none of the words that vocabulary has already
 * spent.
 */
const pushLagLegend = (lag: PushLagResult, base: string): string | null => {
  if (lag.state === 'pushed' || lag.reason === 'no remote') return null;
  if (lag.state === 'unpushed') {
    const commits = `${String(lag.ahead)} commit${lag.ahead === 1 ? '' : 's'}`;
    return `· push lag = ${base} holds ${commits} that ${lag.upstream} does not, as of the last fetch`
      + ' — they have not been pushed, which is the whole of what this says';
  }
  return `· push lag = the board cannot say whether ${base} has been pushed (${lag.reason}),`
    + ' as of the last fetch';
};

/** One ticket's line: its id, its title, and the dim span carrying everything measured about it. */
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
  const flows = flowsIn(harnessDir);
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
      console.log(row(ticket.meta, spot == null ? '' : token(spot, base)));
    }
  }
  // The roll-up can only see vendors that report a price, and saying so is the whole point of the
  // tokens-only decision (2026-08-22): an unlabelled total reads as the cost of the run.
  if (tickets.some((ticket) => (ticket.meta.history ?? []).length)) {
    console.log(c.dim('· cost = billed cost where the vendor reports one; steps on token-only vendors (codex) are not included'));
  }
  // Indeterminate means git could not answer here, not that the code is missing — a fresh or shallow
  // clone legitimately cannot say. Armed by a row that actually rendered one, so a suppressed
  // `no branch` never prints a legend for a token nobody saw.
  if (anyIndeterminate) {
    console.log(c.dim(`· indeterminate = the board cannot say whether that branch is contained in ${base} — git could not answer (missing ref, shallow clone, a failed git command), or the ticket's branch does not exist (no branch) — it does not mean the code is missing`));
  }
  // The one repository-level fact on this board: where the base itself stands against its upstream.
  // Unconditional on the tickets, because it is a property of the repository rather than of any row
  // — an empty backlog can still be holding commits nobody has pushed.
  const lag = pushLag(repoDir, base);
  const legend = lag === null ? null : pushLagLegend(lag, base);
  if (legend !== null) console.log(c.dim(legend));
};
