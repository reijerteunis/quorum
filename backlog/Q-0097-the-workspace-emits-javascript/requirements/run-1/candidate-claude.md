# Q-0097 — The workspace emits JavaScript

*Requirements, run 1, candidate: claude. Written against the tree at `9efffdb` (2026-09-02), after
`main` carried Q-0096's merge. Every figure below is measured on that tree and is marked
**(measured)**; where it disagrees with the ticket body, decision 078 or Q-0096's merged
requirement, the disagreement is stated rather than reconciled silently.*

---

## 1. Problem

`packages/core` now declares `"exports": { ".": { "quorum-source": …, "default": "./dist/index.js" } }`
and `packages/cli` declares `"bin": { "quorum": "./bin/quorum.js" }`. Both point at files that do
not exist. **(measured)** — `packages/cli/bin` is absent, and no `dist/` exists anywhere in
`packages/`.

That is Q-0096 working as designed: it ruled where the artifact will be and proved that the
resolution machinery sends `tsc` and Vitest to source and a plain `node` process to the emit. What
it deliberately did not do is build anything. So today the workspace has a manifest that promises an
artifact, a resolver configured to find one, and nothing that produces one.

For the `maintainer` the symptom is narrow and total: **there is no `pnpm turbo run build`, no
`build` script in any package, and no `outputs` on any task.** **(measured)** — root `turbo.json`
declares exactly `lint`, `typecheck` and `test`, each with `"outputs": []`; `tsconfig.base.json`
declares no `outDir`, no `rootDir` and no `declaration`; the three package-level `turbo.json` files
declare `inputs` and nothing else. Nothing in this workspace has ever emitted JavaScript, and
nothing in it is arranged to.

The cost of that is not felt here — it is felt at Q-0098, which cannot make `quorum` run, and at
Q-0095, which cannot exercise the binary. This ticket's whole job is to produce the artifact those
two consume, and to do it **without moving a single existing verdict behind it**, which is what
decision *"The emit serves the binary, and no test verdict moves behind it"* (2026-09-02) rules.

There is a second problem, and it is the one that makes this ticket more than a configuration edit.
**A `build` task with real `outputs` introduces a class of failure this repository has never had.**
`lint`, `typecheck` and `test` all declare `"outputs": []`, so a cache hit on any of them replays a
*verdict* — the failure mode Q-0065, Q-0071 and Q-0072 each closed one layer of. A hit on `build`
replays an **artifact**, and an artifact a downstream process then executes fails differently: the
stale tick lies about the past, the stale artifact lies about the present. AC-8 to AC-11 exist to
establish that the new class is bounded before anything is built on top of it.

---

## 2. User stories

- **`maintainer`.** *I run one command from a clean checkout and get JavaScript I can hand to Node.
  I never have to remember to build first, and when turbo tells me a build was cached I get back a
  file that runs — not a claim that a file once ran.*
- **`maintainer`.** *Adding a fourth task to the workspace does not silently narrow the two registers
  that assert which tasks every package owes. If a package stops emitting, or starts, something goes
  red.*
- **`contributor`.** *When I add a package, I am told whether it owes a `build` script by a check,
  not by a doc comment that stopped being true.*
- **`adopter`.** *n/a this ticket.* The adopter's first thirty minutes are Q-0098's and Q-0028's; this
  ticket changes nothing an adopter runs. Named so its absence is a ruling and not an oversight.

---

## 3. What was re-derived, and what moved

Q-0010 ground rule 5 and *"a measurement copied from a document is not a measurement"* (Q-0058).
Six things were checked against the tree before a criterion was written on them.

### R-1 — The decisive finding: `@quorum/core`'s emit will not run, and no criterion says so

**Measured, twice, and reproducible in one command.** From `packages/core`, a plain `node` process
resolves `@quorum/shared` to **TypeScript source**:

```
$ cd packages/core && node --input-type=module \
    -e "console.log(import.meta.resolve('@quorum/shared'))"
file:///…/quorum/packages/shared/src/index.ts
```

and importing it fails:

```
$ cd packages/core && node --input-type=module -e "await import('@quorum/shared')"
ERR_MODULE_NOT_FOUND — Cannot find module '…/packages/shared/src/constants.js'
                       imported from '…/packages/shared/src/index.ts'
```

That is decision 078's **Shape E refutation (1)** arriving as a live defect rather than as a rejected
alternative. The cause is one manifest: `packages/shared/package.json` declares

```json
"exports": { ".": { "types": "./src/index.ts", "default": "./src/index.ts" } }
```

— **no conditional map**, unlike the one Q-0096 gave `@quorum/core`. **(measured)**

The consequence is exact. `packages/core/dist/index.js` will carry
`import … from '@quorum/shared'`, because **14 production files under `packages/core/src` carry a
value import of it** — that figure re-derives to 078's `14` exactly. **(measured)** Node resolving
that specifier gets `./src/index.ts` and dies as above. **So AC-9's *"the restored artifact is then
executed or imported successfully"* cannot pass, and neither can any honest reading of AC-8, until
`@quorum/shared` gains the same conditional map and its own emit.**

