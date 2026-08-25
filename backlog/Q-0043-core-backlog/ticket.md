---
id: Q-0043
title: core/backlog — tickets, frontmatter, stages and loadProject
stage: draft
owner: ruud
repos: []
branch: harness/Q-0043/integration
priority: p1
created: 2026-08-25
iterations: {}
history: []
---
Ports `spike/src/backlog.js` (102 lines) — `parseFrontmatter`, `renderFrontmatter`, the `Backlog`
class and its ticket walk — to `packages/core`, against the ticket schema Q-0041 defines. Belongs to
M2 in `docs/06-development-plan.md`; parent Q-0009.

**It also lifts `loadProject` out of the CLI.** `spike/bin/harness.js:46–61` implements
`findProject` (walk up to `harness/harness.yaml`) and `loadProject` (read the config, resolve
`backlog.path`, construct a `Backlog`). `04-architecture.md` names `loadProject(dir)` as part of
core's public API, and M3's server needs it as much as the CLI does. This is the clearest instance of
the finding Q-0009 records: the spike's module boundary is not the boundary to reproduce.

**Files are the database.** Every mutation stays a file write under `backlog/`, and round-tripping
`ticket.md` must not reformat what it did not change — history entries and iteration counters are
read by humans in diffs and by three other tickets' fixtures. The frontmatter writer is the one place
where a "tidier" YAML emitter would produce a large, meaningless diff on every stage transition.

**Two things to carry, not to fix.** `backlog.js:64` writes the ticket's branch *name* into
frontmatter and nothing ever creates the ref, which is half of why the chore flow cannot run on a
ticket's first pass. That is recorded in Q-0038 and belongs to whichever ticket takes it; a port that
quietly starts creating branches changes behaviour under cover of a translation. Likewise, Q-0011's
stage reads `red` while its code is contained in `main`, because a review backward edge regressed it
and nothing moved it back — what a stage means after a backward edge is undecided, and this ticket
does not decide it.

**Scope boundary.** Stage *transitions* — which flow may consume which stage, and what a failed run
does to it — are the engine's, and land in Q-0050. This ticket owns the stage list, the ticket
representation and the store.

## Port charter

The charter is `harness/port-charter.md`; §6's register is normative for everything below and this
body cites it rather than restating it — where the two ever differ, the register is right.

Route: **chore** (`requirements → chore → human gate`), per *"The port takes the chore route,
except the one child that has new behaviour"* (`docs/DECISIONS.md`, 2026-08-25). Behaviour is
preserved per *"The port preserves behaviour; one exception is authorised and everything else
stops the child"* (`docs/DECISIONS.md`, 2026-08-25) — a defect found while reading the spike is
reported, never fixed in passing.

- **Ports:** `backlog.js` — frontmatter, `Backlog`, ticket walk
- **Lifts from `spike/bin/harness.js`:** `findProject`, `loadProject` (:46–61)
- **Depends on:** Q-0041 · **Depended on by:** —
- **Invariants inherited:** register rows 9, 19 (charter §2)
- **Non-goals:** another child's module; editing `spike/**` (charter §3); fixing a defect found
  while reading (§2); the cutover; the `quorum` binary (Q-0010); persisting the event stream;
  anything on v1's exclusion list.
