# Q-0072 — implementation report (revision round 2)

*Written in the worktree `harness/Q-0072/implement`, 2026-08-28. All measurements below were taken
inside that worktree — `git rev-parse --git-dir` reports
`/Users/…/quorum/.git/worktrees/harness__Q-0072__implement` — which is where `integrate` runs, and
turbo announced `using shared worktree cache` on every invocation. AC-5's worktree re-check is
therefore satisfied by construction rather than by a separate probe.*

---

## 1. The finding, and what closed it

Round 2 returned one major, at `packages/core/src/turbo-inputs.test.ts:684`:

> Clause C only prohibits `fileURLToPath` outside the route modules and scans calls under their
> original helper names. A test can therefore import `repoFile` under an alias and pass a computed
> argument, or derive the repository root through `process.cwd()` and read a computed path; neither
> clause B nor C will see the resulting out-of-package read. […] Make the escape-route check account
> for import aliases and fail closed on repository-root derivations/read APIs rather than
> recognizing only `fileURLToPath`, with independent fixtures demonstrating both bypasses fail.

Both bypasses were real. `routeSites` matched a fixed list of seven names, so
`import { repoFile as readDoc }` made `readDoc` invisible; and the derivation check was a single
`codeOnly(text).includes('fileURLToPath')`, so `process.cwd()` — which under Vitest is the package
root, one `dirname` from the workspace — was an unwatched way to the repository.

Clause C is now three sub-clauses. Each fails closed against a register a reviewer approves, rather
than recognising a list of bad shapes.

**C1 — routes, resolved through the calling file's own import bindings.** `routeImports(file, text)`
finds every static import whose specifier resolves to a route module, reads its clause, and returns
the local names bound to route exports. `routeSites` then scans for *those* names. An alias is
followed; `import { parse as parseYaml } from 'yaml'` in `test-command.test.ts` is **not** a route,
which a global name list would have got wrong in the other direction and thereby taught the next
reader that the register is noise. Every import form the scan cannot follow is reported rather than
passing as an absence of sites: a namespace import, a default binding, a re-export, a dynamic
`import()`, or a member naming an export the classification does not cover.

**C2 — root derivation.** Twelve primitives (`fileURLToPath`, `pathToFileURL`, `import.meta`,
`__dirname`, `__filename`, `process.cwd`, `process.chdir`, `process.argv`,
`process.env.INIT_CWD`, `process.env.PWD`, `homedir`, `createRequire`) are refused outside the two
corpus modules unless entered in `ROOT_DERIVATIONS` with the reason they reach no corpus file. Six
sites exist today; four of them are product source, where deriving a working directory is the CLI's
own behaviour rather than a test reaching for a file.

**C3 — escaping literals.** No string literal may climb out of its own package. This is the clause
the review did not name and I judged to be the same class: `fs.readFileSync('../../docs/GLOSSARY.md')`
takes no route, derives no root, and names a path `pathLiterals` **discards** — it drops every value
beginning `..`. Dropping them was only ever safe if nothing could read through one, and nothing
checked that. Four real sites exist and are registered as data (an import-specifier prefix compared
as text, an allow-list entry, a hostile git argument), plus seven in the guard file itself for its
own predicate constants and fixture expectations.

### Why the three are exhaustive

Stated in the file so the argument can be attacked rather than the code. To read a file, something
must name it, and a name is either a literal or an expression. A repository-relative literal is
collected by clause B and must be declared. An absolute or `..`-escaping literal is refused by C3.
An expression must be rooted somewhere: at a route, which C1 watches under whatever local name it
was imported as, or at a root the file derived for itself, which C2 refuses.

**The residual hole, named rather than implied:** a base produced by a primitive C2's list does not
contain. That is precisely why C2 is a register and not a filter — a new primitive costs somebody an
entry and a reason. I have not closed it and I do not claim to have.

### Two limits I chose deliberately

- **`os.tmpdir` is not on C2's list.** A temporary directory is outside the repository by
  construction, so reaching corpus from one needs a second derivation that C2 *does* name, and
  registering the seven sandbox sites would fill the register with entries carrying no information.
