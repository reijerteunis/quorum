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

**Two obligations inherited from Q-0046, which its requirement must carry as criteria.** Q-0046
landed on 2026-08-26 and handed both forward explicitly; a requirement that omits either closes
nothing while appearing to.

- **Register row 1 is split, and this ticket owns the half that has no test.**
  `backlog/Q-0046-core-adapter-contract-and-mock/requirements/errata.md` E-1 re-points the row:
  Q-0046 discharged only what it could write (nothing in `core/adapters` calls `check()`), because
  the refusal itself lives in `claude.js:12` and `codex.js:21` — this ticket's files. **A criterion
  must assert that the refusal fires *before* the `--version` probe, over all three variable names,
  and that it still fires when the configured executable is missing.** Charter §2 says why the last
  two clauses are not padding: *"a rewrite that probes first and refuses second passes every test
  that checks only the refusal."*
- **The registry must regain its two entries.** Q-0046 shipped `getAdapter` with `mock` alone
  (its AC-3), so `getAdapter('claude')` throws `unknown adapter "claude" (known: mock)` in `core`
  today while the spike answers it. The message *format* is already pinned there; the *membership*
  is deliberately not, and restoring it is this ticket's.

**One wording finding is already reported and unfixed**, from Q-0046's implement report:
`claude.js:12`, `codex.js:21` and the fixture at `spike/test/smoke.js:465` call the product
*"Harness"*, which `.claude/rules/product-boundaries.md` forbids — "Harness" is the concept and the
folder, never the product. The two adapter files are this ticket's, so it is the first ticket that
*may* fix it; charter §2 makes that a deliberate change needing an erratum or a decision entry
first, never a tidy-up in passing. `spike/test/smoke.js` is frozen either way.

## Port charter

The charter is `harness/port-charter.md`; §6's register is normative for everything below and this
body cites it rather than restating it — where the two ever differ, the register is right.

Route: **chore** (`requirements → chore → human gate`), per *"The port takes the chore route,
except the one child that has new behaviour"* (`docs/DECISIONS.md`, 2026-08-25). Behaviour is
preserved per *"The port preserves behaviour; one exception is authorised and everything else
stops the child"* (`docs/DECISIONS.md`, 2026-08-25) — a defect found while reading the spike is
reported, never fixed in passing.

- **Ports:** `adapters/claude.js`, `adapters/codex.js`, per-adapter `capabilities`
- **Lifts from `spike/bin/harness.js`:** `overrideAdapters` (:612)
- **Depends on:** Q-0041, Q-0046 · **Depended on by:** —
- **Invariants inherited:** register rows 2, 4, 22 (charter §2)
- **Non-goals:** another child's module; editing `spike/**` (charter §3); fixing a defect found
  while reading (§2); the cutover; the `quorum` binary (Q-0010); persisting the event stream;
  anything on v1's exclusion list.
