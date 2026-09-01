---
id: Q-0090
title: CLI package skeleton, bin entry and npx quorum
stage: draft
owner: ruud
repos: []
branch: harness/Q-0090/integration
priority: p1
created: 2026-09-01
iterations: {}
history: []
---
**The prerequisite for every other child of Q-0010, and the only one that is.** `packages/cli` is a
stub today: `src/index.ts` is the single line `export const name = '@quorum/cli'`, and
`package.json` has no `bin`, no dependencies and no runtime entry at all.

**What this child builds** is the scaffolding all five siblings need and none of them should invent
twice:

- a `bin` entry and the executable it points at, so `quorum <command>` runs;
- argv parsing — `spike/bin/harness.js:25–26` is `process.argv.slice(2)` plus a flag object, and the
  eight commands read positional `rest` and named flags from it;
- the colour helper (`:44`) and `die` (`:124`), which every command's error path uses;
- **exit codes as a single owned table**, not scattered `process.exit` calls. Measured in the spike:
  `0` and `2` at `:557` (`aborted ? 2 : 0`), `1` via `die` and at `:403`, `:459`, `:551`,
  `process.exitCode = 1` at four sites, `130` on signal (`spike/src/engine.js:87`), and **`3` for an
  undecided run**, which Q-0040 added on 2026-09-01 and which is the newest member;
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
