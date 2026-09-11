# Q-0120 — Architecture review, solution run 2, iteration 2

*Reviewed 2026-09-11 against `harness/Q-0120/contracts` at `b8f2b1d`, the merged requirement, and
`harness/architecture.md` as GO-2 filled it. Everything below was measured against the committed
contracts rather than read off the document.*

**Verdict: `revise`.** Two blockers, three majors. Both blockers are satisfiability failures — a
clause that can never go green, and a contract that contradicts itself — which is what the role
brief says to check before coverage. Coverage itself is good and I say so in §1 rather than burying
it.

---

## 0. What iteration 2 got right, stated first because it is most of the document

All five of iteration 1's blockers and three minors are genuinely landed, verified in the tree
rather than taken from the "Review findings addressed" list:

- **B-1** — the qa-red tasks are gone from the YAML. Nine tasks remain, all development.
  `development.yaml` dispatches every task on its first traversal and forbids test edits, so
  iteration 1's arrangement would have handed a development agent work its own instructions refuse.
- **B-2** — `frontend-daemon-endpoints` exists and is the sole owner of `daemon-endpoints.ts`. The
  register is complete (five prefixes) and both URL builders are typed stubs, which is the right
  cut: a register stubbed empty makes its tests vacuous, a URL builder stubbed complete makes its
  tests green before development.
- **B-3** — `AppProps`, `ShellProps` and `ShellConnectionProps` are committed (`app.tsx:25-30`,
  `shell.tsx:46-60`), and `app.tsx` and `shell.tsx` are one task. Correct: they share one
  component-tree protocol and separate worktrees would have to invent matching props twice.
- **B-4 / B-5** — `backend-wire-schema` exists and owns the shared module, the barrel and the server
  re-export. The intent is right; §2.2 is why the execution does not yet deliver it.
- **M-1** — the lockfile assertion moved out of `apps/web`, and `backend-lockfile-test-input` adds
  `../../pnpm-lock.yaml` to `packages/shared/turbo.json`. I checked that file: the entry is absent
  today, so the task has a real subject. The ordering is also right and worth naming as a virtue —
  the test lands at qa-red and fails `turbo-inputs.test.ts` on an undeclared read, the declaration
  lands at development and turns it green. That is a legitimate red→green pair rather than an
  accident.
- **Minor — YAML shape** — the block now opens `tasks:`, which `loadTasks` requires
  (`fanout.ts:107`, `parsedTasks(...).tasks ?? []`). Iteration 1's block would have fanned out zero
  tasks and thrown `no tasks to fan out`.

The manifest and lockfile are consistent: `apps/web/package.json` declares
`"@quorum/shared": "workspace:*"` and `pnpm-lock.yaml`'s `apps/web:` importer carries
`specifier: workspace:*` / `version: link:../../packages/shared`. A frozen install has nothing to
resolve for it. The architect's `ENOTFOUND` was the sandbox having no store, not a lockfile defect —
but the draft is right to refuse to call it a verdict, and the gate still owes the install.

`apps/web/tsconfig.json` extends `tsconfig.base.json`, which sets
`customConditions: ["quorum-source"]`, so `tsc --noEmit` resolves `@quorum/shared` to `src/index.ts`
on a fresh clone. The typecheck half of §0.9's hazard is already closed and no criterion needs to
cover it.

---

## 1. Coverage: every criterion has a task, every task has contracts

| criterion | owner |
| --- | --- |
| AC-12 one definition, browser-reachable | `backend-wire-schema` (+ scans → qa-red) — **see M-1** |
| AC-13(a)(b) same-origin, no network literal | `frontend-daemon-endpoints`, `frontend-dev-proxy` |
| AC-13(c) port is configuration | `frontend-dev-proxy` |
| AC-13(d) endpoint register, widened scan | `frontend-daemon-endpoints` + qa-red — **B-1** |
| AC-13(e) nothing added to the daemon | no code change; guard → qa-red |
| AC-14 parser | `frontend-frame-parser` — **B-2** |
| AC-15 reducer | `frontend-connection-state` |
| AC-16 missed count | `frontend-run-connection`, `frontend-react-connection` |
| AC-17 one socket | `frontend-run-connection` |
| AC-18 explicit retry | `frontend-run-connection`, `frontend-react-connection` |
| AC-19 no persistence | property of the controller; scan → qa-red |
| AC-20 connection region | `frontend-react-connection` — **M-3** |
| AC-21 manifest + lockfile | architect contracts + `backend-lockfile-test-input` |
| AC-22 client resolve conditions | `frontend-dev-proxy` |
| AC-23 documents and vocabulary | `backend-connection-docs` |

