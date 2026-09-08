# An adapter records the version it was verified against, and never a version it supports — 2026-09-08

**Decision:** each adapter's capabilities module records **one string** — the CLI version that
adapter was last verified against — and `quorum adapters --probe` reports how the installed version
compares with it. Five things follow, and they are what make this a datum rather than a policy.

**(a) The datum is a past measurement, not a rule.** There is no ceiling, no minimum and no
supported range. `verifiedVersion` answers *"which version was this checked against?"* and nothing
else. A range would be a maintenance liability of the kind *"Codex cost is reported as tokens, never
priced locally"* (2026-08-22) refused for a rate table — *the table is wrong the moment a vendor
changes something and nothing in an offline tool would notice* — and a range goes stale the same way,
except that a stale range **refuses work** where a stale rate merely misreports.

**(b) The product reports and never refuses.** No version state changes an exit code, stops a run or
gates a command. A cold-clone adopter whose CLI is one release ahead of a number written months
earlier must not be turned away by it; that is the failure *"Flows never pin a vendor model name"*
(2026-08-22) exists to prevent, arriving by another route.

**(c) Nothing branches on a version.** No adapter selects flags, parses output or changes behaviour
by comparing versions. A compatibility shim is a decision with its own case and its own entry, never
something a probe acquires by drift. This is the clause that keeps (a) and (b) honest: a datum
nothing branches on cannot quietly become a policy.

**(d) It stands beside the login verdict as provenance, never as a second verdict.** The only
compatibility evidence this product has is a successful `--probe` — an actual round-trip that
worked — and that is already reported as `login`. The version state says what that evidence was
collected against. Two verdicts where there is one measurement would invite a reader to trust the
weaker one.

**(e) It belongs to `--probe`, which is the check, and not to the bare listing, which is the
report.** *"check() proves presence; only `adapters --probe` proves login"* (2026-08-22) drew that
line, and *"What an exit code may claim, and the three zeros it was asked about"* (2026-09-08) gave
it an exit code: the presence listing exits 0 whatever it finds and disclaims being the gate, while
`--probe` answers with a status. A version report on the bare listing would be a third question
answered by a command that has already said it is not answering the second.

**Alternatives considered.** *A supported range per adapter, refusing outside it* — rejected under
(a) and (b): it is the stale-table problem with teeth, and the cost lands on the adopter furthest
from the maintainer. *A minimum version only* — the same objection at half strength, and it still
requires deciding what happens below the minimum, which is a refusal nobody wants to own. *No
recorded version at all, and let `--probe`'s round-trip stand alone* — the status quo, and rejected
on the measurement that made this ticket: `docs/03-adapter-contract.md` has pinned its verification
table to Claude Code 2.1.220 and codex-cli 0.149.0 since 2026-08-22, this machine now runs 2.1.236
and 0.150.1, the gap widened twice in eleven days, and **nothing noticed either time**. A number in
prose that no code reads is a number nobody maintains. *Branching on the version to keep an older CLI
working* — rejected under (c) as a separate decision with a much larger case to make.

**Why.** Q-0047 shipped the per-adapter capabilities modules and deliberately not the probe
`docs/04-architecture.md:62` asks for in the same sentence, because moving flag names into data is
layout while a probe adds an invocation, a datum that goes stale, and a policy for disagreeing with
it — and *"The port preserves behaviour"* (2026-08-25) routes behaviour through an entry accepted
**before** implementation. `developer-generalist` may not write `docs/decisions/`, so this is the
work no step on Q-0067's route can perform, and it lands before that run rather than inside it. This
repository has recorded sixteen appearances of a loop handed work no agent in it can do; Q-0062's own
requirement named the hazard in advance and the run was launched anyway, at three implement rounds.
