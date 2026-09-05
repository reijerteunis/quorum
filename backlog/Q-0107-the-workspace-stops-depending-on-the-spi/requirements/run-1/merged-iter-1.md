# Q-0107 — The workspace stops depending on the spike

*Merged requirement, run 1, iteration 1. Measured against the tree at `fc7df27` on 2026-09-05 —
which is **not** the tree Q-0103's merged requirement was written against (`83b193c`), and is one
shipped child later.*

---

## 0. Verdict, stated first

**ready.** No open question blocks solutioning. Every question either candidate raised is ruled in
§7 or is non-blocking with its owner named.

**Fourteen criteria against a ceiling of fifteen**, and the size is deliberate rather than
comfortable: AC-8 to AC-19 are the twelve inherited, in corrected form; **AC-29** (the register's
membership is derived) and **AC-30** (the standing read-position guard) are added because without
them AC-10's and AC-12's verdicts are unfalsifiable prose. GO-3's seam — AC-12 + AC-13 + AC-19 —
remains available at an exhaustion gate if a reviewer wants B smaller; nothing else splits without
separating a re-aim from the register row that disposes of it.

**What this document is for is not the verdict.** The inherited criteria were written before the
decision entry that now rules them and before Child A changed four of the files they describe.
Re-measured, **seven inherited statements are wrong or unsatisfiable as written**, and three of them
stop an implement round rather than merely embarrassing it. Three further statements — in the
*candidate that found those seven* — are also wrong, and one of them would have shipped an
unsatisfiable criterion:

| | Stated in circulation | Measured at `fc7df27` |
| --- | --- | --- |
| AC-17 | all seven spike `turbo.json` inputs go in this child | **six**; `packages/core`'s `../../spike/test/**` has a live reader until Child C |
| AC-10 | four verdicts — `retired` `re-aimed` `transcribed` `moved` | **five**; decision 079(b) maps to none of them |
| AC-12 | the six guards are *"green forever, no subject"* | **still falsifiable**; 079 names them class (b) and says so in as many words |
| AC-12 | six sites, one shape | **eight sites, three shapes** |
| AC-13 / AC-19 | `step-output.ts:12,16,19` — three citations | **four**, at `:12,14,16,19`, in a file carrying twelve |
| AC-15 | `:28` and the corpus assertion | **four sites**, adding `:249` and the floor's derivation at `:33` |
| AC-5 residue | `harness/architecture.md` is finished with Child A | **`:51` and `:78` are this child's**, by Q-0106's own ruling |
| AC-30 (candidate) | "exactly two exclusions are permitted" | **unsatisfiable** — 54 production files cite `spike/` in JSDoc, which AC-19 forbids touching |
| AC-29 (candidate) | "a crude scan returns 46 files and 210 lines" | **139 tracked files, 960 lines**; 86 files / 292 lines carry a quoted `spike/` literal |
| §3.1 (candidate) | 39 helper calls in eight files | **39 calls in seven files**; the 40th grep match is one prose line |

Every departure from Q-0103's text is labelled **(supersedes)** in §5 and enumerated in §3.2, and
every departure from the candidate that corrected it is labelled the same way. A corrected number
that travels without its correction is this repository's most-recorded defect, and this document is
not going to add an instance.

**This document is the authority for this ticket.** Read Q-0103's merged requirement for context,
never for a figure.

---

## 1. Problem

`spike/` is 55 tracked files and 9,732 lines, re-measured, and it has no product reader: every
command is `packages/cli`'s and every domain helper is `packages/core`'s. What it still has is
**test readers**, and the ticket that deletes it cannot honestly repair them.

The reason is one sentence, and it is the ruling that created this child:

> **You cannot demonstrate a re-aimed oracle red-before-green once its subject is deleted.**

So the tree stays for the whole of this change, every disposition is demonstrated against it, and
the deletion is Child C's. Doing this work inside the change that deletes the tree verifies all
twelve criteria by reading, which is *"A check is not established by reading it"* (2026-08-29) —
the port's most expensive lesson — arriving at its own funeral.

What makes the work hard is not the sixteen files that read the spike from disk and fail loudly when
it goes; those announce themselves. It is the class that **does not**: assertions, registers and
declared inputs that name the spike without opening it, whose verdict after the cutover is either
unchanged-and-meaningless or, worse, dependent on something nobody chose. Two measured instances,
neither of which appears in any inherited list:

- `packages/core/src/contracts/contracts.source.test.ts:185` asserts that the resolved path of
  `ajv/package.json` does not contain `spike`. Once `spike/node_modules` cannot exist, that clause
  can only fail if the repository happens to live under a directory whose name contains the word —
  which makes it either vacuous or **a verdict that is a property of the machine**, forbidden by
  *"A test's verdict is a property of the commit, not of the checkout or the account"* (2026-08-30).
  A check that becomes a violation of a different rule by being left alone.
- `packages/core/src/engine/q0050.source.test.ts:109` asserts the engine folder imports no specifier
  under `spike/`. After the cutover such an import fails typecheck before it reaches this assertion,
  so the clause survives as text that cannot report anything the compiler has not already refused.

**Who feels it.** The `maintainer` cannot land M2's last item and cannot trust the tick that says the
suite is green, because a suite that quietly stops checking things reports the same colour as one
that still does. The `contributor` inherits a repository where *"the port's only independent
witness"* is gone and no artifact says what replaced it. The `adopter` feels one narrow thing:
`templates.test.ts` is what keeps their scaffolded `harness/flows/` from being a stale copy of the
shipped ones, and this child removes the middle link of the chain that proves it.

