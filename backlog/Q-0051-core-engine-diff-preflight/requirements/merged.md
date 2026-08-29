# Q-0051 — `core/engine`: diff preflight and materialisation

*Merged requirement, 2026-08-30. Written by the head-of-product role from
`requirements/candidate-claude.md` and `requirements/candidate-codex.md`. Parent Q-0009; charter
`harness/port-charter.md` §6 row Q-0051; invariants 10, 11, 12. Route: chore
(`requirements → chore → human gate`).*

**Every file position in this document was re-read on 2026-08-30 and is stated with the file it was
read from.** Where a candidate's number was wrong it is corrected here and the correction is noted
in *Provenance*. The ticket body's warning applies to this document too: re-derive from the file,
never from this paragraph.

---

## Problem

A run's most expensive mistake is paying two vendors to read evidence that is not there. It has
happened: Q-0006's review round 10 billed $5.02 of Claude cost plus an unpriced Codex reviewer
against a diff of zero bytes. `materialiseDiff` embedded the emptiness without noticing and the
flow would have advanced on the verdict. The panel returned eleven substantive findings anyway, by
reading the working tree instead of the evidence handed to it — which is precisely why the
breakage stayed invisible. Any step whose input is technically optional because the agent has
repository access carries the same hazard.

The subsystem that closes it — a run-level preflight that materialises every range before any
adapter is invoked, and a diagnostic that quotes evidence instead of narrating a cause — is 192
lines of `spike/src/engine.js`, of which 107 are code; the rest is the comment weight Q-0034 and
Q-0035 paid for, the latter at $36.66. It is the most decision-dense of the four engine children.

`packages/core` has the *position* and none of the subsystem. Q-0050 left the block out
deliberately: `packages/core/src/engine/engine.ts` opens its run `try` at `:207` and reads
`flow.steps` at `:223`, and the preflight belongs between them. `RunContext`
(`packages/core/src/engine/types.ts:139-160`) carries neither `diffInputs` nor `deferredDiffs`, so
the seam Q-0052's `buildPrompt` reads from does not exist. Until this ticket lands, a `core` run of
either flow this repository develops itself with — `review.yaml`, `chore.yaml` — would hand its
reviewers nothing, or fail late, after the preceding adapter had been billed.

---

## User stories

**Maintainer.** As a solo maintainer running `harness run review Q-0051` on my own repository, I
want the run to stop before it spawns a single agent when the review range is empty, malformed, or
aimed at a ref that does not exist — and to tell me both endpoints, the short SHA each resolved to,
the containment check verbatim and its outcome — so that I can re-check the failure by hand
tomorrow, after the branch tips have moved.

**Maintainer.** As a maintainer reviewing a ticket whose branch is already contained in `main`, I
want `--base <ref>` to move the diff anchor and nothing else, so that aiming a review at an older
revision never writes that revision into my ticket's branch.

**Cold-clone adopter.** As someone running Quorum for the first time, I want a check that declined
to examine something to say so, so that I never read silence as a pass.

**Contributor.** As a contributor working inside `packages/core`, I want the diff subsystem to be
one module with a stated contract, so that when I add a step kind I can see what the preflight
promises the step and what it deliberately does not.

---

## Surfaces

- **`packages/core`** — the only surface this ticket writes. One new file,
  `packages/core/src/engine/diff.ts`; edits to `engine.ts` (the call site and the context literal
  at `:194`) and `types.ts` (two fields) in the same folder; and edits to
  `packages/core/src/engine/q0050.source.test.ts` at the three pins AC-1 and AC-12 name.
- **`spike/**`** — untouched, including its tests (charter §3). The spike suite is the independent
  witness and the whole proof.
- **`harness/`, `docs/`, `backlog/`, CLI** — untouched. `docs/04-architecture.md` describes
  `core/src` at folder granularity (`:44`) and names the public API (`:42`); this ticket adds
  neither a folder nor a public export, so no numbered doc changes. No new glossary term:
  **preflight**, **dry run** and **base override** are used exactly as `docs/GLOSSARY.md` defines
  them. No decision entry is owed — see *Open questions*.

---

## What this requirement settles before the implementer starts

The ticket body delegates two decisions and inherits four obligations; the candidates raised five
open questions between them. All are ruled here, so none is discovered in review.

### D-1. The diff subsystem is a new module, `packages/core/src/engine/diff.ts`, and the folder pin moves with it

Not folded into `engine.ts`, which is exactly 310 lines and already composes six concerns, and not
into `loaders.ts`, which is pure readers over the filesystem with no git and no context. The
subsystem owns one behaviour Q-0052 calls from a second call site, and it spawns git — a property
none of the six existing files has.

**The consequence is part of this change, not a surprise found in review.**
`q0050.source.test.ts:82` pins the folder with `toStrictEqual(['channel.ts', 'engine.ts',
'lifecycle.ts', 'loaders.ts', 'routing.ts', 'types.ts'])`, and the comments at `:90` and `:107` say
in as many words that the file's other guards were widened *"while the folder is six"* because they
govern what Q-0051 to Q-0053 add. Extending that array to seven entries in sorted order is
authorised here. It is not the only pin: `production` is derived from the corpus, so the register at
`:160-171` compares `toStrictEqual` against a map keyed by file, and a `diff.ts` carrying any `Why:`
line fails it until `diff.ts` is a key (AC-12).

### D-2. `preflightDiffs` is the name, and `materialiseDiff` takes a narrowed context

Exports: `preflightDiffs(context)`, `materialiseDiff(step, context)` and
`trimIncompleteUtf8Suffix(bytes)`. Module-private: `named`, `diffSitesOf`, `emptyRangeFailure`.
Nothing is re-exported from `packages/core/src/index.ts` (AC-14).

