# Q-0101 — implement, run 2, iteration 2

*Revision round. Three findings from `review/chore/run-2/chore-iter-1.md`: one blocker on GO-5's
measurement, two majors on `packages/cli/src/failure-paths.test.ts`. Both majors are fixed and each
is demonstrated red before green. The blocker is **half discharged and half refused**, and the
refusal is about what this step is permitted to do rather than about what it chose to do — §2 says
so with the commands and their exact responses.*

**One file changed**, `packages/cli/src/failure-paths.test.ts`, +115 −10. No product source, no new
dependency, nothing under `spike/`, `harness/`, `backlog/` or `docs/`. The suite goes 32 → 34 tests
and `@quorum/cli` 543 → 545.

---

## 1. The two majors

### 1.1 `failure-paths.test.ts:72` — R-6's refusal reads the platform's name, not `sh`

**The finding is correct and the defect is the one it names.** §3 R-6 says the suite *"refuses on a
platform without `sh` rather than skipping"*, and what I wrote tested `process.platform === 'win32'`.
That is a proxy, and it is wrong in **both** directions: it admits a Unix-like machine whose `sh` is
absent, stubbed or unusable — which then fails somewhere in the six fixtures with a command error
that reads like a product defect — and it refuses a Windows machine that has a working shell. Every
fixture in the file points `commands.install` at `sh -c "exit 0"` and two of them write flows whose
`run_tests` is an `sh -c` chain, so *`sh` executing a `-c` argument* is the property, and the
platform's name is not it.

