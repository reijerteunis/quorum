# Q-0125 — `@quorum/server` resolves, exports and emits

*Merged requirement, run 1, iteration 1. Written 2026-09-12 against tip `be1b89f`, with
`docs/decisions/` ending at 092. Every measurement below was re-taken first-hand in this checkout;
where a figure is inherited from a candidate, a ticket body or this repository's own plan, the
document says whether it survived re-measurement.*

**Verdict: `needs-input`.** One blocker, GO-1 / OQ-1 — a decision entry is owed before a line of
code, and `developer-generalist` may not write one. Everything else is settled. Thirteen criteria,
inside this role's ceiling of fifteen; the size judgement and the seam if it ever needs one are in
§7.

---

## §0 — What is actually true, measured

### 0.1 — Three things stand between `import '@quorum/server'` and a module, and this ticket may only supply two

The ticket body reasons that an `exports` map alone does not satisfy the workspace-local path, so
the package must also emit. That is correct, and it is not the whole obstruction. Measured, with a
plain `node` process in this checkout:

```
cwd packages/cli     →  import.meta.resolve('@quorum/core')     RESOLVED  …/packages/core/dist/index.js
cwd packages/cli     →  import.meta.resolve('@quorum/server')   ERR_MODULE_NOT_FOUND  Cannot find package
cwd packages/server  →  import.meta.resolve('@quorum/server')   ERR_MODULE_NOT_FOUND  Cannot find package
```

The control is decision 078(b) working: a plain Node process, knowing no `quorum-source` condition,
is sent to the emit. The two failures are a **prior** failure, and the message distinguishes them.

Measured link inventory:

| directory | `@quorum/*` links present |
| --- | --- |
| `node_modules/@quorum/` | `cli` only — the root declares `@quorum/cli` so `pnpm exec quorum` finds a `bin` |
| `packages/cli/node_modules/@quorum/` | `core`, `shared` |
| `packages/core/node_modules/@quorum/` | `shared` |
| `packages/server/node_modules/@quorum/` | `core`, `shared` — **pnpm does not self-link** |
| `apps/web/node_modules/@quorum/` | `shared` |
| `packages/compiler`, `packages/shared`, `packages/templates` | no `@quorum/` directory at all |

Nothing anywhere links `server`, because no manifest in the workspace declares it as a dependency.
*"Cannot find package"* is the **link** failure and is raised before the manifest is opened; the
other shape is recorded at `packages/cli/src/package.test.ts:300–302`, which states that a linked
package with no `exports` map makes `import.meta.resolve` *throw*, naming Node's legacy
`@quorum/core/index.js` fall-through. Two distinguishable messages, two distinct causes.
`@quorum/server` hits the first.

**The consequence for scope, stated out loud because no criterion can hide it.** The non-goals
forbid any consumer, and a dependency edge is the only thing that creates a link. So the body's own
sentence — *"The deliverable is that `@quorum/server` can be imported by name"* — **is not
achievable inside this ticket's boundary**. What is achievable, completely and provably, is stated
in §1 and is a smaller claim than the body's.

### 0.2 — The emit is forced, for a reason no landed entry states

Decision 078(a)'s predicate is *"Each package that something **outside the workspace** consumes —
`@quorum/shared`, `@quorum/core`, `@quorum/cli`"*. `@quorum/server` is consumed by nothing outside
this workspace and will not be under this ticket or Q-0126, the local distribution set staying three.

It must nonetheless emit, and the chain measures out exactly as the body gives it: `pnpm exec
quorum` runs `packages/cli/dist/quorum.js`; that is executed by plain Node;
`tsconfig.base.json:6`'s `customConditions` and `vitest.shared.js:41,45`'s two `conditions` arrays
are the only selectors of `quorum-source` and neither is in that process; so a future `packages/cli`
import resolves through **`default`**, which must name a file that exists.

So the reason this package emits is **a workspace-internal consumer running outside the workspace's
own conditions** — a third reason beside 078(a)'s *"consumed outside the workspace"* and 092's
*"served to a browser"*. Nothing in either entry says it.

### 0.3 — `@quorum/server` is the first artifact that is *resolved* and not *distributed*, which decision 092's vocabulary has no room for

`docs/GLOSSARY.md`'s **Emitted artifact**, as 092 clause 1 wrote it hours ago:

> The **emitting set** is four […] and the **local distribution set** is the first three […]
> `@quorum/web` **is the difference** […] the **resolved** emit of **the three distribution
> packages**, the JavaScript and declaration files Node and a packed install import; and the
> **served** bundle of `@quorum/web`.

After this ticket every emphasised clause is false in a different way: the emitting set is **five**;
**two** packages are the difference, not one; and the *resolved* shape covers **four** packages, of
which three are distributed — so the sentence that identifies the resolved shape *by the
distribution set* no longer picks it out. 092 could tie *resolved* to *distributed* because they
were the same three packages. This ticket separates them a second time and **in the other direction
from Q-0122**: `@quorum/web` emits and is not resolved; `@quorum/server` is resolved and is not
distributed. That is a change to a term, not a count bump. See **OQ-1**, which is blocking.

### 0.4 — What moves, measured; the body's own re-measurement confirmed, and two accounts corrected

**`packages/core/src/test-discovery.test.ts`.** `emittingPackages()` (`:93`) derives from `PACKAGES`,
itself derived from `pnpm-workspace.yaml`'s `packages/*` and `apps/*`, so `packages/server` is
already a member and nothing has to be added to make the register see it. Two clauses go red:

- `:276` — `expect(emittingPackages()).toStrictEqual(['apps/web','packages/cli','packages/core','packages/shared'])`.
- `:285–303` — *"a package that emits nothing is not required to declare a no-op build script"*,
  which derives `stubs` by subtraction and guards itself with
  `expect(stubs.length).toBeGreaterThan(0)`. **Measured, that clause keeps a subject**: the seven
  packages are `cli`, `compiler`, `core`, `server`, `shared`, `templates`, `apps/web`; five will
  emit, leaving `packages/compiler` and `packages/templates` — `stubs.length === 2`. Its own comment
  already records that this clause was *not* falsified when `apps/web` began emitting, against
  Q-0122's prediction. **The same prediction should not be made a second time**, and this document
  does not make it.

