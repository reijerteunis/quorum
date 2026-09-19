# Q-0137 — The drill-down serves what an occurrence retained

*Merged requirement, run 1, iteration 1. Head of product, 2026-09-18.*

*Every measurement below was re-derived at this gate against the tree, not transcribed from either
candidate, from the ticket body, or from Q-0018's Appendix A. Where a figure differs from an earlier
account the difference is stated rather than smoothed over, and §0.8 records which figures move under
a reader and which have held across four independent passes.*

---

## §0 What was measured

### §0.1 The store

**173 run directories · 940 occurrences · 1,796 retained files · 116,798,098 B.** Retained prompt and
output text is **99.3%** of `.quorum/runs`.

Per occurrence: max **355,744 B**, median **99,652**. Per run: max **3,514,617 B**, median
**459,758**. Largest single file **353,626 B** — `Q-0129-3/steps/009-review/prompt.txt`, a review
prompt rather than an output.

**The three figures the payload decision rests on have now held across four independent passes** —
Q-0018's Appendix A, this ticket's launch re-measurement, candidate-claude's, and this gate's:
355,744 / 3,514,617 / 353,626, unchanged every time. §4.2 is therefore argued from a stable
measurement rather than from a snapshot.

### §0.2 Nothing in this product has ever read one of these files

`grep` for `prompt.txt`, `output.txt`, `PROMPT_FILE` and `OUTPUT_FILE` across `packages/server/src`
returns **nothing**. `core`'s reader exports `readRun`, `readRunsDir`, `sortRuns`, `isIncomplete`,
`occurrenceSeq` and `vendorTokenTotal` — six values at `packages/core/src/index.ts:124` — and **no
file read of any kind**. So this is the first reader of a retained file on **any** surface this
product has, not the first on the web.

What exists instead is a **printed path**: `packages/cli/src/runs.ts:219` composes
`path.join(RUN_HISTORY_ROOT, runId, step.occurrence_dir)` and prints it dim beside the step id. That
is the product's whole answer today — it tells a maintainer where the bytes are and they run `cat`.
It is also the only site outside the writer that joins `occurrence_dir` into a path, and it is a
**rendering rather than a read**, which is why it is not a precedent for joining (NG-5).

### §0.3 The confinement threat, and it has one half rather than two

- **The run id is confined already.** `resolveRunDirectory` (`reader.ts:211`) refuses a token that is
  not one name, resolves both sides with `realpathSync`, requires exact parent equality with the runs
  root, and requires the result to exist and be a directory.
- **The file name comes from the client** and is closed by membership, on Q-0127's rule.
- **`occurrence_dir` comes from the manifest and nothing validates it.** `manifestShapeError`
  (`reader.ts:88`) proves exactly five things — `run_id`, `ticket_id` and `status` are strings,
  `steps` and `rollup` are arrays — and **no occurrence field is checked anywhere on the read path**.
  `readRun`'s own JSDoc calls the parsed document *"a cast, never a check"*. The only code that
  inspects `occurrence_dir` at all is `contracts/run-manifest.ts`, which checks for **duplicates** and
  runs only under `quorum validate`.

**No test in either package stages a traversing `occurrence_dir`.** The nearest thing is
`reader.test.ts`'s `occurrenceSeq` suite — `'notsteps/001-a'`, `'steps/a-1'`, `'steps/001'`, `''`,
`null`, `undefined` — **none of which traverses**.

**On disk all 940 values are `steps/<nnn>-<stepid>` exactly**: zero contain `..`, zero are absolute,
zero are symlinks. The threat is what a manifest **may** carry, never what one does — which is why
AC-3's fixture is constructed and why AC-3 is named as not eligible for trimming.

**The one-line difference from Q-0127, which decides how the guard is written:** *there the untrusted
value arrived over HTTP; here it arrives from a file this product wrote and does not re-check.* A
guard modelled on Q-0127's without reading this paragraph confines the wrong value.

### §0.4 `occurrence_dir` crosses the wire today — undeclared, and unnamed by the docblock that exists to say what crosses

`WireRunHistoryOccurrence` (`packages/shared/src/wire.ts:322`) declares **seven** fields — `step_id`,
`kind`, `status`, `started_at`, `duration_ms`, `adapter`, `seq` — and
`wireRunHistoryOccurrenceSchema` is a **`z.looseObject`**. `read.ts:521` builds each entry as
`{ ...step, seq: occurrenceSeq(step.occurrence_dir) }`, so **the whole occurrence crosses, including
`occurrence_dir`**.

Sharper than either candidate had it: `Occurrence` has **exactly fifteen** fields
(`manifest.ts`), and the schema's docblock enumerates the eight that cross untyped — `role`, `model`,
`branch`, `worktree`, `attempts`, `verdict`, `error`, `usage`. Six named + eight enumerated = **14**.
**`occurrence_dir` is the fifteenth, and it is absent from the docblock's own enumeration.** It
crosses both undeclared *and* unmentioned by the comment whose job is to say what crosses.

So a client keying on it would be coding against an accident twice over. **The identity a client
supplies is `seq`, and neither route accepts `occurrence_dir` from a client under any circumstance**
(AC-6).

### §0.5 `seq` is not unique in general, and the shipped screen already knows it

`occurrenceSeq` (`reader.ts:169`) answers **`Number.MAX_SAFE_INTEGER`** for a directory name whose
`steps/NNN-` prefix it cannot read, so two unreadable entries share a value — and the schema's
`z.number().int().nonnegative()` accepts it. `apps/web/src/history-screen.tsx` keys its list by array
position for exactly this reason. **940 of 940 parse today.** AC-6 is what stops a collision being
answered as an absence.

### §0.6 A third `realpathSync` declaration fails a shipped guard, and the reuse is precedented in this folder

