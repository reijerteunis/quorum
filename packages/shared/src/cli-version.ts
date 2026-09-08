/**
 * The verified version: how the CLI version an adapter runs against compares with the one that
 * adapter was last verified against, as a closed set of states.
 *
 * Declarations only. `packages/core`'s adapter contract layer derives, the CLI renders, and neither
 * may spell one of these strings a second time.
 *
 * Why: see *"An adapter records the version it was verified against, and never a version it
 * supports"* (2026-09-08) and `docs/GLOSSARY.md`'s **Verified version**, which carry what the datum
 * is and is not.
 */

/**
 * Exactly four. `as-verified` says the two version strings are equal and nothing further; a version
 * that cannot be read answers `indeterminate`, which is never inferred as one of the other three.
 */
export const CLI_VERSION_STATES = ['as-verified', 'ahead', 'behind', 'indeterminate'] as const;

export type CliVersionState = (typeof CLI_VERSION_STATES)[number];

/**
 * What a surface renders: the state, the version string the CLI reported, and the one the adapter
 * records having been verified against. Both strings are carried unparsed.
 *
 * The two arms make the impossible combination unrepresentable. A comparison happened only where
 * both sides could be read, so `indeterminate` is the one arm whose `verified` may be `null` and the
 * one a vendor with no record can reach. The first arm derives its states from the tuple above
 * rather than listing them, so a fourth comparable state lands here too.
 */
export type CliVersionResult =
  | { state: Exclude<CliVersionState, 'indeterminate'>; installed: string; verified: string }
  | { state: 'indeterminate'; installed: string; verified: string | null };
