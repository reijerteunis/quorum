### document
# Scenarios — Q-0033, qa-red

*Author: automation-qa. Ticket Q-0033, stage solutioned → red. Built against `requirements/merged.md`
(13 criteria), `solution/solution.md`, `solution/tasks.yaml` (five tasks: `Q0033-cli`, `Q0033-lint`,
`Q0033-config`, `Q0033-assets`, `Q0033-docs`), `solution/errata.md` (E-1…E-3), and the findings of
`qa/scenario-review.md` dated 2026-08-23. This revision applies every item under that review's
§5 "What must be true before this passes" and keeps everything in its §4 "What is right, and
should survive the revision".*

Every scenario states what must be true of the system, not how the test is coded. `[owner]` tags
name the task(s) whose code the scenario exercises; `[qa-red]` marks a fixture, regression or
guard that qa-red owns outright because no development task may touch it (either it asserts
qa-red's own artifact, or it is a positive/negative control built in a temporary fixture rather
than against a shipped file). `[manual]` marks the one criterion the requirement forbids
automating.

Two questions were asked of every scenario before it was written, per the `automation-qa` role's
own standing instruction: **can any task fix this, given what it owns?** and **will it still pass
once the feature exists?** Where a candidate scenario failed either question it is not below —
see "Fixes applied from the review" at the end for the two cases that failed the second question
and had to be rewritten rather than dropped.

## Coverage

| AC | Scenario ids | Owner(s) |
| --- | --- | --- |
| 1 | S1.1–S1.4 | Q0033-assets, Q0033-lint |
| 2 | S2.1–S2.5 | Q0033-assets |
| 3 | S3.1–S3.4 | Q0033-assets, qa-red |
| 4 | S4.1–S4.3, E6 | Q0033-config, qa-red |
| 5 | S5.1–S5.7, E5 | Q0033-cli, qa-red |
| 6 | S6.2–S6.10 (S6.1 folded into S1.3) | Q0033-lint |
| 7 | S7.1–S7.7 (S7.8 folded into S8.2) | Q0033-lint |
| 8 | S8.1–S8.4 (S8.5 folded into S1.3) | Q0033-lint, qa-red |
| 9 | S9.1–S9.4, E1 | Q0033-cli, Q0033-lint, qa-red |
| 10 | S10.1–S10.7, E3, E4 | Q0033-cli, Q0033-assets, qa-red |
| 11 | S11.1–S11.8, E7, E8, E9 | qa-red |
| 12 | S12.1 (SKIP — manual) | manual |
| 13 | S13.1–S13.8 | Q0033-docs, qa-red |

No criterion is uncovered. `S11.5` and `S13.8` are guards that must stay green throughout every
round of this ticket — they prove nothing is being touched that must not be.

---

## AC1 — `review.yaml` ships in both places and matches the frozen contract

**S1.1** `[Q0033-assets]`
Given `harness/flows/` and `spike/templates/harness/flows/` each currently hold the same four
flows, when `review.yaml` is added to both, then a recursive diff of the two directories reports
no differences.

**S1.2** `[Q0033-assets]`
Given the shipped `harness/flows/review.yaml`, when it is parsed with `YAML.parse` and stripped of
the loader-only `file` key, then it deep-equals `contracts/Q-0006/review-flow.contract.yaml`
parsed the same way: `consumes: green`, `produces: reviewed`, `cross_vendor: required`, a
two-step `code-reviewer` panel on `claude` and `codex` writing `review/round-{round}/{vendor}.md`
from the merged requirement, solution and `{base}...harness/{id}/integration` diff; a verdict step
reading both named panel artifacts plus requirement and solution, writing
`review/round-{round}/verdict.md` and `review/verdict.md`, carrying the threshold instructions,
`goto: flow:development`, `counter: review`, `max_iterations: 3`, `on_exhausted: gate`; and a
closing `gate: human`.

