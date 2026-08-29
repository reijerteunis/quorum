# Q-0038 — Deferred-range failures name their producing step in every case

*Merged requirement, 2026-08-30. Route: chore (`requirements → chore → human gate`). Milestone M2.
Not a child of Q-0009 — see §Sequencing.*

**Every file position in this document was re-read from the file on 2026-08-30**, after Q-0077
shifted `spike/src/engine.js` on 2026-08-29. The ticket body's own instruction applies here too:
re-derive from the file, never from this paragraph.

---

## Problem

A run's diff preflight exists so that no vendor is paid to read evidence that is not there. It
classifies **ranges**, and the thing that can be absent is an **endpoint**. That mismatch is the
whole ticket, and it has been paid for twice.

`spike/src/engine.js:133` asks one question of a range — *does either endpoint get created by an
earlier step of this flow?* — with a single `.find()` over both. One `yes` defers the range whole.
`chore.yaml:32` reviews `harness/{id}/integration...harness/{id}/implement`: the right endpoint is
created by the `implement` step, so the left endpoint is never looked at, even though it is an
ordinary pre-existing ref a run could check for free before spending anything. On the night Q-0035
was implemented `harness/Q-0035/integration` did not exist, `harness run chore Q-0035 --dry`
printed a clean preview, and the real run billed **$13.86** to `implement` before `review` failed
on the missing left endpoint. Q-0035's AC-8 promises zero adapter invocations for pre-existing-ref
ranges and its AC-9 accepts earliest-possible for deferred ones; a range holding one of each is
covered by neither. *Q-0035 accepted: a check that skips its subject must not report success*
(2026-08-25) records this as the **timing** half and hands it to this ticket by name.

**The money was not merely unprotected — it was spent against the wrong base.** `ensureWorktree`
(`spike/src/git.js:20–21`) resolves a step's declared `base:` and, when the ref does not exist,
cuts the worktree from `HEAD` instead. `chore.yaml:10` declares `base: "harness/{id}/integration"`,
so on that night the implementer was not stopped by the missing branch: it was quietly given a
worktree from somewhere else and paid to work in it. That is a second silent default, under a rule
that forbids them, and it is **not** this ticket (D-7) — but it is why the preflight is the only
layer that can stop the spend, and it must be stated so nobody fixes it in passing.

The same asymmetry has a second face, found for free by the round-3 reviewer on the other vendor.
When a deferred range fails at step time, `spike/src/engine.js:825` adds the producer clause only
when `deferred?.ref === ref` — only when the endpoint that failed is the one a step owed. If the
*other* endpoint is the bad one, the message drops the producer entirely and the reader is told a
branch is missing without being told which step was being waited on, or why the range was deferred
at all. That is the **diagnosis** half.

A third defect lives in the same eighteen lines and is folded in here rather than revisited in a
fortnight. `spike/src/engine.js:793` resolves the effective base as `ctx.vars.base ??
ctx.config.repo?.base_branch ?? 'main'`, and `:50` sets `vars.base` from the `--base` override when
one is given. So under an override the effective base *is* the override — and `:829` still throws
`repo.base_branch in harness/harness.yaml names missing ref "<base>"`. A maintainer who typed
`harness run review Q-0050 --base 0f1e40d` against a revision that does not resolve is sent to a
configuration file that never supplied the value. `--base` shipped with Q-0077 on 2026-08-29; this
message was written for Q-0035 and the two never met.

All three are one preflight block and one function's tail. Closing them separately means opening
the same eighteen lines three times.

---

## User stories

**Maintainer.** As a solo maintainer starting a chore run on a ticket whose integration branch does
not exist yet, I want the run to refuse before it spawns anything, naming the branch that is
missing — so that a knowably absent ref costs me nothing instead of $13.86 and a worktree cut from
the wrong commit.

**Maintainer.** As a maintainer reading a failure from a range the run deferred, I want to be told
which step was being waited on and which ref it owed, whichever endpoint turned out to be bad — so
that I can tell *the implementer produced nothing* from *a branch I never created* without
re-reading the flow file.

**Maintainer.** As a maintainer reviewing a merged ticket with `--base <ref>`, I want an
unresolvable revision blamed on the flag I typed, not on `harness/harness.yaml` — so that I fix the
argument instead of editing a file whose value was never used.

**Cold-clone adopter.** As someone running Quorum for the first time, I want `--dry` to refuse what
a real run would refuse, so that a clean preview is evidence and not silence.

---

## Surfaces

