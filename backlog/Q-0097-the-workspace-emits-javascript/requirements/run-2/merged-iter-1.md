# Q-0097 — The workspace emits JavaScript

*Requirements, run 2, merged. Judged and merged at the gate against the tree at `9efffdb`
(2026-09-02), after `main` carried Q-0096's merge. Two candidates: `claude` and `codex`.*

*Every figure marked **(verified at the gate)** was re-run by the merging step itself rather than
relayed from a candidate — Q-0010 ground rule 5, and *"a measurement copied from a document is not a
measurement"* (Q-0058). Three concrete file pointers in the candidates and in the ticket body were
wrong; they are corrected in place below and named in §11 so the correction is visible rather than
silent.*

---

## 1. Problem

`packages/core` declares `"exports": { ".": { "quorum-source": …, "default": "./dist/index.js" } }`
and `packages/cli` declares `"bin": { "quorum": "./bin/quorum.js" }`. Both point at files that do not
exist. **(verified at the gate)** — there is no `dist/` anywhere under `packages/` or `apps/`, and
`packages/cli/bin` is absent.

That is Q-0096 working as designed. It ruled where the artifact will be and proved the resolution
machinery sends `tsc` and Vitest to source and a plain `node` process to the emit; it deliberately
built nothing. The workspace today has a manifest promising an artifact, a resolver configured to
find one, and nothing that produces one.

**(verified at the gate)** Root `turbo.json` declares exactly `lint`, `typecheck` and `test`, each
`"outputs": []`; `tsconfig.base.json` declares `customConditions: ["quorum-source"]` but no `outDir`,
no `rootDir` and no `declaration`; the three package-level `turbo.json` files declare `inputs` and
nothing else; no package declares a `build` script.

The cost is not felt here. It is felt at Q-0098, which cannot make `quorum` run, and at Q-0095, which
cannot exercise the binary. This ticket produces the artifact those two consume, and does it
**without moving a single existing verdict behind it** — which is what *"The emit serves the binary,
and no test verdict moves behind it"* (2026-09-02) rules.

There is a second problem, and it is what makes this more than a configuration edit. **A `build` task
with real `outputs` introduces a class of failure this repository has never had.** `lint`, `typecheck`
and `test` all declare `"outputs": []`, so a hit on any of them replays a *verdict* — the failure
Q-0065, Q-0071 and Q-0072 each closed one layer of. A hit on `build` replays an **artifact**, and an
artifact something downstream executes fails differently: the stale tick lies about the past, the
stale artifact lies about the present. AC-8 to AC-11 exist to bound the new class before anything is
built on top of it.

**And there is a live instance of the hazard in the working tree as this is written.**
`packages/shared/test/corpus.js` and `packages/shared/test/corpus.d.ts` are untracked, dated
2026-09-02 09:14 — during this ticket's own run 1 — and are `tsc` output emitted beside its source
because nothing configured an `outDir`. **(verified at the gate)** `git check-ignore -v` **exits 1**
for both: no rule in `.gitignore` matches them, so they are neither ignored nor tracked, and turbo
hashes them as untracked-unignored input (Q-0073). They are not a defect this ticket introduces; they
are the argument for AC-8 arriving as an event rather than as a prediction, and GO-5 removes them
before the run.

---

## 2. User stories

- **`maintainer`.** *I run one command from a clean checkout and get JavaScript I can hand to Node. I
  never have to remember to build first, and when turbo tells me a build was cached I get back a file
  that runs — not a claim that a file once ran.*
- **`maintainer`.** *Adding a fourth task does not silently narrow the two registers asserting which
  tasks every package owes. If a package starts or stops emitting, something goes red.*
- **`contributor`.** *My existing `pnpm test` and `pnpm typecheck` go on examining TypeScript source,
  so adding an emitted artifact does not quietly change what an existing verdict proves.*
- **`contributor`.** *When I add a package I am told whether it owes a `build` script by a check, not
  by a doc comment that stopped being true.*
- **`adopter`.** ***n/a this ticket***, and named so its absence is a ruling rather than an oversight.
  The adopter's first thirty minutes are Q-0098's and Q-0028's; nothing here changes what an adopter
  runs or adds a command they must learn.

---

## 3. What was re-verified at the gate

Nine claims were re-run against the tree before a criterion was written on them. Six confirmed a
candidate, three corrected one.

### R-1 — The decisive finding: `@quorum/core`'s emit will not run, and the ticket body has no criterion for it

**Reproduced at the gate. (verified)** From `packages/core`, a plain `node` process resolves
`@quorum/shared` to **TypeScript source** and then dies:

```
$ cd packages/core && node --input-type=module -e "console.log(import.meta.resolve('@quorum/shared'))"
file:///…/quorum/packages/shared/src/index.ts

$ cd packages/core && node --input-type=module -e "await import('@quorum/shared')"
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '…/packages/shared/src/constants.js'
                              imported from '…/packages/shared/src/index.ts'
```

The cause is one manifest. **(verified at the gate)** `packages/shared/package.json` declares

```json
"exports": { ".": { "types": "./src/index.ts", "default": "./src/index.ts" } }
```

— **a flat map with no `quorum-source` condition**, unlike the one Q-0096 gave `@quorum/core`.

The consequence is exact: `packages/core/dist/index.js` will carry `import … from '@quorum/shared'`,
Node will resolve that specifier to `./src/index.ts`, and it will die as above. **So AC-9's *"the
restored artifact is executed or imported successfully"* cannot pass, and no honest reading of AC-8
can either, until `@quorum/shared` gains the same conditional map and its own emit.**

This is **an unmet clause of the governing decision, not new scope.** 078(b) reads: *"Each consumable
package's `exports` becomes a conditional map in which a workspace-only condition resolves
`./src/index.ts` and the default resolves `./dist/index.js`."* Q-0096 satisfied it for `@quorum/core`
and reported the `@quorum/shared` half as inherited-and-unfixed. **What is missing is a criterion:**
the ticket body's AC-7 to AC-14 do not mention `packages/shared` once. That is **AC-22**.

**The candidates split here and the split is decisive.** The `claude` candidate found it, reproduced
it and wrote AC-22. The `codex` candidate requires `@quorum/shared` to *emit* (its AC-7.3) and
requires the restored JavaScript to load under plain Node (its AC-9.5) — but **never requires the
exports map to change**, so under its criteria alone `shared/dist/` exists, Node still resolves
`./src/index.ts`, and AC-9.5 fails for a cause no criterion names. An implementer working from the
codex set reaches an unexplained `ERR_MODULE_NOT_FOUND` mid-round and has, per GO-2, no `blocked`
verdict — only prose the human does not read until the gate.

