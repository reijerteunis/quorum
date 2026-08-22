# Q-0006 — Review flow with cross-flow backward edge

## Chosen approach

Implement review as an ordinary YAML flow using existing parallel steps, structured verdict output, bounded `on_fail`, gates, and `goto: flow:<name>` routing.

Two read-only `code-reviewer` steps run on Claude and Codex against the same harness-materialised three-dot diff. A verdict step reads their named artifacts, deduplicates findings, and applies the severity threshold. Approval advances `green → reviewed`; changes requested increment `iterations.review` and regress to the `consumes` stage loaded from the configured target flow. The target flow is never started automatically.

Review round numbers come from completed artifacts: `{round}` is one plus the greatest `N` for which `review/round-N/verdict.md` exists. A failed round without a verdict reuses its directory; a later review visit cannot overwrite a completed round.

The first three rejected verdicts regress. Rejection four records exhaustion and presents a human gate that `--auto` cannot bypass. `retry` grants exactly one additional regression traversal by persisting `iterations.review = max_iterations`; with the shipped limit this is `3`. The gate answer itself then regresses to development. The next rejection increments the counter to `4` and presents exhaustion again without another regression.

All persistent state remains in ticket files. Invalid output and asymmetric panel failures leave stage and counter unchanged. Existing ticket history remains readable without migration. No dependency is added: the engine and QA implement the relevant schema constraints with explicit dependency-free checks.

## Repository and ownership boundaries

The runnable M1 implementation is the Node spike plus file-backed harness assets, so all implementation tasks use `role: backend`. There is no frontend or data surface.

The Quorum backend role may write `spike/`, `harness/`, `docs/`, `backlog/`, and repository-root Markdown files including `README.md`. It may not write `contracts/Q-0006/**`; those files are frozen at the contracts commit and are the independent specification against which development is tested. The architecture role table and both the backend role's frontmatter and body must contain this same allow-list before development fan-out begins.

Template sharing is explicit:

- All flow files and `roles/code-reviewer.md` are byte-shared between `harness/` and `spike/templates/harness/`.
- `harness.yaml`, `product-context.md`, `rules.md`, `architecture.md`, and developer roles are repository-specific.
- The starter template’s backend role retains adopter paths (`services/api`, `packages/domain`) and must not contain Quorum’s `spike/` layout.

The engine does not enforce role `paths` frontmatter. The allow-list reaches agents through role-body prose, so frontmatter and prose must agree and tasks still assign exact file ownership.

All tasks deliberately remain on the existing Codex-backed backend role. This dogfood development run is therefore single-vendor and serial; cross-vendor development fan-out is not an acceptance criterion for Q-0006. The review panel itself is cross-vendor as required.

`harness/architecture.md` contains the role table and template-sharing boundary required by this ticket. Its remaining shape, general boundary, contract-convention, tooling, and recurring-mistake sections are still placeholder prose and are not authoritative inputs for unrelated future solutioning. Completing that repository-wide architecture inventory is a separate task.

## Runtime design

### Flow and artifacts

`review.yaml` uses only engine-supported fields:

1. A parallel Claude/Codex panel writes `review/round-{round}/claude.md` and `review/round-{round}/codex.md`.
2. A verdict step reads those two named files, `requirements/merged.md`, and `solution/solution.md`. Named files prevent an old `verdict.md` from becoming panel input on retry.
3. The verdict writes `review/round-{round}/verdict.md` and stable `review/verdict.md`.
4. `changes-requested` follows `goto: flow:development`, bounded by `counter: review` and `max_iterations: 3`.
5. The ordinary closing human gate follows approval.

The panel steps contain no step-local `instructions`; reviewer severity, citations, and read-only behaviour come from `roles/code-reviewer.md`. The verdict step's literal instructions define deduplication and threshold application. QA therefore checks panel guidance against the role text and verdict behaviour against the verdict-step instructions.

Nits alone approve. Any surviving blocker or major requests changes. Findings use `severity: file:line description`; an approving verdict has no findings.

### Executable structured-output contracts

