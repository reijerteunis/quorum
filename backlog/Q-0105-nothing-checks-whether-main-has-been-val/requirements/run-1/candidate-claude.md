# Q-0105 — Nothing checks whether `main` has been validated by CI

*Requirement, candidate (claude), 2026-09-06. Surface: **CLI** (`quorum board`), plus `packages/core`,
`packages/shared` and the documents that describe what the board shows. Written against the tree at
`3cf03ca`; every figure below was measured today rather than inherited, and where it contradicts the
ticket body the measurement is named.*

---

## 0. What was re-measured, and what moved

The ticket body is unusually well evidenced and three of its claims still moved when checked. Two of
the three change the shape of the work.

**M-1 — `main` is 2 commits ahead of `origin/main` right now, not level.** The body's 2026-09-06
correction says *"`main` is **level with `origin/main`** as of this writing"*. Measured at
`3cf03ca`: `git rev-list --count main@{upstream}..main` → **2**, and both commits (`385930b`,
`3cf03ca`) landed the same day, after that sentence was written. This is **evidence for the ticket,
not against the body**: the lag re-accumulated to two within hours of being recorded as zero, with
nobody noticing, which is the subject stated as a measurement instead of as a story. It also means
the requirement must not be written as if the zero were the normal state — a lag is the default and
zero is the exception.

**M-2 — the remote-tracking ref is itself stale, and the direction of that error is the safe one.**
`.git/FETCH_HEAD` was last written **2026-09-05 11:31**, over a day before this board rendered. So
anything derived locally is *"as of the last fetch"*. The asymmetry matters and must be stated in
the rendered sentence: a `git push` updates the tracking ref locally, so for the maintainer's own
commits the count is exact; absent a fetch the count can only **over**-report (someone else pushing
your commits), never under-report, except where a remote has moved backwards. The instrument fails
in the direction of saying *more* work is unvalidated than is, which is the correct direction for a
warning and the wrong direction for a claim of safety — so it may warn and may never reassure.

**M-3 — OQ-1's third candidate is not merely undesirable; it is refused by a documented principle,
and the document says so verbatim.** `docs/04-architecture.md` principle 1: *"**`core` has no I/O it
doesn't own.** It spawns CLIs, reads/writes the project folder and git. **It never touches the
network**, never stores secrets, never reads API keys."* Asking *"does `HEAD` have a CI conclusion?"*
is a network call against a named service. Independently: `grep -rn "refs/remotes\|@{upstream}\|'origin'\|ls-remote"`
over `packages/core/src`, `packages/cli/src` and `packages/shared/src`, excluding tests, returns
**0 hits** — no production file in this repository has ever known that a remote exists. Whatever
lands here is the first, which is the reason a decision entry is owed (§6, GO-1) rather than a
matter of taste.

**M-4 — the body's option 3 is refuted more sharply than the body refutes it, by one sentence.**
*A check that runs in CI cannot detect that CI never ran.* A second script in `.github/scripts/`
executes only in the runs that already happened; the gap is, by construction, on the local side. The
instrument must be one a maintainer meets **without** pushing, which is what makes option 1 the only
live candidate rather than merely the cheapest.

**M-5 — one git spawn answers the question, and the obvious atom is the wrong one.** `git for-each-ref
--format='%(upstream)' refs/heads/<base>` answers whether an upstream exists and names it, returning
an **empty string** rather than failing when there is none. `%(ahead-behind:<ref>)` (git ≥ 2.41; this
machine is 2.55) prints `2 0` but **fatals the whole command** on a missing ref — a per-ref atom that
kills the invocation is unusable for a board that must exit 0. `%(upstream:track)` prints `[ahead 2]`;
its locale-stability **could not be established on this machine** (this git build carries no
translations, so `LC_ALL=de_DE.UTF-8` and `fr_FR.UTF-8` both returned the English string — that is a
failure to refute, not a proof), so the requirement does not depend on parsing it. The shape that is
locale-proof by construction is the one `containment` already uses: probe for existence, then count
with `git rev-list --count`, which emits an integer under every locale.

---

## 1. Problem

`main` stood **89 commits and four days** ahead of `origin/main`, so nothing in the whole CLI cut —
Q-0090 to Q-0101 — had been validated anywhere but on one laptop. When it was finally pushed, three
of seven CI jobs failed on a packed-install break that had been on `main` for three days, on the
cold-clone path M6 turns on. Both defects had passed implement, cross-vendor review, `integrate` and
a hand verification.

