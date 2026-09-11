# Q-0120 — The web app holds a live connection to the daemon

*Merged requirement, run 1, iteration 2. Written 2026-09-11 against the tree at `082b0e4`.*

*__Iteration 2 opened on an unchanged tree and says so.__ `git status` carries only this ticket's
own untracked `requirements/` and `runs.log`; `ticket.md` is unmodified since 16:46, before
iteration 1 ran, so __no gate ruling was written into the body__ and the blocker cannot be settled by
re-asking. What follows is therefore a re-measurement rather than a restatement, on the precedent
that a second pass may still find something (Q-0105). It found four things, two of which change the
verdict's shape and two of which shrink the document: the carried blocker is __sharper__ (§0.16),
there is a __second blocker nobody had reached__ (§0.15), two of the three wire shapes have __no
consumer in this ticket__ (§0.17), and one criterion was __unsatisfiable as written__ (§0.18).*

**Surfaces:** `apps/web`, `packages/shared`, `packages/server` (one import and one re-export, and
nothing else), `pnpm-lock.yaml`, `docs/04-architecture.md`, `docs/GLOSSARY.md`,
`harness/architecture.md`. **Not** the CLI, not `core`, not `backlog/`, not `harness/flows/`.

**Route:** the full pipeline — `solutioning` → `qa-red` → `development` → `review` — ruled at
Q-0014's gate. This document is written for that route: §6 states what solutioning must emit for a
red phase to fail on assertions rather than on missing symbols, §7 maps every file to a task owner,
and **§10 GO-1 and GO-2 are blocking**, because two files have no owner and the architect's own
context document cannot answer the question its work turns on.

---

## 0. What was measured, and what it changes

Eighteen entries. Each is a claim in a candidate, in iteration 1's merged document, or an assumption
behind one, checked against the tree. §0.1 to §0.14 keep iteration 1's identities so the two
documents can be read against each other; **§0.15 to §0.18 are new**.

**§0.1 — The question of where the wire shapes live is answered by a landed guard, and the answer is
(B). Re-verified.** `packages/server/src/package.test.ts:138–147`, under the comment *"The local
distribution set is three packages and this ticket does not make it four"*:

```
expect(own.scripts?.build).toBe(undefined);
expect(own.exports).toBe(undefined);
expect(own.main).toBe(undefined);
expect(own.types).toBe(undefined);
expect(own.files).toBe(undefined);
expect(own.bin).toBe(undefined);
```

Option (A) — give `@quorum/server` an export surface — turns six assertions red and moves
`packages/cli/src/build.test.ts`'s per-package emit register with it; its `default` condition would
name a `dist/` this package has no build script to produce, which is the
artifact-that-does-not-exist decision 078 rejects. Option (B) touches neither. **Ruled in AC-12; an
implementer may not reopen it.**

**§0.2 — The shapes are host-independent, verified field by field. Re-verified.**
`packages/server/src/wire.ts:24–28` `WireRefusal` is three strings; `:100–105` `WireRun` is
`handle`, `flow`, `runId`, `state`; `:122–124` `WireMessage`'s `event` is `unknown`. What is *not*
movable is equally clear: `badRequest` (`:31`), `wireRefusalOf(code, refusal: Refusal)` (`:36`),
`wireRunOf(outcome: StartOutcome)` (`:108`) and the three status tables (`:53`, `:74`, `:87`, the
last two `as const satisfies Record<AnswerRefusal|StopRefusal, number>`) are typed against
`./host.js` and `./refusal.js` and stay.

**§0.3 — There is a fourth wire shape and it stays.** `packages/server/src/read.ts:50` declares
`WireTicket`, Q-0119's, exported from the same barrel. Host-independent too, so "only three are
movable" is the wrong reading — what makes a shape movable *now* is that this client consumes it.
§0.17 narrows that further.

**§0.4 — `apps/web` must gain a dependency, and two registers pin the set exactly. Re-verified.**
`apps/web/package.json` declares `react` and `react-dom` and no workspace package.
`apps/web/test/package.test.ts:97` asserts `Object.keys(own.dependencies).sort()` is
`['react', 'react-dom']`; `:88` asserts `JUSTIFICATIONS`'s keys equal the declared set in **both**
directions; `:94–95` states the division as *"what a bundle contains against what only builds or
tests it"*, and `@quorum/shared` is on the bundle side because AC-14 executes its schema in a
browser. AC-21.

**§0.5 — AC-13's URL literals collide with Q-0014's own network scan, and the collision is avoidable
rather than exemptable. Re-verified.** `apps/web/test/source.test.ts:253` assembles
`` [`http:${'//'}`, `https:${'//'}`, `${'//'}fonts.`] ``, `:257` walks **every file in the package**,
`:265` asserts the walk reaches more than the source, `:276` is its discriminating fixture. A proxy
target written `'http://127.0.0.1:4317'` fails it. `vite@8.2.2`'s `ProxyTargetUrl`
(`node_modules/vite/dist/node/index.d.ts:365–369`) is
`URL | string | { port: number; host: string; protocol?: string }`, so the target is an **object**
and no URL literal is written anywhere. An exemption is **forbidden rather than granted**: an
exemption in the scan that forbids network literals is the narrowing Q-0014's round 2 already paid
for once.

**§0.6 — There is no default daemon port, so "a documented default" had no subject. Re-verified.**
`packages/server/src/serve.ts` takes `port?` and asks the operating system for a free one; no
`DEFAULT_PORT` exists anywhere, and `quorum open` — named in `04-architecture.md:165` and in M3's
done-when — does not exist. The number a dev-server proxy points at is **a convention of the dev
server**, not a fact about the daemon, and must say so in the file. AC-13(c).

**§0.7 — Same-origin means the client has no daemon address to name.** Under AC-13 the address the
client tried is the **page's own origin** plus a path; the proxy target is the dev server's and the
browser never sees it. A client printing `127.0.0.1:<port>` would assert something it does not
hold — the failure `quorum board` refuses when it declines to render a containment token git could
not produce. Narrowed in AC-15 to the URL the client actually requested, which is also what a reader
pastes into a terminal.

**§0.8 — A glossary term is addable without touching `CLAUDE.md`, and no count is carried.**
`packages/shared/src/docs.test.ts:629–648` compares `CLAUDE.md`'s *"use exactly these terms"* list
with `docs/README.md`'s copy of it, **with each other and with nothing else** — an anti-vacuity
anchor, a floor of `> 15` rather than a count, and an ordered equality. Neither is compared with
`docs/GLOSSARY.md`'s headings. **Confinement**, **Run lock**, **Undecided**, **Event** and **Run
history** are glossary entries absent from the 22-term lists, and Q-0059 is the precedent that added
one to the glossary alone, through the flows. The claude candidate's *"33 glossary terms"* did not
reproduce at iteration 1 and does not reproduce now — `grep -cE '^\*\*[^*]+\*\*' docs/GLOSSARY.md`
answers **38**, and at least one of those is a bolded sentence inside an entry. No criterion depends
on a count and none is stated.

**§0.9 — The browser build resolves `@quorum/shared` through Vite's *client* conditions, which
nothing in this workspace sets. Re-verified, and it is the most likely single cause of a lost
round.** `packages/shared/package.json`'s `exports` resolves `quorum-source` to `./src/index.ts` and
**everything else to `./dist/index.js`**. `vitest.shared.js:32–36` sets `ssr.resolve.conditions`
only, and its header at `:22–23` says why in as many words: *"It is `ssr.resolve` and not `resolve`
because Vitest's node environment resolves through Vite's server pipeline; setting the client list
as well was measured to be redundant here and dropped."* `apps/web/vitest.config.js` re-exports that
file, so the **suite** resolves to source; `apps/web/vite.config.ts` sets no conditions, so
`vite dev` and `vite build` resolve to a gitignored `dist/` that no suite builds. The app would work
on a machine that has run `pnpm turbo run build` and fail on a fresh clone — **a verdict that is a
property of the checkout rather than of the commit**, which *"A test's verdict is a property of the
commit, not of the checkout or the account"* (2026-08-30) forbids. AC-22.

