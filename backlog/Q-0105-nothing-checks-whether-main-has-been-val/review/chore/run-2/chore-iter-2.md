# Q-0105 — chore review, run 2, iteration 2

**Verdict: revise.**

The two findings from iteration 1 are correctly addressed: failures after a confirmed work-tree probe now reach `git failed`, and a configured but missing upstream ref reaches `missing ref`. One major remains in the new work-tree discriminator.

- major: packages/core/src/git/git.ts:66 Every exit status 128 from the initial work-tree probe is classified as “not a work tree” and ultimately suppressed as `null`. Git also returns 128 when a repository exists but cannot be opened—for example because of dubious ownership or an unsupported repository format, as the preceding JSDoc itself acknowledges. Those are failed probes inside the subject, so silently treating them as absence contradicts AC-3 and the requirement’s rule that an unanswerable check must not report success through silence. Add a classification strategy and regression fixture that distinguish a confirmed non-work-tree from these fatal repository errors without depending on localized stderr; fatal errors that cannot be proven to mean absence must produce `indeterminate (git failed)` while a genuine non-work-tree remains `null`.
