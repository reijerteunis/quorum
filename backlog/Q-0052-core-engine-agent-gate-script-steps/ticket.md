---
id: Q-0052
title: core/engine — agent, gate and script steps
stage: requirements
owner: ruud
repos: []
branch: harness/Q-0052/integration
priority: p2
created: 2026-08-25
iterations: {}
history:
  - stage: requirements
    run: 1
    flow: requirements
    status: completed
    stage_before: draft
    stage_after: requirements
    at: 2026-08-30T21:55:57.932Z
    cost: 12.35
---
Ports the three simple step kinds: `runAgentStep` with `buildPrompt`, `schemaFor`, `resolveModel` and
`reviewRound`; `runGate`; `runScript`. Roughly 250 lines of `spike/src/engine.js`. The fan-out and
integrate kinds are Q-0053. Belongs to M2 in `docs/06-development-plan.md`; parent Q-0009.

**Gates are the product's strongest surface, and their semantics are decided.** Runs pause at every
gate by default and a gate may be set to `auto` per flow; `human-locked` can never be flipped, and the
deploy template uses it. Separately, an engine-presented **exhaustion gate** appears when a bounded
loop exhausts: it uses the same mechanism but is not declared as a step, requires an explicit
`advance`, `retry` or `abort`, and **cannot be bypassed by `--auto`** (2026-08-23). Missing, empty,
invalid, unavailable or disallowed answers fail without inventing a decision — because exhaustion
means the configured automation policy has run out of authority, and defaulting an absent answer to
`advance` would make silence indistinguishable from approval.

**Prompt construction is where a role reaches an agent.** `buildPrompt` assembles the harness context,
the role file and the step's declared inputs; `resolveModel` implements the rule that a role's default
model is inherited only by steps on that role's own adapter, never across vendors. `schemaFor(step)`
generates the JSON Schema Quorum sends the vendor — and every property it declares must appear in
`required`, or a strict-structured-output vendor returns an error indistinguishable from a broken
login (Q-0034). `spike/test/q0034-probe-schema.js` checks exactly this and covers `schemaFor`.

**The output contract.** Whatever comes back is checked against the schema Quorum itself generated,
strictly — enum membership, required keys, and couplings the flow declares such as an `approve`
verdict carrying no findings. Invalid structured output saves the raw text next to the ticket and
stops the run with a clear message; it never defaults silently. Tolerance for how a vendor wrapped its
answer belongs to `extractJson` in Q-0046, and the 2026-08-22 decision forbids merging the two.

**A tracked limitation this port can legitimately close.** `runGate` holds a 1-second `signalWindow`
timer whose only real effect is keeping a test fixture alive; removing it needs that fixture to own a
promise with its own libuv handle, which meant editing `spike/test/**` — qa-red's frozen artifact.
The port writes *new* Vitest fixtures, so the constraint does not travel with it. Q-0037 carries the
finding; whoever writes the ported gate test should be told they are allowed to fix it. Note this is
the only such invitation in the port: no other ticket may change behaviour to make a test easier.

**Script steps are in v1 for a reason** — qa-red, qa-final and deploy all need to run a real command
(2026-08-21) — and they inherit `runCommand`'s timeout, because a project's own command can hang
exactly as a suite can.

**An obligation inherited from Q-0046, which this ticket's requirement must carry as a criterion.**
Q-0046 ported the `PROBE_SCHEMA` half of `spike/test/q0034-probe-schema.js` and **deferred the
`schemaFor` half to this ticket by name** — porting it there would have meant importing
`spike/src/engine.js`, which charter §3 forbids. It left the rule as a reusable exported helper,
`strictSchemaProblems` in `packages/core/test/strict-schema.ts`, precisely so this ticket imports the
rule rather than retyping it. **A criterion must assert `schemaFor`'s output against that helper for
every shape it emits.** Until then the rule is covered on the spike alone, and Q-0046 recorded the
gap as *deferred with a named owner* rather than as coverage that is complete.

