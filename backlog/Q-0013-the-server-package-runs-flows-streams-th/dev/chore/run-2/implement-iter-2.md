# Q-0013 — implement report, run 2, iteration 2

*Revision round. Two review findings, both accepted, both fixed. Verdict: `proceed`.*

---

## 1. Finding 1 — `shutdown()` could leave a run it reported having released

> *major: `packages/server/src/host.ts:333` … a concurrent start can be omitted from the snapshot,
> become running after shutdown resolves, and keep its run lock and work alive.*

**Accepted in full, and the mechanism is exactly as reported.** `shutdown()` filtered
`record.state === 'running'`, and a record is `'refused'` from the moment it is minted until its
first pull returns — which is precisely where the lock is taken, the branch head read and the banner
emitted. So a start entered before shutdown and still awaiting that pull was invisible to the
snapshot, and became a live run holding a ticket after the host had reported that it had released
everything. `start()` remained callable after shutdown resolved, which is the same defect without
the race.

This sits directly against AC-12's normative half — *shutdown releases **every** live run* — and it
is a hole that criterion's own *Test:* clause could not see, because that clause drives a run that
is already running before shutdown is entered.

### What changed in `packages/server/src/host.ts`

- **`closed`**, set synchronously at the top of `shutdown()`, before anything awaits. A start issued
  from then on is refused above `loadFlowByName` and `Backlog.read`, so it loads no flow, reads no
  ticket, takes no lock and writes no history.
- **`beginning`**, the set of starts this host has begun and not yet finished. The start body moved
  into a `begin` closure so that the promise the method awaits is the promise the set holds; `start`
  registers it, awaits it and removes it in a `finally`.
- **`shutdown()` waits for `beginning` before it snapshots.** `allSettled`, not `all`: a start that
  threw has nothing to release and must not stop the runs that do. After that wait the running set
  is final, because `closed` means nothing can join it.
- **The shutdown is memoised** (`released ??= …`), so a second call — concurrent or sequential —
  joins the first rather than taking a second snapshot and calling `return()` on a run twice. The
  existing *"a second shutdown is harmless"* case still passes and now says something stronger.
- **`mint` and `refused`** were factored out of the start body, because the closed-host path needs a
  handle and a refusal record exactly like the two `core` refusals do. `refuse(record, error)` is
  now `refused(record, refusalFor(error))` — same behaviour, one composer.

**The closed-host condition is this surface's own**, and it is the only sentence in the package that
is not `core`'s: `core` was never asked. It is exported as `HOST_CLOSED_CONDITION` so a transport and
a test can name it rather than transcribe it, which is a visible addition to `index.test.ts`'s
register — the act that register exists to make visible.

### What it deliberately does **not** do

- **It does not abort the start in flight.** A start that has taken the lock has run history to
  finalise, and cancelling it at the first pull would report as a *refusal* a run that had already
  begun. Waiting for it and then releasing it through the same abandonment path AC-12 names gives
  that run the same `interrupted` terminal record every other live run gets.
- **It adds no `closing`/`closed` distinction to the public surface.** One flag covers both phases
  because one sentence is true in both, and a second state nobody can observe would be a decision
  taken on Q-0118's behalf.

---

## 2. Finding 2 — the remedy module named a `core` symbol, and the guard could not see it

> *major: `packages/server/src/refusal.ts:21` … this module instead imports `ProjectNotFoundError`
> and classifies errors with `instanceof` at line 53. The source test at
> `packages/server/src/package.test.ts:286` does not enforce its stated claim.*

**Accepted in full, including the half about my own test.** AC-5 states the shape in its normative
half — *one site, taking the condition as a **string** so the module names no `core` symbol* — and
that is a statement about the code, so it is the code that was wrong. And the clause I wrote to
enforce it was `expect(refusal).toContain('condition: string')`, which the `Refusal` **interface's
own field** satisfies: it passed over the exact module the criterion forbids. That is *"A check is
not established by reading it"* (2026-08-29) in the guard written for the criterion, caught by the
panel rather than by its author.

### The split, and why it is the CLI's shape rather than a new one

`packages/cli` does not put the `instanceof` in `fail.ts`. Six commands classify (`lint.ts:55–56`,
`board.ts:48–49`, `adapters.ts:53–54`, `runs.ts:74–75`, `run.ts:232–233`, `ticket.ts:63–64`) and one
module composes. This package now does the same with one call site instead of six:

- **`refusal.ts` — the remedy module.** `Refusal`, `NO_PROJECT_REMEDY`, and two composers,
  `refusalOf(condition: string)` and `noProjectRefusal(condition: string)`. It imports **nothing**,
  from `@quorum/core` or anywhere else. It cannot classify, because it names nothing to classify
  against.
- **`failures.ts` — new, the classifying half.** `conditionOf`, `refusalFor(error)` and
  `openProject(dir?)` with `ProjectOutcome`. It owns both `core` symbols the remedy module used to
  name, and hands strings on.

`index.ts` re-exports `openProject` and `refusalFor` from their new home; the **runtime surface is
unchanged** apart from `HOST_CLOSED_CONDITION`, and `refusalOf`/`noProjectRefusal` stay internal
because a transport receives refusals and never builds one. `test/fixture.ts` and `host.test.ts`
follow the move. AC-3's `MESSAGE_READS` register moves its `refusal.ts` row to `failures.ts`, which
is the register working: the read went with `conditionOf`.

### The guard, rewritten to have a subject

