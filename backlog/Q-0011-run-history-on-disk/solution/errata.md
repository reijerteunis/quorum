# Errata — Q-0011 requirements

Amendments agreed during solutioning. Development and QA implement what is written here; where
this file and the named requirement clause disagree, this file wins for that clause only. An
erratum resolves a contradiction and does not widen scope.

## E-1 — 2026-08-23 — null-usage adapter occurrences are absent from the roll-up

**Supersedes:** `requirements/merged.md` AC-11, the phrase “per vendor that ran an adapter step”.

**Replacement:** The manifest roll-up contains each vendor for which an adapter occurrence
reported a usage object. An adapter occurrence that failed before reporting usage remains in
manifest detail with `usage: null`, but creates no vendor entry and is not counted as an unpriced
step. A `usage` event exists if and only if usage was reported, and roll-up recomputation is over
those emitted final aggregate events.

**Why:** The adapter name identifies routing, but it is not guaranteed to be the billing vendor
reported by usage. Creating a vendor entry from routing metadata would make the manifest contain
an accounting row that cannot be reproduced from the required usage-event stream and would
classify “no accounting report” as “reported without a price”. Exclusion preserves the stronger
AC-11 invariant: every roll-up row is exactly reproducible from persisted usage events without
inference.

**Scenario impact:** QA covers fail-before-usage as visible in detail and absent from the roll-up;
it covers a reported usage object with `cost_usd: null` as an included unpriced step.
