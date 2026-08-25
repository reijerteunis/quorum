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
