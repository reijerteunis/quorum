---
id: Q-0059
title: dirOf accepts a traversing argument and reads outside the backlog root
stage: requirements
owner: ruud
repos: []
branch: harness/Q-0059/integration
priority: p2
created: 2026-08-26
iterations: {}
history:
  - stage: requirements
    run: 1
    flow: requirements
    status: completed
    stage_before: draft
    stage_after: requirements
    at: 2026-09-08T16:13:29.928Z
    cost: 9.36
---
> **RULED AT THE REQUIREMENTS GATE, 2026-09-08 — read this before the body below.** These are
> `requirements/merged.md` §6's rulings, carried here per that document's **GO-3** so that no
> implement step chooses one while writing and no review round argues one back. Each was ruled on a
> measurement, not a preference. The body below is the 2026-08-26 account and is superseded wherever
> it disagrees.
>
> **OQ-1 — the primitive is `packages/core/src/backlog/confine.ts`.** `backlog/` carries no folder
> file-set pin where `fanout/` and `run-history/` both do, so a new module there costs no register
> edit while a new file in `run-history/` is refused by that folder's own pin. Exporting from
> `reader.ts` points the dependency the wrong way. **A new top-level `core` folder is the one option
> that would owe a decision entry** — it contradicts *"`core` is organised in folders named after the
> port's children"* (2026-08-26) — and is **not taken**. GO-1 is ratified: **no entry is owed.**
>
> **OQ-2 — `dirOf` verifies with the realpath and returns the JOINED path.** The run-history
> precedent returns the resolved path (`reader.ts:200–219`); copying it here turns three landed
> assertions red and changes `TicketRecord.dir` for every consumer — on macOS `/var/folders/…` becomes
> `/private/var/…`, and a symlinked checkout changes in production — reaching artifact paths, `wrote …`
> events and run history. The window it leaves needs write access to the backlog root, which is
> already game over. **The divergence from the precedent gets one authority line**, because it is
> exactly what a later reader otherwise "fixes".
>
> **OQ-3 — two refusals, not one.** A **lexical** traversal gets its own condition and its own
> sentence: refusing on the shape of a string discloses nothing about the filesystem, and an operator
> who typed a path deserves better than *"not found"*. A token that **exists and resolves outside the
> root** keeps the unchanged `ticket not found`, disclosing nothing about where the link pointed —
> the contract `resolveRunDirectory`'s `null` already holds for run history.
>
> **OQ-4 — the flow-lint rule is NOT in this ticket. Its successor is Q-0113**, opened at this gate
> rather than left in a closing entry.
>
> **OQ-5 — `readFiles` is IN scope, and it refuses.** It is in no earlier account because nobody had
> measured it. Excluding it ships an asymmetry that cannot be written down with a straight face: the
> engine could not *write* outside the ticket folder but could **read the whole disk into the prompt
> an adapter is invoked with**. It **refuses** rather than answering `[]`, because `[]` is what a
> legitimately absent directory already answers — silence would shrink a prompt with nothing going red.
>
> **OQ-6 — a symlink to a sibling ticket folder is an ALIAS, and is accepted.** It resolves to a path
> whose parent is the real root, so the rule admits it with no special case — the answer
> `reader.test.ts:277` already pins for run history. A write through an alias writes the real
> `ticket.md`, to the same bytes in the same folder.
>
> **GO-4 is ruled: `docs/GLOSSARY.md` gains `Confinement`** as its own term — *a path is inside a
> declared root, checked by resolving it and comparing against the resolved root* — stated so it can
> never read as a synonym for **Containment**, which is a git ancestry fact about two refs. The
> vocabulary rule puts a term in the glossary before its second use, and this one is already in its
> third file. AC-12's numbered-document sentence uses it and the glossary defines it, in one change.

> **Corrected 2026-09-07, after the cutover.** `spike/` was deleted by Q-0103 on 2026-09-06, so
> every path, line number and landing rule below that names it is **void** — read *"After the
> cutover"* at the end of this body before acting on anything here. The defect itself is
> unchanged and was re-verified against the tree on 2026-09-07.

