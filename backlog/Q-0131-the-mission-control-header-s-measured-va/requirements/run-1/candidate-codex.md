# Q-0131 — The mission control header’s measured values

## Problem

The mission control header cannot show three values required by the design brief: the run number while a run is live, elapsed run time, and cost or usage by vendor.

The current data shapes do not support those claims:

- `WireRun.runId` remains `null` until the terminal event supplies the run number.
- Neither `WireRun` nor the event stream carries the run’s start or end time.
- A completed agent step places its cost or unpriced usage only inside the `done.message` sentence produced by `formatCost`.

The browser must not infer these values from its connection time, parse them from prose, price unpriced usage locally, or combine unlike vendor measures into one total. A late connection or retained event tail must not be presented as the complete run.

This ticket touches `packages/core`, `packages/shared`, `packages/server`, and the mission control screen in `apps/web`. It does not change the CLI, adapter contract, flow files, or persisted run-history formats.

The repository does not contain the Q-0015 verification product that was supposed to record a real run’s observed event count and peak concurrent column count. Searches find the obligation repeatedly, but no recorded figures. The browser and daemon retention bounds therefore remain 500; absence of the promised evidence is not evidence for a different number.

## User story

As a **solo maintainer**, I want mission control to show the live run’s actual number, measured elapsed time, and each vendor’s separately reported cost or usage, so that I can identify the run and understand what it has consumed without interpreting trace prose or mistaking an estimate for a measured value.

## Acceptance criteria

1. **The mission control header has three independently sourced regions.** The `/runs/:handle` screen renders:
   1. the run identity;
   2. elapsed time; and
   3. one cost or usage ticker per observed vendor.
   Each region has its own explicit unavailable state. Failure or absence of one value does not hide or fabricate either of the others.

2. **A live run receives its core run number.** After `core` has allocated the run number, `GET /runs/:handle` exposes that number for the same host record while its state is `running`; mission control replaces `Run <handle>` with `Run <number>` without waiting for a terminal event. Before allocation, including a refused start that allocated no run, `runId` remains `null` and the handle remains the identity. The browser never parses a run number from a handle, gate id, branch, path, log line, or message.

3. **Run-number correlation has one authority.** The number exposed on the live `WireRun` and the number on its eventual terminal event are equal. An automated host test covers a live snapshot followed by the terminal event and fails if the two values differ. A refused start remains incapable of claiming a run number.

4. **The run-number transport decision is recorded before implementation.** Because *“What a run’s event stream carries, and how a gate answer travels back”* (2026-08-28) says only the terminal event carries run identity, any solution that widens an event or introduces a run-start event requires a new decision entry naming and superseding that clause. If the chosen solution leaves the event union unchanged, the solution document records the measured alternative and why no entry is owed. In either case, `core` remains the authority that allocates the number; the server does not compute a second number.

5. **Elapsed time is measured from daemon-owned run lifecycle times.** `WireRun` carries nullable start and end instants sourced by the host:
   - the start instant is set when the host has successfully started the run, not when the browser connects or requests metadata;
   - the end instant is set once when the hosted run reaches a terminal state;
   - a refused run has neither instant;
   - an active run has a start instant and no end instant.
   Both fields are ISO-8601 UTC strings on the wire and are validated by the shared schema.

6. **Elapsed rendering follows the lifecycle values.** For an active run, mission control displays the non-negative difference between the current clock and the host’s start instant and updates it at least once per second. When the run ends, the screen obtains the ended `WireRun` and displays the fixed difference between its end and start instants. The value no longer advances after that read. Browser connection time, component mount time, event count, and accumulated step durations are not substitutes.

7. **Elapsed formatting is stable and testable.** Durations below one hour render as `MM:SS`; durations of one hour or more render as `H:MM:SS`. Minutes and seconds are zero-padded to two digits. A negative difference caused by clock adjustment renders `00:00` rather than a negative duration. Component tests use a controlled clock and cover `00:00`, `14:32`, `1:00:00`, live advancement, terminal freezing, and missing lifecycle times.