**One figure moved and it is 078's own.** That entry states `packages/core/src` holds 53 `.ts` files
naming `@quorum/shared` — *"21 production, of which 14 carry a value import, and 32 tests"*.
Re-derived at the gate by parsing each `import … from '@quorum/shared'` statement and classifying it
by whether any binding is un-prefixed by `type`: **55 `.ts` files name it; 21 production files import
it, of which 17 carry a value import and 4 are type-only** — `adapters/override.ts`,
`engine/lifecycle.ts`, `engine/types.ts`, `engine/channel.ts` — **and 31 test files import it.**
**(verified at the gate.)** The production-importer count matches 078 exactly; the value-import count
is **17, not 14**. A landed entry is never edited (`docs-and-decisions.md`), so the figure is
corrected here and 078 is left alone. **Nothing turns on it** — one value import forces the emit and
there are seventeen — but it is stated because a figure carried forward unchecked is what this
repository keeps paying for. Both candidates' handling is noted in §11.

### R-2 — `packages/cli`'s production emit needs no workspace package at runtime, so it is the wrong subject for AC-9

**(verified at the gate)** `packages/cli/src` holds exactly one cross-package import in production —
`import type { RunTerminalEvent } from '@quorum/shared'` at `exit.ts:12` — which `tsc` erases. The one
*value* import of `@quorum/shared` in the package is `exit.test.ts`, a test.

So `packages/cli/dist/index.js` is self-contained today, and 078(g)'s registered limit applies.
**This is why AC-9's execution proof runs against `@quorum/core`'s artifact and not only
`@quorum/cli`'s**: the cli artifact would pass while R-1's defect stood untouched.

**(verified at the gate)** `packages/cli` declares **no `exports` map at all**, only `bin`. Correct,
and this ticket adds none: a `bin` target is resolved by path, not by an export map, and the `bin`
value is Q-0098's.

### R-3 — the ticket body names the wrong file for one of its three guards

The ticket says *"the `--force` guard in `project.test.ts`"*. Two files carry that name.
**(verified at the gate)** The guard is **`packages/shared/src/project.test.ts`** — `forcesTurbo`
defined at `:125` and consumed at `:137` and `:142–148`, asserting over `harness/harness.yaml`'s
`commands.test`. `packages/core/src/backlog/project.test.ts` is `loadProject`'s unit suite and holds
no such assertion. The `claude` candidate caught this; its own line numbers (`:127`, `:130`, `:141`)
are one to two off and are corrected here.

### R-4 — the guard the ticket body misses, and the ruling that keeps it untouched

`packages/core/src/test-command.test.ts:406`, *"the workspace job runs exactly the tasks the root
scripts do"*:

```js
const fromScripts = namedBy(Object.values(scripts()));
expect(fromScripts, 'the root scripts must name at least the three workspace tasks')
  .toStrictEqual(WORKSPACE_TASKS.slice().sort());
expect(namedBy(jobSteps(repoFile('.github/workflows/ci.yml')).map((s) => s.run ?? '')))
  .toStrictEqual(fromScripts);
```

**(verified at the gate)** `WORKSPACE_TASKS = ['lint','typecheck','test']` at `:194`; root
`package.json`'s scripts are those three plus `sweep:git-identity`, which names no turbo task; CI's
`workspace` job runs install then `lint`, `typecheck`, `test`, each `--force`. **So the moment root
`package.json` gains `"build": "turbo run build"`, both assertions go red**, and the second stays red
until CI's `workspace` job also builds.

**Ruled here rather than passed to the gate, and the register's own doc comment is what rules it.**
`:193` reads, verbatim: *"The workspace tasks CI's required check claims to have **executed rather
than replayed**."* **(verified at the gate.)** `build` is the first task in this workspace whose
replay is *legitimate* — that is the entire content of decision 078 — so it may not join a register
whose stated meaning is the opposite.

**The ruling: root `package.json` gains no `build` script, CI's `workspace` job gains no build step;
`WORKSPACE_TASKS`, the `:406` guard and `CI_JOBS` are all untouched.** The maintainer's "one command"
is `pnpm turbo run build`, which needs no root script to work.

**What makes that safe is AC-8's siting, and the two are load-bearing on each other.** With no CI
build step, the only thing that builds this repository's own packages on every push is the workspace
suite — and the `workspace` job runs it forced. So **AC-8 runs against the real workspace**, not
against a fixture; a fixture-only AC-8 would leave the real emit unbuilt in CI and the first thing to
discover a broken emit would be Q-0098's implement step. Stated as a dependency rather than left
implicit.

**This is promoted from a risk note to a criterion (AC-14).** It is the first guard an implementer
meets, it fires on a one-word edit, and it fails with a bare `toStrictEqual` on two string arrays
that does not say why.

### R-5 — the emit's `tsconfig` cannot be the one `lint` and `typecheck` read

Named by neither the ticket body nor 078, and it decides the shape of the change.

**(verified at the gate)** Every package `tsconfig.json` is one line — `{ "extends":
"../../tsconfig.base.json" }` — with no `include` and no `exclude`, so `tsc`'s default `**/*` compiles
**test files too**. A build under that configuration emits `dist/frame.source.test.js`,
`dist/package.test.js` and the rest, which is AC-12's hazard in its sharpest form, AC-23's subject,
and an emit set nobody wants to declare.

**The obvious fix breaks `lint`.** `eslint.config.js:26–31` says so in its own words **(verified at
the gate)**: *"Every package carries a `tsconfig.json` extending the base with no `include`, so the
service finds a project for every linted file."* `projectService: true` covers `packages/**/*.ts`,
**tests included** (Q-0069), so excluding tests from the package project leaves every `*.test.ts`
without one and the type-aware `no-deprecated` rule without its type information.

**Strongly recommended, not mandated:** a separate `tsconfig.build.json` per emitting package, used by
the `build` script alone (`tsc -p tsconfig.build.json`), extending the package `tsconfig.json` and
adding `outDir`, `rootDir`, `declaration` and the test exclusion. `tsconfig.json` is untouched, so
`lint` and `typecheck` are untouched — 078(b)'s *"no verdict that exists today moves"* applied to the
two verdicts nobody thought to check. The implementer may find a cleaner arrangement; what **is** a
criterion is that `lint` and `typecheck` are demonstrated unchanged (AC-14) and that no test file is
emitted (AC-23).

`rootDir` is named explicitly rather than inferred: unset, `tsc` derives the common root from the
input set, so removing the last file outside `src/` would silently move every emitted path.
`incremental`/`composite` are recommended **off** — **(verified at the gate)** `.gitignore:9` ignores
`*.tsbuildinfo`, and a gitignored output the declaration omits is under-declaration wearing a
gitignore (AC-8).

### R-6 — three of the four `dist`-awareness sites hold; the fourth fails closed

**(verified at the gate)**, all four cells:

