# Q-0105 — Nothing checks whether `main` has been validated by CI

*Merged requirement, run 1, iteration 1, 2026-09-06. Surface: **CLI** (`quorum board`), plus
`packages/core`, `packages/shared` and the documents that describe what the board shows. Written
against the tree at `3cf03ca`. Every figure below was measured today; where a measurement
contradicts the ticket body, a candidate, or this repository's own plan, the measurement is named
and the contradicted sentence is quoted.*

**Verdict: needs-input.** Three blockers, in §7. Each carries a recommendation, so the gate's work is
to ratify or overrule rather than to decide from nothing.

---

## 0. What was re-measured, and what moved

Six of the two candidates' and the ticket body's claims moved when checked. Four of them change the
shape of the work, and one of them decides between the candidates outright.

**M-1 — `main` is 2 commits ahead of `origin/main` right now, not level.** The body's 2026-09-06
correction says *"`main` is **level with `origin/main`** as of this writing"*. Measured:
`git rev-list --count main@{upstream}..main` → **2**; `git status -sb` → `## main...origin/main
[ahead 2]`; both commits (`385930b`, `3cf03ca`) landed after that sentence was written. This is
evidence **for** the ticket rather than against the body — the lag re-accumulated within hours of
being recorded as zero and nobody noticed, which is the subject stated as a measurement instead of a
story. The consequence for the requirement is that **a lag is the normal state and zero is the
exception**, which is what makes §7 B-2 a blocker rather than a preference.

**M-2 — the tracking ref is itself stale, and the direction of that error is the safe one.**
`.git/FETCH_HEAD` was last written **2026-09-05 11:31**, over a day before this document. Anything
derived locally is therefore *"as of the last fetch"*. The asymmetry is load-bearing and must reach
the rendered sentence: a `git push` updates the tracking ref locally, so for the maintainer's own
commits the count is exact; absent a fetch the count can only **over**-report, never under-report,
except where a remote moved backwards. The instrument fails in the direction of claiming more work is
unpushed than is. **It may therefore warn and may never reassure** — which is the whole argument for
§3's rule that silence is only ever "git answered, and there is nothing to say".

