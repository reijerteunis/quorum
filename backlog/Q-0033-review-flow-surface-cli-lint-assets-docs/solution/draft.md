# Q-0033 — Review flow surface: CLI, lint, config, shipped assets and docs

## Chosen approach

Treat Q-0033 as the surface implementation of Q-0006’s merged review engine. Q-0033 ships the files humans and flow authors touch, adds shared whole-directory validation at the CLI boundary, and aligns documentation. It does not change review-engine behavior or edit the frozen Q-0006 contracts.

The implementation has three boundaries:

1. **Shipped assets:** add the frozen review flow and reviewer role to the repository and adopter template, with explicit byte-parity tests.
2. **CLI, config, and lint:** add configuration defaults and safe initialization, one whole-directory validator shared by `lint` and `run`, and ordered explicit gate answers.
3. **Documentation and evidence:** update specifications and decisions to describe the shipped behavior; automated evidence belongs to qa-red, while real-vendor evidence remains a maintainer action at the closing gate.

Use the repository’s existing Node 20 ESM spike, `yaml` package, synchronous file operations, Git subprocess conventions, and mock-adapter test runner. No dependency, migration, UI, service, or new engine feature is introduced.

### Contract precedence

The implementation consumes these Q-0006 contracts unchanged:

- `contracts/Q-0006/review-flow.contract.yaml`
- `contracts/Q-0006/code-reviewer-role.contract.md`
- `contracts/Q-0006/review-lint.contract.md`
- `contracts/Q-0006/review-runtime.contract.md`
- `contracts/Q-0006/review-artifacts.schema.json`
- `contracts/Q-0006/ticket-review-state.schema.json`
- `contracts/Q-0006/mock-adapter-switches.contract.md`

Q-0006 `solution/errata.md` E-1 supersedes the frozen runtime contract’s retry-value clause: retry persists `iterations.review = max_iterations`, which is `3` for the shipped flow. Q-0033’s CLI contract repeats that value literally so task and qa-red prompts cannot accidentally implement or test the superseded value `2`.

## Detailed design

### Shipped flow and role

Create `harness/flows/review.yaml` from `contracts/Q-0006/review-flow.contract.yaml` and copy it byte-for-byte to `spike/templates/harness/flows/review.yaml`. Tests compare every filename and byte sequence across the two flow directories. They also parse the review flow and deep-compare it with the frozen fixture after removing the loader-only `file` property.

Create `harness/roles/code-reviewer.md` and its byte-identical template peer. Compare only this designated shared role because repository and adopter developer roles intentionally differ. The role has no `adapter` or `model` frontmatter, is read-only, uses exactly the three established severities, and requires `file:line` citations. Severity threshold policy remains in the verdict step rather than the role.

The shipped flow contains only fields already supported by the engine. Qa-red proves that the actual asset executes under the frozen mock switches in both directions: `green → red` via the derived target flow under `MOCK_ALWAYS_FAIL`, and `green → reviewed` under `MOCK_ALWAYS_PASS`.

### Configuration and init

Add the commented `repo.max_diff_bytes: 200000` key to `harness/harness.yaml` and `spike/templates/harness/harness.yaml`, retaining their existing commented `repo.base_branch` declarations. Both inputs remain optional at runtime and resolve to `main` and `200000` when omitted.

After `init` copies the template, ask Git for the named current branch in the target directory. A named branch is used even when HEAD is unborn; for example, a fresh `git init -b master` produces `base_branch: master`. Detached HEAD, a non-repository directory, and an unborn or other HEAD that Git cannot name retain `main`. Git failure is best-effort, suppresses Git diagnostics, and never makes `init` fail.

Update only the copied `repo.base_branch` scalar while preserving comments and formatting. Use `YAML.parseDocument` plus `setIn` and `toString`, or an equally narrow textual replacement. A parsed-value comparison is insufficient because it would permit stripping the new repository comments and the existing `commands.install` rationale.

### Shared lint and run preflight

Introduce one whole-directory validation operation, preferably in `spike/src/lint.js`, rather than extending isolated `loadFlow` calls with hidden cross-file state. It loads every `harness/flows/*.yaml` file from disk, retains structural validation, indexes flows by name and consumed stage, and returns diagnostics grouped by source flow.

