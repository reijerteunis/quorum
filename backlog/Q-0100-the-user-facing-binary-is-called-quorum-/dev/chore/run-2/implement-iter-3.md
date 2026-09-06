# Q-0100 — implement, run 2, iteration 3

A revision round. Run 2's review returned one major in iteration 2; iteration 1's two are checked
and still closed. **One file changed this round**, `packages/cli/src/binary-name.test.ts`. The eight
sentences, the ten pinning test files and the three documents are byte-identical to what iteration 2
landed.

One deliberate widening is inside that file and is flagged in §3 rather than buried: a third
instance of the reported defect class is **live in the subject**, and I fixed it. It is the gate's
to rule.

---

## 1. The finding, and what closes it

> **major: `packages/cli/src/binary-name.test.ts:121`** — the scanner decodes only `\n`, `\t` and
> `\r`; every other escape is reduced to the character immediately after the backslash. So
> `'harness\x20init'` or the Unicode form is interpreted as whitespace-free
> (`harnessx20init` / `harnessu0020init`) and filtered out even though the runtime prints
> `harness init`. This lets a user-facing sentence name the wrong binary while AC-4 remains green
> … Parse literals with TypeScript-aware tooling, or correctly decode JavaScript escape forms, and
> add discriminating tests for hexadecimal and Unicode whitespace escapes.

**Accepted in full.** The finding is correct, its mechanism is correct, and its consequence is
correct: the guard was green over exactly what it exists to catch. It is also correct that lines
76–77 claimed something false — *"every other escape decodes to the character it escapes, so `\x1b`
is `x1b`"* — a comment promising what the code beneath it did not do, which is the defect class this
repository has recorded on Q-0092, Q-0097 and Q-0053, landed inside the guard written to enforce a
naming rule.

### Which of the two remedies, and why — measured, not preferred

The reviewer offered TypeScript-aware parsing first. **I refused it on three measurements**, and
record them so the refusal is checkable rather than asserted:

1. **`typescript` is not resolvable from `packages/cli`.** There is no
   `packages/cli/node_modules/typescript`; it is a root devDependency only.
2. **Declaring it edits two files AC-13 confines this change away from.** AC-13's list is
   `packages/cli/src`, `packages/core/src/backlog/project.ts`, their tests, and AC-11's three
   documents. `packages/cli/package.json` and `pnpm-lock.yaml` are on neither side of that line.
   Round 2's second major blocked a one-line comment edit for exactly this reason; a manifest and a
   lockfile are a larger version of the same move.
3. **It would weaken a landed pin.** `packages/cli/src/package.test.ts:43–51` asserts
   `dependencies` is exactly the two workspace packages and `devDependencies` is `undefined`, under
   the title *"declares the two workspace dependencies and no third-party one"*. Adding a
   devDependency means editing that assertion to accommodate this ticket.

So I took the second remedy, which the reviewer named and which needs no manifest change:
**correctly decode JavaScript escape forms.** If the gate prefers the AST route, it is an erratum
and a wider AC-13, not something an implement step may decide for it.

### What replaced the table

`WHITESPACE_ESCAPES` (three entries) is gone. In its place:

| symbol | what it is |
| --- | --- |
| `CONTROL_ESCAPES` | all seven single-character forms — `\b \f \n \r \t \v \0`. Five print as whitespace; `\v` and `\f` were two the old table missed, so they were a second live instance of the reported defect. |
| `HEX`, `codeUnit`, `codePoint` | `\xHH`, the four-digit `\u` form, and `\u{…}` — the three escaped spellings of a space the finding names, plus every other code point. |
| `UNREADABLE_ESCAPE` | a **space**, deliberately: what a malformed escape decodes to. |
| `escapeAt` | returns the printed value **and the span**, so the scanner consumes the whole sequence rather than one character. |

**The property the shape rests on, stated once in the JSDoc and pinned in the tests:**
*under-reading whitespace is the only direction that can hide a sentence.* Over-reading it can only
put a literal in front of the filters, which then refuse it or do not. Two consequences fall out of
that asymmetry rather than being chosen:

- a malformed escape (`'\xZZ'`) decodes to a space, not to its own characters — unreachable over the
  subject, because `typecheck` reads every file this scan reads and that is a syntax error, so it is
  pinned here or nowhere;
- the two exotic line terminators a continuation may cross (U+2028, U+2029) are **not** special-cased
  and fall through to the identity branch, where they decode to themselves — which `\s` matches, so
  they read as a sentence rather than as nothing. Deliberate, stated in the JSDoc, and it keeps two
  invisible characters out of a source file.

---

## 2. Red before green, on a real module rather than on a fixture

AC-10's discipline applied to the guard itself. Both demonstrations plant the evasion in a
throwaway production module under `packages/cli/src/` — which `production()` picks up from the tree,
so it is the real scan over a real subject — and were then deleted. `git status` is one modified
file.

**The reported evasion, `'harness\x20init'`:**

