# Q-0098 — `quorum` is a runnable binary, and what `npx quorum` may claim

*Merged requirement, run 1, iteration 1, 2026-09-02. Head of product.*

*Nine criteria: AC-15 to AC-21, AC-25 and AC-26. Every measurement in §3 was re-run against the
working tree at `51c56f5` — after Q-0097 merged — rather than transcribed from either candidate,
from Q-0096's merged requirement or from decision 078. Six figures that this ticket inherited are
corrected here, four of them load-bearing, and one of them changes what AC-19 has to do.*

---

## 1. Problem

`packages/cli/package.json` declares `"bin": { "quorum": "./bin/quorum.js" }` and
`packages/cli/bin` does not exist. Q-0097 gave the workspace its first emit — `packages/cli/dist/`
holds fourteen files of plain JavaScript, and `@quorum/core` and `@quorum/shared` emit beside it —
and there is still nothing a person or a shell can execute. The frame Q-0090 built is reachable only
from inside Vitest.

That gap is what stands between M2 and its remaining children being demonstrable. Q-0091 to Q-0094
can each add a `case` and a test and none of them can show anybody the result; Q-0095's mock
end-to-end suite has no binary to spawn; and `docs/01-product-definition.md`'s cold-clone test — the
launch test the whole v1 cut is measured against — opens with a command that does not run.

Underneath it is the second problem the title names. The repository says `npx quorum` in six places
outside `backlog/`, including in two landed decision entries, and every package is
`"private": true`. Typing `npx quorum` on a cold machine resolves against the public registry and
fetches a stranger's package or nothing. Decision 078(d) ruled that claim **refused rather than
deferred**, and named two paths that may be claimed instead. Nothing in the repository yet says
which is which, and two of the six places are files nobody may edit.

The two halves fail differently, which is why they need different criteria. The binary half fails
**loudly**: nothing runs. The claims half fails **quietly**: a document goes on describing a
capability that does not exist, which is the drift `docs/06-development-plan.md` has now recorded in
four directions.

---

## 2. User stories

**`adopter` (cold-clone adopter).** *I found the repo, I have Claude and Codex subscriptions, and I
want to try Quorum on my own repository. I want the README to tell me one command that actually
works on my machine, and I want it not to tell me one that doesn't — I would rather read "pre-alpha,
here is how to run it from a clone" than watch `npx quorum` install something that is not Quorum.*

**`maintainer` (solo maintainer).** *I want `quorum help` to run from a terminal in my checkout, and
I want a non-zero status to reach my shell, because the first thing I will do with this is put it in
a script. If the build swallows `process.exitCode`, I want that from a test rather than from a green
tick over a failed command.*

**`contributor` (adapter contributor).** *When I add a command, I want the packaging question already
answered — where the artifact sits, what depth it resolves assets from, what ships in the tarball,
and what a fresh install resolves — so that landing a value import of `@quorum/core` is a code change
and not a packaging project.*

---

## 3. What was measured

Fourteen findings, each a command anyone can re-run. **M-6 to M-9 correct a figure this ticket
inherited. M-11 to M-14 appear in neither candidate.**

**M-1 — the `bin` target does not exist, and neither does its directory.** `ls packages/cli/bin` →
`No such file or directory`. AC-15's demonstrated red is therefore available at no cost: resolving
`bin.quorum` from the manifest and spawning it fails `ENOENT` against `main`.

**M-2 — the emit exists and needs nothing from the workspace at runtime.** `packages/cli/dist/`
holds fourteen files, seven `.js` and seven `.d.ts`. `grep -rn "@quorum" packages/cli/dist/` returns
**four** hits and **not one is a runtime specifier**: three are inside JSDoc comments
(`index.js:3`, `exit.d.ts:39`, `exit.js:25`) and the fourth is `exit.d.ts:12`'s
`import type { RunTerminalEvent }`, which exists only in the declaration file. So `dist/*.js` is
self-contained JavaScript, and a plain `node` process can import any of it by absolute path with no
package resolution at all. This is decision 078(g)'s registered limit confirmed **against the
emitted bytes** rather than against the source it was inferred from.

**M-3 — the emit configuration fixes what an emitted target's path can be.**
`packages/cli/tsconfig.build.json` declares `outDir: "dist"`, `rootDir: "src"`,
`include: ["src/**/*.ts"]`, `exclude: ["src/**/*.test.ts"]`. So `src/quorum.ts` → `dist/quorum.js`
(one segment below the package root) and `src/bin/quorum.ts` → `dist/bin/quorum.js` (two). A tracked
`bin/quorum.js` is one segment and is emitted by nothing. The three are **not** interchangeable —
see M-4.

**M-4 — the depth is load-bearing, and 078(e) already fixes it.** `spike/bin/harness.js:321` is
`fs.cpSync(path.join(here, '..', 'templates', 'harness'), dst, …)`, resolved **relative to the
binary's own file**. So:

| candidate target | segments below package root | `path.join(here, '..')` resolves to | verdict |
| --- | --- | --- | --- |
| `dist/quorum.js` | 1 | `packages/cli/` → templates at `packages/cli/templates/` | admissible |
| `bin/quorum.js` | 1 | `packages/cli/` → templates at `packages/cli/templates/` | admissible |
| `dist/bin/quorum.js` | 2 | `packages/cli/dist/` → templates inside the gitignored emit that `rm -rf dist` deletes on every build | **refused** |

078(e) says the depth "is fixed by this ruling and inherited by Q-0093 rather than discovered by
it". This is that ruling made arithmetic. See R-3.

**M-5 — the executable bit is a cache-replay question, and only if the target is emitted.** `tsc`
sets no mode bit and `.gitignore:4` ignores `dist/`, so git carries no mode for an emitted file.
Root `turbo.json` declares `build` with `outputs: ["dist/**"]` and `build.test.ts`'s AC-9 already
proves a cache **hit restores the artifact** — so an emitted target's mode bit must survive a
restore, and nobody has measured whether it does. A tracked target has no such question:
`git ls-files -s spike/bin/harness.js` reports mode **`100755`**, and its first line is
`#!/usr/bin/env node`. This is exactly the class 078's *Why* names — *"the tick lies about the past,
the artifact lies about the present"* — arriving on a permission rather than on a byte.

**M-6 — the CLI's pack contract has nearly doubled since 078(e) measured it.** 078(e) and the ticket
body both say **22 files, 90.6 kB unpacked**. Re-measured today, `npm pack --dry-run` in
`packages/cli` reports **40 files, 227.5 kB unpacked, 67.4 kB packed**:

