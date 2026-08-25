---
id: Q-0042
title: core/git — worktrees, ancestry and containment
stage: draft
owner: ruud
repos: []
branch: harness/Q-0042/integration
priority: p1
created: 2026-08-25
iterations: {}
history: []
---
Ports `spike/src/git.js` (163 lines) to `packages/core`: `ensureWorktree`, `removeWorktree`,
`ancestry`, `shallowState`, `shortSha`, `emptyRangeEvidence`, `containment`, `ensureExcluded`. It is
the leaf of the dependency graph — nothing in the spike imports it except `fanout` and `engine` — and
it is first because it carries more decided behaviour per line than any other module in the port.
Belongs to M2 in `docs/06-development-plan.md`; parent Q-0009.

**Three rules that must survive the port, all of them bought with money.**

1. **State is selected from git's own exit codes and from nothing else** (containment decision,
   2026-08-24). `git merge-base --is-ancestor` exit 0 → contained; exit 1 → provably not contained;
   any other exit → indeterminate. Exit 1 is never inferred from a failure, a timeout or an absent
   binary. A rewrite that wraps the call in `try { … } catch { return false }` reintroduces exactly
   the confident falsehood Q-0035 removed.
2. **The shallow asymmetry.** In a shallow repository an exit 0 still reports contained, because
   ancestry found in the history that is present is real; an exit 1 becomes indeterminate, because
   absent history cannot disprove ancestry. And `shallowState` is itself three-valued — the shallow
   probe is a git call that can fail, and reading a failed probe as "not shallow" hands back the
   confident negative by the back door. That second half was caught by Q-0035's chore review, which
   the closing entry notes was *"the second time this class of conflation has had to be closed in the
   same week"*.
3. **One `ancestry()` primitive, two callers.** Before Q-0035 this repository read git ancestry two
   ways and the wrong one was the one that talked to the user. The single primitive is the fix; a
   port that gives `containment` and `materialiseDiff` their own helpers undoes it silently.

**Vocabulary.** The glossary is explicit that this module's output says *contained*, never *merged*,
*landed* or *shipped*, and that the three states render as `main:contained`,
`main:not-contained(+12)` and `main:indeterminate(<reason>)` with the reason from a closed set. Types
in `shared` should make the closed set closed.

**Scope note.** `containment` is called from `spike/bin/harness.js` (the board); the rendering stays
with the CLI in Q-0010, the derivation belongs here. Nothing is stored, cached or written to
frontmatter — the 2026-08-24 decision requires every `harness board` invocation to leave every
`ticket.md` byte-identical.

## Port charter

The charter is `harness/port-charter.md`; §6's register is normative for everything below and this
body cites it rather than restating it — where the two ever differ, the register is right.

Route: **chore** (`requirements → chore → human gate`), per *"The port takes the chore route,
except the one child that has new behaviour"* (`docs/DECISIONS.md`, 2026-08-25). Behaviour is
preserved per *"The port preserves behaviour; one exception is authorised and everything else
stops the child"* (`docs/DECISIONS.md`, 2026-08-25) — a defect found while reading the spike is
reported, never fixed in passing.

- **Ports:** `git.js` — worktrees, `ancestry()`, containment, `shallowState()`
- **Lifts from `spike/bin/harness.js`:** nothing
- **Depends on:** Q-0041 · **Depended on by:** Q-0048
- **Invariants inherited:** register rows 8, 19 (charter §2)
- **Non-goals:** another child's module; editing `spike/**` (charter §3); fixing a defect found
  while reading (§2); the cutover; the `quorum` binary (Q-0010); persisting the event stream;
  anything on v1's exclusion list.
