# Q-0038 — Deferred-range failures name their producing step in every case

*Requirement candidate (claude), 2026-08-30. Route: chore (`requirements → chore → human gate`).
Milestone M2. Not a child of Q-0009 — see §Sequencing.*

**Every file position in this document was re-read from the file on 2026-08-30**, after Q-0077
shifted `spike/src/engine.js` on 2026-08-29. The ticket body's own instruction applies to this
document as well: re-derive from the file, never from this paragraph.

---

## Problem

A run's diff preflight exists so that no vendor is paid to read evidence that is not there. It
classifies **ranges**, and the thing that can be absent is an **endpoint**. That mismatch is the
whole ticket, and it has been paid for twice.

`spike/src/engine.js:133` asks one question of a range — *does either endpoint get created by an
earlier step of this flow?* — with a single `.find()` over both. One `yes` defers the range whole.
`chore.yaml:32` reviews `harness/{id}/integration...harness/{id}/implement`: the right endpoint is
created by the `implement` step, so the left endpoint is never looked at, even though it is an
ordinary pre-existing ref that a run could check for free before spending anything. On the night
Q-0035 was implemented, `harness/Q-0035/integration` did not exist, `harness run chore Q-0035
--dry` printed a clean four-step preview, and the real run billed **$13.86** to `implement` before
`review` failed on the missing left endpoint. Q-0035's AC-8 promises zero adapter invocations for
pre-existing-ref ranges and its AC-9 accepts earliest-possible for deferred ones; a range holding
one of each is covered by neither. *Q-0035 accepted: a check that skips its subject must not report
success* (2026-08-25) records that as the **timing** half and hands it to this ticket by name.

The same asymmetry has a second face, found for free by the round-3 reviewer on the other vendor.
When a deferred range fails at step time, `spike/src/engine.js:825` adds the producer clause only
when `deferred?.ref === ref` — only when the endpoint that failed is the one a step owed. If the
*other* endpoint is the bad one, the message drops the producer entirely and the reader is told a
branch is missing without being told which step was being waited on and why the range was deferred
at all. That is the **diagnosis** half.

A third defect lives in the same eighteen lines and is folded in here rather than revisited in a
fortnight. `spike/src/engine.js:793` resolves the effective base as `ctx.vars.base ??
ctx.config.repo?.base_branch ?? 'main'`, and `engine.js:50` sets `vars.base` from the `--base`
override when one is given. So under an override the effective base *is* the override — and
`:829` still throws `repo.base_branch in harness/harness.yaml names missing ref "<base>"`. A
maintainer who typed `harness run review Q-0050 --base 0f1e40d` against a revision that does not
resolve is sent to a configuration file that does not contain the value. `--base` shipped with
Q-0077 on 2026-08-29; this message was written for Q-0035 and the two never met.

All three are one function's tail and one preflight block. Closing them separately means opening
the same eighteen lines three times.

---

## User stories

**Maintainer.** As a solo maintainer starting a chore run on a ticket whose integration branch does
not exist yet, I want the run to refuse before it spawns anything, naming the branch that is
missing — so that a knowably absent ref costs me nothing instead of $13.86 and twenty-three
minutes.

**Maintainer.** As a maintainer reading a failure from a range the run deferred, I want to be told
which step was being waited on and which ref it owed, whichever endpoint turned out to be bad — so
that I can tell *the implementer produced nothing* from *a branch I never created* without
re-reading the flow file.

**Maintainer.** As a maintainer reviewing a merged ticket with `--base <ref>`, I want an
unresolvable revision to be blamed on the flag I typed, not on `harness/harness.yaml` — so that I
fix the argument instead of editing a file whose value was never used.

**Cold-clone adopter.** As someone running Quorum for the first time, I want `--dry` to refuse what
a real run would refuse, so that a clean preview is evidence and not silence.

---

## Surfaces

