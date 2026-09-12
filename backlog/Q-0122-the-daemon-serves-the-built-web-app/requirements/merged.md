# Q-0122 — The daemon serves the built web app

*Merged requirement, run 1, iteration 2. Iteration 1 returned `needs-input` on two blockers. This
iteration opened on an **unchanged tree** and says so first, because a retry on an unchanged tree
cannot rule its own blocker (Q-0090, Q-0096, Q-0105). What it did instead is re-run every
measurement iteration 1 rested a criterion on: three hold verbatim, **three were wrong and are
corrected**, and one criterion is strengthened from conditional to unconditional.*

**Verdict: `needs-input`, on the same two blockers, both of which stand on the merits.** The merged
work is twenty independently testable criteria against a ceiling of fifteen, the eighteen Q-0013 was
refused at, and the twenty-one that split Q-0091 and Q-0096. And the vocabulary ruling is a decision
entry `developer-generalist` may not write, without which **AC-7 is unsatisfiable**.

**The recommendation iteration 1 could not make, and the most useful sentence here: answer this gate
with `advance`, not `retry`.** Both blockers are work no step in this flow may perform — the split
needs an id allocated and the entry needs `docs/decisions/`. A third iteration would be the
**seventeenth** appearance of a loop handed work no agent in it can perform, and the first where the
document being retried predicted it in advance. Q-0070, Q-0079 and Q-0096 each advanced from here.

---

## 0. What iteration 2 measured

### 0.0 The tree has not moved

`git log -1` is `d18cde8`, the commit that re-measured this ticket's body before the run.
`docs/decisions/` ends at **091**. `Q-0123` is still the highest allocated id, so no successor exists
for the serve half. `ticket.md` is untouched since run start.

### 0.1 Three of iteration 1's load-bearing measurements hold verbatim

- **`serveStatic`'s root is cwd-relative.** `@hono/node-server` 1.19.17,
  `dist/serve-static.d.ts:5`: *"Root path, relative to current working directory from which the app
  was started. Absolute paths are not supported."* Quoted correctly, and it is what makes Appendix
  A's explicit-option shape forced rather than preferred.
- **Exactly four GET collisions.** The shell registers twelve paths (`/`, `/projects`, `/backlog`,
  `/backlog/:ticketId`, `/harness`, `/flows`, `/runs`, `/runs/:handle`, `/runs/:handle/gate`,
  `/runs/:handle/steps/:stepId`, `/history`, `/settings`); the daemon registers eleven routes. The
  four claimed by a daemon `GET` are `/flows`, `/runs`, `/runs/:handle` against `GET /runs/:id`, and
  `/history`. `HOME_PATH` is `/projects` against the daemon's `GET /project`, which under Hono's
  exact-pattern matching is **not** a collision — the distinction iteration 1 drew against both
  candidates' *"overlap"* and *"matches too broadly"*, and it holds.
- **`emitting()` is reached at thirteen sites in `build.test.ts`** — `:144`, `:360`, `:558`, `:584`,
  `:603`, `:624`, `:635`, `:666`, `:838`, `:858`, `:905`, `:910`, `:1094` — and is derived rather
  than hand-written (`packages/cli/test/workspace.ts:107`).
- Re-confirmed: `apps/web/test/package.test.ts:136` and `:210` are the two non-emitting assertions;
  the three sibling `NOT_READ` rows exist at `turbo-inputs.test.ts:319–321`; no `'apps/web'` literal
  exists in any `packages/core` test today.

### 0.2 Correction 1 — `isolate()` has three consumers outside `build.test.ts`, not two

`packages/cli/src/step-id.test.ts:108–109` is `const root = isolate(); buildIn(root, '--force');`,
and it **throws** if the built binary is absent — *"the isolated build wrote no … there is nothing to
spawn"*. Its `FIXTURE_TIMEOUT_MS` is **180_000**. So three suites outside the build audit copy every
emitting package and build it, and all three spawn the **binary**: `end-to-end.test.ts:328`,
`failure-paths.test.ts:429`, `step-id.test.ts:108`.

