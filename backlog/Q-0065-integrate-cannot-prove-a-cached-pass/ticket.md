---
id: Q-0065
title: integrate can report tests=ok from a cached pass it never executed
stage: draft
owner: ruud
repos: []
branch: harness/Q-0065/integration
priority: p2
created: 2026-08-26
iterations: {}
history: []
---
Raised as OQ-2 of Q-0064's merged requirement, 2026-08-26, which correctly refused to fix it in
passing: changing the configured test command affects **every ticket's** `integrate` step, and that
is precisely the unrequested default a chore must not take.

**The defect.** `harness/harness.yaml`'s `commands.test` is

    npm test --prefix spike && pnpm turbo run test

and Turbo, without `--force`, replays a cached result. It prints each package's full pass output and
reports `Tasks: 7 successful` with `Cached: 7 cached`, having executed nothing. `integrate` reads the
exit code, writes `tests=ok` to `runs.log` and `Tests: … → exit 0 (expected pass) → OK` to
`dev/integration.md`, and the flow advances on a claim nothing verified in this run.

**It is not hypothetical and the cost is already on the record.** Verifying Q-0043's merge to `main`
on 2026-08-26, the first `pnpm turbo run test` reported 7/7 successful with 7 cached. The immediate
`--force` re-run failed 1 of 123 — `git.test.ts`'s containment snapshot, now carried by Q-0064. The
cache had been reporting a pass over a suite with a live flake in it.

**Why this is the product's own rule turned on itself.** *"Skipped is not passed"*
(`docs/DECISIONS.md`, 2026-08-25) was written after a `--dry` run printed a clean preview for a range
it had deliberately not examined, and the real run then billed $13.86 before discovering the range
was invalid. This is the same failure one layer down: **the one step whose entire job is to prove a
suite green can be satisfied by a replay.** `integrate` exists because `expect: pass` on the real test
command is *"the only claim worth making about a scaffold, and it is a genuine one"* (the chore-flow
entry, 2026-08-24) — and for a cached run it is not.

**Three shapes, none decided here.**

1. **Add `--force` to `commands.test`.** One line, and it makes every `integrate` honest. It also
   discards the cache for every run, so `integrate` gets slower by however long the workspace suite
   takes — which is the price of the claim being true. The spike half needs no change; `node
   test/run.js` caches nothing.
2. **Leave the command and have `integrate` refuse a cached result** — parse the runner's output for
   a cache-hit signal and fail closed. More general, and it couples `core` to Turbo's output format,
   which is exactly the kind of vendor-shaped knowledge the rules keep out of the engine.
3. **Set `TURBO_FORCE=1` in the environment `integrate` runs its command with**, leaving the
   configured command alone. Keeps the honest behaviour where the engine can guarantee it, and still
   knows the name of one specific tool.

(1) is the smallest and the most legible in the file a user reads; (3) is the most robust. Deciding
between them is the ticket.

**Also in scope: the shipped template.** `spike/templates/harness/harness.yaml:31` ships
`test: npm test`, which `harness init` copies into every adopter's repo. Whatever this ticket
decides, an adopter whose test command is cached — Turbo, Nx, Gradle, Bazel all cache by default —
inherits the same silent replay, and the template's comment should say so even if the default cannot
know their runner.

**A neighbour this does not own.** `--force` is also missing from any human verification done by
hand; that is a habit, not a defect, and it is recorded in the session memory rather than here.

**Scope.** The config half is a one-line change to `harness/harness.yaml` and the shipped template,
neither of which is frozen. An engine-side refusal (shapes 2 and 3) touches the integrate step, which
`spike/src/engine.js` still owns and which the port hands to **Q-0053**; `spike/src` is frozen for
Q-0009's fifteen tickets and Q-0065 is not among them, so the spike route is open the same way it was
for Q-0063. Belongs to M2 in `docs/06-development-plan.md`.
