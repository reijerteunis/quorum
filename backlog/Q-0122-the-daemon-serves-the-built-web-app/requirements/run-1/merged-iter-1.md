# Q-0122 — The daemon serves the built web app

*Merged requirement, run 1, iteration 1. Written against the tree at 2026-09-12, after Q-0120 and
Q-0121 landed. Every measurement either candidate rests a criterion on was re-run at this gate
rather than relayed — including the ticket body's own re-measurement of the same morning, which is
correct in seven places and short in two. §0 records what held, the four findings that change the
shape of the work, and three corrections to the candidates themselves.*

**Verdict: `needs-input`, on two blockers.** The first is size and it is mine rather than either
candidate's: the merged work is **twenty** independently testable criteria against a ceiling of
fifteen, the **eighteen** Q-0013 was refused at, and the twenty-one that split Q-0091 and Q-0096 —
all three at their gates and all three at cost. The seam is measured in §6 OQ-1 and the two tickets
are written out in full. The second is the vocabulary ruling: it is a decision entry
`developer-generalist` may not write, and **AC-7 is unsatisfiable until it lands**.

**This document specifies the emit half — eleven criteria, §4.** The serve half is **Appendix A**,
written out in full so that answering OQ-1 costs a ticket allocation and not a second requirements
run.

---

## 0. Measured before anything was written

### 0.1 What both candidates and the ticket body got right, re-verified

`apps/web/package.json` declares `lint`, `typecheck` and `test` and **no `build`**;
`packages/server` opens no file — no `serveStatic`, `sendFile` or `createReadStream` in its
production source; `pnpm-workspace.yaml` is `packages/*` **and `apps/*`**, so `apps/web` is already
a member of every workspace-derived register; root `turbo.json`'s `build` is
`{dependsOn: ["^build"], outputs: ["dist/**"]}` and `test` carries `env: ["QUORUM_REAL_CLI"]` and
`outputs: []`; `@hono/node-server` is already a dependency at `^1.19.11` and already exports
`./serve-static`, so **no new dependency arrives and no dependency question needs a gate**;
`harness/product-context.md:78` calls the packed set *"the three emitting packages' tarballs"*; and
`docs/GLOSSARY.md`'s **Build task** (*"run in the three packages that emit"*) and **Emitted
artifact** (*"The JavaScript and declaration files"*, *"which is also the local distribution set"*,
*"is not a 'bundle'"*) carry the clauses one of which must move.

Both `test-discovery.test.ts` clauses fail as claimed: the Q-0097 AC-13 register is
`expect(emittingPackages()).toStrictEqual(['packages/cli','packages/core','packages/shared'])`, and
the clause below it walks `PACKAGES.filter(pkg => !emittingPackages().includes(pkg))` asserting
`scripts.build` is `undefined` with the message *"`${pkg}` declares a build script and emits
nothing"*.

### 0.2 Finding 1 — the "nothing else moves" list is short by three guards, in two files the ticket body does not name

**`apps/web/test/package.test.ts` asserts the app is non-emitting twice, in two different
describes.** `:136` is `expect(manifest().scripts?.build).toBeUndefined()` under the Q-0120 AC-22
block; `:210` is `expect(scripts.build, 'this package declares a build script and emits nothing')
.toBeUndefined()` under the AC-3 block, and `:204`'s comment routes the question here by name —
*"this package emits nothing, which is what keeps the emitting register at…"*. Both fail. Neither
appears in the ticket body, in its re-measurement, or in candidate `codex`.

**`packages/core/src/turbo-inputs.test.ts` needs a fourth register row or a declaration.** Adding
`'apps/web'` to the emitting register introduces that literal into a file belonging to
`@quorum/core#test`. `pathLiterals` collects a quoted literal containing `/` that the
tracked-and-unignored inventory holds, and the three sibling rows already exist at `:319–321`
carrying the answer verbatim — `'packages/core'`, `'packages/cli'` and `'packages/shared'` are each
excused as *"a member of the emitting-set register — both data, neither a read"*. There is no
`'apps/web'` literal anywhere in `packages/core/src/*.test.ts` today.

**Total: four assertions in three files are red, not the two the body names**, and a fifth guard
must answer for a new literal.

### 0.3 Finding 2 — `isolate()` is derived from `emitting()`, so two of the slowest suites in the workspace start running a Vite build

Candidate `claude` found this and under-counted it. Measured: `packages/cli/test/workspace.ts:107`
is `export const emitting = () => dry('build').tasks.filter(task => task.command !== NO_SCRIPT)` —
**derived, not hand-written** — and `:196` is `const tasks = emitting();` inside `isolate()`, which
copies every emitting package's tracked files into a temporary workspace and builds it.
`build.test.ts` reaches `emitting()` at **thirteen** sites, not four: `:144`, `:360`, `:558`, `:584`,
`:603`, `:624`, `:635`, `:666`, `:838`, `:858`, `:905`, `:910`, `:1094`.

Two other suites take `isolate()` and build in it, and **neither wants a web bundle — each spawns
the binary**. Both carry budgets measured against three `tsc` builds and both say so in prose:
`end-to-end.test.ts`'s `FIXTURE_TIMEOUT_MS` docblock — *"0.1 s to copy the workspace, 2.1 s for the
forced build of the three emitting packages, and 2.2 s for the twelve invocations — 4.4 s in
total"* — and `failure-paths.test.ts`'s — *"the workspace copy, a forced build of the three emitting
packages, and **nineteen** spawned invocations … 5.0 s to 5.8 s"*.

This is the largest piece of unnamed work in the ticket and it is a decision rather than a repair:
`build.test.ts` audits the build and genuinely wants every emitter, while the two spawning suites
want the **local distribution set**. AC-6 and OQ-3.

### 0.4 Finding 3 — the static route's problem is exact collision, not prefix-shadowing

Candidate `codex` calls it *"overlap"*; the ticket body calls it *"a mount that matches too
broadly"*. Both under-describe it, and the difference decides whether ordering can fix it. Hono
matches a registered **path pattern**, not a prefix — the prefix problem was Vite's proxy middleware
and is not the daemon's. Read off both registers, of the shell's twelve paths in
`apps/web/src/routes.ts`, **exactly four are claimed by a daemon `GET`**:

| shell route | daemon route |
| --- | --- |
| `/flows` | `read.ts:97` `GET /flows` |
| `/runs` | `http.ts:175` `GET /runs` |
| `/runs/:handle` | `http.ts:187` `GET /runs/:id` |
| `/history` | `read.ts:120` `GET /history` |

