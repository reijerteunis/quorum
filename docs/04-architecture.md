# Quorum — Technical Architecture (v1)

*Status: 2026-09-19 (Q-0137) — **the drill-down opens what an occurrence retained, so the last thing
this product wrote and had never read back is on a screen.** Two routes: `GET /history/:id/retained`
names and measures every occurrence's retained files without opening one, and
`GET /history/:id/file` reads one of them by its sequence number and its leaf name. **Occurrence
confinement and byte reading are `core`'s** — `listRetainedFiles` and `readRetainedFile`, neither of
which returns a path — because the untrusted value here is the manifest's own `occurrence_dir`,
which nothing on the read path validates and which no client ever sees or supplies. There is no cap:
one file at a time, with its size in front of the reader, which is Q-0127's answer at a store whose
largest run retains 3.5 MB. No decision entry is owed and OQ-1 was ratified at the gate — a route
has served `.quorum/` since Q-0119, and what Q-0127 excluded was a different subsystem's state
inside a *backlog* route. Earlier — 2026-09-18 (Q-0018) — **run history is a screen, and `GET /history` declares a shape at
last.** That route answered an inline object literal nothing declared, and its five fields could not
fill the table `docs/05-design-prompt.md` §8 asks for: `WireRunHistoryList` and
`WireRunHistoryRow` are `@quorum/shared`'s, the listing gained the manifest's start, end, duration,
an occurrence count and the roll-up **narrowed to the four fields a surface renders**, and a run the
route cannot compose a row for is named in `warnings` rather than taking the listing with it.
`WireRunHistory` gained `steps`, whose own reason for being absent — *"read by nothing that reads
this shape"* — is what a caller reading it spent. **The brief's last sentence for that screen is
refuted rather than deferred**: *"reuse screen 5 in a 'completed' state"* cannot be done, because
events are not persisted and a finished run therefore has no event stream, and because a handle is
meaningless across a restart while a history id names a directory — **171 run directories against
zero handles in a freshly started daemon**. So the drill-down is an occurrence list, opened inline,
and this screen composes no handle and links to no run. What an occurrence RETAINED was **Q-0137**'s
and is the paragraph above;
`GET /project` is still the one route here that declares no shape, named so the correction above is
not read as covering it. No route was added and no decision entry is owed, which was ratified at the
gate against five landed sentences rather than assumed. Earlier the same day — 2026-09-18 (Q-0135) — **mission control shows how long a run has been going and what it has
cost on each vendor, so the last two of the four figures its brief puts in the header are on the
screen.** §`apps/web` said two of them were *"still not on this wire"*; both were already on disk and
already served, and what was missing was a read — `GET /history/:id`, a route this app had never
called, whose manifest `core` rewrites in full on every occurrence that terminates. `@quorum/shared`
gains one schema over the subset the screen reads, which is the **first validation `started_at`,
`ended_at`, `duration_ms` and `status` have had anywhere in the chain**, and it is **loose at every
level**: this is a projection of a document `core` may widen, so a `.strict()` copy would refuse a
manifest this product wrote. **The two values behave differently and that is the design** — elapsed
advances from a value the browser already holds and performs no read, cost ships as of the last read
— so the frozen contract's *"Refresh is the only repeat read; no timer performs one"* is untouched
and the brief's word *ticker* does not survive the measurement. **`WireRun` gains `dry`**, which is
the one field there about the request rather than about the run: a walk writes no run history and is
allocated a number the next real run of that ticket receives again, so a reader composing
`<ticket>-<number>` without it renders another run's figures — a wrong answer rather than a missing
one, closed by carrying the word back rather than by inferring it from a 404. **No decision entry is
owed**, on Q-0016's precedent for this shape and Q-0121 GO-3's naming rule; the ruling is recorded in
the code's own authority comments, on Q-0108's. **No glossary term is coined and none is owed**, so
neither 22-term list moves and `CLAUDE.md` stays the human's (Q-0103 erratum E-2). Earlier the same
day — 2026-09-18 (Q-0134) — **the gate screen shows the diff the decision at that gate was made
on, and it is the first thing this transport answers with that a RUN produced.** §`packages/server`
gains a third read, `GET /runs/:id/gates/:gateId/diff`: the patch, the `--stat` and the truncation
outcome as the run measured them, taken from a snapshot the run handed the host out of band — the
channel Q-0131 opened one day earlier, a second callback beside `answerGate` rather than a second
member on the event union. **The event union does not move and the two halves of that screen take
opposite answers**, which is size and replay rather than kind: a patch is capped at
`repo.max_diff_bytes`, 200,000 by default, against a 214 B mean event that is retained and replayed
to every late subscriber, where `reached`'s snapshot was measured at 13 KB. The capture is inside
`materialiseDiff` because that is the one site both paths to a materialisation come through, and the
one that covers a **chore** run — the preflight caches a range only where every endpoint already
exists, and `chore.yaml` diffs against a branch its own earlier step creates, which is **186 of the
208** patches this repository's run history holds. A gate is answered the bytes only where its own
`reached` names the step they were materialised for, and its lifetime is the gate's. **No decision
entry is owed**, on three precedents from the preceding week; the ruling is recorded at the route
rather than in a document, on Q-0108's. Earlier — 2026-09-17 (Q-0131) — **a live run reports its own number, so mission control's header names the run rather than the handle.** §`apps/web` said three of the brief's four header values were not on the wire; it is two, and the one that moved did so **without the event union moving**: `RunFlowOptions` gained an optional callback beside `answerGate`, `core` calls it once at run start — outside the `dry` guard, because a dry walk is allocated a number too — and the daemon sets `record.runId` from it at the site it starts a run from, so `GET /runs/:handle` and `GET /runs` carry the number while the run is running. **No wire shape changed**, `WireRun.runId` having been `number | null` since Q-0121. The refused alternative is recorded in the option's own JSDoc rather than in a decision entry, and that is the ruling: an in-band `start` member would have made three landed sentences false by a word each — this document's own §`packages/core` clause among them — and each of the three is about *an event*, which a callback is not. Elapsed time and the per-vendor cost split are **Q-0135**'s. Earlier the same day — 2026-09-17 (Q-0129) — **a gate question carries the decision that reached it, so the gate screen shows what it is answering.** §`apps/web` said the screen rendered **nothing** about what the step before the gate decided and routed that half to this ticket by name; it renders it now, from one optional field the question gained — the deciding step's id and the verdict, findings and summary that step returned — held in `packages/core` in one run-scoped slot, assigned where a verdict is validated and read at both sites that build a question. §`packages/server` **changes not at all**, and the sentence added there says why: `gates` already crossed whole by the event union's own element schema, so the field arrived with no line moving, which is the property a hand-copy of a question's fields would lose in silence. Entries are grouped only by the register `@quorum/shared` declares and one matching none is rendered whole, on the measurement that **150 of this repository's 1,080** carry no severity it declares; there is no cap, the largest such record being 13 KB. **The diff is not built here** — that is **Q-0134**, opened at this ticket's requirements gate — so the six words `apps/web/test/source.test.ts` forbade the screen are narrowed by exactly half rather than retired with the criterion. **No glossary term is coined and none is owed**, so neither 22-term list moves and `CLAUDE.md` stays the human's (Q-0103 erratum E-2). See *"A gate question carries the decision that reached it"* (2026-09-17). *(Before that: 2026-09-17 (Q-0130) — **the browser starts and stops a run, so the daemon has a producer.***) §`apps/web` said the gate screen was where this app stopped being read-only, that its one write was `POST /runs/:id/gate`, and that nothing starts a run from mission control; all three are superseded. The start is on the **ticket page** rather than on a board card, because the board names consuming flows per column and so attaches that naming to no ticket, and it names **every** flow that consumes the stage rather than one. It sends `flow`, `ticket` and at most `dry` — never `auto`, which *"Human-gated by default, auto opt-in per gate"* (2026-08-06) puts in the flow file, and never `base`. The request shape moves to `@quorum/shared` as `WIRE_START_FIELDS`, `WireStartRequest` and `wireStartRequestSchema`, and `packages/server` builds its accepted set from that tuple, so the five names exist once; `startRequestOf`'s four refusal codes and every sentence it composes are unchanged, which is what makes this a register move rather than a behaviour change. Both acts confirm first, are single, and are at most one in flight under one guard released by the request's own resolution and by nothing else — Q-0016's review blocker written once rather than twice. **No glossary term is coined and none is owed, and the gate answer set is untouched.** The write register moved by **one permission** with the permitted module set unchanged, and gained a clause with a different subject, because the needles can no longer tell a start from a read. *(Before that: 2026-09-16 (Q-0016) — **a run row carries the questions its gates are asking, and the app has a screen that answers one.***) §`packages/server` said a row narrowed the gates to a count and that no gate question crossed the wire; `WireRun` gains `gates`, which narrows nothing — the same array by `@quorum/shared`'s own element schema — because `gateId` is the correlation token an answer echoes and a count cannot carry it, so a gate was answerable from a terminal and from nowhere else. `pendingGates` stays beside it, computed as that array's length in the one projection, and what no longer holds is only the clause about the QUESTION: a ticket record still does not cross, and a ticket folder now reaches a client through a question's `ticketDir`. **The row also carries `refusal`, added in the run-2 review round rather than by the requirement**: a `refused` row said only that a start never happened, so the screen reported the state and said it carried no reason — an admitted gap where the criterion asks for the daemon's own condition, and the field is the host's refusal whole, without the `code` a status was picked from. §`apps/web` describes the gate screen and the one write this app now makes — its answers narrowed to the ones each gate will honour, the read-only guard narrowed by two names rather than dropped, a read that withdraws no answer already on its way and never hides what became of one, and the route excluded by name from the shell's live connection, because a screen ruled to hold no socket does not get one through the shell instead. `docs/05-design-prompt.md`'s screen 6 gains a divergence paragraph on the board's precedent. **No glossary term is coined and none is owed**, and the gate answer set is untouched: widening it needs a decision entry, which this did not take. proposed 2026-08-22; scaffold created 2026-08-24 (Q-0008) — the pnpm + Turborepo workspace, the single strict `tsconfig.base.json`, Vitest, ESLint and CI now exist, and the seven package boundaries drawn below are real directories, empty on purpose until Q-0009 ports the spike into them. 2026-08-25 docs review: worktrees are under `.harness/worktrees/`, and budget caps are specified rather than enforced. 2026-08-25 (Q-0009): `packages/core` states that it imports `shared`'s zod schemas rather than declaring its own, settling a contradiction with the development plan, and the `core` → `shared` dependency direction is written down. 2026-08-25 (Q-0041): `shared` is populated — zod schemas for flow, ticket, role and step output, the trace/event union and the cross-package constants — and principle 2 is corrected to the events that exist rather than the six it had named since it was written. 2026-08-26 (Q-0064): `core/src` is organised into one folder per module and `shared` stays flat, with the asymmetry explained. 2026-08-27 (Q-0047): the per-adapter `capabilities.ts` exists, and the version probe the same sentence asks for is recorded as deferred to Q-0067 so nobody reads it as shipped. 2026-08-27 (Q-0071): the testing strategy says what CI's `workspace` job executes and that it is forced, and separates the pnpm download cache from a task-result cache. 2026-08-28 (Q-0072): the testing strategy says what a *cache hit* claims, now that each suite's out-of-package reads are declared and `core`'s checks depend on `shared`'s. 2026-08-30 (Q-0079): the testing strategy names what a green tick does *not* claim — no suite ran where git resolves no identity until the sweep — and points at the oracle, the tripwire and the measured table separating them. 2026-08-31 (Q-0054): the testing strategy states that two required suites exist until the cutover and what each proves — the parenthesis calling the mock end-to-end "the 30-check smoke test, ported" described a port that had not happened, and its half of the suite transfers at Q-0010 — and adds the four-link chain from a new failing file to a red `pnpm test`. Changes go through DECISIONS.md. 2026-08-31 (Q-0062): principle 6 states the worktree lifecycle — a finished run gives back the worktrees it obtained, a run that did not finish keeps them, a worktree that is not clean is kept and says so, and no ref is ever deleted; and the testing strategy's entangled share is 49% rather than 53%, re-derived by `spike-parity.test.ts` after that ticket added a library-only test file, with the earlier figure kept beside it so the movement is visible rather than silent. 2026-09-01 (Q-0040): the entangled share is 55% rather than the 50% Q-0037 left, because that ticket's `q0040-undecided.js` is entangled in full — two of the five gate sites it covers live in `bin/` and no library test can reach them — and the sentence had gone three review rounds carrying a figure the guard beside it had already moved. 2026-09-02 (Q-0097): the testing strategy gains what a cache hit *gives back*, now that a `build` task with the workspace's first non-empty `outputs` replays an artifact rather than a verdict, and the `packages/core` entry says the emit is described there and not twice. 2026-09-02 (Q-0098): the shape paragraph separates the three installation claims — the workspace-local path and the locally packed path are supported and tested, and registry-resolved `npx quorum` is refused rather than deferred until Q-0029 — `packages/server`'s *"serves the built `apps/web`"* is scoped to M3 rather than left reading as present tense, and `packages/cli` records that the binary exists and what fixes its depth. 2026-09-03 (Q-0091): `packages/cli` records that the binary dispatches its first two commands, one module each, and the rule that separates a frame module from a command module. 2026-09-03 (Q-0092): that count is three, and `packages/cli` gains a paragraph on where the run-history division falls — six names moved onto `core`'s public surface, of which one is a new single-run read, because a detail request may not be coupled to the health of siblings it did not ask about. 2026-09-04 (Q-0093): that count is five, and the package map's `templates/` line is corrected — it described `packages/templates` as the shipped templates' home while line 66 and decision 078(e) put them under `packages/cli`, so two sentences of this document disagreed; `packages/templates` is a three-file scaffold holding no assets, and `packages/cli` gains a paragraph on where `init`'s division falls, which is the first place a command needed a new `core` symbol rather than a new export. 2026-09-04 (Q-0094): that count is six, which is the whole of this document's change — the sentence named five and `run` is the sixth, so it was false the moment that command landed; no paragraph was added for it, because Q-0094's requirement records that no numbered document claims anything it changes and this one sentence is the exception rather than an invitation. 2026-09-04 (Q-0099): that count is eight and the set is complete, and `packages/cli` gains a paragraph on the pair — the first to need nothing added to `core`'s public surface, and the pair whose two forced divergences from the spike are consequences of the frame/command rule rather than choices. 2026-09-05 (Q-0107): the testing strategy's sweep paragraph says the oracle runs the **workspace** suite rather than both, because AC-16 removed the spike phase with the last workspace read of that tree — CI's own `spike` job still runs it until Q-0103 — and the tripwire's corpus is named as `packages/` and `apps/`, the spike row having lost its subject. One sentence, and it is here rather than left for the cutover because a document describing an enforcer as covering more than it does is the failure this ticket is about. **2026-09-06 (Q-0103): the cutover.** The testing strategy describes **one** required suite rather than two — the spike tree, its CI job and `packages/core/src/spike-parity.test.ts` are deleted — and with them go the transfer share, which was a measurement of how much of a suite that no longer exists still had to move, and the sentence promising that register would record it. Three paragraphs that named the second suite as a live thing are corrected in the same edit: the discovery chain, which cites the spike runner as the origin of a property the workspace now owns; the cache-hit paragraph, which said *"both real suites"*; and the sweep paragraph, which said CI still ran the second one. The run-history section says `core` where it said the spike. What is NOT rewritten is provenance — `packages/core` is still *"seeded from the spike"* and `packages/cli` still dispatches *"the whole of the spike's set"*, because those sentences are about where the code came from and stay true of a tree that has gone. **2026-09-06 (Q-0105): `packages/cli` records the second git fact `board` derives** — push lag, the base branch against its upstream — and that it is the first command here to need a `core` symbol *after* it shipped, which the sentence above it had described as a pair needing nothing. That sentence moves to the past tense rather than being deleted: it was true of Q-0099 and stays true of Q-0099. **2026-09-08 (Q-0059): principle 6 states the backlog store's boundary** — a ticket token resolves inside the backlog root and every read and write happens inside a ticket folder, enforced in `core` — and the glossary gains **Confinement** as its own term, stated so it can never be read as a synonym for **Containment**, which is a git fact about two refs. One sentence and one term; the rule it describes is new, the vocabulary it uses was already in this document and in the development plan. That sentence was corrected in the run-2 review round, which found the guard checking the directory a path is enumerated in and not the leaf: it named the four methods it is true of rather than "reads and writes", and states the one read outside the guarantee, because a numbered document claiming more than the code does is the failure this repository has recorded most often. **2026-09-08 (Q-0067): §Adapters describes the version report that shipped rather than a deferral** — the sentence promising `capabilities.ts` *"with a version probe"* has had both halves since 2026-08-27 and only one of them was built, which this document recorded as deferred so nobody read it as shipped. What replaces that record is what exists: one recorded string per module, one comparison at the contract layer, no second invocation, and a report that refuses nothing. The glossary gains **Verified version**, stated so it can never be read as a supported range or as a second compatibility verdict beside the `verified` a `--probe` login reports. **2026-09-09 (Q-0039): principle 6 states that a ticket has one run at a time** — the lock a run takes before the branch head, the run directory and the worktree it would otherwise share, given back in a `finally` covering every exit, refusing rather than waiting and never reclaiming a stale one — and §Run history on disk names the second thing `core` writes under `.quorum/`, which is a sibling of the runs root and is not run history. The glossary gains **Run lock**, stated so it can never be read as a **gate**, as **Confinement**, or as a guarantee against anything but this product's own runs. **2026-09-11 (Q-0013): §`packages/server` describes the run host that shipped rather than the app that was proposed in August** — what exists is a library with no socket, no signal handler and no external dependency, and the Hono transport is named as Q-0118's and the read-only REST surface as Q-0119's. It states the three things a later child would otherwise re-decide: that a run is named by an id the **host** mints, with `core`'s run number correlated onto it when the terminal event arrives and reported as absent on a refusal, because neither pre-stream refusal has one to give; that the fan-out belongs to the host because the stream is single-consumer, with retention a bounded count and an incomplete replay named beside the stream rather than inside the closed event union; and that a gate answer is validated here before `core` sees it. **A fourth was added in the run-2 review round rather than by the requirement**: shutting down closes the host to new starts, because a start in flight is not yet a running run and a snapshot taken without waiting for one leaves a run holding a lock that nothing would release. **One clause of the route list is refused by the code and is recorded rather than dropped**: `POST /runs/:id/gate` read *"(advance/retry/override with reason)"* while `gateAnswerEnvelopeSchema` is `.strict()` over three, so the document was wrong and is corrected — widening the envelope is Q-0016's to ask for with an entry of its own, and `06-development-plan.md`'s M3 gate-screen line carries the same promise and is the human's. **No glossary term was added and none is owed**: the host's id is described rather than coined, because minting a term means `CLAUDE.md`'s term list, which Q-0103 erratum E-2 makes the human's to write. **2026-09-11 (Q-0014): §`apps/web` describes the shell that shipped rather than the nine screens that were proposed in August** — a route register the router, the rail and every placeholder are built from, a palette declared once, a top bar that reads an explicit not-loaded string per region rather than inferring a project, a branch or a login, and placeholders that name the ticket that builds them or say that none does. Three things are named as absent rather than left to be assumed: the live connection is Q-0120's and the top bar reserves the region it fills; the app declares no `build` script, so the emitting set is still three and the build task, the static route and the ruling on whether a served bundle is an **emitted artifact** are Q-0122's — which is what this section's own sentence about serving "the built `apps/web`" has been waiting for since 2026-08-22; and the deliberate divergence from `05-design-prompt.md`'s "except Google Fonts" is recorded in place, a local-first tool that needs the internet to render a page not being one. **A fourth was added in the run-2 review round rather than by the requirement**: `src/` is browser-only as a *checked* property over every file in it, so the four suites that read the repository sit in `test/` beside it rather than inside it — a scan scoped to what ships would have exempted exactly the files likeliest to reach for a filesystem, which is what it had done. **No glossary term is added and none is owed**: the artifact question is the one term this work could have coined, and it is ruled with the build task rather than inside a shell. **2026-09-12 (Q-0120): §`apps/web` describes the live daemon connection, and the glossary distinguishes its derived connection state from run state.** The frame union is owned by `@quorum/shared` and re-exported by `packages/server`, keeping one browser-safe definition for both ends of the socket. **2026-09-12 (Q-0121): §`packages/server` names the two read routes the daemon gained and what each of them answers** — `GET /runs`, *what can I join?*, which carries the runs the host can back and never a refused start, and `GET /runs/:id`, *what do you know about this handle?*, which reports a refused start as refused and keeps 404 for a handle the host never minted. Three sentences of this section were wrong rather than merely incomplete and are corrected with them: the route count, the promise that `WireRefusal` and `WireRun` were *"still declared"* in `packages/server` — they are `@quorum/shared`'s now, each with a schema, which is what this section's own *"the same way rather than copying it"* meant — and the *"what the transport still owes"* list, which had described a surface that existed. **What the guard added here found is that Q-0119's five read routes were named on this page as a noun list and never as routes**, so the document had been a paragraph behind the code since 2026-09-11; they are named now, and `packages/server`'s suite derives the registered set from its own source rather than checking two sentences, so the next route added without a sentence is a failing test. **No glossary term is coined and none is owed**: a listing of live runs invents no vocabulary, and minting one reaches `CLAUDE.md`'s term list, which Q-0103 erratum E-2 makes the human's to write. **2026-09-12 (Q-0122): the daemon serves the built web app, and this document stops calling the packed set by the emitting set's name.** §`apps/web` says the app emits and §`packages/server` describes the twelfth route — `GET /*`, registered ahead of the eleven rather than behind them, because four of the shell's twelve paths are also `GET` routes here and a fallback registered last is never reached for them. Three sentences that were true until a fourth package emitted are corrected with it: the **Shape** paragraph's *"`pnpm pack` in each of the three emitting packages"*, which named the packed set by the emitting set's name; the cache-hit paragraph's list of what declares a `build` script, which named three of four; and the package map's `packages/server` line, which still said the Hono daemon *"does not exist"* — a sentence Q-0118 falsified on 2026-09-11 and which no criterion of this ticket named, found while editing the section around it. The map's *"ten leaf modules"* under `shared/` was stale by two before this change added a thirteenth. **No glossary term is coined and none is owed**: **Emitted artifact** widened to carry a second shape and **Confinement** gained a third declared root, both of which are existing entries — see *"A fourth package emits, and what it emits is served rather than shipped"* (2026-09-12). **2026-09-12 (Q-0125): `@quorum/server` resolves, exports and emits, so the emitting set is five and the local distribution set stays three.** §`packages/server` says the package publishes a conditional `exports` map and emits the artifact its `default` condition names, and states the reason neither landed entry had: nothing outside this workspace consumes it, and what forces the emit is a **workspace-internal consumer running outside the workspace's own conditions** — `pnpm exec quorum` under plain Node. **Two packages are now the difference between what emits and what ships rather than one**, and they are not the same kind: `@quorum/web` is *served* and not distributed, `@quorum/server` is *resolved* and not distributed. Four count-bearing sentences move with it — the **Shape** paragraph, §`packages/server`'s route sentence, §`apps/web`'s emit sentence and the cache-hit paragraph's list. **The one that is a ruling rather than a count is §`packages/server`'s frame-union paragraph**: it said `apps/web` *"cannot import `@quorum/server` at all: it has no `exports` map … where a guard is weaker than an impossibility"*, and this ticket removes the impossibility. The conclusion survives and the barrier changes kind, so the sentence now names what actually holds — `apps/web` declares no dependency on the package and its own manifest register refuses one in both directions — because a document claiming a stronger protection than the code has is the failure this page has recorded most often. §`apps/web`'s *"without giving the server package a browser-facing export surface"* moves for the same reason. **No glossary term is coined and none is owed**: **Emitted artifact** and **Build task** are re-derived, both existing entries, so neither 22-term list moves and `CLAUDE.md` stays the human's (Q-0103 erratum E-2). See *"A fifth package emits, and `resolved` is not a synonym for `distributed`"* (2026-09-12). **2026-09-14 (Q-0126): `quorum open` ships, so this document stops promising it and describes it.** §`packages/cli` says the frame dispatches **nine** commands rather than eight, and gains a paragraph on the one command that does not return — what it serves, how it stops, what it refuses, and the four things it deliberately does not do. Two sentences that were true until it shipped move with it: §`packages/cli`'s opening line, which listed `quorum open` beside `quorum compile` and `quorum history` as three commands that do not exist, and the cache-hit paragraph's *"`@quorum/server`'s is consumed by nothing yet"*, whose second clause — *"it exists so that Q-0126's `quorum open` resolves to a file"* — is what happened and stays. **The paragraph that is a ruling rather than a description is the packaging one**: this is the first command that may be unavailable at run time, because `@quorum/cli` declares the daemon under `optionalDependencies` and reaches it through a dynamic import, and what the refusal on such an installation may claim is bounded — *what failed to resolve here*, never *why* — which is *"A probe that could not answer is not a negative"* (2026-09-10) at a new site. The arrangement is **provisional against Q-0124**. One clause of Q-0125's export surface moves with it and no other: `ServeOptions.bundle` takes `string | URL`, because the one caller that knows where the bundle is may import no `node:url` and `.pathname` does not decode percent-encoding — `initProject(dir, templates)`'s shape at a second site. **No glossary term is coined and none is owed**: *daemon* is used throughout this document already and this ticket introduces no noun, so neither 22-term list moves and `CLAUDE.md` stays the human's (Q-0103 erratum E-2). See *"An optional edge says the daemon may be absent, and never why"* (2026-09-14). **The same ticket's second half moved principle 1, which is the larger edit and the one to read first.** `core` gains a **ninth folder**, `browser/`, and principle 1's enumeration widens by one item to name what it does — *"It spawns CLIs, opens a URL in the platform's default browser, reads/writes the project folder and git"* — while every clause that principle forbids is unchanged and is restated in the entry so the widening cannot be read as general. The package map and the folder sentence move with it, and `harness/architecture.md`'s principle 2 carries the same sentence and moved in the same change, because that file is fed to an agent at run time and a boundary that reads two ways is not one. What put the launcher in `core` rather than in the package whose command it serves is not preference: `packages/cli` may import no process-spawning module in any production module, which is Q-0093's division for `quorum init`'s scaffolding at a second site. §`packages/cli`'s `quorum open` paragraph gains what the launcher may claim — a closed set of four states, `open` and `xdg-open` spawned with the URL as one argv element and never a command string, Windows **`unsupported` explicitly** rather than a row nobody has run, and no state that says a browser is absent, which is **Containment**'s discipline at a fourth subject. See *"`core` opens a URL, and the ninth folder is named for what it is about"* (2026-09-14). **2026-09-15 (Q-0124): five packages emit and five are packed, so a packed install carries the UI and the daemon.** The **Shape** paragraph, the cache-hit paragraph, §`packages/server` and §`apps/web` each carried a count or a consequence of the split 092 opened and 093 widened, and all four move: the local distribution set is the emitting set again, `@quorum/web` declares one named locator subpath so `packages/cli` finds the bundle by package name, and `@quorum/server` is a required dependency rather than an optional one. **The clause to read twice is that this moves nothing about publication**: *distributed* means a tarball this repository packs and installs, `private: true` stays on all five because `pnpm pack` does not refuse one, and registry-resolved `npx quorum` is still refused until Q-0029. **What is not withdrawn is the vocabulary**: *resolved* and *served* name shapes rather than sets, which is why the two registers stay separate and a sixth emitter can part them again. The `quorum open` paragraph loses its *"may be unavailable at run time"* clause with the optional edge it described, and §`apps/web` loses *"no tarball carries it"*. **No glossary term is coined and none is owed**: **Emitted artifact**'s membership sentence moves and its two shapes do not, so neither 22-term list moves and `CLAUDE.md` stays the human's (Q-0103 erratum E-2). See *"The distribution set is five, and rejoins the emitting set"* (2026-09-15), which supersedes *"An optional edge says the daemon may be absent, and never why"* (2026-09-14). **2026-09-16 (Q-0017): the first of the nine screens exists.** §`apps/web` describes the backlog board rather than promising it — the one module every request in the app goes through, the closed set of answers one request can have, that it never polls and says when it loaded, and the five board rules that moved into `@quorum/shared` so `quorum board` and the screen cannot answer differently about one repository, with no printed byte of the command moving. The sixth, the cost legend, could not follow them because that package may name no vendor in code, so it is declared twice and pinned byte-identical instead. **The clause that is a correction rather than an addition is the fetch one**: this section said *"nothing is fetched from a network"*, and the guard behind it scans for three URL literals that a same-origin path trips none of — so the claim would have gone false in silence the moment the app started fetching. It states the property that scan enforces now, `apps/web/test/source.test.ts`'s own describe title moved with it, and `packages/shared/src/docs.test.ts` holds the two against each other. `docs/05-design-prompt.md` was corrected in the same change: it was the third document to promise the gate override `gateAnswerEnvelopeSchema` refuses and the last to be looked at, Q-0013 and Q-0118 having recorded that discharge as complete over two of the three. **2026-09-17 (Q-0015): the hero screen exists, and three of the four figures its brief puts in the header do not.** §`apps/web` describes mission control and the runs landing, the lossless partition into columns and a run-level lane, the observed-only timeline, the bound on the browser's retained events and the two losses it keeps apart. **The clause that is a measurement rather than a description is the last one**: `host.start` has exactly one production caller and nothing issues it, so the daemon's run registry is empty on any real machine and this screen's empty state is the true one — which is why the acceptance evidence records the hand `POST /runs` that produced the run it was demonstrated against, rather than claiming somebody watched one. **No glossary term is coined and none is owed**, so neither 22-term list moves and `CLAUDE.md` stays the human's (Q-0103 erratum E-2). Principle 2 was rewritten 2026-08-29 (Q-0050): `runFlow` is a lazy, single-consumer `AsyncIterable<Event>` whose cancellation belongs to the caller's `AbortSignal`, and the public-API line names it — see *What a run's event stream carries, and how a gate answer travels back* (2026-08-28) and its 2026-08-29 erratum.*

