# Q-0096 — The workspace emits JavaScript, and `quorum` is a runnable binary

*Merged requirement, run 1, **iteration 2**, 2026-09-02. Head of product. Ticket stage: `draft`.
Seventh child of Q-0010. Surfaces: `packages/cli`, `packages/core`, `packages/shared`, the workspace
build configuration, `docs/`.*

**Verdict: `needs-input`.** Same two reasons as iteration 1, neither of which any step on the chore
route can clear: four blocking architectural questions only the human may rule (§6), and a size
overrun now at **21 criteria against a ceiling of fifteen** (§4). The seam is unchanged and clean.

---

## 0. What this iteration measured, and what changed

### 0.0 It opened on an unchanged tree, and that is the first finding

Iteration 1 returned `needs-input` on four blockers. Before merging again, the tree was checked
rather than assumed:

| | |
| --- | --- |
| `docs/decisions/` | ends at **077**; no `078-*.md` |
| `backlog/Q-0096-…/ticket.md` | last written **2026-09-01 21:30** — the run started 23:34 |
| `git log -1` | `729dcb3 docs(plan): Q-0090 shipped…` — unchanged |
| gate ruling in the ticket body | **absent** |

So nothing this iteration could read had moved, and the four blockers are unruled. **A `retry` on an
unchanged tree cannot rule its own blocker** — Q-0090's own requirements run recorded exactly this
from the other side: its iteration 2 noted that it had opened on an unchanged tree, and it produced
a ready document only once the gate ruling had been written into the ticket body *first*. Recording
it here is the point: a second `needs-input` from an identical tree is the process working, not the
document failing.

**What this iteration therefore spent itself on was measurement**, and that is where its value is.
Iteration 1's R-7 said *"the emit collides with a guard nobody enumerated here; the search was
`grep`-based and is not a proof of exhaustiveness."* Three such guards were found before an
implementer ever saw the ticket, and one of them is load-bearing.

### 0.1 The factual spine, re-verified

Every finding of candidate-claude's §0.1 and §0.2 reproduces on `main` today and is not restated:
no `build` task, no `paths` in `tsconfig.base.json`, no `exports`/`main`/`types` on `@quorum/core`,
`@quorum/shared` exporting `./src/index.ts`, seven private packages, `"outputs": []` on all three
tasks, a `bin` naming a `packages/cli/bin/` that does not exist, the one-line barrel, the byte pin at
`packages/shared/src/index.test.ts:68`, and `frame.source.test.ts`'s two promises. Iteration 1's
§M-1 (DOMAIN is thirteen), §M-2 (`pack` succeeds on a private package) and §M-3 (the CLI has zero
runtime cross-package imports) also reproduce and are carried into the criteria below.

One correction to iteration 1's own Appendix A, and it is not cosmetic.

### M-5 — `@quorum/core` fails with a **missing entry point**, not a missing package

Candidate-claude measured `Cannot find package '@quorum/core'` and iteration 1 transcribed it.
That measurement was taken from the repository root, where no link exists. Measured from
`packages/cli`, which declares the dependency:

```
packages/cli/node_modules/@quorum/core -> ../../../core        (the symlink exists)

import('@quorum/core')   → ERR_MODULE_NOT_FOUND
  Cannot find package '…/packages/cli/node_modules/@quorum/core/index.js'
import('@quorum/shared') → ERR_MODULE_NOT_FOUND
  Cannot find module '…/packages/shared/src/constants.js' imported from …/src/index.ts
```

The package **is** installed and linked; Node falls through to the legacy `index.js` default and
finds nothing. So AC-1's fix is a manifest key and never a linking problem, and AC-1's test must run
from a package that declares the dependency or it measures the wrong failure. *A measurement copied
from a document is not a measurement* (Q-0058) — and neither is one taken from the wrong directory.

### M-6 — two hand-written task registers fail open the moment a `build` task exists *(decisive)*

`packages/core/src/test-discovery.test.ts:59`:

```ts
/** The three tasks the root `turbo.json` declares, and therefore the three every package owes. */
const TASKS = ['lint', 'typecheck', 'test'] as const;
```

used at `:214` under *"Q-0054 AC-7 — turbo run reaches every workspace package"*, whose own comment
reads *"A package with no `test` script is skipped by turbo in silence, which is AC-6's failure one
layer up… it is derived from the globs, so a package added later is covered without anyone
remembering."* And `packages/cli/src/package.test.ts:81` inlines the same array under *"declares the
three tasks turbo runs"*.

**Neither is derived from `turbo.json`.** The `PACKAGES` half of the first guard *is* derived from
`pnpm-workspace.yaml`, so a package added later is covered — but a **task** added later is not. Add
`build` to the root task list and both registers stay at three, both doc comments become false, and
turbo silently skips every package with no `build` script: verbatim the failure that describe block
exists to close, one register over. This is the `q0050.source.test.ts` fail-open shape Q-0051 found
(*"a seventh engine file goes unscanned while the suite reports green"*), and it is why AC-13 exists.

It also forces a real design answer rather than a preference: if `build` is a root task, does *every*
package owe one? `compiler`, `server`, `templates` and `apps/web` are stubs. AC-0(c) and AC-7 must
say whether `build` is declared at the root at all, or only in the package that emits.

### M-7 — `shared-resolution.test.ts` states this ticket's premise as its own authority

`packages/core/src/shared-resolution.test.ts` is Q-0041's AC-1 resolution proof. Its header:

> The workspace had no precedent for one package importing another: no package declared `exports`,
> **`turbo.json` has no `build` task and `tsconfig.base.json` emits nothing**, so `@quorum/shared`
> resolves from its TypeScript source.

This ticket falsifies the emphasised clause, and under Shape B the whole sentence. The test keeps
passing under Shape A while its stated reason is false — a comment naming an authority that has
stopped being true, which `engineering.md` treats as load-bearing. AC-14 corrects it rather than
leaving it to rot.

### M-8 — Shape E is refuted a second time, independently of configuration

Both the root and `packages/cli` manifests declare `engines.node: ">=22.13.0"`. Node's unflagged
type stripping landed in **22.18**. So the declared support floor already forbids a type-stripping
runtime, whatever the specifiers say. Two independent refutations, and the entry should record both
— a later reader who fixes the `./x.js`-to-`./x.ts` problem would otherwise think the door reopened.

### M-9 — smaller measured facts that shape criteria

- **`package.test.ts` carries a fourth expiring assertion** beyond the three iteration 1 named: its
  turbo guard asserts `expect(config).not.toContain('"outputs"')` for `packages/cli/turbo.json`, and
  its `OUTSIDE` audit register describes `packages/core/package.json` as *"AC-9, the three absent
  keys"* — a description that stops being true at AC-1. Both are named in AC-4 and AC-7.
