# Q-0051 — `core/engine`: diff preflight and materialisation

*Requirements, 2026-08-30. Candidate written by the product-manager role for the chore route
(`requirements → chore → human gate`). Parent Q-0009; charter `harness/port-charter.md` §6 row
Q-0051; invariants 10, 11, 12.*

---

## Problem

A run's most expensive mistake is paying two vendors to read evidence that is not there. It has
happened: Q-0006's review round 10 billed $5.02 of Claude cost plus an unpriced Codex reviewer
against a diff of zero bytes, `materialiseDiff` embedded the emptiness without noticing, and the
flow would have advanced on the verdict. The panel produced eleven substantive findings anyway by
reading the working tree instead of the evidence handed to it — which is why the breakage stayed
invisible. Any step whose input is technically optional because the agent has repository access
carries the same hazard.

The subsystem that fixes this — a run-level preflight that materialises every range before any
adapter is invoked, and a diagnostic that quotes evidence instead of narrating a cause — is 192
lines of `spike/src/engine.js` and cost $36.66 to land as Q-0035, on top of Q-0034's work before
it. It is the most decision-dense of the four engine children.

`packages/core` currently has the *position* and none of the subsystem. Q-0050 ported the run loop
and left the block out deliberately: `packages/core/src/engine/engine.ts` opens its run `try` at
`:207` and reads `flow.steps` at `:223`, and the preflight belongs between them. `RunContext` has
no `diffInputs` and no `deferredDiffs`, so the seam Q-0052's `buildPrompt` will read from does not
exist. Until this ticket lands, a `core` run of any diff-bearing flow — `review.yaml` and
`chore.yaml`, the two flows this repository develops itself with — would hand its reviewers
nothing, or fail late, after the preceding adapter had been billed.

Every line number in this document was re-derived from the files on 2026-08-30 and is stated with
the file it was read from. The ticket body's own warning applies to this document too: re-derive,
do not copy.

---

## User stories

**Maintainer.** As a solo maintainer running `harness run review Q-0051` on my own repository, I
want the run to stop before it spawns a single agent when the review range is empty, malformed or
aimed at a ref that does not exist — and to tell me both endpoints, the short SHA each resolved to,
the containment check verbatim and its outcome, so I can re-check the failure by hand tomorrow
after the branch tips have moved.

**Maintainer.** As a maintainer reviewing a ticket whose branch is already contained in `main`, I
want `--base <ref>` to move the diff anchor and nothing else, so aiming a review at an older
revision never writes that revision into my ticket's branch.

**Contributor.** As a contributor working inside `packages/core`, I want the diff subsystem to be
one module with a stated contract, so that when I add a step kind I can see what the preflight
promises the step and what it deliberately does not.

---

## Surfaces

- **`packages/core`** — the only surface this ticket writes. One new module in
  `packages/core/src/engine/`, edits to `engine.ts` and `types.ts` in the same folder, and one edit
  to `packages/core/src/engine/q0050.source.test.ts` (see AC-1).
- **CLI** — untouched. `packages/cli` does not exist yet; `--base` threading is Q-0077's, already
  shipped on the spike.
- **`harness/`** — untouched. No flow, role or rule changes.
- **`backlog/`** — only this ticket's own artifacts, written by the engine, not by an agent step.
- **`docs/`** — no change required. `docs/04-architecture.md` describes `core/src` at folder
  granularity (`:44`) and names the public API (`:42`); this ticket adds neither a folder nor a
  public export. Confirmed by reading both lines.

---

## What this requirement settles before the implementer starts

The ticket body delegates two decisions and inherits four obligations. All six are decided here so
none of them is discovered in review.

### D-1. The diff subsystem is a new module: `packages/core/src/engine/diff.ts`

Not folded into `engine.ts`, which is 310 lines and already composes six concerns, and not into
`loaders.ts`, which is pure readers over the filesystem with no git and no context. The subsystem
is 192 lines in the spike of which 107 are code, it owns one exported behaviour (`materialiseDiff`)
that Q-0052 calls from a second call site, and it spawns git — three properties none of the six
existing files has.

**The consequence is not optional and is part of this change.** `q0050.source.test.ts:82` pins the
folder with `toStrictEqual(['channel.ts', 'engine.ts', 'lifecycle.ts', 'loaders.ts', 'routing.ts',
'types.ts'])`. A seventh file turns that suite red. The comments at `:90` and `:107` of that file
say in as many words that its guards were widened *"while the folder is six"* precisely because
they govern what Q-0051 to Q-0053 add. Extending the array to seven entries, alphabetically
(`channel.ts`, `diff.ts`, `engine.ts`, …), is authorised by this requirement and is the *only* edit
to that file this ticket makes other than the register entry AC-11 requires.

### D-2. What `diff.ts` exports, and the context it takes

