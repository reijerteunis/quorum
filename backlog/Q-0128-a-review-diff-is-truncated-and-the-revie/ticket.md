---
id: Q-0128
title: A review diff is truncated, and the reviewer is handed a fraction of the change
stage: draft
owner: ruud
repos: []
branch: harness/Q-0128/integration
priority: p2
created: 2026-09-16
iterations: {}
history: []
---
Decide what a review step does when the change exceeds repo.max_diff_bytes, measured across five tickets where the reviewer reported no findings in bytes it never received.

## What happens

`materialiseDiff` caps a review's diff at `repo.max_diff_bytes` (default 200,000,
`packages/core/src/engine/diff.ts:372`) and truncates **head-only** — it keeps the first N bytes of
`git diff` output and drops the tail. Because `git diff` emits whole file patches in path order,
what is lost is not a uniform thinning of the change: it is **every patch for the last files
alphabetically, entirely**. The reviewer is not told it is reading a fraction; it simply never sees
those files, and its prompt ends mid-hunk.

## Measured, rather than asserted

Ten truncation events across three tickets in this session — Q-0124 (3), Q-0126 (4), Q-0017 (3).
Q-0122 and Q-0125 had none, so this is **not** every chore run; it is a function of change size, and
the threshold sits close to where this repository's larger tickets land.

Only Q-0017's three carry the omitted-file names, because the enrichment that names them landed
between those runs — which is itself the evidence that the fix was worth making:

| round | full diff | kept | share seen | files with **no** patch |
| --- | --- | --- | --- | --- |
| 1 | 238,548 B | 200,000 B | 83.8% | 6 |
| 2 | 252,032 B | 200,000 B | 79.4% | 8 |
| 3 | 259,956 B | 200,000 B | 76.9% | 9 |

**The hidden set grew as the loop ran** — 6 → 8 → 9 — so the longer a revise loop converges, the
less of it each successive reviewer sees. That is the opposite of what a bounded loop needs.

**The sharpest single measurement**: all three of Q-0017's reviews reported no findings in the
omitted files, and a single hand pass over those same files afterwards found three, one of which was
a test that does not check what it is named for. A reviewer reporting nothing in bytes it never
received is *"a check that skips its subject must not report success"* (2026-08-25) at the review
step — the rule this repository has now applied to preflights, guards, fixtures and ticks, arriving
at the one place that decides whether a change is sound.

## What is already done, so the successor does not redo it

Since the Q-0017 session the engine **warns and names what it dropped**: one `warn` event and one
`runs.log` line per truncation carrying the range, the limit, the kept and full byte counts, and
either the omitted file list or `every file has some patch and the last one is cut short`.
`diff.test.ts` AC-9.5 counts materialisations off the `diff truncated range=` token, so that token is
load-bearing and must survive any rewrite. **The gap that remains is not disclosure. It is that the
reviewer still does not get the bytes.**

## What it must decide

1. **Raise, page, or select.** A larger cap moves the threshold and does not remove it; paging the
   diff across several review calls changes the panel's shape and its cost; selecting by relevance
   needs an oracle this product does not have. Measure the real distribution first — the three rows
   above are one ticket, and the cap has existed since the spike.
2. **Whether a truncated diff may yield `approve` at all.** The cheapest sound answer may be that it
   may not: a review that could not see the change is a gate, not a verdict — the shape
   *"A refused finding is a gate, not another round"* (2026-08-31) already uses. This is the option
   to price first, because it needs no new mechanism.
3. **Head-only is the wrong tail to drop, and something better may be free.** Whole-file patches in
   path order mean a file's fate is decided by its name. Per-file budgeting would at least give every
   file some patch, which is what the fallback message already distinguishes.
4. **Whether the panel's members should be cut identically.** Q-0038 AC-10 requires every panel
   member to receive identical bytes; any per-member selection contradicts it and needs that entry
   answered rather than sidestepped.

## Non-goals

Q-0076's run-history cap, which is a different subject on different artifacts and measured
separately. Changing what `integrate` does. Any change to the `diff truncated range=` token without
re-aiming `diff.test.ts` AC-9.5 and showing it red first.

## Why it is not urgent, and why it is not p3 either

Nothing is silently wrong today: every truncation is warned, logged and named, so a reader can see
what a reviewer missed. What is wrong is that they must, and that three reviews in a row reported
clean over bytes they never had. p2 — behind the screens M3 owes and ahead of the latent registrations.
