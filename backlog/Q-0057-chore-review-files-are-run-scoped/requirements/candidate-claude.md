# Q-0057 — A chore run's reviews overwrite the previous run's, and the survivors mix

*Requirement, product-manager candidate. Written 2026-08-30 against `main` at `23dfce1`. Every
line number below was re-derived at that commit; where it disagrees with the ticket body, §7 says
so and shows the measurement.*

---

## 1. Problem

The chore flow's review step writes `review/chore-iter-{iter}.md` (`harness/flows/chore.yaml:34`).
`{iter}` is `ctx.vars.iter`, set to `1` when a **run** starts (`spike/src/engine.js:50`;
`packages/core/src/engine/engine.ts:138`) and incremented once per backward-edge traversal
(`spike/src/engine.js:180`; `packages/core/src/engine/engine.ts:266`). The counter is run-scoped;
the path it names is ticket-scoped. Every second run of the chore flow on a ticket therefore
restarts at `chore-iter-1.md` and writes over the previous run's file.

The defect is not that `{iter}` is run-scoped. It is that a run-scoped counter is the only thing
naming a ticket-scoped path.

**It has happened at least twice, and the second time was after the ticket was written.**

| ticket | what happened |
| --- | --- |
| Q-0041 (2026-08-25) | run 2 wrote `-1`, `-2`, `-3`; run 3 wrote `-1`, `-2` over them. On disk now: `-1` (21:39) and `-2` (22:02) are run 3's, `-3` (20:55) is run 2's orphan. Run history agrees — `.quorum/runs/Q-0041-2/steps/{002,004,006}-review/output.txt` at 20:27/20:42/20:55, `Q-0041-3/steps/{002,004}-review` at 21:39/22:02. |
| Q-0073 (2026-08-28) | run 2's review was itself a hand recovery from a raw dump after the nit/approve contradiction stopped the run; run 3's review then overwrote it. `runs.log` records the recovery: run 2's file was restored from blob `7f3068b` to `review/chore-run2-iter-1.md`, *"deliberately outside `chore.yaml:13`'s `review/chore-iter-*.md` glob so a later round is fed run 3's review alone rather than a mixture of both."* |

Two costs, and they are different costs.

**The artifact of record is destroyed.** `backlog/` is the database and it is in git; `.quorum/` is
in `.gitignore` (line 2, confirmed with `git check-ignore -v`). So the overwritten review survives
only in the run history on the machine that ran it — never in a clone, never on CI, never for a
second maintainer. Q-0041's run-2 review that found the union-fallthrough major exists in git only
because a human committed it at `e6b31b7` before run 3 started. Nothing in the product preserved
it, and *"files are the database"* (`harness/rules.md`, Architecture) is the rule it broke.

**The survivors are fed back mixed.** `chore.yaml:13` lists `review/chore-iter-*.md` among the
implement step's inputs, so a revise round is handed whatever files happen to be on disk — on
Q-0041 run 3 that was run 3's `-1` beside run 2's orphaned `-2` and `-3`: reviews of different
code, from different runs, with nothing in the files saying which. That implementer coped and said
so in its report; the next one may not.

**Why now.** Three children of Q-0009 still run this flow — Q-0052, Q-0053, Q-0054 — down from the
thirteen the original finding named, and each one that exhausts and is re-run loses a review. The
flow outlives the port, and the same two shipped copies (`harness/flows/chore.yaml` and
`spike/templates/harness/flows/chore.yaml`, byte-identical today: `diff` exits 0) are what
`harness init` gives a cold-clone adopter.

---

## 2. User stories

- **`maintainer`.** I re-run a chore ticket after an erratum. I want every review the ticket has
  ever received to still be on disk afterwards, each one in a place that says which run produced
  it, so that when I reconstruct why a decision was taken I read files rather than compare mtimes
  against `runs.log`.
