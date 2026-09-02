# Errata — Q-0096

Corrections and rulings against `requirements/merged.md`, dated, written during the loop as soon as
the contradiction is provable rather than at the exhaustion gate — *"An erratum is the last repair,
not the first"* (2026-08-30), as amended by *"A reviewer approves the change it asked for"*
(2026-08-29).

## E-1 — AC-1 proves that Node *selects* `dist/index.js`, not that it executes one — 2026-09-02

**Ruled: the *Test:* sketch's verb is superseded; the criterion is unchanged.** Written by hand at
the human's ruling, on the draft chore run 2's implement step supplied rather than requested
(Q-0062 round 3's precedent). Run 2's review returned it as its single major and named an erratum as
one of its two acceptable remedies; the implementer took the other, and this entry puts the
supersession on the record so the next reviewer inherits a ruling rather than re-raising the finding.

### The contradiction

AC-1's *Test:* sketch asks to *"additionally **import** from a Node process outside the source
directories, without a repository-relative path and without a Vitest alias, so the claim is about
package metadata rather than about the bundler."*

An `import` of `@quorum/core` **cannot succeed in this ticket**, and that is by design rather than by
omission: under *"The emit serves the binary, and no test verdict moves behind it"* (2026-09-02)
clause (a), the emitted artifact is Q-0097's AC-7 to AC-14 in full — the `build` task, its `outputs`
and its three replay criteria. Building a `dist/` here to make one assertion pass would be
implementing a sibling ticket's central deliverable, which ground rule 3 and the role's own scope
discipline refuse.

### The ruling

**What AC-1 requires is that Node's resolver, reading the export map and knowing no `quorum-source`
condition, selects `./dist/index.js`.** That is clause (b) of the same entry read literally — *"a
proof that a plain `node` process, which knows no such condition, gets `dist/`"*. Resolution is where
an export map is read; execution is what needs the file on disk, and the file is Q-0097's. Four of
the sketch's five clauses are satisfied unchanged — a spawned Node process, a bare specifier, no
Vitest, and a claim resting on package metadata alone. Only the verb moves, and it moves because a
ruling written after the requirement binds this ticket through AC-0.

Verified by hand before this entry was written, from `packages/cli` in the implement worktree:

```
node --input-type=module -e "console.log(import.meta.resolve('@quorum/core'))"
  → file:///…/packages/cli/node_modules/@quorum/core/dist/index.js
```

### And an assertion requiring the import to *fail* is refused

This is the half that is a correction rather than a narrowing, and it is why the erratum is worth
landing even though the code no longer contradicts anything. `packages/core/dist` is gitignored
(`.gitignore:4`), so an assertion whose passing condition is `ERR_MODULE_NOT_FOUND` has a verdict
that depends on whether the checkout happens to hold a gitignored directory — green in a fresh
clone, in CI and in an integrate worktree, red in any working checkout that has ever run a build.
That is *"A test's verdict is a property of the commit, not of the checkout or the account"*
(2026-08-30), and it is the same shape as Q-0072's instance, where two directories a working
checkout has and a fresh clone does not decided a verdict.

It is also a guaranteed breakage rather than a latent one: the moment Q-0097 lands the build task,
`dist/` exists wherever the suite runs and the assertion is red **everywhere, including CI**. A
positive resolution proof needs no replacing, because it reads the map and the map does not move
when the file appears.

### What this erratum does not do

It does not widen AC-1, and it does not discharge anything owed elsewhere. `@quorum/shared`'s
manifest still names `./src/index.ts` for both conditions — measured 2026-09-02, a plain Node process
resolves it to `packages/shared/src/index.ts` — and 21 production files in `packages/core` import it
by package name, so the `dist/index.js` Q-0097 emits will carry `import … from '@quorum/shared'` and
die under Node unless that manifest gains the same conditional map. **No criterion of Q-0096 names
it**, it is reported rather than fixed here, and Q-0097 inherits it.
