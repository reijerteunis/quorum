# Errata — Q-0091

Corrections and rulings against `requirements/merged.md`, dated, written during the loop as soon as
the contradiction is provable rather than at the exhaustion gate — *"An erratum is the last repair,
not the first"* (2026-08-30). An erratum states what was **run**, not what was reasoned: Q-0097's run
cost two of them by writing one from a claim.

**E-1 to E-4** were written by hand at the **requirements gate**, before the chore run. **E-5 and
E-6** were written at chore run 2's **exhaustion gate**, after three implement rounds had held the
same two refusals and three reviews had correctly declined to authorise them; they are late by the
2026-08-30 rule and E-7 records what that cost. Every entry here is work no step in the chore flow
may perform, which is why all seven are the human's.

## E-1 — the ticket is re-scoped to `lint` and `validate`; `board` and `adapters` are Q-0099 — 2026-09-03

**Ruled: §5's AC-1 to AC-13 are this ticket. Appendix A is `backlog/Q-0099-…/ticket.md` and is out
of scope here.** The merged requirement's first finding, adopted as written.

The seam is measured in the spike source rather than chosen for tidiness: `lint` (`harness.js:404`)
and `validate` (`:460`) end in `process.exit(ok ? 0 : 1)` and carry an exit-code contract a
`type: script` step depends on, while `board` (`:398`) and `adapters` (`:425`) end in `return;` and
can only exit 0. Twenty-one criteria against a ceiling of fifteen is the reason to cut; **where** to
cut is that sentence.

Thirteen criteria stay because the risky work is shared rather than command-shaped — the five landed
guards, the two barrel symbols, the register schema of E-2 — and it is reviewed on its own here
rather than underneath `board`'s ten containment scenarios. `validate` is what *forces* the barrel
change, `readData` being the one symbol no other command needs. Splitting into four was refused: a
guards-only ticket is a scan narrowed with no command in the tree, which is a guard with no subject.

## E-2 — ground rule 5 is unsatisfiable as written, and the register gains `binaryCarriedBy` — 2026-09-03

**Ruled: `Entry.binaryCarriedBy?: readonly string[]`, permitted on the verdicts `cli` and `split`
and validated exactly as `carriedBy` is — existence and collection failing separately. Not a fourth
verdict.** This binds Q-0092, Q-0093, Q-0094, Q-0095 and Q-0099 as well as this ticket, which is why
it is ruled once here rather than five times.

### The contradiction, verified structurally rather than argued

Ground rule 5 requires a child translating a binary half to record that in
`packages/core/src/spike-parity.test.ts`. For `q0036-board-containment.js` no edit can:

- `admissible()` (`:887`) gives a file that **reaches the binary and imports no spike source**
  exactly one legal verdict — `['cli']`; and
- `audit()` (`:945`) fails any entry whose verdict does not want counterparts but names some:
  `` `${name}: '${entry.verdict}' names counterparts it may not have` `` — pinned for this very file
  at `:1448`.

So the file is locked to `cli`, and `cli` may name no `carriedBy`. **The register would go on
reading "the work is still owed" after it had been done**, which is the failure it exists to prevent,
inverted.

### Why the field and not a fourth verdict

The `Verdict` union was designed by Q-0054 for a two-suite world — `spike/` against
`packages/core` — and a verdict describes the **spike file's own properties**, which `admissible()`
derives from that file's text. Translation into `packages/cli` does not change the spike file, so a
fourth value would require the derivation to learn about a second tree. A separate optional field
records a separate fact and leaves `admissible()` alone.

## E-3 — AC-13's skip-notice clause contradicts itself, and the shipped sentence wins — 2026-09-03

**Ruled: the notice is the sentence Q-0037 shipped, transcribed from
`packages/core/src/contracts/validate-artifact.test.ts`. The phrase "run-manifest semantic checks
were skipped" is *not* a literal the implementation must contain.**

AC-13 says the notice *"keeps the words **run-manifest semantic checks were skipped**"* **and** that
it *"is the sentence Q-0037 shipped"*. Those cannot both hold, and the ticket body carries the same
instruction. Settled mechanically rather than by eye — the shipped string is

> `no recognised x-quorum-contract annotation, so no semantic contract applies — no run-manifest`
> `semantic checks ran; they were skipped as inapplicable, and run-manifest-v1 is the only contract`
> `defined`

and `shipped.includes('run-manifest semantic checks were skipped')` is **false**. The words are
rearranged and one is negated: it reads *checks **ran**; they were skipped as inapplicable*.

**The phrase the body asks for is the wording Q-0037 deliberately replaced**, and
`spike/bin/harness.js:442–445` says why in its own comment: *"The old wording opened 'run-manifest
semantic checks skipped', which over an unrelated contract reads as a check that was owed and missed
— sending an author looking for an annotation their schema was never supposed to carry."* The
`recognised` half is Q-0037 review round 1's, because one outcome covers an absent annotation and a
present-but-unsupported one alike.

`contracts/Q-0011/runs-cli.contract.md:46–48` is a **requirement in prose** — *"print an explicit
notice that run-manifest semantic checks were skipped"* — describing what must be conveyed, not a
string to match. The frozen contract is satisfied by the shipped sentence, which is what the
comment records and what `validate-artifact.test.ts` transcribes verbatim at `:157` and `:189`.

**Why this is worth an erratum rather than a note.** An implementer following the prose literally
would write `expect(notice).toContain('run-manifest semantic checks were skipped')`, watch it fail,
and "fix" it by changing the message — reverting a deliberate repair, breaking two verbatim
transcriptions, and citing a frozen contract as authority while doing it. That is prose from a
document treated as a literal contract, which is a class this repository keeps paying for.

