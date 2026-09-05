# Q-0103 — The cutover: delete the spike, retire its CI job and its charter

*Requirements, run 1, candidate (claude). Written against the tree at `83b193c`, 2026-09-05.
Every figure below was measured; none is transcribed from the ticket body, and where the two
disagree the measurement is what this document carries.*

---

## 0. What the body got right, stated first

Three of its claims are load-bearing and all three are exact. They are recorded here so the rest of
the document is read as a correction of scope rather than of substance.

| Claim | Measured | Verdict |
| --- | --- | --- |
| `spike/` is 55 tracked files, 9,732 lines | `git ls-files spike \| wc -l` → 55; `xargs wc -l` → 9732 | **exact** |
| `spike-parity.test.ts` is 1,957 lines | `wc -l` → 1957 | **exact** |
| `harness/port-charter.md` is 516 lines | `wc -l` → 516 | **exact** |
| Seven CI jobs become three | jobs at `:21 :46 :70 :92 :106 :147 :173` — seven; minus four | **exact** |
| A chore run would die at its own `integrate` | `runFlow({… config …})` `engine.js:61` is a parameter never re-read; `ctx.config.commands?.test` `:1306`; `?.install` `:1309`; the environment `FlowError` `:1342`; ported twin `composite.ts:351` | **exact, and the reasoning holds** |

The mechanism section is the best part of the body and nothing below weakens it. What follows is
what it does not know.

---

## 1. Problem

The `maintainer` cannot delete `spike/` today, because deleting it turns `pnpm test` red in
**sixteen files under `packages/**`** — and the ticket names one of them.

The body's model of the cutover is *"delete a tree and repair what pointed at it"*, where what
pointed at it is a CI job, two commands, two comments and four documents. That model is wrong in one
specific, expensive way: it treats every `spike` reference as a **citation**. Measured, there are
963 occurrences of the word under `packages/**`, of which 634 sit on a comment line — those are
citations and the body's model fits them. The remaining class is different in kind. `packages/shared`
and `packages/core` do not merely *mention* the spike; they **read it at test time and derive their
expectations from it**, through a helper that exists for exactly that purpose:

```
packages/shared/test/corpus.ts:90
  /**
   * A file under `spike/`, read as text. The spike is frozen for the port and is its only
   * independent witness (harness/port-charter.md §3), so the constants tests compare against it
   * rather than against a transcription of it.
   */
  export function spikeSource(relative: string): string {
    return repoFile(path.join('spike', relative));
  }
```

`repoFile` **throws** on a missing file (`corpus missing: … does not exist under …`), and
`spikeLintFlow()` throws its own refusal. So this is not a soft degradation into vacuous green — it
is sixteen files failing at import or first call, which is the honest behaviour and is why the defect
is visible rather than silent.

That reframes the ticket. The cutover is not a deletion with repairs. It is **the retirement of the
port's independent witness**, and the question it actually asks — *what does a test compare against
when the thing it compared against is gone?* — is a decision this repository has never taken, is
owed a `docs/decisions/` entry, and is work no step on the chore route may perform
(`harness/roles/developer-generalist.md:23`).

**Who feels it.** The `maintainer` cannot land M2's last item, and the cutover blocks M3. The
`adopter` is affected by one narrow consequence measured below: the shipped template roles hand a
stranger a write-path list containing `spike`, a directory their repository has never had. The
`contributor` inherits a repository whose regression story is stated in four documents that will all
be false the moment this lands.

---

## 2. User stories

- **As the `maintainer`,** I want `spike/` gone and `pnpm test` green in the same commit, so that
  the repository has one suite, one tree and one truth, and M3 can start.
- **As the `maintainer`,** I want each re-aimed check demonstrated **red before green while the
  spike still exists**, so that I am not asked to believe a guard whose subject was deleted in the
  same change that rewrote it.
- **As the `contributor`,** I want `harness/rules.md` and `harness/architecture.md` to describe the
  repository I actually cloned, so that the instructions fed to every agent at run time do not tell
  me to install and run a suite that is not there.
- **As the `adopter`,** I want `quorum init` to scaffold a harness whose role files do not grant me
  write access to a directory that has never existed in my project.

---

## 3. The measured deletion set

### 3.1 What the body names, confirmed

| Path | Lines | Note |
| --- | --- | --- |
| `spike/` (55 tracked files) | 9,732 | Includes `spike/test/**`, the second regression suite |
| `packages/core/src/spike-parity.test.ts` | 1,957 | Goes **with** `spike/test/**`, per Q-0010's bullet |
| `harness/port-charter.md` | 516 | §2, §3 and its `freeze-sha` all describe a tree that stops existing |

