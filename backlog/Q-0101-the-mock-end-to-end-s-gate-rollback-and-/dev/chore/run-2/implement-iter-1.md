# Q-0101 — implement report, chore run 2, iteration 1

*No review report was present, so this is the first implement round.*

**Thirteen criteria, all satisfied.** Six files: one new suite, four existing suites edited, and the
register. **No product source changed**, and nothing under `spike/`, `harness/`, `backlog/` or
`docs/` was touched — the surfaces §2 names and no others.

```
 M packages/cli/src/end-to-end.test.ts     +31 −3    AC-7(b2), and the header that was about to be false
 M packages/cli/src/package.test.ts        +5  −5    the OUTSIDE audit's attributions (see §5)
 M packages/cli/src/run.test.ts            +62 −0    AC-8, in process
 M packages/cli/src/templates.test.ts      +68 −0    AC-9, re-homed with three discrimination tests
 M packages/core/src/spike-parity.test.ts  +110 −14  AC-10, AC-11, AC-12
?? packages/cli/src/failure-paths.test.ts  +560      AC-1 to AC-7(b1), AC-13, §3 R-4 to R-6
```

---

## 1. The thing I did before writing a line, and what it changed

**Every assertion below was measured against the built binary first.** I built the workspace, drove
`quorum` by hand over each of the six scenarios, and read the real `runs.log`, `ticket.md`, stdout
and exit status. Three things came back different from what a transcription would have produced.

**(a) AC-2(e)'s counter is 1, and that is OQ-1 answered by measurement.** The route is *reviewer
fails its first call for the key → `iteration 1/1 → goto head-of-product` → second call passes →
flow reaches its declared `gate: human` → nothing answers it*, so exactly one traversal is spent.
The observed frontmatter is `requirements.head-of-product: 1`. I did not predict it from the
document, which is what §0.4 says goes wrong.

**(b) The fixtures must rewrite `commands.install`, and no criterion says so.** This is the run's
most useful finding. With the scaffolded `install: npm install …` left in place, the AC-6
abandoned-merge run fails like this:

```
! integrate: install exit 254
! harness/T-0001/integration: rolled back to dee7036 — a run that did not complete leaves …
✗ integrate: install failed (`npm install --no-audit --no-fund --silent` exited 254).
· run #1 failed …                       ← status 1, and runs.log says tests=invalid
```

The branch **is** rolled back and the run **is** non-zero, so AC-6(a) and AC-6(b) both pass — over a
run that never reached the failing suite the criterion is about. That is precisely the shape AC-5
exists to refuse, arriving through the environment instead of through an assertion. With
`install: sh -c "exit 0"` the same fixture produces what the criterion means:

```
· integrate: install exit 0
! integrate: tests exit 1, expected pass
! harness/T-0001/integration: rolled back to a51188f …
· run #1 aborted …                      ← status 2, and runs.log says tests=fail
```

The spike gets this for free because `smoke.js:34–36` rewrites both commands once for its shared
`tmp`; a per-scenario fixture has to do it per scenario. AC-6(a) now additionally asserts
`tests exit 1, expected pass`, so a run that stopped at install cannot satisfy it.

**(c) `MOCK_FAIL_WRITE` matches the prompt, as §7 R-4 warned.** Confirmed at `mock.ts:98` before the
fixture was aimed; `candidate-claude.md` works because the claude candidate's prompt is the only one
naming its own output path.

---

## 2. File by file

### `packages/cli/src/failure-paths.test.ts` — new, AC-1 to AC-7(b1)

Six scenarios, each with **its own fixture repository** under `os.tmpdir()`, realpathed (§3 R-7).
One isolated workspace copy and one forced build shared across them, spawned rather than
`packages/cli/dist` (§3 R-2, Q-0098 AC-15(c)). Nineteen spawned invocations, **one operating-system
process per invocation** (§3 R-3).

