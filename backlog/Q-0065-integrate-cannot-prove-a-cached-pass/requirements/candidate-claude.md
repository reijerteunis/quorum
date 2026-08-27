# Q-0065 — What may a test command's result be trusted to have done?

*Requirement, 2026-08-27. Role: product-manager. Ticket stage: draft → requirements.*

Three defects sit on one knob: the command `integrate` runs to prove a suite green. One reports a
success it never executed, one cannot be made to execute at all and says so, and one executes,
loses part of the answer, and reports the loss as something else. This requirement decides all
three.

---

## 0. What was verified before this was written, and what did not survive

The ticket body carries measurements inherited from two earlier gates. Three did not hold. They are
corrected here rather than in a footnote, because two of them change what the fix must do.

### 0.1 The `maxBuffer` table is wrong for `runCommand` — it measured a different function

The ticket's table reports row A as `signal: SIGTERM`, and concludes *"In both, `timedOut` is
`false`"*. That is true of bare `execSync` defaults. It is **not** true of `runCommand`, which passes
`killSignal: 'SIGKILL'` (`spike/src/fanout.js:130`, `packages/core/src/fanout/command.ts:64`, and
pinned as source text at `fanout.source.test.ts:146`).

Measured on Node v24.15.0, with `runCommand`'s exact options:

| The child | `e.status` | `e.signal` | `e.code` | captured stdout | `runCommand` reports |
| --- | --- | --- | --- | --- | --- |
| writes 2 MiB, exits 0 | `null` | **`SIGKILL`** | `ENOBUFS` | 1,114,112 B | `code: 1`, **`timedOut: true`** |
| writes 2 MiB, then exits 1 | `1` | `null` | `undefined` | 65,536 B | `code: 1`, `timedOut: false` |
| writes 900 KiB, exits 0 | — | — | — | 921,600 B | `code: 0`, no throw |

Isolating the cause: the identical child yields `SIGTERM` without `killSignal` and `SIGKILL` with it.
Repeated five times with the exact options, row A gave `SIGKILL`/`ENOBUFS` on all five. **It is
deterministic, not racy** — the two rows differ by whether the child exits non-zero, not by a race
with Node's kill.

**Three consequences of the correction.**

1. **Q-0048's implementer was right.** The ticket records their hypothesis — *"the buffer defect
   wearing the timeout's clothes"* — as **disproved**. It holds. They guessed the wrong disjunct
   (`killed === true`, which is indeed `undefined`); the true one is `signal === 'SIGKILL'`. A
   finding offered honestly for checking was checked against the wrong options and dismissed.
2. **"Narrowing `timedOut` would have changed nothing" is false.** It is precisely the fix for row A.
3. **The severity ordering inverts.** Tracing row A through `spike/src/engine.js:1045–1056`:
   `timedOut` → `broken` → `envError = "the suite never ran — the test command did not finish within
   15 minutes and was killed"` → `FlowError`, `tests=invalid` in `runs.log`, run stops. That is a
   **wrong diagnosis that fails closed**: it never satisfies `expect: fail` and never banks a false
   green. Row B is the dangerous one, exactly as the ticket says — `timedOut: false`, a plausible
   non-zero `code`, output truncated to 65,536 bytes, indistinguishable from an ordinary failing
   suite, and banked by `expect: fail` as proof of red.

### 0.2 The cache hazard has never been observed in an `integrate` step

The recorded evidence — Q-0043's merge verification on 2026-08-26 — was a human `pnpm turbo run test`
in the **main working tree**. `integrate` runs its command in the integration worktree
(`engine.js:1042`, `dir`). Those are different cache contexts and the ticket does not distinguish
them. What the repository shows today:

- The main tree holds `.turbo/cache` with 756 entries. **No worktree holds a `.turbo/cache` at all**
  (checked across all 18).
- Turbo demonstrably *ran* in the integration worktrees: per-package `.turbo/turbo-test.log` files
  exist with mtimes matching each ticket's `step=integrate` line to within a minute — Q-0044
  (17:08:33Z → 19:09:17+02:00), Q-0045 (18:56:07Z → 20:57:05), Q-0047 (06:18:15Z → 08:19:23).
- Yet **no cache entry was written into the main tree's cache at any of those minutes**, while 252
  entries were written there today at other times.

