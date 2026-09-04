# Q-0095 §3.1 — implement, chore run 2, iteration 3

**This is a revision round.** Both majors in `review/chore/run-2/chore-iter-2.md` are real, both are
accepted, and both are fixed. Nothing else is changed: the diff is 144 insertions and 37 deletions
in **one file**, `packages/cli/src/end-to-end.test.ts`.

Neither finding is refused and no erratum is owed. The reviewer was right on both counts, and the
second one had a consequence neither of us had named — recorded under *"What the strict form turned
out to be worth"* below.

---

## Finding 1 — the reading called "end to end" was taken four invocations early

> `end-to-end.test.ts:346` — the snapshot called the end-to-end working-tree result is taken before
> `board`, `adapters`, and both `validate` invocations. […] Take another snapshot after those
> read-only commands, arranging the test-owned validation fixtures so they do not obscure the
> product-write check.

**Accepted in full, including the diagnosis of why it was taken early.** The previous round's comment
argued the position out loud — *"a reading after them would have to excuse three paths by name, which
is how a working-tree check stops having a subject"* — and that reasoning was sound about the
excuse-list and wrong about the conclusion. The right move was not to take the reading earlier; it was
to stop putting the test's own files in the repository being judged.

### What changed

**The three `validate` fixtures moved out of the fixture repository.** `contract.schema.json`,
`conforming.json` and `violating.json` are now written into a second temporary directory created
beside the repo, and `validate` is pointed at them by absolute path. This is sound rather than a
dodge: `validate.ts`'s own header records that it opens no project (Q-0091 erratum E-5), so it reads
an absolute path from the fixture's cwd exactly as it reads a relative one, and AC-7's claim — exits
0 on a conforming artifact, 1 on one that violates its schema, so a `qa-red` script step can fail on
it — is untouched. The invocations still run with `cwd` set to the fixture, so they still ride the
chain at the point in the sequence the criterion places them.

**A third reading was added, after the final invocation of all.** `Chain.porcelain` is now
`afterSolutioning`, `atGreen` and `afterLastCommand`, and AC-6's test asserts over all three.

**All three are kept rather than only the last**, and the JSDoc says why: a single final reading
cannot see pollution one step introduces and a later one clears. The solutioning-time reading is
where the spike takes its (`smoke.js:79`); the green one is where the last flow finishes; the last
one is what puts `board`, `adapters` and the two `validate` calls inside the claim.

### Demonstrated, not asserted

Two mutations, each run and each reverted:

| mutation | result |
| --- | --- |
| `fs.writeFileSync(path.join(repo, 'MUTATION.txt'), …)` inserted after `invoke('board', …)` | **red**, and the message names `after the last command` — *only* that reading. The two earlier readings passed, which is the proof that the third examines a window they cannot see |
| the `validate` fixtures written back into `repo` instead of the artifacts directory | **red**, `['conforming.json', 'contract.schema.json', 'violating.json']` reported outside the roots — which is the excuse-list the relocation removes the need for |

The second mutation is the one worth keeping in mind: it shows the relocation is load-bearing rather
than cosmetic. Without it the third reading could only have been bought with three names in an
allow-list.

---

## Finding 2 — the allow-list was a substring test

> `end-to-end.test.ts:553` — the allow-list uses substring checks, so paths such as
> `?? mybacklog.txt` or `?? src/harness/output` are incorrectly treated as permitted […] Parse the
> porcelain path and allow only entries whose repository-relative path is exactly one of those roots
> or is contained beneath it; add a discriminating assertion for misleading substrings.

**Accepted in full.** The clause was `!line.includes('backlog') && !line.includes('harness/')`,
inherited from `smoke.js:79`, and both of the reviewer's examples defeat it.

### What changed

**The reading is now `git status --porcelain -z`**, at all three sites. This is the part that makes
the parse safe rather than merely careful: the newline form *quotes* a path git considers unusual and
escapes it C-style, so a reader either unescapes it correctly or misreads it silently. The
NUL-separated form prints pathnames as-is. Choosing `-z` deletes a whole class of parsing bug instead
of writing an unescaper for it.

