# Q-0120 live-connection contract

## Frame refusals

The parser returns, and never throws, one of these distinct refusal kinds: `non-text-message`,
`invalid-json`, `non-object`, `unknown-type`, `invalid-event`, or `invalid-count`. Event payloads
pass `eventSchema`; missed counts are finite non-negative integers.

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