The cost is not that CI was red. The cost is that **four documents said a path worked when it did
not** — Q-0098's and Q-0093's plan entries each record the packed path as *"verified end to end after
the gate"*, and both verifications were local. Q-0073 recorded the same gap at 15 commits and left it
as a caveat on one table's row. A caveat nobody converts into a check is how a measurement becomes
folklore, and this is the third time the question has been asked.

`quorum board` answers *"what is open, and where is the code?"* for every ticket, deriving containment
from git on every invocation and storing nothing. It says `main:contained` about a branch while
saying nothing at all about whether `main` itself has ever left the machine. It is answering half its
own question.

---

## 2. User stories

**Maintainer.** As the **solo maintainer**, I want `quorum board` — the surface I already read before
every ticket — to tell me when the base branch holds commits that have never left this machine, so
that I stop writing *"verified end to end"* about a path only my laptop has seen. I do not want it to
tell me anything it cannot prove, because a reassuring line I have learned to trust is worse than no
line at all.

**Adopter.** As a **cold-clone adopter**, I want the board in my own repository — which may have no
remote, or a remote I push to daily — to be **byte-identical to what it prints today** unless it has
something true and unusual to say, so that nothing new appears in my first 30 minutes and no line
implies that this tool expects a CI service I may not use.

**Contributor.** N/a, stated rather than omitted: an adapter or flow-template contributor never
reaches this surface, and no adapter contract, event or trace shape changes.

---

## 3. Recommended shape

One repository-level fact, derived from git on every board invocation and stored nowhere — the same
kind of fact as containment, computed the same way, under the same rules. Rendered as **at most one
dim line**, in the position the board's two existing legends already occupy, and printed only when
git has something to say.

The vocabulary is **push lag**: how many commits the configured base branch holds that its upstream
does not. It is a strictly weaker claim than *"CI has validated this"* and the requirement's central
constraint is that the rendered sentence must never be read as the stronger one. §4 AC-7 is what
enforces that, and it is the criterion this ticket lives or dies on.

Five outcomes, one line at most:

| git answered | rendered |
| --- | --- |
| base is level with its upstream | **nothing** |
| repository has no remotes at all | **nothing** |
| base is *n* commits ahead of its upstream | one line naming base, upstream and *n* |
| base resolves, repository has a remote, base tracks nothing | one line saying the board cannot tell |
| the probe failed, or this is not a git work tree | one line saying the board cannot tell, with git's own detail |

**Silence means git answered and there is nothing to report. Anything unanswerable prints.** That
asymmetry is the whole design: it is *"a check that skips its subject must not report success"*
(2026-08-25) applied to an instrument whose "success" output is silence, and it is the difference
between this and a line that quietly stops working the day someone's `.git/config` changes.

---

## 4. Acceptance criteria

Numbered, independently testable. Each names its surface.

**AC-1 — `core` gains exactly one exported function, in the one file that owns git.**
`packages/core/src/git/git.ts` exports a function answering push lag for a named base branch. It
lives there for the reason that file exists — *"every git call in `core` goes through one runner"*,
which is why Q-0093 put `currentBranch` there rather than in `backlog/scaffold.ts` — and a probe
spelled in `board.ts` or anywhere else in `packages/cli` fails this criterion. It reaches
`@quorum/core`'s public surface through the barrel, because the board is outside the package.

**AC-2 — the result is a closed discriminated union declared in `packages/shared`, never a number
and never `null`.** Beside `ContainmentResult` in `packages/shared/src/containment.ts` or a sibling
module, with a `const … as const` reason list in the shape of `CONTAINMENT_REASONS`, so the rendered
vocabulary is closed and a new reason is a visible act. `core` imports the type and declares none of
its own (`04-architecture.md`). A shape that returns a bare `number | null` fails: it makes "level"
and "could not ask" the same value, which is the defect AC-3 forbids.

**AC-3 — the state is selected from git's own answers and is never inferred from a failure, and an
unanswerable probe is never rendered as level.** Decision *"Containment is derived from git on each
board invocation, never stored"* (2026-08-24) rule 1, arriving at a second fact. Demonstrated by
mutation rather than by reading: an implementation in which a failed probe falls through to the
level state must turn a named test red, and the implement report records the mutation and the
message it produced.

