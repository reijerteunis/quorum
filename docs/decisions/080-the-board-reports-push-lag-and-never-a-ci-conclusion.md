# The board reports push lag, and never a CI conclusion — 2026-09-06

**Decision:** `quorum board` reports one repository-level fact beside the per-ticket containment it
already derives: **push lag**, the number of commits the configured base branch holds that its
configured upstream tracking ref does not. It is read from git at the moment of rendering and
persisted nowhere. Three things are ruled here, because Q-0105 cannot start without them and none is
a step's to settle.

**(a) It is a git fact, and the product never claims a CI conclusion.** `docs/04-architecture.md`
principle 1 is verbatim, its emphasis its own: *"**`core` has no I/O it doesn't own.** It spawns
CLIs, reads/writes the project folder and git. It never touches the network, never stores secrets,
never reads API keys."* Asking *"has CI run this commit?"* is a network call against a named service, so it is
refused before preference enters. The measurement behind that: a grep for `refs/remotes`,
`@{upstream}`, `ls-remote` and `'origin'` over `packages/*/src` with tests excluded returns **nothing
at all** across 63 production files — no production code in this repository has ever known that a
remote exists, and Q-0105's is the first that will.

The consequence is a rule about what silence means, and it is the load-bearing half. A `git push`
updates the tracking ref locally, so for the maintainer's own commits the count is exact; absent a
fetch it can **over**-report and never under-report, except where a remote moved backwards. **The
instrument may therefore warn and may never reassure.** Silence means only *git answered and there is
nothing to say* — never *this was validated*. No rendered state, legend or help text may use wording
equivalent to "CI passed", "CI failed", "validated" or "not validated", and a future document
claiming this made the base branch validated is repeating the failure the ticket was opened for.

**(b) It belongs to the product, not to this repository.** A push-lag line assumes only a **git
remote**, which is a git concept; GitHub Actions is not. Nothing in the deliverable names a CI
service, nothing makes a network call, and an adopter with no remote configured sees no change at
all. `.claude/rules/product-boundaries.md` forbids product knowledge leaking into the tool; a column
that assumed a CI service would be exactly that, and one that assumes a tracking ref is not.

**(c) The line prints at lag ≥ 1.** No higher threshold survives the incident that opened the
ticket. Q-0104's defect landed in `68a83f0` on 2026-09-02, the last CI run was `729dcb3` on
2026-09-01, and it was broken for **three days** — so the four-day age floor the ticket body offered
prints nothing for the entire life of that break. An age oracle additionally makes a fixture's
verdict a function of the clock rather than of the commit, which *"A test's verdict is a property of
the commit, not of the checkout or the account"* (2026-08-30) refuses. A commit floor is a constant
nobody can justify and that every adopter's cadence would have to re-derive. The threshold is a
ruling with an escape hatch rather than a silent default, because R-1 is real: a line that prints
every morning is trained away, which is Q-0102's surviving half arriving on the fix rather than on
the sweep. What answers R-1 is that this line **clears when you push** — a state indicator that ends
when you act, not a warning that repeats.

**This extends *"Containment is derived from git on each board invocation, never stored"*
(2026-08-24), and does not contradict it.** Every rule of that entry is carried unchanged: derive on
each invocation, persist nothing, select the state from a closed set, and never render an
indeterminate result as either of the other two. What is new is only the subject. That entry's rules
answer *where is a ticket branch relative to the base*; this one answers *where is the base relative
to its upstream* — a second fact under the same rules rather than a second way of doing it, and it is
recorded because an extension nobody records reads later as a contradiction.

**Two standing rules for reading git come out of this ticket, recorded so nobody re-derives them.**

1. **Probe for existence, then count.** `%(upstream)` returns the empty string rather than failing
   when a branch tracks nothing, so it is a probe; `git rev-list --count` emits an integer under
   every locale, so it is a counter. **A per-ref atom that can fatal the whole invocation is
   unusable in a command that must exit 0** — measured on git 2.55.0, `%(ahead-behind:<missing ref>)`
   prints `fatal: failed to find …` and yields no per-ref line, killing the entire `for-each-ref`,
   and `git rev-list --count <missing>..HEAD` exits 128. `%(upstream:track)` prints `[ahead 2]` and
   its locale-stability **could not be established** here rather than being proven — this git build
   carries no translations, so a German locale returned the English string, which is a failure to
   refute and not a proof. Nothing depends on parsing it.
2. **`core` answers; the surface decides whether the answer is worth printing.**
   `packages/shared/src/containment.ts` already states this for `no branch` — *"Whether it is worth
   rendering is the board's call and not this vocabulary's."* The state set is therefore complete and
   the rendering table separate, which is what lets *"a repository with no remotes at all"* be a
   first-class state that renders nothing.

**Alternatives considered:** **Query the CI service.** The `gh` CLI is on this machine and a
five-line version is genuinely tempting; refused by principle 1, and independently by the test rule —
*"has CI run this commit?"* is a property of a remote service at a moment in time, so an assertion
about it would need the network, fail offline, fail on a fork, and answer differently minutes apart
at one unchanged tree. **A second script in `.github/scripts/` beside the sweep**, refuted by one
sentence: *a check that runs in CI cannot detect that CI never ran* — the gap is by construction on
the local side, and the instrument must be one a maintainer meets **without** pushing. **Reporting
the fact at a chore run's human gate** rather than on the board — defensible, a gate being where a
human decides, but two instruments for one fact means two places to keep honest and the board costs
nothing to consult; deferred rather than rejected. **An age floor or a commit floor** — (c). **A
stored field or a cache under `.quorum/`** — the same drift the 2026-08-24 entry rejected for
containment, and wrong here for the same reason: a copy of a git fact held in mutable state is
believed after it stops being true. **Recording the gap as accepted and shipping no code** — live at
the requirements gate and not argued away; rejected because Q-0073 recorded this exact gap at **15
commits** and left it as a caveat on one table's row, and it reached **89**. A caveat nobody converts
into a check is how a measurement becomes folklore.

**Why:** `main` stood 89 commits and four days ahead of `origin/main`, so nothing that month had been
validated by CI — the whole CLI cut, Q-0090 to Q-0101. What that hid was not merely a red build:
Q-0104's packed-install break had **never run on CI**, was broken on a clean machine for three days
on the cold-clone path M6 turns on, and had passed implement, cross-vendor review, `integrate` **and**
a hand verification. The cost is that **four documents said a path worked when it did not**, two of
them entries on the development plan. The ticket then demonstrated its own subject while its
requirements run was executing: the body had been corrected that morning to say `main` was level with
`origin/main`, and the run measured it **2 commits ahead** — commits written hours earlier by the
session doing the correcting, unnoticed. A lag is the normal state and zero is the exception, and an
instrument designed the other way round would be silent when it mattered.

**What this does not close, stated so it is not later mistaken for closed.** Push lag catches *these
commits have never left this machine*. It does not catch: pushed but CI red; pushed but no CI
configured; pushed to a branch nobody merged; or a green tick replayed from a cache, which is
Q-0071's subject and closed separately. It would have caught the incident that opened Q-0105, and it
would not have caught a variant in which the same code had been pushed and CI had been red for three
days. Q-0105.
