# Review — Q-0135, run 2, iteration 3

Verdict: revise.

major: apps/web/test/source.test.ts:1101 `bindings()` discovers declaration heads from the original source, including declaration-like text inside strings and comments, then allows those bogus heads to terminate a real binding at the same depth. For example, `const reload = () => 'const fake' && fetchRuns(request, clock); setInterval(() => reload(), 1000);` is valid code: the fake `const` truncates `reload` before `fetchRuns`, the bogus `fake` binding receives the request, and the timer calling `reload` is not reported. This directly contradicts the comment at lines 1093–1098 and leaves AC-11’s prohibition unenforced. Select declaration heads from the index-preserving `codeOnly` text, or reject raw matches whose declaration token was blanked, and add a discriminating string/comment fixture that fails under the current implementation.

observation: The supplied patch was truncated and omitted `packages/shared/src/wire.ts` and `packages/shared/src/wire.test.ts`; both were inspected directly from `harness/Q-0135/implement` rather than judged from the diff stat.