`preflightDiffs` is the name because **preflight** is already the glossary's word for exactly this
pass. The spike's block is anonymous; naming it is internal layout, which charter §2 does not
preserve. Codex's alternative, `materialiseDiffInputs`, describes half of what it does — a deferred
range is examined and not materialised.

`materialiseDiff` takes a **narrow context type declared in `diff.ts`**, structurally satisfied by
`RunContext`, reading exactly `repoDir`, `config`, `vars`, `ticket`, `runId`, `deferredDiffs` and
`persistence.appendLog`. This is what lets the diagnostic be tested against a throwaway repository
without constructing a run, which is how all seventeen `q0035-empty-range.js` scenarios are built.
**Correction to candidate-claude, which matters:** `RoutingContext` (`types.ts:197`) and
`LifecycleContext` (`:214`) both `extends RunContext` — they widen, they do not narrow. There is no
narrowing precedent in this folder, so the narrowed type is a **deliberate addition** and carries
that authority clause (AC-12), not a claim of precedent. Its compile-time proof is the call site:
`engine.ts` hands `preflightDiffs` the whole `RunContext` and it typechecks.

`trimIncompleteUtf8Suffix` is exported for how it arrived. Q-0049's body listed it among run
history's functions, which it is not; it begins two lines below `emptyRangeFailure`'s close, so a
range-based port takes everything except this one. It was nearly lost to adjacency. It gets its own
name in the export list and its own table-driven test, so a future deletion is loud.

### D-3. The truncation log line goes through `persistence.appendLog`

The spike writes `ctx.backlog.log(...)` at `spike/src/engine.js:842`. In `core`, `appendLog` is the
seam every write already goes through — `engine.ts:157` delegates it to `backlogView.log`, and
`lifecycle.ts` and `routing.ts` use it for their own lines. Behaviour is identical in both modes:
under `--dry`, `backlogView` is `readOnlyBacklog` (`engine.ts:33-44`), whose `log` is a no-op,
exactly as the spike's is. Layout, not behaviour.

### D-4. The two `git diff` spawns stay inside `diff.ts`

`materialiseDiff` spawns `git diff --stat <range>` and `git diff <range>` directly and does **not**
route them through `packages/core/src/git/git.ts`. Invariant 8 governs *ancestry*, and ancestry is
already routed correctly through `emptyRangeEvidence` (`git/git.ts:168`), which Q-0042 ported. A
patch and a stat are not ancestry. Adding a ninth export to `git.ts` would break
`git.source.test.ts`'s eight-function pin — another child's landed guard, changed for a refactor
nobody asked for.

### D-5. Q-0038's known hole is preserved, not fixed — and this is not a blocker

The preflight defers a range whole when *either* endpoint is step-created: one `.find()` over both
endpoints at `spike/src/engine.js:133`. Q-0038 owns both halves of the fix and has not landed.

Codex's candidate makes this a blocking question for ruud. **It is ruled here instead, and it needs
no decision entry, which is the test for whether an open question blocks.** *"The port preserves
behaviour; one exception is authorised and everything else stops the child"* (2026-08-25) already
decides it: this ticket ports the current, unfixed `.find()` and registers it as a preserved defect
with an authority line. Porting a speculative fix would destroy the port's only proof — the frozen
witness would keep the old behaviour and both suites would be green over a divergence.

**Sequencing, stated as a constraint rather than left as a hazard:** Q-0038 must not be landed on
`spike/src/engine.js` while this child is in flight. If it is, this child stops and is re-cut
against the fixed source, per charter §2. The ticket body's *"doing both means porting a file while
it is being changed underneath"* is the same instruction from the other side.

### D-6. `String(…)` at the three interpolation sites is deliberate, and is not a behaviour change

Q-0050 `solution/errata.md` E-21 names this ticket by id. `spike/src/engine.js:745` is
`String(s).replace(…)`; `packages/core/src/engine/loaders.ts:52` types the parameter `string` and
coerces nothing. The three sites inside this ticket's range are `engine.js:125` (`site.input.diff`),
`:138` (`s.branch`) and `:139` (`s.into`); `materialiseDiff` at `:791` already writes
`String(step.input.diff)` itself. YAML hands back a **number** for `branch: 2`, so under a step
shape typed `Record<string, unknown>` each site writes `String(…)` deliberately. This turns a latent
runtime pass-through into a compile error. It is not a behaviour change to report under charter §2,
and it is not licence to change what an interpolated value means.

### D-7. The `200000` cap stays a literal in `diff.ts`

Charter §4 puts constants in `shared`, and this one is already spelled twice
(`spike/src/engine.js:836`, `packages/shared/src/project.test.ts:97`); the port makes it three.
Promoting it is an edit to Q-0041's module for a value this ticket does not change, and
`packages/shared/src/index.test.ts` pins the exported constant list. **Ruled: no.** The third
spelling is registered under *Reported, not fixed*.

### D-8. Q-0051's ticket body is **not** added to the transcription corpus

