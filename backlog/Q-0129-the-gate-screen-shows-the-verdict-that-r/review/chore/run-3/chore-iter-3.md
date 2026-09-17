# Q-0129 code review — run 3, iteration 3

Verdict: **revise**

major: `packages/core/src/engine/routing.ts:113` The author-declared gate snapshots `context.reached` but never consumes or clears it after presenting the question. Consequently, a second author-declared gate reached without another verdict will reuse the evidence already presented at the previous gate. That directly violates AC-6’s requirement that neither layer substitute “a previous gate’s” value. Clear the slot after composing the first gate question, or obtain an explicit requirements correction if evidence is intentionally reusable across gates; add a two-gate regression proving the selected rule.

major: `apps/web/src/gate-screen.test.ts:879` The in-flight-answer test does not verify that evidence remains rendered. The evidence is rendered into the separate `parked.container` at line 885, while the answer is submitted from `container`, whose initial response contains no `reached` field. All post-click assertions inspect that evidence-free container, so deleting evidence during submission would still pass. Load `reached` into the same mounted screen whose control is clicked, then assert its summary and findings remain visible while the request is pending.

observation: The supplied patch omitted 13 changed files because of the 200,000-byte truncation limit; those files were inspected directly from `harness/Q-0129/implement` rather than inferred from the diff stat.

observation: GO-5’s second-environment verification and GO-6’s real browser demonstration remain operator obligations at close, as the implementation reports state explicitly.
