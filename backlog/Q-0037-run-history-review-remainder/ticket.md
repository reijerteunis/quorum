---
id: Q-0037
title: Run-history review remainder — one major and eight nits
stage: draft
owner: ruud
repos: []
branch: harness/Q-0037/integration
priority: p3
created: 2026-08-24
iterations: {}
history: []
---
Opened under AC-2 of Q-0034, which allows review findings to become follow-up tickets rather than
forcing another revise loop on a branch that is already stale. These are what survived Q-0011's two
review rounds (`backlog/Q-0011-run-history-on-disk/review/round-2/`) when it landed on `main`.
Nothing here blocks the feature; all four blockers and thirteen of fourteen majors were closed
before landing.

**The one major.** `spike/src/engine.js` `runGate` holds a one-second `setTimeout` that exists only
to keep a hanging-gate test fixture alive — a TTY gate owns a readline handle and a non-interactive
gate throws before awaiting, so neither shipped path needs it. After the second elapses the loop can
drain and the process exit 0 with the manifest still reading `running`. It is documented in place
rather than removed because removing it requires giving that fixture a promise owning its own
handle, which means editing `spike/test/**` — qa-red's artifact. Erratum E-4 in
`backlog/Q-0011-…/solution/errata.md` is the precedent for doing that properly.

**Eight nits**, all from round 2 and cited by file: the stage guard in `initialiseRunHistory` is
unreachable through the CLI, since `runFlow` already refuses on a stage mismatch and every CLI path
loads the ticket from the file the guard reads; every terminal occurrence re-serialises the whole
manifest and `fsync`s it, so cost is quadratic in occurrence count on a path every integrate step
runs (unmeasured); a `manifest.json.tmp` survives a `SIGKILL` between write and rename and nothing
names or cleans it; the per-step `usage:` line reuses `formatVendorSummary` with a synthesised
`unpriced_steps`, printing a roll-up field on a single occurrence and collapsing four measures into
one total; `readData` re-reads and re-parses a file `validateFile` parsed a line earlier; the
validator's skip notice names run-manifest checks for every schema, so validating an unrelated
contract prints "run-manifest semantic checks skipped"; and `vendorTokenTotal` returns null when
input and output are both null while the cache fields are populated, printing `tokens=n/a` beside
real counts.

**One is Quorum's own record.** The `x-quorum-contract` decision entry sits mid-file in
`docs/DECISIONS.md` rather than appended, which `.claude/rules/docs-and-decisions.md` calls
append-only. It arrived there from the Q-0034 merge, which unioned two append-only files and
preserved date order at the cost of position. Worth deciding which property wins when an entry
written on one date lands after entries written later — the two cannot both hold, and the rule
currently only names one of them.

**Q-0049 ruled at its requirements gate on 2026-08-28, and this ticket got bigger.** Q-0049's body
offered a choice — land Q-0037 on the spike first, or port the fixed version, but not both - and the
merged requirement observed that it is a choice which does not exist: neither has happened, so
charter §2 requires the port to take the **unfixed** code. It does, and every item above is preserved
and reported in Q-0049's implement report rather than fixed in passing. **The consequence is that
after Q-0049 lands, this ticket's subject exists in two trees**, so a fix in one leaves the port's
independent witness disagreeing — the Q-0066/Q-0068 shape, where the change must land in `spike` and
`packages/core` together. Charter §3's table still lists this ticket as one of five blocking the
freeze SHA, which is `not-yet-recorded` (`harness/port-charter.md:243`); re-targeting at both trees
is the recommendation and is Ruud's call, not Q-0049's.

Two of the nine items above are also **re-pointed** by that requirement, and neither is Q-0049's to
fix: the unreachable stage guard is unreachable *from the CLI* and is reachable for a caller that
builds a ticket record itself, which is M3's server — so the port preserves it deliberately and it is
the reason the module imports `parseFrontmatter`; and the `runGate` 1-second timer is already
invited to be fixed by Q-0052, whose new Vitest fixtures do not inherit the frozen-`spike/test/**`
constraint that blocked it here.

Belongs to M2 in `docs/06-development-plan.md`. Small and unrelated to each other, so this is a
good candidate for the chore flow, or for being split further if anyone would rather.
