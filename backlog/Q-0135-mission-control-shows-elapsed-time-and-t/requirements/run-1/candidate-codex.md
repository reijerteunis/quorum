# Q-0135 — Mission control shows elapsed time and the per-vendor cost split

## Problem

Surface: local daemon and web UI, specifically the live mission control header.

A solo maintainer watching a run can see its identity, flow, ticket and state, but cannot see how long it has been running or the cost reported by each vendor. Mission control instead displays disclosures saying those values are unavailable, even though the run manifest already records `started_at`, `ended_at`, `status` and a live per-vendor `rollup`, and `GET /history/:id` already serves them.

The elapsed display and cost display have different refresh behaviour. Elapsed time can advance from a previously read `started_at` without another daemon request. Cost can change only when the user explicitly asks mission control to read again. Accumulating cost from the event stream is not acceptable because the browser retains only the newest 500 events and the daemon replays retained events without sequence numbers.

Re-measurement also found one stale premise in the inherited Appendix A: the current `WireRun` does not say whether a run is dry. A dry run receives a run number but writes no history, so a history 404 alone cannot distinguish a dry run from missing history. The existing start request already carries `dry`; the daemon must retain and expose that boolean with the run if mission control is to name the dry-run case without parsing free text.

Q-0135 depends on Q-0131. That dependency is satisfied in the current tree: a running `WireRun` receives `runId` through `reportRunNumber`, allowing the history id to be formed as `<ticketId>-<runId>`.

## User story

As a **solo maintainer**, I want live mission control to show elapsed time and one cost entry per exact vendor label, so that I can judge how long the run has taken and which vendors have reported spend without mistaking an unpriced vendor for a free one.

## Acceptance criteria

1. **AC-8 — The history detail response has one shared, executable schema.**

   `packages/shared/src/wire.ts` exports a browser-safe schema and inferred type for the subset of `GET /history/:id` used by mission control:

   - `manifest.started_at`: ISO date-time string;
   - `manifest.ended_at`: ISO date-time string or `null`;
   - `manifest.status`: string;
   - `manifest.rollup`: an array whose entries contain `vendor` as a string, `cost_usd` as a non-negative number or `null`, and `unpriced_steps` and `step_count` as non-negative integers;
   - top-level `incomplete`: boolean; and
   - top-level `tokensByVendor`: a record from exact vendor label to a non-negative integer or `null`.

   The schema is loose at the response, manifest and roll-up-row levels: unknown keys are accepted because the response includes a product-owned manifest that may gain fields outside this screen's subset. `apps/web` imports this schema and type and declares no duplicate wire shape.

   Tests prove that the schema accepts a response built from a real run-directory fixture, accepts unknown keys, and refuses a non-array `rollup`, a non-object roll-up entry, an entry without a string `vendor`, a negative count, and a non-null non-number `cost_usd`.

2. **AC-9 — Mission control reads history once per eligible load and once per explicit refresh, never from a timer.**

   A path helper beside `ticketDetailPath` and `runDetailPath` produces `/history/<encoded-id>`. When loaded run metadata contains both a non-null `ticketId` and a non-null `runId`, mission control forms the id as `<ticketId>-<runId>` and reads that path through the existing `requestJson` mechanism and the AC-8 schema. It never uses the daemon handle as the history id.

   The eligible history read occurs once after the required metadata first becomes available. The existing **Check again** action performs one new metadata read and, when the refreshed metadata supplies both id components, one new history read. No interval or timeout callback performs a fetch. If either id component is absent, mission control issues no history request.

   To make the dry-run absence distinguishable, the daemon retains the existing start request's effective `dry` value (`false` when omitted) in its run record and exposes it as a required boolean on `RunView`, shared `WireRun`, `wireRunSchema` and `wireRunOf`. No event member or persisted file format changes for this purpose.

   Tests prove the initial and explicit-refresh request counts, encoded path, id composition, absent-id behaviour, and `dry` projection for both omitted/false and true requests. A discriminating source test fails when a fixture places a fetch inside a timer callback.

