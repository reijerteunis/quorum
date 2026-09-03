---
id: Q-0091
title: "CLI read-only commands: lint and validate"
stage: reviewed
owner: ruud
repos: []
branch: harness/Q-0091/integration
priority: p2
created: 2026-09-01
iterations:
  requirements.head-of-product: 2
  chore.review: 2
history:
  - stage: draft
    run: 1
    flow: requirements
    status: exhausted
    stage_before: draft
    stage_after: draft
    at: 2026-09-02T17:13:58.331Z
    cost: 0
  - stage: requirements
    run: 1
    flow: requirements
    status: completed
    stage_before: draft
    stage_after: requirements
    at: 2026-09-03T17:01:35.394Z
    cost: 13.545
  - stage: requirements
    run: 2
    flow: chore
    status: exhausted
    stage_before: requirements
    stage_after: requirements
    at: 2026-09-03T19:32:28.824Z
    cost: 0
  - stage: reviewed
    run: 2
    flow: chore
    status: completed
    stage_before: requirements
    stage_after: reviewed
    at: 2026-09-03T19:54:16.485Z
    cost: 58.602
---
*The folder name still reads `…-board-lint-valida`, which is the id it was created under on
2026-09-01 and is deliberately not renamed: `runs.log`, run history under `.quorum/runs/`, the
branch `harness/Q-0091/integration` and every citation elsewhere resolve against it. The title
and the body are what moved.*

**Two commands that read and print, and change nothing.** Re-scoped at the requirements gate on
2026-09-03 from four to two — see `requirements/errata.md` **E-1**, which is binding. `board` and
`adapters` are **Q-0099's**, and the seam is measured in the spike source rather than chosen: `lint`
(`harness.js:404`) and `validate` (`:460`) end in `process.exit(ok ? 0 : 1)` and carry an exit-code
contract a `type: script` step depends on, while `board` (`:398`) and `adapters` (`:425`) end in
`return;` and can only exit 0.

| command | spike lines | what it needs from `core` |
| --- | --- | --- |
| `lint` | `:400–405`, 6 lines | `lintDirectory` (Q-0044) |
| `validate` | `:426–461`, 36 lines | `validateArtifact`, `readData` (Q-0045) |

**The merged requirement is `requirements/merged.md`; its §5 AC-1 to AC-13 are this ticket** and
Appendix A is Q-0099's. **Four errata bind this run** and each was written by hand at the gate,
because every one is work no chore step may perform: E-1 the re-scope, E-2 the `spike-parity`
register schema, E-3 the skip-notice contradiction, E-4 the coverage figures.

**Where the inherited coverage actually is** — the body's old *"698 lines"* sentence was wrong three
ways and its grouping premise false in every direction (E-4). For these two commands: `lint` has
three sites in `q0033-surface.js` (476 lines, whose other sixteen invocations are Q-0093's and
Q-0094's), and **`validate`'s entire binary half is in `q0011-runs-cli.js`, which is Q-0092's file**.
So this ticket translates a command-scoped set of behaviours across files rather than translating a
file.

**Two things measured and easy to get wrong.** `validate`'s skipped-check notice is **the sentence
Q-0037 shipped**, transcribed at `validate-artifact.test.ts:157` and `:189` — *not* the phrase
`contracts/Q-0011/runs-cli.contract.md:46–48` uses, which is a requirement in prose and which the
shipped string does not contain verbatim; E-3 rules it, and following the contract literally would
revert Q-0037. And the API-key refusal still says "Harness", which is **Q-0068's** and not this
child's; `validate`'s usage line says `harness validate`, which is **Q-0100's** and is preserved
verbatim here.

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