| what | count | size |
| --- | --- | --- |
| `.turbo/turbo-*.log` | **4** (build, lint, test, typecheck) | 3.1 kB |
| `dist/**` | 14 | ~27.1 kB |
| `src/**` production | 7 | ~16.6 kB |
| `src/**` tests | **10** | **~176.9 kB** |
| manifests and configuration | 5 | ~3.5 kB |

**78% of the unpacked tarball is test files** — `build.test.ts` alone is 74.8 kB,
`frame.source.test.ts` 23.5 kB (078(e) says 17.9 kB; Q-0097 grew it), `package.test.ts` 23.2 kB.
There are **four** turbo logs and not the three 078(e) names, because Q-0097 added a `build` task
with a log of its own. The entry is append-only and is **not** edited; the superseding measurement
lives here. The contract is more load-bearing than when it was written, not less.

**M-7 — the contract is a three-package contract, and neither candidate measured the other two.**
`npm pack --dry-run` in `packages/core` reports **167 files, 2.0 MB unpacked**; in
`packages/shared`, **52 files, 339.8 kB**. Neither manifest declares `files`, neither has an
`.npmignore`, and npm consults only a *package-level* `.gitignore` — so both ship their whole `src/`
including every test. Under R-2 the local distribution set is three tarballs, so declaring `files`
on `@quorum/cli` alone leaves ~219 files and ~2.6 MB of repository-only material in the set. Codex's
AC-20 anticipated this in one sentence — *"covers all packages needed by the local distribution set,
not only the top-level CLI tarball"* — without measuring it; this is the measurement.

**M-8 — `@quorum/cli` cannot be installed from its own tarball alone, on either branch of what pnpm
writes.** `packages/cli` declares `"@quorum/core": "workspace:*"` and `"@quorum/shared":
"workspace:*"`. Either pnpm rewrites those to `0.0.0` when it packs, in which case an install
outside the workspace tries to resolve `@quorum/core@0.0.0` **from the registry**, where it does not
exist and where AC-20 requires access to fail; or pnpm leaves the `workspace:` protocol in the
packed manifest, which npm cannot resolve at all. **There is no branch in which packing
`@quorum/cli` alone yields an installable tarball**, and M-2's finding that the emit needs neither
package at *runtime* does not help: the failure is at dependency resolution, before a byte of
`dist/` is read. Ruled in R-2.

**M-9 — AC-18's second offered mechanism does not exist.** `node_modules/.bin` holds six entries —
`eslint`, `tsc`, `tsserver`, `turbo`, `vite`, `vitest` — and no `quorum`.
`packages/cli/node_modules/.bin` **does not exist at all** (that directory holds `.vite`,
`.vite-temp` and `@quorum` only). So codex's `pnpm --filter @quorum/cli exec quorum help` cannot
work today, and the ticket body's two candidates are not one working option and one alternative:
they are one option requiring a manifest change and one that does not exist. This is exactly what
`package.test.ts:69`'s own comment predicted — *"`pnpm install --frozen-lockfile` exits 0 with the
manifest as declared and creates no shim, because nothing depends on `@quorum/cli`"*.

**M-10 — AC-17 has no *command* subject, and the frame is one handler wide.** `commands.ts` is
`COMMANDS = ['help']`; `main.ts` dispatches `help` and otherwise prints `HELP` and returns, so the
process exits **0** (*"Why: preserved, see Q-0090 AC-6"*, successor Q-0090 GA-4). `parseArgv` has no
throw path a command line can reach. So **no supported CLI input produces a non-zero status**, which
is codex's OQ-1 and it is correct as far as it goes. What the criterion's own purpose clause asks —
*"so the emit is known not to swallow `process.exitCode`"* — has a subject: `fail.ts` emits to
`dist/fail.js`, exporting `die()` (`process.exit(ERROR)`) and `failSoftly()`
(`process.exitCode = ERROR`), the two mechanisms the module exists to keep apart and on which four
spike sites depend (`spike/bin/harness.js:499`, `:517`, `:523`, `:531`). Ruled in R-1. Two things
not to over-claim: `die` is the uninteresting half, and **130 through the binary today proves the
platform rather than the table** — `frame.source.test.ts:200` asserts nothing in this package
registers a signal handler, so a spawned binary killed by `SIGINT` dies on Node's default
disposition and the shell's 130 is the operating system's. That row is Q-0094's.

**M-11 — `build.test.ts` already contains the clean-clone corpus AC-15 wants, and neither candidate
noticed.** `isolate()` (`:366`) creates a temporary directory, copies the four `WORKSPACE_FILES`
plus root `globalDependencies` plus **every tracked file** under each emitting package, and mirrors
`node_modules` as a directory of symlinks with the `@quorum` scope re-pointed at the copy's own
packages. `buildIn(cwd, …flags)` runs the real turbo `build` there. That is *tracked files only* —
"the commit rather than the checkout", in the function's own words — which is literally AC-15's
"from a clean clone", and it is neutral between an emitted and a tracked target because the copy
carries tracked files and then builds. `runBuild(…)`, `removeEmit()` and `dry(task)` are the
real-workspace counterparts, all with 300-second timeouts.

**M-12 — a new test file that spawns the real emit races `removeEmit()`.** `vitest.shared.js` sets
no `fileParallelism: false` and no pool option, so Vitest runs test **files** in parallel workers.
`build.test.ts:730` and `:578`-region tests call `removeEmit()` and then `runBuild('--force')`
against the **real** `packages/cli/dist/`. A separate new file spawning that same path will
intermittently meet an emit that has just been deleted, and `test.sequential` does not serialise
across files. The two safe shapes are named in AC-15(c).

**M-13 — AC-21's subject is wider than AC-21 names, and part of it is unreachable.**
`grep -rn "npx quorum"` outside `node_modules` and `backlog/` finds six distinct sites:

| file | what is there | writable by the implement step? |
| --- | --- | --- |
| `docs/04-architecture.md:7` | *"One command (`npx quorum`) starts a local daemon…"* | yes (`docs`) |
| `docs/01-product-definition.md:33` | the cold-clone test itself | yes (`docs`) |
| `docs/06-development-plan.md:183` | M2's done-when: *"`npx quorum` works from a clean clone"* | yes (`docs`) |
| `harness/product-context.md:74` | quality pillar 7, read by every product-manager step at run time | yes (`harness`) |
| `docs/decisions/008-v1-cut-and-launch-test.md:4` | the launch test, in a **landed** entry | path yes, **rules no** |
| `docs/decisions/078-…` (3 occurrences) | the ruling that governs | path yes, **rules no** |