**`packages/cli/test/workspace.ts:107`'s `emitting()`** is
`dry('build').tasks.filter((task) => task.command !== NO_SCRIPT)` — derived, needing no edit — and
is reached at **fourteen** call sites in `packages/cli/src/build.test.ts`: `:144`, `:360`, `:558`,
`:584`, `:603`, `:624`, `:635`, `:667`, `:712`, `:884`, `:904`, `:951`, `:956`, `:1140`, with a
fifteenth occurrence at `:654` inside a comment. **The ticket body's re-measured figure is confirmed
line for line**, which is worth recording precisely because that figure was thirteen the day before
and the body says so: re-deriving was the right instruction and the answer did not move again.

**`packages/cli/src/build.test.ts:879–898`** — *"the emit carries the declarations the export maps
promise"* — loops `emitting()` and at `:888` does `if (entry === undefined) continue;`. The only
emitter that `continue`s past it today is `apps/web`. **A fifth emitter that declares a map is the
first package that assertion has covered since Q-0097**, so this ticket earns a real proof rather
than a register edit. `:900–908` (no `*.tsbuildinfo`) already covers it unconditionally, as do the
derived stray-write audits at `:603` and `:635`.

**`packages/server/src/package.test.ts:138–155`** — *"it emits nothing: no build task, no exports
map, no files allow-list, no bin"*. Measured, this ticket inverts **two** of its assertions
(`scripts.build`, `exports`) and **four survive unchanged** (`main`, `types`, `files`, `bin` all
stay `undefined`), because `@quorum/core`'s shape puts `types` and `default` *inside* the
conditional map and declares no top-level `main` or `types`. `private: true` and `type: module`
also survive. That is 092's emitting/distribution split arriving inside a single guard, and it is
why AC-3 re-aims the block rather than deleting it.

**Correction 1 — `packages/server/turbo.json` EXISTS.** Both candidates, and this repository's own
plan bullet for Q-0121, say that file was written, measured unnecessary and **deleted**. It is on
disk, created by Q-0122 at `b0bdf70`, declaring `../../apps/web/src/routes.ts` and
`../../apps/web/vite.config.ts` for `src/static.test.ts`'s reads — and its header carries Q-0121's
hash measurement forward *and* the standing residual R-5 rests on. An implementer told the file was
deleted will create one instead of reading the one that is there. Inherited accounting that rotted
inside a day, twice on one ticket now.

**Correction 2 — only TWO `tsconfig.build.json` headers carry a count, not three.**
`packages/cli`'s and `packages/core`'s say *"The three **distribution** packages declare the same
four options"* and then, in a sentence Q-0122 added, *"the emitting set is four now and the fourth,
`apps/web`, has no `tsconfig.build.json` at all"*. `packages/shared`'s carries the full argument and
**no number at all**. So the subject of those two headers (*distribution* packages) stays correct at
three while the file count becomes four and the emitting-set sentence beside it becomes wrong by
one. AC-12 is aimed at the count rather than at the word.

**Correction 3 — a production source comment states the premise this ticket removes, and neither
candidate found it.** `packages/server/src/index.ts`'s second docblock explains why three wire
shapes live in `@quorum/shared`: *"because a browser consumes them from `@quorum/shared` directly —
**this package having no export surface** — and needs a runtime parser rather than a type."*
`docs/04-architecture.md:254` carries the same premise in the `apps/web` section: the frame union is
re-exported *"without giving the server package a browser-facing export surface."*
`.claude/rules/engineering.md` forbids a comment claiming what the code cannot back, and the
**conclusion** in both places is one a later reader must not reverse — so what has to change is the
reason, not the arrangement. AC-11.

**Turbo hashes, predicted rather than declared.** `packages/core/turbo.json` already declares
`../../packages/*/package.json` and `../../packages/*/**/*.test.ts` (its Q-0054 block), and the root
`test` task's `^test` edge carries `@quorum/core#test` into `@quorum/cli#test`. So an edit to
`packages/server/package.json` is **expected** to move both hashes with no new declaration.
`packages/cli/turbo.json`'s `DECLARED` register does **not** name `../../packages/*/package.json` —
it names `../../packages/*/src/**` and `../../packages/*/turbo.json` — which is why the coverage is
transitive rather than direct. AC-9 measures it both ways and records the hashes; it does not assert
the prediction.

**`packages/server` is not a collected literal today.** `git grep` over the two `SUITES`
(`@quorum/shared#test`, `@quorum/core#test`) finds the string only inside longer literals
(`'### \`packages/server\`'`) and inside doc comments, which `pathLiterals` does not collect. So
putting `'packages/server'` into the emitting register at `:276` creates a **new** collected literal
and a fifth `NOT_READ` row is owed, with the `apps/web` row's reasoning.

**The emitted-test hazard is already double-guarded, so it must be asserted directly.**
`vitest.shared.js:61` is `exclude: [...configDefaults.exclude, '**/dist/**']` — Q-0097 AC-23's fix —
and `tsconfig.build.json`'s `exclude: ["src/**/*.test.ts"]` is the first line. `packages/server/src`
holds **eight** test files beside eleven production modules, so a missing `exclude` would emit eight
`.test.js` files that a green suite would say nothing about. AC-5 therefore asserts over the emitted
file set rather than inferring from a passing run.

### 0.5 — The impossibility this ticket removes is load-bearing in a document, and its practical half survives

`docs/04-architecture.md:70–73`:

> `apps/web` cannot import `@quorum/server` at all: **it has no `exports` map**, and a value import
> from a browser bundle would pull `hono`, `@quorum/core` and Node builtins in with it, **where a
> guard is weaker than an impossibility**.

The conclusion survives — `packages/server`'s eleven production modules import `node:fs`,
`node:path`, `node:url` and `node:http` — and the **reason** does not, and with it the claim that
the barrier is an impossibility rather than a guard.

**The practical half is already guarded, measured rather than assumed.**
`apps/web/test/package.test.ts`'s `JUSTIFICATIONS` register is asserted against the manifest **in
both directions**, and a second clause pins `dependencies` to exactly
`['@quorum/shared','react','react-dom']`. Adding `"@quorum/server"` to `apps/web` fails two
assertions today, with no change from this ticket. So what is owed is the **document correction**
(AC-11), not a new guard; a criterion adding one would be a second copy of a rule that already fails
closed. Stated with its evidence so a reviewer does not raise it.

### 0.6 — Prose carrying a count that has to move

