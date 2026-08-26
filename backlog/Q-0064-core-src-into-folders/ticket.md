---
id: Q-0064
title: core/src into folders, plus the flaky containment snapshot
stage: requirements
owner: ruud
repos: []
branch: harness/Q-0064/integration
priority: p1
created: 2026-08-26
iterations: {}
history:
  - stage: requirements
    run: 1
    flow: requirements
    status: completed
    stage_before: draft
    stage_after: requirements
    at: 2026-08-26T09:24:42.904Z
    cost: 5.864
---
Raised by Ruud on 2026-08-26. Decided as *"`core` is organised in folders named after the port's
children; `shared` stays flat"* (`docs/DECISIONS.md`, 2026-08-26) — that entry is normative and this
body cites it rather than restating it.

**Runs before Q-0044**, so the eleven remaining children of Q-0009 target the new paths from the
start rather than being re-pointed afterwards.

**The move.** `packages/core/src`'s eleven flat files become:

| To | Files |
| --- | --- |
| `src/backlog/` | `backlog.ts`, `backlog.test.ts`, `backlog.source.test.ts`, `project.ts`, `project.test.ts` |
| `src/git/` | `git.ts`, `git.test.ts`, `git.source.test.ts` |
| `src/` (unchanged) | `index.ts`, `index.test.ts`, `shared-resolution.test.ts` |

`adapters/`, `contracts/`, `engine/`, `fanout/`, `lint/` and `run-history/` are created by the
children that fill them, not pre-created empty. `packages/shared/src` is **not** touched.

**Three hazards, each a way to land this wrongly.** The decision entry states them; they are
repeated here as acceptance surface because each is a silent failure.

1. **`coreSourceFiles()` (`packages/core/test/corpus.ts:22–28`) is not recursive.** After the move
   it returns `index.ts` alone, and its `if (!files.length) throw` guard does not fire because one
   file remains. Three landed tests iterate it to assert house rules over every core source
   (`backlog.source.test.ts:36,50,110`, `git.source.test.ts:30`) and would narrow to one file while
   reporting green. It must become recursive in this change, key its entries by `src`-relative path,
   and gain a guard that fails when the corpus is implausibly small — *"a check that skips its
   subject must not report success"* (2026-08-25).
2. **Lookups by bare filename break.** `git.source.test.ts:15` matches `name === 'git.ts'` and
   `backlog.source.test.ts:15` matches `file === name`. They are the tests that would otherwise
   catch (1), so they must be updated deliberately rather than by search-and-replace.
3. **Two cross-package path reads.** `packages/shared/src/project.test.ts:106` reads
   `packages/core/src/project.ts` and moves with the file. `packages/shared/src/index.test.ts:52`
   byte-pins `packages/core/src/index.ts` and **must not move** — `index.ts` stays at `src/` root,
   byte-unchanged, and that pin staying green is the proof.

**Also in scope: Q-0061's flaky test, absorbed 2026-08-26.** `packages/core/src/git.test.ts:235`
asserts that deriving containment writes nothing, by comparing a `walk(dir)` snapshot taken before
and after. `walk` is `fs.readdirSync(dir, { recursive: true })` with no exclusion
(`packages/core/test/repo.ts:71–72`), so **`.git/**` is inside the snapshot** and any file git's own
background maintenance creates in that window — `.git/objects/maintenance.lock` is the observed one
— fails the assertion. Observed twice on 2026-08-26, once on clean `main`.

It is folded in here rather than run separately because it is the same surface: this ticket already
moves `git.test.ts` and already rewrites `packages/core/test/corpus.ts`, and `walk` lives beside
`coreSourceFiles` in `packages/core/test/repo.ts`. Two tickets editing those files in sequence would
touch them twice for one outcome.

**The fix, and the trap in it.** Filter git's transient lock files out of the snapshot; do **not**
loosen the assertion. The criterion is real — Q-0036 exists because containment must derive from git
and store nothing, and charter register row 9 binds every later child to it. Excluding `.git/**`
wholesale is also too broad: the sibling `expect(git(dir, 'for-each-ref')).toBe(refsBefore)` covers
refs, but the file snapshot is what would catch a cache written under `.git/`, which is exactly what
the containment decision forbids. The narrow exclusion keeps both. Q-0061 is closed as absorbed and
its body carries the full evidence.

**Also in scope, because it is the same pass.** `harness/rules.md`'s new *Comments* section
(2026-08-26) applies to the moved files: JSDoc for the contract, one `Why:` line naming an authority
where behaviour is deliberately counterintuitive, no transcription of DECISIONS entries or ticket
bodies. `backlog.ts`, `project.ts` and `git.ts` are 43–57% comment today, most of it rationale
copied from elsewhere. **Reduce the prose; do not delete a `Why:` pointer** — several mark defects
the port charter requires to be preserved, and an unexplained preserved defect is one the next
child helpfully fixes.

**Non-goals.** Any change to shipped behaviour — this is a move, two test-helper fixes and a
comment pass. No new export, no signature change. **No defect fixed other than Q-0061's**, which is
named above and is a defect in a test helper rather than in the product
(`harness/port-charter.md` §2 stands, and Q-0043's nine reported defects stay reported). No folder created for a module that does not exist yet. No change
under `spike/` (§3). Not `packages/shared`'s layout. Not `packages/core/src/index.ts`'s bytes.

**How it is proven.** `pnpm turbo run test --force` and `npm test --prefix spike`, both green, with
the same test count as before the move — **123 in `core` and 96 in `shared`**. For Q-0061
specifically: a test that creates a lock file under `.git/` inside the snapshot window and shows the
assertion still passing, so the fix is proven rather than assumed to have made a flake go away. A drop in either is
this ticket's characteristic failure rather than a tidy-up, and hazard (1) is exactly how the count
would fall while the suite stayed green. Use `--force`: a cached turbo run replays a pass it never
executed.

**Route:** chore (`requirements → chore → human gate`). Belongs to M2 in
`docs/06-development-plan.md`; runs before Q-0044.
