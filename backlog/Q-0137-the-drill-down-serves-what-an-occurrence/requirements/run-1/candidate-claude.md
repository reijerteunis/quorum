# Q-0137 — The drill-down serves what an occurrence retained

*Requirements, run 1, candidate-claude. Written 2026-09-18 against the tree at the time of writing.
Every figure below was re-derived; none is transcribed from the ticket body, from Q-0018's Appendix A,
or from this ticket's own launch re-measurement.*

---

## §0 What was measured, and what moved

**The store was mutating while it was measured, and the run doing the mutating is this one.** Every
figure is from one consistent pass at **21:21:50Z on 2026-09-18**; a pass ninety seconds earlier gave
938 occurrences against 940 and 116,639,410 B against 116,655,192 B. That is not noise to be smoothed
over — it is a property a reader of this store has to tolerate, and §0.6 is where it becomes a
criterion.

### §0.1 The store

**173 run directories · 940 occurrences · 1,794 retained files · 116,655,192 B.** Retained prompt and
output text is **99.3%** of `.quorum/runs`; the 173 `manifest.json` are 783,860 B, or 0.67%.

Per occurrence: max **355,744 B** (`Q-0129-3/steps/009-review`), median **99,665.5**, p90
**237,127.5**, min 0. Per run: max **3,514,617 B** (`Q-0015-4`), median **459,758**. Largest single
file **353,626 B** — `Q-0129-3/steps/009-review/prompt.txt`, and **the three largest files in the
store are all prompts, not outputs**.

Occurrences per run: max **55** (`Q-0015-4`, the nine-task development fan-out), modal 3. Files per
occurrence: **86 hold one, 854 hold two, and none holds zero or three**.

### §0.2 Nothing in this product has ever read one of these files

`grep` for `prompt.txt`, `output.txt`, `PROMPT_FILE` and `OUTPUT_FILE` across `packages/server/src`
and `packages/cli/src` returns **nothing**. `core`'s reader offers `resolveRunDirectory` and `readRun`
and no file read of any kind. So the drill-down is **the first reader of a retained file on any
surface this product has** — not the first on the web.

**What exists instead is a printed path.** `packages/cli/src/runs.ts:219` composes
`path.join(RUN_HISTORY_ROOT, runId, step.occurrence_dir)` and prints it dim beside the step id. That
is the product's whole answer today: `quorum runs <id>` tells a maintainer where the bytes are and
they run `cat`. It is also **the only site anywhere that joins `occurrence_dir` into a path outside
the writer**, and it is a rendering rather than a read — worth naming so a reader does not mistake it
for a precedent for joining (§7 NG-5).

### §0.3 The confinement threat, stated precisely — and it has one half, not two

The ticket body says the threat "is not where a reader will look for it", and that is right. What it
does not say is that **the client half is structurally absent**, which changes the shape of the work.

- **The run id** is confined already. `resolveRunDirectory` (`reader.ts:211-219`) refuses a token that
  is not one name, resolves both sides with `realpathSync`, requires exact parent equality with the
  runs root, and requires the result to exist and be a directory.
- **The file name** comes from the client and is closed by membership, on Q-0127's rule.
- **`occurrence_dir` comes from the manifest and nothing validates it.** `manifestShapeError`
  (`reader.ts:88-96`) proves five things — `run_id`, `ticket_id` and `status` are strings, `steps` and
  `rollup` are arrays — and **no occurrence field is checked anywhere on the read path**.
  `RunEntry.manifest` and `RunRead.manifest` both carry the JSDoc *"A cast, never a check"*
  (`reader.ts:43`, `:229`, `:247`). The only code that inspects `occurrence_dir` at all is
  `contracts/run-manifest.ts:131`, which checks for **duplicates** and runs only under
  `quorum validate`.

**No test in either package stages a traversing `occurrence_dir`.** Verified: every such literal in
the tree is well formed, and the nearest thing to hostile input is
`packages/cli/src/runs.test.ts:418`'s `'steps/unnumbered-step-x'`, which is merely unnumbered. The
`occurrenceSeq` unreadability suite (`reader.test.ts:194-201`) covers `'notsteps/001-a'`,
`'steps/a-1'`, `'steps/001'`, `''`, `null` and `undefined` — **none traverses**.

**On disk, all 940 values are `steps/<nnn>-<stepid>` exactly.** Zero contain `..`, zero are absolute,
zero are symlinks, zero nest deeper, and zero orphan directories or missing directories exist. So the
threat is what a manifest **may** carry, never what one does — which is why AC-3's fixture is
constructed and why AC-3 is not eligible for trimming.

### §0.4 The wire carries `occurrence_dir` — undeclared

This is the measurement that decides the route's identity scheme, and no earlier account has it.

`packages/shared/src/wire.ts:322-348` declares `WireRunHistoryOccurrence` with **seven** fields:
`step_id`, `kind`, `status`, `started_at`, `duration_ms`, `adapter`, `seq`. `occurrence_dir` is **not
one of them**. But `read.ts:521` builds each entry as `{ ...step, seq: occurrenceSeq(...) }` and
`wireRunHistoryOccurrenceSchema` is a `z.looseObject`, so **the field crosses to the browser today,
untyped and undeclared**.

A client that keyed on it would be coding against an accident rather than against a contract — which
is exactly the drift `wire.ts`'s own header argues against, and which Q-0120 paid for when
`packages/server` declared no `exports` while calling itself *"the contract Q-0014 codes against"*.

**So the identity a client supplies is `seq`, the declared field, and the route accepts
`occurrence_dir` from a client under no circumstances** (AC-6). Ratifying an undeclared field as a
contract is the more expensive of the two mistakes available here.

