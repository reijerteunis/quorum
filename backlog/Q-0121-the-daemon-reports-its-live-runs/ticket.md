---
id: Q-0121
title: The daemon reports its live runs
stage: draft
owner: ruud
repos: []
branch: harness/Q-0121/integration
priority: p2
created: 2026-09-11
iterations: {}
history: []
---
Successor B of Q-0014, from Appendix B. RunHost exposes view(handle) and no enumeration, and no route exposes even that, so a browser that refreshes has lost every live run and DEFAULT_RETENTION's late-joiner buffer is unreachable.

Opened **2026-09-11 at Q-0014's requirements gate**, transcribed **in full** from that ticket's
merged requirement rather than referenced — three obligations found in one week (Q-0110, Q-0111,
Q-0112) had lived only inside a closed ticket's prose or a source comment.

**Allocated at the allocator's next id**, not a planned one: M3's `Q-0015`–`Q-0019` are the screens.

## Transcribed from Q-0014, Appendix B

**Problem.** `RunHost` exposes `view(handle)` and no enumeration, and no route exposes even that. Nine
routes are registered and `POST /runs` is the only one that ever tells a client a handle (§1.9). A
browser that refreshes has lost every live run, and `DEFAULT_RETENTION`'s late-joiner buffer — built
precisely for *"a browser opened after a run began, or reopened after a refresh"* — is unreachable,
because the reopened browser cannot name the run.

**What it owes.** A `GET /runs` listing the host's live runs as `WireRun`s and a `GET /runs/:id`
answering one. Both are reads over state the host already holds; neither adds domain logic. The open
question is whether `RunHost` gains an enumeration or the transport keeps its own index — the first is
where the state is, the second keeps the host's surface at what Q-0013 proved.

**What it must not do.** Persist a handle in the browser — `04-architecture.md:183` permits no
client-side persistence beyond UI preferences. And it must not report a run it cannot back: a handle
whose stream has ended is `ended`, a state `RunView` already carries, not an absence.

**Sequencing.** After Q-0014, which creates a browser that can reload, and before or with Q-0015.

---
