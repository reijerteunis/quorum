# `core` is organised in folders named after the port's children; `shared` stays flat — 2026-08-26

**Decision:** `packages/core/src` is organised into one folder per module, and the folder names are
the names the port already cut its children by: `adapters/`, `backlog/`, `contracts/`, `engine/`,
`fanout/`, `git/`, `lint/`, `run-history/`. `index.ts` stays at `src/` root, byte-unchanged. Tests
stay colocated with the code they test. **`packages/shared/src` stays flat**, and that asymmetry is
deliberate rather than an oversight — see below.

The layout is derived rather than invented: `docs/06-development-plan.md` cut Q-0009 into fourteen
children named `core/git`, `core/backlog`, `core/lint`, `core/contracts`, `core/adapters`,
`core/fanout`, `core/run-history` and `core/engine`, and `04-architecture.md` already describes
`adapters/*` with a per-adapter `capabilities.ts`. Every child therefore already names its folder;
this entry only writes down that the folder is real.

**Why now, before Q-0044.** Eleven children are still to be written. `core/src` holds eleven flat
files today and the remaining children add roughly twenty more — `engine.js` alone is 1,113 lines
across four tickets. Restructuring after they land means re-pointing eleven ticket bodies, eleven
sets of colocated tests and eleven sets of import paths; doing it first costs one move and makes
every child's target path obvious from its own title. Raised by Ruud on 2026-08-26: *"I notice you
do not really divide code in folders in the packages… for sure when we are extending the code
base."*

**Why `shared` stays flat, which is the half that looks inconsistent.** `shared` is ten leaf
declaration modules, it is finished as of Q-0041, and it is the one package whose house rules
actively forbid folders: `packages/shared/src/index.test.ts` pins `index.ts` to lines matching
`^export \* from '\./[a-z-]+\.js';$`, which a `./flow/index.js` path does not satisfy. Folders there
would mean editing a landed, reviewed test to permit a structure nothing needs — ten flat
declaration files is not a legibility problem, and *"declarations only"* is the whole package.
`core` is the package that grows.

**The three hazards this move has to clear, recorded because each is a way to land it wrongly.**

1. **`coreSourceFiles()` is not recursive.** `packages/core/test/corpus.ts:22–28` uses
   `fs.readdirSync(dir)` and filters `.ts`. Move the sources into folders and it returns
   `index.ts` alone — its `if (!files.length) throw` guard does not fire, because one file remains.
   Three landed tests iterate it to assert house rules over *every* core source, and all three would
   quietly narrow to one file while still reporting green. That is *"a check that skips its subject
   must not report success"* (2026-08-25) arriving through a directory listing. The helper becomes
   recursive **in the same change**, its returned key becomes a `src`-relative path, and its
   emptiness guard is joined by one that fails if the corpus is implausibly small.
2. **A landed test in another package reads a `core` path.**
   `packages/shared/src/project.test.ts:106` reads `packages/core/src/project.ts` literally, and
   `shared/src/index.test.ts:52` byte-pins `packages/core/src/index.ts`. The first moves with the
   file; the second must not move at all.
3. **The three `.source.test.ts` files look up entries by bare filename** (`name === 'git.ts'`),
   which a relative-path key breaks. They are the tests that would otherwise catch (1).

**Alternatives considered:** (a) Leave `core` flat until the port completes and reorganise at the
cutover — one move instead of one move, but performed across thirty files and eleven ticket bodies
rather than eleven files and none, and every child written in between would have to be re-pointed
afterwards. (b) Create only `adapters/`, the one folder `04-architecture.md` already names, and
leave the rest flat until it hurts — defensible, and it leaves the question open for eleven separate
tickets to answer differently. (c) Restructure both packages for symmetry — rejected on `shared`'s
pinned `index.ts` above: symmetry is not worth editing a reviewed test to allow a structure the
package does not need.

**Cost accepted:** the two packages are laid out differently, and a contributor will ask why. The
answer is in this entry and in `04-architecture.md`. The move itself touches landed, reviewed tests
in two packages, so it is a ticket with a cross-vendor review (Q-0064) rather than a rename
performed in passing — which is also the rule the repository already has for changes that eleven
later tickets depend on.