| Symbol | Exported | Read by |
| --- | --- | --- |
| `materialiseDiff(step, context)` | yes | the preflight; Q-0052's `buildPrompt` fallback |
| `preflightDiffs(context)` | yes | `engine.ts`, once, before the step loop |
| `trimIncompleteUtf8Suffix(bytes)` | yes | `materialiseDiff`; its own tests (AC-6) |
| `named`, `diffSitesOf`, `emptyRangeFailure` | no | module-private |

`preflightDiffs` is the name because **preflight** is already the glossary's word for exactly this
("The run-level diff preflight materialises every range a flow's steps will need"). The spike's
block is anonymous; naming it is internal layout, which charter §2 explicitly does not preserve.

`materialiseDiff` takes a **narrow context type**, not the whole `RunContext` — declared in
`diff.ts` and structurally satisfied by `RunContext`, the way `RoutingContext` and
`LifecycleContext` in `types.ts` already narrow for their own modules. It reads exactly `repoDir`,
`config`, `vars`, `ticket`, `runId`, `deferredDiffs` and an `appendLog` capability, and nothing
else. This is what lets the diagnostic be tested against a throwaway repository without
constructing a run, which is how all seventeen of `q0035-empty-range.js`'s scenarios are built.

`trimIncompleteUtf8Suffix` is exported because of how it arrived: Q-0049's body listed it among run
history's functions, which it is not, and it sits two lines below the function above it
(`spike/src/engine.js:900`, `emptyRangeFailure` ending at `:898`), so a range-based port takes
everything except this one. It was nearly lost by adjacency. It gets its own name in the export
list and its own tests, so a future deletion is loud.

### D-3. The truncation log line goes through `persistence.appendLog`

The spike writes `ctx.backlog.log(ctx.ticket, …)` at `spike/src/engine.js:842`. In `core`, Q-0050
established `RunPersistence.appendLog` as the seam every write goes through, and `routing.ts` uses
it for its gate lines. Behaviour is identical in both modes — `appendLog` delegates to
`backlogView.log`, and under `--dry` `backlogView` is `readOnlyBacklog`, whose `log` is a no-op
(`engine.ts:38-44`) — so this is layout, not behaviour.

### D-4. The two `git diff` spawns stay inside `diff.ts`

`materialiseDiff` spawns `git diff --stat <range>` and `git diff <range>` directly
(`spike/src/engine.js:834, :835`). It does **not** route them through `packages/core/src/git/git.ts`.

Invariant 8 governs *ancestry*, and ancestry is already routed correctly: `emptyRangeFailure` reads
it through `emptyRangeEvidence`, which is exported from `git.ts` and was ported by Q-0042. A patch
and a stat are not ancestry. Adding a ninth export to `git.ts` would break
`git.source.test.ts:27-31`, which pins that module at exactly eight functions — another child's
landed guard, changed for a refactor nobody asked for.

### D-5. Q-0038's known hole is preserved, not fixed

The preflight defers a range whole when *either* endpoint is step-created — one `.find()` over both
endpoints at `spike/src/engine.js:132`. Q-0038 owns both halves of the fix (validate each endpoint
on its own class; name the producing step for whichever endpoint turns out bad). Q-0038 has not
landed on the spike. **This ticket ports the current, unfixed `.find()`**, registers it as a
preserved defect with an authority line, and changes nothing about it. Porting a speculative fix
would break the port's only proof — the frozen witness would keep the old behaviour and both suites
would be green over a divergence.

### D-6. `String(…)` at the three interpolation sites is deliberate, and is not a behaviour change

Q-0050 `solution/errata.md` E-21 names this ticket by id. `spike/src/engine.js:745` is
`String(s).replace(…)`; `packages/core/src/engine/loaders.ts:52` types the parameter `string` and
coerces nothing, and says so in its own JSDoc at `:49`. The three call sites inside this ticket's
range are `engine.js:125` (`site.input.diff`), `:138` (`s.branch`) and `:139` (`s.into`) — verified
by reading the block. `materialiseDiff` at `:791` already writes `String(step.input.diff)` itself.
YAML hands back a number for `branch: 2`, so under a step shape typed `Record<string, unknown>`
each site writes `String(…)` deliberately. This turns a latent runtime pass-through into a compile
error; it is not a behaviour change to report under charter §2, and it is not licence to change
what an interpolated value means.

---

## Acceptance criteria

Each is independently testable. Where a criterion names a line, that line was read on 2026-08-30
and the file it was read from is named with it.

### AC-1 — The module exists, and the folder pin moves with it

`packages/core/src/engine/diff.ts` exists and is the only file this ticket adds to that folder.
`q0050.source.test.ts:82`'s array is extended to the seven files, and every other guard in that
file passes over the new one unchanged:

- every `export` in `diff.ts` carries its own JSDoc **anchored on the export**, not on the file;
- no comment line in `diff.ts` reproduces a sentence of forty characters or more from
  `docs/DECISIONS.md` or from `backlog/Q-0050-core-engine-run-loop/ticket.md`;