### 3.2 The fourth category the body does not name — sixteen files

Every one of these reads the spike from disk. **The ticket names the first; the other fifteen appear
nowhere in it.**

| File | How it reads the spike | What it loses |
| --- | --- | --- |
| `packages/core/src/spike-parity.test.ts` | `SPIKE_TESTS = 'spike/test'`, walks the directory | deleted — correct, and the only one the body has |
| `packages/shared/test/corpus.ts` | **defines** `spikeSource`, `spikeLintFlow`, `frontmatterRegexMatchesSpike` | the helpers themselves; fails only through its callers |
| `packages/shared/src/constants.test.ts` | 14 oracle calls | the path constants checked against the spike's own literals |
| `packages/shared/src/events.test.ts` | 10 oracle calls | the event union derived from what the spike emits |
| `packages/shared/src/flow.test.ts` | 7 oracle calls, incl. `spikeLintFlow()` — **imports and executes `spike/src/lint.js`** | the flow property asserted against the real linter |
| `packages/shared/src/project.test.ts` | 5, incl. `spike/templates/harness/harness.yaml` and `retryDefaults` | Q-0058's config-key census oracle |
| `packages/shared/src/stages.test.ts` | `spike/src/backlog.js` STAGES array literal | the stage list's second witness |
| `packages/shared/src/ticket.test.ts` | `frontmatterRegexMatchesSpike()` — `backlog.js:12` | Q-0060's frontmatter regex pin |
| `packages/shared/src/role.test.ts` | 1 | role schema vs the spike's reader |
| `packages/shared/src/docs.test.ts` | `repoFile('spike/src/contracts.js')` for `TERMINAL_STATUSES` (`:307`) | the terminal-status words, read rather than retyped |
| `packages/core/src/backlog/backlog.test.ts` | `repoFile('spike/test/q0080-allocation.json')` (`:75`) | **a data fixture that must move, not die** |
| `packages/core/src/lint/lint.test.ts` | `SHIPPED = ['harness/flows', 'spike/templates/harness/flows']` (`:871`) | **link 1 of the template parity chain** |
| `packages/cli/src/templates.test.ts` | `SPIKE_TEMPLATES = …/spike/templates/harness` (`:50`) | **link 2 of the same chain** |
| `packages/core/src/git-identity.test.ts` | corpus row `{ dir: 'spike/test' }` (`:28`) and `'spike/test must be in the corpus'` (`:217`) | Q-0079's tripwire corpus |
| `packages/core/src/test-command.test.ts` | `spikeSources()` walks `spike/src` (`:53`); reads the `spike` job (`:485`, `:553`, `:561`) | Q-0054's `asItWas` register and the five-phase sweep list |
| `packages/core/src/turbo-inputs.test.ts` | ~15 register rows naming spike directories and routes | the declared-inputs register |

**46 oracle call sites** across the first eleven. This is the work, and none of it is in the body.

### 3.3 Two findings inside that set that change what must be built

**(a) The template parity chain is two links, and the cutover breaks both.** Today:

```
harness/flows/  ←[lint.test.ts:871]→  spike/templates/harness/flows/  ←[templates.test.ts:50]→  packages/cli/templates/harness/
```

`packages/cli/src/package.test.ts:161` names it in as many words — *"link 2 of that chain"*. Delete
the middle term and the two surviving shipped copies are connected by **nothing**, so
`harness/flows/chore.yaml` and `packages/cli/templates/harness/flows/chore.yaml` may drift silently.
That is precisely the defect Q-0086 recorded when it wrote *"`lint.test.ts`'s existing parity
assertion would have failed had only one moved"*, and Q-0087/Q-0088's whole artifact-scoping rule
rests on both copies moving together. The cutover must **replace two links with one direct link**,
not delete two links.

**(b) `spike/test/q0080-allocation.json` is shared data, not spike code.** `spike-parity.test.ts:347`
describes it as *"the allocation table both trees assert over … a `.json` precisely so `run.js`,
which discovers `*.js`, does not execute it"*. `packages/core/src/backlog/backlog.test.ts:75` reads
it. It must **move** into the workspace, and the ticket's flat "delete `spike/`" instruction destroys
it.

---

## 4. Three corrections to the body's own text

### 4.1 OQ-3 is refuted — the freeze guard's suite **is** executed

The body says `.github/scripts/port-freeze-guard.test.mjs` is *"a file nothing executes"* and asks for
that to be confirmed before deletion. It is executed. `.github/workflows/ci.yml:64`:

```yaml
      # The guard's own suite, which until now was executed by nothing — not CI, not `pnpm test`,
      # not the spike suite. … a guard nobody runs is a guard nobody has.
      - run: node .github/scripts/port-freeze-guard.test.mjs
```

