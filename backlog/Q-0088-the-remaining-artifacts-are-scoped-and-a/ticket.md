---
id: Q-0088
title: The remaining artifacts are scoped, and a flat path must be a pointer
stage: reviewed
owner: ruud
repos: []
branch: harness/Q-0088/integration
priority: p2
created: 2026-09-01
iterations: {}
history: []
---
*Implemented by hand 2026-09-01, completing Q-0087. Stage `reviewed` by hand, history deliberately
empty; the subject is the flow files a run loads at run start, so no run could execute it.*

Q-0087 left **fourteen** write paths flat behind a register of prose reasons. This closes all
fourteen and **deletes the register**, because the reasons turned out to be one property rather than
fourteen excuses.

**The finding that decided the shape.** `{run}` interpolates to the id of the run *doing the
reading*. So an artifact its own flow reads can be globbed inside `run-{run}/` — writer and reader
are the same run — but an artifact a **later flow** reads cannot be scoped at all: by the time
`development.yaml` looks for `solution/tasks.yaml`, `{run}` has moved on, and a `run-*` glob both
sorts `run-10` before `run-2` and returns every run's copy where a `fan_out: from:` needs exactly
one file. Measured rather than assumed: the reader map was built from the flows themselves, and the
first pass **missed the fan-out's `step:` template**, which is where `review/verdict.md` and
`solution/solution.md` are read — a scan that walked top-level and `parallel` steps only. Redoing it
is what turned a four-item "cannot" list into a solved problem.

**The pattern was already in the repository.** `review.yaml`'s `verdict` step writes
`["review/round-{round}/verdict.md", review/verdict.md]` — a per-round copy for history beside a
stable name its consumer reads as a literal — and an agent step writes its document to **every**
`writesOf` target (`steps.ts:303`). So the four cross-flow artifacts become pointers rather than
exceptions, and the rule gains a second sentence instead of a register:

> A write path carries `{run}` — or `{round}`, review's own per-run counter — and one a bounded loop
> can re-enter within a run additionally carries `{iter}`. A path carrying neither must be a
> **pointer**: the step writing it must write a scoped copy in the same breath.

**The four pointers are exactly** `requirements/merged.md`, `solution/solution.md`,
`solution/tasks.yaml` and `review/verdict.md`, pinned by identity so a fifth is a visible act. Every
other write path in all six flows is now scoped. `FLAT_BY_DESIGN` is gone.

**Proven end to end with the mock adapter, not from lint.** A throwaway project was initialised from
the changed templates and the requirements flow run twice, once per shape:

| | files under `requirements/` | what survived |
| --- | --- | --- |
| old flow, two iterations | 3 | one `merged.md` — iteration 1 destroyed |
| new flow, two iterations | 5 | `run-1/merged-iter-1.md`, `run-1/merged-iter-2.md`, both candidates, and the pointer |

A later run then wrote `run-3/` beside an untouched `run-1/`, which is the cross-run half. The
`--auto` flag was used **only** in that scratch project against the mock adapter, where no gate is a
real decision and nothing is billed.

**Also verified against real tickets** with `--dry`: `requirements` on Q-0039 walks all three steps,
and `development` on Q-0011 expands two tasks in one wave — which exercises the pointer, since
`fan_out: from: solution/tasks.yaml` resolves through it.

**Three `smoke.js` assertions were re-aimed, and one of them was already passing for the wrong
reason.** The mock end-to-end suite runs the *shipped* flows, so moving the candidates broke it —
which is the suite doing its job. Two positive assertions were re-aimed at `requirements/run-1/` and
both go red when the scoping is reverted, demonstrated rather than asserted. **The third is the
interesting one**: `assert(!fs.existsSync(at('requirements/candidate-claude.md')))` — *"failed
parallel sibling wrote nothing"* — is a **negative** check, and once the path moved it passed
because nothing was at the old address, proving the writer had failed only by accident. That is *"a
check that skips its subject must not report success"* (2026-08-25) arriving through a rename. It
now searches `requirements/` recursively, and was shown to fire by pointing the search at a file
that does exist under it.

**`spike-parity.test.ts`'s totals were re-derived, not adjusted**, since `smoke.js` is an entangled
file: 2279 → 2287 and 4968 → 4976, one file and nothing else, with the transfer share 50% before and
after — stated rather than skipped, because *"it did not move"* is a measurement too.

**Consistency correction.** Q-0087's `qa/red/run-{run}/` became `qa/run-{run}/`, because the
flow-name level exists only where a directory has more than one writing flow — `dev/` (chore and
development) and `review/` (chore and review). `qa/`, `requirements/` and `solution/` have one each.
No real run had used the Q-0087 spelling, so the correction cost nothing.

**Not done, and stated rather than implied.** `docs/02-sdlc-pipeline-spec.md` §5's flow snippets
still show flat paths. They are abridged and already diverged from the shipped files before this
change — several name a `harness:` input the shipped flows do not — so rewriting them is a separate
docs job that would also fix pre-existing drift. §5 now says so, and §3.3's folder tree, which is
what a reader actually uses as the layout, is rewritten to the real shape. The engine's
`verdict_file` (`.harness/<step>-verdict.json`) is also unscoped; it is not a `writes:` target, so
the guard does not see it, and `requirements.yaml` reads it by literal name.

Belongs to M2 in `docs/06-development-plan.md`.
