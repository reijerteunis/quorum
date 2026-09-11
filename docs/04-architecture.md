# Quorum — Technical Architecture (v1)

*Status: proposed 2026-08-22; scaffold created 2026-08-24 (Q-0008) — the pnpm + Turborepo workspace, the single strict `tsconfig.base.json`, Vitest, ESLint and CI now exist, and the seven package boundaries drawn below are real directories, empty on purpose until Q-0009 ports the spike into them. 2026-08-25 docs review: worktrees are under `.harness/worktrees/`, and budget caps are specified rather than enforced. 2026-08-25 (Q-0009): `packages/core` states that it imports `shared`'s zod schemas rather than declaring its own, settling a contradiction with the development plan, and the `core` → `shared` dependency direction is written down. 2026-08-25 (Q-0041): `shared` is populated — zod schemas for flow, ticket, role and step output, the trace/event union and the cross-package constants — and principle 2 is corrected to the events that exist rather than the six it had named since it was written. 2026-08-26 (Q-0064): `core/src` is organised into one folder per module and `shared` stays flat, with the asymmetry explained. 2026-08-27 (Q-0047): the per-adapter `capabilities.ts` exists, and the version probe the same sentence asks for is recorded as deferred to Q-0067 so nobody reads it as shipped. 2026-08-27 (Q-0071): the testing strategy says what CI's `workspace` job executes and that it is forced, and separates the pnpm download cache from a task-result cache. 2026-08-28 (Q-0072): the testing strategy says what a *cache hit* claims, now that each suite's out-of-package reads are declared and `core`'s checks depend on `shared`'s. 2026-08-30 (Q-0079): the testing strategy names what a green tick does *not* claim — no suite ran where git resolves no identity until the sweep — and points at the oracle, the tripwire and the measured table separating them. 2026-08-31 (Q-0054): the testing strategy states that two required suites exist until the cutover and what each proves — the parenthesis calling the mock end-to-end "the 30-check smoke test, ported" described a port that had not happened, and its half of the suite transfers at Q-0010 — and adds the four-link chain from a new failing file to a red `pnpm test`. Changes go through DECISIONS.md. 2026-08-31 (Q-0062): principle 6 states the worktree lifecycle — a finished run gives back the worktrees it obtained, a run that did not finish keeps them, a worktree that is not clean is kept and says so, and no ref is ever deleted; and the testing strategy's entangled share is 49% rather than 53%, re-derived by `spike-parity.test.ts` after that ticket added a library-only test file, with the earlier figure kept beside it so the movement is visible rather than silent. 2026-09-01 (Q-0040): the entangled share is 55% rather than the 50% Q-0037 left, because that ticket's `q0040-undecided.js` is entangled in full — two of the five gate sites it covers live in `bin/` and no library test can reach them — and the sentence had gone three review rounds carrying a figure the guard beside it had already moved. 2026-09-02 (Q-0097): the testing strategy gains what a cache hit *gives back*, now that a `build` task with the workspace's first non-empty `outputs` replays an artifact rather than a verdict, and the `packages/core` entry says the emit is described there and not twice. 2026-09-02 (Q-0098): the shape paragraph separates the three installation claims — the workspace-local path and the locally packed path are supported and tested, and registry-resolved `npx quorum` is refused rather than deferred until Q-0029 — `packages/server`'s *"serves the built `apps/web`"* is scoped to M3 rather than left reading as present tense, and `packages/cli` records that the binary exists and what fixes its depth. 2026-09-03 (Q-0091): `packages/cli` records that the binary dispatches its first two commands, one module each, and the rule that separates a frame module from a command module. 2026-09-03 (Q-0092): that count is three, and `packages/cli` gains a paragraph on where the run-history division falls — six names moved onto `core`'s public surface, of which one is a new single-run read, because a detail request may not be coupled to the health of siblings it did not ask about. 2026-09-04 (Q-0093): that count is five, and the package map's `templates/` line is corrected — it described `packages/templates` as the shipped templates' home while line 66 and decision 078(e) put them under `packages/cli`, so two sentences of this document disagreed; `packages/templates` is a three-file scaffold holding no assets, and `packages/cli` gains a paragraph on where `init`'s division falls, which is the first place a command needed a new `core` symbol rather than a new export. 2026-09-04 (Q-0094): that count is six, which is the whole of this document's change — the sentence named five and `run` is the sixth, so it was false the moment that command landed; no paragraph was added for it, because Q-0094's requirement records that no numbered document claims anything it changes and this one sentence is the exception rather than an invitation. 2026-09-04 (Q-0099): that count is eight and the set is complete, and `packages/cli` gains a paragraph on the pair — the first to need nothing added to `core`'s public surface, and the pair whose two forced divergences from the spike are consequences of the frame/command rule rather than choices. 2026-09-05 (Q-0107): the testing strategy's sweep paragraph says the oracle runs the **workspace** suite rather than both, because AC-16 removed the spike phase with the last workspace read of that tree — CI's own `spike` job still runs it until Q-0103 — and the tripwire's corpus is named as `packages/` and `apps/`, the spike row having lost its subject. One sentence, and it is here rather than left for the cutover because a document describing an enforcer as covering more than it does is the failure this ticket is about. **2026-09-06 (Q-0103): the cutover.** The testing strategy describes **one** required suite rather than two — the spike tree, its CI job and `packages/core/src/spike-parity.test.ts` are deleted — and with them go the transfer share, which was a measurement of how much of a suite that no longer exists still had to move, and the sentence promising that register would record it. Three paragraphs that named the second suite as a live thing are corrected in the same edit: the discovery chain, which cites the spike runner as the origin of a property the workspace now owns; the cache-hit paragraph, which said *"both real suites"*; and the sweep paragraph, which said CI still ran the second one. The run-history section says `core` where it said the spike. What is NOT rewritten is provenance — `packages/core` is still *"seeded from the spike"* and `packages/cli` still dispatches *"the whole of the spike's set"*, because those sentences are about where the code came from and stay true of a tree that has gone. **2026-09-06 (Q-0105): `packages/cli` records the second git fact `board` derives** — push lag, the base branch against its upstream — and that it is the first command here to need a `core` symbol *after* it shipped, which the sentence above it had described as a pair needing nothing. That sentence moves to the past tense rather than being deleted: it was true of Q-0099 and stays true of Q-0099. **2026-09-08 (Q-0059): principle 6 states the backlog store's boundary** — a ticket token resolves inside the backlog root and every read and write happens inside a ticket folder, enforced in `core` — and the glossary gains **Confinement** as its own term, stated so it can never be read as a synonym for **Containment**, which is a git fact about two refs. One sentence and one term; the rule it describes is new, the vocabulary it uses was already in this document and in the development plan. That sentence was corrected in the run-2 review round, which found the guard checking the directory a path is enumerated in and not the leaf: it named the four methods it is true of rather than "reads and writes", and states the one read outside the guarantee, because a numbered document claiming more than the code does is the failure this repository has recorded most often. **2026-09-08 (Q-0067): §Adapters describes the version report that shipped rather than a deferral** — the sentence promising `capabilities.ts` *"with a version probe"* has had both halves since 2026-08-27 and only one of them was built, which this document recorded as deferred so nobody read it as shipped. What replaces that record is what exists: one recorded string per module, one comparison at the contract layer, no second invocation, and a report that refuses nothing. The glossary gains **Verified version**, stated so it can never be read as a supported range or as a second compatibility verdict beside the `verified` a `--probe` login reports. **2026-09-09 (Q-0039): principle 6 states that a ticket has one run at a time** — the lock a run takes before the branch head, the run directory and the worktree it would otherwise share, given back in a `finally` covering every exit, refusing rather than waiting and never reclaiming a stale one — and §Run history on disk names the second thing `core` writes under `.quorum/`, which is a sibling of the runs root and is not run history. The glossary gains **Run lock**, stated so it can never be read as a **gate**, as **Confinement**, or as a guarantee against anything but this product's own runs. **2026-09-11 (Q-0013): §`packages/server` describes the run host that shipped rather than the app that was proposed in August** — what exists is a library with no socket, no signal handler and no external dependency, and the Hono transport is named as Q-0118's and the read-only REST surface as Q-0119's. It states the three things a later child would otherwise re-decide: that a run is named by an id the **host** mints, with `core`'s run number correlated onto it when the terminal event arrives and reported as absent on a refusal, because neither pre-stream refusal has one to give; that the fan-out belongs to the host because the stream is single-consumer, with retention a bounded count and an incomplete replay named beside the stream rather than inside the closed event union; and that a gate answer is validated here before `core` sees it. **A fourth was added in the run-2 review round rather than by the requirement**: shutting down closes the host to new starts, because a start in flight is not yet a running run and a snapshot taken without waiting for one leaves a run holding a lock that nothing would release. **One clause of the route list is refused by the code and is recorded rather than dropped**: `POST /runs/:id/gate` read *"(advance/retry/override with reason)"* while `gateAnswerEnvelopeSchema` is `.strict()` over three, so the document was wrong and is corrected — widening the envelope is Q-0016's to ask for with an entry of its own, and `06-development-plan.md`'s M3 gate-screen line carries the same promise and is the human's. **No glossary term was added and none is owed**: the host's id is described rather than coined, because minting a term means `CLAUDE.md`'s term list, which Q-0103 erratum E-2 makes the human's to write. **2026-09-11 (Q-0014): §`apps/web` describes the shell that shipped rather than the nine screens that were proposed in August** — a route register the router, the rail and every placeholder are built from, a palette declared once, a top bar that reads an explicit not-loaded string per region rather than inferring a project, a branch or a login, and placeholders that name the ticket that builds them or say that none does. Three things are named as absent rather than left to be assumed: the live connection is Q-0120's and the top bar reserves the region it fills; the app declares no `build` script, so the emitting set is still three and the build task, the static route and the ruling on whether a served bundle is an **emitted artifact** are Q-0122's — which is what this section's own sentence about serving "the built `apps/web`" has been waiting for since 2026-08-22; and the deliberate divergence from `05-design-prompt.md`'s "except Google Fonts" is recorded in place, a local-first tool that needs the internet to render a page not being one. **A fourth was added in the run-2 review round rather than by the requirement**: `src/` is browser-only as a *checked* property over every file in it, so the four suites that read the repository sit in `test/` beside it rather than inside it — a scan scoped to what ships would have exempted exactly the files likeliest to reach for a filesystem, which is what it had done. **No glossary term is added and none is owed**: the artifact question is the one term this work could have coined, and it is ruled with the build task rather than inside a shell. Principle 2 was rewritten 2026-08-29 (Q-0050): `runFlow` is a lazy, single-consumer `AsyncIterable<Event>` whose cancellation belongs to the caller's `AbortSignal`, and the public-API line names it — see *What a run's event stream carries, and how a gate answer travels back* (2026-08-28) and its 2026-08-29 erratum.*

