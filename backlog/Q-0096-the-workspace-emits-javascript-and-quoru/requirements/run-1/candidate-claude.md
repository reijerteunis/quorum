# Q-0096 — The workspace emits JavaScript, and `quorum` is a runnable binary

*Requirements, run 1, 2026-09-02. Candidate: claude. Ticket stage: `draft`. Child of Q-0010,
seventh of seven. Surfaces touched: **CLI** (`packages/cli`), the workspace build configuration,
and `docs/` (a decision entry plus `04-architecture.md`).*

---

## 0. What was measured, and what changed as a result

Every claim in the ticket body was re-verified against `main` before this document was written,
because a ticket body dated 2026-09-01 describing a tree that six siblings are working in is a
document, not a measurement — and *"a measurement copied from a document is not a measurement"*
(Q-0058). **All six of the body's findings hold.** Five things it did not know are load-bearing and
appear below as criteria.

### 0.1 The body's findings, confirmed

| Claim | Verdict | Evidence |
| --- | --- | --- |
| No `build` task anywhere | ✅ holds | `turbo.json` declares `lint`, `typecheck`, `test` and nothing else; no `packages/*/package.json` has a `build` script |
| `tsconfig.base.json` declares no `paths` | ✅ holds | five keys total: `target`, `module`, `moduleResolution`, `strict`, `skipLibCheck` — and no `outDir` or `noEmit` either |
| `packages/core` declares no `exports`, `main` or `types` | ✅ holds | manifest has `name`, `version`, `private`, `type`, `scripts`, `dependencies` |
| `@quorum/shared` exports `./src/index.ts` for both conditions | ✅ holds | `packages/shared/package.json` |
| All seven packages are `"private": true` | ✅ holds | counted: `cli`, `compiler`, `core`, `server`, `shared`, `templates`, `apps/web` |
| All three turbo tasks declare `"outputs": []` | ✅ holds | `turbo.json` |
| 142 shared and 1,280 core tests resolve through the source export today | ✅ **exact** | measured `pnpm turbo run test --force`: shared 142/142, core 1,280 passed + 2 skipped, cli 94, 7 tasks, 0 cached |

### 0.2 Five findings the ticket did not have

