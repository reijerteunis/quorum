# Run 1, aborted at the human gate — 2026-08-30T00:24Z

Three artifacts of `harness run requirements Q-0051` run 1: two PM candidates and the merged
requirement, which returned `ready` and cost **$7.274 plus 5,125,082 tokens** across three steps.
Ruud aborted at the gate so Q-0038 could land on `spike/src/engine.js` first — the sequencing the
ticket body's own *Sequencing against Q-0038* section asks for. Q-0038 merged the same morning at
10:41 (`a8ddbe3`), which invalidates this document by its own D-5, and run 2 was cut against the
fixed source rather than resuming from here.

**They are here rather than deleted, and here rather than in `requirements/`, for two reasons.**
`requirements.yaml:23` feeds `requirements/merged.md` back to the head-of-product step, so leaving
this one in place would have handed run 2 the ruling Q-0038 deleted; and `readFiles` matches
`candidate-*.md` and `merged.md` on the basename inside `requirements/` only, so a subdirectory is
invisible to every flow in both trees — checked against all eight shipped flow files.

**What is still true in `merged.md`, and what is not,** is enumerated in the ticket body under
*Run 1 aborted at the requirements gate* — written at Q-0038's own requirements gate so the
surviving two thirds could still be used. In short: D-5, AC-9 clauses 4 and 5, AC-5's endpoint tail
and the coverage table's E16 row die with the `.find()`; AC-3's guard, AC-6, AC-7, AC-8, AC-10 to
AC-14, both source-guard findings, the four factual corrections and the scenario census hold.

Do not run any flow against this document. Cite it only as the record of what run 1 cost and ruled.
