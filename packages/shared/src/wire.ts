import { z } from 'zod';

/** The transport envelope; event payloads require a second pass through `eventSchema`. */
export type WireMessage =
  | { readonly type: 'event'; readonly event: unknown }
  | { readonly type: 'missed'; readonly count: number };

/**
 * Runtime validation for the outer run-events envelope.
 *
 * The event branch deliberately retains an unknown payload. The browser parser validates that
 * payload with `eventSchema` after this schema has accepted the envelope.
 */
export const wireMessageSchema: z.ZodType<WireMessage> = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('event'),
    event: z.unknown(),
  }).strict(),
  z.object({
    type: z.literal('missed'),
    count: z.number().int().nonnegative(),
  }).strict(),
]);