## E-4 — the inherited-coverage figures, and the grouping premise behind them — 2026-09-03

**Ruled: the body's coverage sentence is superseded by §M-2 of the merged requirement. Nothing in
scope changes; the correction exists so the figures stop travelling.**

The body says *"Inherits 698 lines of binary-half coverage — `q0033-surface.js` (446) and
`q0036-board-containment.js` (221)"*. Three figures, no two consistent: **446 + 221 = 667**, the
sentence says **698**, and the tree says **476 + 220 = 696**. Measured at `729dcb3`, the tip when the
ticket was created, and identical there — so these were wrong when written rather than stale. The
codex candidate found the internal inconsistency and the claude candidate the external one.

**And the premise is false in every direction**, which matters more than the arithmetic. *"Grouped
because their two test files cover them together"* does not survive measurement:

| command | where its binary coverage actually is |
| --- | --- |
| `board` | `q0036-board-containment.js`, 100% of it, plus one row at `q0033-surface.js:342` |
| `lint` | three sites in `q0033-surface.js` |
| `validate` | `q0011-runs-cli.js`, eight invocations — **Q-0092's file** |
| `adapters` | `smoke.js:126–132` — **Q-0095's file**; nothing in either named file |

The single occurrence of `adapters` in `q0033-surface.js` is `:249`, a flow-lint scenario about
review panels spanning two adapters, not the command. Sixteen of that file's twenty invocations are
`init`/`ticket` (Q-0093) and `run`/gates (Q-0094).

So this ticket translates a **command-scoped set of behaviours across five files and never a file**,
and an implementer reading *"inherits 698 lines"* and translating faithfully would take scope from
three siblings and re-classify a `split` file as done.

## E-5 — AC-4 governs `lint` alone; `validate` opens no project — 2026-09-03

**Ruled: AC-4's *"Both commands"* binds `lint`. `validate` opens no project, and the shipped code is
correct as it stands.** Written at the exhaustion gate of chore run 2, after three implement rounds
held the same refusal and three reviews correctly declined to authorise it themselves.

Measured, and by two rounds independently: `spike/bin/harness.js`'s `validate` case (`:426–461`)
contains **no `loadProject` or `findProject` call site**, while `lint` (`:401`) opens with
`const { harnessDir } = loadProject();`. Executed rather than read — `validate` run with `--project`
aimed at a directory holding no `harness/harness.yaml` validates normally and exits 0, and the
shipped binary reproduces that byte for byte.

So AC-4 was never true of `validate`, and requiring a project there would be a **behaviour change on
a machine-facing surface**, which ground rule 3 refuses. AC-4's headline, its sentence and its
no-stack-trace clause are unchanged for `lint`.

**If this had been ruled the other way**, `COMMAND_DOMAIN['validate.ts']` would have had to gain
`loadProject` or AC-10 would go red — which is the register doing its job, and worth recording
because it means the alternative could not have landed silently.

## E-6 — AC-2's aside describes the case block; its normative half stands and is satisfied — 2026-09-03

**Ruled: AC-2's headline — *no command re-parses the command line* — binds and is met. Its aside,
that `lint` "reads neither `rest` nor `flags`", is corrected.**

The distinction is the whole ruling, and the implement step found it before the gate did.
`spike/bin/harness.js:55` reads `flags.project` **inside** `loadProject`, which `lint` calls at
`:401` with no argument — so `harness lint --project <dir>` lints that project today. The aside is
true of the case block's *text* and false of the command's *behaviour*.

The port cannot preserve both. `core`'s `loadProject(dir?: string)` (`project.ts:78`) takes the
directory as a **parameter** where the spike's closes over a module-level `flags`, so a caller in
`packages/cli` must pass `flags.project` explicitly. The read moves from implicit to explicit **by
necessity**, and the shipped `lint` satisfies what AC-2 actually governs: it reads the value the
frame already parsed, calls no `parseArgv`, touches no `process.argv`, and defines no second flag
table. AC-2's own *Test:* clause is fully met.

Dropping `--project` to satisfy the aside as written would stop the flag deciding which project is
linted — a behaviour change on a port ticket, which ground rule 3 forbids.

## E-7 — what these two errata cost, recorded because the mechanism that would prevent it is named and unbuilt — 2026-09-03

**Not a ruling. A measurement, kept so the cost of Q-0083's absence is written down once with
numbers rather than described again.**

Implement rounds 2 and 3 cost **$7.129 and $7.154** and round 3 **changed no files at all** — its
tree byte-identical to round 2's commit `14a934e`. Both rounds were spent holding two refusals that
were correct on the first telling, because `chore.yaml`'s implement step declares no verdict and
`backlog/` is not an agent-writable surface: an implementer that has proved a criterion wrong has
exactly one channel, prose the human does not read until a gate.

That is the **eleventh** appearance in this repository of a loop handed work no step in it can
perform, and **Q-0083** — an implement step that can return `blocked` — is the named, unbuilt
mechanism that would have ended this run at round 2 for about $14 less.

Two things are worth recording as having gone *right*, because the same decision is usually cited
after it was ignored. Round 2 refused on ground rule 3 rather than yielding, and cited Q-0052's
round 3 — where a reviewer that had never been asked *which of two documents should move* was
yielded to, and the plan records the yield as the mistake. And rounds 2 and 3 spent themselves on
**measurement rather than re-argument**, which is what *"A refused finding is a gate, not another
round"* (2026-08-31) asks of a step that cannot clear its own blocker.
