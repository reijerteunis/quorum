# Q-0011 — Run history on disk with per-vendor roll-up

## Problem

A maintainer cannot inspect a run after its terminal closes. The ticket's `runs.log` records short step summaries and `ticket.md` records one monetary value per run, but neither preserves prompts, traces, complete usage, step timing, or failure details. Failed adapter calls are especially hard to audit: a vendor may report usage before failing, yet the evidence needed to explain or recover that usage disappears with the process.

The current run-level monetary value is also misleading for a mixed-vendor run. Claude reports money while Codex reports tokens only. Adding Claude's reported money to an implied zero for Codex presents a partial amount as the total cost of the run.

This ticket adds a durable, repository-local record under `.quorum/runs/<run-id>/`. The engine writes vendor-neutral events and run metadata while the run is executing. The CLI reads those files after the process exits and presents a per-step timeline and a per-vendor roll-up without consulting terminal scrollback or hidden daemon state.

Surfaces touched: CLI (`harness` in the spike), `.quorum/`, the shared adapter event contract, the engine, and `harness validate`. The Studio is not changed, but the files produced here must be usable by its later run-history surface.

## User story

**Maintainer.** As a solo maintainer running a ticket through multiple vendors, I want to inspect every completed, failed, aborted, regressed, exhausted, or interrupted run from disk so that I can understand what happened, identify the failed step, and see money or token usage per vendor without relying on terminal scrollback.

**Adopter.** As a cold-clone adopter, I want run history to be created automatically and readable through one CLI command, without configuration or another service, so that auditability does not add setup to my first run.

**Contributor.** As an adapter contributor, I want one documented, vendor-neutral event and usage contract so that my adapter can supply traces without the engine, CLI, or future Studio learning my vendor's native event format.

## Acceptance criteria

1. **The engine creates one run directory before executing the first step.** For every non-dry run, the engine creates `.quorum/runs/<run-id>/` beneath the project root before an adapter, script, integrate step, or gate is entered. A dry run creates no run-history directory or file. The run ID used in the directory, manifest, events, `runs.log`, terminal output, and ticket history is identical. The unresolved uniqueness decision in Open question 1 blocks the final directory-name schema.

2. **Each run has a schema-valid manifest.** `.quorum/runs/<run-id>/manifest.json` contains, at minimum: schema version; run ID; ticket ID and ticket-folder path relative to the project root; flow name; flow-file path relative to the project root; initial and current ticket stage; run status; start time; last-updated time; terminal time or `null`; ordered step occurrences; and paths to the event files and roll-up. Timestamps are UTC RFC 3339 strings. Paths persisted in the manifest are relative and do not expose the user's absolute filesystem paths. Unknown fields are rejected by the v1 schema.

3. **The manifest distinguishes every terminal outcome.** `status` is one of `running`, `completed`, `failed`, `aborted`, `regressed`, `exhausted`, or `interrupted`. A terminal manifest records the final stage and terminal time. A failed or interrupted run is never marked `completed`. A run that reaches an exhaustion gate records the exhaustion event even if its eventual terminal status is `completed`, `aborted`, `regressed`, or `interrupted`.

4. **Every executed step occurrence has its own append-only JSONL event file.** The manifest lists each occurrence in execution order and maps it to one file beneath the run directory. Parallel occurrences may have the same ordinal but must have distinct stable occurrence IDs. A repeated step caused by a backward edge or gate retry must not overwrite the earlier occurrence. The occurrence naming decision in Open question 3 blocks the final path convention.

5. **Events use one vendor-neutral envelope.** Every non-blank line in an event file is one complete UTF-8 JSON object containing: schema version, event ID, run ID, step occurrence ID, step ID, sequence number, timestamp, and event type. Sequence numbers start at 1 and increase by exactly 1 within an occurrence. Event types cover at least `step_started`, `text`, `tool`, `verdict`, `usage`, `step_completed`, and `step_failed`. Script, integrate, fan-out coordination, and gate occurrences use the same envelope and may use additional types declared by the schema. Downstream readers require no vendor-specific parsing.

6. **Adapter-native traces do not leak above the adapter layer.** Claude and Codex adapters map native output into the shared event contract before invoking `onEvent`. Event payloads may identify the vendor and model as data, but may not contain an unparsed vendor envelope whose interpretation is required to render the timeline or calculate usage. Adding a contributor adapter requires no engine or CLI branch based on the adapter name.