| Surface | Touched | What |
| --- | --- | --- |
| `spike/src/engine.js` | **yes** | the preflight block `:113–142`, `materialiseDiff`'s endpoint loop `:815–832`, and one field on `runFlow`'s context literal at `:50`. |
| `spike/test/` | **yes** | new scenarios, one authorised edit to `q0035-empty-range.js` (AC-6), new scenarios in `q0077-base-flag.js`. `spike/test/run.js:16` auto-discovers, so nothing registers a new file. |
| `docs/02-sdlc-pipeline-spec.md` §5.5 | **yes** | the *"Ranges divide into two classes"* paragraph at `:360` is false as written after this change; `:362`'s template paragraph gains the same qualification; the status line at `:3` is bumped. |
| `docs/GLOSSARY.md` | **yes** | the **Preflight** entry (`:83`), one clause. No new term is coined. |
| `spike/src/git.js` | **no** | D-7. `ensureWorktree`'s `HEAD` fallback is evidence here and a neighbour, not scope. |
| `packages/core/**` | **no** | there is no diff subsystem there yet. See §Sequencing. |
| `contracts/`, `backlog/`, `harness/flows/`, `harness/harness.yaml`, `.github/` | **no** | see §Non-goals and OQ-2. |
| `docs/decisions/` and its index | **no** | ruled in D-6/OQ-1. `docs/06-development-plan.md` is the human's at close. |

Every surface marked **yes** is inside the chore role's `paths`
(`harness/roles/developer-generalist.md:3` — `spike`, `harness`, `docs`, …). `contracts/` is not,
and `docs/decisions/` is forbidden to the role by its own prose (`:23`). **No criterion below names
either** — *"A requirement may not name a surface its flow cannot write"* (2026-08-25) and
*"`.claude/rules/` is a derived copy"* (2026-08-27), applied before the run rather than discovered
at round three.

---

## Positions, re-read 2026-08-30

| Subject | Position |
| --- | --- |
| preflight block (comment `:91`, body `:113–142`) | `spike/src/engine.js:113` |
| `createdSoFar` / `remember` | `:114` / `:119` |
| the per-task template skip | `:132` |
| **the wholesale `.find()`** | **`:133`** |
| deferral recorded / range materialised | `:133` / `:135` |
| `vars.base` set from the override | `:50` |
| `diffSitesOf` / `materialiseDiff` | `:781` / `:790` |
| effective base | `:793` |
| relatedness guard | `:804–806` |
| `deferred` lookup / endpoint loop | `:811` / `:815–832` |
| **the diagnosis ternary** | **`:825`** |
| base / integration / generic throws | `:829` / `:830` / `:831` |
| `emptyRangeFailure` and its deferred clauses | `:865`; `:871`, `:880`, `:893` |
| script step dispatch | `:199` |
| `ensureWorktree`'s `HEAD` fallback | `spike/src/git.js:20–21` |
| `harness lint`'s static `input.diff` rule | `spike/src/lint.js:49`, `:81–83` |
| the fixture pinning the configured-base wording | `spike/test/q0006-engine.js:117`, `:120`; its sibling negative at `:130` |
| the guard this ticket re-cuts | `spike/test/q0035-empty-range.js` E16 at `:621` |

`:825` is the **only** site conditioned on `deferred?.ref === ref`. `:871`, `:880` and `:893` are
conditioned on `deferred` alone and already name the producing step whichever endpoint went bad.
**There is no general asymmetry to hunt for.** Half 1 is one clause in one array literal.

---

## What this requirement settles before the implementer starts

### D-1. The rule is one sentence: the preflight's guarantee is per endpoint, not per range

Both halves are the same fix stated once. An endpoint is classified on its own, and the range's
treatment follows from its endpoints rather than the other way round. This replaces the two-class
model `docs/02-sdlc-pipeline-spec.md:360` states, which is why that paragraph is in scope.

### D-2. Half 2 does not subsume half 1, and half 1 is not dead code

Once each endpoint is judged on its class, the $13.86 shape — a missing pre-existing endpoint on a
deferred range — fails in the preflight and never reaches `:825`. What still reaches `:825` with a
non-null `deferred` is a range whose non-deferred endpoint resolved at preflight and **stopped
resolving during the run**: the base deleted or force-moved between the preflight and the consuming
step. Rarer, not gone. A change that closes half 2 and calls half 1 solved would be wrong, and AC-5
exists to stop exactly that.

### D-3. The wording of half 1's new clause is decided here, because a landed fixture already forbids the obvious one

`q0035-empty-range.js` E16(a) asserts, on the very shape this ticket is about:

```js
assert.doesNotMatch(err.message, /was expected to create harness\/\S*\/integration/,
  `no step owed the integration branch: ${err.message}`);
```