| site | today | Q-0097 |
| --- | --- | --- |
| `.gitignore:4` | `dist/` | unchanged |
| `eslint.config.js:19` | `'**/dist/**'` in `ignores` | unchanged |
| `packages/core/src/git-identity.test.ts:90` | `if (entry.name === 'node_modules' \|\| entry.name === 'dist') continue;` | unchanged |
| `packages/cli/src/frame.source.test.ts:73` | `GENERATED = ['node_modules', '.turbo']` | **fails closed** |

The failure is not hypothetical. `inventory()` walks the package in **any** extension pruning only
those two directory names, and the file's header promises, verbatim **(verified at the gate)**:
*"**Emitted output is deliberately not among them.** This workspace emits nothing and the output
layout is Q-0096's to choose"*, and *"**No verdict below depends on whether this checkout has run a
build.**"* An emitted `dist/frame.source.test.js` carries every credential pattern the scan looks for,
so the scan goes red — **and only in a checkout that has built**, which is the
verdict-depends-on-the-checkout defect Q-0096's round 2 caught in the assertion next door.

### R-7 — `packages/cli/turbo.json`'s `not.toContain('"outputs"')` survives, and the ticket body's hedge is spent

The ticket body hedges: *"if the build task lands there, that assertion is reconciled deliberately"*.
**078(c) rules that it does not** — `build` is a root task and package configurations go on declaring
`inputs` and nothing else. **(verified at the gate)** `packages/cli/src/package.test.ts:133–134` is
`not.toContain('"env"')` and `not.toContain('"outputs"')`, which is exactly the contract 078(c)
states.

**Ruled: untouched, and asserted with its reasoning** so a reviewer does not read an unchanged
assertion as an unmet criterion. This rejects the `codex` candidate's AC-7.7, which would **replace**
it; replacing a correct guard this ticket otherwise leaves alone invites the reviewer confusion the
assertion-with-reasoning exists to prevent. Codex's *fixture* idea — a configuration declaring `env`
or `outputs` must make the assertion fail — is a genuine strengthening and is folded into AC-7's test
sketch as **gate evidence**, not as a guard edit.

### R-8 — the fifth `dist`-awareness site, named by neither the ticket body nor 078

**(verified at the gate)**, reading the installed package rather than assuming:

```
$ node -e "import('vitest/config').then(m => console.log(
    JSON.stringify(m.configDefaults.include), JSON.stringify(m.configDefaults.exclude)))"
["**/*.{test,spec}.?(c|m)[jt]s?(x)"]   ["**/node_modules/**","**/.git/**"]
```

Two facts fall out and both matter. The include matches **`.js`**, not only `.ts`. And the default
exclude in this version is **two entries** — `dist/**` is *not* among them. **(verified at the gate)**
`vitest.shared.js` declares `include: [...configDefaults.include]` and **overrides no `exclude`**, so
an emitted `packages/*/dist/**/*.test.js` is **collected and executed** by `pnpm turbo run test`.

That is a fifth site that fails open, and it fails worse than AC-12's: a duplicated test file does not
merely get scanned, it *runs*, from a directory whose depth differs from its source — so every path a
test computes from `import.meta.url` is wrong, and the suite either goes red for a reason that has
nothing to do with the change or goes green having asserted over the wrong tree.

