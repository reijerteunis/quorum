# Q-0100 implement — run 2, iteration 2

**A revision round.** `review/chore/run-2/chore-iter-1.md` returned `revise` with two majors. Both are
addressed; nothing else moved. The diff against iteration 1 (`c67c761`) is **two files, 71
insertions, 5 deletions**:

| file | why |
| --- | --- |
| `packages/cli/src/binary-name.test.ts` | major 1 — the literal scanner consumes escape sequences, and two AC-5 clauses pin it |
| `packages/core/src/backlog/backlog.ts` | major 2 — reverted, byte-identical to the pre-ticket tree |

Iteration 1's fourteen criteria are otherwise untouched. Everything below the two findings is stated
so the reviewer can see what was deliberately *not* done.

---

## Major 1 — `binary-name.test.ts:100`, the escaped quote

**Accepted, and the defect is worse than the report says.** The finding was that a backslash was
consumed as one skipped character while the character it escapes was not, so an escaped matching
quote terminates the literal early. That is right. What it costs is not the split value:

> every quote after an odd number of escaped ones swaps its meaning, so the scan is **outside** a
> string exactly where the file is **inside** one.

An offending sentence below an escaped quote is then read as code and collected by nobody, and AC-4
asserts over a list that does not contain it. That is the guard reporting a clean tree over a module
that prints `harness` — *"a check that skips its subject must not report success"* (2026-08-25)
inside the check written to enforce this ticket.

**Measured rather than argued.** The fixture

```ts
const a = 'it\'s fine';
const b = 'usage: harness run <flow>';
```

yields, against the old scanner, exactly `['it', ";\nconst b = ", ";\n"]` — the usage line appears in
no entry at all. That measurement is in the test comment, and it is the *received* value vitest
printed when the new clause was run red, not a value I reasoned to.

**Latent on today's tree, and that is stated rather than used as an excuse.** A grep over the scan's
subject — this package's production modules plus `packages/core/src/backlog/project.ts` — finds six
lines carrying a backslash and **no escaped quote among them**: `colour.ts:12` (`\x1b`),
`lint.ts:71`, `init.ts:63`, `validate.ts:86`, `trace.ts:67` (all `\n`). So nothing evades the guard
today; what was wrong is that nothing stopped the next sentence from doing it.

### What changed

`literals` now consumes the escape with the character it escapes:

```ts
if (text[i] !== '\\') { value += text[i]; continue; }
i += 1;
if (i >= text.length) break;
value += WHITESPACE_ESCAPES[text[i]] ?? text[i];
```

`WHITESPACE_ESCAPES` is `{ n, t, r }` mapped to the real characters, typed
`Record<string, string | undefined>` so the `??` is honest rather than a lie the compiler tolerates.
**Decoding the whitespace escapes is part of the fix, not a flourish**: `printable` asks whether a
literal is a sentence by looking for whitespace, and an escaped newline *is* whitespace once printed
— leaving it as the letter `n` means a literal whose only whitespace is escaped reads as a path
segment and is dropped. `lint.ts:71` and `trace.ts:67` are the live subjects. Every other escape
decodes to the character it escapes, which keeps `\x1b` the whitespace-free fragment `x1b` that it is.

Its JSDoc now carries the parity property as a **correctness** statement with AC-5(4) named as the
pin, in one block, citing rather than transcribing.

### The tests added

Three, all shown **red against the old scanner before the fix**:

- **AC-5(4)** — the escaped quote. Asserts the two literals are collected whole *and* that the guard's
  own filters still call the second one offending, so the clause is load-bearing rather than
  cosmetic. Red output recorded above.
- **AC-5(5)** — template literals, the reviewer's second named case. Three shapes, each one the
  subject actually has: `board.ts:117`'s hint with the flow name interpolated into it, `init.ts:63`'s
  template wrapping a quote inside an interpolation, and an escaped backtick — clause (4) in a third
  delimiter. Red before the fix on the third.
- **the whitespace-escape clause** — a literal whose only whitespace is an escaped newline is a
  sentence, and an ANSI escape is not.

The `describe` title moved from *"in the three directions it has to"* to *"…and the two the scan
needs"*, because a title claiming three over five clauses is the same class of defect as the
comments this ticket removed.

### Why not the AST route