## Shape

A pnpm + Turborepo monorepo, TypeScript strict everywhere, Node ≥ 22. One command starts a local
daemon and opens the browser UI; the same daemon serves the CLI. **Three claims are kept apart
here, because only two of them are true today.** The **workspace-local** path is supported and
tested: `pnpm install && pnpm turbo run build`, then `pnpm exec quorum` from the repository root.
The **locally packed** path is supported and tested: `pnpm pack` in each of the five **distribution**
packages and an install of the five tarballs together into a project outside the repository. **Five
packages emit and five are packed**, and since 2026-09-15 those are the same five — the two sets came
apart on 2026-09-12 when `apps/web` gained a build task nothing shipped, widened when `packages/server`
gained one, and closed at Q-0124, which packs both. That they coincide is a property of this moment
rather than a rule: *emitting* and *distributed* stay two questions with two registers, and a sixth
emitter could part them again. The install carries the web app and the daemon, so `quorum open` serves
mission control there as it does in the workspace. See *"The distribution set is five, and rejoins the
emitting set"* (2026-09-15).
**Registry-resolved `npx quorum` is refused rather than deferred** — every package is
`"private": true`, so that command resolves against the public registry and fetches a stranger's
package or nothing; publishing is Q-0029's, in M6. See *"The emit serves the binary, and no test
verdict moves behind it"* (2026-09-02), clause (d), and Q-0098, which is where the two supported
paths acquired tests.

