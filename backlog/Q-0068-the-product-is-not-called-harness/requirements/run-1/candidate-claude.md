# Q-0068 — A healthy login reads unusable, and the refusal misnames the product

*Requirements, run 1, candidate: claude. Written against the tree on 2026-09-10, not transcribed
from the ticket body. Four of the body's own measurements are corrected below; two sites it does not
list are added.*

---

## 0. What re-measuring found

The ticket body was re-measured on 2026-09-10 before this run and is largely right. Four things in
it are wrong or incomplete, and one of them changes the shape of the work.

**0.1 — "Four pins go red on purpose" is three.** Measured by reading each:

| Site | What it actually is | Verdict on the change |
| --- | --- | --- |
| `core/src/adapters/claude.test.ts:62` | `const REFUSAL = '…'`, asserted | **red** |
| `core/src/adapters/codex.test.ts:87` | `const REFUSAL = '…'`, asserted | **red** |
| `cli/src/end-to-end.test.ts:775` | the rendered `✗ <vendor>: …` line | **red** |
| `core/src/adapters/adapters.test.ts:314` | a fixture in `transientError`'s *not worth retrying* table | **stays green** |

The fourth is not a pin. It is one row of a `test.each` list feeding `transientError`, and the new
sentence classifies as `null` exactly as the old one does — so it passes unchanged while the comment
three lines above it (`:310–312`) goes on claiming the fixture is *"the message
`spike/src/adapters/claude.js:12` throws today, quoted verbatim so the classification is asserted
over the real text"*. After this change that sentence is false in two ways at once: it names a
deleted tree, and the text is no longer the real one. **A green test whose stated subject has moved
is this repository's most-recorded defect class**, so it is AC-4 rather than a tidy-up.

**0.2 — `docs/USAGE.md` is a seventh site, and nothing checks it.** The user guide added on
2026-09-10 documents this exact refusal at `:59`:

```
✗ claude: ANTHROPIC_API_KEY is set — unset it; …runs on subscription OAuth only
```

The product name is **elided** — `…runs on` — which means whoever wrote the guide read the shipped
string, saw that it calls the product "Harness", and wrote around it rather than quoting it or
fixing it. That is the defect shaping the documentation. The remaining fragment still pins the tail,
so it goes false the moment the tail changes, and `grep`ping the test corpus for `USAGE.md` returns
**nothing**: no assertion anywhere compares that block to the shipped literal. A transcription of
code that drifts silently is what Q-0088 §5 ruled must be replaced by a check rather than by a
correction.

**0.3 — The landing-rule comments are five, not three.** The body lists `cli/src/adapters.ts:34`,
`cli/src/adapters.test.ts:335` and `core/src/adapters/claude.test.ts:380`. Two more say the same
thing in files the body never names:

- `core/src/adapters/adapters.ts:535` — *"The spike has this; a quiet fix here would leave both
  suites green over a product that disagrees with itself."* Present tense, in **production source**,
  inside the `Why:` block that is the authority for the defect this ticket repairs.
- `core/src/adapters/probe.test.ts:149` — *"Preserved on purpose: the spike still does it."*

And `claude.test.ts:380` needs stating precisely, because it is the one an implementer will get
wrong: it belongs to a **third, unrelated** preserved defect (a non-string message crashing
`extractJson`) and only cites Q-0066 and Q-0068 as an analogy — *"Fixing it belongs in both trees at
once, like Q-0066 and Q-0068"*. Its own subject stays preserved. What must move is the analogy, which
after this change points at two closed tickets that did not land in both trees because there is only
one.

