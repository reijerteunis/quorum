---
id: Q-0090
title: CLI package skeleton, bin entry and npx quorum
stage: reviewed
owner: ruud
repos: []
branch: harness/Q-0090/integration
priority: p1
created: 2026-09-01
iterations:
  requirements.head-of-product: 1
  chore.review: 2
history:
  - stage: draft
    run: 1
    flow: requirements
    status: exhausted
    stage_before: draft
    stage_after: draft
    at: 2026-09-01T19:23:07.465Z
    cost: 0
  - stage: requirements
    run: 1
    flow: requirements
    status: completed
    stage_before: draft
    stage_after: requirements
    at: 2026-09-01T19:49:55.505Z
    cost: 19.068
  - stage: requirements
    run: 2
    flow: chore
    status: exhausted
    stage_before: requirements
    stage_after: requirements
    at: 2026-09-01T21:02:07.427Z
    cost: 0
  - stage: requirements
    run: 2
    flow: chore
    status: exhausted
    stage_before: requirements
    stage_after: requirements
    at: 2026-09-01T21:27:13.597Z
    cost: 0
  - stage: requirements
    run: 2
    flow: chore
    status: exhausted
    stage_before: requirements
    stage_after: requirements
    at: 2026-09-01T21:48:14.316Z
    cost: 0
  - stage: reviewed
    run: 2
    flow: chore
    status: completed
    stage_before: requirements
    stage_after: reviewed
    at: 2026-09-01T23:04:52.484Z
    cost: 52.162