```
quorum/
  apps/
    web/            Vite + React UI (mission control, gate screen, backlog board, editors)
  packages/
    core/           engine, backlog, lint, contracts, git/worktrees, adapters, fanout,
                    run-history, browser
      src/          one folder per module, named as Q-0009's children are (Q-0064):
                      adapters/ backlog/ browser/ contracts/ engine/ fanout/ git/ lint/
                      run-history/
                    index.ts stays at src/ root; tests are colocated with the code they test
    server/         the run host that starts, streams, gates and stops runs (Q-0013), and the
                    Hono HTTP + WebSocket daemon over it (Q-0118), which also serves the
                    built apps/web at GET /* (Q-0122)
    cli/            `quorum` binary: init · ticket · board · run · lint · adapters · open
    compiler/       canonical harness/ → CLAUDE.md / AGENTS.md / GEMINI.md (thin, linked)
    templates/      a three-file scaffold that holds no assets and has no build task: the
                    shipped harness/ (flows, roles, context files) lives in cli/templates/,
                    where `quorum init` reads it and where the CLI tarball ships it (Q-0093)
    shared/         types, schemas (zod), event/trace format, constants  ← declarations only
                    deliberately flat: thirteen leaf modules, and index.test.ts pins index.ts to
                    `export * from './<name>.js';` lines, which a folder path cannot satisfy
  docs/             these documents
  harness/          Quorum's own harness — it is developed with itself from M2 onwards
  backlog/          Quorum's own backlog (files in git, like every other project)
```

## Principles that shape the code

1. **`core` has no I/O it doesn't own.** It spawns CLIs, opens a URL in the platform's default browser, reads/writes the project folder and git. It never touches the network, never stores secrets, never reads API keys. Everything else is a thin shell around it. The browser launch is Q-0126's, and what moved is one item of that enumeration rather than the rule: handing a URL to a local launcher opens no socket and learns nothing about what is at the other end, and a later widening writes its own entry naming this list — which is what makes it a boundary rather than a list that grew. See *"`core` opens a URL, and the ninth folder is named for what it is about"* (2026-09-14).
2. **One trace format.** Every adapter maps its CLI's output to `shared`'s event schema, and nothing above the adapter layer branches on which vendor produced an event. Two shapes, because two interfaces exist. An **adapter** emits `spawn` and `stdout` and knows nothing about the run around it; the contract layer's retry wrapper adds `retry`. A **run** emits those three with the step id the engine supplies, plus `step`, `done`, `info`, `warn`, the correlated gate question and one final `terminal` event. Vendor identity survives as one neutral, open `vendor` label — per-vendor cost roll-ups require it and a blended number is forbidden — but no field is one a single vendor could populate. `tool` and `text` are named nowhere in this list on purpose: they were documented here before anything emitted them, and they arrive when an adapter normalises vendor JSONL into them (Q-0041, 2026-08-25). `runFlow` exposes a lazy, single-consumer `AsyncIterable<Event>` over a lossless FIFO: order is stable within one step, while parallel members have no global ordering or interleaving promise. A gate is emitted before the out-of-band `answerGate` callback is invoked. Cancellation belongs to the caller through an `AbortSignal`; core installs no process signal handler. Events deliberately carry no timestamp or sequence number, and only the terminal event carries run identity. The UI, the CLI and run history all consume the same stream; nothing persists it in v1. These boundaries follow *What a run's event stream carries, and how a gate answer travels back* (2026-08-28) and its 2026-08-29 erratum.
3. **Files are the database.** Tickets, flows, roles, run logs and traces live in the project folder (`backlog/`, `harness/`, `.quorum/runs/`). The daemon keeps an in-memory index and rebuilds it from disk on start. No SQLite in v1.
4. **The daemon is stateless across restarts.** A run that was interrupted is resumable from its last completed step because every step's result is on disk.
5. **UI is a view, never the source of truth.** Editing a flow in the UI writes the YAML file; the form is generated from the flow schema in `shared`.
6. **Safety by construction.** Worktrees under `.harness/worktrees/` (git-excluded), integration branch per ticket, human-locked gates — enforced in `core`, not in the UI. Budget caps are specified in `harness.yaml` but not yet enforced anywhere. **A worktree is not permanent.** A run that finished — `completed` or `regressed` — removes the worktrees it obtained, keeping any that is not clean and naming the paths that kept it; a run that did not finish keeps every one of them, because the directory it stopped in is the thing a maintainer is about to open. It is the same predicate the ticket-branch rollback reads, the other way round. **No ref is ever deleted** — not a task branch, not a step branch, not the integration branch — so a removed directory is always re-creatable from its branch, and a review after the run still has something to read. Cleanup is registration and never enumeration: a run removes what it obtained and nothing else, whoever created it. See *"A run removes the worktrees it made, and never the refs"* (2026-08-31). **The backlog store resolves a ticket token to a directory inside its own root, and `write`, `writeFile`, `readFiles` and `log` work only inside a ticket folder** — both sides resolved and file by file, so a symlink at a folder *or at a leaf* carries neither a write nor a globbed read out of it, and the refusal is `core`'s rather than a surface's, which is what M3's server inherits when it takes a ticket id from a request body. One read sits outside that guarantee deliberately: `read` and `list` open a ticket's own `ticket.md` unchecked, so a link planted at that name is still listed and still read, while the store refuses to write back through it — which is the half that keeps bytes inside the root (Q-0059; **Confinement** in the glossary, which is not **Containment**). **A ticket has one run at a time.** A run takes a **run lock** on its ticket before it reads the branch head, allocates a run directory or obtains a worktree — the three things two concurrent runs collide on — and gives it back in a `finally` that covers every exit; a second run refuses and names the holder rather than waiting, and a lock whose holder is gone still refuses rather than being reclaimed. Enforced in `core` for the reason confinement is: M3's server starts a run over HTTP and inherits this refusal instead of writing a weaker one. See *"A run holds a lock on its ticket, and a stale one refuses rather than being reclaimed"* (2026-09-09).

## Packages in detail

### `packages/core`
Seeded from the spike (`engine`, `backlog`, `fanout`, `git`, `adapters/*`), converted to TypeScript and validated against the zod schemas for flows, tickets, roles and step outputs that `shared` defines — `core` imports them and declares none of its own. Public API: `loadProject(dir)`, `runFlow(opts): AsyncIterable<Event>`, `lintFlow`, `Backlog`, `Adapter` interface. The mock adapter stays in the package for tests and demos.

