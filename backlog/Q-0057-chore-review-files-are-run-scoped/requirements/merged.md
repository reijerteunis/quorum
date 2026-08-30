# Q-0057 — A chore run's reviews overwrite the previous run's, and the survivors mix

*Merged requirement, head-of-product. Written 2026-08-30 against `main` at `23dfce1`. Every
measurement below was re-derived at that commit before it entered this document; §8 records the
five claims that did not survive, three of which change the answer.*

---

## 1. Problem

The chore flow's review step writes `review/chore-iter-{iter}.md` (`harness/flows/chore.yaml:34`).
`{iter}` is `ctx.vars.iter`, set to `1` when a **run** starts (`spike/src/engine.js:50`;
`packages/core/src/engine/engine.ts:138`) and incremented once per intra-flow backward-edge
traversal (`spike/src/engine.js:180`; `packages/core/src/engine/engine.ts:266`). The counter is
run-scoped; the path it names is ticket-scoped. Every second run of the chore flow on a ticket
therefore restarts at `chore-iter-1.md` and writes over the previous run's file.

The defect is not that `{iter}` is run-scoped. It is that a run-scoped counter is the only thing
naming a ticket-scoped path.

**It has happened at least twice, and the second time was three days after the ticket was written.**

| ticket | what happened |
| --- | --- |
| Q-0041 (2026-08-25) | run 2 wrote `-1`, `-2`, `-3`; run 3 wrote `-1`, `-2` over them. On disk now, `-1` (21:39) and `-2` (22:02) are run 3's and `-3` (20:55) is run 2's orphan — the highest-numbered file is the oldest. |
| Q-0073 (2026-08-28) | `runs.log:17` records it verbatim: *"run 3's review step overwrote run 2's recovered review, because chore.yaml:34's {iter} is run-scoped and run 3 restarted the count at 1 — Q-0057, reproduced."* Run 2's review was itself a hand recovery from a raw dump, restored from blob `7f3068b` to `review/chore-run2-iter-1.md`. |

Two costs, and they are different costs.

**The artifact of record is destroyed.** `backlog/` is the database and it is in git; `.quorum/` is
gitignored (`.gitignore:2`). So an overwritten review survives only in run history on the machine
that ran it — never in a clone, never on CI, never for a second maintainer. Q-0041's run-2 review,
the one that found the union-fallthrough major, is in git only because a human committed it at
`e6b31b7` before run 3 started. Nothing in the product preserved it, and *"files are the database"*
is the rule it broke.

**The survivors are fed back mixed.** `chore.yaml:13` lists `review/chore-iter-*.md` among the
implement step's inputs, and that pattern is interpolated and globbed at read time
(`spike/src/engine.js:730`), so a revise round is handed whatever files happen to be on disk. On
Q-0041 run 3 that was run 3's `-1` beside run 2's orphaned `-2` and `-3`: reviews of different
code, from different runs, with nothing in the files saying which. That implementer coped and said
so in its report; the next one may not.

**Why now.** Three children of Q-0009 still run this flow — Q-0052, Q-0053, Q-0054 — down from the
thirteen the original finding named, and each one that exhausts and is re-run loses a review. The
flow outlives the port, and the two shipped copies (`harness/flows/chore.yaml` and
`spike/templates/harness/flows/chore.yaml`, byte-identical today: `diff` exits 0) are what
`harness init` hands a cold-clone adopter.

---

## 2. User story

As a **solo maintainer**, I want every chore review preserved under the run that produced it, and a
revision round to receive only its own run's reviews, so that re-running a ticket after an erratum
neither destroys the reasoning that produced the erratum nor pays an implementer to work out which
of three reviews describes a branch that no longer exists.

Two supporting readers:

- As a **maintainer reconstructing a decision**, I want to tell which run wrote a review by reading
  its path, not by comparing mtimes against `runs.log`.
- As an **adopter** who copies the shipped chore flow with `harness init` and runs it twice on a
  first ticket, I want the second run not to silently delete the first run's evidence — and I do
  not want to be the one who discovers that it does.

**Surfaces:** both copies of `chore.yaml`, the engine in **both trees**, `docs/`, and one test per
tree. No server, no UI.

---

## 3. The shape, and the two it beats

