# Q-0122 — The daemon serves the built web app

*Requirements, run 1, candidate `claude`. Written against the tree at 2026-09-12, after Q-0120 and
Q-0121 landed. Every measurement below was re-run rather than relayed from the ticket body, which
was itself re-measured the same morning; §0 records what held, what had drifted, and the four
findings that change the shape of the work.*

**Recommendation up front, because it decides how the rest of this document is read: this ticket
should be cut in two at its gate.** The emit half — a `build` script for `apps/web`, the registers it
moves, and the vocabulary ruling Q-0014 deferred — is eleven criteria and is what §4 specifies. The
static route is seven more, carries its own design question and its own new capability, and is
written out in full as **Appendix A** rather than referenced. The reasoning is in **OQ-1**, and it
is a count against this repository's own recorded ceiling rather than a preference.

---

## 0. Measured before anything was written

### 0.1 What the body got right, re-verified

Nine claims from the 2026-09-12 re-measurement hold exactly as written, and are not restated in
full here: `apps/web` declares `lint`, `typecheck` and `test` and no `build`; `packages/server`
serves no file (no `serveStatic`, `sendFile` or `createReadStream` in its production source);
`.gitignore:4` is `dist/`; `packages/core/turbo.json:72–74` declares `../../apps/*/package.json`
and two siblings; `vitest.shared.js:61` excludes `**/dist/**`; `docs/GLOSSARY.md:203` and `:204`
carry the two clauses one of which must move; `harness/roles/developer-generalist.md:3` carries
`docs` and `harness` and not `CLAUDE.md`; `@hono/node-server` already declares `./serve-static` and
is already a dependency at `^1.19.11`, installed **1.19.17**, so no new dependency arrives; and both
`test-discovery.test.ts` clauses go red on a fourth emitter — `:271`'s
`toStrictEqual(['packages/cli', 'packages/core', 'packages/shared'])` and `:289`'s stub clause,
because `PACKAGES` is `workspacePackages()` over `pnpm-workspace.yaml`'s `packages/*` **and**
`apps/*`, so `apps/web` is already a member of the derivation.

### 0.2 Finding 1 — the "nothing else moves" list is short by three guards, in two files the body does not name

The body's re-measurement found one omission (`build.test.ts`) and stopped. There are three:

**`apps/web/test/package.test.ts` asserts the app is non-emitting twice, in two different
describes.** The Q-0120 AC-22 block carries `test('the app remains non-emitting')` →
`expect(manifest().scripts?.build).toBeUndefined()`, and the AC-3 block carries
`test('the package still declares the three tasks every package owes')` →
`expect(scripts.build, 'this package declares a build script and emits nothing').toBeUndefined()`.
Both fail. Neither is in any earlier account, and the second's own comment routes the question here
by name — *"Whether a served bundle is an emitted artifact at all is Q-0122's, with the task."*

**`packages/core/src/turbo-inputs.test.ts` needs a fourth register row.** The emitting register at
`test-discovery.test.ts:271` becomes a four-element identity led by `'apps/web'`, and that
introduces the literal `'apps/web'` into a file belonging to `@quorum/core#test`.
`pathLiterals` collects any quoted literal containing `/` that the tracked-and-unignored inventory
holds, and `Inventory.holds` is true of a directory prefix — so the literal is collected, and
`covered()` answers false on all four of its routes: it is not inside `packages/core/`, not a member
of that task's reported `inputs` (which are files), not a `globalCacheInputs.files` entry, and not
inside a dependency's directory. So clause B fails until either a `NOT_READ` row is added or the
path is declared. The three sibling rows already exist and carry the answer verbatim —
`'packages/core'`, `'packages/cli'` and `'packages/shared'` are each excused as *"a member of the
emitting-set register — both data, neither a read"*.

**Total: five assertions in four files go red**, not the two the body names. All five are the
change's own subject and all five must be shown red before green.

### 0.3 Finding 2 — `isolate()` is derived from `emitting()`, so two of the most expensive suites in the repository start running a Vite build

The body found `build.test.ts`'s four `emitting()`-driven sites. It did not follow the helper out of
that file. `packages/cli/test/workspace.ts:196` is `const tasks = emitting();` inside
{@link isolate}, which copies **every emitting package's** tracked files into a temporary workspace
and then builds it. Two other suites import that helper and call `buildIn(root, '--force')`:
`packages/cli/src/end-to-end.test.ts:328–329` and `packages/cli/src/failure-paths.test.ts:429–430`.

Both carry **measured** budgets derived against three `tsc` builds and both say so in prose:
`end-to-end.test.ts:79` — *"0.1 s to copy the workspace, 2.1 s for the forced build of the three
emitting packages, and 2.2 s for the twelve invocations — 4.4 s in total"*, with
`FIXTURE_TIMEOUT_MS = 90_000`; and `failure-paths.test.ts:133` — *"the workspace copy, a forced
build of the three emitting packages, and nineteen spawned…"*. Neither suite wants a web bundle:
each spawns the **binary**. So this change silently adds a fourth build to two suites whose subject
does not include it, and it does so through a helper whose own header describes the copy as *"the
emitting packages' tracked files"*.

That is the largest piece of unnamed work in the ticket, and it is a decision rather than a repair:
`build.test.ts` audits the build and genuinely wants every emitter, while the two spawning suites
want the **local distribution set**. See **OQ-3** and **AC-6**.

### 0.4 Finding 3 — the static route's problem is exact collision, not prefix-shadowing

The body's (b) is right that a deep link must not 404 and right that Q-0120's B-1 is the precedent.
What it does not name is why ordering cannot fix it. Hono matches a registered **path pattern**, not
a prefix, so `/projects` is not swallowed by `app.get('/project')` — the prefix problem was Vite's
proxy middleware and is not the daemon's. The daemon's problem is sharper: of the shell's twelve
paths in `apps/web/src/routes.ts`, **four are exactly claimed by a daemon `GET` route** —

| shell route (`routes.ts`) | daemon route (`http.ts` / `read.ts`) |
| --- | --- |
| `/flows` | `GET /flows` |
| `/runs` | `GET /runs` |
| `/runs/:handle` | `GET /runs/:id` |
| `/history` | `GET /history` |

