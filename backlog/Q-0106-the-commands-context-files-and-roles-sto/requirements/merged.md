# Q-0106 — The commands, context files and roles stop naming the spike

*Merged requirement, run 1, iteration 1. Written against the tree at `29be919`, 2026-09-05.*

*Q-0103's merged requirement owns AC-1 to AC-7 and was written against `83b193c`, two commits
earlier. **Its criteria are restated here in full, and that is not the transcription this
repository forbids.** `chore.yaml`'s `implement` step reads `requirements/merged.md` from **this**
folder; a pointer to a sibling's document is not in the prompt, so a requirement that only points
is a specification the implementer never sees. Every restated criterion below was re-measured
against the tree, and where the inherited text is wrong, §3.4 names the correction rather than
carrying it. Q-0103 §12's six statements stand unchanged and are not repeated.*

---

## 0. Verdict, stated first

**ready.** Eight criteria: AC-1 to AC-7 as Q-0103's merged requirement numbers them, plus **AC-29**,
taking the next free number in the cut's shared space on the Q-0097 / Q-0098 precedent (Q-0098
numbered from 25 because Q-0097 had spent 22–24; AC-28 is the last spent).

Nothing blocks. No decision entry is owed — *"A check outlives its subject only if it can still
fail"* (2026-09-05) landed at `d9d5af7`, one commit after the parent requirement was written, and it
discharges the obligation that document filed as blocking. `docs/decisions/` ends at 079.

**Seven of the eight inherited statements needed correction**, and three would have cost a later
child a run:

| | Inherited | Measured at `29be919` |
| --- | --- | --- |
| Role files carrying `spike` | 4 | **5** — `spike/templates/harness/roles/developer-generalist.md`, held byte-identical to the fourth by `templates.test.ts` |
| AC-6's effect on `developer-generalist` | drop `spike` | **must keep it** — it is the role `chore.yaml:7` runs, and it implements Q-0107 AC-8 (a move out of `spike/test/`) and Q-0103 AC-20 (deleting `spike/`) |
| AC-2's oracle | `packages/core/src/test-command.test.ts` | **`packages/shared/src/project.test.ts:125–149`** — and `test-command.test.ts:4–5` says so in its own header |
| `architecture.md` spike references | 11, at six locations | **12 lines**; `:42` is in no enumeration |
| The freeze paragraph's extent | `:69–75` | **`:69–78`** — three lines beyond it still send a reader to `harness/port-charter.md` |
| AC-5's `:51` re-point | at "AC-18's counterpart" | **AC-18 is Q-0107's** — re-pointing here names a file that does not exist |
| AC-5's `:94` rewrite | replace the spike copy | **must gain** the `packages/cli` copy beside it — the chain is three links until Q-0107 AC-14 |
| `rules.md`'s engine citation | replace `spike/src/engine.js:1034` | that line is **already wrong by 275 lines**; the site is `:1309`, the counterpart `composite.ts:303` |
| Adopter-facing `(spike)` header | `harness/harness.yaml:1` only | **three files** — AC-29 |

**The principle behind five of these is one sentence, and it is this ticket's spine:** these files are
read by agents at run time, so they must describe the repository **as it is during A and B**, not as
it will be after C. Child A is not a down-payment on the deletion. It is a description, and a
description that runs ahead of its subject is false in exactly the way `harness/product-context.md`
was false before Q-0098 fixed it.

---

## 1. Problem

`packages/cli` dispatches all eight commands, so nothing in the product reads `spike/` any more. Four
configuration and context files still say otherwise, and they are not documentation: three are **fed
to agents at run time**, and one is executed by every `integrate` step in every flow.

The `maintainer` sees two commands that install a second npm tree and run a second suite. The
`contributor` sees `harness/rules.md` instructing them, in the imperative, to run
`npm install --prefix spike` and `npm test --prefix spike` — an instruction inherited by every
requirement written after them, because `chore.yaml`'s `implement` step declares
`harness: [rules.md, architecture.md]`. The `adopter` sees the narrowest and most embarrassing
version: `quorum init` scaffolds a role granting them a write path to `spike/`, and a `harness.yaml`
whose first line calls their new project's config *"(spike)"*.

**What makes this a separable child** is `runFlow`'s parameter. `config` arrives as a `runFlow`
argument (`spike/src/engine.js:61`) and is never re-read; `integrate` reads
`ctx.config.commands?.test` at `:1306` and `ctx.config.commands?.install` at `:1309`. So this
child's own `integrate` runs the **old** commands, which still work because `spike/` is still on
disk. The change cannot be killed by the change.

**What makes it the last of its kind** is `spike/test/smoke.js:452–485`. It parses
`harness/architecture.md`'s role table, asserts each row's third column equals that role's `paths:`
frontmatter after sorting, and asserts the role's prose names every path it declares. It is **the
only file in either tree that checks any of this**, and Child A's own `integrate` is the last
`integrate` that will ever run it. AC-5, AC-6 and AC-7 edit both sides of that comparison, in the one
change where a mistake is still caught by something other than a reader.

The inverse is the risk, and it is sharper than the parent document recorded. Measured:

| Surface | Read at run time by | Asserted over by | Declared as a turbo input by |
| --- | --- | --- | --- |
| `harness/harness.yaml` | the engine, every run | `project.test.ts` (Q-0065 + three Q-0058 guards) | `packages/{shared,core,cli}/turbo.json` |
| `harness/roles/*.md` | every step that resolves a role | `role.test.ts`, `smoke.js` | `packages/shared/turbo.json:32` |
| `harness/architecture.md` | every chore `implement` step | **`smoke.js` only** — and it dies at Child C | **nothing** |
| `harness/rules.md` | every chore `implement` step | **nothing, in either tree** | **nothing** |