---
> **RULED AT THE EXHAUSTION GATE, 2026-09-01 — read this before the rest of the body.**
>
> This ticket's requirements run returned `needs-input` twice and was right both times. Its
> surviving blocker is **granted**: the build system is a separate ticket, now **Q-0096 — "The
> workspace emits JavaScript, and quorum is a runnable binary"**, and Q-0010's cut is seven children
> rather than six.
>
> **What moves to Q-0096:** the emit strategy, `tsconfig` `paths`, package `exports`/`main`/`types`,
> a `build` task and what `outputs` it declares, the executable the `bin` entry points at, and the
> meaning of `npx quorum`. All of it needs a decision entry first, because a build task with real
> outputs replays an **artifact** rather than a verdict, which is a class this repository has never
> had.
>
> **What stays here, and it is smaller than this body's opening sentence claims.** Q-0090 delivers
> the frame **as importable modules with tests that run in process**, exactly as every other package
> in this workspace already does: argv parsing, the colour helper, `die`, and the exit-code table
> below. It declares the package manifest and its `bin` field, and it does **not** have to produce a
> runnable binary — nothing in this workspace runs outside Vitest today, and making that untrue is
> Q-0096's subject.
>
> **Therefore the acceptance test in this body is withdrawn.** "`npx quorum` works from a clean
> clone" is not achievable here and is not claimed: every package is `"private": true` and `npx
> quorum` resolves against the **public registry** today. Q-0096 claims the workspace and packed-tarball
> paths; registry `npx` is Q-0029's in M6.
>
> **Two corrections to the requirement itself, both verified at this gate.** Iteration 1's AC-5(b)
> named `runTerminalStatusSchema`, which is a module-private `const` at
> `packages/shared/src/events.ts:210` — the exported symbol is the `runTerminalEventSchema` alias at
> `:232`, so that check could not have compiled; iteration 2 caught it and retyped the exhaustiveness
> check off `RunTerminalEvent['status']`, which resolves without `@quorum/core`. And **OQ-4
> dissolves**: a role's `paths:` list is advisory prompt text and is not mechanically enforced — the
> only enforced gate is `commitAll`'s revert of `backlog/` — so `pnpm-lock.yaml` moves as the output
> of an allowed `pnpm install` rather than as an authored edit. That is the same finding Q-0040's
> E-2 reached independently.
>
> **Q-0090 remains the prerequisite for Q-0091 to Q-0094**, which need argv, `die` and the exit
> table. It is no longer the prerequisite for *running* anything; **Q-0095 depends on Q-0096.**

**The prerequisite for every other child of Q-0010, and the only one that is.** `packages/cli` is a
stub today: `src/index.ts` is the single line `export const name = '@quorum/cli'`, and
`package.json` has no `bin`, no dependencies and no runtime entry at all.

**What this child builds** is the scaffolding all five siblings need and none of them should invent
twice:

- a `bin` entry and the executable it points at, so `quorum <command>` runs;
- argv parsing — `spike/bin/harness.js:25–26` is `process.argv.slice(2)` plus a flag object, and the
  eight commands read positional `rest` and named flags from it;
- the colour helper (`:44`) and `die` (`:124`), which every command's error path uses;
- **exit codes as a single owned table**, not scattered `process.exit` calls. Re-derived against
  `main` on 2026-09-01, **after** Q-0040 merged and shifted three of them:

  | code | where, today | meaning |
  | --- | --- | --- |
  | `0` | `:404`, `:460`, and the fallthrough of `:557` | success |
  | `1` | `die` at `:124`, plus `:404`, `:460`, `:548` | error |
  | `1` (soft) | `process.exitCode = 1` at `:499`, `:517`, `:523`, `:531` | **a distinct mechanism, and preserved**: it sets the status and lets the process finish writing, where `process.exit` truncates. A port that collapses the two loses output on the `runs` warning paths |
  | `2` | `:557` | the human chose to stop it — `aborted` |
  | `3` | `:557` | nobody was there — `undecided`, added by Q-0040 on 2026-09-01 |
  | `130` | **`spike/src/engine.js:87`**, not the CLI | signal. `core` installs no signal handler (Q-0050 AC-5), so in `packages/cli` this becomes the CLI's own, and is Q-0094's to place |

  `:557` is now a single three-way expression —
  `r.status === 'aborted' ? 2 : r.status === 'undecided' ? 3 : 0` — so 0, 2 and 3 are decided in one
  place and a fourth status would extend it there. Do not re-derive this table from the ticket body's
  earlier draft or from `docs/`; it was wrong by three line numbers within an hour of being written,
  because Q-0040 landed in between.
- `npx quorum` working from a clean clone, which is this child's acceptance test and is also M6's
  cold-clone path.

**No command is implemented here.** A child that starts implementing `board` to have something to
run is out of scope; the deliverable is the frame plus one trivial command or `--help` sufficient to
prove the binary runs.

**The `@quorum/cli` package must depend on `@quorum/core` and `@quorum/shared`** and on nothing the
spike depends on. `turbo.json` and the workspace wiring come with it, and `packages/core`'s
`turbo-inputs.test.ts` may earn a registration — that guard has stopped four tickets on the way in
and stopping is the correct behaviour, not an obstacle.

## Ground rules — Q-0010's, repeated here because a child cannot read its parent

`input.backlog` resolves against the running ticket's own folder, so nothing injects Q-0010's body
into this run. These five are the parent's §4 and are binding.

1. **The spike stays authoritative and green until cutover.** `spike/` is what develops Quorum
   today and every child of Q-0010 runs through it. A witness that has been edited is not one, so
   **do not modify `spike/src/`**. Q-0010's children are *not* in `harness/port-charter.md`'s
   `children:` list, so the branch-scope job reports them out of scope rather than failing them —
   the rule is this body's, not the guard's. If a change to `spike/src` is genuinely required, stop
   and say so; it takes §3's mirror-and-re-record path and is a decision, not a step.
2. **The spike's own tests are not deleted or edited to make room.** A child *adds* coverage under
   `packages/cli`; `spike/test/**` keeps working until the cutover deletes it wholesale.
3. **Behaviour is preserved, and a known defect is reported rather than fixed in passing.** Q-0059's
   traversing `dirOf`, Q-0060's silent frontmatter, Q-0066's probe crash and Q-0068's product name
   in the BYOS refusal are all open tickets that land in both trees; do not close one here.
4. **`packages/core` already holds the logic.** Every domain helper the spike CLI defines locally
   is in `core` — checked by name in Q-0010's body. If something appears to need porting, look for
   it in `core` first and say so if it is genuinely absent; the CLI is a presentation layer over an
   API that exists.
5. **`packages/core/src/spike-parity.test.ts` is updated in the same change.** It records, file by
   file, what the workspace suite carries of `spike/test/` and which half transfers at Q-0010. A
   child that translates a binary half without re-classifying its file leaves a register saying the
   work is still owed — and the file's own line totals are pinned, so they are **re-derived, not
   adjusted**.

Belongs to M2 in `docs/06-development-plan.md`. Child of **Q-0010**, whose body carries the cut, the
order and the measurements this one does not repeat.