One clause became four in `package.test.ts`:

| clause | what it is |
| --- | --- |
| the remedy module imports no `@quorum/core` | structural; the criterion's *"names no `core` symbol"* |
| it names no `core` error class | closes the `error.name === '…'` route round the first |
| every **exported signature** takes `condition: string` | over the parameter list, which is what `dieNoProject` bounds — an interface field spelled the same way is not one |
| the classification lives outside it, at one site → `['failures.ts']` | the other half of *"one site"* |

**A fifth clause was written and removed, and the removal is recorded in place**: forbidding the word
`instanceof` fired on the module's own docblock, which explains where the `instanceof` went. A scan
that cannot tell prose from code refuses the record of a decision for repeating the word it decided
about — the reasoning AC-2's barrel clause already gives — and it bought nothing, a module naming
neither the package nor the error class having nothing to classify against.

---

## 3. Shown red before green

Five mutations, each reverted, each with a discriminating message:

1. **`shutdown` no longer waits for `beginning`** → *"a run that started during shutdown outlived it:
   expected 'running' to be 'interrupted'"*. Exactly one test red — finding 1's first case.
2. **The `closed` check disabled in `start`** → the start-after-shutdown case red. Exactly one.
3. **`refusal.ts` restored to the shape the review found** — importing `ProjectNotFoundError` and
   `noProjectRefusal(error: unknown)` — → **all three** new AC-5 clauses red, by name: *"the remedy
   module imports from @quorum/core"*, *"refusal.ts's noProjectRefusal does not take the condition as
   a string: expected 'error: unknown' to be 'condition: string'"*, and *"expected [ 'failures.ts',
   'refusal.ts' ] to strictly equal [ 'failures.ts' ]"*. **The retired clause is green under that
   same mutation**, the `Refusal` interface still carrying `condition: string` — which is the review
   finding reproduced rather than described.
4. **The doc sentence negated** (*"leaves the host open"*) → `docs.test.ts` red naming the clause.
5. The hostile-fixture clause beside them shows both surviving patterns fire on a file that does the
   forbidden thing, so a scan matching nothing at all cannot satisfy them.

---

## 4. Files

| file | what changed |
| --- | --- |
| `packages/server/src/host.ts` | `closed`, `beginning`, `mint`, `refused`, the `begin` closure, the memoised waiting `shutdown`, `HOST_CLOSED_CONDITION`, and three JSDoc paragraphs stating the new mechanism. Most of the diff is re-indentation from moving the start body. |
| `packages/server/src/refusal.ts` | reduced to the remedy module: two string-taking composers, no imports. |
| `packages/server/src/failures.ts` | **new** — `conditionOf`, `refusalFor`, `openProject`, `ProjectOutcome`: every `core` symbol the remedy module used to name. |
| `packages/server/src/index.ts` | the two moved names re-exported from `./failures.js`; `HOST_CLOSED_CONDITION` added. |
| `packages/server/src/host.test.ts` | imports follow the move; two new AC-12 cases — the start racing shutdown, and the start after it. |
| `packages/server/src/package.test.ts` | AC-3's register row moved; AC-5's one weak clause replaced by four, plus a discrimination case. |
| `packages/server/src/index.test.ts` | the surface register gains one name. |
| `packages/server/test/fixture.ts` | `openProject` from its new module. |
| `docs/04-architecture.md` | one paragraph on why shutting down closes the host, and a clause in the status line saying this one was found by the run-2 review rather than by the requirement (GO-3). |
| `packages/shared/src/docs.test.ts` | two clauses holding that paragraph to what shipped. |

---

## 5. Verification

- `pnpm turbo run lint typecheck test --force --continue` → **21/21 tasks, 0 cached**, green. Run
  twice, before and after the last docblock correction.
- `packages/server` alone: **80 tests, 5 files**, ~2.5 s (75 in iteration 1).
- `pnpm sweep:git-identity` → green — *"the workspace suite executed and green with no resolvable git
  identity"*, 7/7 forced 0 cached.
- `pnpm exec quorum lint` → **6/6**.
- `git status` is nine modified files and one new one, and nothing else.

---

## 6. What I deliberately left alone

- **No backpressure ceiling, no second host state, no refusal taxonomy.** The finding is bounded and
  so is the fix. A `Refusal` still carries `{condition, remedy}` and nothing that classifies it for
  the transport; inventing one here would be deciding Q-0118's wire shape.
- **`packages/core` is untouched** beyond iteration 1's three type exports. Non-goal 11 stands.
- **`docs/06-development-plan.md`** still carries the *"override with reason"* twin, per Q-0094
  E-3(a); `04-architecture.md` names it and its owner so it cannot expire.
- **GO-4 is the human's** — CI on the merged commit is what Q-0105's GO-3 requires and no implement
  step can produce it. Verified forced in this worktree only.

**No decision entry is owed.** Nothing here widens a vocabulary, contradicts a landed entry or
changes what `core` does; the closed-host condition is a sentence this surface composes, which *"A
`core` error names the condition; the remedy belongs to the surface"* (2026-09-07) is the authority
for rather than an exception to.

**observation:** `package.test.ts`'s AC-5 signature clause reads `refusal.ts` by name, so a third
module composing a remedy would trip the one-carrier clause while having its signatures unchecked.
That is the register idiom this repository uses everywhere and not a defect introduced here; it is
named because it is the same open question Q-0067's entry already registers about a guard that names
a site and trusts its body.