| Surface | Touched | What |
| --- | --- | --- |
| `spike/src/engine.js` | **yes** | the preflight block `:113–142`, and `materialiseDiff`'s endpoint loop `:811–832`. `runFlow`'s context literal at `:50` gains one field. |
| `spike/test/` | **yes** | one new file, plus one authorised edit to `q0035-empty-range.js` (AC-5) and new scenarios in `q0077-base-flag.js`. `spike/test/run.js` auto-discovers, so nothing registers a new file. |
| `docs/02-sdlc-pipeline-spec.md` §5.5 | **yes** | the "Ranges divide into two classes" paragraph at `:360` is now false as written. |
| `docs/GLOSSARY.md` | **yes** | the **Preflight** entry's first sentence, one clause. No new term is coined. |
| `packages/core/**` | **no** | there is no diff subsystem there yet. See §Sequencing. |
| `contracts/`, `backlog/`, `harness/flows/`, `harness/harness.yaml`, `.github/` | **no** | see §Non-goals and OQ-2. |
| `docs/decisions/` and its index | **no** | ruled in OQ-1. `docs/06-development-plan.md` is the human's at close — see §Non-goals. |

Every surface named above is inside the chore role's `paths`
(`harness/roles/developer-generalist.md:3` — `spike`, `harness`, `docs`, …). `contracts/` is
**not**, and `docs/decisions/` is forbidden to the role by its own prose. No criterion below names
either, which is *"A requirement may not name a surface its flow cannot write"* (2026-08-25) and
*"`.claude/rules/` is a derived copy"* (2026-08-27) applied before the run rather than discovered at
round three.

---

## Positions, re-read 2026-08-30

| Subject | Position |
| --- | --- |
| preflight block (comment `:91`, body `:113–142`) | `spike/src/engine.js:113` |
| `createdSoFar` map / `remember` | `:118` / `:119` |
| the per-task template skip | `:132` |
| **the wholesale `.find()`** | **`:133`** |
| deferral recorded / range materialised | `:134` / `:135` |
| `vars.base` set from the override | `:50` |
| `diffSitesOf` / `materialiseDiff` | `:781` / `:790` |
| effective base | `:793` |
| range guard | `:804–806` |
| `deferred` lookup | `:811` |
| endpoint loop | `:815–832` |
| **the diagnosis ternary** | **`:825`** |
| base / integration / generic throws | `:829` / `:830` / `:831` |
| `emptyRangeFailure` | `:865`, its own deferred clauses at `:871`, `:880`, `:893` |
| `harness lint`'s static `input.diff` rule | `spike/src/lint.js:49`, `:81–83` |
| the fixture that pins the configured-base wording | `spike/test/q0006-engine.js:117`, `:120`; its sibling negative at `:130` |

The ticket body is right that `:825` is the only site conditioned on `deferred?.ref === ref`:
`:871`, `:880` and `:893` are all conditioned on `deferred` alone and already name the producing
step whichever endpoint went bad. **There is no general asymmetry to hunt for.** Half 1 is one
clause in one array literal.

---

## What this requirement settles before the implementer starts

### D-1. The rule is one sentence: the preflight's guarantee is per endpoint, not per range

Both halves are the same fix stated once. An endpoint is classified on its own, and the range's
treatment follows from its endpoints rather than the other way round. This replaces the two-class
model `docs/02-sdlc-pipeline-spec.md:360` describes, which is why that paragraph is in scope.

### D-2. Half 2 does not subsume half 1, and half 1 is not dead code

Once each endpoint is judged on its class, the $13.86 shape — a missing pre-existing endpoint on a
deferred range — fails in the preflight and never reaches `:825`. What still reaches `:825` with a
non-null `deferred` is a range whose non-deferred endpoint resolved at preflight and **stopped
resolving during the run**: the base branch deleted or force-moved between the preflight and the
consuming step. Rarer, not gone. A change that closes half 2 and calls half 1 solved would be
wrong, and AC-4 exists to stop exactly that.

### D-3. The wording of half 1's new clause is decided here, because a landed fixture already forbids the obvious one

`q0035-empty-range.js` E16(a) asserts, on the very shape this ticket is about:

```js
assert.doesNotMatch(err.message, /was expected to create harness\/\S*\/integration/,
  `no step owed the integration branch: ${err.message}`);
```

That is correct and stays. **No step owed the endpoint that failed, so none may be blamed for it** —
crediting the deferring step there would be the same overstatement Q-0035 exists to remove, one
field along. So the new clause attributes *the deferral*, not *the failure*: it names the producing
step and the ref **that step** owed, which is the other endpoint. The reviewer's own words ask for
exactly this — *"keeps the distinction about which endpoint is missing and adds the deferred
producer and the ref it was expected to create"*.

### D-4. The relatedness guard's timing does not move

`materialiseDiff`'s guard at `:804–806` stays where it is, so a deferred range's *shape* is still
checked at step time by the engine. It is checked before the run by `harness lint`
(`spike/src/lint.js:81`) for every flow loaded through `loadFlow`, which is every real run; the
engine's copy is the backstop for a flow smuggled past lint, and `q0034-chore-preflight.js` C3 is
that scenario. Moving it is a fourth change to the same lines for no measured gain.

### D-5. Q-0051's aborted D-5 is superseded, and the sequencing constraint is mutual

`backlog/Q-0051-core-engine-diff-preflight/requirements/merged.md` (2026-08-30, $7.274, aborted at
its gate) rules the `.find()` **preserved** as a defect, and adds *"Q-0038 must not be landed on
`spike/src/engine.js` while this child is in flight."* That is why Q-0051 was aborted and this
ticket goes first. Its eight-clause description of the preflight under AC-9 is the most careful one
in the repository and was verified against the files before the abort: read it, do not re-derive
it. Its D-5 is the one section this ticket makes obsolete. Folding that into Q-0051's ticket body
is a human act at this ticket's gate — OQ-4.

### D-6. No decision entry is owed

*Q-0035 accepted: a check that skips its subject must not report success* (2026-08-25) describes
the wholesale deferral as a hole and says **"Q-0038 owns closing them together."** Closing it is
what that entry asks for, so nothing is contradicted and no reversal entry is needed; the numbered
doc that states the guarantee is a living document, edited in place under AC-10. This matters
beyond bookkeeping: a criterion naming `docs/decisions/` is a precondition **no step in the chore
flow may satisfy** (`harness/roles/developer-generalist.md:23`), which is what turned Q-0070 into a
hand-run ticket after a loop exhausted at a limit of 1. Ruled here so it cannot be re-opened at
round two. See OQ-1 for the reading that would overturn it.

---

## Acceptance criteria

Eleven, each independently testable. Size was weighed: eleven is at the upper end of the
2026-08-22 sizing decision and is accepted because most of the work is fixtures, the code is
roughly thirty lines in two places, and splitting the preflight from the diagnostic would put two
tickets inside one function.

### AC-1 — An endpoint, not a range, decides what the preflight checks

In the preflight block (`spike/src/engine.js:113–142`), each endpoint of an interpolated range is
classified independently:

- **(a) step-created** — the ref is in `createdSoFar`, i.e. an earlier *group* of this flow creates
  it. Unchanged, including the strictly-earlier rule: a parallel sibling's branch is concurrent,
  not earlier, and a ref only a **later** step creates is deliberately *not* class (a).
- **(b) unresolved template** — after interpolation the endpoint still contains `{…}`. **This class
  exists only where the site is a `fan_out` step's `step:` template** (`perTask`, `:132`). An outer
  step's unresolved range is class (c) and must still fail exactly as it does today.
- **(c) pre-existing** — everything else, including a ref a later step creates.

The range is materialised into `ctx.diffInputs` only when **both** endpoints are (c) — unchanged.
When either endpoint is (a) or (b), the range is still not materialised, **and every class-(c)
endpoint it has is required to resolve now.** A class-(c) endpoint that does not resolve stops the
run inside the preflight, before any adapter is invoked, keeping clause 8 of Q-0051's AC-9: the
first failing range stops the run even when another distinct range was valid.

