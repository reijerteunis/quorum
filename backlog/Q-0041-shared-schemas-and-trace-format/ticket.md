---
id: Q-0041
title: packages/shared — schemas, types and the trace format
stage: reviewed
owner: ruud
repos: []
branch: harness/Q-0041/integration
priority: p1
created: 2026-08-25
iterations:
  chore.review: 2
history:
  - stage: requirements
    run: 1
    flow: requirements
    status: completed
    stage_before: draft
    stage_after: requirements
    at: 2026-08-25T17:46:20.087Z
    cost: 12.676
  - stage: requirements
    run: 2
    flow: chore
    status: exhausted
    stage_before: requirements
    stage_after: requirements
    at: 2026-08-25T18:55:32.926Z
    cost: 0
  - stage: requirements
    run: 2
    flow: chore
    status: failed
    stage_before: requirements
    stage_after: requirements
    at: 2026-08-25T18:55:32.941Z
    cost: 40.465
  - stage: requirements
    run: 3
    flow: chore
    status: exhausted
    stage_before: requirements
    stage_after: requirements
    at: 2026-08-25T19:39:18.895Z
    cost: 0
  - stage: reviewed
    run: 3
    flow: chore
    status: completed
    stage_before: requirements
    stage_after: reviewed
    at: 2026-08-25T20:36:39.775Z
    cost: 13.724
---
The first ticket of Q-0009's port, and the only one everything else imports. `packages/shared` is
empty; `04-architecture.md` gives it *"types, schemas (zod), event/trace format, constants"*, and the
M2 done-when asks for zod schemas covering flow, ticket, role and step output. Today those shapes
are implicit: a flow is whatever `YAML.parse` returned, a ticket is `parseFrontmatter`'s object, and
`schemaFor(step)` builds a JSON Schema for the vendor at run time from fields nothing validated
first. This ticket writes them down once, in the package that has no dependencies, so that every
later port consumes a type instead of re-deriving one. Belongs to M2 in
`docs/06-development-plan.md`; parent Q-0009.

**Scope.** Zod schemas and inferred types for the flow file (steps, `parallel`, `fan_out` + `step`
template, `on_fail`, `route`, `gate`, `input`, `output`, `consumes`/`produces`, `cross_vendor`), the
ticket (`ticket.md` frontmatter, including `iterations` and `history`), the role file, and step
output. `STAGES` and the stage state machine move here from `spike/src/backlog.js:6`. The trace/event
union — `spawn`, `tool`, `text`, `verdict`, `usage`, `done` per `04-architecture.md` — is defined
here even though nothing emits it until Q-0050, because Q-0050 is where it becomes expensive to
change. Constants that more than one package needs (branch-name shapes, worktree root
`.harness/worktrees/`, `.quorum/runs/`) live here rather than being re-typed in three places.

**A new dependency.** `zod` needs the one-line justification the engineering rules require, and
`04-architecture.md` names it, so this is a confirmation rather than a decision. Worth stating
anyway: it is the only schema library whose inferred types and runtime validation come from one
declaration, which is the whole reason for putting the shapes here instead of writing interfaces.

**What must not happen.** Two validators already exist and neither is replaced by this one. The
2026-08-22 decision *"step-output validation is Quorum's contract with its own agents"* names three
distinct checks and forbids confusing them: `checkAgainstSchema` guards vendor output against the
schema Quorum generated (Q-0046), `contracts.js` validates artifacts with ajv, fully strict
(Q-0045), and tolerance for how a vendor wraps its answer stays in `extractJson`. Zod here is a
fourth thing — the shape of Quorum's own files — and adding it must not tempt anyone to collapse the
other three. ajv is not removed; JSON Schema is the contract language solutioning emits and zod
cannot read it.

**One judgement call this ticket makes for everyone.** How strict is the flow schema? A flow file
that fails to parse is a flow that cannot run, and `lintFlow` (Q-0044) already rejects a long list of
malformed shapes with messages written to name something the reader can find in the file. If the zod
schema rejects first, those messages are lost. The likely answer is that zod describes structure and
lint keeps the semantics, but the boundary needs drawing here, once.

## Port charter

The charter is `harness/port-charter.md`; §6's register is normative for everything below and this
body cites it rather than restating it — where the two ever differ, the register is right.

Route: **chore** (`requirements → chore → human gate`), per *"The port takes the chore route,
except the one child that has new behaviour"* (`docs/DECISIONS.md`, 2026-08-25). Behaviour is
preserved per *"The port preserves behaviour; one exception is authorised and everything else
stops the child"* (`docs/DECISIONS.md`, 2026-08-25) — a defect found while reading the spike is
reported, never fixed in passing.

- **Ports:** *(new)* `packages/shared`: zod schemas, event union, constants; `STAGES` from `backlog.js:6`
- **Lifts from `spike/bin/harness.js`:** nothing
- **Depends on:** — · **Depended on by:** every other child
- **Invariants inherited:** register rows 22 (charter §2)
- **Non-goals:** another child's module; editing `spike/**` (charter §3); fixing a defect found
  while reading (§2); the cutover; the `quorum` binary (Q-0010); persisting the event stream;
  anything on v1's exclusion list.