7. **The persisted trace includes the effective prompt subject to the retention decision.** A step's durable history makes it possible to determine the exact prompt submitted to the adapter, including role, ticket, harness inputs, backlog inputs, materialised diff, instructions, and output contract. The representation and default retention policy are blocked by Open question 2. Regardless of that answer, prompts must never be written to `runs.log` or `ticket.md`.

8. **Usage events preserve reported values without estimation.** A usage payload has nullable `input_tokens`, `output_tokens`, `cached_input_tokens`, `cache_write_input_tokens`, `cost_usd`, and a required `vendor`. Values are non-negative numbers or `null`; missing vendor data is stored as `null`, never as zero. Claude's input count includes its reported cache-creation and cache-read input. Codex output includes reported reasoning-output tokens according to the existing adapter decision. The engine does not apply a price table or infer missing values.

9. **Usage from failed adapter calls is persisted.** If an adapter reports partial or final usage before throwing, the occurrence contains a `usage` event followed by `step_failed`. Its usage contributes to the roll-up. The persisted failure includes a stable error category, human-readable reason, and exit status when reported. It does not include an absolute path, subscription material, or an uncontrolled full process environment.

10. **The roll-up groups usage by vendor without creating a blended total.** `.quorum/runs/<run-id>/rollup.json` contains one entry per vendor used by an adapter occurrence. For a vendor that reports money, its entry reports the summed `cost_usd` and does not present tokens as the substitute headline measure. For a vendor that reports no money, `cost_usd` remains `null` and its entry reports summed input, cached-input, cache-write-input, and output tokens. A mixed run such as Claude plus Codex is displayed as separate values such as `claude: $4.54` and `codex: 71,600 input / 4,218 output tokens`; it never displays `$4.54` as the run's total cost and never displays Codex as `$0.00`.

11. **The roll-up is derivable from events.** For each vendor, recomputing usage from all of the run's usage events produces the same values as `rollup.json`. Retried, parallel, failed, and interrupted occurrences are included once. Script, integrate, fan-out coordination, and gate occurrences without adapter usage do not create vendor entries. The roll-up records how many occurrences have wholly or partially unreported usage so absence is visible.

12. **History is updated throughout the run, not only on success.** The engine appends each event before exposing it to the terminal UI and updates the manifest and roll-up after each occurrence reaches a terminal state. On normal completion, handled failure, abort, regression, or signal handling, the final event data, roll-up, and terminal manifest are written before `runFlow` returns or exits. A test that injects adapter failure after reported usage proves that the failure reason and usage remain readable in a new process.

13. **Mutable JSON files are replaced atomically.** Manifest and roll-up updates write a complete temporary file in the same directory and rename it over the prior file. A reader must see either the previous valid version or the next valid version, never partial JSON. Event JSONL is append-only. If the process is forcibly killed between writes, every complete existing line still validates and the CLI reports the manifest as `running` or stale rather than inventing a terminal result.

14. **Concurrent step writers cannot corrupt one another.** Parallel steps write different event files. Their manifest and roll-up updates are serialised by the engine. A regression test runs at least two parallel mock-adapter steps with interleaved events and proves that both timelines are complete, their event IDs and occurrence IDs are distinct, and the roll-up contains each usage record exactly once.

15. **The CLI lists persisted runs without reading tickets as its source of truth.** `harness history` lists runs found under `.quorum/runs/`, newest first, showing run ID, ticket ID, flow, status, start time, duration when known, vendors, and each vendor's honest roll-up measure. A missing `.quorum/runs/` directory produces an empty-state message and exit code 0. One malformed run directory does not hide valid siblings; the command identifies the malformed run and exits non-zero after listing readable runs.

16. **The CLI renders one run from disk.** `harness history <run-id>` prints the manifest summary, per-vendor roll-up, and an ordered step timeline including occurrence, role when known, vendor/model when applicable, start/end time, duration, verdict, and failure reason. It reads only files within the selected run directory. Unknown run IDs produce a clear error and non-zero exit code. `--json` returns a documented machine-readable object assembled from the same files, without ANSI codes.

17. **The reader handles active and incomplete history explicitly.** When the manifest says `running`, lacks a terminal time, references a missing event file, contains a truncated final JSONL line, or disagrees with the roll-up, the CLI labels the run incomplete or corrupt and names the affected file. It may display complete preceding events, but it must not silently repair files, omit the warning, or report a successful terminal state.