`packages/core/src/backlog/backlog.source.test.ts`'s `REALPATH_SITES` registers the **two**
production files across `packages/core/src` and `packages/cli/src` that may declare
`fs.realpathSync` — `backlog/confine.ts` and `run-history/reader.ts` — as *"a register of identities
rather than a count (Q-0073): a THIRD declaration fails here."* The `reader.ts` row's own reason
cites **Q-0092 OQ-1**, the landed ruling against publishing a path-returning confinement function.

And the reuse already exists here: `run-history/writer.ts:38` is
`import { isOneName } from '../backlog/confine.js';`.

**`pathInside` is the right predicate and `isFolderIn` is the trap.** `isFolderIn` requires
`inner.length === outer.length + 1` — *directly* inside, exactly one component — and an occurrence
directory is `steps/NNN-id`, **two** components below the run directory, **so it would refuse every
legitimate occurrence**. `pathInside` is strictly inside at any depth, refuses an absolute `rel`, and
resolves the deepest existing ancestor so a link standing at the destination is refused rather than
followed. Named here because the two sit in one file and the wrong one fails safe-looking and total.

### §0.7 The occurrence cases — and the ticket body's own sentence is keyed on the wrong field

Measured over every manifest:

- **`kind` is `adapter` 855, `integrate` 85, `script` 0.** The third member has **never** occurred.
- **No `prompt.txt` ⇔ `kind === 'integrate'`, and the correspondence is total** — 855 ↔ 855, 85 ↔ 0.
- **By `step_id` those 85 are `integrate` 73, `prove-red` 9, `merge-contracts` 3.** So a sentence,
  guard or fixture keyed on `step_id === 'integrate'` is **wrong about 12 of 85** on this
  repository's own data.

The ticket body's §*Two occurrence cases* says they "are `integrate` steps". That is true of **kind**
and false of **step_id**, and it is this repository's most-recorded defect class — a check keyed on a
name rather than on the behaviour, recorded seven times (Q-0051, Q-0067, Q-0073, Q-0107, Q-0108,
Q-0115, Q-0125) — sitting in the body this run was launched from. **AC-8 keys on `kind`.**

Because `script` has zero instances and `runScript` persists only `OUTPUT_FILE`, the honest rule is
***a prompt exists exactly where `kind` is `adapter`*** rather than *an integrate step has no
prompt*. No corpus can teach the `script` case; the rule must be total over the three.

**And there are three output cases, not two.** `terminal()` guarantees an `output.txt` — but behind
`fs.existsSync`, **which answers true for a directory**, a preserved defect pinned by
`writer.test.ts` (*"an `output.txt` that is a directory is left alone, silently"*). So:
*running and no output* is **not finished**; *terminal and no readable output* is **no output file
was retained** — a different sentence, and a real state rather than a hypothetical. candidate-claude
collapsed these two; candidate-codex separated them, and codex is right.

Measured now: occurrences with no `output.txt` are **zero**; **8 files are empty and every one is an
`output.txt`**; no `prompt.txt` is ever empty.

### §0.8 UTF-8 — the instrument is already built, and the corpus cannot teach the criterion

Over all 1,796 files under `TextDecoder('utf-8', { fatal: true })`: **0 are invalid**, and **16 are
well-formed and contain U+FFFD** — 14 at both earlier passes, the two new ones this run's own
prompts. So the naive test *does the decoded text contain a replacement character* would report
**sixteen real prompts as binary on the day it shipped**, which is Q-0127's E-3 trap at a second
corpus.

**The instrument exists**: `packages/server/src/read.ts`'s `asUtf8` is a whole-file fatal decode of
the bytes that were read, whose own JSDoc refuses a prefix decode and a byte-length comparison
against a second `stat`, and says in as many words that it is *not* a test for the replacement
character. AC-7 reuses it. **Zero invalid files means the criterion is unteachable from
`.quorum/runs`** and needs a constructed fixture (R-1).

**The store moved while it was measured, and the run doing the moving is this one:** 1,791 files at
launch, 1,794 at candidate-claude's pass, 1,796 here. That is not noise to smooth over — it is a
property a reader of this store must tolerate, and it is R-2.

### §0.9 The file-name set is open by the type and closed only by today's call sites

`persist(occurrence, name: string, text: string)` (`writer.ts:127`, `:598`) joins
`runDir / occurrence_dir / name` with **no check on `name` at all**. Every shipped caller passes one
of two constants, and `run-history.source.test.ts` pins that *"the writer never names an artifact —
its callers do"*.

So the constants register what the **writer's callers write**, not what a directory **holds**. A
listing derived from them would assert intent over contents, and would be blind to a file a human put
there, a file a human deleted, and the directory of §0.7. **List the directory** (AC-1, AC-13).

---

## §1 Problem

A maintainer looking at a finished run wants to know what a step was actually sent and what it
answered — why the reviewer said that, what the implementer was handed, whether the diff the panel
saw was the one they think it was. Q-0018's screen names every occurrence: its sequence number, step
id, kind, status, adapter and duration. **It can open none of them.**

The text is on disk and it is almost all of what run history is — **1,796 files, 116,798,098 B,
99.3% of the store**. The product wrote every byte and has never read one back.
`apps/web/src/history-screen.tsx` says so in its own words — *"What it retained is not named and not
claimed"* — and `apps/web/src/routes.ts:257` names this ticket by id in the sentence the shell shows
a reader.

**The last unread thing is the most expensive thing.** The store's largest file is 353,626 B of
review prompt. A maintainer asking *what did that review actually see* is asking about the one
artifact this product has no way to show them.

---

## §2 User stories

**Maintainer.** *As a maintainer debugging a run that went the wrong way, I want to open the prompt a
step was sent and the output it returned, from the screen that already names that step, so that I can
tell a bad instruction from a bad answer without leaving the product for a shell.*