The engine writes the agent's document **verbatim** — `backlog.writeFile(ticket, interpolate(rel,
ctx.vars), res.output.document ?? res.raw)` (`spike/src/engine.js:308–310`). It never adds a header,
so **the path is the only place the engine can stamp run identity**, and the path is what the next
prompt shows: `## Input: backlog/<folder>/<rel>` (`spike/src/engine.js:730`). A run-scoped path
answers the ticket's *"the files need to say which run wrote them"* for both readers — the human and
the next implementer — with no new engine behaviour.

**Recommended, and specified below: the ticket's own shape 1.** Expose the already-allocated run id
as `{run}`, and write `review/chore/run-{run}/chore-iter-{iter}.md`, feeding back
`review/chore/run-{run}/chore-iter-*.md`.

It costs one hoist and one key. `runId` exists in both trees already:
`spike/src/engine.js:44` allocates it *inside the same object literal* as `vars` at `:50`, so it
must be hoisted to a `const` first; `packages/core/src/engine/engine.ts:134` is already a `const`,
so `core` is one key. The number is the one already in `runs.log` as `run=N`
(`spike/src/engine.js:78`) and already naming `.quorum/runs/<id>-<N>/`, so `run-3/` joins by
inspection to that run's cost lines and to its run history. And `{run}` is a general primitive:
§7's successor needs exactly it for every other flow, which neither alternative provides.

**On the spelling — decided here, not deferred.** `review/chore/run-{run}/…` over
`review/run-{run}/…` because the directory names the flow. `review/` already holds `round-N/`
directories from `review.yaml` on three tickets (Q-0006, Q-0011, Q-0050); `run-3` beside `round-3`
is one character apart and reads wrong. Naming the flow also lets §7's successor give other flows
run-scoped directories without a second rename. The basename stays `chore-iter-N.md` so that every
existing citation and every `grep chore-iter` still finds new artifacts as well as old ones. The
`chore` appearing twice in the path is the price and it is the smaller cost.

**Rejected — the zero-code round directory** (`review/round-{round}/chore-iter-{iter}.md` plus a
`verdict.md`). It would work with no engine change: `{round}` is `reviewRound`, which is
ticket-scoped, and writing a `verdict.md` is what makes it advance (`spike/src/engine.js:778–785`;
`packages/core/src/engine/loaders.ts:63–76`). Rejected because the numbering would then depend on a
marker file whose only purpose is to advance a counter, with nothing guarding it — a later edit that
drops the `verdict.md` write silently restores this exact defect; because it makes `reviewRound`
count chore rounds, changing a contract `review.yaml` depends on; and because `round-N` never names
the run, so the `runs.log` and `.quorum/runs/` joins stay a manual exercise.

**Rejected — a chore-only ticket-scoped counter.** New engine state, in both trees, answering less
than `{run}` does: it distinguishes rounds but still does not name the run, and §7 cannot reuse it.

---

## 4. Acceptance criteria

Ten, each independently testable. `spike/test/run.js` auto-discovers `test/*.js` (`:16–18`), so a
new `spike/test/q0057-*.js` needs no registration.

**AC-1 — the engine exposes the run id as `{run}`, in both trees, stable across a backward edge.**
`ctx.vars.run` (spike) and `vars.run` (core) equal the value `nextRunId(ticket)` returned for that
run — the same number that run's `runs.log` lines carry as `run=N` and the same one naming
`.quorum/runs/<ticket-id>-<N>/`. It does not change when `{iter}` increments. In the spike this
requires hoisting `runId` out of the `ctx` object literal (`spike/src/engine.js:44`) so `vars`
(`:50`) can reference it; in `core` it is one key on the literal at `engine.ts:137–139`, and
`types.ts`'s JSDoc for `vars` — which today names *"`base` and `iter` among them"* — names it too.
*Test (spike):* a mock-adapter run of a flow whose step declares `writes: ["x/run-{run}.md"]`, on a
ticket whose `runs.log` already ends at `run=2`, creates `x/run-3.md`, and that run's own `runs.log`
lines say `run=3`.
*Test (core):* a unit assertion beside the existing AC-6 case at `engine.test.ts:394`, which already
observes `context.vars.iter` through a `routing.runStep` spy across a backward edge and already
names Q-0057 in its comment. Core cannot test the write: `runAgentStep` returns
`unavailableStep(step, 'Q-0052')` (`routing.ts:54–55`).