- every `Why:` clause in `diff.ts` is classifiable by that file's `classifyAuthority`, so
  `behaviour preserved from spike/…`, `deliberate addition, not preservation`, or
  `preserved <word>, see <AC-n|Q-nnnn>` and nothing else;
- `diff.ts` matches none of `console.`,
  `process.(stdout|stderr|exit|on|once|addListener|prependListener|prependOnceListener)`, an ANSI
  escape, or an import from `spike/`.

*Test:* `pnpm turbo run test --force --filter=@quorum/core` with the array unextended fails on
`q0050.source.test.ts:82`; with it extended, all six describes in that file pass. Verified by
reading the file's assertions, not inferred.

### AC-2 — The range guard is not relaxed, and it reports the base it was actually given

`materialiseDiff` splits the interpolated range on `...` and refuses unless there are exactly two
non-empty endpoints and each is either `ctx.vars.base` or begins
`harness/<ticket-id>/`. The refusal message is preserved verbatim in shape:

```
<step.id>: input.diff must relate the configured base or this ticket's own branches ("<base>", "<prefix>…") with "...", got <range>
```

`<base>` is `ctx.vars.base` — the override under `--base`, the configured base otherwise — so the
guard composes with Q-0077. `spike/src/engine.js:800` anticipated the flag in as many words.

*Test:* a guard failure over `{base}...some/other-branch` matches `/must relate the configured
base/` and does **not** match `/is empty|containment/` — a guard failure must not read as an
empty-range diagnosis. With `vars.base = 'release'` the message contains `"release"`. Both are
`q0035-empty-range.js` E7 and E10's second half, ported.

### AC-3 — An unresolvable endpoint fails with the evidence that exists, and keeps its identifying phrase

One `git rev-parse --verify --quiet --short` per endpoint, through `shortSha` from `git/git.ts`,
answering both "does it resolve?" and "to what?". The left endpoint is tested before the right. Each
of the three failures keeps its identifying phrase, matched by substring in the frozen fixtures —
evidence is added *around* them and they are never replaced:

1. `repo.base_branch in harness/harness.yaml names missing ref "<base>"`
2. `ticket <id>: expected harness/<id>/integration; review requires an integrated branch`
3. `<step.id>: input.diff names missing ref "<ref>"`

Each is followed by a tail naming which endpoint it is, what the *other* endpoint resolved to (or
that it did not resolve either), the step that was expected to create it when the range was
deferred, and the sentence `Neither the diff nor the containment check was run.`

*Test:* `q0035-empty-range.js` E5 and E16, ported. The `Neither the diff nor the containment check
was run.` clause is the load-bearing one — it is invariant 11 inside a single message, and its
absence is what would let a reader take an unexamined check for a passed one.

### AC-4 — The empty-range diagnostic quotes evidence and claims no event

When `git diff --stat` prints nothing, the run stops with a message carrying all five elements —
missing any one of them makes it un-re-checkable by hand, which is the whole point:

- the range as interpolated **and** as the flow file writes it, both in backticks;
- both endpoints, each with the short SHA it resolved to;
- the containment check verbatim, as `check.command` from `git/git.ts` supplies it;
- that check's outcome as exactly one of `contained`, `not contained`, or
  `indeterminate (<reason>[: <detail>])`;
- one diagnosis and **at most one** remedy, and every remedy is one the AC-2 guard would accept.

The outcome comes from `emptyRangeEvidence(repoDir, left, right)` in
`packages/core/src/git/git.ts:168`, and from nowhere else. `diff.ts` contains no `try { … } catch {
return false }` over an ancestry question, and no second spelling of the ancestry rules.

The four outcomes are each tied to an exit code and to nothing else. `sameTree` discriminates only
inside the not-contained branch — `different commits holding identical trees` against `adds nothing
since its merge base` — and adds nothing when it is `null`.

Forbidden vocabulary, matched case-insensitively across the whole message:
`/\b(merged|landed|shipped|rebased|cherry-picked|reset)\b|already in\b/`. The board's word is
**contained**. The bare phrase `merge base` survives, because it names the commit a three-dot range
is defined against — see AC-12, which is where that survival gets complicated.

*Test:* `q0035-empty-range.js` E1–E4 and E13, ported: four throwaway repositories, one per outcome,
each asserting the five elements present and the forbidden pattern absent. No test asserts a whole
sentence and none assumes a fixed short-SHA width — git chooses the abbreviation.

### AC-5 — A deferred range's remedy is about the state that actually arose

When the preflight deferred this range, the message additionally names the step that owed the
endpoint (`produced by step "<id>", which was expected to create <ref>`), and the remedy becomes
`check that step "<id>" committed its work to <ref>` — **never** `review <right> before it becomes
contained in <left>`. A branch this run created moments ago never *became* contained; it started
that way, because that step committed nothing. Sending the reader to review it earlier is advice
about a state that never existed.

