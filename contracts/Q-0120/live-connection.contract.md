# Q-0120 live-connection contract

## Frame refusals

The parser returns, and never throws, one of these distinct refusal kinds: `non-text-message`,
`invalid-json`, `non-object`, `unknown-type`, `invalid-event`, or `invalid-count`. Event payloads
pass `eventSchema`; missed counts are finite non-negative integers.

Envelope validation is staged so its failures retain those identities. After text and JSON checks,
the parser rejects non-objects and unknown discriminants itself. It then calls
`wireMessageSchema.safeParse` on the recognised branch. A failed `missed` branch is `invalid-count`;
the shared schema accepts only finite non-negative integer counts. An accepted `event` envelope
still carries an unknown payload, which the parser passes through `eventSchema`; failure there is
`invalid-event`. Thus the shared schema has a production browser consumer without collapsing
`non-object`, `unknown-type`, `invalid-count`, and `invalid-event` into one Zod-error refusal.

## Route-literal scan

The recursive source scan keeps comments and tests in its corpus; over-collection is intentional.
Its exceptions are identities, not a count. `apps/web/test/routes.test.ts` holds a table keyed by
source-relative file and literal, with these eight entries and reasons:

| file | literal | reason |
| --- | --- | --- |
| `daemon-endpoints.ts` | `/project` | registered daemon endpoint, not a shell route |
| `daemon-endpoints.ts` | `/tickets` | registered daemon endpoint, not a shell route |
| `router.ts` | `/backlog/` | explanatory JSDoc fragment |
| `router.ts` | `/har` | explanatory JSDoc fragment |
| `router.ts` | `/runs/<handle>` | explanatory JSDoc placeholder |
| `shell.test.ts` | `/runs/run%20one` | encoded-handle fixture |
| `shell.test.ts` | `/nowhere/at/all` | unmatched-path fixture |
| `shell.test.ts` | `/backlog/%E0%A4%A` | malformed-encoding fixture |

Every exception must match its named file and literal, carry a non-empty reason, and be exercised;
an unused entry fails. Endpoint exceptions are compared with `DAEMON_ENDPOINTS`, so another daemon
literal cannot be added by editing the exception table alone.

## Close precedence

Close state is selected in this order: code 1008 is `no-such-run`; code 1013 is `dropped`; a normal
close after an accepted terminal event is `ended`; every other close after opening and before a
terminal event is `interrupted`; failure before open is `no-daemon`. Protocol refusal is
`protocol-error`. Every state has plain-language text, and only failure states offer explicit retry.

## Lifetime and preservation

One controller owns at most one socket. Replacement closes and invalidates the old socket before
opening the new one. Disposed or superseded callbacks cannot mutate state. Retry is never automatic,
opens exactly one replacement, and preserves accepted events and the missed-count notice. Disposal
is idempotent. All state is memory-only.