**Surfaces.** No product surface changes. What changes is the workspace's own suites, three
`turbo.json` input lists, one CI support script, three production JSDoc citations, and **two
sentences in `harness/architecture.md`** — which is fed to every chore `implement` step at run time,
so a false claim there is inherited by every future run (Q-0098's finding, one layer down).

---

## 2. User stories

- **As the `maintainer`,** I want every re-aimed check demonstrated red **and then** green against
  the live spike tree, so I am not asked to believe a guard whose subject was deleted in the same
  change that rewrote it.
- **As the `maintainer`,** I want a `retired` verdict to cost as much evidence as a `re-aimed` one,
  because deleting coverage is the cheap move and the one nothing catches.
- **As the `maintainer`,** I want the register's membership derived from the tree, so the site
  nobody thought of is a red test rather than a silence.
- **As the `maintainer`,** I want `commands.install` and `commands.test` proven by this child's real
  `integrate`, because Child A could not prove its own commands and Child C must not start on a
  promise.
- **As the `contributor`,** I want the workspace suite and package configuration to name only
  maintained workspace subjects, so a green result after the cutover does not hide a missing
  fixture, a dangling declared input, or a check that became vacuous.
- **As the `contributor`,** I want `harness/architecture.md` to stop naming a file that is about to
  be deleted as the only thing checking the role table, so the context I am handed at run time
  describes the repository I cloned.
- **As the `adopter`,** I want the template parity chain to survive losing its middle link, so my
  first `quorum init` still scaffolds flows that are byte-identical to the shipped ones.

---

## 3. What was measured

At `fc7df27` on 2026-09-05, from the tree. Commands are given so a reader can re-run them rather
than believe them.

### 3.1 Confirmed exact

| Claim | Measured | Verdict |
| --- | --- | --- |
| `spike/` is 55 tracked files, 9,732 lines | `git ls-files spike \| wc -l` → 55; `\| xargs wc -l` → 9732 | **exact** |
| `main` is not ahead of `origin/main` | `git rev-list --count origin/main..HEAD` → **0** | **exact** — unlike the state Q-0105 records, this child starts from a `main` CI has seen |
| Seven spike `inputs` across three `turbo.json` | `shared` `:34 :35 :36`; `core` `:40 :46 :47`; `cli` `:58` | **exact** |
| Three direct `repoFile('spike…')` | `spike-parity.test.ts:1091`, `packages/core/src/backlog/backlog.test.ts:75`, `packages/shared/src/docs.test.ts:307` | **exact** |
| `packages/cli/src/package.test.ts:161` register row and `:187` input copy | both present, both naming the spike | **exact** |
| `packages/core/src/lint/lint.test.ts:871` `SHIPPED`; `packages/cli/src/templates.test.ts:50` `SPIKE_TEMPLATES` | `['harness/flows', 'spike/templates/harness/flows']`; `path.join(WORKSPACE, 'spike', 'templates', 'harness')` | **exact** |
| `git-identity-sweep.sh` runs the spike at `:117` and `:119–121` | `( cd spike && npm ci )`, phase `spike suite`, `( cd spike && npm test )` | **exact** |
| `packages/core/src/test-command.test.ts:467` is a hand-written five-phase literal | includes `'spike suite'` | **exact** |
| Child A shipped its half | `harness/rules.md` names the spike **zero** times; `harness.yaml` is `pnpm install --frozen-lockfile` / `pnpm turbo run test --force --continue` | **exact** |
| `developer-generalist` keeps `spike` in `paths:` | `harness/architecture.md:27` | **exact** — Q-0106's central correction, and what makes AC-8 performable |

**The helper call sites are 39, in seven files.** Derived per helper rather than by one alternating
grep: `spikeSource(` 31 real calls (`constants.test.ts` 14, `events.test.ts` 10, `project.test.ts` 5,
`role.test.ts` 1, `stages.test.ts` 1), `spikeLintFlow(` 7 (`flow.test.ts`),
`frontmatterRegexMatchesSpike(` 1 (`ticket.test.ts`). A naive scan returns **40 matches**: the extra
is `packages/core/src/turbo-inputs.test.ts:246`, one line whose `why:` **prose value** names two of
the helpers and calls neither. **This number is stated with its derivation precisely so that AC-29
does not use it.**

### 3.2 The ten statements that do not survive re-measurement

**(a) AC-17 is unsatisfiable in this child, mechanically.** After this child's other criteria land,
each of the seven inputs loses its last reader — *except one*. `packages/core/src/spike-parity.test.ts`
reads `spike/test/**` (`readdirSync` at `:1054`, every file's text, `repoFile('spike/test/run.js')`
at `:1091`) and **Child C deletes it** (Q-0103 AC-21). Removing `../../spike/test/**` from
`packages/core/turbo.json` here therefore creates an **undeclared read** — refused by Q-0072's guard,
which already carries `dir: 'spike/test'` rows at `turbo-inputs.test.ts:214` and `:274` and registers
the walk's root at `:657`. Six go in this child; the seventh is registered with a comment naming its
sole remaining reader.

**(b) AC-10's verdict set cannot record the disposition GO-1's entry prescribes.** Decision 079 has
three classes — (a) satisfied-by-the-absence, (b) still-falsifiable-but-guarding-a-vanished-hazard,
kept only as a resurrection tripwire, and (c) a register whose entry is updated. AC-10 offers
`retired`, `re-aimed`, `transcribed`, `moved`. **079(b) maps to none of them**, and 079 names the
`*.source.test.ts` clauses as its worked example of that class. An implementer following the entry
GO-1 made blocking has no verdict to write down.

**(c) AC-12's premise is contradicted by the entry that rules it.** AC-12 and Q-0103 §3.2 call the
six *"green forever, no subject"*. Measured, five of them scan every line matching
`^\s*(import|export)\b` or containing `require(` for the substring `spike`; an export line carrying a
trailing comment that names the spike still fails them after the cutover. Decision 079 says exactly
this — *"a file could still contain the string, so they can still fail"* — and then: **"Class (b) is
the one that looks like (a) and is not."** The remedy AC-12 asks for is right; its reasoning must
move, or the register will record class (a) verdicts for class (b) sites and the entry will have been
cited rather than applied.

**(d) The six are eight, and they are three shapes, not one.**

| Site | Shape | Corpus |
| --- | --- | --- |
| `adapters.source.test.ts:129` | line scan for the substring | its own folder |
| `contracts.source.test.ts:76` | same | its own folder |
| `fanout.source.test.ts:126` | same | its own folder |
| `lint.source.test.ts:66` | same | its own folder |
| `run-history.source.test.ts:121` | same | its own folder |
| `backlog.source.test.ts:60` | **parsed specifiers**, by its own inline regex | **all of `coreSourceFiles()`** |
| `contracts.source.test.ts:185` | `require.resolve` path contains `spike` | the installed npm tree |
| `q0050.source.test.ts:109` | `not.toMatch(/from ['"][^'"]*spike\//)` | the engine folder |

Q-0103 §3.2 lists the first six and writes *"same"* against `backlog:60`, which is a different
predicate over a different corpus. The last two are in no candidate and no iteration.
`contracts:185` is the dangerous one, for the Q-0079 reason in §1.

**(e) `step-output.ts` has four spike citations in the block AC-13 is about, and twelve in the file.**
`grep -n "spike/" packages/shared/src/step-output.ts` → `:12 :14 :16 :19 :33 :44 :46 :50 :60 :77 :79
:80`. The FOUR-VALIDATIONS block is `:12 :14 :16 :19`; `step-output.test.ts:61–63` pins three of the
four, omitting `:14` (`spike/src/engine.js:679`, `schemaFor`). Correcting three of four leaves one
comment block half naming a deleted tree and half naming the workspace, which is worse than either
state. **The unit is the block.**

**(f) AC-15 names two of four `git-identity.test.ts` sites.** `:28` is the corpus row and `:217` the
assertion. Also present: `:249`, which hands `exempt()` the literal
`'spike/test/q0035-empty-range.js'` as the *"nor in the spike tree"* fixture — still falsifiable
afterwards, `exempt` being a pure predicate over a string, but its provenance dies; and
`CORPUS_FLOOR = 45` at `:35`, whose JSDoc at **`:33`** derives it as *"43 packages files and 17 spike
files"*. Dropping seventeen files does not breach the floor, because `packages/**` has grown well past
43 since 2026-08-30 — **the floor holds and its stated derivation stops being true**, a comment
promising what the number beneath it no longer means.

**(g) Two `harness/architecture.md` sentences are this child's, by Child A's own ruling.** Q-0106's
merged requirement §3.4(f) and §3.4(g) rule both into Child B by name, and its disposition table marks
`:51` **unchanged** for exactly that reason. Measured on the post-Child-A tree, three spike mentions
remain:

- `:27` — the `generalist` role-table row. **Stays**, deliberately (Q-0106); Child C removes it.
- `:51` — *"`spike/test/smoke.js` parses each cell as a comma-separated path list and asserts it
  equals the role's `paths` frontmatter"*. True today, and the only thing checking the role table. It
  moves **with AC-18**, which is what replaces it.
- `:78` — the template-sharing paragraph naming `spike/templates/harness/` and
  `packages/cli/templates/harness/` as *"themselves byte-identical to each other"*. It moves **with
  AC-14**, which collapses the chain to one link. **Q-0106 §3.4(g) calls this sentence `:94`**; that
  was its pre-Child-A line number, and the freeze paragraph Q-0106 removed is what moved it.

Neither AC-14 nor AC-18 mentions the file. Read literally, both sentences survive into Child C
describing machinery that no longer exists, in a document every implement step is fed.

**(h) The candidate's AC-30 is unsatisfiable as worded, and this is the correction that matters
most.** It asks for a guard proving *"no file under `packages/**` names a path under `spike/` or a
bare `spike` segment"*, with *"exactly two exclusions"*. Measured: **54 production `.ts` files under
`packages/*/src` cite a `spike/` path**, all of them in JSDoc — `flow.ts` 9 sites, `constants.ts` 6,
`events.ts` 4, and so on. AC-19 permits three production files to change and §4 defers the citation
sweep to its own ticket, so a text-level guard with two exclusions **cannot pass in this child**, and
an implementer meeting it has a criterion that contradicts a non-goal of the same document. The
guard's subject must be **read positions** — import specifiers and path literals reached by code —
not text occurrences, and its exclusion set must be a derived register with a reason per entry rather
than a fixed count. A JSDoc citation of a deleted file is stale prose that no test should be asked to
catch; a *read* of a deleted file is what breaks, and bounding that is what makes Child C mechanical.

**(i) The candidate's AC-29 authority figure is wrong, in the direction that strengthens its own
argument.** It says *"a crude scan today returns 46 files and 210 lines"*. Measured over tracked files:
`git ls-files packages | xargs grep -l spike` → **139 files**, `grep -n` → **960 lines**. Narrowed to a
quoted `spike/` path literal: **86 files, 292 lines**; dropping lines that begin `*`, `//` or `#`:
**97 lines across 24 files**, still mostly one-line JSDoc. The conclusion — derive the membership,
never list it — is right and is now supported by a number that survives being checked.

**(j) The helper figure is 39 calls in seven files, not eight.** The candidate's own enumeration names
seven (`constants`, `events`, `project`, `role`, `stages`, `flow`, `ticket`) while its prose says
eight. Q-0103 §12 item 5 says *"40 call sites on 39 lines"*; the fortieth is
`turbo-inputs.test.ts:246`, prose. Two documents, two different off-by-ones, about the same set — which
is the argument for AC-29 stated better than any sentence could.

**(k) Two files are cited by basename and there are two of one of them.** `lint.test.ts:871` is
`packages/core/src/lint/lint.test.ts:871`, and `packages/cli/src/lint.test.ts` also exists;
`test-command.test.ts` is `packages/core/src/test-command.test.ts`. Every criterion below gives the
full path.

### 3.3 What the retirements actually cost, which is less than R-1 fears

For most of the 39 helper sites **the sibling already exists, in the same test body, and is already
green**:

- `stages.test.ts` has three tests: *"the exported tuple deep-equals the spike declaration"*, *"the
  ten members are the ones the state machine documents"* — a transcribed literal list, already
  present — and *"the schema and the type derive from that one tuple"*. Only the first dies.
- `constants.test.ts` pairs every `expect(spikeSource(…)).toContain(literal)` with an
  `expect(CONSTANT).toBe(value)` **in the same `test()` block**. The spike half is the port's drift
  check; the workspace half is the contract. Only the first dies.
- All five line-scan guards sit immediately below a **positive import allow-list** over
  `importsOf(text)` in the same test body — strictly stronger than *"not spike"*.

So the honest verdict for most of the class is `retired`, and the sibling is nameable without
inventing anything. **One residual is real and must be recorded rather than glossed:** the five
allow-lists iterate parsed specifiers, while the spike clauses iterate raw lines *including*
`require(`. Retiring the clause without widening the allow-list's iteration loses the `require(`
shape — narrow, since `createRequire` appears in `contracts.source.test.ts`, and therefore not
hypothetical.

### 3.4 The two re-aims that are not path swaps

- **`packages/shared/src/docs.test.ts:307`** reads `spike/src/contracts.js` for `TERMINAL_STATUSES`.
  The workspace counterpart is `packages/core/src/contracts/run-manifest.ts:24` — a module-private
  const in a package `packages/shared` may not import (`04-architecture.md:60`). **Reading it as text
  is already established and permitted**: `packages/shared/turbo.json` declares `../core/package.json`,
  `../core/src/adapters/adapters.ts` and `../core/src/backlog/project.ts` as inputs today, and
  `project.test.ts:342–344` already compares the spike against a `packages/core` file by text. The
  re-aim costs **a declared input plus a `turbo-inputs.test.ts` register row in the same change**.
- **`packages/shared/src/events.test.ts`** proves the event union is derived from what the product
  emits (decision 049, 2026-08-25) by reading four spike adapters. Its successor witness is
  `packages/core/src/adapters/{claude,codex,mock}.ts` — same shape, same declared-input cost.

### 3.5 The precedent this child copies rather than invents

`packages/cli/src/end-to-end.test.ts:517–531` already ships AC-30's shape, scoped to one file: two
clauses (`/spike\//g` for a path, `/['"`]spike['"`]/g` for a bare segment handed to `path.join`) **and
a second test proving both clauses discriminate**, built from assembled strings so the guard's own
source does not trip it. Its describe block is already titled *"the suite runs after the spike is
deleted, which is what the cutover turns on"*. It passes today because that one file contains no
mention at all — which is precisely why generalising it needs §3.2(h)'s narrowing rather than a
wider `SOURCE`.

---

## 4. Non-goals

Inherited and confirmed:

- **Deleting `spike/`, `packages/core/src/spike-parity.test.ts`, the CI jobs, the port-freeze jobs and
  scripts, or `harness/port-charter.md`** — Q-0103's, and only after this child is green. `spike/`
  must still be on disk when this child's `integrate` runs.
- **The commands, context files and roles** — Q-0106's, shipped. The two `harness/architecture.md`
  sentences §3.2(g) names are the exception and are ruled into this child by Q-0106 itself.
- **The JSDoc citation sweep across production source.** 54 files, mechanical, no behaviour attached,
  and owed its own ticket (GO-6). AC-13 and AC-19 are the only parts of it that cannot be deferred,
  because a live assertion pins them. **One constraint is recorded here so the sweep ticket inherits it
  rather than discovering it:** `q0050.source.test.ts:67` classifies a `Why:` clause by matching
  `/^behaviour preserved from spike\//` and **throws** on a clause it cannot classify, and `:191–203`'s
  `REGISTERED` map pins eight such lines across `composite.ts`, `diff.ts` (×2), `engine.ts`,
  `loaders.ts`, `prompt.ts`, `steps.ts` and `suite-output.ts`. Those citations stay true after the
  deletion — the behaviour did come from the spike — so nothing here touches them; a later sweep that
  rewords them without moving the register turns the suite red.
- **Any fix to Q-0102**, whose subject is a flaky oracle under load. See R-2.
- **Q-0059, Q-0060, Q-0066, Q-0068, Q-0100** — each becomes smaller, none is closed.
- **`harness worktrees`** (Q-0062's successor), **Q-0039**, the `owner: process.env.USER` defect at
  `backlog.ts:190`, and registry-resolved `npx quorum`.

Added here:

- **Widening a folder's positive import allow-list beyond what §3.3's residual requires.** The
  `require(` shape is closed because retiring the spike clause would otherwise lose it; nothing else
  about those allow-lists moves.
- **Preserving the spike as an archive, fixture tree, tarball or second suite** (from codex).
- **Adding a dependency** (from codex).
- **Merging `developer-backend` and `developer-tooling`** — Q-0103 OQ-4's, still open.
- **Any v1 exclusion-list item**: multi-user, remote daemon, cloud sync, plugin marketplace, visual
  canvas, eval suites, Gemini adapter, desktop shell.

---

## 5. Acceptance criteria

Numbered continuously across the three children (A: AC-1–AC-7; B: AC-8–AC-19; C: AC-20–AC-28), so a
criterion keeps its name if the cut moves. AC-29 and AC-30 start after Child C's last.

**AC-8.** `spike/test/q0080-allocation.json` **moves** into the workspace — recommended
`packages/core/src/backlog/q0080-allocation.json`, beside its one remaining reader — with its
`"about"` prose corrected to name one tree. `packages/core/src/backlog/backlog.test.ts:75` reads the
new path, and `packages/cli/src/ticket.ts:8`'s citation of *"the one copy both trees read"* moves with
it (AC-19). *Test:* the table's row count and the test's assertion count are identical before and
after, **asserted rather than eyeballed**.

**AC-9.** `packages/shared/test/corpus.ts` exports no `spikeSource`, `spikeLintFlow` or
`frontmatterRegexMatchesSpike`, and no file under `packages/**` calls one. *Test:* an executable
assertion, so a re-introduction fails rather than merely being unusual. The file **stays** — it still
exports `repoRoot`, `repoFile`, `corpusFiles`, `flowFiles`, `roleFiles`, `decisionFiles`,
`ticketFiles`, `codeLines`, `importSpecifiers`, `sharedSourceFiles` and others used workspace-wide —
and its header, written around the witness role (*"the only witness available to the package
everything else imports"*), is **rewritten rather than trimmed**. `FRONTMATTER` and `parseFrontmatter`
stay; what goes is the claim that a second tree proves them.

**AC-10 — the criterion this ticket exists for.** Every dependency is dispositioned in a register
carrying **one sentence per site**, with exactly **five** permitted verdicts:

| verdict | meaning | authority |
| --- | --- | --- |
| `retired` | the property is proven elsewhere — **the sibling assertion is named by file and line** | 079(a) |
| `re-aimed` | the same property, now asserted against `packages/**` — the new subject is named | 079(a) |
| `kept` | still falsifiable, kept as a resurrection tripwire — **the resurrection is named**, and the clause is shown to fire | **079(b)** |
| `transcribed` | the spike's literal becomes a pinned constant — permitted **only** where the value is `packages/**`'s own contract, never where it was evidence about the deleted tree, and carrying its provenance in place | 079, *"On transcription"* |
| `moved` | AC-8's shape | 079(c) |

**The register is executable and lives in a `packages/**` test file** — not in the implement report,
which is round-scoped by Q-0086 and unreadable by any later run, and which cannot make a missing
verdict red. 079(c) is the authority: *"a register that silently loses a row has destroyed the only
evidence that anyone chose."* Recommended home: beside AC-30's guard, so the exclusion register and
the disposition register are one artifact. A site with no verdict fails. *(supersedes: the inherited
four-verdict set, which cannot record 079(b) — §3.2(b); and settles codex OQ-1.)*

**AC-11.** Every `re-aimed`, **every `retired`** and every `kept` site is **demonstrated red before
green against the live spike tree**, recorded in the round-scoped implement report by assertion name
and observed failure message:

- for `re-aimed`, the new assertion is shown failing against the property it now guards;
- for `retired`, **the named sibling is shown failing** when the property is broken in `packages/**` —
  a `retired` verdict is a claim about a *different* test, and reading that test is how this
  repository has been wrong five times;
- for `kept`, the clause is shown failing over a file that carries the resurrected reference.

**A failure caused by a syntax error, a missing dependency or an unrelated assertion does not
establish anything**: the recorded message must identify the intended assertion. This is what forces
this child to land before the deletion, and it is unsatisfiable after it. *(supersedes: the inherited
AC-11, which required the demonstration only for `re-aimed`, leaving the verdict R-1 identifies as the
dangerous one with no evidence attached. Evidence bar from codex.)*

**AC-12 — the silent class.** The **eight** guards enumerated in §3.2(d) are each `retired`,
`re-aimed` or `kept` under AC-10, and **none is left in a state where its verdict is unchanged by any
commit a maintainer would act on**. Disposition is decided by 079's question — *can it still fail for
a reason somebody would act on?* — not by whether the word `spike` appears in it:

- The five line-scan clauses: recommended `retired`, sibling being the **positive import allow-list in
  the same test body** (§3.3), with that allow-list's iteration widened to cover the `require(` shape
  the retired clause caught and it does not.
- `backlog.source.test.ts:60`: recommended `retired`, sibling AC-30's guard, whose corpus is wider
  than `coreSourceFiles()`.
- `contracts.source.test.ts:185`: **`retired`, and the reason is not the cutover.** After the deletion
  the clause can only fail if the checkout's own directory names contain `spike` — a verdict that is a
  property of the machine, refused by *"A test's verdict is a property of the commit, not of the
  checkout or the account"* (2026-08-30). The ajv-8 half of that test stays.
- `q0050.source.test.ts:109`: recommended `retired`, sibling AC-30.

*Test:* for each of the eight, the disposition's own demonstration under AC-11 — and, for every folder
whose clause was retired, adding a disallowed import to a module under test still fails that folder's
suite. *(supersedes: "six", the "green forever, no subject" characterisation, and the
`retired`-or-`re-aimed` binary — §3.2(c), §3.2(d).)*

**AC-13.** `packages/shared/src/step-output.test.ts:61–63` requires `step-output.ts` to contain
`spike/src/contracts.js` and two `spike/src/adapters/index.js:NNN` citations. The assertion and the
**whole FOUR-VALIDATIONS comment block** — `step-output.ts:12`, `:14`, `:16`, `:19`, four citations,
not three — are re-aimed at the `packages/**` locations of the same four validators, together, in one
change. *Test:* the assertion names no `spike/` path, **each path it names exists**, and the count of
pinned markers is unchanged. The other eight spike citations in that file (`:33`, `:44`, `:46`, `:50`,
`:60`, `:77`, `:79`, `:80`) are §4's non-goal and are **not** touched, so the file is deliberately left
mixed and the block is the unit. *(supersedes: "three citations at `:12,16,19`" — §3.2(e).)*

**AC-14.** The parity chain becomes one direct link. `packages/core/src/lint/lint.test.ts:871`'s
`SHIPPED` becomes `['harness/flows', 'packages/cli/templates/harness/flows']`;
`packages/cli/src/templates.test.ts`'s `SPIKE_TEMPLATES` (`:50`) and its comparison are re-aimed at the
byte-shared set, in both directions, reported separately as they already are;
`packages/cli/src/package.test.ts:161`'s register row is rewritten to describe the one-link chain; and
**`harness/architecture.md:78`'s template-sharing paragraph drops its spike term in the same change**,
per Q-0106 §3.4(g). *Test:* mutating one byte of `harness/flows/chore.yaml` fails the guard **and**
mutating one byte of the `packages/cli` copy fails it — the bidirectionality Q-0093 mutation-tested is
preserved, and the recursive walk `templates.test.ts` proves is not narrowed back to a flat `readdir`.
*(adds: the `architecture.md` half — §3.2(g).)*

**AC-15.** `packages/core/src/git-identity.test.ts` drops its `spike/test` corpus row (`:28`); the
assertion that `spike/test` must be in the corpus (`:217`) is **replaced by an assertion that the
corpus is non-empty and names the directories it does cover**; the `:249` exempt fixture stops naming
a path under `spike/`; and `CORPUS_FLOOR`'s derivation comment (`:33`) is re-derived rather than left
stating a composition that no longer holds. *Test:* emptying the corpus list fails, and the floor's
stated derivation matches what the corpus now contains. Q-0079's tripwire must not become a check with
no subject in the change that shrinks its subject. *(adds: `:249` and the floor — §3.2(f).)*

**AC-16.** `packages/core/src/test-command.test.ts` drops `spikeSources()` (`:52–57`), the assertions
that consume it (`:87`, `:93`), the `spike`-job reads (`:485–486`) and the `asItWas` block (`:559–563`);
its phase list at `:467` loses `'spike suite'`, matched to `.github/scripts/git-identity-sweep.sh`,
which loses that phase (`:119–121`) and the `( cd spike && npm ci )` line in `install` (`:117`).
**`CI_JOBS`'s `spike` row (`:511`) and the `WITHOUT_SPIKE` fixture stay** — the workflow still declares
the job until Child C, and `:502` says removing that row is Child C's decision to make visibly, which
is 079(c) working as designed. *Test:* the script and the test agree on the phase list, **derived
rather than hand-written in both** — `:467` is a hand-written literal today, which is the fail-open
shape Q-0051 found. *(clarifies which sites are this child's and which are Child C's, which the
inherited text leaves ambiguous.)*

**AC-17.** **Six** of the seven spike `inputs` go with their explanatory comments —
`packages/shared/turbo.json:34,35,36`, `packages/core/turbo.json:40,47`, `packages/cli/turbo.json:58` —
together with `packages/cli/src/package.test.ts:187`'s copy of the `cli` one and the
`turbo-inputs.test.ts` register rows that justify them. **`packages/core/turbo.json:46`
(`../../spike/test/**`) stays**, its comment rewritten to name `packages/core/src/spike-parity.test.ts`
as its sole surviving reader and Q-0103 as what removes both. *Test:* the input guard passes; **no
declared input names a path that does not exist**; and the one retained spike input is asserted to have
exactly one reader, so Child C's removal of it is forced rather than remembered. *(supersedes: "the
seven … go" — §3.2(a).)*

**AC-18.** The loss of the role-table check is closed rather than registered. `spike/test/smoke.js` is
the only thing comparing a role's `paths:` frontmatter against the third column of
`harness/architecture.md`'s table, and Child C deletes it, so **a `packages/**` counterpart is
written** — recommended in `packages/shared/src/role.test.ts`, beside the role corpus it already reads.
In the same change, **`harness/architecture.md:51` is re-pointed at that counterpart** (per Q-0106
§3.4(f), which held the sentence for this child rather than naming a file that did not exist) and
**`packages/shared/src/role.ts:26–31`'s JSDoc** stops citing `smoke.js` (AC-19). *Test:* changing one
role's `paths:` without the table fails, and changing the table without the role fails — both
directions, both demonstrated. `role.test.ts:57–61`'s *"nothing in the spike reads a role's `paths`"* is
dispositioned under AC-10 in the same change, being the other half of the same JSDoc claim.
*(adds: the `architecture.md` half, and `role.test.ts:57–61`.)*

**AC-19.** The production-source citations naming a moved, replaced or deleted subject are corrected,
and they are the **only** permitted production-source change: `packages/cli/src/ticket.ts:8` (cites the
fixture AC-8 moves), `packages/shared/src/role.ts:30` (cites `smoke.js`, which AC-18 replaces), and
`packages/shared/src/step-output.ts:12,14,16,19` (the block AC-13 pins). *Test:*
`git diff --name-only <base>...<tip> -- 'packages/*/src/**'` lists only `*.test.ts` paths and those
three files, plus `packages/shared/test/corpus.ts`. **A behavioural production change is a finding to
report at the gate, not to make** — it is the signal that something still depends on the spike, which
is this child's whole premise (R-5). *(supersedes: `:12,16,19` — §3.2(e).)*

**AC-29 (new) — the register's membership is derived, not listed.** AC-10's key set comes from a **scan
of the tree**, not from any enumeration in this document, Q-0103's, or a candidate's. Two kinds of entry
make it complete: a **verdict** for a site this child disposes of, and a registered **exclusion**
carrying its reason for a site the scan reaches that is not a dependency — prose in a test name, an
assertion message, or a JSDoc citation deferred to GO-6's sweep. *Test:* the shape
`spike-parity.test.ts` uses for `spike/test/` — keys from the tree, classification recomputed from each
file's own text, a new reference failing until classified — demonstrated by adding a spike reference to
a `packages/**` file and watching the register go red. **Authority, and it is measured rather than
asserted:** a tracked scan returns **139 files and 960 lines**; narrowed to a quoted `spike/` literal,
**86 files and 292 lines**; and the two documents that tried to count the helper calls disagree with
each other and with the tree in different directions (§3.2(i), §3.2(j)). Q-0103 §12 instructs the
register not to trust any count stated in prose, **including its own**, and this criterion is that
instruction made executable.

**AC-30 (new) — the standing guard, and the sibling the retirements name.** After this child, no file
under `packages/**` **reads** anything under `spike/`, and that is **asserted rather than reviewed**:
one guard, generalising `packages/cli/src/end-to-end.test.ts:517–531`, whose subject is **read
positions and not text occurrences** —

1. an import or export specifier naming a path under `spike/`;
2. a quoted `spike/…` path literal on a line that is not wholly a comment;
3. a bare `'spike'` / `"spike"` / `` `spike` `` segment handed to a path join;

with its own discrimination clauses proving each shape fires, and its own source assembled so it does
not trip itself. **A JSDoc citation is explicitly outside its subject**, named as such in the guard's
header with GO-6's sweep ticket cited, because 54 production files carry one and AC-19 forbids
touching 51 of them. Every excluded site is a **registered exclusion under AC-29 carrying its
reason** — the count is derived, not fixed; today's known members are
`packages/core/src/spike-parity.test.ts`, the retained `../../spike/test/**` input with its
`turbo-inputs.test.ts` rows, `test-command.test.ts`'s `CI_JOBS` spike row and `WITHOUT_SPIKE` fixture,
and whichever clauses AC-12 dispositions `kept`. *Test:* the guard is red before the change and green
after; deleting either discrimination clause fails a test; and adding an unregistered exclusion fails.
This is what makes Child C mechanical, and it is the single sibling AC-12's `retired` verdicts name.
*(supersedes the candidate's "exactly two exclusions" and its text-level subject, both unsatisfiable —
§3.2(h).)*

---

## 6. Gate obligations

**GO-1 — the decision entry is landed; cite it, do not re-litigate it.** *"A check outlives its subject
only if it can still fail"* (2026-09-05) is `docs/decisions/079-…`. **Its three classes do not map onto
AC-10's inherited four verdicts**, which is why AC-10 now has five (§3.2(b)). Read the entry rather
than this summary: it also rules transcription, and its last line — *"answerable by mutation rather
than by reading, which is the only way this repository has ever established that a check works"* — is
what AC-11 implements.

**GO-2 — the three ids exist.** Q-0106 (shipped, `main:contained`), Q-0107 (this), Q-0103 (the
deletion). Q-0107's folder is in `06-development-plan.md`, so `plan-backlog.test.ts` is green.

**GO-3 — this child's `integrate` is the proof of Q-0106's commands, and it is an exit condition
rather than a criterion.** Child A's own `integrate` ran the *old* commands, because `runFlow` takes
`config` as a parameter and never re-reads it, so nothing has yet executed
`pnpm install --frozen-lockfile` / `pnpm turbo run test --force --continue` inside a worktree.
**Q-0103 must not launch until this child's `integrate` is seen green.** A failure here is an
environment failure that stops the run after implement and review are paid for; no test catches it.
Per Q-0072's closing finding, the merge is additionally verified **forced on `main` in the populated
row** after `integrate`'s tick in the fresh one.

**GO-4 — `spike/` must be intact and tracked at the merge.** `developer-generalist` retains `spike` in
its `paths:` deliberately (Q-0106's central correction) so AC-8 can move a file *out* of `spike/test/`.
No other criterion writes there, and no criterion deletes anything under `spike/` except that one move.

**GO-5 — the errata window is a gate.** If a criterion here is proved wrong mid-loop, the erratum is
written at the exhaustion gate, not between a review returning and the next implement starting
(Q-0094 E-3, Q-0097's two lost errata). Both Q-0101 errata that worked were **verified present in the
next implement step's prompt** rather than assumed; do that.

**GO-6 — allocate the JSDoc sweep ticket's id at this ticket's close, not later.** §4 defers 51
production citations and AC-30's header must name the successor by id. Per Q-0101's GO-4 precedent, it
is allocated at the close **rather than remembered**, and its body is written out in full there rather
than referenced — an obligation recorded only in a closed ticket's entry is one that quietly expires.

**GO-7 — if the gate wants B smaller, the seam is AC-12 + AC-13 + AC-19**, the silent class and its
production citations, which is a coherent ticket alone. Splitting anywhere else separates a re-aim from
the register row that disposes of it.

---

## 7. Open questions

None blocks solutioning.

- **OQ-1 — ruled here, not left open.** *Where does the AC-10 disposition register live?* **In an
  executable `packages/**` test file, beside AC-30's guard — not in the implement report.** 079(c)
  makes a register's value the visibility of removing a row, and an implement-report register is
  round-scoped (Q-0086), read by nobody after the gate, and cannot make a missing verdict red. AC-11's
  red-before-green *evidence* stays in the report, which is the right home for a transcript.
  *(codex's OQ-1, answered.)*
- **OQ-2 — ruled here.** *Must the deliberately failing mutations be committed?* **No.** The report
  records the assertion, the mutation, the command and the failure message; the commit contains the
  green implementation. Committing a red test would make the suite's verdict a property of the branch
  rather than of the change. *(codex's OQ-3, answered.)*
- **OQ-3 — non-blocking, recommendation stated.** *Should `spike-parity.test.ts` move into this child,
  letting AC-17 remove all seven inputs here?* **No.** It is 1,957 lines whose subject is still alive
  during this child, and it is coupled outward — `test-discovery.test.ts` names it in a `test.each` and
  `packages/core/test/vitest-include.ts` cites it — so moving it enlarges this child for a cosmetic
  gain. AC-17's registered seventh input, with a comment naming its one reader, is the cheaper honest
  shape. *Owner: the gate.*
- **OQ-4 — non-blocking, cost measured either way.** AC-18 recommends `packages/shared/src/role.test.ts`
  for the role-table counterpart, which means a `packages/shared` test reading
  `harness/architecture.md`. That file is **not** currently a declared input of `@quorum/shared#test`
  (`harness/roles/*.md` is), so the counterpart costs one declared input and one register row wherever
  it lands. If the gate prefers `packages/core`, the cost is identical. *Owner: the implementer,
  recorded either way.*
- **OQ-5 — non-blocking, and the one to watch.** §3.3 says most retirements are cheap because the
  sibling is already green. If, for any site, **no sibling exists**, the honest verdicts are `re-aimed`
  (write it) or an explicit registered loss of coverage — never `retired` with a sibling that asserts
  something adjacent. R-1 is what this becomes if it is answered badly. *Owner: the register, at
  implement time.*
- **OQ-6 — inherited, not this ticket's.** Whether `developer-backend` and `developer-tooling` should
  merge now that AC-7 has landed. *Owner: the gate, at Q-0103.*

---

## 8. Risks

**R-1 — deleting coverage under cover of a re-aim.** The failure mode is a `retired` verdict whose
named sibling does not assert the same property. AC-11's extension to `retired` is the guard; a
reviewer should treat a `retired` verdict with no demonstrated sibling failure as a **blocker, not a
nit**.

**R-2 — this child makes Q-0102 look fixed.** AC-16 removes the `spike suite` phase from
`git-identity-sweep.sh`, roughly half of what the sweep runs. Q-0102's subject is a sweep that is red
under load. **A green sweep after this merge is not evidence that Q-0102 is closed**, and recording it
as such would be the fourth instance of a measurement copied into a durable record. Q-0102 stays open,
its failure rate is not re-measured here, and this paragraph exists so nobody claims otherwise at the
gate.

**R-3 — the silent class is what a review misses.** AC-12's eight guards are green before and after,
whatever the implementer does. There is no failing test to prompt anyone, which is why AC-11 specifies
the mutation and AC-29 derives the membership. **A review round that reports "no findings" on this
child's silent half has told you nothing.**

**R-4 — the input guard fires on this child's own edits, in both directions.** AC-17 removes six inputs
while §3.4's re-aims *add* at least two (`packages/core/src/contracts/run-manifest.ts` for
`docs.test.ts`, the three core adapters for `events.test.ts`). Q-0072's guard refuses an undeclared
read and `turbo-inputs.test.ts`'s register must move in the same change — four tickets have earned a
registration on the way in and each was surprised by it.

**R-5 — a hidden production dependency.** If satisfying any criterion appears to require a behavioural
`packages/**` source change beyond AC-19's three files, the cutover premise is false: **stop and report
at the gate** rather than making the change. That is the signal this child exists to produce.

**R-6 — AC-30 is the criterion most likely to be argued with, and §3.2(h) is why.** Its inherited
wording was unsatisfiable and an implementer may meet the old form in Q-0103's document. The restated
subject is *read positions*; the JSDoc citations are out of scope by name; the exclusion count is
derived. An implementer that finds even this form unsatisfiable should say so **at the gate with the
measurement**, not spend a round on prose (R-7).

**R-7 — a review loop cannot rule a criterion it disagrees with.** Q-0083 is unbuilt, so an implement
step that proves one of these criteria wrong has one channel: prose nobody reads until a gate. That
cost $14.28 on Q-0091 and $31.16 on Q-0101, both after their requirements had named the hazard. It is
named again here. Every departure in §3.2 is labelled precisely so that an implementer meeting the
inherited text does not have to argue with it.

**R-8 — the window in which `spike/` is present and unproven widens here.** From Child A's merge, the
run-start `commands.test` no longer runs the spike suite; AC-16 removes the sweep's spike phase as
well, leaving only CI's `spike` job. Stated rather than discovered; it ends at Child C.

**R-9 — concurrent runs collide while Q-0039 is open.** Q-0106, Q-0107 and Q-0103 run one at a time.

---

## 9. Cross-cutting checklist

| | |
| --- | --- |
| **BYOS** | n/a — no code path, test, fixture, message or example gains or loses a credential path. The BYOS refusal strings' spike twins are untouched and are deleted with the tree by Q-0103; Q-0068 stays open and becomes a one-tree ticket. |
| **Worktree safety** | n/a to the change, relevant to the route. This child runs `chore.yaml` and writes only in `.harness/worktrees/`. No criterion writes to the user's tree; no integration-branch or containment behaviour moves. |
| **Gate behaviour** | Unchanged. GO-3 is an exit condition discharged at a gate, not a new gate kind; GO-5 fixes the errata window at a gate. |
| **File format and schema** | One file moves without changing shape (AC-8). No zod schema changes. Three `turbo.json` input lists change; the task table, `env` and `outputs` do not. |
| **Lint rules** | Unchanged. `eslint.config.js`'s `'spike/**'` ignore is Child C's (AC-23); nothing here widens or narrows ESLint's scope. |
| **Cross-vendor rule** | Unchanged, and load-bearing: this child is where every judgement lives, so decision 035's manual route is **rejected** for it and the change is reviewed by a second vendor. No flow or adapter assignment moves. |
| **Product-agnostic** | No product-specific dependency, path or example is added. `packages/cli/templates/harness/` gains nothing of Quorum's own; AC-14 changes what checks it, not what ships in it. |
| **Cold-clone impact** | Neutral-to-positive, with one thing that must not regress: AC-14 removes the middle link of the chain proving an adopter's scaffolded flows are byte-identical to the shipped ones. The replacement link is direct and **must be mutation-tested in both directions**, or the first thing a stranger gets from `quorum init` is a copy nothing pins. No installation claim changes. |

---

## 10. What a reader should not re-derive from this document

Measured at `fc7df27` on 2026-09-05, from the tree — including from Q-0103's merged requirement, which
was written two commits and one shipped child ago, and including from either run-1 candidate. **Ten
statements in circulation are wrong and must not be carried forward:**

1. that all seven spike `turbo.json` inputs can be removed in this child — **six can**;
   `packages/core`'s `../../spike/test/**` has a reader until Q-0103;
2. that AC-10's four verdicts can record decision 079's classes — **079(b) maps to none of them**;
3. that the `*.source.test.ts` clauses are *"green forever, no subject"* — **they are still
   falsifiable**, which 079 says is the whole point of the question it asks;
4. that the silent guard class is six sites of one shape — **eight sites, three shapes**, and
   `contracts.source.test.ts:185`'s post-cutover verdict would depend on the machine;
5. that `step-output.ts`'s pinned block holds three spike citations at `:12,16,19` — **four**, at
   `:12,14,16,19`, in a file carrying twelve;
6. that `git-identity.test.ts` has two sites to change — **four**, counting `:249` and the floor's
   derivation comment at `:33`;
7. that `harness/architecture.md` is finished with Child A — **`:51` and `:78` are this child's**, by
   Q-0106's own ruling, which calls the second one `:94` because that was its number before Child A
   removed the freeze paragraph;
8. that a `packages/**` guard can forbid the word `spike` with two exclusions — **54 production files
   cite a `spike/` path in JSDoc**, AC-19 permits three to change, and the subject is read positions;
9. that a crude `packages/**` scan returns 46 files and 210 lines — **139 tracked files and 960 lines**;
   quoted `spike/` literals are 86 files and 292 lines;
10. that the corpus helpers are called 40 times, or 39 times in eight files — **39 calls in seven
    files**, the fortieth match being `turbo-inputs.test.ts:246`'s prose.

And one figure that is right and is stated with its derivation so a register transcribing it is visible
as a transcription: **39 calls, seven files, 31 + 7 + 1 by helper.** Q-0103's total was right only
because two errors cancelled; the run-1 candidate's differs by one file, for a reason it could name.
That is exactly as much confidence as either number deserves, and it is why **AC-29 must not use any of
them**.

---

## 11. Provenance

**The claude candidate is the base.** It is the only one that measured, and its seven corrections to
Q-0103's inherited text were each re-verified against the tree here and each holds exactly — the six
turbo inputs, the fifth verdict, the class-(b) reasoning, the eight guard sites, the fourth
`step-output.ts` citation, the four `git-identity.test.ts` sites, and the two `harness/architecture.md`
sentences. Three of those would have stopped an implement round. Its §3.3 finding — that most
retirements have a green sibling already in the same test body — is what makes AC-12 cheap rather than
frightening, and its §3.5 identification of `end-to-end.test.ts:517–531` as the precedent for AC-30 is
what keeps that criterion from being designed from scratch.

**The codex candidate is rejected as a base, on its central choice.** It incorporates AC-8 to AC-19
**by reference** to a document written at `83b193c`, on the reasoning that Q-0103 §12 forbids carrying
figures forward. That reads the rule backwards: §12 forbids repeating *unmeasured* figures, and the
remedy is to re-measure, not to hand the implementer a document that seven measurements now contradict.
Its own numbered restatements then reproduce four of the seven errors verbatim (six guards, three
citations, seven inputs, two `git-identity` sites), which is the same defect it was trying to avoid,
arriving through the mechanism chosen to avoid it.

**What codex contributed and is adopted.** Its OQ-1 is the best question either document asked —
*where does the AC-10 register live?* — and it is ruled in AC-10 rather than left open: executable, in
a `packages/**` test, on 079(c)'s authority. Its OQ-3 is ruled in OQ-2. Its risk that *"a failure caused
by syntax, missing dependencies, or an unrelated assertion does not establish the re-aimed check"* is
folded into AC-11 as an evidence bar, and it is a real strengthening. Four of its non-goals are adopted
verbatim — no archive of the spike, no new dependency, no `npx quorum` claim, the v1 exclusion list.
Its criteria 13, 14 and 15 (a green `integrate` on Q-0106's commands, `spike/` intact throughout, the
three suites green) are **not** acceptance criteria — they are run conditions, testable by nothing in
the change — and are folded into GO-3, GO-4 and the route's ordinary exit.

**What this merge adds beyond both.** Three corrections to the base candidate, all measured: AC-30's
subject and exclusion set (§3.2(h)), AC-29's authority figure (§3.2(i)), and the helper-call file count
(§3.2(j)). AC-30's inherited wording was **unsatisfiable** against a non-goal of its own document,
which is the class this ticket exists to catch, arriving inside the criterion written to catch it.
GO-6 is new: the deferred JSDoc sweep is allocated an id at this ticket's close rather than remembered,
because AC-30's header has to name it.

**Size.** Fourteen criteria against a ceiling of fifteen. Two were added rather than trimmed because
AC-10 and AC-12 are unfalsifiable without them — a register nobody can fail and a retirement with no
standing sibling are prose, and this ticket's entire subject is checks that report success over an
absent subject. GO-7 keeps the seam open.