**Maintainer, second.** *As a maintainer reading a run that is still going, I want the screen to tell
me an occurrence has not finished rather than show me nothing, so that I can tell `this step has not
answered yet` from `this step's record is damaged`.*

**Contributor.** *As someone writing a vendor adapter, I want the exact prompt my adapter was given
and the exact text it returned, byte for byte and with nothing normalised, so that I can debug a
structured-output failure against what actually crossed the boundary.*

---

## §3 Surfaces

`packages/core` (two functions), `packages/server` (two routes), `packages/shared` (the wire shapes),
`apps/web` (the drill-down inside Q-0018's occurrence timeline), `docs/04-architecture.md`,
`docs/GLOSSARY.md`.

---

## §4 The three decisions, and the measurement behind each

### §4.1 The listing is its own route, and it does not ride on `GET /history/:id`

**This is where the candidates disagree and the disagreement is decided by a defect rather than by
taste.** candidate-codex widens `GET /history/:id` to carry `files` per occurrence — which is
Q-0127's shipped shape, and the departure has to be justified rather than assumed. Three
measurements justify it.

1. **`GET /history/:id` is mission control's route.** `mission-control-screen.tsx` calls
   `fetchRunHistory` — *"One history read per metadata answer that carried a run"* — on every load.
   Under codex's shape that screen pays up to **55 `readdir` plus ~110 `stat` calls** (`Q-0015-4`
   holds 55 occurrences) for a screen that will never fetch a retained file.
2. **It makes a documented property false.** `readRun`'s JSDoc is *"**It reads exactly one file.**"*
   (`reader.ts:268`, citing Q-0034 AC-13). Walking a directory tree behind it retires that sentence,
   and makes the response a function of the filesystem beyond the manifest.
3. **The decisive one — codex's AC-12 collapses a per-occurrence refusal into a whole-run refusal.**
   It answers **HTTP 422 for the entire run** when one occurrence's directory is unsafe or
   unreadable. That takes mission control's cost and duration header down with it, and it
   contradicts the landed discipline at `read.ts:477`: *"The listing is returned WITH its warnings
   rather than instead of them — `failSoftly`'s distinction … A store a reader could partly read is
   not an error."* Q-0119 built that property and Q-0018 inherited it; one damaged occurrence must
   not cost a reader the other fifty-four.

So: **a separate, run-scoped listing route**, one request when a row opens, and
`GET /history/:id` is untouched. A single refused occurrence is a **warning beside a 200** (AC-4).

*Refused and recorded so it is not re-derived:* a `?files=1` flag on the detail route. It costs
mission control nothing, and it makes a response's shape depend on a query parameter's presence — a
branch every client carries for ever. Two routes is cheaper than one route with two shapes.

**On spelling.** The recommended pair is **`GET /history/:id/retained`** (the listing) and
**`GET /history/:id/file`** (the bytes). *retained files* is `docs/GLOSSARY.md`'s own wording in the
**Occurrence** entry, so it coins nothing; and it avoids a `/files` ~ `/file` pair differing by one
character, which is the near-homograph Q-0127's E-2 refused on the ground that both readings survive.
**The spelling is not pinned** — a requirement describes what must be conveyed (Q-0094 E-3) — and an
implementer taking `/files` instead is not deviating, provided both registers and the architecture
document move together (AC-14).

### §4.2 One file at a time, which is why Q-0076's premise does not move

A listing of `{name, bytes}` with one file fetched on demand caps what a reader ever receives at
**355,744 B**, against the **1.46 MB** single file `GET /tickets/:id/file` has served with no cap
since Q-0127. Serving a run's text in one response is **3,514,617 B** and **would make Q-0076 this
ticket's blocker**. That design is not taken, and **no cap is specified anywhere** — nothing large is
fetched unless a reader names that file with its size in front of them, which is Q-0127's answer to
the same question reused rather than restated.

### §4.3 No path crosses `core`'s boundary, in either direction

`resolveRunDirectory` is deliberately off the barrel (verified: `index.ts:124` exports six
run-history values and not it), because publishing a path-returning function whose only correct use
is to be opened immediately leaves a caller free to resolve lexically and read anyway — **ruled, not
offered**; `REALPATH_SITES`'s own reason cites Q-0092 OQ-1 by name.

So both new functions take `(runsRoot, token, …)`, resolve internally exactly as `readRun` does, and
**never return a path**. `packages/server` composes no filesystem path at any point — the property
Q-0018's E-1 made checkable for its own half, inherited here in the opposite direction: *this ticket
joins paths, and it joins them in exactly one module.*

**Two mechanisms, neither substituting for the other.** **Membership** is derived for *this* request
from the directory itself, never from a listing the client fetched earlier — it closes the client's
file name, and since `persist` accepts any `name` (§0.9) it is also what makes a name the writer
*could* have created but did not, unreadable. **Confinement** is `pathInside` over the manifest's own
`occurrence_dir`, inside `core` — it closes the value the client never sees and nothing validates.
`readRun`'s contract is untouched: a traversing manifest is still **reported as it stands**, and
refused at the **join**.

---

## §5 Acceptance criteria

*Fourteen. **AC-3 and AC-14 are named now as not eligible for trimming** if the review loop
exhausts — AC-3 because it is the ticket's one security property and its subject exists in no test
today, AC-14 because a document correction deferred to a successor is one that expires (Q-0110,
Q-0111 and Q-0112 each lived inside a closed ticket's prose, Q-0100's inside a source comment).
Named in advance because Q-0122's E-1 did and Q-0126 paid $177.92 for not having.*

---

**AC-1 — `core` names and measures one run's retained files without opening one.**

