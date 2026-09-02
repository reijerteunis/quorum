# Q-0098 — `quorum` is a runnable binary, and what `npx quorum` may claim

*Requirements candidate (claude), run 1, 2026-09-02. Product manager.*

*Every measurement below was taken against the working tree at the head of `main` on 2026-09-02,
after Q-0097 merged. Nothing is transcribed from the ticket body, from Q-0096's merged requirement
or from decision 078 — where a figure in one of those disagrees with a figure here, §3 says so and
names which is current. That is not pedantry: four of the twelve findings below correct a number
this ticket inherited, and one of them changes what AC-19 has to do.*

---

## 1. Problem

`packages/cli/package.json` declares `"bin": { "quorum": "./bin/quorum.js" }` and
`packages/cli/bin/` does not exist. Q-0097 gave the workspace its first emit, so
`packages/cli/dist/` now holds fourteen files of plain JavaScript — `main.js`, `fail.js`,
`commands.js` and the rest — and there is still nothing a person or a shell can execute. The frame
Q-0090 built is reachable only from inside Vitest.

That gap is the whole of what stands between M2 and its four command children being demonstrable.
Q-0091 to Q-0094 can each add a `case` and a test, and none of them can show anybody the result;
Q-0095's mock end-to-end suite has no binary to spawn; and the cold-clone test in
`docs/01-product-definition.md` — the launch test the entire v1 cut is measured against — begins
with a command that does not run.

Underneath it sits a second problem, which is what the ticket's title names. The repository has said
`npx quorum` in seven places since 2026-08-06, including in a landed decision entry, and every
package in the workspace is `"private": true`. Typing `npx quorum` on a cold machine today resolves
against the public registry and fetches a stranger's package or nothing. Decision 078(d) ruled that
this claim is **refused rather than deferred** and that two paths may be claimed instead — the
workspace-local one and a locally packed tarball. Nothing in the repository yet says which is which,
and one of the seven places is a file no agent may edit.

So the ticket has two halves and they fail differently. The binary half fails **loudly**: nothing
runs. The claims half fails **quietly**: a document goes on describing a capability that does not
exist, which is the drift `docs/06-development-plan.md` has now recorded in four directions.

---

## 2. User stories

**`adopter` (cold-clone adopter).** *I found the repo, I have Claude and Codex subscriptions, and I
want to try Quorum on my own repository. I want the README to tell me one command that actually
works on my machine, and I want it not to tell me one that doesn't — I would rather be told
"this is pre-alpha, here is how to run it from a clone" than watch `npx quorum` install something
that isn't Quorum.*

**`maintainer` (solo maintainer).** *I want `quorum help` to run from a terminal in my checkout, and
I want a non-zero exit to reach my shell, because the first thing I will do with this is put it in a
script. If the build swallows `process.exitCode`, I want to find that out from a test rather than
from a green CI run over a failed suite.*

**`contributor` (adapter contributor).** *When I add a command, I want the packaging question already
answered — where the artifact sits, what ships in the tarball, and what a fresh install resolves —
so that landing a value import of `@quorum/core` is a code change and not a packaging project.*

---

## 3. What was measured

Twelve findings. Each is a command anyone can re-run. M-6, M-7, M-8 and M-9 correct something this
ticket inherited.

**M-1 — the `bin` target does not exist, and neither does its directory.** `packages/cli/bin` →
`No such file or directory`. So AC-15's demonstrated red is available today at no cost: resolving
`bin.quorum` from the manifest and spawning it fails `ENOENT` against `main`.

**M-2 — the emit exists, works, and needs nothing from the workspace at runtime.**
`packages/cli/dist/` holds fourteen files (seven `.js`, seven `.d.ts`) built by Q-0097's
`rm -rf dist && tsc -p tsconfig.build.json`. `grep -rn "@quorum" packages/cli/dist/` returns
**four** hits and **not one is a runtime specifier**: three are inside JSDoc comments and the fourth
is `dist/exit.d.ts:12`'s `import type { RunTerminalEvent }`, which exists only in the declaration
file. So `dist/*.js` is self-contained JavaScript. This is decision 078(g)'s registered limit,
confirmed against the emitted bytes rather than against the source it was inferred from.

**M-3 — the emit configuration fixes where an emitted bin could sit.**
`packages/cli/tsconfig.build.json` declares `rootDir: "src"`, `include: ["src/**/*.ts"]`,
`exclude: ["src/**/*.test.ts"]`. An emitted target is therefore `src/bin/quorum.ts` →
`dist/bin/quorum.js`, two segments below the package root. A tracked launcher is `bin/quorum.js`,
one segment below it, and is emitted by nothing. The two are not interchangeable, because
078(e) makes the depth load-bearing: `spike/bin/harness.js:321` resolves shipped templates as
`path.join(here, '..', 'templates', 'harness')`, relative to the binary's own file, so
`dist/bin/quorum.js` puts templates at `packages/cli/dist/templates/` and `bin/quorum.js` puts them
at `packages/cli/templates/`. Q-0093 inherits whichever is chosen.

**M-4 — the executable bit is a cache-replay question, and only if the target is emitted.** `tsc`
sets no mode bit, and `.gitignore:4` ignores `dist/`, so git carries no mode for an emitted file.
Root `turbo.json` declares `build` with `outputs: ["dist/**"]`, and `build.test.ts`'s AC-9 already
proves a cache **hit restores the artifact** — which means an emitted bin's mode bit has to survive
a restore, and nobody has measured whether it does. A tracked `bin/quorum.js` has no such question:
`spike/bin/harness.js` is `-rwxr-xr-x` and tracked, and git records mode `100755`. This is exactly
the class 078's *Why* names — *"the tick lies about the past, the artifact lies about the
present"* — arriving on a permission rather than on a byte.

