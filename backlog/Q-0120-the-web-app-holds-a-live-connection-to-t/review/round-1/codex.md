# Code review — Q-0120, round 1

## Findings

### major — Non-text values can be accepted as valid frames

`apps/web/src/frame-parser.ts:39`

`parseFrame` treats every non-string, non-binary value as if it were already parsed JSON. Consequently, an object such as `{ type: 'missed', count: 7 }` is accepted as a valid frame even though AC-14 requires text frames only. It also classifies numeric input as `non-object` rather than the required, distinguishable `non-text-message` refusal. The tests at `apps/web/src/frame-parser.test.ts:24` and `:28` encode this incorrect behavior by passing already-parsed values.

Impact: callers can bypass `JSON.parse`, and the refusal identity no longer distinguishes a non-text WebSocket message from a non-object JSON document as required.

Recommendation: reject every input that is not a string as `non-text-message`; express non-object and invalid-count test cases as JSON text.

### major — An abnormal close after a terminal event is incorrectly reported as ended

`apps/web/src/connection-state.ts:84`

The reducer returns `ended` after any close once `terminalSeen` is true. AC-15 requires `ended` only for a normal close after a terminal event. For example, a terminal event followed by close code 1006 is currently rendered as a successfully ended run instead of an interrupted connection.

Impact: transport failures at the end of a stream are hidden, and the user is not offered Retry because `ended` is not retryable.

Recommendation: require the normal close code when selecting `ended`; otherwise apply the interrupted case after the explicit 1008 and 1013 precedence rules. Add a terminal-then-abnormal-close reducer test.

### major — The required actionable connection text is hidden in a tooltip

`apps/web/src/shell.tsx:99`

The connection region visibly renders only the internal state discriminator, such as `no-daemon` or `protocol-error`, while placing `connectionStateText(...)` in a `title` attribute. This directly contradicts AC-15's requirement that every state render in plain language and that `no daemon` visibly name the requested URL. Tooltips are not reliably available to keyboard, touch, or assistive-technology users and do not constitute the requested top-bar message.

Impact: the primary distinction this ticket is meant to provide is reduced to implementation labels, and a user facing `no-daemon` cannot see which URL failed or the suggested action.

Recommendation: render the full `text` as visible connection-region content. The state kind may remain as supplemental information if useful.

### major — Non-run routes make the global connection region silent

`apps/web/src/shell.tsx:132`

When `connection` is undefined, the top bar renders nothing for connection status. AC-15 defines an `idle` state, and AC-20 explicitly requires every non-run route's global connection region to render that state and say so. The implementation instead removes the previous pending message without replacing it on those routes.

Impact: most routes once again use silence as their connection status, contrary to the ticket's central requirement that every case have a named, visible state.

Recommendation: render the idle connection state on non-run routes, either by supplying an idle connection presentation from `App` or by making `TopBar` explicitly render the idle text when no run connection exists. Add an assertion over visible header text on a non-run route.
