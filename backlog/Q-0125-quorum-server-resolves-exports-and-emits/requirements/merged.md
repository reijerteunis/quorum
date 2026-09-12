z# Q-0125 — `@quorum/server` resolves, exports and emits

*Merged requirement, run 1, iteration 2. Written 2026-09-12 against tip `be1b89f`, with
`docs/decisions/` ending at 092. Supersedes `merged-iter-1.md`, which it carries substantially
unchanged and corrects in six places.*

**Verdict: `needs-input`.** One blocker, GO-1 / OQ-1 — a decision entry is owed before a line of
code, and `developer-generalist` may not write one. It is unchanged from iteration 1 and it stands
on the merits, not on a count. Thirteen criteria, inside this role's ceiling of fifteen; §7 carries
the size judgement and the seam.

---

## §0.0 — Iteration 2 opened on an unchanged tree, and says so first

Measured before anything else was written:

| | iteration 1 | iteration 2 |
| --- | --- | --- |
| git tip | `be1b89f` | `be1b89f` |
| highest decision entry | 092 | 092 |
| highest allocated ticket id | Q-0126 | Q-0126 |
| working tree | this run's `requirements/` and `runs.log`, untracked | the same |

Nothing moved. *"A retry on an unchanged tree cannot rule its own blocker"* (Q-0090, Q-0096,
Q-0105) therefore binds: GO-1's entry is work **no step in this flow may perform**, so a second pass
cannot clear it and returning `ready` would be approving a requirement three of whose criteria are
unsatisfiable. This is the sixth ticket here to reach that position — Q-0070, Q-0079, Q-0090,
Q-0096, Q-0105 and Q-0122 — and in every one of them the gate **advanced** rather than retrying,
after the human landed what the loop could not.

What iteration 2 owes instead is what Q-0013's and Q-0122's second passes produced from exactly this
position: **re-run every measurement the previous pass rested a criterion on.** Twelve held. Six did
not, and they are §0.1.

---

## §0.1 — What re-measurement corrected, six things

**Correction A — `packages/server/src` holds NINE test files, not eight.** Iteration 1 wrote
*"eight test files beside eleven production modules"* and used the figure to size AC-5's
no-emitted-test-module clause. Counted: eleven production modules (`broadcast`, `failures`, `gates`,
`host`, `http`, `index`, `read`, `refusal`, `serve`, `static`, `wire`) and **nine** test files
(`broadcast`, `gates`, `host`, `http`, `index`, `package`, `read`, `serve`, `static`). A measured
claim wrong by one, inside the document that instructs an implementer.

**Correction B — the stub set is three today, not four, and becomes two.** `PACKAGES` is seven —
`cli`, `compiler`, `core`, `server`, `shared`, `templates`, `apps/web` — and four emit, so
`test-discovery.test.ts`'s `stubs` is **`packages/compiler`, `packages/server`,
`packages/templates`** today and **two** after this ticket. Iteration 1 stated the after-figure
correctly and never stated the before-figure, which is what makes the clause's change visible.

**Correction C — `test-discovery.test.ts:79` is ALREADY false, in the file AC-4 edits.** Its JSDoc
reads *"A no-op build script in **the four packages that emit nothing** would declare an artifact
that does not exist"*. That was true until Q-0122 and has been wrong by one since — `apps/web` left
the stub set and nobody re-read the sentence. This ticket takes it from a wrong three to a wrong
two. Neither candidate, nor iteration 1, found it. It is the same class as everything else in this
section and it is already on disk.

**Correction D — two `isolate()` consumers carry the count, and iteration 1 listed neither.**
`isolate()` (`packages/cli/test/workspace.ts:184–227`) copies **every emitting package's tracked
files**, mirrors each one's `node_modules`, and re-points the `@quorum` scope at the copy — so a
fifth emitter changes what three fixtures build, not just what a register says. Two of them justify
a timeout budget by a measurement taken over four:

- `packages/cli/src/end-to-end.test.ts:79` — *"Re-derived at Q-0122, when the emitting set became
  four: the copy and the forced build now cover `apps/web` as well, whose `vite build` is 0.3 s
  against the three `tsc` emitters' 2.1 s … so the budget does not move, and the reason it does not
  is a measurement rather than an inference."*
- `packages/cli/src/step-id.test.ts:40` — *"Re-measured at Q-0122, which made the emitting set four
  and so gave this fixture a `vite build` it did not have: 3.3 s for the whole file … The budget
  does not move — the measurement is what says so, rather than the margin being assumed to absorb
  it."*

Both sentences stake the budget on a measurement this ticket invalidates. **The correction is a
re-measurement, not a count bump**, and the comments say so in their own words. This is exactly the
omission Q-0122's iteration 1 made — finding `isolate()`'s consumers by grepping the prose *"three
emitting packages"*, which two files carry and `step-id.test.ts` does not — **reproduced here by
iteration 1 of this ticket**, one ticket after it was written down. A search keyed on a name rather
than on the behaviour, for the seventh recorded time (Q-0051, Q-0067, Q-0073, Q-0107, Q-0108,
Q-0115, Q-0122).

**Correction E — `apps/web` stops being *"the one that is NOT distributed"*, at two register
sites.** `packages/core/src/test-discovery.test.ts:272` says *"`apps/web` is the fourth, and it is
**the one** that is NOT distributed"*, and `packages/core/src/turbo-inputs.test.ts:322`'s `apps/web`
row says *"It is **the one member** of the register that is NOT distributed"*. After this ticket
there are two, and `@quorum/server` is the other. Iteration 1 asked for a fifth `NOT_READ` row and a
five-element identity and never said that the fourth row's and the register comment's own text goes
false.

**Correction F — two more count sites, making the total sixteen.**
`docs/04-architecture.md`'s **status line** carries *"four packages emit and three are packed"* as a
live claim inside a historical explanation, and `docs/GLOSSARY.md:216` carries *"none of the three is
bundled"* — a fifth count clause inside **Emitted artifact** that iteration 1's AC-12 did not
enumerate.

---

## §0.2 — The measurement that reframes the prose half: nothing red-tests the count

Iteration 1 leaned AC-10 and AC-12 on existing `docs.test.ts` slices. Measured, those slices do not
reach:

- **`docs.test.ts:1240–1262` (Q-0122 AC-8)**, over §`apps/web`, asserts `/[Tt]he app emits/`,
  `vite build`, `/served rather than shipped/`, `2026-09-12`, and two negatives refusing the
  superseded wording. **It asserts no number.** Changing `:254`'s *"the emitting set is four"* to
  five, or leaving it at four, is invisible to it.
- **`docs.test.ts:548–562` (Q-0098)**, over the glossary, asserts that both terms are defined, that
  078 is cited by title and date, the two no-synonym clauses, and that `docs/README.md`'s term list
  moves. **It asserts no number either.**
- **`docs.test.ts:1103–1183` (Q-0013 GO-3)**, over §`packages/server`, asserts six claims about the
  run host and none about emission.

So **every one of the sixteen count sites can stay at "four" with the whole suite green.** That is
not an argument for adding a guard per site; it is the argument that AC-12 must assert the counts
**directly and as a classified register**, which is what it now does.

