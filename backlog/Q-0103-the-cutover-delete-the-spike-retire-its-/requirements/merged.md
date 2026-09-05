# Q-0103 — The cutover: delete the spike, retire its CI job and its charter

*Merged requirement, run 1, iteration 2. Written against the tree at `83b193c`, 2026-09-05.*

*Every figure below was re-measured against the tree for this iteration rather than carried from
iteration 1. Where iteration 1's own merged document was wrong, §3.4 names it rather than quietly
correcting it — a corrected number that travels without its correction is this repository's
most-recorded defect, and iteration 1 is now one of the documents that has to be checked against the
tree.*

---

## 0. Verdict, stated first

**needs-input**, on size and sequencing rather than on substance, and with one procedural finding
that comes before the other three.

**This iteration opened on an unchanged tree.** `HEAD` is `83b193c` — the same commit iteration 1
judged. `docs/decisions/` still ends at `078-the-emit-serves-the-binary.md`. `backlog/` still ends at
Q-0105. The only untracked paths are this run's own `requirements/` directory and `runs.log`. All
three of iteration 1's blockers are work **no step on the chore route may perform**, so none of them
could have been cleared between the two iterations, and none was.

That is the third observation in this repository of *a retry on an unchanged tree cannot rule its own
blocker* — Q-0090's requirements run recorded it, Q-0096's recorded it again in the same week, and
both were **advanced at the gate rather than retried**. The same is recommended here. A third
iteration would return this verdict a third time.

The iteration was not idle, because the central measurement was wrong:

| | Iteration 1 | Measured now |
| --- | --- | --- |
| Files under `packages/**` depending on `spike/` | 16 | **25** |
| How they fail on deletion | all loudly, at import or first call | **16 loudly, 9 silently or not at all** |
| Production-source exceptions | 2 JSDoc citations | **3, one of them pinned by a live assertion** |
| Criteria | 26 | **28** |

The four blockers:

1. **28 criteria against a ceiling of fifteen.** §4 rules the cut and §5 distributes them 7 / 12 / 9.
2. **GO-1 — a decision entry is owed before the middle child's implement step**, and its subject has
   grown: it is now *what a test compares against once the witness is gone* **and** *what becomes of
   a guard whose subject is deleted*.
3. **GO-2 — three real ticket ids**, not `Q-0103a/b/c`.
4. **The unchanged tree above**, which is why 1–3 are still here.

Everything else either candidate raised as open is **ruled below** rather than passed upward.

---

## 1. Problem

`packages/cli` dispatches all eight commands and `packages/core` holds the logic, so `spike/` has no
remaining *product* reader. It has twenty-five remaining *test* readers, and that is the gap between
what the ticket body describes and what the work is.

The body's model is *"delete a tree and repair what pointed at it"*, where what pointed at it is a CI
job, two commands, two comments and four documents. Measured, there are **three** classes and the
body's model fits only the first.

