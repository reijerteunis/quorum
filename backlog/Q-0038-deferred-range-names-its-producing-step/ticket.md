---
id: Q-0038
title: Deferred-range failures name their producing step in every case
stage: draft
owner: ruud
repos: []
branch: harness/Q-0038/integration
priority: p3
created: 2026-08-24
iterations: {}
history: []
---
Opened under AC-2 of Q-0034, which allows a review finding to become a follow-up ticket rather than
forcing another revise loop. This is the one finding that survived Q-0035's chore review
(`backlog/Q-0035-empty-range-diagnostic/review/chore-iter-3.md`). It did not block: the reviewer
returned three majors, then three, then this one, and never a blocker, and Q-0035's `integrate`
proved both suites green before the ticket was accepted at its gate.

**The finding, in the reviewer's words.** `spike/src/engine.js:820` — a deferred range only names its
producing step when the unresolved ref is *exactly* the deferred endpoint. If the other endpoint is
the missing one, the message omits the step and branch that caused the preflight to defer the range,
though AC-9 of Q-0035's merged requirement asks deferred empty, missing and indeterminate failures to
name the expected producer. The fix keeps the distinction about *which* endpoint is missing and adds
the deferred producer and the ref it was expected to create.

**Why this is worth its own ticket rather than a nit.** The same asymmetry cost real money on the
night Q-0035 was implemented, from the other direction. The run-level preflight defers an entire
range when *either* endpoint is created by an earlier step of the same flow — `createdSoFar` is
consulted with a single `find` over both endpoints — so a range like
`harness/{id}/integration...harness/{id}/implement` is skipped whole. When `harness/Q-0035/integration`
did not exist, nothing checked it: `harness run chore Q-0035 --dry` reported the range valid, and the
real run billed **$13.86** to the `implement` step before `review` failed on the missing left
endpoint. The left endpoint is a pre-existing-ref-class endpoint, and it was knowably absent before
the run started.

So there are two halves of one gap, and this ticket should decide whether to close both:

1. **Diagnosis** (the reviewer's finding) — when a deferred range fails, always say which step owed
   which ref, whichever endpoint turned out to be bad.
2. **Timing** (found by walking into it) — validate each endpoint on its own class rather than
   deferring the range wholesale, so a missing pre-existing endpoint fails before any adapter is
   billed. Q-0035's AC-8 promises zero invocations for pre-existing-ref ranges and AC-9 accepts
   earliest-possible for deferred ones; a range with one of each is covered by neither, which is why
   it slipped through a requirement that had otherwise thought hard about this exact subject.

**Two neighbours found the same night, recorded here so they are not lost.** Neither belongs to this
ticket and both want their own:

- **The chore flow cannot run on a ticket's first pass.** `chore.yaml` puts `review` — which diffs
  `integration...implement` — before `integrate`, and `integrate` is the only step that creates the
  integration branch (`spike/src/engine.js:200` says so in a comment). `backlog.js:64` writes the
  branch *name* into frontmatter and nothing ever creates the ref. Q-0008 and Q-0036 only worked
  because the branch was created from `main` by hand minutes before each run — the reflog shows
  `harness/Q-0036/integration` "Created from main" at 23:28:46 against a run that started 23:30:38.
  A statically checkable flow property, and a candidate for `harness lint`.
- **`budget.per_run_usd` does not stop a run.** It is `10` in `harness/harness.yaml`; Q-0035's run 2
  spent $13.86 in a single step and run 3 spent $22.27, neither interrupted.

Belongs to M2 in `docs/06-development-plan.md`.

## Re-derived and re-scoped, 2026-08-30 — before the requirements run

Written by hand ahead of the flow, because a requirement is composed from this body and cannot
read a sibling's folder. Q-0051's requirements run was aborted at its gate the same day so that
this ticket goes first — its body's *Sequencing against Q-0038* asks for exactly that.

### The line map, re-derived

Every position below was written before Q-0077 shifted `spike/src/engine.js` by five lines on
2026-08-29, and two were wrong beyond the shift. Re-derive from the file, never from this list.

| Subject | Body says | Actually |
| --- | --- | --- |
| the reviewer's finding | `:820` | **`:825`** |
| the wholesale `.find()` | *"a single `find`"*, unlocated | **`:133`**, in the preflight block **`:91–142`** |
| `materialiseDiff` / `emptyRangeFailure` | — | **`:790`** / **`:865`** |
| *"`integrate` is the only step that creates the integration branch"* | `:200` | **`:923`**, repeated at **`:226`** |
| the frontmatter branch name | `backlog.js:64` | **unchanged, still `:64`** |

### The diagnosis half is exactly one ternary, not a pattern

`:825` is the **only** site conditioned on `deferred?.ref === ref`. Every other use of the deferred
record — `:871`, `:880` and `:893`, all inside `emptyRangeFailure` — is conditioned on `deferred`
alone and already names the producing step whichever endpoint went bad. So half 1 is one clause in
one function, and the requirement should not go looking for a general asymmetry: there is none.

### The two halves interact, and half 2 does not subsume half 1

Fixing the timing half removes half 1's *headline* case. Once each endpoint is validated on its own
class, a missing pre-existing endpoint fails in the preflight — before any adapter — so it never
reaches `:825` to be explained badly. That is the $13.86 case, and it stops being a diagnosis
problem by ceasing to be a step-time failure at all.

Half 1 is still needed, for a case the body does not name: a deferred range whose *other* endpoint
goes missing **during** the run — the base deleted or moved between the preflight and the step. That
still arrives at `:825`, still with a non-null `deferred`, and still drops the producer clause.
Rarer, not gone. A requirement that closes half 2 and calls half 1 solved would be wrong.

### R-1 is folded in — ruled by Ruud at Q-0051's gate, 2026-08-30

**Under `--base`, an unresolvable override is blamed on a file that does not name it.** `:793` is
`const base = ctx.vars.base ?? ctx.config.repo?.base_branch ?? 'main'`, so under an override `base`
*is* the override; `:829` then throws `repo.base_branch in harness/harness.yaml names missing ref
"<base>"`. `harness run review <id> --base 0f1e40d` against a revision that does not resolve sends
the maintainer to `harness/harness.yaml`, which is not where the value came from. Q-0077 shipped
`--base` on 2026-08-29, after this message was written for Q-0035; the two never met.

It joins this ticket because it is **the same tail of the same function** — a third edit to `:815–831`
rather than a second pass over it weeks later. Two facts bound the risk, both measured today rather
than assumed:

- **The one fixture that pins this phrase drives it from config, not from an override.**
  `spike/test/q0006-engine.js:117` sets `f.config.repo.base_branch = 'missing-base'` and `:120`
  asserts `/repo\.base_branch/i`, `/harness[\/]harness\.yaml/` and `/missing-base/` together. A fix
  that branches on *whether an override is in force* leaves that path's wording untouched, so the
  fixture stays green without being edited. `:130` additionally asserts the sibling
  integration-branch message does **not** mention `repo.base_branch`, which the fix must keep true.
- **No scenario covers an unresolvable `--base`.** `q0077-base-flag.js` B1–B5 use a real revision or
  none. So R-1 adds a test rather than changing one — the cheapest shape a message fix can have.

### Sequencing, the freeze, and why now is the cheap moment

This ticket is **not** in charter §3's `children` list, so the port freeze does not apply to it, and
§3's table names it as one of five tickets that must land before the freeze SHA can be recorded at
`harness/port-charter.md:243`.

**It is a one-tree change, and this is the last moment it can be.** `packages/core` has no diff
subsystem: Q-0051 has not run, so there is no ported twin to keep in step and none of the Q-0066 /
Q-0068 *"lands in both trees together"* cost applies. Every landed port child is untouched, because
the preflight and `materialiseDiff` are Q-0051's and unstarted. After Q-0051 lands, the same fix is
two trees, two suites and a divergence risk.

**It must be contained in `main` before Q-0051's requirements run is repeated**, which is the whole
reason for the abort. Q-0051 then ports the fixed version, and its aborted merged requirement's D-5
— which rules the `.find()` preserved — is superseded rather than followed.

### Evidence already paid for

`backlog/Q-0051-core-engine-diff-preflight/requirements/merged.md` (2026-08-30, $7.274, aborted at
its gate) describes this preflight in eight numbered clauses under its AC-9 and was verified against
the files before the abort. It is the most careful description of the subsystem in the repository.
Read it; do not re-derive it. Its D-5 is the one section this ticket makes obsolete.

### The two neighbours, re-checked

Both are still open and neither belongs here. **The chore flow cannot run on a ticket's first pass**
is now mitigated operationally rather than fixed — charter §8's first checklist item says to create
`harness/<id>/integration` by hand before a child's first chore run, and thirteen children have. It
is still a statically checkable flow property nothing checks. **`budget.per_run_usd` stops nothing**
— it is still `10` in `harness/harness.yaml:14`, `packages/shared/src/project.ts:88` types it, and
`:23` says in a comment that typing a key is not enforcing it.

