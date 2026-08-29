---
id: Q-0051
title: core/engine — diff preflight and materialisation
stage: draft
owner: ruud
repos: []
branch: harness/Q-0051/integration
priority: p2
created: 2026-08-25
iterations: {}
history:
  - stage: draft
    run: 1
    flow: requirements
    status: aborted
    stage_before: draft
    stage_after: draft
    at: 2026-08-29T22:24:42.646Z
    cost: 7.274
---
Ports the diff subsystem: the run-level preflight in `runFlow` (`spike/src/engine.js:91–142`) and
the five functions it and `buildPrompt` reach — `named` (`:769`), `diffSitesOf` (`:781`),
`materialiseDiff` (`:790`), `emptyRangeFailure` (`:865`) and `trimIncompleteUtf8Suffix`
(`:900–908`). 192 lines of which 107 are code; the rest is the comment weight Q-0034 and Q-0035
paid for. The most decision-dense of the four engine tickets — it is the whole subject of Q-0035,
which cost $36.66 to land. Belongs to M2 in `docs/06-development-plan.md`; parent Q-0009.

**Every line number above was re-read on 2026-08-30, and every one of them had moved.** This body
was written against `95–130` and `785–894`, which Q-0077 shifted by five and which was approximate
before that. Two functions the old range excluded are named above rather than left to be
discovered: it cut `trimIncompleteUtf8Suffix` off the top — the omission the *Inherited from
Q-0049* note below is about — and it cut `named` off the bottom, used at `:821` and `:890` and
nowhere else, so the same hazard in the other direction. Re-derive any line from the file, never
from this paragraph.

**What it is for.** M1's deepest finding: Q-0006's review spent $5.02 of Claude cost plus an unpriced
Codex reviewer on a diff that did not exist. `materialiseDiff` embedded the emptiness without
noticing, and the flow would have advanced on the verdict. The panel produced eleven substantive
findings anyway by reading the working tree instead of the evidence handed to it, and three were
real — *"the reviewers were right; the mechanism that was supposed to make them right was broken"*,
and it stayed invisible precisely because the agents compensated. Any step whose input is technically
optional because the agent has repo access carries this hazard.