8. **Completed agent steps carry structured usage.** The existing `done` event for an agent step gains one optional, whole structured field containing the neutral vendor label and the normalized usage already held by `core`: reported USD cost where supplied, and reported input, output, and cached-input counts where supplied. The field is absent for non-agent `done` events such as script completion. Individual members are nullable only where the adapter’s normalized usage contract permits absence; the browser does not recover a missing member from `message`.

9. **The second structured event field receives an explicit decision.** Before implementation, a new decision entry either authorizes the structured usage field on `done` or records a different measured transport that satisfies these criteria. It cites *“A gate question carries the decision that reached it”* (2026-09-17), explains why cost is a per-step `done` value rather than a gate value, and records the measured shared/core/server/web changes. It must not re-evaluate that entry’s six rejected alternatives. Parsing `formatCost` prose remains rejected.

10. **The event’s prose remains backward-compatible.** `done.message` continues to contain the existing human-readable `formatCost` result for current non-browser readers. The structured usage field is additional. Tests prove that changing the prose while leaving the structured field unchanged does not change the ticker, and that removing the structured field does not cause the browser to parse the prose.

11. **Each vendor has a separate ticker.** Mission control groups structured usage by exact neutral vendor label and renders vendors in first-observed order. It never branches on a known vendor name. For each vendor it shows:
    - the sum of reported USD costs, when at least one observed completed step from that vendor reports a price;
    - the sum of each reported usage count for observed completed steps whose price is absent; and
    - the number of observed completed steps for which no price was reported.
    Monetary values and unpriced usage may appear beside the same vendor when that vendor supplied both kinds across different steps, but are never converted into each other.

12. **There is no blended run total.** The screen never adds money across vendor labels into one headline figure, never adds usage counts across vendor labels into one headline figure, never labels a value “cost to date,” and never renders an absent price as `$0.00`. An unpriced completed step is represented as `n/a` with its reported usage and contributes to the vendor’s unpriced-step count.

13. **Ticker completeness is stated honestly.** The ticker is derived only from structured `done` events present in the browser snapshot. If `missedCount` or `browserDiscardedCount` is non-zero, the ticker is labelled as based on the retained events and is not described as a complete run total. The existing two loss disclosures remain separately visible. If no structured agent-step usage has been observed, the region states that no completed-step usage has been observed; it does not display zero cost.

14. **The source guard moves deliberately.** `apps/web/test/source.test.ts` is updated so the structured shared usage type may reach `apps/web/src`, while continuing to fail on:
    - the phrase `cost to date`;
    - browser parsing of `cost=`, token text, or any other value from an event message;
    - local pricing or rate-table code; and
    - one combined cross-vendor money or usage total.
    Each retained prohibition has a discriminating fixture that fails when the prohibited behaviour is introduced. The existing count-field list is not bypassed through renamed browser-only copies.

15. **The wire schemas remain exact.** The new `WireRun` lifecycle fields and structured `done` field are declared and validated in `@quorum/shared`. Unknown keys continue to be rejected where Quorum owns the shape. The server and browser import those shared types and schemas rather than redeclaring them. Malformed lifecycle instants or malformed structured usage produce the existing explicit unparseable/error state; they do not default to zero or disappear silently.

16. **Retention remains 500.** `DEFAULT_RETENTION` and `RUN_EVENT_RETENTION` remain 500 because the real-run figures Q-0015 promised are absent from the repository. This ticket does not change either bound. Verification records that the evidence was searched for and not found. If the missing observed event count and peak concurrent column count are supplied before implementation, changing the bound requires an erratum to these requirements with the figures and the resulting calculation; an impression is insufficient.

17. **The existing mission control behaviours remain intact.** Parallel trace columns, the run-activity lane, observed-only timeline dispositions, gate navigation, the two independent loss counters, metadata and connection error states, socket disposal, and start/stop controls continue to work. The cost ticker consumes events without moving an event between trace lanes or changing its rendered message.

18. **Accessibility does not depend on colour or motion.** The three header regions have textual labels. Live elapsed updates do not steal focus or use an assertive live region. Priced, unpriced, incomplete, unavailable, running, and ended states remain distinguishable in text alone.

