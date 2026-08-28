# `.claude/rules/` is a derived copy, not a surface a requirement may name — 2026-08-27

**Decision:** The vendor dialect files — `.claude/rules/`, and from M5 `CLAUDE.md`, `AGENTS.md`
and `GEMINI.md` — are **derived copies of `harness/`**. They are never a source, and they are
never a surface an acceptance criterion may name as work for a flow step. A requirement names the
canonical file in `harness/` and nothing else. Until M5's compiler lands, the copy is synced by a
**human commit in the same change** that edits its canonical original.

The routing check of *"A requirement may not name a surface its flow cannot write"* (2026-08-25)
therefore asks **three** questions of every criterion's surface, not one:

1. **May the role write it?** — the `paths` allow-list in `harness/roles/<role>.md`.
2. **Will the engine revert it?** — `commitAll` restores `backlog/` before every agent commit.
3. **Is it derived?** — a compilation target is written by the compiler, never by hand and never
   by an agent, however wide its allow-list.

Only the first two were being asked. The third is what Q-0069 hit.

**Alternatives considered:**

**(a) Widen `developer-generalist`'s `paths` to include `.claude/`, and relax the file gate that
refused the write.** Rejected on two independent grounds. It hands an agent the file that
constrains the agent — the same hazard `commitAll` exists to prevent for `backlog/`, where an
agent that can edit `ticket.md` can advance its own stage and refund its own counters. An agent
that can edit `.claude/rules/` can delete the rule it is about to violate. And the gate that
refused is **Claude Code's own**, not this repository's: it is not ours to relax, and "relaxing"
it would mean shipping a per-run permission flag scoped to the one directory whose whole purpose
is to constrain the run. Neither ground depends on the other, and neither addresses the real
problem, which is that the file is an output.

**(b) Open a separate ticket and decide it there.** Rejected: the answer is already fixed by
*"Canonical harness compiled to vendor dialects"* (2026-08-06) and restated in
`harness/rules.md:3–4`, which calls the `.claude/` copy *"the drift"* in as many words. A ticket
would spend a requirements run rediscovering a decision this file already contains.

**(c) Delete the `.claude/` copy now and have Claude Code read `harness/rules.md` through a
`CLAUDE.md` import.** Genuinely attractive — it removes the drift rather than managing it, and it
is where the product is going. Deferred to M5, which owns the compiler: doing it by hand now means
authoring the import wiring the compiler is scheduled to generate, and then owning both.

**Why:** Q-0069's chore run reached its exhaustion gate on this and nothing else. Eleven of twelve
criteria were satisfied in the first implement round; AC-11(b) named
`.claude/rules/engineering.md:4`, and three consecutive rounds correctly refused to close it —
the implementer reporting that both `Edit` and `Write` were refused and that `.claude/` is in
neither its role's `paths` nor `harness/architecture.md`'s role table, the reviewer correctly
declining to approve an unmet criterion. Two right agents, no legal move, roughly $12 spent
establishing it.

The requirement had checked. Its preamble certifies *"No criterion below names `backlog/`"* — and
that is the tell. It verified the one unwritable surface the repository had written down, and
never asked the general question of which surfaces a step may write. This is the failure Q-0034
named as *"review the fix round, not only the feature round"*, arriving through a document: a
correction inherited without re-deriving what it did **not** say. The 2026-08-25 entry closed
`backlog/`; it did not claim to enumerate every unwritable surface, and it was read as though it
had.

**Cost accepted, and it is a real one:** until M5, every edit to a canonical file in `harness/`
needs a paired human commit to its `.claude/` copy, and **nothing enforces the pairing** — the two
files can drift silently, which is exactly the disease the 2026-08-06 entry says the compiler
exists to cure. `harness/rules.md`'s header already says which wins, so a drift is resolvable
rather than ambiguous, but it is not detectable. A test asserting that the rules in `.claude/`
correspond to the canonical set would close it, and is deliberately not written here: it needs to
survive M5 replacing the copy with generated output, and that is the compiler's ticket to own.

**Found by:** Q-0069's chore run, 2026-08-27, at its exhaustion gate. The implementer raised the
underlying contradiction — that `harness/rules.md:3` promises `.claude/rules/` *"carries the same
rules"* while no flow in the repository can make that true — and explicitly declined to decide it,
its role forbidding it to record a decision. Decided here at Ruud's direction rather than deferred
to a new ticket.