- **C3 does not treat a leading `/` as absolute.** After a template's hole it is the separator in
  `` `${dir}/ticket.md` ``, and an absolute literal cannot portably name *this* repository anyway —
  it would be machine-specific and fail loudly on the next checkout. Treating it as absolute
  collected thirteen fabricated `/tmp/…` paths from the adapter suites; a `..` segment is still
  refused wherever it appears, including after a hole.

### A second gap the same finding exposed

Round 1's finding was about paths the scan could not see. Round 2's is about *routes* it could not
see. Chasing the second showed that four exports of `packages/shared/test/corpus.ts` were routes
nobody was watching at all: `read`, `parseYaml`, and (in `core`) `coreSourceFiles`. `ROUTE_MODULES`
now classifies **every** export of both corpus modules as a route or as inert with a reason, a test
reads the export lists back out of both files, and an export in neither column fails by name. That
is what makes "the named corpus helpers are the only route out of a package" a checkable claim
rather than a list somebody remembered to update.

---

## 2. Every clause demonstrated, twice

Per Q-0071's rule — *demonstrating that a guard has a subject proves the guard fires, not that each
of its clauses does* — each bypass is demonstrated **in isolation**: the fixture trips its own clause
and provably not the others.

### As string fixtures, in the suite

| Fixture | Trips | Proved not to trip |
| --- | --- | --- |
| `repoFile(\`docs/${slug}.md\`)` | C1, template literal | no `repoRoot` site |
| `import { repoFile as readDoc } …; readDoc(\`docs/${slug}.md\`)` | C1, **alias** | `derivationSites` `[]`, `escapingLiterals` `[]`, and `indirect(fixture, IDENTITY)` is `[]` — *a fixed list of names is exactly what this bypass evades* |
| `const root = process.cwd(); fs.readFileSync(path.join(root, computed))` | C2, **alternative root** | no bindings, no route sites, no escaping literal |
| `path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")` | C2 | no route sites |
| `fs.readFileSync('../../docs/GLOSSARY.md')` | C3 | no derivation, no route site, **and `pathLiterals` returns `[]`** — clause B is structurally blind to it |
| `import * as corpus …` / default / re-export / dynamic / unclassified member | C1's problems channel | each asserted separately, plus two negative controls |

### Live, against a real file

A scratch module was placed at `packages/core/test/scratch.ts` — inside the scanned set, outside the
route modules — one bypass at a time, and removed afterwards.

| Scratch content | Result |
| --- | --- |
| `import { repoFile as readDoc } from './corpus.js'` + `readDoc(\`docs/${slug}.md\`)` | **1 failed / 39 passed** — `packages/core/test/scratch.ts: readDoc → \`docs/${slug}.md\`` |
| `path.dirname(path.dirname(process.cwd()))` + a computed read | **1 failed / 39 passed** — `packages/core/test/scratch.ts: process.cwd` |
| `fs.readFileSync('../../docs/GLOSSARY.md', 'utf8')` | **1 failed / 39 passed** — `packages/core/test/scratch.ts: ../../docs/GLOSSARY.md` |
| `import * as corpus from './corpus.js'` + `corpus.repoFile(name)` | **1 failed / 39 passed** — *imports ./corpus.js as a namespace, so every route reaches it through a member access* |

Each failed exactly one test. My first attempt at the second one used `'..'` literals and tripped
**two** clauses; I rewrote it as `path.dirname(path.dirname(…))` so it isolates. That is recorded
because it is the kind of detail that makes an "independent fixture" claim untrue.

### And the whole guard, demonstrated against the pre-ticket configuration

With `packages/*/turbo.json` removed and `dependsOn` dropped from the root, `pnpm test` reports
**17 failures** in `turbo-inputs.test.ts` — clause A on every manifest entry and every walk, clause B
on both suites, and the dependency-edge assertions. The guard is red over the tree it exists to
refuse, before it is trusted over the tree it blesses.

---

## 3. Files changed

### This round

**`packages/core/src/turbo-inputs.test.ts`** (+473 / −65) — the only source file touched this round.

- Module doc rewritten: clause C is now C1/C2/C3, with the exhaustiveness argument and the two
  deliberate limits stated where a reader meets them.
