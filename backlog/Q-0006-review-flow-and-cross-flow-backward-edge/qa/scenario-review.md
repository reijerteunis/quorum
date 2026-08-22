# Q-0006 — Scenario review, round 4

Reviewing `qa/scenarios.md` (round 3 revision) and `qa/red-report.md` against
`requirements/merged.md` (30 ACs), `contracts/Q-0006/**`, `solution/tasks.yaml` (post-split),
`solution/errata.md` and the actual test file on `harness/Q-0006/integration`.

**Verdict: approve.**

This gate asks two questions. Every acceptance criterion has at least one scenario, and the red
report shows the suite failing on assertions rather than compile errors. Both are satisfied, and
unlike rounds 2 and 3 there is nothing left in this document to re-cut.

Everything below the verdict is either evidence for it or a hand-off. Two of the hand-offs are
blockers **for the fan-out**, not for this document — they are against `solution/tasks.yaml` and
`harness/roles/`, they cannot be fixed by a further QA round, and one of them is round 3's B3
still open. They are stated as sharply as blockers because a developer agent will hit them within
its first write, but they do not make the red phase untrustworthy, which is what this verdict is
about.

---

## Coverage: 30 of 30

`AC-1` … `AC-30` each carry a scenario, in requirement order, plus `EDGE-1` … `EDGE-17` for
behaviour the architecture review and the frozen contracts named but the requirement did not
number. No criterion is unaddressed and none is deferred as untestable.

Round 3's three findings against this document are closed, and closed correctly:

- **B5** → `EDGE-17`. `review-runtime.contract.md` §Diff input requires a missing
  `harness/<id>/integration` ref to fail before any adapter spawns, naming the ticket id, the
  expected ref, and that review requires an integrated branch, with wording distinct from the
  missing-base-ref error. The new scenario states all four properties, and the test at
  `spike/test/q0006-engine.js:119` asserts the distinctness negatively
  (`!/repo\.base_branch/.test(e.message)`) rather than by hoping the strings differ. That is the
  right shape.
- **N1** → AC-3 now says outright that it has no group of its own and why: an unsupported step
  field would fail the AC-4/AC-6/AC-7 end-to-end runs outright. Discharge by a stronger test is
  legitimate; leaving it unstated was the defect.
- **N2** → EDGE-4's Then clause is now falsifiable: truncated byte length ≤ `max_diff_bytes`, and
  no U+FFFD introduced that the source diff did not already carry. The test implements exactly
  that (`Buffer.byteLength(patch) <= 32`, `patch.includes('�') === false`) against a fixture
  containing `🧪`, so the boundary is genuinely exercised rather than round-tripped.

**Split accounting.** The seven criteria with no test group — AC-1, AC-2, AC-19, AC-25, AC-26,
AC-30, and AC-3 by design — are precisely the ones tagged `Q0006-cli-lint` / `Q0006-assets-docs`,
which E-2 moved to Q-0033. That is the split working, not a gap. I checked the inverse direction
too: of the scenarios tagged `Q0006-runtime` or `Q0006-mock-switch`, only `EDGE-15` has no group
of its own, and its engine-side half is in fact asserted at `q0006-engine.js:134`
(`parallel.every((s) => !s.worktree && !s.instructions)`) — a labelling omission, not a coverage
one. See N2 below.

## The red phase is red, and red for the right reason

The environment is healthy, which is the thing Q-0004 taught this project to check first.
`qa/red-integration.md` records `npm install --prefix spike` exit 0 and a base sync against
`main`; the smoke suite is fully green in the same run, including the `ajv` contract-validator
checks and `harness validate`'s exit codes — so `yaml`, `ajv` and `ajv-formats` all resolve, and
`test/run.js` discovered both files. Nothing here is Q-0004's defect 1 or 3 wearing a disguise.

All 13 scenario groups executed. Every one of the eight imports at the top of the test file
resolved, including `checkAgainstSchema` from `../src/adapters/index.js` and `mockAdapter` from
`../src/adapters/mock.js`. There is no `ERR_MODULE_NOT_FOUND`, no `SyntaxError`, and no
unhandled crash — the failure mode is 9 groups each reporting an assertion diff.

