*Test scenarios for the qa-red stage. Ticket Q-0033, consumes `solutioned`. Written against `requirements/merged.md`, `solution/solution.md`, `solution/tasks.yaml`, the three `contracts/Q-0033/*` contracts (currently on branch `harness/Q-0033/contracts`, not yet merged to `main`), and the frozen `contracts/Q-0006/*` contracts + `errata.md` (baseline commit `5d16e06`). Cross-checked against the current state of `spike/bin/harness.js`, `spike/src/engine.js`, `spike/test/smoke.js` on `main` — deviations from the code as written today are called out per scenario so development knows what is genuinely new versus already-shipped.*

## How to read this document

- **Tags** name the `tasks.yaml` id(s) whose deliverable the scenario exercises: `Q0033-cli-lint-config` or `Q0033-assets-docs`. AC12 is tagged `manual` — it is a maintainer closing-gate action per `solution.md`, never a fan-out task, and no automated test may create its evidence.
- Every scenario runs under `--adapter mock` unless stated otherwise (AC12 is the sole exception — it requires real, authenticated Claude Code and Codex CLIs).
- `iterations.review = 3` is the correct persisted retry value everywhere in this document (Q-0006 errata E-1 supersedes `contracts/Q-0006/review-runtime.contract.md`'s `max_iterations - 1` / `2` clause). A test asserting `2` is wrong per that errata and must not be written.
- Baseline commit for the frozen-input guard is `5d16e06`.

## Coverage map

| AC | Title | Tags |
| --- | --- | --- |
| 1 | `review.yaml` ships in both places, matches the frozen contract | `Q0033-assets-docs` |
| 2 | `code-reviewer.md` ships in both places, byte-identical, satisfies contract | `Q0033-assets-docs` |
| 3 | The flow uses only fields the engine has | `Q0033-assets-docs` |
| 4 | Both config files declare the review keys | `Q0033-cli-lint-config` |
| 5 | `harness init` discovers the base branch safely | `Q0033-cli-lint-config` |
| 6 | Cross-flow targets resolve, and the chain must come home | `Q0033-cli-lint-config` |
| 7 | Bounds and counter spelling are checked | `Q0033-cli-lint-config` |
| 8 | A single-vendor panel fails lint | `Q0033-cli-lint-config` |
| 9 | `harness run` performs the same validation first, from disk | `Q0033-cli-lint-config` |
| 10 | A gate answer is never defaulted, and never silently invented | `Q0033-cli-lint-config` |
| 11 | The existing suite stays green, with its assumption made explicit | `Q0033-cli-lint-config`, `Q0033-assets-docs` |
| 12 | Real-CLI evidence is on the record | `manual` |
| 13 | The docs agree with the shipped flow in the same change | `Q0033-assets-docs` |

---

## AC1 — `review.yaml` ships in both places and matches the frozen contract

**S1.1 — Parsed deep-equality against the frozen fixture**
*Tags: Q0033-assets-docs*
**Given** `harness/flows/review.yaml` exists in the repository
**When** it is parsed with `YAML.parse`, its loader-only `file` key removed, and compared to `contracts/Q-0006/review-flow.contract.yaml` parsed the same way
**Then** the two values deep-equal — `consumes: green`, `produces: reviewed`, `cross_vendor: required`, the two-step `code-reviewer` panel on `claude`/`codex` writing `review/round-{round}/{vendor}.md` from `[requirements/merged.md, solution/solution.md]` and `{base}...harness/{id}/integration`, the `verdict` step reading both panel artifacts plus requirement and solution, writing `review/round-{round}/verdict.md` and `review/verdict.md`, `goto: flow:development`, `counter: review`, `max_iterations: 3`, `on_exhausted: gate`, and the closing `gate: human`

**S1.2 — Template copy is byte-identical**
*Tags: Q0033-assets-docs*
**Given** `harness/flows/review.yaml` and `spike/templates/harness/flows/review.yaml` both exist
**When** their bytes are compared
**Then** they are identical

**S1.3 — `harness lint` reports the shipped flow clean**
*Tags: Q0033-assets-docs*
**Given** a project initialised from the real `harness/flows/` directory
**When** `harness lint` runs
**Then** it reports `review.yaml` with `✓` and exits `0`

**S1.4 — Flow-directory parity is a named, standing test (not a habit)**
*Tags: Q0033-assets-docs*
**Given** every `.yaml` filename under `harness/flows/`
**When** the corresponding filename is looked up under `spike/templates/harness/flows/`, and vice versa
**Then** every filename has a byte-identical peer on the other side — for all four pre-existing flows (`development.yaml`, `qa-red.yaml`, `requirements.yaml`, `solutioning.yaml`) as well as the newly added `review.yaml`
**Note:** this test does not exist today (`spike/test/smoke.js:171-175` only asserts no shipped template pins a codex model) — it must be added, not merely kept green.

---

## AC2 — `code-reviewer.md` ships in both places, byte-identical, satisfies contract

**S2.1 — Byte-identical role files**
*Tags: Q0033-assets-docs*
**Given** `harness/roles/code-reviewer.md` and `spike/templates/harness/roles/code-reviewer.md`
**When** `diff` is run between them
**Then** it prints nothing

**S2.2 — No `adapter` or `model` in frontmatter**
*Tags: Q0033-assets-docs*
**Given** the shipped `code-reviewer.md`
**When** its frontmatter is parsed
**Then** it contains neither `adapter` nor `model`, so each review step in `review.yaml` controls its own vendor

**S2.3 — Existing no-pinned-codex-model assertion stays green**
*Tags: Q0033-assets-docs*
**Given** the existing template-walk assertion at `spike/test/smoke.js:175` (no shipped template pins a codex model alias)
**When** the suite runs after `code-reviewer.md` is added to both template trees
**Then** the assertion still passes — the new role introduces no `model` key

**S2.4 — Role body satisfies the persona contract**
*Tags: Q0033-assets-docs*
**Given** the body of `code-reviewer.md`
**When** it is read against `contracts/Q-0006/code-reviewer-role.contract.md`
**Then** it states: reads the supplied requirement, solution and diff; never edits or rewrites code; classifies every finding as exactly `blocker`, `major`, or `nit`; cites every finding as `file:line`
**And** the severity-threshold wording ("nits alone approve; any surviving blocker or major requests changes") lives only in the verdict step's `instructions` in `review.yaml`, not in the role body

**S2.5 — Negative control: directory-wide role parity is *not* required**
*Tags: Q0033-assets-docs*
**Given** `harness/roles/developer-backend.md` (intentionally divergent from its template peer) and `harness/roles/developer-tooling.md` (repo-local only, no template peer)
**When** `diff -rq harness/roles spike/templates/harness/roles` is run
**Then** it is non-empty, and the test suite asserts that it is non-empty — proving a directory-wide parity rule would be false and confirming only `code-reviewer.md` is compared

---

## AC3 — The flow uses only fields the engine has

**S3.1 — No unsupported fields in the shipped flow**
*Tags: Q0033-assets-docs*
**Given** the parsed `harness/flows/review.yaml`
**When** its steps are inspected
**Then** there is no `type: judge`, no `input: { findings: [...] }`, no `output: { findings: true }` or `tasks: true`, and no `on_fail.with:` anywhere in the file

**S3.2 — `green → red` under `MOCK_ALWAYS_FAIL`**
*Tags: Q0033-assets-docs*
**Given** a ticket at stage `green` and `MOCK_ALWAYS_FAIL=1`
**When** `harness run review <id> --adapter mock` executes to a terminal state (supplying whatever gate answers the exhaustion path requires)
**Then** the verdict step reports `changes-requested`, the run regresses via `goto: flow:development`, and the ticket's stage becomes `red` (`flow:development`'s `consumes`) with no change to `spike/src/**`