For every `goto: flow:<target>` edge, the validator:

1. resolves the target to a loadable flow;
2. starts at the target flow’s `produces` stage;
3. follows the unique flow consuming each reached stage until the source flow’s `consumes` stage is reached; and
4. tracks `(flow, stage)` pairs to terminate cycles.

Missing targets, unloadable targets, reached dead ends, reached-stage ambiguity, and repeated pairs fail. Ambiguity is evaluated only for a stage reached by this walk, so unrelated branching elsewhere remains legal. Diagnostics name the source flow, target flow, terminal stage, and implicated flows for ambiguity or cycles.

The same operation validates:

- `max_iterations` as an integer greater than zero;
- `counter` as a non-empty unprefixed key, including a correction from `iterations.review` to `review`; and
- every same-role parallel group of two or more steps in a `cross_vendor: required` flow as spanning at least two declared adapters.

`harness lint` validates the complete directory, reports all offending flows, and exits non-zero once. `harness run` performs the identical validation before loading or writing the ticket, appending `runs.log`, calling an adapter, or applying an in-memory `--adapter` override. Validating pristine files first preserves legitimate cross-vendor declarations when execution later overrides every adapter with `mock`.

### Gate answers

Only `--gate-answer` becomes accumulating and repeatable; all other flags keep their current last-wins behavior. Gate answers are consumed once each in encounter order. The accepted normalized values are exactly `advance`, `retry`, and `abort`, further restricted to the options offered by the encountered gate.

After explicit answers are exhausted, prompting is permitted only on a TTY. Non-TTY input and missing, empty, or invalid answers fail immediately with a diagnostic naming the gate. No path defaults to `advance`. `--auto` remains a run policy and does not manufacture an answer for an exhaustion gate.

At exhaustion, `retry` persists only `iterations.review = 3` for the shipped bound, per Q-0006 errata E-1.

### Documentation

Update the following files in the same change as the assets:

- `docs/02-sdlc-pipeline-spec.md`: derived rejection target, three-dot diff direction, `{round}`, unprefixed counter, supported flow fields, configured base, size limit, exhaustion behavior, and no lighter M1 fix flow.
- `docs/06-development-plan.md`: split ownership between Q-0006 and Q-0033 and the shipped-surface M1 completion condition.
- `docs/DECISIONS.md`: append decisions for derived regression and the non-auto exhaustion gate using the required decision format.
- `docs/GLOSSARY.md`: distinguish author-declared `human-locked` deploy gates from engine-presented exhaustion gates using the same kind.

README remains outside scope because Q-0028 owns the first-run rewrite.

## Ownership and sequencing

Development fan-out contains two backend tasks. Their descriptions assign every writable file explicitly because the backend role’s directory allowance is intentionally broad.

The tasks remain serialized, matching the inherited pre-split ordering: `Q0033-assets-docs` follows `Q0033-cli-lint-config`. Their production files are disjoint, but the assets task ships the first real flow consumed by the validator and its completion evidence includes linting that asset. Serial execution preserves the previously settled CLI-before-assets boundary and avoids parallel integration diagnosing a temporarily absent review flow.

Neither task may edit tests. Qa-red owns `spike/test/**` and writes the red coverage from the contracts and verification checklist before development. Neither task may create real-CLI evidence; that subscription-consuming action belongs to the maintainer at the closing gate.

## Rejected alternatives

