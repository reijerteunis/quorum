# Q-0006 — Review flow with cross-flow backward edge

## Chosen approach

Implement review as an ordinary YAML flow using the engine’s existing parallel steps, structured verdict, bounded `on_fail`, gate, and cross-flow `goto` mechanisms.

Two read-only `code-reviewer` steps run on Claude and Codex against the same harness-materialised three-dot diff. A verdict step reads their named artifacts, deduplicates findings, and applies the severity threshold. Approval advances `green → reviewed`; changes requested increment `iterations.review` and regress to the `consumes` stage loaded from the configured target flow. The target flow is never started automatically.

Review round numbers come from completed artifacts rather than counters: `{round}` is one plus the greatest `N` for which `review/round-N/verdict.md` exists. A failed round without a verdict reuses its directory; a later review visit cannot overwrite a completed round.

The first three rejected verdicts regress. Rejection four records exhaustion and presents a human gate that `--auto` cannot bypass. Retry grants exactly one additional regression traversal by persisting `iterations.review = max_iterations - 1`; with the shipped limit this is `2`. The next rejection increments to `3` and regresses, while a subsequent rejection reaches exhaustion again at `4`.

All persistent state remains in ticket files. Invalid output and asymmetric panel failures leave stage and counter unchanged. Existing ticket history remains readable without migration.

No dependency is added.

## Repository and ownership boundaries

The runnable M1 implementation is the Node spike plus file-backed harness assets, so all implementation tasks use `role: backend`. There is no frontend or data surface in this ticket.

The Quorum repository’s backend role may write `spike/`, `harness/`, `docs/`, and `backlog/`. It may not write `contracts/Q-0006/**`; those files are frozen at the contracts commit and are the independent specification against which development is tested.

Template sharing is explicit:

- All flow files and `roles/code-reviewer.md` are byte-shared between `harness/` and `spike/templates/harness/`.
- `harness.yaml`, `product-context.md`, `rules.md`, `architecture.md`, and developer roles are repository-specific.
- The starter template’s backend role retains adopter paths (`services/api`, `packages/domain`) and must not contain Quorum’s `spike/` layout.

The engine does not enforce role `paths` frontmatter. The allow-list reaches agents through role-body prose, so frontmatter and prose must agree and task descriptions still assign exact file ownership.

## Runtime design

### Flow and artifacts

`review.yaml` uses only engine-supported fields:

1. A parallel Claude/Codex panel writes `review/round-{round}/claude.md` and `review/round-{round}/codex.md`.
2. A verdict step reads those two named files, `requirements/merged.md`, and `solution/solution.md`. Naming the files prevents a retried round’s old `verdict.md` from becoming panel input.
3. The verdict writes both `review/round-{round}/verdict.md` and stable `review/verdict.md`.
4. `changes-requested` follows `goto: flow:development`, bounded by `counter: review` and `max_iterations: 3`.
5. The ordinary closing human gate follows approval.

Nits alone approve. Any surviving blocker or major requests changes. Findings use `severity: file:line description`; an approving verdict has no findings.

### Diff materialisation

Before any adapter spawn, the engine verifies the configured base and integration refs. It embeds:

- the complete stat for `<base>...harness/<id>/integration`;
- the patch for that three-dot range, truncated by UTF-8 bytes at `repo.max_diff_bytes`;
- an explicit truncation notice in both the prompt and `runs.log` when applicable.

Reviewers receive no worktree and run with `allowWrite: false`. They create no branch or worktree.

The template config contains:

```yaml
repo:
  base_branch: main
  max_diff_bytes: 200000
```

`harness init` replaces `base_branch` when Git can identify the current branch. Outside Git or on an unidentifiable unborn branch, it keeps `main` and succeeds. A missing resolved ref fails before an adapter runs and names the key, config file, and ref.

### Routing, counters, and gates

Before any ticket-folder write or `adapter.run`, `harness run` performs the same complete flow-directory validation as `harness lint`. Runtime target loading remains a defensive check, not the first discovery point.

On an accepted `changes-requested` verdict:

- validate structured output first;
- increment `iterations.review` exactly once;
- for counts 1–3, load the target flow and regress to its `consumes` stage;
- persist and finish as `regressed` without starting the target flow;
- report target flow, stage before and after, count, limit, and remaining traversals.

Count 4 stays at `green`, records exhaustion, and presents the gate. `--auto` cannot answer that gate.

`--gate-answer` is repeatable and values are consumed in gate encounter order. This allows, for example, exhaustion `advance` followed by closing-gate `abort`. When explicit values run out, the CLI reads a TTY. On non-TTY stdin, or for empty, missing, or invalid input, it exits non-zero with an error naming the gate; it neither blocks nor defaults.

Gate outcomes are:

- `advance`: accept the current diff and continue toward `reviewed`;
- `retry`: persist only `iterations.review = max_iterations - 1`, log the reset, and regress to the configured target, granting one additional regression traversal;
- `abort`: finish with the stage unchanged.

Other counters, including `iterations.qa`, are never reset.

### Audit and cost

Every outcome is recorded in `runs.log` and ticket history with run id, flow, status, stage before and after, timestamp, and cost.

An exhaustion-presentation entry uses unchanged `stage_before` and `stage_after` and `cost: 0`. The later terminal entry for that run carries the full measured cost exactly once, so `harness board` does not double-count it.

Legacy `{stage, run, flow, at, cost}` entries remain valid and are not rewritten.

### Failure containment

Invalid structured output is saved under the ticket’s `.harness/` directory and ends as `failed` without changing stage or counter.

Parallel review uses all-settled behavior. A successful reviewer artifact is retained if its sibling fails, but the verdict step does not run and neither stage nor counter changes.

The mock adapter’s forced and fallback `changes-requested` verdicts emit schema-valid findings such as `major: src/mock.ts:1 (mock) placeholder finding`.

### Rework

At the beginning of every development fan-out task, an existing task worktree merges `harness/<id>/integration`, including the first iteration of the new development run. Conflicts produce a warning naming the task and paths.

Development inputs include optional `review/verdict.md`. Its absence during an initial pass remains valid.

## Lint design

Both `harness lint` and the preflight used by `harness run` load the complete flow directory.

For every `goto: flow:<target>` they:

- require a loadable target flow;
- walk from the target’s `produces` stage through matching consumers until returning to the source flow’s `consumes` stage;
- retain a visited set of `(flow, stage)` pairs;
- report missing targets, reached-stage dead ends, reached-stage ambiguity, and cycles with source flow, target flow, and terminal stage.

Ambiguity is an error only for a stage reached by the checked chain; unrelated existing multi-consumer stages remain legal. Self-target and malformed fixtures live in temporary harness directories and never contaminate shipped flows.

Lint also rejects:

- missing, non-integer, zero, or negative `max_iterations`;
- counters prefixed with `iterations.`, suggesting the unprefixed spelling;
- same-role parallel panels using only one adapter in `cross_vendor: required` flows.

## Rejected alternatives

- **New `judge` step type:** the existing agent verdict contract already supports the behavior.
- **Hard-coded regression stage:** the target flow’s `consumes` field is authoritative and makes `flow:qa-red` a configuration-only alternative.
- **Automatic execution of development:** rejected to preserve the human command boundary between flows.
- **Counter-derived round numbers:** approvals do not increment counters and would allow artifact overwrite after a later regression.
- **Globbed verdict input:** rejected because a retried round could feed its prior verdict back to the judge; the two panel paths are named explicitly.
- **Review-generated task handoff:** requires an unbuilt cross-flow payload and precedence mechanism.
- **A lighter `fix.yaml`:** deferred until measured development rerun cost justifies it.
- **Resetting the review counter to zero:** one retry would restore a full three-regression budget, contradicting “exactly one additional traversal.”
- **Resetting every counter:** would grant unrelated QA loops a new budget.
- **Ordinary `--auto` exhaustion behavior:** bounded subscription spending requires an unavoidable human stop.
- **One `--gate-answer` applied to every gate:** cannot express different answers for exhaustion and the closing gate.
- **Hard-coded `main`:** breaks repositories using a different base branch.
- **Static integrated-diff vendor provenance:** hunk provenance is not statically knowable across flows; a multi-adapter same-role panel is enforceable.
- **Repository-wide template byte identity:** configuration, context, architecture, and developer roles legitimately differ between Quorum and adopter templates.
- **Allowing developers to edit contracts:** would let implementation rewrite the specification it is graded against.
- **Rewriting existing history:** unnecessary for an additive file schema and risky for existing tickets.

## Contracts

All implementation contracts are frozen files under `contracts/Q-0006/`.

| Contract | Kind | Purpose |
| --- | --- | --- |
| `contracts/Q-0006/review-flow.contract.yaml` | YAML flow fixture | Parsed shape of the panel, named verdict inputs, artifacts, threshold, bound, and backward edge. The shipped flow is compared after YAML parsing and removal of loader-only `file`. |
| `contracts/Q-0006/review-artifacts.schema.json` | JSON Schema | Panel and verdict structured output, severity/file-line finding format, and verdict/findings consistency. |
| `contracts/Q-0006/review-runtime.contract.md` | Behavioral interface | Configuration, round calculation, diff materialisation, run preflight, derived regression, exact retry value, repeatable gate answers, audit cost, rework, and failure atomicity. |
| `contracts/Q-0006/review-lint.contract.md` | Static-analysis interface | Shared lint/run preflight, terminating return-chain walk, reached-stage ambiguity, temporary fixtures, bounds, counter spelling, and cross-vendor validation. |
| `contracts/Q-0006/ticket-review-state.schema.json` | Persistence schema | Additive review counter and outcome events, zero-cost exhaustion records, and legacy-history compatibility. No migration rewrite is required. |
| `contracts/Q-0006/code-reviewer-role.contract.md` | Role interface | Model-safe frontmatter, read-only persona, severity taxonomy, citations, and threshold wording. |
| `contracts/Q-0006/mock-adapter-switches.contract.md` | Test-adapter interface | Deterministic pass/fail controls, mutual-exclusion behavior, fallback preservation, and schema-valid mock findings. |