**S3.3 — `green → reviewed` under `MOCK_ALWAYS_PASS`**
*Tags: Q0033-assets-docs*
**Given** a ticket at stage `green` and `MOCK_ALWAYS_PASS=1`
**When** `harness run review <id> --adapter mock` executes and the closing gate is answered `advance`
**Then** the verdict step reports `approve` with empty `findings`, and the ticket's stage becomes `reviewed`

**S3.4 — Verdict step's mixed-vendor input passes the existing cross-vendor judge rule**
*Tags: Q0033-assets-docs*
**Given** the verdict step's two named inputs, `review/round-{round}/claude.md` and `review/round-{round}/codex.md`, written by different adapters
**When** the existing `cross_vendor: required` judge check (`spike/src/engine.js:38-49`) runs over the shipped flow
**Then** it passes — a judge over candidates spanning vendors satisfies the 2026-08-21 refinement, and no new engine code is needed for this case

---

## AC4 — Both config files declare the review keys

**S4.1 — `repo.max_diff_bytes` is present with a comment, `repo.base_branch` is preserved**
*Tags: Q0033-cli-lint-config*
**Given** `harness/harness.yaml` and `spike/templates/harness/harness.yaml`
**When** their `repo:` block is read
**Then** both carry `base_branch: main` (unchanged, already shipped by Q-0004) and the newly added `max_diff_bytes: 200000`, each with a one-line comment explaining its purpose

