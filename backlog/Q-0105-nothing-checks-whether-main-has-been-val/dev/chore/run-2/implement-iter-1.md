# Q-0105 — implement report, run 2, iteration 1

*Written against the tree at `d4941cd`. Every figure below was measured in this round; where a
measurement contradicts the merged requirement, the measurement is named and the contradicted
sentence quoted.*

**Fourteen criteria, all satisfied. Nothing was left out.** The suite is green forced across all
seven packages, the emit builds, and `pnpm exec quorum board` runs the new code through the real
binary. Three things need the reviewer's attention and are stated up front rather than buried:
**AC-12 named four registers and there are nine**; the **git-identity sweep is intermittently red on
a test this ticket did not touch**; and one **date judgement** the human may want to overrule with a
three-line edit.

---

## 0. GO-1 was in place before the first line, and that is why this is one round

`docs/decisions/080-the-board-reports-push-lag-and-never-a-ci-conclusion.md` landed at `d4941cd`
before this step started. Its three rulings are what the implementation is written to, and each is
cited in the code rather than transcribed:

- **(a)** the fact is git's and never a CI conclusion → `pushLag`'s JSDoc, `push-lag.ts`'s header,
  and the AC-9 forbidden-substring assertion;
- **(b)** it belongs to the product → the vocabulary is in `packages/shared`, not in this repository's
  configuration;
- **(c)** the line prints at lag ≥ 1 → `pushLagLegend` applies no floor, and AC-7's test fails if one
  is added.

The merged requirement's §10 said: *"If GO-1's entry is in place before the run, this is a one- or
two-round chore. If it is not, the first three rounds go on a blocker no step on the route can
clear."* It was in place. This is round 1 and no round was spent on an authority appeal — the first
time in the recorded sequence that the prediction was tested in the favourable direction.

---

## 1. What shipped, file by file

### New

**`packages/shared/src/push-lag.ts`** (AC-2) — the closed vocabulary. `PUSH_LAG_STATES`
(`pushed`, `unpushed`, `indeterminate`), `PUSH_LAG_REASONS` (`no remote`, `no upstream`,
`missing ref`, `shallow clone`, `git failed`) and `PushLagResult`, whose variants carry `?: never`
members so the impossible combinations are unrepresentable rather than merely unwritten.

A **sibling module rather than an addition to `containment.ts`**, which AC-2 permits explicitly
("or a sibling module"). The reason is the one decision 080 gives: it is a second *subject* under the
same rules, and `containment.ts`'s own header declares a single subject that `git.source.test.ts`
reads it for. The module imports nothing, as its neighbour does not.

> **A note for the reviewer, because it reads like a contradiction and is not.** AC-2 says the result
> is "never `null`", and `pushLag` returns `PushLagResult | null`. AC-2's objection is stated in its
> own next sentence — *"A shape returning `number | null` fails: it makes level and could not ask the
> same value"* — and that shape is refused: `pushed` and `indeterminate` are distinct members. The
> `null` is the outside-a-work-tree sentinel §3's own table mandates (*"not a git work tree — the
> function returns `null` … as `containment` already does"*). No state is ever `null`.

### Changed — production

**`packages/core/src/git/git.ts`** (AC-1, AC-3, AC-5, AC-6) — `pushLag(repoDir, base)`, one new
export in the file that owns every git call in `core`. The order is the design:

| step | on failure | why it is here |
| --- | --- | --- |
| `rev-parse --is-inside-work-tree --is-shallow-repository` | `null` | no question can be asked at all |
| `git remote` | `git failed` / empty → `no remote` | **first**, so a repository with nowhere to push is silent whatever else is true — which is what makes AC-10 unconditional |
| `rev-parse --verify --quiet refs/heads/<base>^{commit}` | `missing ref` | |
| `for-each-ref --format=%(upstream) %(upstream:short) <baseRef>` | `git failed` / empty → `no upstream` | one call for both fields; a ref name cannot contain a space |
| shallow check | `shallow clone` | after everything more specific, so a truncated clone still reports `no upstream` where that is the real answer |
| `rev-list --count <upstream>..<base>` | `git failed` | `..`, never `...` |

