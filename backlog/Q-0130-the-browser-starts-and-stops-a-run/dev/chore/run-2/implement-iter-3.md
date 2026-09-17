# Q-0130 — implement, run 2, iteration 3

Revision round. **The single review finding was real**, was reproduced before it was fixed, and the
fix is shown red by four mutations. No criterion moved, no new criterion was invented, and nothing
outside `apps/web/test/source.test.ts` was touched.

`pnpm turbo run lint typecheck test --force --continue` from the repository root: **21 tasks, 21
successful, 0 cached**. `pnpm exec quorum lint` 6/6. `@quorum/web` alone: 20 files, 406 tests — the
test *count* is unchanged because the work landed as assertions inside the existing AC-11 test rather
than as new cases.

---

## 1. The finding, and why it is sharper than it was stated

> `writingFunctions` recognizes only `function name(...)` declarations. A fourth writer expressed as
> an arrow function … is permitted by `WRITE_RULES` yet remains invisible to the identity register.

**Confirmed.** And the measurement that makes it urgent is one the finding did not have:
**the arrow is the house style in the very module the register is about.** `daemon-client.ts` holds
**18 top-level value bindings against 5 function declarations**, and *every reader in it is an
arrow* — `fetchTickets`, `fetchFlows`, `fetchTicket`, `fetchTicketFile`, `fetchRun`, `fetchRuns`.
The three writers happen to be declarations, which is the only reason the blindness was invisible on
disk. So the form the register could not see is the form a fourth writer is **likeliest** to be
written in, by someone copying the reader two lines above it.

It is also exactly the shape Q-0130's own R-4 names — *a guard that stops discriminating* — and the
class `harness/architecture.md` lists second among the things a reviewer should be suspicious of:
**a guard blind to what it is about**.

**Why a brace walk cannot be widened by one case.** The old implementation matched
`function name(` and then brace-matched from the body's `{`. A value binding defeats that in three
different ways, and this is what decided the shape of the fix rather than a preference for AST-ness:

| form | why the brace walk fails |
| --- | --- |
| `const f = (x) => { … }` | the head pattern never reaches past the `=>`, so no head is found at all |
| `const f = (x) => g(x, …)` | there is no body block; the first `{` after the head belongs to a **later** declaration |
| `const f = async function (x) { … }` | `function` carries no name where a declaration carries one |

Adding a second regex for arrows closes the first two and leaves the third, and leaves whatever the
fourth form turns out to be. That is fixing the instance rather than the class, which is this
repository's most-recorded failure.

## 2. What changed

**One file: `apps/web/test/source.test.ts`.** The brace walk is replaced by a region model.

**`declarations(text)`** splits a module into its top-level declarations, and **the extent runs from
one head to the NEXT head rather than to a matching brace**. Every byte after the first head belongs
to exactly one declaration, and the text before it belongs to a named pseudo-declaration rather than
to nothing — so a write cannot fall *outside* the register at all. It can only be attributed to the
wrong name, which **fails** the register rather than passing it. It also deletes a hazard the old
walk carried silently: brace matching counts braces inside strings and comments.

**`writingFunctions(text)`** is now a filter over those regions — a declaration that binds a value
(`const`, `let`, `var`, `function`, `class`) and whose text names the method. Form-agnostic by
construction rather than by enumeration.

**`typesNamingWrite(text)`** is the other half, and it is what makes the three *exhaustive* rather
than merely correct. The method is named a **fourth** time in `daemon-client.ts` — `DaemonRequest`'s
`readonly method: 'POST'`, the type that closes the set by the compiler. That occurrence is
registered **by name** rather than filtered out by a predicate nobody re-reads, so any *other*
declaration naming the method is a write this walk failed to read as one, and it goes red instead of
being quietly absent from the three.

I judge that second half to be the instrument AC-11 asks for rather than an addition to it — the
criterion's *Test:* clause is *"shown red against a fourth writer"*, and a fourth writer in a form
nobody enumerated is still a fourth writer. **It is stronger than the criterion's literal text and a
reviewer should weigh it**, on the same footing as round 1's third unavailable state for AC-6.

**Fixtures added**: the three value-binding shapes in one fixture; a fourth writer in the concise
arrow form; one bound name swapped for another; a reader in arrow form *not* collected; and a write
before the first declaration attributed to the preamble rather than lost.

**A residual, stated rather than left to be found**, in the helper's own docblock: an anonymous
`export default function` has no name to collect and would be attributed to the declaration above it.
Nothing in this app default-exports anything; the day something does, that is where it has to be
taught.

## 3. The mutations, each reverted after

