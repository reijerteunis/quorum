# Q-0120 — architecture review, run 2, iteration 3

*Reviewed against `requirements/merged.md`, `harness/architecture.md`, `harness/rules.md`, and the
contracts as committed on `harness/Q-0120/contracts` at `b30b7f5` (12 files, 223 insertions). Every
measurement below was re-derived from the tree rather than taken from the draft.*

**Verdict: revise.**

## What this verdict costs, stated first

`solutioning.yaml:33` gives this step `on_fail: { goto: architect, max_iterations: 2 }`, and both
traversals are spent — this is review iteration 3. So `revise` reaches an **exhaustion gate**, not a
fourth round. That is the right place for it, because the remedies below are not a redesign: five of
the six are edits to `contracts/Q-0120/live-connection.contract.md` and to the *"What qa-red must
write"* list, and one is a `depends_on`/tagging decision. One `retry` closes them, or the human lands
them at the gate on the Q-0055 OQ-2 precedent. What must not happen is `advance` with B-1 open: it
puts a guaranteed unclearable red inside a loop that cannot tell agents failing from agents being
asked for the impossible.

## What iteration 3 got right

This is a better document than iteration 2 and the improvements are measured rather than asserted.
Recorded because the findings below are about one boundary, not about the design.

- **The eight-entry exception table is exact.** I re-ran the widened scan's own rule —
  `routes.test.ts:40`'s `pathLiterals` over a recursive walk of `apps/web/src`, minus the twelve
  paths `ROUTES` holds — against the contracts branch. It returns exactly
  `daemon-endpoints.ts: /project, /tickets`; `router.ts: /backlog/, /runs/<handle>, /har`;
  `shell.test.ts: /runs/run%20one, /nowhere/at/all, /backlog/%E0%A4%A`. Eight, in three files, the
  same eight. That is a register derived from the tree, which is what this repository asks for.
- **The `CONNECTION_PENDING` ruling is correct and necessary.** `apps/web/src/shell.test.ts:31`
  imports the constant and `:227–228` assert over it, so deleting it in development without qa-red
  moving first is a *compile* failure in a file development may not touch. Iteration 3 found that and
  routed it to the only step that can act.
- **The staged parsing model gives the shared schema a real consumer.** `frame-parser.ts:1` imports
  `eventSchema` and `wireMessageSchema` as **values**, so AC-12's browser reachability, AC-21's
  resolution and AC-22's Vite condition all have a subject rather than being proved by a type-only
  import that erases. Verified: the two other new modules (`connection-state.ts:1`,
  `run-connection.ts:1`) are type-only, so `frame-parser.ts` is the whole of the evidence — and it is
  enough.
- **The two-vendor fan-out is restored with a substantive backend task**, and `backend-wire-schema`
  is admissible: `harness/roles/developer-backend.md:3` now carries `packages/server` in the
  frontmatter and `:9` in the allowed-path prose, so GO-1 answer (ii) is landed and `role.test.ts`
  holds both against `harness/architecture.md`'s table.
- **Ownership is clean.** No two tasks own the same file; every development surface the red suite
  requires is owned; `packages/server/src/wire.ts` and `pnpm-lock.yaml` — the two files §7 of the
  requirement reported ownerless — are landed as contracts and named in no task's paths, which is
  what GO-1 ruled. The YAML shape matches `solutioning.yaml:47`'s `tasks: [{id, role, title,
  description, contracts, depends_on}]`, and `loadTasks` imposes no schema, so nothing there refuses.

---

## Blockers

### B-1 — Three landed scans refuse the fixtures qa-red must write, and the failures land in files development may not touch

This is §0.18's defect — *a scan whose corpus contains the ticket's own fixtures* — surviving on
three surfaces the draft does not name. Iteration 3 closed it for the route scan alone.

**(a) The whole-package network scan.** `apps/web/test/source.test.ts:253` forbids `http://`,
`https://` and `//fonts.` in **every file of the package**: `:256` walks `filesBelow(PACKAGE)` and
`:35`'s `NOT_OURS` excludes only `node_modules`, `dist`, `.turbo`, `.vite` — so `apps/web/src/*.test.ts`
and `apps/web/test/*.test.ts` are both in the corpus. Now read the contracts:
`run-connection.ts:27` is `connect(handle: string, page: URL): void` and `app.tsx:23` is
`readonly pageUrl?: URL`. A `URL` cannot be constructed without an absolute URL string, and AC-13's
own *Test:* clause demands "URL construction asserted for an `http:` page, an `https:` page". So
`run-connection.test.ts`, `shell.test.ts` and any URL-construction test **must** produce an
`http://…` somewhere. Written naively, that turns `source.test.ts` red — a **test file**, which
`development.yaml:17` forbids every development task from modifying. The development loop then spends
all three of `integrate`'s iterations on a failure no task in it can clear.