A new exported function answers, for one run token, every occurrence's retained files as
`{ name, bytes }` — `bytes` from `stat`, nothing opened — keyed by the occurrence's `seq`, with a
warnings channel for occurrences it cannot name. Each `name` is one **leaf** name: non-empty, neither
`.` nor `..`, containing no `/` or `\`. Entries are sorted by name. A directory entry that is **not a
regular file** — a directory, a symlink, a socket — is **skipped rather than measured**, which is
`listTicketFiles`'s shipped rule (*"A name that stands there and is not a regular file has no size to
report and no bytes to serve"*). An occurrence whose directory is **absent** is named in warnings;
one that is **present and empty** lists zero files — different answers, the second reachable while a
run is live between `allocate`'s `mkdirSync` and the first `persist`.

*Test:* over a constructed store — an adapter occurrence with two files, an integrate occurrence with
one, one whose directory holds a **directory named `output.txt`** (skipped, not measured, not an
error), one whose directory was removed (a warning), and one that is empty (zero files, no warning).
Sizes are asserted against `stat`. The function is asserted to **open nothing** — a spy over
`readFileSync`/`openSync` records zero calls across the whole invocation.

---

**AC-2 — `core` reads exactly one retained file's bytes, with membership and the read in one call.**

A second exported function answers the **bytes** of one named file of one occurrence of one run, or a
discriminated outcome saying why not. It returns a `Buffer` and never text — `readFileSync(file,
'utf8')` substitutes U+FFFD and does not throw, so a caller that must characterise the bytes has to
be handed what was read. Membership is enumerated **for that invocation**; a name that was not in
*this* enumeration is refused. The descriptor is opened once and `fstat`ed, and the read is from that
descriptor — `readTicketFileBytes`'s discipline, which is Q-0122's TOCTOU fix reused rather than
re-derived. One whole read, no truncation, no pagination, no normalisation.

*Test:* the bytes of a known file are returned identically to `fs.readFileSync` of it; a name the
occurrence does not hold is refused; a name that is a **directory** is refused rather than read; a
file removed between enumeration and read is refused rather than throwing. A mutation replacing the
`fstat`-on-descriptor with `statSync`-then-open-by-name is shown red.

---

**AC-3 — a traversing `occurrence_dir` is refused, and nothing is joined until it is.** *(Not
eligible for trimming.)*

Every join of a manifest's `occurrence_dir` is confined against that run's own **resolved** directory
with `pathInside` before anything is opened or enumerated. A manifest carrying
`occurrence_dir: "../../../outside"`, an absolute path, or a value resolving outside the run
directory through a symlink is **refused** — the occurrence is named in AC-1's warnings and AC-2
answers a refusal — and the manifest is **not repaired, not rewritten and not withheld** from
`GET /history/:id`, which goes on reporting it as it stands.

*Test:* a constructed manifest whose `occurrence_dir` is, case by case, `'../escape'`,
`'steps/../../escape'`, `'/etc'`, and a single-segment name that is a **symlink** pointing outside
the run directory. Each is refused with a message naming the condition; in the symlink case a file is
planted at the target and asserted **unread**, and no outside name or byte appears in any answer; the
fixture is asserted unmodified. Additionally: `fs.realpathSync` still appears in exactly the two
files `REALPATH_SITES` names, and the new code reaches its boundary through `backlog/confine.js` —
the import `run-history/writer.ts:38` already makes. **A third declaration fails that register by
file name**, which is the check on this criterion rather than a neighbour of it.

---

**AC-4 — the listing route answers one run, and a run it can partly read is partly answered.**

The listing route resolves the token exactly as `GET /history/:id` does and tells its two failures
apart on the same rule — a token naming no run directory is **404 `no-such-run`**, a manifest that
would not parse is **422 `malformed-manifest`** carrying the reader's own message, because answering
404 to both reports a run that *is* there as absent (*"A probe that could not answer is not a
negative"*, 2026-09-10). A run it **can** read answers **200** with its occurrences and a `warnings`
array naming every occurrence it could not. **A single refused occurrence never takes the run's
listing with it**, and never makes `GET /history/:id` answer anything but what it answers today.

*Test:* a sound run lists every occurrence; a run whose third occurrence carries a traversing
`occurrence_dir` answers **200** with the others listed and that one named in `warnings`, asserted by
**content** rather than by length; a token naming nothing is 404 with the code; a manifest that is
not JSON is 422 with the code. `GET /history/:id`'s response over the same damaged store is asserted
**unchanged**.

---

**AC-5 — the file route answers one file's bytes as text, and each refusal has its own code.**

The occurrence and the file name are **query values**, not path segments. The occurrence value must
be a base-10 non-negative safe integer with no sign and no fractional part; the name must satisfy
AC-1's leaf-name rules. Both are validated **before any retained file is read**. Each refusal is
decided by a predicate rather than by matching an error's prose, on `ticketFor`'s stated rule, and
carries the existing wire refusal shape naming the condition **without exposing an absolute path**:

| condition | status | code |
| --- | --- | --- |
| the token names no run directory | 404 | `no-such-run` |
| the manifest would not parse | 422 | `malformed-manifest` |
| the occurrence or name query value is missing or malformed | 400 | `not-a-file-name` |
| the occurrence value matches no occurrence | 404 | `no-such-occurrence` |
| the occurrence value matches more than one | 409 | `ambiguous-occurrence` |
| the occurrence's directory is refused by AC-3 | 422 | `unsafe-occurrence-directory` |
| the name is not in this request's own listing | 400 | `not-an-occurrence-file` |
| a listed name that has stopped being a regular file | 404 | `no-such-file` |
| the bytes are not well-formed UTF-8 | 422 | `unsupported-file-encoding` |

**`not-an-occurrence-file` and `no-such-file` are never collapsed**: the first says the name was never
this occurrence's, the second that it was and is no longer. A replacement that has become a symlink
is the second and its target is **not followed**.

*Test:* each row, asserting the status **and** the code. The stale-listing row is **staged rather
than reasoned about** — the file is removed between the internal enumeration and the read, on
Q-0127's round-4 precedent, which staged a race a finding had said no test could stage.

---

**AC-6 — the occurrence identity is `seq`, `occurrence_dir` is never an input, and ambiguity is refused rather than guessed.**

The client names an occurrence by **`seq`**, the field `WireRunHistoryOccurrence` declares. Both
routes **reject `occurrence_dir` as an input under every spelling**: it crosses to the browser today
only because `read.ts:521` spreads the whole step through a `looseObject`, and it is not even named
in that schema's own enumeration of what crosses loose (§0.4), so accepting it would ratify an
accident as a contract. `core` finds the manifest occurrence whose `occurrence_dir` yields that
sequence.

A `seq` matching **no** occurrence is 404. A `seq` matching **more than one** is **409
`ambiguous-occurrence`**, naming the run and the value — because `occurrenceSeq` answers
`Number.MAX_SAFE_INTEGER` for a directory name it cannot read, so two unreadable entries collide, and
*more than one* is not *none*. AC-4's listing **omits a colliding `seq` from its addressable
entries and names both occurrences in `warnings`**, so nothing the listing offers is unfetchable and
nothing fetchable is unlisted.

*Test:* a manifest with two occurrences whose directory names carry no readable prefix — the listing
names neither under a `seq` key and warns about both; the file route answers 409 with the code rather
than serving either. A request supplying `occurrence_dir` in place of `seq` is refused at the shape
check, and a guard asserts that neither handler reads a query key named for the directory.

---

**AC-7 — bytes that are not well-formed UTF-8 are refused under their own code, taken with the decoder that serves them.**

**422 `unsupported-file-encoding`**, decided by `read.ts`'s existing `asUtf8` — a whole-file fatal
decode of the bytes that were read. **No second decoder is written in this package.** The refusal is
**not** a test for U+FFFD: 16 of this store's own prompts contain that character legitimately and 0
of 1,796 files are invalid, so that test would report sixteen real prompts as binary on the day it
shipped.

*Test:* a constructed file holding a lone `0x80` is refused 422 with the code; a file holding U+FFFD
as valid UTF-8 is **served**; a file holding a four-byte character spanning the midpoint of the buffer
is served, which is the prefix-decode failure the instrument's own JSDoc names. An empty file
succeeds.

---

**AC-8 — three occurrence sentences, all keyed on `kind` and none keyed on `step_id`.**

1. **No prompt** — *no vendor was asked.* Said from `kind`, which is total over
   `adapter | script | integrate`, and **never from `step_id`**: the 85 such occurrences here carry
   three different step ids (`integrate` 73, `prove-red` 9, `merge-contracts` 3), so a `step_id`-keyed
   sentence is wrong about **12 of 85** on this repository's own data.
2. **No output, status `running`** — *this step has not finished.* Never "damaged".
3. **No output, status terminal** — *no output file was retained.* A **different** sentence and a
   real state: `terminal()`'s guarantee sits behind an `existsSync` that answers true for a
   directory, a preserved defect this ticket declines to trip over rather than fix.

None of the three renders as a blank, an error or an empty list.

*Test:* the sentence is derived for each of the three `kind` values, **including `script`**, which
this store has never produced. A fixture with `step_id: 'prove-red'` and `kind: 'integrate'` gets
sentence 1 — the clause that goes red against a `step_id`-keyed implementation. A `running`
occurrence with a prompt and no output gets 2; a `completed` occurrence with no readable output gets
3, and **is asserted not to get 2**. **The count of such occurrences is asserted nowhere** — it has
read 1, 0, 1 and 0 across four passes (§0.7).

---

**AC-9 — the wire shapes are declared once in `@quorum/shared`, with runtime schemas.**

The listing response, its file-metadata element and the file response are named interfaces with zod
schemas beside them. This transport composes all three, so all three are **`.strict()`** on the
levelling rule *"Unknown keys are refused where Quorum owns the key set, and preserved where it does
not"* (2026-08-25) — as `WireRunHistoryRow` is and `WireRunHistory` is not. The success body is
`{ name, bytes, text }`, where `bytes` is the length of the bytes **actually read** and never the
size the listing reported, and an empty file succeeds with `bytes: 0, text: ""`. The names sit inside
the `WireRunHistory` family and **reuse neither `manifest`** (Q-0127 E-2's homograph rule) **nor
`artifact`**, which the glossary spends on **Emitted artifact**; the glossary's own words for the
subject are *retained files*. Server and browser do not redeclare either shape.

*Test:* each schema refuses an unknown key and refuses a `bytes` that is negative or non-integer; the
barrel exports every type and schema; `apps/web` parses a real response **through the schema** rather
than casting.

---

**AC-10 — the screen names each occurrence's retained files with their sizes, and one opens.**

Inside Q-0018's opened row, each occurrence names its retained files in the order received, each with
its byte count, and choosing one renders its complete text in a whitespace-preserving, scrollable
region. A file name is a **button, not a filesystem link**. The browser sends the run id, the
occurrence `seq` and the file name, and **never receives or composes `occurrence_dir`**. **Nothing
large is fetched until a reader names that file with its size in front of them.** Every refusal AC-4
to AC-7 can produce renders a sentence a reader can act on, and **no state is a blank panel, a
spinner or a skeleton** (`04-architecture.md`'s placeholder rule). An occurrence AC-4 warned about
says so rather than appearing to have retained nothing.

*Test:* a fixture with two occurrences renders both file names and both sizes and issues **no file
request** until one is chosen; choosing one renders its text; each refusal code renders its own
sentence, asserted by content; a warned occurrence renders its warning rather than an empty list.
`history-screen.tsx`'s *"What it retained is not named and not claimed"* docblock and
`routes.ts:257`'s `waitingFor` sentence are both replaced.

---

**AC-11 — the four request states, and a late answer never lands under the wrong selection.**

A file control visibly distinguishes **loading**, **loaded-empty**, **failed** and **loaded-with-text**.
Selecting another file replaces the displayed one; a response for a file that is no longer selected
must **not** reopen or overwrite the current selection, on `history-screen.tsx`'s existing generation
rule. Closing an occurrence discards its response rather than retaining a hidden cache. A retry
repeats **only** the failed request.

*Test:* each of the four states is asserted by content, loaded-empty distinguished from loading; two
selections are issued and the **first** resolved last, asserting the second's text is displayed;
closing a row while a request is out settles nothing; a retry after a failure issues one request.

---

**AC-12 — one listing request per opened row, and none per occurrence.**

Opening a row issues **at most one** listing request beside the detail request it already makes, and
no request is issued per occurrence as occurrences render.

*Test:* a counting fetcher over a fixture with **more occurrences than fit a viewport** — Q-0018's
R-2 rule, that a request-count assertion over a three-row fixture proves nothing — asserts exactly
one listing request for one opened row and zero further requests. Opening a second row while the
first is out lands the second's answer only.

---

**AC-13 — an unknown retained name is listed and opens, and nothing anywhere is written.**

A retained file whose name is neither `prompt.txt` nor `output.txt` is listed with its size and opens
with the same behaviour, **requiring no server or browser code change** — the positive half of
§0.9's *list the directory*. And listing or reading creates, repairs, rewrites, touches or deletes
**nothing** under `.quorum/` or elsewhere, including for a manifest AC-3 refuses.

*Test:* an occurrence directory holding a third file is listed and served with no change to any
name register; a snapshot of the whole constructed store — every path, size and mtime — is asserted
identical after exercising both routes across the sound, refused, ambiguous and malformed cases.

---

**AC-14 — the registers and the documents this change makes incomplete are moved, on both sides.** *(Not eligible for trimming.)*

`packages/server/src/package.test.ts` pins the registered route set as an **identity** and requires
each route to appear **verbatim** in `docs/04-architecture.md`'s `### \`packages/server\`` section;
both new routes join both. That document also states that occurrence confinement and byte reading are
`core`'s, that file content is fetched one file at a time, and that the browser never receives
`occurrence_dir`. On the browser side each new path segment earns a row in
`apps/web/test/routes.test.ts`'s `EXCEPTION_REASONS` with its reason, as `/stop`, `/gate`, `/gates`
and `/diff` already have. And `docs/GLOSSARY.md`'s **Confinement** entry — which says *"Two roots are
confined this way"* and describes the run-history root as *"a run id names a directory directly
inside `.quorum/runs`"* — gains the clause that a **second path inside that same root**, the
occurrence directory the manifest names, is confined too, by a different predicate, because it sits
two components deeper. That description is **incomplete rather than false** today. **No term is
coined and no synonym introduced**: *retained files* is the **Occurrence** entry's own wording.

