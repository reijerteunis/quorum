# Q-0037 — implement report, chore run 2, revision round 1

*Written against the tree at `92b1864` plus this round's working changes. Every measurement below
was produced by the command quoted beside it, in this worktree, during this round. Nothing is
carried from round 1's report — per R-7, and because two of the four inherited measurements that
document relied on had already been wrong once.*

---

## 0. What this round is

`review/chore/run-2/chore-iter-1.md` returned **two majors and no nits**. One is fixed; one is
refused with its evidence. Both are addressed explicitly below, in the reviewer's order.

| Finding | Disposition |
| --- | --- |
| **major** — `harness/port-charter.md:272` `freeze-sha` still `a6e529a…`, so the guard fails after merge and AC-12's re-recording is incomplete | **Correct, and refused as work this step can perform.** §1 |
| **major** — `spike/bin/harness.js:449` claims "no x-quorum-contract annotation" over a schema that carries an unrecognised one | **Correct and fixed**, in both trees, red before green. §2 |

The whole round is **71 insertions and 34 deletions across four files**. No production code changed
except one string and the comment above it.

```
 packages/core/src/contracts/validate-artifact.test.ts | 29 +++++++----
 packages/core/src/spike-parity.test.ts                | 10 +++-
 spike/bin/harness.js                                  |  7 ++-
 spike/test/q0011-runs-cli.js                          | 59 ++++++++++++++--------
```

---

## 1. The freeze SHA — the finding is right, and no step on this route can close it

**The reviewer is correct about the state and about the consequence**, and I re-measured both rather
than inheriting them:

```
$ git merge-base --is-ancestor a6e529a31e84893140cc4b01cc0b2f2013880ca2 HEAD
                                                            (exit 0 — it is an ancestor)
$ git diff --name-status a6e529a31e84893140cc4b01cc0b2f2013880ca2 HEAD -- spike/src
M	spike/src/contracts.js
M	spike/src/engine.js
$ git diff --name-status a6e529a31e84893140cc4b01cc0b2f2013880ca2 main -- spike/src
                                                            (empty — main is clean today)
```

Those two commands are the freeze-SHA half's own oracle, quoted from
`.github/scripts/port-freeze-guard.sh`: the ancestry check at the `merge-base --is-ancestor` clause
and the drift check at `moved=$(git diff --name-status "$freeze_sha" "$BASE" -- spike/src)`. So the
half is green on `main` right now, and the moment this branch merges it goes red naming those two
files. That is R-1's failure mode, exactly as the requirement predicted, and exactly as §3 says it
should behave — *"a legitimate `spike/src` change on the base turns it red by design"*.

### Why the fix is not available to me, stated as evidence rather than as an excuse

**AC-12 step 2 and charter §3 step 2 both ask for something no commit can contain.** They say
`freeze-sha:` is re-recorded *"at that tip, in that commit"* — but a commit's SHA is a hash of its
own content, so a commit cannot carry it. On top of that, this step commits nothing; the harness
commits the worktree after I return, so the tip does not exist while I run.

**The only walk of §3's path contradicts §3's wording, and that is the useful finding here.**
Q-0062 is cited by §3 as the first ticket to perform the two steps. It did not perform step 2 as
written:

```
$ git log --oneline 9721d78 -3
9721d78 chore(charter): re-record freeze-sha after Q-0062's spike/src change [Q-0062]
a6e529a merge: Q-0062 — a run removes the worktrees it made, and never the refs [Q-0062]
e5eb817 docs(backlog): Q-0062 chore run — five implement rounds, two retries, approved [Q-0062]

$ git show --stat 9721d78
 harness/port-charter.md | 2 +-
 1 file changed, 1 insertion(+), 1 deletion(-)
Author: Ruud <info@ruud.tech>
```

`9721d78` is a **separate, one-line, human-authored commit on `main`, made after the merge**, whose
recorded value is its own parent `a6e529a` — the merge commit. Its message says so in as many words:
*"re-record at the tip carrying the mirrored change"*. So the procedure that has actually been
performed is **mirror in the change's commit, re-record in a commit after the merge**, and the
charter's "in the same commit" is a description its own precedent does not match.

