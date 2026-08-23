## Q-0011 — Test scenarios: run history on disk with per-vendor roll-up

Source: `requirements/merged.md` (14 acceptance criteria, 12 live after the 2026-08-23 scope cut),
`solution/solution.md` (chosen approach, rejected alternatives, acceptance-criteria ownership),
`solution/errata.md` (E-1, E-2, E-3), `solution/tasks.yaml`, and the four frozen contracts on
`harness/Q-0011/contracts`: `contracts/Q-0011/run-manifest.schema.json`,
`contracts/Q-0011/run-history-writer.contract.md`,
`contracts/Q-0011/mock-adapter-run-history.contract.md`, `contracts/Q-0011/runs-cli.contract.md`.
One scenario per live acceptance criterion, in order, followed by edge cases the contracts,
errata and solution review call out that are not already a numbered AC. Each scenario is tagged
with the task id(s) whose contract it proves.

Tasks referenced: `q0011-engine-writer` (backend/codex, `spike/src/**`), `q0011-cli-reader-validator`
(tooling/claude, `spike/bin/harness.js`). All tests live in `spike/test/**`, which belongs to
qa-red and neither implementation task.

**Pre-condition flag, not a scenario.** `backlog/Q-0011-run-history-on-disk/ticket.md`'s body still
reads "an events schema that qa-red can fail a real artifact against." `solution/solution.md`
states this is stale — the approved scope cut removed the event stream (AC-6, AC-7) — and requires
the maintainer to replace it with "a run manifest schema" before this flow runs, because the engine
includes the ticket body verbatim in downstream prompts and no implementation task is allowed to
edit `ticket.md`. This document is written against the approved `solution.md` and contracts, which
are authoritative over the ticket body per the solution's own statement; the sentence is flagged
here because it is a criterion (in the loose sense of "what the ticket says") that cannot be tested
as written and isn't fixed by anything in this ticket's task list.

**Scope-cut note.** AC-6 and AC-7 (`events.jsonl`, the typed envelope, `seq` contiguity, the
`raw`-deletion test, JSONL support in `harness validate`) are removed in full by the 2026-08-23
scope cut recorded in `requirements/merged.md`. No scenario is written for them; they are listed
below only to preserve AC numbering, which the contracts and prior review rounds already rely on.

**Errata note.** Three requirement clauses are superseded by `solution/errata.md` and the scenarios
below are written to the erratum, not the superseded clause:
- **E-1** — an adapter occurrence that fails before reporting usage stays visible in manifest detail
  with `usage: null` but creates no vendor row and is not counted as unpriced (supersedes AC-11's
  "per vendor that ran an adapter step").