That is correct and stays. **No step owed the endpoint that failed, so none may be blamed for it** —
crediting the deferring step there is the same overstatement Q-0035 exists to remove, one field
along. So the new clause attributes *the deferral*, not *the failure*: it names the producing step
and the ref **that step** owed, which is the other endpoint. The reviewer's own words ask for
exactly this — *"keeps the distinction about which endpoint is missing and adds the deferred
producer and the ref it was expected to create."*

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
ticket goes first. Its eight-clause description of the preflight under its AC-9 is the most careful
one in the repository and was verified against the files before the abort: **read it, do not
re-derive it.** Its D-5 is the one section this ticket makes obsolete. Folding that into Q-0051's
ticket body is a human act at this ticket's gate — OQ-3.

### D-6. No decision entry is owed

*Q-0035 accepted: a check that skips its subject must not report success* (2026-08-25) names the
wholesale deferral as a hole and says **"Q-0038 owns closing them together."** Closing it
contradicts nothing, and the guarantee's prose lives in a numbered doc edited in place under AC-11.
This matters beyond bookkeeping: a criterion naming `docs/decisions/` is a precondition **no step in
the chore flow may satisfy** (`harness/roles/developer-generalist.md:23`), which is what turned
Q-0070 into a hand-run ticket after a loop exhausted at a limit of 1. Ruled here so it cannot be
re-opened at round two. See OQ-1 for the reading that would overturn it.

### D-7. The `HEAD` fallback in `ensureWorktree` is evidence, not scope

`spike/src/git.js:20–21` cuts a worktree from `HEAD` when a step's declared `base:` does not
resolve, silently. It is why `implement` ran at all on the night that cost $13.86, and it is a
third neighbour beside the two the ticket body records. It is **not fixed here**: it lives in a
different module, it affects fan-out task bases as well as `chore.yaml`'s, and *throw, warn, or
which callers* is a design question this requirement has not asked. After this ticket the chore
shape never reaches it, because the preflight refuses first — the fallback is masked on that path
and still live on the others. An implementer who "fixes it in passing" is out of scope, and a
reviewer who raises it is reporting a known neighbour rather than a finding.

---

## Acceptance criteria

Twelve, each independently testable. **Size was weighed and is at the upper end of the 2026-08-22
sizing decision.** It is accepted rather than split because the code is roughly thirty lines in two
places, most criteria pin behaviour that must *not* move, and the natural seams here — preflight
from diagnostic, or `--base` from either — all fall inside one function's tail, so splitting would
put two tickets in one set of eighteen lines and open them twice.

### AC-1 — An endpoint, not a range, decides what the preflight checks

In the preflight block (`spike/src/engine.js:113–142`), each endpoint of an interpolated range is
classified independently:

- **(a) step-created** — the ref is in `createdSoFar`, i.e. an earlier *group* of this flow creates
  it. Unchanged, including the strictly-earlier rule: a parallel sibling's branch is concurrent,
  not earlier, and a ref only a **later** step creates is deliberately *not* class (a).
- **(b) unresolved template** — after interpolation the endpoint still contains `{…}`. **This class
  exists only where the site is a `fan_out` step's `step:` template** (`perTask`, `:132`). An outer
  step's unresolved range is class (c) and must still fail exactly as it does today.
- **(c) pre-existing** — everything else, including a ref only a later step creates.

The range is materialised into `ctx.diffInputs` only when **both** endpoints are (c) — unchanged.
`ctx.deferredDiffs` is written exactly when an endpoint is class (a) **and** the range carries no
unresolved `{…}`: a half-interpolated key can never be looked up at step time, so recording one
would be a record nothing reads.

*Test:* unit-level over the classifier's observable effect — a flow whose range has one class-(a)
and one class-(c) endpoint records a deferral and materialises nothing; a fully class-(c) range
materialises; an outer step's unresolved `{…}` still fails as today.

### AC-2 — Every pre-existing endpoint is resolved before any adapter is invoked

When either endpoint is class (a) or (b), the range is still not materialised, **and every class-(c)
endpoint it has is required to resolve now.** A class-(c) endpoint that does not resolve stops the
run inside the preflight, before any adapter is invoked. A class-(a) or class-(b) endpoint is
**never** resolved or reported on at preflight — the preflight asks only about refs that are due.
The first failing range stops the run even when another distinct range was valid, which is clause 8
of Q-0051's AC-9 and is unchanged.

*Test:* a chore-shaped flow — `implement` (worktree, `branch: harness/{id}/implement`,
`base: harness/{id}/integration`) then a diff-bearing `review` over
`harness/{id}/integration...harness/{id}/implement` — run against a repository where the ticket
branch **does not exist**. `runFlow` rejects with a `FlowError`; adapter invocations are `[]`,
counted from run-history occurrences (the `adapterCalls` helper at `q0035-empty-range.js:344`) and
**not** inferred from a missing output artifact; the message matches
`/review requires an integrated branch/`. The paired negative is what makes it discriminating: the
*same* flow with the ticket branch present must still complete, so a fix that refuses everything
fails here.

