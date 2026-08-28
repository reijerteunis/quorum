# A cache hit names what the task reads, not what its package contains — 2026-08-28

**Decision:** Each affected package declares its out-of-package reads as `inputs` in its **own**
`turbo.json` alongside `$TURBO_DEFAULT$`, and the root's three tasks each depend on their own kind
in a package's dependencies (`^lint`, `^typecheck`, `^test`). A package configuration declares
`inputs` and **nothing else**, because turbo merges a package config into the root definition per
key and root `turbo.json` must stay the one place `env` is decided — Q-0065's guard parses the root
file alone, so a package-level `env` override would put a decision where that guard cannot see it.
The root keeps its four `globalDependencies` unchanged.

**After this entry a cache hit means: no file this task reads, and no same-kind task in a package it
depends on, has changed since the cached successful result.** Before it, a hit meant only *nothing
inside this package has changed* — and the two are far apart here, because both real suites assert
over `docs/`, `harness/`, `spike/`, `contracts/`, `backlog/` and each other. CI's claim stays
different and stronger, because CI forces: its tick says these tasks *executed*.

**Verified at the gate on the merged result, not taken from the implementer's report.** In the
integrate worktree at `6a81b16`, three probes, each restoring its subject:

| edit | `@quorum/core#test` | `@quorum/shared#test` |
| --- | --- | --- |
| baseline | `071720c9…` | `b6b39f0e…` |
| one line into `docs/GLOSSARY.md` | moves → `b61c281c…` | moves → `c25accfa…` |
| one line into `packages/shared/src/constants.ts` | moves → `24cbb6a2…` | moves → `73be146a…` |
| **control** — `harness/port-charter.md`, read by nothing | **unchanged** | **unchanged** |

The control row is the one that matters: it is what distinguishes a precise declaration from a
blanket one, and shape (1) would have failed it.

**Alternatives considered.** (1) Put the shared corpus in `globalDependencies` — one place, zero
drift risk, and rejected because it invalidates all 21 task-package pairs on any `docs/` edit, in a
repository where `docs/` changes every ticket. (4) Relocate the cross-tree assertions into a task
whose inputs could cover them — rejected as a non-goal: it edits landed, reviewed tests in two
packages because a configuration file is awkward. **Root-level `inputs` rather than package
configs** — which is the shape the pre-run probe used, and it is wrong: root task `inputs` apply to
every package, so the five scaffolds would have gained `../../docs/**` too, and AC-2 requires them
unchanged at 5–6. **Comments in `turbo.json`** — turbo 2.10.11 accepts them, and they are refused
because `test-command.test.ts:37` reads that file with `JSON.parse` and a landed Q-0065 guard must
pass unchanged. **A real TypeScript parser for the drift guard** — strictly more precise, refused
because declaring `typescript` rewrites `pnpm-lock.yaml`, which CI installs `--frozen-lockfile`,
which `contracts.source.test.ts` asserts on, and which is a declared hashed input of the very task
under change.

**Two consequences of `dependsOn`, stated rather than discovered.** The graph gains ordering edges,
so `shared` completes before `core` and a forced run goes from one wave to two — measured at no cost
(27.2 s before, 26.7 s after), because `shared#test` is the 0.6-second task. And a failure in a
dependency now **skips** its dependents rather than reporting them, so a developer sees fewer
failures per run unless `--continue` is passed. `--filter @quorum/core` now also pulls
`@quorum/shared#test`, which moves the behaviour of the probe invocation Q-0065 AC-8 pins in
`real-cli.probe.test.ts`; that assertion is on the file's text, so it still passes.

**Cost accepted.** An unchanged local `pnpm test` still replays in 0.2 s — that is the point, and it
is why this was not solved by forcing everywhere. A `docs/` edit goes from 0.2 s to ~27 s and a
`packages/shared/src` edit from 0.7 s to ~28 s, both of which previously bought a green tick over
work nothing had examined. CI is unchanged.

**Why: three things this ticket found that outlive it.**