3. **AC-10 — Elapsed time advances, formats, clamps and freezes.**

   After history loads, elapsed time is computed from the manifest timestamps:

   - while `manifest.status` is `running`, elapsed is the injected browser clock minus `started_at` and refreshes at least once per second;
   - after `ended_at` is non-null, elapsed is `ended_at - started_at` and no elapsed-update timer remains active;
   - a negative result is clamped to zero;
   - durations below one hour render as zero-padded `MM:SS`; and
   - durations of one hour or more render as `H:MM:SS`, with minutes and seconds zero-padded.

   The live label states that the browser clock supplies the current time. The implementation uses the existing injectable `Clock`; this path does not call `Date.now()` or construct a bare `new Date()`.

   Tests using a controlled clock assert exact rendering of `00:00`, `14:32` and `1:00:00`, observe a running value advance, observe a terminal value remain fixed, prove that a future `started_at` renders `00:00`, and prove timer cleanup on terminal transition and unmount.

4. **AC-11 — Cost is rendered as one independent entry per roll-up row and is never blended across vendors.**

   Mission control renders roll-up rows in manifest order. Each row uses the exact `vendor` string and does not branch on a known vendor name.

   - A numeric `cost_usd` renders as US dollars with four digits after the decimal point.
   - A `null` `cost_usd` renders that vendor's `tokensByVendor[vendor]` value when present, together with text stating that the vendor is unpriced, not free.
   - If both price and token total are absent, the row still names the vendor and states that it reported no price.
   - When `unpriced_steps > 0`, the row states the number of that vendor's steps whose price is not represented in its displayed cost.
   - A genuine numeric zero may render as `$0.0000`; `null` must never be converted to zero.

   Mission control renders no total across vendors and reads neither `terminal.cost` nor `terminal.tokens`.

   Tests use a two-vendor fixture with one priced and one unpriced row, preserve response order and exact labels, and render exactly two entries. A discriminating assertion fails if any displayed figure equals a sum across rows. An all-unpriced fixture contains no `$0.0000`. Source tests fail on known-vendor branching and on reads of `terminal.cost` or `terminal.tokens`.

5. **AC-12 — The browser's count-source guard permits only the already-reduced per-vendor count.**

   In `apps/web/test/source.test.ts`, `tokensByVendor` is removed from `COUNT_FIELDS`, with an in-place reason that it is the one server-reduced, per-vendor count this screen is allowed to render. `COUNT_FIELDS` remains exactly these four entries:

   - `vendorTokenTotal`;
   - `input_tokens`;
   - `output_tokens`; and
   - `cached_input_tokens`.

   Each remaining entry is still forbidden throughout `apps/web/src`. The guard also rejects a browser-local alias or copied calculation built from any forbidden field. `cost_usd` and `unpriced_steps` are not added to this count guard. The existing ban on the phrase “cost to date” remains effective.

   Tests assert the list by identity and length, demonstrate that each of the four entries fails independently, demonstrate that a renamed local count derived from a forbidden field fails, and retain a discriminating fixture for the phrase ban.

6. **AC-13 — Every unavailable state has distinct, non-empty text and an appropriate action.**

   Mission control distinguishes these cases in text alone:

   - `WireRun.dry === true`: no history read is attempted, and the screen says that the dry run recorded no run history;
   - either `ticketId` or `runId` is absent: no history read is attempted, and the screen says that the run number needed to locate history is not yet known;
   - a non-dry history request is unreachable, refused (including 404 or 422), or unparseable: the existing five-member `RequestState` vocabulary renders the specific outcome and offers its existing retry behaviour; and
   - a roll-up row has `cost_usd: null`: that vendor is described as unpriced and never as `$0.0000`.

   None of these cases renders a dash, spinner, blank region or fabricated zero. Their sentences are distinct and remain understandable without colour or motion. `RequestState` stays closed at its existing five members.

   Tests assert all four cases separately, including a dry run with a non-null run number, and fail if any two cases use the same sentence or if any case is empty.