### AC-3 — The preflight's refusal names the deferral without misreporting it

The message keeps every property Q-0035 established: the identifying phrase for its endpoint class
(`repo.base_branch …` / `review requires an integrated branch` / `input.diff names missing ref`),
which endpoint failed (`left`/`right`), the range as interpolated **and** as written in the flow
file, and the closing `Neither the diff nor the containment check was run.` It invents no
containment outcome and is clean against `q0035-empty-range.js:33`'s `FORBIDDEN` regex.

**The one clause that must be new:** the still-uncreated endpoint may not be reported as one that
*"does not resolve either"* (`:824`), because it is not supposed to resolve yet. It is described as
not yet created, naming the step that will create it — e.g. *"the right endpoint
harness/Q-0038/implement is not created until step \"implement\" runs"*. Reporting a not-yet-produced
branch as an unresolvable one is the same category error, in the same message, that the diagnosis
half exists to remove.

*Test:* AC-2's fixture, asserting each clause, plus `doesNotMatch(/does not resolve either/)`.

### AC-4 — A step-created endpoint still defers, and is never materialised early

A range with a class-(a) endpoint stays deferred **even when that ref already exists at run start** —
a second chore round, where `harness/{id}/implement` survives from round 1. Bytes captured before
the producing step ran are that step's *previous* output presented as its current one, which is a
worse failure than the one this ticket fixes.

*Test:* create both branches before the run, using the `principal-architect` role the mock adapter
actually writes a file for (`q0034-chore-preflight.js:40` says why). The run completes and the
reviewer's `prompt.txt`, read from run history, carries the file `implement` wrote **during this
run**. Had the preflight materialised the range early, the range would have been empty at preflight
and the run would have failed there, so this cannot pass by accident.

### AC-5 — Half 1: a deferred range that fails on its *other* endpoint at step time names the producing step and the ref it owed

`:825`'s ternary becomes two clauses that are never conflated:

- the failing endpoint **is** the deferred one → the existing wording, verbatim and unchanged:
  `step "<id>" was expected to create <ref>`. E16(b) matches it as
  `/step "build" was expected to create harness\/\S*\/build/` and is not edited.
- the failing endpoint is the **other** one → a new clause naming the producing step and the ref
  *that step* owed, which is the endpoint that did not fail. It must not read as a claim that the
  step owed the failing ref: the literal `was expected to create <failing ref>` may not appear (D-3).

**When both endpoints are class (a), both step/ref pairs are retained and both appear**, so a
reversal of endpoint order cannot hide either. Today's single `.find()` keeps the first match only,
which would recreate the asymmetry one level down; the per-endpoint model makes retention fall out
of the classification rather than being bolted on.

*Test:* **at run level.** The staging needs no new step kind: `type: script` (`engine.js:199`) runs
an arbitrary command between two steps, so a flow of `implement` → script `git branch -D
harness/{id}/integration` → `review` lets the preflight pass, bills the producing adapter, removes
the pre-existing endpoint, and reaches `materialiseDiff` with a non-null `deferred` and a failing
*other* endpoint. The failure names the now-missing endpoint, names the producing step and the
different ref it owed, carries the resolving endpoint's short SHA where one exists, states that
neither check ran, and shows the producing adapter invoked and the consuming one not. If that
staging proves impossible, the implement report says so and why, and the unit-level route
(`materialiseDiff(step, ctx)` with a hand-built context, as `q0077-base-flag.js:31` and
`q0035-empty-range.js` E5 do) is the stated fallback — **a unit-level proof offered without that
statement is a finding.** The both-deferred case may be proved at unit level either way.

### AC-6 — Q-0035's E16(a) is re-cut, deliberately, and everything it still pins survives

`q0035-empty-range.js` E16(a) asserts that the producing adapter **ran** and the consuming one did
not, on precisely the shape AC-2 now refuses for free. It is a landed guard from another ticket and
this requirement authorises the edit rather than leaving a review loop to decide whether a guard is
finished — the Q-0072 E-1/E-2 lesson.

Two assertions change: `assert.ok(calls.includes('implement'))` becomes
`assert.deepEqual(calls, [])`, and the assertion that the message quotes the short SHA of the
endpoint that resolves is **removed**, because `harness/<id>/implement` is now never created and the
test's own `git rev-parse --short` would throw. Everything else survives unedited and is enumerated
so the diff can be checked against this list: the `/review requires an integrated branch/` phrase,
`left endpoint`, the complete interpolated range, `Neither the diff nor the containment check was
run`, `FORBIDDEN`, `doesNotMatch(/contained/)`, and — load-bearing —
`doesNotMatch(/was expected to create harness\/\S*\/integration/)`. Its comment says what changed
and why, citing this criterion.

