# Q-0103 — The cutover: delete the spike, retire its CI job and its charter

*Merged requirement, run 1, iteration 1. Written against the tree at `83b193c`, 2026-09-05.*

*Every figure in this document was re-measured against the tree. Where a candidate and the ticket
body disagree, the measurement is what this document carries; where a candidate's figure was wrong,
§3.3 names it rather than quietly correcting it, because a corrected number that travels without its
correction is how this repository's most-recorded defect propagates.*

---

## 0. Verdict, stated first

**needs-input.** Not on substance — the analysis below is sound and the work is well understood —
but on **size and sequencing**, which is the one judgement that costs nothing now and everything
later.

Three things block:

1. **26 criteria against a ceiling of fifteen.** This is one ticket in name and three in fact. §4
   rules the cut and §5 distributes the criteria 6 / 11 / 9.
2. **A decision entry is owed before the middle child's implement step runs, and no step on the
   chore route may write one** (`harness/roles/developer-generalist.md:23`). Its subject is AC-9:
   *what does a test compare against once the port's independent witness is gone?* This is the
   fourteenth appearance in this repository of a loop handed work no agent in it can perform;
   Q-0062 spent three rounds and ~$30 on exactly this, Q-0101 spent $31.16, and both requirements
   had named the hazard in advance.
3. **The cut needs three real ticket ids, not `Q-0103a/b/c`.** `nextId()` parses
   `<PREFIX>-nnnn` and has no notion of a sub-ticket, and three suffixed children would share one
   integration branch and one run-id space — Q-0039's collision, deliberately walked into. This
   changes what `harness ticket new` is asked to do, so it is the gate's call, not this document's.

Everything else the two candidates raised as open is **ruled below** rather than passed upward.

---

## 1. Problem

`packages/cli` dispatches all eight commands and `packages/core` holds the logic, so `spike/` has no
remaining *product* reader. It has fourteen remaining *test* readers, and that is the gap between
what the ticket body describes and what the work is.

The body's model is *"delete a tree and repair what pointed at it"*, where what pointed at it is a CI
job, two commands, two comments and four documents. That model fits one class of reference and not
the other. Measured: **55 of the 63 production source files under `packages/*/src` name the spike**,
almost all in JSDoc — those are citations, and the body's model fits them exactly. But
`packages/shared` and `packages/core` do not merely mention the spike; they **read it from disk at
test time and derive their expectations from it**, through a helper written for that purpose:

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
`spike/src/lint.js`. So deleting `spike/` today does not degrade into vacuous green — it fails
**sixteen files** at import or first call. That is the honest behaviour, and it is why the defect is
visible rather than silent.

**This reframes the ticket.** The cutover is the **retirement of the port's independent witness**,
and the question it actually asks — *what does a test compare against when the thing it compared
against is gone?* — is a policy this repository has never written down, is owed a `docs/decisions/`
entry, and is the blocker in §0(2).

**Who feels it.** The `maintainer` cannot land M2's last item, and M3 queues behind it. The
`contributor` inherits a repository whose regression story is stated in four documents that all
become false the moment this lands. The `adopter` feels one narrow consequence measured below:
`quorum init` scaffolds a role whose write-path list contains `spike`, a directory their repository
has never had.

---

## 2. User stories

- **As the `maintainer`,** I want `spike/` gone and `pnpm test` green in the same commit, so the
  repository has one tree, one suite and one truth.
- **As the `maintainer`,** I want every re-aimed check demonstrated **red before green while the
  spike still exists**, so I am not asked to believe a guard whose subject was deleted in the same
  change that rewrote it.
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
| A chore run would die at its own `integrate` | `runFlow({… config …})` is a parameter never re-read; `ctx.config.commands?.{test,install}` at `engine.js:1306,:1309`; the environment `FlowError` at `:1342`; ported twin `composite.ts` | **exact, and the reasoning holds** |

The body's mechanism section is its best part and nothing below weakens it.

### 3.2 The sixteen files that read the spike from disk

**The ticket body names one of them.**