M-7's shape is followed exactly — **probe for existence, then count** — and the atom M-7 refuted is
not used: `%(ahead-behind:<ref>)` fatals the whole `for-each-ref` on one missing ref, which is
unusable in a command that must exit 0.

`containment`'s JSDoc spawn-budget sentence moved with it (AC-12 register 4): **2n + 3 for the rows
plus at most 5 constant → the board's whole budget is 2n + 8**, measured by the spawn counter rather
than counted by eye.

**`packages/core/src/index.ts`** — barrel gains `pushLag`, with a paragraph saying why (a command
needs it) and restating that `currentBranch` is still withheld. Counts 26 → 27, 21 → 22.

**`packages/cli/src/board.ts`** (AC-7, AC-8, AC-9, AC-10, AC-11) — `pushLagLegend`, and one call at
the end of the handler. The two silent states are `pushed` and `no remote`; everything else prints.

The rendered sentences:

```
· push lag = main holds 2 commits that origin/main does not, as of the last fetch — they have
  not been pushed, which is the whole of what this says
· push lag = the board cannot say whether main has been pushed (no upstream), as of the last fetch
```

Neither carries a `<base>:` token, the word `indeterminate`, or the phrase `git could not answer` —
the three things AC-8 forbids mechanically, and which between them are what keep the six landed
`board.test.ts` assertions M-4 lists green **unedited**. Confirmed: `:267`, `:283`, `:318`, `:323`,
`:328`, `:420`, `:454` and `:476` are untouched and passing.

### Changed — registers and tests

`packages/core/src/git/git.source.test.ts`, `packages/core/src/git/git.test.ts`,
`packages/core/test/repo.ts`, `packages/core/src/turbo-inputs.test.ts`,
`packages/cli/src/board.test.ts`, `packages/cli/src/frame.source.test.ts`,
`packages/cli/src/package.test.ts`, `packages/shared/src/docs.test.ts`. Detailed in §2 and §3.

`packages/core/test/repo.ts` gained one capability: the git shim now records **argv** as well as
counting calls. That is what gives AC-4 a runtime subject — a source scan for the verb `push` cannot
tell a git argument from a function called `pushLag`, and gets weaker every time something is
renamed.

### Changed — documentation (AC-13)

- **`docs/GLOSSARY.md`** — **Push lag**, placed beside **Containment**, in the shape Event and
  Undecided use: what it is, what it is derived from, the five reasons, the *may warn and may never
  reassure* asymmetry, and four explicit refusals — not containment, not "behind", not "out of date",
  and **not a claim that anything was built, tested or validated**.
- **`docs/README.md:32`** — term list gains `push lag`, under a **new** assertion (M-5: the landed
  `toContain('build task, emitted artifact')` pin stays green over a list that omits the term, and the
  new test demonstrates that with a fixture rather than asserting it).
- **`docs/02-sdlc-pipeline-spec.md`** §3.4 — one paragraph beside the containment paragraph.
- **`docs/04-architecture.md`** `packages/cli` — one paragraph. The sentence above it, *"`board` and
  `adapters` **are** the first pair to need nothing added"*, moved to the past tense rather than
  being deleted: it was true of Q-0099 and stays true of Q-0099.
- Both numbered documents' status lines record `Q-0105`.

---

## 2. The finding that matters most: AC-12 named four registers, and there are nine

The requirement's §10 says the effort *"is in AC-12's four registers"*. Measured, a new symbol on
`@quorum/core`'s barrel moves **nine** register sites in four files. All five it did not name
**failed closed and stopped the suite**, which is them working — but a reviewer reading AC-12 will be
looking for four, and should be told there are nine.

### The four AC-12 named

1. `git.source.test.ts:28` — the module's export pin, ten → **eleven** names.
2. `git.source.test.ts:41` — the *moved rather than widened* pin, re-aimed at the ten it replaces and
   shown refusing them.
3. `git.source.test.ts:64–70` — the barrel's contribution from `git/`, `['containment']` →
   `['containment', 'pushLag']`. Its comment said `containment` is *"the only name here a consumer
   outside the package may reach"*, which is now false, so the comment moved with the pin.
4. `containment`'s JSDoc spawn budget, re-measured rather than estimated.