Laid out as one folder per module (`adapters/`, `backlog/`, `browser/`, `contracts/`, `engine/`, `fanout/`, `git/`, `lint/`, `run-history/`), the names Q-0009's fourteen children already carry, with `index.ts` at `src/` root and tests colocated. `shared` stays flat, for the reason given above. See the 2026-08-26 DECISIONS entry. **`browser/` is the ninth and the first not named after a port child**: Q-0126 needed a browser launcher, `packages/cli` may spawn nothing, and no existing folder is about opening a URL — `fanout/` is pinned at exactly two files, `adapters/` is confined to vendor knowledge, and the remaining six are each named for something this is not. A folder placed where it is not about anything is how a layout stops meaning what Q-0064 made it mean, so the ninth is the cheaper answer and is a visible act by construction. See *"`core` opens a URL, and the ninth folder is named for what it is about"* (2026-09-14).

Since Q-0096 the package publishes that API through a conditional `exports` map, and since Q-0097 it emits the artifact the map's default condition names. What the emit is and what a cache hit on it gives back is described once, under **Testing strategy** — deliberately not restated here, because a transcription of configuration drifts silently while going on looking like the thing it describes.

**The dependency direction is one-way: `core` → `shared`, never the reverse.** `shared` depends on no other workspace package, and nothing in it may import from `core`, `cli`, `server`, `compiler`, `templates` or `apps/web`. No cycle between workspace packages is permitted.

### `packages/server`

**The frame union is declared in `@quorum/shared` and re-exported here, not declared here.** It is
what crosses the run-events socket, so both ends need it — and only one end can reach this package.
`apps/web` must not import `@quorum/server`: a value import from a browser bundle would pull `hono`,
`@quorum/core` and Node builtins in with it. **That barrier changed kind at Q-0125 and the
conclusion did not.** This used to say the app *could not* import it at all, on the ground that the
package published nothing and that a guard is weaker than an impossibility — exact until the package
declared an export surface. What holds
now is a guard, and it is one layer earlier than the scan a reader reaches for: a dependency edge is
the only thing that creates a `node_modules` link, no link means no resolution, and
`apps/web/test/package.test.ts` holds its justification register against the declared manifest **in
both directions** and pins `dependencies` to exactly three names — so adding this package there
fails two assertions. Saying so is cheaper than leaving a reader to discover that the check which
settles it is one file away from the one that looks like it should. See *"A fifth package emits, and
`resolved` is not a synonym for `distributed`"* (2026-09-12), clause 5. `@quorum/shared` is the package with a browser-safe export surface, a
browser-safety check over every file, and a header naming the web app as its reason — and the schema
must be executable rather than a type, because a `JSON.parse` result assigned to a `WireMessage` is a
silent default. So the definition sits there and this package re-exports the name, which keeps this
barrel unchanged and keeps the contract single. **Since Q-0121 `WireRefusal` and `WireRun` are there
too**, each with a schema of its own: this section said whoever first needed one from a browser would
move it *"the same way rather than copying it"*, and the same way means with an executable parser,
because a moved type and no schema is the half-measure Q-0120 had to repair. What stays in
`packages/server` is the three constructors and the status tables — a shape says what a value is, and
building one out of a run the host is driving is something `@quorum/shared` may not know how to do.

**Since Q-0118 this package is the daemon.** `serve()` opens a socket on `127.0.0.1` and nothing
else — not configurable, because there is no authentication of any kind and the process starts agent
runs and writes to a git repository, so a non-loopback bind puts that on a network. This document
said *"localhost-only by default"* from 2026-08-22; the *by default* is gone, a flag whose only use
is to make the product unsafe not being a feature.

**Five routes and one socket, over the host below.** `POST /runs` starts, `POST /runs/:id/gate`
answers, `POST /runs/:id/stop` stops, `GET /runs` lists the runs this daemon is driving,
`GET /runs/:id` answers for one of them, and `GET /runs/:id/events` upgrades to a WebSocket carrying
one event per message as JSON. `:id` is the host's handle. **The transport owns no run state**: every
route turns a request into one host call and one status, and the statuses are a table rather than a
decision per route — a lock refusal is **409** and a missing ticket **404**, because a client that
cannot tell them apart cannot tell *try again shortly* from *you asked for something that is not
there*.

**The two reads are Q-0121's, and they answer two different questions.** Until then `POST /runs` was
the only route that ever told a client a handle, so a client that never held one — a fresh tab, a
second browser, a tab whose URL was closed — could reach no live run at all, and the retention buffer
built for *a browser opened after a run began* had no way to be named. `GET /runs` answers *what can
I join?*: the runs the host can back, `running` and `ended`, newest-minted first, and never a refused
start, which has no event stream, whose socket closes 1008 and whose handle was disclosed to nobody.
`GET /runs/:id` answers *what do you know about this handle?* and therefore reports a refused start as
`refused` rather than as an absence, reserving **404** for a handle the host never minted — which is
what makes that refusal's condition true of the case it answers rather than a failed probe read as a
proven negative. Both are derived per request with **no cache**, which is containment's and push
lag's discipline applied to a third subject, and one projection serves all three run-answering routes
so they cannot report one run three ways. A row is
`{handle, flow, ticketId, runId, state, pendingGates, gates, refusal}`: the ticket narrows to its id,
so no ticket record crosses the wire and that field does not keep the name of the field it narrows.
`state` is the host's closed `refused | running | ended` rather than a string.
**`refusal` carries the host's own refusal whole and carries no code** (Q-0016). A `refused` row said
only that the start never happened, so the one surface rendering one could name no reason and had to
say it carried none — a surface admitting a gap with the daemon's own sentence one field away, and
the condition is what a criterion asking for the daemon's condition is satisfied by. What is
deliberately absent is a `WireRefusal`'s `code`: that is the classification `startRefusalCode` makes
so `POST /runs` can pick a **status** for the request it is refusing, and this row is answered `200`,
so a code here would attach a status nobody sent to a refusal nobody asked for. It is `null` on a
row that started and `null` on a `refused` row whose start has not resolved yet, which is a record
minted and still in flight rather than a gap.
**`gates` carries the pending questions WHOLE, and it is the one field here that narrows nothing**
(Q-0016). It was a count alone until then, which is what made a run answerable from a terminal and
from nowhere else: `gateId` is the correlation token an answer has to echo and it lives in the
question, so a browser holding only the number could say a gate was waiting and could not say what
it asked or offer an answer to it. That is why the name is kept rather than changed — Q-0121 GO-3's
rule binds a wire field that narrows one, and this is the same array by the same element schema,
`@quorum/shared`'s own `gateQuestionEventSchema` reused rather than re-declared. `pendingGates`
stays beside it, computed as that array's length in the one projection, so the two cannot disagree
and a listing of many runs still has a number to render. A ticket folder therefore reaches a client
through a question's `ticketDir` and through no row.
**That pass-through is what carried Q-0129 with no edit in this package at all**: the gate question
gained `reached` — the deciding step's id and the verdict, findings and summary that step returned —
and because the element here IS the event union's own schema, the field reached `GET /runs/:id` and
the browser without a line moving, which is the property a hand-copy of the question's fields would
silently lose and which `packages/server`'s suite now asserts over a real socket rather than from
this sentence. **Host records are never pruned**, which a
listing is the first thing to make visible; that
is registered as **Q-0123** and deliberately not fixed here, because evicting an ended run would
remove the replayable buffer this listing exists to reach.

**The third read is Q-0134's, and it is the first route here whose answer is bytes a RUN produced.**
`GET /runs/:id/gates/:gateId/diff` answers, while one gate is waiting, the diff the step whose
decision reached it was given — the patch, the `--stat`, and the truncation outcome as the run
measured it. It takes the handle and the opaque `gateId` and nothing else: no git range, no ref and
no filesystem path crosses from a client, and nothing is re-derived when the screen opens, because
refs move and a second measurement could show a reader a diff the reviewer never saw. **The bytes
reach the host out of band**, through a `RunFlowOptions` callback beside the run-number one, and
they are captured inside `materialiseDiff` — the site both paths to a materialisation come through,
which is what makes a **chore** run's range reachable at all: the preflight caches a range only
where every endpoint already exists, and `chore.yaml` diffs against a branch its own earlier step
creates, which is **186 of the 208** patches this repository's run history holds. **They are never
an event**, and the reason is size and replay rather than kind: a patch is capped at
`repo.max_diff_bytes`, 200,000 by default, against a 214 B mean event, and an event enters a
retained buffer replayed to every late subscriber — so the two halves of one gate screen take
opposite answers, the decision travelling on the question (Q-0129) and the evidence not.
`contracts/Q-0050/run-events.contract.md` records that beside the clause it qualifies.
**A gate is answered this only where its own `reached` names the step the bytes were materialised
for**, which is an identity rather than a guess about which diff was most recent; a gate whose
deciding step read none is told so in as many words rather than handed an empty patch, which is the
`no-diff` refusal and is one of four the `code` tells apart. **That identity is why the run files a
snapshot under the step that was given it rather than keeping the last one reported**: the preflight
materialises every range whose endpoints already exist *before any step runs*, so with two such sites
the most recent report at the first gate is the wrong site's, and a single slot answers `no-diff` for
a step that read a diff the host is holding — a patch reported as an absence, which is the class
Q-0074 and Q-0115 spent two tickets removing. What bounds it is the flow rather than a cap: of the six
shipped flows `chore` declares one diff site, `review` declares two over one range that the preflight
cache makes one snapshot, and four declare none, so a run holds **at most one**. **Its lifetime is the
gate's**: bound as the question is observed, released when that gate is answered and when the run
releases its gates, with any snapshot no gate claimed cleared on both of a run's exits — as it ends,
and on the refusal that never became a run — so nothing outlives the question it was evidence for and
a host record carries no patch once its run is over, which is what keeps Q-0123's measurement of what
a record costs still true.

**The two routes answering for ONE ticket are Q-0127's, and they are two rather than one because of
a measurement.** `GET /tickets/:id` carries the same row `GET /tickets` holds for that ticket —
through one projection, so a board card and a page header cannot report one ticket two ways — beside
the **names and sizes** of every file in its folder and nothing of their contents.
`GET /tickets/:id/file` then reads exactly one of those files, named by a `?path=` query value rather
than by a path segment, a relative path holding `/` and a segment meaning the client encodes and the
route decodes, which is where a confinement bypass hides. The largest ticket folder here is 3.1 MB
across six files, one of them 1.46 MB, so a single route answering *the folder* would put an
unbounded body on a wire; and no pattern `Backlog.readFiles` accepts can enumerate a folder at all —
it refuses the empty pattern and hands the first subdirectory to `readFileSync` — so the listing is
a `core` primitive rather than a narrower glob. **There is no cap anywhere and that is the design**:
nothing large is fetched until a reader names that file with its size in front of them, which is
what stands in for one rather than a limit nobody is told about. **A path whose first segment begins
with a dot is counted and never named**: those are the engine's own verdict files, gitignored and
therefore not in the database this product keeps, and the answer carries how many were excluded and
how many bytes without carrying one of their paths — enough to say the listing is not the whole
folder, and short of being a second run-history surface. Six refusals, each with its own code: a
token that is not one name is **400**, a token naming no folder **404**, a `ticket.md` that yielded
no id, title, stage or owner — or one whose id is not the ticket that was asked for — **422**, a
path this request's own listing does not hold **400**, a listed path that has stopped being a file
**404**, and a file whose bytes are not well-formed UTF-8 **422**. That last one is a whole-file
fatal decode of the bytes that were read, because `readFileSync(file, 'utf8')` substitutes U+FFFD
rather than throwing — and it is not a test for that character, three files under this repository's
own backlog carrying one legitimately. **The listing and the detail are deliberately asymmetric
about a damaged ticket**: `GET /tickets` renders it, named by its folder, because a board that hides
one is wrong about the one question a board answers; the page refuses it, because a page of blanks
is not a ticket. That surfaces Q-0060 at this boundary and changes no parser.

