# Q-0137 review — chore run 2, iteration 2

Verdict: **revise**

major: packages/server/src/read.ts:699 `GET /history/:id/retained` ignores every query value, including `occurrence_dir`, while AC-6 explicitly requires both new routes to reject `occurrence_dir` as input under every spelling. The implementation report acknowledges and deliberately preserves this contradiction. Validate that the listing request has no query keys and reject unexpected keys; add a test that sends `occurrence_dir` to this route and observes the refusal. If the intended contract is now to ignore such keys, obtain an erratum instead of changing the requirement in implementation.

major: packages/core/src/run-history/reader.ts:531 `lstatSync` executes outside the surrounding error handling, so an entry-level metadata error such as `EACCES` or `EIO` throws out of `listRetainedFiles` and turns the entire listing request into a server failure. This violates AC-1's warnings channel and AC-4's requirement that an occurrence the reader cannot name becomes a warning beside a partial 200 rather than taking down the run. Catch enumeration/stat failures at the occurrence boundary, convert them to a warning without leaking a path, and add a constructed test where `readdirSync` succeeds but metadata lookup fails.

observation: The supplied patch was truncated at 200,000 bytes and omitted six files entirely: `packages/server/src/package.test.ts`, `packages/server/src/read.ts`, `packages/server/src/retained.test.ts`, `packages/shared/src/docs-retained.test.ts`, `packages/shared/src/wire-retained.test.ts`, and `packages/shared/src/wire.ts`. They were reviewed directly from `harness/Q-0137/implement`.
