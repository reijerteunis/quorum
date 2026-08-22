# Q-0006 — Architecture review of `solution/draft.md` (round 2)

**Verdict: revise.** Five blockers, five majors, five minors. The approach is unchanged from round 1
and still right; so is almost all of the decomposition. Three of the five blockers are one-line
contract edits. One is a product-boundary leak that would ship to strangers. One is a test the
solution promises will stay green and which this ticket breaks.

Verified against the spike at `3482247`, the contracts branch `harness/Q-0006/contracts` (`369c870`),
the shipped flows and roles, and `spike/test/smoke.js`.

## Round 1 is closed

Stated first, and in detail, because the revision must not undo any of it.

- **B2, B3, B4 and M1–M10 are all genuinely resolved.** AC-27/29 moved to `qa-red` with an explicit
  "developers must not edit tests" clause; `Q0006-mock-switch` is a dependency-free production-only
  task; runtime and CLI/lint are serialized with `harness.yaml` owned exactly once; the state schema
  now carries a `oneOf` that accepts the `{stage, run, flow, at, cost}` entries already on disk in
  `backlog/Q-0001-…/ticket.md` and `backlog/Q-0006-…/ticket.md`; `exhausted` has a defined moment of
  record; `code-reviewer-role.contract.md` exists and closes the `resolveModel` leak by requiring
  `adapter` whenever `model` is present; AC-14's reporting fields are named; AC-7 is honestly scoped
  to instruction-text plus schema plus real-CLI evidence; the lint walk has a visited set, an
  ambiguity rule and a named negative fixture; M10's "semantically identical" is now `YAML.parse`,
  delete `file`, deep-equal.
- **AC-3 holds — I re-checked every field.** `output.write` and `output.writes` (`engine.js:302`),
  `verdict: approve|changes-requested` splitting in `schemaFor` (`engine.js:260`), the
  `review/round-{round}/*.md` glob in `Backlog.readFiles` (`backlog.js:74-84`), `instructions`
  (`engine.js:282`), `on_fail.goto: flow:…` skipping the local-id check (`engine.js:29`) and
  regressing via `loadFlowByName` (`engine.js:80-82`), and `n <= max_iterations` giving exactly
  three regressions before the gate (`engine.js:192`). No engine feature is invented.
- **The shipped flow passes the existing cross-vendor lint unchanged.** The verdict step's glob
  matches both `claude.md` (claude) and `codex.md` (codex) in the producer map, so
  `engine.js:43-49` is satisfied without touching that rule.
- **The 4-task serial chain executes.** `waves()` (`fanout.js:26-38`) yields four single-task waves;
  `runFanOut` merges each wave into `harness/Q-0006/integration` before the next
  (`engine.js:354-357`) and `syncBase: … || w > 0` (`engine.js:347`) pulls it into the next
  worktree. The serialization the solution claims is the serialization the engine performs.
- **`Q0006-runtime` owning both `development.yaml` copies and `Q0006-assets-docs` being told not to
  touch them** is exactly the right fix for round 1's B3. Keep it.

---

## Blockers

### B1. The widened backend role was mirrored into the shipped starter template

`spike/templates/harness/roles/developer-backend.md` now reads
`paths: [spike, harness, docs, backlog, contracts]`, and its body prose says *"your allowed paths:
spike, harness, docs, backlog, contracts"*. `harness init` copies that directory verbatim into the
adopter's repository (`spike/bin/harness.js:73`). `spike/` exists in exactly one repository on earth.
Every stranger who runs `npx quorum init` now gets a backend developer role scoped to Quorum's own
dogfood layout, and loses `services/api` / `packages/domain` — which at least described *a* project.

This is the failure mode `docs/DECISIONS.md` (2026-08-22, *Product-agnostic; …dogfooded on Ruud's SaaS
portfolio*) names outright: "nothing product-specific lives in the Studio, its templates or its docs…
Each repo carries its own `harness/` context files". Quorum is the dogfood target here, and its
layout has leaked into the template.

The solution justifies the mirroring as byte-identity, but the repository does not hold that
invariant and this change does not restore it. On `main`, `diff -rq harness spike/templates/harness`
already reports three legitimate divergences — `harness.yaml`, `product-context.md`, `rules.md` — and
the contracts branch adds a fourth by changing `harness/architecture.md` **without** changing
`spike/templates/harness/architecture.md`. So the solution is already treating architecture.md as
repo-specific and developer-backend.md as template-shared, with no stated rule for which is which.
AC-1's actual test is scoped to `harness/flows`, and AC-2's to `code-reviewer.md`; neither covers the
developer roles.