`harness/architecture.md` and the repository/template backend roles were also corrected as repository ownership contracts. They are not mutable implementation contracts for the tasks below.

## QA-red responsibilities

Automation QA owns tests and writes them before implementation. Development tasks must not modify tests or `contracts/Q-0006/**`.

The red suite covers:

- parsed flow parity and byte parity of shipped flow and reviewer-role copies;
- rejected review, derived regression, persisted count 1, and complete round 1;
- no review worktree or branch, and no working-tree change outside `backlog/`;
- stable `review/verdict.md` replacement between rounds;
- full stat, three-dot range, truncation boundary, prompt notice, and `runs.log` notice;
- missing base ref failing before the mock adapter call count changes;
- rework synchronization and return to green;
- round 2 preserving round 1;
- approval reaching reviewed;
- exact three regressions followed by exhaustion on rejection four;
- `--auto` presenting rather than bypassing exhaustion;
- rewriting the existing `spike/test/smoke.js:70-73` assertion to provide an explicit gate answer and assert the D5 behavior for all shipped flows;
- retry persisting `iterations.review = 2`, preserving other counters, granting one regression, then re-presenting exhaustion on the following rejection;
- repeatable gate-answer consumption and non-TTY exhaustion with no answer exiting non-zero rather than blocking;
- advance and abort behavior at exhaustion;
- zero-cost exhaustion history plus one full-cost terminal entry, with board cost counted once;
- invalid target, dead-end, cycle, reached-stage ambiguity, and temporary self-target fixtures failing before ticket writes or adapter calls;
- lint rejection of `counter: iterations.review`, all invalid `max_iterations` forms, and a single-vendor panel;
- `harness init` inside Git, outside Git, and on an unidentifiable unborn branch;
- schema-valid mock `changes-requested` artifacts;
- invalid structured output and asymmetric panel failure preserving stage and counter;
- legacy ticket-schema compatibility and board display of `iterations.review`;
- integration-branch equality of `contracts/Q-0006/**` to the contracts commit;
- existing draft-to-green, API-key refusal, adapter probe, and no-pinned-Codex-model assertions remaining green.

Real-CLI evidence saved in the ticket folder verifies diff delivery and semantic severity behavior that JSON Schema cannot prove.

## Tasks

```yaml
tasks:
  - id: Q0006-mock-switch
    role: backend
    title: Add deterministic schema-valid mock verdict controls
    contracts:
      - contracts/Q-0006/mock-adapter-switches.contract.md
      - contracts/Q-0006/review-artifacts.schema.json
    depends_on: []
    description: >
      Own spike/src/adapters/mock.js only. Add MOCK_ALWAYS_PASS, preserve
      MOCK_ALWAYS_FAIL and fallback call-count behavior, reject both switches together,
      and emit severity/file-line findings for verdict schemas. Do not edit tests or
      contracts/Q-0006/**.

  - id: Q0006-runtime
    role: backend
    title: Implement review execution, persistence, gates, and rework
    contracts:
      - contracts/Q-0006/review-runtime.contract.md
      - contracts/Q-0006/review-artifacts.schema.json
      - contracts/Q-0006/ticket-review-state.schema.json
      - contracts/Q-0006/review-flow.contract.yaml
    depends_on:
      - Q0006-mock-switch
    description: >
      Own spike/src/engine.js, spike/src/backlog.js, spike/src/git.js,
      spike/src/fanout.js, harness/flows/development.yaml, and its template copy.
      Implement variables, diff materialisation, derived regression, exact retry and
      exhaustion semantics, repeatable gate consumption plumbing, atomic panel failure,
      history and cost behavior, worktree synchronization, optional verdict input, and
      CLI-facing regression result fields. Do not edit tests, configuration assets, or
      contracts/Q-0006/**.

  - id: Q0006-cli-lint
    role: backend
    title: Add configuration, explicit gate input, and shared pre-execution lint
    contracts:
      - contracts/Q-0006/review-lint.contract.md
      - contracts/Q-0006/review-runtime.contract.md
      - contracts/Q-0006/review-flow.contract.yaml
      - contracts/Q-0006/ticket-review-state.schema.json
    depends_on:
      - Q0006-runtime
    description: >
      Own spike/bin/harness.js, the lint portion of spike/src/engine.js, any new
      spike/src/lint.js, harness/harness.yaml, and
      spike/templates/harness/harness.yaml. Implement repo defaults, safe init branch
      discovery, repeatable --gate-answer flags, non-TTY errors, run-time preflight,
      terminating chain validation, bound/counter checks, panel validation, and correct
      board cost behavior. This task follows runtime so shared engine edits are serial.
      Do not edit tests or contracts/Q-0006/**.

  - id: Q0006-assets-docs
    role: backend
    title: Ship review assets and align product documentation
    contracts:
      - contracts/Q-0006/review-flow.contract.yaml
      - contracts/Q-0006/code-reviewer-role.contract.md
      - contracts/Q-0006/review-artifacts.schema.json
      - contracts/Q-0006/review-runtime.contract.md
      - contracts/Q-0006/review-lint.contract.md
    depends_on:
      - Q0006-cli-lint
    description: >
      Own harness/flows/review.yaml and its template copy,
      harness/roles/code-reviewer.md and its template copy, README.md,
      docs/02-sdlc-pipeline-spec.md, docs/06-development-plan.md,
      docs/GLOSSARY.md, docs/DECISIONS.md, and ticket-local real-CLI evidence.
      Do not edit harness.yaml, development.yaml, developer roles, tests, or
      contracts/Q-0006/**. Ship byte-identical designated assets and document the
      derived regression rule, three-dot diff, round variable, counter spelling,
      exhaustion behavior across all shipped flows, README command, glossary update,
      and M1 completion condition.
```

