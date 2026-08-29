# Q-0049 requirements — core run history

## Problem

Run history is split between the run loop in `spike/src/engine.js` and reader logic in `spike/bin/harness.js`. This prevents the run loop and the future local daemon from sharing one implementation of the durable run record. It also makes lifecycle, occurrence, roll-up, and path-confinement behavior easy to change accidentally during the TypeScript port.

This ticket ports the writer and reader into `packages/core`. It preserves externally observable behavior and the frozen `run-manifest-v1` format. It does not change `spike/**`, perform the CLI cutover, or fix defects discovered while reading the spike.

Surfaces touched: `packages/core` and its unit tests. Persisted files under `.quorum/runs/` remain externally observable. The CLI, Quorum web UI, `backlog/`, and `harness/` are not changed by this ticket.

## User story

As a **solo maintainer**, I want the run-history writer and reader available from core so that every execution surface can show the same durable record of run lifecycle, occurrences, retained files, usage, errors, and per-vendor roll-ups without reimplementing filesystem or accounting rules.

As a **cold-clone adopter**, I want run history to preserve incomplete and failed evidence honestly so that a crash, interruption, missing price, or malformed run does not silently appear successful, free, or absent.

As an **adapter contributor**, I want run-history types to accept the common adapter usage shape without vendor-specific branching so that a new adapter can participate without adding vendor knowledge to core.

## Acceptance criteria

1. **Core module boundary.** `packages/core` exports a run-history API covering writer initialization, occurrence allocation and termination, artifact persistence, manifest replacement, usage normalization, roll-up calculation, error representation, usage display/counting, run-id allocation, incomplete UTF-8 suffix trimming, run-directory reading, manifest shape inspection, run sorting, occurrence ordering, and incomplete-run detection. The implementation does not import CLI presentation code and contains no vendor-specific field or vendor-name branch.

2. **Frozen format.** A manifest produced by the writer validates against the existing `contracts/Q-0011/run-manifest.schema.json` and satisfies Q-0045's existing `run-manifest-v1` semantic checks. This ticket does not modify that schema, its semantic contract, or any other persisted contract. Tests compare produced manifests with the existing field names, enum values, nullability, and `additionalProperties: false` constraints.

3. **Run initialization.** Initializing history creates `.quorum/runs/<run_id>/`, its `steps/` directory, and an atomically written `manifest.json`. The initial manifest has status `running`, null `ended_at`, null `duration_ms`, null `stage.after`, and empty `steps` and `rollup` arrays. Initialization fails explicitly if the ticket stage conflicts with persisted run history, the run directory already exists, or the initial manifest cannot be persisted; it does not reuse or overwrite the conflicting directory.

4. **Run-id allocation.** The next numeric run id is one greater than the highest run number found in either `ticket.md` history or `runs.log`. Failed or interrupted attempts present only in `runs.log` therefore reserve their numbers. Missing files or empty histories start at run 1.

5. **Occurrence allocation.** Each adapter call, script step, and integrate step allocates one occurrence with a monotonically increasing sequence and its own directory under `steps/`. The directory uses at least three zero-padded digits and a filesystem-safe form of the step id. Gates and fan-out parents allocate no occurrence. Allocation records only fields permitted by the frozen schema; internal timing state cannot leak into `manifest.json`.

6. **Occurrence termination.** Terminating an active occurrence records its terminal status, non-negative duration, attempts, verdict, error, and normalized usage when supplied. Terminating the same occurrence again is a no-op. Every terminated occurrence has an `output.txt`, including an empty file when no output text exists. A persistence failure after initialization produces an explicit warning and does not discard already collected usage or replace the execution error.

7. **Adapter evidence.** For an adapter occurrence, `prompt.txt` contains the exact prompt passed to the adapter. `output.txt` contains the exact final output, or the exact raw invalid structured output when validation fails. Artifact persistence performs no newline normalization, truncation, JSON reserialization, or other text rewriting. UTF-8 truncation support removes only an incomplete trailing code point and retains all complete bytes.

8. **Manifest replacement.** Every manifest update is written to a temporary file, flushed, closed, and renamed over `manifest.json`; readers are not exposed to a partially written manifest. Failure of the initial replacement is fatal. Failure of a later replacement is reported as a warning and leaves the last complete manifest available. No successful path writes the manifest directly in place.

