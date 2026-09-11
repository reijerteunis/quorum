# Q-0120 — architecture review, run 2, iteration 1

*Reviewing `solution/run-2/draft-iter-1.md` against `requirements/merged.md`, `harness/architecture.md`,
`harness/rules.md` and the tree at `13efe5e`. Every claim below was re-derived from the files rather
than taken from the draft or from the requirement — this repository's sixth recorded instance of a
measurement copied from a document being wrong is recent enough to be a habit.*

**Verdict: revise.** Five blockers, three of which are satisfiability rather than coverage, and the
role brief says satisfiability is checked first because a scenario that can never go green costs a
whole development loop and the loop cannot tell "agents failed" from "agents were asked for the
impossible".

---

## 1. What is right, stated before what is not

The approach is sound and several of its judgements are better than the requirement's.

- **The seam is correct.** `@quorum/shared` as the browser-safe owner of `WireMessage`, with
  `packages/server/src/wire.ts` re-exporting, is what `packages/server/src/package.test.ts:138–147`
  forces: six assertions go red under option (A), none under (B). The draft does not re-litigate it,
  which is right — §0.1 ruled it and an implementer may not reopen it.
- **The five-module cut is the right one.** `frame-parser`, `connection-state`, `run-connection`,
  `daemon-endpoints` and a React adapter keeps AC-14, AC-15 and AC-16's subjects as pure functions
  with no DOM, which is what R-6 asks for and what keeps the suite off `.test.tsx`.
- **The object-form proxy target is the right answer to §0.5**, and it is the answer that adds no
  exemption to the guard Q-0014's round 2 already paid for narrowing once.
- **Every task references at least one contract**, which `solutioning.yaml:16` requires and which is
  not automatic — and no two tasks own the same file, which `architecture.md:69` names as the sign
  of a bad cut.
- **The rejected-alternatives section is real**, not decorative: the `@quorum/server` export
  surface, the copied union, the monolithic hook, automatic reconnection and the URL-string target
  are each refused with the reason, and four of the five reasons are the tree's rather than taste.
- **The verification note is honest.** It says the install could not reach the registry and that
  the typecheck therefore *"did not constitute a code verdict"*, rather than reporting green. A
  reviewer cannot tell an uninstalled suite from a red one, and this draft did not make me guess.

---

## 2. Blockers

### B-1 — Eight of the fourteen tasks are qa-red work, and `development.yaml` will fan out every one of them

`frontend-route-scan`, `frontend-protocol-tests`, `frontend-shell-tests`, `frontend-package-guards`,
`backend-wire-guards`, `backend-cors-guard`, `backend-documentation-tests` and the test half of the
docs work are all described as *"during qa-red"*. That qualifier reaches nothing.

**Measured.** `harness/flows/development.yaml:6` fans out
`{ from: solution/tasks.yaml, by: role, respect: depends_on, scope: failing-tasks-only }` over the
whole file. `packages/core/src/engine/composite.ts:184` applies the scope only
`if (fanOut.scope === 'failing-tasks-only' && context.failingTasks?.size)`, and `:419` sets
`context.failingTasks = null` — so on the **first** traversal every task in the file is dispatched.
Each one gets a worktree, a branch `harness/Q-0120/<task.id>`, and a paid adapter invocation carrying
the instruction at `development.yaml:15`: *"Implement ONLY your task so that the tests covering it
pass. **Do not modify tests.**"*

So eight tasks are handed to an agent that must refuse them. Best case: eight correct refusals, eight
empty branches merged by `integrate`, and the sixteenth appearance of a loop handed work no agent in
it can perform — found before the money this time only if this review is acted on. Worst case: an
implementer obeys the task rather than the flow and writes the tests it is also asked to make pass.

**No prior `tasks.yaml` in this repository does this.** All three — Q-0006, Q-0011, Q-0033 — carry
development tasks only, and each says so in its own description:
`backlog/Q-0011-…/solution/tasks.yaml` reads *"Do not edit … `spike/test/**`; `spike/test/**`
belongs to qa-red."* That is the convention, measured rather than assumed.

**The draft's motive is legitimate and the remedy has to preserve it.** `qa-red.yaml`'s `write-tests`
step reads `solution/tasks.yaml` and **not** `solution/solution.md`, so tasks.yaml looks like the only
channel that reaches the test writer. It is not: `qa-red.yaml`'s `scenarios` step reads
`solution/solution.md`, and its scenarios are `write-tests`' first input. So:

