*Test scenarios for the qa-red stage. Ticket Q-0033, consumes `solutioned`. Written against `requirements/merged.md` (13 criteria), `solution/solution.md`, `solution/tasks.yaml` (the current five-task cut), `solution/errata.md` (E-1, E-2, E-3), the three `contracts/Q-0033/*` contracts (read from `harness/Q-0033/contracts`, since they live on that branch, not `main`), and the frozen `contracts/Q-0006/*` contracts + errata (baseline commit `5d16e06`). Cross-checked directly against `spike/bin/harness.js`, `spike/src/engine.js`, `spike/src/adapters/mock.js`, `spike/test/smoke.js`, `harness/flows/requirements.yaml`, `harness/flows/development.yaml`, `harness/harness.yaml` and `docs/02-sdlc-pipeline-spec.md` on `main` as they stand today — not as any prior round assumed them to stand.

## Why this revision, and what actually changed

This supersedes the version `qa/scenario-review.md` (round 4, run 7) reviewed and rejected. Two things happened between that review and this revision, and neither reopens the review's praise for what already worked (branch provenance, `smoke.js`'s per-failure reporting, S13.1's connector-tracing rewrite, the S8.1/S8.3 fixture isolation, the S11.5/S11.6 split — all carried forward unchanged).

**First, errata E-3** re-cut the task list from six to five: `Q0033-mock` is dropped (the scenario it existed for, S3.2/S3.3, already passes against `spike/src/adapters/mock.js` unmodified — dispatching it would have sent an agent at a file with nothing to do, the mirror image of the ownership gap E-1 was written to close), and `Q0033-docs` no longer owns or mentions `README.md` (the merged requirement puts that rewrite in Q-0028/M6, and a scenario in this document asserts it stays untouched — a task instructed to touch it would have guaranteed its own failure). E-3 also explicitly **declined** the review's blocker that `spike/test/smoke.js` and the new suite "contradict" each other: they run different commands (one supplies `--gate-answer`, one doesn't) and both assertions are correct under a single implementation. Nothing here deletes the `smoke.js` assertion the review asked to remove.

**Second, two of the review's remaining findings were engine defects, not scenario-content defects, and are already fixed directly on `main`, outside this document's scope to re-litigate:** the report used to be the last 8000 characters of test output, which silently dropped more than half of every failing group in round 4's own report; `testReport` (`spike/src/engine.js`) now keeps every line that looks like a test result as a standing roster, drawn from the *entire* output, and truncates only the payload in the middle (commit `ce26288`, "keep every result line in the report"). Separately, a run that does not complete (exhausted, aborted, failed, interrupted) now rolls the ticket branch back to where it found it, so a later qa-red round can no longer measure red against a tree still carrying a previous, incomplete development attempt (commit `c69cd99`). Both are cited below where they change what this document needs to ask for.

**What this revision actually fixes, as scenario content:**

- **AC9 and AC10's fixtures no longer need `review.yaml` to exist.** The round-4 report showed both groups dying on a raw `ENOENT … harness/flows/review.yaml` before a single gate-answer assertion ran, because their fixtures ran `harness run review <id>`, and `review.yaml` is Q0033-assets' own deliverable — unavailable at the moment qa-red's red phase is measured. `harness/flows/requirements.yaml` already ships an equivalent shape for everything AC9 and AC10 actually need: its own bounded loop (`head-of-product`, `max_iterations: 1`) reaches the identical `human-locked` exhaustion gate that AC10 governs, followed by the flow's own closing `gate: human` — so "two gates in one run" needs no invention. Its own `parallel` group (`pm-claude`/`pm-codex`, both `role: product-manager`, one per adapter, under `cross_vendor: required`) is already the exact shape AC8's new single-vendor-panel rule would check — so "a pristine two-vendor panel survives the mock override" needs no invention either. Only **S10.7** (retry persists the *review-specific* counter `iterations.review`) and **E7** (an unconsumed `--gate-answer` is specific to `review.yaml`'s own backward edge) are inherently about the review flow, and both now carry an explicit precondition assertion rather than an implicit dependency on load order.
- **S10.1 now asserts ordered evidence from `runs.log`**, using the exact line shapes `finish()`/`handleFail()`/`runGate()` write (`... exhausted stage=X→X cost=0`, `... gate=human-locked answer=advance`, `... gate=human answer=abort`, `... aborted stage=X→X cost=… tokens=…`), rather than an exit code and an unchanged stage that a broken implementation which merely discards both flags could also produce.
- **A caution is added near AC6/AC7**: `Q0033-lint`'s extraction of the flow rules into `spike/src/lint.js` must leave `spike/src/engine.js` re-exporting `lintFlow` and `FlowError`, because both `spike/bin/harness.js` and this suite import them from there today.
- **The branch-provenance check moves into the suite itself (E8)**, replacing an instruction to paste `git merge-base`/`git diff` output into `qa/red-integration.md` — that file is written by the engine at `prove-red` and is overwritten every round, so a paste into it cannot survive to the next round's evidence.
- **A roster-completeness check is added (E9)**, pinning the already-fixed `testReport` behaviour so a future change cannot silently reintroduce tail-only truncation without a scenario noticing.
- **Three nits from the review are folded directly into scenario text**: E3 now asserts something only a correct last-wins reading of `--adapter` can produce, S13.5's block-boundary rule no longer depends on a regex anchor that means something other than "end of string" in JavaScript, and S13.6 names which decision entry a failing assertion is about.

## How to read this document

