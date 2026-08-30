---
id: Q-0080
title: harness ticket new cannot allocate an id, and collides with itself
stage: draft
owner: ruud
repos: []
branch: harness/Q-0080/integration
priority: p1
created: 2026-08-30
iterations: {}
history: []
---
Opened 2026-08-30, split from Q-0079's body where it was reported and not fixed. Created by hand,
like Q-0074 and Q-0079, because the command this ticket is about is the one that would have created
it.

## The defect

`nextId()` strips a leading `T-` and nothing else before `parseInt`
(`spike/src/backlog.js:50–53`, `packages/core/src/backlog/backlog.ts:143–147`). Every `Q-nnnn` id
in this repository therefore yields `NaN`, the `filter(Number.isFinite)` drops **all 52 of them**,
`nums` is empty, and the function returns `T-0001` — not once, but on every call, because no `T-`
ticket persists to raise the maximum. Measured 2026-08-30 by running `harness ticket new`, which is
how Q-0079 came to be written by hand.

**The consequence is worse than a wrong prefix, and the port's own JSDoc says so:** *"`create()`
would then overwrite an existing folder without a word."* `create()` computes
`${id}-${slug}` and calls `fs.mkdirSync(dir, { recursive: true })`, which is silent when the
directory exists, then `write()` replaces `ticket.md` outright. So two invocations collide on the
**id** always, and on the **folder** whenever the two titles slug the same — the second ticket
replacing the first with no error, no prompt and no log line. That contradicts the engineering
rule *"errors are explicit … never default silently"* in the module the product calls its database.

## This is a preserved defect, not a new one — and that shapes the fix

Q-0043 carried it deliberately under charter §2 and **pinned it in both trees**, so a later fix has
to be deliberate rather than incidental. The pins the fix must remove with it:

- `packages/core/src/backlog/backlog.ts:135–142` — the `Why:` JSDoc naming the behaviour and its
  `create()` consequence.
- `packages/core/src/backlog/backlog.test.ts:348` — *"nextId counts only T- ids, so a Q- backlog
  restarts at T-0001 — carried, not fixed"*, which asserts `T-0001` over a `Q-0006`/`Q-0043`
  backlog and `T-0008` once a `T-0007` is present. **Both halves are load-bearing**: the second
  proves the counter works when the prefix matches, so a fix must keep it working.
- `packages/core/src/backlog/backlog.test.ts:245` — `expect(readOnly.nextId()).toBe('T-0001')`.
- The enclosing describe is *"AC-7 — create() and nextId(), with both known defects pinned as they
  are"*; the **other** defect in that pair is `create()` writing a branch NAME and making no ref,
  which Q-0038 owns (register row 19). This ticket must not disturb it.

Lands in `spike` and `packages/core` **together** — the Q-0066 / Q-0068 / Q-0070 shape — because a
fix in one tree alone leaves the other disagreeing until the cutover, which is the divergence the
freeze exists to expose. Q-0057 is the precedent for a non-child ticket touching `spike/src` while
the port is live: `harness/port-charter.md:242`'s `children:` list is Q-0041 through Q-0054, and
Q-0080 is not among them.

## What the requirement has to decide

1. **Where the prefix comes from.** Three shapes, none decided here. (a) A constant, changed from
   `T-` to `Q-`, which fixes this repository and breaks the next adopter the same way. (b) Derived
   from what is already on disk — count the ids that share the most common prefix — which needs an
   answer for an empty backlog, the cold-clone case. (c) A `harness.yaml` key, which is the only
   shape that survives both, and would give `projectConfigSchema` its first caller — the same hook
   Q-0058 names, so the two should be read together even though they are separate tickets.
2. **What an empty backlog allocates**, since that is exactly the cold-clone path and no existing
   id can be inspected.
3. **What happens when the target folder already exists.** The requirement should say whether
   `create()` refuses, or allocates the next free id — but silence is not one of the options, and
   this is the half that makes the ticket p1 rather than cosmetic.
4. **Whether mixed prefixes are legal at all** in one backlog. `Q-`, `T-` and the `T-0001` fixtures
   in `backlog.test.ts` coexist today only because nothing reconciles them.

## Why it is p1

It is on the cold-clone path, which is M6's finish line: `harness init` then `harness ticket new` is
the first thing a stranger does, and today the second command silently hands out an id that
collides with the one before it. The 30-minute README test cannot pass through a command that
destroys the ticket the user just made.

## Non-goals

- **Not the branch-ref half** of AC-7's pinned pair — Q-0038 owns it.
- **Not `dirOf`'s traversal** (Q-0059) or the frontmatter fail-open (Q-0060), which are the other
  two open defects in this module.
- **Not a backfill or rename** of any existing ticket folder. Every id on disk stays as it is.
