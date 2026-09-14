# Q-0126 — implement report, run 2, iteration 4

**Verdict: `proceed`. Both review findings are closed, each with a test that goes red without the
fix.**

Round 3's review returned two majors. Both are correct and neither was defensible; they are fixed
rather than argued with. Nothing else moved — no criterion of AC-1 to AC-16 was re-implemented, and
the launcher, the port, the lifecycle, the manifest and the emit are untouched.

---

## 1. Finding 1 — `open.ts:260`, a positional argument started the daemon instead of refusing

**The finding.** `openOn`'s handler destructured only `flags`, so `quorum open unexpected` ignored
`rest` entirely and served, against AC-2's *"It accepts no positional argument."*

**Why it matters more than the wording suggests, and it is not a hypothetical shape.** `quorum init`
takes a directory in exactly that position, so `quorum open my-project` is what a person types when
they mean `--project my-project` — and the command that ignored it would have served **the working
directory** and said nothing about the argument it dropped. That is the silent default
`.claude/rules/engineering.md` forbids, arriving as an omission rather than as a branch.

### The fix

`packages/cli/src/open.ts`:

```ts
): CommandHandler => async ({ rest, flags }) => {
  if (rest.length > 0) die(`quorum open takes no positional argument, and was given ${JSON.stringify(rest[0])} — ${USAGE}`);
```

with `const USAGE = 'usage: quorum open [--port <n>] [--no-open]';` beside the two refusal literals.

Three choices in that line, each with its reason in place:

- **The first token is named**, `portFrom`'s own cadence three functions down — *"was given
  `"my-project"`"* — because what is wrong is a specific token and a bare usage line makes the
  reader find it. `ticket.ts` and `validate.ts` both `die(USAGE)` alone; this module already prefers
  the longer shape and stays consistent with itself.
- **The usage is the help's `open` line and not a second spelling of it.** The two are read a moment
  apart, and a refusal offering flags the help does not is a quieter promise beside the loud one.
  That claim is now a test rather than a comment (§3).
- **`--project` is deliberately absent from it**, which is worth stating because it is the flag the
  person probably meant. No help line in this product has ever named `--project`, for any of the six
  commands that read it; naming it here alone would make one command's help disagree with the other
  eight. Reported in §5 rather than fixed in passing.

**It sits ahead of the three ruled refusals and is not a fourth member of that order.** Daemon →
project → bundle are all claims about an *installation*; this one is about what was typed, is wrong
on every installation, and needs no I/O to establish. The module header says so; AC-4's existing
ordering assertion (`daemon()` before the bundle) is unchanged and still green.

### The test — `open.test.ts`, two of them

**`a positional argument is refused, and nothing starts`.** Over a fixture bundle and an
operating-system-assigned port, through `parseArgv` so the argv boundary is part of the claim: exit
`ERROR`, the token named, the usage matching the help, **nothing printed** and **nothing listening**.

Two things in it are deliberate and are stated in the file:

- **The positional is written immediately after the command name.** `argv.ts:54` gives a flag the
  next token unless it starts with `--` (Q-0090 AC-2's preserved behaviour 4), so a fixture spelling
  `--no-open my-project` would make the path the *value* of that flag and leave `rest` empty — a
  fixture that proved nothing. Typed where a person types it, it is a positional.
- **A three-second rescue signal that the refusing path never reaches.** Without it a regression
  that served instead of refusing would never return, and the failure would be Vitest's timeout
  rather than an assertion naming what broke. Measured: with the refusal removed the test now fails
  in seconds with *"a positional argument was accepted: expected 130 to be 1"* — 130 being the
  daemon having started and been stopped, which is the reviewer's finding reproduced exactly.

**`and the refusal is the positional clause rather than a command that refuses everything`.** Kept
as its own test so it cannot be read as part of the assertion above: the identical invocation
without the positional gets *past* the clause and is stopped further down by `--port`.

---

## 2. Finding 2 — `docs/06-development-plan.md:3589`, the bullet contradicted itself

The opening status read **"The daemon half — AC-1 to AC-11 — is implemented; the browser half is
not"** while the same bullet, thirty lines later, reads **"The browser landed in round 2"**. Round 2
added the second paragraph and left the first.

Now: *"**Both halves are implemented — the daemon's AC-1 to AC-11 in round 1, the browser's AC-12 to
AC-16 in round 2** — and this line is written to what happened rather than to what was planned."*

**Two neighbours were checked rather than assumed.** M3's done-when line at `:2942` already reads
correctly — round 2 updated it, and it states the split it makes and the half Q-0016 owns. The other
two occurrences of *"browser half"* are `grep`-adjacent and correct: `:3225` is Q-0121's bullet about
a different non-goal, and `:3670` is inside this bullet's own *"Original body follows"* section,
which is history and is not edited.

**Nothing else in the bullet was rewritten.** Round 3 — also a narrow revision round — touched no
document at all, and the precedent is right: the bullet is the operator's at a plan pass, and
narrating rounds 3 and 4 into ninety lines that already run to two screens is not what AC-11 asks
for. What AC-11 asks for is that no document promising this command says something false, and the
one false sentence is gone.

---

## 3. The defect this round found in its own guard

The usage-agreement clause was first written as
`expect(plain(result.stderr)).toContain('usage: quorum open [--port <n>] [--no-open]')`.

**Mutating `USAGE` to `… [--no-open] [--verbose]` left all 21 tests green.** Containment is
satisfied by a usage line that has *gained* a flag, so the clause passed over exactly the drift it
was written to catch — *"A check is not established by reading it"* (2026-08-29), met while writing
the check, which is the third time this ticket has met that family.

It now **derives** the subject from `HELP` rather than transcribing it — the `quorum open` line,
split at its description column — and compares with `endsWith`, with an anti-vacuity clause
requiring the derivation to have found a line at all. Both directions are red:

- `USAGE` drifts → *"the refusal does not end with the help's own open line — it said: ✗ … [--port
  <n>] [--no-open] [--verbose]"*.