| site | what it says today |
| --- | --- |
| `docs/04-architecture.md:141–142` | §`packages/server`: *"and it emits nothing: the local distribution set is three packages"* |
| `docs/04-architecture.md:215` | §`packages/server`: *"The four packages that emit are named under **Testing strategy**"* |
| `docs/04-architecture.md:254` | §`apps/web`: *"the emitting set is four where the local distribution set stays three"*, and the *"without giving the server package a browser-facing export surface"* premise |
| `docs/04-architecture.md:294–296` | Testing strategy: *"**Four packages emit and three are packed**"*, and the list naming which three declare a `tsc`-driven `build` script |
| `docs/GLOSSARY.md:193, 201` | **Build task**: *"run in the four packages that emit"*; *"took it from three packages to four"* |
| `docs/GLOSSARY.md:204–222` | **Emitted artifact**: §0.3's clauses |
| `packages/{cli,core}/tsconfig.build.json` headers | the count sentence and the *"the fourth, `apps/web`, has no `tsconfig.build.json` at all"* clause |
| `packages/cli/src/build.test.ts:902` | *"Refused in the three `tsconfig.build.json` files by leaving both options off"* |
| `packages/server/src/index.ts` | *"this package having no export surface"* |

`docs/README.md`'s and `CLAUDE.md`'s **22-term** lists do **not** move: no term is coined and none
retired, only two existing entries re-derived. Counted rather than assumed, and recorded so it is
not re-litigated.

---

## §1 — Problem

The daemon and the web bundle both exist and nothing in this product can start them.
`packages/server` has been written, reviewed and shipped across five tickets — Q-0013, Q-0118,
Q-0119, Q-0121 and Q-0122's static route — and it is still a package that no line of code outside
its own directory can name. Q-0122's own gate met this by accident: an end-to-end probe of the
static route, written as a plain `node` script importing `@quorum/server`, died with
`ERR_MODULE_NOT_FOUND` and had to be re-run under Vitest.

The package declares no `exports`, no `main`, no `types` and no `build` script — the first three
verbatim the state Q-0096 measured for `@quorum/core`, the fourth what Q-0097 then added there. It
publishes no public surface and produces no artifact, and the cost is already recorded in the
package's own source: three wire shapes were moved to `@quorum/shared` at Q-0120 and Q-0121 because
*"this package having no export surface"* made them unreachable from the only other end of their own
socket.

**The deliverable, restated on §0.1's measurement:**

> **`@quorum/server` declares the export surface and produces the artifact that make it importable,
> and proves that a plain Node process reaching for it is sent to a file that exists and runs — so
> that the one thing still missing is the dependency edge its first consumer will declare.**

Nothing about what the daemon does changes. This is machinery, and it is `p1` because it blocks
Q-0126, which owns a line of M3's own definition of done.

---

## §2 — User stories

**`maintainer`** — *As the maintainer, I want `packages/cli` to be able to declare a dependency on
`@quorum/server` and have the import work under the built binary, so that Q-0126 can build
`quorum open` without first discovering that the package it needs cannot be named.*

**`contributor`** — *As a contributor reading the package map, I want `packages/server` to have the
same shape as the other packages that emit, so that "what does this package publish" is a question I
answer from its manifest rather than by grepping for relative imports.*

**`adopter`** — *As a cold-clone adopter, I want `pnpm turbo run build` to stay fast enough that the
first thirty minutes are not the build, so that a fifth emitter is a measured cost rather than an
assumed-free one.* (The only way this ticket reaches this persona; R-3.)

**Surfaces.** None of the four product surfaces — CLI, daemon and web UI, `harness/`, `backlog/` —
changes behaviour. What changes is workspace machinery: one manifest, one new `tsconfig.build.json`,
four registers and two documents.

---

## §3 — Acceptance criteria

Thirteen. Each is independently testable and names its instrument. Where a *Test:* clause bounds the
instrument, **that bound is the specification** — a reviewer may find the instrument fails the job
the clause gives it and may not raise the job (Q-0067 erratum E-1).

**One rule binds every criterion below and is not repeated in each**: a new or changed test derives
its verdict from tracked-and-unignored files, from an isolated copy it creates, from package-local
files, or from values it sets itself — never from an existing `dist/`, a `node_modules` an earlier
action left in a fixture, git identity, gitignored run state, or a condition the invoking account
supplies. *"A test's verdict is a property of the commit, not of the checkout or the account"*
(2026-08-30). Codex's AC-14, promoted to a rule because it is a property of all thirteen rather than
a fourteenth.

---

**AC-1 — `@quorum/server` declares a conditional `exports` map of the shape `@quorum/core` and
`@quorum/shared` declare, publishing `"."` and no subpath pattern.**

`exports["."]` carries `quorum-source` → `{ types: './src/index.ts', default: './src/index.ts' }`,
then `types` → `./dist/index.d.ts`, then `default` → `./dist/index.js`. No `main` and no top-level
`types` are added: resolution goes through the map, which is what `customConditions` makes `tsc`
read too. The public surface stays exactly what `packages/server/src/index.ts` already exports; no
internal module becomes reachable by subpath.

*Test:* in `packages/server/src/package.test.ts`, over the package's own manifest — the three
condition branches asserted by value, plus `Object.keys(own.exports)` is exactly `['.']` and no key
contains `*`, which is the refusal `packages/cli/src/package.test.ts:511` already makes for
`@quorum/core`. Shown red by deleting the `quorum-source` branch, which must fail with a message
naming that condition rather than a generic shape mismatch.

---

**AC-2 — The package declares a `build` script and a `tsconfig.build.json`, and the four such files
in the workspace agree.**

`"build": "rm -rf dist && tsc -p tsconfig.build.json"`, byte-identical to `@quorum/core`'s.
`packages/server/tsconfig.build.json` extends `./tsconfig.json` and declares exactly
`outDir: "dist"`, `rootDir: "src"`, `declaration: true`, `noEmit: false`, with
`include: ["src/**/*.ts"]` and `exclude: ["src/**/*.test.ts"]`, and neither `incremental` nor
`composite`. `packages/server/tsconfig.json` is **not** touched, that being the project ESLint's
`projectService` and `typecheck` read.

*Test:* two clauses. (a) The script matches `/^rm -rf dist && tsc -p tsconfig\.build\.json$/`.
(b) The `compilerOptions`, `include` and `exclude` of every `tsconfig.build.json` under `packages/**`
and `apps/**` are compared with each other and must be equal — **derived by globbing for the file
rather than from a list of package names**, so a sixth arrives in the comparison without anyone
remembering. Shown red by changing `rootDir` in one of the four.

*Why this is uniformity rather than mechanism, stated so it is not mistaken for one:* `rm -rf dist`
is the whole clean mechanism for a `tsc` emitter, turbo pruning an output directory on neither the
miss path nor the hit path.

---

