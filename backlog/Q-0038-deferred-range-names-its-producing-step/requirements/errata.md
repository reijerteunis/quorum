# Errata — Q-0038

*Written at the requirements gate, 2026-08-30, before any implement round. This file is normative
**only for the clauses it names**; `requirements/merged.md` governs everything else. It resolves a
contradiction and widens no scope.*

Both `implement` and `review` read this file (`harness/flows/chore.yaml`), so an entry reaches any
step whose prompt is built after it is on disk. Nothing here was discovered by an agent — it is the
open question the merged requirement raised as OQ-2, ruled by the human at the gate so that a review
round does not spend money re-opening it.

## E-1 — AC-8 is bounded by a frozen contract clause that predates `--base`, and the clause is superseded for the override path only — 2026-08-30

**Supersedes** `contracts/Q-0006/review-runtime.contract.md:21–22`, the sentence *"A missing base
ref is an error naming `repo.base_branch`, `harness/harness.yaml`, and the ref."*, **for runs given
a `--base` override and for no other run.**

**Replacement.** When a run was given `--base` and the effective base does not resolve, the error
names the override and the revision supplied, and names neither `repo.base_branch` nor
`harness/harness.yaml`. When no override was given, the sentence stands unchanged and byte for byte
— which is what AC-9 pins, through `spike/test/q0006-engine.js:117–120`, a fixture that drives the
failure from `f.config.repo.base_branch` and is not edited.

**Why the contract does not reach this case, and why it is superseded anyway.** The contract defines
`{base}` at `:14` as *"the resolved base branch"* — the configured one; there was no other kind when
it was written on Q-0006. `harness run --base` shipped with Q-0077 on 2026-08-29, three weeks later,
and the contract was not amended. So the clause describes a path that is still exactly as described,
and says nothing about a path that did not exist.

That reading is sound and it is deliberately **not** relied on. Read alone, `:21` is an unqualified
sentence about *a missing base ref*, and a reviewer who reads it that way is reading it reasonably.
An open question ruled inside a requirement is advisory; this file is not. Binding it here costs
nothing now and saves the round that would otherwise be spent discovering that neither the
implementer nor the reviewer is entitled to settle whether a frozen contract still applies — the
shape *"a loop spending its budget on work no agent in it can perform"* names, and the reason
*"A reviewer approves the change it asked for"* (2026-08-29) says an erratum must be written **as
soon as the contradiction is provable** rather than at an exhaustion gate.

**What this erratum does not settle.**

- **`contracts/` is not edited, by anyone, on this ticket.** It is outside the chore role's write
  paths (`harness/roles/developer-generalist.md:3`), so a criterion naming it could not be
  satisfied — *"A requirement may not name a surface its flow cannot write"* (2026-08-25). Whether
  the Q-0006 contract should eventually be amended to describe the override path is a separate
  question for whoever next opens that file, and it is not a defect in Q-0038's change.
- **Nothing about what `--base` does.** It moves the diff anchor and nothing else; only the message
  changes. The three sites that merge a base into the ticket's branch are untouched.
- **The sibling clause at `:130` of the same fixture** — that the integration-branch message does
  *not* mention `repo.base_branch` — stays true and is not superseded.
- **No other clause of any contract under `contracts/`.** This entry names one sentence in one file.