- `codeOnly` became `scanSource`, which now also returns the string bodies it blanks (template
  chunks included, module specifiers excluded). `codeOnly` remains as its code half.
- `ROUTES` (a flat array) and `ROUTE_MODULES` (a flat array) became one `ROUTE_MODULES` record
  classifying every export of both corpus modules as `routes` or `inert`.
- New: `Binding`, `IDENTITY`, `resolveModule`, `routeImports`, `DERIVATIONS`, `derivationSites`,
  `ROOT_DERIVATIONS`, `escapes`, `escapingLiterals`, `ESCAPING_LITERALS`, `scanned`, `indirect`,
  `sitesIn`, `exportsOf`.
- `routeSites(text)` became `routeSites(text, bindings)`; `repoRoot`'s special handling now keys on
  the *exported* name, so an aliased root is still handled.
- `INDIRECT_ROUTES` gained ten entries for the newly watched routes (`read`, `parseYaml`,
  `coreSourceFiles`) and one for this file's own `repoFile(file)`.
- The single `clause C` describe block became three, of 10 + 4 + 4 tests. The file went from 30 to
  40 tests.

**`packages/core/turbo.json`, `packages/shared/turbo.json`** — one comment block each, no change to
any declaration. This answers **OQ-3**, which asked me to verify rather than assume: turbo 2.10.11
accepts JSONC comments — the same dry run resolves 108 and 133 inputs with the comments present and
emits no warning. The comment says what a hit on that task claims and names the guard that enforces
it. **The root `turbo.json` deliberately gets none**, because
`packages/core/src/test-command.test.ts` `JSON.parse`s it for Q-0065 AC-6 and a comment would break
that assertion.

### Rounds 1–2, recapped because the review diffs `integration...implement`

- **`turbo.json`** — `dependsOn: ["^lint"]`, `["^typecheck"]`, `["^test"]` on the three tasks.
  `globalDependencies`, `outputs` and `env: ["QUORUM_REAL_CLI"]` untouched.
- **`packages/shared/turbo.json`** (new) — `extends: ["//"]`, `test.inputs` = `$TURBO_DEFAULT$` plus
  16 globs: five `docs/` files, `harness/harness.yaml`, `harness/flows/*.yaml`, `harness/roles/*.md`,
  `backlog/*/ticket.md`, `spike/bin/harness.js`, `spike/src/**`,
  `spike/templates/harness/harness.yaml`, and three files under `packages/core`.
- **`packages/core/turbo.json`** (new) — same shape, 13 globs: `.github/workflows/ci.yml`,
  `turbo.json`, `pnpm-lock.yaml`, `docs/03`, `docs/04`, three frozen contracts,
  `backlog/*/ticket.md`, `harness/flows/*.yaml`, `spike/src/**`,
  `spike/templates/harness/flows/*.yaml`.
- **`packages/core/src/test-command.test.ts`** (+58) — the AC-9 parity guard: the workspace job and
  the three root scripts must name the same task set; the scripts must stay unforced and gain no
  `:ci` sibling; and a fixture that drops a task fails it.
- **`.github/workflows/ci.yml`** — the workspace-job comment corrected (AC-10a).
- **`docs/04-architecture.md`** — status line, and a new Testing bullet on what a hit claims
  (AC-10b).

---

## 4. Criterion by criterion

### AC-1 — the escaping input proved through a **real** cache

`pnpm turbo run test --filter @quorum/shared`, unforced, four steps. The side effect of execution is
a marker file written by a temporary test in `packages/shared/src` (removed afterwards) — so a
changed summary label alone could not satisfy this.

| Step | turbo says | Marker |
| --- | --- | --- |
| 1. first run | `cache miss, executing 82396f949f2d96dd`, 11 test files, **485 ms** | **written** |
| 2. marker deleted, nothing else changed | `cache hit, replaying logs 82396f949f2d96dd`, **8 ms**, `FULL TURBO` | **absent** — the suite did not run |
| 3. one line appended to `docs/GLOSSARY.md` — matched **only** through `../../docs/GLOSSARY.md` | `cache miss, executing cd630f6131cd8a6c`, **482 ms** | **written** |
| 4. that line reverted | `cache hit, replaying logs 82396f949f2d96dd`, **10 ms** | absent |

