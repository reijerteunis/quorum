*Test scenarios for the qa-red stage. Ticket Q-0033, consumes `solutioned`. Written against `requirements/merged.md`, `solution/solution.md`, `solution/tasks.yaml` (the six-task cut), `solution/errata.md` (E-1, E-2), the three `contracts/Q-0033/*` contracts, and the frozen `contracts/Q-0006/*` contracts + `errata.md` (baseline commit `5d16e06`). Cross-checked against the current state of `spike/bin/harness.js`, `spike/src/engine.js`, `spike/src/adapters/mock.js`, `spike/test/smoke.js`, `harness/harness.yaml`, `docs/02-sdlc-pipeline-spec.md` on `main` — deviations from the code as written today are called out per scenario so development knows what is genuinely new versus already-shipped.*

*This is a full rewrite of the prior `qa/scenarios.md`, which `qa/scenario-review.md` approved on its own merits (verdict: approve, 14 of 14 implementable groups red for the right reason). Nothing here reopens that review's substance. Two things changed it: errata E-1 re-cut the two-task decomposition into six after the development loop exhausted with neither task able to touch the files three failures actually lived in; errata E-2 struck the one scenario (the `smoke.js` migration) that could never have gone green under any task's ownership rules, because it asserted the *contents of a test file* rather than the *behaviour of a run*. Every scenario ID, Given/When/Then and coverage decision below is unchanged from the approved version except where a `(changed)` marker says otherwise.*

*This is a further revision, addressing `qa/scenario-review.md` (architecture reviewer, round 1 run 6, verdict: revise). That review found the substance of the prior version sound — coverage complete, no compile failures, sixteen of seventeen scenario groups correctly red for the right reason — and rejected the round for three defects, only one of which is a scenario-content defect this document can fix: **AC3/S3.5** asked for a red test that was already green against unmodified `spike/src/adapters/mock.js`, because the exact finding shape it checked is already the frozen, existing behaviour `contracts/Q-0006/mock-adapter-switches.contract.md` documents in its own worked example — it is rewritten below as a finding rather than a fabricated red scenario. The review's other two defects are **not** scenario-content defects and are named here only as preconditions the next `write-tests`/`prove-red` round must satisfy, since this document cannot fix either of them: (a) `harness/Q-0033/integration` must be reset to `main` + `contracts/Q-0033/` before red is re-proven — the round-1 run measured red against a branch that still carried both dev-loop merges from the aborted run 4, which is why sixteen of seventeen groups came back green before a line of implementation existed; (b) a second, previously unnoticed occurrence of a piped-stdin gate answer lives at `spike/test/smoke.js:185-220` (the retry-semantics test), not just the one at `:82-85` that S11.2 already covers — traced directly against the file and against this round's actual failure output, it is now its own scenario, **S11.7**, below.*

*This is a further revision, addressing `qa/scenario-review.md` (architecture reviewer, round 2 run 6, verdict: revise). That round found coverage complete except for one named gap, and no compile failures — the report's sole failing assertion was in `spike/test/smoke.js`, unmodified by this ticket. It rejected the round for two blockers that are **not** scenario-content defects and are restated below as preconditions rather than fixed here: the integration branch, and — newly traced this round — the `tests` branch feeding it, both still carried the full implementation from the aborted run 4, so every new scenario measured green before a line of this ticket's implementation existed on a clean base. Two findings **are** scenario-content and are fixed in this revision. First, **AC11** had no scenario for a third piped-stdin gate site: the interrupt-at-a-gate test at roughly `spike/test/smoke.js:215-245`, distinct from S11.2 (`:82-85`, exhaustion) and S11.7 (`:185-220`, retry semantics), whose `SIGINT` mechanism AC10 makes unreachable by construction — a non-TTY gate now errors the instant it is presented, before the process ever blocks waiting for input, so nothing is left running to interrupt. It is rewritten below as **S11.8**, adopting the review's own recommended fix: restate the underlying invariant (a terminal outcome is recorded, no iteration budget is silently refunded) against the immediate-exit behaviour AC10 now guarantees, and say out loud that `SIGINT`-at-a-gate coverage is traded away in the process. Second, the review found the per-scenario-reporting rule — already stated as a bullet below — unimplemented in the branch it measured: one `try`/`catch` per scenario group, so a group covering several fixtures reports only its first failure. That bullet is strengthened below to name every group it binds, rather than left as guidance a future round can read past again. A third, minor finding — S13.1's arrow-position check pinning an exact column rather than tolerating a re-spaced diagram — is addressed with an added tolerance note on that scenario.*

*This is a further revision, addressing `qa/scenario-review.md` (architecture reviewer, round 3, verdict: revise). That round confirmed the branches are clean, the suite compiles, and skips are logged distinctly — and rejected the round for five defects, three of them scenario-content defects fixed here directly, one a document-process defect fixed in `qa/red-integration.md`'s evidence guidance, and one — per-scenario reporting — raised a third time because the prior two revisions' instruction to accumulate and print every failure in a group was never implemented in `spike/test/q0033-surface.js`; this revision restates it as a binding, mechanical requirement rather than prose a future round can read past again, and extends the same rule to `spike/test/smoke.js`, whose linear `assert()` helper exits the whole process on its first failure and hid **S11.8** entirely behind an already-diagnosed, expected-until-`Q0033-cli`-ships failure in **S11.7**. Four further changes: **S13.1** now traces the `(review fail, …)` label's own connector run to its two endpoints rather than checking column occupancy anywhere in the block, which the round showed was satisfied by the diagram whether or not it was correct, on both its positive and negative halves. **S13.5** is scoped to the M1 block (as S13.2 already scopes to §5.5) and gains an assertion on the "Done when" bullets, replacing a whole-document regex two unrelated sections could already satisfy. **S8.1/S8.3**'s fixture is redesigned so the new single-vendor-panel rule is the only rule that can fail it — the prior fixture also collapsed the verdict step's own judge-input rule to a single vendor, so it was provably red today for the *existing* rule, not the new one, and would have depended on undefined message-concatenation behaviour once the new rule shipped. **S6.4** now requires the diagnostic to name the source flow strictly before the target, closing an OR-branch in its regex that could have passed on either ordering. **S11.5/S11.6** are split: S11.6 now points the frozen-input guard at a fixed, deliberately nonexistent commit rather than relying on this clone's own reachability of `5d16e06`, so its skip path is exercised deterministically and reported on its own line rather than folded into a group `✓` that could be true for reasons unrelated to the skip firing at all; `S13.8` drops its own copy of the same skip branch for the same reason. Two findings are carried forward rather than fixed here, because neither is a scenario-content defect this document can resolve: `Q0033-mock` remains dispatched against no red scenario (S3.5, now in its third round unaddressed), and `solution/tasks.yaml`'s `Q0033-docs` description still instructs "give the README the one new command," which directly contradicts the ticket's non-goals and **S13.8** — restated as a named finding under S13.8, and a second, smaller finding records that the same task's mention of §5.3 is outside what `AC13`/`S13.2` actually check.*

## How to read this document

