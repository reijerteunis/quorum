# Q-0017 — errata to `requirements/merged.md`

Amendments decided at or after the gate and binding on the implementer and the reviewer alike. Each
names the clause it supersedes. The rest of `merged.md` stands.

## E-1 — the gate ratified both blocking questions as recommended — 2026-09-16

**Supersedes** OQ-1's and OQ-2's open status and GO-1, GO-2, GO-3, GO-4 and GO-8 as work owed. All
fifteen criteria stand exactly as written; the criteria were drafted for these answers, so **nothing
in §3 moves**.

### GO-1 — two tickets, and the successor is open

**Q-0017 is the board**, and also builds the fetch module, the request-state vocabulary and the
shared wire schemas. **Q-0127 is the ticket page**, opened at this gate with Appendix A transcribed
in full, and runs second because it inherits those three. **Not three tickets**: separating
`GET /tickets/:id` from the screen that consumes it leaves a route with no consumer to prove it
against.

The seam is measured rather than chosen: the board is a screen over two endpoints that already
exist, and the ticket page is a **new route plus** a screen, carrying its own confinement surface, a
`.harness/` exposure ruling over 259 untracked files, and a payload design forced by a **3.0 MB**
largest folder and a **1.46 MB** largest file. Q-0014's gate split this work at this seam and
Q-0013's at the transport seam.

### GO-2 — the ticket-file figure, with its legend, labelled as neither thing it is not

The card carries the number `quorum board` already prints, with `unpricedRuns` and the legend, and is
labelled **neither "per vendor" nor "cost to date"** — because it is neither. AC-2's cost field and
AC-10 stand.

**Ruled on the measurement this gate produced rather than on either candidate's reasoning, both of
which were wrong about why.** Across 145 manifests and 105 tickets: the ticket-file sum and the
manifest aggregate **agree to a cent wherever both exist**; the aggregate is blind to five tickets
worth **$200.20** whose runs predate `.quorum/runs`; the ticket file is blind to a run in flight —
including this ticket's own **$7.93** while the requirements run was still going; and **276 of 665
billed occurrences, 41.5%, every one of them codex, are unpriced** and invisible in `ticket.md`
altogether. **Neither figure is complete and each is complete where the other is not**, which is why
the label matters more than the number.

**The per-vendor roll-up is routed to Q-0015**, whose cost ticker is where the design brief specifies
one and where *"Codex cost is reported as tokens, never priced locally"* (2026-08-22) permits the
form. It is **not** built here: `GET /tickets` would then read run history on every request, over a
store with no cap (Q-0076).

### GO-3 — the successor is open

**Q-0127**, *"The ticket page renders a ticket's folder"*, `draft`, created at this gate rather than
named in a closing entry.

### GO-4 — no decision entry is owed and no glossary term is coined

Recorded so it is not re-litigated at the implement step. Nothing here contradicts a landed entry:
the cost ruling **applies** *"Cost and duration per stage, measured"* (2026-08-22) and the
tokens-only entry rather than amending either, and the split is a sizing judgement, which no entry
governs.

### GO-8 — discharged, and it was this operator's error

`docs/06-development-plan.md:3790` named **`GET /runs/:id/cost`** as a route answering cost per run.
**It does not exist.** The daemon registers **twelve** routes; that string occurs once in the whole
package, inside `packages/server/src/package.test.ts:726`'s fixture named `hostile` — written to
prove the route-deriving guard collects a route it has never seen. An enumeration that grepped
`packages/server/src/*.ts` **including test files** read that counter-example as production fact, and
the ticket body took the error from the page.

**Corrected in the plan at this gate.** **The ticket body is not corrected**, because the engine
restores it from its run-start snapshot; this erratum is the correction the implement step reads.
What exists is **`GET /history/:id`**, answering `tokensByVendor` — per-vendor **tokens**, per run,
deliberately not cost.

**Do not re-derive the route list from either document.** Derive it from production source alone:
`grep` `packages/server/src/*.ts` **excluding** `*.test.ts`.
