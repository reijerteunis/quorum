---
id: Q-0081
title: A role naming no adapter lends its model to any vendor
stage: draft
owner: ruudvanengelenhoven
repos: []
branch: harness/Q-0081/integration
priority: p3
created: 2026-08-30
iterations: {}
history: []
---
resolveModel suppresses a role's default model on adapter INEQUALITY and never on ABSENCE, so a role carrying model: without adapter: passes that model to whichever adapter resolved. Register row 2's third clause, AC-4(a) of Q-0052 and the Q-0052 ticket body all state the strict form — inherit only on equality — and the code has never agreed. Decide which one moves, and land it in spike/src/engine.js and packages/core/src/engine/steps.ts together.

## The defect, measured three ways

`resolveModel` (`spike/src/engine.js:702–707`, `packages/core/src/engine/steps.ts`) reads:

```js
if (step.model) return step.model;
const roleAdapter = role.meta?.adapter;
if (roleAdapter && roleAdapter !== adapterName) return undefined;   // absent → falls through
return role.meta?.model;
```

The guard suppresses on **inequality**. A role with `model: opus` and no `adapter:` passes
`roleAdapter && …` as false, falls through, and lends `opus` to whichever adapter resolved —
including codex, where `opus` is not a model its login supports. That is the failure Q-0001 paid
to learn about, reachable by a different route than the one the clause was written to close.

**Three documents state the strict form and the code has never matched any of them.** Register row
2's third clause; Q-0052's AC-4(a) — *"inherited **only** when `role.meta.adapter` equals the
resolved adapter name"*; and Q-0052's own ticket body, which inherited the wording from Q-0047
erratum E-1 on 2026-08-27. The prose has been wrong for three days and nothing caught it.

**Nothing caught it because the frozen coverage cannot.** `spike/test/smoke.js:621–627` is three
assertions over **one** fixture, `{ adapter: 'claude', model: 'opus' }`. Every row names an adapter,
so the absent case is not covered on either side of the port. A test that cannot distinguish the two
readings is what let them diverge — *"a check is not established by reading it"* (2026-08-29).

**It is latent, not live.** All 21 role files in `harness/roles/` and
`spike/templates/harness/roles/` were checked: every role carrying `model:` also names `adapter:`.
`code-reviewer` names neither, which is how the cross-vendor rule gives it the step's adapter. So no
shipped flow reaches the defect, and an adopter's role file is what would.

## Why it is a ticket and not a line

Q-0052's chore run tried to fix it in passing and that is the evidence it needs its own ticket.
Review round 1 raised it; round 2's implementer refused on charter §2 and pinned it; round 2's
reviewer refused the refusal, answering only the frozen-coverage half of the argument and not the
charter; round 3 shipped the strict form and deleted the pin; round 3's reviewer approved, naming
the deletion approvingly. See *"A reviewer approves the change it asked for"* (2026-08-29) —
second occurrence in this port. `backlog/Q-0052-…/requirements/errata.md` E-1 rules it out of that
ticket's scope and hands it here.

**The decision this ticket owes is which of the two moves**, and both are defensible:

1. **The code moves to the strict form** — `meta?.adapter !== adapterName` returns `undefined`, so
   a role naming no adapter names no vendor its model could be right for and lends nothing. Three
   documents already say this. It is a behaviour change and needs saying so out loud.
2. **The prose moves to the code** — a role naming no adapter is *unscoped* rather than
   *wrong-vendor*, and an unscoped default is exactly what a default is for. Register row 2's clause
   is then about crossing vendors, which absence does not do, and AC-4(a)'s wording is corrected.

Shape 1 was written once already, by Q-0052's round 3, and is preserved in that ticket's review
record rather than in the tree. Do not adopt it because it is already drafted; the round that wrote
it was not asked which of the two should move.

## What it must not do

**Land in one tree.** `spike/src/engine.js` and `packages/core/src/engine/steps.ts` change together
or the port loses its independent witness — the Q-0066 / Q-0068 / Q-0070 shape. The port freeze is
recorded (`harness/port-charter.md`, `freeze-sha`), so a `spike/src` change also re-records the SHA
in the same commit, and `harness/port-charter.md` §3's table wants a row for this ticket.

**Leave the pin behind.** `packages/core/src/engine/steps.ts` carries a `Why: preserved defect, see
Q-0052 errata E-1` authority line, registered in `q0050.source.test.ts`'s `REGISTERED` map under
`steps.ts` and counted in its `preserved defect/` arithmetic. Whichever shape wins, that marker and
its registration come out with the defect, and the count moves with them.

**Ship without the discriminating row.** `steps.test.ts` now pins the current behaviour — a role
with `model: 'sonnet'` and no adapter returns `'sonnet'` on both `claude` and `codex`. That
assertion inverts under shape 1 and survives unchanged under shape 2, which is what makes it the
row that tells the two apart. `smoke.js:621–627` wants the same row added on the spike side, where
today there is none.

- **Depends on:** nothing · **Blocks:** nothing
- **Non-goals:** the rest of `resolveModel`; adapter resolution (`AC-4(b)`); anything about
  `config.adapterOverride`; the port's remaining children.
