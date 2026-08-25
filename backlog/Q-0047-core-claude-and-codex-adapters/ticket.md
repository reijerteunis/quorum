---
id: Q-0047
title: core/adapters — claude and codex
stage: draft
owner: ruud
repos: []
branch: harness/Q-0047/integration
priority: p2
created: 2026-08-25
iterations: {}
history: []
---
Ports the two vendor adapters — `spike/src/adapters/claude.js` (83 lines, including the shared
`exec`) and `codex.js` (91 lines) — onto the contract layer Q-0046 types. These are the only files in
the port whose acceptance evidence cannot come from CI: subscription auth means the real-CLI check is
`quorum adapters --probe` run locally, per `04-architecture.md`'s testing strategy. Belongs to M2 in
`docs/06-development-plan.md`; parent Q-0009.

**Per-vendor behaviour to carry across, all of it from M0's findings.** `--ignore-user-config` on
every codex invocation, with `-m` passed only when a flow step names a model explicitly — the
machine's `~/.codex/config.toml` outranked the flow file until Q-0001, so a run's behaviour depended
on the developer's personal CLI config rather than the versioned flow. No vendor model name is pinned
anywhere; every alias the templates shipped was rejected on a ChatGPT subscription. A role's default
model is inherited only by steps running on that role's own adapter, never across vendors — a
`model: opus` leaked into a codex step once already. Claude's `usage.input_tokens` excludes cache
traffic and under-reported by three orders of magnitude, so the token accounting must be
cache-inclusive; cost was always right, tokens were fiction. Codex reports tokens and no cost, and
the 2026-08-22 decision forbids pricing them locally — cost stays `null` and the roll-up says so.

**One structural change the architecture asks for.** *"Adapter behaviour that is CLI-version-specific
(flag names, JSONL fields) lives in a per-adapter `capabilities.ts` with a version probe, so a CLI
update breaks one file."* Nothing in the spike does this today; the flags and JSONL field names are
inline. This is the one place in the port where the target design is deliberately not the spike's,
and the version probe is new work rather than translation — worth flagging at requirements, because
it is the difference between a port and a small feature.

**Evidence.** `docs/03-adapter-contract.md` has a verified column filled in during M0, flag by flag
and JSONL field by field. The port should be checkable against it, and any divergence found while
porting is a doc fix in the same change, per the docs rule.