- **Tags** name the `tasks.yaml` id(s) whose deliverable the scenario exercises, using the current five-task cut: `Q0033-cli` (tooling → claude, owns `spike/bin/harness.js` — gate-answer parsing, `init`'s branch discovery, and the run-time preflight invocation), `Q0033-lint` (backend → codex, owns `spike/src/lint.js` plus the lint portion of `spike/src/engine.js`), `Q0033-config` (backend → codex, owns both `harness.yaml` files), `Q0033-assets` (backend → codex, owns `review.yaml`/`code-reviewer.md` and their templates), `Q0033-docs` (backend → codex, owns the four doc files — not `README.md`). All five declare `depends_on: []` and run in one wave; `Q0033-cli` on `claude` alongside four tasks on `codex` is what makes the fan-out two-vendor.
- Where a scenario needs no dev task at all — because it lives in `spike/test/**`, which every task is forbidden to touch, or because it is a pure regression check no task is expected to affect — the tag says so explicitly. This is the rule errata E-2 and `harness/architecture.md` state: a scenario satisfiable only by editing a file no task owns is not a valid red test, and if the fix lives in qa-red's own files, qa-red writes it directly.
- Every scenario runs under `--adapter mock` unless stated otherwise (AC12 is the sole exception — it requires real, authenticated Claude Code and Codex CLIs).
- `iterations.review = 3` is the correct persisted retry value everywhere in this document (Q-0006 errata E-1 supersedes `contracts/Q-0006/review-runtime.contract.md`'s `max_iterations - 1` / `2` clause). A test asserting `2` is wrong per that errata.
- Baseline commit for the frozen-input guard and any diff-against-a-fixed-point check is `5d16e06`.
- **Branch provenance is proven by the suite, not by a paste into a generated file.** See E8. `qa/red-integration.md` is overwritten by the engine every `prove-red` run; nothing pasted into it survives to the next round.
- **Every scenario id below reports its own line, independent of any sibling scenario in the same group.** A group covering several fixtures under one heading (e.g. S5.1–S5.7, S6.1–S6.10, S8.1–S8.4, S10.1–S10.7) must catch each fixture's failure individually and print a line for every one of them — `✓ <id> <label>` / `✗ <id> <label>: <reason>` — before the group counts as done. A single `try`/`catch` around a whole group, reporting only the first failure, does not satisfy this document even when the group's overall status happens to be correct. `smoke.js`'s own `assert()` helper must record a failure and let the script continue, exiting non-zero only once every remaining assertion has had a chance to run — its current behaviour (`process.exit(1)` on the first failure) would otherwise hide every scenario after the first regression **S11.7** is expected to show. This is not a new requirement invented here: `spike/src/engine.js`'s `testReport` now keeps every line that looks like a result from the *entire* captured output (not just a tail slice — see E9), which only pays off if each scenario actually prints its own line to begin with.
- **A scenario correctly left unassertable logs that it was skipped, on its own line, never folded into a group that also reports `✓` for an unrelated assertion.** S11.6's shallow-clone guard, S12.1's manual-only evidence, and E2's future-flow guarantee are the three cases here. Print skip lines in a form containing the word `SKIP` (e.g. `SKIP S11.6: baseline unreachable`), matching the same result-line pattern `✓`/`✗` lines use, so the roster in E9 captures skips too.
- **Assert `status !== 0` (or the equivalent) unless a scenario explicitly names an exit code; none do.** Pinning an incidental exit code that no criterion specifies turns a red test into a description of an implementation detail nobody asked for.
- **`spike/src/engine.js` must keep exporting `lintFlow` and `FlowError` from that module after `Q0033-lint` extracts the rules into `spike/src/lint.js`** (e.g. `export { lintFlow, FlowError } from './lint.js'`). `spike/bin/harness.js` and this suite both `import { lintFlow } from '../src/engine.js'` today; if the extraction drops the re-export, every scenario in this document fails at import — which must read as a compile failure, not as this ticket's red phase.

## Coverage map

| AC | Title | Tags |
| --- | --- | --- |
| 1 | `review.yaml` ships in both places, matches the frozen contract | `Q0033-assets`, `Q0033-lint` (joint, S1.3) |
| 2 | `code-reviewer.md` ships in both places, byte-identical, satisfies contract | `Q0033-assets` |
| 3 | The flow uses only fields the engine has | `Q0033-assets` |
| 4 | Both config files declare the review keys | `Q0033-config` |
| 5 | `harness init` discovers the base branch safely | `Q0033-cli` |
| 6 | Cross-flow targets resolve, and the chain must come home | `Q0033-lint` |
| 7 | Bounds and counter spelling are checked | `Q0033-lint` |
| 8 | A single-vendor panel fails lint | `Q0033-lint` |
| 9 | `harness run` performs the same validation first, from disk | `Q0033-cli`, `Q0033-lint` |
| 10 | A gate answer is never defaulted, and never silently invented | `Q0033-cli` (S10.7/E7 also need `Q0033-assets`) |
| 11 | The existing suite stays green, with its assumption made explicit | all five tasks (integration); some are qa-red's own file, some pure regression |
| 12 | Real-CLI evidence is on the record | `manual` |
| 13 | The docs agree with the shipped flow in the same change | `Q0033-docs` |

---

## AC1 — `review.yaml` ships in both places and matches the frozen contract

**S1.1 — Parsed deep-equality against the frozen fixture**
*Tags: Q0033-assets*
**Given** `harness/flows/review.yaml` exists in the repository
**When** it is parsed with `YAML.parse`, its loader-only `file` key removed, and compared to `contracts/Q-0006/review-flow.contract.yaml` parsed the same way
**Then** the two values deep-equal — `consumes: green`, `produces: reviewed`, `cross_vendor: required`, the two-step `code-reviewer` panel on `claude`/`codex` writing `review/round-{round}/{vendor}.md` from `[requirements/merged.md, solution/solution.md]` and `{base}...harness/{id}/integration`, the `verdict` step (`role: code-reviewer`, `adapter: claude`) reading both panel artifacts plus requirement and solution, writing `review/round-{round}/verdict.md` and `review/verdict.md`, `goto: flow:development`, `counter: review`, `max_iterations: 3`, `on_exhausted: gate`, and the closing `gate: human`

**S1.2 — Template copy is byte-identical**
*Tags: Q0033-assets*
**Given** `harness/flows/review.yaml` and `spike/templates/harness/flows/review.yaml` both exist
**When** their bytes are compared
**Then** they are identical

**S1.3 — `harness lint` reports the shipped flow clean**
*Tags: Q0033-assets, Q0033-lint*
**Given** a project initialised from the real `harness/flows/` directory
**When** `harness lint` runs
**Then** it reports `review.yaml` with `✓` and exits `0`
**Note:** jointly owned — a malformed asset (Q0033-assets) or an over-eager new rule (Q0033-lint) can each make this red for the wrong reason; it only passes when both are correct together.

**S1.4 — Flow-directory parity is a named, standing test**
*Tags: Q0033-assets*
**Given** every `.yaml` filename under `harness/flows/`
**When** the corresponding filename is looked up under `spike/templates/harness/flows/`, and vice versa
**Then** every filename has a byte-identical peer on the other side — for all four pre-existing flows (`development.yaml`, `qa-red.yaml`, `requirements.yaml`, `solutioning.yaml`) as well as the newly added `review.yaml`
**Note:** this test does not exist today (`spike/test/smoke.js:175` only asserts no shipped template pins a codex model) — it must be added, not merely kept green.

---

## AC2 — `code-reviewer.md` ships in both places, byte-identical, satisfies contract

**S2.1 — Byte-identical role files**
*Tags: Q0033-assets*
**Given** `harness/roles/code-reviewer.md` and `spike/templates/harness/roles/code-reviewer.md`
**When** `diff` is run between them
**Then** it prints nothing

**S2.2 — No `adapter` or `model` in frontmatter**
*Tags: Q0033-assets*
**Given** the shipped `code-reviewer.md`
**When** its frontmatter is parsed
**Then** it contains neither `adapter` nor `model`, so each review step in `review.yaml` controls its own vendor and no vendor receives another's model alias

**S2.3 — Existing no-pinned-codex-model assertion stays green**
*Tags: Q0033-assets*
**Given** the existing template-walk assertion at `spike/test/smoke.js:175` (no shipped template pins a codex model alias)
**When** the suite runs after `code-reviewer.md` is added to both template trees
**Then** the assertion still passes — the new role introduces no `model` key

**S2.4 — Role body satisfies the persona contract**
*Tags: Q0033-assets*
**Given** the body of `code-reviewer.md`
**When** it is read against `contracts/Q-0006/code-reviewer-role.contract.md`
**Then** it states: reads the supplied requirement, solution and diff; never edits or rewrites code; classifies every finding as exactly `blocker`, `major`, or `nit`; cites every finding as `file:line`
**And** the severity-threshold wording lives only in the verdict step's `instructions` in `review.yaml`, not in the role body

**S2.5 — Negative control: directory-wide role parity is *not* required**
*Tags: Q0033-assets*
**Given** `harness/roles/developer-backend.md` (intentionally divergent from its template peer) and `harness/roles/developer-tooling.md` (repo-local only — confirmed absent from `spike/templates/harness/roles/`, and it is the role `Q0033-cli` itself runs under)
**When** `diff -rq harness/roles spike/templates/harness/roles` is run
**Then** it is non-empty, and the suite asserts that it is non-empty — proving a directory-wide parity rule would be false and confirming only `code-reviewer.md` is compared

---

## AC3 — The flow uses only fields the engine has

**S3.1 — No unsupported fields in the shipped flow**
*Tags: Q0033-assets*
**Given** the parsed `harness/flows/review.yaml`
**When** its steps are inspected
**Then** there is no `type: judge`, no `input: { findings: [...] }`, no `output: { findings: true }` or `tasks: true`, and no `on_fail.with:` anywhere in the file

**S3.2 — `green → red` under `MOCK_ALWAYS_FAIL`**
*Tags: Q0033-assets*
**Given** a ticket at stage `green` and `MOCK_ALWAYS_FAIL=1`
**When** `harness run review <id> --adapter mock --gate-answer advance` executes to a terminal state
**Then** the verdict step reports `changes-requested`, the run regresses via `goto: flow:development`, and the ticket's stage becomes `red` (`development`'s `consumes`) — with no change required to `spike/src/adapters/mock.js` (see note below)
**Note:** the `--gate-answer advance` supplied here is never consumed, since the run regresses before any gate is reached — present to prove an offered-but-unneeded answer is silently ignored (E7), not an error.

**S3.3 — `green → reviewed` under `MOCK_ALWAYS_PASS`**
*Tags: Q0033-assets*
**Given** a ticket at stage `green` and `MOCK_ALWAYS_PASS=1`
**When** `harness run review <id> --adapter mock --gate-answer advance` executes
**Then** the verdict step reports `approve` with empty `findings`, and the ticket's stage becomes `reviewed`

**S3.4 — Verdict step's mixed-vendor input passes the existing cross-vendor judge rule**
*Tags: Q0033-assets*
**Given** the verdict step's two named inputs, `review/round-{round}/claude.md` and `review/round-{round}/codex.md`, written by different adapters
**When** the existing `cross_vendor: required` judge check in `spike/src/engine.js` runs over the shipped flow
**Then** it passes — a judge over candidates spanning vendors satisfies the 2026-08-21 refinement, and no new engine code is needed. The verdict step and one panel member (`review-claude`) share `role: code-reviewer` and `adapter: claude`; this is legal because the verdict step is not itself inside the panel's `parallel` group, so AC8's single-vendor-*panel* rule does not apply to it.

**Note on `spike/src/adapters/mock.js`:** no scenario in this ticket requires a change to it. `contracts/Q-0006/mock-adapter-switches.contract.md` already documents `major: src/mock.ts:1 (mock) placeholder finding` as the forced-verdict finding shape, confirmed present in `mock.js` today, which already satisfies `review-artifacts.schema.json`; S3.2 and S3.3 above prove both stage transitions against the file unmodified. This is why errata E-3 dropped `Q0033-mock` — dispatching it would have sent an agent at a file with nothing to do.

---

## AC4 — Both config files declare the review keys

**S4.1 — `repo.max_diff_bytes` is present with a comment, `repo.base_branch` is preserved**
*Tags: Q0033-config*
**Given** `harness/harness.yaml` and `spike/templates/harness/harness.yaml`
**When** their `repo:` block is read
**Then** both carry `base_branch: main` (unchanged, already shipped) and the newly added `max_diff_bytes: 200000`, each with a one-line comment explaining its purpose — confirmed absent from both files today

**S4.2 — Omitting both keys stays valid**
*Tags: Q0033-config*
**Given** a fixture ticket at stage `green` and a fixture project whose `harness/harness.yaml` has no `repo:` block at all
**When** `harness run review <id> --adapter mock` runs to completion
**Then** it completes without an error naming a missing `base_branch` ref or a diff-size violation, proving `{base}` resolved to `main` and the diff-size limit resolved to `200000` purely from the engine's own fallback — proven by driving a real run, not by grepping `engine.js`'s source for the fallback literal

**S4.3 — Omitting only `max_diff_bytes` stays valid**
*Tags: Q0033-config*
**Given** a fixture project's `harness.yaml` with `repo: { base_branch: develop }` and no `max_diff_bytes`, and a fixture ticket whose integration branch is reachable from `develop`
**When** `harness run review <id> --adapter mock` runs
**Then** it completes using `develop` as `{base}` and `200000` as the resolved diff-size limit

---

## AC5 — `harness init` discovers the base branch safely

**S5.1 — Named non-`main` branch is discovered**
*Tags: Q0033-cli*
**Given** a fresh repository on branch `master` (`git init -b master && git commit --allow-empty -m init`)
**When** `harness init` runs inside it
**Then** `harness/harness.yaml` is written with `base_branch: master` and `max_diff_bytes: 200000`

**S5.2 — Nameable unborn HEAD is a discovery success**
*Tags: Q0033-cli*
**Given** a freshly `git init -b master`-ed directory with **no commits** (unborn HEAD, but Git can still name the branch)
**When** `harness init` runs
**Then** it writes `base_branch: master` — an unborn HEAD whose branch Git can name is a success, not a fallback

**S5.3 — Outside a Git repository, fallback to `main`**
*Tags: Q0033-cli*
**Given** a plain directory that is not a Git repository
**When** `harness init` runs
**Then** it writes `base_branch: main`, exits `0`, and prints no Git error or stderr output

**S5.4 — Detached HEAD, fallback to `main`**
*Tags: Q0033-cli*
**Given** a repository checked out at a detached HEAD (`git checkout --detach HEAD`)
**When** `harness init` runs
**Then** it writes `base_branch: main` and exits `0`

**S5.5 — HEAD names no branch, fallback to `main`**
*Tags: Q0033-cli*
**Given** a repository where HEAD is not on any branch, reproduced concretely as a mid-rebase state (`git rebase --onto` stopped with a conflict, leaving HEAD detached with a rebase in progress) rather than asserted by comment
**When** `harness init` runs
**Then** it writes `base_branch: main`, exits `0`, and the Git subprocess itself succeeded (exit 0, empty branch name) — distinct from E5's "the Git subprocess itself failed"

**S5.6 — Discovery touches only `base_branch`**
*Tags: Q0033-cli*
**Given** any successful discovery (S5.1 or S5.2)
**When** the written `harness.yaml` is inspected
**Then** `max_diff_bytes` remains `200000` and no other key changes

**S5.7 — Comment- and formatting-preserving edit**
*Tags: Q0033-cli*
**Given** the copied template `harness.yaml`, including its `commands.install` comment and the new `repo.base_branch` / `repo.max_diff_bytes` comments
**When** `init` rewrites `base_branch` on a non-`main` branch (S5.1)
**Then** the `commands.install` comment and both `repo` comments are still present — a parsed-value comparison alone is insufficient, since a `YAML.parse` + `YAML.stringify` round-trip would silently strip every comment while still passing one

---

## AC6 — Cross-flow targets resolve, and the chain must come home

**S6.1 — Real shipped chain: `review → development` (one hop, direct match)**
*Tags: Q0033-lint*
**Given** the real `harness/flows/` directory including the shipped `review.yaml` (`goto: flow:development`)
**When** the whole-directory validator runs
**Then** it resolves `development`, finds its `produces` (`green`) equals `review`'s `consumes` (`green`) immediately, and reports no error for this edge

**S6.2 — Positive fixture: multi-hop chain `review → qa-red`**
*Tags: Q0033-lint*
**Given** a temporary harness directory containing copies of all shipped flows plus a modified `review` flow whose `goto` targets `flow:qa-red` instead of `flow:development`
**When** the validator walks from `qa-red`'s `produces` (`red`) through the flow consuming `red` (`development`, `produces: green`) until it reaches `review`'s `consumes` (`green`)
**Then** the two-hop chain resolves with no error
**And** no shipped flow file is mutated to build this fixture

**S6.3 — Missing target**
*Tags: Q0033-lint*
**Given** a temporary flow whose `on_fail.goto` is `flow:nonexistent`
**When** the validator runs
**Then** it fails, naming the source flow, the missing target `nonexistent`, and that no such flow could be loaded

**S6.4 — Unloadable target, diagnostic names the source strictly before the target**
*Tags: Q0033-lint*
**Given** a temporary flow whose `on_fail.goto` is `flow:broken`, where `broken.yaml` exists but is unparsable or fails its own structural lint (e.g. duplicate step ids), and `broken` sorts before `review` in a directory read — so a per-file-first implementation would encounter the broken file first
**When** the validator runs
**Then** it fails with a single diagnostic naming the *source* flow (`review`) strictly before the target (`broken`) — the assertion requires `/review[\s\S]*broken/` with no alternate branch that would also accept the reverse ordering, distinct from S6.3's "missing" diagnostic

**S6.5 — Dead end**
*Tags: Q0033-lint*
**Given** a temporary target flow whose `produces` stage has no flow consuming it anywhere in the fixture directory
**When** the validator walks from that stage
**Then** it fails, naming the source flow, the target flow, and the stage where the chain dies

**S6.6 — Reached-stage ambiguity**
*Tags: Q0033-lint*
**Given** two temporary flows that both declare `consumes: <same-stage>`, where `<same-stage>` is a stage the return-chain walk actually reaches
**When** the validator runs
**Then** it fails, naming the source flow, the target flow, the ambiguous stage, and both implicated flows

**S6.7 — Unreached ambiguity does not fail**
*Tags: Q0033-lint*
**Given** two temporary flows that both declare `consumes: <same-stage>`, where `<same-stage>` is never reached by any return-chain walk in the fixture directory
**When** the validator runs
**Then** it reports no error — ambiguity is only a problem on a stage the walk actually reaches

**S6.8 — Cycle**
*Tags: Q0033-lint*
**Given** two temporary flows, A (`consumes: x`, `produces: y`) and B (`consumes: y`, `produces: x`), and a source flow whose `goto` targets one of them, with neither ever producing the source's `consumes` stage
**When** the validator walks the chain
**Then** it terminates (via the `(flow, stage)` visited set) rather than hanging, and fails naming the source flow, the target, and the implicated flows in the cycle

**S6.9 — Self-target dies at `reviewed`**
*Tags: Q0033-lint*
**Given** a temporary copy of `review.yaml` with `goto: flow:review` (targeting itself)
**When** the validator walks from `review`'s own `produces` (`reviewed`)
**Then** it fails as a dead end at stage `reviewed`, because no shipped flow yet consumes `reviewed`

**S6.10 — Repeated `(flow, stage)` pair is rejected as a cycle, not silently deduplicated**
*Tags: Q0033-lint*
**Given** the cycle fixture of S6.8
**When** the walk revisits the same `(flow, stage)` pair a second time
**Then** the walk stops at that revisit and reports the cycle rather than looping again

**Implementation caution:** `spike/src/engine.js` currently loads and lints each flow file independently — neither `harness lint` nor `harness run` sees more than one flow file's contents today, so every scenario above (and AC9's whole-directory checks) depends on `Q0033-lint` adding genuinely new cross-file logic, not extending a check that already has directory visibility. It must also leave `lintFlow`/`FlowError` re-exported from `spike/src/engine.js` (see "How to read this document").