9. **Terminal lifecycle capability.** The writer API can finalize a run as each terminal status allowed by the frozen schema: `completed`, `failed`, `aborted`, `regressed`, `exhausted`, and `interrupted`. Finalization records a non-null UTC `ended_at`, a non-negative `duration_ms`, the resulting `stage.after` value or null as supplied by the run loop, and a roll-up that includes every occurrence with usage, regardless of occurrence status. Integration of this capability into every run-loop exit belongs to Q-0050.

10. **Usage normalization.** Missing usage is represented as null. Present usage contains a non-empty vendor label and preserves each reported value for input, output, cached-input, cache-write-input, and cost; an absent measure is null, not zero. A supplied vendor label takes precedence over the fallback vendor. Core does not infer a price or load a rate table.

11. **Per-vendor roll-up.** Roll-up produces one row per vendor and no cross-vendor total. Each row counts every occurrence with usage for that vendor, including failed occurrences. Each non-null measure is summed independently; an entirely unreported measure remains null. `unpriced_steps` equals the number of included occurrences whose `cost_usd` is null. A vendor row with any unpriced occurrence does not invent a price for that occurrence.

12. **Money and token presentation.** A usage or roll-up with non-null cost formats money to three decimal places. Null cost renders as `n/a` with the reported input-plus-output token count and an indication that the vendor reported no price; it never renders as `$0.000`. Token totals do not add cached or cache-write input fields again because reported input totals already include the applicable cache components.

13. **Error representation.** Adapter failures are represented using the existing frozen manifest error categories and preserve a non-empty actionable message. Existing authentication and transient classification supplied by the adapter contract layer is reused rather than independently reimplemented in run history. Script, integrate, structured-output, interrupted, and unknown errors can be represented without extending the schema.

14. **Reader enumeration.** Reading a missing `.quorum/runs/` directory returns an empty run list and no warning. For an existing directory, each immediate directory is inspected independently. A valid sibling remains readable when another entry has a missing, malformed, or insufficiently shaped `manifest.json`; the bad entry produces a warning naming its run directory and reason.

15. **Reader shape check.** Before a parsed manifest is returned as a readable run, the reader verifies that it is an object; `run_id`, `ticket_id`, and `status` are strings; and `steps` and `rollup` are arrays. This lightweight reader check does not replace schema or semantic validation and does not repair, default, or rewrite persisted data.

16. **Reader confinement.** Before returning or opening a selected run, the reader resolves filesystem real paths for the runs root, run directory, and manifest path and verifies confinement to the real runs root. A symlink at any path segment that resolves outside `.quorum/runs/` is refused, even when its lexical path is inside that directory. A missing or unresolvable real path is refused explicitly. Tests include a single-segment symlink inside `.quorum/runs/` targeting a manifest outside the repository.

17. **Reader ordering.** Run lists sort by `started_at` descending, then by run id ascending using plain string order. Occurrences sort by the numeric prefix in `steps/<sequence>-…`; an absent or malformed prefix sorts after valid prefixes. Sorting returns a new sequence and does not mutate the parsed manifest.

18. **Incomplete runs.** A manifest is reported as incomplete when its status is `running` or `ended_at` is null. The reader reports the persisted manifest and incomplete state without repairing, deleting, or terminalizing it.

19. **Type safety.** New code is strict TypeScript with no `any`. Public symbols and non-obvious fields have JSDoc contracts. The types distinguish an unpriced cost (`null`) from a reported numeric cost so formatting and aggregation cannot coerce an unknown price to zero. No deprecated dependency API is introduced.

20. **Port regression tests.** Unit-level tests covering AC-2 through AC-19 are ported with the module and run under the workspace test runner. They include the three regression witnesses: failed occurrence cost remains in the roll-up; run ids account for failed/interrupted entries in `runs.log`; and a realpath traversal through a symlink is refused. Existing mock-adapter end-to-end tests remain green without changing `spike/**`.

21. **Dependency and sequencing gate.** Implementation starts only after Q-0041 and Q-0045 report `main:contained`, and after the Q-0037 sequencing choice in Open question 1 is resolved. Q-0049 exports the reusable subsystem required by Q-0050 and does not port Q-0050's run loop.

