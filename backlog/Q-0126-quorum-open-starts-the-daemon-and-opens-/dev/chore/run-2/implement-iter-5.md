# Q-0126 — implement report, run 2, iteration 5

**Verdict: `proceed`. The one review finding is closed, with a test that reproduces it and goes red
without the fix.**

Round 4's review returned a single major against `packages/cli/src/open.ts:279`: the
positional-argument guard read `rest` alone, and the parser gives a flag the token after it — so
`quorum open --no-open my-project` parks the path in `flags['no-open']`, leaves `rest` empty, and
the command **serves the working directory and says nothing about the argument it dropped**. That is
AC-2's *"It accepts no positional argument"* unmet through the door the guard does not watch, and it
is the silent default `.claude/rules/engineering.md` forbids. The finding is correct and was not
defensible.

---

## 0. The defect reproduced before anything was written

Not reasoned about. The guard was reverted to the shape the reviewer found — `rest` alone, and
`if (!flags['no-open'])` — and the new test run against it:

```
FAIL  src/open.test.ts > AC-2 … > a positional the parser parked in --no-open is refused too, and nothing starts
AssertionError: a value on --no-open was accepted: expected 130 to be 1
```

**130 is the finding.** It is the code a *stopped daemon* exits with, reached through the test's own
rescue signal — so the command did not refuse, it started, served, and was still serving three
seconds later. One test failed and twenty-two passed, so the clause is not established by a
neighbour (Q-0107).

The reason `rest` cannot see it is Q-0090 AC-2's **preserved behaviour 2**, pinned in
`argv.test.ts:25`: a flag takes the next token unless that token starts with `--`. `--no-open`
carries no value, so the token after it is always consumable — and a truthy string switches the
launch off exactly as `true` would, which is why nothing downstream noticed either.

---

## 1. The fix

`packages/cli/src/open.ts`, immediately after the existing positional clause and before the three
installation refusals:

```ts
const noOpen = flags['no-open'];
if (noOpen !== undefined && noOpen !== true) {
  die(`--no-open takes no value, and was given ${JSON.stringify(noOpen)} — ${USAGE}`);
}
```

and the launch condition narrowed from `if (!flags['no-open'])` to `if (noOpen === undefined)` —
falsiness is no longer the question once the guard has left the flag `true` or absent, and
`undefined` says what the branch means: the operator did not type it.

Three choices in that line, each with its reason in place:

- **Exactly `true`, which is what the reviewer asked for**, rather than "a string that looks like a
  path". A parser that hands a flag a value has consumed a token whatever the token was, so testing
  its *shape* would refuse `my-project` and accept `--no-open 7717`, which is the same mistake with
  a plausible-looking argument.
- **The flag and the token are both named**, `portFrom`'s own cadence beside it — the person typed a
  specific token and a bare usage line makes them find it.
- **`USAGE` is quoted, not composed**, so this refusal and the positional one offer the same flags
  as the help.

