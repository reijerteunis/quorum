# Q-0068 — A healthy login reads unusable, and the refusal misnames the product

*Merged requirement, run 1, iteration 1. Written 2026-09-10. Every measurement below was taken from
the tree during this merge, not relayed from either candidate or from the ticket body — three of
their measurements are wrong and are corrected in §0.*

---

## 0. What re-measuring found

Both candidates were re-measured against the tree before merging. The ticket body's own
2026-09-10 re-measurement is confirmed in full. What follows is what the candidates got wrong, and
two sites neither of them has.

### 0.1 — The refusal string's true site list, and it is six plus one

`grep -rn "Harness runs on subscription OAuth only" packages docs README.md CONTRIBUTING.md`,
excluding gitignored `dist/`:

| Site | What it is | On this change |
| --- | --- | --- |
| `packages/core/src/adapters/claude.ts:95` | production, the `ANTHROPIC_API_KEY` refusal | **edited** |
| `packages/core/src/adapters/codex.ts:89` | production, the `CODEX_API_KEY`/`OPENAI_API_KEY` refusal | **edited** |
| `packages/core/src/adapters/claude.test.ts:62` | `const REFUSAL`, asserted verbatim | **red** |
| `packages/core/src/adapters/codex.test.ts:87` | `const REFUSAL`, asserted verbatim | **red** |
| `packages/cli/src/end-to-end.test.ts:775` | the rendered `✗ <vendor>: …` line | **red** |
| `packages/core/src/adapters/adapters.test.ts:314` | a `test.each` row feeding `transientError` | **stays green** |
| `docs/USAGE.md:59` | the user guide, product name **elided** | **stays green** |

**Three pins go red, not four** — candidate claude's §0.1 is right and the last two rows are the
finding. Both are green tests whose stated subject moves out from under them, which is this
repository's most-recorded defect class, and neither is forced red by the change.

### 0.2 — `packages/cli/src/adapters.test.ts:286` is not a pin, and the ticket body is wrong about it

The ticket body's absorbed-Q-0066 table and candidate claude's file table both list
`cli/src/adapters.test.ts:286` as a pin of the refusal. Measured: `:286` is inside
*"both flags are read as truthiness"* and has nothing to do with the string. That file **deliberately
never spells the refusal** — `:300–303` says so: *"The message is a sentence this test invented, so
nothing here has to know — or spell — what `check()` actually refuses with; what is claimed is that
the CLI is a pass-through."*

So the CLI-side BYOS test does not go red and must not be edited for the text. What it carries is a
**comment that goes false**: the same block continues *"The shipped refusal still names the product
'Harness', which is Q-0068's and reaches the terminal through exactly this path."* That is AC-13's,
not AC-3's. This is a measurement copied from a document rather than taken — the same failure the
ticket body's own correction 2 records committing against Q-0066.

### 0.3 — The human token clause is truthiness, the cost clause is not

`packages/cli/src/adapters.ts:150–151`:

```ts
const cost = result.cost_usd != null ? `, $${result.cost_usd.toFixed(4)}` : '';
const tokens = result.tokens ? `, ${String(result.tokens)} tokens` : '';
```

Candidate claude's AC-9 argues omission is *"this line's shipped convention"* and cites the cost
clause for it. The two clauses are not the same rule: **cost discriminates `0` from `null`** and a
measured `$0.0000` renders, while **tokens discriminates neither** and a measured `0` already renders
nothing. An implementer following that rationale would move tokens to `!= null` and start printing
`, 0 tokens`, which is a behaviour change no criterion asks for. Candidate codex has this right in
its Risks and in its AC-4. AC-9 below pins the renderer unchanged and puts the discrimination in
`--json` and in the type, which is where a consumer reads it.

### 0.4 — Two stale comments neither candidate lists

Candidate claude's landing-rule inventory of five is confirmed at every site. Two more say the same
kind of thing and are in files both candidates already touch:

- `packages/cli/src/adapters.ts:13–15` — the module header, *"the sentence it still carries calls the
  product a harness, which is Q-0068's and is preserved verbatim (Q-0099 AC-8(a))"*.
- `packages/cli/src/adapters.test.ts:302–303` — quoted in §0.2.

Both are green after the change and both then describe a tree that no longer exists. AC-13's set is
therefore **seven**, and its test is a grep rather than a list, because a list is what drifted.

### 0.5 — `probeAdapter` carries its authority line already, and the ticket body was right to say so