**S1.3** `[Q0033-assets, Q0033-lint]` — also proves S3.4, S6.1, S8.5
Given the shipped `review.yaml` on disk alongside the other four flows, when `harness lint` runs
over `harness/flows/`, then it reports `✓ review.yaml`. This is the flow's integration proof: it
demonstrates simultaneously that the flow uses only supported fields (AC3), that its two `goto:
flow:` edges resolve and return home (AC6), and that its panel and bound/counter pass every rule
Q0033-lint adds (AC7, AC8) — all on the real shipped asset, not a synthetic fixture.

**S1.4** `[Q0033-assets]`
Given the shipped flow, when every step id, adapter and artifact-path template is checked against
the frozen contract, then each matches exactly — in particular the artifact paths are
round-numbered (`review/round-{round}/…`), never iteration-numbered.

## AC2 — `code-reviewer.md` ships in both places, byte-identical, and satisfies its contract

**S2.1** `[Q0033-assets]`
Given `harness/roles/code-reviewer.md` and `spike/templates/harness/roles/code-reviewer.md`, when
diffed, then the diff is empty.

**S2.2** `[Q0033-assets]`
Given the role's frontmatter, when parsed, then it contains neither `adapter` nor `model` —
each step that uses this role controls its own vendor, and no vendor can inherit another's model
alias through the role.

**S2.3** `[Q0033-assets]`
Given the role's body, when read against `contracts/Q-0006/code-reviewer-role.contract.md`, then
it states the reviewer reads the supplied requirement, solution and diff; never edits or rewrites
code; classifies every finding as exactly `blocker`, `major` or `nit`; and cites every finding as
`file:line`. The severity *threshold* wording is absent from the role — it lives in the verdict
step's `instructions` per the solution's boundary.

**S2.4** `[Q0033-assets, qa-red]`
Given the existing smoke assertion that no shipped template pins a codex model
(`spike/test/smoke.js`), when `review.yaml` and `code-reviewer.md` are added to the template tree,
then that assertion still passes — neither new file names a vendor model alias.

**S2.5** `[qa-red]` — negative control
Given the full `harness/roles/` and `spike/templates/harness/roles/` directories (not just
`code-reviewer.md`), when diffed recursively, then the diff is **not** empty —
`developer-backend.md` legitimately differs between repo and template and
`developer-tooling.md` is repo-local. This proves AC2's parity claim is scoped to the one
designated file, and that a whole-directory parity rule would be false to write.

## AC3 — The flow uses only fields the engine has

**S3.1** `[Q0033-assets]`
Given the shipped `review.yaml`, when every step is inspected, then none declares `type: judge`,
an `input: { findings: [...] }`, an `output: { findings: true }` or `output: { tasks: true }`, or
an `on_fail.with`.

**S3.2** `[Q0033-assets, qa-red]`
Given a ticket fixture at stage `green`, when `harness run review <id> --adapter mock` executes
under `MOCK_ALWAYS_FAIL`, then the ticket regresses to `development`'s stage (the derived
cross-flow target) with no change required in `spike/src/**`, and the process exits `0` (a
regression is a completed run, not a crash).

**S3.3** `[Q0033-assets, qa-red]`
Given the same fixture, when the run executes under `MOCK_ALWAYS_PASS`, then the ticket advances
to `reviewed` with no change required in `spike/src/**`.

**S3.4** — folded into **S1.3**: the shipped flow's clean `harness lint` pass is itself proof it
carries no unsupported field, since an unsupported step shape fails structural validation.

## AC4 — Both config files declare the review keys

**S4.1** `[Q0033-config]`
Given `harness/harness.yaml` and `spike/templates/harness/harness.yaml`, when read, then both
declare `repo.base_branch` (pre-existing) and `repo.max_diff_bytes: 200000` (new), each with a
one-line comment stating what the key does.

**S4.2** `[Q0033-config, qa-red]`
Given a `harness.yaml` with the entire `repo` block omitted, when loaded, then it remains valid
and `base_branch` resolves to `main` and `max_diff_bytes` resolves to `200000`.

**S4.3** `[Q0033-config, qa-red]`
Given an existing project's `harness.yaml` authored before this ticket (carrying only
`base_branch`), when loaded by the current engine, then it remains valid — no existing config file
is made invalid by the new key.