The claim was true when decision *"A test's verdict is a property of the commit"* (2026-08-30) wrote
it, was **fixed by a later change that added that CI step**, and has since been copied forward into
`06-development-plan.md:2138` and from there into this ticket body. One command refutes it.

This is the Q-0099 pattern with the same copier: *a measurement copied from a document is not a
measurement*, and a correction that travels one document further by being transcribed. It costs
nothing here because the deletion is right either way — but the **confirmation OQ-3 asks for would
have been performed against the wrong premise**, and the next reader would have inherited it again.

### 4.2 OQ-1 is settled by coupling, not by preference

The body recommends retiring the three port-freeze jobs here *"because a job that cannot fail is
worse than one that is missing"* — an aesthetic argument. The real reason is mechanical.
`.github/scripts/port-freeze-guard.sh:45`:

```sh
[ -f "$CHARTER" ] || fail "$CHARTER is missing, so the freeze policy cannot be read. The guard refuses to pass on a policy it cannot find."
```

with `CHARTER="${CHARTER:-harness/port-charter.md}"` at `:39`. So the three jobs do not become
inert when the charter is deleted — **they go red**, on every push, immediately. They are coupled to
`harness/port-charter.md` and must be retired in whichever change deletes it. Not a judgement call.

Correction of arithmetic while here: the freeze jobs span `:46`–`:105`, which is **60 lines**, not
the 46 the body states.

### 4.3 Ground rule 1 is unsatisfiable as written

> *"Nothing in `packages/` changes behaviour … A change to `packages/core` or `packages/cli` source
> is out of scope and is the signal that something was still depending on the spike — report it
> rather than fixing it in passing."*

Sixteen files under `packages/**` depend on the spike, and eight of them are in `packages/shared`,
which the rule does not even name. Followed literally, an implementer must report and stop, and the
cutover cannot land. Followed loosely, "source" excludes tests and the rule constrains nothing.

The intent is sound and is worth keeping — *no production module's behaviour changes* — so the rule
should be restated rather than dropped. **AC-1 does that.** This is the fourth instance in this
stretch of a criterion's prose read as a literal contract (Q-0091 E-3, Q-0094 E-1/E-2/E-3(b)), and
the rule those produced applies: *a requirement describes what must be conveyed; only a fixture, a
frozen contract's own file, or a criterion quoting bytes pins bytes.*

---

## 5. Surfaces the body omits entirely

### 5.1 `harness/architecture.md` — fed to every implement step at run time

`chore.yaml`'s `implement` step declares `harness: [rules.md, architecture.md]`. So this file is in
the prompt of every chore run, and it carries four spike-dependent passages:

- `:27–29` the **role write-path table**, whose three rows name `spike/`, `spike/src/`, `spike/bin/`,
  `spike/test/`;
- `:64–67` *"`spike/bin/` and `spike/test/` belong to `tooling` by default"*;
- `:69–77` the freeze paragraph — *"The spike is frozen for Q-0009's port, and for nothing else …
  none of them may modify or delete any file under `spike/src/`"*;
- `:88–90` *"`spike/test/**` belongs to qa-red"*;
- `:92–95` the template-sharing paragraph, naming `spike/templates/harness/`.

**The freeze does not block this ticket** — it is explicitly scoped to Q-0041–Q-0054 and the same
paragraph says *"Every other ticket may still write there"* — which is worth stating, because an
implementer reading it mid-run could reasonably stop. But the file is a **harness context file**, and
Q-0098 established that a false claim in one is inherited by every future run. It ranks with
`harness.yaml` in risk, and the body does not mention it.

### 5.2 `harness/rules.md` — OQ-2 is under-scoped

OQ-2 asks only about the ESLint-scope sentence. `harness/rules.md:11–17` does more than that: it
**instructs every agent** to

> Run `pnpm install --frozen-lockfile` and `npm install --prefix spike --no-audit --no-fund` before
> either suite, and run both — `npm test --prefix spike` and `pnpm turbo run test --force`.

and cites `spike/src/engine.js:1034` as the authority for the worktree-has-no-dependencies rule.
After the cutover there is one suite, so this paragraph makes every implement step run a command that
fails. That is a behaviour change to every future run, and it is larger than the ESLint sentence OQ-2
asks about.

### 5.3 Three role files, and one that reaches an adopter

`harness/roles/developer-generalist.md:3`, `developer-backend.md:12,17` and
`developer-tooling.md:18` all name `spike` in their `paths:` or their freeze prose. So does
**`packages/cli/templates/harness/roles/developer-generalist.md:3`** — the shipped template. A
stranger running `quorum init` today is scaffolded a role whose write-path list includes `spike`, a
directory their repository has never had. That is `adopter`-facing and on the cold-clone path.