**This is the command's only valueless flag, which is what bounds the check to one** rather than to
a general unknown-flag rule: `--port` is spelled rather than coerced (`portFrom` refuses `true`
already, pinned at `open.test.ts`'s `['--port']` row) and `--project` takes a value. Stated in the
comment so a later flag is a visible act rather than a silent hole.

**It sits ahead of the three ruled refusals and is not a fourth member of that order.** Daemon →
project → bundle are claims about an *installation*; both argv clauses are about what was typed,
are wrong on every installation, and cost no I/O. The module header's ordering paragraph moved from
*"The positional refusal … a fourth member"* to *"The two argv refusals … further members"*, which
is the only other production line that changed.

---

## 2. The tests

### `a positional the parser parked in --no-open is refused too, and nothing starts`

**The argv level first, which is the reviewer's explicit ask and also what makes this a second case
rather than the same one:**

```ts
const hidden = parseArgv(['open', '--no-open', 'my-project']);
expect(hidden.rest, 'the parser left the token in `rest`, so this needs no second clause').toStrictEqual([]);
expect(hidden.flags['no-open'], 'the flag no longer swallows the token after it').toBe('my-project');
```

A guard reading `rest` alone is complete only if nothing else can hold a positional, so the premise
that something can is asserted rather than assumed — and if the parser ever stops doing it, this
fails and says the second clause has no subject instead of quietly becoming decoration.

**Written where a row in `argv.test.ts` would have been, deliberately.** That file is Q-0090's
register of the parser's seven behaviours and already pins this one; a Q-0126 row there would be
that behaviour asserted twice, in someone else's register, free to drift. What is new is that *this
command* meets it, which is a claim about this command.

Then the command is driven over a real fixture bundle and an operating-system-assigned port, with
the ordering the sibling test had to avoid in order to be about `rest` at all —
`['open', '--project', project, '--no-open', 'my-project', '--port', port]` — and required to exit
`ERROR`, name the flag, name the token, end with the help's usage line, print **nothing**, and leave
**nothing listening**. The rescue timeout is the sibling's and is not part of the claim: without it
a regression serves rather than refuses and the failure would be Vitest's timeout rather than an
assertion naming what broke.

### `and a --no-open that took no value is not refused, so that clause is about the value`

The discriminator, its own test so it cannot be read as part of the assertion above: the flag as a
person types it gets **past** this clause and is stopped further down by `--port` instead. Without
it the clause above is satisfied by a command that refused `--no-open` outright — which is exactly
what the second mutation below produces.

---

## 3. The defect this round found in its own guard

The flag-naming clause was first `expect(plain(result.stderr)).toContain('--no-open')`.

**It could not fail.** The refusal quotes `usage: quorum open [--port <n>] [--no-open]`, so the
usage line satisfies it — a refusal naming nothing at all passes. Measured rather than reasoned:
under the mutation that replaced the message with `that flag takes no value`, that clause stayed
**green** and only the token clause fired.

It now reads off the **condition half**, split at the em dash — what the command observed, as
against what it offers — and fires on its own:

```
AssertionError: the refusal does not name the flag that took a value: expected '✗ that flag takes no value' to contain '--no-open'
```

Fourth instance of that family in this ticket, after round 1's two and round 2's one. **The usage
derivation was also extracted rather than copied** into the second test: round 4 fixed that clause
once by deriving it from `HELP`, and transcribing it into a second call site is the drift it exists
to catch. It is one `offeredUsage()` helper now, with round 4's anti-vacuity clause inside it, read
by both refusals.

---

## 4. GO-6 — five mutations, one at a time, each reverted immediately

| Mutation | Red, and how |
| --- | --- |
| the guard removed, launch back to `!flags['no-open']` | **the review's own case** — *"a value on --no-open was accepted: expected 130 to be 1"*, the daemon having started |
| the guard widened to `noOpen !== undefined` | the discriminator by its own message — *"a valueless --no-open was refused as though it carried a value"* |
| the flag name dropped from the message | *"the refusal does not name the flag that took a value"* — **after** that clause was fixed; it was green before (§3) |
| the token dropped, flag kept | *"the refusal does not name the token that was swallowed"* — so the two naming clauses fail separately |
| `USAGE` dropped from the message | *"the refusal does not end with the help's own open line"* |

The two new tests point in opposite directions — one requires the refusal, the other requires an
invocation without a value to get past it — so neither reads as the other written twice.

---

## 5. Verification

- `pnpm install --frozen-lockfile` clean. `pnpm turbo run test lint typecheck --force --continue` →
  **21/21 tasks, 0 cached, 0 errors**; `@quorum/cli` 26 files / **681** tests, up from 679.
- `pnpm turbo run build --force` → **5/5, 0 cached**, 3.8 s.
- **Through the installed shim**, both directions in the same pass:
  - `pnpm exec quorum open --no-open my-project` → exit 1,
    `✗ --no-open takes no value, and was given "my-project" — usage: quorum open [--port <n>] [--no-open]`
  - `pnpm exec quorum open --port 7739 --no-open` → `✓ Quorum is serving http://127.0.0.1:7739 — press Ctrl-C to stop`,
    serving until stopped. The refusal is not a regression on the flag it guards.
- `pnpm exec quorum lint` → 6/6. `pnpm sweep:git-identity` → *"the workspace suite executed and
  green with no resolvable git identity"*, 7/7 forced 0 cached.

---

## 6. The class, not the instance

The review named one flag. Within this command there is exactly one more place the shape could
live, and it is closed: `--port` and `--project` both take values, so a token after either belongs
to that flag, and `portFrom` already refuses the `true` a valueless `--port` parses to — spelled
rather than coerced, with its own row in the existing test. `--no-open` was the only valueless flag,
which is stated in the guard's comment so that a later one is a visible act.

Outside this command the class exists and is **measured rather than asserted** — see *Reported and
not fixed*. It is not fixed here: `runs` and `run` are other tickets' surfaces with their own
criteria, and `argv.ts:54` is preserved behaviour whose narrowing Q-0112's body already prices as a
frame change with four consumers.

---

## 7. What I deliberately left alone

- **AC-1 to AC-16 are otherwise untouched.** Round 1 landed AC-1 to AC-11, round 2 AC-12 to AC-16,
  round 3 the resolution predicate and round 4 the positional clause. This round adds one guard, one
  narrowed condition, two tests and one extracted helper.
- **No document changed, and that is a judgement rather than an omission.** AC-11 requires that no
  document promising this command say something false. `README.md`, `docs/USAGE.md`,
  `docs/04-architecture.md` and `commands.ts`'s help all spell the flag `[--no-open]` with no value
  placeholder, so the refusal implements what they already promise; nothing about the documented
  cases moved. Round 4's plan-bullet correction stands and *"Both halves are implemented"* is still
  true.
- **No new seam, no new export.** `USAGE` stays module-private and the test reads the refusal's own
  bytes.
- **`argv.ts` is unchanged.** The parser behaviour is Q-0090's preserved defect, pinned in its own
  register; this command meets it rather than asking it to move.

---

## 8. Reported and not fixed

- **The same shape is live in `quorum runs`, measured through the shim**:
  `pnpm exec quorum runs --json Q-0126` answers `{"mode":"list","runs":[],"warnings":[]}`. `--json`
  swallowed the token, `runs.ts:271`'s `rest[0]` is undefined, and the command listed everything
  instead of that run's detail — silently, which is this round's own class. Q-0092's surface, with
  its own criteria and its own register; fixing it here is the scope creep this role forbids.
- **A valueless `--project` reaches `loadProject` as a boolean**, measured:
  `✗ TypeError [ERR_INVALID_ARG_TYPE]: The "paths[0]" argument must be of type string. Received type
  boolean (true)` at `project.js:65`, exit 1. It refuses **loudly** rather than defaulting silently,
  so it is not the class the reviewer found; and it is every command that reads `flags.project`
  rather than this one. Q-0112's body already routes the shape to a successor for `--intent` and
  records why narrowing `argv.ts:54` is not done in passing.
- **`harness/architecture.md:25` and `harness/product-context.md:80` still say "four packages
  emit"**, stale since Q-0125 made `@quorum/server` the fifth; `docs/04-architecture.md` says five.
  Rounds 1 to 4 each reported and left it, and it is left again for the reason that stands: it is
  Q-0125's claim with its own sixteen register sites, and moving one of two makes the drift worse.
- **`packages/core/src/backlog/backlog.ts:330`** — unused `eslint-disable` directive. Pre-existing,
  in a file this change does not touch, 0 lint errors.
- **The review environment could not execute tests** — round 4's own observation, `EPERM` under
  `packages/core/node_modules/.vite-temp`. That is the fourth consecutive round whose verdict rests
  on reading, which is why §4's mutations were run rather than this round's green being banked
  (Q-0051).