`q0050.source.test.ts:187-190` scans authority lines against `docs/DECISIONS.md` and Q-0050's ticket
body. Candidate-claude recommends adding Q-0051's body so a comment transcribing *this* document is
caught. **Ruled: no, not in this ticket** — and the reason is the interesting part. This ticket body
deliberately quotes the spike comments `diff.ts` must preserve verbatim ("no adapter is billed
before bad evidence is found", the *skipped is not passed* sentence, the guard's own wording). A
widened scan would fire on a faithful port and pressure the implementer to paraphrase the evidence
Q-0034 and Q-0035 paid for — the guard doing the opposite of its job. Registered as a reported item
for whichever ticket next touches that scan.

---

## Acceptance criteria

Fourteen, each independently testable. **Size was weighed:** fourteen is at the upper end of what a
ticket should carry, and it is accepted here rather than cut further because the seams are already
cut — `buildPrompt`, agent, gate and script steps are Q-0052; fan-out and integrate are Q-0053 — and
because splitting the guard from the diagnostic would put two tickets inside one function. Most of
the work is the ported test suite, not the 107 lines of code.

### AC-1 — The module exists, and it passes every landed source guard, including two in another module's suite

`packages/core/src/engine/diff.ts` exists and is the only file this ticket adds to that folder.

**(a) `q0050.source.test.ts`'s six guards pass over it**, with `:82`'s array extended to seven
entries in sorted order: every `export` carries its own JSDoc anchored on the export, not on the
file; no comment line reproduces a sentence of forty characters or more from `docs/DECISIONS.md` or
`backlog/Q-0050-core-engine-run-loop/ticket.md`; every `Why:` clause is classifiable by that file's
`classifyAuthority`; and the file matches none of `console.`,
`process.(stdout|stderr|exit|on|once|addListener|prependListener|prependOnceListener)`, an ANSI
escape, or an import from `spike/`.

**(b) The `merge-base` token does not leave `git/git.ts`.** `git.source.test.ts` asserts that
`merge-base` and `--is-ancestor` appear in `git/git.ts` and in **no other file** `coreSourceFiles()`
returns. `spike/src/engine.js:861`, inside `emptyRangeFailure`'s comment block, reads *"`merge-base`
survives because it is the name of the command being quoted and of the commit a three-dot range is
defined against."* Ported verbatim, that comment turns another child's landed suite red — for a
token appearing in prose explaining why the token is allowed. `diff.ts` must therefore preserve the
argument without spelling the hyphenated token. The message text itself is safe: the command comes
from `check.command`, built in `git.ts` (`:120`), so the literal never appears in engine source, and
the not-contained diagnosis says `merge base` with a space. **The scan covers production files
only** — `coreSourceFiles`'s `isSourceFile` excludes `*.test.ts` — so a test may assert the token
freely, and only the source comment is at risk.

*Test:* with `:82` unextended, `pnpm turbo run test --force --filter=@quorum/core` fails on that
line; extended, all six describes pass. For (b), demonstrate the guard failing over a `diff.ts`
carrying the verbatim comment **before** trusting the version that passes — *"a check is not
established by reading it"* (2026-08-29).

### AC-2 — The exported contract is exactly three symbols, over a narrowed context

`diff.ts` exports `preflightDiffs`, `materialiseDiff` and `trimIncompleteUtf8Suffix` and nothing
else; `named`, `diffSitesOf` and `emptyRangeFailure` are module-private. `materialiseDiff` and
`preflightDiffs` take the narrowed context of D-2, declared in `diff.ts`, which `RunContext`
satisfies structurally.

*Test:* a test constructs the narrowed context by hand over a throwaway repository — no run, no
adapter, no backlog on disk beyond what the context needs — and calls `materialiseDiff` directly.
That construction succeeding is the criterion; every diagnostic criterion below depends on it.
`engine.ts`'s call site typechecking is the proof that `RunContext` satisfies the narrow type.

### AC-3 — The range guard is not relaxed, it names the base it was actually given, and it refuses before any git runs

`materialiseDiff` interpolates the written value, splits on `...`, and throws `FlowError` unless
there are exactly two non-empty endpoints and each is either `ctx.vars.base` or begins
`harness/<ticket-id>/`. The refusal is preserved in shape:

```
<step.id>: input.diff must relate the configured base or this ticket's own branches ("<base>", "<prefix>…") with "...", got <range>
```

`<base>` is `ctx.vars.base` — the override under `--base`, the configured base otherwise.
`spike/src/engine.js:800` anticipated the flag in as many words. **The refusal happens before
`shortSha`, before `git diff` and before the containment check**, so a malformed or out-of-class
range costs no git invocation at all.

*Test:* `q0035-empty-range.js` E6/E7 and `q0034-chore-preflight.js` C3, ported. A guard failure over
`{base}...some/other-branch` matches `/must relate the configured base/` and does **not** match
`/is empty|containment/` — a guard failure must not read as an empty-range diagnosis. With
`vars.base = 'release'` the message contains `"release"`. Zero git spawns is asserted, not inferred:
count the calls through the module's own git seam, or point `repoDir` at a directory that is not a
repository and observe the guard still throws its own message.

### AC-4 — `--base` moves the diff anchor and nothing else

`materialiseDiff` derives the anchor from `ctx.vars.base` and never from `ctx.config.repo.base_branch`
directly. `engine.ts:137` already computes `vars.base` as
`base ?? config.repo?.base_branch ?? DEFAULT_BASE_BRANCH`. The three sites that *merge* a base into
the ticket's branch — rework sync, `integrate`'s sync, and the evidence note — read
`config.repo.base_branch` and are outside this ticket; nothing written here may make
`materialiseDiff` read the config for its anchor.

*Test:* `spike/test/q0077-base-flag.js` B1–B4, ported (B5 drives the CLI and stays with the spike
until Q-0010). B1 is the discriminating one: in one repository, a contained ticket has an empty
range against the configured base and a usable one against `--base`. A port that resolved the anchor
from the config would silently undo Q-0077 while every other test stayed green.

### AC-5 — An unresolvable endpoint fails with the evidence that exists, and keeps its identifying phrase

One `git rev-parse --verify --quiet --short` per endpoint, through `shortSha`
(`packages/core/src/git/git.ts:148`), answering both *does it resolve?* and *to what?*. The left
endpoint is tested before the right. Each of the three failures keeps its identifying phrase, which
frozen fixtures match by substring — evidence is added *around* them, never in place of them:

1. `repo.base_branch in harness/harness.yaml names missing ref "<base>"`
2. `ticket <id>: expected harness/<id>/integration; review requires an integrated branch`
3. `<step.id>: input.diff names missing ref "<ref>"`

Each is followed by a tail naming which endpoint it is, what the *other* endpoint resolved to (or
that it does not resolve either), the step that was expected to create it when the range was
deferred, and the sentence `Neither the diff nor the containment check was run.`

*Test:* `q0035-empty-range.js` E5 and E16, ported. The final sentence is the load-bearing one — it
is invariant 11 inside a single message, and its absence is what would let a reader take an
unexamined check for a passed one.

### AC-6 — The empty-range diagnostic quotes evidence and claims no event

When `git diff --stat` prints only whitespace the run stops with a message carrying all five
elements; missing any one makes it un-re-checkable by hand, which is the whole point:

- the range as interpolated **and** as the flow file writes it, both in backticks;
- both endpoints, each with the short SHA it resolved to;
- the containment check verbatim, as `check.command` supplies it;
- that check's outcome as exactly one of `contained`, `not contained`, or
  `indeterminate (<reason>[: <detail>])`;
- one diagnosis and **at most one** remedy, and every remedy is one AC-3's guard would accept.

The outcome comes from `emptyRangeEvidence(repoDir, left, right)` (`git/git.ts:168`) and from
nowhere else. `diff.ts` contains no `try { … } catch { return false }` over an ancestry question and
no second spelling of the ancestry rules. `sameTree` discriminates only inside the not-contained
branch — `different commits holding identical trees` against `adds nothing since its merge base` —
and adds nothing when it is `null`. When the outcome is indeterminate the message says git could not
answer and makes no further containment claim.

Forbidden vocabulary, matched case-insensitively across the whole message:
`/\b(merged|landed|shipped|rebased|cherry-picked|reset)\b|already in\b/`. The board's word is
**contained**. The bare phrase `merge base` survives, because it names the commit a three-dot range
is defined against — and only in the message, never in `diff.ts`'s source (AC-1b).

*Test:* `q0035-empty-range.js` E1–E4 and E13, ported: four throwaway repositories, one per outcome,
each asserting the five elements present and the forbidden pattern absent. No test asserts a whole
sentence, and none assumes a fixed short-SHA width — git chooses the abbreviation.

### AC-7 — A deferred range's remedy is about the state that actually arose

When the preflight deferred this range, the message additionally names the step that owed the
endpoint (`produced by step "<id>", which was expected to create <ref>`) and the remedy becomes
`check that step "<id>" committed its work to <ref>` — **never** `review <right> before it becomes
contained in <left>`. A branch this run created moments ago never *became* contained; it started
that way, because that step committed nothing. Sending the reader to review it earlier is advice
about a state that never existed.

*Test:* the assertion pair from `q0035-empty-range.js` E11 — `/Remedy: check that step "implement"
committed its work/` present, `/before it becomes contained/` absent — exercised against
`materialiseDiff` directly with a hand-built `deferredDiffs` map, plus E15's indeterminate variant,
which must still name the step. The end-to-end halves of E11 and E15 are not closable here; see
*Coverage this ticket cannot close*.

### AC-8 — Truncation is byte-honest, and the trim is tested by name

The limit is `ctx.config.repo?.max_diff_bytes ?? 200000`. Above it the buffer is cut to the limit,
passed through `trimIncompleteUtf8Suffix` so the patch never ends mid-character, and a line is
appended to `runs.log` through `persistence.appendLog`:

```
run=<runId> diff truncated range=<range> limit=<limit> kept=<bytes.length>
```

The returned document then carries `Patch truncated to <n> UTF-8 bytes (configured limit <limit>).`
under a `## Truncation notice` heading. A patch at or below the limit has neither notice nor log
line. The document's headings are preserved byte for byte: `## Diff to review`,
`### git diff --stat <range>`, `## Patch (<range>)`, `## Truncation notice`, with the stat trimmed
and the patch decoded as UTF-8 — no new wrapping, escaping or normalisation of git's output.

`trimIncompleteUtf8Suffix` has its own table-driven test: an empty buffer; continuation bytes only;
a complete 1-, 2-, 3- and 4-byte sequence at the tail, each returned unchanged; a truncated 2-, 3-
and 4-byte sequence, each trimmed back before the lead byte; and an invalid lead byte
(`0x80`–`0xc1`), which takes width 1 and is kept. The width table is `< 0x80 → 1`, `0xc2–0xdf → 2`,
`0xe0–0xef → 3`, `0xf0–0xf4 → 4`, anything else `1`, transcribed from `spike/src/engine.js:900-908`.

*Test:* `q0035-empty-range.js` E8, ported — it already pins `max_diff_bytes: 500` producing
`Patch truncated to \d+ UTF-8 bytes \(configured limit 500\)` — plus the new unit table. Byte
counts, never character counts: a character-count cut would violate the configured byte limit.

### AC-9 — The preflight walks every diff site once, in flow order, before the step loop

`preflightDiffs(context)` is called from `engine.ts` inside the run `try` (which opens at `:207`)
and before the step loop (which reads `flow.steps` at `:223`). It:

1. walks `flow.steps` in order, treating a `parallel:` group as its members;
2. collects each member's diff sites — the step's own `input.diff`, and for a `fan_out` step its
   `step:` template, labelled `<step.id>.step`, the same synthetic label
   `packages/core/src/lint/lint.ts:145` uses, so one flow file reads the same in both failures. A
   missing or falsey `input.diff` is not a diff site;
3. **judges a group's diffs against branches created strictly before that group** — a parallel
   sibling's branch is concurrent, not earlier;
4. skips a per-task **template** range that still contains an unresolved `{…}` placeholder after
   interpolation, because `harness/{id}/{task.id}` has no single value until `tasks.yaml` is
   expanded. Only a template can be in this state, so an outer step's unresolved range still fails
   here exactly as it always did;
5. records a range whose *either* endpoint is in the created-so-far map into `deferredDiffs` as
   `{ ref, step }` and materialises nothing (D-5);
6. otherwise materialises the range **once per distinct interpolated range** into `diffInputs`, so
   every panel member and every wave member receives the same bytes and one range costs one pair of
   git spawns. Keying by the written template instead would incorrectly combine per-task evidence;
7. after each group, remembers the branches that group creates — a `worktree` step's
   `branch ?? harness/<id>/<step.id>`, and an `integrate` step's `into` — keeping the **earliest**
   creator, so a deferred range can say who owed the branch;
8. stops the run on the first failing range, even when another distinct range was valid.

It runs identically under `--dry` and under a real run: there is no `if (dry)` branch in it and none
is added.

*Test:* `q0035-empty-range.js` E17's first half and `q0034-chore-preflight.js` C2/C3, ported. The
discriminating assertion available today is structural: `routing.ts:55-56`'s `runAgentStep` rejects
with `<id>: execution belongs to Q-0052`, so a run whose preflight correctly *failed* reports the
preflight's `FlowError`, while a run whose preflight wrongly *passed* reports the stub's message.
That distinguishes "the preflight fired before any step" from "the preflight was skipped" without an
adapter. **It is a proxy for E10's `adapterCalls === []` and the implement report must say so**; the
real assertion becomes available at Q-0052.

### AC-10 — The context carries the two maps, and a step receives the run's own object

`RunContext` (`packages/core/src/engine/types.ts:139`) gains two **required** fields with JSDoc:

```ts
diffInputs: Map<string, string>;
deferredDiffs: Map<string, DeferredDiff>;
```

`DeferredDiff` is `{ ref: string; step: string }`, declared in `diff.ts`. Both are constructed empty
in `engine.ts`'s context literal at `:194-205`. Required rather than optional because the context
handed to a step **is the run's own object, never a spread copy** — `types.ts:132-137` states this
and names Q-0051 to Q-0053 as the tickets that will rely on it — so what the preflight writes
survives into the steps that read it by contract rather than by accident. The spike's
`ctx.diffInputs?.get(…)` optional chaining (`spike/src/engine.js:720`, `:811`) exists for hand-built
test contexts; in `core` the type carries the guarantee and the optional chaining does not survive
the port. **No test in `packages/core` constructs a bare `RunContext` today**, so making the fields
required touches only `engine.ts`'s literal.

*Test:* a run over a flow with two steps sharing one `input.diff` range leaves exactly one entry in
`diffInputs`, observed through a `vi.spyOn(routing, 'runStep')` implementation that reads
`context.diffInputs` — the technique `engine.test.ts:245-282` already uses to prove the base anchor.

### AC-11 — The three interpolation sites coerce deliberately

`preflightDiffs` writes `String(site.input.diff)`, `String(s.branch ?? …)` and `String(s.into)` at
the three sites named in D-6, and `materialiseDiff` keeps its own `String(step.input.diff)`. The
reason lives in `loaders.ts:44-51`, which already states it, and is cited rather than transcribed.

*Test:* a flow whose `branch:` is the YAML number `2` reaches the same created-so-far key as the
string `"2"`, asserted through the deferral map. Not a type-only claim — the number is what YAML
actually hands back.

### AC-12 — Every preserved defect and deliberate addition is registered, with an authority line

`diff.ts` carries a `Why:` line at each site below, each classifiable by `q0050.source.test.ts`'s
`classifyAuthority`, and `diff.ts` is added as a key to that file's `REGISTERED` map at `:160` — a
register of identities, not a count, so a marker moved between files fails as loudly as one deleted.

| Site | Authority clause | What it records |
| --- | --- | --- |
| the `.find()` over both endpoints | `preserved defect, see Q-0038` | a range is deferred whole when either endpoint is step-created, so a pre-existing-class endpoint that simply does not exist is not checked (D-5) |
| the module note on the earliest-possible limit | `behaviour preserved from spike/src/engine.js` | "no adapter is billed before bad evidence is found" holds for pre-existing refs and cannot hold for a range this run creates |
| the base-attribution message | `preserved defect, see Q-0051 AC-12` | under `--base`, an unresolvable override is reported as `repo.base_branch in harness/harness.yaml names missing ref …` — R-1 below |
| the narrowed context type | `deliberate addition, not preservation` | the first narrowing context type in this folder; the two existing ones widen (D-2) |

The companion assertion at `q0050.source.test.ts:176` counts `preserved defect/` markers across the
folder with `toHaveLength(7)`. That number moves by however many this ticket adds, and the comment
above it — which enumerates Q-0050's own seven by AC — is extended rather than replaced, so the
arithmetic stays legible.

*Test:* `q0050.source.test.ts`'s `AC-13d` describes pass; deleting any one authority line fails
them, and so does adding an unregistered one.

### AC-13 — The preflight is the earlier of the two `flow.steps` dereferences, and restores the spike's message

In the spike there are two reads of `flow.steps` and the preflight is the first: `:88` binds
`const steps = flow.steps` and `:120` iterates `flow.steps`, which is what throws —
`flow.steps is not iterable`. `core` today throws from `steps.length` at `:225` instead:
`Cannot read properties of undefined (reading 'length')`. Verified on node: the message names the
expression, so the preflight must iterate **`flow.steps`**, not a local binding, or the message
changes again.

That first line is what `failureMessage` (`engine.ts:92-95`) truncates into the terminal note, the
`runs.log` line and the terminal event, so it is externally observable under charter §2.
`engine.ts:220-222`'s existing `Why:` line, which preserves the uncoalesced read, stands unchanged
and the preflight adds no coalescing of its own.

*Test:* a run over a flow with no `steps` key fails with a `TypeError` whose message names iteration
of `flow.steps`, and the terminal event's note matches it. No frozen contract pins this string —
`contracts/Q-0050/run-messages.fixture.json` has no entry for it — so this adds a test rather than
changing one.

### AC-14 — The package boundary is unchanged, and what was skipped is reported as skipped

- `packages/core/src/index.ts` stays byte-identical to `export const name = '@quorum/core';\n`.
  This ticket adds no public re-export; its only declared dependent, Q-0052, is in the same package
  and imports `./diff.js` directly. `git.source.test.ts` already pins this file and is the
  precedent.
- No new dependency in `packages/core/package.json`; no new configuration field, file format or
  zod schema. `input.diff` is already in `packages/shared`'s flow schema and `max_diff_bytes` in
  `project.ts:74`.
- `packages/core/turbo.json` needs no new entry: it already declares `../../spike/src/**`,
  `../../backlog/*/ticket.md`, `../../harness/flows/*.yaml` and `../../docs/DECISIONS.md`. If a new
  test opens a path outside them, it is declared in the same change and
  `src/turbo-inputs.test.ts`'s registers (`READ_BASES`, `NOT_READ`) are updated rather than the
  guard weakened.
- **The implement report states, in a table, which frozen scenarios this ticket closed and which it
  could not** — the table below, or a corrected version of it if the implementer finds it wrong.
  Reporting nine of seventeen as coverage of seventeen is the failure invariant 11 exists to name.

*Test:* `packages/core/src/index.test.ts`, `corpus.test.ts` and `turbo-inputs.test.ts` pass; after
`pnpm install --frozen-lockfile` and `npm install --prefix spike` in the worktree — which has no
dependencies until they are installed (`harness/rules.md`) — `pnpm lint`, `pnpm typecheck`,
`pnpm turbo run test --force` and `npm test --prefix spike` all pass, the spike suite unmodified.

---

## Coverage this ticket cannot close

Stated rather than implied, because the alternative is a report that counts seventeen scenarios and
delivers nine. Each row was determined by reading the scenario.

| Frozen scenario | Closable here | Why not |
| --- | --- | --- |
| E1–E8, E13 (`q0035`) | **yes** | direct `materialiseDiff` calls against throwaway repositories |
| E9, E14 (`q0035`) | no — already done | the static twin is Q-0044's, landed at `lint/lint.ts:110-152` |
| E10 (`q0035`) | **partly** | the guard and diagnosis halves port; "zero adapter invocations" is provable only structurally through the Q-0052 stub (AC-9) |
| E11, E15, E16 (`q0035`) | **partly** | the *message* halves port as unit tests over a hand-built `deferredDiffs`. The step-time failure runs through `buildPrompt`'s fallback (Q-0052) and needs a worktree step (Q-0053), so the *ordering* claim — the producing adapter ran, the consuming one did not — does not port |
| E12 (`q0035`), C1b (`q0034-chore-preflight`) | **partly** | the `--dry` placeholder text lives in `buildPrompt` (Q-0052). What ports is the preflight half: under `--dry` a deferred range is deferred and not failed, observed by the run reaching the Q-0052 stub rather than a missing-ref `FlowError` |
| E17 first half (`q0035`) | **yes** | a bad `fan_out` template range fails before the step loop |
| E17 second half (`q0035`) | **no** | one materialisation reaching every wave member byte for byte needs fan-out (Q-0053) |
| C1 (`q0034-chore-preflight`) | **no** | runs a chore-shaped flow end to end |
| C2, C3 (`q0034-chore-preflight`) | **yes** | preflight failure before any step; guard rejection |
| D1, D2 (`q0034-dry-run`) | no — not this module | the dry-run ticket-immutability claims are Q-0050's, already ported |
| B1–B4 (`q0077-base-flag`) | **yes** | direct `materialiseDiff` calls |
| B5 (`q0077-base-flag`) | **no** | drives the CLI; stays with the spike until Q-0010 |

**All seventeen `q0035` scenarios, all five `q0077` scenarios, all four `q0034-chore-preflight`
scenarios and both `q0034-dry-run` scenarios stay green on the spike throughout.** The freeze
(charter §3) forbids touching `spike/`, and the witness is the whole proof.

---

## Non-goals

1. **Fixing any defect found while reading the spike** (charter §2), including the three under
   *Reported, not fixed*. Reported in the implement report, never fixed in passing.
2. **Q-0038's endpoint-class validation** (D-5). The `.find()` ships unchanged, registered.
3. **Another child's module.** No edit to `git/`, `lint/`, `fanout/`, `run-history/`, `backlog/`,
   `adapters/`, `contracts/` or `packages/shared`. The edits outside `diff.ts` are `engine.ts` (call
   site and context literal) and `types.ts` (two fields) — both Q-0050's files, both authorised by
   `types.ts:132-137` in as many words — plus the three pin edits AC-1 and AC-12 require in
   `q0050.source.test.ts`.
4. **Unifying `diffSitesOf` with `lint.ts`'s `diffSites`**, and making `flattenSteps` descend into a
   fan-out template. They answer different questions over different inputs.
5. **Editing `spike/**`**, including its tests, or deleting the spike.
6. **`buildPrompt`, agent, gate and script steps** (Q-0052); **fan-out and integrate** (Q-0053); the
   cutover; the `quorum` binary (Q-0010); persisting the event stream; budget enforcement.
7. **Any public re-export from `packages/core/src/index.ts`.**
8. **A `DEFAULT_MAX_DIFF_BYTES` constant in `packages/shared`** (D-7).
9. **Adding, changing or documenting `harness run --base`.** Q-0077's shipped behaviour is preserved
   here, not extended.
10. **Changing the three merge-source sites that read `config.repo.base_branch`.**
11. Anything on v1's exclusion list: multi-user, remote daemon, cloud sync, plugin marketplace,
    visual node canvas, eval suites, Gemini adapter, desktop shell.

---

## Reported, not fixed

Charter §2 requires these named and left alone. Written out in full here, because a deferred
obligation dies unless it is written into a ticket body.

**R-1. Under `--base`, an unresolvable override is blamed on a file that does not name it.**
`spike/src/engine.js:829` throws `repo.base_branch in harness/harness.yaml names missing ref
"<base>"` when the left endpoint equals `base`, and `base` is `ctx.vars.base` — the override when
one was given. So `harness run review Q-0051 --base 0f1e40d` against a SHA that does not resolve
sends the maintainer to `harness/harness.yaml`, which is not where the value came from. Q-0077
shipped `--base` on 2026-08-29, after this message was written for Q-0035, and the two never met.
The fix is one branch on whether an override is in force plus a phrase naming `--base`; it lands in
`spike/src/engine.js` and `packages/core/src/engine/diff.ts` together — the Q-0066/Q-0068 shape —
and it changes a message three frozen fixtures match by substring, so it needs its own requirement.
**Successor ticket to open at this gate.**

**R-2. `packages/shared/src/flow.ts:381` cites pre-Q-0077 line numbers** (`spike/src/engine.js:83,
:115`; now `:88, :120`). A comment, in Q-0041's module. Worth a one-line correction in whatever
ticket next touches that file; not worth its own.

**R-3. The `200000` diff cap is spelled twice already** — `spike/src/engine.js:836` and
`packages/shared/src/project.test.ts:97` — and this port makes it three (D-7).

**R-4. The transcription corpus does not cover this ticket's body** (D-8), by decision. Whichever
ticket next widens that scan should re-weigh it once `diff.ts`'s comments have landed and the
collision risk can be measured rather than predicted.

---

## Open questions

| # | Question | Owner | Blocking? |
| --- | --- | --- | --- |
| OQ-1 | Is AC-9's structural proof — "the preflight fired, because the failure is the preflight's and not Q-0052's stub" — an acceptable stand-in for E10's `adapterCalls === []`? **Ruled: yes, and the report must call it a proxy.** It proves ordering without an adapter, which is the property invariant 11 cares about, and the real assertion lands at Q-0052. | ruled here | no |
| OQ-2 | Does the implementer find a *third* pair of guards written by different tickets that neither knew about? AC-1 names two (the folder pin, the `merge-base` token). The cheap answer is R-C's probe below, before the first implement round. | implementer, reported at review | no |

Every other question either candidate raised is ruled in *What this requirement settles* (D-1
module, D-2 name and context, D-5 Q-0038, D-7 the constant, D-8 the corpus). **Nothing here blocks
solutioning.** No criterion changes a file format, the adapter contract, the flow schema or a
shipped flow, and no criterion depends on a decision entry that does not yet exist — which is the
precondition that cost Q-0070's requirements run two refusals and an exhausted loop.

---

## Risks

**R-A. The reviewer approves the change it asked for.** Q-0049's most durable finding, and Q-0050's
six rounds are the evidence: a review loop cannot police charter §2 on its own. Every criterion
above that says *preserved* is one a reviewer may ask to "improve". The remedy is an erratum in
`requirements/errata.md`, written **during the loop as soon as the contradiction is provable**, not
at the exhaustion gate — *"A reviewer approves the change it asked for"* (2026-08-29).

**R-B. A check that cannot fail.** Rounds 4 to 6 of Q-0050 produced five assertions that could not
fail. AC-1b is the one most at risk here, because the natural way to write it — assert `diff.ts`
does not contain a token — passes over a file that does not exist. Demonstrate each new guard
failing over the real violation before trusting it green.

**R-C. Two guards written by different tickets, neither knowing the other.** Before the first
implement round, run the whole workspace suite forced with an empty `diff.ts` present in the folder.
That is cheap and it surfaces every landed pin the new file trips, without spending a review round
on it.

**R-D. Caching by the wrong key.** Materialising at each prompt site would give panel members
evidence resolved at different moments and multiply git work; keying by the written template rather
than the interpolated range would combine per-task evidence that is not the same range. AC-9.6 is
the criterion, and the two-steps-one-range test is what discriminates.

**R-E. Diagnostic overclaim.** Treating git's exit 1 as conclusive in a shallow repository, or
catching every ancestry failure as `false`, turns an indeterminate result into a false historical
claim — the defect Q-0035 removed. AC-6's single route through `emptyRangeEvidence` is what prevents
its return.

**R-F. The line numbers move again.** Q-0077 shifted this file by five between the ticket body being
written and this document. Every number here was re-read on 2026-08-30 and is stated with its file.

**R-G. Cost.** Q-0050 cost $131.03 across eight runs; Q-0049 cost $52.34 across three implement
rounds. This module is smaller than either but denser in decisions. Charter §9's third threshold —
more than three chore runs means the child was cut wrong — applies.

---

## Cross-cutting checklist

| Concern | Answer |
| --- | --- |
| **BYOS** | n/a to the code. No adapter is constructed, no environment variable read, no key path added in source, test or fixture. The preflight's entire purpose is to run *before* any adapter. |
| **Worktree safety** | n/a — this ticket creates no worktree and no branch. It reads git and writes one `runs.log` line. It writes nothing to the user's working tree. |
| **Gate behaviour** | Unchanged. `askGate` and the exhaustion gate are `routing.ts`'s (Q-0050). A preflight failure is not a gate; it stops the run, and `engine.ts`'s existing catch gives it the same terminal record as any other error — which is why AC-9 places it inside the run `try`. |
| **File format and schema** | No format or schema changes. The only new persisted content is the existing truncation log line, on runs that truncate. |
| **Lint rules** | No new lint rule. The static twin of AC-3's guard is Q-0044's `validDiffRange` (`lint/lint.ts:110-127`) and already ships. A flow the engine accepts must pass lint, and a flow lint rejects would have failed at step time anyway — after an adapter was billed. |
| **Cold-clone impact** | None. No CLI surface, no README step, no new command, no new dependency. |
| **Product-agnostic** | No reference to any SaaS product. |
| **Errors are explicit** | The ticket's subject. Nothing defaults silently; a check that declines to examine something says so, in the message (AC-5) and in the report (AC-14). |
| **Vocabulary** | contained / not contained / indeterminate, per **Containment**. Never merged, landed, shipped, rebased, cherry-picked or reset (AC-6). **preflight**, **dry run** and **base override** as the glossary defines them; no new term, so `docs/GLOSSARY.md` is unedited. |

---

## Decisions cited

- *The port takes the chore route, except the one child that has new behaviour* (2026-08-25) — the route.
- *The port preserves behaviour; one exception is authorised and everything else stops the child* (2026-08-25) — D-5, D-6, R-1, the non-goals.
- *The erratum is closed: the sentence was true, and it was still the wrong sentence* (2026-08-25) — invariant 10, AC-6.
- *Q-0035 accepted: a check that skips its subject must not report success* (2026-08-25) — invariant 11, AC-5, AC-9, AC-14.
- *Containment is derived from git on each board invocation, never stored* (2026-08-24) — invariant 8, AC-6's single route through `emptyRangeEvidence`.
- *Q-0034 closed: an unlanded branch's cost is not its merge conflict* (2026-08-24) — the guard's shape, AC-3.
- *A reviewer approves the change it asked for* (2026-08-29) — R-A.
- *A check is not established by reading it* (2026-08-29) — AC-1b, R-B, R-C.

---

## Provenance

**Structure and the majority of the criteria come from candidate-claude.** It is the stronger
document: it settles the six decisions the ticket body delegates instead of listing them, and two of
its findings would otherwise have been discovered in review rather than before it — the
`q0050.source.test.ts` folder pin, and the `merge-base` token in `git.source.test.ts`, where a
comment ported verbatim turns another child's landed suite red for a token appearing in prose
explaining why the token is allowed. Its *"Coverage this ticket cannot close"* table is invariant 11
applied to the requirement itself and is adopted whole, corrected. AC-1, AC-2, AC-4 to AC-9, AC-12,
AC-13 and AC-14 are substantially its work, as are D-1 to D-7, R-1 to R-3 and risks A, B, C and F.

**Candidate-codex contributed criteria the other left implicit, and they are merged in rather than
averaged.** Its AC-9 gave AC-3 its sharpest clause — the guard refuses *before* any git command runs,
which is testable and which candidate-claude only implied. Its AC-8 gave AC-9.8: a failing range
stops the run even when another distinct range was valid. Its AC-13 gave AC-6 the indeterminate
branch's explicit "git could not answer, and nothing further is claimed". Its AC-17 and AC-19 gave
AC-8 the "no new wrapping, escaping or normalisation" clause and the invalid-lead-byte row. Its
non-goals list is more complete on configuration, dependencies and CLI surface, and its risk list
contributed R-D (caching by the written template) and R-E (diagnostic overclaim). Its user-story
form is the one used here.

**Where they disagreed, this document picks.**

- *The Q-0038 blocker.* Codex made it a blocking question for ruud; claude ruled it preserved.
  **Claude is right and the ruling is made here**: the 2026-08-25 charter entry already answers it,
  so no decision entry is owed and nothing blocks. The sequencing constraint is added explicitly
  (D-5), because a blocker converted to a ruling should leave the hazard visibly closed rather than
  merely dismissed.
- *Adapter-call counts.* Codex's AC-21 requires tests to demonstrate them rather than infer billing
  order. **Struck as untestable in this ticket** — `routing.ts:55` makes `runAgentStep` a stub that
  rejects, so no adapter can be called and no count is observable. Claude's structural proxy is
  adopted, with the honesty requirement that the report call it a proxy (AC-9, OQ-1).
- *Size.* Codex's 23 criteria and claude's 14 merge to 14, one below the cap. Claude's two
  source-guard criteria (its AC-1 and AC-12) are folded into one; nothing else was dropped for count.

**Four factual corrections, made against the files rather than against either candidate.**

1. The deferral `.find()` is at `spike/src/engine.js:133`, not `:132` (claude) and not `:118`
   (ticket body). The group loop is `:120`; the block spans `:91–142`.
2. `RoutingContext` (`types.ts:197`) and `LifecycleContext` (`:214`) **extend** `RunContext` — they
   widen, they do not narrow. Claude's D-2 cited them as a narrowing precedent; there is none, so
   the narrowed diff context is ruled in as a deliberate addition and carries that authority clause
   (D-2, AC-12).
3. `coreSourceFiles()` excludes `*.test.ts`, so the `merge-base` guard scans production files only
   and a test may assert the token freely. That bounds AC-1b to the source comment.
4. `q0050.source.test.ts`'s register at `:160-171` is a `toStrictEqual` keyed by file, so extending
   the folder array alone is not enough — `diff.ts` must become a key. Claude's AC-11 has this;
   codex's AC-1 and AC-20 do not.

Two further checks were run so the implementer does not have to: no test in `packages/core`
constructs a bare `RunContext`, so making the two fields required touches only `engine.ts`'s literal
(AC-10); and `contracts/Q-0050/run-messages.fixture.json` pins no missing-`steps` message, so AC-13
adds a test rather than changing a frozen contract.
