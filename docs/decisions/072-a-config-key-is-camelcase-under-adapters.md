# A config key is camelCase under `adapters.<vendor>` and snake_case everywhere else — 2026-08-31

**Decision:** A key written in a `harness.yaml` file is **camelCase when it sits under
`adapters.<vendor>`** and **snake_case everywhere else**. The rule is not a style preference; it
follows the one mechanical fact that separates the two regions. `getAdapter` selects
`config[name] ?? {}` and hands that object through **unread** to the adapter factory and to
`withRetry` (`spike/src/adapters/index.js:31`, `packages/core/src/adapters/adapters.ts:275`), which
destructure it as JavaScript identifiers. Everything outside `adapters.<vendor>` is read key by key
by Quorum's own code, which chose snake_case. So inside that block a key **is** a JavaScript
property name; outside it, a key is Quorum's own vocabulary.

Measured over every multi-word key either tree reads from a config, the rule predicts ten spellings
out of ten, five each side, with no exception in either direction: `extraArgs`, `delayMs`,
`baseDelayMs` and `maxDelayMs` under `adapters.`, against `base_branch`, `max_diff_bytes`,
`timeout_ms`, `per_run_usd` and `per_ticket_usd` outside it. The single counterexample in the
repository was `base_delay_ms`, in a commented example in both shipped `harness.yaml` files — and it
was the one spelling **nothing read**, which is the defect Q-0058 exists for.

**The rule governs keys written in a file, and that clause is load-bearing rather than cautious.**
`adapterOverride` is a top-level camelCase key **both** engines read (`spike/src/engine.js:236`,
`packages/core/src/engine/steps.ts:161`), so a rule stated as *"every key outside `adapters.` is
snake_case"* is false on the day it lands. It is not a counterexample, because it has never existed
in a file: the CLI sets it on the already-loaded config from `--adapter`
(`spike/bin/harness.js:619`). A rule about a file format does not reach a value the CLI writes into
memory, and saying so here is cheaper than the next reader finding it and concluding the rule is
wrong.

**Alternatives considered:** **Canonical snake_case throughout, mapping to camelCase at the config
boundary** — the shape the ticket body called "the only shape that survives both", and the shape
Q-0058's codex candidate recommended. It cannot deliver one convention: renaming the retry policy's
two fields leaves `extraArgs` and `delayMs` camelCase in the same block, moving the seam *through*
the adapters subtree instead of around it. Delivering it fully means renaming `extraArgs`, a live
key an adopter may already have uncommented, and giving up the pass-through property — every key a
contributor's adapter invents would need a mapping entry in `packages/shared` before it could be
configured at all. **Accepting both spellings** at the boundary, for the same reason: a second
accepted spelling cannot be maintained for keys that do not exist yet. **Leaving the convention
unstated**, with the fix confined to the two misspelled examples. Rejected because the next person
to add a key re-derives it or guesses, which is how this one arrived; the rule costs two lines of
comment in a file adopters read.

**Why:** The defect this rule closes is self-concealing, which is what makes it worth a decision
rather than a correction. An adopter who uncommented `base_delay_ms: 5000` got exactly the behaviour
they asked for, because the discarded value and the default were both 5000; any other value was
discarded in silence, and the first evidence would have been a retry storm or a run that gave up
early — the failure `withRetry` was written for. `harness init` copies the template into every
adopter's repository, so it sat on the cold-clone path.

Stating the rule where the config is read, and enforcing it over both shipped files, is what makes
the next instance loud instead. It also answers a question nothing answered: a contributor adding a
Gemini adapter had four existing keys to reverse-engineer and no statement of what to call their
own.

This entry records the convention only. It deliberately does **not** decide that `harness.yaml` is
validated on a load path — `projectConfigSchema` stays *"declared and validated nowhere"* per
Q-0043 AC-11, and the reasons are in Q-0058's merged requirement: a strict retry schema would have
had **no subject** while the example stayed commented, whereas a guard that uncomments every example
before checking it has one now. That is *"A check is not established by reading it"* (2026-08-29)
choosing between two candidate guards. Validation on a load path remains open, and needs its own
entry when someone wants the behaviour.
