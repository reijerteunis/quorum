# Q-0097 — The workspace emits JavaScript

*Requirements, run 2, candidate: claude. Written against the tree at `9efffdb` (2026-09-02), after
`main` carried Q-0096's merge. Every figure is measured on that tree and marked **(measured)**;
where one disagrees with the ticket body, with decision 078 or with run 1's surviving candidate, the
disagreement is stated rather than reconciled silently.*

*On run 1: it was aborted at its human gate because `head-of-product` returned `verdict: ready` and
wrote `"gate obligations only — see document body"` into the field the engine persists, so
`requirements/merged.md` was 44 bytes and the merged requirement did not exist. Both candidates
survive under `requirements/run-1/`. **This document does not resume that one.** Its findings were
re-derived here, and three of them moved — §R-1's value-import count, §R-8's Vitest measurement, and
one figure in the ticket body's own AC-14. What run 1's `head-of-product` ruled is treated as
evidence to re-check, not as a ruling to inherit, on the Q-0051 precedent for an aborted run's
document.*

---

## 1. Problem

`packages/core` declares `"exports": { ".": { "quorum-source": …, "default": "./dist/index.js" } }`
and `packages/cli` declares `"bin": { "quorum": "./bin/quorum.js" }`. Both point at files that do
not exist. **(measured)** — there is no `dist/` anywhere under `packages/` or `apps/`, and
`packages/cli/bin` is absent.

That is Q-0096 working as designed. It ruled where the artifact will be and proved the resolution
machinery sends `tsc` and Vitest to source and a plain `node` process to the emit; it deliberately
built nothing. So the workspace today has a manifest promising an artifact, a resolver configured to
find one, and nothing that produces one.

For the `maintainer` the symptom is narrow and total: **there is no `pnpm turbo run build`, no
`build` script in any package, and no non-empty `outputs` on any task.** **(measured)** — root
`turbo.json` declares exactly `lint`, `typecheck` and `test`, each `"outputs": []`;
`tsconfig.base.json` declares no `outDir`, no `rootDir` and no `declaration`; the three package-level
`turbo.json` files declare `inputs` and nothing else.

The cost is not felt here. It is felt at Q-0098, which cannot make `quorum` run, and at Q-0095,
which cannot exercise the binary. This ticket's job is to produce the artifact those two consume and
to do it **without moving a single existing verdict behind it**, which is what *"The emit serves the
binary, and no test verdict moves behind it"* (2026-09-02) rules.

There is a second problem, and it is what makes this more than a configuration edit. **A `build`
task with real `outputs` introduces a class of failure this repository has never had.** `lint`,
`typecheck` and `test` all declare `"outputs": []`, so a hit on any of them replays a *verdict* —
the failure Q-0065, Q-0071 and Q-0072 each closed one layer of. A hit on `build` replays an
**artifact**, and an artifact something downstream executes fails differently: the stale tick lies
about the past, the stale artifact lies about the present. AC-8 to AC-11 exist to bound the new
class before anything is built on top of it.

**And there is a live instance of the hazard in the working tree as this is written.**
`packages/shared/test/corpus.js` and `packages/shared/test/corpus.d.ts` are untracked, dated
2026-09-02 09:14 — during this ticket's own run 1 — and are `tsc` output emitted beside its source
because nothing configured an `outDir`. **(measured)** `git check-ignore -v` returns **exit 1** for
both: no rule in `.gitignore` matches them, so they are neither ignored nor tracked, and turbo
hashes them as untracked-unignored input (Q-0073). They are not a defect this ticket introduces;
they are the argument for AC-8 arriving as an event rather than as a prediction, and they must be
removed before the implement step rather than committed.

---

## 2. User stories

- **`maintainer`.** *I run one command from a clean checkout and get JavaScript I can hand to Node. I
  never have to remember to build first, and when turbo tells me a build was cached I get back a
  file that runs — not a claim that a file once ran.*
- **`maintainer`.** *Adding a fourth task does not silently narrow the two registers asserting which
  tasks every package owes. If a package starts or stops emitting, something goes red.*
- **`contributor`.** *When I add a package I am told whether it owes a `build` script by a check, not
  by a doc comment that stopped being true.*
- **`adopter`.** *n/a this ticket.* The adopter's first thirty minutes are Q-0098's and Q-0028's;
  nothing here changes what an adopter runs. Named so its absence is a ruling and not an oversight.

---

## 3. What was re-derived, and what moved

Q-0010 ground rule 5, and *"a measurement copied from a document is not a measurement"* (Q-0058).
Nine things were checked against the tree before a criterion was written on them. Three moved.

### R-1 — The decisive finding: `@quorum/core`'s emit will not run, and no criterion says so

**Reproduced in two commands. (measured)** From `packages/core`, a plain `node` process resolves
`@quorum/shared` to **TypeScript source**:

```
$ cd packages/core && node --input-type=module -e "console.log(import.meta.resolve('@quorum/shared'))"
file:///…/quorum/packages/shared/src/index.ts

$ cd packages/core && node --input-type=module -e "await import('@quorum/shared')"
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '…/packages/shared/src/constants.js'
                              imported from '…/packages/shared/src/index.ts'
  code: 'ERR_MODULE_NOT_FOUND'
```

That is decision 078's **Shape E refutation (1)** arriving as a live defect rather than as a rejected
alternative. The cause is one manifest — `packages/shared/package.json`:

```json
"exports": { ".": { "types": "./src/index.ts", "default": "./src/index.ts" } }
```

**No conditional map**, unlike the one Q-0096 gave `@quorum/core`. **(measured)**

The consequence is exact. `packages/core/dist/index.js` will carry `import … from '@quorum/shared'`,
Node will resolve that specifier to `./src/index.ts`, and it will die as above. **So AC-9's *"the
restored artifact is then executed or imported successfully"* cannot pass, and no honest reading of
AC-8 can either, until `@quorum/shared` gains the same conditional map and its own emit.**

