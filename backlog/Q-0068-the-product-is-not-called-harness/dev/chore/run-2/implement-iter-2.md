# Q-0068 — implement report, run 2, iteration 2

*Written 2026-09-10. A revision round. Both review findings were confirmed against the tree by
measurement before anything was edited, and both fixes are demonstrated below rather than asserted.
The product diff from iteration 1 is untouched: this round changes two comments and nothing else.*

---

## 1. The two findings

Both are real. Both are false claims in comments — one in a test whose criterion I followed instead
of my own measurement, one in a comment I rewrote and did not rewrite far enough. Neither is a code
defect and neither changes what the product does.

### 1.1 — `packages/cli/src/adapters.test.ts:343` — a mutation claim that is false, and I had already
measured it false

**The finding is correct.** The comment ended:

> Restoring `res.usage!` in `core` turns this red as well as `probe.test.ts`, which is what proves
> this file follows `core` rather than compensating for it.

It does not. `packages/cli/src/adapters.test.ts:34–36` is `vi.mock('@quorum/core', …)` replacing
`getAdapter` and `probeAdapter` with stubs, which that file's own header states as a deliberate
property — a suite reaching the real `probeAdapter` *"would have a verdict that is a property of the
machine and of the account … and would spend money doing it"*. No change in `core` is visible to it.

**The provenance is the part worth recording, because it is this repository's most-recorded
failure.** My own iteration-1 report measured this and wrote it down — §0.2, *"Measured, by
performing the mutation: `packages/cli/src/adapters.test.ts` stayed green. It cannot do otherwise."*
I then transcribed AC-11's *Test:* wording into the comment regardless. The report and the comment
contradicted each other inside one commit, and the comment is the half a future reader trusts. That
is a measurement copied from a document rather than taken, where the document is a criterion I had
already disproved and said so.

**What shipped.** The claim now states what is true and names the instrument that does carry the
cross-package property:

> It claims nothing about `core` and cannot — `probeAdapter` is stubbed in this file (see its
> header), so restoring `res.usage!` leaves this green. That the CLI follows `core` rather than
> compensating for it is `build.test.ts`'s `Q-0068 AC-10` block, which spawns the built binary
> against a fake vendor and does go red under that mutation.

The test body, its fixtures and every assertion are unchanged, and the AC-8(d) name is kept as AC-11
requires, so the register of what this command reports stays complete.

### 1.2 — `packages/core/src/adapters/adapters.test.ts:332` — the deleted-tree citation AC-4 asked to
be rewritten

**The finding is correct.** The comment still opened `// spike/test/smoke.js:460-466.` AC-4 requires
that comment *rewritten* and enumerates three falsehoods in it; I closed those three and left the
citation standing at the front of the block.

**Why it is in scope, stated because the neighbour three lines up is not.** Q-0103's AC-19 leaves
past-tense provenance alone, and `:319` — `// spike/test/smoke.js:451-457.` above the *worth
retrying* table — is deliberately untouched. The discriminator is what a citation **claims**, not
which tree it names. `:319` claims those five fixtures came from `smoke.js:451-457`, and that table
is unchanged, so the claim is still true. `:332` claimed the same of a table whose first row is now
`shippedRefusal`, computed at run time by invoking `claudeAdapter().check()` — a text that was never
in `smoke.js` at all. So it is not merely naming a deleted path; it asserts a provenance now false of
the row directly beneath it, which is a fourth falsehood of exactly the kind AC-4's three are.

**What shipped.** The citation is removed rather than re-pointed, and the comment names the real
source:

> The first fixture is {@link shippedRefusal}: the sentence `claude.ts` throws, obtained by invoking
> `claudeAdapter().check()` with the key set rather than retyped …

The `AUTH_PATTERNS` paragraph, the four rows and the assertion are unchanged.

---

## 2. The class, not only the two instances

Round 1's own lesson — and three separate findings inside Q-0112 — is that repairing the instance a
reviewer names and leaving the class is the failure recorded here most often. Both findings are
instances of *a comment asserting a mutation or a provenance nobody re-ran*, so I swept iteration 1's
whole diff for the rest of the class before writing this.

- **Every other mutation or falsifiability claim added in iteration 1 was re-checked against what was
  actually measured.** Four exist — the `0 tokens` substring reasoning in `adapters.test.ts`, the
  anti-vacuity anchor note in `binary-name.test.ts`, *"editing either side alone turns this red"* in
  `docs.test.ts`, and the moved-file note in `binary-name.test.ts`. All four are true, and all four
  were demonstrated by iteration 1's mutations A, B, D, E and F. **No second false claim.**
- **Every `spike/` citation in the four files this ticket touched was re-read.**
  `probe.test.ts:10–11`, `:89`, `:100`, `adapters.test.ts:4`, `:180`, `:319` and six in
  `build.test.ts` are past-tense provenance in blocks this change never entered, and each is still
  true of the table or fixture it sits above. The one that had gone false is §1.2's. In particular
  the AC-11 block inverted in `probe.test.ts` carries no stale citation — its *"the spike still does
  it"* sentence was already removed in iteration 1, as AC-13's table required.

