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

/** Parse and validate one received message without throwing. */
export function parseFrame(_data: unknown): FrameParseResult {
  throw new Error('not implemented');
}