**E16(b), E11, E12, E15, E17 and `q0034-chore-preflight.js` C1/C1b/C2/C3 are not edited.** Each
creates the ticket branch before the run or uses a fully pre-existing range, so none is affected —
verified by reading them, not assumed.

### AC-7 — `--dry` refuses what a real run refuses

`harness run chore <id> --dry` on a ticket whose integration branch does not exist fails with AC-3's
message and zero adapter invocations, instead of printing a clean preview. This is *"skipped is not
passed"* (2026-08-25, rule 1) reaching the case that produced the rule. The deferred-range
**placeholder** path (`spike/src/engine.js:721`) is unchanged: a dry run still must not demand
branches only a paid run produces, and it must not write a ticket or run artifact to satisfy one.
E12 and C1b prove that half, unedited. There is no `if (dry)` in the preflight block today and none
is added.

### AC-8 — Under `--base`, an unresolvable revision is blamed on the flag

When the failing endpoint is the effective base **and** the run was given `--base`, the message
names the override and the revision supplied, identifies which endpoint it is, and contains neither
`repo.base_branch` nor `harness/harness.yaml`.

Attribution keys on **whether an override was supplied, never on whether its value differs from
`repo.base_branch`** — an override may legitimately name the same value, and the maintainer still
typed it. `ctx.vars.base` cannot answer this, since `:50` sets it unconditionally, so `runFlow`
records the raw override on the run context (it already destructures `base = null` at `:37`) and
`materialiseDiff` reads it, **treating an absent field as no override** so that the hand-built
contexts in `q0077-base-flag.js:31` and `q0006-engine.js` keep working untouched. A fix that reads
the field unguarded turns passing unit scenarios red for the wrong reason — the Q-0066 shape, where
`probeAdapter` dereferenced a deliberate null.

*Test:* a new scenario in `spike/test/q0077-base-flag.js`, plus a CLI-level scenario passing an
unresolvable non-empty `--base`. B1–B5 all use a real revision or none, so this **adds** a scenario
rather than changing one — the cheapest shape a message fix can have.

### AC-9 — The configured-base and integration diagnostics are unchanged

With no override in force, the configured-base message is byte-identical to today's.
`spike/test/q0006-engine.js:117–120` — which drives the failure from `f.config.repo.base_branch =
'missing-base'` and asserts `/repo\.base_branch/i`, `/harness[\/]harness\.yaml/` and
`/missing-base/` together — **passes without being edited**, and `:130`'s assertion that the sibling
integration-branch message does *not* mention `repo.base_branch` stays true. A diff touching either
line fails this criterion.

### AC-10 — Valid evidence, and the rest of the subsystem, are untouched

For a range whose endpoints all resolve, behaviour is unchanged: each distinct interpolated range is
materialised **once**, every panel member and every wave member receives identical bytes, and the
diff stat, patch bytes, `max_diff_bytes` truncation and the UTF-8 suffix trim are unaffected.
`emptyRangeFailure`'s wording, its four outcomes, its remedies and its deferred clauses at `:871`,
`:880` and `:893` are not touched — including the rule that a deferred remedy never advises
reviewing a produced ref *before it became contained*. The relatedness guard's message is not
touched. Malformed ranges and unrelated refs still fail through their existing paths. `harness
lint`'s rule keeps its wording and its coverage, and every shipped flow still lints clean.

*Test:* E8, E11, E15, E17, C1–C3 and the whole mock-adapter end-to-end suite stay green with no
edit.

### AC-11 — The documents say the new rule, in the two places that state the old one

`docs/02-sdlc-pipeline-spec.md` §5.5's *"Ranges divide into two classes"* paragraph (`:360`) is
rewritten in prose, not bullets: the classification is per endpoint; a range is materialised before
the first step when both endpoints pre-exist; a range with a step-created endpoint is still
deferred, **and its pre-existing endpoints are checked at run start anyway**, so a missing one costs
nothing; the earliest-possible guarantee still covers what the deferred endpoint alone can prove.
The `fan_out` template paragraph at `:362` gains the same qualification. The status line at `:3` is
bumped with the date and what changed, per the docs rules.

`docs/GLOSSARY.md`'s **Preflight** entry (`:83`) says what it now guarantees per endpoint. **No new
term is coined and no synonym is introduced** — "preflight", "deferred", "endpoint" and "range" are
used as they already are.

### AC-12 — One tree, and both suites verified forced by the implementer