The other eight are unclaimed, and `/runs/:handle/gate` is not among the four because the daemon's
`/runs/:id/gate` is a **`POST`**. A handler that returns a response ends the chain, so **a fallback
registered after the JSON routes is never reached for those four** — Q-0120 review round 1's B-1
reproduced in the shipped product. Therefore the matching rule must discriminate on something that
is not the path and must sit ahead of the JSON routes. **That mechanism is already shipped**:
`apps/web/vite.config.ts`'s `bypassNavigation` is
`req.method === 'GET' && req.headers.accept?.includes('text/html') ? '/index.html' : undefined`, and
its header states the reason — a top-level navigation requests `text/html` where a same-origin
`fetch` and the WebSocket upgrade do not. **It has no test.** Appendix A.

### 0.5 Finding 4 — `serveStatic`'s root is cwd-relative and refuses an absolute path

Read from `packages/server/node_modules/@hono/node-server/dist/serve-static.d.ts` at 1.19.17:
`root` is *"Root path, relative to current working directory from which the app was started.
Absolute paths are not supported."* The daemon's cwd is wherever the operator invoked it; the
bundle's location is package-relative — the shape Q-0093 and decision 078(e) already settled for
`quorum init`'s templates. A root computed from the cwd makes the daemon's behaviour a property of
the directory it was started in, which *"A test's verdict is a property of the commit, not of the
checkout or the account"* (2026-08-30) refuses one layer down. Candidate `codex` names this as a
risk without measuring it; the measurement is what makes Appendix A's answer forced rather than
preferred, and `04-architecture.md` forbids `packages/server` importing `apps/web` in either
direction, so the server cannot resolve the app's location at all.

### 0.6 Correction to the ticket body's §1.6, and to candidate `codex`'s OQ-1

The body says *"Coining a new term moves `CLAUDE.md`'s list"*, and `codex` says *"the human must
also add it to the repository-wide term list"*. Measured: `docs/GLOSSARY.md` defines **34** terms;
`CLAUDE.md:13` and `docs/README.md` each carry **22**, byte-identical to one another. The two lists
are a curated subset, and **three terms added since 2026-09-08 are in neither** — **Confinement**
(Q-0059), **Run lock** (Q-0039) and **Connection state** (Q-0120, yesterday).

So the obligation is **conditional and cheap**, not unconditional: a glossary term may land without
either list moving, as three have. *If* it is added to them, both move in the same change on the
integration branch, because `docs.test.ts` compares them **ordered** and a partial move leaves
`main` red — the sequencing Q-0067's GO-2 had to perform for **verified version**. What is owed
**unconditionally** is the decision entry (GO-1). This removes the cost argument from OQ-2 in both
directions, which is why that question is settled on vocabulary cohesion and on nothing else.

### 0.7 Two constraints on the documentation edits that no reader would predict

**`` `dist/**` `` may appear exactly once in `docs/04-architecture.md`.** `docs.test.ts:287–288`
reads the root `turbo.json`'s `outputs` and asserts `occurrences === 1` per pattern, failing with
*"04-architecture.md describes the outputs pattern … N times, not once"*. It is at `:272`. A new
paragraph about the fourth emitter that quotes the pattern again turns the suite red for a reason
unrelated to the change.

**`docs/README.md` must keep the contiguous substring `build task, emitted artifact`**
(`docs.test.ts:552`), so a term inserted between those two entries breaks it. A third measured
argument for coining nothing.

### 0.8 Three line references, corrected

The *"What remains owed is serving `apps/web`'s build output: that app has no build task and emits
nothing today"* sentence is at `docs/04-architecture.md:190–191`, not `:149–151`; `:193` already
routes all three halves here by name, and `:233` carries Q-0120's richer *"The app emits nothing"*
statement. `` `dist/**` `` is at `:272`, not `:273`. `docs/04-architecture.md:11`'s *"`pnpm pack` in
each of the three emitting packages"* is a **fourth** site and names the packed set by the emitting
set's name — the same conflation as `harness/product-context.md:78`. `:136` is `packages/server`
emitting nothing and does **not** move.

---

## 1. Problem

`docs/04-architecture.md` has said since 2026-08-22 that the server serves `apps/web`'s build
output, and M3's done-when includes `quorum open` starting the daemon and a browser. Neither half
exists: `apps/web` declares no `build` script, so there is nothing to serve, and `packages/server`
opens no file, so there would be nothing to serve it with. Three live sites record the gap and route
it here by ticket id — `:190–191`, `:233`, and `apps/web/vite.config.ts`'s own header.

Underneath the two missing pieces is a vocabulary question Q-0014's gate deliberately deferred to
this ticket rather than answering inside a shell. **Emitted artifact** says emitted artifacts are
*"The JavaScript and declaration files a build task writes under a package's `dist/`"*, that the
three emitting packages *"[are] also the local distribution set"*, and that an emitted artifact *"is
not a 'bundle' — nothing here is bundled, each source file emits its own counterpart"*. A Vite build
falsifies all three clauses at once: it is bundled, it is not declarations, and it is served rather
than packed. **The two facts that sentence conflates — what emits and what ships — stop being the
same set the moment a fourth package emits**, and until they are separated no criterion, comment or
document can say truthfully which is which. Two live comments already conflate them
(`harness/product-context.md:78`, `packages/server/src/package.test.ts:139–140`).

Surfaces touched: **`apps/web`** and the workspace's build configuration, the **registers** in
`packages/cli` and `packages/core` that derive from the emitting set, and **`docs/`** and
**`harness/`**. Nothing in `backlog/` moves, no CLI command changes, no flow, gate, adapter,
contract or file format moves, and under the recommended split the daemon is untouched.

---

## 2. User stories

**`maintainer`.** *I want one workspace command to produce something the daemon can serve, and I
want the four registers that decide what this workspace emits to agree about it afterwards rather
than three of them going red and a fourth quietly building a bundle inside two suites that spawn the
binary.*

**`contributor`.** *I want to know from one sentence which packages emit and which ones ship,
because they are no longer the same list. When I add a fifth emitting package I want the registers
to fail closed and name it — which is what decision 078(c) promised in as many words — rather than
leaving me to work out which four assertions disagree.*

**`adopter`.** *This ticket does not serve me, and saying so is the point.* A cold-clone adopter
installs three tarballs into a project outside the repository. `apps/web` is `private: true`,
declares no `files` and no `exports`, and this ticket deliberately does not add it to the local
distribution set — so **after this ticket, and after Appendix A, a packed install still has no web
app at all**, and the workspace-local path is the only one with a UI. That obligation has no ticket,
and neither does `quorum open`, which M3's done-when names and which nothing in this milestone
builds. Both are Appendix B.

---

## 3. The ruling this ticket owes, and what the human's entry should say

