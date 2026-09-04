# Q-0101 — The mock end-to-end's gate, rollback and register half

*Requirements, run 1, 2026-09-04. Candidate: claude.*

**Read §0 before the criteria.** The ticket body is §3.2 of Q-0095's merged requirement, transcribed
at that ticket's gate. It was written against `spike/test/smoke.js` and against the register — both
correctly — and against **no measurement of what `packages/cli` already carries**. Q-0094 translated
`q0040-undecided.js` and `q0033-surface.js`'s gate sites into `packages/cli/src/run.test.ts` on
2026-09-04, and three of this ticket's ten inherited criteria are substantially already proven there.
Ground rule 4 says *"`packages/core` already holds the logic. Look there before porting anything"*;
the analogous question was never asked of `packages/cli`, and this run asks it.

Every measurement below was taken against `HEAD` = `6455f43` today. Nothing is transcribed from the
ticket body, from Q-0095's merged requirement, or from `06-development-plan.md`.

---

## 0. What this run measured, and what it changes

### 0.1 The corrections table

| the body says | measured at HEAD | class |
| --- | --- | --- |
| AC-1/AC-2/AC-3 are owed | **substantially carried** by `run.test.ts` (§0.2) | a scope error, the large kind |
| `:1617` and `:1694` assert `.toMatch(/Q-0095/)` | they assert `.toMatch(/Q-0101/)`, at **`:1624`** and **`:1703`** | stale — Q-0095's AC-10 already re-aimed them |
| two register clauses name the successor | **three**: `:1624`, `:1703`, and `:1769` on the `smoke.js` row | an omission, and it fails the run if unfixed |
| "the five totals" are four `toStrictEqual` sites (Appendix B) | **five**, at `:1785`, `:1807`, `:1823`, `:1839`, `:1855`, plus five `toBe` pins at `:1205`–`:1210` | stale — Q-0095 added its own |
| `run.test.ts` "already drives `run review` at `:117` and `:528`" | `:117` is a **valueless `--base` refusal that opens no project**; `:528` is the stage mismatch. Neither traverses a step | wrong evidence, right conclusion |
| AC-9: "That file contains zero `model` or `gpt` matches today (verified)" | **correct**, of `templates.test.ts`. The template corpus holds **11** `model:` lines and **zero** `gpt-` | confirmed |
| `smoke.js:267` is an assertion to translate | it **cannot fail** (§0.4) | a check weaker than its claim |

### 0.2 F-1 — three inherited criteria are already carried, in process, by Q-0094

Measured site by site in `packages/cli/src/run.test.ts`:

| inherited | what `run.test.ts` already asserts | what is **not** carried anywhere in `packages/cli` |
| --- | --- | --- |
| **AC-1** exhaustion gate | `S10.6` at `:337`–`:345`: `MOCK_ALWAYS_FAIL` + `--auto`, `exitCode` `toBe(UNDECIDED)`, `/human-locked\|loop exhausted/i`, and `not.toContain('auto-advanced (human-locked)')` | the status **as the operating system reports it**; `nothing was rolled back` on the *exhaustion* gate rather than on the declared one |
| **AC-2** unanswered non-TTY gate | `AC-6` at `:202`–`:213`: exit 3, `'needs an answer and stdin closed without one — pass --gate-answer'`, `'nothing was rolled back'`, `'run #1 undecided'`, `stage: draft` | **every `runs.log` claim** — ` undecided ` present, ` failed ` absent, `rolled-back` absent — and the iteration counter |
| **AC-3** retry grant | `S10.7` at `:349`–`:354`: `runs.log` matches `gate=retry.*counter=requirements\.head-of-product.*set=1` | the **arithmetic**: three `step=head-of-product` lines, `requirements.head-of-product: 2` in the ticket, and an unrelated counter untouched |

This is not an argument for dropping the criteria. It is an argument for writing them as the claims
that are new, because a criterion satisfied by a second copy of an existing assertion is *"a second
description of a property already checked, which is the drift this repository keeps finding"* —
`packages/cli/src/templates.test.ts:19`, written three days ago about this exact hazard.

### 0.3 F-2 — `invoke()`'s `exitCode` is not an exit status, and no test in this package asserts a spawned 3

`packages/cli/test/invoke.ts:99` replaces `process.exit` with a spy that throws, and its own JSDoc
says `exitCode` is *"the code `die` passed to `process.exit`, or the `process.exitCode` the command
left behind, or `SUCCESS` where it left none."* That is a claim about an **argument**, composed by the
helper. It cannot see a status the operating system reports differently — an exit code masked by a
wrapper, an `exitCode` overwritten during teardown, or a rejection that reaches the top level after
the handler returned.

Measured across the package: `end-to-end.test.ts` is the only file asserting a spawned status, at four
sites — `:549` `not.toBe(0)`, `:687` `toBe(0)`, `:721` `toBe(0)`, `:722` `toBe(1)`. **No test anywhere
in the workspace asserts that a spawned process exited 3.** `06-development-plan.md`'s Q-0094 entry
records exit 3 as *"proven across a real process boundary"* — and reading that ticket's own suite,
that proof was performed **by hand at the gate** and never committed.

So AC-1's exit-3 claim is a new claim rather than a re-description, and it is the single most
load-bearing assertion in this ticket. `smoke.js:118` says the same thing in its own comment: *"Exactly
3, not merely non-zero: 1 is what an operator error returns and 2 is a deliberate abort."*

