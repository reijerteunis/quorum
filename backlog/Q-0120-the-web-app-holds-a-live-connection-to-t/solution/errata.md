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

---

## E-3 — written at the qa-red exhaustion gate, run 3

Three blockers and three round-costing ambiguities from run 3's scenario reviews. **Every claim below
was re-measured against `harness/Q-0120/integration` before it was written.** The red phase itself is
sound and nothing here asks for it to be re-done: twelve criteria, twelve covered, each with a test
that is actually red — verified independently of the review by running `@quorum/web`'s suite in the
integration worktree, **36 failed / 97 passed, of which 19 are `Error: not implemented` thrown by a
contract stub and 9 are assertions, with zero missing symbols, transform errors or collection
failures**. That is red for the right reason (2026-08-22), and it is what these three fixes protect.

### E-3(a) — E-1's predicate stands; its INSTRUMENT is bounded to one declaration. **My error.**

`apps/web/test/source.test.ts:61` implements E-1 as
`/(?:interface|type)\s+\w+[\s\S]*?type\s*:\s*['"]missed['"][\s\S]*?count\s*[?:]/m`, whose two
`[\s\S]*?` runs **span the whole file** — so an inline `type` import specifier 39 lines from an
unrelated object literal satisfies it, and it is red on `run-connection.test.ts` and
`shell.test.ts`. E-1 said *"no declaration under `apps/web` may pair `type: 'missed'` with
`count`"* and a whole-file scan is not that: **a declaration is the unit, and the instrument must
be bounded to one.**

**The match is confined to a single brace-balanced declaration body** — from an `interface` or
`type` head to the end of its own braces, never across two declarations and never into a function
body. Shown to have a subject by the inline fixture already at `:68`, which must still be reported,
and shown to discriminate by `run-connection.test.ts` and `shell.test.ts` both going green.

**This also closes the second blocker rather than leaving it open.** `frame-parser.ts:15` declares
`| Extract<WireMessage, { type: 'missed' }>` and the obvious implementation writes
`count: value.count` **inside a function body**, which a whole-file scan reaches and a
declaration-bounded one cannot. The guard then measures what AC-12 names — a restatement of the
union — rather than whether a property was written shorthand.

*Third repair of this criterion: §0.18's, E-1's, and this. The first two moved the predicate; this
one moves only the instrument, and the predicate is unchanged.*

### E-3(b) — `wire.test.ts` reads through the package's own corpus helper, and owes one register row, not four.

The register blocker survived two iterations because the prose contract names one register where a
new root-reading file under a scanned package earns four. **The remedy is to stop earning three of
them.** `packages/shared/src/wire.test.ts:9` derives a workspace root itself —
`path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')` — and that single line is
what makes `ROOT_DERIVATIONS` (two rows), `ESCAPING_LITERALS` (one row, currently keyed `'..'`
against a live literal of `'../../..'`, which is why one failure became two) and `READ_BASES` (no
row at all) apply.

**Use `repoFile('pnpm-lock.yaml')` from `../test/corpus.js`.** It is the precedent in this very
package: `packages/shared/src/docs.test.ts:5` imports it, reads eight repository files through it,
derives no root, and carries **only** `MANIFEST` rows — measured, it appears in no other register.
`wire.test.ts`'s `MANIFEST` row is already written at `turbo-inputs.test.ts:166` and stays.

Delete the `fileURLToPath` / `import.meta.url` derivation, the `ROOT` constant, both
`ROOT_DERIVATIONS` rows and the `ESCAPING_LITERALS` row for that file. No `READ_BASES` row is added,
because the read no longer has a base of its own.

### E-3(c) — `parseFrame`'s third branch is stated, not invented.

Its input is `unknown`, and the branch order is: a binary message is `non-text-message`; a string is
`JSON.parse`d and a failure is `invalid-json`; **anything else is treated as already parsed**, which
is what `frame-parser.test.ts:26` asserts by handing it a plain object. A value that is not an
object after those steps is `non-object` — the kind `frame-parser.ts:6` already declares — so
`parseFrame(42)` is `{ ok: false, refusal: { kind: 'non-object' } }`. Nothing new is added to
`FrameRefusal`; this names which of its existing members the untested case takes.