7. **AC-14 — Existing disclosures retire only when their replacement values are present, and completeness remains explicit.**

   The elapsed-time and structured-cost disclosures in `MISSION_CONTROL_DISCLOSURES` are replaced conditionally:

   - the elapsed disclosure remains visible until valid history supplies `started_at`;
   - the cost disclosure remains visible until valid history supplies the roll-up, including an empty roll-up; and
   - each absent state from AC-13 supplies its specific sentence instead of silently deleting a disclosure.

   When `incomplete` is true, the cost region states that the run is still in flight and that the figures are as of the history read. That sentence is absent when `incomplete` is false. This completeness statement does not replace or combine the existing daemon-replay-loss and browser-discard-loss disclosures.

   Every sentence added or changed by this ticket is exported from `mission-control-text.ts` and imported by renderer and tests. No event message is parsed to obtain elapsed time, dry-run status, vendor, price or count. The word `ticker` appears nowhere under `apps/web/src`.

   Tests cover present and absent forms of both disclosures, incomplete and complete history, simultaneous completeness and loss disclosures, and a source fixture that fails when sentence-shaped copy is rendered outside the copy module or event free text is parsed.

## Non-goals

- No automatic history polling. Elapsed time advances locally; cost changes only after an explicit read.
- No cross-vendor cost or token total.
- No browser-side reconstruction of roll-ups from events, occurrences or token measures.
- No price estimation for a vendor that reports no price.
- No new event member, timestamp or sequence number.
- No second start timestamp on `WireRun`; the manifest's `started_at` remains authoritative.
- No change to the run-manifest file format, history route payload produced by the server, adapter contract, flow format, gate behaviour or persisted backlog state.
- No change to the next-step or structured tool/reasoning disclosures.
- No remote daemon, cloud sync, multi-user behaviour, desktop shell, visual flow canvas, eval suite, plugin marketplace or new adapter.
- No decision entry: the change reads existing run history and adds a direct projection of the already-existing `dry` start option; it does not reverse a documented decision.
- BYOS is unaffected: no subscription-login path changes and no API-key path, fixture or example is added.
- Worktree safety and the cross-vendor rule are unaffected: this is a read-only presentation change and does not execute a flow or write to a working tree.
- Cold-clone behaviour is unaffected: no installation step, command or first-run requirement changes.

## Open questions

None blocking.

The inherited question about browser time versus daemon time is resolved here in favour of the browser clock, measured against the manifest's authoritative `started_at`. Adding daemon `now` would enlarge the history response without improving the local-daemon use case, while recording another start time would create two competing durations.

## Risks

- **Clock adjustment:** the browser clock can move backwards or disagree with the clock that wrote the manifest. Clamping prevents a negative display, and the live label names the browser clock, but the shown duration may temporarily be inaccurate until the terminal manifest supplies `ended_at`.
- **Stale cost:** users may read a cost figure that predates later steps. The incomplete-history sentence and fetched-at wording must remain adjacent enough to the cost region to prevent it being read as current.
- **Dry-run wire drift:** adding `dry` to the strict `WireRun` schema requires every server projection and fixture to move together. Shared schema tests and server projection tests must cover both boolean values.
- **False free-cost signal:** rounding a small positive price or converting `null` to zero could imply that work was free. Four decimal places, explicit unpriced copy and the all-unpriced fixture protect the distinction.
- **Vendor leakage:** UI branching on currently known vendor names would make a future adapter require a web change. Exact-label fixtures and the source guard must remain vendor-neutral.
- **Timer leaks or accidental polling:** an elapsed interval may survive terminal transition or be coupled to history fetching. Fake-clock cleanup tests and the no-fetch-from-timer source test protect both boundaries.
- **Source-guard erosion:** relaxing `COUNT_FIELDS` could permit browser-side recomputation later. The identity assertion and one discriminating fixture per retained field make such a change explicit.