### 5.4 Role `paths` is prose, and its only check dies here

I expected the role's path list to be enforced, and measured that it is not.
`packages/shared/src/role.ts:27–31`:

> *"source for `paths` returns no reader, and ownership reaches an agent only as prose … Typing it
> here must not be read as enforcement. `spike/test/smoke.js` compares it against the third column
> of the role table in `harness/architecture.md`, which is the only thing that checks it at all."*

Two consequences. First, the four surfaces outside `developer-generalist`'s list —
`README.md`, `CLAUDE.md`, `eslint.config.js`, `vitest.shared.js` — are **not mechanically refused**,
so this is not a decision-047 blocker. But the role body tells the implementer to treat anything it
cannot trace to an allowed path as out of scope, so a criterion naming them needs the list widened or
the authority stated, or a round is spent on it. **AC-15 handles it.** Second, deleting `smoke.js`
removes the only check that the role files and `architecture.md` agree — a coverage loss that must be
registered rather than discovered.

### 5.5 Seven `turbo.json` input declarations

`packages/cli/turbo.json` (1: `../../spike/templates/harness/**`), `packages/core/turbo.json`
(3: `spike/src/**`, `spike/test/**`, `spike/templates/harness/flows/*.yaml`) and
`packages/shared/turbo.json` (3: `spike/bin/harness.js`, `spike/src/**`,
`spike/templates/harness/harness.yaml`) each declare spike paths as task `inputs`, with a JSDoc
paragraph explaining why. All seven go, with their comments and their `turbo-inputs.test.ts` register
rows.

### 5.6 A documentation guard that fires on the edit itself

`packages/shared/src/docs.test.ts:417` asserts M2's done-when contains the literal
``'`packages/cli` wraps core with the spike\'s commands'``. Editing that sentence in
`06-development-plan.md` — which this ticket must — turns `docs.test.ts` red unless the assertion
moves in the same change.

---

## 6. The sequencing ruling — three children, not two

The body offers three routes (split in two, run by hand, accept a failed `integrate`) and asks the
requirements run to rule. **Ruled: split, and into three rather than two.**

The body's two-way cut is drawn at the commands. That boundary is correct and necessary — I verified
the mechanism that forces it — but it is not sufficient, for a reason the body could not see because
it did not know §3.2 existed:

> **You cannot demonstrate a re-aimed oracle red-before-green once its subject is deleted.**

Sixteen files must stop reading the spike. Each such change is either a deletion of coverage or a
re-aim, and the only way to show a re-aim is honest is to run it against the tree it used to read.
Do that in the same change that deletes the tree and every one of the sixteen is verified by reading
— which is *"A check is not established by reading it"* (2026-08-29), the port's most expensive
lesson, arriving at its own funeral.

Sizing agrees. A single document lands ~24 criteria against the ceiling of fifteen that forced
Q-0091's split, and *"Ticket size is the dominant cost driver"* (2026-08-22) puts a ticket near ten.

**The cut:**

| Child | Subject | `spike/` state | Criteria |
| --- | --- | --- | --- |
| **Q-0103a** | The commands and the context files stop naming the spike | **stays** — its own `integrate` runs the run-start commands, which still work | AC-1 – AC-6 |
| **Q-0103b** | The workspace stops reading the spike | **stays** — every re-aim is provable red-then-green against the real tree | AC-7 – AC-16 |
| **Q-0103c** | The deletion, the CI jobs, the charter and the documents | **deleted** — by now nothing reads it | AC-17 – AC-24 |

Each is an ordinary chore ticket. Only Q-0103c's `integrate` runs the new commands, and by then they
name no spike, so the deletion in that change is safe — which is the body's own step-2 argument,
preserved.

**The alternative decision 035 offers — a stage run by hand — is rejected for Q-0103b and accepted as
a fallback for Q-0103c.** Q-0103b is where the judgement is (which oracle dies, which is re-aimed,
which moves), so it is exactly the change that should be seen by a second vendor. Q-0103c is
mechanical once b lands.

---

## 7. Acceptance criteria

Numbered continuously across the three children so a criterion keeps its name if the gate re-cuts
them. Each is independently testable and names its surface.

### Q-0103a — the commands and the context files

**AC-1 (restates ground rule 1).** No file under `packages/*/src` that is not a `*.test.ts` changes
in any of the three children. *Test:* `git diff --name-only <base>...<tip> -- 'packages/*/src/**'`
lists only `*.test.ts` paths and `packages/shared/test/corpus.ts`. A production-source change is a
finding to report, not to make — and is the signal ground rule 1 was reaching for.

