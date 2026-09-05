# Q-0106 implement — run 2, iteration 1

*Child A of the cutover. Eleven files, +58/−74. Every criterion of
`requirements/merged.md` §4 is satisfied; nothing outside them was touched.*

**No review report was present, so this is a first implement round rather than a revision.**

---

## 0. Verdict

**All eight criteria done** — AC-1 to AC-7 as Q-0103 numbers them, plus AC-29.

**Nothing was ambiguous enough to stop on, and no production source changed** — AC-1's
stop-and-report condition was never reached, which is itself the reportable fact: no configuration
edit here turned out to need a behavioural one, so Child A's premise that it is configuration-only
survives contact with the tree.

**Three findings are reported and not fixed**, all in §5.

---

## 1. Verification, stated before the file list

Both suites, both gates, forced, in this worktree after `pnpm install --frozen-lockfile` and
`npm install --prefix spike --no-audit --no-fund`:

| | |
| --- | --- |
| workspace `test` + `lint` + `typecheck` | **21/21 tasks, 0 cached** |
| spike suite | **19/19 files passed** |
| `harness lint` | **6/6 flows** |
| `pnpm sweep:git-identity` | **green** — *"both suites executed and green with no resolvable git identity"* |
| AC-1 scope | `git diff --name-only -- 'packages/*/src/**'` → `packages/shared/src/project.test.ts` **only** |

The sweep is recorded because Q-0102 says it is red under load; it was green here, on this tree,
which is a data point for that ticket and not a refutation of it.

**Two mutations were run rather than two green observations reported**, per AC-5's *Test*, R-3 and
*"a check that skips its subject must not report success"* (2026-08-25). Both are in §3.

---

## 2. What changed, file by file

### `harness/harness.yaml` — AC-2, AC-3

- `:1` — `# Harness project config (spike). …` → `# Harness project config. …`.
- `commands.install` → **`pnpm install --frozen-lockfile`**, exactly.
- `commands.test` → **`pnpm turbo run test --force --continue`**, exactly.
- Removed: the clause *"Until packages/core lands (M2) the runnable code is the spike, so the suite
  is the spike's mock-adapter smoke test."*, and the five-line block beginning *"Both dependency
  sets and both suites, chained so the step fails if either does…"* through *"so `&&` is a shell
  chain, not an argv."*
- **Kept, verbatim and deliberately**: the sentence sharing the first of those lines, *"Used by
  integrate steps with `run_tests: true`."*; the `timeout_ms` comment; the three sentences at
  `:31–34` explaining why an install step exists in a fresh worktree at all; and the whole
  `--force` / `--continue` comment. Those are Q-0065's, Q-0050's and Q-0008's reasons and are true
  of one suite as well as two.

`grep -c spike harness/harness.yaml` → **0**. `project.test.ts`'s three Q-0058 guards pass, so no
comment removal took a pinned example with it (R-6): checked in advance too — `EXAMPLE_BODY`
requires a plain identifier immediately followed by a colon, and none of the removed lines begins
that way, the first starting *"Both dependency sets…"*.

### `harness/rules.md` — AC-4

Four sites, all read at the gate because nothing tests this file (GO-3, §4).

- The engine citation is now **`runIntegrate`, in `packages/core/src/engine/composite.ts`** — file
  and symbol, no line number, per §3.4(h). Verified against the tree rather than transcribed:
  `runIntegrate` is declared at `composite.ts:224` and reads `context.config.commands?.install` at
  `:303`. The old `spike/src/engine.js:1034` was 275 lines stale.
- The install-and-run instruction now names **`pnpm install --frozen-lockfile`** and
  **`pnpm turbo run test --force --continue`** and says in one clause that the pair is
  `commands.install` and `commands.test` verbatim, so a hand run is what `integrate` will run. No
  `spike/node_modules`, no second suite. The sentence that reporting a suite as unrun is honest
  while reporting it as green without installing is not — **kept**.
- The claim that a worktree has no dependencies until `commands.install` runs — **kept**, true.
- The ESLint-scope sentence lost its `spike/**` clause **and the four lines of advice hanging off
  it** (read the typings, prefer the documented constructor), which existed only because the spike
  is unlinted. The live half — `@typescript-eslint/no-deprecated` is the only type-aware rule and
  covers `packages/**/*.ts` and `apps/**/*.ts`, tests included — is untouched.

