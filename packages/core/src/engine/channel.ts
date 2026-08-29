/**
 * The lossless, lazy, single-consumer channel `engine.ts` composes `runFlow`'s
 * `AsyncIterable<Event>` over. `start` runs exactly once, on the stream's first `next()` pull —
 * not on channel construction — so a caller who never iterates never triggers work. Every event a
 * producer `emit`s, before or after that first pull, is buffered in a FIFO and delivered in that
 * order; nothing is dropped, coalesced or deduplicated. `complete` closes the channel: whatever is
 * still queued is drained first, and only once the queue is empty does the following `next()`
 * settle — resolving `{ done: true }` when no error was given, rejecting with it otherwise. This is
 * what lets a terminal event be observed before the failure it reports is thrown.
 *
 * Iterator `return()` and `throw()` are the abandonment signal: both await `finalise` — the
 * caller's interrupted-run persistence — before resolving or rethrowing, so a consumer that stops
 * early (a `break`, an uncaught error in a `for await` body, or an explicit `return()`) cannot
 * observe completion before that persistence has actually run.
 */
import type { Event } from '@quorum/shared';

import { FlowError, type FinaliseAbandonment } from './types.js';

/** What a producer holds to drive one channel: enqueue events, then close it once, with or without an error. */
export interface EventSink {
  emit(event: Event): void;
  complete(error?: Error): void;
}

/** One pending `next()` call with no event yet to resolve or reject it with. */
interface PendingPull {
  resolve(result: IteratorResult<Event>): void;
  reject(error: Error): void;
}

/**
 * Builds one channel: the {@link EventSink} its producer drives, and the stream its one consumer
 * iterates.
 *
 * Single-consumer is enforced rather than documented. A second `[Symbol.asyncIterator]()` and a
 * re-entrant `next()` each throw a named `FlowError`, because the alternative failures are a stream
 * silently split between two `for await` loops and a promise that never settles — and *errors are
 * explicit* is the rule a silent hang breaks.
 *
 * @param start the producer, run exactly once on the first pull.
 * @param finalise the caller's interrupted-run persistence, awaited before an abandoning consumer
 *   is released.
 */
export function createEventChannel(
  start: () => void,
  finalise: FinaliseAbandonment,
): { stream: AsyncIterable<Event>; sink: EventSink } {
  const queue: Event[] = [];
  let started = false;
  let closed = false;
  let closingError: Error | undefined;
  let pending: PendingPull | undefined;
  let iterated = false;

  /** Fulfils a pending `next()` once an event arrives or the channel closes, in either order. */
  function settlePending(): void {
    if (!pending) return;
    if (queue.length > 0) {
      const value = queue.shift() as Event;
      const { resolve } = pending;
      pending = undefined;
      resolve({ value, done: false });
      return;
    }
    if (closed) {
      const { resolve, reject } = pending;
      pending = undefined;
      if (closingError) reject(closingError);
      else resolve({ value: undefined, done: true });
    }
  }

  const sink: EventSink = {
    emit(event) {
      queue.push(event);
      settlePending();
    },
    complete(error) {
      closed = true;
      closingError = error;
      settlePending();
    },
  };

  function next(): Promise<IteratorResult<Event>> {
    if (pending) return Promise.reject(new FlowError('event stream: a pull is already in flight — the stream takes one consumer'));
    if (!started) {
      started = true;
      start();
    }
    if (queue.length > 0) return Promise.resolve({ value: queue.shift() as Event, done: false });
    if (closed) return closingError ? Promise.reject(closingError) : Promise.resolve({ value: undefined, done: true });
    return new Promise<IteratorResult<Event>>((resolve, reject) => {
      pending = { resolve, reject };
    });
  }

  async function abandon(): Promise<IteratorResult<Event>> {
    await finalise();
    return { value: undefined, done: true };
  }

  async function abandonWithError(error?: unknown): Promise<IteratorResult<Event>> {
    await finalise();
    throw error;
  }

  const stream: AsyncIterable<Event> = {
    [Symbol.asyncIterator]() {
      if (iterated) throw new FlowError('event stream: already iterated — the stream takes one consumer');
      iterated = true;
      return { next, return: abandon, throw: abandonWithError };
    },
  };

  return { stream, sink };
}
