# Q-0011 — Run history on disk with per-vendor roll-up

*Merged requirement (head-of-product). Ticket Q-0011, stage draft → requirements. M1.*

## Problem

A run's history exists only in the terminal that printed it. The durable record is one line per step in the ticket's `runs.log` and one cost figure per run in `ticket.md`'s `history`. Everything else is discarded when the process exits: the assembled prompt, the agent's final output, the token counts, the worktree and branch the step ran in, the adapter retries, and — on a failure — everything past the first 200 characters of the error message (`spike/src/engine.js:185`).

Three consequences are already on the record. The $4.54 lost in the Q-0006 crash could not be recovered, because a step that dies takes its accounting with it. Nobody can answer "what did this ticket cost, per vendor": the roll-up sums only vendors that report money, so `cost=$8.03` on Q-0006 is the *Claude* cost of that ticket presented as its total. And a failed run cannot be examined at all — the audit trail is a regex over a text log (`nextRunId`, `spike/src/engine.js:388`).

There is a fourth consequence that is not yet visible and becomes permanent the day this ships. The engine's only trace today is `onEvent({ type: 'stdout', line })` — the vendor's own JSONL, passed through untouched (`spike/src/engine.js:178`, `adapters/*.js`). That is acceptable while it is fed to a terminal renderer and thrown away. Writing it to disk makes vendor-native format the durable contract, and every reader after it — this ticket's CLI, M3's mission control, the M2 port — inherits a per-vendor parse. The engineering rule "one trace/event format; nothing downstream knows which vendor produced an event" is decided here, not later.

This ticket writes a run's history under `.quorum/runs/<run-id>/` and reads it back through the CLI. It splits along a boundary this repository has not exercised — the engine writes, the CLI reads — on genuinely disjoint files, which is why it is M1's fan-out demonstration rather than Q-0006.

**Surfaces:** engine and adapters (`spike/src/**`), CLI and tests (`spike/bin/harness.js`, `spike/test/**`), the new files under `.quorum/`, and two contracts under `contracts/Q-0011/`. No Studio work — the UI does not exist until M3.

## User stories

**Solo maintainer.** As a maintainer running several repositories, I want each run to leave a complete record on disk, so that when a run crashes at step four I can see what the first three cost me, what the fourth was sent, and what the vendor said before it died — without having had scrollback open at the time.

**Cold-clone adopter.** As an adopter on my first ticket, I want one command that tells me what a run cost on each of my subscriptions, so that I can decide whether to run the next stage without being shown a single dollar figure that silently omits one of my two vendors.

**Adapter contributor.** As a contributor writing a Gemini adapter, I want one documented, vendor-neutral event and usage shape, so that my adapter supplies a usable trace without the engine, the CLI or the future Studio learning my vendor's native format.

## Decisions taken at this gate

Three questions were raised as blockers by one candidate and answered by the other. They are settled here, because each is a product call and none needs work to answer.

**Run id is `<ticket-id>-<n>`.** Run numbers are allocated per ticket (`nextRunId`), so `1` is not unique in a project-wide directory. A composite is chosen over a project-wide counter or a sortable random id because it preserves the join to the two records that must not change in this ticket: `run=3` in `Q-0011`'s `runs.log` and `history` is directory `Q-0011-3`. A new global counter would require rewriting `runs.log`'s format, which collides with Q-0006 and Q-0033 in flight. Note the corollary: the id string in `runs.log` and the directory name are *not* identical, and the requirement is the stated join rule, not string identity.

**Prompts are stored exactly, unredacted.** The prompt is assembled from material already on the user's disk in the same repository — ticket, harness context, materialised diff — so a git-excluded local copy adds no exposure that the repository does not already have. Redaction would break exact replay, which is the feature's purpose, and a redaction contract nobody can verify is worse than none. The one genuinely new exposure is the *process environment*, and that is prohibited outright in AC-2: argv is recorded, environment values never are.

**A step occurrence is its directory: `<seq>-<step-id>`.** `seq` is a zero-padded counter incrementing once per step *attempt* in start order. It sorts chronologically in `ls`, it is readable in a directory a human is expected to open, and it is the stable id a later deep link can use.

Two further picks, where the candidates differed:

**The roll-up lives inside `manifest.json`, not in a separate `rollup.json`.** One atomic write instead of two, one schema instead of two, and — decisively — it removes an inconsistency state that a separate file would create and the reader would then have to detect and report.

**The command is `harness runs`.** The directory is `.quorum/runs/`, `runs.log` already uses the word, and `history` is taken: it is the name of a `ticket.md` frontmatter field meaning something else. Introducing it as a command name would put a synonym in the vocabulary, against the docs rule.

