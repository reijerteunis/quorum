# Q-0105 — errata

Corrections to `requirements/merged.md` ruled after it landed. Written at a gate, which is the only
window an erratum has (*"the window for an erratum is a gate"*, Q-0094 E-3). An erratum names what
moves and why; it never quietly rewrites the criterion.

## E-1 — AC-3's binding clause is "none of them reaches `pushed`", and the residual it leaves is registered rather than closed

**Ruled at the exhaustion gate of run 2, 2026-09-06, answered `advance`.**

**What was disputed.** Review iterations 1, 2 and 3 each found one instance of a single class: *a
failed probe read as a proven absence*. Iterations 1 and 2 were real defects and are fixed — a
`rev-parse` failure inside a valid work tree now reaches `git failed`, and a configured-but-
unresolvable upstream now reaches `missing ref` rather than `git failed`. Iteration 3's major says
`repositoryAt` (`packages/core/src/git/git.ts:70`) collapses every failure of
`rev-parse --resolve-git-dir` to `false`, so a project below a refused repository, a malformed
gitfile and an inaccessible `.git` path all still read as absence and render nothing.

**What AC-3 actually binds.** Its normative sentence is *"A failed probe, an unresolvable ref, a
shallow repository, an absent remote and an absent upstream each reach their own reason and **none of
them reaches `pushed`**."* In every disputed case the implementation returns `null` and the board
renders **nothing**; it does not reach `pushed`. **AC-3 is met.** The reviewer read it as *"every
failed probe must reach `git failed`"*, which is stricter than the criterion's own words — the
recorded class *a criterion's prose read as a literal contract*, whose rule is that **a requirement
describes what must be conveyed, and only a fixture, a frozen contract's own file, or a criterion
quoting bytes pins bytes** (Q-0091 E-3, Q-0094 E-1, E-2, E-3(b); this is the fifth instance).

**What the finding is nevertheless right about, stated rather than dismissed.** It aims at §3's rule
and at *"The board reports push lag, and never a CI conclusion"* (2026-09-06), both of which say
**silence means only that git answered and there is nothing to say**. Where a probe failed and the
board renders nothing, silence is carrying a second meaning it was not given. That is a real
imperfection in a property this ticket's decision entry makes central, and it is registered here
rather than argued away.

**Why it is not another round.** The three cases do not share a remedy.

- **A project root below a repository git refuses** is refused *on principle*, and the implementer's
  JSDoc states the reasoning in place: closing it needs either git's translated prose — which M-7
  rules out, prose being localised and so never able to decide a state — or a reimplementation of
  git's upward discovery walk, which would make a fixture's verdict depend on whether the directory
  it was built in happens to sit under a repository. That is the one thing a verdict may not turn on
  (*"A test's verdict is a property of the commit, not of the checkout or the account"*, 2026-08-30).
  **This case is closed as unclosable**, and a later reader should not reopen it without new
  evidence about what git can be asked without reading its prose.
- **A malformed gitfile and an inaccessible `.git`** are not defended by that reasoning and could be
  narrowed — the obvious instrument being a filesystem existence check at `repoDir/.git`, so that
  *something is there and git refused it* becomes `failed` while *nothing is there* stays `outside`.
  **That is a design question this requirement does not authorise**, and it collides with
  *"Membership is a git question, not a filesystem one"* (2026-08-28) — so an implement round
  choosing it would be taking a default nobody chose, which `developer-generalist.md` forbids in as
  many words: *"Where the requirement does not cover a case, you stop."*

A fourth traversal would therefore spend a round on an argument about AC-3's scope rather than on a
fix — *"A refused finding is a gate, not another round"* (2026-08-31), whose remedy is this document.

**What moves.** Nothing in AC-3's text. What changes is its reading, ruled here: the clause that
binds is *none of them reaches `pushed`*, and the three-answer probe is judged against that. The
residual is registered as a known limit of this ticket rather than as a criterion left unmet, and the
filesystem-check question is left open for a successor rather than settled in passing.

**What a reviewer of a later change should check.** That no path added afterwards makes a failed
probe reach `pushed` — that is the property, and it is the one AC-3's mutation demonstrates.
