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

  // Driven over JSON TEXT, which is the only way a frame reaches this function and what AC-14's
  // Test clause always said — "(e) a non-object JSON value", "(h) each invalid count". These rows
  // used to hand `parseFrame` an object directly, so all four were proven over a path no socket
  // uses; `Infinity` was worse still, asserting a refusal carrying a value no JSON frame can carry,
  // since `JSON.stringify({count: Infinity})` yields `null`. Q-0120 review round 3, M-5.
  test.each([['7', '7'], [-1, -1], [1.5, 1.5], [Infinity, null]] as [number | string, unknown][])(
    'refuses invalid count %s distinctly, over the wire', (count, carried) => {
      expect(parseFrame(JSON.stringify({ type: 'missed', count }))).toStrictEqual({ ok: false, refusal: { kind: 'invalid-count', count: carried } });
    });

  // Retired by replacement rather than deleted: the behaviour it pinned was the violation, and the
  // criterion it should have pinned is that a non-object JSON value is refused as such.
  test('a non-object JSON value is refused as one, and a non-string message never reaches JSON', () => {
    expect(() => parseFrame('42')).not.toThrow();
    expect(parseFrame('42')).toStrictEqual({ ok: false, refusal: { kind: 'non-object' } });
    expect(parseFrame('null')).toStrictEqual({ ok: false, refusal: { kind: 'non-object' } });
    // And the fall-through is gone: an object handed in directly is a non-text message, not a frame.
    expect(parseFrame({ type: 'event', event: { type: 'info', message: 'x' } })).toStrictEqual({ ok: false, refusal: { kind: 'non-text-message' } });
    expect(parseFrame(42)).toStrictEqual({ ok: false, refusal: { kind: 'non-text-message' } });
  });

  test('malformed surrogate text never escapes as an exception', () => {
    expect(() => parseFrame('\ud800')).not.toThrow();
  });
});
