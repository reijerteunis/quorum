# Q-0079 — cross-vendor review, rounds 2 and 3 (hand-run on codex)

*2026-08-30. Each round reviewed the previous round's **fixes**, not the feature — this project's
"review the fix round, not only the feature round" (Q-0034). It earned its keep twice.*

## Round 2 — verdict revise, three majors, all accepted

- **major** `TAG_WRITES` still missing `--message`, `--trailer`, and attached short forms
  `-mtext`/`-Ffile`. **Fixed**, with six fixtures.
- **major** "non-empty" was a length check, so `'user.name= '` satisfied `carriesIdentity`. **Fixed**:
  the value after `=` is trimmed. Two whitespace-only fixtures.
- **major** *the `scan-fixture` marker silenced any production call anywhere — the original comment
  bypass under a new token.* **Fixed**: honoured in the guard's own file and nowhere else.

The third is the reason the rule exists. Round 1 found a comment could talk the guard out of firing;
the fix for it introduced a repository-wide comment that could talk the guard out of firing. Same
shape, new token, written by the hand that had just been shown the mistake.

## Round 3 — verdict revise, three majors: two accepted, one refuted

- **major** `annotates()` missed **bundled** short options — `git tag -am 'x'` writes an object and
  evaded both the flag list and the attached-value list. **Accepted and fixed**: membership of
  `a s m F u` in a short-option cluster, with `-n5` and `-l` pinned as non-writing.
- **major** *the repository-scope test could not fail* — it asserted over the predicates rather than
  over the `file === SELF` decision, so deleting that clause would not have killed it.
  **Accepted and fixed**: the decision is now its own `exempt()` function and the test targets it.
  **Demonstrated by mutation**: removing the clause fails the test; restoring it passes.
- **major** *"the marked-line test includes an explanatory marker at line 163, which contains no
  invocation, so `dead` is non-empty and the test necessarily fails."* **Refuted by execution.**
  That line is the doc comment quoting `git(root, 'merge', B);`, which the scanner collects and
  which is a would-be violation, so the marker there is live. The test passes — 11/11. The reviewer
  read the diff rather than running it, which is the same class it was hired to find.

## State

Three rounds, six accepted findings, one refuted with evidence. Round 3's accepted pair are both
"a check that cannot fail", which is what the ticket is about. Verified after: workspace 21/21
tasks 0 cached, spike 17/17, and the sweep green end to end.
