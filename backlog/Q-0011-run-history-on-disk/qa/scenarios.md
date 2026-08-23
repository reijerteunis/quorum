## Q-0011 — Test scenarios: run history on disk with per-vendor roll-up

Source: `requirements/merged.md` (14 acceptance criteria, 12 live after the 2026-08-23 scope cut),
`solution/solution.md` (approved final solution), `solution/errata.md` (E-1, E-2, E-3),
`solution/tasks.yaml`, the four frozen contracts on branch `harness/Q-0011/contracts` —
`contracts/Q-0011/run-manifest.schema.json`, `contracts/Q-0011/run-history-writer.contract.md`,
`contracts/Q-0011/mock-adapter-run-history.contract.md`, `contracts/Q-0011/runs-cli.contract.md` —
and the architecture reviewer's approving pass (`solution/review.md`, verdict: approve). Every
field name, enum value and regex below was checked against the committed contract text, not
re-derived from the requirement's prose, because the requirement and the contracts disagree in a
few places the errata resolve.

Tasks referenced: `q0011-engine-writer` (role `backend`, adapter codex, owns `spike/src/**` plus
four doc files) and `q0011-cli-reader-validator` (role `tooling`, adapter claude, owns only
`spike/bin/harness.js`). All test files live in `spike/test/**`, which belongs to qa-red and
neither implementation task — both tasks' descriptions explicitly forbid editing it.

### Testability flags (role duty: flag what can't be tested as written)

**Flag 1 — `ticket.md`'s body still contradicts the approved scope, unfixed as of today.**
Verified directly: `backlog/Q-0011-run-history-on-disk/ticket.md`'s current body on `main` ends
"...an events schema that qa-red can fail a real artifact against," the exact sentence the
2026-08-23 scope cut was supposed to remove and that the final architecture review (`review.md`,
"Before `harness run qa-red Q-0011`," item 1) names as the one unresolved item on its maintainer
checklist. `spike/src/engine.js:352` splices this body verbatim into every downstream prompt,
including whatever prompt produced this document. No task owns `ticket.md`, so nothing in this
ticket's implementation fixes it. **These scenarios are written against `solution/solution.md`,
`solution/errata.md` and the four frozen contracts, which are authoritative over that stale
sentence — no scenario below tests an events stream, `events.jsonl`, or JSONL support in `harness
validate`.** The maintainer must correct the sentence before a real qa-red run, or the next agent
in this chain may not have this document's context to resist it.

**Flag 2 — AC-2's "spawn record carries argv" clause has nothing left to constrain.** The
original requirement text reads "No file... contains the value of any environment variable — a
spawn record carries the adapter's argv only." Round-7 review (finding M-2) caught that the frozen
schema has `additionalProperties: false` with no `argv` property anywhere, because "spawn record"
was part of the event stream AC-6/AC-7 removed. The fix taken (directive 3, confirmed closed in
`review.md`: "`argv` struck from the writer contract... no `argv` property in the schema either")
was to delete the sentence outright, not to add a field. The clause is therefore satisfied
vacuously — there is no spawn record of any kind, so nothing about command-line arguments is
persisted anywhere in this ticket's scope. A scenario asserting "argv is present" would be testing
a requirement sentence the accepted resolution deleted; the scenario below instead asserts
argv/command-invocation data is **absent**, alongside the environment-variable prohibition.

**Flag 3 — the run-id/ticket-id join is a naming convention, not something `harness validate` can
catch if broken.** AC-1's whole substitute for changing `runs.log`'s format is "`run=3` in
`runs.log` and `history` is directory `Q-0011-3`" — but per `solution.md`'s own "Open questions"
and round-7's N-1, this join is **not** added to the semantic validator in this ticket ("deferred
to a later contract revision"). The scenario below proves the writer produces the correctly-named
directory for the run it just ran; it cannot prove `harness validate` would catch a future
regression that silently breaks the naming convention, because no check does. Flagged, not
silently assumed.

### Scope-cut and errata notes

**AC-6, AC-7 — retired in full, no scenario.** The 2026-08-23 scope cut in `requirements/merged.md`
removes `events.jsonl`, its typed envelope, `seq` contiguity, the `raw`-deletion test, and JSONL
support in `harness validate`, in full. Numbering is preserved only so this document, the
contracts and prior review rounds keep referring to the same criteria. The vendor-neutrality this
ticket still needs is carried by AC-9.

