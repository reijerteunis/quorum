# Q-0036 — implementation report, iteration 2

This is a revision round. The iteration-1 implementation (commit `d7de690`) is already on this
branch; the review report `review/chore-iter-1.md` raised exactly one finding, a major, and this
iteration changes nothing beyond what that finding requires.

## The finding, and why it was real

> **major** — `spike/src/git.js:45` Using `%(refname:short)` does not reliably return the actual
> branch name: when another ref such as a tag shares that name, Git may emit a disambiguated
> value such as `heads/foo`. The subsequent `branches.has(branch)` then treats the real
> `refs/heads/foo` branch as unresolved and leaves its ticket unannotated, violating the
> requirement to annotate every ticket whose branch resolves.

Confirmed by reproduction before fixing. `containment()` reads the branch list once per
invocation (`git for-each-ref … refs/heads`) and matches each ticket's untrusted `branch`
frontmatter against it as a plain string, so a hostile name never reaches a git command line
(AC-3). With `%(refname:short)`, git's shortening is ambiguity-*dependent*: beside a
`refs/tags/harness/T-0001/integration`, the branch of the same name is emitted as
`heads/harness/T-0001/integration`, the set lookup misses, `stateOf()` returns `null`, and a
ticket whose branch genuinely resolves renders unannotated — a silent violation of AC-1's
"every ticket whose branch resolves". Nothing else in the state selection was implicated: once
past the lookup, every git call already used the explicit `refs/heads/…` form.

## What changed, file by file

### `spike/src/git.js`

One line changed plus a comment: the `for-each-ref` format is now `%(refname:lstrip=2)`, which
unconditionally strips exactly two path components (`refs/`, `heads/`) and is unaffected by what
other refs exist. Branch names containing slashes (every `harness/<id>/…` branch) survive intact,
since `lstrip` counts components from the left rather than splitting. The comment above the line
records why `:short` is wrong there, so M2's port does not "simplify" it back.

No other change to the file. The rest of `containment()` — the once-per-invocation probes, the
exit-code mapping, the shallow asymmetry, the argv-only discipline — is untouched.

### `spike/test/q0036-board-containment.js`

Added scenario **C9**, the fixture the reviewer asked for: a project with the ticket branch and a
tag of the identical name (`git tag harness/T-0001/integration`), asserting the row still reads
`main:contained` and nothing reads `indeterminate`. Like C1–C8 it builds its own throwaway
repository and asserts nothing about branches in this repository (AC-7's prohibition).

## Verification

- **The fixture reproduces the defect.** With `%(refname:short)` temporarily restored, C9 fails
  with "the branch resolves and must be annotated despite the tag" while C1–C8 stay green — so
  the new test is red for exactly the reviewer's reason, not incidentally.
- **With the fix, the whole spike suite passes**: `node spike/test/run.js` reports all 10 test
  files green, including `q0033-surface.js` and `smoke.js` unmodified (AC-5) and all nine
  Q-0036 scenarios.

## Deliberately left alone

- Everything from iteration 1: the board render path in `spike/bin/harness.js`, the docs edits
  (`02-sdlc-pipeline-spec.md` §3.4, GLOSSARY's **Containment** and **Stage** entries, the
  DECISIONS entry, the development-plan lines), and scenarios C1–C8. The review raised no
  finding against any of them.
- The reviewer's line reference says `:45`; the construct actually sits at what is now
  `git.js:53` after the comment. Same construct, no second occurrence — nothing else in the
  repository uses `%(refname:short)`.
- `ensureWorktree`/`removeWorktree` also build `refs/heads/…` strings but never consume
  `for-each-ref` short names, so they are outside the finding and untouched.