| criterion | what it asserts | measured |
| --- | --- | --- |
| AC-1(a) | `status === 3`, off the spawned result | 3 |
| AC-1(b)(d) | `loop exhausted`, `human-locked`, no `auto-advanced (human-locked)` | all three |
| AC-1(c) | `stdin closed without one`, `nothing was rolled back` | both, at the **exhaustion** gate |
| AC-2(a–c) | `runs.log` has ` undecided `, no ` failed `, no `rolled-back` | all three |
| AC-2(d) | `stage: draft` | unmoved |
| AC-2(e) | the counter as a **value** | `1` |
| AC-3(a) | three `step=head-of-product` lines | 3 |
| AC-3(b) | `gate=retry counter=requirements.head-of-product set=1` | present |
| AC-3(c)(d) | `head-of-product: 2`, `qa-final.unrelated: 2` | both |
| AC-3(e) | the second gate returns, run non-zero | 3 |
| AC-4(a) | the run fails, `1 of 2 parallel step(s) failed` | status 1 |
| AC-4(b) | `requirements/run-1/candidate-codex.md`, exact path | present |
| AC-4(c) | `candidate-claude.md` **searched for** recursively | absent |
| AC-4(d) | ` failed ` in `runs.log`, `stage: draft` | both |
| AC-4(e) | `step=pm-claude … FAILED cost=0.07`, run cost ≥ it | 0.07 / 0.08 |
| AC-4(f) | ids as an **identity** | `['1','2']` |
| AC-6(a–e) | abort, revision identity, merge gone, work survives, `rolled-back branch=` | all five |
| AC-7(b1)(a–e) | fail, both branches named, "cannot fix it", no `iteration 1/3`, `base-conflict base=` | all five |

Four things are stronger than the criterion's own words, each with its reason in place:

- **AC-2(e)'s reader returns `null` for an absent key rather than `0`.** §0.4's finding is that the
  spike's `?? '0'` plus `>=` makes the assertion `n >= 0` — true for every value including a refund
  to zero. A reader that cannot tell *absent* from *zero* cannot express the claim, so this one does,
  and a companion test shows it answering `0`, `null` and `1` over three composed frontmatters. That
  is the "shown to fail both against a refund to `0` and against the key being absent" half.
- **AC-4(f) is `toStrictEqual(['1','2'])`, not `new Set(ids).size === ids.length`.** The spike's
  uniqueness form is satisfied by a *single* id, so it would pass over a second attempt that never
  reached the log.
- **AC-6(b) asserts the recorded revision is a 40-hex string** before comparing, so a comparison of
  two empty strings cannot pass for the wrong reason.
- **The recursive searcher is itself shown discriminating** over a composed directory, finding a file
  one level down and not finding one that is not there — before its silence in AC-4(c) is read as
  evidence.

`§3 R-4 to R-6` each have a test: no `spike/` literal or specifier, with both clauses shown firing;
the sanitiser demonstrated over a composed environment; and the win32 refusal at module scope, with
a scan forbidding every skip shape. A seventh test asserts **what each scenario was actually
handed** — a spawned run that inherited `MOCK_ALWAYS_PASS` would reach a gate its loop never turned
and every wording assertion would still pass.

**AC-13** is the header: it names `run.test.ts`, cites S10.6, `run.test.ts:202` and S10.7, and says
for each which clauses are carried and which are new. Where a carried clause is restated (AC-1(b)
and (d)) the header says why — they are free once the run exists, **and they are what identifies the
gate**, without which a 3 from an early crash would satisfy AC-1(a) on its own. The assertion over
the header is deliberately weak, per `requirements/errata.md` E-1.

### `packages/cli/src/end-to-end.test.ts` — AC-7(b2), and one header sentence

One describe block, three assertions over `chain.ran.solutioning`, which that file already records
and already reads at `:594` and `:609`. No second flow walked. §0.8's reasoning is in place.

Its header said *"The failure, gate and rollback half is **Q-0101**'s"* — about to be false in this
file. It now names `failure-paths.test.ts` and states the one exception and why.

### `packages/cli/src/run.test.ts` — AC-8, in process

Both rows over the **shipped** `review.yaml` — the one `quorum init` scaffolds, which
`templates.test.ts` proves byte-identical to the spike's tree and, through link 2, to `harness/flows`.
So no `copyFlows` step: the spike needs one because its `init` and its repository are the same tree.

The fixture needed more than the criterion says, and it was measured: `review` consumes `green`
**and** diffs `{base}...harness/{id}/integration`, so a ticket with no such branch is refused in the
preflight and no step runs. Adding the stage alone gives:

```
✗ ticket T-0001: expected harness/T-0001/integration; review requires an integrated branch …
```