`harness/rules.md` appears in no `repoFile` call, no `turbo.json` `inputs` list, and — correctly —
in no `NOT_READ` register either, because nothing collects it. `harness/architecture.md` is the same
on the input side: **editing it moves no workspace task hash**, so its correctness is not merely
uncached, it is unexaminable by the workspace suite whether the cache is warm or cold. The two files
with the widest blast radius in this ticket have one oracle between them, and it is the one about to
be deleted. That is not a defect to fix here; it is why AC-4 is written as an enumeration of sites
rather than as an outcome, and why GO-3 exists.

---

## 2. User stories

- **As the `maintainer`,** I want `commands.install` and `commands.test` to name one dependency set
  and one suite, so that `integrate` stops installing an npm tree the product no longer reads.
- **As the `maintainer`,** I want this change's role-table edits checked by the oracle that is about
  to be deleted, rather than by the next person to read the table, because this is the last ticket in
  which that oracle runs.
- **As the `contributor`,** I want `harness/rules.md` and `harness/architecture.md` to describe the
  repository I cloned, so the instructions fed to every agent do not tell me to install and run a
  suite that is going away, and do not name a file nobody has written.
- **As the `contributor`,** I want the role that will implement Q-0107 and Q-0103 to still be
  permitted to touch the tree those tickets are about, so neither meets a blocker its own predecessor
  created.
- **As the `adopter`,** I want `quorum init` to scaffold a harness whose roles grant me no write path
  to a directory my project has never had, and whose config file does not call itself *"(spike)"*.

---

## 3. What was measured

### 3.1 The mechanism, confirmed exact

| Claim | Measured at `29be919` | Verdict |
| --- | --- | --- |
| A's `integrate` runs the old commands | `config` is a `runFlow` parameter (`spike/src/engine.js:61`), never re-read; the reads are `:1306` and `:1309` | **exact** |
| `spike/` stays and every assertion over it keeps working | no criterion here deletes a file | **exact** |
| The chore implement role | `chore.yaml:7` — `role: developer-generalist` | **exact, and it is what §3.4(b) turns on** |
| `developer-tooling` collapses without `packages/cli` | frontmatter `[spike/bin, spike/test, packages/core, packages/shared]`; stripped, `[packages/core, packages/shared]` ⊂ `developer-backend`'s stripped `[packages/core, packages/shared, harness, docs, backlog]` | **exact, and it excludes the package `architecture.md:29` says the role exists for** |
| The counterpart of the `rules.md` citation | `packages/core/src/engine/composite.ts:303`, inside `runIntegrate` (declared `:224`) | **exact** |

### 3.2 The surface — ten files, not seven

| File | `spike` lines | Criterion |
| --- | --- | --- |
| `harness/harness.yaml` | 5 — `:1, :30, :35, :40, :48` | AC-2, AC-3 |
| `harness/rules.md` | 4 — `:12, :14, :15, :33` | AC-4 |
| `harness/architecture.md` | **12** — `:27, :28, :29, :42, :51, :64, :69, :70, :71, :75, :88, :94` | AC-5 |
| `harness/roles/developer-backend.md` | 5 — `:3, :9, :12, :17, :18` | AC-6 |
| `harness/roles/developer-tooling.md` | 5 — `:4, :11, :13, :18, :19` | AC-6, AC-7 |
| `harness/roles/developer-generalist.md` | 2 — `:3, :21` | **AC-6 — retained, see §3.4(b)** |
| `packages/cli/templates/harness/roles/developer-generalist.md` | 2 — `:3, :21` | AC-6 |
| `spike/templates/harness/roles/developer-generalist.md` | 2 — `:3, :21` | **AC-6 — the byte mirror, §3.4(a)** |
| `packages/cli/templates/harness/harness.yaml` | 1 — `:1` | **AC-29** |
| `spike/templates/harness/harness.yaml` | 1 — `:1` | **AC-29 — the byte mirror** |

`harness/product-context.md` carries **zero** and is not in scope. `harness/flows/*.yaml` carry zero.
`harness/port-charter.md` carries many and is **Child C's** (AC-21) — nothing here touches it, which
matters because `.github/scripts/port-freeze-guard.sh` reads it.

### 3.3 The oracles, named per criterion

| Criterion | What fires if it is wrong | Where it runs |
| --- | --- | --- |
| AC-2 | `project.test.ts:125–149` — the Q-0065 AC-3 guard over `forcesTurbo` | workspace suite |
| AC-3 | `project.test.ts`'s Q-0058 guards — three restored examples per shipped file, and the `retry` example's spelling | workspace suite |
| AC-4 | **nothing** | — |
| AC-5 + AC-6 + AC-7 | `smoke.js:452–485` — table ⇄ frontmatter ⇄ prose, for every row | spike suite: this run's `integrate`, CI's `spike` job, the sweep's `spike suite` phase |
| AC-6 (role count) | `role.test.ts` over `roleFiles()` | workspace suite |
| AC-6 + AC-29 (mirrors) | `templates.test.ts` — byte identity in both directions, plus a file gained or lost | workspace suite |

**`forcesTurbo` passes unchanged and needs no re-aim.** Q-0103 AC-2 says its assertion is *"re-aimed
rather than deleted"*; measured, it does not need to be. It splits on `&&`, takes the segment
containing `turbo run test`, and asks whether that segment's tokens include `--force`; a string with
no `&&` yields one segment, which is `pnpm turbo run test --force --continue`, which includes it.
What becomes false is the JSDoc sentence above it — *"The chain is split on `&&` because
`commands.test` is a shell chain of two suites"* — and what becomes unexercised is the **single-command
shape**, since all five subject fixtures at `:142–148` are two-suite chains. AC-2 rules both.

