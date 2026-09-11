import { describe, expect, test } from 'vitest';

import { parseFrame } from './frame-parser.js';

const validEvent = { type: 'step', stepId: 'implement', message: 'started' };

describe('AC-14 — staged frame parsing', () => {
  test('accepts valid event and missed envelopes', () => {
    expect(parseFrame(JSON.stringify({ type: 'event', event: validEvent }))).toStrictEqual({ ok: true, frame: { type: 'event', event: validEvent } });
    expect(parseFrame(JSON.stringify({ type: 'missed', count: 7 }))).toStrictEqual({ ok: true, frame: { type: 'missed', count: 7 } });
    expect(parseFrame(JSON.stringify({ type: 'missed', count: 0 }))).toStrictEqual({ ok: true, frame: { type: 'missed', count: 0 } });
  });

  test.each([
    [JSON.stringify({ type: 'heartbeat' }), { kind: 'unknown-type', type: 'heartbeat' }],
    [JSON.stringify({ type: 'event', event: { garbage: true } }), { kind: 'invalid-event' }],
    [JSON.stringify('text'), { kind: 'non-object' }],
    [new ArrayBuffer(2), { kind: 'non-text-message' }],
    ['not json at all {', { kind: 'invalid-json' }],
  ])('refuses %j by exact value', (input, refusal) => {
    expect(() => parseFrame(input)).not.toThrow();
    expect(parseFrame(input)).toStrictEqual({ ok: false, refusal });
  });

  test.each(['7', -1, 1.5, Infinity])('refuses invalid count %s distinctly', (count) => {
    expect(parseFrame({ type: 'missed', count })).toStrictEqual({ ok: false, refusal: { kind: 'invalid-count', count } });
  });

  test('treats a non-string, non-binary input as already parsed before the object check', () => {
    expect(() => parseFrame(42)).not.toThrow();
    expect(parseFrame(42)).toStrictEqual({ ok: false, refusal: { kind: 'non-object' } });
  });

  test('malformed surrogate text never escapes as an exception', () => {
    expect(() => parseFrame('\ud800')).not.toThrow();
  });
});