`spike/**` is the only code touched; `packages/core/**` is not opened (see §Sequencing). The
implement report states, per environment row, that `pnpm install --frozen-lockfile` and `npm install
--prefix spike --no-audit --no-fund` were run first, and reports **`npm test --prefix spike`** and
**`pnpm turbo run test --force`** with their counts. A suite reported as unrun is honest; one
reported green without installing is not, and a reviewer cannot tell an uninstalled suite from a red
one (`harness/rules.md`). The forced flag is not decoration: a worktree resolves turbo's cache to
the main checkout's, so an unforced run can replay a verdict it never computed — *"The test command
defeats its own cache"* (2026-08-27).

---

## Non-goals

- **`ensureWorktree`'s `HEAD` fallback** (D-7). `spike/src/git.js:20–21` is quoted as evidence and
  not changed. It wants its own ticket.
- **The two neighbours the ticket body records.** *The chore flow cannot run on a ticket's first
  pass* is not fixed: no `harness lint` rule is added for it and `chore.yaml` is not reordered — no
  step order changes, and which steps create worktree, task or integration branches does not change.
  This ticket only makes that failure cost **$0 with a clear message** instead of $13.86, which is
  the honest scope of a diagnostic-and-timing fix. *`budget.per_run_usd` stops nothing* is untouched:
  still `10` at `harness/harness.yaml:14`, still typed at `packages/shared/src/project.ts:88`. Both
  still want their own tickets.
- **`packages/core`.** No file under `packages/**` is created or edited. Q-0051 ports the fixed
  version.
- **Moving the relatedness guard** (D-4), and **changing `harness lint`'s rule** — including any new
  static rule about deferred ranges.
- **Materialising a deferred range early**, even when its endpoint happens to exist (AC-4).
- **`emptyRangeFailure`'s four outcomes, its remedies and its wording.** The empty-range diagnostic
  is Q-0035's and is finished.
- **The syntax or allowed endpoint classes of `input.diff`.** Nothing is added or relaxed.
- **`contracts/`.** Not writable by this flow and not amended — see OQ-2.
- **`docs/decisions/` and its index** (D-6), and **`docs/06-development-plan.md`**, whose Q-0038
  entry is rewritten by the human at close with the run's cost and gate outcome, as every other entry
  was.
- **Recording the SHAs a run diffed** (Q-0035 OQ-2) — a persisted-format change against a frozen
  contract.
- **Changing what `--base` *does*.** It moves the diff anchor and nothing else; only the message
  changes. No new flag is added.
- **Q-0039, Q-0040, and `finish()`'s rollback.** A run that refuses in the preflight takes the
  existing terminal-audit path, unchanged.
- **Anything on the v1 exclusion list**: multi-user, remote daemon, cloud sync, plugin marketplace,
  visual canvas, eval suites, another adapter, desktop shell.

---

## Open questions

None blocks solutioning. Each is ruled, with the reasoning, so it is not re-opened at round two.

**OQ-1 — Does closing the wholesale deferral owe a `docs/DECISIONS.md` entry? — RULED: no.**
*Owner: ruud, may overrule at the gate.* The 2026-08-25 entry names the hole and hands it to Q-0038,
so closing it contradicts nothing, and the guarantee's prose lives in a numbered doc edited in place.
The reading that would overturn this is that *"the guarantee is per endpoint, not per range"* is a
general rule worth recording beside *"skipped is not passed"*. If ruud takes that reading, **the
entry is written by hand and is not an acceptance criterion** — the chore role may not write
`docs/decisions/`, and making it a criterion is what exhausted Q-0070's loop at a limit of 1 for a
precondition no step in the flow could satisfy.

**OQ-2 — Does AC-8 contradict the frozen `contracts/Q-0006/review-runtime.contract.md`? — RULED:
no.** *Owner: ruud.* Its §Diff input (`:21–22`) says *"A missing base ref is an error naming
`repo.base_branch`, `harness/harness.yaml`, and the ref."* That clause was written when `{base}` was
defined, at `:14`, as *the resolved base branch* from configuration; `--base` shipped three weeks
later and the contract was not amended. AC-8 changes the message only on the path the contract does
not describe, and AC-9 pins the path it does. No `contracts/` edit is proposed — the file is outside
the chore role's `paths`, so a criterion naming it could not be satisfied. If ruud reads the clause
as absolute, the route is an erratum, as Q-0073's E-4 was, **written during the loop as soon as the
contradiction is provable** rather than at the exhaustion gate — *"A reviewer approves the change it
asked for"* (2026-08-29). Either way the code is the same, which is why this is not a blocker.