**§0.10 — `integrate` runs `pnpm install --frozen-lockfile`, so the lockfile moves with the
manifest — and no role may write it. Re-verified, and the harness file is blunter than iteration 1
reported.** `harness/harness.yaml:31–34` reads: *"A worktree is a fresh checkout with no
node_modules; without this the suite dies on a missing dependency and `expect: fail` reads that as
proof of red."* `pnpm-lock.yaml:36–43` carries the `apps/web:` importer with exactly `react` and
`react-dom`. So a manifest ahead of the lockfile fails install, and **`prove-red` reads that failure
as proof of red** — the flow's own comment says so. `pnpm-lock.yaml` appears in no role's `paths`.
Implement steps have written it on six tickets (Q-0043, Q-0045, Q-0090, Q-0098, Q-0013, Q-0014
twice) because `paths` is advisory and enforcement reaches an agent only through role prose — **but
every one of those was a chore or port run**, and `development.yaml`'s fan-out instruction says
*"Do not touch files outside your role's allowed paths"*, so a well-behaved implementer refuses.
GO-1.

**§0.11 — No admissible fan-out role may write `packages/server/`. Re-verified against the role
files themselves.** `solutioning.yaml:16` confines task roles to *"role (frontend|backend|data)"*.
`harness/roles/developer-frontend.md` → `paths: [apps/*, packages/ui, packages/i18n]`;
`developer-backend.md` → `paths: [packages/core, packages/shared, harness, docs, backlog]`;
`developer-data.md` → `packages/database`. **None covers `packages/server`.** `tooling`
(`packages/core`, `packages/shared`, `packages/cli`) does not either, and is not an admissible task
role despite `harness/architecture.md:40` calling it a live fan-out role — §11 records that
contradiction. GO-1.

**§0.12 — The daemon never sends a zero missed count. Re-verified.**
`packages/server/src/http.ts:109–111`: `return count > 0 ? JSON.stringify({type:'missed',count}) :
null`. So the parser must still **accept** zero, its job being total, and the renderer renders no
notice for it. AC-16, with the reason recorded beside the test.