Step 4 restores the *original* key, so the escaping input participates in the hash rather than
merely defeating it. Escaping inputs are honoured through a real cache write and restore, inside a
git worktree resolving to the main checkout's cache. No fallback was needed and none was chosen.

### AC-2 — every out-of-package read is a hashed input

`Inputs Files Considered`, from `pnpm turbo run test --dry`:

| task | before | after |
| --- | --- | --- |
| `@quorum/shared#test` | **24** | **108** |
| `@quorum/core#test` | **57** | **133** |
| `cli`, `compiler`, `server`, `templates` | 5 | 5 |
| `web` | 6 | 6 |

Two notes rather than a silent discrepancy. The ticket body records the core baseline as **56**; the
57 here is that plus `turbo-inputs.test.ts`, which this branch adds to `packages/core/src`. And the
shared baseline hash measured today, `7152b03db47071bb`, is **byte-identical to the one the ticket
body recorded on 2026-08-28** — an inherited measurement that survived re-derivation, which is worth
saying in a repository where three did not.

`$TURBO_DEFAULT$` is first in both arrays, so the package-relative set is preserved rather than
replaced; the five scaffold packages did not move, as AC-2 expects. Clause A of the guard asserts the
containment relation the table only summarises: every manifest entry and every file of every audited
walk is present in turbo's reported input set.

The closure AC-2 names is real: `@quorum/core#test` declares `turbo.json` and
`.github/workflows/ci.yml`, so the Q-0065, Q-0071 and Q-0072 guards are now inputs of the task that
runs them.

### AC-3 — corpus inputs on `test` only

One line appended to `docs/GLOSSARY.md`, after-state:

- `@quorum/shared#test` `fe49e53baeff6bc9` → `d44299debda7df68`
- `@quorum/core#test` `df1b2bf629fd30e9` → `a9016326989cd6eb` *(through the `^test` edge, not an input)*
- **all seven `lint` hashes unchanged**, all seven `typecheck` hashes unchanged.

### AC-4 — a change in `shared` invalidates `core`'s three checks

One line appended to `packages/shared/src/constants.ts`, after-state:

| task | clean | edited |
| --- | --- | --- |
| `@quorum/core#test` | `df1b2bf629fd30e9` | `80920305dd4021a3` |
| `@quorum/core#lint` | `53972992f43c4069` | `8e47701b8d18345c` |
| `@quorum/core#typecheck` | `608bd48f33a88d93` | `fdbdb80684d08536` |

`--dry=json` reports `@quorum/core#test`'s `dependencies` as `["@quorum/shared#test"]` and
`@quorum/shared#test`'s as `[]` — one-directional, no cycle, and `shared`'s reads of `core`'s files
are carried by **inputs**, which the guard asserts explicitly rather than letting an edge excuse a
package it does not point at.

A detail worth recording: adding `dependsOn` moved **no** scaffold hash (`cli` `4bfd92c23887bcd7`,
`compiler` `a03caf3e70bc9955`, `server` `44becfd47bd8691b`, `templates` `fd1284b209fbef6f`, `web`
`3e8f8de3403bac1a`, identical before and after). Turbo hashes the *resulting* dependency hashes, not
the `dependsOn` declaration, so a package with no workspace dependencies is untouched.

### AC-5 — both failures reproduced before, absent after

Pre-ticket configuration restored (package configs removed, `dependsOn` dropped):

| probe | before | after |
| --- | --- | --- |
| append to `docs/GLOSSARY.md` | `core` `fd36892b3b46adae` → **unchanged**; `shared` `7152b03db47071bb` → **unchanged** | both move (AC-3 above) |
| append to `packages/shared/src/constants.ts` | `shared` `7152b03db47071bb` → `4ec2b90167a30292`; `core` `fd36892b3b46adae` → **unchanged** | all three `core` hashes move (AC-4 above) |