**AC-2.** `harness/harness.yaml`'s `commands.install` is `pnpm install --frozen-lockfile` and
`commands.test` is `pnpm turbo run test --force --continue`, both with no `npm … --prefix spike`
half. The `--force` and `--continue` clauses and their comments survive verbatim: they are Q-0065's
and Q-0050's, not the spike's. *Test:* the shipped file, asserted by
`packages/core/src/test-command.test.ts`, whose existing Q-0065 AC-3 assertion is re-aimed rather
than deleted.

**AC-3.** The two comment blocks at `harness/harness.yaml:29–30` and `:35–39` explaining *why there
are two suites* are removed, and no sentence claiming two suites survives in that file.

**AC-4.** `harness/rules.md` states one suite: the install-and-run instruction names
`pnpm install --frozen-lockfile` and `pnpm turbo run test --force` only, the ESLint-scope sentence
loses its `spike/**` clause, and the `spike/src/engine.js:1034` citation is replaced by its
`packages/core` counterpart. **`.claude/rules/engineering.md` is not named by any criterion** — it is
a derived copy (*"`.claude/rules/` is a derived copy, not a surface a requirement may name"*,
2026-08-27) and is the human's to sync.

**AC-5.** `harness/architecture.md` no longer describes the spike as a live tree: the role table's
three rows drop their spike paths, the freeze paragraph and the `spike/test/**` ownership sentence
go, and the template-sharing paragraph names `packages/cli/templates/harness/` as the counterpart of
`harness/flows/`. *Rationale, stated so a reviewer does not read it as scope creep:* this file is an
input to every chore `implement` step, so a false claim here is inherited by every future run —
Q-0098's product-context finding, one file over.

**AC-6.** `harness/roles/developer-generalist.md`, `developer-backend.md` and
`developer-tooling.md` drop `spike` from their `paths:` and their freeze prose, **and so does
`packages/cli/templates/harness/roles/developer-generalist.md`**, so `quorum init` stops scaffolding
an adopter a write path to a directory they do not have. *Test:* no `harness/roles/*.md` or
`packages/cli/templates/harness/roles/*.md` contains the token `spike`.

### Q-0103b — the workspace stops reading the spike

**AC-7.** `spike/test/q0080-allocation.json` is **moved** into the workspace — recommended
`packages/core/src/backlog/q0080-allocation.json`, beside its one remaining reader — with its
`"about"` prose corrected to name one tree. `packages/core/src/backlog/backlog.test.ts` reads it from
the new path and its assertions are unchanged in number and in subject. *Test:* the table's row count
and the test's assertion count are identical before and after.

**AC-8.** `packages/shared/test/corpus.ts` exports no `spikeSource`, `spikeLintFlow` or
`frontmatterRegexMatchesSpike`, and no file under `packages/**` calls one. *Test:* a grep assertion in
the suite, so a re-introduction fails rather than merely being unusual.

**AC-9.** Each of the 46 oracle call sites is dispositioned in a **register carrying one sentence per
site**, with exactly three permitted verdicts: `retired` (the property is proven elsewhere — the
sibling assertion is named), `re-aimed` (the same property, now asserted against `packages/**` — the
new subject is named), or `transcribed` (the spike's literal becomes a pinned constant — permitted
only where the register says why a transcription is acceptable *now*, when `corpus.ts`'s own JSDoc
says it was not before). A site with no verdict fails the register. *This is the criterion the
ticket exists for; the other twenty-three are consequences of it.*

**AC-10.** **Every `re-aimed` site is demonstrated red before green against the live spike tree**,
and the demonstration is recorded in the implement report by assertion name and failure message. This
is the criterion that forces Q-0103b to land before the deletion, and it is unsatisfiable after it.

**AC-11.** The template parity chain is replaced by one direct link:
`packages/core/src/lint/lint.test.ts`'s `SHIPPED` becomes
`['harness/flows', 'packages/cli/templates/harness/flows']`, and
`packages/cli/src/templates.test.ts` compares `packages/cli/templates/harness/` against
`harness/flows/` and `harness/roles/code-reviewer.md` — the byte-shared set
`harness/architecture.md:92–94` names — rather than against the spike. Both directions of the name
set stay reported separately, which that file already does. *Test:* mutating one byte of
`harness/flows/chore.yaml` fails the guard, and mutating one byte of the `packages/cli` copy fails it
too; the bidirectionality Q-0093 mutation-tested is preserved.