**Inherited from Q-0047 (erratum E-1, 2026-08-27).** Register row 2's third clause — *"a role's
default model never crosses vendors"* — is **Q-0052's**, not Q-0047's. It is `resolveModel`
(`spike/src/engine.js:670`), called only from the agent step (`:205`), which this ticket ports.
Q-0052's requirement must carry it as a criterion: the step's own `model` always wins; a role's
default is inherited **only** when `role.meta.adapter` equals the resolved adapter name; otherwise
no model is passed at all, so the CLI picks one its own login supports. A `model: opus` reached a
codex step once already (Q-0001). Frozen coverage: `spike/test/smoke.js:620–626`. If this ticket's
cut leaves `resolveModel` with the run loop, the obligation moves to Q-0050 with the function.

Q-0047 owns the adapter half of the same row and discharges it — `--ignore-user-config`
unconditional, `-m`/`--model` only when the caller names a model, no vendor alias anywhere. Its
implement report names this split rather than reporting the row closed, so nothing here is
double-counted; see `backlog/Q-0047-core-claude-and-codex-adapters/requirements/errata.md` E-1.
The same erratum also owns `ctx.config.adapterOverride` (`spike/src/engine.js:204`), the fan-out
half of Q-0047's `overrideAdapters`, which the CLI sets on the same line and this ticket ports.

**Inherited from Q-0049 (merged requirement, 2026-08-28).** This ticket also owns `formatCost`
(`spike/src/engine.js:533`), whose only non-test call site is the step completion line at `:302`;
`spike/test/smoke.js:612–618` is its frozen coverage. Q-0049's body lists it among run history's
functions and its merged requirement declines it as NG-2, on the rule that decides that whole
boundary: **run history computes, and does not narrate.** `formatCost` produces a string for a human
to read, so it travels with the step that prints it. Register row 3's *rendering* clause is not
discharged here either — `formatMoney`, `formatTokens` and `formatVendorSummary` stay in
`bin/harness.js` until Q-0010.

## Port charter

The charter is `harness/port-charter.md`; §6's register is normative for everything below and this
body cites it rather than restating it — where the two ever differ, the register is right.

Route: **chore** (`requirements → chore → human gate`), per *"The port takes the chore route,
except the one child that has new behaviour"* (`docs/DECISIONS.md`, 2026-08-25). Behaviour is
preserved per *"The port preserves behaviour; one exception is authorised and everything else
stops the child"* (`docs/DECISIONS.md`, 2026-08-25) — a defect found while reading the spike is
reported, never fixed in passing.

- **Ports:** `engine.js` agent, gate and script steps
- **Lifts from `spike/bin/harness.js`:** nothing
## Inherited from Q-0050, 2026-08-29 — seven obligations that die if this body does not carry them

Written here rather than left in `backlog/Q-0050-…/solution/errata.md`, because **this ticket's
requirement will not read that file**: `qa-red.yaml` reads the errata of the ticket it is running,
not a sibling's. Q-0050 closed six review rounds and each of these was deferred with a reason; none
is a defect in shipped code, and all seven are invisible to a green suite.

1. **Four scenarios enter this ticket unpinned** (Q-0050 E-8): step-id enrichment, the failed-step
   `done` suppression, cancellation, and run-history initialisation failure. E-8 struck their tests
   knowingly and said in as many words that this requirement should carry them **as criteria rather
   than rediscover them**.
2. **`step` and `done` are emitted nowhere.** Q-0050 round 3 confirmed it by grep and ruled it out of
   scope on ownership: all three spike call sites (`engine.js:234`/`:238`/`:302`, `:595`/`:605`,
   `:974`/`:1078`) are in `runAgentStep`, `runScript` and `runIntegrate` — this ticket's and
   Q-0053's. Emitting them around `runStep` instead would fire for gate steps and fan-out parents,
   which the spike never does.
3. **`registerOccurrence` cannot be called by anyone** (E-22). `history` is a local in `run()`, it is
   on none of the three context types, and `RunHistory.allocate` is the only producer of an
   `Occurrence`. The seam must be widened — `allocateOccurrence(step, kind, fields)` registering as
   it allocates is the shape Q-0050's round-6 panel and its erratum both expect — **and that design
   is this ticket's**, deliberately not frozen in advance by a ticket that allocates none.
4. **`interpolate` no longer coerces** (E-21). `spike/src/engine.js:740` is `String(s).replace(…)`;
   the port types the parameter `string`. YAML hands back a **number** for `branch: 2`, so every call
   site here — `step.run`, `step.branch`, `s.into`, `site.input.diff` — writes `String(…)`
   deliberately. Under a `Record<string, unknown>` step shape this is a compile error rather than the
   spike's silent pass-through, which is the point.