**AC-5/AC-6/AC-7 have three oracles in this child and two after it.** Q-0103's R-2 says that after
Child A's merge *"nothing"* exercises the spike suite; that is true of `integrate` and false of the
other two. CI's `spike` job (`ci.yml:106`) runs `npm test` in `spike/` on every push until Child C
retires it, and `git-identity-sweep.sh:119–121`'s `spike suite` phase runs it until Child B's AC-16
removes that phase. Stated because an implementer told the check dies at this merge would reasonably
conclude it need not pass afterwards.

### 3.4 The eight corrections

**(a) There is a fifth role file, and a live test binds it to the fourth.**
`packages/cli/templates/harness/` and `spike/templates/harness/` are **byte-identical across the
whole tree today**, and `packages/cli/src/templates.test.ts` asserts it in both directions, with a
file gained or lost reported as two failures rather than one, and with
`packages/cli/turbo.json:58` declaring `../../spike/templates/harness/**` so a cache hit cannot
stand over an edit to the spike half. Editing the `packages/cli` copy of `developer-generalist.md`
without editing the `spike/templates` copy turns the workspace suite red — inside this child's own
`integrate`. AC-6 names four files; it is five.

Writing there is permitted and is not a freeze question: `port-freeze-guard.sh` watches `spike/src`,
and its branch-scope half answers *"the freeze does not apply"* for any ticket outside Q-0009's
fourteen. No freeze-SHA re-record is owed.

**(b) AC-6 as written disarms the role that must implement Q-0107 and Q-0103. This is the correction
that would have cost a run.**

`chore.yaml:7` runs `implement` as `developer-generalist`. That role's `paths:` is the only thing
telling the implementer what it may write, and enforcement reaches it **through the prose alone** —
`harness/architecture.md:21–23` and `packages/shared/src/role.ts` both record that the engine never
reads `paths`. Remove `spike` from it and:

- **Q-0107 AC-8** asks its implementer to *move* `spike/test/q0080-allocation.json` into
  `packages/core`. A move is a delete under `spike/test/`, in a role that has just been told it may
  not write there.
- **Q-0103 AC-20** asks its implementer to delete `spike/` entire — 55 tracked files.

This repository has paid for that shape thirteen times, and once by this exact mechanism: Q-0069's
AC-11(b) named a surface outside the chore role's write paths, and **three revise rounds refused it
correctly** before the loop reached its exhaustion gate and a human landed the change. An implementer
that obeys its role is the design working, not a defect to route around.

**Ruled: `harness/roles/developer-generalist.md` keeps `spike` in `paths:` and in its prose, and
retires it in the change that deletes the directory.** The two *template* copies lose it now, because
they describe an adopter's project, which never had a spike — that is the actual defect AC-6 names,
and this narrowing does not touch it. `developer-backend` and `developer-tooling` lose theirs now
too: neither is a chore role, neither runs A, B or C, and nothing in B or C sends either of them to
`spike/`.

The cost is stated rather than hidden: AC-6's inherited *Test* — *"no `harness/roles/*.md` contains
the token `spike`"* — is **narrowed** to `developer-backend`, `developer-tooling` and both template
trees, and one repository role file keeps the token for two more tickets. The alternative is worse in
a way worth naming: Q-0107 and Q-0103 would each need a criterion re-granting a path their own
predecessor removed, and a role file edited twice in three tickets to say opposite things is the
churn a write contract exists to prevent. **GO-1** puts the narrowing in front of the gate.

**(c) AC-2 names the wrong oracle, and following it would do damage.** The inherited *Test* says the
shipped file is *"asserted by `packages/core/src/test-command.test.ts`, whose Q-0065 AC-3 assertion is
re-aimed rather than deleted"*. There is no command assertion in that file. `forcesTurbo` and the
Q-0065 AC-3 describe block are `packages/shared/src/project.test.ts:125–149`, and
`test-command.test.ts:4–5` says so in its own header: *"The cache half of this ticket is a one-line
change to `harness/harness.yaml` and is asserted in `packages/shared/src/project.test.ts`."* An
implementer following the inherited text finds no assertion to re-aim and is one step from re-aiming
the wrong thing: `test-command.test.ts` does hold spike machinery — `spikeSources()` and the
assertions consuming it — and **that is Q-0107 AC-16's, not this child's.** Neither candidate flagged
this; it is measured here.

**(d) `architecture.md:42` is in no enumeration.** AC-5 lists `:27–29, :51, :64, :69–75, :88, :94` —
eleven references at six locations. `grep -n spike harness/architecture.md` returns **twelve lines**,
and `:42` — *"Both may write `packages/core/` and `packages/shared/`, on the same terms as
`spike/bin/` below"* — is a forward reference into the `:64` paragraph AC-5 removes. Satisfy AC-5 as
written and the file keeps a sentence pointing at a paragraph that is gone.

**(e) The freeze paragraph is `:69–78`, not `:69–75`.** It runs from *"The spike is frozen for
Q-0009's port"* to *"the landing order and the pre-run checklist"*. Removing `:69–75` alone leaves
three lines whose surviving half still instructs a reader to open `harness/port-charter.md` first —
a live instruction pointing into Child C's deletion set.

**(f) AC-5 asks this child to re-point `:51` at something Q-0107 has not built.** The inherited text
says the `:51` sentence *"is re-pointed at AC-18's counterpart"*. AC-18 is **Child B's** — Q-0107's
ticket body states its criteria are AC-8 to AC-19 — and until it lands, `spike/test/smoke.js`
genuinely is the only thing parsing that column, a fact this child depends on since `smoke.js` is
what checks AC-5, AC-6 and AC-7. Re-pointing here would replace a true sentence with a false one
naming a file that does not exist, in a document fed to every implement step. `:51` **stays** and
moves with AC-18.