## Shape

A pnpm + Turborepo monorepo, TypeScript strict everywhere, Node ≥ 22. One command starts a local
daemon and opens the browser UI; the same daemon serves the CLI. **Three claims are kept apart
here, because only two of them are true today.** The **workspace-local** path is supported and
tested: `pnpm install && pnpm turbo run build`, then `pnpm exec quorum` from the repository root.
The **locally packed** path is supported and tested: `pnpm pack` in each of the three emitting
packages and an install of the three tarballs together into a project outside the repository.
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
    core/           engine, backlog, lint, contracts, git/worktrees, adapters, fanout, run-history
      src/          one folder per module, named as Q-0009's children are (Q-0064):
                      adapters/ backlog/ contracts/ engine/ fanout/ git/ lint/ run-history/
                    index.ts stays at src/ root; tests are colocated with the code they test
    server/         the run host that starts, streams, gates and stops runs (Q-0013); the
                    Hono HTTP + WebSocket daemon over it is Q-0118's and does not exist
    cli/            `quorum` binary: init · ticket · board · run · lint · adapters · open
    compiler/       canonical harness/ → CLAUDE.md / AGENTS.md / GEMINI.md (thin, linked)
    templates/      a three-file scaffold that holds no assets and has no build task: the
                    shipped harness/ (flows, roles, context files) lives in cli/templates/,
                    where `quorum init` reads it and where the CLI tarball ships it (Q-0093)
    shared/         types, schemas (zod), event/trace format, constants  ← declarations only
                    deliberately flat: ten leaf modules, and index.test.ts pins index.ts to
                    `export * from './<name>.js';` lines, which a folder path cannot satisfy
  docs/             these documents
  harness/          Quorum's own harness — it is developed with itself from M2 onwards
  backlog/          Quorum's own backlog (files in git, like every other project)
