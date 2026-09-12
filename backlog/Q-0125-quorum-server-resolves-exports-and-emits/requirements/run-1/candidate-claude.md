# Q-0125 — `@quorum/server` resolves, exports and emits

*Requirements, run 1, candidate `claude`. Written 2026-09-12 against the merged tree at the tip that
carries Q-0122. Every measurement below was taken first-hand in this checkout; where a figure is
cited from another file rather than re-run, the document says so.*

---

## §0 — What is actually true, measured

### 0.1 — The body's chain is right about the destination and incomplete about the cause. **Three** things stand between `import '@quorum/server'` and a module, not two.

The ticket body reasons that an `exports` map alone does not satisfy the workspace-local path, so the
package must also emit. That is correct and it is not the whole obstruction. Measured, in this
checkout, with a plain `node` process:

```
cwd packages/server  →  import.meta.resolve('@quorum/server')
    FAILED  ERR_MODULE_NOT_FOUND  |  Cannot find package '@quorum/server' imported from …/packages/server/[eval1]
cwd packages/cli     →  import.meta.resolve('@quorum/server')
    FAILED  ERR_MODULE_NOT_FOUND  |  Cannot find package '@quorum/server' imported from …/packages/cli/[eval1]
cwd packages/cli     →  import.meta.resolve('@quorum/core')          [control]
    RESOLVED  file:///…/packages/core/dist/index.js
```

The control is the whole of decision 078(b) working: a plain Node process, knowing no
`quorum-source` condition, is sent to the emit. The two failures are **not** that mechanism failing.
They are a prior failure, and the message is what distinguishes them:

| | `node_modules` link | `exports` map | file at `default` |
| --- | --- | --- | --- |
| `@quorum/core` | `packages/cli/node_modules/@quorum/core` | declared | `dist/index.js` exists |
| `@quorum/server` | **absent everywhere** | absent | absent |

Measured link inventory:

- `node_modules/@quorum/` — **one** entry, `cli`, because the root manifest declares
  `"@quorum/cli": "workspace:*"` as a devDependency (for its `bin`, which is what `pnpm exec quorum`
  runs).
- `packages/cli/node_modules/@quorum/` — `core`, `shared`.
- `packages/server/node_modules/@quorum/` — `core`, `shared`. **pnpm does not self-link**, so the
  package cannot resolve its own name either.

Nothing anywhere links `server`, because no manifest in the workspace declares it as a dependency.

***"Cannot find package"* is the link failure and it is raised before the manifest is opened.** The
other shape is recorded rather than re-measured here, at `packages/cli/src/package.test.ts:320–321`,
which states that a linked package with **no** `exports` map makes `import.meta.resolve` *"throw,
naming Node's legacy `@quorum/core/index.js` fall-through"*. Two distinguishable messages, two
distinct causes. What `@quorum/server` hits today is the first.

**The consequence for scope is the one thing this requirement most needs to say out loud.** The
non-goals forbid *"any CLI dependency on this package"*, and a dependency edge is the only thing that
creates a link. So the sentence in the body's own Non-goals — *"The deliverable is that
`@quorum/server` can be imported by name"* — **is not achievable inside this ticket's boundary**, and
no criterion could make it so without adding the consumer the ticket refuses. §0.1 is the reason §1
restates the deliverable.

What is achievable, completely and provably, is: **the package's metadata and its artifact are
correct, so that the moment a consumer declares the dependency the import works, and a criterion
proves that against a synthesised link rather than by adding a real one.** That is a smaller claim
than the body's and it is the honest one.

### 0.2 — The emit is forced, and the reason is one no landed entry states.

Decision 078(a)'s predicate is *"each package that something **outside the workspace** consumes —
`@quorum/shared`, `@quorum/core`, `@quorum/cli`"*. `@quorum/server` is consumed by nothing outside
this workspace and is not going to be under this ticket or under Q-0126, because the local
distribution set stays three.

It must nonetheless emit, for the chain the body gives and which measures out exactly as written:
`pnpm exec quorum` runs `packages/cli/dist/quorum.js`; that is executed by **plain Node**;
`customConditions` in `tsconfig.base.json` and `resolve.conditions`/`ssr.resolve.conditions` in
`vitest.shared.js` are the only two selectors of `quorum-source` and neither is in that process; so a
future `packages/cli` import resolves through `default`, which must name a file that exists.

So the reason this package emits is **a workspace-internal consumer running outside the workspace's
own conditions** — a third reason beside 078(a)'s *"consumed outside the workspace"* and 092's
*"served to a browser"*. Nothing in either entry says it.

### 0.3 — `@quorum/server` is the first artifact that is **resolved and not distributed**, which decision 092's vocabulary has no room for.

`docs/GLOSSARY.md` **Emitted artifact**, as 092 clause 1 wrote it eight hours ago:

> The **emitting set** is four — `@quorum/shared`, `@quorum/core`, `@quorum/cli` and `@quorum/web` —
> and the **local distribution set** is the first three […] `@quorum/web` **is the difference** […]
> Emitted artifacts come in exactly **two shapes** […] the **resolved** emit of **the three
> distribution packages**, the JavaScript and declaration files Node and a packed install import; and
> the **served** bundle of `@quorum/web`.