**(b) The `@quorum/` scan over `packages/shared/src`.** `packages/shared/src/index.test.ts:49–52`
asserts the scope literal appears in no file under that directory, and it uses `sharedAllFiles()`
(`packages/shared/test/corpus.ts:113–118`), which selects **every** `.ts` including `.test.ts` — which
is why `:11` assembles `SCOPE` at run time. Iteration 3 moved the lockfile-importer assertion into
`packages/shared/src/wire.test.ts`. That assertion must name `@quorum/shared` under the `apps/web`
importer. Written literally it fails `index.test.ts` — again a test file, again unclearable.

**(c) AC-13(a)'s own scan, over a corpus that holds its own tests.** AC-13(a) forbids
"absolute URL, hostname, port, `ws:` or `wss:` literal … anywhere under `apps/web/src`", and the
draft places `frame-parser.test.ts`, `connection-state.test.ts` and `run-connection.test.ts` **in
`src/`**. A test asserting `url.protocol === 'ws:'` is then inside the corpus it is proving empty.
(Note also that the retained network scan does **not** cover `ws:`, `wss:`, a bare hostname or a
port — so AC-13(a)'s scan is a new one, and §"What qa-red must write" assigns it to nobody. See M-1.)

**Remedy — one paragraph in `contracts/Q-0120/live-connection.contract.md`**, because that is the
document `write-tests` is sent to (`qa-red.yaml:26`). State the rule this repository has already
written twice for itself: **every needle and every fixture literal in a test under `apps/web/` or
`packages/shared/src/` is assembled at run time.** `apps/web/test/source.test.ts:14–20` states it for
its own file — *"Every needle here is assembled anyway — one rule rather than four judgements, and so
that moving a corpus can never quietly turn a needle into its own subject again"* — and
`packages/shared/src/index.test.ts:11` states it for `SCOPE`. Name the four concerned:
`http:` + `//`, `https:` + `//`, `ws:`/`wss:`, and `@quorum/`. Then decide, in the same paragraph,
whether the URL-construction tests live in `apps/web/src/` (assembled needles required, per (c)) or
in `apps/web/test/` (which dodges (c) entirely and leaves only (a)); either is defensible, but the
draft must choose, because `write-tests` otherwise chooses for it.

### B-2 — The route-scan exception register is frozen at identities measured before qa-red enlarges its own corpus

The prose contract says *"with these eight entries"* and *"an unused entry fails"*, and the qa-red
assignment says *"add the exact eight-entry `file + literal + reason` exception register specified by
the prose contract"*. The eight are correct **for the tree as it stands** — I re-derived them. They
cannot stay eight once qa-red writes what it is being told to write:

- `connection-state.test.ts` must drive `ConnectionAction` `{type:'connect', requestedUrl}`, and
  `ConnectionState`'s `connecting`, `live` and `no-daemon` each carry a `requestedUrl`. Every such
  fixture is a quoted literal beginning with `/` — collected by `routes.test.ts:40`, held by no row
  of `ROUTES`, and absent from the eight.
- AC-13(a)'s URL-construction test (M-1) has path literals as its entire subject: `runEventsPath('h')`
  is asserted against something like `/runs/h/events`.
- `run-connection.test.ts` asserts over the URL the fake factory received.

`shell.test.ts`'s new run-route mounting is the one case that *can* stay inside the eight, by reusing
the existing `/runs/run%20one` fixture at `:155` — worth saying so explicitly, because it is not
obvious and it is free.

**Remedy:** state the **rule** and keep the eight as its measured baseline rather than as its
definition. The register holds `(file, literal, reason)` identities; every entry must be exercised;
the entries attributed to `daemon-endpoints.ts` must equal the non-route literals `DAEMON_ENDPOINTS`
contributes (this clause is good and should survive verbatim); and qa-red registers one entry, with a
reason, for each fixture literal its own new tests introduce. The stronger alternative, and the one I
would take: require new fixtures to **derive** their paths from `DAEMON_ENDPOINTS` and `runEventsPath`
rather than writing literals, which adds no entries at all and makes the fixture agree with the
register by construction.

---

## Majors

### M-1 — AC-13(a) has an implementing task and no test, and two of AC-13's clauses have no assigned file

`frontend-daemon-endpoints` implements `runEventsPath` and `runEventsUrl`, both of which are throwing
stubs today (`daemon-endpoints.ts:11`, `:16`). §"What qa-red must write" names twelve files and **none
of them is about those two functions**. `run-connection.test.ts` reaches them only incidentally,
through `connect(handle, page)`, and asserts nothing about encoding or scheme — so an implementation
that returned the handle unencoded, or `ws:` on an `https:` page, would go green. That is a
development task with no oracle, and it is the criterion the requirement wrote a four-case table for:
"an `http:` page, an `https:` page and the four hostile handles" — a handle containing `/`, `?`, `#`
or a space.

Two further AC-13 clauses are assigned to nobody:

- **AC-13(a)'s forbidden-literal scan** over `apps/web/src` for `ws:`, `wss:`, a hostname and a port.
  The retained whole-package scan covers `http://`, `https://` and `//fonts.` and nothing else
  (`source.test.ts:253`), so this is a *new* assertion, not a retained one.
- **AC-13(d)'s both-sides comparison** — *"the proxy's forwarded prefixes and the client's request
  path come from the register on both sides rather than being written twice"*. `routes.test.ts`
  compares the *exception table* with `DAEMON_ENDPOINTS`, which is a different claim, and
  `test/package.test.ts` is assigned only the Vite conditions and the no-build surface.

**Remedy:** add one file to the qa-red map that owns all three (`apps/web/test/daemon-endpoints.test.ts`
is the placement I would take — it needs the assembled-literal rule of B-1(a) either way, and in
`test/` it is outside AC-13(a)'s own corpus, which removes B-1(c) for it). Its scenarios tag
`frontend-daemon-endpoints` and `frontend-dev-proxy`.

### M-2 — The qa-red file map is delivered through a channel `write-tests` does not read

`qa-red.yaml:23` gives `write-tests` these inputs: `qa/run-{run}/scenarios-iter-*.md`,
`solution/tasks.yaml`, `solution/errata.md`, the scenario reviews, the red reports,
`harness: [architecture.md]`, and `repo: true`. **`solution/solution.md` is not among them.** Only
`scenarios` (`:10`) reads the solution, and its instruction is to write one Given/When/Then per
acceptance criterion and tag task ids — it is not told to carry a file map, and a file map is not a
scenario.

So the draft's load-bearing qa-red obligations reach the step that must obey them only by luck:

- *remove `CONNECTION_PENDING` from `shell.test.ts:31`'s named import **before** development* —
  an ordering instruction, and the most consequential sentence in the document;
- the exception register's shape and its eight rows (this one **is** in the prose contract — correct,
  and the model for the rest);
- *the `apps/web` suite must not read the lockfile*, and the assertion's home is
  `packages/shared/src/wire.test.ts`;
- the assembled-literal rule B-1 asks for.

`write-tests` is explicitly pointed at *"the contracts the solution emitted — the typed stubs at their
final paths, and the documents under `contracts/<ID>/`"* (`qa-red.yaml:26`) and has `repo: true`. That
is the durable channel, and `solution/tasks.yaml`'s `description` field is the second.

**Remedy:** move the qa-red file map and those three ordering rules into
`contracts/Q-0120/live-connection.contract.md` — where the route-scan table already correctly sits —
and leave the solution's own section as a pointer to it. No new contract file is needed.

### M-3 — `frame-parser.test.ts` cannot pass until a task in the other role's worktree lands, and `failing-tasks-only` will re-dispatch the wrong one

`frontend-frame-parser` and `backend-wire-schema` both declare `depends_on: []`, so they run in one
wave, in two worktrees, on two vendors. Per the contract's §Parsing, `parseFrame` calls
`wireMessageSchema.safeParse` on the recognised branch — and until `backend-wire-schema` lands, that
call **throws**. Measured, not assumed: `packages/shared/src/wire.ts:14`'s
`z.custom<WireMessage>(() => { throw new Error('not implemented') })` propagates out of `safeParse`
rather than returning `{success:false}` — I ran it against this workspace's zod and it printed
`safeParse THREW: not implemented`.

Two consequences. The frontend implementer is told *"Implement ONLY your task so that the tests
covering it pass"* (`development.yaml:17`) and will watch `frame-parser.test.ts` fail on a file it may
not edit; the honest response is to stop and report, and the likely one is to route around the shared
schema, which is the single thing this ticket exists to make load-bearing. And
`development.yaml:6`'s `scope: failing-tasks-only` re-dispatches by the ids a scenario carries, so a
defect in the **count validator** re-runs the **parser** task.

**Remedy:** state in the contract that every `frame-parser.test.ts` scenario tags **both**
`frontend-frame-parser` and `backend-wire-schema` — `qa-red.yaml:13` already says *"task id(s)"*, so
the vocabulary exists — or give `frontend-frame-parser` `depends_on: [backend-wire-schema]` and accept
two waves. I prefer the tag: it keeps the wave, and `packages/shared/src/wire.test.ts` already
disambiguates which half is broken.

### M-4 — AC-16's `count: 0` clause, as specified, cannot fail

`RunConnectionSnapshot.missedCount` is `number | null` (`run-connection.ts:22`). The assigned test is
*"missed counts zero and seven"*, and AC-16 asks that `count: 0` render **no notice**. A renderer that
drops `missed` frames entirely renders no notice for `count: 0` as well — `null` and `0` are
indistinguishable at the rendered surface — so that half of the assertion is satisfied by the
implementation it exists to forbid. The `count: 7` half discriminates; the `count: 0` half does not.

**Remedy:** one sentence in the contract: for `count: 0` the assertion is over the **snapshot** —
`missedCount === 0` (accepted, and distinct from the `null` that means no frame arrived) with `events`
unchanged — and the *rendered* claim is that no notice appears. That keeps §0.12's ruling (the daemon
never sends a zero, so this case is the parser's defence rather than evidence about the wire) and
makes it checkable.

---

## Nits

- **nit: `contracts/Q-0120/live-connection.contract.md`** — the contract freezes refusal names,
  precedence and lifetime but says nothing about what a **second** `missed` frame does (replace or
  accumulate). One socket receives at most one today, so nothing is broken; a sentence costs nothing
  and removes a judgement from the implementer.
- **nit: `apps/web/src/app.tsx:23`** — `pageUrl?: URL` has no stated default. `currentPath()` at `:16`
  is the precedent (`window.location.pathname`, guarded for `typeof window === 'undefined'`); say that
  `pageUrl` defaults the same way, or `frontend-react-connection` will invent it.
- **nit: AC-22's second half is already landed.** `packages/shared/src/index.test.ts:44–47` already
  asserts that the `quorum-source` condition resolves `./src/index.ts` and the default resolves
  `./dist/index.js`. Naming that in the qa-red map saves writing a second copy of an assertion that
  exists.
- **nit: `packages/core/src/turbo-inputs.test.ts:164`** — `MANIFEST['@quorum/shared#test']` is the
  hand-audited register of that suite's out-of-package reads. Clause A (`:1765`) only checks that
  manifested reads are hashed and clause B (`:1807`) is satisfied by the declared input
  `backend-lockfile-test-input` adds, so **no edit is forced** — but the register will then
  under-describe the suite by one read. It is a test file, so it is qa-red's: either assign the line
  or say in the contract that it is deliberately not added.
- **nit: the requirement's AC-12(c) premise is slightly wrong and the draft should not lean on it.**
  It says `packages/shared/src/index.test.ts:135` *"requires the barrel to expose every module, so the
  barrel line is forced rather than remembered"*. That test iterates a **hand-written list of names**,
  not the directory, so nothing forces `wire.js` onto the barrel. The draft's assignment (*"pin the
  wire barrel export"*) covers it correctly; worth stating so the next reader does not rely on the
  requirement's sentence.

## Observations

*True, worth recording, and not claims about this change.*

- **observation:** the contracts on `b30b7f5` have never been typechecked, linted or run. The worktree
  has no `apps/web/node_modules` and no `node_modules/.bin/tsc`, so the `ENOTFOUND` the draft reports
  is not a partial install — nothing resolved. The draft is honest about this and routes it to the
  gate, which is right; I am recording it because the gate's `pnpm install --frozen-lockfile` must
  reach exit 0 **and** `pnpm turbo run typecheck` must be run before qa-red starts. Two things I did
  check by hand in place of the compiler, both fine: this workspace's ESLint enables only three rules
  and none of them is `no-unused-vars` (`eslint.config.js:39–48`), and `tsconfig.base.json` sets no
  `noUnusedLocals`, so `frame-parser.ts`'s two currently-unused value imports and the `_`-prefixed stub
  parameters cost nothing. And `z.object({ type: z.literal('event'), event: z.unknown() })` **requires**
  the `event` key in this workspace's zod — I ran it — so `z.ZodType<WireMessage>` is satisfiable by the
  natural implementation rather than needing a cast.
- **observation:** landing `@quorum/shared` in `apps/web/package.json` at contract time makes two
  already-landed assertions red before qa-red writes a line —
  `apps/web/test/package.test.ts:88` (justification register against the manifest, both directions)
  and `:97` (`dependencies` is exactly `['react','react-dom']`). That is correct and unavoidable
  (`harness/harness.yaml`'s install must succeed or `expect: fail` reads an install failure as red),
  `merge-contracts` runs no suite, and both registers are assigned to qa-red. Recorded so the first
  red report is not misread as a defect.
- **observation:** `harness/flows/review.yaml`'s `verdict` instruction is still spliced mid-sentence —
  the requirement §11 recorded it, and this ticket takes the full pipeline and therefore reaches
  `review`. Still unfixed on `main` at `13efe5e`. One line by hand in the shipped file, its
  byte-shared template mirror, and `docs/02-sdlc-pipeline-spec.md` §5, before this ticket's review
  stage runs.

---

## What would make me approve

1. **B-1**: a paragraph in `contracts/Q-0120/live-connection.contract.md` stating the assembled-needle
   rule for `http:`+`//`, `https:`+`//`, `ws:`/`wss:` and `@quorum/`, naming the four guards it is
   about, and choosing where the URL-construction tests live.
2. **B-2**: the exception register restated as a rule with the eight as its measured baseline —
   or, better, new fixtures deriving their paths from `DAEMON_ENDPOINTS` and `runEventsPath`.
3. **M-1**: one qa-red file owning AC-13(a)'s URL construction, AC-13(a)'s `ws:`/hostname/port scan and
   AC-13(d)'s both-sides comparison.
4. **M-2**: the qa-red map and its three ordering rules moved into `contracts/Q-0120/`, where
   `write-tests` will actually read them.
5. **M-3**: `frame-parser.test.ts` scenarios tagged with both task ids, or `depends_on` declared.
6. **M-4**: AC-16's `count: 0` assertion re-aimed at the snapshot.

Nothing above changes the chosen approach, the seams, the task cut or the contracts' shape. The
design is sound and I would be on call for it; what I would not be on call for is the red phase as
currently specified reaching green.
