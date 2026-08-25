# Errata — Q-0009 requirements

Amendments to `requirements/merged.md`, agreed after the requirements gate. The implementer reads
this file beside the requirement (`chore.yaml`'s `implement` step lists `requirements/errata.md`
among its inputs); where this file and the requirement disagree, this file wins **for the clauses
it names and no others**. Each entry is dated and names the clause it supersedes. Nothing here may
widen scope — an erratum resolves a contradiction, it does not add requirements.

## E-1 — 2026-08-25 — the charter lives in `harness/`, not in the ticket folder

**Supersedes:** Scope item 1 and the surface clause of **AC-5** in `requirements/merged.md`, so far
as they place the port charter at
`backlog/Q-0009-port-the-spike-to-packages-core/port-charter.md`.

**Replacement:** the charter is **`harness/port-charter.md`**, reached from
`harness/architecture.md`'s pointer. Every other word of Scope item 1 and AC-5 stands — the charter
carries the same sections, the same freeze policy, the same exemption path and the same
outstanding-SHA statement, and it is still the normative source the fourteen children cite.

**Why the requirement was wrong.** It named a surface the flow it was routed to cannot write.
`commitAll` (`spike/src/fanout.js:80–93`) runs `git checkout -- backlog` and `git clean -qfd --
backlog` before every agent step commits, so an agent's writes under `backlog/` are reverted and
its additions deleted — deliberately, because the engine owns ticket state and an agent that can
edit `ticket.md` can advance its own stage. The requirement asked `chore.yaml`'s `implement` step
for three files under `backlog/`, and run 2 spent $23.25 across three implement passes and three
`revise` verdicts establishing that neither the implementer nor the reviewer could move: the
implementer wrote the charter to `harness/port-charter.md` and said in its report that it could not
do otherwise, and the reviewer correctly refused an unauthorised relocation. The loop exhausted.

**Why `harness/` is the right answer and not merely the reachable one.** `docs/README.md` says the
canonical per-project context an agent reads at run time lives in `harness/`, and that is precisely
what this charter is: fourteen runs read it for their route, their invariants and their non-goals.
A ticket folder holds one ticket's artifacts; a document that governs fifteen tickets and is cited
by `harness/architecture.md` is harness context. Had the requirement been written against the flow
it was routed to, `harness/` is where it would have put the file to begin with.

**What this erratum does not settle.** AC-1's second half and AC-8 also name `backlog/` as their
surface — the routing citation in each of the fourteen child bodies, and the reconciliation of
Q-0009's own. Those are not relocations and cannot be amended away: the material genuinely belongs
in the ticket bodies. They are performed by a human commit outside the flow, which is what the
charter's §11 specifies and what closed them here. The general lesson is recorded in
`docs/DECISIONS.md`.
