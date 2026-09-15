---
id: Q-0124
title: How an installation outside the workspace obtains the UI
stage: requirements
owner: ruud
repos: []
branch: harness/Q-0124/integration
priority: p2
created: 2026-09-12
iterations:
  requirements.head-of-product: 2
history:
  - stage: draft
    run: 1
    flow: requirements
    status: exhausted
    stage_before: draft
    stage_after: draft
    at: 2026-09-15T06:09:02.859Z
    cost: 0
  - stage: requirements
    run: 1
    flow: requirements
    status: completed
    stage_before: draft
    stage_after: requirements
    at: 2026-09-15T17:29:10.328Z
    cost: 20.404
---
After Q-0122 the bundle exists and is served from the workspace, and a locally packed install still has no web app: the local distribution set is three tarballs and apps/web is private:true with no files and no exports. Separately M3's done-when names quorum open and no ticket in this milestone builds it — packages/cli declares no dependency on @quorum/server, so nothing in the CLI can start a daemon at all.

Opened **2026-09-12 at Q-0122's requirements gate** (that document's GO-3, from its Appendix B),
transcribed **in full** rather than referenced — Q-0110, Q-0111 and Q-0112 each lived only inside a
closed ticket's prose or a source comment and were each lost for a week.

## Transcribed from Q-0122, Appendix B

**Two gaps, both measured at that gate and neither ticketed anywhere before this.**

**(a) After both halves of Q-0122 a packed install still has no web app.** The **local distribution
set** is three tarballs — `@quorum/shared`, `@quorum/core`, `@quorum/cli` — and `apps/web` is
`private: true` with no `files` and no `exports`. That is a gap in the cold-clone story M6 turns on,
and it sits on **one of the two installation paths this repository claims and tests** (the other,
the workspace-local one, is what Q-0122 serves from). Decision 092 —
*"A fourth package emits, and what it emits is served rather than shipped"* (2026-09-12) — ruled the
emitting set four and the distribution set three **deliberately**, and named this ticket's question
as the one it does not pre-empt.

**(b) M3's done-when names `quorum open` and no ticket in this milestone builds it.** Verified at
that gate: the milestone's list is Q-0013 to Q-0019 plus Q-0118 to Q-0124, `packages/cli` declares
**no dependency on `@quorum/server`**, and there is no `open` command in `packages/cli/src/`. So
nothing in the CLI can start a daemon, and the done-when line *"`quorum open` starts daemon +
browser; CLI and UI can both answer the same gate"* has no owner.

## What it must decide

**Either `@quorum/web` becomes a fourth tarball** — which makes the distribution set four, moves
five registers, and requires the app to **stop being `private: true`**, colliding with decision
078(d) until Q-0029 in M6 — **or `@quorum/cli` ships the bundle beside its templates**, on Q-0093's
precedent, which requires **one package's emitted artifact to become a tracked or copied asset of
another**. That second shape is a write `build.test.ts`'s census reports by construction: `:558`
asserts the build wrote nothing outside every emitting package's own `dist/`, so a cross-package
asset copy is exactly what that census exists to catch, and whether it can express one at all is
part of the work rather than an implementation detail.

**Whether (b) is this ticket or its own** is the first thing to settle. They share a subject — what
an adopter who installed Quorum can actually open — and they are separable: (a) is packaging and (b)
is a command that needs `packages/cli` to depend on `packages/server` for the first time. Measure the
criteria count before deciding, on Q-0013's and Q-0122's own precedent.

## Start by measuring

1. **The bundle's size**, once Q-0122 has built one — there is nothing to measure before that.
2. **Whether a tarball carrying it lengthens the cold-clone install.** Q-0014 measured the cold store
   **doubling** — 5.1 s to 10.4 s and +50 MB — for the app's *dependencies* alone, and M6's budget is
   thirty minutes for a stranger from clone to first gate. The 50 MB is what scales on a slow link,
   not the seconds.
3. **Whether `build.test.ts`'s census can express a cross-package asset copy**, before choosing the
   shape that needs one.