`ctx.deferredDiffs` is written exactly when an endpoint is class (a) **and** the range carries no
unresolved `{…}`. A half-interpolated key can never be looked up at step time, so recording one
would be a record nothing reads.

*Test:* a chore-shaped flow — `implement` (worktree, `branch: harness/{id}/implement`) then a
diff-bearing `review` over `harness/{id}/integration...harness/{id}/implement` — run against a
repository where the ticket branch **does not exist**. `runFlow` rejects with a `FlowError`;
`adapterCalls(...)` (read from the run manifest, as `q0035-empty-range.js:344` does) is `[]`; the
message matches `/review requires an integrated branch/`. The paired negative is what makes it
discriminating: the *same* flow with the ticket branch present must still complete, so a fix that
refuses everything fails here.

### AC-2 — A step-created endpoint still defers, and is never materialised early

A range with a class-(a) endpoint stays deferred **even when that ref already exists at run
start** — a second chore round, where `harness/{id}/implement` survives from round 1. Bytes
captured before the producing step ran are that step's *previous* output presented as its current
one, which is a worse failure than the one this ticket fixes.

*Test:* create both branches before the run, and use the `principal-architect` role the mock
adapter actually writes a file for (`q0034-chore-preflight.js:40` says why). The run completes and
the reviewer's `prompt.txt` — read from run history via the `adapterPrompts` helper shape at
`q0035-empty-range.js:357` — carries the file `implement` wrote **during this run**. Had the
preflight materialised the range early, the range would have been empty at preflight and the run
would have failed there, so this assertion cannot pass by accident.

### AC-3 — The preflight's failure names the deferral without misreporting it

When the preflight refuses a partially deferred range, the message keeps every property Q-0035
established: the identifying phrase for its endpoint class (`repo.base_branch …` /
`review requires an integrated branch` / `input.diff names missing ref`), which endpoint failed
(`left`/`right`), the range as interpolated **and** as written in the flow file, and the closing
`Neither the diff nor the containment check was run.` It invents no containment outcome and is
clean against `q0035-empty-range.js:33`'s `FORBIDDEN` regex.

**The one clause that must be new:** the still-uncreated endpoint may not be reported as one that
*"does not resolve either"* (`:824`), because it is not supposed to resolve yet. It is described as
not yet created, naming the step that will create it — e.g. *"the right endpoint
harness/Q-0038/implement is not created until step \"implement\" runs"*. Reporting a
not-yet-produced branch as an unresolvable one is the same category error, in the same message,
that the diagnosis half exists to remove.

*Test:* AC-1's fixture, asserting each clause; plus `doesNotMatch(/does not resolve either/)`.

### AC-4 — Half 1: a deferred range that fails on its other endpoint at step time names the producing step and the ref it owed

`:825`'s ternary becomes two clauses that are never conflated:

- the failing endpoint **is** the deferred one → the existing wording, verbatim and unchanged:
  `step "<id>" was expected to create <ref>`. E16(b) matches it as
  `/step "build" was expected to create harness\/\S*\/build/` and is not edited.
- the failing endpoint is the **other** one → a new clause naming the producing step and the ref
  *that step* owed, which is the endpoint that did not fail. It must not read as a claim that the
  step owed the failing ref: the literal `was expected to create <failing ref>` may not appear
  (D-3).

*Test:* at the unit level, calling the exported `materialiseDiff(step, ctx)` with a hand-built
context — the route `q0077-base-flag.js:31` and `q0035-empty-range.js` E5 already use — whose
`deferredDiffs` holds `{ ref: <right>, step: 'implement' }`, with the right endpoint present and
the left absent. Stated at unit level deliberately: the run-level shape needs a ref to vanish
*between* the preflight and the consuming step, which no fixture can stage without inventing a step
kind, and the run-level half of this behaviour is AC-1's. The implement report says which level
each criterion was proved at rather than implying both.

### AC-5 — Q-0035's E16(a) is re-cut, deliberately, and everything it still pins survives