**Class 1 — citation (fits the body's model).** 55 of the 63 production source files under
`packages/*/src` name the spike, almost all in JSDoc obeying the engineering rule's *"one line naming
the authority"*. They become dangling references and nothing breaks. §7 makes the sweep a named
non-goal — with three exceptions §3.3 enumerates.

**Class 2 — reads it from disk, fails loudly.** Sixteen files, through a helper written for the
purpose:

```
packages/shared/test/corpus.ts:89
  /**
   * A file under `spike/`, read as text. The spike is frozen for the port and is its only
   * independent witness (harness/port-charter.md §3), so the constants tests compare against it
   * rather than against a transcription of it.
   */
  export function spikeSource(relative: string): string {
```

`repoFile` **throws** on a missing file and `spikeLintFlow()` imports and executes
`spike/src/lint.js`. Deleting `spike/` today does not degrade into vacuous green — it fails sixteen
files at import or first call. That is honest behaviour and is why this class is visible.

**Class 3 — names it without reading it, and goes silent.** Nine files, which iteration 1 does not
have. Six of them are `*.source.test.ts` guards of this shape:

```
packages/core/src/lint/lint.source.test.ts:66
  expect(line.includes('spike'), `${name} must not reach into the spike: ${line}`).toBe(false);
```

After the cutover that is a guard forbidding an import from a directory that **cannot exist**. It
will report green forever, over no subject. This is the class the repository has ruled on three times
— *"a check that skips its subject must not report success"* (2026-08-25), *"A check is not
established by reading it"* (2026-08-29), and the OQ-1 argument that *a job that cannot fail is worse
than one that is missing* — and it is the class with **no criterion in either candidate**.

`packages/core/src/test-command.test.ts` records the same shape happening once already, at `:211`:
Q-0054 AC-8 found that `(jobs['spike']?.steps ?? [])` *"reads as a check on the `spike` job and is
satisfied"* by that job's removal. And at `:502` the same file anticipates this ticket by name:

> *Q-0009 drops the `spike` job together with `spike/` and `src/spike-parity.test.ts`, and updating
> one line here is how that becomes a decision instead of an accident.*

**This reframes the ticket.** The cutover is the **retirement of the port's independent witness**, and
it asks two questions this repository has never written down — *what does a test compare against when
the thing it compared against is gone?* and *what becomes of a guard whose subject is gone?* — both
of which are GO-1's subject.

**Who feels it.** The `maintainer` cannot land M2's last item, and M3 queues behind it. The
`contributor` inherits a repository whose regression story is stated in four documents that all
become false the moment this lands. The `adopter` feels one narrow consequence: `quorum init`
scaffolds a role whose write-path list contains `spike`, a directory their repository never had.

---

## 2. User stories

- **As the `maintainer`,** I want `spike/` gone and `pnpm test` green in the same commit, so the
  repository has one tree, one suite and one truth.
- **As the `maintainer`,** I want every re-aimed check demonstrated **red before green while the
  spike still exists**, so I am not asked to believe a guard whose subject was deleted in the same
  change that rewrote it.
- **As the `maintainer`,** I want no check left behind that cannot fail, so a tick that survives the
  cutover means what it meant before it.
- **As the `maintainer`,** I want `commands.install` and `commands.test` proven by a real
  `integrate`, not by reading the YAML, because a mistake there is caught by the next run failing in
  its worktree rather than by any test.
- **As the `contributor`,** I want `harness/rules.md` and `harness/architecture.md` to describe the
  repository I cloned, so the instructions fed to every agent at run time do not tell me to install
  and run a suite that is not there.
- **As the `adopter`,** I want `quorum init` to scaffold a harness whose roles do not grant me write
  access to a directory that has never existed in my project.

---

## 3. What was measured

### 3.1 The body's figures, confirmed exact

| Claim | Measured | Verdict |
| --- | --- | --- |
| `spike/` is 55 tracked files, 9,732 lines | `git ls-files spike \| wc -l` → 55; `xargs wc -l` → 9732 | **exact** |
| `spike-parity.test.ts` is 1,957 lines | `wc -l` → 1957 | **exact** |
| `harness/port-charter.md` is 516 lines | `wc -l` → 516 | **exact** |
| Seven CI jobs become three | jobs at `:21 :46 :70 :92 :106 :147 :173` | **exact** |
| A chore run would die at its own `integrate` | `config` is a `runFlow` parameter never re-read; `ctx.config.commands?.{test,install}`; the environment `FlowError`; the `composite.ts` twin | **exact, and the reasoning holds** |

The body's mechanism section is its best part and nothing below weakens it.

### 3.2 The dependency set — 25 files in three classes

**Class 2 — reads the spike from disk, fails loudly (16).**

| File | How it reads | Sites |
| --- | --- | --- |
| `packages/shared/test/corpus.ts` | **defines** `spikeSource`, `spikeLintFlow`, `frontmatterRegexMatchesSpike` | 5 defs |
| `packages/shared/src/constants.test.ts` | helper calls | 14 |
| `packages/shared/src/events.test.ts` | helper calls | 10 |
| `packages/shared/src/flow.test.ts` | incl. `spikeLintFlow()` — **imports and executes `spike/src/lint.js`** | 7 |
| `packages/shared/src/project.test.ts` | incl. `spike/templates/harness/harness.yaml` — Q-0058's census oracle | 5 |
| `packages/shared/src/stages.test.ts` | the STAGES literal's second witness | 1 |
| `packages/shared/src/ticket.test.ts` | `frontmatterRegexMatchesSpike()` — Q-0060's regex pin | 1 |
| `packages/shared/src/role.test.ts` | helper call | 1 |
| `packages/shared/src/docs.test.ts` | `repoFile('spike/src/contracts.js')` `:307` — `TERMINAL_STATUSES` | 1 |
| `packages/core/src/turbo-inputs.test.ts` | helper call plus register rows naming five spike routes | 1 + rows |
| `packages/core/src/backlog/backlog.test.ts` | `repoFile('spike/test/q0080-allocation.json')` `:75` | 1 |
| `packages/core/src/lint/lint.test.ts` | `SHIPPED = ['harness/flows', 'spike/templates/harness/flows']` `:871` | link 1 |
| `packages/cli/src/templates.test.ts` | `SPIKE_TEMPLATES` `:50`, compared `:152` | link 2 |
| `packages/core/src/git-identity.test.ts` | corpus row `{ dir: 'spike/test', … }` `:28` | 1 |
| `packages/core/src/test-command.test.ts` | `spikeSources()` walks `spike/src` `:53`; the `spike`-job reads `:485` | several |
| `packages/core/src/spike-parity.test.ts` | walks `spike/test` — deleted, and the only one the body has | — |

**42 read sites** by the definition in §3.4(c).

**Class 3 — names it without reading it, goes silent or dangles (9).**

| File | What it holds | What happens at the cutover |
| --- | --- | --- |
| `packages/core/src/adapters/adapters.source.test.ts:129` | `must not reach into the spike` | **green forever, no subject** |
| `packages/core/src/backlog/backlog.source.test.ts:60` | same | **green forever, no subject** |
| `packages/core/src/contracts/contracts.source.test.ts:76` | same | **green forever, no subject** |
| `packages/core/src/fanout/fanout.source.test.ts:126` | same | **green forever, no subject** |
| `packages/core/src/lint/lint.source.test.ts:66` | same | **green forever, no subject** |
| `packages/core/src/run-history/run-history.source.test.ts:121` | same | **green forever, no subject** |
| `packages/shared/src/step-output.test.ts:61–63` | **requires** `step-output.ts` to contain `spike/src/contracts.js` and two `spike/src/adapters/index.js:NNN` citations | **pins a dangling citation, or goes red if it is fixed** |
| `packages/cli/src/package.test.ts:161, :187` | parity-chain register row; turbo input `'../../spike/templates/harness/**'` | **must change; no criterion in either candidate** |
| `packages/core/src/fanout/fanout.test.ts:48–141` | transcribed spike cases, `spikeWorktreeDir` provenance | comment-only; register the transcription's source |

`step-output.test.ts` is the sharpest of these: it makes the JSDoc-citation sweep that both candidates
filed as a non-goal **impossible to defer whole**, because a live assertion requires three of those
citations to stay.

### 3.3 The production-source exceptions — three, not two

Both candidates' rule *"no production source changes"* is unsatisfiable, and iteration 1 found two of
the three exceptions:

| File | Cites | Why it must change |
| --- | --- | --- |
| `packages/cli/src/ticket.ts:8` | `spike/test/q0080-allocation.json` — *"the one copy both trees read"* | AC-8 **moves** that file |
| `packages/shared/src/role.ts:30` | `spike/test/smoke.js` compares `paths:` against the role table | AC-18 replaces that check |
| `packages/shared/src/step-output.ts:12,16,19` | three `spike/src/...` validator locations | **pinned by `step-output.test.ts:61–63`** — new |

AC-19 makes the list exhaustive and testable. This is the fifth instance in this stretch of a
criterion's prose read as a literal contract (Q-0091 E-3, Q-0094 E-1/E-2/E-3(b)), and the rule those
produced applies: *a requirement describes what must be conveyed; only a fixture, a frozen contract's
own file, or a criterion quoting bytes pins bytes.*

### 3.4 Corrections carried forward, so they cannot travel unlabelled

**(a) The freeze jobs are 60 lines, not 46.** They span `ci.yml:46–105`. The ticket body says 46.

**(b) `port-freeze-guard.test.mjs` is executed — the body's OQ-3 is refuted.** `ci.yml:64`:

```yaml
      # The guard's own suite, which until now was executed by nothing — not CI, not `pnpm test`,
      # not the spike suite. … a guard nobody runs is a guard nobody has.
      - run: node .github/scripts/port-freeze-guard.test.mjs
```

The claim was true when Q-0079 wrote it, was fixed by the later change that added this step, and was
then copied into `06-development-plan.md` and from there into the ticket body. One command refutes
it. The codex candidate expects the same wrong answer (*"the expected answer is no"*).

**(c) The read-site total is 42, and it was right for the wrong reason.** Iteration 1 gave *"40 helper
calls plus two direct `repoFile('spike…')`"*. Measured: **40 helper call sites on 39 lines** (one line
carries two) and **three** direct `repoFile('spike…')` — `spike-parity.test.ts:1091`,
`backlog.test.ts:75`, `docs.test.ts:307`. Excluding the one inside the file deleted wholesale, the
total is 42. Two errors cancelled. **AC-10's register enumerates from the tree and may not trust this
number**, which is the whole reason it is stated here with its derivation.