- the **help** drops a flag → the same clause fires **by its own message**, alongside
  `commands.test.ts`'s AC-1 clause. Two guards, two messages, so neither is established by its
  neighbour (Q-0107).

---

## 4. GO-6 — four mutations, one at a time, each reverted immediately

| Mutation | Red, and how |
| --- | --- |
| the `rest` check removed | *"a positional argument was accepted: expected 130 to be 1"* — the daemon started, which is the finding reproduced |
| `die(USAGE)` with the token dropped | *"the refusal does not name the token that was wrong: expected '✗ usage: quorum open …' to contain `"my-project"`"* |
| `USAGE` gains a flag the help does not offer | *"the refusal does not end with the help's own open line"* — **after** the guard was fixed; it was **green** before (§3) |
| the help's `open` line loses `[--no-open]` | the same clause, by its own message, beside `commands.test.ts`'s AC-1 |

The two clauses of the new test point in opposite directions — one requires the refusal, the other
requires an invocation without a positional to get past it — so neither reads as the other written
twice.

---

## 5. Verification

- `pnpm install --frozen-lockfile` clean. `pnpm turbo run test lint typecheck --force --continue` →
  **21/21 tasks, 0 cached, 0 errors**, run three times across the round; `@quorum/cli` 26 files /
  679 tests.
- `pnpm turbo run build --force` → **5/5, 0 cached**, 3.7 s.
- **Through the emitted binary**: `pnpm exec node packages/cli/dist/quorum.js open my-project` →
  exit 1, `✗ quorum open takes no positional argument, and was given "my-project" — usage: quorum
  open [--port <n>] [--no-open]`.
- **And the command still serves**, checked in the same pass so the refusal is not a regression:
  `quorum open --port 7731 --no-open` through the emit printed
  `✓ Quorum is serving http://127.0.0.1:7731 — press Ctrl-C to stop` and exited **130** on `SIGINT`.
- `pnpm exec quorum lint` → 6/6.
- `pnpm sweep:git-identity` → *"the workspace suite executed and green with no resolvable git
  identity"*, 7/7 forced 0 cached.

---

## 6. What I deliberately left alone

- **AC-1 to AC-16 are otherwise untouched.** Round 1 landed AC-1 to AC-11, round 2 AC-12 to AC-16
  and round 3 the resolution predicate; this round changes one guard clause at the top of one
  handler, adds two tests, and corrects one sentence in one document.
- **No new seam and no new export.** `USAGE` is module-private, as `run.ts`'s and `ticket.ts`'s are;
  the test reads the refusal's own bytes and derives the comparison from `HELP`, so nothing was
  exported to be asserted.
- **The three installation refusals keep their ruled order**, and AC-4's structural assertion of it
  is unchanged.
- **`--project` was not added to any help line** (§1, and the observation below).

---

## 7. Reported and not fixed

- **No help line in this product names `--project`**, which six commands including this one read. So
  the refusal names the wrong token and what the command *does* take, and cannot point a person at
  the flag they probably meant. Adding it to the `open` line alone makes one command's help
  inconsistent with eight others, and adding it to all nine is a change to `commands.ts`,
  `README.md` and `docs/USAGE.md` with its own AC-11-shaped guard to satisfy. Another ticket's.
- **`harness/architecture.md:25` and `harness/product-context.md:80` still say "four packages
  emit"**, stale since Q-0125 made `@quorum/server` the fifth; `docs/04-architecture.md` says five.
  Rounds 1, 2 and 3 each reported and left it, and it is left again for the reason that stands: it
  is Q-0125's claim with its own sixteen register sites, and moving one of two makes the drift
  worse.
- **`packages/core/src/backlog/backlog.ts:330`** — unused `eslint-disable` directive. Pre-existing,
  in a file this change does not touch, 0 lint errors.
