---
id: Q-0046
title: core/adapters — the contract layer and the mock adapter
stage: reviewed
owner: ruud
repos: []
branch: harness/Q-0046/integration
priority: p2
created: 2026-08-25
iterations:
  chore.review: 1
history:
  - stage: requirements
    run: 1
    flow: requirements
    status: completed
    stage_before: draft
    stage_after: requirements
    at: 2026-08-26T19:27:55.707Z
    cost: 7.733
  - stage: reviewed
    run: 2
    flow: chore
    status: completed
    stage_before: requirements
    stage_after: reviewed
    at: 2026-08-26T20:06:04.559Z
    cost: 21.61
---
Ports the vendor-independent half of `spike/src/adapters/` to `packages/core`: the `Adapter`
interface itself, `getAdapter`, `withRetry`, `transientError`, `authError`, `extractJson`,
`checkAgainstSchema`, `PROBE_SCHEMA`, `probeAdapter` (210 lines in `adapters/index.js`) and
`mockAdapter` (125 lines). The mock lands with the contract layer rather than with the vendors
because it is what every test and demo runs on — `04-architecture.md` keeps it in the package for
exactly that reason, and Q-0054 cannot port a suite without it. Belongs to M2 in
`docs/06-development-plan.md`; parent Q-0009.

**This is the file contributor adapters inherit.** `03-adapter-contract.md` is its specification, and
the 2026-08-22 decision put `authError` at the contract layer precisely so a Gemini adapter gets
actionable auth failures for free. Anything a third adapter would otherwise re-implement belongs
here, and the port is a chance to make that boundary explicit in types rather than by convention.

**Four properties that are not negotiable.**

- **No API-key path, ever, on any code path including tests and docs examples.** `check()` refuses if
  `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` or `CODEX_API_KEY` is set. BYOS is a product boundary, not a
  default.
- **`check()` proves presence; only `adapters --probe` proves login** (2026-08-22), and `check()`
  says out loud that logins are unverified. Q-0001's first real run failed seconds in on an expired
  Codex login that `check()` had reported ✓ minutes earlier, after the parallel Claude step had
  already been paid for.
- **Every schema Quorum sends a vendor lists every property in `required`.** OpenAI strict structured
  outputs reject anything else, and the resulting vendor error looks exactly like a broken login —
  which is how `adapters --probe` reported "login not usable" for codex while the login was fine.
  Q-0034 found it because the rule was written in a comment above `PROBE_SCHEMA` and nothing checked
  it; `spike/test/q0034-probe-schema.js` is the check, and it covers `schemaFor` too.
- **`checkAgainstSchema` is strict about Quorum's own schema; vendor-wrapping tolerance lives in
  `extractJson`.** The 2026-08-22 decision separates them by name, because accepting
  `verdict: "approve"` alongside a list of blockers is not tolerance — it is a routing bug that
  advances a ticket on a verdict its own findings contradict.

**Failures arrive on stdout.** Both vendors report failures on stdout rather than stderr, Claude
inside the JSON envelope and able to set `is_error` while exiting 0. Reading stderr alone printed
`exited 1:` and nothing, which is what made M0's model problem invisible for an hour. The retry
wrapper's classification of transient versus terminal depends on reading the right stream.

## Port charter

The charter is `harness/port-charter.md`; §6's register is normative for everything below and this
body cites it rather than restating it — where the two ever differ, the register is right.

Route: **chore** (`requirements → chore → human gate`), per *"The port takes the chore route,
except the one child that has new behaviour"* (`docs/DECISIONS.md`, 2026-08-25). Behaviour is
preserved per *"The port preserves behaviour; one exception is authorised and everything else
stops the child"* (`docs/DECISIONS.md`, 2026-08-25) — a defect found while reading the spike is
reported, never fixed in passing.

- **Ports:** `adapters/index.js` — contract layer, `checkAgainstSchema`, `extractJson`, `authError`, mock
- **Lifts from `spike/bin/harness.js`:** nothing
- **Depends on:** Q-0041 · **Depended on by:** Q-0047
- **Invariants inherited:** register rows 1, 13, 21, 22 (charter §2)
- **Non-goals:** another child's module; editing `spike/**` (charter §3); fixing a defect found
  while reading (§2); the cutover; the `quorum` binary (Q-0010); persisting the event stream;
  anything on v1's exclusion list.
