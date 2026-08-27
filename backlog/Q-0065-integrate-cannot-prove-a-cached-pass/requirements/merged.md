# Q-0065 — What may a test command's result be trusted to have done?

*Merged requirement, 2026-08-27. Role: head-of-product. Verdict: **ready** — eleven criteria, the
cache and environment halves, no blocking open question. The buffer half is split out as Q-0070,
whose body is drafted in §8 so the obligation cannot expire.*

---

## 0. Why this run exists, and what changed

`harness/flows/requirements.yaml` routes this step's rejection back to **itself** —
`on_fail: { goto: head-of-product, max_iterations: 1, on_exhausted: gate }` — not back to the two
product managers. The candidate files confirm it: `candidate-codex.md` and `candidate-claude.md`
carry mtimes of 13:08:51 and 13:15:31, exactly matching run 1's `pm-codex` and `pm-claude` lines in
`runs.log`. They were not regenerated. This traversal handed me my own previous merged document and
verdict and asked me to think again, with no new input available to anyone.

**The substantive judgement is unchanged, and it was right.** The buffer half is a different kind of
ticket and it is split out below. **The verdict changes**, for a reason worth stating precisely
because it is the kind of mis-addressing that costs a round:

> Run 1 returned `needs-input` **on the size of the two candidates** — 14 and 15 criteria against
> the 2026-08-22 ceiling. But the document it produced was *already* re-cut to eleven. The verdict
> field does not grade the candidates; it grades the merged requirement, which is the artifact that
> advances and which `harness/roles/developer-generalist.md:9` makes *"the whole specification"* for
> the chore that consumes it. A refusal aimed at an input that no longer reaches anyone is a refusal
> nobody can act on.

Two further facts settle it. The flow has `- gate: human` immediately after this step **regardless
of verdict**, so `ready` skips no gate — it only decides whether the owner is handed a usable
requirement or a second copy of the same refusal. And a second `needs-input` would exhaust the
counter and land on an exhaustion gate whose only possible answer requires a human to split a ticket
and write a new one — which is *"a loop spending its budget on work no agent in it can perform"*,
named in M1's closing entry and closed from two sides on 2026-08-23. The two actions that genuinely
need a human are in §7, where the owner will see them.

---

## 0.1 Verified before this document was written

Per *"verify inherited measurements"* — and because this ticket's own history is that its
measurements were wrong twice, in different places each time. Everything below was re-derived
read-only, in this working tree, today. Nothing was modified.

### The `maxBuffer` table, re-measured

Node **v24.15.0**, using `runCommand`'s exact options — `stdio: ['ignore','pipe','pipe']`,
`env: process.env`, `timeout: 900000`, **`killSignal: 'SIGKILL'`** — with the same `timedOut`
expression both trees compute. Each row run **three times**:

| # | The child | `status` | `signal` | `code` | captured | `runCommand` reports | runs |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **A** | 2 MiB in **one write**, exits 0 | `null` | `SIGKILL` | `ENOBUFS` | 1,114,112 B | `code 1`, **`timedOut: true`** | 3/3 |
| **B** | 2 MiB in **one write**, then exits 1 | `1` | `null` | — | **65,536 B** | `code 1`, `timedOut: false` | 3/3 |
| **C** | 2 MiB in **2048 × 1 KiB writes**, exits 1 | `null` | `SIGKILL` | `ENOBUFS` | ~1,049,600 B | `code 1`, **`timedOut: true`** | 3/3 |
| **D** | 900 KiB, exits 0 | — | — | — | 921,600 B | `code 0`, no throw | 3/3 |

Row C's captured length varied between 1,049,600 and 1,051,648 bytes across the three runs — the
only non-determinism observed anywhere in the table, and it is in the byte count, not the outcome.

**Three findings, and they do not point the same way.**