**The two answering for what a RUN retained are Q-0137's, and they are the first routes here that
read a file `core` itself wrote.** `GET /history/:id/retained` names and measures every occurrence's
retained files — a leaf name and a size apiece, from `readdir` and `lstat`, with nothing in the
directory opened — and `GET /history/:id/file` reads exactly one of them, named by an `?occurrence=`
sequence number and a `?name=` leaf. Two routes rather than a widening of `GET /history/:id`, which
is mission control's and is read on every load of a screen that will never fetch one: widening it
would put a `readdir` and an `lstat` per occurrence behind a cost header — up to 55 on this
repository's largest run — and would retire that route's own property, *"It reads exactly one
file."* **There is no cap anywhere and that is the design**, which is the ticket-file pair's answer
at a store fifty times the size: one run's retained text reaches 3,514,617 B and one occurrence's
355,744 B, and nothing large is fetched until a reader names that file with its size in front of
them.
**Occurrence confinement and byte reading are `core`'s, and no filesystem path crosses this boundary
in either direction.** A client supplies a run token, a sequence number and one name; `core`
resolves the run, confines the occurrence directory **the manifest records**, enumerates it for that
request and opens the file. That value is the untrusted one here and the difference from
`GET /tickets/:id/file` is worth stating: there the untrusted string arrives over HTTP, and here it
arrives from a file this product wrote and re-checks nowhere — `readRun` calls the parsed manifest
*"a cast, never a check"*, and no occurrence field is validated anywhere on the read path. It is
confined with `pathInside` and deliberately not `isFolderIn`, an occurrence directory sitting two
components below a run's rather than one. **The browser never receives `occurrence_dir` and neither
route accepts it under any spelling**, by one mechanism and not two: each declares the query keys it
accepts — `occurrence` and `name` for the file route, and **nothing at all** for the listing, which
is answered by the run token alone — and refuses any other under `unknown-field`, rather than
serving the request from the keys it understood while dropping the rest in silence. That is
*"Unknown keys are refused where Quorum owns the key set"* (2026-08-25) applied to a request rather
than to a body, under the code this transport already answers where a **body** carries a field a
route does not accept: one condition, one code, so a client switching on it need not know which of
the two routes it asked. An empty accepted set rather than an absent check is what makes the listing
refuse one, and *ignored* is not *rejected* — a 200 over a key nobody read tells a client its
request was understood. The identity is
`seq`, and a sequence number more than one
occurrence answers to is refused as ambiguous rather than answered, because *more than one* is not
*none*. **Membership is derived for the request that reads**, never from a listing a client fetched
earlier, which is what makes a name the writer *could* have created and did not unreadable —
`persist` takes an artifact's name as a plain `string` parameter. Nine refusals, each with its own
code: a token naming no run **404**, a manifest that would not parse **422**, an occurrence or name
value that is malformed **400**, a sequence number matching no occurrence **404**, one matching more
than one **409**, an occurrence whose recorded directory is refused **422**, one whose recorded
directory could not be read at all **422**, a name this request's own listing does not hold **400**,
and a listed name that has stopped being a regular file **404** —
the last two never collapsed, the first saying the name was never this occurrence's and the second
that it was and is no longer. A listed name replaced by a symlink is the second and its target is
not followed. **Neither of them is collapsed with the unreadable directory either**: they assert an
absence the read established, and a directory the operating system refused enumerated nothing, so it
establishes none — *"A probe that could not answer is not a negative"* (2026-09-10) at the code a
client switches on. A file whose bytes are not well-formed UTF-8 is **422**, through the same whole-file
fatal decode the ticket-file route uses, which is not a test for the replacement character: sixteen
of the 1,797 files this repository's run history retains carry one legitimately. **A single refused
occurrence never takes the run's listing with it** — it is named in `warnings` beside the
occurrences that were readable, which is `failSoftly`'s distinction one level in from where the
store listing already applies it. That holds for a directory the operating system refuses **while it
is being read**, entry by entry, and not only for one it refuses outright: `throwIfNoEntry`
suppresses `ENOENT` and nothing else, so the enumeration and the measurement of what it found are
one error boundary rather than two, and the warning names the error's code alone. Nothing here
creates, repairs, rewrites or deletes anything
under `.quorum/`, including for a manifest whose `occurrence_dir` is refused.

**A body is validated before the host is reached, and a refused request starts nothing.** Unknown
fields are refused rather than ignored, and the offender is quoted. A refusal carries three fields
with three different authorities: a `code` a client switches on, the `condition` in `core`'s own
words — *"A `core` error names the condition; the remedy belongs to the surface"* (2026-09-07) — and
a `remedy`, which is this surface's and is usually `null`.

**Nothing on the wire is rendered.** A late subscriber is told how many events it missed, in a
message kind that is not an `Event`, so a client parsing with `eventSchema` never meets a value it
cannot classify. That is the WebSocket end of the escape-byte rule stated below.

**It declares three external dependencies** — `hono`, `@hono/node-server` and `@hono/node-ws` — with
no decision entry, because this document chose Hono on 2026-08-22 and executing a landed document is
not changing the architecture. The Node adapter is pinned to `1.x` by the WebSocket package's peer
range, which is load-bearing rather than incidental.

**The run host, which Q-0013 built and this serves.** What exists is the
**run host**: an in-process registry that starts a run against `core`'s lazy stream, consumes that
stream exactly once and fans it out to however many watchers are attached, holds the pending gates
and settles an answer that arrived somewhere else, stops one run through the `AbortSignal` it was
started with, and releases every live run on shutdown — waiting, as it does so, for each run's
interrupted-run persistence rather than for the stream. It opens no socket, installs no process
signal handler and never exits the process, which is what makes it a library and not yet a daemon.
**Since Q-0125 the package publishes that API through a conditional `exports` map, and emits the
artifact the map's default condition names** — the shape `packages/core` has carried since Q-0096
and Q-0097, arrived at here for a reason neither of those had. Nothing outside this workspace
consumes `@quorum/server`, so 078(a)'s *"something outside the workspace consumes it"* does not
reach; what forces the emit is a **workspace-internal consumer running outside the workspace's own
conditions**. `pnpm exec quorum` runs `packages/cli/dist/quorum.js` under plain Node, which knows no
`quorum-source`, so a future import resolves through `default` and that condition must name a file
that exists. **It emitted without being distributed** for two days, which no package had been before;
Q-0124 packs it, so the emitting set is five and the local distribution set is five. A tarball carries
this package now, `@quorum/cli` requires it, and `quorum open` reaches a daemon on a packed install as
it does in the workspace. It declares `files` and a `license` and keeps `private: true` — *distributed*
means a tarball this repository packs and installs, never publication, which is still refused until
Q-0029 — and declares no `bin`. See *"The distribution set is five, and rejoins the emitting set"*
(2026-09-15), which closes the question *"A fifth package emits, and `resolved` is not a synonym for
`distributed`"* (2026-09-12) left open; that entry's separation of **resolved** from **distributed** is
a fact about shape and is not withdrawn.

**A run the host is driving is named by an id the host mints, and `core`'s run number is correlated
onto it when the terminal event arrives.** The two are deliberately different things and neither is
derived from the other: the host's is opaque, unique within the process and meaningless across a
restart — resuming an interrupted run is Q-0019's — while `core`'s is the run number `runs.log` and
`.quorum/runs/<ticket-id>-<n>/` are named after. Waiting for `core`'s could not have worked, and the
reason is worth writing down because it is not obvious: both refusals a start can meet happen before
any event is emitted, and in neither does `core` have a run number to give — the stage precondition
throws above the run-number allocator, and that allocator reserves nothing, so a contender the run
lock refuses has read the *holder's* number. A refused start therefore reports no run number at all
rather than a plausible wrong one, and the host reads no event's prose and takes no run number out
of a correlation id. **That minted id is what `:id` names in the routes below.**

**A start does not report success until the run is under way**, because `runFlow` is lazy:
the stage precondition and the run lock are evaluated on the first pull, so a host that stored the
iterable and answered its caller would report two concurrent starts on one ticket as two started
runs. Both refusals reach the caller as the condition `core` gave, unaltered.

**Shutting down closes the host to new starts, and the two are one mechanism rather than a courtesy.**
That same laziness means a start in flight is not yet a running run, so a shutdown that snapshotted
the running runs and resolved would leave one that became live a moment later holding the ticket's
lock, its worktrees and its branch, with nothing left to release it. So shutdown closes first, waits
for the starts already in flight, and only then takes the snapshot: closing is what makes the
snapshot final and waiting is what makes it complete. A start issued after that is refused with a
condition of **this surface's own** — the one sentence here that is not `core`'s, because `core` was
never asked.

**The fan-out belongs to the host because the stream is single-consumer** (principle 2). `runFlow`
throws on a second iteration, so a host handing the iterable to a per-connection handler is correct
for one watcher and throws on the second. What a watcher arriving mid-run receives is a bounded
count of retained events chosen when the host is built — zero is live-tail-only — and a replay that
eviction made incomplete tells that watcher how many events it missed, **beside the stream rather
than inside it**: the event union is closed, so a truncation notice within it would have to widen it.
Which value the product ships belongs to the child that creates a late joiner, which is Q-0118's.

**A gate answer travels back through the host and never through the stream.** The host supplies
`answerGate` for every run it starts, so a run nobody is watching is not a run started with no way
to ask; it validates the envelope against `@quorum/shared`'s own schema before `core` sees it, and
refuses an unknown gate, a gate belonging to another run, one already answered, and a word outside
the closed three — each of which, reaching `askGate`, would be rendered as an operator error the
operator did not make. There is no default answer and no timeout: a human answers in a browser,
minutes after the question was emitted, and the only honest lever is stopping the run.

**What the transport owes and what it now has**, against the list this document has carried since
2026-08-22: a Hono app exposing `POST /runs` (start), `POST /runs/:id/gate`, `POST /runs/:id/stop`,
REST for project/backlog/flows/history, and a WebSocket for live run events and gate prompts.
Single-user, localhost on nothing but loopback. All of it exists. The transport is Q-0118's, the
read-only REST surface is Q-0119's — `GET /project`, `GET /tickets`, `GET /flows`, `GET /history` and
`GET /history/:id`, over symbols already on `@quorum/core`'s barrel — and the live-run half that list
never named is Q-0121's, `GET /runs` and `GET /runs/:id`, described above. **Every route this package
registers is named on this page and `packages/server`'s own suite derives the set from the source to
prove it**, so a route added without a sentence here is a failing test rather than a document going
quietly stale.

**Since Q-0122 the daemon serves the built `apps/web`, which is the last thing this list owed**, at
`GET /*` — a twelfth route, registered **ahead of** the eleven above rather than behind them. The
order is the whole of why it works: four of the shell's twelve paths are also `GET` routes here —
`/flows`, `/runs`, `/runs/:handle` against `GET /runs/:id`, and `/history` — and a handler that
returns a response ends the chain, so a fallback registered last is never reached for those four and
a reload 404s while in-app navigation keeps working. It discriminates on the **request** instead: a
path naming a file under the bundle is answered with that file; otherwise a top-level navigation —
a `GET` or `HEAD` asking for `text/html`, the one predicate, declared in `@quorum/shared` and shared
with the dev proxy — is answered with `index.html`; otherwise it calls `next()` and the eleven
answer exactly what they answered before. A path that names a **file** and is not in the build is a
404 and never the shell, because a 200 HTML answer for a missing script is a blank page with a
successful status. **The bundle root is supplied and never discovered** — this package cannot
compute it, the bundle's location being package-relative while the daemon's working directory is
the operator's project — and a supplied root holding no build **refuses before anything binds**,
rather than starting and answering 404 at `/`. With no root supplied nothing changes and no HTML is
ever emitted. This is the third declared root under **Confinement**: a URL becomes a file read
through `core`'s own `pathInside`, so traversal, dot segments, a symlink out of the bundle and a
dangling one are refused by the same primitive the backlog store uses rather than by a second copy.
The five packages that emit are named under **Testing strategy**, of which this serves one and is
itself another.

**Since Q-0018 `GET /history` answers a shape `@quorum/shared` declares, and `GET /project` is the
one route here that still does not.** Both answered an inline object literal nothing declared, which
is not drift while the declared shape is a deliberate narrowing and is the arrangement that becomes
drift the moment either end moves. `WireRunHistoryList` and `WireRunHistoryRow` are the listing's,
`.strict()` where `WireRunHistory` is loose — Quorum owns every key of a row except the roll-up's,
and *"Unknown keys are refused where Quorum owns the key set, and preserved where it does not"*
(2026-08-25) is what decides each level. The row gained the manifest's `started_at`, `ended_at` and
`duration_ms`, an occurrence count, and the roll-up **narrowed to the four fields a surface
renders**: measured over this repository's 171 runs that is 369 B a row against 581 B for the
manifest's rows as they sit on disk, and it costs the daemon no extra read, `readRunsDir` already
parsing every manifest. There is no cap and no paging, the whole listing being 63,115 B. **A run the
route cannot compose a row for is named rather than dropped, and never takes the listing with it**:
`readRunsDir` proves five things about a manifest and this route answers with more than five, so it
parses each candidate against the shape it declares and a failure becomes a `warnings` row carrying
the parser's own words — `failSoftly`'s distinction applied one level in from where that reader
already applies it, the difference from `GET /history/:id` being blast radius rather than principle.
`WireRunHistory` gained `steps`, the `seq`-enriched copy of the occurrence array the route has always
sent: the reason it was absent was that nothing read it, which a caller reading it is what spent.

**One clause of that route list is refused by the code, and is recorded rather than quietly
dropped.** The gate route read `(advance/retry/override with reason)` here until Q-0013, and
`gateAnswerEnvelopeSchema` is `.strict()` over exactly `advance`, `retry` and `abort` — *What a run's
event stream carries, and how a gate answer travels back* (2026-08-28) closed that set, `askGate`
raises on anything else, and a decision entry outranks a numbered document. Widening the envelope, or
carrying an override's reason somewhere that is not the envelope, is **Q-0016's** to ask for with an
entry of its own; until one exists the answer set is three and this document says three. The M3
gate-screen line in `06-development-plan.md` carries the same promise and is corrected by whoever
reaches it.