Q-0096's closing entry reports this and does not fix it, and 078(a) names `@quorum/shared` among the
three packages that emit. **What is missing is a criterion:** AC-7 to AC-14 do not mention
`packages/shared` once. That is **AC-22**, and it is the most load-bearing addition this document
makes. An implementer working from the criteria alone builds `core` and `cli`, watches AC-9 fail
under Node, and has to derive the cause mid-loop from a resolver error — with no `blocked` verdict
available to them (GO-2).

**One figure moved, and it is 078's.** That entry states `packages/core/src` holds 53 `.ts` files
naming `@quorum/shared` — *"21 production, of which 14 carry a value import"*. Re-derived by parsing
every `import … from '@quorum/shared'` statement and classifying it by whether any binding is
un-prefixed by `type`: **31 production `.ts` files, 21 importing it, of which 17 carry a value import
and 4 are type-only; 31 test files import it.** **(measured)** The production-importing count matches
078 exactly; the value-import count is **17, not 14**. A landed entry is never edited
(`docs-and-decisions.md`), so the figure is corrected here and 078 is left alone. **Nothing turns on
it** — one value import is enough to force the emit, and there are seventeen — but the count is
stated because a figure carried forward unchecked is what this repository keeps paying for. Run 1's
candidate reported 14 and claimed it *"re-derives to 078's 14 exactly"*; that claim was wrong.

### R-2 — `packages/cli`'s production emit needs no workspace package at runtime

**(measured)** `packages/cli/src` holds exactly one cross-package import in production — `import type
{ RunTerminalEvent } from '@quorum/shared'` at `exit.ts:12` — which `tsc` erases. `index.ts` names
`@quorum/core` in a comment only. The one *value* import of `@quorum/shared` in this package is
`exit.test.ts`, a test.

So `packages/cli/dist/index.js` is self-contained today, and 078(g)'s registered limit applies.
**This is why AC-9's execution proof must be run against `@quorum/core`'s artifact and not only
`@quorum/cli`'s** — the cli artifact would pass while R-1's defect stood untouched.

**(measured)** `packages/cli` declares **no `exports` map at all**, only `bin`. That is correct and
this ticket does not add one: a `bin` target is resolved by path, not by an export map, and the
`bin` value is Q-0098's.

### R-3 — AC-14 names the wrong file for one of its three guards

The ticket says *"the `--force` guard in `project.test.ts`"*. Two files carry that name.
**(measured)** The guard is **`packages/shared/src/project.test.ts`** — `forcesTurbo` at `:127`,
consumed at `:130` and `:141`, under `describe('Q-0065 AC-3 — the configured test command defeats
this repository's cache')`, asserting over `harness/harness.yaml`'s `commands.test`.
`packages/core/src/backlog/project.test.ts` is `loadProject`'s unit suite and holds no such
assertion. Corrected in AC-14 rather than left for the implementer to discover.

### R-4 — the guard AC-14 misses, and the ruling that keeps it untouched

`packages/core/src/test-command.test.ts:406`, *"the workspace job runs exactly the tasks the root
scripts do"*:

```js
const fromScripts = namedBy(Object.values(scripts()));
expect(fromScripts, 'the root scripts must name at least the three workspace tasks')
  .toStrictEqual(WORKSPACE_TASKS.slice().sort());
expect(namedBy(jobSteps(repoFile('.github/workflows/ci.yml')).map((s) => s.run ?? '')))
  .toStrictEqual(fromScripts);
```

**(measured)** `WORKSPACE_TASKS = ['lint','typecheck','test']` at `:194`; root `package.json`'s
scripts are those three plus `sweep:git-identity`, which names no turbo task; CI's `workspace` job
runs install then `lint`, `typecheck`, `test`, each `--force`. So **the moment root `package.json`
gains `"build": "turbo run build"`, both assertions go red**, and the second stays red until CI's
`workspace` job also builds. AC-14 names three guards and not this one, and it is the guard most
likely to be met first, because it fires on a one-word edit.

**This is ruled here rather than passed to the gate, and the register's own doc comment is what
rules it.** `:193` reads: *"The workspace tasks CI's required check claims to have **executed rather
than replayed**."* `build` is the first task in this workspace whose replay is *legitimate* — that is
the entire content of decision 078 — so it may not join a register whose stated meaning is the
opposite. **The ruling: root `package.json` gains no `build` script and CI's `workspace` job gains no
build step; `WORKSPACE_TASKS`, the `:406` guard and `CI_JOBS` are all untouched.**

**What makes that safe is AC-8's siting, and the two are load-bearing on each other.** With no CI
build step, the only thing that builds on every push is the workspace suite — and the `workspace` job
runs it forced. So **AC-8 must run against the real workspace** (§OQ-1), not against a fixture; a
fixture-only AC-8 would leave the real emit unbuilt in CI and the first thing to discover a broken
emit would be Q-0098's implement step. Stated as a dependency rather than left implicit.

This **inverts run 1's candidate**, which recommended adding both and made it a criterion (its
AC-23). That recommendation was made without reading `WORKSPACE_TASKS`'s doc comment.

**One nit, recorded and not fixed:** `:406`'s assertion message says *"must name at least the three
workspace tasks"* while the assertion is `toStrictEqual` — exact, not "at least". Harmless today,
misleading the moment a fourth task is considered. A one-line repair for whoever is next in that
file; not this ticket's, because correcting a message is not a criterion and doing it in passing
against a guard this ticket deliberately leaves alone invites a reviewer to read it as a change.

### R-5 — the emit's `tsconfig` cannot be the one `lint` and `typecheck` read

Named nowhere in the ticket or in 078, and it decides the shape of the change.

**(measured)** Every package `tsconfig.json` is one line — `{ "extends": "../../tsconfig.base.json" }`
— with no `include` and no `exclude`, so `tsc`'s default `**/*` compiles **test files too**. A build
under that configuration emits `dist/frame.source.test.js`, `dist/package.test.js` and the rest,
which is AC-12's hazard in its sharpest form, AC-23's subject, and an emit set nobody wants to
declare.