**OQ-3 — Who supersedes Q-0051's D-5? — RULED: the human, at this ticket's gate.** *Owner: ruud.*
`backlog/` is not writable by this flow, and a requirements run cannot read a sibling's folder — so
an obligation left only in this document dies when Q-0051's requirements run is repeated. Recorded
here as a handover: **fold into Q-0051's ticket body** that its aborted merged requirement's D-5 is
obsolete, that the `.find()` it ruled preserved no longer exists, and that its AC-9's eight clauses
need re-deriving against the fixed file. Q-0051's body already carries the *Sequencing against
Q-0038* section this attaches to.

**OQ-4 — Should class (b), the unresolved `fan_out` template, be judged per endpoint too? — RULED:
yes, and it is inside AC-1.** *Owner: ruud, strikeable at the gate.* The template skip is a second
wholesale skip with the same shape: `harness/{id}/integration...harness/{id}/{task.id}` has one
endpoint that is knowably checkable and is skipped whole. Ruling it in makes the code **smaller** —
one classification replaces two special cases — and spares the implementer writing an exception to
their own new rule, which is where round-two findings come from. **Verified rather than assumed: no
shipped flow carries a `fan_out` template `input.diff` at all** — the only three diff sites in
`harness/flows/` are `chore.yaml:32` and `review.yaml:12`/`:19`, none of them a template. If struck,
AC-1's clause (b) reverts to the existing `continue` at `:132` and nothing else in this document
changes. **The `perTask` binding is not strikeable either way**: generalising the placeholder skip to
outer steps would silently delete a failure they get today.

---

## Risks

1. **This ticket changes the machinery its own run uses.** After the merge, a chore run on a ticket
   whose `harness/<id>/integration` does not exist refuses in the preflight. Charter §8's first
   checklist item already says to create that branch by hand before a child's first chore run, and
   thirteen children have. During *this* ticket's own run the risk is nil — the CLI imports `runFlow`
   from the main checkout at run start, not from the implementer's worktree — but the next ticket's
   run inherits the new behaviour. Create `harness/Q-0038/integration` before the first run.
2. **A landed guard from another ticket is edited** (AC-6). Mitigated by enumerating the assertions
   that must survive, so the reviewer checks a list rather than forming an opinion. The edit is
   authorised here and nowhere else; any *other* change to `q0035-empty-range.js` is out of scope and
   a finding.
3. **A fix that refuses too much.** Making the preflight stricter can break a legitimate deferred
   range — the second-round chore case, where both branches exist. AC-2's paired negative and AC-4
   exist for this, and E11/E15/E17/C1 are the standing witnesses.
4. **The `--base` provenance field is a new context field** and every hand-built fixture context
   lacks it. AC-8 requires an absent field to mean *no override* (the Q-0066 shape).
5. **The preflight is not a permanent guarantee.** Refs can move after it runs; the step-time check
   stays authoritative and reports current resolution evidence. That is what AC-5 is about, and why
   half 1 survives half 2.
6. **`spike/**` is outside ESLint entirely** (`harness/rules.md`), so nothing there detects a
   deprecated API or a type error. Read the code, not the tick.
7. **A green `integrate` tick is worktree-scoped.** Verify both suites forced on `main` after the
   merge, not from the tick — Q-0072's merged, reviewed, integrate-green change failed on `main`.
8. **Behaviour drift during the later port.** Q-0051's independent spike witness must include these
   scenarios, or a `packages/core` implementation could preserve the superseded `.find()` while both
   suites appear green.
9. **The port freeze.** Q-0038 is **not** in charter §3's `children` list, so `harness/Q-0038/*` is
   out of the branch-scope guard and the guard says so rather than passing silently; §3's table names
   this ticket as one of five that must land before `freeze-sha` can be recorded at
   `harness/port-charter.md:243`. Recording that SHA is **not** part of this ticket — four of the five
   are still open.

---

## Sequencing

**This is a one-tree change, and this is the last moment it can be.** `packages/core` has no diff
subsystem: Q-0051 has not run, so there is no ported twin to keep in step and none of the
Q-0066 / Q-0068 *"lands in both trees together"* cost applies. Every landed port child is untouched.
After Q-0051 lands, the same fix is two trees, two suites and a divergence risk.

**It must be contained in `main` before Q-0051's requirements run is repeated** — the reason
Q-0051's run was aborted at its gate on 2026-08-30. Q-0051 then ports the fixed version and
re-derives its AC-9 against it, rather than following its superseded D-5.

---

## Cross-cutting checklist