**(d) The dependency set is 25 files, not 16** — §3.2.

### 3.5 Two findings that change what must be built

**(a) The template parity chain is two links, and the cutover breaks both.**

```
harness/flows/ ←[lint.test.ts:871]→ spike/templates/harness/flows/ ←[templates.test.ts:50]→ packages/cli/templates/harness/
```

`packages/cli/src/package.test.ts:161` names it in as many words — *"link 2 of that chain"*. Delete
the middle term and the two surviving shipped copies are connected by **nothing**, so
`harness/flows/chore.yaml` and its `packages/cli` mirror may drift silently. That is what Q-0086
recorded (*"`lint.test.ts`'s existing parity assertion would have failed had only one moved"*), and
Q-0087/Q-0088's artifact-scoping rule rests on both copies moving together. **Two links are replaced
by one direct link; they are not deleted.**

**(b) `spike/test/q0080-allocation.json` is shared data, not spike code.** `spike-parity.test.ts:347`
calls it *"the allocation table both trees assert over … a `.json` precisely so `run.js`, which
discovers `*.js`, does not execute it"*. A flat "delete `spike/`" destroys it. **It moves.**

### 3.6 Surfaces the body omits

- **`harness/architecture.md`** (104 lines) — an input to every chore `implement` step
  (`harness: [rules.md, architecture.md]`), carrying eleven spike references: the role write-path
  table `:27–29`, the machine-read third column `:51`, the ownership sentence `:64`, the freeze
  paragraph `:69–75`, the qa-red sentence `:88`, the template-sharing paragraph `:94`. Q-0098
  established that a false claim in a harness context file is inherited by every future run. **The
  freeze does not block this ticket** — `:69` scopes it to Q-0041–Q-0054 and the same paragraph says
  *"Every other ticket may still write there"* — which is worth stating, because an implementer
  reading `:69` mid-run could reasonably stop.
- **`harness/rules.md:12–15`** — instructs every agent to run `npm install --prefix spike` and
  `npm test --prefix spike`, and cites `spike/src/engine.js:1034`. The body's OQ-2 asks only about the
  ESLint sentence at `:33`. After the cutover this paragraph makes every implement step run a command
  that fails, which is larger than the sentence OQ-2 asks about.
- **Four role files** — three under `harness/roles/` and, `adopter`-facing,
  `packages/cli/templates/harness/roles/developer-generalist.md`.