**AC-4 — the command reads and never writes, and specifically never fetches.** After `quorum board`,
`git for-each-ref` output is byte-identical to before it (the assertion `board.test.ts` AC-5 C1
already makes for containment), **and** `.git/FETCH_HEAD` is unchanged — present with the same mtime
and bytes, or absent and still absent. That second clause is what proves no network call was made,
and it is a stronger and cheaper check than auditing the source for a `fetch` verb. Additionally: no
git argv this module can issue contains `fetch`, `ls-remote`, `push` or `remote update`.

**AC-5 — the base branch and the remote name both come from data, never from a literal.** The base is
`repo.base_branch` from `harness.yaml`, matched the way `containment` matches it — as a value in an
argv array, never assembled into a shell string, on the precedent of `board.test.ts` C8's
injection-shaped branch value. The remote name is read out of git's answer: the string `origin` does
not appear as a literal in the new source. A `master`-based fixture with an upstream renders `master`
and the string `main` appears nowhere in the output, which is C7's shape.

**AC-6 — the board prints at most one new line, dim, after the two existing legends, and only when
it earned one.** The five rows of §3's table are five tests. The two silent rows assert the output is
**byte-identical** to the same fixture rendered by the current binary, so "prints nothing" is claimed
rather than approximated.

**AC-7 — the sentence claims what it can prove, and no word of it can be read as a claim about
testing.** It names the base branch, its upstream and the count, and it is about commits **not having
been pushed**. The rendered line contains none of: `CI`, `validated`, `verified`, `tested`, `green`,
`build`, `GitHub`, `Actions`, `pipeline`. Asserted as a forbidden-substring list over the rendered
output, in the shape `end-to-end.test.ts`'s binary-name table already uses — a positive pin and a
negative one, because a line naming nothing would satisfy a positive assertion alone. *This is the
criterion the ticket exists for*: the failure being fixed is four documents claiming a path worked,
and a board line that implies validation is that same failure wearing a fix's clothes. The board says
**contained** and never "merged" or "shipped"; by the same rule it says **not pushed** and never
"unvalidated".

**AC-8 — the sentence carries its own freshness limit.** It says, in words, that the answer is as of
the last fetch. Measured ground: this repository's tracking ref was **over a day stale** while the
board rendered (M-2). A line that reads as a live fact about a remote is false on a machine that has
not fetched since Tuesday.

**AC-9 — no ticket row changes, byte for byte.** `board.test.ts` AC-4 C3's pinned line —
`'  T-0001 Board fixture  owner=qa cost=$0.00 iter={}'` — passes **unedited**, and a test asserts the
new fact is not a row annotation. Push lag is one repository-level fact and a per-ticket token would
be the same string repeated on sixty rows; the pinned row is the mechanical reason as well as the
design one.

**AC-10 — the cold-clone path gains zero words.** A freshly initialised project with no remote prints
no new line, and `quorum init` followed by `quorum board` in such a repository produces output
byte-identical to today's. Quality pillar 7: a feature that lengthens a newcomer's first 30 minutes
needs a reason, and this one has none to offer an adopter who has not pushed anything yet.

**AC-11 — the four landed pins move as registers, each shown red against the value it replaces.**
Measured, they fail closed and will stop the run, which is them working:
  1. `packages/core/src/git/git.source.test.ts` AC-1 pins the module's exports at **exactly ten**
     names; it becomes eleven.
  2. The companion test in that file asserts the pin **moved rather than widened** by refusing the
     previous nine-name list; it is re-aimed at the ten-name list and shown to refuse it. A `toContain`
     substituted for the `toEqual` fails this criterion — *"a count is not an identity"* (Q-0073).
  3. The same file pins the barrel's contribution from `git/` at exactly `['containment']`; it becomes
     two names, and `containment` staying *"the only name here a consumer outside the package may
     reach"* stops being true, so its comment moves with it.
  4. `containment`'s JSDoc pins the spawn budget at *"at most 2n + 3"* for a board of n tickets. The
     new probe costs **at most two more, constant in n**, and the budget sentence says so.
  Per *"A check outlives its subject only if it can still fail"* (2026-09-05) class (c): updating the
  row is the act that records the choice.