- **Tags** name the `tasks.yaml` id(s) whose deliverable the scenario exercises, using the six-task cut of errata E-1: `Q0033-cli` (tooling → claude, owns `spike/bin/harness.js`), `Q0033-lint` (backend → codex, owns `spike/src/lint.js` + the lint portion of `spike/src/engine.js`), `Q0033-config` (backend → codex, owns both `harness.yaml`s), `Q0033-assets` (backend → codex, owns `review.yaml`/`code-reviewer.md` + templates), `Q0033-mock` (backend → codex, owns `spike/src/adapters/mock.js`), `Q0033-docs` (backend → codex, owns the four doc files + `README.md`). All six declare `depends_on: []` and run in one wave; `Q0033-cli` on `claude` alongside five tasks on `codex` is what makes the fan-out two-vendor.
- Where a scenario needs no dev task at all — because it lives in `spike/test/**`, which every task is forbidden to touch and which is qa-red's own artifact, or because it is a pure regression check that no task's change is expected to affect — the tag says so explicitly instead of pointing at a task. This is the rule errata E-2 and `harness/architecture.md` now state: a scenario satisfiable only by editing a file no task owns is not a valid red test, and if the fix lives in qa-red's own files, qa-red writes it directly rather than manufacturing a task to do so.
- Every scenario runs under `--adapter mock` unless stated otherwise (AC12 is the sole exception — it requires real, authenticated Claude Code and Codex CLIs).
- `iterations.review = 3` is the correct persisted retry value everywhere in this document (Q-0006 errata E-1 supersedes `contracts/Q-0006/review-runtime.contract.md`'s `max_iterations - 1` / `2` clause). A test asserting `2` is wrong per that errata and must not be written.
- Baseline commit for the frozen-input guard, and for any diff-against-a-fixed-point check, is `5d16e06`.
- **Both fan-out branches must be verified clean before this round's red is trusted.** `qa/scenario-review.md` round 2 §2 found `harness/Q-0033/integration` still carrying every implementation file from the aborted run 4, and traced that `harness/Q-0033/tests` — which `prove-red` merges into it — was cut from that same contaminated branch and carries the identical sixteen files. Re-cut both from `main` + `contracts/Q-0033/` only; `harness/Q-0033/tests` must diff against `main` as exactly `contracts/Q-0033/*`, `spike/test/q0033-surface.js`, and `spike/test/smoke.js` — no other path. **Record it as a merge-base diff, not a diff against `main`'s moving tip** — `main` advances independently of when the branch was cut, so `git diff --name-only main harness/Q-0033/tests` will list every commit `main` has gained since the cut as if it were contamination, which is exactly the trap `qa/scenario-review.md` round 3 §4.3 found in this round's own report. Run and paste both commands into `qa/red-integration.md`, in this order, before `prove-red` runs:
  ```
  git merge-base main harness/Q-0033/tests
  git diff --name-only <that merge-base> harness/Q-0033/tests
  ```
  naming the merge-base commit explicitly and pasting the actual path list — not just a checkmark pair — so the report proves its own base is clean from a fixed point rather than asking a reader to trust it. This is a process precondition for the next round, not a scenario this document encodes as a test.
- **Report per scenario, or accumulate failures within a group and print all of them — never let one failing assertion inside a `scenario()` group hide whether its siblings passed, and never let one failing `assert()` inside `smoke.js` hide every scenario after it.** This binds every heading above that enumerates more than one fixture under a single scenario id or id range — by name: S1.4, S5.1–S5.7/E5, S6.2–S6.10, S7.1–S7.8, S8.1–S8.4, S9.4, S10.1–S10.7/E3/E4, and S13.1–S13.8. A single `try`/`catch` wrapping the whole group and printing only the first thrown message does **not** satisfy this document, even though the group as a whole correctly reports `✗`. `qa/scenario-review.md` round 1 §3.5 first raised this against AC13's group; round 2 §5 found the requirement still unmet; **round 3 §3.5 found it unmet a third time**, in a branch where most groups were finally red for real and so, for the first time, the gap actively cost the round: roughly sixty scenarios collapsed to sixteen reported lines. The fix required this round is mechanical, not prose: `q0033-surface.js`'s `scenario()` must catch each fixture inside a group individually, collect every failure message, and print all of them before the group counts as `✗` — not stop at the first thrown assertion. **`smoke.js`'s own `assert()` helper (`smoke.js:17`) has the identical defect one level up**: it calls `process.exit(1)` on the first failure, which is exactly what let this round's real, expected-until-`Q0033-cli`-ships regression in **S11.7** (`traversals === 3`) silently prevent **S11.8** — added in round 2 — from ever running or being reported (`qa/scenario-review.md` round 3 §3.3). `smoke.js`'s `assert()` must record a failure and let the script continue, exiting non-zero only after every remaining assertion has had the chance to run. Neither file may ship this round without that change; `qa/red-report.md` must show a result — pass, fail, or explicit skip — for every scenario named in this document, never a truncated tail.
- **A scenario correctly left unassertable must log that it was skipped, on its own line, and never as part of a group whose label also reports `✓` for an unrelated assertion.** S11.6's shallow-clone-guard skip, S12.1's manual-only closing-gate evidence, and E2's future-flow guarantee are the three cases in this document. Round 1 §4 first flagged this as a checkmark inflating the pass count; **round 3 §5 found it still structurally possible** for S11.6 and S13.8, because both wrapped their skip branch inside a `try`/`catch` sharing a label with a real assertion — printing an unqualified group `✓` whenever the real assertion happened to pass, regardless of whether the skip branch had ever executed at all. S11.6 is rewritten below to remove the ambiguity at the root: it no longer depends on whether *this* clone happens to be shallow, so it always exercises the skip path and always reports on its own line.
- **Assert `status !== 0` (or the equivalent non-zero check) unless a scenario explicitly names an exit code below; none do.** Pinning an incidental exit code (e.g. `2`) that no criterion specifies turns a red test into a description of whatever the implementation happened to choose, and a later, equally-correct implementation that picks a different code would then fail a passing suite.

## Coverage map

| AC | Title | Tags |
| --- | --- | --- |
| 1 | `review.yaml` ships in both places, matches the frozen contract | `Q0033-assets`, `Q0033-lint` |
| 2 | `code-reviewer.md` ships in both places, byte-identical, satisfies contract | `Q0033-assets` |
| 3 | The flow uses only fields the engine has | `Q0033-assets`; `Q0033-mock` has no red scenario as scoped — see finding at S3.5 |
| 4 | Both config files declare the review keys | `Q0033-config` |
| 5 | `harness init` discovers the base branch safely | `Q0033-cli` |
| 6 | Cross-flow targets resolve, and the chain must come home | `Q0033-lint` |
| 7 | Bounds and counter spelling are checked | `Q0033-lint` |
| 8 | A single-vendor panel fails lint | `Q0033-lint` |
| 9 | `harness run` performs the same validation first, from disk | `Q0033-cli`, `Q0033-lint` |
| 10 | A gate answer is never defaulted, and never silently invented | `Q0033-cli` |
| 11 | The existing suite stays green, with its assumption made explicit | all six tasks (integration); three items are qa-red's own file (S11.2, S11.7, S11.8), two are pure regression |
| 12 | Real-CLI evidence is on the record | `manual` |
| 13 | The docs agree with the shipped flow in the same change | `Q0033-docs` |

**Two findings remain open from round 3 and are carried into this revision unresolved, because neither is a scenario-content defect this document can fix:** `Q0033-mock`'s dispatch against no red scenario (finding at S3.5, now its third unaddressed round), and `Q0033-docs`'s description still instructing an edit `S13.8` requires it not make (finding at S13.8). Both need an architect-gate decision before the next fan-out.

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
**Note:** this is jointly owned — a malformed asset (Q0033-assets) or an over-eager new rule (Q0033-lint) can each make this red for the wrong reason; the scenario only passes when both are correct together.

**S1.4 — Flow-directory parity is a named, standing test (not a habit)**
*Tags: Q0033-assets*
**Given** every `.yaml` filename under `harness/flows/`
**When** the corresponding filename is looked up under `spike/templates/harness/flows/`, and vice versa
**Then** every filename has a byte-identical peer on the other side — for all four pre-existing flows (`development.yaml`, `qa-red.yaml`, `requirements.yaml`, `solutioning.yaml`) as well as the newly added `review.yaml`
**Note:** this test does not exist today (`spike/test/smoke.js:171-175` only asserts no shipped template pins a codex model) — it must be added, not merely kept green.

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
**And** the severity-threshold wording ("nits alone approve; any surviving blocker or major requests changes") lives only in the verdict step's `instructions` in `review.yaml`, not in the role body

**S2.5 — Negative control: directory-wide role parity is *not* required**
*Tags: Q0033-assets*
**Given** `harness/roles/developer-backend.md` (intentionally divergent from its template peer) and `harness/roles/developer-tooling.md` (repo-local only, no template peer — the role `Q0033-cli` itself runs under)
**When** `diff -rq harness/roles spike/templates/harness/roles` is run
**Then** it is non-empty, and the test suite asserts that it is non-empty — proving a directory-wide parity rule would be false and confirming only `code-reviewer.md` is compared

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
**Then** the verdict step reports `changes-requested`, the run regresses via `goto: flow:development`, and the ticket's stage becomes `red` (`flow:development`'s `consumes`) with no change to `spike/src/**` beyond the lint module extraction that Q0033-lint owns
**Note:** the `--gate-answer advance` supplied here is never reached because the run regresses before any gate — it is present to prove that an unconsumed, offered-but-unneeded answer is silently ignored rather than erroring; see E7 below for this as its own assertion.

