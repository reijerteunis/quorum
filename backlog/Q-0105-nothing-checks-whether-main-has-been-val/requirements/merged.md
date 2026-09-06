# Q-0105 — Nothing checks whether `main` has been validated by CI

*Merged requirement, run 1, iteration 2, 2026-09-06. Surface: **CLI** (`quorum board`), plus
`packages/core`, `packages/shared` and the documents that describe what the board shows. Written
against the tree at `3cf03ca`. Every figure below was measured in this iteration rather than carried
from iteration 1; where a measurement contradicts the ticket body, a candidate, or **iteration 1 of
this document**, the measurement is named and the contradicted sentence is quoted.*

**Verdict: ready.** Nothing blocks solutioning. Three gate obligations stand in §6 — they are
preconditions on the chore run, not open questions — and §7 carries four non-blocking questions, each
with a recommendation.

---

## 0. Iteration 2 opened on an unchanged tree, and that is why the verdict moved

Iteration 1 returned `needs-input` on three blockers. **The tree is identical to the one it judged**:
tip still `3cf03ca`, `docs/decisions/` still ending at `079-a-check-outlives-its-subject`, no ruling
appended to `ticket.md`, and `runs.log` carrying only iteration 1's three steps. So this iteration
could not have ruled those blockers by re-reading them — *a retry on an unchanged tree cannot rule
its own blocker* (Q-0090, Q-0096), and this is the third recorded instance.

What is available on an unchanged tree is re-examining whether they were blockers. Two of the three
were not, and saying so is this iteration's substantive output.

**B-1 was never an open question.** The decision entry is a **precondition external to the
document** — the shape Q-0070 named — and the requirement's correct handling of one is to name it
rather than assert it. Q-0070's own entry records that as the thing it got right: *"The requirement
handled it correctly by naming the entry instead of asserting it (AC-11), which is the Q-0069
AC-11(b) failure avoided rather than repeated."* Iteration 1 carried it **twice**, once as GO-1 and
once as B-1, and it is the duplicate that made a complete document read as a blocked one. It stands
below as GO-1 alone.

**B-2 was a real gap, and the cure for it is a ruling rather than a question.**
`developer-generalist.md` binds the implementer *"where the requirement does not cover a case"*. A
requirement that asks the gate to supply the threshold leaves the case uncovered, so the implementer
stops and the round is spent — which is the pattern, not the remedy. A requirement that **states**
the threshold covers it. AC-7 states it, on a measurement (M-6), and §7 OQ-1 records that the gate
may overrule it and what changes if it does.

**B-3 has a determinate answer and its alternative is a scope call, not a question.** Product-versus-
repository falls out of `04-architecture.md` principle 1, measured verbatim below. Its degenerate
answer — the body's option 4, record the gap as accepted and ship nothing — is a decision the human
gate holds over every ticket in this backlog; it does not stop a requirement from being written, and
§7 OQ-2 keeps it visible rather than arguing it away.

None of this reverses iteration 1's findings on the merits. Its three recommendations are all carried
below unchanged. What moved is where they sit: a gate obligation, a ruled criterion and a
non-blocking question, rather than three reasons to stop.

### What was re-measured in this iteration, and what moved

**M-1 — `main` is 2 commits ahead of `origin/main` right now, not level.** The body's 2026-09-06
correction says *"`main` is **level with `origin/main`** as of this writing"*. Measured:
`git rev-list --count main@{upstream}..main` → **2**; `git status -sb` → `## main...origin/main
[ahead 2]`. Both commits (`385930b`, `3cf03ca`) landed after that sentence was written. This is
evidence **for** the ticket, not against the body: the lag re-accumulated within hours of being
recorded as zero and nobody noticed. The consequence for the requirement is that **a lag is the
normal state and zero is the exception**, which is what AC-7's threshold has to survive.

**M-2 — the tracking ref is itself stale, and the direction of that error is the safe one.**
`.git/FETCH_HEAD` was last written **2026-09-05 11:31**, over a day before this document. Anything
derived locally is therefore *as of the last fetch*. The asymmetry is load-bearing: a `git push`
updates the tracking ref locally, so for the maintainer's own commits the count is exact; absent a
fetch the count can only **over**-report, never under-report, except where a remote moved backwards.
**The instrument may therefore warn and may never reassure**, which is the argument for §3's rule
that silence means only *git answered and there is nothing to say*.