5. **A `parallel:` member has no way to carry its own step id.** Q-0050 round 6, Major 1, found
   independently by both vendors. The loop stamps only the top-level step and a group correctly has
   no `id`; `withStepId` now preserves an id an event already carries, so the fix here is to give
   each member an emitter that supplies one. The subject is one assertion: a group with no `id`
   whose two members each emit, asserted to carry their own ids.
6. **Two coverage halves become reachable the day this ticket adds a failing step kind.** AC-10f's
   *"a loop that fails once during the dry run"* — unreachable while `askGate`'s dry short-circuit
   advances before any counter is written — and AC-6d's disk-level ordering assertion, which needs
   `handleFail` to have a caller in `packages/core/src`. Both are named as not-covered in Q-0050's
   `qa/scenarios.md`; neither is a defect there.
7. **The two gate `info` texts are this ticket's to assert**, per E-4's own note, and
   `contracts/Q-0050/run-messages.fixture.json` is the oracle to read them through — 18 of its 22
   leaf keys are read today, and the four that are not are `gate.*`, asserted as a shape.

## Inherited from Q-0051 and Q-0057, 2026-08-30 — two more that die if this body does not carry them

Here for the same reason as the seven above: `requirements.yaml` reads this ticket's own folder and
not a sibling's, so an obligation left in Q-0051's open questions or Q-0057's implement report is
not read again after that ticket's gate.

