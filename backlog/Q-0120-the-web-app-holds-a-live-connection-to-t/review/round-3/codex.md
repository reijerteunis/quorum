# Code review — Q-0120, round 3

## Findings

### major — Child routes incorrectly open a run socket

`apps/web/src/app.tsx:83`

The app treats every resolved route containing a `handle` parameter as the run route. This includes `/runs/:handle/gate` and `/runs/:handle/steps/:stepId`, so those routes open and retain a socket and render a non-idle connection state.

AC-15 and AC-20 specify that every route except `/runs/:handle` is idle, while AC-17 requires leaving that run route to close the socket. As implemented, navigating from mission control to a gate or step route does neither.

Determine connection ownership from the matched route identity, requiring exactly `/runs/:handle`, rather than from the presence of a `handle` parameter. Add tests covering navigation from the run route to both child routes and asserting closure plus an idle state.

### major — The frame parser accepts non-text object messages

`apps/web/src/frame-parser.ts:50`

For any input that is neither a string nor one of the recognised binary types, the parser assigns the value directly to `parsed`. Consequently, values such as `{ type: 'missed', count: 7 }` are accepted as valid frames even though AC-14 defines a text-only wire protocol and requires non-text messages to be refused.

This creates a second, non-wire input path that bypasses JSON parsing and makes the parser's result depend on the runtime representation supplied by a transport or test double. It also means the invalid-count tests exercise objects that a conforming parser should reject before inspecting their fields.

Reject every non-string input as `non-text-message`. Drive non-object and invalid-envelope scenarios using JSON text, such as `"42"` and `JSON.stringify({ type: 'missed', count: -1 })`.

### major — A protocol error is not terminal for the active socket

`apps/web/src/run-connection.ts:121`

After a malformed frame sets `protocol-error`, the socket remains current with all handlers attached. A later valid message can still append events or replace the missed notice, and a subsequent close overwrites the protocol error with `interrupted`, `no-such-run`, `dropped`, or `ended`.

This violates the requirement that protocol failures be explicitly surfaced as their named connection state. In the common case where the daemon closes after sending an invalid frame, the user can receive the wrong diagnosis and lose the protocol-error state entirely.

Once parsing fails, invalidate and close the current socket while preserving `protocol-error` as the rendered state. Add a lifecycle test that sends an invalid frame followed by valid messages and a close callback, asserting that neither snapshot data nor the protocol-error state changes.
