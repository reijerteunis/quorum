# Q-0011 — Run history on disk with per-vendor roll-up

*Solution, revision 4. Contracts branch: `harness/Q-0011/contracts`.*

## Chosen approach

Implement a file-backed run-history writer in the engine and a read-only presentation layer in the CLI, separated by committed contracts.

Before a non-dry run can spawn work, the engine exclusively creates `.quorum/runs/<ticket-id>-<n>/`, excludes `.quorum/` through `.git/info/exclude`, and atomically writes the initial `manifest.json`. Each step attempt receives a chronologically allocated directory containing append-only events and, where applicable, the exact prompt and output.

```text
.quorum/runs/<ticket-id>-<n>/
├── manifest.json
└── steps/
    └── <four-digit-seq>-<sanitised-step-id>/
        ├── events.jsonl
        ├── prompt.txt       # adapter occurrences only
        └── output.txt       # when textual output exists
```

The occurrence sequence is padded to four digits (`0001`) and grows naturally beyond four digits after `9999`. `/` and `:` in step ids become `-`. Allocation occurs synchronously in start order, so retries, backward edges and parallel fan-out cannot overwrite one another.

Adapters translate vendor-native output into vendor-neutral `{type, data}` payloads. They do not construct persisted envelopes. The occurrence writer serially stamps `schema_version`, a UTC timestamp ending in `Z`, and a contiguous per-occurrence `seq`.

Inner adapters return usage but never emit `usage` events. The retry wrapper is the first layer with the complete aggregate across attempts, so it emits exactly one final `usage` event when the successful result or billed thrown error contains usage. It emits no usage event when no usage was reported. The same aggregate is copied into the manifest occurrence and counted once in the roll-up.

The manifest is both the run snapshot and the per-vendor roll-up. Ordinary replacements pass through one engine-owned queue and use a complete same-directory temporary file, fsync/close and rename. Signal finalisation uses the synchronous equivalent before exit and supersedes queued older snapshots. There is no separate roll-up file.

The CLI resolves the project through the existing `findProject()` and `loadProject()` path and reads `<repoDir>/.quorum/runs/`. After selecting a run, it reads only inside that run directory. `harness runs` supplies list and detail views without repairing or inferring state. `harness validate` treats JSONL as independently validated JSON documents and applies Q-0011 stream invariants only when the schema `$id` identifies the Q-0011 event schema.

No dependency is added. The design uses the existing Node.js filesystem APIs, Ajv validator, adapter callback, git exclusion helper and CLI entry point.

## Usage and roll-up semantics

Usage preserves exactly what the vendor reported. Every measure is a non-negative number or `null`; missing values are never changed to zero or estimated.

`input_tokens` is the vendor-reported total input. Cached-read and cache-write fields are informational subsets and are not added to it. `output_tokens` includes reported reasoning-output tokens.

The roll-up groups final non-null occurrence usage by `usage.vendor`:

- `step_count` counts included adapter occurrences once each.
- `unpriced_steps` counts included usage objects whose `cost_usd` is null.
- Each numeric measure is summed over reported values only and is null when no included occurrence reported it.
- A token-only vendor therefore has `cost_usd: null`, never zero.
- Script, integrate and gate occurrences do not create vendor entries.
- No cross-vendor monetary total is produced.

An adapter occurrence that fails before reporting usage remains visible in manifest detail with `usage: null`, but emits no usage event and creates no roll-up entry. This narrowly supersedes AC-11’s phrase “per vendor that ran an adapter step” and is recorded as E-1 in `solution/errata.md`, referenced from `ticket.md`. It preserves the stronger invariant that every roll-up row can be reproduced exactly from persisted final usage events without inferring a billing vendor from routing metadata.

## Status, errors and interruption

Occurrences begin `running`. `step_completed` terminates them as `completed`, `aborted`, `regressed` or `exhausted`; `step_failed` terminates them as `failed` or `interrupted`.

A gate answer is a successful gate occurrence whose answer is stored as its verdict. An `abort` answer then makes the run `aborted`. A backward-edge declaration makes its adapter occurrence `regressed`. An occurrence reaching its traversal limit is `exhausted`. Ctrl-C and `SIGTERM` make active occurrences and the run `interrupted`.

Error categories are executable enums shared by the manifest and event schemas:

| Category | Producing path |
| --- | --- |
| `auth` | Adapter failure identified by `authError()` |
| `transient` | Retryable adapter failure identified by `transientError()` |
| `structured_output` | `FlowError` caused by invalid structured output |
| `adapter` | Other adapter failure |
| `script` | Script-step failure |
| `integrate` | Integration-step failure |
| `interrupted` | Ctrl-C or `SIGTERM` |
| `unknown` | Explicit fallback for an older or otherwise uncategorised path |

Retry events retain both their reason class and nullable vendor message. The live renderer continues printing the message when present.

## Persistence guarantees