- **No shim exists to test.** `pnpm install --frozen-lockfile` creates no `quorum` shim, because
  nothing depends on `@quorum/cli` so pnpm is never asked to resolve the target. AC-18 must name the
  mechanism it asserts.
- **`packages/*/turbo.json` exist** in `cli`, `core` and `shared` — iteration 1's Appendix A row 13
  is right; a shell glob failure in this iteration briefly suggested otherwise and was rechecked.
- **Root `turbo.json` already declares `dependsOn: ["^lint"]`, `["^typecheck"]`, `["^test"]`** and
  `globalDependencies: ["tsconfig.base.json", "eslint.config.js", "vitest.shared.js", ".nvmrc"]`.
  A `build` task joins an ordering convention that exists rather than inventing one.
- **`.gitignore:4`, `eslint.config.js:19` (`**/dist/**`) and `git-identity.test.ts`'s walk** all
  already exclude `dist`. Three of the four places that must know already do; `frame.source.test.ts`
  is the fourth and is the one that fails closed.
- **`docs/04-architecture.md:7`** says *"One command (`npx quorum`) starts a local daemon and opens
  the browser UI"* and `:49` says the server *"Serves the built `apps/web`"*. Both are the overclaim
  AC-21 corrects, and the second uses *built* while nothing builds.

### M-10 — the test counts are still carried, not re-derived

Candidate-claude's 142 shared / 1,280 core / 94 cli come from one forced run. They were not re-run
in iteration 1 and were not re-run here, deliberately: they are load-bearing for OQ-3 and they enter
a durable record at AC-0(b), which is where ground rule 5's method applies. **Re-derive them there.**

---

## 1. Problem

The `adopter` and the `maintainer` are promised a command called `quorum`. There is no such command
and no arrangement by which there could be one: this workspace has never emitted JavaScript,
`packages/cli` declares `"bin": { "quorum": "./bin/quorum.js" }` against a `packages/cli/bin/` that
does not exist, and `@quorum/core` — which holds every domain helper a command would call — declares
no `exports`, no `main` and no `types`, so it is unresolvable at typecheck and at runtime alike.

It works today because **Vitest transpiles**. Nothing else ever runs the code.
`packages/cli/src/package.test.ts` is the proof from both sides in one file: `import('@quorum/shared')`
resolves under Vitest, while the same import under plain `node` dies with `ERR_MODULE_NOT_FOUND` on
`./constants.js`, because type stripping does not map a `.js` specifier onto a `.ts` file.

Q-0090 delivered the CLI frame as importable modules and stopped there, correctly, after its
requirements run blocked on this twice. Q-0091 to Q-0094 build commands on that frame — **and cannot
compile them**, because the dependency they are told to use resolves to nothing (§6 OQ-2). Q-0095
runs the binary, and is M2's done-when. Every remaining path to M2 closing runs through this ticket.

Three architectural questions are open and none belongs to the CLI alone: how TypeScript becomes
executable JavaScript and for which packages; what a `build` task does to a workspace where all three
existing tasks declare `"outputs": []` and therefore replay a *verdict* where a build replays an
*artifact*; and what `npx quorum` may honestly claim when every package is `"private": true` and the
bare command resolves against the public registry.

---

## 2. User stories

**`adopter` (cold-clone).** *As a stranger who has cloned the repository and installed its
dependencies, I want `quorum help` to print the command list, so that my first act with this product
is not diagnosing why the binary the README names does not exist.* Today this fails with `command not
found`, or — once a shim exists over an unbuilt tree — with a Node syntax error inside a `.ts` file,
which reads as a broken product rather than an unbuilt one.

**`maintainer`.** *As the maintainer, I want the emitted artifact to be something no cached task can
serve stale, so that a green suite and a working binary cannot disagree.* Concrete rather than
theoretical: `integrate` reads only an exit code, worktrees share the main checkout's turbo cache
(Q-0065), and a build whose `outputs` are wrong replays a binary built from different source while
every gate reports green.

**`maintainer`, as Q-0091 to Q-0094's author.** *As the author of the four command children, I want
`import { Backlog, runFlow } from '@quorum/core'` to compile, so that I write a presentation layer
rather than rediscovering that the dependency I was told to use resolves to nothing.*

**`contributor`.** *As someone adding an adapter, I want `pnpm test` to keep meaning what it means
today, so that a build step does not put my test verdict behind an artifact I did not know existed.*

---

## 3. The shapes

AC-0's decision entry rules this. Set out with measured costs so the ruling is made against evidence.

**Shape A — `tsc` emit per package, suites kept on source.**
Emit `dist/` per consumable package; `exports` gains a conditional map so Node and a packed install
resolve `./dist/index.js` while the workspace suites keep resolving `./src/index.ts`. `build` depends
on `^build`; `test` and `typecheck` gain **no** `^build` edge.
*Cost:* zero new dependencies — `tsc` is already the typecheck gate. The divergence is real and is
R-1: the suite proves source, the binary ships emit, and nothing closes the gap until Q-0095.
**Recommended**, on the dependency count and on §M-3 — the only shape correct both before and after
Q-0091 without being re-made.

**Shape B — `tsc` emit per package, `exports` moved wholesale to `dist/`.**
Candidate-codex's implied preference. *Cost, measured:* `test` and `typecheck` must gain a `^build`
edge, because 55 files in `core` import `@quorum/shared` by package name. Every test in the
workspace moves behind a build artifact, so the stale-artifact class reaches every verdict — the
outcome the ticket body itself names as worse than a stale green tick. `harness.yaml`'s
`commands.test` and the git-identity sweep both grow a build phase.

**Shape C — `tsc` emit of `packages/cli` alone.**
Works **today**, by §M-3: the frame's only cross-package import is erased at emit. Zero new
dependencies, one package, no change to `core` or `shared`. *Refuted as a strategy and kept as
evidence:* it stops working at Q-0091's first value import, and a shape that expires at the next
sibling forces the ruling to be re-made by a step that does not own it. Its existence is why OQ-1
must be ruled against the post-Q-0091 workspace.

**Shape D — bundle the CLI, inlining `core` and `shared`.**
Candidate-claude's recommendation. *Refuted by §M-3:* there is nothing to inline, so the one new
dependency (`esbuild`) is unjustified today. It becomes live again once a command child lands a value
import, and the entry should say so rather than close the door.