I traced each failure to the specific missing behaviour, because "it failed" and "it failed for
the reason the scenario claims" are different facts:

| Group | Assertion | Missing behaviour |
| --- | --- | --- |
| AC-7/AC-28/EDGE-3 | `'changes-requested' !== 'approve'` | `MOCK_ALWAYS_PASS` does not exist; `mock.js:67` is still `MOCK_ALWAYS_FAIL === '1' \|\| n === 1` |
| EDGE-2/AC-23 | `approve` + one finding not rejected | `checkAgainstSchema` (`adapters/index.js:165`) checks `required` keys and `enum` only |
| AC-5/AC-10/AC-11/EDGE-4/EDGE-5 | prompt lacks `git diff --stat main...` | `buildPrompt` still emits ``Run `git diff …` `` — the exact defect merged.md cites |
| AC-12/EDGE-5, EDGE-17 | `Missing expected rejection` | no pre-spawn ref validation at all |
| AC-4/AC-6/AC-8/AC-9 | `review/round-1/claude.md` absent | `{round}` is not a flow variable, so the write path never interpolates |
| AC-17/AC-18/EDGE-1/EDGE-12 | `'completed' !== 'regressed'` | `--auto` walks through the exhaustion gate (`runGate`, D5) |
| AC-17/AC-18/EDGE-10 | `gates` 0, expected 1 | same |
| AC-22/AC-24 | `codex.md` absent after asymmetric failure | `{round}` again |

Two `✗` lines in the report between the ✓ and ✗ blocks are **not** q0006 failures — they read
`flow "solutioning" consumes "requirements"` and `simulated adapter failure for
candidate-claude.md`, and this test file loads neither a solutioning flow nor any
`candidate-*.md`. They are smoke.js's stderr for its own error-path cases, separated from stdout
by stream buffering. `run.js` agrees: `1 of 2 test file(s) failed`.

**Why 4 of 13 groups are green.** Worth stating, because "green groups in a red phase" is how a
false red usually looks. Three are legitimate regression guards over behaviour that already
landed:

- **AC-13/14/15/16** — the cross-flow edge is already in `engine.js:76-86`, and the counter
  already survives a disk round-trip. The group now drives three real rejection rounds rather
  than pre-seeding (round 3's guidance) and rereads from disk via `f.backlog.read(...)` (round 3
  M5). Correct as a guard.
- **AC-20** — `engine.js:156` is `if (existed || extra.syncBase)`, fixed by Q-0004 after
  merged.md was written. The group does build the pre-existing worktree properly (round 3 B2):
  it creates `harness/T-0001/task-a` from `main`, commits into its worktree, then asserts
  `unicode.txt` — which only lives on the integration branch — appears there afterwards. It
  exercises the merge, not a fresh checkout.
- **EDGE-11** — legacy history is already valid.

The fourth, AC-29/EDGE-13, is green for a weaker reason. See M2.

---

## Findings

### B1 — no role in `harness/roles/` may write `spike/src/**`, and that is every file both tasks own *(blocker for the fan-out; not a defect in this document)*

Both tasks in `solution/tasks.yaml` declare `role: backend`. The shipped `development.yaml`
expands that to `role: "developer-{role}"` → `harness/roles/developer-backend.md`, whose
frontmatter is `paths: [services/api, packages/domain]` and whose body says "you write … only in
your allowed paths: services/api, packages/domain". The step's own `instructions` repeat it: "Do
not touch files outside your role's allowed paths."

`Q0006-mock-switch` owns `spike/src/adapters/mock.js`. `Q0006-runtime` owns `spike/src/engine.js`,
`backlog.js`, `git.js`, `fanout.js`. Neither path is reachable under that allow-list, and neither
directory exists in this repository. The one repo-local role that names `spike/` —
`developer-tooling`, `paths: [spike/bin, spike/test]` — forecloses it explicitly: "if your task
seems to need a change under spike/src, stop and report it rather than reaching across the
boundary."

`paths` is not enforced by the engine (no reader in `engine.js` or `fanout.js`), so this is
prompt-level. That makes it worse, not better: a compliant agent stops and reports, and a
non-compliant one writes wherever it likes. Either outcome fails the first wave.