**Q-0057's `{run}`, and the write loop that must use it.** Q-0057 made a chore run's review artifact
run-scoped — `review/chore/run-{run}/chore-iter-{iter}.md` is the write path in both shipped copies
(`harness/flows/chore.yaml:34`, `spike/templates/harness/flows/chore.yaml:34`) and the input glob at
`:13` of each — and added `{run}` as an interpolation variable to **both** engine trees
(`spike/src/engine.js:57`, `packages/core/src/engine/engine.ts:141`, whose JSDoc at `:137–139` names
the reason: `iter` restarts at 1 on every run, so it cannot name a ticket-scoped path after the run
that wrote it). **`core` got the variable and not the behaviour**, because `runAgentStep` is still
`unavailableStep(step, 'Q-0052')` (`packages/core/src/engine/routing.ts:56–58`) — which is why
Q-0057's AC-1 core half is a spy assertion rather than a file assertion. So when this ticket ports
the agent step's declarative write loop (`spike/src/engine.js:315–318`, `for (const rel of
writesOf(step))`), it interpolates the write path with `vars.run` in scope and **must not
reintroduce a ticket-scoped path named by a run-scoped counter**. The evidence that this is live
rather than theoretical is one directory: `backlog/Q-0080-…/review/chore/run-2/` is the only
run-scoped review in the backlog, so a port that drops `{run}` sends the next chore ticket's reviews
back to the flat path beside the 57 legacy files and re-opens the defect in silence. Stated rather
than assumed: `{run}` inherits `nextRunId`'s weaknesses (`spike/src/engine.js:776–784`) — it derives
from `runs.log` and `ticket.meta.history`, so two concurrent runs collide (Q-0039) and a hand-edited
`runs.log` moves it. Neither is new; `reviewRound` reads the ticket folder with the same exposure.

**Q-0051's OQ-1 — does the `--dry` placeholder discharge the skipped-subject rule on its own?**
Q-0051 asked whether `preflightDiffs` should emit an `info` event naming what it skipped, and ruled
**not there**: an added event is new behaviour under charter §2 and needs its own authority, so the
preflight ported as-is. It raised the question here because the only text that reports a deferral
today is `buildPrompt`'s, which is this ticket's — `spike/src/engine.js:747–749` answers a range
absent from `ctx.diffInputs` with *"(dry run: `<range>` is produced by an earlier step of this flow
and is materialised when that step has run)"*. Everything else about a deferral is implicit: the
range sits in `deferredDiffs` and nothing says so until step time. The rule it is measured against
is *"Q-0035 accepted: a check that skips its subject must not report success"* (`docs/DECISIONS.md`,
2026-08-25), which `docs/GLOSSARY.md`'s **Preflight** entry states as reporting a declined
examination as *skipped*; Q-0051's merged requirement calls it invariant 11. **This ticket's
requirement must rule the question rather than inherit the deferral** — either the placeholder is
the report, said in as many words, or a report is owed. If it is owed, what that costs is known in
advance: an added event is new behaviour wanting a decision entry, which no step in the chore flow
may write, so the answer is a successor ticket and a gate obligation and never a criterion this run
can satisfy. That is the pattern Q-0070's requirement named and Q-0079's run hit again — a loop
spending its budget on work no agent in it can perform — and naming it here is how it is avoided.

## Preserved defect: Q-0078 becomes reachable in `core` on this branch and on no other

**This ticket writes the first consumer of `ctx.diffInputs` in `packages/core`.** Q-0051 ported the
producer — `preflightDiffs` materialises a resolvable range once into `context.diffInputs`
(`packages/core/src/engine/diff.ts:445`), keyed by the **interpolated range alone**
(`packages/core/src/engine/types.ts:170`) — and `core` has no reader at all: `buildPrompt` appears
there only in two comments (`diff.ts:136`, `lint/lint.ts:141`). The read that holds the defect is
`spike/src/engine.js:747`, `ctx.diffInputs?.get(range) ?? (ctx.dry ? … : materialiseDiff(step,
ctx))`, which prefers the cache **unconditionally** — so a site correctly classified as deferred is
handed bytes captured before its producer ran.

**Port it as it stands and pin it; do not fix it here.** The authority is Q-0038's
`requirements/errata.md` **E-3(b)** (2026-08-30), which ruled it *reported, not fixed* — charter §2's
*"a defect found while reading is reported, never fixed in passing"* applied to a defect found while
reviewing — and **Q-0078**, which carries it forward. The reason it is a ticket rather than a line:
the obvious fix, dropping the cached entry on deferral, makes two sites materialise one range
separately at different moments, which Q-0038's AC-10 (*"every panel member receives identical
bytes"*) and its risk R-D forbid, and the once-per-distinct-range guarantee is load-bearing — it is
what stops one range costing n git spawns across a fan-out wave. Q-0078 sets out three candidate
shapes (key by site, invalidate on deferral, forbid the shape in `harness lint`) and says the choice
is the work.

**It is unreachable in every shipped flow in both trees**, which is why it is p3 and why keeping it
out of Q-0038 was right: it needs one range read both **before and after** its producing step, and
`chore.yaml:32`'s only diff site follows its producer while `review.yaml:12` and `:19` are parallel
members of one group with no producer between them — the same in `spike/templates/harness/flows/`.

**What this requirement must therefore do is name it, so a reviewer meets a citation rather than an
undocumented hazard.** That is the Q-0066/Q-0068 shape: a defect pinned in both trees is a
deliberate act, and a reviewer who finds one unannounced spends a round on it.
`.claude/rules/engineering.md` says what that looks like in the source — one line naming the
authority at the call site (`Why: preserved defect, see Q-0038 E-3(b) / Q-0078`) and never the
ticket body transcribed into a comment. Whether the pin is also a test is this requirement's call,
with one thing to weigh: a pin asserts the current behaviour deliberately and comes out with the
defect later (Q-0080's precedent), while the *discriminating* scenario — one flow consuming a range
before and after its producer, the second consumer asserted to receive the producer's work — is
Q-0078's to write and to demonstrate red, per *"a check is not established by reading it"*
(2026-08-29).

**One correction to Q-0078's own body, which was written before Q-0051 landed.** Its **Sequencing**
paragraph says the ticket becomes a two-tree change once Q-0051 has ported the diff subsystem. Half
of that is now true: Q-0051 ported the *producer*, and the *reader* that holds the defect is this
ticket's and is still one tree. Q-0078 becomes a two-tree ticket when **this** ticket lands, not
when Q-0051 did.

## Ticket

- **Depends on:** Q-0051 · **Depended on by:** Q-0053
- **Invariants inherited:** register row 17, and row 2's cross-vendor clause (charter §2, as
  re-pointed by Q-0047 erratum E-1, 2026-08-27)
- **Non-goals:** another child's module; editing `spike/**` (charter §3); fixing a defect found
  while reading (§2); the cutover; the `quorum` binary (Q-0010); persisting the event stream;
  anything on v1's exclusion list.