**Why it was missed is worth more than the count.** Iteration 1 found the other two by grepping the
prose *"three emitting packages"*, which `end-to-end.test.ts:79` and `failure-paths.test.ts:133`
carry and `step-id.test.ts` does not. That is a search keyed on a **name** rather than on the
**behaviour** — the family this repository has recorded six times (Q-0051, Q-0067, Q-0073, Q-0107,
Q-0108, Q-0115) — committed inside the document that names it. Found here by grepping `isolate(`.
**AC-6 is corrected to name three**: a criterion naming a list is satisfied by fixing two of three,
which is the failure AC-4 was written to avoid and which AC-6 then committed.

### 0.3 Correction 2 — the glossary defines 36 terms, not 34 and not 38

Counted at the term headings: **36**. Candidate `claude` said 38; **iteration 1 corrected it to 34
and made a point of the correction in its own Provenance section**. Both are wrong. That is Q-0099's
recorded shape — *a correction that was itself wrong, travelled one document further by being
copied* — and it is recorded rather than quietly fixed, because the section carrying it was the one
claiming the measurement had been re-derived.

**The conclusion is unaffected and is re-stated on the corrected arithmetic.** 36 glossary terms
against **22** in each of `CLAUDE.md:13` and `docs/README.md`, byte-identical to one another, with
**Confinement**, **Run lock** and **Connection state** in neither. The two lists are a curated
subset; coining a term does not mechanically move `CLAUDE.md`. GO-2 stays conditional.

### 0.4 Correction 3 — AC-5's hedge is struck, and the criterion is stronger without it

Iteration 1 wrote AC-5 with an escape: *"Where the measurement shows the literal is not collected at
all … no row is added."* That makes it conditionally testable, and it is unnecessary. The three
sibling rows **are** the proof: `packages/core`, `packages/cli` and `packages/shared` are each a
tracked directory prefix containing a `/`, each was collected by `pathLiterals` when the emitting
register named it, and each needed excusing. `apps/web` is the same shape and the inventory holds it.

### 0.5 Two documentation constraints, re-confirmed

