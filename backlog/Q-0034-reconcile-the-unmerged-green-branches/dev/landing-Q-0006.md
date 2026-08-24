# Landing record — `harness/Q-0006/integration`

*AC-1. Written 2026-08-24, immediately after the merge. **Deviation from AC-1 as specified:** the
criterion says "written before any merge" and this was written after. Nothing here is reconstructed
from memory — every figure below was re-derived from git after the fact and is re-runnable — but the
ordering requirement was not met, and Q-0011's record will be written first.*

## State at the time of landing

| | |
| --- | --- |
| Branch head examined | `29ad00af373be897071804ced8548375aec6f012` |
| `main` head before landing | `1f372006715448dc90a52344b9698e140b182a5e` |
| Merge base | `6cc9da4b1065bb47f8d41f3c75a8ee0d87f693f8` |
| Unique commits on branch | 3 |
| Files changed since merge base | `spike/src/adapters/index.js`, `spike/src/engine.js` (45 insertions, 13 deletions) |
| Files `main` also changed since merge base | **0** — verified with `git diff --name-only 6cc9da4..1f37200` |
| Merge commit | `24a8ffd73cbea371011c9ac69cd55264baa5a030` |

The three commits are `ebf1c6e` (*"Merge branch 'main' into harness/Q-0006/integration"*), `aa746ad`
(the only development commit) and its integration merge. Three `fix(engine) … [Q-0006]` commits —
`78f626d`, `9e488d7`, `bfb90c0` — were hand-applied to `main` out of band and are ancestors of both
sides, so they were never part of this landing.

## Strategy: merge, `--no-ff`

Chosen over rebase or re-derive because the merge is conflict-free by construction — zero file
overlap with `main` since the merge base — so neither alternative buys anything, and a rebase would
rewrite SHAs that M1's closing entry in `docs/DECISIONS.md` cites by name.

**Conflicts encountered: none.** `git merge --no-ff` reported *"Merge made by the 'ort' strategy"*
with no conflicted paths.

## Every change accounted for

The diff is 45 insertions across two files and reads like a formality; it carries six separable
decisions, which is why each is named. Five retained, one reverted.

| Change | Where | Disposition |
| --- | --- | --- |
| Run-level diff preflight (`ctx.diffInputs`) — materialises every distinct `input.diff` range before the first step runs | `engine.js` `runFlow` | **retained** |
| `input.diff` range guard — a flow file may not aim a diff outside the pair the engine resolved | `engine.js` `materialiseDiff` | **retained** |
| Counter plumbing through `handleFail` / `runGate`, so a cross-flow regression reports the counter it spent | `engine.js` | **retained** |
| `schemaFor` findings-pattern relaxation for non-review verdict enums; `checkAgainstSchema` generalised to the enum's first option instead of the hard-coded `approve`/`changes-requested` pair | `engine.js`, `adapters/index.js` | **retained** |
| UTF-8 truncation fix (`trimIncompleteUtf8Suffix`), replacing an O(n²) byte-walk; notice reports bytes kept | `engine.js` | **retained** |
| `PROBE_SCHEMA` requiring every property it declares | `adapters/index.js` | **retained** |
| SIGINT terminal outcome renamed `interrupted` → `aborted` | `engine.js` `onSignal` | **reverted** — `c54ae7e` |

**The reverted change, and why.** Introduced by `aa746ad`. It collapses two distinct events into one
word in `runs.log`: `spike/test/q0006-engine.js:184` already asserts `aborted` for a gate abort, so
after the rename a keyboard interrupt and a human answering "abort" are indistinguishable in the
audit trail. The 2026-08-22 decision names four enforced terminal outcomes and `interrupted` is one
of them. Decided by the maintainer as OQ-5 at the requirements gate, and reverted as a separate
commit rather than inside the merge, because AC-3 requires the choice be explicit and forbids it
changing "by conflict resolution" — a merge commit quietly differing from both parents is what that
clause exists to prevent. Q-0011's `run-manifest.schema.json` accepts both words, which is exactly
why this would otherwise have landed unnoticed.

**The preflight is worth calling out** as the mechanism M1's empty-diff finding asked for: it means
no adapter can be billed before a bad ref or an empty review range is discovered. It also composes
with `readOnlyBacklog` from AC-8 — a `--dry` run now validates every `input.diff` range while being
unable to write anything.

## Verification

Run on `main` at `b172797fa4a17d3e4943a0afd6d3075f9b5962f7`, after both landings:

```
git merge-base --is-ancestor harness/Q-0006/integration main   # exit 0 — contained
node spike/test/run.js                                          # ✓ all 5 test files passed
node spike/bin/harness.js lint                                  # ✓ all six flows
node spike/bin/harness.js adapters --probe                      # ✓ both logins verified
```

`spike/test/q0006-engine.js` passes unmodified, as AC-3 requires. Baseline for comparison: the same
suite on `main` at `1f37200`, before either landing, passed 3 test files — the two `q0034-*.js` files
arrived with the second landing, so 3 → 5 is expected and no pre-existing failure was masked.

**Not yet done for AC-6:** the workspace CI job (`pnpm install --frozen-lockfile && pnpm lint &&
pnpm typecheck && pnpm test`) has not been run against this tree. Only the spike suite has. That
belongs with Q-0011's landing, when both jobs are exercised together.
