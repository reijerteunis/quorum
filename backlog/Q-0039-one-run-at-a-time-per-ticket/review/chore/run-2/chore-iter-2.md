# Q-0039 — Code review, run 2, iteration 2

Verdict: **revise**

major: docs/GLOSSARY.md:119 The glossary says release occurs “only while” the file carries this run’s token and therefore a successor’s lock is left alone, but E-1 explicitly acknowledges that a successor claiming between the token check and `unlinkSync` can still have its lock deleted. This leaves the canonical vocabulary document making the false safety guarantee that the erratum narrowed and that `writer.ts` now qualifies. Amend the glossary to state the same two-syscall bound: replacements present when release begins survive, while an interleaved replacement is not protected.
