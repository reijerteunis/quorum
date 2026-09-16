# Q-0015 — solution errata

Written at the solutioning exhaustion gate on 2026-09-16, before `qa-red` runs. `qa-red.yaml` reads
this file; `solutioning.yaml` reads no errata file at all, which is why the ruling below is here
rather than in `requirements/errata.md` (see that file's E-10).

---

## SE-1 — AC-6's source clause: the needle is re-spelled, and the criterion is not narrowed

**AC-6 as written cannot go green and no step in any flow can fix it.** Its source clause forbids the
literals `cost=`, `role=` and `verdict=` in every file under `apps/web/src`, and
`apps/web/src/backlog-board.test.ts:530` already contains `[role="progressbar"]` — inside an
assertion that the screen is *not* a spinner, which exists to enforce `docs/04-architecture.md:317`.
Measured at this gate: `role=` occurs **exactly once** under `apps/web/src` and it is that ARIA
attribute; the prose form occurs **zero** times.

**The needle stays, because the hazard is real.** A `step` event's message is composed at
`packages/core/src/engine/steps.ts:257` as `` `${adapter}/${model} role=${step.role}` ``, so a screen
could regex a role and a model out of it — which AC-6's own normative half forbids. `cost=` and
`verdict=` are the same family on `done`'s message.

**What moves is the spelling, and the form is the architect's rather than this operator's.**
`solution/run-2/draft-iter-2.md` §"AC-6 erratum required before red tests" proposed keying on the
**parsing idiom** rather than on the value: the needle is the literal preceded by a string or regex
delimiter — `'cost=`, `"cost=`, `/cost=`, and the same three for `role=` and `verdict=`. That is
better than the *"followed by a word character"* rule this operator had drafted, because it matches
how a parse is written rather than what the value looks like, so it does not fire on prose in a
comment.

**Verified at this gate, three ways**: zero hits across `apps/web/src` today, so the clause can go
green; `line.split('role=')[1]` is rejected; `[role="progressbar"]` is accepted. The red test **must
prove both directions**, which is the architect's own condition and is what stops the narrowing
becoming a weakening.

**Two remedies are expressly refused, and both were already closed.** Narrowing the corpus to
non-test files is the defect a prior review corrected — `apps/web/test/source.test.ts`'s own header
records it, and Q-0014's AC-5 is the instance, where *every file carrying the defect fell outside the
scan that forbade it*. Weakening or deleting `backlog-board.test.ts:530` removes a guard that
enforces a landed rule, in a file no development task owns and which `development.yaml` instructs
every task not to modify.

**The five count-field needles the shipped guard already forbids are untouched**, and AC-6's other
clauses — the verbatim-escaped rendering, the vendor badge from `spawn` or `retry`, the absence of
model, branch, token count and cost — are unchanged.
