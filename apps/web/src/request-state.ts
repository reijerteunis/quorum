/**
 * The closed set of answers one request to the daemon can have, and the sentence each one renders.
 *
 * A pure module with no DOM and no `fetch`, which is what lets AC-5 be asserted by value over every
 * member rather than by rendering. Five members, because five things can happen: the request is in
 * flight, it came back and parsed, nothing answered, the daemon refused, or the body was not the
 * shape it claims. **No member is silence** — every one renders a sentence a reader can act on, and
 * every failure offers the one action that could help.
 *
 * **This is not connection state.** `connection-state.ts` is the browser's account of a live
 * WebSocket to one run: it has nine members, it is driven by socket events, and its failures are
 * about a socket. This is one HTTP request's outcome. The two are deliberately separate sets with
 * separate vocabularies, neither is a synonym for the other, and neither is a term in
 * `docs/GLOSSARY.md` — the glossary's **Connection state** entry is about the socket alone, and
 * coining a second term for this would either widen that entry or introduce a synonym for it.
 *
 * **Nothing here is a spinner and nothing here is a skeleton.** `docs/04-architecture.md` forbids a
 * placeholder that is a blank panel, a spinner or a skeleton, and forbids one showing a fabricated
 * project, run, ticket or cost. The in-flight member therefore carries a sentence naming what was
 * asked for, and a screen renders that sentence rather than an animation standing in for an answer.
 */
import type { WireRefusal } from '@quorum/shared';

/**
 * What one request to the daemon has come to.
 *
 * `loaded` carries the instant it was fetched because the two git facts on a board — containment and
 * push lag — are derived per request and stored nowhere, so a board loaded ten minutes ago is
 * showing an ancestry that was true ten minutes ago. A screen that did not say when would be making
 * a claim about now out of an answer about then.
 */
export type RequestState<T> =
  | { readonly kind: 'in-flight'; readonly path: string }
  | { readonly kind: 'loaded'; readonly value: T; readonly fetchedAt: string }
  | { readonly kind: 'unreachable'; readonly path: string }
  | { readonly kind: 'refused'; readonly path: string; readonly refusal: WireRefusal }
  | { readonly kind: 'unparseable'; readonly path: string; readonly problem: string };

/** The kinds, as a closed list, so a set-wide assertion cannot be written from memory. */
export const REQUEST_STATE_KINDS = [
  'in-flight', 'loaded', 'unreachable', 'refused', 'unparseable',
] as const;

/** One of {@link REQUEST_STATE_KINDS}. */
export type RequestStateKind = (typeof REQUEST_STATE_KINDS)[number];

/**
 * Plain-language text for every request state.
 *
 * **`unreachable` and `refused` are two sentences and never one.** Nothing answered at all is "the
 * daemon is not there", and a 4xx carrying a refusal body is "the daemon is there and said no" —
 * *"start it again"* against *"that request was wrong"*, which is the separation `no daemon` and
 * `no such run` already have on the socket. Collapsing them would send a reader to restart a process
 * that is running.
 *
 * A refusal renders the daemon's own `condition` **unaltered**: that sentence is `core`'s, under
 * *"A `core` error names the condition; the remedy belongs to the surface"* (2026-09-07), and the
 * remedy this surface composes is {@link requestStateRemedy} beside it.
 */
export function requestStateText(state: RequestState<unknown>): string {
  switch (state.kind) {
    case 'in-flight':
      return `Asking the daemon for ${state.path}…`;
    case 'loaded':
      return `Loaded from the daemon, as of ${state.fetchedAt}.`;
    case 'unreachable':
      return `Nothing answered ${state.path}. The daemon that serves this page is not responding.`;
    case 'refused':
      return `The daemon refused ${state.path}: ${state.refusal.condition}`;
    case 'unparseable':
      return `The daemon's answer to ${state.path} was not the shape this page can read: ${state.problem}`;
  }
}

/**
 * What a reader can do about this state, or `null` where there is nothing to do.
 *
 * Composed here rather than taken from the daemon, except where the daemon supplied one — a
 * `WireRefusal.remedy` is the remedy whichever surface raised it already wrote, and overwriting it
 * with a generic sentence would throw away the only specific advice in the exchange.
 */
export function requestStateRemedy(state: RequestState<unknown>): string | null {
  switch (state.kind) {
    case 'in-flight':
    case 'loaded':
      return null;
    case 'unreachable':
      return 'Start the daemon again, then retry.';
    case 'refused':
      return state.refusal.remedy ?? 'Nothing on this page can repair that; retry once the daemon can answer.';
    case 'unparseable':
      return 'This page and the daemon disagree about the shape of that answer — they are probably different versions. Retry, then check which is running.';
  }
}

/** Whether the state offers an explicit retry — the three failures, and only those. */
export function canRetryRequest(state: RequestState<unknown>): boolean {
  switch (state.kind) {
    case 'unreachable':
    case 'refused':
    case 'unparseable':
      return true;
    case 'in-flight':
    case 'loaded':
      return false;
  }
}
