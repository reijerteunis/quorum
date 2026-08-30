# Review — Q-0038, chore iteration 4

Verdict: **revise**

major: spike/src/engine.js:135 `ctx.diffInputs` remains keyed only by the interpolated range, so an earlier diff site can materialise a range before its endpoint-producing step, after which a later site using the identical range is correctly classified as deferred but still receives the cached pre-producer bytes because `buildPrompt` prefers `ctx.diffInputs.get(range)` at line 740. This violates AC-4’s requirement that a step-created endpoint always be materialised after its producer, and can bill a consumer against stale output. Add a scenario with the same range consumed before and after its producer, then distinguish cached evidence by site/timing or otherwise ensure the later deferred site cannot reuse the earlier materialisation.