**AC-3 — The package emits and is not distributed, and the guard that said it does neither is
re-aimed rather than deleted.**

`private: true` stays; `files`, `main`, `types` and `bin` stay absent.
`packages/server/src/package.test.ts:138–155` keeps its four surviving `toBeUndefined()` assertions
on exactly those keys, loses the two on `scripts.build` and `exports`, and its title and comment
stop claiming the package emits nothing — naming instead the two sets 092 separated and which of
them this package is now in.

*Test:* the four surviving keys asserted `undefined` by name; `private` `true`; `type` `module`; and
the block shown red in **both** directions — by restoring `expect(own.exports).toBe(undefined)`, and
by adding `files: ["dist"]` to the manifest, which must fail with a message naming **distribution**
rather than emission. The second half is what stops AC-3 being read as *"delete the assertions that
now fail"*.

*Authority:* 092 clause 2 ruled `apps/web`'s non-distribution **by name**. That it extends to a
second package is OQ-1's and must be in the entry GO-1 asks for, not assumed here.

---

**AC-4 — The emitting register is five, still derived, and its stub clause still discriminates.**

`packages/core/src/test-discovery.test.ts:276` becomes the five-element identity in the same sorted
order, with a comment recording that the emitting set is five and the local distribution set three,
citing the entry GO-1 lands. `stubs` stays derived by subtraction and is not replaced by a
maintained list.

*Test:* the identity assertion over `emittingPackages()`, plus the existing
`expect(stubs.length).toBeGreaterThan(0)` anti-vacuity clause, whose remaining members are named in
the comment — `packages/compiler` and `packages/templates`, **two**. Shown red by removing the
`build` script from `packages/server`, which must fail the identity clause and **not** the stub
clause, so the two are proven to discriminate different things.

---

**AC-5 — The build writes the emit and nothing else, from a clean start.**

Starting from a `packages/server/dist/` holding a sentinel file, a successful build removes it. The
resulting directory holds the JavaScript and declaration counterparts of the eleven production
modules and holds **no emitted test module, no `.test.d.ts`, no copied `*.test.ts` and no
`*.tsbuildinfo`**.

*Test:* in `packages/cli/src/build.test.ts` against an isolated copy, so the verdict is the commit's.
The no-test-module clause asserts over the **emitted file set** and not over a passing suite:
`vitest.shared.js:61` already excludes `**/dist/**`, so eight emitted `.test.js` files would be
invisible to every green run — the exclude is defence in depth and cannot stand in for the
assertion. The `*.tsbuildinfo` clause is `build.test.ts:900–908`, which needs no change; the
stray-write audits at `:603` and `:635` pick the new member up from `emitting()` automatically and
are named here so nobody edits them. Shown red by removing `exclude` from the new
`tsconfig.build.json`.

---

**AC-6 — The declarations the map promises exist, and the new package is inside the loop that
checks them rather than skipped by it.**

`build.test.ts:879–898` `continue`s past an emitter with no `exports` map. With AC-1 landed,
`@quorum/server` is the first package that assertion has covered beside the three distribution
packages, and that coverage is asserted rather than inherited silently.

*Test:* after a forced build, `packages/server/dist/index.js` and `packages/server/dist/index.d.ts`
both exist, and a new clause asserts that the set of emitters the `:879` loop actually **checks** —
those carrying an `exports['.']` — contains `@quorum/server`, so a later `continue` past it fails
rather than passing in silence. Shown red by pointing `exports['.'].types` at a path the build does
not write.

---

**AC-7 — A plain Node process is sent to the emit, can execute it, and gets the barrel the source
declares.**

Three clauses, because three different things can be wrong.

(a) **Resolution.** In a temporary directory holding `node_modules/@quorum/server` as a symlink to
the package, a plain `node` process — no `--conditions`, no loader, no Vitest, no TypeScript
runner — resolves `@quorum/server` to a URL ending `/dist/index.js`. **The synthesised link is
named, in the test's own comment, as standing in for the dependency edge this ticket may not add**
(§0.1), so nobody later reads it as proof that the name resolves from the workspace as it stands.

(b) **Execution.** The same plain process imports the built `dist/index.js` by absolute `file://`
URL and succeeds — which is what proves `hono`, `@hono/node-server`, `@hono/node-ws`,
`@quorum/core` and `@quorum/shared` all resolve through their own `default` conditions from the
emitted module's location. Resolution alone is not enough, and the reason is
`packages/cli/src/package.test.ts:300–302`'s: `import.meta.resolve` answers from the manifest
without the target existing.

(c) **Identity.** The namespace that import returns carries exactly the runtime export names the
source barrel declares, **derived from `packages/server/src/index.test.ts`'s existing register
rather than retyped**, on the shape `build.test.ts:921`'s `publicApi()` already uses, with that
helper's throw-on-empty guard so a regex matching nothing cannot make the clause vacuous.

*Test:* this criterion lands in `packages/cli/src/build.test.ts`, which owns `runBuild`,
`removeEmit`, `isolate` and `inPlainNode`, and **not** in `packages/server`'s own suite — a test
asserting the emit exists without running the build takes its verdict from the checkout, `dist/`
being gitignored. Shown red by deleting one export from the barrel, which must fail (c) naming the
missing symbol.

---

**AC-8 — No verdict that exists today moves behind the new emit.**

Decision 078(b) is untouched: `test` and `typecheck` gain no `^build` edge, no package's `lint`,
`typecheck` or `test` script builds anything first, and the workspace suites go on proving
TypeScript source. All resolution proofs for the source condition run **without** building
`packages/server`.

*Test:* three clauses. (a) Root `turbo.json`'s `test` and `typecheck` declare `dependsOn` of exactly
`["^test"]` and `["^typecheck"]`, read out of the file rather than from a literal. (b)
`exports['.']['quorum-source'].default` is `./src/index.ts`. (c)
`packages/server/src/package.test.ts:176–177` — `import.meta.resolve('@quorum/core')` contains
`/packages/core/src/index.ts`, and the same for `@quorum/shared` — is **unchanged and still passes**,
which is the evidence that adding an emit to this package moved no verdict inside it. Shown red by
adding `"^build"` to the root `test` task.

---

**AC-9 — The turbo census gains its fifth `NOT_READ` row, and the hash question is measured rather
than answered by reflex.**

(a) `packages/core/src/turbo-inputs.test.ts`'s `NOT_READ` (`:311–330`) gains `'packages/server'`,
with the `apps/web` row's reasoning in its own words: the literal is a member of the emitting-set
register, which is data derived from manifests reached through the `packages` walk `WALKS` already
declares, and nothing opens the directory. No row is deleted to make the census pass.

