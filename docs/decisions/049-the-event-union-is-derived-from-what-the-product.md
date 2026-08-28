# The event union is derived from what the product emits, and `tool` and `text` are not invented — 2026-08-25

**Decision:** `packages/shared` defines the trace/event union from the evidence of what the code
emits and prints, not from `docs/04-architecture.md:28`, which named six kinds of which one had a
producer. Two shapes, because two interfaces exist: `AdapterEvent`, what an adapter passes to
`onEvent`, carrying no identity; and `Event`, what a run emits, which is an adapter event plus the
step id the engine already supplies at `engine.js:247` (`ui.trace(step.id, e)`) or one of the
engine's own. The disposition of every candidate:

| What exists today | Where | Disposition |
| --- | --- | --- |
| `{ type: 'spawn', vendor, cmd }` | `claude.js:31`, `codex.js:52` | member, fields verbatim |
| `{ type: 'stdout', line }` | `claude.js:32`, `codex.js:60`, `mock.js:66` | member, fields verbatim |
| `{ type: 'retry', vendor, attempt, of, delayMs, reason, message }` | `adapters/index.js:109` | member, fields verbatim — emitted by the contract layer, not by any vendor |
| `ui.step(id, m)` | `bin/harness.js:66` | member `step` |
| `ui.done(id, m)` | `bin/harness.js:67` | member `done` |
| `ui.info(m)` | `bin/harness.js:64` | member `info`, no step id |
| `ui.warn(m)` | `bin/harness.js:65` | member `warn`, no step id |
| `ui.gate({kind, reason, ticketDir, retry})` — which *asks* | `bin/harness.js:74–127` | the **question** is a member; the answer channel is Q-0050's |
| `tool`, `text` (`04-architecture.md:28`) | emitted by nothing | **not added** |

**`tool` and `text` are not invented.** Producing them requires an adapter to parse vendor JSONL
into normalised events, which changes what `--verbose` prints (`bin/harness.js:69`) and enlarges
Q-0047's scope. No ticket authorises that, and *"The port preserves behaviour"* (2026-08-25) makes
it a stop-and-report rather than a design opportunity. The asymmetry decides it: widening a
discriminated union later is additive and every non-exhaustive consumer fails at `tsc`, so adding
them once a producer exists costs a type error at build time — while inventing their payloads now,
thirteen tickets deep, costs a shape five later tickets have coded against.

**Register row 22's operative reading, recorded because a child's reviewer will otherwise spend a
round on it.** `harness/port-charter.md` §2 row 22 says *"nothing downstream learns which vendor
produced an event"*. **That wording cannot be applied literally.** `spawn` and `retry` carry
`vendor` today, so removing it is a behaviour change the port does not authorise; *"Codex cost is
reported as tokens, never priced locally"* (2026-08-22) requires per-vendor roll-ups and forbids a
blended number; and `contracts/Q-0011/run-manifest.schema.json` **requires** `vendor` in both
`$defs.usage` and `$defs.vendor_rollup`, in a frozen contract. The reading is therefore: **no
vendor-specific field and no vendor branching outside an adapter; a neutral `vendor` label is
permitted and required.** The label is an open string, not an enum of the three shipped names — a
contributor's `gemini` adapter must not need `packages/shared` edited to emit an event, and an
unknown adapter name is already refused with a good message by `getAdapter`
(`adapters/index.js:29`).

**The envelope is the step id and nothing else** (Q-0041's OQ-4). Ordering, timestamps, run ids,
terminal semantics, error representation and how a gate answer travels back all belong to Q-0050,
which is why they are absent rather than sketched. Nothing in `shared` emits, persists, replays or
transports an event; `04-architecture.md:70–71` and `contracts/Q-0011/run-history-writer.contract.md:3–4`
both freeze the absence of a persisted event stream in v1.

**Alternatives considered:** (a) Implement the six documented kinds, on the grounds that the
document is the spec. Rejected: five of the six have no producer, so their payloads would be
invented, and the union would then be unable to express what the CLI prints today — the failure
would surface at Q-0050, where it is a behaviour change with five tickets queued behind it.
(b) Forbid `vendor` anywhere in the union, which is row 22 read literally. Rejected on three
independent grounds above, one of them a frozen contract. (c) One union rather than two, with the
step id optional on every member. Rejected because "optional" would be the only thing distinguishing
"an adapter did not know" from "the engine forgot", and those are different facts.

**Why:** the union is being designed at the point of maximum leverage and minimum evidence, in the
package everything imports, before anything emits it. Two documents disagreed with each other and
both disagreed with the code, so the only defensible source was the emitting lines themselves —
which is also why the package's suite asserts that those lines still read the way they are quoted
here, rather than trusting the transcription.

**Found by:** Q-0041, whose merged requirement raised the six-versus-three contradiction as AC-8 and
row 22's literal impossibility as AC-9/OQ-7.