**The obvious fix breaks `lint`.** `eslint.config.js:26–31` says so in its own words: *"Every package
carries a `tsconfig.json` extending the base with no `include`, so the service finds a project for
every linted file and none needs `allowDefaultProject`."* ESLint's `projectService` covers
`packages/**/*.ts`, **tests included** (Q-0069), so excluding tests from the package project leaves
every `*.test.ts` without one and the type-aware `no-deprecated` rule without its type information.

**The resolution is a separate `tsconfig.build.json` per emitting package**, used by the `build`
script alone (`tsc -p tsconfig.build.json`), extending the package `tsconfig.json` and adding
`outDir`, `rootDir`, `declaration` and the test exclusion. `tsconfig.json` is untouched, so `lint`
and `typecheck` are untouched — 078(b)'s *"no verdict that exists today moves"* applied to the two
verdicts nobody thought to check. **Stated as a strong recommendation in AC-7, not mandated:** the
implementer may find a cleaner arrangement, and what *is* a criterion is that `lint` and `typecheck`
are demonstrated unchanged (AC-14) and that no test file is emitted (AC-23).

`rootDir` is named explicitly rather than inferred: unset, `tsc` derives the common root from the
input set, so removing the last file outside `src/` would silently move every emitted path.
`incremental`/`composite` are recommended **off** — `.gitignore:9` ignores `*.tsbuildinfo`
**(measured)**, and a gitignored output the declaration omits is under-declaration wearing a
gitignore (AC-8).

### R-6 — three of the four `dist`-awareness sites hold; the fourth fails closed

AC-12's claim checked rather than relayed. **(measured)**

| site | today | Q-0097 |
| --- | --- | --- |
| `.gitignore:4` | `dist/` — `git check-ignore -v` resolves all three of `packages/{shared,core,cli}/dist/index.js` to it | unchanged |
| `eslint.config.js:19` | `'**/dist/**'` in `ignores` | unchanged |
| `packages/core/src/git-identity.test.ts:90` | `if (entry.name === 'node_modules' \|\| entry.name === 'dist') continue;` | unchanged |
| `packages/cli/src/frame.source.test.ts:73` | `GENERATED = ['node_modules', '.turbo']` | **fails closed** |

The failure is not hypothetical. `inventory()` walks the package in **any** extension pruning only
those two directory names, and the file's header at `:66` promises *"Emitted output is deliberately
not among them. This workspace emits nothing and the output layout is Q-0096's to choose"* and at
`:121` *"No verdict below depends on whether this checkout has run a build."* An emitted
`dist/frame.source.test.js` carries every credential pattern the scan looks for, so the scan goes red
— **and only in a checkout that has built**, which is the verdict-depends-on-the-checkout defect
Q-0096's round 2 caught in the assertion next door.

### R-7 — `packages/cli/turbo.json`'s `not.toContain('"outputs"')` survives, and AC-7's hedge is spent

AC-7 hedges: *"if the build task lands there, that assertion is reconciled deliberately"*. **078(c)
rules that it does not** — `build` is a root task and package configurations go on declaring `inputs`
and nothing else. So `packages/cli/src/package.test.ts:133–134` — `not.toContain('"env"')` and
`not.toContain('"outputs"')` **(measured)** — is correct as written and **must not be touched**.
Recorded so a reviewer does not read an untouched assertion as an unmet criterion.

### R-8 — the fifth `dist`-awareness site, and it is the one nobody has named

**New to run 2, and it changes a criterion from a recommendation into a requirement.** Vitest's
defaults were read out of the installed package rather than assumed:

```
$ node -e "import('vitest/config').then(m => console.log(
    JSON.stringify(m.configDefaults.include), JSON.stringify(m.configDefaults.exclude)))"
["**/*.{test,spec}.?(c|m)[jt]s?(x)"]   ["**/node_modules/**","**/.git/**"]
```

**(measured, vitest 4.1.11, vite 8.2.2, node 24.15.0, typescript 5.9.3, turbo 2.10.11.)**

Two facts fall out and both matter. The include matches **`.js`**, not only `.ts`. And the default
exclude in this version is **two entries** — `dist/**` is *not* among them. `vitest.shared.js`
declares `include: [...configDefaults.include]` and **overrides no `exclude`** **(measured)**, so an
emitted `packages/*/dist/**/*.test.js` is **collected and executed** by `pnpm turbo run test`.

That is a fifth site that fails open, and it fails worse than AC-12's: a duplicated test file does
not merely get scanned, it *runs*, from a directory whose depth differs from its source — so every
path a test computes from `import.meta.url` is wrong, and the suite either goes red for a reason that
has nothing to do with the change or goes green having asserted over the wrong tree.