---

## AC7 — Bounds and counter spelling are checked

**S7.1 — Missing `max_iterations` fails**
*Tags: Q0033-lint*
**Given** an `on_fail` block with no `max_iterations` key
**When** the validator runs
**Then** it fails, naming the step and the field

**S7.2 — Non-integer `max_iterations` fails**
*Tags: Q0033-lint*
**Given** `on_fail: { max_iterations: "three" }`
**When** the validator runs
**Then** it fails, naming the step and the field

**S7.3 — Fractional `max_iterations` fails**
*Tags: Q0033-lint*
**Given** `on_fail: { max_iterations: 1.5 }`
**When** the validator runs
**Then** it fails, naming the step and the field

**S7.4 — `max_iterations: 0` fails (regression fix)**
*Tags: Q0033-lint*
**Given** `on_fail: { max_iterations: 0 }`
**When** the validator runs
**Then** it fails, naming the step and the field
**Note:** today's `lintFlow` (`Number.isInteger(0) === true`) incorrectly accepts this — confirmed by reading the current check. This must fail on `main` as it stands and pass only once the fix lands.

**S7.5 — Negative `max_iterations` fails**
*Tags: Q0033-lint*
**Given** `on_fail: { max_iterations: -1 }`
**When** the validator runs
**Then** it fails, naming the step and the field
**Note:** also currently accepted (`Number.isInteger(-1) === true`) — same regression class as S7.4.

