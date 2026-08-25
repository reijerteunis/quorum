# Review — Q-0041 iteration 3

major: packages/shared/src/flow.ts:50 The implementation explicitly rejects values that `lintFlow` accepts, violating AC-3’s binding requirement that `lintFlow` success implies schema success. The implementation report acknowledges this unresolved gap, but a report or local decision cannot amend the merged requirement. Widen the schema to satisfy the implication, or obtain a requirements amendment before landing, and add executable boundary tests against `lintFlow`.

major: packages/shared/src/flow.ts:122 The flow schema deliberately leaves `route` as an untyped passthrough property even though the ticket scope and AC-3 explicitly require the schema to cover `route`. This prevents downstream consumers from receiving the promised shared route type. Declare the existing route structure without adding semantics, preserving unknown nested keys where required.

major: packages/shared/src/events.ts:84 The event variants use `.passthrough()`, so schemas and inferred event types admit arbitrary vendor-specific fields such as `session_id`, contradicting AC-8’s verbatim payload definitions and AC-9’s requirement that no field be vendor-specific. Explicitly reject unknown event fields while retaining the documented open `vendor` label, and test that vendor-specific extras fail parsing.