**The fix is not to narrow the include.** `vitest.shared.js`'s header states that the include is
Vitest's own default *"taken by reference rather than transcribed, and it is deliberately not
narrowed"*, and `packages/core/src/test-discovery.test.ts` reads that declaration and **refuses a
narrowing** — restoring the old one turns three behavioural assertions red. So the criterion is that
**the emitted set contains no file the include matches** (R-5's test exclusion), with the collection
site closed as defence in depth rather than as the primary mechanism. That is **AC-23**.

### R-9 — the documentation guard constrains its own criterion

**(measured)** `packages/shared/src/docs.test.ts:195` asserts that the status line of
`docs/02-sdlc-pipeline-spec.md`, `docs/03-adapter-contract.md` and `docs/04-architecture.md` each
`toContain('Q-0041')` — keyed on that **literal**, not on the running ticket. Two consequences, both
for AC-24. First, **there is no mechanical enforcement that this ticket bumps a status line**;
AC-24's obligation is prose-enforced and the criterion says so rather than implying a guard exists.
Second, and practically: a status line edited by *replacement* rather than by *appending* turns that
assertion red. Generalising the guard to the running ticket is its own change with its own subject
and is not attempted here.

---

## 4. Acceptance criteria

**Eleven.** AC-7 to AC-14 are the ticket's, carried with their scope intact. **AC-22 to AC-24 are
new**, numbered from 22 because Q-0098 owns AC-15 to AC-21, so nothing collides in either direction.

*Test:* sketches are a starting point, not a frozen contract. Where one is wrong, an erratum corrects
it **during** the loop, as soon as the contradiction is provable (*"An erratum is the last repair,
not the first"*, 2026-08-30).

---

**AC-7 — a `build` task exists at the root, declares real `outputs`, and orders itself by dependency
— workspace.**

Root `turbo.json` gains `build` beside `lint`, `typecheck` and `test`, with `dependsOn: ["^build"]`
and a **non-empty** `outputs`, so one invocation from a clean checkout produces prerequisites before
consumers with no manual command and no prior typecheck or test. `@quorum/shared`, `@quorum/core` and
`@quorum/cli` each declare a `build` script; the four stub packages do not (078(c)). The three
existing tasks keep `"outputs": []`. Package-level `turbo.json` files go on declaring `inputs` and
nothing else (R-7).

**Recommended and not mandated (R-5):** the emit is driven by a per-package `tsconfig.build.json`
carrying `outDir`, `rootDir: "src"`, `declaration: true` and a test exclusion, with `incremental` and
`composite` off, so the package `tsconfig.json` that `lint` and `typecheck` read is untouched.

*Test:* read root `turbo.json` and every package-level one; assert `build.outputs` is a non-empty
array, that `build.dependsOn` contains `"^build"`, and that `lint`, `typecheck` and `test` still
declare `[]`. Assert each package configuration declares `inputs` and no other key, and that root
`turbo.json`'s `test.env` still holds `QUORUM_REAL_CLI` (Q-0065). Assert the emitting set — the
packages whose manifests declare a `build` script — is exactly `{shared, core, cli}` and that each
names one, so a fourth package that starts emitting or one of the three that stops fails here.

---

**AC-8 — the declared outputs cover exactly what the build writes — workspace, against the real
tree.**

Verified by building and enumerating, never by reading the declaration (*"A check is not established
by reading it"*, 2026-08-29). Under-declaring is the stale-artifact hazard in its exact form.
Over-declaring the *package* directory is refused; declaring the *emit* directory whole is not the
same thing and is what 078(e) rules — this criterion is what proves nothing but the build writes
under it.

**It runs against the real workspace, and that siting is load-bearing** (R-4, §OQ-1): with no build
step in CI, the forced workspace suite is the only thing that builds this repository's own packages
on every push. A fixture-only AC-8 would leave the real emit unbuilt until Q-0098.

*Test:* remove the emit directories, build, enumerate every path written, and assert **set equality
with the declaration in both directions** — no emitted path outside the declaration, no declared
pattern matching nothing. The declaration includes the `.d.ts` files the export maps promise
(`packages/cli/src/package.test.ts:193–194` already pins `@quorum/core`'s `default` as
`./dist/index.js` and `types` as `./dist/index.d.ts`). Any `*.tsbuildinfo` produced is either
declared or the option producing it is removed. **Assert the emit lands only under the declared
directory** — the two untracked files in §1 are what a missing `outDir` looks like, and `.gitignore`
matches neither, so "it is gitignored anyway" is not available as a defence.

---

**AC-9 — a replayed build is executable — workspace.**

Clean build, cache preserved, **declared artifacts deleted**, the same build re-run to obtain a cache
hit, and the restored artifact then imported successfully in a plain `node` process. This is the
property no task in this workspace has ever needed, all three existing tasks declaring `"outputs":
[]` and replaying a verdict.

**The execution proof is run against `@quorum/core`'s artifact, not only `@quorum/cli`'s** (R-2):
`packages/cli/dist/index.js` has no runtime workspace dependency today, so it would pass while R-1's
defect stood. Importing `@quorum/core` under the default condition exercises the whole chain —
`core/dist/index.js` → `@quorum/shared` → `shared/dist/index.js` — which makes this AC-22's
integration proof as well.

*Test:* assert the cache hit occurred by reading turbo's own summary rather than inferring it from
timing; assert the artifact is on disk again; then spawn `node` from `packages/cli` — **(measured)**
`import.meta.resolve('@quorum/core')` there answers
`…/packages/cli/node_modules/@quorum/core/dist/index.js`, where from the workspace root the failure
is "package not found", a different fact — and `await import('@quorum/core')`, asserting the exported
symbols `package.test.ts`'s existing register names, **derived from that register rather than
retyped**. A `RESOLVED`-only assertion is not enough: `import.meta.resolve` answers from the manifest
without the target existing, which is exactly why Q-0096 used it and exactly why this ticket may not.

---

**AC-10 — a changed input cannot execute a stale artifact — workspace.**

Build, change a source or build-configuration input that affects emitted output, rebuild through
turbo, and prove the **executed** artifact reflects the change — not that turbo reported a miss.

*Test:* the verdict depends only on tracked files, lockfile-installed dependencies and files the test
creates — never on a pre-existing ignored `dist/`, on user-level configuration or on account identity
(*"A test's verdict is a property of the commit, not of the checkout or the account"*, 2026-08-30).
This criterion mutates a source file, so it runs in a workspace the test built rather than in the
checkout it is judging (§OQ-1).

---

**AC-11 — repeated builds do not depend on leftovers — workspace.**

The build succeeds with the emit directories absent **and** with output from an earlier build
present, and produces the same declared artifacts for the same tracked inputs. A removed or renamed
entry point does not remain executable because an old emitted file survived.

*Test:* build, rename an entry point, rebuild, assert the old emitted path is gone. Same siting rule
as AC-10.

---

**AC-12 — the artifact is invisible to every source scan, and `frame.source.test.ts` regains its two
promises — `packages/cli`.**

`GENERATED` at `:73` gains the emit directory, and the header stops promising two things that have
stopped being true: *"emitted output is deliberately not among them"* at `:66`, correct when the
layout was Q-0096's to choose, and *"No verdict below depends on whether this checkout has run a
build"* at `:121`, which the exclusion restores rather than merely asserts.

*Test:* the register gains the entry as an **identity, not a count** — the `toStrictEqual` at `:298`
becomes the new three-element list, with the derived per-entry fixture loop beside it extended by
construction so a fourth entry arrives with a subject or fails (Q-0073, *"a count is not an
identity"*). **Show the credential scan red first**, against a tree carrying an emitted copy of a test
file, *before* the exclusion lands — which is what proves the exclusion has a subject rather than
being a precaution. Assert the credential scan and the signal-handler scan return identical verdicts
with the artifact present and absent. Assert `git check-ignore -v` resolves an emitted path to
`.gitignore:4`, that `eslint.config.js:19`'s `**/dist/**` covers it, and that
`git-identity.test.ts:90`'s `walk` skips it — three cells already hold (R-6) and are asserted **with
their reasoning**, so a later reader knows the question was asked.

---

**AC-13 — the task registers are derived, and the sentence they assert is 078(c)'s — `packages/core`,
`packages/cli`.**

**(measured)** `packages/core/src/test-discovery.test.ts:59` declares `TASKS = ['lint','typecheck',
'test'] as const` under *"The three tasks the root `turbo.json` declares, and therefore the three
every package owes"*, consumed at `:214` inside `test.each(PACKAGES)('%s declares lint, typecheck and
test')` — so the **test name** is a third hand-written copy of the same claim.
`packages/cli/src/package.test.ts:80` inlines the array again under *"declares the three tasks turbo
runs"*. **None is derived.** Add `build` and all stay at three, every comment becomes false, and turbo
skips each package with no `build` script in silence — verbatim the failure the first guard's own
describe block exists to close, and the fail-open shape Q-0051 found in `q0050.source.test.ts`. The
asymmetry is in that guard's own words: its `PACKAGES` half **is** derived from the workspace globs
*"so a package added later is covered without anyone remembering"*, and a task added later is not.

078(c) rules the sentence the registers must now assert: **every package owes `lint`, `typecheck` and
`test`; `build` is owed by the packages that emit, and the register names which.**

*Test:* derive the universal task list from root `turbo.json` rather than hand-writing it, and derive
the emitting set from the manifests declaring a `build` script, so neither can narrow in silence.
Assert the emitting set is exactly the three 078(c) names. The `test.each` title moves with the list
rather than restating it. **Demonstrate the register red first:** with the hand-written array
restored and a `build` task present, show that a package lacking a `build` script passes unnoticed.

---

**AC-14 — the harness commands, CI, the sweep, and the file whose stated reason this ticket
falsifies, are changed or demonstrated unchanged — repository.**

Under 078(b) `test` and `typecheck` gain no `^build` edge, so **the expectation is that all of this
list is unchanged and asserted so.** The subjects, all verified present at the gate:

- `harness/harness.yaml` `commands.install` (`npm install --prefix spike --no-audit --no-fund
  --silent && pnpm install --frozen-lockfile`) and `commands.test` (`npm test --prefix spike && pnpm
  turbo run test --force --continue`). **(measured)** Unchanged: no suite moves behind the artifact.
- `.github/workflows/ci.yml`'s `workspace` job — four steps, install then `lint`, `typecheck`, `test`
  each `--force`. **(measured)** Unchanged, per R-4's ruling.
- `.github/scripts/git-identity-sweep.sh`, phases `isolation`, `probe`, `install`, `spike suite`,
  `workspace suite`, the last running `pnpm turbo run test --force`. **(measured)** Unchanged.
- **`packages/core/src/shared-resolution.test.ts:3–6`**, whose stated reason is *"no package declares
  `exports`, `turbo.json` has no `build` task and `tsconfig.base.json` emits nothing, so
  `@quorum/shared` resolves from its TypeScript source"*. **(measured)** Three clauses, and **Q-0096
  already falsified the first** — both `shared` and `core` declare `exports` today. This ticket
  falsifies the second. The third survives literally if the emit uses a separate
  `tsconfig.build.json` (R-5), and is misleading either way, because the real reason the resolution
  holds is now the `quorum-source` condition Q-0096 landed, which this comment never learnt. A
  comment naming an authority that has stopped being true is what `harness/rules.md` forbids; it is
  corrected in the same change, and the test's assertions are untouched.

*Test:* where a file is unchanged, **assert it with the reasoning**, so a later reader knows the
question was asked rather than missed. The `--force` guard at **`packages/shared/src/project.test.ts`
`forcesTurbo` (`:127`, consumed `:130`, `:141`)** — R-3, *not* `packages/core/src/backlog/project.test.ts`
— and the executes-not-replays guard in `test-command.test.ts` must both still hold.
`test-command.test.ts`'s `CI_JOBS` register of seven jobs — pinned by `toStrictEqual` on its keys —
is untouched, because no job is added; it would move only if a **job** were added, never for a step
inside the existing one.

---

**AC-22 (new) — `@quorum/shared` emits and resolves by the same mechanism as `@quorum/core`, so the
emitted `dist/` runs under Node — `packages/shared`.**

The criterion R-1 measures, and the one without which AC-9 cannot pass.
`packages/shared/package.json`'s `exports` becomes the conditional map 078(b) describes —
`quorum-source` resolving `./src/index.ts`, `default` resolving `./dist/index.js`, `types` resolving
`./dist/index.d.ts` — and the package declares a `build` script producing that artifact.

*Test:* **demonstrate the defect before closing it.** Capture, as red evidence, that from
`packages/core` a plain `node` process today fails `await import('@quorum/shared')` with
`ERR_MODULE_NOT_FOUND … packages/shared/src/constants.js`; then assert the same import resolves and
executes after the change. Assert the map's shape as `packages/cli/src/package.test.ts:190–194`
already does for `@quorum/core`. Assert Vitest still resolves `@quorum/shared` to **source** —
`shared-resolution.test.ts`'s value import of `STAGES` and `stageSchema` is the existing proof and
stays green unchanged, which is 078(b)'s guarantee tested on the package carrying every schema.
**`packages/shared/src/index.test.ts:25–30` pins the flat map by identity** — `entry.types` and
`entry.default` both `'./src/index.ts'` **(measured)** — so it goes red and is **retired by
replacement rather than deletion**, on the precedent Q-0096 set for the byte pin it replaced.

---

**AC-23 (new) — the emit contains nothing Vitest collects, and the fifth `dist`-awareness site is
closed — workspace.**

R-8. **(measured)** `configDefaults.include` is `["**/*.{test,spec}.?(c|m)[jt]s?(x)"]` — it matches
`.js` — and `configDefaults.exclude` in vitest 4.1.11 is exactly `["**/node_modules/**",
"**/.git/**"]`; `vitest.shared.js` spreads the include and overrides no exclude. So an emitted
`dist/**/*.test.js` is **collected and executed**, from a directory at a different depth from its
source, which makes every path a test derives from its own location wrong.

The primary mechanism is that **no test file is emitted at all** (R-5's exclusion), so the collected
set is unchanged because the file does not exist. Closing the collection site is defence in depth and
is not achieved by narrowing the include: `vitest.shared.js`'s header states the include is taken by
reference and *"deliberately not narrowed"*, and `test-discovery.test.ts` reads that declaration and
refuses a narrowing.

*Test:* build, then assert that **no emitted path matches the configured include** — the include read
out of the configuration rather than retyped, as `packages/core/test/vitest-include.ts` already does.
**Show it red first:** plant a `dist/x.test.js` under a package and demonstrate that the configured
include collects it, so the criterion is known to have a subject. Assert the collected test-file set
is identical with the artifact present and absent — the same present-and-absent shape AC-12 uses,
which is what makes both of them checks rather than assertions of intent.

---

**AC-24 (new) — the documents describing a workspace that emits nothing are corrected in the same
change — `docs/`.**

*"When code and docs disagree, the docs are wrong until a DECISIONS entry says otherwise — fix them
in the same change"* (`docs-and-decisions.md`), and the numbered documents are living documents whose
status line is bumped with the date and what changed.

**(measured)** `docs/04-architecture.md:97`, *"What a cache hit claims, since Q-0072"*, states *"A hit
means no file this task reads, and no same-kind task in a package it depends on, has changed since
the cached result"* — written when every task replayed a verdict, and now owed a second half: a hit
on `build` replays an **artifact**, which is a different promise and the whole subject of 078. The
**Package map** at `:42` describes `packages/core`'s public API and names no emit.

*Test:* assert the emit is described in exactly one place and that the description matches the
shipped `turbo.json`, **read out of the file rather than transcribed** — the Q-0088 precedent that a
transcription of configuration drifts silently because it goes on looking like the thing it
describes. **The status line is bumped by appending, never by replacement** (R-9):
`packages/shared/src/docs.test.ts:195` requires that document's status line to keep containing the
literal `'Q-0041'`, so a rewritten line turns the suite red. **The obligation itself has no
mechanical enforcement** — that guard is keyed on `Q-0041` and not on the running ticket — and this
is stated rather than implied, so a reviewer checks it by reading. **The decision entry is not
edited:** 078 has landed, and a landed entry is never edited, including the two figures §R-1
corrects.

---

## 5. Open questions

**OQ-1 — where do AC-8 to AC-11 run, and which package owns them?** *Owner: implementer, with a
recommendation. Not a blocker — the recommendation is executable as written, and its AC-8 half is
already fixed by that criterion.*

AC-10 mutates a source file and AC-11 renames an entry point. Doing either to this checkout is a test
with a side effect on the tree it is judging, which Q-0073 rejected by name. So:

- **AC-8 runs against the real workspace** — fixed by the criterion, not optional, because R-4's
  ruling leaves the forced workspace suite as the only thing that builds this repository on every
  push. Its subject *is* this repository's declaration against this repository's emit. It writes only
  gitignored `dist/`, which `harness/rules.md` permits — *"a repository it built itself"*.
- **AC-9, AC-10 and AC-11 run against a temporary workspace the test builds**, whose `build` task
  definition is **read out of the repository's root `turbo.json`** rather than retyped. That pattern
  exists and is not being invented: `test-command.test.ts:129–158`'s `seenBy` writes a throwaway
  workspace into `tempDir()`, hands it `turboConfig().tasks.test` **verbatim**, runs the real
  `node_modules/.bin/turbo` in it, and says why — *"Running this repository's own suite instead would
  make the check spawn the run it is running inside."* **(measured)** `packages/core/test/repo.ts`
  already exports `tempDir`, `write` and `removeTempDirs`.

**Which package owns them is a hash question, not a taste question.** A test that builds package *P*
takes its verdict from *P*'s sources, so the owning task must already hash them or must declare them
(Q-0072). `@quorum/cli` depends on **both** `@quorum/core` and `@quorum/shared` **(measured)**, so
`@quorum/cli#test` hashes both through its `^test` edges and needs only `../../turbo.json` added to
`packages/cli/turbo.json`. `@quorum/core#test` has an edge to `shared` but **not** to `cli`, so owning
them there means declaring `packages/cli/src/**` by hand. **Recommendation: `packages/cli`.** It is
where AC-12 already sits, and **(measured)** `turbo-inputs.test.ts:127–147` states that
`packages/cli` is deliberately not one of its two audited `SUITES` — its reads are audited by
`package.test.ts`'s own `OUTSIDE`/`DECLARED` registers, a lighter mechanism whose floors this ticket
will not disturb.

**One residue, stated rather than left to be found:** a fixture proves turbo's replay semantics
faithfully and proves nothing about this workspace's wiring. So AC-9's *real* round trip — build,
delete `dist/`, rebuild, import — is additionally performed **by hand at the gate** and recorded in
the implement report with its turbo summary, on the precedent `test-discovery.test.ts` sets for its
own AC-12 (*"that proof is gate evidence rather than a suite member, and it is said here so its
absence is not read as an oversight"*).

**OQ-2 — is `@quorum/cli`'s emit built now or at Q-0098?** *Owner: implementer. Recommendation: now.*
078(a) rules the strategy against the post-Q-0091 tree and names all three packages; 078(c) says all
three declare a `build` script. Q-0098 needs the artifact before it can point a shebang at it, and
building two of three would leave the third's `outputs` undeclared and its build configuration
unwritten — a seam inside one criterion. The cost is that AC-12 and AC-23 become live rather than
hypothetical, which is why both are in this ticket and not in Q-0098.

**OQ-3 — does anything assert the emit is *current* rather than merely present?** *Owner: nobody, and
that is 078(f).* Registered so it is not read as an oversight: under (b) the suites prove source, so a
`dist/` stale relative to `src/` is caught by AC-10 within the build task's own cache semantics and
by nothing else until Q-0095 runs the mock end-to-end through the built binary. No criterion is added;
the gap is the ruling's stated price.

**Not an open question, and recorded so it is not re-opened at the gate:** whether the root gains a
`build` script and whether CI builds. Run 1's candidate made it a criterion with two costed readings.
It is **ruled by measurement** in R-4 — `WORKSPACE_TASKS`'s own doc comment forbids `build` joining a
register meaning *executed rather than replayed* — and the ruling is safe because AC-8 runs against
the real workspace inside the suite CI already forces.

---

## 6. Non-goals

- **The export surface of `@quorum/core`** — Q-0096's, and landed. Its `exports` map,
  `customConditions` and `ssr.resolve.conditions` are read and asserted here, never re-decided.
- **The `bin` target, the shebang, the mode bit, the packed tarball and what `npx quorum` may claim**
  — Q-0098's (AC-15 to AC-21). `packages/cli/package.json`'s `bin` **value** is untouched;
  `package.test.ts:63–77` deliberately asserts only that the key carries a non-empty string, and that
  is not narrowed here. **(measured)** `packages/cli` declares no `exports` map, and this ticket adds
  none: a `bin` is resolved by path, not by an export map.
- **A `files` field on any manifest** — 078(e) rules it and Q-0098's AC-19 owns it.
- **Publishing to the public registry** — Q-0029's, in M6. Refused rather than deferred by 078(d): no
  test name, success message or document added here may assert that a cold machine can obtain Quorum
  from the registry.
- **A bundler, or any new dependency.** 078(a) rules `tsc` per package and Shape D leaves the bundler
  door open for a later ticket with a subject. Adding one here would need a `docs/DECISIONS.md` entry,
  which no step on the chore route may write.
- **Node type stripping.** Refuted twice in 078 Shape E; R-1 is the first of those refutations
  reproduced as a live measurement, not an invitation to revisit it.
- **Generalising `docs.test.ts`'s status-line guard** to the running ticket (R-9), and **correcting
  `test-command.test.ts:406`'s "at least" message** (R-4). Both are real, both are one line, and both
  are in files this ticket otherwise leaves alone; changing them in passing invites a reviewer to read
  an untouched guard as a moved one.
- **Any change to `spike/`.** Ground rule 1.
- **`@quorum/server`, `@quorum/web`, `@quorum/compiler`, `@quorum/templates`.** They emit nothing and
  declare no `build` script (078(c)); a no-op build script in four packages declares an artifact that
  does not exist.
- **Making `test` or `typecheck` depend on `build`.** Refused by 078(b) as Shape B, on measured cost.

---

## 7. Risks

**RK-1 — a criterion set that cannot be satisfied as written.** R-1. AC-9 requires executing an
artifact that will not execute until `@quorum/shared` emits. An implementer without AC-22 reaches an
unexplained `ERR_MODULE_NOT_FOUND` mid-round and has, per GO-2, no `blocked` verdict — only prose the
human does not read until the gate. *Mitigation:* AC-22 exists, with the red evidence written into it.

**RK-2 — the working tree is dirty with exactly the artifact this ticket is about.** §1.
`packages/shared/test/corpus.js` and `corpus.d.ts` are untracked, unignored `tsc` output from run 1.
Left in place they are hashed by `@quorum/shared#test`, they will be enumerated by AC-8's set-equality
check as emitted-but-undeclared, and a `git add -A` commits them. *Mitigation:* remove both before the
implement step; they are reproducible from `corpus.ts` and nothing reads them.

**RK-3 — a fix for the emit's `tsconfig` that turns `lint` red.** R-5. Excluding tests from the
package `tsconfig.json` removes the project `projectService` needs, and the failure surfaces in
`lint`, a task no criterion here is about. *Mitigation:* AC-7's recommendation, and AC-14's
requirement that `lint` and `typecheck` be demonstrated unchanged.

**RK-4 — the fifth `dist` site is invisible until it fires, and then it looks like a code defect.**
R-8. An emitted `*.test.js` does not fail to be scanned; it *runs*, and its failure message is about
a path, not about a build. *Mitigation:* AC-23, with the red demonstration required rather than
optional.

**RK-5 — the first guard met is one nobody named.** R-4. A one-word edit to root `package.json` turns
`test-command.test.ts:406` red with a `toStrictEqual` on two string arrays that does not say why.
*Mitigation:* the ruling, stated with the doc comment that grounds it, so the edit is not made.

**RK-6 — the input guard refuses the change on the way in.** Q-0072's guard has earned a registration
from four consecutive tickets. New reads of `turbo.json`, of package manifests and of a temp
workspace's contents each meet one of clauses B, C1, C3 or C4. *Mitigation:* this is the machinery
working; OQ-1's siting minimises it, and `turbo-inputs.test.ts`'s `SUITES` floors — *"clause A wants
more than 24 hashed inputs … and `@quorum/cli` has 21"* — are explicitly not this ticket's to move.

**RK-7 — a build inside a test is slow, and a timeout reads as a defect.**
`test-command.test.ts`'s two nested-turbo tests already carry `180_000` timeouts **(measured)**. A
three-package build plus a cache round trip wants the same. A test that times out on a slow machine is
a verdict that depends on the machine, which Q-0079 rules against. *Mitigation:* generous explicit
timeouts, and a fixture workspace of one small package rather than a copy of this one.

**RK-8 — `dist/` present changes what an existing assertion sees.** `package.test.ts:239` asserts
`result.value.endsWith('/dist/index.js')` and its comment already anticipates this ticket — *"the
prefix is `packages/cli/node_modules/@quorum/core` in a clean tree and `packages/core` once Q-0097
emits … This assertion is deliberately not Q-0097's to replace."* **(measured, and it holds.)**
Registered so a reviewer seeing the prefix move does not read it as a regression. The wider hazard is
the class: any assertion whose verdict differs between a built and an unbuilt checkout is now live,
and AC-12's and AC-23's *"identical verdicts with the artifact present and absent"* is the sweep for it.

**RK-9 — GO-3.** `harness/Q-0097/integration` must exist before the first chore run; `review` diffs
against it and only `integrate`, which runs later, creates it. A first-pass run refuses in the
preflight rather than billing (Q-0038). Cut it deliberately from the requirements tip rather than from
whatever `HEAD` holds (Q-0037 GA-2).

**RK-10 — GO-4, Q-0039 unfixed.** Two runs on one ticket share a worktree and compute the same run
id. Do not run this ticket concurrently with Q-0096 or Q-0098.

---

## 8. Cross-cutting checklist

| | |
| --- | --- |
| **BYOS** | **n/a as a change; live as a guard.** No code path, test, fixture or document added here may accept an API key. AC-12 is where it touches: `frame.source.test.ts`'s credential scan must return the **same verdict** with the artifact present and absent, and the emitted-copy fixture proving the exclusion has a subject uses the placeholder the existing fixture uses (`ANTHROPIC_API_KEY=x` inside a pruned directory) — never a real value, never a new pattern. |
| **Worktree safety** | **n/a to product behaviour.** No flow, engine or adapter code changes. Live for the *tests*: a build writes `dist/` and `.turbo/` into whatever tree it runs in, and `commands.install` runs only in an `integrate` worktree, so an implement step must `pnpm install --frozen-lockfile` before it can build at all (`harness/rules.md`). |
| **Gate behaviour** | **n/a.** No gate, loop bound or verdict vocabulary changes. GO-2 stands: a finding contradicting a ground rule or 078's ruling is closed by an erratum written **during** the loop, as soon as the contradiction is provable. |
| **File format and schema** | **n/a to product formats** — no flow, ticket, role or step-output schema moves, and `packages/shared`'s zod schemas are untouched in content. What changes is `packages/shared`'s *manifest* (AC-22), which is packaging, not a product format. |
| **Lint rules** | **Live, and the one nobody named.** `eslint.config.js` is unchanged; what must not change is the property its comment at `:26–31` rests on — every package carrying a `tsconfig.json` with no `include`, so `projectService` finds a project for every linted file, tests included (R-5). `**/dist/**` is already in `ignores` **(measured)**, so emitted output is never linted. AC-14 requires `lint` demonstrated unchanged. |
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
   already registered against this ticket and are **not** to be fixed here: `test-command.test.ts:406`'s
   "at least" message, and `docs.test.ts:195`'s guard being keyed on `Q-0041` rather than the running
   ticket (R-4, R-9).
4. **`packages/core` already holds the logic** — look there before porting anything. Nothing is
   ported by this ticket; it is configuration and guards.
5. **`packages/core/src/spike-parity.test.ts` is updated in the same change, with its line totals
   re-derived rather than adjusted.** **Expected to be a no-op and asserted as one rather than
   skipped:** it pins `spike/test/` totals — **(measured)** `2959` entangled of `5428`, share **55%**
   — and this ticket adds no spike test file and moves no assertion between the halves. Re-run it and
   record the figures; a share that *has* moved means something was misclassified, and that is the
   finding rather than the arithmetic.

---

## 10. Gate obligations

- **GO-1 — discharged.** *"The emit serves the binary, and no test verdict moves behind it"*
  (2026-09-02) is landed as `docs/decisions/078-the-emit-serves-the-binary.md` and indexed under
  2026-09-02 as the last entry. **(measured.)** Every criterion above is read against it; one
  contradicting it is closed by an erratum, not by a round. **Two of its figures are corrected in §R-1
  and the entry is not edited.**
- **GO-2 — Q-0083 does not exist.** An implement step has no `blocked` verdict. A finding
  contradicting a ground rule or 078's ruling is closed by an erratum written **during** the loop, as
  soon as the contradiction is provable (*"A refused finding is a gate, not another round"*,
  2026-08-31).
- **GO-3 — `harness/Q-0097/integration` must exist before the first chore run**
  (`02-sdlc-pipeline-spec.md` §5.8), cut deliberately from the requirements tip (Q-0037 GA-2).
- **GO-4 — Q-0039 is unfixed.** Not concurrent with Q-0096 or Q-0098.
- **GO-5 (new) — clear the two stray emitted files before the run.** `packages/shared/test/corpus.js`
  and `corpus.d.ts` are untracked run-1 leftovers matched by no `.gitignore` rule (§1, RK-2). Removing
  them costs one command; leaving them means AC-8's set-equality check opens on a tree that already
  contains undeclared emit, and the implementer spends a round on it.
- **GO-6 (new) — nothing here needs ruling at the gate, and that is stated rather than assumed.** Run
  1's candidate escalated the root-script/CI question (its OQ-2, AC-23) as a human decision. It is
  decidable by measurement and is decided in R-4. If the gate disagrees with that ruling, saying so
  now costs a sentence; saying so in the loop costs a round, because the two readings differ in which
  of four guards the implementer meets first.