**And `seq` is not unique in general.** `occurrenceSeq` (`reader.ts:169-172`) answers
`Number.MAX_SAFE_INTEGER` for a directory name whose `steps/NNN-` prefix it cannot read, so two
unreadable entries share a value — and `wireRunHistoryOccurrenceSchema`'s
`z.number().int().nonnegative()` accepts it. **The shipped screen already knows this**:
`history-screen.tsx:146-147` keys its list by array position with the comment *"`occurrenceSeq`
answers `MAX_SAFE_INTEGER` for a directory name it cannot read, so two unreadable ones would share a
key."* On disk today 940 of 940 parse. AC-6 is what stops a collision being answered as an absence.

### §0.5 A third `realpathSync` declaration turns a shipped guard red, and the primitive is already reachable

`packages/core/src/backlog/backlog.source.test.ts:179-204` holds `REALPATH_SITES`, a register of the
**two** production files across `packages/core/src` and `packages/cli/src` that may declare
`fs.realpathSync` — `backlog/confine.ts` and `run-history/reader.ts` — with a reason for each and the
comment *"A register of identities rather than a count (Q-0073): a **THIRD declaration fails here**,
which is what makes the next one a visible act."*

**And the reuse is already precedented in this exact folder.** `run-history/writer.ts:37` is
`import { isOneName } from '../backlog/confine.js';`, under an authority comment at `:325` reading
*"the check is `backlog/confine.ts`'s own, **reused rather than respelled**."*

So the constraint is checkable rather than a matter of taste: the new code reuses
`confine.ts`'s `pathInside`, or lives in `reader.ts` and uses that module's existing private
`realPath`. A new file declaring its own resolver fails a guard **by file name** before any reviewer
sees it.

**`pathInside` is the right predicate and `isFolderIn` is the wrong one**, which is worth stating
because the names invite the opposite choice. `isFolderIn` (`confine.ts:117-133`) requires
`inner.length === outer.length + 1` — *directly* inside, exactly one component — and an occurrence
directory is `steps/NNN-id`, **two** components below the run directory. It would refuse every
legitimate occurrence. `pathInside` (`confine.ts:135-160`) is *strictly* inside at any depth, refuses
an absolute `rel`, and resolves the deepest existing ancestor so a link standing at the destination is
refused rather than followed.

### §0.6 The two ordinary occurrence cases — and the body's sentence is wrong about one of them

**No `prompt.txt` ⇔ `kind === 'integrate'`, and the correspondence is total**: 855 `adapter`
occurrences ↔ 855 `prompt.txt`; 85 `integrate` ↔ 0. Verified independently of the file count by
reading every manifest.

**The body's sentence keyed on the wrong field.** Its §*Two occurrence cases* says the 85 "are
`integrate` steps". They are `integrate` **by kind** — and by `step_id` they are **`integrate` 73,
`prove-red` 9, `merge-contracts` 3**. A sentence, guard or fixture keyed on `step_id === 'integrate'`
is wrong about **12 of 85** on this repository's own data. Key off `kind`. That is this repository's
most-recorded defect class — a check keyed on a name rather than on the behaviour, recorded seven
times (Q-0051, Q-0067, Q-0073, Q-0107, Q-0108, Q-0115, Q-0125) — and it is sitting in the ticket body
this run was launched from.

**`kind` has a third declared member with zero instances, ever.** `OccurrenceKind` is
`'adapter' | 'script' | 'integrate'` (`manifest.ts:44`) and no `script` occurrence exists in 940. So
the rule the screen states must be **total over the three**, and the honest form is *a prompt exists
exactly where `kind` is `adapter`* rather than *an integrate step has no prompt* — `runScript`
persists only `OUTPUT_FILE` (`steps.ts:427`), so a `script` occurrence would behave like an
`integrate` one and no corpus can teach it.

**No `output.txt` means not finished — and there is a live case again.** `terminal()`
(`writer.ts:584-591`) guarantees an `output.txt`, empty where nothing was written, so a terminated
occurrence always has one. Exactly **one** occurrence lacks one today: **`Q-0137-1/steps/001-pm-claude`
— `kind: adapter`, `status: running`: this requirement run's own first step, in flight as the document
was written.** Q-0018's E-4 recorded that the body's *"zero"* had become one because measuring created
it, then that it had returned to zero; measuring again has created it a third time. The **rule** is
what matters and is unaffected. Do not write a criterion against the count.

**8 files are empty and every one is an `output.txt`. No `prompt.txt` is ever empty.**

### §0.7 UTF-8 — the instrument is already built, and the corpus cannot teach the criterion

Over all 1,794 files under `TextDecoder('utf-8', { fatal: true })`: **0 are invalid**. **14 are
well-formed and contain U+FFFD**, all of them `prompt.txt`, clustered in two runs — `Q-0101-2` (all
ten occurrences) and `Q-0127-2` (its four review steps), which reads as upstream content recycled into
each successive prompt rather than as anything introduced at write time.

So the naive test — *does the decoded text contain a replacement character* — would report **fourteen
real prompts as binary on the day it shipped**, which is Q-0127's E-3 trap at a second corpus and at
four times the count.

**The instrument exists and is not rewritten here.** `packages/server/src/read.ts:297-316`'s `asUtf8`
is a whole-file fatal decode of the bytes that were read, with its own JSDoc explaining why a prefix
decode and a byte-length comparison against a second `stat` are both refused. AC-7 reuses it; a second
decoder in this package would be a copy free to drift from the one Q-0127 argued for.

**Zero invalid files means the criterion is unteachable from `.quorum/runs`** and needs a constructed
fixture — R-3.

### §0.8 A retained entry can be a directory, and the writer treats that as normal

`writer.ts:581-591` guarantees `output.txt` behind `fs.existsSync`, which answers **true for a
directory** — so a directory wearing that name **skips the guarantee in silence** and the occurrence
still terminates `completed`. It is pinned as preserved behaviour by `writer.test.ts:409-422`
(*"an `output.txt` that is a directory is left alone, silently"*), with `guard.said` asserted empty.

