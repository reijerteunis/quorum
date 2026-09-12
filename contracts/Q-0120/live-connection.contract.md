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
source-relative file and literal. The following eight entries are the measured baseline before
qa-red adds fixtures:

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
literal cannot be added by editing the exception table alone. New tests derive expected paths from
`DAEMON_ENDPOINTS` and `runEventsPath` rather than spelling new route literals. If a fixture cannot
be derived, qa-red adds its exact `(file, literal, reason)` identity to the table; the eight rows are
the baseline, not a frozen count. The new shell mounting case reuses the existing
`/runs/run%20one` fixture.

## Test-authoring contract

Needles and fixture literals inside `apps/web/` and `packages/shared/src/` are assembled at run time
whenever a guard scans their containing corpus. This applies to `http:` plus `//`, `https:` plus
`//`, `ws:` and `wss:`, and the workspace scope plus `/`. It preserves the subjects of the existing
whole-package network scan and shared-source scope scan, and of the new source-only WebSocket,
hostname and port scan. URL-construction tests live in `apps/web/test/daemon-endpoints.test.ts`,
outside the new `apps/web/src` literal scan, while still assembling the HTTP(S) literals because the
existing whole-package scan includes `test/`.

Qa-red owns these file changes; development tasks must not edit tests:

- `apps/web/test/daemon-endpoints.test.ts` tests HTTP/HTTPS scheme derivation, all four hostile
  handles, the source-only `ws:`/`wss:`/hostname/port prohibition, and that both the Vite proxy and
  run-events path consume `DAEMON_ENDPOINTS`. Its scenarios tag both `frontend-daemon-endpoints`
  and `frontend-dev-proxy` where both sides are asserted.
- `apps/web/test/routes.test.ts` changes to a recursive `src/` walk and implements the exception
  rule above.
- `apps/web/src/frame-parser.test.ts` covers every parser refusal and tags both
  `frontend-frame-parser` and `backend-wire-schema`, because the parser and outer schema land in
  separate worktrees.
- `apps/web/src/connection-state.test.ts` covers every reducer transition and rendered state.
- `apps/web/src/run-connection.test.ts` covers lifecycle, stale callbacks, missed frames, retry and
  disposal. For `count: 0`, it asserts `snapshot.missedCount === 0`, distinct from `null`, and an
  unchanged event list; the rendered surface shows no notice. A later missed frame replaces the
  earlier count rather than accumulating it.
- `apps/web/src/shell.test.ts` removes `CONNECTION_PENDING` from its named import and its old
  assertion before development, then covers route mounting and rendering. The exported constant is
  deleted by development; “retired by replacement” describes its sentence, not retention of the
  symbol.
- `apps/web/test/source.test.ts` covers the retired sentence, shared-package value reachability,
  declaration duplication and browser-persistence prohibitions. It does not read the lockfile.
- `apps/web/test/package.test.ts` updates dependency and justification registers and structurally
  checks the Vite client conditions without duplicating the already-landed shared export-condition
  assertion.
- `packages/shared/src/wire.test.ts` covers the wire schema, server re-export text and the lockfile
  importer. Its workspace-scope needle is assembled at run time.
- `packages/shared/src/index.test.ts` adds the wire barrel names to its explicit register; the
  existing test does not discover new modules automatically.
- `packages/shared/src/docs.test.ts` covers the architecture and glossary retirements and preserves
  the two existing terminology lists byte-for-byte.
- `packages/core/src/turbo-inputs.test.ts` adds `../../pnpm-lock.yaml` to the hand-audited
  `@quorum/shared#test` read register; development adds the matching task input.

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
