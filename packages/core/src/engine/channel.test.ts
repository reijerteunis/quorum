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