**S4.2 — Omitting both keys stays valid**
*Tags: Q0033-cli-lint-config*
**Given** a `harness.yaml` with no `repo:` block at all
**When** a review step resolves `{base}` and `repo.max_diff_bytes`
**Then** resolution falls back to `main` and `200000` without error, so no existing project config becomes invalid

**S4.3 — Omitting only `max_diff_bytes` stays valid**
*Tags: Q0033-cli-lint-config*
**Given** a `harness.yaml` with `repo: { base_branch: develop }` and no `max_diff_bytes`
**When** a review step resolves the diff-size limit
**Then** it resolves to `200000` while `{base}` resolves to `develop`

---

## AC5 — `harness init` discovers the base branch safely

**S5.1 — Named non-`main` branch is discovered**
*Tags: Q0033-cli-lint-config*
**Given** a fresh repository on branch `master` (`git init -b master && git commit --allow-empty -m init`)
**When** `harness init` runs inside it
**Then** `harness/harness.yaml` is written with `base_branch: master` and `max_diff_bytes: 200000`

**S5.2 — Nameable unborn HEAD is a discovery success**
*Tags: Q0033-cli-lint-config*
**Given** a freshly `git init -b master`-ed directory with **no commits** (unborn HEAD, but Git can still name the branch)
**When** `harness init` runs
**Then** it writes `base_branch: master` — an unborn HEAD whose branch Git can name is treated as success, not fallback

**S5.3 — Outside a Git repository, fallback to `main`**
*Tags: Q0033-cli-lint-config*
**Given** a plain directory that is not a Git repository
**When** `harness init` runs
**Then** it writes `base_branch: main`, exits `0`, and prints no Git error or stderr output

**S5.4 — Detached HEAD, fallback to `main`**
*Tags: Q0033-cli-lint-config*
**Given** a repository checked out at a detached HEAD (`git checkout --detach HEAD`)
**When** `harness init` runs
**Then** it writes `base_branch: main` and exits `0`

**S5.5 — Unnameable HEAD, fallback to `main`**
*Tags: Q0033-cli-lint-config*
**Given** a repository in a state where Git cannot name the current branch (e.g. mid-rebase with a detached, unnamed ref)
**When** `harness init` runs
**Then** it writes `base_branch: main`, exits `0`, and a Git failure never fails `init`

**S5.6 — Discovery touches only `base_branch`**
*Tags: Q0033-cli-lint-config*
**Given** any successful discovery (S5.1 or S5.2)
**When** the written `harness.yaml` is inspected
**Then** `max_diff_bytes` remains `200000` and no other key changes

**S5.7 — Comment- and formatting-preserving edit**
*Tags: Q0033-cli-lint-config*
**Given** the copied template `harness.yaml`, including its `commands.install` comment and the new `repo.base_branch` / `repo.max_diff_bytes` comments
**When** `init` rewrites `base_branch` on a non-`main` branch (S5.1)
**Then** the `commands.install` comment and both `repo` comments are still present in the written file — a parsed-value comparison alone is insufficient here because it would let a `YAML.parse` + `YAML.stringify` round-trip silently strip every comment while still passing

---

## AC6 — Cross-flow targets resolve, and the chain must come home

**S6.1 — Real shipped chain: `review → development` (one hop, direct match)**
*Tags: Q0033-cli-lint-config*
**Given** the real `harness/flows/` directory including the shipped `review.yaml` (`goto: flow:development`)
**When** the whole-directory validator runs
**Then** it resolves `development`, finds its `produces` (`green`) equals `review`'s `consumes` (`green`) immediately, and reports no error for this edge

**S6.2 — Positive fixture: multi-hop chain `review → qa-red`**
*Tags: Q0033-cli-lint-config*
**Given** a temporary harness directory containing copies of all shipped flows plus a modified `review` flow whose `goto` targets `flow:qa-red` instead of `flow:development`
**When** the validator walks from `qa-red`'s `produces` (`red`) through the flow consuming `red` (`development`, `produces: green`) until it reaches `review`'s `consumes` (`green`)
**Then** the two-hop chain resolves with no error — proving the walk follows multiple flows, not just a direct match
**And** no shipped flow file is mutated to build this fixture