**AC-2 — the chore flow's review artifact is run-scoped, in both shipped copies.**
`harness/flows/chore.yaml`'s review step writes `review/chore/run-{run}/chore-iter-{iter}.md`, and
`spike/templates/harness/flows/chore.yaml` is **byte-identical** to it afterwards (`diff` exits 0,
as it does today). No other step, flow or template file changes. `grep -rn '{run}' harness/flows
spike/templates/harness/flows` returns nothing before the change (measured 2026-08-30: no hits) and
exactly these two files after — which matters because `interpolate` leaves an unknown placeholder
untouched (`loaders.ts:52`), so a flow shipping `{run}` before AC-1 would create a literal `{run}`
directory. The implement report records both greps.

**AC-3 — a revise round sees this run's reviews, and still sees the ticket's standing corrections.**
The implement step's `input.backlog` is
`[requirements/merged.md, requirements/errata.md, review/chore/run-{run}/chore-iter-*.md]` — the
review pattern replaced, the other two unchanged. `readFiles` treats the directory part as a literal
and the basename as the glob (`spike/src/backlog.js:74–83`; `packages/core/src/backlog/backlog.ts:180–189`),
so this matches the current run's directory only.
*Test:* a two-run mock scenario where run 3's second implement step's prompt contains
`## Input: backlog/<folder>/review/chore/run-3/chore-iter-1.md`, contains no `review/chore/run-2/`
path and no flat `review/chore-iter-` path, and still contains `requirements/errata.md`.

**AC-4 — the first implement of a run is fed no chore review, whatever is already on disk.**
`readFiles` returns `[]` when the interpolated directory is absent — the early `existsSync(dir)`
guard — so run 4's first implement receives nothing from `run-3/`. This holds identically for a
ticket whose `review/` contains **only** legacy flat `chore-iter-N.md` files: that ticket starts a
new run successfully and writes into the new layout, with no migration step and no error.
*Test:* asserted on the prompt text, not on a helper's return value, and run over both starting
states (an earlier run directory present; only legacy flat files present).

**AC-5 — two runs never overwrite, and the loop still converges.**
*The regression this ticket exists for.* One mock-adapter test runs the chore-shaped flow twice on
one ticket — run 1 taking a backward edge so it writes two reviews, run 2 writing one — then asserts
four things independently: three review files exist across two run directories; run 1's two files
are byte-identical to what run 1 wrote, read after run 2 has finished; run 1's second implement step
was fed run 1's first review; and run 2's implement input contains no run-1 and no legacy file. The
same test is shown **failing** against `HEAD`'s flow file before it is trusted against the changed
one, and the report quotes the failure text rather than claiming it.
*Note for the implementer, so it is not discovered late:* a second run on one ticket needs the stage
back at `consumes`, because `runFlow` throws otherwise (`engine.js:38–40`). The realistic shape is
run 1 reaching its exhaustion gate and being answered `abort`, which leaves the stage unchanged
(`engine.js:183`) and still writes a `start` line for `nextRunId` to count; resetting the fixture's
stage between runs is equally acceptable. `integrate` need not be exercised — the defect is entirely
in the agent step's write path.

**AC-6 — within a run, iteration numbering is unchanged.**
The first chore review of a run is `chore-iter-1.md`; each intra-flow backward edge from `review` to
`implement` increments it once, so later reviews in that run are `-2`, `-3`; a new run restarts at
`-1` inside its own directory and reuses no earlier directory. No new counter, ticket-scoped or
otherwise, is introduced.

**AC-7 — legacy artifacts are left exactly as they are.**
The **56** flat `review/chore-iter-N.md` files across **21** ticket folders, and Q-0073's
`review/chore-run2-iter-1.md`, are not moved, renamed, rewritten or deleted, and no new glob reads
them. They are cited by name from ticket bodies, implement reports and review verdicts, and
`backlog/` is outside the chore role's write paths in any case.