The worktree half needed no separate probe: every command in this report ran inside
`.harness/worktrees/harness__Q-0072__implement`, and turbo reported `using shared worktree cache`
each time. Every probe was reverted; `git status --short` lists only the three intended files.

### AC-6 — no hash moves for a file nothing reads

The claim was verified, not asserted: `grep -rn "05-design-prompt" packages spike/test spike/src apps
.github` returns three hits, all in the guard, all of which check that the file *exists* and that it
is **not** covered — none opens it. Appending a line to `docs/05-design-prompt.md` left **all 21
hashes** (7 packages × `test`/`lint`/`typecheck`) byte-identical to the clean readings. The globs are
precise, not blanket.

### AC-7 — the drift guard

`packages/core/src/turbo-inputs.test.ts`, 40 tests, three clauses, five registers
(`MANIFEST`, `WALKS`, `NOT_READ`, `INDIRECT_ROUTES`, `ROOT_DERIVATIONS`, `ESCAPING_LITERALS`). It
fails rather than skips when turbo is absent (`reported()` throws on a missing binary), when a
manifested file is gone, when a walk collects nothing, when a corpus directory is missing, and when a
route module no longer exports what the classification names. Every register also has a
staleness test, so an entry that outlives its site fails.

**Reported honestly:** OQ-2 permitted the escape-route half to be reported as unachieved rather than
faked. I did not need that escape, but the clause is not a TypeScript parser and its limit is written
into the file — the two `test/corpus.ts` modules are exempt (they are where routes are defined), and
C2's list is closed. Neither is hidden.

### AC-8 — nothing that forces stops forcing

`.github/workflows/ci.yml` still runs `pnpm turbo run lint|typecheck|test --force` (lines 32–34) and
restores no turbo task-result cache; `actions/setup-node`'s `cache: pnpm` is untouched.
`harness/harness.yaml` is not in the diff. The Q-0065 and Q-0071 guards pass unchanged.

### AC-9 — `package.json` and CI name the same task set

Guarded in `test-command.test.ts` by three tests, including a fixture that drops `typecheck` from the
workflow while keeping every other task forced and restoring no cache, so the parity clause is the
only thing wrong with it. `package.json` gained no `--force` and no `:ci` script.

### AC-10 — the two claims this change falsifies

(a) The workflow comment now says what is true and says it precisely: it was the guard's **subject**
that nothing hashed, never the guard file, which has always been inside its own package.
(b) `docs/04-architecture.md` states both claims — *"nothing this task reads has changed"* against
the earlier *"nothing inside this package has changed"* — and that CI's claim is different and
stronger because CI forces.

### AC-11 — `turbo.json` still validates; nothing experimental adopted

The `test` task's `env: ["QUORUM_REAL_CLI"]` is untouched and still `env`, and the guard asserts that
each package's resolved definition still carries it — turbo merges a package configuration into the
root definition per key rather than replacing it, and a turbo that replaced would silently drop the
paid-probe switch for exactly the two packages that have a package configuration. Schema enforcement
was demonstrated rather than assumed: renaming `dependsOn` to an unknown key made turbo exit with
`Found an unknown key`. No `futureFlags`, no root-level `inputs` block, no new dependency, no turbo
upgrade.

### AC-12 — cost measured, and both `dependsOn` consequences recorded

`pnpm test` (whole workspace, unforced), three samples per cell, each sample given a distinct edit so
that it is genuinely a miss and not a replay of the previous sample:

| state | before | after |
| --- | --- | --- |
| no edit | 10, 9, 7 ms — 7 cached | 9, 8, 8 ms — 7 cached |
| `docs/GLOSSARY.md` edited | **9, 7, 9 ms — 7 cached, `FULL TURBO`** | 27.39, 26.22, 27.16 s — 5 cached |
| `packages/shared/src` edited | 482, 488, 490 ms — 6 cached | 26.90, 25.76, 26.69 s — 5 cached |

The middle-left cell is the ticket, measured: a documentation file the `shared` suite asserts on is
edited and `pnpm test` reports every package green in nine milliseconds.

An unchanged local run still replays in under 10 ms, which is what AC's non-goal asks for. The cost
lands on the two states where something the suites read has actually changed.