### 0.4 F-3 — the assertion at `smoke.js:267` cannot fail

```js
const counter = (text) => text.match(/requirements\.head-of-product: (\d+)/)?.[1] ?? '0';
assert(Number(counter(ticket4)) >= Number(counter(before)), 'an unanswered gate does not refund its iteration counter');
```

`before` is the ticket as `ticket new` wrote it. A fresh ticket's frontmatter is `iterations: {}`, so
the regex does not match, `counter(before)` is the `?? '0'` fallback, and the assertion reads `n >= 0`
— true for every possible value including a refund to zero. A verbatim translation reproduces a check
that cannot fail, which is the class *"A check is not established by reading it"* (2026-08-29) was
written about, arriving through a translation rather than through a fix. The translated form pins the
**value**, and AC-2 below says which value and why.

### 0.5 F-4 — the register clauses, re-measured

Three clauses name this ticket as owing work. All three are `.toMatch`, all three must become
`.not.toMatch(/— Q-0101\b/)` — the shape `:1614`, `:1691` and `:1767` already use for Q-0094, Q-0099
and Q-0010:

| line | subject | reads today |
| --- | --- | --- |
| `:1624` | `REGISTER['q0033-surface.js'].binaryHalf` | `.toMatch(/Q-0101/)` |
| `:1703` | the same field, second copy | `.toMatch(/Q-0101/)` |
| `:1769` | **`REGISTER['smoke.js'].binaryHalf`** | `.toMatch(/— Q-0101$/)` |

The body's AC-10 names two, and describes the `smoke.js` row's prose change without naming the clause
that pins it. `:1769` is anchored on `$`, so **any** edit to that row's trailing successor turns it red
whether or not anyone remembered it. Appendix B of Q-0095's requirement could not have known: it was
written before Q-0095 landed, when `:1769` did not exist.

A fourth clause moves as a consequence of the file layout — see F-6.

### 0.6 F-5 — the totals, re-derived by hand today

`wc -l` over the three buckets as `spike-parity.test.ts` sorts them:

- **binary-only** `q0036-board-containment.js` = **220**
- **both** 283 + 220 + 476 + 157 + 413 + 194 + 216 + 780 = **2739**
- **library-only** 256 + 139 + 87 + 42 + 730 + 332 + 262 + 407 + 71 + 143 = **2469**
- **total 5428**, share 2959 / 5428 = 54.51% → **55**

Identical to the five pinned sites. This ticket writes nothing under `spike/`, so the expected result
is that they do not move — and *"it did not move" is a measurement*, which is why AC-12 re-derives
rather than skips. It is the **sixth** consecutive unmoved re-derivation.

### 0.7 F-6 — the file layout is pinned by a criterion, not chosen

`:1729` reads:

```ts
expect(REGISTER['smoke.js'].binaryCarriedBy, "smoke.js's chain half is no longer recorded as carried")
  .toStrictEqual(['packages/cli/src/end-to-end.test.ts']);
```

AC-10 asks that the row *"names **both** counterparts with prose saying which claims each carries — the
Q-0092 precedent"*, and Appendix B's `:1714` row says §3.2 *"adds the second counterpart"*. Both presume
a **second file**. If the scenarios instead land inside `end-to-end.test.ts`, `binaryCarriedBy` stays a
one-element list and AC-10 is unsatisfiable as written.

So: a second file, and `:1729` is a fourth clause that must be **re-aimed and shown red first**, exactly
as Q-0095 re-aimed the `.toBeUndefined()` it replaced — *"a deleted clause and a satisfied one are
indistinguishable in a green run."* Its cost is real and is stated in R-1 and OQ-1 rather than hidden.

### 0.8 F-7 — AC-7's second half has no subject outside the chain

`smoke.js:317`–`:319` asserts over `solutioningOut` — the stdout of the **chain's** solutioning run,
which is Q-0095's. In `packages/cli` that recording is `chain.ran.solutioning`, a field of a closure
inside `end-to-end.test.ts`'s `beforeAll`; a second file cannot reach it. The choice is three assertions
added to a run that already exists, or a whole second solutioning flow walked to produce a stdout to
assert over. The messages themselves are already covered at library level — `agent-step.test.ts:109`
and `:161`, `composite.test.ts:638` — so what these three sites uniquely claim is that the sentence
**reaches the operator on a real run**, which is a property of that run.

`end-to-end.test.ts` already asserts over `chain.ran.solutioning.stdout` at `:594` and `:609`. AC-7(b)
therefore lands there, and only there.

### 0.9 F-8 — AC-9's corpus is clean, and the neighbour it names is a different subject

`packages/cli/templates/harness/{flows,roles}` holds **11** `model:` lines —
`development.yaml:11` (`model: "{role.model}"`), `solutioning.yaml:25`, `qa-red.yaml:9` and `:41`,
`requirements.yaml:10` and `:22`, and five role files carrying `sonnet` or `opus` — and **zero** matching
`/^\s*model:\s*gpt-/m`. So the pin is green on landing and needs a mutation to be trusted.
`capabilities.source.test.ts:60`–`:67` asserts over `literalsOf(capabilities)` in the two adapter
capability modules, a different corpus for a different reason. Confirmed distinct, as the body claims.

---

## 1. Problem