**A decision entry is owed before a line of code**, not because a document disagrees with the tree —
that is an ordinary edit — but because *"The emit serves the binary, and no test verdict moves
behind it"* (2026-09-02) is contradicted in two places by a fourth emitter, and the rules forbid
contradicting a landed entry silently:

- **078(a)** says each emitting package emits *"JavaScript and declarations"* with *"No bundler and
  no new dependency: `tsc` is already the typecheck gate."* A Vite build is a bundler. No **new**
  dependency arrives — the root manifest declares `vite@^8.2.2` and the app is already a Vite app —
  so the second half holds and the first does not.
- **078's Why** is its whole containment argument: the emit *"is consumed by exactly one thing, the
  binary, and by exactly one suite … so the new failure class has one narrow place to live"*. A
  served bundle is a second consumer, and a second place for the replayed-artifact hazard to live.

078 **anticipated** this: (c) says the derived register *"fails closed when a fifth package starts
emitting"*, which is exactly the mechanism §0.2 measures firing. So the entry **extends** 078 rather
than reversing it, and must name it by title and date.

**What the entry should rule**, offered so the human can write it quickly rather than re-derive it:

1. **A fourth package emits, and what it emits is served rather than shipped.** The emitting set
   becomes four; the local distribution set stays three. `apps/web` keeps `private: true` and
   declares no `exports`, `files` or `bin`.
2. **The served bundle is an emitted artifact**, and the term widens rather than a third kind being
   coined. What makes the term load-bearing is 078's own hazard — a non-empty `outputs` replays an
   *artifact* — and the bundle has that hazard in its sharpest form, so a third kind would put the
   thing most at risk **outside** the vocabulary that carries the warning. The alternative is
   recorded in OQ-2 rather than dismissed.
3. **A bundler is admissible for the fourth emitter**, and 078(a)'s *"no bundler"* is scoped to the
   three `tsc` emitters it was written about. A browser bundle cannot be `tsc` output at all.
4. **078(b) holds unchanged.** `test` and `typecheck` gain no `^build` edge and no existing verdict
   moves. This is the clause a fourth emitter is likeliest to erode, so it is asserted rather than
   assumed (AC-2).
5. **The new hazard is a stale page**, the same class as Q-0098's shebang — the tick lies about the
   past, the artifact lies about the present. The three `tsc` emitters each `rm -rf dist` before
   compiling because turbo prunes an output directory on neither path; the fourth must have the same
   property and it must be proven rather than inherited (AC-3(b)).
6. **No glossary term is coined**, so neither 22-term list moves — which §0.6 makes a choice rather
   than a constraint and §0.7 gives two independent mechanical reasons for.

A working title: *"A fourth package emits, and what it emits is served rather than shipped."*

**Who may write which half, read off the role file rather than inferred.** `docs/GLOSSARY.md`,
`docs/04-architecture.md` and `harness/product-context.md` are inside `developer-generalist`'s
`paths:` and may be criteria. `docs/decisions/` is not — that role's own instructions name it as the
first example of `blocked` — and `CLAUDE.md` is not in those paths at all. So the entry is **GO-1**
and may not be a criterion, per *"A requirement may not name a surface its flow cannot write"*
(2026-08-25), which this repository has paid for five times.

---

## 4. Acceptance criteria

*Eleven, under the recommended split. If the gate refuses OQ-1 and keeps the ticket whole,
Appendix A's nine are promoted and the total is twenty — two past what refused Q-0013.*

**AC-1 — `apps/web` declares a `build` script, and the root task is untouched.**
The manifest gains `build`. Root `turbo.json`'s `tasks.build` is unchanged —
`outputs: ["dist/**"]`, `dependsOn: ["^build"]` — and `apps/web` declares either no package-level
`turbo.json` or one declaring `inputs` and nothing else, so root `turbo.json` stays the one place
`env` and `outputs` are decided.
*Test:* `dry('build').tasks` filtered on `command !== NO_SCRIPT` returns **four** tasks including
`@quorum/web#build`; for each, `resolvedTaskDefinition.outputs` equals the root's declared patterns
and `dependsOn` equals `['^build']` — which is `build.test.ts:360`'s existing clause now covering a
fourth task rather than three; `build.test.ts`'s *"every package-level configuration declares
`inputs` and no other key"* clause still passes; and a forced build writes at least one file under
`apps/web/dist/`, so the task is not satisfied by a script that emits nothing.

**AC-2 — no verdict that exists today moves behind the fourth emitter.**
`test`, `typecheck` and `lint` keep `outputs: []` and gain no `^build` edge, resolved **through
turbo** rather than read off the file, and the clause is shown non-vacuous for the new package.
*Test:* for every task in `dry('test').tasks`, `resolvedTaskDefinition.dependsOn` does not contain
`^build` and `outputs` is `[]`; the task list is asserted to **contain** `@quorum/web#test`, so the
clause is shown to reach the package this ticket changes; and both halves are demonstrated red by
adding `^build` to the root `test` task in an isolated copy.

**AC-3 — the build writes its emit, nothing else, and does not leave what its source no longer produces.**
*Test:* two clauses. **(a)** `build.test.ts`'s whole-copy isolated census passes with four emitters:
every path `@quorum/web#build` wrote is under `apps/web/dist/`, `dist/**` matches at least one of
them, and the audit reports no path written outside any emitting package's `dist/` and no tracked or
unignored path removed. **(b)** A file placed in the copy's `apps/web/dist/` that the build does not
produce is **gone** after a forced rebuild — the property `rm -rf dist &&` gives the other three,
demonstrated rather than inherited from whatever mechanism supplies it, because
`build-fixture.test.ts`'s own header records that turbo prunes an output directory on neither the
miss path nor the hit path.

**AC-4 — the four assertions this change falsifies are moved, each shown red before green.**
Named individually, because a list is satisfied by fixing three of four:
`test-discovery.test.ts`'s Q-0097 AC-13 emitting register; the stub clause below it
(*"`${pkg}` declares a build script and emits nothing"*); `apps/web/test/package.test.ts`'s Q-0120
AC-22 *"the app remains non-emitting"* (`:136`); and the same file's AC-3 clause (`:210`).
*Test:* each of the four is shown failing against the pre-change guard with a message naming the
package, and passing after. The emitting register stays an **identity** — `toStrictEqual` over four
sorted entries led by `'apps/web'` — and does not become a count: *"a count is not an identity"*
(Q-0073), and that register exists so a fifth emitter is a visible act.

**AC-5 — `turbo-inputs.test.ts` answers the new `'apps/web'` literal, and the answer is load-bearing.**
Either a fourth `NOT_READ` row beside the three package rows at `:319–321`, carrying the same
reasoning those three carry, or a declaration in `packages/core/turbo.json` — **not both**, which is
the over-declaration Q-0121 measured and deleted.
*Test:* clauses A and B both pass; the register's own *"a key the scan cannot see excuses nothing"*
clause still passes over the new row; and the answer is shown load-bearing by removing it and
watching clause B fail **naming `apps/web`**. Where the measurement shows the literal is not
collected at all, the implement report states that with the evidence and no row is added — a
register row excusing nothing is what that clause forbids.