After this ticket every clause emphasised above is false in a different way:

- the emitting set is **five**;
- **two** packages are the difference, not one;
- and the *resolved* shape covers **four** packages, of which three are distributed — so the sentence
  that names the resolved shape *by the distribution set* no longer picks it out.

092 could tie *resolved* to *distributed* because they were the same three packages. This ticket
separates them a second time and in the other direction from Q-0122: `@quorum/web` emits and is not
resolved; `@quorum/server` **is** resolved and is not distributed. That is a change to a term, not a
count bump, and 092's clause 1 is where those words were written. See **OQ-1**, which is blocking.

### 0.4 — What moves, measured, with the body's own re-measurement confirmed.

**`packages/core/src/test-discovery.test.ts`.** `emittingPackages()` (`:93–94`) derives from
`PACKAGES`, itself derived from `pnpm-workspace.yaml`'s `packages/*` and `apps/*` — so
`packages/server` is already a member and nothing has to be added to make the register see it. Two
clauses go red:

- `:276` — `expect(emittingPackages()).toStrictEqual(['apps/web','packages/cli','packages/core','packages/shared'])`.
- `:285–300` — *"a package that emits nothing is not required to declare a no-op build script"*,
  which asserts `scripts.build === undefined` for every non-emitter and guards itself with
  `expect(stubs.length).toBeGreaterThan(0)`. **Measured, that clause keeps a subject**: the seven
  packages are `cli`, `compiler`, `core`, `server`, `shared`, `templates`, `apps/web`; four emit
  today and five will, leaving `packages/compiler` and `packages/templates` — `stubs.length === 2`.

**`packages/cli/test/workspace.ts`'s `emitting()`** is derived from `turbo run build --dry=json` and
filtered on `command !== '<NONEXISTENT>'`, so it needs no edit at all. It is reached at **fourteen**
call sites in `packages/cli/src/build.test.ts` — `:144`, `:360`, `:558`, `:584`, `:603`, `:624`,
`:635`, `:667`, `:712`, `:884`, `:904`, `:951`, `:956`, `:1140` — with a fifteenth occurrence at
`:654` inside a comment. **The body's re-measured figure is confirmed exactly**, which is worth
recording because that same figure was thirteen the day before and the body says so; re-deriving it
was the right instruction and it did not move again.

**`packages/cli/src/build.test.ts:879–898`** — *"the emit carries the declarations the export maps
promise"* — loops `emitting()` and, at `:888`, `if (entry === undefined) continue;`. The only emitter
that `continue`s past it today is `apps/web`. **A fifth emitter that declares a map is the first
package covered by that assertion since Q-0097**, so this ticket gets a real proof for free rather
than a register edit. `:900–908` (`no *.tsbuildinfo`) covers it unconditionally.

**`packages/core/src/turbo-inputs.test.ts`'s `NOT_READ`** carries four rows for the emitting
register — `packages/core`, `packages/cli`, `packages/shared`, `apps/web`. Measured, the bare literal
`'packages/server'` occurs in **neither** SUITES directory: `git grep "packages/server" -- packages/core/src packages/shared/src` returns only prose inside longer strings (`docs.test.ts:59`'s
`'### \`packages/server\`'`, and doc comments in `confine.ts`, `index.ts`, `navigation.ts`,
`wire.ts`), none of which the classifier resolves to a tracked path. So adding the member to the
register at `:276` introduces a **new collected literal** and a fifth `NOT_READ` row is owed, with
the `apps/web` row's reasoning.

**`packages/server/src/package.test.ts:138–155`** — *"it emits nothing: no build task, no exports
map, no files allow-list, no bin"*. Measured, this ticket inverts **two** of its six manifest
assertions (`scripts.build`, `exports`) and **four survive unchanged** (`main`, `types`, `files`,
`bin` all stay `undefined`; `private` stays `true`; `type` stays `module`) — because `@quorum/core`'s
and `@quorum/shared`'s shape puts `types` and `default` *inside* the conditional map and declares no
top-level `main` or `types`. That is 092's emitting/distribution split arriving inside a single
guard, and it is why AC-3 re-aims the block rather than deleting it.

**`packages/core/turbo.json:69` already declares `../../packages/*/package.json`**, so a change to
`packages/server/package.json` moves `@quorum/core#test`'s hash, and `@quorum/cli#test` inherits it
through the root `test` task's `^test` edge. **No new turbo input is predicted to be owed** — see
AC-5, which requires this be re-measured both ways and recorded rather than declared by reflex,
which is exactly what Q-0121's implement step did when it wrote a `packages/server/turbo.json`,
measured it unnecessary and deleted it.

### 0.5 — The impossibility this ticket removes is currently load-bearing in a document, and its practical half survives.

`docs/04-architecture.md:72` states:

> `apps/web` cannot import `@quorum/server` at all: **it has no `exports` map**, and a value import
> from a browser bundle would pull `hono`, `@quorum/core` and Node builtins in with it, **where a
> guard is weaker than an impossibility**.

The conclusion survives — measured, `packages/server`'s eleven production modules import `node:fs`,
`node:path`, `node:url` and `node:http`, so a value import into a browser bundle would do exactly
what that sentence says. What does not survive is **the reason given**, and with it the claim that
the barrier is an impossibility rather than a guard.