**AC-12.** `packages/core/src/git-identity.test.ts`'s corpus drops its `spike/test` row, and the
assertion `'spike/test must be in the corpus'` is **replaced by an assertion that the corpus is
non-empty and names the directories it does cover**, so the guard cannot silently narrow to nothing.
*Test:* emptying the corpus list fails. Q-0079's tripwire must not become a check with no subject in
the change that shrinks its subject.

**AC-13.** `packages/core/src/test-command.test.ts` drops `spikeSources()`, the `spike` job reads and
the `asItWas` register, and its phase list `['isolation','probe','install','spike suite','workspace
suite']` loses `'spike suite'` — matched to `git-identity-sweep.sh`, which must lose the same phase.
*Test:* the sweep script and the test agree on the phase list, derived rather than hand-written in
both.

**AC-14.** The seven spike `inputs` across the three `packages/*/turbo.json` files are removed with
their explanatory comments, and `packages/core/src/turbo-inputs.test.ts`'s register rows go with
them. *Test:* `turbo-inputs.test.ts` passes, and no declared input names a path that does not exist —
which is the guard's own subject and is the one direction it does not currently check.

**AC-15.** The four surfaces outside `developer-generalist`'s path list — `README.md`, `CLAUDE.md`,
`eslint.config.js`, `vitest.shared.js` — are either (a) added to that role's `paths:` in Q-0103a, or
(b) named in this requirement as human-owned with the edits specified. **(a) is recommended**, since
role `paths` is prose rather than enforcement (`role.ts:27–31`) and three of the four are ordinary
workspace configuration a chore role should be able to write. Whichever is chosen is stated once,
here, so no implement round spends itself discovering the ambiguity. *Note:* editing
`developer-generalist.md` from an implement step governed by it is the Q-0086 hazard, so if (a) is
chosen the role edit belongs in **Q-0103a**, one ticket ahead of the step that relies on it.

**AC-16.** The loss of the role-table check is registered: `spike/test/smoke.js` is the only thing
that compares a role's `paths:` against `harness/architecture.md`'s third column, and it is deleted
in Q-0103c. Either a `packages/**` counterpart is written, or the gap is recorded in
`packages/shared/src/role.ts`'s JSDoc — which currently cites `smoke.js` by name and would otherwise
cite a deleted file. **Recommended: a counterpart**, since the role files and the table are edited in
AC-5 and AC-6 and drift between them is now newly possible.

### Q-0103c — the deletion

**AC-17.** `spike/` is deleted — 55 tracked files — and `git ls-files spike` returns nothing.

**AC-18.** `packages/core/src/spike-parity.test.ts` and `harness/port-charter.md` are deleted.

**AC-19.** `.github/workflows/ci.yml` holds exactly three jobs — `workspace`,
`git-identity-sweep-bare`, `git-identity-sweep-populated` — and `.github/scripts/`
holds only `git-identity-sweep.sh`. The four retired jobs are `spike` and the three port-freeze jobs,
and the two guard files (`port-freeze-guard.sh`, `port-freeze-guard.test.mjs`) go with them.
*Authority, and the answer to OQ-1:* `port-freeze-guard.sh:45` fails hard on a missing charter, so
all three freeze jobs go red the moment AC-18 lands — they are coupled to the charter, not merely
made pointless by it. *Test:* `test-command.test.ts`'s seven-job register becomes a three-job
register and is shown red against the old workflow.

**AC-20.** `eslint.config.js` drops `'spike/**'` from `ignores` and the paragraph at `:13–14`
explaining it. `vitest.shared.js`'s citation of `spike/test/run.js`'s header is **reworded, not
deleted** — the discovery guarantee it explains is the live one that
`packages/core/src/test-discovery.test.ts` enforces, and the reasoning survives its source.

**AC-21.** `README.md:8` and `CLAUDE.md:25,35` no longer tell a reader the runnable code is the
spike. `CLAUDE.md`'s Commands section names the two supported paths Q-0098 shipped —
`pnpm exec quorum` in the workspace, and the locally packed install — and **does not claim
registry-resolved `npx quorum`**, which is refused while every package is `"private": true`.

**AC-22.** `docs/04-architecture.md`'s testing strategy describes **one** required suite, what it
proves, and the four-link chain from a new failing file to a red `pnpm test`; the two-suite
paragraph, the 55% transfer share and the `spike-parity.test.ts` sentence go, and the status line is
bumped with the date and what changed.

**AC-23.** `docs/06-development-plan.md`'s M2 done-when reads one suite, Q-0010 §5's follow-up is
recorded as done, and **`packages/shared/src/docs.test.ts:417`'s literal pin is moved in the same
change** — editing that sentence without it turns the suite red.