- **`maintainer`.** When a revise round starts, I want the implementer to see this run's reviews
  and only this run's, so it spends its budget on findings about the code it is holding rather
  than on working out which of three reviews describes a branch that no longer exists.
- **`adopter`.** I copy the shipped chore flow with `harness init` and run it twice on my first
  ticket. I want the second run not to silently delete the first run's evidence, and I do not want
  to be the one who discovers that it does.

**Surfaces touched:** `harness/` (both copies of `chore.yaml`), the CLI's engine in **both trees**
(`spike/src/engine.js`, `packages/core/src/engine/engine.ts`), and `docs/`. No server, no UI.

---

## 3. The shape, and the two it beats

The engine writes the agent's document **verbatim** — `backlog.writeFile(ticket,
interpolate(rel, ctx.vars), res.output.document ?? res.raw)` (`spike/src/engine.js:308–310`). It
never adds a header, so **the path is the only place the engine can stamp run identity**, and the
path is what the next prompt shows: `## Input: backlog/<folder>/<rel>`
(`spike/src/engine.js:730`). A run-scoped path answers the ticket's *"the files need to say which
run wrote them"* for both readers — the human and the next implementer — with no new engine
behaviour.

**Recommended: the ticket's own shape 1.** Expose the already-allocated run id as `{run}`, and
write `review/run-{run}/chore-iter-{iter}.md`, feeding back
`review/run-{run}/chore-iter-*.md`.

It costs one hoist and one key per tree. `runId` already exists in both: `spike/src/engine.js:44`
allocates it *inside the same object literal* as `vars`, so it must be hoisted to a `const` first;
`packages/core/src/engine/engine.ts:134` is already a `const`, so `core` is one key. The number is
the one already in `runs.log` as `run=N` and already naming `.quorum/runs/<id>-<N>/`, so
`review/run-3/chore-iter-1.md` joins by inspection to `run=3`'s cost line and to
`.quorum/runs/Q-0073-3/steps/002-review/output.txt`. And `{run}` is a general primitive: §6's
successor needs exactly it for every other flow, which none of the alternatives provide.

**Rejected — shape 2/4, the zero-code round directory.** `review/round-{round}/chore-iter-{iter}.md`
plus a `review/round-{round}/verdict.md` would work with no engine change at all: `{round}` is
`reviewRound`, which is ticket-scoped, and writing a `verdict.md` is what makes it advance
(`spike/src/engine.js:778–785`; `packages/core/src/engine/loaders.ts:63–76`). Both `readFiles`
implementations and both `globMatch` implementations accept it. It is rejected because the
numbering would then depend on a marker file whose only purpose is to advance a counter, with
nothing guarding it — a later edit that drops the `verdict.md` write silently restores this exact
defect; because it makes `reviewRound` count chore rounds, changing a contract `review.yaml`
depends on; because `verdict.md` would be a byte copy of the last iteration's review; and because
`round-N` never names the run, so the `runs.log` and `.quorum/runs/` joins stay a manual exercise.

**Rejected — shape 3, a chore-only ticket-scoped counter.** New engine state, in both trees, that
answers less than `{run}` does: it distinguishes rounds but still does not name the run, and it is
not reusable by §6.

---

## 4. Acceptance criteria

Each is independently testable. `spike/test/run.js` auto-discovers `test/*.js` (verified at
`spike/test/run.js:16–18`), so a new `spike/test/q0057-*.js` needs no registration.

