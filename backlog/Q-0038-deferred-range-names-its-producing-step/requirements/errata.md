# Errata — Q-0038

*Written at the requirements gate, 2026-08-30, before any implement round. This file is normative
**only for the clauses it names**; `requirements/merged.md` governs everything else. It resolves a
contradiction and widens no scope.*

Both `implement` and `review` read this file (`harness/flows/chore.yaml`), so an entry reaches any
step whose prompt is built after it is on disk. Nothing here was discovered by an agent — it is the
open question the merged requirement raised as OQ-2, ruled by the human at the gate so that a review
round does not spend money re-opening it.

## E-1 — AC-8 is bounded by a frozen contract clause that predates `--base`, and the clause is superseded for the override path only — 2026-08-30

**Supersedes** `contracts/Q-0006/review-runtime.contract.md:21–22`, the sentence *"A missing base
ref is an error naming `repo.base_branch`, `harness/harness.yaml`, and the ref."*, **for runs given
a `--base` override and for no other run.**

**Replacement.** When a run was given `--base` and the effective base does not resolve, the error
names the override and the revision supplied, and names neither `repo.base_branch` nor
`harness/harness.yaml`. When no override was given, the sentence stands unchanged and byte for byte
— which is what AC-9 pins, through `spike/test/q0006-engine.js:117–120`, a fixture that drives the
failure from `f.config.repo.base_branch` and is not edited.

**Why the contract does not reach this case, and why it is superseded anyway.** The contract defines
`{base}` at `:14` as *"the resolved base branch"* — the configured one; there was no other kind when
it was written on Q-0006. `harness run --base` shipped with Q-0077 on 2026-08-29, three weeks later,
and the contract was not amended. So the clause describes a path that is still exactly as described,
and says nothing about a path that did not exist.

That reading is sound and it is deliberately **not** relied on. Read alone, `:21` is an unqualified
sentence about *a missing base ref*, and a reviewer who reads it that way is reading it reasonably.
An open question ruled inside a requirement is advisory; this file is not. Binding it here costs
nothing now and saves the round that would otherwise be spent discovering that neither the
implementer nor the reviewer is entitled to settle whether a frozen contract still applies — the
shape *"a loop spending its budget on work no agent in it can perform"* names, and the reason
*"A reviewer approves the change it asked for"* (2026-08-29) says an erratum must be written **as
soon as the contradiction is provable** rather than at an exhaustion gate.

**What this erratum does not settle.**

- **`contracts/` is not edited, by anyone, on this ticket.** It is outside the chore role's write
  paths (`harness/roles/developer-generalist.md:3`), so a criterion naming it could not be
  satisfied — *"A requirement may not name a surface its flow cannot write"* (2026-08-25). Whether
  the Q-0006 contract should eventually be amended to describe the override path is a separate
  question for whoever next opens that file, and it is not a defect in Q-0038's change.
- **Nothing about what `--base` does.** It moves the diff anchor and nothing else; only the message
  changes. The three sites that merge a base into the ticket's branch are untouched.
- **The sibling clause at `:130` of the same fixture** — that the integration-branch message does
  *not* mention `repo.base_branch` — stays true and is not superseded.
- **No other clause of any contract under `contracts/`.** This entry names one sentence in one file.

## E-2 — AC-12 asks the implement step for evidence only `integrate` can produce — 2026-08-30

**Supersedes** `requirements/merged.md` AC-12, the clause *"The implement report states, per
environment row, that `pnpm install --frozen-lockfile` and `npm install --prefix spike --no-audit
--no-fund` were run first"*, **for the `npm install` half only.**

**Replacement.** The implement report states which commands it ran and which its environment
refused, with the outcome of each — which rounds 2 and 3 already do, in a measured table. **AC-12's
`npm install` clause is discharged by the `integrate` step**, whose `dev/integration.md` carries
`Install: <commands.install> → exit <code>` written by the engine. That is the evidence the
criterion wanted and it is worth more than an agent's report, because it is the engine's own record
of a command it executed rather than an account of one.

The `pnpm install --frozen-lockfile` half is **not** superseded: it is permitted, it was run every
round, and it stays reported. Nor is anything about the two suites — `npm test --prefix spike` and
`pnpm turbo run test --force` are permitted and their counts are still required, with the method
that produced them stated.

**Why the requirement was wrong.** `harness/harness.yaml:38` declares

```yaml
install: npm install --prefix spike --no-audit --no-fund --silent && pnpm install --frozen-lockfile
```

— AC-12's two commands, verbatim, in one line — and `spike/src/engine.js:1039` runs it through
`runCommand`, a subprocess the engine spawns directly, so no Bash permission allowlist applies to
it. It runs where `run_tests` is set, which is the `integrate` worktree, and `chore.yaml` orders
`implement → review → integrate`. So the install AC-12 requires runs, by the engine, **in the step
after the review that was blocking on it**. Verified against `main` at the gate, not taken from the
implement report that first identified it.