**(g) AC-5's `:94` rewrite would delete the instruction this child needs.** The inherited text has
`:94` name `packages/cli/templates/harness/` *as the counterpart of* `harness/flows/`. The chain is
three links until Q-0107 AC-14 collapses it — `templates.test.ts` establishes
`packages/cli/templates/harness` ≡ `spike/templates/harness` and reads
`spike/templates/harness/flows` ≡ `harness/flows` beside it — and `:94` is the only prose telling an
implementer that `spike/templates/harness/` is byte-shared, which is precisely what §3.4(a) requires
this child to act on. `:94` **gains** the `packages/cli` copy beside the spike one; it does not
replace it.

**(h) `rules.md`'s engine citation is already stale, by 275 lines.** `rules.md:12` cites
`spike/src/engine.js:1034` for *"`commands.install` … runs only in an `integrate` step's worktree"*.
That line is now part of Q-0038's missing-ref diagnostics. The real site is `spike/src/engine.js:1309`
and its counterpart is `packages/core/src/engine/composite.ts:303`, inside `runIntegrate` (declared
`:224`). Q-0038 added 165 lines and nothing re-derived the citation — the drift Q-0051 found three
times on one ticket. AC-4 therefore requires the replacement to name a **file and symbol**, not a
line: a line number in prose is a measurement with nothing left to re-derive it from, which is 079's
argument against transcription arriving as a citation.

### 3.5 Three smaller measurements the criteria rest on