A turbo run that executes a task writes a cache entry; a full hit writes none. Neither "wrote to the
worktree" nor "wrote to the main tree" is observed, so **where a worktree run's cache lives is not
established**, and therefore neither is whether `integrate` has ever replayed one. This is not a
reason to doubt the fix — it is a reason not to assert a severity nobody has measured. It is OQ-1,
and it is blocking, because it decides whether `--force` costs `integrate` fifteen seconds or several
minutes on every ticket.

One suggestive detail for whoever answers it: Q-0047's integrate wrote five package logs at 08:19:23
and `packages/core`'s at 08:20:35 — a 72-second spread, the signature of five instant results beside
one real execution.

### 0.3 The ticket body contradicts itself on the configured command

Its `maxBuffer` section quotes the configured command as `npm test --prefix spike && pnpm turbo run
test --force`. `harness/harness.yaml:39` has **no** `--force` — that is the defect the same ticket
exists to fix. The **69,951 bytes** headroom figure was therefore measured against a command that is
not the configured one, and is carried below as unverified.

### 0.4 What did hold

`commands.test` has no `--force` (`harness/harness.yaml:39`). `turbo.json` declares no `env` or
`passThroughEnv` on `test`, and `outputs: []`. The template ships `test: npm test`
(`spike/templates/harness/harness.yaml:31`). `runCommand` passes no `maxBuffer` in either tree, and
`command.ts:59–60` already carries `Why: preserved defect … the fix is Q-0065`. The freeze does not
apply: `port-freeze-guard.sh:99–104` exempts any ticket outside the fourteen children by name.

---

## 1. Problem

`integrate` is the step that makes the only claim worth making about a chore: *this suite is green on
the merged result*. Three separate mechanisms let it make that claim without the evidence.

**The `maintainer` cannot tell an executed pass from a replayed one.** `commands.test` runs
`pnpm turbo run test` without `--force`. Turbo prints every package's full pass output and reports
`Tasks: 7 successful, Cached: 7 cached` having executed nothing. `integrate` reads exit 0, writes
`tests=ok` to `runs.log` and `Tests: … → exit 0 (expected pass) → OK` to `dev/integration.md`, and
the flow advances. This is *"skipped is not passed"* (2026-08-25) one layer down, and it has already
cost once: a cached 7/7 stood over a suite whose `--force` re-run failed 1 of 123.

**A suite that outgrows 1 MiB of output is misreported, in one of two ways, neither of them the
truth.** `runCommand` inherits `execSync`'s 1 MiB default. Per §0.1: an overflow on a zero-exit child
is reported as a **fifteen-minute timeout that did not happen**, stopping the run with a diagnosis
that sends the reader to `commands.install`; an overflow on a non-zero-exit child is
**indistinguishable from an ordinary failing suite**, with output silently truncated to 64 KiB.
Register row 7 — *a suite that could not start is rejected rather than counted as red* — is defeated
from underneath in the second case, because `environmentFailure` reads raw output and truncation can
remove the lines it matches. And because truncation keeps the **head**, `ctx.lastIntegration`'s
`out.slice(-3000)` (`engine.js:1074`) hands the agents the middle of a run instead of the failure
summary they need.