**Shape E — Node type stripping, no build.** *Refuted twice, independently.* (1) Stripping resolves
`@quorum/shared`, strips `index.ts` and dies on `./constants.js`; closing that means rewriting every
relative specifier to `./x.ts` with `allowImportingTsExtensions` and `rewriteRelativeImportExtensions`,
a mass edit colliding with four source-scanning guards. (2) §M-8: `engines.node` is `>=22.13.0` in
both manifests and unflagged stripping landed in 22.18, so the declared floor forbids it whatever the
specifiers say. Recorded because no *source* construct forbids it — zero enums, namespaces or
decorators in production source — so a later reader needs both refutations, not one.

---

## 4. Size, and the seam

Merged honestly this is **21 criteria plus a gate obligation**, one more than iteration 1 because
§M-6 earned AC-13. Candidate-claude has eighteen, candidate-codex twenty-four; neither is padded, and
the overlap is smaller than the counts suggest because codex owns four replay criteria claude has no
analogue for. Twenty-one is past the ceiling in the expensive way: three of the four review loops
this project has run over a twenty-criterion ticket reached their exhaustion gate.

**The seam falls on two dependency edges that already exist.**

### A. Q-0096a — `@quorum/core` resolves and exports its public API *(AC-1 to AC-6, 6 criteria)*

**Runs first, immediately after the gate ruling.** It needs the emit *decision* as an input and the
emit *artifact* not at all: under Shape A its `exports` names `./src/index.ts` for the development
condition, the shape `@quorum/shared` already proves here.

**This is where the development plan is wrong, and it is the most consequential structural finding
of this run.** `docs/06-development-plan.md` says Q-0096 *"may run in parallel with Q-0091 to
Q-0094"* and Q-0090's entry says those four *"do not need this either"*. Measured, they need this
half and cannot start without it. Splitting it out unblocks four sibling tickets after **6**
criteria instead of 21.

### B. Q-0096b — the workspace emits JavaScript *(AC-7 to AC-14, 8 criteria)*

The build task, its outputs, codex's replay honesty, and the guards the artifact disturbs — now
three guards rather than one. Its precondition is AC-0, written by hand at the gate.

### C. Q-0096c — `quorum` is a runnable binary, and what `npx quorum` may claim *(AC-15 to AC-21, 7 criteria)*

The `bin` target, the shebang, the exit-code table across a process boundary, the two honest
installation paths, and the documentation that separates three claims. **Q-0095 needs C's binary half
and not its packed half**, which is why the packaging work sits off M2's critical path.

**Order: A → B → C → Q-0095.** A and B may run concurrently once the entry is written; C needs B.
**Q-0039 becomes a blocker the moment two run concurrently** — two runs on one ticket share a
worktree and compute the same run id, and there is no lock of any kind in either tree.

---

## 5. Acceptance criteria

