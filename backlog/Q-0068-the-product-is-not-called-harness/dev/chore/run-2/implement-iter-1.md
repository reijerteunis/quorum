« Q-0068 — implement report, run 2, iteration 1

*Written 2026-09-10. Every measurement below was taken in this worktree; nothing is relayed from the
merged requirement or from a previous round.*

---

## 0. What the requirement did not have

Three findings, in descending order of consequence. The first stopped the ticket's highest-value
criterion until it was solved.

### 0.1 — AC-5 could not be satisfied by adding two entries: the scanner **refuses** `claude.ts`

`binary-name.test.ts` does not merely fail to find the two refusals — it **cannot lex the file they
are in**. Adding `packages/core/src/adapters/claude.ts` to `CORE_SUBJECTS` and running the suite
gives:

```
Error: packages/core/src/adapters/claude.ts:49 (offset 2622): this `/` opens a regular-expression
literal whose body carries a quote, or divides an expression that does; either reading changes the
quote parity below it and this scanner cannot tell them apart — see requirements/errata.md E-1, E-2
```

`claude.ts:49` is `quoted`, and it holds **two** regex literals whose bodies carry quotes:

```ts
(/[\s"']/.test(value) ? `'${value.replace(/'/g, "'\\''").slice(0, 80)}…'` : value);
```

The merged requirement's §0/AC-5 measured the *word* question — `grep -i harness` over both files,
five hits, none needing an exemption — and that measurement is correct and was re-verified here. It
did not ask the *lexability* question. R-3 came closest, recording the residual as "an escaped
apostrophe gone wrong fails loudly rather than skipping its subject", and it was right about the
failure mode: the refusal is loud, which is the design working. But it is not a residual. It is the
guard declining to take as its subject the one file holding two of the sentences it exists to find,
and under it AC-5's clause (a) — *"reverting either production string fails the scan naming that
file"* — is unreachable.

**Three ways out were considered and two are refused by the guard's own header.** Teaching
`readSlash` grammar is refused in as many words (*"It is not a TypeScript parser and does not become
one"*). Exempting the file is refused by this ticket's whole argument: a register that excuses a file
is what fails open, and AC-5 exists because one did.

**What shipped is the third: one character of lookback, against a closed set, that is a fact rather
than a guess.** Division needs a left operand. `(` cannot be the end of one. So a `/` immediately
after `(` — or after `,`, `=`, `:`, `[`, `!`, `&`, `|`, `?`, `{`, `;` — **must** open a regular
expression, and there is no parity question left to refuse. `BEFORE_REGEX` is that set,
`previousSignificant` finds the character across whitespace, and `readRegex` reads the literal and
steps over it, tracking character classes so a `/` inside `[…]` does not close it, and **refusing**
one that never closes.

The fail-closed property is untouched, and that is the part worth checking rather than taking. The
deliberately excluded characters are exactly the ones where an expression *may* have ended and the
answer would be a guess — an identifier character (`return /re/` is a regex, `total / 2` is division),
`)`, `]`, `}` and the three quotes. Those still take the conservative path, and clause (10) below
demonstrates the refusal surviving for five of them.

**Both live sites are `(`-preceded**, and `codex.ts` holds no regex literal at all — measured before
the change was proposed, not after.

### 0.2 — AC-11's stated mechanism names a file that cannot answer

AC-11's *Test:* clause says restoring `res.usage!` in `core` "turns this red as well as
`probe.test.ts`, which is what proves the CLI is still a faithful renderer rather than compensating
for `core`."

Measured, by performing the mutation: `packages/cli/src/adapters.test.ts` stayed **green**. It cannot
do otherwise. That file calls `vi.mock('@quorum/core', …)` and replaces `probeAdapter` with a stub,
which its own header states as a deliberate property — a suite that reached the real one *"would have
a verdict that is a property of the machine and of the account … and would spend money doing it"*. No
change in `core` is visible to it.

The property AC-11 asks for is real and is proven, by a better instrument: **`build.test.ts`'s AC-10
block**, which spawns the built binary against a fake vendor CLI named through `adapters.<vendor>.bin`.
The same mutation turns two of its three tests red. That is the faithful-renderer claim across a
process boundary, which an in-process mocked test could not have made at all.

The AC-8(d) row was still inverted and still keeps its name, because AC-11's other half — the register
of what this command reports staying complete — does not depend on the mechanism.

### 0.3 — `not.toContain('0 tokens')` is unsound, and `packages/shared` carries two line citations

**The substring.** AC-9's wording invites asserting that a silent adapter's line carries no
`0 tokens`. It cannot be written that way: the sibling verified line renders `4200 tokens`, which
contains it, and the check fails for a reason nothing is about. Caught by the assertion going red on
the first run. Both the CLI test and the binary test assert **whole rendered lines** instead, which is
what actually forbids a clause — the line ending where it ends.

**The citations.** `packages/shared/src/step-output.ts`'s FOUR-VALIDATIONS block cites
`packages/core/src/adapters/adapters.ts:606` and `:569` by line, and `step-output.test.ts` asserts
each cited line still begins `export function`. Widening `ProbeResult.tokens` and removing
`probeAdapter`'s preserved-defect note shifted both by 6. No criterion of this ticket names that file;
the pin named it, which is what it is for — the fourth time it has caught a citation drifting off its
declaration, and it caught this one within a minute of the change. Both sides updated to `:612` and
`:575`, with the fourth occasion recorded in the test's own comment.

---

## 1. File by file

### Production — three files, four lines of behaviour

**`packages/core/src/adapters/claude.ts`** · **`codex.ts`** — AC-1. The two BYOS refusals carry §4's
bytes. Double-quoted rather than escaped, since `CLI's` holds an apostrophe and the repository has no
quote-style rule; `binary-name.test.ts` lexes both delimiters, so nothing turned on the choice.

**`packages/core/src/adapters/adapters.ts`** — AC-7, AC-8, AC-13(c). `probeAdapter`'s success path
binds `res.usage` once and reads it guarded, so an adapter that answers and reports nothing is
`ok: true` with `cost_usd: null` and `tokens: null`. `ProbeResult.tokens` is `number | null`, and its
JSDoc states both halves — an individually unreported measure still counts as zero, an absent `usage`
object answers `null`. The preserved-defect paragraph is gone from `probeAdapter`'s docblock, replaced
by a three-line contract note saying what the absent case answers and citing Q-0034 for why `usage` is
null; `engineering.md` asks for an authority line where behaviour is deliberately counterintuitive,
and after AC-7 none is.

**`packages/cli/src/adapters.ts`** — AC-13, AC-9. The module header's two Q-0068/Q-0066 notes are
gone, including the whole *"One preserved defect reaches this command"* section. The renderer is
**unchanged** and now carries one comment saying why its two clauses are asymmetric — cost
discriminates a measured `0` and prints `$0.0000`, tokens is truthiness and has always omitted one.
Moving tokens to `!= null` would start printing `, 0 tokens`, which no criterion asks for.

### Tests

**`packages/core/src/adapters/claude.test.ts`**, **`codex.test.ts`** — AC-1's two `REFUSAL`
constants, updated not deleted. `claude.test.ts:380`'s analogy for the unrelated non-string-message
crash lost its "both trees at once, like Q-0066 and Q-0068" clause; the defect it guards stays
preserved and its assertion is untouched (AC-13, seventh site).

**`packages/core/src/adapters/adapters.test.ts`** — AC-4. The *not worth retrying* table's first row
is now `shippedRefusal`, obtained by invoking `claudeAdapter().check()` with the key set and catching
the message. That is the strongest available reading of *"read from `claude.ts` at test time"*: it is
the literal the process throws, not a copy of it and not a scrape of the file. It costs nothing — the
guard refuses **before** it spawns, so no CLI is reached, no `bin` has to exist and nothing is billed
— and it adds no path literal, so it earns no turbo registration. Awaited at module scope because
`test.each` builds its table at collection. The comment above the table was false three ways over and
is rewritten; it now states why the classification is not automatic, naming the three `AUTH_PATTERNS`
a refusal about keys and logins could plausibly have matched.

**`packages/core/src/adapters/probe.test.ts`** — AC-7, AC-8, AC-11, AC-12. Q-0046's AC-11 defect 1
block is inverted on Q-0037's precedent: same two fixtures, now asserting the repair, so a returning
`res.usage!` fails a check instead of passing an absent one. Two tests added — AC-8(b), which is the
one that actually separates the two representations (a measured `0` is still `0`, an unreported half
still counts as zero once something was measured), and an AC-11 clause showing invalid structured
output and a thrown auth failure still answer `ok: false`. The sandbox test is kept and re-aimed at
the success path.

**`packages/cli/src/adapters.test.ts`** — AC-9, AC-11, AC-13. `Probe`'s local `tokens` widened to
`number | null`. AC-8(d) inverted, keeping its name and gaining the reasoning for the inversion; it
now asserts the verified line whole, that no `login not usable` appears, and — AC-9's `--json` half —
that the twelve-key register is unchanged with both measures `null`. A second test was added for the
other direction, so the inversion is shown to be narrow rather than a widening of what counts as
verified. The BYOS block's comment (fifth AC-13 site) no longer says the shipped refusal names the
product "Harness"; it now points at the two guards that do hold the sentence.

**`packages/cli/src/binary-name.test.ts`** — AC-5, and §0.1's scanner change. `CORE_SUBJECTS` is three
entries. The header records that its predecessor sentence was **false when written** rather than
merely superseded, and states the five measured `harness` mentions in the two adapters and why none
needs an exemption. The anti-vacuity clause gained an anchor in each new file — deliberately on each
adapter's *other* printed sentence (`<vendor> CLI not runnable: …`) rather than on its BYOS refusal,
so the anchor does not go red with the string under repair and reaching the file stays provable even
if the refusal were deleted outright. `readSlash` gained the first clause, `readRegex` and
`previousSignificant` are new, and `scan` now advances past a claimed literal. Clause (8)'s and (9)'s
regex fixtures moved their `/` behind an identifier, because their original spellings are now *lexed*
rather than refused — a strictly better outcome for the same input, and both are recorded as such.
Clause (10) is new and demonstrates the whole of it.

**`packages/cli/src/build.test.ts`** — AC-10, AC-13's eighth site. Q-0067's fixture — `fakeVendor`,
its project, and the BYOS-stripped spawn — was **hoisted to module scope rather than copied**, which
this file's own header demands (it refuses a second mechanism for driving the build, and a second fake
vendor would be that mistake one layer along). `fakeVendor`'s boolean became `VendorAnswer`
(`measured | silent | refusal`) and its `project` was renamed `probeProject`, the old name being too
general once two blocks share it. Three tests: `--probe` exits 0 for a silent-but-valid adapter and
omits both clauses; the same fixture *measuring* its answer still renders both numbers, which is the
discriminator without which the first would be satisfied by a build that had stopped printing them;
and `--json` carries `null` for both. The eighth AC-13 site is `fakeVendor`'s own comment, which said
the usage is present "because `probeAdapter` dereferences it, which is Q-0066's preserved crash" —
outside AC-13's enumerated seven and outside its grep scope, and false after AC-7.

**`packages/cli/src/end-to-end.test.ts`** — AC-2, AC-3. The rendered `✗ <vendor>: …` line at :775
carries the new sentence. **AC-2's three assertions are untouched** — `refusedBy` still derives both
counts from source, `toHaveLength(1)` and `toHaveLength(2)` still hold, no vendor is probed — so
Q-0047's AC-3 non-goal is held by their passing rather than by inspection. The comment beneath them
lost its "preserved and not repaired here" clause and now says why the whole line is asserted.

**`packages/shared/src/docs.test.ts`** — AC-6, AC-14. A new block reads each refusal out of its
adapter, anchored on the guard's own line rather than on the first `new Error("…")` in the file, so a
refusal that moved or acquired a sibling fails here instead of being answered by a neighbour. Four
tests: USAGE.md quotes the rendered form of what `claude.ts` throws; the two vendors share one tail
and the term the contract already owns; the contract states the no-usage case; the contract's status
line records the change.

**`packages/shared/turbo.json`**, **`packages/core/src/turbo-inputs.test.ts`** — AC-6's registration.
One new input row and one `MANIFEST` row, which is what §0.6 predicted: the two adapter files were
already declared and already read by `events.test.ts`, so only `docs/USAGE.md` is new. The two adapter
rows' reasons were extended to name their second reader.

**`packages/shared/src/step-output.ts`**, **`step-output.test.ts`** — §0.3's citations.

### Documents

**`docs/USAGE.md`** — one line. The ellipsis standing where the product's name goes is gone.

**`docs/03-adapter-contract.md`** — AC-14. §Interface's `probeAdapter` sketch gained `session` and the
nullability of both measures; §"check() is not proof of login" gained a paragraph stating that a probe
which answers and measures nothing is a verified login, that `null` is not a measured zero and not a
failed login, and that a contributor should not manufacture a measurement to make a valid adapter
pass. Status line bumped.

---

## 2. Demonstrated red before green

Seven mutations, each run against the whole workspace suite forced and then reverted. Signatures are
quoted, not summarised.

| # | Mutation | What went red |
| --- | --- | --- |
| A | `claude.ts` refusal reverted | `claude.test.ts` AC-3 ×3 · `end-to-end.test.ts` AC-7 · **`binary-name.test.ts` naming the file** · `docs.test.ts` AC-6 ×2 |
| B | `codex.ts` refusal reverted | `codex.test.ts` AC-3 ×3 · `end-to-end.test.ts` AC-7 · **`binary-name.test.ts` naming the file** · `docs.test.ts` AC-6 ×1 |
| C | `res.usage!` restored | `probe.test.ts` ×2 · **`build.test.ts` AC-10 ×2, through the binary** · `step-output.test.ts` |
| D | a `CORE_SUBJECTS` entry removed | `binary-name.test.ts` anchor: *"the scan reaches no sentence in packages/core/src/adapters/claude.ts"* |
| E | a `CORE_SUBJECTS` entry pointed at a moved path | `binary-name.test.ts` ×3, one being *"packages/core/src/adapters/claude-moved.ts has moved"* |
| F | `docs/USAGE.md` edited alone | `docs.test.ts`: *"USAGE.md does not quote the refusal as the terminal renders it"* |
| G | the `docs/USAGE.md` input undeclared | `turbo-inputs.test.ts` clauses A and B, plus the Q-0073 inventory pair, all naming `docs/USAGE.md` |

**A's decisive line, which is AC-5(a) and the reason this ticket closes a class rather than an
instance:**

```
a printed sentence names a binary this package does not install:
+ [ "packages/core/src/adapters/claude.ts: ANTHROPIC_API_KEY is set — unset it; Harness runs on subscription OAuth only" ]
```

Before the widening that mutation was **silent**. That is the whole of R-1.

**Two things stayed green under A and B, both deliberately.** `adapters.test.ts`'s `transientError`
row, because it reads the shipped text and therefore follows its subject rather than drifting from it
— which is exactly what AC-4 was written to buy. And `binary-name.test.ts`'s anti-vacuity anchor,
because it names each adapter's *other* sentence; had it named the refusal it would have gone red with
it and the two clauses would have stopped being independent.

**The scanner change was mutation-tested from both sides**, inside clause (10) rather than by hand:
each of the eleven admitted characters is shown to admit a quoted-body regex on its own, and each of
five expression-ending characters (`)`, `]`, an identifier, a digit, a closing quote) is shown to
still refuse. So the new clause is proved to discriminate rather than merely to permit.

**The turbo hash was measured, not assumed** (R-5): unchanged, `@quorum/shared#test` reports
`cache hit, replaying logs`; with one line appended to `docs/USAGE.md`, `cache miss, executing`. The
probe line was removed and `git diff docs/USAGE.md` is back to one insertion and one deletion.

---

## 3. Verification

Run in this worktree after `pnpm install --frozen-lockfile`, which is `commands.install` verbatim.

- **`pnpm turbo run test --force --continue`** — **7/7 tasks, 0 cached.** 2246 tests passed,
  2 skipped (the pre-existing `GIT_TEST_ASSUME_DIFFERENT_OWNER` skip from Q-0105 and its sibling).
  Per package: shared 171, core 1447, cli 626.
- **`pnpm turbo run lint typecheck --force --continue`** — **14/14 tasks, 0 errors.**
- **`pnpm exec quorum lint`** — **6/6** flows, through the built binary.
- **`pnpm sweep:git-identity`** — exit 0, *"the workspace suite executed and green with no resolvable
  git identity"*. This is GO-4's both-rows run.
- **The built binary was exercised directly** by AC-10's three tests: `node packages/cli/dist/quorum.js
  adapters --project <fixture> --probe` exits **0** against two adapters that answer and measure
  nothing, prints `  ✓ login verified — round-trip <n>ms` with nothing after `ms`, and reports both
  measures as `null` under `--json`.

**One lint warning, pre-existing and untouched:** `packages/core/src/backlog/backlog.ts:330`,
*"Unused eslint-disable directive (no problems were reported from 'no-control-regex')"*. That file is
not in this diff — `git status` shows it unmodified — and `no-control-regex` is a non-type-aware core
rule whose verdict depends on that file alone, so the warning is a property of `main` rather than of
this change. Reported rather than fixed: it is not this ticket's surface.

**GO-4's remaining half is the human's:** verification on `main` in both environment rows after the
merge, and CI green on the merged commit. Q-0105's GO-3 is the precedent for not treating a local
green as covering CI.

---

## 4. Deliberately left alone

- **`withRetry`'s `usage: null`** (§6.3). Untouched. It is correct, it is Q-0034's, and this change
  makes the *consumer* handle it rather than changing what it answers.
- **The human renderer** (AC-9, §0.3). `result.tokens ? … : ''` is unchanged. A measured zero still
  renders nothing, exactly as before; the discrimination went into `--json` and the type.
- **`authError`, `transientError` and their pattern lists** (§6.2). AC-4 asserts the new sentence
  passes through unchanged; neither was edited. Checked by hand as well: the sentence matches none of
  the nine `AUTH_PATTERNS`, none of the eleven `TRANSIENT` entries and not the model-availability
  regex.
- **The refusal's ordering and coverage** (§6.1, Q-0047 AC-3). Held green by `end-to-end.test.ts`'s
  three untouched assertions.
- **`quorum adapters` exiting 0 with both CLIs absent** (§6.5). Q-0110 ratified it; its test is
  untouched and the AC-10 fixture re-proves the bare listing exits 0.
- **The non-string-final-message crash** at `claude.test.ts:374–383` (§6.8). Still preserved, its
  assertion untouched; only the analogy in its comment moved.
- **`binary-name.test.ts` widening to all of `core`** (§6.6). Refused. Three measured subjects were
  added to the register the guard already has; replacing that register with a derivation over `core`
  is a different question at a different cost.
- **A product-name audit across prose** (§6.7). Not attempted. `docs/USAGE.md` is a code-drift check
  on one quotation of a shipped string.
- **No new dependency, no flow, gate, bound, worktree or persistent-format change** (§6.11).
- **Nothing under `backlog/`, `harness/`, `docs/decisions/` or `.claude/rules/`** (§3, §6.10).

---

## 5. Gate obligations

- **GO-1 — no decision entry is owed**, and none was written. The gate ruled it, and the deciding
  reason holds after implementation: nothing can depend on today's behaviour because today's behaviour
  is a `TypeError`. The no-usage path did not return a `tokens` a `--json` consumer could have parsed
  — it threw. `number | null` gives a value to a case that had none. The two doc-versus-code conflicts
  it creates are AC-8's JSDoc and AC-14's contract, both fixed in this change, which is what
  `.claude/rules/docs-and-decisions.md` prescribes.
- **GO-2 — the bytes were read from the ticket body**, not re-derived from the merged requirement's
  §4. The apostrophe warning was real and was handled by choosing the other quote form; nothing needed
  escaping and the suite never had a chance to lose its subject over it.
- **GO-3 — no new glossary term.** Confirmed: `docs/GLOSSARY.md` is untouched, so Q-0067's
  branch-sequencing problem does not arise and `main` cannot go red ahead of the merge.
- **GO-4 — the local half is done and reported in §3.** The `main` re-run and CI are the human's.

---

## 6. Scope note, stated rather than buried

Two changes go beyond a literal reading of the criteria, and both were forced rather than chosen.

**The scanner change (§0.1)** is a real change to Q-0100's guard, made because AC-5 is otherwise
unreachable. It is documented in three places — the file header, `readSlash`'s docblock and clause
(10) — each saying what it decides, what it still refuses, and why it is a fact rather than grammar
arriving after all. If a reviewer judges that this belongs in its own ticket, the honest consequence
is that AC-5 cannot ship, and that is the trade to rule on rather than a detail.

**The `build.test.ts` hoist** moved Q-0067's fixture to module scope and renamed one helper. No
assertion of that block changed and its three tests pass unmodified; the alternative was a second
fake-vendor implementation, which that file's header refuses by name.

Neither is a behaviour change. The product diff is four lines across three files. »