**S7.6 — Prefixed `counter` is rejected with the corrected spelling**
*Tags: Q0033-lint*
**Given** `on_fail: { counter: "iterations.review", max_iterations: 3 }`
**When** the validator runs
**Then** it fails with a message naming the step, the offending value `iterations.review`, and the corrected spelling `review` — the prefixed form would create a literal `"iterations.review"` key nested inside the `iterations` object rather than a flat key
**Note:** `counter` is not validated at all today — confirmed absent from the current `lintFlow`.

**S7.7 — Empty `counter` fails**
*Tags: Q0033-lint*
**Given** `on_fail: { counter: "", max_iterations: 3 }`
**When** the validator runs
**Then** it fails, naming the step and the field

**S7.8 — Valid bound and counter pass (shipped case)**
*Tags: Q0033-lint*
**Given** the shipped `review.yaml`'s verdict step, `on_fail: { counter: review, max_iterations: 3, on_exhausted: gate }`
**When** the validator runs
**Then** it reports no error for this step

**Implementation caution:** every `Given` above says "an `on_fail` block," not "the verdict step's `on_fail` block." Build at least one S7.x fixture from a plain, non-verdict step's `on_fail` (e.g. attach it to a synthetic single step, not a judge/panel shape) so the rule is proven generic rather than narrowed to the shipped flow's own shape.

---

## AC8 — A single-vendor panel fails lint

**S8.1 — Two same-role steps on the same adapter fail, isolated from the pre-existing judge-input rule**
*Tags: Q0033-lint*
**Given** a temporary `cross_vendor: required` flow built from the shipped panel shape, with both panel members set to `adapter: codex`, and the verdict step's own `adapter` overridden to `claude` — distinct from the panel's shared vendor, so the pre-existing judge-input rule ("at least one input differs from the judge's own vendor") is satisfied trivially and cannot itself fail this fixture
**When** the validator runs
**Then** it fails on the single-vendor-panel rule, naming both member step ids and the shared adapter `codex`
**And** the diagnostic contains that panel-specific wording and does **not** contain the pre-existing judge rule's "written by its own vendor" phrasing, so the assertion is only satisfiable once the new rule ships

