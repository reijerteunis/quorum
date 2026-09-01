# Review

major: packages/cli/src/fail.ts:36 `stackOf` only uses `error.stack` when it is a string, whereas AC-3 requires preservation of `e.stack ?? String(e)`. For a thrown value such as `{ stack: 42 }`, the spike reports `42`, but this implementation reports `[object Object]`. Preserve the nullish-fallback behavior for any `stack` value and add coverage for a non-string, non-nullish `stack` property.
