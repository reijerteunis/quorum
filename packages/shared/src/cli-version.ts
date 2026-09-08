// The verified version: the relationship between the CLI version an adapter is running against and
// the one that adapter was last verified against, expressed as a closed set of states. Declarations
// only — the derivation lives in packages/core's adapter contract layer and the rendering in the
// CLI, and neither may spell one of these strings a second time.
//
// A sibling of containment.ts and push-lag.ts rather than an addition to either, because it is a
// third SUBJECT under the same rules: derive on every invocation, persist nothing, select from a
// closed set, and never report an unanswerable question as one of the answerable states. See
// docs/DECISIONS.md, "An adapter records the version it was verified against, and never a version
// it supports" (2026-09-08).
//
// ---------------------------------------------------------------------------------------------
// A PAST MEASUREMENT, NEVER A POLICY
// ---------------------------------------------------------------------------------------------
//
// The recorded string answers "which version was this checked against?" and nothing else. There is
// no ceiling, no floor and no range, so no state here means "unsupported", nothing branches on one,
// and none of them changes an exit code. A stale range would REFUSE a working CLI; a stale record
// merely says nobody has re-verified, which is the truth and is what makes it worth keeping.
//
// ---------------------------------------------------------------------------------------------
// PROVENANCE, NEVER A SECOND VERDICT
// ---------------------------------------------------------------------------------------------
//
// The only compatibility evidence this product has is a successful `adapters --probe` — a
// round-trip that actually worked — and that is already reported as `login`. A state here says what
// that evidence was collected against. `as-verified` is deliberately not spelled `verified`: the
// same report carries `login: 'verified'`, and two unrelated facts sharing a word on one line is how
// a reader comes to believe the wrong one.

/**
 * Exactly four. `as-verified` is "the two version strings are equal", which is a statement about two
 * numbers; it is never read as a claim that a flag still exists or that anything was tested.
 *
 * `indeterminate` is what a version that cannot be read answers, and it is never inferred as one of
 * the other three — the closed-set discipline containment and push lag are already under.
 */
export const CLI_VERSION_STATES = ['as-verified', 'ahead', 'behind', 'indeterminate'] as const;

export type CliVersionState = (typeof CLI_VERSION_STATES)[number];

/**
 * What a surface renders: the state, the version string the CLI reported, and the one the adapter
 * records having been verified against.
 *
 * Both strings are carried **unparsed**, because they are what a reader has to be shown: the
 * comparison is over the first `<major>.<minor>.<patch>` in each, and a string that has none of
 * those is exactly the case `indeterminate` exists for.
 *
 * The two arms make the impossible combination unrepresentable. A comparison happened only where
 * both sides could be read, so `as-verified`, `ahead` and `behind` carry a recorded string that is
 * there; `indeterminate` is the one state a vendor with **no** record can reach, and the only arm
 * whose `verified` may be `null`. The first arm derives its states from the tuple above rather than
 * listing them, so a fourth comparable state cannot be added there without landing here too.
 */
export type CliVersionResult =
  | { state: Exclude<CliVersionState, 'indeterminate'>; installed: string; verified: string }
  | { state: 'indeterminate'; installed: string; verified: string | null };