**E-1 (supersedes AC-11's "per vendor that ran an adapter step").** An adapter occurrence that
failed *before* reporting usage stays visible in manifest detail with `usage: null`, but creates no
vendor row and is not counted as an unpriced step. Roll-up recomputation is over final aggregate
`usage` objects only.

**E-2 (supersedes AC-14's "needs no new capability").** `harness validate` gains a semantic pass,
keyed off the schema annotation `x-quorum-contract: run-manifest-v1`, that runs after structural
JSON Schema validation. JSONL support is not added. An absent or unrecognised annotation produces
an explicit skipped-checks notice, never a silent pass read as "checked."

**E-3 (supersedes AC-10's "a step interrupted at a gate appears as `interrupted`").** Occurrence-
level `interrupted` applies only to an adapter, script or integrate occurrence that was in flight.
An interrupt received while the run sits at a gate marks the *run* `interrupted` and creates no
occurrence, because gates allocate none under AC-4.

---

### Acceptance-criterion scenarios

**AC-1 — a run directory exists before anything is spawned**
Tags: q0011-engine-writer
- Given a ticket ready to run a flow with the mock adapter and no existing `.quorum/runs/<ticket-id>-<n>/`
- When a non-dry `harness run` executes
- Then `.quorum/runs/<ticket-id>-<n>/`, its `steps/` subdirectory and an initial `manifest.json` with `status: "running"` all exist strictly before the first adapter spawn, script execution or integrate command — proved by instrumenting the spawn/exec entry point and asserting the directory predates the first call.
- Given `.quorum/runs/<ticket-id>-<n>/` already exists from a prior run (or a stray directory of that name)
- When the same run id is started again
- Then the run stops before spawning any adapter, script, integrate step or gate; the error names the existing directory by path; and the directory's existing contents are byte-for-byte unchanged afterward — it is never reused or overwritten.
- Given the run directory cannot be created (for example `.quorum/runs/` exists as a plain file)
- When a non-dry run starts
- Then the run stops the same way, before anything is spawned, and no adapter is ever invoked — nothing has been billed.
- Given the same run invoked with `--dry`
- When it executes
- Then no `.quorum/runs/` entry of any kind — no directory, no manifest, no `steps/` folder — is created for that run.

**AC-2 — the run writes only there, and never records the environment**
Tags: q0011-engine-writer
- Given a normal (non-worktree) repository
- When a non-dry run completes
- Then `.quorum/` appears in `.git/info/exclude`, no tracked file was modified to add it, and `git status --porcelain` after the run shows changes only under the ticket's own `backlog/` artifacts.
- Given the process environment carries a sentinel value under a variable name that is not one of the documented `MOCK_*` switches
- When the run completes and every file under `.quorum/runs/<id>/` is grepped
- Then neither the sentinel value nor the environment-variable name occurs anywhere in the run directory; a switch's *value* that is legitimately re-emitted as domain data (`MOCK_VENDOR=acme` becoming `usage.vendor: "acme"`) is not itself forbidden, per the mock contract.
- Given the same completed run
- When every file under `.quorum/runs/<id>/` is inspected for anything resembling a command line or argument vector
- Then nothing of that shape is present anywhere — no `argv` field exists in the manifest schema, and no other file records one; per Testability Flag 2, this constrains an artifact type ("spawn record") that this ticket's architecture does not produce at all.
- Given any path persisted anywhere under `.quorum/runs/<id>/` (`ticket_path`, `flow_file`, an occurrence's `worktree`)
- When those fields are inspected
- Then every one matches the schema's `relative_path` pattern — neither a POSIX absolute path (`/...`) nor a Windows absolute path (`C:\...`) validates.

**AC-3 — the manifest is written at start, replaced atomically, and distinguishes every terminal outcome**
Tags: q0011-engine-writer
- Given a run that has just started
- When `manifest.json` is read immediately
- Then it contains exactly the schema's required fields — `schema_version: 1`, `run_id`, `ticket_id`, `ticket_path`, `flow`, `flow_file`, `stage: {before, after: null}`, `started_at` (UTC, `Z`-suffixed RFC 3339), `ended_at: null`, `duration_ms: null`, `status: "running"`, `steps: []`, `rollup: []`.
- Given a run with three sequential steps, the first two already terminal
- When `manifest.json` is read mid-run, before the third step completes
- Then it fully and correctly describes the first two steps' terminal outcomes, still shows `status: "running"`, and parses as complete, valid JSON — never partial.
- Given two mock steps scheduled in parallel that both reach a terminal state within the same tick spread
- When both terminate
- Then both steps' terminal records are present in the final manifest's `steps` array — proved by asserting `steps.length` and both distinct `step_id`s post-run; neither is lost to a dropped update, because the engine serialises replacements through one in-memory snapshot.
- Given a run in progress
- When the process receives `SIGTERM` (or `Ctrl-C`'s `SIGINT`)
- Then the handler performs one final synchronous atomic replacement marking the run `interrupted` (never left `running`, never `completed`) before exiting, using the same write/fsync/close/rename path as every in-run update — no unawaited async I/O is started before `process.exit`.
- Given a manifest replacement is paused mid-write by a test harness (the temp file exists but the rename hasn't landed) while a reader opens `manifest.json` at that instant
- When the reader parses it
- Then it successfully parses either the complete prior document or the complete new one — a forced concurrent read never observes a truncated file.

**AC-4 — every step attempt that runs something gets its own directory**
Tags: q0011-engine-writer
- Given a flow step that spawns an adapter
- When it runs
- Then its occurrence directory is `steps/001-<sanitised-step-id>` (or the next unused sequence number, zero-padded to at least three digits, in start order), matching the schema's `occurrence_dir` pattern `^steps/[0-9]{3,}-[^/:]+$`.
- Given a step id containing `/` or `:` (for example a fan-out task id `dev:Q0011-cli`)
- When its occurrence directory is allocated
- Then every `/` and `:` in the directory name is replaced with `-` (for example `steps/004-dev-Q0011-cli`), and no other character is altered.
- Given a gate in the run, exercised once answered by a human and once auto-advanced
- When the run proceeds past each
- Then neither allocates an occurrence directory, and the next real step's sequence number is exactly what it would be with zero gates in between.
- Given a flow that traverses a backward edge (`on_fail: goto`) and re-runs the same step id
- When both the original and the regressed attempt run
- Then two distinct occurrence directories exist at two different sequence numbers for that step id, and neither attempt's files overwrite the other's.
- Given a fan-out step producing two parallel task occurrences in one wave
- When the wave runs
- Then each materialised task gets its own occurrence directory at a distinct sequence number, and the fan-out parent itself allocates none.

**AC-5 — each step directory records what was sent and what came back**
Tags: q0011-engine-writer
- Given an adapter-backed step with a known assembled prompt
- When it runs to completion
- Then `steps/<seq>-<id>/prompt.txt` contains the exact assembled prompt byte-for-byte, written before the adapter is spawned, and `steps/<seq>-<id>/output.txt` contains the agent's final message as text.
- Given an adapter-backed step whose structured output fails validation
- When it terminates
- Then `output.txt` contains the raw text that failed validation — not a placeholder, not truncated, not empty.
- Given a `script` step and an `integrate` step
- When each runs
- Then neither directory has a `prompt.txt`, and both have an `output.txt` — populated with captured output, or an empty file (not an absent one) when the command produced no text.
- Given a completed run
- When `runs.log` and `ticket.md` are inspected afterward
- Then neither contains any prompt text from any step — prompts exist only under `.quorum/runs/`.

**AC-6 — removed by the 2026-08-23 scope cut**
No scenario. The append-only `events.jsonl` stream, its typed envelope and `seq` contiguity move to
a future trace-stream ticket, per `requirements/merged.md`.

**AC-7 — removed by the 2026-08-23 scope cut**
No scenario. Vendor-neutral typed events move with AC-6; the vendor-neutrality this ticket still
needs is proved by AC-9 below.

**AC-8 — the manifest step record carries the fields `runs.log` drops**
Tags: q0011-engine-writer
- Given a completed adapter step that used a worktree and branch, ran with retries, and declared a verdict
- When its manifest record is read
- Then it has every schema-required field — `step_id`, `occurrence_dir`, `kind: "adapter"`, `role`, `adapter`, `model` (or `null`), `branch`, `worktree`, `started_at`, `duration_ms`, `attempts` equal to the true invocation count, `status`, `verdict`, `error` (`null` on success), `usage` — with no field omitted (the schema requires all of them, none optional).
- Given a first-try success
- When `attempts` is read
- Then it is `1` — this specifically targets the known defect where the retry wrapper only stamped `attempts` when `attempt > 1`, silently omitting it on the common path.
- Given a step that failed twice on retryable errors before succeeding on the third attempt
- When `attempts` is read
- Then it is `3` — the actual invocation count, never the retry-limit constant and never left at `1`.
- Given a `script` or `integrate` step
- When its manifest record is read
- Then `attempts` is `0`, `kind` is `"script"` or `"integrate"` respectively, and `role`/`adapter`/`model`/`branch`/`worktree` are all `null`.

**AC-9 — usage preserves what the vendor reported and estimates nothing**
Tags: q0011-engine-writer
- Given an adapter call that reports `input_tokens`, `output_tokens`, `cost_usd` but no cache fields
- When its `usage` object is persisted
- Then `cached_input_tokens` and `cache_write_input_tokens` are `null` — never `0`, never an absent key (the schema requires all five measures as keys).
- Given a Claude-shaped mock response with `MOCK_CACHED_INPUT_TOKENS` and `MOCK_CACHE_WRITE_INPUT_TOKENS` set
- When `usage.input_tokens` and `usage.cached_input_tokens`/`cache_write_input_tokens` are read
- Then the persisted values equal exactly what the adapter reported, including cache-creation and cache-read counts already folded into `input_tokens` — this is the regression test for the retry wrapper's accumulator, which round-7 review found drops these two fields on the retry-success path and on every billed throw; the fix must survive both paths.
- Given a Codex-shaped mock response configured with reasoning-output tokens
- When `usage.output_tokens` is read
- Then it includes the reported reasoning-output tokens.
- Given `MOCK_CACHED_INPUT_TOKENS` or `MOCK_CACHE_WRITE_INPUT_TOKENS` set to a negative or non-numeric value
- When the mock is invoked
- Then it fails explicitly before emitting any usage, per the mock contract — never silently coerced or dropped.
- Given any usage object anywhere in a completed manifest
- When cross-checked against the mock's configured values
- Then no value is derived from a rate table and no field not explicitly configured is a nonzero number.

**AC-10 — a failed, exhausted or interrupted step is recorded with its usage**
Tags: q0011-engine-writer
- Given an adapter step configured with `MOCK_FAIL_WRITE` so the mock throws after reporting usage
- When the step terminates
- Then its manifest record has `status: "failed"`, a populated `error` (`category`, `message`), `attempts` equal to the true invocation count on the failing path (not omitted, per the round-7 defect on the error path), and a non-null `usage` object matching exactly the accumulated usage attached to the thrown error before it propagated.
- Given the above failure, read back by a separate process invocation (`harness runs <run-id>` after the writing process has exited)
- When the manifest is parsed
- Then the failed step's `error` and `usage` are both present and match what was written — a new process, not a lingering one, can read the full accounting of a paid failure.
- Given an adapter, script or integrate occurrence in flight when the process receives `SIGTERM`
- When the run finalises
- Then that occurrence's `status` is `"interrupted"`.
- Given the run is sitting at a gate (no occurrence in flight) when the process receives `SIGTERM`
- When the run finalises
- Then the *run's* `status` is `"interrupted"` and no new occurrence directory is created — per errata E-3, superseding AC-10's literal "a step interrupted at a gate appears as `interrupted`."
- Given a run with one failed step among several successful ones
- When the manifest is inspected
- Then every step that ran has a terminal status recorded in `steps` — none is silently absent because it failed.

**AC-11 — the roll-up is per vendor, invents no money and blends nothing**
Tags: q0011-engine-writer
- Given a run with two adapter steps both declaring `vendor: "claude"` via their mock profile (`cost_usd: 2.10` and `cost_usd: 1.50`)
- When the manifest `rollup` is read
- Then the `claude` entry has `step_count: 2`, `cost_usd: 3.60`, `unpriced_steps: 0`, and token fields summing only reported values.
- Given a third step in the same run declaring `vendor: "codex"` via `MOCK_TOKEN_ONLY=1`
- When the `rollup` is read
- Then the `codex` entry has `cost_usd: null` (never `0`, never rounded), `unpriced_steps: 1`, its own token totals, and no field anywhere sums `claude` and `codex` money together.
- Given a fourth step that fails before reporting any usage (`usage: null` in its step record)
- When the `rollup` is read
- Then that occurrence contributes no vendor row and is not counted in any vendor's `unpriced_steps` — per errata E-1, it remains visible only in step detail.
- Given a fifth step that succeeds and genuinely reports `cost_usd: 0`
- When the `rollup` is read
- Then that occurrence *is* counted in `unpriced_steps` and its `0` contributes to the vendor's summed `cost_usd` — distinguishing "reported zero" from "reported nothing."
- Given script, integrate, gate and fan-out-parent activity in the same run
- When the `rollup` is read
- Then none of them produces a vendor row.
- Given the full set of persisted occurrence `usage` objects in a completed run
- When independently regrouped by `usage.vendor` and summed by the test, following the algorithm in `run-history-writer.contract.md` exactly
- Then the result equals `manifest.json`'s `rollup` field exactly, counting each retried, parallel, failed-with-usage and interrupted-with-usage occurrence once.
- Given a completed run
- When `ticket.md`'s `history` field is diffed before and after
- Then it is byte-identical — nothing this ticket writes touches existing cost accounting.

**AC-12 — `harness runs [<ticket-id>]` lists runs**
Tags: q0011-cli-reader-validator
- Given `.quorum/runs/` contains three runs across two tickets with distinct `started_at` values
- When `harness runs` runs with no argument
- Then all three are listed, most recent `started_at` first, each row showing run id, ticket, flow, `stage.before -> stage.after`, status, duration, and per-vendor summaries labelled separately — money and tokens for a priced vendor, `cost=n/a` and tokens for an unpriced one — each stating its `unpriced_steps` count, with no combined total anywhere.
- Given a ticket id argument matching one of the two tickets
- When `harness runs <ticket-id>` runs
- Then only that ticket's runs are listed, same ordering.
- Given a syntactically valid ticket id (`^[A-Z]+-[0-9]{4}$`) with zero recorded runs
- When `harness runs <ticket-id>` runs
- Then it prints an empty list and exits `0` — identical whether that ticket exists in `backlog/` or not, since the reader never consults `backlog/` to decide.
- Given `.quorum/runs/` does not exist at all
- When `harness runs` runs
- Then it prints an explicit empty-state message and exits `0`.
- Given `.quorum/runs/` contains two valid run directories and one malformed one (unparsable `manifest.json`)
- When `harness runs` runs
- Then both valid runs are listed correctly, the malformed one is named in a warning, and the command's overall exit code is non-zero.

**AC-13 — `harness runs <run-id>` shows one run, and reports incompleteness rather than repairing it**
Tags: q0011-cli-reader-validator
- Given a completed run with four step occurrences
- When `harness runs <run-id>` runs
- Then all four attempts are listed ordered by numeric occurrence prefix, each showing adapter, model, status, start time, duration, verdict, usage, error where applicable, and the project-relative step-directory path.
- Given the detail view is rendered
- When file access during rendering is traced
- Then only files inside the selected run's own directory are read — nothing from `backlog/`, no other run directory.
- Given a run id that does not exist under `.quorum/runs/`
- When `harness runs <bad-id>` runs
- Then it prints a clear error naming the id and exits non-zero.
- Given a manifest whose `status` is still `"running"` or whose `ended_at` is `null` because the writing process was killed
- When `harness runs <run-id>` runs
- Then the run is labelled incomplete, the manifest path is named, and the command neither invents a terminal status nor silently omits the warning nor attempts to repair the file.
- Given the same incomplete run
- When `harness runs <run-id> --json` runs
- Then stdout is exactly one JSON document (parses with a single `JSON.parse`) containing the detail plus an `incomplete: true` flag and warning, with no ANSI escape codes anywhere in stdout.

**AC-14 — the contract is executable against real run artifacts**
Tags: q0011-cli-reader-validator
- Given `contracts/Q-0011/run-manifest.schema.json` (JSON Schema 2020-12, `additionalProperties: false` throughout, `x-quorum-contract: run-manifest-v1`, `schema_version: {const: 1}` as the escape hatch)
- When `harness validate contracts/Q-0011/run-manifest.schema.json <manifest.json>` runs against a `manifest.json` produced by a real end-to-end mock-adapter run
- Then it exits `0`.
- Given that manifest with a required field deleted (for example `ticket_path`)
- When validated
- Then it exits `1` naming the missing property — a pure structural failure, no semantic pass needed.
- Given that manifest with a usage token count set to `-1`
- When validated
- Then it exits `1` naming the negative-valued field — structural (`nullable_number`'s `minimum: 0`).
- Given that manifest with an unexpected extra top-level property
- When validated
- Then it exits `1`, rejected by `additionalProperties: false` — structural.
- Given that manifest with a token-only vendor's `rollup` entry `cost_usd` mutated from `null` to `0`
- When validated
- Then it exits `1`, naming the vendor and the `cost_usd` field — caught only by the E-2 semantic pass, since `0` is a structurally legal `nullable_number` and JSON Schema alone would pass this document (confirmed in `review.md`'s validator table: "`cost_usd: 0` on a token-only vendor's roll-up" is structurally valid on its own).

---

### Edge cases

Drawn from the four frozen contracts, the three errata, and the architecture reviewer's approving
pass (`solution/review.md`), where not already covered by a numbered-AC scenario above.

**EDGE-1 — the fan-out is genuinely two roles on two vendors over disjoint files**
Tags: q0011-engine-writer, q0011-cli-reader-validator
- Given `tasks.yaml`'s two tasks, both `depends_on: []`, `q0011-engine-writer` (role `backend` → `developer-backend` → codex, owning `spike/src/**` plus four doc files) and `q0011-cli-reader-validator` (role `tooling` → `developer-tooling` → claude, owning only `spike/bin/harness.js`)
- When the development fan-out runs both in a single wave and `integrate` merges their branches onto `harness/Q-0011/integration`
- Then the merge produces no file-level conflict, and the merged tree's changed-file set is exactly the union of the two owned path sets — this is M1's "two roles on two vendors, disjoint files" fan-out demonstration, and the review confirmed `depends_on: []` on both produces one wave, not two serial ones.

**EDGE-2 — an integrate step with no configured commands still gets one occurrence**
Tags: q0011-engine-writer
- Given an `integrate` step with neither `commands.install` nor a test command configured
- When it runs and the merge succeeds
- Then it still allocates exactly one occurrence directory, `kind: "integrate"`, `status: "completed"`, and an `output.txt` that exists and is empty — the merge itself is the work.

**EDGE-3 — install and test are phases of one integrate occurrence, not two**
Tags: q0011-engine-writer
- Given an `integrate` step with both `commands.install` and a test command configured, and the install phase fails
- When it runs
- Then exactly one occurrence is recorded (not two), with `status: "failed"` and `error.category: "integrate"` — and the same holds when install succeeds but the test command fails instead.

**EDGE-4 — vendor is declared per call, never inferred from adapter routing**
Tags: q0011-engine-writer
- Given `MOCK_RUN_HISTORY_PROFILES` configured so the `backend` role's steps declare `vendor: "codex"` and the `tooling` role's steps declare `vendor: "claude"`, both routed through the same mock adapter object whose static `adapter.vendor` is `"mock"`
- When both steps run to completion
- Then `usage.vendor` is `"codex"` and `"claude"` respectively for each — the static fallback is never used when a per-call `result.vendor`/`error.vendor` is declared, and one mock-only run produces two distinct roll-up vendor rows without invoking a real CLI.

**EDGE-5 — sequence numbers never truncate past three digits**
Tags: q0011-engine-writer
- Given a test harness driving the occurrence allocator past 999 allocations in one run
- When the 1000th occurrence is allocated
- Then its directory is `steps/1000-<id>` — four digits, matching the schema's `[0-9]{3,}` minimum-three-digit (not maximum-three-digit) pattern.

**EDGE-6 — a write failure after run-directory creation warns and continues, never discards billed work**
Tags: q0011-engine-writer
- Given a run in progress where a single manifest replacement or `output.txt` write is forced to fail after `.quorum/runs/<id>/` already exists
- When that failure occurs
- Then the engine emits an explicit warning naming the affected path and continues the run rather than throwing away the already-billed step's result; the in-memory snapshot remains authoritative so a later successful replacement still reflects that step correctly. This is deliberately different from AC-1's fatal pre-spawn failure — the split is intentional, not an inconsistency.

**EDGE-7 — `ensureExcluded` covers linked worktrees and warns rather than failing silently on either shape**
Tags: q0011-engine-writer
- Given a run executing from a linked worktree (`.git` is a file pointing at the real git dir, not a directory) — the shape this repository's own dogfooded runs use under `.harness/worktrees/`
- When the run starts
- Then `.quorum/` is added to the *real* git directory's `info/exclude`, resolved through the `.git` file, and `git status` in that worktree is unchanged after the run.
- Given the applicable `info/exclude` file cannot be resolved or written (for example, a permissions failure)
- When the run starts
- Then an explicit warning names the unresolved or unwritable path, the run proceeds (non-fatal once the run directory itself is initialised), and it never fails silently.

**EDGE-8 — backward-edge repeats and interleaved parallel occurrences never collide**
Tags: q0011-engine-writer
- Given a step id revisited twice via a backward edge, with other steps running in between each attempt
- When both attempts complete
- Then both occurrence directories survive with distinct sequence numbers reflecting true start order, and reading either's `prompt.txt`/`output.txt` returns that attempt's own content only.

**EDGE-9 — a hard kill leaves an honestly incomplete manifest, never a repaired one**
Tags: q0011-engine-writer, q0011-cli-reader-validator
- Given a run process terminated with `SIGKILL` between a step's completion and the next manifest replacement (simulated by killing the write before it lands)
- When `harness runs <run-id>` is invoked afterward by a new process
- Then the manifest is read as-is (`status: "running"`, `ended_at: null`), and the reader reports it incomplete without inferring or writing any terminal status into the file itself.

**EDGE-10 — ticket-filter selection grammar rejects the in-between cases explicitly**
Tags: q0011-cli-reader-validator
- Given the arguments `q-0011` (wrong case), `Q-11` (wrong digit count) and `Q-0011` (well-formed), none matching an existing run-directory name
- When each is passed to `harness runs <arg>`
- Then `q-0011` and `Q-11` each produce an unknown-run error and a non-zero exit — they match neither an existing run directory nor `^[A-Z]+-[0-9]{4}$` — while `Q-0011` is accepted as a ticket filter (empty list, exit `0`, if it has no runs); malformed values are never silently treated as an empty-list filter.

**EDGE-11 — list ordering ties break lexically on `run_id`, not numerically**
Tags: q0011-cli-reader-validator
- Given two runs `Q-0011-2` and `Q-0011-10` sharing the same `started_at` timestamp
- When `harness runs` lists them
- Then they order by `run_id` ascending as a plain string comparison — `Q-0011-10` sorts before `Q-0011-2` because `"1" < "2"` lexically — and the contract explicitly rules out "fixing" this to sort by the numeric suffix instead.

**EDGE-12 — `--json` output is exactly one document with no ANSI, in every mode**
Tags: q0011-cli-reader-validator
- Given `harness runs --json` (list), `harness runs <run-id> --json` (detail), and at least one invocation against a run carrying warnings (a malformed sibling, or an incomplete manifest)
- When stdout is captured in each case
- Then stdout parses as a single JSON document via one `JSON.parse` call, contains no `\x1b[`-style ANSI sequences, and any warnings appear as fields inside that document rather than as separate lines before or after it.

**EDGE-13 — an absent or unrecognised contract annotation produces an explicit skip notice, not a silent pass**
Tags: q0011-cli-reader-validator
- Given a structurally valid JSON document validated against a schema with no `x-quorum-contract` annotation, and separately against one with an unrecognised annotation value
- When `harness validate` runs on each
- Then both exit `0` on structural validity alone, and both print an explicit notice that run-manifest semantic checks were skipped — the exit code alone must never be read as proof the roll-up/lifecycle semantics were checked.

**EDGE-14 — `exhausted` is schema-reserved but this ticket never emits it**
Tags: q0011-engine-writer
- Given a run whose flow hits its bounded-loop iteration limit mid-run (the engine's existing `recordEvent(..., 'exhausted', ...)` path updates ticket history and the run proceeds to a gate)
- When the run's manifest is inspected after it eventually reaches a terminal outcome
- Then no occurrence or run-level `status` anywhere in that manifest is the literal string `"exhausted"` — the actual terminal status is one of `completed`, `failed`, `aborted`, `regressed` or `interrupted`, and the Q-0011 test suite requires no `exhausted` manifest fixture; the enum value stays legal for forward compatibility only.

**EDGE-15 — the semantic validator catches a structurally-legal duplicate occurrence directory**
Tags: q0011-cli-reader-validator
- Given a manifest whose `steps` array has two entries sharing the same `occurrence_dir` (structurally legal — the schema has no uniqueness constraint on array items)
- When `harness validate` runs the E-2 semantic pass against it
- Then it exits `1`, naming the duplicated `occurrence_dir` — confirmed in `review.md`'s validator table: a synthetic manifest with this exact defect validated structurally as `valid`, which is why this check exists.

**EDGE-16 — the semantic validator catches a structurally-legal duplicate roll-up vendor**
Tags: q0011-cli-reader-validator
- Given a manifest whose `rollup` array lists the same `vendor` string twice with different totals (structurally legal for the same reason as EDGE-15)
- When `harness validate` runs the semantic pass
- Then it exits `1`, naming the duplicated vendor.

**EDGE-17 — the semantic validator catches timestamp/duration inconsistency**
Tags: q0011-cli-reader-validator
- Given a manifest with `status: "completed"` but `ended_at: null` (or with `ended_at` set but `duration_ms` inconsistent with `ended_at - started_at`) — each structurally legal on its own, since the schema only requires the keys to be present with the right types
- When `harness validate` runs the semantic pass
- Then it exits `1`, naming the inconsistency — this is one of the runs-cli contract's four named semantic-check categories ("running/terminal timestamp and duration consistency").

**EDGE-18 — the semantic validator catches a `kind`/field nullability mismatch**
Tags: q0011-cli-reader-validator
- Given a manifest step entry with `kind: "script"` but a non-null `adapter` (or `kind: "adapter"` with a non-null value in a field the writer contract requires null for that kind) — structurally legal, since the schema types each field independently of `kind`
- When `harness validate` runs the semantic pass
- Then it exits `1`, naming the field and the `kind` it contradicts — the runs-cli contract's "adapter versus script/integrate nullability" category.

**EDGE-19 — malformed mock configuration fails explicitly, never silently**
Tags: q0011-engine-writer
- Given `MOCK_RUN_HISTORY_PROFILES` set to a value that is not valid JSON, or valid JSON that isn't an object keyed by role
- When any step attempts to consult it
- Then the run fails explicitly naming the malformed switch — never silently ignored or defaulted, per the mock contract and the engineering rule that errors are explicit.

**EDGE-20 — a fail-before-usage occurrence makes the roll-up undercount relative to detail, and only detail says so**
Tags: q0011-engine-writer, q0011-cli-reader-validator
- Given a run with four adapter occurrences, one of which fails before reporting any usage
- When `harness runs <run-id>` (list-style roll-up) is compared against `harness runs <run-id>` detail (or `--json` detail)
- Then the roll-up's vendor `step_count` sums to three, not four, while the detail view lists all four occurrences including the fail-before-usage one with `usage: null` — this is E-1's accepted trade-off, explicitly flagged by the architecture reviewer as something to keep in view rather than treat as a bug: "the list view can therefore show fewer occurrences than the run ran, and only the detail view tells you so."

**EDGE-21 — error categories map exactly to the taxonomy the writer contract names**
Tags: q0011-engine-writer
- Given five distinct forced failure modes in sequence: an adapter auth failure, a retryable adapter failure exhausting retries, invalid structured output, a script command failure, and an integrate command failure
- When each occurrence's manifest record is read
- Then `error.category` is exactly `"auth"`, `"transient"`, `"structured_output"`, `"script"` and `"integrate"` respectively — matching the writer contract's explicit mapping — and a signal-interrupted occurrence's category is `"interrupted"`; any failure mode the mapping doesn't name falls back to `"unknown"`, never an invented category outside the schema's enum.

---

### Closing note

Every scenario above is written against the frozen contracts on `harness/Q-0011/contracts` and
`solution/errata.md`, not against the superseded phrasing left in `requirements/merged.md`'s AC-2,
AC-10, AC-11 and AC-14, or in `ticket.md`'s still-uncorrected "events schema" sentence (Testability
Flag 1) — per `solution.md` and the approving review, the errata and the approved solution win
where they disagree with requirement text for the clauses they name. The existing mock-adapter
end-to-end regression suite (Q-0006/Q-0033's fixtures included) must remain green throughout; no
scenario here proposes changing `ticket.md`'s or `runs.log`'s existing format, and none requires a
real vendor login — every fixture above is achievable through the mock adapter's existing and
newly documented `MOCK_*` switches.
</document>