`docs/04-architecture.md:49` additionally says the server *"Serves the built `apps/web`"* — the word
*built* while nothing builds it. **And the root `README.md` is outside the implement role's write
paths entirely**: `harness/roles/developer-generalist.md:3` lists
`[package.json, pnpm-workspace.yaml, turbo.json, tsconfig*.json, .npmrc, .gitignore, .github,
packages, apps, spike, harness, docs]`, which contains `docs` and does not contain `README.md`.
It claims nothing today — eleven lines, no `npx`, no install command — so nothing there needs
correcting; **adding** an honest install claim is Q-0028's and is refused here as unreachable work.
See GO-5.

**M-14 — `docs.test.ts` already binds `04-architecture.md`, in two ways the sketch gets wrong.** Its
Q-0097 AC-24 block (`:206`–`:222`) requires every `build.outputs` pattern to appear in that document
**exactly once**, so an AC-21 edit mentioning `` `dist/**` `` a second time turns the suite red. And
the status-line test at `:195`–`:203` asserts that the status lines of `02`, `03` and `04` contain
**`Q-0041`** — not the current ticket. AC-21's sketch ("assert the status line carries this ticket")
therefore describes a **new** assertion; editing the existing one would trade a landed Q-0041 guard
for a Q-0098 one. Separately, `docs/GLOSSARY.md` defines neither *emitted artifact* nor *build task*
while decision 078 and `04-architecture.md`'s testing-strategy section both use them — so under
`harness/rules.md`'s own rule the entry is **already owed**, not conditionally owed, and the
conditional in the sketch is already resolved.

---

## 4. What is ruled at this gate

Both candidates arrived carrying blockers. Each is ruled here, with the measurement that rules it,
because none of the four changes anything a later ticket inherits and none needs a decision entry.
A gate that passes an answerable question upward is the pattern this repository has recorded eleven
times.

**R-1 — AC-17's subject is the emitted `fail.js` across a plain-node boundary, plus the preserved
zero through the `bin` target.** Codex declared itself blocked (OQ-1) after rewriting the criterion
to demand *"a real, supported CLI input"* producing a table value. That constraint is codex's own;
the ticket body's purpose clause is *"so the emit is known not to swallow `process.exitCode`"*, and
M-10 shows that subject exists today. A plain `node` process importing the **emitted** `dist/fail.js`
by absolute path and calling `failSoftly()` adds no command, no environment variable, no package
export and no production branch — every prohibition codex correctly wrote down is honoured. Codex's
refusal to manufacture a subject was right and is kept as the standing prohibition; its conclusion
that nothing may therefore be proven is not. **Sequencing after a command child is refused**: it
would put Q-0098 behind Q-0091 and move M2's critical path to buy a proof of Q-0091's own code.

**R-2 — the local distribution set is three tarballs: `@quorum/cli`, `@quorum/core`,
`@quorum/shared`.** 078(c) already names those three as the packages that emit and that something
outside the workspace consumes; the "distribution set" is that set and nothing was left open. This
needs no entry, changes no dependency and adds no tool. **Bundling is refused here**: it is 078
Shape D, whose door that entry leaves open *for want of a subject* and whose adoption is a new
dependency plus an architecture decision, and the subject arrives at Q-0091 rather than now.
Which branch of M-8 is true is a fixture detail the implementer measures first (OQ-2) — the
criterion is satisfiable under either answer, and under M-7 the `files` declaration is owed on all
three manifests rather than on the CLI's alone.

**R-3 — the `bin` target sits exactly one segment below its package root; emitted or tracked is a
local choice, recorded.** Claude marked emitted-versus-tracked blocking because Q-0093 inherits it
and AC-25 is conditional on it. What Q-0093 inherits is the **depth**, and M-4 shows 078(e) already
fixes it: `path.join(here, '..')` must resolve to the package root, which admits `dist/quorum.js`
and `bin/quorum.js` and refuses `dist/bin/quorum.js`. With the depth ruled, nothing outside
`packages/cli` depends on which of the two admissible shapes is chosen, and AC-25 is written
unconditionally so that choosing the tracked shape cannot skip it quietly. **Recommended: the
emitted `dist/quorum.js`**, a new `src/quorum.ts` carrying the shebang and
`main(process.argv.slice(2)).catch(dieOnUnexpected)`. It reads 078(e) literally, keeps every byte of
the package inside ESLint's `packages/**/*.ts` and `tsc`'s scope, and puts the shipped templates at
`packages/cli/templates/` — outside the directory `rm -rf dist` recreates. Its two costs are real
and are what AC-16 and AC-25 exist to price: `tsc`'s shebang preservation must be **proven by
reading the emitted file** rather than cited, and the mode bit must be set by the build and shown to
survive a cache replay. The tracked `bin/quorum.js` launcher is defensible — mode `100755` from the
commit, AC-25 satisfied by construction — at the cost of being the one file in this package that
ESLint and `tsc` both ignore. AC-26 requires the choice, its constraint and the rejected shape's
cost to be recorded.

**R-4 — AC-18's mechanism is chosen by a one-command measurement, not at this gate.** M-9 makes the
status quo untenable both ways, and the decision procedure is deterministic rather than a matter of
taste: install, run `ls node_modules/.bin`, adopt Mechanism A if a root devDependency on
`@quorum/cli` links a `quorum` shim, and otherwise record Mechanism B **with the measurement that
selected it**. Neither branch propagates outside this ticket. What is refused is choosing by
accident, which is the ticket body's own word.

**R-5 — `docs/01-product-definition.md:33` is annotated, not rewritten.** It is the locked v1 cut's
launch test and the sentence 008 froze; the shape stays and gains a clause naming that its
`npx quorum` is the M6 registry path and is Q-0029's. Correcting a living document and editing an
append-only entry are different acts, and only the first is available.

---

## 5. Acceptance criteria

Nine criteria against a ceiling of fifteen. **AC-15 to AC-21 keep Q-0096's numbering so citations
across the three tickets resolve; the two new ones are AC-25 and AC-26 rather than AC-22 and AC-23,
because Q-0097 has already spent AC-22 to AC-24 in that same shared space** and a document citing
"AC-22" would otherwise be ambiguous across two shipped tickets. AC-26 is decided first in time even
though it is numbered last.

*Test:* sketches are the implementer's starting point and not a frozen contract. Where one is wrong,
`requirements/errata.md` corrects it **during** the loop, as soon as the contradiction is provable —
*"An erratum is the last repair, not the first"* (2026-08-30), *"A refused finding is a gate, not
another round"* (2026-08-31). An erratum states what was **run**, not what was reasoned: Q-0097's run
cost two of them by writing one from a claim.

### AC-15 — `quorum help` runs under plain `node`, from a clean clone, and exits 0 — `packages/cli`

The full chain with no Vitest anywhere in it: tracked files → install → build → execute the file
`bin.quorum` names → the frame's `HELP` on stdout → exit 0.

