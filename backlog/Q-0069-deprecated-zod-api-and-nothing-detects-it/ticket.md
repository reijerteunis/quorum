---
id: Q-0069
title: A deprecated zod API is in use, and nothing in the repository can detect one
stage: requirements
owner: ruud
repos: []
branch: harness/Q-0069/integration
priority: p2
created: 2026-08-27
iterations: {}
history:
  - stage: requirements
    run: 1
    flow: requirements
    status: completed
    stage_before: draft
    stage_after: requirements
    at: 2026-08-27T09:58:39.952Z
    cost: 5.221
---
Found on 2026-08-27 by an audit of the workspace for deprecated APIs, prompted by Ruud. Two halves,
and the second is the one that matters: **21 call sites use an API zod marks `@deprecated`, and
neither of the repository's two gates can see it.** The call sites are a morning's work; the blind
spot is why they accumulated unremarked through a landed, cross-vendor-reviewed ticket.

## The defect

`packages/shared` calls `.passthrough()` 21 times. zod 4.4.3 — the installed version — marks it
deprecated in as many words (`zod/src/v4/classic/schemas.ts:1388`):

    /** @deprecated Use `z.looseObject()` or `.loose()` instead. */
    passthrough(): ZodObject<Shape, core.$loose>;

| File | Sites |
| --- | --- |
| `packages/shared/src/flow.ts` | 11 |
| `packages/shared/src/project.ts` | 7 |
| `packages/shared/src/ticket.ts` | 2 |
| `packages/shared/src/role.ts` | 1 |

**Enumerated by the tool, not by grep.** `@typescript-eslint/no-deprecated` was run ad hoc over
`packages/**/*.ts` with type information: **21 problems, every one `passthrough`, all in
`packages/shared`.** Nothing else in `packages/` uses a deprecated API — not `core`, not the
adapters, not the tests. The probe config was removed again; it is not committed.

**What is *not* deprecated, stated so it is not swept up.** `.strict()` (12 sites) and `.strip()`
carry a softer note — *"Consider `z.strictObject(A.shape)` instead"*, *"This is the default
behavior"* — and **no `@deprecated` marker**. The rule did not flag them and this ticket does not
change them. Widening to `.strict()` is a legibility preference, not a deprecation, and it needs its
own argument rather than a free ride on this one.

**Also checked and clean:** no deprecated Node API anywhere in `packages/` or `spike/` (`new
Buffer`, `url.parse`, `querystring`, `fs.exists`, `util.isArray`, `util.inherits`,
`process.binding`, `crypto.createCipher`); no runtime deprecation warning from either suite under
`--trace-deprecation --pending-deprecation`; `turbo.json` uses `tasks`, not Turbo 1's `pipeline`.

## The target is not the obvious one

The minimal diff is `.passthrough()` → `.loose()`: one word per site, no restructuring. **It lands on
something zod is already steering away from** — `loose()` carries *"Consider `z.looseObject(A.shape)`
instead"* three lines below the deprecation. Migrating there buys one release of quiet and then this
ticket again.

`z.looseObject({ … })` is the form zod is moving toward, and it restructures each call from
`z.object({…}).passthrough()` to `z.looseObject({…})`. That is a larger diff over 21 sites and it is
the one that does not need doing twice. **Deciding between them is this ticket**, and the argument
should be made on which one zod will still recommend in a year, not on diff size.

## The blind spot, which is the real subject

Neither gate can see a deprecated API, and the reason is written down in the config as a deliberate
choice whose premise does not hold for this class:

- **`tsc --noEmit` does not error on `@deprecated`.** It is an editor affordance — a strikethrough —
  and nothing more. The workspace type-checks green today with all 21 sites present.
- **`@typescript-eslint/no-deprecated` is the rule that catches it**, it ships in the installed
  `typescript-eslint` 8.67.0, and it is in that project's `strict` preset. It requires type
  information (`requiresTypeChecking: true`).
- **`eslint.config.js:3` turns type-aware linting off**, saying *"Type-aware linting is deliberately
  off — `tsc --noEmit` owns types."* That is true of types and false of deprecation: `tsc` does not
  own this and never claimed to. **So the one rule that would catch it is unavailable by
  construction, and nobody owns the question.**

This is the shape the repository already has a name for. *"A check that skips its subject must not
report success"* (`docs/DECISIONS.md`, 2026-08-25) was written about a preflight; *"skipped is not
passed"* is the same sentence. Here two green ticks — `lint` and `typecheck`, 14/14, 0 cached —
stand over a file with 21 deprecated calls in it, and neither tick is lying about what it checked.
The gap is between them.

**It is also the second time this exact config comment has cost something.** Q-0065 records
`turbo.json` declaring no `passThroughEnv`, so the one test that needs an environment variable can
never run. Both are the same failure: a configuration choice made for a good reason, with a
consequence nobody enumerated, sitting in a file that reads as settled.

## Two shapes for the guard, and they are not equivalent

1. **Enable `@typescript-eslint/no-deprecated` with type-aware parsing** (`parserOptions.projectService`),
   and that rule alone — not the `strict` preset. General: it catches the *next* deprecation, in any
   dependency, without anyone thinking to look. Costs lint time on every package, every run, and
   turns on a machinery the config deliberately left off — so the header comment at
   `eslint.config.js:1–4` has to be rewritten rather than contradicted.
2. **A source-text assertion** — `expect(text).not.toContain('.passthrough(')` over
   `sharedSourceFiles()`, exactly as `packages/shared/src/flow.test.ts:342–347` already does for
   `.default(` and `.catch(`. Free, instant, and precedented in this very file. Catches **only this
   string**: the next deprecated API arrives unnoticed, which is the failure this ticket exists to
   close.

(2) is what the repository already does and (1) is what the requirement asked for. They compose —
(2) costs nothing and pins the specific rule the DECISIONS entry depends on, while (1) is the
general net — and shipping both is a defensible answer rather than a hedge.

## Ordering, which is a hard constraint

**The migration lands before the guard, in that order, in one change.** Enabling the rule over the
current tree makes `lint` fail 21 times immediately, so a change that enables it first is red from
its own first commit and cannot reach a green `integrate`.

## What this must not change

The semantics are identical — `.passthrough()`, `.loose()` and `z.looseObject()` all produce
`core.$loose` — so **no schema's behaviour changes and no test should need editing**, beyond any
that names the string. That is the criterion worth writing: the ported flows, tickets and roles
still parse, and unknown keys are still preserved.

*"Unknown keys are refused where Quorum owns the key set, and preserved where it does not"*
(`docs/DECISIONS.md`, 2026-08-25) is the entry this code implements, and it uses "passthrough" as its
vocabulary throughout. Renaming the call does not reverse it — the rule is about *who owns the key
set*, not about a method name — but the entry then describes the code in words the code no longer
uses. A one-line note in the same change, per the docs rule that code and docs are fixed together, is
enough; this needs no new decision entry.

## Scope

`packages/shared/src/{flow,project,ticket,role}.ts`, `eslint.config.js`, and whichever guard is
chosen. **`spike/` is untouched** — it is plain Node ESM, uses no zod, and is frozen
(`harness/port-charter.md` §3) for Q-0009's fifteen children; this is not one of them, so the freeze
route is open the way it was for Q-0063, and there is simply nothing there to change.

`packages/shared` is imported by every other package, so the blast radius is the workspace. That
argues for doing it now rather than later on two counts: shared is declared finished as of Q-0041, so
the site count is stable at 21 and will not grow while six port children remain; and a lint-config
change is cheapest when the tree it must go green over is smallest.

Belongs to M2 in `docs/06-development-plan.md`.