`spike/test/smoke.js` is the file M2's done-when names, and 76 of its 158 assertion sites are the binary
half Q-0010 inherits. Q-0095 carried 37 of them — the chain from `init` to `stage: green`. The
remaining 39 are the ones that fire when something goes **wrong**: a loop that exhausts onto a gate
`--auto` may not walk through, a gate nobody answered, a `retry` that must grant exactly one traversal
and not a budget, a parallel branch that fails while its sibling's work survives, a merge abandoned and
rolled back, and a base conflict that no amount of re-running developers can fix.

Those are the paths a `maintainer` meets on a bad night and the paths an `adopter` meets on their first
mistake. They are also the paths that cost this project the most: `06-development-plan.md` records
Q-0036 and Q-0035 losing their merges on consecutive nights to a rollback answering the wrong question,
and Q-0011 burning three iterations and $8.63 on a base conflict routed into `on_fail` like a test
failure. Every one of those behaviours exists in `packages/core` and is proven there; what is **not**
proven is that they survive the trip through a binary an operator actually runs — and F-2 shows the
sharpest instance: the product's `undecided` contract turns on exit code 3, and no committed test
anywhere observes a real process exiting 3.

Until this ticket lands, `spike/` cannot be deleted: the register goes on saying, in three places, that
`smoke.js`'s failure half and `q0033-surface.js`'s review half are owed.

## 2. User stories

**`maintainer`** — I run `quorum run` unattended from a script. When a bounded loop exhausts and nobody
is there to answer, I need the process to exit **3** and not 1 or 2, so my wrapper can tell *"nobody
was there"* from *"the work is bad"* and from *"I typed something wrong"* — and I need to know that
claim was checked by starting a process and reading what it returned, not by inspecting an argument.

**`maintainer`** — When a run fails, I need the ticket branch exactly as it was and the work still on
its own branch, and I need `runs.log` to tell me which of `failed`, `aborted` and `undecided` happened,
because those three want three different next actions from me.

**`contributor`** — I am about to delete `spike/`. I need one artifact that says, file by file and
claim by claim, that every binary-half assertion has a live counterpart under `packages/` — and I need
that artifact to be recomputed from the tree rather than transcribed, so it cannot agree with a
document while disagreeing with the code.

**`adopter`** — My first `quorum init` scaffolds a `harness/flows` and `harness/roles`. None of it may
pin a vendor model name, because the names go stale and a name that works on an API key is rejected on
a subscription. Today that promise is checked only against a tree the cutover deletes.

**Surfaces touched:** `packages/cli` (a new suite and three lines added to an existing one),
`packages/core` (`spike-parity.test.ts` only). **No product source changes.** No change under `spike/`,
`harness/`, `backlog/` or `docs/decisions/`.

## 3. Design constraints the criteria assume

These are not criteria; they are the shape any implementation must have, measured from what Q-0095
landed. An implementation that contradicts one of them is wrong before its assertions are read.

1. **The new suite lives at `packages/cli/src/<name>.test.ts`.** `vitest.shared.js` takes Vitest's own
   default include, which would collect `packages/cli/test/*.test.ts` too — but `tsconfig.build.json`
   declares `rootDir: "src"`, `include: ["src/**/*.ts"]` and `exclude: ["src/**/*.test.ts"]`, so `src/`
   is where the emit exclusion is aimed and where every sibling suite lives.
2. **It reuses `packages/cli/test/workspace.ts`** — `isolate`, `buildIn`, `disposeIsolated`, `read`,
   `PACKAGE`, `WORKSPACE` — and spawns the copy it built. It never spawns `packages/cli/dist`, which
   `build.test.ts` removes twice (Q-0098 AC-15(c)).
3. **One operating-system process per invocation.** `packages/core/src/adapters/mock.ts:29` keys its
   call counter `role:task` or `role:kind`, module-scoped with no reset export, and adding one is a
   charter §2 behaviour change. AC-2's route depends on the reviewer failing its **first** call for a
   key and passing afterwards.
4. **It names no path under `spike/`**, in a literal or a specifier, for the reason
   `end-to-end.test.ts`'s AC-3 gives: the suite must survive the cutover, and that is asserted over the
   file's own source rather than discovered on the day.
5. **It sanitises the child's environment** the way `end-to-end.test.ts:300` does — a deny-list derived
   from the four files that read a variable, not a typed list — so an inherited `MOCK_ALWAYS_PASS`
   cannot force a verdict a criterion exists to observe. `GIT_CONFIG_*` must still reach the child, or
   `pnpm sweep:git-identity` exempts this suite from the one check it must not be exempt from.
6. **It refuses on a platform without `sh` rather than skipping**, at module scope, for the reason
   Q-0095 wrote down: *"a check that skips its subject must not report success"* (2026-08-25).
7. **One fixture repository per scenario.** The spike shares one `tmp` across every block, which is why
   `smoke.js:369` and `:401` delete their ad-hoc flow files and restore `harness.yaml`. A repository per
   scenario removes the cleanup **and** the coupling; a scenario that leaves a `base_branch` edit behind
   is a fixture whose neighbour's verdict depends on its own ordering.

## 4. Acceptance criteria

Thirteen, against the fifteen Q-0091's gate measured as the ceiling. Ten are the body's; three are
split out of AC-10 because the register work is four clauses and five pins rather than one edit.

---

**AC-1 — The exhaustion gate, and exit 3 as the operating system reports it.**

