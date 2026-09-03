# Q-0092 review — run 2, iteration 3

Verdict: **revise**.

major: packages/cli/src/runs.ts:172 `occurrenceFields` does not render `n/a` for every absent occurrence value as AC-9 requires: absent `kind` and `started_at` interpolate as `undefined`, absent `attempts` becomes `undefined` through `String`, and absent `status` is passed to `statusLabel` and likewise rendered as `undefined`. This is reachable because detail mode deliberately accepts any parseable manifest without schema validation. Apply nullish fallbacks to all occurrence fields named by AC-9 and add a parseable malformed-manifest test covering the absent values.

nit: packages/cli/src/runs.test.ts:15 The new header comment says `build.test.ts` removes the emit “twice,” but the implementation report and the new `build.test.ts` banner correctly count four `removeEmit()` sites. Correct the count so the explanation for locating the spawn test does not preserve the stale measurement it was meant to replace.