`review-artifacts.schema.json` governs the complete structured `output` object returned by an adapter, including `document`. It does not govern the reduced `.harness/<step-id>-verdict.json` diagnostic file, which continues to persist only the verdict fields used by the existing engine. QA calls `mockAdapter().run()` directly and checks the returned object against the contract.

No JSON Schema validator dependency is added. Instead, the schema remains the independent declarative contract and the implementation provides dependency-free checks for every behaviourally relevant clause:

- required keys and permitted verdict values;
- finding item type and the `^(blocker|major|nit): .+:[1-9][0-9]* .+` format;
- `approve` requiring zero findings;
- `changes-requested` requiring at least one finding;
- rejection of unknown structured verdict fields where the contract disallows them.

These checks run on every adapter's returned structured output, including real Claude and Codex output, before artifacts, counters, or stages are committed. An `approve` response with findings or any malformed citation follows the existing invalid-output failure path: raw output is retained under the ticket's `.harness/` directory, and stage and counter remain unchanged.

`ticket-review-state.schema.json` governs the parsed ticket state, including `iterations.review` and legacy or outcome-aware history entries. QA implements its relevant clauses directly: review counters are non-negative integers; each history entry matches either the legacy or new shape; new review outcomes contain the required run, flow, status, stages, timestamp, and cost fields; exhaustion-presentation entries have `cost === 0`; and unknown legacy tickets remain readable without rewriting. The schema files are parsed in tests as an additional syntax check, but parsing alone is not presented as contract execution.

### Diff materialisation

At review-run start the engine populates `{base}` from the resolved `repo.base_branch` value and `{round}` from completed verdict artifacts. `{base}` is populated before ref validation or interpolation, so a missing base cannot leak into Git as the literal range `{base}...harness/<id>/integration`.

Before any adapter spawn, the engine verifies the configured base and integration refs. It embeds:

- the complete stat for `<base>...harness/<id>/integration`;
- the patch for that three-dot range, truncated by UTF-8 bytes at `repo.max_diff_bytes`;
- an explicit truncation notice in the prompt and `runs.log` when applicable.

Reviewers receive no worktree and run with `allowWrite: false`. They create no branch or worktree.

The template configuration contains:

```yaml
repo:
  base_branch: main
  max_diff_bytes: 200000
```

`harness init` replaces `base_branch` when Git can identify the current branch. Outside Git or on an unidentifiable unborn branch, it keeps `main` and succeeds. A missing resolved base ref fails before an adapter runs and names `repo.base_branch`, `harness/harness.yaml`, and the ref. A missing integration ref names the ticket and expected integration branch.

### Routing, counters, and gates

Before any ticket-folder write or `adapter.run`, `harness run` performs the same complete flow-directory validation as `harness lint`. This preflight loads pristine flow files from disk before any in-memory `--adapter mock` override is applied. Runtime target loading remains a defensive check, not the first discovery point.

On an accepted `changes-requested` verdict:

- structured output is validated first;
- `iterations.review` increments exactly once;
- counts 1–3 load the target flow and regress to its `consumes` stage;
- the run persists and finishes as `regressed` without starting the target flow;
- the CLI reports target flow, stage before and after, count, limit, and remaining traversals.

Count 4 stays at `green`, records exhaustion, and presents the gate. `--auto` cannot answer it.

`--gate-answer` is repeatable and values are consumed in encounter order. This permits exhaustion `advance` followed by closing-gate `abort`. When explicit values run out, the CLI may read a TTY. On non-TTY stdin, or for empty, missing, or invalid input, it exits non-zero with an error naming the gate; it neither blocks nor defaults.

Gate outcomes are:

- `advance`: accept the current diff and continue toward `reviewed`;
- `retry`: persist only `iterations.review = max_iterations`, log the reset, and immediately regress to the configured target, granting exactly that regression traversal; with the shipped limit the persisted value is `3`, and the next rejected review increments to `4` and presents exhaustion again;
- `abort`: finish with the stage unchanged.

Other counters, including `iterations.qa`, are never reset. An exhaustion `advance` also leaves `iterations.review` at `4`. Consequently, if a later flow regresses the ticket and review is revisited, its first rejected verdict presents exhaustion immediately. This persistent lifetime budget is intentional for M1; granting a fresh review budget requires a future explicit policy rather than an implicit reset.