`q0035-empty-range.js` E16(a) currently asserts that the producing adapter **ran** and the
consuming one did not, on precisely the shape AC-1 now refuses for free. It is a landed guard from
another ticket and this requirement authorises the edit rather than leaving a review loop to decide
whether a guard is finished — the Q-0072 E-1/E-2 lesson.

Two assertions change: `assert.ok(calls.includes('implement'))` becomes
`assert.deepEqual(calls, [])`, and the assertion that the message quotes the short SHA of the
endpoint that resolves is **removed**, because `harness/<id>/implement` is now never created and
the test's own `git rev-parse --short` would throw. Everything else survives unedited and is
enumerated so the diff can be checked against this list: the `/review requires an integrated
branch/` phrase, `left endpoint`, the complete interpolated range, `Neither the diff nor the
containment check was run`, `FORBIDDEN`, `doesNotMatch(/contained/)`, and — load-bearing —
`doesNotMatch(/was expected to create harness\/\S*\/integration/)`. Its comment says what changed
and why, citing this criterion. **E16(b), E11, E12, E15, E17 and `q0034-chore-preflight.js`
C1/C1b/C2/C3 are not edited**; each of them creates the ticket branch before the run, or uses a
fully pre-existing range, so none is affected.

### AC-6 — `--dry` refuses what a real run refuses

`harness run chore <id> --dry` on a ticket whose integration branch does not exist fails with
AC-3's message and zero adapter invocations, instead of printing a clean preview. This is *"skipped
is not passed"* (2026-08-25, rule 1) reaching the case that produced the rule. The deferred-range
**placeholder** path (`spike/src/engine.js:721`) is unchanged: a dry run still must not demand
branches only a paid run produces, and E12 and C1b prove it, unedited.

### AC-7 — Under `--base`, an unresolvable revision is blamed on the flag

When the failing endpoint is the effective base **and** the run was given `--base`, the message
names the override and the revision supplied, and contains neither `repo.base_branch` nor
`harness/harness.yaml`. `ctx.vars.base` cannot answer this — `engine.js:50` sets it
unconditionally — so `runFlow` records the raw override on the run context (it already destructures
`base = null` at `:37`) and `materialiseDiff` reads it, **treating an absent field as no override**
so that the hand-built contexts in `q0077-base-flag.js:31` and `q0006-engine.js` keep working
untouched. If `--base` names the same value as `repo.base_branch`, the flag is still what is
named: the maintainer typed it, and that is where the value came from.

*Test:* a new scenario in `spike/test/q0077-base-flag.js` — B1–B5 all use a real revision or none,
so this adds a scenario rather than changing one, which is the cheapest shape a message fix can
have.

### AC-8 — The configured-base diagnostic is unchanged

With no override in force, the message is byte-identical to today's.
`spike/test/q0006-engine.js:117–120` — which drives the failure from `f.config.repo.base_branch =
'missing-base'` and asserts `/repo\.base_branch/i`, `/harness[\/]harness\.yaml/` and
`/missing-base/` together — **passes without being edited**, and `:130`'s assertion that the
sibling integration-branch message does *not* mention `repo.base_branch` stays true. A diff that
touches either line fails this criterion.

### AC-9 — Valid evidence, and the rest of the subsystem, are untouched

For a range whose endpoints all resolve, behaviour is unchanged: each distinct interpolated range
is materialised **once**, every panel member and every wave member receives identical bytes, and
truncation, `max_diff_bytes` and the UTF-8 suffix trim are unaffected. `emptyRangeFailure`'s
wording, its four outcomes and its deferred clauses at `:871`, `:880` and `:893` are not touched.
The range guard's message is not touched. `harness lint`'s rule is not touched.

*Test:* E8, E11, E15, E17 and the whole mock-adapter end-to-end suite stay green with no edit.

### AC-10 — The documents say the new rule, in the two places that state the old one