### E-3(d) — the socket scheme is derived from the page's protocol, never written as a literal.

`apps/web/test/daemon-endpoints.test.ts:38` forbids `/['"`]wss?:/` anywhere under `src/` while the
same file requires `ws:` for an `http:` page and `wss:` for an `https:` one. Both hold only if the
scheme is **transformed** from `page.protocol` rather than named — `page.protocol.replace('http', 'ws')`
satisfies both; a `page.protocol === 'https:' ? 'wss:' : 'ws:'` ternary arms the guard, in a file the
owning task may not edit. The same guard forbids `127.0.0.1` and `7717` under `src/`, which is GO-3's
one-literal-in-`vite.config.ts` ruling already enforced.

### Not ruled, and left as the review left them

Scenario 19.3 has no test behind it and AC-19 stays covered by 19.1 and 19.2 — write it or strike it,
but do not read it as coverage. Scenarios 12.1, 12.3 and 21.5 assert measurements the red report
contradicts; **the scenarios are right and the instruments are wrong**, so the specification does not
move, and E-3(a) and E-3(b) are what make those sentences true. `backend-lockfile-test-input` listing
`pnpm-lock.yaml` under `contracts:` while its description forbids touching it is harmless — `contracts:`
is what a task *reads* — and is not worth a traversal.

**One thing the review reported twice and it is not this ticket's:** `qa/run-3/red-report-iter-*.md`
carries *"… characters of output omitted from the middle …"*, swallowing `@quorum/web` and
`@quorum/core` — eight of twelve criteria — while its header reads *"No lines in the output looked
like test results."* That is `testReport`'s designed 12,000-byte head-and-tail trim meeting a
seven-package workspace, not a defect in this change. Both reviews established their verdict from the
untrimmed artifact instead, and so did I. It is **Q-0076**'s subject — nothing in run history has a
cap — reaching the one artifact a gate reads to decide whether a red phase is honest, and it wants
that ticket rather than a criterion here.

---

## E-4 — written at the review backward edge, run 5

Round 1's panel returned **2 blockers, 5 majors, 6 nits and 2 observations**, the verdict was
`changes-requested`, and the backward edge regressed the ticket `green → red`. That is the mechanism
working — but **four of the fifteen findings name test files, and no development task may write
one.** `development.yaml`'s fan-out instruction is *"Do not modify tests"*, and `qa-red`, whose
`automation-qa` role owns them, consumes `solutioned` and cannot be re-entered from `red`. Handing
them to the loop would be the sixteenth instance of a loop given work no agent in it can perform.

**They were therefore fixed by hand and are already on `harness/Q-0120/integration`.** The
development round that follows must **not** re-open them. This is *"A requirement may not name a
surface its flow cannot write"* (2026-08-25) applied to a review verdict rather than to a
requirement, which is a site that entry did not anticipate and which this run is the first to reach.

**Closed by hand — do not re-litigate:**

- **M-4**, `apps/web/test/source.test.ts` — the AC-12 declaration walk rewritten to the statement
  rather than the first balanced body, with the complete-union fixture the frozen contract names, in
  both spellings, shown **red against the old walk** before green. The accepting half is no longer
  vacuous: the reference union is asserted to be *scanned* before it is asserted to be accepted.
- **M-5**, `apps/web/src/shell.test.ts` — the AC-7 run-route render now supplies the fake factory and
  a page URL, `FakeSocket` is hoisted to module scope, and a **new guard** reports any run route
  rendered without a factory, demonstrated red by removing the prop just added.
- **N-3**, `packages/shared/src/docs.test.ts` and `docs/GLOSSARY.md` — the entry delimiter is the
  bold-term form, so the slice is **659 characters rather than 17,876**, it is asserted to contain its
  own term, and AC-23's *"no member of it is silence"* clause is now both stated and checked.
- **N-5**, `apps/web/test/routes.test.ts` — the exception register carries a reason per identity.

**Still the fan-out's, and the development round owes all eleven:** B-1, B-2, M-1, M-2, M-3, N-1,
N-2, N-6 (all `apps/web/src` or `apps/web/vite.config.ts`, `frontend`) and **N-4**
(`packages/server/src`, `backend` — writable since the grant made at this ticket's requirements gate).

**B-1 is the round's most important finding and its recommendation is taken rather than reworded.**
The dev proxy derives its contexts from `DAEMON_ENDPOINTS` and vite matches with
`url.startsWith(context)`, so `/projects` is swallowed by `/project` and `/runs`, `/flows` and
`/history` are simultaneously rail routes and daemon prefixes — **seven of twelve routes**, including
this ticket's own stated acceptance path. Narrow the contexts so they cannot match a shell route,
**still deriving them from `DAEMON_ENDPOINTS`** as AC-13(d) requires. **No erratum is owed for AC-13's
five-prefix wording**: the criterion asks for the five endpoints to be proxied, and exact or
anchored forms proxy exactly those five. What was wrong is the implementation's assumption that a
prefix is a route.

**Two clauses of B-2 and M-1 touch tests and are exempted from the no-tests rule for this round
only**, because the criterion they serve is unmet without them and the assertion is one line each:
restoring the idle-region assertion at `RAIL[0].path` (B-2) and asserting over the rendered region
that `no-daemon` names the requested URL (M-1). Both are additions beside existing cases in
`apps/web/src/shell.test.ts`. **Nothing else in any test file may move.**

**The observation the panel made about itself is worth keeping.** The two reviews were not comparable
in reach — claude read the tests, the guards, the manifests and the shared package; codex read three
files under `apps/web/src` and named no test, no register and nothing under `packages/`. And they
**contradicted each other outright** on `connection-state.ts`'s close handling, one calling it a
major defect and the other naming the same line correct by design. The verdict step read the branch
tip rather than either report and adjudicated it as N-2. A judge deduplicating on titles would have
propagated one without noticing the other existed, which is the argument for the verdict step being a
step rather than a merge.

---

## E-5 — written at the review backward edge, run 7

Round 2 returned **0 blockers, 5 majors, 9 nits, 1 refused, 2 observations**. B-1 and B-2 are closed
and the code works; what remained divided almost exactly in half by who may write it, and **all
fourteen were taken by hand.** The reasons are worth stating rather than assumed.

**Seven named test files**, which `development.yaml` forbids every task to modify and which
`qa-red`'s `automation-qa` cannot reach from stage `red` — E-4's partition, unchanged.

**And M-1 was not deliverable by the loop at all**, which is the sharper reason and the one the
verdict step supplied: fixing the render turns `shell.test.ts:282` red, because that assertion reads
`toContain('live')` and `connectionStateText` never produces the word — it passed **because the
kebab token was what rendered**. So an implementer could leave the render wrong or break a test it
may not repair. Handing that to a third traversal unchanged would have been the seventeenth instance
of a loop given work no agent in it can perform, and the first where a *review verdict* rather than
a requirement created it.

**Recorded as deliberate rather than fixed**, both being the branch round 1 explicitly offered:

- **N-2** — the accepted-event list is copied per event, which is O(n) each and quadratic over a long
  stream. Kept, with the note in place: `snapshotOf` returns the array by reference, so pushing would
  make every snapshot a live view that grows under its holder, and Q-0015 renders from this snapshot
  while Q-0121 will hold several controllers. Trading an immutability every consumer can rely on for
  a constant factor is not a nit's worth of risk, and the cap AC-19 leaves open is where it belongs.
- **N-6** — an unknown key on a `missed` frame lands on `invalid-count`, because the branch is
  `.strict()` and AC-14's closed set has no member for it. Dropping the payload means making `count`
  optional on `FrameRefusal`, which is a frozen contract and not a nit's to move. The count is not
  rendered, so what was wrong is the name a developer reads, and that is now said in place.

**Three of the findings are defects in the work E-4 did by hand**, which is recorded rather than
smoothed over: **N-4** (the statement walk broke only at a `;`, so an `interface` swallowed the value
literal after it — over-reporting only, but it made the acceptance fixture narrower than it reads),
**M-3** and **M-4**. Each is now demonstrated in both directions.

**The panel contradicted itself on the same line for the second round running** —
`connection-state.ts:76`, codex calling it a defect and claude naming it correct by design, round 1
having already adjudicated it. The verdict step caught it both times by reading the branch tip rather
than either report. **That is the argument for the verdict step being a step rather than a merge,
made twice by one line of code**, and it belongs in this ticket's closing entry.