**AC-24.** `docs/decisions/` is not edited. An entry describing the spike stays true of when it was
written (*"the decisions are append-only"*), and the new entry AC-25 below asks for is an addition
rather than an amendment.

### Gate obligation, not a criterion

**GO-1 — a decision entry is owed before Q-0103b's implement step runs, and no step on the chore
route may write it** (`harness/roles/developer-generalist.md:23`). Its subject is AC-9: *what a test
compares against once the port's independent witness is gone.* The three verdicts AC-9 permits are a
policy, and `corpus.ts`'s own JSDoc argues against one of them — *"compares against it rather than
against a transcription of it"* — so `transcribed` needs an authority the register can cite.

This is the **fourteenth** appearance in this repository of a loop handed work no agent in it can
perform, and the fourth where the requirement names the hazard in advance. Q-0062 was launched
without the entry GO-1 demanded and spent three implement rounds and roughly $30 on it; Q-0101 spent
$31.16 the same way. The entry is cheap and the rounds are not. **Do not launch Q-0103b without it.**

---

## 8. Non-goals

Inherited from the ticket body and confirmed:

- **Registry-resolved `npx quorum`** — refused while every package is `"private": true`; Q-0029's, in M6.
- **Any fix to Q-0102**, whose subject is a flaky oracle under load, not the spike. Note it will
  still be red after this ticket, and its `@quorum/core` cluster is *made smaller* by AC-14's input
  reduction without being fixed.
- **Q-0059, Q-0060, Q-0066, Q-0068, Q-0100** — the defects that landed in both trees. After the
  cutover each is smaller, not closed, and none may be closed in passing. Q-0100 is the sharpest
  temptation: AC-21 edits `CLAUDE.md`'s Commands line, which sits one line from a `harness` spelling
  Q-0100 owns.

Added by this requirement:

- **The `owner: process.env.USER` defect** at `backlog.ts:190`. Nine instances and three hand
  corrections have never reached the code and this ticket does not reach it either.
- **Q-0039 (one run at a time per ticket).** Three children run in sequence and share a ticket id, so
  two concurrent runs would share a worktree and compute the same run id. The mitigation is
  procedural — run them one at a time — not a fix.