- The initial run directory and manifest exist before any adapter, script, integration or gate is spawned.
- Existing or uncreatable run directories are fatal before billing; dry runs write nothing.
- Events are appended as complete UTF-8 JSON objects followed by newlines.
- Event sequence numbers start at one and have no gaps within an occurrence.
- Prompts and outputs are stored byte-for-byte and are not redacted.
- Spawn records persist argv only; environment objects and values are never persisted.
- Persisted paths are relative to the project root.
- Manifest updates are complete atomic replacements serialised by the engine.
- History append failures warn and disable further writes for the affected artifact without cancelling already-billed work.
- A billed throw preserves its full error and accumulated usage before propagation.
- Text and output remain unbounded. A future bound would require measured evidence, a UTF-8 rule and an explicit truncation event.

## Contracts

The following files exist under `contracts/Q-0011/` and are frozen inputs to QA and development:

| Contract | Kind | Purpose |
| --- | --- | --- |
| `contracts/Q-0011/run-events.schema.json` | JSON Schema 2020-12 | Strict event envelope and per-type data shapes, UTC timestamps, usage, retry messages and error-category enum. |
| `contracts/Q-0011/run-manifest.schema.json` | JSON Schema 2020-12 | Strict manifest, four-or-more-digit occurrence paths, UTC timestamps, occurrences, usage, errors and per-vendor roll-up. |
| `contracts/Q-0011/run-history-writer.contract.md` | Behavioural interface | Adapter/retry boundary, usage emission, occurrence allocation, lifecycle, atomic writes, interruption, error mapping and roll-up algorithm. |
| `contracts/Q-0011/mock-adapter-run-history.contract.md` | Deterministic test interface | Mock controls for multiple vendors, token-only usage, cache fields and preservation-only raw events. |
| `contracts/Q-0011/runs-cli.contract.md` | CLI interface | Project-root resolution, selection, list/detail/JSON output, incompleteness, renderer behaviour and JSONL/manifest validation. |

No migration skeleton is created because the requirement explicitly prohibits fabricating history from `runs.log`, `ticket.md` or terminal output.

The schemas use `additionalProperties: false` on the manifest, event envelope and per-type payloads. `schema_version` is the compatibility escape hatch. Cross-document and stream invariants that JSON Schema cannot express are specified in the behavioural contracts and enforced by `harness validate` when the loaded schema has the corresponding Q-0011 `$id`.

## Reader and validator behaviour

`harness runs` distinguishes an exact existing run id from a ticket filter. Exact run-id matches win. Lists are most-recent-first and show each vendor separately, including cost or `n/a`, token counts and unpriced-step count, with no combined monetary total.

Detail orders occurrences using the numeric occurrence prefix and shows adapter, model, status, start, duration, verdict, usage, error and relative occurrence path.

A run is incomplete when it remains `running`, lacks a terminal time, references a missing events file, or contains malformed, truncated, schema-invalid or non-contiguous events. Complete preceding events may be shown, but the affected path is named and no repair or inferred terminal state is written.

`--json` emits one ANSI-free JSON document and references event files by path rather than inlining them.

For JSONL validation, the schema is parsed and compiled once per invocation and the same object is reused for all lines and files. Non-blank lines are parsed and validated independently, with errors reported as `<file>:<line>`. The contiguous sequence invariant applies only to the Q-0011 event schema `$id`.

Manifest semantic validation additionally checks:

- run and occurrence status/time consistency;
- adapter/model/usage consistency;
- unique occurrence directories and roll-up vendors;
- roll-up equality with non-null occurrence usage and emitted final usage events;
- null vendor cost when no included occurrence reported cost.

## Verification ownership

QA-red exclusively owns `spike/test/q0011-*.js`. Development tasks modify production and documentation files only. QA exercises existing entry points and real files under `.quorum/runs/`; it does not import a new internal run-history module.

Coverage includes directory collisions, dry runs, exclusion, relative paths, environment-value absence, atomic parallel updates, signal finalisation, contiguous events, truncation, repeated and parallel occurrences, colon sanitisation, exact prompt/output bytes, billed failures, fail-before-usage exclusion, terminal status mappings, priced and token-only vendors, raw-event independence, retry aggregation, reader modes, malformed siblings, incomplete artifacts and all AC-14 validation failures.

The first successful mock-adapter end-to-end run is the measurement point for directory size. QA records `du -sk .quorum/runs/<run-id>` as evidence without introducing retention or compression behaviour.

## Sequencing and ownership

The contracts branch lands before QA-red and development fan-out. Q-0033 must land before Q-0011 development because it overlaps `spike/bin/harness.js`, `docs/GLOSSARY.md` and `docs/DECISIONS.md`; Q-0011 rebases before fan-out.

Production ownership remains disjoint:

- backend/codex owns `spike/src/**` and the named documentation files;
- tooling/claude owns `spike/bin/harness.js`;
- QA owns `spike/test/q0011-*.js` before both development tasks begin.

The generic task-role wording omits `tooling`, but the repository’s canonical architecture and executable `developer-tooling` role define it as the live Claude-owned CLI role. Substituting `frontend` would violate allowed paths; substituting `backend` would collapse the required multi-vendor seam.