Through a spawned binary, on a ticket whose bounded loop exhausts (`MOCK_ALWAYS_FAIL`, `--auto`):

- (a) the status is asserted **`=== 3`**, never `!== 0`, and it is read from the spawned result rather
  than from a helper that composed it;
- (b) the output says the loop exhausted and the gate is `human-locked`;
- (c) the output says which gate could not be answered — `stdin closed without one` — and **what it
  kept**: `nothing was rolled back`;
- (d) `gate: auto-advanced (human-locked)` appears nowhere.

*Carried already, and stated so the criterion is not read as new:* `run.test.ts:337` (S10.6) proves
(b) and (d) and asserts `UNDECIDED` in process. **What is new is (a) and (c) at this gate.** (a) is the
only assertion in the workspace that observes a real process exiting 3 (§0.3); (c) is asserted by
`run.test.ts:211` on the flow's *declared* gate, and the exhaustion gate is a different gate reached by
a different route.

*Test:* the same run supplies all four. Shown red by a mutation recorded in the implement report:
mapping `undecided` to `1` in `packages/cli/src/exit.ts`'s table must fail (a) **and leave (b), (c) and
(d) green**, which is what proves (a) is not riding on its neighbours.

---

**AC-2 — An unanswered non-TTY gate is `undecided` in the durable record, and the counter is a value.**

Through a spawned binary with stdin not a terminal and no `--gate-answer`, on the requirements flow:

- (a) `runs.log` contains ` undecided `;
- (b) `runs.log` contains no ` failed `;
- (c) `runs.log` contains no `rolled-back`;
- (d) `ticket.md` still reads `stage: draft`;
- (e) the iteration counter is asserted at **the value the run reached**, and the assertion is shown to
  fail against a refund to `0` and against the key's absence.

*Carried already:* `run.test.ts:202` proves the exit code, the two output sentences and (d) in process.
**What is new is (a), (b), (c) and (e)** — the classification in the file a maintainer reads afterwards,
which no `packages/cli` suite asserts. `packages/core/src/engine/undecided.test.ts` proves the engine
side; the record `backlog.log` writes is the CLI's end of it.

*(e) is the correction F-3 names.* The spike's form is `n >= 0` against a ticket with no counter key and
cannot fail. The translated form pins the number, and the implementer records the observed value rather
than predicting it here — the route is *reviewer fails its first call for the key, loop returns, second
call passes, flow reaches its declared human gate*, and the counter that survives is a property of
`requirements.yaml`'s bound rather than of this document.

---

**AC-3 — `retry` grants exactly one further traversal, and the arithmetic is the claim.**

Through a spawned binary with `--gate-answer retry` and no second answer, `MOCK_ALWAYS_FAIL`, on a
ticket pre-seeded with an unrelated counter:

- (a) `runs.log` holds exactly **three** `step=head-of-product` lines — one run, one loop, one grace
  traversal; a fourth would mean `retry` handed back the whole budget;
- (b) `runs.log` matches `gate=retry counter=requirements.head-of-product set=1`;
- (c) `ticket.md` ends at `requirements.head-of-product: 2` — one past the limit, not reset to zero;
- (d) the pre-seeded unrelated counter is untouched;
- (e) the second, unanswered gate ends the run non-zero, which is what proves the gate **returned**.

*Carried already:* `run.test.ts:349` (S10.7) proves (b) alone, and supplies `abort` for the second gate
so (e) is implied rather than asserted. **(a), (c), (d) and (e) are new**, and (a) is the assertion the
DECISIONS entry *"`retry` at an exhaustion gate authorises exactly one more traversal"* (2026-08-22)
actually turns on — it corrected an off-by-one, and a count is the only shape that can catch its return.

---

**AC-4 — The failed parallel sibling, its cost, and run-id uniqueness.**

With `MOCK_FAIL_WRITE` aimed at the claude candidate:

- (a) a failed parallel branch fails the run;
- (b) the surviving sibling keeps its output at `requirements/run-1/candidate-codex.md`, asserted at
  that exact path;
- (c) the negative assertion **searches `requirements/` recursively** for `candidate-claude.md` rather
  than testing one path;
- (d) `runs.log` records the failure and `ticket.md` does not advance;
- (e) the failed step records what it cost — `step=pm-claude … FAILED cost=0.07` — and the run's own
  cost line is at least that;
- (f) a second attempt gets a run id the first did not use, asserted as an identity over the ids in
  `runs.log` rather than as a count.

*Not carried anywhere.* No `packages/cli` suite drives a parallel group to a partial failure.

---

**AC-5 — The two re-aimed assertions are demonstrated red against a deliberately broken binary, and
the evidence names the break.**

Before the final green run, two mutations, each recorded with **the test, the injected break, and the
failing assertion's own message**:

- (a) one break causes AC-4(b)'s run-scoped candidate not to be found at `requirements/run-1/`;
- (b) one break causes a failed parallel sibling's `candidate-claude.md` to be found by AC-4(c)'s
  recursive search.

A process that fails to start, an unrelated process failure, or a different earlier assertion failing
**does not count as the red witness**. The break lives in the isolated copy or in the mutation
procedure and is never committed as product behaviour. The record goes in the implement report, not in
an assertion inside the run it would be describing — `end-to-end.test.ts:503` sets that precedent in as
many words.