**S3.3 — `green → reviewed` under `MOCK_ALWAYS_PASS`**
*Tags: Q0033-assets*
**Given** a ticket at stage `green` and `MOCK_ALWAYS_PASS=1`
**When** `harness run review <id> --adapter mock --gate-answer advance` executes
**Then** the verdict step reports `approve` with empty `findings`, and the ticket's stage becomes `reviewed`

**S3.4 — Verdict step's mixed-vendor input passes the existing cross-vendor judge rule**
*Tags: Q0033-assets*
**Given** the verdict step's two named inputs, `review/round-{round}/claude.md` and `review/round-{round}/codex.md`, written by different adapters
**When** the existing `cross_vendor: required` judge check (`spike/src/engine.js:38-49`) runs over the shipped flow
**Then** it passes — a judge over candidates spanning vendors satisfies the 2026-08-21 refinement, and no new engine code is needed for this case. Note also that the verdict step and one panel member (`review-claude`) share `role: code-reviewer` and `adapter: claude`: this is legal because the verdict step is not itself a member of the panel's `parallel` group, so AC8's single-vendor-*panel* rule does not apply to it.

**S3.5 — Finding, not a scenario: `Q0033-mock` has no genuinely red test as scoped**
*Tags: none — this is a finding for the architect gate, not encoded as a test*
**Given** the task description "Give the code-reviewer role deterministic verdicts under the existing `MOCK_ALWAYS_PASS`/`MOCK_ALWAYS_FAIL` switches, and emit findings in the severity and file:line form the artifacts schema requires"
**When** `spike/src/adapters/mock.js` on `main`, unmodified, is exercised the same way S3.2/S3.3 already do (`--adapter mock` with either switch set)
**Then** it already emits `major: src/mock.ts:1 (mock) placeholder finding` for every failing verdict on every role, which already satisfies `review-artifacts.schema.json`'s `^(blocker|major|nit): .+:[1-9][0-9]* .+` pattern — and this is not incidental. `contracts/Q-0006/mock-adapter-switches.contract.md` (frozen, Q-0006) states it as existing behaviour in its own worked example: *"every mock `changes-requested` finding uses the artifact contract form, for example `major: src/mock.ts:1 (mock) placeholder finding`; forced and fallback verdicts therefore validate against `review-artifacts.schema.json`."* There is no code-reviewer-specific gap this task's stated deliverable would close: S3.2 and S3.3 above already prove both stage transitions, generically, with zero change to `mock.js`
**Why this is written as a finding and not a scenario:** the same discipline that requires rejecting a scenario no task can ever satisfy requires rejecting one that every task already satisfies without changing anything — both are a loop spending its budget on work no agent in it can meaningfully perform. Run 4's development loop already showed the mechanism: an agent dispatched against an already-green scenario correctly reports "no changes to make," `integrate` has nothing to disagree with, and the task passes without proving it did anything. `qa/scenario-review.md` §3.4 (round 1) named this exact risk; **round 3's own coverage map confirms it is still unaddressed three rounds in** — this is the finding's third appearance with no change to `solution/tasks.yaml` in response.
**Recommendation carried to the architect gate:** drop `Q0033-mock` from `solution/tasks.yaml`, or state explicitly what new mock behaviour the shipped flow needs that S3.1–S3.4 do not already prove, reassigning `spike/src/adapters/mock.js` to whichever task turns out to need it. Development must not be dispatched against `Q0033-mock` as currently scoped.

---

## AC4 — Both config files declare the review keys

**S4.1 — `repo.max_diff_bytes` is present with a comment, `repo.base_branch` is preserved**
*Tags: Q0033-config*
**Given** `harness/harness.yaml` and `spike/templates/harness/harness.yaml`
**When** their `repo:` block is read
**Then** both carry `base_branch: main` (unchanged, already shipped) and the newly added `max_diff_bytes: 200000`, each with a one-line comment explaining its purpose

**S4.2 — Omitting both keys stays valid**
*Tags: Q0033-config*
**Given** a fixture ticket at stage `green` and a fixture project whose `harness/harness.yaml` has no `repo:` block at all
**When** `harness run review <id> --adapter mock` runs to completion
**Then** it completes without a `FlowError` naming a missing `base_branch` ref or diff-size violation, proving `{base}` resolved to `main` and the diff-size limit resolved to `200000` purely from the engine's own fallback — not from a regex match against `spike/src/engine.js`'s source text
**Note:** the approved review flagged an earlier version of this scenario (a `/base_branch\s*\?\?\s*['"]main['"]/` grep against `engine.js`) as proving only that the fallback spelling exists in source, not that resolution behaves correctly; it would pass unchanged after a refactor that kept the behaviour but renamed the expression, and — more importantly — would also pass after a refactor that *broke* the behaviour but left the literal text `?? 'main'` sitting dead in a comment. This version drives an actual run instead.

**S4.3 — Omitting only `max_diff_bytes` stays valid**
*Tags: Q0033-config*
**Given** a fixture project's `harness.yaml` with `repo: { base_branch: develop }` and no `max_diff_bytes`, and a fixture ticket whose integration branch is reachable from `develop`
**When** `harness run review <id> --adapter mock` runs
**Then** it completes using `develop` as `{base}` and `200000` as the resolved diff-size limit, again proven by the run succeeding rather than by reading engine source

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
**Then** it writes `base_branch: master` — an unborn HEAD whose branch Git can name is treated as success, not fallback

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
**Given** a repository where `git branch --show-current` (or equivalent) returns an empty string because HEAD is not on any branch — reproduced concretely as a mid-rebase state (`git rebase --onto` stopped with a conflict, leaving HEAD detached with a rebase in progress) rather than asserted by comment
**When** `harness init` runs
**Then** it writes `base_branch: main`, exits `0`, and the Git subprocess itself succeeded (exit 0, empty stdout) — this is "Git ran and had nothing to name," distinct from E5's "the Git subprocess itself failed"

**S5.6 — Discovery touches only `base_branch`**
*Tags: Q0033-cli*
**Given** any successful discovery (S5.1 or S5.2)
**When** the written `harness.yaml` is inspected
**Then** `max_diff_bytes` remains `200000` and no other key changes