> **Remedy.** Move the eight test tasks out of the YAML block and into a prose section of the
> solution document — *"What qa-red must write, and which existing registers move"* — naming the same
> file sets. `scenarios` reads it, tags each scenario with the task ids it covers as its instruction
> already requires, and `write-tests` receives it that way. `tasks.yaml` keeps the six development
> tasks and nothing else. Nothing is lost and eight worktrees are.

### B-2 — `apps/web/src/daemon-endpoints.ts` is owned by no task, and AC-13(a) is unsatisfiable under either reading of it

The six development tasks own `frame-parser.ts`, `connection-state.ts`, `run-connection.ts`,
`vite.config.ts`, `app.tsx` and `shell.tsx`. `daemon-endpoints.ts` appears in four tasks'
`contracts:` lists and in no task's `description`. `architecture.md:65–68` is explicit: *"a file no
task owns cannot be fixed by anyone, and the development loop will spend its whole iteration budget
discovering that."*

The Contracts section calls it *"complete `DAEMON_ENDPOINTS` register plus `runEventsPath` and
`runEventsUrl` contracts"*, which is ambiguous, and **both readings fail**:

- **Complete.** Then AC-13(a)'s assertions — an `http:` page, an `https:` page and the four hostile
  handles carrying `/`, `?`, `#` and a space — are green the moment qa-red writes them. `prove-red`
  carries `expect: fail` and `scenario-review` is instructed to check that *"the red report shows the
  suite failing on assertions"*. More seriously, the scheme derivation and the percent-encoding are
  **behaviour**, and behaviour that arrives as a contract has bypassed the development loop, the
  cross-vendor review of implementation, and the red phase entirely.
- **Stubbed.** Then nobody implements it. `frontend-socket-controller` is told *"Own
  `apps/web/src/run-connection.ts` only"*, so the red tests stay red, `integrate` fails its three
  iterations and the loop exhausts at a gate with nothing to advance.

The requirement anticipated exactly half of this. §6 item 5 blesses *"the endpoint register (AC-13(d))
and the connection-state set (AC-15), as the **real tables**"* — a table, because *"a register stubbed
empty makes every test that reads it vacuous"*. It says nothing about a URL builder, which is a
function with four edge cases under test.

> **Remedy.** Split the module's contract from its behaviour: `DAEMON_ENDPOINTS` ships **complete**
> (it is a table, and `vite.config.ts` imports it), while `runEventsPath` and `runEventsUrl` ship as
> stubs throwing `not implemented` — and give `apps/web/src/daemon-endpoints.ts` an owning task.
> Folding it into `frontend-socket-controller` is acceptable; a seventh task is cleaner.

### B-3 — `App`'s and `Shell`'s new prop shapes are in no contract, so AC-17, AC-18 and AC-20's red tests fail on missing symbols

AC-20's test is *"a mounting of the run route asserted to construct **exactly one** socket through the
injected transport"*. `apps/web/src/shell.test.ts:30` imports `App` and every case mounts
`createElement(App, { initialPath })`; `App`'s signature today is `{ initialPath?: string }`
(`app.tsx:24`) and `Shell`'s is `{ path, onNavigate, children }` (`shell.tsx:88`). Injecting a socket
factory means both signatures change.

Neither new shape is a committed contract. `SocketFactory` and `SocketTransport` are contracted inside
`run-connection.ts` — good — but *how a test reaches them through the component tree* is not. So
`write-tests` cannot write that assertion against anything: it fails to **compile**, which is the one
failure mode `qa-red.yaml`'s `scenario-review` rejects by name and which `architecture.md`'s contract
section calls out — *"If it fails on a missing symbol the contract was not concrete enough, which is
`prove-red`'s job to catch and the architecture reviewer's to prevent."* This is that sentence
arriving on this document.

It is also a task-pair hazard. `frontend-route-connection` owns `app.tsx` and is told *"Do not touch
shell presentation"*; `frontend-connection-region` owns `shell.tsx` and is told *"Do not touch app
lifecycle"*. They are in separate worktrees on separate branches and cannot see each other until
`integrate`. Between them they must independently invent one identical React props shape, and nothing
discovers a disagreement until the merged typecheck fails — at which point `scope: failing-tasks-only`
has to decide which of them was wrong.

