# Errata — Q-0006 contracts

Amendments to frozen contracts under `contracts/Q-0006/`, agreed after they were sealed.
Development implements what is written here; where this file and a contract disagree, this file
wins **for the clauses it names and no others**. Each entry is dated and names the clause it
supersedes. Nothing here may widen scope — an erratum resolves a contradiction, it does not add
requirements.

## E-1 — 2026-08-22 — retry semantics at an exhaustion gate

**Supersedes:** `contracts/Q-0006/review-runtime.contract.md` §retry (the clause reading "sets
only `iterations.review` to `max_iterations - 1` (persisted value `2` for the shipped limit)").

**Replacement:** `retry` sets `iterations.review` to **`max_iterations`** — persisted value `3`
for the shipped limit of 3. No other counter is modified. The grant is recorded in `runs.log` as
`gate=retry counter=<name> set=<n>`.

**Why the contract was wrong.** The retry answer itself returns `{goto: …}` and causes a
traversal. With `max_iterations - 1` persisted, the following rejection increments to
`max_iterations`, which is still within the bound, and regresses a second time — two further
traversals where AC-18 promises exactly one. With `max_iterations` persisted, the retry's own
regression is the authorised traversal and the next rejection exceeds the bound, re-presenting
the gate. Traced against `handleFail` and `runGate` in `spike/src/engine.js`, and now covered by
the smoke suite ("retry grants exactly one more traversal, no more").

**Also corrected in the engine ahead of this ticket:** `runGate` previously executed
`ctx.counters = {}` on retry, wiping every counter on the ticket — a review retry refunded a
`qa` budget already spent — and granting `max_iterations + 1` further traversals rather than one.
Both are fixed; the contract's intent is now what the engine does.

**Scenario impact:** the scenario asserting persisted `3` is correct as written and needs no
change. Any test asserting `2` is wrong.

## E-2 — 2026-08-22 — the ticket is split; this solution now serves two tickets

**Amends:** `solution/tasks.yaml` (scope only — no contract clause changes).

**Change:** `tasks.yaml` fans out only `Q0006-mock-switch` and `Q0006-runtime`. `Q0006-cli-lint`
and `Q0006-assets-docs` move to **Q-0033**, which consumes this folder's `requirements/merged.md`,
`solution/solution.md` and `contracts/Q-0006/**` unchanged. The pre-split file is preserved as
`solution/tasks-before-split.yaml`. Ownership boundaries in the task descriptions are unchanged,
which is what makes the split clean: the four tasks already declared disjoint file ownership, so
cutting between the second and the third moves whole files, not fragments.

**Why:** a human decision at the architect gate, not an agent's. 30 acceptance criteria hit the
iteration bound at every stage — requirements looped once, solutioning exhausted twice and needed
an out-of-band architect pass, qa-red exhausted once — and two reviewers on two vendors produced
four or five blockers per round without converging. See the DECISIONS entry "Ticket size is the
dominant cost driver", 2026-08-22.

**What this does not change:** no contract is re-cut, no acceptance criterion is dropped, and the
severity of nothing is downgraded. Every criterion is still owned by one of the two tickets —
those touching `spike/src/**` by Q-0006, those touching `spike/bin/**`, `harness/**`, `docs/**`
and `README.md` by Q-0033. A criterion served by both (AC-12's base-ref config is read by the
CLI and enforced by the engine) is owned by the ticket that owns the file where it is enforced,
with the other ticket depending on it.

**Consequence for qa-red:** the tests already written cover both halves. The scenarios and tests
for the surface half are Q-0033's to carry; Q-0006's red phase covers the engine half only.

## E-3 — 2026-08-22 — the runtime task owns `spike/src/adapters/index.js`

**Amends:** `solution/tasks.yaml`, `Q0006-runtime` ownership (scope only — no contract clause changes).

**Change:** `Q0006-runtime` additionally owns `spike/src/adapters/index.js`.

**Why:** the red suite asserts that `checkAgainstSchema` enforces the verdict/findings couplings
the contracts require, and no task owned that file. A compliant agent would have stopped and
reported a blocker; a non-compliant one would have written outside its allow-list. Either way the
ticket could not reach green. See the DECISIONS entry "Step-output validation is Quorum's
contract with its own agents", which settles the question the reviewer asked to have decided.

**Boundary unchanged otherwise:** `Q0006-mock-switch` still owns `spike/src/adapters/mock.js` and
nothing else, so the two tasks remain file-disjoint.

## E-4 — 2026-08-28 — a nit accompanies an approval

**Supersedes** two clauses, which contradict each other and were sealed together:

1. `contracts/Q-0006/review-artifacts.schema.json`, the `Verdict output` branch's
   `if verdict == "approve" then findings.maxItems: 0`.
2. `contracts/Q-0006/review-flow.contract.yaml` §verdict-step `instructions`, the sentence
   *"Findings must be empty on approve and non-empty on changes-requested"*, which sits beside
   *"Approve exactly when no blocker or major survives; nits alone approve"* in the same paragraph.

**Replacement.** The approving verdict — the first value of a step's `verdict` vocabulary — permits
findings, and permits **only** findings prefixed `nit: `. A `blocker:`, a `major:` or a finding
carrying no severity at all is still refused against it, by name and quoting the offender. Every
other verdict still requires at least one finding. The reviewer instructions in both shipped flows
read *"nits alone approve, and a nit you have is reported rather than dropped. On approve every
finding must be a nit; on <other verdict> there must be at least one finding."*

**Why the contract was wrong.** It says both things at once, so no reviewer can satisfy it. Q-0073's
chore run proved which half the engine enforced: the codex reviewer returned `approve` with two
nits — obeying *"nits alone approve"* exactly — and `checkAgainstSchema` rejected the output, so the
run **failed** after its implement step had already been paid for, with the two nits saved only as
raw text. Both nits were real: one named a claim in durable guard prose that the ticket's own
requirement had already corrected, the other that an AC-5 assertion used a `toBeGreaterThanOrEqual`
floor where the criterion asked for identity.

The alternative resolution — delete *"nits alone approve"* and have reviewers put nits in the
summary — was considered and rejected at Q-0073's recovery gate. It is free and touches no frozen
artifact, and it makes a nit unroutable and unstructured, which on a review surface is where nits go
to be forgotten. The rule this restores is the one the 2026-08-22 decision actually argued for: a
verdict must not contradict its own findings. **A nit does not contradict an approval.** A blocker
does, and that is untouched.

**What implements it.** `spike/src/adapters/index.js` and `packages/core/src/adapters/adapters.ts`
together, per *"The port preserves behaviour"* (2026-08-25) — a registered behaviour change lands in
both trees or the port loses its independent witness. `spike/src/engine.js`'s generated `findings`
description tells the vendor the amended rule. The two frozen files themselves are **not** edited:
`spike/test/q0006-engine.js` (EDGE-2/AC-23) and `packages/core/src/adapters/structured-output.test.ts`
assert the amended clause against the committed schema, and `spike/test/q0033-surface.js`
(S1.1/S1.2/S1.4) applies this erratum to the expected flow before comparing — and asserts the
substitution matched, so a moved contract fails loudly rather than silently comparing un-amended
text. The contract files are corrected by whichever ticket next opens them legitimately, per E-1.

**Not changed, and named so it is not mistaken for having been considered and kept.**
`schemaFor` applies the `^(blocker|major|nit): …` item pattern only when the verdict vocabulary
contains `changes-requested`, so `chore.yaml`'s findings are unvalidated strings even though its
instructions demand the prefix. Widening validation is what just cost a run, so it is left alone.
The cost is that a chore reviewer writing `nit:` without a `file:line` is accepted where a review
reviewer would be refused.

**Found by:** Q-0073's chore run 2, 2026-08-28, which failed on it. Decided at that ticket's
recovery gate; see *"A nit does not contradict an approval"*, docs/DECISIONS.md 2026-08-28.
