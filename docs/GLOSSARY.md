# Glossary — Quorum

**Harness**: The complete agentic development flow of a project, from start to finish, expressed as versioned configuration — rules/CLAUDE.md, slash commands, subagents, skills, MCP servers, permissions, plus the orchestration patterns that combine agents (e.g. two coder agents + one judge, multi-model code review). Lives in the project folder (`.claude/` and friends), not in the UI's database.

**Quorum**: The local web app defined here — a visual workbench to create, maintain, execute and observe harnesses. Named 2026-08-22; DECISIONS entries written before that date call it **the Studio**, which is the same thing and is not current vocabulary.

**Agent-agnostic**: Able to orchestrate any coding agent that ships as a headless CLI with its own subscription login (Claude Code, Codex CLI, Gemini CLI, …) via a common adapter interface. Does NOT mean direct API integration with model vendors.

**BYOS (bring your own subscriptions)**: The auth model — Quorum never stores or uses API keys; every agent runs on the OAuth login of the CLI the user already pays for.

**Canonical harness**: The single per-project source of truth (`harness/` folder): rules, architecture context, command prompts, flow files. Compiled by Quorum into vendor dialects (CLAUDE.md, AGENTS.md, GEMINI.md); vendor-unique features pass through in marked native sections.

**Gate**: A checkpoint in a flow. An author-declared gate is human-gated by default and may be set to `auto`; an author-declared `human-locked` deploy gate can never be automated. Separately, an engine-presented exhaustion gate appears when a bounded loop exhausts. It uses the same gate kind but is not declared as a flow step, requires an explicit `advance`, `retry`, or `abort`, and cannot be bypassed by `--auto`.

**Flow**: A declarative, git-versioned file in the harness describing one orchestration: ordered steps, which adapter+model runs each step, what each step receives, and the gates between steps. Example: "grill → 2 competing coders → judge → reviewer panel". Since 2026-08-21 a flow also declares the backlog stage it `consumes` and `produces`.

**Template library**: Flows that ship with Quorum as starting points, encoding the opinionated SDLC (grill, architecture, development, QA, maintenance). Users copy and adapt them; nothing is enforced.

**Adapter**: The thin integration layer that lets one CLI agent participate in Quorum: launch headless, stream events, map its output to Quorum's common trace format, stop/abort.

**Backlog**: The per-project (or central, multi-repo) folder of ticket folders in git. Replaces Jira. Its `stage` fields drive which flow can run next.

**Ticket**: One folder in the backlog: `ticket.md` (frontmatter state + intent) and per-stage artifact subfolders (requirements/, solution/, qa/, dev/, review/, deploy/). Its **id** is `<PREFIX>-nnnn`, the grammar `/^[A-Z]+-[0-9]{4}$/` that `harness runs <token>` already resolves against, and the prefix belongs to the adopter rather than to the product: `harness ticket new` allocates within the one prefix the backlog's tickets already carry, so a `PROJ-0041` backlog allocates `PROJ-0042` with no configuration step. An **empty** backlog allocates `T-0001`, which is the id `harness init` prints as its own next command. A backlog the allocator **cannot read** — no id parses, more than one prefix does, or the prefix is full at `9999` — refuses and names what it found, rather than answering; `--id <ID>` allocates explicitly through the same checks, and `create` refuses a taken id or an occupied folder instead of overwriting one. Reading is not constrained by any of this: every id on disk still lists, reads and resolves, whatever its prefix.

**Stage**: The ticket's position in the SDLC state machine (draft → requirements → solutioned → red → green → reviewed → qa-passed → deployed, plus blocked/abandoned). Flows `consume` one stage and `produce` a later one — usually the next, though the **chore flow** produces `reviewed` from `requirements`. `green` means the ticket's integration branch integrated and passed its configured suite; no stage — `green` or any later one — implies the branch is contained in the base branch. Where the code actually is appears on `harness board` as **Containment**.

