---
id: Q-0084
title: The git-identity sweep cannot run in a linked worktree
stage: abandoned
owner: ruud
repos: []
branch: harness/Q-0084/integration
priority: p2
created: 2026-08-31
iterations: {}
history: []
---
git-identity-sweep.sh points GIT_CONFIG_GLOBAL at ${repo_root}/.git/sweep-gitconfig-absent, which cannot exist in a linked worktree because .git is a file there — so Q-0079's oracle is unrunnable in the one environment every chore implement step runs in.

**WITHDRAWN 2026-08-31, the same day it was opened — the defect was fixed by hand at Q-0058's close
rather than run through the flows, and this ticket never ran.** The body below is kept as the
evidence and as the record of why it was opened at all; it is not a description of open work.

**What changed the routing.** This ticket was opened on the reasoning in its "what the fix has to be
argued against" paragraph — that the obvious repair moves the absent config file out of the tree the
sweep isolates, which is a property Q-0079's measured table was built around, so it wanted
re-measuring rather than a substitution. Re-reading `git-identity-sweep.sh`'s own header answered
that: *"The probe below is the oracle, so this is a question of what the environment achieves and
not of how it is spelled: if any of this stops neutralising identity, the negative probe resolves and
the run stops there."* Only the file's **absence** is load-bearing; nothing reads it and nothing
creates it, so which directory holds it is not a property any guarantee rests on, and no row of that
table depends on it. The caution below was mine and was unfounded — recorded rather than deleted,
because a ticket opened on a worry the existing documentation already answers is worth being able to
see.

**What shipped.** `GIT_CONFIG_GLOBAL` now names
`git rev-parse --path-format=absolute --git-common-dir` — the one real shared `.git` directory,
identical from the main checkout and from every worktree — with the reasoning in the script's header
beside Q-0079's. `rm -f` stays, because it is what turns "the parent is not a directory" into a stop
rather than a permissive environment. Demonstrated red before green from the linked worktree, and
re-run on `main`: both exit 0, both printing the script's own *"environment discriminates"* line.

---

Found by Q-0058's chore implement step on 2026-08-31, reported and not fixed — correctly, because
no criterion of that ticket names `.github/` and changing an enforcement script's isolation
mechanism is a decision rather than machinery. Reproduced by hand at Q-0058's gate before the
ticket was opened, rather than taken from the report.

**The defect.** `.github/scripts/git-identity-sweep.sh:69` sets

    export GIT_CONFIG_GLOBAL="${repo_root}/.git/sweep-gitconfig-absent"
    rm -f "${GIT_CONFIG_GLOBAL}" || fail "cannot ensure ${GIT_CONFIG_GLOBAL} is absent"

In a **linked worktree** `.git` is a *file* holding `gitdir: …`, not a directory, so that path can
never exist and `rm -f` fails with `Not a directory`. The sweep dies in its `isolation` phase before
either suite runs:

    ::error::git-identity sweep failed in phase 'isolation': cannot ensure
      …/harness__Q-0058__implement/.git/sweep-gitconfig-absent is absent

Measured both ways at Q-0058's gate: `rm -f "$(git rev-parse --show-toplevel)/.git/sweep-gitconfig-absent"`
returns `Not a directory` inside `.harness/worktrees/harness__Q-0058__integration` and exits 0 in the
main checkout.

**Why it matters more than the line suggests.** Every `chore.yaml` implement step runs in a linked
worktree (`spike/src/engine.js`, `ensureWorktree`), so Q-0079's **oracle** is unrunnable in exactly
the environment the flow puts an implementer in. Its tripwire half,
`packages/core/src/git-identity.test.ts`, is inside the ordinary suite and does run — but that half
sees **literals only** and says so in its own header, so it is not coverage for the checkout-shaped
instances the sweep exists to catch. An implementer asked to verify its branch can therefore only
report the sweep as *skipped*, which is what Q-0058's did.

**It fails loudly rather than passing vacuously, and that is the one good thing here.** Q-0079's
design decision — the environment proves itself before it certifies anything, and a permissive sweep
must never be green over everything — is why this surfaced as a hard stop instead of a green tick
over an isolation that was never established. The ticket is about *reach*, not about a false pass.

**What the fix has to be argued against.** Q-0079's own header carries a measured table of what does
and does not neutralise a git identity, and the obvious repair — point `GIT_CONFIG_GLOBAL` at a path
under `$TMPDIR`, or at `git rev-parse --git-common-dir` rather than `${repo_root}/.git` — moves the
file out of the tree the sweep is isolating, which is a property that table was built around. So it
wants re-measuring rather than a one-line substitution: whichever path is chosen, the negative probe
(`git var GIT_COMMITTER_IDENT` must fail) and the positive probe must both still discriminate, and
the four cells of Q-0079's matrix must still be reachable. The check that the fix is real is that the
sweep runs to completion **in a linked worktree** and still fails when identity is restored.

**Neighbour, not this ticket's subject.** `pnpm sweep:git-identity` is byte-identically what CI runs,
deliberately (Q-0079), and CI checks out a normal clone — so CI has never been affected and this has
never made a required check lie. That is why it is p2 rather than p1.

**Scope.** `.github/scripts/git-identity-sweep.sh`, and whatever of Q-0079's measured table the fix
moves. One tree — the script is not in `spike/` or `packages/`. Belongs to M2 in
`docs/06-development-plan.md`.
