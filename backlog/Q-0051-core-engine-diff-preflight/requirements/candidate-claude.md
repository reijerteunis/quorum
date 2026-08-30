# Q-0051 — `core/engine`: diff preflight and materialisation

*Requirement, 2026-08-30. Written against `main` at `0f9d688`, which is `a8ddbe3` (Q-0038's merge)
plus three documentation commits. Run 1's `requirements/merged.md` is archived under
`requirements/archive/run-1-aborted/` and is **superseded, not amended** — this document is the
subject of the chore run.*

**Every line number here was read from the file, not inherited.** The ticket body's own warning is
correct and it applies to the body too: three of its numbers were stale by the time I checked them,
and they are corrected in place below. Where this document disagrees with the ticket body, the
disagreement is called out rather than resolved silently.

---

## Problem

The `maintainer` runs a review flow and pays two vendors to read a diff. In M1 that diff did not
exist: Q-0006's review spent $5.02 of Claude cost plus an unpriced Codex reviewer on an empty range,
`materialiseDiff` embedded the emptiness without noticing, and the flow would have advanced on the
verdict. It stayed invisible because the reviewers compensated — they read the working tree instead
of the evidence handed to them and produced eleven substantive findings anyway, three of them real.
The mechanism that was supposed to make them right was broken, and its being broken was undetectable
from the outcome.

Three tickets have since bought the fix, and the receipts are the reason this port is delicate:

- **Q-0034** built the run-level preflight, so a bad ref is found before an adapter is billed, and
  fixed the range guard the chore flow's `integration...implement` shape had broken.
- **Q-0035** ($36.66) replaced a diagnostic that asserted a historical event — *"is already merged
  into"* — with one that quotes evidence: both endpoints, the short SHA each resolved to, the
  containment check verbatim, and its outcome as one of `contained` / `not contained` /
  `indeterminate`. It also established the rule this ticket inherits as invariant 11: *skipped is not
  passed*.
- **Q-0038** ($37.46, merged 2026-08-30 at 10:41) found that the preflight asked one question of a
  whole range when the unit that can be absent is an **endpoint**. One modelling error had produced
  three defects in eighteen lines. It now classifies each endpoint on its own, defers only what is
  genuinely not due, and proves every endpoint that *is* due at run start.

That is 273 lines in `spike/src/engine.js`, of which 148 are code. The rest is comment weight three
tickets paid for, and it is load-bearing: it is the only record of why each of these shapes is the
one that survived.

**The port's risk is not that the code is hard. It is that a rewrite is a tempting place to tidy.**
The charter states the reason precisely (§2): the port's only proof is that the ported tests still
describe the ported code, and a quiet fix breaks that proof invisibly — the spike stays green because
it still has the old behaviour, the workspace stays green because it was ported from a tree that has
the new one. Both green, the product wrong.

---

## User stories

**`maintainer` — the one who pays for the run.**
> I run `harness run review Q-0051`. If a branch the review needs does not exist, or the range it
> would read is empty, I want the run to stop **before** it bills an adapter, and I want the failure
> to tell me which ref, what it resolved to, what check ran and what that check answered — so I can
> re-check it tomorrow after the tips have moved. If the preflight *could not* examine something, I
> want it to say so rather than pass quietly.

**`maintainer` — reviewing a ticket that already landed.**
> My branch is contained in `main`, so the configured range is empty and the ticket is unreviewable.
> I pass `--base 99eb28c`. That must move the diff anchor and **nothing else** — if it changed what
> `integrate` merges from, I would be writing an old revision into my ticket's branch. And if the
> revision I typed does not resolve, the failure must blame **my flag**, not a configuration file
> that never supplied the value.

**`contributor` — reading `packages/core` to write an adapter or a flow.**
> I want the diff subsystem to be one named module with a documented contract, so I can see where a
> diff comes from without reading a 1,200-line engine — and so that when I break the range guard, a
> test tells me which rule I broke and why it exists.

**`adopter` — the cold clone.**
> Nothing here should lengthen my first thirty minutes. This is internal machinery; my first run
> either works or fails with a message I can act on.

---

## Surfaces

| Surface | Touched | How |
| --- | --- | --- |
| **`packages/core`** | **yes** | one new file `src/engine/diff.ts`; two Q-0050 files edited (`engine.ts`, `types.ts`); three pin edits in `src/engine/q0050.source.test.ts`; new tests |
| **CLI** (`quorum` / `harness run`) | indirectly | the failure text a maintainer reads is produced here; no argument, flag or exit code changes |
| **`harness/`** | no | no flow, role or `harness.yaml` change |
| **`backlog/`** | read + one line | `runCommand`-style artifacts unchanged; the truncation notice appends one line to `runs.log` exactly as the spike does |
| **`spike/`** | **frozen** | charter §3 — not modified, not deleted. It is the witness |
| **daemon / web UI** | no | M3 |

---

## What this requirement settles before the implementer starts

The ticket body delegates one decision explicitly (*"The requirement decides whether the diff
subsystem is a new module or goes into an existing one, and says so"*) and inherits four obligations.
Reading the code raised five more. All are ruled here so none is discovered in review.

### D-1. The diff subsystem is a new module, `packages/core/src/engine/diff.ts`

Not folded into `engine.ts`, which is 310 lines and already composes six concerns; not into
`loaders.ts`, which is pure readers over the filesystem with no git and no run context. The subsystem
owns one behaviour Q-0052 calls from a second call site (`buildPrompt`'s fallback at
`spike/src/engine.js:740-742`), and it spawns `git` — a property none of the six existing files has.

**The consequence is part of this change, not a surprise found in review**, and it is larger than the
ticket body says.

### D-2. There are **three** hard-coded file lists in `q0050.source.test.ts`, not two — and the third fails open

The ticket body names two pins, the folder array at `:82` and the file-keyed register at `:160`.
There is a third, and it is the dangerous one:

| Site | Shape | How it fails when a 7th file lands |
| --- | --- | --- |
| `:82` | `expect(production).toStrictEqual([… six names …])` | **fails closed** — red immediately, impossible to miss |
| `:134` | `const all = ['channel.ts', 'engine.ts', 'lifecycle.ts', 'loaders.ts', 'routing.ts', 'types.ts'].map(source).join('\n')` | **fails open** — stays green while silently no longer examining `diff.ts` |
| `:160` | `REGISTERED` map, compared `toStrictEqual` | **fails closed** — any `Why:` line in `diff.ts` fails until `diff.ts` is a key |

`:134` is a literal array where every other test in the file derives from `production`. So the AC-9d
guard — *no engine helper resets or deletes task branches* — would keep reporting green over six
files while the seventh went unscanned. That is precisely the class Q-0050 spent six review rounds
on and named in a decision: *"A check is not established by reading it"* (2026-08-29) — a check blind
to its own subject. **`:134` must be changed to derive from `production`, not extended by hand**, so
that Q-0052's and Q-0053's files are covered without anyone remembering.

There is a fourth number: `:176` asserts `toHaveLength(7)` over `preserved defect/` markers across
the folder. It moves by however many this ticket adds (AC-12).

### D-3. `preflightDiffs` is the name; `materialiseDiff` takes a narrowed context

Exported from `diff.ts`: `preflightDiffs(context)`, `materialiseDiff(step, context)`,
`trimIncompleteUtf8Suffix(bytes)`. Module-private: `named`, `diffSitesOf`, `classifyEndpoints`,
`notDueClause`, `missingEndpointFailure`, `emptyRangeFailure`. Nothing is re-exported from
`packages/core/src/index.ts` (AC-14).

**preflight** is already the glossary's word for exactly this pass. The spike's block is anonymous;
naming it is internal layout, which charter §2 explicitly does not preserve.

`materialiseDiff` takes a **narrow context type declared in `diff.ts`**, structurally satisfied by
`RunContext`, reading exactly `repoDir`, `config`, `vars`, `ticket`, `baseOverride`, `deferredDiffs`
and `persistence.appendLog`. This is what lets the diagnostic be tested against a throwaway
repository without constructing a run — which is how all seventeen `q0035-empty-range.js` scenarios
and all nine `q0077-base-flag.js` call sites are built, and it is why those suites can port at all.

Note it is a **deliberate addition, not a preservation**: `RoutingContext` (`types.ts:197`) and
`LifecycleContext` (`:214`) both `extends RunContext` — they widen. There is no narrowing precedent
in this folder, so this carries the `deliberate addition, not preservation` authority clause (AC-12)
rather than a claim of precedent. Its compile-time proof is the call site: `engine.ts` hands
`preflightDiffs` the whole `RunContext` and it typechecks.

`trimIncompleteUtf8Suffix` is exported for how it arrived. Q-0049's body listed it among run
history's functions, which it is not; it begins two lines after `emptyRangeFailure` closes at `:983`,
so a range-based port takes everything except this one. It was nearly lost to adjacency. It gets its
own export and its own table-driven test so a future deletion is loud.

### D-4. `RunContext` gains **three** fields, not two — and the third is load-bearing

The ticket body's inherited item 3 names `diffInputs` and `deferredDiffs`. **It misses
`baseOverride`, and `grep -rn baseOverride packages/` returns nothing at all.**

`spike/src/engine.js:55` sets `baseOverride: base ?? null` on the run context, and `:864` is the only
reader:

```js
return new FlowError(ctx.baseOverride != null
  ? `--base names missing ref "${ref}" — ${tail}`
  : `repo.base_branch in harness/harness.yaml names missing ref "${base}" — ${tail}`);
```

`packages/core/src/engine/engine.ts:124` destructures `base` from the options and uses it at `:137`
for `vars.base` and **nowhere else**. So a port that carries only the two maps compiles, passes
typecheck, and silently reverts Q-0038's `--base` attribution fix to the wording that sends a
maintainer to a file which never supplied the value — which is the exact defect Q-0038 shipped
`engine.js:864-866` to close.

`vars.base` cannot substitute for it, and the comment at `spike/src/engine.js:51-54` says why: it is
set either way, and an override may legitimately name the configured value. The attribution keys on
**whether the flag was typed**, never on whether its value differs. `q0077-base-flag.js` B6 asserts
all three arms of this — flag-given, flag-given-with-identical-value, and field-absent.

**Ruled:** `RunContext` gains `baseOverride: string | null`, assigned `base ?? null` in `engine.ts`'s
context literal at `:194-205`, immediately below the existing `vars` construction so the two read
together.

### D-5. Q-0038's endpoint model ports as it stands — there is no `.find()` left to preserve

Run 1's D-5 ruled the wholesale `.find()` over both endpoints a preserved defect and gave it a
register row. **Both die here.** Q-0038 deleted the `.find()`; there is no defect left to register.
What ports instead is the three-class model, and it is normative:

| Class | Meaning | Preflight action |
| --- | --- | --- |
| `step-created` | an **earlier group of this flow** creates the ref | range deferred to step time — *true even when the ref already exists at run start*, because bytes captured before its producer ran are that step's **previous** output |
| `template` | a `fan_out` step's `step:` template naming a per-task variable | not resolvable until `tasks.yaml` expands; **only** a template may be in this state |
| `pre-existing` | everything else, **including a ref only a LATER step creates** | resolved now, at run start, where it costs nothing |

Two consequences the model makes non-obvious and that a "simplification" would destroy:

1. **A range is deferred *and* partially proven.** A range holding one `step-created` endpoint is
   recorded in `deferredDiffs`, and its other endpoint is still checked at run start. Asking one
   question of the whole range is what let a knowably-absent integration branch bill an implementer
   first and fail afterwards.
2. **A ref created only by a *later* step is `pre-existing` on purpose.** Deferring it would move the
   failure past a billed step — exactly what the preflight exists to prevent.

Authority: *"A range is checked one endpoint at a time, because an endpoint is what can be absent"*
(2026-08-30). Cite it; do not re-argue the model.

`classifyEndpoints` returns `[]` for a range that is not exactly two endpoints, and the caller sends
it unchanged to `materialiseDiff`'s shape guard. That is deliberate — classifying the parts of a
malformed range answers a different question — and it is why `preflightDiffs` must not treat an empty
classification as "nothing to check".

### D-6. The `merge-base` trap is **two tokens with opposite requirements**

The ticket body calls this *"the `merge-base` token in `git.source.test.ts` that a verbatim comment
port would trip"*. It is two tokens, and conflating them breaks one or the other:

| Token | Where | Rule |
| --- | --- | --- |
| `` `merge-base` `` (hyphenated) | `spike/src/engine.js:948`, in a **comment** | **must not appear in `diff.ts`.** `git.source.test.ts:35-45` iterates *every* file `coreSourceFiles()` returns and asserts `merge-base` and `--is-ancestor` appear in `git/git.ts` and nowhere else. A verbatim comment port turns another module's landed suite red |
| `merge base` (spaced) | `spike/src/engine.js:971`, in a **runtime string** — `` `${right} adds nothing since its merge base with ${left}.` `` | **must survive byte-for-byte.** It is asserted output (`q0035-empty-range.js` E3) and invariant 10's evidence wording |

The comment at `:947-949` exists to explain why the spaced form is allowed past the *vocabulary*
rule. In `core` that explanation must be reworded to make its point without the hyphenated token —
e.g. naming it as *the command git spells with a hyphen* rather than spelling it. A comment is not
behaviour (charter §2), so rewording is free; the string is behaviour and rewording it is a defect.

A third token sits nearby: `spike/src/engine.js:937`'s comment contains `merged into`, quoting the
message Q-0035 replaced. No guard in `core` catches it — `git.source.test.ts:93-99`'s synonym scan is
scoped to `containment.ts` and `git.ts` only — but carrying the discarded vocabulary into the file
whose whole purpose is to not use it is worth avoiding. **Non-blocking; the implementer's call.**

### D-7. The range guard reuses `ticketBranchPrefix`, and shares no constant with the lint

`packages/shared/src/constants.ts:89` exports `ticketBranchPrefix(ticketId)`, and
`packages/core/src/lint/lint.ts:109` already calls it as `ticketBranchPrefix('{id}')`. The runtime
guard calls it as `ticketBranchPrefix(ctx.ticket.meta.id)`. The spike hard-codes
`` `harness/${ctx.ticket.meta.id}/` `` at `:883` and `` `harness/${ctx.ticket.meta.id}/integration` ``
at `:855`; taking the shared helper is internal layout, and `git.source.test.ts:64-79` sets the
precedent that a naming rule belongs in `shared`.

**And the obvious next step is wrong.** `lint.ts`'s `BASE_ENDPOINT = '{base}'` and
`TICKET_ENDPOINT_PREFIX = ticketBranchPrefix('{id}')` are **pre-interpolation** templates. The runtime
guard compares **post-interpolation** values — `main`, `harness/Q-0051/`. They are the same *rule* at
two different moments, not the same *constants*, and neither is exported. Sharing the function is
right; hoisting the constants would make the lint and the guard agree on a string neither of them
should be comparing. Register row 12 calls them twins because they enforce one rule in two places —
that is the invariant, not a request to merge them (see NG-4).

### D-8. The truncation log line goes through `persistence.appendLog`

`spike/src/engine.js:926` writes `ctx.backlog.log(...)`. In `core`, `appendLog` is the seam every
write already goes through (`engine.ts:157` delegates it to `backlogView.log`). Behaviour is
identical in both modes: under `--dry`, `backlogView` is `readOnlyBacklog` (`engine.ts:38-44`), whose
`log` is a no-op, exactly as the spike's is. Layout, not behaviour.

### D-9. Two things that stay exactly as they are

- **The two `git diff` spawns stay inside `diff.ts`** and are not routed through `git/git.ts`.
  Invariant 8 governs *ancestry*, which is already routed correctly through `emptyRangeEvidence`
  (`git/git.ts:168`). A patch and a stat are not ancestry, and adding a ninth export would break
  `git.source.test.ts:28-31`'s eight-function pin — another child's landed guard, for a refactor
  nobody asked for.
- **The `200000` cap stays a literal in `diff.ts`.** It is already spelled at
  `spike/src/engine.js:921` and `packages/shared/src/project.test.ts:97`; the port makes it three.
  Promoting it edits Q-0041's module for a value this ticket does not change, and
  `packages/shared/src/index.test.ts` pins the exported constant list. Registered under *Reported, not
  fixed*.

### D-10. Q-0051's ticket body is **not** added to the transcription corpus

`q0050.source.test.ts:187-190` scans authority lines against `docs/DECISIONS.md` and Q-0050's ticket
body. Widening it to Q-0051's body would be the guard doing the opposite of its job: this ticket body
deliberately quotes the spike comments `diff.ts` must preserve — *"no adapter is billed before bad
evidence is found"*, the *skipped is not passed* sentence, the guard's own wording — so the scan
would fire on a faithful port and pressure the implementer to paraphrase evidence three tickets paid
for. **Ruled: no.** Registered as a reported item for whichever ticket next touches that scan.

---

## Acceptance criteria

Fourteen, each independently testable. Size was weighed against the 2026-08-22 sizing decision:
fourteen is at the upper end and is accepted because the seams are already cut — `buildPrompt`, agent,
gate and script steps are Q-0052; fan-out and integrate are Q-0053 — and because splitting the guard
from the diagnostic would put two tickets inside one function. Most of the work is the ported test
suite, not the ~160 lines of code.

### AC-1 — The module exists and passes every landed source guard, including two in other modules' suites

`packages/core/src/engine/diff.ts` exists and is the only file this ticket adds to that folder. All
of the following hold:

1. `q0050.source.test.ts:82` lists seven files in sorted order.
2. `q0050.source.test.ts:134`'s hard-coded array is **replaced by `production`** (D-2), so the AC-9d
   scan covers `diff.ts` and every file Q-0052 and Q-0053 add.
3. `diff.ts` is a key in the `REGISTERED` map at `:160` (AC-12), and `:176`'s count is corrected.
4. Every `export` in `diff.ts` carries its own JSDoc **anchored on the export**, not on the file.
5. `diff.ts` matches none of `console.`,
   `process.(stdout|stderr|exit|on|once|addListener|prependListener|prependOnceListener)`, an ANSI
   escape, or an import from `spike/`.
6. **`diff.ts` contains neither `merge-base` nor `--is-ancestor`** (D-6), so `git.source.test.ts:35`
   stays green.
7. No comment line reproduces a ≥40-character sentence of `docs/DECISIONS.md` or of Q-0050's body.

*Test:* `q0050.source.test.ts` and `git.source.test.ts` pass unmodified except for the three
authorised pin edits. **Demonstrate (2) rather than assert it:** with `:134` derived from
`production`, inserting `resetTaskBranch` into `diff.ts` must turn AC-9d red — under the hard-coded
array it stays green, which is the finding.

### AC-2 — The exported contract is exactly three symbols over a narrowed context

`diff.ts` exports `preflightDiffs`, `materialiseDiff`, `trimIncompleteUtf8Suffix` and nothing else.
The six helpers of D-3 are module-private. `materialiseDiff`'s context parameter is a narrow type
declared in `diff.ts`, structurally satisfied by `RunContext`.

*Test:* an `Object.keys(import * as diff)` pin, in the shape `git.source.test.ts:28-31` uses. A
compile-time proof that `RunContext` satisfies the narrow type: `engine.ts`'s call site typechecks,
and a `@ts-expect-error` over a context missing `deferredDiffs` does not.

### AC-3 — The range guard is not relaxed, names the base it was given, and refuses before any git runs

Both endpoints must be `ctx.vars.base` or start with `ticketBranchPrefix(ticket.meta.id)`. A range
that is not exactly two `...`-joined non-empty endpoints, or either of whose endpoints is out of
class, throws a `FlowError` naming the base it was actually given, the ticket prefix, and the range
as interpolated. **The refusal happens before any `git` process is spawned** — a range aimed at an
unrelated ref costs nothing.

*Test:* `q0035-empty-range.js` E6/E7 and `q0034-chore-preflight.js` C3, ported. The "before any git"
half is provable by injecting a spawn counter through the narrowed context, or by pointing the range
at a ref in a directory that is not a repository at all.

### AC-4 — `--base` moves the diff anchor and nothing else

`ctx.vars.base` is the guard's notion of the base and the value `{base}` interpolates to.
`materialiseDiff` resolves it from `ctx.vars.base ?? ctx.config.repo?.base_branch ?? 'main'` and
**never re-reads `config.repo.base_branch` in preference to it**. The three merge-source sites
(rework sync, `integrate`'s sync, the evidence note) are not this ticket's and do not move.

*Test:* `q0077-base-flag.js` B1–B4 and B6, ported as direct `materialiseDiff` calls. The
discriminating case is B2: with `--base` set to a revision *before* the ticket's work, the range is
non-empty; `config.repo.base_branch` is unchanged in the same context object. A port that resolves
`base` from config inside `materialiseDiff` silently undoes Q-0077 and every other test stays green
— which is why this AC is separate from AC-3.

### AC-5 — An unresolvable endpoint fails with the evidence that exists, and attributes correctly

`missingEndpointFailure` is reached from **both** the run-level preflight and `materialiseDiff`, so
which layer noticed does not change what a maintainer reads. Three identifying phrases, chosen by the
**failing** endpoint's own identity:

| Failing ref | Message opens |
| --- | --- |
| `=== base` **and** `ctx.baseOverride != null` | `--base names missing ref "<ref>" — …` |
| `=== base` **and** no override | `repo.base_branch in harness/harness.yaml names missing ref "<base>" — …` |
| `=== harness/<id>/integration` | `ticket <id>: expected harness/<id>/integration; review requires an integrated branch — …` |
| anything else | `<step.id>: input.diff names missing ref "<ref>" — …` |

Every message ends `. Neither the diff nor the containment check was run.` and names which side the
failing endpoint is. The clauses about the *other* endpoint are Q-0038's and are normative:

1. An endpoint that **is not due** is described as not yet created — *"the left endpoint X is not
   created until step "s" runs"* or *"…is a per-task template with no value until "s" expands its
   tasks"* — and **never** as one that *"does not resolve either"*. Reporting a not-yet-created ref as
   unresolvable is the same category error the diagnosis half exists to remove.
2. From `materialiseDiff`, an endpoint that is due and resolves contributes its short SHA; one that is
   due and does not resolve contributes *"does not resolve either"*.
3. A deferred range's producers are named whichever endpoint failed: the failing endpoint's own
   producer as *"step "s" was expected to create <ref>"*, a producer of the **other** endpoint as
   *"the range was deferred waiting for step "s" to create <ref>"* — never phrased as owing the ref
   that failed, because no step owed that one. Both survive when both endpoints were deferred, so
   reversing endpoint order cannot hide either.

*Test:* `q0035-empty-range.js` E5 and E16, `q0038-endpoint-preflight.js` P4 and P5, and
`q0077-base-flag.js` B6's three arms. **E16 must be ported in its Q-0038 re-cut form**, not the form
run 1 read: `calls.includes('implement')` became `deepEqual(calls, [])` and the short-SHA assertion
was removed.

### AC-6 — The empty-range diagnostic quotes evidence and claims no event

An empty range stops the run. The message is six lines and carries, in order: the range named twice
(interpolated so it can be pasted into a terminal, and as the flow file writes it); the left endpoint
and its short SHA; the right endpoint and its short SHA; the producing step when the range was
deferred; the containment check **verbatim as a command** with its outcome; one diagnosis line; and
**at most one** remedy.

The outcome is one of exactly `contained`, `not contained`, or `indeterminate (<reason>[: <detail>])`
— each tied to an exit code and to nothing else. It is obtained through `emptyRangeEvidence`
(`git/git.ts:168`), which routes to the single `ancestry()` primitive; **`diff.ts` contains no
private `try { … } catch { return false }`** and no ancestry call of its own (invariant 8).

The message never contains `merged`, `landed`, `shipped`, `rebased`, `cherry-picked`, `reset`, or
`already in` — a merge, a cherry-pick, a hand-applied patch and a rebase all produce the same exit
code, so asserting any of them is a claim git did not return.

*Test:* `q0035-empty-range.js` E1–E4 and E13, ported, each with the suite's own `FORBIDDEN` regex
(`/\b(merged|landed|shipped|rebased|cherry-picked|reset)\b|already in\b/i`) carried across verbatim —
it is a fixture, not a comment, so it ports byte-for-byte. E13 is the discriminating one: a shallow
probe that cannot answer must become `indeterminate`, never a confident negative.

### AC-7 — A deferred range's remedy is about the state that actually arose

When the range is empty and `check.state === 'contained'`:

- **not deferred** → remedy is `review <right> before it becomes contained in <left>`;
- **deferred** → remedy is `check that step "<s>" committed its work to <ref>`.

For a range this run deferred, the endpoint was created moments ago by a step of this very flow, so
it never *became* contained — it started that way, because that step committed nothing. Sending the
reader to review earlier is advice about a state that never arose.

Every remedy is one the range guard of AC-3 would accept. The message Q-0035 replaced ended by
advising something the guard forty lines above it refuses.

*Test:* `q0035-empty-range.js` E11 and E15, ported at message level over a hand-built
`deferredDiffs`. Plus a mechanical assertion: for each of the four `(deferred?, state)` combinations,
feed the emitted remedy back through the guard and assert it does not throw.

### AC-8 — Truncation is byte-honest, and the trim is tested by name

Above `config.repo?.max_diff_bytes ?? 200000`, the patch is cut to the limit, trimmed back to a UTF-8
character boundary, and the result reports **the kept byte count, not the limit**. One line is
appended to `runs.log` through `persistence.appendLog` (D-8) in the spike's exact format
(`run=<n> diff truncated range=<r> limit=<n> kept=<n>`), and a *Truncation notice* section is appended
to the returned text. Below the limit, no notice, no log line, no trim.

`trimIncompleteUtf8Suffix` is table-driven and tested for: empty input; ASCII; a complete multi-byte
character at the boundary (kept); a truncated 2-, 3- and 4-byte sequence (dropped); and a buffer of
continuation bytes only (returned unchanged).

*Test:* `q0035-empty-range.js` E8 — same patch, same stat, same truncation — plus the table above.
E8 is what proves truncation is unaffected by everything else this ticket does.

### AC-9 — The preflight walks every diff site once, in flow order, before the step loop

`preflightDiffs(context)` is called from `engine.ts` inside the run `try` (which opens at `:207`) and
before the step loop (which reads `flow.steps` at `:223`), so a failed preflight receives the same
terminal record as any other error. It:

1. walks `flow.steps` in order, treating a `parallel:` group as its members;
2. collects each member's diff sites — the step's own `input.diff`, and for a `fan_out` step its
   `step:` template labelled `<step.id>.step`, the same synthetic label `lint/lint.ts:145` uses, so
   one flow file reads the same in both failures. A missing or falsey `input.diff` is not a site;
3. **judges a group's diffs against branches created strictly before that group** — a parallel
   sibling's branch is concurrent, not earlier;
4. classifies **each endpoint independently** per D-5;
5. materialises a range **only when every endpoint is `pre-existing`**, once per distinct
   interpolated range, into `diffInputs`;
6. records into `deferredDiffs` any range with at least one `step-created` endpoint **and no
   `template` endpoint**, as `{ ref, step, producers }` mirroring the first producer left to right — a
   half-interpolated key can never be looked up at step time, so recording one would be a record
   nothing reads;
7. **proves every `pre-existing` endpoint at run start even when a sibling endpoint is deferred**, and
   throws `missingEndpointFailure` for the first that does not resolve, carrying the `notDueClause`
   for the endpoint beside it;
8. after each group, remembers the branches that group creates — a `worktree` step's
   `branch ?? harness/<id>/<step.id>`, and an `integrate` step's `into` — keeping the **earliest**
   creator;
9. stops the run on the first failing range, even when another distinct range was valid.

It runs identically under `--dry` and under a real run: **there is no `if (dry)` branch in it and none
is added** (invariant 11 — `--dry` is the same run machinery, not a second path).

*Test:* `q0038-endpoint-preflight.js` P1, P2, P3, P6, P7 and `q0034-chore-preflight.js` C2/C3, ported.
P3 is the one a simplification breaks: a `step-created` endpoint stays deferred *even when the ref
already exists at run start*. P2 is the one this ticket exists for: a deferred range still proves its
pre-existing endpoint before anything is billed.

**The "zero adapter invocations" half is a proxy here and the implement report must say so.**
`routing.ts`'s `runAgentStep` rejects with `<id>: execution belongs to Q-0052`, so a run whose
preflight correctly failed reports the preflight's `FlowError`, while one whose preflight wrongly
passed reports the stub's message. That distinguishes *fired before any step* from *skipped* without
an adapter. The real assertion — counting run-history occurrences, as `q0038-endpoint-preflight.js`
does — becomes available at Q-0052. Reporting the proxy as the real thing is the failure invariant 11
names.

### AC-10 — The context carries three new fields, and a step receives the run's own object

`RunContext` (`types.ts:139`) gains, each with JSDoc:

```ts
diffInputs: Map<string, string>;
deferredDiffs: Map<string, DeferredDiff>;
baseOverride: string | null;
```

`DeferredDiff` is `{ ref: string; step: string; producers: readonly EndpointProducer[] }`, declared in
`diff.ts`. All three are **required**, not optional, and are constructed in `engine.ts`'s context
literal at `:194-205` — the two maps empty, `baseOverride` as `base ?? null` (D-4).

Required rather than optional because the context handed to a step **is the run's own object, never a
spread copy**: `types.ts:132-137` states this and names Q-0051 to Q-0053 as the tickets that will rely
on it. So what the preflight writes survives into the steps that read it by contract rather than by
accident. The spike's `ctx.diffInputs?.get(…)` / `ctx.deferredDiffs?.get(…)` optional chaining
(`engine.js:740`, `:892`) exists for hand-built test contexts; in `core` the type carries the
guarantee and the optional chaining does not survive the port. **No test in `packages/core`
constructs a bare `RunContext` today**, so making them required touches only `engine.ts`'s literal.

*Test:* a run over a flow with two steps sharing one `input.diff` range leaves exactly one entry in
`diffInputs`, observed through a `vi.spyOn(routing, 'runStep')` implementation that reads
`context.diffInputs` — the technique `engine.test.ts:245-282` already uses to prove the base anchor.
Separately, a `--base` run reaches `materialiseDiff` with `baseOverride` set, and a run without the
flag reaches it with `null`.

### AC-11 — The interpolation sites coerce deliberately

`preflightDiffs` writes `String(s.branch ?? …)` and `String(s.into)` at `spike/src/engine.js:158-159`'s
two sites; `String(site.input.diff)` at `:132` and `String(step.input.diff)` at `:873` are already
written in the spike and port as they stand. `core`'s `interpolate` (`loaders.ts:52`) types its
parameter `string` and coerces nothing, so under a step shape typed `Record<string, unknown>` each
site coerces at the call.

This is the port turning a latent runtime pass-through into a compile error, per Q-0050 errata E-21.
It is **not** a behaviour change to report under charter §2, and **not** licence to change what an
interpolated value means. The reason lives in `loaders.ts:44-51`, which already states it, and is
cited rather than transcribed.

*Test:* a flow whose `branch:` is the YAML number `2` reaches the same created-so-far key as the
string `"2"`, asserted through the deferral map. Not a type-only claim — the number is what YAML
actually hands back.

### AC-12 — Every preserved defect and deliberate addition is registered with an authority line

`diff.ts` carries a `Why:` line at each site below, each classifiable by `q0050.source.test.ts`'s
`classifyAuthority`, and `diff.ts` is added as a key to `REGISTERED` at `:160` — a register of
identities, not a count, so a marker moved between files fails as loudly as one deleted.

| Site | Authority clause | What it records |
| --- | --- | --- |
| the base-attribution branch in `missingEndpointFailure` | `preserved behaviour, see Q-0038` | keyed on whether `--base` was given, never on whether its value differs from the configured one; supersedes the Q-0006 review-runtime contract for the override path only, per Q-0038 errata E-1 |
| `ctx.diffInputs` keyed by interpolated range alone | `preserved defect, see Q-0078` | a site materialising `X...Y` before a later group creates `Y` leaves bytes a correctly-deferred second site then reads from the cache |
| the module note on the earliest-possible limit | `behaviour preserved from spike/src/engine.js` | *no adapter is billed before bad evidence is found* holds for pre-existing refs and cannot hold for a range this run creates |
| the narrowed context type | `deliberate addition, not preservation` | the first narrowing context type in this folder; the two existing ones widen (D-3) |
| `classifyEndpoints` returning `[]` for a malformed range | `behaviour preserved from spike/src/engine.js` | the shape guard owns that failure; classifying the parts answers a different question (D-5) |

Run 1's first row — `preserved defect, see Q-0038` for the wholesale `.find()` — **is deleted**.
Q-0038 landed; there is no defect left to register.

`:176`'s `toHaveLength(7)` moves by however many `preserved defect/` markers this ticket adds (one, on
current reading), and the comment above it — which enumerates Q-0050's seven by AC — is **extended
rather than replaced**, so the arithmetic stays legible.

*Test:* `q0050.source.test.ts`'s AC-13d tests pass; deleting any one authority line fails them, and so
does adding an unregistered one.

### AC-13 — The preflight is the earlier of the two `flow.steps` dereferences

In the spike there are two reads of `flow.steps` and the preflight is the first: `:93` binds
`const steps = flow.steps` and `:127` iterates `flow.steps`, which is what throws —
`flow.steps is not iterable`. `core` today throws from `steps.length` at `:225` instead:
`Cannot read properties of undefined (reading 'length')`. Node's message names the expression, so the
preflight must iterate **`flow.steps`** directly, not a local binding, or the message changes again.

That first line is what `failureMessage` (`engine.ts:92-95`) truncates into the terminal note, the
`runs.log` line and the terminal event, so it is externally observable under charter §2.
`engine.ts:220-222`'s existing `Why:` line, which preserves the uncoalesced read, stands unchanged and
the preflight adds no coalescing of its own.

*Test:* a run over a flow with no `steps` key fails with a `TypeError` whose message names iteration
of `flow.steps`, and the terminal event's note matches it. No frozen contract pins this string —
`contracts/Q-0050/run-messages.fixture.json` has no entry — so this **adds** a test rather than
changing one.

### AC-14 — The package boundary is unchanged, and what was skipped is reported as skipped

- `packages/core/src/index.ts` stays byte-identical to `export const name = '@quorum/core';\n`. This
  ticket adds no public re-export; Q-0052 is in the same package and imports `./diff.js` directly.
  `git.source.test.ts:47-51` already pins this file and is the precedent.
- No new dependency in `packages/core/package.json`; no new configuration field, file format or zod
  schema. `input.diff` is already in `shared`'s flow schema and `max_diff_bytes` in `project.ts:74`.
- If a new test opens a path outside `packages/core/turbo.json`'s declared `inputs`, it is declared in
  the same change and `src/turbo-inputs.test.ts`'s registers (`READ_BASES`, `NOT_READ`) are updated
  rather than the guard weakened. **Q-0070's precedent applies:** that guard refused a test that
  aliased `fs.readFileSync` to build a spy, because an alias is what its scan cannot follow.
- **The implement report states, in a table, which frozen scenarios this ticket closed and which it
  could not** — the census below, or a corrected version if the implementer finds it wrong. Reporting
  nine of seventeen as coverage of seventeen is the failure invariant 11 exists to name.

*Test:* `index.test.ts`, `corpus.test.ts` and `turbo-inputs.test.ts` pass. After
`pnpm install --frozen-lockfile` **and** `npm install --prefix spike --no-audit --no-fund` in the
worktree — which has no dependencies until they are installed (`harness/rules.md`) — `pnpm lint`,
`pnpm typecheck`, `pnpm turbo run test --force` and `npm test --prefix spike` all pass, the spike
suite unmodified.

---

## Coverage census

Re-derived by reading every scenario in every suite, 2026-08-30. **The ticket body's list omits
`q0038-endpoint-preflight.js` entirely** — seven scenarios, and the suite most directly about this
ticket's subject. It also says `q0077-base-flag.js` calls `materialiseDiff` at six sites and the
census gives it B1–B5; Q-0038 added B6 and B7, and there are **nine** direct call sites (`:64`, `:68`,
`:77`, `:91`, `:97`, `:106`, `:133`, `:150`, `:158`).

| Suite | Scenarios | Closable in `core` | Why not, where not |
| --- | --- | --- | --- |
| `q0035-empty-range.js` | E1–E8, E13 | **yes** | direct `materialiseDiff` calls against throwaway repositories |
| | E9, E14 | n/a — already done | the static twin is Q-0044's, landed at `lint/lint.ts:130-152` |
| | E10 | **partly** | guard and diagnosis port; *zero adapter invocations* is structural-only until Q-0052 (AC-9) |
| | E11, E15, E16 | **partly** | message halves port over a hand-built `deferredDiffs`; the step-time failure runs through `buildPrompt` (Q-0052) and needs a worktree step (Q-0053), so the *ordering* claim does not port |
| | E12 | **partly** | the `--dry` placeholder text lives in `buildPrompt` (Q-0052); the preflight half ports |
| | E17 first half | **yes** | a bad `fan_out` template range fails before the step loop |
| | E17 second half | **no** | one materialisation reaching every wave member byte-for-byte needs fan-out (Q-0053) |
| `q0038-endpoint-preflight.js` | P1, P2, P3, P7 | **yes** | per-endpoint classification is entirely inside this module |
| | P4, P5 | **yes** | producer attribution is `missingEndpointFailure`'s, reachable directly |
| | P6 | **partly** | `--dry` refuses what a real run refuses — ports; *and still writes nothing* is Q-0050's, already ported |
| `q0034-chore-preflight.js` | C2, C3 | **yes** | preflight failure before any step; guard rejection |
| | C1, C1b | **no** | run a chore-shaped flow end to end; need Q-0052 and Q-0053 |
| `q0034-dry-run.js` | D1, D2 | n/a — not this module | dry-run ticket-immutability is Q-0050's, already ported |
| `q0077-base-flag.js` | B1, B2, B3, B4, B6 | **yes** | direct `materialiseDiff` calls |
| | B5, B7 | **no** | drive the CLI; stay with the spike until Q-0010 |
| `q0034-review-fixes.js` | B1–B4 | n/a — not this module | manifest and run-history confinement; Q-0049's, already ported. Listed in the ticket body but contains **zero** references to the diff subsystem |
| `q0006-engine.js`, `smoke.js` | — | partly | `smoke.js` has three `materialiseDiff` references (`:634`, `:650`, `:655`); `q0006-engine.js` has none |

**All of these stay green on the spike throughout.** The freeze (charter §3) forbids touching
`spike/`, and the witness is the whole proof.

---

## Non-goals

1. **Fixing any defect found while reading the spike** (charter §2), including the six under
   *Reported, not fixed*. Reported in the implement report, never fixed in passing.
2. **Q-0078** — the `ctx.diffInputs` cache keyed by range alone. Pre-existing, unreachable in every
   shipped flow in both trees, and its obvious fix collides with Q-0038's AC-10 identical-bytes
   guarantee. **Port the keying as it stands and register it** (AC-12). Choosing among keying by site,
   invalidating on deferral, and forbidding the shape in `harness lint` is Q-0078's requirement.
3. **Another child's module.** No edit to `git/`, `lint/`, `fanout/`, `run-history/`, `backlog/`,
   `adapters/`, `contracts/` or `packages/shared`. The edits outside `diff.ts` are `engine.ts` (call
   site, three context fields) and `types.ts` (three field declarations) — both Q-0050's files, both
   authorised by `types.ts:132-137` in as many words — plus the four pin edits AC-1 and AC-12 require
   in `q0050.source.test.ts`.
4. **Unifying `diffSitesOf` with `lint.ts`'s `diffSites`**, hoisting `BASE_ENDPOINT` /
   `TICKET_ENDPOINT_PREFIX` into `shared` (D-7), or making `flattenSteps` descend into a fan-out
   template. They answer different questions over different inputs at different moments.
5. **Editing `spike/**`**, including its tests, or deleting the spike.
6. **`buildPrompt`, agent, gate and script steps** (Q-0052); **fan-out and integrate** (Q-0053); the
   cutover (Q-0009); the `quorum` binary (Q-0010); persisting the event stream.
7. **`ensureWorktree`'s silent `HEAD` fallback** — Q-0038 named it with evidence as a non-goal: it is
   another module, it governs fan-out task bases too, and *throw, warn, or which callers* is unasked.
8. Anything on v1's exclusion list.

---

## Reported, not fixed

Six items. Each is reported in the implement report; none is fixed in this ticket.

| # | Item | Evidence |
| --- | --- | --- |
| R-1 | `q0050.source.test.ts:134`'s hard-coded array fails **open** | AC-1 fixes this one, because leaving it would ship a guard blind to the file this ticket adds. Reported because the *class* — a literal list beside a derived one in the same file — may exist elsewhere |
| R-2 | `200000` is spelled a third time | `spike/src/engine.js:921`, `packages/shared/src/project.test.ts:97`, now `diff.ts` (D-9) |
| R-3 | Q-0051's ticket body is outside the transcription corpus | `q0050.source.test.ts:187-190`; widening it would fire on a faithful port (D-10) |
| R-4 | Q-0078's cache keying | NG-2; registered with an authority line |
| R-5 | `merged into` survives in a comment explaining the message it replaced | `spike/src/engine.js:937`; no `core` guard catches it (D-6) |
| R-6 | Eighteen stale worktrees under `.harness/worktrees/` | observed while locating `turbo-inputs.test.ts`; Q-0062's subject, not this ticket's |

---

## Open questions

Both are **non-blocking** and both are ruled inline, so nothing waits on an answer. The test for a
blocker is whether it needs a decision entry no step in this flow may write; neither does.

**OQ-1 — Should `preflightDiffs` emit an `info` event naming what it skipped?** *(owner: implementer;
ruled: no, this ticket.)* Invariant 11 says a preflight that declines to examine something reports it
as skipped. Today that reporting is implicit — a deferred range is recorded in `deferredDiffs` and the
`--dry` placeholder says so at step time, which is `buildPrompt`'s text and therefore Q-0052's. Adding
an event here is new behaviour under charter §2 and would need its own authority. **Ported as-is;
raised so Q-0052 inherits the question with the placeholder text.**

**OQ-2 — Does `DeferredDiff` keep both `ref`/`step` and `producers`, given `producers[0]` supplies
both?** *(owner: implementer; ruled: yes, keep all three.)* The redundancy is Q-0038's and deliberate:
the comment at `spike/src/engine.js:140-143` says `ref` and `step` mirror the first producer because
an empty deferred range names one owed branch and always did, while `producers` is what lets a failure
name every step that owed an endpoint. Collapsing them changes `emptyRangeFailure`'s single-producer
line into a list — externally observable, and refused.

---

## Risks

**R-A — A verbatim comment port turns another module's suite red.** `git.source.test.ts:35-45` scans
*every* file in `packages/core/src/**`, and `spike/src/engine.js:948` carries the hyphenated
`merge-base`. *Mitigation:* AC-1 clause 6 makes it a criterion rather than a discovery. **Likely** —
the comment is the most quotable in the subject.

**R-B — The `baseOverride` omission ports silently.** The two-field version compiles, typechecks and
passes every existing test; only `q0077-base-flag.js` B6 would catch it, and B6 stays on the spike.
*Mitigation:* AC-10 makes the field required, so `engine.ts` fails to compile until it is assigned.
**This is the highest-value criterion in the document** and it came from reading the code, not from
the ticket body, which names two fields.

**R-C — A reviewer asks for behaviour charter §2 requires the port to preserve.** Q-0049's round 1
returned three majors, two of which asked for exactly that, and Q-0050 spent six rounds on the same
class. *Mitigation:* every preserved shape here is named in an AC with its evidence, and D-5, D-7 and
NG-4 pre-refuse the three tidy-ups a reviewer is most likely to propose. If it happens anyway, the
route is an erratum written **during** the loop as soon as the contradiction is provable — see *"A
reviewer approves the change it asked for"* (2026-08-29) and *"An erratum is the last repair, not the
first"* (2026-08-30). Note the ordering those two entries establish together: fix the environment or
the argument first, and reach for the erratum only when neither can resolve it.

**R-D — A `Test:` sketch here is wrong because it was written from intent rather than from code.**
That is Q-0049's E-1 failure exactly. *Mitigation:* every sketch above names a file and a scenario id
I read. Three are explicitly flagged as proxies or proposals — AC-9's stub-message proxy, AC-3's
spawn-counter, AC-7's feed-the-remedy-back check. **The implementer measures before treating any of
them as a finding**, and a sketch that turns out wrong is corrected in the implement report rather
than worked around.

**R-E — The chore flow cannot run on a ticket's first pass.** `chore.yaml`'s `review` step diffs
against `harness/Q-0051/integration`, which only `integrate` creates. Since Q-0038, this refuses in
the preflight instead of billing — so charter §8's checklist is now load-bearing rather than advisory.
*Mitigation:* create the integration branch before the run. **Certain if skipped.**

**R-F — Eleven criteria carry coverage that cannot be closed here.** Q-0050 shipped with eleven
untested criteria by its own coverage table's words. *Mitigation:* the census above is explicit per
scenario, and AC-14 requires the implement report to reproduce it. The failure mode is reporting the
proxy as the real assertion.

---

## Cross-cutting checklist

| Concern | Answer |
| --- | --- |
| **BYOS** | n/a — no adapter, no login, no key on any path. `diff.ts` spawns `git` and nothing else |
| **Worktree safety** | preserved. `diff.ts` writes nothing to the working tree; its only write is one `runs.log` line via `appendLog`, no-op under `--dry` |
| **Gate behaviour** | unchanged. The preflight runs before the step loop and asks no gate; a failure takes the ordinary terminal path |
| **File format / schema** | none added. `input.diff` and `max_diff_bytes` already exist in `shared` |
| **Lint rules** | unchanged. The static twin is Q-0044's and already landed at `lint/lint.ts:130-152`; NG-4 forbids merging it with the runtime guard |
| **Cold-clone impact** | none. Internal machinery; no new command, flag or install step |
| **Product-agnostic** | yes. No product name anywhere |
| **Errors are explicit** | this ticket *is* that rule. Every failure names a ref, a SHA, a check and its outcome; nothing is defaulted silently |
| **Cross-vendor rule** | satisfied by the chore flow's panel, not by this change |

---

## Decisions cited

- *Q-0035 accepted: a check that skips its subject must not report success* (2026-08-25) — invariant 11
- *The erratum is closed: the sentence was true, and it was still the wrong sentence* (2026-08-25) —
  invariants 10 and 12
- *The port preserves behaviour; one exception is authorised and everything else stops the child*
  (2026-08-25) — charter §2, and why D-5 has no preserved-defect row
- *The port takes the chore route, except the one child that has new behaviour* (2026-08-25) — route
- *Containment is derived from git on each board invocation, never stored* (2026-08-24) — the
  vocabulary AC-6 enforces
- *A reviewer approves the change it asked for* (2026-08-29) — R-C
- *A check is not established by reading it* (2026-08-29) — D-2
- *A range is checked one endpoint at a time, because an endpoint is what can be absent* (2026-08-30)
  — D-5; the authority for the whole endpoint model
- *An erratum is the last repair, not the first* (2026-08-30) — R-C's ordering

**No new decision entry is owed by this requirement.** Every ruling above is an application of an
existing entry or an internal-layout choice charter §2 leaves to the implementer.

---

## Provenance

Read in full: `spike/src/engine.js` lines 1–200 and 695–1000; all six files of
`packages/core/src/engine/`; `packages/core/src/engine/q0050.source.test.ts`;
`packages/core/src/git/git.source.test.ts`; `harness/port-charter.md` §2 and its register.
Read selectively: `packages/core/src/lint/lint.ts`, `packages/core/src/git/git.ts`,
`packages/shared/src/constants.ts`, `packages/core/src/turbo-inputs.test.ts`,
`packages/core/test/corpus.ts`, `spike/test/run.js`, and all seven frozen suites for their scenario
census. Run 1's archived `merged.md` was read for its structure and its surviving rulings; D-1, D-3,
D-8, D-9 and D-10 are its work, updated. D-2, D-4, D-6 and D-7 are new and came from the code.
