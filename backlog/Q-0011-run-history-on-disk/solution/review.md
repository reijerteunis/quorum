# Q-0011 — Final revision directive (supersedes review-round-7.md)

Seven review rounds, $29.15, no stage advanced. This is the last revision before the solution is
either approved or the ticket is parked. Close the four items below and change nothing else.
Do not restructure, do not re-argue the 2026-08-23 scope cut, and do not add contract surface.

## 1. `depends_on` MUST be exactly `[]` on both tasks — verbatim

```yaml
tasks:
  - id: q0011-engine-writer
    role: backend
    depends_on: []
  - id: q0011-cli-reader-validator
    role: tooling
    depends_on: []
```

The previous revision set `depends_on: [q0011-engine-writer]`. `waves()` (`spike/src/fanout.js`)
turns that into two single-role waves that `runFanOut` runs **sequentially** — which is Q-0006's
serialised single-vendor fan-out, the precise failure this ticket was pulled forward from M2 to
avoid. Two roles on two vendors in one wave is not a preference here; it is the ticket's reason
for existing. Cross-task assertions belong to the `integrate` step, not to a dependency edge.

## 2. Both tasks MUST carry a `description`

`taskPromptSection` (`spike/src/fanout.js`) forwards only `title`, `description`, `contracts` and
`depends_on`. An `owns:` list is read by nothing and reaches no agent. Follow the Q-0006 and
Q-0033 pattern exactly: `"Own <files>. … Do not edit <files>."` Each description must state, in
its own words:

- the files that task owns, concretely
- that `contracts/Q-0011/**` is frozen and must not be edited
- that `spike/test/**` belongs to qa-red and must not be edited — this applies to
  **`q0011-cli-reader-validator` in particular**, because `developer-tooling`'s allow-list
  includes `spike/test` and the role prose is the only thing that will stop it

## 3. Strike the `argv` sentence from the writer contract

`run-history-writer.contract.md` says to persist `argv` when a command record needs it, but
`run-manifest.schema.json` sets `additionalProperties: false` with no `argv` property, so obeying
one fails AC-14's `harness validate`. Delete the sentence. Do not add an `argv` field — AC-2
constrains what a spawn record may contain, it does not require one.

## 4. Add erratum E-3 for gate interruption

AC-10 says a step interrupted at a gate appears as `interrupted`, but the scope cut rewrote AC-4
so gates allocate no directory — at a gate there is no occurrence to mark. Add a dated E-3 to
`solution/errata.md` limiting occurrence-level `interrupted` to in-flight adapter, script and
integrate work, and stating that an interrupt at a gate marks the **run** interrupted and no
occurrence. QA needs this before it writes a scenario that can never pass.

## Already fixed — do not touch

`ticket.md`'s body no longer promises an events file; it was corrected by hand on 2026-08-23.
Leave the ticket file alone and remove it from any task's ownership.

## Everything else in review-round-7.md

The remaining major and nit findings are accepted as known and deferred. Note them in the
solution's open questions with one line each. Do not spend this revision on them.

---

## STATUS 2026-08-23, before the final solutioning run

**All four items above are already closed in the current `solution/draft.md`** by a free
architect-only pass. Verify them; do not redo them, and above all do not regress them:

- both tasks carry `depends_on: []` — a previous revision changed this to a dependency edge and
  it destroyed the ticket's purpose; if you find yourself adding one, stop
- both tasks carry a `description` in the `Own <files>. … Do not edit <files>.` form
- the `argv` sentence is struck from `run-history-writer.contract.md`
- E-3 is in `solution/errata.md`

If the draft already satisfies these, say so in your summary and change nothing. A revision that
touches nothing is the correct output when there is nothing left to revise.
