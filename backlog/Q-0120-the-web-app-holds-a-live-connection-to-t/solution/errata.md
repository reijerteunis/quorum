# Q-0120 — solution errata

Written **at the solutioning gate**, which is the only window an erratum has (*"An erratum is the
last repair, not the first"*, 2026-08-30; *"the window for an erratum is a gate"*, Q-0094 E-3).
Both entries close blockers the run-2 architecture review raised at its exhaustion gate and named as
rulable here rather than by a fifth architect traversal. `qa-red.yaml`'s `scenarios` and
`write-tests` both read this file.

Every claim below was re-measured against `harness/Q-0120/integration` before it was written, not
taken from the review.

---

## E-1 — AC-12's declaration scan is re-specified. Its `Test:` clause (i) is void.

**What is struck.** AC-12's *Test:* clause (i) — *"a scan over every file under `src/` reporting any
`interface` or `type` alias declaring those members"*, the members being `type`, `event` and
`count`. It is unsatisfiable and would be red the moment any task landed: the merged contracts
declare all three legitimately, at `apps/web/src/frame-parser.ts:8`, `:10` and `:14`, and across
every branch of `ConnectionAction` in `apps/web/src/connection-state.ts:17–23`. A scan on member
names cannot separate a restatement of the wire union from an unrelated local type that happens to
have a field called `type`, and in a React app almost everything has one.

**This is the criterion's second repair, which is why it is struck rather than narrowed again.**
Requirement §0.18 already repaired it once — from an object-literal form into the declaration form
the contracts now violate. A predicate that has been wrong twice in one ticket is wrong in kind.

**What replaces it.** *The discriminating shape is the union, not the member names.* No declaration
under `apps/web` may pair `type: 'missed'` with `count` — the frame union's only unique signature.

**Measured before it was written, which is what makes it a ruling rather than another guess.** Over
the merged tree, exactly one declaration in the workspace pairs them:
`packages/shared/src/wire.ts:6`, `{ readonly type: 'missed'; readonly count: number }` — the single
definition AC-12 exists to protect. `apps/web` reaches that branch at
`apps/web/src/frame-parser.ts:15` through `Extract<WireMessage, { type: 'missed' }>`, **a reference
rather than a restatement**, which is precisely the distinction the criterion is about and the one a
member-name scan cannot see.

**What the test must show, so it is not established by reading it** (2026-08-29): a subject —
a fixture re-declaring `WireMessage` in full is reported — and discrimination — `FrameRefusal` and
`ConnectionAction`, which declare `type` and `event` and are not restatements, stay green.

**AC-12's remaining clauses are unchanged**, including Test (ii), the `packages/server` re-export
assertion, which E-2 re-homes rather than alters.

---

## E-2 — the qa-red file map gains `packages/server`, and loses one misrouted line.

**The gap.** `contracts/Q-0120/live-connection.contract.md` is authoritative for what qa-red writes,
by its own words, and it names `packages/server` **zero times**. Two consequences, both of which
would land as a red no task can clear:

**(a) AC-13(e) is assigned to nobody.** Its read of `packages/server/src/*.ts` and that package's
manifest, asserting neither gained the string `cors`, lost its home when iteration 3 correctly
removed the `backend-cors-guard` task as a test edit and nothing picked the assignment up.

**(b) AC-12's re-export assertion is routed into the wrong package.** Contract line 78 gives
`packages/shared/src/wire.test.ts` the *"server re-export text"* — a read of
`packages/server/src/wire.ts` from `@quorum/shared#test`. **Measured: neither register permits it.**
`packages/shared/turbo.json` names `server` zero times, and
`packages/core/src/turbo-inputs.test.ts`'s `MANIFEST['@quorum/shared#test']` names it zero times —
so `turbo-inputs.test.ts` goes red on an undeclared read, and the only task owning
`packages/shared/turbo.json` is `backend-lockfile-test-input`, whose own description scopes it to
`../../pnpm-lock.yaml` alone. It also contradicts AC-12's Test (ii) in as many words — *"In
`packages/server`: … asserted over the file's own text"* — and requirement §0.14, which gives cache
coverage as the reason.

**The ruling.** The qa-red file map gains two files, both in the package whose text the assertions
are about and which `backend-wire-schema` already owns:

- `packages/server/src/index.test.ts` — the re-export assertion, AC-12 Test (ii).
- `packages/server/src/package.test.ts` — the no-CORS assertion, AC-13(e), **retaining** that file's
  existing no-export-surface assertions rather than replacing them.

And *"server re-export text"* is struck from line 78's assignment to
`packages/shared/src/wire.test.ts`, which keeps its other reads.

`packages/server` is writable: it was granted to `backend` at this ticket's requirements gate, in
the three places `packages/shared/src/role.test.ts` holds against each other.

---

## Not ruled here, and why

The run-2 review's three majors are **not** errata. M-1 (no development owner for
`apps/web/package.json` and `pnpm-lock.yaml`) is the cost GO-1 named and accepted when it authorised
landing the lockfile at contract time; a later correction to either is a human act at a gate, which
is stated rather than assigned. M-2's wave-depth concern was **answered by the shipped
`tasks.yaml`** rather than by a ruling — eight of the nine tasks are in wave 1, across both vendors,
and only `frontend-frame-parser → backend-wire-schema` remains, which the reviewer confirmed is a
real dependency by measuring that `z.custom(() => { throw })` throws *through* `safeParse` in this
workspace's zod. M-3 is advice to the qa-red author — `WireMessage` is type-only and cannot be
asserted with `toHaveProperty` — and is carried by AC-12's own text rather than needing one.

**One observation the review repeated is wrong and is corrected here so no later step inherits it.**
It reports `harness/flows/review.yaml`'s `verdict` instruction as *"still spliced mid-sentence"*.
It was fixed at `13efe5e`, before this run started, in the shipped file, its template mirror and
`docs/02-sdlc-pipeline-spec.md` §5.5. The requirement's §11 recorded it when it was true; the review
carried the sentence forward without re-measuring — *"a measurement copied from a document is not a
measurement"*, inside a review that opened by saying every claim was re-derived.