19. **No persistence or file-format change is introduced.** The lifecycle instants are host-record fields and the ticker is derived in memory from streamed structured events. This ticket does not add fields to `ticket.md`, `runs.log`, `run-manifest-v1`, flow YAML, browser storage, cookies, or a service-worker cache.

20. **Quality checks remain green.** Behaviour changes have shared-schema, core emission, host lifecycle/correlation, browser aggregation, formatting, source-guard, and mission-control component tests. After `pnpm install --frozen-lockfile`, `pnpm turbo run test --force --continue`, `pnpm lint`, and `pnpm typecheck` pass, including the mock-adapter end-to-end regression suite.

21. **Cross-cutting constraints are unchanged.** This feature adds no subscription-secret path; changes no worktree, branch, gate, cross-vendor, or human-locked behaviour; introduces no hidden persistent state; contains no vendor-specific branch above an adapter; and adds no step to either supported installation path. The cold-clone path and its under-30-minute claim are unchanged.

## Non-goals

- Changing the CLI’s run output or adding these header values to another screen.
- Changing how `core` allocates run numbers.
- Deriving a run number from a run lock, handle, gate id, branch, path, or persisted prose.
- Adding timestamps or sequence numbers to every event.
- Parsing `done.message`, `stdout`, `info`, `warn`, or any other human-readable sentence.
- Removing or changing the existing human-readable `formatCost` message.
- Pricing unpriced usage, shipping a rate table, or allowing user-supplied rates.
- Producing a single cross-vendor run cost or usage number.
- Forecasting future cost, enforcing budget caps, or displaying subscription quota remaining.
- Adding model, role, worktree, branch, or queued-step data to the header.
- Changing the 500-event daemon or browser retention bounds without the missing Q-0015 evidence.
- Persisting daemon host records across restart or implementing resumable runs.
- Changing the adapter contract, flow files, gate answers, run-history schemas, or ticket file format.
- Multi-user access, a remote daemon, cloud sync, a plugin marketplace, a visual node canvas, eval suites, a Gemini adapter, or a desktop shell.

## Open questions

1. **Blocker — run-number transport. Owner: architecture gate.** Which measured mechanism exposes `core`’s allocated number to the host before terminal: a narrowly widened event, a new run-start event, or a non-event engine interface? The solution must compare affected schemas, producers, consumers, and transport code. A choice that changes the event contract requires the decision entry in AC-4.

2. **Blocker — structured `done` usage. Owner: architecture gate.** Does adding the optional structured usage field require a new decision entry, given that decision 097 explicitly says a second structured event field is a new decision? AC-9 requires the gate to answer this before implementation and records the expected entry unless a measured alternative satisfies every criterion.

3. **Non-blocking — missing Q-0015 verification evidence. Owner: product owner.** Was the real-run event count and peak concurrent column count recorded outside the tracked repository? If supplied with provenance before implementation, requirements need an erratum before either retention bound moves. Otherwise both remain 500.

## Risks

- **Contract drift:** exposing the live run number through the event union without a decision would silently contradict the 2026-08-28 event-stream decision.
- **False precision:** browser connection time or terminal receipt time would look measured while including an unknown portion of the run or transport delay.
- **Misleading totals:** a retained event tail can omit completed steps; without the incomplete label, its aggregate would be presented as more complete than the evidence permits.
- **Vendor asymmetry:** rendering only money would hide vendors that report usage but no price; locally pricing that usage would fabricate a charge.
- **Double counting:** reconnect behaviour can replay retained events. Aggregation must operate on the current bounded snapshot or otherwise deduplicate exact events; incrementally adding every received replay would inflate the ticker.
- **Clock adjustment:** wall-clock changes can make a live difference negative. Clamping prevents a nonsensical display but does not make wall time monotonic.
- **Source-guard erosion:** simply deleting the existing count-field guard would permit blended totals or prose parsing to return later. The replacement must guard behaviours and discriminate over fixtures.
- **Unresolved evidence:** Q-0015 repeatedly required a real-run retention measurement but no result is tracked. Treating the promised measurement as if it existed would make any revised bound unauditable.