**AC-8 — `harness lint` accepts the changed flow, in the shipped directory and in the templates.**
`node spike/bin/harness.js lint` exits 0 over both. The rule at risk is the convergence check —
*"loops back to X, which never receives Y — the loop cannot converge"* (`spike/src/lint.js:113–122`;
`packages/core/src/lint/lint.ts:236–242`) — which matches uninterpolated text with `globMatch`, where
`*` expands to `[^/]*` and `{`/`}` are escaped literally (`lint.js:23–26`): so
`review/chore/run-{run}/chore-iter-*.md` matches `review/chore/run-{run}/chore-iter-{iter}.md`. The
cross-vendor judge rule (`lint.js:105–107`) is unaffected, because the review step's inputs still
include `dev/implement-report.md`, written by the other adapter.

**AC-9 — the documentation says what the flow now does.**
`docs/02-sdlc-pipeline-spec.md` §5.8 — which today describes the chore route without naming any
review artifact — names the run-scoped path and states the rule: *a chore review artifact is named
by the run that wrote it, and a revise round reads its own run only*. The status line at the top is
bumped with the date and what changed. `docs/GLOSSARY.md` is untouched: "run" and "round" are both
already in use and no new term is introduced.

**AC-10 — the three obligations this ticket cannot discharge itself are named, not assumed.**
The implement report explicitly names (a) the decision entry this change implies — the implementer
does not write it, because `harness/roles/developer-generalist.md` forbids `docs/decisions/` and its
index; (b) the obligation Q-0052 inherits: when it ports the agent step's write loop into `core`, it
uses `vars.run` and does not reintroduce a ticket-scoped path named by a run-scoped counter; and (c)
that this branch changes `spike/src` while `harness/port-charter.md:243` still reads `freeze-sha:
not-yet-recorded`, so §3's table of tickets that may legitimately edit `spike/src` wants a Q-0057
row before the SHA is recorded. All three land in files the human owns, at the gate (§10).

---

## 5. Non-goals

- **Migrating, renaming or reconstructing any existing artifact**, including Q-0041's mixture and
  Q-0073's `chore-run2-iter-1.md`. They are evidence, they are cited by name, and `backlog/` is not
  a surface this flow's role may write.
- **Feeding all historical chore reviews into a later run.** Settled in §9, OQ-1.
- **Changing `review.yaml`.** Its `round-{round}` convention is ticket-scoped and correct;
  `reviewRound`'s contract — *a round is a directory with a verdict* — is not touched, generalised,
  or taught about chore artifacts.
- **A fallback.** No code path may write the legacy flat name, and none may silently omit a review
  when the run-scoped write fails; the existing explicit artifact-write error path stops the run.
  This is a non-goal rather than a criterion because there is no fallback to remove — it is a
  prohibition on adding one.
- **Provenance inside the document body.** The path is the provenance this ticket delivers; a
  content-schema change is a separate ticket (§9, OQ-3).
- **Every other flow's overwritten artifacts.** Real, evidenced, and deliberately out of scope —
  see §7.
- **A lock, or any concurrency guarantee.** Two simultaneous runs on one ticket receive the same
  `nextRunId` and would share a directory. That is Q-0039, and this change neither fixes nor worsens
  it: `reviewRound` has the identical weakness today.
- **`.harness/` scratch.** `.harness/<step>-verdict.json` (`spike/src/engine.js:313`) is still
  overwritten every iteration and every run; the raw dumps beside it are `Date.now()`-unique.
  `.harness/` is gitignored scratch, not the artifact of record.
- **Chore retry limits, backward-edge routing, gate policy, adapter selection, roles, prompts and
  verdict rules** — all unchanged except the implement step's review input path.
- **The chore flow's first-pass prerequisite** (§5.8's known gap), the `{iter}` counter's own
  semantics, and anything about what a review *says*.
- **Recording the port charter's freeze SHA.** Still `not-yet-recorded`, still skipped rather than
  passing; §3's list of tickets that must settle first is not changed by this ticket, only annotated
  per AC-10(c).

---

## 6. Sequencing, settled

**One change, landing in both trees together — the Q-0066 / Q-0068 / Q-0070 shape.**

The port freeze does not bind this ticket, and this is the disagreement between the two candidates.
`harness/port-charter.md` §3: *"No ticket in Q-0009's set — Q-0041 through Q-0054, and Q-0009 itself
— may modify or delete any file under `spike/src/`"*, and *"The freeze is a property of these fifteen
tickets, not of any role. `developer-generalist` may write `spike` and should — Q-0038 and Q-0040
are chore-shaped tickets whose whole subject is `spike/src`. That is why it is enforced on branch
names in CI rather than in a role's `paths`."* The machine-readable block at `:242` lists
`children: Q-0041 … Q-0054`. Q-0057 is not among them, so the branch-scope job reports it out of
scope rather than passing silently. Q-0038 is the precedent, merged 2026-08-30.

