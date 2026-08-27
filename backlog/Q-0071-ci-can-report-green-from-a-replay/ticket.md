---
id: Q-0071
title: CI can report green from a replay, and its cache outlives the commit it was built for
stage: draft
owner: ruud
repos: []
branch: harness/Q-0071/integration
priority: p2
created: 2026-08-27
iterations: {}
history: []
---
Reported by Q-0065's implement step, 2026-08-27, which correctly declined to fix it: no criterion of
that ticket named `.github/`, and changing CI's caching is the unrequested default a chore must not
take. Left as a neighbour there and named in *"The test command defeats its own cache, in
configuration and not in the engine"* (2026-08-27) so it could not be mistaken for having been
considered and kept.

**The defect.** `.github/workflows/ci.yml:20–24` restores Turbo's local cache across runs —

    - uses: actions/cache@v4
      with:
        path: .turbo
        key: turbo-${{ runner.os }}-${{ github.sha }}
        restore-keys: turbo-${{ runner.os }}-

— and `:27` runs `pnpm test`, which is `turbo run test` with **no `--force`**. A job can therefore
report every package green having executed nothing. The `restore-keys` prefix is what makes it
routine rather than rare: an exact-SHA miss falls back to *any* previous `turbo-macOS-` entry, so
the cache a job reads was usually built for a different commit.

**This is the same defect Q-0065 fixed one layer up, and the fix there does not reach here.**
Q-0065 appended `--force` to `harness/harness.yaml`'s `commands.test`, which is what `integrate`
runs. CI does not read `harness.yaml`; it runs `pnpm test` from `package.json`. The two paths are
independent and only one of them has been closed.

**Why it is not simply "that is what a cache is for".** For an unchanged package, replaying is the
whole point and this ticket should not remove it. The question is what a **green tick is being
claimed for**. At `integrate` the claim is *this merged tree is green* and a gate is about to be
answered on it. On a pull request the claim is *this commit is green*, and a replay keyed on a
different commit's content hash does not make it. Deciding where that line sits is the ticket —
not reflexively adding `--force` everywhere, which would throw away the cache's real value on
untouched packages and lengthen every push.

**It has already hidden something.** Q-0043's flake — `git.test.ts`'s containment snapshot going red
under git's background maintenance, now Q-0061, absorbed into Q-0064 — survived behind a cached pass
and surfaced only when a `--force` re-run failed 1 of 123 on 2026-08-26. A flaky test behind a cache
reports its last mood.

**Shapes, none decided here.** Force the cache off for `test` on CI while leaving `lint` and
`typecheck` cached (cheapest, and it is the task whose tick is load-bearing). Narrow the cache key so
`restore-keys` cannot serve another commit's entry (keeps the speed, removes the cross-commit
fallback, and turbo's own per-package hashing may already make this redundant — check before
building it). Keep the cache and make the *required* check a separate forced job (honest and slower,
and it doubles the workflow). Consider also whether `turbo.json`'s `test` task should declare
`inputs`, since the default input set is what decides when a hash legitimately changes.

**Also in scope: state what the CI badge claims.** Whatever is decided, a reader of a green tick
should be able to tell what it examined — the same rule the repository applies to a preflight and to
`--dry` (*"skipped is not passed"*, 2026-08-25).

**Neighbour it does not own.** Whether `integrate` should also run `lint` and `typecheck` — Q-0065's
DECISIONS entry notes that `commands.test` gates neither, so the deprecation rule Q-0069 added is
enforced by CI alone. That is its own question.

Belongs to M2 in `docs/06-development-plan.md`.