(a) The target is resolved **from the manifest**, never written into the test.
`package.test.ts:75`–`:76` deliberately asserts only that the key carries a non-empty string, its
comment naming *"an extensionless launcher, a `dist/` layout"* as legitimate — a suffix pinned here
would make AC-26's choice unreviewable.

(b) The spawn is `execFileSync(process.execPath, [target, 'help'])`: a plain `node` process, no
`--conditions`, no loader, no `quorum-source`. What runs is the `default` branch of every export map
and plain JavaScript, which is 078(b)'s *"the emitted artifact is what Node and a packed install
resolve, and nothing else"* applied to the binary. stdout carries every command name `HELP` lists,
**derived from `HELP`** rather than transcribed — `commands.test.ts` already derives names out of it.

(c) **The primary proof runs in an isolated copy, and the fixture builds before it asserts.**
`fs.existsSync` over a gitignored emit is a verdict taken from the checkout (*"A test's verdict is a
property of the commit, not of the checkout or the account"*, 2026-08-30), and M-11 shows
`build.test.ts`'s `isolate()` + `buildIn()` is already the tracked-files-only corpus this criterion
means by "clean clone". It also settles M-12: a new file that builds and spawns the **real**
`packages/cli/dist/` races `build.test.ts`'s `removeEmit()` under Vitest's default file
parallelism. The two safe shapes are (i) assert inside the isolated copy, or (ii) place the
real-workspace assertions in `build.test.ts` itself. A third hand-rolled "run the build" mechanism is
refused; if helpers are extracted from `build.test.ts` to reach them, the extraction is reported.

*Test:* read `bin.quorum` from the manifest, build the isolated copy, spawn the target inside it with
`process.execPath`, assert `status === 0` and that stdout contains every name `HELP` lists.
**Demonstrated red before green, and the red is shown in the implement report**: against `main` the
target does not exist and the spawn fails `ENOENT` (M-1). A test passing for want of a subject is
this repository's most-recorded defect — *"a check that skips its subject must not report success"*
(2026-08-25).

### AC-16 — the artifact carries a shebang and is executable — `packages/cli`

`#!/usr/bin/env node` as the **first bytes**, matching `spike/bin/harness.js:1`, with the mode bit
set. A banner after any other byte does not work, and a `bin` target that is not executable runs
under `node <file>` while failing under `./<file>` and under an installed shim — which is the
difference AC-19 depends on.

*Test:* read the first line of the resolved target and assert it is exactly the shebang;
`fs.statSync(target).mode & 0o111` is non-zero. On a platform without POSIX modes the mode assertion
is **skipped and says so** — an explicit skip notice naming the unavailable check, never a silent
pass.

Per AC-26's choice: if the target is **emitted**, TypeScript's shebang preservation is a mechanism
rather than a promise, so prove it by **reading the emitted file** rather than by citing the
compiler, and the mode bit is set by the build (AC-25 proves it survives a replay). If the target is
**tracked**, prove the mode is the commit's rather than the checkout's —
`git ls-files -s -- <target>` reports `100755`, as `spike/bin/harness.js` does — so the assertion
cannot be satisfied by a `chmod` somebody ran once.

### AC-17 — a non-zero status crosses the process boundary through the emitted artifact — `packages/cli`

Per R-1, the subject is the soft path and the emitted module, not a command.

(a) A plain `node` process imports the **emitted** `dist/fail.js` by absolute path, writes to stdout,
calls `failSoftly()`, and returns normally. Assert the observed status is **1 and** that the stdout
written after the call arrived. The two together are the whole reason `failSoftly` exists beside
`die`; either alone is satisfiable by the other mechanism.

(b) The same process shape for `die('…')`: status **1**, message on **stderr**.

(c) Through the `bin` target itself, the preserved defect is pinned across the boundary rather than
silently fixed: `quorum <unknown>` prints help and exits **0** (`main.ts`, *"Why: preserved, see
Q-0090 AC-6"*, successor Q-0090 GA-4). Quietly returning 1 here would be a behaviour change wearing
a bug fix's clothes, which ground rule 3 forbids.

No test-only command, environment variable, package export or production branch is added to
manufacture a status. **A registered limit, stated in the criterion and repeated in the implement
report:** this proves the emit does not swallow a status. It proves **no command's code**, because no
command that can fail exists yet, and it does not prove the table's 130, which today is Node's
default disposition rather than the frame's contract (M-10). Both are Q-0091 to Q-0094's. Silence
about this is refused.

### AC-18 — the workspace path works, resolves locally, and its mechanism was chosen — `packages/cli`

Per M-9 there is no shim anywhere, so this is a **choice** before it is an assertion, and the choice
is recorded with its cost.

**Mechanism A — make something depend on `@quorum/cli`.** The root `package.json` declares it as a
devDependency, `pnpm install` links `node_modules/.bin/quorum`, and the path a contributor types is
`pnpm exec quorum help` from the repository root. **Verify before adopting**: that pnpm links a
workspace package's bin from a root dependency is an assumption, not a measurement. Cost: the root
manifest and `pnpm-lock.yaml` move **together**, because `commands.install` runs
`pnpm install --frozen-lockfile` and a manifest change without a lockfile change fails the install
after the implement step is paid for (Q-0090 R-4).

**Mechanism B — assert over the resolved target directly**, and **report** that no shim exists and
that `pnpm --filter @quorum/cli exec quorum` therefore does not work. Cheaper, and it collapses this
criterion into AC-15 — which is choosing by accident in the other direction unless the measurement
is what selected it.

Whichever is chosen, the criterion asserts **positively** that the executed file's real path lies
inside `packages/cli`, and the implement report names the mechanism, the measurement that selected
it, and what the other would have cost. A criterion satisfied without a reader being able to tell
which of two mechanisms satisfied it is not satisfied.

*Test:* spawn through the chosen mechanism; assert exit 0 and `HELP` on stdout; assert
`fs.realpathSync` of the executed file starts with `packages/cli`'s own root, reached
package-relatively as `package.test.ts` already does rather than by climbing to a repository. The
environment disables package-runner installation and registry fallback (AC-20). Removing or renaming
the local target makes the test fail.

### AC-19 — the local distribution set is a declared contract, and installs and runs outside the workspace — `packages/cli`, `packages/core`, `packages/shared`

Two halves. Per R-2 the set is three tarballs.

**(a) `files` is declared on each of the three manifests, and the pack manifest is the contract.**
It names the distribution — at minimum each package's `bin` target and emit, plus its own manifest —
and the assertion is over the **pack result** rather than over the field: every path the
distribution requires is present, and **no** packed path is a test file, sits under `src/`, sits
under `.turbo/`, or is a run artifact or worktree. Derive the rejection
(`/\.test\.[cm]?[jt]s$/`, a `.turbo/` prefix, a `src/` prefix) rather than hand-writing a list, so an
eleventh test file is covered without anyone remembering — the fail-open shape Q-0051 found in
`q0050.source.test.ts` and Q-0097 found again in `test-discovery.test.ts`.

**Load-bearing on day one, re-measured 2026-09-02 (M-6, M-7):** `npm pack --dry-run` exits 0 despite
`"private": true` and ships **40 files / 227.5 kB** for `@quorum/cli` — of which 176.9 kB is ten test
files and 3.1 kB is four turbo build logs — **167 files / 2.0 MB** for `@quorum/core`, and
**52 files / 339.8 kB** for `@quorum/shared`, none of the three declaring `files`. 078(e)'s
*"22 files and 90.6 kB … three `.turbo` logs and nine test files"* is its own gate figure and is
superseded; the entry is append-only and is **not** edited. Do not transcribe either set of numbers —
re-derive them.

**(b) The set installs and runs outside the workspace, without the registry.** A project created
under `os.tmpdir()`, outside the repository, with no workspace symlinks and no access to repository
`node_modules`, into which the three packed tarballs are installed together and from which
`quorum help` is invoked, exiting 0 with `HELP` on stdout. Per M-8 the CLI tarball alone cannot
install under either branch of what pnpm writes for `workspace:*`, so the tarballs are installed
together or the two dependencies are mapped to their local tarballs explicitly at the temporary
project. **OQ-2 is the implementer's first act**: pack once, read the packed manifest's
`dependencies` block, and report it **verbatim**. The criterion is satisfiable under either answer;
what is refused is proceeding without knowing which.

The fixture points `npm_config_cache` at a directory inside its own sandbox so no warm cache can
serve a real package, and removes everything in an `afterAll` — the shape `build.test.ts`'s
`isolated` register already uses. `pnpm pack` and `npm pack` are **confirmed** to agree on the file
list after `files` lands, with any divergence reported rather than resolved in passing; they agree
on all forty paths today.

**A registered limit, per 078(g), stated here and repeated in the implement report:**
`packages/cli`'s emitted JavaScript carries **no** runtime `@quorum/*` specifier (M-2, measured
against the emitted bytes), so this fixture proves the easy case — a CLI whose binary needs nothing
from its declared dependencies at run time. It acquires its real subject at Q-0091's first value
import. 078(g) permits sequencing after Q-0091 **or** stating the limit; this requirement states it,
because AC-19 sits off M2's critical path and blocking it behind Q-0091 would move the critical path
rather than shorten it. *Correction carried from Q-0096's gate so it is not re-derived wrong:* that
document's §M-3 calls `exit.ts:12` *"the only cross-package import"*, which holds of **production
source only** — `packages/cli/src/exit.test.ts:20` is a cross-package **value** import of
`runTerminalEventSchema`. It changes no conclusion, tests not being emitted, and it is written down
so nobody re-measures it and believes they have found something.

### AC-20 — registry resolution cannot satisfy or alter either verdict — `packages/cli`

Both paths configure execution so a missing local `quorum` **fails** rather than falling back, and
the packed fixture additionally points registry access at a test-controlled failing endpoint —
`npm_config_registry` at a closed local port, retries at zero, audit and fund off — or gives an
equally explicit offline guarantee. A public package named `quorum`, `@quorum/core` or
`@quorum/shared` can neither satisfy nor change the result. **This covers every package in the
distribution set, not only the top-level tarball.**

*Test:* assert **positively** that the executed binary's resolved real path lies inside the workspace
package (AC-18) or inside the temporary installation (AC-19). A network-dependent assertion is
refused outright: it would make the verdict a property of the machine, and a negative assertion that
some lookup failed passes on a machine with no network for reasons that have nothing to do with this
commit.

Note the one place AC-19 and AC-20 pull against each other: a dead registry is exactly what makes an
under-specified install fail. That failure is the signal, not an obstacle — **if AC-19(b) can be
made to pass only by letting a registry answer, the criterion is not satisfied and the run says so.**

### AC-21 — the documentation separates three claims, and the status lines move — `docs/`, `harness/`

Repository documentation distinguishes three things by name: the supported **workspace-local** path
(the exact command AC-18 established), the supported **locally packed** path (AC-19), and
**registry-backed `npx quorum`**, which remains Q-0029's in M6 and is **refused here rather than
deferred**. No architecture document, product-definition sentence, development-plan bullet, harness
context file, test name or success message claims a cold machine can obtain Quorum from the public
registry.

Per M-13 the subject is enumerated so the scan has one:

| file | disposition |
| --- | --- |
| `docs/04-architecture.md:7` | corrected |
| `docs/04-architecture.md:49` (*"Serves the built `apps/web`"*) | corrected or scoped |
| `docs/01-product-definition.md:33` | **annotated, not rewritten** (R-5) — the cold-clone test keeps its shape and gains a clause naming its `npx quorum` as the M6 registry path |
| `docs/06-development-plan.md:183` | corrected to the two claimed paths |
| `harness/product-context.md:74` | corrected — and this one matters most, because agents read it at run time |
| `docs/decisions/008-…:4`, `docs/decisions/078-…` | **left alone.** Cited, never edited |
| root `README.md` | **out of scope and unreachable** — it claims nothing today, and it is outside the implement role's write paths (M-13, GO-5). Adding an honest install claim is Q-0028's |

**The scan exempts `docs/decisions/**` by name and says why.** A criterion demanding an edit
`harness/rules.md` forbids is *"A requirement may not name a surface its flow cannot write"*
(2026-08-25) arriving on a surface the *rules* forbid rather than one the role cannot reach — and
078(d) governs, so 008 is superseded in substance by a later entry naming it, which is the mechanism
the append-only rule exists to provide. The exemption is asserted **load-bearing**: a scan that
excused the whole of `docs/` would report success over its own subject.

**Two corrections to the sketch, from M-14.** `docs.test.ts`'s Q-0097 AC-24 block requires each
`build.outputs` pattern to appear in `04-architecture.md` **exactly once**, so an edit mentioning
`` `dist/**` `` a second time turns the suite red. And its status-line test asserts **`Q-0041`**, so
"the status line carries this ticket" is a **new** assertion beside it and never a change to it —
trading a landed Q-0041 guard for a Q-0098 one is a check swapped, not added.

**The glossary entry is owed now, not conditionally.** Per M-14, *emitted artifact* and *build task*
are already in their second file while `docs/GLOSSARY.md` defines neither. Define them, and say what
they are **not**: the *binary* is the `bin` target and is not a synonym for the emit; a *build task*
is turbo's task and is not a "pipeline", a "job" or a "step". `docs/README.md:28`'s term list moves
with them. `CLAUDE.md:13` carries the identical list and is **outside** the implement role's write
paths — GO-5.

*Test:* assert the status line of every numbered document this change edits records Q-0098 and the
landing date, **beside** the existing Q-0041 assertion. Scan the changed documentation and the new
glossary text for a sentence asserting registry-resolved `npx quorum`, with `docs/decisions/**`
exempted and the exemption shown to be load-bearing. Assert the two claimed paths and the one
deferred path are each named. Assert `docs/GLOSSARY.md` carries both terms with their decision cited
by title and date, in the shape `docs.test.ts` already uses for **Event** and **Undecided**.

### AC-25 — the target survives a cache replay of `build` — `packages/cli`

**Stated unconditionally, so that choosing the tracked shape in AC-26 cannot skip it quietly.**

078's *Why* is that a `build` task with real `outputs` introduces a replayed **artifact**, and that an
artifact a downstream thing *executes* "lies about the present". The `bin` target is the first
artifact anything executes. So every property AC-15 and AC-16 assert must hold **after a cache hit**
and not only after a fresh build: the file is restored, its first bytes are still the shebang, and
its mode bit is still set — which M-5 shows nobody has measured.

*Test:* the shape `build.test.ts`'s AC-9 already establishes — `runBuild('--force')`, `removeEmit()`,
assert the target is gone, `runBuild()`, assert `cache.status === 'HIT'` from turbo's
machine-readable summary rather than from its output text, then re-run AC-15's spawn and AC-16's
shebang and mode assertions against the restored file. Subject to M-12: this belongs beside the
existing replay test rather than in a file that races it. If AC-26 chooses a **tracked** target the
criterion is satisfied by construction, and the implement report **says so with the reason** — a
criterion reported inapplicable states why, per the skipped-subject rule.

### AC-26 — the target's location satisfies the inherited depth, and the choice is recorded — `packages/cli`

Per R-3, one constraint is ruled and one choice is local.

**The ruled constraint.** `path.relative(PACKAGE, target)` has **exactly one** path segment, so
`path.join(here, '..')` resolves to the package root and the shipped templates resolve at
`<package>/templates/`. `dist/bin/quorum.js` is refused: it puts them inside the gitignored emit that
`rm -rf dist` deletes on every build, which would make `packages/templates`' assets something the
build must copy rather than something the package ships. This is 078(e)'s *"the depth … is fixed by
this ruling and inherited by Q-0093 rather than discovered by it"* made arithmetic, and **Q-0093 does
not build `init` against a guess.**

**The recorded choice.** Emitted `dist/quorum.js` (recommended) or tracked `bin/quorum.js`, decided
against three constraints and reported with the rejected shape's cost:

1. **Depth** — both satisfy the ruled constraint; the third candidate does not.
2. **The mode bit** — emitted means `tsc` sets none and AC-25's replay question is live; tracked means
   git records `100755` and AC-25 is satisfied by construction.
3. **Which guards see it** — `frame.source.test.ts`'s `packageFiles()` walks the package pruning
   `GENERATED = ['node_modules', '.turbo', 'dist']`. A **tracked** `bin/quorum.js` is therefore
   scanned by AC-4(d)'s signal-handler clause and AC-12's credential clause, whose third test asserts
   the credential-matching set is **exactly** `[GUARD_IN_PACKAGE]` (`:262`), so a new file that
   happened to match turns it red. An **emitted** `dist/quorum.js` is pruned and is covered instead
   through its source `src/quorum.ts`. Neither is wrong; being unaware of which is in force is.
   A tracked `.js` launcher is additionally the one file in this package that neither ESLint
   (`packages/**/*.ts`) nor `tsc` sees.

*Test:* assert `bin.quorum` resolves to a real file and that `path.relative(PACKAGE, target)` has one
segment, with a message naming the template consequence. The recorded number and its consequence for
`path.join(here, '..')` are written where Q-0093 will read them — in the target's own JSDoc, citing
*"The emit serves the binary, and no test verdict moves behind it"* (2026-09-02) by title and date.
The implement report names the choice, the constraint that decided it, and what the rejected shape
would have cost.

### The seam, if the run approaches its bound

**AC-19 and AC-20's packed half, together**, which the ticket body already identifies and which
Q-0095 does not need. AC-15 to AC-18, AC-25 and AC-26 are the binary half and are on M2's critical
path; AC-20's workspace half stays with AC-18. **Cutting AC-21 is not an option**: a document
claiming a capability that does not exist is the failure this ticket exists to close, and the
credential and registry-resolution guarantees are not weakened to reduce scope.

---

## 6. Non-goals

1. **The export surface of `@quorum/core`** — Q-0096's, shipped.
2. **The build task, its outputs and the replay guarantees** — Q-0097's, shipped. AC-25 *reads* the
   replay; it does not change the task.
3. **Publishing to the public registry, and any claim that a cold machine can fetch Quorum** —
   Q-0029's, in M6. **Refused** by AC-20 and AC-21, not deferred.
4. **Implementing any command** — Q-0091 to Q-0094's. `COMMANDS`, `HELP` and `HANDLERS` each gain
   nothing. A binary that could run `board` would be a green tick over a command that does not exist,
   which is the reasoning `commands.ts` already carries; `frame.source.test.ts`'s AC-8 scan is what
   fails if a domain helper arrives with it.
5. **The 130-on-signal handler, and a signal test through the binary** — Q-0094's. Today's 130 is
   Node's default disposition and proves the platform rather than the table (M-10); a test asserting
   it here would read as coverage for a row nothing implements.
6. **Fixing the unknown-command zero, or `regressed` sharing `completed`'s code** — preserved defects
   with a named successor (Q-0090 GA-4). AC-17(c) pins the first across the boundary.
7. **Bundling `core` and `shared` into the CLI** — 078 Shape D, left open on purpose and refused here
   (R-2). It becomes a live option at Q-0091's first value import.
8. **Any change to `spike/`** — ground rule 1. Nothing here needs one.
9. **`apps/web` and the daemon** — AC-21 corrects what `04-architecture.md:49` *claims* about the
   built web app; it builds nothing.
10. **A `.npmignore` file.** `files` is what 078(e) rules; both would be two mechanisms for one
    contract.
11. **Adding an install claim to the root `README.md`** — Q-0028's, and outside the implement role's
    write paths (M-13, GO-5). The README claims nothing today, so nothing there needs correcting.
12. **Source maps and emitted-stack-trace guarantees.** Not part of the contract; the implement report
    records that this ticket makes no such guarantee (codex OQ-3, answered "no" here).

---

## 7. Open questions

None blocks solutioning. Each has an owner and a deterministic way to answer it.

**OQ-1 (implementer, first act) — which branch of M-8 is true?** Pack once, read the packed
manifest's `dependencies` block, report it verbatim. AC-19 is satisfiable under either answer, which
is why this is not a blocker; proceeding without measuring it is what would make the fixture's shape
get decided after it had been written.

**OQ-2 (implementer, first act) — does a root devDependency on `@quorum/cli` link a shim?** One
command after an install: `ls node_modules/.bin`. R-4's procedure consumes the answer.

**OQ-3 (implementer, reported not resolved) — does `pnpm pack` honour `files` identically to
`npm pack`?** They agree on all forty paths today (M-6). AC-19 requires the agreement to be
**confirmed** after `files` lands and any divergence reported. Resolving a divergence is out of
scope; hiding one is refused.

**OQ-4 (gate, at the close) — does `@quorum/core`'s 2.0 MB pack want a successor?** M-7 measures it
and AC-19(a) bounds it by declaring `files`. Whether the remaining size after that declaration is
worth its own ticket is a judgement the measurement should be taken to, not a blocker: the criterion
already refuses tests, `src/`, `.turbo/` and run artifacts in every packed set.

---

## 8. Risks

**R-1 — a verdict taken from the checkout.** The likeliest way this ticket ships something broken.
`dist/` is gitignored, `test` has no `^build` edge, and every assertion about the target's existence,
shebang, mode and behaviour is green in a working tree before a line is written. AC-15(c) and AC-25
are the mitigation; the discipline is that **every** new assertion is demonstrated red against `main`
and the red is *shown* in the report rather than described.

**R-2 — a new test file racing `removeEmit()`.** M-12. Intermittent `ENOENT` on a binary spawn, which
will read as a code defect and is a fixture defect. AC-15(c) names the two safe shapes.

**R-3 — AC-19 discovered mid-run to be unsatisfiable.** M-8 makes this managed rather than a
surprise, provided OQ-1 is answered before the fixture is written. An implement step that discovers
it afterwards has one channel — prose the human does not read until the gate (GO-2).

**R-4 — the root manifest moving without the lockfile.** Mechanism A changes `package.json` and
`pnpm-lock.yaml` together, and `commands.install` runs `pnpm install --frozen-lockfile`. A manifest
edit without a regenerated lockfile fails the install **after** the implement step is paid for.

**R-5 — an AC-21 edit turning `docs.test.ts` red for a reason unrelated to the ticket.** M-14 names
both mechanisms: the exactly-once `dist/**` clause and the `Q-0041` status-line assertion. Cheap to
avoid, expensive to diagnose from a review report.

**R-6 — the eleventh instance of a loop handed work no step in it can perform.** `CLAUDE.md` and the
root `README.md` are both outside the implement role's write paths, and the first carries the
glossary term list (M-13). Named in advance here and in GO-5.

**R-7 — scope creeping into Q-0091's territory through the binary.** A working `bin` target invites
adding a command to watch it do something. Non-goal 4; `frame.source.test.ts`'s AC-8 scan is what
fails.

**R-8 — the pack fixture leaking under `os.tmpdir()`.** It creates a temporary project, an npm cache
and three tarballs. `build.test.ts`'s `isolated` register plus an `afterAll` is the established
shape; a fixture leaking on every suite run is a defect this repository has already paid for once, in
worktrees.

**R-9 — Q-0039 is unfixed.** Two concurrent runs on one ticket compute the same run id and share a
worktree. GO-4.

---

## 9. Cross-cutting checklist

- **BYOS.** No API-key path anywhere, including the pack fixture's environment and any registry
  configuration. `frame.source.test.ts`'s AC-12 scan walks the package pruning `node_modules`,
  `.turbo` and `dist`, and its third test requires the credential-matching set to be **exactly** the
  guard file — so a **tracked** `bin/quorum.js` is scanned by it, which is worth knowing before the
  file is written rather than after (AC-26 constraint 3).
- **Worktree safety.** Nothing writes to a user's working tree. Every fixture works under
  `os.tmpdir()` and removes what it made; the build writes only into `dist/`, which Q-0097's AC-8
  already bounds.
- **Gate behaviour.** No flow, gate or loop bound changes. AC-17's `undecided` → 3 row is asserted as
  a table row; the run status that produces it is Q-0094's.
- **File format and schema.** No schema moves. `package.json`'s `files` and `bin` are npm's format,
  not Quorum's.
- **Lint rules.** `harness lint` untouched. ESLint's scope unchanged — and note that a tracked
  `bin/quorum.js` falls outside `packages/**/*.ts` and would be linted and typechecked by nothing,
  which AC-26 states as a cost rather than discovering later.
- **Cold-clone impact.** The first ticket that *shortens* the first thirty minutes rather than
  lengthening them: it is what makes a command exist to type. AC-21 is what stops the shortening from
  being dishonest.
- **Product boundaries.** The product is Quorum and the binary is `quorum`; neither is called a
  harness and `harness/` is never called quorum. Every new sentence obeys this the first time, as
  `commands.ts`'s `HELP` already does.
- **`spike/`.** Untouched. `packages/core/src/spike-parity.test.ts` is re-derived rather than adjusted
  in the same change (ground rule 5); this ticket adds no file under `spike/test/`, so the expectation
  is that the totals **do not move** — and *"it did not move"* is stated in the report rather than
  skipped, which is this repository's idiom for a register that was checked.

---

## 10. Gate obligations

**GO-1 — the precondition is met.** *"The emit serves the binary, and no test verdict moves behind
it"* (2026-09-02) is landed, and Q-0097 shipped the artifact it rules. Verified at this gate:
`packages/cli/dist/` holds fourteen emitted files, `packages/core/dist/index.js` and
`packages/shared/dist/index.js` both exist, and root `turbo.json` declares `build` with
`outputs: ["dist/**"]` and `dependsOn: ["^build"]`.

**GO-2 — Q-0083 does not exist.** An implement step meeting a finding it may not act on still has no
`blocked` verdict. The remedy is an erratum written **during** the loop, as soon as the contradiction
is provable — *"A refused finding is a gate, not another round"* (2026-08-31). Q-0097's run cost two
errata by writing one from a claim rather than from a measurement, then a third correcting the
second; **an erratum here states what was run.**

**GO-3 — unmet, and blocking the chore run.** `git branch --list 'harness/Q-0098*'` returns nothing.
`harness/Q-0098/integration` must exist before the first chore run, per `docs/02-sdlc-pipeline-spec.md`
§5.8: `review` diffs against that branch and only `integrate`, which runs later, creates it. Cut it
deliberately from the requirements tip rather than from whatever `HEAD` holds, on Q-0037's GA-2
precedent.

**GO-4 — Q-0039 is unfixed.** Do not run concurrently with any other ticket, and specifically not with
Q-0091 to Q-0095.

**GO-5 — two surfaces are unreachable, and they are named in advance.** AC-21's glossary work implies
extending the term list that appears **identically** in `docs/README.md:28` and `CLAUDE.md:13`, and
nothing mechanically checks that the two agree. `docs/README.md` is inside the implement role's write
paths; **`CLAUDE.md` is not**, and neither is the root **`README.md`**
(`harness/roles/developer-generalist.md:3` lists `docs` and does not list either file). The implement
step updates the glossary and `docs/README.md`, and **reports** `CLAUDE.md:13` as the human's to
extend at the gate; the README is non-goal 11. Named here because the alternative is the pattern this
repository has recorded eleven times. See *"`.claude/rules/` is a derived copy, not a surface a
requirement may name"* (2026-08-27), which added *is it derived?* to the two questions routing already
asked of a surface — this is the third, *is it reachable?*, on files that are neither derived nor
writable.

**GO-6 — 078's figures are superseded and the entry is not edited.** M-6 and M-7 correct 078(e)'s
*"22 files and 90.6 kB … three `.turbo` logs and nine test files"* and add two packages it does not
measure. The entry is append-only; the current measurement lives in this document and in the implement
report, and any future ruling is a new entry naming the old.

---

## 11. Provenance

**The claude candidate is the base.** All twelve of its measurements were re-run at this gate and
**all twelve hold**: the absent `bin/` directory, the fourteen emitted files with no runtime
`@quorum` specifier, the 40-file / 227.5 kB pack with four turbo logs and ten test files, the absent
shims, the workspace-dependency trap in a packed tarball, the seven-site `npx quorum` census with the
append-only exemption, the already-owed glossary entry, and both `docs.test.ts` interactions. Its
§3 → §4 discipline, its per-criterion registered limits, its AC-25 (cache replay) and AC-26 (target
location) — both raised from findings rather than tidiness — and its §10 ordering are taken largely
intact.

**The codex candidate contributed the adversarial frame, and four things are taken from it
verbatim in substance.** Its insistence that a skipped POSIX-mode check emits an **explicit skip
reason** rather than a pass. Its requirement that each path **positively records and asserts** the
resolved binary's canonical location. Its sentence that AC-20 "covers all packages needed by the
local distribution set, not only the top-level CLI tarball", which is the observation §3's M-7 turned
into a measurement and R-2 into a ruling. And its refusal to manufacture AC-17 a subject through
"a test-only command, environment variable, package export, or production branch", which is kept as a
standing prohibition inside a criterion that now has one. Its cross-cutting table and its non-goal
that this ticket "does not implement `init` or create missing templates" are also folded in.

**Where they disagreed, and how it was ruled.**

- **AC-17.** Codex declared itself **blocked**; claude proposed the emitted `fail.js`. Ruled for
  claude (R-1), because codex's blocker follows from a constraint codex added — the criterion's own
  purpose clause is about the emit swallowing `process.exitCode`, and that has a subject today.
  Codex's prohibitions are retained.
- **AC-19's distribution set.** Codex made it **blocking** with three options including bundling;
  claude made it non-blocking with two. Ruled explicitly (R-2) as three tarballs, on 078(c)'s own
  naming, with bundling refused as 078 Shape D. Neither candidate ruled it; a gate that passes an
  answerable question upward is the failure both documents spend paragraphs warning about.
- **AC-18's mechanism.** Codex asserted `pnpm --filter @quorum/cli exec quorum` as *the* supported
  command. Measured false (M-9): there is no `quorum` in `node_modules/.bin` and no
  `packages/cli/node_modules/.bin` at all. Claude's two-mechanism framing is taken, with R-4 turning
  its blocking OQ-2 into a decision procedure.
- **Emitted versus tracked.** Claude made it **blocking** and recommended tracked. Dissolved (R-3):
  what propagates to Q-0093 is the depth, 078(e) fixes it, and M-4 turns it into a one-segment
  assertion that admits both. The recommendation is inverted to **emitted**, on the ground that a
  tracked `.js` launcher is the one file in the package that neither ESLint nor `tsc` sees — an
  unchecked file in a repository whose five most recent decisions are all about checks that skip
  their subject.
- **Numbering.** Both proposed AC-22/AC-23 for the new criteria. Changed to **AC-25/AC-26**: Q-0097
  has already spent AC-22 to AC-24 in the shared Q-0096 numbering space, and the whole point of
  preserving the numbering is that a citation resolves.

**Four findings are this gate's and appear in neither candidate.** M-7 (the contract is a
three-package contract: `@quorum/core` 167 files / 2.0 MB, `@quorum/shared` 52 / 339.8 kB, neither
declaring `files`). M-11 (`build.test.ts`'s `isolate()` is already the tracked-files-only clean-clone
corpus AC-15 asks for, and is neutral between the two target shapes). M-12 (a new test file spawning
the real emit races `removeEmit()` under Vitest's default file parallelism, and `test.sequential` does
not serialise across files). And the second half of M-13 — the root `README.md` is outside the
implement role's write paths, so claude's *"AC-21's work there is to add an honest claim"* is work the
step cannot perform, now non-goal 11 and GO-5.