Waiting for the cutover is not neutral: the spike is what runs the flow today, so a `core`-only fix
would protect none of Q-0052, Q-0053 or Q-0054 — the exact three tickets this ticket exists to
protect. `core` must not keep the defect either, but its share is one variable and its JSDoc,
because the artifact write loop is not there yet (§8.5). That is the cleanest possible version of
"both trees": the spike gets the behaviour, `core` gets the primitive, and the ticket that ports the
write loop is told which variable to use.

**Files:** `spike/src/engine.js`, `packages/core/src/engine/engine.ts` (+ `types.ts` JSDoc),
`harness/flows/chore.yaml`, `spike/templates/harness/flows/chore.yaml`,
`docs/02-sdlc-pipeline-spec.md`, one new spike test, one core test case.

---

## 7. The class this does not fix, written out so it does not expire

Of the 19 write paths declared across the six shipped flows, **15 are fixed names**: only
`review.yaml`'s three `round-{round}` paths and `chore.yaml`'s one are parameterised. Every one of
the other 15 is overwritten by any second run of its flow on the same ticket —
`requirements/candidate-claude.md`, `requirements/merged.md`, `solution/solution.md`,
`solution/tasks.yaml`, `qa/scenarios.md`, `dev/implement-report.md`, `dev/integration.md`, and the
rest.

This has already been paid for once. Q-0051's requirements run 1 returned `ready`, cost **$7.27**,
and was aborted at its gate so Q-0038 could land first; its documents survived only because a human
moved them to `requirements/archive/run-1-aborted/` before run 2 started. That archive directory is
invisible to `readFiles`, which matches basenames inside the named directory only — the same
mechanism this ticket relies on, used by hand.

**Successor ticket body, ready to be opened at the gate:**

> **Every flow's artifacts are overwritten by a second run, not only chore's reviews.** Opened from
> Q-0057's requirements run. 15 of the 19 write paths declared across the six shipped flows are
> fixed names, so a second run of any flow on a ticket overwrites the first run's documents.
> Q-0057 fixed the chore flow's reviews and left the primitive behind: `{run}` is an interpolation
> variable in both trees, equal to `nextRunId`, so the mechanical part of the fix is a path change
> per write site. **The work is not mechanical, and that is why this is a separate ticket.**
> `requirements.yaml:23` feeds `requirements/merged.md` **back** to the head-of-product step, and
> `chore.yaml:13` and `review.yaml:27–28` read prior artifacts by fixed path, so making a write path
> run-scoped without moving the matching read path in the same change breaks the flow. Q-0051's
> requirements run is the measured precedent: a $7.27 document survived only because a human moved
> it by hand. Decide per artifact whether a later run should read the earlier one (`merged.md`: yes
> — the document is cumulative) or not (a review: no — Q-0057 settled that), and whether the
> *current* path stays as a stable "latest" alias beside the run-scoped copy, the way
> `review.yaml:32` already writes both `review/round-{round}/verdict.md` and `review/verdict.md`.
> Q-0057 put chore's reviews under `review/chore/run-N/`, naming the flow, so this ticket can add
> `requirements/run-N/` and the rest without a second rename. Belongs to M2.

---

## 8. What I re-measured, and what did not survive

Five claims from the ticket body and the two candidates were checked against `main`. Three change
the answer.

1. **Body: "`ctx.vars.iter += 1` on a backward edge — not ported."** **Wrong; it is ported.**
   `packages/core/src/engine/engine.ts:266` reads `context.vars.iter = Number(context.vars.iter) +
   1;`, on the intra-flow branch and not the cross-flow one, and `engine.test.ts:394`'s AC-6 case
   pins both halves — its comment names `chore.yaml`'s `review/chore-iter-{iter}.md` and **names
   Q-0057**. So all three engine surfaces are in both trees, and the body's *"genuinely mixed
   sequencing question — two surfaces want to land in both trees while the third exists in one tree
   only"* has no subject. It is an ordinary both-trees change. (Claude's finding, confirmed.)

