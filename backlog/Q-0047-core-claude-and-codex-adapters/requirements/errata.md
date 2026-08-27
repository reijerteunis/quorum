# Errata — Q-0047 requirements

Amendments to `requirements/merged.md`, agreed at the requirements gate. The implementer reads this
file beside the requirement (`chore.yaml`'s `implement` step lists `requirements/errata.md` among
its inputs); where this file and the requirement disagree, this file wins **for the clauses it
names and no others**. Each entry is dated and names the clause it supersedes. Nothing here may
widen scope — an erratum resolves a contradiction, it does not add requirements.

## E-1 — 2026-08-27 — register row 2 is split; Q-0052 owns the cross-vendor clause

**Supersedes:** the invariant column of `harness/port-charter.md` §6's **Q-0047** row (`:315`), so
far as it assigns register row 2 (`:128`) whole to this ticket, and the same list as restated in
`backlog/Q-0047-core-claude-and-codex-adapters/ticket.md:87`. §2's register text at `:128` is
unchanged, and the other thirteen children are unaffected.

**Replacement:** row 2 splits into two halves with two owners.

- **Q-0047 owns the adapter half.** `codex` passes `--ignore-user-config` on every invocation and
  passes `-m` only when the caller names a model; `claude` passes `--model` only when the caller
  names one; neither pins a vendor model name anywhere, as a default, a fallback or a literal.
  Enforced by **AC-4** (`requirements/merged.md:312`).
- **Q-0052 owns the cross-vendor half.** *"A role's default model never crosses vendors"* is
  `resolveModel` (`spike/src/engine.js:670`), called from exactly one place — the agent step at
  `spike/src/engine.js:205` — which charter §6 (`:320`) assigns to **Q-0052**. Its frozen coverage
  is `spike/test/smoke.js:620–626`. If Q-0052's cut instead leaves `resolveModel` with the run
  loop, the owner is Q-0050 and the obligation moves with the function.

**Why the charter's assignment does not work as written.** An adapter receives a `model` string or
nothing. It cannot know which role asked, which vendor that role defaults to, or whether the step
overrode it — the decision has already been taken two layers up, in a file this ticket may not
write. A criterion asking Q-0047 to assert the non-leak could be discharged only by testing
`engine.js`, or by asserting something weaker and calling it row 2.

**What this erratum does not do.** It does not weaken row 2. Reporting the row as *closed* by this
ticket is the failure the register exists to prevent; the implement report names the split and
names Q-0052 as owner of the untested half — the same obligation Q-0046's E-1 placed on this
ticket for row 1, which AC-3 now discharges.

**One correction to the requirement's own citations, made here rather than left to be rediscovered.**
`requirements/merged.md` places the `resolveModel` call at `spike/src/engine.js:207` and
`ctx.config.adapterOverride` at `:206` — in E-1, in the Q-0052 block, in AC-10 and in the provenance
section, which explicitly overrides candidate-claude's `:204`. Read against the working tree on
2026-08-27, `ctx.config.adapterOverride` is at **`:204`** and the `resolveModel` call at **`:205`**;
candidate-claude was right and the merge's correction was not. The function names are the load-bearing
part and they are correct throughout, so nothing in the requirement's substance changes. Also
`spike/test/smoke.js`'s `Harness` string is at **`:464`**, not `:465`, in the ticket body and in AC-12.

## E-2 — 2026-08-27 — AC-11's flag-literal assertion covers run argv, not the version-probe argv

**Supersedes:** the *Test* clause of **AC-11** (`requirements/merged.md:485–487`), so far as it
requires *"every flag literal in each capabilities module"* to appear in
`docs/03-adapter-contract.md`. AC-11's two named doc divergences, its "not a licence to hunt for
more" rule and its doc-side-only remedy are unchanged.

**Replacement:** the assertion covers every flag literal each capabilities module contributes to a
**run** invocation — the argv AC-4 pins, element for element. The **version-probe argv** carried as
inert data (AC-4, `merged.md:336–338`) is exempt and is asserted instead against the two adapters'
`check()` implementations, which is the only thing that reads it.

**Why the requirement was wrong.** `--version` appears nowhere in `docs/03-adapter-contract.md` —
verified 2026-08-27, `grep -c -- '--version'` returns 0. AC-4 requires each capabilities module to
carry the version-probe argv; AC-11's assertion as written therefore fails on the first `pnpm test`
over a module built exactly as AC-4 specifies. The implementer's only routes out were to add a
third doc divergence, which AC-11's own "not a licence to hunt for more" appears to forbid, or to
narrow the assertion, which AC-2's blocker rule teaches it not to do unasked. Both are a review
round spent on a contradiction rather than on the port.

**What this erratum does not settle.** Whether the contract document *should* record `--version` and
the presence probe at all. It is a real gap — `check()` is specified in that document's own
`Adapter` interface while the invocation it performs is not written down anywhere — but recording it
is a doc change with no code to justify it in this ticket, and Q-0067 opens the version probe as its
own subject. Left open deliberately; not a finding against the implementer either way.
