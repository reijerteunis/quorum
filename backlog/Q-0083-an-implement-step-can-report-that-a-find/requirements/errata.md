# Errata — Q-0083

## E-1 — two frozen contracts require a bound greater than zero, and zero is now legal

**Raised** at the cross-vendor review of this ticket, 2026-09-08, and ruled here rather than by
editing either contract: both are frozen.

`contracts/Q-0033/cli-review-surface.contract.md:44` requires *"each `on_fail.max_iterations` to be
an integer greater than zero"*, and `contracts/Q-0006/review-lint.contract.md:18` says *"Every
`on_fail` requires `max_iterations` to be an integer greater than zero"*.

**Both clauses are superseded in their bound and unchanged in everything else.** The rule is now
**an integer of zero or more**, and negative and non-integer values are refused exactly as before,
with the same message shape naming the step and the field. Nothing else in either contract moves:
the counter rules, the diagnostics, the cycle detection and the fixtures are untouched.

**Why the bound moved.** A refusal that has nowhere to go costs a round that cannot converge, which
is what this ticket exists to remove — measured at $45.44 across Q-0091 and Q-0101 in rounds that
changed no files. Reaching a human on the first failure needs a bound that authorises no unattended
traversal, and every positive value authorises at least one. Zero is not an absence of a bound; it
is the smallest one, and the engine's arithmetic already read it correctly (`count <= limit` is
false at 1 ≤ 0) — only lint forbade it.

**This is an erratum rather than a decision entry** because the ruling it implements already exists:
*"A refused finding is a gate, not another round"* (2026-08-31) named `proceed`/`blocked` routing to
a gate as the right mechanism and said it is *"a flow and engine change rather than a ruling, so it
is Q-0083 and not this entry"*. What was owed was the change, and this is the one clause of two
frozen contracts it contradicts.

## E-2 — the persisted status stays `exhausted`, and the promise is narrowed to say so

**Raised** at the same review. The documents now say a bound of zero means nothing looped, and the
engine still writes `recordOccurrenceEvent(…, 'exhausted', 0)` on that path — so a reader of the
ticket's history and of `runs.log` sees `exhausted` for a step that never looped.

**Ruled: the persisted status is unchanged, and the promise is narrowed rather than the vocabulary
widened.** `exhausted` is the existing name for *the run stopped at an engine-presented gate having
spent its bound*, which is exactly what happened; a bound of zero is spent by the first failure. A
new status would mean a new member of the seven that `packages/shared/src/ticket.ts` and
`docs/02-sdlc-pipeline-spec.md` both enumerate, a new row in every reader that switches on it, and a
migration for histories already written — bought to rename one case of a thing that did happen.

What the documents may therefore claim is about **the sentence a reader is shown**, and that is
where the distinction lives: the gate says *"stopped rather than looping"* where a bound of zero is
spent and *"loop exhausted"* where a positive one is, because a reader answering a gate is owed what
actually happened. They may not claim the persisted status distinguishes the two, and nothing in
this change says it does.
