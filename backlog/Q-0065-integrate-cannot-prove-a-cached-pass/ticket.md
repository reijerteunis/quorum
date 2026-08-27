---
id: Q-0065
title: integrate can report tests=ok from a cached pass it never executed
stage: draft
owner: ruud
repos: []
branch: harness/Q-0065/integration
priority: p2
created: 2026-08-26
iterations: {}
history: []
---
Raised as OQ-2 of Q-0064's merged requirement, 2026-08-26, which correctly refused to fix it in
passing: changing the configured test command affects **every ticket's** `integrate` step, and that
is precisely the unrequested default a chore must not take.

**The defect.** `harness/harness.yaml`'s `commands.test` is

    npm test --prefix spike && pnpm turbo run test

and Turbo, without `--force`, replays a cached result. It prints each package's full pass output and
reports `Tasks: 7 successful` with `Cached: 7 cached`, having executed nothing. `integrate` reads the
exit code, writes `tests=ok` to `runs.log` and `Tests: … → exit 0 (expected pass) → OK` to
`dev/integration.md`, and the flow advances on a claim nothing verified in this run.

**It is not hypothetical and the cost is already on the record.** Verifying Q-0043's merge to `main`
on 2026-08-26, the first `pnpm turbo run test` reported 7/7 successful with 7 cached. The immediate
`--force` re-run failed 1 of 123 — `git.test.ts`'s containment snapshot, now carried by Q-0064. The
cache had been reporting a pass over a suite with a live flake in it.

**Why this is the product's own rule turned on itself.** *"Skipped is not passed"*
(`docs/DECISIONS.md`, 2026-08-25) was written after a `--dry` run printed a clean preview for a range
it had deliberately not examined, and the real run then billed $13.86 before discovering the range
was invalid. This is the same failure one layer down: **the one step whose entire job is to prove a
suite green can be satisfied by a replay.** `integrate` exists because `expect: pass` on the real test
command is *"the only claim worth making about a scaffold, and it is a genuine one"* (the chore-flow
entry, 2026-08-24) — and for a cached run it is not.

**Three shapes, none decided here.**

1. **Add `--force` to `commands.test`.** One line, and it makes every `integrate` honest. It also
   discards the cache for every run, so `integrate` gets slower by however long the workspace suite
   takes — which is the price of the claim being true. The spike half needs no change; `node
   test/run.js` caches nothing.
2. **Leave the command and have `integrate` refuse a cached result** — parse the runner's output for
   a cache-hit signal and fail closed. More general, and it couples `core` to Turbo's output format,
   which is exactly the kind of vendor-shaped knowledge the rules keep out of the engine.
3. **Set `TURBO_FORCE=1` in the environment `integrate` runs its command with**, leaving the
   configured command alone. Keeps the honest behaviour where the engine can guarantee it, and still
   knows the name of one specific tool.

(1) is the smallest and the most legible in the file a user reads; (3) is the most robust. Deciding
between them is the ticket.

**Also in scope: the shipped template.** `spike/templates/harness/harness.yaml:31` ships
`test: npm test`, which `harness init` copies into every adopter's repo. Whatever this ticket
decides, an adopter whose test command is cached — Turbo, Nx, Gradle, Bazel all cache by default —
inherits the same silent replay, and the template's comment should say so even if the default cannot
know their runner.

**A neighbour this does not own.** `--force` is also missing from any human verification done by
hand; that is a habit, not a defect, and it is recorded in the session memory rather than here.

**Folded in 2026-08-27: Turbo also strips the environment, which breaks the one test that needs it.**
Found at Q-0047's gate, running that ticket's AC-13 acceptance evidence. `turbo.json` declares
neither `env` nor `passThroughEnv` on the `test` task, so Turborepo removes every undeclared variable
from the child environment. The command
`packages/core/src/adapters/real-cli.probe.test.ts`'s own JSDoc documents —

    QUORUM_REAL_CLI=1 pnpm turbo run test --force --filter @quorum/core

— therefore reports the file **skipped**, always, and no amount of `--force` changes it. The evidence
was obtained instead by bypassing turbo:
`cd packages/core && QUORUM_REAL_CLI=1 npx vitest run src/adapters/real-cli.probe.test.ts`, which
passes both probes against the ported adapters.

This is the same file and the same knob as the cache half, which is why it lands here rather than in
its own ticket, but it is the **opposite** failure and worth stating as such. The cache hazard is a
check that reports success without executing; this is a check that cannot be made to execute at all,
and it says so honestly. The honesty is exactly what stops it being a false green — the file was
designed for it (*"a check that skips its subject must not report success"*, 2026-08-25) — so the
cost is not a wrong answer but an unobtainable one: the next person follows the documented command,
sees `skipped`, and concludes the switch does nothing.

Neither the implementer nor the reviewer could have caught it. Both are forbidden to spend a paid CLI
round-trip, so neither could run the command it documents; it is reachable only from the gate, which
is where it was reached. Two fixes, and they are not exclusive: add `"env": ["QUORUM_REAL_CLI"]` to
`turbo.json`'s `test` task so the documented command works, and/or correct the JSDoc to the vitest
invocation. Prefer deciding it with the cache question above, since both are answers to *"what may
`turbo run test` be trusted to have done?"*

**Folded in 2026-08-27: `runCommand` inherits `execSync`'s 1 MiB `maxBuffer`, and a suite that
exceeds it fails for a reason nothing can name.** Raised as OQ-1 of Q-0048's merged requirement and
decided at that gate. `runCommand` (`spike/src/fanout.js:124–134`, which Q-0048 ports to
`packages/core/src/fanout/command.ts`) passes no `maxBuffer`, so it takes Node's 1 MiB default, and
`integrate` runs the repository's whole suite through it.

