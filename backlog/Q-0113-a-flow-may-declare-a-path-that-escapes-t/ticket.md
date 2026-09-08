---
id: Q-0113
title: A flow may declare a path that escapes the ticket folder
stage: draft
owner: ruud
repos: []
branch: harness/Q-0113/integration
priority: p2
created: 2026-09-08
iterations: {}
history: []
---
`lintFlow` accepts a `writes:`, `write:` or `input.backlog` entry that traverses out of the ticket
folder, so a flow declaring one is caught at run time if at all. Opened at Q-0059's requirements
gate from its **OQ-4**, which ruled it out of that ticket and out of its closing entry — two
obligations found orphaned this week lived only inside a closed ticket and a source comment, and
Q-0105 is the counter-example.

**Q-0059's engine guard is the one that must exist either way**, and it lands there: `readFiles`,
`writeFile` and `dirOf` refuse a path outside the ticket folder at the boundary, whatever a flow
declares. So nothing is unguarded while this waits. What is missing is the *early* refusal — catching
a bad flow before a paid run rather than during one.

**The instrument is the question, and it is why this is a ticket rather than a deferred clause.**
Three shapes, and the choice is the work:

1. **A lint rule.** Q-0055 settled that the linter may carry a rule with no engine counterpart —
   `cross_vendor` and `human-locked` are both lint-only — so precedent is not the obstacle.
2. **Engine-side only**, on the ground that the guard already refuses and a second implementation is
   a second thing to keep true.
3. **Both**, with the lint rule deriving its predicate from the same primitive
   (`packages/core/src/backlog/confine.ts`, which Q-0059 creates) so the two cannot disagree.

Shape 3 is the one to cost first: a lint rule with its own copy of the predicate is the divergence
this repository keeps recording, and a shared primitive is what makes the two answers one.

**Surface.** `packages/core/src/lint/lint.ts` and `lint.test.ts`; **both** shipped `chore.yaml`-style
template copies if any flow needs correcting (`lint.test.ts`'s parity assertion catches only one
moving); and the flow schema's own documentation if the rule is stated there.

**Depends on Q-0059**, which creates the primitive and the boundary this would enforce early. Do not
start before it lands, or the lint rule will grow its own predicate.

**Non-goals.** The engine guard itself (Q-0059's); `route` and the qa-final sketch (Q-0056's); the
`steps`-less and id rules Q-0055 shipped; anything about run history's confinement, which is Q-0049's
and already enforced.
