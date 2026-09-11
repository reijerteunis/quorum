# Q-0014 code review — run 2, iteration 2

Verdict: **revise**

major: apps/web/src/package.test.ts:13 AC-5 says no file under `apps/web/src` may import a `node:` module, but this test imports `node:fs` (and several other new tests under `src` do likewise). The implementation narrows its guard to “shipping files,” which is weaker than the criterion’s explicit all-files boundary and leaves the browser source tree containing Node-only dependencies. Move Node-dependent tests outside `apps/web/src`, or otherwise restructure them so no file under that directory imports Node runtime capabilities, then make the AC-5 scan cover every file in the required corpus.