**Containment**: The git-derived relationship between a ticket branch tip and the configured base
branch, computed on every `harness board` invocation and never stored. Exactly three states,
rendered as one token beside the ticket: contained (`main:contained` — the branch tip is an
ancestor of the base tip), not contained (`main:not-contained(+12)` — with the count of commits
reachable from the branch and not from the base), and indeterminate (`main:indeterminate(missing
ref)`, `main:indeterminate(shallow clone)`, `main:indeterminate(git failed)`, `main:indeterminate(no
branch)` — the board could not answer, which is never reported as either of the other two). The
first three are git declining to answer; `no branch` is the ticket naming a branch that does not
exist, so git was never asked. Every ticket names one from creation and most never have one, so the
board renders `no branch` only where the stage claims the work is done and the branch is the
evidence for it — `solutioned` onward, never `draft`, `requirements`, `blocked` or `abandoned`.
An ancestry fact about two refs at the moment of reading, not a claim about how the code arrived —
and not a synonym-carrier: the board and the docs say "contained", never "merged", "landed" or
"shipped".

**Contract**: A machine-checkable artifact emitted by solutioning — interface, schema, stub, migration skeleton — that tests and developers code against.

**Role**: An agent persona file in `harness/roles/` with default adapter, model, write-path allow-list and prompt (product-manager, principal-architect, developer-backend, code-reviewer, …). Tasks reference roles; flows reference roles.

**Backward edge**: An `on_fail: goto` from a step/route to an earlier step or another flow, always with `max_iterations` and `on_exhausted: gate`.

**Fan-out step**: A step that expands `tasks.yaml` into N parallel worktree steps, one per task, grouped by role.

**Integrate step**: Merges the fan-out branches onto the ticket branch and runs the test suite; failure loops back to the failing tasks only.

**Cross-vendor rule**: `cross_vendor: required` — a lint guaranteeing the reviewer/judge of an artifact runs on a different adapter than its writer.

**Panel**: A parallel group of reviewing or judging steps over the same input, spanning more than one
adapter. The review flow's Claude + Codex reviewers are a panel; `cross_vendor: required` is satisfied
by the panel spanning vendors, not by writer ≠ reviewer.

**Human-locked gate**: A gate that cannot be flipped to `auto` (deploy).

**Event**: One item of the trace a run emits, defined once in `packages/shared` as a discriminated
union on `type`. Two shapes, because two interfaces exist. An **adapter event** is what an adapter
passes to `onEvent` — `spawn`, `stdout`, and the `retry` the contract layer adds — carrying no
identity, because an adapter does not know which step it is running. A **run event** is one of
those with the step id the engine supplies, or one of the engine's own: `step`, `done`, `info`,
`warn`, the correlated gate question, and the final `terminal` member. The gate question is queued
before the out-of-band `answerGate` callback is invoked. `runFlow` is a lazy, single-consumer
`AsyncIterable<Event>` backed by a lossless FIFO: order is stable within one step, but parallel
members have no global ordering or interleaving promise. Cancellation belongs to the caller through
an `AbortSignal`, not to a signal handler installed by core. No event gains a timestamp or sequence
number, and only the terminal event carries run identity. Vendor identity is one neutral, open
`vendor` label and nothing else in the union is vendor-specific. Not persisted in v1 (see **Run
history**, which is), and not to be called a "log line" or a "trace message" — the trace is the
stream, an event is one item of it. See *What a run's event stream carries, and how a gate answer travels back* (2026-08-28) and its 2026-08-29 erratum, which corrects two of its clauses.

**Run history**: The durable record of one run under `.quorum/runs/`: its manifest, per-attempt
prompts and outputs, errors, usage, and per-vendor roll-up.

**Undecided**: A run's terminal status, never a gate answer — the answers a gate accepts are still
exactly `advance`, `retry` and `abort`. A run is undecided when it stops at a gate for which **no
answer was available**: the scripted answers were exhausted and stdin is not a terminal, stdin
closed while the question was open, or the caller supplied no answer channel. It moves no stage and
keeps every worktree the run obtained, like the other non-advancing statuses, and alone among them
it does **not** restore the ticket branch — nothing was proved wrong, so the merge an `integrate`
step had already proven green survives. Somebody who supplied a word that is not an answer *was*
there: that is an operator error and stays `failed`, rollback included. The CLI exits **3**. It is
terminal rather than suspended — nothing is held open, and M3's resume (Q-0019) may later choose it
as the state it picks up. Not a synonym for "aborted", "failed" or "paused". See *"A run nobody
answered is undecided, and keeps the branch it proved"* (2026-09-01).

