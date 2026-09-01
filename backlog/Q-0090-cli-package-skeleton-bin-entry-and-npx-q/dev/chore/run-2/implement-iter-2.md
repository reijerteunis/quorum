# Q-0090 — implement, run 2, iteration 2

**Revision round.** One finding in `review/chore/run-2/chore-iter-1.md`, a major, addressed in full.
Two files changed. No criterion outside AC-3 was touched, and no file outside `packages/cli/src`
moved.

---

## The finding, and why it is right

> **major:** `packages/cli/src/fail.ts:36` `stackOf` only uses `error.stack` when it is a string,
> whereas AC-3 requires preservation of `e.stack ?? String(e)`. For a thrown value such as
> `{ stack: 42 }`, the spike reports `42`, but this implementation reports `[object Object]`.
> Preserve the nullish-fallback behavior for any `stack` value and add coverage for a non-string,
> non-nullish `stack` property.

**Accepted, and reproduced before it was believed.** `spike/bin/harness.js:569` is
`main().catch((e) => die(e.stack ?? String(e)))`. `??` tests whether the property is **present**,
never what type it holds, and `die` (`:124`) is `console.error(c.red('✗ ') + m)` — so the spike hands
a `42` to string concatenation, which coerces it. Iteration 1's guard read the property's *type*, so
the `??` never ran and the value fell through to `String(error)`. That is a behaviour change on the
one path AC-3 names verbatim, which is exactly what ground rule 3 forbids.

**A second case falls out of the same fix, and the reviewer's example did not cover it.**
Iteration 1's guard opened with `typeof error === 'object'`, and `typeof` answers `'function'` for a
function. A thrown function carrying a `stack` — which the spike reports by its stack, since `e.stack`
is a plain property read — was reported as its source text. The property access the fix performs has
no such hole. It is pinned in its own test rather than mentioned, because it is the row that
discriminates the two implementations most sharply.

---

## What changed, file by file

### `packages/cli/src/fail.ts` — the fix, 5 lines of code and a JSDoc block

`stackOf` (`:47–50`) is now the spike's expression with its coercion made explicit, because
{@link die} takes a `string` where the spike's `+` took anything:

```ts
const stackOf = (error: unknown): string => {
  const stack = (error as { stack?: unknown } | null | undefined)?.stack;
  return String(stack ?? error);
};
```

Row by row against `e.stack ?? String(e)`:

| thrown value | spike | iteration 1 | now |
| --- | --- | --- | --- |
| `new Error('boom')` | the stack | the stack | the stack |
| `{ stack: 42 }` | `42` | `[object Object]` ❌ | `42` ✓ |
| a function with `.stack` | the stack | `String(fn)` ❌ | the stack ✓ |
| `{ stack: null }` | `[object Object]` | `[object Object]` | `[object Object]` |
| `{ stack: undefined }` | `[object Object]` | `[object Object]` | `[object Object]` |
| `'just a string'` | `just a string` | `just a string` | `just a string` |
| `42` | `42` | `42` | `42` |
| `null` | **`TypeError`** | `null` | `null` — registered below |

The JSDoc states the contract, names the trap in one sentence — *the `??` tests whether a `stack`
property is there and never what type it is* — and carries `Why: preserved, see Q-0090 AC-3`. The
divergence gets its own paragraph rather than a footnote.

**No other export moved.** `die`, `failSoftly` and `dieOnUnexpected` are byte-identical, including
the space *inside* the red span that AC-3 preserves. The module still imports nothing but
`./colour.js` and `./exit.js`, so `frame.source.test.ts`'s `IO_MODULE` clause is untouched.

### `packages/cli/src/fail.test.ts` — four tests added under `AC-3 — the uncaught-rejection path`

- **`a stack that is present but not a string is still what is reported`** (`:109`) — the reviewer's
  case. Asserts the stderr contains `42` **and** does not contain `[object Object]`, so it fails
  under iteration 1's implementation for the stated reason rather than incidentally.
- **`and a stack on a thrown function is reported…`** (`:118`) — the `typeof === 'object'` hole.
  **Its own test, deliberately**: sharing a test with the row above would mean it never ran while
  that row was red, so it would have been carried rather than checked (Q-0071 — showing a guard has
  a subject proves it fires, not that each clause does).
- **`and a nullish stack falls back to the value…`** (`:125`) — `{ stack: null }` and
  `{ stack: undefined }` both report `[object Object]`. This is what the `??` is *for*, and it is
  what a fix reaching for `String(stack)` alone would break.
- **`a thrown null is reported as null, the one deliberate divergence`** (`:130`) — the registration
  described below, with its authority line.

All four go through the existing `observe()` helper, so `die` is observed rather than suffered and
the assertions run in process. No test in this file spawns anything new; AC-5's two children are
unchanged.

---

## Demonstrated red before green, three ways

**1. The reviewer's row, against iteration 1's implementation** — reverted in place, suite run,
restored:

