---
id: Q-0124
title: How an installation outside the workspace obtains the UI
stage: draft
owner: ruud
repos: []
branch: harness/Q-0124/integration
priority: p2
created: 2026-09-12
iterations: {}
history: []
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
