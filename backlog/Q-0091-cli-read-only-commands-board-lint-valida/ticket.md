---
id: Q-0091
title: "CLI read-only commands: board, lint, validate, adapters"
stage: draft
owner: ruudvanengelenhoven
repos: []
branch: harness/Q-0091/integration
priority: p2
created: 2026-09-01
iterations: {}
history: []
---
**Four commands that read and print, and change nothing.** Grouped because they share that property
and because their two test files cover them together.

| command | spike lines | what it needs from `core` |
| --- | --- | --- |
| `board` | `:353–399`, 47 lines | `Backlog`, `STAGES`, `containment` (Q-0042), `currentBranch` |
| `lint` | `:400–405`, 6 lines | `lintDirectory` (Q-0044) |
| `validate` | `:426–461`, 36 lines | `validateArtifact`, `readData` (Q-0045) |
| `adapters` | `:406–425`, 20 lines | `getAdapter`, `probeAdapter` (Q-0046/Q-0047) |

**Inherits 698 lines of binary-half coverage** — `q0033-surface.js` (446) and
`q0036-board-containment.js` (221) — which is more than the commands themselves, and is the point:
these four are thin over `core`, so what transfers is the assertion that the *surface* behaves.

**Three things measured and easy to get wrong.** `board` renders containment as one token per
ticket and the vocabulary is fixed by the glossary — `main:contained`, `main:not-contained(+12)`,
`main:indeterminate(...)` — and the board says "contained", never "merged" or "landed".
`validate`'s skipped-check notice must keep the words *run-manifest semantic checks were skipped*,
because `contracts/Q-0011/runs-cli.contract.md:47–48` requires them and `contracts/` is not this
role's to amend; Q-0037 shipped the current wording and `packages/core/src/contracts/validate-artifact.test.ts`
transcribes it, so that test moves with any change. And `adapters` must refuse when an API key is in
the environment — that refusal is the BYOS guarantee and its message currently says "Harness", which
is Q-0068's to fix and **not** this child's.

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
