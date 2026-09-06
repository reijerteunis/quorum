# Q-0100 — implement round 4 (run 2, iteration 4)

**Scope: erratum E-1 only.** E-1 rules the guard's *failure mode* and says in as many words that it
"rules the guard's failure mode, nothing about AC-1 to AC-14", and that "the rest of the ticket is
done and is not re-opened". This round changed **one file**, `packages/cli/src/binary-name.test.ts`,
by +187/−36. `git status` is one modified file; no other source, test, document or backlog file was
touched.

---

## 1. What E-1 asked for, and what it got

E-1 gave round 4 a three-part finish line. Each is addressed below with where it landed.

| E-1 requirement | where it landed |
| --- | --- |
| 1. The scanner recognises the constructs it *can* lex, and on anything else **throws**, naming the file and the offset | `refuse()`, `readSlash()`, `SHEBANG`, and the end-of-file clause in `readLiteral()` |
| 2. The refusal is **demonstrated** — a fixture makes the guard red with a message identifying it, against a construct the scanner does not claim to handle | AC-5 clause **(8)**, plus four mutations in §5 |
| 3. The corpus is unchanged and the criterion it serves is unchanged | `production()`, `CORE_SUBJECTS` and AC-4's assertion are byte-identical; §7 |

It explicitly forbade two things, and neither was done: **no TypeScript-aware parsing** was added,
and the scanner **gained no fourth lexing rule** for a new construct. Nothing in the diff makes the
scanner able to *read* a regular expression. What it gained is the ability to say it cannot.

---

## 2. The measurement that decided the design

The obvious reading of "fail closed" — throw on every `/` that is not `//` or `/*` — was tested
against the tree before anything was written, because it is the reading that would have made the
guard unrunnable.

**Instrument.** `node` scripts are not executable in this environment, so the scan was reproduced as
a throwaway Vitest file inside `packages/cli/src` and deleted immediately afterwards
(`git status` confirms nothing survives). It ran round 3's scanner over the real subject with the
bare-`/` case instrumented instead of ignored.

**Result — five `/` characters reach code position across the whole 19-file subject**, and every one
of them is benign:

| site | text | what it is |
| --- | --- | --- |
| `quorum.ts:1` (×3) | `#!/usr/bin/env node` | the interpreter line |
| `runs.ts:136` | `` `duration=${(manifest.duration_ms / 1000).toFixed(1)}s` `` | division, inside a template interpolation |
| `trace.ts:66` | `` ` failed, retrying in ${Math.round(event.delayMs / 1000)}s` `` | division, inside a template interpolation |

**There is not one regular-expression literal in the corpus.** So the naive rule would have thrown
five times on the intended tree and the guard could never have gone green — and the only way to make
it green would have been to rewrite `duration_ms / 1000`, which AC-13 forbids and which would be
absurd besides. That is the finding that shaped everything below: **the refusal has to be narrow
enough to run, and the narrowing has to be a fact rather than a grammar.**

---

## 3. The design

### 3.1 `readSlash` — refuse what can corrupt parity, classify what cannot

The scanner cannot tell division from a regex literal without the preceding token, which is grammar
it does not have and (per E-1) does not acquire. But that is not the question it needs to answer.
The question is narrower and is answerable from characters alone: **could reading this `/` the wrong
way change the quote parity of everything below it?**

A regex literal must close on its own line, so its entire body lies between this `/` and the next
one before the newline. Three cases, and they are exhaustive:

1. **No `/` before the end of the line.** It cannot be a regex literal, so it is division. Nothing
   to misread → continue. *Both live sites are this case.*
2. **A closing `/` whose body carries no quote.** Read as a regex or read as code, the same literals
   are collected either way → continue.
3. **A closing `/` whose body carries a quote.** → **refuse**, naming file, line and offset.

Case 3 is exactly review round 3's finding. Case 1 is exactly what keeps the guard runnable.

The rule is **deliberately conservative in one direction and that cost is stated in the JSDoc**:
`a / b + 'x/y'` is division and would be refused, because the scanner cannot prove it is. That shape
does not occur in the subject; if one appears, the guard names the file and the offset rather than
guessing. Refusing a legible line costs a message; admitting an illegible one costs a false green.

### 3.2 `readLiteral` — a literal that never closes is refused, not swallowed

Reaching the end of the file means the delimiter this started from was not one, so the rest of the
module has silently become the value of a single string nobody inspects. That is E-1(1)'s "a skipped
construct is never silently tolerated" arriving as a *consequence* rather than as a construct.
Two lines; see §8 for why I judged it in scope.

### 3.3 `SHEBANG` — lexed, because otherwise the file's own claim was false

Writing the `scan` JSDoc forced the question *which constructs can hold a quote that is not a
delimiter?* The honest answer is **five**: a comment, a string literal, a template interpolation, a
regular-expression literal — and the interpreter line. Four were lexed; the fifth was being walked
as code, so `#!/bin/sh -c 'x'` would have opened a literal on the shebang's quote. Today's shebang
carries none, but "today's shebang happens not to" is precisely the reasoning E-1 rules against.

