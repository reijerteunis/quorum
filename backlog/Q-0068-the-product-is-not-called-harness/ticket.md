---
id: Q-0068
title: A healthy login reads unusable, and the refusal misnames the product
stage: draft
owner: ruud
repos: []
branch: harness/Q-0068/integration
priority: p2
created: 2026-08-27
iterations: {}
history: []
---
> **Corrected 2026-09-07, after the cutover.** `spike/` was deleted by Q-0103 on 2026-09-06, so
> every path, line number and landing rule below that names it is **void** — read *"After the
> cutover"* at the end of this body before acting on anything here. The defect itself is
> unchanged and was re-verified against the tree on 2026-09-07.
>
> **Q-0066 was absorbed into this ticket on 2026-09-07** and is `abandoned`; its body stays in
> place as the evidence. This ticket was *"The BYOS refusal calls the product 'Harness'"* and now
> carries both defects `quorum adapters` reports wrongly — see *"Absorbed: Q-0066"* at the end.
> **Priority moved p3 → p2** with it: a word is a p3, a healthy login reported unusable is not.

Reported by Q-0046's implement report and again by Q-0047's merged requirement (Q-4), both of which
correctly refused to fix it in passing. The two BYOS refusal messages call the product **"Harness"**,
which `.claude/rules/product-boundaries.md` forbids in as many words: *"'Harness' is the concept and
the folder (`harness/`); 'Quorum' is the product. Never call the product a harness, never call the
folder quorum."* `docs/GLOSSARY.md` says the same, and dates the rename to 2026-08-22.

**Every site, verified 2026-08-27.** The string is `… is set — unset it; Harness runs on subscription
OAuth only`.

