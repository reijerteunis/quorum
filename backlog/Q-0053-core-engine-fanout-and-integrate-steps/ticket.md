---
id: Q-0053
title: core/engine — fan-out and integrate steps
stage: reviewed
owner: ruud
repos: []
branch: harness/Q-0053/integration
priority: p2
created: 2026-08-25
iterations:
  chore.review: 1
history:
  - stage: requirements
    run: 1
    flow: requirements
    status: completed
    stage_before: draft
    stage_after: requirements
    at: 2026-08-31T06:35:21.177Z
    cost: 8.414
  - stage: reviewed
    run: 2
    flow: chore
    status: completed
    stage_before: requirements
    stage_after: reviewed
    at: 2026-08-31T09:10:29.985Z
    cost: 33.038
---
Ports the two composite step kinds — `runFanOut` and `runIntegrate` — plus
`syncBaseIntoTicketBranch`, `environmentFailure`, `testReport`, `mergeFailure` and `cmdTimeout`.
Roughly 250 lines of `spike/src/engine.js`, sitting on the plumbing Q-0048 ports. Belongs to M2 in
`docs/06-development-plan.md`; parent Q-0009.

**`integrate` is one generic step type used by three stages** (2026-08-21): it merges the listed
branches into a target in a worktree, optionally runs `commands.test`, and asserts `expect: pass|fail`.
Solutioning lands contracts with it, qa-red proves red with `expect: fail`, development proves green
with `expect: pass` and `on_fail` scoped to the failing tasks.

**Four invariants make a red phase trustworthy, and all four live here.** The 2026-08-22 decision
*"red for the right reason is an engine property, not a role property"* is the single most expensive
lesson in this file — M1's plan assumed the work was prompt-tuning the `automation-qa` role, and six
runs produced no evidence the role was ever at fault while finding six engine defects:

1. **Dependencies are installed in the worktree before the test command runs.** A worktree is a fresh
   checkout with no `node_modules`, the test command died on a missing dependency, and `expect: fail`
   read exit 1 as proof of red. *Every ticket would have proved red this way, forever.*
2. **A suite that could not start is rejected rather than counted as red.** Non-zero exit is not
   evidence a suite ran.
3. **The ticket branch is synced to `repo.base_branch` first.** Q-0006's integration branch was five
   commits stale, so QA worked against a tree without `ajv` or `test/run.js` and appeared to revert
   both.
4. **Every terminal outcome is written to `runs.log` with its counters persisted.**

**The detector that defeated itself.** The guard added for (2) was beaten by its own test: a suite
asserting *"a broken environment is not a red phase"* prints that signature in a pass message, and the
detector matched it, throwing away a genuine red phase. `environmentFailure` therefore ignores
anything on a line that reports a result — a line reporting a result is proof the suite ran, and
cannot be proof it never started. Port that reasoning, not just the regex.

**Stop rather than retry.** *"A loop spending its budget on work no agent in it can perform"* is the
first of M1's three recurring shapes, with four recorded instances — a hung test command, a base
conflict at integrate, a base conflict before fan-out, and tests whose only fix lay in a file no task
owned. The remedy is identical every time: stop and name the work a human must do. Two 2026-08-23
decisions close it from the other side (every file a red test requires is owned by exactly one task;
a red test is a permanent acceptance test), and both are enforced at the qa-red gate rather than
here — but this is where the budget gets burned when they are missed.

**`testReport` truncates on purpose** (24 KB), because a suite's output goes into the next agent's
prompt. `mergeFailure` and `IntegrationError` must keep printing sentences rather than stacks.

## Line map re-derived 2026-08-31, before the requirements run

The body above was written 2026-08-25. Q-0048, Q-0050, Q-0051 and Q-0052 have landed on its subject
since, and Q-0052's own run showed what a stale body costs: its port list was wrong in four places
and the requirement had to correct it before an implementer could use it. Re-derived here rather
than left for the run to discover. **Line numbers are given because they were measured today; they
were wrong within ten hours on Q-0051, so re-derive them at the branch's own SHA rather than
trusting this section.**

**The list of seven is a list of six, and one it names is already ported.** `mergeFailure` is
`packages/core/src/engine/steps.ts` — Q-0052 took it, because its first caller is `runAgentStep`'s
base-sync warning and whoever ports the first caller ports the function. Its other four call sites
are this ticket's, so what remains here is *calling* it, not writing it.

**`cmdTimeout` is ported too, and that is the finding worth the most.** Q-0052 ported it as
`commandTimeout` (`steps.ts:72`) — renamed, and a **module-private `const`, not an export**. It has
three call sites in the spike: `:632` in `runScript`, which is the one Q-0052 ported, and **`:1133`
and `:1139`, both inside `runIntegrate`**, which is this ticket's. So this ticket needs a value that
exists in `core` and cannot reach it. Export it from `steps.ts`, relocate it, or duplicate it — and
duplicating is the one to refuse, because two copies of a default drift silently and nothing here
would fail. **Decide it in the requirement rather than in the implementer's head.**

**`safeMergeBase` is a seventh function the body does not name at all**, and it would be lost.
`spike/src/engine.js:550–553` returns the merge-base **sha** or `null` on failure, and
`runIntegrate:1092` is its only caller. `packages/core/src/git/git.ts` has `ancestry`, which runs
`merge-base --is-ancestor` and answers a **boolean** — not the same primitive, and not a substitute.
It sits between `testReport` and the fan-out block rather than inside either, which is how a port
working from "the two composite steps plus five helpers" walks past it.