**§0.13 — The route-literal scan is blind in two directions. Re-verified.**
`apps/web/test/routes.test.ts:26–30` builds its corpus from a **non-recursive** `readdirSync`
filtered to `.tsx`, so a path literal in a `.ts` module is invisible **and so is any file in a
subdirectory**. `pathLiterals` at `:38` matches `/['"`](\/[^'"`\n]*)['"`]/g`, so a template literal
`` `/runs/${handle}/events` `` **is** collected and must be registered. And `ROUTES` may not gain
the endpoint: `src/router.ts` matches `ROUTES`, so the shell would navigate to a WebSocket URL and
draw a placeholder at it. Both blindnesses close together in AC-13(d) — closing one leaves the other
as the way round it.

**§0.14 — An `apps/web` test may not read `packages/server`, and the reason is cache coverage.
Re-verified.** `packages/core/src/turbo-inputs.test.ts:151–153` audits exactly two suites,
`@quorum/shared#test` and `@quorum/core#test`, and `apps/web` has no `turbo.json`. A test there
reading `packages/server/src/wire.ts` would be refused by no clause and covered by no declared
input. Reading `packages/shared` is already solved: `packages/server/src/package.test.ts:129–136`
records the mechanism — *"reaches this task through the `^test` edge the two dependencies create"* —
which `apps/web` acquires the moment it declares the dependency. AC-12 asserts each half **inside
the package it is about**; this ticket adds no `turbo.json` and no dependency on `@quorum/server`.

---

**§0.15 — NEW, and it is the second blocker. `harness/architecture.md` — the architect's own context
document — has five of its six sections unfilled, and the one that is missing is the one this
ticket's red phase turns on.** The file is 91 lines. `## Roles for task fan-out` (lines 19–84) is
written and is what iteration 1 measured against. The other five are **template prose describing
what should be there**:

- `## Shape of the repository` (`:6–8`) — *"Directory layout and what each top-level area is for
  (apps, services, packages…). Framework, language, runtime, package manager."*
- `## Boundaries the architect must respect` (`:10–12`) — *"Numbered rules: where business logic
  lives, how schema changes happen, who may import whom…"*
- `## Contract conventions (what solutioning must emit)` (`:14–17`) — *"A table of contract kinds →
  format → example path (API: OpenAPI fragment; domain: typed interface + stub; schema: migration
  skeleton in your tool's format; UI: prop types and states; …). Tests in the red phase compile
  against these stubs."* **There is no table.**
- `## Testing and tooling` (`:86–88`) — *"The exact commands: unit/integration, e2e, lint,
  typecheck."*
- `## Things the reviewer should be suspicious of` (`:90–91`) — *"Your project's recurring mistakes,
  stated bluntly."*

This file is `input.harness` for **both** `solutioning.yaml`'s `architect` and its
`architecture-review`, and for every `development.yaml` fan-out task. So the architect is handed the
*instruction to write the contract convention* where the convention should be, and the architecture
reviewer is asked to judge contracts *"concrete enough to write failing tests against"* against
nothing. **It has not bitten before because it has not been asked**: the four tickets that ever
walked this route — Q-0006, Q-0011, Q-0033, Q-0050 — all ran in August against the `spike/` tree
Q-0103 deleted, and everything since has gone `requirements` → `chore`, which loads neither
solutioning nor this section. **This is the first solutioning run against the current workspace.**
It is a blocker rather than an observation because the missing section decides whether a TypeScript
red phase fails on assertions or on unresolved imports, which is the one thing
`qa-red.yaml`'s `scenario-review` step rejects by name. GO-2.

**§0.16 — NEW, and it sharpens the carried blocker rather than softening it: the architect's
instruction confines contracts to `contracts/`, and every contract this repository has ever produced
is there.** `solutioning.yaml:16` asks for *"a 'Contracts' section listing every interface, schema,
stub or migration skeleton you created as files under contracts/ in the repository worktree"*. The
tree agrees: `contracts/` holds four ticket folders and nineteen files — `Q-0006` (7), `Q-0011` (4),
`Q-0033` (3), `Q-0050` (5) — of which eighteen are `.md`, `.json` or `.yaml` and exactly one is
TypeScript (`contracts/Q-0050/run-flow-api.contract.ts`). **Nothing under `packages/` or `apps/`
imports from `contracts/`.** So iteration 1's §6 ruling — *"the contracts for this ticket are stubs
in their final locations"* — contradicts the flow the architect runs and has no precedent here. That
does not make the ruling wrong; §6 restates it, because the alternative is a red phase that fails to
compile. It makes it **a ruling the gate owes rather than one a requirement may assume**, and it
removes the reading under which GO-1's answer (i) was free. Two facts bound the question rather than
settle it: the architect **can** write outside `contracts/` — `packages/core/src/adapters/codex.ts:106`
gives a `worktree: true` step `--sandbox workspace-write`, and `merge-contracts` lands whatever the
branch carries on `harness/{id}/integration` before `qa-red` branches from it — and it has never been
**asked** to. Filling §0.15's contract-conventions section is what turns that from an exception into
the flow working as documented, which is why the two blockers are one decision.

**§0.17 — NEW: two of the three wire shapes have no consumer in this ticket, and one criterion had no
producer.** Under non-goal 2 this client starts no run, answers no gate and stops no run; under
non-goal 3 it lists nothing. Trace what actually reaches the browser: it opens one WebSocket and
receives `event` and `missed` frames, a 1008 close, a 1013 close, a normal close, or a failure
before open. **No `WireRefusal` body ever arrives** — Q-0118 answers an unknown run by accepting the
socket and closing 1008, not by returning a refusal — and **`WireRun` is `POST /runs`'s response
body**, which nothing here calls. So iteration 1's AC-16 specified a refusal renderer with tests and
**no caller**, and AC-12 moved two shapes against a drift that cannot occur, there being no second
declaration for them to drift from. Both are struck: **only `WireMessage` and its schema move**,
AC-12 says in as many words that `WireRefusal` and `WireRun` stay, and AC-16 keeps its missed-count
half. The cost is stated rather than hidden: Q-0015 or Q-0121 will move the other two and pay the
`packages/server` ownership question a second time — which is the argument for GO-1 taking answer
(ii), under which the second move costs nothing.

**§0.18 — NEW: AC-12(a) was unsatisfiable as written, and the file that makes it so is pinned by
identity.** Iteration 1 asked for a scan over every file under `src/` reporting any *"`:` binding
inside an `interface`, `type` or object literal"*. Every test that drives the parser or the renderer
must construct a frame — `{ type: 'missed', count: 7 }` — so the clause refuses its own tests, and
excluding test files from the corpus is exactly the *"shipping files"* narrowing Q-0014's round 2
caught. Nor can the tests simply move: `apps/web/test/package.test.ts:143` asserts
`toContain('src/shell.test.ts')` as an anti-vacuity anchor, so `src/` holds a test file **by
identity** and any new pure-function test naturally belongs beside it. (Q-0014 moved **four** files
out of `src/`, the ones that read the filesystem; `src/index.test.ts` and `src/shell.test.ts`
remain.) Repaired in AC-12(a): the scan forbids **declarations** — an `interface` or `type` alias in
`apps/web` naming those members — and the **compiler** owns literals, a value annotated with or
passed to the imported type being checked by `tsc` rather than by a regex. That is both satisfiable
and stronger.

---

## 1. Problem

The `maintainer` starts a run and the browser cannot watch it. Q-0118 shipped
`GET /runs/:id/events` — one event per message, an envelope telling a late subscriber how many
events it missed, a 1008 close for a handle nothing holds, a 1013 close for a subscriber that fell
behind — and Q-0119 shipped five read routes. **Nothing consumes any of it.** `apps/web` opens no
socket, and `src/shell.test.ts:81–84` installs a throwing `globalThis.WebSocket` to prove it: *"the
shell must not open a socket"*. The top bar's connection region reads
`no live connection yet — Q-0120 opens one` (`src/shell.tsx:38`), and `vite.config.ts`'s own header
already routes the proxy here: *"Proxying the daemon's routes so the app can reach them same-origin
is the live connection's, not the shell's."*

So `DEFAULT_RETENTION`, `MAX_BUFFERED_BYTES`, the 1013 close and the 1008 close are behaviour no
test outside `packages/server` has ever exercised, and the shape Q-0118 built for this app **cannot
be imported by name** — `packages/server` declares no `exports`, `main` or `types`, which its own
suite pins as correct (§0.1). Meanwhile `packages/server/src/wire.ts:4` calls itself *"the contract
Q-0014 codes against"*. An implementer who obeys that sentence finds it unresolvable and copies the
union into `apps/web`: **the drift arrived at by obeying the sentence forbidding it.**

For the `adopter` the failure is worse than absence. With no connection state, a daemon that is not
running and a handle that does not exist look identical — a screen that shows nothing. Those are
*"start the daemon"* and *"that handle is wrong"*, and a product that cannot tell them apart has made
silence stand in for both answers, which is what this repository refuses in `quorum board`'s
containment token, in its push-lag line and in a verified-version state.

## 2. User stories

- **`maintainer`** — *I open a run's URL and see its events arrive live; and when the connection is
  not live I am told which of the eight ways it is not, in a sentence I can act on. If I joined late
  I am told how many events I missed rather than shown a stream that looks complete.*
- **`adopter`** — *I run the dev server before I have a daemon, and the app tells me the daemon is
  not answering and names the URL it asked for, instead of drawing an empty panel. Nothing is left in
  my browser when I close the tab.*
- **`contributor`** — *I read one definition of what crosses the socket, in the one package that is
  safe to bundle for a browser, and I can see from `packages/server`'s own source that it is the same
  definition the daemon serialises.*

## 3. Non-goals

1. **Mission control** — trace columns, cost tickers, the step timeline. Q-0015. This ticket adds a
   connection panel, not a screen; `/runs/:handle`'s register row stays Q-0015's and no
   `screenExists` flips (AC-20).
2. **Starting, answering or stopping a run from the browser.** `POST /runs`, `POST /runs/:id/gate`
   and `POST /runs/:id/stop` stay unreached and `RUN_FLOW_LABEL`'s control stays disabled. A control
   that appears to mutate something is the fabrication Q-0014 refused.
3. **Listing the daemon's live runs.** Q-0121. A handle reaches this app through its URL only, and
   §9 R-1 records what that costs.
4. **A `build` script, a bundle, a static route, and the emitted-artifact ruling.** Q-0122. The
   emitting set stays at three and `apps/web/test/package.test.ts:191` asserts it. §0.9's fix is a
   *resolution condition*, not a build task, and the distinction is the point.
5. **Moving `WireRefusal` or `WireRun`, and rendering a refusal body** (§0.17). Nothing in this
   ticket receives one. Whichever ticket first issues an HTTP request moves them by the same
   mechanism AC-12 establishes.
6. **Moving `WireTicket`** (§0.3), **adding a `turbo.json` for `apps/web`**, or **depending on
   `@quorum/server`** (§0.14).
7. **Automatic reconnection, resume cursors, event deduplication and gap repair.** AC-18 refuses the
   first with its reason; the rest would widen `WireMessage` and are nobody's yet.
8. **CORS, a configurable bind, authentication, remote daemons.** `BIND_HOSTNAME` does not move and
   `packages/server` gains no middleware, header or dependency (AC-13(e)).
9. **Client-side persistence of any kind**, including a "last run" convenience. AC-19.
10. **Widening the gate-answer envelope.** *"Override with reason"* is corrected in two documents
    already; a control reintroducing it would reinstate what `gateAnswerEnvelopeSchema` refuses.
11. **Changing `eventSchema`, `WireMessage`'s vocabulary, the retention size, the backpressure
    ceiling or the close codes.** This is a consumer. A frame shape it cannot parse is a finding
    against this ticket, not a licence to edit the producer.
12. **Filling in the rest of `harness/architecture.md`** beyond the one correction AC-23 names.
    §0.15 is a gate obligation, not a criterion: it is a repository-level document, it is read by
    the step that would otherwise have to fix it, and scoping it here would make this ticket the
    vehicle for a harness rewrite.

## 4. Acceptance criteria

Numbered from 12, continuing Q-0014's, so a criterion keeps its name now that the cut has moved
(Q-0106's convention). **Twelve**, against iteration 1's thirteen and the fifteen that split Q-0013
at eighteen and Q-0096 at twenty-one.

---

**AC-12 — the frame union has exactly one definition, it is reachable from a browser bundle, and it
lands under `packages/shared`'s house rules.**

(a) **One definition.** `WireMessage` is declared in **`packages/shared/src/wire.ts`**, a new flat
module, with a runtime `wireMessageSchema` beside it. `packages/server/src/wire.ts` imports and
re-exports it, so `@quorum/server`'s runtime surface is unchanged and
`packages/server/src/index.test.ts`'s `SURFACE` register does not move; that package's manifest gains
no `exports`, `main`, `types`, `files`, `bin` or `build`. **`WireRefusal`, `WireRun` and
`WireTicket` stay where they are** (§0.3, §0.17) — no client here consumes them, and moving them is
scope this ticket has no subject for. No `interface` or `type` alias anywhere in `apps/web` declares
a member named `type`, `event` or `count` as a restatement of the frame union.

(b) **The compiler owns literals; the scan owns declarations** (§0.18). A value constructed in
`apps/web` is checked against the imported type by `tsc --noEmit`, which is stronger than a regex
and does not refuse the ticket's own fixtures. The scan's subject is a *second declaration*.

(c) **`packages/shared`'s landed guards hold over the enlarged corpus.** `src/` stays flat and the
new module's name satisfies `src/index.test.ts:131`'s `/^export \* from '\.\/[a-z-]+\.js';$/`;
`:135` requires the barrel to expose every module, so the barrel line is forced rather than
remembered. Every import specifier under `src/` is `./…` or `zod` (`:49`); no file imports `node:` or
a bare builtin (`:102`) or reaches for a filesystem, process or environment (`:111`). The literal
`@quorum/` appears in **no file under `packages/shared/src`, tests included** — so
`packages/server/src/wire.ts:117`'s JSDoc, which reads *"`event` is `@quorum/shared`'s `Event`
unaltered"*, is reworded as it moves, and any needle a new test uses is assembled at run time, as
`index.test.ts:72` already does.

***Test:*** three assertions, **each inside the package it is about**, because a scan that lived in
`apps/web` and read `packages/server` would be refused by no clause and covered by no declared input
(§0.14).
(i) In `apps/web`: a scan over every file under `src/` reporting any `interface` or `type` alias
declaring those members, with a positive control that the walk found source, shown to have a subject
by reporting a violation over a fixture that re-declares the union; plus an assertion that at least
one file under `src/` imports the shared package.
(ii) In `packages/server`: `wire.ts`'s specifiers include the shared package and `WireMessage` is
re-exported from it, asserted over the file's own text, with the barrel's surface held by the
existing register.
(iii) In `packages/shared`: the schema is on the barrel, and the six existing clauses of
`src/index.test.ts` re-run over the enlarged corpus — they read the directory rather than a file
list, so they cover the new module without anyone remembering.

---

**AC-13 — the client reaches the daemon same-origin, the endpoint paths are a register, and the dev
server is what bridges them.**

(a) **Same-origin.** The WebSocket upgrade, and any request this app ever makes, use a path relative
to the page's own origin. No absolute URL, hostname, port, `ws:` or `wss:` literal appears anywhere
under `apps/web/src`. The socket URL derives its scheme from the page's — `ws:` for `http:`, `wss:`
for `https:` — and carries the handle as **one** path segment, percent-encoded, so a handle
containing `/`, `?`, `#` or a space cannot create a second segment or reach the query or the
fragment.

(b) **No network literal anywhere in the package, and no exemption.** `vite.config.ts`'s proxy target
is an **object** — `{ host, port }`, which `ProxyTargetUrl` accepts (§0.5) — so Q-0014's
whole-package scan keeps forbidding `http://`, `https://` and `//fonts.` with no file excused.
**Adding an exemption to that scan is a failure of this criterion.**

(c) **The port is configuration, and its default is the dev server's convention, stated as such.**
The target port is read from the environment with a documented default, and the comment beside it
records that the daemon has **no default port** and that choosing one is `quorum open`'s, which does
not exist (§0.6). **No test reads the variable**, so `turbo.json`'s `test` task `env` list stays
`["QUORUM_REAL_CLI"]`.

(d) **One register for the daemon's endpoints, separate from the shell's routes.** The five prefixes
the proxy forwards — `/runs`, `/project`, `/tickets`, `/flows`, `/history` — and the path the client
requests come from one exported table, which `vite.config.ts` imports. **`ROUTES` is not extended**
(§0.13). `test/routes.test.ts`'s component scan is widened from a flat `.tsx` listing to a
**recursive walk of every file under `src/`**, and excuses exactly the literals the endpoint register
holds. That the client uses one of the five today and the proxy forwards all five is deliberate and
stated: the proxy is the daemon's surface, and the first ticket to fetch one of the others inherits
it rather than re-deciding it.

(e) **Nothing is added to the daemon.** No CORS middleware, header or dependency reaches
`packages/server`, and `BIND_HOSTNAME` does not move — adding CORS to an unauthenticated loopback
process that starts agent runs widens exactly what that constant's JSDoc refuses to widen.

***Test:*** URL construction asserted for an `http:` page, an `https:` page and the four hostile
handles; a scan over `apps/web/src` for the forbidden literals with a positive control that it found
source; Q-0014's whole-package scan re-run unchanged plus an assertion that it grants no exemption; a
comparison asserting the proxy's forwarded prefixes and the client's request path come from the
register on both sides rather than being written twice; and a read of `packages/server/src/*.ts` and
its manifest asserting neither gained the string `cors`. **The proxy's own runtime behaviour is
deliberately not claimed** — it is an integration concern, and the bound is that the source is
same-origin, which is what makes the eventually-served bundle work unchanged.

---

**AC-14 — a frame is parsed, never cast, and every refusal is distinguishable.**

One pure function turns one received message into either a parsed frame or a refusal drawn from a
**closed set**. Text frames only. An `event` frame's payload goes through `@quorum/shared`'s
`eventSchema` (`packages/shared/src/events.ts:241`, on the barrel). A `missed` frame's `count` must
be a **finite, non-negative integer**, not merely a number — rendering *"you missed −3 events"* is a
silent default wearing a different hat. Anything else is refused and surfaced. The function **never
throws**: a `JSON.parse` failure is one of its refusals, not an exception.

***Test:*** the parser driven directly, with no DOM and no socket, over (a) a valid event frame,
(b) a valid `missed` frame, (c) an unknown `type`, (d) an event that fails `eventSchema`, (e) a
non-object JSON value, (f) a non-text message, (g) text that is not JSON, and (h) each invalid
count — a string, `-1`, `1.5`, and a non-finite. Each of (c) to (h) produces a **distinguishable**
refusal asserted **by value**, because a single catch-all satisfies a weaker assertion while telling
the user the same wrong thing seven times.

---

**AC-15 — the connection has a named state for every case, and none of them is silence.**

A pure reducer over a closed set: **idle** (no run is open — every route but the run route),
**connecting**, **live**, **no daemon** (the socket never reached open), **no such run** (the daemon
answered and closed 1008), **ended** (a `terminal` event, then a normal close), **interrupted** (a
close before any `terminal` event, carrying the close code and the browser's reason as **text**),
**dropped** (1013 — this subscriber fell behind), and **protocol error** (AC-14).

**The precedence for a close is declared rather than left to be rediscovered**: 1008 → *no such
run*; 1013 → *dropped*; a normal close after an accepted `terminal` event → *ended*; every other
close before a `terminal` event → *interrupted*; and a failure **before `open`** → *no daemon* rather
than *interrupted*. `terminal` is `eventSchema`'s own member (`events.ts:201`), so *ended* is a fact
about the stream rather than about the socket. Each state renders in the top bar's connection region
in plain language. **No daemon** names **the URL the client requested** — the page's own origin and
the path — and never an address it does not hold (§0.7). *No daemon* and *no such run* are the
load-bearing pair: they are "start the daemon" and "that handle is wrong".

***Test:*** the reducer driven over every transition and asserted **by value**, with no DOM; *no
daemon* and *no such run* asserted to produce different states **and** different user-facing strings,
which is the clause a single catch-all fails; *ended* asserted to require a `terminal` event rather
than a close code alone, and a normal close with no terminal event asserted to be *interrupted*.

---

**AC-16 — a `missed` count is reported, and it is not an event.**

A `missed` frame is surfaced with its count, never dropped and never added to the accepted event
list. The notice survives a retry (AC-18). No ANSI escape, colour code or vendor branching is
introduced into anything that crosses the wire — `packages/server/src/wire.ts:7–10` is the other half
of that rule and this is this end of it.

***Test:*** the missed handler driven with `count: 7` and required to surface the number and to add
nothing to the event list, and with `count: 0` and required to render no notice — **with the reason
recorded beside it** that `http.ts:109–111` returns `null` for `count <= 0`, so the daemon never
sends a zero and that case is the parser's defence rather than evidence about the wire (§0.12).

---

**AC-17 — one socket at a time, and leaving closes it.**

The run connection owns at most one active socket. Mounting the run route opens one for its handle;
changing the handle closes the previous before opening exactly one replacement; leaving the route or
unmounting closes the active one and opens none. Once a socket is superseded, closed or disposed,
none of its `open`, `message`, `error` or `close` callbacks may change connection state, accepted
events or the incomplete-replay notice. Repeated cleanup is safe. **The socket constructor is
injectable**, because a throwing global — Q-0014's instrument at `src/shell.test.ts:81–84` — can
prove a socket was *not* opened and cannot drive a callback.

***Test:*** driven against a fake transport that records construction, sends and closes. Asserted
over **the transport's own close record**, never over "the run still exists", which is true whether
or not anything was released — the shape Q-0118's round 2 caught.

---

**AC-18 — retry is explicit, and retrying preserves what arrived.**

*No daemon*, *no such run*, *interrupted*, *dropped* and *protocol error* each offer a Retry action.
**The client never reconnects automatically**: without a resume cursor an automatic reconnection
either duplicates events or hides a missed prefix, and Q-0118's `missed` envelope exists precisely so
a gap is reported rather than smoothed over. Retry closes any previous socket, invalidates its
callbacks, constructs exactly one replacement, moves the state to *connecting*, and clears neither
the events already accepted nor the incomplete-replay notice. Repeated activation cannot leave
concurrent sockets.

***Test:*** over the fake transport — no socket is constructed after a failure without an explicit
retry, one retry constructs exactly one replacement, repeated retries still leave one current socket,
and both the prior events and the missed notice survive.

---

**AC-19 — nothing is persisted in the browser.**

Events, the incomplete-replay notice, the connection state and the run handle are held in memory
only. `04-architecture.md:183` permits *"no client-side persistence beyond UI preferences"*, and a
run handle is not a preference. A refresh therefore loses the handle until Q-0121 lands, and that gap
is accepted rather than worked around.

***Test:*** a scan over every file under `apps/web/src` for `localStorage`, `sessionStorage`,
`indexedDB`, `document.cookie` and `caches`, with a positive control that it found source and a
fixture that uses one reported as a violation. The existing `history.pushState` use is named as not
persistence, so the clause is not read as forbidding it.

---

**AC-20 — the connection region says what is true of the route it is on, the run route fabricates
nothing, and a non-run route still opens no socket.**

`CONNECTION_PENDING` (`src/shell.tsx:38`) is **retired by replacement, not deleted**: the region
renders the AC-15 state, and on every route but the run route that state is **idle** and says so —
the top bar is global and the socket is the run route's. At `/runs/:handle` the connection panel
renders **beside** the existing placeholder, which is unchanged: `routes.ts:124–127` keeps
`screenExists: false` and its `waitingFor` still describes mission control, because this ticket adds
a connection and not a screen. What the panel may show is **the connection state, the
incomplete-replay notice, the count of accepted events, and the most recent event's `type` and
`stepId`** — measurements rather than fabrications, and the minimum that lets a test see that a
socket delivered something. Anything more is Q-0015's.

***Test:*** Q-0014's *"the shell must not open a socket"* guard re-run at `RAIL[0].path` with the
throwing `WebSocket` and `fetch` globals in place and still asserting `reached === []`; Q-0014's
per-route placeholder assertion re-run unchanged over `SCREEN_ROUTES`; a mounting of the run route
asserted to construct **exactly one** socket through the injected transport; and an assertion that no
file under `src/` carries the retired sentence, so the replacement cannot sit beside the thing it
replaced.

---

**AC-21 — the manifest and the lockfile declare the new dependency together, the two registers move
with their claim intact, and the cold-clone install does not grow.**

`@quorum/shared` is a `dependencies` entry of `apps/web` (`workspace:*`), because AC-14 executes its
schema **in the browser**, which is the division `test/package.test.ts:94–95` asserts.
`JUSTIFICATIONS` gains its line. **`pnpm-lock.yaml`'s `apps/web:` importer moves in the same
commit**, because `integrate` runs `pnpm install --frozen-lockfile` and a manifest ahead of the
lockfile fails it — which `harness.yaml:31–34` says in as many words that `expect: fail` reads as
proof of red (§0.10). **No new package enters the store**: `@quorum/shared` is a workspace link whose
only runtime dependency is `zod`, already in the lockfile, so Q-0014's cold-store figures — 203
packages, 179 MB, 10.4 s — do not move.

***Test:*** the dependency register asserted as the new exact set with `@quorum/shared` on the bundle
side; the justification register asserted against the manifest in both directions as it is today; the
lockfile asserted to carry `@quorum/shared` under the `apps/web` importer, in the shape
`packages/server/src/package.test.ts:129–136` already uses for its own; and a value from the new
dependency asserted to resolve under the workspace source condition. The store claim is **verified at
the gate rather than asserted by a test** (GO-5), because it is a measurement about an install and a
test asserting it would be reading a lockfile to predict a download.

---

**AC-22 — the browser build resolves the shared package from source, and this does not depend on
whether anything has been built.**

`apps/web/vite.config.ts` declares `resolve.conditions` including `quorum-source`, spread over Vite's
own **client** defaults rather than replacing them — the counterpart of what `vitest.shared.js:32–36`
does for `ssr.resolve`, and needed because that file deliberately sets only the server list and says
so at `:22–23` (§0.9). Without it `vite dev` and `vite build` resolve `@quorum/shared` to a gitignored
`dist/` that no task in this workspace builds as part of testing, so the app works on a machine that
has run a build and fails on a fresh clone. `apps/web` gains **no `build` script** and the emitting
set stays at three: this is a resolution condition, not a build task.

***Test:*** the configuration asserted **structurally** — the condition is present and the default
list is spread rather than replaced — rather than by attempting a resolution, whose answer would
depend on whether `packages/shared/dist` happens to exist in the checkout, which is the very
dependence this criterion removes. Beside it, one assertion that `@quorum/shared`'s `exports` still
resolves `quorum-source` to `./src/index.ts` and everything else to `./dist/index.js`, so the
criterion names the fact it is compensating for and goes red if that fact changes.

---

**AC-23 — the documents that describe this absence describe what shipped, and the vocabulary gains
its one term.**

`docs/04-architecture.md:191` says *"There is no connection to the daemon — the frame parser, the
connection states and the socket lifecycle are **Q-0120's**, and the top bar reserves the region they
fill"*, which this change makes false; its `packages/server` section gains the one sentence that the
frame union is declared in `shared` and re-exported here, and why. The status line gains its dated
entry. Where a `frontend` task lands work, `harness/architecture.md:46–49`'s *"`frontend` and `data`
remain inert"* is corrected in the same change — that file is fed to the architect on every run, so a
stale sentence there is one every future solution inherits.

`docs/GLOSSARY.md` gains **Connection state**: the closed set AC-15 names, derived per moment and
never stored, rendered in plain language, with the rule that no member of it is silence, and the
statement of what it is **not** — not a **run state**, which is `packages/server`'s
`refused | running | ended` and is a fact about the *run*. The two are near-homographs for unrelated
questions and neither is ever used for the other, which is the discipline **Containment** and
**Confinement** already carry, and the rule in `.claude/rules/docs-and-decisions.md` that a term is
added before it is used in a second file. **`CLAUDE.md`'s and `docs/README.md`'s *"use exactly these
terms"* lists are NOT edited** (§0.8): an implementer that edits either has failed this criterion
rather than satisfied it.

***Test:*** each claim asserted against the shipped document by the mechanism `docs.test.ts` already
uses, including that the retired sentences are **gone** rather than merely joined by new ones; the
glossary term asserted present with its closed set, its never-silence rule and its *not a run state*
clause, in the shape that file already uses for **Verified version** and **Push lag**; an assertion in
the same file that the two 22-term lists are byte-identical to what they hold today, so this change
cannot move them; and, if the role table moved, `packages/shared/src/role.test.ts` re-run, which holds
the third column against each role's `paths` frontmatter **and** requires the role's prose to name
every directory it is granted, so a partial edit is red.

---

## 5. Cross-cutting checklist

| | |
| --- | --- |
| **BYOS** | No key on any path, in any fixture, in any sentence. `apps/web/test/package.test.ts:101–125`'s credential scan walks the whole package and covers every file this ticket adds without moving; the proxy target is a host and a port and carries no credential. The browser holds no credential, because what authenticates an agent is a subscription the vendor's own CLI already owns. |
| **Worktree safety** | Nothing here writes outside a worktree and no criterion names `backlog/`. |
| **Gate behaviour** | Untouched. `gateAnswerEnvelopeSchema` is not widened, no gate control is added, and *"override with reason"* is a non-goal. |
| **File format and schema** | One new schema in `packages/shared`, over a union `packages/server` already declares. `eventSchema` is **consumed**, never changed. Nothing is written to `.quorum/`, `harness/` or `backlog/`. |
| **Dependency direction** | `04-architecture.md:61` forbids `shared` importing anything; this adds `server → shared` and `apps/web → shared`, both downward, and `packages/shared/src/index.ts`'s own header names `apps/web` as the reason the package is browser-safe. |
| **Lint and types** | `eslint.config.js` has covered `apps/**/*.ts` and `apps/**/*.tsx` since Q-0014. Strict TypeScript, no `any`, no deprecated API, no flow-lint rule added. |
| **Cold-clone impact** | AC-21: no new package enters the store, so the first thirty minutes do not grow. AC-22 is what keeps a fresh clone working at all. |
| **Product-agnostic** | Nothing names a SaaS product; Q-0014's AC-9 scan still refuses the mockup's three fake project names. |
| **Errors are explicit** | AC-14, AC-15 and AC-16 are three faces of one rule: a parse failure, a connection failure and a gap in the replay each produce a visible, distinguishable value, and none of them is silence. |

## 6. Contracts solutioning owes

**This section is a recommendation to the gate, not a ruling the requirement may make** — §0.16 is
why, and GO-2 is where it is settled. What it recommends:

`qa-red.yaml`'s `write-tests` step says *"Implement automated tests for every scenario against the
contracts under `contracts/`. Tests must compile/typecheck against the stubs and FAIL on assertions,
not on missing symbols."* For a TypeScript workspace those two sentences pull apart: a
`.contract.md` under `contracts/Q-0120/` is not importable, so a suite written against the real
module paths fails to **compile**, and `scenario-review` rejects exactly that. Measured (§0.16),
every contract this repository has produced is a document under `contracts/` and nothing imports one.
So the recommendation is: **the contracts for this ticket are stubs at their final paths, plus a
prose contract under `contracts/Q-0120/`** —

1. `packages/shared/src/wire.ts` — `WireMessage` moved, `wireMessageSchema` declared, the barrel line
   added. **Complete rather than stubbed**: it is declarations, and a declaration has nothing to
   implement.
2. `packages/server/src/wire.ts` — the import and re-export, so `packages/server` typechecks against
   the moved union. One import line and one name. **GO-1: this file has no owner.**
3. `apps/web/package.json` and `pnpm-lock.yaml` — the dependency, **at contract time rather than at
   development time**, because the red suite's imports do not resolve without it and
   `prove-red`'s install would fail before any assertion ran. **GO-1: the lockfile has no owner.**
4. `apps/web/src/` — the frame parser, the reducer, the missed-notice renderer and the
   socket-lifecycle hook, as stubs that **typecheck** and whose return types are the real ones, so
   AC-14's and AC-15's tests are *assertion* failures rather than unresolved imports. **The fake
   transport's interface is part of the contract**, because AC-17 and AC-18 are written against it.
5. `apps/web/src/` — the endpoint register (AC-13(d)) and the connection-state set (AC-15), as the
   **real tables**. A register stubbed empty makes every test that reads it vacuous.
6. `contracts/Q-0120/` — the prose contract naming the close-code precedence and the closed refusal
   set, so the reducer's completeness is reviewable against a document rather than against itself.

## 7. Task ownership, for `tasks.yaml`

`harness/architecture.md:65–71` requires that *"between them, a solution's tasks must own every file
the red suite requires changed — a file no task owns cannot be fixed by anyone, and the development
loop will spend its whole iteration budget discovering that."* Measured against the table at `:26–31`,
the role frontmatter `role.test.ts` holds against it, and `solutioning.yaml:16`'s
`role (frontend|backend|data)`:

| files | admissible fan-out role |
| --- | --- |
| `apps/web/**` — including its `package.json` and `vite.config.ts` | `frontend` (`apps/*`) — claude |
| `packages/shared/**` | `backend` (`packages/shared`) — codex |
| `docs/GLOSSARY.md`, `docs/04-architecture.md`, `harness/architecture.md` | `backend` (`docs`, `harness`) — codex |
| **`packages/server/src/wire.ts`** | **none** |
| **`pnpm-lock.yaml`** | **none** |

Three consequences the solution must honour. **The `apps/web` half and the `packages/shared` half are
two tasks on two vendors**, which is what makes this fan-out multi-vendor rather than merely parallel
— and this is the first ticket whose work is genuinely `frontend`'s, that role having been inert only
because `packages/ui` and `packages/i18n` do not exist while `apps/*` does. **`docs/` is not
`frontend`'s**, so AC-23 attaches to the backend task. **And the last two rows are GO-1**: they must
be answered at this gate, not discovered by a refusing implementer.

One further constraint the architect must not have to rediscover: **`architecture.md:73–75` gives
every `*.test.ts` to qa-red**, and `development.yaml`'s fan-out instruction repeats *"Do not modify
tests"*. A large share of this ticket's criteria are register edits inside **existing** test files —
`apps/web/test/package.test.ts`'s two registers, `apps/web/test/routes.test.ts`'s corpus,
`packages/shared/src/index.test.ts`'s barrel surface. Those are `write-tests`' to make, and a
scenario that expects a development task to make them is unsatisfiable by anyone.

## 8. Open questions

| | question | owner |
| --- | --- | --- |
| **OQ-1** | **BLOCKING.** Who writes `packages/server/src/wire.ts` and `pnpm-lock.yaml`, given that no admissible fan-out role may (§0.10, §0.11)? See **GO-1** for the three admissible answers, their costs, and which is recommended. | **this gate, before `solutioning`** |
| **OQ-2** | **BLOCKING.** What is a contract in this workspace? `harness/architecture.md`'s *"Contract conventions (what solutioning must emit)"* section is an unfilled template (§0.15), and it is read by the architect and the architecture reviewer on every run. See **GO-2**. | **this gate, before `solutioning`** |
| OQ-3 | Where the frame union lives. **Ruled here: `@quorum/shared`** — not on a recommendation but on §0.1's landed guard, which refuses the alternative outright. Recorded as ruled so no implementer reopens it and no round is spent on it. | ruled here |
| OQ-4 | Whether `WireRefusal` and `WireRun` move too. **Ruled here: no** (§0.17) — nothing in this ticket receives either, and a one-definition rule has no subject where there is no second definition. | ruled here |
| OQ-5 | Whether a zero `missed` count renders. **Ruled here by measurement** (§0.12): the parser accepts it, the renderer shows nothing, and the reason is recorded beside the test. | ruled here |
| OQ-6 | What the run route renders. **Ruled here** (AC-20): connection state, missed notice, event count, and the latest event's `type` and `stepId` — measurements, not fabrications — beside an unchanged placeholder. | ruled here |
| OQ-7 | Whether **Connection state** earns a glossary term, given that `RunState` has none. **Ruled here: yes** (AC-23), because it is user-facing, has an *unanswerable* member, and *state* is about to mean two things in one app — and because §0.8 measures the deterrent two tickets inherited to be pointed at the wrong file. | ruled here |
| OQ-8 | The dev-server proxy's default port **number**. The mechanism is ruled (AC-13(c)); the number is solutioning's, constrained to one literal in `vite.config.ts` with the comment beside it and no test reading the variable. Not blocking. | solutioning |

## 9. Risks

- **R-1 — nothing gives the browser a handle, so this is demonstrable only against one obtained out
  of band.** `routes.ts:121` says in as many words that *"the daemon reports no listing of its live
  runs"*. The acceptance path is: start a run with `POST /runs` by hand, read the handle, type
  `/runs/<handle>`. **Q-0121 removes that** and is `p2`; consider running it first or alongside. The
  criteria do not depend on it; the demo does.
- **R-2 — zod enters the browser bundle.** `packages/shared`'s `exports` is `"."` alone with no
  wildcard subpath (Q-0096), so importing the barrel reaches eleven modules and their schemas.
  `packages/shared/src/index.ts`'s own header anticipates and blesses this, so no ruling is owed. The
  **size** is unmeasured and cannot be measured here, this package having no bundle (Q-0122's).
  Stated so nobody reads AC-21's no-new-package result as a statement about bundle size.
- **R-3 — the *no daemon* discriminator rests on an unverified assumption about the proxy.** AC-15
  discriminates on *did the socket reach open*. Through Vite's WebSocket proxy a target that refuses
  should destroy the client socket before the handshake completes, so `open` never fires and the
  browser reports 1006 with no reason. **That is reasoned, not measured** — the unit tests drive a
  fake transport and prove the reducer, not the browser. GO-4 measures it once.
- **R-4 — five runs and five gates, on a route with four tickets of evidence, all from August.**
  Q-0006, Q-0011, Q-0033 and Q-0050, three of them M1's and the fourth the most expensive in the
  project at $131.03 — and all four against a tree Q-0103 deleted. Against Q-0014's $74.83 on the
  chore route, budget for materially more, and expect the cost to be in the *route* rather than in
  the code, which is what the gate ruled this ticket to find out. §0.15 is the first instalment of
  that discovery and it arrived before any money was spent.
- **R-5 — `development.yaml` fans out `by: role`, and the two halves cannot see each other until
  `integrate`.** The shared module is a contract emitted by solutioning precisely so they do not have
  to. If the solution instead has the `frontend` task *create* `packages/shared/src/wire.ts`, the two
  tasks share a file, which `architecture.md:69` names as a sign the cut is wrong — and the frontend
  role may not write that path anyway.
- **R-6 — a test rendering components must be `.test.ts`, not `.test.tsx`.**
  `apps/web/test/package.test.ts:138–147` asserts every test file in the package ends `.test.ts`,
  because `testFilesIn` and `packages/core/turbo.json:74`'s `../../apps/*/**/*.test.ts` match that
  suffix only while Vitest would run a `.test.tsx` regardless — running, unseen and uncached.
  `src/shell.test.ts` uses `createElement` under a `// @vitest-environment jsdom` docblock; new tests
  follow it. **AC-14's, AC-15's and AC-16's subjects are pure functions and need no DOM**, which is
  why they are specified that way.
- **R-7 — `apps/web/src` is held to a browser-only rule no other package meets, and it still holds
  test files.** Q-0014 moved the **four** suites that read the filesystem into `apps/web/test/`;
  `src/index.test.ts` and `src/shell.test.ts` remain, and `test/package.test.ts:143` pins the second
  by identity. A new test that reads the filesystem belongs in `test/`; a pure-function test belongs
  beside its subject in `src/`. A scan written into `src/` would become its own subject.

## 10. Gate obligations

- **GO-1 — settle who owns `packages/server/src/wire.ts` and `pnpm-lock.yaml`, before `solutioning`
  runs.** A `tasks.yaml` that hands either to `backend` anyway produces the refusal this repository
  has recorded four times — *"A requirement may not name a surface its flow cannot write"*
  (2026-08-25) — except that this time it is found before the money rather than after. Three
  admissible answers:
  **(i) The architect emits both as contracts.** Mechanically available: `principal-architect.md`
  declares no `paths:` and no allowed-path prose, `codex.ts:106` gives a `worktree: true` step
  `--sandbox workspace-write`, and `merge-contracts` lands the branch on `harness/{id}/integration`
  before `qa-red` branches from it. *Cost:* it is **not** free, because `solutioning.yaml:16` asks for
  contracts *"under contracts/"* and nineteen of nineteen existing contract files are there (§0.16) —
  so this answer is only clean once GO-2 says a contract may be a stub at its final path. And if a
  later round needs that file changed, no task can change it.
  **(ii) Recommended — grant `packages/server/` to `backend`.** Three edits —
  `harness/roles/developer-backend.md`'s frontmatter and its allowed-path sentence, and
  `harness/architecture.md`'s table row — which `role.test.ts` holds against each other, and none of
  which touches the template mirror (`packages/cli/templates/harness/roles/developer-backend.md`
  carries the generic `services/api, packages/domain` and is not byte-shared). **This is the human's
  to write at the gate**: a role editing its own grant inside the run that fans out by role is
  circular. It is recommended rather than merely admissible because it is a repository-level fact
  worth having on its own merits — `packages/server` has existed since M3 opened and no fan-out role
  has ever been able to write it — and because §0.17 defers `WireRefusal` and `WireRun` to Q-0015 or
  Q-0121, which under (i) would pay this question again and under (ii) would pay nothing.
  **(iii) The human makes both edits at this gate**, as Q-0055's OQ-2 criteria and Q-0059's GO-3
  rulings were made, and the tasks own neither file.
  **The lockfile half may take a different answer**, being generated rather than authored: the
  cheapest form is that the human runs `pnpm install` and commits it once the manifest line exists —
  which means at the **solutioning** gate rather than this one, since the manifest is a contract.
  **Do not launch `solutioning` with this open**; no step on that route can settle it.
- **GO-2 — fill `harness/architecture.md`'s *"Contract conventions"* section before `solutioning`
  runs, and with it the *"Testing and tooling"* and *"Shape of the repository"* sections it leans on
  (§0.15).** Five of that file's six sections are unfilled template prose, and the missing one is the
  table the architect is told to emit against and the architecture reviewer is told to judge against
  — *"Tests in the red phase compile against these stubs"*, with no stubs named. It has not bitten
  because the four tickets that ever ran this route ran in August against the deleted `spike/` tree;
  **this is the first solutioning run against the current workspace.** The minimum that unblocks this
  ticket is one table saying what a contract is for a TypeScript workspace — recommended: a typed
  stub at its final path plus a prose `.contract.md` under `contracts/<ID>/`, which is what §6
  assumes and what makes GO-1 answer (i) coherent. **It is the human's**, not a criterion of this
  ticket: `backend` could write the file, but the step that would fix it is the step that reads it,
  and the fix must exist before the architect starts. Doing it here is cheap; discovering it at
  `scenario-review` costs a solutioning run, a qa-red run and two bounded loops.
- **GO-3 — confirm OQ-8 at this gate**, so no implement round chooses a port nobody selected.
- **GO-4 — measure R-3 once against a real dev server**, with the daemon down and with it up, and
  record what the browser reported in both cases. The reducer's tests prove the mapping; only this
  proves the input. If `open` *does* fire before the proxy fails, AC-15's discriminator moves and the
  criterion is amended by erratum **at a gate** rather than reinterpreted mid-round.
- **GO-5 — verify AC-21's store claim by measurement rather than by reading the lockfile**, on
  Q-0014's GO-4 precedent: a manifests-only copy of the merge installed into an empty store, against
  the same for `main`. The expected delta is zero packages and zero bytes, and *expected* is the word
  that makes it worth measuring.
- **GO-6 — verify AC-22 on a tree with no `packages/shared/dist`**, since this machine has one and
  the criterion exists precisely because its absence is what breaks. `rm -rf packages/shared/dist`,
  then a `vite build` or a dev-server start for `@quorum/web`, and record the result. A structural
  assertion is what ships; this is what proves the structure was the right one.
- **GO-7 — verify the merge forced in both environment rows**, per Q-0072's closing finding: in the
  integration worktree, which has neither `.harness/worktrees` nor `.quorum/runs`, and again on `main`
  after the merge, with `pnpm lint`, `pnpm typecheck`, `quorum lint` and the git-identity sweep. It is
  a gate obligation rather than a criterion, because a suite passing is a property of every ticket
  rather than behaviour a red test can fail on.

## 11. Observations

True, worth recording, and **not claims about this change** — the `observation:` channel *"A finding
is a claim about the change; anything else is an observation"* (2026-09-11) opened. Reported and
deliberately not fixed here.

- **`observation:` `harness/flows/review.yaml`'s `verdict` instruction is spliced mid-sentence, and it
  is the flow this ticket's own review stage runs.** Q-0117's paragraph was inserted between *"on
  changes-requested there must be at least one"* and *"finding. Judge the reviews, not the code
  diff."*, so the clause that makes `changes-requested` require a finding no longer parses as a
  sentence. `harness/flows/chore.yaml` is **correct** — there the paragraph was appended after a
  complete sentence — which is why it went unnoticed: every ticket since Q-0117 has taken the chore
  route. It wants a one-line fix by hand in the shipped file, its byte-shared template mirror, and
  `docs/02-sdlc-pipeline-spec.md` §5, whose snippets are held byte-identical to the shipped files.
  Not this ticket's surface — no criterion names `harness/flows/` — but it should be fixed **before
  this ticket reaches `review`**.
- **`observation:` `solutioning.yaml` and `harness/architecture.md` disagree about which roles may
  receive a task, and both are fed to the architect on every run.** The flow says
  *"role (frontend|backend|data)"*; `architecture.md:40` says *"`backend` and `tooling` are the two
  live **fan-out** roles"*. `tooling` — `packages/core`, `packages/shared`, `packages/cli`, on claude
  — cannot be given a task by an architect obeying the flow it is run under, so every solution's
  choice of seam is narrowed silently and a two-vendor fan-out over `packages/**` has one fewer way
  to be built. It did not bite this ticket only because `backend` also covers `packages/shared`.
- **`observation:` `AppOptions.upgrade` (`packages/server/src/http.ts:26–35`) is passed by nothing.**
  `serve.ts` imports `createApp` and never mentions `upgrade`; the events route is registered on the
  returned app instead, and no test supplies the option. So `createApp` alone has no events route and
  `http.ts:187`'s branch has exactly one caller. Not a defect and not this ticket's — recorded because
  a later ticket wanting to drive the socket without binding a port will look for that seam and find
  it unused rather than unbuilt.
- **`observation:` implement steps have written `pnpm-lock.yaml` on six tickets while no role grants
  it.** Q-0043, Q-0045, Q-0090, Q-0098, Q-0013 and Q-0014 twice. `paths` is advisory
  (`role.test.ts:50–54`) and enforcement is role prose, so the chore route has been getting away with
  a write its own role text forbids. §0.10 is the first time it reaches a route where the fan-out
  instruction repeats the prohibition; whether the grant should be widened or the practice stopped is
  a repository question larger than this ticket.

## 12. Provenance

**Iteration 1's merged document is the base**, and it stands except where a re-measurement moved it.
Its §0.1 to §0.14 were each re-run against the tree at this gate and all fourteen reproduce; the
figures in §0.1, §0.4, §0.5, §0.10, §0.12, §0.13 and §0.14 are quoted from the files rather than from
that document.

**From the claude candidate**, through iteration 1: the measured §0 rather than a transcription of
Q-0014's Appendix A — the landed guard that rules the wire-shape question, the two `apps/web`
registers, the whole-package URL scan and Vite's object proxy target, the absent daemon port, the
same-origin narrowing of *no daemon*, the two-suite turbo audit, and the `CLAUDE.md`/glossary split.
Its §6, §7, AC-20, AC-21 and the shared-house-rules clauses are carried. Its *"33 glossary terms"*
did not reproduce at either iteration — the grep answers 38 — and no count is stated anywhere.

**From the codex candidate**, through iteration 1: AC-15's explicit **close-code precedence order**,
which is what makes the reducer reviewable for completeness rather than merely enumerable; AC-14's
harder parser table, adding a `missed` count that is a string, fractional or non-finite; AC-13's
handle-encoding cases; AC-17's *"repeated cleanup is safe"* and AC-18's *"repeated Retry cannot leave
concurrent sockets"*. Its install/lint/typecheck criterion stays a gate obligation (GO-7) rather than
a criterion, being a property of every ticket rather than behaviour a red test can fail on.

**Iteration 2 contributed four things, and two of them change the verdict's shape.** §0.15 — that
`harness/architecture.md`, the architect's own context document, has five of its six sections
unfilled, including the contract conventions this ticket's red phase turns on — is a **second
blocker** and, because it subsumes half of the first, it is what turns the gate's job from three
rulings into one. §0.16 — that the architect's instruction confines contracts to `contracts/`, and
that all nineteen existing contract files are there — **sharpens** the carried blocker by removing
the reading under which its recommended answer was free, and demotes iteration 1's §6 ruling from a
ruling to a recommendation the gate owes. §0.17 — that `WireRefusal` and `WireRun` have **no
consumer** here, this client issuing no HTTP request — struck a criterion's worth of refusal renderer
that had tests and no caller, and narrowed the move to `WireMessage` alone. §0.18 — that AC-12's
object-literal clause would refuse the ticket's own fixtures, with `test/package.test.ts:143` pinning
a test file inside the scanned corpus by identity — repaired an unsatisfiable criterion rather than
leaving it for a round to discover.

**Size.** Twelve criteria, from iteration 1's thirteen: AC-16's refusal half is struck (§0.17) and the
shared house rules are folded into AC-12 as clause (c), both modules being the same subject. Twelve
sits under the fifteen that split Q-0013 at eighteen and Q-0096 at twenty-one, and the judgement is
unchanged from iteration 1: **this ticket does not want splitting.** The parser, the reducer, the
missed notice and the socket lifecycle are one behaviour observed from four angles, and a cut between
them would put the fake transport in one ticket and every test that drives it in another. What this
ticket wants is not a smaller scope but **two answers it cannot give itself.**
