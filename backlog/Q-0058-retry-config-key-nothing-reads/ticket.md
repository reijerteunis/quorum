---
id: Q-0058
title: harness.yaml documents a retry key nothing reads
stage: draft
owner: ruud
repos: []
branch: harness/Q-0058/integration
priority: p2
created: 2026-08-26
iterations: {}
history: []
---
Found by Q-0043's implement step while reading the adapter contract layer, reported and not fixed
per *"The port preserves behaviour; one exception is authorised and everything else stops the
child"* (`docs/DECISIONS.md`, 2026-08-25).

**The defect.** `harness/harness.yaml:11` and `spike/templates/harness/harness.yaml:11` both carry
the commented example

    # retry: { attempts: 5, base_delay_ms: 5000 }   # transient network/5xx only; never auth or model errors

while `withRetry` destructures `{ attempts = 5, baseDelayMs = 5000, maxDelayMs = 60000 }`
(`spike/src/adapters/index.js:68`). `attempts` is honoured. **`base_delay_ms` is not read by
anything** — the key the code wants is `baseDelayMs`, and `maxDelayMs` is not documented at all.

**Why it is worse than a typo.** The failure is silent and self-concealing. An adopter who
uncomments the line gets exactly the behaviour they asked for, because the ignored value and the
default are both 5000. Any *other* value they write is discarded without a word, and the first
evidence is a retry storm or a run that gives up too early against a flaky connection — the
failure `withRetry` was written for in the first place. This is a shipped asset: `harness init`
copies the template into every adopter's repo, so it reaches the cold-clone path.

**Three shapes, none decided here.**

1. **Correct the templates to `baseDelayMs`.** Smallest diff, and it edits a shipped asset — every
   existing adopter's copy stays wrong, and nothing tells them.
2. **Accept snake_case in the code**, mapping `base_delay_ms` → `baseDelayMs` at the config
   boundary. Honours what the documentation has been promising, and introduces a second spelling
   the codebase then has to keep supporting.
3. **Validate the config and refuse an unknown key**, which is where the ownership rule points —
   *"Unknown keys are refused where Quorum owns the key set"* (`docs/DECISIONS.md`, 2026-08-25).
   `adapters.<vendor>.retry` is Quorum's key set entirely: nobody could reasonably put
   `base_delay_ms` there on purpose. This is the largest change and the only one that stops the
   next instance of the same class.

**A dependency worth knowing.** Q-0043 shipped `projectConfigSchema` in `packages/shared`
(`packages/shared/src/project.ts`), declared and **called nowhere**, because validating a config
that today accepts anything is a behaviour change the port did not authorise. Its doc comment
already names this mismatch. Option 3 is that schema being called for the first time, so this
ticket is where the decision *"validated nowhere"* gets revisited — deliberately, with an entry,
rather than by someone noticing an unused export.

