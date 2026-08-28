# Q-0073 — errata to `requirements/merged.md`

Amendments to the merged requirement, decided at or after its gate and binding on the implementer
and the reviewer alike. Each names the clause it supersedes. The rest of `merged.md` stands.

## E-1 — the inventory is turbo's hashable set, not the tracked set — 2026-08-28

**Supersedes** §4's *"Repository membership is decided from the git-tracked set"* and OQ-1's
recommendation of `git ls-files`, and bounds AC-1's *"or an equivalent working-filesystem probe"*.

**The amendment.** The single inventory AC-1 requires is

    git ls-files --cached --others --exclude-standard

— tracked files, plus untracked files git does not ignore. A literal is a repository path when that
set contains it or contains something below it; it is a directory when the set contains something
below it. `--others` enumerates the working tree, and **AC-1 does not forbid it**: what AC-1 forbids
is deciding membership from whether a path happens to be present, and this command decides it from
what git will hand turbo. AC-3's two inventories still differ only in what an untracked working
tree can add *and git ignores*, which is where all three known instances live.

**Why, measured rather than argued.** The guard exists to decide whether a path a suite names is
covered by a declaration, and a declaration can only cover what turbo hashes. So the question is
*what does turbo hash?* — asked directly, three probes over `turbo run test --filter @quorum/shared
--dry=json`'s reported task hash, each adding one file to `packages/shared/src`:

| file added | git state | task hash |
| --- | --- | --- |
| — | — | `6a050a11faef7c37` |
| `zz-probe.txt` | untracked, **not** ignored | `f27ff86727de2f29` — **moved** |
| `zz-probe.log` | untracked, ignored by `*.log` | `6a050a11faef7c37` — unchanged |

Turbo hashes tracked **and** untracked-unignored files, and ignores gitignored ones. The tracked set
is therefore a strict subset of what turbo hashes, and a guard built on it would drop a path turbo
genuinely hashes — a real read going invisible, which is the failure the guard exists to prevent,
reintroduced by its own fix. `merged.md` risk 3 anticipates this and calls the under-collection *"the
safer half"*; that reasoning holds for a file on its way to being committed and not for one that
stays untracked and unignored, which is exactly the case where turbo would hash it and the
declaration would matter.

**The defect restated, which is what makes this the fix rather than a preference.** The guard's
question is whether a path is *hashable*; hashability is a git property; the guard asked the
filesystem. `.gitignore` lists `.harness/`, `.quorum/` and `node_modules/`, so all three divergent
literals are unhashable — no declaration could ever have covered them, and they should never have
been candidates.

**What it costs, and what it does not.** Nothing today: the tracked set and the hashable set agree
on **all 578** literal occurrences in the two audited suites, so no current verdict moves and AC-5's
no-contraction baseline is unaffected. Across three checkouts — this one with 25 worktrees and a run
history, a clean `git worktree`, and a fresh `git clone` — the predicate's decision vector hashes
`f374ec83492deb08` in all three, against a filesystem oracle that differs by 7 decisions between
them. One command, 503 entries, 9 ms.

**Why an erratum and not a review round.** `merged.md` §4 says the shape was decided in the
requirement *because the chore route has no solutioning gate*. Changing it is the same class of act
and needs the same authority; a reviewer reading §4 would be right to refuse `--others` as
unauthorised, and three correct refusals is what Q-0069 cost. Decided at Q-0073's requirements gate,
2026-08-28, on the measurement above.

**Found by:** hand measurement before the requirements run, extended after it. `merged.md`'s OQ-1
dismisses *"turbo's own enumeration"* as circular — correctly, and this is not that: it is a git
command whose result turbo happens to consume, not turbo's verdict about its own inputs.