---

## §0.3 — Three things stand between `import '@quorum/server'` and a module, and this ticket may only supply two

Carried from iteration 1, re-measured and unchanged. With a plain `node` process in this checkout:

```
cwd packages/cli     →  import.meta.resolve('@quorum/core')     RESOLVED  …/packages/core/dist/index.js
cwd packages/cli     →  import.meta.resolve('@quorum/server')   ERR_MODULE_NOT_FOUND  Cannot find package
cwd packages/server  →  import.meta.resolve('@quorum/server')   ERR_MODULE_NOT_FOUND  Cannot find package
```

The control is decision 078(b) working: a plain Node process, knowing no `quorum-source` condition,
is sent to the emit. The two failures are a **prior** failure. Link inventory, re-measured:

| directory | `@quorum/*` links present |
| --- | --- |
| `node_modules/@quorum/` | `cli` only — the root declares it so `pnpm exec quorum` finds a `bin` |
| `packages/cli/node_modules/@quorum/` | `core`, `shared` |
| `packages/core/node_modules/@quorum/` | `shared` |
| `packages/server/node_modules/@quorum/` | `core`, `shared` — **pnpm does not self-link** |
| `apps/web/node_modules/@quorum/` | `shared` |

Nothing links `server`, because no manifest declares it as a dependency. *"Cannot find package"* is
the **link** failure, raised before the manifest is opened; the other shape is recorded at
`packages/cli/src/package.test.ts:300–302`, where a linked package with no `exports` map makes
`import.meta.resolve` *throw*, naming Node's legacy `index.js` fall-through. Two messages, two
causes; `@quorum/server` hits the first.

**The consequence for scope.** The non-goals forbid any consumer, and a dependency edge is the only
thing that creates a link — so the body's *"The deliverable is that `@quorum/server` can be imported
by name"* **is not achievable inside this ticket's boundary**, and no criterion could make it so
without adding what the ticket refuses. §1 restates the deliverable accordingly.

---

## §0.4 — The emit is forced, for a reason no landed entry states

078(a)'s predicate is *"Each package that something **outside the workspace** consumes"*.
`@quorum/server` is consumed by nothing outside this workspace and will not be under this ticket or
Q-0126, the local distribution set staying three. It must nonetheless emit, and the chain measures
out exactly as the ticket body gives it: `pnpm exec quorum` runs `packages/cli/dist/quorum.js`; that
is executed by plain Node; `tsconfig.base.json:6`'s `customConditions` and `vitest.shared.js:41,45`
are the only selectors of `quorum-source` and neither is in that process; so a future `packages/cli`
import resolves through **`default`**, which must name a file that exists.

The reason this package emits is therefore **a workspace-internal consumer running outside the
workspace's own conditions** — a third reason beside 078(a)'s *"consumed outside the workspace"* and
092's *"served to a browser"*. Nothing in either entry says it.

---

## §0.5 — `@quorum/server` is the first artifact that is *resolved* and not *distributed*

`docs/GLOSSARY.md:204–222`, as 092 clause 1 wrote it hours ago:

> The **emitting set** is four […] and the **local distribution set** is the first three […]
> `@quorum/web` **is the difference** […] the **resolved** emit of **the three distribution
> packages** […] A **resolved** emitted artifact is not a "bundle" — **none of the three is
> bundled**.

After this ticket every emphasised clause is false in a different way: the emitting set is **five**;
**two** packages are the difference; the *resolved* shape covers **four** packages of which three
are distributed, so the sentence identifying it *by the distribution set* no longer picks it out;
and *"none of the three is bundled"* is a claim about four. 092 could tie *resolved* to *distributed*
because they were the same three packages. This ticket separates them a second time and **in the
other direction from Q-0122**: `@quorum/web` emits and is not resolved; `@quorum/server` is resolved
and is not distributed. That is a change to a term, not a count bump. See **OQ-1**, which is
blocking.

---

## §0.6 — What moves, measured at `be1b89f`

**`packages/core/src/test-discovery.test.ts`.** `emittingPackages()` (`:92–94`) derives from
`PACKAGES`, itself derived from `pnpm-workspace.yaml`'s `packages/*` and `apps/*`, so
`packages/server` is already a member. Three sites move: the four-element identity at `:276`, the
`:272` comment's *"the one that is NOT distributed"*, and `:79`'s already-stale stub count
(Correction C). The stub clause at `:285–303` keeps a subject at two, and its own comment already
records that Q-0122 predicted this clause would fail and it did not — **that prediction is not made
a second time here**.

**`packages/cli/test/workspace.ts:107`'s `emitting()`** is
`dry('build').tasks.filter((task) => task.command !== NO_SCRIPT)` — derived, needing no edit — and is
reached at **fourteen** call sites in `packages/cli/src/build.test.ts`: `:144`, `:360`, `:558`,
`:584`, `:603`, `:624`, `:635`, `:667`, `:712`, `:884`, `:904`, `:951`, `:956`, `:1140`, with a
fifteenth occurrence at `:654` inside a comment. **Confirmed line for line**, which is worth
recording because that figure was thirteen a day earlier and the ticket body says so: re-deriving
was the right instruction and the answer did not move again.

**`isolate()` (`workspace.ts:184–227`)** copies each emitting package's tracked files, refuses a
package git tracks nothing under, mirrors `node_modules` per level as real directories of symlinks,
and re-points `@quorum/*` at the copy through `directoryOf`. A fifth emitter is picked up derived —
and it changes what **three** fixtures build: `build.test.ts`, `end-to-end.test.ts` and
`step-id.test.ts` (Correction D).

**`packages/cli/src/build.test.ts:879–898`** — *"the emit carries the declarations the export maps
promise"* — loops `emitting()` and at `:888` does `if (entry === undefined) continue;`. `apps/web` is
the only emitter that `continue`s past it today, so **a fifth emitter declaring a map is the first
package that assertion has covered since Q-0097**. `:900–908` (no `*.tsbuildinfo`) covers it
unconditionally, as do the derived stray-write audits at `:603` and `:635`.

**`packages/server/src/package.test.ts:138–155`** — *"it emits nothing: no build task, no exports
map, no files allow-list, no bin"* — holds nine assertions. **Two invert** (`scripts.build`,
`exports`); **seven survive** (`main`, `types`, `files`, `bin` undefined; `name`; `private: true`;
`type: 'module'`), because `@quorum/core`'s and `@quorum/shared`'s shape puts `types` and `default`
*inside* the conditional map and declares no top-level `main` or `types`. Its comment already
reasons about both registers and ends *"a package that emits nothing and ships nothing is out of
both"* — which is the sentence that moves.

**`packages/server/turbo.json` EXISTS**, written by Q-0122 at `b0bdf70`, declaring
`../../apps/web/src/routes.ts` and `../../apps/web/vite.config.ts` for `src/static.test.ts`. Both
candidates and this repository's plan bullet for Q-0121 say that file was written, measured
unnecessary and **deleted** — that is Q-0121's file, and this one's own header records the deletion
as history. An implementer told it was deleted creates a second one instead of reading the one that
is there. **Inherited accounting that rotted inside a day, twice on this ticket now.**