- **Re-cutting or correcting Q-0006 contracts:** rejected because this ticket consumes the immutable Q-0006 baseline. The retry contradiction already has a dated erratum, which is delivered alongside every task that consumes the runtime contract.
- **Putting contract tests in `solution/tasks.yaml`:** rejected because that file drives the development flow, whose agents must not edit tests and whose integration expects green. Red tests belong to qa-red.
- **Putting real-CLI evidence in `solution/tasks.yaml`:** rejected because fan-out must not spend subscriptions or fabricate evidence it cannot obtain interactively. It is a closing-gate checklist action.
- **Running the two implementation tasks in parallel:** rejected despite disjoint production ownership because the inherited ordering deliberately puts shared validation before the shipped flow it validates. Serialization also yields clearer integration evidence.
- **Per-file lint only:** rejected because target resolution, return reachability, and reached-stage ambiguity require the complete flow set.
- **Validating after `--adapter mock`:** rejected because a valid cross-vendor panel would appear single-vendor after the override.
- **Preflight after ticket loading or logging:** rejected because invalid flow configuration must result in zero ticket writes and zero adapter calls.
- **Global ambiguity rejection:** rejected because multiple consumers are relevant only when a checked return chain reaches their stage.
- **Traversal without a `(flow, stage)` visited set:** rejected because cross-flow cycles could hang lint.
- **General array-valued flag parsing:** rejected because only `--gate-answer` is repeatable; changing flags such as `--adapter` to arrays would break existing consumers.
- **Empty input, prefixes, or `--auto` as gate decisions:** rejected because gate choices may never be silently invented.
- **`YAML.parse` followed by `YAML.stringify` during init:** rejected because it discards comments and formatting while still passing parsed-value tests.
- **Always falling back for unborn HEAD:** rejected because Git can report the branch name of a fresh unborn repository, and ignoring it breaks non-`main` cold clones.
- **Discovering remote HEAD:** rejected for M1 because the accepted contract uses the current branch and remote inference adds policy and failure cases.
- **Directory-wide role parity:** rejected because repository-specific developer roles intentionally differ from adopter templates.
- **A config migration:** rejected because both inputs are optional and already have runtime defaults.
- **Changing `harness board`:** rejected because existing rendering satisfies the requirement; only regression evidence is needed.
- **Failing the frozen-input guard with raw Git output in a shallow clone:** rejected because an unavailable baseline is not evidence of drift. The guard skips with an explicit reason naming `5d16e06` when that commit is unreachable.
- **Updating README:** rejected because Q-0028 owns the coherent first-run path.

## Contracts

The following contracts were created as files under `contracts/Q-0033/`:

| Contract | Kind | Purpose |
| --- | --- | --- |
| `contracts/Q-0033/review-surface-assets.contract.md` | Shipped-asset interface | Selects the frozen flow and role shapes, defines flow-directory and designated-role parity, and specifies the Q-0006 frozen-input guard including shallow-clone behavior. |
| `contracts/Q-0033/cli-review-surface.contract.md` | CLI, configuration, and static-analysis interface | Defines defaults, comment-preserving init discovery, shared lint/run preflight, graph diagnostics, bound/counter/panel validation, scoped ordered gate answers, retry value `3`, and board compatibility. |
| `contracts/Q-0033/documentation-and-evidence.contract.md` | Documentation and acceptance-evidence interface | Names documentation changes, qa-red coverage including both mock traversals and comment preservation, and the manual real-CLI closing record. |

No schema, API definition, typed stub, or migration skeleton was created. Q-0033 adds optional file-backed configuration but no persisted ticket shape. The existing Q-0006 JSON Schemas remain the review artifact and ticket-state contracts.

## Verification

### Qa-red guidance

Before development fan-out, qa-red adds deterministic coverage for:

- byte parity of all shipped flow files and the designated reviewer role;
- parsed equality of the shipped review flow with the frozen fixture;
- `green → red` under `MOCK_ALWAYS_FAIL` and `green → reviewed` under `MOCK_ALWAYS_PASS`;
- branch discovery on a non-`main` named branch, including a named unborn branch;
- fallback outside Git and for unnameable HEAD;
- preservation through `init` of the existing `commands.install` comment and the new repository comments;
- all positive and negative whole-directory graph fixtures;
- bound, counter, and single-vendor panel failures;
- identical lint/run diagnostics and zero preflight side effects;
- pristine validation before mock override;
- two ordered gate answers, invalid and missing non-TTY answers, and `--auto` exhaustion protection;
- exhaustion retry persisting `iterations.review = 3`;
- unchanged board counter and cost behavior;
- existing API-key refusals and no-pinned-Codex-model behavior; and
- the frozen Q-0006 guard, skipping with a named reason if `5d16e06` is unavailable.

The integrated suite must pass with:

```sh
npm test --prefix spike
npm run lint --prefix spike
```

### Closing-gate checklist

