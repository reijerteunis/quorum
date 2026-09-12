# Code review — Q-0120, round 2

## Findings

### major — The required plain-language connection state is hidden in a tooltip

`apps/web/src/shell.tsx:99`

`ConnectionRegion` renders only the internal state discriminator (`no-daemon`, `protocol-error`, and so on) as visible text and puts `connectionStateText(...)` in the `title` attribute. This fails AC-15’s requirement that every state render in plain language in the top bar. In particular, a no-daemon failure does not visibly name the requested URL, and an interrupted connection hides its close code and reason. Tooltips are also unavailable to many keyboard and touch users.

Render the supplied plain-language `text` as visible content. The state kind may remain as supplemental information if useful.

### major — Any close after a terminal event is classified as ended

`apps/web/src/connection-state.ts:76`

The reducer returns `ended` whenever `terminalSeen` is true, regardless of the close code. AC-15 requires ended only for a terminal event followed by a normal close. An abnormal close such as 1006 after a terminal frame is therefore incorrectly presented as successful completion, concealing an interrupted transport.

Require the normal-close code in the ended branch, and classify other post-open closes according to the declared precedence. Add a test for a terminal event followed by an abnormal close.

### major — A naturally closed socket remains current and its callbacks can still mutate state

`apps/web/src/run-connection.ts:110`

The close handler dispatches the close state but neither clears `socket` nor detaches the socket’s handlers. Consequently, a later callback from that closed transport still passes `socket === next`; a late message can append events or replace the missed count, and another close can overwrite the rendered state. This violates AC-17’s explicit rule that callbacks from a closed socket cannot update anything afterwards.

Invalidate the transport as part of close handling without invoking `close()` again, and test all late callback types after a natural close—not only after replacement.

### major — The text-only parser accepts arbitrary non-text objects as already-parsed frames

`apps/web/src/frame-parser.ts:42`

For any non-string value that is not one of the specifically recognised binary classes, the parser treats the value as parsed JSON. Thus `parseFrame({ type: 'missed', count: 7 })` succeeds even though AC-14 defines a text-only message protocol and requires a non-text message to produce its distinguishable refusal. This also makes acceptance depend on the runtime object class rather than on the protocol’s text boundary.

Reject every non-string input as `non-text-message`. Drive the envelope cases through JSON text in tests so validation still exercises the actual WebSocket boundary.

### major — A synchronous socket-construction failure escapes instead of producing no-daemon

`apps/web/src/run-connection.ts:76`

The injected factory is called without error handling. If construction throws, `connect()` throws out of the React effect, no snapshot notification occurs, and the user receives neither the required no-daemon state nor a Retry action. This contradicts the non-throwing failure presentation required when the socket cannot be opened at all.

Catch construction failures, transition to `no-daemon` using the requested URL, notify subscribers, and leave no current socket. Add a throwing-factory test.