**The practical half is already guarded and this was measured rather than assumed.**
`apps/web/test/package.test.ts`'s `JUSTIFICATIONS` register is asserted against the manifest **in
both directions** (`expect(Object.keys(JUSTIFICATIONS).sort()).toStrictEqual(declared)`), and a
second clause pins `dependencies` to exactly `['@quorum/shared','react','react-dom']`. Adding
`"@quorum/server"` to `apps/web` fails **two** assertions today, with no change from this ticket. So
what this ticket owes is the **document correction** (AC-10) and not a new guard; a criterion adding
one would be scope creep over a barrier that exists. This is stated with its evidence rather than
left for a reviewer to raise.

### 0.6 — Prose that carries a count and has to move.

Measured occurrences, all of which state *three* or *four* about a set that becomes five or about a
distribution set that does not change:

| site | what it says |
| --- | --- |
| `docs/04-architecture.md:141` | §`packages/server`: *"and it emits nothing: the local distribution set is three packages"* |
| `docs/04-architecture.md:215` | §`packages/server`: *"The four packages that emit are named under **Testing strategy**"* |
| `docs/04-architecture.md` Testing strategy | *"**Four packages emit and three are packed**"*; *"`@quorum/shared`, `@quorum/core` and `@quorum/cli` each declare a `build` script driven by a per-package `tsconfig.build.json`"*; *"`@quorum/web` is the fourth"* |
| `docs/GLOSSARY.md` **Build task** | *"run in the four packages that emit"*; *"took it from three packages to four"* |
| `docs/GLOSSARY.md` **Emitted artifact** | §0.3's four clauses |
| `packages/{shared,core,cli}/tsconfig.build.json` headers | *"The **three** distribution packages declare the same four options"* — which becomes wrong in a new way: there will be **four** such files and three distribution packages, so the sentence's subject and its count come apart |
| `packages/cli/src/build.test.ts:902` | *"Refused in the three `tsconfig.build.json` files by leaving both options off"* |

`docs/README.md`'s and `CLAUDE.md`'s 22-term lists do **not** move: no term is coined and none is
retired, only two existing entries are re-derived. Recorded so it is not re-litigated.

---

## §1 — Problem

**The `maintainer`'s words.** The daemon and the web bundle both exist and nothing in this product
can start them. `packages/server` has been written, reviewed and shipped across four tickets —
Q-0013, Q-0118, Q-0119, Q-0121 — and across Q-0122's static route, and it is still a package that no
line of code outside its own directory can name. Q-0122's own gate met this by accident: an
end-to-end probe of the static route, written as a plain `node` script importing `@quorum/server`,
died with `ERR_MODULE_NOT_FOUND` and had to be re-run under Vitest.

**What is missing, stated at the right granularity.** The package declares no `exports`, no `main`,
no `types` and no `build` script — the first three verbatim the state Q-0096 measured for
`@quorum/core`, the fourth what Q-0097 then added there. It therefore publishes no public surface and
produces no artifact, and `packages/server/src/wire.ts`'s own header already records the cost: three
wire shapes were moved to `@quorum/shared` at Q-0120 and Q-0121 because *"this package having no
export surface"* made it unreachable from the only other end of its own socket.

**The deliverable, restated on §0.1's measurement.** *"`@quorum/server` can be imported by name"*
needs three things and this ticket can only supply two, because the third is a dependency edge and a
dependency edge is a consumer. So:

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
assumed-free one.* (This is the only way the ticket reaches this persona; see R-3.)

**Surfaces.** None of the four product surfaces — CLI, daemon + web UI, `harness/`, `backlog/` —
changes behaviour. What changes is workspace machinery: three manifests' worth of registers, one new
`tsconfig.build.json`, one new `exports` map, and two documents.

---

## §3 — Acceptance criteria

Thirteen, against this role's ceiling of fifteen. Each is independently testable and names its
instrument. Where a *Test:* clause bounds the instrument, that bound is the specification — a
reviewer may find the instrument fails the job this clause gives it and may not raise the job
(Q-0067 erratum E-1).

---

**AC-1 — `@quorum/server` declares a conditional `exports` map of the same shape `@quorum/core` and
`@quorum/shared` declare, publishing `"."` and no subpath pattern.**

`exports["."]` carries `quorum-source` → `{ types: './src/index.ts', default: './src/index.ts' }`,
`types` → `./dist/index.d.ts`, `default` → `./dist/index.js`. No `main` and no top-level `types` are
added: resolution goes through the map, which is what `customConditions` makes `tsc` read too.

*Test:* in `packages/server/src/package.test.ts`, over the package's own manifest — the three
`toStrictEqual`/`toBe` assertions above, plus `Object.keys(own.exports)` is exactly `['.']`, the
wildcard-subpath refusal `packages/cli/src/package.test.ts:511` already makes for `@quorum/core`.
Shown red by deleting the `quorum-source` branch, which must fail with a message naming that
condition rather than a generic shape mismatch.

---

**AC-2 — The package declares a `build` script and a `tsconfig.build.json`, and the four
`tsconfig.build.json` files in the workspace agree.**