**AC-1 — the engine exposes the run id as `{run}`, in both trees.**
`ctx.vars.run` (spike) and `vars.run` (core) equal the value `nextRunId(ticket)` returned for that
run — the same number the run's `runs.log` lines carry as `run=N` and the same one naming
`.quorum/runs/<ticket-id>-<N>/`. In the spike this requires hoisting `runId` out of the `ctx`
object literal (`spike/src/engine.js:44`) before `vars` (`:50`); in `core` it is one key on the
literal at `engine.ts:137–139`, and `types.ts`'s JSDoc for `vars` — which today names *"`base` and
`iter` among them"* — names it too.
*Test (spike):* a mock-adapter run of a flow whose step declares `writes: ["x/run-{run}.md"]`, on a
ticket whose `runs.log` already ends at `run=2`, creates `x/run-3.md`, and that run's own
`runs.log` lines say `run=3`.
*Test (core):* a unit assertion beside the existing `engine.test.ts` AC-6 case, which already
observes `context.vars.iter` through a `routing.runStep` spy and already names Q-0057 in its
comment. Core cannot test the write: `runAgentStep` returns `unavailableStep(step, 'Q-0052')`
(`packages/core/src/engine/routing.ts:54–55`).

**AC-2 — no shipped flow changes meaning.**
`grep -rn '{run}' harness/flows spike/templates/harness/flows` returns nothing at the start of the
change (measured 2026-08-30: no hits), and `interpolate` leaves unknown placeholders untouched
(`packages/core/src/engine/loaders.ts:52`), so before AC-1 a `{run}` would have shipped as literal
text. The implement report records that grep and its result.

**AC-3 — the chore flow's review artifact is run-scoped, in both shipped copies.**
`harness/flows/chore.yaml`'s review step writes `review/run-{run}/chore-iter-{iter}.md`, and
`spike/templates/harness/flows/chore.yaml` is **byte-identical** to it afterwards (`diff` exits 0,
as it does today). No other step, flow or template file changes.

**AC-4 — a revise round sees this run's reviews and no others.**
The implement step's `input.backlog` matches `review/run-{run}/chore-iter-*.md` in place of
`review/chore-iter-*.md`. `readFiles` treats the directory part as a literal and the basename as
the glob (`spike/src/backlog.js:74–82`; `packages/core/src/backlog/backlog.ts:180–189`), so this
matches this run's directory only.
*Test:* a two-run mock scenario where run 3's second implement step's prompt contains
`## Input: backlog/<folder>/review/run-3/chore-iter-1.md` and contains no `review/run-2/` path and
no legacy `review/chore-iter-` path.

**AC-5 — the first implement of a run is fed no chore review, even when earlier runs' directories
exist.** `readFiles` returns `[]` when the interpolated directory is absent — the early
`existsSync` guard on the dirname — so run 4's first implement receives nothing from `run-3/`.
*Test:* asserted on the prompt, not on the return value of a helper.

**AC-6 — two runs never overwrite, and the loop still converges.**
*Test (the regression this ticket exists for):* one mock-adapter test that runs the chore-shaped
flow twice on one ticket — run 1 taking a backward edge so it writes two reviews, run 2 writing one
— then asserts: three review files exist across two directories; run 1's two files are
byte-identical to what run 1 wrote, read after run 2 finished; and run 1's second implement step
was fed run 1's first review. The same test fails against `HEAD`'s flow file, and the report says
so with the failure text rather than claiming it.

**AC-7 — `harness lint` accepts the changed flow, in the shipped directory and in the templates.**
`node spike/bin/harness.js lint` exits 0 over both. The rule at risk is the convergence check —
*"loops back to X, which never receives Y — the loop cannot converge"* (`spike/src/lint.js:115–121`;
`packages/core/src/lint/lint.ts:236–242`) — which matches uninterpolated text with `globMatch`,
where `*` expands to `[^/]*`: `review/run-{run}/chore-iter-*.md` matches
`review/run-{run}/chore-iter-{iter}.md`. The cross-vendor judge rule is unaffected, because the
review step's inputs still include `dev/implement-report.md`, written by the other adapter.

**AC-8 — legacy artifacts are left exactly as they are.**
The 60 flat `review/chore-iter-N.md` files across 22 ticket folders, and Q-0073's
`review/chore-run2-iter-1.md`, are not moved, renamed, rewritten or deleted, and no new glob reads
them. They are cited by name from ticket bodies, implement reports and review verdicts (for
example `backlog/Q-0072-…/dev/implement-report.md:11`), and `backlog/` is outside the chore role's
write paths in any case.