**AC-12 — the documents that describe what the board shows move with it, in the same change.**
`docs/GLOSSARY.md` gains **push lag** in the shape `Containment`, `Event` and `Undecided` already use
— what it is, what it is derived from, and explicitly **what it is not**: not containment (a different
pair of refs answering a different question), not "behind", not "out of date", and *not a claim that
anything was built or tested*. `docs/README.md`'s term list gains it, which is the one place
`docs.test.ts` checks and which *"nothing else checks"* in its own words.
`docs/02-sdlc-pipeline-spec.md`'s board paragraph (§3.4, the `main:contained` sentence) and
`docs/04-architecture.md`'s `packages/cli` paragraph each gain a sentence, and every edited numbered
document's status line records `Q-0105` and the landing date.

**AC-13 — every new assertion is demonstrated red before green, by mutation, and the implement report
carries the mutation and the message.** Not a style note: this repository has found five assertions
that could not fail in one ticket (Q-0050), a guard blind to three spellings of its subject (Q-0062),
a negative check that started passing the moment a file moved (Q-0088) and a counter reading `n >= 0`
(Q-0101). A guard shown red by its *neighbour* has not been established (Q-0107).

**AC-14 — `quorum board` still exits 0 in all five outcomes, including where git failed.** It is one
of *"the two commands that can only exit 0"* (Q-0099), and an instrument that starts failing the
command it annotates has replaced a silent gap with a loud one.

---

## 5. Non-goals

- **Any query of a CI service, and any network call at all.** Refused on `04-architecture.md`
  principle 1 (M-3), not deferred. This includes `gh`, the GitHub API, and any code path that reads a
  stored credential — a read-only local command acquiring a network credential is a boundary this
  repository has not crossed and should not cross in passing.
- **Fixing Q-0104 or Q-0102.** Both are already dealt with; this ticket is about why nobody knew.
- **Pushing, or making a push a precondition of anything.** A push is an outward-facing act and stays
  the human's, which is the same principle as the human gate. This ticket reports a fact; it does not
  act on one, does not block a run, and adds no gate.
- **Any stored field, cache or config key.** No `ticket.md` frontmatter, nothing under `.quorum/`, and
  **no new `harness.yaml` key** — a key would drag in `projectConfigSchema`, the template, the
  undeclared-key guard in `project.test.ts` and a snake_case-versus-camelCase ruling, to make
  configurable a line nobody has yet found noisy. If OQ-4 decides a threshold is wanted, it is a
  constant with a stated reason, not a key.
- **Per-ticket push lag.** Ticket branches are local by construction; `harness/*` is never pushed.
- **Any change to what the git-identity sweep runs** (Q-0102 GO-2 applies here unchanged).
- **A git hook.** Hooks are not versioned into a clone, fire on the wrong event (commit, not read),
  and nag rather than inform.