**0.4 — Correction 2 of the body's own re-measurement is confirmed, and is the model for this
section.** `probeAdapter`'s docblock does carry five lines of authority under `Q-0046 AC-11
defect 1`. No authority line is owed. The body reached the opposite conclusion by grepping for
`Q-0066`, finding nothing and reading absence into it — which is Q-0074's class, *a failed probe read
as a proven negative*, committed inside the triage. It caught itself. This section exists so the same
thing is not done a third time.

---

## 1. Problem

**`quorum adapters` is the first command an adopter runs, and it is wrong about two different
things.**

*The word.* Both BYOS refusals call the product **"Harness"**:

- `packages/core/src/adapters/claude.ts:95` — `ANTHROPIC_API_KEY is set — unset it; Harness runs on subscription OAuth only`
- `packages/core/src/adapters/codex.ts:89` — `CODEX_API_KEY/OPENAI_API_KEY is set — unset it; Harness runs on subscription OAuth only`

`.claude/rules/product-boundaries.md` forbids it in as many words, and `docs/GLOSSARY.md` dates the
rename to 2026-08-22. Verified 2026-09-10: **these two lines are the only place in shipped source
that calls the product a harness.** Every other instance was moved by Q-0100 on 2026-09-06, which
set this ticket aside by name.

**The guard that should have caught them already exists, and this is the finding that matters.**
Q-0100 shipped `packages/cli/src/binary-name.test.ts`, which lexes every production module in
`packages/cli`, collects every printable string literal, strips folder spellings, and fails on any
that still contains the word. It deliberately reaches into `core` — but through a **one-element,
hand-written register**:

```ts
const CORE_SUBJECTS = ['packages/core/src/backlog/project.ts'] as const;
```

whose header (`:47–49`) states the reason:

> *"`project.ts`, whose `ProjectNotFoundError` is **the only sentence in `packages/core` that a user
> reads** and that carries the word (Q-0100 OQ-2). Widening to all of `core` would add every engine
> literal for no measured subject. If a second `core` sentence appears, `CORE_SUBJECTS` is where it
> is added."*

**That claim was false when it was written.** The two refusals are sentences in `packages/core` that
a user reads — they reach the terminal verbatim through `packages/cli/src/adapters.ts`, which
renders `e.message` unaltered and says so. So the scan is green over a tree carrying its own
subject, and the register that was supposed to be the escape hatch is the thing that failed open.
This is the `q0050.source.test.ts` shape (Q-0051) and the `MANIFEST` shape (Q-0108) in the guard
written to close exactly this class. **Changing the two strings without changing the register leaves
the next such sentence unguarded, and leaves a guard reporting completeness it does not have.**

*The crash.* `probeAdapter` (`packages/core/src/adapters/adapters.ts:546`) dereferences a null
`usage` three times on its success path:

```ts
return { ok: true, …, cost_usd: res.usage!.cost_usd ?? null,
         tokens: (res.usage!.input_tokens ?? 0) + (res.usage!.output_tokens ?? 0), … };