## Acceptance criteria

**AC-1 — A run directory exists before anything is spawned.** On starting a non-dry run, the engine creates `.quorum/runs/<ticket-id>-<n>/` under the project root the CLI resolved (the same root under which worktrees are created). If the directory already exists, the run stops before spawning any adapter, script, integrate step or gate, naming the existing directory; it is never reused or overwritten. If it cannot be created, the run stops the same way — nothing has been billed yet, so this failure is free. A `--dry` run creates no run-history directory or file.

**AC-2 — The run writes only there, and never records the environment.** `.quorum/` is excluded from the user's repository without modifying a tracked file (`.git/info/exclude`, the mechanism `spike/src/git.js:31` already uses for worktrees). A completed run leaves `git status` unchanged apart from the ticket folder's own artifacts. No file written under `.quorum/runs/` contains the value of any environment variable — a spawn record carries the adapter's argv only — and no persisted path is absolute; paths are relative to the project root.

**AC-3 — The manifest is written at start, replaced atomically, and distinguishes every terminal outcome.** `manifest.json` exists from run start with a `schema_version`, the run id, ticket id, ticket-folder path, flow name and flow-file path, the stage consumed, start time, and `status: "running"`. It is replaced when each step reaches a terminal state and when the run ends, so a manifest read mid-run describes everything finished so far. `status` covers `running`, `completed`, `failed`, `aborted`, `regressed`, `exhausted` and `interrupted`; a run killed with Ctrl-C or `SIGTERM` ends `interrupted`, never `running` and never `completed`. Every replacement writes a complete temporary file in the same directory and renames it over the previous one, so a concurrent reader sees the old valid document or the new one, never partial JSON. Updates from parallel steps are serialised by the engine; a regression test with two parallel mock steps proves no step's record is lost. Timestamps are UTC RFC 3339.

**AC-4 — Every step attempt gets its own directory.** Step records live at `steps/<seq>-<step-id>/`, `seq` zero-padded and incrementing once per attempt in start order, with `/` and `:` in the step id replaced by `-`. A flow that traverses a backward edge and runs a step a second time produces two directories and neither overwrites the other. A fan-out produces one directory per task per wave, and parallel occurrences have distinct directories. A test uses a fan-out step id containing `:` (e.g. `dev:Q0011-cli`) to prove the sanitising.