> **Remedy.** Add the two prop interfaces to the contracts — a `ShellConnectionProps` (or equivalent)
> declared once, in a module both tasks import, with `App`'s injection parameter named and typed.
> Alternatively merge `frontend-route-connection` and `frontend-connection-region` into one task; they
> are one change to one component tree, and `architecture.md:69`'s *"tasks that share files are a sign
> the cut is wrong"* applies no less when what they share is a type.

### B-4 — `packages/shared/src/wire.ts` carries executable validation that AC-14 tests, and no task owns it

The Contracts section says the shared module is *"complete browser-safe `wireMessageSchema` … The
missed count is a finite, non-negative integer"*. The requirement's §6 item 1 justifies completeness
on the ground that *"it is declarations, and a declaration has nothing to implement"*. That is true of
the `WireMessage` type and false of the schema beside it: a zod schema is runtime behaviour, and
AC-14's test table drives four cases at it — a string count, `-1`, `1.5` and a non-finite — each
required to produce a **distinguishable** refusal asserted by value.

If that discrimination is wrong, nobody can fix it. `frontend-frame-parser` owns `frame-parser.ts`
only; `frontend`'s grant is `apps/*, packages/ui, packages/i18n` and does not reach `packages/shared`
at all. No backend task owns any production file in `packages/shared`.

This is the same shape as B-2 and it is worth naming as one class rather than two instances: **the
draft promoted three files carrying behaviour to "complete contracts" and then gave the behaviour no
owner** — `daemon-endpoints.ts`, `packages/shared/src/wire.ts`, and (with no behaviour, but also no
owner for a later round) `packages/server/src/wire.ts` and `packages/shared/src/index.ts`.

The last one is the sharpest, because the gate spent a hand-written role grant on it. GO-1 was
discharged on 2026-09-11 by adding `packages/server` to `developer-backend`'s `paths:`, its
allowed-path sentence and `architecture.md`'s table row — verified in the tree at
`harness/roles/developer-backend.md`, which now carries a paragraph explaining why. The draft then
gives `packages/server/src/wire.ts` to no task, so the grant bought nothing this ticket uses.

> **Remedy.** One `backend` task owning `packages/shared/src/wire.ts`, `packages/shared/src/index.ts`
> and `packages/server/src/wire.ts`, with the schema stubbed to the extent a schema can be — the
> `WireMessage` type and the barrel line complete, `wireMessageSchema` declared with a body that
> throws — or, if the schema really must ship complete, say so explicitly and move the count
> discrimination into `frame-parser.ts`, where a frontend task owns it and AC-14's four cases can fail
> on an assertion.

### B-5 — Every implementation task is `frontend`, so the fan-out's code is single-vendor

Six development tasks: `frontend-frame-parser`, `frontend-connection-reducer`,
`frontend-socket-controller`, `frontend-dev-proxy`, `frontend-route-connection`,
`frontend-connection-region` — all `frontend`, all claude — plus `backend-architecture-docs`, which
writes Markdown. Codex's entire share of the implementation is documentation.

`harness/architecture.md:63–65`: *"A single-role fan-out is parallelism without a second opinion: it
runs one vendor's judgement across the whole change, which is the thing this project exists to
avoid."* And the requirement's §7 states the intended shape in as many words: *"The `apps/web` half
and the `packages/shared` half are two tasks on two vendors, which is what makes this fan-out
multi-vendor rather than merely parallel — and this is the first ticket whose work is genuinely
`frontend`'s."*

The draft removed the second vendor from the implementation by promoting the `packages/shared` half to
a complete contract. B-4's remedy restores it at no extra cost, which is why the two are listed
separately but fixed together.

---

## 3. Majors

### M-1 — AC-21's lockfile assertion is placed where its read is not covered, and the tree has already ruled that placement the other way

`frontend-package-guards` is told to *"assert the workspace lockfile link"* inside
`apps/web/test/package.test.ts`. `apps/web` has **no `turbo.json`** (checked), root `turbo.json`'s
`globalDependencies` are `tsconfig.base.json`, `eslint.config.js`, `vitest.shared.js`, `.nvmrc` — no
lockfile — and `packages/core/src/turbo-inputs.test.ts:151–153` audits only `@quorum/shared#test` and
`@quorum/core#test`. So the read is undeclared, unaudited, and will silently replay a stale green over
a changed lockfile. Non-goal 6 forbids giving `apps/web` a `turbo.json`, so the obvious fix is closed.