The reviewer offered two remedies. I took the second (consume escapes, add discrimination tests)
rather than TypeScript AST parsing, for a measured reason and not a preference: **`typescript` is not
a declared dependency of `@quorum/cli`** — its manifest declares `@quorum/core` and `@quorum/shared`
and nothing else — so the AST route means adding a dependency to a package in order to satisfy a
criterion that names none. The requirement authorises no dependency, and this role's brief forbids
adding one it was not sent to add. No other test in this workspace parses TypeScript.

**The residual limit, stated rather than left to be found.** The scanner is still not a parser, and
the shape it would desync on is a **regex literal containing a quote character**, which opens a
literal the file never closes. Measured over the whole subject — the six ways a regex literal is
written in this codebase — there is **no regex literal in any production module of this package or in
`project.ts`**, so the hazard has no subject today. If one appears, it is a third clause here rather
than a rewrite. Recorded so the next reader does not have to re-derive it.

---

## Major 2 — `backlog.ts:155` is outside AC-13

**Accepted in full and reverted.** `git diff 2d63007 -- packages/core/src/backlog/backlog.ts` is now
empty: the file is byte-identical to the pre-ticket tree.

The reviewer is right on the rule and it is worth naming precisely. AC-13 is exhaustive — *"the
change is confined to `packages/cli/src`, `packages/core/src/backlog/project.ts`, their tests, and
AC-11's three documents"* — and `backlog.ts` is in none of them. It is not in AC-3's twelve either:
those are the eleven production lines citing `Q-0100` plus `project.ts:29–30`, and this comment cites
Q-0080. The requirement in fact names this file on the *other* side of the line, in OQ-2, as one of
four `core` files whose command-shaped text is in **comments** and therefore excluded from the guard
by design. An implement step widening a scope boundary to repair something it noticed is the move
Q-0094's E-3(a) and Q-0103's four refused majors both record.

**What the revert leaves behind, reported and not repaired.** The comment now reads

```ts
// Why: `harness init` prints `harness run requirements T-0001` as the next command, so this is
// the id the product already advertises for a fresh backlog (Q-0080 AC-3).
```

and after AC-1 row 3 that sentence is **false in both halves** — `quorum init` prints
`quorum run requirements T-0001`. So the ticket that exists to close *a sentence disagreeing with
reality* ships one, in a file it may not touch. It is a comment and no behaviour depends on it, but
it is a real finding and it is the human's to route at the gate, two ways:

1. **An erratum widening AC-13 by one line**, naming `packages/core/src/backlog/backlog.ts:155` as an
   authority comment whose subject this ticket moves. One line, no behaviour, no test. This is what I
   would recommend, and it is the cheaper of the two by a wide margin.
2. **A successor**, which for one stale comment line is more ceremony than the defect.

I have written no erratum: `requirements/errata.md` is written at a gate, and `backlog/` is not a
surface this step may write.

---

## Files changed this round

**`packages/cli/src/binary-name.test.ts`** — `WHITESPACE_ESCAPES` added; `literals` consumes the
escaped character; its JSDoc gains the parity paragraph; AC-5 gains clauses (4) and (5) and the
whitespace-escape test; the `describe` title corrected to the number of clauses it now holds. Ten
tests in the file, all green.

**`packages/core/src/backlog/backlog.ts`** — reverted.

## What I deliberately left alone

- **Everything else from iteration 1.** No criterion was re-opened, no string re-spelled, no test
  re-aimed. AC-1's seven rows, AC-2, AC-3's twelve comment sites, AC-7's sixteen assertion sites,
  AC-8's four folder-only assertions, AC-9's through-the-binary rows and AC-11's three documents are
  as they were reviewed.
- **`validate.ts:11–13`.** It says the spike's `validate` case opened no project, *"verified by
  running the spike"*. That is past-tense provenance about the deleted tree's command, which Q-0103
  AC-19 forbids rewriting, and it defers nothing. Not an AC-3 site.
- **`backlog.test.ts:444` and `q0080-allocation.json:16,83`.** Test-facing names, an explicit §4
  non-goal.
- **Q-0068's BYOS refusal, `adapters` exiting 0, the unknown-command 0, `probeAdapter`'s null
  dereference, `Backlog.create` defaulting the owner.** AC-14, ground rule 3. Untouched and still
  visible.