It is now lexed as the comment Node and TypeScript both treat it as — three lines, and it is
E-1(1)'s *first* half ("recognises the constructs it can lex") rather than a new special case. It
also removes three of the five code-position slashes, so **two remain** and the JSDoc says two.

### 3.4 `refuse` — the message

`<file>:<line> (offset <n>): <why> — see requirements/errata.md E-1`

E-1 asks for the file and the offset. The line number goes with it because an offset alone sends a
reader counting characters. Real example, from mutation C below:

```
colour.ts:11 (offset 543): this `/` opens a regular-expression literal whose body carries a
quote, or divides an expression that does; either reading changes the quote parity below it and
this scanner cannot tell them apart — see requirements/errata.md E-1
```

---

## 4. File by file

**`packages/cli/src/binary-name.test.ts`** — the only file changed.

| what | change |
| --- | --- |
| header JSDoc | new paragraph stating the fail-closed property and *why it is the property rather than completeness*, citing E-1 and the 2026-08-25 decision |
| `QUOTE` | new — the three delimiters whose parity `readSlash` protects |
| `SHEBANG` | new — the interpreter line, lexed (§3.3) |
| `refuse()` | new — throws naming file, line, offset and cause |
| `readSlash()` | new — §3.1, with the three cases and the conservatism cost documented |
| `readLiteral()` | gains `where`; refuses an unterminated literal (§3.2) |
| `scan()` | gains `where`; new `/` branch calling `readSlash`; JSDoc gains the five-constructs argument |
| `literals()` | gains `where` (documented as existing solely to name a file in a refusal) and skips the shebang; `@throws` documented |
| `offending()` | gains `where` |
| `FIXTURE` | new — `'a-module.ts'`, so clause (8) reads the message a real subject would produce |
| AC-5 describe title | "the four beside them" → "the five beside them" |
| ~28 fixture call sites | threaded `FIXTURE`; **no assertion changed** |
| AC-5 clause **(8)** | new — the demonstration E-1(2) requires |

Nothing else in the repository was edited. `packages/cli/src/colour.ts` was temporarily mutated for
§5 and restored byte-identically (confirmed by `git status`).

---

## 5. Demonstrated red, not asserted

Per *"A check is not established by reading it"* (2026-08-29), four mutations were run and each
observed failing.

