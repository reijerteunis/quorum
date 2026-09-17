# Code review — Q-0015, round 2

## Findings

### major — The architecture falsely claims the runs landing is newest-first

`docs/04-architecture.md:338`

The new architecture paragraph says `/runs` lists runs “newest first.” The implementation deliberately preserves the response order without sorting, while `RunHost.runs()` returns `Map` insertion order—explicitly documented as mint order in `packages/server/src/host.ts:408`. Consequently, the screen currently presents oldest-minted first, not newest first.

This contradicts AC-2’s requirement to report only the order the daemon supplied and makes an authoritative numbered document promise observable behavior the product does not implement. Replace “newest first” with wording such as “in the daemon’s mint order” or simply “in the order supplied by the daemon.”

### nit — The architecture names the wrong browser retention constant

`docs/04-architecture.md:338`

The paragraph says the browser retains `DEFAULT_RETENTION` events, but the browser defines and uses `RUN_EVENT_RETENTION`; `DEFAULT_RETENTION` is the daemon-side constant and is intentionally not imported by `apps/web`. This obscures the accepted residual that the two 500-event bounds agree by citation rather than through a shared symbol.

Name `RUN_EVENT_RETENTION` here, or describe the limit as “500 events, matching the daemon’s default retention,” without implying that the browser consumes the server constant.
