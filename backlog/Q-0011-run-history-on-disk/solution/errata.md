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

## E-3 — 2026-08-23 — gate interruption is recorded at run level only

**Supersedes:** `requirements/merged.md` AC-10, the sentence “A step interrupted at a gate appears
as `interrupted`.”

**Replacement:** Occurrence-level `interrupted` applies only when an adapter, script, or integrate
occurrence is in flight. An interrupt received while the run is at a gate marks the run
`interrupted` and creates no occurrence, because gates allocate no occurrence under AC-4.

**Why:** After the scope cut, a gate cannot carry an occurrence status. Recording the interrupt on
the run preserves the terminal outcome without inventing a gate directory or shifting occurrence
numbering.

**Scenario impact:** QA covers interruption during in-flight adapter, script, and integrate work
at occurrence level, and interruption at a gate at run level with no gate occurrence.

## E-4 — 2026-08-24 — store health outranks an empty query result for the exit code

**Supersedes:** `contracts/Q-0011/runs-cli.contract.md`, the clause reading “zero matches is an
empty list and exit zero, whether the ticket has never run or does not exist elsewhere”, **only
where a malformed sibling was also named in the same invocation**. The clause is otherwise
unchanged.

**Replacement:** When a listing renders one or more malformed-sibling warnings, the final exit is
non-zero regardless of how many runs the selection matched. Zero matches with no warnings still
exits zero. This applies to the ticket-filtered listing exactly as it already applied to the
unfiltered one.

**Why the contract was ambiguous rather than wrong.** It states two rules that are each correct in
isolation and that both apply to `harness runs Q-9999` in a store containing a corrupt manifest:
“zero matches … exit zero” (:12) and “A malformed sibling is named, valid siblings are still
rendered, and the final exit is non-zero” (:18–19). Nothing said which governs when both hold, so
the implementation and its test picked one reading and the two round-2 review panellists picked the
other. Neither side was contradicting the contract; the contract had not decided.

It is decided here in favour of store health, for three reasons. The zero-matches clause is scoped
by its own sentence to a question about *identity* — not conflating “this ticket never ran” with
“this id is a typo” — and says nothing about the integrity of the store it read. The warning is
printed either way, so exiting zero while naming corruption is the “failure that withholds the one
thing the reader needs” shape this project has now recorded three times. And the asymmetry of being
wrong matters: a script that treats exit zero as “history is fine” proceeds over a corrupt store,
whereas a script that stops on a non-zero exit loses nothing but a second look.

**Scenario impact:** `spike/test/q0011-runs-cli.js`, scenario `AC-12/EDGE-10/EDGE-11`, asserts
`equal(cli(root, ['runs', 'Q-9999']).status, 0)` against a fixture that deliberately contains a
malformed `bad` sibling. That assertion is superseded. It is re-pointed rather than deleted: zero
matches is still asserted to exit zero, on a clean fixture, so both contract clauses keep coverage.

**Provenance:** raised independently by both panellists in review round 2 of 2026-08-24 (run #13),
each noting that the code comment at the filtered branch resolved a frozen contract by argument
instead of by erratum. Requested by the maintainer the same day, after first electing to ship the
code fix with the test left failing so the disagreement was visible.