**M-3 — no production file in this repository has ever known that a remote exists, and iteration 1
mis-cited this.** `grep -rn --include='*.ts' -E "refs/remotes|@\{upstream\}|ls-remote|'origin'"` over
`packages/*/src` with tests excluded returns **nothing at all**, across 63 production files.
Iteration 1's M-3 reported *"**one** hit — `git.ts:258`'s `for-each-ref … refs/heads`"*; that line
matches none of those patterns, and the count was 0. The conclusion it supported is unchanged and
strengthened. Against it, `docs/04-architecture.md` principle 1, verbatim: *"**`core` has no I/O it
doesn't own.** It spawns CLIs, reads/writes the project folder and git. **It never touches the
network**, never stores secrets, never reads API keys."* Whatever lands here is the first production
code in this repository to know a remote exists, which is why GO-1 is owed rather than a matter of
taste.

**M-4 — the decisive measurement: the codex candidate's rendering turns six landed assertions red,
and it is stricter than iteration 1 reported.** `board.test.ts`'s `projectFixture` (`:71–84`) runs
`git init` and **creates no remote**, so every one of its scenarios is a repository with no upstream.
Under codex's AC-1/AC-3/AC-5 the board prints `main:push-current` or
`main:push-indeterminate(no upstream)` on every invocation, and these six assertions fail:

| site | assertion | what it forbids |
| --- | --- | --- |
| `:283` | `not.toMatch(/indeterminate/)` | the **bare word**, anywhere in the output |
| `:318` | `not.toMatch(/main:/)` | any `main:` token |
| `:323` | `not.toMatch(/main:\|indeterminate/)` | both |
| `:328` | `not.toMatch(/fatal:\|indeterminate/)` over an **empty backlog** | both |
| `:420` | `not.toMatch(/indeterminate/)` | the bare word |
| `:454` | `not.toMatch(/main:\|indeterminate/)` | both |

Iteration 1 described `:283` and `:420` as matching `/main:|indeterminate/`; measured, they are
unqualified `/indeterminate/`, which is **stricter** — a legend merely containing that word turns
them red, whatever its grammar. Two further constraints fall out of the same file: `:476` counts the
containment legend by `out(result).split('git could not answer').length - 1 === 1`, so a push-lag
legend reusing that phrase double-counts it; and `:267` pins a ticket row byte for byte. **This is
not a preference between two house styles — one candidate's design is red on the tree as written.**
§3 takes the other and AC-8 makes the constraint a criterion.

**M-5 — `docs.test.ts`'s README pin does not catch the omission it looks like it catches.**
`docs.test.ts:486` is `expect(repoFile('docs/README.md')).toContain('build task, emitted artifact')`,
and `docs/README.md:32` ends that list `emitted artifact)`. Appending a term after it keeps the pin
green, and **so does omitting one**. A new assertion is owed rather than an edited one (AC-13).

**M-6 — no threshold above 1 survives contact with the incident this ticket was opened on.** The body
offers an age floor and measures *"4 days"* as a candidate. Q-0104's own timeline refutes it: that
defect landed in `68a83f0` on 2026-09-02, the last CI run was `729dcb3` on 2026-09-01, and it was
broken **for three days**. A four-day floor prints nothing for the entire life of a three-day break.
An age oracle also makes a fixture's verdict a function of the clock rather than of the commit, which
*"A test's verdict is a property of the commit"* (2026-08-30) refuses. A commit floor is a constant
nobody can justify and which an adopter's cadence would have to re-derive. What survives is lag ≥ 1,
and AC-7 states it.

**M-7 — one git spawn does not answer this, and the obvious atom is unusable.** Probed on this
machine (git 2.55.0): `%(ahead-behind:<missing ref>)` prints `fatal: failed to find …` and yields no
per-ref line, so **a single missing ref kills the whole invocation** — unusable in a command that
must exit 0. `git rev-list --count <missing>..HEAD` exits **128**. `%(upstream)` returns the **empty
string** rather than failing when a branch tracks nothing, which is the probe. `%(upstream:track)`
prints `[ahead 2]` and its locale-stability **could not be established** here — this git build
carries no translations, so `LC_ALL=de_DE.UTF-8` returned the English string, which is a failure to
refute and not a proof. The shape that is locale-proof by construction is the one `containment`
already uses: **probe for existence, then count with `git rev-list --count`**, which emits an integer
under every locale.

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