**S5.7 — Comment- and formatting-preserving edit**
*Tags: Q0033-cli*
**Given** the copied template `harness.yaml`, including its `commands.install` comment and the new `repo.base_branch` / `repo.max_diff_bytes` comments
**When** `init` rewrites `base_branch` on a non-`main` branch (S5.1)
**Then** the `commands.install` comment and both `repo` comments are still present in the written file — a parsed-value comparison alone is insufficient here because it would let a `YAML.parse` + `YAML.stringify` round-trip silently strip every comment while still passing

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
**Then** the two-hop chain resolves with no error — proving the walk follows multiple flows, not just a direct match
**And** no shipped flow file is mutated to build this fixture

**S6.3 — Missing target**
*Tags: Q0033-lint*
**Given** a temporary flow whose `on_fail.goto` is `flow:nonexistent`
**When** the validator runs
**Then** it fails, naming the source flow, the missing target `nonexistent`, and that no such flow could be loaded

**S6.4 — Unloadable target *(changed round 4 — diagnostic must name the source flow strictly before the target)***
*Tags: Q0033-lint*
**Given** a temporary flow whose `on_fail.goto` is `flow:broken`, where `broken.yaml` exists but is unparsable or fails its own structural lint (e.g. duplicate step ids), and where `broken` sorts before `review` in a directory read — so a per-file-first implementation would encounter the broken file before the source flow
**When** the validator runs
**Then** it fails with a single diagnostic that names the *source* flow (`review`) strictly before it names the target (`broken`) — the assertion requires `/review[\s\S]*broken/` with no alternate branch that would also accept the target appearing first, distinct from the "missing" diagnostic of S6.3
**Note (tightened round 4, carried from round 1 §4.8):** the prior version of this assertion accepted either ordering via an OR-branch (`/review.*broken.*load|broken.*invalid/is`), which `qa/scenario-review.md` round 3 §5 found could pass on a diagnostic that led with the target — exactly the case this scenario exists to rule out. If the diagnostic format is later changed to lead with the target instead of the source, that is a deliberate format change to flag in code review, not a reason to loosen this assertion back to an OR.

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
**Then** it fails as a dead end at stage `reviewed`, because no shipped flow yet consumes `reviewed` — named as the self-target fixture

**S6.10 — Repeated `(flow, stage)` pair is rejected as a cycle, not silently deduplicated**
*Tags: Q0033-lint*
**Given** the cycle fixture of S6.8
**When** the walk revisits the same `(flow, stage)` pair a second time
**Then** the walk stops at that revisit and reports the cycle rather than looping again

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
**Note:** today's `lintFlow` (`spike/src/engine.js:31`, `Number.isInteger(0) === true`) incorrectly accepts this. This scenario must fail on `main` as it stands today and pass only once the fix lands — it is a genuine behavior change, not a "stays green" regression check.

**S7.5 — Negative `max_iterations` fails**
*Tags: Q0033-lint*
**Given** `on_fail: { max_iterations: -1 }`
**When** the validator runs
**Then** it fails, naming the step and the field
**Note:** also currently accepted by `main` (`Number.isInteger(-1) === true`) — same regression class as S7.4.

**S7.6 — Prefixed `counter` is rejected with the corrected spelling**
*Tags: Q0033-lint*
**Given** `on_fail: { counter: "iterations.review", max_iterations: 3 }`
**When** the validator runs
**Then** it fails with a message naming the step, the offending value `iterations.review`, and the corrected spelling `review` — because the prefixed form would create a literal `"iterations.review"` key nested inside the `iterations` object rather than `iterations.review` as a flat key

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

**Implementation caution (round 2 §5):** every `Given` above says "an `on_fail` block," not "the verdict step's `on_fail` block," and `contracts/Q-0006/review-lint.contract.md` states the bound and counter rules with no such scoping — they apply to any step carrying `on_fail`, not only ones shaped like the shipped flow's verdict step. `qa/scenario-review.md` §5 found the prior test run exercising S7.1–S7.7 exclusively through fixtures built around a verdict-step-shaped `on_fail`, which happened to still be correct on a clean base but would silently narrow the rule's proven scope if `write-tests` reuses only that fixture shape. Build at least one S7.x fixture from a plain, non-verdict step's `on_fail` block to keep the rule honest.

---

## AC8 — A single-vendor panel fails lint

**S8.1 — Two same-role steps on the same adapter fail *(changed round 4 — fixture isolates the panel rule from the pre-existing judge-input rule)***
*Tags: Q0033-lint*
**Given** a temporary `cross_vendor: required` flow built from the shipped panel shape, with both panel members set to `adapter: codex`, and the verdict step's own `adapter` overridden to `claude` — a vendor distinct from the panel's shared vendor, so the pre-existing judge-input rule ("at least one input differs from the judge's own vendor") is satisfied trivially and cannot itself fail this fixture
**When** the validator runs
**Then** it fails on the single-vendor-panel rule, naming both member step ids and the shared adapter `codex`
**And** the diagnostic contains that panel-specific wording (both member ids) and does **not** contain the pre-existing judge rule's "written by its own vendor" phrasing — the negative half is what makes the assertion satisfiable only once the new rule ships, rather than by coincidence against a rule that already exists

**S8.2 — Shipped panel spans two adapters and passes**
*Tags: Q0033-lint*
**Given** the shipped `review.yaml` panel (`review-claude` on `claude`, `review-codex` on `codex`)
**When** the validator runs
**Then** it reports no single-vendor-panel error for this group

**S8.3 — Three-or-more-member panel, still all one vendor, fails *(changed round 4 — same isolation as S8.1)***
*Tags: Q0033-lint*
**Given** the same isolation as S8.1 — three `role: code-reviewer` steps all on `adapter: codex`, with the verdict step's own `adapter` set to `claude`
**When** the validator runs
**Then** it fails, naming all three member ids and the shared adapter `codex`, distinguishable from the judge-input rule's message by the same negative assertion as S8.1
**Note (round 3 §4.2):** the prior version of S8.1/S8.3 rebuilt the panel by cycling the two original members' shapes (which carried their original `output.write` paths), leaving the verdict step's own `adapter` unchanged at `claude`. That collapsed *both* the panel and the verdict step's two named inputs to one vendor at once, so the pre-existing judge rule fired first — the round's actual `red-report.md` shows exactly that message, not the panel rule's. Whether the old assertion would have passed once the panel rule shipped depended on undefined behaviour: whether the two rules' diagnostics get concatenated into one message, which no contract specifies. Setting the verdict step's own adapter apart from the panel's collapsed vendor removes that dependency entirely.

**S8.4 — A panel spanning two adapters plus a third on one of those adapters still passes**
*Tags: Q0033-lint*
**Given** a temporary parallel group of three `role: code-reviewer` steps, two on `claude` and one on `codex`
**When** the validator runs
**Then** it reports no error — the rule only requires the group to span at least two adapters, not an even split

**S8.5 — The verdict step's mixed-vendor *input* rule and the panel rule compose without conflict**
*Tags: Q0033-lint*
**Given** the shipped `review.yaml` in full (panel + verdict step)
**When** the validator runs both the new single-vendor-panel rule and the existing cross-vendor judge-input rule
**Then** both pass simultaneously — the panel rule governs the parallel group, the judge rule governs the verdict step's inputs (and the verdict step, sharing `role: code-reviewer` with the panel but sitting outside its `parallel` group, is not itself subject to the panel rule at all — see S3.4), and neither rule's fixture trips the other

---

## AC9 — `harness run` performs the same validation first, from disk