- **`harness worktrees`** (Q-0062's successor). The cutover leaves worktrees like every other run.
- **Rewriting the ~634 comment-line citations** of spike paths under `packages/**`. They become
  dangling references to a deleted tree. This is real and is deliberately not this ticket: it is a
  mechanical sweep across roughly a hundred files with no behaviour attached, it would swamp the
  review of three changes that do have behaviour, and the engineering rule those comments obey
  (*"one line naming the authority"*) is satisfied by a citation to a ticket id even where the path
  is gone. **It is owed its own ticket and is registered here so the obligation does not expire.**

---

## 9. Open questions

- **OQ-1 (was the body's OQ-1) — settled, not open.** The three port-freeze jobs go with the charter,
  because `port-freeze-guard.sh:45` fails on its absence. Recorded as AC-19.
- **OQ-2 — widened.** `harness/rules.md` needs more than the ESLint sentence: it instructs every
  agent to install and run the spike suite. Recorded as AC-4. What remains genuinely open is
  §5.4's consequence — whether AC-16 buys a `packages/**` counterpart for the role-table check or
  settles for a JSDoc note. **Recommended: the counterpart.** *Owner: the gate.*
- **OQ-3 (was the body's OQ-3) — refuted.** `ci.yml:64` executes the guard's suite today. The
  deletion is still right; the premise was stale. No action beyond deleting both files with the jobs.
- **OQ-4 — new, and the only blocker.** AC-9's policy: which of `retired` / `re-aimed` /
  `transcribed` is the default, and on what authority may a spike literal become a pinned constant?
  This is GO-1's subject and **must be ruled before Q-0103b's implement step**. *Owner: the human, at
  the requirements gate.*
- **OQ-5 — new.** Does `packages/shared` keep a `test/corpus.ts` at all once its spike helpers are
  gone? It still exports `repoFile`, `flowFiles`, `roleFiles`, `decisionFiles` and others used
  workspace-wide, so the answer is almost certainly yes — but the file's JSDoc is written around the
  witness role and needs rewriting rather than trimming. *Owner: Q-0103b's implementer.*
- **OQ-6 — new.** After AC-6, does anything still distinguish `developer-backend` from
  `developer-tooling`? Their remaining difference was largely `spike/src` versus `spike/bin`+
  `spike/test`. Merging them is out of scope here; **noticing that the distinction may have
  evaporated is not**, and it wants a ticket. *Owner: the gate.*

---

## 10. Risks

**R-1 — the highest-risk edit is AC-2, and it is not caught by a test.** Every flow's `integrate`
step runs `commands.install` and `commands.test`. A mistake there surfaces as the *next* run failing
in its worktree, classified as an environment failure that stops the run after implement and review
have been paid for. Ground rule 2 is right and is restated as an exit condition:
**Q-0103a is not done until a real `integrate` has passed with the new commands.** Since Q-0103a's
own `integrate` runs the *old* ones (`engine.js:61`), the proof is Q-0103b's `integrate`, and
Q-0103c must not be launched before it is seen green.

**R-2 — Q-0103a's `integrate` does not exercise the spike suite.** Its run-start `commands.test`
still includes the spike half, so it does; the loss is the reverse — after AC-2, nothing runs the
spike suite again, including during Q-0103b when `spike/` still exists. That is acceptable and is
stated rather than discovered: from Q-0103a's merge onward, `spike/` is present but unproven. The
window is two tickets long and the tree is deleted at its end.

**R-3 — deleting coverage under cover of a re-aim.** AC-9's `retired` verdict is the one an
implementer under time pressure will reach for, because it requires no new assertion. The register's
one-sentence-per-site requirement and AC-10's red-before-green demonstration are the two guards, and
a reviewer should treat a `retired` verdict whose named sibling assertion does not actually assert
the same property as a blocker rather than a nit.

**R-4 — the review loop cannot rule OQ-4.** If GO-1's entry is missing when Q-0103b starts, its
implement step meets a blocker it may not clear, the reviewer will correctly refuse, and the loop
will spend its budget. Thirteen prior instances; two of them cost $30 and $31.16. The remedy is
sequencing, not a criterion.

**R-5 — `docs.test.ts` and `plan-backlog.test.ts` fire on the documentation edits themselves.**
AC-23 names the first. The second requires every `backlog/` folder to be named in the plan — three
children mean three folders, all of which must be added to `06-development-plan.md` as they are
created, or the suite goes red on ticket creation rather than on implementation.

**R-6 — the three children share one ticket id and one integration branch if cut as `a/b/c`
suffixes.** The allocator has no notion of a sub-ticket (`nextId()` parses `<PREFIX>-nnnn`), so the
cut must be **three real ids** — Q-0103 keeps one part and two successors are allocated — not
`Q-0103a`. Recommended: Q-0103 keeps the deletion (it is what its title describes), and the commands
and the workspace halves are allocated as new ids ahead of it. *This is a gate decision and is
flagged rather than taken here, because it changes what `harness ticket new` is asked to do.*

---

## 11. Cross-cutting checklist

| | |
| --- | --- |
| **BYOS** | n/a — no code path, test, fixture or example gains or loses a credential path. The BYOS refusal strings live in `packages/core/src/adapters/{claude,codex}.ts` and their spike twins; the spike copies are deleted with the tree, which is Q-0068 becoming a one-tree ticket rather than being closed. |
| **Worktree safety** | n/a to the change; **relevant to the route.** All three children run `chore.yaml`, which writes only in `.harness/worktrees/`. No criterion writes to the user's tree. |
| **Gate behaviour** | Unchanged. GO-1 is a human obligation discharged at a gate, per *"the window for an erratum is a gate"* (Q-0094 E-3). |
| **File format and schema** | One format moves: `q0080-allocation.json` changes path, not shape (AC-7). No zod schema changes. `role.ts`'s `paths` field is untouched — AC-6 edits values, not the schema. |
| **Lint rules** | `eslint.config.js` widens by removing an ignore (AC-20). Nothing under the deleted tree was linted, so no new violation can appear from the removal itself — stated rather than assumed, since `spike/**` leaving `ignores` would otherwise be a lint-surface change. |
| **Cold-clone impact** | **Net positive and worth naming.** A stranger cloning after the cutover installs one dependency set and runs one suite, where today they must discover a second npm tree with its own lockfile. AC-6 also stops `quorum init` scaffolding a role that grants write access to a directory the adopter has never had. AC-21 keeps the two supported installation paths accurate and does not claim the registry one. |

---

## 12. What a reader should not re-derive from this document

Per this repository's most-repeated lesson, the measurements above were taken from the tree at
`83b193c` on 2026-09-05 and are not copies of the ticket body's. Three of the body's figures were
confirmed exact and are safe to reuse; **three of its statements are wrong and must not be carried
forward** — that `packages/**` needs no change beyond `spike-parity.test.ts` (sixteen files do), that
`port-freeze-guard.test.mjs` is executed by nothing (`ci.yml:64` runs it), and that the freeze jobs
are 46 lines (they are 60). If a later document repeats any of the three, it is reading the ticket
body rather than the tree.