- **`developer-tooling`'s list collapses.** `harness/roles/developer-tooling.md:4` is
  `[spike/bin, spike/test, packages/core, packages/shared]`. Strip the spike halves and it is
  `[packages/core, packages/shared]` — a **proper subset** of `developer-backend`'s remainder, and it
  **excludes `packages/cli`**, the package `architecture.md:29` says the role exists for (*"argument
  parsing, terminal output, exit codes, the regression suite"*). Iteration 1 filed this as
  non-blocking OQ-8, *"may have evaporated"*. Measured, it is not a maybe. **AC-7.**
- **Seven `turbo.json` spike inputs** — `shared` 3 (`:34–36`), `core` 3 (`:40,:46,:47`), `cli` 1
  (`:58`) — with their explanatory comments, plus `package.test.ts:187`'s copy of the `cli` one.
- **`git-identity-sweep.sh`** — phase `install` runs `( cd spike && npm ci )` at `:117` and phase
  `spike suite` runs `( cd spike && npm test )` at `:120–121`. `test-command.test.ts:467` pins the
  five-phase list as a hand-written literal, so script and test move together.
- **`docs.test.ts:417`** pins the literal ``'`packages/cli` wraps core with the spike\'s commands'``
  against `06-development-plan.md`. Editing that sentence — which this ticket must — turns the suite
  red unless the assertion moves in the same change.
- **Role `paths` is advisory, and its only check dies here.** `packages/shared/src/role.ts:26–31`:
  *"Nothing reads it … `spike/test/smoke.js` compares it against the third column of the role table in
  harness/architecture.md, which is the only thing that checks it at all"*, corroborated by
  `architecture.md:51`. So the four config surfaces outside the generalist's list are not mechanically
  refused — this is not a decision-047 blocker — but deleting `smoke.js` removes the only thing
  keeping the role files and the table agreeing.

---

## 4. The sequencing ruling — three children, and why not two

The body offers three routes and asks this run to rule. **Ruled: split, into three.**

The body's two-way cut is drawn at the commands. That boundary is **correct and necessary** — the
mechanism forcing it was verified — but it is not **sufficient**, for a reason the body could not see
because it did not know §3.2 existed:

> **You cannot demonstrate a re-aimed oracle red-before-green once its subject is deleted.**

Twenty-five files must stop depending on the spike. Each change is a deletion of coverage, a re-aim,
or a transcription, and the only honest way to show a re-aim is to run it against the tree it used to
read. Do that in the change that deletes the tree and all of them are verified by reading — which is
*"A check is not established by reading it"* (2026-08-29), the port's most expensive lesson, arriving
at its own funeral.

| Child | Subject | `spike/` | Criteria |
| --- | --- | --- | --- |
| **A** | The commands, the context files and the roles stop naming the spike | **stays** — its own `integrate` runs the run-start commands, which still work | AC-1 – AC-7 (7) |
| **B** | The workspace stops depending on the spike | **stays** — every re-aim is provable red-then-green against the real tree | AC-8 – AC-19 (12) |
| **C** | The deletion, the CI jobs, the charter and the documents | **deleted** — nothing depends on it by now | AC-20 – AC-28 (9) |

Only C's `integrate` runs the new commands, and by then they name no spike, so the deletion in that
change is safe — the body's own step-2 argument, preserved.

**B is twelve and that is deliberate.** It is under the ceiling of fifteen and it is the child that
must not also carry the deletion; splitting it further would separate a re-aim from the register row
that disposes of it. If the gate wants it smaller, the seam is AC-12 + AC-13 + AC-19 — the *silent*
class and its production citations — which is a coherent ticket on its own.

**The manual route decision 035 also offers is rejected for B and kept as a fallback for C.** B is
where every judgement lives — which oracle dies, which is re-aimed, which moves — so it is exactly the
change that must be seen by a second vendor. C is mechanical once B lands.

**Order: A → B → C, one at a time.** Not concurrent: Q-0039 is unfixed, so two runs would share a
worktree and compute the same run id.

---

## 5. Acceptance criteria

Numbered continuously across the three children, so a criterion keeps its name if the gate re-cuts
them.

### Child A — the commands, the context files and the roles

**AC-1 (replaces ground rule 1, made satisfiable).** Across all three children, no file under
`packages/*/src` that is not a `*.test.ts` changes **except** the JSDoc citations AC-19 enumerates.
*Test:* `git diff --name-only <base>...<tip> -- 'packages/*/src/**'` lists only `*.test.ts` paths,
`packages/shared/test/corpus.ts`, and files on AC-19's list. **A behavioural production change is a
finding to report at the gate, not to make** — it is the signal that something still depends on the
spike, which is what ground rule 1 was reaching for.

**AC-2.** `harness/harness.yaml`'s `commands.install` is `pnpm install --frozen-lockfile` and
`commands.test` is `pnpm turbo run test --force --continue`, with no `npm … --prefix spike` half.
`--force`, `--continue` and `timeout_ms` survive verbatim with their reasons: they are Q-0065's and
Q-0050's, not the spike's. *Test:* the shipped file, asserted by
`packages/core/src/test-command.test.ts`, whose Q-0065 AC-3 assertion is **re-aimed rather than
deleted**.

**AC-3.** `harness/harness.yaml`'s comment blocks claiming two dependency sets and two suites (`:30`,
`:35`) are removed, and no sentence claiming two suites survives in that file — including the header
at `:1`, which calls the config *"(spike)"*.

**AC-4 (settles OQ-2, widened).** `harness/rules.md` states one suite: the install-and-run instruction
at `:12–15` names `pnpm install --frozen-lockfile` and `pnpm turbo run test --force` only, the
ESLint-scope sentence at `:33` loses its `spike/**` clause, and the `spike/src/engine.js:1034`
citation is replaced by its `packages/core` counterpart. **`.claude/rules/` is named by no criterion**
— it is a derived copy (*"`.claude/rules/` is a derived copy, not a surface a requirement may name"*,
2026-08-27) and its sync is the human's.

**AC-5.** `harness/architecture.md` no longer describes the spike as a live tree: the role table's
three rows drop their spike paths, the `:51` sentence about the machine-read third column is
re-pointed at AC-18's counterpart, and the freeze paragraph `:69–75`, the ownership sentence `:64` and
the qa-red sentence `:88` go; the template-sharing paragraph `:94` names
`packages/cli/templates/harness/` as the counterpart of `harness/flows/`. *Stated so a reviewer does
not read it as scope creep:* this file is an input to every chore `implement` step, so a false claim
here is inherited by every future run.