**1. A clause written after a lesson can still miss it.** The cross-vendor panel returned a major on
each of four rounds — quoted-literal scanning, import aliases, root-derivation primitives, and then
the read-API anchor's own failure to resolve aliases. Every one was correct and every one was
different, which is the loop working. The fourth is the instructive one: clause C1 learnt in round 2
to resolve names through each file's import bindings, and clause C4 — written **two rounds later**
by the same process — matched raw names. The remedy was not a fifth list but a shared decomposition,
so the syntax question is answered in one place and cannot be answered two ways. This is
Q-0034's *"review the fix round, not only the feature round"* arriving inside a single ticket.

**2. A review loop cannot decide when a guard is finished, and must be told.** No textual scanner
has zero bypasses, so a reviewer asked whether one can be evaded will always be able to say yes, at
$10–30 a round. Two errata settle it: **E-1** bounds AC-7's absolute wording by AC-11's dependency
ban, anchors the check on filesystem read APIs rather than on root-derivation primitives — the set
of ways to compute a string is not enumerable, the set of ways to read a file is — and rules that an
unenumerated route named *without a demonstration* is a nit. **E-2** closes the clause on binding
parity and names the closed classes, so a further finding blocks only if it demonstrates a bypass
outside them. What makes a residual gap acceptable is that it is **registered and stated** rather
than silent, which is this ticket's own subject arriving inside the instrument built to enforce it.

**3. The gates that matter were the only places the last defect could not appear** — and this is the
finding worth the most. The merged, reviewed, `integrate`-green change **failed on `main`**. Clause B
refuses a directory-shaped literal that no walk covers, but only sees a literal as a directory when
the directory **exists**; `.harness/worktrees` and `.quorum/runs` are product path constants that
`constants.test.ts` asserts on and no suite opens, and `git ls-files` reports zero tracked files
under either. So they exist on a developer's checkout and in **neither** a fresh `integrate` worktree
nor a fresh CI clone. Implement, integrate and CI all reported green while `main` was red for every
developer. That is **Q-0071's shape inverted**: there the gates were blind because they replayed a
cache, here because they run on clean checkouts — the one condition under which the check cannot
fire. It was caught only by re-running the forced suite on `main` after the merge rather than
trusting `integrate`'s tick, which is the same discipline as *"verify inherited measurements"*
applied to a tick instead of a number. The two instances are registered by hand in `NOT_READ` (the
mechanism's own answer for a path named but never opened, recorded as a post-review hand fix in the
ticket's `runs.log`); **the existence-dependence itself is not fixed and is Q-0073.** The guard was
re-demonstrated to have a subject after that edit — an undeclared read of `docs/README.md` fails 1
of 51, reverting restores 51 — because a green run is not evidence a guard still works.

**Not decided here:** the successors the requirement wrote out in full — **A**, an automated
temp-workspace fixture proving the escaping-input configuration through a real cache on CI's Linux
checkout, so an incompatible turbo upgrade fails visibly instead of silently restoring the old
meaning of a hit; and **B**, whether CI and a developer's `pnpm test` should be one command, which
reverses part of the 2026-08-27 entry and needs its own. Q-0072's AC-9 ships the guard that they
cannot diverge silently, which is the evidence B needs before it is opened.

**Cost.** **$95.78** in billed Claude — $6.05 requirements, $89.73 across five implement rounds
($27.70, $11.63, $29.63, $10.81, $9.96) — plus $2.21 on two probes and roughly 130M Codex tokens no
roll-up can price. The most expensive ticket this project has run, past Q-0033's $66.06, and
`budget.per_run_usd: 10` and `per_ticket_usd: 60` again stopped nothing. A note on the arithmetic:
the naive sum of `cost=` in `runs.log` reads **$101.83**, because run 1's `completed` line repeats
its own steps' total; `harness board` gets it right at $95.78.

**Found by:** Q-0071's requirements run, which drafted this ticket's body in full rather than
describing it, and correctly declined to fix it on a ticket whose subject was CI's tick.
