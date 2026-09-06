# Q-0100 — implement report, run 2 iteration 5

**Round 5 implements `requirements/errata.md` E-2 and nothing else.** One file changed,
`packages/cli/src/binary-name.test.ts`: 160 insertions, 52 deletions. AC-1 to AC-14 are untouched
and not re-opened, per E-2 condition 3.

---

## What E-2 rules, and what round 4 got wrong

E-2 amends E-1 rather than adding to it. E-1 said the scanner *"detects syntax it cannot lex and
refuses"*; round 4 read that as **constructs**, closed the constructs, and left the *unterminated*
case ending the scan quietly. Review iteration 4 found the survivor: an unterminated block comment
made `scan()` return the end of the file, so a fixture whose whole body sits inside the comment
produces no literals and the guard reports success over a module printing the old binary name.

The reformulation is what ends the list, and it is why this round has a finish line where the three
before it did not. **"Unterminated X" is not a set of constructs to enumerate; it is one predicate
over the lexer state at end of input**, and a lexer has finitely many states. Whatever state the
scan ends in, if it is not the default one the input was not lexable and the scan is refused. There
is no fifth case to find after the fourth.

---

## The change, file by file

### `packages/cli/src/binary-name.test.ts` — the only file changed

**Four states, named as the message names them.** `STRING`, `TEMPLATE`, `BLOCK_COMMENT` and
`REGEX`, with `interface Open { state; at }` recording which construct was entered and the offset of
the character that opened it. `REGEX` is spelled *"a possible regular-expression literal"* because
`readSlash` has no grammar and cannot tell one from division — the JSDoc says so rather than the
name overclaiming.

**Every function that enters a state pushes it and pops it on the way out.**

- `readLiteral` pushes `TEMPLATE` or `STRING` by delimiter, and pops only when the closing delimiter
  is found. Its old inline `refuse` for an unterminated literal is gone: it now returns without
  popping and without collecting a value, so the EOF check reports it with the other three. Same
  behaviour, one reporting site.
- `scan`'s block-comment branch pushes `BLOCK_COMMENT` at the opening `/*` when there is no `*/`
  below, instead of returning quietly. **This is round 4's finding and the only behaviour that was
  silent before this round.**
- `readSlash` pushes `REGEX` at the `/` and pops on both of its classifying exits — a newline, or a
  closing `/` with a quote-free body. Its third exit, the refusal, is unchanged. Its **fourth** case
  is new and is not decided there: the input running out before either a terminator or a newline
  leaves the state open, and `literals` reports it.

**One check, in one place.** `literals()` builds the scan's state, runs it, and refuses if anything
is still open:

```
a-module.ts:1 (offset 0): the file ended inside a block comment, which opened here and was never
left, so everything after this point was read as its contents and inspected by nobody —
see requirements/errata.md E-1, E-2
```

**`refuse` and the three scanner functions now take one `Scan` value** — `{ text, where, found,
open }` — rather than four to six positional parameters each. This is the one shape change beyond
the strict minimum and it is deliberate: the state stack has to reach `scan`, `readLiteral` and
`readSlash`, which already call each other, and threading it positionally would have made
`scan(text, from, found, inside, where, open)` a six-parameter function with two of them a boolean
and a string. No logic moved with it; every hunk in the diff is either the rename `text` → `s.text`
or one of the push/pop lines listed above.

**Test clause (9), new**, with the four fixtures E-2 condition 2 requires, each asserting the state
by name and the offset where it opened; plus the nesting assertion described below, plus two
discrimination twins showing the refusals have subjects — a *closed* block comment one line up
collects the sentence beneath it, and a `/` on a line that ends does not refuse. Clause (8) keeps
the construct refusal it already had; its unterminated-string assertion moved into (9) with the
other three rather than being duplicated. The `describe` title moves from *"five"* to *"six"* scanner
clauses. Header JSDoc, `refuse`, `readSlash`, `readLiteral`, `scan` and `literals` all gained the
paragraph naming the invariant.

---

## The one place E-2 is silent, reported rather than decided quietly

E-2 says the refusal names *"the state"* and *"the offset where that state was entered"*, singular.
**Under nesting there are two or more**, and the ruling does not say which. `const a = \`x${'y\`;`
leaves a template open at offset 10 and a string open at 14; the regex fixture leaves `REGEX` open
at 11 and, one character later, a string at 13.

I chose the **outermost** — the first construct that never closed — on the reasoning that it is the
cause and the states nested under it are consequences of the file already having been misread. It is
pinned by an assertion in clause (9) and by mutation 5 below, so a later reader meets a decision
rather than an accident. **If the reviewer prefers the innermost, that is one character in
`literals()` and two assertions**; it does not touch the invariant.

