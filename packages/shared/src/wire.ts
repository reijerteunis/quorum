import { z } from 'zod';

/** The transport envelope; event payloads require a second pass through `eventSchema`. */
export type WireMessage =
  | { readonly type: 'event'; readonly event: unknown }
  | { readonly type: 'missed'; readonly count: number };

/** Runtime validation for one message emitted by the run-events WebSocket. */
export const wireMessageSchema: z.ZodType<WireMessage> = z.custom<WireMessage>(() => {
  throw new Error('not implemented');
});