**Turbo hashes, predicted rather than declared.** `packages/core/turbo.json` already declares
`../../packages/*/package.json`, and the root `test` task's `^test` edge carries `@quorum/core#test`
into `@quorum/cli#test`; `packages/server/turbo.json`'s own header records the same mechanism
working for `docs/04-architecture.md` through `@quorum/shared#test`. So an edit to
`packages/server/package.json` is **expected** to move both hashes with no new declaration. AC-9
measures it both ways and records the hashes; it does not assert the prediction.

**`packages/server` is not a collected literal today.** `git grep` over the two `SUITES`
(`@quorum/shared#test`, `@quorum/core#test`) finds the string only inside longer literals
(`'### \`packages/server\`'`) and inside doc comments, which `pathLiterals` does not collect. Putting
`'packages/server'` into the register at `:276` creates a **new** collected literal, so a fifth
`NOT_READ` row is owed.

**The emitted-test hazard is double-guarded, so it must be asserted directly.**
`vitest.shared.js:61` is `exclude: [...configDefaults.exclude, '**/dist/**']` — Q-0097 AC-23 — and
that file's own comment names `tsconfig.build.json`'s `exclude` as the primary mechanism and itself
as *"defence in depth"*. With **nine** test files in `packages/server/src`, a missing `exclude`
would emit nine `.test.js` files that a green suite would say nothing about. AC-5 therefore asserts
over the emitted file set rather than inferring from a passing run.

**`packages/cli`'s build script is not byte-identical to the other two.** It is
`rm -rf dist && tsc -p tsconfig.build.json && chmod +x dist/quorum.js`; `@quorum/core`'s and
`@quorum/shared`'s are `rm -rf dist && tsc -p tsconfig.build.json`. AC-2 takes the latter and its
agreement clause is over `tsconfig.build.json` contents, never over the scripts — stated so nobody
invents an all-scripts-identical clause that `chmod` falsifies.

---

## §0.7 — The impossibility this ticket removes is load-bearing, and its practical half survives

`docs/04-architecture.md:70–74`:

> `apps/web` cannot import `@quorum/server` at all: **it has no `exports` map**, and a value import
> from a browser bundle would pull `hono`, `@quorum/core` and Node builtins in with it, **where a
> guard is weaker than an impossibility**.

The conclusion survives — `packages/server`'s eleven production modules import `node:fs`,
`node:path`, `node:url` and `node:http` — and the **reason** does not, and with it the claim that the
barrier is an impossibility rather than a guard.

**The practical half is already guarded, measured rather than assumed.**
`apps/web/test/package.test.ts:91` asserts `Object.keys(JUSTIFICATIONS).sort()` against the declared
manifest **in both directions**, and a second clause pins `dependencies` to exactly
`['@quorum/shared','react','react-dom']`. Adding `"@quorum/server"` to `apps/web` fails two
assertions today, with no change from this ticket. So what is owed is the **document correction**
(AC-11), not a new guard.

**Two source sites carry the same premise**, and neither candidate found either:
`packages/server/src/index.ts`'s transport docblock gives *"this package having no export surface"*
as the recorded reason `WireMessage`, `WireRefusal` and `WireRun` live in `@quorum/shared`, and
`docs/04-architecture.md:254` repeats it as *"without giving the server package a browser-facing
export surface"*. `.claude/rules/engineering.md` forbids a comment claiming what the code cannot
back, and in both places the **conclusion** must not be reversed — a moved type with no schema is the
half-measure Q-0120 had to repair. So the reason moves and the arrangement stays.

---

## §1 — Problem

The daemon and the web bundle both exist and nothing in this product can start them.
`packages/server` has been written, reviewed and shipped across five tickets — Q-0013, Q-0118,
Q-0119, Q-0121 and Q-0122's static route — and it is still a package that no line of code outside its
own directory can name. Q-0122's own gate met this by accident: an end-to-end probe of the static
route, written as a plain `node` script importing `@quorum/server`, died with `ERR_MODULE_NOT_FOUND`
and had to be re-run under Vitest.

The package declares no `exports`, no `main`, no `types` and no `build` script — the first three
verbatim the state Q-0096 measured for `@quorum/core`, the fourth what Q-0097 then added there. It
publishes no public surface and produces no artifact, and the cost is recorded in the package's own
source: three wire shapes were moved to `@quorum/shared` at Q-0120 and Q-0121 because *"this package
having no export surface"* made them unreachable from the only other end of their own socket.

**The deliverable, restated on §0.3's measurement:**

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
four registers, sixteen count-bearing sentences and two documents.

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
(2026-08-30). Codex's AC-14, promoted to a rule because it is a property of all thirteen.

---

**AC-1 — `@quorum/server` declares a conditional `exports` map of the shape `@quorum/core` and
`@quorum/shared` declare, publishing `"."` and no subpath pattern.**

`exports["."]` carries `quorum-source` → `{ types: './src/index.ts', default: './src/index.ts' }`,
then `types` → `./dist/index.d.ts`, then `default` → `./dist/index.js` — the map measured verbatim in
both sibling manifests. No `main` and no top-level `types` are added: resolution goes through the
map, which is what `customConditions` makes `tsc` read too. The public surface stays exactly what
`packages/server/src/index.ts` already exports; no internal module becomes reachable by subpath.

*Test:* in `packages/server/src/package.test.ts`, over the package's own manifest — the three
condition branches asserted by value, plus `Object.keys(own.exports)` is exactly `['.']` and no key
contains `*`, which is the refusal `packages/cli/src/package.test.ts:509–512` already makes for
`@quorum/core`. Shown red by deleting the `quorum-source` branch, which must fail with a message
naming that condition rather than a generic shape mismatch.

---

**AC-2 — The package declares a `build` script and a `tsconfig.build.json`, and the four such files
in the workspace agree.**

`"build": "rm -rf dist && tsc -p tsconfig.build.json"` — `@quorum/core`'s and `@quorum/shared`'s
exactly, and deliberately **not** `@quorum/cli`'s, which appends `&& chmod +x dist/quorum.js` for a
`bin` this package does not have. `packages/server/tsconfig.build.json` extends `./tsconfig.json` and
declares exactly `outDir: "dist"`, `rootDir: "src"`, `declaration: true`, `noEmit: false`, with
`include: ["src/**/*.ts"]` and `exclude: ["src/**/*.test.ts"]`, and neither `incremental` nor
`composite`. `packages/server/tsconfig.json` — which is `{ "extends": "../../tsconfig.base.json" }`
and nothing else — is **not** touched, that being what ESLint's `projectService` and `typecheck`
read.

*Test:* two clauses. (a) The script matches `/^rm -rf dist && tsc -p tsconfig\.build\.json$/`.
(b) The `compilerOptions`, `include` and `exclude` of every `tsconfig.build.json` under `packages/**`
and `apps/**` are compared with each other and must be equal — **derived by globbing for the file
rather than from a list of package names**, so a sixth arrives in the comparison without anyone
remembering. Shown red by changing `rootDir` in one of the four. The clause is over the
configuration files and never over the build scripts, `@quorum/cli`'s `chmod` being a real and
correct divergence.