1. **The ticket body is wrong; the claude candidate is right about row A.** The body records
   `signal: SIGTERM` and concludes *"in both, `timedOut` is `false`"*. That is bare `execSync`.
   Both trees pass `killSignal: 'SIGKILL'` (`spike/src/fanout.js:127`,
   `packages/core/src/fanout/command.ts:64`, pinned as source text at `fanout.source.test.ts:146`),
   and `timedOut` tests that signal — so an overflow **is** reported as a timeout. Q-0048's
   implementer's hypothesis, *"the buffer defect wearing the timeout's clothes"*, therefore
   **holds**, and the body's "it does not hold" is wrong. They named the wrong disjunct (`killed`,
   which is `undefined`); the live one is `signal`. A finding offered honestly for checking was
   checked against the wrong options and dismissed — worth recording as loudly as the defect.
2. **The claude candidate is wrong about *why* the shapes differ.** It asserts *"the two rows differ
   by whether the child exits non-zero, not by a race with Node's kill"*. Row C exits non-zero and
   lands in row A's shape, 3/3. The discriminator is the **write shape** — whether the child dies
   before Node's `maxBuffer` watchdog fires. A monolithic multi-MiB write escapes; a progressive
   producer does not. The codex candidate's wording — *"must not depend on whether Node kills the
   child before it exits"* — anticipates this correctly without having measured it.
3. **A test suite is a progressive producer**, so the realistic overflow for `pnpm turbo run test` is
   **row A/C**, which `spike/src/engine.js:1046–1052` turns into
   `envError = "the suite never ran — the test command did not finish within 15 minutes and was
   killed"` → `tests=invalid` in `runs.log` (`:1062`) → `FlowError` (`:1067`). **A wrong diagnosis
   that fails closed.** It never satisfies `expect: fail` and never banks a false green; its cost is
   that `:1067` sends the reader to `commands.install`, which is fine. Row B — the undetectable one
   — needs a child that writes megabytes in a single call and then exits non-zero, which a test
   runner does not do.

### One inherited claim narrowed — register row 7 is not broadly defeated

Both candidates, and my own run-1 document, say truncation *"can remove the very lines
`environmentFailure` reads"*. Read against the code, that is too strong in two ways.

- `engine.js:1046` short-circuits: `const broken = r.timedOut ? '…did not finish…' :
  environmentFailure(out)`. For rows A and C, `environmentFailure` is **never consulted**. The
  interaction cannot arise on the realistic shape at all.
- All six `ENV_FAILURES` signatures (`engine.js:1087–1094`) are **startup** failures —
  `Cannot find package`, `Cannot find module`, `ERR_MODULE_NOT_FOUND`, `SyntaxError:`,
  `: command not found`, `ERR_REQUIRE_ESM`. Buffer truncation keeps the **head**, and a startup
  failure is at the head. Truncation preserves these signatures rather than removing them.

The defeat is real but narrow: **only an environment failure that arrives late** — a runner that
runs for a megabyte and then dies on a module error — is hidden, and only in row B's shape. This
sharpening lowers Q-0070's urgency again and is carried into its body so nobody re-derives the
broader claim from this document's ancestors.

What does survive intact: because truncation keeps the head and `engine.js:1071` then stores
`out.slice(-3000)`, the agents reading `ctx.lastIntegration` (`:957`, itself `.slice(0, 4000)`)
get the **middle** of a long run rather than its failure summary.

### Where a worktree's turbo cache lives — answered

All **18** worktrees under `.harness/worktrees/` were checked for both of turbo's standard cache
locations. **None has `.turbo/cache`. None has `node_modules/.cache/turbo`.** The root tree has
**756** entries in `.turbo/cache`, which a worktree cannot reach: a git worktree is a separate
directory tree, and turbo roots its cache at the workspace root it finds — which is the worktree.
Meanwhile per-package `.turbo/turbo-test.log` files **are** present in the worktrees (e.g.
`harness__Q-0048__integration/packages/core/.turbo/turbo-test.log`), which is the signature of real
execution.

**So `integrate` has no cache to replay from today, and the recorded false green was a human `pnpm
turbo run test` in the main tree.** This is stated as evidence, not as a reason to wait: *"skipped is
not passed"* governs what the command **may** do, not what it has done. `--force` is correct whether
the cost is zero or two minutes. It changes only the *tone* of AC-10's entry — the hazard is
presently confined to human verification and to any future arrangement that gives worktrees a shared
cache.