**AC-9 — the documentation says what the flow now does.**
`docs/02-sdlc-pipeline-spec.md` §5.8 names the run-scoped review path and states the rule that a
chore review artifact is named by the run that wrote it; the status line at the top is bumped with
the date and what changed. No new term is introduced, so `docs/GLOSSARY.md` is untouched — "run"
and "round" are both already in use.

**AC-10 — the two obligations this ticket cannot discharge itself are named, not assumed.**
The implement report explicitly names (a) the decision entry this change implies — the implementer
does not write it, because `harness/roles/developer-generalist.md` forbids `docs/decisions/` and
its index — and (b) the obligation Q-0052 inherits: when it ports the agent step's write loop into
`core`, it uses `vars.run` and does not reintroduce a ticket-scoped path named by a run-scoped
counter. Both land in files only the human may write, at the gate (§8).

---

## 5. Non-goals

- **Migrating, renaming or reconstructing any existing artifact.** Including Q-0041's mixture and
  Q-0073's `chore-run2-iter-1.md`. They are evidence, they are cited by name, and `backlog/` is not
  a surface this flow's role may write.
- **Changing `review.yaml`.** Its `round-{round}` convention is ticket-scoped and correct
  (`spike/src/engine.js:778–785`); `reviewRound`'s contract — *a round is a directory with a
  verdict* — is not touched, generalised, or taught about chore artifacts.
- **Every other flow's overwritten artifacts.** Real, evidenced, and deliberately out of scope —
  see §6.
- **A lock, or any concurrency guarantee.** Two simultaneous runs on one ticket receive the same
  `nextRunId` and would share a directory. That is Q-0039, and this change neither fixes nor
  worsens it: `reviewRound` has the identical weakness today.
- **`.harness/` scratch.** `.harness/<step>-verdict.json` (`spike/src/engine.js:313`) is still
  overwritten every iteration and every run, and the raw dumps beside it are `Date.now()`-unique.
  `.harness/` is gitignored scratch, not the artifact of record.
- **The chore flow's first-pass prerequisite** (`docs/02-sdlc-pipeline-spec.md` §5.8's known gap),
  the `{iter}` counter's own semantics, and anything about what a review *says*.
- **Recording the port charter's freeze SHA.** Still `not-yet-recorded`, still skipped rather than
  passing; §3's list of tickets that must settle first is unchanged by this one.

---

## 6. The class this does not fix, written out so it does not expire

Of the 19 write paths declared across the six shipped flows, **15 are fixed names**: only
`review.yaml`'s three `round-{round}` paths and `chore.yaml`'s one are parameterised. Every one of
the other 15 is overwritten by any second run of its flow on the same ticket —
`requirements/candidate-claude.md`, `requirements/merged.md`, `solution/solution.md`,
`solution/tasks.yaml`, `qa/scenarios.md`, `dev/implement-report.md`, `dev/integration.md`, and the
rest.

This has already been paid for once. Q-0051's requirements run 1 returned `ready`, cost **$7.27**,
and was aborted at its gate so Q-0038 could land first; its three documents were preserved only
because a human moved them to `requirements/archive/run-1-aborted/` before run 2 started. The
archive directory is invisible to `readFiles`, which matches basenames inside the named directory
only — the same mechanism this ticket relies on, used by hand.

**Successor ticket body, ready to be opened at the gate:**