- **`:64`'s paragraph carries a live rule that must not go with it.** Its last sentence — *"Tasks must
  still assign each concrete file to exactly one owner"* — is decision 032's, not the spike's. It
  survives at `:82–84` (*"Between them, a solution's tasks must own every file the red suite requires
  changed"*), so the paragraph can be removed whole; AC-5 states this so a reviewer can tell a
  deletion that lost a rule from one that did not.
- **Removing prose comments from `harness.yaml` cannot disturb Q-0058's census.** `restoreExamples`
  selects a commented line only where its body begins with a plain YAML identifier immediately
  followed by a colon, and each shipped file is pinned at exactly three restorations. None of the
  comment blocks AC-3 removes begins that way — `:1`'s body starts *"Harness project config
  (spike)."* — and the three examples themselves are untouched by every criterion here.
- **The template `harness.yaml` needs one line changed and no more.** Its `install: npm install …`
  and `test: npm test` are adopter-generic and correct; only `:1`'s *"(spike)"* is Quorum's. Note
  that the Q-0058 guards read `harness/harness.yaml` and **`spike/templates/harness/harness.yaml`**,
  so the spike mirror is the one under assertion and the `packages/cli` copy is held to it by
  `templates.test.ts`.

---

## 4. Acceptance criteria

Numbered as Q-0103's merged requirement numbers them, so a criterion keeps its name if the cut moves.
AC-29 takes the next free number in the shared space, AC-1 to AC-28 being spent.

**AC-1 (scope).** No file under `packages/*/src` that is not a `*.test.ts` changes in this child.
*Test:* `git diff --name-only <base>...<tip> -- 'packages/*/src/**'` lists only `*.test.ts` paths, if
any. This child also touches `packages/cli/templates/**`, which is not `src`. **A production-source
change is a finding to report at the gate, not to make** — it is the signal that something still
depends on the spike, which is Q-0107's subject. If satisfying any criterion below appears to require
one, implementation stops and reports the dependency.

**AC-2.** `harness/harness.yaml`'s `commands.install` is exactly `pnpm install --frozen-lockfile` and
`commands.test` is exactly `pnpm turbo run test --force --continue`. Neither contains an `npm`
invocation, a `--prefix spike` argument, or any other suite. `timeout_ms: 900000` survives with its
comment at `:26–28`, and the `--force` / `--continue` comment at `:41–47` survives verbatim: those are
Q-0065's, Q-0050's and Q-0008's reasons, not the spike's.

*Test:* `packages/shared/src/project.test.ts`'s Q-0065 AC-3 guard is green — **that file and not
`packages/core/src/test-command.test.ts`, which the parent requirement named in error and which holds
Q-0107 AC-16's spike machinery instead (§3.4(c))**. The guard is additionally **shown to discriminate
over the shape that now ships**: its subject fixtures at `:142–148` are all two-suite chains, so at
least one single-command fixture is added — `forcesTurbo('pnpm turbo run test --continue')` is
`false` and `forcesTurbo('pnpm turbo run test --force --continue')` is `true`. The existing five
fixtures are **kept**, not deleted: they are literals inside a `*.test.ts` file, they still fail for a
reason somebody would act on, and they are what proves the function discriminates — decision 079(b),
and the judgement is recorded in place rather than left implicit. `forcesTurbo`'s JSDoc sentence
*"The chain is split on `&&` because `commands.test` is a shell chain of two suites"* is rewritten to
describe a single command whose split is now defensive.

**AC-3.** `harness/harness.yaml` claims one dependency set and one suite, and stops calling itself the
spike's. Specifically: `:1`'s *"(spike)"* goes; the clause at `:29–30` beginning *"Until packages/core
lands (M2) the runnable code is the spike…"* goes, while the sentence sharing line `:29` — *"Used by
integrate steps with `run_tests: true`"* — **stays**; the block at `:35–39` (*"Both dependency sets
and both suites…"*, through *"so `&&` is a shell chain, not an argv"*) goes entire, its subject being
a chain that no longer exists; and the sentences at `:31–34` explaining why an install step exists in
a fresh worktree at all **stay**, being true of one suite as well as two. No surviving sentence in the
file claims two suites or two dependency sets.

*Test:* the file contains no occurrence of the token `spike`, and `project.test.ts`'s three Q-0058
guards are green — in particular the one pinning exactly three restored examples per shipped file, so
a comment removal that took an example with it fails immediately.

**AC-4.** `harness/rules.md` states one suite, at all four sites:

- `:12` — the `spike/src/engine.js:1034` citation is replaced by `packages/core/src/engine/composite.ts`'s
  `runIntegrate`, **named by file and symbol and not by line number**, per §3.4(h).
- `:14–15` — the install-and-run instruction names `pnpm install --frozen-lockfile` and
  `pnpm turbo run test --force --continue` only, and the pair matches `harness.yaml`'s
  `commands.install` / `commands.test` **verbatim**, so an agent's manual run is what `integrate`
  will run. (Today `:15` says `pnpm turbo run test --force`, already one flag adrift; the inherited
  AC-4 repeats that spelling and is corrected here.) The instruction names no `spike/node_modules`
  and no second suite, and the sentence that reporting a suite as unrun is honest while reporting it
  as green without installing is not **stays**.
- The paragraph's remaining claim — that a worktree has no dependencies until `commands.install` runs
  in an `integrate` step — is **true and stays**; only its spike half goes.
- `:33` — the ESLint-scope sentence loses its `spike/**` clause **and the advice that hangs off it**.
  That advice — read a dependency's typings, prefer the constructor a library documents — exists
  because the spike is unlinted; with `packages/**` and `apps/**` fully covered it has no subject, and
  keeping it while deleting its reason is the shape 079(a) forbids. The sentence's live half — that
  `@typescript-eslint/no-deprecated` is the only type-aware rule and covers `packages/**/*.ts` and
  `apps/**/*.ts`, tests included — stays.

`eslint.config.js` keeps `'spike/**'` in `ignores`: it is Child C's (AC-23) and removing it here would
lint a tree that is still present and was never linted. **`.claude/rules/` is named by no criterion**
— it is a derived copy and its sync is the human's (*"`.claude/rules/` is a derived copy, not a
surface a requirement may name"*, 2026-08-27).

*Test:* none exists. See GO-3 and R-1: this criterion is verified by reading the four sites at the
gate, and the reading is recorded.

**AC-5.** `harness/architecture.md` stops describing the spike as a live tree **without describing a
repository that does not exist yet**. Disposition per line, all twelve:

| Line | Disposition |
| --- | --- |
| `:27` generalist row | keeps `` `spike/` ``, per AC-6 and §3.4(b); gains `` `README.md` ``, `` `eslint.config.js` `` and `` `vitest.shared.js` `` so the cell still equals the frontmatter AC-6 widens |
| `:28` backend row | drops `` `spike/src/` `` |
| `:29` tooling row | drops `` `spike/bin/` `` and `` `spike/test/` ``, gains `` `packages/cli/` `` (AC-7) |
| `:42` | reworded — its *"on the same terms as `spike/bin/` below"* clause names the paragraph `:64` removes (§3.4(d)). The live claim it carries, that a directory in two rows is a grant and never a shared claim, survives |
| `:51` | **unchanged** — `smoke.js` is still the only parser of the third column and is what checks this criterion; it moves with Q-0107 AC-18 (§3.4(f)) |
| `:64` paragraph | removed whole. Its live last sentence, that tasks must assign each concrete file to exactly one owner, is **not lost**: it survives at `:82–84` (§3.5) |
| `:69–78` freeze paragraph | removed — **through `:78`, not `:75`** (§3.4(e)). Its audience is an agent working on one of fourteen closed, contained tickets. `harness/port-charter.md` and `port-freeze-guard.sh` are **not** touched; they are Child C's |
| `:88` | **re-pointed, not removed** — the rule is live (a development task never modifies a test, so a scenario satisfiable only by editing one is unsatisfiable and is a scenario-gate finding); only its `spike/test/**` path moves, to `packages/**/*.test.ts` |
| `:94` | **gains** `packages/cli/templates/harness/` beside `spike/templates/harness/` (§3.4(g)). The sentence that repository configuration and context are repository-specific and must not acquire Quorum's dogfood paths stays, and is load-bearing for AC-6 |

Closing clause, bounded by the enumeration above: after these edits, no sentence in the file presents
`spike/` as a current source tree, test suite, template source, ownership boundary or independent
witness. A thirteenth reference found while satisfying this criterion is dispositioned under the same
rule and named in the implement report.

*Test:* `smoke.js`'s role-table block passes — table ⇄ frontmatter ⇄ prose for every row — and is
**shown to have a subject** by mutating one table cell and observing it fail, rather than by observing
it green. *Stated so a reviewer does not read it as scope creep:* this file is an input to every chore
`implement` step, so a false claim here is inherited by every future run (Q-0098,
`product-context.md`).

**AC-6.** The role files stop granting a path nobody needs, in five files and two shapes.

*Losing `spike` now:*

- `harness/roles/developer-backend.md` — `paths:` becomes
  `[packages/core, packages/shared, harness, docs, backlog]`; the prose path list at `:9`; the
  `spike/bin`/`spike/test` ownership paragraph at `:12–13`; the freeze sentence at `:17–18`.
- `harness/roles/developer-tooling.md` — `paths:` per AC-7; the prose path list at `:11–12`; the
  *"if your task seems to need a change under `spike/src`"* boundary at `:13`, whose function —
  engine internals belong to another role — is preserved by naming `packages/core/src/engine/`
  instead; the freeze sentence at `:18–19`.
- `packages/cli/templates/harness/roles/developer-generalist.md` — `spike` removed from `paths:` at
  `:3` and from the prose list at `:21`, **and nothing else**: the widening below is Quorum's own and
  `harness/architecture.md:94–97` forbids the template acquiring it.
- `spike/templates/harness/roles/developer-generalist.md` — **the same two edits, byte-identically**,
  or `templates.test.ts` fails inside this child's own `integrate` (§3.4(a)).

*Keeping `spike`, on the ruling in §3.4(b):*

- `harness/roles/developer-generalist.md` retains `spike` in `paths:` and in its prose until the
  directory is gone, and carries **one line naming Q-0103 as what retires it and why it is still
  here** — without it, a reviewer correctly reports a missed criterion (R-4). It **gains**
  `README.md`, `eslint.config.js` and `vitest.shared.js`, in frontmatter and in the prose list,
  matched by AC-5's `:27`. **`CLAUDE.md` is excluded and stays the human's**, being the vendor dialect
  of the canonical harness.

*Test:* neither `harness/roles/developer-backend.md`, nor `harness/roles/developer-tooling.md`, nor
any file under either `templates/harness/roles/` contains the token `spike`;
`harness/roles/developer-generalist.md` does, with the Q-0103 note; `role.test.ts`'s role-file count
is unchanged; `templates.test.ts` is green in both directions; `smoke.js` agrees table, frontmatter
and prose for every row. *Why the widening lands here rather than in B:* editing the role that governs
your own step is the Q-0086 hazard, so it lands one ticket ahead of the step that relies on it — and
it is safe to do so because `loadRole` reads the project root rather than the worktree, so this run's
own revise rounds still see the unedited file.

**AC-7.** `developer-tooling`'s `paths:` is `[packages/core, packages/shared, packages/cli]`, in
frontmatter, in the prose path list, and in `architecture.md:29`'s third column. Without
`packages/cli` the role is a proper subset of `developer-backend` and excludes the one package
`architecture.md:29` says it exists for — *"argument parsing, terminal output, exit codes, the
regression suite"*. The two roles remain separate files and keep their existing adapters.
*Test:* `smoke.js` reports the tooling row's frontmatter, table cell and prose in agreement, and the
table still spans two vendors. Whether the two roles should now **merge** is out of scope and is OQ-1.

**AC-29 (new).** `packages/cli/templates/harness/harness.yaml:1` and its byte mirror
`spike/templates/harness/harness.yaml:1` no longer call an adopter's config *"(spike)"*. The rest of
both files is untouched: their `install: npm install …` and `test: npm test` are adopter-generic and
correct, and their three commented examples are pinned. *Test:* neither file contains the token
`spike`; `templates.test.ts` is green; `project.test.ts`'s Q-0058 guards over
`spike/templates/harness/harness.yaml` are green. *Why here rather than in C:* it is the same
adopter-facing defect as AC-6, in the same mirrored directory, in the same change, and Child C's
AC-24 has no other reason to reach into a template tree.

---

## 5. Gate obligations

**GO-1 — ratify the AC-6 narrowing, or say which child re-grants the path.** §3.4(b) contradicts
Q-0103's merged requirement and is ruled here by measurement. The recommendation is that
`harness/roles/developer-generalist.md` keeps `spike` until Child C deletes the tree, and that AC-6's
inherited *Test* narrows accordingly. **Advancing this gate is the ratification.** If the gate
prefers the inherited form, then Q-0107 AC-8 and Q-0103 AC-20 each need an explicit path grant
written into their bodies **before either is launched**, because neither implementer can otherwise
perform its first criterion. *Owner: the human, at this gate — the window for an erratum is a gate.*

**GO-2 — ground rule 2 is an exit condition and this child cannot satisfy it (inherited, unchanged).**
Child A is not proven until a real `integrate` has run the **new** commands, and this child's own
`integrate` runs the old ones. **The proof is Q-0107's `integrate`**, which is also why Q-0103 must
not launch until that is seen green.

**GO-3 — `harness/rules.md` is checked by nothing, and `harness/architecture.md` moves no task hash.**
Measured, not assumed: `rules.md` appears in no `repoFile` call, no `turbo.json` `inputs` list and no
`NOT_READ` register, because nothing collects it; `architecture.md` is likewise declared by no
package, so its only oracle is `smoke.js`. AC-4 must therefore be verified **by reading its four sites
at the gate**, and the verification recorded, exactly as a criterion with no test always is here.
Registered as an owed check rather than fixed in passing: giving `rules.md` an oracle is a ticket, not
a line.

**GO-4 — `06-development-plan.md` already names this folder**, added at `29be919`, so
`plan-backlog.test.ts` is satisfied on creation. Its bullet is rewritten to what shipped at the close,
and the corrections in §3.4(b), §3.4(c) and §3.4(f) belong in it.

---

## 6. Non-goals

Inherited from Q-0103 §7 and confirmed:

- **Deleting, moving or removing anything under `spike/`.** Child C's, and not before Child B. AC-6
  and AC-29 *edit* two files under `spike/templates/`, which the freeze does not cover and which
  `templates.test.ts` requires.
- **The 25 `packages/**` dependencies on the spike** — Q-0107's, and the reason it exists. In
  particular the six `*.source.test.ts` guards that go silent, `step-output.test.ts:61–63`, the parity
  chain, `q0080-allocation.json`, `test-command.test.ts`'s `spikeSources()`, `git-identity-sweep.sh`'s
  phases and the seven `turbo.json` spike inputs are all out of scope here.
- **`harness/port-charter.md`, `packages/core/src/spike-parity.test.ts`, the four CI jobs,
  `eslint.config.js`'s ignore, `README.md`, `CLAUDE.md`, `docs/04-architecture.md` and
  `docs/06-development-plan.md`'s done-when** — all Child C's (AC-21 to AC-26).
- **Proving the new commands during this child's own `integrate`** — structurally impossible; GO-2.
- **Changing flow definitions, gates, adapter assignments, the cross-vendor rule, worktree
  containment, integration branches or run-history formats.**
- **Editing `.claude/rules/`, `CLAUDE.md`, or anything under `docs/decisions/`.**
- **Adding a dependency, changing a package script, changing a schema or file format, or changing
  product behaviour.**
- **Registry-resolved `npx quorum`**; **any fix to Q-0102**; **Q-0039**; **Q-0059, Q-0060, Q-0066,
  Q-0068, Q-0100**; **the `owner: process.env.USER` defect**; **`harness worktrees`**. Q-0100 is the
  sharpest temptation here, since AC-4 and AC-5 both edit prose a line from a `harness` spelling it
  owns.
- **The JSDoc citation sweep across production source** — AC-1 forbids it in this child; it is
  Q-0107 AC-19's.
- **Any item on the v1 exclusion list** — multi-user, remote daemon, cloud sync, plugin marketplace,
  visual node canvas, eval suites, Gemini adapter, desktop shell.

Added here:

- **Giving `harness/rules.md` an oracle.** GO-3 registers it. A guard over a file fed to agents at run
  time is a design question — what would it assert? that the commands it names match `harness.yaml`? —
  and inventing one inside a configuration ticket is the shape this repository keeps finding.
- **Merging `developer-backend` and `developer-tooling`** — AC-7 keeps them distinguishable; whether
  they should stay two roles is OQ-1.
- **Re-pointing `architecture.md:51` and dropping `:94`'s spike half** — §3.4(f) and §3.4(g) rule both
  into Child B, with AC-18 and AC-14 respectively.

---

## 7. Open questions

- **OQ-1 — non-blocking, wants a ticket.** With AC-7 applied, `developer-backend` is
  `[packages/core, packages/shared, harness, docs, backlog]` and `developer-tooling` is
  `[packages/core, packages/shared, packages/cli]`. They are distinguishable and no longer obviously
  two roles; the cross-vendor rule assigns them different adapters, which is an argument for keeping
  both. Inherited from Q-0103 OQ-4. *Owner: the gate.*
- **OQ-2 — non-blocking, registered.** `harness/roles/developer-tooling.md` has no template
  counterpart and `harness/roles/developer-backend.md` diverges from its template in both `paths:` and
  prose, so the role tree is only partly mirrored and nothing states which files are mirrored and
  which are repository-specific — `architecture.md:94` covers flows and `code-reviewer.md` only.
  Measured here rather than fixed; it becomes acute at Q-0107 AC-14 when the chain collapses.
  *Owner: the gate.*
- **OQ-3 — settled by measurement, recorded so it is not re-asked.** Does removing `spike/**` from
  `rules.md:33` require touching `eslint.config.js`? No: the ignore stays until Child C AC-23, and an
  ignore over a tree nothing lints is inert. The sentence and the configuration retire in different
  children on purpose, because the sentence's audience is an agent and the ignore's is ESLint.

---

## 8. Risks

**R-1 — AC-4 has no oracle, and it is the criterion an agent inherits.** `harness/rules.md` is opened
by no suite in either tree and is fed to every chore `implement` step. A wrong command name here is
inherited by every requirement written afterwards and is discovered when somebody runs it by hand.
GO-3 is the mitigation and it is a gate reading, not a test.

**R-2 — AC-2 is the highest-risk edit and no test catches the thing that matters.**
`project.test.ts` proves `commands.test` forces turbo; nothing proves either command *works*. Every
flow's `integrate` runs both, and a mistake surfaces as the next run failing in its worktree,
classified as an environment failure that stops the run after implement and review are paid for. GO-2
is the mitigation and it is an exit condition, not a criterion.

**R-3 — the role-table oracle is spent in this child.** `smoke.js:452–485` is the only check that
AC-5's table, AC-6's frontmatter and AC-7's prose agree, and this is the last `integrate` that runs
it. Its row regex requires single-word role and vendor cells and a third column free of `|`, so a
reformatted table can collapse the row set; the block asserts `rows.length >= 2` rather than an exact
count, and the whole block is guarded by `existsSync`. It must be **shown to have a subject by
mutation**, not observed green — *"a check that skips its subject must not report success"*
(2026-08-25).

**R-4 — the narrowing in §3.4(b) reads as an unfinished job.** `harness/roles/developer-generalist.md`
still contains `spike` after this child merges, against an inherited criterion saying no role file
may. Without the one-line note AC-6 requires, a reviewer correctly reports a missed criterion and a
round is spent re-arguing a ruling. The note and GO-1 are both mitigations, and R-4 is why the note is
in the criterion rather than only in this document.

**R-5 — the byte mirrors are invisible until they fail.** AC-6 and AC-29 each edit two files that must
stay identical, and nothing in the prompt reminds an implementer of the second. They fail loudly, in
`integrate`, after implement and review are paid for. AC-5's `:94` disposition is the structural
mitigation: the sentence naming the mirror stays in the context file the implementer reads.

**R-6 — a comment removal that takes an example with it.** AC-3 deletes comment blocks from a file
whose commented examples are pinned at exactly three per file. The failure is loud and immediate, so
this is a cost rather than a hazard; it is named because the two kinds of comment sit four lines
apart.

**R-7 — a hidden production dependency may surface.** If these configuration changes appear to require
a behavioural change under `packages/*/src`, the premise that Child A is configuration-only is false.
AC-1 requires implementation to stop and report rather than expand scope; it is the signal that
something still depends on the spike, which is Q-0107's whole subject.

---

## 9. Cross-cutting checklist

| | |
| --- | --- |
| **BYOS** | n/a — no code path, test, fixture or example gains or loses a credential path. The BYOS refusal strings are untouched; Q-0068 is unchanged in both trees. |
| **Worktree safety** | n/a to the change; relevant to the route. This child runs `chore.yaml` and writes only in `.harness/worktrees/`. No criterion writes to the user's tree; no integration-branch behaviour changes. AC-2 changes what `integrate` *runs* inside its worktree, not where it runs. |
| **Gate behaviour** | Unchanged. GO-1 and GO-3 are human obligations discharged at a gate; GO-2 is an exit condition on the ordered cutover, not a new gate kind. |
| **File format and schema** | No schema changes. AC-6 and AC-7 edit role `paths` **values**; `roleSchema` accepts any string array and asserts nothing about a path's existence. AC-2, AC-3 and AC-29 edit `harness.yaml` **values and comments**; `projectConfigSchema` is unchanged and still validated nowhere on a load path. |
| **Lint rules** | Unchanged. `eslint.config.js` is Child C's; AC-4 edits the *sentence describing* the ESLint scope, not the scope. |
| **Cross-vendor rule** | Unchanged. AC-6 and AC-7 change roles' paths, not their adapters; `smoke.js` still requires the role table to span two vendors, and it does. |
| **Product-agnostic** | Improved. AC-6 and AC-29 remove Quorum's own tree from two adopter-facing template files, which `harness/architecture.md:94–97` already required and nothing enforced. AC-6 keeps Quorum's widening out of the template. |
| **Cold-clone impact** | **Net positive, and it is the adopter's half that moves.** `quorum init` stops scaffolding a write path to a directory the adopter never had, and stops handing them a config whose first line calls it *"(spike)"*. Nothing lengthens the first 30 minutes; the maintainer's install shortens by one npm tree from the next run onward. |

---

## 10. Provenance

**The Claude candidate is the base.** It measured the inherited criteria against the tree instead of
restating them, and produced six of the eight corrections in §3.4 — the fifth role file and its byte
binding, the AC-6 ruling that keeps `developer-generalist` armed for B and C, `architecture.md:42`,
the `:51` re-point into a file that does not exist, the `:94` rewrite that would have deleted the
mirror instruction, and the 275-line-stale engine citation. Its AC-29, its per-line disposition table,
its oracle table and its "what a reader should not re-derive" section are carried substantially
unchanged. Three of its findings are load-bearing enough that the ticket would have cost a later child
a run without them.

**The codex candidate contributed the discipline around the edges.** Its AC-1 stop-and-report framing
is adopted verbatim in spirit; its non-goals list is fuller and more explicit — flow definitions,
gates, adapter assignments, containment, run-history formats, the v1 exclusion list — and is merged
into §6; its AC-5 closing clause (*"no statement that presents `spike/` as a current repository tree,
test suite, template source, ownership boundary…"*) is adopted as a **bounded** closing clause beneath
the enumeration, where it catches a thirteenth reference without licensing an unbounded sweep. Its
risk framing about context propagating into future work is folded into §1 and R-1.

**Where the candidates disagreed, the tree decided, and codex lost four times**: it named
`test-command.test.ts` as AC-2's oracle, re-pointed `:51` at Q-0103 AC-18 (Child B's, unbuilt), had
`:94` *replace* rather than *gain* the spike copy, and removed `spike` from all three repository role
files including the one that must implement Q-0107 and Q-0103. Each is the inherited text restated
faithfully; that is the failure mode, not carelessness.

**Two corrections are this merge's own.** §3.4(c) — AC-2's inherited oracle is the wrong file, which
neither candidate flagged, and following it leads an implementer to the one file in `packages/core`
that holds Q-0107 AC-16's spike machinery. §3.4(e) — the freeze paragraph runs to `:78`, not `:75`.
Two smaller ones are also new: `:64`'s paragraph carries a live ownership rule that survives at
`:82–84` and must not be reported lost with it (§3.5), and `harness/architecture.md` is declared as a
turbo input by **no package**, so unlike the role files and `harness.yaml` its correctness is not
merely uncached but unexaminable by the workspace suite (§1).

**On size.** Eight criteria, all independently testable, five of them with a named oracle. Within
bounds and not close to them; the natural seam of the cutover was already cut at Q-0103's gate and
this child sits on the configuration side of it.

---

## 11. What a reader should not re-derive

Measured at `29be919` on 2026-09-05, from the tree. Q-0103 §12's six statements stand unchanged and
are not repeated. **Six more are in circulation and are wrong:**

1. that four role files carry `spike` — **five do**, and `templates.test.ts` binds the fourth to the
   fifth by byte identity in both directions;
2. that `harness/roles/developer-generalist.md` may lose its `spike` path in this child — **Q-0107
   AC-8 and Q-0103 AC-20 both need it**, and `chore.yaml:7` runs both under that role;
3. that AC-2's guard lives in `packages/core/src/test-command.test.ts` — **it is
   `packages/shared/src/project.test.ts:125–149`**, and that file's own header says so; the spike
   machinery in `test-command.test.ts` is Q-0107 AC-16's;
4. that `harness/architecture.md` carries eleven spike references at six locations — **twelve lines**,
   and `:42` is in no enumeration; the freeze paragraph runs to `:78`, not `:75`;
5. that `rules.md`'s `spike/src/engine.js:1034` is a correct citation to be substituted — **the site
   is `:1309`** and has been since Q-0038; the counterpart is
   `packages/core/src/engine/composite.ts:303`, inside `runIntegrate`;
6. that after this child's merge nothing exercises the spike suite — **CI's `spike` job
   (`ci.yml:106`) and the sweep's `spike suite` phase (`git-identity-sweep.sh:119–121`) both do**,
   until Q-0103 and Q-0107 respectively.

And three that are right and worth carrying, because they are the reason for six of this document's
criteria:

- `spike/test/smoke.js:452–485` is the **only** check in either tree that a role's `paths:`, the
  architecture table's third column and the role's own prose agree. This child's `integrate` is the
  last one that runs it.
- `harness/rules.md` is opened by **no suite in either tree** and declared as a turbo input by no
  package. AC-4 is verified by reading, at a gate, or it is not verified.
- `harness/architecture.md` is likewise declared by no package, so an error in it moves no task hash
  and is invisible to the workspace suite whether the cache is warm or cold.