`docs/02-sdlc-pipeline-spec.md` §5.5's *"Ranges divide into two classes"* paragraph (`:360`) is
rewritten in prose, not bullets: the classification is per endpoint; a range is materialised before
the first step when both endpoints pre-exist; a range with a step-created endpoint is still
deferred, **and its pre-existing endpoints are checked at run start anyway**, so a missing one
costs nothing; the earliest-possible guarantee still covers what the deferred endpoint alone can
prove. The `fan_out` template paragraph at `:362` gains the same qualification. The status line at
`:3` is bumped with the date and what changed, per the docs rules.

`docs/GLOSSARY.md`'s **Preflight** entry says what it now guarantees per endpoint. **No new term is
coined and no synonym is introduced** — "preflight", "deferred", "endpoint" and "range" are used as
they already are.

### AC-11 — One tree, and both suites verified forced by the implementer

`spike/**` is the only code touched; `packages/core/**` is not opened (see §Sequencing). The
implement report states, per environment row, that `pnpm install --frozen-lockfile` and `npm
install --prefix spike --no-audit --no-fund` were run first, and reports **`npm test --prefix
spike`** and **`pnpm turbo run test --force`** with their counts. A suite reported as unrun is
honest; one reported green without installing is not, and a reviewer cannot tell an uninstalled
suite from a red one (`harness/rules.md`). The forced flag is not decoration: a worktree resolves
turbo's cache to the main checkout's, so an unforced run can replay a verdict it never computed —
*"The test command defeats its own cache"* (2026-08-27).

---

## Non-goals

- **The two neighbours.** *The chore flow cannot run on a ticket's first pass* is not fixed here —
  no `harness lint` rule is added for it, and `chore.yaml` is not reordered. This ticket only makes
  it fail for **$0 with a clear message** instead of for $13.86, which is the honest scope of a
  diagnostic-and-timing fix. *`budget.per_run_usd` stops nothing* is untouched: still `10` at
  `harness/harness.yaml:14`, still typed at `packages/shared/src/project.ts:88`. Both still want
  their own tickets.
- **`packages/core`.** No file under `packages/**` is created or edited. Q-0051 ports the fixed
  version.
- **Moving the relatedness guard** (D-4), and **changing `harness lint`'s rule** — including any
  new static rule about deferred ranges.
- **Materialising a deferred range early**, even when its endpoint happens to exist (AC-2).
- **`emptyRangeFailure`'s four outcomes, its remedies and its wording.** The empty-range diagnostic
  is Q-0035's and is finished.
- **`contracts/`.** Not writable by this flow and not amended — see OQ-2.
- **`docs/decisions/` and its index** (D-6), and **`docs/06-development-plan.md`**, whose Q-0038
  entry is rewritten by the human at close with the run's cost and gate outcome, as every other
  entry was.
- **Recording the SHAs a run diffed** (Q-0035 OQ-2) — a persisted-format change against a frozen
  contract.
- **Changing what `--base` *does*.** It moves the diff anchor and nothing else; only the message
  changes.
- **Q-0039, Q-0040, and `finish()`'s rollback.** A run that refuses in the preflight still takes
  the existing terminal-audit path, unchanged.
- **Anything on the v1 exclusion list**: multi-user, remote daemon, cloud sync, plugin marketplace,
  visual canvas, eval suites, another adapter, desktop shell.

---

## Open questions

None blocks the run. Each is ruled, with the reasoning, so it is not re-opened at round two.

**OQ-1 — Does closing the wholesale deferral owe a `docs/DECISIONS.md` entry? — RULED: no.**
*Owner: ruud, may overrule at the gate.* The 2026-08-25 entry names the hole and hands it to
Q-0038, so closing it contradicts nothing, and the guarantee's prose lives in a numbered doc that
is edited in place. The reading that would overturn this is that *"the guarantee is per endpoint,
not per range"* is a general rule worth recording beside *"skipped is not passed"*. If ruud takes
that reading, **the entry is written by hand and is not an acceptance criterion** — the chore role
may not write `docs/decisions/`, and making it a criterion is what exhausted Q-0070's loop at a
limit of 1 for a precondition no step in the flow could satisfy.