**Occurrence**: One entry in a run manifest's record of what actually executed — an adapter call, a
script, or an integrate step — carrying its own usage, errors and retained files. Adapter
occurrences keep their exact `prompt.txt` and `output.txt`; gates and fan-out parents allocate
none. The unit a roll-up sums over.

**Preflight**: A check a run performs before invoking any adapter, so that bad evidence is found
before it is paid for. The run-level diff preflight materialises every range whose endpoints all
exist at run start, and its guarantee is **per endpoint, not per range**: where an endpoint is one
an earlier step of the flow has yet to create, the range is deferred to step time and every
endpoint beside it that is already due is still resolved at run start, so a branch nobody created
stops the run before anything is spent. It never resolves an endpoint that is not due, and never
reports one as having failed to resolve. A preflight that declines to examine something reports that it *skipped*
it — reporting success for an unexamined subject is the failure recorded in the 2026-08-25
decision.

**Base override** (`--base <ref>`): `harness run … --base <ref>` aims a run's `{base}` at an
arbitrary revision instead of `repo.base_branch`. It moves the **diff anchor** only — what a review
compares the ticket's work against — and never the branch a rework step or `integrate` merges from,
which keeps reading the configured base. Without it a ticket whose branch is contained in the base
has an empty review range and cannot be reviewed at all, which is why a merged ticket needed a
hand-run review before Q-0077. Not a way to change what a run writes.

**Dry run** (`--dry`): `harness run … --dry` walks a flow without invoking an adapter or writing
anything, reporting what each step would do. It is the same run machinery, not a separate code
path, which is why its preflight must be as honest as a real run's. Not called a "preview" —
DECISIONS entries before 2026-08-25 use that word for it.

**Chore flow**: The short route for machinery and configuration tickets — requirements → one implementer
in a worktree → cross-vendor review with a bounded revise loop → integrate → human gate. Consumes
`requirements`, produces `reviewed`, skipping solutioning and qa-red because a scaffold has no
behaviour a test could fail on before it exists. Not a lighter SDLC; a different one, for work that
changes what the repository *is* rather than what it *does*. Requires `harness/<id>/integration` to
exist before its first run — `review` diffs against that branch and only `integrate`, which runs
later, creates it (see 02-sdlc-pipeline-spec.md §5.8).

**Build task**: Turborepo's `build` task, declared once in the root `turbo.json` and run in the
three packages that emit. It is the **first task in this workspace whose `outputs` is non-empty**,
so a cache hit on it replays an *artifact* where `lint`, `typecheck` and `test` replay only a
verdict — the distinction the 2026-09-02 decision rests on. Not a "pipeline", a "job" or a "step":
a pipeline is turbo's own retired name for the task table, a job is one of CI's seven, and a step is
a flow's. Nothing in `harness/flows/` runs it, and no test verdict in this workspace moves behind
it: the suites resolve TypeScript source through the `quorum-source` export condition, and the emit
is what Node and a packed install get. See *"The emit serves the binary, and no test verdict moves
behind it"* (2026-09-02).

**Emitted artifact**: The JavaScript and declaration files a **build task** writes under a package's
`dist/`, gitignored and reproducible from the commit. The three emitting packages are
`@quorum/shared`, `@quorum/core` and `@quorum/cli`, which is also the **local distribution set** —
what a `pnpm pack` of this repository produces and what an installation outside the workspace
consumes. Distinguished from the **binary**, which is the single file `packages/cli`'s `bin.quorum`
names: the binary is one emitted artifact among many and the two words are not interchangeable. An
emitted artifact is not a "bundle" — nothing here is bundled, each source file emits its own
counterpart — and not a "build output directory", which names the container rather than the
contents. Since Q-0098 the binary carries a shebang and an executable bit, both proven to survive a
cache replay, because an artifact something *executes* fails differently from a stale tick: the tick
lies about the past, the artifact lies about the present.