No criterion is orphaned, no two tasks own a file, every task cites contracts it actually needs, and
every description states both owned files and forbidden surfaces. The contracts themselves are the
best this repository has emitted on this route: `ConnectionState` is a nine-member closed union with
the discriminating payloads on the members that need them (`requestedUrl` on `no-daemon`, `code` and
`reason` on `interrupted`), `ConnectionMachine` carries `opened` and `terminalSeen` so *ended*
versus *interrupted* is decidable rather than guessed, `FrameRefusal` is six named kinds, and
`SocketTransport` is a four-callback subset a fake can implement in ten lines. A red test can fail
on an assertion against every one of them.

---

## 2. Blockers

### 2.1 — AC-13(d)'s widened route scan can never go green

`apps/web/test/routes.test.ts:26` builds its corpus from a flat `readdirSync` filtered to `.tsx`,
and `:40`'s `pathLiterals` matches `/['"`](\/[^'"`\n]*)['"`]/g` over **raw text, comments
included** — deliberately, per its own header: *"That over-collects, which is the safe direction."*
Clause 3 at `:169` refuses every collected literal the register does not hold.

The solution's qa-red line transcribes the criterion verbatim — *"recursively walk every file under
`src`, excuse exactly the endpoint-register literals"* — without measuring what the walk collects. I
measured it. Widening to every file under `src/` newly collects, beyond the two the endpoint
register contributes (`/project` and `/tickets`, neither being a route — `ROUTES` holds `/projects`
plural and no `/tickets`):

| file | literal | what it is |
| --- | --- | --- |
| `apps/web/src/router.ts:25` | `/backlog/` | JSDoc prose |
| `apps/web/src/router.ts:112` | `/har` | JSDoc prose |
| `apps/web/src/router.ts:110` | `/runs/<handle>` | JSDoc placeholder |
| `apps/web/src/shell.test.ts:155` | `/runs/run%20one` | percent-encoding fixture |
| `apps/web/src/shell.test.ts:177` | `/nowhere/at/all` | unmatched-path fixture |
| `apps/web/src/shell.test.ts:178` | `/backlog/%E0%A4%A` | malformed-encoding fixture |

**No task owns `apps/web/src/router.ts`** — `grep router.ts` over the draft returns zero. And the
three in `shell.test.ts` are test files, which `development.yaml` forbids development agents to
modify, and they exist precisely to prove the router survives hostile input, so deleting them is not
available either.

So "excuses exactly the literals the endpoint register holds" is satisfiable by nobody. `write-tests`
will implement it literally, `prove-red` will go red (correctly, and invisibly, since red is
expected), `scenario-review` will pass it because the failure is an assertion rather than a compile
error, and the development loop will spend all three of its iterations discovering that the fix lies
in a file no task owns. That is the first of the two failure kinds the role brief names, and the
remedy is the one it prescribes: **it wants an owner and a ruling.**

Excluding `*.test.ts` from the corpus is not the answer — that is the *"shipping files"* narrowing
Q-0014's round 2 caught, and §0.18 already refused it for AC-12(a).

**What the solution must add:** an exemption model for the widened scan, ruled here rather than
guessed by `write-tests`. A register of `file: literal` identities with a reason each is the shape
this repository already uses (Q-0073's *"a count is not an identity"*), and it must cover all eight
— the endpoint register's two and the six above. Decide separately whether comment text is blanked
before scanning; `turbo-inputs.test.ts` faced the same choice and kept comments unblanked on the
ground that over-collecting fails in the safe direction, which is an argument for the register
rather than for blanking, but it is a ruling either way. If `router.ts`'s three prose literals are
to be reworded instead, a task must own that file.

This is §0.18's repair applied to the criterion next door. Iteration 2 caught AC-12(a) by measuring
and missed AC-13(d) by transcribing — *a measurement copied from a document is not a measurement*,
with the criterion as the document.

### 2.2 — `wireMessageSchema` has no consumer, and the contract contradicts the prose

`grep -rn wireMessageSchema` over `apps/`, `packages/` and `contracts/` returns **exactly one hit**:
its own declaration at `packages/shared/src/wire.ts:9`.

`apps/web/src/frame-parser.ts:1` is `import type { Event, WireMessage } from '@quorum/shared'` —
type-only, so the parser as contracted cannot call the schema. Meanwhile the document's *Behavioral
decisions / Parsing* says *"The shared schema validates the outer envelope. The parser then validates
event payloads with `eventSchema`."* The stub and the prose say opposite things, and
`development.yaml`'s fan-out instruction tells an implementer meeting exactly this to
*"stop and say so in the summary instead of guessing."* That is a round bought for nothing.

The contradiction is not cosmetic, because the reading that makes the prose true breaks AC-14.
AC-14 requires (c) `unknown-type`, (e) `non-object` and (h) `invalid-count` to be **distinguishable
and asserted by value**. All three are envelope-level failures. If one `wireMessageSchema.parse`
validates the envelope as a unit, the parser receives one `ZodError` and must reconstruct three
distinct refusals from its issue tree — which nothing in the stub, the prose contract or
`live-connection.contract.md` describes, and which is exactly the *"single catch-all satisfies a
weaker assertion while telling the user the same wrong thing seven times"* failure the criterion was
written to forbid.

There is a second consequence, and it is why this is a blocker rather than a major. **B-5 claims to
have restored a two-vendor code fan-out by adding `backend-wire-schema`.** As contracted, that
task's entire deliverable is unreachable: a schema no production module imports, tested by a
`packages/shared/src/wire.test.ts` written for it alone. The codex half of the fan-out is dead code
with a dedicated test. The fan-out is two-vendor on paper and single-vendor in what it produces.

**What the solution must decide**, in `contracts/Q-0120/live-connection.contract.md` and in the stub
that expresses it — either:

- **the parser calls `wireMessageSchema`**, in which case the contract states how each of
  `non-object`, `unknown-type` and `invalid-count` is recovered distinctly (a discriminated union on
  `type` with per-branch schemas is the usual answer, and it wants writing down because two tasks on
  two vendors implement the two halves and cannot see each other until `integrate`); or
- **the parser discriminates itself** and `wireMessageSchema` is dropped, with AC-12's *"a runtime
  `wireMessageSchema` beside it"* satisfied by whatever does the envelope work — in which case
  `backend-wire-schema` needs a different subject or the fan-out is honestly one-vendor and says so.

Either is defensible. What is not available is shipping both descriptions.

---

## 3. Majors

### M-1 — nothing in `apps/web/src` imports a *value* from `@quorum/shared`

Every one of the four is `import type`: `connection-state.ts:1`, `frame-parser.ts:1`,
`run-connection.ts:1`, and `app.tsx:12` (a local type). A type import is erased at compile time and
reaches no bundle, so as committed:

- AC-12's *"reachable from a browser bundle"* has no subject, and its test (i) clause — *"at least
  one file under `src/` imports the shared package"* — would pass over an import that proves nothing
  about reachability.
- AC-21's *"a value from the new dependency asserted to resolve under the workspace source
  condition"* has nothing in `src/` to assert over.
- AC-22 exists entirely so `vite dev` and `vite build` resolve `@quorum/shared` from source rather
  than a gitignored `dist/`. With only type imports, Vite never resolves the specifier at all, and
  GO-6's measurement would pass for the wrong reason.

The requirement states the point directly: *"AC-14 needs a runtime **parser**, not a type — a type
buys nothing against `JSON.parse`."* The stubs shipped the thing the requirement names as
insufficient. At minimum `frame-parser.ts` should carry the value import of `eventSchema` it is going
to need, so the red suite has a subject and the resolution path is genuinely exercised. This is
entangled with §2.2 and should be settled in the same pass.

### M-2 — a JSDoc block with no declaration beneath it, twice

`packages/server/src/wire.ts` is now 122 lines and **ends** on a JSDoc block. The diff deleted
`export type WireMessage = …` at `:120-122` and left its eleven-line doc comment (`:112-122`,
*"One WebSocket message. … `event` is `@quorum/shared`'s `Event` unaltered …"*) standing. The
architecture context lists *"A comment or JSDoc promising what the code beneath it does not do"* as
one of this repository's recurring mistakes; here there is no code beneath it at all.

The same class in `apps/web/src/app.tsx`: the original three-line JSDoc describing `App` and its
`initialPath` now sits immediately above the newly inserted `/** Injectable application inputs … */
export interface AppProps`, so `AppProps` carries two stacked blocks and the exported `App` function
has lost its own — against `harness/rules.md`'s *"A module, exported symbol, interface field or
non-obvious parameter is documented with a `/** … */` block stating its contract."*

`backend-wire-schema` and `frontend-react-connection` own the two files, so this is fixable — but no
criterion or scenario names it, and `development.yaml` tells an implementer to *"Implement ONLY your
task so that the tests covering it pass."* Nothing will catch it before `review`. Fold the repair
into the two task descriptions, or move the surviving prose onto the shared declaration where it
belongs (reworded, since `@quorum/shared` may not appear under `packages/shared/src` —
`index.test.ts` refuses it).

### M-3 — `shell.test.ts` imports a constant a development task is told to delete

`apps/web/src/shell.test.ts:31` reads
`import { CONNECTION_PENDING, NOT_LOADED, RUN_FLOW_LABEL, TOP_BAR_REGIONS } from './shell.js';`, and
`frontend-react-connection`'s description says *"Replace CONNECTION_PENDING with props …"*.

The phases mask the collision. At `prove-red` the constant still exists, so the import compiles. At
`integrate` the development task removes it and `shell.test.ts` fails to compile — in a test file no
development task may edit, with the run already inside `development.yaml`'s bounded loop. The only
window to remove that import is the qa-red pass, and the solution's assignment for `shell.test.ts`
does not mention it.

AC-20's wording is also worth resolving while you are there: *"retired by replacement, not deleted"*
reads as being about the **sentence**, while the task description reads as being about the
**constant**. Say which, because the AC-20 assertion assigned to `apps/web/test/source.test.ts`
(*"no file under `src/` carries the retired sentence"*) is satisfied by either and the compile is
not.

---

## 4. Minors

- **The lockfile assertion's home is unnamed.** *"`packages/shared/src/package.test.ts` or the
  existing package-level suite chosen by qa-red"* — that file does not exist; the package holds
  twelve `.test.ts` files and none is `package.test.ts`. It survives only because
  `backend-lockfile-test-input` declares the input at package level, which covers any file in the
  package. Name it anyway, so the declared input and the read cannot drift.
- **`frontend-daemon-endpoints` is not listed as a contract of `frontend-dev-proxy`'s peers.**
  `frontend-dev-proxy` cites `apps/web/src/daemon-endpoints.ts`, which is right, and
  `frontend-run-connection` cites it too. Consistent — noted only because `frontend-frame-parser`
  cites `packages/shared/src/wire.ts` for a schema §2.2 says it may not be able to use.

---

## 5. Observations

Not claims about this change, per *"A finding is a claim about the change; anything else is an
observation"* (2026-09-11).

- **`observation:` `by: role` in `harness/flows/development.yaml:6` is read by nothing.**
  `packages/core/src/engine/composite.ts:2` describes the fan-out as *"one agent step per task"*, and
  `runFanOut` at `:191` branches only on `fanOut.respect`. There is no grouping anywhere in the
  engine. With nine tasks all at `depends_on: []` this run cuts nine concurrent worktrees in one
  wave. The solution's role assignment is real; the grouping the key implies is not, and the
  requirement's §R-5 reasoning leans on the key meaning something. Not this ticket's surface.
- **`observation:` the jsdom suite would be the first `apps/web` test to resolve `@quorum/shared`.**
  `apps/web/src/shell.test.ts` runs under `// @vitest-environment jsdom`, and §0.9's measurement
  scoped `vitest.shared.js:32-36`'s `ssr.resolve.conditions` to *"Vitest's node environment"*.
  Whether a jsdom-environment suite resolves the same way on a tree with no `packages/shared/dist`
  is unmeasured; GO-6 measures `vite build`, not this. One command at the same gate — a resolution
  failure at `prove-red` would be read as proof of red, which is the hazard `harness.yaml:31-34`
  already names for installs.