**The diagnostic reports evidence, not a story.** Q-0035's rule: name both endpoints and the short SHA
each resolved to, the containment check verbatim, and that check's outcome as one of `contained`,
`not contained` or `indeterminate` — through the single `ancestry()` primitive in Q-0042, never a
private `try { … } catch { return false }`. The old message asserted a historical event (*"is already
merged into"*) from a relation between two commits; a merge, a cherry-pick, a hand-applied patch and a
rebase all produce the same exit code. It happened to be right, which is why the entry closing it is
titled around the distinction. Each failure carries **at most one** remedy, and every remedy is one
the range guard would accept — the previous message ended by advising something the guard forty lines
above it refuses.

**The guard is not relaxed.** Both endpoints must be the configured base or a branch under
`harness/<ticket-id>/`. Settled by Q-0034; it is what stops a flow aiming a review at an unrelated
ref. Its static twin lives in `lintFlow` (Q-0044).

**The limit is stated rather than implied.** *"No adapter is billed before bad evidence is found"*
holds for ranges over refs that exist when the run starts, and cannot hold for a range whose endpoint
the run itself creates — `chore.yaml` reviews `integration...implement`, and the implement branch has
no emptiness to discover until its adapter has run and been paid for. That class gets
earliest-possible instead: the producing adapter may run, the consuming one may not.

**Sequencing against Q-0038, which owns the known hole.** The preflight defers a range whole when
*either* endpoint is step-created — one `.find()` over both endpoints at `engine.js:118`. On the night
Q-0035 was implemented the left endpoint was a pre-existing-ref-class branch that simply did not
exist, nothing checked it, `--dry` reported the range valid, and the run billed $13.86 before failing.
Q-0038 closes both halves — validate each endpoint on its own class, and name the producing step
whichever endpoint turns out bad. Land it on the spike first or port the fixed version; doing both
means porting a file while it is being changed underneath.

**And the rule the whole thing generalises to:** *skipped is not passed*. A preflight, a `--dry` run
or a lint that declines to examine something says so. Silence must never render as a green tick.

**Inherited from Q-0049 (merged requirement, 2026-08-28).** This ticket also owns
`trimIncompleteUtf8Suffix` (`spike/src/engine.js:900`), whose only call site in the repository is
`materialiseDiff` (`:840`), where it trims a truncated diff back to a UTF-8 boundary. Q-0049's body
lists it among run history's functions, which it is not, and Q-0049's merged requirement declines it
as NG-2 and re-points it here. **Note where it sits.** It begins two lines after `emptyRangeFailure`
ends at `:898`, so a port that trusts a range stopping at the function above it takes everything
except this one — the adjacency hazard Q-0049 named, arriving as an omission rather than as a theft.
The opening paragraph now names it, and `named` with it.

## Inherited from Q-0050 and Q-0077, 2026-08-30 — four things this body must carry

Written here rather than left in `backlog/Q-0050-…/solution/errata.md`, for the reason Q-0052's
identical block gives: **this ticket's requirement will not read that file.** `requirements.yaml`
feeds a candidate `ticket.md`, `harness/rules.md` and `harness/product-context.md`, and the chore
steps read the errata of the ticket they are running, never a sibling's. None of the four is a
defect in shipped code and none is visible to a green suite.

1. **A seventh file in `packages/core/src/engine/` turns a green suite red in a file this ticket
   does not own.** `packages/core/src/engine/q0050.source.test.ts:82` pins the folder with
   `toStrictEqual(['channel.ts', 'engine.ts', 'lifecycle.ts', 'loaders.ts', 'routing.ts',
   'types.ts'])`. That is deliberate and so is the rest of the file: Q-0050's rounds widened its
   other guards *"while the folder is six"*, in as many words, because they govern what Q-0051 to
   Q-0053 add. They are — every `export` carries its own JSDoc **anchored on the export**, not on
   the file; no comment line reproduces a forty-character sentence of `docs/DECISIONS.md` or of the
   ticket body verbatim; every `Why:` clause is classifiable by `classifyAuthority`, so
   `behaviour preserved from spike/…`, `deliberate addition, not preservation`, or
   `preserved <word>, see <AC-n|Q-nnnn>` and nothing else; and no engine file matches `console.`,
   `process.(stdout|stderr|exit|on|once|addListener|prependListener|prependOnceListener)` or an
   import from `spike/`. **The requirement decides whether the diff subsystem is a new module or
   goes into an existing one, and says so** — if new, extending that pin is part of this change
   rather than a surprise found in review. The file is under `packages`, so the role can write it.

2. **`interpolate` no longer coerces, and the obligation is this ticket's** — Q-0050
   `solution/errata.md` E-21, which names Q-0051 and Q-0052 by id. `spike/src/engine.js:745` is
   `String(s).replace(…)` — E-21 cites `:740`, which was true before Q-0077 shifted the file five
   lines — and `packages/core/src/engine/loaders.ts:52` types the parameter `string`
   and performs no coercion. The call sites in this ticket's range are `engine.js:125`
   (`site.input.diff`), `:138` (`s.branch`) and `:139` (`s.into`) — `materialiseDiff` at `:791`
   already writes `String(step.input.diff)` itself. YAML hands back a **number** for `branch: 2`,
   so under a step shape typed `Record<string, unknown>` each site writes `String(…)`
   deliberately. E-21's point is that this is the port turning a latent defect into a **compile
   error** rather than the spike's silent runtime pass-through: it is not a behaviour change to
   report under charter §2, and it is not licence to change what the interpolated value means.

3. **The seam this ticket codes against already exists; only the preflight block is missing.**
   `RunContext` carries `config` (Q-0050 E-1), so `config.repo?.max_diff_bytes` — `engine.js:836`
   — is reachable without inventing an option. `vars.base` is
   `base ?? config.repo?.base_branch ?? DEFAULT_BASE_BRANCH` (`engine.ts:137`). And the context
   handed to a step **is the run's own object, never a spread copy**, so `diffInputs` and
   `deferredDiffs` added to `RunContext` survive from the preflight into the steps that read them by
   contract rather than by the accident Q-0050's round 3 noticed. What is absent is the block
   itself: Q-0050 ported only its *position* — inside the run try, which opens at
   `packages/core/src/engine/engine.ts:207`, and before the step loop, which reads `flow.steps` at
   `:223` — so that a failed preflight receives the same terminal record as any other error.

4. **Q-0077 shipped `harness run --base` on 2026-08-29, after charter §6's row for this ticket was
   written, and it lands inside this ticket's subject.** `spike/test/q0077-base-flag.js` calls
   `materialiseDiff` directly at six sites and is frozen coverage this ticket preserves alongside
   `q0035-empty-range.js`, `q0034-chore-preflight.js`, `q0034-dry-run.js`, `q0034-review-fixes.js`,
   `q0006-engine.js` and `smoke.js`. The flag moves the **diff anchor** and nothing else:
   `ctx.vars.base`, which `{base}` interpolates and which the range guard treats as related. The
   three merge-source sites read `config.repo.base_branch` directly and must not move — aiming a
   review at an old revision must not write that revision into the ticket's branch. `engine.js:800`
   anticipated the flag in as many words, so the guard composes with it; a port that resolves `base`
   from the config inside `materialiseDiff` would silently undo Q-0077 and every existing test would
   stay green except that file's.

## Run 1 aborted at the requirements gate, 2026-08-30 — Q-0038 goes first

`requirements/merged.md` exists, is complete, returned `ready`, and cost **$7.274 plus 5,125,082
tokens** across three steps. **Do not run the chore flow against it.** Ruud aborted at the gate to
land Q-0038 on `spike/src/engine.js` first, which is the sequencing this body's own §*Sequencing
against Q-0038* asks for — *"Land it on the spike first or port the fixed version; doing both means
porting a file while it is being changed underneath."*

**What that invalidates, enumerated at Q-0038's requirements gate on 2026-08-30 so the rest can
still be used.** The document rules in D-5 that the wholesale `.find()` over both endpoints
(`spike/src/engine.js:133`) ships **unchanged** as a registered preserved defect. Q-0038 deletes
that `.find()`, so the following die with it and nothing else does:

- **D-5 entirely**, and with it AC-12's first register row — the `preserved defect, see Q-0038`
  authority line. There is no defect left to register.
- **AC-9 clause 5** — *"records a range whose either endpoint is in the created-so-far map"* — which
  becomes per-endpoint classification, and **clause 4**, the per-task template skip, which Q-0038's
  OQ-4 rules per-endpoint on the same principle. Clauses 1, 2, 3, 6, 7 and 8 survive unchanged and
  are still worth reading rather than re-deriving.
- **AC-5's endpoint tail**, which gains two things Q-0038 adds: a not-yet-created endpoint is
  described as not yet created rather than as one that *"does not resolve either"*, and under
  `--base` an unresolvable override is blamed on the flag rather than on `harness/harness.yaml`.
- **The coverage table's E16 row.** Q-0038 re-cuts `q0035-empty-range.js` E16(a) under its own AC-6
  — `calls.includes('implement')` becomes `deepEqual(calls, [])` and the short-SHA assertion goes —
  so the frozen scenario this ticket ports is not the one that was read.

**AC-3's guard, AC-6, AC-7, AC-8, AC-10 to AC-14 and both source-guard findings are untouched** by
Q-0038 and hold as written. The authority for the new rule is *"A range is checked one endpoint at a
time, because an endpoint is what can be absent"* (2026-08-30), written by hand at Q-0038's gate;
cite it rather than re-arguing the model. The requirements run is re-run after Q-0038 is contained,
not resumed.

**What survives and is worth re-reading rather than re-deriving.** Everything not about the `.find()`
was verified against the files at the gate and held: the `merge-base` token in `git.source.test.ts`
that a verbatim comment port would trip; AC-13's measured pair of `TypeError` messages, where the
spike's preflight iterating `flow.steps` first is what makes `flow.steps is not iterable` externally
observable and `core` currently says `Cannot read properties of undefined (reading 'length')`;
`q0050.source.test.ts`'s two pins, the folder array at `:82` **and** the file-keyed register at
`:160`; and the coverage table's scenario census, checked exact — E1–E17, B1–B5, C1/C1b/C2/C3,
D1/D2.

**R-1 is the one item that should move rather than wait**, and it is now Q-0038's neighbour rather
than this ticket's: under `--base`, an unresolvable override is reported as `repo.base_branch in
harness/harness.yaml names missing ref …`, sending the maintainer to a file the value did not come
from. It lives in the same `materialiseDiff` tail Q-0038 rewrites and matches the same frozen
fixtures by substring, so the two are one pass over one function.

## Port charter

The charter is `harness/port-charter.md`; §6's register is normative for everything below and this
body cites it rather than restating it — where the two ever differ, the register is right.

Route: **chore** (`requirements → chore → human gate`), per *"The port takes the chore route,
except the one child that has new behaviour"* (`docs/DECISIONS.md`, 2026-08-25). Behaviour is
preserved per *"The port preserves behaviour; one exception is authorised and everything else
stops the child"* (`docs/DECISIONS.md`, 2026-08-25) — a defect found while reading the spike is
reported, never fixed in passing.

- **Ports:** `engine.js` diff preflight and materialisation
- **Lifts from `spike/bin/harness.js`:** nothing
- **Depends on:** Q-0050 · **Depended on by:** Q-0052
- **Invariants inherited:** register rows 10, 11, 12 (charter §2)
- **Non-goals:** another child's module; editing `spike/**` (charter §3); fixing a defect found
  while reading (§2); the cutover; the `quorum` binary (Q-0010); persisting the event stream;
  anything on v1's exclusion list.