> **Every flow's artifacts are overwritten by a second run, not only chore's reviews.** Opened from
> Q-0057's requirements run. 15 of the 19 write paths declared across the six shipped flows are
> fixed names, so a second run of any flow on a ticket overwrites the first run's documents.
> Q-0057 fixed the chore flow's reviews and left the primitive behind: `{run}` is an interpolation
> variable in both trees, equal to `nextRunId`, so the mechanical part of the fix is a path change
> per write site. **The work is not mechanical, and that is why this is a separate ticket.**
> `requirements.yaml:23` feeds `requirements/merged.md` **back** to the head-of-product step, and
> `chore.yaml:13` and `review.yaml:27–28` read prior artifacts by fixed path, so making the write
> path run-scoped without moving the read path in the same change breaks the flow. Q-0051's
> requirements run is the measured precedent: a $7.27 document survived only because a human moved
> it to `requirements/archive/run-1-aborted/` by hand. Decide per artifact whether a later run
> should read the earlier one (`merged.md`: yes — the document is cumulative) or not (a review: no
> — Q-0057 settled that), and whether the *current* path stays as a stable "latest" alias beside
> the run-scoped copy, the way `review.yaml:32` already writes both `review/round-{round}/verdict.md`
> and `review/verdict.md`. Belongs to M2.

---

## 7. What I re-measured, and where the ticket body is now wrong

The body was last re-derived on 2026-08-30 (`23dfce1`). Three of its claims did not survive being
checked, and two of the three change the answer.

1. **"`ctx.vars.iter += 1` on a backward edge — not ported."** It is ported.
   `packages/core/src/engine/engine.ts:266` reads
   `context.vars.iter = Number(context.vars.iter) + 1;`, on the intra-flow branch and not the
   cross-flow one, and `engine.test.ts`'s AC-6 case pins both halves — its comment names
   `chore.yaml`'s `review/chore-iter-{iter}.md` and **names Q-0057**. So all three engine surfaces
   are in both trees, and the body's *"genuinely mixed sequencing question — two surfaces want to
   land in both trees while the third exists in one tree only"* has no subject. It is an ordinary
   both-trees change.

2. **"`spike/src` is still frozen for the port, which is the constraint the answer has to
   satisfy."** The freeze does not bind this ticket. `harness/port-charter.md` §3: *"The freeze is
   a property of these fifteen tickets, not of any role… That is why it is enforced on branch names
   in CI rather than in a role's `paths`."* The machine-readable block lists
   `children: Q-0041 … Q-0054`; Q-0057 is not among them, so the branch-scope job reports it out of
   scope rather than passing silently. This is Q-0038's position exactly — a chore-shaped ticket
   whose subject *is* `spike/src`, merged 2026-08-30. The SHA-anchored half is
   `freeze-sha: not-yet-recorded` and skipped.

3. **"`ctx.runId` is already allocated at `engine.js:49` and would need exposing as a var."**
   It is at `:44`, and — the part the arithmetic misses — it is allocated **inside the same object
   literal** as `vars` at `:50`, so it cannot be referenced from `vars` where it stands. Exposing it
   costs a hoist in the spike, not just a key. `core` already hoists (`engine.ts:134`).

Two further measurements the body could not have carried:

4. **The defect recurred on 2026-08-28**, three days after the ticket was written, on Q-0073 — and
   the recovery is the strongest evidence for §8's answer to the open question.

5. **`core` cannot write a step artifact at all yet.** `runAgentStep` returns
   `unavailableStep(step, 'Q-0052')` (`routing.ts:54–55`). So "both trees together" here means the
   spike gets the behaviour, `core` gets the variable, and Q-0052 inherits the obligation — not
   that the same fix is written twice.

---

## 8. Open questions

**OQ-1 (answered — recorded here so the gate can overturn it, not so it can be re-asked). Should a
revision round see only the current run's reviews, or every review the ticket has accumulated?**
**Only the current run's**, which is what AC-4 specifies. Three pieces of evidence. (a) The
maintainer already made this call in writing: Q-0073's `runs.log` note says run 2's recovered
review was restored to a path *"deliberately outside `chore.yaml:13`'s glob so a later round is fed
run 3's review alone rather than a mixture of both."* (b) The channel for a still-standing finding
from an earlier run already exists and is already an input: `requirements/errata.md` is listed at
`chore.yaml:13`, and *"An erratum is the last repair, not the first"* (2026-08-30) is how a
finding that survives a run gets there. (c) A stale review describes a diff that no longer exists;
Q-0041's implementer had to open its report by working out which of three reviews applied. Nothing
is deleted either way — every earlier run's directory stays on disk for the human.