`` `dist/**` `` may appear **exactly once** in `docs/04-architecture.md` (`docs.test.ts` reads the
root `turbo.json`'s `outputs` and asserts `occurrences === 1`), and `docs/README.md` must keep the
contiguous substring `build task, emitted artifact`. Both are cheap to trip and neither failure names
this ticket.

---

## 1. Problem

`docs/04-architecture.md:190–191` has said since 2026-08-22 that the server serves `apps/web`'s build
output, and M3's done-when includes `quorum open` starting the daemon and a browser. Neither half
exists: `apps/web` declares no `build` script, so there is nothing to serve, and `packages/server`
opens no file — no `serveStatic`, `sendFile` or `createReadStream` in its production source. Three
live sites record the gap and route it here by ticket id: `:190–191`, `:233`, and
`apps/web/vite.config.ts`'s own header.

Underneath the two missing pieces is the vocabulary question Q-0014's gate deferred here rather than
answering inside a shell. **Emitted artifact** says emitted artifacts are *"The JavaScript and
declaration files a build task writes under a package's `dist/`"*, that the three emitting packages
*"[are] also the local distribution set"*, and that an emitted artifact *"is not a 'bundle'"*. A Vite
build falsifies all three at once: it is bundled, it is not declarations, and it is served rather
than packed. **The two facts that sentence conflates — what emits and what ships — stop being the
same set the moment a fourth package emits**, and until they are separated no criterion, comment or
document can say truthfully which is which. Two live comments already conflate them
(`harness/product-context.md:78`, `packages/server/src/package.test.ts:139–140`).

---

## 2. User stories

**`maintainer`.** *I want one workspace command to produce something the daemon can serve, and the
registers that decide what this workspace emits to agree about it afterwards — rather than four
assertions going red and three suites that spawn the binary quietly gaining a Vite build.*

**`contributor`.** *I want to know from one sentence which packages emit and which ones ship, because
they are no longer the same list. When I add a fifth emitting package I want the registers to fail
closed and name it, which is what decision 078(c) promised in as many words.*

**`adopter`.** *This ticket does not serve me, and saying so is the point.* `apps/web` stays
`private: true` with no `files` and no `exports`, so after this ticket **and** after Appendix A a
locally packed install still has no web app — one of the two installation paths this repository
claims and tests. That obligation has no ticket, and neither does `quorum open`. Both are Appendix B.

---

## 3. The ruling this ticket owes (GO-1)

**A decision entry is owed before a line of code**, because *"The emit serves the binary, and no test
verdict moves behind it"* (2026-09-02) is contradicted in two places by a fourth emitter: **078(a)**'s
*"No bundler and no new dependency"* — a Vite build is a bundler, though no **new** dependency
arrives — and **078's Why**, whose containment argument is that the emit *"is consumed by exactly one
thing, the binary, and by exactly one suite"*. A served bundle is a second consumer. 078
**anticipated** this: (c) says the derived register *"fails closed when a fifth package starts
emitting"*, which is the mechanism §0.1 measures firing. The entry **extends** 078 and must name it
by title and date.

**What it should rule**, offered so the human can write it quickly:

1. **A fourth package emits, and what it emits is served rather than shipped.** Emitting set four;
   local distribution set three. `apps/web` keeps `private: true`, declares no `exports`, `files` or
   `bin`.
2. **The served bundle is an emitted artifact** — widen the term rather than coin a third kind. What
   makes the term load-bearing is 078's own hazard, a non-empty `outputs` replaying an *artifact*,
   and the bundle has that hazard in its sharpest form; a third kind would put the thing most at risk
   **outside** the vocabulary that carries the warning. OQ-2 records the alternative.
3. **A bundler is admissible for the fourth emitter**; 078(a)'s *"no bundler"* is scoped to the three
   `tsc` emitters it was written about.
4. **078(b) holds unchanged** — no `^build` edge on `test` or `typecheck`. AC-2 is the guard.
5. **The new hazard is a stale page**, the same class as Q-0098's shebang: the tick lies about the
   past, the artifact lies about the present. AC-3(b) is the narrow guard.
6. **No glossary term is coined**, so neither 22-term list moves.

Working title: *"A fourth package emits, and what it emits is served rather than shipped."*

`docs/GLOSSARY.md`, `docs/04-architecture.md` and `harness/product-context.md` are inside
`developer-generalist`'s `paths:` and may be criteria. `docs/decisions/` is not — that role names it
as the first example of `blocked` — and `CLAUDE.md` is not in those paths at all.

---

## 4. Acceptance criteria

*Eleven, under the recommended split. If the gate refuses OQ-1, Appendix A's nine are promoted and
the total is twenty — two past what refused Q-0013.*

**AC-1 — `apps/web` declares a `build` script, and the root task is untouched.** Root `turbo.json`'s
`tasks.build` stays `outputs: ["dist/**"]`, `dependsOn: ["^build"]`, and `apps/web` declares either
no package-level `turbo.json` or one declaring `inputs` and nothing else.
*Test:* `dry('build').tasks` filtered on `command !== NO_SCRIPT` returns **four** tasks including
`@quorum/web#build`; each has `resolvedTaskDefinition.outputs` equal to the root's declared patterns
and `dependsOn` equal to `['^build']`, which is `build.test.ts:360`'s existing clause now covering a
fourth task; the *"every package-level configuration declares `inputs` and no other key"* clause
still passes; and a forced build writes at least one file under `apps/web/dist/`, so the task is not
satisfied by a script that emits nothing.

**AC-2 — no verdict that exists today moves behind the fourth emitter.** *Test:* for every task in
`dry('test').tasks`, `resolvedTaskDefinition.dependsOn` does not contain `^build` and `outputs` is
`[]`, resolved **through turbo** rather than read off the file; the task list is asserted to
**contain** `@quorum/web#test`, so the clause is shown non-vacuous for the package this ticket
changes; and both halves are demonstrated red by adding `^build` to the root `test` task in an
isolated copy.

**AC-3 — the build writes its emit, nothing else, and does not leave what its source no longer
produces.** *Test:* **(a)** `build.test.ts`'s whole-copy isolated census passes with four emitters —
every path `@quorum/web#build` wrote is under `apps/web/dist/`, `dist/**` matches at least one, and
the audit reports no path written outside any emitting package's `dist/` and no tracked or unignored
path removed. **(b)** A file placed in the copy's `apps/web/dist/` that the build does not produce is
**gone** after a forced rebuild — the property `rm -rf dist &&` gives the other three, demonstrated
rather than inherited, because `build-fixture.test.ts`'s own header records that turbo prunes an
output directory on neither the miss path nor the hit path.

**AC-4 — the four assertions this change falsifies are moved, each shown red before green.** Named
individually, because a list is satisfied by fixing three of four:
`test-discovery.test.ts`'s Q-0097 AC-13 emitting register; the stub clause below it (*"`${pkg}`
declares a build script and emits nothing"*); `apps/web/test/package.test.ts:136` (*"the app remains
non-emitting"*); and `:210`. *Test:* each shown failing against the pre-change guard with a message
naming the package, and passing after. The register stays an **identity** — `toStrictEqual` over four
sorted entries led by `'apps/web'` — and never becomes a count (Q-0073, *"a count is not an
identity"*).

**AC-5 — `turbo-inputs.test.ts` answers the new `'apps/web'` literal, and the answer is
load-bearing.** *Corrected at iteration 2: owed unconditionally.* Either a fourth `NOT_READ` row
beside `:319–321`, carrying the same reasoning those three carry, or a declaration in
`packages/core/turbo.json` — **not both**, which is the over-declaration Q-0121 measured and deleted.
*Test:* clauses A and B both pass; the register's own *"a key the scan cannot see excuses nothing"*
clause still passes over the new row; and the answer is shown load-bearing by removing it and
watching clause B fail **naming `apps/web`**.

**AC-6 — what `isolate()` builds is decided, and the THREE suites that spawn the binary are
re-measured.** *Corrected at iteration 2 from two.* The three are `end-to-end.test.ts:328`,
`failure-paths.test.ts:429` and **`step-id.test.ts:108`**, the last of which carries no *"three
emitting packages"* docblock and is therefore invisible to the search that found the other two.
*Test:* all three pass; the implement report states which shape was taken — `isolate()` goes on
building every emitting package, or it takes the local distribution set and `build.test.ts` asks for
every emitter explicitly — and gives the **measured** wall-clock of the isolated build under each of
the three, so the two docblocks describing *"the forced build of the three emitting packages"* are
re-derived rather than left describing a build that no longer happens, and `step-id.test.ts`'s 180 s
budget is re-measured even though it carries no such sentence. Where a timeout constant moves, the
new value is stated as a multiple of the measured worst case.

**AC-7 — the glossary states what emits and what ships as two facts, and coins nothing.** *Test:*
**Emitted artifact** no longer equates the emitting set with the local distribution set; both sets
are named with their members and the difference is stated; the *"not a 'bundle'"* clause is
**re-scoped rather than deleted**, so it still forbids calling `packages/core`'s `dist/index.js` a
bundle while no longer denying that `apps/web`'s emit is one; **Build task**'s *"run in the three
packages that emit"* moves; the entry GO-1 landed is cited **by title and date, never by file name or
number**; the two clauses `docs.test.ts` pins survive verbatim; the two 22-term lists are
byte-identical afterwards; and `docs/README.md` keeps the contiguous substring
`build task, emitted artifact`. **Unsatisfiable until GO-1 lands.**

**AC-8 — the architecture document says what shipped, and says `dist/**` once.** *Test:* the four
prose sites move — `:11` (*"`pnpm pack` in each of the three emitting packages"*, the packed set
called by the emitting set's name), `:190–191`, `:193`, and `:233`'s *"The app emits nothing"*
sentence; `` `dist/**` `` occurs **exactly once**; the status line records `Q-0122` and the landing
date; and a new `docs.test.ts` clause holds the `apps/web` section against the claim that the app
emits, shown red over the current wording. The landed Q-0014 and Q-0120 anchors over that section
still pass. Under the split this document must **not** claim the output is served — a document
promising a route that does not exist is the failure this plan records most.

**AC-9 — `harness/product-context.md`'s pillar 7 stops calling the packed set the emitting set.**
*Test:* `:78` names the three **distribution** packages; the two claimed installation paths and the
refusal of registry-resolved `npx quorum` are unchanged — no claim gained or lost, only the set named
correctly. It matters more than an ordinary comment because this file is fed to every
product-manager step at run time.

**AC-10 — the manifest declares what the build needs, each with a reason.** Measured: `apps/web`
declares `@vitejs/plugin-react`, `@tailwindcss/vite`, `tailwindcss`, `jsdom` and two type packages,
and **no `vite`**; the root manifest declares `vite@^8.2.2`, so `vite.config.ts`'s own import
resolves today by walking up to the workspace root. *Test:* whatever the build resolves is declared
where the build runs, and `apps/web/test/package.test.ts`'s `JUSTIFICATIONS` register agrees with the
manifest in **both** directions. `dependencies` stays exactly
`['@quorum/shared', 'react', 'react-dom']`, so nothing new ships to a browser. The lockfile moved
with the manifest, which is what keeps `pnpm install --frozen-lockfile` from failing after the
implement step has been paid for.

**AC-11 — emitting is not shipping, asserted on the manifests as well as in prose.** *Test:*
`apps/web` keeps `private: true` and declares no `exports`, `main`, `types`, `files` or `bin`;
`build.test.ts`'s `DISTRIBUTION` register is still `['cli','core','shared']` and `DECLARED_FILES` is
unmoved; and `packages/server/src/package.test.ts:139–140`'s comment is corrected where it conflates
the two sets, its assertions being unaffected.

---

## 5. Non-goals

1. **The static route and everything about serving** — Appendix A's successor. Void if OQ-1 is
   refused.
2. **`quorum open`.** No ticket in M3 builds it (Appendix B); `packages/cli` declares no dependency
   on `@quorum/server`.
3. **Any screen** — Q-0015 to Q-0018, and M4's editors.
4. **Making a packed install serve a UI** — Appendix B.
5. **Publishing.** Registry-resolved `npx quorum` is refused rather than deferred (078(d)), Q-0029's
   in M6. No test name, message or document may claim otherwise.
6. **Widening `testFilesIn` to `.test.tsx`** — Q-0014's R-3, not taken here.
7. **Any change to the root `build` task's `outputs`, `dependsOn` or `env`**, or to root
   `turbo.json` as the one place `env` is decided.
8. **A `^build` edge on `test` or `typecheck`** — 078(b); AC-2 is the guard.
9. **Coining a glossary term** (§3). If the gate coins one anyway, both 22-term lists move in the
   same change on the integration branch (GO-2).
10. **Windows.** The three existing build scripts open with `rm -rf`, registered POSIX-only by
    Q-0098; a fourth is under that registered limit and does not lift it.
11. **A `public/` directory, a non-`/` `base`, or a service worker.**
12. **Changing the shell's route register, the daemon's routes, or any REST, refusal, WebSocket frame
    or gate-answer contract.**
13. **Chunking or asset-size optimisation**, and replacing Vite.

---

## 6. Open questions

**OQ-1 — one ticket or two? BLOCKING. Recommendation: two.** The emit half is §4's eleven; the serve
half is Appendix A's nine. **Twenty** is past the fifteen this role uses, past the **eighteen Q-0013
was refused at**, and approaching the twenty-one that split Q-0091 and Q-0096 — each at a gate and
each at cost. The seam is measured: the emit half touches `apps/web`, four registers in
`packages/cli` and `packages/core`, and three documents, and has no design question left once GO-1
lands; the serve half touches `packages/server` alone, carries the exact-collision question and the
cwd measurement, and adds a **new capability** — turning a URL into a file read, from a process with
no authentication of any kind — which wants its own confinement criterion and its own gate. Nothing
is delayed: no screen consumes either half, and the successor's first criterion has no subject until
a bundle exists.

**OQ-2 — widen **Emitted artifact**, or coin a third kind? BLOCKING; the human's, at GO-1.
Recommendation: widen.** §3(2) carries the argument. The alternative is defensible and recorded
rather than dismissed: a bundle is served rather than resolved, so 078(b)'s *"what Node and a packed
install resolve"* stays literally true of the three. What decides it is which reading leaves the
**hazard** covered. §0.3 removes the cost argument in both directions on corrected arithmetic, so it
is settled on vocabulary cohesion and nothing else. **AC-7 is unsatisfiable until the entry lands.**

**OQ-3 — what does `isolate()` build? Not blocking; AC-6 admits either answer provided the report
says which and gives the measurement for all three suites. Recommendation: parameterise**, defaulting
to the distribution set with `build.test.ts` asking for every emitter explicitly. **Measure before
choosing**: if a forced Vite build inside the copy costs a second or two, leaving `isolate()` alone
and re-deriving the budgets is the honest answer.

**OQ-4 — does `apps/web` declare `vite` directly? Not blocking; AC-10 covers either.
Recommendation: yes** — it imports `vite` and resolves it by directory walk today, and
`@vitejs/plugin-react` and `@tailwindcss/vite` both take it as a peer.

**OQ-5 — a package-level `turbo.json`? Not blocking. Recommendation: no, and measure first.**
Q-0121 wrote one, measured it unnecessary and deleted it, recording both hashes.

**OQ-6 — cache headers for static responses.** Appendix A's solutioning, not this ticket's. A
long-lived cache on `index.html` would be 078's replayed-artifact hazard arriving a third time, in
the browser, so it is named rather than left.

---

## 7. What moves

**Red today, green after — all four shown red first:** `test-discovery.test.ts`'s Q-0097 AC-13
emitting register and the stub clause below it; `apps/web/test/package.test.ts:136` and `:210`.

**Must answer for a new literal:** `turbo-inputs.test.ts` clause B (AC-5), unconditionally.

**Behaviour extends to a fourth task:** `build.test.ts` at `:144`, `:360`, `:558`, `:584`, `:603`,
`:624`, `:635`, `:666`, `:838`, `:858`, `:905`, `:910`, `:1094`; and `workspace.ts:196` via
`isolate()`, reaching `end-to-end.test.ts`, `failure-paths.test.ts` **and `step-id.test.ts`**.

**Prose that becomes false:** `docs/GLOSSARY.md` **Build task** and **Emitted artifact**;
`docs/04-architecture.md:11`, `:190–191`, `:193`, `:233`; `harness/product-context.md:78`;
`apps/web/vite.config.ts`'s header; `end-to-end.test.ts:79` and `failure-paths.test.ts:133`; both
`tsconfig.build.json` headers; `packages/server/src/package.test.ts:139–140`.

**Checked and unmoved:** `.gitignore` (`dist/` already); `eslint.config.js` (`**/dist/**` ignored);
`vitest.shared.js` (`**/dist/**` excluded); `apps/web/test/package.test.ts`'s `NOT_OURS` filter;
`packages/core/turbo.json`'s three `apps/*` globs; `DISTRIBUTION` and `DECLARED_FILES`;
`README.md`'s pack loop; `docs/04-architecture.md:136`; `build-fixture.test.ts`.

---

## 8. Gate obligations

**GO-1 — the decision entry, before the run.** The human's, unconditionally. AC-7 cannot be satisfied
until it lands. **Verify it is present in the implement step's actual prompt** rather than assuming
it — the check Q-0097 lost two errata by not making and Q-0115's GO-1 discharged by measurement.

**GO-2 — the term lists, only if a term is coined.** Conditional (§0.3): three recent terms landed in
neither list. If coined, both move in the same change on the integration branch, because
`docs.test.ts` compares them **ordered**.

**GO-3 — the successors, opened at this gate with their bodies in full.** Appendix A and Appendix B.
Q-0123 is the highest allocated id; the allocator answers the next two.

**GO-4 — verification in both environment rows, forced**, plus `pnpm turbo run build --force` in
each, with the four-package wall-clock recorded.

**GO-5 — mutation rather than a bare approve** (Q-0051; Q-0121's 50.9-second one-sentence approve).
Discriminating mutations: remove the `build` script and AC-4's four sites fail naming the package;
add `^build` to the root `test` task and AC-2 fails; write one file outside `dist/` and the census
names it; delete the AC-5 answer and clause B names `apps/web`; quote `` `dist/**` `` twice and
`docs.test.ts` fails with the occurrence count.

**GO-6 — answer this gate `advance`, not `retry`.** Both blockers are outside this flow's reach.

---

## 9. Risks

**R-1 — no user-visible consumer** under the split. Stated rather than mitigated away, as Q-0121's
R-1 was. What it leaves behind is real: registers that agree, a vocabulary that distinguishes
emitting from shipping, and an artifact the successor has a subject to serve.

**R-2 — three expensive suites gain a build they do not want**, one of which was invisible to the
search that found the other two. AC-6 and OQ-3 are the response; the risk is that the answer is taken
by reading rather than by measuring.

**R-3 — the isolated copy may not build, and this requirement did not run one.** `apps/web` declares
no `vite` and resolves it from the workspace root by directory walk, so whether `vite build`
completes inside `isolate()`'s copy is **unproven**. Measure it before any criterion is worked on: if
it does not, the answer is OQ-3's narrowing rather than a repair.

**R-4 — the census prunes nothing.** `build.test.ts`'s isolated audit descends into the copy's
`node_modules` and fingerprints by size, mtime and bytes, so anything Vite or `@tailwindcss/vite`
writes outside `apps/web/dist/` is reported by name.

**R-5 — a cache hit can now replay a page.** AC-3(b) is the narrow guard; GO-1's entry is the wider
one.

**R-6 — a documentation edit can turn the suite red for an unrelated reason** (§0.5).

**R-7 — POSIX-only**, registered by Q-0098 and not lifted here.

---

## 10. Cross-cutting checklist

**BYOS** — `apps/web/test/package.test.ts`'s credential scan reads every file in the package, the new
build script included. **Worktree safety** — the build writes only `apps/web/dist/`, gitignored and
inside the package; the census would report a write into `.harness/`, `.quorum/` or `.git`.
**Gate behaviour** — unchanged. **File format** — none; no zod schema, wire shape or persisted file
moves. **Lint rules** — none added; `**/dist/**` is already ignored. **Cold-clone** — `pnpm turbo run
build` builds four packages instead of three; GO-4 records the difference. The packed path is
unchanged and still has no UI, which is Appendix B rather than a silence. **Product-agnostic** —
nothing names a SaaS product. **Vocabulary** — nothing coined; *"bundle"* describes the **shape** of
what Vite writes and is never a synonym for **emitted artifact**.

---

## Appendix A — Successor: the daemon serves the built web app

*Transcribed in full per GO-3. Allocate at the allocator's next id. Runs after Q-0122. **p2.***

**Problem.** After Q-0122 the output exists and `packages/server` still opens no file.

**The central design question.** Hono matches a registered path pattern rather than a prefix, so
prefix-shadowing is the Vite proxy's problem and not the daemon's. What the daemon has is **exact
collision**: four of the shell's twelve paths are literally daemon `GET` routes — `/flows`, `/runs`,
`/runs/:handle` against `GET /runs/:id`, `/history`. A handler that returns a response ends the
chain, so **a fallback registered after the JSON routes is never reached for those four** — Q-0120
review round 1's B-1 reproduced in the shipped product. The other eight are unclaimed. So the rule
must discriminate on something other than the path and must sit ahead of the JSON routes. That
mechanism is already shipped and **untested**: `vite.config.ts`'s `bypassNavigation`, keyed on
`req.method === 'GET' && req.headers.accept?.includes('text/html')`.

**The rule, stated once and implemented once.** (1) A request naming a file that exists under the
bundle root is answered with that file, whatever its `Accept`. (2) Otherwise a `GET`/`HEAD` whose
`Accept` includes `text/html` is answered with `index.html`, and the shell's own Not found view tells
a human the path is unknown. (3) Otherwise the request falls through to the JSON routes and their
404s. (4) A file-like path absent from the build — including one under the asset directory — is a 404
and never `index.html`, because a 200 HTML answer for a missing script is a blank page with a
successful status.

**Measured.** `serveStatic`'s `root` is *"relative to current working directory from which the app
was started. Absolute paths are not supported."* The daemon's cwd is the operator's project root; the
bundle's location is package-relative; and `packages/server` must not import `apps/web` in either
direction. **Recommendation: the bundle root is an explicit option** on `serve`/`createDaemon`.

**Draft criteria, nine.** (1) The bundle root is supplied, never discovered, and its absence is a
state: with none, the eleven routes behave exactly as today and no HTML is ever emitted. (2) A
supplied root holding no build **refuses at startup**, naming the missing output and what to run, and
binds no listener that would later 404 `/`. (3) Every one of the shell's twelve paths is reachable by
a top-level navigation, read from `ROUTES` rather than transcribed, shown **red** against a fallback
registered after the JSON routes. (4) Nothing that is not a navigation receives HTML, the eleven
routes answer exactly what they answer today under `application/json` and `*/*`, the WebSocket still
upgrades, and `HEAD` matches `GET` without a body. (5) A missing file-like path 404s and is never
`index.html`. (6) No path outside the bundle root is served — traversal in every encoding, dot
segments, repeated separators, and a symlink whose target is outside, resolved with `realpathSync`
and compared component by component, which is **Confinement**; a **dangling** symlink is Q-0059's
round-2 blocker and is named in advance. **This criterion earns the ticket its own gate.** (7) The
navigation predicate has exactly one definition, in `@quorum/shared`, reached by both ends and
importing neither. (8) The route register and the architecture document move with the code — **note
the measured trap**: `registeredRoutes()` matches `app.(get|post|put|patch|delete)` with a quoted
literal and **does not match `app.use` at all**, so a middleware mount is invisible to the guard that
holds the route set against the document. Register with `app.get` and a literal, or extend the
derivation and show the extension red first. (9) The documents say what shipped.

**Non-goals.** `quorum open`; any screen; serving anything but `apps/web`'s emit; a non-loopback
bind; authentication or CORS; compression or a service worker; Appendix B's subject.

**Open questions for its gate.** Is an entry owed? Probably not — Hono is the architecture document's
own choice and *"serves the built `apps/web`"* is its own sentence. Worth asking explicitly: is
answering `index.html` for an unrecognised navigation a silent default? The answer offered is no,
because the Not found view names the path and rule (3) keeps a non-navigation refusal explicit. Plus
OQ-6's cache policy, and whether `packages/server` gaining its first `node:fs` read needs recording.

---

## Appendix B — Successor: how an installation outside the workspace obtains the UI

*Transcribed in full per GO-3. **p2**, the adopter's ticket.*

**(a) After both halves a packed install still has no web app** — the local distribution set is three
tarballs and `apps/web` is `private: true` with no `files` and no `exports`. A gap in the cold-clone
story M6 turns on, recorded nowhere today. **(b) M3's done-when names `quorum open` and no ticket in
this milestone builds it** — the list is Q-0013 to Q-0019 plus Q-0118 to Q-0123, and `packages/cli`
declares no dependency on `@quorum/server`, so nothing in the CLI can start a daemon at all.

**What it must decide.** Either `@quorum/web` becomes a **fourth tarball**, which makes the
distribution set four, moves five registers and requires the app to stop being `private: true` —
colliding with 078(d) until Q-0029; **or** `@quorum/cli` ships the bundle beside its templates
(Q-0093's precedent), which requires **one package's emitted artifact to become a tracked or copied
asset of another** — a write `build.test.ts`'s census reports by construction.

**Start by measuring:** the bundle's size; whether a tarball carrying it lengthens the cold-clone
install (Q-0014 measured the cold store doubling to 10.4 s and +50 MB for the app's dependencies
alone); and whether the census can express a cross-package asset copy at all. **Read Q-0122's entry
first.**

---

## Provenance

**Candidate `claude` is the spine**, and five findings are why: the two non-emitting assertions in
`apps/web/test/package.test.ts`; `isolate()`'s derivation from `emitting()`; the new `'apps/web'`
literal; `registeredRoutes()`'s blindness to `app.use`; and `serveStatic`'s cwd-relative root,
re-read verbatim at iteration 2 and correct.

**Candidate `codex` contributed four things kept in full**: Appendix A's criterion 2 (an explicit
refusal when a supplied root holds no build), `HEAD` parity, the missing-asset-must-404 hazard, and
the cache-header question now carried as OQ-6.

**Where they disagreed.** On **scope**, codex writes twenty criteria as one ticket and claude
recommends two; the split is taken on a count against this repository's own ceiling. On the **route
problem**, claude's *"exact collision"* is right against codex's *"overlap"*, re-verified here by
reading both registers. On **testability**, codex's AC-14/AC-15 bundle eleven subjects into two
criteria and its AC-18 to AC-20 are the standard gate rather than properties of this change; both
land as GO-4 and §10.

**Iteration 2's own corrections, to the merge rather than to either candidate.** `isolate()` has
**three** consumers outside `build.test.ts`, not two — `step-id.test.ts:108` builds, throws if the
binary is absent, and carries a 180 s budget; it was missed because iteration 1 searched for the
prose *"three emitting packages"* rather than for `isolate(`, a search keyed on a name rather than on
the behaviour. `docs/GLOSSARY.md` defines **36** terms, not the 34 iteration 1 asserted while
correcting candidate `claude`'s 38 — Q-0099's shape inside the section that claimed the correction,
with the conclusion unaffected. And AC-5's conditional hedge is struck, the three sibling `NOT_READ`
rows being proof that the classifier collects exactly this literal shape.