**S8.2 — Shipped panel spans two adapters and passes**
*Tags: Q0033-lint*
**Given** the shipped `review.yaml` panel (`review-claude` on `claude`, `review-codex` on `codex`)
**When** the validator runs
**Then** it reports no single-vendor-panel error for this group

**S8.3 — Three-or-more-member panel, still all one vendor, fails**
*Tags: Q0033-lint*
**Given** the same isolation as S8.1 — three `role: code-reviewer` steps all on `adapter: codex`, with the verdict step's own `adapter` set to `claude`
**When** the validator runs
**Then** it fails, naming all three member ids and the shared adapter `codex`, distinguishable from the judge-input rule's message by the same negative assertion as S8.1

**S8.4 — A panel spanning two adapters plus a third on one of those adapters still passes**
*Tags: Q0033-lint*
**Given** a temporary parallel group of three `role: code-reviewer` steps, two on `claude` and one on `codex`
**When** the validator runs
**Then** it reports no error — the rule only requires the group to span at least two adapters, not an even split

**S8.5 — The verdict step's mixed-vendor *input* rule and the panel rule compose without conflict**
*Tags: Q0033-lint*
**Given** the shipped `review.yaml` in full (panel + verdict step)
**When** the validator runs both the new single-vendor-panel rule and the existing cross-vendor judge-input rule
**Then** both pass simultaneously — the panel rule governs the parallel group, the judge rule governs the verdict step's inputs, and (per S3.4) the verdict step sitting outside the panel's `parallel` group is not itself subject to the panel rule

---

## AC9 — `harness run` performs the same validation first, from disk

**S9.1 — An invalid sibling flow blocks the run before any spend**
*Tags: Q0033-cli, Q0033-lint*
**Given** a fixture project whose `harness/flows/` directory contains copies of the flows that ship today (`development.yaml`, `qa-red.yaml`, `requirements.yaml`, `solutioning.yaml`) plus one synthetic sibling flow with an unresolvable `goto: flow:` target, and a ticket at stage `draft`
**When** `harness run requirements <id> --adapter mock` is invoked
**Then** the process exits non-zero, `runs.log` gains **zero** new lines, and the ticket folder gains no new artifacts and no change to `ticket.md`'s `iterations` — an externally observable proxy for "zero adapter calls were made," since a mock call that ran but failed to log would still leave written artifacts behind
**Note:** this fixture deliberately does not involve `review.yaml`, so it is exercisable — and must be red — from the moment qa-red writes it, before any of this ticket's five tasks land.

**S9.2 — Preflight validates pristine files, before the `--adapter mock` override collapses vendors**
*Tags: Q0033-cli*
**Given** the real, on-disk `harness/flows/requirements.yaml`, whose `parallel` group already ships two same-role members (`pm-claude`/`pm-codex`, both `role: product-manager`) on two adapters, under `cross_vendor: required`
**When** `harness run requirements <id> --adapter mock` is invoked (which would collapse both PM steps to `mock` in memory)
**Then** the run does **not** fail the single-vendor-panel rule — the validator loads and checks the pristine files from disk before any `--adapter` override is applied in memory
**Note:** this reuses a flow that ships today; it needs no fixture and no dependency on `Q0033-assets`.

**S9.3 — Identical diagnostic through `lint` and through `run`**
*Tags: Q0033-cli, Q0033-lint*
**Given** the same invalid fixture directory used in S9.1
**When** `harness lint` and `harness run requirements <id> --adapter mock` are each invoked against it
**Then** the two captured diagnostic strings (trimmed of surrounding whitespace and any leading `✗`/ANSI colour markers) are exactly equal, not merely both containing a shared substring

**S9.4 — `harness lint` reports every offending flow in one pass**
*Tags: Q0033-lint*
**Given** a fixture directory with two independently invalid flows (e.g. one with a missing target, one with `max_iterations: 0`)
**When** `harness lint` runs
**Then** it reports both diagnostics in a single invocation and exits non-zero exactly once — not once per offending flow

---

## AC10 — A gate answer is never defaulted, and never silently invented

**S10.1 — Two gates in one run receive different explicit answers in order, proven from `runs.log`**
*Tags: Q0033-cli*
**Given** a fresh ticket at stage `draft` and `MOCK_ALWAYS_FAIL=1`, so `requirements.yaml`'s `head-of-product` step fails once and immediately exhausts its own bound (`max_iterations: 1` — no pre-seeding needed), landing on the exhaustion gate (`kind: human-locked`), which — once answered — proceeds to the flow's closing `gate: human`
**When** `harness run requirements <id> --adapter mock --gate-answer advance --gate-answer abort` is invoked
**Then** `runs.log` shows, in this order: an `exhausted stage=draft→draft cost=0` line, a `gate=human-locked answer=advance` line, a `gate=human answer=abort` line, and a terminal `aborted stage=draft→draft cost=… tokens=…` line
**And** the ticket's stage is unchanged (`draft`) and the process exits non-zero
**Note:** rebuilt on the `requirements` flow rather than `review` — the round-4 report found this group dying on `review.yaml`'s absence before a single assertion about gate-answer ordering ran, and nothing about "two gates, answered in order" requires the review flow specifically.

**S10.2 — `--gate-answer` is repeatable and does not overwrite (parser fix)**
*Tags: Q0033-cli*
**Given** the current flag parser in `spike/bin/harness.js` (around its `for` loop over `process.argv`), which stores each `--flag value` pair by overwriting `flags[k]`
**When** `--gate-answer advance --gate-answer abort` is parsed
**Then** both values are retained as an ordered list — scoped to `--gate-answer` only; all other flags keep last-wins behavior (see E3)

**S10.3 — Explicit answer requires the exact word; a prefix is rejected**
*Tags: Q0033-cli*
**Given** a fresh ticket at stage `draft`, `MOCK_ALWAYS_PASS=1` so `requirements.yaml` reaches its closing `gate: human` directly
**When** `--gate-answer ad` is supplied (a prefix of `advance`)
**Then** the process exits non-zero with an error naming the gate — explicit flag values must be exact full words after trim/case-normalization, unlike the forgiving prefix matching interactive TTY input still accepts

**S10.4 — Non-TTY stdin with no remaining explicit answers**
*Tags: Q0033-cli*
**Given** the same closing-gate fixture as S10.3, with no `--gate-answer` supplied and stdin not a TTY (e.g. closed/piped from `/dev/null`)
**When** the run reaches the gate
**Then** the process exits non-zero with an error naming the gate; it neither blocks nor defaults to `advance` — this holds even if data happens to be waiting on a non-TTY stdin (a pipe with unconsumed bytes still counts as non-TTY and still errors; see S11.7, where a pending piped answer is never read for exactly this reason)
**Note:** today's `ui.gate` (`spike/bin/harness.js`) has no TTY check at all — it always opens a `readline` interface and resolves via the stream's `close` event, so a pipe with pending, unconsumed data would currently be read rather than rejected. This scenario is genuinely new behaviour Q0033-cli must add, not an existing property this document merely pins.