**S6.3 — Missing target**
*Tags: Q0033-cli-lint-config*
**Given** a temporary flow whose `on_fail.goto` is `flow:nonexistent`
**When** the validator runs
**Then** it fails, naming the source flow, the missing target `nonexistent`, and that no such flow could be loaded

**S6.4 — Unloadable target**
*Tags: Q0033-cli-lint-config*
**Given** a temporary flow whose `on_fail.goto` is `flow:broken`, where `broken.yaml` exists but is unparsable or fails its own structural lint (e.g. duplicate step ids)
**When** the validator runs
**Then** it fails, naming the source flow, the target `broken`, and that the target could not be loaded — distinct from the "missing" diagnostic of S6.3

**S6.5 — Dead end**
*Tags: Q0033-cli-lint-config*
**Given** a temporary target flow whose `produces` stage has no flow consuming it anywhere in the fixture directory
**When** the validator walks from that stage
**Then** it fails, naming the source flow, the target flow, and the stage where the chain dies

**S6.6 — Reached-stage ambiguity**
*Tags: Q0033-cli-lint-config*
**Given** two temporary flows that both declare `consumes: <same-stage>`, where `<same-stage>` is a stage the return-chain walk actually reaches
**When** the validator runs
**Then** it fails, naming the source flow, the target flow, the ambiguous stage, and both implicated flows

**S6.7 — Unreached ambiguity does not fail**
*Tags: Q0033-cli-lint-config*
**Given** two temporary flows that both declare `consumes: <same-stage>`, where `<same-stage>` is never reached by any return-chain walk in the fixture directory
**When** the validator runs
**Then** it reports no error — ambiguity is only a problem on a stage the walk actually reaches

**S6.8 — Cycle**
*Tags: Q0033-cli-lint-config*
**Given** two temporary flows, A (`consumes: x`, `produces: y`) and B (`consumes: y`, `produces: x`), and a source flow whose `goto` targets one of them, with neither ever producing the source's `consumes` stage
**When** the validator walks the chain
**Then** it terminates (via the `(flow, stage)` visited set) rather than hanging, and fails naming the source flow, the target, and the implicated flows in the cycle

**S6.9 — Self-target dies at `reviewed`**
*Tags: Q0033-cli-lint-config*
**Given** a temporary copy of `review.yaml` with `goto: flow:review` (targeting itself)
**When** the validator walks from `review`'s own `produces` (`reviewed`)
**Then** it fails as a dead end at stage `reviewed`, because no shipped flow yet consumes `reviewed` — named as the self-target fixture

**S6.10 — Repeated `(flow, stage)` pair is rejected as a cycle, not silently deduplicated**
*Tags: Q0033-cli-lint-config*
**Given** the cycle fixture of S6.8
**When** the walk revisits the same `(flow, stage)` pair a second time
**Then** the walk stops at that revisit and reports the cycle rather than looping again

---

## AC7 — Bounds and counter spelling are checked

**S7.1 — Missing `max_iterations` fails**
*Tags: Q0033-cli-lint-config*
**Given** an `on_fail` block with no `max_iterations` key
**When** the validator runs
**Then** it fails, naming the step and the field

**S7.2 — Non-integer `max_iterations` fails**
*Tags: Q0033-cli-lint-config*
**Given** `on_fail: { max_iterations: "three" }`
**When** the validator runs
**Then** it fails, naming the step and the field

**S7.3 — Fractional `max_iterations` fails**
*Tags: Q0033-cli-lint-config*
**Given** `on_fail: { max_iterations: 1.5 }`
**When** the validator runs
**Then** it fails, naming the step and the field

**S7.4 — `max_iterations: 0` fails (regression fix)**
*Tags: Q0033-cli-lint-config*
**Given** `on_fail: { max_iterations: 0 }`
**When** the validator runs
**Then** it fails, naming the step and the field
**Note:** today's `lintFlow` (`spike/src/engine.js:31`, `Number.isInteger(0) === true`) incorrectly accepts this. This scenario must fail on `main` as it stands today and pass only once the fix lands — it is a genuine behavior change, not a "stays green" regression check.

