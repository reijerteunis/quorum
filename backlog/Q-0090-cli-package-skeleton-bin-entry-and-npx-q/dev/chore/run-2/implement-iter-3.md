# Q-0090 — implement, run 2, iteration 3

**Revision round.** `review/chore/run-2/chore-iter-2.md` returned two majors and no nits. Both are
accepted and fixed. Three files changed, all under `packages/cli/src`; `package.json`,
`turbo.json`, `pnpm-lock.yaml`, `docs/` and `packages/core` are untouched this round.

**No erratum is owed.** Both findings are the requirement *under-implemented*, not the requirement
contradicting itself: AC-3 says the uncaught-rejection path is "Preserved", and AC-1 asks for the
`bin` **field** while non-goal 1 gives the executable to Q-0096. Neither finding required a ruling,
so the erratum channel AC-1 held open stays unused.

---

## Finding 1 — `stackOf` diverged from `e.stack ?? String(e)` for the raising values

> *major: `packages/cli/src/fail.ts:47` … the spike raises while accessing a nullish value or
> concatenating a symbol, whereas this code prints a coloured value and exits through `die`.
> Reporting and pinning the divergence does not authorize it under AC-3 and ground rule 3.*

**Accepted, and correct on every point.** Iteration 2 wrote the expression as
`String(e?.stack ?? e)`, which is the readable spelling of the *idea*, and the idea is not what
AC-3 says is preserved. Two of its four differences from the spike's actual expression were
labelled a "deliberate divergence" with an authority line, which is the move ground rule 3 does not
authorise: a defect is reported and **not changed**, and a comment saying so does not convert a
change into a report.

### Measured before anything was written

I ran the spike's expression — `die(e.stack ?? String(e))` with the spike's `die` body — over ten
thrown values rather than reasoning about it. Every row below is observed output, not inference:

