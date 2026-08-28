# The test command defeats its own cache, in configuration and not in the engine — 2026-08-27

**Decision:** `harness/harness.yaml`'s `commands.test` ends `pnpm turbo run test --force`. The
repository defeats its runner's cache in the file a user reads, and `core` learns nothing about any
runner: an `integrate` step still executes the configured string as written. `turbo.json`'s `test`
task declares `"env": ["QUORUM_REAL_CLI"]` — `env` rather than `passThroughEnv`, because selecting
paid probes must move the task's cache identity. The shipped template keeps `npm test` and gains a
comment telling an adopter that `integrate` trusts an exit result and that a caching runner can
satisfy it from a replay.

**Alternatives considered:** (2) Have `integrate` parse the runner's output for a cache-hit signal
and fail closed — more general, and it puts one tool's output format inside the engine, where a
vendor's dialect must never live. (3) Set `TURBO_FORCE=1` in the environment `integrate` runs its
command with — leaves the configured command honest-looking while the engine still knows one
specific tool's name, and it is invisible in the file the user reads. Both are refused by the
no-coupling rule, which now has a test.

**Why:** `integrate` makes the only claim worth making about a chore — *this suite is green on the
merged result* — and a replay satisfies it without executing anything. That is *"skipped is not
passed"* (2026-08-25) one layer down, and it has already cost once: a cached 7/7 stood over a suite
whose forced re-run failed 1 of 123 (Q-0043, 2026-08-26).

**Corrects the requirement that produced it.** Q-0065's merged requirement, §0.1, concluded that a
worktree has no turbo cache and that `integrate` was therefore running cold. The observation was
right and the inference was not: turbo 2.10 resolves a git worktree's cache to the **main
checkout's** — `Using shared worktree cache at: …/quorum/.turbo/cache`, `is_shared_worktree=true` —
and the first `pnpm turbo run test` ever run in a freshly created worktree reports `7 successful,
7 cached` in 19 ms. `integrate` has been running warm on every chore ticket in this repository.
Worse than "sometimes replays": turbo's key is a per-package content hash, so a ticket touching only
`harness/` and `docs/` replays **all seven** packages and executes nothing at all.

**The run that shipped this demonstrated it on itself.** Q-0065's own `integrate` ran 13:44:04 →
13:44:39 — thirty-five seconds for a base sync, a merge, both dependency installs, the spike suite
*and* the workspace suite, when a cold forced workspace run alone measures 24.6–30.1 s. It wrote
`tests=ok` from a substantial replay, under the ticket that removes the possibility. It could not
have done otherwise: `runFlow` stores `config` at run start (`spike/src/engine.js:37,43`) and the
integrate step reads `ctx.config.commands?.test` (`:1031`), never re-reading it from the integration
worktree, so a changed `commands.test` on the implement branch cannot take effect for its own run.
That is why AC-3 is a file assertion, and why this entry's runtime evidence is the *next* ticket's
`integrate` line.

**Cost accepted:** every `integrate` now spends **25–30 s** on the workspace suite it previously
replayed in 9 ms (measured, four cached and three forced samples, 2026-08-27). That is the price of
the claim being true. The spike half is unaffected — `node test/run.js` caches nothing.

**Not decided here:** CI restores `.turbo` between runs (`.github/workflows/ci.yml:20–24`,
`restore-keys: turbo-${{ runner.os }}-`) and its `pnpm test` carries no `--force`, so a CI job can
also report green from a replay. Outside Q-0065's scope, and named so it is not mistaken for having
been considered and kept. Carried by **Q-0071**.

**Found by:** Q-0064's requirements run (OQ-2), which correctly refused to change a default
affecting every ticket's `integrate`; the environment half at Q-0047's gate; the shared-worktree
cache by Q-0065's implement step, re-measuring what its own requirement had inferred — the third
time in two days that re-deriving an inherited measurement changed what a record would have said.