**M-3 — the CI-conclusion candidate (OQ-1's third) is refused by a documented principle, verbatim.**
`docs/04-architecture.md:44`: *"**`core` has no I/O it doesn't own.** It spawns CLIs, reads/writes the
project folder and git. **It never touches the network**, never stores secrets, never reads API
keys."* Independently: `grep -rn --include='*.ts' -E "refs/remotes|@\{upstream\}|ls-remote|'origin'"`
over `packages/core/src`, `packages/cli/src` and `packages/shared/src`, tests excluded, returns
**one** hit — `git.ts:258`'s `for-each-ref … refs/heads`, which is about local branches. **No
production file in this repository has ever known that a remote exists.** Whatever lands here is the
first, which is why §6 GO-1 is owed rather than a matter of taste.

**M-4 — the decisive one: the codex candidate's rendering turns six landed assertions red, and the
claude candidate's survives all six unedited.** `board.test.ts`'s `projectFixture` runs `git init`
and **creates no remote** (`:72–84`), so every one of its scenarios is a repository with no upstream.
Under codex's AC-1/AC-3/AC-5 the board would print `main:push-current` or
`main:push-indeterminate(no upstream)` on every invocation, and these six assertions match on
`/main:|indeterminate/`:

| site | assertion |
| --- | --- |
| `:283` | C1 — `expect(out(result)).not.toMatch(/indeterminate/)` |
| `:318` | C3 — *"an unresolvable branch is unannotated, not indeterminate"* |
| `:323` | C3 — `not.toMatch(/main:\|indeterminate/)` |
| `:328` | C3 — `not.toMatch(/fatal:\|indeterminate/)` over an **empty backlog** |
| `:420` | C9 — a tag sharing the branch name |
| `:454` | C10 — a ticket with no `branch` key renders nothing |

Two further constraints fall out of the same file. `:476` counts the containment legend by
`out(result).split('git could not answer').length - 1 === 1`, so a push-lag legend reusing that
phrase double-counts it. And `:267` pins the ticket row byte for byte
(`'  T-0001 Board fixture  owner=qa cost=$0.00 iter={}'`). **This is not a preference between two
house styles: one candidate's design is red on the tree as written.** §3 takes the other.

**M-5 — `docs.test.ts`'s README pin does not catch the omission it looks like it catches.**
`docs.test.ts:486` is `expect(repoFile('docs/README.md')).toContain('build task, emitted artifact')`,
and `docs/README.md:32` ends that list with `emitted artifact)`. Appending a term after it keeps the
pin green. The claude candidate's AC-12 calls the README *"the one place `docs.test.ts` checks"* —
true, and the check is satisfied by a list that omits the new term, so **a new assertion is owed
rather than an edited one**. AC-13 says so.

**M-6 — one git spawn does not answer this, and the obvious atom is unusable.** Probed in a scratch
repository on this machine (git 2.55.0): `%(ahead-behind:<missing ref>)` prints
`fatal: failed to find 'refs/remotes/nope/main'` and yields no per-ref line, so **a single missing
ref kills the whole invocation** — unusable in a command that must exit 0. `git rev-list --count
<missing>..HEAD` exits **128**. `%(upstream)` returns the **empty string** rather than failing when a
branch tracks nothing, which is the probe. `%(upstream:track)` prints `[ahead 2]` and its
locale-stability **could not be established** here — this git build carries no translations, so
`LC_ALL=de_DE.UTF-8` returned the English string, which is a failure to refute and not a proof. The
shape that is locale-proof by construction is the one `containment` already uses: **probe for
existence, then count with `git rev-list --count`**, which emits an integer under every locale.

---

## 1. Problem

`main` stood **89 commits and four days** ahead of `origin/main`, so nothing in the whole CLI cut —
Q-0090 to Q-0101 — had been validated anywhere but on one laptop. When it was finally pushed, three
of seven CI jobs failed on a packed-install break that had been on `main` for three days, on the
cold-clone path M6 turns on.

The cost is not that CI was red. **The cost is that four documents said a path worked when it did
not** — Q-0098's and Q-0093's plan entries each record the packed path as *"verified end to end after
the gate"*, and both verifications were local. Q-0073 recorded the same gap at 15 commits and left it
as a caveat on one table's row. A caveat nobody converts into a check is how a measurement becomes
folklore, and this is the third time the question has been asked.

`quorum board` answers *"what is open, and where is the code?"*, deriving containment from git on
every invocation and storing nothing. It says `main:contained` about a branch while saying nothing at
all about whether `main` itself has ever left the machine. It is answering half its own question.

---

## 2. User stories

**Maintainer.** As the **solo maintainer**, I want `quorum board` — the surface I already read before
every ticket — to tell me when the base branch holds commits that have never left this machine, so
that I stop writing *"verified end to end"* about a path only my laptop has seen. I do not want it to
tell me anything it cannot prove, because a reassuring line I have learned to trust is worse than no
line at all.

**Adopter.** As a **cold-clone adopter**, I want the board in my own repository — which may have no
remote at all — to be **byte-identical to what it prints today** unless it has something true and
unusual to say, so that nothing new appears in my first 30 minutes and no line implies this tool
expects a CI service I may not use.

**Contributor.** N/a, stated rather than omitted: no adapter contract, event, trace shape or flow
file changes, so a contributor never reaches this surface.

---

## 3. Recommended shape

One repository-level fact, derived from git on every board invocation and stored nowhere — the same
kind of fact as containment, computed the same way, under the same rules. Rendered as **at most one
dim line**, in the position the board's two existing legends already occupy, and only when git has
something to say.

The vocabulary is **push lag**: how many commits the configured base branch holds that its upstream
does not. It is a strictly weaker claim than *"CI has validated this"*, and the requirement's central
constraint is that the rendered sentence must never be read as the stronger one (AC-9).

**The core function answers; the board decides whether the answer is worth printing.** That split is
not invented here — `packages/shared/src/containment.ts` already states it for `no branch`:
*"Whether it is worth rendering is the board's call and not this vocabulary's."* So the state set is
complete and the rendering table is separate:

| state from `core` | board renders |
| --- | --- |
| `pushed` — upstream holds everything the base does | **nothing** |
| `unpushed` — base holds *n* commits the upstream does not | one dim line naming base, upstream and *n* (subject to §7 B-2) |
| `indeterminate (no remote)` — the repository has no remotes at all | **nothing** |
| `indeterminate (no upstream)` — a remote exists, the base tracks nothing | one dim line saying the board cannot tell |
| `indeterminate (shallow clone)` — truncated history could understate the count | one dim line saying the board cannot tell |
| `indeterminate (git failed)` — the probe failed inside a work tree | one dim line saying the board cannot tell |
| not a git work tree | **nothing** — `containment` already returns `null` here and the board renders as it always did |

**Silence means git answered and there is nothing to report; anything unanswerable that is worth
saying prints.** That asymmetry is the design: it is *"a check that skips its subject must not report
success"* (2026-08-25) applied to an instrument whose success output is silence, and combined with
M-2 it is the rule that this line **may warn and may never reassure**.

Behind-only is `pushed`: a base with nothing waiting to be pushed has no push lag, whatever the
upstream has moved on to.

---

## 4. Acceptance criteria

Fourteen, numbered, each independently testable, each naming its surface.

**AC-1 — `core` gains exactly one exported function, in the one file that owns git, and it is a
second function rather than a member of `Containment`.** It lives in
`packages/core/src/git/git.ts` for the reason that file exists — every git call in `core` goes
through one runner, which is why Q-0093 put `currentBranch` there rather than in
`backlog/scaffold.ts` — and a probe spelled in `packages/cli/src/board.ts` fails this criterion. It
is **not** folded into `containment()`'s closure: that function returns `null` when `repoDir` is not
a work tree, so a fact folded into it would be unaskable exactly where the board would still want it,
and its documented scope is *"where a ticket's code actually is"*, which is a per-branch question
this fact does not ask. It reaches `@quorum/core`'s public surface through the barrel.

**AC-2 — the result is a closed discriminated union declared in `packages/shared`, never a number and
never `null`.** Beside `ContainmentResult` in `packages/shared/src/containment.ts` or a sibling
module, with a `const … as const` reason list in the shape of `CONTAINMENT_REASONS`, and with the
`?: never` members that already make the impossible combinations unrepresentable there — a `pushed`
result carries no count, an `unpushed` result carries a count and no reason, an `indeterminate` result
carries a reason from its own set and nothing else. `core` imports the type and declares none of its
own (`04-architecture.md`). A shape returning `number | null` fails: it makes *level* and *could not
ask* the same value, which is what AC-3 forbids. Sharing the strings `shallow clone` and `git failed`
with `CONTAINMENT_REASONS` while keeping the sets separate is correct and precedented —
`ANCESTRY_REASONS` and `CONTAINMENT_REASONS` already overlap on both.

**AC-3 — the state is selected from git's own answers and is never inferred from a failure.**
Decision *"Containment is derived from git on each board invocation, never stored"* (2026-08-24) rule
1, arriving at a second fact. A failed probe, an unresolvable ref, a shallow repository and an absent
upstream each reach their own reason and **none of them reaches `pushed`**. Demonstrated by mutation
rather than by reading: an implementation in which a failed probe falls through to `pushed` must turn
a named test red, and the implement report records the mutation and the message it produced.

**AC-4 — the command reads, never writes, and specifically never fetches.** After `quorum board`,
`git for-each-ref` output is byte-identical to before it and no file appears or vanishes — the
assertions `board.test.ts` C1 (`:274–292`) already makes for containment — **and** `.git/FETCH_HEAD`
is unchanged: present with the same bytes and mtime, or absent and still absent. That second clause
is what proves no network call was made, and it is stronger and cheaper than auditing the source for
a verb. Additionally: no git argv this module can issue contains `fetch`, `ls-remote`, `push` or
`remote`.

**AC-5 — the base branch and the remote both come from data, never from a literal, and no ref value
is interpolated into a command line.** The base is `repo.base_branch` from `harness.yaml`
(`harness/harness.yaml:22`, defaulting to `main` as `board.ts` already does). The upstream ref and
the remote name are read out of git's own answer; **the string `origin` appears in no new production
source**. Ref names originate outside Quorum, so they are passed as argv values through the existing
`execFileSync` runner and never assembled into a shell string, which `git.source.test.ts`'s AC-5
already pins for this file. Proven by a fixture whose base is `trunk` tracking a remote that is not
`origin`: both real names render and the strings `origin` and `main` appear nowhere in the output.

**AC-6 — the count is `<upstream>..<base>`, never the symmetric difference, and behind-only reports
nothing.** A fixture diverged by 2 local and 1 remote commit reports **2** and the output does not
contain `3` as a count — the discriminating shape `board.test.ts` C2 (`:294–305`) already uses for
containment. A base that is only behind its upstream renders nothing.

**AC-7 — the board prints at most one new dim line, after the two existing legends, and only when it
earned one.** The seven rows of §3's table are seven tests. The four silent rows assert the output is
**byte-identical** to the same fixture rendered by the current binary, so *"prints nothing"* is
claimed rather than approximated. One line however many facts are true, in the shape `board.test.ts`
C4 (`:461–478`) already asserts for the containment legend.

**AC-8 — no ticket row changes, and the new line cannot be mistaken for containment's vocabulary.**
`:267`'s pinned row passes **unedited**, and the six assertions M-4 lists — `:283`, `:318`, `:323`,
`:328`, `:420`, `:454` — pass unedited. Mechanically that requires the rendered line to contain
neither a `<base>:` token nor the word `indeterminate`; structurally it is required anyway, because
`indeterminate` is containment's closed vocabulary in `GLOSSARY.md` and a second fact borrowing it
makes both legends ambiguous. The line must also not contain the phrase `git could not answer`, which
`:476` counts to prove the containment legend prints exactly once. Push lag is one repository-level
fact and is never a per-ticket annotation.

**AC-9 — the sentence claims what it can prove, says what it cannot, and no word of it can be read as
a claim about testing.** It names the base branch, its upstream and the count; it is about commits
**not having been pushed**; and it states in words that the answer is **as of the last fetch** (M-2:
this repository's tracking ref was over a day stale while this board rendered, so a line reading as a
live fact about a remote is false on a machine that has not fetched since Tuesday). The rendered
output contains none of: `CI`, `validated`, `unvalidated`, `verified`, `tested`, `green`, `build`,
`GitHub`, `Actions`, `pipeline`. Asserted as a forbidden-substring list **and** a positive pin, in the
shape `end-to-end.test.ts:755`'s binary-name table already uses, because a line naming nothing would
satisfy a positive assertion alone. **This is the criterion the ticket exists for**: the failure being
fixed is four documents claiming a path worked, and a board line that implies validation is that same
failure wearing a fix's clothes. The board says *contained* and never "merged" or "shipped"; by the
same rule it says *not pushed* and never "unvalidated".

**AC-10 — the cold-clone path gains zero words.** `quorum init` followed by `quorum board` in a
freshly initialised project with no remote produces output byte-identical to today's. Quality pillar
7: a feature that lengthens a newcomer's first 30 minutes needs a reason, and this one has none to
offer an adopter who has not pushed anything yet.

**AC-11 — `quorum board` still exits 0 in every one of §3's outcomes, including where git failed.**
It is one of *"the two commands that can only exit 0"* (Q-0099), and an instrument that starts failing
the command it annotates has replaced a silent gap with a loud one.

**AC-12 — the four landed registers move as registers, each shown red against the value it
replaces.** Measured, they fail closed and will stop the run, which is them working:
  1. `packages/core/src/git/git.source.test.ts:36` pins the module's exports at **exactly ten** names;
     it becomes eleven.
  2. `:47` asserts that pin **moved rather than widened**, by refusing the previous nine-name list; it
     is re-aimed at the ten-name list and shown to refuse it. A `toContain` substituted for the
     `toEqual` fails this criterion — *"a count is not an identity"* (Q-0073).
  3. `:70` pins the barrel's contribution from `git/` at exactly `['containment']`; it becomes two
     names, and its comment — *"`containment` is … the only name here a consumer outside the package
     may reach"* — stops being true, so it moves with the pin.
  4. `containment`'s JSDoc pins the spawn budget at *"at most 2n + 3"* for a board of n tickets. The
     new probe's cost is **constant in n**, and the sentence states the new bound **measured rather
     than estimated**.
  Per *"A check outlives its subject only if it can still fail"* (2026-09-05): updating the row is the
  act that records the choice.

**AC-13 — the documents that describe what the board shows move in the same change.**
`docs/GLOSSARY.md` gains **push lag** in the shape `Containment`, `Event` and `Undecided` already use
— what it is, what it is derived from, and explicitly **what it is not**: not containment (a different
pair of refs answering a different question), not "behind", not "out of date", and **not a claim that
anything was built or tested**. `docs/README.md:32`'s term list gains it **under a new assertion**,
because `docs.test.ts:486` is a `toContain` of the previous tail and stays green over a list that
omits the term (M-5). `docs/02-sdlc-pipeline-spec.md:158` — the containment paragraph — and
`docs/04-architecture.md:70–72` — the `packages/cli` paragraph — each gain a sentence, and every
edited numbered document's status line records `Q-0105` and the landing date.

**AC-14 — every new assertion is demonstrated red before green by mutation, and every new fixture
builds its own repository, its own remote and its own identity.** The mutation and the message it
produced are recorded in the implement report; this is not a style note, because this repository has
found five assertions that could not fail in one ticket (Q-0050), a guard blind to three spellings of
its subject (Q-0062), a negative check that started passing the moment a file moved (Q-0088) and a
counter reading `n >= 0` (Q-0101), and because five of the last six chore reviews could not execute
the suite under `--sandbox read-only`. No test's verdict may depend on the invoking account, the
ambient git configuration, or a remote that already exists: every remote, ref and configuration value
used as an oracle is created by the test, and `-c user.email=…` / `-c user.name=…` are supplied **at
the call site** as `board.test.ts` already does, because `packages/core/src/git-identity.test.ts`
reads literals and a helper supplying them invisibly looks like a violation to the guard written to
find one (*"A test's verdict is a property of the commit, not of the checkout or the account"*,
2026-08-30).

---

## 5. Non-goals

- **Any query of a CI service, and any network call at all.** Refused on `04-architecture.md`
  principle 1 (M-3), not deferred. This includes `gh`, the GitHub API, and any path that reads a
  stored credential: a read-only local command acquiring a network credential is a boundary this
  repository has not crossed and must not cross in passing.
- **Fetching before calculating, or detecting that the tracking ref is stale.** AC-9's freshness
  sentence is the whole treatment.
- **Reporting the age of the oldest unpushed commit.** Measured as a candidate in OQ-1 and not taken:
  it is the incident's signature but it makes a fixture's verdict depend on the clock, and the count
  answers well enough. Named here so a later reader knows it was weighed.
- **Fixing Q-0104 or Q-0102.** Both are already dealt with; this ticket is about why nobody knew.
- **Pushing, prompting to push, or making a push a precondition of anything.** A push is an
  outward-facing act and stays the human's, which is the same principle as the human gate. This ticket
  reports a fact; it does not act on one, blocks no run, and adds no gate.
- **Any stored field, cache or config key.** No `ticket.md` frontmatter, nothing under `.quorum/`, and
  **no new `harness.yaml` key** — a key would drag in `projectConfigSchema`, the template, the
  undeclared-key guard in `project.test.ts` and a snake_case-versus-camelCase ruling, to make
  configurable a line nobody has yet found noisy. If B-2 rules that a threshold is wanted, it is a
  constant with a stated reason, not a key.
- **Per-ticket push lag.** Ticket branches are local by construction; `harness/*` is never pushed.
- **Changing `quorum board`'s help line.** `commands.ts:66` reads *"kanban of tickets by stage, and
  where each ticket's code is"*, and `04-architecture.md:72` already records why it glosses rather than
  enumerates. It also omits both existing legends, so omitting a third is consistent rather than an
  oversight. **This becomes reviewable only if B-2 rules the line unconditional**, and the dependency
  is stated here rather than left as a footnote.
- **A git hook.** Not versioned into a clone, fires on the wrong event, and nags rather than informs.
- **A second script in `.github/scripts/` (the body's option 3).** Refuted in one sentence: *a check
  that runs in CI cannot detect that CI never ran.* The gap is on the local side by construction, so
  the instrument must be one a maintainer meets **without** pushing.
- **Reporting at a gate (the body's option 2).** Deferred rather than refused; OQ-5 says why one
  instrument at a time is the right call.
- **Any new runtime dependency.** If the implementation appears to need one, it stops and reports.
- **Any change to what the git-identity sweep runs.** Q-0102's GO-2 applies here unchanged.
- **`apps/web` and the M3 board.** M3's backlog board will want the same fact; nothing here prevents
  that, and nothing here builds it.

---

## 6. Gate obligations

Work that must happen **at the requirements gate, by the human, before a chore run is launched**.
Each is here because no step on the chore route can perform it — the pattern this repository has now
recorded **fifteen** times, and where the only instance that cost nothing (Q-0102) is the one where it
was recognised before the money was spent.

**GO-1 — the decision entry is owed before the first implement round, and only the human may write
it.** `harness/roles/developer-generalist.md:26–27`, verbatim: *"You do not add to docs/decisions/ or
its index; a decision is the human's to record."* The entry rules the three things §7's blockers name.
**The precedent is exact and expensive**: Q-0062's requirement named this hazard in advance, the run
was launched without the entry, and rounds 1 to 3 went entirely on a blocker no agent on the route
could clear — round 2 responding by adding a *sixth* citation of the absent entry. Q-0083, an
implement step that can return `blocked`, is still the mechanism owed. Launching without the entry is
the sixteenth appearance, and it is avoidable for the cost of writing one file.

**GO-2 — `CLAUDE.md`'s term list is the human's, and nothing checks it.** AC-13 adds a glossary term
and `CLAUDE.md:13` carries the same list. Q-0103's erratum E-2 ruled that file *"stays the human's,
being the vendor dialect of the canonical harness"*, and it is outside `developer-generalist`'s
`paths:`. Measured: **no assertion in `packages/` reads that list**, so an omission is silent rather
than caught.

**GO-3 — push the merge and watch CI go green before this ticket is closed.** Every other ticket can
be closed on a local verification. This one cannot without refuting itself: a fix for *"nothing
notices that `main` was never validated"* that lands on an unpushed `main` is the defect closing its
own ticket. The run's `integrate` tick and both suites forced on `main` after the merge are necessary
and, uniquely here, **not sufficient**.

---

## 7. Open questions

Owner is the human at the requirements gate. **B-1 to B-3 block; OQ-4 to OQ-6 do not.**

### Blocking

**B-1 — the decision entry, and what it rules.** GO-1's mechanism; the three rulings are:
  1. **What fact the board reports** — push lag from git, not a CI conclusion. *Recommended: push
     lag*, on M-3's principle-1 measurement rather than on preference. The body called the
     CI-conclusion candidate *"the one that matters"*; it is, and it is also the one that would put a
     network call inside a command whose package principle forbids one, would answer differently
     minutes apart at one tree, would fail offline and on a fork, and would need a credential. Push
     lag is a proxy, and it is **sufficient for the incident that opened this ticket**: at 89 commits
     it would have printed on every invocation for four days.
  2. **That this is the product's rather than this repository's** — see B-3.
  3. **The print threshold** — see B-2.
  It also names decision *"Containment is derived from git on each board invocation, never stored"*
  (2026-08-24) as the entry it extends, since this is a second fact under that entry's rules, and an
  extension nobody records reads later as a contradiction.

**B-2 — at what lag does the line print?** *Recommended: at any lag ≥ 1, one dim line.* This is the
blocker that most changes what ships, and the implementer is **forbidden** to settle it:
`developer-generalist.md:14–15` says *"an unrequested default is a decision taken on someone else's
behalf. Where the requirement does not cover a case, you stop."* Measured (M-1): `main` is ahead 2
today and was ahead 89 last week, and there is no working day this month on which a lag ≥ 1 rule would
have been silent. The argument **for** printing always is that the line **disappears when you push** —
a state indicator that clears when you act is not the same thing as a warning that repeats — and that
the board already prints two conditional legends and is read deliberately rather than streamed. The
argument **against** is R-1: a line that prints every morning is a line that stops being read, which
is Q-0102's surviving `p1` half arriving on the fix rather than on the sweep. The alternatives are a
commit floor or an age floor (the body measured *"4 days"* as a candidate; §5 records why age was not
taken). **An answer is needed before implement, not at review.**

**B-3 — does this belong to the product or to this repository?** *Recommended: the product.* The
ticket body names this as *"the one to settle first"* and `06-development-plan.md` repeats it, so it
is ratified at the gate rather than assumed here. The ground: a push-lag column assumes only a git
remote, which is a git concept; GitHub Actions is not. Nothing in the deliverable names a CI service,
nothing makes a network call, and an adopter with no remote sees no change (AC-10). Its degenerate
answer is the body's **option 4** — record the gap as accepted and ship no code — which is a real
option the body correctly refuses to hide, and which this document does not pretend away: if the gate
takes it, the deliverable is GO-1's entry alone and every criterion above is void. What the gate must
not do is leave the question unasked a third time.

### Not blocking

- **OQ-4 — does *"a remote exists but the base tracks nothing"* print?** *Recommended: yes*, as an
  explicit cannot-say line. It is the state that most resembles the incident — a base branch nothing
  is watching — and it is rare enough not to be noise, an ordinary `git clone` setting the upstream
  automatically. The counter-argument is that a maintainer who deliberately untracked their base does
  not want telling twice.
- **OQ-5 — should the fact also be reported at a chore run's human gate?** *Recommended: not now.* A
  gate is where a human decides and is already the window for an erratum, so the surface is defensible;
  but two instruments for one fact means two places to keep honest, and the board is the one that costs
  nothing to consult. Revisit once the board line has been lived with.
- **OQ-6 — is this M2 or M6?** *Recommended: M2*, where `06-development-plan.md` already files it. The
  board exists, the change is small (§10), and the gap is what let a broken installation path sit for
  three days on the path M6 turns on. Deferring to M6 means the instrument arrives after the interval
  it exists to protect.

---

## 8. Risks

- **R-1 — the line becomes noise and is trained away, leaving the gap open and the ticket closed.**
  The strongest argument against the whole ticket, stated here rather than discovered at review.
  Q-0102's surviving `p1` half is that *a flaky oracle trains the reader to re-run until green*; a
  board line printing on every invocation trains the reader to skip the board's last two lines.
  Mitigated by B-2's ruling and by AC-9's wording: a line that says something specific and unusual
  survives; one that says *"you have unpushed work"* every morning does not.
- **R-2 — over-reporting after somebody else pushes your commits.** Needs a fetch to resolve, and the
  direction of the error is safe (M-2): it warns too much, never too little.
- **R-3 — the tracking ref is stale and the line reads as live.** Closed by AC-9's freshness clause,
  and only by it.
- **R-4 — scope creep into a CI-status feature.** The `gh` CLI is installed on this machine and the
  five-line version that shells out to it is genuinely tempting. §5 refuses it and M-3 gives the
  ground; an implementer reaching for it stops and reports, per its own role text.
- **R-5 — the registers are edited to fit rather than moved.** AC-12 exists because this is what
  happens by default, and because two of the four sit in a file whose own companion test was written
  to catch exactly that.
- **R-6 — the fix ships unvalidated.** Closed by GO-3, and only by GO-3.
- **R-7 — what this does not close, stated so it is not later mistaken for closed.** Push lag catches
  *"these commits have never left this machine"*. It does **not** catch: pushed but CI red; pushed but
  no CI configured; pushed to a branch nobody merged; or a green tick replayed from a cache (Q-0071's
  subject, closed separately). It would have caught the incident that opened this ticket, and it would
  not have caught a variant where the same code had been pushed and CI had been red for three days.
  **Any future document claiming this ticket made the base branch "validated" is repeating the failure
  it was opened for.**

---

## 9. Cross-cutting checklist

| | |
| --- | --- |
| **BYOS** | N/a to the recommended shape, and load-bearing against the refused one: no credential, no token, no authenticated call anywhere on this path. Refusing the CI-conclusion candidate is what keeps it that way. |
| **Worktree safety** | The command writes nothing, moves no ref, creates no worktree and makes no network call — asserted by AC-4 rather than assumed, including the `.git/FETCH_HEAD` clause that proves no fetch. |
| **Gate behaviour** | Unchanged. No gate is added, none is answered differently, no run is blocked, no stage moves. |
| **File format and schema** | **Nothing is stored** — no frontmatter field, no `.quorum/` cache, no `harness.yaml` key, no schema change. Decision 041's central property applied to a second fact: a persisted copy of a git fact drifts the first time someone pushes by hand, and a wrong field is believed. The one new type is a `packages/shared` union with a closed reason set (AC-2). |
| **Lint rules** | N/a. No flow file changes, so `quorum lint` is untouched and no `flow.test.ts` guard moves. |
| **Cold-clone impact** | **Zero words added** to the first 30 minutes, asserted by AC-10: a repository with no remote, and one whose base is level with its upstream, both render byte-identically to today. Both installation paths — workspace-local and locally packed — are unaffected. |
| **Vocabulary** | One new term, **push lag**, defined in `GLOSSARY.md` with what it is not (AC-13); `docs/README.md`'s list moves with it under a new assertion (M-5); `CLAUDE.md`'s list is GO-2's. No synonym for containment is introduced, and the board never says "unvalidated", "behind" or "out of date". |
| **Product-agnostic** | No CI service, no forge, no vendor and no product is named in code, test, help text or documentation. The remote's name comes out of git (AC-5). |
| **Dependencies** | None added. |

---

## 10. Size, and what an implementer should expect

**Fourteen criteria, inside the ceiling, and it should not be split.** One function in
`packages/core/src/git/git.ts`, one union in `packages/shared`, one barrel entry, roughly ten lines in
`packages/cli/src/board.ts` beside the two existing legends, and four documents.

The effort is not where it looks. It is in **AC-12's four registers**, each of which must be moved as
a register and shown refusing the value it replaces, and in **AC-14's mutations**, because an
assertion this ticket adds is established by demonstration or it is not established at all.

If GO-1's entry is in place before the run, this is a one- or two-round chore. If it is not, the first
three rounds go on a blocker no step on the route can clear, which is what the fifteen recorded
instances all look like from inside.

---

## 11. Provenance

**From the claude candidate**, and kept because M-4 measures it correct on the tree: the
silence-by-default shape and the asymmetry rule behind it; the `core`/`shared` placement and the
one-file-owns-git argument; the four-register list (AC-12) with its line numbers; the
`.git/FETCH_HEAD` clause as the proof that no fetch happened (AC-4), which is stronger than a source
audit; the forbidden-substring treatment of the rendered sentence (AC-9); the freshness limit and the
*may warn, may never reassure* asymmetry (M-2); the three gate obligations, of which **GO-3 is the
single best idea in either document**; R-1 and R-7; and the size judgement.

**From the codex candidate**, grafted onto that shape: the enumeration of indeterminate states —
`no upstream`, `missing ref`, `shallow clone`, `git failed` — which is more complete than the other
candidate's and is what §3's table is built from; the ruling that the count is `upstream..base` and
never the symmetric difference (AC-6); the ruling that behind-only is not push lag; the shallow-clone
caution, which is a real correctness point the other candidate omitted; the non-`origin`,
non-`main` fixture (AC-5); the argv-injection clause; the no-new-dependency clause; the
build-your-own-remote test-isolation clause (AC-14); and the explicit requirement that no help text
or documentation names a CI product.

**Where they disagreed, what was picked and why.**
  1. **Always render a token (codex) against silence by default (claude) → claude.** Not taste:
     M-4 measures codex's rendering red against six landed assertions in `board.test.ts`, in fixtures
     that have no remote, and it adds a line to the cold-clone path AC-10 protects.
  2. **The token grammar `<base>:push-lag(+n)` (codex) → refused.** `<base>:<state>` is containment's
     grammar and three of those six assertions match on `/main:/`. The new fact renders as a dim
     legend line, which is the board's existing idiom for repository-level facts and cannot collide.
  3. **Change the `board` help line (codex 20) against leave it (claude OQ-6) → leave it**, with
     `04-architecture.md:72`'s documented reason, and the dependency on B-2 stated in §5 rather than
     left as a footnote.
  4. **"No open questions block implementation" (codex) → refused.** Two of its own settled choices —
     what fact is reported, and product-versus-repository — are the very rulings
     `developer-generalist.md:26–27` forbids any step on this route from recording, and its threshold
     is the unrequested default `:14–15` forbids it from choosing.
  5. **Size: codex's 32 criteria against claude's 14 → 14.** Codex's list is past the ceiling and
     roughly a third of it is process restatement rather than testable property: *"the implementation
     and its tests pass the configured commands"* (25), *"no new runtime dependency"* (24) and five of
     the seven cross-cutting rows are already binding rules of this repository, not criteria this
     ticket can be judged against.

**Corrected in this merge, from neither candidate.** The decisive `board.test.ts` collision and its
six sites (M-4); the `git could not answer` legend-count constraint at `:476` (AC-8); the
`docs.test.ts:486` README pin being satisfied by a list that omits the new term (M-5); modelling
`no remote` as a state the core returns and the **board** suppresses, on `containment.ts`'s own
recorded `no branch` precedent, rather than as either candidate's rendering rule; the ruling that this
is a second exported function rather than a member of `Containment`, with the reason (AC-1); and
`main` being 2 commits ahead **right now**, against the ticket body's *"level with `origin/main`"*
(M-1) — which is the ticket's own subject arriving inside the document written to close it.
