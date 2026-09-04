# Implement report — Q-0094, run 2, iteration 3

Revision round against `review/chore/run-2/chore-iter-2.md`, which returned **three majors**. One is
accepted in full, one in part, and one is refused with a measurement. Four files changed, **13
insertions and 16 deletions** — this round removes more than it adds, which is what two of the three
findings asked for.

`requirements/errata.md` **E-1** was read before starting. It rules review iteration 1's second major
(the angle brackets) refused and upholds the implement step's refusal, and it confirms that iteration
1's first major — the readline handle left open on `SIGTERM` — was real and that iteration 2's fix
stands. Neither is re-opened here; `gate.ts:248` still prints `pass --gate-answer advance|retry|abort`
with no brackets, unchanged and verified.

---

## Finding 1 — `docs/04-architecture.md:70` — **partly accepted**

> *This numbered architecture document is changed even though §8 explicitly says no numbered document
> claims anything this ticket changes and that documentation is untouched. Revert the Q-0094
> architecture additions and leave documentation updates to their owning work.*

Iteration 1 made three changes to this file. They are not one act, and they are resolved separately
rather than averaged.

**(a) A new paragraph describing where `run`'s division between the CLI and `core` falls — removed.**
No rule compels it. Three siblings each added one (Q-0091, Q-0092, Q-0093), which is precedent and
not an obligation, and the requirement authorises nothing here. The reviewer is right about this
part, and it is gone.

**(b) `Since Q-0093 it dispatches five commands` → `Since Q-0094 it dispatches six commands` —
kept.** This one is not a documentation update looking for an owner; it is a sentence this change
makes false. Measured against the tree rather than argued: `main.ts:59–69`'s `HANDLERS` has seven
entries — `help`, `init`, `ticket`, `run`, `lint`, `validate`, `runs` — so six commands beside the
help. Before `run` landed there were five, and the sentence was true. After it lands the sentence is
false, and `harness/rules.md` is unconditional about what happens next:

> When code and docs disagree, the docs are wrong until a DECISIONS entry says otherwise — fix them
> in the same change.

Reverting it ships a numbered document making a false count claim on `main`, which is the drift class
this repository has recorded more often than any other.

**(c) The status-line entry — kept, and rewritten to describe only what (b) leaves.** The docs rule
requires the status line to be bumped by any edit to a numbered document, so keeping (b) requires
keeping an entry. It no longer advertises a paragraph that is no longer there; it says the count was
the whole change and names why the exception exists.

### On §8's wording, precisely

§8's Docs row carries two claims, and they are not the same claim:

| claim | scope | true? |
| --- | --- | --- |
| *"No numbered doc claims anything this changes."* | general | **false of exactly one sentence** — `04-architecture.md`'s command count |
| *"`docs/02-sdlc-pipeline-spec.md`'s §5 snippets are generated from `harness/flows/` and are untouched."* | that file's §5 | **true** — `02-sdlc-pipeline-spec.md` is not in this ticket's diff at all |

The review paraphrases these as *"documentation is untouched"*, which widens the second claim from
`02`'s §5 snippets to every document. The narrower reading is what §8 says, and under it the only
question left is whether the general claim is accurate. It is accurate about every numbered document
except one sentence, and §8 itself is labelled *"constraints on the change, not acceptance criteria"*
— a statement of fact rather than a prohibition. A false statement of fact does not create one.

**Net effect on the file: 2 insertions, 2 deletions** against its pre-Q-0094 state — the count
sentence and its status-line entry, and nothing else.

**Stop-and-report:** if the gate reads §8's general claim as binding rather than descriptive, the
correct repair is an erratum ruling that this ticket ships the count sentence stale and that Q-0099
or Q-0095 corrects it to seven or eight. I cannot write that: `requirements/errata.md` is under
`backlog/`, which no agent on this route may write. This is *"A refused finding is a gate, not
another round"* (2026-08-31) and Q-0083's absence, and it is why the disagreement is two lines wide
rather than a paragraph.

---

## Finding 2 — `docs/06-development-plan.md:770` — **accepted in full**

> *This corrects an existing planning-text defect outside all acceptance criteria … Revert this
> correction and report it for its owning requirements/documentation process.*

Reverted. `git diff HEAD~2 -- docs/06-development-plan.md` is **empty** and the file no longer
appears in this ticket's `git diff HEAD~2 --name-only`, so it is byte-identical to its pre-Q-0094
state rather than merely close to it.

The reviewer is right, and the distinction from finding 1 is what makes both answers consistent. That
bullet's claim — *"three meaning nobody was there"* — was wrong **before** this change and is wrong
**after** it. My code does not falsify it; it is a pre-existing prose defect, and ground rule 3 says a
known defect is reported rather than fixed in passing. The architecture sentence is the opposite case:
true before, false after.

