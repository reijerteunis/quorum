# Q-0137 code review

Verdict: **revise**

major: packages/core/src/run-history/reader.ts:519 The directory listing publishes every regular-file entry without applying `isRetainedName`. On POSIX, a regular file named `a\b` is therefore listed even though AC-1 forbids backslashes and `readRetainedFile` rejects the same name at line 605. This makes the listing offer a file that cannot be opened and violates the declared wire contract. Filter or warn on entries that fail the leaf-name predicate, and add a constructed backslash-name test.

major: packages/server/src/read.ts:695 The file handler reads only `occurrence` and `name` and silently ignores additional query keys. Consequently, `?occurrence=1&name=prompt.txt&occurrence_dir=steps/999-other` succeeds, despite AC-6 requiring both routes to reject `occurrence_dir` as input under every spelling. The test currently covers only replacing the required `occurrence` query, so it passes because `occurrence` is missing rather than because the forbidden key was rejected. Validate the accepted query-key set and add cases combining valid required values with each forbidden spelling.

observation: The supplied patch was truncated and omitted five changed files entirely: `packages/server/src/read.ts`, `packages/server/src/retained.test.ts`, `packages/shared/src/docs-retained.test.ts`, `packages/shared/src/wire-retained.test.ts`, and `packages/shared/src/wire.ts`. They were inspected directly from `harness/Q-0137/implement` for this review.
