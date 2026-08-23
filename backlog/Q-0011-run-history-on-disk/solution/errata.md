# Errata — Q-0011 requirements

Amendments agreed during solutioning. Development and QA implement what is written here; where
this file and the named requirement clause disagree, this file wins for that clause only. An
erratum resolves a contradiction and does not widen scope.

## E-1 — 2026-08-23 — null-usage adapter occurrences are absent from the roll-up

**Supersedes:** `requirements/merged.md` AC-11, the phrase “per vendor that ran an adapter step”.

**Replacement:** The manifest roll-up contains each vendor for which an adapter occurrence
reported a usage object. An adapter occurrence that failed before reporting usage remains in
manifest detail with `usage: null`, but creates no vendor entry and is not counted as an unpriced
step. Roll-up recomputation is over the final aggregate `usage` objects persisted on manifest
occurrences.

**Why:** The adapter name identifies routing, but it is not guaranteed to be the billing vendor
reported by usage. Creating a vendor entry from routing metadata would make the manifest contain
an accounting row that cannot be reproduced from persisted occurrence usage and would
classify “no accounting report” as “reported without a price”. Exclusion preserves the stronger
AC-11 invariant: every roll-up row is exactly reproducible from persisted occurrence usage without
inference.

**Scenario impact:** QA covers fail-before-usage as visible in detail and absent from the roll-up;
it covers a reported usage object with `cost_usd: null` as an included unpriced step.

## E-2 — 2026-08-23 — manifest validation includes contract-specific semantic checks

**Supersedes:** `requirements/merged.md` AC-14, the sentence “`harness validate` needs no new
capability: the manifest is a single JSON document and the existing command already validates
one.”

**Replacement:** Existing JSON/YAML parsing remains unchanged and JSONL support is not added.
When a schema declares the recognised product-level annotation
`x-quorum-contract: run-manifest-v1`, `harness validate` runs the run-manifest semantic checks in
`contracts/Q-0011/runs-cli.contract.md` after structural JSON Schema validation. An absent or
unrecognised annotation produces an explicit skipped-checks notice.

**Why:** JSON Schema permits a genuinely reported zero cost, so it cannot distinguish that valid
value from AC-14's required mutation of an unpriced vendor's roll-up from `null` to `0`. Exact
roll-up recomputation requires the occurrence usage and is semantic validation. Naming this
capability is more honest than claiming the required mutation is structurally detectable.

**Scenario impact:** QA validates a real mock-run artifact and proves the token-only roll-up
mutation fails with the vendor and `cost_usd` field named. Generic schema validation is unchanged.