22. **Cross-cutting verification.** The change records the following checks in its implementation evidence: BYOS is unaffected and no subscription-secret path is added; worktree safety is unaffected; gate behavior is unaffected; the run-manifest schema and semantic contract are unchanged; `pnpm lint`, strict type checking, and relevant tests pass; no file under `spike/**` changes; and the cold-clone path gains no new command, prompt, setup step, or dependency.

## Non-goals

- Changing `contracts/Q-0011/run-manifest.schema.json`, its semantic rules, or the persisted run-history format.
- Adding diffed SHAs, event data, new statuses, new error categories, or other fields to the manifest.
- Persisting the event stream.
- Porting the run loop, routing, stage transitions, gates, adapter execution, script execution, fan-out, integrate behavior, or another Q-0009 child module.
- Wiring every terminal run-loop exit to the writer; Q-0050 owns that integration.
- Implementing CLI argument handling, human-readable CLI rendering, the `quorum` binary, or the web UI.
- Editing or deleting any file under `spike/**`.
- Fixing a defect discovered while reading the spike unless an accepted erratum or decision explicitly authorizes the behavior change.
- Adding a local pricing table or estimating a price for usage whose cost is null.
- Repairing, deleting, or inferring terminal state for an incomplete manifest.
- Adding hidden daemon or database state; `.quorum/runs/` remains the durable source.
- Changing worktree, branch, gate, cross-vendor, or subscription-login behavior.
- Multi-user support, remote daemon, cloud sync, plugin marketplace, visual node canvas, eval suites, Gemini adapter, or desktop shell.

## Open questions

1. **Blocker — which Q-0037 version is the port source?** Must Q-0037 land its one major and eight nits in `spike/**` before Q-0049 starts, or has it been formally retargeted to `packages/core`? The same fixes must not be applied independently on both sides. **Owner:** Q-0049 owner with Q-0037 owner. **Required before:** implementation begins.

2. **Blocker — is failed-run `ticket.md` history intentionally outside this port?** The ticket describes missing failed and interrupted runs from `ticket.md` history as a defect that must not be reintroduced, while the charter requires behavior preservation and assigns run-loop lifecycle integration to Q-0050. The proposed criteria preserve run ids through `runs.log` and make all terminal states representable, but do not add failed runs to `ticket.md` history. If this ticket is intended to fix that gap, it needs an accepted behavior-change authority and explicit ownership of the `ticket.md` persisted behavior. **Owner:** product owner and Q-0009 owner. **Required before:** accepting any criterion that changes `ticket.md`.

3. **Does core own presentation helpers or only presentation-neutral values?** The port list explicitly includes `formatCost`, while the CLI reader also contains run header and vendor-summary formatting not named in the register. The proposed scope ports cost/token formatting required by invariant 3 but leaves full CLI rendering to Q-0010. Confirm whether any additional formatting helper is part of core's public API. **Owner:** Q-0049 owner with Q-0010 owner. **Required before:** finalizing the exported API; not a persisted-format blocker.

4. **What error channel does the reusable writer use for non-fatal persistence failures?** The spike calls `ctx.ui.warn`, but core must not depend on CLI presentation. Confirm whether Q-0041 already defines a neutral callback or error/result shape to use. **Owner:** Q-0041 and Q-0049 owners. **Required before:** public API implementation.

## Risks

- A quiet fix to the known failed-run history gap would make the spike and port suites green against different behavior and invalidate the port's independent witness.
- Porting Q-0037 changes twice can create conflicting or subtly divergent fixes between `spike/**` and `packages/core`.
- A lexical path check can pass tests while permitting a symlink to read an arbitrary manifest elsewhere on disk; the regression test must exercise real filesystem links.
- Storing internal timing data on manifest objects can violate `additionalProperties: false`, especially while parallel occurrences are still running.
- Treating null cost as zero understates failed-run spend and presents unknown money as free. Types and tests must preserve the distinction through normalization, aggregation, and formatting.
- A failed occurrence can be omitted if aggregation filters on terminal status rather than on the presence of usage.
- A non-atomic update can leave malformed JSON after interruption, hiding all otherwise valid run evidence from downstream readers.
- Coupling reader behavior to CLI rendering would force the future local daemon to depend on CLI code and recreate the boundary this ticket is intended to establish.