18. **The event contract is executable end to end.** `contracts/Q-0011/events.schema.json`, `manifest.schema.json`, and `rollup.schema.json` use JSON Schema draft 2020-12 and compile with the repository's existing validator. `harness validate` accepts JSONL data files and validates every non-blank line independently against the supplied schema, reporting the filename and one-based line number for each violation. QA-red validates a real event file generated by the mock-adapter end-to-end suite, not only a hand-written fixture.

19. **Schema failures are testably red before implementation.** The qa-red artifact includes at least one real generated history artifact that fails because a required event field or roll-up rule is absent, while malformed JSONL, an invalid timestamp, a sequence gap, a negative usage value, an unknown event type, and an unexpected field each have independent negative tests. The development suite reaches green without weakening the schemas.

20. **Existing ticket audit files remain compatible.** `runs.log` and `ticket.md` history continue to be written for existing board and stage behaviour. Existing ticket folders with no `.quorum/runs/` data remain readable and are not migrated or rewritten. Run history created before this feature is not fabricated from `runs.log`. No cost is counted twice in `ticket.md`, the new roll-up, or CLI output.

21. **Run history stays outside the user's working-tree mutations performed by a flow.** The engine may write only the audit files under the project root's `.quorum/runs/` area and the already-authorised ticket files. Code-writing steps still run only in `.quorum/worktrees/` or the repository's currently documented worktree root, on sibling branches of `harness/<ticket-id>/integration`. Persisting history does not copy agent-produced source changes into the user's working tree.