This is not a discovery. Q-0096's own closing commit says it in as many words — *"Reported and not
fixed: `@quorum/shared` still names `./src/index.ts` for both conditions, which Q-0097 must close or
core's emitted dist dies under Node"* — and decision 078(a) names `@quorum/shared` among the three
packages that emit. **What is missing is a criterion.** AC-7 to AC-14 do not mention
`packages/shared` once. That is **AC-22** below, and it is the single most load-bearing addition this
document makes: an implementer working from the criteria alone would build `core` and `cli`, watch
AC-9 fail under Node, and have to derive the cause mid-loop from a resolver error.

*A note on the neighbouring counts, so a later reader does not read a drift into them.* 078 states
`packages/core/src` holds 53 `.ts` files naming `@quorum/shared` — 21 production and 32 tests. Today
it is **22 production and 33 tests** by the same "names it anywhere" rule, and **45 files carry an
actual import statement** (20 production, 25 tests). **(measured)** The two-file difference is
consistent with Q-0096's merge, which touched nine `packages/core/src` files. Nothing in this ticket
rests on the naming counts; the value-import count, which is what decides whether the emit needs
`@quorum/shared` at runtime, is 14 and unchanged.

### R-2 — `packages/cli`'s production emit needs no workspace package at runtime

**(measured)** `packages/cli/src` holds exactly one cross-package import in production —
`import type { RunTerminalEvent } from '@quorum/shared'` at `exit.ts:12` — which `tsc` erases.
`index.ts:3` names `@quorum/core` in a comment only. The one *value* import of `@quorum/shared` in
this package is `exit.test.ts:20` (`runTerminalEventSchema`), a test.

So `packages/cli/dist/index.js` will be self-contained today, and 078(g)'s registered limit applies:
the emit proves the easy case and acquires its real subject at Q-0091's first value import. **This
is why AC-9's execution proof must be run against `@quorum/core`'s artifact and not only against
`@quorum/cli`'s** — the cli artifact would pass while the defect R-1 names sat untouched.

### R-3 — AC-14 names the wrong file for one of its three guards