**Fix:** revert `spike/templates/harness/roles/developer-backend.md` (frontmatter *and* the prose line
— note `paths` is never read by any code, I grepped `spike/src` and `spike/bin`; the allow-list reaches
the agent only through `role.body` at `engine.js:271`). Widen only `harness/roles/developer-backend.md`.
Delete "the backend role and template copies are byte-identical" from the Verification section, and
state the rule the repository actually follows: `flows/` and `roles/code-reviewer.md` are byte-shared;
`harness.yaml`, `product-context.md`, `rules.md`, `architecture.md` and the developer roles are
repo-specific. Put that rule in `harness/architecture.md` while you are filling it in.

### B2. AC-18's `retry` has two incompatible definitions and the contract asserts both

`review-runtime.contract.md`: *"`retry` resets only `iterations.review` and authorises exactly one
additional traversal."* Those are different behaviours.

Trace it. `runGate` answers `retry` → `{goto: retryTarget}` = `flow:development` → `runFlow`
(`engine.js:78-82`) regresses and **ends the run**. The reset counter is persisted by `finish()`
(`engine.js:231`). The next review run starts with `iterations.review = 0`, so a rejection is count 1
of 3 and regresses with no gate; so does count 2, and count 3. One human `retry` therefore buys four
more traversals, not one. Resetting to zero *is* granting a full new budget — which is a defensible
choice, but it is not "exactly one".

QA cannot write the test: after `retry`, is the asserted `iterations.review` in `ticket.md` `0` or
`2`? Does the following rejection regress silently or land on the gate again? This is the ticket's
core safety property — "no loop may run unbounded on a user's subscription" — and it is the one
clause with no determinate answer.

**Fix:** pick one and write the persisted value into the contract. Either (a) `retry` sets
`iterations.review = max_iterations - 1`, so the very next rejection re-presents the gate — this is
what "exactly one more traversal" means and it is the safe reading; or (b) `retry` sets it to `0` and
the contract says plainly that a human retry restores the full budget of `max_iterations`. Then say
which integer QA asserts, and keep D4's scope clause (`qa` and other counters untouched) either way.

### B3. The mock can never emit a `changes-requested` verdict that satisfies `review-artifacts.schema.json`

The schema requires every finding to match `^(blocker|major|nit): .+:[1-9][0-9]* .+`.
`spike/src/adapters/mock.js:66` emits `'(mock) tighten acceptance criterion 2'` and
`'(mock) missing non-goal'`. Neither matches, and the engine persists them verbatim to
`.harness/verdict-verdict.json` (`engine.js:167`) — the only machine-readable finding artifact the
suite produces.

`Q0006-mock-switch` owns `mock.js`, but `mock-adapter-switches.contract.md` scopes it to two switches
and their precedence and states the controls "do not alter adapter failures, document generation,
task fan-out, or production engine routing". Nothing authorises changing the findings strings, and
the task description says "leave the existing fallback call-count behavior intact".

So every AC-27 scenario that reaches `changes-requested` — the first three in the qa-red list —
produces an artifact that violates this ticket's own contract. The obvious red-phase assertion, "the
verdict artifact from a mock review run validates against `review-artifacts.schema.json`", can never
go green. The QA list only has the negative half ("approve-with-findings fails schema validation"),
which passes against a hand-written object and proves nothing about the system.

**Fix:** cheapest is one clause in `mock-adapter-switches.contract.md` and one line in the task:
when the schema contains `verdict`, the mock emits findings in the contract's severity form, e.g.
`major: src/mock.ts:1 (mock) placeholder finding`. Alternatively, state in
`review-artifacts.schema.json` that the pattern is asserted against real-CLI output only, and give QA
the exact fixture-based assertion instead. Do not leave it implicit.

### B4. AC-25's pre-execution resolution is contracted for `harness lint` but not for `harness run`

AC-25: *"Resolution happens at lint time, **before any agent is spawned or any ticket file is
written**."* `review-lint.contract.md` opens with "`harness lint` loads the complete flow directory"
and binds nothing else. Meanwhile:

- `lintFlow` deliberately skips `flow:`-prefixed goto targets (`engine.js:29`), so a `review.yaml`
  pointing at a non-existent flow passes `loadFlow` and passes `harness lint`'s per-file loop
  (`bin/harness.js:106-108`) — the directory walk is new code that only the `lint` command is
  contracted to call.