**OQ-2 (naming, low stakes, cheap at the gate and expensive after).** `review/run-{run}/chore-iter-{iter}.md`
is the ticket's own spelling and this document's recommendation. `review/chore-run-{run}/iter-{iter}.md`
would say which flow wrote the directory, which matters once §6's successor gives other flows
run-scoped paths and `review/` holds `round-N/` and `run-N/` side by side. Maintainer decides at
the gate; the criteria above are unchanged by the choice.

**OQ-3 (deferred, with a recommendation).** Two concurrent runs on one ticket compute the same
`nextRunId` and would write into the same directory, reproducing this defect. A cheap preflight —
refuse when `review/run-{run}/` already exists at run start — is tempting and is *new behaviour on
a shared path*, so it belongs with **Q-0039** rather than here. Recommend deferring; recorded as a
risk in §10 rather than assumed away.

**OQ-4 (out of scope, raised because it is adjacent).** `.harness/<step>-verdict.json` holds the
machine-readable findings list and is overwritten on every iteration *within* a run as well as
across runs. `.harness/` is gitignored scratch, so nothing durable is lost today — but if the
findings list ever becomes an input, it inherits this ticket's defect in a place nobody is
watching. Maintainer owns; no action asked for.

**Owner for all four: the maintainer, at the requirements gate.** None is blocking: OQ-1 is
answered from precedent, OQ-2 changes one string, OQ-3 and OQ-4 are explicitly deferred.

---

## 9. Cross-cutting checklist