**Contributor.** N/a, stated rather than omitted: no adapter contract, event, trace shape or flow file
changes, so a contributor never reaches this surface.

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
not invented here — `packages/shared/src/containment.ts` already states it for `no branch`, verbatim:
*"Whether it is worth rendering is the board's call and not this vocabulary's."* So the state set is
complete and the rendering table is separate:

| state from `core` | board renders |
| --- | --- |
| `pushed` — the upstream holds everything the base does | **nothing** |
| `unpushed` — the base holds *n* commits the upstream does not | one dim line naming base, upstream and *n* |
| `indeterminate (no remote)` — the repository has no remotes at all | **nothing** |
| `indeterminate (no upstream)` — a remote exists, the base tracks nothing | one dim line saying the board cannot tell |
| `indeterminate (missing ref)` — the base or its upstream does not resolve | one dim line saying the board cannot tell |
| `indeterminate (shallow clone)` — truncated history could understate the count | one dim line saying the board cannot tell |
| `indeterminate (git failed)` — the probe failed inside a work tree | one dim line saying the board cannot tell |
| not a git work tree — the function returns `null` | **nothing** — as `containment` already does |

**Silence means git answered and there is nothing to report; anything unanswerable that is worth
saying prints.** That asymmetry is the design: *"a check that skips its subject must not report
success"* (2026-08-25) applied to an instrument whose success output is silence, and combined with M-2
it is the rule that this line **may warn and may never reassure**.

`no remote` is a reason the core reports and the **board suppresses**, exactly as `no branch` already
is, rather than a rendering rule invented here. Behind-only is `pushed`: a base with nothing waiting
to be pushed has no push lag, whatever the upstream has moved on to.

---

## 4. Acceptance criteria

Fourteen, numbered, each independently testable, each naming its surface.

**AC-1 — `core` gains exactly one exported function, in the one file that owns git, and it is a second
function rather than a member of `Containment`.** It lives in `packages/core/src/git/git.ts` for the
reason that file exists — every git call in `core` goes through one runner, which is why Q-0093 put
`currentBranch` there rather than in `backlog/scaffold.ts` — and a probe spelled in
`packages/cli/src/board.ts` fails this criterion. It is **not** folded into `containment()`: that
function returns `null` when `repoDir` is not a work tree, so a fact folded into it would be unaskable
exactly where the board would still want it, and its documented scope is *"where a ticket's code
actually is"*, which is a per-branch question this fact does not ask. It reaches `@quorum/core`'s
public surface through the barrel.

**AC-2 — the result is a closed discriminated union declared in `packages/shared`, never a number and
never `null`.** Beside `ContainmentResult` in `packages/shared/src/containment.ts` or a sibling
module, with a `const … as const` reason list in the shape of `CONTAINMENT_REASONS`, and with the
`?: never` members that already make the impossible combinations unrepresentable there — a `pushed`
result carries no count, an `unpushed` result carries a count and no reason, an `indeterminate` result
carries a reason from its own set and nothing else. `core` imports the type and declares none of its
own (`04-architecture.md`). A shape returning `number | null` fails: it makes *level* and *could not
ask* the same value, which AC-3 forbids. Sharing the strings `missing ref`, `shallow clone` and `git
failed` with `CONTAINMENT_REASONS` while keeping the sets separate is correct and precedented —
`ANCESTRY_REASONS` and `CONTAINMENT_REASONS` already overlap on two.

**AC-3 — the state is selected from git's own answers and is never inferred from a failure.** Decision
*"Containment is derived from git on each board invocation, never stored"* (2026-08-24) rule 1,
arriving at a second fact. A failed probe, an unresolvable ref, a shallow repository, an absent remote
and an absent upstream each reach their own reason and **none of them reaches `pushed`**. Demonstrated
by mutation rather than by reading: an implementation in which a failed probe falls through to
`pushed` must turn a named test red, and the implement report records the mutation and the message it
produced.

