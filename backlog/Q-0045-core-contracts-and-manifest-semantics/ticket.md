---
id: Q-0045
title: core/contracts — ajv validation and the run-manifest semantic pass
stage: requirements
owner: ruud
repos: []
branch: harness/Q-0045/integration
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
    at: 2026-08-26T18:21:13.349Z
    cost: 8.794
---
Ports `spike/src/contracts.js` (41 lines: `validate`, `readData`, `validateFile`, ajv 2020-12 plus
`ajv-formats`) to `packages/core`, and lifts the product-level semantic pass out of the CLI —
`checkRunManifestSemantics` and `computeManifestRollup` at `spike/bin/harness.js:270–360`. Belongs to
M2 in `docs/06-development-plan.md`; parent Q-0009.

**Why the pass moves.** The 2026-08-23 decision makes `x-quorum-contract` a *product-level* schema
annotation whose first recognised value, `run-manifest-v1`, selects checks that JSON Schema cannot
express — lifecycle and occurrence invariants, and an exact recomputation of the per-vendor roll-up
that can tell a genuinely reported zero from an unpriced vendor's `null` mutated to `0`. A versioned
product contract implemented inside a CLI command is a contract M3's server cannot reach and a
contributor cannot find. It belongs beside the validator it extends.

**The rule this ticket exists to keep.** A missing or unknown annotation reports that semantic checks
were **skipped**, explicitly, and never implies the manifest was validated. That is the 2026-08-23
decision, and it is also the first of the two general rules from 2026-08-25: *skipped is not passed*.
`harness run chore Q-0035 --dry` printed a clean preview for a range it had deliberately not looked
at, and the real run then billed $13.86 before discovering the range was broken. Silence must never
render as a green tick — here, in the dry run, or anywhere else.

**ajv stays, and stays separate.** The 2026-08-22 decision that made contracts executable is
explicit that this validator is *deliberately separate from* `checkAgainstSchema` in the adapter
layer: that one guards vendor output and must tolerate variance between CLIs, while a contract that
bends is not a contract. Both dependencies carry their justification in that entry — `ajv` as the
reference draft 2020-12 implementation, `ajv-formats` because contracts use `format: date-time` and
ajv ignores unknown formats by default. Q-0041's zod schemas do not replace either; JSON Schema is
the language solutioning emits and zod cannot read it.

**Acceptance evidence already exists.** Q-0006's committed `ticket-review-state.schema.json`
validates the committed Q-0006 ticket and rejects malformed history with precise errors across
`oneOf`, `if/then`, `format: date-time` and nested `required`; `contracts/Q-0011/run-manifest.schema.json`
is the frozen contract the semantic pass extends. Both are real artifacts in this repository and both
should be the ported tests' fixtures — the 2026-08-22 entry's *"verified on the real artifacts, not a
fixture"* is worth keeping true.

## Port charter

The charter is `harness/port-charter.md`; §6's register is normative for everything below and this
body cites it rather than restating it — where the two ever differ, the register is right.

Route: **chore** (`requirements → chore → human gate`), per *"The port takes the chore route,
except the one child that has new behaviour"* (`docs/DECISIONS.md`, 2026-08-25). Behaviour is
preserved per *"The port preserves behaviour; one exception is authorised and everything else
stops the child"* (`docs/DECISIONS.md`, 2026-08-25) — a defect found while reading the spike is
reported, never fixed in passing.

- **Ports:** `contracts.js` — ajv validation
- **Lifts from `spike/bin/harness.js`:** the `run-manifest-v1` semantic pass and its roll-up recomputation (:270–360)
- **Depends on:** Q-0041 · **Depended on by:** Q-0049
- **Invariants inherited:** register rows 13, 14 (charter §2)
- **Non-goals:** another child's module; editing `spike/**` (charter §3); fixing a defect found
  while reading (§2); the cutover; the `quorum` binary (Q-0010); persisting the event stream;
  anything on v1's exclusion list.