**Read Q-0122's closing entry first**, and decision 092 with it.

## Sequencing

**After Q-0122**, which creates the bundle this ticket distributes; (a) has no subject until one
exists. **p2** — it is on the cold-clone path M6 turns on, which is why it is not p3, and nothing is
broken for a workspace user today, which is why it is not p1.

## Settled 2026-09-12: (b) is its own ticket, and it is Q-0126

The body above says *"Whether (b) is this ticket or its own is the first thing to settle."* Settled
the same day, on a fact that was not in front of anyone when the body was written: **(b) acquired a
blocker (a) does not share.**

`packages/cli`'s AC-11 (`frame.source.test.ts:599`) forbids **every** production module in that
package from importing `node:child_process`, because *"every read and every spawn goes through
`@quorum/core`"*. Opening a browser is a spawn. So `quorum open` owes a new primitive in `core` and
a ruling on where something that is neither git, backlog, adapter nor engine belongs — work with no
bearing at all on how a tarball obtains the UI, which is this ticket's subject. Two subjects, one of
which is packaging and one of which is a process-spawning primitive.

**What the two still share is this ticket's question**, and Q-0126 names it as blocking at its own
gate: `@quorum/cli` importing `@quorum/server` breaks the packed path exactly as shipping the bundle
does, for the same `workspace:*` reason (Q-0098 M-8). So **this ticket's ruling now governs two
packages rather than one** — `@quorum/web` and `@quorum/server` — and the shapes it weighs are
unchanged: a fourth (and fifth) tarball, or `@quorum/cli` carrying another package's emitted artifact
as its own asset. **Q-0125** makes `@quorum/server` the fifth emitter and deliberately leaves the
distribution set at three, so by the time this ticket runs, **two** packages emit and are not
distributed rather than one. That strengthens the case for ruling it once here.

## Measured 2026-09-15, after Q-0125 and Q-0126 both landed

**The subject moved twice while this ticket sat, and both moves narrow it.** Q-0125 made
`@quorum/server` the fifth emitter with an `exports` map and left it undistributed; Q-0126 gave
`@quorum/cli` an `optionalDependencies` edge to it and a `quorum open` command. So the state a
packed install is in today is **decided and tested**, not accidental:

    @quorum/cli   dependencies         @quorum/core, @quorum/shared
                  optionalDependencies @quorum/server
                  files                dist, templates
    apps/web        private: true   files: none   exports: none
    packages/server private: true   files: none   exports: YES (Q-0125)

`build.test.ts:2458–2462` asserts that a packed `quorum open` **refuses**, naming the condition and
the remedy, and `:2482` that the workspace one does not. That is *"An optional edge says the daemon
may be absent, and never why"* (2026-09-14) working as ruled — and that entry names **this ticket**
as the one that either supersedes it or leaves it standing. So this ticket inherits a stated
obligation rather than an open question.

### The three measurements the body asks for

**1. Emitted bytes.** `apps/web/dist` **316 K in 3 files**; `packages/server/dist` **176 K**.
Against `@quorum/cli` 220 K, `@quorum/core` 680 K and `@quorum/shared` 216 K distributed today, both
together are **+492 K on ~1.1 M** — nothing against M6's thirty minutes.

**2. The install closure, which is the figure that actually scales — and the two halves are NOT
alike.** Walked transitively through the installed tree:

    packages/server   3 third-party packages   1.7 MB   hono, @hono/node-server, @hono/node-ws
    apps/web          2 third-party packages   8.2 MB   react, react-dom

**`apps/web`'s 8.2 MB is a build-time cost and not a shipped one, and that is the finding.** The
served bundle is **self-contained**: one 300 K JavaScript file, and a grep for a bare runtime
specifier in it returns **nothing**, so React is already inside and nothing resolves from
`node_modules` when a browser runs it. The daemon is the opposite — its emit imports `hono` at run
time, so **1.7 MB across three packages genuinely must be installed** and no asset-copy shape avoids
it.