**E6** `[Q0033-config, qa-red]` — edge case
Given a `harness.yaml` that sets only one of `base_branch` or `max_diff_bytes`, when loaded, then
the other key resolves to its default independently — the two keys are optional independently of
each other, not as a pair.

## AC5 — `harness init` discovers the base branch safely

**S5.1** `[Q0033-cli]`
Given a fresh repository on branch `master`, when `harness init` runs, then the copied
`harness.yaml` has `base_branch: master` and `max_diff_bytes: 200000`.

**S5.2** `[Q0033-cli]`
Given a target directory that is not a git repository, when `harness init` runs, then
`base_branch` remains `main`, `init` exits `0`, and no git diagnostic reaches the user.

**S5.3** `[Q0033-cli]`
Given a repository in detached HEAD, when `harness init` runs, then `base_branch` remains `main`
and `init` still exits `0`.

**S5.4** `[Q0033-cli]`
Given a repository with an unborn HEAD that git *can* name (e.g. a fresh `git init -b master`
before the first commit), when `harness init` runs, then `base_branch` is discovered as `master` —
a nameable unborn HEAD is a discovery success, not a fallback case.

**S5.5** `[Q0033-cli, qa-red]`
Given a repository whose current branch git cannot name (asserted directly via
`git branch --show-current` returning empty, rather than reproducing a fragile mid-rebase state),
when `harness init` runs, then `base_branch` falls back to `main` and `init` exits `0`.

**S5.6** `[Q0033-cli]`
Given `init` has discovered a branch, when it writes `base_branch`, then only that scalar changes
— every other key and every existing comment, including `commands.install`'s rationale and the
two new repository comments, survive byte-for-byte.

**S5.7** `[Q0033-cli, qa-red]`
Given a repository whose current branch is deliberately not `main` (e.g. `develop`), when
`harness init` runs, then `base_branch` is written as `develop` — the automated non-`main`-branch
test the criterion requires.

**E5** `[Q0033-cli, qa-red]` — edge case
Given a git subprocess failure of any other kind during discovery, when `harness init` runs, then
the failure is swallowed, `base_branch` falls back to `main`, and `init`'s own exit code is
unaffected — a git failure never fails `init`.

## AC6 — Cross-flow targets resolve, and the chain must come home

**S6.1** — folded into **S1.3**: `review → development` and `review → qa-red` are the positive
fixtures, proven resolving and returning home by the shipped flow's clean lint pass.

**S6.2** `[Q0033-lint]`
Given a flow whose `goto: flow:<name>` names a flow file that does not exist, when lint runs, then
it fails naming the source flow and the missing target.

**S6.3** `[Q0033-lint]`
Given a `goto` target that exists on disk but fails to parse, when lint runs, then it fails naming
the source flow, the target flow, and that the target could not be loaded.

**S6.4** `[Q0033-lint]` — positive control
Given a harness where some stage is consumed by two different flows, but the return-chain walk
from a `goto: flow:` edge never reaches that stage, when lint runs, then lint does not fail — an
ambiguity that the walk never reaches is not this rule's concern.

**S6.5** `[Q0033-lint]` — *dead end*
Given a target flow whose `produces` stage has no flow anywhere consuming it, when lint runs, then
it fails naming the source flow, the target flow, and the stage where the chain dies.

**S6.6** `[Q0033-lint]` — *ambiguity, reached*
Given the return-chain walk reaches a stage consumed by two different flows, when lint runs, then
it fails naming the source flow, the ambiguous stage, and both implicated flows.

**S6.7** `[Q0033-lint]` — positive control
Given a harness with unrelated branching elsewhere (a stage with multiple consumers outside any
reached return-chain), when lint runs, then lint does not fail — the criterion's "a stage with two
consumers the walk never reaches does not fail" stated as the general rule, not just the specific
case in S6.4.

**S6.8** `[Q0033-lint]` — *cycle*
Given two flows whose `goto`s point at each other so the walk revisits a `(flow, stage)` pair
without ever reaching the source flow's `consumes` stage, when lint runs, then it fails naming the
repeated pair, and the process terminates rather than hanging.