**AC-5 — Each step directory records what was sent and what came back.** It contains `prompt.txt` (the exact assembled prompt, byte for byte), `output.txt` (the agent's final message as text, or the raw text that failed validation, whichever the step produced) and `events.jsonl`. A step that never reached an adapter — script, integrate, gate — has `events.jsonl` and no `prompt.txt`. Prompts are never written to `runs.log` or `ticket.md`.

**AC-6 — `events.jsonl` is append-only and one line is one event.** Each non-blank line is one complete UTF-8 JSON object carrying `schema_version`, `ts`, `seq`, `type` and `data`. `seq` starts at 1 and increases by exactly 1 within an occurrence. Lines are appended as the event occurs, so `tail -f` on a live run shows progress, and a truncated final line — process killed mid-write — leaves every earlier line independently parseable.

**AC-7 — The trace is vendor-neutral above the adapter layer.** Adapters map their native output into typed events before calling `onEvent`; the types cover at least `step_started`, `text`, `tool`, `verdict`, `usage`, `retry`, `step_completed` and `step_failed`. A reader can render the full step timeline and compute the whole roll-up from typed events alone. An adapter may additionally record output it cannot classify as a `raw` event so nothing is lost, but no downstream consumer may need to parse one: the test asserts that the timeline and the roll-up are unchanged when every `raw` event is deleted. Vendor and model appear as event *data*, never as a differently shaped event, and neither the engine nor the CLI branches on adapter name.

**AC-8 — The manifest step record carries the fields `runs.log` drops.** For each attempt: step id, occurrence directory, role, adapter, model or `null`, branch and worktree path where one was used, start time, duration in ms, adapter retry attempts, terminal status, verdict where the step declared one, error message and category where it failed, and its usage object.

**AC-9 — Usage preserves what the vendor reported and estimates nothing.** A usage object has nullable `input_tokens`, `output_tokens`, `cached_input_tokens`, `cache_write_input_tokens` and `cost_usd`, plus a required `vendor`. Values are non-negative numbers or `null`; anything a vendor did not report is `null`, never `0`. Claude's input count includes its reported cache-creation and cache-read input (the defect that made a $0.39 probe report 65 tokens), and Codex's output includes reported reasoning-output tokens — both already handled in the adapters and both preserved through the persisted contract, which today drops `cached_input_tokens` between `codex.js` and `adapters/index.js`. No rate table is read and no missing value is inferred.

**AC-10 — A failed, exhausted or interrupted step is recorded with its usage.** A step whose adapter throws after the vendor billed it appears with `status: "failed"`, its error, and the usage the adapter reported before dying — the accumulated usage already attached to the thrown error in `adapters/index.js`. The Q-0006 crash, replayed against this feature, shows its $4.54. A step interrupted at a gate appears as `interrupted`. No terminal outcome is absent from the manifest. A test that injects an adapter failure after reported usage proves the reason and the usage are readable from a new process.

**AC-11 — The roll-up is per vendor, invents no money and blends nothing.** The manifest carries, per vendor that ran an adapter step: step count, summed `cost_usd` where that vendor reported money, summed input, cached-input, cache-write-input and output tokens, and the count of steps that reported no cost. A vendor that reports no money has `cost_usd: null` — never `0`, never rounded to `$0.000`. No field anywhere sums money across a priced and an unpriced vendor. Recomputing each vendor's totals from all of the run's `usage` events reproduces the manifest's roll-up exactly, counting retried, parallel, failed and interrupted occurrences once each; script, integrate and gate occurrences create no vendor entry. Nothing this ticket writes causes a cost to be counted twice against `ticket.md`'s existing history.

**AC-12 — `harness runs [<ticket-id>]` lists runs.** With no argument it lists every run under `.quorum/runs/`, most recent first; with a ticket id, that ticket's runs. Each line shows run id, ticket, flow, stage transition, status, duration and the per-vendor roll-up — money for vendors that report it, token counts for those that do not, `n/a` where a cost is unknown, vendors listed separately with no combined total, and a statement of how many steps were unpriced. A missing `.quorum/runs/` prints an empty-state message and exits 0. One malformed run directory does not hide its valid siblings: readable runs are listed, the malformed one is named, and the command exits non-zero.

**AC-13 — `harness runs <run-id>` shows one run, and reports incompleteness rather than repairing it.** The detail view lists each attempt in order with adapter, model, status, start and duration, verdict, usage, error where it failed, and the path of its step directory so a human can open the prompt or the events. It reads only files inside the selected run directory. An unknown run id gives a clear error and a non-zero exit. When the manifest says `running`, has no terminal time, references a missing events file, or ends in a truncated line, the run is labelled incomplete and the affected file is named; complete preceding events may still be shown, but the command never silently repairs a file, never omits the warning and never reports a terminal result it inferred. `--json` writes a single JSON document as the whole of stdout with no ANSI codes, exits non-zero on an unknown id, and references event files by path rather than inlining their contents.

**AC-14 — The contracts are executable against real run artifacts.** `contracts/Q-0011/run-manifest.schema.json` and `contracts/Q-0011/run-events.schema.json` are JSON Schema 2020-12 documents with `additionalProperties: false` on the manifest and on the event envelope (per-type `data` shapes declared by the schema; `schema_version` is the escape hatch for later additive change). `harness validate` gains JSONL support: given a `.jsonl` data file it validates every non-blank line independently against the schema and reports `<file>:<line>` for each violation — implementable entirely in `spike/bin/harness.js` on the existing `validate(schema, data)` export from `spike/src/contracts.js`, so no engine file is touched. After an end-to-end mock-adapter run, validating the produced `manifest.json` and a produced `events.jsonl` exits 0; validating artifacts with a required field removed, with `cost_usd: 0` for a vendor that reported none, with a `seq` gap, with a negative token count, with an unknown event type, and with an unexpected extra field each exit 1 with a named error.

## Non-goals

- **No change to `ticket.md` or `runs.log`.** Neither format changes here. `contracts/Q-0006/ticket-review-state.schema.json` freezes the history shape and Q-0006 and Q-0033 are in flight over exactly those files; racing them trades a solved problem for a merge conflict. The join is the naming rule in AC-1, which needs no format change.
- **No pricing of token-only vendors.** Settled 2026-08-22. No rate table ships, none is read, and no user-supplied rates are accepted.
- **No rename of `.harness/worktrees/`.** `spike/src/git.js` writes worktrees to `.harness/worktrees/` while `CLAUDE.md` says `.quorum/worktrees/`. Real drift, scoped out of Q-0006 and Q-0033 for the same reason. This ticket writes to `.quorum/runs/`; both directories exist until the rename ticket lands, and that is accepted.
- **No resumable runs.** Reading a manifest back to restart an interrupted run is Q-0019, in M3.
- **No UI, server, WebSocket or daemon API.** Mission control is M3 and will read these files.
- **No migration.** History is never fabricated from `runs.log`, terminal output or `ticket.md`. Ticket folders with no `.quorum/runs/` data stay readable and are not rewritten.
- **No per-turn transcript for vendors that do not stream one.** Claude Code returns one envelope; the record honestly shows one event where Codex shows many. Changing that means changing the adapter contract.
- **No retention, pruning, compression, search, filtering, export or deletion.** Run directories accumulate. AC-13's explicit incomplete-state handling is what a later pruning policy needs, and is the whole of the provision made for it.
- **No budgets, caps, forecasts or alerts.** A budget line in `harness.yaml` is scheduled before M3 and will read this data.
- **No trace renderer.** `events.jsonl` invites one. This ticket writes the file and lists runs; formatting a live trace is M3.
- **No new adapter, and no change to flow routing, retry limits, gate semantics, stage transitions, cross-vendor lint or worktree branch rules.**

## Open questions

None blocks solutioning. The three that were raised as blockers are answered above.

1. **Should text events be bounded, and at what size?** *(owner: architect, during solutioning.)* Full text diagnoses best; a bound needs a byte limit, a UTF-8 boundary rule and an explicit truncation event. Silent truncation is prohibited either way, per the errors-are-explicit rule. If a bound is introduced it becomes an independently tested schema rule.
2. **How large does a run directory actually get?** *(owner: architect — measure, do not design.)* Prompts include the materialised diff, already capped at 200 KB. Measure on the first real run and record the number; a retention policy is a later ticket that this format already permits.
3. **Are concurrent runs on one ticket prevented or merely detected?** *(owner: maintainer.)* AC-1 makes a collision loud, which is enough for a single-user local tool. Revisit at M3, when a daemon can start runs the CLI cannot see.
4. **Should `adapters --json` be aligned with `runs --json`?** *(owner: maintainer.)* `runs --json` is JSON-only because a read-back command exists to be piped; `adapters --json` prints JSON after human output. Aligning it is a separate, additive change.

## Risks

- **The roll-up gets read as a total.** The failure is silent and the number looks authoritative. Every surface showing it must say which vendors it could see; `board` already carries that disclaimer and AC-12 requires it of the new command.
- **The durable trace freezes the vendor's format.** If the engine writes `{type: 'stdout', line}` to disk, "one trace format" is lost at the moment it becomes permanent, and M3 and the M2 port both inherit the parse. AC-7 is the guard, and it is the reason `schema_version` is on every record.
- **Writing history becomes a way to lose a paid run.** If an append fails mid-run — disk full, read-only filesystem — throwing would discard work already billed. The engine warns loudly and continues on append failure, and refuses outright only at AC-1, before anything costs money. This is the one place where "errors are explicit" and "never lose a paid run" point in different directions, and the split is deliberate.
- **A hard kill loses the last event.** Append-only lines and atomic replacement bound the damage; `SIGKILL` or power loss between an event and a manifest update cannot be eliminated. AC-13 requires the reader to say so rather than infer a terminal state.
- **The contract must fail on a real artifact, not a fixture.** Q-0006's lesson was that a contract nothing can execute is documentation. AC-14 is written against the repository's own run output.

## Cross-cutting checklist

| Concern | This ticket |
| --- | --- |
| **BYOS** | No code path touches credentials. AC-2 prohibits environment values in any artifact and a test asserts it. `check()` is unchanged and still refuses when `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` or `CODEX_API_KEY` is set. All run-history tests use the mock adapter. |
| **Worktree safety** | The engine writes only under `.quorum/runs/`, excluded per AC-2. Worktree and branch are *recorded*, never created differently. No agent-produced change is copied into the user's working tree. |
| **Gate behaviour** | Unchanged. No new gate, none becomes `auto`, `human-locked` still cannot be overridden. An interrupted gate becomes visible on disk (AC-3, AC-10) — existing behaviour made legible, not new behaviour. |
| **File format and schema** | Two new formats, both under `.quorum/`, both specified by JSON Schema 2020-12 under `contracts/Q-0011/`, both executable via `harness validate` (AC-14). No existing format changes. Files stay the database. |
| **Lint rules** | None added. No flow file changes; `harness lint` untouched. |
| **Cross-vendor rule** | Not applicable to the feature. The ticket is M1's fan-out demonstration: `spike/src/**` (backend, codex) and `spike/bin` + `spike/test` (tooling, claude) are disjoint, which is what makes it two roles on two vendors rather than parallel work on one file. |
| **Cold-clone impact** | Neutral to positive. History is automatic for non-dry runs, needs no daemon, database, account, environment variable or configuration, and adds no interaction and no wait. It adds one optional command that answers "what did that cost me" — a question a first-run adopter asks and currently cannot get answered. |
| **Tests** | The mock-adapter end-to-end suite stays green and gains: the run directory and manifest, a backward-edge second attempt, a fan-out step id containing `:`, two parallel steps with interleaved events, a failed step's usage surviving into a new process, `raw`-event deletion leaving timeline and roll-up unchanged, roll-up recomputation from events, and both `harness validate` exit codes. |
| **Docs** | `docs/04-architecture.md` gains the `.quorum/runs/` layout; the adapter contract doc gains the typed event list; `docs/GLOSSARY.md` gains **run history** (the on-disk record under `.quorum/runs/`), needed because the term now appears in more than one file. A DECISIONS entry is required if AC-7's typed-event contract is implemented in a way that changes the documented adapter contract, which it likely does. |

## Notes for solutioning

- **Keep the halves disjoint by construction.** `harness validate`'s JSONL support can be built entirely in `spike/bin/harness.js` on the existing `validate(schema, data)` export from `spike/src/contracts.js`, so the CLI task needs no engine file. Land `contracts/Q-0011/*.schema.json` on the contracts branch before fan-out; they are the one artifact both tasks need.
- **The halves are not equal in size.** Eleven criteria are engine-side, three are CLI-side. If the architect wants closer balance, the natural transfer is the roll-up recomputation check in AC-11 — assign that test to the tooling task, which owns `spike/test`.
- **The reader stays in `spike/bin`.** A reusable reader in `spike/src` would be backend-owned, which collapses the CLI half and buys a cross-role dependency for a package (`packages/core`) that M2 will rewrite in TypeScript anyway.

## Provenance

The **codex** candidate contributed the findings that changed the shape of this requirement. Its AC-5/AC-6 identified that the durable trace would otherwise freeze each vendor's native format — verified against `spike/src/engine.js:178`, where the only event today is a raw `stdout` line — and that is now AC-7, the criterion most likely to be regretted if dropped. Its AC-8 caught that the persisted usage contract must carry the cache and cache-write fields, verified against `codex.js:54` emitting `cached_input_tokens` and `adapters/index.js:8` dropping it. Its AC-13 contributed atomic replacement, AC-14 concurrent-writer serialisation, AC-17 the reader's obligation to report incompleteness rather than repair it, and AC-18 the JSONL-aware `harness validate`. Its risk list contributed schema versioning against the M2 port.

The **claude** candidate contributed the spine, the scope discipline and the resolutions. Its twelve criteria are the backbone of AC-1 through AC-13; its non-goals — especially the argument that `runs.log` and `ticket.md` must not change while Q-0006 and Q-0033 are in flight over those files — are adopted almost intact, as is its reading of the `.harness/` versus `.quorum/` worktree drift, which is correct against `spike/src/git.js:9` where the codex candidate's AC-21 was not. It answered all three of the codex candidate's blockers, and those answers stand.

**Struck.** Codex's AC-19 (qa-red must produce a failing artifact) prescribes the next stage's work rather than this feature's behaviour; AC-20, AC-21, AC-22, AC-23 and AC-24 restate standing rules and are folded into non-goals and the checklist; AC-25 (fan-out must be disjoint) is an instruction to solutioning and moved there; AC-26 (documentation vocabulary) is a checklist row. Its separate `rollup.json` was rejected in favour of the roll-up inside the manifest, which also removes the manifest-versus-roll-up disagreement its own AC-17 had to handle. Its `harness history` was rejected for `harness runs`, because `history` already names a `ticket.md` field.

## Size

Fourteen acceptance criteria, roughly eleven engine and three CLI, at the top of the ten-to-fifteen band set on 2026-08-22. It is held there by four cuts — no change to `ticket.md` or `runs.log`, no trace renderer, no retention policy, no resumption — each of which is separable and each of which would have taken this past twenty.

It is deliberately **not split**, against the usual rule, because splitting it destroys its purpose. Q-0011 was pulled forward from M2 to be M1's fan-out demonstration precisely because the engine and CLI halves are two roles on two vendors on disjoint files, and Q-0006 could not be. Split into "engine writes" and "CLI reads", each half is single-role and M1 loses its demonstration a second time. Fourteen criteria across a clean seam is the cheaper risk.

If solutioning finds that the halves cannot in fact be made disjoint — most likely because the contracts cannot be authored before fan-out — that seam is where this ticket splits, and the split should be taken then rather than carried into development.
