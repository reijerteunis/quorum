/**
 * Which `core` failure a thrown value is, and therefore which refusal it earns.
 *
 * The classifying half of *"A `core` error names the condition; the remedy belongs to the surface"*
 * (2026-09-07), kept apart from `refusal.ts` for the reason that entry's shape rests on: the module
 * that composes a remedy takes the condition as a string and names no `core` symbol, so the
 * `instanceof` that decides which remedy applies has to live somewhere else. It lives here.
 * `packages/cli` puts it at its six `loadProject` call sites and this package has one, which is why
 * one module rather than six.
 *
 * Everything below reads a thrown value and hands a **string** on. Nothing here composes a sentence:
 * `refusal.ts` owns every word this surface adds, and this module owns which of them applies.
 */
import { loadProject, ProjectNotFoundError } from '@quorum/core';
import type { Project } from '@quorum/core';

import { noProjectRefusal, refusalOf } from './refusal.js';
import type { Refusal } from './refusal.js';

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
  return error instanceof ProjectNotFoundError
    ? noProjectRefusal(conditionOf(error))
    : refusalOf(conditionOf(error));
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