**Measured here rather than inherited, because the requirement's sample turned out to be one face of
a racy behaviour.** On Node v24.15.0, a child writing 2 MiB to stdout resolves two ways depending on
whether Node's own kill lands before the child exits:

| The child | `e.status` | `e.signal` | `e.code` | captured stdout |
| --- | --- | --- | --- | --- |
| writes 2 MiB, exits 0 | `null` | `SIGTERM` | `ENOBUFS` | 1,114,112 B (truncated at the buffer) |
| writes 2 MiB, **then exits 1** | `1` | `null` | `undefined` | **65,536 B** (one pipe buffer) |

Both land in `runCommand`'s `catch`. In both, `timedOut` is `false` — `e.killed` is `undefined`,
`e.signal` is not `SIGKILL`, `e.code` is not `ETIMEDOUT`. In both, `code` is a plausible non-zero
(`e.status ?? 1`). And in both the output is **silently truncated**, with nothing in the return value
saying so. The merged requirement records this as *"status=1, signal=null, stdout length 0"*; the
first two hold for the second row only, and a length of zero did not reproduce — 65,536 is the
smallest observed. The correction does not weaken the finding, it sharpens it.

**The second row is the dangerous one, because it is undetectable.** The first at least leaves
`ENOBUFS` on the error. The second leaves no marker at all: `code` is the child's own exit status,
there is no signal, and the captured output is far *below* `maxBuffer`, so a length check cannot
catch it either. A caller inspecting the error object cannot tell this from an ordinary failing test
run. That is what makes "report overflow as a third outcome beside `timedOut`" a design question
rather than a constant bump — it cannot be answered by reading the error, only by streaming the
output somewhere that does not have a ceiling.

**One hypothesis raised and disproved, recorded so it is not re-derived.** Q-0048's implementer,
reading the code without running it, offered this for checking: `timedOut` includes
`e.killed === true`, and Node sets `killed` when it kills a child for `maxBuffer` — so an overflow
might report `timedOut: true`, *"the buffer defect wearing the timeout's clothes"*. It was offered
honestly as a thing to check rather than as a finding. **It does not hold.** In both shapes measured
above, `e.killed` is `undefined`, not `true`, so `timedOut` is `false` and an overflow is reported as
an ordinary failing command. That is worth knowing in both directions: it removes a misdiagnosis
(`timedOut: true` would at least have been a *distinguishable* wrong answer, and it is not what
happens), and it closes off the fix that hypothesis would have suggested — narrowing `timedOut` —
which would have changed nothing.

**Three consequences, in the order they cost something.** A *passing* suite whose output exceeds
1 MiB is reported as a failure, so `integrate --expect pass` fails a green tree. `expect: fail` banks
the same event as proof of red, which is the exit-code conflation Q-0004 found, one layer down. And
register row 7 — *"a suite that could not start is rejected rather than counted as red"* — is
defeated from underneath, because its detector reads the raw output, and truncation can remove the
very lines it reads while leaving a result-shaped exit code behind.

**Latent today, with less headroom than it looks.** The configured command
(`npm test --prefix spike && pnpm turbo run test --force`) produces **69,951 bytes** on a green
`main` as of 2026-08-27 — about 7% of the budget. A *failing* run prints diffs and stack traces
rather than tick marks, the suite is 562 tests and growing, and Q-0054 still has the whole regression
suite to port. The margin is a factor of fifteen on the quietest possible run.

**Why here and not in Q-0053.** Q-0053 ports the integrate step and inherits register row 7, so it is
the ticket this defect *reaches*. It is not the ticket that can fix it: Q-0053 is a port child, and
*"The port preserves behaviour"* (2026-08-25) makes a defect found while reading a stop-and-report,
never a repair. Folding a fix into a ticket whose own route forbids performing it would be the
"deferred obligation that quietly expires" failure with extra steps. It belongs here because this
ticket already asks the one question all three defects answer: **what may a test command's result be
trusted to have done?** The cache half reports a success it never executed; the `passThroughEnv` half
cannot be made to execute at all and says so; this half executes, loses part of the answer, and
reports the loss as an ordinary failure. Same knob, three faces, and only the middle one is honest.

**Shapes, none decided here.** Raise `maxBuffer` to something large (cheapest, moves the cliff rather
than removing it, and a cliff that moves is harder to find). Stream stdout and stderr to a file in the
worktree and read the exit code from the process (no ceiling, and `dev/integration.md` gains a real
artifact — but it changes what `runCommand` returns, which is externally observable through what
`integrate` writes). Report overflow as a third outcome beside `timedOut` (composes with register
row 7, and per the table above cannot be implemented by inspecting the error alone). The first is a
constant; the other two are products.

**Landing constraint.** Once Q-0048 lands, `runCommand` exists in both trees, so the fix goes into
`spike/src/fanout.js` **and** `packages/core/src/fanout/command.ts` together — the Q-0066/Q-0068
shape — or the port loses the independent witness the freeze exists to provide. `spike/src` is frozen
for Q-0009's fifteen children and this ticket is not among them, which is the same route Q-0063 took.

**Scope.** The config half is a one-line change to `harness/harness.yaml` and the shipped template,
neither of which is frozen. An engine-side refusal (shapes 2 and 3) touches the integrate step, which
`spike/src/engine.js` still owns and which the port hands to **Q-0053**; `spike/src` is frozen for
Q-0009's fifteen tickets and Q-0065 is not among them, so the spike route is open the same way it was
for Q-0063. Belongs to M2 in `docs/06-development-plan.md`.