*Why it is its own criterion:* Q-0088 moved these files, and the single-path form of the negative
assertion went green the moment it moved — it had been proving the writer failed only by accident. A
translation that re-flattens either one re-opens that hole **and passes**.

---

**AC-6 — Rollback (a): the abandoned merge.**

A failing `integrate` with no `on_fail`, over a ticket branch with one commit and a side branch
carrying an implementation:

- (a) the run aborts non-zero;
- (b) the ticket branch is at **exactly** the SHA it started from, compared as revisions rather than as
  messages;
- (c) the abandoned merge is gone — the implementation file is not in `git ls-tree -r` of the ticket
  branch — so the next red phase measures against a clean base;
- (d) the work survives on its own branch, asserted positively over the side branch;
- (e) `runs.log` holds `rolled-back branch=`.

(c) and (d) are one claim in two directions and both are required: (c) alone is satisfied by losing the
work, and (d) alone by never rolling back.

---

**AC-7 — Rollback (b): the base-sync conflict, and base-sync reporting.**

**(b1), in the new suite.** A ticket branch and a base branch in genuine conflict over one file, an
`integrate` step whose `on_fail` would loop three times:

- (a) the run fails;
- (b) the output names the two branches that disagree;
- (c) the output says re-running the developers cannot fix it;
- (d) **`iteration 1/3` never appears** — a base conflict does not consume the iteration budget;
- (e) `runs.log` holds `base-conflict base=`.

**(b2), in `end-to-end.test.ts`.** Three assertions over `chain.ran.solutioning`, which that file
already records and already reads at `:594` and `:609`:

- (f) `does not exist yet — nothing to sync` is present;
- (g) `could not sync` is absent;
- (h) no failure is reported with an empty reason — the trailing `— ` / `: ` shape.

*Why (b2) is not in the new suite:* §0.8. Its subject is the chain's solutioning run; re-walking a whole
flow to produce a stdout for three assertions would be a second run proving a property the first already
demonstrates. The register prose must say which counterpart carries which, which is what AC-10 asks for.

---

**AC-8 — `q0033-surface.js` S3.2/S3.3: the shipped review flow traverses both paths.**

Over the shipped `review.yaml`, both rows, each exiting 0:

- `MOCK_ALWAYS_FAIL` + `--gate-answer abort` → `stage: red`, with a
  changes-requested / development / red word in the output;
- `MOCK_ALWAYS_PASS` + `--gate-answer advance` → `stage: reviewed`, the word `approve`, and
  `review/verdict.md` written.

This scenario uses the **forcing** switches, so it does not depend on the mock counter and **may run in
process** through `test/invoke.ts`. It belongs in `run.test.ts`, whose *"Nothing here spawns the
binary"* header stays true, and which already holds every helper it needs: `project()` at `:53`,
`ticketDir` at `:65`, `setStage(dir, 'green')` at `:74`, and `vi.stubEnv` for the switches.

*Correction to the body's note (F-8):* it says that file *"already drives `run review` at `:117` and
`:528`, the latter a stage-mismatch refusal that traverses no step"*. `:117` is
`invoke(['run', 'review', 'T-9', '--base'])`, a valueless-flag refusal explicitly asserted to happen
*before any project is opened*. **Neither existing site traverses a step**, so this is the first test in
that file to walk a flow to a stage transition. The conclusion stands and the evidence for it does not.

---

**AC-9 — The shipped-template model pin is re-homed rather than lost.**

`packages/cli/src/templates.test.ts` asserts that no file under
`packages/cli/templates/harness/{flows,roles}` matches `/^\s*model:\s*gpt-/m`, and names the offenders
when one does. It carries `smoke.js:216`'s claim onto the corpus Q-0093 mirrored — the one an
`adopter`'s first `quorum init` copies, and the one that survives the cutover.

*Measured (F-9):* the corpus holds 11 `model:` lines and zero matches, so the assertion is green on
landing. *Test:* shown red by adding `model: gpt-5` to a template **in a fixture copy**, never in the
tracked tree, and the failure message must name the offending file rather than a count.

*Neighbour, checked and distinct:* `capabilities.source.test.ts:60`–`:67` guards adapter capability
module literals. Different corpus, different subject; no overlap.

---

**AC-10 — The `smoke.js` row names both counterparts, with prose saying which claims each carries.**

`REGISTER['smoke.js'].binaryCarriedBy` names `packages/cli/src/end-to-end.test.ts` **and** the new
suite, and `:1729`'s `toStrictEqual(['packages/cli/src/end-to-end.test.ts'])` is **re-aimed rather than
deleted**, shown red against its superseded value first. The row's prose states which file carries
which claims — the Q-0092 precedent, *"across two files because the assertion claims two things"* —
and names AC-7(b2) explicitly, since three of this ticket's assertions live in the sibling file.

*Test:* the audit's own guards, exercised rather than assumed — `mutated(…, { binaryCarriedBy: […] })`
against a path that does not exist, and against one that exists but no include collects, must each
still report. Both mutation shapes are already written at `:1512` and `:1520` for a different row.

---

**AC-11 — All three successor clauses are inverted, each shown red first.**

`:1624`, `:1703` and **`:1769`** become `.not.toMatch(/— Q-0101\b/)` — the shape `:1614`, `:1691` and
`:1767` already use — and each is **rewritten rather than removed**, because a deleted clause and a
satisfied one are indistinguishable in a green run. Each carries one line saying it was re-aimed and
why, matching the comments Q-0094, Q-0099 and Q-0095 each left above their own.

