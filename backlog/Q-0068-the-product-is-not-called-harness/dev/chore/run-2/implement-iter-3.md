# Q-0068 — implement report, run 2, iteration 3

*Written 2026-09-10. A revision round on one review finding. The finding was reproduced by mutation
before anything was edited, and the fix is demonstrated red two ways below rather than asserted. The
product diff from iterations 1 and 2 is untouched: this round changes one test and one register
comment, and no production file is in its diff.*

---

## 1. The finding

> **major: packages/shared/src/docs.test.ts:889** AC-14 requires the documented nullable token shape
> to be pinned against `ProbeResult`, but this test only matches three phrases within
> `docs/03-adapter-contract.md`. It therefore stays green if `ProbeResult.tokens` is changed back to
> `number` while the documentation remains unchanged. Read
> `packages/core/src/adapters/adapters.ts` — already a declared test input — and assert the
> documented `cost_usd`/`tokens` nullability against the actual `ProbeResult` declaration rather than
> only checking self-consistency within the prose.

**It is correct, and it was reproduced before it was believed.** Mutation: `ProbeResult`'s
`tokens: number | null` narrowed to `tokens: number`, nothing else touched.

```
 Test Files  1 passed (1)
      Tests  4 passed | 43 skipped (47)
```

Four passed. The document goes on promising a `null` the type refuses, and the check written to hold
the document to the shipped contract says nothing, because its three clauses only compare
`docs/03-adapter-contract.md` with itself.

**AC-14's *Test:* clause names the instrument and I did not build it.** It reads: *"that file is
already an input to `@quorum/shared#test`, so the read costs no new registration; the assertion pins
the documented shape against `ProbeResult` rather than against a retyped literal."* Two halves — do
not retype the shape, **and** pin it against `ProbeResult`. Iteration 1 satisfied the first and read
the second as satisfied by the first. It is not: not retyping a shape and holding a document to a
declaration are different acts, and only the second can fail when the declaration moves. This is the
same shape as round 2's two findings — a check whose stated subject is not the subject it examines —
arriving at the one criterion of the fourteen whose subject is a *type* rather than a string.

## 2. What shipped

**`packages/shared/src/docs.test.ts`** — one helper and one clause pair inside the existing AC-14
test. No test name, fixture or existing assertion moved.

`probeResultField(field)` reads `packages/core/src/adapters/adapters.ts` as **text** — the dependency
direction is `core → shared` and never the reverse, which is the read `refusalIn` three lines above
already makes and which `events.test.ts` and `project.test.ts` have made of this exact file since
Q-0058 — and returns the declared type of one field.

It is **scoped to the `ok: true` branch**, sliced from `export type ProbeResult =` to the union's
`ok: false;`, because that is the answer this section of the document describes and the other branch
carries neither field. A search over the whole declaration would have reported an absence as a drift.
Both anchors are checked, so a declaration that has been renamed or has lost a branch throws *"this
check has lost its subject"* rather than being answered by whatever the regex found next.

The test then asserts both measures, because the paragraph it holds states one rule for the pair:

```ts
for (const field of ['cost_usd', 'tokens']) {
  expect(probeResultField(field), `the contract says a silent probe reports \`${field}: null\`, which ProbeResult does not permit`)
    .toBe('number | null');
}
```

`cost_usd` is included rather than only the field the reviewer named. The document's sentence — *"`null`
means the vendor did not report that measure, and it is never rounded to zero"* — is one claim about
two fields, and pinning half of it would leave the other half in exactly the state this finding
describes.

**`packages/core/src/turbo-inputs.test.ts`** — one line. `MANIFEST`'s reason for
`packages/core/src/adapters/adapters.ts` under `@quorum/shared#test` named two call sites and now
names three. That register is *"named out-of-package file reads, per task, with the call site that
performs each"*, hand-audited, and `docs.test.ts` is now a third such site; leaving it at two would
make the register wrong about who reads the file. This is the same act iteration 1 performed on the
`claude.ts` and `codex.ts` rows when they gained their second reader.

## 3. What the guard required, measured rather than assumed

**No `turbo.json` change and no `COLLECTED_BASELINE` row is owed, and both were checked rather than
reasoned about.** `packages/core/src/turbo-inputs.test.ts` run against the new read: **63 passed**.

- Clauses A and B pass because `../core/src/adapters/adapters.ts` has been a declared input of
  `@quorum/shared#test` since Q-0058. Unlike AC-6's `docs/USAGE.md`, which was genuinely new and
  earned its declaration in iteration 1, this literal was already there.