**S10.5 — Missing, empty, or unrecognised interactive answer**
*Tags: Q0033-cli*
**Given** an interactive TTY session at a gate
**When** the user submits an empty line, or a word that is none of `advance`/`retry`/`abort` (and no valid prefix of them)
**Then** the process exits non-zero (empty) or re-prompts (unrecognised, per the existing forgiving interactive behavior) — in no case does it default to `advance`

**S10.6 — `--auto` does not answer an exhaustion gate**
*Tags: Q0033-cli*
**Given** a fresh ticket at stage `draft` and `MOCK_ALWAYS_FAIL=1` (the same shape as S10.1, exhausting on the first failure)
**When** `harness run requirements <id> --adapter mock --auto` is invoked with no `--gate-answer`
**Then** the process exits non-zero naming the exhaustion gate as `human-locked`, rather than walking through it — `handleFail` presents it as kind `human-locked`, and `runGate`'s own `kind !== 'human-locked'` check is what makes `--auto` insufficient here; this scenario is the CLI-observable proof of that property, built independently of `smoke.js`'s own equivalent fixture (see S11.1)

**S10.7 — Retry at exhaustion persists `iterations.review = 3`, not `2`**
*Tags: Q0033-cli, Q0033-assets*
**Given** a ticket at stage `green` whose `iterations.review` is already `3` and `MOCK_ALWAYS_FAIL=1`, so `harness run review <id>` immediately exhausts and offers `advance / retry / abort`
**When** `--gate-answer retry` is supplied
**Then** `iterations.review` is persisted as `3` (per Q-0006 errata E-1, `max_iterations`, not `max_iterations - 1`), `runs.log` gets a `gate=retry counter=review set=3` line, and the retry's own regression is the single authorised further traversal
**Note:** this scenario is inherently specific to the review flow's own counter name and cannot be rebuilt on `requirements`. Assert the precondition explicitly — e.g. `assert(fs.existsSync(reviewYamlPath), 'review.yaml must ship before this scenario can run')` — before invoking the run, so a failure before `Q0033-assets` lands reads as "review.yaml must ship," not a raw stack trace naming `engine.js`.

---

## AC11 — The existing suite stays green, with its assumption made explicit

**S11.1 — `spike/test/smoke.js:87-92`'s existing `--auto`-only exhaustion assertion is correct and unchanged**
*Tags: regression only — no dev task change expected; qa-red does not edit this assertion*
**Given** the existing `T-0002`/`requirements`/`MOCK_ALWAYS_FAIL=1` fixture in `smoke.js`, which invokes `harness run requirements T-0002 --adapter mock --auto` with **no** `--gate-answer`
**When** the suite runs, before and after this ticket's implementation lands
**Then** it continues to assert `loop exhausted`, `human-locked`, non-zero exit, that a human-locked gate is never auto-advanced, and — per errata E-3 — that the output matches `/stdin closed without one/i`, because this exact command supplies no explicit answer and stdin is not a TTY
**Why this must not be deleted or weakened:** a round-4 review read this assertion as contradicting a different scenario that supplies `--gate-answer abort` for the *same-shaped* fixture and expects the opposite message. Errata E-3 declines that finding: the two scenarios run different commands (one with an explicit answer, one without), both are correct, and one implementation satisfies both — see E4 for the companion case.

**S11.2 — `spike/test/smoke.js:82-85`'s exhausted-loop assertion is proven by a driven run, not by a test file's contents *(per errata E-2)***
*Tags: qa-red's own artifact — no dev task owns `spike/test/**`, and none may*
**Given** a fixture ticket set up the way `smoke.js`'s existing `T-0002`/`requirements`/`MOCK_ALWAYS_FAIL=1` scenario is set up
**When** the test itself invokes `harness run requirements T-0002 --adapter mock --auto --gate-answer abort` (or the equivalent explicit answer the exhaustion gate requires) as a child process and inspects that child's actual stdout/exit code
**Then** the assertion holds against that real, driven output: `loop exhausted`, `human-locked`, non-zero exit, and that a human-locked gate is never auto-advanced
**What this replaces, and why:** the version this superseded asserted that `smoke.js`'s own source text contains a `--gate-answer … abort` call — grepping a sibling test file rather than running anything. Every development task forbids editing `spike/test/**`, so no task could ever have satisfied that assertion; it was red by construction and unfixable by any agent in the fan-out, which is exactly how it burned a third of this ticket's first development loop before errata E-1 traced the cause.

**S11.3 — `harness board` displays the persisted review counter**
*Tags: regression only — no dev task change expected; depends on Q0033-lint shipping `counter: review` (not `iterations.review`)*
**Given** a ticket with `iterations.review: 2` persisted in `ticket.md`
**When** `harness board` runs
**Then** its output includes `iter={…}` containing the review counter — no production change to `board` is required, only this regression assertion

**S11.4 — Cost is counted once across an exhaustion event and its terminal event**
*Tags: regression only — pre-existing Q-0006 engine behaviour, no task change expected*
**Given** a run that exhausts the review loop (`exhausted`, `cost: 0`) and is then answered, producing a second terminal event (`completed`/`regressed`/`aborted`) carrying the measured cost
**When** `harness board`'s cost roll-up is computed for that ticket
**Then** the measured cost is counted exactly once — not doubled by the zero-cost exhaustion event, and not lost

**S11.5 — Frozen-input guard: no drift in `contracts/Q-0006/`**
*Tags: guards all five tasks — qa-red's own artifact*
**Given** the repository at the tip of the Q-0033 branch and baseline commit `5d16e06`, reachable in this environment
**When** `git diff --quiet 5d16e06 -- contracts/Q-0006/` runs as part of the suite
**Then** it exits `0` (no diff) — proving none of the five fan-out tasks touched a frozen Q-0006 contract

**S11.6 — Frozen-input guard skips cleanly when its baseline is unreachable**
*Tags: qa-red's own artifact — test infrastructure only*
**Given** the frozen-input guard invoked against a fixed, syntactically valid but deliberately nonexistent commit SHA (not `5d16e06`)
**When** the guard runs against that SHA
**Then** it skips with a message naming the unavailable SHA as the unreachable baseline, rather than surfacing a raw Git error or silently claiming parity was verified — reported on its own line (`SKIP S11.6: …`), never nested inside another scenario's `✓`

**S11.7 — `spike/test/smoke.js:185-220`'s retry-semantics test answers its gates with `--gate-answer`, not a piped `'retry\n'`**
*Tags: qa-red's own artifact — no dev task owns `spike/test/**`, and none may*
**Given** the existing retry-semantics fixture (a fresh ticket, `MOCK_ALWAYS_FAIL=1`, `requirements` flow) whose current implementation spawns the child with `stdio: ['pipe', 'ignore', 'ignore']`, writes `child.stdin.write('retry\n')` to answer the first exhaustion gate, deliberately leaves the second gate unanswered, and ends the process with a busy-wait against `runs.log` followed by `SIGINT`
**When** `Q0033-cli` ships and non-TTY stdin becomes an immediate error the moment a gate needs an answer — checked before any read is attempted, not merely on stream close as today's implementation does
**Then** the pending `'retry\n'` on the pipe is never consumed — the process exits immediately, non-zero, at the *first* exhaustion gate, because non-TTY stdin errors regardless of what is waiting to be read from it
**And** the fix is to pass `--gate-answer retry` on the command line for the exhaustion gate and supply no answer for the second, then wait for the process to exit on its own rather than polling `runs.log` and sending `SIGINT`
**And** the four existing assertions this test makes are preserved against the same evidence: exactly three `step=head-of-product` traversals in `runs.log`, the line `gate=retry counter=requirements.head-of-product set=1`, the persisted `requirements.head-of-product: 2` in `ticket.md`, and the unrefunded `qa-final.unrelated: 2`
**Why this is qa-red's to fix, not a task's:** identical shape to S11.2 — `spike/test/**` is qa-red's own artifact and every development task is forbidden to touch it.