The fix is a repo-local role — `developer-engine` with `paths: [spike/src]` — and the tasks
retargeted to it. **Do not widen `developer-backend`.** That file is a shipped starter template;
`harness init` copies it into every adopter's repo, AC-1/AC-2 assert the `harness/` and
`spike/templates/harness/` copies stay byte-identical, and widening it to Quorum's own layout is
the precise mistake the cross-vendor reviewer caught and reverted in solutioning round 2 (recorded
in the M0 decision as the clearest demonstration of the product's thesis). Repeating it here would
be the same defect with the reviewer absent.

While there: `harness/architecture.md` is still the unfilled template stub — its "Roles for task
fan-out" section is the instruction to write a table, not a table. EDGE-14 asks that the role
table, the frontmatter and the prose agree; in this repo there is nothing to compare against.
That is Q-0033's to carry, but it is the same root cause.

### B2 — EDGE-2/AC-23 can only go green in a file no task owns, and doing so contradicts a decision *(round 3 B3, still open)*

The test imports `checkAgainstSchema` from `../src/adapters/index.js` and asserts it rejects
`approve` with a finding, `changes-requested` with none, and `major: no-line` for want of a
`file:line`. The implementation at `adapters/index.js:165` handles `required` keys and `enum`
values and nothing else, so the group cannot pass without editing that file.

`Q0006-mock-switch` owns `mock.js` only. `Q0006-runtime`'s description says "dependency-free
verdict/findings validation for all adapters" but its ownership list is `engine.js`, `backlog.js`,
`git.js`, `fanout.js`, `harness/flows/development.yaml` and its template copy —
`adapters/index.js` is in neither. I diffed `tasks-before-split.yaml` against `tasks.yaml`: apart
from reflowing, the only change is the removal of the two Q-0033 tasks. Round 3 asked for this to
be decided before fan-out; the split did not decide it.

There is a second edge. The DECISIONS entry "Contracts are executable: ajv in the toolchain" says
`checkAgainstSchema()` in `adapters/` is "deliberately **separate from**" the contract validator
and "stays minimal: that one guards vendor output and must tolerate variance between CLIs, while a
contract that bends is not a contract." Tightening it to enforce a contract clause inverts that
sentence. Three ways out, and this is a maintainer's call, not a developer agent's:

1. Add `spike/src/adapters/index.js` to `Q0006-runtime` and accept the decision drift, with a new
   DECISIONS entry naming the old one — the docs-and-decisions rule requires that, not a silent
   override.
2. Move the verdict/findings check into `engine.js` where `runStep` already calls
   `checkAgainstSchema` (`engine.js:186`), leave `adapters/index.js` minimal, and retarget the
   test's import. This honours the decision, and `Q0006-runtime` already owns `engine.js` — but it
   needs an erratum, because the test currently binds the clause to the adapter function.
3. Use `spike/src/contracts.js`, which exists precisely to execute a JSON Schema and is the
   decision's own answer to "how does a contract become a failing test". Also needs an erratum.

Option 2 or 3 is right on the merits. Whichever is chosen, it needs to be written down before the
fan-out starts, because both tasks otherwise stall on an unauthorised edit.

### M1 — AC-21's shipped-file half has no failing test, so it can ship unimplemented

`harness/flows/development.yaml` reads `input: { backlog: [solution/solution.md], … }` today.
AC-21 requires `review/verdict.md` beside it, and `tasks.yaml` puts that file under
`Q0006-runtime`'s ownership — so this is Q-0006's own obligation, not Q-0033's.

The AC-20/AC-21/AC-27 group proves only that the engine *can* read an optional backlog file: it
writes its own `development.yaml` fixture at `q0006-engine.js:204` with
`backlog: [review/verdict.md]` already present, then asserts the verdict text reaches the prompt.
That is a true statement about `readFiles`, which already works — hence the green group — and
says nothing about the shipped flow. Nothing in the suite would notice if the shipped file were
never touched, and the reason this criterion exists is that developers cannot act on a review
they never see.

The scenario is complicit: "When `development.yaml`'s fan-out step runs" permits the fixture
reading. Two one-line fixes, and both belong to this ticket:

- AC-21's Given should name **the shipped `harness/flows/development.yaml` and its template
  copy**, and require them byte-identical, as AC-1 does for `review.yaml`.
- The group should parse the shipped file and assert `review/verdict.md` in
  `steps[0].step.input.backlog` — which will fail today, as a red assertion should.

### M2 — the frozen-contract guard cannot fail

`q0006-engine.js:239` resolves the base as `git log -1 --format=%H -- contracts/Q-0006`, then
asserts `git diff <base>..HEAD -- contracts/Q-0006` is empty. `git log -1 -- <path>` returns the
**most recent** commit touching that path. If a task illegally edits a contract, that edit becomes
the base and the range is empty by construction. The check passes in both worlds.

Round 3's B1 asked for a real revision range and got one — the range is real, it is just
self-selecting, so the tautology survived the fix. `assert.match(contractsBase, /^[0-9a-f]{40}$/)`
proves resolution, not independence. Pin the sealing commit instead: `git merge-base HEAD
harness/Q-0006/contracts`, or the contracts commit recorded in the ticket. Then an illegal edit
shows up as a non-empty diff, which is the point.

This is a guard rather than a criterion, so it does not block — but it is currently the only thing
standing between a developer agent and a quietly edited contract, and it is not standing.

### N1 — `import YAML from 'yaml'` at `q0006-engine.js:10` is unused

Harmless, and it does incidentally prove the dependency resolves. Still dead code in the one file
whose AC-29 is about dependency hygiene. Drop it, or use it for M1's parse of the shipped
`development.yaml`.

### N2 — EDGE-15 has no group label

Its engine half is asserted at `q0006-engine.js:134`
(`parallel.every((s) => !s.worktree && !s.instructions)`), inside the AC-4/AC-6/AC-8/AC-9 group;
its "guidance lives in the role file" half is Q-0033's. Add `EDGE-15` to that group's id so the
report shows the coverage that already exists, or say in the scenario that it is discharged there
— the same treatment AC-3 just received.

---

## Checked and deliberately not flagged

- **EDGE-1's persisted `3`.** Correct. `solution/errata.md` E-1 supersedes
  `review-runtime.contract.md`'s `max_iterations - 1`, the DECISIONS entry of the same date
  confirms it against `handleFail`/`runGate`, and the smoke suite already proves the engine
  behaviour. Round 2's B4 is closed properly — by an erratum, not by a test outvoting a contract.
- **Pre-seeding in the exhaustion groups.** `iterations.review = 3` at `q0006-engine.js:165` and
  `:177` is fine. Round 3's objection was to pre-seeding *the bound* (AC-16), which now runs three
  real rejection rounds. Pre-seeding the *precondition* of an exhaustion test is not the same
  thing.
- **AC-22's five outcomes.** All exercised: `regressed` and `completed` in the AC-13 and AC-4
  groups, `exhausted` at `:169`, `aborted` at `:184`, `failed` at `:194`. Round 3's M3 is closed.
- **AC-27's approval assertion.** Now checks `reread(f).meta.stage === 'reviewed'` (`:138`), not
  merely that artifacts exist. Round 3's M1 is closed.
- **EDGE-12's second half.** `:171` asserts exactly one non-exhausted entry for the same run
  carries a non-zero cost. Round 3's N3 is closed.
- **AC-29's dependency check.** Now a delta against `git show main:spike/package.json` rather than
  a fixed expected set. Round 3's M4 is closed. It compares `dependencies` only, which is the
  right scope for what the AC promises.
- **Ticket size.** Not re-litigated. The split already happened, E-2 records it, and the two
  remaining tasks are the right size.

## What has to happen before `harness run development Q-0006`

B1 and B2 are maintainer decisions and neither is expensive — a role file and a one-paragraph
erratum. Both would surface within the first agent's first write, and a developer agent
instructed to "stop and report it rather than reaching across the boundary" will do exactly that,
burning a wave to discover something already known here. M1 is a one-line scenario amendment plus
one assertion and can ride along with them.

The red phase itself is sound and I am willing to be on call for it.
