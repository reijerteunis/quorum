# The distribution set is five, and rejoins the emitting set — 2026-09-15

## Decision

`@quorum/web` and `@quorum/server` become tarballs four and five, so **the local distribution set is
five and is the emitting set again**. Q-0122 split the two sets on 2026-09-12 and Q-0125 widened the
split on 2026-09-13; this closes it, three days later, because the thing that opened it — a packed
install with no UI and no daemon — is what this entry exists to fix.

1. **Five packed, and the two sets coincide again.** *"A fourth package emits, and what it emits is
   served rather than shipped"* (2026-09-12) and *"A fifth package emits, and `resolved` is not a
   synonym for `distributed`"* (2026-09-13) are **named and not edited**, and neither is reversed:
   their distinction between a *resolved* emit and a *served* one is a fact about **shape** and
   survives intact. What changes is only that both shapes are now shipped. That the two sets
   coincide today is a property of the moment, not a rule restored — a sixth emitter could part them
   again, and 093's definition of *resolved* by mechanism rather than by membership is what makes
   that cheap.

2. **`private: true` stays on all five, and 078(d) is untouched.** Measured rather than assumed:
   the three packages distributed today all carry `"private": true` **and pack**, because `pnpm pack`
   does not refuse a private package — only `npm publish` does. So *distribution* here means **a
   tarball this repository packs and installs**, never publication, and *"The emit serves the
   binary"* (2026-09-02) clause (d) still refuses registry-resolved `npx quorum`, still for the same
   reason, still until Q-0029 in M6. **Nobody may read this entry as moving that.**

3. **A distributed-but-unpublished package owes `files` and a `license`, and does not owe `engines`.**
   `files` because a tarball with no allow-list ships the working tree — Q-0098 measured 40 files
   against 17. A `license` because the three packed today all carry `Apache-2.0` and neither new
   member declares one at all, which is latent exactly while nothing packs them. Not `engines`: the
   root declares the floor the workspace is tested against, and a per-package copy is that claim
   written again and free to drift.

4. **It supersedes *"An optional edge says the daemon may be absent, and never why"* (2026-09-14),
   and the import becomes static.** That entry said the optional edge would become required and *"the
   exemption it authorises is deleted, not widened"* — while clause 4 also said the import *"may"*
   become static. **Those two only cohere one way, and the register is what decides it**:
   `cli-version.test.ts`'s `deferredOffenders` reports in **both** directions — a file resolving a
   module from an expression with no entry, *and* an entry for a file that no longer does — so the
   exemption cannot be deleted while the import stays dynamic. The import is therefore **static**,
   the register is deleted, and `isDaemonUnresolved` goes with it. "May" was the wrong word and this
   entry is where it is corrected.

   **What that costs is real and is accepted rather than waved past.** `main.ts` imports every command
   module, so a static daemon import loads `@quorum/server` on `quorum board` and every other
   invocation, and a daemon damaged in place would break all of them rather than only `open` — the
   distinction Q-0126 spent a review round building. It is accepted because a **required** dependency
   removes the case that distinction was for: *absent* stops being reachable, and what remains is a
   corrupt install, which is a thing every command should fail loudly on rather than one command
   report politely.

   **And it carries a trap worth naming here, because it reads as unrelated to its cause.**
   `namedAsWritten` scans the file **as written**, so deleting the register requires
   `packages/cli/src/open.ts` to hold **zero** occurrences of `import(` — comments included, and
   including the `typeof import('@quorum/server')` type query at `:213` that a static import makes
   unnecessary anyway. A docblock rewritten to explain that the specifier *used to be* deferred
   re-arms the clause.

5. **`react` and `react-dom` move to `devDependencies`, and so does `@quorum/shared`.** Not a
   tidy-up: it inverts `apps/web/test/package.test.ts`'s landed division, *"the two that ship to a
   browser are dependencies, and the build-time ones are not"*. That division reads *dependency* as
   **what ends up in the bundle**; npm reads it as **what must be installed beside the tarball**, and
   for a self-contained bundle those select **opposite** sets. Measured: the served bundle is one
   300 K file with no bare runtime specifier surviving in it, so React is already inside — and
   packed as the manifest stands, a consumer would install **7.94 MB of React the 100 K tarball
   already contains**. The evidence is the bundle's self-containment; the demotion is what follows
   from it.

## Alternatives considered

**`@quorum/cli` carries the bundle as a build-time asset, and only the daemon becomes a tarball.**
The strongest alternative, and it is cheaper for the UI half: the bundle is a static asset with no
runtime closure, and `build.test.ts`'s whole-copy census **permits** a copy landing inside
`packages/cli/dist/` — measured, against the ticket body's claim that it forbids one. Refused on what
it costs elsewhere: it needs a `dependsOn` edge that does not exist (`@quorum/cli#build` depends on
core and shared only, so the copy could read a `dist/` that is not built yet) **and** a declared input
on `apps/web/dist`, or a cache hit replays a stale bundle — which is 092 clause 5's hazard in its
sharpest form. Two mechanisms to avoid one tarball, against a measured **+451,209 B** for taking both.

**Track the built bundle in `packages/cli`, on Q-0093's templates precedent.** Refused because the
precedent does not transfer: those 20 template files are **source**, while `apps/web/dist` is
gitignored. Tracking it would make a commit carry an emit, against the glossary's *"gitignored and
reproducible from the commit"*.

**Publish, rather than pack.** Out of scope and refused by 078(d), which this entry deliberately does
not move. Clause 2 exists so that nobody reads five tarballs as a step toward it.

**Leave the packed install refusing `quorum open`.** What ships today, and it is not broken — the
refusal is true and Q-0126 built it deliberately. Refused because M6's cold-clone test is a stranger
reaching a first gate, and a UI that exists on one of the two installation paths this repository
claims is a product with a hole in the path it is about to be judged on.

## Why

**Because the split was never the goal — it was the honest description of a workspace that emitted
more than it shipped.** 092 drew it because `apps/web` emitted and nothing packed it; 093 kept it
because `@quorum/server` did the same. Both entries said, in terms, that how an installation outside
the workspace obtains those artifacts was a question they were not answering. This answers it, and
the sets coinciding again is the *consequence* rather than the aim.

**The part to read carefully is clause 2.** *Distributed* and *published* have been one word's
distance apart for this whole milestone, and 078(d) is the entry standing between them. Making a
package packable does not make it publishable, and the measurement — private packages pack, only
publish refuses — is what lets five tarballs exist without touching that. An entry that left this
implicit would be read, correctly, as having moved it.

**Clause 4 is the one this entry owes an apology for.** 094 said the exemption would be *deleted* and
that the import *may* become static, and those cannot both be free choices once the register reports
in both directions. That ambiguity was mine, it survived a gate, and the requirements run is what
caught it — which is the argument for the gate, not against it.
