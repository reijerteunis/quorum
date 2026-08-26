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

## E-2 — 2026-08-26 — Q-0063 fixes `exec()` in the spike, and Q-0047 ports the fixed version

**Supersedes:** nothing in `requirements/merged.md`. This entry amends **`harness/port-charter.md`
§3's freeze-SHA table** and adds one obligation to **Q-0047**. It is recorded here because the
charter is Q-0009's artifact and §3 says a change to the freeze's preconditions is made
"deliberately and in this file".

**What is authorised.** Q-0063 modifies `spike/src/adapters/claude.js` — the shared `exec()` helper
— to attach an `'error'` handler to the child's stdin and treat `EPIPE` as *the child closed its
input*, resolving through the normal `close` path so the vendor's own exit code, stdout and stderr
remain what the caller reports. Authorised by Ruud, 2026-08-26.

**This is not a freeze exemption, and no trailer is required.** §3 binds "no ticket in Q-0009's
set — Q-0041 through Q-0054, and Q-0009 itself", and the machine-readable `children` list holds
those fourteen. **Q-0063 is not among them**, and §3 says in as many words that the freeze "is a
property of *these fifteen tickets*, not of any role", naming Q-0038 and Q-0040 as chore-shaped
tickets whose whole subject is `spike/src`. Q-0063 is the same shape. The `Port-freeze-exemption`
trailer is a property of a *child's branch* and would be malformed here, since the guard requires
the trailer to name that branch's own ticket id.

**What this erratum therefore does, in two parts.**

1. **Q-0063 joins §3's freeze-SHA table.** That table lists the open tickets which legitimately edit
   `spike/src` and gates when `freeze-sha:` can stop reading `not-yet-recorded`. It named four —
   Q-0037, Q-0038, Q-0039, Q-0040. It now names five. Recording a SHA against a stale list would
   anchor the freeze at a commit that a still-open ticket is entitled to invalidate, and the
   SHA-anchored half would then fail for a change the charter had already blessed.
2. **Q-0047 ports the fixed `exec()`, not the version frozen at M2's start.** This is the half that
   matters and the reason an erratum exists rather than a commit message. The port's proof is that
   the spike is its *independent witness* — §3: "a witness that has been edited is not one" — and
   this edits it. The obligation is therefore explicit: Q-0047's implementer ports `exec()`
   **including the stdin `'error'` handler**, and its reviewer treats a port of the pre-fix shape as
   a blocker citing this entry. A silently reverted fix would be invisible in exactly the way the
   preserve-behaviour policy exists to prevent — both suites green, the product wrong.

**Why the fix is not deferred to Q-0047 instead.** `exec()` is shared by both shipped adapters
(`claude.js:32`, `codex.js:58`) and is on every run's path. The write is the whole prompt — 54 KB
and 133 KB on Q-0043's two steps — against a 64 KB pipe buffer, so it cannot complete in one pass
and depends on the child draining it. When the child exits first the write raises `EPIPE` on a
stream with no listener and Node throws `Unhandled 'error' event`, killing the process instead of
failing the step: the vendor's own message is replaced by a `node:events` stack trace, which
defeats `authError()` and reproduces the M0 failure recorded as *"a failure that withholds the one
thing the reader needs"*. It is also, today, the sole remaining cause of a red `spike (regression
suite)` job on every push — and a permanently red CI is one everyone learns to ignore, which is how
the next real regression ships unnoticed. Q-0047 is several children away.

**What this erratum does not settle.** Whether `exec()`'s `resolve`-rather-than-`reject` behaviour
on spawn failure (`p.on('error')` → `code: -1`) is right; it is preserved as-is. Whether any other
`spike/src` defect may be fixed in place — this authorises one named change and no class of
changes. And it records no freeze SHA: the table now has five rows and all five are still open.