- **The frozen contracts, the decisions, the development plan, `CLAUDE.md`, the derived rules copy,
  `harness/` and the templates.** AC-13's exclusions. The four frozen contracts still hold 11
  occurrences of the old name between them; that is reported at the gate, as AC-13 says, not repaired
  here.

---

## New finding, reported and not fixed

**`loadProject(dir)` skips its own existence check when `--project` is given, so AC-2's sentence is
unreachable on that path.** `project.ts:88–96`: when `dir` is supplied, `findProject`'s `existsSync`
walk is bypassed entirely and `readFileSync` is called on `<dir>/harness/harness.yaml` unguarded.
Reproduced through the built binary:

```
$ pnpm exec quorum lint --project /
✗ Error: ENOENT: no such file or directory, open '/harness/harness.yaml'
    at Object.readFileSync (node:fs:441:20)
    at loadProject (…/packages/core/dist/backlog/project.js:73:35)
    …
```

That is a Node stack where `lint.ts`'s own JSDoc says a stack would be *"a visible regression against
the spike"* — the module catches `ProjectNotFoundError` and this is a plain `Error`. The
no-`--project` path is unaffected and produces the sentence correctly, which is the common case and
the one `project.test.ts:123` pins.

**Not fixed here, for three reasons.** It is `loadProject`'s behaviour rather than the message's, so
it is ground rule 3's *report, do not repair in passing*; the fix is in a function AC-13 does not
name; and its remedy is a judgement — throw `ProjectNotFoundError` naming the directory the flag
supplied, or let the flag mean *"this is the root, trust me"* — which wants a criterion, not an
implementer's choice. It is close kin to GO-4's successor, which is already going to rewrite this
error's shape, and that is where I would put it.

**One pre-existing lint warning**, unrelated and untouched: `packages/core/src/backlog/backlog.ts:276`
reports *"Unused eslint-disable directive (no problems were reported from 'no-control-regex')"*. The
file is byte-identical to the pre-ticket tree, so the warning is the base's; lint passes with 0
errors.

---

## Verification

Run in this worktree after `pnpm install --frozen-lockfile`, forced, which is `commands.install` and
`commands.test` verbatim:

| check | result |
| --- | --- |
| `pnpm turbo run lint typecheck test --force --continue` | **21/21 tasks, 0 cached**, 0 errors |
| `@quorum/cli` | 24 files, **563 tests** passed |
| `@quorum/core` | 57 files passed (1 skipped), **1285 tests** (2 skipped) |
| `@quorum/shared` | 12 files, 143 tests passed |
| `binary-name.test.ts` alone | 10 tests passed |
| `pnpm sweep:git-identity` | both phases green — *"environment discriminates"* and *"the workspace suite executed and green with no resolvable git identity"* — on **three consecutive runs**, with no failure trailer. R-7's Q-0102 flake did not appear in this worktree. |

**Red before green, this round.** All three new clauses were run against the unfixed scanner first
and failed with discriminating messages; the AC-5(4) failure is the measurement quoted in the test.
The fix then turns all three green with nothing else moving.

**Through the built binary** (`pnpm turbo run build --force`, then `pnpm exec quorum`), because the
reviewer has been unable to execute the suite under `--sandbox read-only` on five of the last six
chore runs:

```
$ pnpm exec quorum run       → usage: quorum run <flow> <ticket> [--auto] [--dry] …   (exit 1)
$ pnpm exec quorum ticket    → usage: quorum ticket new "<title>" --intent "..." …    (exit 1)
$ pnpm exec quorum validate  → usage: quorum validate <schema.json> <file…>           (exit 1)
$ pnpm exec quorum board     → draft  → quorum run requirements <id>   (and five more columns)
$ pnpm exec quorum adapters  → · presence only — logins NOT verified; run `quorum adapters --probe` …
```

Five of the eight sentences read from a real process. `init`'s is covered by `end-to-end.test.ts`'s
spawned row rather than run here, which would scaffold into the worktree; `run.ts:143`'s `--base`
refusal and `project.ts:33` are covered in the suite.

**AC-13 re-checked over the whole change, not only the finding.** Against `2d63007` the change
touches the three documents, fifteen files under `packages/cli/src`, and `project.ts` with its two
named tests. Nothing else. The `backlog/Q-0100-…/` entries in the diff are the engine's own
requirements artifacts, not this step's writes.