**S9.1 — An invalid sibling flow blocks the run before any spend**
*Tags: Q0033-cli, Q0033-lint*
**Given** a project whose `harness/flows/` directory contains the valid shipped flows plus one sibling flow with an unresolvable `goto: flow:` target, and a ticket at stage `green`
**When** `harness run review <id> --adapter mock` is invoked
**Then** the process exits non-zero, `runs.log` gains **zero** new lines, and the ticket folder gains **no** new `review/round-*` artifacts and no change to `ticket.md`'s `iterations` — this is a strictly stronger, externally observable proxy for "zero adapter calls were made" than "runs.log wasn't written," since a mock call that ran but failed to log would still leave written artifacts behind

**S9.2 — Preflight validates pristine files, before the `--adapter mock` override collapses vendors**
*Tags: Q0033-cli*
**Given** a valid harness whose real, on-disk `review.yaml` has a two-vendor panel (`claude` + `codex`)
**When** `harness run review <id> --adapter mock` is invoked (which would make every step run on `mock` in memory)
**Then** the run does **not** fail the single-vendor-panel rule — the validator loads and checks the pristine files from disk before any `--adapter` override is applied in memory

**S9.3 — Identical diagnostic through `lint` and through `run`**
*Tags: Q0033-cli, Q0033-lint*
**Given** the same invalid fixture directory used in S9.1
**When** `harness lint` and `harness run review <id> --adapter mock` are each invoked against it
**Then** the two captured diagnostic strings (trimmed of surrounding whitespace and any leading `✗`/ANSI colour markers) are exactly equal, not merely both containing a shared substring

**S9.4 — `harness lint` reports every offending flow in one pass**
*Tags: Q0033-lint*
**Given** a fixture directory with two independently invalid flows (e.g. one with a missing target, one with `max_iterations: 0`)
**When** `harness lint` runs
**Then** it reports both diagnostics in a single invocation and exits non-zero exactly once — not once per offending flow

---

## AC10 — A gate answer is never defaulted, and never silently invented

**S10.1 — Two gates in one run receive different explicit answers in order**
*Tags: Q0033-cli*
**Given** a ticket whose `iterations.review` is already `3` (persisted from prior rounds) and `MOCK_ALWAYS_FAIL=1`, so this run's verdict is `changes-requested` and immediately exhausts the loop, landing on the exhaustion gate, and — once answered `advance` — proceeds to the flow's closing `gate: human`
**When** `harness run review <id> --adapter mock --gate-answer advance --gate-answer abort` is invoked
**Then** the exhaustion gate consumes `advance` (accepting as-is and continuing), the closing gate consumes `abort` (in that encounter order), and the run ends aborted with unchanged stage

**S10.2 — `--gate-answer` is repeatable and does not overwrite (parser fix)**
*Tags: Q0033-cli*
**Given** the current flag parser at `spike/bin/harness.js:24-27`, which stores each `--flag value` pair by overwriting `flags[k]`
**When** `--gate-answer advance --gate-answer abort` is parsed
**Then** both values are retained as an ordered list — this requires a parser change scoped to `--gate-answer` only; all other flags keep their existing last-wins behavior (verified by an existing flag such as `--adapter` still overwriting on repeat; see E3)

**S10.3 — Explicit answer requires the exact word; a prefix is rejected**
*Tags: Q0033-cli*
**Given** a pending gate
**When** `--gate-answer ad` is supplied (a prefix of `advance`)
**Then** the process exits non-zero with an error naming the gate — explicit flag values must be exact full words after trim/case-normalization, unlike the forgiving `startsWith` matching interactive TTY input still accepts

**S10.4 — Non-TTY stdin with no remaining explicit answers**
*Tags: Q0033-cli*
**Given** a gate is reached, no more `--gate-answer` values remain, and stdin is not a TTY (e.g. piped from `/dev/null`, or simply not connected to a terminal)
**When** the run reaches that gate
**Then** the process exits non-zero with an error naming the gate; it neither blocks nor defaults to `advance` — critically, this holds even if data happens to be waiting to be read on a non-TTY stdin (a pipe with unconsumed bytes still counts as non-TTY and still errors immediately; see S11.7, where a pending piped answer is never read for exactly this reason)
**Note:** already true on `main` today via Q-0011's removal of the empty-answer default (`spike/bin/harness.js:72-83`); this scenario pins the property rather than introducing it, and development should not go looking for a defaulting bug that no longer exists.

**S10.5 — Missing, empty, or unrecognised interactive answer**
*Tags: Q0033-cli*
**Given** an interactive TTY session at a gate
**When** the user submits an empty line, or a word that is none of `advance`/`retry`/`abort` (and no valid prefix of them)
**Then** the process exits non-zero (empty) or re-prompts (unrecognised, per the existing forgiving interactive behavior) — in no case does it default to `advance`

**S10.6 — `--auto` does not answer an exhaustion gate**
*Tags: Q0033-cli*
**Given** a ticket whose `iterations.review` is already `3` and `MOCK_ALWAYS_FAIL=1`
**When** `harness run review <id> --adapter mock --auto` is invoked with no `--gate-answer`
**Then** the process exits non-zero naming the exhaustion gate, rather than walking through it — `handleFail` presents it as kind `human-locked` (`spike/src/engine.js:252`), and this scenario is the CLI-observable proof of that property

**S10.7 — Retry at exhaustion persists `iterations.review = 3`, not `2`**
*Tags: Q0033-cli*
**Given** the exhaustion gate of S10.1/S10.6, offering `advance / retry / abort`
**When** `--gate-answer retry` is supplied
**Then** `iterations.review` is persisted as `3` (per Q-0006 errata E-1, `max_iterations`, not `max_iterations - 1`), `runs.log` gets a line `gate=retry counter=review set=3`, and the retry's own regression is the single authorised further traversal — a following rejection re-presents the gate rather than granting a second one

---

## AC11 — The existing suite stays green, with its assumption made explicit

**S11.1 — `--auto` without `--gate-answer` is rejected because `--auto` cannot answer an exhaustion gate, not merely because stdin happened to be closed *(changed round 4 — distinguishes the two failure modes)***
*Tags: all six tasks (integration)*
**Given** a ticket whose `head-of-product` loop exhausts under `MOCK_ALWAYS_FAIL=1`
**When** `harness run requirements T-0002 --adapter mock --auto` is invoked with no `--gate-answer` and closed (non-TTY) stdin
**Then** the process exits non-zero, and the output matches `/loop exhausted/i` and `/human-locked/i`
**And** the output does **not** match `/stdin closed without one/i` — today's pre-`Q0033-cli` message, which reaches the same exit code and the same two substrings via a different path: an unanswered gate erroring because stdin closed, not because `--auto` was recognised and rejected as insufficient to answer a `human-locked` gate
**Note (round 3 §4.1):** `qa/scenario-review.md` found the prior assertion true in both worlds — before `Q0033-cli` ships (today) and after — because it checked only substrings both paths happen to share, proving nothing about which one shipped. The `doesNotMatch` clause above is what makes the assertion distinguishing.

