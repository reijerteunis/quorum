# Landing record — `harness/Q-0011/integration`

*AC-1. Written 2026-08-24 **before** the merge, unlike `landing-Q-0006.md`, which recorded its own
deviation on that point.*

## State at the time of landing

| | |
| --- | --- |
| Branch head examined | `534d3d96ed22131f19c27d961a6c36530cd5248f` |
| `main` head before landing | `4c83ccfd8f0031e4d2bf4cc4f0263ecf72904d5b` |
| Merge base | `4c83ccfd8f0031e4d2bf4cc4f0263ecf72904d5b` — equal to `main`, so this is a fast-forward |
| Unique commits | 52 (48 from Q-0011's own life, 4 added under Q-0034) |
| Files changed | 20 (+1543 / −34) |

The branch was 91 commits behind `main` when its review began. `c90d736` merged `main` into it, so
the merge base is now `main` itself and the landing carries no conflict.

## Strategy: merge (fast-forwardable), recorded with `--no-ff`

**Merge**, per OQ-3's recommendation. The 48 commits are the audit trail of a five-round solutioning
and a two-vendor fan-out, and M1's closing entry cites several by SHA — a rebase would rewrite
evidence the record depends on. Re-derivation was the fallback if the engine conflict proved
intractable; it did not, because the conflict was resolved on the branch instead.

**Conflicts: none at this step.** All seven hunks were resolved earlier, in `c90d736`, when `main`
was merged into the branch. That commit records each one; the two needing judgement were `runFlow`
(take `branchHeadAtStart` only — Q-0011 had *relocated* the start-log lines into the try block, and
restoring `main`'s copies would have logged every run twice) and `runIntegrate` (take `main`'s
`testReport`, keep Q-0011's `persistArtifact`).

## Behaviour retained and dropped

Everything Q-0011 built is retained: `.quorum/runs/<id>/` written by the engine, the
`harness runs [ticket|run-id] [--json]` reader, and the per-vendor roll-up. Nothing was dropped.

Four commits of Q-0034 work sit on top, all of them review response:

| Commit | What |
| --- | --- |
| `c90d736` | merge `main`; closes review blocker 1 (branch 91 commits stale) |
| `5e5c41d` | blockers 2–4: `_started` leaking into manifests, cache tokens double-counted, AC-1 collision refusal unimplemented, `runs` path traversal |
| `9201ee1` | 13 of 14 round-2 majors |
| `534d3d9` | erratum E-4 and the re-pointed scenario |

## Review — AC-2

Reviewed **while unlanded**, twice, cross-vendor both times (Claude + Codex panel).

| Round | Run | Verdict | Findings | Cost |
| --- | --- | --- | --- | --- |
| 1 | #12 | changes-requested | 4 blockers, 10 majors, 6 nits | $6.651 + 4.20M tokens |
| 2 | #13 | changes-requested | **0 blockers**, 14 majors, 9 nits | $5.950 + 3.91M tokens |

Verdicts and findings are committed under `backlog/Q-0011-…/review/round-1/` and `round-2/`.

Round 2's most useful findings were about round 1's *fixes*: the path-traversal fix was lexical only
and a symlink defeated it; the collision refusal threw after the `start` line without calling
`finish()`, re-opening the "run that started and stopped existing" gap; and its message asserted a
concurrency story `nextRunId` contradicts. All three are closed.

**Findings not fixed, opened as a ticket per AC-2: `Q-0037`.** One major (the `runGate` one-second
timer, documented in place because removing it requires editing a frozen qa-red fixture) and eight
nits. None blocks the feature.

**The last verdict is `changes-requested`, and the ticket is landing anyway.** That is AC-2 working
as written — it allows findings to become follow-up tickets rather than forcing a revise loop on a
stale branch — but it is worth stating plainly rather than leaving to be inferred: no review round
has ever returned `approve` on this branch, and the state being landed has not itself been reviewed.
A third round would cost roughly $7 and would be the last before the exhaustion gate.

## Deviation from AC-4, resolved by erratum

AC-4 requires Q-0011's committed tests to pass **unmodified**. `spike/test/q0011-runs-cli.js` is
modified: one assertion in `AC-12/EDGE-10/EDGE-11` is re-pointed. This is not a developer editing
the test that judges them — it is erratum **E-4** (`backlog/Q-0011-…/solution/errata.md`,
2026-08-24), which settles a contradiction *inside the contract*: `runs-cli.contract.md` says both
"zero matches … exit zero" (:12) and "a malformed sibling is named … and the final exit is
non-zero" (:18–19), and both apply to the fixture. The erratum decides for store health; the
scenario now covers **both** clauses where it previously covered only the ambiguous case.
`spike/test/q0011-run-history.js` is byte-unmodified.

## Verification

Captured on `main` at `4c83ccf`, **before** the merge:

```
node spike/test/run.js                  # ✓ all 5 test files passed
pnpm install --frozen-lockfile          # ok
pnpm lint / typecheck / test            # 7 tasks each, all successful
```

AC-5 loss check, `main` versus branch, before the merge — every `^##` heading and `^**` term
present on `main` is present on the branch, in all three conflicting documents, and DECISIONS
entries remain in date order:

```
✓ docs/DECISIONS.md      168 → 172 headings, none lost
✓ docs/GLOSSARY.md        21 →  22, none lost
✓ docs/04-architecture.md 11 →  12, none lost
```

Post-landing results are appended below by AC-7's completion record.

---

## Completion record — AC-7

Landed 2026-08-24.

| | |
| --- | --- |
| Reviewed integration commit | `534d3d96ed22131f19c27d961a6c36530cd5248f` |
| Merge commit on `main` | `655e05a` |
| `main` before | `4c83ccfd8f0031e4d2bf4cc4f0263ecf72904d5b` |

Q-0006 and Q-0011 are not described as reconciled on the grounds that their branches are still
green. These are commands, re-runnable by any reader, and each was run:

```
git merge-base --is-ancestor harness/Q-0011/integration main   # exit 0 — contained
git merge-base --is-ancestor harness/Q-0006/integration main   # exit 0 — contained
grep -rn "\.quorum" spike/src spike/bin                        # 8 hits (was 0 on main)
test -f spike/src/lint.js && node spike/bin/harness.js lint    # exit 0 — Q-0033's module survives
node spike/bin/harness.js runs --json                          # {"mode":"list","runs":[],"warnings":[]} exit 0
```

**Both CI jobs, on `main` after landing** (AC-6). Compare with the pre-landing baseline above: the
spike suite went 5 → 8 files, which is the three files this landing adds, and no pre-existing
failure was masked because there were none.

```
node spike/test/run.js                     # ✓ all 8 test files passed
pnpm install --frozen-lockfile             # ok
pnpm lint / pnpm typecheck / pnpm test     # 7 tasks each, all successful
```

**Fresh checkout**, cloned from `main` into a scratch directory and verified from cold, which is the
claim that actually matters — the whole ticket exists because the repository's own working tree
disagreed with what any clone contained:

```
git clone --no-hardlinks . <tmp>           # HEAD 655e05a on main
grep -rln "\.quorum" spike/src spike/bin   # engine.js, adapters/mock.js, bin/harness.js
cd spike && npm ci && node test/run.js     # ✓ all 8 test files passed
pnpm install --frozen-lockfile             # ok
pnpm lint / typecheck / test               # ✓ ✓ ✓
```

One note for whoever reads this next: `harness runs` in a cold clone fails with
`ERR_MODULE_NOT_FOUND: yaml` until `npm ci` is run in `spike/`. That is ordinary dependency
installation, not a defect, but it is the first thing a stranger following the README would hit, and
`.quorum/` remains git-ignored so the feature ships while the run data does not.
