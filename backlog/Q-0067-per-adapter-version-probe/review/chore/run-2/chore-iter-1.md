# Q-0067 code review

Verdict: **revise**

- major: packages/core/src/adapters/cli-version.test.ts:55 The AC-1/AC-6 guard searches only single-quoted forms of three states, so a third production reader can branch on `"ahead"`, a template literal, or the serialized `version_state` value without naming any identifier in `VOCABULARY`, and the suite remains green. This does not hold the version-branching door shut as required. Make the scan syntax-independent and cover all four state literals while distinguishing unrelated `indeterminate` uses structurally; add bypass mutations demonstrating that double-quoted and JSON-field readers fail.

- major: packages/shared/src/cli-version.ts:1 The new production source contains a multi-paragraph transcription of the governing decision, including its policy, rationale, and verdict boundaries. This directly conflicts with `.claude/rules/engineering.md` and GO-1, which require one authority line and explicitly prohibit transcribing a decision or ticket body into source. The same pattern recurs in the new JSDoc around the derivation and renderer. Reduce these source comments to API facts plus a one-line `Why:` citation to the 2026-09-08 decision; keep the full policy explanation in the required documentation.
