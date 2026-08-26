---
id: Q-0059
title: dirOf accepts a traversing argument and reads outside the backlog root
stage: draft
owner: ruud
repos: []
branch: harness/Q-0059/integration
priority: p2
created: 2026-08-26
iterations: {}
history: []
---
Found by Q-0043's implement step while porting `spike/src/backlog.js`, reported and not fixed per
*"The port preserves behaviour"* (`docs/DECISIONS.md`, 2026-08-25). The behaviour is now in
`packages/core/src/backlog.ts:133` as well, carried forward deliberately and pinned by test.

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
`packages/core/src/backlog.ts`, which is on `main` as of Q-0043. Its 37 behaviour tests are the
regression net; the criterion to add is that a traversing or symlinked argument raises rather than
resolves, and the existing "ticket not found" message for a genuine miss is unchanged. Belongs to
M2 in `docs/06-development-plan.md`, and wants settling before M3.