**AC-4 — the command reads, never writes, and specifically never fetches.** After `quorum board`,
`git for-each-ref` output is byte-identical to before it and no file appears or vanishes — the
assertions `board.test.ts` C1 (`:274–292`) already makes for containment — **and** `.git/FETCH_HEAD`
is unchanged: present with the same bytes and mtime, or absent and still absent. That second clause is
what proves no network call was made, and it is stronger and cheaper than auditing the source for a
verb. Additionally: no git argv this module can issue contains `fetch`, `ls-remote`, `push` or
`remote update`.

**AC-5 — the base branch and the remote both come from data, never from a literal, and no ref value is
interpolated into a command line.** The base is `repo.base_branch` from `harness.yaml`, read as
`board.ts:108` already reads it (`config.repo?.base_branch ?? 'main'`). The upstream ref and the
remote name are read out of git's own answer; **the string `origin` appears in no new production
source**. Ref names originate outside Quorum, so they are passed as argv values through the existing
`execFileSync` runner and never assembled into a shell string, which `git.source.test.ts`'s AC-5
already pins for this file. Proven by a fixture whose base is `trunk` tracking a remote that is not
`origin`: both real names render and the strings `origin` and `main` appear nowhere in the output.

**AC-6 — the count is `<upstream>..<base>`, never the symmetric difference, and behind-only reports
nothing.** A fixture diverged by 2 local and 1 remote commit reports **2**, and the output does not
contain `3` as a count — the discriminating shape `board.test.ts` C2 (`:294–305`) already uses for
containment. A base that is only behind its upstream renders nothing.

**AC-7 — the line prints at any push lag of 1 or more, and there is no floor.** Ruled here rather than
deferred, because a requirement that leaves the case uncovered is one an implementer must stop on, and
the ground is measured rather than chosen (M-6): an age floor of the body's own four days would have
printed **nothing for the entire life of Q-0104's three-day break**, and it makes a fixture's verdict a
function of the clock, which *"A test's verdict is a property of the commit"* (2026-08-30) refuses; a
commit floor is a constant nobody can justify and which an adopter's cadence would have to re-derive.
The accepted cost is stated rather than hidden: measured today (M-1), `main` is ahead 2, so the line
prints, and there is no working day this month on which it would have been silent. What makes that
tolerable is that **it clears when you push** — a state indicator that disappears when you act is not
a warning that repeats — and that it is one dim line among two conditional legends the board already
prints. §7 OQ-1 records that the gate may overrule this to a floor, and §5 records that a floor would
be a constant with a stated reason and never a `harness.yaml` key.

**AC-8 — no ticket row changes, and the new line cannot collide with containment's vocabulary.**
`board.test.ts:267`'s pinned row passes **unedited**, and the six assertions M-4 lists — `:283`,
`:318`, `:323`, `:328`, `:420`, `:454` — pass unedited. Mechanically that requires the rendered line to
contain **no `<base>:` token**, **not the word `indeterminate`** (`:283` and `:420` match it
unqualified, so a legend merely containing it is red) and **not the phrase `git could not answer`**,
which `:476` counts to prove the containment legend prints exactly once. Structurally it is required
anyway: `indeterminate` is containment's closed vocabulary in `GLOSSARY.md`, and a second fact
borrowing it makes both legends ambiguous. Push lag is one repository-level fact and is never a
per-ticket annotation.

**AC-9 — the sentence claims what it can prove, says what it cannot, and no word of it can be read as a
claim about testing.** It names the base branch, its upstream and the count; it is about commits **not
having been pushed**; and it states in words that the answer is **as of the last fetch** (M-2: this
repository's tracking ref was over a day stale while this board rendered, so a line reading as a live
fact about a remote is false on a machine that has not fetched since Tuesday). The rendered output
contains none of: `CI`, `validated`, `unvalidated`, `verified`, `tested`, `green`, `build`, `GitHub`,
`Actions`, `pipeline`. Asserted as a forbidden-substring list **and** a positive pin, in the shape
`end-to-end.test.ts`'s binary-name table already uses, because a line naming nothing would satisfy a
positive assertion alone. **This is the criterion the ticket exists for**: the failure being fixed is
four documents claiming a path worked, and a board line that implies validation is that same failure
wearing a fix's clothes. The board says *contained* and never "merged" or "shipped"; by the same rule
it says *not pushed* and never "unvalidated".

