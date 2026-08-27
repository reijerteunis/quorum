---
id: Q-0067
title: The per-adapter version probe, and what an unsupported CLI version does
stage: draft
owner: ruud
repos: []
branch: harness/Q-0067/integration
priority: p3
created: 2026-08-27
iterations: {}
history: []
---
Opened at Q-0047's requirements gate, 2026-08-27, as the deferred half of one sentence in
`docs/04-architecture.md:62`: *"Adapter behaviour that is CLI-version-specific (flag names, JSONL
fields) lives in a per-adapter `capabilities.ts` **with a version probe**, so a CLI update breaks one
file."* Q-0047 ships the capabilities modules and **not** the probe, and the split is the whole
reason this ticket exists.

**Why the sentence is two changes, not one.** Moving flag names and JSONL field names out of
`claude.ts` and `codex.ts` into per-adapter data modules is internal file layout, which
`harness/port-charter.md` §2 explicitly does *not* preserve — Q-0047 proves the extraction is
faithful by asserting the resulting argv is byte-identical to the spike's, element for element.
A version probe is not that. It adds a CLI invocation, a supported-version range that goes stale on
its own, and a policy for what happens when the installed version is outside it. All of that is
behaviour, and *"The port preserves behaviour"* (`docs/DECISIONS.md`, 2026-08-25) routes behaviour
through a decision entry accepted **before** implementation. Deferring needed no authority; adding
it did.

**The ticket is the policy, not the plumbing.** The plumbing is nearly free — `check()` already runs
`--version` on both adapters and returns the trimmed stdout, and Q-0047's capabilities modules carry
the version-probe argv as inert data precisely so this is a small ticket rather than a re-cut. What
has to be decided is everything after the version string is in hand:

1. **Where does the supported range live**, and what stops it going stale in an offline, local-first
   tool? A pinned range in the capabilities module is a maintenance liability of exactly the kind the
   2026-08-22 decision refused for a Codex rate table — *"the table is wrong the moment a vendor
   changes pricing and nothing in an offline tool would notice"*.
2. **What does an unknown or unsupported version do?** Warn, refuse, or record? On which surface —
   `check()`, which is cheap and runs behind `board`, `run` and `lint`; `adapters --probe`, which is
   explicit and paid; or a run's preflight? A refusal on `check()` breaks a cold-clone adopter whose
   CLI is one release ahead of a pin we wrote months earlier, which is the failure the whole
   no-pinned-model decision exists to prevent, arriving by another route.
3. **Does anything actually branch on the version**, or is the probe only ever reported? Nothing does
   today. A probe whose answer changes no behaviour is a diagnostic, and diagnostics belong to
   `adapters --probe` rather than to every command.

**Evidence that the staleness is real and already here.** `docs/03-adapter-contract.md:122` pins its
verification table to *"Claude Code 2.1.220 and codex-cli 0.149.0"* and `:136` describes the codex
JSONL *"as observed on 0.149.0"*. The machine probed on 2026-08-27 runs **2.1.231** and **0.149.1**.
Nothing noticed, nothing broke, and nothing would have told anyone if something had. That is both the
argument for a probe and the argument for being careful what it does when it disagrees.

**Runs after Q-0010**, which gives it a surface to report on: `adapters --probe` is the natural home
for a version verdict and the command does not exist in `packages/cli` yet. Ordering it earlier means
designing the report before there is anything to print it.

**Non-goals.** Q-0047's extraction, which lands first and is what this builds on; pinning any vendor
*model* name, which stays forbidden (2026-08-22); a compatibility shim that keeps an old CLI working
by branching capability sets — that is a much larger ticket and needs its own case; and the CLI's
rendering and exit codes beyond whatever Q-0010 establishes. Belongs to M2 in
`docs/06-development-plan.md`.