The other reading of E-2's phrasing that I did *not* take: reporting every open state rather than
one. It is more information and a worse message, and E-2 says "the state".

---

## How each state was shown red — five mutations, each reverted

Per *"A check is not established by reading it"* (2026-08-29). Each mutation was applied alone, the
CLI suite run forced, then reverted; the final diff was grepped for residue on every state-tracking
line and is clean.

| # | mutation | result |
| --- | --- | --- |
| 1 | `scan` returns on a missing `*/` without pushing `BLOCK_COMMENT` — **round 4's tree** | red: *"round 4's finding: expected [Function] to throw an error"* |
| 2 | `readLiteral` pops unconditionally instead of returning on EOF | red: *"a string ran to the end: expected [Function] to throw an error"* |
| 3 | `readLiteral` pushes `STRING` for every delimiter | red on the **template** fixture only, and it threw — the message named the wrong state, which is what pins the two names apart |
| 4 | `readSlash` pops after its loop | red: expected offset 11, got 13 — with the regex state popped the refusal comes from the *string* the misread `/` let open, which is the fallback, not the diagnosis |
| 5 | `literals` reports `open.at(-1)` instead of `open[0]` | red on the regex fixture, same offset 11 → 13 signature — the outermost choice is load-bearing |

Mutation 1 is the important one: it reproduces exactly what iteration 4 reported, and the assertion
that catches it is the assertion E-2 asked for.

**The residual limit E-2 itself records, restated so nobody re-derives it as new:** the corpus is
covered by `pnpm typecheck`, so an unterminated construct makes the tree red for a louder reason
first, and the silent path is only reachable in a tree already failing. It is fixed anyway because a
guard with a known silent path is the defect this guard exists to prevent. **Nothing in the live
tree exercises the new check** — every subject file lexes cleanly — which is why all five
demonstrations are mutations and fixtures rather than observations.

---

## Verification

Run in this worktree after `pnpm install --frozen-lockfile`, which is `commands.install` verbatim.

- **`pnpm turbo run test lint typecheck --force --continue`** — **21/21 tasks, 0 cached.**
  `@quorum/cli` **566 passed** (565 before this round; clause (9) is the one added test),
  `@quorum/core` 1285 passed / 2 skipped, `@quorum/shared` 143 passed. Lint **0 errors**, typecheck
  clean.
- **`pnpm sweep:git-identity`** — exit 0, three consecutive runs, printing *"environment
  discriminates (negative and positive probes both as expected)"* and *"the workspace suite executed
  and green with no resolvable git identity"*. **Q-0102's flake did not reproduce here**, which is
  reported as an observation and not as evidence about that ticket.
- **The guard still has its subject.** `git grep` for a command-shaped `harness …` across
  `packages/cli/src/*.ts` production and `packages/core/src/backlog/project.ts` returns exactly one
  line, `validate.ts:12`, which is inside a past-tense provenance paragraph citing
  `spike/bin/harness.js:426–461`. AC-3 excludes that class by name and Q-0103 AC-19 forbids
  rewriting it; AC-4's literal-only condition is what keeps the guard from demanding it.

---

## What I deliberately left alone

- **AC-1 to AC-14.** E-2 condition 3: *"Change nothing else."* All eight printed sites still name
  `quorum`; `project.ts` still keeps `harness/harness.yaml` as the folder beside a `quorum init`
  command; the ten pinning test files, the four folder-only assertions (AC-8), the through-the-binary
  verification (AC-9) and the three documents (AC-11) are as round 2 left them. No round since round
  2 has disputed any of it.
- **`packages/core/src/backlog/backlog.ts`.** Round 1's scope violation stays reverted;
  `git diff main` over that file is empty.
- **A pre-existing eslint warning, reported and not fixed:** `packages/core/src/backlog/backlog.ts:276`
  — *"Unused eslint-disable directive (no problems were reported from 'no-control-regex')"*. It is 0
  errors, it is byte-identical to `main`, and it is outside AC-13's confinement. Ground rule 3.
- **The scanner did not become a TypeScript parser**, which is E-1's ruling and the reason this round
  is bounded. It still lexes what it claims to lex and refuses everything else.
- **`contracts/**`, `docs/decisions/**`, `docs/06-development-plan.md`, `CLAUDE.md`,
  `.claude/rules/**`, `harness/**`, `packages/cli/templates/**`** — AC-13's boundary, unchanged.
  The 11 occurrences across the four frozen contracts are still owed a report at the gate, and
  Q-0068's BYOS refusal string is still preserved (AC-14).

## Nothing is blocked

E-2 gave this round a finish line and the round reached it. No erratum is owed, no criterion was
found wrong, and no finding was refused.