### Audit and cost

Every outcome is recorded in `runs.log` and ticket history with run id, flow, status, stage before and after, timestamp, and cost.

An exhaustion-presentation entry has unchanged `stage_before` and `stage_after` and `cost: 0`. The later terminal entry for that run carries the full measured cost exactly once, so `harness board` does not double-count it.

Legacy `{stage, run, flow, at, cost}` entries remain valid and are not rewritten.

### Failure containment

Invalid structured output is saved under the ticket’s `.harness/` directory and ends as `failed` without changing stage or counter. This includes verdict/findings inconsistency and malformed severity or `file:line` citations from real vendors.

Parallel review uses all-settled behavior. A successful reviewer artifact is retained if its sibling fails, but the verdict does not run and neither stage nor counter changes.

The mock adapter’s forced and fallback `changes-requested` verdicts emit schema-valid findings such as `major: src/mock.ts:1 (mock) placeholder finding`.

### Rework

At the beginning of every development fan-out task, an existing task worktree merges `harness/<id>/integration`, including the first iteration of a new development run. Conflicts produce a warning naming the task and paths.

Development inputs include optional `review/verdict.md`. Its absence during an initial pass remains valid.

## Lint design

Both `harness lint` and the preflight used by `harness run` load the complete flow directory from disk. Adapter overrides used for mock execution occur only after validation and cannot turn a valid cross-vendor source flow into a false single-vendor lint failure.

For every `goto: flow:<target>` they:

- require a loadable target flow;
- walk from the target’s `produces` stage through matching consumers until returning to the source flow’s `consumes` stage;
- retain a visited set of `(flow, stage)` pairs;
- report missing targets, reached-stage dead ends, reached-stage ambiguity, and cycles with source flow, target flow, and terminal stage.

Ambiguity is an error only for a stage reached by the checked return chain; unrelated multi-consumer stages remain legal. Self-target and malformed fixtures live in temporary harness directories and never contaminate shipped flows.

Lint also rejects:

- missing, non-integer, zero, or negative `max_iterations`;
- counters prefixed with `iterations.`, suggesting the unprefixed spelling;
- same-role parallel panels using only one adapter in `cross_vendor: required` flows.

## Rejected alternatives

- **New `judge` step type:** existing verdict output supports the behavior.
- **Hard-coded regression stage:** the target flow’s `consumes` field is authoritative and makes `flow:qa-red` a configuration-only alternative.
- **Automatic target-flow execution:** rejected to preserve the human command boundary.
- **Counter-derived round numbers:** approvals do not increment counters and would permit artifact overwrite after a later regression.
- **Globbed verdict input:** could feed a prior verdict back to the judge; panel paths are named explicitly.
- **Review-generated task handoff:** requires an unbuilt cross-flow payload and precedence mechanism.
- **A lighter `fix.yaml`:** deferred until measured rerun cost justifies it.
- **Setting retry to `max_iterations - 1`:** the gate-triggered regression plus the next within-budget rejection would grant two traversals, violating the one-traversal safety requirement.
- **Resetting the review counter to zero:** would restore a full three-regression budget instead of authorising one traversal.
- **Resetting every counter:** would grant unrelated QA loops a new budget.
- **Ordinary `--auto` exhaustion behavior:** bounded subscription spending requires an unavoidable human stop.
- **One gate answer applied to every gate:** cannot express different exhaustion and closing-gate answers.
- **Hard-coded `main`:** breaks repositories using another base branch.
- **Static integrated-diff vendor provenance:** hunk provenance is not statically knowable across flows; a multi-adapter same-role panel is enforceable.
- **Repository-wide template byte identity:** configuration, architecture, context, and developer roles legitimately differ between Quorum and adopter templates.
- **Allowing developers to edit contracts:** would let implementation rewrite the specification it is graded against.
- **Rewriting existing history:** unnecessary for an additive schema and risky for existing tickets.
- **Adding a general JSON Schema validator:** the spike currently has no validator infrastructure; the small fixed set of M1 invariants can be enforced explicitly without expanding runtime dependencies. The schema remains the frozen declarative specification and tests enumerate every implemented clause.
- **Validating reduced verdict diagnostics as full adapter output:** `.harness/<step-id>-verdict.json` intentionally omits `document`; its shape is not the subject of `review-artifacts.schema.json`.
- **Automating real-CLI evidence in fan-out:** it would be nondeterministic, subscription-consuming, and incompatible with BYOS test isolation.