- **Reporting the lag at a gate (the body's option 2).** Deferred rather than refused, and §7 OQ-6
  says why one instrument at a time is the right call.
- **`apps/web` and the M3 board.** M3's backlog board will want the same fact; nothing here prevents
  that, and nothing here builds it.

---

## 6. Gate obligations

Work that must happen **at the requirements gate, by the human, before a chore run is launched**.
Each is here because no step on the chore route can perform it — the pattern this repository has now
recorded **fifteen** times, and where the only case that cost nothing (Q-0102) is the one where it was
recognised before the money was spent.

**GO-1 — a decision entry is owed before the first implement round, and it is the human's to write.**
`harness/roles/developer-generalist.md` says, in as many words: *"You do not add to `docs/decisions/`
or its index; a decision is the human's to record."* The entry must rule three things, and the third
is the one an implementer would otherwise decide by accident:
  1. **What fact the board reports** — push lag from git, not a CI conclusion (OQ-1), with M-3's
     principle-1 measurement as the ground rather than a preference.
  2. **That this belongs to the product rather than to this repository** (OQ-2) — a push-lag column
     assumes only a git remote, names no CI service, and needs no network, so it does not leak product
     knowledge into a product-agnostic tool. This is the first time any production file here learns
     that a remote exists (M-3), which is why it is an entry and not a code comment.
  3. **The noise threshold** (OQ-4) — whether the line prints at any lag ≥ 1 or past a floor. The
     generalist's own role text forbids it choosing: *"an unrequested default is a decision taken on
     someone else's behalf"*, and *"a chore's defaults propagate into every ticket that comes after
     it"*.

  **The precedent is exact and expensive.** Q-0062's requirement named this hazard in advance — GO-1
  said the entry must exist before the implement step ran — and the run was launched without it;
  rounds 1 to 3 went entirely on a blocker no agent on the route could clear, round 2 responding to it
  by adding a *sixth* citation of the absent entry. Q-0052 is the same shape reached through a review
  loop, and Q-0083 (an implement step that can return `blocked`) is still the mechanism owed. Launching
  this ticket without the entry is the sixteenth appearance, and it is avoidable for the cost of
  writing one file.

**GO-2 — `CLAUDE.md`'s term list is the human's, and nothing checks it.** AC-12 adds a glossary term.
`CLAUDE.md:13` carries the same list, Q-0103's erratum E-2 ruled that file *"stays the human's, being
the vendor dialect of the canonical harness"*, and it is outside `developer-generalist`'s paths.
Measured: **no test in `packages/` reads `CLAUDE.md`**, so this will be missed silently rather than
caught. The human adds the term to that list at the gate.

**GO-3 — push the merge and watch CI go green before this ticket is closed.** Every other ticket can
be closed on a local verification. This one cannot without refuting itself: a fix for *"nothing
notices that `main` was never validated"* that lands on an unpushed `main` is the defect closing its
own ticket. The run's `integrate` tick and both suites forced on `main` after the merge are necessary
and, uniquely here, not sufficient.

---

## 7. Open questions

Owner is the human at the requirements gate unless stated. The first three are the body's, answered
with measurements; the last three are new.

- **OQ-1 — what fact is reported?** *Recommended: push lag, in commits, derived from git.* Ground:
  M-3. The body called the CI-conclusion candidate *"the one that matters"*; it is, and it is also the
  one that would put a network call inside a command whose package principle 1 forbids from making
  one, would answer differently minutes apart at one tree, would fail offline and on a fork, and would
  need a credential. Push lag is a proxy, and it is **sufficient for the incident that opened this
  ticket**: at 89 commits it would have printed on every invocation for four days. Not a blocker, but
  GO-1's entry states it.
- **OQ-2 — product or this repository?** *Recommended: the product.* Falls out of OQ-1 exactly as the
  body predicted. A remote is a git concept; GitHub Actions is not. Nothing in the deliverable names a
  CI service, and an adopter with no remote sees no change (AC-10).
- **OQ-3 — M2 or M6?** *Recommended: M2*, where `docs/06-development-plan.md` already files it. The
  board exists, the change is small (§9), and the gap is what let a broken installation path sit for
  three days on the path M6 turns on. Deferring it to M6 means the instrument arrives after the
  interval it exists to protect.
- **OQ-4 — at what lag does the line print? BLOCKER for GO-1's entry.** At any lag ≥ 1 it will print
  on nearly every invocation, because a maintainer commits far more often than they push — measured,
  `main` is ahead 2 today and was ahead 89 last week, and I could not find a working day this month
  on which it would have been silent. See R-1: a line that always prints is a line that stops being
  read, which is Q-0102's surviving p1 half arriving on the fix rather than on the sweep. The
  alternatives are a commit floor, an age floor (the body measured *"4 days"* as a candidate), or
  accepting that it always prints on the argument that it is one dim line among two.
- **OQ-5 — does "a remote exists but the base tracks nothing" print?** *Recommended: yes*, as an
  explicit cannot-say line. It is the state that most resembles the incident — a base branch nothing
  is watching — and it is rare enough not to be noise. The counter-argument is that a maintainer who
  has deliberately untracked their base does not want telling twice.
- **OQ-6 — does `quorum board`'s help line change?** `commands.ts:66` reads *"kanban of tickets by
  stage, and where each ticket's code is"*. *Recommended: leave it*, with the reason recorded in
  place — the help line glosses containment rather than naming it, `commands.ts` is a frame module
  which *"may name none of `core`'s domain helpers"*, and the new line is self-describing where it
  prints. An implementer that changes it must not name a domain symbol and must not disturb the help
  table's column layout.

---

## 8. Risks

- **R-1 — the line becomes noise and is trained away, which would leave the gap open and the ticket
  closed.** The strongest argument against the whole ticket, and it is stated here rather than
  discovered at review. Q-0102's surviving `p1` half is that *a flaky oracle trains the reader to
  re-run until green*; a board line that prints on every invocation trains the reader to skip the
  last two lines of the board. Mitigation is OQ-4's threshold plus AC-7's wording — a line that says
  something specific and unusual survives; a line that says "you have unpushed work" every morning
  does not.
- **R-2 — over-reporting after somebody else pushes your commits.** Needs a fetch to resolve, and the
  direction of the error is safe (M-2): it warns too much, never too little.
- **R-3 — the tracking ref is stale and the line reads as live.** Closed by AC-8, and only by AC-8.
- **R-4 — scope creep into a CI-status feature.** The `gh` CLI is installed on this machine and the
  five-line version of this feature that shells out to it is genuinely tempting. §5 refuses it and
  M-3 gives the ground; an implementer that reaches for it should stop and report, per its own role
  text.
- **R-5 — the four landed pins are edited to fit rather than moved as registers.** AC-11 exists
  because this is what happens by default, and because two of the four are in a file whose own
  companion test was written to catch exactly that.
- **R-6 — the fix ships unvalidated.** Closed by GO-3, and only by GO-3.
- **R-7 — what this does not close, stated so it is not later mistaken for closed.** Push lag catches
  *"these commits have never left this machine"*. It does **not** catch: pushed but CI red; pushed but
  no CI configured; pushed to a branch nobody merged; or a green tick replayed from a cache
  (Q-0071's subject, closed separately). It would have caught the incident that opened this ticket,
  and it would not have caught a variant where the same code had been pushed and CI had been red for
  three days. Any future document claiming this ticket made the base branch "validated" is repeating
  the failure it was opened for.

---

## 9. Cross-cutting checklist

| | |
| --- | --- |
| **BYOS** | N/a to the recommended shape, and load-bearing against the refused one: no credential, no token, no authenticated call anywhere on this path. Refusing the CI-conclusion candidate keeps it that way. |
| **Worktree safety** | The command writes nothing, moves no ref, creates no worktree and makes no network call — asserted by AC-4 rather than assumed, including the `.git/FETCH_HEAD` clause that proves no fetch. |
| **Gate behaviour** | Unchanged. No gate is added, none is answered differently, and no run is blocked. Reporting at a gate is a non-goal (OQ-6). |
| **File format and schema** | **Nothing is stored** — no frontmatter field, no `.quorum/` cache, no `harness.yaml` key, no schema change. This is decision 041's central property applied to a second fact: a persisted copy of a git fact drifts the first time someone pushes by hand, and a wrong field is believed. The one new type is a `packages/shared` union with a closed reason list (AC-2). |
| **Lint rules** | N/a. No flow file changes, so `harness lint` is untouched and no `flow.test.ts` guard moves. |
| **Cold-clone impact** | **Zero words added** to the first 30 minutes, asserted by AC-10: a repository with no remote, and one whose base is level with its upstream, both render byte-identically to today. |
| **Vocabulary** | One new term, **push lag**, defined in `GLOSSARY.md` with what it is not (AC-12); `docs/README.md`'s list moves with it; `CLAUDE.md`'s list is GO-2's. No synonym is introduced for containment, and the board never says "unvalidated", "behind" or "out of date". |
| **Product-agnostic** | No CI service, no vendor, no product is named. The remote's name comes out of git (AC-5). |

---

## 10. Size, and what an implementer should expect

Small, and the effort is not where it looks. One function in `packages/core/src/git/git.ts`, one
union in `packages/shared`, one barrel entry, roughly ten lines in `packages/cli/src/board.ts`
beside the two existing legends, and four documents. The work that will take the time is **AC-11's
four pins** — each must be moved as a register and shown refusing the value it replaces — and
**AC-13's mutations**, because five of the last six chore reviews could not execute the suite under
`--sandbox read-only`, so an assertion this ticket adds is established by demonstration or it is not
established at all.

If GO-1's entry is in place before the run, this is a one-round chore. If it is not, the first three
rounds will be spent on a blocker no step on the route can clear, which is what the fifteen recorded
instances all look like from inside.
