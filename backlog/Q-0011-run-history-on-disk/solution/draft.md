# Q-0011 — Run history on disk with per-vendor roll-up

## Status

Final revision, closing the four directives in `solution/review.md`.

The 2026-08-23 scope cut is authoritative: Q-0011 persists a manifest plus per-attempt prompt and output files. It does not persist an event stream and does not add JSONL validation.

The three requirement errata are normative:

- E-1: only occurrences with non-null usage participate in the roll-up.
- E-2: schemas annotated `x-quorum-contract: run-manifest-v1` receive contract-specific semantic validation after JSON Schema validation.
- E-3: gate interruption marks the run interrupted and creates no occurrence.

## Chosen approach

### Files are the persistence boundary

A non-dry run exclusively creates `.quorum/runs/<ticket-id>-<n>/` before any adapter or command can be billed. It writes:

```text
.quorum/runs/<ticket-id>-<n>/
├── manifest.json
└── steps/
    └── <seq>-<sanitised-step-id>/
        ├── prompt.txt      # adapter attempts only
        └── output.txt
```

The engine owns all writes. The CLI reads manifests without repairing or inferring persisted state. Existing `ticket.md` history and `runs.log` formats remain unchanged.

### One versioned manifest is the source of truth

`manifest.json` contains run identity, lifecycle state, occurrence records, usage, errors, and the per-vendor roll-up. Keeping the roll-up in the manifest gives readers one atomic snapshot and avoids disagreement between independently replaced files.

The manifest starts with `status: running`. After every terminal occurrence and at run termination, the engine mutates one in-memory snapshot and replaces the file synchronously using a complete same-directory temporary file, `fsync`, close, and rename. JavaScript event-loop execution serialises parallel completions. Signal finalisation uses the same synchronous path, so it cannot race an asynchronous writer over a shared temporary file.

A `SIGKILL` or power loss may leave a valid `running` manifest. Readers label it incomplete and never repair it.

### Occurrences represent work that actually runs

An occurrence is allocated synchronously immediately before an adapter spawn or script/integrate execution. Gates and fan-out parents allocate none. Each materialised fan-out task, retrying traversal, or backward-edge revisit gets a fresh directory.

Sequence numbers begin at `001`, sort in start order, continue beyond `999`, and never truncate. `/` and `:` in step ids become `-`.

Adapter attempts persist the exact assembled prompt before spawn and the final or raw-invalid output when available. Script and integrate occurrences have no prompt and always have an output file, even when empty. Text is unbounded in Q-0011; no silent truncation is permitted.

### Adapter usage is vendor-neutral and per call

Adapters and the retry wrapper expose one usage shape:

```text
vendor
input_tokens
output_tokens
cached_input_tokens
cache_write_input_tokens
cost_usd
```

Unknown measures are `null`, never inferred or changed to zero. Input totals already include vendor-reported cache components, and output totals preserve reported reasoning tokens.

The vendor comes from the adapter’s per-call declaration: `result.vendor` on success or `error.vendor` on a billed failure. The static `adapter.vendor` is only a fallback when the call declares none. The engine never derives billing provenance from an adapter routing name.

The mock adapter’s role-keyed profile sets the per-call vendor on success and billed failure. This makes one real mock run capable of producing separate priced and token-only vendor rows without invoking a real CLI.

### Roll-up is reproducible from persisted usage

Occurrences with `usage: null` remain visible in detail but create no vendor row. For each vendor represented by non-null usage:

- `step_count` counts each occurrence once;
- `unpriced_steps` counts occurrences whose `cost_usd` is null;
- each token or cost measure sums reported values only;
- a measure is null when no included occurrence reported it.

There is no cross-vendor money total. Script, integrate, gate, and fan-out-parent activity creates no vendor row. Nothing is written back to existing ticket accounting.

### Exhaustion remains reserved but is not emitted

The version-1 schema retains `exhausted` in its status enums as a compatibility escape hatch for the engine vocabulary. Q-0011 does not write it to a manifest. The existing exhaustion event updates ticket history and execution continues to a gate; the manifest ultimately records the actual terminal outcome such as `aborted`, `regressed`, or `completed`. QA must not require an exhausted manifest fixture.

### Git exclusion is explicit

The writer resolves the repository’s real Git directory, including linked worktrees where `.git` is a file, and adds `.quorum/` to the applicable `info/exclude`. Failure to resolve or update that file produces a warning naming the path and never returns silently. Supported normal and linked-worktree cases must leave `git status` unchanged.

### Reader remains a CLI-owned implementation

`harness runs` is implemented in `spike/bin/harness.js`; no reusable reader is added to `spike/src`.

Selection is deterministic:

- an exact existing run-directory name selects detail;
- otherwise `^[A-Z]+-[0-9]{4}$` selects a ticket filter;
- a syntactically valid ticket with no runs returns an empty list and exit 0;
- any other unknown value is an unknown-run error and exits non-zero.

Lists sort by `started_at` descending and then `run_id` ascending. Malformed siblings are named without hiding valid runs, and make the final exit non-zero.

Human output keeps vendors separate and states unpriced steps. JSON mode emits exactly one JSON document without ANSI output.

### Validation combines structure and semantics

The existing JSON/YAML parser remains unchanged. JSON Schema 2020-12 checks structure, required fields, additional properties, timestamps, relative paths, enums, and non-negative measures.

When a schema carries `x-quorum-contract: run-manifest-v1`, `harness validate` additionally checks occurrence uniqueness, lifecycle consistency, occurrence-kind nullability, unique vendors, and exact roll-up recomputation. This catches a token-only roll-up mutated from `null` to `0`, which JSON Schema alone cannot distinguish from a genuinely reported zero.

An absent or unknown annotation prints an explicit semantic-check-skipped notice.

## Rejected alternatives

### Persisting `events.jsonl`

Rejected by the scope cut. The earlier event model mixed unstable occurrence ordering, deletable raw records, and adapter-only data. A trace contract should be designed with its eventual renderer in M3.

### A separate `rollup.json`

Rejected because two atomic files can still describe different snapshots. Embedding the roll-up in the manifest gives readers one consistency boundary and one schema.

### Deriving vendor from adapter routing

Rejected because an adapter name is routing metadata, not necessarily billing provenance. Per-call adapter declarations support deterministic multi-vendor tests and future adapters without teaching the engine vendor-specific rules.

### Pricing token-only vendors

Rejected by the tokens-only decision. No rate table, inferred price, user-supplied rate, or blended total is introduced.

### Asynchronous manifest writes with a shared temporary path

Rejected because signal finalisation could race an in-flight write or rename. Small synchronous local JSON replacements are predictable and make serialization explicit.

### A reusable reader under `spike/src`

Rejected because it would create an unnecessary cross-role dependency for code scheduled to be replaced during the M2 TypeScript port. The current CLI can use the already exported contract helpers.

### Looking in `backlog/` to identify ticket filters

Rejected because history reading must remain confined to `.quorum/runs/` after selection. A documented syntax gives deterministic empty-list versus unknown-run behavior.

### Repairing incomplete manifests

Rejected because the reader cannot safely infer why execution stopped. It reports incompleteness and names the manifest.

### Changing `ticket.md` history or `runs.log`

Rejected because their formats are frozen by concurrent work. The run-directory naming rule supplies the join without creating merge conflicts or double-counting cost.

### Retention, resumption, UI, and trace rendering

Rejected as separable later work. This ticket establishes the durable record and human CLI only.

## Contracts

All contracts are committed under `contracts/Q-0011/` before QA or development fan-out.

| Contract | Kind | Purpose |
| --- | --- | --- |
| `contracts/Q-0011/run-manifest.schema.json` | JSON Schema 2020-12 | Executable version-1 manifest structure, strict fields, statuses, occurrences, usage, errors, and vendor roll-ups. |
| `contracts/Q-0011/run-history-writer.contract.md` | Engine interface and persistence contract | Run initialization, exclusion, synchronous atomic replacement, occurrence allocation, files, status mapping, per-call vendor propagation, and roll-up algorithm. |
| `contracts/Q-0011/mock-adapter-run-history.contract.md` | Test-adapter stub contract | Deterministic priced/token-only profiles, cache usage, per-call vendor declarations, billed failure, and retry-attempt fixtures. |
| `contracts/Q-0011/runs-cli.contract.md` | CLI and semantic-validator contract | Selection grammar, ordering, human/JSON output, incomplete-run behavior, malformed siblings, and annotation-driven semantic checks. |

No migration skeleton is created: existing history is not migrated or fabricated.

## Acceptance-criteria ownership

| Criteria | Owner |
| --- | --- |
| AC-1–AC-5, AC-8–AC-11 | `q0011-engine-writer` |
| AC-12–AC-14 | `q0011-cli-reader-validator` |
| AC-6, AC-7 | Removed by scope cut; no implementation task |

Each live criterion has exactly one owner.

## Tasks

The repository’s live `tooling` role is used for the CLI task because `harness/architecture.md` assigns `spike/bin/` and `spike/test/` to it; the generic three-role vocabulary in the stage output contract predates that repository-specific role. Using `backend` for the CLI would collapse the required two-vendor fan-out and contradict the repository’s current write contract.

