---
id: Q-0094
title: CLI run command, gate reader and its flags
stage: requirements
owner: ruud
repos: []
branch: harness/Q-0094/integration
priority: p2
created: 2026-09-01
iterations: {}
history:
  - stage: requirements
    run: 1
    flow: requirements
    status: completed
    stage_before: draft
    stage_after: requirements
    at: 2026-09-04T06:14:00.951Z
    cost: 10.895
---
**The command the whole product exists for** — `spike/bin/harness.js:534–568`, 35 lines in the
switch and considerably more underneath it, because the gate reader is here.

**What it owns:**

- `harness run <flow> <ticket>` with `--dry`, `--auto`, `--base <ref>`, `--adapter <name>`,
  `--gate-answer` (repeatable, consumed in order) and `--verbose`;
- **the interactive gate reader** — the readline handle, the TTY test, and the five throw sites that
  Q-0040 classified on 2026-09-01. Three of them mean *nobody was there* and now end a run
  `undecided`; the other five are operator errors and stay `failed`. That classification is by error
  **type** (`GateUnansweredError`), never by message text, and an abort keeps precedence over it;
- the terminal rendering of the run's event stream, and the exit code it maps a terminal status to —
  including **3 for `undecided`**, which is Q-0040's and is the reason a caller can tell "nobody
  answered" from "I chose to stop this" (`2`) and from "it failed" (`1`).

**`runFlow` is an `AsyncIterable<Event>` in `core`**, not a callback interface — Q-0050's one
authorised behaviour change. Cancellation belongs to the caller's `AbortSignal` and `core` installs
no signal handler, so **the 130-on-signal exit is this package's to own**, not the engine's.

**Inherits 353 lines** — `q0077-base-flag.js` (195), whose seven scenarios pin that `--base` moves
the diff anchor and never the branch a rework step merges from, and `q0034-review-fixes.js` (158).

**`--auto` can produce `undecided`**, at a `human-locked` gate it is forbidden to answer. Decision
076 said it could not; *"Erratum: `--auto` does reach an unanswered gate"* (2026-09-01) corrects
that, and the corrected reading is the one to build against.

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