| scanner | AC-4's verdict |
| --- | --- |
| the three-entry table | **passes.** The module prints `harness init` and no assertion sees it. Only the new clause (7) fails. |
| the decoder that shipped | **fails**, naming it: `zz-evasion-probe.ts: harness init` |

An earlier probe of mine was not a clean evasion and is worth recording, because it shows how narrow
the hole is: `'usage: harness\x20run <flow>'` is caught **even by the old scanner**, since `usage: `
supplies whitespace of its own. The evasion needs the escape to be the literal's *only* whitespace —
which is precisely the string the reviewer wrote, and is why reading the finding rather than
paraphrasing it mattered.

---

## 3. A widening, declared: a third instance is live in the subject

While measuring the subject for residual under-read shapes I found one that is not hypothetical.

**`packages/cli/src/adapters.ts:108`** is a template literal **inside an interpolation inside a
template literal** — `console.log` of an outer template whose `c.dim(…)` argument is itself a
template — and it is **seven lines above `adapters.ts:115`**, one of the eight sentences this ticket
moves.

Against the scanner as iteration 2 landed it, the inner backtick closed the outer literal, the inner
sentence was then read as **code**, and the scan reopened at the inner closing backtick. The
sentence appears in no collected entry at all. Same failure as the finding, third spelling: the
filters never see it and AC-4 is green.

Demonstrated the same way, with a probe module using that exact shape:

| scanner | AC-4's verdict over a module printing `usage: harness run <flow>` |
| --- | --- |
| stops at the inner backtick | **passes.** Clauses (5) and (6) fail; AC-4 does not. |
| walks the interpolation | **fails**, naming both the inner sentence and the outer wrapper. |

**What I changed:** `literals` is now `scan` plus `readLiteral`. An interpolation's source is still
kept in the outer value — `board.ts:117` is a sentence with a flow name in the middle of it and half
of one is not what a user reads, which clause (5) has pinned since iteration 2 — **and** it is now
walked as code, because a delimiter inside it is not the outer literal's. A brace inside an
interpolation is followed rather than counted, so the `}` of an object literal closes what it opened.

**Why I did not merely report it, and why the gate should still rule on it.** Round 2's second major
was correct that an implement step may not widen an explicit scope boundary. I judged this to be
inside the boundary rather than past it: the same file, the same criterion (AC-4 and AC-5), the same
defect class as the finding, and no new surface. Against that, it is more than the review asked for,
and AC-5's numbered directions were three. **If the gate reads it as a widening, the clean
disposition is an erratum authorising AC-5 to grow the two clauses rather than a revert** —
reverting restores a guard measured blind to a shape its own subject uses one file away from the
sentence the ticket is named for.

One consequence to note, because it changes a pinned expectation from iteration 2: clause (5)'s
`c.green('✓')` fixture now yields **two** literals, the inner `✓` then the outer one, because the
literal inside the interpolation is collected. That is the fix, not a regression; the assertion was
updated with a comment saying so.

---

## 4. Run 2 iteration 1's two majors — checked, still closed

Neither was re-opened by this round, and I verified both rather than assuming iteration 2's work.

- **`binary-name.test.ts:100`, the escaped quote.** The parity fix stands: `escapeAt` consumes the
  whole sequence, so an escaped quote cannot terminate its own literal. Clause (4) pins it with the
  measured naive output — `['it', ';\nconst b = ', ';\n']` — and asserts the offending sentence
  after it is still collected. Clause (5)'s third assertion is the same property in the backtick
  delimiter. The finding also asked for template-literal coverage; that is clauses (5) and (6).
- **`packages/core/src/backlog/backlog.ts:155`, the out-of-scope edit.** Reverted in iteration 2 and
  still reverted: `git diff main --name-only` contains no `backlog.ts`. **The stale comment is
  therefore shipping**, and that is the correct outcome under AC-13, not an oversight — see §6.

---

## 5. File by file

**`packages/cli/src/binary-name.test.ts`** — the only file changed this round (+203 / −49).

- *Removed* `WHITESPACE_ESCAPES`, and with it the false claim in its JSDoc.
- *Added* `CONTROL_ESCAPES`, `UNREADABLE_ESCAPE`, `HEX`, `codeUnit`, `codePoint`, `escapeAt`.
- *Split* `literals` into `scan` (comments, interpolations, brace following) and `readLiteral`
  (delimiters, escapes, interpolation source), with `literals` now a three-line wrapper. The header's
  two scan conditions — literals not comments, whitespace not a name list — are unchanged, as is the
  reasoning for them and the 48-citation measurement behind it.
- *Extracted* `offending()` as a named helper, because AC-4's assertion and four discrimination
  clauses now run the same three-filter pipeline; each clause proves a sentence is **refused**
  rather than that a decoder returns the right bytes.
- *Added* clause **(6)** — a template inside an interpolation is read, not stepped over — and clause
  **(7)** — an escape decodes to what the user reads. (7) covers the four spellings of a space, the
  two control escapes the old table missed, the non-whitespace direction (`\x1b`, so `colour.ts`
  stays out of the subject and the guard stays passable), a line continuation printing nothing, and
  the malformed-escape fallback.