| | |
| --- | --- |
| **BYOS** | n/a — no adapter, login or environment variable is touched. No code path, test or example gains a key. |
| **Worktree safety** | n/a — nothing new is written anywhere. The preflight reads refs; the change adds `git rev-parse` calls and removes none. No flow writes to the user's working tree, and worktree and branch placement is unchanged. |
| **Gate behaviour** | Unchanged. No gate becomes `auto`, no `human-locked` gate is touched, no exhaustion gate or loop bound is added or removed. A preflight refusal fails the run through the same terminal-audit path as today. |
| **File format and schema** | Unchanged. Nothing under `.quorum/`, `backlog/` or `contracts/` changes shape; no zod schema in `packages/shared` is touched; no YAML field or frontmatter field is added. `ctx` gains one in-memory field, which is not a persisted format and not hidden daemon state. |
| **Lint rules** | Unchanged. `harness lint`'s static `input.diff` rule (`spike/src/lint.js:81`) keeps its wording and coverage; every shipped flow still lints clean. |
| **Cold-clone impact** | Positive and small. A first run whose integration branch is absent now stops in seconds naming the branch, instead of spending a subscription's worth of tokens in a worktree cut from the wrong commit; `--dry` says the same thing for free. No new setup step or option is introduced. |
| **Cross-vendor rule** | Unchanged — `chore.yaml` keeps `cross_vendor: required`, claude implements and codex reviews. |
| **Product-agnostic** | Unchanged — no product name appears in any message, test or document. |

---

## Provenance

Composed from Q-0038's ticket body (including its 2026-08-30 hand-written re-derivation) and both
candidates, read against: `spike/src/engine.js`, `git.js`, `lint.js`; `spike/test/`
`q0035-empty-range.js`, `q0034-chore-preflight.js`, `q0006-engine.js`, `q0077-base-flag.js`,
`run.js`; `harness/flows/chore.yaml` and `review.yaml`; `harness/roles/developer-generalist.md`;
`harness/harness.yaml`; `harness/port-charter.md` §3;
`docs/decisions/044-q-0035-accepted-a-check-that-skips-its-subject.md`;
`backlog/Q-0035-empty-range-diagnostic/requirements/merged.md`;
`backlog/Q-0051-core-engine-diff-preflight/requirements/merged.md`;
`contracts/Q-0006/review-runtime.contract.md`; `docs/02-sdlc-pipeline-spec.md` §5.5;
`docs/GLOSSARY.md`.

**From the claude candidate**, which supplied the structure: the re-cut of Q-0035's E16(a) (AC-6)
and the enumeration of what must survive it — the single most valuable finding in either document,
and verified here by reading E16 at `q0035-empty-range.js:621`, where `calls.includes('implement')`
and a `git rev-parse --short` on the implement branch are both fatal to the timing fix; D-3's ruling
that the new clause attributes the deferral and never the failure, which E16(a)'s own negative
assertion already forbids the naive form of; the "does not resolve either" mis-report (AC-3); the
documents criterion (AC-11); the surface/role-path certification; D-4, D-6, and the deferred-record
rule for a half-interpolated key.

**From the codex candidate**, which was the more cautious on data and the less disciplined on
scope: per-endpoint retention of producer metadata, so two deferred endpoints cannot hide either
pair (AC-5) — today's `.find()` keeps the first match only; the rule that `--base` attribution keys
on *whether an override was supplied*, never on whether its value differs (AC-8); the insistence
that half 1 stay provable at **run** level after half 2 lands (AC-5); and the explicit non-goals on
flow ordering and branch creation. Its AC-16 and AC-17 were struck as meta-criteria — a
"the suite proves it" criterion duplicates the criteria it lists, and a cross-cutting bundle is not
independently testable; both moved to the checklist and to per-criterion test notes.

**Where the candidates disagreed, this document picked rather than averaged.** Codex's AC-4 demands
zero adapter invocations on exactly the shape E16(a) pins the opposite of, and never notices —
which would have handed a review loop the question of whether a landed guard is finished, the Q-0072
E-1/E-2 failure. Claude's AC-4 concedes half 1 to unit level as unstageable; that is overturned,
because `type: script` (`engine.js:199`) runs an arbitrary command between steps and stages the
mid-run disappearance without inventing a step kind. Codex leaves the `fan_out` template skip
wholesale; OQ-4 rules it in, on the verified fact that no shipped flow has a template `input.diff`.

**Three things this document found that neither candidate says.** `ensureWorktree`
(`spike/src/git.js:20–21`) silently cuts a worktree from `HEAD` when the declared `base:` does not
resolve — which is *why* the implement step ran and was billed against a missing integration branch,
rather than failing on it, and is a second silent default under a rule that forbids them; it is D-7,
a named non-goal with its evidence, and a third neighbour needing its own ticket. The preflight must
resolve **only** class-(c) endpoints, not simply call `materialiseDiff`, because the endpoint loop
checks left before right and would otherwise blame a deferred left endpoint for a failure that
belongs to the right. And C1/C1b were checked rather than assumed: both create the integration
branch before the run (`q0034-chore-preflight.js:73`, `:88`), which is what makes AC-6's "not
edited" list true.
