---
id: Q-0077
title: harness run --base, so a contained ticket can still be reviewed
stage: reviewed
owner: ruud
repos: []
branch: harness/Q-0077/integration
priority: p2
created: 2026-08-29
iterations: {}
history: []
---
`review.yaml` hard-codes its range as `{base}...harness/{id}/integration`. Once a ticket's branch is
contained in the base, that range is **empty** and the flow reviews nothing — so a merged ticket
cannot be reviewed at all. Carried in M2's open items since Q-0034 (*"a `--base <ref>` flag is the
small fix"*), and it forced rounds 4 and 5 of Q-0050 onto a hand-run cross-vendor review after that
ticket was merged.

## What was measured before this ticket was written

Do not re-derive these from the ticket bodies that mention `base`; they were read out of the tree on
2026-08-29.

**`base` is read at five sites in `spike/src/engine.js`, and they mean two different things.**

| site | reads | meaning |
| --- | --- | --- |
| `:45` | sets `ctx.vars.base` from `config.repo.base_branch` | the interpolation source for `{base}` |
| `:788` | `ctx.vars.base ?? config…` | the **diff anchor**, and the range guard's notion of "related" |
| `:916` | `config.repo.base_branch` **directly** | the branch a rework step **merges into** the ticket branch |
| `:991` | `config.repo.base_branch` **directly** | the evidence note's `base \`…\`` text |
| `:1004` | `config.repo.base_branch` **directly** | the branch `integrate` **syncs from** before merging |

**`--base` must change the first two and none of the last three.** The diff anchor answers *what is
this work being compared against*; the merge source answers *what gets written into the ticket's
branch*. Overriding the second with an arbitrary ref would merge that ref into the integration
branch, which is not a review concern and is destructive. The split already exists in the code —
the two anchor sites read `ctx.vars.base`, the three merge sites read the config — so the flag needs
no new plumbing to respect it, only a test proving it does.

**The range guard already composes, by design and on the record.** `:790-797`'s comment says so:
*"the guard still composes with a future `--base` flag, since `base` is `ctx.vars.base`. See
Q-0034."* `related(ref)` is `ref === base || ref.startsWith('harness/<id>/')`, so once `vars.base` is
the override, `<override>...harness/<id>/integration` passes the guard that otherwise rejects an
arbitrary SHA. That guard exists to stop a **flow file** aiming at unrelated refs; a human typing
`--base` on the command line is a different trust level, and the ticket should say so rather than
leave the widening implicit.

**The CLI parse is free.** `spike/bin/harness.js:26-39` is a generic `--key value` parser, so
`--base main~50` already lands in `flags.base`. Only the threading and the usage string are work.

## Non-goals, and one defect found while measuring

`packages/core`'s `RunFlowOptions` has no `base`, so the field is new there too and this lands in
**both trees together** — the Q-0066/Q-0068/Q-0070 shape.

**Nothing checks `contracts/Q-0050/run-flow-api.contract.ts` against the code.** Q-0050's E-5(b)
deleted `docs-q0050.test.ts`, the only reader, to remove a cross-package read that Q-0072's input
guard reported. Grepped: no file in `packages/` imports or asserts over that contract today. So the
typed contract is unverified documentation and any drift between it and `packages/core/src/engine/types.ts`
is invisible — including the drift this ticket is about to add. Adding `base` to the contract is in
scope; **giving the contract a reader again is not**, and wants its own ticket because it reopens
the read-route question E-5(b) closed.

## Acceptance criteria

- **AC-1** `harness run <flow> <ticket> --base <ref>` sets the run's `{base}` interpolation value to
  `<ref>` in both trees, and the usage string names the flag.
- **AC-2** With `--base`, the range guard accepts `<ref>...harness/<id>/integration` where `<ref>` is
  an arbitrary revision — a SHA, `main~50`, a tag — and still rejects an endpoint that is neither the
  effective base nor one of this ticket's own branches.
- **AC-3** `--base` changes **no** merge or sync behaviour: the rework sync and `integrate`'s base
  sync still read `repo.base_branch`. Tested by asserting the merge target under an override, not by
  reading the code.
- **AC-4** Without `--base`, every one of the five sites behaves exactly as today — the default path
  is byte-identical.
- **AC-5** A review of a **contained** ticket produces a non-empty diff: the regression this ticket
  exists to fix, driven end to end rather than asserted.
- **AC-6** The flag is documented where `harness run` is documented, and `contracts/Q-0050/run-flow-api.contract.ts`
  gains the field so the typed record does not silently diverge further.

## Implemented by hand, 2026-08-29, both trees in one change

Answering the open question below: `base` is its own field on `RunFlowOptions` and on the spike's
`runFlow`. The cheaper shape — the CLI overwriting `project.config.repo.base_branch` — is refused,
and `engine.test.ts`'s AC-3 was **demonstrated red against it** rather than argued about: with that
shape the merge source reads the override.

Five spike scenarios and three Vitest tests. The fixture had to gain a real `repo.base_branch`
before AC-3 could discriminate — without one the "unmoved" assertion passes over `undefined` and
proves nothing, which is this session's most repeated defect caught on its own work.

**B5 found an ordering defect in the implementation.** The bare-`--base` refusal sat after
`loadProject()`, so a missing project masked it with an `ENOENT` stack. Argument validation now runs
beside the usage check, before anything is read from disk.

**AC-5 is proved at `materialiseDiff`, not through a full flow run.** The stage precondition fires
before the diff preflight, so a flow-level proof needs a ticket at `green` and there is none; the
chain is covered instead by three tests end to end — argv → `runFlow` (B5), `options.base` →
`vars.base` (core AC-1), `vars.base` → a non-empty range for a contained ticket (B1). Stated rather
than claimed as end-to-end.

## Open question for the gate

Does `--base` belong in `RunFlowOptions` as its own field, or does the CLI overwrite
`project.config.repo.base_branch` before calling `runFlow`? The second is zero change to `core` and
is wrong for the reason the table above gives: it would move all five sites, including the three
that merge. Recorded so the cheaper shape is refused deliberately rather than discovered.