**AC-6.** The three `harness/roles/*.md` and
`packages/cli/templates/harness/roles/developer-generalist.md` drop `spike` from their `paths:` and
their freeze prose, so `quorum init` stops scaffolding an adopter a write path to a directory they do
not have. In the same change, `developer-generalist`'s `paths:` gains `README.md`, `eslint.config.js`
and `vitest.shared.js`; **`CLAUDE.md` is excluded and stays the human's**, being the vendor dialect of
the canonical harness. *Test:* no `harness/roles/*.md` or
`packages/cli/templates/harness/roles/*.md` contains the token `spike`. *Why here rather than in B:*
editing the role that governs your own step is the Q-0086 hazard, so the widening lands one ticket
ahead of the step that relies on it.

**AC-7 (new — measured, and it is not a maybe).** `developer-tooling`'s `paths:` gains `packages/cli`.
Stripped of `spike/bin` and `spike/test` it would be `[packages/core, packages/shared]` — a proper
subset of `developer-backend`'s remainder, and it would exclude the one package
`harness/architecture.md:29` says the role exists for. *Test:* `developer-tooling.md`'s `paths:` names
`packages/cli`, and the role table's third column agrees with it. Whether the two roles should now
**merge** is out of scope and is OQ-4.

### Child B — the workspace stops depending on the spike

**AC-8.** `spike/test/q0080-allocation.json` **moves** into the workspace — recommended
`packages/core/src/backlog/q0080-allocation.json`, beside its one remaining reader — with its
`"about"` prose corrected to name one tree. `backlog.test.ts:75` reads the new path. *Test:* the
table's row count and the test's assertion count are identical before and after.

**AC-9.** `packages/shared/test/corpus.ts` exports no `spikeSource`, `spikeLintFlow` or
`frontmatterRegexMatchesSpike`, and no file under `packages/**` calls one. *Test:* an assertion in the
suite, so a re-introduction fails rather than merely being unusual. The file itself **stays** — it
still exports `repoFile`, `flowFiles`, `roleFiles`, `decisionFiles` and others used workspace-wide —
and its JSDoc, written around the witness role, is **rewritten rather than trimmed**.