```yaml
tasks:
  - id: q0011-engine-writer
    role: backend
    title: Persist atomic run manifests, attempt artifacts, usage and per-vendor roll-ups
    description: >
      Own spike/src/**, docs/03-adapter-contract.md, docs/04-architecture.md,
      docs/GLOSSARY.md, and docs/DECISIONS.md. Implement the engine writer against the
      referenced frozen contracts. Do not edit contracts/Q-0011/**, spike/bin/**,
      spike/test/**, or backlog/Q-0011-run-history-on-disk/ticket.md; spike/test/** belongs
      to qa-red.
    contracts:
      - contracts/Q-0011/run-manifest.schema.json
      - contracts/Q-0011/run-history-writer.contract.md
      - contracts/Q-0011/mock-adapter-run-history.contract.md
    depends_on: []
    owns:
      - spike/src/**
      - docs/03-adapter-contract.md
      - docs/04-architecture.md
      - docs/GLOSSARY.md
      - docs/DECISIONS.md
    acceptance_criteria:
      - AC-1
      - AC-2
      - AC-3
      - AC-4
      - AC-5
      - AC-8
      - AC-9
      - AC-10
      - AC-11

  - id: q0011-cli-reader-validator
    role: tooling
    title: Implement harness runs and executable manifest semantic validation
    description: >
      Own spike/bin/harness.js. Implement the CLI reader and semantic validator against the
      referenced frozen contracts. Do not edit contracts/Q-0011/**, spike/src/**, or
      spike/test/**; spike/test/** belongs to qa-red.
    contracts:
      - contracts/Q-0011/run-manifest.schema.json
      - contracts/Q-0011/run-history-writer.contract.md
      - contracts/Q-0011/runs-cli.contract.md
      - contracts/Q-0011/mock-adapter-run-history.contract.md
    depends_on: []
    owns:
      - spike/bin/harness.js
    acceptance_criteria:
      - AC-12
      - AC-13
      - AC-14
```

Both tasks run in the same fan-out wave. The contracts land before fan-out, and the `integrate` step owns cross-task real-artifact assertions after both branches merge. The owned source files remain disjoint.

## Open questions

- The run-id/ticket-id join invariant is not added to semantic validation in Q-0011; the accepted N-1 finding is deferred to a later contract revision.
- Run-directory size will be measured on the first real run and recorded by the architect; the accepted N-2 finding does not change this implementation.

## Verification

The regression suite must cover:

- refusal before spawn when the run directory exists or cannot be created;
- no artifacts for dry runs;
- normal repositories and linked worktrees remaining clean;
- explicit exclusion warnings instead of silent failure;
- sentinel environment values and switch names absent from persisted files;
- atomic readable manifests and two parallel completions without lost records;
- synchronous Ctrl-C/SIGTERM finalisation as interrupted;
- backward-edge repeat directories and a fan-out id containing `:`;
- gates and fan-out parents allocating no occurrence;
- exact prompt and output bytes, including raw invalid structured output;
- successful and billed-failure usage with actual retry attempts;
- distinct priced and token-only vendors from role-keyed mock profiles;
- null-usage failures visible in detail but absent from roll-up;
- exact roll-up recomputation with no cross-vendor total;
- list, ticket-filter, detail, incomplete, malformed-sibling, unknown-id, and JSON-only CLI behavior;
- real-artifact schema validation success;
- failures for missing required fields, negative tokens, extra properties, and a token-only roll-up mutated from null to zero;
- explicit skipped-semantic-check notices for absent or unknown annotations;
- the existing mock-adapter end-to-end regression suite remaining green.

Repository commands remain those configured in `harness.yaml`; no dependency or test-runner discovery change is required.

## Review findings resolved

- **B-1:** The writer now takes vendor provenance from `result.vendor` or `error.vendor`, with static `adapter.vendor` only as fallback. The mock profile explicitly sets both per-call success and failure declarations.
- **B-2:** `ticket.md` already removes the event-file and event-schema promises; no implementation task owns or edits it.
- **M-3:** The CLI contract defines the ticket-filter pattern as `^[A-Z]+-[0-9]{4}$`.
- **M-4:** `exhausted` is schema-reserved but never emitted by Q-0011; the existing ticket-history event does not terminate a run.
- **M-5:** `docs/03-adapter-contract.md` is owned by the backend task and will document the expanded usage/result/error boundary.
- **N-6:** All manifest replacements, including signal finalisation, use the same synchronous write/fsync/close/rename path.
- **N-7:** Git-directory resolution covers linked worktrees, and exclusion failure emits a named warning rather than returning silently.

The review’s settled decisions remain unchanged: two disjoint implementation surfaces, no event stream, roll-up inside the manifest, annotation-driven semantic validation, no fan-out-parent occurrence, one occurrence for commandless integrate, unbounded prompt/output text, deterministic list ordering, and the reader remaining in `spike/bin`.