The requirement anticipated this and said where the fix belongs. §0 opens:

> *The body is the human's and an agent's edits under `backlog/` are discarded, so these are stated
> for the gate to apply rather than corrected in place.*

**Reported, not fixed:** `docs/06-development-plan.md`'s Q-0094 bullet still reads *"the five throw
sites Q-0040 classified — three meaning nobody was there"*. §0(a) measured five sites: **two**
`GateUnansweredError` sites that exit 3, and **three** operator errors that exit 1. The third
`GateUnansweredCondition`, `no-answer-channel`, is `core`'s and is unreachable from a CLI that always
supplies an `answerGate`. `packages/core/src/spike-parity.test.ts:249` has carried the correct split
since Q-0040. The stated arithmetic — three plus five against a total of five — cannot hold on any
reading.

---

## Finding 3 — `packages/cli/src/run.ts` and AC-1(3)'s `cmd` — **refused on the handler, accepted on the coverage**

> *AC-1(3) requires the handler to read `cmd`, `rest`, `flags`, and `gateAnswers` from the supplied
> `ParsedArgv`, but the handler destructures only the latter three and the tests do not enforce the
> missing `cmd` clause. Update the handler and source-level coverage so all four fields are consumed
> without introducing another parser.*

### Why the handler is not changed

**`cmd` is the key this handler was reached through.** `main.ts:83–84` is
`if (cmd !== undefined && isCommand(cmd)) await HANDLERS[cmd](parsed)`, so by the time `runOn`'s
closure runs, `cmd` is `'run'` by construction. A handler does not read it; it *is* what reading it
selected.

**There is no use for it, and I looked for one.** `USAGE` is required verbatim by AC-1(1), so
interpolating `cmd` into it would make a preserved spike string depend on dispatch to reproduce bytes
it already reproduces. Nothing else in the 80-line body has a use.

**So "consuming" it can only mean a dead binding, and I measured that the toolchain would let one
through.** `tsconfig.base.json` sets `strict: true` and **no `noUnusedLocals`**; `eslint.config.js`
enables exactly three rules and **no `no-unused-vars`**. `return async ({ cmd, rest, flags,
gateAnswers }) => {` therefore compiles and lints clean while `cmd` is never read — a name added to
satisfy a check rather than to do work. That is the shape this repository has found and refused most
often, most recently as Q-0050's five assertions that could not fail.

**The precedent is one ticket old and on the identical wording pattern.** Q-0091's AC-2 said `lint`
*"reads neither"* `flags.project`, and AC-4 said both commands must call `loadProject`. Both were
wrong, the implementer proved it, and `06-development-plan.md` records the ruling:

> *AC-2's aside described the case block while its normative half, no command re-parses the command
> line, binds and is met.*

AC-1(3) has the same two halves and even names its own enforcer: *"and calls no parser of its own
(Q-0091 AC-2, enforced by `frame.source.test.ts`)"*. That guard scans every command module for
`process.argv|parseArgv(` and reports `[]`; it is green, and it has a subject — the companion test
shows both patterns matching real text in the frame.

**Where the four-name list comes from.** It is `main.ts`'s own JSDoc, which the requirement is
restating: *"the spike's eight cases read `cmd`, `rest`, `flags` and `gateAnswers` out of module
scope … so every one of them sees all four."* In the spike those four are module-scope variables and
`switch (cmd)` is the dispatch — so the spike's `run` **case body** does not read `cmd` either. The
list describes the contract the frame offers, and this handler satisfies it by being handed all four.

I am not yielding on this one, and the reason is written down rather than stylistic: Q-0052's round-3
yield — shipping a change to satisfy a criterion nobody had re-measured, and deleting the pin that
recorded the divergence — is named in the plan as the mistake not to repeat, and it had to be undone
by hand after its gate.

### What is changed — the coverage half

`packages/cli/src/main.test.ts` — the dispatch block runs `test.each([...COMMANDS])`, so it already
covers `run`. It compared structurally and then named **three** of the four fields one by one, for
the reason its own comment gives: a comparison against `parseArgv`'s output *"would still hold if
both sides lost a field."* `cmd` was the one not named. It is now:

```ts
expect(seen[0]?.cmd).toBe(name);
```

**Mutation-tested rather than read.** With `main.ts` handing the handler `{ ...parsed, cmd: undefined }`,
exactly one file fails — `src/main.test.ts`, seven tests, one per command, `run` among them — and the
other 18 files stay green. Restored and re-run clean afterwards.