| File | How it reads the spike |
| --- | --- |
| `packages/core/src/spike-parity.test.ts` | walks `spike/test` — deleted, and the only one the body has |
| `packages/shared/test/corpus.ts` | **defines** `spikeSource`, `spikeLintFlow`, `frontmatterRegexMatchesSpike` |
| `packages/shared/src/constants.test.ts` | 14 oracle calls |
| `packages/shared/src/events.test.ts` | 10 |
| `packages/shared/src/flow.test.ts` | 7, incl. `spikeLintFlow()` — **imports and executes `spike/src/lint.js`** |
| `packages/shared/src/project.test.ts` | 5, incl. `spike/templates/harness/harness.yaml` — Q-0058's config-key census oracle |
| `packages/shared/src/stages.test.ts` | 1 — the STAGES literal's second witness |
| `packages/shared/src/ticket.test.ts` | 1 — `frontmatterRegexMatchesSpike()`, Q-0060's regex pin |
| `packages/shared/src/role.test.ts` | 1 |
| `packages/shared/src/docs.test.ts` | `repoFile('spike/src/contracts.js')` (`:307`) — `TERMINAL_STATUSES`, read rather than retyped |
| `packages/core/src/backlog/backlog.test.ts` | `repoFile('spike/test/q0080-allocation.json')` (`:75`) — **a data fixture that must move, not die** |
| `packages/core/src/lint/lint.test.ts` | `SHIPPED = ['harness/flows', 'spike/templates/harness/flows']` (`:871`) — link 1 of the parity chain |
| `packages/cli/src/templates.test.ts` | `SPIKE_TEMPLATES` (`:50`) — link 2 of the same chain |
| `packages/core/src/git-identity.test.ts` | corpus row `{ dir: 'spike/test' }` (`:28`), assertion at `:217` — Q-0079's tripwire corpus |
| `packages/core/src/test-command.test.ts` | `spikeSources()` walks `spike/src`; reads the `spike` job |
| `packages/core/src/turbo-inputs.test.ts` | register rows naming five spike routes |

**42 read sites** — 40 helper calls plus two direct `repoFile('spike…')` — across ten of those files,
with the other six reading through walks and constants. **This is the work, and none of it is in the
ticket body.**

### 3.3 Three corrections carried forward, so they cannot travel unlabelled

**(a) The freeze jobs are 60 lines, not 46.** They span `ci.yml:46–105`. The body says 46.

**(b) `port-freeze-guard.test.mjs` is executed — the body's OQ-3 is refuted.** `ci.yml:64`:

```yaml
      # The guard's own suite, which until now was executed by nothing — not CI, not `pnpm test`,
      # not the spike suite. …a guard nobody runs is a guard nobody has.
      - run: node .github/scripts/port-freeze-guard.test.mjs
```

The claim was true when Q-0079 wrote it, was **fixed by the later change that added this step**, and
was then copied into `06-development-plan.md` and from there into this ticket body. One command
refutes it. The deletion is right either way — but the confirmation OQ-3 asks for would have been
performed against a false premise, and the codex candidate's OQ-3 expects the same wrong answer
(*"the expected answer is no"*). Both candidates are corrected here.

**(c) The read-site count is 42, not the 46 one candidate states.** Definition:
`spikeSource(` + `spikeLintFlow(` + `frontmatterRegexMatchesSpike(` + `repoFile('spike…')`, excluding
`corpus.ts`'s own definitions. **AC-9's register enumerates these; it does not trust this number.**

### 3.4 Two findings that change what must be built

**(a) The template parity chain is two links, and the cutover breaks both.**

```
harness/flows/ ←[lint.test.ts:871]→ spike/templates/harness/flows/ ←[templates.test.ts:50]→ packages/cli/templates/harness/
```