22. **BYOS behaviour is unchanged.** No schema, event, manifest, roll-up, CLI flag, test, fixture, or documentation example accepts subscription secrets. Adapter `check()` still refuses when `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, or `CODEX_API_KEY` is set, and refuses before probing the CLI. Run-history tests use the mock adapter and do not introduce a key-based path.

23. **Gate behaviour is unchanged and observable.** Human gates remain the default, `auto` remains opt-in per gate, and a `human-locked` gate cannot be overridden. Gate presentation and answers generate durable events without changing their existing semantics. Exhausted loops and exceeded budgets still land on a human gate, and interruption while waiting at a gate leaves the run visibly interrupted on disk.

24. **The feature adds no cold-clone setup.** History is enabled automatically for non-dry runs, uses only repository-local files, and requires no daemon, database, account, environment variable, or new configuration. The README's first-run path gains at most an optional command demonstrating `harness history <run-id>`; the command is not required to complete a flow.

25. **The M1 fan-out exercises two roles on two vendors with disjoint ownership.** Solutioning splits implementation into at least an engine/shared-contract task owned by `developer-backend` on Codex and a CLI/validator task owned by the repo-local `developer-tooling` role on Claude. Their declared write paths do not overlap. They run in separate worktrees, integrate onto `harness/Q-0011/integration`, and the mock-adapter end-to-end suite reaches green within three development iterations. Tests or contract fixtures that both tasks need must be assigned to one task or created before fan-out; shared-file editing is not presented as disjoint work.

26. **Documentation follows repository vocabulary and architecture.** The shared event contract is documented in the adapter contract or its successor, `.quorum/runs/` is documented as the persistent source for run history, and the CLI examples use only the terms flow, step, gate, adapter, ticket, contract, role, fan-out step, and integrate step as defined in `docs/GLOSSARY.md`. If implementation changes an existing architectural decision or the documented worktree root, the change includes an append-only `docs/DECISIONS.md` entry.

## Non-goals

- Building the Studio run-history, mission-control, gate, or trace screens.
- Streaming history over WebSocket or adding a daemon API.
- Resuming a run from persisted events after process restart; that remains Q-0019 scope.
- Migrating or reconstructing old runs from `runs.log`, terminal output, or `ticket.md` history.
- Replacing `runs.log` or ticket history in this ticket.
- Estimating vendor prices, bundling a rate table, accepting user-supplied rates, or producing one blended monetary total.
- Budget caps, quota forecasting, alerts, invoices, or subscription billing reconciliation.
- Searching, filtering, deleting, pruning, exporting, compressing, or setting retention periods for run history beyond the prompt-retention decision in Open question 2.
- Persisting or replaying a vendor's resumable session.
- Adding Gemini or another adapter.
- A remote daemon, cloud sync, multi-user access, desktop shell, plugin marketplace, visual flow canvas, or eval suite.
- Changing flow routing, retry limits, gate semantics, cross-vendor lint, stage transitions, or worktree branch rules.
- Making vendor-native event formats part of the engine, CLI, schema, or future Studio contract.

## Open questions

1. **Blocker — What is a globally unique run ID?** Current numeric run IDs are allocated per ticket, while `.quorum/runs/<id>/` is project-wide; two tickets can both create run `1`. Options include a project-wide monotonic integer, a composite `<ticket-id>-<ticket-run-number>`, or a sortable random ID. This changes directory names, manifest identity, CLI arguments, and links from `runs.log` and ticket history. **Owner: Ruud. Must be decided before the manifest and path schemas are approved.**

2. **Blocker — Are exact prompts stored by default, and what must be redacted?** The ticket explicitly identifies lost prompts as a problem, but prompts can contain proprietary source, ticket content, diffs, local paths, or text resembling secrets. Options include storing exact prompts as events, storing a separate prompt file referenced by an event, or making prompt persistence opt-in. Any redaction would prevent exact replay and needs a deterministic contract. **Owner: Ruud, with security review. Must be decided before the event schema and retention tests are approved.**

3. **Blocker — What is the stable identity and filename of a step occurrence?** Step IDs repeat across backward edges, retries, fan-out tasks, and rounds. The choice between an ordinal, `<step-id>-<attempt>`, or an opaque occurrence ID affects event paths and future Studio deep links. Filenames must also be safe when user-authored step IDs contain punctuation. **Owner: principal architect. Must be decided before the manifest and event schemas are approved.**

4. **Should textual trace events preserve full text or bounded chunks?** Full text best supports diagnosis but can make history large; bounded chunks need a maximum byte size, UTF-8 boundary rule, and explicit truncation event. This does not permit silent truncation. **Owner: principal architect. Answer during solutioning; if a bound is introduced, it becomes an independently tested schema rule.**

5. **Should `harness history --json` expose stored events inline or return file references?** Inline output is convenient but can be very large; references preserve streaming behaviour and mirror the on-disk contract. **Owner: CLI maintainer. This affects only the CLI JSON response, not the persisted file format.**

## Risks

1. **Sensitive prompt retention.** Durable prompts and traces can preserve source code or accidental secrets in a git-ignored but readable directory. The prompt policy is therefore a blocking product and security decision, not an implementation default.

2. **Run-ID collision.** Reusing today's per-ticket integer in a project-wide directory can overwrite or merge unrelated histories. Atomic file writes do not protect against choosing the same directory.

3. **False cost precision.** Existing code totals all reported money into one run value. Reusing that value in the new CLI would describe Claude's partial reported amount as the cost of a mixed run and Codex as free. Per-vendor presentation and null handling require regression coverage.

4. **Lost final events on hard termination.** Signal handlers cover cooperative interruption, but power loss or `SIGKILL` can occur between an adapter event and a manifest update. Append-only event files, atomic summary replacement, and explicit incomplete-state rendering limit the damage but cannot guarantee the final event was flushed.

5. **Disk growth.** Exact prompts and full text traces can be much larger than present ticket artifacts, especially through retries and parallel fan-out. Retention and pruning are non-goals, so the CLI must at least make corruption and missing files explicit and the format must allow a later pruning policy without changing event meaning.

6. **Schema drift before the TypeScript port.** Q-0011 is implemented in the JavaScript spike before `packages/shared` exists. If the event shape is embedded only in engine code, M2 may create a second format. The JSON Schemas and adapter contract must be treated as the portable shared contract.

7. **Concurrent summary updates.** Parallel adapter events can race on one manifest or roll-up and lose usage even when their individual event files are correct. Serialised updates and recomputation tests are required.

8. **Misleading reconstruction.** A reader that silently ignores malformed lines or recomputes missing terminal state can turn incomplete evidence into an authoritative history. The CLI must prefer an explicit incomplete or corrupt result over a guessed one.

9. **Fan-out ownership may appear disjoint while tests overlap.** The engine and CLI tasks naturally meet at schemas and fixtures. Solutioning must assign those shared artifacts to one owner or land contracts before fan-out; otherwise Q-0011 would not demonstrate M1's required disjoint-file development.