**`IntegrationError` is already ported** (`packages/core/src/fanout/fanout.ts:32`, Q-0048), and its
JSDoc already states the sentence-not-stack rule the last paragraph above asks for. Half of that
sentence is done; `mergeFailure`'s half travelled with the function.

**Every other collaborator is already in `core`.** Measured by extracting the call sites from the
six spans and grepping each: thirteen from Q-0048's fan-out plumbing (`loadTasks`, `waves`,
`taskVars`, `taskPromptSection`, `scopeToFailing`, `ticketWorktree`, `branchExists`, `branchHead`,
`mergeInto`, and the rest), `interpolate` and `loadRole` from `loaders.ts`, `handleFail` from
`routing.ts`, `runAgentStep` from `steps.ts`, `runCommand` from `fanout/command.ts`,
and `writesOf` from `lint.ts`. The occurrence seam is not missing either — `allocateOccurrence`,
`terminalOccurrence` and `persistArtifact` are `RunHistory.allocate`, `.terminal` and `.persist`
(`run-history/writer.ts:96/108/116`), widened by Q-0052's R-4. **So this ticket writes the two
composite steps and almost nothing else**, which is the same shape Q-0052 turned out to have.

**The size is 200 lines, not "roughly 250".** Measured: `syncBaseIntoTicketBranch` `:1010–1024`
(15), `runFanOut` `:1026–1066` (41), `runIntegrate` `:1068–1179` (112), `environmentFailure`
`:1193–1208` (16), `testReport` `:537–548` (12), `safeMergeBase` `:550–553` (4). The dispatch stubs
to replace are `routing.ts:102–103`, both `unavailableStep(step, 'Q-0053')` — one for
`step.type === 'integrate'` and one for `step.fan_out`.

**`testReport`'s one-line summary above understates it.** `maxBytes = 24000` is split as head and
tail of 12,000 with an omission marker naming the character count — but the part that matters is
the **separate roster of every result line**, matched by `RESULT_LINE` and emitted whole regardless
of truncation. That is Q-0033's actual finding: the previous shape kept the last 8,000 characters
and seven of nineteen failing groups had no line at all, so the reviewer judging the red phase never
saw them. Port the roster and the reasoning, not the byte count.

## Inherited from Q-0052, 2026-08-31 — three obligations this body must carry

Written here because `requirements.yaml` reads this ticket's folder and not a sibling's.

1. **`runAgentStep`'s `extra` parameter is already there and this ticket is its only caller.**
   Q-0052 ported all three fields — `extra.vars`, `extra.syncBase`, `extra.promptSuffix` —
   deliberately, with no caller of its own, precisely so this ticket does not change a landed
   exported signature and every test written against it. Supply them; do not reshape it.
2. **The `preserved defect/` count in `q0050.source.test.ts` is cross-file arithmetic, now `11`**,
   and this ticket moves it again. Q-0052's R-5 names the trap: the prose comment above the
   assertion enumerates which file contributes what, so a change that moves the number and not the
   comment leaves a comment describing a number that is no longer there. Move both.
3. ~~**`s.into` is this ticket's coercion site**~~ — **struck 2026-08-31, and it was never
   this ticket's.** Q-0052's merged requirement said `s.into` was Q-0053's; Q-0051 had already
   discharged it, and `packages/core/src/engine/diff.ts:472` reads
   `interpolate(String(s.into), context.vars)` today. Nothing is owed. Left visible rather than
   deleted, because the obligation was carried here in good faith from a sibling's document and the
   correction is the useful record.

## Corrections to the section above, 2026-08-31

Two claims in the collaborator sweep were wrong, both found by the requirements run and both
verified by hand afterwards. **Both were grep false positives, which is this repository's own
lesson arriving in its own preparation: a grep is not a measurement.**

- **`failed` is not an export of `routing.ts`.** It is a local `const` at `:61` inside `runStep`'s
  parallel handling; the file exports `askGate`, `runStep` and `handleFail` and nothing else. The
  sweep matched the local declaration. Corrected in the list above.
- **`s.into` was already discharged**, as obligation 3 now says.

The sweep's *other* direction failed once too and was caught during the derivation rather than
after it: `cmdTimeout` first read as unported because Q-0052 had renamed it `commandTimeout`. One
sweep, three errors, two directions. `requirements/merged.md` supersedes this section wherever they
disagree, and it was written against the tree rather than against this body.

## Port charter

The charter is `harness/port-charter.md`; §6's register is normative for everything below and this
body cites it rather than restating it — where the two ever differ, the register is right.

Route: **chore** (`requirements → chore → human gate`), per *"The port takes the chore route,
except the one child that has new behaviour"* (`docs/DECISIONS.md`, 2026-08-25). Behaviour is
preserved per *"The port preserves behaviour; one exception is authorised and everything else
stops the child"* (`docs/DECISIONS.md`, 2026-08-25) — a defect found while reading the spike is
reported, never fixed in passing.

- **Ports:** `engine.js` fan-out and integrate steps
- **Lifts from `spike/bin/harness.js`:** nothing
- **Depends on:** Q-0052, Q-0048 · **Depended on by:** —
- **Invariants inherited:** register rows 7 (charter §2)
- **Non-goals:** another child's module; editing `spike/**` (charter §3); fixing a defect found
  while reading (§2); the cutover; the `quorum` binary (Q-0010); persisting the event stream;
  anything on v1's exclusion list.