**S11.2 — `spike/test/smoke.js:82-85`'s exhausted-loop assertion is proven by a driven run, not by a test file's contents *(rewritten per errata E-2)***
*Tags: qa-red's own artifact — no dev task owns `spike/test/**`, and none may*
**Given** a fixture ticket set up the way `smoke.js`'s existing `T-0002` / `requirements` / `MOCK_ALWAYS_FAIL=1` scenario is set up
**When** the test itself invokes `harness run requirements T-0002 --adapter mock --auto --gate-answer abort` (or the equivalent explicit answer the exhaustion gate requires) as a child process and inspects that child's actual stdout/exit code
**Then** the assertion holds against that real, driven output: `loop exhausted`, `human-locked`, non-zero exit, and that a human-locked gate is never auto-advanced
**What this replaces, and why it had to change:** the version this superseded asserted that `spike/test/smoke.js`'s own source text contains a `--gate-answer … abort` call — i.e. it grepped a sibling test file for a string, rather than running anything. Every development task forbids editing files under `spike/test/**`, so no task could ever have made that assertion pass or fail meaningfully; it was red by construction and unfixable by any agent in the fan-out, which is exactly how it burned a third of this ticket's first development loop before errata E-1 traced the cause. The underlying property — a non-interactive run answers its gates explicitly instead of defaulting — is real and unchanged; only the mechanism of proof moved, from reading a file to driving a process. Since `spike/test/**` is qa-red's own artifact, rewriting it is qa-red's work in this round, not a task's, and it requires no ownership grant from anyone.
**Not the only site:** `qa/scenario-review.md` §3.2 found a second, structurally identical piped-stdin gate answer elsewhere in the same file, at `spike/test/smoke.js:185-220` — it is a distinct scenario, **S11.7**, because it belongs to a different pre-existing test (retry semantics, not exhaustion) with its own four assertions to preserve. A third site — the interrupt-at-a-gate test around `:215-245` — surfaced in round 2 (`qa/scenario-review.md` §4) and is not the same shape of fix: AC10 makes its `SIGINT` mechanism itself unreachable, not merely its answer method, so it is rewritten rather than merely re-piped. See **S11.8**.

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