*The before-state timings required parking `turbo-inputs.test.ts`, because the guard is red under the
pre-ticket configuration and turbo does not cache a failure. That is stated rather than worked
around.*

**Consequence 1 — waves.** Forced whole-workspace `test`: **27.199 s** before (one wave) against
**27.494 s / 27.699 s / 27.065 s** after (two waves). The edge costs roughly the length of
`@quorum/shared#test`, ~0.5 s, because `@quorum/core#test` at 26.9 s dominates. Forced `lint` 2.68 s
and `typecheck` 1.42 s after.

**Consequence 2 — a failing dependency skips its dependents.** Measured rather than repeated. With a
deliberately red test in `packages/shared/src`, `pnpm test` reports `5 successful, **6 total**` and
`Failed: @quorum/shared#test` — `@quorum/core#test` was dropped from the run entirely, where before
it would have run and reported its own result. With `--continue`: `6 successful, **7 total**`,
27.13 s. A developer now sees fewer failures per run unless they pass `--continue`.

**Consequence 3, which the requirement names as risk 3 and I confirmed.** `--filter @quorum/core`
now also runs `@quorum/shared`'s same-kind task — observed directly:
`pnpm turbo run lint --force --filter @quorum/core` executed `@quorum/shared:lint` as well. So
Q-0065 AC-8's documented probe command,
`QUORUM_REAL_CLI=1 pnpm turbo run test --force --filter @quorum/core`, now also runs
`@quorum/shared#test`. The assertion pinning that command is on the file's text, so it still passes;
the command's behaviour has moved, and that belongs here rather than in someone's surprise.

### AC-13 — the decision is named, not written

See §6. I did not touch `docs/DECISIONS.md`.

---

## 5. Verification

| check | result |
| --- | --- |
| `pnpm turbo run test --force` | **7 successful, 0 cached, 27.065 s** |
| `pnpm turbo run lint --force` | 7 successful, 0 cached, 2.68 s |
| `pnpm turbo run typecheck --force` | 7 successful, 0 cached, 1.42 s |
| `npm test --prefix spike` | **all 12 test files passed** |
| `turbo-inputs.test.ts` + `test-command.test.ts` | 59 passed |
| `git status --short` | three intended files, nothing else |

The `@quorum/core` suite reports 31 files / 697 tests passed, 1 file / 2 tests skipped — the
`real-cli.probe` file, which is skipped without `QUORUM_REAL_CLI`, exactly as before.

---

## 6. The decision entry, for Ruud to write (AC-13)

**Proposed title:** *A cache hit names what the task reads, not what its package holds — 2026-08-28*

**The sentence that is the ticket.** After Q-0072 a cache hit means: **no file this task reads, and
no same-kind task in a package it depends on, has changed since the cached successful result.** It no
longer means only that files inside the task's own package have not changed.

**Shape chosen: (2) + (3).** Per-task `inputs` as `["$TURBO_DEFAULT$", …out-of-package globs…]`, plus
same-kind `^lint` / `^typecheck` / `^test` edges. Both halves verified on turbo 2.10.11 through a
real cache, not only a dry run.

**Shapes rejected, with reasons:**

- **(1) `globalDependencies`.** Its one virtue is zero drift risk, which AC-7's guard answers
  directly. Its cost is invalidating all 21 task-package pairs on every `docs/` edit — roughly a full
  cold workspace run per documentation commit, in a repository where `docs/` changes on every ticket.
- **(4) relocating the cross-tree corpus assertions.** Touches landed, reviewed tests in two
  packages, to make a configuration file easier. The requirement lists it as a non-goal and the guard
  turned out to be practical.
- **Root-level `inputs` with `futureFlags.globalConfiguration`.** Turbo 2.10.11 offers it and gates it
  behind an experimental flag. Adopting an experimental configuration surface is a decision, not an
  implementation choice; the chosen shape needed no flag.