*The third is the correction F-4 names:* `:1769` asserts over the `smoke.js` row and is anchored on
`$`, so the prose edit AC-10 requires turns it red whether or not anyone remembered it. The body names
only two.

*Test:* each shown red against its superseded value before the new one is trusted.

---

**AC-12 — The five totals are re-derived and expected unmoved, a sixth time.**

A sixth `toStrictEqual({ binaryOnly, both, libraryOnly, total, share })` block, re-derived from `FACTS`
rather than transcribed from the five that precede it, expecting
**`{ binaryOnly: 220, both: 2739, libraryOnly: 2469, total: 5428, share: 55 }`** — the values this run
re-derived by hand from `wc -l` today (§0.6). The classification is asserted unchanged too:
`smoke.js` stays `split`, because a verdict describes the spike file's own text and translating it does
not alter one.

*The expected answer is that nothing moves*, because ground rules 1 and 2 keep everything under
`spike/` untouched. It is measured rather than assumed, for the reason each of the five preceding
blocks gives: *"it did not move" is a measurement, and assuming it did not is how a stale pin survives.*

*Correction to Appendix B (F-5):* it names four `toStrictEqual` sites. There are five, at `:1785`,
`:1807`, `:1823`, `:1839` and `:1855`, plus the five individual `toBe` pins at `:1205`–`:1210`.

---

**AC-13 — Nothing is described twice, and the chain is written down where a reader meets it.**

The new suite's header states, for AC-1, AC-2 and AC-3, **which clauses `run.test.ts` already carries
and which are new**, citing the file and the scenario id — the three-link chain
`packages/cli/src/templates.test.ts:9`–`:22` writes for its own subject, which reads link 2 rather than
re-asserting it. No assertion in this ticket is a second copy of one measured in §0.2 as already
carried, and where a claim is deliberately restated on a spawned run because it is free once the run
exists, the header says so and says what the spawned form adds.

*Test:* asserted over the header's own text, in the shape `end-to-end.test.ts` already uses for its
`SOURCE` scans — the file names `run.test.ts` and at least the two scenario ids `S10.6` and `S10.7`.
This is a weak check on purpose; the strong one is the reviewer reading §0.2 against the diff, and the
criterion exists so a reviewer knows to.

---

## 5. Non-goals

- **The spawn harness and the green chain** — Q-0095's, landed at `bb8e143`.
- **Any change to `spike/`.** Ground rules 1 and 2. If a change there turns out to be genuinely
  required, the implement step stops and says so rather than making it.
- **Deleting `spike/`, retiring its CI job, retiring `harness/port-charter.md`** — the cutover's, per
  GO-4. This ticket unblocks it and does not perform it.
- **Fixing Q-0102.** The git-identity sweep's flake is a live p1 and this ticket's own change is a
  suspect in it (R-1). Ground rule 3 forbids closing an open ticket in passing; measuring is not
  fixing, and OQ-2 asks only for the measurement.
- **Q-0059, Q-0060, Q-0066, Q-0068, Q-0100.** Every user-facing `harness` sentence a translated
  assertion reproduces is preserved **verbatim** — Q-0093's precedent, where the scaffold's own
  next-steps line was correctly preserved rather than fixed in passing.
- **Adding a reset export to the mock adapter.** Charter §2 behaviour change, and the constraint that
  forces one process per invocation is the constraint AC-1's exit-code claim rests on.
- **Any product source change.** If a criterion cannot be satisfied without one, that is a finding for
  the gate, not a change.

## 6. Open questions

**OQ-1 — Does §3.2 land as a second suite? (owner: gate. Recommended: yes.)**
AC-10 and Appendix B both presume it, `:1729` moves only if it is true, and the alternative makes AC-10
unsatisfiable as written (§0.7). What it costs is a second `isolate()` + `buildIn()` — measured by
Q-0095's own header at ~0.1 s to copy and ~2.1 s for the forced build, in a separate Vitest worker, so
no module-scoped cache crosses the two files. **Recommend the second suite, and recommend it be
answered at the gate rather than by the implementer**, because it is the one decision here that a
review round cannot re-open cheaply.

**OQ-2 — Does this ticket's change move Q-0102's failure rate? (owner: implementer. Blocking on the
report, not on the design.)**
Q-0102 was opened today: `pnpm sweep:git-identity` exits 1 on `main` in phase `workspace suite`, CI runs
it as two required jobs, and its **leading hypothesis is contention from Q-0095's new process-spawning
suite** — a hypothesis its own body records as incomplete, because the sweep is red at the commit
before that merge too. This ticket adds a second process-spawning, workspace-building fixture to the
same package. GO-1 of Q-0102 asks for a failure *rate* at a fixed commit; this run should supply one
data point in each direction — the sweep run N times on the implement branch and N times at its merge
base — and report it. **Do not fix it here** and do not make it green by weakening what it runs, which
Q-0102's GO-2 refuses in advance.

**OQ-3 — AC-2(e): which counter value? (owner: implementer, by measurement.)**
Recommend pinning the observed number and demonstrating the assertion red against `0` and against the
key being absent. Do **not** predict it from this document: the route depends on `requirements.yaml`'s
own bound, and F-3 is what happens when a counter assertion is written from intent rather than from a
run.