| | |
| --- | --- |
| **BYOS** | n/a. No adapter, credential or environment change; `check()` untouched. |
| **Worktree safety** | Unchanged. Writes go through `backlog.writeFile`, which joins inside the ticket folder; no flow writes the user's working tree; the review step is not a worktree step. |
| **Gate behaviour** | Unchanged. Same gates, same `on_fail: { goto: implement, max_iterations: 2, on_exhausted: gate }`, same human gate. AC-6 proves the loop still converges rather than assuming it. |
| **File format / schema** | No schema change. `output.writes` is already a list of strings; `packages/shared`'s flow schema validates the six real flow files through `test/corpus.ts`, and the changed file must keep passing it. The *layout* of the ticket folder changes, which is what AC-9 documents. |
| **Lint rules** | No new rule. AC-7 pins that the existing convergence rule still passes, with the reason it does (`globMatch`'s `*` → `[^/]*`). Both `lintFlow` implementations are the same code. |
| **Cold-clone impact** | Two lines in the shipped template. No new step, no new command, no new concept a newcomer meets in the first 30 minutes; the directory they find their reviews in is named after the run that wrote it, which is easier to explain than the current flat numbering, not harder. |
| **Product-agnostic** | n/a. No product name appears. |
| **Decision entry** | Owed, and named rather than written (AC-10). Proposed title: *"A review artifact is named by the run that wrote it"*. It records that the artifact of record lives in git while run history does not, that the path is the only place the engine can stamp identity because it writes the agent's document verbatim, and that a revise round reads its own run only. |

---

## 10. Risks

1. **A decision entry is a precondition no step in this flow may satisfy.** The chore role's own
   prompt says *"You do not add to `docs/decisions/` or its index; a decision is the human's to
   record."* This is the sixth-and-onward appearance of a loop spending its budget on work no agent
   in it can perform. AC-10 handles it the way Q-0070's requirement did — by **naming** the entry
   as an obligation for the human at the gate, not by asserting the implementer will write it. If a
   reviewer raises the missing entry as a finding, that is an erratum, not a revise round.
2. **Two ticket bodies must be edited by a human, or two obligations expire.** Q-0052 must be told
   to port the write loop onto `vars.run` (AC-10b), and §6's successor must be opened. `backlog/`
   is outside the role's write paths *and* the engine discards agent edits under it, so both are
   gate actions. Written out in full here so that neither depends on anyone's memory.
3. **`{run}` inherits `nextRunId`'s weaknesses.** It derives from `runs.log` and `ticket.meta.history`
   (`spike/src/engine.js:769–777`), so two concurrent runs collide (OQ-3, Q-0039) and a
   hand-edited `runs.log` can move it. Neither is new: `reviewRound` reads the ticket folder with
   the same exposure. Accepted, stated, not silently assumed.
4. **One more `spike/src` edit before the freeze SHA is recorded.** Permitted (§7.2) and small, but
   charter §3 must be able to say the base acquired no unauthorised `spike/src` change after the
   freeze. Q-0057 is not in the list of tickets §3 says must settle first; adding a change the list
   does not mention is worth one line in the implement report so the SHA can be recorded later
   without archaeology.
5. **This document's own run can destroy its predecessor.** `requirements.yaml:12` writes
   `requirements/candidate-claude.md` — a fixed name. If this requirement is re-run, this file is
   overwritten, by the very class of defect §6 describes. Q-0051's `requirements/archive/run-1-aborted/`
   is the hand-made mitigation and the precedent to follow if it happens.
6. **A first-round approve should be distrusted.** Q-0051's chore run closed on a first-round
   approve with an empty findings list — uncommon enough that its own entry records 42 of 59 chore
   reviews to date returned `revise`. The load-bearing criteria here are AC-6 and AC-7; if the
   review approves without evidence that the two-run test was executed and that `harness lint`
   exited 0 over both directories, re-check both by hand before the gate rather than taking the
   report's word for it.

---

## 11. Sequencing, settled

The ticket asks for this first, and it is now a short answer.

**One change, landing in both trees together — the Q-0066 / Q-0068 / Q-0070 shape.** The freeze
does not apply (§7.2). The spike is what runs the flow today, so a `core`-only fix would protect
none of Q-0052, Q-0053 or Q-0054. `core` must not keep the defect either, but its share is one
variable and its JSDoc, because the artifact write loop is not there yet (§7.5) — which is the
cleanest possible version of "both trees": the spike gets the behaviour, `core` gets the primitive,
and the ticket that ports the write loop is told which variable to use.

Files: `spike/src/engine.js`, `packages/core/src/engine/engine.ts` (+ `types.ts` JSDoc),
`harness/flows/chore.yaml`, `spike/templates/harness/flows/chore.yaml`,
`docs/02-sdlc-pipeline-spec.md`, one new spike test, one core test case.

## 12. Verification

1. `node spike/bin/harness.js lint` over `harness/flows/` and over
   `spike/templates/harness/flows/` — exit 0 (AC-7).
2. `diff harness/flows/chore.yaml spike/templates/harness/flows/chore.yaml` — exit 0 (AC-3).
3. `npm install --prefix spike --no-audit --no-fund && npm test --prefix spike` — the full spike
   suite including the new two-run regression, which must be shown failing against the unchanged
   flow file before it is trusted against the changed one (AC-6).
4. `pnpm install --frozen-lockfile && pnpm turbo run test --force && pnpm lint && pnpm typecheck`
   — `--force`, because a replayed pass is not a verdict (*"The test command defeats its own
   cache"*, 2026-08-27).
5. Run 3 and 4 in **both environment rows** — in the integrate worktree, which has neither
   `.harness/worktrees` nor `.quorum/runs`, and again on `main` after the merge, where both exist
   (Q-0072's closing finding, and the rule Q-0073 closed).
6. `grep -rn '{run}' harness/flows spike/templates/harness/flows` before and after, recorded in the
   report (AC-2).