**Granularity, per OQ-1, decided per package by cost rather than symmetry.** `@quorum/core#test` is
the 27-second task and reads only `docs/03` and `docs/04`, so it gets those two files by name and
**no blanket `docs/**`** — otherwise every DECISIONS entry would re-run it. `@quorum/shared#test` is
the 0.5-second task and already reads `docs/DECISIONS.md` and `docs/GLOSSARY.md`; it too is declared
file by file, because five named files are as cheap to write as one glob and the guard makes drift
visible either way. Directory globs are used only where the suite genuinely walks a tree
(`spike/src/**`, `contracts/Q-0006/**` equivalents, `harness/flows/*.yaml`, `harness/roles/*.md`,
`backlog/*/ticket.md`).

**The two consequences, stated rather than discovered:** the task graph gains edges, so `shared`
completes before `core` and a forced run goes from one wave to two, at a measured ~0.5 s; and a
failing dependency now **skips** its dependents rather than reporting them — 6 tasks in the run
instead of 7 — unless `--continue` is passed.

**The cost accepted:** a local `pnpm test` after a `docs/` edit goes from 9 ms to ~27 s, and after a
`packages/shared/src` edit from ~0.5 s to ~27 s. An unchanged run still replays in under 10 ms. This
is the third time this repository has bought honesty with wall time, and the first time the bill
lands on the maintainer's own keystrokes rather than on a runner.

**Worth carrying into the entry, because it is the general lesson:** `backlog/*/ticket.md` is now an
input of `@quorum/shared#test`, which means every ticket edit invalidates it — including a run's own
ticket folder, mid-run. That is correct, it is exactly the miss Q-0071's evening produced, and it is
harmless while `integrate` forces. It should not be rediscovered later as a defect.

---

## 7. What I deliberately left alone

- **`docs/DECISIONS.md`** — the role's own instruction. Named above, not written.
- **Anything under `backlog/`** — reverted by `commitAll` before every agent commit.
- **`harness/harness.yaml`, `package.json`, `turbo.json`'s `globalDependencies`, `outputs` and
  `env`** — outside this ticket, and AC-8/AC-11 require them untouched.
- **What CI or `integrate` force.** Q-0065 and Q-0071 stand. This ticket is about what a *hit*
  claims.
- **Whether CI should go back through `package.json`'s scripts.** That reverses part of a dated
  decision entry; AC-9 guards the divergence and Successor B decides it.
- **Shape (4).** No landed test was relocated to make the configuration easier.
- **An automated real-cache fixture on CI.** Successor A, out of scope by the requirement's own
  non-goals; AC-1 is the one-time proof.
- **The root `turbo.json` comment.** Deliberately omitted — `test-command.test.ts` `JSON.parse`s that
  file, and a JSONC comment would break Q-0065 AC-6.
- **`packages/core/src/backlog/project.ts`, `adapters/claude.ts`, `adapters/codex.ts`.** Their
  `process.cwd()` calls are now registered with reasons rather than changed; they are product
  behaviour and this ticket does not authorise touching them.
- **The spike.** `npm test --prefix spike` is not a turbo task and hashes nothing. Unchanged and
  green.

## 8. Open questions, answered

- **OQ-1 — glob granularity.** Decided per package; recorded in §6.
- **OQ-2 — can the guard identify reads without a second fragile parser?** Yes, and the answer is
  three fail-closed clauses plus registers rather than a parser. The manifest half was never at risk;
  the escape-route half is achieved for aliases, root derivations and escaping literals, with its
  residual limit written into the file.
- **OQ-3 — does `turbo.json` accept comments?** **Yes**, verified on turbo 2.10.11: both package
  configs carry a comment block and the dry run resolves 108 and 133 inputs with no warning. One line
  naming the claim now sits beside the declarations, in the package configs only.
- **OQ-4 — does turbo already fold `turbo.json` into every task hash?** Verified rather than reasoned
  about: it does **not**. Under the pre-ticket configuration, removing `dependsOn` and both package
  configs changed `@quorum/core#test`'s hash (it changes the resolved definition), but `turbo.json` is
  not among any task's *reported inputs* — only the four `globalDependencies` are root-relative.
  Declaring `../../turbo.json` for `@quorum/core#test` is therefore load-bearing, not redundant: it is
  what makes the file that `test-command.test.ts` asserts over an input of the task that asserts it.