- `bin/harness.js:135` calls `loadFlowByName` for the flow being run and nothing else.
  `loadFlowByName(target)` for the goto target is first called at `engine.js:80` — *after* two
  reviewers and a judge have run and after `review/round-N/` has been written.

That is precisely the failure AC-25 exists to prevent, on the one path where it costs money. Nothing
in the runtime contract or in either task description closes it.

**Fix:** one clause in `review-runtime.contract.md`: `harness run` resolves every `goto: flow:<name>`
in the loaded flow, and performs the chain walk, before the first `adapter.run` and before any write
to the ticket folder; the error text is the lint error. Assign the line (`Q0006-cli-lint` already
owns `bin/harness.js` and the new `lint.js`; `Q0006-runtime` owns `runFlow`, so say which). If you
genuinely intend `run` not to do this, say so in the solution and record the accepted cost — but then
AC-25's second sentence needs to change and that is a requirement amendment, not a solution detail.

### B5. D5 inverts an existing smoke assertion, and the solution says the suite stays green

`spike/test/smoke.js:70-73`:

```js
// Exhausted loop lands on a gate; --auto advances it
r = run(['run', 'requirements', 'T-0002', '--adapter', 'mock', '--auto'], { MOCK_ALWAYS_FAIL: '1' });
assert(r.stdout.includes('loop exhausted'), 'exhausted loop reaches a human gate');
```

That check exists *because* `--auto` walks through the exhaustion gate (`engine.js:202`). AC-17/D5
makes that impossible for every flow, not just review — `requirements.yaml`, `solutioning.yaml`,
`qa-red.yaml` and `development.yaml` all carry `on_exhausted: gate`. After the change this run
reaches `ui.gate` (`bin/harness.js:53-62`), whose `readline.question` is waiting on a `spawnSync`
child's stdin — a pipe that is closed immediately, since `run()` passes no `input`. The promise never
resolves on a line; readline sees EOF. Best case AC-19 turns it into an explicit error and the run
exits non-zero; worst case the suite hangs. Either way `npm test --prefix spike` no longer passes,
which is AC-29 verbatim.

The solution's qa-red list promises "existing draft-to-green, API-key refusal, and no-pinned-Codex-model
checks remain green" and never mentions this one. Development is forbidden from editing tests, so as
written nobody is authorised to fix it.

**Fix:** name `spike/test/smoke.js:70-73` in the qa-red responsibilities as an assertion that must be
rewritten — supply `--gate-answer`, assert the gate is *presented* under `--auto` rather than
bypassed — and add a sentence to the D5 DECISIONS entry that this changes `--auto` for all four
shipped flows and required a test inversion. While you are there: state in the runtime contract what
a gate does on a non-TTY stdin with no `--gate-answer` (AC-19 says "error naming the gate"; the
contract should say the process exits non-zero rather than blocking).

---

## Majors

### M1. Eight acceptance criteria have no test, and only qa-red may write one

The "QA-red responsibilities" list is the sole place tests are assigned, and developers are explicitly
barred from adding any. Anything absent from that list will never be tested. Absent:

| AC | What is untested |
| --- | --- |
| 1, 2 | template parity — `diff -rq harness/flows spike/templates/harness/flows` and the `code-reviewer.md` copy. Requirement Risk 5 says in terms that AC-1/AC-2 "make it a test rather than a habit" |
| 5 | reviewers create no worktree and no branch; `git status --porcelain` unchanged outside `backlog/` |
| 9 | `review/verdict.md` exists and is overwritten each round |
| 10, 11 | stat block present and untruncated, three-dot range, truncation notice in prompt *and* `runs.log` |
| 12 | a missing base ref stops before any adapter spawn |
| 15 | lint rejects `counter: iterations.review` and suggests `review` |
| 16 | lint rejects missing / non-integer / zero / negative `max_iterations` |
| 26 | a single-vendor same-role panel fails lint |

AC-5 and AC-12 are the two that keep a review run safe and cheap; AC-16 and AC-26 are the lint rules
this ticket exists to add. **Fix:** extend the list, or state explicitly that AC-27 is the agreed
automated scope and name how the remaining eight are verified. Silence assigns them to nobody.

### M2. An exhausted run writes two costed history entries and `harness board` sums both