### The five it did not

5. `frame.source.test.ts` `DOMAIN`, 21 → **22**.
6. `frame.source.test.ts` `COMMAND_DOMAIN['board.ts']`, three names → **four**.
7. `frame.source.test.ts`'s `domainOffenders` fixture, which asserts the **exact offender list** a
   one-line `board.ts` fixture produces against that row — two entries → **three**. This one is the
   register at its best: the list is the row's own contents minus what the fixture names, so a row
   that grows and a list that does not is a register somebody edited around.
8. `package.test.ts` — `domain()` 21 → **22**, and `Object.keys(barrel)` 26 → **27**.
9. `turbo-inputs.test.ts` — Q-0072's guard, twice: `ESCAPING_LITERALS` gains `..` for `git.ts` and
   `git.test.ts` (**git revision-range syntax, which names a range and opens no path** — the reason
   is what the register exists to record), and `READ_BASES` gains `argv` for `test/repo.ts`, the
   shim's new argv log. Both earned their registration on the way in, which is the machinery
   working as designed.

### Registers 5 and 8 were spelled as claims that Q-0099 moved nothing, and this ticket falsified the spelling rather than the claim

Both were written by Q-0099 to assert something true and worth asserting: *"the first command child
of the cut that needed nothing added"*. Both spelled it as a count of **today's** register — `21`,
`26`. Q-0105 adds `pushLag` for `board`, so the counts had to move.

They were **re-aimed, not deleted**, and the comments now say what they guard. The substantive
clause of each is untouched and still able to fail: `added.filter(s => !DOMAIN.includes(s))` being
empty is a defect check whatever the size, and it never depended on the count. Per *"A check outlives
its subject only if it can still fail"* (2026-09-05), moving the number is the act that records the
choice — and `board.ts` is now the first row in that register to grow **after its command shipped**,
which is a case the register had no way to express before and now does.

---

## 3. Every new assertion was demonstrated red by mutation

AC-14 requires it, and this repository's record is why: five assertions that could not fail in one
ticket (Q-0050), a guard blind to three spellings (Q-0062), a negative check that started passing
when a file moved (Q-0088), a counter reading `n >= 0` (Q-0101). Each mutation below was applied,
run, and reverted; the message is quoted.

| # | mutation | what went red | message |
| --- | --- | --- | --- |
| 1 | a failed `git remote` falls through to `pushed` (**the mutation AC-3 names**) | `breaking git remote is answered honestly` | *breaking git remote did not produce the honest answer: expected `{ state: 'pushed' }` to strictly equal `{ state: 'indeterminate', reason: 'git failed' }`* |
| 2 | `...` for `..` in the count | AC-6 core + AC-6 board | *expected `{ ahead: 3 }` to strictly equal `{ ahead: 2 }`* — the fixture genuinely discriminates |
| 3 | a floor of 5 on the printed lag | **7 tests**, incl. AC-7 | *a lag of one printed nothing, so a floor was applied: expected null not to be null* |
| 4 | `no remote` renders instead of being suppressed | AC-10 | *a repository with no remote was told about push lag* |
| 5 | the legend uses containment's grammar + a CI claim | AC-8, AC-9 | *the unpushed legend spells a containment token: expected … not to match `/main:/`* |
| 6 | a CI claim with the sentence otherwise intact | AC-9 alone | *the board's output can be read as a claim about testing: `\bci\b`* |
| 7 | a `git fetch` added to `pushLag` | AC-4 core **and** AC-4 board, independently | *pushLag issued a git command that reaches the network: `git fetch --quiet`* **and** *FETCH_HEAD was rewritten with the same bytes* |
| 8 | `pushLag` removed from the barrel | 2 register tests | *expected `['containment']` to strictly equal `['containment','pushLag']`*; *the folder still contributes only `containment`* |
| 9 | a twelfth unrecorded export added to `git.ts` | the export pin | *expected `[…(10)]` to deeply equal `[…(9)]`* |

**Mutation 7 is the one worth reading twice.** The `.git/FETCH_HEAD` clause caught a fetch that left
the file's **bytes identical** — only the mtime moved. AC-4 asks for bytes *and* mtime, and this is
the measurement that shows why: a bytes-only assertion would have reported success over a real
network call.