```

## Principles that shape the code

1. **`core` has no I/O it doesn't own.** It spawns CLIs, reads/writes the project folder and git. It never touches the network, never stores secrets, never reads API keys. Everything else is a thin shell around it.
2. **One trace format.** Every adapter maps its CLI's output to `shared`'s event schema, and nothing above the adapter layer branches on which vendor produced an event. Two shapes, because two interfaces exist. An **adapter** emits `spawn` and `stdout` and knows nothing about the run around it; the contract layer's retry wrapper adds `retry`. A **run** emits those three with the step id the engine supplies, plus `step`, `done`, `info`, `warn`, the correlated gate question and one final `terminal` event. Vendor identity survives as one neutral, open `vendor` label — per-vendor cost roll-ups require it and a blended number is forbidden — but no field is one a single vendor could populate. `tool` and `text` are named nowhere in this list on purpose: they were documented here before anything emitted them, and they arrive when an adapter normalises vendor JSONL into them (Q-0041, 2026-08-25). `runFlow` exposes a lazy, single-consumer `AsyncIterable<Event>` over a lossless FIFO: order is stable within one step, while parallel members have no global ordering or interleaving promise. A gate is emitted before the out-of-band `answerGate` callback is invoked. Cancellation belongs to the caller through an `AbortSignal`; core installs no process signal handler. Events deliberately carry no timestamp or sequence number, and only the terminal event carries run identity. The UI, the CLI and run history all consume the same stream; nothing persists it in v1. These boundaries follow *What a run's event stream carries, and how a gate answer travels back* (2026-08-28) and its 2026-08-29 erratum.
3. **Files are the database.** Tickets, flows, roles, run logs and traces live in the project folder (`backlog/`, `harness/`, `.quorum/runs/`). The daemon keeps an in-memory index and rebuilds it from disk on start. No SQLite in v1.
4. **The daemon is stateless across restarts.** A run that was interrupted is resumable from its last completed step because every step's result is on disk.
5. **UI is a view, never the source of truth.** Editing a flow in the UI writes the YAML file; the form is generated from the flow schema in `shared`.
6. **Safety by construction.** Worktrees under `.harness/worktrees/` (git-excluded), integration branch per ticket, human-locked gates — enforced in `core`, not in the UI. Budget caps are specified in `harness.yaml` but not yet enforced anywhere. **A worktree is not permanent.** A run that finished — `completed` or `regressed` — removes the worktrees it obtained, keeping any that is not clean and naming the paths that kept it; a run that did not finish keeps every one of them, because the directory it stopped in is the thing a maintainer is about to open. It is the same predicate the ticket-branch rollback reads, the other way round. **No ref is ever deleted** — not a task branch, not a step branch, not the integration branch — so a removed directory is always re-creatable from its branch, and a review after the run still has something to read. Cleanup is registration and never enumeration: a run removes what it obtained and nothing else, whoever created it. See *"A run removes the worktrees it made, and never the refs"* (2026-08-31). **The backlog store resolves a ticket token to a directory inside its own root, and `write`, `writeFile`, `readFiles` and `log` work only inside a ticket folder** — both sides resolved and file by file, so a symlink at a folder *or at a leaf* carries neither a write nor a globbed read out of it, and the refusal is `core`'s rather than a surface's, which is what M3's server inherits when it takes a ticket id from a request body. One read sits outside that guarantee deliberately: `read` and `list` open a ticket's own `ticket.md` unchecked, so a link planted at that name is still listed and still read, while the store refuses to write back through it — which is the half that keeps bytes inside the root (Q-0059; **Confinement** in the glossary, which is not **Containment**). **A ticket has one run at a time.** A run takes a **run lock** on its ticket before it reads the branch head, allocates a run directory or obtains a worktree — the three things two concurrent runs collide on — and gives it back in a `finally` that covers every exit; a second run refuses and names the holder rather than waiting, and a lock whose holder is gone still refuses rather than being reclaimed. Enforced in `core` for the reason confinement is: M3's server starts a run over HTTP and inherits this refusal instead of writing a weaker one. See *"A run holds a lock on its ticket, and a stale one refuses rather than being reclaimed"* (2026-09-09).

## Packages in detail

### `packages/core`
Seeded from the spike (`engine`, `backlog`, `fanout`, `git`, `adapters/*`), converted to TypeScript and validated against the zod schemas for flows, tickets, roles and step outputs that `shared` defines — `core` imports them and declares none of its own. Public API: `loadProject(dir)`, `runFlow(opts): AsyncIterable<Event>`, `lintFlow`, `Backlog`, `Adapter` interface. The mock adapter stays in the package for tests and demos.

Laid out as one folder per module (`adapters/`, `backlog/`, `contracts/`, `engine/`, `fanout/`, `git/`, `lint/`, `run-history/`), the names Q-0009's fourteen children already carry, with `index.ts` at `src/` root and tests colocated. `shared` stays flat, for the reason given above. See the 2026-08-26 DECISIONS entry.

Since Q-0096 the package publishes that API through a conditional `exports` map, and since Q-0097 it emits the artifact the map's default condition names. What the emit is and what a cache hit on it gives back is described once, under **Testing strategy** — deliberately not restated here, because a transcription of configuration drifts silently while going on looking like the thing it describes.

**The dependency direction is one-way: `core` → `shared`, never the reverse.** `shared` depends on no other workspace package, and nothing in it may import from `core`, `cli`, `server`, `compiler`, `templates` or `apps/web`. No cycle between workspace packages is permitted.

### `packages/server`

**Since Q-0118 this package is the daemon.** `serve()` opens a socket on `127.0.0.1` and nothing
else — not configurable, because there is no authentication of any kind and the process starts agent
runs and writes to a git repository, so a non-loopback bind puts that on a network. This document
said *"localhost-only by default"* from 2026-08-22; the *by default* is gone, a flag whose only use
is to make the product unsafe not being a feature.

**Three routes and one socket, over the host below.** `POST /runs` starts, `POST /runs/:id/gate`
answers, `POST /runs/:id/stop` stops, and `GET /runs/:id/events` upgrades to a WebSocket carrying one
event per message as JSON. `:id` is the host's handle. **The transport owns no run state**: every
route turns a request into one host call and one status, and the statuses are a table rather than a
decision per route — a lock refusal is **409** and a missing ticket **404**, because a client that
cannot tell them apart cannot tell *try again shortly* from *you asked for something that is not
there*.

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
It declares `@quorum/core` and `@quorum/shared` and no external dependency, and it emits nothing:
the local distribution set is three packages.

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

**What the transport still owes**, as this document has named it since 2026-08-22: a Hono app
exposing `POST /runs` (start), `POST /runs/:id/gate`, `POST /runs/:id/stop`, REST for
project/backlog/flows/history, and a WebSocket for live run events and gate prompts. Single-user,
localhost-only by default. It will serve `apps/web`'s build output — that app has no build task and
emits nothing today, so *"the built `apps/web`"* is what M3 will serve rather than something that
exists; the three packages that emit are named under **Testing strategy**. The transport is Q-0118's
and the read-only REST surface over project, backlog, flows and run history is Q-0119's.

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
Same commands as the spike plus `quorum open` (start daemon + open browser), `quorum compile` (harness → vendor files), `quorum history`. Gates in the CLI are terminal prompts; gates in the UI are the gate screen; both call the same `core` API.

Since Q-0098 the package is **runnable**: `bin.quorum` names an emitted target one directory below the package root, so `path.join(here, '..')` from the binary's own file resolves to the package root and Q-0093's `init` reads the shipped templates from `<package>/templates/`. The depth is fixed by the ruling above rather than discovered, and the target carries a `#!/usr/bin/env node` shebang and an executable bit the build sets, both proven to survive a cache replay.

Since Q-0099 it dispatches eight commands as well as its help — `lint` and `validate` from Q-0091, `runs` from Q-0092, `init` and `ticket` from Q-0093, which are the first two that write, `run` from Q-0094, which is the one that executes, and `board` and `adapters`, which are the two that can only exit 0. That is the whole of the spike's set, so the frame now lists every command it dispatches and dispatches every command it lists. Each is one module named after the command the frame registers, which is what lets `frame.source.test.ts` derive the frame/command split from `COMMANDS` rather than from a list: **a frame module may name none of `core`'s domain helpers, and a command module only the ones its own command needs.** The presentation is the CLI's and the walk is `core`'s, so a lint record reaching a terminal, a browser and a WebSocket carries an escape byte in exactly one of the three.

**Since Q-0105 `board` reports a second git fact**, and it is the first command in this package to acquire a new need after it shipped. `pushLag` answers where the configured base branch stands against the upstream it tracks — **push lag**, one repository-level fact derived on every invocation and stored nowhere, on containment's own terms — and it is `core`'s for the reason the rest are: a command module may not derive a git fact itself, and `packages/core/src/git/git.ts` is where every git call in `core` goes through one runner. It is the second name `git/` contributes to the barrel, and the whole of what `packages/cli` adds is one dim legend line, printed only when git had something to say. Nothing on this path reaches the network: there is no fetch, no `ls-remote` and no credential, which is what makes it a git fact rather than a CI one — see *"The board reports push lag, and never a CI conclusion"* (2026-09-06).

`board` and `adapters` were the first pair to need **nothing** added to `@quorum/core`'s public surface — `containment`, `lintFlowDirectory`, `getAdapter`, `probeAdapter` and `loadProject` were all already on it — which is what "the CLI is a presentation layer over an API that exists" looks like when it is true rather than asserted. The rule above is what shaped the board's two forced divergences from the spike: it reaches the flow set through `lintFlowDirectory` rather than reading the directory itself, and a missing `flows/` is a narrow `ENOENT` catch rather than an `fs.existsSync` guard, because a command module may import `node:path` and no production module in the package may import `node:fs`. The same rule is why the help line for `board` glosses containment rather than naming it: `commands.ts` is a frame module, and `containment` is a domain symbol.

`init` is where that division needed a new `core` symbol rather than a new export: the CLI may import no filesystem, process-spawning or terminal module at all, so the scaffolding — copy the template tree, create the backlog, refuse an occupied `harness/`, and aim `repo.base_branch` at the branch the checkout is on — is `packages/core/src/backlog/scaffold.ts`, beside the project reader M3's server will want it next to. What the command owns is one expression: the templates are `new URL('../templates/harness/', import.meta.url)`, relative to the module's own location and to nothing else, which answers `packages/cli/templates/harness` from `src/` under the workspace condition and from `dist/` under a plain `node`. `frame.source.test.ts` permits exactly one module to resolve its own location and no frame module to do it at all.

`runs` is where that division is sharpest, and it is why `@quorum/core`'s public surface grew by six names rather than by one: the selection, the ordering, the completeness test, the occurrence sequence, the token arithmetic and the confinement guard are all `core`'s, and what `packages/cli` adds is the markers, the colours, the two JSON shapes and four sentences. One of the six is new — a single-run read, because `readRunsDir` parses every sibling manifest and a detail request may not be coupled to the health and size of a store it did not ask about. It is one function taking a runs root and a token and answering a discriminated result, so confinement and the read cannot come apart at a call site.

### `packages/compiler`
The second headline feature. Reads `harness/rules.md`, `architecture.md`, `product-context.md`, `commands/*.md` and emits `CLAUDE.md` (with `@harness/...` imports), `AGENTS.md` and `GEMINI.md` (inlined where the vendor can't reference), plus a marked native pass-through section for `.claude/agents`, skills and commands. Drift detection: hash of sources vs generated header.

### `apps/web`
React + Vite, Tailwind, dark "ground control" theme from the design prompt. Screens: projects home, backlog board, ticket page, harness editor, flow editor (form + YAML preview), mission control (live traces, parallel columns, per-vendor cost tickers), gate screen, step chat, run history. State from the WebSocket stream; no client-side persistence beyond UI preferences.

**Since Q-0014 the shell exists, and none of those screens does.** What shipped is what every screen sits in: a left rail, a top bar, a dark palette, and client-side routing. The **route register** is the whole of it — `src/routes.ts` holds two tables, the rail's seven entries in the design prompt's own order and the twelve paths the shell recognises, and the router, the rail and every placeholder are built *from* them rather than beside them. A component may not name a route the register does not hold, which is what keeps four later tickets inheriting a URL shape instead of each inventing one; the M4 paths are declared there now for that reason. The eleven semantic colour tokens are declared in one file and referred to by name everywhere else, and **nothing is fetched from a network** — a deliberate divergence from `05-design-prompt.md`'s "except Google Fonts", recorded in place, because that document describes a clickable mockup and a local-first tool that requires the internet to render is not local-first.

**`src/` is what a browser gets, and that is a checked property rather than a convention.** No file under it may import a `node:` specifier, a bare Node builtin or `@quorum/core`, so the checks that read the repository to enforce that — and the one that reads the manifest — sit in `test/` beside it rather than inside it, which is the arrangement `packages/shared/test/corpus.ts` already uses for the same reason one package down. Only tests needing nothing but a document stay under `src/`. The scan is over *every* file there, tests included: scoping it to what ships would exempt exactly the files most likely to reach for a filesystem.

**It asserts nothing it has not loaded.** Each top-bar data region reads one explicit not-loaded string, the primary control is disabled, and a route whose screen does not exist says which screen it is, which ticket builds it — or that none does, for the three rail entries with no ticket — and what it is waiting for, taking that sentence from the register rather than from the component. No placeholder is a blank panel, a spinner or a skeleton, and none shows a fabricated project, run, ticket or cost: a screen that looks like it is loading something that is never coming is reassurance standing in for an answer, which is what `quorum board` refuses when it declines to render a token git could not produce.

**What it does not do, stated rather than implied.** There is no connection to the daemon — the frame parser, the connection states and the socket lifecycle are **Q-0120's**, and the top bar reserves the region they fill. **The app emits nothing**: it declares no `build` script, so the three emitting packages are still three, and the build task, the static route that serves its output, and the ruling on whether a served bundle is an **emitted artifact** at all are **Q-0122's** — which is also what the sentence above about serving "the built `apps/web`" is waiting for. `eslint.config.js` gained `apps/**/*.tsx` in the same change: a flat-config `*.ts` tail does not match `.tsx`, so the three rules this workspace enforces reached no line of the app while `lint` reported green over it.

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
  non-empty `outputs` in the workspace. `@quorum/shared`, `@quorum/core` and `@quorum/cli` each
  declare a `build` script driven by a per-package `tsconfig.build.json`, which adds `outDir`,
  `rootDir` and `declaration` and excludes test files, so the `tsconfig.json` that `lint` and
  `typecheck` read — and that ESLint's `projectService` needs a project from — is untouched. Each
  script removes its own emit directory before compiling, because turbo prunes an output directory
  on neither the miss path nor the hit path, so a file whose source has gone would otherwise survive
  both. **No verdict that exists today moves behind it:** `test` and `typecheck` gain no `^build`
  edge, the workspace suites go on resolving TypeScript source through the `quorum-source` export
  condition, and the emit is consumed by a plain `node` process, by a packed install, and by
  Q-0095's end-to-end suite. `packages/cli/src/build.test.ts` proves the declaration covers exactly
  what the build writes, in both directions, and that a replayed build restores something that runs;
  `src/build-fixture.test.ts` proves the leftover rules in a workspace it builds itself. See *"The
  emit serves the binary, and no test verdict moves behind it"* (2026-09-02).
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