Zero such entries exist on disk, and it cannot be fixed here — it is a landed preserved defect. What
it means for this ticket is that **the listing must skip a non-regular entry rather than measure it**,
which is precisely what `listTicketFiles` already does (`backlog.ts:375-377`: *"A name that stands
there and is not a regular file has no size to report and no bytes to serve"*), and the read must
`fstat` the open descriptor, which `readTicketFileBytes` already does (`backlog.ts:413`). Both
precedents are reused rather than re-reasoned. AC-1 and AC-2.

### §0.9 `persist` confines nothing, so the name set is open by the type and closed by the call sites

`persist(occurrence, name: string, text: string)` (`writer.ts:598-610`) is
`path.join(runDir, occurrence.occurrence_dir, name)` with **no check on `name` at all**. Every shipped
call site passes one of two constants — `PROMPT_FILE` at `steps.ts:294`, `OUTPUT_FILE` at
`steps.ts:317`, `:336`, `:345`, `:427` and `composite.ts:383` — and
`run-history.source.test.ts:273` pins that *"the writer never names an artifact — its callers do"*.

So the register in `packages/shared/src/constants.ts:73-77` names what the **writer's callers** write,
not what a directory **holds**. A drill-down deriving its file list from those two constants would be
asserting the writer's intent over the filesystem's contents, and would be blind to a file a human put
there, a file a human deleted, and the directory of §0.8. **List the directory** — which is the ticket
body's conclusion reached by a sharper argument than the body's.

### §0.10 `.quorum/` is gitignored with zero tracked files — identically to `.harness/`

`.gitignore` lists `.quorum/` and `.harness/` on consecutive lines. `git ls-files` returns **0** for
each. This is the fact OQ-1 turns on, and §8 is where it is ruled.

---

## §1 Problem

A **maintainer** looking at a finished run wants to know what a step was actually sent and what it
answered — why the reviewer said that, what the implementer was handed, whether the diff the panel saw
was the one they think it was. Run history's screen names every occurrence of that run: its sequence
number, step id, kind, status, adapter and duration. It can open none of them.

The text is on disk and it is almost all of what run history is: **1,794 files, 116,655,192 B, 99.3%
of the store.** The product wrote every byte of it and has never read one back. The route to it today
is `quorum runs <id>`, which prints the occurrence's directory path (`runs.ts:219`), after which the
maintainer leaves the product and runs `cat`.

`apps/web/src/history-screen.tsx:105-107` says so in its own words — *"What it retained is not named
and not claimed. An occurrence's `prompt.txt` and `output.txt` are a successor's subject"* — and
`apps/web/src/routes.ts:256` names this ticket by id in the sentence the shell shows a reader.

**And the last unread thing is the most expensive thing.** The store's three largest files are all
prompts; the largest is 353,626 B of review prompt. A maintainer asking *what did that $16 review
actually see* is asking about the one artifact this product has no way to show them.

---

## §2 User stories

**Maintainer.** *As a maintainer debugging a run that went the wrong way, I want to open the prompt a
step was sent and the output it returned, from the screen that already names that step, so that I can
tell a bad instruction from a bad answer without leaving the product for a shell.*

**Maintainer, second story.** *As a maintainer reading a run that is still going, I want the screen to
tell me an occurrence has not finished rather than to show me nothing or an error, so that I can tell
`this step has not answered yet` from `this step's record is damaged`.*

**Adopter.** *As someone trying Quorum on my own repository, I want a run I just performed to be
readable end to end from the browser I was told to open, so that the first run I pay for is one I can
inspect.*

**Contributor.** *As someone writing a vendor adapter, I want to read the exact prompt my adapter was
given and the exact text it returned, byte for byte and with nothing normalised, so that I can debug a
structured-output failure against what actually crossed the boundary.*

---

## §3 Surfaces

`packages/core` (two functions, one folder), `packages/server` (two routes), `packages/shared` (the
wire shapes), `apps/web` (the drill-down inside Q-0018's occurrence timeline),
`docs/04-architecture.md` and `docs/GLOSSARY.md`.

---

## §4 The design, and the three decisions behind it

### §4.1 The listing does not ride on `GET /history/:id`, and the reason is measured

Q-0127's shape — the listing on the detail route, one new route for bytes — is the obvious model and
is **refused here on a difference the two subjects do not share.**

`GET /history/:id` is read by **two** screens: the history screen when a row opens
(`history-screen.tsx:231`) and **mission control on every load** (`mission-control-screen.tsx:258`,
and Q-0018's own R-1 says so). Putting the listing there means up to **55 `readdir` calls plus 110
`stat`s** (`Q-0015-4`) on a screen that will never fetch a file, and it turns a route whose central
stated property is *"It reads exactly one file"* (`readRun`'s JSDoc, citing Q-0034 AC-13) into one
that walks a directory tree. It also makes that response a function of the filesystem beyond the
manifest, so a partly-deleted store changes mission control's answer.

**So the listing is its own route, run-scoped.** One request when a row opens — the request the screen
already makes a sibling of — rather than one per occurrence, which is Q-0018's R-2 hazard.

*Refused and recorded so it is not re-derived:* a `?files=1` flag on `GET /history/:id`. It costs
mission control nothing and needs no new route, and it makes a response's shape depend on a query
parameter's presence, which is a branch every client must carry for ever. Two routes is cheaper than
one route with two shapes.

### §4.2 No path crosses `core`'s boundary, in either direction

`resolveRunDirectory` is deliberately off the barrel (`index.ts:124` exports six run-history values
and not it) because publishing *"a path-returning function whose only correct use is to be opened
immediately"* leaves a caller free to resolve lexically and read anyway — **ruled, not offered**; see
`reader.ts:273-277` and Q-0092's `merged.md` OQ-1.

So the two new functions take `(runsRoot, token, …)` and resolve internally exactly as `readRun` does;
the listing returns names and sizes and **never a path**; the reader takes the occurrence's identity
and the file's name and **never a path**. `packages/server` composes no filesystem path at any point,
which is the property Q-0018's E-1 made checkable for its own half and which this half inherits in the
opposite direction: *this ticket joins paths, and it joins them in exactly one module.*

### §4.3 Two mechanisms, each closing one threat, and neither substituting for the other

This is Q-0127's discipline, and the halves land differently here because the untrusted values are
different.

**Membership** — derived for *this* request from the directory itself, never from a listing the client
fetched earlier (`read.ts:420-425`'s rule). It closes the client's file name. Here it closes something
Q-0127's did not: since `persist` accepts any `name` (§0.9), membership is what makes a name the
writer could have created but did not, unreadable.

**Confinement** — `pathInside` over the manifest's own `occurrence_dir`, inside `core`. It closes the
value the client never sees and nothing validates. `readRun`'s contract is untouched: a manifest with
a traversing `occurrence_dir` is still **reported as it stands** by `readRun` and refused at the
**join**, which keeps *"repairs nothing"* true and puts the check where the danger is.

---

## §5 Acceptance criteria

*Thirteen, against a working ceiling of fifteen. **AC-3, AC-12 and AC-13 are named now as not eligible
for trimming** if the review loop exhausts — AC-3 because it is the ticket's one security property and
its subject exists in no test today, AC-12 and AC-13 because a correction deferred to a successor is a
correction that expires (Q-0110, Q-0111, Q-0112 each lived inside a closed ticket's prose, Q-0100's
inside a source comment). Named in advance because Q-0122's E-1 did and Q-0126 paid $177.92 for not
having.*

---

**AC-1 — `core` names and measures one run's retained files without opening one.**

A new exported function answers, for one run token, every occurrence's retained files as
`{ name, bytes }` — `bytes` from `stat`, nothing opened — keyed by the occurrence's `seq`, together
with a warnings channel for occurrences it cannot name. A directory entry that is **not a regular
file** is skipped rather than measured. An occurrence whose directory is **absent** is named in
warnings; one whose directory is **present and empty** lists zero files — the two are different
answers and the second is reachable only while a run is live, between `allocate`'s `mkdirSync` and the
first `persist`.

*Test:* over a constructed store — an adapter occurrence with two files, an integrate occurrence with
one, an occurrence whose directory holds a **directory named `output.txt`** (skipped, not measured,
and not an error, per §0.8), an occurrence whose directory was removed (a warning), and an empty one
(zero files, no warning). Sizes are asserted against `stat`, and the function is asserted to open
nothing — a spy on `readFileSync`/`openSync` over the whole call records zero calls.

---

**AC-2 — `core` reads exactly one retained file's bytes, with confinement and the read in one call.**

A second exported function answers the **bytes** of one named file of one occurrence of one run, or a
discriminated outcome saying why not. It returns a `Buffer` and never text: `readFileSync(file,
'utf8')` substitutes U+FFFD and does not throw, so a caller that must characterise the bytes has to be
handed what was read. The descriptor is opened once and `fstat`ed, and the read is from that
descriptor — `readTicketFileBytes`'s discipline (`backlog.ts:402-418`), which is Q-0122's TOCTOU fix
reused rather than re-derived.

*Test:* the bytes of a known file are returned identically to `fs.readFileSync` of it; a name the
occurrence does not hold is refused; a name that is a **directory** is refused rather than read; a
file removed between two calls is refused rather than throwing. A mutation replacing the
`fstat`-on-descriptor with a `statSync`-then-open-by-name is shown red.

---

**AC-3 — a traversing `occurrence_dir` is refused, and nothing is joined until it is.** *(Not
eligible for trimming.)*

Every join of a manifest's `occurrence_dir` is confined against that run's own resolved directory
with `pathInside` before anything is opened. A manifest carrying `occurrence_dir: "../../../etc"`, an
absolute path, or a value that resolves outside the run directory through a symlink, is **refused**
— the occurrence is named in AC-1's warnings and AC-2 answers a refusal — and the manifest is not
repaired, not rewritten and not withheld from `GET /history/:id`, which goes on reporting it as it
stands.

*Test:* a constructed manifest whose `occurrence_dir` is, case by case, `'../escape'`,
`'steps/../../escape'`, `'/etc'`, and a single-segment name that is a **symlink** pointing outside the
run directory. Each is refused with a message naming the condition; in the symlink case a file is
planted at the target and asserted **unread**. Additionally: `fs.realpathSync` still appears in exactly
the two files `backlog.source.test.ts`'s `REALPATH_SITES` names, and the new code reaches its
boundary through `backlog/confine.js` — the import `run-history/writer.ts:37` already makes, under an
authority comment endorsing reuse over respelling. A third declaration fails that register by file
name, which is the check on this criterion rather than a neighbour of it.

---

**AC-4 — `GET /history/:id/files` lists one run's retained files, and a run it can partly read is
partly answered.**

The route resolves the token exactly as `GET /history/:id` does and tells its two failures apart on
the same rule — a token naming no run directory is **404 `no-such-run`**, a manifest that would not
parse is **422 `malformed-manifest`** carrying the reader's own message, because answering 404 to both
reports a run that *is* there as absent (*"A probe that could not answer is not a negative"*,
2026-09-10). A run it **can** read answers **200** with its occurrences and a `warnings` array naming
every occurrence it could not — `failSoftly`'s distinction, which `GET /history` already applies one
level out (`read.ts:476-480`) and which this applies one level in. **A single refused occurrence never
takes the run's listing with it.**

*Test:* over a constructed store — a sound run lists every occurrence; a run whose third occurrence
carries a traversing `occurrence_dir` answers 200 with the other occurrences listed and that one named
in `warnings`; a token naming nothing is 404 with the code; a run whose `manifest.json` is not JSON is
422 with the code. The warnings array is asserted non-empty **by content**, not by length alone.

---

**AC-5 — `GET /history/:id/file` answers one file's bytes as text, and each refusal has its own code.**

The occurrence and the file are **query values**, not path segments. Six refusals, each decided by a
predicate rather than by matching an error's prose, on `ticketFor`'s stated rule (`read.ts:221-228`):

| condition | status | code |
| --- | --- | --- |
| the token names no run directory | 404 | `no-such-run` |
| the manifest would not parse | 422 | `malformed-manifest` |
| the occurrence identity is absent, non-numeric or matches no occurrence | 400 / 404 | see AC-6 |
| the name is empty, a pattern, absolute, or names a directory | 400 | `not-a-file-path` |
| the name is well formed and this request's own listing does not hold it | 400 | `not-a-file-path` |
| a listed name that has stopped being a file | 404 | `no-such-file` |

Membership is derived **for this request** by calling AC-1's listing, never taken from the client and
never cached across requests. The response carries the size of the bytes that were **read**, never the
size the listing reported — a file can change between the two, and §0's own 90-second drift is the
proof that it does.

*Test:* each row above, over a constructed store, asserting the status **and** the code. The
stale-listing row is staged rather than reasoned about — the file is removed between the internal
listing and the read, on Q-0127's round-4 precedent, which staged the race a finding had said no test
could stage.

---

**AC-6 — the occurrence identity is `seq`, and an ambiguous one is refused rather than guessed.** 

The client names an occurrence by **`seq`** — the field `WireRunHistoryOccurrence` declares. Both
routes **reject `occurrence_dir` as an input under every spelling**: it crosses to the browser today
only because `read.ts:521` spreads the whole step through a `looseObject` (§0.4), and accepting it
would ratify an undeclared field as a contract.

A `seq` matching **no** occurrence is **404**. A `seq` matching **more than one** is **409** under its
own code, naming the run and the value — because `occurrenceSeq` answers `Number.MAX_SAFE_INTEGER` for
a directory name it cannot read, so two unreadable entries collide, and *more than one* is not *none*.
AC-4's listing omits a colliding `seq` from its addressable entries and names both occurrences in
`warnings`, so **nothing the listing offers is unfetchable and nothing fetchable is unlisted.**

*Test:* a manifest with two occurrences whose directory names carry no readable prefix; the listing
names neither under a `seq` key and warns about both; the file route answers 409 with the code rather
than serving either. A request supplying `occurrence_dir` in place of `seq` is refused at the shape
check. A guard asserts that neither route's handler reads a query key named for the directory.

---

**AC-7 — a file whose bytes are not well-formed UTF-8 is refused under its own code, taken with the
decoder that serves them.**

**422 `unsupported-file-encoding`**, from `read.ts:297`'s existing `asUtf8` — a whole-file fatal
decode of the bytes that were read. **No second decoder is written in this package**, and the refusal
is **not** a test for U+FFFD: 14 of this store's own prompts contain that character legitimately and
0 of 1,794 files are invalid (§0.7), so that test would report fourteen real prompts as binary on the
day it shipped.

*Test:* a constructed occurrence file holding a lone `0x80` is refused 422 with the code; a file
holding U+FFFD as valid UTF-8 is **served**; a file holding a four-byte character split across the
midpoint of the buffer is served, which is the prefix-decode failure the instrument's own JSDoc names.

---

**AC-8 — the two ordinary occurrence cases are sentences, and both are keyed on `kind`.**

An occurrence with **no prompt** is one **no vendor was asked** — said from `kind`, which is total over
`adapter | script | integrate`, and **never from `step_id`**: the 85 such occurrences here carry three
different step ids (`integrate` 73, `prove-red` 9, `merge-contracts` 3), so a sentence keyed on the
step id is wrong about **12 of 85** on this repository's own data. An occurrence with **no output** is
a step that **has not finished** — `terminal()` guarantees one, empty included — never a damaged
record. Neither renders as a blank, an error or an empty list.

*Test:* the sentence is derived for each of the three `kind` values, including `script`, which this
store has never produced; a fixture with `step_id: 'prove-red'` and `kind: 'integrate'` gets the
no-vendor sentence, which is the clause that goes red against a `step_id`-keyed implementation; and a
`running` occurrence with a prompt and no output gets the not-finished sentence rather than a refusal.
The count of such occurrences is asserted **nowhere** — it was 1, then 0, then 1 again, the last being
this requirement run's own first step (§0.6).

---

**AC-9 — the wire shapes are declared in `@quorum/shared` with runtime schemas.**

The listing response and the file response are named interfaces with zod schemas beside them, on the
levelling rule *"Unknown keys are refused where Quorum owns the key set, and preserved where it does
not"* (2026-08-25): this transport composes both, so both are `.strict()`, as `WireRunHistoryRow` is
and `WireRunHistory` is not. The names sit inside the `WireRunHistory` family and **do not reuse
`manifest`** for anything (Q-0127 E-2's homograph rule) nor `artifact`, which `docs/GLOSSARY.md`
already spends on **Emitted artifact**. The glossary's own words for the subject are *retained files*
(**Occurrence**), and those are the words used.

*Test:* each schema refuses an unknown key and refuses a `bytes` that is negative or non-integer; the
barrel exports both types and both schemas; `apps/web` parses a real response through the schema
rather than casting.

---

**AC-10 — the screen names each occurrence's retained files with their sizes, and one opens.**

Inside Q-0018's opened row, each occurrence names its retained files with sizes, and choosing one
renders its text. **Nothing large is fetched until a reader names that file with its size in front of
them** — Q-0127's stated design, reused rather than restated, and what stands in for a cap here. Every
refusal AC-4 to AC-7 can produce renders a sentence a reader can act on; **no state is a blank panel,
a spinner or a skeleton** (`04-architecture.md`'s placeholder rule). An occurrence AC-4 warned about
says so rather than appearing to have retained nothing.

*Test:* a fixture with two occurrences renders both file names and both sizes and issues **no file
request** until one is chosen; choosing one renders its text; each refusal code renders its own
sentence, asserted by content; a warned occurrence renders its warning rather than an empty list.
`history-screen.tsx:105-107`'s docblock — which currently says the subject is *"a successor's"* — and
`routes.ts:256`'s `waitingFor` sentence are both replaced.

---

**AC-11 — one listing request per opened row, and no request per occurrence.**

Opening a row issues **at most one** request for the run's file listing beside the detail request it
already makes. Closing a row discards an in-flight answer, on `history-screen.tsx:180-187`'s existing
generation rule, so a listing cannot land under a row a reader has just closed.

*Test:* a counting fetcher over a fixture with **more occurrences than fit a viewport** — Q-0018's
R-2 rule, that a request-count assertion over a three-row fixture proves nothing — asserts exactly one
listing request for one opened row and zero further requests as occurrences render. Opening a second
row while the first is out lands the second's answer only.

---

**AC-12 — the route registers move, on both sides.** *(Not eligible for trimming.)*

`packages/server/src/package.test.ts:791-806` pins the registered route set as an **identity**, and
`:822-829` requires each route to appear **verbatim** in `docs/04-architecture.md`'s
`### \`packages/server\`` section. Both new routes join both, and the architecture document's
`packages/server` prose gains the sentence that these are the first routes on this transport to serve
a **file** under `.quorum/`, with §8's ruling recorded at the route rather than in a decision entry
(Q-0108's precedent). On the browser side, each new path segment earns a row in
`apps/web/test/routes.test.ts`'s `EXCEPTION_REASONS` with its reason, exactly as `/stop`, `/gate`,
`/gates` and `/diff` already have — the path-literal guard collects every quoted `/…` literal under
`apps/web/src` and refuses an unregistered one.

*Test:* the route identity is asserted with both new entries; removing either from the architecture
document turns the verbatim guard red; removing an exception row turns the path-literal guard red,
each with a discriminating message.

---

**AC-13 — `docs/GLOSSARY.md`'s **Confinement** entry names the path this ticket confines, and no term
is coined.** *(Not eligible for trimming.)*

That entry enumerates what is confined and says *"Two roots are confined this way"*, describing the
run-history root as *"a run id names a directory directly inside `.quorum/runs`"*. After this ticket
that description is **incomplete rather than false**: a second path inside that same root — the
occurrence directory the manifest names — is confined too, by a different predicate, because it sits
two components deeper. The entry gains that clause. **No new term is coined and no synonym is
introduced**: *retained files* is already the **Occurrence** entry's own wording, and **Confinement**
is not widened into a second concept.

*Test:* `packages/shared/src/docs.test.ts`'s existing glossary machinery covers the edit; the clause
is asserted present, and the term list in `CLAUDE.md` and `docs/README.md` is asserted **unchanged at
21 terms and identical**, which is Q-0108's check confirming that nothing was coined.

---

## §6 Non-goals

1. **Q-0018's half is not reopened.** The listing, the table, the widened wire shapes and the
   occurrence timeline shipped; this adds retained files to them.
2. **No event is persisted and no event gains a field.** A finished run has no event stream — this is
   an occurrence's retained text, never a trace, and `docs/05-design-prompt.md` §8 already records the
   refutation.
3. **`GET /history/:id` is not widened**, and its *"reads exactly one file"* property is preserved
   (§4.1). Mission control's behaviour does not change.
4. **`readRun` is not changed.** *"A cast, never a check"* and *"repairs nothing"* both stand; the
   confinement lives at the join, not in the reader.
5. **The CLI is not changed.** `quorum runs <id>` keeps printing the occurrence path (`runs.ts:219`)
   and gains no file rendering. That it would print a normalised path for a traversing
   `occurrence_dir` is a **display** consequence of a manifest nobody has, not a read, and is recorded
   rather than fixed.
6. **No cap, retention policy or eviction — and the boundary with Q-0076 is sharper than "Q-0076 owns
   any cap".** Q-0076's subject is the **write** side: nothing bounds what `persistArtifact` writes. A
   **read-side response bound** is this ticket's, and the answer is **none**, measured: one file at a
   time caps a response at **353,626 B**, against the **1.46 MB** single file `GET /tickets/:id/file`
   has served with no cap since Q-0127 and the architecture document's ruling that *"There is no cap
   anywhere and that is the design"*. Serving a run's text in one response would be 3,514,617 B and
   would make Q-0076 a blocker; that design is not taken.
7. **No manifest is repaired**, including one whose `occurrence_dir` is refused. A refusal names the
   condition and changes nothing on disk.
8. **No download, no content negotiation, no range request.** The response is JSON carrying text, as
   `WireTicketFile` is.
9. **The `output.txt`-as-a-directory defect is not fixed.** It is landed preserved behaviour
   (`writer.test.ts:409`); this ticket only declines to trip over it.

---

## §7 Open questions

**All four are answered. None blocks.**

**OQ-1 — may a route serve a *file* under `.quorum/`? — ANSWERED; see §8.** Not carried, and the
reason it is not carried is that the question has two halves and only one was ever open.

**OQ-2 — does the listing key occurrences by `seq` or by array position? — ANSWERED: `seq`, with
ambiguity refused (AC-6).** Position is unique by construction and is refused anyway: matching two
independent responses by position is an implicit contract, and the manifest is replaced on every
terminal occurrence, so a client would be relying on append-only ordering nothing states.

**OQ-3 — one route or two? — ANSWERED: two (§4.1).** The `?files=1` flag on the existing detail route
is recorded as refused so it is not re-derived.

**OQ-4 — does the file-name set come from the two constants or from the directory? — ANSWERED: the
directory (§0.9).** `persist` takes the name as a `string` parameter and confines nothing, and
`run-history.source.test.ts:273` pins that the writer never names an artifact. The constants are a
register of what the writer's **callers** write; a listing derived from them would assert intent over
contents.

*One naming hazard is recorded rather than left to be found:* the two routes differ by one character
(`/files` and `/file`), which is the shape Q-0127 E-2 refused for a homograph. It is accepted here
because the singular is the shipped spelling for *bytes of one file* (`GET /tickets/:id/file`) and the
plural is its only natural sibling, because Hono matches exact registered patterns so no shadowing is
possible, and because both appear in one register a guard pins (AC-12). If an implementer finds a
better pair, taking it is not a deviation.

---

## §8 The ruling on OQ-1

**May a route serve a file under `.quorum/`? Yes, and no decision entry is owed.** The ruling belongs
in the listing function's own authority comment and in one sentence of `docs/04-architecture.md`
(Q-0108's precedent: a ruling that changes no behaviour and contradicts no landed entry belongs in the
code's authority comment).

**The gitignore fact is not the discriminator, and checking it is what shows that.** Q-0127's erratum
E-1 excluded `.harness/` on the reasoning that it is gitignored and git tracks none of it, *"so it is
not in the database"*. **`.quorum/` is gitignored on the adjacent line of the same file and git tracks
zero files under it** (§0.10). If that were the discriminator, `GET /history` and `GET /history/:id`
would both be violations — and they have shipped since Q-0119, been widened by Q-0018, and are read by
two screens. So the premise E-1 rests on does not decide this, which is a conclusion available only by
measuring it rather than by reasoning from E-1's shape.

**What decides it is that `.quorum/` is named as the database.** `.claude/rules/engineering.md` and
`harness/rules.md` both say *"Anything persistent is a file in `backlog/`, `harness/`, or
`.quorum/`"*. What E-1 excluded was a **different subsystem's state appearing inside a ticket
folder**, and `packages/shared/src/wire.ts:737` says exactly that in its own words — a ticket's
listing names no dot-path because *"naming the paths would make a backlog route a second run-history
surface, which is Q-0018's"*. Q-0127 ruled that engine run state may not be served **from the backlog
route**, and forwarded this subject here **by name**. E-1's own closing clause — *"What this erratum
does not settle: whether any other surface may serve `.harness/`"* — is about `.harness/`, a different
tree, and does not reach.

**So the authority question was answered by shipped code and by a landed rule, and what was open is
payload.** That is the ticket body's own launch reading, confirmed rather than inherited, and it is
measured: one file at a time is **353,626 B** at this store's worst, against the **1.46 MB** single
file Q-0127 already serves with no cap. **A payload question wearing an authority question's
clothes**, answered by a design that never serves more than one file.

**The test this repository applies — *does any landed sentence go false?* — was applied at six sites
rather than assumed.**

1. **Two routes are added**, so `04-architecture.md`'s enumeration changes in **content**. Adding
   read-only routes is precedented without an entry three times: Q-0119 added five, Q-0121 two,
   Q-0134 one. AC-12 moves the register and the document together.
2. **Nothing new is persisted and no event gains a field** — *"Files are the database"* and the
   **Event** term are untouched.
3. **No dependency is added.**
4. **No glossary term is coined.** **Confinement**'s enumeration becomes incomplete rather than false,
   which AC-13 closes with a clause. That is the one document edit this ticket owes that is not a
   route list.
5. **`readRun`'s *"a cast, never a check"* stays true**, because the check lives at the join and not
   in the reader (§4.3).
6. **`resolveRunDirectory` stays off the barrel** and no path-returning function is published
   (§4.2), so Q-0092's `merged.md` OQ-1 is honoured rather than narrowed.

**If an implement step finds a landed sentence this misses, that is an erratum's subject and not a
thing to work around — say so and stop, which is what `verdict: blocked` is for (Q-0083).**

---

## §9 Risks

**R-1 — three criteria cannot be learned from this store, and all three are the load-bearing ones.**
Zero traversing `occurrence_dir` values, zero invalid-UTF-8 files, zero non-regular directory entries
exist on disk. AC-3, AC-7 and AC-1's third clause are therefore reasoned about from constructed
fixtures, which is Q-0018's R-4 at a sharper angle: there four criteria were untestable from the
corpus, here the untestable ones are the security property and the two refusals. Their `Test:` clauses
forbid drawing from `.quorum/runs`, and each must be shown red against an implementation that omits
the check.

**R-2 — the store moves under a reader, and this is the first surface where that is ordinary rather
than staged.** Measured: 938 → 940 occurrences and 116,639,410 → 116,655,192 B in **90 seconds**,
because a run was live. So AC-5's *"a listed name that has stopped being a file"* is reachable in
normal operation, where Q-0127's equivalent needed a hooked `statSync` to stage. Two consequences the
implementer should meet as design rather than as a bug: the response reports the size of what was
**read**, never what was listed; and an occurrence with no `output.txt` is the ordinary state of a
step now running, not damage.

**R-3 — the review will probably not be truncated, and the prediction is made rather than assumed.**
`repo.max_diff_bytes` is 200,000 and is read at run start. Q-0129's four rounds fell to 70.2% and lost
`events.ts`, that ticket's own subject; Q-0135's fell to 87.9% and lost `wire.ts`; **Q-0018's did not
truncate at all, at 165,960 B and 180,073 B**, and this change is Q-0018's shape — two core functions,
two routes, two wire shapes, one screen region — so it should come in comparably. `git diff` orders by
path and the alphabetical tail here is again `packages/shared/src/wire.ts`, AC-9's own subject. GO-4
is the remedy if the prediction fails, and **the prediction being refuted is itself worth recording**:
R-5 of Q-0018 predicted truncation and was refuted, which is the second consecutive data point that
change size rather than ticket ambition is what the cap tracks (Q-0128).

**R-4 — the confinement is the kind of check that gets written once and then bypassed by its own
neighbour.** Q-0059's review found three path escapes, one per round, ending in a blocker where a
dangling symlink made `write` create its own target; Q-0122's two review blockers both landed on the
one criterion its erratum had named as not eligible for trimming. Both of those tickets predicted the
class and walked into it anyway, and the cross-vendor panel is what caught it. AC-3's symlink clause
is written from that history rather than from first principles, and the one thing an implementer
should not do is model the guard on Q-0127's without reading §0.3 — **there the untrusted value
arrived over HTTP, and here it arrives from a file this product wrote and does not re-check.**

**R-5 — a screen is where a measured rule goes quiet.** AC-8's sentence is invisible in any rendering
test whose fixture has two well-formed adapter occurrences. The fixture must be hostile: an
`integrate` occurrence whose `step_id` is `prove-red`, a `script` occurrence this store has never
produced, a `running` occurrence with no output, and an occurrence AC-4 warned about.

**R-6 — a correction this ticket should make in passing, recorded so it is not lost.**
`apps/web/src/history-text.ts:185` states *"in this repository's own history all **84** of them are
`integrate` steps"*. It is **85** today. The sentence's claim is unaffected and the figure is one
behind; it is a measured number in a shipped docblock rather than a dated measurement, so it moves
with AC-8 rather than standing.

---

## §10 Gate obligations

**GO-1 — ratify or refuse §8 at the gate, and record it as an erratum either way.** The implement step
reads `requirements/errata.md` and **not** `ticket.md` (Q-0125 E-1), so a ruling recorded only in this
document's §8 reaches the implementer and a ruling recorded only in the ticket body reaches nobody.
The ticket body carries **OQ-1 marked BLOCKING**; if §8 stands, the erratum must say so **by name**,
or the implementer meets a live blocker and `blocked` is the verdict it will correctly return on round
one — which is Q-0125's E-1 exactly, and Q-0062's three wasted rounds before it. **Verify the erratum
is present in the implement step's actual `prompt.txt` rather than assuming it** — the check Q-0097
lost two errata by not making, and which Q-0125 and Q-0129 both performed by grep.

**GO-2 — rule the criteria count.** Thirteen is under the working ceiling. If it is raised in review,
name the seam and the remedy on exhaustion **in advance** (Q-0122's E-1 discipline); AC-3, AC-12 and
AC-13 are already named as not eligible.

**GO-3 — the contract note, if one is owed, is written by hand at the gate.** `contracts/` is not among
`developer-generalist`'s roots, which cost Q-0129 an implement round and Q-0131 and Q-0134 a hand
edit each. If this ticket's design changes anything `contracts/Q-0011/run-manifest.schema.json` or a
Q-0015/Q-0018 contract note states, the note is the human's and is written before the run.

**GO-4 — measure the review's coverage and say so.** Record, per round, the diff bytes against the cap
and the files that got no patch at all. If any round is truncated, the omitted files are reviewed by
hand cross-vendor and the result recorded — the pattern Q-0124's warn and Q-0117's `observation:`
channel have now composed on four consecutive tickets, and which Q-0135's hand pass proved worth
checking rather than trusting.

**GO-5 — discharge by running the product and transcribing what it rendered.** Not by a report, and
not by a test. Start a real daemon with `quorum open`, **verify the served bundle carries this
change's own code by content first** — a cache hit can serve a page built from code nobody is looking
at — open run history in a browser, open a row, and transcribe into `runs.log`: the occurrence list
with its file names and sizes, one file opened and its first line, the sentence a no-prompt
`integrate` occurrence renders, and the sentence a still-running occurrence renders. **Written to be
unfakeable because Q-0016's equivalent was reported discharged when its by-hand half had not been
performed**, and Q-0015's gate is what found that. If `Q-0137-1`'s own `pm-claude` occurrence is still
the one with no `output.txt` when this is run, transcribe that too — it is the live case AC-8's second
clause exists for.

**GO-6 — verify forced in both environment rows**: a detached worktree with neither
`.harness/worktrees` nor `.quorum/runs`, and `main` after the merge, with `quorum lint` and the
git-identity sweep green in each.

---

## Appendix A — measurement commands

Reproducing these later gives larger numbers; the store grows with every run, including this one.

| figure | how |
| --- | --- |
| runs, occurrences | `find .quorum/runs -mindepth 1 -maxdepth 1 -type d \| wc -l` · `find .quorum/runs -mindepth 3 -maxdepth 3 -type d \| wc -l` |
| files, bytes | `find .quorum/runs -mindepth 4 -type f` with `stat -f '%z'` summed |
| distinct names | `find .quorum/runs -mindepth 4 -type f -exec basename {} \; \| sort \| uniq -c`, and the negative `! -name output.txt ! -name prompt.txt` → 0 |
| files per occurrence | `for d in .quorum/runs/*/steps/*/; do ls -1 "$d" \| wc -l; done \| sort \| uniq -c` |
| kinds, no-prompt by kind and step id | a `node` walk of every `manifest.json` joining each occurrence against `existsSync(dir/prompt.txt)` |
| UTF-8 | a `node` walk decoding each file with `new TextDecoder('utf-8', {fatal: true})`, counting throws and `.includes('�')` separately |
| traversal | `jq -r '.steps[].occurrence_dir' .quorum/runs/*/manifest.json \| grep -E '(^/\|\.\.\|^[A-Za-z]:)'` → no matches, confirmed in `node` with `path.isAbsolute` and a `..` segment check |
| tracked state | `git ls-files .quorum \| wc -l` → 0 · `git ls-files .harness \| wc -l` → 0 |
