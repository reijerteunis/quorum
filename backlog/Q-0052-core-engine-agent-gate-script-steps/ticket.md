---
id: Q-0052
title: core/engine — agent, gate and script steps
stage: draft
owner: ruud
repos: []
branch: harness/Q-0052/integration
priority: p2
created: 2026-08-25
iterations: {}
history: []
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
- **Depends on:** Q-0051 · **Depended on by:** Q-0053
- **Invariants inherited:** register row 17, and row 2's cross-vendor clause (charter §2, as
  re-pointed by Q-0047 erratum E-1, 2026-08-27)
- **Non-goals:** another child's module; editing `spike/**` (charter §3); fixing a defect found
  while reading (§2); the cutover; the `quorum` binary (Q-0010); persisting the event stream;
  anything on v1's exclusion list.