| Site | What it is |
| --- | --- |
| `spike/src/adapters/claude.js:12` | the `ANTHROPIC_API_KEY` refusal |
| `spike/src/adapters/codex.js:21` | the `CODEX_API_KEY`/`OPENAI_API_KEY` refusal |
| `spike/test/smoke.js:464` | qa-red's frozen fixture, which pins the string |
| `packages/core/src/adapters/adapters.test.ts:314` | Q-0046's pin of the same string in `core` |
| *(Q-0047's ported `claude.ts` and `codex.ts`)* | byte-identical by AC-3, landing before this ticket |

One further occurrence is prose rather than product-facing text and is in scope only as a tidy-up:
`spike/test/q0011-run-history.js:78`, a comment reading *"the repository shape Harness itself uses"*.

**Why it was preserved rather than fixed.** The message text is what a command prints, which
`harness/port-charter.md` §2 lists as externally observable — so preserving it needed no authority
and changing it needs an erratum or a decision entry first. More sharply: fixing it in `packages/core`
alone would leave the spike saying one thing and `core` another until the cutover, which is exactly
the silent divergence the freeze exists to make visible. *"The port preserves behaviour"*
(`docs/DECISIONS.md`, 2026-08-25) is explicit that a child which spots a real defect leaves it and
says so, and both children did.

**Both trees, together, like Q-0066.** The fix lands in `spike/src/adapters/**` **and**
`packages/core/src/adapters/**` in one change, or the port loses its independent witness. Two pinned
tests go red on purpose and are updated rather than deleted — `spike/test/smoke.js:464` is qa-red's
frozen artifact, and `spike/src` is frozen for Q-0009's fifteen children, but Q-0068 is not among
them, so the spike route is open the same way it was for Q-0063, Q-0065 and Q-0066.

**The one thing to decide: what the sentence says instead.** Three candidates, none obviously right:

1. **"Quorum runs on subscription OAuth only"** — the literal rename, shortest diff.
2. **"Quorum runs on your own subscription only"** — closer to the glossary's BYOS wording
   (*"bring your own subscriptions"*), and says what the adopter has to do rather than naming a
   protocol they may not recognise.
3. **Name the remedy, not the product** — an adopter who hits this has a key in their environment
   because every other tool wants one; the useful half of the sentence is *unset it*, and Q-0047's
   `adopter` user story asks for exactly that: *"I want to be told that, in that sentence, whether or
   not the CLI is installed."*

This is a cold-clone-path message — it is one of the first things a stranger with an API key in their
shell will see — so it is worth spending a sentence on rather than sed-ing the word.

**Non-goals.** The refusal's *ordering* and its coverage, which are Q-0047's AC-3 (per Q-0046's
erratum E-1) and must stay green through this change; `authError`'s messages; any other product-name
audit across docs or prose, which is `/review-docs`' job, not a ticket's; and the `quorum` binary
itself (Q-0010). Belongs to M2 in `docs/06-development-plan.md`.

## After the cutover — corrected 2026-09-07

**Void: three rows of the site table and the whole of *Both trees, together, like Q-0066*.** The
spike rows and the frozen `smoke.js` fixture are gone with the tree, and there is no port to lose an
independent witness. The prose tidy-up at `spike/test/q0011-run-history.js:78` is void — nothing to
do.

**Every site, re-verified 2026-09-07.** The string is unchanged: `… is set — unset it; Harness runs
on subscription OAuth only`.

| Site | What it is |
| --- | --- |
| `packages/core/src/adapters/claude.ts:95` | the `ANTHROPIC_API_KEY` refusal |
| `packages/core/src/adapters/codex.ts:89` | the `CODEX_API_KEY`/`OPENAI_API_KEY` refusal |
| `packages/core/src/adapters/adapters.test.ts:314` | Q-0046's pin |
| `packages/core/src/adapters/claude.test.ts:62` | `REFUSAL`, asserted verbatim |
| `packages/core/src/adapters/codex.test.ts:87` | `REFUSAL`, asserted verbatim |
| `packages/cli/src/end-to-end.test.ts:723` | the mock end-to-end asserting the rendered `✗` line |

**So four pins go red on purpose, not two**, and one of them is in `packages/cli`, which held a
single line of source when this body was written. That last one is what matters most to the
decision: it asserts the whole terminal line a stranger sees, so whatever sentence is chosen has to
read well with the `✗ <vendor>: ` prefix in front of it.

**These two lines are now the only place in shipped source that calls the product "Harness".**
Verified by searching `packages/*/src` for the word outside tests and comments: two hits, both above.

**Q-0100 shipped the sibling class on 2026-09-06 and deliberately left this one alone.** It moved
eight user-facing sites from `harness <cmd>` to `quorum <cmd>` across six files, and its body sets
this ticket aside by name — *"Distinct from Q-0068, whose subject is the BYOS refusal string … in
the adapter files, for a different reason and on a different surface."* That is an argument for
taking the decision now rather than later: the rename it belongs beside has already landed, this is
the last inconsistency of its kind on the cold-clone path, and there is no longer a second tree to
keep in step.

**Void: the non-goal naming the binary (Q-0010)**, which closed. Q-0047's AC-3 ordering and coverage
non-goal stands and must stay green.

## Absorbed 2026-09-07: Q-0066, the other thing `quorum adapters` gets wrong

**The two merged on one surface rather than on one defect, and the difference is worth stating.**
Q-0074 and Q-0109 merged because they were literally one function declared twice. These two are not
that: Q-0066 is a **crash misattributed** — `probeAdapter` dereferences a null `usage` and blames the
login for its own `TypeError` — and this ticket is a **word**, the product called "Harness" in the
refusal. What they share is the surface, and the shipped source already says so.

**`packages/cli/src/adapters.ts`'s module header names both tickets in one docblock**, as the things
this one command must report and must not repair: `:13–16` for the refusal sentence, *"which is
Q-0068's and is preserved verbatim (Q-0099 AC-8(a))"*, and `:24–27` for Q-0066's null dereference,
under a heading reading *"Two preserved defects reach this command and neither is repaired here"*.
One file, one header, both subjects.

**The combined surface is eleven files, and they are the same eleven.**

| | Q-0066 | this ticket |
| --- | --- | --- |
| `core/src/adapters/adapters.ts` | the defect, `:488` | — |
| `core/src/adapters/claude.ts`, `codex.ts` | — | the two strings, `:95` and `:89` |
| `core/src/adapters/probe.test.ts` | the pin, `:145–156` | — |
| `core/src/adapters/adapters.test.ts`, `claude.test.ts`, `codex.test.ts` | names it at `claude.test.ts:381` | three pins, `:314`, `:62`, `:87` |
| `cli/src/adapters.ts` | preserved defect 2, `:24–27` | the refusal note, `:13–16` |
| `cli/src/adapters.test.ts` | the pin, `:315–320` | the pin, `:286` |
| `cli/src/end-to-end.test.ts`, `commands.ts`, `commands.test.ts` | — | `:723`, `:54`, `:44` |

**So one requirements gate rules both, and neither owes a `docs/decisions/` entry.** That is the
actual argument for merging, and it is the one that matters in this repository: the code is a guard
and a sentence, while the *process* — two requirements runs, two chore runs, two cross-vendor
reviews over the same eleven files — is what costs. Measured against this cut's own history, a
second ticket here is roughly $50–70 of gate for about ten lines of code. Both questions are
answerable by one person at one gate: *what does `tokens` mean when nothing was measured*, and *what
does the sentence say instead*.

**Sizing: about eleven criteria, under the ceiling.** Q-0066 needs roughly six — the guard, the
nullable `tokens`, its two pins, the CLI rendering, and the choice among its three shapes — and this
ticket about five. That is comfortably inside the fifteen that forced splits at Q-0091 and Q-0096,
which is the other half of why the merge is safe. **If it splits anyway, the seam is the two
questions**, not the two packages: every file above is touched by both halves.

**Two corrections to Q-0066's body, found while merging.**

1. **The defect site carries no authority line.** Its body says the behaviour is *"pinned in both
   trees — … `packages/core/src/adapters/adapters.ts:483`, the latter carrying its `Why:` line and a
   test."* Measured: `packages/core/src/adapters/adapters.ts` contains **no occurrence of Q-0066 at
   all**, and the line is `:488`. Every authority for the preserved defect lives *downstream* — in
   `packages/cli`'s `adapters.ts:24–27` and `adapters.test.ts:319`, plus a passing mention in
   `core`'s `claude.test.ts:381`. So `core` alone shows three bare `res.usage!` non-null assertions
   with nothing saying they are deliberate, which is `.claude/rules/engineering.md`'s *"one line
   naming the authority"* unmet at the one site that most needs it. **Adding that line is part of the
   repair even under the shape that changes no behaviour.**
2. **It reaches `packages/cli`, which its body does not mention.** Q-0099's **AC-8(d)** pins the
   rendered consequence — *"Q-0066's crash renders as an unusable login rather than being caught in
   passing"* (`cli/src/adapters.test.ts:315`) — so the fix moves a CLI test as well as a `core` one,
   and the ticket is not the single-file change its body implies.

**Three source comments carry a landing rule that is now false, and they move with the fix rather
than before it.** `cli/src/adapters.ts:26` and `cli/src/adapters.test.ts:319` both read *"which lands
in both trees together — a fix here would leave the spike disagreeing with `core` until the
cutover"*, and `core/src/adapters/claude.test.ts:380` reads *"Fixing it belongs in both trees at
once, like Q-0066 and Q-0068"*. All three name a tree deleted on 2026-09-06.

They are deliberately **not** corrected by this triage. Q-0103's AC-19 made its production-source
citation list exhaustive and ruled that *"citations that merely name a deleted path without claiming
it is read and without a test pinning them"* are a non-goal — but these three do more than name a
path: they state how a future fix must land, and following them is now impossible. They are this
ticket's to correct, in the change that makes them true, and a criterion should say so.

**A third defect sits on this same command and has no ticket at all.** `cli/src/adapters.ts:20–23`,
item 1 under the `:18` heading quoted above, records that `quorum adapters` **exits 0 when both CLIs
are absent**, so an adopter's CI step reports
success on a machine with no vendor CLI installed — preserved under Q-0099 AC-8(c), with its
successor named as *"Q-0090's GA-4"*. GA-4 says *"open the successor"*; searched on 2026-09-07, it
appears only inside Q-0090's own `requirements/merged.md`, and **no such ticket exists**. Q-0090
closed on 2026-09-02. That is the second obligation found this week living only inside a closed
ticket, after Q-0100's, and it is explicitly **out of scope here** — named so it stops being
invisible, not folded in.

## Re-measured 2026-09-10, before the run — four corrections, one of which raises the stakes

Q-0067 and Q-0110 both landed on these files on 2026-09-08, after the merge triage above was
written. Re-measured against the tree today.

**1. The defect ESCALATED, and this is the important one.** Q-0110 made `--probe` a check rather
than a report: `packages/cli/src/adapters.ts:169` now reads
`if (probe && report.some((entry) => entry.login !== 'verified')) failSoftly();`, so an unusable
login **exits 1**. Q-0066's crash renders as `login not usable`, so a login that is perfect and
merely reports no measure no longer just prints a wrong sentence — **it fails the command**, and an
adopter's CI step that runs `quorum adapters --probe` goes red on a working installation. The merge
triage priced this as "a guard and a sentence" when the guard only mis-reported. It now breaks a
build.

**2. Correction 1 of *"Two corrections to Q-0066's body"* above is itself wrong, and the way it is
wrong is this repository's own subject.** It claims `core` shows *"three bare `res.usage!` non-null
assertions with nothing saying they are deliberate"*. Measured: `probeAdapter`'s docblock
(`packages/core/src/adapters/adapters.ts:531–536`) carries five lines of authority describing the
defect exactly — *"`usage` is `null` whenever no attempt reported a measure, and the three reads
below are unguarded, so an adapter whose login is perfect and which reports nothing answers
`ok: false` with a `TypeError`"*. It landed **2026-08-26** in commit `a4e880b` with Q-0046's port,
so it was present when that correction was written. The correction was reached by grepping for
`Q-0066`, finding nothing, and reading absence into it — while the authority line was there under a
different citation, `Q-0046 AC-11 defect 1`. **That is Q-0074's class committed in the triage: a
failed probe read as a proven negative.** No authority line is owed; `engineering.md` is satisfied.
What may still be worth doing is citing this ticket beside Q-0046 so a future reader lands here, and
that is a nicety rather than a repair.

**3. The "third defect" paragraph is VOID — Q-0110 ruled it on 2026-09-08.** `quorum adapters`
exiting 0 with both CLIs absent was **ratified as correct**, not repaired: the bare listing is a
*report* whose own last line disclaims being the gate, while `--probe` is the *check*. So the
orphaned "Q-0090's GA-4" obligation named there is discharged, and `packages/cli/src/adapters.ts:30`
now reads *"**One** preserved defect reaches this command"* where the triage quotes it as two.
Nothing here is out of scope any more because nothing here is open.

**4. Every line number in the tables above has moved**, Q-0067 having added `cliVersion` to both
files. Current: the probe defect is `adapters.ts:546` (was 488); the mock end-to-end pin is
`cli/src/end-to-end.test.ts:775` (was 723); the CLI pin is `cli/src/adapters.test.ts:331–335` (was
315–320); the module header's two notes are `cli/src/adapters.ts:15` and `:30–35` (was 13–16 and
24–27). The six BYOS string sites are otherwise exactly as listed — `claude.ts:95` and `codex.ts:89`
are unchanged.

**Still true and re-verified:** the two production strings are the only place in shipped source that
calls the product "Harness"; four pins go red on purpose; and the three landing-rule comments naming
a deleted tree are `cli/src/adapters.ts:34`, `cli/src/adapters.test.ts:335` and
`core/src/adapters/claude.test.ts:380`. The other three "both trees" comments in `packages/` belong
to Q-0070 and to ground rule 3 and are **not** this ticket's.