- *Renumbered* the new clauses so the file reads in order, and corrected the `describe` title.

**Everything else in the ticket's diff is iteration 2's and untouched**: the seven CLI sentences
(AC-1), `project.ts:33` (AC-2), the twelve deferral comments (AC-3), the sixteen assertion sites
across ten test files (AC-7), and `docs/GLOSSARY.md`, `docs/02-sdlc-pipeline-spec.md`,
`docs/03-adapter-contract.md` (AC-11).

---

## 6. Deliberately left alone

- **`packages/core/src/backlog/backlog.ts:155`.** Its comment still says `harness init` prints
  `harness run requirements T-0001`, which is now false of the product. Outside AC-13's list;
  reported here for the third time and not fixed.
- **The four frozen contracts** — `Q-0006/review-lint`, `Q-0006/review-runtime`,
  `Q-0011/runs-cli`, `Q-0033/cli-review-surface` — hold 11 occurrences between them and name a
  binary that does not exist after this ticket. `contracts/**` is not in the implement role's
  `paths:`. AC-13 reports this at the gate; it is still reported.
- **`docs/decisions/`, `docs/06-development-plan.md`, `CLAUDE.md`, `.claude/rules/`, `harness/`,
  `packages/cli/templates/`** — untouched, per AC-13.
- **The preserved defects of AC-14** — Q-0068's BYOS string, `adapters` exiting 0 with both CLIs
  absent, an unknown command exiting 0, `probeAdapter`'s null `usage`, `Backlog.create` defaulting
  `owner` to `process.env.USER`. None repaired in passing.
- **`init.ts:62` and `commands.ts:64`**, whose literals keep the word as a folder spelling and
  survive `FOLDER` stripped to nothing. That is the guard passing for the right reason.

---

## 7. Reported, not fixed — one residual under-read, measured

The scanner remains a scanner and not a parser, and one shape can still invert its parity: **a
regular-expression literal containing a quote or a backtick**. The scan would read the quote as a
delimiter, and every delimiter after it means its opposite.

**Measured over the subject: there are none.** No production module of `packages/cli/src` and not
`packages/core/src/backlog/project.ts` contains a regex literal at all. So this is a shape a future
module could introduce, not a hole open today — the same standing as the nested template had until
`adapters.ts:108` made it live.

I did not close it, and the reason is a judgement the gate may overturn: distinguishing a regex
literal from a division operator is the part of JavaScript lexing a hand-rolled scanner cannot do
without becoming a parser, which is the argument **for** the reviewer's AST route rather than an
argument inside it. If the gate wants it closed, the honest instrument is TypeScript's own scanner,
and that needs the AC-13 amendment §1 describes. I raise it rather than choosing.

---

## 8. Verification

Run in this worktree after `pnpm install --frozen-lockfile` (*"Already up to date"*, 177 ms), with
the commands `harness.yaml` gives `integrate` verbatim.

| check | result |
| --- | --- |
| `pnpm turbo run test --force --continue` | **7/7 tasks, 0 cached.** `@quorum/cli` 24 files, **564 tests** passed. |
| `pnpm turbo run lint typecheck --force --continue` | **14/14 tasks, 0 cached.** |
| `pnpm turbo run test lint typecheck --force --continue` (final, after the renumbering) | **21/21 tasks, 0 cached.** |
| `pnpm turbo run build --force` | 3/3, 0 cached — the emit the spawn-based tests use. |
| `binary-name.test.ts` alone | **11 tests passed** (was 10). |
| escape evasion planted in a production module | old scanner **green**, new scanner **red** naming the module. |
| nested-template evasion planted in a production module | old scanner **green**, new scanner **red** naming both literals. |
| clauses (5) and (6) against the pre-fix `readLiteral` | both **red**; restored, both green. |
| `git status` | one modified file; both probe modules deleted. |

**AC-9, stated precisely rather than claimed.** I changed no printed sentence this round, so the
through-the-binary coverage is what it was when iteration 2 was reviewed: the spawn-based fixtures in
`end-to-end.test.ts`, `init.test.ts`, `failure-paths.test.ts` and `build.test.ts`, all of which ran
forced and green above. I did **not** re-run the six commands by hand this round — the sandbox
refused the invocation — so this row is the suite's evidence and not a second hand verification, and
is written that way on purpose.

**Not run: `pnpm sweep:git-identity`.** Q-0102 has it red under load on `main`, at a commit before
this branch, and R-7 names it as a neighbour that can make this run look like this change's failure.
I did not run it and I am not reporting it as green.

---

## 9. Ambiguity or contradiction in the requirement

None found this round. AC-4 fixes the subject and the two scan conditions and leaves the scanner's
implementation to the implementer, which is why both the reported fix and §3's belong to it. The one
thing the requirement does not cover is **how much scanner is enough** — it names three
discrimination directions and the tree has since shown four. §3 and §7 are that gap reported rather
than decided.
