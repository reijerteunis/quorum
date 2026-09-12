# Q-0125 — errata to `requirements/merged.md`

Amendments to the merged requirement, decided at or after its gate and binding on the implementer
and the reviewer alike. Each names the clause it supersedes. The rest of `merged.md` stands.

## E-1 — OQ-1 is ruled and its entry is landed; OQ-2, OQ-3 and OQ-4 are ratified as recommended — 2026-09-12

**Supersedes** OQ-1's *BLOCKING* status, GO-1's first half, and every clause of §3 that describes the
entry as owed rather than as landed — AC-3, AC-4 and AC-12 among them. `merged.md` is otherwise
unamended, and every one of its thirteen criteria stands as written.

### OQ-1 — an entry was owed, and it is on `main` before this run starts

The gate ruled **an entry is owed**, on the recommendation §5 makes and for the reason it gives: an
emitting set of five falsifies Decision clause 1 of *"A fourth package emits, and what it emits is
served rather than shipped"* (2026-09-12), and a landed entry is never edited and never contradicted
silently.

**The entry is landed. It is *"A fifth package emits, and `resolved` is not a synonym for
`distributed`"* (2026-09-12)**, `docs/decisions/093-a-fifth-package-emits-and-resolved-is-not-distributed.md`,
indexed in `docs/DECISIONS.md` under `## 2026-09-12` immediately after 092. Cite it by **title and
date**, never by number or file name.

**What it rules, which is what AC-3, AC-4 and AC-12 now implement rather than decide:**

1. **The emitting set is five and the local distribution set stays three.**
2. **`resolved` names what Node resolves through the `default` condition, never what is packed.** Two
   packages are now the difference between what emits and what ships — `@quorum/web`, which is
   *served* and not distributed, and `@quorum/server`, which is *resolved* and not distributed. So a
   live sentence naming `apps/web` as *"the one"* member that is not distributed is false, which is
   §0.1's Correction E.
3. **078(a)'s predicate is extended, not narrowed.** A package also owes an emit when a
   **workspace-internal** consumer runs outside the workspace's own conditions — `pnpm exec quorum`
   under plain Node — which is a second sufficient condition beside *"something outside the workspace
   consumes it"*. Nothing about 078(a)'s *"no bundler and no new dependency"* needs narrowing here:
   this is a `tsc` emitter, which is the case that clause was written about.
4. **A non-distributed emitter declares no `files`, no `bin`, and stays `private: true` — as a
   class.** This is OQ-3, ruled here rather than left to a criterion, and it promotes 092 clause 2's
   by-name exemption for `apps/web` into a rule.
5. **078(b) holds unchanged for the third time**: no `^build` edge on `test`, `typecheck` or `lint`,
   and no test verdict moves behind the fifth emit. AC-8 is unaffected.

**The implementer is therefore NOT blocked on OQ-1, and `blocked` is the wrong verdict for it.** The
ruling exists, on `main`, cited above by title and date; what remains is to implement it. If any
*other* criterion needs something outside `developer-generalist`'s authority, `blocked` is still
correct for that — the flow's own instruction stands unamended.

### OQ-2 — shape (A), the synthesised link

**Ratified as recommended.** AC-7(a) obtains its link by creating a `node_modules/@quorum/server`
symlink in a temporary directory it makes and removes, named in the test as standing in for the
dependency edge this ticket may not create. Shape (B) — a root `devDependency` — is **refused** for
the reason §5 gives: `@quorum/cli`'s root entry exists because that package has a `bin` that
`pnpm exec quorum` must resolve, and `@quorum/server` has none, so (B) would be a dependency declared
to make a test resolve. AC-13 and non-goal 1 stand.

### OQ-3 — no `files`

**Ruled by the entry**, clause 4 above, rather than by a criterion. No `files`, no `bin`,
`private: true` retained.

### OQ-4 — the title stays

**Ratified as recommended.** *"resolves, exports and emits"* over-claims the first verb, and §1
carries the correction, which is where §0.3 put it. A title is not a criterion, and renaming a `p1`
ticket mid-flight moves citations in `docs/06-development-plan.md`, in Q-0124 and in Q-0126 for no
change in behaviour.

### What the gate does NOT amend, said so it is not inferred

**§7's seam stands exactly as written.** Thirteen criteria, no split, and if the revise loop exhausts
on the prose half the remedy is **a second erratum splitting AC-10 to AC-12 into a successor, not a
fourth implement round**. **AC-1, AC-7, AC-12 and AC-13 remain not eligible for trimming**, AC-12 for
the measured reason §0.2 gives: it is the only criterion whose subject no existing guard reaches.

**§0.1's six corrections stand**, including Correction C — `packages/core/src/test-discovery.test.ts:79`
is **already false on `main`** at *"the four packages that emit nothing"*, the stub set having been
three since Q-0122. Verified again at this gate: `PACKAGES` is seven, four emit, so the stubs are
`packages/compiler`, `packages/server` and `packages/templates`, and after this ticket they are two.
Fixing that sentence is inside AC-4, not scope creep.

**GO-3's three build-time measurements stand, and the first baseline is already taken**: the forced
whole-workspace build at `be1b89f`, before this ticket, is **4 tasks, 0 cached, 2.614 s** — against
the 2.5 s Q-0122 recorded for the same four. The other two figures are
`packages/cli/src/end-to-end.test.ts` against its 90 s budget and `packages/cli/src/step-id.test.ts`
against its 180 s budget, both of whose docblocks stake the budget on a four-emitter measurement and
say so in their own words.
