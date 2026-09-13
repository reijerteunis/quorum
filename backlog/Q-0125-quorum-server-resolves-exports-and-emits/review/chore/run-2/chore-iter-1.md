# Q-0125 code review

Verdict: **revise**

major: packages/server/src/package.test.ts:170 The AC-3 “both directions” test is tautological: it constructs `asItWas` without a build/export and merely confirms those fields are absent; it constructs `asIfPacked` with `files` but then checks `own.files`, not the hostile fixture. Consequently, deleting the real AC-3 assertions would leave this discriminator green—the exact R-7 failure the criterion requires it to prevent. Extract/apply the production invariant to both fixtures so the before fixture fails emission and the packed fixture fails with a distribution-specific message.

major: packages/cli/src/build.test.ts:1066 AC-2 requires discovery by glob so a future sixth `tsconfig.build.json` automatically joins the uniformity comparison, but the test hard-codes the current four paths and later hard-codes `configs.length === 4` at line 1104. A sixth valid emitter therefore fails on maintained census assertions instead of being compared automatically, contradicting the specified fail-closed derivation. Remove the fixed identity/count and derive the expected subject from workspace emitters, while retaining an anti-vacuity check and comparing every discovered configuration.