`bin/harness.js:96` rolls a ticket's cost up as `history.reduce((s, h) => s + (h.cost ?? 0), 0)`. The
contract has the exhaustion gate append an `exhausted` entry when presented, and the answer append a
second terminal entry, both for the same `run`, both carrying `cost` (the schema requires it on the
new shape). `ticket-review-state.schema.json` puts no uniqueness constraint on `run`. A run that
exhausts and then aborts is therefore counted twice on the board and in any future roll-up.

That silently corrupts the one number `docs/DECISIONS.md` (2026-08-22, *Cost and duration per stage,
measured*) says must be measured rather than guessed — and M6's "board needs no production change" is
what makes it invisible.

**Fix:** state in the runtime contract that the `exhausted` entry carries `cost: 0` and the terminal
entry carries the run's full cost (or that roll-ups dedupe by `run` — but then `board` *does* need a
change). Add a board cost assertion to the qa-red list. While you are there, say that the `exhausted`
entry's `stage_before` and `stage_after` are both the unchanged current stage; the schema requires
both and a non-transition has no natural value.

### M3. `--gate-answer` is one flag and a review run can present two gates

The contract: *"An answer comes from `--gate-answer advance|retry|abort` or stdin."* It does not say
whether the value is consumed once or applied to every gate. A review run at attempt 4 presents the
exhaustion gate (`engine.js:197`) and, if answered `advance`, then presents the flow's closing
`gate: human` (`runGate`, `engine.js:200`) — two gates, one flag.

QA's scenario "`advance` at exhaustion completes toward `reviewed`" has no deterministic form until
this is settled, and the natural mixed case (`advance` at exhaustion, `abort` at the closing gate)
cannot be expressed at all.

**Fix:** one sentence. Either `--gate-answer` is repeatable and consumed in order, or it applies to
every gate in the run and `--auto` continues to cover ordinary gates so a single value only ever
reaches the exhaustion gate. Say which, and say what happens when answers run out.

### M4. `harness init` outside a git repository has no defined `base_branch` behaviour

D7 and AC-12 make `init` write the repository's current branch. `init` (`bin/harness.js:69-77`) does
no git at all today and does not require a repository; the cold-clone path is a stranger running it
in a folder that may have no `.git`, or a fresh `git init` with no commit — where
`git rev-parse --abbrev-ref HEAD` reports an unborn branch. The contract says only "writes the current
branch as `repo.base_branch` in the generated config".

This is the first command in the README path. **Fix:** state the fallback (omit the key and let the
`main` default apply, or write `main`), state that no error is raised, and add it to the qa-red list.
Also state whether `spike/templates/harness/harness.yaml` ships a `repo:` block at all — if it ships
one with a hard-coded branch, init's write is a rewrite rather than an insert, and QA needs to know
which.

### M5. The development tasks can write the contracts they are graded against

`developer-backend`'s new `paths` includes `contracts`, and `Q0006-assets-docs` authors
`harness/flows/review.yaml` while `review-flow.contract.yaml` — the fixture the deep-equality test
compares it to — sits in `contracts/Q-0006/`, already merged onto the integration branch by
`solutioning.yaml`'s `merge-contracts` step. An agent that cannot make the flow match the fixture can
make the fixture match the flow, and the same is true of every other contract in the set. That is the
red→green mechanism inverted, and it is the same class of problem as round 1's B2.

**Fix:** state in the solution — and in each task description — that `contracts/Q-0006/**` is frozen
at the contracts commit and no development task may modify it; drop `contracts` from
`developer-backend`'s allow-list, or scope it to `contracts/` paths outside the current ticket.
Add a qa-red assertion that `git diff <contracts-commit> -- contracts/Q-0006` is empty on the
integration branch.

---

## Minors

- **N1.** "more than one consumer is ambiguous" turns a configuration that is legal today into a hard
  lint failure for every user with two flows consuming one stage. Consider a deterministic tie-break
  or a warning, or scope the error to stages actually reached from a `goto: flow:` walk. As written
  it is a behaviour change to everyone's `harness lint`, unmentioned in AC-25 and undocumented in
  AC-30.
- **N2.** The lint contract names `review -> review` as the negative fixture but not where it lives.
  A self-targeting `review.yaml` cannot sit in `harness/flows/` — it would break `harness lint`,
  `harness board` (`bin/harness.js:89`) and the shipped-flow parity check. Say the fixture is built
  in a temporary harness directory.
- **N3.** The verdict step's input glob `review/round-{round}/*.md` matches its own output. On a round
  retried after a post-verdict failure, the previous verdict is fed back to the judge as if it were a
  panel review. Either exclude `verdict.md` from the glob or list the two panel files by name.