**The `contributor`'s one un-CI-able proof cannot be run by the command that documents it.**
`turbo.json` declares no `passThroughEnv`, so Turbo strips `QUORUM_REAL_CLI` and
`real-cli.probe.test.ts` reports `skipped` under its own documented invocation, forever. It is honest
— it is built to be (`describe.skipIf`, and *"a check that skips its subject must not report
success"*) — so the cost is not a wrong answer but an unobtainable one: the next person follows the
JSDoc, sees `skipped`, and concludes the switch is dead.

**The `adopter` inherits the first hazard by default.** `harness init` copies `test: npm test`, and
Turbo, Nx, Gradle and Bazel all cache by default.

---

## 2. User stories

- **As the `maintainer`,** when `integrate` writes `tests=ok`, I want that to mean a suite ran in this
  run, so that `green` and the gate in front of me are claims about the merged tree rather than about
  a cache.
- **As the `maintainer`,** when a test command produces more output than the engine can hold, I want
  to be told that, so I am not sent to fix an environment that is fine or handed a red phase that was
  never proven.
- **As the `contributor`,** I want the command a test's own documentation gives me to run that test,
  so the one proof CI cannot make is reachable by following the file.
- **As the `adopter`,** I want the shipped `harness.yaml` to warn me that a caching test runner can
  satisfy `integrate` without executing, so my first `integrate` does not teach me the wrong thing.

---

## 3. Acceptance criteria

Surface is named per criterion. **[H]** marks a criterion that must be performed by a human commit —
see the surface check in §7.

### The cache half

**AC-1** — `harness/harness.yaml`'s `commands.test` runs the workspace suite with caching defeated,
by appending `--force` to the `pnpm turbo run test` half. The spike half is unchanged: `node
test/run.js` caches nothing. *Surface: `harness/`.* Testable: the file contains it, and the next
`integrate` line in a `runs.log` was produced by that command.

**AC-2** — The comment above `commands.test` states, in one sentence, that a cached result satisfies
`integrate` without executing and that `--force` is what stops it. It cites Q-0065 and does not
transcribe this document. *Surface: `harness/`.*

**AC-3** — `spike/templates/harness/harness.yaml`'s `test:` line carries a comment telling an adopter
that a caching runner (Turbo, Nx, Gradle, Bazel) can satisfy `integrate` from a replay, and that
their command should defeat it. The default stays `npm test` — the template cannot know their runner,
and changing it would be a default nobody asked for. *Surface: `spike/templates/`.*

**AC-4 [H]** — A `docs/DECISIONS.md` entry records which of the ticket's three shapes was chosen and
why the other two were refused: shape 2 (parse the runner's output for a cache-hit signal) and shape 3
(`TURBO_FORCE=1` in the engine's environment) both put one tool's name inside `core`, which
`harness/rules.md` keeps out of the engine. The entry states the accepted cost — every `integrate`
re-executes the workspace suite — with the number from AC-5. *Surface: `docs/DECISIONS.md`.*

**AC-5** — The cost of AC-1 is measured, not estimated: wall-clock of `pnpm turbo run test` against
`pnpm turbo run test --force` on a green `main`, both recorded in the implementation report. If OQ-1
resolves to "integrate already runs cold", the report says so and the measured delta is zero for
`integrate` and non-zero only for human verification. *Surface: `backlog/` (report only — written by
the engine's `output.writes`, not by the agent).*

### The environment half

**AC-6** — `turbo.json`'s `test` task declares `"env": ["QUORUM_REAL_CLI"]`, so the variable reaches
the child and participates in the task hash. *Surface: `turbo.json`.* Testable by reading the file
and by `turbo run test --dry=json` showing the variable among the task's inputs — neither costs a CLI
round-trip.

**AC-7** — `packages/core/src/adapters/real-cli.probe.test.ts`'s JSDoc gives a command that actually
runs the file. With AC-6 in place the documented turbo invocation qualifies; the JSDoc additionally
records the direct `vitest` invocation as the fallback that needs no turbo configuration. Its existing
`--force` sentence, which already cites Q-0065, stays. *Surface: `packages/core`.*

**AC-8** — Acceptance evidence for AC-6/AC-7 is **taken at the gate, not by the implementer**: running
the documented command reports the two probes as executed rather than `skipped`. Neither the
implementer nor the reviewer may spend a paid CLI round-trip, which is why this defect was reachable
only from a gate in the first place. A criterion whose evidence the flow cannot produce is named as
such rather than left to be discovered. *Surface: gate.*

### The buffer half

**AC-9** — `runCommand` passes an explicit `maxBuffer` whose value is written down in the JSDoc with
its unit. The value is a decision, not a magic number: it is stated as a multiple of the largest
observed real output (OQ-2).

**AC-10** — A buffer overflow is **never** reported as a timeout. Per §0.1 the current code reports
row A as `timedOut: true`; after this change, a command killed for exceeding its buffer is
distinguishable from one killed for exceeding its time.

**AC-11** — A detected overflow is its own terminal outcome and **fails closed**: like `envError`, it
stops the run with a message naming the buffer, and it never satisfies `expect: fail`. An overflow is
not evidence of a red phase, for the same reason a suite that could not start is not.

**AC-12** — The three shapes in §0.1's table are covered by tests in both trees: overflow with a
zero-exit child, overflow with a non-zero-exit child, and a large-but-under-ceiling command that must
still return cleanly. The tests pass `runCommand`'s real options — a test that omits `killSignal`
measures a different function, which is how this defect was mis-recorded twice.

**AC-13** — The landed tests that pin `runCommand`'s shape are updated in the same change, and the
change is stated in the report rather than discovered in review:
`packages/core/src/fanout/command.test.ts:14` and `:23` assert the return value with `toStrictEqual`,
so any new field breaks them; `fanout.source.test.ts:44–46` pins the module's exports to exactly
`['runCommand']`; `:146` pins `killSignal: 'SIGKILL'` as source text. *Surface: `packages/core`.*

**AC-14** — The fix lands in `spike/src/fanout.js` **and** `packages/core/src/fanout/command.ts`
together, and the two remain behaviourally identical. This is the Q-0066/Q-0068 shape: a fix in one
tree alone leaves the port's independent witness disagreeing with the port, which is the divergence
the freeze exists to expose. The freeze itself does not apply — Q-0065 is not one of Q-0009's
fourteen children (`port-freeze-guard.sh:99–104`) — and the implementation report says so explicitly,
so the reviewer does not spend a round on it.

---

## 4. Non-goals

- **Streaming command output to a file.** It is the only *complete* removal of the ceiling, and it
  changes what `runCommand` returns, which is externally observable through `dev/integration.md` and
  the persisted `output.txt`. That is a product, not a chore. OQ-2 says when it becomes necessary.
- **Making `integrate` parse any runner's output.** Refused by AC-4.
- **Fixing `integrate`'s other known weaknesses.** Register row 7's detector, `out.slice(-3000)`, and
  the truncation-hides-signatures interaction are named as consequences and are not repaired here
  beyond AC-11's fail-closed outcome.
- **Changing the shipped template's default test command.** AC-3 comments; it does not decide for the
  adopter.
- **`budget.per_run_usd`, the chore flow's first-pass branch prerequisite, and worktree pruning
  (Q-0062).** Neighbours on the same page, each with its own ticket or needing one.
- **A `--force` habit for human verification.** Already in the session memory; not a repository
  change.

---

## 5. Open questions

| # | Question | Owner | Blocking? |
| --- | --- | --- | --- |
| **OQ-1** | Where does a turbo run inside a git worktree put its cache, and has `integrate` ever replayed one? §0.2 shows turbo running in the worktree while no cache entry appears in the only cache directory that exists. If `integrate` already runs cold, AC-1 costs it nothing and the hazard is confined to human verification and to repeat runs in a reused worktree (worktrees are never removed — Q-0062). If worktrees share the root cache, the hazard is every run. | Gate, before implement | **Yes** — decides AC-5's number and the severity AC-4 records |
| **OQ-2** | What `maxBuffer` value, and does the ceiling need removing rather than raising? Needs the largest real output actually observed. The ticket's 69,951 bytes measured a command that is not the configured one (§0.3); a *failing* run prints diffs and stack traces, the suite is 562 tests and growing, and Q-0054 still has the regression suite to port. | Implementer, reported; value confirmed at gate | No — AC-9 requires the number be justified, not any particular number |
| **OQ-3** | Should the buffer half be its own ticket? Fourteen criteria is at the upper end of the 2026-08-22 sizing decision, and the buffer half is the only one touching code in two trees with landed test pins. Against splitting: each half is genuinely small, and all three answer one question, which is the ticket's own argument. Recommendation: **keep together**; if the gate disagrees, the line is AC-9…AC-14. | Gate | No |
| **OQ-4** | Does the `install` command need the same treatment? It runs through the same `runCommand` (`engine.js:1036`) with the same ceiling, and `pnpm install --frozen-lockfile` over a seven-package workspace is not quiet. AC-9's raised ceiling covers it incidentally; nothing here verifies it. | Implementer, reported | No |

**A note the gate needs before it schedules this.** The engine reads `ctx.config` from the object
passed into `runFlow` at run start (`engine.js:37, 43`), not from the integration worktree. A changed
`commands.test` on the implement branch therefore does **not** take effect for its own run's
`integrate` step. This ticket cannot prove AC-1 through its own flow; AC-1's evidence is the *next*
ticket's `integrate`, or a hand-run after the merge. That is a fact about the engine, not a defect
this ticket owns — but a reviewer who assumes otherwise will ask for evidence that cannot exist.

---

## 6. Risks

- **AC-1 slows every `integrate` by the full workspace suite.** That is the price of the claim being
  true, and it is the accepted cost AC-4 records. It also lengthens the `adopter`'s first 30 minutes
  indirectly — hence AC-3 comments rather than changes their default.
- **AC-9 moves the cliff rather than removing it.** Row B stays undetectable *below* the new ceiling:
  `code` is the child's own status, there is no signal, and captured output is far below `maxBuffer`,
  so no length check catches it. Stated in the JSDoc rather than left implied, and OQ-2 owns when the
  ceiling must go.
- **AC-10 narrows `timedOut`.** A timeout is a safety property (Q-0011's 24-minute hang), and
  narrowing its detection is exactly the kind of change that re-opens a closed defect. `command.test.ts`
  already covers the real timeout path (`:34–48`); AC-12 must not weaken those.
- **The buffer fix changes a function two trees and several landed suites depend on.** AC-13 names the
  pins; anything it misses surfaces as a review round.
- **This ticket's subject is the machinery its own flow runs on** — *"do not drive harness-machinery
  work through the harness"* (2026-08-23). The chore route plus hand-written acceptance evidence is the
  mitigation, and no criterion here asserts on `integrate`'s *current* behaviour, only on the behaviour
  it will have.

---

## 7. Cross-cutting checklist

| Concern | Answer |
| --- | --- |
| **BYOS** | Touched, and improved. AC-6 makes the one test that proves subscription auth actually runnable. No criterion introduces an API-key path; `real-cli.probe.test.ts`'s `withoutApiKeys` guard is unchanged. |
| **Worktree safety** | Unchanged. `integrate` keeps running in the integration worktree; nothing here writes to the user's working tree. |
| **Gate behaviour** | Unchanged, with one addition: AC-8 is explicitly gate-performed. AC-11 adds a terminal outcome that stops a run rather than advancing it. |
| **File format / schema** | No persisted format changes. `runs.log`'s `tests=ok\|fail\|invalid` vocabulary is unchanged — an overflow reports through the existing `invalid` path. `CommandResult` is an in-memory shape, not a persisted one; AC-13 names its test pins. |
| **Lint rules** | None added. No new dependency. |
| **Cold-clone impact** | AC-3 only, and it is one comment in a file the adopter reads. AC-1 does not reach them: their `commands.test` is the template's `npm test`. |
| **Cross-vendor rule** | Satisfied by the chore flow as shipped (claude implements, codex reviews). |
| **Product-agnostic** | No product名 anywhere. Turbo is named in configuration the user owns and in no `core` source — that is AC-4's whole point. |

### Surface check — the three questions of 2026-08-27

Asked of every criterion, per *"`.claude/rules/` is a derived copy, not a surface a requirement may
name"*. The failure that entry records was a requirement certifying only that it named no `backlog/`
and never asking the general question.

1. **May the role write it?** `developer-generalist`'s `paths` are `package.json,
   pnpm-workspace.yaml, turbo.json, tsconfig*.json, .npmrc, .gitignore, .github, packages, apps,
   spike, harness, docs`. Every implementer surface above — `harness/harness.yaml`, `turbo.json`,
   `spike/templates/`, `spike/src/fanout.js`, `packages/core/src/fanout/`,
   `packages/core/src/adapters/` — is covered.
2. **Will the engine revert it?** No criterion names `backlog/`. AC-5's report reaches the ticket
   folder through the step's declared `output.writes`, which the engine writes — not through an agent
   edit that `commitAll` would revert.
3. **Is it derived?** No criterion names `.claude/`, `CLAUDE.md`, `AGENTS.md` or `GEMINI.md`. Nothing
   here edits `harness/rules.md`, so no paired copy is owed.

**One criterion fails question 1 deliberately and is marked for it.** **AC-4** names
`docs/DECISIONS.md`. `docs` is in the role's `paths`, but `harness/roles/developer-generalist.md`
states in as many words: *"You do not append to `docs/DECISIONS.md`; a decision is the human's to
record."* AC-4 is therefore **[H]** — performed by human commit, like Q-0069's AC-11(b), and settled
here rather than by three correct refusals at $8–10 each. The implementer's obligation is to name the
decision in its report, in the wording the human transcribes.