*Test:* the route identity asserts both new entries; removing either from the architecture document
turns the verbatim guard red; removing an exception row turns the path-literal guard red; the
glossary clause is asserted present and the term list in `CLAUDE.md` and `docs/README.md` is asserted
**unchanged and identical**, which is Q-0108's check confirming nothing was coined.

---

## §6 Non-goals

1. **Q-0018's half is not reopened.** The listing, the table, the widened wire shapes and the
   occurrence timeline shipped; this adds retained files to them.
2. **No event is persisted and no event gains a field.** A finished run has no event stream — this is
   an occurrence's retained text, never a trace.
3. **`GET /history/:id` is not widened**, and its *"reads exactly one file"* property is preserved
   (§4.1). Mission control's behaviour does not change.
4. **`readRun` is not changed.** *"A cast, never a check"* and *"repairs nothing"* both stand; the
   confinement lives at the join.
5. **The CLI is not changed.** `quorum runs <id>` keeps printing the occurrence path and gains no
   file rendering. That it would print a normalised path for a traversing `occurrence_dir` is a
   **display** consequence of a manifest nobody has, not a read.
6. **No cap, retention policy or eviction — and the boundary with Q-0076 is sharper than "Q-0076 owns
   any cap".** Q-0076's subject is the **write** side: nothing bounds what `persistArtifact` writes.
   A **read-side response bound** is this ticket's, and the answer is **none**, measured (§4.2). If
   the design taken crosses that boundary, **stop and route it to Q-0076** rather than inventing a
   limit here.