- **`observation:` the review flow this ticket will reach is spliced mid-sentence.** The requirement
  §11 recorded it and it is still true on `main`: `harness/flows/review.yaml`'s `verdict`
  instruction has Q-0117's paragraph inserted between *"there must be at least one"* and
  *"finding."*. `chore.yaml` is correct. It wants a one-line fix by hand before this ticket reaches
  `review`, in the shipped file, its template mirror and `02-sdlc-pipeline-spec.md` §5.

---

## 6. What I would need to approve

1. §2.1 — an exemption model for AC-13(d)'s widened scan, as a register of `file: literal`
   identities with a reason each, covering all eight measured literals; plus an owner for
   `apps/web/src/router.ts` if its three prose literals are to move instead.
2. §2.2 — one description of who validates the envelope, expressed in both the prose contract and
   `frame-parser.ts`'s imports, and stating how AC-14's three envelope-level refusals stay
   distinguishable; with `backend-wire-schema`'s subject adjusted if the schema turns out to have no
   caller.
3. M-1 — at least one value import of `@quorum/shared` in `apps/web/src`, so AC-12, AC-21 and AC-22
   have a subject.
4. M-2 — the two orphaned JSDoc blocks folded into their owning task descriptions.
5. M-3 — the `CONNECTION_PENDING` import named in `shell.test.ts`'s qa-red assignment, and AC-20's
   sentence-versus-constant ambiguity resolved.

Nothing here asks for a larger scope or a different cut. The seams are right, the contracts are
concrete, and the ownership table is sound. What is missing is two rulings the architect owes and
three edits that take a paragraph each — and both blockers are the kind that cost a full development
loop if they reach `write-tests` unresolved, which is the whole reason this gate exists.