(b) Whether `@quorum/core#test` and `@quorum/cli#test` are invalidated by an edit to
`packages/server/package.json` is **measured**, both hashes recorded, and an input declared **only
if the measurement says one is needed**. *Predicted and to be confirmed:* `packages/core/turbo.json`
already declares `../../packages/*/package.json` and the root `^test` edge carries it into
`@quorum/cli#test`, so nothing is expected to be owed, and declaring it anyway would be the same
claim twice, free to drift. **`packages/server/turbo.json` already exists** (Q-0122, `b0bdf70`) and
declares two `apps/web` reads; if this change adds an out-of-package read from this package, it is
added there, and if it adds none the file is left alone. The account saying that file was deleted at
Q-0121 is stale — see §0.4, Correction 1.

*Test:* (a) removing the row fails `turbo-inputs.test.ts` clause B naming `packages/server`, and the
existing dead-key clause still passes, proving the new key is a literal the scan collects. (b) is a
reported measurement with both hash values, in the implement report and in a comment beside whatever
it decides — not an assertion.

---

**AC-10 — `docs/04-architecture.md` says the package emits and is not distributed, and its four
count sentences are corrected.**

`:141–142`'s *"and it emits nothing: the local distribution set is three packages"*, `:215`'s *"The
four packages that emit"*, `:254`'s *"the emitting set is four"* and `:294–296`'s *"**Four packages
emit and three are packed**"* with its list of which packages declare a `tsc`-driven `build` script
all move. The status line records Q-0125 and 2026-09-12.

*Test:* `packages/shared/src/docs.test.ts`'s existing Q-0013 GO-3 slice of §`packages/server`
(`:1103–1120`) gains clauses — the section no longer matches `/it emits nothing/`, it names the
emitting set and the distribution set as different sizes, and the status-line clause names this
ticket — beside a clause over the Testing-strategy paragraph. The slice's anti-vacuity guard
(`:1113`, *"this check has lost its subject"*) is unchanged. Shown red by reverting the `:141`
sentence.

---

**AC-11 — Nothing states *"no `exports` map"* or *"no export surface"* as the reason two arrangements
exist, and each names what actually holds.**

Two sites, one rule. `docs/04-architecture.md:70–73`'s *"it has no `exports` map […] where a guard is
weaker than an impossibility"* keeps its conclusion and loses its reason: a value import would pull
`hono` and four Node builtins into a browser bundle, and `apps/web`'s own `JUSTIFICATIONS` register
refuses the dependency in both directions — so after this ticket it **is** a guard, and saying so is
cheaper than leaving a reader to discover it. `packages/server/src/index.ts`'s barrel docblock, which
gives *"this package having no export surface"* as the reason `WireMessage`, `WireRefusal` and
`WireRun` live in `@quorum/shared`, keeps that arrangement and states the reason that survives: a
browser may not import this package, and a moved type with no schema is the half-measure Q-0120 had
to repair. `docs/04-architecture.md:254`'s *"without giving the server package a browser-facing
export surface"* moves with it.

*Test:* the §`packages/server` slice no longer matches `/it has no .?exports.? map/` and names the
register that refuses the dependency; a source clause in `packages/server/src/package.test.ts`
asserts the barrel's docblock does not match `/no export surface/` while still naming
`@quorum/shared` as the owner of the three shapes, so the conclusion cannot be deleted along with
the premise. Shown red by restoring either sentence. **No new guard is added in `apps/web`** — §0.5
measured the existing one fails closed in both directions, and a second enforcer of one rule is the
drift this repository keeps finding.

---

**AC-12 — `docs/GLOSSARY.md`'s **Build task** and **Emitted artifact** are re-derived, and the
*resolved* shape stops being defined by the distribution set.**

**Build task** names five packages. **Emitted artifact** states the emitting set as five and the
local distribution set as three, names **both** members of the difference — `@quorum/web` and
`@quorum/server` — and defines **resolved** by what Node does with it rather than by which packages
are packed, so that an artifact that is resolved and not distributed has a home in the sentence.
Both prose counts of `tsconfig.build.json` files move with it: the two headers in
`packages/{cli,core}/tsconfig.build.json` and `packages/cli/src/build.test.ts:902`'s *"the three
`tsconfig.build.json` files"* — **two headers, not three**, `packages/shared`'s carrying the argument
and no number (§0.4, Correction 2).

*Test:* the glossary no longer matches `/the resolved emit of the three distribution packages/`; both
non-distributed emitters are named in the **Emitted artifact** entry; a clause counts
`tsconfig.build.json` files under `packages/**` and `apps/**` and asserts that no file under those
roots states a different number for them, **derived from the count rather than matching a literal**;
and every landed `docs.test.ts` pin over these two entries still passes unchanged — the *"Not a
'pipeline', a 'job' or a 'step'"* clause, the *"the two words are not interchangeable"* clause, the
078 citation and the `docs/README.md` term-list clause. Shown red by leaving either count at four and
by leaving one header at *"three"*.

*No term is coined and none retired*, so neither 22-term list moves and `CLAUDE.md` stays the
human's (Q-0103 erratum E-2). Counted at 22 in both, 2026-09-12.

---

**AC-13 — Nothing is installed and no dependency edge is created.**

No package's `dependencies` or `devDependencies` gains `@quorum/server`; the root manifest is
unchanged; `pnpm-lock.yaml`'s `packages/server` importer gains no entry; no packed-install fixture
changes. This is the criterion that holds the ticket inside its own non-goals, and it is checkable
rather than a promise.

*Test:* every manifest under `packages/**`, `apps/**` and the workspace root is read, and the only
occurrence of the string `@quorum/server` across them is `packages/server/package.json`'s own `name`.
Shown red by adding the dependency to `packages/cli`, which is Q-0126's first line and must fail
here.

---

## §4 — Non-goals

Each with why, because a non-goal with no reason is a deferral nobody can audit.

1. **`quorum open`, and any consumer at all.** Q-0126's. AC-13 enforces it. Consequence, stated
   rather than hidden: **the emit this ticket produces is imported by nothing when it lands** — R-2.
2. **Whether `@quorum/server` is distributed.** Q-0124's, and after this ticket that question
   governs **two** packages rather than one. The package stays `private: true` with no `files`,
   exactly as `@quorum/web` does. A packed `@quorum/cli` importing it would be broken for the
   `workspace:*` reason Q-0098's M-8 measured; that becomes urgent at Q-0126 and is not urgent here,
   this ticket adding no importer.