7. **No manifest is repaired**, including one whose `occurrence_dir` is refused.
8. **No download, content negotiation, range request, pagination, streaming or compression.**
9. **No Markdown rendering, syntax highlighting, diff view, search, copy or edit control.**
10. **The `output.txt`-as-a-directory defect is not fixed.** It is landed preserved behaviour; this
    ticket only declines to trip over it, and AC-8's third sentence is what that costs.
11. **No backlog route serves this**, and Q-0127's `.harness/` exclusion is untouched.
12. **No dependency, no adapter invocation, no worktree, no gate change, no API-key path.** Neither
    installation path changes and the cold-clone path does not lengthen.

---

## §7 Open questions

**All four are answered. None blocks solutioning.**

**OQ-1 — may a route serve a *file* under `.quorum/`? — ANSWERED; see §8.**

**OQ-2 — `seq` or array position as the identity? — ANSWERED: `seq`, with ambiguity refused
(AC-6).** Position is unique by construction and is refused anyway: matching two independent
responses by position is an implicit contract, and the manifest is replaced on every terminal
occurrence, so a client would be relying on append-only ordering nothing states.

**OQ-3 — one route or two? — ANSWERED: two (§4.1).** The `?files=1` flag and the widened detail route
are both recorded as refused, with the `failSoftly` defect that decides it.