With the branch and the two documents `review.yaml` reads: `MOCK_ALWAYS_FAIL` + `abort` → exit 0,
`stage: red`, `changes-requested`; `MOCK_ALWAYS_PASS` + `advance` → exit 0, `stage: reviewed`,
`approve`, `review/verdict.md` written. That file's *"Nothing here spawns the binary"* header stays
true, and its header now says what Q-0101 added and why this one scenario does not need a process.

### `packages/cli/src/templates.test.ts` — AC-9

`pinning(root)` walks `flows` and `roles` **recursively** and returns the offending relative paths
**named**, not counted. Green on landing, so three tests make it able to fail: a flow and a role that
do pin one (two directories, because a scan that lost one would still pass over the other), and a
template one directory down — the one place this is strictly stronger than the spike's flat
`readdirSync`. Every mutation is in a `copies()` sandbox, never in the tracked tree. A companion
clause asserts the corpus **does** carry `model:` lines, so the silence is a measurement rather than
a walk over nothing.

The header says why this is not a fourth description of the byte-identity chain: identity carries
`smoke.js:216`'s claim onto this mirror only while the spike exists, and the cutover deletes it.

### `packages/core/src/spike-parity.test.ts` — AC-10, AC-11, AC-12

- **`smoke.js`** — `binaryCarriedBy` grown to `['…/end-to-end.test.ts', '…/failure-paths.test.ts']`;
  prose says which carries which, in the Q-0092 shape, and **names AC-7(b2) explicitly** as the one
  claim that crosses the seam.
- **`q0033-surface.js`** — prose now records S3.2/S3.3 as carried by `run.test.ts` since Q-0101, in
  process, with the reason. Its `binaryCarriedBy` list is unchanged: `run.test.ts` was already on it.
- **Four clauses moved**, each rewritten rather than removed, each with its one-line reason in place:
  `(l)` and `(p)`'s `.toMatch(/Q-0101/)` → `.not.toMatch(/— Q-0101\b/)`; `(p) adapters`'s
  `toStrictEqual` re-aimed to the pair; `(r)`'s `.toMatch(/— Q-0101$/)` → `.not.toMatch(…)`. **A
  fifth moved that the requirement did not name either**: clause `(i)`'s claiming identity, which is
  the one designated to grow with each child — it went red on its own and is reported in §4.
- **New `(s)` blocks**: the pair-and-prose claim, plus an identity over *every* row that still names
  a successor, which is now `[]` — the state the cutover needs and which no earlier ticket could
  assert; the audit's two guards exercised against `smoke.js` (absent path, uncollected path); and
  the sixth totals derivation.
- **AC-12: re-derived from `FACTS`, unmoved.** `{ binaryOnly: 220, both: 2739, libraryOnly: 2469,
  total: 5428, share: 55 }`. Both rows' verdicts still `split`, and `smoke.js` still in `both`.

The file header gained one sentence recording that no row names a successor any more.

---

## 3. AC-5 — the red witnesses, with the break and the failing message

**AC-5(a) — the run-scoped candidate not found.** Break: in the isolated build's own template,
`requirements/run-{run}/candidate-{claude,codex}.md` flattened to `requirements/candidate-*.md`,
with `head-of-product`'s input glob flattened with them.

```
× (b) the surviving sibling keeps its output, at the run-scoped path Q-0088 moved it to
AssertionError: the surviving sibling lost its finished work at requirements/run-1/candidate-codex.md:
  expected false to be true
Tests  1 failed | 31 passed (32)
```

**Exactly one assertion red, and the run itself succeeded** — 31 tests including every other scenario
passed, so the process started and the flow ran. The criterion's own disqualification test is met.

*Why the glob had to move with the paths, which is a finding in itself:* flattening the write paths
alone makes `head-of-product`'s `requirements/run-{run}/candidate-*.md` match only the claude
candidate, so `lint` refuses the flow for `cross_vendor: required` and **every scenario dies at the
preflight** — 17 tests red, all of them the "unrelated process failure" AC-5 says does not count. I
recorded that attempt and discarded it rather than reporting it as the witness.

**AC-5(b) — the failed sibling's candidate found by the recursive search.** Break in the mutation
procedure: `MOCK_FAIL_WRITE` aimed at `candidate-codex.md`, so a **real run** leaves
`candidate-claude.md` on disk under `requirements/run-1/`.

```
× (c) and the failed sibling wrote nothing, searched for rather than tested at one path
AssertionError: the failed branch left a candidate somewhere under requirements/:
  expected true to be false
Tests  4 failed | 28 passed (32)
```