| # | Mutation | Result |
|---|---|---|
| A | the **old walk restored verbatim** | **1 red** — *a fourth writer in the block-bodied arrow form is not reported: expected [ 'answerGate', 'startRun', 'stopRun' ] to strictly equal [ 'answerGate', 'deleteRun', …(2) ]* — the reviewer's finding reproduced word for word |
| A′ | `BINDS_A_VALUE` narrowed to `['function']` | **1 red** — *a writer that is a value binding rather than a declaration is not found: expected [] to strictly equal [ 'answerGate', 'startRun', 'stopRun' ]* |
| B | the preamble region emptied | **1 red** — *a write before the first declaration was attributed to nothing* |
| C | `interface` counted as binding a value | **1 red** — *the set of acts this app performs on a run moved: expected [ 'DaemonRequest', 'answerGate', …(2) ]…* — the split between an act and the type that closes the set is load-bearing |
| D | **`daemon-client.ts`'s own** `method: 'POST'` widened to `method: string` | **1 red** — *the method is named outside every act and outside the type that closes it: expected [] to strictly equal [ 'DaemonRequest' ]* |

D is the one that matters most for trust: it mutates the **shipped module** rather than a fixture, so
the new clause is shown to have a real subject in the code it is about and not only in the strings it
is handed. That is the failure Q-0125's AC-3 recorded — *a demonstration asserted against its own
fixture* — refused here rather than repeated.

## 4. The reviewer's preferred instrument, refused with its authority

The finding says *"preferably through the TypeScript AST"*. **I did not take that route, and this is
a refusal of an instrument rather than of the finding** — which is why the verdict is `proceed`.

Measured before deciding: `typescript` is declared **only** as a root devDependency, and
`apps/web/node_modules` links `@quorum`, `@tailwindcss`, `@types`, `@vitejs`, `jsdom`, `react`,
`react-dom`, `tailwindcss` and `vite` — **no `typescript`**. Under pnpm's strict layout
`import ts from 'typescript'` does not resolve from `apps/web/test/`. Reaching it means declaring it
in `apps/web/package.json`, and `apps/web/test/package.test.ts:91` asserts
`Object.keys(JUSTIFICATIONS)` equals the declared set exactly — so that register moves.

Two clauses forbid it: **§5 non-goal 9**, *"any new dependency"*, and **§8**, *"no new dependency, so
`apps/web/test/package.test.ts`'s declared-dependency pin does not move."*

The finding's actual subject — that the register must fail against a fourth writer whatever its form
— is fully reachable without it, and §2 is how. Nothing is left undone.

## 5. Findings in my own work this round

**(a) My first design would have fixed the instance.** I began by widening the head regex to
recognise arrows beside declarations, which closes exactly the case the reviewer named and leaves the
function-expression form and the concise-body form as two more holes. It was the *census* that
redirected it — counting the forms in `daemon-client.ts` and finding the arrow in the majority — and
the region model came from asking what makes the walk exhaustive rather than wider. Recorded because
the first answer was the one the finding literally asked for, and it was not good enough.

**(b) The attribution clause needed the type declaration to be registered, and I found that by
running it rather than by reading.** My first version of `typesNamingWrite` asserted that *no*
declaration outside the three names the method — which is false on the shipped file, because
`DaemonRequest` declares `readonly method: 'POST'` and must. Filtering type declarations out silently
would have been the predicate-nobody-re-reads shape; registering the one by name is what keeps the
clause honest, and mutation D is what holds it.

**(c) I tightened the fixtures after they were already green.** The first draft appended three
separate one-line variants to the declaration fixture and added a single-function rename that was
trivially true. It is now one fixture carrying all three value-binding shapes, with the
fourth-writer and name-swap clauses run over it — the same structure as the declaration half, so the
two read as a pair rather than as a pile. Re-run and re-mutated after the change (A′ above).

## 6. File by file

- **`apps/web/test/source.test.ts`** — `WRITE_METHOD` extracted as one constant so the needle is
  spelled once rather than twice; `Declaration`, `DECLARATION_HEAD`, `BINDS_A_VALUE` and
  `declarations()` added; `writingFunctions` rewritten as a filter over them and its docblock
  rewritten to say what the unit is and why; `typesNamingWrite` added; the AC-11 test gains the
  attribution clause against the real module, the three-shape fixture with its fourth-writer and
  name-swap clauses, an arrow-form reader that must not be collected, and the unattributed-write
  clause. 105 insertions, 23 deletions.

Nothing else in the working tree is modified — `git status` reports one file.

## 7. What I deliberately left alone

Every criterion of `requirements/merged.md` as rounds 1 and 2 implemented it. `WRITE_RULES` itself and
all three of its anti-vacuity clauses, which no finding named and which stay green: `'/stop'`'s
permission, `writeOffenders(false)`'s three rows, and the permitted **module** set of exactly two.
Both documents. `packages/shared`, `packages/server`, and every file under `apps/web/src` — including
`daemon-client.ts`, whose mutation in §3 was reverted and which `git status` confirms is at its
committed state. Every non-goal in §5. `docs/decisions/` is untouched: GO-1 ruled no entry owed and
nothing this round reopens that.

**GO-4's demonstration is still the gate's.** An implement step runs in a worktree with no daemon and
no browser, and `runs.log` is the harness's to write. Erratum E-4 phrases it as a transcript
precisely because Q-0016's GO-6 was reported discharged when its by-hand half was never performed;
this step does not report it discharged.