**S7.5 — Negative `max_iterations` fails**
*Tags: Q0033-cli-lint-config*
**Given** `on_fail: { max_iterations: -1 }`
**When** the validator runs
**Then** it fails, naming the step and the field
**Note:** also currently accepted by `main` (`Number.isInteger(-1) === true`) — same regression class as S7.4.

**S7.6 — Prefixed `counter` is rejected with the corrected spelling**
*Tags: Q0033-cli-lint-config*
**Given** `on_fail: { counter: "iterations.review", max_iterations: 3 }`
**When** the validator runs
**Then** it fails with a message naming the step, the offending value `iterations.review`, and the corrected spelling `review` — because the prefixed form would create a literal `"iterations.review"` key nested inside the `iterations` object rather than `iterations.review` as a flat key

**S7.7 — Empty `counter` fails**
*Tags: Q0033-cli-lint-config*
**Given** `on_fail: { counter: "", max_iterations: 3 }`
**When** the validator runs
**Then** it fails, naming the step and the field

**S7.8 — Valid bound and counter pass (shipped case)**
*Tags: Q0033-cli-lint-config*
**Given** the shipped `review.yaml`'s verdict step, `on_fail: { counter: review, max_iterations: 3, on_exhausted: gate }`
**When** the validator runs
**Then** it reports no error for this step

---

## AC8 — A single-vendor panel fails lint

**S8.1 — Two same-role steps on the same adapter fail**
*Tags: Q0033-cli-lint-config*
**Given** a temporary `cross_vendor: required` flow with a parallel group of two `role: code-reviewer` steps both declaring `adapter: claude`
**When** the validator runs
**Then** it fails, naming both member step ids and the shared adapter `claude`

**S8.2 — Shipped panel spans two adapters and passes**
*Tags: Q0033-cli-lint-config*
**Given** the shipped `review.yaml` panel (`review-claude` on `claude`, `review-codex` on `codex`)
**When** the validator runs
**Then** it reports no single-vendor-panel error for this group

**S8.3 — Three-or-more-member panel, still all one vendor, fails**
*Tags: Q0033-cli-lint-config*
**Given** a temporary parallel group of three `role: code-reviewer` steps all on `adapter: codex`
**When** the validator runs
**Then** it fails, naming all three member ids and the shared adapter `codex`

**S8.4 — A panel spanning two adapters plus a third on one of those adapters still passes**
*Tags: Q0033-cli-lint-config*
**Given** a temporary parallel group of three `role: code-reviewer` steps, two on `claude` and one on `codex`
**When** the validator runs
**Then** it reports no error — the rule only requires the group to span at least two adapters, not an even split

**S8.5 — The verdict step's mixed-vendor *input* rule and the panel rule compose without conflict**
*Tags: Q0033-cli-lint-config*
**Given** the shipped `review.yaml` in full (panel + verdict step)
**When** the validator runs both the new single-vendor-panel rule and the existing cross-vendor judge-input rule
**Then** both pass simultaneously — the panel rule governs the parallel group, the judge rule governs the verdict step's inputs, and neither rule's fixture trips the other

---

## AC9 — `harness run` performs the same validation first, from disk

**S9.1 — An invalid sibling flow blocks the run before any spend**
*Tags: Q0033-cli-lint-config*
**Given** a project whose `harness/flows/` directory contains the valid shipped flows plus one sibling flow with an unresolvable `goto: flow:` target
**When** `harness run review <id> --adapter mock` is invoked
**Then** the process exits non-zero, makes **zero** `adapter.run` calls, and adds **zero** lines to the ticket's `runs.log`

**S9.2 — Preflight validates pristine files, before the `--adapter mock` override collapses vendors**
*Tags: Q0033-cli-lint-config*
**Given** a valid harness whose real, on-disk `review.yaml` has a two-vendor panel (`claude` + `codex`)
**When** `harness run review <id> --adapter mock` is invoked (which would make every step run on `mock` in memory)
**Then** the run does **not** fail the single-vendor-panel rule — the validator loads and checks the pristine files from disk before any `--adapter` override is applied in memory

**S9.3 — Identical diagnostic through `lint` and through `run`**
*Tags: Q0033-cli-lint-config*
**Given** the same invalid fixture directory used in S9.1
**When** `harness lint` and `harness run review <id> --adapter mock` are each invoked against it
**Then** both report the same diagnostic text