**What shipped.** `shellRefusal(shell)` at module scope runs `sh -c 'exit 7'` and returns a string
naming why the answer is no, or `null`. Four returns, one per way it can fail: the spawn throws, the
spawn reports an error (`ENOENT` — the reviewer's case), the process is killed by a signal, or it
returns a status that is not the one asked for. The module-scope `throw` is unchanged in shape and
keeps the sentence the existing R-6 assertion pins.

**`exit 7` rather than `exit 0`, and that is the load-bearing choice.** A binary that starts, ignores
its argument and exits 0 satisfies a probe asking for zero, and it is precisely what a machine with a
stub `sh` on its `PATH` has. Asking for an arbitrary status makes the answer a measurement of the
*shell* rather than of the file's existence. The probe carries its own 10 s timeout so a wedged shell
refuses collection instead of hanging it.

**Shown red twice, because the two halves fail differently.**

*(a) The refusal fires when the shell is genuinely unavailable.* With `SHELL` aimed at
`sh-that-is-not-installed`, the file **fails to collect** — `0 test`, `Test Files 1 failed` — with:

```
Error: the failure-path fixtures drive sh-based commands.install and sh -c run_tests chains,
and on darwin `sh-that-is-not-installed -c` could not be executed
(spawnSync sh-that-is-not-installed ENOENT) —
this suite refuses rather than reporting a pass over rollbacks it never ran
```

That is the reviewer's scenario reproduced: a machine that is not Windows and has no usable `sh` now
stops, named, instead of proceeding.

*(b) The regression to the reviewed defect is caught.* Restoring
`const SHELL_REFUSAL = process.platform === 'win32' ? … : null` fails the new test with *"the
platform name decides the refusal again: expected '/\*\*\n \* Q-0101 …' not to contain
'process.platform ==='"*.

**Why the new test has four clauses rather than one.** Three are behavioural — the probe must not
refuse a machine that has a subject (`sh` → `null`), must refuse one that cannot spawn the shell
(absent name → a refusal quoting it), and must refuse a binary that starts and does not interpret
`-c` (`process.execPath`, since `node -c <arg>` reads its argument as a filename to syntax-check).
The fourth is the source scan above. It is there because mutation (b) leaves **all three behavioural
clauses green**: a platform comparison reintroduced *beside* a working `shellRefusal` is invisible to
them, so the only thing that catches the return is a clause about how the decision is taken. The
needle is built with the file's existing `assembled()` helper so forbidding it costs no
self-exclusion — the shape *"a check is not established by reading it"* (2026-08-29) asks for.

### 1.2 `failure-paths.test.ts:676` — `cannot sync .* with ` is satisfied by any two subjects

**Correct, and it is the sharper of the two findings** because the criterion is about *attribution*.
AC-7(b1)(b) requires the output to name **the two branches that disagree**; `/cannot sync .* with /`
is satisfied by any two subjects, by the two the wrong way round, and — since `.*` matches empty — by
a diagnostic naming neither. A run whose message sent a maintainer to the wrong branch would have
passed it. That is this ticket's own subject arriving inside one of its assertions, which is the
third time this file has produced that shape.

**Measured before it was written.** `packages/core/src/engine/composite.ts:279` is

```ts
`${stepId}: cannot sync ${into} with ${base} — ${mergeFailure(merged)}.\n`
```

so `into` and `base` are **two arguments of one template**, and the way a wrong attribution actually
looks is a **swap**. `NAMES_BOTH` is therefore built from the two fixture constants —
`cannot sync harness/T-0001/integration with main\b` — pinning each name in its own position rather
than requiring both to be present somewhere, which an `.*` between them would still satisfy in either
order. `literal()` escapes regexp metacharacters so a later branch name cannot silently stop pinning
itself; neither current name carries one. `\b` rather than the em dash, so the clause does not pin a
byte of the message (Q-0094 E-1).

**Shown red twice, and the second is what proves it reads the run.**

| mutation | what went red |
| --- | --- |
| `NAMES_BOTH` → `/cannot sync .* with /` (the reviewed form) | *"the two branches the wrong way round satisfy the clause: expected true to be false"* — 1 failed, 33 passed |
| `NAMES_BOTH` with the two names **swapped** | *"the diagnostic does not name the ticket branch and the base, in that order: expected '· run #1  flow=base-clash …' to match /cannot sync main with harness\…/"* **and** the discrimination clause — 2 failed, 32 passed |

The second mutation is the one that matters: it turns the assertion over the **real spawned output**
red, so the clause is reading what the binary printed rather than being satisfied by construction.

A companion test states the discrimination positively — the sentence the product prints matches, the
reversed one does not, and one naming neither does not. That is the check on the check, and it is
what fails first if anyone widens the pattern again.

---

## 2. The blocker — GO-5, and the half I cannot take

**The finding is right about round 1.** That report substituted a measurement from different commits
for the base sample and admitted it had lost the failing files for its one branch failure. Both are
real defects and neither is defended here.

### 2.1 What I measured: 16 sweeps at the implement tip, fully captured, 0 failures

`pnpm sweep:git-identity` — `bash .github/scripts/git-identity-sweep.sh`, the entry point both CI
jobs use — run **16 times** at the implement tip in this linked worktree, each redirected whole to
its own log with `> tip-NN.log 2>&1`, on darwin 25.3.0 / 16 cores.

```
runs 1–16   exit 0   ·   16/16 carry "git-identity sweep: both suites executed and green
                          with no resolvable git identity"
failures    0/16     ·   no log contains "::error::git-identity sweep failed in phase"
```

Every run executed both suites rather than replaying one: spike **19/19 test files**, workspace
**7/7 tasks** with `--force`, `@quorum/cli` 545, `@quorum/core` 1328 (+2 skipped), `@quorum/shared`
150, and the three stubs 1 each. Workspace-suite wall time 56.1 s – 66.7 s, one run at 1m6.7s and the
rest inside 60 s.

**The failing-files column is empty because nothing failed**, and the oracle for that is the script's
own `fail()` line, not a text search: `grep -E "FAIL|RED"` matches **three** lines in a *green* log —
a spike scenario literally named *"a genuine assertion failure is still red: FAIL test/review.test.js"*
and two `@quorum/core` test titles containing `FAILS` and `FAILED`. Round 1's capture would have had
the same problem had it been parsed that way. The capture is in place; the sample simply did not
reproduce.

**Pooled with round 1, this branch stands at 1 failure in 24 sweeps** — its 1/8 and this round's
0/16, same machine, same linked worktree, trees differing only by this round's 115 added assertion
lines.

### 2.2 What I cannot take: a sample at `edcc7ad`, and exactly why

The merge base is `edcc7ad81f75c8f9edc2583848d0d5a3aa4cd32c`, confirmed with `git merge-base HEAD
main`; it is also `main`'s tip. Taking a sample there needs that commit as a runnable checkout.
**Every mechanism for producing one was refused**, and this is a permission fact rather than a
judgement:

| attempted | response |
| --- | --- |
| `mkdir -p /tmp/q0101-sweep/base` | *blocked* — "Claude Code may only create directories in the allowed working directories for this session" |
| `git clone --no-hardlinks … .harness/q0101-sweep/base` | "This command requires approval" |
| `git worktree add --detach .harness/q0101-sweep/base edcc7ad…` | "This command requires approval" |
| `git checkout HEAD -- packages/cli/src/run.test.ts` (a no-op probe on a clean tree) | "This command requires approval" |
| `git -C /Users/…/quorum status --short` | "This command requires approval" |

`.claude/settings.json`'s allow-list carries five git entries — `git status*`, `git diff*`,
`git log*`, `git branch*`, `git worktree list*` — all read-only. **No implement step under this
configuration can materialise a second commit's checkout.** This session is non-interactive, so a
command needing approval fails rather than asking.

**Three further reasons, each independent of the permissions, so the gate does not fix this by
widening one line:**

1. **The main checkout is the user's working tree.** It happens to be at `edcc7ad`, so it looks like
   the obvious host — but the sweep's install phase runs `npm ci` in `spike/`, which deletes and
   reinstalls `spike/node_modules`. `harness/rules.md`: *"Never write to the user's working tree from
   a flow."* Sixteen of those is not this step's act to take even if it were permitted.
2. **An in-place tree flip is unsound, not merely risky.** Reverting the five modified files with
   `Write` and deleting the new suite leaves that suite **in the index**, because no index-writing
   command is available. `git ls-files --cached --others --exclude-standard` is read by
   `turbo-inputs.test.ts:361`, `frame.source.test.ts:927`, `build.test.ts:241` and
   `templates.test.ts:253`, so the sample would go red on a file that is not on disk — a red for an
   artificial reason, which is worse than no sample and would read like a real one.
3. **Extracting the tree with `git archive` does not help.** A copy under `.harness/` is not a git
   repository, and the sweep's `git rev-parse --show-toplevel` climbs out of it to *this* worktree —
   so it would measure the tip while appearing to measure the base.

Per **GO-3** an implement step has no `blocked` verdict, and the window for an erratum is a gate. So
this is prose, deliberately, and it is the eleventh-or-so instance of a loop handed work no step on
its route can perform — here through a **gate obligation** rather than through a criterion, and with
the environment as the cause, which is Q-0038's precedent exactly: *"the fix was to the environment,
not to the criterion."*

### 2.3 Two measurements that bear on whether the base sample would say anything

Both were taken because I could take them, and both change the picture the requirement was written
against.

**(a) `e47fb1d..edcc7ad` is three commits touching exactly two files.**

```
 .gitignore                              |  8 +++
 backlog/Q-0102-…/ticket.md              | 62 +++++++++++++++++++++-
```

No file under `packages/`, `spike/`, `.github/` or `harness/` differs. So the existing 25-sweep
sample sits very close to the merge base — **and the reviewer was still right to refuse the
substitution**, for a reason round 1 did not identify: `.gitignore` **is** read, through the
inventory `turbo-inputs.test.ts` and `frame.source.test.ts` both derive from `git ls-files --cached
--others --exclude-standard`. Whether the eight added lines change that inventory depends on whether
`AGENTS.md`, `GEMINI.md`, `.codex/` or `.agents/` exist on disk. In this worktree **none of the four
does**, so the two inventories are identical here; in a checkout where an agent's CLI has written
one, they are not. Which is itself an instance of *"a test's verdict is a property of the commit,
not of the checkout"* (2026-08-30) — the distance between those two commits is a property of the
checkout you measure it in.

**(b) GO-5's premise moved after the requirement was merged, and nobody has read the newer
measurement into this ticket.** Commit `3cf345c` — *"Q-0102 — 25 sweeps, 0 failures, and the commit
is exonerated"* — landed at 21:19 on 2026-09-04, **after** the requirement was merged at `e47fb1d`
and before this branch. Read rather than cited second-hand, it records:

```
idle, e47fb1d, populated working checkout ........ 11 runs, all exit 0, 105-110s
48 CPU burners on 16 cores, e47fb1d, populated ...  1 run,  exit 0, 162s (1.5x slower)
concurrent second forced suite, e47fb1d ..........  1 run,  both exit 0
idle, e47fb1d, bare fresh clone ..................  7 runs, all exit 0, 109-132s
idle, bb8e143, bare fresh clone ..................  5 runs, all exit 0, 109-112s
```

and concludes **"the red is not a property of the tree"**, with `bb8e143` — the commit §7 R-1 names
as the suspect — positively exonerated 5/5 in CI's bare cell. It also closes two mechanisms:
cross-file fixture deletion is impossible (`packages/core/test/repo.ts:15` scopes its temp list per
module and Vitest isolates per file), and CPU contention alone is insufficient, having slowed the
suite by half without turning it red.

That is the variable GO-5's base-vs-tip comparison is aimed at, already measured and already found
not to be causal. My 16 non-reproductions extend the same result to this branch's tree. **I am not
offering this as a reason the base sample is unnecessary** — that is the gate's call, not mine, and
§7 R-1 is explicit that reshaping this ticket around the flake is the wrong move. I am reporting that
the obligation's stated premise is one commit out of date.

### 2.4 What the gate can do in one command

The main checkout is already at `edcc7ad`. Completing the comparison costs sixteen invocations of
`pnpm sweep:git-identity` there, in the same populated-working-checkout shape as my sixteen. If the
gate wants the CI-shaped cell instead, `3cf345c`'s method — a bare fresh clone with both directories
asserted absent before and after each run — is the one to copy, and it is already written down.

**Caveats on my own sample, stated rather than buried.** One machine, 16 cores, darwin, warm pnpm
store, against CI's two-core `ubuntu-latest`. A **linked worktree**, which is a third checkout shape
beside `3cf345c`'s two. `.harness/q0101-sweep/` existed while the sixteen ran and was removed
afterwards; the forced suite was re-run green in both rows, so it is not a confound in the verdict
(§4). And 0/16 bounds a rate without explaining a mechanism — Q-0102's surviving lead, no configured
`testTimeout` against `worktree-lifecycle.test.ts`'s 18 synchronous git spawns, is untouched by it.

**Nothing was fixed and nothing was weakened** (non-goal 5, Q-0102's GO-2).

---

## 3. File by file

**`packages/cli/src/failure-paths.test.ts`** — the only file changed, +115 −10.

- **Header, lines 56–61.** The *"POSIX only"* paragraph becomes *"It needs `sh`"* and states that the
  refusal is decided by running the shell rather than by reading the platform's name, with the
  two-directions argument in place. The claim it made before was false of the code beneath it.
- **Module scope, replacing the `win32` block.** `SHELL`, `SHELL_PROBE_STATUS`,
  `SHELL_PROBE_TIMEOUT_MS`, `shellRefusal()`, and the `throw` rebuilt around its result. The
  refusal sentence the existing R-6 assertion pins is kept **contiguous** in the source, so that
  assertion still has its subject after the message gained an interpolation.
- **Constants, after `INTEGRATION`.** `literal()` and `NAMES_BOTH`, built from `INTEGRATION` and
  `BASE_BRANCH` so renaming a fixture branch cannot leave the clause green on the old name.
- **AC-7(b1) (b)/(c).** `NAMES_BOTH` replaces `/cannot sync .* with /`, with a failure message
  naming the order, and the comment records what the old form admitted.
- **AC-7(b1), new test.** The swap/empty discrimination, three clauses.
- **§3 R-6, existing test.** Renamed *"platform"* → *"machine"*, since the subject is no longer a
  platform. Body unchanged.
- **§3 R-6, new test.** The four clauses of §1.1.

## 4. What I deliberately left alone

1. **Every criterion outside the three findings.** Round 1's thirteen are untouched; this round adds
   two tests and changes one assertion. Nothing was tidied in passing.
2. **The `STEERING` duplication** raised for ruling in round 1's §5(2) is unchanged and still wants
   a gate answer. No reviewer disputed it.
3. **The pre-existing lint warning** at `packages/core/src/backlog/backlog.ts:276` — *"Unused
   eslint-disable directive"* — in a file this ticket does not change. Reported again, not fixed.
4. **Q-0100's instances**, reproduced verbatim wherever the product prints them (ground rule 3,
   non-goal 6).
5. **`.harness/q0101-sweep/`**, the gitignored scratch directory the 16 logs were captured into,
   **removed** — logs, directory and the parent `.harness/` it created. `git status --short` carries
   exactly one entry, the changed test file. Its existence during the sweeps and its absence
   afterwards are the two environment rows of §5.

## 5. Verification

Dependencies were already installed in this worktree; `pnpm install --frozen-lockfile` reports
*"Already up to date"* in 194 ms.

Forced, **in both environment rows**, per *"Integrate's tick is worktree-scoped"* — first with
`.harness/` present (the sixteen sweeps and one forced run), then with `.harness/` and `.quorum/`
both absent, which is the row a fresh worktree and a CI clone have:

```
pnpm turbo run test lint typecheck --force  →  21 successful, 21 total, 0 cached   (56.8s)
  @quorum/cli     545 tests      @quorum/core  1328 passed, 2 skipped
  @quorum/shared  150 tests      server/compiler/web  1 each
npm test --prefix spike                     →  all 19 test files passed
node spike/bin/harness.js lint              →  6/6 flows ✓
pnpm sweep:git-identity  × 16               →  16/16 exit 0, 0 failures
```

`src/failure-paths.test.ts` alone: **34 passed**, 5.8 s.

Four mutations, each shown red and each restored — the two of §1.2, and the two of §1.1. Their exact
failing messages are quoted above rather than summarised, because *a check is not established by
reading it*.

## 6. For the gate

1. **The base half of GO-5 is not discharged**, and §2.2 is why: the sandbox permits no mechanism for
   producing a checkout at `edcc7ad`, and the one host that already is at that commit is the user's
   working tree, which the rules forbid a flow from writing to. §2.4 is the one-command completion.
2. **GO-5's premise is one commit out of date** (§2.3(b)). `3cf345c` measured 25 sweeps and concluded
   the red is not a property of the tree, exonerating the commit §7 R-1 names as the suspect. Whether
   a base-vs-tip tree comparison is still worth taking is the gate's call.
3. **The `STEERING` duplication** (round 1 §5(2)) is still open for ruling.
4. **The permission gap is worth fixing at the environment, not at the criterion** — Q-0038's
   precedent. A gate obligation that asks an implement step for a measurement across two commits
   cannot be satisfied while `.claude/settings.json` grants read-only git; the honest options are to
   grant the step a way to produce a second checkout, or to move that class of obligation to the
   human at the gate, where it already sits for decision entries.