**S6.9** `[Q0033-lint]` — *self target*
Given a flow whose `goto: flow:<itself>` (e.g. `review → review`) dies at its own `consumes` stage
with no other flow closing the loop, when lint runs, then it fails naming the flow and the stage
where the chain dies.

**S6.10** `[Q0033-lint]` — *repeated pair, three-flow variant*
Given a three-flow chain that revisits a `(flow, stage)` pair without any two flows pointing
directly at each other, when lint runs, then it fails and terminates — proving the visited-set
rule generalises beyond a strict two-flow cycle.

All of S6.2–S6.10's fixtures are built in temporary harness directories scaffolded for the test;
none mutates a shipped flow file (see **E1** under AC9).

## AC7 — Bounds and counter spelling are checked

**S7.1** `[Q0033-lint, qa-red]` — already enforced
Given a step with `max_iterations` missing entirely, when lint runs, then it fails naming the step
and the field.

**S7.2** `[Q0033-lint, qa-red]` — already enforced
Given `max_iterations` set to a non-integer (e.g. a string), when lint runs, then it fails naming
the step and the field.

**S7.3** `[Q0033-lint, qa-red]` — already enforced
Given `max_iterations` set to a fractional number (e.g. `2.5`), when lint runs, then it fails
naming the step and the field.

**S7.4** `[Q0033-lint]` — new
Given `max_iterations: 0`, when lint runs, then it fails naming the step and the field — this is
the bug fix: `0` currently passes because `Number.isInteger(0)` is true.

**S7.5** `[Q0033-lint]` — new
Given `max_iterations: -1`, when lint runs, then it fails naming the step and the field.

**S7.6** `[Q0033-lint]` — new
Given `counter: iterations.review`, when lint runs, then it fails with a message giving the
corrected spelling `review` — the prefixed form would create a literal `"iterations.review"` key
nested inside the runtime's own `iterations` object.

**S7.7** `[Q0033-lint]` — new
Given `counter: ""` (empty), when lint runs, then it fails naming the step and the field.

**S7.8** — folded into **S8.2**: the shipped flow's `max_iterations: 3` and `counter: review` are
the positive control, proven correct on the same fixture that proves the panel is two-vendor.

## AC8 — A single-vendor panel fails lint

**S8.1** `[Q0033-lint]` — new
Given a `cross_vendor: required` flow with a parallel group of two steps sharing one role, both
declared on `claude`, when lint runs, then it fails naming both step ids and the shared adapter.