**AC-6 — what `isolate()` builds is decided, and the two suites that spawn the binary are re-measured.**
*Test:* `end-to-end.test.ts` and `failure-paths.test.ts` both pass; the implement report states
which of the two shapes was taken — `isolate()` goes on building every emitting package, or it takes
the local distribution set and `build.test.ts` asks for every emitter explicitly — and gives the
**measured** wall-clock of the isolated build under each suite, so the two docblocks that say *"the
forced build of the three emitting packages"* are re-derived rather than left describing a build
that no longer happens. Where a timeout constant moves, the new value is stated as a multiple of the
measured worst case, in the shape `FIXTURE_TIMEOUT_MS`'s own comment already uses.

**AC-7 — the glossary states what emits and what ships as two facts, and coins nothing.**
*Test:* **Emitted artifact** no longer equates the emitting set with the local distribution set;
both sets are named with their members and the difference is stated; the *"not a 'bundle'"* clause
is **re-scoped rather than deleted**, so it still forbids calling `packages/core`'s `dist/index.js`
a bundle while no longer denying that `apps/web`'s emit is one; **Build task**'s *"run in the three
packages that emit"* moves; the entry GO-1 landed is cited **by title and date and never by file
name or number**; the two clauses `docs.test.ts` pins survive verbatim — `the two words are not
interchangeable` and `Not a "pipeline", a "job" or a "step"`; the two 22-term lists are
byte-identical afterwards; and `docs/README.md` still carries the contiguous substring
`build task, emitted artifact`.