After automated integration, the maintainer runs the first real `harness run review Q-0006` using authenticated Claude Code and Codex CLIs. The maintainer records in Q-0033’s ticket folder that both reviewers received the harness-materialized diff under plan/read-only sandbox and that the verdict applied the severity threshold. This action is never delegated to development fan-out and is never automated.

## Review finding disposition

- **B1:** removed the development contract-test task; assigned red coverage to qa-red and prohibited both implementation tasks from editing tests.
- **B2:** removed the real-CLI fan-out task; made it an explicit maintainer closing-gate action and prohibited implementation tasks from creating that evidence.
- **B3:** restored concrete ownership and prohibitions in both task descriptions and retained the inherited serialization with an explicit rationale.
- **M1:** added the mock-switch contract to both relevant task contract sets and added both expected end-to-end terminal paths to automated evidence.
- **M2:** clarified that a nameable unborn HEAD is a discovery success and only an unnameable HEAD falls back.
- **M3:** required comment- and formatting-preserving initialization and named a surviving comment in qa-red evidence.
- **M4:** stated the persisted retry value `3` literally and attached Q-0006 errata E-1 to every task consuming the frozen runtime contract.
- **N1:** scoped accumulation to `--gate-answer`; all other flags remain last-wins.
- **N2:** specified a named skip when the frozen baseline is unreachable in a shallow clone.

## Tasks

```yaml
- id: Q0033-cli-lint-config
  role: backend
  title: Implement config init shared preflight lint and explicit gate answers
  description: >
    Own spike/bin/harness.js, the lint portion of spike/src/engine.js, any new
    spike/src/lint.js, harness/harness.yaml, and
    spike/templates/harness/harness.yaml. Implement optional repo defaults,
    comment-preserving safe init branch discovery including nameable unborn HEAD,
    repeatable --gate-answer only, non-TTY gate errors, whole-directory run preflight
    from pristine flow files before adapter overrides, terminating return-chain
    validation, bound and counter checks, cross-vendor panel validation, and board
    compatibility. Do not edit tests, shipped review flow or role assets, documentation,
    contracts/Q-0006/**, or create real-CLI evidence.
  contracts:
    - contracts/Q-0033/cli-review-surface.contract.md
    - contracts/Q-0033/documentation-and-evidence.contract.md
    - contracts/Q-0006/review-lint.contract.md
    - contracts/Q-0006/review-runtime.contract.md
    - contracts/Q-0006/review-flow.contract.yaml
    - contracts/Q-0006/ticket-review-state.schema.json
    - contracts/Q-0006/mock-adapter-switches.contract.md
    - backlog/Q-0006-review-flow-and-cross-flow-backward-edge/solution/errata.md
  depends_on: []

- id: Q0033-assets-docs
  role: backend
  title: Ship review assets and align product documentation
  description: >
    Own harness/flows/review.yaml and spike/templates/harness/flows/review.yaml,
    harness/roles/code-reviewer.md and
    spike/templates/harness/roles/code-reviewer.md,
    docs/02-sdlc-pipeline-spec.md, docs/06-development-plan.md,
    docs/GLOSSARY.md, and docs/DECISIONS.md. Ship byte-identical designated assets
    matching the frozen contracts and document the derived regression rule, three-dot
    diff, round variable, counter spelling, configured base and size limit, exhaustion
    behavior, split M1 ownership, gate vocabulary, and no lighter M1 fix flow. Do not
    edit README.md, harness.yaml, development.yaml, developer roles, tests,
    contracts/Q-0006/**, or create real-CLI evidence.
  contracts:
    - contracts/Q-0033/review-surface-assets.contract.md
    - contracts/Q-0033/documentation-and-evidence.contract.md
    - contracts/Q-0033/cli-review-surface.contract.md
    - contracts/Q-0006/review-flow.contract.yaml
    - contracts/Q-0006/code-reviewer-role.contract.md
    - contracts/Q-0006/review-artifacts.schema.json
    - contracts/Q-0006/review-runtime.contract.md
    - contracts/Q-0006/review-lint.contract.md
    - contracts/Q-0006/mock-adapter-switches.contract.md
    - backlog/Q-0006-review-flow-and-cross-flow-backward-edge/solution/errata.md
  depends_on:
    - Q0033-cli-lint-config
```