`packages/core/src/adapters/adapters.ts:531–536` carries a five-line `Why:` block under
`Q-0046 AC-11 defect 1` describing the defect exactly. **No authority line is owed**;
`.claude/rules/engineering.md` is satisfied. The ticket body's correction 2 stands and both
candidates agree. Its last sentence — *"The spike has this; a quiet fix here would leave both suites
green over a product that disagrees with itself"* — is a landing-rule comment in **production
source** and is AC-13's.

### 0.6 — Two open questions closed by measurement rather than carried

**Where the `docs/USAGE.md` check lives (claude's OQ-3) is not open.** Its worry was the
dependency direction — a `packages/shared` test reading a `packages/core` source, which Q-0089 was
refused for. Measured: `packages/shared/turbo.json` **already declares** `../core/src/adapters/claude.ts`
and `../core/src/adapters/codex.ts` as inputs to `@quorum/shared#test`, and
`packages/shared/src/events.test.ts:26–27` already reads both by those exact paths. `docs.test.ts` is
the home, the read is already covered, and the change costs **one** new input row —
`../../docs/USAGE.md` — because `docs/03-adapter-contract.md` is declared there too.

**Whether the elision is house style (claude's OQ-4) is not open.** `docs/USAGE.md` has four
ellipses: `:151`, `:174` and `:226` truncate a board row and two argument lists, and `:59` is the
only one standing where a product name would be. It is a workaround for this defect, not a
convention. Ruled, and dropped as a question.

---

## 1. Problem

**`quorum adapters` is the first command an adopter runs and it is wrong about two different things
on the same surface.**

**The crash, and it now fails a build.** `probeAdapter` (`packages/core/src/adapters/adapters.ts:546`)
dereferences a null `usage` three times on its success path:

```ts
return { ok: true, …, cost_usd: res.usage!.cost_usd ?? null,
         tokens: (res.usage!.input_tokens ?? 0) + (res.usage!.output_tokens ?? 0), … };
```

`withRetry` answers `usage: null` whenever no attempt reported a measure — correct, deliberate, and
pinned by Q-0034. The two behaviours are each right and compose into a `TypeError` that
`probeAdapter`'s own `catch` converts into `ok: false`, so **an adapter whose login is perfect and
which reports nothing is reported as an unusable login**:
`✗ login not usable: Cannot read properties of null (reading 'cost_usd')`.

Q-0110 escalated it on 2026-09-08. `packages/cli/src/adapters.ts:169` now reads
`if (probe && report.some((entry) => entry.login !== 'verified')) failSoftly();` — so `--probe` is a
**check**, and the one command an adopter is told to run before spending money **exits 1 on a working
installation**. When Q-0066 was opened this printed a wrong sentence. It now reddens a pipeline.

**The word.** Both BYOS refusals call the product **"Harness"**, which
`.claude/rules/product-boundaries.md` forbids in as many words and `docs/GLOSSARY.md` has dated to
2026-08-22. Verified: `claude.ts:95` and `codex.ts:89` are **the only two places in shipped source**
that call the product a harness. Q-0100 moved the whole sibling class on 2026-09-06 and set this one
aside by name, so the rename these two belong beside has already landed.

**The guard that should have caught them is green over its own subject, and this is what makes the
ticket worth more than its diff.** Q-0100 shipped `packages/cli/src/binary-name.test.ts`, which lexes
every production module in `packages/cli`, collects every printable string literal, strips folder
spellings and fails on any that still carries the word. It reaches into `core` through a register:

```ts
const CORE_SUBJECTS = ['packages/core/src/backlog/project.ts'] as const;
```

whose header (`:46–49`) states the reason — `project.ts`'s `ProjectNotFoundError` is *"the only
sentence in `packages/core` that a user reads and that carries the word"*. **That was false when it
was written.** The two refusals are sentences in `packages/core` that a user reads: they reach the
terminal verbatim through `packages/cli/src/adapters.ts`, which renders `e.message` unaltered and
says so twice. The register that was meant to be the escape hatch is the thing that failed open —
the `q0050.source.test.ts` shape (Q-0051) and the root-level `MANIFEST` shape (Q-0108), inside the
guard written to close exactly this class.

**Changing the two strings without changing the register repairs the instance and leaves the class**,
and leaves a guard reporting a completeness it does not have. That is the failure this repository
records more than any other — three times inside Q-0112 alone.

Both defects reach one command over one set of files, and neither owes a decision entry. That is why
they are one ticket.

## 2. User stories

**`adopter`, cold clone.** *I have Claude and Codex subscriptions and an `ANTHROPIC_API_KEY` in my
shell, because every other tool wants one. The first command the README tells me to run refuses, and
I want that refusal to name the product I just installed, tell me what to correct, and say why in
words the rest of the product already uses.*

**`adopter`, CI.** *I put `quorum adapters --probe` in my pipeline because the command's own last line
says it is the thing to run before a real run. It must not report ERROR for a login that answered.*

**`maintainer`.** *I run `--probe` before spending money on a flow. A vendor that answers without
reporting a measure is normal — codex reports tokens and no price at all. "Verified, and it told me
nothing about cost" and "your login is dead" are opposite instructions and must not render alike.*

**`contributor`.** *I am writing a third adapter against `docs/03-adapter-contract.md`. If my adapter
reports no usage the probe must not blame my login for the contract layer's own crash, and the
contract must say what `tokens` means when nothing was measured, so I do not invent a measurement to
make a valid adapter pass.*

## 3. Surfaces

`packages/core/src/adapters/**` — the two refusals, `probeAdapter`, `ProbeResult` ·
`packages/cli/src/**` — rendering, exit status, `binary-name.test.ts`, the end-to-end pin ·
`packages/shared/src/docs.test.ts` and `packages/shared/turbo.json` · `docs/USAGE.md` ·
`docs/03-adapter-contract.md`.

**Not** `harness/`, **not** `backlog/`, **not** `docs/decisions/`, **not** `.claude/rules/`.

## 4. The sentence — ruled

The ticket offers three candidates and rules none; the two candidate documents chose differently. A
requirement that leaves the central case uncovered is precisely one `developer-generalist` must stop
on (Q-0105 B-2), so this document **chooses and states the bytes**.

**Adopted — candidate codex's, both vendors sharing one tail:**

```
ANTHROPIC_API_KEY is set — unset it; Quorum uses the CLI's subscription login only
CODEX_API_KEY/OPENAI_API_KEY is set — unset it; Quorum uses the CLI's subscription login only
```

Rendered, which is the form that has to read well:

```
✗ claude: ANTHROPIC_API_KEY is set — unset it; Quorum uses the CLI's subscription login only
✗ codex: CODEX_API_KEY/OPENAI_API_KEY is set — unset it; Quorum uses the CLI's subscription login only
```

**Why this one, over candidate claude's `Quorum runs on your CLI subscription, never on an API key`.**
The deciding reason is a rule rather than taste. `docs/GLOSSARY.md` and
`.claude/rules/docs-and-decisions.md` forbid introducing synonyms for existing terms, and
**"subscription login" is the term this codebase already owns** — `adapters.ts` uses it in three
comments (*"the subscription login expired"*, *"only a real request proves the subscription
answers"*) and `docs/03-adapter-contract.md` uses it throughout. Claude's sentence coins *"your CLI
subscription"* beside it, and its own §4 then spends a defensive paragraph justifying *"API key"*
against `harness/product-context.md`'s forbidden-synonym list — which is the wording arguing with the
vocabulary rather than using it.

Three further reasons, each checked: it keeps `<VAR> is set — unset it; <clause>` so the remedy stays
first and the diff is one clause per file; it drops **OAuth**, the jargon the ticket itself flags,
which candidate claude also drops; and it is the shorter of the two behind the `✗ <vendor>: ` prefix
and inside `docs/USAGE.md`'s code fence.

**Recorded rather than discarded:** claude's sentence explains *why* the key is refused, which is the
adopter's actual confusion, and is the better runner-up. The ticket's own candidate 1 is the one-word
rename and keeps the jargon; candidate 2 drops the fact that a key is what is being refused.

**Implementation note, because the failure would be loud and confusing.** `CLI's` carries an
apostrophe and both production sites are single-quoted `throw new Error('…')`, so the literal needs
escaping or a different quote form. `binary-name.test.ts` lexes escape sequences and **refuses**
syntax it cannot classify, naming the file and offset — so a mistake here stops the suite rather than
skipping the subject. Stated so it is not read as a defect.

## 5. Acceptance criteria

Fourteen, in three halves. §8 R-6 records the seam if a reviewer wants it split.

### Half A — the sentence

**AC-1 — Both production refusals carry the adopted sentence, and the bytes are the criterion.**
`packages/core/src/adapters/claude.ts` and `codex.ts` throw exactly the two strings in §4, byte for
byte including the em dash.
*Test:* the `REFUSAL` constants at `claude.test.ts:62` and `codex.test.ts:87` assert the thrown
message verbatim; both are updated and neither is deleted.

**AC-2 — Ordering and coverage are untouched, and held by an unedited test.** The BYOS guard still
runs **before** the CLI probe, so a missing binary cannot mask a key set; `claude` guards exactly one
variable and `codex` exactly two; neither inspects the other's.
*Test:* `end-to-end.test.ts:766–781` derives both counts from source via `refusedBy` and asserts
`toHaveLength(1)` and `toHaveLength(2)`, and asserts no vendor was probed. Those three assertions
stay green **with no edit**. Q-0047's AC-3 non-goal is held by their passing, never by inspection.

**AC-3 — The three text pins go red before they go green.** Reverting either production string, one
at a time, turns exactly its own `REFUSAL` pin red plus `end-to-end.test.ts:775`, with a message
naming the vendor.
*Test:* demonstrated by mutation and recorded in the implement report; not asserted from a green run.
Per §0.2, `packages/cli/src/adapters.test.ts` is **not** among them and is not edited for the text.

**AC-4 — The new sentence is still classified as neither an auth failure nor a transient one, and the
fixture proving it quotes the real literal again.** `transientError(<new refusal>)` returns `null` and
`authError('claude', <new refusal>)` returns `null`. This is not automatic: `AUTH_PATTERNS`
(`adapters.ts:469–473`) contains `/invalid api key/i`, `/not logged in/i` and
`/please run\s+\/?login/i`, and `transientError` short-circuits on `authError` before trying
`TRANSIENT`.
*Test:* `adapters.test.ts:313–320`'s *not worth retrying* row carries the new text, **read from
`claude.ts` at test time rather than retyped**, so the row cannot drift from its subject again; and
the comment at `:310–312` is rewritten, which after this change is false three ways over — it names
the deleted `spike/src/adapters/claude.js:12`, it calls the text *"quoted verbatim … over the real
text"* when it no longer is, and it attributes the wording finding to Q-0047. This is §0.1: without
this criterion the table stays green while its stated subject has moved.

**AC-5 — `CORE_SUBJECTS` gains the two adapter files, and its header stops claiming a completeness it
never had.** `packages/cli/src/binary-name.test.ts` scans
`packages/core/src/adapters/claude.ts` and `codex.ts` as subjects, and the header at `:46–49` is
corrected to name three `core` files and to record that its predecessor sentence was **false when
written** rather than merely superseded.
*Test:* three clauses, each shown red on its own — (a) reverting either production string fails the
scan naming that file, which is the guard finally having its subject; (b) removing either entry from
`CORE_SUBJECTS` fails the existence assertion the register already carries; (c) the anti-vacuity
clause gains an anchor in one of the two new files, so a scan that collected nothing there cannot
report success.
*Measured during this merge, so nobody re-derives it:* `grep -i harness` over both files returns five
hits — the two refusals, two `harness.yaml` JSDoc mentions (comments, skipped by design), and
`codex.ts:95`'s `'harness-codex-'`, which `printable = (literal) => /\s/.test(literal)`
(`binary-name.test.ts:408`) excludes for carrying no whitespace. **No exemption register is needed**,
which is the property that makes the widening cheap and is why it was measured before being proposed.

**AC-6 — `docs/USAGE.md` stops quoting a sentence the product does not print, and a check holds it
there.** `:59`'s fenced block carries the shipped refusal **in full**, with the product named rather
than elided.
*Test:* `packages/shared/src/docs.test.ts` asserts the quoted line is the rendered form of the literal
`packages/core/src/adapters/claude.ts` throws, **read from source**; editing either side alone turns
it red. Per §0.6 that read is already declared — `packages/shared/turbo.json` carries
`../core/src/adapters/claude.ts` — so the change is **one** new input row, `../../docs/USAGE.md`,
which `packages/core/src/turbo-inputs.test.ts` will require. That is Q-0072's guard working as
designed and the same registration Q-0108 earned for `CLAUDE.md`.

### Half B — the probe

**AC-7 — A login that answers and reports nothing is verified.** `probeAdapter` performs no unguarded
read of `res.usage`. An adapter returning schema-conforming output with `usage: null` answers
`ok: true`, and no `TypeError` reaches `error`.
*Test:* `probe.test.ts`'s `AC-11 defect 1` block is **inverted rather than deleted** (Q-0037's
precedent) — the same fixture, now asserting `ok: true`, so a returning `res.usage!` fails a check
instead of passing an absent one. Its describe name and comment move with it.

**AC-8 — `tokens` is `number | null`, absence is `null`, and a measured zero is still `0`.** Two
clauses, tested separately:
(a) where `usage` is absent entirely, `cost_usd` and `tokens` are both `null`;
(b) where `usage` is present and its reported input and output measures total zero, `tokens` is `0`,
and the existing arithmetic — counting an individually unreported measure as zero — is **unchanged**.
`ProbeResult`'s JSDoc (`adapters.ts:233–236`) states both halves; today it says *"Input plus output
tokens, counting an unreported measure as zero"*, which after (a) is true of one case and false of the
other.
*Why `null` and not `0`:* the field one line above already reads *"`null` where the vendor reports no
price; never rounded to zero"*, `AdapterUsage` says *"`null` means the vendor did not report that
measure, which is not zero"*, and Q-0037's OQ-2 ruled the same collapse out for run history in these
words. Answering `0` would make two fields of one object disagree about one question.

**AC-9 — The human line omits what was not reported; `--json` carries the distinction; the key set
does not move.** A verified silent adapter renders `  ✓ login verified — round-trip <n>ms` with no
cost clause and no tokens clause — never `$0.0000`, never `0 tokens`, never `n/a`, never
`login not usable`. Under `--json` the same entry carries `"login": "verified"`, `"ok": true`,
`"cost_usd": null`, `"tokens": null`.
*The renderer is pinned unchanged, and this is §0.3:* `adapters.ts:151`'s `result.tokens ? … : ''` is
truthiness and already omits a measured zero, where `:150`'s cost clause is `!= null` and already
prints `$0.0000`. Moving tokens to `!= null` would start printing `, 0 tokens` — a behaviour change
no criterion asks for. The human line keeps its existing limit; the discrimination lives in `--json`
and in the type, which is where a consumer reads it.
*Test:* the existing `--json` key register in `cli/src/adapters.test.ts` is asserted unchanged, and
`--json` remains the combined human-plus-JSON stream it is today.

**AC-10 — `--probe` exits 0 for that adapter.** A run whose only non-`verified` condition was a
silent-but-valid adapter reports SUCCESS. This is the criterion the escalation created and the one an
adopter's pipeline reads.
*Test:* through the **built binary**, not in process — `invoke()` composes `exitCode` from a spied
`process.exit` (Q-0101's finding), so an in-process assertion does not prove what an operating system
reported. `build.test.ts` owns `runBuild()` and `binTarget()` and Q-0098 AC-15(c) rules it may spawn
the emit.

**AC-11 — Other probe failures still fail the check.** Invalid structured output, an adapter
invocation failure and a recognised login failure continue to answer `ok: false`, render
`login not usable`, and make `quorum adapters --probe` exit 1; bare `quorum adapters` remains a report
exiting 0 whatever it finds (Q-0110). The CLI-side pin
`cli/src/adapters.test.ts:331` — *"AC-8(d) — Q-0066's crash renders as an unusable login rather than
being caught in passing"* — is inverted to the repaired behaviour and **keeps its name**, so the
register of what this command reports stays complete.
*Test:* restoring `res.usage!` in `core` turns this red as well as `probe.test.ts`, which is what
proves the CLI is still a faithful renderer rather than compensating for `core`.

**AC-12 — The sandbox is still removed on the no-usage path.** `probe.test.ts`'s second AC-11 test —
the temp directory cleaned up when the probe took that path — is kept and re-aimed at the success
path. A repair that leaked a directory would otherwise be invisible.

### Half C — the record

**AC-13 — Every comment stating how this fix must land, or that either defect is still preserved, is
corrected.** Seven sites, enumerated because two are in neither candidate (§0.4) and one is in
production source:

| Site | What it says now |
| --- | --- |
| `core/src/adapters/adapters.ts:535–536` | *"The spike has this; a quiet fix here would leave both suites green…"* — production |
| `core/src/adapters/probe.test.ts:149` | *"Preserved on purpose: the spike still does it…"* |
| `cli/src/adapters.ts:13–15` | the refusal *"is preserved verbatim (Q-0099 AC-8(a))"* |
| `cli/src/adapters.ts:30–35` | *"One preserved defect reaches this command and is not repaired here"*, and its item |
| `cli/src/adapters.test.ts:302–303` | *"The shipped refusal still names the product 'Harness'"* |
| `cli/src/adapters.test.ts:335` | *"lands in both trees together…"* |
| `core/src/adapters/claude.test.ts:380` | *"Fixing it belongs in both trees at once, like Q-0066 and Q-0068"* |

Three clauses: (a) no comment anywhere claims a both-trees landing rule for either defect; (b)
`cli/src/adapters.ts`'s preserved-defect heading and item are removed, since none reaches this
command any more; (c) `probeAdapter`'s `Why:` block loses its preserved-defect paragraph, because
`engineering.md` asks for an authority line **where behaviour is deliberately counterintuitive** and
after AC-7 none is — what replaces it is a one-line contract note on the usage-absent case, **not a
transcription of this ticket or its entry**, which is the rule Q-0067 and Q-0111 were each caught
breaking within two days.
**The seventh is not this ticket's defect and must not be over-repaired:** `claude.test.ts:380`
belongs to the unrelated non-string-final-message crash and cites Q-0066 and Q-0068 only as an
analogy. Its own subject stays preserved and its assertion is untouched; what moves is the analogy,
which now points at two closed tickets that did not land in both trees because there is no second
tree.
*Test:* a grep for the landing-rule and preservation phrasings across
`packages/*/src/adapters/` and `packages/cli/src/adapters*` returns nothing attributable to Q-0066 or
Q-0068. Q-0103's AC-19 is respected: past-tense provenance elsewhere is untouched, and the
*"both trees"* comments belonging to Q-0070, Q-0081 and ground rule 3 — in `fanout/command.ts`,
`engine/steps.ts`, `engine/steps.test.ts`, `cli/src/ticket.test.ts` — are out of scope.

**AC-14 — The documented adapter contract agrees with the shipped one.**
`docs/03-adapter-contract.md` states that a successful probe may report `cost_usd: null` **and**
`tokens: null` where the vendor reported no usage, distinguishes that absence from a measured zero,
and does not describe missing usage as a failed login. Its `:32–33` sketch of `probeAdapter`'s return
is updated with it, and the status line at the top is bumped per
`.claude/rules/docs-and-decisions.md`.
*Test:* that file is already an input to `@quorum/shared#test`, so the read costs no new
registration; the assertion pins the documented shape against `ProbeResult` rather than against a
retyped literal.

## 6. Non-goals

1. **The refusal's ordering and coverage** (Q-0047 AC-3, per Q-0046 erratum E-1). Held green by AC-2,
   never re-specified.
2. **`authError`'s and `transientError`'s messages and pattern lists.** AC-4 asserts the new sentence
   passes through them unchanged; it does not touch either.
3. **`withRetry`'s deliberate `usage: null`** when no attempt reported a measure (Q-0034), and any
   requirement that an adapter report usage at all.
4. **A third human-readable login state.** No *"verified but unmeasured"*: the existing verified line
   with its clauses omitted is sufficient, and AC-9 pins the renderer rather than growing it.
5. **`quorum adapters` exiting 0 with both CLIs absent.** The ticket body's *"third defect"* paragraph
   is **void** — Q-0110 ratified that zero on 2026-09-08, the bare listing being a report whose own
   last line disclaims being the gate. The orphaned *"Q-0090's GA-4"* obligation it names is
   discharged. Confirmed against `cli/src/adapters.ts:17–22` and the AC-8(c) test.
6. **Widening `binary-name.test.ts` to all of `packages/core`.** AC-5 adds two measured subjects to
   the register the guard already has. Replacing that register with a derivation over `core` is a
   different question at a different cost, and the guard's own header argues it down.
7. **A product-name audit across `docs/` and prose.** `/review-docs`' job. AC-6 covers one documented
   quotation of a shipped string, which is a code-drift check rather than a prose audit.
8. **The non-string-final-message crash** at `claude.test.ts:374–383`. AC-13 moves its comment's
   analogy and nothing else; the defect stays preserved and is not ticketed here.
9. **`docs/03-adapter-contract.md`'s verified-version table**, which Q-0067 owns.
10. **Anything under `backlog/` or `harness/`**, where an agent's edits are discarded, and
    `.claude/rules/`, which is a derived copy (2026-08-27).
11. **A new dependency**, and any change to a flow, gate, bound, worktree behaviour or persistent
    file format.

## 7. Open questions

**None blocking.** Two of candidate claude's four are ruled closed in §0.6 by measurement; the
remaining two are below, and neither can change the design.

**OQ-1 — the sentence (gate, non-blocking).** §4 adopts
`Quorum uses the CLI's subscription login only` with its reasoning and records the runner-up. The
gate may substitute any sentence that (a) does not call the product a harness, (b) keeps the
`unset it` remedy first, (c) reads correctly behind `✗ <vendor>: `, (d) introduces no synonym for a
term `docs/GLOSSARY.md` already owns, and (e) **satisfies AC-4** — which is a real constraint, not a
formality: a sentence containing *"not logged in"*, *"please run /login"* or *"invalid api key"* would
be classified by `authError` and change how the refusal is handled. Every criterion is written against
*the constant*, so a substitution costs one edit and no re-specification.

**OQ-2 — does `tokens: number | null` owe a decision entry? (gate obligation, non-blocking.)**
**Recommendation: no.** It applies at a second field the rule the same object already states for
`cost_usd`, contradicts no landed entry, and *"Codex cost is reported as tokens, never priced
locally"* (2026-08-22) and Q-0037's OQ-2 ruling both point the same way. The doc-versus-code conflict
it creates is with a JSDoc in the file being edited and with `docs/03-adapter-contract.md`, and
`.claude/rules/docs-and-decisions.md` answers that with *"fix the docs in the same PR"* (AC-8, AC-14)
rather than with an entry.
**The counter-argument is recorded because Q-0112 got this exact judgement wrong**: `ProbeResult` is
on `@quorum/core`'s public surface and `--json` is a contract a consumer parses, so a reader could
call the representation product policy rather than a repair.
**It is not a blocker under this document's own standard**: whichever way it is answered, no criterion
and no line of code moves — only whether a human writes a file before the run. It is GO-1 because a
run launched needing an entry no step on the chore route may write is the pattern this repository has
paid for fifteen times.

## 8. Risks

**R-1 — the fix is written and the register is not.** The highest-value criterion is AC-5 and it is
the one with no user-visible symptom, so it is the one a hurried round drops. A run that changes the
two strings and stops has repaired the instance and left the class. Mitigated by AC-5 clause (a) being
a red-then-green demonstration rather than a reading.

**R-2 — the two silent criteria.** AC-4 and AC-13 are the only criteria whose subject is a **green**
test or comment; nothing forces them. They are stated with their sites and their greps for that
reason, and a review that checks only what went red will miss both.

**R-3 — AC-5's widening turns the guard red on something unmeasured.** Mitigated by §0/AC-5 having
measured it: both files' remaining `harness` mentions are JSDoc or whitespace-free. **Residual:** the
scanner *refuses* syntax it cannot lex, naming file and offset — so an escaped apostrophe gone wrong
fails loudly rather than skipping its subject. The failure mode is the safe one.

**R-4 — the reviewer cannot execute.** Codex runs `--sandbox read-only` and has failed to run the
suite on every ticket of the recent cut. AC-10's exit code must be verified through the built binary
at the gate rather than taken from the review report — Q-0051's rule, which Q-0091, Q-0092, Q-0094,
Q-0096 and Q-0099 each paid for.

**R-5 — an `integrate` green that replayed.** `harness.yaml`'s `commands.test` ends `--force`
(Q-0065) and the merge must be verified forced on `main` in **both** environment rows afterwards
(Q-0072's closing finding). Stated because AC-6 adds a cross-package read whose hash behaviour is
exactly what a replay would hide.

**R-6 — scope, and the seam if it is wanted.** **Fourteen criteria** against the fifteen that forced
splits at Q-0091 and Q-0096: inside the ceiling, and deliberately not split. Splitting would undo the
2026-09-07 triage's own measured argument — a second requirements run, a second chore run and a second
cross-vendor review over **the same eleven files**, roughly $50–70 of gate for about ten lines — and
would reduce no file-level contention, because every file is touched by both halves. **If a reviewer
splits it anyway the seam is the two questions and never the two packages**, and **Half B goes first**,
being the half that is currently failing a build.

**R-7 — a `ProbeResult` consumer assuming `tokens` is always a number.** Candidate codex's risk, kept:
widening the type is what makes such a consumer fail at compile time rather than silently treat
absence as zero. `pnpm typecheck` is the instrument and `packages/cli` is the only consumer today.

## 9. Gate obligations

- **GO-1 — answer OQ-2 before launching the chore run.** If an entry is owed it is written at the gate
  by the human; `developer-generalist` may not write one, and a run launched without it spends rounds
  no step on the route can close.
- **GO-2 — settle OQ-1 and record the chosen bytes in the ticket body**, so the implement step reads a
  constant rather than a menu, and so a substitution is not re-derived from this document's §4.
- **GO-3 — no new glossary term.** Checked: this change introduces none, so Q-0067's sequencing problem
  — a term added to `main` ahead of its merge turning `main` red under Q-0108's ordered comparison —
  does not arise. Stated rather than assumed, because it caught the last ticket that touched these
  files.
- **GO-4 — verify forced in both environment rows and on CI.** `pnpm install --frozen-lockfile`, then
  `pnpm turbo run test --force --continue`, `pnpm lint`, `pnpm typecheck`, and `quorum lint`; then CI
  green on the merged commit. Q-0105's GO-3 is the precedent: every local signal was green and CI was
  red on all three jobs. Candidate codex carried this as a criterion; it is every ticket's definition
  of done rather than a criterion of this one.

## 10. Cross-cutting checklist

| | |
| --- | --- |
| **BYOS** | The subject. No code path, test, fixture or doc example gains an API-key path; the guard still refuses **before** the CLI probe and over the same variables (AC-2). Only what the refusal says changes, and it must not be generalised into a supported alternative. |
| **Worktree safety** | n/a. No flow writes anything; `probeAdapter`'s temporary sandbox is unchanged and still removed (AC-12). |
| **Gate behaviour** | n/a. No flow, bound or gate answer moves. |
| **File format / schema** | No persistent format changes. `ProbeResult.tokens` widens to `number \| null` — the one contract change and OQ-2's subject; `--json` keeps the same keys with a nullable value (AC-9). |
| **Lint rules** | None added. `pnpm lint` covers `packages/**/*.ts` including tests; no deprecated API is introduced. Strict TypeScript is what surfaces every consumer of the widened field (R-7). |
| **Cold-clone impact** | Positive and on the critical path. The refusal is among the first sentences a stranger with a key in their shell reads; `--probe` is the command the README and `docs/USAGE.md` tell them to run before a real run, and it currently reports ERROR for a working login. No step is added to the first 30 minutes. |
| **Product-agnostic** | Holds. No SaaS product is named; vendor names stay inside their adapters and the existing report surface. |
| **Errors are explicit** | Improved twice. A crash reported as a login failure becomes a correct verdict, and nothing defaults silently — an unreported measure reads `null` rather than `0` (AC-8). |

## 11. Provenance

**Candidate claude supplied the spine and is the stronger document.** Its method — re-measure the
ticket body before writing, and record what was wrong — is adopted as §0 and is what caught three
further errors during this merge. Specifically from it: the **`CORE_SUBJECTS` failed-open finding**
(AC-5), which is the single most valuable thing in either candidate and which converts the ticket from
repairing an instance to closing a class; the **`docs/USAGE.md` seventh site** (AC-6); the correction
that **three pins go red, not four** (§0.1, AC-3); the **`transientError` fixture drift** (AC-4); the
landing-rule comment inventory and its precision about `claude.test.ts:380` being an analogy for an
unrelated defect (AC-13); the built-binary requirement for the exit code (AC-10); the inversion of the
`probe.test.ts` pins on Q-0037's precedent (AC-7, AC-12); and R-3's analysis that the scanner's refusal
is the safe failure mode.

**Candidate codex is sharper on the probe half and on the contract, and won the sentence.** From it:
the **measured-zero-versus-absent discrimination as its own clause** (AC-8(b)), which claude folded
into prose and which is the test that actually separates the two representations; the **`--json` key
stability and combined-stream constraint** (AC-9); the **`docs/03-adapter-contract.md` alignment**
(AC-14), which claude omits entirely; the *"no third login state"* non-goal (§6.4); the
`ProbeResult`-consumer compile-time risk (R-7); the crisper three-part user story; and **the adopted
sentence** (§4), which uses the vocabulary the glossary already owns where claude's coins a synonym
beside it.

**Ruled in the merge, against both.** The sentence, on the synonym rule rather than on taste (§4).
Claude's OQ-3 closed by measuring `packages/shared/turbo.json`, which already declares both adapter
files, and `events.test.ts`, which already reads them — so AC-6 costs one input row and no siting
question (§0.6). Claude's OQ-4 closed by measuring USAGE.md's four elisions (§0.6). Three corrections:
`cli/src/adapters.test.ts:286` is **not** a pin of the refusal, an error inherited from the ticket
body and repeated by claude (§0.2); claude's omission rationale confuses the truthiness token clause
with the `!= null` cost clause, and following it would print `, 0 tokens` for a measured zero (§0.3,
AC-9); and two stale comments neither candidate lists are added to AC-13's set (§0.4). Codex's
repository-verification criterion is moved to GO-4, being every ticket's definition of done rather
than a criterion of this one. The size is fourteen, the split is declined with reasons, and the seam
is recorded in R-6.