`"build": "rm -rf dist && tsc -p tsconfig.build.json"`, byte-identical to `@quorum/core`'s and
`@quorum/shared`'s. `packages/server/tsconfig.build.json` extends `./tsconfig.json` and declares
exactly `outDir: "dist"`, `rootDir: "src"`, `declaration: true`, `noEmit: false`, with
`include: ["src/**/*.ts"]` and `exclude: ["src/**/*.test.ts"]`. `packages/server/tsconfig.json` is
**not** touched, because that is the project ESLint's `projectService` and `typecheck` read.

*Test:* two clauses. (a) The script matches `/^rm -rf dist && tsc -p tsconfig\.build\.json$/`.
(b) The `compilerOptions` of every `tsconfig.build.json` under `packages/**` are compared to each
other and must be equal — **derived by globbing for the file rather than from a list of package
names**, so a fifth arrives in the comparison without anyone remembering, and a divergence in
emitted layout (which is what `outputs: ["dist/**"]` has to cover) fails. Shown red by changing
`rootDir` in one of the four.

*Why this is uniformity rather than mechanism, stated so it is not mistaken for one:* `rm -rf dist`
is the whole clean mechanism for a `tsc` emitter, turbo pruning an output directory on neither the
miss path nor the hit path — the same measurement `apps/web/test/package.test.ts` records for the
Vite emitter, where it is uniformity instead.

---

**AC-3 — The package emits and is **not** distributed, and the guard that said it does neither is
re-aimed rather than deleted.**

`private: true` stays. `files`, `main`, `types` and `bin` stay absent. `packages/server/src/package.test.ts:138–155`
keeps its four surviving `toBeUndefined()` assertions on exactly those keys, loses the two that
assert `scripts.build` and `exports` are absent, and its title and comment stop claiming the package
emits nothing — naming instead the two sets 092 separated and which of them this package is now in.

*Test:* the four surviving keys are asserted `undefined` by name; `private` is `true`; and the block
is shown red in **both** directions — by restoring `expect(own.exports).toBe(undefined)`, and by
adding `files: ["dist"]` to the manifest, which must fail with a message naming distribution rather
than emission. The second half is what stops AC-3 being read as *"delete the assertions that now
fail"*.

*Authority:* decision 092 clause 2 ruled `apps/web`'s non-distribution **by name**. That it extends
to a second package is OQ-1's and must be in the entry GO-1 asks for before this criterion is
implemented, not assumed here.

---

**AC-4 — The emitting register is five, derived, and its stub clause still discriminates.**

`packages/core/src/test-discovery.test.ts:276` becomes the five-element identity, in the same sorted
order the four-element one uses. Its comment records that the emitting set is five and the local
distribution set is three, and cites the entry GO-1 lands.

*Test:* the identity assertion over `emittingPackages()`, plus the existing
`expect(stubs.length).toBeGreaterThan(0)` anti-vacuity clause, whose remaining members must be
measured and named in the comment — `packages/compiler` and `packages/templates`, two. Shown red by
removing the `build` script from `packages/server`, which must fail the identity clause and **not**
the stub clause, so the two are proven to discriminate different things.

---

**AC-5 — `turbo-inputs.test.ts` gains its fifth `NOT_READ` row, and whether a new turbo input is owed
is **measured** rather than answered by reflex.**

Two halves, and the second is the one that matters.

(a) `packages/core/src/turbo-inputs.test.ts`'s `NOT_READ` gains `'packages/server'`, with the
`apps/web` row's reasoning in its own words: the literal is a member of the emitting-set register,
which is data derived from manifests reached through the `packages` walk `WALKS` already declares,
and nothing opens the directory.

(b) Whether `@quorum/core#test` and `@quorum/cli#test` are invalidated by an edit to
`packages/server/package.json` is measured, both hashes recorded, and an input declared **only if the
measurement says one is needed**. *Predicted and to be confirmed rather than asserted:*
`packages/core/turbo.json:69` already declares `../../packages/*/package.json`, and the root `test`
task's `^test` edge carries that into `@quorum/cli#test`, so no declaration is expected to be owed.
Declaring one anyway would be the same claim written twice and free to drift — which is the
measurement Q-0121's implement step made, wrote down, and acted on by **deleting** the file it had
just written.

*Test:* (a) removing the row fails `turbo-inputs.test.ts` clause B naming `packages/server`; the
existing dead-key clause (`:2156`) must still pass, proving the new key is a literal the scan
collects. (b) is a reported measurement with both hash values, in the implement report and in a
comment beside whatever it decides — not an assertion.

---

**AC-6 — The build writes what the map promises, and the new package is inside the loops that check
it rather than skipped by them.**

`packages/cli/src/build.test.ts:879–898` currently `continue`s past an emitter with no `exports`
map. With AC-1 landed, `@quorum/server` is the first package that assertion has ever covered beside
the three distribution packages, and that coverage must be asserted rather than inherited silently.

*Test:* after a forced build, `packages/server/dist/index.js` and `packages/server/dist/index.d.ts`
both exist; no `*.tsbuildinfo` is produced (the `:900` clause, which needs no change); and a new
clause asserts that the set of emitters the `:879` loop actually **checks** — those with an
`exports['.']` — contains `@quorum/server`, so a later `continue` past it fails rather than passing
in silence. Shown red by pointing `exports['.'].types` at a path the build does not write.