**OQ-2 — Does AC-7 contradict the frozen `contracts/Q-0006/review-runtime.contract.md`? — RULED:
no.** *Owner: ruud.* Its §Diff input says *"A missing base ref is an error naming
`repo.base_branch`, `harness/harness.yaml`, and the ref."* That clause was written when `{base}`
was defined, two paragraphs above it, as *the resolved base branch* from configuration; `--base`
shipped three weeks later and the contract was not amended. AC-7 changes the message only on the
path the contract does not describe, and AC-8 pins the path it does. No `contracts/` edit is
proposed — the file is outside the chore role's `paths`, so a criterion naming it could not be
satisfied. If ruud reads the clause as absolute, the route is an erratum, as Q-0073's E-4 was.

**OQ-3 — Should class (b), the unresolved `fan_out` template, be judged per endpoint too? —
RULED: yes, and it is inside AC-1.** *Owner: ruud, strikeable at the gate.* The ticket body's words
are about deferral, and the template skip is a second, separate wholesale skip with the same shape:
`harness/{id}/integration...harness/{id}/{task.id}` has one endpoint that is knowably checkable and
is skipped whole. Ruling it in makes the code **smaller**, because one classification replaces two
special cases. No shipped flow is affected — only `chore.yaml` and `review.yaml` carry an
`input.diff` today, and neither is a template. If struck, AC-1's clause (b) reverts to the existing
`continue` at `:132` and nothing else in this document changes. **The `perTask` binding is not
strikeable either way**: generalising the placeholder skip to outer steps would silently delete a
failure they get today.

**OQ-4 — Who supersedes Q-0051's D-5? — RULED: the human, at this ticket's gate.** *Owner: ruud.*
`backlog/` is not writable by this flow, and a requirements run cannot read a sibling's folder — so
an obligation left only in this document dies when Q-0051's requirements run is repeated. It is
recorded here as a handover: **fold into Q-0051's ticket body** that its aborted merged
requirement's D-5 is obsolete, that the `.find()` it ruled preserved no longer exists, and that
AC-9's eight clauses need re-deriving against the fixed file. Q-0051's body already carries the
*Sequencing against Q-0038* section this attaches to.

**OQ-5 — Does the preflight's new per-endpoint check need its own `--dry` branch? — RULED: no.**
It must run identically in both modes, which is AC-6. There is no `if (dry)` in the preflight block
today and none is added.

---

## Risks

1. **This ticket changes the machinery its own run uses.** After the merge, a chore run on a ticket
   whose `harness/<id>/integration` does not exist refuses in the preflight. Charter §8's first
   checklist item already says to create that branch by hand before a child's first chore run, and
   thirteen children have. During *this* ticket's own run the risk is nil — the CLI imports
   `runFlow` from the main checkout at run start, not from the implementer's worktree — but the
   next ticket's run inherits the new behaviour. Create `harness/Q-0038/integration` before the
   first run, as always.
2. **A landed guard from another ticket is edited** (AC-5). Mitigated by enumerating the assertions
   that must survive, so the reviewer checks a list rather than forming an opinion. The edit is
   authorised here and nowhere else; any *other* change to `q0035-empty-range.js` is out of scope
   and a finding.
3. **A fix that refuses too much.** Making the preflight stricter can break a legitimate deferred
   range — the second-round chore case, where both branches exist. AC-1's paired negative and AC-2
   exist for this, and E11/E15/E17/C1 are the standing witnesses.
4. **The `--base` provenance field is a new context field** and every hand-built fixture context
   lacks it. AC-7 requires an absent field to mean *no override*; a fix that reads it unguarded
   turns seven passing unit scenarios red for the wrong reason — the Q-0066 shape, where
   `probeAdapter` dereferenced a deliberate null.
5. **`spike/**` is outside ESLint entirely** (`harness/rules.md`), so nothing in that tree detects
   a deprecated API or a type error. Read the code, not the tick.
