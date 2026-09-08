---
id: Q-0114
title: A stale run lock is detected rather than left for a human
stage: draft
owner: ruud
repos: []
branch: harness/Q-0114/integration
priority: p3
created: 2026-09-09
iterations: {}
history: []
---
Decide whether a liveness probe may exist at all, then ship one whose answers are a closed set including could-not-tell. Q-0039 ships a lock that refuses and is never reclaimed; after a SIGKILL or power loss every later run of that ticket refuses until somebody deletes a file.

Opened **2026-09-09 at Q-0039's requirements gate** (its GO-2), from Appendix A of that ticket's
merged requirement, which wrote this design out in full rather than describing it. Written here as a
ticket rather than left in a closing entry because **three obligations found this week — Q-0110's,
Q-0111's and Q-0112's — had lived only inside a closed ticket's prose or a source comment**, and one
of them had been waiting since 2026-09-02.

**Why it exists.** Q-0039 ships a lock that refuses and is never reclaimed, on its own measurement
(M-4) that the only ways one outlives its run are SIGKILL, a hard crash and power loss — because
`packages/cli/src/run.ts:179–180` aborts an `AbortController` rather than exiting inside the signal
handler, so SIGINT and SIGTERM both reach the engine's `finally`. That ruling is correct and it is
not free: after such a crash, **every subsequent run of that ticket refuses until somebody deletes a
file**. This ticket asks whether the product can tell the difference safely.

**What it must decide first, before a line of code.** Whether a liveness probe may exist at all.
Two landed positions bear on it: *"The board reports push lag, and never a CI conclusion"*
(2026-09-06), whose rule is that silence means only that git answered; and **Q-0074**, open on
precisely the shape *a failed probe is read as a proven negative*. A pid probe that cannot
distinguish *the process is gone* from *that pid belongs to something else now* is that defect one
layer over. **It owes a decision entry** naming Q-0074 and stating the probe's **closed set of
answers, including the one that means could not tell** — the shape containment, push lag and
verified version all have. `developer-generalist` may not write one, so the entry lands **before**
the chore run, not during it: Q-0062 spent three implement rounds on exactly that obligation left
undischarged, and Q-0039's GO-1 is the same lesson applied one ticket earlier.

**Shape, if it is built.**

- The probe answers `gone`, `alive` or `indeterminate`, **never a boolean**. `indeterminate` refuses
  exactly as today, so the safe default is unchanged and only the provable case moves.
- A lock whose recorded **hostname** is not this machine is **never** reclaimed, whatever the pid
  says.
- Reclaiming is one attempt at the same atomic claim, so two contenders recovering the same stale
  lock still yield one owner. **That is why Q-0039's ownership token (its AC-5) exists before this
  ticket does**, and it is the half that makes recovery safe — the probe is not.

**What it must not do.** It must not introduce a two-process race into the suite. **Q-0102 is parked
on exactly that shape**, and Q-0039's AC-11 refuses it. The race-to-reclaim property is provable
in-process against the claim primitive, and that is how it is to be proved.

**Size.** Five to six criteria, which is why it was not folded into Q-0039: at nineteen or twenty
that ticket is past the fifteen ceiling and every later stage pays for it.

**Order.** Strictly after Q-0039 — **recovery has no subject until a lock exists**, and the
ownership token it depends on is Q-0039's AC-5.

**Priority p3, argued rather than assumed.** A leak needs SIGKILL, a hard crash or power loss; the
recovery is one `rm` against a message that names the path. It rises if that message turns out to be
what people actually hit, which is the `EEXIST`-shaped failure Q-0039's own body warns about — a
recovery path becoming the ordinary path.