**S9.4 — `harness lint` reports every offending flow in one pass**
*Tags: Q0033-cli-lint-config*
**Given** a fixture directory with two independently invalid flows (e.g. one with a missing target, one with `max_iterations: 0`)
**When** `harness lint` runs
**Then** it reports both diagnostics in a single invocation and exits non-zero exactly once — not once per offending flow

---

## AC10 — A gate answer is never defaulted, and never silently invented

**S10.1 — Two gates in one run receive different explicit answers in order**
*Tags: Q0033-cli-lint-config*
**Given** a ticket whose `iterations.review` is already `3` (persisted from prior rounds) and `MOCK_ALWAYS_FAIL=1`, so this run's verdict is `changes-requested` and immediately exhausts the loop, landing on the exhaustion gate, and — once answered `advance` — proceeds to the flow's closing `gate: human`
**When** `harness run review <id> --adapter mock --gate-answer advance --gate-answer abort` is invoked
**Then** the exhaustion gate consumes `advance` (accepting as-is and continuing), the closing gate consumes `abort` (in that encounter order), and the run ends aborted with unchanged stage

**S10.2 — `--gate-answer` is repeatable and does not overwrite (parser fix)**
*Tags: Q0033-cli-lint-config*
**Given** the current flag parser at `spike/bin/harness.js:24-27`, which stores each `--flag value` pair by overwriting `flags[k]`
**When** `--gate-answer advance --gate-answer abort` is parsed
**Then** both values are retained as an ordered list — this requires a parser change scoped to `--gate-answer` only; all other flags keep their existing last-wins behavior (verified by an existing flag such as `--adapter` still overwriting on repeat)

**S10.3 — Explicit answer requires the exact word; a prefix is rejected**
*Tags: Q0033-cli-lint-config*
**Given** a pending gate
**When** `--gate-answer ad` is supplied (a prefix of `advance`)
**Then** the process exits non-zero with an error naming the gate — explicit flag values must be exact full words after trim/case-normalization, unlike the forgiving `startsWith` matching interactive TTY input still accepts

**S10.4 — Non-TTY stdin with no remaining explicit answers**
*Tags: Q0033-cli-lint-config*
**Given** a gate is reached, no more `--gate-answer` values remain, and stdin is not a TTY (e.g. piped from `/dev/null`)
**When** the run reaches that gate
**Then** the process exits non-zero with an error naming the gate; it neither blocks nor defaults to `advance`

**S10.5 — Missing, empty, or unrecognised interactive answer**
*Tags: Q0033-cli-lint-config*
**Given** an interactive TTY session at a gate
**When** the user submits an empty line, or a word that is none of `advance`/`retry`/`abort` (and no valid prefix of them)
**Then** the process exits non-zero (empty) or re-prompts (unrecognised, per the existing forgiving interactive behavior) — in no case does it default to `advance`

**S10.6 — `--auto` does not answer an exhaustion gate**
*Tags: Q0033-cli-lint-config*
**Given** a ticket whose `iterations.review` is already `3` and `MOCK_ALWAYS_FAIL=1`
**When** `harness run review <id> --adapter mock --auto` is invoked with no `--gate-answer`
**Then** the process exits non-zero naming the exhaustion gate, rather than walking through it — `handleFail` presents it as kind `human-locked` (`spike/src/engine.js:252`), and this scenario is the CLI-observable proof of that property

**S10.7 — Retry at exhaustion persists `iterations.review = 3`, not `2`**
*Tags: Q0033-cli-lint-config*
**Given** the exhaustion gate of S10.1/S10.6, offering `advance / retry / abort`
**When** `--gate-answer retry` is supplied
**Then** `iterations.review` is persisted as `3` (per Q-0006 errata E-1, `max_iterations`, not `max_iterations - 1`), `runs.log` gets a line `gate=retry counter=review set=3`, and the retry's own regression is the single authorised further traversal — a following rejection re-presents the gate rather than granting a second one

---

## AC11 — The existing suite stays green, with its assumption made explicit

**S11.1 — Full suite passes end to end**
*Tags: Q0033-cli-lint-config, Q0033-assets-docs*
**Given** the integrated Q-0033 branch
**When** `npm test --prefix spike` and `npm run lint --prefix spike` run
**Then** both pass, including the pre-existing `draft → green` path, the API-key refusal assertions, and the no-pinned-codex-model assertion