**OQ-4 — the two name constants or the directory? — ANSWERED: the directory (§0.9).** `persist` takes
the name as a `string` parameter and confines nothing; the constants register what the writer's
**callers** write, not what a directory holds.

---

## §8 The ruling on OQ-1

**May a route serve a file under `.quorum/`? Yes, and no decision entry is owed.** The ruling belongs
in the listing function's own authority comment and in one sentence of `docs/04-architecture.md` —
Q-0108's precedent, that a ruling which changes no behaviour and contradicts no landed entry belongs
in the code's authority comment.

**The gitignore fact is not the discriminator, and checking it is what shows that.** Q-0127's erratum
E-1 excluded `.harness/` on the reasoning that it is gitignored and git tracks none of it. **`.quorum/`
is gitignored on the adjacent line of the same file and git tracks zero files under it.** If that were
the discriminator, `GET /history` and `GET /history/:id` would both be violations — and they have
shipped since Q-0119, been widened by Q-0018, and are read by two screens. **So the premise E-1 rests
on does not decide this**, a conclusion available only by measuring it rather than by reasoning from
E-1's shape.

**What decides it is that `.quorum/` is named as the database.** `.claude/rules/engineering.md` and
`harness/rules.md` both say *"Anything persistent is a file in `backlog/`, `harness/`, or
`.quorum/`"*. What E-1 excluded was **a different subsystem's state appearing inside a ticket
folder**, and `packages/shared/src/wire.ts:737` says exactly that in its own words — a ticket's
listing names no dot-path because *"naming the paths would make a backlog route a second run-history
surface, **which is Q-0018's**"*. **Q-0127 ruled that engine run state may not be served from the
backlog route, and forwarded this subject here by name.** E-1's own closing clause is about
`.harness/`, a different tree, and does not reach.

**So the authority question was answered by shipped code and a landed rule, and what was open is
payload** — the ticket body's own launch reading, confirmed by measurement rather than inherited: one
file at a time is **353,626 B** at this store's worst, against the 1.46 MB single file Q-0127 already
serves uncapped. **A payload question wearing an authority question's clothes**, answered by a design
that never serves more than one file.

**The test this repository applies — *does any landed sentence go false?* — applied at six sites
rather than assumed.**

1. **Two routes are added**, so `04-architecture.md`'s enumeration changes in **content**. Adding
   read-only routes is precedented without an entry three times: Q-0119 five, Q-0121 two, Q-0134 one.
   AC-14 moves the register and the document together.
2. **Nothing new is persisted and no event gains a field** — *"Files are the database"* and the
   **Event** term are untouched.
3. **No dependency is added.**
4. **No glossary term is coined.** **Confinement**'s enumeration becomes *incomplete rather than
   false*, which AC-14 closes with a clause.
5. **`readRun`'s *"a cast, never a check"* stays true**, the check living at the join (§4.3).
6. **`resolveRunDirectory` stays off the barrel** and no path-returning function is published, so
   Q-0092 OQ-1 is honoured rather than narrowed.

**If an implement step finds a landed sentence this misses, that is an erratum's subject and not a
thing to work around — say so and stop, which is what `verdict: blocked` is for (Q-0083).**

---

## §9 Risks

**R-1 — three criteria cannot be learned from this store, and all three are load-bearing.** Zero
traversing `occurrence_dir` values, zero invalid-UTF-8 files and zero non-regular directory entries
exist on disk, and `kind: 'script'` has never occurred. AC-3, AC-7, AC-1's third clause and AC-8's
`script` case are therefore constructed fixtures, and each **must be shown red against an
implementation that omits the check** rather than observed green. Their `Test:` clauses forbid
drawing from `.quorum/runs`.

**R-2 — the store moves under a reader, and this is the first surface where that is ordinary rather
than staged.** Measured across four passes during this ticket's own life: 1,791 → 1,794 → 1,796
files. So AC-5's *a listed name that has stopped being a file* is reachable in normal operation,
where Q-0127's equivalent needed a hooked `statSync`. Two consequences to meet as design rather than
as bugs: the response reports the size of what was **read**, never what was listed; and an occurrence
with no `output.txt` is the ordinary state of a step now running.

**R-3 — the confinement is the kind of check that gets written once and bypassed by its own
neighbour.** Q-0059's review found three path escapes, one per round, ending in a blocker where a
dangling symlink made `write` create its own target; Q-0122's two review blockers both landed on the
one criterion its erratum had named as not eligible for trimming. Both tickets predicted the class and
walked into it anyway, and the cross-vendor panel is what caught it. The one thing an implementer must
not do is model the guard on Q-0127's without reading §0.3 — **there the untrusted value arrived over
HTTP, and here it arrives from a file this product wrote and does not re-check** — and the one
predicate they must not reach for is `isFolderIn`, which would refuse every legitimate occurrence
(§0.6).

**R-4 — a screen is where a measured rule goes quiet.** AC-8 is invisible in any rendering test whose
fixture holds two well-formed adapter occurrences. The fixture must be hostile: an occurrence with
`kind: 'integrate'` and `step_id: 'prove-red'`, a `script` occurrence this store has never produced, a
`running` occurrence with no output, a **terminal** occurrence with no output, and an occurrence AC-4
warned about.

**R-5 — the review will probably not be truncated, and the prediction is made rather than assumed.**
`repo.max_diff_bytes` is 200,000 and read at run start. Q-0129's four rounds fell to 70.2% and lost
`events.ts`, its own subject; Q-0135's fell to 87.9% and lost `wire.ts`; **Q-0018's did not truncate
at all**, and this change is Q-0018's shape — two core functions, two routes, three wire shapes, one
screen region. `git diff` orders by path and the alphabetical tail is again
`packages/shared/src/wire.ts`, AC-9's own subject. GO-4 is the remedy if the prediction fails, and a
refutation is itself worth recording: this would be the third consecutive data point that the cap
tracks change size rather than ticket ambition (Q-0128).

