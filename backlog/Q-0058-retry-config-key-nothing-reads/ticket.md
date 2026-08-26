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