```

`withRetry` answers `usage: null` whenever no attempt reported a measure — correct, deliberate, and
pinned by Q-0034. The two behaviours are each right and compose into a `TypeError` that
`probeAdapter`'s own `catch` converts into `ok: false`, so **an adapter whose login is perfect and
which reports nothing is reported as an unusable login**: `✗ login not usable: Cannot read
properties of null (reading 'cost_usd')`.

**Q-0110 escalated this on 2026-09-08 and the ticket's merge triage priced it before that.**
`packages/cli/src/adapters.ts:169` now reads:

```ts
if (probe && report.some((entry) => entry.login !== 'verified')) failSoftly();
```

so `--probe` is a check rather than a report, and an unusable login is **ERROR, exit 1**. The one
command an adopter is told to run to de-risk a paid run now **fails the build** on a working
installation. This was a wrong sentence when Q-0066 was opened; it is a red CI step now.

Both defects reach the same command, over the same eleven files, and neither owes a decision entry.
That is why they are one ticket.

## 2. User stories

**`adopter` — cold-clone.** *I have Claude and Codex subscriptions and an `ANTHROPIC_API_KEY` in my
shell, because every other tool wants one. The first command the README tells me to run refuses, and
I want that refusal to name the product I just installed, tell me what to do, and say why in words I
already know — not name a protocol and a product that does not exist.*

**`adopter` — CI.** *I put `quorum adapters --probe` in my pipeline because its own help says it is
the thing to run before a real run. It must not report ERROR for a login that answered.*

**`maintainer`.** *I run `--probe` before spending money on a flow. A vendor that answers without
reporting a measure is normal — codex reports tokens and no price. I need "verified, and it told me
nothing about cost" to be distinguishable from "your login is dead", because those are opposite
instructions.*

**`contributor`.** *I am writing a third adapter against `docs/03-adapter-contract.md`. If my adapter
returns no usage, the probe must not blame my login for the contract layer's own crash, and
`ProbeResult` must say what `tokens` means when nothing was measured.*

## 3. Surfaces

`packages/core/src/adapters/**` (the two refusals, `probeAdapter`, `ProbeResult`) ·
`packages/cli/src/**` (rendering, the exit status, the `binary-name` guard, the end-to-end pin) ·
`docs/USAGE.md`. **Not** `harness/`, **not** `backlog/`, **not** `docs/decisions/`.

## 4. The sentence

The ticket offers three candidates and rules none. A requirement that leaves the central case
uncovered is precisely one `developer-generalist` must stop on (Q-0105 B-2), so **this document
chooses, states the bytes, and records the alternatives** — and OQ-1 leaves the gate free to
substitute, because every criterion below is written so that only the constant moves.

**Recommended, both vendors sharing one tail:**

```
ANTHROPIC_API_KEY is set — unset it; Quorum runs on your CLI subscription, never on an API key
CODEX_API_KEY/OPENAI_API_KEY is set — unset it; Quorum runs on your CLI subscription, never on an API key
```

Rendered, which is the form that has to read well:

```
✗ claude: ANTHROPIC_API_KEY is set — unset it; Quorum runs on your CLI subscription, never on an API key
```

Four reasons, each measured rather than preferred:

1. **It keeps the structure.** `<VAR> is set — unset it; <clause>` is unchanged, so the remedy stays
   first and the diff is one clause per file.
2. **It drops "OAuth".** The ticket's own candidate 2 argues the adopter may not recognise the
   protocol, and `docs/GLOSSARY.md`'s BYOS entry describes the model without it: *"every agent runs
   on the OAuth login of the CLI the user already pays for"* is the internal definition; *your CLI
   subscription* is the adopter's half of it.
3. **A shared tail keeps one line changed in `end-to-end.test.ts`.** That test derives the variable
   names from source (`refusedBy`, `:269`) and hard-codes the tail. A vendor-specific tail would
   force it to grow a second derivation for no gain.
4. **It survives the classifier**, which is not automatic — see AC-4.

**Rejected, with reasons.** *"Quorum runs on subscription OAuth only"* (candidate 1) is the
one-word rename and keeps the jargon the ticket itself flags. *"Quorum runs on your own subscription
only"* (candidate 2) drops the fact that an API key is what is being refused, which is the half the
adopter needs to connect the sentence to their shell.

**On the word "API key".** `harness/product-context.md`'s forbidden-synonym list says the word for
the auth model is **subscription**. That rule is about not using "API key" as a *synonym* for what
Quorum runs on; using it to name the thing being refused is what `docs/GLOSSARY.md` itself does —
*"Quorum never stores or uses API keys"* — and the variable in the same sentence is literally called
`ANTHROPIC_API_KEY`. AC-1 records this reading so a reviewer does not raise it as a violation.

## 5. Acceptance criteria

### Half A — the sentence

**AC-1 — Both production refusals name the product, and the bytes are the criterion.**
`packages/core/src/adapters/claude.ts` and `codex.ts` throw exactly the two strings in §4.
*Test:* the existing `REFUSAL` constants in `claude.test.ts` and `codex.test.ts` assert the thrown
message verbatim; both are updated to the new text and neither is deleted.

**AC-2 — Ordering and coverage are untouched.** The BYOS guard still runs **before** the CLI probe,
so a missing binary cannot mask a key; `claude` guards exactly one variable and `codex` exactly two.
*Test:* `end-to-end.test.ts:769–771` already derives both counts from source and asserts them, and
`adapters.test.ts`'s AC-3 block stays green with no edit. Q-0047's AC-3 non-goal is held by these
assertions passing unchanged, not by inspection.

**AC-3 — The three pins go red before they go green.** Reverting either production string, one at a
time, turns exactly its own pin red plus `end-to-end.test.ts:775`, with a message naming the vendor.
*Test:* demonstrated by mutation and recorded in the implement report; not asserted from a green run.

**AC-4 — The new sentence is still classified as neither auth nor transient, and the fixture that
proves it quotes the real text again.** `AUTH_PATTERNS` (`adapters.ts:469–473`) contains
`/invalid api key/i`, and `TRANSIENT` is tried only when `authError` returns null — so a candidate
sentence is **not** automatically inert. `transientError(<new refusal>)` must return `null`.
*Test:* `adapters.test.ts:310–320`'s *not worth retrying* row is replaced with the new text, and the
comment above it is rewritten to say what it now quotes and from where. A `describe` clause asserts
the fixture is **byte-identical to the literal `claude.ts` throws**, read from source rather than
retyped, so the row cannot drift from its subject again. This is the §0.1 finding: without it the
table stays green while its stated subject has moved.

**AC-5 — `CORE_SUBJECTS` gains the two adapter files and its header stops claiming completeness it
does not have.** `packages/cli/src/binary-name.test.ts` scans `packages/core/src/adapters/claude.ts`
and `codex.ts` as subjects; the header sentence at `:47–49` is corrected to name three `core` files
and to record that its predecessor was false rather than merely superseded.
*Test:* three clauses, each shown red on its own — (a) reverting either production string fails the
AC-4 scan naming that file, which is the guard finally having its subject; (b) removing either entry
from `CORE_SUBJECTS` fails the existence assertion at `:485–487`; (c) the anti-vacuity clause at
`:456–466` gains an anchor in one of the two new files, so a scanner that collected nothing there
cannot report success.
*Measured, so the implementer does not go looking:* neither file carries any other printable literal
containing the word. `claude.ts`'s only mention is a JSDoc (`:81`), which the scanner skips by
design; `codex.ts` has that plus `'harness-codex-'` (`:95`), which has no whitespace and so is not
`printable()`. **No exemption register is needed** — which is the property that made the widening
cheap and is the reason it was worth measuring before proposing it.

**AC-6 — `docs/USAGE.md` stops quoting a sentence the product does not print, and a check says so.**
`:59`'s block matches the shipped refusal, and `packages/shared/src/docs.test.ts` asserts that the
fragment following the elision is a **suffix of the literal `claude.ts` throws**, read from source.
*Test:* editing either side alone turns it red. **Expect a `turbo-inputs.test.ts` MANIFEST row for
`@quorum/shared#test` naming `docs/USAGE.md`, and a matching input in `packages/shared/turbo.json`** —
Q-0072's guard working as designed, and the same registration Q-0108 earned for `CLAUDE.md`.

### Half B — the probe

**AC-7 — A login that answers and reports nothing is verified.** `probeAdapter` performs no unguarded
read of `res.usage`. An adapter returning a schema-conforming answer with `usage: null` answers
`ok: true`.
*Test:* `probe.test.ts`'s AC-11 block is **inverted rather than deleted** (Q-0037's precedent):
the same fixture now asserts `ok: true`, so a returning `res.usage!` fails a check instead of passing
an absent one.

**AC-8 — `tokens` is `number | null`, and `null` means the vendor reported nothing.** Where `usage`
is present the arithmetic is **unchanged**, including counting an individually unreported measure as
zero; where `usage` is absent entirely, `cost_usd` and `tokens` are both `null`. `ProbeResult`'s
JSDoc (`adapters.ts:233–236`) states both halves.
*Why this and not `tokens: 0`:* the field one line above already says *"`null` where the vendor
reports no price; never rounded to zero"*, and `AdapterUsage`'s own docblock says *"`null` means the
vendor did not report that measure, which is not zero"* (*"Codex cost is reported as tokens, never
priced locally"*, 2026-08-22). Answering `0` for *nothing was measured* would make the two fields of
one object disagree about the same question — and it is the collapse Q-0037's OQ-2 ruled against for
run history in exactly these words.

**AC-9 — The terminal line omits what was not reported, and `--json` says `null`.** A verified silent
adapter renders `  ✓ login verified — round-trip <n>ms` with no cost clause and no tokens clause;
`--json` carries `"cost_usd": null, "tokens": null`.
*Why omission rather than `n/a`:* measured, not chosen — `cost_usd` is already `null` on every real
codex probe and `adapters.ts:151` already omits it, so omission is this line's shipped convention.
`n/a` is run history's convention, for a different reader.
*Test:* `cli/src/adapters.test.ts`'s existing `--json` key register
(`['login','ok','vendor','ms','cost_usd','tokens','session']`) is asserted unchanged, so the shape a
consumer parses does not move.

**AC-10 — `--probe` exits 0 for that adapter.** This is the criterion the escalation created and the
one an adopter's pipeline reads.
*Test:* through the **built binary**, not in process — `cli/src/adapters.test.ts`'s `invoke()`
composes `exitCode` from a spied `process.exit` (Q-0101's finding), so an in-process assertion does
not prove what an operating system reported. `build.test.ts` already owns `runBuild()` and
`binTarget()` and Q-0098 AC-15(c) rules that it may spawn the emit.

**AC-11 — The CLI-side pin is inverted too.** `cli/src/adapters.test.ts`'s AC-8(d) test currently
asserts that Q-0066's crash *renders as an unusable login*. It now asserts the repaired behaviour and
keeps its name, so the register of what this command reports stays complete.
*Test:* restoring `res.usage!` in `core` turns this red as well as `probe.test.ts`, which is what
proves the CLI is still a faithful renderer rather than compensating.

**AC-12 — The sandbox is still removed on the no-usage path.** `probe.test.ts`'s second AC-11 test —
the one asserting the temp directory is cleaned up when the probe crashes that way — is kept and
re-aimed at the success path. A repair that leaked a directory would otherwise be invisible.

### Half C — the record

**AC-13 — Every comment stating how this fix must land is corrected.** Five sites, enumerated because
two are not in the ticket body: `cli/src/adapters.ts:34`, `cli/src/adapters.test.ts:335`,
`core/src/adapters/adapters.ts:535`, `core/src/adapters/probe.test.ts:149`, and
`core/src/adapters/claude.test.ts:380`.
The fifth is **not** about this ticket's defect: it belongs to the unrelated non-string-message
crash and only cites Q-0066 and Q-0068 as an analogy for the both-trees rule. Its own subject stays
preserved and its assertion is not touched; what moves is the analogy, which now points at two closed
tickets that did not land in both trees because there is no second tree.
*Test:* `grep -rn "both trees\|the spike has this\|the spike still does it" packages/*/src/adapters/ packages/cli/src/adapters*` returns nothing attributable to Q-0066 or Q-0068. Q-0103's AC-19 is respected:
past-tense provenance citations elsewhere are untouched, and the three "both trees" comments belonging
to Q-0070 and to ground rule 3 are out of scope.

**AC-14 — The preserved-defect inventories go to zero and the authority line is removed.**
`cli/src/adapters.ts:30`'s *"One preserved defect reaches this command and is not repaired here"*
heading and its item are removed, since none does. `probeAdapter`'s `Why:` block
(`adapters.ts:531–536`) loses its preserved-defect paragraph: `engineering.md` asks for one line
naming the authority **where behaviour is deliberately counterintuitive**, and after AC-7 none is.
What replaces it is a one-line contract note on the `usage`-absent case, not a transcription of this
ticket — the rule Q-0067 and Q-0111 were each caught breaking within two days of each other.

## 6. Non-goals

1. **The refusal's ordering and coverage** (Q-0047 AC-3, per Q-0046 erratum E-1). Held green by AC-2,
   never re-specified.
2. **`authError`'s and `transientError`'s messages and pattern lists.** AC-4 asserts the new sentence
   passes through them unchanged; it does not touch them.
3. **`quorum adapters` exiting 0 with both CLIs absent.** The ticket body's *"third defect"* paragraph
   is **void**: Q-0110 ratified that zero on 2026-09-08 — the bare listing is a report whose own last
   line disclaims being the gate, `--probe` is the check. The orphaned *"Q-0090's GA-4"* obligation it
   names is discharged. Confirmed against `cli/src/adapters.ts:30` and the AC-8(c) test.
4. **Widening `binary-name.test.ts` to all of `packages/core`.** AC-5 adds two measured subjects to a
   register the guard already has. Replacing that register with a derivation over `core` is a
   different question with a different cost, and the guard's header already argues it down.
5. **A product-name audit across `docs/` and prose.** `/review-docs`' job. AC-6 covers one documented
   quotation of a shipped string, which is a code-drift check rather than a prose audit.
6. **Anything under `backlog/` or `harness/`.** An agent's edits there are discarded.
7. **`docs/03-adapter-contract.md`'s verified-version table**, which Q-0067 owns.
8. **The non-string-message crash** at `claude.test.ts:374–383`. AC-13 touches its comment's analogy
   and nothing else; the defect stays preserved and unticketed here.

## 7. Open questions

**OQ-1 — the sentence (gate, non-blocking).** §4 recommends
`Quorum runs on your CLI subscription, never on an API key` with its reasoning. The gate may
substitute any sentence that (a) does not call the product a harness, (b) keeps the `unset it`
remedy, (c) reads correctly behind `✗ <vendor>: `, and (d) satisfies AC-4. Every criterion is written
against *the constant*, so a substitution at the gate costs one edit and no re-specification.

**OQ-2 — does `tokens: number | null` owe a decision entry? (gate, BLOCKING — see §9 GO-1.)**
Recommendation: **no.** It applies a rule the same object already states for `cost_usd` at a second
field rather than establishing one, contradicts no landed entry, and *"Codex cost is reported as
tokens, never priced locally"* (2026-08-22) points the same way. **The counter-argument is recorded
because Q-0112 got this exact judgement wrong three weeks ago**: `ProbeResult` is on `@quorum/core`'s
public surface, `--json` is a contract a consumer parses, and the existing JSDoc says the opposite in
as many words — which is a doc-versus-code conflict `.claude/rules/docs-and-decisions.md` says an
entry settles. **This must be answered at the gate, not during the run**: no step on the chore route
may write a decision entry, and a run launched without the answer is the sixteenth-plus appearance of
a loop handed work no agent in it can perform.

**OQ-3 — should AC-6's check live in `packages/shared`? (gate.)** `docs.test.ts` is where the other
six documents are read, so it is the obvious home — but the assertion reads a `packages/core` source
literal, and Q-0089 was refused for putting a two-tree pin in `shared` on exactly that dependency
direction. Recommendation: keep it in `docs.test.ts` and let `turbo-inputs.test.ts` rule it, since
`shared`'s MANIFEST already carries five `packages/core/src/**` rows for the same reason. If the guard
refuses it, the fallback is `packages/cli/src/adapters.test.ts`, which already reads both sides.

**OQ-4 — is the elision in `docs/USAGE.md` deliberate documentation style?** If the guide elides
product names in transcripts as a convention, AC-6's suffix comparison is still correct but its
framing changes. Measured: `:59` is the only elided transcript in the file. Recommendation: treat it
as a workaround for this defect and quote the sentence in full once it is true.

## 8. Risks

**R-1 — the sentence is chosen at a gate and the criteria are written against it.** Mitigated by §4
naming the bytes and OQ-1 bounding the substitution to one constant. Low.

**R-2 — AC-5's widening turns the guard red on something unmeasured.** Mitigated by having measured
it: both files' non-path `harness` mentions are JSDoc (skipped) or whitespace-free (not `printable`).
**Residual:** the scanner *refuses* syntax it cannot lex, so a construct in `claude.ts` or `codex.ts`
it cannot classify would fail loudly rather than silently — which is the designed behaviour and a
stop, not a false green. Low, and the failure mode is the safe one.

**R-3 — the fix is written and the register is not.** The highest-value half of this ticket is AC-5,
and it is the half with no user-visible symptom. A run that changes the two strings and stops has
repaired the instance and left the class — which is the failure this repository records more than any
other, three times in Q-0112 alone. Mitigated by AC-5's clause (a) being a red-then-green
demonstration rather than a reading.

**R-4 — `--probe` cannot be executed by the reviewer.** Codex runs `--sandbox read-only` and has
failed to execute the suite on every ticket in this cut. AC-10's exit code must be verified through
the built binary at the gate rather than taken from the review report (Q-0051's rule; Q-0091, Q-0092,
Q-0094 and Q-0099 each paid for it).

**R-5 — an `integrate` green that replayed.** `harness.yaml`'s `commands.test` ends `--force`
(Q-0065), and the merge must be verified forced on `main` in **both** environment rows afterwards
(Q-0072's closing finding). Not a new risk; stated because AC-6 adds a cross-package read whose hash
behaviour is the thing a replay would hide.

**R-6 — scope.** Fourteen criteria against the fifteen that forced splits at Q-0091 and Q-0096.
**If it splits, the seam is the two questions and not the two packages** — every file is touched by
both halves — and Half B goes first, because it is the one currently failing a build.

## 9. Gate obligations

- **GO-1 — answer OQ-2 before launching the chore run.** If an entry is owed, it is written at the
  gate by the human; `developer-generalist` may not write one, and a run launched without it spends
  rounds no step can close.
- **GO-2 — settle OQ-1 and record the chosen bytes in the ticket body**, so the implement step reads
  a constant rather than a menu.
- **GO-3 — no new glossary term.** Checked: this change introduces none, so Q-0067's sequencing
  problem (a term added to `main` ahead of its merge turning `main` red under Q-0108's ordered
  comparison) does not arise. Stated rather than assumed, because it caught the last ticket that
  touched these files.
- **GO-4 — verify in both environment rows and on CI.** Q-0105's GO-3 is the precedent: every local
  signal was green and CI was red on all three jobs.

## 10. Cross-cutting checklist

| | |
| --- | --- |
| **BYOS** | The subject. No code path, test, fixture or doc example gains an API-key path; the guard still refuses **before** the CLI probe (AC-2), and the only change is what the refusal says. |
| **Worktree safety** | n/a. No flow writes anything; `probeAdapter`'s temp sandbox is unchanged and still removed (AC-12). |
| **Gate behaviour** | n/a. No flow, bound or gate answer moves. |
| **File format / schema** | `ProbeResult.tokens` widens to `number \| null` — the one contract change, and OQ-2's subject. `--json`'s key set is unchanged and asserted so (AC-9). |
| **Lint rules** | None added. `pnpm lint` covers `packages/**/*.ts` including tests; no deprecated API is introduced. |
| **Cold-clone impact** | Positive and on the critical path. The refusal is among the first sentences a stranger with a key in their shell reads, and `--probe` is the command the README tells them to run before a real run — it currently reports ERROR for a working login. No step is added to the first 30 minutes. |
| **Product-agnostic** | Holds. No SaaS product named. |
| **Errors are explicit** | Improved: a crash that was reported as a login failure becomes a correct verdict, and nothing defaults silently — an unreported measure reads `null` rather than `0` (AC-8). |