**Size.** Nine criteria against a ceiling of fifteen. Claude proposed nine, codex seven; codex's seven
are contained in these nine. Neither needed cutting, and the seam is stated in §5 rather than taken.

---

## 12. What the implementer does first

In order, because three of these change what the rest of the work looks like.

1. `pnpm install --frozen-lockfile && pnpm turbo run build` — confirm the emit is there before
   asserting anything about it. **Your worktree has no dependencies until you install them**
   (`harness/rules.md`): `commands.install` runs only in an `integrate` worktree.
2. Resolve `bin.quorum` from the manifest and spawn it. **Capture the `ENOENT`** — that is AC-15's red
   and the report must carry it.
3. Answer **OQ-1**: pack once, read the packed manifest's `dependencies` block, report it verbatim.
   AC-19's fixture is written after this, not before.
4. Answer **OQ-2**: after an install, `ls node_modules/.bin`, and take R-4's branch that the
   measurement selects.
5. Settle **AC-26** — one segment below the package root, emitted or tracked — and write the depth and
   its consequence into the target's JSDoc before anything else reads it.
6. Then write code.

Both suites, forced, in **both environment rows** before the report is written —
`npm test --prefix spike` and `pnpm turbo run test --force`, in the integrate worktree and again on
`main` after the merge (Q-0072's closing finding). `pnpm sweep:git-identity` runs in a linked worktree
since Q-0058; run it. `harness lint` runs **inside** the worktree so it lints the changed tree rather
than `main`'s.