*Test:* the assertion pair from `q0035-empty-range.js` E11 — `/Remedy: check that step "implement"
committed its work/` present, `/before it becomes contained/` absent — exercised against
`materialiseDiff` directly with a hand-built `deferredDiffs` map. The end-to-end half of E11 is
**not** closable in this ticket; see *Coverage this ticket cannot close*.

### AC-6 — Truncation is byte-honest, and the trim is tested by name

The limit is `config.repo?.max_diff_bytes ?? 200000` (`spike/src/engine.js:836`). Above it the
buffer is cut to the limit, then passed through `trimIncompleteUtf8Suffix` so the patch never ends
mid-character, then a line is appended to `runs.log` through `persistence.appendLog`:

```
run=<runId> diff truncated range=<range> limit=<limit> kept=<bytes.length>
```

and the returned document carries `Patch truncated to <n> UTF-8 bytes (configured limit <limit>).`
An untruncated diff carries no notice. The document's four fixed headings are preserved byte for
byte: `## Diff to review`, `### git diff --stat <range>`, `## Patch (<range>)`, `## Truncation
notice`.

`trimIncompleteUtf8Suffix` is exported and has its own table-driven test covering: an empty buffer;
a buffer of continuation bytes only; a complete 1-, 2-, 3- and 4-byte sequence at the tail, each
returned unchanged; and a truncated 2-, 3- and 4-byte sequence, each trimmed back to the lead byte.
The width table is `< 0x80 → 1`, `0xc2–0xdf → 2`, `0xe0–0xef → 3`, `0xf0–0xf4 → 4`, anything else
`1` — transcribed from `spike/src/engine.js:900-908`, which was read for this criterion.

*Test:* `q0035-empty-range.js` E8, ported, plus the new unit table. E8 already pins `max_diff_bytes:
500` producing `Patch truncated to \d+ UTF-8 bytes \(configured limit 500\)`.

### AC-7 — The preflight walks every diff site once, in flow order, before the step loop

`preflightDiffs(context)` is called from `engine.ts` inside the run `try` (which opens at `:207`)
and before the step loop (which reads `flow.steps` at `:223`). It:

1. walks `flow.steps` in order, treating a `parallel:` group as its members;
2. collects each member's diff sites — the step's own `input.diff`, and for a `fan_out` step its
   `step:` template, labelled `<step.id>.step`, which is the same synthetic label
   `packages/core/src/lint/lint.ts:145` uses so one flow file reads the same in both failures;
3. **judges a group's diffs against branches created strictly before that group** — a parallel
   sibling's branch is concurrent, not earlier;
4. skips a per-task template range that still contains an unresolved `{…}` placeholder after
   interpolation, because `harness/{id}/{task.id}` has no single value until `tasks.yaml` is
   expanded. Only a template can be in this state, so an outer step's unresolved range still fails
   here;
5. records a range whose *either* endpoint is in the created-so-far map into `deferredDiffs` as
   `{ ref, step }` and materialises nothing (D-5);
6. otherwise materialises the range **once per distinct range** into `diffInputs`, keyed by the
   interpolated range;