**A — the `/` branch removed from `scan` (round 3's behaviour for slashes).** Clause (8) red:

```
expected [Function] to throw error matching /a-module\.ts:1 \(offset 11\)/
but got 'a-module.ts:2 (offset 60): a string l…'
```

Instructive: the fixture still throws, but via the *other* refusal at the *wrong* construct and the
wrong position. The assertion on `offset 11` **and** `regular-expression literal` is what
discriminates — a bare `.toThrow()` would have passed this mutation.

**B — the unterminated-literal refusal removed.** Clause (8) red: `expected [Function] to throw an
error`.

**C — the real corpus, which is the strongest of the four.** `const MUTATION = /['"]/g;` and
`const MUTATION_USAGE = 'usage: harness run <flow>';` planted in `packages/cli/src/colour.ts`.
AC-4's subject test goes red naming `colour.ts:11 (offset 543)`. This is the refusal firing on the
guard's actual corpus, not on a fixture.

**C′ — the counterfactual, and the reason C matters.** With mutation C still in place and *both*
refusals disabled — i.e. round 3's scanner — AC-4's subject test reports **`1 passed`** over a
`colour.ts` that prints `usage: harness run <flow>`. Round 3's review described this false green;
it is now measured.

**D — the shebang lexing removed.** Clause (8) red:
`expected [ 'x', 'usage: harness run' ] to strictly equal [ 'usage: harness run' ]` — the shebang's
quoted argument collected as a literal, which is the read-as-code path §3.3 closes.

---

## 6. Verification

Run in this worktree with `commands.install` and `commands.test` verbatim, so what I ran is what
`integrate` will run.

- `pnpm install --frozen-lockfile` → *"Already up to date"*, 175 ms.
- `pnpm turbo run lint typecheck test --force --continue` → **21/21 tasks successful, 0 cached**.
  `@quorum/cli`: 24 test files, **565 tests**, all passing. Run twice at the final state.
- `pnpm sweep:git-identity` → **exit 0**, three separate runs, both checkout cells each time, each
  printing *"environment discriminates (negative and positive probes both as expected)"*. R-7's
  Q-0102 flake did not reproduce here — reported as a data point, **not** as evidence it is fixed.
- `pnpm turbo run build --force` → 3/3, and the eight sentences re-checked **through the built
  binary**, since AC-9 exists because the reviewer cannot execute under `--sandbox read-only`:

| invocation | output | exit |
| --- | --- | --- |
| `quorum run` | `usage: quorum run <flow> <ticket> [--auto] …` | 1 |
| `quorum ticket` | `usage: quorum ticket new "<title>" --intent "..." [--id Q-0081]` | 1 |
| `quorum validate` | `usage: quorum validate <schema.json> <file…>` | 1 |
| `quorum board` | `→ quorum run requirements <id>` and four more columns | 0 |
| `quorum adapters` | ``run `quorum adapters --probe` before a real run`` | 0 |
| `quorum init /tmp/…` | `✓ harness/ and backlog/ created in …` / `  next: quorum adapters · quorum ticket new "…" · quorum run requirements T-0001` | 0 |

The eighth sentence — `core`'s — could not be provoked from this shell, because `--project <dir>`
reads the path directly rather than searching, and `cd` is unavailable here. It does not need me:
**`end-to-end.test.ts:778–790` spawns the binary in an orphan temp directory** and asserts
`no harness/harness.yaml found — run `quorum init` in your repo`, that `harness/harness.yaml`
survived, and that `quorum/quorum.yaml` does not appear. It passed in the forced run above. That is
AC-2, AC-9 and R-1 in one spawned process.

---

## 7. Deliberately left alone

- **AC-1 to AC-14.** Not re-opened, per E-1. All eight printed sites, `project.ts:43`'s dual-sense
  sentence, the sixteen assertion sites, AC-8's four folder-only assertions and the three documents
  are exactly as round 3 left them. Re-confirmed by `git diff HEAD`, which touches one file.
- **The scanned corpus.** `production()` still derives from `readdirSync` (AC-6) and
  `CORE_SUBJECTS` still holds its one entry. E-1(3).
- **AC-4's assertion.** Unchanged. Only what happens *before* it changed.
- **`UNREADABLE_ESCAPE`.** A malformed escape still decodes to a space rather than refusing. It is
  already fail-closed in the direction that matters — whitespace is what makes a literal a subject,
  so it makes the guard look harder — and changing it would be the fourth special case E-1 forbids
  and would move clause (7)'s pinned behaviour.
- **`lint.ts` and `runs.ts`'s comment edits** from earlier rounds. They are AC-3 catch-site
  deferrals; reviews 2 and 3 raised nothing outside `binary-name.test.ts`.
- **`docs/06-development-plan.md`, `docs/decisions/**`, `contracts/**`, `CLAUDE.md`,
  `.claude/rules/**`, `harness/**`, `backlog/**`.** AC-13; and the backlog is the harness's.
- **AC-14's five preserved defects.** Untouched.

---

## 8. Two judgement calls, flagged rather than buried

E-1 says the scanner "does not gain a fourth special case". Two things in this diff are near that
line and I would rather the reviewer rule them than have them discovered.

**(a) The unterminated-literal refusal (§3.2).** Neither E-1 nor any review round named it. I judged
it in scope because E-1(1) says *"A skipped construct is never silently tolerated"*, and a literal
running to end-of-file is the scanner having swallowed the remainder of a module — the silent skip
in its most complete form. It is two lines and cannot fire on a file that compiles. **If the
reviewer reads E-1 as ruling only the regex case, deleting it costs the last assertion of clause (8)
and nothing else.**

**(b) Lexing the shebang (§3.3).** Added because writing the JSDoc showed the alternative was to
leave a documented gap. I read it as E-1(1)'s first half — recognising a construct it *can* lex —
rather than as a new special case, since a shebang is unambiguous and one line long. It also
*reduces* the number of constructs `readSlash` has to classify, from five slashes to two.

Neither is a behaviour change to the product. Both are inside the guard.

---

## 9. Reported, not fixed

- **A pre-existing lint warning.** `packages/core/src/backlog/backlog.ts:276` —
  *"Unused eslint-disable directive (no problems were reported from 'no-control-regex')"*.
  `git diff main -- packages/core/src/backlog/backlog.ts` is **empty**, so the file is byte-identical
  to `main` and this is not this branch's warning. It is a warning, not an error; `lint` is 14/14
  successful. Ground rule 3: reported where it is reached, not repaired in passing.
- **What fail-closed does not do.** The scanner still cannot read a regular expression. A production
  module that legitimately needs `const RE = /['"]/g;` will now **stop** this guard, and the fix
  will be a decision — exempt it, teach the scanner, or move the regex — taken by a person rather
  than taken silently by a check. That is the trade E-1 chose, and it is the property, not a
  side effect.
- **The one conservative false alarm.** `a / b + 'x/y'` is division and would be refused. Absent
  from the subject today; documented in `readSlash`'s JSDoc so the next reader meets the reasoning
  rather than the surprise.
- **Q-0102 (R-7).** The git-identity sweep was green three times running here, in both cells. That
  is one machine on one afternoon and says nothing about the rate GO-1 of that ticket asks for.