`packages/cli/src/package.test.ts:161` names it in as many words — *"link 2 of that chain"*. Delete
the middle term and the two surviving shipped copies are connected by **nothing**, so
`harness/flows/chore.yaml` and its `packages/cli` mirror may drift silently. That is precisely what
Q-0086 recorded (*"`lint.test.ts`'s existing parity assertion would have failed had only one
moved"*), and Q-0087/Q-0088's whole artifact-scoping rule rests on both copies moving together.
**Two links are replaced by one direct link; they are not deleted.**

**(b) `spike/test/q0080-allocation.json` is shared data, not spike code.** `spike-parity.test.ts:347`
calls it *"the allocation table both trees assert over … a `.json` precisely so `run.js`, which
discovers `*.js`, does not execute it"*. A flat "delete `spike/`" destroys it. **It moves.**

### 3.5 Ground rule 1 is unsatisfiable as written — and so is codex's AC-15

> *"Nothing in `packages/` changes behaviour … A change to `packages/core` or `packages/cli` source
> is out of scope and is the signal that something was still depending on the spike."*

Sixteen files under `packages/**` depend on the spike, eight of them in `packages/shared`, which the
rule does not name. Followed literally an implementer must report and stop; followed loosely,
"source" excludes tests and the rule constrains nothing.

**And there is one genuine production-source exception neither candidate found.**
`packages/cli/src/ticket.ts:8` cites `spike/test/q0080-allocation.json` — *"the one copy both trees
read"* — the exact file §3.4(b) moves. Its JSDoc becomes false the moment AC-7 lands. So a
production-source **comment** must change, which both candidates' rules forbid. AC-1 and AC-17
handle it: the intent (*no production module's behaviour changes*) is kept and made testable, and the
one comment exception is named rather than discovered in a review round.

This is the fifth instance in this stretch of a criterion's prose read as a literal contract
(Q-0091 E-3, Q-0094 E-1/E-2/E-3(b)), and the rule those produced applies: *a requirement describes
what must be conveyed; only a fixture, a frozen contract's own file, or a criterion quoting bytes
pins bytes.*

### 3.6 Surfaces the body omits

- **`harness/architecture.md`** — an input to every chore `implement` step (`harness: [rules.md,
  architecture.md]`), carrying twelve spike references: the role write-path table (`:27–29`), the
  `spike/bin` + `spike/test` ownership sentence (`:64`), the freeze paragraph (`:69–75`), the
  `spike/test/**` qa-red sentence (`:88`), and the template-sharing paragraph (`:94`). Q-0098
  established that a false claim in a harness context file is inherited by every future run. **The
  freeze does not block this ticket** — it is scoped to Q-0041–Q-0054 and the same paragraph says
  *"Every other ticket may still write there"* — which is worth stating, because an implementer
  reading `:69` mid-run could reasonably stop.
- **`harness/rules.md:12–15`** — instructs every agent to run `npm install --prefix spike` and
  `npm test --prefix spike`. The body's OQ-2 asks only about the ESLint sentence at `:33`. After the
  cutover this paragraph makes every implement step run a command that fails, which is larger than
  the sentence OQ-2 asks about.
- **Four role files**, three under `harness/roles/` and — `adopter`-facing —
  `packages/cli/templates/harness/roles/developer-generalist.md`, the shipped template.
- **Seven `turbo.json` inputs** across the three packages, with their explanatory comments.
- **`docs.test.ts`** pins the literal ``'`packages/cli` wraps core with the spike\'s commands'``
  against `06-development-plan.md`. Editing that sentence — which this ticket must — turns the suite
  red unless the assertion moves in the same change. Confirmed at `packages/shared/src/docs.test.ts`.
- **Role `paths` is advisory, and its only check dies here.** `packages/shared/src/role.ts:26–32`:
  *"Nothing reads it … `spike/test/smoke.js` compares it against the third column of the role table
  in harness/architecture.md, which is the only thing that checks it at all."* So the four config
  surfaces outside the generalist's list are not mechanically refused — this is not a decision-047
  blocker — but deleting `smoke.js` removes the only thing that keeps the role files and the table
  agreeing. AC-15 and AC-16 handle both halves.

---

## 4. The sequencing ruling — three children, and why not two

The body offers three routes and asks this run to rule. **Ruled: split, into three.**

The body's two-way cut is drawn at the commands. That boundary is **correct and necessary** — the
mechanism forcing it was verified — but it is not **sufficient**, for a reason the body could not see
because it did not know §3.2 existed:

> **You cannot demonstrate a re-aimed oracle red-before-green once its subject is deleted.**

Sixteen files must stop reading the spike. Each change is either a deletion of coverage or a re-aim,
and the only honest way to show a re-aim is to run it against the tree it used to read. Do that in
the change that deletes the tree and all sixteen are verified by reading — which is *"A check is not
established by reading it"* (2026-08-29), the port's most expensive lesson, arriving at its own
funeral.

| Child | Subject | `spike/` | Criteria |
| --- | --- | --- | --- |
| **A** | The commands and the context files stop naming the spike | **stays** — its own `integrate` runs the run-start commands, which still work | AC-1 – AC-6 (6) |
| **B** | The workspace stops reading the spike | **stays** — every re-aim is provable red-then-green against the real tree | AC-7 – AC-17 (11) |
| **C** | The deletion, the CI jobs, the charter and the documents | **deleted** — nothing reads it by now | AC-18 – AC-26 (9) |

Only C's `integrate` runs the new commands, and by then they name no spike, so the deletion in that
change is safe — the body's own step-2 argument, preserved.

**The manual route decision 035 also offers is rejected for B and kept as a fallback for C.** B is
where every judgement lives — which oracle dies, which is re-aimed, which moves — so it is exactly
the change that must be seen by a second vendor. C is mechanical once B lands.

**Order: A → B → C, one at a time.** Not concurrent: Q-0039 is unfixed, so two runs would share a
worktree and compute the same run id.

---

## 5. Acceptance criteria

Numbered continuously across the three children, so a criterion keeps its name if the gate re-cuts
them.

### Child A — the commands and the context files

**AC-1 (replaces ground rule 1, made satisfiable).** Across all three children, no file under
`packages/*/src` that is not a `*.test.ts` changes **except** the JSDoc citations §3.5 names, which
AC-17 enumerates. *Test:* `git diff --name-only <base>...<tip> -- 'packages/*/src/**'` lists only
`*.test.ts` paths, `packages/shared/test/corpus.ts`, and files on AC-17's list. **A behavioural
production change is a finding to report at the gate, not to make** — it is the signal that
something still depends on the spike, which is what ground rule 1 was reaching for.

**AC-2.** `harness/harness.yaml`'s `commands.install` is `pnpm install --frozen-lockfile` and
`commands.test` is `pnpm turbo run test --force --continue`, with no `npm … --prefix spike` half.
`--force`, `--continue` and `timeout_ms` survive verbatim with their reasons: they are Q-0065's and
Q-0050's, not the spike's. *Test:* the shipped file, asserted by
`packages/core/src/test-command.test.ts`, whose Q-0065 AC-3 assertion is **re-aimed rather than
deleted**.

**AC-3.** `harness/harness.yaml`'s comment blocks claiming two dependency sets and two suites are
removed, and no sentence claiming two suites survives in that file.

**AC-4 (settles OQ-2, widened).** `harness/rules.md` states one suite: the install-and-run
instruction at `:12–15` names `pnpm install --frozen-lockfile` and `pnpm turbo run test --force`
only, the ESLint-scope sentence at `:33` loses its `spike/**` clause, and the
`spike/src/engine.js:1034` citation is replaced by its `packages/core` counterpart.
**`.claude/rules/` is named by no criterion** — it is a derived copy (*"`.claude/rules/` is a derived
copy, not a surface a requirement may name"*, 2026-08-27) and its sync is the human's.

**AC-5.** `harness/architecture.md` no longer describes the spike as a live tree: the role table's
three rows drop their spike paths, the freeze paragraph and the `spike/test/**` ownership sentence
go, and the template-sharing paragraph names `packages/cli/templates/harness/` as the counterpart of
`harness/flows/`. *Stated so a reviewer does not read it as scope creep:* this file is an input to
every chore `implement` step, so a false claim here is inherited by every future run.

**AC-6.** The three `harness/roles/*.md` and
`packages/cli/templates/harness/roles/developer-generalist.md` drop `spike` from their `paths:` and
their freeze prose, so `quorum init` stops scaffolding an adopter a write path to a directory they do
not have. In the same change, `developer-generalist`'s `paths:` gains `README.md`, `eslint.config.js`
and `vitest.shared.js` — see AC-15. *Test:* no `harness/roles/*.md` or
`packages/cli/templates/harness/roles/*.md` contains the token `spike`.

### Child B — the workspace stops reading the spike

**AC-7.** `spike/test/q0080-allocation.json` **moves** into the workspace — recommended
`packages/core/src/backlog/q0080-allocation.json`, beside its one remaining reader — with its
`"about"` prose corrected to name one tree. `backlog.test.ts` reads the new path. *Test:* the table's
row count and the test's assertion count are identical before and after.

**AC-8.** `packages/shared/test/corpus.ts` exports no `spikeSource`, `spikeLintFlow` or
`frontmatterRegexMatchesSpike`, and no file under `packages/**` calls one. *Test:* an assertion in
the suite, so a re-introduction fails rather than merely being unusual.

**AC-9 — the criterion this ticket exists for.** Every read site in §3.2 is dispositioned in a
**register carrying one sentence per site**, with exactly three permitted verdicts: `retired` (the
property is proven elsewhere — the sibling assertion is named), `re-aimed` (the same property, now
asserted against `packages/**` — the new subject is named), or `transcribed` (the spike's literal
becomes a pinned constant — permitted only on the authority GO-1 supplies). A site with no verdict
fails the register. **The register enumerates the sites from the tree; it does not trust §3.2's
count of 42.**

**AC-10.** Every `re-aimed` site is **demonstrated red before green against the live spike tree**,
recorded in the implement report by assertion name and failure message. This is what forces Child B
to land before the deletion, and it is unsatisfiable after it.

**AC-11.** The parity chain becomes one direct link: `lint.test.ts`'s `SHIPPED` becomes
`['harness/flows', 'packages/cli/templates/harness/flows']`, and `templates.test.ts` compares
`packages/cli/templates/harness/` against the byte-shared set `harness/architecture.md:94` names,
in both directions, reported separately as it already is. *Test:* mutating one byte of
`harness/flows/chore.yaml` fails the guard **and** mutating one byte of the `packages/cli` copy fails
it — the bidirectionality Q-0093 mutation-tested is preserved.

**AC-12.** `git-identity.test.ts`'s corpus drops its `spike/test` row, and `:217`'s
`'spike/test must be in the corpus'` is **replaced by an assertion that the corpus is non-empty and
names the directories it does cover**. *Test:* emptying the corpus list fails. Q-0079's tripwire must
not become a check with no subject in the change that shrinks its subject.

**AC-13.** `test-command.test.ts` drops `spikeSources()`, the `spike`-job reads and the `asItWas`
register, and its phase list loses `'spike suite'` — matched to `.github/scripts/git-identity-
sweep.sh`, which loses the same phase and its `npm ci` / `npm test` lines at `:117–121`. *Test:* the
script and the test agree on the phase list, derived rather than hand-written in both.

**AC-14.** The seven spike `inputs` across the three `packages/*/turbo.json` go with their
explanatory comments, and `turbo-inputs.test.ts`'s register rows with them. *Test:* the guard passes,
and no declared input names a path that does not exist — the one direction it does not currently
check.

**AC-15 (ruled, not left open).** The four surfaces outside `developer-generalist`'s list —
`README.md`, `CLAUDE.md`, `eslint.config.js`, `vitest.shared.js` — are handled by **(a) widening that
role's `paths:` in Child A**, because role `paths` is prose rather than enforcement
(`role.ts:26–32`) and three of the four are ordinary workspace configuration a chore role should be
able to write. `CLAUDE.md` is **excluded from the widening** and stays the human's, being the vendor
dialect of the canonical harness. *The role edit belongs in Child A*, one ticket ahead of the step
that relies on it — editing the role governing your own step is the Q-0086 hazard.

**AC-16.** The loss of the role-table check is registered: `smoke.js` is the only thing comparing a
role's `paths:` against `architecture.md`'s third column, and Child C deletes it. **A `packages/**`
counterpart is written** — recommended over a JSDoc note, because AC-5 and AC-6 edit both sides in
the same stretch, so drift between them is newly possible. `role.ts`'s JSDoc, which cites `smoke.js`
by name, is updated to cite the counterpart. *This is a JSDoc-only change to a production file and is
covered by AC-17.*

**AC-17.** The production-source JSDoc citations that name a moved or deleted file are corrected, and
they are the **only** permitted production-source change: `packages/cli/src/ticket.ts:8` (cites
`spike/test/q0080-allocation.json`, which AC-7 moves) and `packages/shared/src/role.ts:31` (cites
`spike/test/smoke.js`, which AC-16 replaces). *Test:* the list is exhaustive — no other
`packages/*/src` non-test file changes. Citations that merely name a deleted path **without claiming
it is read** are a non-goal (§7).

### Child C — the deletion

**AC-18.** `spike/` is deleted — 55 tracked files, including `spike/src/**`, `spike/bin/**`,
`spike/test/**`, its npm manifest and its lockfile. *Test:* `git ls-files spike` returns nothing.

**AC-19.** `packages/core/src/spike-parity.test.ts` and `harness/port-charter.md` are deleted. No
replacement parity test, inventory, freeze SHA, mirror procedure or port register is introduced.

**AC-20 (settles OQ-1).** `.github/workflows/ci.yml` holds exactly three jobs — `workspace`,
`git-identity-sweep-bare`, `git-identity-sweep-populated` — with their commands, cache policy, forced
execution and hostile-environment checks unchanged. The four retired jobs are `spike` and the three
port-freeze jobs; `.github/scripts/port-freeze-guard.sh` and `port-freeze-guard.test.mjs` go with
them. **Authority:** `port-freeze-guard.sh:45` — *"`$CHARTER` is missing, so the freeze policy cannot
be read. The guard refuses to pass on a policy it cannot find."* — so all three freeze jobs go **red
on every push** the moment AC-19 lands. They are coupled to the charter, not merely made pointless by
it; this is mechanical, not a preference. **Before deletion, a tracked-file search records every
caller of both scripts.** The known caller is `ci.yml:64` (§3.3(b)); any *other* surviving caller
stops implementation and is reported at the gate rather than edited in passing. *Test:*
`test-command.test.ts`'s seven-job register becomes a three-job register and is shown red against the
old workflow.

**AC-21.** `eslint.config.js` drops `'spike/**'` from `ignores` with its Q-0009 comment; the
configured file scope and rules are otherwise unchanged, and no new violation appears from the
removal. `vitest.shared.js`'s citation of `spike/test/run.js` is **reworded, not deleted** — the
discovery guarantee it explains is live and `test-discovery.test.ts` enforces it, so the reasoning
survives its source. No include pattern is narrowed and the `dist/**` exclusion stays.

**AC-22.** `README.md:8` and `CLAUDE.md:25,35` no longer say the runnable code is the spike.
`CLAUDE.md`'s Commands section names the two paths Q-0098 shipped — `pnpm exec quorum` in the
workspace, and the locally packed install — and **does not claim registry-resolved `npx quorum`**.

**AC-23.** `docs/04-architecture.md` describes **one** required suite, what it proves, and the chain
from a new failing file to a red `pnpm test`; the two-suite paragraph, the transfer share and the
`spike-parity.test.ts` sentence go, and the status line is bumped with the date and what changed.

**AC-24.** `docs/06-development-plan.md`'s M2 done-when reads one suite and Q-0010 §5's follow-up is
recorded as done, **and `docs.test.ts`'s literal pin moves in the same change** — editing that
sentence without it turns the suite red. Historical accounts stay historical and are not rewritten
merely because they mention the spike.

**AC-25.** A tracked-file search after the deletion finds no **live** instruction, command, CI
definition, test, configuration entry or script depending on a path under `spike/`,
`harness/port-charter.md`, or the port-freeze scripts. Past-tense historical records and
`docs/decisions/` are excluded, and JSDoc citations covered by §7's non-goal are excluded.

**AC-26.** After the merge, CI runs the three retained jobs against the resulting commit and all
three pass; no deleted job appears as passed, failed **or skipped**, because it no longer exists.
`pnpm lint`, `pnpm typecheck` and `pnpm turbo run test --force` are green with no cache-served
verdict. No file under `docs/decisions/` is edited.

---

## 6. Gate obligations

**GO-1 — the decision entry, owed before Child B's implement step. Blocking.** Its subject is AC-9:
*what a test compares against once the port's independent witness is gone.* The three verdicts AC-9
permits are a policy, and `corpus.ts`'s own JSDoc argues against one of them — *"compares against it
rather than against a transcription of it"* — so `transcribed` needs an authority the register can
cite. **Do not launch Child B without it.** Fourteenth appearance of a loop handed work no agent in
it can perform; Q-0062 paid ~$30 and Q-0101 $31.16 for the same omission, both after their
requirements had named it.

**GO-2 — three real ids. Blocking.** `nextId()` parses `<PREFIX>-nnnn` and knows no sub-ticket, so
`Q-0103a/b/c` would share one integration branch and one run-id space. Recommended: **Q-0103 keeps
the deletion** (it is what its title describes) and two ids are allocated ahead of it for A and B.

**GO-3 — ground rule 2 is an exit condition, not a criterion.** Child A is not done until a real
`integrate` has passed with the new commands. Since Child A's own `integrate` runs the *old* ones,
**the proof is Child B's `integrate`, and Child C must not be launched before it is seen green.**

**GO-4 — each child's folder is added to `06-development-plan.md` as it is created**, or
`plan-backlog.test.ts` goes red on ticket creation rather than on implementation.

---

## 7. Non-goals

Inherited and confirmed:

- **Registry-resolved `npx quorum`** — refused while every package is `"private": true`; Q-0029's, in M6.
- **Any fix to Q-0102**, whose subject is a flaky oracle under load. It will still be red after this
  ticket; AC-14 makes its `@quorum/core` input set smaller without fixing it.
- **Q-0059, Q-0060, Q-0066, Q-0068, Q-0100** — the defects that landed in both trees. Each becomes
  smaller, none is closed. Q-0100 is the sharpest temptation: AC-22 edits `CLAUDE.md`'s Commands
  line, one line from a `harness` spelling Q-0100 owns.
- Preserving the spike as an archive, submodule, tarball or fixture; retaining a second suite;
  replacing the parity test with a comparison against archived files; editing landed decisions;
  changing flows, adapters, the cross-vendor rule, gates, worktree containment or run-history
  formats; adding a dependency; anything on the v1 exclusion list.

Added here:

- **Rewriting the JSDoc citations of spike paths across production source.** 55 of 63 production
  files under `packages/*/src` name the spike, almost all in comments that become dangling
  references. This is a mechanical sweep across ~55 files with no behaviour attached; it would swamp
  the review of three changes that do have behaviour, and the engineering rule those comments obey
  (*"one line naming the authority"*) is satisfied by a ticket-id citation even where the path is
  gone. **It is owed its own ticket and is registered here so the obligation does not expire.** The
  two exceptions that claim a file is *read* are AC-17's.
- **The `owner: process.env.USER` defect** at `backlog.ts:190` — nine instances, three hand
  corrections, still not reached here.
- **Q-0039.** Three children share nothing only because they are run one at a time; the mitigation is
  procedural, not a fix.
- **`harness worktrees`** (Q-0062's successor). The cutover leaves worktrees like every other run.

---

## 8. Open questions

- **OQ-1 — settled, not open.** The three port-freeze jobs go with the charter, because
  `port-freeze-guard.sh:45` fails on its absence. AC-20.
- **OQ-2 — settled and widened.** `harness/rules.md` needs more than the ESLint sentence; it
  instructs every agent to install and run the spike suite. AC-4.
- **OQ-3 — refuted.** `ci.yml:64` executes the guard's suite today; both candidates' premise was
  stale in opposite directions. The deletion is still right. AC-20 keeps the caller inventory,
  with the known caller named.
- **OQ-4 — the route.** Settled: split into three, A → B → C, one at a time (§4).
- **OQ-5 — settled.** `packages/shared/test/corpus.ts` stays: it still exports `repoFile`,
  `flowFiles`, `roleFiles`, `decisionFiles` and others used workspace-wide. Its JSDoc is written
  around the witness role and is **rewritten rather than trimmed**. *Owner: Child B's implementer.*
- **OQ-6 — BLOCKING. AC-9's policy**, and GO-1's subject: which of `retired` / `re-aimed` /
  `transcribed` is the default, and on what authority may a spike literal become a pinned constant?
  *Owner: the human, at this gate.*
- **OQ-7 — BLOCKING. The three ticket ids** (GO-2). Which id keeps which child, and are the two new
  ones allocated through `harness ticket new`? *Owner: the human, at this gate.*
- **OQ-8 — non-blocking, wants a ticket.** After AC-6, does anything still distinguish
  `developer-backend` from `developer-tooling`? Their remaining difference was largely `spike/src`
  versus `spike/bin` + `spike/test`. Merging them is out of scope; **noticing that the distinction
  may have evaporated is not.** *Owner: the gate.*

---

## 9. Risks

**R-1 — AC-2 is the highest-risk edit and no test catches it.** Every flow's `integrate` runs these
two commands; a mistake surfaces as the *next* run failing in its worktree, classified as an
environment failure that stops the run after implement and review are paid for. GO-3 is the mitigation
and is an exit condition, not a criterion.

**R-2 — from Child A's merge, `spike/` is present but unproven.** Its run-start `commands.test` still
includes the spike half, so Child A's own `integrate` exercises it; after that, nothing does. The
window is two tickets long and ends in deletion. **Stated rather than discovered.**

**R-3 — deleting coverage under cover of a re-aim.** `retired` is what an implementer under pressure
reaches for, because it needs no new assertion. AC-9's one-sentence-per-site register and AC-10's
red-before-green demonstration are the two guards; a reviewer should treat a `retired` verdict whose
named sibling does not actually assert the same property as a **blocker, not a nit**.

**R-4 — the review loop cannot rule OQ-6.** Without GO-1's entry, Child B's implement step meets a
blocker it may not clear, the reviewer correctly refuses, and the loop spends its budget. Thirteen
prior instances, two of them at ~$30. The remedy is sequencing, not a criterion.

**R-5 — the documentation guards fire on the documentation edits.** `docs.test.ts`'s literal pin
(AC-24) and `plan-backlog.test.ts`'s folder rule (GO-4) both go red on the edits themselves unless
moved in the same change.

**R-6 — a hidden production dependency.** If deleting the spike requires a behavioural
`packages/**` source change, the cutover premise is false: stop and return to the gate (AC-1).

---

## 10. Cross-cutting checklist

| | |
| --- | --- |
| **BYOS** | n/a — no code path, test, fixture or example gains or loses a credential path. The BYOS refusal strings' spike twins are deleted with the tree, which makes Q-0068 a one-tree ticket rather than closing it. |
| **Worktree safety** | n/a to the change; relevant to the route. All three children run `chore.yaml` and write only in `.harness/worktrees/`. No criterion writes to the user's tree; no integration-branch behaviour changes. |
| **Gate behaviour** | Unchanged. GO-1 is a human obligation discharged at a gate — *the window for an erratum is a gate* (Q-0094 E-3). |
| **File format and schema** | One file moves without changing shape (AC-7). No zod schema changes; AC-6 edits role `paths` **values**, not the field. |
| **Lint rules** | `eslint.config.js` widens by removing an ignore (AC-21). Nothing under the deleted tree was linted, so the removal itself can produce no new violation — stated rather than assumed. |
| **Cross-vendor rule** | Unchanged. No flow or adapter assignment moves. |
| **Product-agnostic** | No product-specific dependency or example is added. |
| **Cold-clone impact** | **Net positive.** A stranger installs one dependency set and runs one suite, where today they must discover a second npm tree with its own lockfile. AC-6 stops `quorum init` scaffolding a write path to a directory the adopter never had; AC-22 keeps the two supported installation paths accurate and claims no third. |

---

## 11. Provenance

**From the claude candidate — the document's spine.** §3.2's sixteen-file read-set, which reframes
the ticket from a deletion into the retirement of the port's witness; the refutation of the body's
OQ-3; the mechanical settlement of OQ-1 on `port-freeze-guard.sh:45`; the parity-chain and
`q0080-allocation.json` findings; the three-child cut and its red-before-green argument; the
`harness/architecture.md`, role-file and `docs.test.ts` omissions; AC-9's register and AC-10's
demonstration.

**From the codex candidate — the closing discipline.** AC-25's residual-live-reference sweep with its
live-versus-historical distinction, which the claude document lacks entirely; AC-26's post-merge CI
criterion and its *"no deleted job appears as skipped"* clause; AC-20's caller inventory before
deleting the guard scripts; the derived-file handling in AC-4; the sharper and longer non-goals list;
the explicit statement that becoming single-tree is not evidence any carried defect is resolved.

**From this merge — five things neither candidate had.** The production-source exception in §3.5
(`packages/cli/src/ticket.ts:8` cites the exact fixture AC-7 moves, so both candidates' "no
production source changes" rule is unsatisfiable), carried as AC-17; the measured citation class (55
of 63 production files), which turns a vague worry into a named non-goal; the correction of the read-
site count from 46 to 42 **with the instruction that the register enumerates rather than trusts it**;
the ruling of five of the eight open questions, leaving two blockers and one ticket; and GO-2, the
ticket-id allocation problem, which is a gate decision one candidate flagged and neither resolved.

**Struck as untestable or unsized.** The codex candidate's AC-1 (a criterion whose subject is the
gate's own decision — that is a gate obligation, GO-3, not a criterion) and its AC-3 (an
acknowledgement recorded in a gate record is not a test). The claude candidate's implicit acceptance
that one document could carry 24 criteria.

---

## 12. What a reader should not re-derive from this document

Measured at `83b193c` on 2026-09-05, from the tree and not from the ticket body. **Four statements in
circulation are wrong and must not be carried forward:** that `packages/**` needs no change beyond
`spike-parity.test.ts` (sixteen files do); that `port-freeze-guard.test.mjs` is executed by nothing
(`ci.yml:64` runs it); that the freeze jobs are 46 lines (they are 60, `:46–105`); and that there are
46 read sites (42, by the definition in §3.3(c)). If a later document repeats any of the four, it is
reading a document rather than the tree.
