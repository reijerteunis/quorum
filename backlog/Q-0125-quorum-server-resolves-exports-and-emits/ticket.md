---
id: Q-0125
title: "@quorum/server resolves, exports and emits"
stage: reviewed
owner: ruud
repos: []
branch: harness/Q-0125/integration
priority: p1
created: 2026-09-12
iterations:
  requirements.head-of-product: 2
  chore.review: 1
history:
  - stage: draft
    run: 1
    flow: requirements
    status: exhausted
    stage_before: draft
    stage_after: draft
    at: 2026-09-12T20:01:01.764Z
    cost: 0
  - stage: requirements
    run: 1
    flow: requirements
    status: completed
    stage_before: draft
    stage_after: requirements
    at: 2026-09-12T20:04:12.559Z
    cost: 19.037
  - stage: reviewed
    run: 2
    flow: chore
    status: completed
    stage_before: requirements
    stage_after: reviewed
    at: 2026-09-13T05:35:06.207Z
    cost: 62.067
---
packages/server declares no exports, no main, no types and no build script — verbatim the state Q-0096 measured for @quorum/core — so nothing can import it by name and it emits nothing. Every consumer M3 has left needs it: quorum open must construct a daemon from packages/cli, and the built binary runs under plain Node, which does not know the quorum-source condition.

Opened **2026-09-12**, after Q-0122 shipped, because the daemon and the bundle both exist and
**nothing can start them**. `p1` — it blocks Q-0126, which owns a line of M3's own done-when.

## What the tree says, measured 2026-09-12

`packages/server/package.json` declares **no `exports`, no `main`, no `types`** and **no `build`
script**. The first three are verbatim the state Q-0096 measured for `@quorum/core`; the fourth is
what Q-0097 then added there. This package has neither half.

**Nothing outside the package imports it.** `grep -rn "@quorum/server"` across the workspace returns
seven hits and every one is inside `packages/server` itself — its own manifest name, two of its own
suites asserting that name, and three of its own module headers. That is not an oversight nobody
noticed: `packages/server/src/wire.ts`'s header records it as the reason `WireMessage` went to
`@quorum/shared` at Q-0120 and `WireRefusal` and `WireRun` followed at Q-0121, *"this package having
no export surface"*.

**Reproduced first-hand rather than inferred.** At Q-0122's gate an end-to-end probe of the static
route was written as a plain `node` script importing `@quorum/server`; it died with
`ERR_MODULE_NOT_FOUND` and had to be re-run through Vitest, which supplies the `quorum-source`
condition. That is this ticket's subject, met by accident.

## The chain that forces the emit, which an `exports` map alone does not satisfy

This is the measurement the ticket turns on, and it is why Q-0096's six-criterion shape is **not**
enough here.

1. The workspace-local installation path this repository claims and tests is
   `pnpm install && pnpm turbo run build`, then `pnpm exec quorum <command>`.
2. That runs `packages/cli/dist/quorum.js` — an **emitted** file, executed by **plain Node**.
3. Plain Node does not know the `quorum-source` condition. `tsconfig.base.json`'s `customConditions`
   and `vitest.shared.js`'s `ssr.resolve.conditions` select it for typecheck and for the suites;
   nothing selects it for the binary.
4. So a `packages/cli` module importing `@quorum/server` resolves through the **`default`**
   condition, which must name a file that exists.

Therefore `@quorum/server` must **emit**, and the emitting set becomes **five**. An `exports` map
alone would typecheck, pass every suite, and fail the moment the binary ran — the shape Q-0096's own
E-1 caught in a test whose verdict came from the checkout.

## What moves, and it is the register decision 092 just moved

A **fifth** emitter walks the same ground Q-0122 walked for the fourth, so the work is known rather
than exploratory:

- `packages/core/src/test-discovery.test.ts`'s emitting register — four entries as of Q-0122 — and
  the stub clause below it asserting `scripts.build` is `undefined` for every non-emitting package.
  Both go red. `PACKAGES` derives from `pnpm-workspace.yaml`'s `packages/*` and `apps/*`, so
  `packages/server` is already a member.
- `emitting()` in `packages/cli/test/workspace.ts` is **derived** from `turbo run build --dry`, not
  hand-written, and is reached at **fourteen** call sites in `build.test.ts` — `:144`, `:360`,
  `:558`, `:584`, `:603`, `:624`, `:635`, `:667`, `:712`, `:884`, `:904`, `:951`, `:956`, `:1140`,
  with a fifteenth occurrence at `:654` inside a comment. **This figure was thirteen in this body
  until it was re-measured on 2026-09-12 against the merged tree**: the thirteen sites and their
  line numbers were Q-0122's iteration-2 measurement, taken at that ticket's requirements gate
  against the tree *before* its own merge, and its static-serve criteria added a call site and moved
  every line below `:635`. The count is therefore an inherited measurement that rotted inside a day,
  which is the reason this body says to re-derive it rather than transcribe it. Q-0122 measured
  its whole-copy census passing 65/65 unedited with four emitters; a fifth is a `tsc` emitter like
  the original three, so this is expected to be cheaper than Q-0122's Vite bundle was, **which is a
  prediction to measure and not a claim**.
- `turbo-inputs.test.ts`'s `NOT_READ` rows, which gained an `apps/web` entry at Q-0122.

## What this ticket must NOT decide

**Whether `@quorum/server` is distributed.** Decision 092 — *"A fourth package emits, and what it
emits is served rather than shipped"* (2026-09-12) — split the **emitting set** from the **local
distribution set** deliberately, and this ticket makes the first of those five and leaves the second
at three. `@quorum/server` stays `private: true` with no `files`, exactly as `@quorum/web` does.

That is not a tidy deferral, and the ticket should say so out loud: **a packed `@quorum/cli` that
imports `@quorum/server` would be broken**, because `workspace:*` either rewrites to a `0.0.0` the
registry does not have or stays literally invalid outside a workspace (Q-0098 M-8, which is why that
fixture installs three tarballs together). So the distribution question is **Q-0124's**, for the
same reason and in the same words it is Q-0124's for the UI bundle, and **Q-0126 is where it
becomes urgent** rather than here — this ticket adds no consumer at all.

## Non-goals

`quorum open` (Q-0126), any CLI dependency on this package, making it a fourth tarball (Q-0124), a
browser-open primitive, and any change to what the daemon does. The deliverable is that
`@quorum/server` can be imported by name and that what a plain Node process resolves exists.

**Read first**: *"The emit serves the binary, and no test verdict moves behind it"* (2026-09-02),
whose (b) gives `test` no `^build` edge and which this ticket must not move; and *"A fourth package
emits, and what it emits is served rather than shipped"* (2026-09-12), which this makes a fifth
under. Whether a fifth emitter owes its own entry is a question for the gate — the shape is now
precedented, which is an argument that it does not.