6. **A green `integrate` tick is worktree-scoped.** Verify both suites forced on `main` after the
   merge, not from the tick — Q-0072's merged, reviewed, integrate-green change failed on `main`.
7. **The port freeze.** Q-0038 is **not** in charter §3's `children` list, so branch
   `harness/Q-0038/*` is out of the branch-scope guard and the guard says so rather than passing
   silently; §3's table names this ticket as one of five that must land before `freeze-sha` can be
   recorded at `harness/port-charter.md:243`. Recording that SHA is **not** part of this ticket —
   four of the five are still open.

---

## Sequencing

**This is a one-tree change, and this is the last moment it can be.** `packages/core` has no diff
subsystem: Q-0051 has not run, so there is no ported twin to keep in step and none of the
Q-0066 / Q-0068 *"lands in both trees together"* cost applies. Every landed port child is
untouched. After Q-0051 lands, the same fix is two trees, two suites and a divergence risk.

**It must be contained in `main` before Q-0051's requirements run is repeated** — the reason
Q-0051's run was aborted at its gate on 2026-08-30. Q-0051 then ports the fixed version.

---

## Cross-cutting checklist

| | |
| --- | --- |
| **BYOS** | n/a — no adapter, no login, no environment variable is touched. No code path, test or example gains a key. |
| **Worktree safety** | n/a — nothing new is written anywhere. The preflight reads refs; the change adds `git rev-parse` calls and removes none. No flow writes to the user's working tree. |
| **Gate behaviour** | Unchanged. No gate becomes `auto`, no `human-locked` gate is touched, no exhaustion gate is added or removed. A preflight refusal fails the run exactly as it does today, through the same terminal-audit path. |
| **File format and schema** | Unchanged. Nothing under `.quorum/`, `backlog/` or `contracts/` changes shape; no zod schema in `packages/shared` is touched. `ctx` gains one in-memory field, which is not a persisted format. |
| **Lint rules** | Unchanged. `harness lint`'s static `input.diff` rule (`spike/src/lint.js:81`) keeps its wording and its coverage; every shipped flow still lints clean. |
| **Cold-clone impact** | Positive and small. A first run whose integration branch is absent now stops in seconds with a message naming the branch, instead of spending a subscription's worth of tokens and failing later; `--dry` says the same thing for free. Nothing is added to the first 30 minutes. |
| **Cross-vendor rule** | Unchanged — `chore.yaml` keeps `cross_vendor: required`, claude implements and codex reviews. |
| **Product-agnostic** | Unchanged — no product name appears in any message, test or document. |

---

## Provenance

Composed from Q-0038's ticket body (including its 2026-08-30 hand-written re-derivation) and read
against: `spike/src/engine.js`; `spike/src/lint.js`; `spike/test/q0035-empty-range.js`,
`q0034-chore-preflight.js`, `q0006-engine.js`, `q0077-base-flag.js`, `run.js`;
`harness/flows/chore.yaml` and `review.yaml`; `harness/roles/developer-generalist.md`;
`harness/harness.yaml`; `harness/port-charter.md` §3;
`docs/decisions/044-q-0035-accepted-a-check-that-skips-its-subject.md`;
`backlog/Q-0035-empty-range-diagnostic/requirements/merged.md` AC-8/AC-9/OQ-1;
`backlog/Q-0051-core-engine-diff-preflight/requirements/merged.md` D-5 and AC-9;
`contracts/Q-0006/review-runtime.contract.md`; `docs/02-sdlc-pipeline-spec.md` §5.5;
`docs/GLOSSARY.md`.

**Three things this document found that the ticket body does not say.** E16(a)'s negative assertion
already forbids the naive phrasing of half 1's fix and admits the correct one, which is why D-3 is
decided rather than delegated. E16(a)'s *positive* assertions pin the billed-then-fail behaviour
half 2 removes, so a landed guard from another ticket must be re-cut — AC-5, authorised here rather
than argued in review. And the unresolved-template skip at `:132` is bound to `perTask` for a
reason: a fix that generalises the classification without keeping that binding deletes a failure an
outer step still gets today.