The precedent is explicit and in the tree. `packages/shared/src/docs.test.ts:1120–1124`:
*"**The two anchors are here rather than in an `apps/web` test**, which is measured rather than
stylistic: this package's `test` task already declares `docs/04-architecture.md` as an input, where an
`apps/web` test reading a repository file would earn that package its first `turbo.json` and a
`turbo-inputs.test.ts` registration for one assertion."* That is this exact decision, taken one ticket
ago, in the opposite direction.

> **Remedy.** Put the lockfile assertion in `packages/shared`'s suite and add `../../pnpm-lock.yaml`
> to `packages/shared/turbo.json`'s `test.inputs` — both `backend`'s, both in scope, and the
> registration is one line beside twenty like it. Or state in the solution why the uncovered read is
> accepted. Silence is the one answer that is not available.

### M-2 — The lockfile is committed unverified, and a lockfile `--frozen-lockfile` rejects makes `prove-red` green for the wrong reason

The draft's verification notes record `ENOTFOUND` for `registry.npmjs.org`, so the install never
completed. `harness/harness.yaml:31–34` says what happens next in as many words: *"A worktree is a
fresh checkout with no node_modules; without this the suite dies on a missing dependency and
`expect: fail` reads that as proof of red."* `qa-red.yaml`'s `prove-red` carries `expect: fail`. A
lockfile the frozen install rejects therefore produces a **passing** red phase over a suite that never
ran, and the ticket advances on a false red.

The requirement routed this deliberately: GO-1's last paragraph says the lockfile half *"may take a
different answer, being generated rather than authored: the cheapest form is the human running
`pnpm install` and commits it once the manifest line exists — which means at the **solutioning**
gate"*. That is this gate.

> **Remedy.** A gate obligation rather than a criterion: run `pnpm install --frozen-lockfile` to
> completion on the contracts branch and record the exit status in the solution before `qa-red` is
> launched. If it fails, the lockfile is regenerated by hand at the gate, not by a task.

### M-3 — AC-20's retired-sentence assertion is assigned to nobody

AC-20's test list ends with *"an assertion that no file under `src/` carries the retired sentence, so
the replacement cannot sit beside the thing it replaced"*. `CONNECTION_PENDING` is
`apps/web/src/shell.tsx:39`. Neither `frontend-shell-tests` (which owns `shell.test.ts`) nor
`frontend-package-guards` (which owns `source.test.ts`) names it. It is the clause that makes AC-20 a
retirement rather than an addition, and it is the kind of clause that goes missing precisely because
no test file obviously claims it.

---

## 4. Minors

- **`pnpm-lock.yaml` as a `contracts:` entry inlines 80 KB into one prompt.**
  `packages/core/src/fanout/fanout.ts:180–186` reads each contract file and embeds its whole contents
  in the task prompt. `pnpm-lock.yaml` is 2,430 lines / 80,470 bytes, and
  `frontend-package-guards`'s actual subject is two register edits. Cite the importer stanza in the
  prose contract instead, or drop the entry.
- **The Tasks YAML block is a bare sequence.** `solutioning.yaml`'s `tasks` step is instructed to
  emit `tasks: [{id, role, title, description, contracts, depends_on}]`, and `loadTasks` reads
  `.tasks` — `fanout.ts:89` documents that an empty file throws a raw `TypeError` as a preserved
  defect. The `tasks` step will most likely reshape it, but the draft's own block should carry the
  key so the two documents cannot disagree.
- **`contracts:` lists are over-broad in three tasks.** `frontend-socket-controller` names four
  modules plus the prose contract; `frontend-package-guards` names five. Each is inlined in full.
  Naming the interface a task codes against is the point; naming everything adjacent is prompt weight.
- **AC-12(i)'s "at least one file under `src/` imports the shared package" is implied rather than
  assigned.** `frontend-package-guards`'s description covers *"declaration and persistence scans"* and
  not this clause. It is the half of AC-12 that proves the definition is *reachable* rather than
  merely single, so it should be named.

---

## 5. Coverage — every criterion, and what owns it