3. **Moving decision 078(b).** No `^build` edge on `test`, `typecheck` or `lint`; AC-8 asserts it.
4. **Widening or narrowing the barrel.** `packages/server/src/index.ts` gains and loses no export;
   AC-7(c) pins the runtime register against the emit. Whatever Q-0126 needs, this package already
   exports it.
5. **Any behaviour change in the daemon** — no route, no host method, no wire shape, no port, no
   bind, no static-serving change.
6. **Subpath exports**, and `main` / top-level `types` compatibility fields. AC-1 publishes `"."`
   alone; OQ-3 records why the legacy fields are omitted.
7. **A new guard in `apps/web` against importing the daemon.** §0.5 measured the existing register
   fails closed in both directions.
8. **`packages/compiler` and `packages/templates`.** They stay the two stubs that make AC-4's
   anti-vacuity clause discriminate.
9. **The root `devDependencies`.** Adding `@quorum/server` beside `@quorum/cli` would make AC-7(a)
   easier and would be a dependency declared for a test's convenience — OQ-2.
10. **A bundler, a new dependency or a second build system.** `tsc` is already the typecheck gate,
    and 092 clause 3 scoped 078(a)'s *"no bundler"* to the `tsc` emitters — of which this is one.
11. **Closing `turbo-inputs.test.ts`'s blindness to `packages/server`.** R-5; the residual is
    `packages/server/turbo.json`'s own header's and predates this ticket.

---

## §5 — Open questions

**OQ-1 (BLOCKING) — Does this ticket owe a decision entry?**

The ticket body says *"the shape is now precedented, which is an argument that it does not"*, and
codex reads it as a blocker only if the gate finds a contradiction. Measured, there is one, and
three things no landed entry states:

1. This package emits for a reason 078(a)'s predicate does not cover — a **workspace-internal**
   consumer running under plain Node, not *"something outside the workspace consumes it"* (§0.2).
2. It is the first artifact that is **resolved and not distributed**, a combination 092's own
   vocabulary forecloses by defining *resolved* as *"the resolved emit of the three distribution
   packages"* (§0.3).
3. 092 clause 2 ruled non-distribution **for `apps/web` by name**, not as a class, so a second
   non-distributed emitter extends that ruling rather than instancing it.

**Recommendation: an entry is owed, and 092 itself is what makes the argument decisive.** Its
Alternatives section refuses *"Say nothing and let the register catch it"* in these words: *"A guard
firing is the beginning of a decision, not a substitute for one — and this entry exists because an
emitting set of four falsifies three clauses of the glossary and two of 078, none of which a red
test can rule."* An emitting set of **five** falsifies clause 1 of 092. AC-3 and AC-12 edit sentences
that entry wrote **in its own Decision clause**, hours ago; editing them without a new entry is
contradicting a landed entry silently, which `.claude/rules/docs-and-decisions.md` forbids in as many
words, and a landed entry is never edited.

The counter-argument, recorded because it is real: this is a widening and a count rather than a
reversal, 092 anticipated a fifth emitter, and an entry per emitter is a tax. It does not survive
the fact that clause 1's own words have to move.

**The entry is `developer-generalist`-forbidden** (`harness/roles/developer-generalist.md:23`), so it
is the human's at the gate — which is GO-1 and is why this is blocking rather than advisory. What it
must rule: the emitting set is five and the distribution set three; *resolved* is defined by what
Node does rather than by what is packed; whether 078(a)'s predicate is narrowed or extended; and
OQ-3's `files` ratification.

**OQ-2 — How AC-7(a) obtains a link, given that this ticket may not create one.** Two shapes.
**(A) A synthesised `node_modules/@quorum/server` symlink in a temp directory**, named in the test as
standing in for the dependency edge — **recommended**. **(B) Add `@quorum/server` to the root
`devDependencies`** beside `@quorum/cli`, which creates a real link. **Refused**: the root entry for
`@quorum/cli` exists because that package has a `bin` and `pnpm exec quorum` needs it linked;
`@quorum/server` has none, so (B) is a dependency declared to make a test resolve — a consumer added
for a test's convenience, against non-goal 1 and AC-13. Not blocking: (A) is implementable and the
gate can prefer (B) cheaply.

**OQ-3 — Should `packages/server` declare `files` anyway?** 078(e) says *"The artifact sits in
`dist/` inside its own package, **and `files` is declared**"*, in a sentence whose whole argument is
about what a `pnpm pack` ships. `@quorum/web` declares none and 092 clause 2 ruled that correct for a
package that emits and is not distributed. **Recommendation: no `files`**, with the ratification in
OQ-1's entry rather than in a criterion, because it is 078(e) being scoped the way 092 scoped 078(a).
Not blocking on its own; it rides GO-1.

**OQ-4 — Does the ticket's title survive §0.1?** *"resolves, exports and emits"* claims three things
and the first is not this ticket's to deliver. **Recommendation: the title stays and §1 carries the
correction** — a title is not a criterion, and renaming a `p1` ticket mid-flight moves citations in
the plan, in Q-0124 and in Q-0126 for no behaviour. Stated so the gate can disagree cheaply.

---

## §6 — Gate obligations

**GO-1 (blocking, before a line of code) — OQ-1's decision entry is landed, or OQ-1 is ruled the
other way in writing.** AC-3, AC-11 and AC-12 are unsatisfiable without the ruling, and an implement
step meeting them anyway would be editing a landed entry's own words on its own authority.
**Discharge by measurement, not by assumption**: confirm the entry appears in the implement step's
**actual prompt**, cited by title and date — the check Q-0097 lost two errata by not making, and
which Q-0115 and Q-0122 both performed. Q-0062 named the same hazard in advance and was launched
without the entry, at a cost of three rounds; that is the failure this obligation exists to prevent.

**GO-2 — Verified forced in both environment rows.** `pnpm turbo run build --force` and
`pnpm turbo run test --force --continue` in a worktree that has neither `.harness/worktrees` nor
`.quorum/runs`, and again on `main` after the merge, with `pnpm lint`, `pnpm typecheck`,
`quorum lint` and the git-identity sweep. Q-0072's closing finding: a green `integrate` tick is
worktree-scoped. Codex's AC-17 lives here rather than as a criterion — a verification list is an
obligation, not an independently testable property of the change.

**GO-3 — R-3's build-time measurement is recorded**, before and after, as Q-0122 recorded 2.5 s and
four tasks for the fourth emitter. A cold-clone cost assumed to be small is a shape this repository
has been wrong about before.