7. after each group, remembers the branches that group creates: a `worktree` step's `branch ??
   harness/<id>/<step.id>`, and an `integrate` step's `into`. The map keeps the **earliest**
   creator, so a deferred range can say who owed the branch.

It runs identically under `--dry` and under a real run. There is no `if (dry)` branch in it, and
none is added — invariant 11's second half, `--dry` is the same run machinery, not a second path.

*Test:* `q0035-empty-range.js` E17's first half and `q0034-chore-preflight.js` C2/C3, ported to
vitest. The discriminating assertion available today: `routing.ts:54-56`'s `runAgentStep` rejects
with `execution belongs to Q-0052`, so a run whose preflight correctly *failed* reports the
preflight's `FlowError`, while a run whose preflight wrongly *passed* reports the stub's message.
That distinguishes "the preflight fired before any step" from "the preflight was skipped" without
needing an adapter, which is the property AC-14 is about.

### AC-8 — The context carries the two maps, and a step receives the run's own object

`RunContext` in `packages/core/src/engine/types.ts` gains two required fields with JSDoc:

```ts
diffInputs: Map<string, string>;
deferredDiffs: Map<string, DeferredDiff>;
```

`DeferredDiff` is `{ ref: string; step: string }`, declared in `diff.ts` and re-exported through
`types.ts` if `types.ts` needs it. Both are constructed empty in `engine.ts`'s context literal at
`:194-205`. They are required rather than optional because the context handed to a step **is the
run's own object, never a spread copy** — `types.ts:135-137` states this, and Q-0050's round 3
established it — so what the preflight writes survives into the steps that read it by contract
rather than by accident. The spike's `ctx.diffInputs?.get(…)` optional chaining
(`spike/src/engine.js:720`, `:811`) exists only for hand-built contexts in tests; in `core` the
type carries the guarantee and the optional chaining does not survive the port.

*Test:* a run over a flow with two steps sharing one `input.diff` range leaves exactly one entry in
`diffInputs`, observed through a `routing.runStep` spy that reads `context.diffInputs` — the
technique `engine.test.ts:263-282` already uses to prove the base anchor.

### AC-9 — The three interpolation sites coerce deliberately

`preflightDiffs` writes `String(site.input.diff)`, `String(s.branch ?? …)` and `String(s.into)` at
the three sites named in D-6, and `materialiseDiff` keeps its own `String(step.input.diff)`. Each
site carries no comment beyond what AC-11 requires; the reason lives in `loaders.ts:44-51`, which
already states it, and is cited rather than transcribed.

*Test:* a flow whose `branch:` is the YAML number `2` reaches the same created-so-far key as the
string `"2"`, asserted through the deferral map. Not a type-only claim — the number is what YAML
actually hands back.

### AC-10 — `--base` moves the diff anchor and nothing else

`materialiseDiff` resolves the base from `ctx.vars.base` and never from `ctx.config.repo.base_branch`
directly. `engine.ts:137` already computes `vars.base` as `base ?? config.repo?.base_branch ??
DEFAULT_BASE_BRANCH`. The three sites that *merge* a base into the ticket's branch — rework sync,
`integrate`'s sync, and the evidence note — read `config.repo.base_branch` and are outside this
ticket, but nothing this ticket writes may make `materialiseDiff` read the config for its anchor.

*Test:* `spike/test/q0077-base-flag.js` B1–B4, ported (B5 drives the CLI and stays with the spike
until Q-0010). B1 is the discriminating one: a contained ticket has an empty range against the
configured base and a usable one against `--base`, in the same repository. A port that resolved
`base` from the config inside `materialiseDiff` would silently undo Q-0077 and every other test
would stay green.

### AC-11 — Every preserved defect and gap is registered, with an authority line

`diff.ts` carries a `Why:` line at each site below, each classifiable by
`q0050.source.test.ts`'s `classifyAuthority`, and each site is entered in that file's `REGISTERED`
map under `'diff.ts'` — a register of identities, not a count, so a marker moved between files
fails as loudly as one deleted:

| Site | Authority clause | What it preserves |
| --- | --- | --- |
| the `.find()` over both endpoints | `preserved defect, see Q-0038` | a range is deferred whole when either endpoint is step-created; a left endpoint of the pre-existing class that simply does not exist is not checked (D-5) |
| the module-level note on the earliest-possible limit | `behaviour preserved from spike/src/engine.js` | "no adapter is billed before bad evidence is found" holds for pre-existing refs and cannot hold for a range this run creates |
| the base-attribution message | `preserved defect, see Q-0051 AC-11` | under `--base`, an unresolvable override is reported as `repo.base_branch in harness/harness.yaml names missing ref …` — see *Reported, not fixed*, below |

The `REGISTERED` map's companion assertion at `q0050.source.test.ts:176` counts seven
`preserved defect/` markers across the folder. That number moves by however many this ticket adds,
and the comment above it — which enumerates Q-0050's own seven by AC — is extended rather than
replaced, so the arithmetic stays legible.

*Test:* `q0050.source.test.ts`'s `AC-13d` describe passes; deleting any one authority line fails it.

### AC-12 — The `merge-base` token does not leave `git/git.ts`

**This is the criterion most likely to be discovered in review rather than before it, so it is
written out.** `packages/core/src/git/git.source.test.ts:35-45` asserts that the strings
`merge-base` and `--is-ancestor` appear in `git/git.ts` and in **no other file** under
`packages/core/src`. It iterates the whole corpus and asserts `text.includes(needle) === (name ===
'git/git.ts')`.

`spike/src/engine.js:861` — inside `emptyRangeFailure`'s comment block — reads:

> `merge-base` survives because it is the name of the command being quoted and of the commit a
> three-dot range is defined against.

Ported verbatim, that comment turns a landed suite in another child's module red, for a token
appearing in prose explaining why the token is allowed. The message text itself is safe: the
command is quoted from `check.command`, built in `git.ts`, so the literal never appears in engine
source, and the not-contained diagnosis says `merge base` with a space.

`diff.ts` must therefore state the vocabulary rule without spelling the hyphenated token — the
argument is preserved, the string is not. The point is not the wording; it is that the ported
comment and the landed guard were written by different tickets and neither knew about the other.

*Test:* `git.source.test.ts`'s `AC-1` describe passes with `diff.ts` present. Demonstrate it
failing first, over a `diff.ts` carrying the verbatim comment, before trusting the version that
passes — *"a check is not established by reading it"* (2026-08-29).

### AC-13 — The preflight is the earlier of the two `flow.steps` dereferences

`packages/core/src/engine/engine.ts:220-223` preserves, with an authority line, that `flow.steps` is
read directly and uncoalesced so a flow with no `steps` key throws a raw `TypeError` rather than
running zero steps. In the spike there are **two** such reads and the preflight is the first:
`spike/src/engine.js:88` binds `const steps = flow.steps` and `:120` iterates `flow.steps` in the
preflight, which is what actually throws — `flow.steps is not iterable`. `core` today throws from
`steps.length` instead: `Cannot read properties of undefined (reading 'length')`.

That first line is what `failureMessage` (`engine.ts:92-95`) truncates into the terminal note, the
`runs.log` line and the terminal event — externally observable under charter §2. So
`preflightDiffs` iterates `flow.steps` itself, positioned before the loop, and the spike's message
is restored rather than left as a silent divergence.

`packages/shared/src/flow.ts:381` cites this behaviour at `spike/src/engine.js:83, :115` — the
pre-Q-0077 numbers, five short. Reported, not fixed: `shared` is Q-0041's module and the drift is
in a comment.

*Test:* a run over a flow with no `steps` key fails with a `TypeError` whose message names
iteration, and the terminal event's note matches it.

### AC-14 — The package boundary is unchanged, and what was skipped is reported as skipped

- `packages/core/src/index.ts` stays byte-identical to `export const name = '@quorum/core';\n`.
  This ticket adds no public re-export; its only declared dependent, Q-0052, is in the same package
  and imports `./diff.js` directly. `git.source.test.ts:47-51` already pins this file and is the
  precedent.
- No new dependency in `packages/core/package.json`.
- `packages/core/turbo.json` needs no new `inputs` entry: it already declares
  `../../spike/src/**`, `../../backlog/*/ticket.md`, `../../harness/flows/*.yaml` and
  `../../docs/DECISIONS.md` — verified by reading the file. If a new test opens a path outside
  those, it is declared in the same change, and `src/turbo-inputs.test.ts`'s registers
  (`READ_BASES`, `NOT_READ`) are updated rather than the guard weakened.
- **The implement report states, in a table, which frozen scenarios this ticket closed and which it
  could not** — the list below, or a corrected version of it if the implementer finds it wrong.
  Reporting nine of seventeen as coverage of seventeen is the failure invariant 11 exists to name.

*Test:* `packages/core/src/index.test.ts`, `corpus.test.ts` and `turbo-inputs.test.ts` all pass;
both suites run forced (`pnpm turbo run test --force` and `npm test --prefix spike`) after
`pnpm install --frozen-lockfile` and `npm install --prefix spike`, in the worktree, which has no
dependencies until they are installed (`harness/rules.md`).

---

## Coverage this ticket cannot close

Stated rather than implied, because the alternative is a report that counts seventeen scenarios and
delivers nine. Each row was determined by reading the scenario, not by guessing.

| Frozen scenario | Closable here | Why not |
| --- | --- | --- |
| E1–E8, E13 (`q0035`) | **yes** | direct `materialiseDiff` calls against throwaway repositories |
| E9, E14 (`q0035`) | no — already done | lint's static twin is Q-0044's, landed at `lint/lint.ts:115-152` |
| E10 (`q0035`) | **partly** | the guard and diagnosis halves port; "zero adapter invocations" is provable structurally through the `Q-0052` stub, not through a mock adapter |
| E11, E15, E16 (`q0035`) | **no** | the step-time failure runs through `buildPrompt`'s `materialiseDiff` fallback (`spike/src/engine.js:720-722`), which is Q-0052, and needs a worktree step, which is Q-0053. The *message* halves port as unit tests over a hand-built `deferredDiffs`; the *ordering* claim — the producing adapter ran, the consuming one did not — does not |
| E12 (`q0035`), C1b (`q0034-chore-preflight`) | **no** | the `--dry` placeholder text lives in `buildPrompt` (Q-0052). What ports is the preflight half: under `--dry` a deferred range is deferred and not failed, observed by asserting the run reaches the `Q-0052` stub rather than a missing-ref `FlowError` |
| E17 first half (`q0035`) | **yes** | a bad `fan_out` template range fails before the step loop |
| E17 second half (`q0035`) | **no** | one materialisation reaching every wave member byte for byte needs fan-out (Q-0053) |
| C1, C2, C3 (`q0034-chore-preflight`) | **C2, C3 yes; C1 no** | C1 runs a chore-shaped flow end to end |
| D1, D2 (`q0034-dry-run`) | no — not this module | the dry-run ticket-immutability claims are Q-0050's, already ported |
| B1–B4 (`q0077-base-flag`) | **yes** | direct `materialiseDiff` calls |
| B5 (`q0077-base-flag`) | **no** | drives the CLI; stays with the spike until Q-0010 |

**All seventeen `q0035` scenarios, all five `q0077` scenarios and all four `q0034-chore-preflight`
scenarios stay green on the spike throughout.** The freeze (charter §3) forbids touching
`spike/src/`, and the witness is the whole proof.

---

## Non-goals

1. **Fixing any defect found while reading the spike** (charter §2). Reported in the implement
   report, never fixed in passing. This includes the three named under *Reported, not fixed*.
2. **Q-0038's endpoint-class validation.** D-5. The `.find()` ships unchanged.
3. **Another child's module.** No edit to `git/`, `lint/`, `fanout/`, `run-history/`,
   `backlog/`, `adapters/`, `contracts/` or `packages/shared`. The two edits outside `diff.ts` are
   `engine.ts` (the call site and the context literal) and `types.ts` (two fields) — both Q-0050's
   files, both authorised by `types.ts:137` in as many words — plus the two pin edits AC-1 and
   AC-11 require in `q0050.source.test.ts`.
4. **Unifying `diffSitesOf` with `lint.ts`'s `diffSites`.** They answer different questions over
   different inputs; merging them is a cross-module refactor with no requirement behind it.
5. **Editing `spike/**`** (charter §3), including its tests.
6. **`buildPrompt`, agent steps, gate steps, script steps** — Q-0052. **Fan-out and integrate** —
   Q-0053. The cutover, the `quorum` binary (Q-0010), persisting the event stream.
7. **Any public re-export from `packages/core/src/index.ts`.**
8. **A new constant in `packages/shared`** for the `200000` diff cap — see OQ-2.
9. Anything on v1's exclusion list: multi-user, remote daemon, cloud sync, plugin marketplace,
   visual node canvas, eval suites, Gemini adapter, desktop shell.

---

## Reported, not fixed

Charter §2 requires these to be named and left alone. Each is written out in full here so the
obligation cannot expire in a report nobody re-reads — a deferred obligation dies unless it is
written into a ticket body.

**R-1. Under `--base`, an unresolvable override is blamed on a file that does not name it.**
`spike/src/engine.js:829` throws `repo.base_branch in harness/harness.yaml names missing ref
"<base>"` when the left endpoint equals `base`, and `base` is `ctx.vars.base` — the override when
one was given. So `harness run review Q-0051 --base 0f1e40d` against a SHA that does not resolve
sends the maintainer to `harness/harness.yaml`, which is not where the value came from. Q-0077
shipped `--base` on 2026-08-29, after this message was written for Q-0035, and the two never met.
The fix is one branch on whether an override is in force and a second phrase naming `--base`; it
lands in `spike/src/engine.js` and `packages/core/src/engine/diff.ts` together — the Q-0066/Q-0068
shape — and it changes a message three frozen fixtures match by substring, so it needs its own
requirement. **Successor ticket to open at this gate.**

**R-2. `packages/shared/src/flow.ts:381` cites pre-Q-0077 line numbers** (`spike/src/engine.js:83,
:115`, now `:88, :120`). A comment, in Q-0041's module. Worth a one-line correction in whatever
ticket next touches that file; not worth its own.

**R-3. The `200000` diff cap is spelled twice already** — `spike/src/engine.js:836` and
`packages/shared/src/project.test.ts:97` — and this port makes it three. See OQ-2.

---

## Open questions

| # | Question | Owner | Blocking? |
| --- | --- | --- | --- |
| OQ-1 | Should `preflightDiffs` be the name, or `materialiseDiffInputs`? The glossary already defines **preflight** as exactly this run-level pass, so `preflightDiffs` is recommended and no glossary change is needed either way. | implementer | no — recommendation stands unless overruled |
| OQ-2 | Should the `200000` cap become `DEFAULT_MAX_DIFF_BYTES` in `packages/shared/src/constants.ts`? Charter §4 puts constants in `shared`, and the literal is already spelled twice. **Recommendation: no, not in this ticket.** It is an edit to Q-0041's module for a value this ticket does not change, and `packages/shared/src/index.test.ts:115` pins the exported constant list. Open it as a successor if a third spelling bothers a reviewer. | head of product at the gate | no |
| OQ-3 | Does `q0050.source.test.ts`'s transcription corpus (`docs/DECISIONS.md` + Q-0050's ticket body) want Q-0051's ticket body added, so a `diff.ts` comment transcribing *this* document is caught? **Recommendation: yes**, and it is one array entry plus one `turbo.json` input — but `../../backlog/*/ticket.md` is already declared, so the input is covered. Flagged because it widens another ticket's guard. | implementer, ruled at review | no |
| OQ-4 | Is the structural proof in AC-7 — "the preflight fired, because the failure is the preflight's and not `Q-0052`'s stub" — strong enough to stand in for E10's `adapterCalls === []`? It proves ordering without an adapter, which is the property AC-14 cares about, but it is a proxy and will be replaced by the real assertion at Q-0052. **Recommendation: accept, and say in the report that it is a proxy.** | head of product at the gate | no |

**No question here is a blocker.** Nothing in this requirement changes a file format, the adapter
contract, the flow schema or a shipped flow, and no criterion depends on a decision entry that does
not yet exist — which is the precondition that cost Q-0070's requirements run two refusals and an
exhausted loop.

---

## Risks

**R-A. The reviewer approves the change it asked for.** Q-0049's most durable finding, and Q-0050's
six rounds are the evidence: a review loop cannot police charter §2 on its own, because round 2's
reviewer blocked its own round-1 requests. Every criterion above that says *preserved* is a
criterion a reviewer may ask to "improve". The remedy is an erratum in
`requirements/errata.md`, written **during the loop as soon as the contradiction is provable**,
not at the exhaustion gate — *"A reviewer approves the change it asked for"* (2026-08-29).

**R-B. A check that cannot fail.** Rounds 4 to 6 of Q-0050 produced five assertions that could not
fail. AC-12 is the one here most at risk, because the natural way to write it — assert `diff.ts`
does not contain a token — passes over a file that does not exist. Demonstrate each new guard
failing over the real violation before trusting it green.

**R-C. Two guards written by different tickets, neither knowing the other.** AC-12 is one instance
found by reading; AC-1 is a second. There may be a third. Before the first implement round, run the
whole workspace suite forced with an empty `diff.ts` present in the folder — that is cheap, and it
surfaces every landed pin the new file trips without spending a review round on it.

**R-D. The line numbers move again.** Q-0077 shifted this file by five between the ticket body being
written and this document. Every number here was re-read on 2026-08-30 and is stated with its file.
Re-derive from the file, not from this document.

**R-E. Cost.** Q-0050 cost $131.03 across eight runs; Q-0049 cost $52.34 across three implement
rounds. This module is smaller than either but denser in decisions. Charter §9's third threshold —
more than three chore runs means the child was cut wrong — applies.

---

## Cross-cutting checklist

| Concern | Answer |
| --- | --- |
| **BYOS** | n/a to the code. No adapter is constructed, no environment variable is read, no key path is added in source, test or fixture. The preflight's entire purpose is to run *before* any adapter. |
| **Worktree safety** | n/a — this ticket creates no worktree and no branch. It reads git and writes one `runs.log` line. It writes nothing to the user's working tree. |
| **Gate behaviour** | Unchanged. `askGate` and the exhaustion gate are `routing.ts`'s (Q-0050). A preflight failure is not a gate; it stops the run, and `engine.ts`'s existing catch gives it the same terminal record as any other error — which is why AC-7 places it inside the run `try`. |
| **File format and schema** | No format changes. `input.diff` is already in `packages/shared`'s flow schema and `max_diff_bytes` in `project.ts:74`. No zod schema is added or edited; `core` declares none (charter §4). |
| **Lint rules** | No new lint rule. The static twin of AC-2's guard is Q-0044's `validDiffRange` (`lint/lint.ts:122-127`) and already ships. AC-2 must stay consistent with it: a flow the engine accepts must pass lint, and a flow lint rejects would have failed at step time anyway — after an adapter was billed. |
| **Cold-clone impact** | None. No CLI surface, no README step, no new command. A stranger's first 30 minutes are unchanged. |
| **Product-agnostic** | No reference to any SaaS product. |
| **Errors are explicit** | This is the ticket's subject. Nothing defaults silently; a check that declines to examine something says so, in the message (AC-3) and in the report (AC-14). |
| **Vocabulary** | contained / not contained / indeterminate, per the glossary's **Containment**. Never merged, landed, shipped, rebased, cherry-picked or reset (AC-4). **preflight**, **dry run** and **base override** are used as the glossary defines them; no new term is introduced, so `docs/GLOSSARY.md` needs no edit. |

---

## Decisions cited

- *The port takes the chore route, except the one child that has new behaviour* (2026-08-25) — the route.
- *The port preserves behaviour; one exception is authorised and everything else stops the child* (2026-08-25) — D-5, D-6, R-1, the non-goals.
- *The erratum is closed: the sentence was true, and it was still the wrong sentence* (2026-08-25) — invariant 10, AC-4.
- *Q-0035 accepted: a check that skips its subject must not report success* (2026-08-25) — invariant 11, AC-3, AC-14.
- *Containment is derived from git on each board invocation, never stored* (2026-08-24) — invariant 8, AC-4's routing through `emptyRangeEvidence`.
- *Q-0034 closed: an unlanded branch's cost is not its merge conflict* (2026-08-24) — the guard's shape, AC-2.
- *A reviewer approves the change it asked for* (2026-08-29) — R-A.
- *A check is not established by reading it* (2026-08-29) — AC-12, R-B.