**S11.2 — `spike/test/smoke.js:82-85` is migrated off the empty-answer default**
*Tags: Q0033-cli-lint-config*
**Given** the existing exhausted-loop assertion, which today passes `['run', 'requirements', 'T-0002', '--adapter', 'mock', '--auto']` and only survives because closed stdin currently resolves in a way this ticket changes
**When** the assertion is rewritten to supply an explicit `--gate-answer abort` (or equivalent) instead of relying on empty-stdin behavior
**Then** it still asserts `loop exhausted`, `human-locked`, non-zero exit, and that a human-locked gate is never auto-advanced — same property, now proven without depending on the default this ticket removes

**S11.3 — `harness board` displays the persisted review counter**
*Tags: Q0033-cli-lint-config*
**Given** a ticket with `iterations.review: 2` persisted in `ticket.md`
**When** `harness board` runs
**Then** its output includes `iter={…}` containing the review counter — no production change to `board` is required, only this regression assertion

**S11.4 — Cost is counted once across an exhaustion event and its terminal event**
*Tags: Q0033-cli-lint-config*
**Given** a run that exhausts the review loop (`exhausted`, `cost: 0`) and is then answered, producing a second terminal event (`completed`/`regressed`/`aborted`) carrying the measured cost
**When** `harness board`'s cost roll-up is computed for that ticket
**Then** the measured cost is counted exactly once — not doubled by the zero-cost exhaustion event, and not lost

**S11.5 — Frozen-input guard: no drift in `contracts/Q-0006/`**
*Tags: Q0033-assets-docs*
**Given** the repository at the tip of the Q-0033 branch and baseline commit `5d16e06`
**When** `git diff --quiet 5d16e06 -- contracts/Q-0006/` runs as part of the suite
**Then** it exits `0` (no diff) — proving neither fan-out task touched a frozen Q-0006 contract

**S11.6 — Frozen-input guard skips cleanly in a shallow clone**
*Tags: Q0033-assets-docs*
**Given** a shallow clone in which commit `5d16e06` is unreachable
**When** the frozen-input guard runs
**Then** it skips with a message naming `5d16e06` as the unavailable baseline, rather than surfacing a raw Git error or silently claiming parity was verified

---

## AC12 — Real-CLI evidence is on the record

**S12.1 — Manual closing-gate evidence, real vendors, real diff (not automated)**
*Tags: manual*
**Given** Q-0033's automated implementation is integrated and green, and the maintainer has authenticated Claude Code and Codex CLI logins
**When** the maintainer runs `harness run review Q-0006` for real (spending both subscriptions)
**Then** the maintainer records in Q-0033's ticket folder that both reviewers received the harness-materialised diff under plan / read-only sandbox, and that the verdict applied the severity threshold as instructed — this action is never delegated to development fan-out, is never automated, and no test in this document may assert it happened

---

## AC13 — The docs agree with the shipped flow in the same change