2. **Body: "`spike/src` is still frozen for the port, which is the constraint the answer has to
   satisfy" / codex candidate AC-10, AC-11: land after cutover, do not modify `spike/src`.**
   **Struck.** The freeze binds the fifteen tickets named in §3, enforced on branch names against
   the `children` list at `port-charter.md:242`; Q-0057 is not among them. Accepting the codex
   candidate's sequencing would leave Q-0052, Q-0053 and Q-0054 running the defective flow for the
   remainder of the port — the precise exposure this ticket was opened to close. §6 states the
   evidence.

3. **Body / claude candidate: "`ctx.runId` is already allocated at `engine.js:49`."** It is at
   `:44`, and — the part arithmetic misses — it is allocated **inside the same object literal** as
   `vars` at `:50`, so it cannot be referenced from `vars` where it stands. Exposing it costs a
   hoist in the spike, not just a key. `core` already hoists (`engine.ts:134`).

4. **Claude candidate: "60 flat `chore-iter-N.md` files across 22 ticket folders."** Measured:
   **56 files across 21 folders**, plus Q-0073's one `chore-run2-iter-1.md`. AC-7 carries the
   corrected count.

5. **`core` cannot write a step artifact at all yet.** `runAgentStep` returns
   `unavailableStep(step, 'Q-0052')` (`routing.ts:54–55`). So "both trees together" here means the
   spike gets the behaviour, `core` gets the variable, and Q-0052 inherits the obligation — not that
   the same fix is written twice. This is why AC-1's core half is a spy assertion and not a file
   assertion.

Two supporting measurements neither candidate could have carried from the body: the defect recurred
on **2026-08-28** on Q-0073, recorded in that ticket's `runs.log:17` in the maintainer's own words;
and `readFiles`'s directory-literal / basename-glob split plus its `existsSync(dir)` early return
were read in both trees rather than assumed, because AC-3 and AC-4 both rest on them.

---

## 9. Open questions

**OQ-1 (answered — recorded so the gate can overturn it, not so it can be re-asked). Should a
revision round see only the current run's reviews, or every review the ticket has accumulated?**
**Only the current run's**, which is what AC-3 specifies. Both candidates land here independently,
and the maintainer already made this call in writing: Q-0073's `runs.log:17` says run 2's recovered
review was restored to a path *"deliberately outside chore.yaml:13's review/chore-iter-*.md glob so
a later round is fed run 3's review alone rather than a mixture of both."* Two supports. The channel
for a still-standing finding from an earlier run already exists and is already an input:
`requirements/errata.md` is listed at `chore.yaml:13` and kept there by AC-3, and *"An erratum is
the last repair, not the first"* (2026-08-30) is how a finding that survives a run gets into it. And
a stale review describes a diff that no longer exists — Q-0041's implementer had to open its report
by working out which of three reviews applied. Nothing is deleted either way: every earlier run's
directory stays on disk for the human. **The accepted cost, stated:** a finding left *only* in an
earlier run's review is no longer injected automatically. Recording it in `errata.md` is the
prescribed remedy and is the flow's existing behaviour, not new work.

**OQ-2 (decided in §3, gate may overturn; one string either way).** The path spelling is
`review/chore/run-{run}/chore-iter-{iter}.md`. Rationale in §3: the directory names the flow so
`run-3/` never sits beside `round-3/`, the basename is unchanged so existing citations and greps
still resolve, and §7's successor inherits a layout it can extend. Cheap now, expensive after the
first run writes into it.

**OQ-3 (deferred, not blocking).** Should a review document eventually carry run identity in its
body as well as its path? Owner: maintainer with the core maintainer. This ticket delivers
path-level provenance only; a content-schema change needs its own ticket, and the path is what the
next prompt actually shows (§3).

**OQ-4 (deferred to Q-0039, not blocking).** Two concurrent runs on one ticket compute the same
`nextRunId` and would write into the same directory, reproducing this defect. A preflight refusing
when `review/chore/run-{run}/` already exists at run start is tempting and is *new behaviour on a
shared path*, so it belongs with Q-0039. Recorded as risk 3 rather than assumed away.

**OQ-5 (out of scope, raised because it is adjacent).** `.harness/<step>-verdict.json` holds the
machine-readable findings list and is overwritten on every iteration *within* a run as well as
across runs. `.harness/` is gitignored scratch, so nothing durable is lost today — but if that
findings list ever becomes an input, it inherits this defect somewhere nobody is watching.
Maintainer owns; no action asked for.