**S11.8 — The interrupt-at-a-gate test is rewritten: a non-TTY run terminates itself and persists a terminal outcome, not a caught `SIGINT`**
*Tags: qa-red's own artifact — no dev task owns `spike/test/**`, and none may*
**Given** the existing interrupt fixture in `spike/test/smoke.js` (roughly `:224-245`; a fresh ticket driven through `requirements` with `stdio: ['pipe', 'pipe', 'pipe']`), whose current implementation waits for the run to reach the closing `gate: human`, sends `SIGINT`, and asserts an ` interrupted ` line reaches `runs.log`
**When** `Q0033-cli` ships and the non-TTY check fires the instant the gate is presented, before `readline` is ever created or any read attempted
**Then** the original mechanism is unreachable by construction — a pipe is not a TTY, so the run no longer blocks at the gate; it exits immediately, non-zero, before `SIGINT` can reach a process that is still running
**And** the rewritten test drives the same fixture through the same piped, unanswered gate and asserts, against that immediate exit, that (a) a terminal outcome (`failed` or `aborted`) is written to `runs.log`, not silently dropped, and (b) the step's persisted iteration counter is unchanged from its value immediately before the run, proving no iteration budget is refunded by an unanswered, self-terminating gate
**The cost is explicit rather than silent:** `SIGINT`-at-a-gate is no longer covered by the automated suite — a real terminal (stdin is a TTY) still blocks at a gate exactly as before, this ticket makes no change to that path, but the non-interactive automated test for the interrupt case is traded for a test of what non-TTY behaviour actually guarantees.

---

## AC12 — Real-CLI evidence is on the record

**S12.1 — Manual closing-gate evidence, real vendors, real diff (not automated)**
*Tags: manual*
**Given** Q-0033's automated implementation is integrated and green, and the maintainer has authenticated Claude Code and Codex CLI logins
**When** the maintainer runs `harness run review Q-0006` for real (spending both subscriptions)
**Then** the maintainer records in Q-0033's ticket folder that both reviewers received the harness-materialised diff under plan / read-only sandbox, and that the verdict applied the severity threshold as instructed — never delegated to development fan-out, never automated; if a suite reports this group's status at all, it logs it as skipped/manual rather than an unqualified `✓`

---

## AC13 — The docs agree with the shipped flow in the same change

**S13.1 — SDLC spec state diagram routes rejection to the derived stage**
*Tags: Q0033-docs*
**Given** the `docs/02-sdlc-pipeline-spec.md` §3.4 block, bounded from its heading to the next `##`/`###` heading
**When** the line containing the `(review fail, …)` label is located, and the box-drawing connector run (`└`, `─`, `┘`) belonging to that label's own annotation is traced to its two endpoint columns
**Then** those columns are each resolved to the stage label whose header-row span they fall within (tolerating roughly ±1 column for re-spacing), and the resolved pair is `(red, reviewed)` — the check fails if it resolves to `(green, reviewed)`, which is what the diagram draws today (confirmed by reading the current diagram)
**Note:** scan only the label's own connector run, not any glyph at a shared column anywhere in the block — the diagram carries two other loops ("qa: dev issue", "qa: design issue") whose arrows occupy overlapping columns, so a whole-block scan can pass regardless of whether the review-fail loop specifically is correct.

**S13.2 — §5.5's example flow matches what ships**
*Tags: Q0033-docs*
**Given** `docs/02-sdlc-pipeline-spec.md` §5.5, bounded from its heading to the next section heading
**When** its review flow example is read
**Then** it shows the three-dot `{base}...harness/{id}/integration` diff in the correct direction, `{round}` (not `{iter}`), unprefixed `counter: review`, no `type: judge`, no `findings:`/`tasks:`/`with:` fields, and no pinned model name — replacing today's `model: opus` / `model: gpt-5`, `"harness/T-{id}..main"`, `{iter}`, and `counter: iterations.review` (all confirmed present in §5.5 as it reads today)

**Note — `Q0033-docs`'s description still mentions §5.3:** `solution/tasks.yaml`'s `Q0033-docs` description still says "§5.3 still shows `model: gpt-5`," though `AC13`/`S13.2` scope the no-pinned-model fix to §5.5 only — matching the merged requirement's literal text. `model: gpt-5` in fact recurs across §5.1, §5.2 (twice), §5.3, §5.4 (in a prose roles example), and §5.6 — seven occurrences outside this ticket's stated scope. Following the instruction literally does no harm, since nothing in this document checks §5.3, but it is scope the task description names and no criterion or scenario verifies; narrowing the description to §5.5 is an architect-gate cleanup, not something qa-red can resolve by widening a scenario beyond what AC13 asks for.

**S13.3 — §5.5 describes the configured base, size limit, and exhaustion behavior**
*Tags: Q0033-docs*
**Given** the same section
**When** it is read
**Then** it states the configured base branch, the `repo.max_diff_bytes` limit, and that the exhaustion gate cannot be bypassed by `--auto`

**S13.4 — §10 question 1 is answered: no lighter M1 fix flow**
*Tags: Q0033-docs*
**Given** `docs/02-sdlc-pipeline-spec.md` §10, open question 1 (full development vs. a lighter `fix` flow)
**When** it is read
**Then** it is answered "no lighter flow for M1", matching the ticket's non-goals

**S13.5 — Development plan reflects the Q-0006/Q-0033 split**
*Tags: Q0033-docs*
**Given** `docs/06-development-plan.md`'s M1 block, bounded from the `## M1` heading (a top-level `## ` heading, matched by line, not by a regex end-of-string anchor) to the next top-level `## ` heading
**When** that bounded block is read
**Then** its tickets list attributes the engine to Q-0006 and the shipped surface to Q-0033 — text already shipping today
**And** the block's "Done when" bullets — specifically, not the tickets list — name the shipped review surface (e.g. the CLI preflight, lint rules, config discovery, or documentation alignment this ticket ships), which they do not today: the current three bullets describe only the engine's contracts-to-tests mechanism, the fan-out, and `review.yaml` existing and running once
**Note:** bound the block by locating the `## M1` heading line and the next line starting with `## ` (two literal `#` characters followed by a space) via line-based string search, not a JavaScript regex using `\z` — that sequence is not an end-of-string anchor in JavaScript and is read as a literal `z`, which happened to work only because no lowercase `z` preceded the next heading in the version it was written against.

