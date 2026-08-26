---
id: Q-0061
title: The containment writes-nothing test goes red under git maintenance
stage: abandoned
owner: ruud
repos: []
branch: harness/Q-0061/integration
priority: p2
created: 2026-08-26
iterations: {}
history: []
---
**Absorbed into Q-0064, 2026-08-26 — not fixed here and not dropped.** Q-0064 already moves
`packages/core/src/git.test.ts` and already rewrites `packages/core/test/corpus.ts`, and `walk`
lives beside `coreSourceFiles` in `packages/core/test/repo.ts`. Running this separately would touch
the same files twice for one outcome. Q-0064's body carries the fix and the trap in it; this body
stays as the evidence, which is why it is `abandoned` rather than deleted.

Reported by Q-0043's implement step as a defect in **Q-0042's** file, outside its own sanctioned
surface and therefore untouched, per *"The port preserves behaviour"* (`docs/DECISIONS.md`,
2026-08-25). Its report said it *"will go red for someone eventually"*. It went red within the hour,
on `main`, for the run that verified the merge.

**The defect.** `packages/core/src/git.test.ts:235`, in *"AC-4 — containment derives the board's
answer and never guesses an ahead count"* → *"deriving containment writes nothing, moves no ref and
leaves every file byte-identical"*, takes a before/after snapshot around a `containment()` call:

    const filesBefore = walk(dir);
    …
    expect(walk(dir)).toEqual(filesBefore);

`walk` is `fs.readdirSync(dir, { recursive: true })` with no exclusion
(`packages/core/test/repo.ts:71–72`), so **`.git/**` is inside the snapshot**. Any file git creates
in that window — `.git/objects/maintenance.lock` is the observed one — is a difference, and the
assertion fails. The test is asserting something true (`containment()` writes nothing) using an
instrument that also observes a second writer it does not control.

**Observed twice, independently.**

| When | Where | Result |
| --- | --- | --- |
| 2026-08-26, Q-0043's implement worktree | first run of the core suite | 1 failed / 123, `maintenance.lock` named as the cause; every subsequent run passed |
| 2026-08-26 ~08:32, `main` after the Q-0043 merge | `pnpm turbo run test --force` | 1 failed / 123, same test; immediate `--force` rerun 123 passed |

The second observation is the useful one: it is a **clean `main`**, and the only thing that changed
between red and green was time. Note also that the first `pnpm turbo run test` reported 7/7
successful with `Cached: 7 cached` — a replayed green that had executed nothing. The failure only
appeared under `--force`. A flaky test behind a cache is a test that reports whatever it reported
last.

**The fix, and the trap in it.** The implementer's recommendation is right and worth stating with
its reason: **filter git's own lock files out of the snapshot rather than widen the assertion.** The
criterion this test defends is a real one — Q-0036 exists because containment must derive from git
and store nothing, and register row 9 binds every later child to it. An assertion loosened to
"roughly the same files" stops defending it. Excluding `.git/**` entirely is also too broad: the
sibling assertion `expect(git(dir, 'for-each-ref')).toBe(refsBefore)` covers refs, but the file
snapshot is what would catch a cache file written under `.git/`, which is precisely the thing the
containment decision forbids. The narrow exclusion — git's transient lock files — keeps both.

**Worth checking for siblings.** `walk` is a shared helper and the before/after snapshot is the
house pattern for *"this writes nothing"*. Q-0043's AC-8 uses the same shape over the backlog root,
where there is no `.git` and so no exposure — but the next child that snapshots a directory
containing one inherits this. Fixing the helper's callers is cheap now and gets steadily less so.

**Scope.** `packages/core/src/git.test.ts` and possibly `packages/core/test/repo.ts`. Not blocked by
the freeze — nothing under `spike/` is involved. Small, and worth doing early rather than in
priority order: it is a false red in the suite that gates every remaining child of Q-0009, and a
false red that clears on a rerun teaches everyone to rerun. Belongs to M2 in
`docs/06-development-plan.md`.