---

**AC-7 — A plain Node process is sent to the emit and can execute it, and the barrel it gets is the
barrel the source declares.**

Three clauses, because three different things can be wrong.

(a) **Resolution.** In a temporary directory holding `node_modules/@quorum/server` as a symlink to
the package, a plain `node` process — no `--conditions`, no loader — resolves `@quorum/server` to a
URL ending `/dist/index.js`. **The synthesised link is named, in the test's own comment, as standing
in for the dependency edge this ticket may not add** (§0.1), so nobody later reads it as proof that
the name resolves from the workspace as it stands.

(b) **Execution.** The same plain process, spawned with `cwd` inside `packages/server`, imports the
built `dist/index.js` by absolute `file://` URL and succeeds — which is what proves `hono`,
`@hono/node-server`, `@hono/node-ws`, `@quorum/core` and `@quorum/shared` all resolve through their
own `default` conditions from the emitted module's location. A resolution-only assertion is not
enough here and the reason is `packages/cli/src/package.test.ts:300–302`'s:
`import.meta.resolve` answers from the manifest without the target existing.

(c) **Identity.** The namespace that import returns has exactly the runtime export names the source
barrel declares — **derived from `packages/server/src/index.test.ts`'s existing register rather than
retyped**, on the shape `build.test.ts:921`'s `publicApi()` already uses, with that helper's
throw-on-empty guard so a regex that matched nothing cannot make the clause vacuous.