**AC-8 — the architecture document says what shipped, and says `dist/**` once.**
*Test:* the four prose sites move — `:11` (*"`pnpm pack` in each of the three emitting packages"*,
the packed set called by the emitting set's name), `:190–191`, `:193`, `:233`'s *"The app emits
nothing"* sentence; `` `dist/**` `` occurs **exactly once** in the file, which `docs.test.ts:287–288`
already enforces and a new paragraph can break; the status line records `Q-0122` and the landing
date; and a new `docs.test.ts` clause holds the `apps/web` section against the claim that the app
emits, shown red over the section's current wording. The landed Q-0014 and Q-0120 anchors over that
section still pass. Under the recommended split this document must **not** claim the output is
served — that is Appendix A's, and a document promising a route that does not exist is the failure
this page records most.

**AC-9 — `harness/product-context.md`'s pillar 7 stops calling the packed set the emitting set.**
*Test:* `:78` names the three **distribution** packages rather than *"the three emitting
packages"*; the two claimed installation paths and the refusal of registry-resolved `npx quorum` are
unchanged — no claim gained or lost, only the set named correctly — and a scan shows the file
carries no sentence asserting a cold machine can obtain Quorum from the public registry. It matters
more than an ordinary comment because this file is fed to every product-manager step at run time.

**AC-10 — the manifest declares what the build needs, each with a reason.**
Measured: `apps/web` declares `@vitejs/plugin-react`, `@tailwindcss/vite`, `tailwindcss`, `jsdom`
and the two type packages, and **no `vite`**; the root manifest declares `vite@^8.2.2`, so
`vite.config.ts`'s own `import … from 'vite'` resolves today by walking up to the workspace root.
*Test:* whatever the build resolves is declared where the build runs, and
`apps/web/test/package.test.ts`'s `JUSTIFICATIONS` register agrees with the manifest in **both**
directions — which that file already asserts, so a dependency added without a reason fails and a
reason left behind by one that has gone fails too. `dependencies` is still exactly
`['@quorum/shared', 'react', 'react-dom']`, so nothing new ships to a browser. The lockfile moved
with the manifest, which is what keeps `pnpm install --frozen-lockfile` — `commands.install` — from
failing after the implement step has been paid for.

**AC-11 — emitting is not shipping, asserted on the manifests as well as in prose.**
*Test:* `apps/web` keeps `private: true` and declares no `exports`, `main`, `types`, `files` or
`bin`; `build.test.ts`'s `DISTRIBUTION` register is still `['cli','core','shared']` and its
`DECLARED_FILES` map is unmoved; and `packages/server/src/package.test.ts:139–140`'s comment — *"The
local distribution set is three packages and this ticket does not make it four, which is what keeps
`packages/cli/src/build.test.ts`'s per-package emit register unchanged"* — is corrected where it
conflates the two sets, its assertions being unaffected. A comment claiming what it cannot back is
the family this repository has recorded most often.

---

## 5. Non-goals

1. **The static route and everything about serving.** Appendix A's successor. If OQ-1 is refused
   this non-goal is void and Appendix A's criteria are promoted.
2. **`quorum open`.** It has no ticket in M3 at all (Appendix B), and `packages/cli` declares no
   dependency on `@quorum/server`.
3. **Any screen.** Q-0015 to Q-0018, and M4's editors.
4. **Making a packed install serve a UI.** Adding `apps/web` to the local distribution set, or
   shipping the bundle inside `@quorum/cli` beside its templates, is a separate decision — the
   second would make one package's emit a tracked asset of another and collide with
   `build.test.ts`'s census by construction. Appendix B.
5. **Publishing.** Registry-resolved `npx quorum` is refused rather than deferred (078(d)) and is
   Q-0029's, in M6. No test name, message or document may claim otherwise.
6. **Widening `testFilesIn` to `.test.tsx`**, registered by Q-0014's R-3 and not taken here.
7. **Any change to the root `build` task's `outputs`, `dependsOn` or `env`**, or to root
   `turbo.json` as the one place `env` is decided.
8. **A `^build` edge on `test` or `typecheck`.** 078(b); AC-2 is the guard.
9. **Coining a glossary term**, recommended against in §3. If the gate coins one anyway, both
   22-term lists move in the same change on the integration branch (GO-2).
10. **Windows.** The three existing build scripts open with `rm -rf`, registered POSIX-only by
    Q-0098; a fourth is under that registered limit and does not lift it.
11. **A `public/` directory, a non-`/` `base`, or a service worker.** None is needed and each would
    change what the successor's static route must answer for.
12. **Changing the Studio's route register, the daemon's routes, or any REST, refusal, WebSocket
    frame or gate-answer contract.**
13. **Chunking, asset-size or bundle-shape optimisation**, and replacing Vite.

---

## 6. Open questions

**OQ-1 — is this one ticket or two? BLOCKING. Recommendation: two.**
The measurement is a criterion count against this repository's own ceiling. The emit half is §4's
eleven; the serve half is Appendix A's nine. **Twenty** is past the fifteen this role uses, past the
**eighteen Q-0013 was refused at**, and approaching the twenty-one that split Q-0091 and Q-0096 —
each at a gate and each at cost. The seam is measured rather than chosen: the emit half touches
`apps/web`, four registers in `packages/cli` and `packages/core`, and three documents, and has no
design question left open once GO-1 lands; the serve half touches `packages/server` alone, carries
the exact-collision question of §0.4 and the cwd measurement of §0.5, and adds a **new capability**
to the daemon — turning a URL into a file read, from a process with no authentication of any kind —
which is a different risk class from a build script and which wants its own confinement criterion
and its own gate. Nothing is delayed by the split: no screen consumes either half, and the
successor's first criterion has no subject until a bundle exists. The cost is one further
requirements gate and one further chore gate, which Q-0108's ruling makes the argument to weigh —
and at nine criteria carrying the first HTTP-facing file read in this product, it is worth paying.

**OQ-2 — does the ruling widen **Emitted artifact**, or coin a third kind? BLOCKING; the human's,
and GO-1 is where it is answered. Recommendation: widen.**
§3(2) carries the argument. The alternative is genuinely defensible and is recorded rather than
dismissed: a bundle is served rather than resolved, so 078(b)'s *"what Node and a packed install
resolve, and nothing else"* stays literally true of the three, and a new term would keep it that
way. What decides it is which reading leaves the **hazard** covered. §0.6 removes the cost argument
from this question in both directions, so it is settled on vocabulary cohesion and on nothing else.
**AC-7 is unsatisfiable until the entry lands**, which is why this is a blocker and not a footnote.

**OQ-3 — what does `isolate()` build? Not blocking; AC-6 admits either answer provided the report
says which and gives the measurement. Recommendation: parameterise.**
`build.test.ts` audits the build and wants every emitter; the two spawning suites want the local
distribution set. One helper serving two questions is what makes this a decision. The cheap shape is
a parameter defaulting to the distribution set with `build.test.ts` asking for every emitter
explicitly, which keeps two expensive suites' subject and cost where they were measured. **Measure
before choosing**: if a forced Vite build inside the copy costs a second or two, leaving `isolate()`
alone and re-deriving the two docblocks is the honest answer.

**OQ-4 — does `apps/web` declare `vite` directly? Not blocking; AC-10 covers either answer.
Recommendation: yes.**
It imports `vite` in `vite.config.ts` and resolves it today from the workspace root by directory
walk. `.claude/rules/engineering.md` asks for a one-line justification per dependency and
`JUSTIFICATIONS` is where this package keeps them, so declaring it makes an existing implicit
dependency visible at the cost of one register row and a lockfile entry. The counter-argument — that
`vite` is workspace tooling like `typescript` and `turbo`, which no package declares — is real; note
that `@vitejs/plugin-react` and `@tailwindcss/vite` both take `vite` as a peer, so the package is
already in that relationship whether it says so or not.

**OQ-5 — does the build task earn a package-level `turbo.json`? Not blocking. Recommendation: no,
and measure before writing one.**
Q-0121 wrote one, measured it unnecessary and deleted it, recording both hashes. `apps/web`'s build
reads only files inside the package plus the root `globalDependencies`, which root `turbo.json`
already hashes for every task. A declaration would be the same claim twice, free to drift.

**OQ-6 — cache headers for static responses. Not blocking, and it belongs to Appendix A's
solutioning rather than here.** Contributed by candidate `codex`. What the daemon sends for
`index.html` against a hashed asset may differ by file class; it must not change route selection and
must not require network access. Absent an explicit policy, ordinary local-server behaviour with no
long-lived cache is acceptable — but a long-lived cache on `index.html` would be 078's
replayed-artifact hazard arriving a third time, in the browser, so it is named rather than left.

---

## 7. What moves, as an inventory

**Red today, green after — the change's own subject, and all four must be shown red first:**

| site | why it fails |
| --- | --- |
| `packages/core/src/test-discovery.test.ts` Q-0097 AC-13 | emitting register is a three-element identity |
| `packages/core/src/test-discovery.test.ts` stub clause | `scripts.build` undefined for every non-emitter |
| `apps/web/test/package.test.ts:136` | *"the app remains non-emitting"* |
| `apps/web/test/package.test.ts:210` | *"this package declares a build script and emits nothing"* |

**Must answer for a new literal:** `packages/core/src/turbo-inputs.test.ts` clause B (AC-5).

**Behaviour extends to a fourth task — passes only if the Vite build satisfies the census:**
`packages/cli/src/build.test.ts` at `:144`, `:360`, `:558`, `:584`, `:603`, `:624`, `:635`, `:666`,
`:838`, `:858`, `:905`, `:910`, `:1094`; and `packages/cli/test/workspace.ts:196` via `isolate()`,
which reaches `packages/cli/src/end-to-end.test.ts` and `src/failure-paths.test.ts`.

**Prose that becomes false:** `docs/GLOSSARY.md` **Build task** and **Emitted artifact**;
`docs/04-architecture.md:11`, `:190–191`, `:193`, `:233`, and `:272`'s neighbourhood without
re-quoting the pattern; `harness/product-context.md:78`; `apps/web/vite.config.ts`'s header, which
says there is no `build` section because there is no `build` script;
`packages/cli/src/end-to-end.test.ts` and `src/failure-paths.test.ts`'s measured docblocks;
`packages/cli/tsconfig.build.json` and `packages/core/tsconfig.build.json`'s *"The three emitting
packages declare the same four options"* — still true of the three, and the sentence should say so;
`packages/server/src/package.test.ts:139–140`.

**Checked and unmoved:** `.gitignore` (`dist/` already); `eslint.config.js` (`**/dist/**` ignored,
so the bundle is never linted); `vitest.shared.js` (`**/dist/**` excluded, so an emitted test cannot
be collected); `apps/web/test/package.test.ts`'s `NOT_OURS` walk filter, which already excludes
`dist`, `.turbo` and `.vite`; `packages/core/turbo.json`'s three `apps/*` globs;
`build.test.ts`'s `DISTRIBUTION` and `DECLARED_FILES`; `README.md`'s `for p in shared core cli` pack
loop; `docs/04-architecture.md:136` (`packages/server` emits nothing — unaffected);
`build-fixture.test.ts`, which reads `packages/shared`'s build script by name rather than through
`emitting()`. All eleven checked rather than assumed.

---

## 8. Gate obligations

**GO-1 — the decision entry, before the run.** §3. The human's, unconditionally: `docs/decisions/`
is outside `developer-generalist`'s paths and that role's instructions name it as the first example
of `blocked`. **AC-7 cannot be satisfied until it lands**, because that criterion requires the
glossary to cite it by title and date — stated here rather than discovered, because a loop handed
work no step in it can perform is the failure this repository has recorded fifteen times, most
sharply on Q-0062, whose requirement named the hazard in advance and whose run was launched without
the entry anyway. **Verify the entry is present in the implement step's actual prompt** rather than
assuming it, which is the check Q-0097 lost two errata by not making and which Q-0115's GO-1
discharged by measurement.

**GO-2 — the term lists, only if a term is coined.** §0.6 measures this as conditional: three of the
last five glossary terms landed without either list moving. If OQ-2 is answered by coining, both
`CLAUDE.md` and `docs/README.md` move in the same change and on the integration branch, because
`docs.test.ts` compares them **ordered** and a partial move leaves `main` red — the sequencing
Q-0067's GO-2 had to perform. Recommendation: coin nothing, and discharge this by recording that.

**GO-3 — the successors, opened at this gate with their bodies in full.** Appendix A (the static
route) and Appendix B (the packed install's UI, and `quorum open` having no ticket). Opened as
tickets rather than left in this document, because three obligations found in one week — Q-0110's,
Q-0111's and Q-0112's — had lived only inside a closed ticket's prose or a source comment, one of
them since 2026-09-02. Q-0123 is the highest allocated id; the allocator answers the next two.

**GO-4 — verification in both environment rows, forced.** Q-0072's closing finding: the implement
worktree has neither `.harness/worktrees` nor `.quorum/runs`, and `main` after the merge has both.
`pnpm turbo run test --force --continue` in each, plus `pnpm lint`, `quorum lint` and
`pnpm sweep:git-identity`. This ticket adds a build task, so **`pnpm turbo run build --force` runs
in both rows as well** and the four-package wall-clock is recorded — the cold-clone figure R-3 wants.

**GO-5 — mutation rather than a bare approve.** Against 108 `revise` to 37 `approve` across 145
review verdicts, and against Q-0121's 50.9-second one-sentence approve over 916 lines, a first-round
approve on a change of this shape is distrusted (Q-0051). The mutations that discriminate: remove
the `build` script and the four AC-4 sites fail naming the package; add `^build` to the root `test`
task and AC-2 fails; make the build write one file outside `dist/` and the census names it; delete
the AC-5 answer and clause B names `apps/web`; quote `` `dist/**` `` a second time in the
architecture document and `docs.test.ts:287` fails with the occurrence count.

---

## 9. Risks

**R-1 — no user-visible consumer.** Under the split this ticket ships a build task nothing serves.
Stated rather than mitigated away, as Q-0121's R-1 was: the alternative — bundling the route — is
what turned Q-0013 into three tickets and Q-0014 into two. What it leaves behind is real: four
registers that agree, a vocabulary that distinguishes emitting from shipping, and an artifact the
successor has a subject to serve.

**R-2 — two expensive suites gain a build they do not want.** §0.3. Both carry timeouts measured
against three `tsc` builds. AC-6 and OQ-3 are the response; the risk is that the answer is taken by
reading rather than by measuring.

**R-3 — the isolated copy may not build, and this requirement did not run one.** `isolate()` copies
git-visible files plus the root configuration and mirrors `node_modules` as symlinks with the
`@quorum` scope re-pointed at the copy. `apps/web` declares no `vite` and resolves it from the
workspace root by directory walk, so whether `vite build` runs to completion inside such a copy is
**unproven**. It is the first thing to measure, before any criterion is worked on, because if it
does not the answer is OQ-3's narrowing rather than a repair.

**R-4 — the census is the strictest gate in the repository and it prunes nothing.**
`build.test.ts`'s isolated audit descends into the copy's `node_modules` and fingerprints by size,
mtime and bytes, so anything Vite or `@tailwindcss/vite` writes outside `apps/web/dist/` — a
`node_modules/.vite` cache, a temporary file — is reported by name, and anything removed is reported
separately.

**R-5 — a cache hit can now replay a page.** 078's hazard acquires a second site, served to a
browser rather than executed by Node. AC-3(b) is the narrow guard; the wider one is that GO-1's
entry says so, so the next reader meets the warning in the vocabulary rather than discovering it.

**R-6 — a documentation edit can turn the suite red for a reason unrelated to the change.** §0.7:
`` `dist/**` `` exactly once, and `build task, emitted artifact` contiguous. Both cheap to trip and
neither failure names this ticket.

**R-7 — POSIX-only.** Registered by Q-0098 across the three existing build scripts and not lifted
here.

---

## 10. Cross-cutting checklist

- **BYOS** — covered by construction: `apps/web/test/package.test.ts`'s credential scan reads
  **every** file in the package, the new build script included, and asserts its needles
  discriminate. No new code path accepts a subscription, a login or a key, and the word for what
  authenticates an agent stays **subscription**.
- **Worktree safety** — no flow writes anything here. The build writes only `apps/web/dist/`, which
  is gitignored and inside the package; AC-3 proves it, and the census is what would report a write
  into `.harness/`, `.quorum/` or `.git`.
- **Gate behaviour** — unchanged. No gate, no verdict vocabulary, no backward edge.
- **File format and its schema** — none. No zod schema, wire shape or persisted file moves;
  `@quorum/shared`'s barrel is unchanged under the recommended split.
- **Lint rules** — none added; `eslint.config.js` already ignores `**/dist/**`, so the bundle is
  never linted and the three enforced rules keep the corpus Q-0014 gave them.
- **Cold-clone impact** — the workspace-local path gains one build task: `pnpm turbo run build`
  builds four packages instead of three, and GO-4 records the measured difference. The packed path
  is unchanged and still has no UI, which is Appendix B rather than a silence. Nothing may claim a
  cold machine can obtain Quorum from the public registry.
- **Product-agnostic** — nothing here names a SaaS product.
- **Vocabulary** — no term is coined (recommended). After the ruling, *"bundle"* describes the
  **shape** of what Vite writes and is never a synonym for **emitted artifact**; **build task** is
  not a pipeline, a job or a step; and the daemon serves the emitted artifact rather than "the
  frontend" or "the client".

---

## Appendix A — Successor: the daemon serves the built web app

*Transcribed in full rather than referenced, per GO-3. Allocate at the allocator's next id; Q-0123
is the highest today. Runs **after** Q-0122, which is what gives it a subject. **p2.** Route: chore
by default — no contract and no red test — unless its own gate measures otherwise, a new response
for every path on the daemon being behaviour rather than machinery.*

**Problem.** `docs/04-architecture.md:190–191` has said since 2026-08-22 that the server serves
`apps/web`'s build output. After Q-0122 the output exists and `packages/server` still opens no file:
no `serveStatic`, `sendFile` or `createReadStream` appears anywhere in its production source.

**The central design question, and it is not the one the parent body asked.** Hono matches a
registered path pattern rather than a prefix, so prefix-shadowing is the Vite proxy's problem and not
the daemon's. What the daemon has is **exact collision**: of the shell's twelve paths, **four** are
literally daemon `GET` routes — `/flows`, `/runs`, `/runs/:handle` against `GET /runs/:id`, and
`/history`. A handler that returns a response ends the chain, so **a fallback registered after the
JSON routes is never reached for those four**, and a browser reloading on a deep link gets JSON.
That is Q-0120 review round 1's B-1 reproduced in the shipped product, where it was *"seven of twelve
routes 404 on a reload while in-app navigation kept working and hid it"*. The other eight are
unclaimed and a fallback serves them.

So the matching rule must discriminate on something other than the path and must sit ahead of the
JSON routes. **That mechanism is already shipped**: `apps/web/vite.config.ts`'s `bypassNavigation`
keys on `req.method === 'GET' && req.headers.accept?.includes('text/html')`, because a top-level
navigation requests `text/html` where a same-origin `fetch` and the WebSocket upgrade do not. It has
**no test** today.

**The rule this successor should state once and implement once.** (1) A request naming a file that
exists under the bundle root is answered with that file, whatever its `Accept` — which is how
`/assets/*` works, and which collides with nothing, no daemon route naming a path that exists as a
file. (2) Otherwise a `GET` or `HEAD` whose `Accept` includes `text/html` is answered with
`index.html`, and the shell's own Not found view is what tells a human the path is unknown —
`app.tsx` already renders it and `shell.test.ts` already proves it. (3) Otherwise the request falls
through to the JSON routes and their 404s, so a client that fetched a mistyped daemon path still
gets a JSON refusal rather than a page. **(4) A request for a file-like path absent from the build —
including one under the asset directory — is a 404 and never `index.html`**, because a 200 HTML
answer for a missing script is a blank page with a successful status, which is the reassurance this
repository has refused three times elsewhere.

**Measured before that rule was written.** `@hono/node-server`'s `serveStatic` takes a `root`
*"relative to current working directory from which the app was started"* and *"Absolute paths are
not supported"*, read from the installed `dist/serve-static.d.ts` at 1.19.17. The daemon's cwd is the
operator's project root; the bundle's location is package-relative. A root computed from the cwd
would make the daemon's behaviour a property of the directory it was started in, which *"A test's
verdict is a property of the commit, not of the checkout or the account"* (2026-08-30) refuses. And
`packages/server` must not import `apps/web` — `04-architecture.md` is explicit that the dependency
cannot exist in either direction — so the server cannot resolve the app's location at all.
**Recommendation: the bundle root is an explicit option** on `serve`/`createDaemon`, which puts the
question with whoever starts the daemon.

**Draft criteria, nine.**

1. **The bundle root is supplied, never discovered, and its absence is a state rather than a
   failure.** *Test:* a host served with no bundle root answers the eleven existing routes exactly as
   it does today, answers a navigation with the same 404 it answers today, and **never** emits HTML;
   a host served with one answers `index.html`. Neither behaviour is inferred from the other.
2. **A bundle root that is supplied and holds no build refuses at startup, explicitly.** *Test:*
   starting with a root whose entry file is absent fails with an error naming the missing Studio
   build output and what to run, and **does not** bind a listener that would later answer an
   unexplained 404 for `/`. *"Errors are explicit. Never default silently."* Tests exercising the
   Hono app without a listener may supply an isolated fixture directory. (Contributed by candidate
   `codex`; it is the half `claude`'s option-shaped design leaves open.)
3. **Every one of the shell's twelve paths is reachable by a top-level navigation**, including the
   four that are exactly daemon routes. *Test:* a `GET` with `Accept: text/html` to each path in
   `ROUTES` — read from the register rather than transcribed, so a thirteenth is covered without
   anyone remembering — returns the bundle's `index.html`. Shown **red** against a fallback
   registered after the JSON routes, which serves eight and fails four.
4. **Nothing that is not a navigation ever receives HTML, and `HEAD` matches `GET`.** *Test:* each
   of the eleven registered routes, requested with `Accept: application/json` and with `*/*`,
   answers exactly what it answers today — status, body and content type; `GET /runs/:id/events`
   still upgrades and still carries one event per message, the fallback passing it through rather
   than consuming it; and a `HEAD` for a served file returns the same status and headers as `GET`
   with no body.
5. **A missing file-like path 404s and is never answered with `index.html`**, including one beneath
   the asset directory and including a request that accepts HTML.
6. **No path outside the bundle root is served.** *Test:* URL-encoded traversal in every encoding
   the router will deliver, dot segments, repeated separators, and a symlink inside the root whose
   target is outside it are all refused — resolved with `realpathSync` and compared component by
   component, which is **Confinement** as `docs/GLOSSARY.md` defines it and as
   `packages/core/src/backlog/confine.ts` implements it for the backlog root. **This is the criterion
   that earns the ticket its own gate**: the daemon has no authentication of any kind, binds loopback
   and is started inside a git repository, so a static route is the first surface here that turns a
   URL into a file read. A **dangling** symlink is the case Q-0059's review round 2 found as a
   blocker and it is named here in advance.
7. **The navigation predicate has exactly one definition in the workspace, and both the dev server
   and the daemon reach it.** *Test:* a scan finds one definition; `apps/web/vite.config.ts` and
   `packages/server` both import it; neither package imports the other. Satisfiable only from
   `@quorum/shared`, which is the sole package both depend on — the precedent Q-0120 already set for
   the frame union. A pure `(method, accept) => boolean` is browser-safe by construction, so
   `packages/shared`'s browser-capability scan is unaffected, and the dev server's rule stops being
   untested.
8. **The route register and the architecture document move with the code.** *Test:*
   `packages/server/src/package.test.ts`'s `registeredRoutes()` names the new route, and
   `04-architecture.md`'s `packages/server` section names it in backticks — which that guard already
   enforces. **Note the trap, measured:** that derivation matches
   `/\bapp\.(get|post|put|patch|delete)\s*\(\s*([^,)]*)/g` with a **quoted literal** first argument
   and pushes anything else onto `unquoted`, failing with *"a route is registered at a path this
   guard cannot read"*. **`app.use` is not matched at all**, so a middleware mount is invisible to
   it. Register the route as `app.get` with a literal, or extend the derivation to `use` in the same
   change and show the extension red first. A guard blind to its own subject is the family this
   repository has recorded most often.
9. **The documents say what shipped.** `:190–191` and `:233` both move; the matching rule is stated
   **once** on that page rather than transcribed into two packages' comments; the status line records
   the ticket and the date. *Test:* a `docs.test.ts` clause over the section, shown red over the
   current wording.

**Non-goals.** `quorum open`; any screen; serving anything other than `apps/web`'s emit; a
non-loopback bind, which `serve.ts` settles and which a flag whose only use is to make the product
unsafe would reopen; authentication or CORS, which `packages/server/src/package.test.ts` currently
forbids outright; compression or a service worker; and making a packed install serve anything
(Appendix B).

**Open questions for its gate.** Is a decision entry owed? Probably not — Hono is
`04-architecture.md`'s choice from 2026-08-22 and *"serves the built `apps/web`"* is that page's own
sentence, so executing a landed document is not changing the architecture (Q-0013 OQ-3). What is
worth asking explicitly is whether answering `index.html` for an unrecognised **navigation** is a
silent default under *"Never default silently"*; the answer offered is that it is not, because the
shell's Not found view names the path it could not match and rule (3) keeps a non-navigation refusal
explicit — but it is the gate's to rule. Second, the cache-header policy carried here as OQ-6.
Third, whether `packages/server` gaining its first `node:fs` read needs recording, given it imports
`node:path` today and no guard forbids the other.

---

## Appendix B — Successor: how an installation outside the workspace obtains the UI

*Transcribed in full per GO-3. **p2**, and it is the adopter's ticket rather than the maintainer's.*

**Problem, in two halves that belong together.**

**(a) After Q-0122 and Appendix A, a packed install still has no web app.** The local distribution
set is three tarballs and `apps/web` is `private: true` with no `files` and no `exports`. So the
workspace-local path has a UI and the **locally packed path, which is one of the two installation
paths this repository claims and tests, does not.** That is a gap in the cold-clone story M6 turns
on, and nothing records it today.

**(b) M3's done-when names `quorum open` — *"starts daemon + browser; CLI and UI can both answer the
same gate"* — and no ticket in this milestone builds it.** Measured: M3's list is Q-0013 to Q-0019
plus Q-0118 to Q-0123, none of which is `quorum open`; `packages/cli` declares only `@quorum/core`
and `@quorum/shared`, so nothing in the CLI can start a daemon at all. That is the shape this page
records seven directions of — an obligation living in a done-when rather than in a ticket — and it is
worth one line in the plan whatever this ticket decides.

**What it must decide, with the two shapes measured rather than listed.** Either `@quorum/web`
becomes a **fourth tarball**, which makes the local distribution set four and moves `README.md`'s
pack loop, `harness/product-context.md:78`, `docs/04-architecture.md:11`, `build.test.ts`'s
`DISTRIBUTION` and `DECLARED_FILES` and `packages/server/src/package.test.ts:139`'s claim — and
requires the app to stop being `private: true`, which collides with 078(d)'s refusal of registry
resolution until Q-0029; **or** `@quorum/cli` ships the bundle beside its templates, which is
Q-0093's precedent (`packages/cli/templates/harness/`, `files: ["dist","templates"]`) and which
requires **one package's emitted artifact to become a tracked or copied asset of another** — a write
`build.test.ts`'s census reports by construction, since it asserts the build wrote nothing outside
every emitting package's own `dist/`.

**Neither is cheap and neither is a passing choice**, which is why it is a ticket. It probably owes a
decision entry: both shapes change what the local distribution set is, and Q-0122's entry will have
just separated the emitting set from it, so this is the next question that separation raises.

**Start by measuring, not by choosing.** How large the bundle is; whether a tarball carrying it
lengthens the cold-clone install (Q-0014's GO-4 measured the cold-store install doubling to 10.4 s
and +50 MB for the app's dependencies alone); and whether the census can express a cross-package
asset copy at all, or whether the answer is that the CLI's own `build` script produces it rather than
copying it. **Read Q-0122's entry first**, and `04-architecture.md`'s *"What a cache hit gives back"*
paragraph second.

---

## Provenance

**Candidate `claude` is the spine of this document**, and four of its findings are why: the two
non-emitting assertions in `apps/web/test/package.test.ts`; `isolate()`'s derivation from
`emitting()`, which is the largest piece of unnamed work in the ticket; the new `'apps/web'` literal
that `turbo-inputs.test.ts` covers with nothing; and `registeredRoutes()`'s blindness to `app.use`.
It also measured `serveStatic`'s cwd-relative root, which is what makes Appendix A's explicit-option
shape forced rather than preferred, and it produced §0.6's correction to the ticket body's own §1.6.
Its §4, §5, §7, §8 and §9 are carried with edits; its Appendices A and B are carried and extended.

**Candidate `codex` contributed four things `claude` does not, and all four are kept.** Appendix A's
criterion 2 — an explicit refusal when a supplied bundle root holds no build, rather than a listener
that answers an unexplained 404 for `/` later — is the half `claude`'s option-shaped design leaves
open, and the two merge cleanly: absent option means API-only and is deliberate, supplied-but-unbuilt
refuses. Criterion 4's **`HEAD`** parity is codex's alone. Criterion 5 — a missing asset must 404 and
never be answered with HTML — names a hazard `claude`'s rule (2) creates and does not close: a 200
HTML answer for an absent script is a blank page with a successful status. OQ-6's cache-header
question is codex's, kept and sharpened, because a long-lived cache on `index.html` is 078's
replayed-artifact hazard arriving a third time. Its risk list is the better of the two on the
serving half and is folded into Appendix A.

**Where they disagreed, and why the merge picked what it picked.** On **scope**, codex writes twenty
criteria as one ticket and claude recommends two; the split is taken, and the reason is a count
against this repository's own recorded ceiling rather than a preference — see OQ-1. On the **route
problem**, codex says *"overlap"* and claude says *"exact collision"*; claude is right and it decides
whether ordering can fix it, verified at this gate by reading both registers. On the **term list**,
codex says a coined term must be added to the repository-wide list; measured, that is conditional and
three recent terms are in neither list. On **testability**, codex's AC-14 and AC-15 bundle eleven
test subjects into two criteria and its AC-18 to AC-20 are the standard gate rather than properties
of this change; both are struck as criteria and land as GO-4 and §10, which is where this repository
keeps them.

**Three measurements in this document are the gate's own and are in neither candidate.**
`emitting()` is reached at **thirteen** sites in `build.test.ts`, not the four claude named. The
architecture document has **four** prose sites that move, not three — `:11`'s *"`pnpm pack` in each of
the three emitting packages"* names the packed set by the emitting set's name, the same conflation as
`harness/product-context.md:78`. And `docs/GLOSSARY.md` defines **34** terms against the two curated
lists' 22, which is the arithmetic behind §0.6 rather than claude's 38.
