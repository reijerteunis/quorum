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