**Three small module-scope functions** carry the classification:

- `PRODUCT_ROOTS` — `['backlog', 'harness']`, the two AC-6 permits.
- `porcelainPaths(porcelain)` — every repository-relative path one reading is about. Splits on NUL,
  takes `slice(3)` past the `XY ` status field, and consumes a second field after an `R` or a `C`,
  because a rename or a copy spends two.
- `insideProductRoot(relative)` — `path.posix.relative(root, path.posix.normalize(relative))`, inside
  when that is `''` or does not escape upward. An untracked directory arrives with a trailing
  separator and resolves to the root itself.
- `outsideProductRoots(porcelain)` — the two composed, which is what the test asserts is empty.

**A new test pins the discrimination**, as the finding asks. Three clauses:

- four misleading rows — `mybacklog.txt`, `src/harness/output`, `backlogs/other`, `harnessed.md` —
  asserted as an **identity** rather than a count, so a filter that reported *everything* dirty would
  fail here rather than pass a test about misclassification;
- four permitted rows covering both shapes a root arrives in — `?? backlog/` with its trailing
  separator, ` M harness/harness.yaml` below one, `A  backlog/T-0001/ticket.md`, and bare `?? harness`;
- a rename entry, where both sides are classified.

### Demonstrated, not asserted

Restoring the substring form (`relative.includes('backlog') || relative.includes('harness/')`) turns
the new test **red**, reporting that three of the four misleading rows were silently permitted:

```
expected [ 'harnessed.md' ] to strictly equal [ 'mybacklog.txt', …(3) ]
-   "mybacklog.txt",
-   "src/harness/output",
-   "backlogs/other",
    "harnessed.md",
```

Both of the reviewer's own examples are in that list. Reverted after the run.

---

## What the strict form turned out to be worth — a finding neither of us had named

Tightening the classification raised a question worth answering rather than assuming: the fixture's
repository root holds `.git`, `.harness`, `.quorum`, `backlog` and `harness`, so why does a strict
matcher not flag `.harness` and `.quorum`, neither of which is under `backlog/` or `harness/`?

Measured rather than reasoned about — by failing the assertion on purpose and reading the diff — the
three readings are each **exactly `['backlog/', 'harness/']`**. `.harness` and `.quorum` are absent
because the **product excludes them**: `packages/core/src/git/git.ts:69` appends `.harness/` and
`packages/core/src/run-history/writer.ts:397` appends `.quorum/` to the repository's own
`info/exclude`, deliberately, so a run's own directories never appear in the user's `git status`. The
fixture scaffolds no `.gitignore` — `quorum init` writes none — so `info/exclude` is the whole of it.

**That means the substring form was permitting `.harness/` by accident**, since the string contains
`harness/`: if `ensureExcluded` regressed, the old check would have gone on reporting a clean working
tree. The strict form cannot, so this test now covers the product's exclusion behaviour as a side
effect of being correct. Recorded in a comment at the assertion, because a future reader will ask the
same question I did.

No criterion is added for it and nothing in `core` is touched — this is a note about what the fixed
check now sees, not new scope.

---

## File by file

**`packages/cli/src/end-to-end.test.ts`** — the only file changed.

| region | change |
| --- | --- |
| after `plain` | new: `PRODUCT_ROOTS`, `porcelainPaths`, `insideProductRoot`, `outsideProductRoots`, with JSDoc carrying why `-z`, why segment-wise, and what the substring form got wrong |
| `Chain` | new `artifacts` field with its reasoning; `porcelain` gains `afterLastCommand` and its JSDoc rewritten from two readings to three |
| `repositories` → `temporaries` | renamed, because it now holds the fixture repository *and* the artifacts directory; both are removed in the same `afterAll` |
| `beforeAll` | second `mkdtempSync` for the artifacts; all three `git status` calls gain `-z`; the early-reading justification comment replaced with what the second and third readings are for; the three `validate` fixtures written via `artifact()` and passed absolute; `finalPorcelain` taken after the last invocation |
| AC-2 | `['validate artifacts', chain.artifacts]` added to the outside-this-package loop, so the new directory is inside the same claim as the artifact, the copy and the fixture |
| AC-6 | the working-tree test now iterates three named readings and uses `outsideProductRoots`; non-emptiness asserted on parsed path count rather than `trim() !== ''`; new test for segment-wise classification |