*Why this is uniformity rather than mechanism:* `rm -rf dist` is the whole clean mechanism for a
`tsc` emitter, turbo pruning an output directory on neither the miss path nor the hit path.

---

**AC-3 — The package emits and is not distributed, and the guard that said it does neither is
re-aimed rather than deleted.**

`private: true` stays; `files`, `main`, `types` and `bin` stay absent.
`packages/server/src/package.test.ts:138–155` keeps its **seven** surviving assertions — `main`,
`types`, `files` and `bin` undefined, `name`, `private`, `type` — loses the two on `scripts.build`
and `exports`, and its title and comment stop claiming the package emits nothing. Its closing
sentence *"a package that emits nothing and ships nothing is out of both"* is what has to move: this
package is now in one of the two registers and not the other.

*Test:* the four surviving `toBeUndefined()` keys asserted by name; `private` `true`; `type`
`module`; and the block shown red in **both** directions — by restoring
`expect(own.exports).toBe(undefined)`, and by adding `files: ["dist"]` to the manifest, which must
fail with a message naming **distribution** rather than emission. The second half is what stops AC-3
being read as *"delete the assertions that now fail"* (R-7).

*Authority:* 092 clause 2 ruled `apps/web`'s non-distribution **by name**. That it extends to a
second package is OQ-1's and must be in the entry GO-1 asks for, not assumed here.

---

**AC-4 — The emitting register is five, still derived, its stub clause still discriminates, and
neither of its two comments still calls `apps/web` the only non-distributed emitter.**

`packages/core/src/test-discovery.test.ts:276` becomes the five-element identity in the same sorted
order — `['apps/web','packages/cli','packages/core','packages/server','packages/shared']`. Three
comments in that file move: `:272`'s *"`apps/web` is the fourth, and it is **the one** that is NOT
distributed"*, which after this ticket names one of two; `:79`'s *"the four packages that emit
nothing"*, which is **already wrong by one today** (Correction C) and becomes two; and the register
comment, which records that the emitting set is five and the local distribution set three and cites
the entry GO-1 lands. `stubs` stays derived by subtraction and is not replaced by a maintained list.

*Test:* the identity assertion over `emittingPackages()`, plus the existing
`expect(stubs.length).toBeGreaterThan(0)` anti-vacuity clause, whose remaining members — **two**,
`packages/compiler` and `packages/templates`, down from three today — are named in the comment. Shown
red by removing the `build` script from `packages/server`, which must fail the identity clause and
**not** the stub clause, so the two are proven to discriminate different things.

*Not predicted a second time:* that file's own comment records that Q-0122's requirement predicted
the stub clause would go red and it did not, because `stubs` is derived by subtraction. The same
prediction is therefore **not** made here, and the criterion asks only that the clause keep a
subject.

---

**AC-5 — The build writes the emit and nothing else, from a clean start.**

Starting from a `packages/server/dist/` holding a sentinel file, a successful build removes it. The
resulting directory holds the JavaScript and declaration counterparts of the **eleven** production
modules and holds **no emitted test module, no `.test.d.ts`, no copied `*.test.ts` and no
`*.tsbuildinfo`**.

*Test:* in `packages/cli/src/build.test.ts` against an isolated copy, so the verdict is the commit's.
The no-test-module clause asserts over the **emitted file set** and not over a passing suite:
`vitest.shared.js:61` already excludes `**/dist/**` and its own comment calls that *"defence in
depth"* behind `tsconfig.build.json`'s `exclude`, so **nine** emitted `.test.js` files would be
invisible to every green run. The `*.tsbuildinfo` clause is `build.test.ts:900–908`, which needs no
change; the stray-write audits at `:603` and `:635` pick the new member up from `emitting()`
automatically and are named here so nobody edits them. Shown red by removing `exclude` from the new
`tsconfig.build.json`, which must produce nine emitted test modules rather than none.

---

**AC-6 — The declarations the map promises exist, and the new package is inside the loop that checks
them rather than skipped by it.**

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
the package, a plain `node` process — no `--conditions`, no loader, no Vitest, no TypeScript runner —
resolves `@quorum/server` to a URL ending `/dist/index.js`. **The synthesised link is named, in the
test's own comment, as standing in for the dependency edge this ticket may not add** (§0.3), so
nobody later reads it as proof that the name resolves from the workspace as it stands.

(b) **Execution.** The same plain process imports the built `dist/index.js` by absolute `file://`
URL and succeeds — which is what proves `hono`, `@hono/node-server`, `@hono/node-ws`, `@quorum/core`
and `@quorum/shared` all resolve through their own `default` conditions from the emitted module's
location. Resolution alone is not enough, and the reason is
`packages/cli/src/package.test.ts:300–302`'s: `import.meta.resolve` answers from the manifest without
the target existing.

(c) **Identity.** The namespace that import returns carries exactly the runtime export names the
source barrel declares, **derived from `packages/server/src/index.test.ts:20`'s `SURFACE` register
rather than retyped** — the register that file already asserts `Object.keys(server)` against at
`:87`, and which its own header calls *"a register of names and not a length, because a count passes
while a name is swapped for another"*. Carried with a throw-on-empty guard so a derivation that
matched nothing cannot make the clause vacuous.

*Test:* this criterion lands in `packages/cli/src/build.test.ts`, which owns `runBuild`,
`removeEmit`, `isolate` and the plain-Node helper, and **not** in `packages/server`'s own suite — a
test asserting the emit exists without running the build takes its verdict from the checkout, `dist/`
being gitignored. Shown red by deleting one export from the barrel, which must fail (c) naming the
missing symbol.

---

**AC-8 — No verdict that exists today moves behind the new emit.**

Decision 078(b) is untouched: `test` and `typecheck` gain no `^build` edge, no package's `lint`,
`typecheck` or `test` script builds anything first, and the workspace suites go on proving TypeScript
source. All resolution proofs for the source condition run **without** building `packages/server`.

*Test:* three clauses. (a) Root `turbo.json`'s tasks are read out of the file rather than from a
literal, and `test` declares `dependsOn: ["^test"]` and `typecheck` `["^typecheck"]` — both measured
exactly so today, with `build` alone carrying `["^build"]` and `outputs: ["dist/**"]`. (b)
`exports['.']['quorum-source'].default` is `./src/index.ts`. (c)
`packages/server/src/package.test.ts:176–177` — `import.meta.resolve('@quorum/core')` contains
`/packages/core/src/index.ts`, and the same for `@quorum/shared` — is **unchanged and still passes**,
which is the evidence that adding an emit to this package moved no verdict inside it. Shown red by
adding `"^build"` to the root `test` task.

---

**AC-9 — The turbo census gains its fifth `NOT_READ` row, the fourth row stops claiming to be the
only one, and the hash question is measured rather than answered by reflex.**