**S8.2** `[Q0033-lint, qa-red]` — positive control, also proves S7.8
Given the shipped `review.yaml`'s panel (`code-reviewer` on `claude` and `codex`, `max_iterations:
3`, `counter: review`), when lint runs, then the single-vendor rule does not fire and the
bound/counter checks pass — the real asset satisfies both rules together.

**S8.3** `[Q0033-lint]` — new
Given a parallel group of three steps sharing one role where all three are declared on `codex`,
when lint runs, then it fails naming all three step ids and the shared adapter — the rule holds
for groups larger than two, not only pairs.

**S8.4** `[Q0033-lint, qa-red]` — positive control, pre-existing rule
Given the shipped verdict step's two named inputs (`review/round-{round}/claude.md` and
`review/round-{round}/codex.md`), when the existing cross-vendor-input rule (2026-08-21
refinement) runs alongside the new single-vendor-panel rule, then both pass simultaneously — a
judge over two vendor-distinct candidates satisfies the panel rule and the input rule without
either shadowing the other.

**S8.5** — folded into **S1.3**: the shipped flow's clean lint pass is the end-to-end proof that
AC6, AC7 and AC8 all hold for the real asset at once.

## AC9 — `harness run` performs the same validation first, from disk

**S9.1** `[Q0033-cli, Q0033-lint]`
Given a sibling flow in `harness/flows/` with an unresolvable `goto` target, when `harness run
review <id> --adapter mock` is invoked, then it exits non-zero, makes zero adapter calls, and
appends no line to the ticket's `runs.log`.

**S9.2** `[Q0033-cli]`
Given a valid harness (only the shipped flows), when `harness run review <id> --adapter mock` is
invoked, then the single-vendor-panel rule does not fire — the pristine on-disk `review.yaml` is
validated *before* the `--adapter mock` override collapses the panel onto one adapter in memory,
which would otherwise trip the rule on every mock run.

**S9.3** `[Q0033-cli, Q0033-lint]` — fixed per the review's major finding
Given the S9.1 fixture, when the diagnostic block for the offending flow (the `✗ <file>` line and
its `- ` problem lines) is compared between `harness lint`'s output and `harness run`'s preflight
output, then the two blocks are identical. This is scoped to the offending flow's own block, not
the full captured stdout+stderr stream — `harness lint` legitimately prints a `✓ <file>` line for
every other valid flow that `run`'s single-file preflight failure never reaches, so comparing
whole streams would fail forever regardless of implementation.

**S9.4** `[Q0033-cli, Q0033-lint]`
Given multiple flows are simultaneously invalid, when `harness lint` runs, then it reports every
offending flow in one pass and the process exits non-zero exactly once.

**E1** `[Q0033-lint, qa-red]` — edge case
Given the AC6/AC8 fixtures, when built, then each lives in a temporary harness directory
scaffolded for its own test and never mutates a shipped flow file under `harness/flows/`.

## AC10 — A gate answer is never defaulted, and never silently invented

**S10.1** `[Q0033-cli, qa-red]`
Given a run on the `requirements` flow (`max_iterations: 1`) that reaches its exhaustion gate and
then its closing gate, when invoked with `--gate-answer retry --gate-answer abort`, then
`runs.log` shows `gate=retry counter=requirements.head-of-product set=1` for the first gate and
`gate=human answer=abort` for the second, in encounter order — two gates in one run receiving
different, correctly-ordered answers, on a fixture that ships today and needs no new flow file.

**S10.2** `[Q0033-cli]`
Given fewer `--gate-answer` values than gates encountered, when the explicit answers are
exhausted, then a later gate may read a TTY.

**S10.3** `[Q0033-cli]`
Given non-TTY stdin and no remaining `--gate-answer` value for an encountered gate, when the run
reaches that gate, then the process exits non-zero with an error naming the gate — it neither
blocks nor defaults to `advance`.

**S10.4** `[Q0033-cli]`
Given a `--gate-answer` value that is empty, or not exactly one of `advance`/`retry`/`abort` (no
prefix or abbreviation accepted from the explicit flag), when it is consumed, then the process
exits non-zero naming the gate.

**S10.5** `[Q0033-cli]` — **SKIP: requires an interactive TTY**
Interactive re-prompting on an unrecognised word, and rejection of an empty line at a live
terminal, cannot be driven from this suite. AC10's TTY behaviour otherwise stays covered by
S10.1–S10.4, S10.6 and S10.7; this line exists so the gap is visible in the roster rather than
silently absent.

**S10.6** `[Q0033-cli]`
Given `--auto` and no `--gate-answer`, when a loop reaches its exhaustion gate, then the run exits
non-zero naming the gate rather than walking through it — `--auto` is a run policy, not an
exhaustion-gate answer (the engine already presents this gate as `human-locked`; this is the CLI
half and the outside-observable proof).

**S10.7** `[Q0033-cli, Q0033-assets]`
Given `review.yaml` has shipped, when a full mock run reaches its closing `gate: human` and is
answered with `--gate-answer advance`, then the ticket's stage advances to `reviewed`. This
scenario asserts `review.yaml` exists on disk before it runs (see **E7** under AC11) so a missing
asset fails with a named precondition rather than a raw crash.

**E3** `[Q0033-cli, qa-red]` — edge case
Given a fixture that repeats `--adapter` twice with different values, when parsed, then only the
final value takes effect — accumulation is scoped to `--gate-answer` alone; every other repeated
flag keeps its existing last-wins behaviour.

**E4** `[Q0033-cli, qa-red]` — edge case
Given `review.yaml`'s own bound (`max_iterations: 3`, `counter: review`) driven under
`--adapter mock` with `MOCK_ALWAYS_FAIL` until it exhausts, when the exhaustion gate is answered
`retry`, then `iterations.review` is persisted as `3`, not `2` — the literal value errata E-1
requires, proven on the real shipped counter rather than a substitute fixture.

## AC11 — Regression suite stays green, with its assumption made explicit

**S11.1** `[qa-red]` — rewritten per errata E-2
Given a non-interactive run (`--auto`, no `--gate-answer`) that reaches a gate, when invoked, then
the process exits non-zero naming the gate and reports that stdin closed without an answer. This
is asserted against the run's own observable behaviour — exit code and message — never against the
contents of another test file; `spike/test/**` is qa-red's own artifact and no development task
may edit it, so a scenario that could only be satisfied by editing a test is not a valid red test
(see errata E-2).

**S11.2** `[qa-red]`
Given the same fixture invoked with an explicit `--gate-answer abort`, when the gate is reached,
then the run consumes the answer and exits via the abort path — proving the non-interactive answer
is used, not merely tolerated.

**S11.3** `[qa-red]`
Given two gates in one run, when each is given its own `--gate-answer` value, then each answer is
consumed in encounter order and applies only to the gate it was consumed at (the AC11
regression-suite framing of S10.1's fixture).

**S11.4** `[qa-red]`
Given the same two-gate fixture with the answer order reversed, when run, then each answer still
maps only to its own gate — no cross-talk between the two `--gate-answer` values regardless of
which answer comes first.

**S11.5** `[qa-red]` — **guard, must stay green**
Given `git diff --quiet 5d16e06 -- contracts/Q-0006/`, when checked at any point in this suite,
then it reports no diff — the frozen Q-0006 contracts are consumed, never edited. If `5d16e06` is
unreachable (e.g. a shallow clone), this reports `SKIP: 5d16e06 unreachable in this clone` rather
than failing, since an unavailable baseline is not evidence of drift.

**S11.6** `[qa-red]` — **SKIP: covered by AC12 (manual)**
Real-CLI evidence is a maintainer closing-gate action per criterion 12; no automated scenario
substitutes for it.

**S11.7** `[qa-red]`
Given the exhausted-loop assertion in `spike/test/smoke.js`, when rewritten to supply an explicit
`--gate-answer`, then it continues to assert `loop exhausted` and no longer depends on the
empty-answer-means-`advance` default this ticket removes.

**S11.8** `[qa-red]` — E-3's distinction, restated as a scenario
Given `spike/test/smoke.js` keeps a `… --auto` invocation with no `--gate-answer` (asserting the
run reports stdin closed without one), and `spike/test/q0033-surface.js` runs `…
--auto --gate-answer abort` (asserting the opposite), when both are run, then both pass under one
implementation — answer the gate when told, error when not. Errata E-3 declines the review finding
that called these two assertions contradictory; both are correct simultaneously.

**E7** `[qa-red]` — fixed per the review's nit
Given `harness run review <id>` is about to be exercised as a full end-to-end fixture (S10.7),
when the scenario runs, then it first asserts `fs.existsSync('harness/flows/review.yaml')` is
true, failing with `review.yaml must ship before E7 can run` rather than surfacing the raw
`ENOENT` the review found.

**E8** `[qa-red]` — rewritten per the review's blocker
Given the qa-red integration branch after only qa-red's own tasks have landed (additions under
`contracts/Q-0033/*` and `spike/test/*`), when the merge-base diff against `main` is inspected,
then the expected qa-red paths are present in it — asserted **positively** (the specific files
qa-red added are in the diff), not as an exclusion of everything else the branch might later hold.
The full path list is still printed as evidence via `console.log`, preserving the reviewer's
provenance record. Once development's five tasks land on the same integration branch, production
files are expected in that diff too, so this assertion is superseded at that point by a named
`SKIP E8: development has landed, diff now includes production paths` rather than continuing to
require the branch hold only contracts and tests — the previous exclusion form could never pass
once development succeeded, which is why the loop exhausted on it. This is the third appearance of
the file-ownership pattern the 2026-08-23 DECISIONS entries name; it is closed here rather than
carried into development again.

**E9** `[qa-red]` — fixed per the review's nit
Given `spike/test/smoke.js` (landed on `main` at `ce26288`) already carries five assertions
covering `testReport`'s truncation behaviour (`out.slice(-8000)` and the "every result line"
roster), when this suite runs, then no new truncation scenario is added here — recorded as
`SKIP E9: already covered by smoke.js's five truncation assertions`, not as an open ownership
finding, since the file and its owner both already exist on `main`.

## AC12 — Real-CLI evidence is on the record

**S12.1** `[manual]` — **SKIP: manual closing-gate action, not automated**
Criterion 12 is a maintainer action: the first real `harness run review Q-0006` on authenticated
Claude Code and Codex CLI, with evidence saved into this ticket's folder. It spends subscriptions,
must never run inside development fan-out, and has no automated scenario by the requirement's own
instruction.

## AC13 — The docs agree with the shipped flow in the same change

**S13.1** `[Q0033-docs]`
Given `docs/02-sdlc-pipeline-spec.md` §3.4's state diagram, when read after this ticket, then the
review-rejection edge is drawn to the derived regression stage, not back to `green`.

**S13.2** `[Q0033-docs]`
Given §5.5, when read, then it shows the three-dot `{base}...harness/{id}/integration` diff range
in the correct direction.

**S13.3** `[Q0033-docs]`
Given §5.5, when read, then it uses `{round}` (never `{iter}`) and an unprefixed `counter: review`.

**S13.4** `[Q0033-docs]`
Given §5.5, when read, then it contains no `type: judge`, no `findings:`/`tasks:`/`with:` keys, and
no pinned vendor model name — the existing `model: opus` / `model: gpt-5` text is gone.

**S13.5** `[Q0033-docs]`
Given §10 question 1 ("full development versus a lighter `fix` flow"), when read, then it is
answered "no lighter flow for M1".

**S13.6** `[Q0033-docs]`
Given `docs/06-development-plan.md`'s M1 review line, when read, then it reflects the split across
Q-0006 and Q-0033 and its done-when includes the shipped review surface.

**S13.7** `[Q0033-docs]`
Given `docs/DECISIONS.md` and `docs/GLOSSARY.md`, when read, then DECISIONS gains one entry for
the derived regression target and one for the exhaustion gate `--auto` cannot bypass, each with
Decision/Alternatives considered/Why; and GLOSSARY's **Gate** entry gains a sentence distinguishing
an author-declared `human-locked` gate (deploy's) from the engine-presented exhaustion gate that
reuses the same kind, introducing no new synonym for an existing term.

**S13.8** `[Q0033-docs, qa-red]` — **guard, must stay green**
Given `README.md`, when compared against its state on `main` before this ticket, then it is
byte-unchanged — Q-0028 (M6) owns the rewrite, and `Q0033-docs`'s task description explicitly
excludes it.

---

## Fixes applied from the review

Two scenarios in the reviewed draft failed the standing "will this still pass once the feature
exists?" test and are rewritten above rather than merely corrected in wording:

- **E8** previously excluded every path outside `contracts/Q-0033/` and `spike/test/` from the
  integration branch's diff. That is true only during the red phase and guaranteed false the
  moment development's five tasks land — exactly the shape errata E-1 and E-2 already closed twice
  on this ticket. It is now a positive assertion about qa-red's own contribution, with a named skip
  once development has landed, so it never becomes a permanent red.
- **S9.3** previously compared the full captured stdout+stderr of `harness lint` and `harness run`.
  `harness lint` legitimately prints a `✓ <file>` line per valid flow that a single-file `run`
  preflight failure never reaches, so a whole-stream comparison could never pass under any correct
  implementation. It now compares only the diagnostic block for the offending flow.

Three nits are folded in without changing scope: **E9**'s skip reason now names the `smoke.js`
coverage that already exists on `main` instead of an ownership gap that no longer exists; **S10.5**
carries an explicit skip line instead of silent omission; **E7** gains the `review.yaml`-exists
precondition its own scenario (S10.7) already modeled correctly; and the four AC6 fixtures that had
lost their scenario ids (dead end, ambiguity, cycle/repeated pair, self target) are pinned to
S6.5, S6.6, S6.8/S6.10 and S6.9 respectively.