So the two packages decision 092 and 093 put in one class — *emits and is not distributed* — want
**different answers**, which neither entry anticipated. The UI is a static asset; the daemon is
executable code with a closure.

**3. Can `build.test.ts`'s census express a cross-package asset copy? Yes — the body says no.** That
claim was *"`:558` asserts the build wrote nothing outside every emitting package's own `dist/`, so a
cross-package asset copy is exactly what that census exists to catch."* Read, the clause filters
writes against **every emitting package's own `dist/`**, so a copy landing in
`packages/cli/dist/web/` is inside a permitted prefix, and `agreesWithTheDeclaration` then matches it
against the root's `outputs: ["dist/**"]`. **The census permits it.** What it forbids is writing into
*another* package's directory, which is not the shape proposed.

**The real obstacles are two others and neither is in the body.** `turbo run build --dry` shows
`@quorum/cli#build` depending on `@quorum/core#build` and `@quorum/shared#build` only —
`dependsOn: ["^build"]` is topological and `@quorum/cli` does not depend on `@quorum/web` — so **the
copy would read a `dist/` that may not exist yet**. And `apps/web/dist` would have to become a
declared **input** of `@quorum/cli#build`, or a cache hit replays a stale bundle, which is verbatim
decision 092 clause 5's hazard.

### The Q-0093 precedent does not transfer cleanly

The body offers *"`@quorum/cli` ships the bundle beside its templates, on Q-0093's precedent"*.
Measured: `packages/cli/templates/` is **20 tracked files** — source — while `apps/web/dist` is
**gitignored**. So that phrase is two different proposals: **copy at build time**, which needs the
two fixes above and keeps the artifact reproducible, or **track a built bundle**, which contradicts
the glossary's *"gitignored and reproducible from the commit"* and makes a commit carry an emit.

### A ruling this ticket owes that nobody has named: `react` as a dependency

If `@quorum/web` is distributed, its manifest must change, and that is **not a tidy-up**.
`apps/web/test/package.test.ts:96–99` pins `dependencies` to exactly
`['@quorum/shared','react','react-dom']` under the comment *"The two that ship to a browser are
dependencies, and the build-time ones are not. The division is the claim: what a bundle contains
against what only builds or tests it."*

That division is **correct under its own framing and wrong under npm's, and for a bundler the two are
opposites**: the existing rule reads *dependency* as *what ends up in the bundle* (React does, so it
is one); npm reads it as *what must be installed alongside the tarball* (a self-contained bundle needs
nothing, so React must not be one). Packed as it stands, a distributed `@quorum/web` would install
**8.2 MB of React the bundle already contains**. Nothing is broken today because nothing packs it —
**distribution is what activates it** — which is what makes it this ticket's to rule rather than a fix
to slip in elsewhere. If the ruling keeps `@quorum/web` undistributed, the existing division stays
correct and nothing moves.

## Ruled at the gate, 2026-09-15: tarballs four and five

**The maintainer ruled that `@quorum/web` and `@quorum/server` both become distributed**, so the
local distribution set goes from three to five and matches the emitting set again. Two corrections
to how that choice was put, both made before any work began:

**1. `private: true` does NOT have to move, and this does not touch 078(d).** The option was
described as *"files declared, private dropped"*. Measured: all three packages distributed today —
`@quorum/cli`, `@quorum/core`, `@quorum/shared` — carry `"private": true` **and pack**, because
`pnpm pack` does not refuse a private package; only `npm publish` does, and
`pnpm pack --dir packages/core` was run to confirm it. So privacy is orthogonal to local
distribution, **078(d)'s refusal of registry-resolved `npx quorum` is untouched, and Q-0029 stays
where it is**. What the ruling actually costs is `files`, the register moves, and the react demotion.