## Contracts

All implementation contracts are frozen files under `contracts/Q-0006/`.

| Contract | Kind | Purpose |
| --- | --- | --- |
| `contracts/Q-0006/review-flow.contract.yaml` | YAML flow fixture | Parsed shape of the panel, named verdict inputs, artifacts, threshold, bound, and backward edge. The shipped flow is compared after YAML parsing and removal of loader-only `file`. |
| `contracts/Q-0006/review-artifacts.schema.json` | JSON Schema | Adapter-returned panel and verdict structured output, severity/file-line finding format, and verdict/findings consistency. It does not describe the reduced `.harness/<step-id>-verdict.json` diagnostic. |
| `contracts/Q-0006/review-runtime.contract.md` | Behavioral interface | Configuration, round calculation, diff materialisation, run preflight from disk, derived regression, exact retry value, repeatable gate answers, real-vendor output validation, audit cost, rework, and failure atomicity. |
| `contracts/Q-0006/review-lint.contract.md` | Static-analysis interface | Shared lint/run preflight, terminating return-chain walk, reached-stage ambiguity, temporary fixtures, bounds, counter spelling, and cross-vendor validation. |
| `contracts/Q-0006/ticket-review-state.schema.json` | Persistence schema | Parsed ticket state, additive review counter and outcome events, zero-cost exhaustion records, and legacy-history compatibility. No migration rewrite is required. |
| `contracts/Q-0006/code-reviewer-role.contract.md` | Role interface | Model-safe frontmatter, read-only persona, severity taxonomy, citations, and threshold wording. |
| `contracts/Q-0006/mock-adapter-switches.contract.md` | Test-adapter interface | Deterministic pass/fail controls, mutual-exclusion behavior, fallback preservation, and schema-valid mock findings. |

The JSON Schema contracts are executed without a new dependency: production performs the explicitly enumerated review-output invariants, and QA performs clause-by-clause assertions for adapter output and ticket state. Both schema files must also parse successfully.

`harness/architecture.md` and the repository/template backend roles were corrected as repository ownership contracts. They are not mutable implementation contracts for the tasks below.

## QA-red responsibilities

Automation QA owns tests and writes them before implementation. Development tasks must not modify tests or `contracts/Q-0006/**`.

The red suite covers:

- parsed flow parity and byte parity of shipped flow and reviewer-role copies;
- rejected review, derived regression, persisted count 1, and complete round 1;
- no review worktree or branch and no working-tree change outside `backlog/`;
- stable `review/verdict.md` replacement between rounds;
- full stat, three-dot range, truncation boundary, prompt notice, and `runs.log` notice;
- `{base}` population before ref validation and interpolation;
- missing base ref failing before the mock adapter call count changes;
- rework synchronization and return to green;
- round 2 preserving round 1;
- approval reaching reviewed;
- exactly three regressions followed by exhaustion on rejection four;
- `--auto` presenting rather than bypassing exhaustion;
- rewriting `spike/test/smoke.js:70-73` to supply an explicit gate answer and assert D5 behavior for all shipped flows;
- retry persisting `iterations.review = 3`, preserving other counters, granting the immediate gate-triggered regression, then re-presenting exhaustion on the next rejection;
- repeatable gate-answer consumption and non-TTY exhaustion without an answer exiting non-zero rather than blocking;
- advance and abort behavior at exhaustion;
- an exhaustion `advance` retaining count 4 and a later review rejection immediately re-presenting exhaustion;
- zero-cost exhaustion history plus one full-cost terminal entry, with board cost counted once;
- invalid target, dead-end, cycle, reached-stage ambiguity, and temporary self-target fixtures failing before ticket writes or adapter calls;
- run preflight loading pristine flow files from disk before `--adapter mock` overrides;
- lint rejection of `counter: iterations.review`, every invalid `max_iterations` form, and a single-vendor panel;
- `harness init` inside Git, outside Git, and on an unidentifiable unborn branch;
- direct validation of `mockAdapter().run()` output against every relevant `review-artifacts.schema.json` clause;
- schema-valid mock `changes-requested` artifacts;
- real-vendor-shaped `approve` plus findings and malformed citations following the invalid-output path;
- invalid structured output and asymmetric panel failure preserving stage and counter;
- clause-by-clause legacy/new ticket-history discrimination, non-negative review counters, required new outcome fields, and zero-cost exhaustion records;
- legacy ticket-schema compatibility and board display of `iterations.review`;
- literal panel guidance in `code-reviewer.md` and literal threshold instructions in the verdict step;
- both JSON Schema files parsing successfully;
- integration-branch equality of `contracts/Q-0006/**` to the contracts commit;
- existing draft-to-green, API-key refusal, adapter probe, exhaustion, and no-pinned-Codex-model assertions remaining green.