(a) `packages/core/src/turbo-inputs.test.ts`'s `NOT_READ` (`:311`) gains `'packages/server'`, with
the `apps/web` row's reasoning in its own words: the literal is a member of the emitting-set
register, which is data derived from manifests reached through the `packages` walk `WALKS` already
declares, and nothing opens the directory. **And the `apps/web` row at `:322` loses its
*"It is the one member of the register that is NOT distributed"* clause**, which this ticket makes
false (Correction E). No row is deleted to make the census pass.

(b) Whether `@quorum/core#test` and `@quorum/cli#test` are invalidated by an edit to
`packages/server/package.json` is **measured**, both hashes recorded, and an input declared **only if
the measurement says one is needed**. *Predicted and to be confirmed:* `packages/core/turbo.json`
already declares `../../packages/*/package.json` and the root `^test` edge carries it into
`@quorum/cli#test`, so nothing is expected to be owed, and declaring it anyway would be the same
claim twice, free to drift — which is the measurement Q-0121's implement step made and acted on.
**`packages/server/turbo.json` already exists** (Q-0122, `b0bdf70`) and declares two `apps/web`
reads; if this change adds an out-of-package read **from** this package it is added there, and if it
adds none the file is left alone. The account saying that file was deleted is Q-0121's and is stale
(§0.6).

*Test:* (a) removing either row's change fails `turbo-inputs.test.ts` — the new key by clause B
naming `packages/server`, the reworded row by the register's own assertion — and the existing
dead-key clause still passes, proving the new key is a literal the scan collects. (b) is a reported
measurement with both hash values, in the implement report and in a comment beside whatever it
decides — not an assertion.

---

**AC-10 — `docs/04-architecture.md` says the package emits and is not distributed, in the section
that describes it.**

`:141–142`'s *"and it emits nothing: the local distribution set is three packages"* is replaced by
the sentence §`packages/core` already models at `:64` — the package publishes its API through a
conditional `exports` map and emits the artifact the map's default condition names — together with
what 092 separated: it emits and is **not** distributed, so no tarball carries it and a packed
`@quorum/cli` importing it would be broken, which is Q-0124's and not a silence. The status line
records Q-0125 and `2026-09-12`.

*Test:* `packages/shared/src/docs.test.ts`'s existing Q-0013 GO-3 slice of §`packages/server`
(`:1103–1120`) gains clauses — the section no longer matches `/it emits nothing/`, it names the
emitting set and the distribution set as **different sizes**, and the status-line clause names this
ticket and its date, in the shape the Q-0014 AC-11 block at `:1221–1229` already uses. The slice's
anti-vacuity guard (`:1113`, *"this check has lost its subject"*) and its
`toBeGreaterThan(1000)`/ran-past-the-end clauses are unchanged. Shown red by reverting the `:141`
sentence.

---

**AC-11 — Nothing states *"no `exports` map"* or *"no export surface"* as the reason two arrangements
exist, and each names what actually holds.**

Three sites, one rule. `docs/04-architecture.md:70–74`'s *"it has no `exports` map […] where a guard
is weaker than an impossibility"* keeps its conclusion and loses its reason: a value import would
pull `hono` and four Node builtins into a browser bundle, and `apps/web`'s own `JUSTIFICATIONS`
register refuses the dependency **in both directions** — so after this ticket it *is* a guard, and
saying so is cheaper than leaving a reader to discover it. `docs/04-architecture.md:254`'s *"without
giving the server package a browser-facing export surface"* moves with it.
`packages/server/src/index.ts`'s transport docblock, which gives *"this package having no export
surface"* as the reason `WireMessage`, `WireRefusal` and `WireRun` live in `@quorum/shared`, keeps
that arrangement and states the reason that survives: a browser may not import this package, and a
moved type with no schema is the half-measure Q-0120 had to repair.

*Test:* the §`packages/server` slice no longer matches `/it has no .?exports.? map/` and names the
register that refuses the dependency; a source clause in `packages/server/src/package.test.ts`
asserts the barrel's docblock does not match `/no export surface/` **while still naming
`@quorum/shared` as the owner of the three shapes**, so the conclusion cannot be deleted along with
the premise. Shown red by restoring either sentence. **No new guard is added in `apps/web`** — §0.7
measured the existing one fails closed both ways, and a second enforcer of one rule is the drift this
repository keeps finding.

---

**AC-12 — Every statement of the emitting set's size is classified live or historical, and no live
one contradicts the register.**

Sixteen sites carry a count today and **no test asserts any of them** (§0.2), so this criterion is
the only thing between a five-emitter workspace and sixteen sentences saying four. They are not all
the same kind, and blanket replacement would be wrong: *"Q-0122 made the emitting set four"* is a
true record of a past change, in the same way a decision entry describing the spike stays true of
when it was written. So each site is classified, and the classification is the deliverable.