**OQ-4 — AC-6 and AC-7(b1) write ad-hoc flow files and edit `harness.yaml`. (owner: implementer.
Recommended: one repository per scenario, no cleanup.)**
The spike restores both because it shares one `tmp` across every block. A repository per scenario makes
the restore unnecessary **and** removes a coupling: a scenario that leaves a `base_branch` edit behind
makes its neighbour's verdict depend on ordering, which is the class *"A test's verdict is a property
of the commit"* (2026-08-30) forbids. Cost: two more `git init` fixtures, which are milliseconds beside
the build.

**OQ-5 — Is AC-13 the right instrument, or should the chain live in the register's prose instead?
(owner: gate. Recommended: both, and AC-13 is the cheap half.)**
AC-10 already requires the row's prose to say which counterpart carries which claims. AC-13 puts the
same statement where an implementer editing the suite will meet it. If the gate judges one of the two
redundant, drop AC-13's assertion and keep its header sentence — the assertion is deliberately weak and
is not what makes the criterion worth having.

## 7. Risks

**R-1 — This ticket is a suspect in an open p1.** See OQ-2. If the measurement shows the second
fixture moves the sweep's failure rate, the honest outcome is to say so at the gate and let Q-0102
decide, not to reshape this ticket around it mid-loop.

**R-2 — The register audit fails closed, and that is a hazard on the way in.** `audit()` requires every
named `binaryCarriedBy` counterpart to **exist and to be collected by an include**. A suite placed
outside `src/`, or named without `.test.ts`, produces a register entry that fails with a message about
the register rather than about the file — which reads like a register defect. Design constraint 1 is
what avoids it.

**R-3 — Four register clauses move and three of them are in tests named after other tickets.** `:1624`
sits inside `test('(l) Q-0093 …')`, `:1703` inside `test('(p) Q-0099 …')`, `:1729` and `:1769` inside
`test('(r) Q-0095 …')`. Editing another ticket's test block is correct here and looks wrong; each edit
needs its one-line reason in place, or a review round will block it.

**R-4 — `MOCK_FAIL_WRITE` matches the *prompt*, not the path.** `mock.ts:98` is
`prompt.includes(process.env.MOCK_FAIL_WRITE)`. A translation that assumes it matches a write target
will target the wrong step, and the failure will look like a flow defect.

**R-5 — AC-1's four assertions can pass for three different reasons.** (b) and (d) are already true in
process, so a spawned run that failed for an unrelated reason could still satisfy them while (a)
happened to read 3 from an early crash. The mutation AC-1 requires — `undecided → 1`, expecting exactly
(a) to go red — is what separates them, and it is not optional.

**R-6 — `packages/cli/turbo.json` declares this package's out-of-package reads, and a new suite may add
one.** Today it names eleven globs and **not** `../../spike/test/**` — correctly, because no
`packages/cli` suite reads that tree. Design constraint 4 keeps it that way. If any criterion ends up
reading a file outside the package that is not already declared, the declaration moves in the same
change or a cache hit reports agreement from a replay (Q-0072).

**R-7 — The exhaustion-gate scenarios spawn runs that reach a gate with no answer.** In the spike these
carry explicit `timeout` values, because the failure mode before Q-0011 was a 24-minute hang rather
than a red test. Every spawn here needs a timeout, and a timeout that fires must fail the suite with a
message naming the gate rather than being absorbed as a non-zero status AC-1(a) then reads as "not 3".

## 8. Cross-cutting checklist

| | |
| --- | --- |
| **BYOS** | n/a to the change; **enforced against it** — `frame.source.test.ts` AC-12 asserts exactly one file in `packages/cli` matches any BYOS spelling and that its self-exclusion is the only one. A new suite that types `ANTHROPIC_API_KEY` turns that guard red. Derive the names as `end-to-end.test.ts:242` does. |
| **Worktree safety** | The fixtures create repositories under `os.tmpdir()`, realpathed. Nothing writes to this repository's working tree. AC-6 and AC-7 create branches **inside their own fixture**, never `harness/Q-0101/*`. |
| **Gate behaviour** | The subject. `human-locked` is never auto-advanced (AC-1(d)); `--auto` reaches an unanswered gate and can end a run `undecided`, per the 2026-09-01 erratum and not decision 076's earlier sentence; `retry` grants one traversal (AC-3). |
| **File format and schema** | No format changes. `runs.log`'s line grammar is read, not written. `Entry.binaryCarriedBy` (Q-0091 E-2) is used rather than a fourth verdict. |
| **Lint rules** | No flow file changes, so `packages/shared/src/flow.test.ts`'s Q-0086/Q-0087/Q-0088 scoping guard is untouched. The ad-hoc flows AC-6 and AC-7 write live in a fixture and are not shipped assets. `@typescript-eslint/no-deprecated` covers the new file (Q-0069). |
| **Cold-clone impact** | One improvement, AC-9: the `adopter`'s scaffolded corpus gains a pin that survives the cutover. No first-30-minutes cost. |
| **Docs** | None expected. `06-development-plan.md` is rewritten by hand at each plan pass and **is not this run's to edit** — Q-0094's E-3(a) records the cost of ruling otherwise. `04-architecture.md`'s two-required-suites sentence stays true until the cutover. |
| **Decision entries** | None owed. Every rule this ticket applies is already written: 2026-08-25, 2026-08-29, 2026-08-30, 2026-08-31, 2026-09-01. If one turns out to be owed, GO-3 applies. |

