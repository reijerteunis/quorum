---
id: Q-0066
title: probeAdapter reports its own crash as an unusable login
stage: draft
owner: ruud
repos: []
branch: harness/Q-0066/integration
priority: p2
created: 2026-08-26
iterations: {}
history: []
---
Raised by Q-0046's merged requirement as OQ-6 and by its implement report, 2026-08-26, both of which
correctly refused to fix it in passing: the port preserves behaviour, and a quiet fix in `core` while
`spike` keeps the old behaviour leaves **both suites green over a product that disagrees with
itself** (*"The port preserves behaviour"*, `docs/DECISIONS.md`, 2026-08-25). It is preserved and
pinned in both trees — `spike/src/adapters/index.js:159` and
`packages/core/src/adapters/adapters.ts:483`, the latter carrying its `Why:` line and a test.

**The defect.** `withRetry` returns `usage: null` when no attempt reported a measure — deliberately,
added by Q-0034 so `rollup()` cannot invent a vendor row for a call nobody measured. `probeAdapter`
then dereferences it unguarded:

    cost_usd: res.usage.cost_usd ?? null, tokens: (res.usage.input_tokens ?? 0) + (res.usage.output_tokens ?? 0)

So an adapter whose login is **perfect**, and which simply reports no usage, returns
`{ok: false, error: "Cannot read properties of null (reading 'cost_usd')"}`. The CLI renders that as
`✗ login not usable: Cannot read properties of null…`.

**Why it matters more than its size suggests.** `adapters --probe` is the one command that exists to
de-risk a paid run — the 2026-08-22 decision separated it from `check()` precisely because
*"two green ticks followed by a vendor stack trace is the worst possible cold-clone experience"*, and
Q-0001's first real run died seconds in on a login `check()` had blessed, after the parallel Claude
step had been paid for. A probe that can blame a healthy login for its own `TypeError` is that
failure inverted: it does not skip its subject, it *examines* it, crashes inside its own reporting,
and attributes the crash to the subject. **A ✗ that can mean two unrelated things makes the command
another thing to distrust**, which is the whole reason it exists.

**Who can actually hit it.** No shipped adapter today: `mock` always reports usage, and `claude` and
`codex` report at least tokens. It is reachable by **a contributor's adapter** — a Gemini adapter
whose CLI reports nothing, or one that reports usage only on some paths — which is exactly the
audience `authError` was put at the contract layer for. It is also reachable by any adapter on a
vendor that stops reporting a measure.

**Three shapes, none decided here.**

1. **Guard the read** — `res.usage?.cost_usd ?? null` and the same for the two token measures. One
   line, and `ok: true` with `cost_usd: null` is already the shape the roll-up understands: *"a null
   cost is displayed as `n/a` beside its token count, never rounded to `$0.000`"* (2026-08-22). The
   risk is that `tokens: 0` then reads as a measured zero rather than an absence, which is the exact
   conflation that entry forbids — so `ProbeResult.tokens` probably has to become nullable with it,
   and that reaches the CLI's rendering.
2. **Report the absence explicitly** — `ok: true` with a stated "vendor reported no usage" alongside
   the round-trip, so the probe distinguishes *answered and unmeasured* from *answered and measured*.
   Truthful, and it adds a third state to a command whose output two callers already read.
3. **Fail closed with an honest cause** — keep `ok: false` but say *the adapter answered; it reported
   no usage*, never the `TypeError`. Weakest, since a login that works should not probe red.

(1) is smallest; (2) is the one that matches what the roll-up already does with an unpriced vendor.
Deciding between them, and what `tokens` means when nothing was measured, is the ticket.

**Both trees, and the order matters.** The fix belongs in `spike/src/adapters/index.js` **and**
`packages/core/src/adapters/adapters.ts`, and it must land in both or the port loses its only
independent witness — that is the whole argument of the entry that deferred it. Q-0046's AC-11 test
pins today's behaviour in `core` and `spike/test/smoke.js:150` exercises the probe, so whichever
route this takes will turn a pinned test red **on purpose**; the ticket updates that pin rather than
deleting it. `spike/src` is frozen for Q-0009's fifteen children and Q-0066 is not among them, so the
spike route is open the same way it was for Q-0063 and Q-0065.

**Non-goals.** `check()` and its API-key refusal (Q-0047 owns the assertion, per Q-0046's erratum
E-1); the `adapters --probe` CLI command's presence loop, `--json` report and exit codes, which stay
in the CLI until Q-0010; `withRetry`'s `usage: null`, which is correct and is Q-0034's deliberate
fix. Belongs to M2 in `docs/06-development-plan.md`.