---

## §10 Gate obligations

**GO-1 — ratify or refuse §8 at the gate, and record it as an erratum either way. This is the one
that will cost a round if it is missed.** The implement step reads `requirements/errata.md` and
**not** `ticket.md` (Q-0125 E-1), and **the ticket body carries OQ-1 marked BLOCKING**. If §8 stands,
the erratum must say so **by name**, or the implementer meets a live blocker and `blocked` is the
verdict it will correctly return on round one — which is Q-0125's E-1 exactly and Q-0062's three
wasted rounds before it. **Verify the erratum is present in the implement step's actual `prompt.txt`
by grep rather than assuming it** — the check Q-0097 lost two errata by not making, and which Q-0125
and Q-0129 both performed.

**GO-2 — the size is ruled at fourteen and the ticket is deliberately not split.** The available seam
— core plus routes, then the screen — is refused: separating a route from the screen that consumes it
leaves a route with no consumer to prove it against, which is what Q-0127's gate reasoned and what
Q-0121 recorded as a cost in its own R-1. **AC-3 and AC-14 are already named as not eligible for
trimming.** If the loop exhausts, the remedy is an erratum splitting at that seam, **not a fourth
implement round** (Q-0122's E-1 discipline).

**GO-3 — the contract note, if one is owed, is written by hand at the gate.** `contracts/` is not
among `developer-generalist`'s roots, which cost Q-0129 an implement round and Q-0131 and Q-0134 a
hand edit each. If the design changes anything `contracts/Q-0011/run-manifest.schema.json` or a
Q-0015/Q-0018 contract note states, that note is the human's and is written before the run.

**GO-4 — measure the review's coverage and say so.** Record, per round, the diff bytes against the
cap and the files that got **no patch at all**. If any round is truncated, the omitted files are
reviewed by hand cross-vendor and the result recorded — the pattern Q-0124's warn and Q-0117's
`observation:` channel have composed on four consecutive tickets, and which Q-0135's hand pass proved
worth checking rather than trusting.

**GO-5 — discharge by running the product and transcribing what it rendered.** Not by a report and
not by a test. Start a real daemon with `quorum open`, **verify the served bundle carries this
change's own code by content first** — a cache hit can serve a page built from code nobody is looking
at — open run history, open a row, and transcribe into `runs.log`: the occurrence list with its file
names and sizes, one file opened and its first line, the sentence a no-prompt `integrate` occurrence
renders, and the sentence a still-running occurrence renders. **Written to be unfakeable because
Q-0016's equivalent was reported discharged when its by-hand half had not been performed**, and
Q-0015's gate is what found that.

**GO-6 — verify forced in both environment rows**: a detached worktree with neither
`.harness/worktrees` nor `.quorum/runs`, and `main` after the merge, with `quorum lint` and the
git-identity sweep green in each.

---

## §11 Provenance

**candidate-claude is the spine.** Its three decisive findings were each re-verified at this gate and
each holds: the `kind`-versus-`step_id` trap (§0.7), which refutes the ticket body's own sentence and
is the single most valuable thing in either document; `pathInside` against `isFolderIn` (§0.6), a trap
that fails safe-looking and total; and `occurrence_dir` crossing the wire undeclared (§0.4). §4.1's
route design, §4.3's no-path-crosses-the-boundary rule, §8's OQ-1 ruling, the `REALPATH_SITES`
constraint, the `asUtf8`/`listTicketFiles`/`readTicketFileBytes` reuse, and GO-1, GO-4 and GO-5 are
all its work.

**candidate-codex supplied what claude was thin on, and one thing claude got wrong.** Its **AC-23 —
a *terminal* occurrence with no `output.txt`** — is a third case claude's binary framing missed, and
it is reachable rather than hypothetical because the writer's guarantee sits behind an `existsSync`
that answers true for a directory; it is AC-8's third sentence here. Also taken: the success body
`{name, bytes, text}` with the empty-file case (AC-9), the four browser request states and the
late-response rule (AC-11), the unknown-retained-name criterion (AC-13), the query-value validation
before any read and the explicit `not-an-occurrence-file` / `no-such-file` separation (AC-5), the
read-only assertion (AC-13), and the explicit naming of symlinks among what a listing skips (AC-1).

**Where they disagreed, claude was picked and the reason is a defect rather than a preference.**
codex's AC-12 widens `GET /history/:id` and answers **422 for the whole run** when one occurrence's
directory is unsafe — which takes mission control's header down with it and contradicts the landed
`failSoftly` discipline at `read.ts:477`. That is §4.1, and it is why the departure from Q-0127's
shipped listing-on-the-detail-route shape is justified rather than merely different.

**codex's 28 criteria were cut to fourteen.** Its AC-1/AC-7, AC-5/AC-6 and AC-2 overlap substantially,
AC-27 is a test plan rather than a criterion, and AC-28 is a non-goal list wearing a criterion's
clothes — all are folded into the criteria they belong to or into §6. claude's thirteen were kept
with its AC-12 and AC-13 merged into AC-14, both being *the registers and documents this change makes
incomplete are moved*.

**What is this gate's own and in neither candidate:** the measurement that `Occurrence` has exactly
fifteen fields and that `occurrence_dir` is the fifteenth, **absent from the very docblock that
enumerates what crosses loose** (§0.4); the `failSoftly` precedent at `read.ts:477` as the thing that
settles §4.1; the U+FFFD count having moved 14 → **16** during this run; the ruling on the `/files` ~
`/file` near-homograph and the recommendation of `/retained` with the spelling explicitly **not**
pinned (§4.1, Q-0094 E-3's rule); and GO-2's refusal of the available split with its reason.