**Live — the claim is about the present and moves:**
`docs/04-architecture.md` status line (*"four packages emit and three are packed"*), `:215`, `:254`,
`:294–296` and its *"`@quorum/web` is the fourth"* clause; `docs/GLOSSARY.md:193` (**Build task**,
*"the four packages that emit"*), `:206` (*"The **emitting set** is four"*), `:208`
(*"`@quorum/web` is the difference"*), `:212` (*"the **resolved** emit of the three distribution
packages"*) and `:216` (*"none of the three is bundled"*); `packages/cli/tsconfig.build.json` and
`packages/core/tsconfig.build.json`'s *"the emitting set is four **now**"* clause — two headers, not
three, `packages/shared`'s carrying the argument and no number;
`packages/cli/src/build.test.ts:902` (*"the three `tsconfig.build.json` files"*);
`packages/core/src/test-discovery.test.ts:79` (**already wrong today**) and `:272`;
`packages/core/src/turbo-inputs.test.ts:322`'s *"the one member … NOT distributed"* clause.

**Historical — the claim is about what a past ticket did and stays:** the same two `NOT_READ` and
`end-to-end.test.ts` / `step-id.test.ts` sentences **where they name what Q-0122 changed**; every
`docs/decisions/` entry, which is append-only and is not edited at all.

**Re-measured rather than re-worded:** `packages/cli/src/end-to-end.test.ts:79` and
`packages/cli/src/step-id.test.ts:40` stake a timeout budget on a measurement taken over four
emitters, and `isolate()` copies and builds every emitting package — so a fifth changes what those
budgets absorb. Each comment says in its own words that *"the measurement is what says so, rather
than the margin being assumed to absorb it"*, so each is re-measured and its figures updated, or the
budget moves. GO-3.

*Test:* a register of the sites with a verdict each, asserted two ways: every `live` site no longer
matches its superseded spelling, and every `historical` site still does — so a blanket replacement
fails as loudly as an omission. Anti-vacuity in the shape `docs.test.ts:1256–1261` already uses: the
same needles are run against a fixture reproducing the superseded wording, so a clause that matched
nothing is distinguishable from one that refused something. The `tsconfig.build.json` half counts the
files under `packages/**` and `apps/**` and asserts no file under those roots states a different
number, **derived from the count rather than matching a literal**. Shown red by leaving any live site
at four and by rewriting any historical one.

*No term is coined and none retired*, so neither 22-term list moves and `CLAUDE.md` stays the human's
(Q-0103 erratum E-2). Counted programmatically at **22 in both, identical and in the same order**,
2026-09-12.

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
2. **Whether `@quorum/server` is distributed.** Q-0124's, and after this ticket that question governs
   **two** packages rather than one. The package stays `private: true` with no `files`, exactly as
   `@quorum/web` does. A packed `@quorum/cli` importing it would be broken for the `workspace:*`
   reason Q-0098's M-8 measured; that becomes urgent at Q-0126 and is not urgent here, this ticket
   adding no importer.
3. **Moving decision 078(b).** No `^build` edge on `test`, `typecheck` or `lint`; AC-8 asserts it.
4. **Widening or narrowing the barrel.** `packages/server/src/index.ts` gains and loses no export;
   AC-7(c) pins the runtime register against the emit. Whatever Q-0126 needs, this package already
   exports it.
5. **Any behaviour change in the daemon** — no route, no host method, no wire shape, no port, no
   bind, no static-serving change.
6. **Subpath exports**, and `main` / top-level `types` compatibility fields. AC-1 publishes `"."`
   alone; OQ-3 records why the legacy fields are omitted.
7. **A new guard in `apps/web` against importing the daemon.** §0.7 measured the existing register
   fails closed in both directions.
8. **`packages/compiler` and `packages/templates`.** They stay the two stubs that make AC-4's
   anti-vacuity clause discriminate.
9. **The root `devDependencies`.** Adding `@quorum/server` beside `@quorum/cli` would make AC-7(a)
   easier and would be a dependency declared for a test's convenience — OQ-2.
10. **A bundler, a new dependency or a second build system.** `tsc` is already the typecheck gate,
    and 092 clause 3 scoped 078(a)'s *"no bundler"* to the `tsc` emitters — of which this is one.
11. **Closing `turbo-inputs.test.ts`'s blindness to `packages/server`.** R-5; the residual is
    `packages/server/turbo.json`'s own header's and predates this ticket.
12. **Editing any `docs/decisions/` entry.** Append-only; 092's clause 1 is corrected by a successor
    entry, never in place — which is what OQ-1 is about.

---

## §5 — Open questions

**OQ-1 (BLOCKING, unchanged from iteration 1 and re-argued against an unchanged tree) — Does this
ticket owe a decision entry?**

The ticket body says *"the shape is now precedented, which is an argument that it does not"*; codex
reads it as a blocker only if the gate finds a contradiction. There is one, and three things no
landed entry states:

1. This package emits for a reason 078(a)'s predicate does not cover — a **workspace-internal**
   consumer running under plain Node, not *"something outside the workspace consumes it"* (§0.4).
2. It is the first artifact that is **resolved and not distributed**, a combination 092's own
   vocabulary forecloses by defining *resolved* as *"the resolved emit of the three distribution
   packages"* and by adding *"none of the three is bundled"* (§0.5).
3. 092 clause 2 ruled non-distribution **for `apps/web` by name**, not as a class, so a second
   non-distributed emitter extends that ruling rather than instancing it — which is why two landed
   registers currently call `apps/web` *"the one"* (§0.1, Correction E).

**Recommendation: an entry is owed, and 092 itself makes the argument decisive.** Its Alternatives
section refuses *"Say nothing and let the register catch it"* in these words: *"A guard firing is the
beginning of a decision, not a substitute for one — and this entry exists because an emitting set of
four falsifies three clauses of the glossary and two of 078, none of which a red test can rule."* An
emitting set of **five** falsifies clause 1 of 092 — and §0.2 measures that no red test rules any of
it either, which is the same argument one ticket on. AC-3, AC-4 and AC-12 edit sentences that entry
wrote **in its own Decision clause**, hours ago; editing them without a new entry is contradicting a
landed entry silently, which `.claude/rules/docs-and-decisions.md` forbids in as many words.

The counter-argument, recorded because it is real: this is a widening and a count rather than a
reversal, 092 anticipated a fifth emitter, and an entry per emitter is a tax. It does not survive the
fact that clause 1's own words have to move.

**The entry is `developer-generalist`-forbidden** (`harness/roles/developer-generalist.md:23`), so it
is the human's at the gate — which is GO-1 and is why this is blocking rather than advisory. What it
must rule: the emitting set is five and the distribution set three; *resolved* is defined by what Node
does rather than by what is packed; whether 078(a)'s predicate is narrowed or extended; and OQ-3's
`files` ratification.

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

**OQ-4 — Does the ticket's title survive §0.3?** *"resolves, exports and emits"* claims three things
and the first is not this ticket's to deliver. **Recommendation: the title stays and §1 carries the
correction** — a title is not a criterion, and renaming a `p1` ticket mid-flight moves citations in
the plan, in Q-0124 and in Q-0126 for no behaviour. Stated so the gate can disagree cheaply.

---

## §6 — Gate obligations

**GO-1 (blocking, before a line of code) — OQ-1's decision entry is landed, or OQ-1 is ruled the
other way in writing.** AC-3, AC-4 and AC-12 are unsatisfiable without the ruling, and an implement
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

**GO-3 — Three build-time measurements are recorded, not one.** Q-0122 recorded 2.5 s and four tasks
for the fourth emitter; this ticket records (i) the forced whole-workspace build before and after,
(ii) `packages/cli/src/end-to-end.test.ts`'s whole-file time against its 90 s budget, and (iii)
`packages/cli/src/step-id.test.ts`'s against its 180 s budget — because `isolate()` now copies and
builds a fifth package in both fixtures and both comments stake their budget on a measurement rather
than on margin (§0.1, Correction D). A cold-clone cost assumed to be small is a shape this repository
has been wrong about before.

**GO-4 — If R-1 fires, the remedy is an explicit type annotation and is reported, never a dropped
`declaration` or a widened `skipLibCheck`.** Recorded at the gate so a round does not spend itself
choosing.

---

## §7 — Size, and the seam if it is ever needed

**Thirteen criteria, and the ticket does not split.** The seam a reader will reach for is
implementation (AC-1 to AC-9) against documentation (AC-10 to AC-12), and it is refused:
`.claude/rules/docs-and-decisions.md` requires the documents fixed in the same change as the code, and
AC-10 to AC-12 are the *deliverable* of GO-1's entry rather than housekeeping beside it. Splitting
would land a five-emitter workspace whose glossary says four — the exact drift 092 was written to
close, made worse by §0.2's measurement that no test would report it.

**Named in advance rather than discovered, on Q-0122's E-1 precedent:** if the revise loop exhausts
on the prose half, the remedy is an erratum at that gate splitting AC-10 to AC-12 into a successor —
**not** a fourth implement round. **AC-1, AC-7 and AC-13 are not eligible for trimming**: the first is
the deliverable, the second is the only proof that the artifact runs, and the third is what keeps the
ticket inside its own boundary. **AC-12 is not eligible either**, for a reason measured rather than
asserted: it is the only criterion whose subject no existing guard reaches.

---

## §8 — Cross-cutting checklist

| | |
| --- | --- |
| **BYOS** | n/a to the change, and not vacuously: `packages/server` carries no credential path and no environment read for a key, and `apps/web`'s credential scan is untouched. No test, fixture or example gains a key. |
| **Worktree safety** | n/a. No flow writes anything here; no code path touches `.harness/worktrees/` or the user's working tree. |
| **Gate behaviour** | n/a. No flow, no gate, no `auto`, no `human-locked` clause moves. |
| **File format and schema** | No schema and no persistent file format changes. `packages/shared`'s zod schemas are untouched; AC-7(c) pins the barrel's runtime register against `index.test.ts`'s `SURFACE`, so no exported shape moves. The two files that gain structure — `package.json` and a new `tsconfig.build.json` — are AC-1's and AC-2's. |
| **Adapter contract** | n/a. No adapter, no vendor-specific behaviour, no `capabilities.ts`. |
| **Lint rules** | Unaffected by construction: `tsconfig.build.json` is a **second** project and `packages/server/tsconfig.json` — `{ "extends": "../../tsconfig.base.json" }`, the one ESLint's `projectService` and `typecheck` read — is not touched, so the single type-aware rule (`@typescript-eslint/no-deprecated`, Q-0069) keeps its project. |
| **Flow lint** | n/a. No flow file changes. |
| **Cold-clone impact** | One added build task on the workspace-local path, plus a fifth package in two isolated fixtures; R-3, measured at the gate under GO-3. The packed path is unchanged, this package being in no tarball. |
| **Product-agnostic** | n/a. Nothing here names a product. |
| **Decision entries** | One, blocking — OQ-1 / GO-1. `developer-generalist` may not write it. No entry is edited: 092 is corrected by a successor. |
| **Glossary** | Two existing entries re-derived (AC-12). **No term coined, none retired**, so neither 22-term list moves and `CLAUDE.md` stays the human's. Both counted at 22, identical and in order, 2026-09-12. |

---

## §9 — Risks

**R-1 — Declaration emit may not be free, and it has never been run.** `declaration: true` requires
every exported value's type to be nameable from the emitting package. Measured mitigations already in
place: `createApp`, `mountRead` and `mountStatic` annotate `Hono` **explicitly** rather than inferring
it, and `hono` is a direct dependency, so `import("hono").Hono` is nameable. **Predicted low, and
deliberately not measured here** — `tsc -p tsconfig.build.json` has never run in this package, and
running it writes `dist/`, which is the implement step's act and not a requirement's. If it fails with
TS2742 or TS4023, the fix is an explicit annotation on the affected export; it is **not** dropping
`declaration`, which breaks AC-1's `types` condition, and **not** `skipLibCheck`, already on and not
the mechanism. GO-4.

**R-2 — The ticket ships an emit nothing imports.** Accepted deliberately, and it is Q-0121's R-1 one
package over: under the ruled scope there is no user-visible consumer, and the alternative — bundling
Q-0126 — is what turned Q-0013 into three tickets and Q-0014 into two. What makes it acceptable rather
than speculative is that AC-7 proves the artifact **runs**, so the consumer inherits a measured
surface instead of discovering one.

**R-3 — Build time on the cold-clone path, and in two fixtures.** `pnpm turbo run build` is on the
workspace-local installation path this repository claims and tests, so any increase lands inside M6's
thirty minutes. Q-0122 took the forced whole-workspace build from three tasks to four and 2.5 s; a
fifth `tsc` emitter over eleven production modules is expected to be cheaper than a Vite bundle,
**which is a prediction to measure and not a claim**. It serialises after `@quorum/core` and
`@quorum/shared` through `dependsOn: ["^build"]` and nothing depends on it, so it cannot lengthen
anyone else's chain. **The half iteration 1 missed**: `end-to-end.test.ts` and `step-id.test.ts` both
build an isolated copy of every emitting package inside their own budgets, so the cost lands there
too. GO-3 measures all three.

**R-4 — The derived build suite may still encode four.** The fourteen `emitting()` call sites are
derived and pick the fifth member up automatically, but an assertion, a comment, a `NOT_READ` row or a
fixture may encode the old count or assume every `tsc` emitter is distributed. **Each failure is
classified against the five-emitter / three-distribution boundary rather than patched by weakening the
census.** Sixteen such sites are enumerated in AC-12 and Appendix A — and §0.2 measures that a red test
will report **none** of them, which is why AC-12 asserts rather than waits.

**R-5 — `turbo-inputs.test.ts` does not scan `packages/server`.** Its `SUITES` are
`@quorum/shared#test` and `@quorum/core#test`, which `packages/server/turbo.json`'s own header records
as the standing residual: *"a later read out of this package is covered by nobody's guard."* This
ticket adds no out-of-package read from it, so it neither closes the gap nor widens it — stated so the
residual is not later attributed here.

**R-6 — A pre-existing hash gap, named so it is not confused with this ticket's.**
`packages/cli/turbo.json`'s `DECLARED` names `../../packages/*/src/**` and
`../../packages/*/turbo.json` and **not** `../../packages/*/package.json`, so `build.test.ts`'s
manifest reads reach `@quorum/cli#test` only through `@quorum/core#test`'s own declaration and the
`^test` edge. That is true today of `apps/web` and becomes true of `packages/server`. AC-9(b) measures
it; it is not this ticket's to close.

**R-7 — A guard that inverts is a guard that can be deleted instead.** AC-3 and AC-4 both invert
assertions that pass today, and the cheapest wrong implementation of either is to delete the failing
clause. Both therefore demand a red demonstration **in both directions** — the failure
`q0050.source.test.ts`'s fail-open array (Q-0051) and Q-0093's per-package register each cost a round.
AC-12 has the same hazard in its own form: deleting a historical sentence is as wrong as leaving a
live one, which is why its register asserts both directions.

**R-8 — Q-0126 inherits an unresolved distribution question, and must not paper over it.** This ticket
adds no consumer, so the packed CLI is not broken by it. Q-0126 must not add the runtime import
without Q-0124's decision, which now governs **two** packages.

---

## Appendix A — Every site that moves, measured 2026-09-12 at `be1b89f`

Given so an implementer does not re-derive it, and given with the instruction to **re-measure the line
numbers before editing**: the `emitting()` count in this ticket's own body was thirteen and was
fourteen a day later; both candidates and this repository's plan say `packages/server/turbo.json` was
deleted and it is on disk; and iteration 1 of this very document was wrong in six places (§0.1).

**Manifests and configuration**

- `packages/server/package.json` — `exports` map (AC-1), `build` script (AC-2).
- `packages/server/tsconfig.build.json` — new (AC-2).

**Registers that go red**

- `packages/core/src/test-discovery.test.ts:276` — the four-element identity → five (AC-4).
- `packages/core/src/test-discovery.test.ts:285–303` — the stub clause; subject **three → two**.
- `packages/core/src/turbo-inputs.test.ts:311` — `NOT_READ` gains a fifth row (AC-9a).
- `packages/server/src/package.test.ts:138–155` — two assertions invert, seven survive (AC-3).

**Count-bearing sentences, classified (AC-12)**

*Live, and they move:* `docs/04-architecture.md` status line, `:215`, `:254`, `:294–296`;
`docs/GLOSSARY.md:193`, `:206`, `:208`, `:212`, `:216`;
`packages/cli/tsconfig.build.json:6–7` and `packages/core/tsconfig.build.json:6–7`;
`packages/cli/src/build.test.ts:902`; `packages/core/src/test-discovery.test.ts:79` (**already wrong
today**) and `:272`; `packages/core/src/turbo-inputs.test.ts:322`.

*Re-measured rather than re-worded:* `packages/cli/src/end-to-end.test.ts:79` and
`packages/cli/src/step-id.test.ts:40` — timeout budgets staked on a four-emitter measurement, in
fixtures `isolate()` now builds a fifth package into (GO-3).

*Historical, and they stay:* every `docs/decisions/` entry; the clauses of the two comments above that
name **what Q-0122 changed** rather than what is true now.

**Registers and files that need no edit, stated so nobody edits them**

- `packages/cli/test/workspace.ts:107`'s `emitting()` — derived from `turbo run build --dry=json`.
- `packages/cli/test/workspace.ts:184–227`'s `isolate()` — derived; it copies, mirrors `node_modules`
  and re-points the `@quorum` scope for the fifth package with no change.
- `packages/cli/src/build.test.ts`'s fourteen `emitting()` call sites — `:144`, `:360`, `:558`,
  `:584`, `:603`, `:624`, `:635`, `:667`, `:712`, `:884`, `:904`, `:951`, `:956`, `:1140` (plus `:654`
  in a comment).
- `packages/cli/src/build.test.ts:1650`'s `DISTRIBUTION = ['cli','core','shared']` — **unchanged**,
  which is the whole of 092's split holding.
- `packages/core/turbo.json` — already declares `../../packages/*/package.json` (AC-9b measures it).
- `packages/server/turbo.json` — **exists**, written by Q-0122; touched only if this change adds an
  out-of-package read **from** this package, which it is not expected to.
- `vitest.shared.js:61` — already excludes `**/dist/**`; AC-5 asserts over the emitted file set
  because of it, not instead of it.
- `packages/shared/tsconfig.build.json`'s header — carries the argument and **no count**.
- `packages/server/src/index.test.ts:20`'s `SURFACE` — AC-7(c) derives from it rather than editing it.
- `harness/architecture.md`'s `@quorum/server` row — describes the daemon and states no count.
  Checked, **no edit owed**; recorded because it is a run-time context file fed to every agent, so a
  false claim there is one every future requirement inherits (Q-0098's finding).

**Read first**

- *"The emit serves the binary, and no test verdict moves behind it"* (2026-09-02) — (a)'s predicate,
  (b)'s no-`^build` rule, (c)'s derived register, (e)'s `files` clause.
- *"A fourth package emits, and what it emits is served rather than shipped"* (2026-09-12) —
  clause 1's vocabulary, clause 2's non-distribution ruling, clause 3's scoping of 078(a), and its
  Alternatives section, which pre-writes OQ-1's argument.

---

## Provenance

**Iteration 2's contribution is the re-measurement.** It opened on an unchanged tree, said so, and
re-ran every measurement iteration 1 rested a criterion on. Twelve held exactly — the fourteen
`emitting()` call sites at their listed lines, `packages/server/turbo.json` existing, only two
`tsconfig.build.json` headers carrying a count, the `build.test.ts:879` `continue`, `DISTRIBUTION`
unchanged, the four `NOT_READ` rows, `vitest.shared.js:61`, the root `dependsOn` values, the
`index.ts` docblock, the `apps/web` `JUSTIFICATIONS` register, the five architecture sites, and 22
identical terms. **Six did not**, and they are §0.1: the test-file count (nine, not eight); the stub
set (three today, not four); `test-discovery.test.ts:79`'s already-false count; the two `isolate()`
consumers whose budgets are staked on a four-emitter measurement; `apps/web` ceasing to be *"the
one"* non-distributed emitter at two register sites; and two further count sites. Underneath them is
§0.2 — **no test asserts the emitting-set count anywhere**, so all sixteen sites could stay at four
with the suite green, which is why AC-12 was rebuilt from a prose-correction clause into a
classified register.

**Recommended candidate: `claude`.** It measured the tree first-hand, and its central finding — that
the body's stated deliverable is unreachable inside the ticket's own non-goals, because a link needs a
dependency edge and a dependency edge is a consumer (§0.3) — is what makes this requirement honest.
Its §0.5 (resolved-and-not-distributed has no home in 092's vocabulary), its `build.test.ts:879`
insight, its confirmation of the fourteen call sites and its OQ-1 argument are carried substantially
unchanged.

**Taken from `codex`:** the clean-mechanism proof — a sentinel under `dist/` removed by a successful
build, and no emitted test module — which claude omitted and which is the only check that
`tsconfig.build.json`'s `exclude` works; folded into **AC-5**. Its AC-2 (*the public surface remains
the existing index; no subpath*) sharpens **AC-1**. Its AC-7's *"proofs run without first building"*
sharpens **AC-8**. Its AC-10's *"the non-emitter rule remains derived, not a maintained list"* sharpens
**AC-4**. Its AC-14's checkout-independence rule is promoted to the **rule binding all thirteen**. Its
non-goals list is the tighter of the two and §4 is built on it. Its risk *"the derived build suite may
expose assumptions about four emitters"* is **R-4**.

**Struck from `codex`:** eighteen criteria against a ceiling of fifteen, four of which are not
independently testable properties of the change. AC-17 (*run install, build, test, lint, typecheck*)
is a gate obligation and is **GO-2**. AC-18 is the cross-cutting checklist and is **§8**. AC-12
(*every build test that obtains its subject through `emitting()` continues to pass*) restates "the
suite is green" and cannot fail independently of AC-4 and AC-5. AC-11's turbo dry-run claim is already
what `emitting()` derives from. Its OQ-1 is kept and **re-ruled**: it treats the entry as a blocker
only if the gate finds a contradiction, and §0.5 plus 092's own Alternatives section find one.

**Struck from `claude`:** its AC-5(b) narrative that Q-0121 *deleted* `packages/server/turbo.json` —
the file exists, written by Q-0122; and its *"the three existing headers"* — only two carry a count.

**Corrected in iteration 1's own merged document by iteration 2:** the eight-test-file figure (nine);
the silent stub-set figure (three today); the omission of `test-discovery.test.ts:79`; the omission of
both `isolate()` consumers; the omission of the *"the one that is NOT distributed"* clauses at
`test-discovery.test.ts:272` and `turbo-inputs.test.ts:322`; and the omission of the status-line and
*"none of the three is bundled"* count sites.

**Neither candidate nor iteration 1 found**, and measured here: that **no test asserts the
emitting-set count at any of its sixteen sites** (§0.2), which is what turns AC-12 from prose
housekeeping into the one criterion no existing guard reaches — and the reason §7 names it as not
eligible for trimming.
