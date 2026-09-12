# A fourth package emits, and what it emits is served rather than shipped — 2026-09-12

## Decision

`apps/web` declares a `build` script, so **the emitting set is four and the local distribution set
stays three**. The two were the same three packages from Q-0097 until now, and this is where they
come apart.

1. **A served bundle IS an emitted artifact.** The term widens; no third kind is coined. **Emitted
   artifact** stops saying *"the JavaScript and declaration files"* and stops saying that the
   emitting packages *"are also the local distribution set"* — it becomes what a **build task**
   writes under a package's `dist/`, gitignored and reproducible from the commit, of which there are
   now two shapes: the **resolved** emit of the three distribution packages, which Node and a packed
   install import, and the **served** bundle of `apps/web`, which a browser is handed over HTTP and
   which nothing imports.
2. **`apps/web` keeps `private: true`** and declares no `exports`, no `files` and no `bin`. It emits
   and is not distributed. How an installation outside this workspace obtains the UI is a separate
   question and a separate ticket; nothing here answers it, and the packed install has no web app
   until something does.
3. **A bundler is admissible for the fourth emitter.** *"The emit serves the binary, and no test
   verdict moves behind it"* (2026-09-02) says at (a) *"No bundler and no new dependency"*; that
   clause is **scoped to the three `tsc` emitters it was written about**, and Vite is already a
   dependency of this workspace, so no new one arrives.
4. **078(b) holds unchanged.** No `^build` edge is added to `test` or `typecheck`. The suites resolve
   TypeScript source through the `quorum-source` condition and **no test verdict moves behind the
   bundle either** — which is 078's central property surviving a second emitter rather than being
   renegotiated by one.
5. **The hazard the vocabulary must carry is a stale page.** 078's argument is that a non-empty
   `outputs` replays an **artifact** where `lint`, `typecheck` and `test` replay only a verdict, and
   that an artifact something *executes* fails differently from a stale tick: *the tick lies about
   the past, the artifact lies about the present*. A bundle a browser runs has that hazard in its
   sharpest form — a cache hit can serve a page built from code nobody is looking at any more. That
   is the whole reason the term widens rather than splitting.
6. **No glossary term is coined**, so neither 22-term list moves. `CLAUDE.md:13` and
   `docs/README.md` carry the same curated 22 of the glossary's 36; widening an existing entry is
   not adding one, and Q-0103 erratum E-2 keeps `CLAUDE.md` the human's to write.

This **extends** *"The emit serves the binary, and no test verdict moves behind it"* (2026-09-02)
rather than reversing it. Two of that entry's clauses are narrowed by name — (a)'s *"no bundler"* to
the three it describes, and its **Why**'s containment argument that the emit *"is consumed by exactly
one thing, the binary, and by exactly one suite"*, which a served bundle makes false by being a
second consumer. Everything else it decided stands.

## Alternatives considered

**Coin a third kind beside the artifact and the binary.** Defensible, and it was the reading Q-0014's
gate deferred: a bundle is *served* rather than *resolved*, so 078(b)'s *"what Node and a packed
install get"* stays literally true of exactly three packages, and the glossary's existing sentences
would need no edit. Refused on which reading leaves the **hazard** covered. The term is load-bearing
because of clause 5 and nothing else, and a third kind would put the artifact most at risk — the one
a browser executes — **outside the vocabulary that carries the warning**, leaving `dist/**` replaying
a bundle with no entry saying what that costs. A vocabulary is not a taxonomy of how things are
produced; it is where the thing that can go wrong is written down.

**Leave `apps/web` without a build task and serve source through Vite in production.** Refused: it
makes the dev server a runtime dependency of the product and gives M3's `quorum open` nothing to
serve, while `04-architecture.md` has said since 2026-08-22 that the server serves the built app.

**Make `apps/web` a fourth tarball now**, so the emitting set and the distribution set stay
identical. Refused as out of scope rather than wrong: it needs the app to stop being `private: true`,
which 078(d) refuses until Q-0029 in M6, and it moves five registers. It is the live question of the
successor opened at this gate, and this entry deliberately does not pre-empt it.

**Say nothing and let the register catch it.** Refused because the register already did: 078(c)
built the emitting set as a derived list precisely so that *"a fifth package that starts emitting"*
fails closed, and `packages/core/src/test-discovery.test.ts` goes red on a fourth. A guard firing is
the beginning of a decision, not a substitute for one — and this entry exists because an emitting set
of four falsifies three clauses of the glossary and two of 078, none of which a red test can rule.

## Why

**Because the emitting set and the distribution set stopped being the same three packages, and every
sentence in this repository that described them assumed they never would.** The glossary said the
emitting packages *"are also the local distribution set"* — a claim that was true when it was
written and is now false in one direction: four packages emit and three are distributed. Q-0014's
gate saw this coming and deferred it rather than guessing, which is why the ruling arrives with the
build task rather than after it.

**The narrowing of 078(a) is the part to read carefully.** That clause was written about three
packages whose build is `rm -rf dist && tsc -p tsconfig.build.json`, in a document arguing that the
emit exists to make a binary runnable. A browser bundle cannot be produced that way — a browser needs
one graph of modules, its CSS and its asset URLs resolved — so *"no bundler"* was never a rule about
this case; it was a description of the case it was about. Saying so explicitly is cheaper than
leaving a future reader to decide whether a landed entry forbids the only way the work can be done,
and **never contradicting a landed entry silently** is what `docs/DECISIONS.md` requires.

**What this deliberately does not do** is widen the term to cover anything a task happens to write.
The two shapes are named — resolved and served — and both are `dist/**`, gitignored, reproducible
from the commit, and subject to clause 5's hazard. A third shape arriving later owes its own entry,
and the derived register is what will make that visible.
