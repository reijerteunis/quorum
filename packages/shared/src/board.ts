// The rules a backlog board renders by, in one place, because two surfaces now render one board.
//
// Every declaration below was `packages/cli/src/board.ts`'s until Q-0017, and each was bought after
// a failure: which empty columns render at all, when a branch that does not exist is worth saying,
// how a containment answer is spelled, and what `indeterminate` may and may not be read as, plus
// the push-lag sentence that may warn and may never reassure. A screen that re-derived any of them
// beside the command would be a second register free to drift — and a board and a screen
// disagreeing about one repository is the failure a board exists to prevent rather than to cause.
//
// The sixth rule, the cost legend, could not follow them here and the note at the foot of this file
// says why.
//
// Declarations and pure functions over strings, which is what this package is (`index.ts`). Nothing
// here renders a colour, an escape byte or a layout: `packages/cli` wraps what it takes in `c.dim`
// and prefixes its own `· <name> = ` legend grammar, and `apps/web` puts it in an element. The
// SENTENCE is shared; the presentation is not.
//
// The vocabulary is docs/GLOSSARY.md's. Every function here says "contained" and never "merged",
// "landed" or "shipped", and none of the push-lag text may carry wording equivalent to "CI passed",
// "verified" or "not validated" — see "Containment is derived from git on each board invocation,
// never stored" (2026-08-24) and "The board reports push lag, and never a CI conclusion"
// (2026-09-06).
import type { ContainmentResult } from './containment.js';
import type { PushLagResult } from './push-lag.js';
import { STAGES } from './stages.js';

/**
 * The stages whose column renders even when it holds nothing.
 *
 * The three a project has before any work has moved — `draft`, `requirements` and `solutioned`, the
 * first three of `STAGES` — because a board that showed a stranger nothing at all would answer
 * "there is no backlog" where the truth is "there is nothing in it yet".
 *
 * **Taken as a slice rather than written out, and that is `stages.test.ts`'s rule rather than a
 * flourish**: only `stages.ts` may hold a stage name as a string literal in this package, so that a
 * second hand-written list is a visible act. The positions are what the rule is actually about —
 * these are the stages *before* any work has moved — and `board.test.ts` pins the three members by
 * name, so a `STAGES` somebody reorders fails there rather than silently changing which columns a
 * fresh project shows.
 */
export const ALWAYS_RENDERED: readonly string[] = STAGES.slice(0, 3);

/**
 * The stages at which a branch that does not exist is worth saying.
 *
 * Every ticket names a branch from creation and only an `integrate` step ever creates one, so most
 * name a ref that is not there. Reporting all of them would drown the column; reporting them where
 * the stage claims the work is done separates code nobody can locate from a ticket nobody has
 * started. See Q-0070.
 *
 * `solutioned` onward through `deployed` — positions 2 to 7, which is every stage but the two before
 * any work has moved and the two terminal ones no flow consumes. Sliced for {@link ALWAYS_RENDERED}'s
 * reason, and pinned by name in `board.test.ts` for the same one.
 */
export const BRANCH_EXPECTED: ReadonlySet<string> = new Set(STAGES.slice(2, 8));

/**
 * One containment answer, spelled the one way this product spells it.
 *
 * `<base>:contained`, `<base>:not-contained(+12)`, `<base>:indeterminate(<reason>)`, and no leading
 * space — the separator is the surface's, because a terminal row and a table cell separate
 * differently and neither should have to strip the other's.
 */
export function containmentToken(spot: ContainmentResult, base: string): string {
  if (spot.state === 'contained') return `${base}:contained`;
  if (spot.state === 'not-contained') return `${base}:not-contained(+${String(spot.ahead)})`;
  return `${base}:indeterminate(${spot.reason})`;
}

/**
 * What `indeterminate` means, which is the half a token cannot carry.
 *
 * It says git could not answer and it says, in as many words, that this is not a claim that the code
 * is missing. A surface that renders the token without this sentence is inviting exactly the reading
 * the closed state set exists to refuse.
 */
export const indeterminateLegend = (base: string): string =>
  `the board cannot say whether that branch is contained in ${base} — git could not answer (missing`
  + " ref, shallow clone, a failed git command), or the ticket's branch does not exist (no branch)"
  + ' — it does not mean the code is missing';

/**
 * The push-lag sentence, or nothing at all.
 *
 * **Silence means git answered and there was nothing to say** — never that anything was checked
 * anywhere. Two states are silent and they are silent for different reasons: `pushed`, where the
 * upstream already holds every commit the base does, and `no remote`, where the repository has
 * nowhere to push and an adopter who has just run `quorum init` would otherwise meet a line about a
 * remote they do not have. Everything else speaks, because an instrument that cannot answer has to
 * say so: reporting success over an unexamined subject is the failure of 2026-08-25.
 *
 * The asymmetry is the design. A `git push` updates the tracking ref locally, so absent a fetch this
 * count can only be too large — which is why the sentence carries *as of the last fetch* and why
 * **it may warn and may never reassure**. It names commits that have not been pushed and makes no
 * claim about anything having been run anywhere.
 *
 * It borrows none of containment's grammar: no `<base>:` token, so a repository-level fact can never
 * be misread as an annotation about a ticket.
 */
export function pushLagSentence(lag: PushLagResult, base: string): string | null {
  if (lag.state === 'pushed' || lag.reason === 'no remote') return null;
  if (lag.state === 'unpushed') {
    const commits = `${String(lag.ahead)} commit${lag.ahead === 1 ? '' : 's'}`;
    return `${base} holds ${commits} that ${lag.upstream} does not, as of the last fetch`
      + ' — they have not been pushed, which is the whole of what this says';
  }
  return `the board cannot say whether ${base} has been pushed (${lag.reason}), as of the last fetch`;
}

// The sixth board rule — the cost legend — is deliberately NOT here, and the reason is a landed
// guard rather than an oversight. `events.test.ts`'s AC-9 refuses a vendor name in code anywhere
// under this package's `src`, because vendor identity is one neutral, open label and this is the
// package that must know nothing about any vendor; the legend names a vendor by design, that being
// the whole of what it discloses. Assembling the name out of fragments to get past the scan is the
// obfuscation `turbo-inputs.test.ts` already refuses in its own domain, and weakening the scan to
// permit a string literal would be trading a landed property for a convenience.
//
// So that sentence stays in `packages/cli/src/board.ts`, `apps/web/src/backlog-board.tsx` carries
// the same one, and `packages/cli/src/board.test.ts` holds the two byte-identical — the
// Q-0068 AC-6 arrangement, where a document's quotation of a thrown sentence is pinned against the
// literal rather than imported from it. One register enforced by a guard instead of by an import,
// because an import is the thing this package may not offer.