### `packages/cli`
Same commands as the spike plus `quorum open`, which ships since Q-0126, and `quorum compile` (harness → vendor files) and `quorum history`, which do not. Gates in the CLI are terminal prompts; gates in the UI are the gate screen; both call the same `core` API.

**`quorum open` starts the daemon against this project, serves the built web app, prints one URL and opens it, and it stops when you do.** It is the only command that does not return: `SIGINT` and `SIGTERM` close the daemon through `createDaemon`'s own `close()`, which releases every live run through the abandonment path before the socket stops answering, and it exits 130. The bind is `BIND_HOSTNAME` and no flag moves it; `--port <n>` overrides the one declared default, and a port something else holds **refuses naming that port** rather than drifting to another, because the dev proxy and any bookmarked URL both assume the one they were given. The browser is opened by `@quorum/core`'s `openUrl` and never by this package, which may import no process-spawning module at all — the ninth folder of `core/src` exists for it — and **a launch that did not happen is a warning rather than a failed run**: the daemon is listening by then, the URL line is byte-identical either way, and `--no-open` serves without launching. **What it does not do**: it runs no build — a directory holding no `index.html` refuses before anything binds, naming the directory and the file it wanted — it discovers no already-running daemon, it detects no SSH or container and changes nothing about what it does on one, and it persists nothing. It does not make *"CLI and UI can both answer the same gate"* true either; it makes the UI reachable, and the gate screen is Q-0016's.

**What the launcher may claim is bounded, and that is the second half of Q-0126's ruling.** `openUrl` spawns `open` on darwin and `xdg-open` on Linux with the URL as one argv element and never composes a command string, so there is no shell and no injection surface; **Windows is `unsupported` explicitly**, its `start` being a `cmd.exe` builtin an argument-based spawn cannot exec, which is a smaller promise than a row nobody has run. Its result is a closed set of four — *launched*, *unsupported platform*, *executable unavailable*, *launch failed* — and none of them is a claim about a browser: it knows the process it started and how that process exited, so *launched* never means *a page is showing* and a failure is never rendered as *there is no browser*. That is **Containment**'s, **push lag**'s and **verified version**'s discipline at a fourth subject. See *"`core` opens a URL, and the ninth folder is named for what it is about"* (2026-09-14).

**It reaches the daemon and the bundle as ordinary dependencies, and that was true for one day only after Q-0126.** `@quorum/cli` declares `@quorum/server` and `@quorum/web` under **`dependencies`** and imports the first statically; the bundle is found by resolving `@quorum/web`'s one locator subpath, so a single expression answers `apps/web/dist/` in the workspace and `node_modules/@quorum/web/dist/` in a packed install. Between 2026-09-14 and 2026-09-15 the daemon was an **optional** edge reached through a dynamic import, because no tarball carried it and a required edge killed the packed install at `npm install`; Q-0124 packs it, so *absent* stopped being a case the command can meet, the refusal that named it is deleted rather than reworded, and what remains is a corrupt install — which every command should fail loudly on rather than one command report politely. See *"The distribution set is five, and rejoins the emitting set"* (2026-09-15), which supersedes *"An optional edge says the daemon may be absent, and never why"* (2026-09-14).

The bundle root is the one thing this command resolves from its own location, and it travels to `packages/server` as a **`URL`** rather than a path: no production module in `packages/cli` may import `node:url`, and `new URL(…).pathname` does not decode percent-encoding, so an installation under a path containing a space would be refused for a build that is present. `ServeOptions.bundle` therefore takes `string | URL` and the package that owns the confined root converts — which is `initProject(dir, templates)`'s shape at a second site, and the one part of Q-0125's export surface this ticket moves.

Since Q-0098 the package is **runnable**: `bin.quorum` names an emitted target one directory below the package root, so `path.join(here, '..')` from the binary's own file resolves to the package root and Q-0093's `init` reads the shipped templates from `<package>/templates/`. The depth is fixed by the ruling above rather than discovered, and the target carries a `#!/usr/bin/env node` shebang and an executable bit the build sets, both proven to survive a cache replay.

Since Q-0126 it dispatches nine commands as well as its help — `lint` and `validate` from Q-0091, `runs` from Q-0092, `init` and `ticket` from Q-0093, which are the first two that write, `run` from Q-0094, which is the one that executes, `board` and `adapters`, which are the two that can only exit 0, and `open`, which is the one that keeps running. The first eight are the whole of the spike's set and `open` is the first that was never in it, appended last because that header has no line to order it against; the frame lists every command it dispatches and dispatches every command it lists. Each is one module named after the command the frame registers, which is what lets `frame.source.test.ts` derive the frame/command split from `COMMANDS` rather than from a list: **a frame module may name none of `core`'s domain helpers, and a command module only the ones its own command needs.** The presentation is the CLI's and the walk is `core`'s, so a lint record reaching a terminal, a browser and a WebSocket carries an escape byte in exactly one of the three.

**Since Q-0105 `board` reports a second git fact**, and it is the first command in this package to acquire a new need after it shipped. `pushLag` answers where the configured base branch stands against the upstream it tracks — **push lag**, one repository-level fact derived on every invocation and stored nowhere, on containment's own terms — and it is `core`'s for the reason the rest are: a command module may not derive a git fact itself, and `packages/core/src/git/git.ts` is where every git call in `core` goes through one runner. It is the second name `git/` contributes to the barrel, and the whole of what `packages/cli` adds is one dim legend line, printed only when git had something to say. Nothing on this path reaches the network: there is no fetch, no `ls-remote` and no credential, which is what makes it a git fact rather than a CI one — see *"The board reports push lag, and never a CI conclusion"* (2026-09-06).

`board` and `adapters` were the first pair to need **nothing** added to `@quorum/core`'s public surface — `containment`, `lintFlowDirectory`, `getAdapter`, `probeAdapter` and `loadProject` were all already on it — which is what "the CLI is a presentation layer over an API that exists" looks like when it is true rather than asserted. The rule above is what shaped the board's two forced divergences from the spike: it reaches the flow set through `lintFlowDirectory` rather than reading the directory itself, and a missing `flows/` is a narrow `ENOENT` catch rather than an `fs.existsSync` guard, because a command module may import `node:path` and no production module in the package may import `node:fs`. The same rule is why the help line for `board` glosses containment rather than naming it: `commands.ts` is a frame module, and `containment` is a domain symbol.

`init` is where that division needed a new `core` symbol rather than a new export: the CLI may import no filesystem, process-spawning or terminal module at all, so the scaffolding — copy the template tree, create the backlog, refuse an occupied `harness/`, and aim `repo.base_branch` at the branch the checkout is on — is `packages/core/src/backlog/scaffold.ts`, beside the project reader M3's server will want it next to. What the command owns is one expression: the templates are `new URL('../templates/harness/', import.meta.url)`, relative to the module's own location and to nothing else, which answers `packages/cli/templates/harness` from `src/` under the workspace condition and from `dist/` under a plain `node`. `frame.source.test.ts` permits exactly one module to resolve its own location and no frame module to do it at all.

`runs` is where that division is sharpest, and it is why `@quorum/core`'s public surface grew by six names rather than by one: the selection, the ordering, the completeness test, the occurrence sequence, the token arithmetic and the confinement guard are all `core`'s, and what `packages/cli` adds is the markers, the colours, the two JSON shapes and four sentences. One of the six is new — a single-run read, because `readRunsDir` parses every sibling manifest and a detail request may not be coupled to the health and size of a store it did not ask about. It is one function taking a runs root and a token and answering a discriminated result, so confinement and the read cannot come apart at a call site.

