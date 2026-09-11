/**
 * What a refusal is, and the one remedy this surface composes.
 *
 * *"A `core` error names the condition; the remedy belongs to the surface"* (2026-09-07) was ruled
 * for this package by name: `core` says *what is wrong*, and the sentence that tells somebody what
 * to do about it is written where the somebody is known.
 *
 * **This module takes the condition as a string, and that is the whole of its discipline.**
 * `packages/cli/src/fail.ts`'s `dieNoProject` is the shape it mirrors: the module that owns the
 * remedy names no symbol of the library whose failure it is composing a remedy for, so it cannot
 * drift into deciding *which* failure this is. Deciding that is the caller's, exactly as
 * `packages/cli/src/lint.ts:55–56` does it — an `instanceof` there, a string here. `failures.ts` is
 * this package's equivalent of those six call sites.
 *
 * **A server's remedy is not a shell imperative.** That entry's own reasoning is that this surface
 * serves *"somebody who may not have a shell"*, so the CLI's *run-this-command* sentence appears in
 * nothing this package produces: what it offers instead is the fact a caller can act on over HTTP —
 * what a directory has to hold for this server to open it.
 *
 * **A refusal is a value, not a throw.** The transport above this maps it to a status code and a
 * body (Q-0118), and a condition carried as data is one it can classify without reading prose. The
 * `condition` is the failing library's own sentence, unaltered and never paraphrased, so two
 * surfaces cannot drift into describing one failure two ways.
 *
 * @see ./failures.ts — where the classification lives, and the only caller of {@link noProjectRefusal}.
 */

/** What did not happen, in the two parts that have two different owners. */
export interface Refusal {
  /** The condition, in the failing library's own words where it named one. Never rewritten here. */
  readonly condition: string;
  /** What this surface offers the caller, or `null` where it has nothing to add to the condition. */
  readonly remedy: string | null;
}

/**
 * The remedy for a project that is not there — the one imperative this package composes.
 *
 * A statement about configuration rather than a command to type, because the caller may be a browser
 * and this sentence may end up in a response body.
 */
export const NO_PROJECT_REMEDY = 'point the server at a directory holding harness/harness.yaml';

/**
 * A condition this surface has nothing to add to.
 *
 * The bare shape rather than a second remedy: a refusal with no remedy is the ordinary case, and
 * building it here is what keeps {@link Refusal} constructed in one module.
 */
export function refusalOf(condition: string): Refusal {
  return { condition, remedy: null };
}

/**
 * The condition of a project that is not there, with {@link NO_PROJECT_REMEDY} attached.
 *
 * Takes the condition rather than the error, which is what lets this module name nothing of the
 * library that threw it. The caller has already decided this is that failure.
 */
export function noProjectRefusal(condition: string): Refusal {
  return { condition, remedy: NO_PROJECT_REMEDY };
}
