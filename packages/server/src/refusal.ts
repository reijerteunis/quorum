/**
 * The boundary where a `core` failure becomes something a surface can render, and the one remedy
 * this surface offers.
 *
 * *"A `core` error names the condition; the remedy belongs to the surface"* (2026-09-07) was ruled
 * for this package by name: `core` says *what is wrong*, and the sentence that tells somebody what
 * to do about it is written where the somebody is known. `packages/cli/src/fail.ts`'s
 * `dieNoProject` is the shape — one site, taking the condition as a **string** so the module that
 * owns the remedy names no `core` symbol.
 *
 * **A server's remedy is not a shell imperative.** That entry's own reasoning is that this surface
 * serves *"somebody who may not have a shell"*, so the CLI's *run-this-command* sentence appears in
 * nothing this package produces: what it offers instead is the fact a caller can act on over HTTP —
 * what a directory has to hold for this server to open it.
 *
 * **A refusal is a value, not a throw.** The transport above this maps it to a status code and a
 * body (Q-0118), and a condition carried as data is one it can classify without reading prose. The
 * `condition` is `core`'s own sentence, unaltered and never paraphrased, so two surfaces cannot
 * drift into describing one failure two ways.
 */
import { loadProject, ProjectNotFoundError } from '@quorum/core';
import type { Project } from '@quorum/core';

/** What did not happen, in the two parts that have two different owners. */
export interface Refusal {
  /** The condition, in `core`'s own words where `core` named one. Never rewritten here. */
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

/** Whatever was thrown, as the sentence a surface renders — never a stack, and never `[object Object]`. */
const conditionOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/**
 * Turn whatever `core` threw into a refusal a surface can render.
 *
 * The one site that decides whether this surface has a remedy to add, so a second failure class that
 * earns one is a visible edit here rather than a sentence composed wherever it was first needed.
 */
export function refusalFor(error: unknown): Refusal {
  return {
    condition: conditionOf(error),
    remedy: error instanceof ProjectNotFoundError ? NO_PROJECT_REMEDY : null,
  };
}

/** Opening a project: `core`'s project, or the condition and this surface's remedy. */
export type ProjectOutcome =
  | { readonly opened: true; readonly project: Project }
  | { readonly opened: false; readonly refusal: Refusal };

/**
 * Open the project a host will run against.
 *
 * A result rather than a throw for the reason {@link Refusal} gives: the surface above has to answer
 * a request either way, and a failure it has to catch to classify is one it can get wrong once per
 * route.
 *
 * @param dir the repository root, or nothing to search upwards from the working directory — the
 *   parameter `loadProject` already takes, passed through rather than re-derived.
 */
export function openProject(dir?: string): ProjectOutcome {
  try {
    return { opened: true, project: loadProject(dir) };
  } catch (error) {
    return { opened: false, refusal: refusalFor(error) };
  }
}
