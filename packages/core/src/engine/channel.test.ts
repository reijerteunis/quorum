import { describe, expect, test, vi } from 'vitest';

import { createEventChannel } from './channel.js';

function channel(start: () => void, finalise: () => Promise<void>): ReturnType<typeof createEventChannel> {
  try {
    return createEventChannel(start, finalise);
  } catch (error) {
    expect(error, 'the contract stub must be replaced by an event channel').toBeUndefined();
    throw error;
  }
}

describe('Q-0050 AC-2b/AC-2d/AC-3b/AC-5d — event channel', () => {
  test('starts lazily and preserves a synchronous burst losslessly', async () => {
    let sink!: ReturnType<typeof createEventChannel>['sink'];
    const start = vi.fn(() => {
      for (let i = 0; i < 500; i++) sink.emit({ type: 'stdout', stepId: 's', line: String(i) });
      sink.complete();
    });
    const created = channel(start, async () => undefined);
    sink = created.sink;
    expect(start).not.toHaveBeenCalled();
    const lines: string[] = [];
    for await (const event of created.stream) if (event.type === 'stdout') lines.push(event.line);
    expect(start).toHaveBeenCalledTimes(1);
    expect(lines).toStrictEqual(Array.from({ length: 500 }, (_, i) => String(i)));
  });

  test('yields the queued terminal, then throws the named error', async () => {
    const cause = new Error('script exited 1: permission denied');
    let sink!: ReturnType<typeof createEventChannel>['sink'];
    const created = channel(() => {
      sink.emit({ type: 'terminal', runId: 1, status: 'failed', stageBefore: 'a', stageAfter: 'a', cost: 0, tokens: 0, error: cause.message });
      sink.complete(cause);
    }, async () => undefined);
    sink = created.sink;
    const iterator = created.stream[Symbol.asyncIterator]();
    expect((await iterator.next()).value).toMatchObject({ type: 'terminal', status: 'failed' });
    await expect(iterator.next()).rejects.toThrow('permission denied');
  });

  test('a second consumer and a re-entrant pull are refused by name, not by hanging', async () => {
    // "Single-consumer" was stated in the contract and enforced nowhere: a second `for await`
    // silently SPLIT the stream between two consumers, and two concurrent `next()` calls
    // overwrote the one `pending` slot, orphaning the first promise for good. Both failures are
    // silent — a wrong split and a hang — which is what "errors are explicit" argues against.
    let sink!: ReturnType<typeof createEventChannel>['sink'];
    const created = channel(() => sink.emit({ type: 'info', message: 'started' }), async () => undefined);
    sink = created.sink;

    const iterator = created.stream[Symbol.asyncIterator]();
    expect(() => created.stream[Symbol.asyncIterator]()).toThrow(/one consumer/);

    await iterator.next();
    const first = iterator.next();
    await expect(iterator.next()).rejects.toThrow(/one consumer/);

    // The orphaned-promise half: the pull that was already in flight still settles normally.
    sink.emit({ type: 'info', message: 'second' });
    expect((await first).value).toMatchObject({ type: 'info', message: 'second' });
  });

  test('an abandoned channel latches: no drain of what finalisation queued, and no lazy start', async () => {
    let sink!: ReturnType<typeof createEventChannel>['sink'];
    const start = vi.fn(() => { sink.emit({ type: 'info', message: 'started' }); });
    const created = channel(start, async () => {
      // What a producer emits DURING finalisation — the rollback warn, the terminal info, the
      // terminal event. Before the latch a next() after return() handed these to a consumer the
      // contract says "cannot observe the terminal event it caused".
      sink.emit({ type: 'terminal', runId: 1, status: 'interrupted', stageBefore: 'a', stageAfter: 'a', cost: 0, tokens: 0 });
    });
    sink = created.sink;
    const iterator = created.stream[Symbol.asyncIterator]();
    await iterator.next();
    await iterator.return?.();
    expect(await iterator.next()).toStrictEqual({ value: undefined, done: true });

    // And the half that reaches disk: return() before the FIRST pull left `started` false, so the
    // next pull ran the producer for a run the caller had already walked away from.
    const second = createEventChannel(start, async () => undefined);
    const neverPulled = second.stream[Symbol.asyncIterator]();
    await neverPulled.return?.();
    expect(await neverPulled.next()).toStrictEqual({ value: undefined, done: true });
    expect(start).toHaveBeenCalledTimes(1);
  });

  test('return awaits abandonment finalisation', async () => {
    let release!: () => void;
    const finalised = new Promise<void>((resolve) => { release = resolve; });
    let sink!: ReturnType<typeof createEventChannel>['sink'];
    const created = channel(() => sink.emit({ type: 'info', message: 'started' }), () => finalised);
    sink = created.sink;
    const iterator = created.stream[Symbol.asyncIterator]();
    await iterator.next();
    let returned = false;
    const pending = iterator.return?.().then(() => { returned = true; });
    await Promise.resolve();
    expect(returned).toBe(false);
    release();
    await pending;
    expect(returned).toBe(true);
  });
});
