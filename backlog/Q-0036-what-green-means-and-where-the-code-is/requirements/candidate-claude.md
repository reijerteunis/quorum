# Q-0036 — What `green` means, and where the code is

*Requirement · product-manager (Claude) · 2026-08-24 · milestone M2 · routed through the chore flow*

*Scope is AC-14 … AC-17 of `backlog/Q-0034-reconcile-the-unmerged-green-branches/requirements/merged.md`. This document expands those four criteria into eleven independently testable ones and does not re-open the seam, the routing or the ordering that document settled. §"Coverage" maps every criterion back.*

## Problem

`harness board` prints one word for a ticket's stage and nothing about where its code is. On 2026-08-24, Q-0006, Q-0011 and Q-0033 all read `green`; only Q-0033 was in the clone. Two tickets' worth of paid, tested, reviewed work sat on one laptop for a day, and nobody found it from the board — it surfaced while someone chased a missing `.quorum/` directory and first blamed `.gitignore`, which was wrong.

Nothing in the product says these are different things. The stage list in `spike/src/backlog.js:6`, §3.4 of `docs/02-sdlc-pipeline-spec.md` and the **Stage** entry of `docs/GLOSSARY.md` all describe `green` as a position in a state machine, and a reader is left to infer whether that position means "the integration branch integrated and passed its configured suite" or "the code is in the clone". It means the first. Nothing anywhere says so, and the board's rendering quietly suggests the second.

**Since the merged requirement was written, Q-0034 landed both branches.** `655e05a` merged Q-0011 and `0c93a1a` recorded the landing; `git merge-base --is-ancestor <branch> main` now exits 0 for all three integration branches. The incident is over. That changes what this ticket is for — it is no longer a fix, it is the only one of Q-0034's three workstreams that stops the incident recurring — and it changes how it must be tested, because the repository no longer contains an example of the state the feature exists to show. A test that asserts on this repository's live branches would be green today for the wrong reason and would rot the next time a branch lands. Fixtures, not repository state.

**One live case survives, and it is sharper than the original.** Q-0011's ticket sits at stage `red` — regressed by the review flow's backward edge — while its code is on `main`. So the two facts are orthogonal in *both* directions: a ticket can be `green` with nothing landed, and landed with a stage before `green`. No frontmatter field can track that without drifting, which is why the answer is derived from git on every invocation and stored nowhere.

## What the repository says today

Re-derived on 2026-08-24 against the working repository with read-only commands. Each row changes something below.