The implement step cannot run it. `.claude/settings.json`'s `permissions.allow` grants npm per
verb and grants only `test`; `install`, `ci` and even the read-only `ls` are refused. Round 3
separated the two hypotheses by re-attempting with the sandbox override set — refused identically —
so it is the allowlist and not a sandbox. The allowlist gap is a real defect and **is now fixed on
`main`** (`Bash(npm install --prefix spike*)`), but it cannot reach this run: an implement worktree
is cut from `harness/Q-0038/integration`, which predates the fix, so every round read the old file.

**The general shape, which is why this is an erratum and not a concession.** A requirement may not
ask a step for evidence only a later step can produce. That is the 2026-08-25 surface rule — *a
requirement may not name a surface its flow cannot write* — one axis over: not *which file*, but
*which step*. Three rounds and roughly $24 were spent proving it, and each round was correct: the
implementer reported honestly and refused to route around a refused command or to grant itself the
permission it was blocked by, which would have meant writing outside its role to satisfy a criterion
about its own verification; the reviewer refused to approve an unmet criterion. **More rounds buy
more correct refusals** — and round 3 is the one that found the resolution rather than restating the
blockage.

**What this erratum does not settle.**

- **It is not a judgement on the change under review.** The three review rounds raised this one
  finding and never engaged with the 165-line engine change; that is a gap in the review, not
  evidence of quality either way, and the human at the gate reads the diff.
- **Whether the exhaustion should be answered `advance` or `retry`** — the human's, at the gate.
  `advance` continues to `integrate`, which is precisely the step that discharges this clause.
- **The allowlist fix's reach.** It is on `main` and will apply to the next ticket whose integration
  branch is cut after it. Nothing here back-ports it into a live worktree.
- **Whether `npm ci` should also be permitted.** Round 3 argues it is the lockfile-exact form and
  therefore the better one; `harness.yaml` specifies `npm install`, so only that is granted. Not
  decided here.

## E-3 — E-2 is withdrawn: AC-12 was met outright, and round 4's new finding is pre-existing — 2026-08-30

**Supersedes E-2 of this file**, and rules the round-4 review finding out of scope. Two separate
things, in one entry because both come from the same round.

### (a) E-2 is withdrawn. AC-12 stands unamended and is satisfied.

E-2 superseded AC-12's `npm install` clause on the grounds that the implement step could never run
it and that `integrate` discharges it instead. **Round 4 ran it.** The permission was added to
`.claude/settings.json` and delivered into the worktree by fast-forwarding
`harness/Q-0038/integration`, which the implement step merges on every round after the first
(`spike/src/engine.js:224`). So the clause was satisfiable after all — by fixing the environment
rather than by amending the criterion — and an erratum saying it is discharged elsewhere would now
be false. E-2's reasoning was correct for rounds 1 to 3 and is withdrawn for round 4 onward.

**The reviewer was right on the substance, not merely on the letter, and the record must say so.**
Rounds 1 and 2 argued the pnpm substitution was equivalent, round 2 checking five packages against
the lockfile and finding five matches. The real install reported `added 4 packages, and changed 3
packages`, and `spike/node_modules/fast-uri` moved to **3.1.5**, matching
`spike/package-lock.json:62`, where the pnpm-provided tree differed. A pnpm install ignoring npm's
lockfile produced a genuinely different tree, exactly as `harness/harness.yaml`'s own comment warns.
Three rounds of careful measurement reached the wrong conclusion; one execution settled it.

### (b) Round 4's finding is real, pre-existing, and not this ticket's

`review/chore-iter-4.md` reports that `ctx.diffInputs` is keyed only by the interpolated range, so
a site that materialises a range **before** a later step creates one of its endpoints leaves bytes
that a second site using the identical range then receives from the cache, even though the preflight
correctly classified that second site as deferred — `buildPrompt` prefers
`ctx.diffInputs?.get(range)` unconditionally.

**It is a genuine hazard and it is not introduced here.** `buildPrompt` is byte-identical on `main`
and on `harness/Q-0038/implement`. Neither the old preflight nor the new one removes a `diffInputs`
entry when a later site defers the same range: the old code recorded the deferral and `continue`d,
the new one records it and never materialises. An earlier materialisation survives in both. Stated
as a reading of both texts rather than as an executed test — the discriminating scenario is the one
the reviewer asks for, and it belongs with the fix.

**Not reachable in any shipped flow.** It needs one range read both before and after its producing
step. `chore.yaml:32` has its only diff site after the producer; `review.yaml:12` and `:19` are
parallel members of one group with no producer between them.

**And the fix is a design question, not a line.** Deleting the cached entry on deferral would make
the two sites materialise the same range separately, at different moments — which is what AC-10's
*"every panel member receives identical bytes"* and risk R-D forbid. Choosing between keying the
cache by site, invalidating on deferral, and accepting the current behaviour needs its own
requirement.

**Ruled: reported, not fixed.** It is recorded in the implement report and in this file, and it
needs its own ticket. This is charter §2's *"a defect found while reading is reported, never fixed
in passing"* applied to a defect found while reviewing.

**What this erratum does not settle.** Whether the ticket for (b) is opened now or at close; the
allowlist question of whether `npm ci --prefix spike` should also be permitted, which E-2 left open
and which stays open; and nothing about the change under review, which has been byte-identical
since round 1 — no review round has found a defect in it.