**M-5 — a test asserting the target exists takes its verdict from the checkout unless it builds.**
`test` has no `^build` edge (078(b) is explicit that none is added), and `dist/` is gitignored. So
`fs.existsSync(dist/bin/quorum.js)` is green in this checkout and red in a fresh clone and on CI —
the same defect Q-0096's review round 2 found in the assertion it replaced, and what *"A test's
verdict is a property of the commit, not of the checkout or the account"* (2026-08-30) forbids.
`build.test.ts` already solves it twice over: `runBuild()` against the real workspace and
`buildIn(isolate())` against a tracked-files-only copy under `os.tmpdir()`, both with 300-second
timeouts. AC-15's fixture inherits one of those shapes rather than inventing a third.

**M-6 — the pack contract has more than doubled since it was written, and the ticket body's figures
are stale.** The body and 078(e) both say **22 files, 90.6 kB unpacked**, measured at Q-0096's gate.
Re-measured today, `npm pack --dry-run` in `packages/cli` reports **40 files, 227.5 kB unpacked,
67.4 kB packed**:

| what | count | size |
| --- | --- | --- |
| `.turbo/turbo-*.log` | 4 (build, lint, test, typecheck) | 3.1 kB |
| `dist/**` | 14 | ~27.1 kB |
| `src/**` production | 7 | ~16.6 kB |
| `src/**` tests | **10** | **~176.9 kB** |
| manifests and configuration | 5 | ~3.5 kB |

**78% of the unpacked tarball is test files** — `build.test.ts` alone is 74.8 kB, `frame.source.test.ts`
23.5 kB, `package.test.ts` 23.2 kB. There are **four** `.turbo` logs, not the three 078(e) names,
because Q-0097 added a `build` task with a log of its own. `pnpm pack --dry-run --json` reports the
identical forty-path list, so the two tools agree **today**; whether they still agree once `files`
is declared is what AC-19 has to measure rather than assume. The contract is more load-bearing than
when it was written, not less.

**M-7 — `@quorum/cli` cannot be installed from its own tarball alone, on either branch of what pnpm
does with `workspace:`.** This is the finding the ticket body does not have, and it changes AC-19's
shape. `packages/cli` declares `"@quorum/core": "workspace:*"` and `"@quorum/shared":
"workspace:*"`. Either pnpm rewrites those to `0.0.0` when it packs, in which case an install
outside the workspace resolves `@quorum/core@0.0.0` **against the registry**, where it does not
exist and where AC-20 requires access to fail; or pnpm leaves the `workspace:` protocol in the
packed manifest, which npm cannot resolve at all. **There is no branch in which packing
`@quorum/cli` alone yields an installable tarball**, and M-2's finding that the emit needs neither
package at *runtime* does not help — the failure is at dependency resolution, before a byte of
`dist/` is read. AC-19 must therefore pack **three** tarballs and install them together, or map the
two dependencies explicitly at the temporary project. Which branch is true is one command and is the
first thing the implementer runs; the criterion is written so either answer is satisfiable.

**M-8 — AC-18's second offered mechanism does not exist.** `node_modules/.bin` holds six entries —
`eslint`, `tsc`, `tsserver`, `turbo`, `vite`, `vitest` — and no `quorum`.
`packages/cli/node_modules/.bin` **does not exist at all**. So `pnpm --filter @quorum/cli exec
quorum` cannot work today, and the criterion's two candidates are not one working option and one
alternative: they are one option that requires a manifest change and one that does not exist. This
is the measurement `package.test.ts:69`'s own comment predicted — *"`pnpm install --frozen-lockfile`
exits 0 with the manifest as declared and creates no shim, because nothing depends on
`@quorum/cli`"* — and it is why AC-18 says choosing by accident is refused.

**M-9 — AC-21's subject is wider than AC-21 names, and part of it may not be edited.**
`grep -rn "npx quorum"` outside `node_modules` and `backlog/` finds it in **seven** places besides
the development plan:

- `docs/04-architecture.md:7` — *"One command (`npx quorum`) starts a local daemon…"*. Writable; named by the criterion.
- `docs/01-product-definition.md:33` — **the cold-clone test itself**. Writable; not named by the criterion.
- `harness/product-context.md:74` — **quality pillar 7**, the file every product-manager step reads before writing any requirement. Writable; not named.
- `docs/decisions/008-v1-cut-and-launch-test.md:4` — a **landed, append-only entry**. **Not writable, and not editable by anybody**: `harness/rules.md` says a landed entry is never edited and a reversal is a new entry naming the old.
- `docs/decisions/078-the-emit-serves-the-binary.md` — three occurrences, in the ruling that governs. Not writable.

And `docs/06-development-plan.md:183` is M2's own done-when: *"`npx quorum` works from a clean clone
(no UI yet)"* — the plan asserting the thing 078(d) refuses. Separately, the README claims
**nothing**: it is eleven lines, has no `npx`, no `install` and no command at all, so AC-21's work
there is to *add* an honest claim rather than to correct a false one, which is a different edit from
the one the criterion implies.