**S11.5 — Frozen-input guard: no drift in `contracts/Q-0006/` *(changed round 4 — always runs; no longer bundled with S11.6's skip branch)***
*Tags: guards all six tasks — qa-red's own artifact*
**Given** the repository at the tip of the Q-0033 branch and baseline commit `5d16e06`, reachable in this environment (true of every non-shallow clone, including CI and this ticket's own dev environment)
**When** `git diff --quiet 5d16e06 -- contracts/Q-0006/` runs as part of the suite
**Then** it exits `0` (no diff) — proving none of the six fan-out tasks touched a frozen Q-0006 contract
**Note:** this scenario no longer wraps a skip branch. If `5d16e06` is unreachable in a given environment, that is a fixture problem to fix (use a non-shallow clone), not a case S11.5 should silently absorb; S11.6 below proves the skip mechanism exists, deterministically, without depending on this environment's clone depth.

**S11.6 — Frozen-input guard skips cleanly when its baseline is unreachable *(changed round 4 — deterministic, not conditional on this clone's depth)***
*Tags: qa-red's own artifact — test infrastructure only*
**Given** the frozen-input guard invoked against a commit SHA that is deliberately not part of this repository's history (a fixed, syntactically valid but nonexistent SHA — not `5d16e06`)
**When** the guard runs against that SHA
**Then** it skips with a message naming the unavailable SHA as the unreachable baseline, rather than surfacing a raw Git error or silently claiming parity was verified — reported on its own line via `skipped('S11.6', …)`, never nested inside another scenario's `✓`
**Note (round 3 §5):** the round-1/2 version only exercised the skip path by chance, contingent on this clone happening to be shallow, and — because it shared one `scenario()` call with S11.5 — printed an unqualified `✓ S11.5/S11.6` whenever S11.5's real assertion happened to pass, regardless of whether the skip branch had ever executed at all. Pointing the guard at a fixed nonexistent SHA makes the skip path's own exercise deterministic and removes the shared-label inflation the round flagged; it also means the guard implementation must accept a baseline commit as a parameter rather than hardcoding `5d16e06`, which is squarely qa-red's own test infrastructure to own.

**S11.7 — `spike/test/smoke.js:185-220`'s retry-semantics test answers its gates with `--gate-answer`, not a piped `'retry\n'` *(new — `qa/scenario-review.md` §3.2)***
*Tags: qa-red's own artifact — no dev task owns `spike/test/**`, and none may*
**Given** the existing retry-semantics fixture (a fresh ticket, `MOCK_ALWAYS_FAIL=1`, `requirements` flow) whose current implementation spawns the child with `stdio: ['pipe', 'ignore', 'ignore']`, writes `child.stdin.write('retry\n')` once the process is running to answer the first exhaustion gate, deliberately leaves a second gate unanswered, and ends the process with a busy-wait against `runs.log` followed by `SIGINT`
**When** AC10 ships and non-TTY stdin becomes an immediate error the moment a gate needs an answer, checked before any read is attempted
**Then** the pending `'retry\n'` on the pipe is never consumed — the process now exits immediately, non-zero, at the *first* exhaustion gate, because non-TTY stdin errors regardless of what is waiting to be read from it. This is exactly the failure this round's `prove-red` reported: `retry grants exactly one more traversal, no more (saw 2, expected 3)` — `2` being the loop's own built-in call count reached before the gate is even presented, with the retry never granted at all
**And** the fix is to pass `--gate-answer retry` on the command line for the first (exhaustion) gate and supply no answer for the second, then wait for the process to exit on its own rather than polling `runs.log` and sending `SIGINT` — a non-interactive run with no remaining answer now terminates itself the moment it reaches the unanswered second gate, so no interrupt choreography is needed at all
**And** the four existing assertions this test makes are preserved unchanged, against the same evidence: exactly three `step=head-of-product` traversals in `runs.log` (the retry's own regression is the third), the line `gate=retry counter=requirements.head-of-product set=1`, the persisted `requirements.head-of-product: 2` in `ticket.md`, and the unrefunded `qa-final.unrelated: 2`
**Why this is qa-red's to fix, not a task's:** identical shape to S11.2 — `spike/test/**` is qa-red's own artifact, every development task is forbidden to touch it, and this is a second, previously unnoticed site in the same file with the same defect, discovered by reading `smoke.js:185-220` directly rather than inferring it from the criteria alone.
**Status:** this assertion is currently red for exactly the reason described above — `--gate-answer` does not exist on `main` yet — and will pass once `Q0033-cli` ships it. Because `smoke.js`'s `assert()` currently exits the process on this failure, `S11.8` below has never actually been observed to run; the accumulate-and-continue requirement in "How to read this document" exists specifically to fix that before the next round, not to fix this expected regression.

**S11.8 — The interrupt-at-a-gate test is rewritten: a non-TTY run terminates itself and persists a terminal outcome, not a caught `SIGINT` *(new — `qa/scenario-review.md` §4, round 2)***
*Tags: qa-red's own artifact — no dev task owns `spike/test/**`, and none may*
**Given** the existing interrupt fixture in `spike/test/smoke.js` (roughly `:215-245`; a fresh ticket driven through a flow with `stdio: ['pipe', 'pipe', 'pipe']`), whose current implementation waits for the run to reach the closing `gate: human`, sends `SIGINT`, and asserts an ` interrupted ` line reaches `runs.log`
**When** AC10 ships and `spike/bin/harness.js`'s non-TTY check (`if (!process.stdin.isTTY) throw new FlowError(...)`, `spike/bin/harness.js:77`) fires the instant the gate is presented and before `readline` is ever created or any read is attempted
**Then** the original mechanism is unreachable by construction — a pipe is not a TTY, so the run no longer blocks at the gate waiting for input; it exits immediately, non-zero, before `SIGINT` can be sent to a process that is still running
**And** the rewritten test drives the same fixture through the same piped, unanswered gate (no `--gate-answer` for the fixture's gate) and asserts, against that immediate exit, that (a) a terminal outcome — `failed` or `aborted` — is written to `runs.log`, not silently dropped, and (b) the step's persisted iteration counter is unchanged from its value immediately before the run, proving no iteration budget is refunded by an unanswered, self-terminating gate
**What this replaces, and why:** the invariant Q-0004 found and this suite exists to protect — "an unanswered gate must not silently refund the iteration budget" — is unchanged; only its mechanism of proof moves, because AC10 makes the original mechanism (block on a pipe, interrupt with `SIGINT`, observe ` interrupted `) unreachable by design. `qa/scenario-review.md` round 2 §4 evaluated three ways to keep coverage: allocate a pty (rejected — `node-pty` is a new dependency AC11 forbids, and `script -q`'s flags differ between BSD and GNU); give a mock step a deliberate delay switch so `SIGINT` can land mid-step instead of at a gate (rejected — exactly the kind of new `mock.js` behaviour S3.5's finding argued this ticket does not need); or restate the invariant against the immediate-exit behaviour AC10 now guarantees (the review's own recommendation, adopted here). The cost is explicit rather than silent: **`SIGINT`-at-a-gate is no longer covered by the automated suite.** The invariant it protected still holds for a human at a real terminal, where stdin is a TTY and the gate genuinely blocks on a read — this ticket makes no change to that code path — only the non-interactive automated test for the interrupt case is gone, traded for a test of what AC10 actually guarantees on non-TTY stdin.
**Not the last site, but the last found:** this is the third piped-stdin gate-answer site in `smoke.js`, after S11.2 (`:82-85`, exhaustion) and S11.7 (`:185-220`, retry semantics). Development must not go looking for a fourth; if one surfaces during `write-tests`, it is the same shape and the same fix, and it belongs to qa-red for the same reason these three do.
**Round-4 requirement (round 3 §3.3):** this scenario's actual pass/fail result must appear in `qa/red-report.md` for every round from here on, including a round where **S11.7** is still red. That is only possible once `smoke.js`'s `assert()` helper stops calling `process.exit` on the first failure — see the accumulate-and-continue requirement in "How to read this document." A round whose report does not show a line for S11.8 has not proven this scenario one way or the other, and must not be read as passing it.

---

## AC12 — Real-CLI evidence is on the record

**S12.1 — Manual closing-gate evidence, real vendors, real diff (not automated)**
*Tags: manual*
**Given** Q-0033's automated implementation is integrated and green, and the maintainer has authenticated Claude Code and Codex CLI logins
**When** the maintainer runs `harness run review Q-0006` for real (spending both subscriptions)
**Then** the maintainer records in Q-0033's ticket folder that both reviewers received the harness-materialised diff under plan / read-only sandbox, and that the verdict applied the severity threshold as instructed — this action is never delegated to development fan-out, is never automated, and no test in this document may assert it happened. If a suite reports this group's status at all, it must log it as skipped/manual rather than print an unqualified `✓` for something no assertion ran.

---

## AC13 — The docs agree with the shipped flow in the same change

**S13.1 — SDLC spec state diagram routes rejection to the derived stage *(changed round 4 — traces the label's own connector to its two endpoints, not column occupancy anywhere in the block)***
*Tags: Q0033-docs*
**Given** the `docs/02-sdlc-pipeline-spec.md` §3.4 block, bounded from its heading to the next `##`/`###` heading
**When** the line containing the `(review fail, …)` label is located, and the box-drawing connector run (`└`, `─`, `┘`) that belongs to *that label's own annotation* is read — from the same line where label and connector coincide, as they do in the current diagram, or by following the run onto an adjacent line if a future re-draw separates them
**Then** the column of the run's left corner (`└`) and the column of its right corner (`┘`) are each resolved to the stage label whose header-row span they fall within, tolerating roughly ±1 column so a diagram re-spaced by one column of whitespace is not falsely flagged
**And** that resolved pair is `(red, reviewed)` — the check fails if it resolves to `(green, reviewed)`, which is what the diagram currently draws
**Note (round 3 §3.1):** the original assertion — `/review[\s\S]*red|changes.requested[\s\S]*development/is` run against the *whole document* — was already true on `main` today regardless of what §3.4 actually draws, because some other section happens to contain both words in the right order; it could never fail. A later revision scoped the match to the §3.4 block and checked for a `▲`/`│` glyph at `red`'s column anywhere in the block and the absence of one at `green`'s column — but every arrow glyph in a three-loop diagram occupies columns shared by all three loops (the "qa: dev issue" and "qa: design issue" loops both legitimately terminate near `red`'s and `green`'s columns too), so that check was satisfied by the diagram whether or not the review-fail loop specifically was correct, on both its positive and negative halves. Tracing the label's own connector run — rather than scanning the whole block for any glyph at a column — is what makes the check see the one loop it is meant to check, not all three at once.

**S13.2 — §5.5's example flow matches what ships**
*Tags: Q0033-docs*
**Given** `docs/02-sdlc-pipeline-spec.md` §5.5, bounded from its heading to the next section heading
**When** its review flow example is read
**Then** it shows the three-dot `{base}...harness/{id}/integration` diff in the correct direction, `{round}` (not `{iter}`), unprefixed `counter: review`, no `type: judge`, no `findings:`/`tasks:`/`with:` fields, and no pinned model name — replacing the currently-shown `model: opus` / `model: gpt-5`, which the 2026-08-22 decision bans and which fails lint today

**Finding — `Q0033-docs`'s description references §5.3, which no criterion or scenario covers**
*Tags: none — this is a finding for the architect gate, not encoded as a test*
**Given** `solution/tasks.yaml`'s `Q0033-docs` description: "§5.3 still shows `model: gpt-5`, which the 2026-08-22 decision bans"
**When** `AC13` (merged requirement) and `S13.2` above are checked against that instruction
**Then** neither covers §5.3 — both scope the no-pinned-model fix to §5.5 only, matching the merged requirement's literal text ("§5.5 is rewritten as the flow actually ships: ... no pinned model names"); `model: gpt-5` in fact appears seven times across §5.1–§5.7 (`docs/02-sdlc-pipeline-spec.md:161,190,209,232,291,310,347`), not just once in §5.3
**Why this is written as a finding and not a scenario:** widening `S13.2` to check every occurrence across §5.1–§5.7 would assert something no acceptance criterion asked for — scope invention this document should not do unilaterally on qa-red's own initiative; narrowing (or correcting) the task's own instruction is the architect's call
**Recommendation carried to the architect gate:** either narrow `Q0033-docs`'s description to §5.5 (dropping the §5.3 mention, matching `AC13`'s actual scope), or widen `AC13`/`solution.md` explicitly to the whole of §5, so a future task's instruction and this document's tests agree on which is authoritative. As scoped today, following the task description literally does no harm — but it is an instruction nothing in this document, and nothing in `AC13`, will ever check.

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

**S13.5 — Development plan reflects the Q-0006/Q-0033 split *(changed round 4 — scoped to the M1 block; adds the done-when assertion the criterion also names)***
*Tags: Q0033-docs*
**Given** `docs/06-development-plan.md`'s M1 block, bounded from the `## M1` heading to the next `## ` heading
**When** that bounded block is read
**Then** its tickets list attributes the engine to Q-0006 and the shipped surface to Q-0033 — matching text already ships today (`Q-0006 Implement review.yaml ... Split 2026-08-22: Q-0006 is the engine half, Q-0033 the CLI/lint/assets/docs half`, followed by a `Q-0033 Review flow surface — CLI, lint, config, shipped assets and docs` line)
**And** the block's "Done when" bullets, specifically — not the tickets list — name the shipped review surface (e.g. mention the CLI preflight, lint rules, config discovery, or documentation alignment this ticket ships), which they do not today: the current three bullets describe the engine's contracts-to-tests mechanism, the fan-out, and `review.yaml` existing and running once, with no bullet naming the surface Q-0033 adds
**Note (round 3 §3.2):** the prior assertion — `/Q-0006[\s\S]*engine/is` and `/Q-0033[\s\S]*(surface|flow|role|lint)/is` run against the whole file — matched on any version of this document that mentions both ticket ids anywhere at all, because `[\s\S]*` spans the entire 74-line file: "Q-0006" appears in the M0 section, "engine" appears in "flow engine" in the v1-cut section, nowhere near each other. Scoping to the M1 block closes that; the added done-when clause covers the half of `AC13`'s own sentence ("and its done-when includes the shipped review surface") the prior version never asserted at all.

**S13.6 — DECISIONS.md gains exactly two new, correctly-formatted entries**
*Tags: Q0033-docs*
**Given** `docs/DECISIONS.md` (append-only)
**When** the file is read after this ticket
**Then** it contains one new entry for the derived regression target and one for the non-auto exhaustion gate, each with a dated title, **Decision**, **Alternatives considered**, and **Why**, and every prior entry is unchanged

**S13.7 — GLOSSARY.md distinguishes the two `human-locked` uses**
*Tags: Q0033-docs*
**Given** `docs/GLOSSARY.md`'s **Gate** entry
**When** it is read
**Then** it gains a sentence distinguishing an author-declared `human-locked` gate (deploy's) from the engine-presented exhaustion gate that reuses the same `kind`, introduces no new synonym for an existing term, and leaves **Role** unchanged

**S13.8 — README is untouched *(changed round 4 — no longer wraps its own copy of the shallow-clone skip branch; see S11.6)***
*Tags: Q0033-docs*
**Given** `README.md` at baseline commit `5d16e06`, reachable in this environment per S11.5's precondition
**When** `git diff --quiet 5d16e06 -- README.md` is run against the tip of the Q-0033 branch (the same baseline-diff pattern S11.5 uses, not `git diff --name-only HEAD`)
**Then** it exits `0` (no diff) — `README.md` is unchanged by this ticket; that rewrite belongs to Q-0028 in M6
**Note (round 1 §4.3):** an earlier version diffed the working tree against `HEAD`, which is empty by construction once a task's own commit becomes `HEAD` — every fan-out task ends by committing its own work, so the comparison could never observe a change even if one had been made. Anchoring to `5d16e06`, exactly as S11.5 does for the frozen contracts, fixed it.
**Note (round 3 §5, structural):** this scenario previously wrapped its own try/catch around the shallow-clone-unreachable case, sharing a label with the real assertion; that made it possible to print an unqualified `✓` whenever the real assertion passed, whether or not the skip branch had ever run. S11.6 is now the single, deterministic proof that the guard's skip path works, so this scenario no longer duplicates it.

**Finding — `Q0033-docs`'s description still instructs an edit `S13.8` requires it not make**
*Tags: none — this is a finding for the architect gate, not encoded as a test*
**Given** `solution/tasks.yaml`'s `Q0033-docs` task, which lists `README.md` among its owned files and instructs it to "give the README the one new command"
**When** that instruction is followed
**Then** `README.md` changes, and `S13.8` — which asserts `git diff --quiet 5d16e06 -- README.md` is empty — goes red, not because anything is broken, but because the task did exactly what it was told. This directly contradicts the merged requirement's non-goal ("The README rewrite is Q-0028 in M6 ... What this ticket owes the cold-clone test is the *absence* of a setup step") and this document's own S13.8
**Why this is written as a finding and not a scenario:** the mirror image of S3.5's reasoning — that finding is a task instructed to do work nothing needs and cannot fail; this one is a task instructed to do the one thing that guarantees its own failure. Neither is a scenario-content defect this document can resolve, since I cannot edit `solution/tasks.yaml`. `qa/scenario-review.md` round 3 §3.4 named this exactly, and confirmed `README.md` is 11 lines and byte-identical to `5d16e06` today, so the red only appears the moment the fan-out follows its own instruction — cheap to catch here, expensive to catch mid-loop
**Recommendation carried to the architect gate:** strike the README clause from `Q0033-docs`'s description in `solution/tasks.yaml` before the next fan-out (and drop `README.md` from its owned-files list unless the intent was to guard it from being touched, in which case say so instead of instructing an edit).

---

## Cross-cutting edge cases

These are not 1:1 with a single AC number but are called out explicitly in `solution.md`'s Risks, "Rejected alternatives," or the architecture reviewer's advisory notes, and are load-bearing enough to warrant their own coverage.

**E1 — Ordering bug would otherwise be invisible (Risk 3)**
*Tags: Q0033-cli, Q0033-lint*
**Given** preflight validation were (hypothetically) run *after* the `--adapter mock` override instead of before it
**When** any mock run of the shipped two-vendor `review.yaml` executed
**Then** it would incorrectly fail the single-vendor-panel rule on every single mock run — S9.2 is the regression test that pins the correct ordering and prevents this from reading as "a lint bug" instead of the ordering bug it would actually be

**E2 — Return-chain validator must survive stages that don't exist yet (Risk 4)**
*Tags: Q0033-lint*
**Given** the validator is written and tested against today's five flows
**When** `qa-final.yaml` and `deploy.yaml` land later (Q-0012) and stage `reviewed` gains a second consumer
**Then** the visited-set rule (S6.8/S6.10) and "ambiguity only on a reached stage" rule (S6.6/S6.7) are what keep the *then-correct* multi-consumer flow set from failing lint — no test in this ticket can exercise the future flows directly, so a suite that reports this group's status must log it as a forward-looking guarantee rather than an unqualified `✓`, per "How to read this document" above; S6.7 is the regression proof that the rule as designed will not retroactively break them

**E3 — `--gate-answer` scoping does not leak into other flags**
*Tags: Q0033-cli*
**Given** `--adapter mock --adapter claude` (repeating a flag other than `--gate-answer`)
**When** the CLI parses its arguments
**Then** `--adapter` still resolves to the last value (`claude`) — proving the accumulation change in S10.2 is scoped to `--gate-answer` only

**E4 — Non-TTY explicit-answer exhaustion is distinguished from `--auto` exhaustion**
*Tags: Q0033-cli*
**Given** the same exhausted-loop setup as S10.6
**When** `--gate-answer advance` **is** supplied (unlike S10.6, where none was)
**Then** the exhaustion gate is answered from the explicit flag and the run proceeds — confirming `--auto` alone is what's rejected, not exhaustion gates in general

**E5 — `init` never fails the whole command when the Git subprocess itself errors, as opposed to merely finding nothing to name (distinct from S5.5)**
*Tags: Q0033-cli*
**Given** a directory where the template copy succeeds but the branch-discovery Git subprocess itself fails to run — reproduced concretely by pointing discovery at a corrupted or unreadable `.git` (e.g. `GIT_DIR` set to a path with no valid Git structure, or `.git/HEAD` made unreadable), which exits non-zero rather than returning an empty name
**When** `harness init` runs
**Then** it still exits `0` with `harness/` and `backlog/` created and `base_branch: main` retained — discovery is best-effort and is never allowed to turn a successful `init` into a failure, and no Git stderr reaches the user

**E6 — A config migration is deliberately not required**
*Tags: Q0033-config*
**Given** an existing project's `harness.yaml` predating this ticket, with a `repo:` block that has `base_branch` but no `max_diff_bytes`
**When** that config is loaded after this ticket ships
**Then** it remains valid with no migration step, no warning, and no forced rewrite — this is the same case as S4.3, restated here because `solution.md` explicitly names "a config migration" as a rejected alternative

**E7 — An offered-but-unneeded `--gate-answer` is silently ignored, not an error**
*Tags: Q0033-cli*
**Given** S3.2's run, which supplies `--gate-answer advance` but regresses via `goto: flow:development` before reaching any gate
**When** the run completes
**Then** the unconsumed answer causes no error and no warning — a `--gate-answer` value is only ever a problem if a gate needed an answer and none was left (S10.4), never merely because one was supplied and not used