**GO-4 — If R-1 fires, the remedy is an explicit type annotation and is reported, never a dropped
`declaration` or a widened `skipLibCheck`.** Recorded at the gate so a round does not spend itself
choosing.

---

## §7 — Size, and the seam if it is ever needed

**Thirteen criteria, and the ticket does not split.** The seam a reader will reach for is
implementation (AC-1 to AC-9) against documentation (AC-10 to AC-12), and it is refused:
`.claude/rules/docs-and-decisions.md` requires the documents fixed in the same change as the code,
and three of the four prose criteria are the *deliverable* of GO-1's entry rather than housekeeping
beside it. Splitting would land a five-emitter workspace whose glossary says four, which is the
exact drift 092 was written to close.

**Named in advance rather than discovered, on Q-0122's E-1 precedent:** if the revise loop exhausts
on the prose half, the remedy is an erratum at that gate splitting AC-10 to AC-12 into a successor —
**not** a fourth implement round. AC-1, AC-7 and AC-13 are not eligible for trimming: the first is
the deliverable, the second is the only proof that the artifact runs, and the third is what keeps
the ticket inside its own boundary.

---

## §8 — Cross-cutting checklist

| | |
| --- | --- |
| **BYOS** | n/a to the change, and not vacuously: `packages/server` carries no credential path and no environment read for a key, and `apps/web`'s credential scan is untouched. No test, fixture or example gains a key. |
| **Worktree safety** | n/a. No flow writes anything here; no code path touches `.harness/worktrees/` or the user's working tree. |
| **Gate behaviour** | n/a. No flow, no gate, no `auto`, no `human-locked` clause moves. |
| **File format and schema** | No schema and no persistent file format changes. `packages/shared`'s zod schemas are untouched; AC-7(c) pins the barrel's runtime register so no exported shape moves. The two files that gain structure — `package.json` and a new `tsconfig.build.json` — are AC-1's and AC-2's. |
| **Adapter contract** | n/a. No adapter, no vendor-specific behaviour, no `capabilities.ts`. |
| **Lint rules** | Unaffected by construction: `tsconfig.build.json` is a **second** project and `packages/server/tsconfig.json` — the one ESLint's `projectService` and `typecheck` read — is not touched, so the single type-aware rule (`@typescript-eslint/no-deprecated`, Q-0069) keeps its project. |
| **Flow lint** | n/a. No flow file changes. |
| **Cold-clone impact** | One added build task on the workspace-local path; R-3, measured at the gate under GO-3. The packed path is unchanged, this package being in no tarball. |
| **Product-agnostic** | n/a. Nothing here names a product. |
| **Decision entries** | One, blocking — OQ-1 / GO-1. `developer-generalist` may not write it. |
| **Glossary** | Two existing entries re-derived (AC-12). **No term coined, none retired**, so neither 22-term list moves and `CLAUDE.md` stays the human's. |

---

## §9 — Risks

**R-1 — Declaration emit may not be free, and it has never been run.** `declaration: true` requires
every exported value's type to be nameable from the emitting package. Measured mitigations already
in place: `createApp`, `mountRead` and `mountStatic` annotate `Hono` **explicitly** rather than
inferring it, and `hono` is a direct dependency, so `import("hono").Hono` is nameable. **Predicted
low, not measured** — `tsc -p tsconfig.build.json` has never run in this package. If it fails with
TS2742 or TS4023, the fix is an explicit annotation on the affected export; it is **not** dropping
`declaration`, which breaks AC-1's `types` condition, and **not** `skipLibCheck`, already on and not
the mechanism. GO-4.

**R-2 — The ticket ships an emit nothing imports.** Accepted deliberately, and it is Q-0121's R-1
one package over: under the ruled scope there is no user-visible consumer, and the alternative —
bundling Q-0126 — is what turned Q-0013 into three tickets and Q-0014 into two. What makes it
acceptable rather than speculative is that AC-7 proves the artifact **runs**, so the consumer
inherits a measured surface instead of discovering one.

**R-3 — Build time on the cold-clone path.** `pnpm turbo run build` is on the workspace-local
installation path this repository claims and tests, so any increase lands inside M6's thirty
minutes. Q-0122 took the forced whole-workspace build from three tasks to four and 2.5 s; a fifth
`tsc` emitter over eleven production modules is expected to be cheaper than a Vite bundle, **which
is a prediction to measure and not a claim**. It serialises after `@quorum/core` and
`@quorum/shared` through `dependsOn: ["^build"]` and nothing depends on it, so it cannot lengthen
anyone else's chain.

**R-4 — The derived build suite may still encode four.** The fourteen `emitting()` call sites are
derived and pick the fifth member up automatically, but an assertion, a comment, a `NOT_READ` row or
a fixture may encode the old count or assume every `tsc` emitter is distributed. **Each failure is
classified against the five-emitter / three-distribution boundary rather than patched by weakening
the census** — the register catching this is the mechanism working, and the two most likely sites are
already named: `test-discovery.test.ts:276` and `build.test.ts:902`.

**R-5 — `turbo-inputs.test.ts` does not scan `packages/server`.** Its `SUITES` are
`@quorum/shared#test` and `@quorum/core#test`, which `packages/server/turbo.json`'s own header
records as the standing residual: *"a later read out of this package is covered by nobody's guard."*
This ticket adds no out-of-package read from it, so it neither closes the gap nor widens it — stated
so the residual is not later attributed here.

**R-6 — A pre-existing hash gap, named so it is not confused with this ticket's.**
`packages/cli/turbo.json`'s `DECLARED` names `../../packages/*/src/**` and
`../../packages/*/turbo.json` and **not** `../../packages/*/package.json`, so `build.test.ts`'s
manifest reads reach `@quorum/cli#test` only through `@quorum/core#test`'s own declaration and the
`^test` edge. That is true today of `apps/web` and becomes true of `packages/server`. AC-9(b)
measures it; it is not this ticket's to close.

**R-7 — A guard that inverts is a guard that can be deleted instead.** AC-3 and AC-4 both invert
assertions that pass today, and the cheapest wrong implementation of either is to delete the failing
clause. Both therefore demand a red demonstration **in both directions** — the failure
`q0050.source.test.ts`'s fail-open array (Q-0051) and Q-0093's per-package register each cost a
round.

**R-8 — Q-0126 inherits an unresolved distribution question, and must not paper over it.** This
ticket adds no consumer, so the packed CLI is not broken by it. Q-0126 must not add the runtime
import without Q-0124's decision, which now governs **two** packages.