**Mutation 6 exists because mutation 5 hid it.** In mutation 5 the positive clauses of AC-9 failed
first and short-circuited, so the forbidden-substring list never ran. A narrower mutation that keeps
the sentence intact was needed to show that list has a subject of its own. The test additionally
pins that the list recognises `'main was validated by CI'`, so it cannot go vacuous later.

---

## 4. Three defects I introduced and caught, recorded rather than quietly fixed

1. **A duplicate `remote add`** in the AC-3/AC-5 test — the fixture added a remote and then called
   `withUpstream`, which adds it again. Split into two fixtures.
2. **A stray `git init -q --bare` aimed at the project under test** in the AC-8 test, which would
   have re-initialised the fixture rather than creating a remote. It *passed* — `git init` on an
   existing repository is near-idempotent — which is the dangerous kind. Replaced by
   `remoteWithNoTracking`, whose remote directory is deliberately never initialised, because the
   state under test is a property of this repository's own configuration and reaching the far end
   would be a network call in everything but distance.
3. **The lazy fixture was built inside the shim.** After splitting the AC-3 loop into four tests
   (§5), the shared fixture became lazy — and its first use happened *inside* `counting()`, so the
   mutation that breaks `git remote` broke the fixture's own `git remote add`. That is a broken
   fixture wearing a failed assertion's clothes, and **splitting the test is what exposed it**: in
   the loop form the fixture was built before the shim and the bug could not exist. It is now built
   before the shim with a comment saying why.

Two fixture-integrity guards were added as a consequence, and they are the check on the checks:
`tracking()` and `withUpstream()` each **assert their own topology** — ahead by exactly *local*,
behind by exactly *remoteAhead* — because every claim about the count tells one number from another,
and a divergence that silently failed to happen would make `ahead` and the symmetric difference
agree, leaving the discriminating tests passing while discriminating nothing.

---

## 5. The git-identity sweep is intermittently red, on a test this ticket did not touch

**Measured: 3 red in 13 sweeps at this tip.** The failing test, captured in full:

```
FAIL src/adapters/codex.test.ts > AC-4 — argv is built from the capabilities module and is
     byte-identical to the spike > --ignore-user-config is unconditional, on every combination
Error: Test timed out in 5000ms.
```

**This is Q-0102's subject, and Q-0102's reopening threshold 2 is met exactly** — *"a local sweep
failing at a tip whose unswept suite passes"*. The unswept suite passes: 24/24 turbo tasks, 0 cached,
repeatedly. It is a **timeout, not an assertion**, in `codex.test.ts`, a file this ticket does not
touch, against Vitest's 5-second default — which is the leading hypothesis Q-0102's own body names
(*"no `testTimeout` anywhere in the tree, so Vitest's 5-second default governs"*).

**What I can and cannot separate, stated plainly.** The three reds all fell in the earlier part of
this session, while builds and test runs were executing concurrently; the last **5 sweeps are
consecutively green** with nothing else running. That is consistent with load, which is Q-0102's
hypothesis. It is *not* consistent with Q-0102's recorded baseline of 0-in-36, and I cannot exclude a
contribution from this ticket: it adds git-spawn-heavy tests to the same package, and more
contention makes a borderline test likelier to cross 5 s. **A clean A/B against the base commit is
what would separate the two, and I did not run one** — it needs a second checkout, and Q-0102's GO-1
(*establish a failure rate at a fixed commit before repairing*) makes that measurement that ticket's
work rather than a thing to do in passing.

**I did not fix it, deliberately.** §5 of the requirement lists *"Any change to what the
git-identity sweep runs. Q-0102's GO-2 applies here unchanged"* as a non-goal, and adding a
`testTimeout` would be changing what the sweep runs on a ticket that is not about it.

**What I did do**, because it is inside my scope and was measurable: my own heaviest new test was
**1395 ms unloaded and 3540 ms under sweep load** — four shim installations plus four probes in one
`test()`, sitting under the same 5-second cliff. A test that is merely *near* a timeout has a verdict
that is a property of the machine, which `harness/rules.md` forbids. It is now four `test.each` cases
sharing one fixture, **worst case 423 ms**, with no assertion weakened: the same four mutations run,
each inside its own budget. The reasoning is in the code, citing Q-0102 by name.

