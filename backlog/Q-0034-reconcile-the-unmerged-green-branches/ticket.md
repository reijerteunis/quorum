---
id: Q-0034
title: Reconcile the unmerged green branches (Q-0006, Q-0011)
stage: draft
owner: ruud
repos: []
branch: harness/Q-0034/integration
priority: p1
created: 2026-08-24
iterations: {}
history: []
---
Two of M1's three tickets reached stage `green`, were paid for, and never landed on `main`.
`harness/Q-0011/integration` carries **48 commits** that `main` does not have — the whole
run-history feature the ticket was written for: `.quorum/runs/<id>/` written by the engine, the
`harness history` reader, and the per-vendor roll-up that reports money where a vendor reports
money and tokens where it does not. `harness/Q-0006/integration` carries **3**, touching
`spike/src/engine.js` and `spike/src/adapters/index.js`. Together that is roughly $88 of tested
work that no clone of this repository contains, and it is invisible from the board, which shows
both tickets as `green` and says nothing about where the code is. The gap was found on 2026-08-24
while chasing something else: `.quorum/` does not exist in the working tree, and `grep -rn
"\.quorum" spike/src spike/bin` on `main` returns nothing, because the feature that creates it was
never merged — not, as first assumed, because `.gitignore` was hiding it.

Merging is not a formality and that is why this is a ticket rather than a command. Q-0011's branch
predates Q-0033's extraction of `spike/src/lint.js`, so its diff against `main` shows that file as
deleted; a merge has to reconcile 48 commits that rewrite `engine.js` and `bin/harness.js` against
a `main` those commits never saw. Whoever does it must decide, per branch, whether to merge,
rebase, or re-derive the work as a fresh change — and Q-0011 in particular has never been through
the review flow, so landing it merits one. The ticket should also settle what `green` is supposed
to mean: today it marks a branch that integrates and passes its suite, which is not the same as
work that has shipped, and nothing in the board or the stage list distinguishes the two.

One documentation correction belongs with it, because the same investigation produced it. The M1
closing entry in `docs/DECISIONS.md` states that Q-0006's review found an empty diff *"because the
branch had been merged into `main` hours earlier"*. That is not true of the repository today:
`git diff --stat main...harness/Q-0006/integration` reports 45 insertions across two files. Either
the branch moved after that review or the diagnosis recorded at the time was wrong, and it matters
beyond the record — `materialiseDiff` in `spike/src/engine.js` hard-codes "already merged into
main" as the explanation for any empty range, so the next empty diff will be explained the same
confident way whatever actually caused it. An erratum is appended to DECISIONS.md as of
2026-08-24; the engine's diagnostic is this ticket's to fix. Belongs to M2 in
docs/06-development-plan.md.
