// Containment: the git-derived relationship between a ticket branch tip and the configured base
// branch, expressed as a closed set of states and two closed sets of reasons. Declarations only —
// the derivation lives in packages/core's git module (Q-0042) and the rendering in the CLI
// (Q-0010), and neither may spell one of these strings a second time.
//
// The vocabulary is docs/GLOSSARY.md's. This module says "contained" and never "merged", "landed"
// or "shipped": an ancestry fact about two refs at the moment of reading is not a claim about how
// the code arrived. Every value below was bought after a failure — see docs/DECISIONS.md,
// "Containment is derived from git on each board invocation, never stored" (2026-08-24) and "The
// erratum is closed: the sentence was true, and it was still the wrong sentence" (2026-08-25).
//
// ---------------------------------------------------------------------------------------------
// TWO REASON SETS, BECAUSE TWO SURFACES ASK
// ---------------------------------------------------------------------------------------------
//
// The board asks about a ticket branch in a repository it has already probed successfully, so it
// reaches three reasons. The empty-range diagnostic asks about a range in a repository whose
// shallow probe may itself have failed, so it reaches a fourth — `shallow state unknown`.
// GLOSSARY.md lists the board's three for exactly that structural reason, and the difference is
// recorded here so it reads as structure rather than as an omission.
//
// ---------------------------------------------------------------------------------------------
// THE RESULT SHAPES MAKE THE IMPOSSIBLE COMBINATIONS UNREPRESENTABLE
// ---------------------------------------------------------------------------------------------
//
// A proven state carries no reason, a contained result carries no ahead count, and an
// indeterminate result carries nothing but a reason from its own set. The `?: never` members are
// not decoration: without them an object typed as one variant is assignable to another whenever
// its extra key happens to be absent from the target's declaration, so the claim would hold for
// object literals and quietly fail for everything else.

/**
 * Exactly three, and they are selected from git's own exit codes: 0 contained, 1 provably not
 * contained, anything else indeterminate. "Not contained" is never inferred from a failure, a
 * timeout or an absent binary.
 */
export const CONTAINMENT_STATES = ['contained', 'not-contained', 'indeterminate'] as const;

export type ContainmentState = (typeof CONTAINMENT_STATES)[number];

/**
 * Why the ancestry primitive could not answer.
 *
 * - `git failed` — any exit that is neither 0 nor 1, a signal, a spawn failure, a timeout, or no
 *   git on the path at all.
 * - `shallow clone` — an exit 1 in a repository known to be shallow: history that is absent cannot
 *   disprove ancestry, so a provable negative becomes an honest "don't know".
 * - `shallow state unknown` — an exit 1 when the shallow probe itself could not answer. Reading an
 *   unanswered probe as "not shallow" would hand back the confident negative through the side
 *   door. Reachable only through the empty-range diagnostic; see the note above.
 */
export const ANCESTRY_REASONS = ['git failed', 'shallow clone', 'shallow state unknown'] as const;

export type AncestryReason = (typeof ANCESTRY_REASONS)[number];

/**
 * Why the board could not answer, which is the ancestry set minus the one reason a probed
 * repository cannot reach, plus the one the board asks about first.
 *
 * - `missing ref` — the configured base branch does not resolve.
 * - `shallow clone` — as above.
 * - `git failed` — as above, including a failure of the ahead count itself.
 */
export const CONTAINMENT_REASONS = ['missing ref', 'shallow clone', 'git failed'] as const;

export type ContainmentReason = (typeof CONTAINMENT_REASONS)[number];

/**
 * What the ancestry primitive returns. Every result carries all four keys, so a caller reading
 * `detail` or `command` never has to test for their presence.
 *
 * `command` is the check that was run, quoted precisely enough for a reader to re-run it by hand.
 * `detail` is git's own first line, normalised, and is never load-bearing: no state and no reason
 * is derived from its text.
 */
export type AncestryResult =
  | { state: 'contained'; reason: null; detail: null; command: string }
  | { state: 'not-contained'; reason: null; detail: null; command: string }
  | { state: 'indeterminate'; reason: AncestryReason; detail: string | null; command: string };

/**
 * What the board renders beside a ticket, as one of `<base>:contained`,
 * `<base>:not-contained(+12)` or `<base>:indeterminate(<reason>)`. The ahead count is the commits
 * reachable from the branch and not from the base — not the symmetric difference — and exists only
 * on a proven negative.
 */
export type ContainmentResult =
  | { state: 'contained'; reason?: never; ahead?: never }
  | { state: 'not-contained'; ahead: number; reason?: never }
  | { state: 'indeterminate'; reason: ContainmentReason; ahead?: never };

/**
 * A compile-time proof that both result shapes draw their `state` from the tuple above and from
 * nowhere else: a variant added with an unlisted state violates `Assert`'s constraint and stops
 * the build here, rather than reaching a renderer that has no token for it. It has to be an
 * unsatisfied constraint — a conditional type that merely evaluates to `never` compiles cleanly
 * and would prove nothing.
 */
type Assert<T extends true> = T;

type StatesAreClosed = [
  Assert<AncestryResult['state'] extends ContainmentState ? true : false>,
  Assert<ContainmentResult['state'] extends ContainmentState ? true : false>,
];

/** Exported so the proof above is not dead code; it carries no runtime value and no information. */
export type { StatesAreClosed };
