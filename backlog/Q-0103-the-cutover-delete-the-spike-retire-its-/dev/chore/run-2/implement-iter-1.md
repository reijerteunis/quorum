# Q-0103 — implement report, run 2, iteration 1

**Child C only**, per `requirements/errata.md` E-1: AC-20 to AC-28 and nothing else. Children A
(Q-0106) and B (Q-0107) shipped; nothing in AC-1 to AC-19 or AC-29/AC-30 was re-implemented, and
where one of them looked unsatisfied it is a finding below rather than work I did.

**Measured at the branch tip.** 54 tracked files and 9,644 lines removed under `spike/`, matching
E-1's re-measurement exactly. Outside that tree, **23 files changed: 279 insertions, 4,257
deletions.**

---

## 0. Read this first — three things for the gate

### 0.1 The suite is NOT green in this worktree, and the cause is the permission configuration

**7 tests fail here. All 7 have one cause, and it is not the change.**

`.claude/settings.json` denies `Bash(rm -rf *)` and allowlists no `git rm` and no `git add`. Plain
`rm <file>` *is* permitted, which is how the deletion was performed — file by file, then `rmdir` for
the emptied directories. What I cannot do is **stage** it. So:

```
git ls-files --cached --others --exclude-standard   →  1112 entries
git ls-files --deleted                              →    59 entries, all mine
```

59 files are absent from disk and still in the index: the 54 under `spike/`, plus
`harness/port-charter.md`, `packages/core/src/spike-parity.test.ts`,
`packages/cli/src/spike-dependencies.test.ts` and the two `port-freeze-guard` scripts. Every guard
that decides membership from git therefore still sees a tree that is not there — *"Membership is a
git question, not a filesystem one"* (2026-08-28) working exactly as designed, against an index
nobody has updated.

The seven failures, each traced to a member of that 59:

| Suite | Failures | Message |
| --- | --- | --- |
| `packages/core/src/turbo-inputs.test.ts` | 3 | `packages/core/src/fanout/fanout.test.ts: spike/src/fanout.js` — the last literal the classifier still reads as a repository path |
| `packages/cli/src/build.test.ts` | 4 (2 of them whole suites: `end-to-end`, `failure-paths`) | `corpus missing: packages/cli/src/spike-dependencies.test.ts — the isolated workspace cannot be built without it` |

`test/workspace.ts`'s copier iterates `git ls-files` and refuses on a missing file, which is right
and is why it fails loudly rather than building a half workspace.

**It resolves at the harness's own commit.** `commitAll` (`packages/core/src/fanout/fanout.ts:287`)
runs `git add -A` in the worktree before the review step reads anything, so the index the reviewer
and `integrate` see holds 1112 − 59 = 1053 entries, none of them under `spike/` and none of them
absent. I have stated this as arithmetic over three measurements rather than run it, because I
could not run it: **reporting a suite green that I did not see green is the thing `harness/rules.md`
forbids**, and this is the honest version.

Everything else is green and was executed:

- `pnpm turbo run lint typecheck --force --continue` → **14/14 tasks, 0 cached, 0 errors.** One
  pre-existing warning, `packages/core/src/backlog/backlog.ts:276` (unused `eslint-disable` for
  `no-control-regex`), in a file this change does not touch — `git diff HEAD` on it is empty. It is
  not caused by AC-23's ignore removal: removing an entry from `ignores` cannot add a warning in a
  directory that was always linted.
- `pnpm turbo run build --force` → **3/3 tasks, 0 cached**, then `pnpm exec quorum lint` →
  **6/6 flows clean.** That is the README claim AC-24 asks for, verified by executing the emit
  rather than by reading it, and it is the flow lint output the role asks me to paste.
- Baseline before any edit: `pnpm turbo run test --force --continue` → **7/7 tasks, 0 cached, 0
  failures**, so the seven above are attributable and not inherited.

### 0.2 AC-24's `CLAUDE.md` half names a surface this flow cannot write

