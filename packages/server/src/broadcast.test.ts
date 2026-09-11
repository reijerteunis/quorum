/**
 * Q-0013 AC-6 and AC-7 — the fan-out's own properties, over events this file makes.
 *
 * Everything a real run adds is `host.test.ts`'s; what is here is what a run cannot show cheaply:
 * eviction, a subscriber that never reads, a boundary between a replay and a live tail, and the two
 * ends of the retention bound. The events below are real `Event` values and are parsed as such, so
 * the truncation-notice clause has a subject that cannot drift into a synthetic shape.
 */
import { describe, expect, test } from 'vitest';

import { eventSchema } from '@quorum/shared';
import type { Event } from '@quorum/shared';

import { assertRetention, createBroadcast } from './broadcast.js';

/** One ordinary run-level event, numbered so a sequence is readable in a failure message. */
const info = (n: number): Event => ({ type: 'info', message: `event ${n}` });

/** Pull `count` events off a subscription, one at a time, without draining it to the end. */
async function take(events: AsyncIterable<Event>, count: number): Promise<Event[]> {
  const iterator = events[Symbol.asyncIterator]();
  const seen: Event[] = [];
  for (let i = 0; i < count; i += 1) {
    const result = await iterator.next();
    if (result.done === true) break;
    seen.push(result.value);
  }
  return seen;
}

/** Drain a subscription to its close. */
async function drain(events: AsyncIterable<Event>): Promise<Event[]> {
  const seen: Event[] = [];
  for await (const event of events) seen.push(event);
  return seen;
}

describe('AC-6 — every subscriber gets every event exactly once, in consumption order', () => {
  test('two subscribers attached before anything is published see the same sequence', async () => {
    const broadcast = createBroadcast(0);
    const a = broadcast.subscribe();
    const b = broadcast.subscribe();

    const drained = Promise.all([drain(a.events), drain(b.events)]);
    for (let n = 1; n <= 5; n += 1) broadcast.publish(info(n));
    broadcast.close();
    const [seenA, seenB] = await drained;

    expect(seenA).toStrictEqual([info(1), info(2), info(3), info(4), info(5)]);
    expect(seenB).toStrictEqual(seenA);
  });

  test('a subscriber that never reads cannot stall the consumer or disturb the one that does', async () => {
    // The criterion's own wording: a slow subscriber may not make another miss, duplicate or
    // reorder an event, and may not block publishing. The slow one here reads nothing at all,
    // which is the worst case of slow.
    const broadcast = createBroadcast(0);
    const slow = broadcast.subscribe();
    const quick = broadcast.subscribe();

    const drained = drain(quick.events);
    for (let n = 1; n <= 200; n += 1) broadcast.publish(info(n));
    broadcast.close();

    expect(await drained).toHaveLength(200);
    // And the slow one lost nothing by being slow: its own queue held everything.
    expect(await drain(slow.events)).toHaveLength(200);
  });

  test('a subscriber that lets go releases only itself', async () => {
    const broadcast = createBroadcast(0);
    const leaving = broadcast.subscribe();
    const staying = broadcast.subscribe();
    expect(broadcast.size).toBe(2);

    broadcast.publish(info(1));
    leaving.close();
    broadcast.publish(info(2));
    broadcast.close();

    expect(broadcast.size).toBe(1);
    expect(await drain(leaving.events)).toStrictEqual([]);
    expect(await drain(staying.events)).toStrictEqual([info(1), info(2)]);
  });

  test('and a second pull in flight on one subscription is refused rather than losing a resolver', async () => {
    // The same discipline `core`'s own channel takes: a silently overwritten resolver is a promise
    // that never settles, and *errors are explicit* is the rule a hang breaks.
    const broadcast = createBroadcast(0);
    const iterator = broadcast.subscribe().events[Symbol.asyncIterator]();
    const first = iterator.next();

    await expect(iterator.next()).rejects.toThrow('a pull is already in flight');

    broadcast.close();
    expect((await first).done).toBe(true);
  });
});