### Confirmed unchanged

`harness/harness.yaml:39` reads `test: npm test --prefix spike && pnpm turbo run test` — **no
`--force`**. `turbo.json` declares `test` with `outputs: []` and neither `env` nor `passThroughEnv`.
The template ships `test: npm test` (`spike/templates/harness/harness.yaml`).
`real-cli.probe.test.ts:13` documents exactly one invocation, the turbo one, and `:65` is
`describe.skipIf(!process.env.QUORUM_REAL_CLI)`. `command.ts:59–60` already carries *`Why: preserved
defect … the fix is Q-0065`*. `harness/roles/developer-generalist.md:3` covers every implementer
surface named below and `:23` says *"You do not append to `docs/DECISIONS.md`; a decision is the
human's to record."* `.github/scripts/port-freeze-guard.sh` exits 0 with *"is not one of Q-0009's
fourteen children — the freeze does not apply"* for any other ticket.

**Still unverified, deliberately:** the body's **69,951 bytes** headroom figure, which was measured
against a command carrying `--force` that `harness.yaml:39` does not contain. Re-measuring it means
running the full suite; it is Q-0070's to take, against whatever this ticket configures.

---

## 1. Problem

`integrate` makes the only claim worth making about a chore: *this suite is green on the merged
result*. Two mechanisms let it make that claim without the evidence, and a third makes an adjacent
proof unobtainable.