| Claim | What the repository says |
| --- | --- |
| The three branches are unmerged | Not any more. `git merge-base --is-ancestor harness/Q-0006/integration main`, and the same for Q-0011 and Q-0033, all exit 0 after Q-0034's landing (`655e05a`, `0c93a1a`). The board today would show `contained` for every in-scope ticket. |
| The board makes no git call | Confirmed. `case 'board'` at `spike/bin/harness.js:422` reads `t.meta.stage`, `t.meta.history`, `t.meta.owner` and `t.meta.iterations`, and calls nothing else. This is the first git call in the render path. |
| New machinery is needed to call git | No. `execFileSync` is already imported at `spike/bin/harness.js:14` and used at `:363`; `loadProject()` at `:53` already yields `repoDir` and `config`. |
| There is a ref-existence helper to reuse | Only as a closure: `hasRef` is defined inside `materialiseDiff` at `spike/src/engine.js:715` and is not exported. `spike/src/git.js` exports `ensureWorktree`, `removeWorktree` and `ensureExcluded` and nothing that reads ref state. |
| The base branch is a question | It is not. `harness/harness.yaml:20` sets `repo.base_branch: main`, and the engine's own fallback is `config.repo?.base_branch ?? 'main'` (`spike/src/engine.js:45`). |
| Every ticket carries a `branch` value | Yes — all eleven ticket folders have one, written by `backlog.create` (`spike/src/backlog.js:64`) as `harness/<id>/integration`. Four of those refs do not exist (Q-0001, Q-0002, Q-0003, and this ticket's own until a flow creates it). |
| Only stages after `green` matter | Q-0011 is at `red` with its code on `main`. Stage and containment are independent; see OQ-2. |
| Board output is unconstrained | It is not. `spike/test/q0033-surface.js:315` asserts `iter=…review…2` and `cost=$1.25` in board output, and `spike/test/smoke.js:98` asserts a ticket id appears. Both are committed tests of the current line format. |

## User stories

**`maintainer`** — I run `harness board` most mornings to decide what to pick up. I want it to tell me, for anything that reached `green`, whether that code is in `main` or still only on a branch — without me remembering to check, and without a field in `ticket.md` that will be wrong the moment I merge by hand.

**`adopter`** — I cloned Quorum, ran a flow, and the board told me a ticket was `green`. I want to know what that claim covers before I trust it. If it means a suite passed on a branch, say so, and show me where the branch is. Do not tell me a branch is missing from `main` when the truth is that my shallow clone cannot see far enough to know.

**`contributor`** — I am writing an adapter or a flow template and I need to quote `green` in a doc. I want one definition in `docs/GLOSSARY.md`, one word for the git fact, and no second word for the same thing in a different file.

## Surface

**CLI only** — `harness board`, plus `docs/02-sdlc-pipeline-spec.md`, `docs/GLOSSARY.md`, `docs/DECISIONS.md` and `docs/06-development-plan.md`. No Studio work: M3 owns the web board and will read the same derivation.

## Acceptance criteria

`<base>` is the value of `repo.base_branch` from `harness/harness.yaml`, falling back to `main` exactly as `spike/src/engine.js:45` already does. "In scope" means a ticket whose `stage` is `green`, `reviewed`, `qa-passed` or `deployed`. Every criterion is checkable by running the CLI in a fixture repository; none depends on this repository's branch state.

**AC-1 — The board says where the code is, when it is there.** For an in-scope ticket whose `branch` value names an existing ref, `harness board` renders on that ticket's line the name of `<base>` and one of exactly three states: *contained*, *not contained*, *indeterminate*. When `git merge-base --is-ancestor <branch> <base>` exits 0 the state is *contained*, and no commit count is shown. Test: a fixture repository with a ticket at `green` whose branch is merged into `<base>`; the output names `<base>` and the contained state on that ticket's line.

**AC-2 — Not contained says how far ahead.** When both refs resolve, the repository is not shallow, and the ancestry check does not succeed, the state is *not contained* and carries the number of commits the branch holds that `<base>` does not — the value of `git rev-list --count <base>..<branch>`. Test: a fixture with three commits on the branch and none of them on `<base>` renders the number 3, and the number is asserted against `rev-list --count` rather than hard-coded.

**AC-3 — Indeterminate never masquerades as an answer.** The state is *indeterminate*, and names its reason, when any of these hold: `<base>` does not resolve; the ticket's `branch` does not resolve; the working directory is not a git repository; or a git invocation fails, is unavailable, or does not complete within a bounded time. An indeterminate cell shows no commit count and is never rendered as contained or not contained. Test: three fixtures — a missing `<base>` ref, a missing ticket branch, and a directory with no `.git` — each rendering the indeterminate state with the missing ref or the cause named, each exiting 0.

**AC-4 — A shallow or partial clone is never called "not contained".** Where `git rev-parse --is-shallow-repository` reports true and the ancestry check does not succeed, the state is *indeterminate* and names the shallow clone as the reason. A successful ancestry check in a shallow clone is still reported as *contained*: reachability proven from truncated history is proof, while unreachability is not. Test: a fixture whose repository reports shallow renders indeterminate for a branch that is genuinely ahead, and contained for one that is genuinely an ancestor.

**AC-5 — Derived on every invocation, stored nowhere, and never over the network.** Running `harness board` leaves every `ticket.md` byte-identical, creates and modifies no file in any ticket folder, in `harness/` or in `.quorum/`, and writes no cache. The comparison uses local refs only: the command invokes no `fetch`, `pull`, `ls-remote` or any other git subcommand that contacts a remote, so the board behaves identically offline. Test: hash the backlog tree before and after and assert equality; and run with a recording stub named `git` ahead of the real one on `PATH`, asserting the recorded argv contains only read-side subcommands and no remote-contacting one.

**AC-6 — Everything the board already does is unchanged.** Tickets below `green`, and tickets with no `branch` value at all, render exactly as they do today. The stage headings, the `→ harness run <flow> <id>` hints, the per-ticket `owner=`, `cost=$` and `iter=` fields and the cost legend are unchanged in content and order. `spike/test/q0033-surface.js` and `spike/test/smoke.js` pass unmodified. `harness board` exits 0 in every case in this document, including an empty backlog, a repository with no `harness/*` branches, and a non-git directory: containment is information, never a failure condition, and never blocks or gates anything.

**AC-7 — The `branch` value is treated as untrusted input.** `branch` is a field in a file an agent may have written. It reaches git through argv only, never through a shell, and a value that git would otherwise interpret as an option, or that names no ref, produces *indeterminate* rather than being executed. Test: a ticket at `green` whose `branch` is `--upload-pack=touch pwned` renders indeterminate, creates no file named `pwned`, and exits 0. (`spike/src/git.js:7` already carries this reasoning for branch names built from agent-authored task ids; this criterion extends it to the field the board reads.)

**AC-8 — The docs say what `green` means.** §3.4 of `docs/02-sdlc-pipeline-spec.md` and the **Stage** entry of `docs/GLOSSARY.md` state that a stage is the ticket's position in the SDLC; that `green` means the integration branch integrated and passed its configured suite; and that it never implies the code is contained in `<base>`. Both name the board as where containment is visible. The state machine is not reinterpreted, no stage is added, and no existing stage changes meaning. Test: both files contain the statement, and no other doc still describes `green` in a way that contradicts it.

**AC-9 — One word, defined before its second use.** `docs/GLOSSARY.md` defines the term this work uses for the git fact — *containment*, unless the gate prefers another — before it appears in a second file, and the board's output, the spec, the decision entry and the plan all use that one term. No synonym is introduced: not "landed", not "shipped", not "merged", not "in main". Test: the term is in `docs/GLOSSARY.md`, and a grep for the rejected synonyms in the files this ticket touches returns nothing that names the same concept.

**AC-10 — The decision is on the record.** `docs/DECISIONS.md` gains an entry, in the required shape, recording that containment is derived from git at render time rather than tracked as a stage or a frontmatter field. It names the alternatives considered and why each was rejected: a `landed:` field in `ticket.md` (drifts the moment anyone merges, rebases or resets outside a flow — and a wrong field is worse than none, because it is believed); a stage after `deployed` (conflates a git fact with a position in a state machine a flow advances, and `deployed` is Q-0012's, not this ticket's); and computing it once and caching it under `.quorum/` (the same drift with an extra file). It records the shallow-clone asymmetry of AC-4 as the reason the third state exists.

**AC-11 — The plan keeps up.** `docs/06-development-plan.md` lists Q-0034, Q-0035 and Q-0036 under M2 with one line each, and the M1 section's historical record — including its closing note and its list of carried-forward items — is not rewritten. Test: the three ids appear in the M2 ticket list; a diff of the M1 section shows no change.

### Coverage

| Merged criterion | Covered by |
| --- | --- |
| AC-14 — the board says where the code is | AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7 |
| AC-15 — the docs say what `green` means | AC-8 |
| AC-16 — the decision is on the record | AC-10 |
| AC-17 — the plan and the vocabulary keep up | AC-9, AC-11 |

## Non-goals

- **A new frontmatter field, a new stage, or any change to what `deployed` means.** The point of deriving from git is that no field can drift; adding one would defeat it. `deploy.yaml` is Q-0012.
- **Automating or assisting the landing.** No `land` command, no merge queue, no flow that writes to `<base>`, no prompt to merge. Merging stays a human act outside the flows.
- **Making containment a gate, a lint or an exit code.** A ticket that is not contained is a fact on a board, not a failure. Nothing blocks.
- **Any network access.** No `fetch`, no `ls-remote`, no comparison against `origin/<base>` or any other remote-tracking ref. Local refs only (see OQ-3).
- **`harness board --json`, or any other new command or flag.** The board's text output is the whole surface.
- **Any Studio or web work.** M3 owns the visual board.
- **Re-specifying Q-0006, Q-0011 or Q-0033,** re-auditing the landing Q-0034 performed, or recomputing M1's cost record.
- **Fixing the known understatement in `ticket.md`'s `history` roll-up,** which the board's `cost=` field inherits. Out of scope here and unchanged by this work.
- **A history of containment** — when a branch landed, who landed it, or an alert when it changes. The board reports the present state each time it is run.
- **Extending containment to tickets below `green`** (see OQ-2), or to branches other than the one the ticket's `branch` field names.
- **The other M1 carry-overs:** no lock on a ticket, `finish()` not rolling back task branches, and the `--base` flag.

## Open questions

**OQ-1 — A ticket at `green` whose own `branch` ref is missing: indeterminate, or rendered as it does today?** *Owner: `maintainer`. Recommendation: indeterminate. Not blocking; it changes one test.*
AC-14 of the merged requirement can be read two ways. Its scope sentence covers tickets "whose `branch` value resolves to an existing git ref", which would leave an unresolvable one out of scope entirely; its last sentence says such a ticket "renders as it does today". But its middle sentence names "indeterminate because a required ref is missing" as one of the three states, and the ticket branch is a required ref. I have written AC-3 for indeterminate, because a `green` ticket with no ref is exactly the ambiguity this work exists to remove — rendering nothing leaves the reader to guess, which is where the incident started. Answer "as today" and AC-3 loses one of its three fixtures and AC-6 gains a case.

**OQ-2 — Tickets below `green` show nothing, even when their code is on `<base>`.** *Owner: `maintainer`. Recommendation: accept, as scoped. Not blocking.*
Q-0011 is at `red` today with its code on `main`, so the scoping to `green`-or-later hides a true fact about a real ticket. Widening it to every ticket whose `branch` resolves is a one-word change and would make the board noisier for tickets in flight, where the answer is uninteresting by construction. Keeping the scope also keeps the criterion aligned with what `green` is being defined to mean.

**OQ-3 — Compare against the local `<base>` only, or prefer a remote-tracking ref when one exists?** *Owner: `maintainer`. Recommendation: local only. Not blocking.*
A stale local `main` will report a branch as not contained after it has been pushed and merged elsewhere. Preferring `origin/main` would fix that and would make the board's answer depend on when the user last fetched — with no way to tell those apart, and a strong pull toward fetching, which AC-5 forbids. Local refs, with `<base>` named in the output so the reader knows exactly what was compared.

**OQ-4 — The exact words and layout of the three states.** *Owner: `maintainer`. Cosmetic; not blocking.*
The criteria fix the information, not the phrasing. Proposed rendering, appended to the existing ticket line and following the cost legend's precedent with one dim legend line printed only when at least one containment cell was rendered:

```
green         → harness run review <id>
  Q-0006 Review flow — engine, counters…  owner=ruud cost=$22.15 iter={…}  main: contained
  Q-0033 Review flow surface…             owner=ruud cost=$66.06 iter={…}  main: 5 ahead, not contained
  Q-0011 Run history on disk…             owner=ruud cost=$78.02 iter={…}  main: indeterminate — no ref harness/Q-0011/integration
· containment is read from git on each run and stored nowhere; indeterminate means git could not answer, not that the code is missing
```

**OQ-5 — Should `docs/06-development-plan.md` also list Q-0037?** *Owner: `maintainer`. Recommendation: yes, one line. Not blocking; AC-11 does not require it.*
Q-0037 exists in the backlog and belongs to M2 for the same reason the other three do. Adding it costs one line and avoids a second pass; leaving it out is defensible since it is nothing to do with this ticket's subject.

## Risks

- **This is the first git call in the render path, in the command people run most often.** A crash, a hang or a stack trace from `board` is worse than the ambiguity it replaces. AC-3's catch-all — any failure becomes indeterminate with a named reason — and AC-6's exit-0 guarantee are the mitigation, and the non-git-directory fixture is the test that proves the degradation path is real rather than assumed.
- **The repository no longer contains the state the feature exists to show.** All three example branches are contained since Q-0034. A test that asserts on live branch state would pass today, teach nothing, and break the next time a branch lands — the exact class the 2026-08-23 decision on permanent acceptance tests warns about. Every criterion here is written against a constructed fixture for that reason.
- **A shallow clone reported as "not contained" would be a confident falsehood in an adopter's first minutes,** and it is the failure mode the merged requirement singled out. AC-4 is the mitigation, and its asymmetry — positive proof survives truncation, negative proof does not — is worth restating in the decision entry so nobody "simplifies" it later.
- **The board's per-ticket line is asserted by two committed tests** (`spike/test/q0033-surface.js:315`, `spike/test/smoke.js:98`). Appending a cell is safe; reformatting the line is not. AC-6 names both files.
- **`docs/DECISIONS.md` is append-only and Q-0035 also adds an entry to it.** If both land in the same window, the conflict is a mechanical one at the end of the file — but Q-0034's landing has already shown what a careless resolution costs in that file. Land one at a time.
- **The board reports; it does not alert.** Containment is only visible to someone who runs `harness board`. That is the deliberate limit of this ticket — a gate, a lint or a notification would be scope creep — but it means the recurrence it prevents is prevented for a reader, not for an absent one.
- **`indeterminate` is the state most likely to be misread as "broken".** Its reason must always be printed with it, and the legend must say plainly that git could not answer rather than that the code is missing.

## Cross-cutting checklist

- **BYOS** — n/a in the sense that no auth path is touched, and load-bearing in the sense that nothing here may add one. `harness board` invokes no adapter, makes no vendor request, and reads no environment variable naming a key. `check()`'s refusals are untouched.
- **Worktree safety** — The board is strictly read-only: no worktree is created, no branch is created, moved or deleted, nothing is written to the working tree or to `<base>`. AC-5 asserts this by hashing the tree.
- **Gate behaviour** — Unchanged. No gate is added, none becomes `auto`, no `human-locked` gate is touched, and containment never gates a run.
- **File format** — No change to `ticket.md`'s frontmatter or to any schema. AC-5 exists precisely so no format change is needed.
- **Lint rules** — Unchanged. `lintFlowDirectory` and the cross-vendor rule are untouched; this adds nothing a flow file can express.
- **Dependencies** — None added. `execFileSync` is already imported in the CLI (`spike/bin/harness.js:14`).
- **Product-agnostic** — No SaaS product is named. `<base>` is read from config; `main` is a fallback, not an assumption baked into a message.
- **Cold-clone impact** — Net positive and bounded: at most two git invocations per in-scope ticket plus a small constant, all local, none over the network, no new command and no new step before a first run. The adopter gains one cell in output they already read, and one sentence in the docs that answers a question the board previously left open.

## Implementation pointers

Non-binding; the architect or implementer may do better.

- `case 'board'` is `spike/bin/harness.js:422`. `loadProject()` (`:53`) already returns `repoDir` and `config`, so `<base>` is `config.repo?.base_branch ?? 'main'` — the same expression the engine uses at `spike/src/engine.js:45`.
- `hasRef` exists only as a closure inside `materialiseDiff` (`spike/src/engine.js:715`). A small exported helper in `spike/src/git.js` — ref resolution, ancestry, ahead-count, shallow — would serve both callers, keep vendor-free git knowledge in one module, and give M2's port to `packages/core` a single place to move. `spike/src/git.js:7` already documents the argv-not-shell rule AC-7 depends on.
- The stage set for "in scope" is `STAGES.slice(STAGES.indexOf('green'), STAGES.indexOf('blocked'))` from `spike/src/backlog.js:6`, or an explicit list — `blocked` and `abandoned` are side states, not later ones, and must not be swept in by an index comparison.
- The existing cost legend at `spike/bin/harness.js:436–440` is the precedent for a conditional legend line: printed only when at least one cell was rendered, and stating what the number can and cannot see.