- `COLLECTED_BASELINE` refuses nothing, by its own design: *"Membership is checked in one direction
  only … an occurrence this list does not hold is an **addition**, which clause B above already
  judges on its merits and which no criterion forbids."* Adding a row would move a pinned count
  (70 → 71) and owe the register a header paragraph, for an addition that register explicitly
  permits. Stated rather than done, so a reviewer sees the reasoning instead of the silence.

**The literal is spelled plainly.** `refusalIn` builds its path from a template literal because it is
genuinely parameterised over two vendors; there is one contract layer, so
`'packages/core/src/adapters/adapters.ts'` is written out and is collected by the scanner. Hiding a
read from the classifier to avoid a registration would be the fail-open move this ticket's AC-5
exists to close.

**The hash was measured, not assumed** (R-5, which named this risk for exactly the read AC-6 added):

| | `@quorum/shared#test` |
| --- | --- |
| unchanged | `cache hit, replaying logs 556fa6606709aa04` |
| one line appended to `packages/core/src/adapters/adapters.ts` | `cache miss, executing 2cc3d5d216e8ea17` |
| probe line removed | `cache hit, replaying logs 556fa6606709aa04` |

The hash returns to the identical value, so the probe left nothing behind and the read is genuinely
covered by the declaration rather than by a stale cache entry.

## 4. Demonstrated red before green

Two mutations, each run against the whole tree and reverted. Signatures quoted, not summarised.

| # | Mutation | What went red |
| --- | --- | --- |
| H | `ProbeResult.tokens` narrowed to `number` | `docs.test.ts` — *"the contract says a silent probe reports `tokens: null`, which ProbeResult does not permit: expected 'number' to be 'number \| null'"* |
| I | `export type ProbeResult` renamed to `ProbeOutcome` | `docs.test.ts` — *"packages/core/src/adapters/adapters.ts declares no two-branch ProbeResult — this check has lost its subject"* |

**H is the reviewer's finding, reproduced and then closed**: the same mutation that passed 4/4 before
this round now fails, naming the field, the claim the document makes and both types. **I is the
check on the check** — a declaration that moved must fail loudly rather than being answered by
whatever the field regex matches next, which is the anti-vacuity property `refusalIn` already has and
which a helper reading source is worthless without.

Both mutations were fully reverted, verified by `git status`: `packages/core/src/adapters/adapters.ts`
is absent from this round's diff.

## 5. The class, not only the instance

Round 2's own lesson, and three findings inside Q-0112, is that repairing the named instance and
leaving the class is the failure recorded here most often. The class here is *a criterion asking for
a check against the code, satisfied by a check against prose alone*. I swept every criterion of this
ticket for the rest of it before writing this.

- **The Q-0068 describe block in `docs.test.ts` has four tests.** Two read adapter source and hold a
  document to it (AC-6, and the shared-tail test). The third is AC-14 and is fixed here. The fourth
  is the status-line assertion, whose subject *is* a document — there is no code side to hold it to,
  which is different from having one and not using it.
- **The one doc-only clause that remains is correct as a doc-only clause**: the shared-tail test
  asserts `docs/03-adapter-contract.md` still contains *"subscription login"*. That is a claim about
  which document owns the term the sentence borrows — a fact about the document — and holding it to
  code would be asserting something the code does not say.
- **AC-8's JSDoc half is not a gap and was deliberately not widened.** AC-8 requires `ProbeResult`'s
  JSDoc to state both halves, which iteration 1 did and which I re-read to confirm. Its *Test:*
  clause names two behavioural clauses, both pinned in `probe.test.ts`. Adding a JSDoc scan would be
  raising the job that clause gives the instrument, which Q-0067's erratum E-1 rules a reviewer may
  not do — and which an implementer should not do to itself either.
- **Every other criterion's instrument was re-checked against its subject**: AC-1's two `REFUSAL`
  constants assert the thrown message, AC-4's row reads the shipped text at run time, AC-5's three
  clauses were mutation-tested in iteration 1 (A, B, D, E), AC-10 spawns the built binary, AC-13 is a
  grep. None of them is prose held against prose.

So the finding is the whole of the class in this diff, checked rather than assumed.

## 6. File by file

**`packages/shared/src/docs.test.ts`** — one helper added (`probeResultField`, with the JSDoc stating
what it reads, why it reads it as text and why it is scoped to one branch) and one clause pair added
to the existing AC-14 test with a comment saying what the three clauses above it cannot do. No
assertion, fixture or test name moved.