### `packages/compiler`
The second headline feature. Reads `harness/rules.md`, `architecture.md`, `product-context.md`, `commands/*.md` and emits `CLAUDE.md` (with `@harness/...` imports), `AGENTS.md` and `GEMINI.md` (inlined where the vendor can't reference), plus a marked native pass-through section for `.claude/agents`, skills and commands. Drift detection: hash of sources vs generated header.

### `apps/web`
React + Vite, Tailwind, dark "ground control" theme from the design prompt. Screens: projects home, backlog board, ticket page, harness editor, flow editor (form + YAML preview), mission control (live traces, parallel columns, per-vendor cost tickers), gate screen, step chat, run history. State from the WebSocket stream; no client-side persistence beyond UI preferences.

**Since Q-0018 the History rail entry reaches a screen, and it is the one screen here over a
DIRECTORY rather than over a socket or a live run.** It reads `GET /history` once on mount, with
Refresh the only thing that repeats it, and renders one row per run in the daemon's own order —
`sortRuns` decides it and this screen declares no comparator, so an order it derived would be one it
invented. Seven of the eight columns `docs/05-design-prompt.md` §8 asks for are rendered; the eighth,
a per-vendor token total, is not in a listing row and appears when a row is opened, which the screen
discloses rather than approximating. **Opening one row reads that run's own `GET /history/:id`** and
shows its occurrences in `seq` order beside its per-vendor split — at most one row open, and
collapsing discards the read rather than holding it. **The brief's last sentence for that screen is
refuted rather than deferred.** *"Clicking opens the trace (reuse screen 5 in a 'completed' state)"*
cannot be done: events are not persisted, so a finished run has no event stream and every column,
lane and timeline on mission control is derived from accepted events; and the two identity schemes do
not meet, a handle being minted from a counter inside one daemon process while a history id is
`<ticket id>-<run number>` and names a directory — **171 directories on disk against zero handles in
a freshly started daemon**. So this screen composes no handle, links to no run, and says where a run
still going is watched in a sentence. **No vendor is known by name here**: a badge is the exact
`usage.vendor` string the roll-up carries, which is why the brief's colour-coded squares are not
rendered — a colour per vendor is exactly the knowledge the product-agnostic rule forbids. A vendor
that reported no price renders what it reported and never `$0.00`, no figure is summed across
vendors, and **status rendering is closed over `core`'s `RunStatus` rather than over this backlog**,
so the two statuses this repository has never produced render as surely as the six it has and one the
vocabulary does not hold is named rather than dropped. **An empty table is two opposite answers and
they are told apart**: a store nothing has written to is the adopter's first view and says what would
put a run in it, while a store whose every run the daemon could not read is the same `runs: []` with
the reasons beside it, and saying the first over the second reports the runs that ARE there as runs
that are not. **Since Q-0137 an opened occurrence names what it retained and one of those files
opens**: the names and sizes come from a second read the row issues beside its detail, a file's text
from a third a reader's own act issues, and nothing large is fetched until that reader has its size
in front of them. The two names this product writes are `prompt.txt` and `output.txt` and the
listing is the **directory's** contents rather than those two constants, `persist` taking an
artifact's name as a plain parameter — so a third file is named and opens with no code here moving.
**Three sentences say what is absent, and all three are keyed on the occurrence's `kind`**: a
prompt exists exactly where the kind is `adapter`, so a `prove-red` step whose kind is `integrate`
says no vendor was asked — keying that on the step id would be wrong about 12 of the 85 such
occurrences this repository holds — while a missing output is *this step has not finished* where it
is running and *no output file was retained* where it is over, which are two states and not one.

**Since Q-0130 this app drives a run's lifecycle, and the daemon has a producer at last.** `host.start` had exactly one production caller — `POST /runs` — and nothing issued it, so on a real machine the run registry was empty and stayed empty: three screens were built against runs a human had to create by hand with an HTTP client. The ticket page starts one and mission control stops one. **The start is on the ticket page and deliberately not on a board card**, which is measured rather than a preference: the board names the flows that consume a stage per COLUMN, so that naming is attached to no ticket and cannot be made actionable where it is, and a card is one anchor by design so a reader can middle-click it. **It names every flow that consumes the ticket's stage and never one** — `chore` and `solutioning` both consume `requirements`, and one button would take the most consequential routing choice in this product silently — with a flow the linter refused named and not offered, and the board's own two sentences for *no flow consumes this stage* and *the flow list could not be read* imported rather than re-worded, beside a third for a listing that is merely still out. **It sends `flow`, `ticket` and at most `dry`, never `auto` and never `base`**: *"Human-gated by default, auto opt-in per gate"* (2026-08-06) puts that choice in the flow file, so a browser checkbox for it is a second mechanism for one rule and would owe an entry this ticket did not take, and `base` needs a revision no route here can enumerate. **Both acts are confirmed, single, and at most one in flight**, under one guard in `src/run-lifecycle.ts` rather than two beside the screens — released by the request's own resolution and by nothing else, which is Q-0016's review blocker written once instead of being available to come back twice. **And a confirmation stands only as long as the premise it was offered under does**: a screen hands that premise to the hook — the run the daemon last reported, the flows it last listed — declares it once as a predicate beside the act, and withdraws nothing itself. One mechanism rather than a guard per screen, because the guard-per-screen shape is what this ticket's review loop priced: the same class four times across three surfaces, each round closing the instance it was handed and the next finding it on a sibling. A read still out and a read that failed are not premises that stopped holding, which is *"connection state … is not run state"* one layer over — **and they are that for their own input alone**. Each input a premise is built from is kept as the daemon's last ANSWER about it rather than re-derived from the last request for it, so a listing reporting the chosen flow gone still ends the offer while the ticket read is failing, and a stage that has moved still does while the listing read is; and the predicate over them is asymmetric, one conclusive lapse ending an offer whatever the other input is while *could not tell* alone never does. **Never allowed to stand in for the other's answer**, which is containment's discipline — a state meaning *could not tell* that is never reported as either of the other two — at a site inside a browser. **A start's success is a `201` carrying the run**, whose handle is minted inside the daemon and reaches a client there and nowhere else, so nothing composes one or recovers it from the listing; **a stop's is a `204`**, which says the cancellation was delivered and never that the run ended, and a `not-running` refusal is not proof that it completed either. The stop control is offered from the DAEMON's last answer and never from connection state, which *"is not run state"*. **The request shape is `@quorum/shared`'s** — `WIRE_START_FIELDS`, `WireStartRequest` and `wireStartRequestSchema` — and `packages/server` builds its accepted set from that tuple, so the five names exist once; the write register moved by exactly **one permission** with the permitted module set unchanged at two, and gained a second clause with a different subject, because after this ticket those needles can no longer tell *this app starts runs* from *this app lists runs*. *(Before that: **since Q-0015 five of those screens existed — the backlog board, the ticket page, the gate screen, the runs landing and mission control — and the gate screen was where this app stopped being read-only**.)* It is reached at `/runs/:handle/gate`, it reads `GET /runs/:id` on mount and when the reader asks again, and it holds no socket: a gate asked while it is open is not shown until the reader asks again, and what the run does next is shown by reading again rather than live, because rendering a run's event stream is mission control's subject. **Neither does the route it is drawn at**: the shell opens a live connection for a route the register gives a `:handle`, and this one is excluded there by name — a shell streaming a run behind a screen that is deliberately not live is the same socket by another door, and it would answer a second way about a handle the screen is already reporting on, a handle the host never minted being a 1008 close there and a route refusal here. What it renders is the question the engine asked — the kind as the word that was sent, the reason verbatim, the ticket folder, and the step a send-back returns to where the question carries one. **Since Q-0129 it renders the decision that reached the gate as well**, which this section said was not on this wire until that ticket put it there: the question carries `reached`, so the screen shows the deciding step's id, its verdict word, its summary and every entry it reported as *values* rather than parsing a sentence composed for a human — and where a gate follows a step that declared no verdict it names that condition, which is not a claim that nothing was wrong. Entries are grouped only by the register `@quorum/shared` declares, imported rather than re-spelled, and one carrying no severity this product declares is rendered whole in a place of its own: **150 of this repository's 1,080 are in that state**, so the mockup's severity headline would be a number that is wrong without saying so, and there is no cap, no paging and nothing behind a control because the largest such record here is 13 KB. What the step's change was *about* is **Q-0134**'s, needing a range no route on this transport carries and this workspace's first diff dependency. **It offers exactly the answers that gate will honour, which is two of them more often than three**: `retry` is offered only where the question carries a target, because `routing.ts` answers a `retry` at a gate that names none with `{ abort: true }` — measured at this ticket's gate, 148 of 220 engine-recorded answers in this repository's own history were at gates carrying none, so an unconditional third control would have ended the run at two thirds of them. There is no fourth control and no reason field. **Its own write is `POST /runs/:id/gate`, which was this app's only one until Q-0130 and is now one of three**: `apps/web/test/source.test.ts` still forbids every non-GET method in every file under `src`, permitting one method in `daemon-client.ts` and two path segments in `daemon-endpoints.ts` and nothing else, with the exemptions themselves shown to be doing work — and, since the needles alone can no longer tell a start from a read, an identity register of the three functions that issue a non-GET: `answerGate`, `startRun`, `stopRun`. Its success is a `204` with no body, recognised from the status before anything reads one, and two of its refusals share a `404` — so the code and never the status is what tells *that handle names no run* from *that gate is not waiting any more*, the second of which may claim neither that an earlier answer arrived nor that it failed. **A read withdraws no answer that is already on its way**: asking to see the run again does not release the one-answer-in-flight guard and does not clear the sentence saying an answer is out, because re-enabling the controls there would let a second answer race the first and an `abort` dispatched after an `advance` can arrive before it. **And what the daemon did with an answer outlives the read that follows it**: an accepted answer sends the screen straight back to reading, so the sentence naming the answer that was taken — and the one saying a gate is no longer waiting, which is the only thing standing between a reader and answering a third time — are rendered outside the branch that holds a loaded run, and survive a follow-up read that is still out or that failed. What each is *about* travels with it, so one run's answer is never rendered under another's. **Every state that is not *parked* names itself, the refused one included**: it renders the daemon's own condition and the remedy it composed, unaltered, and where the row carries neither — a start that had not resolved when it was read — it says that rather than composing a likely reason. *(Before that: **since Q-0017 one of those screens existed — the backlog board — and the shell was what the other eight sat in**.)* The board is this app's first request of any kind: `src/daemon-client.ts` is where every request it makes is made, `src/request-state.ts` is the closed set of answers one can have, and no member of that set is silence or a spinner. It never polls and holds no copy: `GET /tickets` walks the backlog and probes git per ticket, so the board loads on mount and when the reader asks again, and it shows *when* it loaded, because containment and push lag are derived per request and stored nowhere. **Every rule it renders by is `quorum board`'s, read from one register** — `@quorum/shared`'s `board.ts` holds which empty columns render, when a branch that does not exist is worth saying, how a containment answer is spelled, what `indeterminate` may not be read as, and the push-lag sentence that may warn and may never reassure, and `packages/cli/src/board.ts` imports the same five without one printed byte moving. The sixth, the cost legend, could not follow them: `@quorum/shared` may name no vendor in code, and that sentence names one by design, so it is declared on both surfaces and `packages/cli/src/board.test.ts` holds the two byte-identical. **Three things it deliberately does not do** are recorded where it does them: it renders no `1/3` counter, a denominator being a value no route on this transport carries; it labels its one cost figure neither per vendor nor cost to date, because it is neither; and it offers no control that starts a run, two flows consuming `requirements` and the choice between them being the most consequential routing decision in this product. The ticket page behind `/backlog/:ticketId` is **Q-0127**'s, and needs a route that answers for one ticket. *(Before that: **since Q-0014 the shell exists, and none of those screens did**.)* What shipped there is what every screen sits in: a left rail, a top bar, a dark palette, and client-side routing. The **route register** is the whole of it — `src/routes.ts` holds two tables, the rail's seven entries in the design prompt's own order and the twelve paths the shell recognises, and the router, the rail and every placeholder are built *from* them rather than beside them. A component may not name a route the register does not hold, which is what keeps four later tickets inheriting a URL shape instead of each inventing one; the M4 paths are declared there now for that reason. The eleven semantic colour tokens are declared in one file and referred to by name everywhere else, and **every request this app makes is same-origin and page-relative: no absolute URL, no third-party host, no font host** — a deliberate divergence from `05-design-prompt.md`'s "except Google Fonts", recorded in place, because that document describes a clickable mockup and a local-first tool that requires the internet to render is not local-first. That clause said *"nothing is fetched from a network"* until Q-0017, and it moved because the app started fetching: the board asks the daemon for the backlog on every load. What the scan behind it has always enforced is the property now stated, and `apps/web/test/source.test.ts`'s own describe title moved with this sentence — `packages/shared/src/docs.test.ts` holds the two against each other, because a claim enforced by a scan that cannot see it going false is one that goes quiet rather than red.

**`src/` is what a browser gets, and that is a checked property rather than a convention.** No file under it may import a `node:` specifier, a bare Node builtin or `@quorum/core`, so the checks that read the repository to enforce that — and the one that reads the manifest — sit in `test/` beside it rather than inside it, which is the arrangement `packages/shared/test/corpus.ts` already uses for the same reason one package down. Only tests needing nothing but a document stay under `src/`. The scan is over *every* file there, tests included: scoping it to what ships would exempt exactly the files most likely to reach for a filesystem.

**It asserts nothing it has not loaded.** Each top-bar data region reads one explicit not-loaded string, the primary control is disabled, and a route whose screen does not exist says which screen it is, which ticket builds it — or that none does, for the two rail entries with no ticket — and what it is waiting for, taking that sentence from the register rather than from the component. No placeholder is a blank panel, a spinner or a skeleton, and none shows a fabricated project, run, ticket or cost: a screen that looks like it is loading something that is never coming is reassurance standing in for an answer, which is what `quorum board` refuses when it declines to render a token git could not produce.

**Mission control renders that connection, and what it may not render is the half worth reading.** `/runs` lists what the daemon can back **in the order the daemon sent them, which it reverses so the last run started is first** — the screen re-sorts nothing, the handle being opaque, so an order it derived would be one it invented (AC-2) — and `/runs/:handle` draws one run: a trace column per exact `stepId`, a run-level lane for events that carry none — so an unattributed event is placed rather than dropped — and a timeline reporting only what was observed, including the third disposition for a step that started and whose end was never reported. **All four of the values `docs/05-design-prompt.md` screen 5 puts in the header are on the screen since Q-0135, and the two that moved last did so with no event gaining a field.** Elapsed time and the per-vendor cost split are read from `GET /history/:id` — the manifest `core` has been writing live all along, `writer.ts` recomputing `manifest.rollup` in full on every occurrence that terminates and replacing the manifest atomically — so what was missing was a read and not a producer, and `@quorum/shared` gains one **loose** schema over the subset the screen uses. **The two behave differently, and the difference is the design**: elapsed advances from `manifest.started_at`, a value the browser already holds, so it performs no read and engages *"Refresh is the only repeat read; no timer performs one"* not at all — the brief's word *ticker* does not survive that measurement and is used for neither — while cost ships as of the last read with the existing control. **Advancement stops on whichever authority speaks first**, the connection reporting the run ended or a read supplying `ended_at`, because the manifest read is a snapshot and a browser holding `status: 'running'` would otherwise advance past an end that has already happened; the frozen figure is `manifest.duration_ms`, which `finalise` computed from one clock reading, and never a subtraction performed here. **No figure is summed across vendors and no code branches on a vendor's name**, so a third adapter's row appears because the roll-up carries it — and a vendor that reported no price renders its token total and never a zero. **`WireRun` gains `dry`**, which is what makes the read safe to address: a walk writes no run history and is allocated a number the next real run of that ticket receives again, so an id composed without it names a different run's directory. The values render in a region of their own beside the identity line, because a cost figure and a clamped `00:00` both trip the assertion that proves that line fabricates nothing. The third, the run number, is on the wire since **Q-0131**: `runId` was `null` for a live run's whole life, and `core` now reports it to its caller **out of band at run start**, through an option on `runFlow` beside `answerGate`, so the daemon records it at the site it starts a run from and the header reads it from the same `GET /runs/:handle` that supplies the flow and the ticket id. **No event gained a field and the union is unchanged** — which is the whole reason the transport is a callback rather than a `start` member, the sentence above and its twin in `docs/GLOSSARY.md` being about *an event* and a callback not being one. *"A gate question carries the decision that reached it"* (2026-09-17) is the neighbouring ruling rather than the authority for this one: it puts a value on the stream because its producer already writes it there, and `nextRunId` writes to `runs.log` and the run directory and not to the stream at all. The browser keeps at most `RUN_EVENT_RETENTION`-many events — its own constant, matching the daemon's `DEFAULT_RETENTION` **by citation rather than by a shared symbol**, `apps/web` declaring no dependency on `@quorum/server` — so that so two readers of one run do not disagree about how much of it exists, and the two losses — the daemon's `missed` and the browser's own discard — are two counters with two sentences and are never merged. **Nothing started a run from here until Q-0130**, and that is where both lifecycle acts now are: a start on the ticket page and a stop on this screen, so the empty state a reader meets names where one is begun rather than saying this app cannot begin one — while the clause beside it stays untouched and true, `quorum run` calling `runFlow` in its own process, which this daemon cannot see. The stop is offered from the run the daemon last **reported** and never from connection state — and the last report is not the last request, a refresh in flight and a read that never answered being *no new report* rather than a report that the run is not running — and a delivered cancellation is not a run that ended.

**The run route holds one live connection to the daemon.** Its frame parser validates every envelope and event, its connection state gives every outcome explicit text in the top bar, and its controller owns at most one socket, closes it on replacement or departure, and reconnects only through an explicit retry, which resets the accepted tail and both loss counters exactly as a first connection does — the daemon replays its retained buffer to every new subscription, so keeping them would render each retained event twice and report a bounded-retention loss for events about to arrive (Q-0015 errata E-11, which inverts Q-0120's pin and records why). The frame union has one browser-safe definition in `@quorum/shared`; `packages/server` imports and re-exports it so the server and browser share that contract without either end declaring a dependency on the other. That clause used to give as its reason that the daemon package had no browser-facing export surface at all, which Q-0125 ended by giving it one: the arrangement is unchanged and what holds it is that `@quorum/shared` is the package a browser may import, not that the daemon publishes nothing. All connection data remains in memory. **The app emits, and what it emits is served rather than shipped** (Q-0122): it declares `rm -rf dist && vite build`, so it is one of five emitters, and `packages/server` serves that output at `GET /*`. **Since Q-0124 a tarball carries it too**, so the local distribution set is those same five: it declares `files`, a `license` and **one** `exports` entry — a single named locator whose target is the bundle's entry document, which is how `packages/cli` finds the built app by package name on a packed install and in the workspace with one expression. It declares no `"."`, no `main`, no `types` and no `bin`, because nothing imports a bundle as a module, and it keeps `private: true`: *distributed* here means a tarball this repository packs and installs, never publication. Its `react` and `react-dom` are `devDependencies` and not runtime ones, on the measurement that the emitted bundle carries no bare import specifier — what a bundle contains and what npm must install beside it select opposite sets for a self-contained bundle. See *"A fourth package emits, and what it emits is served rather than shipped"* (2026-09-12), *"The distribution set is five, and rejoins the emitting set"* (2026-09-15), and **Emitted artifact** in the glossary, which the first widened to cover a served bundle rather than coining a third kind. `eslint.config.js` gained `apps/**/*.tsx` in the same change as the shell: a flat-config `*.ts` tail does not match `.tsx`, so the three rules this workspace enforces reached no line of the app while `lint` reported green over it.

## Adapters

`Adapter` interface per `03-adapter-contract.md`. v1 ships `claude` and `codex`; `gemini` is the first community milestone and is designed as a copy-and-edit of `codex`. Adapter behaviour that is CLI-version-specific (flag names, JSONL fields) lives in a per-adapter `capabilities.ts` with a version probe, so a CLI update breaks one file. Q-0047 shipped the first half of that sentence and **Q-0067 the second**. Each module records one string beside the argv `check()` spawns — `verifiedVersion`, the CLI version that adapter's flags and vendor field names were last verified against — and `cliVersion`, at the contract layer, compares it with the version `check()` already returned. There is no second invocation: the probe always ran and what was missing was the comparison. The answer is a **verified version** state drawn from a closed set in `@quorum/shared`, rendered by `quorum adapters --probe` as at most one dim clause per vendor and by `--json` as two keys; the presence listing does not move, because `--probe` is the check and the listing is the report. It **refuses nothing**: no state changes an exit code, stops a run or selects a flag, and there is no supported range to be outside of — the recorded string is a past measurement, so it stands beside the login verdict as provenance rather than as a second verdict of its own. Nothing branches on it, which `packages/core/src/adapters/cli-version.test.ts` holds shut. See *"An adapter records the version it was verified against, and never a version it supports"* (2026-09-08).

## Testing strategy

- **There is one required suite, and it is the whole of what a green tick claims.** The `workspace`
  job runs Vitest over `packages/**` and `apps/**`: every module the port wrote, the frame and the
  eight commands `packages/cli` dispatches, and the mock end-to-end *through the binary*, which
  `packages/cli/src/end-to-end.test.ts` and `src/failure-paths.test.ts` carry. There were **two**
  required suites from Q-0008 until Q-0103, because the spike was the harness this repository was
  developed with while its own core was being written, and neither suite was a subset of the other.
  The cutover deleted that tree once `packages/cli` dispatched every command it had, and deleted
  `packages/core/src/spike-parity.test.ts` with it — the file-by-file record of which spike scenario
  the workspace suite carried, which transferred at Q-0010, and which was carried by nobody. That
  register's subject was the relationship between two suites, so it could not outlive one of them:
  see *"A check outlives its subject only if it can still fail"* (2026-09-05). Nothing replaces it,
  and nothing needs to — a parity register over one tree has no second side to compare against.
- **What makes a new failing test file fail `pnpm test`**, since Q-0054, link by link. The include
  is Vitest's own default (`vitest.shared.js`), so a `*.test.ts` written anywhere below a package is
  **collected** — until this ticket it was `src/**` only, and a red test written to
  `packages/core/test/`, to a package root, or as `*.test.js` was collected by nothing at all. Every
  package declares a `test` script, so turbo **runs** it rather than skipping the package in silence.
  `$TURBO_DEFAULT$` puts the new file in that package's `test` hash, so a cached pass **cannot stand
  over it**. And CI **forces** regardless. `packages/core/src/test-discovery.test.ts` holds the first
  two links; the third is `turbo-inputs.test.ts`'s and the fourth `test-command.test.ts`'s. This is
  a property the spike's own runner had by discovering its directory, brought over to the workspace
  before that tree was deleted, and the reason it matters is qa-red: a red phase is proved by writing
  a new failing file, and a runner blind to it reports green while `integrate --expect fail` loops to
  a gate having proved nothing.
- CI's `workspace` job runs `lint`, `typecheck` and `test` over the whole workspace **forced** — `pnpm turbo run <task> --force` — so a green tick means those three tasks were executed against that commit rather than served from a cached conclusion. The two caches in play are not the same thing and only one of them can make a tick a lie: `actions/setup-node`'s `cache: pnpm` replays a *download* and stays; no turbo result cache is restored, because that would replay a *verdict*. `integrate` reaches the same property by an independent route, since it runs `harness/harness.yaml`'s `commands.test` rather than `package.json`'s and that command carries its own `--force` (Q-0065). A developer's local `pnpm test` is unforced and keeps its cache, which is where a cache earns its keep.
- **What a cache hit claims, since Q-0072.** A hit means *no file this task reads, and no same-kind task in a package it depends on, has changed since the cached result*. Before Q-0072 it meant only *nothing inside this package has changed*, which was a materially weaker thing to believe: turbo's default input set is package-scoped, while the suite asserts over `docs/`, `harness/`, `contracts/`, `backlog/`, `.github/` and each package from another. `packages/core/turbo.json` and `packages/shared/turbo.json` declare those out-of-package reads as `inputs` beside `$TURBO_DEFAULT$`, and the root `test`, `lint` and `typecheck` tasks each depend on their own kind in a package's dependencies (`^test`, `^lint`, `^typecheck`), so a change in `shared` invalidates all three of `core`'s. `packages/core/src/turbo-inputs.test.ts` is what fails when a read stops being covered. **CI's claim is different and stronger:** it forces, so its tick says these tasks *executed* against this commit, which no hit can say however well its inputs are declared.
- **What a cache hit *gives back*, since Q-0097.** The three tasks above declare `"outputs": []`, so
  a hit on any of them replays a **verdict** — a claim that work once passed. `build` is the first
  task in this workspace whose hit replays an **artifact**, and an artifact something downstream
  executes fails differently: the stale tick lies about the past, the stale artifact lies about the
  present. It is declared once, at the root, with `dependsOn: ["^build"]` so one invocation from a
  clean checkout produces prerequisites before consumers, and its `outputs` is `dist/**` — the only
  non-empty `outputs` in the workspace. **Five packages emit and five are packed**, which since
  2026-09-15 are the same set again: `@quorum/shared`, `@quorum/core`, `@quorum/cli` and — since
  Q-0125 — `@quorum/server` each declare
  a `build` script driven by a per-package `tsconfig.build.json`, which adds `outDir`, `rootDir` and
  `declaration` and excludes test files, so the `tsconfig.json` that `lint` and `typecheck` read —
  and that ESLint's `projectService` needs a project from — is untouched; `@quorum/web` is the
  fifth and declares `vite build`, whose output is **served** rather than resolved and which a
  tarball carries since Q-0124. **What emits and what ships stay two facts asked of two registers,
  and they coincide today rather than having been merged**: `@quorum/web` is *served*, the other
  four are *resolved*, and that distinction is about shape rather than membership — which is
  what separated the two axes for good, and what makes a sixth emitter parting the sets again cheap
  to describe. Each script removes its own emit directory before compiling,
  because turbo prunes an
  output directory on neither the miss path nor the hit path, so a file whose source has gone would
  otherwise survive both — measured, and for the four `tsc` emitters that is the whole mechanism, while Vite
  empties its own output directory and the clean step there is uniformity rather than the thing that
  works. **No verdict that exists today moves behind it:** `test` and `typecheck` gain no `^build`
  edge, the workspace suites go on resolving TypeScript source through the `quorum-source` export
  condition, and the emit is consumed by a plain `node` process, by a packed install, by
  Q-0095's end-to-end suite, and — for `@quorum/web` — by a browser over the daemon's static route.
  `@quorum/server`'s **has a consumer since Q-0126**, which is what it was built for: `quorum open`
  resolves it to a file rather than to `ERR_MODULE_NOT_FOUND`. The second clause of that sentence is
  therefore still true and the first is not, and it is a **conditional** consumer — the edge is
  optional and the specifier is deferred, so an installation that carries no daemon loads no part of
  this emit and every other command is unaffected.
  `packages/cli/src/build.test.ts` proves the declaration covers exactly
  what the build writes, in both directions, and that a replayed build restores something that runs;
  `src/build-fixture.test.ts` proves the leftover rules in a workspace it builds itself. See *"The
  emit serves the binary, and no test verdict moves behind it"* (2026-09-02) and *"A fourth package
  emits, and what it emits is served rather than shipped"* (2026-09-12).
- **What a green tick does not claim, since Q-0079.** Both suites run on a machine whose git can
  resolve an identity, so a test that depends on the *account* it runs as is green everywhere it is
  looked at. Three merged changes did exactly that — the two directories a working checkout has and
  a fresh clone does not (Q-0072), `fs.existsSync` used to classify (Q-0073), and `git merge
  --no-ff` resolving a committer identity (Q-0051's merge, which turned CI red). The rule is *A
  test's verdict is a property of the commit, not of the checkout or the account* (2026-08-30), and
  it has two enforcers with different reach. The **oracle** is
  `.github/scripts/git-identity-sweep.sh`: it runs the workspace suite with no resolvable identity,
  in a
  bare checkout and again in one carrying `.harness/worktrees` and `.quorum/runs`, and it proves its
  own environment discriminates before trusting it — a permissive sweep is green over everything.
  `pnpm sweep:git-identity` is byte-identically what CI runs. It ran a second suite too until
  Q-0107 AC-16, which removed that phase with the last workspace read of the spike tree; Q-0103 then
  deleted the tree, that suite and the CI job that ran it, so the sweep covers all of what a green
  tick claims again rather than part of it. The **tripwire** is
  `packages/core/src/git-identity.test.ts`, inside the ordinary suite and therefore visible at
  `integrate`, which sees literals only and is not coverage for the checkout-shaped instances; its
  corpus is `packages/` and `apps/` since Q-0107 AC-15, the spike row having lost its subject. The
  measured table of what does and does not discriminate — including the two environments that look
  hostile and are not — is in the sweep script's header, because that is where the next person
  editing it will look.
- Adapters: a nightly "real CLI" job is **not** feasible in CI (subscription auth); instead a `quorum adapters --probe` command runs the four contract checks locally and writes `.quorum/adapter-probe.json`; contributors attach it to PRs that touch adapters.
- `web`: Playwright against the daemon with the mock adapter.
- Quorum develops itself with itself from M2: every feature ticket goes through the backlog and the flows.

## Run history on disk

`core` persists every non-dry run beneath `.quorum/runs/<ticket-id>-<n>/`. Its atomically
replaced `manifest.json` is the source of truth for lifecycle, adapter/script/integrate
occurrences, vendor-neutral usage, errors, and per-vendor roll-ups. Adapter occurrences retain
their exact `prompt.txt` and final or raw-invalid `output.txt`; script and integrate occurrences
retain `output.txt`. Gates and fan-out parents do not allocate occurrences. There is no persisted
event stream in this version, and incomplete `running` manifests are reported rather than repaired.

The **run lock** is the second thing `core` writes under `.quorum/`, and it is not run history:
one file per ticket at `.quorum/locks/<ticket-id>.json`, created by the same exclusive-create
primitive one directory up, held for exactly as long as a run lasts, and removed by the `finally`
that covers every way out of that run. It is a sibling of the runs root rather than a child of it,
so nothing a lock writes is visible to a reader listing runs. Its code lives in the run-history
writer because that file is `core`'s single owner of writes under this namespace, which is a
statement about who may write there rather than about what a lock is.

## Non-goals for v1 (so nobody builds them by accident)

Multi-user, remote daemon, cloud sync, any API-key path, a plugin marketplace, visual node canvas, eval suites, Windows support beyond WSL.