**S13.6 — DECISIONS.md gains exactly two new, correctly-formatted entries**
*Tags: Q0033-docs*
**Given** `docs/DECISIONS.md` (append-only)
**When** the file is read after this ticket
**Then** it contains one new entry for the derived regression target and one for the non-auto exhaustion gate, each with a dated title, **Decision**, **Alternatives considered**, and **Why**, and every prior entry is unchanged
**Note:** assert the two entries independently, each with a message naming which one is being checked (e.g. `'DECISIONS.md is missing the derived-regression-target entry'` / `'DECISIONS.md is missing the non-auto-exhaustion-gate entry'`) rather than one bare `assert.ok` covering both, so a failure identifies which is missing.

**S13.7 — GLOSSARY.md distinguishes the two `human-locked` uses**
*Tags: Q0033-docs*
**Given** `docs/GLOSSARY.md`'s **Gate** entry
**When** it is read
**Then** it gains a sentence distinguishing an author-declared `human-locked` gate (deploy's) from the engine-presented exhaustion gate that reuses the same `kind`, introduces no new synonym for an existing term, and leaves **Role** unchanged

**S13.8 — README is untouched**
*Tags: Q0033-docs*
**Given** `README.md` at baseline commit `5d16e06`
**When** `git diff --quiet 5d16e06 -- README.md` is run against the tip of the Q-0033 branch (the same baseline-diff pattern S11.5 uses, not a diff against a moving `HEAD`)
**Then** it exits `0` (no diff) — unchanged by this ticket, since that rewrite belongs to Q-0028 in M6
**Note:** `solution/tasks.yaml`'s `Q0033-docs` no longer lists `README.md` among its owned files or instructs any edit to it (errata E-3 struck that clause) — this is a straightforward regression check, not a task deliverable, and no finding needs to be carried forward about it.

---

## Cross-cutting edge cases

**E1 — Ordering bug would otherwise be invisible**
*Tags: Q0033-cli, Q0033-lint*
**Given** preflight validation were (hypothetically) run *after* the `--adapter mock` override instead of before it
**When** any mock run of a two-vendor, same-role parallel group executed — e.g. `requirements.yaml`'s own PM panel
**Then** it would incorrectly fail the single-vendor-panel rule on every single mock run of that flow — S9.2 is the regression test that pins the correct ordering

**E2 — Return-chain validator must survive stages that don't exist yet**
*Tags: Q0033-lint*
**Given** the validator is written and tested against today's five flows
**When** `qa-final.yaml` and `deploy.yaml` land later (Q-0012) and stage `reviewed` gains a second consumer
**Then** the visited-set rule (S6.8/S6.10) and "ambiguity only on a reached stage" rule (S6.6/S6.7) are what keep the then-correct multi-consumer flow set from failing lint — no test in this ticket can exercise the future flows directly, so a suite reporting this group's status logs it as a forward-looking guarantee (`SKIP E2: …`), not an unqualified `✓`

**E3 — `--gate-answer` scoping does not leak into other flags, proven behaviourally**
*Tags: Q0033-cli*
**Given** `--adapter doesnotexist --adapter mock` (repeating a flag other than `--gate-answer`, with a deliberately unknown first value)
**When** a run is invoked with this flag pair
**Then** the run proceeds successfully under `mock` — proving `mock` (the last value) is what actually took effect, not merely that some unspecified value won: if the first-supplied value had taken effect instead, the run would fail immediately on an unrecognised adapter

**E4 — Non-TTY explicit-answer exhaustion is distinguished from `--auto` exhaustion, and does not read as a stdin-closed rejection**
*Tags: Q0033-cli*
**Given** the same exhausted-loop fixture as S10.6
**When** `--gate-answer advance` **is** supplied (unlike S10.6, where none was)
**Then** the exhaustion gate is answered from the explicit flag and the run proceeds, and the output does **not** match `/stdin closed without one/i` — confirming `--auto` alone is what's rejected, not exhaustion gates in general, and that supplying an explicit answer takes a genuinely different path from the one S11.1 pins for the no-answer case
**Note:** this is the direct companion to S11.1, deliberately proving the opposite outcome for the opposite command — see errata E-3's resolution of why these two are not a contradiction.

**E5 — `init` never fails the whole command when the Git subprocess itself errors, as opposed to merely finding nothing to name**
*Tags: Q0033-cli*
**Given** a directory where the template copy succeeds but the branch-discovery Git subprocess itself fails to run — reproduced by pointing discovery at a corrupted or unreadable `.git` (e.g. `.git/HEAD` made unreadable), which exits non-zero rather than returning an empty name
**When** `harness init` runs
**Then** it still exits `0` with `harness/` and `backlog/` created and `base_branch: main` retained — discovery is best-effort and never turns a successful `init` into a failure, and no Git stderr reaches the user

**E6 — A config migration is deliberately not required**
*Tags: Q0033-config*
**Given** an existing project's `harness.yaml` predating this ticket, with a `repo:` block that has `base_branch` but no `max_diff_bytes`
**When** that config is loaded after this ticket ships
**Then** it remains valid with no migration step, no warning, and no forced rewrite — the same case as S4.3, restated because `solution.md` explicitly names "a config migration" as a rejected alternative

**E7 — An offered-but-unneeded `--gate-answer` is silently ignored, not an error**
*Tags: Q0033-cli, Q0033-assets*
**Given** S3.2's run, which supplies `--gate-answer advance` but regresses via `goto: flow:development` before reaching any gate
**When** the run completes
**Then** the unconsumed answer causes no error and no warning
**Note:** like S10.7, this depends on `review.yaml` existing; assert the precondition explicitly rather than letting a pre-`Q0033-assets` failure read as an unrelated crash.

**E8 — Branch provenance is proven by the suite itself, not by a paste into a generated file**
*Tags: qa-red's own artifact — test infrastructure only*
**Given** the tip of the branch this suite runs on (e.g. `harness/Q-0033/tests`) and `main`
**When** the suite runs `git merge-base main <this-branch>` and `git diff --name-only <that merge-base> <this-branch>`
**Then** it asserts the diff is limited to the expected new paths for this round — the three `contracts/Q-0033/*` files and this ticket's own `spike/test/**` additions — and prints the merge-base commit and the path list as part of its own output
**Why this replaces a prior instruction:** an earlier round of this document asked for the same two commands to be run manually and their output pasted into `qa/red-integration.md`. That file is written by the engine at every `prove-red` and overwritten on the next run, so nothing pasted into it survives — the check must live in code the suite actually executes, not in prose describing a paste a human or agent would have to repeat by hand each round.

**E9 — The report keeps every result line regardless of output size**
*Tags: regression only — already fixed directly in `spike/src/engine.js` (`testReport`), not a task deliverable*
**Given** a combined test run whose total output exceeds `testReport`'s `maxBytes`
**When** `qa/red-report.md` (or the equivalent captured output) is generated
**Then** it contains an "Every result line" section listing every line matching the result-line pattern (`✓`/`✗`, `ok`/`not ok`, `#`, numbered, or `PASS`/`FAIL`/`SKIP`) drawn from the *entire* output, not just the untruncated tail — proven by including a scenario known to run early (e.g. one of `smoke.js`'s first assertions) in the roster even when the combined output is large enough that a tail-only report would have dropped it
**Why this is pinned rather than newly required:** the report used to be the last 8000 characters of output, which silently dropped more than half of round 4's failing groups from its own report — the gate was judging evidence with its beginning missing. This is already fixed (commit `ce26288`); this scenario exists so a future change cannot regress it without a test noticing.