**None of the five blocks solutioning.** OQ-1 is answered from the maintainer's own written
precedent, OQ-2 is decided, OQ-3 to OQ-5 are deferred with owners.

---

## 10. Cross-cutting checklist

| | |
| --- | --- |
| **BYOS** | n/a. No adapter, credential or environment change; `check()` untouched. |
| **Worktree safety** | Unchanged. Writes go through `backlog.writeFile`, which joins inside the ticket folder and creates parents; no flow writes the user's working tree; the review step is not a worktree step; `implement`'s branch and base are untouched. |
| **Gate behaviour** | Unchanged. Same gates, same `on_fail: { goto: implement, max_iterations: 2, on_exhausted: gate }`, same human gate, same `auto` behaviour. AC-5 proves the loop still converges rather than assuming it. |
| **File format / schema** | No schema change. `output.writes` is already a list of strings; `packages/shared`'s flow schema validates the six real flow files through `test/corpus.ts`, and the changed file must keep passing it. The *layout* of the ticket folder changes, which is what AC-9 documents. |
| **Lint rules** | No new rule. AC-8 pins that the existing convergence rule still passes, with the reason it does. Both `lintFlow` implementations are the same logic. |
| **Files are the database** | Preserved and strengthened: provenance lives in the ticket folder's own path structure. No daemon state, no registry, no second persisted counter. |
| **Cross-vendor** | `cross_vendor: required` unchanged; `implement` stays claude, `review` stays codex; the judged input `dev/implement-report.md` is unchanged. |
| **Cold-clone impact** | Two lines in the shipped template. No new step, command or concept in the first 30 minutes; a directory named after the run that wrote it is easier to explain than flat numbering that silently collides, not harder. |
| **Product-agnostic** | n/a. No product name appears. |
| **Decision entry** | Owed, and named rather than written (AC-10a). Proposed title: *"A review artifact is named by the run that wrote it"*. It records that the artifact of record lives in git while run history does not, that the path is the only place the engine can stamp identity because it writes the agent's document verbatim, and that a revise round reads its own run only. |

---

## 11. Risks

1. **A decision entry is a precondition no step in this flow may satisfy.** The chore role's prompt
   says *"You do not add to docs/decisions/ or its index; a decision is the human's to record."*
   This is the sixth-and-onward appearance of a loop spending its budget on work no agent in it can
   perform. AC-10 handles it the way Q-0070's requirement did — by **naming** the entry as a gate
   obligation, not by asserting the implementer will write it. If a reviewer raises the missing
   entry as a finding, that is an erratum, not a revise round.
2. **Three obligations must be discharged by a human, or they expire.** Q-0052's body must be told
   to port the write loop onto `vars.run` (AC-10b); §7's successor must be opened; and
   `port-charter.md` §3's table wants a Q-0057 row (AC-10c) so the freeze SHA can be recorded later
   without archaeology. `backlog/` is outside the role's write paths *and* the engine reverts agent
   edits under it, so the first two are gate actions; the third is a governance file the human
   curates. All three are written out here so none depends on anyone's memory.
3. **`{run}` inherits `nextRunId`'s weaknesses.** It derives from `runs.log` and
   `ticket.meta.history` (`spike/src/engine.js:769–777`), so two concurrent runs collide (OQ-4,
   Q-0039) and a hand-edited `runs.log` moves it. Neither is new: `reviewRound` reads the ticket
   folder with the same exposure. Accepted, stated, not silently assumed.
4. **Human discoverability changes.** New reviews are two directory levels deeper. Legacy files stay
   where they are, so a ticket folder will show both layouts for the rest of the project's life.
   AC-9's doc sentence is what makes that intentional rather than confusing.
5. **This document's own run can destroy its predecessor.** `requirements.yaml:12` writes
   `requirements/candidate-claude.md` — a fixed name, the very class §7 describes. Q-0051's
   `requirements/archive/run-1-aborted/` is the hand-made mitigation and the precedent to follow if
   this requirement is re-run.