- **E-2** — `harness validate` gains contract-specific semantic checks keyed off the
  `x-quorum-contract: run-manifest-v1` schema annotation; JSONL support is not added (supersedes
  AC-14's "needs no new capability").
- **E-3** — an interrupt received while the run is at a gate marks the *run* `interrupted` and
  creates no occurrence, because gates allocate none; occurrence-level `interrupted` applies only
  to in-flight adapter/script/integrate work (supersedes AC-10's "a step interrupted at a gate
  appears as `interrupted`").

---

### Acceptance-criterion scenarios

**AC-1 — a run directory exists before anything is spawned**
Tags: q0011-engine-writer
- Given a ticket ready to run a flow with the mock adapter and no existing `.quorum/runs/<ticket-id>-<n>/`
- When a non-dry `harness run` executes
- Then `.quorum/runs/<ticket-id>-<n>/`, its `steps/` subdirectory, and an initial `manifest.json` with `status: "running"` exist before the first adapter spawn, script execution or integrate command — proved by a spy on the adapter/exec entry point that asserts the directory predates the first call.
- Given `.quorum/runs/<ticket-id>-<n>/` already exists from a prior run
- When the same run id is started again
- Then the run stops before spawning any adapter, script, integrate step or gate, the error names the existing directory, and the directory's contents are byte-for-byte unchanged afterward (never reused or overwritten).
- Given the run directory cannot be created (e.g. `.quorum/runs/` is a file, not writable)
- When a non-dry run starts
- Then the run stops the same way, before anything is spawned, and no adapter is invoked (nothing has been billed).
- Given the same run invoked with `--dry`
- When it executes
- Then no `.quorum/runs/` entry of any kind is created for that run — no directory, no manifest.

**AC-2 — the run writes only there, and never records the environment**
Tags: q0011-engine-writer
- Given a normal repository (not a linked worktree)
- When a non-dry run completes
- Then `.quorum/` is present in `.git/info/exclude`, no tracked file was modified to achieve that, and `git status --porcelain` after the run shows changes only under the ticket's own `backlog/` artifacts.
- Given the process environment carries a sentinel value (e.g. a fake secret) under a variable name not used as a mock switch
- When the run completes and every file under `.quorum/runs/<id>/` is grepped
- Then neither the sentinel value nor any environment-variable name occurs anywhere in the run directory, while a spawn record's `argv` is present; a mock switch's *value* that is legitimately domain data (e.g. `MOCK_VENDOR=acme` becoming `usage.vendor: "acme"`) is not itself forbidden.
- Given any path persisted anywhere under `.quorum/runs/<id>/` (ticket path, flow file, worktree path, occurrence dir)
- When the manifest and step files are inspected
- Then every such path is relative to the project root; none is absolute.

**AC-3 — the manifest is written at start, replaced atomically, and distinguishes every terminal outcome**
Tags: q0011-engine-writer
- Given a run has just started
- When `manifest.json` is read immediately
- Then it contains `schema_version`, `run_id`, `ticket_id`, `ticket_path`, `flow`, `flow_file`, `stage.before`, `started_at` (UTC, `Z`-suffixed RFC 3339), and `status: "running"`, with `ended_at: null` and `duration_ms: null`.
- Given a run with three sequential steps, the first two already terminal
- When `manifest.json` is read mid-run, before the third step's completion
- Then it fully describes the first two steps' terminal outcomes and shows the run still `running` — a mid-run read is never partial JSON and never silently stale beyond "third step not yet finished."
- Given two mock steps scheduled in parallel, both completing within the same event-loop tick spread
- When both terminate
- Then both steps' terminal records are present in the final manifest — neither is lost to a lost update, proved by asserting `steps.length` and both `step_id`s post-run.
- Given a run in progress
- When the process receives `SIGTERM` (or `Ctrl-C`'s `SIGINT`)
- Then the run performs one final synchronous atomic replacement marking the run `interrupted` (never left `running`, never marked `completed`) before the process exits, and any occurrence that was in flight at the signal is itself marked `interrupted`.
- Given a manifest replacement is captured mid-write (e.g. by pausing the temp-file rename in a test harness) and a reader opens the file at that instant
- When the reader parses it
- Then it sees either the complete previous document or the complete new document — never a truncated or half-written one — proved by asserting successful `JSON.parse` on a manifest read concurrently with a forced replacement.

**AC-4 — every step attempt that runs something gets its own directory**
Tags: q0011-engine-writer
- Given a flow step that spawns an adapter
- When it runs
- Then its occurrence directory is `steps/001-<sanitised-step-id>` (or the next unused zero-padded, at-least-three-digit sequence number in start order).
- Given a step id containing `/` or `:` (e.g. a fan-out task id `dev:Q0011-cli`)
- When its occurrence directory is allocated
- Then the directory name has every `/` and `:` replaced with `-` (e.g. `steps/004-dev-Q0011-cli`), and no other character is altered.
- Given a gate in the run, exercised once answered by a human and once auto-advanced
- When the run proceeds past each
- Then neither allocates an occurrence directory, and the sequence number of the next real step is exactly what it would have been with zero gates in between (gate handling never shifts numbering). *(Note: this is tested within a non-dry run, since AC-1 already establishes that a `--dry` run has no run-history directory to allocate anything in; the requirement's "skipped by `--dry`" phrase is read as "gates never allocate regardless of how they resolve," which this scenario proves for the two resolutions the engine supports today.)*
- Given a flow that traverses a backward edge (`on_fail: goto`) and re-runs the same step id
- When both the first and the regressed attempt run
- Then two distinct occurrence directories exist for that step id at two different sequence numbers, and neither's `prompt.txt`/`output.txt` is overwritten by the other.
- Given a fan-out step producing two parallel task occurrences in one wave
- When the wave runs
- Then each task gets its own occurrence directory with a distinct sequence number, and the fan-out parent itself allocates none.

**AC-5 — each step directory records what was sent and what came back**
Tags: q0011-engine-writer
- Given an adapter-backed step with a known assembled prompt
- When it runs to completion
- Then `steps/<seq>-<id>/prompt.txt` contains the exact assembled prompt byte-for-byte and `steps/<seq>-<id>/output.txt` contains the agent's final message as text.
- Given an adapter-backed step whose structured output fails validation
- When it terminates
- Then `output.txt` contains the raw text that failed validation (not a placeholder, not empty).
- Given a `script` step and an `integrate` step
- When each runs
- Then neither has a `prompt.txt`, and both have an `output.txt` (populated with captured output, or empty if the command produced none).
- Given a completed run
- When `runs.log` and `ticket.md` are inspected
- Then neither contains any prompt text from any step.

**AC-6 — removed by the 2026-08-23 scope cut**
No scenario. Superseded: the append-only `events.jsonl` stream, its typed envelope and `seq`
contiguity move to a future trace-stream ticket.

**AC-7 — removed by the 2026-08-23 scope cut**
No scenario. Superseded: vendor-neutral typed events move with AC-6. The vendor-neutrality this
ticket still needs is carried by AC-9 below.

**AC-8 — the manifest step record carries the fields `runs.log` drops**
Tags: q0011-engine-writer
- Given a completed adapter step that used a worktree and branch, ran with retries, and declared a verdict
- When its manifest record is read
- Then it has `step_id`, `occurrence_dir`, `kind: "adapter"`, `role`, `adapter`, `model` (or `null`), `branch`, `worktree`, `started_at`, `duration_ms`, `attempts` equal to the actual invocation count, `status`, `verdict`, `error` (`null` on success), and `usage`.
- Given a first-try success
- When `attempts` is read
- Then it is `1`.
- Given a step that failed twice on retryable errors before succeeding on the third attempt
- When `attempts` is read
- Then it is `3` (the actual invocation count, not `1` and not the retry-limit constant).
- Given a `script` or `integrate` step
- When its manifest record is read
- Then `attempts` is `0` and `kind` is `"script"` or `"integrate"` respectively, `role`/`adapter`/`model`/`branch`/`worktree` are `null` where not applicable, and there is no `prompt.txt` reference implied.

**AC-9 — usage preserves what the vendor reported and estimates nothing**
Tags: q0011-engine-writer
- Given an adapter call that reports `input_tokens`, `output_tokens`, `cost_usd` but no cache fields
- When its `usage` object is persisted
- Then `cached_input_tokens` and `cache_write_input_tokens` are `null` (never `0`, never omitted as a key — the schema requires all five measures present).
- Given a Claude-shaped mock response with cache-creation and cache-read input tokens set (via `MOCK_CACHED_INPUT_TOKENS`)
- When `usage.input_tokens` is read
- Then it already includes the cache-creation and cache-read counts the adapter reported (matching the fix for the defect where a $0.39 probe under-reported as 65 tokens) — the persisted value equals the adapter's own reported total, not a value the writer recomputed.
- Given a Codex-shaped mock response with reasoning-output tokens set
- When `usage.output_tokens` is read
- Then it includes the reported reasoning-output tokens.
- Given any usage object anywhere in the manifest
- When cross-checked against the mock's configured values
- Then no value is derived from a rate table, and nothing not explicitly reported by the mock is a nonzero number.

**AC-10 — a failed, exhausted or interrupted step is recorded with its usage**
Tags: q0011-engine-writer
- Given an adapter step configured with `MOCK_FAIL_WRITE` so the mock throws after reporting usage
- When the step terminates
- Then its manifest record has `status: "failed"`, a populated `error` (`category`, `message`), and a non-null `usage` object matching exactly what the mock reported before throwing — the accumulated usage attached to the thrown error, not a zeroed or absent one.
- Given the above failure is read back by a separate process invocation (`harness runs <run-id>` run after the writing process has exited)
- When the manifest is parsed
- Then the failed step's error and usage are both readable and match what was written.
- Given an adapter, script or integrate occurrence in flight when the process receives `SIGTERM`
- When the run finalises
- Then that occurrence's `status` is `"interrupted"`.
- Given the run is sitting at a gate (no occurrence in flight) when the process receives `SIGTERM`
- When the run finalises
- Then the *run's* `status` is `"interrupted"` and no new occurrence directory is created for the gate (per errata E-3 — this supersedes the literal AC-10 text "a step interrupted at a gate appears as `interrupted`").
- Given a run with one failed step among several
- When the manifest is inspected
- Then every step that ran has a terminal status recorded — no step is silently absent because it failed.

**AC-11 — the roll-up is per vendor, invents no money and blends nothing**
Tags: q0011-engine-writer
- Given a run with two adapter steps both declaring `vendor: "claude"` via their mock profile, one reporting `cost_usd: 2.10` and the other `cost_usd: 1.50`
- When the manifest roll-up is read
- Then the `claude` entry has `step_count: 2`, `cost_usd: 3.60`, `unpriced_steps: 0`, and its token fields sum only reported values.
- Given a third step in the same run declaring `vendor: "codex"` via `MOCK_TOKEN_ONLY=1` (no cost reported, tokens reported)
- When the roll-up is read
- Then the `codex` entry has `cost_usd: null` (never `0`, never rounded), `unpriced_steps: 1`, and its own token totals — with no field anywhere summing `claude` and `codex` money together.
- Given a fourth step that fails before reporting any usage (`usage: null` in its manifest record)
- When the roll-up is read
- Then that occurrence's vendor gains no row from it and it is not counted in `unpriced_steps` for any vendor (per errata E-1 — it is visible in step detail with `usage: null`, but invisible to the roll-up).
- Given a fifth step that succeeds and reports `cost_usd: 0` genuinely (the vendor billed nothing)
- When the roll-up is read
- Then that occurrence *is* counted in `unpriced_steps` and its `0` contributes to the vendor's summed `cost_usd` — distinguishing "vendor reported zero" from "vendor reported nothing" (`null`).
- Given script, integrate, gate and fan-out-parent activity in the same run
- When the roll-up is read
- Then none of them produces a vendor row.
- Given the full set of persisted occurrence `usage` objects in a completed run
- When they are independently regrouped by `usage.vendor` and summed by a test, following exactly the algorithm in `run-history-writer.contract.md`
- Then the result equals `manifest.json`'s `rollup` field exactly, counting each retried, parallel, failed, and interrupted occurrence with non-null usage once.
- Given a completed run
- When `ticket.md`'s `history` field is diffed before and after
- Then it is byte-identical — nothing this ticket writes changes existing cost accounting.

**AC-12 — `harness runs [<ticket-id>]` lists runs**
Tags: q0011-cli-reader-validator
- Given `.quorum/runs/` contains three runs across two tickets with distinct `started_at` values
- When `harness runs` runs with no argument
- Then all three are listed, most recent `started_at` first, each line showing run id, ticket, flow, `stage.before -> stage.after`, status, duration, and a separately labelled per-vendor summary (money and tokens for a priced vendor, `cost=n/a` and tokens for an unpriced one), with the unpriced-step count stated and no combined total.
- Given a ticket id argument matching one of the two tickets
- When `harness runs <ticket-id>` runs
- Then only that ticket's runs are listed, in the same order.
- Given a syntactically valid ticket id (`^[A-Z]+-[0-9]{4}$`) that has never run
- When `harness runs <ticket-id>` runs
- Then it prints an empty list and exits `0` — identical behaviour whether the ticket exists in `backlog/` with zero runs or doesn't exist there at all, because the reader never consults `backlog/`.
- Given `.quorum/runs/` does not exist at all
- When `harness runs` runs
- Then it prints an explicit empty-state message and exits `0`.
- Given `.quorum/runs/` contains two valid run directories and one malformed one (e.g. unparsable `manifest.json`)
- When `harness runs` runs
- Then both valid runs are listed with correct content, the malformed one is named in a warning, and the command's exit code is non-zero overall.

**AC-13 — `harness runs <run-id>` shows one run**
Tags: q0011-cli-reader-validator
- Given a completed run with four step occurrences
- When `harness runs <run-id>` runs
- Then it lists all four attempts ordered by their numeric occurrence prefix, each showing adapter, model, status, start time, duration, verdict, usage, error (where applicable), and the project-relative step-directory path.
- Given the detail view is rendered
- When any file access during rendering is traced
- Then only files inside the selected run's own directory are read (nothing from `backlog/`, no other run directory).
- Given a run id that does not exist under `.quorum/runs/`
- When `harness runs <bad-id>` runs
- Then it prints a clear error naming the id and exits non-zero.
- Given a manifest whose `status` is still `"running"` (or whose `ended_at` is `null`) because the writing process was killed
- When `harness runs <run-id>` runs
- Then the run is labelled incomplete, the manifest path is named in the output, and the command does not invent a terminal status, does not silently omit the warning, and does not attempt to repair the file.
- Given the same incomplete run
- When `harness runs <run-id> --json` runs
- Then stdout is exactly one JSON document (parses with a single `JSON.parse`) containing the detail plus an `incomplete: true` flag and warning, with no ANSI escape codes anywhere in stdout.
- Given an unknown run id with `--json`
- When it runs
- Then it still exits non-zero, and stdout (if any) remains valid single-document JSON or the error goes to a channel that does not corrupt a piped JSON consumer.

**AC-14 — the contract is executable against real run artifacts**
Tags: q0011-cli-reader-validator
- Given `contracts/Q-0011/run-manifest.schema.json` (a JSON Schema 2020-12 document, `additionalProperties: false` throughout, `x-quorum-contract: run-manifest-v1`, `schema_version` a fixed escape-hatch field)
- When `harness validate contracts/Q-0011/run-manifest.schema.json <manifest.json>` runs against the `manifest.json` produced by a real end-to-end mock-adapter run
- Then it exits `0`.
- Given that same manifest with one required field deleted (e.g. `stage`)
- When validated
- Then it exits `1` naming the missing field.
- Given that same manifest with an unpriced vendor's roll-up `cost_usd` mutated from `null` to `0`
- When validated
- Then it exits `1`, naming the vendor and the `cost_usd` field — caught by the semantic pass (E-2), since JSON Schema alone cannot distinguish a genuinely reported `0` from a mutated `null` (structural validation alone would pass this document, since `0` is a legal `nullable_number`).
- Given that same manifest with a usage token count set to `-1`
- When validated
- Then it exits `1` naming the negative-valued field.
- Given that same manifest with an unexpected extra top-level property
- When validated
- Then it exits `1`, rejected by `additionalProperties: false`.

---

### Edge cases

Drawn from the four frozen contracts, the three errata, `solution.md`'s "Verification" checklist,
and its "Review findings resolved" list, where not already covered by a numbered-AC scenario above.

**EDGE-1 — the fan-out is genuinely two roles on two vendors over disjoint files**
Tags: q0011-engine-writer, q0011-cli-reader-validator
- Given `tasks.yaml`'s two tasks, `q0011-engine-writer` (role `backend`, owns `spike/src/**` plus four doc files) and `q0011-cli-reader-validator` (role `tooling`, owns only `spike/bin/harness.js`)
- When the development fan-out runs both in the same wave and `integrate` merges their branches
- Then the merge produces no file-level conflict, and the merged tree's changed-file set is the union of exactly those two owned path sets — proving M1's "two roles on two vendors, disjoint files" fan-out demonstration.

**EDGE-2 — an integrate step with no configured commands still gets one occurrence**
Tags: q0011-engine-writer
- Given an `integrate` step with neither `commands.install` nor a test command configured
- When it runs and the merge succeeds
- Then it still allocates exactly one occurrence directory, `kind: "integrate"`, `status: "completed"`, and an `output.txt` that exists and is empty (not absent).

**EDGE-3 — install and test are phases of one integrate occurrence, not two**
Tags: q0011-engine-writer
- Given an `integrate` step with both `commands.install` and a test command configured, and the install phase fails
- When it runs
- Then exactly one occurrence is recorded for that integrate step (not two), with `status: "failed"` and `error.category: "integrate"` — the same is true when install succeeds and the test command fails instead.

**EDGE-4 — vendor is declared per call, not inferred from adapter routing**
Tags: q0011-engine-writer
- Given `MOCK_RUN_HISTORY_PROFILES` configured so the `backend` role's steps declare `vendor: "codex"` and the `tooling` role's steps declare `vendor: "claude"`, all routed through the same mock adapter object whose static `adapter.vendor` is `"mock"`
- When both steps run to completion
- Then their `usage.vendor` values are `"codex"` and `"claude"` respectively — the static `adapter.vendor` fallback is never used when a per-call vendor is declared, and one mock-only run produces two distinct vendor rows in the roll-up without invoking a real CLI.

**EDGE-5 — sequence numbers never truncate past three digits**
Tags: q0011-engine-writer
- Given a flow (or a test harness driving the same allocator) that produces more than 999 occurrences in one run
- When the 1000th occurrence directory is allocated
- Then its name is `steps/1000-<id>` (four digits, not a truncated or wrapped three-digit value), matching the schema's `[0-9]{3,}` minimum-three-digit pattern.

**EDGE-6 — a write failure after run-directory creation warns and continues, never discards billed work**
Tags: q0011-engine-writer
- Given a run in progress where a single manifest replacement or `output.txt` write is made to fail (e.g. by pointing the run directory at a path that becomes read-only mid-run in a test harness)
- When that failure occurs
- Then the engine emits an explicit warning naming the affected path and continues the run rather than throwing away the already-billed step's result; the in-memory snapshot remains authoritative so a later successful replacement still reflects that step correctly.

**EDGE-7 — `ensureExcluded` covers linked worktrees and warns rather than fails silently on either shape**
Tags: q0011-engine-writer
- Given a run executing from a linked worktree (where `.git` is a file pointing at the real git dir, not a directory)
- When the run starts
- Then `.quorum/` is added to the *real* git directory's `info/exclude` (resolved through the `.git` file), and `git status` in that worktree is unchanged after the run.
- Given the applicable `info/exclude` file cannot be resolved or written (e.g. permissions)
- When the run starts
- Then an explicit warning names the unresolved or unwritable path, the run proceeds (this failure is non-fatal once the run directory itself is initialised, unlike AC-1's fatal pre-spawn checks), and it never fails silently.

**EDGE-8 — backward-edge repeat and interleaved-parallel directories never collide**
Tags: q0011-engine-writer
- Given a step id revisited twice via a backward edge, each attempt separated by other steps running in between
- When both attempts complete
- Then their two occurrence directories both survive with distinct sequence numbers reflecting true start order, and reading either's `prompt.txt`/`output.txt` returns that attempt's own content, not the other's.

**EDGE-9 — a hard kill leaves an honestly incomplete manifest, never a repaired one**
Tags: q0011-engine-writer, q0011-cli-reader-validator
- Given a run process terminated with `SIGKILL` between a step's completion and the next manifest replacement (simulated by killing the write before it lands)
- When `harness runs <run-id>` is invoked afterward by a new process
- Then the manifest is read as-is (`status: "running"`, no `ended_at`), and the reader reports it incomplete without inferring or writing any terminal status into the file.

**EDGE-10 — ticket-filter selection grammar rejects the in-between cases explicitly**
Tags: q0011-cli-reader-validator
- Given the arguments `q-0011` (wrong case), `Q-11` (wrong digit count), and `Q-0011` (well-formed) passed to `harness runs <arg>` where none is an existing run-directory name
- When each runs
- Then `q-0011` and `Q-11` each produce an unknown-run error and a non-zero exit (they match neither an existing run directory nor the ticket-id pattern), while `Q-0011` is accepted as a ticket filter (empty list, exit `0`, if it has no runs) — the malformed values are never silently treated as an empty-list ticket filter.

**EDGE-11 — list ordering ties break lexically on `run_id`, not numerically**
Tags: q0011-cli-reader-validator
- Given two runs `Q-0011-2` and `Q-0011-10` sharing the same `started_at` timestamp
- When `harness runs` lists them
- Then they are ordered by `run_id` ascending as plain string comparison — `Q-0011-10` sorts before `Q-0011-2` (`"1" < "2"` lexically) — and the implementation is not "fixed" to sort by the numeric suffix instead, which the contract explicitly rules out.

**EDGE-12 — `--json` output is exactly one document with no ANSI**
Tags: q0011-cli-reader-validator
- Given `harness runs --json` (list mode) and `harness runs <run-id> --json` (detail mode), including at least one invocation against a run with warnings (a malformed sibling, or an incomplete manifest)
- When stdout is captured
- Then in every case stdout parses as a single JSON document via one `JSON.parse` call, contains no `\x1b[`-style ANSI escape sequences, and any warnings appear as fields within that document rather than as separate lines before or after it.

**EDGE-13 — an absent or unrecognised contract annotation produces an explicit skip notice, not a silent pass**
Tags: q0011-cli-reader-validator
- Given a structurally valid JSON document validated against a schema with no `x-quorum-contract` annotation, and separately against one with an unrecognised annotation value
- When `harness validate` runs on each
- Then both exit `0` on structural validity alone, and both print an explicit notice that run-manifest semantic checks were skipped — the exit code alone must never be read as proof the roll-up/lifecycle semantics were checked.

**EDGE-14 — `exhausted` is schema-reserved but this ticket never emits it**
Tags: q0011-engine-writer
- Given a run whose flow hits its bounded-loop iteration limit mid-run (the engine's existing `recordEvent(..., 'exhausted', ...)` path updates ticket history and the run proceeds to a gate)
- When the run's manifest is inspected after it eventually reaches a terminal outcome
- Then no occurrence or run-level `status` field anywhere in that manifest is the literal string `"exhausted"` — the run's actual terminal status is one of `completed`, `failed`, `aborted`, `regressed` or `interrupted`, and the test suite for Q-0011 requires no `exhausted` manifest fixture (an `exhausted` value stays legal in the schema's enum for forward compatibility only).

---

### Closing note

Every scenario above is written against the frozen contracts on `harness/Q-0011/contracts` and
`solution/errata.md`, not against the superseded phrasing left in `requirements/merged.md`'s
AC-10, AC-11 and AC-14 or in `ticket.md`'s stale "events schema" sentence — per `solution.md`,
the errata and the approved solution win where they disagree with the requirement text for the
clauses they name. The existing mock-adapter end-to-end regression suite (Q-0006/Q-0033's fixtures
included) must remain green throughout; no scenario here proposes changing `ticket.md`'s or
`runs.log`'s existing format, and none requires a real vendor login — every fixture above is
achievable through the mock adapter's existing and newly documented `MOCK_*` switches.
