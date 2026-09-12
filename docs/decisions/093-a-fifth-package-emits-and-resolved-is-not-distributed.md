# A fifth package emits, and *resolved* is not a synonym for *distributed* — 2026-09-12

## Decision

`@quorum/server` declares an `exports` map and a `build` script, so **the emitting set is five and
the local distribution set stays three**. Q-0122 separated those two sets eight hours earlier; this
separates them a second time, in the other direction, and that is what forces the entry.

1. **`resolved` names what Node resolves, never what is packed.** *"A fourth package emits, and what
   it emits is served rather than shipped"* (2026-09-12) coined *resolved* and *served* as **shapes**
   and then, in its own Decision clause 1, defined the first as *"the resolved emit of the three
   distribution packages"*. That wording was exact when written and is now false: it could name the
   shape by the distribution set only because at four emitters the two partitions coincided.
   `@quorum/server` is the first artifact that is **resolved and not distributed**, so the two axes
   are independent and the vocabulary must say so:

       distributed      │ resolved: shared, core, cli  │ served: —
       not distributed  │ resolved: server             │ served: web

   **Two packages are now the difference** between what emits and what ships, not one, and 092's
   *"`@quorum/web` is the difference"* becomes *"`@quorum/web` and `@quorum/server` are"*.

2. **078(a)'s predicate is extended rather than narrowed.** *"The emit serves the binary, and no test
   verdict moves behind it"* (2026-09-02) says a package emits when *"something outside the workspace
   consumes"* it. Nothing outside this workspace consumes `@quorum/server`, and nothing will while
   the distribution set stays three. It emits for a third reason neither that entry nor 092 states:
   **a workspace-internal consumer running outside the workspace's own conditions.** `pnpm exec
   quorum` runs `packages/cli/dist/quorum.js` under plain Node; `customConditions` in
   `tsconfig.base.json` and `resolve.conditions` in `vitest.shared.js` are the only two selectors of
   `quorum-source` and neither is in that process; so the import resolves through **`default`**,
   which must name a file that exists. Measured rather than reasoned: from `packages/cli`,
   `import.meta.resolve('@quorum/core')` answers `…/packages/core/dist/index.js`, and a fixture with
   that same map over an absent `dist/` fails `ERR_MODULE_NOT_FOUND` naming the missing file.

3. **A non-distributed emitter declares no `files`, as a class.** 078(e) requires `files` in a
   sentence whose whole argument is about what a `pnpm pack` ships, and 092 clause 2 ruled
   `apps/web` exempt **by name**. That exemption is now a rule: a package that emits and is not
   distributed declares no `files`, no `bin` and keeps `private: true`, because `files` on a package
   nothing packs is a claim about a tarball that does not exist.

4. **078(b) holds unchanged, for the third time.** No `^build` edge is added to `test`, `typecheck`
   or `lint`. The suites resolve TypeScript source through `quorum-source`, so **no test verdict
   moves behind the fifth emit either** — 078's central property surviving a third emitter rather
   than being renegotiated by one. 078(a)'s *"no bundler and no new dependency"*, which 092 narrowed
   to the three `tsc` emitters, needs no further narrowing here: this **is** a `tsc` emitter.

5. **An export surface is not a browser-facing one, and the barrier that protected `apps/web`
   changes kind rather than disappearing.** `04-architecture.md` says `apps/web` *"cannot import
   `@quorum/server` at all: it has no `exports` map … where a guard is weaker than an
   impossibility"*. This entry removes that impossibility, and the conclusion survives — a browser
   still may not import this package — but it now rests on `apps/web` declaring no dependency on it.
   **That is already pinned in both directions and needs no new guard**, measured:
   `apps/web/test/package.test.ts:90` holds the justification register against the declared manifest
   both ways and `:98` pins `dependencies` to exactly `['@quorum/shared','react','react-dom']`, so
   adding `@quorum/server` there fails two assertions today, with no change from this ticket. Since
   a dependency edge is the only thing that creates a link, and no link means no resolution, the
   manifest pin is the whole of the protection. **What is owed is therefore the document correction
   and not a criterion adding a guard** — the sentence must state the weaker, true thing rather than
   keep the stronger claim.

This **extends** 092 rather than reversing it, and 092's clause 1 wording is superseded on the one
point named in clause 1 above. Everything else both entries decided stands. **Whether `@quorum/server`
is distributed is not decided here** and stays Q-0124's, becoming urgent at Q-0126: a packed
`@quorum/cli` importing this package would be broken for the `workspace:*` reason Q-0098's M-8
measured, and this ticket adds no consumer at all.

## Alternatives considered

**Rule that no entry is owed, because a fifth emitter is precedented.** This is what the ticket body
guessed — *"the shape is now precedented, which is an argument that it does not"* — and it is the
strongest alternative. A `tsc` emit is not a new shape, 092 explicitly anticipated *"a fifth package
that starts emitting"*, and an entry per emitter is a tax on a derived register that already fails
closed. Refused on 092's own test, which it wrote while refusing the same option: *"A guard firing is
the beginning of a decision, not a substitute for one — and this entry exists because an emitting set
of four falsifies three clauses of the glossary and two of 078, none of which a red test can rule."*
Five sentences of one glossary term and one clause of 092 go false here, and a landed entry is never
edited and never contradicted silently. The count is not what is owed an entry; **the word
*resolved* is**, because it was defined by a set it no longer picks out.

**Amend 092 in place.** Refused by `docs-and-decisions.md` outright — a landed entry is never edited,
and a reversal or correction is a new entry naming the old one. Recorded because the change here is
small enough to be tempting: four words in one clause.

**Distribute `@quorum/server` too, so the emitting and distribution sets stay identical.** This would
make the vocabulary problem disappear rather than solving it. Refused for the reason 092 refused the
same move for `apps/web`: it needs the package to stop being `private: true`, which 078(d) refuses
until Q-0029 in M6, and it moves five registers. It is Q-0124's live question and this entry
deliberately does not pre-empt it.

**Give `packages/server` an `exports` map and no `build` script.** Refused because it is the one
shape that is *worse than today*. Measured on a fixture: an `exports` map whose `default` names an
absent `dist/index.js` fails `ERR_MODULE_NOT_FOUND`, and the map **shadows** any legacy entry rather
than sitting beside it — so a map without an emit typechecks, passes every suite through
`quorum-source`, and fails the moment the binary runs. The two halves land together or not at all.

## Why

**Because Q-0122 split *what emits* from *what ships*, and this is the site that proves the split was
about two axes rather than one exception.** 092 could write *"the resolved emit of the three
distribution packages"* because every resolved emit happened to be distributed. `@quorum/server`
makes that a coincidence of one particular day. A vocabulary that names a shape by a set it merely
coincides with will go false again at the next emitter, and the repair is to define the shape by the
mechanism — what Node resolves through `default` — which cannot drift.

**The narrowing this entry does NOT do is worth naming.** 078(a)'s *"consumed outside the
workspace"* is **extended** rather than scoped away, because unlike 092's *"no bundler"* clause it
was not a description of a case: it was a rule about when a package owes an emit, and it turns out to
have had a second sufficient condition all along that nobody had needed. Saying so is cheaper than
leaving the next reader to decide whether a landed entry forbids an emit the binary requires.

**Clause 5 is the clause I got wrong first, and it is recorded that way.** The hazard is real — an
export surface removes an impossibility, and the scan over `apps/web/src` names `@quorum/core` and
Node builtins but not `@quorum/server`, so it would not catch a direct import. The remedy I first
reached for, extending that scan, is **unnecessary**: the manifest pin one layer earlier is what
governs, because the import cannot resolve without a dependency edge and that edge is asserted
against in both directions. Written down because the difference between *"nothing catches this"* and
*"something else catches this"* is the difference between a criterion and a sentence, and the check
that settles it is one file away from the one that looks like it should.