- **N4.** `review-flow.contract.yaml` uses `output.write` for the panel and `output.writes` for the
  verdict. Both work (`engine.js:302`), but this fixture is the example a contributor copies. Pick one
  spelling. (Also: the header comment reads "must be parse to the same value".)
- **N5.** `harness/architecture.md`'s new table says it "must match the `paths` frontmatter in
  `harness/roles/developer-<role>.md`". `paths` is read by nothing — the constraint reaches the agent
  only through the role's prose body (`engine.js:271`). Say that in the table, or the next architect
  will assume the harness enforces it.

---

## Acceptance-criterion coverage

| AC | Task | Contract | Test | Status |
| --- | --- | --- | --- | --- |
| 1 flow exists, lints, byte-identical copy | assets-docs | flow fixture | — | **M1** |
| 2 `code-reviewer` role | assets-docs | role contract | — | **M1** (contract now exists — round-1 M2 closed) |
| 3 engine-supported fields only | assets-docs | flow fixture | AC-27 runs | ok — re-verified field by field |
| 4 two reviewers, two vendors | assets-docs | flow fixture | AC-27 runs | ok |
| 5 reviewers read-only | runtime | runtime §diff | — | **M1** |
| 6 verdict step | assets-docs | flow fixture + artifacts | AC-27 runs | ok |
| 7 severity threshold | assets-docs | flow instructions + artifacts | QA list | ok — round-1 M4 closed |
| 8 rounds never overwrite | runtime | runtime §config | QA list | ok — still the strongest clause |
| 9 stable `review/verdict.md` | assets-docs | flow fixture | — | **M1** |
| 10–11 diff materialisation + range | runtime | runtime §diff | — | **M1** |
| 12 base branch configured | cli-lint | runtime §config | — | **M1 + M4** (round-1 B3 closed) |
| 13 derived regression | runtime | runtime §routing | QA list | ok |
| 14 run stops; CLI reports | runtime | runtime §routing | QA list | ok — round-1 M3 closed |
| 15 counter persisted; board | runtime + cli-lint | runtime §routing | partial (board only) | **M1** (lint spelling untested) |
| 16 exact bound + lint | cli-lint | lint contract | — | **M1** |
| 17 exhaustion gate vs `--auto` | runtime | runtime §routing | QA list | **B5** |
| 18 three distinct answers | runtime | runtime §routing | QA list | **B2** |
| 19 no defaulted answer | cli-lint | runtime §routing | QA list | **M3** |
| 20 rework sync | runtime | runtime §rework | QA list | ok |
| 21 developers see verdict | runtime | runtime §rework | QA list | ok |
| 22 outcomes distinguishable | runtime | state schema | QA list | **M2** (round-1 B4 + M1 closed) |
| 23 invalid output stops cleanly | runtime | runtime §atomic | QA list | ok |
| 24 asymmetric panel | runtime | runtime §atomic | QA list | ok |
| 25 cross-flow targets resolve | cli-lint | lint contract | QA list | **B4** (run path unowned) |
| 26 single-vendor panel fails lint | cli-lint | lint contract | — | **M1** |
| 27 mock suite covers the loop | qa-red | all | — | ok — round-1 B2 closed |
| 28 determinism switches | mock-switch | mock contract | QA list | **B3** |
| 29 everything else green | qa-red | — | QA list | **B5** |
| 30 docs agree | assets-docs | — | — | ok |
| — repo role boundaries | contracts branch | architecture.md + role | — | **B1 + M5** |

## What I need to see to approve

1. The template copy of `developer-backend` reverted, and the stated rule for which `harness/` files
   are byte-shared with `spike/templates/harness/` and which are repo-specific. (B1)
2. One definition of `retry`, with the integer QA asserts in `iterations.review`. (B2)
3. Mock findings that can satisfy the artifacts schema, or an explicit statement that the pattern is
   real-CLI-only plus the fixture assertion QA writes instead. (B3)
4. A runtime clause binding `harness run` to resolve cross-flow targets before the first spawn, with
   an owner. (B4)
5. `spike/test/smoke.js:70-73` named as an assertion qa-red must invert, and the non-TTY gate
   behaviour stated. (B5)
6. Tests assigned for the eight uncovered ACs — or a stated reason each is verified by inspection; the
   cost-double-count rule; `--gate-answer` semantics across two gates; `init` outside a git repo; and
   `contracts/Q-0006/**` frozen against development. (M1–M5)

Everything else I would take on call today.