| thrown value | the spike's expression | iteration 2's `stackOf` | agrees? |
| --- | --- | --- | --- |
| `new Error('boom')` | prints the stack | prints the stack | ✅ |
| `'just a string'` | prints `just a string` | same | ✅ |
| `42` | prints `42` | same | ✅ |
| `{ stack: 42 }` | prints `42` | same | ✅ (round 1's finding, still closed) |
| `{ stack: null }` | prints `[object Object]` | same | ✅ |
| function carrying a `stack` | prints the stack | same | ✅ |
| **`null`** | **raises** `TypeError: Cannot read properties of null (reading 'stack')` | prints `null`, exits 1 | ❌ |
| **`undefined`** | **raises** `TypeError` | prints `undefined`, exits 1 | ❌ |
| **`{ stack: Symbol('s') }`** | **raises** `TypeError: Cannot convert a Symbol value to a string` | prints `Symbol(s)`, exits 1 | ❌ |
| `Symbol('thrown')` | prints `Symbol(thrown)` | prints `Symbol(thrown)` | ✅ |

The last two rows are the pair that decides the shape, and they pull in opposite directions: a
**symbol-valued `stack`** must reach `die` uncoerced, so it raises on the `+`, while a **thrown
symbol** must go through `String()`, so it prints. Any implementation that applies `String()` once,
anywhere, gets exactly one of them right.

### What shipped

`stackOf` is gone. `dieOnUnexpected` now writes the spike's expression out, with the coercion left
where the spike leaves it — inside `die`:

```ts
const message: unknown = (error as { stack?: unknown }).stack ?? String(error);
return die(message as string);
```

Three properties, each load-bearing:

- **the property access is unguarded** (`.stack`, not `?.stack`), so `null` and `undefined` raise
  before `die` is reached and nothing is printed;
- **the fallback is `String(error)`** and not `error`, so a thrown symbol prints;
- **the assertion to `string` is deliberate**, not a convenience. `die` takes a `string` and this is
  the one call site that may hand it something else, so the `+` inside `die` performs the same
  coercion — and raises the same `TypeError` on a symbol — that the spike's does. `die`'s own
  signature is unchanged, so every sibling command still gets a typed error path.

`die` and `failSoftly` are byte-identical to the round the reviewer read.

### The new rows were demonstrated red, each against the port it discriminates

Four rows, and showing them red once would only prove the guard fires (Q-0071), so each was aimed
at the implementation it exists to catch.

**Against iteration 2's `String(e?.stack ?? e)`** — `vitest run src/fail.test.ts`:

```
× a thrown null raises, because the property access is unguarded
× a thrown undefined raises, because the property access is unguarded
× a symbol-valued stack raises inside die, where the + cannot coerce it
  Error: expected a raise, and the body exited
  Tests  3 failed | 12 passed (15)
```

**Against the other plausible port, `(e as …).stack ?? e`** — the one that drops the `String()`:

```
× while a thrown symbol prints, because the fallback is String() and String() takes one
  Tests  1 failed | 14 passed (15)
```

That fourth row is the one the reviewer's finding does not name and which a fix could have broken
while satisfying it: it passes under *both* the rejected implementation and the shipped one, and
fails only under the fallback that looks most natural once you know symbols raise. It is in the
file for that reason.

Both variants were temporary edits, reverted; the final `fail.ts` is the three-property version
above, and the suite is green.

### The test harness changed, and why it had to

Two of AC-3's rows *raise* instead of exiting, and `observe` could only express "it exited" — it
rethrew anything that was not the `Exited` sentinel. Testing a raise through it would have meant
wrapping call sites in `expect(...).toThrow()`, which cannot see the streams and so cannot assert
the half that matters: **nothing was printed**.

So `observe` is now a thin reader over `attempt`, which reports which of three ways a body ended —
`exited`, `raised`, `returned` — and a second reader, `raises`, refuses anything but a raise. That
refusal is what makes the rows discriminate: under the rejected implementation `raises` reports
`expected a raise, and the body exited` rather than quietly returning empty streams. Every existing
call site of `observe` is unchanged.

### Reported and not fixed

**The two raising rows are a defect.** The one path that exists to turn a crash into a message
replaces it with a different crash, and in the spike that different crash is an unhandled rejection
inside `main().catch` — so the operator sees a `node:events` report instead of the `✗` line the
path was written to print. It is preserved here under ground rule 3 and named in `fail.ts`'s JSDoc
as a defect rather than as a design.

**It implies a decision, which is the human's.** Fixing it is a behaviour change on the error path
of a binary a stranger meets, and the choice — guard the access and print, or let the crash stand —
is the same *shape* as the two zeros GA-4 already owes a successor for (an unknown command exits 0;
`regressed` shares `completed`'s fallthrough). I have not opened a ticket and have not written a
decision entry. My recommendation is that it joins GA-4's successor rather than becoming a third
one: all three are "the exit path reports the wrong thing", all three are this ticket's subject
without being its scope, and none can be decided by an implement step.

---

## Finding 2 — the `bin` target test constrained a decision Q-0090 does not own

> *major: `packages/cli/src/package.test.ts:67` The test requires the provisional `bin` target to
> end in `.js` … This would make valid Q-0096 choices such as an extensionless launcher or another
> output layout fail Q-0090's suite.*

**Accepted.** The gate ruling of 2026-09-01 gives Q-0096 the emit strategy, the output layout and
the executable a `bin` entry points at; non-goal 1 says this ticket declares the field and does not
make it run. A suffix assertion is this package pinning an answer to a question another ticket owes
a decision entry for.

### Demonstrated rather than conceded

I checked the finding was real before acting on it, by pointing `bin` at exactly the choice the
reviewer named — an extensionless `./bin/quorum` — with the rejected clause temporarily restored:

```
× and says nothing about what that key points at, which is Q-0096's to decide
  AssertionError: TEMPORARY — the rejected clause: expected false to be true
```

With the clause removed and the same extensionless target in place, the file is green 11/11 — so
the suite is now indifferent to the target's shape, which is the property the finding asked for.
Both temporary edits were reverted; `packages/cli/package.json` is byte-identical to the round the
reviewer read (`git diff HEAD -- packages/cli/package.json` is empty), and the target it declares,
`./bin/quorum.js`, stays as the provisional value Q-0096 confirms or replaces.

### What the test asserts now

Only that the `quorum` key carries a non-empty string value. The `existsSync(target) === false`
clause went with the suffix clause: it is not a format assumption, but it is the same class of
overreach — it turns Q-0096 *creating the file* into a red Q-0090 suite, and AC-1's own *Test:*
line asks for the two workspace dependencies, the `bin` key and the absence of any other
dependency, and for nothing about the target.

**The measurement it used to carry is reported instead of pinned**, which is the right home for it:
`pnpm install --frozen-lockfile` exits 0 with the manifest as declared and creates no shim, because
nothing in the workspace depends on `@quorum/cli`, so pnpm is never asked to resolve the target.
That answers AC-1's one measured unknown — *will pnpm refuse a `bin` naming a path that does not
exist?* — with **no**, and therefore closes the erratum route AC-1 held open for it.

Note for Q-0096: `expect(Object.keys(own.bin ?? {})).toStrictEqual(['quorum'])` in the test above it
is unchanged, so the key name is still pinned. Only what it points at is free.

---

## File by file

**`packages/cli/src/fail.ts`** — `stackOf` deleted; `dieOnUnexpected` writes out the spike's
expression with the coercion inside `die`. JSDoc rewritten to state the four behaviours that belong
to the expression rather than to the idea, each with its measured outcome, and to name the two
raising rows as a reported defect. `die`, `failSoftly` and the module header are unchanged.

**`packages/cli/src/fail.test.ts`** — `observe` split into `attempt` (three outcomes) plus `observe`
and the new `raises`, which refuses a non-raising body. The "one deliberate divergence" test is
gone, replaced by four rows: a `test.each` over `null` and `undefined` (one test each, because two
clauses in one test means the second never runs once the first fails), a symbol-valued `stack`, and
a thrown symbol. The eight rows the reviewer already accepted are unchanged, including round 1's
`{ stack: 42 }`. AC-5's spawned-child demonstration is untouched. 15 tests in this file, 86 in the
package.

**`packages/cli/src/package.test.ts`** — the `bin` target test asserts only that the key carries a
non-empty string; the `.js` suffix and the non-existence clauses are removed, and the install
measurement is recorded in the comment. Nothing else in the file moved: the AC-10(a) register, the
lockfile extraction and its empty-importer subject test, and AC-9's three assertions are as
reviewed.

## Deliberately left alone

- **`packages/cli/package.json`** — verified byte-identical to HEAD after the temporary probe. The
  provisional target stays; changing it would be taking Q-0096's decision by another route.
- **`packages/cli/turbo.json`** and **`pnpm-lock.yaml`** — no read surface changed, so no register
  moved.
- **`docs/06-development-plan.md`** — AC-11(a)'s Q-0096 bullet and AC-11(b)'s four re-derived
  figures landed in the earlier rounds and are untouched; `@quorum/shared`'s 142 tests are green,
  which is the check that says so.
- **`packages/core/src/spike-parity.test.ts`** — no `spike/test/` file was translated, so the four
  pinned totals must not move, and they did not (ground rule 5).
- **`spike/`** — nothing under `spike/src` or `spike/test` was changed, so no freeze re-record is
  owed (ground rule 1, non-goal 7).
- **Q-0059, Q-0060, Q-0066, Q-0068 and Q-0067's version probe** — open, and not closed in passing.
- **The other eleven `fail.test.ts` and `package.test.ts` assertions** the review did not raise.
- **No command implemented, no domain helper copied.** Nothing appeared to be missing from
  `packages/core` this round, because nothing new was needed from it (ground rule 4).

## Verification

Run in this worktree after `pnpm install --frozen-lockfile` (exit 0, "Already up to date") and
`npm install --prefix spike --no-audit --no-fund`:

| check | command | result |
| --- | --- | --- |
| typecheck | `pnpm turbo run typecheck --force` | **7/7 tasks, 0 cached** |
| lint | `pnpm turbo run lint --force` | **7/7 tasks, 0 cached** |
| workspace suite | `pnpm turbo run test --force` | **7/7 tasks, 0 cached** — 1512 passed, 2 skipped. `@quorum/core` 1280 + 2 skipped, `@quorum/shared` 142, `@quorum/cli` **8 files / 86 tests** |
| spike suite | `npm test --prefix spike` | **19/19 files passed** |
| flow lint | `node spike/bin/harness.js lint` | **6/6 flows ✓** |
| git-identity sweep | `pnpm sweep:git-identity` | green — *"both suites executed and green with no resolvable git identity"* |

All three turbo tasks were run **forced**, and separately rather than as one
`turbo run lint typecheck test` invocation — that combined form aborts the whole run when any single
task fails and then reports every in-flight task as `ELIFECYCLE`, which is misleading rather than
informative. Each task passes on its own.

Nothing here was run as a bare `node packages/…` command: R-1 says the allowlist refuses it, and
every check above is either a Vitest test running in process, a `pnpm` invocation, or the allowed
`node spike/*`. The one probe I needed outside a test — the ten-row table of the spike's expression
— was run through `pnpm exec node` on a scratch file under `/tmp`, which is outside the repository
and left nothing in the tree; `git status` is the three modified files and nothing else.

**The second environment row is not mine to run.** Q-0072's closing finding asks for both suites
forced in the `integrate` worktree *and* again on `main` after the merge; this worktree has
`.harness/worktrees` and `.quorum/runs` present, so it is one row of the two.

## For the reviewer

- **The `message as string` assertion is the fix, not a shortcut around the type system.** Removing
  it means either coercing with `String()` — which breaks the symbol-valued `stack` row — or
  widening `die`'s parameter to `unknown`, which would hand every sibling command an untyped error
  path in order to preserve a spike behaviour that only one call site needs. It is documented on the
  line above it, and it is neither an `any` nor a `@ts-ignore`, so it passes the three lint rules
  that are on.
- **`fail.test.ts` grew by one helper and four tests and lost one.** The helper is what let the
  raising rows assert that *nothing was printed*, which is the half of the behaviour a `toThrow()`
  wrapper cannot see.
- **The defect above wants a ruling, and I did not take it.** It is named in `fail.ts`'s JSDoc as a
  defect, reported here, and recommended into GA-4's successor rather than opened as a ticket or
  written up as a decision entry — both of which are outside what this step may write.
