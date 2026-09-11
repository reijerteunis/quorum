import { z } from 'zod';

/** One message emitted by the run-events WebSocket. */
export const wireMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('event'), event: z.unknown() }).strict(),
  z.object({ type: z.literal('missed'), count: z.number().finite().int().nonnegative() }).strict(),
]);

/** The transport envelope; event payloads require a second pass through `eventSchema`. */
export type WireMessage = z.infer<typeof wireMessageSchema>;