**The honest limit, stated rather than glossed.** The `toStrictEqual([parseArgv(argv)])` line above
fails on that same mutation, so the new assertion is a **named restatement of the fourth field in the
same shape as its three neighbours, not an independent oracle.** The property its neighbours have —
catching a `parseArgv` that dropped a field on *both* sides of the comparison — could not be isolated
for `cmd`: I tried it, and a `parseArgv` that returns no `cmd` breaks dispatch itself, turning 20-odd
test files red across `argv`, `build`, `gate`, `init` and the rest, so nothing is isolated by it. I am
recording that rather than claiming a mutation I did not achieve.

`packages/cli/src/run.ts` — five lines of authority comment at the destructure, per the comments rule
that one line names why something is deliberately strange. It cites `main.ts`'s dispatch, Q-0091's
AC-2 as the precedent for which half binds, and `main.test.ts` as where all four fields are pinned.
No behaviour changed; `run.ts`'s diff is comment only.

---

## File by file

| file | change |
| --- | --- |
| `docs/06-development-plan.md` | **Reverted whole** (finding 2). Byte-identical to pre-Q-0094; no longer in the ticket's diff. |
| `docs/04-architecture.md` | The `run` paragraph removed; the count sentence and its status-line entry kept and the entry rewritten (finding 1). Now **+2 −2** against pre-Q-0094. |
| `packages/cli/src/main.test.ts` | `expect(seen[0]?.cmd).toBe(name)` added to the dispatch block, and the block's comment extended to say why the fourth field is named here rather than in a command module (finding 3). |
| `packages/cli/src/run.ts` | Five-line authority comment at the handler's destructure. **No behaviour change.** |

## Deliberately left alone

- **Everything from iterations 1 and 2 that no finding names** — `gate.ts`, `trace.ts`, `commands.ts`,
  `index.ts`, `lint.ts`, `run.test.ts`, `gate.test.ts`, `trace.test.ts`, `frame.source.test.ts`,
  `test/invoke.ts`, `spike-parity.test.ts`.
- **E-1's subject.** `gate.ts:248` prints `pass --gate-answer advance|retry|abort` with no angle
  brackets. Confirmed unchanged; E-1 upheld the refusal.
- **Iteration 2's `SIGTERM` fix**, which E-1 explicitly separates from its ruling and calls real.
- **`spike/src/` and `spike/test/`** — untouched (ground rules 1 and 2), confirmed by the ticket's
  full file list.
- **`docs/02-sdlc-pipeline-spec.md`** — untouched, so §8's specific claim holds.
- **The `@quorum/core:lint` warning** at `backlog.ts:276` (unused `eslint-disable` directive).
  Pre-existing, in a file this ticket does not touch.

## One thing I created and removed

An early `npm install --prefix spike` of mine ran from `packages/cli/src` rather than the repository
root and left an untracked `packages/cli/src/spike/package-lock.json`. It was mine, it was junk, and
`git add -A` would have swept it into the commit. Removed; `git status` shows only the four modified
files. `spike/node_modules` is present and the spike suite runs.

## Verification — forced, on the final tree

| | |
| --- | --- |
| `pnpm turbo run lint typecheck test --force` | **21/21 tasks, 0 cached.** `@quorum/cli` 19 files / **422 tests**, `@quorum/core` 58 passed 1 skipped, `@quorum/shared` 12 passed |
| `npm test --prefix spike` | **19/19 test files passed** |
| `node spike/bin/harness.js lint` | **6/6 flows** |
| `pnpm sweep:git-identity` | **exit 0** — *"both suites executed and green with no resolvable git identity"* |

The sweep was run **twice**. The first run overlapped my mutation experiments, so its verdict could
not be attributed to the final tree and is discarded rather than reported; the figure above is the
re-run after every mutation was restored and `git status` showed only the four intended files.

## For the gate

1. **The `04-architecture.md` disagreement is unresolved by design and is two lines wide.** §8's
   general Docs claim is false of exactly one sentence, and the standing docs rule requires that
   sentence to be fixed in this change. If the gate reads §8 as binding, an erratum ruling the count
   stale is the repair — and it is the human's to write, because no step on this route may.
2. **`docs/06-development-plan.md`'s Q-0094 bullet still carries the arithmetic §0(a) disproved.**
   Reverted here on the reviewer's finding, and reported so it does not expire.
3. **AC-1(3)'s `cmd` clause is refused, not overlooked.** If the gate rules against me, the change is
   one dead binding in `run.ts` and it costs nothing to make — but it should be an explicit ruling
   that a dead binding is wanted, not a fourth round discovering the same measurement.
