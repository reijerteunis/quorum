# A dry run changes nothing the caller passed it — 2026-09-11

## Decision

**`runFlow` mutates the caller's ticket on a real run and a copy of it under `--dry`.**

`finish` and `recordEvent` advance `meta.stage`, replace `meta.iterations` — which `RunContext`
documents as an alias rather than a copy — and append to `meta.history`, all of it outside the
`if (!context.dry)` guard. Under `dry` the run now takes `structuredClone` of the ticket at run
start, so every one of those lands on the run's own object and the caller's is exactly as it handed
it over.

**The defect was the asymmetry, not the mutation, and that is why the answer is not "never mutate".**
On a real run the mutation travels with a write: `persistence.writeTicket` puts the same values on
disk, so a caller holding the object sees what the backlog says. Under `dry` every writer is a no-op,
so the object would carry a stage, a history entry and a counter set that exist **nowhere**.

## Alternatives considered

**Never mutate the caller's ticket, on any run.** The cleaner-sounding contract, and the one this
ticket's own body called *"the cheap answer"*. Implemented first and then **refused on measurement**:
it breaks nine tests, six of which pin the real-run mutation as behaviour rather than as an accident.
Reading those six is what produced the rule above — on a real run the object and the backlog agree,
and a contract that made them disagree would be worse than the one it replaced, not better. It would
also leave `runFlow`'s result readable only from disk or the terminal event, which is a larger change
than the defect justifies.

**Guard each of the four mutation sites with `!context.dry`.** Same effect, four places to keep in
step, and a fifth site added later inherits nothing. The clone is one line at the boundary where
`readOnlyBacklog` is already chosen, so the two dry substitutions sit together and read as one idea.

**Leave it and document it.** It has been documented since Q-0050 — `lifecycle.ts` carried
`Why: preserved defect, see Q-0050 AC-10` — and the documentation is what made it survive three
years of nobody being hurt by it. Nothing was, because `packages/cli` reads a ticket, hands it over
and never looks at it again.

## Why

**M3's server is the first caller that will hold a ticket across runs**, answering a `GET` from an
object in memory. Against today's code a `--dry` walk would advance that object's stage and append a
history entry that exists in no file, and the server would serve both. Settled **before that server
exists** rather than after it is built against the defect, which is the same reason Q-0039's lock and
Q-0111's error-message split were taken when they were.

It also makes true a claim `docs/GLOSSARY.md` already makes. **Dry run** says a `--dry` walk reports
*"what each step would do"* without *"writing anything"*; advancing a stage in memory is doing one of
the things rather than reporting it. The glossary gains the clause in the same change, because the
sentence was right and the code was not.

Retires the `preserved defect, see Q-0050 AC-10` registration in `lifecycle.ts`, which is why
`q0050.source.test.ts`'s cross-file count of preserved-defect markers goes 14 → 13 — a decrement that
file is deliberately built to make expensive, so it is recorded here with what was removed.