**F-1 — `packages/cli` already declares a `bin`, and it points at nothing.**
`packages/cli/package.json` carries `"bin": { "quorum": "./bin/quorum.js" }`, and
`packages/cli/bin/` **does not exist**. Q-0090 declared the field and deliberately asserted only
that the key carries a non-empty string (`package.test.ts`, *"and says nothing about what that key
points at, which is Q-0096's to decide"*), with the path recorded in that test's own comment as
provisional. So this ticket does not *add* a `bin` entry — it makes an existing dangling pointer
resolve, and it may move it. Q-0090 also measured that `pnpm install --frozen-lockfile` exits 0 and
creates no shim, because nothing depends on `@quorum/cli` and pnpm is never asked to resolve the
target; that measurement is what stops the dangling pointer from being visible today.

**F-2 — the type-stripping failure is one step further along than the body describes, and there are
two distinct failures.** Measured on the installed Node (v24.15.0; `.nvmrc` pins 22):

```
import('@quorum/shared') → ERR_MODULE_NOT_FOUND
  Cannot find module '…/packages/shared/src/constants.js'
  imported from '…/packages/shared/src/index.ts'

import('@quorum/core')   → ERR_MODULE_NOT_FOUND
  Cannot find package '@quorum/core'
```

These are not the same failure. `@quorum/shared` **resolves as a package** and Node **does strip the
types** on `index.ts` — it gets one file in, then dies on the first relative `./x.js` specifier,
because stripping does not map a `.js` specifier onto a `.ts` file. `@quorum/core` never gets that
far: with no `exports`, `main` or `types`, the package itself is unresolvable. The body attributes
the first failure to `packages/core` as the importer; it is a property of `shared`'s own internal
specifiers and reproduces from anywhere. **One cause each, and they need different fixes** — the
first is the emit strategy, the second is a five-line manifest key.

**F-3 — `packages/core/src/index.ts` is a one-line stub, so resolvability is necessary and not
sufficient.** Its entire contents are `export const name = '@quorum/core';`. All **sixteen** domain
symbols the four command children need exist in `core` and **none** is re-exported: `runFlow`
(`engine/engine.ts`), `loadFlow` and `loadFlowByName` (`engine/loaders.ts`), `lintFlowDirectory`,
`lintDirectory` and `FlowError` (`lint/lint.ts`), `Backlog` (`backlog/backlog.ts`), `loadProject`
and `findProject` (`backlog/project.ts`), `getAdapter` and `probeAdapter` (`adapters/adapters.ts`),
`overrideAdapters` (`adapters/override.ts`), `validateArtifact` (`contracts/contracts.ts`),
`containment` (`git/git.ts`), `GateUnansweredError` (`engine/types.ts`), `IntegrationError`
(`fanout/fanout.ts`). Adding an `exports` key alone would make `import('@quorum/core')` resolve to
an object with one useless string in it — **the trap moves rather than closes**, and Q-0090's
expiring assertion would go red for a package that still delivers nothing to Q-0091.

**F-4 — that stub is byte-pinned by a different package's suite.**
`packages/shared/src/index.test.ts:68` asserts

```ts
expect(fs.readFileSync(path.join(repoRoot, 'packages/core/src/index.ts'), 'utf8'))
  .toBe(`export const name = '${SCOPE}core';\n`);
```

under the test name *"core declares the dependency, and nothing else in core changed"* — a Q-0041
assertion that the port's first child had not touched `core`. It has outlived its subject. Populating
the barrel turns `@quorum/shared#test` red, in a package this ticket is not otherwise editing, and
`packages/core/src/index.ts` is a **declared input** of `@quorum/shared#test`
(`turbo-inputs.test.ts` MANIFEST: *"index.test.ts — the entry point is byte-pinned"*), so the hash
moves and the failure is not cached away.

**F-5 — the emit collides with `frame.source.test.ts`, and the collision is this repository's
most-recorded defect class.** That file's `GENERATED` list is `['node_modules', '.turbo']`, pinned
**by identity** with `toStrictEqual` and with a fixture per entry. Its header says, in as many words:

> **Emitted output is deliberately not among them.** This workspace emits nothing and the output
> layout is Q-0096's to choose; naming a directory here now would be this ticket deciding it.

and, separately:

> **No verdict below depends on whether this checkout has run a build.**

Both promises break the moment a build writes under `packages/cli`. `packageFiles()` walks the
package in **any** extension with only those two names pruned, so an emitted copy of
`frame.source.test.js` — which quotes every credential pattern — lands in the scan and the AC-12
assertion `expect(matching).toStrictEqual([GUARD_IN_PACKAGE])` goes red. The deeper failure is the
second promise: the file's verdicts would become a function of whether a build had run, which is
*"A test's verdict is a property of the commit, not of the checkout or the account"* (2026-08-30),
arriving through this ticket's own artifact. `dist/` is already in `.gitignore`, already ignored by
`eslint.config.js:19`, and already skipped by `git-identity.test.ts:90` — three of the four places
that need to know already do, and the fourth is the one that fails closed.

### 0.3 One measurement that widens the option space

**Production source is fully erasable.** Zero TypeScript `enum` declarations, zero `namespace`s,
zero decorators across `packages/*/src` and `apps/*/src`. The single parameter property in the
workspace is `packages/cli/src/fail.test.ts:23` (`constructor(readonly code: unknown)`), in a test.
So `erasableSyntaxOnly` is satisfiable today and no source construct rules out a type-stripping
runtime. What rules it out is F-2's specifier problem alone, which is a *configuration* fact rather
than a source fact — worth knowing, because it means the strategy choice is genuinely open rather
than forced.

---

## 1. Problem

The `maintainer` and the `adopter` are promised a command called `quorum`. There is no such command
and there is no arrangement by which there could be one: this workspace has never emitted
JavaScript, `packages/cli` declares a `bin` pointing at a file that does not exist, and
`@quorum/core` — the package that holds every piece of logic a command would call — cannot be
imported at all, at typecheck or at runtime.

It works today because **Vitest transpiles**. Nothing else ever runs the code. That is a complete
description of the current runtime story: 1,516 tests pass against TypeScript source, and there is
no second consumer.

Q-0090 delivered the CLI frame as importable modules and stopped exactly there, because its
requirements run measured this and blocked twice, correctly. Q-0091 to Q-0094 build commands on that
frame and can also stop there, since they too are exercised in process. **Q-0095 cannot** — the mock
end-to-end suite runs the binary, 781 lines and 151 assertions, and it is M2's done-when. So this
ticket is the one place where "the workspace produces something a person can run" has to become
true, and every path to M2 closing runs through it.

It is not a packaging chore. Three separate architectural questions are open and none of them
belongs to the CLI alone:

1. **How does TypeScript become executable JavaScript here** — a build step, a runtime transpiler,
   or Node's type stripping — and does that choice reach every package or one?
2. **What does a `build` task do to a workspace where all three existing tasks declare
   `"outputs": []`?** Those tasks replay a *verdict*. A build replays an *artifact*. This repository
   has spent two tickets (Q-0065, Q-0071) and one decision (*"A cache hit names what the task reads,
   not what its package contains"*, 2026-08-28) on replayed verdicts, and a stale `dist/` that a
   downstream task then executes is a worse failure than a stale green tick, because a green tick at
   least fails loudly when it is finally forced.
3. **What may `npx quorum` honestly claim?** Every package is `"private": true` and `npx quorum`
   resolves against the **public registry** today — a stranger's package, or nothing. The
   cold-clone test (`product-context.md` pillar 7) is measured on that exact command, so a claim
   made here that is not true is a claim the `adopter` discovers by failing.

---

## 2. User stories

**`adopter` (cold-clone).** *As a stranger who has cloned the repository and installed its
dependencies, I want to run `quorum help` and see the command list, so that the first thing I do
with this product is not diagnosing why the binary the README names does not exist.* Today this
fails with `command not found`, or — worse, once a shim exists — with a Node syntax error inside a
`.ts` file, which reads as a broken product rather than as an unbuilt one.

**`maintainer`.** *As the maintainer, I want the emitted artifact to be something no cached task can
serve stale, so that a green suite and a working binary cannot disagree.* The specific fear is
concrete rather than theoretical: `integrate` reads only an exit code, worktrees share the main
checkout's turbo cache (Q-0065), and a build task whose `outputs` are wrong replays a binary built
from different source while every gate reports green.

**`maintainer` (as Q-0091 to Q-0095's author).** *As the author of the five remaining Q-0010
children, I want `import { Backlog, runFlow } from '@quorum/core'` to work, so that I write a
presentation layer rather than rediscovering that the dependency I was told to use resolves to
nothing.* Q-0090 pinned that failure deliberately and routed it here.

**`contributor`.** *As someone adding an adapter, I want `pnpm test` to keep meaning what it means
today, so that a build step does not put my test verdict behind an artifact I did not know existed.*

---

## 3. The shapes, and which one is recommended

The decision entry (AC-1) rules this. The two viable shapes are set out here with their measured
costs so the ruling is made against evidence rather than taste. A third is named and refuted.

### Shape 1 — build every package; `exports` moves to `dist/`

`tsc` emit per package, `build` task with `outputs: ["dist/**"]` and `dependsOn: ["^build"]`,
`exports` on `shared` and `core` repointed at `./dist/index.js` and `./dist/index.d.ts`.

**Cost, measured rather than estimated.** `test` and `typecheck` must gain a `^build` edge, because
55 files in `core` import `@quorum/shared` by package name and would otherwise resolve to nothing.
So **all 1,516 tests move behind a build artifact**, and the stale-artifact class reaches every
verdict in the workspace — precisely the outcome the ticket names as worse than a stale green tick.
`harness.yaml`'s `commands.test` and the git-identity sweep both grow a build phase. Zero new
dependencies, which is its one real virtue.

### Shape 2 — bundle `packages/cli` alone (**recommended**)

One `build` task, in one package, producing one self-contained `dist/quorum.js` with a shebang, with
`@quorum/core` and `@quorum/shared` **inlined** by a bundler. `core` gains an `exports` key
mirroring `shared`'s exactly — pointing at `./src/index.ts`, the shape already proven in this
workspace — and neither library package emits anything.

**Why it is recommended.** The new artifact-replay class is confined to one package and one file.
`test` and `typecheck` gain **no** `^build` edge, so all 1,516 tests keep resolving through source
and no existing verdict moves behind an artifact. Only `@quorum/cli#test` needs `dependsOn:
["build"]`, and only from Q-0095 onward. `commands.install` and `commands.test` in `harness.yaml`
need no change, which matters because a `chore` run's `integrate` executes them. And it is the
shortest path to the cold-clone command actually working, which is pillar 7.

**Its cost, stated rather than buried.** It needs one new dependency (`esbuild`, or `tsup` over it),
which rewrites `pnpm-lock.yaml` — a declared input of `@quorum/cli#test` — and needs the
justification `harness/rules.md` requires. And it creates a real divergence: **the suite proves
source while the binary ships a bundle, and until Q-0095 nothing proves the two agree.** AC-5 is the
minimum bridge and is deliberately not a substitute for Q-0095.

### Shape 3 — Node type stripping, no build — refuted

Refuted by F-2 rather than by preference: stripping resolves `@quorum/shared`, strips `index.ts`,
and fails on `./constants.js`. Closing it means rewriting every relative specifier across 111 source
files to `./x.ts` and enabling `allowImportingTsExtensions` + `rewriteRelativeImportExtensions` — a
mass edit that collides with the source-scanning guards in `frame.source.test.ts`,
`q0050.source.test.ts`, `turbo-inputs.test.ts` and `spike-parity.test.ts`. Named so the decision
entry can record that it was considered and priced, per §0.3's finding that no *source* construct
forbids it.

---

## 4. Acceptance criteria

Numbered, independently testable. Each names its surface. *Test:* sketches are written from the tree
as it stands on 2026-09-02 and are the implementer's starting point, not a frozen contract —
where one is wrong, an erratum corrects it during the loop rather than at the gate (*"An erratum is
the last repair, not the first"*, 2026-08-30).

### The precondition

**AC-1 — the decision entry exists before any code changes.**
`docs/decisions/078-<slug>.md` opens `# <Title> — <YYYY-MM-DD>`, carries **Decision**,
**Alternatives considered** and **Why**, and gains its line at the bottom of `docs/DECISIONS.md`. It
rules four things and no fewer: (a) the emit strategy, naming the refuted alternatives from §3;
(b) whether `exports` moves off `src/*.ts` for `@quorum/shared`, and what that does to the 142
shared and 1,280 core tests that resolve through it; (c) what `outputs` a `build` task declares and
why that set is exactly the artifact; (d) what `npx quorum` may claim before Q-0029.
*Test:* `packages/shared/src/docs.test.ts` already fails if the index and the folder disagree and if
the index's dates go backwards. Additionally assert the entry is cited by title and date — never by
number or file name — at the configuration site the ruling governs.
**This is a gate obligation, not an implement-step criterion.** See §7 GO-1.

### The emit

**AC-2 — the workspace has a `build` task, and it declares real `outputs`.**
The task is declared where the ruling puts it. Its `outputs` are non-empty, which is the property
that distinguishes it from all three existing tasks.
*Test:* read `turbo.json` (and any package-level `turbo.json`); assert the build task's `outputs`
is a non-empty array and that `lint`, `typecheck` and `test` still declare `[]`. Assert the
declared output set covers every file the build actually writes, by building into a clean tree and
comparing the emitted paths against the declaration — a build that writes outside its declared
`outputs` is the stale-artifact hazard in its exact form.

**AC-3 — a package-level `turbo.json` declares `inputs` and nothing else.**
Per the rule Q-0072 established and `packages/cli/turbo.json` already documents: root `turbo.json`
stays the one place `env` is decided, so the merge keeps `QUORUM_REAL_CLI` (Q-0065).
*Test:* `packages/cli/src/package.test.ts` already asserts `not.toContain('"env"')` and
`not.toContain('"outputs"')` for that file. If the build task lands in `packages/cli/turbo.json`,
that assertion must be **reconciled deliberately and its comment corrected**, not deleted — the
`outputs` clause was written when no build existed. Show the reconciled form failing against a
config that also declares `env`.

**AC-4 — the emitted artifact is gitignored, ESLint-ignored, and invisible to every source scan.**
*Test:* `git check-ignore -v <emitted path>` resolves to a rule in `.gitignore` (`dist/` already
matches, if `dist/` is the chosen name). Assert `eslint.config.js`'s `ignores` covers it. Assert
`packages/core/src/git-identity.test.ts`'s walk skips it.

### The binary

**AC-5 — `quorum help` runs under plain `node`, from a clean clone, and exits 0.**
The full chain: install → build → execute the file `bin.quorum` names → the frame's `HELP` on
stdout → exit 0. No Vitest anywhere in that chain.
*Test:* a fixture that resolves `bin.quorum` from the manifest, spawns it with `process.execPath`,
and asserts stdout contains the command list and `status === 0`. **Demonstrated red before green**:
against `main` the target does not exist, so the spawn fails with `ENOENT` — and that red must be
shown, because a test that passes for want of a subject is this repository's most-recorded defect
(*"a check that skips its subject must not report success"*, 2026-08-25).

**AC-6 — the artifact carries a shebang and is executable.**
`#!/usr/bin/env node` as the first bytes, matching `spike/bin/harness.js:1`, and the mode bit set.
*Test:* read the first line; `fs.statSync(...).mode & 0o111` is non-zero. Assert the shebang is the
**first** line, since a banner emitted after any other byte does not work.

**AC-7 — the exit-code table survives the boundary.**
Q-0090 owns 0, 1, 2, 130 on signal, and **3 for `undecided`** (Q-0040). Those are properties of
`packages/cli/src/exit.ts` today and are proven in process. This criterion proves at least one
non-zero code reaches a shell through the built artifact, so that the emit is known not to swallow
`process.exitCode`.
*Test:* spawn the binary in a way that yields a known non-zero status and assert the observed code.
Note the preserved defect this must **not** silently fix: an unknown command prints help and exits
**0** (`main.ts`, *"Why: preserved, see Q-0090 AC-6"*), whose successor is Q-0090's GA-4.

### `npx quorum`, claimed honestly

**AC-8 — two automated claims, and an explicit assertion that neither touched a registry.**
(a) **The workspace path** — the binary runs through the workspace's own shim.
(b) **The packed-tarball path** — `pnpm pack` the CLI package, install the tarball into a temporary
directory outside the repository, and run `quorum help` from it.
Each asserts, positively, that **no registry resolution occurred** — by resolving the executed path
and asserting it lies inside the fixture, and/or by running the install offline. A network-dependent
assertion is not acceptable: it would make the verdict a property of the machine, which
*"A test's verdict is a property of the commit"* (2026-08-30) forbids.
*Test:* the tarball fixture builds its own sandbox under `os.tmpdir()` and removes it. Note that
`private: true` blocks `publish` and not `pack`; the implementer verifies this rather than assuming
it, and reports if it is false.

**AC-9 — nothing in the repository claims registry `npx quorum` works.**
That claim is Q-0029's, in M6.
*Test:* scan the changed documentation and the new decision entry for a sentence asserting
registry-resolved `npx quorum`; assert the entry states which two paths are claimed and which is
deferred.

### `@quorum/core`'s export surface

**AC-10 — `@quorum/core` resolves, at runtime and at typecheck.**
*Test:* `await expect(import('@quorum/core')).resolves.toBeDefined()` from `packages/cli`, and a
type-only import that compiles. The typecheck half cannot be asserted by a test, so assert its
**cause** — the manifest keys — as `package.test.ts` already does in the opposite direction.

**AC-11 — the barrel exports the public API, so the trap closes rather than moves.**
At minimum the sixteen symbols in §0.2 F-3, which are exactly what `frame.source.test.ts`'s `DOMAIN`
list forbids the frame from reimplementing and therefore exactly what Q-0091 to Q-0094 must import.
This is the criterion that makes AC-10 worth having; see OQ-2.
*Test:* import the barrel and assert each symbol is defined, from a list derived from `DOMAIN` plus
the error classes rather than hand-typed twice. Assert `packages/core/src/index.ts` is no longer the
one-line stub.

**AC-12 — the byte pin in `packages/shared` is retired with its reason recorded.**
`packages/shared/src/index.test.ts:68` pins `packages/core/src/index.ts` byte for byte. Its subject
— *"nothing else in core changed"* during Q-0041 — expired when the port closed on 2026-08-31.
*Test:* the assertion is replaced by one that still says something true (that `core` declares
`@quorum/shared` as a workspace dependency, which is the half with a live subject), with a comment
naming Q-0096 as the authority for the removal. **Deleting it silently is refused**: it is a landed
pin, and its removal is a visible act.

**AC-13 — Q-0090's three expiring assertions are replaced by their successors.**
In `packages/cli/src/package.test.ts`: the `import('@quorum/core')` rejection, the three-absent-keys
assertion, and the `tsconfig.base.json` no-`paths` assertion. The `@ts-expect-error` directive above
the import must be **removed**, not left — an unused directive is itself a `tsc` error, which is the
mechanism Q-0090 chose so the change could not be made quietly.
*Test:* the successors assert the positive facts (the package resolves; the keys are present) and
`pnpm turbo run typecheck --force` is green, which it cannot be if the directive survives.

### The guards the emit disturbs

**AC-14 — `frame.source.test.ts` no longer has a verdict that depends on whether a build has run.**
The `GENERATED` identity register gains the emit directory, with a fixture demonstrating that the
new entry excuses a real file — derived from the list, as the existing loop is, so a fourth entry
added later arrives with a subject or fails. And the file's own promise is made checkable: assert
that the AC-12 credential scan and the AC-4(d) signal-handler scan return the same verdicts with the
artifact present and absent.
*Test:* the existing `expect(GENERATED).toStrictEqual(['node_modules', '.turbo'])` moves to the new
list — an identity, not a count (Q-0073). Show the credential scan **red** against a tree carrying
an emitted copy of a test file before the exclusion lands, which is what proves the exclusion has a
subject rather than being a precaution.

**AC-15 — every register the change touches is updated or demonstrated not to need updating.**
Named individually so none is closed by silence: `packages/core/src/turbo-inputs.test.ts`
(`SUITES`, `MANIFEST`, `NOT_READ`, `READ_BASES` — note `@quorum/cli` is deliberately **not** an
audited suite there, with its floors *"calibrated for these two"* and widening routed to Q-0091, so
a new read may need registering in the CLI's own suite instead); `test-command.test.ts`'s `CI_JOBS`
register of seven jobs, pinned by `toStrictEqual` — a build **step** inside the existing `workspace`
job leaves it alone, a new **job** does not; and `packages/core/src/spike-parity.test.ts` per ground
rule 5.
*Test:* for each, either the updated register with its assertion shown red beforehand, or a stated,
checked demonstration that it is untouched. **`spike-parity.test.ts` is expected to be a no-op**,
because this ticket changes no file under `spike/test/` — but ground rule 5 says re-derived rather
than adjusted, so the totals are re-run and the no-op is reported as a measurement, not assumed.

**AC-16 — `harness.yaml`'s commands and its shipped template are changed or demonstrated
unchanged.**
`commands.install` is `npm install --prefix spike … && pnpm install --frozen-lockfile` and
`commands.test` is `npm test --prefix spike && pnpm turbo run test --force --continue`. Under Shape
2 neither needs to change, because `test` gains no `^build` edge; under Shape 1 both do. The same
question applies to `.github/workflows/ci.yml`'s `workspace` job and to
`.github/scripts/git-identity-sweep.sh`, whose phases are `isolation`, `probe`, `install`,
`spike suite`, `workspace suite`.
*Test:* if unchanged, assert it — with the reasoning, so a later reader knows the question was asked
rather than missed. If changed, the `--force` guard in `project.test.ts` and the executes-not-replays
guard in `test-command.test.ts` must both still hold.

### Documentation

**AC-17 — `docs/04-architecture.md` states the runtime story, and its status line is bumped.**
That document currently says `npx quorum` starts the daemon and that `packages/server` serves *"the
built `apps/web`"* — the word *built* already appears while nothing in the workspace builds
anything. The Shape section and the Testing strategy section both need the emit named.
*Test:* `docs.test.ts` reads this file already; assert the status line carries 2026-09-02 and this
ticket. Per `docs-and-decisions.md`, when code and docs disagree the docs are wrong until an entry
says otherwise — so this lands in the same change.

**AC-18 — a new term goes in `docs/GLOSSARY.md` before it is used in a second file.**
If the ruling introduces vocabulary (a *build task*, an *emitted artifact*), it is defined there
first. If it introduces none, that is stated.

---

## 5. Non-goals

Explicit, because each is a plausible misreading of this ticket.

1. **Publishing.** No `npm publish`, no version policy, no scope decision, no removal of
   `"private": true` from any package. Q-0029, M6.
2. **Registry `npx quorum`.** Not claimed, not tested, not documented as working. AC-9 asserts the
   absence of the claim.
3. **Any command.** `board`, `lint`, `validate`, `adapters`, `runs`, `init`, `ticket`, `run` are
   Q-0091 to Q-0094. This ticket makes `quorum help` run and nothing more.
4. **Translating the mock end-to-end suite.** Q-0095. AC-5 is a smoke check on one command, and is
   explicitly *not* offered as coverage for the binary's behaviour.
5. **Building `apps/web` or `packages/server`.** M3. If the chosen shape happens to generalise,
   that is a property to note, not scope to take.
6. **Fixing the unknown-command exit 0.** Preserved per ground rule 3 and Q-0090 AC-6; successor is
   Q-0090's GA-4.
7. **`packages/templates` being populated.** It is a one-line stub; the shipped templates live at
   `spike/templates/harness`. Q-0093's `init` needs them. This ticket only owes the *packaging*
   consequence — see OQ-4.
8. **Any change under `spike/src`.** Ground rule 1. If one is genuinely required, the run stops and
   says so rather than proceeding.
9. **Editing the spike's own tests.** Ground rule 2.
10. **Reimplementing a domain helper in `packages/cli`.** Ground rule 4 and
    `frame.source.test.ts`'s `DOMAIN` scan. A helper that appears to be missing from `core` is
    reported.
11. **A second bundler or a second build system for the sake of `apps/web`.** One tool, one task.
12. **Migrating relative import specifiers to `.ts`.** Shape 3's cost, refuted in §3.

---

## 6. Open questions

Owner and blocking status on each. A blocker is a question whose answer changes a file format, the
adapter contract, or the shape of the deliverable.

**OQ-1 — which shape? (BLOCKER; owner: human, at the requirements gate)**
§3 recommends Shape 2. This is AC-1's subject and cannot be settled by an implement step. It is
listed separately from AC-1 because the *entry* is the deliverable and the *choice* is the input to
it.

**OQ-2 — does the barrel belong to this ticket or to Q-0091? (BLOCKER; owner: human)**
AC-11 asserts it does, on the reasoning that a resolvable-but-empty `@quorum/core` moves the trap
rather than closing it, and that Q-0090's expiring assertion would then go red for a package that
delivers nothing. The counter-argument is real and should be heard: the barrel's *contents* are
driven by what the four command children import, none of which is written yet, so this ticket might
export sixteen symbols and discover Q-0092 wants a seventeenth. **Recommended resolution:** export
the sixteen — they are not a guess, they are `frame.source.test.ts`'s own `DOMAIN` list plus the
error classes, which is to say the list Q-0090 already wrote down as what the children will need —
and let a later child add to it, which is an ordinary edit rather than a trap.

**OQ-3 — does `@quorum/shared`'s `exports` move? (owner: the decision entry)**
Under Shape 2 it does not, and 1,422 tests are undisturbed. Under Shape 1 it does. AC-1(b) requires
the entry to say which and to state the consequence for the test counts, which are measured in §0.1
and should not be re-derived from any earlier document.

**OQ-4 — where must the binary sit for `init` to find the shipped templates? (owner: this ticket,
answered as a constraint rather than as behaviour)**
`spike/bin/harness.js:321` resolves templates as `path.join(here, '..', 'templates', 'harness')` —
**relative to the binary's own file**. So the emitted artifact's location is load-bearing for
Q-0093, and a bundle that inlines modules cannot inline a directory of files. This ticket does not
implement `init`, but its `pnpm pack` fixture (AC-8b) is the first thing that will reveal whether
the templates ship at all, and the `files` field is a packaging question. **Recommended:** answer it
as a stated constraint in the decision entry — where the artifact sits and what `files` must carry —
so Q-0093 inherits a ruling rather than a surprise. Do not build `init`.

**OQ-5 — does `@quorum/cli#test` gain `dependsOn: ["build"]` now or at Q-0095? (owner: implementer,
reported)**
Nothing in this ticket's suite needs the artifact except AC-5, AC-6 and AC-8, which need it very
much. Declaring it now is honest; declaring it now also means every CLI test run triggers a build.
Either is defensible; the requirement is that the choice is stated rather than defaulted.

**OQ-6 — is `pnpm pack` on a `"private": true` package actually permitted? (owner: implementer,
verified not assumed)**
`private` blocks `publish`. `pack` is believed to work. This is stated as a belief because it was
not measured while writing this document, and AC-8(b) fails visibly if it is wrong — at which point
the tarball half is reported as unachievable rather than quietly dropped, and OQ-1's shape is
unaffected.

---

## 7. Gate obligations

**GO-1 — AC-1's decision entry must exist before the chore run is launched, and no step on the
chore route can write it.**

Stated in advance and prominently, because this is the **tenth** appearance in this repository of a
loop handed work no step in it can perform, and the ninth was Q-0062, whose requirement *named the
hazard by name* and whose run was launched without the entry anyway — spending three implement
rounds and reaching an exhaustion gate before round 3 refused correctly and supplied a draft. The
cost of that mistake on this ticket is not hypothetical: `developer-generalist` is forbidden to
write a decision entry (`harness/roles/developer-generalist.md:23`), so an implement step handed
AC-1 has one channel, which is prose the human does not read until the gate.

**The recommendation is procedural.** Write the entry by hand at the requirements gate, after
ruling OQ-1 and OQ-2, and *then* launch the chore run — the precedent is Q-0058's GO-1 and
Q-0069's. Q-0090's own requirements run recorded the same lesson from the other side: its retries
only produced a ready document once the gate ruling had been written into the ticket body first, and
a `retry` on an unchanged tree cannot rule its own blocker.

**GO-2 — Q-0083 does not exist yet.** An implement step that finds a finding it may not act on
still has no `blocked` verdict (*"A refused finding is a gate, not another round"*, 2026-08-31). If
the review loop produces a finding that contradicts a ground rule or AC-1's ruling, the remedy is an
erratum written **during** the loop as soon as the contradiction is provable, not at the exhaustion
gate.

---

## 8. Risks

**R-1 — the bundle and the source diverge, and nothing notices until Q-0095.** Under Shape 2 the
suite proves TypeScript source while the binary ships inlined output. AC-5 spawns exactly one
command. *Mitigation:* state the gap in the decision entry as a registered, accepted limit rather
than leaving it to be discovered — the distinction Q-0072's E-1 item 3 draws, where a stated gap is
acceptable and the same gap unmentioned is the defect.

**R-2 — the artifact-replay hazard arrives with the fix.** A `build` task whose `outputs`
under-declare what it writes produces a cache hit that replays an incomplete artifact, and
`integrate` reads only an exit code. AC-2's second half exists for this and should be verified by
building into a clean tree rather than by reading the declaration — *"A check is not established by
reading it"* (2026-08-29).

**R-3 — the merge is red in an existing checkout until `pnpm install` runs.** Q-0090 measured this
exactly: `pnpm install --frozen-lockfile` reports *"Already up to date"* in 180 ms and the suite
flips green; CI does a fresh install and never sees it; a developer pulling the merge does, and it
looks like a code defect. A new dependency under Shape 2 makes this **worse**, not the same — the
lockfile genuinely changes. Say so in the implement report.

**R-4 — the two suites are verified in one environment row only.** Per Q-0072's closing finding and
`integrate-tick-is-worktree-scoped`: the integration worktree has neither `.harness/worktrees` nor
`.quorum/runs`, and a build adds a **third** gitignored directory that a working checkout has and a
fresh clone does not. That is the exact shape of Q-0072's instance. Verify forced in both rows, and
treat `dist/` as a fourth cell of that matrix rather than assuming AC-14 covers it.

**R-5 — a bundler is a new dependency in a repository that has added almost none.** `harness/rules.md`
wants small, boring and proven, with a one-line justification. `esbuild` qualifies on all three
counts; `tsup` adds a layer over it for `.d.ts` emit this ticket does not need. If the entry cannot
justify the dependency, Shape 1 is the fallback and its cost is §3's, not a smaller one.

**R-6 — Q-0039 becomes a blocker if two of Q-0010's children run concurrently.** Two runs on one
ticket share a worktree and compute the same run id, and there is no lock of any kind in either
tree. This ticket may run in parallel with Q-0091 to Q-0094 by design, which is exactly the
condition Q-0039 describes.

**R-7 — the emit collides with a guard nobody enumerated here.** §0.2 F-5 and AC-15 name the four
registers found by searching. The search was `grep`-based and is not a proof of exhaustiveness. An
implement step that trips a fifth reports it as a finding rather than editing it in passing.

---

## 9. Cross-cutting checklist

| | |
| --- | --- |
| **BYOS** | No API-key path is added. `frame.source.test.ts`'s `CREDENTIAL` scan covers `packages/cli/**` in every extension and must keep passing — **and AC-14 is precisely the criterion that stops the emit from breaking it**, since a compiled copy of that guard carries all nine patterns. Erratum E-1 of Q-0090 governs the inventory: membership here is a filesystem question, not a git one, so a gitignored `dist/` is still scanned unless it is a named exclusion. |
| **Worktree safety** | n/a to the deliverable — this ticket writes no flow and no run. The chore run itself writes only inside `.harness/worktrees/`. Note that the build writes into the worktree, which is correct and is why AC-4 matters. |
| **Gate behaviour** | Unchanged. No flow file is edited. GO-1 is a sequencing obligation on the human, not a gate change. |
| **File format and schema** | No ticket, flow, role or step-output schema changes. `package.json` and `turbo.json` are configuration, and `projectConfigSchema` is untouched. |
| **Lint rules** | ESLint's scope is `packages/**/*.ts` and `apps/**/*.ts` with `**/dist/**` already ignored, so emitted output is outside it by construction. `@typescript-eslint/no-deprecated` stays the only type-aware rule; a bundler's API must be checked against its own typings before use, since nothing detects a deprecated call outside `packages/**`. |
| **Cold-clone impact** | **Positive and the point of the ticket** — this is the first change that makes the command the README will name actually exist. It also adds a build step to a stranger's first 30 minutes, which is the trade-off pillar 7 asks to be justified: the justification is that the alternative is no command at all. AC-5 measures the clean-clone path. |
| **Product-agnostic** | No SaaS product is referenced. |
| **Errors are explicit** | A build failure must stop the run rather than leave a stale artifact standing. Worth an assertion: a failed build does not leave a previous `dist/` in place that AC-5 would then happily execute. |
| **Vocabulary** | "flow", "gate", "adapter", "step", "harness" used per `docs/GLOSSARY.md`. The product is Quorum; the folder is `harness/`. AC-18 covers any new term. |

---

## Appendix A — measurement log

Everything asserted in §0, so a later reader can re-run rather than re-trust. Measured 2026-09-02 on
`main` at the tip recorded in this run's manifest.

| # | Measurement | Result |
| --- | --- | --- |
| 1 | `pnpm turbo run test --force` | 7 tasks, 0 cached, all green — shared 142, core 1,280 (+2 skipped), cli 94 |
| 2 | `node -e "import('@quorum/shared')"` | `ERR_MODULE_NOT_FOUND` on `src/constants.js` imported from `src/index.ts` |
| 3 | `node -e "import('@quorum/core')"` | `ERR_MODULE_NOT_FOUND` — `Cannot find package '@quorum/core'` |
| 4 | `ls packages/cli/bin/` | does not exist, while the manifest declares `./bin/quorum.js` |
| 5 | `wc -l packages/core/src/index.ts` | 1 line: `export const name = '@quorum/core';` |
| 6 | sixteen domain symbols, by `export (function\|const\|class)` | all sixteen present in `packages/core/src`, none re-exported from the barrel |
| 7 | TS enums / namespaces / decorators in `packages/*/src`, `apps/*/src` | 0 / 0 / 0; one parameter property, in `packages/cli/src/fail.test.ts:23` |
| 8 | `turbo.json` tasks and their `outputs` | `lint`, `typecheck`, `test`; `[]` on all three |
| 9 | `tsconfig.base.json` keys | `target`, `module`, `moduleResolution`, `strict`, `skipLibCheck` — no `paths`, no `outDir`, no `noEmit` |
| 10 | packages with `"private": true` | 7 of 7 |
| 11 | `.gitignore` / `eslint.config.js:19` / `git-identity.test.ts:90` | `dist/` already ignored in all three |
| 12 | `frame.source.test.ts` `GENERATED` | `['node_modules', '.turbo']`, `toStrictEqual`, one fixture per entry |
| 13 | `packages/shared/src/index.test.ts:68` | byte-pins `packages/core/src/index.ts` |
| 14 | `test-command.test.ts:506` `CI_JOBS` | register of 7 jobs, `toStrictEqual` |
| 15 | `docs/decisions/` | 77 entries; next number is **078** |
| 16 | `spike/bin/harness.js:321` | templates resolved as `path.join(here, '..', 'templates', 'harness')` |
| 17 | `packages/templates/src/index.ts` | one-line stub; shipped templates live at `spike/templates/harness` |