The other three reds are the same break seen from the other side — the roles swapped, so (b), (e)
and the steering identity move with it — not unrelated failures.

**And the half that makes it worth having.** Under the *same* break, with AC-4(c) written in the
flattened single-path form `fs.existsSync(at('requirements/candidate-claude.md'))`:

```
Tests  3 failed | 29 passed (32)     ← (c) is NOT among them
```

**Recursive form red, flat form green, same tree.** That is the hole Q-0088 exposed, demonstrated
rather than described: a translation that re-flattened this assertion would re-open it and pass.

**AC-1's required mutation (§7 R-5).** `undecided: UNDECIDED` → `ERROR` in `packages/cli/src/exit.ts`:

```
× (a) the status is exactly 3, read from the spawned result rather than composed
Tests  1 failed | 31 passed (32)
```

**(b), (c) and (d) stayed green**, which is what proves (a) is not riding on its neighbours.

All four mutations were reverted; `git status` shows the template tree and `exit.ts` clean.

---

## 4. AC-10 and AC-11 — each moved clause shown red against its superseded value

Run with the register's **old prose** restored and the new clauses in place:

```
× (l) Q-0093 …  the surface row still says Q-0101 owes it: expected '…' not to match /— Q-0101\b/
× (p) Q-0099 …  the surface row still says Q-0101 owes it: expected '…' not to match /— Q-0101\b/
× (s) Q-0101 …  a row still names a ticket as owing part of its binary half:
                  expected [ 'q0033-surface.js' ] to strictly equal []
```

Run with the `smoke.js` row's **old prose and one-element list** restored:

```
× (i) Q-0091 …  expected [ …(9) ] to strictly equal [ …(9) ]
× (p) adapters  smoke.js's chain half is no longer recorded as carried:
                  expected [ Array(1) ] to strictly equal [ …(2) ]
× (r) Q-0095 …  the smoke row still says Q-0101 owes it: expected '…' not to match /— Q-0101\b/
× (s) Q-0101 …  the smoke row still names one counterpart
```

**One negative result worth recording.** I first tried the other direction — the *old* expression
`.toMatch(/Q-0101/)` against the *new* prose — and it **passed**, because the new prose contains
"since Q-0101". That is Q-0094's comment demonstrated rather than quoted: *the old expression would
have gone on passing while meaning the opposite, which is worse than going red.* It is why these
clauses had to be rewritten, and why "shown red" here means the new clause against the old value.

**Clause `(i)` went red on its own, unprompted**, the moment the field grew — the register catching
its own move without anyone remembering it was there. Appendix B named four sites; `(i)` is a fifth.

---

## 5. Not in the requirement, and reported rather than decided

**(1) `package.test.ts`'s `OUTSIDE` audit attributed five reads to `end-to-end.test.ts` alone**, and
the new suite reads all five. The turbo *declaration* needed no move — `../../packages/*/src/**`
already covers them, which is what §7 R-6 asked me to confirm — but the audit's one-line reasons are
what say *who* reads each path, and a reader deleting the chain suite would have concluded the reads
went with it. I extended the five reasons to name both suites. This is the smallest edit that keeps
the register from rotting; if the reviewer reads it as outside scope it reverts cleanly on its own.

**(2) The `STEERING` derivation is a second copy, deliberately, and this is the one judgement I want
ruled at the gate.** §3 R-5 says the suite sanitises "the way `end-to-end.test.ts`'s `sanitised()`
does", and R-2 enumerates what it reuses from `test/workspace.ts` — a sanitiser is not among them.
Extracting `STEERING`/`sanitised`/`refusedBy` into the shared helper would edit Q-0095's landed suite
past the one addition this ticket authorises there, and would move `package.test.ts`'s attributions
onto the helper. So I kept it local and cited the sibling in place. The mitigation is real rather
than asserted: **neither copy can drift from the product**, because both derive from the same four
files, and each has its own discrimination test, so a copy that stopped firing fails alone. If the
gate prefers the extraction, it is a self-contained follow-up.

**(3) A pre-existing lint warning, untouched.** `packages/core/src/backlog/backlog.ts:276` reports
*"Unused eslint-disable directive (no problems were reported from 'no-control-regex')"*. It is in a
file this ticket does not change and it is not new. Reported, not fixed.

