/**
 * The envelope every run-events WebSocket message is one of, and the schema that proves it.
 *
 * It lives in the shared package rather than beside the transport in `packages/server`, because
 * AC-14 needs a runtime PARSER and not a type: a `JSON.parse` result assigned to `WireMessage` is a
 * silent default, which this repository's rules forbid. A browser must therefore be able to execute
 * the schema, and this is the only package here with an `exports` map, a browser-safety guard and a
 * header that names `apps/web` as its reason. The server re-exports the name so its own barrel is
 * unchanged; the definition is here and is not written twice.
 *
 * (This header spells no package specifier: `index.test.ts` asserts that literal appears in no file
 * under `src`, tests included, which is why the file that checks it assembles its own needle.)
 *
 * `event` is deliberately `unknown`: the envelope says a frame IS an event frame, and what that
 * event is belongs to this package's own event union, checked in a second pass. Folding the two
 * into one schema would make a malformed event indistinguishable from a malformed envelope, and
 * AC-14 requires each refusal to be distinguishable.
 */
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