## Tasks

```yaml
tasks:
  - id: q0011-engine-writer
    role: backend
    title: Persist vendor-neutral run history and per-vendor roll-ups
    contracts:
      - contracts/Q-0011/run-events.schema.json
      - contracts/Q-0011/run-manifest.schema.json
      - contracts/Q-0011/run-history-writer.contract.md
      - contracts/Q-0011/mock-adapter-run-history.contract.md
    depends_on: []

  - id: q0011-cli-reader-validator
    role: tooling
    title: Add run-history inspection and executable JSONL validation
    contracts:
      - contracts/Q-0011/run-events.schema.json
      - contracts/Q-0011/run-manifest.schema.json
      - contracts/Q-0011/runs-cli.contract.md
    depends_on: []
```

`q0011-engine-writer` owns `spike/src/**`, `docs/03-adapter-contract.md`, `docs/04-architecture.md`, `docs/GLOSSARY.md` and `docs/DECISIONS.md`. It must not modify `spike/bin` or `spike/test`.

`q0011-cli-reader-validator` owns `spike/bin/harness.js`, including the live renderer migration. It must not modify `spike/src` or `spike/test`.

The tasks intentionally have no dependency on each other. Their shared prerequisites are the landed contracts, QA-red artifacts and the Q-0033 rebase.

## Acceptance-criteria mapping

| Acceptance criteria | Owner | Contracts |
| --- | --- | --- |
| AC-1–AC-6 | `q0011-engine-writer` | writer, manifest and event contracts |
| AC-7 | writer plus CLI renderer migration | event, writer, mock and CLI contracts |
| AC-8–AC-11 | `q0011-engine-writer` | manifest, event, writer and mock contracts; erratum E-1 |
| AC-12–AC-13 | `q0011-cli-reader-validator` | CLI, manifest and event contracts |
| AC-14 | `q0011-cli-reader-validator` | both schemas and CLI contract |

## Rejected alternatives

### Persist vendor-native JSONL

Rejected because every reader would branch on adapter identity, freezing current Claude and Codex formats into the M2 and M3 interface.

### Have inner adapters emit usage events

Rejected because an inner adapter knows only one retry attempt. Only the retry wrapper has the final aggregate required for one-event-per-occurrence accounting.

### Emit an empty usage event when no usage was reported

Rejected because the schema requires a vendor and the engine would have to infer one from routing metadata. That would make recomputation disagree with the manifest or fabricate accounting data.

### Count null-usage failures as unpriced

Rejected and recorded as requirement erratum E-1. “No accounting report” is different from “usage reported without a price”; only the latter increments `unpriced_steps`.

### Have adapters emit complete persisted envelopes

Rejected because adapters do not know run occurrence, timestamp policy or sequence allocation. The occurrence writer stamps envelopes at append time.

### Separate `rollup.json`

Rejected because it creates a second atomic document and a manifest-versus-roll-up inconsistency state.

### Reusable reader under `spike/src/`

Rejected because the current consumer is one CLI command, M2 will replace the spike, and it would create an unnecessary cross-role production dependency.

### Hand-built multi-vendor fixtures

Rejected because AC-14 requires validation against real engine artifacts. Contracted mock controls generate those artifacts through the actual engine path.

### Asynchronous signal finalisation

Rejected because `process.exit` does not drain pending promises. A synchronous temporary-file replacement bounds the interrupt path.

### Compile the schema for every JSONL line

Rejected because repeated `$id` registration can fail in Ajv and compilation per line is unnecessary.

### Generic sequence validation for all JSONL

Rejected because other JSONL contracts need not contain `seq`. The invariant is keyed to the Q-0011 event schema `$id`.

### Bound or silently truncate text

Rejected because there is no measured need or safe truncation contract. A later bound requires an explicit event and UTF-8-safe rule.

### Change `ticket.md`, `runs.log`, worktree naming or add migration

Rejected as explicitly out of scope and conflict-prone. Run-directory naming supplies the required join without rewriting existing formats.

## Review disposition

Every round-three finding is addressed:

- **B6:** `run-history-writer.contract.md` now assigns final usage emission to the retry wrapper after aggregation and prohibits inner adapters from emitting usage payloads.
- **B7:** a usage event is emitted if and only if the result or billed throw reported usage; recomputation is defined over those final events.
- **M11:** both schemas now use the same error-category enum, and the writer contract maps every engine path to a category.
- **M12:** retry data now carries required nullable `message`, and the CLI contract preserves renderer output for it.
- **M13:** occurrence prefixes are four digits and grow naturally after `9999`; the manifest schema requires four or more digits.
- **M14:** null-usage exclusion is recorded as dated erratum E-1, explicitly superseding the named AC-11 phrase and referenced from `ticket.md`.
- **N9:** manifest and event timestamps require RFC 3339 `date-time` values ending in `Z`.
- **N10:** the CLI contract locates `.quorum/runs/` from the resolved `repoDir`, including when invoked from a subdirectory.

All previously accepted round-one and round-two corrections remain in force.