*Test:* this criterion lands in `packages/cli/src/build.test.ts`, which owns `runBuild`,
`removeEmit`, `isolate` and `inPlainNode`, and **not** in `packages/server`'s own suite — because a
test that asserts the emit exists without running the build takes its verdict from the checkout
rather than from the commit (*"A test's verdict is a property of the commit, not of the checkout or
the account"*, 2026-08-30), `dist/` being gitignored. Shown red by deleting one export from the
barrel, which must fail (c) naming the missing symbol.

---

**AC-8 — No verdict that exists today moves behind the new emit.**

Decision 078(b) is not touched: `test` and `typecheck` gain no `^build` edge, and the workspace
suites go on proving TypeScript source.

*Test:* three clauses. (a) Root `turbo.json`'s `test` and `typecheck` declare `dependsOn` of exactly
`["^test"]` and `["^typecheck"]`, read out of the file rather than from a literal. (b)
`exports['.']['quorum-source'].default` is `./src/index.ts`, so the condition still names source.
(c) `packages/server/src/package.test.ts:176–177` — `import.meta.resolve('@quorum/core')` contains
`/packages/core/src/index.ts` and the same for `@quorum/shared` — is **unchanged and still passes**,
which is the evidence that adding an emit to this package moved no verdict inside it. Shown red by
adding `"^build"` to the root `test` task.

---

**AC-9 — `docs/04-architecture.md` says the package emits and is not distributed, and the two count
sentences in §`packages/server` are corrected.**

`:141`'s *"and it emits nothing: the local distribution set is three packages"* and `:215`'s *"The
four packages that emit"* both move. The Testing-strategy cache-hit paragraph's *"**Four packages
emit and three are packed**"* and its list of which packages declare a `tsc`-driven `build` script
move with them. The status line records Q-0125 and `2026-09-12`.

*Test:* `packages/shared/src/docs.test.ts`'s existing `Q-0013 GO-3` slice of §`packages/server` gains
clauses — the section no longer matches `/it emits nothing/`, it names the emitting set and the
distribution set as different sizes, and the status-line clause (which that describe block already
has, at `:1169`) names this ticket. The slice's anti-vacuity clauses (`:1178`) are unchanged. Shown
red by reverting the `:141` sentence.

---

**AC-10 — The architecture document stops giving *"no `exports` map"* as the reason `apps/web` cannot
import the daemon, and names what actually holds them apart.**

`:72`'s conclusion stands and its first reason goes. What replaces it is what §0.5 measured: a value
import would pull `hono` and four Node builtins into a browser bundle, and `apps/web`'s own
dependency register refuses the dependency in both directions. The sentence *"a guard is weaker than
an impossibility"* is the part that has to change rather than the part to preserve — after this
ticket it **is** a guard, and saying so is cheaper than leaving a reader to discover it.

*Test:* the §`packages/server` slice no longer matches `/it has no .?exports.? map/`, and names the
register that refuses it. Shown red by restoring the old sentence. **No new guard is added in
`apps/web`** — §0.5 measured the existing one fails closed in both directions, and a second copy of a
rule is the drift this repository keeps finding.

---

**AC-11 — `docs/GLOSSARY.md`'s **Build task** and **Emitted artifact** are re-derived, and the
*resolved* shape stops being defined by the distribution set.**

**Build task** names five packages. **Emitted artifact** states the emitting set as five and the local
distribution set as three, names **both** members of the difference — `@quorum/web` and
`@quorum/server` — and defines **resolved** by what Node does with it rather than by which packages
are packed, so that an artifact that is resolved and not distributed has a home in the sentence.

*Test:* the glossary no longer matches `/the resolved emit of the three distribution packages/`;
both non-distributed emitters are named in the **Emitted artifact** entry; and every landed
`docs.test.ts` pin over these two entries still passes unchanged — the `Not a "pipeline", a "job" or
a "step"` clause, the `the two words are not interchangeable` clause, the 078 citation and the
`docs/README.md` term-list clause (`:556–562`). Shown red by leaving either count at four.

*No term is coined and none is retired*, so neither 22-term list moves and `CLAUDE.md` stays the
human's (Q-0103 erratum E-2). Recorded rather than left to be asked.

---

**AC-12 — No file states a `tsconfig.build.json` count that disagrees with how many exist.**

The three existing headers say *"The **three** distribution packages declare the same four options"*
and `build.test.ts:902` says *"Refused in the three `tsconfig.build.json` files"*. After AC-2 there
are four such files and three distribution packages, so the sentence's subject and its number come
apart — the exact shape 092 had to fix when *"the three emitting packages"* stopped naming the packed
set.

*Test:* a clause that counts `tsconfig.build.json` files under `packages/**` and `apps/**` and
asserts no file under those roots states a different number for them — **derived from the count
rather than matching a literal**, so the next emitter is covered without anyone remembering. Shown
red by leaving one header at *"three"*.

---

**AC-13 — Nothing is installed and no dependency edge is created.**

No package's `dependencies` or `devDependencies` gains `@quorum/server`; the root manifest is
unchanged; `pnpm-lock.yaml`'s `packages/server` importer gains no entry. This is the criterion that
holds the ticket inside its own non-goals, and it is checkable rather than a promise.

*Test:* every manifest under `packages/**`, `apps/**` and the workspace root is read, and the only
occurrence of the string `@quorum/server` across them is `packages/server/package.json`'s own `name`.
Shown red by adding the dependency to `packages/cli`, which is Q-0126's first line and must fail
here.

---

## §4 — Non-goals

Each with why, because a non-goal with no reason is a deferral nobody can audit.

1. **`quorum open`, and any consumer at all.** Q-0126's. This ticket adds no importer, which is what
   AC-13 enforces. Consequence, stated rather than hidden: **the emit this ticket produces is
   imported by nothing when it lands** — see R-2.
2. **Whether `@quorum/server` is distributed.** Q-0124's, and after this ticket that question governs
   **two** packages rather than one. The package stays `private: true` with no `files`, exactly as
   `@quorum/web` does. A packed `@quorum/cli` that imported it would be broken for the `workspace:*`
   reason Q-0098's M-8 measured; that becomes urgent at Q-0126 and is not urgent here, this ticket
   adding no importer.
3. **Moving decision 078(b).** No `^build` edge on `test` or `typecheck`; AC-8 asserts it.
4. **Widening or narrowing the barrel.** `packages/server/src/index.ts` gains and loses no export;
   AC-7(c) pins the runtime register against the emit. Whatever Q-0126 needs from this package it
   already exports.
5. **Any behaviour change in the daemon.** No route, no host method, no wire shape.
6. **A new guard in `apps/web` against importing the daemon.** §0.5 measured the existing dependency
   register fails closed in both directions. A second enforcer of one rule is the drift this
   repository keeps finding; the document correction is AC-10 and the guard is not owed.
7. **`packages/compiler` and `packages/templates`.** They remain the two stubs that make AC-4's
   anti-vacuity clause discriminate, and nothing here gives either a `build` script.
8. **The root `devDependencies`.** Adding `@quorum/server` beside `@quorum/cli` would make AC-7(a)
   easier and would be a dependency declared for a test's convenience — see OQ-2.

---

## §5 — Open questions

**OQ-1 (BLOCKING) — Does this ticket owe a decision entry?**

The body says *"the shape is now precedented, which is an argument that it does not"*. Measured, three
things are true that no landed entry states:

1. This package emits for a reason 078(a)'s predicate does not cover — a **workspace-internal**
   consumer running under plain Node, not *"something outside the workspace consumes it"* (§0.2).
2. It is the first artifact that is **resolved and not distributed**, a combination 092's own
   vocabulary forecloses by defining *resolved* as *"the emit of the three distribution packages"*
   (§0.3).
3. 092 clause 2 ruled non-distribution **for `apps/web` by name**, not as a class, so a second
   non-distributed emitter is an extension of that ruling rather than an instance of it.

**Recommendation: an entry is owed, and the argument is decisive rather than cautious.** AC-11 edits
sentences that decision 092 wrote **in its own Decision clause 1, on 2026-09-12**. Editing them
without a new entry is contradicting a landed entry silently, which
`.claude/rules/docs-and-decisions.md` forbids in as many words — and 092's own Alternatives section
says the register firing *"is the beginning of a decision, not a substitute for one"*.

The counter-argument, recorded because it is real: this is a count and a widening rather than a
reversal, 092 anticipated a fifth emitter, and an entry per emitter is a tax. It does not survive the
fact that clause 1's words themselves have to move.

**The entry is `developer-generalist`-forbidden** (`harness/roles/developer-generalist.md:23`), so it
is the human's at the gate — which is GO-1 and is why this is blocking rather than advisory. What it
must rule: the emitting set is five and the distribution set three; *resolved* is defined by what
Node does rather than by what is packed; a non-distributed emitter declares no `files` (OQ-3); and
whether 078(a)'s predicate is narrowed or extended.

**OQ-2 — How AC-7(a) obtains a link, given that this ticket may not create one.**

Two shapes. **(A) A synthesised `node_modules/@quorum/server` symlink in a temp directory**, named in
the test as standing in for the dependency edge — recommended. **(B) Add `@quorum/server` to the root
`devDependencies` beside `@quorum/cli`**, which creates a real link and makes the name resolvable
everywhere. Refused: the root entry for `@quorum/cli` exists because that package has a `bin` and
`pnpm exec quorum` needs it linked; `@quorum/server` has no `bin`, so (B) is a dependency declared to
make a test resolve — a consumer added for a test's convenience, against non-goal 1 and AC-13.

**OQ-3 — Should `packages/server` declare `files` anyway?**

078(e) says *"The artifact sits in `dist/` inside its own package, **and `files` is declared**"*, in a
sentence whose whole argument is about what a `pnpm pack` ships. `@quorum/web` declares none and 092
clause 2 ruled that correct for a package that emits and is not distributed. **Recommendation: no
`files`**, and the ratification belongs in OQ-1's entry rather than in a criterion, because it is
078(e) being scoped the way 092 scoped 078(a).

**OQ-4 — Does the ticket's own title survive §0.1?**

*"resolves, exports and emits"* claims three things and the first is not this ticket's to deliver.
**Recommendation: the title stays and §1 carries the correction**, because a title is not a criterion
and renaming a `p1` ticket mid-flight moves five citations for no behaviour. Stated so the gate can
disagree cheaply.

---

## §6 — Gate obligations

**GO-1 (blocking, before a line of code) — The decision entry OQ-1 asks for is landed, or OQ-1 is
ruled the other way in writing.** AC-3 and AC-11 are unsatisfiable without the ruling, and an
implement step that met them anyway would be editing a landed entry's own words on its own authority.
*Discharge by measurement, not by assumption*: confirm the entry appears in the implement step's
**actual prompt**, cited by title and date — the check Q-0097 lost two errata by not making and which
Q-0115 and Q-0122 both performed.

**GO-2 — The four `tsconfig.build.json` files' shared header sentence is rewritten by the human or
routed to AC-12.** It sits in three files that this ticket's implementer may write, so this is a
routing note rather than a permission problem; recorded because the sentence's subject changes
meaning rather than its number.

**GO-3 — Verified forced in both environment rows.** `pnpm turbo run build --force` and
`pnpm turbo run test --force --continue` in a worktree that has neither `.harness/worktrees` nor
`.quorum/runs`, and again on `main` after the merge, with `pnpm lint`, `quorum lint` and the
git-identity sweep. Q-0072's closing finding: a green `integrate` tick is worktree-scoped.

**GO-4 — R-3's build-time measurement is recorded**, before and after, as Q-0122 recorded 2.5 s for
the fourth emitter. A cold-clone cost that is assumed to be small is the shape this repository has
been wrong about before.

---

## §7 — Risks

**R-1 — Declaration emit may not be free, and this has never been run.** `declaration: true` requires
every exported value's type to be nameable from the emitting package. Measured mitigations already in
place: `createApp`, `mountRead` and `mountStatic` annotate `Hono` **explicitly** (`http.ts:156`,
`read.ts:75`, `static.ts:262`) rather than inferring it, and `hono` is a direct dependency, so
`import("hono").Hono` is nameable. **Predicted low, not measured** — `tsc -p tsconfig.build.json` has
never been run in this package. If it fails with TS2742 or TS4023, the fix is an explicit annotation
on the affected export; it is **not** dropping `declaration`, which would break AC-1's `types`
condition, and **not** `skipLibCheck`, which is already on and is not the mechanism.

**R-2 — The ticket ships an emit nothing imports.** Accepted deliberately, and it is Q-0121's R-1
one package over: under the ruled scope there is no user-visible consumer, and the alternative —
bundling Q-0126 — is what turned Q-0013 into three tickets and Q-0014 into two. What makes it
acceptable rather than speculative is that AC-7 proves the artifact runs, so the consumer inherits a
measured surface instead of discovering it.

**R-3 — Build time, and the cold-clone path.** `pnpm turbo run build` is on the workspace-local
installation path this repository claims and tests, so any increase lands inside M6's thirty minutes.
Q-0122 took the forced whole-workspace build from three tasks to four and 2.5 s; a fifth `tsc`
emitter over eleven production modules is expected to be cheaper than a Vite bundle, **which is a
prediction to measure and not a claim** (GO-4). It serialises after `@quorum/core` and
`@quorum/shared` through `dependsOn: ["^build"]` and nothing depends on it, so it cannot lengthen
anyone else's chain.

**R-4 — `turbo-inputs.test.ts` does not scan `packages/server`.** Its `SUITES` are
`@quorum/shared#test` and `@quorum/core#test`, which `packages/server/turbo.json`'s own header
records as the standing residual: *"a later read out of this package is covered by nobody's guard"*.
This ticket adds no out-of-package read, so it neither closes the gap nor widens it — stated so the
residual is not later attributed here.

**R-5 — A pre-existing hash gap, named so it is not confused with this ticket's.**
`packages/cli/turbo.json` declares `../../packages/*/src/**` and `../../packages/*/turbo.json` but
not `../../packages/*/package.json`, so `build.test.ts`'s reads of a manifest reach
`@quorum/cli#test` only through `@quorum/core#test`'s own declaration at `packages/core/turbo.json:69`
and the `^test` edge. That is true today of `apps/web` and becomes true of `packages/server`.
AC-5(b) is where it is measured; it is not this ticket's to close.

**R-6 — A guard that inverts is a guard that can be deleted instead.** AC-3 and AC-4 both invert
assertions that currently pass, and the cheapest wrong implementation of either is to delete the
failing clause. Both criteria therefore demand a red demonstration **in both directions** rather than
one — which is the specific failure `q0050.source.test.ts`'s fail-open array (Q-0051) and Q-0093's
per-package register each cost a round.

---

## §8 — Cross-cutting checklist

| | |
| --- | --- |
| **BYOS** | n/a to the change, and not vacuously: `packages/server` carries no credential path, and `apps/web`'s credential scan — the surface furthest from an adapter — is untouched. No test, fixture or example gains a key. |
| **Worktree safety** | n/a. No flow writes anything here and no code path touches `.harness/worktrees/` or the user's working tree. |
| **Gate behaviour** | n/a. No flow, no gate, no `auto`, no `human-locked` clause moves. |
| **File format and schema** | No schema changes and no new file format. `packages/shared`'s zod schemas are untouched; AC-7(c) pins the barrel's runtime register so no exported shape moves. The two files that gain structure — `package.json` and a new `tsconfig.build.json` — are covered by AC-1 and AC-2. |
| **Lint rules** | Unaffected by construction: `tsconfig.build.json` is a **second** project, and `packages/server/tsconfig.json` — the one ESLint's `projectService` and `typecheck` read — is not touched. The single type-aware rule (`@typescript-eslint/no-deprecated`, Q-0069) keeps its project. |
| **Flow lint** | n/a. No flow file changes. |
| **Cold-clone impact** | R-3, measured at the gate under GO-4. The workspace-local path gains one build task; the packed path is unchanged, this package being in no tarball. |
| **Product-agnostic** | n/a. Nothing here names a product. |
| **Decision entries** | One, blocking — OQ-1 / GO-1. `developer-generalist` may not write it. |
| **Glossary** | Two existing entries re-derived (AC-11). **No term coined, none retired**, so neither 22-term list moves and `CLAUDE.md` stays the human's. |

---

## Appendix A — Every site that moves, measured 2026-09-12

Given so an implementer does not re-derive it, and given with the instruction to **re-measure the line
numbers before editing**: the `emitting()` count in this ticket's own body was thirteen on 2026-09-12
and fourteen hours later, for the same reason.

**Manifests and configuration**

- `packages/server/package.json` — `exports` map (AC-1), `build` script (AC-2).
- `packages/server/tsconfig.build.json` — new (AC-2).

**Registers that go red**

- `packages/core/src/test-discovery.test.ts:276` — the four-element identity → five (AC-4).
- `packages/core/src/test-discovery.test.ts:285–300` — the stub clause; keeps its subject at two.
- `packages/core/src/turbo-inputs.test.ts:311–330` — `NOT_READ` gains a fifth row (AC-5a).
- `packages/server/src/package.test.ts:138–155` — two assertions invert, four survive (AC-3).

**Registers that need no edit, stated so nobody edits them**

- `packages/cli/test/workspace.ts`'s `emitting()` — derived from `turbo run build --dry=json`.
- `packages/cli/src/build.test.ts`'s fourteen `emitting()` call sites — `:144`, `:360`, `:558`,
  `:584`, `:603`, `:624`, `:635`, `:667`, `:712`, `:884`, `:904`, `:951`, `:956`, `:1140` (plus
  `:654` in a comment) — every one of which picks the new member up automatically.
- `packages/cli/src/build.test.ts:1650`'s `DISTRIBUTION = ['cli','core','shared']` — **unchanged**,
  which is the whole of 092's split holding.
- `packages/core/turbo.json:69` — already declares `../../packages/*/package.json` (AC-5b measures
  it).

**Prose**

- `docs/04-architecture.md:72`, `:141`, `:215`, and the Testing-strategy cache-hit paragraph; status
  line (AC-9, AC-10).
- `docs/GLOSSARY.md` **Build task** and **Emitted artifact** (AC-11).
- `packages/{shared,core,cli}/tsconfig.build.json` headers and
  `packages/cli/src/build.test.ts:902` (AC-12).
- `harness/architecture.md:16`'s `@quorum/server` row describes the daemon and states no count —
  checked, and **no edit is owed**. Recorded because it is a run-time context file fed to every
  agent, so a false claim there is one every future requirement inherits (Q-0098's finding).

**Read first**

- *"The emit serves the binary, and no test verdict moves behind it"* (2026-09-02) — (a)'s predicate,
  (b)'s no-`^build` rule, (c)'s derived register, (e)'s `files` clause.
- *"A fourth package emits, and what it emits is served rather than shipped"* (2026-09-12) — clause 1's
  vocabulary, clause 2's non-distribution ruling, and its Alternatives section's *"a fifth package
  that starts emitting fails closed"*.