**AC-10 — the cold-clone path gains zero words.** `quorum init` followed by `quorum board` in a freshly
initialised project with no remote produces output byte-identical to today's. Quality pillar 7: a
feature that lengthens a newcomer's first 30 minutes needs a reason, and this one has none to offer an
adopter who has not pushed anything yet.

**AC-11 — `quorum board` still exits 0 in every one of §3's outcomes, including where git failed.** It
is one of *"the two commands that can only exit 0"* (Q-0099), and an instrument that starts failing the
command it annotates has replaced a silent gap with a loud one.

**AC-12 — the four landed registers move as registers, each shown red against the value it replaces.**
Measured, they fail closed and will stop the run, which is them working:
  1. `packages/core/src/git/git.source.test.ts:28` pins the module's exports at **exactly ten** names;
     it becomes eleven.
  2. `:41` asserts that pin **moved rather than widened**, by refusing the previous nine-name list; it
     is re-aimed at the ten-name list and shown to refuse it. A `toContain` substituted for the
     `toEqual` fails this criterion — *"a count is not an identity"* (Q-0073).
  3. `:64–70` pins the barrel's contribution from `git/` at exactly `['containment']`; it becomes two
     names, and its comment — *"`containment` is … the only name here a consumer outside the package
     may reach"* — stops being true, so it moves with the pin.
  4. `containment`'s JSDoc pins the spawn budget at *"at most 2n + 3"* for a board of n tickets. The
     new probe's cost is constant in n, and the sentence states the new bound **measured rather than
     estimated**.
  Per *"A check outlives its subject only if it can still fail"* (2026-09-05): updating the row is the
  act that records the choice.

**AC-13 — the documents that describe what the board shows move in the same change.**
`docs/GLOSSARY.md` gains **push lag** in the shape `Containment` (`:27`), `Event` and `Undecided`
already use — what it is, what it is derived from, and explicitly **what it is not**: not containment
(a different pair of refs answering a different question), not "behind", not "out of date", and **not a
claim that anything was built or tested**. `docs/README.md:32`'s term list gains it **under a new
assertion**, because `docs.test.ts:486` is a `toContain` of the previous tail and stays green over a
list that omits the term (M-5). `docs/02-sdlc-pipeline-spec.md:158` — the containment paragraph — and
`docs/04-architecture.md`'s `packages/cli` section each gain a sentence, and every edited numbered
document's status line records `Q-0105` and the landing date.

**AC-14 — every new assertion is demonstrated red before green by mutation, and every new fixture
builds its own repository, its own remote and its own identity.** The mutation and the message it
produced are recorded in the implement report. Not a style note: this repository has found five
assertions that could not fail in one ticket (Q-0050), a guard blind to three spellings of its subject
(Q-0062), a negative check that started passing the moment a file moved (Q-0088) and a counter reading
`n >= 0` (Q-0101); and five of the last six chore reviews could not execute the suite under
`--sandbox read-only`, so an assertion this ticket adds is established by demonstration or it is not
established at all. No test's verdict may depend on the invoking account, the ambient git
configuration, or a remote that already exists: every remote, ref and configuration value used as an
oracle is created by the test, and `-c user.email=…` / `-c user.name=…` are supplied **at the call
site** as `board.test.ts:80` already does, because `packages/core/src/git-identity.test.ts` reads
literals and a helper supplying them invisibly looks like a violation to the guard written to find one
(*"A test's verdict is a property of the commit, not of the checkout or the account"*, 2026-08-30).

---

## 5. Non-goals

- **Any query of a CI service, and any network call at all.** Refused on `04-architecture.md`
  principle 1 (M-3), not deferred. This includes `gh`, the GitHub API, and any path that reads a
  stored credential: a read-only local command acquiring a network credential is a boundary this
  repository has not crossed and must not cross in passing.
- **Fetching before calculating, or detecting that the tracking ref is stale.** AC-9's freshness
  sentence is the whole treatment.
- **Reporting the age of the oldest unpushed commit.** Measured as a candidate and refused in M-6, not
  merely omitted: it is the incident's signature, and a four-day floor would have been silent for the
  whole of Q-0104's three-day break.
