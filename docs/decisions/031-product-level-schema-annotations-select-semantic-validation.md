# Product-level schema annotations select semantic validation — 2026-08-23
**Decision:** After ordinary JSON Schema validation, `harness validate` may select a named
product-level semantic pass through `x-quorum-contract`. The first recognised value is
`run-manifest-v1`, whose pass checks lifecycle and occurrence invariants and exactly recomputes
the per-vendor roll-up. Missing or unknown annotations explicitly report that semantic checks
were skipped; they never imply run-manifest validation. The parser and JSON Schema behaviour
remain generic, and no JSONL/event-stream capability is introduced by Q-0011.
**Alternatives considered:** Encode every invariant in JSON Schema — rejected because exact
grouped roll-up recomputation, including the distinction between an unreported `null` and a
reported zero, is not structural validation. Select checks by schema filename or `$id` — rejected
because both couple behaviour to storage location or ticket-specific identity rather than a
versioned product contract.
**Why:** A manifest can be structurally valid while disagreeing with its persisted occurrence
usage. An explicit annotation makes the extra executable contract reviewable and lets generic
schemas retain their existing behaviour.