**S13.1 — SDLC spec state diagram routes rejection to the derived stage**
*Tags: Q0033-assets-docs*
**Given** `docs/02-sdlc-pipeline-spec.md` §3.4
**When** the state diagram is read
**Then** review rejection is drawn to the derived regression target (`red`, via `flow:development`'s `consumes`), not back to `green`

**S13.2 — §5.5's example flow matches what ships**
*Tags: Q0033-assets-docs*
**Given** `docs/02-sdlc-pipeline-spec.md` §5.5
**When** its review flow example is read
**Then** it shows the three-dot `{base}...harness/{id}/integration` diff in the correct direction, `{round}` (not `{iter}`), unprefixed `counter: review`, no `type: judge`, no `findings:`/`tasks:`/`with:` fields, and no pinned model name — replacing the currently-shown `model: opus` / `model: gpt-5`, which the 2026-08-22 decision bans and which fails lint today

**S13.3 — §5.5 describes the configured base, size limit, and exhaustion behavior**
*Tags: Q0033-assets-docs*
**Given** the same section
**When** it is read
**Then** it states the configured base branch, the `repo.max_diff_bytes` limit, and that the exhaustion gate cannot be bypassed by `--auto`

**S13.4 — §10 question 1 is answered: no lighter M1 fix flow**
*Tags: Q0033-assets-docs*
**Given** `docs/02-sdlc-pipeline-spec.md` §10, open question 1 (full development vs. a lighter `fix` flow)
**When** it is read
**Then** it is answered "no lighter flow for M1", matching the ticket's non-goals

**S13.5 — Development plan reflects the Q-0006/Q-0033 split**
*Tags: Q0033-assets-docs*
**Given** `docs/06-development-plan.md`'s M1 section
**When** it is read
**Then** the review line attributes the engine to Q-0006 and the shipped surface to Q-0033, and M1's done-when includes the shipped review surface

**S13.6 — DECISIONS.md gains exactly two new, correctly-formatted entries**
*Tags: Q0033-assets-docs*
**Given** `docs/DECISIONS.md` (append-only)
**When** the file is read after this ticket
**Then** it contains one new entry for the derived regression target and one for the non-auto exhaustion gate, each with a dated title, **Decision**, **Alternatives considered**, and **Why**, and every prior entry is unchanged

**S13.7 — GLOSSARY.md distinguishes the two `human-locked` uses**
*Tags: Q0033-assets-docs*
**Given** `docs/GLOSSARY.md`'s **Gate** entry
**When** it is read
**Then** it gains a sentence distinguishing an author-declared `human-locked` gate (deploy's) from the engine-presented exhaustion gate that reuses the same `kind`, introduces no new synonym for an existing term, and leaves **Role** unchanged

**S13.8 — README is untouched**
*Tags: Q0033-assets-docs*
**Given** `README.md`
**When** the Q-0033 diff is inspected
**Then** it contains no change to `README.md` — that rewrite belongs to Q-0028 in M6

---

## Cross-cutting edge cases

These are not 1:1 with a single AC number but are called out explicitly in `solution.md`'s Risks or "Rejected alternatives," and are load-bearing enough to warrant their own coverage.

**E1 — Ordering bug would otherwise be invisible (Risk 3)**
*Tags: Q0033-cli-lint-config*
**Given** preflight validation were (hypothetically) run *after* the `--adapter mock` override instead of before it
**When** any mock run of the shipped two-vendor `review.yaml` executed
**Then** it would incorrectly fail the single-vendor-panel rule on every single mock run — S9.2 is the regression test that pins the correct ordering and prevents this from reading as "a lint bug" instead of the ordering bug it would actually be

**E2 — Return-chain validator must survive stages that don't exist yet (Risk 4)**
*Tags: Q0033-cli-lint-config*
**Given** the validator is written and tested against today's five flows
**When** `qa-final.yaml` and `deploy.yaml` land later (Q-0012) and stage `reviewed` gains a second consumer
**Then** the visited-set rule (S6.8/S6.10) and "ambiguity only on a reached stage" rule (S6.6/S6.7) are what keep the *then-correct* multi-consumer flow set from failing lint — no test in this ticket can exercise the future flows directly, but S6.7 is the regression proof that the rule as designed will not retroactively break them

**E3 — `--gate-answer` scoping does not leak into other flags**
*Tags: Q0033-cli-lint-config*
**Given** `--adapter mock --adapter claude` (repeating a flag other than `--gate-answer`)
**When** the CLI parses its arguments
**Then** `--adapter` still resolves to the last value (`claude`) — proving the accumulation change in S10.2 is scoped to `--gate-answer` only

**E4 — Non-TTY explicit-answer exhaustion is distinguished from `--auto` exhaustion**
*Tags: Q0033-cli-lint-config*
**Given** the same exhausted-loop setup as S10.6
**When** `--gate-answer advance` **is** supplied (unlike S10.6, where none was)
**Then** the exhaustion gate is answered from the explicit flag and the run proceeds — confirming `--auto` alone is what's rejected, not exhaustion gates in general

**E5 — `init` never fails the whole command on a Git error mid-discovery**
*Tags: Q0033-cli-lint-config*
**Given** a directory where the template copy succeeds but the branch-discovery Git subprocess itself errors (not just "can't name a branch" — an actual process failure)
**When** `harness init` runs
**Then** it still exits `0` with `harness/` and `backlog/` created and `base_branch: main` retained — discovery is best-effort and is never allowed to turn a successful `init` into a failure

**E6 — A config migration is deliberately not required**
*Tags: Q0033-cli-lint-config*
**Given** an existing project's `harness.yaml` predating this ticket, with a `repo:` block that has `base_branch` but no `max_diff_bytes`
**When** that config is loaded after this ticket ships
**Then** it remains valid with no migration step, no warning, and no forced rewrite — this is the same case as S4.3, restated here because `solution.md` explicitly names "a config migration" as a rejected alternative