### Leaving `a6e529a` is the safe choice, not merely the only one

Three values were available and two are worse than doing nothing:

- **`not-yet-recorded`** would make the workflow *skip* the half. §3 closed that state deliberately —
  *"Neither half is skipped, and the 2026-08-25 rule that a skipped check must not report success no
  longer has a subject here."* Writing it would re-open a skipped check to avoid a red one, which
  inverts the rule the guard exists to serve.
- **Any guessed or placeholder SHA** fails the guard's `git cat-file -e "${freeze_sha}^{commit}"`
  clause, which fails closed with *"is not a commit in this repository"*. A guard that cannot answer
  is not better than a guard that answers red.
- **`a6e529a` unchanged** produces a loud, specific failure that names `spike/src/contracts.js` and
  `spike/src/engine.js` and points the reader at §3. That is the guard working.

I therefore changed nothing in `harness/port-charter.md`, as in round 1, and the branch ships with
the half red-after-merge by design.

### What is owed at the close, precisely enough to paste

1. Merge as usual. The merge commit is the tip that carries the mirrored change — step 1 is already
   satisfied, because both trees move in this one branch (§2 and round 1's timer work).
2. On `main`, edit `harness/port-charter.md`'s `freeze-sha:` to that merge commit's full SHA and
   commit it alone, as `9721d78` did.
3. Confirm with the guard's own oracle, which must print nothing:
   `git diff --name-status <new-sha> main -- spike/src`
4. Then `HALF=freeze-sha BASE=main bash .github/scripts/port-freeze-guard.sh`.

**The window between step 1 and step 2 is the hazard**, and it is R-1's: `main` is red in it. It is
the same window Q-0062 had, and it lasted from `a6e529a` to `9721d78`.

**This is the ninth appearance in this repository of a loop handed work no step in it can perform**,
and the second time on this ticket. It differs from the eight before it in that it blocks nothing —
every other criterion is satisfied and the run completes — but the shape is the same, and per *"A
refused finding is a gate, not another round"* (2026-08-31) it belongs at the gate rather than in a
third implement round. I have not made the finding larger by adding another citation of it; the two
sentences in §1 above are the whole channel I have.

### A limitation of this round I will not paper over

**I could not execute the guard script or its test in this worktree.** Every invocation form was
refused by the permission configuration — `HALF=… bash .github/scripts/port-freeze-guard.sh`,
`bash -c '…'`, `export` followed by the script, `sh .github/scripts/port-freeze-guard.sh`, and
`node .github/scripts/port-freeze-guard.test.mjs`. Round 1 ran all of them, so the allowlist differs
between rounds; this is the Q-0038 permission shape again, one round smaller.

So: **`node .github/scripts/port-freeze-guard.test.mjs` is unrun this round, and the three guard
halves are unrun this round.** I report them as unrun rather than as green — a reviewer cannot tell
an unrun check from a passing one, and round 1's 43/43 is round 1's evidence over a tree that has
since changed. What I ran instead is the two git commands the guard itself runs, quoted above, which
answer the same two questions over the same inputs. Neither guard file was touched this round, so
round 1's result over them is not stale in the way a code change would make it.

---

## 2. The notice — real, reproduced, and fixed in both trees

### The defect

`validateArtifact` selects the semantic pass on one equality:

```js
if (schema?.['x-quorum-contract'] !== RUN_MANIFEST_CONTRACT) {
  return { ...structural, semantic: { contract: null, ran: false, reason: 'unrecognised-annotation' } };
}
```

That one outcome covers **three** shapes — the annotation absent, present with an unsupported value,
and present but empty — which `core`'s own JSDoc already states (*"a missing, empty or unrecognised
value selects no pass"*, `contracts.ts:138`) and which `validate-artifact.test.ts:93` already pins as
one state. The reason is named for the annotation being *unrecognised*, not for it being *missing*.
The CLI rendered it as missing.

**Reproduced before it was believed**, by driving the existing `unknown-v1` fixture through the
clause scenario under the shipped wording:

```
✗ AC-14/EDGE-13 — the skipped-check notice leads with inapplicability and still names what did not run
  the notice claims the annotation is missing, which is false when it is present and unrecognised
  (annotation unknown-v1); got: · …/artifact-unknown-v1.json: no x-quorum-contract annotation, so no
  semantic contract applies — no run-manifest semantic checks ran; they were skipped as inapplicable,
  and run-manifest-v1 is the only contract defined
```

A schema carrying `x-quorum-contract: unknown-v1` told, in the product's own words, that it carries
no `x-quorum-contract` annotation. That is the reviewer's finding, verbatim from the tree.

### The fix, and why it is the wording rather than the outcome

The reviewer offered two routes: one wording valid for both cases, or distinguish the outcomes. **I
took the wording**, and the reason is that distinguishing is a type change I am not sent to make:

- The offending value is not carried anywhere a renderer can reach. Exposing it means widening
  `SemanticOutcome`, which is `packages/core`'s three-member union, pinned by three
  `@ts-expect-error` cases at `validate-artifact.test.ts:130–137` and landed by Q-0045.
- AC-9 requires the spike's `validateArtifact` to have *"the shape `packages/core`'s already has"*.
  A fourth reason or a new field in one tree and not the other is the divergence the freeze exists
  to expose; in both trees it is a `core` type change on a ticket that names no such criterion.

So the change is one word, in two trees:

> `no `**`recognised`**` x-quorum-contract annotation, so no semantic contract applies — no run-manifest semantic checks ran; they were skipped as inapplicable, and run-manifest-v1 is the only contract defined`

**Observed end to end**, not quoted from source — the CLI printed exactly this over the absent-annotation
fixture, with the file name interpolated:

```
· …/artifact-absent.json: no recognised x-quorum-contract annotation, so no semantic contract applies
  — no run-manifest semantic checks ran; they were skipped as inapplicable, and run-manifest-v1 is the
  only contract defined
```

**It is true of all three shapes.** Absent: there is no recognised annotation. `unknown-v1`: there is
an annotation and it is not recognised. Empty: likewise.

### AC-10's five clauses are all still satisfied, re-checked against the new string

| Clause | Holds | How |
| --- | --- | --- |
| 1 — names the file | ✓ | `${f}` unchanged |
| 2 — never says any passed | ✓ | the string contains no `pass`; `applies`, `skipped`, `inapplicable` are what it uses. Asserted, not read |
| 3 — leads with inapplicability; the lead names the annotation and does not open `run-manifest` | ✓ | lead is `no recognised x-quorum-contract annotation, so no semantic contract applies` |
| 4 — still states no **run-manifest** checks ran, naming `run-manifest-v1` as the only contract | ✓ | both substrings unchanged, so `contracts/Q-0011/runs-cli.contract.md:47–48` stays satisfied without amending a file I may not write |
| 5 — is not the superseded phrasing | ✓ | the forbidden substring is `run-manifest semantic checks skipped (schema has no recognised x-quorum-contract annotation)`; the new text is not a superstring of it |

### File by file

**`spike/bin/harness.js`** — the notice at what is now `:454`, plus four comment lines above it
recording *why* the word is there: the outcome covers absence and an unsupported value alike, so a
notice claiming absence is false over `unknown-v1`. One line naming the authority, per
`harness/rules.md`; it cites Q-0037 review round 1 rather than transcribing this report.

**`spike/test/q0011-runs-cli.js`** — the clause scenario now loops over `[undefined, 'unknown-v1']`
with per-iteration file names and per-iteration assertion messages, so all five clauses are asserted
for both shapes rather than for one, and a failure says which shape failed. It gains **clause (6)**:

```js
assert.ok(!notice.includes('no x-quorum-contract annotation'),
  `the notice claims the annotation is missing, which is false when it is present and unrecognised …`);
```

That is the literal assertion the reviewer asked for over the existing unknown-value fixture, and it
is discriminating rather than decorative: the new wording contains `no recognised x-quorum-contract
annotation`, which is not a superstring of `no x-quorum-contract annotation`, so the clause separates
exactly the two readings. **It is the only assertion in the scenario that fails against the wording
this scenario shipped with** — demonstrated by restoring the old string and running the file, output
in §2's reproduction above.

The loose-regex scenario at `:94`, which already drove both annotation values through a
`semantic.*skip` match, is untouched. It pins that a notice appears; this one pins what it says.

**`packages/core/src/contracts/validate-artifact.test.ts`** — §0.5's transcription, moved in the same
change so it keeps being a reproduction of the CLI rather than a green test of a string nothing
prints:

- the `render` helper's notice, which is the copy of the CLI's line;
- the render test, now driving all three shapes — `none`, `unknown-v1`, `empty` — through
  `toStrictEqual` on the exact rendered lines, in the file's own existing `for…of` idiom rather than
  a new `test.each`;
- the helper's JSDoc citation, **re-derived rather than incremented**: `grep -n "case 'validate'"`
  and the block's closing `process.exit` give `425–459`, where it said `425–454`. The JSDoc's
  sentence about why the citation is re-derived gains this round as its second occasion.

**Demonstrated red before green on the `core` side too.** Reverting only the `render` helper's string
— the transcription, not the expectation — fails the render test with a one-word diff:

```
- "…: no recognised x-quorum-contract annotation, so no semantic contract applies — …"
+ "…: no x-quorum-contract annotation, so no semantic contract applies — …"
  ❯ src/contracts/validate-artifact.test.ts:188
```

That proves the expectation is load-bearing over the helper. **It does not prove the pair still
matches the CLI** — nothing in `core` can, because the helper is a transcription by construction and
its own JSDoc says so. The spike scenario is what pins the real CLI, which is why both moved
together and why I am naming the limit rather than letting the green tick imply more than it earns.

---

## 3. A consequence neither finding named, and the guard that caught it

Widening the spike scenario added 15 lines to `q0011-runs-cli.js`, which round 1 reclassified from
`cli` to `split`. So it is in the `both` bucket, and `spike-parity.test.ts` went red:

```
AssertionError: expected 2279 to be 2264
 ❯ src/spike-parity.test.ts:1073
```

That is AC-11's guard doing exactly what it is for. **The four numbers are re-derived from the tree
with `wc -l`, not adjusted to fit** — `lines:` at `spike-parity.test.ts:865` counts `\n`, which is
what `wc -l` counts, so the two agree by construction:

| Bucket | Files | Lines |
| --- | --- | --- |
| binary-only | `q0036-board-containment.js` | **220** (unmoved) |
| both | seven files, `q0011-runs-cli.js` among them | 2264 → **2279** |
| library-only | ten files | **2469** (unmoved) |
| total | | 4953 → **4968** |

`(220 + 2279) / 4968 = 50.30%`, so the **rounded transfer share is 50%, before and after**. AC-11
requires it stated even when it does not move, and this is why: assuming it did not move is how a
stale pin survives a change that happened to be small. Only one file's column moved, because every
line added this round landed in one entangled file.

The narration comment gains a paragraph recording this as the **second** re-measure inside this one
ticket, with both figures, rather than editing the first away. Round 1's `336 / 2026 / 2463 / 4825 →
220 / 2264 / 2469 / 4953` sentence stands as the record of what that round did.

---

## 4. What I deliberately left alone

- **`harness/port-charter.md`** — §1. Including its §3 prose: the observation that the recorded
  procedure says "in the same commit" while its only precedent used a later one is worth a sentence,
  but no criterion asks for it and a charter edit is not mine to make in passing. **Named for the
  human, not done.**
- **`.github/scripts/port-freeze-guard.sh`** — unchanged this round. Round 1's removal of the
  unreachable *"(Q-0037..Q-0040 must settle first)"* line stands.
- **`SemanticOutcome` in either tree** — §2. The reviewer's second option would work and costs a
  `core` type change this ticket does not authorise.
- **`contracts/Q-0011/runs-cli.contract.md`** — frozen, and outside `developer-generalist`'s paths
  (NG-6). The new wording keeps its required words, which is why no erratum is owed.
- **`docs/decisions/`, `docs/DECISIONS.md`, `.claude/rules/`, `backlog/`** — NG-7, NG-9, and the
  role's own prohibition. GA-1 remains the human's.
- **Round 1's other work** — the timer removal in both trees, the three preserved-behaviour authority
  lines, nit 9's ruling, the per-step usage line and the B2 re-aim, and AC-9's `validateArtifact`.
  The reviewer raised nothing against any of it, and I re-read the timer diff and the fixture's
  bounded handle before leaving them: the ceiling is present, is ten seconds, rejects rather than
  hangs, and carries the line saying why it exists.
- **Nothing persisted changed.** No manifest field, file name, directory layout, schema, occurrence
  ordering or write-via-rename convention moved this round; existing manifests read without
  migration. The only shipped behaviour change is one rendered string.

---

## 5. One thing for the gate rather than for another round

**AC-10 clause 3's prose is narrower than the outcome it fires on.** It says the lead *"names the
schema's **missing** `x-quorum-contract` annotation"*, while the trigger it specifies —
`reason === 'unrecognised-annotation'` — fires on three shapes, only one of which is missing. That is
precisely the reviewer's finding one level up, in the criterion instead of in the code.

The clause's **testable content is satisfied** — the lead names `x-quorum-contract` and does not open
with `run-manifest`, which is what the scenario asserts and what it asserted before this round. Only
the descriptive word "missing" is imprecise. Per *"An erratum is the last repair, not the first"*
(2026-08-30), that is not enough to be worth an erratum: nothing was refused, nothing contradicts,
and the criterion's own assertions pass unchanged. **It is recorded here so a later reader does not
find the word and think the code drifted from it.**

---

## 6. Verification

Installed first, per `harness/rules.md`: `pnpm install --frozen-lockfile` and
`npm install --prefix spike --no-audit --no-fund`. A **baseline was recorded before any edit** —
spike 18/18, workspace 7/7 tasks 0 cached, core 1251 passed / 2 skipped — so every result below is
comparable rather than merely green.

| Check | Result |
| --- | --- |
| `npm test --prefix spike` | **18/18 test files passed** |
| `pnpm turbo run lint typecheck test --force` | **21/21 tasks, 0 cached** |
| `@quorum/core` tests | **1251 passed, 2 skipped** — identical to baseline |
| `node spike/bin/harness.js lint` | **6/6 flows clean** |
| `pnpm sweep:git-identity` | **both suites executed and green with no resolvable git identity** |
| freeze-sha oracle, by hand | `a6e529a` is an ancestor of HEAD; `git diff a6e529a HEAD -- spike/src` names two files; the same diff against `main` is empty |
| `node .github/scripts/port-freeze-guard.test.mjs` | **not run this round** — refused by this worktree's permissions (§1) |
| port-freeze guard, three halves | **not run this round** — same reason (§1) |

**Red demonstrated before green, in both trees, in that order:**

| Mutation | Result |
| --- | --- |
| spike CLI string reverted to `no x-quorum-contract annotation` | scenario fails on clause (6), naming the shape and printing the notice |
| the same, loop restricted to `unknown-v1` | fails naming `annotation unknown-v1`, which is the reviewer's case exactly |
| `core` `render` helper's string reverted, expectation left | render test fails with the one-word diff |
| both restored | spike 18/18, workspace 21/21 tasks 0 cached |

Every mutation was reverted and the final `git diff --stat` is byte-identical to the one in §0.

**Verification in the second environment row is not mine to do** and is stated rather than implied:
per Q-0072's closing finding, both suites must also be run forced on `main` after the merge, in a
checkout that has `.harness/worktrees` and `.quorum/runs`. This worktree has neither, which is the
first row; the second belongs at the close, beside the freeze-SHA re-record in §1.