No automated test asserts the presence of real-CLI evidence. At the closing human gate, the maintainer runs the first real `harness run review <id>` and saves ticket-local evidence for diff delivery and semantic severity behavior. This is a manual acceptance action because it uses paid vendor CLIs and must not run inside development fan-out or the deterministic regression suite.

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
      exhaustion semantics, dependency-free verdict/findings validation for all adapters,
      atomic panel failure, history and cost behavior, worktree synchronization, optional
      verdict input, and CLI-facing regression result fields. Do not edit tests,
      configuration assets, or contracts/Q-0006/**.

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
      discovery, repeatable --gate-answer flags, non-TTY errors, run-time preflight from
      pristine flow files on disk before adapter overrides, terminating chain validation,
      bound/counter checks, panel validation, and correct board cost behavior. This task
      follows runtime so shared engine edits are serial. Do not edit tests or
      contracts/Q-0006/**.

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
      docs/GLOSSARY.md, docs/DECISIONS.md, and the body only of
      backlog/Q-0006-review-flow-and-cross-flow-backward-edge/ticket.md; the engine owns
      ticket frontmatter. Do not edit harness.yaml, development.yaml, developer roles,
      tests, contracts/Q-0006/**, or create real-CLI evidence. Ship byte-identical
      designated assets and document the derived regression rule, three-dot diff, round
      variable, counter spelling, exhaustion behavior across all shipped flows, README
      command, glossary update, ticket-body correction, and M1 completion condition.
```

The chain is intentionally serial where ownership overlaps. The mock task establishes deterministic output, runtime establishes engine behavior, CLI/lint extends the shared entry points, and assets/docs land against completed behavior.

Real-CLI evidence is not a fan-out task. It is a maintainer action at the closing human gate after the implementation tasks have merged.

## Architecture review resolution

### Round 3 blockers

- **B1 — Retry was off by one:** resolved. `retry` now persists `iterations.review = max_iterations`, exactly `3` for the shipped limit. The gate answer performs the one authorised regression; the next rejection increments to `4` and re-presents exhaustion. QA asserts both the persisted integer and the exact traversal count.
- **B2 — Schema contracts were not executable:** resolved without adding a dependency. `review-artifacts.schema.json` governs complete adapter-returned output, not the reduced verdict diagnostic. Production validates verdict/finding consistency and citation format for mock and real vendors. `ticket-review-state.schema.json` governs parsed ticket state. QA enumerates and executes the relevant clauses directly, while also checking that both schemas parse.

### Round 3 majors

- **M1 — README was outside the backend allow-list:** resolved. Repository-root Markdown, including `README.md`, is added to the Quorum backend architecture table and role frontmatter/body. The adopter template role remains unchanged.
- **M2 — Real-CLI evidence was assigned to fan-out:** resolved. Evidence is a maintainer action at the closing human gate, and no automated test asserts its presence.

### Round 3 minors

- **N1:** run preflight reloads pristine flow files from disk before adapter overrides.
- **N2:** `Q0006-assets-docs` owns only the body of the ticket file required for the D1 correction; engine-owned frontmatter is excluded.
- **N3:** QA checks reviewer guidance in the role body and verdict threshold wording in the verdict step; panel steps intentionally have no local instructions.
- **N4:** exhaustion `advance` retains count 4, so a later rejected review immediately exhausts; this is an explicit M1 lifetime-budget decision.
- **N5:** `{base}` is populated before ref checking and interpolation.

### Round 2 blockers

- **B1 — Product-specific backend template:** resolved. The starter template retains `services/api` and `packages/domain`; Quorum’s role excludes `contracts/`; `harness/architecture.md` states the actual byte-sharing rule and effective role-body allow-list.
- **B2 — Incompatible retry definitions:** superseded by round 3's arithmetic correction. The final rule persists the limit value, `3`, and grants exactly one traversal.
- **B3 — Mock findings violated schema:** resolved in `mock-adapter-switches.contract.md`; all mock verdict findings use severity and `file:line` form.
- **B4 — Run path lacked preflight:** resolved. `harness run` invokes complete on-disk directory validation before adapter spawn or ticket-folder write. `Q0006-cli-lint` owns it.
- **B5 — Existing smoke assertion inverted:** resolved. QA rewrites `spike/test/smoke.js:70-73`, supplies an explicit answer, and asserts that `--auto` presents exhaustion. Non-TTY input without an answer exits non-zero.

### Round 2 majors

- **M1 — Missing automated coverage:** resolved by the complete QA-red list, including parity, read-only behavior, stable verdict, diff construction, base-ref preflight, counter spelling, bounds, and single-vendor lint.
- **M2 — Double-counted exhausted cost:** resolved with a zero-cost exhaustion event and one full-cost terminal event; board cost is tested.
- **M3 — One flag for two gates:** resolved with repeatable `--gate-answer` values consumed in order.
- **M4 — Init outside Git:** resolved. The template carries `main`; init replaces it only when it identifies a branch and otherwise succeeds with the fallback.
- **M5 — Developers could rewrite contracts:** resolved. `contracts/` is excluded from the backend role, every task freezes `contracts/Q-0006/**`, and QA compares it with the contracts commit.

### Round 2 minors

- **N1:** ambiguity fails only at stages reached by a checked cross-flow chain.
- **N2:** self-target fixtures are created in a temporary harness directory.
- **N3:** verdict inputs name `claude.md` and `codex.md` instead of globbing.
- **N4:** all outputs use `output.writes`; the fixture comment is grammatically corrected.
- **N5:** architecture documentation states that the engine reads role-body prose, not `paths` frontmatter.

### Round 1 findings

- **B1:** Quorum’s backend role is widened only in the repository; the adopter template is preserved, ownership is documented, and contracts are excluded.
- **B2:** regression-suite work belongs to QA-red; the production mock switch is a separate dependency-free development task.
- **B3:** overlapping runtime and CLI/lint work is serialized, while each configuration and flow asset has one owner.
- **B4:** the ticket-state schema accepts legacy history and new outcome entries without rewriting existing tickets.
- **M1:** every terminal outcome reaches history; exhaustion is recorded when its gate is presented.
- **M2:** the reviewer-role contract requires model-safe frontmatter, taxonomy, citations, and read-only behavior.
- **M3:** the runtime contract names all CLI regression-report fields and assigns them to runtime/CLI work.
- **M4:** severity testing is split honestly between literal role/flow instructions, explicit structured-output checks, deterministic mock fixtures, and saved real-CLI evidence.
- **M5:** cross-flow lint has a visited set, reached-stage ambiguity handling, named errors, and a temporary self-target negative fixture.
- **Minor 10:** board requires no production formatting change; QA asserts `iterations.review` appears.
- **Minor 11:** missing integration-ref error text is specified alongside the base-ref error.
- **Minor 12:** flow equality is defined as YAML parse, removal of loader-only `file`, and deep equality.
- **Minor 13:** the single-vendor backend dogfood decision is stated explicitly above.
- **Minor 14:** the unresolved placeholder sections of `harness/architecture.md` are identified above as a known repository gap.

## Verification

Both JSON Schemas must parse successfully. QA executes every behaviourally relevant schema clause through explicit assertions, and production applies the verdict consistency and citation checks to all adapters. `git diff --check` must pass. The contract fixture comment is corrected in `contracts/Q-0006/review-flow.contract.yaml`.