describe('AC-7 — retention is a bounded count, and an incomplete replay says so', () => {
  test('a late subscriber gets the retained events then the live tail, with no gap and no duplicate', async () => {
    const broadcast = createBroadcast(10);
    broadcast.publish(info(1));
    broadcast.publish(info(2));

    const late = broadcast.subscribe();
    const drained = drain(late.events);
    broadcast.publish(info(3));
    broadcast.close();

    expect(late.missed).toBe(0);
    expect(await drained).toStrictEqual([info(1), info(2), info(3)]);
  });

  test('at capacity zero it is live-tail-only, and it is told what it missed', async () => {
    const broadcast = createBroadcast(0);
    broadcast.publish(info(1));
    broadcast.publish(info(2));

    const late = broadcast.subscribe();
    const drained = drain(late.events);
    broadcast.publish(info(3));
    broadcast.close();

    expect(late.missed).toBe(2);
    expect(await drained).toStrictEqual([info(3)]);
  });

  test('where eviction is partial the count is the evicted events and the replay is the rest', async () => {
    const broadcast = createBroadcast(2);
    for (let n = 1; n <= 5; n += 1) broadcast.publish(info(n));

    const late = broadcast.subscribe();
    const drained = drain(late.events);
    broadcast.publish(info(6));
    broadcast.close();

    expect(late.missed).toBe(3);
    expect(await drained).toStrictEqual([info(4), info(5), info(6)]);
  });

  test('the notice is a number beside the stream and parses as no Event', () => {
    // The event union is closed and `.strict()`, so a truncation notice inside it would either
    // widen the union — a non-goal — or fail to parse as one of its members. It travels beside the
    // stream precisely so neither has to happen.
    const broadcast = createBroadcast(0);
    broadcast.publish(info(1));
    const late = broadcast.subscribe();

    expect(late.missed).toBe(1);
    expect(eventSchema.safeParse(late.missed).success, 'the truncation notice parses as an Event').toBe(false);
    // And the clause has a subject: the same parser accepts what the stream actually carries.
    expect(eventSchema.safeParse(info(1)).success).toBe(true);
  });

  test('a subscriber arriving after the close still drains the replay and then ends', async () => {
    const broadcast = createBroadcast(10);
    broadcast.publish(info(1));
    broadcast.close();

    const late = broadcast.subscribe();

    expect(late.missed).toBe(0);
    expect(await drain(late.events)).toStrictEqual([info(1)]);
  });

  test('the bound is chosen rather than coerced, at both sites that take one', () => {
    for (const bad of [-1, 1.5, Number.NaN]) {
      expect(() => createBroadcast(bad), `${bad} was accepted as a capacity`).toThrow(RangeError);
      expect(() => { assertRetention(bad); }, `${bad} was accepted by the shared predicate`).toThrow(RangeError);
    }
    expect(() => { assertRetention(0); }).not.toThrow();
    expect(() => { assertRetention(100); }).not.toThrow();
  });

  test('and publishing after the run closed is an error rather than an event that reached nobody', () => {
    const broadcast = createBroadcast(1);
    broadcast.close();
    expect(() => { broadcast.publish(info(1)); }).toThrow('published after the run closed');
  });
});

describe('AC-6 — the boundary between a replay and the live tail holds under interleaving', () => {
  test('a subscriber registered between two publishes sees the second exactly once', async () => {
    // The failure this forbids is the one a replay taken at the FIRST PULL rather than at
    // registration produces: an event published in between is delivered twice, or not at all.
    const broadcast = createBroadcast(10);
    broadcast.publish(info(1));
    const late = broadcast.subscribe();
    broadcast.publish(info(2));

    const first = await take(late.events, 2);
    broadcast.close();

    expect(first).toStrictEqual([info(1), info(2)]);
  });
});