**The fix is not to narrow the include.** `vitest.shared.js`'s header states the include is Vitest's
own default *"taken by reference rather than transcribed, and it is deliberately not narrowed"*, and
`packages/core/src/test-discovery.test.ts` reads that declaration and **refuses a narrowing**. So the
criterion is that **the emitted set contains no file the include matches** (R-5's test exclusion),
with the collection site closed as defence in depth. That is **AC-23**, and only the `claude`
candidate has it.

### R-9 — the documentation guard constrains its own criterion, and its line number was wrong

**(verified at the gate)** `packages/shared/src/docs.test.ts:**202**` — *not* `:195`, which is where
the `claude` candidate placed it — asserts that the status line of `docs/02-sdlc-pipeline-spec.md`,
`docs/03-adapter-contract.md` and `docs/04-architecture.md` each `toContain('Q-0041')`, keyed on that
**literal** rather than on the running ticket.

Two consequences, both for AC-24. **There is no mechanical enforcement that this ticket bumps a status
line**, so AC-24's obligation is prose-enforced and the criterion says so rather than implying a guard
exists. And practically: a status line edited by *replacement* rather than by *appending* turns that
assertion red. Generalising the guard to the running ticket is its own change with its own subject and
is not attempted here.

---

## 4. Acceptance criteria

**Eleven.** AC-7 to AC-14 are the ticket's, carried with their scope intact and three corrections.
**AC-22 to AC-24 are additions**, numbered from 22 because Q-0098 owns AC-15 to AC-21, so nothing
collides in either direction. Eleven is inside the ceiling of fifteen and no further split is owed.

*Test:* sketches are the implementer's starting point, not a frozen contract. Where one is wrong, an
erratum corrects it **during** the loop, as soon as the contradiction is provable (*"An erratum is the
last repair, not the first"*, 2026-08-30).

---

**AC-7 — a `build` task exists at the root, declares real `outputs`, and orders itself by dependency — workspace.**

Root `turbo.json` gains `build` beside `lint`, `typecheck` and `test`, with `dependsOn: ["^build"]`
and a **non-empty** `outputs`, so one invocation from a clean checkout produces prerequisites before
consumers with no manual command and no prior typecheck or test. `@quorum/shared`, `@quorum/core` and
`@quorum/cli` each declare a `build` script; the four stub packages do not (078(c)). The three
existing tasks keep `"outputs": []` and gain no `^build` edge. Package-level `turbo.json` files go on
declaring `inputs` and nothing else (R-7).

**Strongly recommended, not mandated (R-5):** the emit is driven by a per-package
`tsconfig.build.json` carrying `outDir`, `rootDir: "src"`, `declaration: true` and a test exclusion,
with `incremental` and `composite` off, so the package `tsconfig.json` that `lint` and `typecheck`
read is untouched.

*Test:* read root `turbo.json` and every package-level one; assert `build.outputs` is a non-empty
array, that `build.dependsOn` contains `"^build"`, and that `lint`, `typecheck` and `test` still
declare `[]` and no `^build`. Assert each package configuration declares `inputs` and no other key,
and that root `turbo.json`'s `test.env` still holds `QUORUM_REAL_CLI` (Q-0065). Assert the emitting
set — the packages whose manifests declare a `build` script — is exactly `{shared, core, cli}` and
that each names one, so a fourth package that starts emitting or one of the three that stops fails
here. **Gate evidence, not a guard edit (R-7):** demonstrate that `package.test.ts:133–134` still
fires, by showing it red against a package configuration that declares `env` or `outputs`.

---

**AC-8 — the declared outputs cover exactly what the build writes — workspace, against the real tree.**

Verified by building and enumerating, never by reading the declaration (*"A check is not established
by reading it"*, 2026-08-29). Under-declaring is the stale-artifact hazard in its exact form.
Over-declaring the *package* directory is refused; declaring the *emit* directory whole is not the
same thing and is what 078(e) rules — this criterion is what proves nothing but the build writes under
it.

**It runs against the real workspace, and that siting is load-bearing** (R-4, OQ-1): with no build
step in CI, the forced workspace suite is the only thing that builds this repository's own packages on
every push. A fixture-only AC-8 would leave the real emit unbuilt until Q-0098.

*Test:* remove the emit directories, build, enumerate every path written, and assert **set equality
with the declaration in both directions** — no emitted path outside the declaration, no declared
pattern matching nothing. Turbo's own cache metadata and logs are not treated as package artifacts.
The declaration includes the `.d.ts` files the export maps promise — **(verified at the gate)**
`packages/cli/src/package.test.ts:193–194` already pins `@quorum/core`'s `default` as
`./dist/index.js` and `types` as `./dist/index.d.ts`. Any `*.tsbuildinfo` produced is either declared
or the option producing it is removed. **Assert the emit lands only under the declared directory** —
the two untracked files in §1 are what a missing `outDir` looks like, and `.gitignore` matches
neither, so "it is gitignored anyway" is not available as a defence.

---

**AC-9 — a replayed build is executable — workspace.**

Clean build, cache preserved, **declared artifacts deleted**, the same build re-run to obtain a cache
hit, and the restored artifact then imported successfully in a plain `node` process. This is the
property no task in this workspace has ever needed, all three existing tasks declaring `"outputs": []`
and replaying a verdict.

**The execution proof is run against `@quorum/core`'s artifact, not only `@quorum/cli`'s** (R-2):
`packages/cli/dist/index.js` has no runtime workspace dependency today, so it would pass while R-1's
defect stood. Importing `@quorum/core` under the default condition exercises the whole chain —
`core/dist/index.js` → `@quorum/shared` → `shared/dist/index.js` — which makes this AC-22's
integration proof as well.

*Test:* **turbo's machine-readable summary must identify the relevant package build as a cache hit;
output text alone is not the oracle, and neither is timing.** Assert the artifact is on disk again;
then spawn `node` **from `packages/cli`** — **(verified at the gate)** `import.meta.resolve('@quorum/core')`
there answers `…/packages/cli/node_modules/@quorum/core/dist/index.js`, where from the workspace root
the failure is "package not found", a different fact — and `await import('@quorum/core')`, asserting
the exported symbols `package.test.ts`'s existing register names, **derived from that register rather
than retyped**. The restored JavaScript must load without a TypeScript loader and without the
workspace-only resolution condition. A `RESOLVED`-only assertion is not enough: `import.meta.resolve`
answers from the manifest without the target existing, which is exactly why Q-0096 used it and exactly
why this ticket may not.

---

**AC-10 — a changed input cannot execute a stale artifact — workspace.**

In a repository fixture the test creates, build once through turbo, then change a tracked source or
tracked build-configuration input whose effect is observable in emitted JavaScript. Rebuild through
the same root command and **execute or import** the result. The executed result must reflect the
changed input and must not reflect the prior artifact — not merely that turbo reported a miss.

*Test:* the verdict depends only on tracked files, lockfile-installed dependencies and files the test
creates — never on a pre-existing ignored `dist/`, on user-level configuration, on subscription
identity or on account identity (*"A test's verdict is a property of the commit, not of the checkout
or the account"*, 2026-08-30). This criterion mutates a source file, so it runs in a workspace the
test built rather than in the checkout it is judging (OQ-1).

---

**AC-11 — repeated builds do not depend on leftovers — workspace.**

For identical tracked inputs, building with all emit directories absent and building with output from
an earlier build present produce the same declared artifact paths **and the same byte contents**. Each
package build removes or otherwise makes impossible undeclared leftovers from its own prior emit
before writing current output. A removed or renamed source entry point does not remain executable
because an old emitted file survived.

*Test:* build a fixture, rename or remove a source entry that previously emitted a JavaScript file,
update the fixture's tracked references as needed, and rebuild; assert the old emitted path is absent,
the replacement is present where applicable, and the old path is no longer importable. Same siting
rule as AC-10.

---

**AC-12 — the artifact is invisible to every source scan, and `frame.source.test.ts` regains its two promises — `packages/cli`.**

`GENERATED` at `:73` gains the emit directory, and the header stops promising two things that have
stopped being true: *"emitted output is deliberately not among them"*, correct when the layout was
Q-0096's to choose, and *"No verdict below depends on whether this checkout has run a build"*, which
the exclusion restores rather than merely asserts.

*Test:* the register gains the entry as an **identity, not a count** — the `toStrictEqual` at `:298`
becomes the new three-element list, with the derived per-entry fixture loop beside it extended by
construction so a fourth entry arrives with a subject or fails (Q-0073, *"a count is not an
identity"*). **Show the credential scan red first**, against a tree carrying an emitted copy of a test
file, and green with the exclusion active — the two-directional demonstration, which is what proves
the exclusion has a subject rather than being a precaution. Assert the credential scan and the
signal-handler scan return identical verdicts with the artifact present and absent. Assert
`git check-ignore -v` attributes an emitted path to `.gitignore`'s `dist/` rule, that
`eslint.config.js:19`'s `**/dist/**` covers it, and that `git-identity.test.ts:90`'s walk skips it —
three cells already hold (R-6) and are asserted **with their reasoning**, so a later reader knows the
question was asked rather than missed.

---

**AC-13 — the task registers are derived, and the sentence they assert is 078(c)'s — `packages/core`, `packages/cli`.**

**(verified at the gate)** `packages/core/src/test-discovery.test.ts:59` declares
`TASKS = ['lint','typecheck','test'] as const` under *"The three tasks the root `turbo.json` declares,
and therefore the three every package owes"*, consumed inside a `test.each(PACKAGES)` whose **name**
is a third hand-written copy of the same claim. `packages/cli/src/package.test.ts:**80**` — not `:76`
as 078 says — inlines the array again under *"declares the three tasks turbo runs"*. **None is
derived.** Add `build` and all stay at three, every comment becomes false, and turbo skips each
package with no `build` script in silence — verbatim the failure the first guard's own describe block
exists to close (*"A package with no `test` script is skipped by turbo in silence"*), and the
fail-open shape Q-0051 found in `q0050.source.test.ts`. The asymmetry is in that guard's own words:
its `PACKAGES` half **is** derived from the workspace globs *"so a package added later is covered
without anyone remembering"*, and a task added later is not.

078(c) rules the sentence the registers must now assert: **every package owes `lint`, `typecheck` and
`test`; `build` is owed by the packages that emit, and the register names which.**

*Test:* derive the universal task list from root `turbo.json` rather than hand-writing it, and derive
the emitting set from the manifests declaring a `build` script, so neither can narrow in silence.
Assert the emitting set is exactly the three 078(c) names. The `test.each` title moves with the list
rather than restating it. **Demonstrate the register red first:** with the hand-written array restored
and a `build` task present, show that an emitting package lacking a `build` script passes unnoticed.
**And close the other direction:** a fixture proves a non-emitting stub package is *not* required to
declare a no-op build script, so the derived rule cannot overshoot into 078's rejected alternative.

---

**AC-14 — the harness commands, CI, the root scripts, the sweep, and the file whose stated reason this ticket falsifies, are changed or demonstrated unchanged — repository.**

Under 078(b) `test` and `typecheck` gain no `^build` edge, so **the expectation is that all of this
list is unchanged and asserted so, with the reasoning**. The subjects, all verified present at the
gate:

- `harness/harness.yaml` `commands.install` and `commands.test`. Unchanged: no suite moves behind the
  artifact.
- `.github/workflows/ci.yml`'s `workspace` job — install then `lint`, `typecheck`, `test`, each
  `--force`. Unchanged, per R-4's ruling. `test-command.test.ts`'s `CI_JOBS` register of seven jobs,
  pinned by `toStrictEqual`, is untouched because no **job** is added.
- **Root `package.json`'s `scripts` — unchanged, and this is a criterion rather than a risk note
  (R-4).** It gains no `build` script. `WORKSPACE_TASKS` at `test-command.test.ts:194` and the `:406`
  guard are untouched, because that register's own doc comment scopes it to tasks *"CI's required
  check claims to have executed rather than replayed"*, and `build` is the first task whose replay is
  legitimate.
- `.github/scripts/git-identity-sweep.sh`, phases `isolation`, `probe`, `install`, `spike suite`,
  `workspace suite`. Unchanged: no build phase.
- **`packages/core/src/shared-resolution.test.ts:3–6`**, whose stated reason is *"no package declared
  `exports`, `turbo.json` has no `build` task and `tsconfig.base.json` emits nothing, so
  `@quorum/shared` resolves from its TypeScript source"*. **(verified at the gate)** Three clauses:
  **Q-0096 already falsified the first** — both `shared` and `core` declare `exports` today — and this
  ticket falsifies the second. The third survives literally if the emit uses a separate
  `tsconfig.build.json` (R-5), and is misleading either way, because the real reason the resolution
  holds is now the `quorum-source` condition Q-0096 landed, which this comment never learnt. A comment
  naming an authority that has stopped being true is what `engineering.md` forbids; **the header is
  corrected in the same change and the test's assertions are untouched.**

*Test:* where a file is unchanged, **assert it with the reasoning**, so a later reader knows the
question was asked. The `--force` guard at **`packages/shared/src/project.test.ts`** — `forcesTurbo`
at `:125`, consumed `:137` and `:142–148` (R-3, *not* `packages/core/src/backlog/project.test.ts`) —
and the executes-not-replays guard in `test-command.test.ts` must both still hold. Resolution tests
continue to prove that `tsc` and Vitest use source while a plain `node` process uses `dist/`. Both
suites pass after install: `npm test --prefix spike` and `pnpm turbo run test --force`.

---

**AC-22 — `@quorum/shared` emits and resolves by the same mechanism as `@quorum/core`, so the emitted `dist/` runs under Node — `packages/shared`.**

The criterion R-1 reproduces, and the one without which AC-9 cannot pass. It is an **unmet clause of
078(b)**, not new scope. `packages/shared/package.json`'s `exports` becomes the conditional map that
entry describes — `quorum-source` resolving `./src/index.ts`, `default` resolving `./dist/index.js`,
`types` resolving `./dist/index.d.ts` — and the package declares a `build` script producing that
artifact.

*Test:* **demonstrate the defect before closing it.** Capture, as red evidence, that from
`packages/core` a plain `node` process today fails `await import('@quorum/shared')` with
`ERR_MODULE_NOT_FOUND … packages/shared/src/constants.js`; then assert the same import resolves and
executes after the change. Assert the map's shape as `packages/cli/src/package.test.ts:193–194`
already does for `@quorum/core`. Assert Vitest still resolves `@quorum/shared` to **source** —
`shared-resolution.test.ts`'s value import is the existing proof and stays green unchanged, which is
078(b)'s guarantee tested on the package carrying every schema. **(verified at the gate)**
`packages/shared/src/index.test.ts:29–30` pins the flat map by identity — `entry.types` and
`entry.default` both `'./src/index.ts'` — so it goes red and is **retired by replacement rather than
deletion**, on the precedent Q-0096 set for the byte pin it replaced.

---

**AC-23 — the emit contains nothing Vitest collects, and the fifth `dist`-awareness site is closed — workspace.**

R-8. **(verified at the gate)** `configDefaults.include` is `["**/*.{test,spec}.?(c|m)[jt]s?(x)"]` —
it matches `.js` — and `configDefaults.exclude` is exactly `["**/node_modules/**","**/.git/**"]`;
`vitest.shared.js` spreads the include and overrides no exclude. So an emitted `dist/**/*.test.js` is
**collected and executed**, from a directory at a different depth from its source, which makes every
path a test derives from its own location wrong.

The primary mechanism is that **no test file is emitted at all** (R-5's exclusion), so the collected
set is unchanged because the file does not exist. Closing the collection site is defence in depth and
is **not** achieved by narrowing the include: `vitest.shared.js`'s header states the include is taken
by reference and *"deliberately not narrowed"*, and `test-discovery.test.ts` reads that declaration
and refuses a narrowing.

*Test:* build, then assert that **no emitted path matches the configured include** — the include read
out of the configuration rather than retyped, as `packages/core/test/vitest-include.ts` already does.
**Show it red first:** plant a `dist/x.test.js` under a package and demonstrate that the configured
include collects it, so the criterion is known to have a subject. Assert the collected test-file set
is identical with the artifact present and absent — the same present-and-absent shape AC-12 uses,
which is what makes both of them checks rather than assertions of intent.

---

**AC-24 — the documents describing a workspace that emits nothing are corrected in the same change — `docs/`.**

*"When code and docs disagree, the docs are wrong until a DECISIONS entry says otherwise — fix them in
the same change"* (`docs-and-decisions.md`), and the numbered documents are living documents whose
status line is bumped with the date and what changed.

**(verified at the gate)** `docs/04-architecture.md`'s *"What a cache hit claims, since Q-0072"*
states *"A hit means no file this task reads, and no same-kind task in a package it depends on, has
changed since the cached result"* — written when every task replayed a verdict, and now owed a second
half: a hit on `build` replays an **artifact**, which is a different promise and the whole subject of
078. The **Package map** describes `packages/core`'s public API and names no emit.

*Test:* assert the emit is described in exactly one place and that the description matches the shipped
`turbo.json`, **read out of the file rather than transcribed** — the Q-0088 precedent that a
transcription of configuration drifts silently because it goes on looking like the thing it describes.
**The status line is bumped by appending, never by replacement** (R-9): `docs.test.ts:**202**`
requires that document's status line to keep containing the literal `'Q-0041'`, so a rewritten line
turns the suite red. **The obligation itself has no mechanical enforcement** — that guard is keyed on
`Q-0041` and not on the running ticket — and this is stated rather than implied, so a reviewer checks
it by reading. **The decision entry is not edited:** 078 has landed, and a landed entry is never
edited, including the figure R-1 corrects.

---

## 5. Non-goals

- **The export surface of `@quorum/core`** — Q-0096's, and landed. Its `exports` map,
  `customConditions` and `ssr.resolve.conditions` are read and asserted here, never re-decided.
- **The `bin` target, the shebang, the mode bit, the packed tarball and what `npx quorum` may claim**
  — Q-0098's (AC-15 to AC-21). `packages/cli/package.json`'s `bin` **value** is untouched, and
  `package.test.ts`'s deliberate assertion that the key merely carries a non-empty string is not
  narrowed here. `packages/cli` declares no `exports` map and this ticket adds none.
- **A `files` field on any manifest** — 078(e) rules it and Q-0098's AC-19 owns it.
- **Publishing to the public registry** — Q-0029's, in M6. **Refused rather than deferred** by 078(d):
  no test name, success message or document added here may assert that a cold machine can obtain
  Quorum from the registry.
- **A bundler, a TypeScript runtime loader, or any new dependency.** 078(a) rules `tsc` per package
  and Shape D leaves the bundler door open for a later ticket with a subject. Adding one here needs a
  `docs/DECISIONS.md` entry, which no step on the chore route may write.
- **Node type stripping.** Refuted twice in 078 Shape E; R-1 is the first of those refutations
  reproduced as a live measurement, not an invitation to revisit it.
- **Moving any existing test or typecheck verdict behind emitted output.** Refused by 078(b) as
  Shape B, on measured cost.
- **Requiring stub packages to emit or to declare no-op build scripts** — 078(c)'s rejected
  alternative, and AC-13's second fixture is what keeps the derived rule from overshooting into it.
- **Exercising the complete built binary end to end** — Q-0095's.
- **Generalising `docs.test.ts`'s status-line guard** to the running ticket (R-9), and **correcting
  `test-command.test.ts:406`'s "at least" message** (R-4). Both are real, both are one line, and both
  are in files this ticket otherwise leaves alone; changing them in passing invites a reviewer to read
  an untouched guard as a moved one.
- **Fixing unrelated defects found while implementing.** Reported, not fixed (ground rule 3).
- **Any change to `spike/`.** Ground rule 1.
- Multi-user operation, remote daemon, cloud sync, plugin marketplace, visual canvas, eval suites,
  Gemini adapter, desktop shell.

---

## 6. Open questions

**None blocks solutioning.** All three below are decidable by measurement and are decided here; they
are recorded so the gate can overturn a ruling cheaply now rather than expensively in the loop.

**OQ-1 — where do AC-8 to AC-11 run, and which package owns them?** *Ruled, with the reasoning.*

AC-10 mutates a source file and AC-11 renames an entry point. Doing either to this checkout is a test
with a side effect on the tree it is judging, which Q-0073 rejected by name. So:

- **AC-8 runs against the real workspace** — fixed by the criterion, not optional, because R-4's
  ruling leaves the forced workspace suite as the only thing that builds this repository on every
  push. It writes only gitignored `dist/`, which `harness/rules.md` permits — *"a repository it built
  itself"*.
- **AC-9, AC-10 and AC-11 run against a temporary workspace the test builds**, whose `build` task
  definition is **read out of the repository's root `turbo.json`** rather than retyped. The pattern
  exists and is not being invented: `test-command.test.ts:129–158`'s `seenBy` writes a throwaway
  workspace into `tempDir()`, hands it `turboConfig().tasks.test` verbatim, runs the real
  `node_modules/.bin/turbo` in it, and says why — *"Running this repository's own suite instead would
  make the check spawn the run it is running inside."* `packages/core/test/repo.ts` already exports
  `tempDir`, `write` and `removeTempDirs`.

**Which package owns them is a hash question, not a taste question.** A test that builds package *P*
takes its verdict from *P*'s sources, so the owning task must already hash them or must declare them
(Q-0072). `@quorum/cli` depends on **both** `@quorum/core` and `@quorum/shared`, so `@quorum/cli#test`
hashes both through its `^test` edges and needs only `../../turbo.json` added to
`packages/cli/turbo.json`. `@quorum/core#test` has an edge to `shared` but **not** to `cli`, so owning
them there means declaring `packages/cli/src/**` by hand. **Recommendation: `packages/cli`** — where
AC-12 already sits, and where `turbo-inputs.test.ts` deliberately does not audit, its reads being
covered by `package.test.ts`'s own `OUTSIDE`/`DECLARED` registers whose floors this ticket will not
disturb.

**One residue, stated rather than left to be found:** a fixture proves turbo's replay semantics
faithfully and proves nothing about this workspace's wiring. So AC-9's *real* round trip — build,
delete `dist/`, rebuild, import — is additionally performed **by hand at the gate** and recorded in
the implement report with its turbo summary, on the precedent `test-discovery.test.ts` sets for its
own gate evidence.

**OQ-2 — is `@quorum/cli`'s emit built now or at Q-0098?** *Ruled: now.* 078(a) rules the strategy
against the post-Q-0091 tree and names all three packages; 078(c) says all three declare a `build`
script. Q-0098 needs the artifact before it can point a shebang at it, and building two of three
would leave the third's `outputs` undeclared and its build configuration unwritten — a seam inside one
criterion. The cost is that AC-12 and AC-23 become live rather than hypothetical, which is why both
are in this ticket and not in Q-0098.

**OQ-3 — does anything assert the emit is *current* rather than merely present?** *Nobody, and that is
078(f).* Registered so it is not read as an oversight: under (b) the suites prove source, so a `dist/`
stale relative to `src/` is caught by AC-10 within the build task's own cache semantics and by nothing
else until Q-0095 runs the mock end-to-end through the built binary. No criterion is added; the gap is
the ruling's stated price.

**Explicitly not an open question, and recorded so it is not re-opened at the gate:** whether the root
gains a `build` script and whether CI builds. It is **ruled by measurement** in R-4 — `WORKSPACE_TASKS`'s
own doc comment forbids `build` joining a register meaning *executed rather than replayed* — the ruling
is safe because AC-8 runs against the real workspace inside the suite CI already forces, and it is now
a clause of AC-14 rather than a risk note.

---

## 7. Risks

**RK-1 — a criterion set that cannot be satisfied as written.** R-1. AC-9 requires executing an
artifact that will not execute until `@quorum/shared` emits *and* changes its exports map. An
implementer without AC-22 reaches an unexplained `ERR_MODULE_NOT_FOUND` mid-round and has, per GO-2,
no `blocked` verdict. *Mitigation:* AC-22 exists, with the red evidence written into it.

**RK-2 — the working tree is dirty with exactly the artifact this ticket is about.** §1.
`packages/shared/test/corpus.js` and `corpus.d.ts` are untracked, unignored `tsc` output from run 1.
Left in place they are hashed by `@quorum/shared#test`, enumerated by AC-8 as emitted-but-undeclared,
and committed by a `git add -A`. *Mitigation:* GO-5.

**RK-3 — a fix for the emit's `tsconfig` that turns `lint` red.** R-5. Excluding tests from the
package `tsconfig.json` removes the project `projectService` needs, and the failure surfaces in
`lint`, a task no criterion here is about. *Mitigation:* AC-7's recommendation, and AC-14's
requirement that `lint` and `typecheck` be demonstrated unchanged.

**RK-4 — the fifth `dist` site is invisible until it fires, and then it looks like a code defect.**
R-8. An emitted `*.test.js` does not fail to be scanned; it *runs*, and its failure message is about a
path, not about a build. *Mitigation:* AC-23, with the red demonstration required rather than optional.

**RK-5 — the first guard met is one the ticket body never named.** R-4. A one-word edit to root
`package.json` turns `test-command.test.ts:406` red with a `toStrictEqual` on two string arrays that
does not say why. *Mitigation:* promoted into AC-14 as a criterion, with the doc comment that grounds
it.

**RK-6 — the input guard refuses the change on the way in.** Q-0072's guard has earned a registration
from four consecutive tickets. New reads of `turbo.json`, of package manifests and of a temp
workspace's contents each meet one of clauses B, C1, C3 or C4. *Mitigation:* this is the machinery
working; OQ-1's siting minimises it, and `turbo-inputs.test.ts`'s `SUITES` floors are explicitly not
this ticket's to move.

**RK-7 — a build inside a test is slow, and a timeout reads as a defect.** `test-command.test.ts`'s
two nested-turbo tests already carry `180_000` timeouts. A three-package build plus a cache round trip
wants the same. A test that times out on a slow machine is a verdict that depends on the machine,
which Q-0079 rules against. *Mitigation:* generous explicit timeouts, and a fixture workspace of one
small package rather than a copy of this one.

**RK-8 — `dist/` present changes what an existing assertion sees.** **(verified at the gate)**
`package.test.ts:239` asserts `result.value.endsWith('/dist/index.js')` and its comment already
anticipates this ticket — *"the prefix is `packages/cli/node_modules/@quorum/core` in a clean tree and
`packages/core` once Q-0097 emits … This assertion is deliberately not Q-0097's to replace."*
Registered so a reviewer seeing the prefix move does not read it as a regression. The wider hazard is
the class: any assertion whose verdict differs between a built and an unbuilt checkout is now live,
and AC-12's and AC-23's *"identical verdicts with the artifact present and absent"* is the sweep for
it.

**RK-9 — source/artifact divergence.** The suites prove source and the binary ships emit. Accepted by
078(f) and closed by nothing until Q-0095.

**RK-10 — GO-3.** `harness/Q-0097/integration` must exist before the first chore run; `review` diffs
against it and only `integrate`, which runs later, creates it. A first-pass run refuses in the
preflight rather than billing (Q-0038). Cut it deliberately from the requirements tip rather than from
whatever `HEAD` holds (Q-0037 GA-2).

**RK-11 — GO-4, Q-0039 unfixed.** Two runs on one ticket share a worktree and compute the same run id.
Not concurrent with Q-0096 or Q-0098.

---

## 8. Cross-cutting checklist

| | |
| --- | --- |
| **BYOS** | **n/a as a change; live as a guard.** No code path, test, fixture or document added here may accept an API key. AC-12 is where it touches: `frame.source.test.ts`'s credential scan must return the **same verdict** with the artifact present and absent, and the emitted-copy fixture proving the exclusion has a subject uses the placeholder the existing fixture uses, inside a pruned directory — never a real value, never a new pattern. |
| **Worktree safety** | **n/a to product behaviour.** No flow, engine or adapter code changes. Live for the *tests*: a build writes `dist/` and `.turbo/` into whatever tree it runs in, and acceptance tests mutate only fixtures or test-created repositories, never the user's working tree. `commands.install` runs only in an `integrate` worktree, so an implement step must `pnpm install --frozen-lockfile` before it can build at all (`harness/rules.md`). |
| **Gate behaviour** | **n/a.** No gate, loop bound or verdict vocabulary changes. GO-2 stands. |
| **File format and schema** | **n/a to product formats** — no flow, ticket, role or step-output schema moves, and `packages/shared`'s zod schemas are untouched in content. What changes is `packages/shared`'s *manifest* (AC-22), which is packaging, not a product format. |
| **Lint rules** | **Live, and the one nobody named.** `eslint.config.js` is unchanged; what must not change is the property its comment at `:26–31` rests on — every package carrying a `tsconfig.json` with no `include`, so `projectService` finds a project for every linted file, tests included (R-5). `**/dist/**` is already in `ignores`, so emitted output is never linted. AC-14 requires `lint` demonstrated unchanged. |
| **Cold-clone impact** | **Neutral by construction, and that is the point.** 078(b) keeps every existing verdict on source, so a stranger's `pnpm install && pnpm test` is unchanged, and under R-4's ruling they gain no new command to learn. The first thirty minutes get longer only at Q-0098, where the binary they type actually appears. |
| **Product-agnostic** | **n/a.** Nothing here names a SaaS product. |
| **Cross-vendor rule** | **Satisfied by the chore flow's panel** — `review` runs on a different adapter than `implement`. No change. |
| **Errors are explicit** | **Live in one place:** a build that cannot write, or a cache restore yielding nothing, must fail the task rather than leave a partial `dist/` for something downstream to execute. AC-9 and AC-11 are what would catch a silent partial restore. |

---

## 9. Ground rules — Q-0010's, restated because a child cannot read its parent

1. **Do not modify `spike/src/`.** The spike stays authoritative and green until cutover; a witness
   that has been edited is not one. **Nothing here needs to:** the emit is a workspace concern and
   `spike/` is plain Node ESM on npm, outside pnpm, outside turbo and outside ESLint. If a change
   there appears required, stop and say so — it means a criterion has been misread.
2. **The spike's own tests are not deleted or edited to make room.**
3. **Behaviour is preserved, and a known defect is reported rather than fixed in passing.** Two are
   registered against this ticket and are **not** to be fixed here: `test-command.test.ts:406`'s "at
   least" message over a `toStrictEqual`, and `docs.test.ts:202`'s guard being keyed on `Q-0041`
   rather than on the running ticket (R-4, R-9).
4. **`packages/core` already holds the logic** — look there before porting anything. Nothing is ported
   by this ticket; it is configuration and guards.
5. **`packages/core/src/spike-parity.test.ts` is updated in the same change, with its line totals
   re-derived rather than adjusted.** **Expected to be a no-op and asserted as one rather than
   skipped:** it pins `spike/test/` totals, and this ticket adds no spike test file and moves no
   assertion between the halves. Re-run it and record the figures; a share that *has* moved means
   something was misclassified, and that is the finding rather than the arithmetic.

---

## 10. Gate obligations

- **GO-1 — discharged. (verified at the gate.)** *"The emit serves the binary, and no test verdict
  moves behind it"* (2026-09-02) is landed as `docs/decisions/078-the-emit-serves-the-binary.md` and
  indexed under 2026-09-02 as the last entry. Every criterion above is read against it; one
  contradicting it is closed by an erratum, not by a round. **One of its figures is corrected in R-1
  and the entry is not edited.**
- **GO-2 — Q-0083 does not exist.** An implement step has no `blocked` verdict. A finding
  contradicting a ground rule or 078's ruling is closed by an erratum written **during** the loop, as
  soon as the contradiction is provable (*"A refused finding is a gate, not another round"*,
  2026-08-31).
- **GO-3 — `harness/Q-0097/integration` must exist before the first chore run**
  (`02-sdlc-pipeline-spec.md` §5.8), cut deliberately from the requirements tip (Q-0037 GA-2).
- **GO-4 — Q-0039 is unfixed.** Not concurrent with Q-0096 or Q-0098.
- **GO-5 — clear the two stray emitted files before the run.** `packages/shared/test/corpus.js` and
  `corpus.d.ts` are untracked run-1 leftovers matched by no `.gitignore` rule (§1, RK-2). Removing
  them costs one command; leaving them means AC-8 opens on a tree that already contains undeclared
  emit, and the implementer spends a round on it.
- **GO-6 — nothing here needs ruling at the gate, and that is stated rather than assumed.** The one
  question a candidate escalated as a human decision — whether the root gains a `build` script and
  whether CI builds — is decidable by measurement and is decided in R-4 and carried into AC-14. If the
  gate disagrees, saying so now costs a sentence; saying so in the loop costs a round, because the two
  readings differ in which of four guards the implementer meets first.

---

## 11. Provenance

**The `claude` candidate is the spine of this document.** It is the stronger of the two on every axis
this gate judges: it measured rather than described, it reproduced its decisive finding as a live
command, and its three additions are unmet rulings of 078 or verified hazards rather than scope creep.
Its §R-1 to §R-9 survive as §3 with three line-number corrections.

**From `claude`, adopted:** AC-22 and its reproduction; AC-23 and the Vitest measurement behind it;
AC-24; the R-4 ruling on the root script and CI, and the doc comment that grounds it; the R-5
`tsconfig.build.json` recommendation and the `lint` trap it avoids; the R-3 correction of the ticket
body's `project.test.ts`; the R-7 ruling that `packages/cli/turbo.json`'s assertion survives; OQ-1's
siting and the `seenBy`/`tempDir` precedent; GO-5; and RK-8's registration of the assertion that
already anticipates this ticket.

**From `codex`, adopted where it was stronger:** AC-11's **byte-contents** clause, which claude's
paths-only form would not have caught — a leftover-contaminated build can produce the right paths with
the wrong bytes; AC-9's oracle wording, *"turbo's machine-readable summary must identify the relevant
package build as a cache hit; output text alone is not the oracle"*, which names what is refused
rather than only what is required; AC-12's two-directional demonstration (red with the exclusion
removed, green with it active); AC-13's second fixture, proving a non-emitting stub is **not** required
to declare a no-op build script, which closes the direction claude's AC-13 left open; and its cleaner
enumeration of the non-goals around stub packages and end-to-end proof.

**Where the candidates disagreed, and how it was ruled:**

1. **`@quorum/shared`'s exports map.** `claude` requires it (AC-22); `codex` requires `shared` to emit
   but never requires its exports map to change, so Node would still resolve `./src/index.ts` and
   still die. **Ruled with `claude`, and verified at the gate by reproduction.** This is the single
   most consequential difference between the two documents.
2. **Root `build` script and a CI build step.** `codex`'s AC-14.2 agrees CI adds none but is silent on
   the root script, and its AC-7.5 reads as requiring one. `claude` rules against both on
   `WORKSPACE_TASKS`'s doc comment. **Ruled with `claude`, and promoted from a risk note to a clause
   of AC-14.**
3. **`packages/cli/src/package.test.ts`'s `not.toContain('"outputs"')`.** `codex` AC-7.7 replaces it;
   `claude` leaves it untouched on 078(c). **Ruled with `claude`** — the assertion is already the
   contract 078(c) states. Codex's fixture idea is kept as gate evidence in AC-7 rather than as a
   guard edit.
4. **Criterion granularity.** `codex` presents 8 criteria carrying **49 numbered sub-clauses**, which
   is not eight independently testable units but eight bundles; several sub-clauses are separately
   falsifiable and would each have to be demonstrated. `claude`'s 11 flat criteria are the honest
   count. **Merged at 11**, inside the ceiling of fifteen, so no further split is owed.

**Corrected at the gate, in both candidates and in the ticket body:** the `--force` guard is
`packages/shared/src/project.test.ts` (`forcesTurbo` at `:125`, consumed `:137` and `:142–148`), not
`packages/core/src/backlog/project.test.ts` and not at `:127`/`:130`/`:141`; the status-line guard is
`docs.test.ts:**202**`, not `:195`; the hand-written task array in `packages/cli` is at
`package.test.ts:**80**`, not `:76` as decision 078 states. Decision 078's *"14 carry a value import"*
is **17** — 21 production importers, 17 value, 4 type-only, 31 test importers, 55 files naming it.
The entry is not edited; the correction lives here.

**Run 1 was not resumed.** It aborted at its human gate because `head-of-product` returned
`verdict: ready` with `"gate obligations only — see document body"` in the field the engine persists,
so `requirements/merged.md` was 44 bytes. Both run-1 candidates survive under `requirements/run-1/`.
Their findings were treated as evidence to re-check rather than as rulings to inherit, on the Q-0051
precedent for an aborted run's document — and three of them moved.
