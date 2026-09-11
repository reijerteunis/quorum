/**
 * One run's fan-out: the host consumes `runFlow`'s stream exactly once and publishes each event to
 * every subscriber that is registered when it publishes.
 *
 * **The fan-out is the host's because the stream is single-consumer.** `runFlow` returns a lazy
 * `AsyncIterable<Event>` that throws a named `FlowError` on a second `[Symbol.asyncIterator]()`, so
 * a host that handed the iterable to a per-connection handler would be correct for one watcher and
 * throw on the second. That is not an enhancement deferred; it is what makes single-consumer safe.
 *
 * **Retention is a bounded construction parameter, and the bound is a COUNT of events.** A byte
 * bound would need the events serialised before anybody asked for them, and a time bound would make
 * a fixture's verdict a function of the clock, which *"A test's verdict is a property of the commit,
 * not of the checkout or the account"* (2026-08-30) forbids. A capacity of zero is live-tail-only,
 * so both policies are reachable without rebuilding this; which value the product ships belongs to
 * the child that creates a late joiner, which is Q-0118.
 *
 * **A replay that is incomplete says so, and says it beside the stream.** A subscriber that arrives
 * after eviction is told how many events it missed, as a number on its {@link Subscription} — never
 * as an item of the stream. The event union is closed and `.strict()`, so a truncation notice inside
 * it would either widen the union or fail to parse as one of its members; silence that means both
 * *nothing was lost* and *something was lost* is the defect this repository has recorded most.
 *
 * **A slow subscriber is slow alone.** Each holds its own FIFO and its own pending pull; publishing
 * neither awaits nor inspects them, so one that stops reading cannot make another miss, duplicate or
 * reorder an event, and cannot stall the one consumer. A per-subscriber ceiling with an explicit
 * outcome for the subscriber that reaches it belongs with the transport that has a socket to apply
 * it to (Q-0118); nothing here may block.
 *
 * No ordering is claimed that `core` does not make: delivery preserves the order the host consumed
 * in, and the members of a `parallel:` step have no global ordering or interleaving promise to
 * preserve in the first place.
 */
import type { Event } from '@quorum/shared';

/** One subscriber's view of a run: what it missed, what it gets, and how it lets go. */
export interface Subscription {
  /**
   * How many events were evicted from the retained buffer before this replay began.
   *
   * Zero means the replay is complete — every event the host has consumed so far is in
   * {@link Subscription.events}. It is a number and never an `Event`, deliberately.
   */
  readonly missed: number;
  /** The retained events in consumption order, then the live tail, with no gap or duplicate between. */
  readonly events: AsyncIterable<Event>;
  /** Releases this subscriber. Every other one is undisturbed, and the host keeps consuming. */
  close(): void;
}

/** The fan-out for one run, driven by the host's single consumption loop. */
export interface Broadcast {
  /** Hands one event to every current subscriber, and retains it for a later one. */
  publish(event: Event): void;
  /** Ends every subscription normally. Idempotent, because a run ends once. */
  close(): void;
  /** Registers a subscriber, replaying what is retained. Permitted after {@link Broadcast.close}. */
  subscribe(): Subscription;
  /** How many subscribers are attached, for a host that reports what is watching. */
  readonly size: number;
}

/** One attached subscriber: its own queue, its own pending pull, its own release flag. */
interface Subscriber {
  queue: Event[];
  pending?: (result: IteratorResult<Event>) => void;
  released: boolean;
}

/**
 * Refuse a retention capacity that is not one.
 *
 * Exported so the host can refuse it where the bound is *chosen* — at construction — rather than
 * where it is first used, which is the first start and looks like a healthy host until then. One
 * predicate rather than two, because two would be free to drift.
 *
 * @throws {RangeError} when `capacity` is not a non-negative integer — a bound that is silently
 *   coerced is a bound nobody chose.
 */
export function assertRetention(capacity: number): void {
  if (!Number.isInteger(capacity) || capacity < 0) {
    throw new RangeError(`retention capacity must be a non-negative integer, not ${String(capacity)}`);
  }
}

/**
 * Build one run's fan-out.
 *
 * @param capacity how many consumed events are retained for a subscriber that arrives late. Zero is
 *   live-tail-only.
 * @throws {RangeError} through {@link assertRetention}.
 */
export function createBroadcast(capacity: number): Broadcast {
  assertRetention(capacity);

  const retained: Event[] = [];
  const subscribers = new Set<Subscriber>();
  let evicted = 0;
  let closed = false;

  /**
   * Let one subscriber go, and only that one.
   *
   * Its queue is dropped, which is the difference between a subscriber letting go and the RUN
   * ending: {@link Broadcast.close} leaves every queue intact so the terminal event is still
   * delivered, while a subscriber that closed has said it wants nothing further.
   */
  const release = (subscriber: Subscriber): void => {
    subscriber.released = true;
    subscriber.queue.length = 0;
    subscribers.delete(subscriber);
    const pending = subscriber.pending;
    subscriber.pending = undefined;
    pending?.({ value: undefined, done: true });
  };

  return {
    get size() { return subscribers.size; },

    publish(event) {
      // Errors are explicit: publishing after the run closed is a defect in the caller's loop, and
      // swallowing it would leave an event that reached nobody looking exactly like one that did.
      if (closed) throw new Error('event fan-out: published after the run closed');
      retained.push(event);
      while (retained.length > capacity) {
        retained.shift();
        evicted += 1;
      }
      for (const subscriber of subscribers) {
        const pending = subscriber.pending;
        if (pending) {
          subscriber.pending = undefined;
          pending({ value: event, done: false });
        } else {
          subscriber.queue.push(event);
        }
      }
    },

    close() {
      if (closed) return;
      closed = true;
      for (const subscriber of [...subscribers]) {
        // A subscriber with a queue still to drain keeps it: `next` answers `done` only once the
        // queue is empty, so the terminal event is delivered before the close that follows it.
        const pending = subscriber.pending;
        if (pending) {
          subscriber.pending = undefined;
          pending({ value: undefined, done: true });
        }
      }
    },

    subscribe() {
      // The replay is taken at registration rather than at the first pull, so the boundary between
      // the replay and the live tail is this statement and nothing can land between the two halves.
      const subscriber: Subscriber = { queue: [...retained], released: false };
      const missed = evicted;
      if (!closed) subscribers.add(subscriber);

      const events: AsyncIterable<Event> = {
        [Symbol.asyncIterator]() {
          return {
            next(): Promise<IteratorResult<Event>> {
              if (subscriber.pending) {
                return Promise.reject(new Error('event fan-out: a pull is already in flight on this subscription'));
              }
              if (subscriber.queue.length > 0) {
                return Promise.resolve({ value: subscriber.queue.shift() as Event, done: false });
              }
              if (subscriber.released || closed) {
                // Released here as well as on `close()`, so a subscriber that drains a closed run's
                // replay and then stops is not left attached to a fan-out nothing will publish to.
                release(subscriber);
                return Promise.resolve({ value: undefined, done: true });
              }
              return new Promise<IteratorResult<Event>>((resolve) => { subscriber.pending = resolve; });
            },
            return(): Promise<IteratorResult<Event>> {
              release(subscriber);
              return Promise.resolve({ value: undefined, done: true });
            },
          };
        },
      };

      return { missed, events, close: () => { release(subscriber); } };
    },
  };
}