**2. The CLI cannot find the bundle by the path it uses today, and that is a third piece of work.**
`packages/cli/src/open.ts` computes `BUNDLE = new URL('../../../apps/web/dist/', import.meta.url)`,
and its own docblock already records what that means outside the workspace: *"On a packed install
this file sits at `node_modules/@quorum/cli/dist/`, so BUNDLE resolves to a path with no meaning
there"* — which is why the refusal order is daemon, then project, then bundle. Once `@quorum/web` is
a tarball it lands at `node_modules/@quorum/web/dist/`, so the CLI must locate it **by package name**.
**Constrained**: `packages/cli` may import no `node:url` (`frame.source.test.ts:186`), so
`fileURLToPath` is out — but `import.meta.resolve` yields a URL string and Q-0126 already widened the
seam to `string | URL` for exactly this class of reason. Whether `@quorum/web` therefore needs an
`exports` map, and of what shape for a package nothing imports as a module, is this ticket's.

## What the entry must rule, and it supersedes one

A decision entry is owed before code and `developer-generalist` may not write one.

1. **The local distribution set is five**, and the emitting set and the distribution set are the same
   five again — which un-does the split decision 092 made on 2026-09-12 and 093 widened on
   2026-09-13. Both are named, neither is edited.
2. **It supersedes *"An optional edge says the daemon may be absent, and never why"* (2026-09-14)**,
   which says so of itself: *"when Q-0124 rules a distribution route, the optional edge becomes a
   required one, the import may become static, and this entry is superseded rather than amended —
   the exemption it authorises is deleted, not widened."* So `@quorum/cli`'s
   `optionalDependencies` becomes `dependencies`, and `cli-version.test.ts`'s clause-D register —
   that clause's only permitted entry — is **deleted rather than kept**.
3. **`react` and `react-dom` move to `devDependencies`**, inverting `apps/web/test/package.test.ts`'s
   landed division on the ground that *what a bundle contains* and *what npm must install beside a
   tarball* select opposite sets for a self-contained bundle. Measured: 8.2 MB that the 316 K bundle
   already contains.
4. **`private: true` stays on all five**, with the reason recorded so a later reader does not read
   distribution as publication.

## What to measure before implementing

- **The packed fixture is the oracle**, not reasoning: `build.test.ts`'s *"the packed set installs
  outside the workspace with the registry dead, and runs"* installs the distribution set **together**
  against a dead registry. Five tarballs rather than three is the change, and `DISTRIBUTION` at
  `:2133` is the one list to move.
- **`quorum open` must be shown working in a packed install**, which is the whole point and which no
  test can currently assert — `:2458–2462` asserts the opposite, that it refuses. That assertion
  **inverts** rather than being deleted.
- **The cold-clone cost**, since this is M6's path: +492 K emitted and +1.7 MB of `hono` closure,
  against Q-0014's measured +50 MB for the app's own dependencies. Re-derive rather than trust these.

## The packaging cost, measured 2026-09-15 rather than estimated

Taken in a throwaway worktree with `files: ["dist"]` declared on both new members and a forced build,
by packing all five with `pnpm pack`:

    @quorum/core    184 K        @quorum/web      100 K   (new)
    @quorum/cli      72 K        @quorum/server    48 K   (new)
    @quorum/shared   52 K
    ------------------------------------------------------------
    three today     308 K        five             456 K

**So the ruling costs +148 K of tarball, a 48% increase on 308 K** — and not the +492 K the `dist`
figures suggest, because those are uncompressed and a bundle compresses well. What each new tarball
carries was read rather than assumed: `@quorum/web` is **5 entries** — `dist/index.html`, the hashed
`.js` and `.css`, its manifest and the licence — and `@quorum/server` is **24**, its `dist` emit.

**The install closure is where the real cost sits, and it is one-sided.** `@quorum/server` drags
`hono`, `@hono/node-server` and `@hono/node-ws` — **1.7 MB installed** — because its emit imports
them at run time. `@quorum/web` drags **nothing**, *provided* clause 3's demotion happens; left as
`dependencies`, it would pull **8.2 MB of React the 100 K tarball already contains**.

**Against M6's thirty minutes this is comfortable**, and the figure to watch is the 1.7 MB rather than
the 148 K. For scale, Q-0014 measured the cold *store* at +50 MB for `apps/web`'s own dependencies,
which is the number this ticket must not reproduce on the install path — and the demotion is what
keeps it off.


