---
id: Q-0064
title: packages/core/src into folders, before the remaining port children land
stage: draft
owner: ruud
repos: []
branch: harness/Q-0064/integration
priority: p1
created: 2026-08-26
iterations: {}
history: []
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

**Also in scope, because it is the same pass.** `harness/rules.md`'s new *Comments* section
(2026-08-26) applies to the moved files: JSDoc for the contract, one `Why:` line naming an authority
where behaviour is deliberately counterintuitive, no transcription of DECISIONS entries or ticket
bodies. `backlog.ts`, `project.ts` and `git.ts` are 43–57% comment today, most of it rationale
copied from elsewhere. **Reduce the prose; do not delete a `Why:` pointer** — several mark defects
the port charter requires to be preserved, and an unexplained preserved defect is one the next
child helpfully fixes.

**Non-goals.** Any behaviour change whatsoever — this is a move, a helper fix and a comment pass.
No new export, no signature change, no defect fixed (`harness/port-charter.md` §2, and Q-0043
reported nine that stay reported). No folder created for a module that does not exist yet. No change
under `spike/` (§3). Not `packages/shared`'s layout. Not `packages/core/src/index.ts`'s bytes.

**How it is proven.** `pnpm turbo run test --force` and `npm test --prefix spike`, both green, with
the same test count as before the move — **123 in `core` and 96 in `shared`**. A drop in either is
this ticket's characteristic failure rather than a tidy-up, and hazard (1) is exactly how the count
would fall while the suite stayed green. Use `--force`: a cached turbo run replays a pass it never
executed.

**Route:** chore (`requirements → chore → human gate`). Belongs to M2 in
`docs/06-development-plan.md`; runs before Q-0044.