`developer-generalist`'s `paths:` are `package.json, pnpm-workspace.yaml, turbo.json,
tsconfig*.json, .npmrc, .gitignore, .github, packages, apps, harness, docs, README.md,
eslint.config.js, vitest.shared.js`. **`CLAUDE.md` is not among them**, and the merged
requirement's own AC-6 says so in as many words: *"`CLAUDE.md` is excluded and stays the human's,
being the vendor dialect of the canonical harness."* AC-24 then names `CLAUDE.md:25,35`. The
document contradicts itself, and this is *"A requirement may not name a surface its flow cannot
write"* (2026-08-25) — Q-0069's AC-11(b) exactly, where three revise rounds refused correctly and
the human landed the wording the implementer supplied.

**I did the README half and did not touch `CLAUDE.md`.** The wording is supplied here so a gate can
land it in one commit, satisfying AC-24's clause about the two Q-0098 paths and the refused third:

> **`CLAUDE.md:25`** — delete the bullet. It reads *"Until M2 lands, the runnable code is the spike
> in `spike/` (plain Node ESM). Do not extend the spike beyond M0/M1 needs; port it into
> `packages/core` instead."* Its subject and its instruction are both gone.
>
> **`CLAUDE.md:35`** — replace
> ``- Spike (M0/M1): `node spike/bin/harness.js <init|ticket|board|run|lint|adapters>` ``
> with
> ``- Binary: `pnpm install`, `pnpm turbo run build`, then `pnpm exec quorum <init|ticket|board|run|lint|validate|runs|adapters>` in the workspace; outside it, the three tarballs packed and installed together. Registry-resolved `npx quorum` is Q-0029's, in M6.``

Until that lands, `CLAUDE.md` tells every agent the runnable code is a directory that does not
exist. It is the one part of AC-24 this run leaves open, and it is open because the flow cannot
close it, not because it was missed.

### 0.3 Two decisions outside the literal AC-20–AC-28 range, both argued and both flagged

E-1 says a criterion outside the range is a finding, not work. Neither of these is a criterion —
they are consequences of AC-20 and AC-21 that no criterion names, because the requirement was
written before the artifact existed in one case and Child A deferred it explicitly in the other.
I took them rather than shipping a red suite and a dead grant, and I am naming them so the gate can
overrule either.

**(a) `packages/cli/src/spike-dependencies.test.ts` is deleted.** Q-0107's AC-29/AC-30 register did
not exist when this requirement was written, so AC-21 names `spike-parity.test.ts` and the charter
and not it. Measured, it cannot survive the cutover in any form:

- its key set is `treeFiles()` = `git ls-files spike`, and its first assertion is
  `expect(files.length, 'the tree the cutover deletes').toBeGreaterThan(40)`;
- `stale(treeFiles())` would report **every** `DISPOSITIONS` subject once the tree is empty;
- its `EXCLUSIONS` require each registered site to still be a site, and the two it calls *"kept as
  tripwires for Q-0103"* — `packages/core/turbo.json`'s `spike/test/**` input and `CI_JOBS`' spike
  row — are both removed by AC-17's completion and AC-22.

So it is red in every direction, and its AC-30 half — *"no file under `packages/**` reads anything
under `spike/`"* — becomes a guard forbidding a literal that names a directory which cannot exist:
the class AC-12 was written to refuse. The authority is **AC-27** (it is a live test depending on
paths under `spike/`), **AC-21**'s *"no replacement … or port register is introduced"*, and *"A
check outlives its subject only if it can still fail"* (2026-09-05). It is a port register whose
subject is the port.

**(b) The `spike` write-path grant is retired.** `harness/roles/developer-generalist.md` said, in
prose Q-0106 wrote: *"`spike` is still granted on purpose, and **Q-0103 is what retires it**."* That
is an obligation handed to this ticket by a shipped sibling, and AC-27 covers it — a role's `paths:`
frontmatter is a live configuration entry naming a path under `spike/`, and
`packages/cli/templates/harness/roles/` already dropped it at Q-0106 so an adopter is not granted a
directory they never had. Removing it from the role file forces the matching row in
`harness/architecture.md`, because Q-0107's AC-18 guard (`role.test.ts`) compares the table's third
column against every role's frontmatter and requires the prose to name each granted directory. Both
sides moved together; `role.test.ts` is green.

---

## 1. What the criteria asked for, and what happened

### AC-20 — `spike/` is deleted

54 tracked files removed, plus the emptied directories (`bin`, `src`, `src/adapters`, `templates`
and its three subdirectories, `test`, and the root). `ls -d spike` → *No such file or directory*.
The criterion's test is `git ls-files spike` returning nothing; it returns 54 here and will return
nothing after the harness stages, for §0.1's reason. The working-tree measurement that stands in
for it now is `git status --short spike` → 54 deletions, and `git ls-files --deleted spike` → 54.

Done with plain `rm` in five batches, because `git rm` needs an approval this non-interactive run
cannot give and `rm -rf` is on the deny list. **I did not route around either.** `pnpm exec` is
allowlisted and could have deleted the tree through a Node one-liner; using a package-manager grant
to perform a deletion the narrower rules refuse is not a thing to do quietly, so I did not do it,
and the residue is §0.1's staging gap rather than a bypass.

### AC-21 — the parity register and the charter

`packages/core/src/spike-parity.test.ts` (1,994 lines) and `harness/port-charter.md` (516) deleted;
both figures match E-1. No replacement parity test, inventory, freeze SHA, mirror procedure or port
register introduced — and §0.3(a) deletes a third one rather than adding any.

### AC-22 — the workflow, the scripts, and the register

**Caller inventory, performed before deletion as the criterion requires.** `git grep` over tracked
files for `port-freeze-guard.sh` and `port-freeze-guard.test.mjs`:

| Caller | Disposition |
| --- | --- |
| `ci.yml:57`, `:83`, `:101` — `bash …/port-freeze-guard.sh` | inside the three retired jobs |
| `ci.yml:64` — `node …/port-freeze-guard.test.mjs` | inside `port-freeze-policy`, retired |
| `port-freeze-guard.test.mjs:20,34,43` | the guard's own suite, deleted with it |
| `spike/test/q0070-capture.js:19` | prose, inside the deleted tree |
| `docs/06-development-plan.md`, `harness/port-charter.md`, `packages/core/src/test-command.test.ts` | prose and job names, not invocations |

**No other surviving caller**, so implementation was not stopped. This also confirms the merged
requirement's §3.4(b) correction: `ci.yml:64` did execute that suite, and the ticket body's OQ-3
(*"nothing executes it"*) was stale. Both scripts deleted (185 + 187 lines).

**`ci.yml`: seven jobs → three** — `workspace`, `git-identity-sweep-bare`,
`git-identity-sweep-populated`. 101 lines removed. Their commands, cache policy, forced execution
and the bare/populated hostile-environment checks are byte-unchanged; the one other edit is one
word, *"a further full run of both suites"* → *"of the suite"*, which my own deletion falsified.

**`packages/core/src/test-command.test.ts` — the register, and this is where AC-22's test clause
lives.** `CI_JOBS` is three rows. Four changes, each named rather than absorbed:

1. A new `RETIRED_BY_THE_CUTOVER` register naming the four ids and what each stops being able to
   claim, so the contraction fails with the four names in its message rather than with two sorted
   lists — Q-0073's *a count is not an identity*, applied to a removal.
2. `BEFORE_THE_CUTOVER`, a seven-job fixture, replaces `WITHOUT_SPIKE`. The register is **shown red
   against it** in the shipped suite: the fixture's job set is asserted unequal to the register's,
   and the difference asserted to be exactly the four retired ids.
3. `WITHOUT_A_SWEEP_CELL` keeps the other direction — a workflow short of a job the register still
   names — and the Q-0054 `?? []` defect exhibition is **re-aimed onto
   `git-identity-sweep-populated`** rather than deleted, because the demonstration is of the shape
   and needs a live job to be about.
4. The `if:` count goes 1 → 0 with the exemption's reasoning rewritten: `port-freeze-sha` was the
   one conditioned job and it is gone, so no job is conditioned at all.

Also removed: the clause reading the `spike` job's steps to assert it configured no ambient
identity. Its subject is a job that no longer exists and a job that does not exist cannot configure
one, so it could only ever pass — recorded in place under the 2026-09-05 decision rather than
silently dropped.

**Mutation-probed rather than read.** Restoring a `spike` row to `CI_JOBS` and re-running turns
**three** assertions red — the job-set equality, the per-job steps check, and the
`BEFORE_THE_CUTOVER` comparison — with `Error: the workflow declares no 'spike' job with steps`.
Probe reverted; the three-job register is what shipped, and `test-command.test.ts` is green (31
tests).

### AC-23 — ESLint and Vitest

`eslint.config.js`: `'spike/**'` out of `ignores`, the Q-0009 paragraph explaining it deleted. The
configured file scope (`packages/**/*.ts`, `apps/**/*.ts`) and all four rules are untouched, and
lint is 0 errors. **No new violation appears from the removal, and it could not**: nothing was
under the removed pattern.

`vitest.shared.js`: the citation of the spike runner's header is **reworded, not deleted**, as the
criterion requires — the discovery argument is live and `test-discovery.test.ts` enforces it, so the
reasoning survives its source. No include narrowed; `dist/**` exclusion untouched.

### AC-24 — `README.md` and `CLAUDE.md`

`README.md:8` now names the binary and the workspace-local path, verified by execution (§0.1).
`CLAUDE.md` is §0.2's finding.

### AC-25 — `docs/04-architecture.md`

The testing strategy describes **one** required suite, what it proves, and where the mock end-to-end
through the binary now lives (`packages/cli/src/end-to-end.test.ts`, `src/failure-paths.test.ts`).
The two-suite paragraph, the transfer share and the `spike-parity.test.ts` sentence are gone, with
one sentence saying why nothing replaces the register. Three further paragraphs my own edit
falsified are corrected in the same change: the discovery chain, which cited the spike runner as the
origin of a property the workspace now owns; the cache-hit paragraph, which said *"both real
suites"*; and the sweep paragraph, which said CI still ran the second one. `## Run history on disk`
says `core` where it said the spike. Status line bumped with the date and what changed.

**Deliberately not rewritten**, and the status line says so: `packages/core` is still *"seeded from
the spike"* and `packages/cli` still dispatches *"the whole of the spike's set"*. Those are
provenance and stay true of a tree that has gone.

### AC-26 — `docs/06-development-plan.md` and the pin that moves with it

M2's done-when reads one suite, names where the binary half landed (Q-0095, Q-0101), and records
that the transfer share went with the register that re-derived it — *"a measurement of how much work
was left rather than a property of the workspace"*. Q-0010 §5's follow-up is recorded as done in the
two places the plan said it was not: Q-0009's **What is not done** paragraph, and Q-0010's second
inherited obligation. Status line bumped.

**`docs.test.ts:422`'s literal pin moved in the same change**, as the criterion requires — it pinned
``· `packages/cli` wraps core with the spike's commands`` and now pins ``· `packages/cli` dispatches
all eight commands the spike had``, with a comment saying what the pin is for so the next reader
does not think it is a claim about the CLI. Editing the sentence without moving the pin turns
`@quorum/shared` red; the shared suite is 143/143.

### AC-27 — the residual sweep

`git grep -E "spike/|port-charter|port-freeze"` over tracked files, excluding `backlog/`,
`docs/decisions/`, `contracts/` and the two history documents:

- **`harness/`** — one hit, a past-tense sentence I wrote in `developer-generalist.md`. Clean.
- **`.github/`** — two past-tense comments in `git-identity-sweep.sh`, both rewritten because my CI
  edit falsified them (they said the spike job still ran the suite). Clean.
- **root configuration** (`package.json`, `turbo.json`, `tsconfig.base.json`,
  `pnpm-workspace.yaml`, `eslint.config.js`, `vitest.shared.js`, `.gitignore`, `README.md`) —
  nothing. Clean.
- **`packages/`, `apps/`** — no file opens or imports anything under the deleted tree.
  `git grep -E "repoFile\('spike|readFileSync\(...spike|from '...spike"` returns one hit and it is a
  JSDoc sentence. The remaining mentions are the citation class §7 registers as a separate ticket.

**Four live references survive and three of them are outside this role's write paths.** Reported,
not edited:

| Where | What | Why not fixed |
| --- | --- | --- |
| `.claude/settings.json:8,10` | `Bash(npm install --prefix spike*)`, `Bash(node spike/*)` | `.claude/` is not in this role's paths; it is also the file whose gaps produced §0.1 |
| `.claude/agents/flow-author.md:6` | instructs an agent to run `node spike/bin/harness.js lint` | same, and the `quorum lint` alternative is already in the sentence |
| `.claude/rules/engineering.md:4` | *"`spike/**` is outside ESLint's scope"* | a **derived copy** — *"`.claude/rules/` is a derived copy, not a surface a requirement may name"* (2026-08-27). `harness/rules.md`, the canonical file, was corrected by Q-0106 and carries no `spike` |
| `docs/02-sdlc-pipeline-spec.md:564` | *"**Both engines** choose an `integrate` step's content …"*, citing `spike/src/engine.js:1241` | present-tense and now false — there is one engine. **No criterion names this document**: AC-25 and AC-26 name 04 and 06, and §3.6's list of omitted surfaces does not include 02. Flagged rather than taken, per E-1 |

### AC-28 — exit condition

Not an implement-step criterion, per E-1: it requires CI green on the merged commit, which no step
of this run can observe. Discharged at the gate. `main` being 89 commits ahead of `origin/main` is
Q-0105's subject and is the reason this matters more than usual.

---

## 2. File by file

**Deleted (59).** `spike/` (54). `packages/core/src/spike-parity.test.ts` (1,994).
`harness/port-charter.md` (516). `.github/scripts/port-freeze-guard.sh` (185) and
`port-freeze-guard.test.mjs` (187). `packages/cli/src/spike-dependencies.test.ts` (1,067) — §0.3(a).

**`.github/workflows/ci.yml`** — four jobs and their comment blocks removed (−101). One word in the
sweep comment.

**`.github/scripts/git-identity-sweep.sh`** — two comments, both saying CI still ran the second
suite. The five-phase list, the probes and every command are untouched, so `test-command.test.ts`'s
phase register is unaffected.

**`packages/core/src/test-command.test.ts`** — AC-22's register, above. Plus: the header paragraph
about the port freeze deleted (its subject was the charter); the Q-0079 block's placement
justification rewritten, since it cited `port-freeze-guard.test.mjs` as the sibling it avoided and
that file is now gone — the placement outlives the sibling, which is worth saying; the Q-0107 AC-16
note moved to past tense where it said *"Q-0103 deletes it"*.

**`packages/core/src/turbo-inputs.test.ts`** — five registers followed the deletion:
- the `spike/test` **walk** removed with `spike-parity.test.ts`, the comment above `WALKS` recording
  that no walk leaves the workspace any more;
- **`NOT_READ`** loses `harness/port-charter.md` and `spike/src/fanout.js`. Both would have gone
  *dead* — `pathLiterals` can no longer see either key — and `no register entry can go dead
  unnoticed` is the clause that refuses exactly that. Replaced by a comment stating the mechanism;
- two **`ROUTES`/relative-specifier** entries keyed by the deleted file;
- **`COLLECTED_BASELINE`**: one entry removed, arithmetic re-derived from the array — **71 → 70
  occurrences, 43 → 42 literals**. The doc comment records this as a *third* kind of departure,
  distinct from Q-0096's lost subjects and Q-0107's changed ones: the literal is unchanged and
  stopped being classified as a path, because its target left the inventory;
- the walk list in the `INVENTORY` doc comment.

**`packages/core/src/test-discovery.test.ts`** — Q-0054 AC-5's two-guard list is one guard. Recorded
as `retired` with the reason the removal is loud rather than silent: `repoFile` throws, so a list
naming a deleted file could not have passed.

**`packages/core/src/git-identity.test.ts`** — three provenance comments that **quoted** paths under
the deleted tree now describe them. Not cosmetic: `turbo-inputs.test.ts`'s scan does not distinguish
a quoted path in a comment from a read, so quoting one is how a dangling citation becomes an
undeclared input. This is the device the repository already uses (`turbo-inputs.test.ts:1988`,
`:219`), and it makes these three sites independent of the index rather than waiting on §0.1.

**`packages/core/test/vitest-include.ts`** — comment only; the module stays shared with one caller,
and says why.

**`packages/core/turbo.json`** — the seventh and last spike input, `../../spike/test/**`, removed
with its sole reader. The comment says why a declared input naming a directory that cannot exist is
worse than no declaration: it hashes nothing, so the task could never be invalidated by it.

**`packages/cli/turbo.json`** and **`packages/cli/src/package.test.ts`** — Q-0107 added five
declarations for `spike-dependencies.test.ts`. **Four are removed** (`harness/architecture.md`, the
per-package test and manifest globs, and the `spike/**` listing) — measured, none has a reader in
this package now, and the two manifests arrive through the `^test` edge as they did before that
register existed. **The fifth stays with a different reader named**: `build.test.ts:382` reads every
package's `turbo.json` to prove none declares more than `inputs`, and the four scaffold packages it
reaches are covered by no edge. `OUTSIDE` loses six rows and rewrites two.

**`packages/shared/src/docs.test.ts`** — AC-26's pin.

**`harness/architecture.md`, `harness/roles/developer-generalist.md`** — §0.3(b).

**`docs/04-architecture.md`, `docs/06-development-plan.md`, `README.md`, `eslint.config.js`,
`vitest.shared.js`** — AC-23 to AC-26.

---

## 3. Deliberately left alone

- **`docs/decisions/` and `docs/DECISIONS.md`** — untouched. Ground rule 3.
- **`backlog/`** — untouched; it belongs to the harness.
- **The JSDoc citation sweep.** 54 production files under `packages/*/src` cite a path under the
  deleted tree as the authority for a ported behaviour. Those citations stay true — the behaviour
  did come from there — and §7 registers the sweep as its own ticket. AC-19's three exceptions were
  Child B's and are done.
- **`packages/core/src/fanout/fanout.test.ts`'s fixture value** `spike/src/fanout.js`. It is task
  fixture *data* — a plausible-looking path a task claims to own, never opened — and Q-0107's
  disposition said the **row** goes at Q-0103, not the fixture. Removing the row is what I did.
  Changing the datum would be scope creep, and would not fix §0.1 anyway: the four copier failures
  are unreachable from any source edit.
- **`docs/06-development-plan.md`'s own Q-0103 bullet**, which still says *"55 tracked files, 9,732
  lines"* — superseded by E-1's 54 and 9,644 — and describes the ticket in the future tense. This
  page's ticket bullets are rewritten by hand at each plan pass (Q-0094 E-3(a) is the precedent for
  an implementer's edit here being reverted at no cost), and AC-26 asks only for the done-when and
  the follow-up record. Flagged, not taken.
- **The `owner: process.env.USER` defect**, Q-0059, Q-0060, Q-0066, Q-0068, Q-0100, Q-0102. Each is
  a one-tree ticket now; none is closed here.

---

## 4. One hazard worth recording

The first draft of `package.test.ts`'s new paragraph put a per-package glob in backticks inside a
JSDoc block. The glob's separator **closes a block comment**, so the file became a parse error and
Vitest reported it as a failed *suite* rather than a failed assertion — three sibling test files
went down with it and the cause was 60 lines away from the symptom. Fixed by describing the four
inputs in prose, and the paragraph now says so. It is the same class as the repository's existing
note that a backticked path in a comment is collected as a path literal: **a comment in this
workspace is read by more things than a reader expects.**

---

## 5. Still open, in priority order

1. **`git add` is not reachable from this role**, so the deletion cannot be staged and 7 tests fail
   in this worktree (§0.1). The remedy is one line in `.claude/settings.json`, which is the human's
   file — Q-0038's precedent, where the fix was to the environment and the criterion stood
   unamended. Nothing about this change needs to move.
2. **AC-24's `CLAUDE.md` half** (§0.2), with the replacement wording supplied.
3. **`docs/02-sdlc-pipeline-spec.md:564`** says *"Both engines"* and cites a deleted file. One
   engine now. No criterion names that document.
4. **The three `.claude/` surfaces** naming the spike (§AC-27's table).
5. **A decision entry may be owed** for §0.3(a) — *what becomes of a register whose key set is a
   deleted tree* — which is GO-1's second question arriving one artifact later than GO-1 anticipated,
   on `spike-dependencies.test.ts` rather than on the six `*.source.test.ts` guards Child B closed.
   I cannot write one; it is named here as the role requires.