So the two findings are the whole of the class in this diff, checked rather than assumed.

---

## 3. Demonstrated, not asserted

The corrected comment in §1.1 makes two claims about a mutation. Writing a claim about a mutation and
not running it is the defect being repaired, so both halves were run. Mutation: restore
`probeAdapter`'s pre-fix unguarded reads, `res.usage!.cost_usd` and
`(res.usage!.input_tokens ?? 0) + (res.usage!.output_tokens ?? 0)`.

| Subject | Result under the mutation | What it establishes |
| --- | --- | --- |
| `packages/cli/src/adapters.test.ts` | **28 passed, green** | the removed sentence was false — the reviewer's finding, reproduced |
| `packages/cli/src/build.test.ts` `Q-0068 AC-10` | **2 failed**, `expected 1 to be 0` from the spawned binary | the replacement sentence is true; the cross-package claim lives here |
| `packages/core/src/adapters/probe.test.ts` | **2 failed** | `core`'s own half still fires |

`build.test.ts`'s third AC-10 test — the *measuring* discriminator — correctly stays green under the
mutation, a reported usage not being the case that breaks. That is the discriminator behaving as it
was written to.

**The mutation is fully reverted.** `git diff --stat HEAD` shows two files, both tests;
`adapters.ts` is absent from the diff.

---

## 4. File by file

**`packages/cli/src/adapters.test.ts`** — one comment. The false mutation claim replaced with the
stubbing fact and a pointer to `build.test.ts`'s AC-10 block. No assertion, fixture or test name
moved.

**`packages/core/src/adapters/adapters.test.ts`** — one comment. The `spike/test/smoke.js:460-466`
citation removed and the fixture's real source named; the block reflowed to its neighbours' width. No
assertion, fixture or test name moved.

**Nothing else.** No production file is in this round's diff.

---

## 5. Verification

Run from the worktree root after `pnpm install --frozen-lockfile` (*"Already up to date"*, 306 ms),
which is `commands.install` verbatim.

- **`pnpm turbo run test lint typecheck --force --continue`** — **21/21 tasks, 0 cached.** The test
  half alone: 7/7 tasks 0 cached, 2246 passed and 2 skipped; per package shared 171, core 1447, cli
  626. The two skips are Q-0105's pre-existing `GIT_TEST_ASSUME_DIFFERENT_OWNER` pair.
- **`pnpm exec quorum lint`** — **6/6** flows through the built binary: chore, development, qa-red,
  requirements, review, solutioning.
- **`pnpm sweep:git-identity`** — exit 0, *"the workspace suite executed and green with no resolvable
  git identity"*. This is GO-4's both-rows run.

**One lint warning, pre-existing and untouched:** `packages/core/src/backlog/backlog.ts:330`, an
unused `no-control-regex` disable directive. That file is in neither round's diff and the rule is not
type-aware, so the warning is a property of `main`. Reported in iteration 1, still not repaired — it
is not this ticket's surface.

**GO-4's remaining half is the human's:** verification on `main` in both environment rows after the
merge, and CI green on the merged commit. Q-0105's GO-3 is the precedent for not reading a local
green as covering CI.

---

## 6. Deliberately left alone

- **`packages/core/src/adapters/adapters.test.ts:319`** — the *worth retrying* table's
  `spike/test/smoke.js:451-457` citation. Its table is unchanged, so its claim is still true, and
  correcting it would be the prose sweep Q-0103's AC-19 rules a non-goal. §1.2 states the
  discriminator.
- **The other eleven `spike/` citations** in `probe.test.ts`, `build.test.ts`, `docs.test.ts` and
  this file's `:4` and `:180`. Same reason, each re-read rather than assumed.
- **`build.test.ts`'s AC-10 block.** The finding points *at* it; it needed no change, and its three
  tests pass unmodified.
- **Everything iteration 1 recorded under its own §4** — `withRetry`'s `usage: null`, the human
  renderer's truthiness clause, `authError` and `transientError`, the refusal's ordering and
  coverage, `quorum adapters` exiting 0 with both CLIs absent, the non-string-final-message crash,
  widening `binary-name.test.ts` to all of `core`, and the prose audit. None was reopened.
- **`backlog/`, `harness/`, `docs/decisions/`, `.claude/rules/`.** Untouched, per §3 and §6.10.

---

## 7. Scope

Nothing in this round goes beyond the two findings. Iteration 1's two declared scope notes — the
`readSlash`/`readRegex` scanner change that makes AC-5 reachable, and the `build.test.ts` fixture
hoist — are unchanged and unreopened. If a reviewer still judges the scanner change to belong in its
own ticket, the trade is the one iteration 1 stated: AC-5 cannot then ship. That is a gate ruling
rather than something this round can settle.