The ticket says *"the `--force` guard in `project.test.ts`"*. There are two files by that name.
**(measured)** The `--force` guard is **`packages/shared/src/project.test.ts`** (`:127` `forcesTurbo`,
`:136–137`, Q-0065 AC-3, asserting over `harness/harness.yaml`'s `commands.test`).
`packages/core/src/backlog/project.test.ts` is `loadProject`'s unit suite and contains no such
assertion. Corrected in AC-14 below rather than left for the implementer to discover.

### R-4 — AC-14 misses a fourth guard, and it is the one a `build` script trips

`packages/core/src/test-command.test.ts:404`, *"Q-0072 AC-9 — `package.json` and CI name the same
task set"*:

```js
const fromScripts = namedBy(Object.values(scripts()));
expect(fromScripts).toStrictEqual(WORKSPACE_TASKS.slice().sort());   // ['lint','test','typecheck']
expect(namedBy(jobSteps(ci).map((s) => s.run ?? ''))).toStrictEqual(fromScripts);
```

`namedBy` extracts every token following `turbo run`. **(measured)** `WORKSPACE_TASKS` is
`['lint', 'typecheck', 'test']` at `:194`, and root `package.json`'s scripts are the three plus
`sweep:git-identity`, which names no turbo task.

So **the moment root `package.json` gains `"build": "turbo run build"`, both assertions go red**, and
the second one stays red until CI's `workspace` job also runs `pnpm turbo run build --force`. AC-14
names the `--force` guard, the executes-not-replays guard and `CI_JOBS`, and does not name this one.
It is the guard most likely to be met first, because it fires on a one-word edit to `package.json`.
This is why **AC-23** exists as its own criterion: whether the root gains a `build` script is a
*decision*, not a demonstration, and the guard makes it one that cannot be taken quietly.

### R-5 — the emit's `tsconfig` cannot be the one `lint` and `typecheck` use

Not named anywhere in the ticket or in 078, and it decides the shape of the change.

**(measured)** Every package `tsconfig.json` is three lines — `{ "extends": "../../tsconfig.base.json" }`
— with no `include` and no `exclude`, so `tsc`'s default `**/*` compiles **test files too**. A build
under that configuration emits `dist/frame.source.test.js`, `dist/package.test.js` and so on, which
is (a) AC-12's hazard in its sharpest form and (b) an emit set nobody wants to declare.

The obvious fix — add `"exclude": ["**/*.test.ts"]` to the package `tsconfig.json` — **breaks
`lint`.** `eslint.config.js:26–31` says so in its own words: *"Every package carries a
`tsconfig.json` extending the base with no `include`, so the service finds a project for every
linted file and none needs `allowDefaultProject`"*. ESLint's `projectService` covers
`packages/**/*.ts`, **tests included** (`harness/rules.md`, Q-0069), so excluding tests from the
project leaves every `*.test.ts` without one and the type-aware `no-deprecated` rule without its
type information.

**The resolution is a separate `tsconfig.build.json` per emitting package**, used by the `build`
script alone (`tsc -p tsconfig.build.json`), extending the package `tsconfig.json` and adding
`outDir`, `rootDir`, `declaration` and the test exclusion. `tsconfig.json` is untouched, so `lint`
and `typecheck` are untouched, which is 078(b)'s *"no verdict that exists today moves"* applied to
the two verdicts nobody thought to check. Stated as a strong recommendation in AC-7 rather than as a
criterion, because the implementer may find a cleaner arrangement; what is a criterion is that
`lint` and `typecheck` are demonstrated unchanged (AC-14).

`rootDir` is named explicitly rather than inferred: with it unset, `tsc` derives the common root from
the input set, so removing the last file outside `src/` would silently move every emitted path.
`incremental`/`composite` are recommended **off**, so no `*.tsbuildinfo` is produced and AC-8's
output set has no gitignored member to argue about.

### R-6 — three of the four `dist`-awareness sites already hold; the fourth is `frame.source.test.ts`

AC-12's claim was checked rather than relayed, and it is right in all four cells. **(measured)**

| site | today | Q-0097 |
| --- | --- | --- |
| `.gitignore:4` | `dist/` — matches at any depth | unchanged |
| `eslint.config.js:19` | `'**/dist/**'` in `ignores` | unchanged |
| `packages/core/src/git-identity.test.ts:90` | `if (entry.name === 'node_modules' \|\| entry.name === 'dist') continue;` | unchanged |
| `packages/cli/src/frame.source.test.ts:73` | `GENERATED = ['node_modules', '.turbo']` | **fails closed** |

The failure is not hypothetical. `packageFiles()` walks the package in **any** extension with only
those two names pruned, and the file's own header promises *"emitted output is deliberately not among
them"* and *"no verdict below depends on whether this checkout has run a build"*. An emitted
`dist/frame.source.test.js` carries every credential pattern the credential scan looks for, so the
scan goes red — and it goes red **only in a checkout that has built**, which is precisely the
verdict-depends-on-the-checkout defect Q-0096's round 2 caught in the assertion next door.

### R-7 — `packages/cli/turbo.json`'s `not.toContain('"outputs"')` survives, and AC-7's hedge is spent

AC-7 says *"if the build task lands there, that assertion is reconciled deliberately"*. **Decision
078(c) rules that it does not**: `build` is a root task, and package-level configurations go on
declaring `inputs` and nothing else so root `turbo.json` stays the one place `env` is decided.

So `packages/cli/src/package.test.ts:133–134` — `not.toContain('"env"')` and
`not.toContain('"outputs"')` — is correct as written and **must not be touched**. **(measured)** The
hedge in AC-7 is closed by the ruling and is recorded here so a reviewer does not read an untouched
assertion as an unmet criterion.

---

## 4. Acceptance criteria

Eleven, numbered so citations resolve across the three tickets. **AC-7 to AC-14 are the ticket's,
carried with their scope intact. AC-22 to AC-24 are new** — numbered from 22 because Q-0098 owns
AC-15 to AC-21, so nothing collides in either direction.

*Test:* sketches are a starting point, not a frozen contract. Where one is wrong, an erratum corrects
it **during** the loop, as soon as the contradiction is provable (*"An erratum is the last repair,
not the first"*, 2026-08-30).

---

**AC-7 — a `build` task exists at the root, declares real `outputs`, and orders itself by
dependency — workspace.**

Root `turbo.json` gains `build` beside `lint`, `typecheck` and `test`, with `dependsOn: ["^build"]`
and a **non-empty** `outputs`, so one invocation from a clean checkout produces prerequisites before
consumers with no manual command and no prior typecheck or test. `@quorum/shared`, `@quorum/core` and
`@quorum/cli` each declare a `build` script; the four stub packages do not (078(c)). The three
existing tasks keep `"outputs": []`. Package-level `turbo.json` files go on declaring `inputs` and
nothing else (R-7).

**Recommended and not mandated (R-5):** the emit is driven by a per-package `tsconfig.build.json`
carrying `outDir`, `rootDir: "src"`, `declaration: true` and a test exclusion, so the package
`tsconfig.json` that `lint` and `typecheck` read is untouched.

*Test:* read root `turbo.json` and every package-level one; assert `build.outputs` is a non-empty
array, that `build.dependsOn` contains `"^build"`, and that `lint`, `typecheck` and `test` still
declare `[]`. Assert each package configuration declares `inputs` and no other key, and that root
`turbo.json`'s `test.env` still holds `QUORUM_REAL_CLI` (Q-0065). Assert the emitting set — the
packages declaring a `build` script — is exactly `{shared, core, cli}` and that each names one.

---

**AC-8 — the declared outputs cover exactly what the build writes — workspace.**

Verified by building and enumerating, never by reading the declaration (*"A check is not established
by reading it"*, 2026-08-29). Under-declaring is the stale-artifact hazard in its exact form.
Over-declaring the *package* directory is refused; declaring the *emit* directory whole is not the
same thing and is what 078(e) rules — nothing but the build writes under `dist/`, and this criterion
is what proves that rather than assuming it.

*Test:* remove the emit directories, build, enumerate every path written, and assert **set equality
with the declaration in both directions** — no emitted path outside the declaration, no declared
pattern matching nothing. The declaration set includes the `.d.ts` files `exports.types` promises
(`packages/core`'s map already names `./dist/index.d.ts`). If any `*.tsbuildinfo` is produced it is
either declared or the incremental option that produces it is removed; a gitignored output that the
declaration omits is under-declaration wearing a gitignore.

---

**AC-9 — a replayed build is executable — workspace.**

Clean build, cache preserved, **declared artifacts deleted**, the same build re-run to obtain a cache
hit, and the restored artifact then imported successfully in a plain `node` process. This is the
property no task in this workspace has ever needed, all three existing tasks declaring `"outputs":
[]` and replaying a verdict.

**The execution proof is run against `@quorum/core`'s artifact, not only `@quorum/cli`'s** (R-2):
`packages/cli/dist/index.js` has no runtime workspace dependency today, so it would pass while R-1's
defect stood. Importing `@quorum/core` under the default condition exercises the whole chain —
`core/dist/index.js` → `@quorum/shared` → `shared/dist/index.js` — which is why this criterion is
also AC-22's integration proof.

*Test:* assert the cache hit occurred by reading turbo's own summary rather than by inferring it from
timing; assert the artifact is on disk again; then spawn `node` from `packages/cli` (where the
`@quorum/core` link lives — measured from the workspace root the failure is "package not found",
which is a different fact) and `await import('@quorum/core')`, asserting the sixteen exported symbols
are present. A `RESOLVED`-only assertion is not enough here: `import.meta.resolve` answers from the
manifest without the target existing, which is exactly why Q-0096 used it and exactly why this
ticket may not.

---

**AC-10 — a changed input cannot execute a stale artifact — workspace.**

Build, change a source or build-configuration input that affects emitted output, rebuild through
turbo, and prove the **executed** artifact reflects the change — not that turbo reported a miss.

*Test:* the verdict depends only on tracked files, lockfile-installed dependencies and files the test
creates — never on a pre-existing ignored `dist/`, on user-level configuration or on account identity
(*"A test's verdict is a property of the commit, not of the checkout or the account"*, 2026-08-30).
See §5 OQ-1: this criterion mutates a source file, so it runs in a workspace the test built, not in
the checkout it is judging.

---

**AC-11 — repeated builds do not depend on leftovers — workspace.**

The build succeeds with the emit directories absent **and** with output from an earlier build
present, and produces the same declared artifacts for the same inputs. A removed or renamed entry
point does not remain executable because an old emitted file survived.

*Test:* build, rename an entry point, rebuild, assert the old emitted path is gone. Same siting rule
as AC-10.

---

**AC-12 — the artifact is invisible to every source scan, and `frame.source.test.ts` regains its two
promises — `packages/cli`.**

`GENERATED` at `:73` gains the emit directory, and the file's header stops promising something that
has stopped being true. Both promises are load-bearing: *"emitted output is deliberately not among
them"* was correct when the layout was Q-0096's to choose and is now false, and *"no verdict below
depends on whether this checkout has run a build"* is the claim the exclusion restores rather than
merely asserts.

*Test:* the register gains the entry as an **identity, not a count** — the `toStrictEqual` at `:298`
is updated to the new three-element list, with the derived per-entry fixture loop extended by
construction so a fourth entry arrives with a subject or fails (Q-0073, *"a count is not an
identity"*). **Show the credential scan red first**, against a tree carrying an emitted copy of a
test file, *before* the exclusion lands — which is what proves the exclusion has a subject rather
than being a precaution. Assert the credential scan and the signal-handler scan return identical
verdicts with the artifact present and absent. Assert `git check-ignore -v` resolves an emitted path
to `.gitignore:4`, that `eslint.config.js:19`'s `**/dist/**` covers it, and that
`git-identity.test.ts:90`'s `walk` skips it — three cells already hold and are asserted **with their
reasoning**, so a later reader knows the question was asked (R-6).

---

**AC-13 — the task registers are derived, and the sentence they assert is 078(c)'s — `packages/core`,
`packages/cli`.**

**(measured)** `packages/core/src/test-discovery.test.ts:59` declares
`TASKS = ['lint','typecheck','test'] as const` under *"The three tasks the root `turbo.json` declares,
and therefore the three every package owes"*, consumed at `:214`.
`packages/cli/src/package.test.ts:80` inlines the same array under *"declares the three tasks turbo
runs"*. **Neither is derived.** Add `build` and both stay at three, both doc comments become false,
and turbo skips every package with no `build` script in silence — verbatim the failure the first
guard's own describe block exists to close, and the fail-open shape Q-0051 found in
`q0050.source.test.ts`. The asymmetry is stated in the first guard's own words: its `PACKAGES` half
*is* derived from the workspace globs *"so a package added later is covered without anyone
remembering"*, and a task added later is not.

078(c) rules the sentence the registers must now assert: **every package owes `lint`, `typecheck` and
`test`; `build` is owed by the packages that emit, and the register names which.**

*Test:* derive the universal task list from root `turbo.json` rather than hand-writing it, and derive
the emitting set from the manifests that declare a `build` script, so neither can narrow in silence.
Assert the emitting set is exactly the three 078(c) names, so a fourth package that starts emitting —
or one of the three that stops — fails here. **Demonstrate the register red first:** with the
hand-written array restored and a `build` task present, show that a package lacking a `build` script
passes unnoticed.

---

**AC-14 — the harness commands, CI, the sweep, and the two files whose stated reasons this ticket
falsifies, are changed or demonstrated unchanged — repository.**

Under 078(b) `test` and `typecheck` gain no `^build` edge, so the expectation is that most of this
list is **unchanged and asserted so**. The subjects, all verified present at the gate:

- `harness/harness.yaml` `commands.install` (`npm install --prefix spike … && pnpm install
  --frozen-lockfile`) and `commands.test` (`npm test --prefix spike && pnpm turbo run test --force
  --continue`). **(measured)**
- `.github/workflows/ci.yml`'s `workspace` job — see **AC-23**, which owns the one change this list
  may need.
- `.github/scripts/git-identity-sweep.sh`, whose five phases are `isolation`, `probe`, `install`,
  `spike suite`, `workspace suite`, the last running `pnpm turbo run test --force`. **(measured)**
- **`packages/core/src/shared-resolution.test.ts:1–6`**, whose stated reason is *"`turbo.json` has no
  `build` task and `tsconfig.base.json` emits nothing, so `@quorum/shared` resolves from its
  TypeScript source"*. This ticket falsifies **both clauses** while the test keeps passing — the
  resolution is now the `quorum-source` condition's doing, which Q-0096 landed and this comment never
  learnt. A comment naming an authority that has stopped being true is what `harness/rules.md`
  forbids, and it is corrected in the same change.

*Test:* where a file is unchanged, **assert it with the reasoning**, so a later reader knows the
question was asked rather than missed. Where changed, the `--force` guard at
**`packages/shared/src/project.test.ts:127,136–137`** (R-3 — *not* `packages/core/src/backlog/project.test.ts*)
and the executes-not-replays guard in `test-command.test.ts` must both still hold, and
`test-command.test.ts:506`'s `CI_JOBS` register of seven jobs — pinned by `toStrictEqual` on its keys
— is updated only if a **job** is added; a build **step** inside the existing `workspace` job leaves
it alone. `CI_JOBS.workspace`'s description and the job's `name:` are prose and are corrected to say
what the tick claims.

---

**AC-22 (new) — `@quorum/shared` emits and resolves by the same mechanism as `@quorum/core`, so the
emitted `dist/` runs under Node — `packages/shared`.**

The criterion R-1 measures. `packages/shared/package.json`'s `exports` becomes the conditional map
078(b) describes — `quorum-source` resolving `./src/index.ts`, the default resolving
`./dist/index.js`, `types` resolving `./dist/index.d.ts` — and the package declares a `build` script
producing that artifact. Without it, `packages/core/dist/index.js` fails at its first specifier and
AC-9 cannot pass.

*Test:* **demonstrate the defect before closing it.** From `packages/core`, in a plain `node`
process, `await import('@quorum/shared')` today yields
`ERR_MODULE_NOT_FOUND … packages/shared/src/constants.js imported from … packages/shared/src/index.ts`;
capture that as the red evidence, then assert the same import resolves and executes after the change.
Assert the map's shape as `package.test.ts:181` already does for `@quorum/core`, and assert Vitest
still resolves `@quorum/shared` to source — `shared-resolution.test.ts`'s value import of `STAGES`
and `stageSchema` is the existing proof and must stay green unchanged, which is 078(b)'s guarantee
tested on the package that carries every schema. **Retire `packages/shared/src/index.test.ts`'s
manifest assertions by replacement rather than deletion** if any of them pin the flat map, on the
precedent Q-0096 set for the byte pin it replaced.

---

**AC-23 (new) — the root scripts and CI agree on the task set, and the decision is taken rather than
tripped over — repository.**

R-4's guard. Two coherent answers exist and the criterion is that one is chosen deliberately and the
guard is left with a subject:

- **(a) — recommended.** Root `package.json` gains `"build": "turbo run build"`, and CI's `workspace`
  job gains `- run: pnpm turbo run build --force` beside its three. `WORKSPACE_TASKS` becomes four.
  A developer gets `pnpm build`; CI proves the emit compiles on every push, which narrows 078(f)'s
  registered gap — *the suites prove source and the binary ships emit* — at the cost of one step. No
  verdict moves behind the artifact, because no task gains a `^build` edge; the build step is beside
  the other three, not before them, and this must be demonstrated rather than asserted.
- **(b).** Neither gains it. `pnpm turbo run build` stays the only spelling, the guard is untouched
  and nothing in CI ever builds — which means the first thing to discover a broken emit is Q-0098's
  implement step.

*Test:* whichever is chosen, assert it and assert the guard still discriminates — under (a), a
workflow fixture that runs three of the four tasks fails; under (b), a `package.json` fixture
carrying a `build` script fails. **The unforced rule survives either way:** `test-command.test.ts:414`
requires every root script to stay unforced and to carry no `:ci` second spelling, and a `build`
script naming `--force` fails it.

---

**AC-24 (new) — the documents that describe a workspace emitting nothing are corrected in the same
change — `docs/`.**

`docs-and-decisions.md`: *"When code and docs disagree, the docs are wrong until a DECISIONS entry
says otherwise — fix the docs in the same PR"*, and the numbered documents are living documents whose
status line is bumped with the date and what changed.

**(measured)** `docs/04-architecture.md`'s **Testing strategy** states what a cache hit claims —
*"A hit means no file this task reads … has changed since the cached result"* — a sentence written
when every task replayed a verdict, and which now has a second half: a hit on `build` replays an
**artifact**, and that is a different promise. The **Package map** describes the seven packages and
names no emit. Both are edited, and the status line records this ticket.

*Test:* `packages/shared/src/docs.test.ts:195` asserts the status line of each numbered document a
change edits was bumped, keyed on a ticket id. Assert the emit is described in exactly one place and
that the description matches the shipped `turbo.json` — read out of the file rather than transcribed,
on the Q-0088 precedent that a transcription of configuration drifts silently because it goes on
looking like the thing it describes. **The decision entry is not edited**: 078 has landed, and a
landed entry is never edited (`docs-and-decisions.md`).

---

## 5. Open questions

**OQ-1 — where do AC-8 to AC-11 run, and which package owns them?** *Owner: implementer, with a
recommendation. Not a blocker — the recommendation is executable as written.*

AC-10 renames a source file and AC-11 renames an entry point. Doing either to this checkout is a test
with a side effect on the tree it is judging, which Q-0073 rejected by name and
`test-discovery.test.ts`'s own header re-states (*"a fixture on disk makes the answer depend on what
the checkout contains"*). So:

- **AC-8 runs against the real workspace.** Its subject *is* this repository's declaration against
  this repository's emit, and no fixture can stand in for that. It writes only gitignored `dist/`,
  which `harness/rules.md` permits — *"a repository it built itself"*.
- **AC-9, AC-10 and AC-11 run against a temporary workspace the test builds**, whose `build` task
  definition is **read out of the repository's root `turbo.json`** rather than retyped. That pattern
  already exists and is not being invented: `test-command.test.ts:126–158`'s `seenBy` writes a
  throwaway workspace into `tempDir()`, gives it `turboConfig().tasks.test` **verbatim**, runs the
  real `node_modules/.bin/turbo` in it, and says why — *"Running this repository's own suite instead
  would make the check spawn the run it is running inside."* `packages/core/test/repo.ts` already
  exports `tempDir`, `write` and `removeTempDirs`.

**Which package owns them is a hash question, not a taste question.** A test that builds package *P*
takes its verdict from *P*'s sources, so the owning task must already hash them or must declare them
(Q-0072). `@quorum/cli#test` has `^test` edges to **both** `@quorum/core` and `@quorum/shared`
**(measured)**, so it hashes both transitively and needs only `../../turbo.json` added to
`packages/cli/turbo.json`. `@quorum/core#test` has an edge to `shared` but **not** to `cli`, so
owning them there means declaring `packages/cli/src/**` by hand. **Recommendation: `packages/cli`.**
It is also where AC-12 already sits, and `turbo-inputs.test.ts:130–147` states that `packages/cli` is
deliberately not one of its two audited `SUITES` — its reads are audited by `package.test.ts`'s own
`OUTSIDE`/`DECLARED` registers, a lighter mechanism whose floors this ticket will not disturb.

**One residue, stated rather than left to be found:** a fixture proves turbo's replay semantics
faithfully and proves nothing about this workspace's wiring. So AC-9's *real* cache round-trip —
build, delete `dist/`, rebuild, import — is additionally performed **by hand at the gate** and
recorded in the implement report with its turbo summary, on the precedent
`test-discovery.test.ts` sets for its own AC-12 (*"that proof is gate evidence rather than a suite
member, and it is said here so its absence is not read as an oversight"*).

**OQ-2 — does root `package.json` gain a `build` script, and does CI build?** *Owner: human, at the
gate. Recommendation: (a), both.* Written as **AC-23** with both readings costed, because the guard at
`test-command.test.ts:404` makes it a decision either way and the failure mode of not deciding is a
red suite three minutes into the implement step.

**OQ-3 — is `@quorum/cli`'s emit built now or at Q-0098?** *Owner: implementer. Recommendation: now.*
078(a) rules the strategy against the post-Q-0091 tree and names all three packages; 078(c) says all
three declare a `build` script. Q-0098 needs the artifact to exist before it can point a shebang at
it, and building two of three would leave the third's `outputs` undeclared and its `tsconfig.build.json`
unwritten — a seam inside one criterion. The cost is that AC-12 becomes live rather than hypothetical,
which is why AC-12 is in this ticket and not in Q-0098.

**OQ-4 — does anything assert the emit is *current* rather than merely present?** *Owner: nobody, and
that is 078(f).* Registered here so it is not read as an oversight: under (b) the suites prove source,
so a `dist/` that is stale relative to `src/` is caught by AC-10 within the build task's own cache
semantics and by nothing else until Q-0095 runs the mock end-to-end through the built binary. No
criterion is added for it; the gap is the ruling's stated price.

---

## 6. Non-goals

- **The export surface of `@quorum/core`** — Q-0096's, and landed. Its `exports` map, `customConditions`
  and `ssr.resolve.conditions` are read and asserted here, never re-decided.
- **The `bin` target, the shebang, the mode bit, the packed tarball and what `npx quorum` may claim** —
  Q-0098's (AC-15 to AC-21). This ticket leaves `packages/cli/package.json`'s `bin` value alone;
  `package.test.ts:63–77` deliberately asserts only that the key carries a non-empty string, and that
  is not narrowed here.
- **Publishing to the public registry** — Q-0029's, in M6. Refused rather than deferred by 078(d): no
  test name, success message or document added by this ticket may assert that a cold machine can
  obtain Quorum from the registry.
- **A bundler, or any new dependency.** 078(a) rules `tsc` per package and (Shape D) leaves the
  bundler door open for a later ticket with a subject. Adding one here would need a
  `docs/DECISIONS.md` entry, which no step on the chore route may write.
- **Node type stripping.** Refuted twice in 078 Shape E; R-1 is the first of those refutations
  reproduced as a live measurement, not an invitation to revisit it.
- **Any change to `spike/`.** Ground rule 1.
- **`@quorum/server`, `@quorum/web`, `@quorum/compiler`, `@quorum/templates`.** They emit nothing and
  declare no `build` script (078(c)); a no-op build script in four packages declares an artifact that
  does not exist.
- **Making `test` or `typecheck` depend on `build`.** Refused by 078(b) as Shape B, on measured cost:
  all 1,520 workspace tests would then prove an artifact.

---

## 7. Risks

**RK-1 — the ninth and tenth appearances of the same pattern, and this one is armed.** The ticket's
own precondition section is right that 078 is landed and GO-1 discharged. The residual risk is
different and is R-1: **a criterion set that cannot be satisfied as written**, because AC-9 requires
executing an artifact that R-1 proves will not execute. An implementer who does not add AC-22 will
reach an unexplained `ERR_MODULE_NOT_FOUND` mid-round and has, per GO-2, no `blocked` verdict — only
prose. *Mitigation:* AC-22 exists, with the red evidence written into it.

**RK-2 — the first guard met is the one nobody named.** R-4. A one-word edit to root `package.json`
turns `test-command.test.ts:404` red, and the message (`toStrictEqual` on two string arrays) does not
say why. *Mitigation:* AC-23, with both readings costed.

**RK-3 — a fix for the emit's `tsconfig` that turns `lint` red.** R-5. The obvious edit — excluding
tests from the package `tsconfig.json` — removes the project ESLint's `projectService` needs, and the
failure surfaces in `lint`, a task this ticket has no criterion about. *Mitigation:* AC-7's
recommendation, and AC-14's requirement that `lint` and `typecheck` be demonstrated unchanged.

**RK-4 — the input guard refuses the change on the way in.** Q-0072's guard has earned a registration
from four consecutive tickets. New reads of `turbo.json`, of package manifests and of a temp
workspace's contents each meet one of clauses B, C1, C3 or C4. *Mitigation:* this is the machinery
working, and OQ-1's siting recommendation minimises it — under `packages/cli` the audit is
`package.test.ts`'s `OUTSIDE`/`DECLARED` registers, and `turbo-inputs.test.ts`'s own `SUITES` floors
(*"clause A wants more than 24 hashed inputs … and `@quorum/cli` has 21"*) are explicitly not this
ticket's to move.

**RK-5 — a build inside a test is slow, and a timeout reads as a defect.** `test-command.test.ts`'s
two nested-turbo tests already carry `180_000` timeouts. A build of three packages plus a cache
round-trip will want the same. A test that times out on a slow machine is a verdict that depends on
the machine, which Q-0079 rules against. *Mitigation:* generous explicit timeouts, and a fixture
workspace with one small package rather than a copy of this one.

**RK-6 — `dist/` present changes what an existing assertion sees.** `package.test.ts:239` asserts
`result.value.endsWith('/dist/index.js')` and its comment already anticipates this ticket — *"the
prefix is `packages/cli/node_modules/@quorum/core` in a clean tree and `packages/core` once Q-0097
emits … This assertion is deliberately not Q-0097's to replace."* **(measured, and it holds.)**
Registered so a reviewer seeing the prefix move does not read it as a regression. The wider hazard is
the class: any assertion whose verdict differs between a built and an unbuilt checkout is now live,
and AC-12's *"identical verdicts with the artifact present and absent"* is the sweep for it.

**RK-7 — Q-0039 is unfixed (GO-4).** Two runs on one ticket share a worktree and compute the same run
id. Do not run this ticket concurrently with Q-0096 or Q-0098.

**RK-8 — GO-3.** `harness/Q-0097/integration` must exist before the first chore run; `review` diffs
against it and only `integrate`, which runs later, creates it. A first-pass run refuses in the
preflight rather than billing (Q-0038).

---

## 8. Cross-cutting checklist

| | |
| --- | --- |
| **BYOS** | **n/a as a change; live as a guard.** No code path, test, fixture or document added here may accept an API key. AC-12 is the one that touches it: `frame.source.test.ts`'s credential scan must return the **same verdict** with the artifact present and absent, and the emitted-copy fixture that demonstrates the exclusion has a subject uses the same placeholder pattern the existing fixture uses (`ANTHROPIC_API_KEY=x` in a pruned directory) — never a real value, and never a new pattern. |
| **Worktree safety** | **n/a to product behaviour.** No flow, engine or adapter code changes. Relevant to the *tests*: a build writes `dist/` and `.turbo/` into whatever tree it runs in, and `commands.install` runs only in an `integrate` worktree, so an implement step must `pnpm install --frozen-lockfile` before it can build at all (`harness/rules.md`). |
| **Gate behaviour** | **n/a.** No gate, loop bound or verdict vocabulary changes. GO-2 stands: a finding contradicting a ground rule or 078's ruling is closed by an erratum written **during** the loop, as soon as the contradiction is provable. |
| **File format and schema** | **n/a to product formats** — no flow, ticket, role or step-output schema moves, and `packages/shared`'s zod schemas are untouched in content. What changes is `packages/shared`'s *manifest* (AC-22), which is packaging, not a product format. |
| **Lint rules** | **Live, and the one nobody named.** `eslint.config.js` is unchanged; what must not change is the property its comment at `:26–31` depends on — every package carrying a `tsconfig.json` with no `include`, so `projectService` finds a project for every linted file including tests (R-5). `**/dist/**` is already in `ignores`, so emitted output is never linted. AC-14 requires `lint` demonstrated unchanged. |
| **Cold-clone impact** | **Neutral by construction, and that is the point.** 078(b) keeps every existing verdict on source, so a stranger's `pnpm install && pnpm test` is unchanged. Under AC-23(a) CI gains one step; a developer gains `pnpm build`, which they do not need in order to run the suite. The first thirty minutes get longer only at Q-0098, which is where the binary they type actually appears. |
| **Product-agnostic** | **n/a.** Nothing here names a SaaS product. |
| **Cross-vendor rule** | **Satisfied by the chore flow's panel** — `review` runs on a different adapter than `implement`. No change. |
| **Errors are explicit** | **Live in one place:** a build that cannot write, or a cache restore that yields nothing, must fail the task rather than leave a partial `dist/` for something downstream to execute. AC-9 and AC-11 are what would catch a silent partial restore. |

---

## 9. Ground rules — Q-0010's, restated because a child cannot read its parent

1. **Do not modify `spike/src/`.** The spike stays authoritative and green until cutover; a witness
   that has been edited is not one. **Nothing in this ticket needs to:** the emit is a workspace
   concern and `spike/` is plain Node ESM on npm, outside pnpm, outside turbo and outside ESLint. If
   a change there appears genuinely required, stop and say so — it would mean a criterion has been
   misread.
2. **The spike's own tests are not deleted or edited to make room.**
3. **Behaviour is preserved, and a known defect is reported rather than fixed in passing.**
4. **`packages/core` already holds the logic** — look there before porting anything. Nothing is
   ported by this ticket; it is configuration and guards.
5. **`packages/core/src/spike-parity.test.ts` is updated in the same change, with its line totals
   re-derived rather than adjusted.** **Expected to be a no-op and asserted as one rather than
   skipped:** that guard pins `spike/test/` line totals and this ticket adds no spike test file and
   moves no assertion between the library and binary halves, so the 55% transfer share should be
   unchanged. Re-run it and record the figures; a share that *has* moved means something was
   misclassified and is the finding, not the arithmetic.

---

## 10. Gate obligations

- **GO-1 — discharged.** *"The emit serves the binary, and no test verdict moves behind it"*
  (2026-09-02) is landed as `docs/decisions/078-the-emit-serves-the-binary.md` and indexed under
  2026-09-02. **(measured.)** Every criterion above is read against it; a criterion contradicting it
  is closed by an erratum, not by a round.
- **GO-2 — Q-0083 does not exist.** An implement step has no `blocked` verdict. A finding
  contradicting a ground rule or 078's ruling is closed by an erratum written **during** the loop
  (*"A refused finding is a gate, not another round"*, 2026-08-31).
- **GO-3 — `harness/Q-0097/integration` must exist before the first chore run** (`02-sdlc-pipeline-spec.md`
  §5.8), cut deliberately from the requirements tip rather than from whatever `HEAD` holds (Q-0037 GA-2).
- **GO-4 — Q-0039 is unfixed.** Not concurrent with Q-0096 or Q-0098.
- **GO-5 (new) — rule OQ-2 at this gate, before the implement step runs.** Whether root
  `package.json` gains a `build` script and whether CI builds is AC-23's subject; it is a
  one-sentence ruling and it decides which of two guards the implementer meets first. Ruling it here
  costs a sentence; ruling it in the loop costs a round.