6. **A first-round approve should be distrusted.** Q-0051's chore run closed on a first-round
   approve with an empty findings list, uncommon enough that its own entry records 42 of 59 chore
   reviews returning `revise`. The load-bearing criteria here are AC-5 and AC-8; if the review
   approves without evidence that the two-run test was executed *and shown red first*, and that
   `harness lint` exited 0 over both directories, re-check both by hand before the gate rather than
   taking the report's word for it.

---

## 12. Verification

1. `node spike/bin/harness.js lint` over `harness/flows/` and over
   `spike/templates/harness/flows/` — exit 0 (AC-8).
2. `diff harness/flows/chore.yaml spike/templates/harness/flows/chore.yaml` — exit 0 (AC-2).
3. `grep -rn '{run}' harness/flows spike/templates/harness/flows` before and after, recorded in the
   report (AC-2).
4. `npm install --prefix spike --no-audit --no-fund && npm test --prefix spike` — the full spike
   suite including the new two-run regression, which must be **shown failing against the unchanged
   flow file**, with the failure text quoted, before it is trusted against the changed one (AC-5).
   Note `harness/rules.md`: an agent's worktree has no dependencies until it installs them, and the
   npm form is mandated because a pnpm install ignoring `spike/package-lock.json` produces a
   different tree.
5. `pnpm install --frozen-lockfile && pnpm turbo run test --force && pnpm lint && pnpm typecheck` —
   `--force`, because a replayed pass is not a verdict (*"The test command defeats its own cache"*,
   2026-08-27).
6. Steps 4 and 5 run in **both environment rows** — in the integrate worktree, which has neither
   `.harness/worktrees` nor `.quorum/runs`, and again on `main` after the merge, where both exist
   (Q-0072's closing finding, and the rule Q-0073 closed).

---

## 13. Provenance

**From the claude candidate, kept:** the diagnosis that the defect is a run-scoped counter naming a
ticket-scoped path rather than anything wrong with `{iter}`; the observation that the engine writes
the document verbatim so the *path* is the only place it can stamp identity (§3); the correction
that `iter += 1` is ported and the body's mixed-sequencing question therefore has no subject (§8.1);
the reading of the port charter that settles sequencing (§6, §8.2); the `runId`-inside-the-literal
hoist (§8.3); the `readFiles` directory-literal / basename-glob mechanism that AC-3 and AC-4 rest
on; the `globMatch` reasoning behind AC-8; the Q-0073 recurrence; §7's successor body and Q-0051's
$7.27 precedent; and risks 1, 2, 5 and 6.

**From the codex candidate, kept:** the path spelling `review/chore/run-{run}/…`, which names the
flow (§3, OQ-2); the explicit iteration-behaviour criterion (AC-6), which the claude candidate
folded into its regression test and which is worth pinning on its own; the legacy-only-ticket
clause of AC-4 — a ticket carrying only flat reviews must start a new run cleanly, which no other
candidate stated and which is the whole of the migration story; the requirement that the implement
step keep receiving `errata.md` (AC-3), which is what makes OQ-1's answer safe rather than lossy;
the no-fallback prohibition and the run-identity-in-body question (§5, OQ-3); and the
historical-context-not-injected cost, stated in OQ-1 rather than buried.

**From the codex candidate, struck.** Its AC-10 and AC-11 — land after the port cutover, do not
modify `spike/src` — are refuted by the charter's own §3 and would leave Q-0052, Q-0053 and Q-0054
exposed for the remainder of the port (§6, §8.2). Its AC-14 and AC-15 (existing tests stay green;
the prescribed commands pass) are the verification section, not criteria, and are §12. Its AC-16 to
AC-20 (files-are-the-database, worktree safety, gate behaviour, cross-vendor, BYOS and product
scope) assert that nothing changed on surfaces this ticket does not touch; they are §10's checklist.
Twenty-one criteria on a six-file change reads as thoroughness at the gate and costs a reviewer a
round each — that trim, and nothing about its substance, is why this document has ten.

**Mine, and in neither candidate:** the OQ-2 decision rather than a deferral, with the `run-3`
beside `round-3` argument and the grep-continuity argument; AC-5's note that a second run needs the
stage back at `consumes`, with the abort-at-exhaustion shape that produces it — a detail that would
otherwise be found halfway through writing the test; AC-10(c), the port-charter §3 row; and the
corrected legacy count of 56 files across 21 folders (§8.4).
