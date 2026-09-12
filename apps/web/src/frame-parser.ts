/**
 * One received WebSocket message, parsed without throwing.
 *
 * Staged on purpose, because AC-14 requires every refusal to be told apart: binary before text,
 * text before JSON, JSON before the envelope, and the envelope before the event. A single
 * `safeParse` of the whole message would answer "no" four different ways with one word, which tells
 * a user the same wrong thing four times.
 *
 * Nothing here throws. A parser that throws puts the decision about a malformed frame in whatever
 * happens to be on the stack; returning a refusal keeps it where the state machine can render it.
 */
import { eventSchema, wireMessageSchema, type Event, type WireMessage } from '@quorum/shared';

/** Every reason an incoming WebSocket message can be refused. */
export type FrameRefusal =
  | { readonly kind: 'non-text-message' }
  | { readonly kind: 'invalid-json' }
  | { readonly kind: 'non-object' }
  | { readonly kind: 'unknown-type'; readonly type: unknown }
  | { readonly kind: 'invalid-event' }
  | { readonly kind: 'invalid-count'; readonly count: unknown };

/** A frame whose event payload has passed the shared event schema. */
export type ParsedFrame =
  | { readonly type: 'event'; readonly event: Event }
  | Extract<WireMessage, { type: 'missed' }>;

/** The non-throwing result of parsing one received WebSocket message. */
export type FrameParseResult =
  | { readonly ok: true; readonly frame: ParsedFrame }
  | { readonly ok: false; readonly refusal: FrameRefusal };

/** True for the binary WebSocket message shapes a text-only protocol refuses. */
function isBinaryMessage(data: unknown): boolean {
  return (
    data instanceof ArrayBuffer ||
    ArrayBuffer.isView(data as ArrayBufferView) ||
    (typeof Blob !== 'undefined' && data instanceof Blob)
  );
}

/** Parse and validate one received message without throwing. */
export function parseFrame(data: unknown): FrameParseResult {
  let parsed: unknown;
  if (typeof data === 'string') {
    try {
      parsed = JSON.parse(data);
    } catch {
      return { ok: false, refusal: { kind: 'invalid-json' } };
    }
  } else if (isBinaryMessage(data)) {
    return { ok: false, refusal: { kind: 'non-text-message' } };
  } else {
    parsed = data;
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { ok: false, refusal: { kind: 'non-object' } };
  }

  const type = (parsed as Record<string, unknown>).type;
  if (type !== 'event' && type !== 'missed') {
    return { ok: false, refusal: { kind: 'unknown-type', type } };
  }

  const envelope = wireMessageSchema.safeParse(parsed);

  if (type === 'missed') {
    if (!envelope.success) {
      // An unknown key lands here too, and that is stated rather than repaired. The `missed` branch
      // is `.strict()`, so `{type:'missed',count:7,extra:1}` fails the envelope while its count is
      // perfectly valid, and this refusal then carries a count that was fine. AC-14's closed set has
      // no member for an unknown key, so the kind is forced; dropping the payload instead would mean
      // making `count` optional on `FrameRefusal`, which is a frozen contract and not a nit's to
      // move. The count is not rendered — the sentence is "Protocol error: invalid-count" — so what
      // is wrong here is the NAME a developer reads in a refusal, and this line is the repair the
      // review offered for it. Q-0120 review round 2, N-6.
      return { ok: false, refusal: { kind: 'invalid-count', count: (parsed as Record<string, unknown>).count } };
    }
    return { ok: true, frame: envelope.data as Extract<WireMessage, { type: 'missed' }> };
  }

  if (!envelope.success) {
    return { ok: false, refusal: { kind: 'invalid-event' } };
  }
  const eventPayload = (envelope.data as Extract<WireMessage, { type: 'event' }>).event;
  const eventResult = eventSchema.safeParse(eventPayload);
  if (!eventResult.success) {
    return { ok: false, refusal: { kind: 'invalid-event' } };
  }
  return { ok: true, frame: { type: 'event', event: eventResult.data } };
}