**A cached pass is indistinguishable from an executed one.** `commands.test` runs `pnpm turbo run
test` without `--force`. Turbo prints every package's full pass output and reports `Tasks: 7
successful, Cached: 7 cached` having executed nothing. `integrate` reads exit 0, writes `tests=ok` to
`runs.log` and `Tests: … → exit 0 (expected pass) → OK` to `dev/integration.md`, and the flow
advances. This is *"skipped is not passed"* (2026-08-25) one layer down, and it has cost once: a
cached 7/7 stood over a suite whose `--force` re-run failed 1 of 123. Per §0.1 that instance was in
the main tree, which bounds the damage done and not the hazard.

**The one proof CI cannot make cannot be run by the command that documents it.** `turbo.json`
declares no `env` on `test`, so Turbo strips `QUORUM_REAL_CLI` from the child environment and
`real-cli.probe.test.ts` reports `skipped` under its own documented invocation, forever. The file is
*designed* to skip honestly (`describe.skipIf`, and *"a check that skips its subject must not report
success"*), so this is not a false green — the cost is an unobtainable answer: the next person
follows the JSDoc, sees `skipped`, and concludes the switch is dead. Neither implementer nor reviewer
could have caught it, both being forbidden a paid round-trip; it was reachable only from a gate,
which is where it was found.

**The adopter inherits the first hazard by default.** `harness init` copies `test: npm test`, and
Turbo, Nx, Gradle and Bazel all cache by default.

The `runCommand` buffer defect is real, is measured in §0.1, and **is Q-0070** (§8).

---

## 2. User stories

- **As the `maintainer`,** when `integrate` writes `tests=ok`, I want that to mean a suite executed
  in this run, so that `green` and the gate in front of me are claims about the merged tree rather
  than about a cache.
- **As the `contributor`,** I want the command a test's own documentation gives me to run that test,
  so the one proof CI cannot make is reachable by following the file rather than by guessing around
  it.
- **As the `adopter`,** I want the shipped `harness.yaml` to tell me that a caching test runner can
  satisfy `integrate` without executing, so my first `integrate` does not teach me the wrong thing.

---

## 3. Acceptance criteria

Surface named per criterion. **[H]** marks a criterion performed by human commit; **[G]** one whose
evidence is taken at the gate. Both are justified in §6 and actioned in §7.

### The cache half

**AC-1** — `harness/harness.yaml`'s `commands.test` defeats the workspace cache, by appending
`--force` to the `pnpm turbo run test` half. The `npm test --prefix spike` half is unchanged: its
runner caches nothing. *Surface: `harness/`.*

**AC-2** — The comment above `commands.test` states in one sentence that a cached result satisfies
`integrate` without executing and that `--force` is what stops it, citing Q-0065. It does not
transcribe this document. *Surface: `harness/`.*

**AC-3** — An automated check in the repository's own suite asserts that the configured
`commands.test` carries `--force` on its turbo invocation, by reading `harness/harness.yaml`. The
evidence must not depend on a local cache happening to be warm or cold. A plain text assertion is
sufficient and needs no new dependency; `packages/shared/test/corpus.ts` already exports a `repoRoot`
helper and `packages/shared/src/index.test.ts:14,52` already reads repo-root files through it, so the
precedent and the helper exist. *Surface: `packages/` or `spike/test/`, implementer's choice.*
**This is the only mechanism that can prove AC-1** — see the engine note in §5.

**AC-4** — `spike/templates/harness/harness.yaml`'s `test:` line carries a comment telling an adopter
that `integrate` trusts the command's exit result, that a caching runner (Turbo, Nx, Gradle, Bazel)
can satisfy it from a replay, and that their command must defeat their runner's cache. The default
stays `npm test`: the template cannot know their runner, and changing it would be a default nobody
asked for. *Surface: `spike/templates/`.*

**AC-5** — No engine coupling. An `integrate` step with `run_tests: true` continues to execute the
configured `commands.test` string as written (`engine.js:1031`). Neither `spike/src/` nor
`packages/core/src/` acquires knowledge of Turbo, Nx, Gradle or Bazel: no output parsing for a
cache-hit signal, no `TURBO_FORCE` injection, no cache-count inspection. Testable by absence, at the
grain the existing `*.source.test.ts` files already use. *Surface: `packages/core`, `spike/src`
(assertion only — no behaviour change).*

### The environment half

**AC-6** — `turbo.json`'s `test` task declares `"env": ["QUORUM_REAL_CLI"]` — **`env`, not
`passThroughEnv`**, because changing whether paid probes are selected must also change the task's
cache identity. *Surface: `turbo.json`.*

**AC-7** — A test proves the variable reaches a package's test process under the documented turbo
invocation, using a harmless environment-reading fixture. It spends no subscription round-trip and
calls no vendor CLI, so it runs in CI. *Surface: `packages/core`.*

**AC-8** — `packages/core/src/adapters/real-cli.probe.test.ts`'s JSDoc documents **exactly one**
invocation — the turbo command at `:13`, which now works. No second, contradictory invocation is
introduced. Its existing `--force` sentence, which already cites Q-0065, stays, and the probe still
reports `skipped` when the switch is absent (`:65`). *Surface: `packages/core`.*

### Evidence and the record

**AC-9** — The cost of AC-1 is measured, not estimated: wall-clock of `pnpm turbo run test` against
`pnpm turbo run test --force` on a green `main`, recorded in the implementation report. The report
also states, from the worktrees themselves, whether `integrate` was already running cold — so the
decision in AC-10 records a severity somebody measured. §0.1 gives the expected answer and the
method. *Surface: report, written by the step's declared `output.writes`.*

**AC-10 [H]** — A `docs/DECISIONS.md` entry records which of the ticket's three shapes was chosen and
why the other two were refused: shape 2 (parse the runner's output for a cache-hit signal) and shape
3 (`TURBO_FORCE=1` in the engine's environment) each put one tool's name inside `core`, which AC-5
forbids. It states the accepted cost with AC-9's number, and §0.1's finding that the hazard is
presently confined to human verification and to any future shared-cache arrangement. *Surface:
`docs/DECISIONS.md`.* Human commit — `harness/roles/developer-generalist.md:23` forbids the agent
appending, and three correct refusals at $8–10 each is the alternative (Q-0069's AC-11(b)).

**AC-11 [G]** — Acceptance evidence for AC-6 and AC-8 is taken at the gate: running the documented
command reports the two probes as **executed** rather than `skipped`. Neither implementer nor
reviewer may spend a paid CLI round-trip, which is why this defect was reachable only from a gate in
the first place. Named here rather than left to be discovered by a reviewer asking for evidence the
flow cannot produce. *Surface: gate.*

---

## 4. Non-goals

- **The `runCommand` output-buffer defect.** It is **Q-0070** (§8) — split, not deferred informally,
  and its body is drafted with the measurements included so nothing expires and nothing is
  re-derived. §7 names creating it as a gate action.
- **Making `integrate` parse any runner's output**, or inject any runner's environment variable.
  Refused by AC-5 and recorded by AC-10.
- **Changing the shipped template's default test command.** AC-4 comments; it does not decide for
  the adopter.
- **Automatically discovering an adopter's cache-bypass option.** Quorum cannot infer it, and
  guessing would be a default nobody asked for.
- **Disabling caches for commands a maintainer runs by hand.** A habit, already in session memory.
- **Streaming live test output to the CLI or Studio**; adding a persistent test-output artifact;
  changing the files an `integrate` step declares it writes.
- **`integrate`'s other known weaknesses** — `environmentFailure`'s detector (`engine.js:1096`),
  `out.slice(-3000)` (`:1071`). Named as neighbours; Q-0070 owns the interaction, narrowed per §0.1.
- **`budget.per_run_usd`, the chore flow's first-pass branch prerequisite, worktree pruning
  (Q-0062).** Each needs its own ticket or has one.
- **Adapter contracts, flow schemas, gate behaviour, ticket stages, run-history formats.** Untouched.

---

## 5. Open questions — none blocking

| # | Question | Owner | Blocking? |
| --- | --- | --- | --- |
| **OQ-1** | Does any future arrangement give worktrees a shared turbo cache — a remote cache, `TURBO_CACHE_DIR`, or CI? §0.1 establishes that today they have none in either standard location, which is why AC-1 is expected to be nearly free. If one is ever introduced, AC-1 is what keeps `integrate` honest across it. Recorded so AC-10 can say so. | Implementer, reported | No |
| **OQ-2** | Does `commands.install` want the same treatment? It runs through the same `runCommand` (`engine.js:1036`) with the same ceiling, and `pnpm install --frozen-lockfile` over seven packages is not quiet. Relevant to Q-0070's ceiling, not to this ticket's cache half. | Q-0070 | No |

**The engine note a reviewer needs, and the reason AC-3 is worded as it is.** `runFlow` receives
`config` as a **parameter** and stores it on `ctx` at run start (`spike/src/engine.js:37,43`); the
integrate step then reads `ctx.config.commands?.test` (`:1031`). It is never re-read from the
integration worktree. A changed `commands.test` on the implement branch therefore does **not** take
effect for its own run's `integrate` step. **This ticket cannot prove AC-1 through its own flow.**
AC-3 is a file assertion for exactly that reason, and AC-1's runtime evidence is the *next* ticket's
`integrate` line, or a hand-run after the merge. A reviewer who assumes otherwise will ask for
evidence that cannot exist.

---

## 6. Risks and cross-cutting checks

- **AC-1 slows `integrate` by the workspace suite** — probably not at all, per §0.1, and by the full
  suite if a shared cache ever appears. That is the price of the claim being true, and AC-10 records
  it with AC-9's number rather than an adjective.
- **AC-6 changes the `test` task's hash**, so `QUORUM_REAL_CLI=1` and its absence get separate cache
  entries. With AC-1's `--force` in the configured command, neither is replayed in a flow.
- **This ticket's subject is the machinery its own flow runs on** — *"do not drive harness-machinery
  work through the harness"* (2026-08-23). Mitigated by the chore route, by AC-3 asserting on a file
  rather than on a run, and by no criterion asserting on `integrate`'s *current* behaviour.
- **Q-0070 must actually be created.** A non-goal is where a real defect goes to die if nobody writes
  the successor. §7 makes it a named gate action and §8 supplies the whole body, per *"a deferred
  obligation dies unless it is written into the next ticket's body"*.

| Concern | Answer |
| --- | --- |
| **BYOS** | Touched and improved: AC-6/AC-7 make the one test that proves subscription auth runnable. No API-key path in any criterion, fixture or doc example; `withoutApiKeys` unchanged. |
| **Worktree safety** | Unchanged. `integrate` still runs in the integration worktree; nothing writes to the user's working tree. |
| **Gate behaviour** | Unchanged. AC-11 is evidence taken at an existing gate, not a new gate. |
| **File formats / schemas** | None change. `runs.log`'s `tests=ok\|fail\|invalid` vocabulary is untouched. |
| **Lint / dependencies** | No new rule, no new dependency. AC-3 needs none. |
| **Cold-clone impact** | AC-4 only — one comment in a file the adopter reads. AC-1 does not reach them; their `commands.test` is the template's `npm test`. |
| **Cross-vendor rule** | Satisfied by the chore flow as shipped. |
| **Product-agnostic** | No product name anywhere. Turbo is named only in configuration the user owns, never in `core` — which is AC-5. |

### Surface check — the three questions of 2026-08-27

Asked of every criterion, per *"`.claude/rules/` is a derived copy, not a surface a requirement may
name"*. The failure that entry records is a requirement certifying only that it named no `backlog/`
and never asking the general question, so all three are asked here.

1. **May the role write it?** `developer-generalist`'s `paths` (`package.json, pnpm-workspace.yaml,
   turbo.json, tsconfig*.json, .npmrc, .gitignore, .github, packages, apps, spike, harness, docs`)
   cover every implementer surface above: `harness/harness.yaml`, `turbo.json`,
   `spike/templates/harness/harness.yaml`, `packages/core/src/adapters/`, and wherever AC-3 and AC-5
   place their assertions.
2. **Will the engine revert it?** No criterion names `backlog/`. AC-9's report reaches the ticket
   folder through the step's declared `output.writes`, which the engine writes — not an agent edit
   `commitAll` would revert.
3. **Is it derived?** No criterion names `.claude/`, `CLAUDE.md`, `AGENTS.md` or `GEMINI.md`, and
   nothing here edits `harness/rules.md`, so no paired copy is owed.

**One criterion fails question 1 deliberately and is marked [H].** AC-10 names `docs/DECISIONS.md`.
`docs` is inside the role's `paths`, but `harness/roles/developer-generalist.md:23` says in as many
words that the agent does not append to it. Settled here, as Q-0069's AC-11(b) was not.

---

## 7. What the gate must do

Two actions, neither of which a flow step can perform. Named here so they are decisions rather than
discoveries.

1. **Create Q-0070 from §8** and add its line to `docs/06-development-plan.md`'s M2 list. The body
   below is complete, including the measurements — those are the expensive part and re-deriving them
   is how this ticket's record went wrong twice. Without this, the buffer defect exists only as a
   non-goal in a merged requirement, which is where obligations go to expire.
2. **AC-10's `docs/DECISIONS.md` entry is a human commit**, per `developer-generalist.md:23`. The
   implementer's obligation is to name the decision in its report, in wording the human can
   transcribe — the shape that worked for Q-0069's AC-11(b), after three correct refusals had already
   been paid for.

**One note for the implementer, and for the reviewer who would otherwise blocker it.** The ticket
body still carries the `runCommand` buffer section, folded in on 2026-08-27. This document supersedes
it for the purposes of the chore: `developer-generalist.md:9` makes the merged requirement's
acceptance criteria *"the whole specification"*, and §4 places the buffer half explicitly out of
scope with a named successor. An implementer that touches `spike/src/fanout.js` or
`packages/core/src/fanout/command.ts` on this ticket is out of scope, and a reviewer citing the
ticket body against §4 should be answered with this paragraph rather than with a revise round.

---

## 8. Q-0070 — the successor, drafted in full

*Not part of this requirement. Written here so the obligation cannot expire and the measurements do
not have to be re-derived a fourth time.*

**Title.** `runCommand` loses no output, and an overflow is not reported as a timeout.

**The defect.** `runCommand` (`spike/src/fanout.js:124–134`, `packages/core/src/fanout/command.ts`)
passes no `maxBuffer` and takes Node's 1 MiB default, and `integrate` runs the repository's whole
suite through it. `command.ts:59–60` already says so in a `Why:` comment naming Q-0065.

**The measured behaviour is the four-row table in §0.1 of
`backlog/Q-0065-…/requirements/merged.md`, which supersedes the Q-0048 record, the Q-0065 ticket
body, and both requirement candidates. Do not re-derive it from any of those.** Its three
load-bearing points:

1. An overflow is killed with **`SIGKILL`**, and `timedOut` tests that signal, so it is reported as
   **`timedOut: true`** — a fifteen-minute timeout that did not happen. Q-0048's implementer's
   hypothesis holds; they named the wrong disjunct.
2. A **monolithic** multi-MiB write that then exits non-zero instead yields a **silent truncation to
   65,536 bytes** — one pipe buffer — with no marker of any kind: the child's own status, no signal,
   and captured output far *below* `maxBuffer`, so no length check can catch it either.
3. The discriminator between the two is the child's **write shape**, not its exit status. A child
   writing 2 MiB in 1 KiB chunks and exiting 1 lands in shape (1), 3/3.

**Consequences, in the order they cost something.** A real suite is a progressive producer, so the
realistic shape is (1) — the bogus timeout, which `engine.js:1046–1052` converts to `envError`,
`tests=invalid` and a `FlowError`. It **fails closed**: it stops a run with a wrong diagnosis that
sends the reader to `commands.install`, and it never banks a false green. Shape (2) is the dangerous
one and the unlikely one: indistinguishable from an ordinary failing suite, so `expect: fail` banks
it as proof of red.

**Register row 7's interaction, narrowed — read this before repeating the broader claim.** Earlier
records say truncation *"can remove the very lines `environmentFailure` reads"*. That is too strong.
`engine.js:1046` short-circuits on `r.timedOut`, so shape (1) never consults `environmentFailure` at
all; and all six `ENV_FAILURES` signatures (`:1087–1094`) are startup failures, which head-truncation
**preserves**. The genuine gap is narrow: an environment failure that arrives *late* in a long run,
in shape (2) only. What does survive intact is that truncation keeps the head while `:1071` stores
`out.slice(-3000)`, so the agents reading `ctx.lastIntegration` (`:957`) get the middle of a run
rather than its failure summary.

**Latent, with the headroom unmeasured.** The Q-0065 body's 69,951 bytes was measured against a
command carrying `--force`, which `harness.yaml:39` did not have; re-measure against whatever Q-0065
configured. A *failing* run prints diffs and stack traces, the suite is 562 tests and growing, and
Q-0054 still has the regression suite to port.

**The blocking question, and it is why this is its own ticket.** *Raise the ceiling, or remove it?*
The two Q-0065 candidates answered oppositely and neither is obviously right:

- **Raise it** (claude): an explicit `maxBuffer` justified in the JSDoc as a multiple of the largest
  observed real output, with streaming refused as *"a product, not a chore"*. Cheap, preserves
  `CommandResult` exactly, and leaves shape (2) undetectable *below* the new ceiling. It moves a
  cliff, and a cliff that has moved is harder to find.
- **Remove it** (codex): direct stdout and stderr to temporary files and build the result from the
  complete files, with *"raising `maxBuffer` to another fixed value does not satisfy this
  criterion"*. Genuinely removes the ceiling, and brings a lifecycle nothing here has today — unique
  per invocation, outside tracked content, removed on success, failure and timeout, with a
  capture-file I/O failure stopping the run explicitly rather than resembling a test result.

This changes what `runCommand` returns, which is externally observable through `dev/integration.md`
and the persisted `output.txt`. **Settle it in a `docs/DECISIONS.md` entry before an implementer
starts**, not in a review round.

**A route question to answer with it.** The chore route exists for work with no possible red phase.
This has one: a test that runs a 2 MiB-producing child and asserts complete output fails today and
passes after. If the answer is "remove the ceiling", the change is a behaviour change with new
failure modes and a contract worth constraining, and the full SDLC is arguably right. If it is "raise
it", chore is right. **Decide the design first, then the route** — the reverse is how Q-0033 spent
$41 on six qa-red attempts.

**Criteria sketch**, to be cut to about ten by whoever writes it: the chosen capture design, with its
value or its lifecycle written down; an overflow is never reported as a timeout; a large-output
command that exits zero returns `code: 0` with complete output; one that exits non-zero returns its
own status with complete output, and the result does not depend on the child's write shape or on
whether Node kills it before it exits; a large-but-under-ceiling command still returns cleanly (row D
is the regression guard); the real timeout path is preserved unweakened — `command.test.ts:34–48`
covers it with `sleep`-based timing assertions that must stay; capture-infrastructure failure stops
the run explicitly and can never satisfy `expect: fail` or write `tests=ok`; equivalent tests in both
trees; and the landed pins updated in the same change and named in the report rather than discovered
in review — `command.test.ts:14,23` (`toStrictEqual` on the whole result object),
`fanout.source.test.ts:45` (`command.ts` exports are exactly `['runCommand']`), `:146`
(`killSignal: 'SIGKILL'` pinned as source text).

**Landing constraint.** The fix lands in `spike/src/fanout.js` **and**
`packages/core/src/fanout/command.ts` together — the Q-0066/Q-0068 shape — or the port loses the
independent witness the freeze exists to provide. Q-0070 is not one of Q-0009's fourteen children, so
the freeze does not apply: `.github/scripts/port-freeze-guard.sh` exits 0 with *"is not one of
Q-0009's fourteen children — the freeze does not apply"*. Verified 2026-08-27; the implementer should
re-verify and state it in the report so the reviewer does not spend a round on it.

**Also fold in:** `commands.install` runs through the same `runCommand` (`engine.js:1036`) with the
same ceiling (Q-0065 OQ-2).

---

## 9. Provenance

**The split, the size call, §0.1's measurements and the verdict correction** are mine. The two
candidates arrived at 14 and 15 criteria; the seam between configuration a reviewer checks by reading
a file, and a two-tree code change with three landed pins and an unsettled design, is what makes it
two tickets rather than a trim. This run's own contribution over run 1 is the re-measurement (all
four rows, 3/3, including the row-C counterexample), the both-locations worktree cache check, the
narrowing of the register row 7 claim in §0.1, and the recognition that run 1's `needs-input` graded
the candidates while the field grades the merged document.

**From the claude candidate**, the stronger of the two on evidence and on process: the practice of
re-deriving inherited measurements before they enter a durable record; the `killSignal: 'SIGKILL'`
correction, which is right and which rehabilitates Q-0048's implementer; the observation that the
body's headroom figure was measured against a command that does not exist; the `ctx.config` finding,
which is why AC-3 is a file assertion (§5) and which would otherwise have cost a review round; the
three-question surface check; the `[H]` marking of the DECISIONS criterion against
`developer-generalist.md:23`; and the honesty of raising its own OQ-3 asking whether the buffer half
should be split — the answer to which is yes.

**From the codex candidate:** the `env`-not-`passThroughEnv` rationale (cache identity must move when
paid-probe selection moves), better argued than the claude candidate's; the insistence that the
`--force` evidence not depend on a warm or cold local cache; the environment-reading fixture, which
makes propagation provable in CI rather than only at a gate; the single-documented-invocation rule,
taken over the claude candidate's turbo-plus-vitest pair — one command that works beats two that need
disambiguating, and ambiguity is what made this hard to diagnose; the explicit no-engine-coupling
criterion; the capture-lifecycle thinking carried into §8; and a materially better non-goals section.

**Where they disagreed and I chose.** *JSDoc invocations* — codex (one, and make it work). *Buffer
fix shape* — neither; it is a decision entry, and the disagreement is itself the evidence that it is
(§8). *OQ-1 blocking* — against the claude candidate: `--force` is correct independently of what the
cache has done, and §0.1 answers the question well enough to record rather than wait on.

**Corrected in the inputs.** The ticket body's `maxBuffer` table (wrong signal, wrong `timedOut`, and
its dismissal of Q-0048's hypothesis). The claude candidate's claim that exit status distinguishes
the two overflow shapes, and the deterministic-not-racy conclusion drawn from it. And, in all three
of the ticket body, both candidates and my own run-1 document, the over-broad claim that truncation
removes the lines `environmentFailure` reads. Neither candidate had run the code; both reasoned from
a record that was wrong in a different place each time. That is now four occasions on this ticket's
subject alone, and it is the argument for §0.1 existing at all.