**Scope.** `spike/src` is frozen for the port (`harness/port-charter.md` §3). The code half lands
against `packages/core` after Q-0046 (`core/adapters` — the contract layer and the mock adapter);
the template half (`spike/templates/harness/harness.yaml` and this repo's own `harness/harness.yaml`)
is not frozen and could move earlier. Belongs to M2 in `docs/06-development-plan.md`.

---

## Re-derived 2026-08-31, by hand, before the requirements run

Everything above was written 2026-08-26 and was measured again today. **The defect is unchanged
and both line references still hold**: `harness/harness.yaml:11` and
`spike/templates/harness/harness.yaml:11` carry the commented example byte for byte, and
`spike/src/adapters/index.js:68` still destructures `{ attempts = 5, baseDelayMs = 5000,
maxDelayMs = 60000 }`. Four things below are new or were never stated, and the last two change what
a shape costs. Re-derive nothing from the 2026-08-26 text where the two disagree.

**The code half is two trees now, not one.** Q-0046 landed, so the ported twin is
`packages/core/src/adapters/adapters.ts` — `RetryPolicy` at `:196–200`, `withRetry` at `:343–345`,
the delay arithmetic at `:385`, and `getAdapter`'s `withRetry(factory(cfg), cfg.retry)` at `:275`,
against the spike's `:31`, `:68` and `:108`. The config path is identical in both: `getAdapter`
takes the whole `adapters` map, selects `config[name] ?? {}`, and passes `cfg.retry` straight
through, so an uncommented example line is honoured for `attempts` and discarded for
`base_delay_ms` in each tree independently.

**The freeze moved, and it now constrains two of the three shapes.** `freeze-sha` was recorded on
2026-08-30 at `7b6bc70` (`harness/port-charter.md`, the machine-readable block), and Q-0009 closed
2026-08-31 with all fourteen children contained. Q-0058 is not in `children:`, so the branch-scope
job reports this branch **out of scope** rather than passing silently — the Q-0038 and Q-0057
precedent — but the **freeze-SHA half is active**, and it asks about `main` rather than about a
branch, which no commit trailer can answer. So a `spike/src/adapters/index.js` edit landing on
`main` fails that job unless the same commit mirrors the change into `packages/core` and
re-records the SHA, which is charter §3's own numbered answer and the Q-0057 / Q-0080 shape.
Shape 1 is untouched by this: `spike/templates/` is not `spike/src/`. Shapes 2 and 3 land in both
trees together, like Q-0066, Q-0068 and Q-0070.

**Measured: `base_delay_ms` is the only key spelling in either shipped `harness.yaml` that nothing
reads.** Every other key in the file is read with exactly the spelling the file writes —
`backlog.path` (`spike/bin/harness.js:59`), `adapters.<v>.bin` and `extraArgs`
(`claude.js:28`, `codex.js:48`), `repo.base_branch` (`engine.js:57`), `repo.max_diff_bytes`
(`engine.js:928`, `core/src/engine/diff.ts:314`), `commands.timeout_ms` (`engine.js:529`,
`core/src/engine/steps.ts:78`), `commands.install` and `commands.test` (`engine.js:1128–1131`,
`core/src/engine/composite.ts:285–291`). Three keys are typed and enforced by nothing —
`budget.per_run_usd`, `budget.per_ticket_usd`, `backlog.layout` — but that is a different class:
an unread **value**, which `packages/shared/src/project.ts:22–24` already states, against an unread
**spelling**, which nothing states anywhere a reader of the config would look. And `maxDelayMs` is
documented in no file at all: a grep across `docs/`, `harness/` and `spike/templates/` returns
nothing, so the third field of a policy an adopter is invited to write is undiscoverable except by
reading the implementation.

**The convention census, which the three shapes need and the body above does not have.** Multi-word
keys in the shipped file run **five snake_case to one camelCase**: `base_branch`, `max_diff_bytes`,
`per_run_usd`, `per_ticket_usd` and `timeout_ms` against `extraArgs` alone. So the commented example
is consistent with the file's dominant convention and inconsistent with the code, which is the
reverse of what "correct the templates" assumes — shape 1 makes the retry block match the code and
mismatch its five neighbours. That also exposes a **fourth shape the body does not list**: rename
the code's two fields to `base_delay_ms` and `max_delay_ms` at the config boundary, leaving one
convention in the file and one mapping site in the code. Whichever way this goes, the useful output
is a **stated convention for `harness.yaml`**, because a fix that only corrects this key leaves the
next key to repeat it.

**Shape 3's exact surface, and the two pins that would have to move.** `retryPolicySchema` is
module-private at `packages/shared/src/project.ts:36–40` and `projectConfigSchema` at `:56` is
called by **no production file in either tree** — measured, the only callers are
`packages/shared/src/project.test.ts`. Two source-text pins forbid the call arriving in
`loadProject`: `packages/core/src/backlog/backlog.source.test.ts:115` and
`packages/shared/src/project.test.ts:111`, each asserting `.parse(` and `.safeParse(` are absent
from `packages/core/src/backlog/project.ts`. Q-0080's requirements run already refused to drag that
pin in as a side effect of another ticket, so if shape 3 is chosen the pin change is a named
criterion with its own argument, not a consequence. Two further facts belong to that decision.
First, the ownership rule has **both** halves inside this one file: the top level is the adopter's
and stays loose per *"Unknown keys are refused where Quorum owns the key set, and preserved where it
does not"* (2026-08-25), while `adapters.<vendor>.retry` is Quorum's entirely — so a
`z.strictObject` on `retryPolicySchema` **alone** is the narrowest form of shape 3, and the body
above does not say so. Second, `project.test.ts:46` and `:134` already parse this repository's real
`harness/harness.yaml` through the schema, so a strict retry policy acquires a subject the moment
anyone uncomments the line, and has none while it stays commented — which is the shape of every
guard this project has had to fix twice.

**Two neighbours, neither of them this ticket's work.** `harness/port-charter.md` §10 and its
"Until then" block propose **Q-0058** as the id for the cutover follow-up; that id is this ticket,
opened 2026-08-26, and the cutover is still unopened. The charter is reached from
`harness/architecture.md`, which `chore.yaml` injects, so the stale pointer is in a document this
ticket's own implement step will read. And `git branch --list 'harness/*'` is **empty** in this
repository today, so charter §8's first item is live: `harness/Q-0058/integration` does not exist
and must be created by hand before the chore run, not before this one.