Numbered continuously, grouped by the ticket that should own them. Each names its surface. *Test:*
sketches are the implementer's starting point, not a frozen contract — where one is wrong, an erratum
corrects it **during** the loop, as soon as the contradiction is provable (*"An erratum is the last
repair, not the first"*, 2026-08-30).

### AC-0 — the decision entry exists before any code changes *(gate obligation, not an implement criterion)*

`docs/decisions/078-<slug>.md` opens `# <Title> — <YYYY-MM-DD>`, carries **Decision**,
**Alternatives considered** and **Why**, and gains its line at the bottom of `docs/DECISIONS.md`. It
rules seven things and no fewer:

- **(a)** the emit strategy, **ruled against the workspace as it will stand after Q-0091 to Q-0094
  land value imports** (§M-3), naming the refuted shapes from §3 — including that Shape E is refuted
  **twice**, by specifiers and by the declared `engines.node` floor (§M-8);
- **(b)** whether the workspace suites resolve source or emitted output, and the consequence for the
  shared, core and cli suite counts — **re-derived, not transcribed** (§M-10);
- **(c)** what `outputs` a `build` task declares and why that set is exactly the artifact, **and
  whether `build` is a root task at all** — because if it is, `test-discovery.test.ts`'s *"the three
  every package owes"* becomes *"the four"*, over four packages that are stubs (§M-6);
- **(d)** what `npx quorum` may claim before Q-0029;
- **(e)** where the artifact sits and what `files` must carry — `spike/bin/harness.js:321` resolves
  shipped templates as `path.join(here, '..', 'templates', 'harness')`, **relative to the binary's own
  file**, so the artifact's location is load-bearing for Q-0093's `init` (§6 OQ-4);
- **(f)** the registered divergence that the suites prove source while the binary ships emit, if (b)
  selects that split;
- **(g)** the registered limit that the packed-tarball fixture proves the trivial case while
  `packages/cli` has no runtime cross-package import, and acquires its real subject at Q-0091.

It names *"The test command defeats its own cache"* (2026-08-27) and *"A cache hit names what the
task reads, not what its package contains"* (2026-08-28) by title and date, never by number.
*Test:* `packages/shared/src/docs.test.ts` already fails if the index and the folder disagree and if
the index's dates go backwards. See §7 GO-1 — **written by hand at the requirements gate, before any
chore run is launched.**

---

### A. `@quorum/core` resolves and exports its public API

**AC-1 — `@quorum/core` resolves, at runtime and at typecheck — `packages/core`.**
The manifest gains the entry-point keys the ruling selects. No runtime export points at a `.ts`
implementation file if AC-0(b) forbids one; under Shape A the development condition may.
*Test:* `await expect(import('@quorum/core')).resolves.toBeDefined()` **from a package that declares
the dependency** — per §M-5, the current failure is a missing entry point inside a symlink that
already exists, and a test run from the repository root measures a missing link instead. A test
cannot assert a compile success, so assert the **cause** — the manifest keys — as `package.test.ts`
already does in the opposite direction. Additionally import from a Node process outside the source
directories, without a repository-relative path and without a Vitest alias, so the claim is about
package metadata rather than about the bundler.

**AC-2 — the barrel exports the public API, so the trap closes rather than moves — `packages/core`.**
`packages/core/src/index.ts` is one line today (`export const name = '@quorum/core';`), so an
`exports` key alone makes the package resolve to an object with one useless string in it — the trap
relocated, and Q-0090's expiring assertion going red for a package that still delivers nothing. The
surface is **sixteen symbols: the thirteen in `frame.source.test.ts:150`'s `DOMAIN` register plus
`FlowError` (`lint/lint.ts`), `GateUnansweredError` (`engine/types.ts`) and `IntegrationError`
(`fanout/fanout.ts`)**. Per §M-1 those are **two** sources and the criterion names both — `DOMAIN` is
thirteen and has never been sixteen.
*Test:* import the barrel and assert each symbol is defined, from a list **derived** from the
`DOMAIN` register plus a separately declared, commented error-class list — never hand-typed a second
time, which is the register-versus-transcription distinction this repository keeps paying for.
Assert `index.ts` is no longer the one-line stub.

**AC-3 — the byte pin in `packages/shared` is retired with its reason recorded — `packages/shared`.**
`packages/shared/src/index.test.ts:68` pins `packages/core/src/index.ts` byte for byte under the test
name *"core declares the dependency, and nothing else in core changed"*. Its subject — that Q-0041
had not touched `core` — expired when the port closed on 2026-08-31. It is also a **declared input**
of `@quorum/shared#test`, so the hash moves and the failure is not cached away.
*Test:* the assertion is replaced by one that still says something true — that `core` declares
`@quorum/shared` as a workspace dependency, the half with a live subject — with a comment naming
Q-0096 as the authority. **Deleting it silently is refused**: a landed pin's removal is a visible act.

**AC-4 — Q-0090's expiring assertions are replaced by their successors — `packages/cli`.**
In `packages/cli/src/package.test.ts`: the `import('@quorum/core')` rejection, the three-absent-keys
assertion (`core.exports`/`main`/`types` are `undefined`), and the `tsconfig.base.json` no-`paths`
assertion. The `@ts-expect-error` directive above the import must be **removed**, not left — an
unused directive is itself a `tsc` error, which is the mechanism Q-0090 chose so the change could
not be made quietly. Per §M-9 the `OUTSIDE` audit row describing `packages/core/package.json` as
*"AC-9, the three absent keys"* stops being true in the same edit and is corrected with them. The
*"and says nothing about what that key points at"* test stays until AC-15.
*Test:* the successors assert the positive facts, and `pnpm turbo run typecheck --force` is green,
which it cannot be if the directive survives.

**AC-5 — the public surface is explicit, not a wildcard — `packages/core`.**
No `./*` subpath publishing every internal module. Codex AC-6's discipline, adopted: what Q-0091 to
Q-0094 may import is a decision, and a wildcard defers it to whoever types an import first.
*Test:* assert the `exports` map has no wildcard key; assert a deep import of an internal module
(`@quorum/core/engine/engine.js`) does **not** resolve.

**AC-6 — every register this change touches is updated or demonstrated not to need updating — `packages/core`, `packages/shared`.**
Named individually so none is closed by silence: `turbo-inputs.test.ts`'s `SUITES`, `MANIFEST`,
`NOT_READ` and `READ_BASES` — noting that `@quorum/cli` is deliberately **not** an audited suite
there, its floors *"calibrated for these two"* with widening routed by name to Q-0091 — and
`spike-parity.test.ts` per ground rule 5.
*Test:* for each, the updated register with its assertion shown red beforehand, **or** a stated,
checked demonstration that it is untouched. `spike-parity.test.ts` is expected to be a no-op, since
no file under `spike/test/` changes; ground rule 5 says re-derived rather than adjusted, so the
totals are re-run and the no-op is **reported as a measurement**, not assumed.

---

### B. The workspace emits JavaScript

**AC-7 — a `build` task exists, declares real `outputs`, and orders itself by dependency — workspace.**
Declared where the ruling puts it, with `dependsOn: ["^build"]` so one root invocation from a clean
checkout produces prerequisites before consumers, with no manual command and no prior typecheck or
test. Its `outputs` are non-empty, which is the property distinguishing it from all three existing
tasks — `lint`, `typecheck` and `test` still declare `[]`. Root `turbo.json` already declares
`^lint`/`^typecheck`/`^test`, so this joins an ordering convention rather than inventing one.
*Test:* read `turbo.json` and every package-level `turbo.json` (`cli`, `core`, `shared` today);
assert the build task's `outputs` is a non-empty array and the other three are empty. Assert a
package configuration declares `inputs` and nothing else, so root `turbo.json` stays the one place
`env` is decided and the merge keeps `QUORUM_REAL_CLI` (Q-0065). `packages/cli/src/package.test.ts`
already asserts `not.toContain('"outputs"')` for that file — if the build task lands there, that
assertion is **reconciled deliberately and its comment corrected**, never deleted, and the reconciled
form is shown failing against a config that also declares `env`.

**AC-8 — the declared outputs cover exactly what the build writes — workspace.**
Verified by building into a clean tree and comparing emitted paths against the declaration, not by
reading the declaration — *"A check is not established by reading it"* (2026-08-29). Under-declaring
is the stale-artifact hazard in its exact form; over-declaring a whole package directory is codex
AC-8's other half and is equally refused.
*Test:* build into a tree with the generated directories removed; enumerate what was written; assert
set equality with the declaration, in both directions.

**AC-9 — a replayed build is executable — workspace.** *(codex AC-9; claude has no analogue)*
Clean build, cache preserved, **declared artifacts deleted**, the same build re-run to obtain a cache
hit, and the restored artifact then executed or imported successfully. This establishes that a hit
restores a **usable artifact** rather than reporting a prior verdict — the property no existing task
in this workspace has ever needed, since all three declare `"outputs": []`.
*Test:* assert the cache hit occurred (turbo's own summary), assert the artifact is on disk again,
and execute it.

**AC-10 — a changed input cannot execute a stale artifact — workspace.** *(codex AC-10)*
Build, change a tracked source or build-configuration input that affects emitted output, rebuild
through turbo, and prove the **executed** artifact reflects the change.
*Test:* the verdict depends only on tracked files, lockfile-installed dependencies and files the test
creates — never on a pre-existing ignored `dist/`, on user-level configuration or on account identity
(*"A test's verdict is a property of the commit, not of the checkout or the account"*, 2026-08-30).

**AC-11 — repeated builds do not depend on leftovers — workspace.** *(codex AC-11)*
The build succeeds with generated directories absent and with output from an earlier build present,
and produces the same declared artifacts for the same tracked inputs. A removed or renamed source
entry point does not remain executable because an old emitted file survived.
*Test:* build, rename an entry point, rebuild, assert the old emitted path is gone.

**AC-12 — the artifact is invisible to every source scan, and `frame.source.test.ts` regains its two promises — `packages/cli`.**
That file's `GENERATED` register is `['node_modules', '.turbo']` at `:73`, pinned by identity with
`toStrictEqual` at `:298`, and its header makes two promises that break the moment a build writes
under `packages/cli`: that *"emitted output is deliberately not among them"* because the layout is
Q-0096's to choose, and that **"no verdict below depends on whether this checkout has run a build"**.
`packageFiles()` walks the package in any extension with only those two names pruned, so an emitted
copy of `frame.source.test.js` — which quotes every credential pattern — lands in the scan and the
credential assertion goes red.
*Test:* the register gains the emit directory as an **identity, not a count** (Q-0073), with a
fixture demonstrating the new entry excuses a real file, derived from the list as the existing loop
is, so a fourth entry arrives with a subject or fails. Show the credential scan **red** against a
tree carrying an emitted copy of a test file *before* the exclusion lands — which is what proves the
exclusion has a subject rather than being a precaution. Assert the credential scan and the
signal-handler scan return identical verdicts with the artifact present and absent. Assert
`git check-ignore -v` resolves the emitted path to a rule in `.gitignore` (`dist/` at line 4 already
matches, if `dist/` is chosen), that `eslint.config.js:19`'s `**/dist/**` covers it, and that
`packages/core/src/git-identity.test.ts`'s `walk` skips it — three of the four places that must know
already do, and the fourth is the one that fails closed.

**AC-13 — the task registers are derived, or their claims are corrected — `packages/core`, `packages/cli`.** *(new this iteration; §M-6)*
`test-discovery.test.ts:59` declares `TASKS = ['lint','typecheck','test']` under the doc comment
*"The three tasks the root `turbo.json` declares, and therefore the three every package owes"*, and
`package.test.ts:81` inlines the same array under *"declares the three tasks turbo runs"*. **Neither
is derived.** Adding a `build` task leaves both at three, both comments false, and turbo silently
skipping every package with no `build` script — verbatim the failure the first guard's own describe
block exists to close, and the `q0050.source.test.ts` fail-open shape Q-0051 found. The first guard's
`PACKAGES` half *is* derived from `pnpm-workspace.yaml`; the asymmetry is that a package added later
is covered and a task added later is not.
*Test:* derive the task list from root `turbo.json` so the register cannot narrow in silence, **or**
— if AC-0(c) rules that `build` is not a root task, or not owed by every package — correct both doc
comments to state what is actually asserted and why the set is three rather than four. Either way,
demonstrate the register red first: with the old hand-written array and a `build` task present, show
that a package lacking a `build` script passes unnoticed.

**AC-14 — the harness commands, CI, the sweep and `shared-resolution.test.ts`'s stated reason are changed or demonstrated unchanged — repository.**
`harness.yaml`'s `commands.install` and `commands.test`, `.github/workflows/ci.yml`'s `workspace`
job, and `.github/scripts/git-identity-sweep.sh`, whose phases are `isolation`, `probe`, `install`,
`spike suite`, `workspace suite`. Under Shape A none needs to change, because `test` gains no
`^build` edge; under Shape B all three do. **And `packages/core/src/shared-resolution.test.ts`'s
header** states as its reason that *"`turbo.json` has no `build` task and `tsconfig.base.json` emits
nothing"* (§M-7) — Q-0041's AC-1 resolution proof, whose stated authority this ticket falsifies while
the test keeps passing.
*Test:* if a file is unchanged, **assert it with the reasoning**, so a later reader knows the
question was asked rather than missed. If changed, the `--force` guard in `project.test.ts` and the
executes-not-replays guard in `test-command.test.ts` must both still hold, and
`test-command.test.ts`'s `CI_JOBS` register of seven jobs — pinned by `toStrictEqual` — is updated: a
build **step** inside the existing `workspace` job leaves it alone, a new **job** does not. The
`shared-resolution.test.ts` header is corrected in the same change, since a comment naming an
authority that has stopped being true is what `engineering.md` forbids.

---

### C. `quorum` is a runnable binary, and what `npx quorum` may claim

**AC-15 — `quorum help` runs under plain `node`, from a clean clone, and exits 0 — `packages/cli`.**
The full chain: install → build → execute the file `bin.quorum` names → the frame's `HELP` on stdout
→ exit 0. No Vitest anywhere in that chain. The target `./bin/quorum.js` is provisional and may move;
`package.test.ts` deliberately asserts only that the key carries a non-empty string, its comment
naming *"an extensionless launcher, a `dist/` layout"* as legitimate Q-0096 choices.
*Test:* resolve `bin.quorum` from the manifest, spawn it with `process.execPath`, assert stdout
carries the command list and `status === 0`. **Demonstrated red before green** — against `main` the
target does not exist and the spawn fails `ENOENT`, and that red must be *shown*, because a test
passing for want of a subject is this repository's most-recorded defect (*"a check that skips its
subject must not report success"*, 2026-08-25).

**AC-16 — the artifact carries a shebang and is executable — `packages/cli`.**
`#!/usr/bin/env node` as the **first** bytes, matching `spike/bin/harness.js:1`, with the mode bit
set. A banner emitted after any other byte does not work.
*Test:* read the first line; `fs.statSync(...).mode & 0o111` is non-zero. On a platform without POSIX
modes the mode assertion is skipped **and says so** rather than passing silently.

**AC-17 — the exit-code table survives the process boundary — `packages/cli`.**
Q-0090 owns 0, 1, 2, 130 on signal, and **3 for `undecided`** (Q-0040), proven in process today.
This proves at least one non-zero code reaches a shell through the built artifact, so the emit is
known not to swallow `process.exitCode`.
*Test:* spawn the binary in a way that yields a known non-zero status; assert the observed code. The
preserved defect this must **not** silently fix: an unknown command prints help and exits **0**
(`main.ts`, *"Why: preserved, see Q-0090 AC-6"*), successor Q-0090 GA-4.

**AC-18 — the workspace path works, and resolves locally — `packages/cli`.**
*Test:* assert the executed path lies inside the workspace package under test. **The criterion must
name the mechanism it asserts**, because per §M-9 there is no shim to test today: `pnpm install
--frozen-lockfile` creates none, since nothing depends on `@quorum/cli` and pnpm is never asked to
resolve the target. Either something is made to depend on it, or the assertion is over
`pnpm --filter @quorum/cli exec quorum`. Choosing by accident is what is refused.

**AC-19 — a locally packed tarball is runnable, and its contents are a declared contract — `packages/cli`.**
`pnpm pack`, installed into a newly created temporary project outside the repository with no
workspace symlinks and no access to repository `node_modules`, and `quorum help` invoked from it.
The `files` field is declared: per §M-2, re-measured this iteration, `npm pack --dry-run` on this
private package **exits 0** and ships **22 files, 90.6 kB** — three `.turbo/turbo-*.log` build logs,
nine test files including `frame.source.test.ts` at 17.9 kB, and no `bin` target. Repository-only
material in exactly the class this criterion rejects, with no `files` field to stop it.
*Test:* inspect the pack manifest; assert it carries the declared entry point and every file the
distribution contract requires, and rejects tests, run artifacts, worktrees and build logs. The
fixture builds its sandbox under `os.tmpdir()` and removes it. `pnpm pack` is confirmed rather than
assumed to honour `files` identically, and a divergence from `npm pack` is reported.
**A registered limit, stated rather than discovered (§M-3):** while `packages/cli`'s only
cross-package import is type-only, this fixture proves the easy case — a CLI with no workspace
runtime dependencies. It acquires its real subject at Q-0091's first value import. Either sequence
this after Q-0091, or record the limit in AC-0(g) and in the implement report. Silence is refused.

**AC-20 — registry resolution cannot satisfy or alter either verdict — `packages/cli`.**
Both paths configure execution so a missing local `quorum` **fails** rather than falling back, and
the packed test additionally points registry access at a test-controlled failing endpoint or gives an
equally explicit offline guarantee. A public package named `quorum` can neither satisfy nor change
the result.
*Test:* assert positively that the executed binary's resolved path is inside the workspace package or
the temporary installation. A network-dependent assertion is refused: it would make the verdict a
property of the machine.

**AC-21 — the documentation separates three claims, and the status line moves — `docs/`.**
`docs/04-architecture.md:7` says *"One command (`npx quorum`) starts a local daemon and opens the
browser UI"* and `:49` says the server *"Serves the built `apps/web`"* — the word *built* already
appears while nothing builds anything. Repository documentation distinguishes the supported
workspace-local path, the supported locally-packed path, and registry-backed `npx quorum`, **which
remains Q-0029's in M6**. No README, architecture document, development-plan bullet, test name or
success message claims a cold machine can obtain Quorum from the public registry.
*Test:* `docs.test.ts` reads this file already; assert the status line carries the landing date and
this ticket. Scan the changed documentation and the new entry for a sentence asserting
registry-resolved `npx quorum`; assert the entry names which two paths are claimed and which is
deferred. If the ruling introduces vocabulary (*build task*, *emitted artifact*), it is defined in
`docs/GLOSSARY.md` before its second use; if it introduces none, that is stated.

---

## 6. Open questions

**OQ-1 — which emit strategy, ruled against which workspace? (BLOCKER; owner: human, at the gate)**
§3 recommends Shape A. The question is not merely *which shape* but **against which tree**: §M-3
measures that `packages/cli` has no runtime cross-package import today, so Shape C passes every
criterion above and expires at Q-0091. A ruling made against today's frame will be re-made inside a
command child by a step that does not own it. This is AC-0's subject and no implement step can settle
it — `developer-generalist` is forbidden to write a decision entry
(`harness/roles/developer-generalist.md:23`). **Unchanged since iteration 1, on an unchanged tree
(§0.0).**

**OQ-2 — does the export surface belong to this ticket, and is the plan's sequencing wrong? (BLOCKER; owner: human)**
`docs/06-development-plan.md` states Q-0096 *"may run in parallel with Q-0091 to Q-0094"* and that
those four *"do not need this"*. Measured, they need the export surface and cannot start without it.
**Recommended resolution:** the surface is Q-0096a's, runs first, and the plan's sequencing sentence
is corrected in the same edit — a plan bullet wrong about a dependency edge is the Q-0074 drift
class, and this repository now has a test for it. Export the sixteen symbols of AC-2 and let a later
child add a seventeenth, which is an ordinary edit rather than a trap.

**OQ-3 — do the workspace suites resolve source or emitted output? (BLOCKER; owner: human, with AC-0(b))**
The highest blast radius of any question here. Under Shape A they keep resolving source and no
existing verdict moves behind an artifact; under Shape B all of them move. Candidate-claude's counts
(142 shared, 1,280 core, 94 cli) are one forced run's and are **re-derived rather than transcribed**
before they enter the entry (§M-10) — they were carried through both iterations of this document and
are still carried.

**OQ-4 — where must the artifact sit for `init` to find the shipped templates? (owner: this ticket, as a stated constraint)**
`spike/bin/harness.js:321` resolves templates as `path.join(here, '..', 'templates', 'harness')` —
**relative to the binary's own file** — so the artifact's location is load-bearing for Q-0093, and a
bundle cannot inline a directory of files. Answered as a constraint in AC-0(e), so Q-0093 inherits a
ruling rather than a surprise. **Do not build `init`.**

**OQ-5 — does `@quorum/cli#test` gain `dependsOn: ["build"]` now or at Q-0095? (owner: implementer, reported)**
Nothing in ticket A or B needs the artifact; AC-15 to AC-20 need it very much. Declaring it now is
honest and makes every CLI test run trigger a build. Either is defensible; the requirement is that
the choice is **stated rather than defaulted**.

**OQ-6 — are source maps part of the artifact contract? (owner: maintainer; non-blocking)**
If included, their paths and `outputs` coverage are defined and tested; if omitted, this ticket makes
no claim about emitted stack traces. *(Codex OQ-5, adopted unchanged.)*

**Closed by measurement, recorded so nobody re-asks.** Claude's OQ-6 (`pack` on a private package):
**yes**, exit 0, 22 files — §M-2, re-measured this iteration. Codex's OQ-3 (delivering `core` and
`shared` to the packed consumer): **no subject yet** — §M-3 — and it returns at Q-0091. Whether
`@quorum/core`'s failure is a missing link: **no**, the link exists and the entry point does not —
§M-5, which corrects iteration 1's own Appendix A.

---

## 7. Gate obligations

**GO-1 — AC-0's entry is written by hand at the requirements gate, before any chore run is launched.**

Stated prominently because this is the **tenth** appearance in this repository of a loop handed work
no step in it can perform, and the ninth was Q-0062 — whose requirement *named the hazard by name*
and whose run was launched without the entry anyway, spending three implement rounds and reaching an
exhaustion gate before round 3 refused correctly and supplied a draft. Round 2 of that run is the
sharpest illustration available: handed a blocker it could not clear, with only prose as a channel,
it answered by adding a **sixth** citation of the absent entry, making the finding larger.

The precedents are Q-0058's GO-1 and Q-0069's: rule OQ-1, OQ-2 and OQ-3, write the entry, *then*
launch. **§0.0 is this document's own evidence for the rule**: iteration 2 opened on a tree where
nothing had been ruled and could do nothing about it, which is Q-0090's *"a `retry` on an unchanged
tree cannot rule its own blocker"* observed a second time, on a second ticket, in the same week.

**GO-2 — Q-0083 does not exist yet.** An implement step that finds a finding it may not act on still
has no `blocked` verdict (*"A refused finding is a gate, not another round"*, 2026-08-31). If the
review loop produces a finding contradicting a ground rule or AC-0's ruling, the remedy is an erratum
written **during** the loop as soon as the contradiction is provable, not at the exhaustion gate.

**GO-3 — the split of §4 is ruled at this gate**, and the two successor bodies are written out in
full before either runs. A deferred obligation recorded only in a closed ticket's entry is one that
quietly expires.

---

## 8. Risks

**R-1 — the emit and the source diverge, and nothing notices until Q-0095.** Under Shape A the suite
proves TypeScript source while the binary ships emitted output; AC-15 spawns exactly one command.
*Mitigation:* state the gap in the entry as a registered, accepted limit — the distinction Q-0072's
E-1 draws, where a stated gap is acceptable and the same gap unmentioned is the defect.

**R-2 — the artifact-replay hazard arrives with the fix.** A build whose `outputs` under-declare what
it writes produces a hit that replays an incomplete artifact, and `integrate` reads only an exit
code. AC-8 to AC-11 exist for this, and AC-8 is verified by building rather than by reading.

**R-3 — the merge is red in an existing checkout until `pnpm install` runs.** Q-0090 measured this
exactly: `--frozen-lockfile` reports *"Already up to date"* in 180 ms and the suite flips green; CI
does a fresh install and never sees it; a developer pulling the merge does, and it looks like a code
defect. A new dependency makes it **worse**, not the same. Say so in the implement report.

**R-4 — the two suites are verified in one environment row only.** Per Q-0072's closing finding: the
integration worktree has neither `.harness/worktrees` nor `.quorum/runs`, and a build adds a **third**
gitignored directory a working checkout has and a fresh clone does not — the exact shape of Q-0072's
instance, where a merged, reviewed, integrate-green change failed on `main`. Verify forced in both
rows and treat the emit directory as a fourth cell rather than assuming AC-12 covers it.

**R-5 — a new dependency in a repository that has added almost none.** `harness/rules.md` wants
small, boring, proven, with a one-line justification. §M-3 removes the justification for a bundler
*today*; Shape A needs none at all.

**R-6 — Q-0039 becomes a blocker if two children run concurrently**, which §4's order permits by
design. Two runs on one ticket share a worktree and compute the same run id.

**R-7 — the emit collides with a guard nobody enumerated.** *Partly realised already, which is why it
is kept and sharpened.* Iteration 1 named four registers found by `grep`; this iteration found
**three more by reading** — the two hand-written `TASKS` arrays (§M-6) and `shared-resolution.test.ts`'s
header (§M-7). The search is still not a proof of exhaustiveness. An implement step that trips an
eighth **reports it** rather than editing it in passing, and the pattern to look for is now known:
a register that claims in a comment to be derived and is not.

---

## 9. Non-goals

1. **Publishing.** No `npm publish`, no version policy, no scope decision, no removal of
   `"private": true`. Q-0029, M6.
2. **Registry `npx quorum`.** Not claimed, not tested, not documented as working (AC-21).
3. **Any command.** `board`, `lint`, `validate`, `adapters`, `runs`, `init`, `ticket`, `run` are
   Q-0091 to Q-0094. This makes `quorum help` run and nothing more.
4. **Translating the mock end-to-end suite.** Q-0095. AC-15 is a smoke check on one command and is
   explicitly not offered as coverage for the binary's behaviour.
5. **Building `apps/web` or `packages/server`.** M3. If the shape generalises, that is a property to
   note, not scope to take.
6. **Fixing the unknown-command exit 0.** Preserved per ground rule 3 and Q-0090 AC-6.
7. **Populating `packages/templates`.** Q-0093 needs the shipped templates; this ticket owes only the
   packaging *constraint* (OQ-4).
8. **Any change under `spike/src`.** Ground rule 1 — if one is genuinely required, the run **stops
   and says so**.
9. **Editing the spike's own tests.** Ground rule 2.
10. **Reimplementing a domain helper in `packages/cli`.** Ground rule 4 and the `DOMAIN` scan. A
    helper apparently missing from `core` is reported.
11. **Publishing every internal source file as a public subpath** (AC-5).
12. **Migrating relative specifiers to `.ts`.** Shape E's cost, refuted twice in §3.
13. **A runtime TypeScript loader for tests**, unless AC-0 selects it as the product runtime strategy.
14. **Requiring a global install, launching the daemon, or opening a browser.**
15. **Auditing every hand-written register in the workspace for the §M-6 defect.** AC-13 fixes the two
    a `build` task falsifies. A general sweep is a different ticket and is not opened here.

---

## 10. Cross-cutting checklist

| | |
| --- | --- |
| **BYOS** | No API-key path is added, in code, fixture, test name or documentation. `frame.source.test.ts`'s credential scan covers `packages/cli/**` in every extension and must keep passing — **AC-12 is precisely the criterion that stops the emit from breaking it**, since a compiled copy of that guard carries all nine patterns. Q-0090's erratum E-1 governs the inventory: membership here is a filesystem question, not a git one, so a gitignored emit directory is still scanned unless it is a named exclusion. |
| **Worktree safety** | The deliverable writes no flow and no run. The chore run writes only inside `.harness/worktrees/`; the build writes into the worktree, which is correct and is why AC-12 matters. |
| **Gate behaviour** | Unchanged. No flow file is edited. GO-1 is a sequencing obligation on the human. |
| **File format and schema** | No ticket, flow, role or step-output schema changes. `package.json` and `turbo.json` are configuration; `projectConfigSchema` is untouched. |
| **Lint rules** | ESLint covers `packages/**/*.ts` and `apps/**/*.ts` with `**/dist/**` already ignored (`eslint.config.js:19`), so emitted output is outside it by construction. `@typescript-eslint/no-deprecated` stays the only type-aware rule; a build tool's API is checked against its own typings, since nothing detects a deprecated call outside `packages/**`. |
| **Cold-clone impact** | **Positive and the point of the ticket** — the first change that makes the command the README will name exist. It also adds a build step to a stranger's first 30 minutes, which pillar 7 asks to be justified: the justification is that the alternative is no command at all. AC-15 measures the clean-clone path. |
| **Product-agnostic** | No SaaS product referenced. |
| **Errors are explicit** | A failed build stops rather than leaving a stale artifact standing that AC-15 would happily execute. Worth an assertion. |
| **Vocabulary** | "flow", "gate", "adapter", "step", "harness" per `docs/GLOSSARY.md`. The product is Quorum; the folder is `harness/`. AC-21 covers any new term. |

---

## 11. Provenance

**Candidate-claude** contributed the measured spine and much of the merged text: the dangling `bin`,
the two distinct type-stripping failures, the one-line barrel, the byte pin, and the
`frame.source.test.ts` collision — that last being the single best finding in either document, since
it catches the emit breaking a guard's own written promise that no verdict depends on whether a build
has run. Also the erasability measurement that keeps Shape E honestly refuted rather than dismissed,
the shape analysis, GO-1's framing with the Q-0062 precedent, AC-12's "show the scan red first",
AC-15's "demonstrated red before green", the register enumeration and the risk list.

**Candidate-codex** contributed the replay rigour claude has no analogue for, and it is the half that
protects the ticket's stated central fear: AC-9 (a hit restores a usable artifact, not a verdict),
AC-10 (a changed input cannot execute stale output), AC-11 (no dependence on leftovers), AC-8's
two-sided output-boundary check, AC-5's wildcard prohibition, AC-19's packed-contents inspection,
AC-20's failing-endpoint guarantee, AC-21's three-way claim separation, and OQ-6 on source maps. Its
"one documented build command from a clean checkout, no manual copy" is folded into AC-7.

**Where they disagreed, this document picks rather than averages.** Claude's Shape 2 (bundle,
inlining `core` and `shared`) is **refused** on §M-3: the frame has no runtime cross-package import,
so there is nothing to inline and the new dependency is unjustified. Codex's Shape-B implication
(`exports` moves wholesale to `dist/`) is **refused** as the default on claude's measured cost — it
puts every test behind a build artifact, the outcome the ticket body names as worse than a stale
green tick. Shape A takes codex's emit and claude's suites-stay-on-source, and neither candidate
proposed it. Codex's blocking OQ-3 is **closed as having no subject yet** and re-registered as
AC-19's stated limit. Claude's sixteen-symbol `DOMAIN` attribution is **corrected** to thirteen plus
three, and its unmeasured OQ-6 is **settled**.