**`packages/core/src/turbo-inputs.test.ts`** — one `MANIFEST` reason extended from two call sites to
three. No row added, no count moved, no clause changed.

**Nothing else.** No production file is in this round's diff.

## 7. Verification

Run from the worktree root after `pnpm install --frozen-lockfile` (*"Already up to date"*, 189 ms),
which is `commands.install` verbatim.

- **`pnpm turbo run test lint typecheck --force --continue`** — **21/21 tasks, 0 cached**, all
  successful.
- **`pnpm turbo run test --force --continue`** — **7/7 tasks, 0 cached**. Per package: shared **171**,
  core **1447 passed | 2 skipped**, cli **626**, plus one each from the four stub packages. The two
  skips are Q-0105's pre-existing `GIT_TEST_ASSUME_DIFFERENT_OWNER` pair. Identical to iteration 2's
  counts, which is expected: this round adds clauses to an existing test rather than a test.
- **`pnpm exec quorum lint`** — **6/6** flows through the built binary: chore, development, qa-red,
  requirements, review, solutioning.
- **`pnpm sweep:git-identity`** — exit 0, *"the workspace suite executed and green with no resolvable
  git identity"*. This is GO-4's both-rows run.

**One lint warning, pre-existing and untouched:** `packages/core/src/backlog/backlog.ts:330`, an
unused `no-control-regex` disable directive — the only warning in the workspace, in a file in none of
the three rounds' diffs, under a rule that is not type-aware, so its verdict is a property of `main`.
Reported for the third time and still not repaired: it is not this ticket's surface.

**GO-4's remaining half is the human's:** verification on `main` in both environment rows after the
merge, and CI green on the merged commit. Q-0105's GO-3 is the precedent for not reading a local
green as covering CI.

## 8. Deliberately left alone

- **A `COLLECTED_BASELINE` row for the new read** (§3). The register permits an addition in as many
  words, the literal is already a declared input, and adding a row would move a pinned count for
  nothing. Reasoning stated rather than the row added quietly.
- **`docs/03-adapter-contract.md`.** Untouched. The finding is that the check was too weak, not that
  the document is wrong — and the strengthened check confirms the document and the type agree today.
- **`packages/core/src/adapters/adapters.ts`.** Both mutations reverted; absent from this diff.
- **Iteration 1's two declared scope notes** — the `readSlash`/`readRegex` scanner change that makes
  AC-5 reachable, and the `build.test.ts` fixture hoist. Unchanged and unreopened. If a reviewer
  still judges the scanner change to belong in its own ticket, the trade is the one iteration 1
  stated: AC-5 cannot then ship. That is a gate ruling rather than something this round can settle.
- **Iteration 2's two corrected comments.** Unchanged; neither is in this round's diff.
- **Everything under iteration 1's own §4** — `withRetry`'s `usage: null`, the human renderer's
  truthiness clause, `authError` and `transientError`, the refusal's ordering and coverage,
  `quorum adapters` exiting 0 with both CLIs absent, the non-string-final-message crash, widening
  `binary-name.test.ts` to all of `core`, and the prose audit. None was reopened.
- **`backlog/`, `harness/`, `docs/decisions/`, `.claude/rules/`.** Untouched, per §3 and §6.10.

## 9. Gate obligations

- **GO-1 — no decision entry is owed**, and none was written. Unchanged from iteration 1: nothing can
  depend on today's behaviour because today's behaviour is a `TypeError`. This round strengthens the
  check on the doc-versus-code conflict `.claude/rules/docs-and-decisions.md` answers with *"fix the
  docs in the same PR"* — which is the rule this round makes enforceable rather than intended.
- **GO-2 — the bytes are unchanged** from the ticket body's ruling. No production string moved.
- **GO-3 — no new glossary term.** `docs/GLOSSARY.md` is untouched in all three rounds.
- **GO-4 — the local half is done and reported in §7.** The `main` re-run and CI are the human's.

## 10. Scope

Nothing in this round goes beyond the finding. Two lines of judgement are worth naming so a reviewer
can rule on them rather than discover them:

**`cost_usd` is pinned as well as `tokens`**, where the finding names only `tokens`. The document's
sentence is one rule for the pair, and pinning half of it would leave the other half in the state the
finding describes — a check that names its subject and examines less than it names.

**The `MANIFEST` reason was extended**, which no criterion names. It is a hand-audited register of
*which call site performs each declared read*, and this change adds a third call site; the same edit
was made for two sibling rows in iteration 1. If a reviewer judges that out of scope the honest
consequence is a register that under-reports its readers, which is the class this ticket is about.