- **A configurable threshold.** If OQ-1 rules a floor, it is a constant with a stated reason and
  **never a `harness.yaml` key** — a key would drag in `projectConfigSchema`, the template, the
  undeclared-key guard in `project.test.ts` and a snake_case-versus-camelCase ruling, to make
  configurable a line nobody has yet found noisy.
- **Any other stored field or cache.** No `ticket.md` frontmatter, nothing under `.quorum/`, no schema
  change. Decision 041's central property applied to a second fact.
- **Fixing Q-0104 or Q-0102.** Both are already dealt with; this ticket is about why nobody knew.
- **Pushing, prompting to push, or making a push a precondition of anything.** A push is an
  outward-facing act and stays the human's, which is the same principle as the human gate. This ticket
  reports a fact; it does not act on one, blocks no run, and adds no gate.
- **Per-ticket push lag.** Ticket branches are local by construction; `harness/*` is never pushed.
- **Changing `quorum board`'s help line.** `commands.ts:66` reads *"kanban of tickets by stage, and
  where each ticket's code is"*; it glosses containment rather than naming it and omits both existing
  legends, so omitting a third is consistent rather than an oversight.
- **A git hook.** Not versioned into a clone, fires on the wrong event, and nags rather than informs.
- **A second script in `.github/scripts/` (the body's option 3).** Refuted in one sentence: *a check
  that runs in CI cannot detect that CI never ran.* The gap is on the local side by construction, so
  the instrument must be one a maintainer meets **without** pushing.
- **Reporting at a gate (the body's option 2).** Deferred rather than refused; OQ-4 says why one
  instrument at a time is the right call.
- **Any new runtime dependency.** If the implementation appears to need one, it stops and reports.
- **Any change to what the git-identity sweep runs.** Q-0102's GO-2 applies here unchanged.
- **`apps/web` and the M3 board.** M3's backlog board will want the same fact; nothing here prevents
  that, and nothing here builds it.

---

## 6. Gate obligations

Work that must happen **at the requirements gate, by the human, before a chore run is launched**. These
are preconditions on the run, not open questions — the distinction §0 turns on.

**GO-1 — the decision entry is owed before the first implement round, and only the human may write
it.** `harness/roles/developer-generalist.md`, verbatim: *"You do not add to docs/decisions/ or its
index; a decision is the human's to record."* The entry rules three things: that the board reports
**push lag derived from git and never a CI conclusion** (M-3's principle-1 ground); that this belongs
to **the product** rather than to this repository (OQ-2); and **the print threshold** AC-7 states, so
that a ruled criterion has a recorded authority behind it. It also names *"Containment is derived from
git on each board invocation, never stored"* (2026-08-24) as the entry it extends, since this is a
second fact under that entry's rules and an extension nobody records reads later as a contradiction.
**The precedent is exact and expensive**: Q-0062's requirement named this hazard in advance, the run
was launched without the entry, and rounds 1 to 3 went entirely on a blocker no agent on the route
could clear — round 2 responding by adding a *sixth* citation of the absent entry. Q-0083, an implement
step that can return `blocked`, is still the mechanism owed. Launching without the entry is the
sixteenth appearance of that pattern, and it is avoidable for the cost of writing one file.

**GO-2 — `CLAUDE.md`'s term list is the human's, and nothing checks it.** AC-13 adds a glossary term
and `CLAUDE.md:13` carries the same list. Q-0103's erratum E-2 ruled that file *"stays the human's,
being the vendor dialect of the canonical harness"*, and it is outside `developer-generalist`'s
`paths:`. Measured: **no assertion in `packages/` reads that list**, so an omission is silent rather
than caught.

**GO-3 — push the merge and watch CI go green before this ticket is closed.** Every other ticket can be
closed on a local verification. This one cannot without refuting itself: a fix for *"nothing notices
that `main` was never validated"* that lands on an unpushed `main` is the defect closing its own
ticket. The run's `integrate` tick and both suites forced on `main` after the merge are necessary and,
uniquely here, **not sufficient**.

---

## 7. Open questions

None blocks solutioning. Owner is the human at the requirements gate.

- **OQ-1 — should AC-7's threshold be overruled to a floor?** *Recommended: no, ship lag ≥ 1.* Ruled in
  AC-7 on M-6 rather than left open, because a requirement that does not cover the case is one the
  implementer must stop on. What the gate is offered is an **overrule**, not a blank: if it wants a
  floor, the floor is a constant with a stated reason (§5), AC-7's clause changes, and the argument it
  has to beat is that a four-day floor would have been silent for the whole of Q-0104's three-day
  break. The counter-argument on the record is R-1.
- **OQ-2 — does this belong to the product, or should the gate take the body's option 4 and ship
  nothing?** *Recommended: the product.* The ground is measured, not preferred: a push-lag line assumes
  only a git remote, which is a git concept where GitHub Actions is not; nothing in the deliverable
  names a CI service, nothing makes a network call, and an adopter with no remote sees no change
  (AC-10). **Option 4 — record the gap as accepted and ship no code — is live and is not argued away**:
  under it the deliverable is GO-1's entry alone and every criterion above is void. What the gate must
  not do is leave the question unasked a third time, which is how Q-0073's 15-commit caveat became an
  89-commit gap.
- **OQ-3 — does *"a remote exists but the base tracks nothing"* print?** *Recommended: yes*, as an
  explicit cannot-say line. It is the state that most resembles the incident — a base branch nothing is
  watching — and it is rare enough not to be noise, an ordinary `git clone` setting the upstream
  automatically. The counter-argument is that a maintainer who deliberately untracked their base does
  not want telling twice. §3's table assumes the recommendation.
- **OQ-4 — should the fact also be reported at a chore run's human gate?** *Recommended: not now.* A
  gate is where a human decides and is already the window for an erratum, so the surface is defensible;
  but two instruments for one fact means two places to keep honest, and the board is the one that costs
  nothing to consult. Revisit once the board line has been lived with.

---

## 8. Risks

- **R-1 — the line becomes noise and is trained away, leaving the gap open and the ticket closed.** The
  strongest argument against the whole ticket, stated here rather than discovered at review, and the
  reason AC-7's threshold is a ruling with an escape hatch rather than a silent default. Q-0102's
  surviving `p1` half is that *a flaky oracle trains the reader to re-run until green*; a board line
  printing on every invocation trains the reader to skip the board's last two lines. Mitigated by the
  fact that it clears when you push, and by AC-9's wording: a line that says something specific and
  unusual survives; one that says *"you have unpushed work"* every morning does not.
- **R-2 — over-reporting after somebody else pushes your commits.** Needs a fetch to resolve, and the
  direction of the error is safe (M-2): it warns too much, never too little.
- **R-3 — the tracking ref is stale and the line reads as live.** Closed by AC-9's freshness clause, and
  only by it.
- **R-4 — scope creep into a CI-status feature.** The `gh` CLI is installed on this machine and the
  five-line version that shells out to it is genuinely tempting. §5 refuses it and M-3 gives the ground;
  an implementer reaching for it stops and reports, per its own role text.
- **R-5 — the registers are edited to fit rather than moved.** AC-12 exists because this is what happens
  by default, and because two of the four sit in a file whose own companion test was written to catch
  exactly that.
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
| **File format and schema** | **Nothing is stored** — no frontmatter field, no `.quorum/` cache, no `harness.yaml` key, no schema change. A persisted copy of a git fact drifts the first time someone pushes by hand, and a wrong field is believed. The one new type is a `packages/shared` union with a closed reason set (AC-2). |
| **Lint rules** | N/a. No flow file changes, so `quorum lint` is untouched and no `flow.test.ts` guard moves. |
| **Cold-clone impact** | **Zero words added** to the first 30 minutes, asserted by AC-10. Both installation paths — workspace-local and locally packed — are unaffected. |
| **Vocabulary** | One new term, **push lag**, defined in `GLOSSARY.md` with what it is not (AC-13); `docs/README.md`'s list moves with it under a new assertion (M-5); `CLAUDE.md`'s list is GO-2's. No synonym for containment is introduced, and the board never says "unvalidated", "behind" or "out of date". |
| **Product-agnostic** | No CI service, no forge, no vendor and no product is named in code, test, help text or documentation. The remote's name comes out of git (AC-5). |
| **Dependencies** | None added. |

---

## 10. Size, and what an implementer should expect

**Fourteen criteria, inside the ceiling, and it should not be split.** One function in
`packages/core/src/git/git.ts`, one union in `packages/shared`, one barrel entry, roughly ten lines in
`packages/cli/src/board.ts` beside the two existing legends, and four documents.

The effort is not where it looks. It is in **AC-12's four registers**, each of which must be moved as a
register and shown refusing the value it replaces, and in **AC-14's mutations**, because an assertion
this ticket adds is established by demonstration or it is not established at all.

If GO-1's entry is in place before the run, this is a one- or two-round chore. If it is not, the first
three rounds go on a blocker no step on the route can clear, which is what the fifteen recorded
instances all look like from inside.

---

## 11. Provenance

**From the claude candidate**, kept because M-4 measures it correct on the tree: the silence-by-default
shape and the asymmetry rule behind it; the `core`/`shared` placement and the one-file-owns-git
argument; the four-register list (AC-12) with its line numbers; the `.git/FETCH_HEAD` clause as the
proof that no fetch happened (AC-4), which is stronger than a source audit; the forbidden-substring
treatment of the rendered sentence (AC-9); the freshness limit and the *may warn, may never reassure*
asymmetry (M-2); the three gate obligations, of which **GO-3 is the single best idea in either
document**; R-1 and R-7; and the size judgement.

**From the codex candidate**, grafted onto that shape: the enumeration of indeterminate states —
`no upstream`, `missing ref`, `shallow clone`, `git failed` — which is more complete than the other
candidate's and is what §3's table is built from; the ruling that the count is `upstream..base` and
never the symmetric difference (AC-6); the ruling that behind-only is not push lag; the shallow-clone
caution, a real correctness point the other candidate omitted; the non-`origin`, non-`main` fixture
(AC-5); the argv-injection clause; the no-new-dependency clause; and the build-your-own-remote
test-isolation clause (AC-14).

**Where they disagreed, what was picked and why.**
  1. **Always render a token (codex) against silence by default (claude) → claude.** Not taste: M-4
     measures codex's rendering red against six landed assertions in `board.test.ts`, in fixtures that
     have no remote, and it adds a line to the cold-clone path AC-10 protects.
  2. **The token grammar `<base>:push-lag(+n)` (codex) → refused.** `<base>:<state>` is containment's
     grammar and three of those six assertions match on `/main:/`, while two more forbid the bare word
     `indeterminate` anywhere in the output. The new fact renders as a dim legend line, which is the
     board's existing idiom for repository-level facts and cannot collide.
  3. **Change the `board` help line (codex 20) against leave it (claude) → leave it**, with the
     documented reason that it glosses rather than enumerates and already omits both legends.
  4. **"No open questions block implementation" (codex) → half right, for the wrong reason.** Its
     conclusion is this document's verdict, but two of its settled choices — what fact is reported, and
     product-versus-repository — are rulings `developer-generalist.md` forbids any step on this route
     from *recording*, which is why they are GO-1's rather than simply assumed.
  5. **Size: codex's 32 criteria against claude's 14 → 14.** Codex's list is past the ceiling and roughly
     a third of it is process restatement rather than testable property: *"the implementation and its
     tests pass the configured commands"* (25), *"no new runtime dependency"* (24) and five of the seven
     cross-cutting rows are already binding rules of this repository, not criteria this ticket can be
     judged against.

**From iteration 1 of this document**, kept: the whole of §3's shape, the register list, GO-1 to GO-3,
and the three recommendations its blockers carried — all three are ratified here rather than reversed.

**Corrected in iteration 2, against iteration 1 itself.** Its M-3 reported *"one hit — `git.ts:258`"*
for remote-awareness in production source; re-run, the grep returns **nothing at all** across 63 files,
and `git.ts`'s `for-each-ref` line matches none of those patterns (M-3). Its M-4 described `:283` and
`:420` as matching `/main:|indeterminate/`; measured, they are unqualified `/indeterminate/`, which is
**stricter** and widens AC-8 (M-4). Its B-1 and GO-1 were the same obligation counted twice, which is
what made a complete document read as a blocked one (§0). And its B-2 was returned as a question when
the requirement's job was to answer it (§0, AC-7, M-6).

**Corrected against the ticket body**, which is the human's to amend: `main` is **2 commits ahead of
`origin/main` right now**, against the body's *"level with `origin/main`"* (M-1) — the ticket's own
subject arriving inside the document written to close it.