## The bundle locator works, and the narrow shape is the one precedent already chose

Tested 2026-09-15 against Node on a throwaway package, because it is this ticket's one genuinely open
technical element and the codex candidate specified it without running it.

**`import.meta.resolve` resolves a non-module asset through an `exports` map.** It is path resolution
rather than loading, so the target need not be importable JavaScript — an `.html` file resolves:

    A.  exports { "./dist/index.html": "./dist/index.html" }
        import.meta.resolve('@probe/web/dist/index.html')  ->  file:///…/dist/index.html   OK

    B.  exports { "./dist/*": "./dist/*" }
        '@probe/web/dist/index.html'      ->  file:///…/dist/index.html        OK
        '@probe/web/dist/assets/app.js'   ->  file:///…/dist/assets/app.js     OK

**Shape A is the one to take, and the reason is a landed refusal rather than taste.** B publishes the
whole emit as a wildcard subpath, which is exactly what `packages/cli/src/package.test.ts` already
refuses for `@quorum/core` — *"a `./*` key defers what a consumer may import to whoever types one
first"* — and which Q-0125 re-asserted for `@quorum/server` (*"it publishes no subpath pattern, so no
internal module is public by accident"*). The daemon does not need the assets exported: it serves them
from the **directory**, which it derives from the entry's own resolved path, so exporting one file
gives the CLI everything it needs and gives a stranger nothing else.

**It returns a `file://` URL**, which is what `packages/cli` needs — that package may import no
`node:url`, and Q-0126 already widened `ServeOptions.bundle` to `string | URL` for this exact class of
reason. So the locator lands inside the seam that already exists rather than needing a new one.

## Corrections to this operator's own measurements, 2026-09-15

The requirements run's iteration 1 refuted four things in the *Measured 2026-09-15* block above. All
four are confirmed and the block is wrong where they say it is; it is left in place rather than
rewritten, because how the errors were made is the useful part.

**1. The install closures were measured with a walk that could not see transitive dependencies.**
Stated as `packages/server` **3 packages / 1.7 MB** and `apps/web` **2 / 8.2 MB**. Re-measured
resolving each candidate through `realpath` — which is what the first walk did not do, so pnpm's
`.pnpm` store was never entered and a dependency's own dependencies were invisible:

    packages/server   4 packages   1.8 MB   hono, @hono/node-server, @hono/node-ws, ws
    apps/web          3 packages   8.3 MB   react, react-dom, scheduler

`ws` and `scheduler` are the two that were missing. **The sizes barely moved and the counts were
wrong, which is the part that matters** — a closure stated as three packages when it is four is a
measurement, not a rounding.

**2. Two of the three distributed `dist` sizes were stale.** Stated as cli 220 K and core 680 K;
measured now, **cli 256 K and core 696 K** — both grew with Q-0126, which landed between the two
readings. `shared` 216 K was right. The **tarball** figures are unaffected, having been taken by
actually packing: 308 K for three against 456 K for five.

**3. `DISTRIBUTION` is not "the one list to move".** `build.test.ts` resolves a member as
`path.join(WORKSPACE, 'packages', name)` at `:2270` and `:2302` among others, so `apps/web` — which
is not under `packages/` — cannot join that list without those helpers changing too. The body's
sentence would have sent an implementer to one constant for a change that is several.

**4. Two line citations pointed at the wrong assertion.** The packed refusal is
`build.test.ts:2461–2462`; `:2482` is the **damaged-daemon** case and the workspace assertion is
`:2134`, inside the Q-0126 AC-8 block. An implementer following the body would have chased the wrong
subject.

**And one the run found that no measurement of mine looked for: neither `apps/web` nor
`packages/server` declares a `license`,** while all three currently distributed packages carry
`Apache-2.0` — verified. Latent exactly as the `react` division is latent: **distribution is what
activates it**, and a tarball is where it would otherwise be noticed.