**(4) Q-0100's instances were preserved.** The scenarios reproduce user-facing `harness` sentences
verbatim wherever the product prints them. Not repaired (ground rule 3, non-goal 6).

---

## 6. GO-5 — one data point in each direction for Q-0102, and no fix

**On this implement branch: 1 failure in 8 sweeps.** Every run is
`bash .github/scripts/git-identity-sweep.sh` via `pnpm sweep:git-identity`, from this linked
worktree, on darwin / 16 cores.

```
run 1  exit 0     run 5  exit 0
run 2  exit 1  ←  run 6  exit 0
run 3  exit 0     run 7  exit 0
run 4  exit 0     run 8  exit 0
```

Run 2 failed in phase **`workspace suite`** — the same phase Q-0102's body names — with
*"the workspace suite is RED under a git configuration that resolves no identity"*.

**The base direction is already measured and I did not re-measure it.** Commit `3cf345c` records 25
sweeps with 0 failures at `e47fb1d` and `bb8e143`, and this branch's merge base is `edcc7ad`, one
`docs`/`.gitignore` commit past it. Re-running that cell would have duplicated a measurement whose
method is already written down.

**What this does and does not license.** It is a *reproduction* on a branch that adds a second
process-spawning, workspace-building fixture — §7 R-1's named suspicion. It is **not** evidence that
this ticket's change moved the rate: 1/8 here against 0/25 there is not a difference these sample
sizes can resolve, and the two were taken on the same machine but not under matched load. **The
honest reading is that the flake is still live and this branch is not exonerated.**

**One limitation I have to state rather than hide:** I did not capture *which files* failed on run 2
— that invocation was tailing four lines and the per-file detail scrolled past. Runs 3 to 8 were run
with the capture in place and none reproduced. So this data point bounds a rate and adds nothing to
the mechanism. Q-0102's surviving lead — no `testTimeout` configured, against
`worktree-lifecycle.test.ts`'s 18 synchronous git spawns — is untouched by it.

**Nothing was fixed and nothing was weakened** (non-goal 5, and Q-0102's own GO-2).

---

## 7. Verification

Installed first, both trees, because a worktree starts with no dependencies:
`pnpm install --frozen-lockfile` (the Q-0098 M-8 `WARN` about the absent `dist/quorum.js` bin shim
appears and is expected at that point), then `npm install --prefix spike --no-audit --no-fund`.

Forced, in this worktree, after the scratch measurement script was removed:

```
pnpm turbo run test lint typecheck --force  →  21 successful, 21 total, 0 cached
  @quorum/cli    23 files, 543 tests passed
  @quorum/core   58 files (1 skipped), 1328 tests passed
  @quorum/shared 12 files, 150 tests passed
npm test --prefix spike                     →  all 19 test files passed
node spike/bin/harness.js lint              →  6/6 flows ✓
```

The new suite alone: 32 tests, 5.0 s / 5.8 s / 5.7 s across three runs — which is where the two
timeout constants' JSDoc figures come from. I had first written per-invocation figures I had not
taken; they are replaced with the bound I did measure.

`harness/Q-0101/integration` exists, so **GO-2 is satisfied**.

**Not yet done, and not mine:** per *"Integrate's tick is worktree-scoped"*, this is one environment
row only — the populated working checkout. The forced re-run on `main` after the merge is owed.
**GO-4** — allocating the cutover ticket (delete `spike/`, retire its CI job and
`harness/port-charter.md`) — is the human's act at this ticket's close.

---

## 8. What I deliberately left alone

- **`spike/` entirely** (ground rules 1 and 2). Nothing there is named by path in the new suite
  either: `§3 R-4`'s two clauses assert that over the file's own source.
- **All product source.** No non-test file under `packages/*/src` changed. The `exit.ts` and template
  edits in §3 were mutations, reverted, and `git status` confirms both clean.
- **Q-0059, Q-0060, Q-0066, Q-0068, Q-0100** — every user-facing `harness` sentence a scenario
  reproduces is preserved verbatim.
- **The mock adapter's counter.** No reset export; the per-process design (§3 R-3) is what pays for
  its absence.
- **`06-development-plan.md` and every numbered doc.** §8's docs row says none is owed, and Q-0094's
  E-3(a) records what ruling otherwise cost.
- **`packages/cli/turbo.json`.** Confirmed rather than assumed: every path the new suite reads
  outside the package is already declared by `../../packages/*/src/**`.