— and a handler that returns a response ends the chain, so a fallback registered after them is never
reached for those four. The other eight shell paths are unclaimed and a fallback would serve them.
Therefore **the fix must discriminate on something that is not the path, and it must sit ahead of
the JSON routes.** That mechanism already exists in this product and is already shipped:
`apps/web/vite.config.ts:49–50`'s `bypassNavigation` keys on `req.method === 'GET' &&
req.headers.accept?.includes('text/html')`. It has **no test** — `apps/web/test/daemon-endpoints.test.ts`
asserts only that the config names `DAEMON_ENDPOINTS` — so a criterion asking the daemon to agree
with it has no executable counterpart today. Both halves are Appendix A's.

### 0.5 Finding 4 — `serveStatic`'s root is cwd-relative and refuses an absolute path

Read from the installed types, `packages/server/node_modules/@hono/node-server/dist/serve-static.d.ts`:
`root` is *"relative to current working directory from which the app was started. Absolute paths are
not supported."* The daemon's cwd is wherever the operator invoked it — the project root — while the
bundle's location is package-relative, which is the shape Q-0093 and decision 078(e) already settled
for `quorum init`'s templates (`new URL('../templates/harness/', import.meta.url)`). So a root
computed as a relative path from the cwd would make the daemon's behaviour a property of the
directory it was started in, which *"A test's verdict is a property of the commit, not of the
checkout or the account"* (2026-08-30) refuses one layer down. The body's (c) is right that no
dependency decision is owed; what it left open — *"whether to use it or to read the file directly
stays solutioning's"* — is narrower than it looks, and the measurement is recorded in Appendix A
rather than lost.

### 0.6 A correction to §1.6: coining a glossary term does not necessarily move `CLAUDE.md`

The body says *"Coining a new term moves `CLAUDE.md`'s list, which is not in those paths at all"*.
Measured: `docs/GLOSSARY.md` defines **38** terms; `CLAUDE.md:13` and `docs/README.md:41–44` each
carry **22**, byte-identical to one another. The two lists are a curated subset, and **three terms
added since 2026-09-08 are in neither** — **Confinement** (Q-0059), **Run lock** (Q-0039) and
**Connection state** (Q-0120, yesterday). Nothing checks either list against the glossary;
`docs.test.ts`'s Q-0108 block compares the two lists with each other, ordered.

So the gate obligation is **conditional and cheap**, not unconditional: a glossary term may land
without the lists moving, as three have; and *if* it is added to them, both must move in the same
change, on the integration branch, because the ordered comparison makes a partial move red — which
is the sequencing Q-0067's GO-2 had to perform for **verified version**. What is owed
**unconditionally** is the decision entry, and that is GO-1.

### 0.7 One line reference, corrected

The *"will serve `apps/web`'s build output … that app has no build task and emits nothing today"*
sentence is at `docs/04-architecture.md:190–191`, not `:149–151`; the sentence itself is unchanged.
Q-0120 added a second, better statement at `:233` which routes all three halves here by name, and
`apps/web/vite.config.ts:4–6` says the same in its header. **Three live sites point at this ticket
and all three move with it.** The complete inventory is §7.

### 0.8 Two constraints on the documentation edits that a reader would not predict

**`` `dist/**` `` may appear exactly once in `docs/04-architecture.md`.** `docs.test.ts`'s Q-0097
AC-24 clause reads the root `turbo.json`'s `outputs` and asserts each pattern occurs in the document
`occurrences === 1`, *"a second occurrence is the transcription this guard exists to refuse"*. It is
at `:273`. A new paragraph about the fourth emitter that quotes the pattern again turns the suite
red for a reason unrelated to the change.

**`docs/README.md` must keep the substring `build task, emitted artifact`.** The same block asserts
it, and a term inserted between those two entries breaks it. A third measured argument for coining
nothing.

---

## 1. Problem

`docs/04-architecture.md:190–191` has said since 2026-08-22 that the server serves `apps/web`'s
build output, and M3's done-when includes `quorum open` starting the daemon and a browser. Neither
half exists. `apps/web` declares no `build` script, so there is nothing to serve; `packages/server`
opens no file, so there would be nothing to serve it with; and three live sites — that sentence,
`:233`'s `apps/web` paragraph, and `apps/web/vite.config.ts`'s own header — record the gap and route
it here.

Underneath the two missing pieces is a vocabulary question Q-0014's gate deliberately deferred to
this ticket rather than answering inside a shell. `docs/GLOSSARY.md`'s **Emitted artifact** says
emitted artifacts are *"The JavaScript and declaration files a build task writes under a package's
`dist/`"*, that *"The three emitting packages are `@quorum/shared`, `@quorum/core` and
`@quorum/cli`, which is also the local distribution set"*, and that an emitted artifact *"is not a
'bundle' — nothing here is bundled, each source file emits its own counterpart"*. A Vite build of
`apps/web` falsifies all three clauses at once: it is bundled, it is not declarations, and it is
served rather than packed. **The two facts that sentence conflates — what emits and what ships — stop
being the same set the moment a fourth package emits**, and until they are separated no criterion,
comment or document can say truthfully which is which.

The surfaces touched are **`apps/web`** and the workspace's build configuration (this ticket),
**the local daemon** (Appendix A's successor), and **`harness/`** — `product-context.md`'s pillar 7,
which is fed to every product-manager step at run time and currently calls the packed set *"the
three emitting packages' tarballs"*. Nothing in `backlog/` moves and no CLI command changes.

---

## 2. User stories

**`maintainer`.** *I run several repositories through Quorum and I want to look at a live run in a
browser without keeping a Vite dev server open beside the daemon. One workspace command should
produce something the daemon can serve, and the four registers that decide what this workspace emits
should agree about it afterwards rather than three of them going red.*

**`contributor`.** *I want to know, from one sentence, which packages emit and which ones ship,
because they are no longer the same list. When I add a fifth emitting package I want the registers
to fail closed and name it — which is what decision 078(c) promised in as many words — rather than
leaving me to discover which four assertions disagree.*

**`adopter`.** *This ticket does not serve me, and saying so is the point.* A cold-clone adopter
installs three tarballs into a project outside the repository (`README.md:74`,
`harness/product-context.md:78`). `apps/web` is `private: true`, declares no `files` and no
`exports`, and this ticket deliberately does not add it to the local distribution set — so **after
this ticket a packed install still has no web app at all**, and the workspace-local path is the only
one with a UI. That obligation has no ticket, and neither does `quorum open`, which M3's done-when
names and which no ticket in this milestone builds. Both are written out in **Appendix B**.

---

## 3. The ruling this ticket owes, and what the human's entry should say

**A decision entry is owed, and it is owed before a line of code.** Not because a document
disagrees with the tree — that is an ordinary edit — but because *"The emit serves the binary, and
no test verdict moves behind it"* (2026-09-02) is contradicted in two places by a fourth emitter,
and the rules forbid contradicting a landed entry silently:

- **078(a)** says each emitting package emits *"JavaScript and declarations"* with *"No bundler and
  no new dependency: `tsc` is already the typecheck gate."* A Vite build is a bundler. No **new**
  dependency arrives — the root manifest already declares `vite@^8.2.2` and the app is already a
  Vite app — so the second half holds and the first does not.
- **078's Why** is the whole of the entry's containment argument: *"the emit is consumed by exactly
  one thing, the binary, and by exactly one suite, Q-0095's … Every other verdict in the repository
  goes on proving source, so the new failure class has one narrow place to live instead of standing
  behind all 1,520 tests."* A served bundle is a second consumer, and a second place for the
  replayed-artifact hazard to live.

078 also **anticipated** this: (c) says the derived register *"fails closed when a fifth package
starts emitting"*, which is precisely the mechanism §0.2 measures firing. So the entry extends 078
rather than reversing it, and must name it by title and date.

**What the entry should rule, offered so the human can write it quickly rather than re-derive it:**

1. **A fourth package emits, and what it emits is served rather than shipped.** The emitting set
   becomes four; the local distribution set stays three. `apps/web` keeps `private: true` and
   declares no `exports`, no `files` and no `bin`.
2. **The served artifact is an emitted artifact**, and the term widens rather than a third kind
   being coined. The measurement behind the recommendation: what makes the term load-bearing is
   078's own hazard — a non-empty `outputs` replays an *artifact* — and the bundle has that hazard in
   its sharpest form, so a third kind would put the thing most at risk *outside* the vocabulary that
   carries the warning. The alternative is recorded in OQ-2 rather than dismissed.
3. **A bundler is admissible for the fourth emitter**, and 078(a)'s *"no bundler"* is scoped to the
   three `tsc` emitters it was written about. Shape D's argument — *"the new dependency would buy a
   capability the artifact does not use"* — does not reach a browser bundle, which cannot be `tsc`
   output at all.
4. **078(b) holds unchanged.** `test` and `typecheck` gain no `^build` edge and no existing verdict
   moves. This is the clause a fourth emitter is most likely to erode and it must be asserted rather
   than assumed (AC-2).
5. **The new hazard is a stale page**, and it is the same class as Q-0098's shebang: the tick lies
   about the past, the artifact lies about the present. The three `tsc` emitters each `rm -rf dist`
   before compiling because turbo prunes an output directory on neither path; the fourth emitter
   must have the same property and it must be proven rather than inherited (AC-3).
6. **No glossary term is coined**, so neither of the two 22-term lists moves — which §0.6 makes a
   choice rather than a constraint, and §0.8 gives two independent mechanical reasons for.

A working title: *"A fourth package emits, and what it emits is served rather than shipped."*

**Who may write which half, read off the role file rather than inferred.** `docs/GLOSSARY.md`,
`docs/04-architecture.md` and `harness/product-context.md` are all inside
`developer-generalist`'s `paths:` and may be criteria. `docs/decisions/` is not — that role's own
instructions name it as the first example of `blocked` — and `CLAUDE.md` is in the list at all.
So the entry is **GO-1** and cannot be a criterion, per *"A requirement may not name a surface its
flow cannot write"* (2026-08-25), which this repository has paid for five times.

---

## 4. Acceptance criteria

*Eleven, under the recommended split. If the gate refuses OQ-1 and keeps the ticket whole, Appendix
A's seven are promoted here and the total is eighteen — which is what Q-0013 was refused at.*

**AC-1 — `apps/web` declares a `build` script, and the root task is untouched.**
The manifest gains `build`. Root `turbo.json`'s `tasks.build` is unchanged — `outputs: ["dist/**"]`,
`dependsOn: ["^build"]` — and `apps/web` either declares no package-level `turbo.json` or one
declaring `inputs` and nothing else.
*Test:* `dry('build').tasks` filtered on `command !== '<NONEXISTENT>'` returns four tasks including
`@quorum/web#build`; each of the four has `resolvedTaskDefinition.outputs` equal to the root's
declared patterns and `dependsOn` equal to `['^build']`, which is `build.test.ts:357`'s existing
clause now covering a fourth task rather than three; and `build.test.ts`'s *"every package-level
configuration declares inputs and no other key"* clause still passes.

**AC-2 — no verdict that exists today moves behind the fourth emitter.**
`test`, `typecheck` and `lint` keep `outputs: []` and gain no `^build` edge, resolved through turbo
rather than read off the file, and the assertion is not vacuous for the new package.
*Test:* for every task in `dry('test').tasks`, `resolvedTaskDefinition.dependsOn` does not contain
`^build` and `outputs` is `[]`; and the task list is asserted to **contain** `@quorum/web#test`, so
the clause is shown to reach the package this ticket changes. Both halves demonstrated red by adding
`^build` to the root `test` task in a copy.

**AC-3 — the build writes its emit, nothing else, and does not leave what its source no longer produces.**
*Test:* two clauses. (a) `build.test.ts`'s whole-copy isolated census passes with four emitters:
every path `@quorum/web#build` wrote is under `apps/web/dist/`, `dist/**` matches at least one of
them, and the audit reports no path written outside any emitting package's `dist/` and no path
removed. (b) A file placed in the copy's `apps/web/dist/` that the build does not produce is **gone**
after a forced rebuild — the property `rm -rf dist &&` gives the other three, demonstrated rather
than inherited from whatever mechanism supplies it, because `build-fixture.test.ts`'s own header
records that turbo prunes an output directory on neither the miss path nor the hit path.

**AC-4 — the five assertions this change falsifies are moved, each shown red before green.**
Named, because a list is satisfied by fixing four of five: `test-discovery.test.ts:271`'s emitting
register, `:289`'s stub clause, `apps/web/test/package.test.ts`'s Q-0120 AC-22 *"the app remains
non-emitting"*, and the same file's AC-3 *"this package declares a build script and emits nothing"*,
and `turbo-inputs.test.ts` clause B over the literal AC-5 covers.
*Test:* each of the five is shown failing against the pre-change guard with a message that names the
package, and passing after. The emitting register stays an **identity** — `toStrictEqual` over four
named entries — and does not become a count: *"a count is not an identity"* (Q-0073), and the whole
point of that register is that a fifth emitter is a visible act.

**AC-5 — `turbo-inputs.test.ts` answers the new `'apps/web'` literal, and the answer is load-bearing.**
Either a fourth `NOT_READ` row beside the three package rows, carrying the same reasoning those
three carry, or a declaration in `packages/core/turbo.json`. Not both.
*Test:* clause A and clause B both pass; the register's own *"a key the scan cannot see excuses
nothing"* clause still passes over the new row; and the row or declaration is shown load-bearing by
removing it and watching clause B fail **naming `apps/web`**. If a declaration is chosen instead,
the task's hash is shown to move when `apps/web/package.json` changes and the row is not added, so
the claim is not made twice — the over-declaration Q-0121 measured and deleted.

**AC-6 — what `isolate()` builds is decided, and the two suites that spawn the binary are re-measured.**
*Test:* `end-to-end.test.ts` and `failure-paths.test.ts` both pass; the implement report states
which of the two shapes was taken — `isolate()` goes on copying and building every emitting package,
or it takes the local distribution set and `build.test.ts` asks for every emitter explicitly — and
gives the measured wall-clock of the isolated build under each suite, so the numbers in
`end-to-end.test.ts:79` and `failure-paths.test.ts:133` are re-derived rather than left describing
three `tsc` builds. Where a timeout constant moves, the new value is stated as a multiple of the
measured worst case in the shape `FIXTURE_TIMEOUT_MS`'s own comment already uses.

**AC-7 — the glossary states what emits and what ships as two facts, and coins nothing.**
*Test:* **Emitted artifact** no longer equates the emitting set with the local distribution set;
both sets are named with their members and the difference is stated; the *"not a 'bundle'"* clause is
**re-scoped rather than deleted**, so it still forbids calling `packages/core`'s `dist/index.js` a
bundle while no longer denying that `apps/web`'s emit is one; **Build task**'s *"run in the three
packages that emit"* moves; the entry GO-1 landed is cited **by title and date and never by file
name or number**; and the two clauses `docs.test.ts` pins survive verbatim —
`the two words are not interchangeable` and `Not a "pipeline", a "job" or a "step"`. The two
22-term lists are byte-identical afterwards, and `docs/README.md` still carries the contiguous
substring `build task, emitted artifact`.

**AC-8 — the architecture document says what shipped, and says `dist/**` once.**
*Test:* the four prose sites in §7's inventory move; `` `dist/**` `` occurs **exactly once** in
`docs/04-architecture.md`, which `docs.test.ts`'s Q-0097 AC-24 clause already enforces and which a
new paragraph can break; the Testing-strategy sentence naming the emit's consumers is no longer a
closed list of three that omits the browser; the status line records `Q-0122` and the landing date;
and a new `docs.test.ts` clause holds the `apps/web` section against the claim that the app emits,
shown red over the section's current *"The app emits nothing"* wording. The two landed
`Q-0014 AC-11` anchors over that section — the route register, and the Q-0014 status-line pair —
still pass.

**AC-9 — `harness/product-context.md`'s pillar 7 stops calling the packed set the emitting set.**
*Test:* the sentence names the three **distribution** packages rather than *"the three emitting
packages"*; the two claimed installation paths and the refusal of registry-resolved `npx quorum` are
unchanged — no claim is gained or lost, only the set is named correctly — and a scan shows the file
carries no sentence asserting a cold machine can obtain Quorum from the public registry.

**AC-10 — the manifest declares what the build needs, each with a reason.**
Today `apps/web` declares no `vite`: `apps/web/node_modules` holds no such link and its
`node_modules/.bin` is empty, while the root manifest declares `vite@^8.2.2` and root
`node_modules/.bin/vite` exists — so `vite.config.ts`'s own `import … from 'vite'` resolves by
walking up to the workspace root.
*Test:* whatever the build resolves is declared where the build runs, and
`apps/web/test/package.test.ts`'s `JUSTIFICATIONS` register agrees with the manifest in **both**
directions — which that file already asserts, so a dependency added without a reason fails and a
reason left behind by one that has gone fails too. `dependencies` is still exactly
`['@quorum/shared', 'react', 'react-dom']`, so nothing new ships to a browser. The lockfile moved
with the manifest, which is what keeps `pnpm install --frozen-lockfile` — `commands.install` — from
failing after the implement step has been paid for.

**AC-11 — emitting is not shipping, asserted on the manifests as well as in prose.**
*Test:* `apps/web` keeps `private: true` and declares no `exports`, no `main`, no `types`, no
`files` and no `bin`; `build.test.ts`'s `DISTRIBUTION` register is still
`['cli', 'core', 'shared']` and its `DECLARED_FILES` map is unmoved; and
`packages/server/src/package.test.ts`'s comment at `:139–140` — *"The local distribution set is
three packages and this ticket does not make it four, which is what keeps `packages/cli/src/build.test.ts`'s
per-package emit register unchanged"* — is corrected where it conflates the two sets, its assertions
being unaffected. A comment claiming what it cannot back is the family this repository has recorded
most often.

---

## 5. Non-goals

1. **The static route and everything about serving.** Under the recommended split it is Appendix A's
   successor. If OQ-1 is refused, this non-goal is void and Appendix A's criteria are promoted.
2. **`quorum open`.** It has no ticket in M3 at all (Appendix B), and `packages/cli` declares no
   dependency on `@quorum/server` today.
3. **Any screen.** Q-0015 to Q-0018, and M4's editors.
4. **Making a packed install serve a UI.** Adding `apps/web` to the local distribution set, or
   shipping the bundle inside `@quorum/cli` beside its templates, is a separate decision — the
   second would make one package's emit a tracked asset of another and collide with
   `build.test.ts`'s census by construction. Appendix B.
5. **Publishing.** Registry-resolved `npx quorum` is refused rather than deferred (078(d)) and is
   Q-0029's, in M6. No test name, success message or document may claim otherwise.
6. **Widening `testFilesIn` to `.test.tsx`.** Q-0014's R-3 registered that alternative against
   `packages/core`'s surface; nothing here needs it and this ticket does not take it.
7. **Any change to the root `build` task's `outputs`, `dependsOn` or `env`**, or to root
   `turbo.json` as the one place `env` is decided.
8. **A `^build` edge on `test` or `typecheck`.** 078(b), and AC-2 is the guard.
9. **Coining a glossary term.** Recommended against in §3; if the gate coins one anyway, both
   22-term lists move in the same change on the integration branch (GO-2).
10. **Windows.** The three existing build scripts open with `rm -rf`, registered POSIX-only by
    Q-0098; a fourth script is under that registered limit and does not lift it.
11. **A `public/` directory, a non-`/` `base`, or a service worker.** None is needed and each would
    change what the successor's static route must answer for.

---

## 6. Open questions

**OQ-1 — is this one ticket or two? BLOCKING. Recommendation: two.**
The measurement is a criterion count against this repository's own ceiling. The emit half is the
eleven criteria of §4; the static route is the seven of Appendix A. Eighteen is what Q-0013 was
refused at, and twenty-one is what split Q-0091 and Q-0096 — both at their gates and both at cost.
The seam is measured rather than chosen: the emit half touches `apps/web`, `packages/cli`'s and
`packages/core`'s registers and three documents, and has no design question left open once GO-1
lands; the serve half touches `packages/server` alone, carries the exact-collision design question
of §0.4, and adds a **new capability** to the daemon — reading files off disk and answering them over
HTTP from a process with no authentication — which is a different risk class from a build script and
which wants its own confinement criterion. Q-0013's gate refused exactly this mixture. Nothing is
delayed by the split: no screen consumes either half, and the successor's own first criterion cannot
be written until a bundle exists. The cost is one further requirements gate and one further chore
gate, which Q-0108's ruling makes the argument to weigh — and at seven criteria carrying a new
HTTP-facing surface it is worth paying.

**OQ-2 — does the ruling widen **Emitted artifact**, or coin a third kind? BLOCKING; the human's, and
GO-1 is where it is answered. Recommendation: widen.**
§3(2) carries the argument. The alternative is genuinely defensible and is recorded rather than
dismissed: a bundle is served rather than resolved, so 078(b)'s *"what Node and a packed install
resolve, and nothing else"* stays literally true of the three and a new term would keep it that way.
What decides it is which reading leaves the **hazard** covered. §0.6 removes the cost argument from
this question in both directions — coining a term does not mechanically move `CLAUDE.md` — so it is
settled on vocabulary cohesion and on nothing else.

**OQ-3 — what does `isolate()` build? Not blocking; AC-6 admits either answer provided the report
says which. Recommendation: parameterise.**
`build.test.ts` audits the build and wants every emitter; `end-to-end.test.ts` and
`failure-paths.test.ts` spawn the binary and want the local distribution set. One helper serving two
questions is what makes this a decision. The cheap shape is a parameter defaulting to the
distribution set, with `build.test.ts` asking for every emitter explicitly, which keeps two
expensive suites' subject and cost exactly where they were measured. Measure before choosing: if a
forced Vite build inside the copy costs a second or two, the simpler answer — leave `isolate()`
alone and re-derive the two timeouts — is the honest one.

**OQ-4 — does `apps/web` declare `vite` directly? Not blocking; AC-10 covers either answer.
Recommendation: yes.**
It imports `vite` in `vite.config.ts` and resolves it today from the workspace root by directory
walk. `.claude/rules/engineering.md` asks for a one-line justification per dependency and
`JUSTIFICATIONS` is where this package keeps them, so declaring it makes an existing implicit
dependency visible and costs one register row and a lockfile entry. The counter-argument — that
`vite` is workspace tooling like `typescript` and `turbo`, which no package declares either — is
real; note that `@vitejs/plugin-react` and `@tailwindcss/vite` both declare `vite` as a peer, so the
package is already in that relationship whether it says so or not.

**OQ-5 — does the build task earn a package-level `turbo.json`? Not blocking. Recommendation: no,
and measure before writing one.**
Q-0121 wrote one, measured it unnecessary and deleted it, recording both hashes. `apps/web`'s build
reads only files inside the package plus the root `globalDependencies`, which root `turbo.json`
already hashes for every task. A declaration would be the same claim twice, free to drift.

---

## 7. What moves, as an inventory

**Red today, green after (the change's own subject):**

| site | why it fails |
| --- | --- |
| `packages/core/src/test-discovery.test.ts:271` | emitting register is a three-element identity |
| `packages/core/src/test-discovery.test.ts:289` | stub clause: `scripts.build` undefined for every non-emitter |
| `apps/web/test/package.test.ts` (Q-0120 AC-22) | *"the app remains non-emitting"* |
| `apps/web/test/package.test.ts` (AC-3) | *"this package declares a build script and emits nothing"* |
| `packages/core/src/turbo-inputs.test.ts` clause B | the new `'apps/web'` literal is covered by nothing |

**Behaviour extends to a fourth task (passes only if the Vite build satisfies the census):**
`packages/cli/src/build.test.ts:144` (clears every emitting package's `dist/`), `:357` (resolved
definition per emitter), `:558` (whole-copy census), `:568` (`agreesWithTheDeclaration` per task),
and `packages/cli/test/workspace.ts:196` via `isolate()`, which reaches
`packages/cli/src/end-to-end.test.ts:328` and `src/failure-paths.test.ts:429`.

**Prose that becomes false:** `docs/GLOSSARY.md:193` (**Build task**, *"three packages that emit"*)
and `:203–205` (**Emitted artifact**, the three clauses); `docs/04-architecture.md:11` (*"`pnpm pack`
in each of the three emitting packages"* — the packed set, misnamed), `:193` (*"the three packages
that emit"* and the owed-work sentence), `:233` (the whole *"The app emits nothing"* sentence),
`:273` (the emit's consumers, a closed list of three); `harness/product-context.md:78`;
`apps/web/vite.config.ts:4–6` (its own header, which says there is no `build` section because there
is no `build` script); `packages/cli/src/end-to-end.test.ts:79` and
`src/failure-paths.test.ts:133` (measured comments); `packages/cli/tsconfig.build.json:3` and
`packages/core/tsconfig.build.json:3` (*"The three emitting packages declare the same four options"*
— still true of the three, and the sentence should say so); `packages/server/src/package.test.ts:139–140`.

**Checked and unmoved:** `.gitignore` (`dist/` already); `eslint.config.js` (`**/dist/**` already
ignored, so the bundle is never linted); `vitest.shared.js` (`**/dist/**` already excluded, so an
emitted test cannot be collected); `apps/web/test/package.test.ts`'s `NOT_OURS` walk filter, which
already excludes `dist`, `.turbo` and `.vite`; `packages/core/turbo.json`'s three `apps/*` globs;
`build.test.ts`'s `DISTRIBUTION` and `DECLARED_FILES` registers; `README.md:74`'s
`for p in shared core cli` pack loop; `build-fixture.test.ts`, which reads `packages/shared`'s build
script by name rather than through `emitting()`. All eleven checked rather than assumed.

---

## 8. Gate obligations

**GO-1 — the decision entry, before the run.** §3. The human's, unconditionally; `docs/decisions/`
is outside `developer-generalist`'s paths and that role's instructions name it as the first example
of `blocked`. **AC-7 is unsatisfiable until it lands**, because that criterion requires the glossary
to cite it by title and date — stated here rather than discovered, because a loop handed work no
step in it can perform is the failure this repository has recorded fifteen times, most sharply on
Q-0062, whose requirement named the hazard in advance and whose run was launched without the entry
anyway. Verify the entry is present in the implement step's actual prompt rather than assuming it,
which is the check Q-0097 lost two errata by not making.

**GO-2 — the term lists, only if a term is coined.** §0.6 measures this as conditional: three of the
last five glossary terms landed without either list moving. If OQ-2 is answered by coining, both
`CLAUDE.md` and `docs/README.md` move in the same change and on the integration branch, because
`docs.test.ts` compares them **ordered** and a partial move leaves `main` red — the sequencing
Q-0067's GO-2 had to perform. Recommendation: coin nothing, and this obligation is discharged by
recording that.

**GO-3 — the successors, opened at this gate with their bodies in full.** Appendix A (the static
route) and Appendix B (the packed install's UI, and `quorum open` having no ticket). Opened as
tickets rather than left in this document, because three obligations found in one week — Q-0110's,
Q-0111's and Q-0112's — had lived only inside a closed ticket's prose or a source comment, one of
them since 2026-09-02. Q-0123 is the highest allocated id; the allocator answers the next two.

**GO-4 — verification in both environment rows, forced.** Q-0072's closing finding: the implement
worktree has neither `.harness/worktrees` nor `.quorum/runs`, and `main` after the merge has both.
`pnpm turbo run test --force --continue` in each, plus `pnpm lint`, `quorum lint` and
`pnpm sweep:git-identity`. This ticket adds a build task, so **`pnpm turbo run build --force` is run
in both rows as well** and the four-package wall-clock is recorded — the cold-clone figure R-3 wants.

**GO-5 — mutation rather than a bare approve.** Against 108 `revise` to 37 `approve` across 145
review verdicts, a first-round approve on a change of this shape is distrusted (Q-0051). The
mutations that discriminate: remove the `build` script and the five AC-4 sites fail naming the
package; add `^build` to the root `test` task and AC-2 fails; make the build write one file outside
`dist/` and the census names it; delete the AC-5 row and clause B names `apps/web`; quote
`` `dist/**` `` a second time in the architecture document and `docs.test.ts`'s Q-0097 clause fails
with the occurrence count.

---

## 9. Risks

**R-1 — no user-visible consumer.** Under the split this ticket ships a build task nothing serves.
Stated rather than mitigated away, as Q-0121's R-1 was: the alternative — bundling the screen, or
here the route — is what turned Q-0013 into three tickets and Q-0014 into two. What it leaves behind
is real: four registers that agree, a vocabulary that distinguishes emitting from shipping, and an
artifact the successor has a subject to serve.

**R-2 — two expensive suites gain a build they do not want.** §0.3. `end-to-end.test.ts` and
`failure-paths.test.ts` are among the slowest files in the workspace and both carry timeouts
measured against three `tsc` builds. AC-6 and OQ-3 are the response; the risk is that the answer is
taken by reading rather than by measuring.

**R-3 — the isolated copy may not build, and this requirement did not run one.** `isolate()` copies
git-visible files plus root `globalDependencies`, and mirrors `node_modules` as a directory of
symlinks with the `@quorum` scope re-pointed at the copy. `apps/web/node_modules/.bin` is empty
today and `vite` resolves from the workspace root by directory walk, so whether `vite build` runs to
completion inside such a copy is **unproven**. It is the first thing to measure, before any criterion
is worked on, because if it does not the answer is OQ-3's narrowing rather than a repair.

**R-4 — the census is the strictest gate in the repository and it prunes nothing.**
`build.test.ts`'s isolated audit descends into the copy's `node_modules` and fingerprints by size,
mtime and bytes, so anything Vite or `@tailwindcss/vite` writes outside `apps/web/dist/` — a
`node_modules/.vite` cache, a temporary file — is reported by name, and anything it removes is
reported separately. The real-workspace walk prunes `node_modules` and says why; the copy does not.

**R-5 — a cache hit can now replay a page.** 078's hazard acquires a second site, and this one is
served to a browser rather than executed by Node. AC-3(b) is the narrow guard; the wider one is that
the entry GO-1 lands says so, so the next reader meets the warning in the vocabulary rather than
discovering it.

**R-6 — a documentation edit can turn the suite red for a reason unrelated to the change.** §0.8:
`` `dist/**` `` exactly once, and `build task, emitted artifact` contiguous in `docs/README.md`.
Both are cheap to trip and neither failure names this ticket.

**R-7 — POSIX-only.** Registered by Q-0098 across all three existing build scripts and not lifted
here. All CI jobs are `ubuntu-latest` and this repository has never claimed Windows support.

---

## 10. Cross-cutting checklist

- **BYOS** — n/a to the mechanism, and covered anyway: `apps/web/test/package.test.ts`'s credential
  scan reads **every** file in the package, the new build script included, and asserts the needles
  discriminate. No new code path accepts a subscription, a login or a key, and the word for what
  authenticates an agent stays **subscription**.
- **Worktree safety** — no flow writes anything here. The build writes only `apps/web/dist/`, which
  is gitignored and inside the package; AC-3 is what proves it, and the census is what would report
  a write into `.harness/`, `.quorum/` or `.git`.
- **Gate behaviour** — unchanged. No gate, no verdict vocabulary, no backward edge; the exhaustion
  gate's three answers are untouched.
- **File format and its schema** — none. No zod schema moves, no wire shape moves, nothing is
  persisted. `@quorum/shared`'s barrel is unchanged under the recommended split.
- **Lint rules** — none added. `eslint.config.js` already ignores `**/dist/**`, so the bundle is
  never linted and the three enforced rules keep exactly the corpus Q-0014 gave them.
- **Cold-clone impact** — the workspace-local path gains one build task: `pnpm turbo run build`
  builds four packages instead of three, and GO-4 records the measured difference. The packed path
  is unchanged and still has no UI, which is Appendix B rather than a silence. No document, test
  name or message may claim a cold machine can obtain Quorum from the public registry.
- **Product-agnostic** — nothing here names a SaaS product.
- **Vocabulary** — no term is coined (recommended). Note for whoever writes the prose: after the
  ruling, *"bundle"* describes the **shape** of what Vite writes and is never a synonym for
  **emitted artifact**; **build task** is not a pipeline, a job or a step; and the daemon serves the
  emitted artifact rather than "the frontend" or "the client".

---

## Appendix A — Successor: the daemon serves the built web app

*Transcribed in full rather than referenced, per GO-3. Allocate at the allocator's next id; Q-0123
is the highest today. Runs after Q-0122, which is what gives it a subject. **p2.** Route: chore —
no contract, no red test, and the criteria are the whole specification — unless its own gate
measures otherwise, since a new response for every path on the daemon is behaviour rather than
machinery.*

**Problem.** `docs/04-architecture.md:190–191` has said since 2026-08-22 that the server serves
`apps/web`'s build output. After Q-0122 the output exists and `packages/server` still opens no file:
no `serveStatic`, `sendFile` or `createReadStream` appears anywhere in its production source.

**The central design question, and it is not the one the parent body asked.** Hono matches a
registered path pattern rather than a prefix, so prefix-shadowing is the Vite proxy's problem and
not the daemon's. What the daemon has is **exact collision**: four of the shell's twelve paths in
`apps/web/src/routes.ts` are literally daemon `GET` routes — `/flows`, `/runs`, `/runs/:handle`
against `GET /runs/:id`, and `/history`. A handler that returns a response ends the chain, so **a
fallback registered after the JSON routes is never reached for those four**, and a browser reloading
on a deep link gets JSON. That is Q-0120 review round 1's B-1 reproduced in the shipped product,
where it was *"seven of twelve routes 404 on a reload while in-app navigation kept working and hid
it"*. The other eight shell paths are unclaimed and a fallback serves them.

So the matching rule must discriminate on something other than the path, and it must sit ahead of
the JSON routes. **That mechanism is already shipped in this product**:
`apps/web/vite.config.ts:49–50`'s `bypassNavigation` keys on
`req.method === 'GET' && req.headers.accept?.includes('text/html')`, because a top-level browser
navigation requests `text/html` where a same-origin `fetch` of the daemon's JSON and the run-events
WebSocket upgrade do not. It has **no test** today.

**The rule this successor should state once and implement once.** (1) A request naming a file under
the bundle root is answered with that file, whatever its `Accept` — which is how `/assets/*` works,
and which collides with nothing, since no daemon route names a path that exists as a file. (2)
Otherwise, a `GET` whose `Accept` includes `text/html` is answered with `index.html`, and the
shell's own Not found view is what tells a human the path is unknown — `apps/web/src/app.tsx:140`
already renders it and `shell.test.ts:222` already proves it. (3) Otherwise the request falls through
to the JSON routes and their 404s, so a client that fetched a mistyped daemon path still gets a JSON
refusal rather than a page. Rules (1) and (2) sit ahead of the JSON routes; rule (3) is the
fall-through.

**Measured before that rule was written.** `@hono/node-server`'s `serveStatic` takes a `root`
*"relative to current working directory from which the app was started"* and *"Absolute paths are
not supported"* — read from the installed `dist/serve-static.d.ts` at 1.19.17. The daemon's cwd is
the operator's project root; the bundle's location is package-relative. A root computed from the cwd
would make the daemon's behaviour a property of the directory it was started in, which
*"A test's verdict is a property of the commit, not of the checkout or the account"* (2026-08-30)
refuses. So either the bundle root arrives as an explicit option and is not discovered, or the route
reads the file itself. **Recommendation: an explicit option.** `packages/server` must not import
`apps/web` — `04-architecture.md` is explicit that the dependency cannot exist in either direction —
so the server cannot resolve the app's location at all, and a `bundleRoot` parameter on
`serve`/`createDaemon` puts the question where it belongs: with whoever starts the daemon. Absent
the option the daemon serves the API only and says nothing it cannot back.

**Draft criteria, seven.**

1. **The bundle root is supplied, never discovered, and its absence is a state rather than a
   failure.** `serve`/`createDaemon` take it; with it absent every existing route behaves exactly as
   it does today and no HTML is ever answered. *Test:* a host served with no bundle root answers the
   eleven routes unchanged and answers a navigation with the same 404 it answers today; a host served
   with one answers `index.html`. Neither behaviour is inferred from the other.
2. **Every one of the shell's twelve paths is reachable by a top-level navigation**, including the
   four that are exactly daemon routes. *Test:* a `GET` with `Accept: text/html` to each of the
   twelve paths in `ROUTES` — read from the register rather than transcribed, so a thirteenth path is
   covered without anyone remembering — returns the bundle's `index.html`. Shown red against a
   fallback registered after the JSON routes, which serves eight and fails four.
3. **Nothing that is not a navigation ever receives HTML.** *Test:* each of the eleven registered
   JSON routes, requested with `Accept: application/json` and with `*/*`, answers exactly what it
   answers today — status, body and content type — and `GET /runs/:id/events` still upgrades to a
   WebSocket and still carries one event per message, the fallback passing it through rather than
   consuming it.
4. **No path outside the bundle root is served.** *Test:* `..` traversal in every encoding the
   router will deliver, and a symlink inside the bundle root whose target is outside it, are both
   refused — resolved with `realpathSync` and compared component by component, which is
   **Confinement** as `docs/GLOSSARY.md` defines it and as `packages/core/src/backlog/confine.ts`
   implements it for the backlog root. This is the criterion that earns the ticket its own gate: the
   daemon has no authentication of any kind, binds loopback and is started inside a git repository,
   so a static route is the first surface here that turns a URL into a file read. A dangling symlink
   is the case Q-0059's review round 2 found as a blocker and it is named here in advance.
5. **The navigation predicate has exactly one definition in the workspace, and both the dev server
   and the daemon reach it.** *Test:* a scan finds one definition; `apps/web/vite.config.ts` and
   `packages/server` both import it; neither package imports the other. Satisfiable only from
   `@quorum/shared`, which is the sole package both depend on — and that is the precedent
   `04-architecture.md` already states for the frame union: *"both ends need it and only one end can
   reach this package"*. A pure `(method, accept) => boolean` is browser-safe by construction, so
   `packages/shared/src/index.test.ts`'s browser-capability scan is unaffected. The predicate gains
   the case table it has never had, and the dev server's rule stops being untested.
6. **The route register and the architecture document move with the code.** *Test:*
   `packages/server/src/package.test.ts`'s `registeredRoutes()` derivation names the new route, and
   `04-architecture.md`'s `packages/server` section names it in backticks — which that guard already
   enforces. **Note the trap**: that derivation matches `app.get|post|put|patch|delete` with a
   **quoted literal** first argument, so a mount registered as `app.use(...)` is invisible to it and
   a non-literal path fails its `unquoted` clause with *"a route is registered at a path this guard
   cannot read"*. Register the route as `app.get` with a literal, or extend the derivation to `use`
   in the same change and show the extension red. A guard blind to its own subject is the family
   this repository has recorded most often.
7. **The documents say what shipped.** The *"What remains owed is serving `apps/web`'s build
   output"* sentence at `:190–191` and the `apps/web` paragraph at `:233` both move; the matching
   rule is stated once on that page rather than transcribed into two packages' comments; the status
   line records the ticket and the date. *Test:* a `docs.test.ts` clause over the section, shown red
   over the current wording.

**Non-goals.** `quorum open`; any screen; serving anything other than `apps/web`'s emit; a
non-loopback bind, which `serve.ts:28` settles and which a flag whose only use is to make the
product unsafe would reopen; authentication, CORS or any header of that family, which
`packages/server/src/package.test.ts:152` currently forbids outright; compression, caching headers or
a service worker; and making a packed install serve anything (Appendix B).

**Open questions for its gate.** Is a decision entry owed? Probably not — Hono is
`04-architecture.md`'s choice from 2026-08-22 and *"serves the built `apps/web`"* is that page's own
sentence, so executing a landed document is not changing the architecture (Q-0013 OQ-3). What is
worth asking explicitly is whether answering `index.html` for an unrecognised navigation is a
**silent default** under *"Errors are explicit. Never default silently"*; the answer offered is that
it is not, because the shell's Not found view names the path it could not match, and because rule
(3) keeps a non-navigation refusal explicit — but it is the gate's to rule rather than an
implementer's. Second: whether `packages/server` gaining its first `node:fs` read needs recording,
given it imports `node:path` today and no guard forbids the other.

---

## Appendix B — Successor: how an installation outside the workspace obtains the UI

*Transcribed in full per GO-3. **p2**, and it is the adopter's ticket rather than the maintainer's.*

**Problem, in two halves that belong together.**

**(a) After Q-0122 and Appendix A, a packed install still has no web app.** The local distribution
set is three tarballs — `@quorum/shared`, `@quorum/core`, `@quorum/cli` (`README.md:74`,
`harness/product-context.md:78`, `docs/04-architecture.md:11`) — and `apps/web` is `private: true`
with no `files` and no `exports`. So the workspace-local path has a UI and the **locally packed path,
which is one of the two installation paths this repository claims and tests, does not.** That is a
gap in the cold-clone story M6 turns on, and nothing records it today.

**(b) M3's done-when names `quorum open` — *"starts daemon + browser; CLI and UI can both answer the
same gate"* — and no ticket in this milestone builds it.** Measured: M3's ticket list is Q-0013 to
Q-0019 plus Q-0118 to Q-0123, and none of them is `quorum open`; `packages/cli` declares only
`@quorum/core` and `@quorum/shared`, so nothing in the CLI can start a daemon at all. This is the
shape this page records seven directions of — an obligation living in a done-when rather than in a
ticket — and it is worth one line in the plan whatever this ticket decides.

**What it must decide, with the two shapes measured rather than listed.** Either `@quorum/web`
becomes a **fourth tarball**, which makes the local distribution set four and moves `README.md`'s
pack loop, `harness/product-context.md`'s pillar 7, `04-architecture.md:11` and `:137`,
`build.test.ts`'s `DISTRIBUTION` and `DECLARED_FILES` registers and
`packages/server/src/package.test.ts:139`'s claim — and requires the app to stop being
`private: true`, which collides with 078(d)'s refusal of registry resolution until Q-0029; **or**
`@quorum/cli` ships the bundle beside its templates, which is Q-0093's precedent
(`packages/cli/templates/harness/`, `files: ["dist", "templates"]`) and which requires **one
package's emitted artifact to become a tracked or copied asset of another** — a write
`packages/cli/src/build.test.ts`'s census reports by construction, since it asserts that the build
wrote nothing outside every emitting package's own `dist/`.

**Neither is cheap and neither is this ticket's to pick in passing**, which is why it is a ticket.
It probably owes a decision entry: both shapes change what the local distribution set is, which
*"The emit serves the binary, and no test verdict moves behind it"* (2026-09-02) clause (e) and the
**Emitted artifact** term both state — and Q-0122's own entry will have just separated the emitting
set from the distribution set, so this is the next question that separation raises.

**Start by measuring, not by choosing.** How large is the bundle; whether a tarball carrying it
lengthens the cold-clone install (Q-0014's GO-4 measured the store install doubling to 10.4 s and
+50 MB for the app's dependencies alone); and whether the census can express a cross-package asset
copy at all, or whether the answer is that the CLI's `build` script produces it rather than copying
it. **Read Q-0122's entry first**, and `04-architecture.md`'s *"What a cache hit gives back"*
paragraph second.
