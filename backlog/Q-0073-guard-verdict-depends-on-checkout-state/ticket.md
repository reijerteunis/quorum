---
id: Q-0073
title: The input guard's verdict depends on checkout state
stage: draft
owner: ruud
repos: []
branch: harness/Q-0073/integration
priority: p2
created: 2026-08-28
iterations: {}
history: []
---
Found at Q-0072's final gate, 2026-08-28, by re-running the forced suite on `main` after the merge
rather than trusting `integrate`'s tick. Q-0072 registered the two instances by hand and did not
fix the class; this ticket is the class.

**The defect.** `packages/core/src/turbo-inputs.test.ts`'s clause B refuses a directory-shaped path
literal that no audited walk covers — but it only *sees* a literal as a directory when the
directory **exists on disk** at the moment the suite runs. So the guard's verdict is a function of
what the checkout happens to contain, not of what the code says.

**What that produced.** `packages/shared/src/constants.ts` declares
`REPO_WORKTREE_ROOT = '.harness/worktrees'` and `RUN_HISTORY_ROOT = '.quorum/runs'`, and
`constants.test.ts` asserts on both values. Neither directory is tracked — `git ls-files` reports
**0 files** under either — so:

| where | both directories | guard |
| --- | --- | --- |
| a developer's checkout that has run a flow | exist | **red** |
| a fresh `integrate` worktree | absent | green |
| a fresh CI clone | absent | green |

Q-0072's implement step, its `integrate`, and CI were therefore all structurally incapable of
seeing it, and `main` was red for every developer while every gate reported green. **This is
Q-0071's shape inverted:** there the gates were blind because they replayed a cache; here they are
blind because they run on clean checkouts, which is the one condition under which the check cannot
fire. A guard that only the unguarded environment can trip is worse than no guard, because its
green is read as coverage.

**Not the same as a missing register entry.** Adding `.harness/worktrees` and `.quorum/runs` to
`NOT_READ` — which Q-0072 did, by hand, after its gate — closes those two and leaves the class
open: any future product constant naming a directory that happens to exist trips the guard on
somebody's machine and nowhere else. The register is the right home for a path *named but never
opened*; it is the wrong instrument for deciding *whether a literal is a directory at all*.

**Shapes, none decided.** (1) Decide directory-ness from the literal's role in the code rather than
from `fs.existsSync` — a literal reaching a read is a path, a literal reaching an assertion is
data — which is close to what clauses C1–C4 already do for reads and would make the whole file
consistent. (2) Resolve directory-ness against **git** rather than the filesystem, so untracked
state cannot change a verdict; check whether `git ls-files` is an acceptable dependency for a test
that must also run in a worktree. (3) Register every product path constant exported from
`packages/shared/src/constants.ts` automatically, so the two classes never drift — narrow, and it
does not stop a directory literal appearing anywhere else. (4) Make the suite create the two
directories before scanning, forcing every environment into the same state — cheapest, and it makes
the guard's answer depend on a fixture rather than removing the dependence.

**Verify before designing.** Re-run the three-environment table above rather than inheriting it,
and establish which literals in either suite are currently classified by existence rather than by
role — the count decides whether shape (1) is a small change or a rewrite. Do not re-derive it from
this body.

**A property worth asserting whatever shape wins:** the guard returns the same verdict on a clean
checkout and on one that has run flows. That is testable directly and is the thing that was missing.

Needs a `docs/DECISIONS.md` entry only if the chosen shape changes what the guard claims; a
consistency fix inside one file does not. Belongs to M2.
