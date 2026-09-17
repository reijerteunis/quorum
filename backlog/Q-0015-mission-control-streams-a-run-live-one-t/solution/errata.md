# Q-0015 solution errata

## E-1 — AC-6 scans parsing forms rather than bare message fragments

AC-6's whole-corpus source clause is corrected before QA writes scenarios. The corpus remains every
file under `apps/web/src`, including tests and non-TypeScript files. The guard scans twelve parsing
needles: each of `cost=`, `role=` and `verdict=` prefixed by a single quote, double quote, backtick
or slash. Bare `role=` is not a needle because it falsely matches the shipped accessibility selector
`[role="progressbar"]` in `backlog-board.test.ts`.

The guard must prove both directions: a template-literal parsing fixture is rejected and the
accessibility-selector fixture is accepted. Fixture strings are assembled so the guard does not
flag its own source. This changes only the instrument, not AC-6's product rule: browser code must
not parse a human-readable event message for a machine value.

---

## SE-2 — `routes.test.ts:139` fails open when this ticket lands, and qa-red owns the fix

Carried from `solution/run-2/review-iter-4.md` N-2, **because `qa-red.yaml` does not read the
architecture review** — its inputs are `merged.md`, `solution.md`, this file, `tasks.yaml` and its own
scenario reviews. Without this entry the finding would have reached the architect and not the phase
that has to act on it. Second instance of **Q-0132**'s gap inside one run.

**The defect, verified at this gate rather than relayed.** `apps/web/test/routes.test.ts:131` asserts
the screen-bearing rows by **identity** — `toStrictEqual([BOARD_PATH, TICKET_ROUTE, GATE_ROUTE])` — so
it goes red the moment this ticket marks two more rows built, and QA is forced into that describe
block. Nine lines down, `:139` loops over a **hard-coded three-element array** of the same three
constants, asserting the property its own comment states: *"every row claiming a screen is one
`app.tsx` selects by the register's own constant"*. That list stays green at three while five rows
claim a screen, so the property silently stops covering `RUNS_PATH` and `RUN_ROUTE` — **the two rows
this ticket adds** — and the shipped state is a guard covering three of five while reporting success.

**The fix is the shape this repository already uses twice**: derive the loop from
`SCREEN_ROUTES.filter((route) => route.screenExists)` rather than listing constants, so a sixth row is
covered without anyone remembering — Q-0051's `q0050.source.test.ts` repair (derive from `production`
rather than a hand-written array) and Q-0108's `covered` repair. **Show it red before green**: against
the derived form with `app.tsx`'s selection of one new constant removed, the clause must fail and name
that route.

## SE-3 — T10 is narrowed: `docs/06-development-plan.md` is not a development task's surface

`solution/tasks.yaml` has been edited at this gate — the gate whose stated reason is *"Architect owner
approves solution/solution.md and solution/tasks.yaml"* — to remove that file from T10. The scoped
copy at `solution/run-2/tasks.yaml` is the architect's output and is deliberately left as written.

**Why, and it is a ruling rather than a preference.** `development.yaml` fans out `by: role` and T10 is
`role: backend`, whose `paths:` include `docs` — so the task would have run and written that page.
Three reasons it must not:

1. **Q-0094 erratum E-3(a) already ruled it.** That ticket's E-2 required a development-plan edit and
   E-3(a) withdrew it, recording that *"this page's bullets are rewritten by hand at each plan pass"*
   and that the ruling *"turned a harmless revert into a review finding"*.
2. **The entry already exists and holds work a development task cannot know.** Q-0015's bullet was
   written at the requirements gate and records the three-way split, Q-0130 and Q-0131, the
   no-producer finding and two run-time context defects. T10 would replace it with a description of
   the shipped screen.
3. **The facts a ticket entry carries do not exist yet.** Cost, implement rounds, review findings and
   what was verified are all post-run, so no development-stage task can write that bullet correctly
   whatever it is told.

**`docs/04-architecture.md` stays T10's**, and legitimately: it is a living design document describing
the code, which is exactly what a development task changes. Nothing else in the task moves.

### SE-3, corrected 2026-09-17 — the narrowing had to land in **two** registers, not one

SE-3 edited `solution/tasks.yaml` and stopped there. That file decides **which** tasks fan out, with
what id and role — and the implementer does not read it. `development.yaml`'s fan-out step takes
`input.backlog: [solution/solution.md, review/verdict.md]`, so **the task description an implementer
obeys comes from `solution.md`**, which still carried *"Own only docs/04-architecture.md and
docs/06-development-plan.md"*.

So the ruling would have had no effect on the thing it was written to prevent: T10's implementer
would have read the un-narrowed description and rewritten the development plan, exactly as if the
erratum had never been written.

`solution/solution.md` now carries the same narrowed description, word for word. The scoped copies at
`solution/run-2/solution.md` and `solution/run-2/tasks.yaml` are the architect's output and are
deliberately left as written.

**Recorded rather than quietly fixed, because the failure is this repository's most-recorded one and
it is the operator's here**: fixing the instance a finding names rather than the class it belongs to
— Q-0112's five review rounds, three of them on that one failure. A ruling that changes a register
must name **every** register that carries the claim, and *which register a step actually reads* is
the question that decides it.

### SE-1, corrected 2026-09-17 — the narrowing belongs to `role=` alone

SE-1 adopted the architect's parsing-idiom form — the literal preceded by a quote, backtick or slash
— and applied it to **all three** fields. The measurement behind it covers **one**: the collision is
`backlog-board.test.ts:530`'s `[role="progressbar"]`, and `cost=` and `verdict=` occur in the
`apps/web/src` corpus in no form at all. So for two of the three the delimiter requirement bought
nothing and gave something up: bare `cost=` stopped being forbidden, which is the form a
concatenating parser writes.

Six needles rather than twelve, and `contracts/Q-0015/mission-control.contract.md` moved with this
entry rather than after it. Found by review round 2's major 4, whose own recommendation named both
registers — **and which this operator then did not move, which is why round 3 raised the contract
again.** Fixing the guard and leaving the document that specifies it is the same failure the entry
above records at SE-3, in the same ticket, a second time.