---

## Appendix A — Every site that moves, measured 2026-09-12 at `be1b89f`

Given so an implementer does not re-derive it, and given with the instruction to **re-measure the
line numbers before editing**: the `emitting()` count in this ticket's own body was thirteen and was
fourteen a day later, and the account of `packages/server/turbo.json` in both candidates is a ticket
out of date.

**Manifests and configuration**

- `packages/server/package.json` — `exports` map (AC-1), `build` script (AC-2).
- `packages/server/tsconfig.build.json` — new (AC-2).

**Registers that go red**

- `packages/core/src/test-discovery.test.ts:276` — the four-element identity → five (AC-4).
- `packages/core/src/test-discovery.test.ts:285–303` — the stub clause; keeps its subject at two.
- `packages/core/src/turbo-inputs.test.ts:311–330` — `NOT_READ` gains a fifth row (AC-9a).
- `packages/server/src/package.test.ts:138–155` — two assertions invert, four survive (AC-3).

**Registers and files that need no edit, stated so nobody edits them**

- `packages/cli/test/workspace.ts:107`'s `emitting()` — derived from `turbo run build --dry=json`.
- `packages/cli/src/build.test.ts`'s fourteen `emitting()` call sites — `:144`, `:360`, `:558`,
  `:584`, `:603`, `:624`, `:635`, `:667`, `:712`, `:884`, `:904`, `:951`, `:956`, `:1140` (plus
  `:654` in a comment) — each of which picks the new member up automatically.
- `packages/cli/src/build.test.ts:1650`'s `DISTRIBUTION = ['cli','core','shared']` — **unchanged**,
  which is the whole of 092's split holding.
- `packages/core/turbo.json` — already declares `../../packages/*/package.json` (AC-9b measures it).
- `packages/server/turbo.json` — **exists**, written by Q-0122; touched only if this change adds an
  out-of-package read from this package, which it is not expected to.
- `vitest.shared.js:61` — already excludes `**/dist/**`; AC-5 asserts over the emitted file set
  because of it, not instead of it.
- `packages/shared/tsconfig.build.json`'s header — carries the argument and no count.

**Prose**

- `docs/04-architecture.md:70–73`, `:141–142`, `:215`, `:254`, `:294–296`; status line (AC-10, AC-11).
- `docs/GLOSSARY.md` **Build task** (`:193`, `:201`) and **Emitted artifact** (`:204–222`) (AC-12).
- `packages/{cli,core}/tsconfig.build.json` headers and `packages/cli/src/build.test.ts:902` (AC-12).
- `packages/server/src/index.ts`'s barrel docblock — *"this package having no export surface"*
  (AC-11).
- `harness/architecture.md`'s `@quorum/server` row describes the daemon and states no count —
  checked, **no edit owed**. Recorded because it is a run-time context file fed to every agent, so a
  false claim there is one every future requirement inherits (Q-0098's finding).

**Read first**

- *"The emit serves the binary, and no test verdict moves behind it"* (2026-09-02) — (a)'s predicate,
  (b)'s no-`^build` rule, (c)'s derived register, (e)'s `files` clause.
- *"A fourth package emits, and what it emits is served rather than shipped"* (2026-09-12) —
  clause 1's vocabulary, clause 2's non-distribution ruling, clause 3's scoping of 078(a), and its
  Alternatives section, which pre-writes OQ-1's argument.

---

## Provenance

**Recommended candidate: `claude`.** It measured the tree first-hand and its central finding — that
the body's stated deliverable is unreachable inside the ticket's own non-goals, because a link needs
a dependency edge and a dependency edge is a consumer (§0.1) — is the finding that makes this
requirement honest. Its §0.3 (resolved-and-not-distributed has no home in 092's vocabulary), its
`build.test.ts:879` insight, its confirmation of the fourteen call sites, and its OQ-1 argument are
carried substantially unchanged.

**Taken from `codex`:** the clean-mechanism proof — a sentinel under `dist/` removed by a successful
build, and no emitted test module — which claude omitted and which is the only check that
`tsconfig.build.json`'s `exclude` works; folded into **AC-5** rather than left as its own criterion,
because the stray-write and `*.tsbuildinfo` halves are already derived. Its AC-2 (*the public surface
remains the existing index; no subpath*) sharpens **AC-1**. Its AC-7's *"proofs run without first
building"* sharpens **AC-8**. Its AC-10's *"the non-emitter rule remains derived, not a maintained
list"* sharpens **AC-4**. Its AC-14's checkout-independence rule is promoted to the **rule binding
all thirteen** rather than being a fourteenth criterion. Its non-goals list is the tighter of the two
and §4 is built on it. Its risk *"the derived build suite may expose assumptions about four
emitters"* is **R-4**.

**Struck from `codex`:** eighteen criteria against a ceiling of fifteen, and four of them are not
independently testable properties of the change. AC-17 (*run install, build, test, lint, typecheck*)
is a gate obligation and is **GO-2**. AC-18 is the cross-cutting checklist and is **§8**. AC-12
(*every build test that obtains its subject through `emitting()` continues to pass*) restates "the
suite is green" and cannot fail independently of AC-4 and AC-5. AC-11's turbo dry-run claim is
already what `emitting()` derives from, so it folds into AC-2 and AC-4. Its OQ-1 is kept and
**re-ruled**: it treats the entry as a blocker only if the gate finds a contradiction, and §0.3 plus
092's own Alternatives section find one.

**Struck from `claude`:** its AC-5(b) narrative that Q-0121 *"deleted"* `packages/server/turbo.json`
— the file exists, written by Q-0122 (§0.4, Correction 1). Its AC-12's *"the three existing
headers"* — only two carry a count (§0.4, Correction 2). Its thirteen criteria plus the promoted
checkout rule would have been fourteen; the fold of codex's clean-mechanism clause into AC-5 keeps
the merged document at thirteen.

**Neither candidate found**, and added here: `packages/server/src/index.ts`'s own barrel docblock
gives *"this package having no export surface"* as the recorded reason three wire shapes live in
`@quorum/shared`, and `docs/04-architecture.md:254` carries the same premise — a production comment
and a document sentence whose premise this ticket removes while their conclusion must not be
reversed (**AC-11**). Also: `vitest.shared.js:61` already excludes `**/dist/**`, which is why AC-5's
no-test-module clause must read the emitted file set rather than infer from a green suite; and 092's
Alternatives section states, in advance, the argument that its own successor owes an entry.