---

## 6. Deliberately left alone

- **One pre-existing lint warning**, `packages/core/src/backlog/backlog.ts:276` — *"Unused
  eslint-disable directive (no problems were reported from 'no-control-regex')"*. A file this ticket
  does not touch; `pnpm lint` is 0 errors. Reported, not migrated in passing, per the engineering
  rule.
- **A documentation prose scan I wrote and then removed.** I drafted an assertion scanning the
  numbered documents' push-lag sentences for the words AC-9 forbids. **The first thing it fired on
  was the glossary's own prohibition** — it cannot tell a claim from a rule quoting one. AC-9's
  forbidden-substring treatment belongs to the *rendered output* and is asserted there over the
  board's real output; what prose can honestly be held to is that the refusal is present, which is
  what AC-13 asks for and what the shipped assertions check. The reasoning is recorded in the test
  file so nobody re-adds it.
- **`spike/`** is not in `developer-generalist`'s paths and does not exist; no reference to it was
  added.
- **`backlog/`** — nothing written. **`docs/decisions/`** — nothing added; GO-1's entry was already
  there and is cited, never transcribed.
- The board's help line (`commands.ts:66`), per §5.
- Q-0104's and Q-0102's subjects.

---

## 7. Verification

- **`pnpm turbo run build test lint typecheck --force --continue` → 24/24 tasks, 0 cached.**
  `@quorum/core` 1305 passed / 2 skipped, `@quorum/cli` 576 passed, `@quorum/shared` 147 passed,
  the four scaffolds 1 each. Lint 0 errors (1 pre-existing warning), typecheck clean.
- **Through the real emitted binary.** `pnpm exec quorum board` renders the whole board and exits 0.
  It prints **no push-lag line, and that is the correct answer**: measured independently,
  `git rev-list --count refs/remotes/origin/main..refs/heads/main` is **0** and `main`'s upstream is
  `refs/remotes/origin/main`, so the state is `pushed` and `pushed` is silent.
  *(The requirement's M-1 measured 2 ahead at `3cf03ca`; the three Q-0105 commits have since been
  pushed. The instrument's first live reading on its own repository is therefore `pushed` — correct,
  and worth recording since silence is the state a reader has least evidence for.)*
- **The silence is the `pushed` branch and not a swallowed exception**, which was proven rather than
  assumed: rendering `pushed` temporarily, rebuilding, and running the binary printed
  `· push lag = main TEMPORARY PROBE, state=pushed`. The probe was then reverted and the emit
  rebuilt.
- **`pnpm sweep:git-identity`** — green, 5 consecutive runs at the delivered tip; §5 records the
  three earlier reds and their cause.
- **`git status`** — 16 modified, 1 new, no strays. Nothing committed.

---

## 8. What is still owed, and one judgement the human may want to overrule

**GO-2 and GO-3 are the human's and are untouched.** GO-2 — `CLAUDE.md:13`'s term list gains
`push lag`; that file is outside this role's write paths, Q-0103's E-2 ruled it *"stays the human's,
being the vendor dialect of the canonical harness"*, and I re-measured the requirement's claim that
**no assertion in `packages/` reads that list**: it holds. GO-3 — push the merge and watch CI go
green — is what this ticket cannot close without refuting itself.

**The date.** The status lines and the new `docs.test.ts` assertion carry **2026-09-06**, the date on
decision 080 and on the merged requirement, and the date this run began. The date rolled over to
**2026-09-07** while the run was executing. I chose 2026-09-06 so that a status line does not read
later than the decision it implements; if the human prefers the true landing date, it is a **three-line
change**: the two status lines and one literal in `packages/shared/src/docs.test.ts`.

**Nothing in the requirement was ambiguous enough to stop on**, and nothing was improvised: where §3
and AC-2 could be read as disagreeing about `null`, §1 above shows they do not. AC-12's undercount is
reported rather than treated as licence — every register moved is one the suite forced, each shown
refusing the value it replaced.