The chain is intentionally serial where ownership overlaps. The mock task is independent code, runtime establishes engine behavior, CLI/lint then extends the shared entry points, and assets/docs land against the completed behavior.

## Architecture review resolution

### Blockers

- **B1 — Product-specific backend template:** resolved. The starter template is restored to `services/api` and `packages/domain`; Quorum’s role excludes `contracts/`; `harness/architecture.md` now states the actual byte-sharing rule and explains that role-body prose is the effective allow-list.
- **B2 — Incompatible retry definitions:** resolved. Retry persists `max_iterations - 1`, exactly `2` for the shipped limit. QA asserts that integer, one following regression at count 3, and exhaustion again on the subsequent rejection at count 4.
- **B3 — Mock findings violated schema:** resolved in `mock-adapter-switches.contract.md`; all mock verdict findings use severity and `file:line` form.
- **B4 — Run path lacked preflight:** resolved. `harness run` invokes the complete directory lint before adapter spawn or ticket-folder write. `Q0006-cli-lint` owns the CLI and lint implementation after runtime.
- **B5 — Existing smoke assertion inverted:** resolved. QA must rewrite `spike/test/smoke.js:70-73`, supply an explicit answer, and assert that `--auto` presents exhaustion. Non-TTY input without an answer exits non-zero and never blocks.

### Majors

- **M1 — Missing automated coverage:** resolved by assigning explicit tests for asset parity, read-only operation, stable verdict, diff construction, base-ref preflight, counter spelling, iteration bounds, and single-vendor lint, plus the remaining criteria listed above.
- **M2 — Double-counted exhausted cost:** resolved. Exhaustion presentation has `cost: 0` and unchanged stages; the terminal entry carries full cost once. The persistence schema and board test assert it.
- **M3 — One flag for two gates:** resolved with repeatable `--gate-answer` values consumed in order. Exhausted answers fall back to TTY only; exhaustion on non-TTY without a value is an error.
- **M4 — Init outside Git:** resolved. The template carries `main`; init replaces it only when it can identify a branch and otherwise succeeds with the fallback. QA owns all three contexts.
- **M5 — Developers could rewrite contracts:** resolved. `contracts/` is removed from the backend role, every task forbids edits to `contracts/Q-0006/**`, and QA compares that directory with the contracts commit.

### Minors

- **N1 — Global ambiguity behavior:** resolved. Ambiguity is an error only at stages reached by a checked cross-flow return chain.
- **N2 — Self-target fixture location:** resolved. It is built in a temporary harness directory.
- **N3 — Verdict glob includes itself:** resolved. The flow contract names `claude.md` and `codex.md` explicitly.
- **N4 — Mixed output spellings and typo:** resolved. All panel and verdict outputs use `output.writes`; the fixture comment says “parse to the same value.”
- **N5 — Role frontmatter implied enforcement:** resolved. Architecture documentation states that the engine reads the role body, not `paths` frontmatter, while requiring both to remain consistent.

## Verification

Both JSON Schemas parse successfully and `git diff --check` passes. The contract and role-boundary revisions are present in the isolated contracts worktree.