**M-10 — the glossary entry is already owed, not conditionally owed.** AC-21 says *"If the ruling
introduces vocabulary (build task, emitted artifact), it is defined in `docs/GLOSSARY.md` before its
second use; if it introduces none, that is stated."* Measured: `docs/GLOSSARY.md` contains **no**
occurrence of *emit*, *emitted artifact* or *build task*, while decision 078 and
`docs/04-architecture.md`'s testing-strategy section both use them. **They are already in their
second file**, so the entry is owed now under `harness/rules.md`'s own rule, and the conditional in
the criterion's sketch is already resolved. One consequence has to be stated in advance:
`CLAUDE.md:13` and `docs/README.md:28` each carry the glossary's term list, and **`CLAUDE.md` is
outside `developer-generalist`'s write paths** (`package.json, pnpm-workspace.yaml, turbo.json,
tsconfig*.json, .npmrc, .gitignore, .github, packages, apps, spike, harness, docs`). `docs/README.md`
is inside them. So the implement step can do one and not the other — see GO-5.

**M-11 — `docs.test.ts` already binds `04-architecture.md`, in two ways AC-21's sketch gets wrong.**
Its Q-0097 AC-24 block requires every `build.outputs` pattern to appear in that document **exactly
once**, so an AC-21 edit that mentions `` `dist/**` `` a second time turns the suite red. And the
status-line test at `:195–203` asserts the status lines of `02`, `03` and `04` contain **`Q-0041`**
— not the current ticket. AC-21's sketch (*"assert the status line carries the landing date and this
ticket"*) therefore describes a **new** assertion; editing the existing one would delete a Q-0041
guard to make room for a Q-0098 one, which is a check being traded rather than added.

**M-12 — AC-17 has a subject today, and it is the soft path, not a command.** The frame dispatches
exactly one command, `help`, which exits 0, and an unknown command prints help and exits **0** as a
preserved defect (`main.ts`, Q-0090 AC-6). So **no command reachable through the `bin` target can
produce a non-zero status.** What the emit could plausibly swallow is `process.exitCode` —
`failSoftly()` — which is the mechanism `fail.ts` exists to keep apart from `die()` and which four
spike sites depend on (`spike/bin/harness.js:499`, `:517`, `:523`, `:531`). That is the proof worth
buying. Two further notes so they are not over-claimed: `die()` is `process.exit(1)`, which is the
uninteresting half; and **130 through the binary today proves the platform, not the table** —
`frame.source.test.ts`'s AC-4(d) asserts nothing in this package installs a signal handler, so a
spawned binary killed by `SIGINT` dies on Node's default disposition, and the shell's 130 is the
operating system's. The table's 130 is Q-0094's to prove.

---

## 4. Acceptance criteria

Nine criteria, AC-15 to AC-23, against the ticket's ceiling of fifteen. Numbering AC-15 to AC-21 is
preserved from Q-0096's merged requirement so citations across the three tickets resolve; **AC-22
and AC-23 are new**, and §4's closing note says why each exists and what it would cost to drop it.

*Test:* sketches are the implementer's starting point and not a frozen contract. Where one is wrong,
`requirements/errata.md` corrects it **during** the loop, as soon as the contradiction is provable —
*"An erratum is the last repair, not the first"* (2026-08-30) and *"A refused finding is a gate, not
another round"* (2026-08-31).

### AC-15 — `quorum help` runs under plain `node` and exits 0 — `packages/cli`

The full chain, with no Vitest anywhere in it: install → build → execute the file `bin.quorum`
names → the frame's `HELP` on stdout → exit 0. The target is resolved **from the manifest** rather
than written into the test, because `package.test.ts:69` deliberately asserts only that the key
carries a non-empty string and its comment names *"an extensionless launcher, a `dist/` layout"* as
legitimate choices — a suffix pinned here would make AC-23's choice unreviewable.

Three clauses, and the third is what makes it a proof rather than an observation:

(a) The spawn is `execFileSync(process.execPath, [target, 'help'])` — a plain `node` process, no
`--conditions`, no loader, no `quorum-source`. What runs is the `default` branch of both export maps
and plain JavaScript, which is 078(b)'s *"the emitted artifact is what Node and a packed install
resolve, and nothing else"* applied to the binary.

(b) stdout carries the command list `commands.ts` owns, **derived from `HELP` rather than
transcribed** — `commands.test.ts` already derives command names out of `HELP` and refuses one that
is not in `COMMANDS`; this reads the same register.

(c) **The build happens inside the fixture**, per M-5. `fs.existsSync` on a gitignored emit is a
verdict taken from the checkout. Use `build.test.ts`'s established shape — `runBuild()` against the
real workspace, or `buildIn(isolate())` against the tracked-files copy — and inherit its timeout
budget rather than inventing one.

*Test:* read `bin.quorum` from the manifest, build, spawn with `process.execPath`, assert
`status === 0` and that stdout contains every name `HELP` lists. **Demonstrated red before green**
and the red is *shown* in the implement report: against `main` the target does not exist and the
spawn fails `ENOENT` (M-1). A test passing for want of a subject is this repository's
most-recorded defect — *"a check that skips its subject must not report success"* (2026-08-25).

### AC-16 — the artifact carries a shebang and is executable — `packages/cli`

`#!/usr/bin/env node` as the **first bytes**, matching `spike/bin/harness.js:1`, with the mode bit
set. A banner emitted after any other byte does not work, and a `bin` target that is not executable
works under `node <file>` and fails under `./<file>` and under an installed shim, which is the
difference AC-19 depends on.

*Test:* read the first line of the resolved target and assert it is exactly the shebang;
`fs.statSync(target).mode & 0o111` is non-zero. On a platform without POSIX modes the mode assertion
is **skipped and says so** — a skip notice, never a silent pass.

If the target is **emitted**, TypeScript's shebang preservation is a mechanism rather than a promise:
prove it by reading the emitted file, not by citing the compiler. If the target is **tracked**, prove
the mode is the commit's rather than the checkout's — `git ls-files -s -- <target>` reports mode
`100755` — so the assertion cannot be satisfied by a `chmod` somebody ran once.

### AC-17 — the exit-code table survives the process boundary — `packages/cli`

At least one non-zero status must be shown reaching a shell **through the emitted artifact**, so the
emit is known not to swallow `process.exitCode`. Per M-12 the subject is the soft path:

(a) A plain `node` process imports the **emitted** `fail.js`, calls `failSoftly()`, writes to stdout,
and returns normally. Assert the observed status is `1` **and** that the stdout written after the
call arrived — the two together are the whole point of `failSoftly` existing beside `die`, and
either alone is satisfiable by the other mechanism.

(b) The same for `die('…')`: status `1`, message on **stderr**.

(c) Through the `bin` target itself, the preserved defect is pinned across the boundary rather than
silently fixed: `quorum <unknown>` prints help and exits **0** (`main.ts`, *"Why: preserved, see
Q-0090 AC-6"*, successor Q-0090 GA-4). A run that quietly returned 1 here would be a behaviour change
wearing a bug fix's clothes, and ground rule 3 forbids it.

**A registered limit, stated in the criterion and repeated in the implement report:** this proves the
emit does not swallow a status. It proves **no command's code**, because no command that can fail
exists yet, and it does not prove the table's 130, which is Node's default disposition today (M-12).
Closing both is Q-0091 to Q-0094's. Silence about this is refused.

### AC-18 — the workspace path works, resolves locally, and its mechanism was chosen — `packages/cli`

Per M-8 there is no shim anywhere, so this criterion is a **choice** before it is an assertion, and
the choice is recorded with its cost.

**Mechanism A — make something depend on `@quorum/cli`.** The root `package.json` declares
`"@quorum/cli": "workspace:*"` as a devDependency, `pnpm install` links `node_modules/.bin/quorum`,
and the path a contributor types is `pnpm exec quorum help` from the repository root. Cost: the root
manifest and `pnpm-lock.yaml` move together (`commands.install` runs `pnpm install
--frozen-lockfile`, so a manifest change without a lockfile change fails the install after the
implement step is paid for — Q-0090 R-4). **Verify before adopting**, because it is an unmeasured
assumption that pnpm links a workspace package's bin from a root dependency: install, then
`ls node_modules/.bin`.

**Mechanism B — assert over the resolved target directly**, and **report** that no shim exists and
that `pnpm --filter @quorum/cli exec quorum` therefore does not work. Cheaper, and it collapses this
criterion into AC-15, which is choosing by accident in the other direction.

Whichever is chosen, the criterion asserts **positively** that the executed file's real path lies
inside `packages/cli`, and the implement report names the mechanism, the measurement that selected
it, and what the other one would have cost. A criterion satisfied without the reader being able to
tell which of two mechanisms satisfied it is not satisfied.

*Test:* spawn through the chosen mechanism, assert exit 0 and `HELP` on stdout, and assert
`fs.realpathSync` of the executed file starts with `packages/cli`'s own root, reached
package-relatively as `package.test.ts` already does rather than by climbing to a repository.

### AC-19 — a locally packed tarball is runnable, and its contents are a declared contract — `packages/cli`

Two halves. The second is the one M-7 rewrote.

**(a) The `files` field is declared, and the pack manifest is a contract.** `files` names the
distribution — at minimum the `bin` target and the emit — and the assertion is over the pack
manifest rather than over the field: assert every path the distribution requires is present, and
that **no** packed path is a test file, sits under `src/`, sits under `.turbo/`, or is a run
artifact or worktree. Derive the rejection rather than hand-writing a list (`/\.test\.[cm]?[jt]s$/`,
a `.turbo/` prefix, a `src/` prefix), so a tenth test file added later is covered without anyone
remembering. **Re-measured 2026-09-02 and load-bearing on day one, not hypothetically:** `npm pack
--dry-run` exits 0 despite `"private": true` and today ships **40 files and 227.5 kB unpacked**, of
which **176.9 kB is ten test files** and 3.1 kB is four turbo build logs (M-6). The ticket body's
*"22 files, 90.6 kB"* is Q-0096's gate figure and is superseded; do not transcribe it.
`pnpm pack` and `npm pack` agree on the file list today and must be **confirmed** to agree after
`files` is declared, with any divergence reported rather than resolved in passing.

**(b) The tarball installs and runs outside the workspace, and its dependencies resolve without the
registry.** A newly created temporary project under `os.tmpdir()`, outside the repository, with no
workspace symlinks and no access to repository `node_modules`, into which the packed CLI is
installed and from which `quorum help` is invoked, exiting 0 with `HELP` on stdout. **Per M-7 the
CLI tarball alone cannot install**, because `@quorum/core` and `@quorum/shared` are declared
dependencies that no reachable registry can satisfy — so all three emitting packages are packed and
installed together, or the two are mapped to their local tarballs explicitly at the temporary
project. The first thing the implementer does is measure which branch of M-7 is true: pack once and
read the packed `package.json`'s `dependencies` block, and **report it verbatim** in the implement
report. The criterion is satisfiable under either answer; what is refused is proceeding without
knowing which.

The fixture creates its sandbox under `os.tmpdir()`, points `npm_config_cache` at a directory inside
it so no warm cache can serve a real package, and removes everything in an `afterAll` — the shape
`build.test.ts`'s `isolated` register already uses.

**A registered limit, per decision 078(g), stated here and repeated in the implement report:**
`packages/cli`'s emitted JavaScript carries **no** runtime `@quorum/*` specifier (M-2, measured
against the emitted bytes), so this fixture proves the easy case — a CLI whose binary needs nothing
from its declared dependencies at run time. It acquires its real subject at Q-0091's first value
import. 078(g) permits either sequencing after Q-0091 or stating the limit; this requirement states
it, because AC-19 sits off M2's critical path and blocking it behind Q-0091 would move the critical
path rather than shorten it. *Correction carried from Q-0096's gate so it is not re-derived wrong:*
§M-3 of that document says `exit.ts:12` is *"the only cross-package import"*, which is true of
**production source only** — `packages/cli/src/exit.test.ts:20` is a cross-package **value** import
of `runTerminalEventSchema`. It changes no conclusion, tests not being emitted, and it is written
down so nobody re-measures it and thinks they have found something.

### AC-20 — registry resolution cannot satisfy or alter either verdict — `packages/cli`

Both paths configure execution so a missing local `quorum` **fails** rather than falling back, and
the packed fixture additionally points registry access at a test-controlled failing endpoint —
`npm_config_registry` at a closed local port, with retries at zero, audit and fund off — or gives an
equally explicit offline guarantee. A public package named `quorum` can neither satisfy nor change
the result of either half.

*Test:* assert **positively** that the executed binary's resolved real path lies inside the
workspace package (AC-18) or inside the temporary installation (AC-19). A network-dependent
assertion is refused outright: it would make the verdict a property of the machine, which is what
*"A test's verdict is a property of the commit"* (2026-08-30) forbids, and a negative assertion that
some registry lookup failed would pass on a machine with no network for reasons that have nothing to
do with this commit.

Note the interaction with M-7, because it is the one place these two criteria pull against each
other: a dead registry is exactly what makes an under-specified install fail. That failure is the
signal, not an obstacle — if AC-19(b) can only be made to pass by letting the registry answer, the
criterion is not satisfied and the run says so.

### AC-21 — the documentation separates three claims, and the status lines move — `docs/`, `harness/`

Repository documentation distinguishes three things by name: the supported **workspace-local** path,
the supported **locally packed** path, and **registry-backed `npx quorum`**, which remains Q-0029's
in M6 and is refused here rather than deferred. No README, architecture document, development-plan
bullet, product-definition sentence, harness context file, test name or success message claims a
cold machine can obtain Quorum from the public registry.

Per M-9 the subject is wider than the criterion's own list, and it is enumerated here so the scan
has one:

| file | what is there | disposition |
| --- | --- | --- |
| `docs/04-architecture.md:7` | *"One command (`npx quorum`) starts a local daemon…"* | corrected |
| `docs/04-architecture.md:49` | the server *"Serves the built `apps/web`"* — *built* while nothing builds it | corrected or scoped |
| `docs/01-product-definition.md:33` | the cold-clone test, phrased as `npx quorum` | corrected, or annotated with what it will mean at M6 |
| `docs/06-development-plan.md:183` | M2 done-when: *"`npx quorum` works from a clean clone"* | corrected to the two claimed paths |
| `harness/product-context.md:74` | quality pillar 7, read by every product-manager step | corrected, and the correction matters more than the others because agents read it at run time |
| `docs/decisions/008-…:4` | the launch test, in a **landed** entry | **left alone.** Cited, never edited |
| `docs/decisions/078-…` | the ruling that governs | **left alone** |

**The scan must exempt `docs/decisions/**` by name and say why.** A criterion demanding an edit that
`harness/rules.md` forbids is *"A requirement may not name a surface its flow cannot write"*
(2026-08-25) arriving as a surface the *rules* forbid editing rather than one the role cannot reach
— and 078(d) is the entry that governs, so 008 is superseded in substance by a later entry naming
it, which is exactly the mechanism the append-only rule provides.

**Two corrections to the sketch, from M-11.** `docs.test.ts`'s Q-0097 AC-24 block requires each
`build.outputs` pattern to appear in `04-architecture.md` **exactly once**, so an edit mentioning
`` `dist/**` `` a second time turns the suite red. And its status-line test asserts **`Q-0041`**;
the criterion's *"the status line carries this ticket"* is therefore a **new** assertion beside it,
never a change to it — trading a landed Q-0041 guard for a Q-0098 one is a check being swapped, not
added.

**The glossary entry is owed now, not conditionally.** Per M-10, *emitted artifact* and *build task*
are already in their second file while `docs/GLOSSARY.md` defines neither, so `harness/rules.md`'s
own rule makes the entry due. Define them there, and say what they are **not**: the *binary* is the
`bin` target and is not a synonym for the emit; *build task* is turbo's task and is not a
"pipeline", a "job" or a "step". `docs/README.md:28`'s term list moves with it. `CLAUDE.md:13`'s
identical list is outside the implement role's write paths — see GO-5.

*Test:* assert the status line of each numbered document the change edits records this ticket, beside
the existing Q-0041 assertion rather than in place of it. Scan the changed documentation and the new
glossary text for a sentence asserting registry-resolved `npx quorum`, with `docs/decisions/**`
exempted and the exemption asserted to be load-bearing — a scan that excused the whole of `docs/`
would report success over its own subject. Assert the two claimed paths and the one deferred path
are each named. Assert `docs/GLOSSARY.md` carries the two terms with their decision cited by title
and date, in the shape `docs.test.ts` already uses for **Event** and **Undecided**.

### AC-22 — the target survives a cache replay of `build` — `packages/cli`

**New. This exists only if AC-23 chooses an emitted target**, and it is stated unconditionally so
that choosing the emitted shape cannot quietly skip it.

Decision 078's *Why* is that a `build` task with real `outputs` introduces a **replayed artifact**,
and that an artifact a downstream thing executes *"lies about the present"*. The `bin` target is the
first artifact anything executes. So every property AC-15 and AC-16 assert must hold **after a cache
hit**, not only after a fresh build: the file is restored, its first bytes are still the shebang, and
its mode bit is still set (M-4 — nobody has measured whether turbo's cache preserves it).

*Test:* the shape `build.test.ts`'s AC-9 already establishes — `runBuild('--force')`, `removeEmit()`,
assert the target is gone, `runBuild()`, assert `cache.status === 'HIT'` from turbo's
machine-readable summary rather than from its output text, then re-run AC-15's spawn and AC-16's
shebang and mode assertions against the restored file. If AC-23 chooses a **tracked** target, this
criterion is satisfied by construction and the implement report **says so with the reason** — a
criterion reported as inapplicable states why, per the skipped-subject rule.

### AC-23 — the target's location is chosen against its constraints and recorded — `packages/cli`

**New.** The `bin` value in the manifest is provisional (`package.test.ts:69` says so in its own
comment), and three separate things depend on which way it goes: the template depth Q-0093 inherits
(M-3, 078(e)), whether the executable bit is git's or the build's (M-4), and which of
`frame.source.test.ts`'s package-wide scans see the file (M-10 below). Leaving it to be discovered
is the failure 078 was written to prevent one layer up.

**Constraint 1 — depth.** `path.join(here, '..', 'templates', 'harness')` is resolved relative to the
binary's own file. `bin/quorum.js` puts the shipped templates at `packages/cli/templates/`;
`dist/bin/quorum.js` puts them at `packages/cli/dist/templates/`, inside a gitignored directory that
`rm -rf dist` deletes on every build — which would make `packages/templates`' assets something the
build has to copy rather than something the package ships. Q-0093 does not build `init` against a
guess; it inherits the number this criterion pins.

**Constraint 2 — the mode bit.** Emitted → `tsc` sets none, `.gitignore` means git carries none, and
AC-22's replay question is live. Tracked → git records `100755`, as `spike/bin/harness.js` does today,
and AC-22 is satisfied by construction.

**Constraint 3 — which guards see it.** `frame.source.test.ts`'s `packageFiles()` walks the package
pruning `GENERATED = ['node_modules', '.turbo', 'dist']`. A tracked `bin/quorum.js` is therefore
scanned by AC-4(d)'s signal-handler clause and AC-12's credential clause — and AC-12's third test
asserts the credential-matching set is **exactly** `[GUARD_IN_PACKAGE]`, so a new file that happened
to match would turn it red. An emitted `dist/bin/quorum.js` is pruned and invisible to both, and is
covered instead by `src/bin/quorum.ts` under `files()`. Neither is wrong; being unaware of which one
is in force is.

*Test:* assert the manifest's `bin.quorum` resolves to a real file, and that
`path.relative(PACKAGE, target)` has the recorded number of segments — with the recorded number and
its consequence for `path.join(here, '..')` written where Q-0093 will read it, in the target's own
JSDoc, citing 078(e) by title and date. The implement report names the choice, the constraint that
decided it, and what the rejected shape would have cost.

**Recommendation, offered rather than imposed:** the tracked `packages/cli/bin/quorum.js` launcher —
a shebang, a `process.argv.slice(2)`, an `import('../dist/main.js')` and
`main(...).catch(dieOnUnexpected)`. It puts templates one level from the package root, which is
`spike/`'s own arrangement; it makes the mode bit a property of the commit; and it keeps the
executable's shebang out of a directory `rm -rf` recreates. Its cost is real and should be weighed:
the launcher is `.js`, so ESLint (`packages/**/*.ts`) and `tsc` both ignore it, and it becomes the one
file in this package nothing typechecks. If that is judged too high a price, the emitted shape is
defensible and AC-22 is what makes it safe.

### Why AC-22 and AC-23 exist

Both come from findings, not from tidiness. AC-23 exists because M-3 and M-4 showed that the
"provisional" `bin` value is three coupled decisions rather than a path, one of which
(`init`'s template depth) is inherited by a ticket that has not started. AC-22 exists because M-4
found an unmeasured property of the one artifact anything executes, in exactly the failure class
078's *Why* names. Dropping either is possible; dropping AC-23 hands Q-0093 a guess, and dropping
AC-22 lets an emitted target's executable bit be a cache-timing question nobody asked.

**The seam to cut on, if the run is at risk of its bound**, is AC-19 and AC-20 — the packed half —
which the ticket body already identifies and which Q-0095 does not need. AC-15 to AC-18, AC-22 and
AC-23 are the binary half and are on M2's critical path. Cutting AC-21 is not an option: a document
claiming a capability that does not exist is the failure this ticket exists to close.

---

## 5. Non-goals

1. **The export surface of `@quorum/core`** — Q-0096's, shipped.
2. **The build task, its outputs and the replay guarantees** — Q-0097's, shipped. AC-22 reads the
   replay; it does not change the task.
3. **Publishing to the public registry, and any claim that a cold machine can fetch Quorum** —
   Q-0029's, in M6. Refused by AC-20 and AC-21, not deferred.
4. **Implementing any command** — Q-0091 to Q-0094's. `COMMANDS` gains no entry here, and neither
   `HELP` nor `HANDLERS` grows a line. A binary that could run `board` would be a green tick over a
   command that does not exist, which is the reasoning `commands.ts` already carries.
5. **The 130-on-signal handler** — Q-0094's. AC-17 says explicitly what today's 130 proves and what
   it does not.
6. **Fixing the unknown-command zero, or `regressed` sharing `completed`'s code** — both preserved
   defects with a named successor (Q-0090 GA-4). AC-17(c) pins the first across the boundary rather
   than repairing it.
7. **Bundling `core` and `shared` into the CLI** — 078 Shape D, left open on purpose and not taken
   here. M-7 makes it tempting; it is a dependency and an architecture decision, and it is the
   human's.
8. **Any change to `spike/`** — ground rule 1. Nothing in this ticket needs one.
9. **`apps/web` and the daemon** — AC-21 corrects what `04-architecture.md:49` *claims* about the
   built web app; it builds nothing.
10. **A `.npmignore` file.** `files` is what 078(e) rules; adding both is two mechanisms for one
    contract.

---

## 6. Open questions

**OQ-1 (blocking, human, at the gate) — emitted or tracked?** AC-23 states the three constraints and
recommends the tracked launcher. It is blocking because Q-0093 inherits the answer and because AC-22
is conditional on it. It is answerable at the gate from §3 alone; it does not need a decision entry,
because 078(e) already rules that the *artifact* sits in `dist/` and the launcher is not the
artifact — but if the gate reads it the other way, say so in the ticket body before the chore run,
because an implement step may not write a decision entry.

**OQ-2 (blocking, human, at the gate) — AC-18's mechanism.** Mechanism A moves the root manifest and
the lockfile and rests on an unverified assumption about pnpm's bin linking; Mechanism B is honest
and collapses AC-18 into AC-15. M-8 makes the status quo untenable either way. Recommendation: run
the one-command check first; adopt A if it links, and record B with its measurement if it does not.

**OQ-3 (not blocking, implementer, first act of the run) — which branch of M-7 is true?** Pack once,
read the packed manifest's `dependencies`, report it verbatim. AC-19 is satisfiable under either
answer, which is why this is not a blocker; proceeding without measuring it is what would make the
criterion unsatisfiable halfway through.

**OQ-4 (not blocking, reported not resolved) — does `pnpm pack` honour `files` identically to
`npm pack`?** They agree on the forty-path list today (M-6). AC-19 requires the agreement to be
**confirmed** after `files` lands and any divergence reported. Resolving a divergence is out of
scope; hiding one is refused.

**OQ-5 (not blocking, for the gate) — does `docs/01-product-definition.md:33` change, or gain a
footnote?** It is the locked v1 cut's launch test and the sentence every other document defers to.
Correcting it and correcting `docs/decisions/008` are different acts — one is a living document and
the other is append-only — and the requirement's position is that the living document is annotated
with what `npx quorum` will mean at M6 rather than rewritten, so the launch test keeps its shape.
The gate may rule otherwise; either way the ruling is written down rather than inferred from the
diff.

---

## 7. Risks

**R-1 — a verdict taken from the checkout.** The single likeliest way this ticket ships something
broken. `dist/` is gitignored, `test` has no `^build` edge, and every assertion about the target's
existence, shebang, mode and behaviour is green in this working tree before a line is written. AC-15(c)
and AC-22 are the mitigation; the discipline is that **every** new assertion is demonstrated red
against `main` and the red is shown in the report, not described.

**R-2 — AC-19 discovered mid-run to be unsatisfiable.** M-7 is the finding that makes this a managed
risk rather than a surprise. If it is not measured first (OQ-3), the shape of the fixture is decided
after it has been written, which is where an implement step starts arguing with a criterion it cannot
amend (GO-2).

**R-3 — an AC-21 edit turning `docs.test.ts` red for a reason unrelated to the ticket.** M-11 names
both mechanisms: the exactly-once `dist/**` clause and the Q-0041 status-line assertion. Both are
cheap to avoid and expensive to diagnose from a review report.

**R-4 — the eleventh instance of a loop handed work no step in it can perform.** `CLAUDE.md` is
outside the implement role's write paths and carries the glossary term list (M-10). Named in advance
here and in GO-5, which is what Q-0062's entry says the requirement's job is; whether it is heard is
the run's business.

**R-5 — scope creeping into Q-0091's territory through the binary.** A `bin` target that works is an
invitation to add a command to see it do something. `COMMANDS` gains nothing (non-goal 4), and
`frame.source.test.ts`'s AC-8 scan is what fails if a domain helper arrives with it.

**R-6 — Q-0039 is unfixed.** Two concurrent runs on one ticket compute the same run id and share a
worktree. GO-4.

**R-7 — the pack fixture leaving directories behind.** It creates a temporary project, an npm cache
and up to three tarballs. `build.test.ts`'s `isolated` register plus an `afterAll` is the established
shape; a fixture that leaks under `os.tmpdir()` on every suite run is a defect this repository has
already paid for once, in worktrees.

---

## 8. Cross-cutting checklist

- **BYOS.** No API-key path is added anywhere, including in the pack fixture's environment and in any
  registry configuration. `frame.source.test.ts`'s AC-12 scan walks the whole package pruning
  `node_modules`, `.turbo` and `dist`, so a **tracked** `bin/quorum.js` is scanned by it and its
  third test requires the credential-matching set to be exactly the guard file — worth knowing before
  the file is written, not after.
- **Worktree safety.** Nothing here writes to a user's working tree. The pack fixture works entirely
  under `os.tmpdir()` and removes what it made. The build writes only into `dist/`, which AC-8 of
  Q-0097 already bounds.
- **Gate behaviour.** No flow, gate or loop bound changes. AC-17's `undecided` → 3 row is asserted as
  a table row; the run status that produces it is Q-0094's.
- **File format and schema.** No schema moves. `package.json`'s `files` and `bin` are npm's format,
  not Quorum's.
- **Lint rules.** `harness lint` is untouched. ESLint's scope is unchanged — and note that a tracked
  `bin/quorum.js` falls outside `packages/**/*.ts` and is therefore linted and typechecked by
  nothing, which AC-23 states as a cost rather than discovering later.
- **Cold-clone impact.** This is the first ticket that *shortens* the first thirty minutes rather
  than lengthening them: it is what makes a command exist to type. AC-21 is what stops it from being
  shortened dishonestly.
- **Product boundaries.** The product is Quorum and the binary is `quorum`; neither is called a
  harness, and `harness/` is never called quorum. Any new documentation sentence obeys this the
  first time, as `commands.ts`'s `HELP` already does.
- **`spike/`.** Untouched. `packages/core/src/spike-parity.test.ts` is re-derived rather than
  adjusted in the same change (ground rule 5); this ticket adds no file under `spike/test/`, so the
  expectation is that the totals **do not move** from 5428 lines and a 55% entangled share — and
  *"it did not move"* is stated in the report rather than skipped, which is this repository's own
  idiom for a register that was checked.

---

## 9. Gate obligations

**GO-1 — the precondition is met.** *"The emit serves the binary, and no test verdict moves behind
it"* (2026-09-02) is landed, and Q-0097 shipped the artifact it rules. Verified: `packages/cli/dist/`
holds fourteen emitted files and `turbo.json` declares `build` with `outputs: ["dist/**"]`.

**GO-2 — Q-0083 does not exist.** An implement step that meets a finding it may not act on still has
no `blocked` verdict. The remedy is an erratum written **during** the loop, as soon as the
contradiction is provable — *"A refused finding is a gate, not another round"* (2026-08-31). Q-0097's
run cost two errata by writing one from a claim rather than from a measurement; an erratum here
states what was **run**, not what was reasoned.

**GO-3 — unmet, and blocking.** `git branch --list 'harness/Q-0098*'` returns nothing.
`harness/Q-0098/integration` must exist before the first chore run, per
`docs/02-sdlc-pipeline-spec.md` §5.8: `review` diffs against that branch and only `integrate`, which
runs later, creates it. Cut it deliberately from the requirements tip rather than from whatever
`HEAD` holds, on Q-0037's GA-2 precedent.

**GO-4 — Q-0039 is unfixed.** Do not run concurrently with any other ticket, and specifically not
with Q-0091 to Q-0095.

**GO-5 — new, and it is a surface question.** AC-21's glossary work implies extending the term list
that appears **identically** in `docs/README.md:28` and `CLAUDE.md:13`. `docs/README.md` is inside
`developer-generalist`'s write paths; **`CLAUDE.md` is not**, and nothing mechanically checks that
the two lists agree. The implement step updates the glossary and `docs/README.md`, and **reports**
`CLAUDE.md:13` as the human's to extend at the gate. This is named in advance because the alternative
is the pattern this repository has recorded ten times: a loop spending its budget on work no step in
it can perform. See *"`.claude/rules/` is a derived copy, not a surface a requirement may name"*
(2026-08-27), which added *is it derived?* to the two questions routing already asked of a surface —
this is the third question, *is it reachable?*, on a file that is neither derived nor writable.

---

## 10. What the implementer does first

In order, because three of these change what the rest of the work looks like:

1. `pnpm install --frozen-lockfile && pnpm turbo run build` — confirm the emit is there before
   asserting anything about it. Your worktree has no dependencies until you install them
   (`harness/rules.md`).
2. Resolve `bin.quorum` from the manifest and spawn it. **Capture the `ENOENT`** — that is AC-15's
   red and the report must carry it.
3. Answer OQ-3: pack once, read the packed manifest's `dependencies`, report the block verbatim.
   AC-19's fixture is written after this, not before.
4. Answer OQ-2's measurement: whichever mechanism the gate ruled, run
   `ls node_modules/.bin` after an install and report what is there.
5. Then write code.

Both suites, forced, in both environment rows before the report is written —
`npm test --prefix spike` and `pnpm turbo run test --force`, in the integrate worktree and again on
`main` after the merge (Q-0072's closing finding). `pnpm sweep:git-identity` runs in a linked
worktree since Q-0058; run it.