Found by Q-0043's implement step while porting `spike/src/backlog.js`, reported and not fixed per
*"The port preserves behaviour"* (`docs/DECISIONS.md`, 2026-08-25). The behaviour is now in
`packages/core/src/backlog/backlog.ts` as well, carried forward deliberately and pinned by test.

**The defect.** `dirOf`'s first branch is an existence check on the joined path
(`spike/src/backlog.js:34`):

    if (fs.existsSync(path.join(this.root, idOrFolder))) return path.join(this.root, idOrFolder);

`path.join` resolves `..` segments, so `dirOf('..')` returns the backlog's **parent** and
`read('../somewhere')` will read a `ticket.md` from anywhere on disk the process can reach. There is
no confinement check, and the caller gets a plausible-looking ticket object back rather than an
error.

**Why it needs its own ticket rather than a line in the port.** Q-0043's non-goals already carry a
path-traversal item, but that one names **`writeFile` only** — this is the read side, in a different
function, and the requirement's list would not have caught it. Both are the same class and the fix
is the same primitive: resolve, then verify the result is inside the root, the way `realPath` and
the confinement check in `spike/bin/harness.js` already do for the run-history reader (added by
Q-0034 after a symlink got through a lexical check). **A lexical check is not enough here either** —
`path.resolve` does no filesystem work and `statSync` follows links, so a single-segment symlink
inside `backlog/` passes every string test. That was round 1's mistake on Q-0011 and round 2 caught
it; this ticket should not make it a third time.

**How reachable is it today?** Not very, and that is the argument for fixing it cheaply rather than
urgently. Every caller in the engine passes a ticket id that came from the CLI argument or from a
flow file. There is no web surface yet — but M3's server takes a ticket id over HTTP, and that is
exactly when this stops being theoretical. Fixing it before the daemon is cheaper than fixing it
after.

**Scope.** One function, plus whatever `writeFile` needs so the two agree — the write-side item is
listed in Q-0043's non-goals and should be closed by this ticket rather than left to drift apart
from the read side. `spike/src` is frozen (`harness/port-charter.md` §3), so this lands against
`packages/core/src/backlog/backlog.ts`, on `main` as of Q-0043 and moved by Q-0064. Its 37 behaviour tests are the
regression net; the criterion to add is that a traversing or symlinked argument raises rather than
resolves, and the existing "ticket not found" message for a genuine miss is unchanged. Belongs to
M2 in `docs/06-development-plan.md`, and wants settling before M3.

## After the cutover — corrected 2026-09-07

**Void: the freeze clause in *Scope*.** `spike/src` no longer exists, so *"is frozen
(`harness/port-charter.md` §3)"* names a deleted file. The rest of that paragraph is right and
unchanged: this lands against `packages/core/src/backlog/backlog.ts`.

**The defect, re-measured.** `dirOf` is `packages/core/src/backlog/backlog.ts:120–125` and its first
branch is the same existence check on the joined path:

    if (fs.existsSync(path.join(this.root, idOrFolder))) return path.join(this.root, idOrFolder);

**The confinement precedent moved and is now in the same package**, which makes the fix cheaper than
the body suggests. The `realPath` guard the body points at in `spike/bin/harness.js` is
`packages/core/src/run-history/reader.ts:74`, used at `:213–214` — `realPath(runsRoot)` compared
against `realPath(path.resolve(...))`, which is exactly the resolve-then-verify shape this ticket
wants, already written, already tested, and one import away. Q-0049's AC-11 is the test that proves
its `realpath` clause is load-bearing rather than shadowed by the lexical ones.

**The write side named in Q-0043's non-goals is `Backlog.write` (`backlog.ts:137–139`)**, still
writing to `path.join(ticket.dir, 'ticket.md')` with no check of its own. Q-0080 since added
confinement-adjacent refusals to `create` (`:198–207`) — a taken id, an occupied folder, and an
exclusive `mkdirSync` — so the module now contains a worked example of refusing rather than
resolving, in the function next door.

**The regression net is `backlog.test.ts` (46 tests) and `backlog.source.test.ts` (14)**, not the 37
the body records. The criterion to add is unchanged.