**AC-10 — the criterion this ticket exists for.** Every dependency in §3.2 is dispositioned in a
**register carrying one sentence per site**, with exactly four permitted verdicts: `retired` (the
property is proven elsewhere — the sibling assertion is named), `re-aimed` (the same property, now
asserted against `packages/**` — the new subject is named), `transcribed` (the spike's literal becomes
a pinned constant — permitted only on the authority GO-1 supplies), or `moved` (AC-8's shape). A site
with no verdict fails the register. **The register enumerates the sites from the tree and may not
trust §3.2's or §3.4(c)'s counts** — those are stated with their derivations precisely so that a
transcription of them is visible as one.

**AC-11.** Every `re-aimed` site is **demonstrated red before green against the live spike tree**,
recorded in the implement report by assertion name and failure message. This is what forces Child B to
land before the deletion, and it is unsatisfiable after it.

**AC-12 (new — the silent class).** The six `*.source.test.ts` guards asserting that a `packages/core`
module *"must not reach into the spike"* — `adapters:129`, `backlog:60`, `contracts:76`, `fanout:126`,
`lint:66`, `run-history:121` — are each `retired` or `re-aimed` under AC-10's register, and **none
survives as a clause that cannot fail**. Recommended `re-aimed`: the live property is the positive one
those tests already state in their own names — the folder imports node builtins, `@quorum/shared` and
its own siblings, and nothing else — so the allow-list becomes the assertion and the spike clause stops
being a special case. *Test:* for each of the six, adding a disallowed import to the module under test
fails it. **Authority for treating this as in scope:** `test-command.test.ts:211` records Q-0054 AC-8
finding the identical shape — a check satisfied by its subject's removal — and `:502` names this
cutover as the moment such a line becomes *"a decision instead of an accident"*.

**AC-13 (new).** `packages/shared/src/step-output.test.ts:61–63` requires `step-output.ts` to contain
`spike/src/contracts.js` and two `spike/src/adapters/index.js:NNN` citations. Both the assertion and
the three citations in `step-output.ts` are re-aimed at the `packages/**` locations of the same four
validators, together, in one change. *Test:* the assertion names no `spike/` path, and each path it
does name exists. *Why it cannot be deferred to §7's sweep:* a live assertion pins it, so leaving the
citations dangling is not passive — it is enforced.

**AC-14.** The parity chain becomes one direct link: `lint.test.ts:871`'s `SHIPPED` becomes
`['harness/flows', 'packages/cli/templates/harness/flows']`; `templates.test.ts:50,152` compares
`packages/cli/templates/harness/` against the byte-shared set `harness/architecture.md:94` names, in
both directions, reported separately as it already is; and **`package.test.ts:161`'s register row is
rewritten to describe the new one-link chain**. *Test:* mutating one byte of `harness/flows/chore.yaml`
fails the guard **and** mutating one byte of the `packages/cli` copy fails it — the bidirectionality
Q-0093 mutation-tested is preserved.

**AC-15.** `git-identity.test.ts`'s corpus drops its `spike/test` row (`:28`), and the assertion that
`spike/test` must be in the corpus is **replaced by an assertion that the corpus is non-empty and names
the directories it does cover**. *Test:* emptying the corpus list fails. Q-0079's tripwire must not
become a check with no subject in the change that shrinks its subject.

**AC-16.** `test-command.test.ts` drops `spikeSources()` (`:53`), the assertions that consume it
(`:86`, `:93`), the `spike`-job reads (`:485–486`) and the `asItWas` register; its phase list at `:467`
loses `'spike suite'`, matched to `.github/scripts/git-identity-sweep.sh`, which loses that phase
(`:119–121`) and the `( cd spike && npm ci )` line in `install` (`:117`). *Test:* the script and the
test agree on the phase list, **derived rather than hand-written in both** — `:467` is a hand-written
literal today, which is the shape Q-0051 found failing open.

**AC-17.** The seven spike `inputs` across the three `packages/*/turbo.json` go with their explanatory
comments, `package.test.ts:187`'s copy of the `cli` one goes with them, and `turbo-inputs.test.ts`'s
register rows follow. *Test:* the guard passes, **and no declared input names a path that does not
exist** — the one direction it does not currently check, and the direction this ticket creates.

**AC-18.** The loss of the role-table check is closed rather than registered: `smoke.js` is the only
thing comparing a role's `paths:` against `architecture.md`'s third column, and Child C deletes it, so
**a `packages/**` counterpart is written**. Recommended over a JSDoc note because AC-5, AC-6 and AC-7
edit both sides in the same stretch, so drift between them is newly possible and newly likely. *Test:*
changing one role's `paths:` without the table fails, and vice versa.

**AC-19.** The production-source JSDoc citations naming a moved, replaced or deleted subject are
corrected, and they are the **only** permitted production-source change: `packages/cli/src/ticket.ts:8`
(cites the fixture AC-8 moves), `packages/shared/src/role.ts:30` (cites `smoke.js`, which AC-18
replaces), and `packages/shared/src/step-output.ts:12,16,19` (pinned by AC-13). *Test:* the list is
exhaustive — no other `packages/*/src` non-test file changes. Citations that merely name a deleted path
**without claiming it is read and without a test pinning them** are §7's non-goal.

### Child C — the deletion

**AC-20.** `spike/` is deleted — 55 tracked files, including `spike/src/**`, `spike/bin/**`,
`spike/test/**`, its npm manifest and its lockfile. *Test:* `git ls-files spike` returns nothing.

**AC-21.** `packages/core/src/spike-parity.test.ts` and `harness/port-charter.md` are deleted. No
replacement parity test, inventory, freeze SHA, mirror procedure or port register is introduced.

**AC-22 (settles OQ-1).** `.github/workflows/ci.yml` holds exactly three jobs — `workspace`,
`git-identity-sweep-bare`, `git-identity-sweep-populated` — with their commands, cache policy, forced
execution and hostile-environment checks unchanged. The four retired jobs are `spike` and the three
port-freeze jobs; `.github/scripts/port-freeze-guard.sh` and `port-freeze-guard.test.mjs` go with them.
**Authority:** `port-freeze-guard.sh:45` — *"`$CHARTER` is missing, so the freeze policy cannot be
read. The guard refuses to pass on a policy it cannot find."* — so all three freeze jobs go **red on
every push** the moment AC-21 lands. They are coupled to the charter, not merely made pointless by it;
this is mechanical, not a preference. **Before deletion, a tracked-file search records every caller of
both scripts.** The known caller is `ci.yml:64`; any *other* surviving caller stops implementation and
is reported at the gate rather than edited in passing. *Test:* `test-command.test.ts`'s seven-job
register becomes a three-job register and is **shown red against the old workflow** — the register at
`:509–513` exists for this and says so at `:502`.

**AC-23.** `eslint.config.js` drops `'spike/**'` from `ignores` with its Q-0009 comment; the configured
file scope and rules are otherwise unchanged, and no new violation appears from the removal.
`vitest.shared.js`'s citation of `spike/test/run.js` is **reworded, not deleted** — the discovery
guarantee it explains is live and `test-discovery.test.ts` enforces it, so the reasoning survives its
source. No include pattern is narrowed and the `dist/**` exclusion stays.

**AC-24.** `README.md:8` and `CLAUDE.md:25,35` no longer say the runnable code is the spike.
`CLAUDE.md`'s Commands section names the two paths Q-0098 shipped — `pnpm exec quorum` in the
workspace, and the locally packed install — and **does not claim registry-resolved `npx quorum`**.

**AC-25.** `docs/04-architecture.md` describes **one** required suite, what it proves, and the chain
from a new failing file to a red `pnpm test`; the two-suite paragraph, the transfer share and the
`spike-parity.test.ts` sentence go, and the status line is bumped with the date and what changed.

**AC-26.** `docs/06-development-plan.md`'s M2 done-when reads one suite and Q-0010 §5's follow-up is
recorded as done, **and `docs.test.ts:417`'s literal pin moves in the same change** — editing that
sentence without it turns the suite red. Historical accounts stay historical and are not rewritten
merely because they mention the spike.

**AC-27.** A tracked-file search after the deletion finds no **live** instruction, command, CI
definition, test, configuration entry or script depending on a path under `spike/`,
`harness/port-charter.md`, or the port-freeze scripts. Past-tense historical records and
`docs/decisions/` are excluded, and the JSDoc citations covered by §7's non-goal are excluded.

**AC-28.** After the merge, CI runs the three retained jobs against the resulting commit and all three
pass; **no deleted job appears as passed, failed or skipped**, because it no longer exists.
`pnpm lint`, `pnpm typecheck` and `pnpm turbo run test --force` are green with no cache-served verdict,
verified in both environment rows per Q-0072's closing finding. No file under `docs/decisions/` is
edited.

---

## 6. Gate obligations

**GO-1 — the decision entry, owed before Child B's implement step. BLOCKING.** Its subject is now
**two questions, not one**:

- *What does a test compare against once the port's independent witness is gone?* — AC-10's four
  verdicts are a policy, and `corpus.ts:89`'s own JSDoc argues against one of them (*"compares against
  it rather than against a transcription of it"*), so `transcribed` needs an authority the register can
  cite.
- *What becomes of a guard whose subject is deleted?* — AC-12's six. `test-command.test.ts:502` already
  frames this as *"a decision instead of an accident"*, and the repository has three rulings in the
  neighbourhood without one that covers it.

No step on the chore route may write it (`harness/roles/developer-generalist.md:23`). **Do not launch
Child B without it.** Fourteenth appearance of a loop handed work no agent in it can perform; Q-0062
paid ~$30 and Q-0101 $31.16 for the same omission, both after their requirements had named it in
advance.

**GO-2 — three real ids. BLOCKING.** `nextId()` parses `<PREFIX>-nnnn` and knows no sub-ticket, so
`Q-0103a/b/c` would share one integration branch and one run-id space. Recommended: **Q-0103 keeps the
deletion** (it is what its title describes) and two ids are allocated ahead of it through
`harness ticket new`.

**GO-3 — ground rule 2 is an exit condition, not a criterion.** Child A is not done until a real
`integrate` has passed with the new commands. Since Child A's own `integrate` runs the *old* ones,
**the proof is Child B's `integrate`, and Child C must not be launched before it is seen green.**

**GO-4 — each child's folder is added to `06-development-plan.md` as it is created**, or
`plan-backlog.test.ts` goes red on ticket creation rather than on implementation.

**GO-5 — advance, do not retry.** This iteration opened on an unchanged tree (§0) and a third would
too. Q-0070, Q-0079, Q-0090 and Q-0096 all reached this state and were advanced at the gate once the
human had done the work the flow cannot.

---

## 7. Non-goals

Inherited and confirmed:

- **Registry-resolved `npx quorum`** — refused while every package is `"private": true`; Q-0029's, in M6.
- **Any fix to Q-0102**, whose subject is a flaky oracle under load. It will still be red after this
  ticket; AC-17 makes its `@quorum/core` input set smaller without fixing it.
- **Q-0059, Q-0060, Q-0066, Q-0068, Q-0100** — the defects that landed in both trees. Each becomes
  smaller, none is closed. Q-0100 is the sharpest temptation: AC-24 edits `CLAUDE.md`'s Commands line,
  one line from a `harness` spelling Q-0100 owns.
- Preserving the spike as an archive, submodule, tarball or fixture; retaining a second suite;
  replacing the parity test with a comparison against archived files; editing landed decisions;
  changing flows, adapters, the cross-vendor rule, gates, worktree containment or run-history formats;
  adding a dependency; anything on the v1 exclusion list.

Added here:

- **The JSDoc citation sweep across production source.** 55 of 63 files under `packages/*/src` name the
  spike, almost all in comments that become dangling references. It is a mechanical sweep with no
  behaviour attached; it would swamp the review of three changes that do have behaviour, and the
  engineering rule those comments obey (*"one line naming the authority"*) is satisfied by a ticket-id
  citation even where the path is gone. **It is owed its own ticket and is registered here so the
  obligation does not expire.** The three exceptions are AC-19's, and AC-13 is the reason the sweep
  cannot be deferred *whole*: one of them is pinned by a live assertion.
- **Merging `developer-backend` and `developer-tooling`.** AC-7 keeps the roles distinguishable;
  whether they should remain two roles is OQ-4.
- **The `owner: process.env.USER` defect** at `backlog.ts:190` — nine instances, three hand
  corrections, still not reached here.
- **Q-0039.** Three children share nothing only because they are run one at a time; the mitigation is
  procedural, not a fix.
- **`harness worktrees`** (Q-0062's successor). The cutover leaves worktrees like every other run.

---

## 8. Open questions

- **OQ-1 — settled.** The three port-freeze jobs go with the charter, because
  `port-freeze-guard.sh:45` fails on its absence. AC-22.
- **OQ-2 — settled and widened.** `harness/rules.md` needs more than the ESLint sentence; `:12–15`
  instructs every agent to install and run the spike suite. AC-4.
- **OQ-3 — refuted.** `ci.yml:64` executes the guard's suite today; the body's premise was stale and
  the codex candidate expects the same wrong answer. The deletion is still right. AC-22 keeps the
  caller inventory with the known caller named.
- **OQ-4 — non-blocking, wants a ticket.** With AC-7 applied, `developer-backend` is
  `[packages/core, packages/shared, harness, docs, backlog]` and `developer-tooling` is
  `[packages/core, packages/shared, packages/cli]`. They are distinguishable but no longer obviously
  two roles, and the cross-vendor rule assigns them different adapters. *Owner: the gate.*
- **OQ-5 — BLOCKING. GO-1's subject**, now in two halves: AC-10's verdict policy, and AC-12's
  disposition of a guard whose subject is deleted. *Owner: the human, at this gate.*
- **OQ-6 — BLOCKING. The three ticket ids** (GO-2). Which id keeps which child, and are the two new
  ones allocated through `harness ticket new`? *Owner: the human, at this gate.*

---

## 9. Risks

**R-1 — AC-2 is the highest-risk edit and no test catches it.** Every flow's `integrate` runs these two
commands; a mistake surfaces as the *next* run failing in its worktree, classified as an environment
failure that stops the run after implement and review are paid for. GO-3 is the mitigation and is an
exit condition, not a criterion.

**R-2 — from Child A's merge, `spike/` is present but unproven.** Its run-start `commands.test` still
includes the spike half, so Child A's own `integrate` exercises it; after that, nothing does. AC-16
removes the sweep's spike phase inside Child B, which widens the same window by one job. The window is
two tickets long and ends in deletion. **Stated rather than discovered.**

**R-3 — deleting coverage under cover of a re-aim.** `retired` is what an implementer under pressure
reaches for, because it needs no new assertion. AC-10's one-sentence-per-site register and AC-11's
red-before-green demonstration are the two guards; a reviewer should treat a `retired` verdict whose
named sibling does not actually assert the same property as a **blocker, not a nit**.

**R-4 — the silent class is the one a review will miss.** AC-12's six guards will be green in every
round, before and after, whatever the implementer does. There is no failing test to prompt anyone,
which is why they are a criterion rather than a note, and why AC-12 specifies the mutation that must
fail.

**R-5 — the review loop cannot rule OQ-5.** Without GO-1's entry, Child B's implement step meets a
blocker it may not clear, the reviewer correctly refuses, and the loop spends its budget. Thirteen
prior instances, two of them at ~$30. The remedy is sequencing, not a criterion.

**R-6 — the documentation guards fire on the documentation edits.** `docs.test.ts:417`'s literal pin
(AC-26) and `plan-backlog.test.ts`'s folder rule (GO-4) both go red on the edits themselves unless
moved in the same change.

**R-7 — a hidden production dependency.** If deleting the spike requires a behavioural `packages/**`
source change beyond AC-19's three citations, the cutover premise is false: stop and return to the gate
(AC-1).

---

## 10. Cross-cutting checklist

| | |
| --- | --- |
| **BYOS** | n/a — no code path, test, fixture or example gains or loses a credential path. The BYOS refusal strings' spike twins are deleted with the tree, which makes Q-0068 a one-tree ticket rather than closing it. |
| **Worktree safety** | n/a to the change; relevant to the route. All three children run `chore.yaml` and write only in `.harness/worktrees/`. No criterion writes to the user's tree; no integration-branch behaviour changes. |
| **Gate behaviour** | Unchanged. GO-1 is a human obligation discharged at a gate — *the window for an erratum is a gate* (Q-0094 E-3). |
| **File format and schema** | One file moves without changing shape (AC-8). No zod schema changes; AC-6 and AC-7 edit role `paths` **values**, not the field. |
| **Lint rules** | `eslint.config.js` widens by removing an ignore (AC-23). Nothing under the deleted tree was linted, so the removal itself can produce no new violation — stated rather than assumed. |
| **Cross-vendor rule** | Unchanged. No flow or adapter assignment moves; AC-7 changes a role's paths, not its adapter. |
| **Product-agnostic** | No product-specific dependency or example is added. |
| **Cold-clone impact** | **Net positive.** A stranger installs one dependency set and runs one suite, where today they must discover a second npm tree with its own lockfile. AC-6 stops `quorum init` scaffolding a write path to a directory the adopter never had; AC-24 keeps the two supported installation paths accurate and claims no third. |

---

## 11. Provenance

**From the claude candidate — the document's spine.** The read-set finding, which reframes the ticket
from a deletion into the retirement of the port's witness; the refutation of the body's OQ-3; the
mechanical settlement of OQ-1 on `port-freeze-guard.sh:45`; the parity-chain and
`q0080-allocation.json` findings; the three-child cut and its red-before-green argument; the
`harness/architecture.md`, role-file and `docs.test.ts` omissions; AC-10's register and AC-11's
demonstration.

**From the codex candidate — the closing discipline.** AC-27's residual-live-reference sweep with its
live-versus-historical distinction, which the claude document lacks entirely; AC-28's post-merge CI
criterion and its *"no deleted job appears as skipped"* clause; AC-22's caller inventory before deleting
the guard scripts; the derived-file handling in AC-4; the sharper and longer non-goals list; the
explicit statement that becoming single-tree is not evidence any carried defect is resolved.

**From iteration 1 of this merge.** The production-source exception class (AC-19); the measured citation
class as a named non-goal; the ruling of five open questions; GO-2's ticket-id problem.

**From this iteration — five things no earlier document has.** The unchanged tree, which is why the
verdict repeats and why the recommendation is to advance rather than retry (§0, GO-5). The **third
dependency class** — nine files that name the spike without reading it, six of which become guards that
cannot fail (AC-12), where every earlier account had one class that fails loudly. The
`step-output.test.ts` pin (AC-13), which makes the citation sweep undeferrable in one place and is the
third production-source exception. The `developer-tooling` collapse (AC-7), measured rather than
suspected. And the correction that iteration 1's read-site total of 42 was right only because two
errors cancelled (§3.4(c)) — which is the argument for AC-10 enumerating rather than counting.

**Struck as untestable or unsized.** The codex candidate's AC-1 (a criterion whose subject is the gate's
own decision — that is GO-3, not a criterion) and its AC-3 (an acknowledgement recorded in a gate record
is not a test). The claude candidate's implicit acceptance that one document could carry 24 criteria.
Iteration 1's AC-15, which restated a ruling already carried by AC-6, and its OQ-8, which AC-7 now
settles by measurement.

---

## 12. What a reader should not re-derive from this document

Measured at `83b193c` on 2026-09-05, from the tree and not from any document — including this
document's own previous iteration. **Six statements in circulation are wrong and must not be carried
forward:**

1. that `packages/**` needs no change beyond `spike-parity.test.ts` — **25 files do**;
2. that the dependency set is sixteen files that all fail loudly — **nine more fail silently or not at
   all**, and those are the dangerous ones;
3. that `port-freeze-guard.test.mjs` is executed by nothing — **`ci.yml:64` runs it**;
4. that the freeze jobs are 46 lines — **they are 60, `:46–105`**;
5. that the 42 read sites are 40 helper calls plus two `repoFile` — **40 call sites on 39 lines plus
   three `repoFile`**, a total that is right by cancellation;
6. that both candidates' *"no production source changes"* rule is satisfiable — **three citations must
   move, one of them enforced by a live assertion**.

If a later document repeats any of the six, it is reading a document rather than the tree.