## What I deliberately left alone

- **`spike/src/**` and `spike/test/**`** — untouched, ground rules 1 and 2. `smoke.js` keeps its 780
  lines and 158 assertion sites.
- **`packages/core/src/spike-parity.test.ts`** — not touched *this round*. AC-10's register work
  landed in the earlier rounds and is intact: `smoke.js` carries
  `binaryCarriedBy: ['packages/cli/src/end-to-end.test.ts']`, `:1624` and `:1703` are re-aimed at
  Q-0101, `:1767` asserts the smoke row no longer says Q-0095 owes what Q-0095 carried, and the
  five-total re-derivation test is present. This round edits no spike file, so the totals are
  unmoved for the same reason as before.
- **The preserved defects** — Q-0068's *"Harness runs on subscription OAuth only"* is still asserted
  verbatim in AC-7, Q-0100's `harness`-spelled usage lines are untouched, and the `owner` default at
  `backlog.ts:190` is still worked around with an explicit `--owner` rather than fixed.
- **`packages/cli/turbo.json`** — unchanged. The new artifacts directory is under `os.tmpdir()`,
  which is not a repository input, and nothing new is read from the workspace (R-7).
- **The three AC-11 timing figures in the header** — re-measured and still accurate; see below.
- **`board`, `adapters` and `validate` themselves** — the finding is about what the test observes,
  not about those commands, and none of them needed a change.

## Verification

Everything forced, nothing replayed.

| command | result |
| --- | --- |
| `pnpm turbo run test --force` | **7/7 tasks, 0 cached**; `@quorum/cli` 22 files, **505 tests passed** |
| `pnpm turbo run lint typecheck --force` | **14/14 tasks, 0 cached** |
| `npm test --prefix spike` | **19/19 test files passed**, unreduced |
| `pnpm sweep:git-identity` | green — *"both suites executed and green with no resolvable git identity"*, with the new suite collected |
| `vitest run src/end-to-end.test.ts` | **33 passed** (was 32; the discrimination test is the new one) |

**AC-11, re-measured.** The file's own duration across seven runs this round: 4.76, 4.77, 4.78, 4.82,
4.83, 4.85, 4.97 s — call it **~4.8 s**, unchanged by this round's edits. The `-z` flag and the third
`git status` are microseconds against two seconds of `tsc` and two of spawned flow runs. The header's
recorded figures (0.1 s copy, 2.1 s build, 2.2 s for the invocations; 4.8–5.9 s as Vitest measures
the file) still hold and were not adjusted. `SPAWN_TIMEOUT_MS` 60 s and `FIXTURE_TIMEOUT_MS` 90 s are
unchanged and still carry their measured justification.

## One limitation, stated rather than hidden

**I could not execute an ad-hoc probe of git's `-z` rename output in this environment** — the sandbox
refused every form of running a throwaway script — so the rename branch of `porcelainPaths` is
exercised against a **composed** entry in the discrimination test rather than against git's own
output. The JSDoc says so in those words rather than claiming a verification I did not perform.

This is safe rather than merely admitted, for a structural reason: the parser returns **both** fields
of a rename and the caller requires **both** to be inside a product root, so the verdict does not
depend on which of the pair git prints first — the two output forms disagree about that, and nothing
here has to know which. The fixture stages nothing, so a rename cannot arise in it at all; the clause
is defensive, and it is there because a parser that drops half an entry is the shape of defect this
criterion exists to catch.

The earlier round's JSDoc draft asserted the documented field order as fact. That sentence was
removed rather than softened, because *a measurement copied from a document is not a measurement* —
and I had no way to run the measurement.

## Nothing is blocked

No criterion of §3.1 is contradicted by either finding, no ruling is needed, and no surface outside
`packages/cli` was required. Both majors were work the implement step could act on, which is the
difference between this loop and the ones Q-0091's E-7 priced.