## 9. Gate obligations

**GO-1 — Q-0095 is `reviewed` and contained.** Verified: merged at `bb8e143`, `end-to-end.test.ts` is
833 lines at `packages/cli/src/`, and the two register clauses are re-aimed at this id. **Satisfied.**

**GO-2 — `harness/Q-0101/integration` must exist before the first chore run.** Verified **not**
satisfied: `git branch --list 'harness/Q-010*'` returns nothing. `review` diffs against that branch and
only `integrate`, which runs later, creates it (`docs/02-sdlc-pipeline-spec.md` §5.8). Cut it
deliberately from the requirements tip, per Q-0037's GA-2, rather than from whatever `HEAD` holds.

**GO-3 — Q-0083 does not exist.** An implement step that finds a finding it may not act on has no
`blocked` verdict. The remedy is an erratum written **during** the loop, and **the window for one is a
gate** — landed between a review returning and the next implement starting it reaches neither
(Q-0094 E-3(a), Q-0097 E-1/E-2). §0.2 is the most likely source of one: a reviewer reading AC-1, AC-2
or AC-3 against `smoke.js` rather than against this document will report the narrowing as a missing
translation, and it is neither.

**GO-4 — Allocate the cutover ticket at this ticket's close, rather than remembering it.** Deleting
`spike/`, retiring its CI job and retiring `harness/port-charter.md` is Q-0010 §5's follow-up. When it
is allocated, `spike-parity.test.ts` and `spike/test/**` go together, which is the one place this
ticket's whole output is deleted on purpose.

**GO-5 — Answer OQ-1 at the gate** (§0.7). It is the only question here whose answer a review round
cannot cheaply revisit, because it decides which register clause moves.

---

## Appendix A — the 39 assertion sites this ticket owns

From Q-0095's Appendix A, re-verified against `spike/test/smoke.js` at HEAD (780 lines, 158 `assert(`
sites). **Bold** rows transfer to the new suite; the rest are noted.

| block | lines | sites | criterion | already carried in `packages/cli`? |
| --- | --- | --- | --- | --- |
| **exhaustion gate: `--auto` refused, exit 3, nothing rolled back** | 113–115, 118–121 | **7** | AC-1 | partly — `run.test.ts:337` S10.6 |
| **failed parallel sibling, cost, run-id uniqueness** | 141, 142, 148–150, 154, 157, 162 | **8** | AC-4 | no |
| shipped templates pin no `gpt-` model | 216 | 1 | AC-9 (re-homed) | no |
| **`retry` grants exactly one traversal** | 234, 241, 242, 244, 245 | **5** | AC-3 | partly — `run.test.ts:349` S10.7 |
| **unanswered non-TTY gate is `undecided`** | 259, 261–263, 265, 267 | **6** | AC-2 | partly — `run.test.ts:202` AC-6 |
| **base-sync reporting off the solutioning run's stdout** | 317–319 | **3** | AC-7(b2) | messages at library level only |
| **abandoned merge rolled back** | 359–361, 363, 365 | **5** | AC-6 | no |
| **base conflict does not loop** | 394–398 | **5** | AC-7(b1) | no |
| | | **40** | | |

Forty rather than thirty-nine: `:216` is a **re-home** rather than a translation, which Appendix A
counts in its `§3.2` column and lists on its own row. Both readings are defensible and the discrepancy
is stated rather than smoothed.

Plus `spike/test/q0033-surface.js:170`–`:181` — S3.2/S3.3, two rows over the shipped `review.yaml`,
AC-8, in process. That file's `binaryHalf` names this ticket for exactly those two rows and nothing
else; five of its six other halves are already carried by Q-0091, Q-0093, Q-0094 and Q-0099.

## Appendix B — the four register clauses and the five pins, at HEAD

All in `packages/core/src/spike-parity.test.ts`, re-verified 2026-09-04 at `6455f43`.

| site | reads today | under this ticket |
| --- | --- | --- |
| `:1624`, test (l) | `REGISTER['q0033-surface.js'].binaryHalf` `.toMatch(/Q-0101/)` | invert to `.not.toMatch(/— Q-0101\b/)` |
| `:1703`, test (p) | the same field, second copy | invert, same shape |
| `:1729`, test (p) | `REGISTER['smoke.js'].binaryCarriedBy` `.toStrictEqual(['packages/cli/src/end-to-end.test.ts'])` | **re-aim** to name both counterparts |
| `:1769`, test (r) | `REGISTER['smoke.js'].binaryHalf` `.toMatch(/— Q-0101$/)` | invert — **the clause the body does not name** |
| `:1205`–`:1210` | five `toBe` pins: 220 / 2739 / 2469 / 5428 / 55 | re-derived, expected unmoved |
| `:1785`, `:1807`, `:1823`, `:1839`, `:1855` | five `toStrictEqual` blocks, same five values | a **sixth** is added (AC-12) |

The inversion shape is not invented here: `:1614` reads `.not.toMatch(/— Q-0094\b/)`, `:1691` reads
`.not.toMatch(/— Q-0099\b/)`, and `:1767` reads `.not.toMatch(/— Q-0095\b/)` — each with the comment
Q-0094 first wrote above its own: *"the old expression would have gone on passing while meaning the
opposite, which is worse than going red."*
