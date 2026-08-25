---
id: Q-0056
title: What `route` is, and the qa-final sketch that cannot lint
stage: draft
owner: ruud
repos: []
branch: harness/Q-0056/integration
priority: p3
created: 2026-08-25
iterations: {}
history: []
---
Opened from Q-0041's erratum E-2 (`backlog/Q-0041-…/requirements/errata.md`), which decided that the
zod flow schema carries `route` untyped and preserved — and could only decide that because there is
no settled shape to type. This ticket settles the shape. **It blocks Q-0012**, which ships
`qa-final.yaml`, and should land before it.

**`route` has three incompatible descriptions and no implementation.**

1. **`spike/src/lint.js:77` reads it as a property of a step.** The only rule that mentions it is
   `step.output?.verdict && !step.on_fail && !step.route` — a step carrying a verdict must send it
   somewhere. Lint never looks inside `route`; it tests truthiness and nothing else.
2. **`docs/02-sdlc-pipeline-spec.md:370` draws it as a step of its own.** In the `qa-final.yaml`
   sketch it is a bare list item — `- route:` with `pass`/`dev`/`solution` branches — sitting after
   the two steps whose verdicts it is presumably routing.
3. **The engine implements neither.** `runStep` (`spike/src/engine.js:176–198`) has no branch for a
   route, so a flow carrying one lints clean and then does nothing with it.

No shipped flow uses `route` at all — `grep -rn route harness/flows/ packages/templates` returns
nothing. It is a feature that exists only in a lint rule and a doc sketch that disagree with each
other.

**The documented qa-final sketch fails lint today.** Verified by building the sketch at
`docs/02-sdlc-pipeline-spec.md:345–376` as an object and running the real `lintFlow`:

```
flow qa-final invalid:
  - exploratory: has a verdict but no on_fail/route — verdicts must go somewhere
  - second-opinion: has a verdict but no on_fail/route — verdicts must go somewhere
```

Both verdict-carrying steps fail, not just one — because on reading (1) the route step is a separate
step and does not attach to either of them. So the spec's own example is unrunnable under the spec's
own linter, and whoever implements Q-0012 discovers it on their first `harness lint`.

**A second contradiction inside the same sketch.** Its route branches use
`counter: iterations.qa`, and `lint.js:70–73` rejects exactly that prefix on an `on_fail` counter —
*"counter must be unprefixed; use `qa`"*. The rule does not fire here only because it is scoped to
`step.on_fail`, and a route is not one. Whichever shape wins, the counter spelling must be the same
in both places, or `route` ships with a prefixed-counter form the rest of the product forbids.

**What this ticket must decide.** Whether `route` is a step property or a step kind; whether it
survives at all, or is replaced by `on_fail`-style routing that already works; and, if it survives,
what the engine does with it. Then make the three sources agree: the lint rule, the spec, and the
engine. If `route` is retired instead, `lint.js:77` loses its `!step.route` clause and the qa-final
sketch is rewritten in terms of what exists — which is the smaller change and should be costed first.

**Do not fix this inside a port child.** `spike/src` is frozen (`harness/port-charter.md` §3), and
under *"The port preserves behaviour"* (`docs/DECISIONS.md`, 2026-08-25) a child that meets `route`
reports it and moves on — Q-0044 (`core/lint`) ports `lint.js:77` as it stands, verbatim. This ticket
lands against `packages/core` after Q-0044, or against the spike before the port reaches lint;
sequencing is the first thing to settle at its requirements gate. Belongs to M2 in
`docs/06-development-plan.md`.