| AC | implementation owner | test owner | verdict |
| --- | --- | --- | --- |
| AC-12 one definition | **none** — three files are contracts (B-4) | `backend-wire-guards`, `frontend-package-guards` | **unowned** |
| AC-13(a) same-origin URL | **none** — `daemon-endpoints.ts` (B-2) | `frontend-package-guards` | **unowned** |
| AC-13(b) no literal, no exemption | `frontend-dev-proxy` | `frontend-package-guards` | ok |
| AC-13(c) port default | `frontend-dev-proxy` | (no test by design) | ok |
| AC-13(d) endpoint register + recursive scan | `frontend-dev-proxy` / **none** for the register module | `frontend-route-scan` | partial (B-2) |
| AC-13(e) no CORS | negative — nothing to implement | `backend-cors-guard` | ok |
| AC-14 parser | `frontend-frame-parser`; count rule **unowned** (B-4) | `frontend-protocol-tests` | partial |
| AC-15 reducer | `frontend-connection-reducer` | `frontend-protocol-tests` | ok |
| AC-16 missed count | `frontend-socket-controller`, `frontend-connection-region` | `frontend-protocol-tests` | ok |
| AC-17 one socket | `frontend-socket-controller`, `frontend-route-connection` | `frontend-protocol-tests`, `frontend-shell-tests` | blocked on B-3 |
| AC-18 explicit retry | `frontend-socket-controller`, `frontend-connection-region` | `frontend-protocol-tests` | blocked on B-3 |
| AC-19 no persistence | negative | `frontend-package-guards` | ok |
| AC-20 region, no fabrication, no socket off-route | `frontend-connection-region`, `frontend-route-connection` | `frontend-shell-tests` | blocked on B-3; M-3 unassigned |
| AC-21 manifest + lockfile + registers | **none** — contracts (B-4, M-2) | `frontend-package-guards` | M-1, M-2 |
| AC-22 `quorum-source` client condition | `frontend-dev-proxy` | `frontend-package-guards` | ok |
| AC-23 documents + glossary | `backend-architecture-docs` | `backend-documentation-tests` | ok |

Twelve criteria, sixteen rows: four criteria have more than one owner and that is fine. What is not
fine is four rows reading **unowned**.

---

## 6. What would make this approvable

Six changes, none of them a redesign:

1. Move the eight qa-red tasks into a prose section of the solution document; keep `tasks.yaml`
   development-only (B-1).
2. Give `apps/web/src/daemon-endpoints.ts` an owner, and stub `runEventsPath`/`runEventsUrl` while the
   register table stays real (B-2).
3. Contract the `App` and `Shell` prop shapes, or merge the two React tasks into one (B-3).
4. Add a `backend` task owning `packages/shared/src/wire.ts`, `packages/shared/src/index.ts` and
   `packages/server/src/wire.ts` — which also restores the second vendor (B-4, B-5).
5. Move the lockfile assertion to `packages/shared`'s suite with its `turbo.json` input, or state why
   the uncovered read is accepted (M-1).
6. Assign AC-20's retired-sentence clause, and record a completed `pnpm install --frozen-lockfile` at
   the gate (M-3, M-2).

With those in place I would let QA start writing tests, and I would be willing to be on call for the
result.

---

## 7. Observations

True, worth recording, and **not claims about this change** — the channel *"A finding is a claim about
the change; anything else is an observation"* (2026-09-11) opened.

- **`observation:` the requirement's own §11 first observation should be acted on before this ticket
  reaches `review`.** `harness/flows/review.yaml`'s `verdict` instruction is spliced mid-sentence by
  Q-0117's paragraph, and `review.yaml` is the flow this ticket's review stage runs — the first
  ticket since Q-0117 to take the full pipeline rather than the chore route, which is why it has gone
  unnoticed. It is nobody's criterion and it is one line by hand in the shipped file, its byte-shared
  template mirror and `02-sdlc-pipeline-spec.md` §5.
- **`observation:` `qa-red.yaml`'s `write-tests` step cannot read `solution/solution.md`.** Its
  `input.backlog` is scenarios, `tasks.yaml`, errata, scenario reviews and red reports. So the only
  architect-authored document that reaches the test writer directly is `tasks.yaml` — which is a
  structural reason a solution is tempted to put test work there, and B-1's remedy works only because
  `scenarios` *does* read `solution.md`. Whether `write-tests` should read it is a flow question
  larger than this ticket.
- **`observation:` `packages/server/src/package.test.ts:129–136` reads `pnpm-lock.yaml` and
  `packages/server` has no `turbo.json` either.** Its comment claims the read *"reaches this task
  through the `^test` edge the two dependencies create"*; a `^test` edge hashes the dependency
  packages, not a repository-root file. Pre-existing, not this ticket's, and the same class M-1
  raises — recorded so whoever fixes one finds the other.