```
❯ src/fail.test.ts (11 tests | 1 failed)
  × a stack that is present but not a string is still what is reported
AssertionError: expected '[31m✗ [0m[object Object]\n' to contain '42'
```

**2. Both new clauses, each on its own**, once the function-carrier row had its own test:

```
❯ src/fail.test.ts (12 tests | 2 failed)
  × a stack that is present but not a string is still what is reported
  × and a stack on a thrown function is reported, since typeof answers "function" there
```

**3. The fallback clause has a subject.** The two nullish rows and the divergence row pass under
*both* implementations, which on its own would make them pins nobody has seen fail. So the fix was
mutated to `String(stack)` — the `??` dropped, everything else identical — and three tests go red,
including one that predates this round:

```
❯ src/fail.test.ts (12 tests | 3 failed)
  × a thrown value that is not an Error is reported by String()
  × and a nullish stack falls back to the value, which is what the ?? is for
  × a thrown null is reported as null, the one deliberate divergence
AssertionError: expected '[31m✗ [0mundefined\n' to contain 'just a string'
```

The final file is the fix; both mutations were reverted and the diff below is what remains.

---

## Registered, not fixed: a thrown `null` or `undefined`

`(error as …)?.stack` short-circuits where the spike's `e.stack` **raises a `TypeError` inside its
own `catch` handler**, which Node then reports as an unhandled rejection. So for a thrown `null` the
frame prints `✗ null` and exits 1, and the spike prints a `TypeError` about reading `stack` of
`null` and exits 1 by a different route.

This is a divergence and it is stated rather than smuggled: it is in the JSDoc, it is pinned by a
test, and it is here. It was **not** introduced by this round — iteration 1 had the same behaviour
and the review did not raise it. Preserving the spike exactly would mean `dieOnUnexpected`, whose
declared return is `never`, reaching that `never` by throwing a `TypeError` from inside the handler
whose whole job is to report a throw. I did not take that trade, and I did not silently take the
other one either.

**One residual, stated because the table above cannot cover it:** a `stack` holding a `Symbol` is
reported by `String()` here, where the spike's `+` throws. Symbols are not thrown in this codebase
and nothing in either tree constructs one; noted for completeness, not pinned.

---

## What I deliberately left alone

- **Every other file from iteration 1.** `argv.ts`, `colour.ts`, `commands.ts`, `exit.ts`,
  `index.ts`, `main.ts`, their tests, `package.json`, `turbo.json`, `pnpm-lock.yaml`,
  `docs/06-development-plan.md` and `packages/core/src/turbo-inputs.test.ts` are unchanged. The
  review raised nothing against them and a revision round is not a second implement round.
- **`packages/core/src/backlog/backlog.ts:276`** — `pnpm lint` reports one **warning**, *"Unused
  eslint-disable directive (no problems were reported from 'no-control-regex')"*. Pre-existing, in a
  file no criterion of this ticket names, and lint still exits 0 with 0 errors. Reported rather than
  fixed in passing; it wants its own change.
- **`spike/src/` and `spike/test/`.** Ground rules 1 and 2. Nothing in this round touches either,
  so no freeze re-record is owed.
- **The registers.** No `spike/test/` file was translated and no new outside-package read was added,
  so `spike-parity.test.ts`'s four pinned totals (220 / 2739 / 2469 / 5428, 55%) and
  `test-command.test.ts`'s seven-key `CI_JOBS` do not move; both suites confirm it by passing
  forced. `turbo-inputs.test.ts` keeps the entry iteration 1 earned for AC-5's `os.tmpdir()`
  fixture — this round adds no spawned child and no new read.

---

## Verification, run in this worktree after `pnpm install --frozen-lockfile` and `npm install --prefix spike --no-audit --no-fund`

| check | result |
| --- | --- |
| `pnpm turbo run lint typecheck --force` | **14 successful, 14 total · 0 cached**; 0 errors, the one pre-existing `core` warning above |
| `pnpm turbo run test --force` | **7 successful, 7 total · 0 cached**; `@quorum/cli` **83 passed** across 8 files |
| `npm test --prefix spike` | **all 19 test files passed** |
| `pnpm sweep:git-identity` | green — *"both suites executed and green with no resolvable git identity"* |
| `node spike/bin/harness.js lint` | 6/6 flows ✓ (no flow file changed; run for completeness) |

`git status --porcelain` at the end of the round is exactly:

```
 M packages/cli/src/fail.test.ts
 M packages/cli/src/fail.ts
```

The second environment row — forced on `main` after the merge, per Q-0072's closing finding — is the
human's at the gate; this worktree has neither `.harness/worktrees` nor `.quorum/runs`.

---

## Nothing else to raise

No criterion was found ambiguous this round, no decision entry is implied by the change, and nothing
was left unaddressed. The finding was one function, the fix is one expression, and the coverage the
reviewer asked for is there with each clause shown to fire on its own.