`grep -c spike harness/rules.md` → **0**. `eslint.config.js`'s `'spike/**'` ignore is **not**
touched (Child C AC-23, OQ-3).

### `harness/architecture.md` — AC-5

All twelve lines dispositioned exactly as the table directs:

| Line | Done |
| --- | --- |
| `:27` generalist row | keeps `` `spike/` ``; gains `` `README.md` ``, `` `eslint.config.js` ``, `` `vitest.shared.js` `` |
| `:28` backend row | `` `spike/src/` `` dropped |
| `:29` tooling row | `` `spike/bin/` ``, `` `spike/test/` `` dropped; `` `packages/cli/` `` gained |
| `:42` | the clause *", on the same terms as `spike/bin/` below"* removed, colon moved; the live claim — a directory in two rows is a grant, never a shared claim — survives intact |
| `:51` | **unchanged**, per §3.4(f) |
| `:64` paragraph | removed whole |
| `:69–78` freeze paragraph | removed — **through `:78`**, so no surviving half points a reader at `harness/port-charter.md` |
| `:88` | `` `spike/test/**` `` → `` `packages/**/*.test.ts` ``; the rule itself unchanged |
| `:94` | **gained** `packages/cli/templates/harness/` beside the spike one, with *"which are themselves byte-identical to each other"* |

`:64`'s live last sentence — *"Tasks must still assign each concrete file to exactly one owner"* —
was **checked as surviving elsewhere before the paragraph was removed**, per §3.5: it is at
`:82–84` in the *"Tasks are small, and their ownership is complete"* paragraph, *"Between them, a
solution's tasks must own every file the red suite requires changed"*. No rule was lost with the
paragraph.

**Three `spike` references remain, and all three are the enumeration's own instructions rather
than a missed criterion** — `:27` (the write path §3.4(b) rules stays), `:51` (`smoke.js` as the
column's only parser, §3.4(f)), `:78` (the byte-shared template source, §3.4(g)). AC-5's closing
clause is bounded by the enumeration and the enumeration keeps them; each is a true statement about
the tree today. **No thirteenth reference was found.**

### `harness/roles/developer-backend.md` — AC-6

`paths:` → `[packages/core, packages/shared, harness, docs, backlog]`; the same list in the prose;
the `spike/bin`/`spike/test` ownership paragraph and the port-freeze sentence removed. The
shared-with-tooling sentence keeps its live half.

### `harness/roles/developer-tooling.md` — AC-6, AC-7

`paths:` → **`[packages/core, packages/shared, packages/cli]`**, in frontmatter, in the prose list
and in `architecture.md:29`. The port-freeze sentence removed. The `:13` boundary sentence keeps
its function by naming `packages/core/src/engine/` where it named `spike/src` — the literal
substitution AC-6 directs; see §5.3 for what that costs. Both roles remain separate files with
their existing adapters, so the table still spans two vendors.

### `harness/roles/developer-generalist.md` — AC-6, on the §3.4(b) ruling

**Keeps `spike`** in `paths:` and in the prose, and carries the note R-4 requires — one sentence
naming Q-0103 as what retires it and Q-0107 as the other ticket that needs it, and saying that
removing the grant first would leave each unable to perform its own first criterion. Gains
`README.md`, `eslint.config.js`, `vitest.shared.js` in both places, matched to `:27`. **`CLAUDE.md`
excluded**, per AC-6. The closing paragraph was re-wrapped to the file's existing width because the
insert pushed one line to 108 characters; no wording outside the new sentence changed.

### `packages/cli/templates/harness/roles/developer-generalist.md` and its spike mirror — AC-6

`spike` removed from `paths:` and from the prose list in **both**, byte-identically. **Nothing
else**: the widening above is Quorum's own and `architecture.md`'s template rule forbids it here.

### `packages/cli/templates/harness/harness.yaml` and its spike mirror — AC-29

Line 1 only, in both. Their `install: npm install …` and `test: npm test` are adopter-generic and
correct and were left alone, as were their three commented examples.

`diff -r packages/cli/templates/harness spike/templates/harness` → **identical**, so R-5's invisible
failure did not happen; `templates.test.ts` is green in both directions.

### `packages/shared/src/project.test.ts` — AC-2's test half

- `forcesTurbo`'s JSDoc sentence rewritten: the `&&` split is now **defensive rather than
  load-bearing**, since `commands.test` is one command that splits into one segment, and the split
  survives because an adopter's `commands.test` is still theirs to chain.
- **Two fixtures added**: `forcesTurbo('pnpm turbo run test --continue')` is `false` and
  `forcesTurbo('pnpm turbo run test --force --continue')` is `true`.
- **The five existing fixtures kept**, with the judgement recorded in place per 079(b): they are
  literals in a test file rather than a claim about the tree, each still fails for a reason somebody
  would act on, and between them they are what shows the function discriminates.

---

## 3. The two mutations

Neither oracle was observed green and reported as evidence.

**Mutation 1 — AC-5/AC-6/AC-7's oracle, the one this `integrate` is the last to run.** Dropping
`` `packages/cli/` `` from `architecture.md:29`'s third column turns `smoke.js` red with a
discriminating message:

> `✗ developer-tooling frontmatter matches the table (packages/cli,packages/core,packages/shared vs packages/core,packages/shared)`

— while `developer-generalist` and `developer-backend` still report agreement, so it fires on the
row that moved rather than on the table. Restored; suite green.

**Mutation 2 — the new AC-2 fixtures.** Making `forcesTurbo` return `false` for any one-segment
command fails **two** tests: the assertion over the real `harness.yaml`
(*"commands.test must force a fresh run: pnpm turbo run test --force --continue: expected false to
be true"*) and the fixture block, which fails at the **new** positive line, the five older fixtures
having passed above it. That is the demonstration AC-2 asks for: without the added pair, the
file-reading assertion would be the only evidence that a one-segment command can pass at all.
Restored; suite green.

---

## 4. GO-3 discharged — AC-4 verified by reading, and the reading recorded

`harness/rules.md` is opened by no suite in either tree, declared as a turbo input by no package,
and correctly absent from `NOT_READ` because nothing collects it. Re-confirmed here rather than
inherited: `turbo-inputs.test.ts:301` registers `harness/architecture.md` with the note that
`role.test.ts` asserts the *string* appears in `role.ts`'s doc comment and **no suite opens it**.
So AC-4 is verified by reading, and this is the reading:

1. **The engine citation** names `packages/core/src/engine/composite.ts` and `runIntegrate`. Both
   exist; `runIntegrate` is declared at `:224` and the `commands.install` read is at `:303`, inside
   it. No line number is quoted, so there is nothing here to go stale.
2. **The two commands** are character-for-character `harness.yaml`'s: `pnpm install
   --frozen-lockfile` and `pnpm turbo run test --force --continue`. Diffed by eye against
   `harness.yaml:34` and `:42`. The pre-existing one-flag drift (`rules.md` said
   `pnpm turbo run test --force`, missing `--continue`) is closed by this.
3. **No second suite and no `spike/node_modules`** anywhere in the bullet; `grep -c spike` over the
   whole file is 0.
4. **The ESLint sentence** keeps only its live half, and the advice that existed because of the
   unlinted tree went with the clause naming that tree — the shape 079(a) forbids is not created.

---

## 5. Reported and not fixed

### 5.1 `smoke.js`'s "prose names its allowed path" clause cannot fail

Found while running mutation 2's first attempt. Removing `packages/cli` from
`developer-tooling.md`'s **prose list** and leaving the frontmatter alone left the assertion
**green**:

> `✓ developer-tooling prose names its allowed path packages/cli`

The mechanism: `smoke.js:479` does `assert(text.includes(dir))` where `text` is the *whole role
file* and `dir` came from that same file's `paths:` frontmatter three lines earlier. So every path
it checks is guaranteed present, and the clause is true by construction for every row, every path,
every time. `grep -n "packages/cli" harness/roles/developer-tooling.md` under the mutation returned
exactly one line: the frontmatter.

This is the class recorded in *"A check is not established by reading it"* (2026-08-29), inside the
oracle AC-5's own *Test* nominates. It matters because `architecture.md:21–23` and
`packages/shared/src/role.ts` both say enforcement reaches an agent **through the prose alone** —
so the one clause guarding the channel that actually binds is the one that cannot fail, while the
frontmatter-versus-table clause beside it works (mutation 1).

**Not fixed here**, for two reasons: no criterion of this ticket names it, and `smoke.js`'s
role-table parser is **Q-0107 AC-18's** — §3.4(f) is the ruling that this child must not touch it.
The prose lists were nonetheless written correctly by hand for every role, so AC-6's and AC-7's
prose halves are satisfied in fact even though nothing would have caught them.

### 5.2 §3.2's claim about the five existing `forcesTurbo` fixtures is wrong in two of five

AC-2 says *"its subject fixtures at `:142–148` are all two-suite chains"*. Measured, three are;
`forcesTurbo('pnpm turbo run test --force-something')` and `forcesTurbo('npm test --prefix spike')`
are single commands. **The criterion is unaffected and was still needed**: both of those are
*negative* cases, so no existing fixture was a positive single-command one, which is exactly what
the added pair supplies and what mutation 2 shows to be load-bearing. Recorded because a reader
re-deriving from that sentence would conclude no single-command fixture existed at all.

### 5.3 `developer-tooling` is now granted `packages/core` while being told engine work is elsewhere

AC-6 directs the `:13` boundary sentence to name `packages/core/src/engine/` where it named
`spike/src`, and that is what shipped. The literal substitution is not quite the same shape as
what it replaced: `spike/src` was **outside** the role's paths, so the sentence was a boundary;
`packages/core` is **inside** them, so it is now a default that the next paragraph
(*"which of you owns a given file is your task's description and not the directory"*) can override.
The two sentences do not contradict — the second was always the tie-breaker — but the first is
weaker than it was. Left as the requirement directs rather than reworded, since rewording it is a
write-contract decision and not machinery.

### 5.4 Derived and out-of-scope copies still naming the spike, deliberately

- **`.claude/rules/engineering.md:4`** still carries the `spike/**` ESLint clause that
  `harness/rules.md` has just dropped. It is a derived copy and **not a surface a criterion may
  name** (*"`.claude/rules/` is a derived copy, not a surface a requirement may name"*,
  2026-08-27); `harness/rules.md`'s own header says this file wins and the other is the drift.
  Syncing it is the human's.
- **`CLAUDE.md:25` and `:35`** still say the runnable code is the spike and give
  `node spike/bin/harness.js …` as a command. Child C's (AC-25), listed in §6's non-goals.
- **`eslint.config.js`**'s `'spike/**'` ignore — Child C AC-23, and OQ-3 already settled that it
  stays.
- **`harness/port-charter.md`** — untouched, which matters because
  `.github/scripts/port-freeze-guard.sh` reads it.

---

## 6. What was deliberately left alone

- Everything under `spike/` except the two template files AC-6 and AC-29 require, which the freeze
  does not cover (`port-freeze-guard.sh` watches `spike/src`) and which `templates.test.ts`
  requires move together. **Nothing was deleted, moved or removed.**
- The 25 `packages/**` dependencies on the spike — Q-0107's, and the reason it exists. In
  particular `test-command.test.ts`'s `spikeSources()` was **not** touched: §3.4(c) is right that
  the inherited AC-2 points there in error, and it holds Q-0107 AC-16's machinery.
- `packages/core/src/spike-parity.test.ts`, the CI jobs, `git-identity-sweep.sh`'s phases, the
  seven `turbo.json` spike inputs, `README.md`, `docs/`.
- `harness/product-context.md` — carries zero `spike` tokens, confirmed, and is not in scope.
- Q-0100's `harness`-versus-`quorum` spellings, which AC-4 and AC-5 both edit prose within a line
  of. §6 names this the sharpest temptation; nothing was changed in passing.
- Any successor for §5.1. Per *"resolve rather than open a successor"* it would have to be a ticket
  — the fix belongs in a file this child may not edit, and it lands naturally at Q-0107 AC-18.

---

## 7. Open, for the gate

- **GO-1 is the one the gate must actually rule.** `harness/roles/developer-generalist.md` still
  contains `spike` after this merge, against the inherited criterion saying no role file may. That
  is the §3.4(b) ruling implemented, and **advancing the gate is the ratification**. If the gate
  prefers the inherited form instead, Q-0107 AC-8 and Q-0103 AC-20 each need an explicit path grant
  written into their bodies before either is launched, and this role file must be edited a second
  time. The note in the file is R-4's mitigation and names Q-0103 by id.
- **GO-2 is unchanged and unsatisfiable here.** This child's `integrate` runs the **old** commands —
  `config` is a `runFlow` parameter and is never re-read — so the new ones are proven by
  **Q-0107's `integrate`** and not by this run. Nothing in this report should be read as evidence
  that `pnpm install --frozen-lockfile` and `pnpm turbo run test --force --continue` work as
  `integrate` runs them; what it does report is that both were executed by hand in this worktree,
  green, which is R-2's residual risk reduced and not closed.
- **GO-4** — the plan bullet is the human's to rewrite at the close.
- **OQ-1** (should the two fan-out roles now merge) and **OQ-2** (the role tree is only partly
  mirrored) are unchanged and untouched; §5.1 above is arguably a third, and is registered rather
  than opened.
