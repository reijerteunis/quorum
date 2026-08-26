# Errata — Q-0044 requirements

Amendments to `requirements/merged.md`, agreed after the requirements gate. The implementer reads
this file beside the requirement (`chore.yaml`'s `implement` step lists `requirements/errata.md`
among its inputs, and so does `review`); where this file and the requirement disagree, this file
wins **for the clauses it names and no others**. Each entry is dated and names the clause it
supersedes. Nothing here may widen scope — an erratum resolves a contradiction, it does not add
requirements.

## E-1 — 2026-08-26 — AC-4's refused-forms list, on trailing whitespace

**Supersedes:** the words "leading or trailing whitespace" in **AC-4**'s *Test* clause
(`requirements/merged.md:211`), to the extent they cover a **ticket-prefixed** endpoint.

**Replacement:** the grammar is `/^harness\/\{id\}\/.+/` as AC-4's own normative rule states it, so
a trailing space or tab on a ticket-prefixed endpoint is **accepted**, in either position. Leading
whitespace anywhere, and trailing whitespace on a `{base}` endpoint, remain **refused** — four
forms, all pinned in `packages/core/src/lint/lint.test.ts:287–290`. AC-4's *Test* clause is
corrected to read "leading whitespace, and trailing whitespace on a `{base}` endpoint". Every other
word of AC-4 stands, register row 12 included.

**Why the requirement was wrong.** AC-4's two halves disagree with each other and the rest of the
document does not. Its normative rule — each endpoint "is exactly `{base}` or matches
`/^harness\/\{id\}\/.+/`", with "no whitespace trimming" — accepts a trailing space, because `.+`
matches one and nothing trims it. Only a parenthetical inside a *Test* clause narrows it. Against
that parenthetical stand AC-4's own rule, AC-11 ("no rule is added, tightened or newly applied"),
charter §2, the ticket body's "deliberately not relaxed", and the merged requirement's own
precedence note: *"where a candidate's transcription disagreed with the code, the code won"*.
Narrowing the grammar would be a behaviour change, and the port authorises exactly one, which is
Q-0050's.

**Verified by running both linters, not by reading either.** Whitespace can sit in four positions
in `A...B`; spike and port agree on all of them, and only one accepts:

| range | spike | port |
| --- | --- | --- |
| `" {base}...harness/{id}/integration"` | refused | refused |
| `"{base} ...harness/{id}/integration"` | refused | refused |
| `"{base}... harness/{id}/integration"` | refused | refused |
| `"harness/{id}/integration...{base} "` | refused | refused |
| `"{base}...harness/{id}/integration "` | **accepted** | **accepted** |
| `"harness/{id}/integration ...{base}"` | **accepted** | **accepted** |

So the conflict is internal to AC-4, not a divergence between the port and the code it transcribes.

**What this erratum does not settle.** Whether the grammar *should* refuse trailing whitespace. It
is a real rough edge — `harness/{id}/integration ` is not a ref anyone means — and tightening it is
a behaviour change that belongs to its own ticket beside Q-0055 and Q-0056, not to the port. It
also settles nothing about any other clause of AC-4 or any other criterion.

**Found by:** the chore review, rounds 1, 2 and 3, each returning this single blocker and each
asking for an erratum; and by the implementer, which declined to pick a side under AC-12's
stop-and-report and drafted this text in `dev/implement-report.md` §3. Committed by the owner at the
exhaustion gate of run 2, so that closing it is transcription rather than authoring.

## E-2 — 2026-08-26 — AC-1's "six names" is the runtime surface

**Supersedes:** the words "six names, no more" in **AC-1** (`requirements/merged.md:129`), so far as
they are read to cover **type-only** exports.

**Replacement:** AC-1 constrains the module's **runtime** surface, which is exactly the six names it
lists. A type-only export — an `interface` or a `type` naming what an exported function returns or
accepts — is not one of the "names" AC-1 counts, and `lint.ts` exporting `FlowRecord`,
`FlowFileReport` and `DirectoryReport` satisfies AC-1. Every other word of AC-1 stands: the six
runtime names, TypeScript strict, no `any`, no `@ts-ignore`, no import from `spike/**`, no zod call
inside `lintFlow`, and the untouched package entry point.

**Why the requirement was wrong.** Three independent readings, and they agree.

1. **AC-1's own test names the surface it means.** Its *Test* clause is "`Object.keys` over the
   module namespace equals the six names" (`merged.md:139`). `Object.keys` sees runtime values and
   nothing else, because a TypeScript interface is erased at compile time. A criterion whose only
   check is structurally blind to type exports was not written about type exports.
2. **Two landed, reviewed children already do this.** On `main`,
   `packages/core/src/git/git.ts` exports four interfaces beside its functions — `AncestryOptions`,
   `ShallowState`, `EmptyRangeEvidence`, `Containment` (Q-0042) — and
   `packages/core/src/backlog/backlog.ts` exports four — `Frontmatter`, `TicketRecord`, `TicketFile`,
   `NewTicket` (Q-0043). Both passed a cross-vendor review. Refusing the pattern here would make
   `core` internally inconsistent across three modules ported by one parent ticket.
3. **The alternative breaks a consumer this port has.** `lintFlowDirectory` returns `FlowRecord[]`
   and `lintDirectory` returns `DirectoryReport`. Q-0050 imports from this module, as
   `spike/src/engine.js:11` does today; making the return types unnameable is a surface reduction no
   decision authorises — the same reasoning by which OQ-3 kept `lintFlowDirectory` exported.

**What the finding got right, and what it costs.** The reviewer's mechanism is correct and is worth
recording separately from its remedy: **AC-1's `Object.keys` test cannot detect a type export at
all**, so it reports success over a surface it never examined. That is *"a check that skips its
subject must not report success"* (`docs/DECISIONS.md`, 2026-08-25) arriving through type erasure.
This erratum decides that the three exports are correct; it does **not** add the assertion that
would pin them. So the module's type surface is presently unpinned, and a later ticket may export a
fourth interface with nothing turning red. That is accepted here rather than hidden, and it applies
equally to `git.ts` and `backlog.ts`, which have the same gap and no test either — which is why it
belongs to a ticket covering all three modules rather than to this one.

**What this erratum does not settle.** Whether `core`'s modules should pin their type surface, and
how. It also settles nothing about AC-1's other clauses, or about `packages/core/src/index.ts`,
which OQ-2 decided and this does not touch.

**Found by:** the chore review, round 4 — the first round after E-1 closed the trailing-whitespace
blocker. Committed by the owner at the second exhaustion gate of run 2.