**Head of product, iteration 1** contributed §M-1 to §M-4, Shape A and Shape C, the §4 seam and its
three tickets, OQ-2's finding that the development plan's sequencing sentence is measurably wrong,
AC-0's clauses (e) and (f), AC-19's registered limit, and GO-3.

**Head of product, iteration 2** contributed §0.0 (the unchanged-tree record, which is what makes a
second `needs-input` a measurement rather than a repetition), **§M-6 and AC-13** — the two
hand-written task registers that fail open the moment a `build` task exists, the largest new finding
in this run — **§M-7 and AC-14's fourth clause** (`shared-resolution.test.ts` stating this ticket's
premise as its own authority), **§M-5**, which corrects iteration 1's own transcription of a
measurement taken from the wrong directory, **§M-8**, the second and configuration-independent
refutation of Shape E, AC-0's clause (g), AC-18's named-mechanism requirement, §M-9's four smaller
corrections, and R-7's promotion from a hypothesis to a partly realised risk with a stated search
pattern.

---

## Appendix A — measurements taken this iteration

Measured 2026-09-02 on `main` at `729dcb3`. Candidate-claude's Appendix A and iteration 1's stand
except where a row below supersedes one.

| # | Measurement | Result |
| --- | --- | --- |
| 1 | `ls docs/decisions/ \| tail -1` | `077-…`; **no `078-*`** — AC-0's entry does not exist |
| 2 | `ticket.md` mtime vs. `runs.log` run start | 2026-09-01 **21:30** vs. **23:34** — the body was not edited between iterations |
| 3 | `git log -1` | `729dcb3 [Q-0090]` — unchanged since iteration 1 |
| 4 | `import('@quorum/core')` **from `packages/cli`** | `ERR_MODULE_NOT_FOUND` — `Cannot find package '…/packages/cli/node_modules/@quorum/core/index.js'`; **supersedes** claude's `Cannot find package '@quorum/core'`, taken from the root |
| 5 | `ls -la packages/cli/node_modules/@quorum/` | `core -> ../../../core`, `shared -> ../../../shared` — both links exist |
| 6 | `import('@quorum/shared')` from `packages/cli` | `ERR_MODULE_NOT_FOUND` on `packages/shared/src/constants.js` — resolves as a package, dies on the first relative specifier |
| 7 | `test-discovery.test.ts:59` | `TASKS = ['lint','typecheck','test']`, hand-written, doc comment claims derivation from root `turbo.json`; used at `:214` |
| 8 | `package.test.ts:81` | the same array inlined, under *"declares the three tasks turbo runs"* |
| 9 | `test-discovery.test.ts` `PACKAGES` | **derived** from `pnpm-workspace.yaml`, with a throw on an unexpected glob — the asymmetry in §M-6 |
| 10 | `shared-resolution.test.ts` header | states *"`turbo.json` has no `build` task and `tsconfig.base.json` emits nothing"* as its reason |
| 11 | `engines.node`, root and `packages/cli` | both `">=22.13.0"`; unflagged type stripping landed in Node 22.18 |
| 12 | `npm pack --dry-run` in `packages/cli` | exit **0** on `"private": true`; **22 files, 90.6 kB**, incl. 3 × `.turbo/turbo-*.log` and 9 test files (`frame.source.test.ts` 17.9 kB); no `bin` target, no `files` field |
| 13 | `frame.source.test.ts:150` `DOMAIN` | **13** symbols; carries its own `toBeGreaterThan(10)` floor and a has-a-subject test |
| 14 | `frame.source.test.ts:73` / `:298` `GENERATED` | `['node_modules', '.turbo']`, `toStrictEqual`, one fixture per entry |
| 15 | Every import in `packages/cli` production source | 1 cross-package (`import type`, `exit.ts:12`), 10 package-relative; **zero runtime cross-package imports** |
| 16 | `find . -name turbo.json -not -path "*/node_modules/*"` | root + `cli`, `core`, `shared` — confirms iteration 1's row 13 |
| 17 | root `turbo.json` | `lint`/`typecheck`/`test`, each `dependsOn: ["^<task>"]`, `outputs: []`; `env: ["QUORUM_REAL_CLI"]` on `test`; `globalDependencies` names 4 files |
| 18 | `tsconfig.base.json` | 5 keys — `target`, `module` (`nodenext`), `moduleResolution`, `strict`, `skipLibCheck`; no `paths`, no `outDir`, no `noEmit` |
| 19 | `packages/core/package.json` | no `exports`, no `main`, no `types` |
| 20 | `.gitignore:4` / `eslint.config.js:19` / `git-identity.test.ts` walk | `dist/` ignored, `**/dist/**` ignored, `dist` skipped by name |
| 21 | `test-command.test.ts` `CI_JOBS` | register of **7** jobs, `toStrictEqual` |
| 22 | `docs/04-architecture.md:7`, `:49` | *"One command (`npx quorum`) starts a local daemon…"*; *"Serves the built `apps/web`"* |
| 23 | `spike/bin/harness.js:321` | templates resolved as `path.join(here, '..', 'templates', 'harness')` |
| 24 | Workspace packages | 6 under `packages/` + `apps/web` = 7, all `"private": true`; `compiler`, `server`, `templates`, `web` are stubs with the three scripts and no source to emit |
