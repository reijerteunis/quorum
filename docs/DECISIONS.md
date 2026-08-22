# Decisions — Harness project

## Agent-agnostic = multi-vendor via subscription-authed CLIs — 2026-08-06
**Decision:** Quorum orchestrates multiple vendors and models (Claude, GPT/Codex, Gemini, …) by driving each vendor's headless CLI agent (`claude -p`, `codex exec`, `gemini -p`) through a common adapter interface. Auth is always the CLI's own subscription OAuth login — the Studio never handles an API key ("bring your own subscriptions"). Claude Code is the reference adapter; other adapters are the first open-source contribution surface.
**Alternatives considered:** (a) Claude-only multi-role orchestration (simpler, but not a game changer and contradicts the multi-vendor ambition); (c) direct multi-vendor API integration (maximum control, but requires API keys, which are explicitly banned, and re-implements what the CLIs already do well).
**Why:** Multi-vendor judging/review is the differentiator; CLI adapters are the only route that delivers it while honoring the no-API-key constraint, and they inherit each vendor's tooling, sandboxing and auth for free.

## Flows are versioned files; UI is editor/runner; opinion ships as templates — 2026-08-06
**Decision:** A flow (orchestration of agents: steps, adapter+model per step, inputs, gates) is a declarative YAML/JSON file living in the project's harness folder, committed to git. The Studio UI is a first-class editor and runner over those files (a visual builder is a view, never the source of truth). Ruud's SDLC opinion (grill → architecture → development → QA → maintenance) ships as a starter template library users copy and adapt. Escape hatch later: a step type that shells out to a script.
**Alternatives considered:** Freeform node canvas with flows stored as app-state (unversionable, unshareable, no CI story); flows as full scripts (max power, but UI can't safely edit them and the opinion transfers to no one).
**Why:** "Multiple users with their own way of development" requires flows that are shareable and diffable like code; templates deliver opinion without imposing it.

## v1 is a local web app; desktop shell is a later wrapper — 2026-08-06
**Decision:** Ship v1 as a local daemon + browser UI launched with one command (`npx`-style). Architect the UI so it can be wrapped in a desktop shell (Tauri) in a later release without rewrite.
**Alternatives considered:** Desktop-first (Tauri/Electron) — nicer long-term (tray, notifications) but higher install friction for an open-source launch and no capability the local daemon lacks.
**Why:** The app's core needs (spawn CLIs, read project folders, long-running processes) are served equally by a local server; zero-install `npx` maximizes open-source adoption.

## Git worktrees are the execution model — 2026-08-06
**Decision:** Every code-writing step runs in its own git worktree on its own branch (e.g. `harness/run-42/coder-a`). Judges/reviewers receive branches + diffs as input. A run's end product is a branch or PR — the user's working tree is never mutated except by an explicit, user-approved merge. Failed/runaway runs are discarded by deleting branches.
**Alternatives considered:** Agents share the working tree (parallel agents collide, destructive); full repo clones per step (safe but slow and disk-hungry).
**Why:** Worktrees give collision-free parallelism, make every candidate implementation an inspectable diff (so judge verdicts are checkable), and keep the user's repo safe by construction.

## Human-gated by default, auto opt-in per gate — 2026-08-06
**Decision:** Runs pause at every gate by default: the user sees the verdict, candidate diffs and reasoning, then advances / re-runs / overrides (including picking against the judge). Individual gates can be set to `auto` in the flow file.
**Alternatives considered:** Autonomous by default with end-of-run review — faster, but one bad judge call compounds through later stages, and a silently-merged bad diff would poison first impressions of an open-source release.
**Why:** Trust in agentic tooling is earned per gate; the gate screen (human judging the judges over real diffs) is also the product's strongest surface.

## Mission control, not cockpit — 2026-08-06
**Decision:** The Studio owns the flow; the vendor CLIs keep owning free-form interactive hacking. Steps are either batch (watch streamed traces) or interactive (step-scoped chat: grill interviews, gate conversations, agent clarifying questions). Intervention = stop step / edit instructions / re-run in its worktree, plus one-click "open this worktree in your editor/terminal". The Studio does not rebuild the CLIs' interactive sessions.
**Alternatives considered:** Daily-driver chat IDE replacing the terminals — rejected: forever chasing three vendors' interactive feature sets, duplicating what CLIs do best.
**Why:** Development *starts* in the Studio (grill, architecture, dispatch); hand-hacking stays in the tools built for it.

## Canonical harness compiled to vendor dialects — 2026-08-06
**Decision:** One source of truth per project (`harness/`): rules, architecture context, command prompts, flow files. The Studio compiles shared sources into each vendor's dialect (`CLAUDE.md`, `AGENTS.md`, `GEMINI.md`, marked as generated). Vendor-unique features (Claude subagents, skills) live in clearly-marked native pass-through sections — never faked across vendors.
**Alternatives considered:** Native-only editing of each vendor's files (simple and honest, but doesn't cure drift — the actual disease); full abstraction of all vendor features (leaks: subagents/skills have no cross-vendor equivalent).
**Why:** Rules must reach every agent in a multi-vendor flow or judging is incoherent; "write your rules once, every CLI obeys" is a standalone reason to adopt the tool. Second headline feature after multi-vendor judging.
**Refinement (Ruud):** The standard vendor locations (`.claude/`, `CLAUDE.md`, `AGENTS.md`, `GEMINI.md`) still exist in the repo as thin generated files that *link/import* the canonical `harness/` sources (e.g. CLAUDE.md `@harness/...` imports) wherever the vendor supports references, inlining content only where it doesn't. Vendors keep finding their files in the standard places; truth stays in `harness/`.

## v1 cut and launch test — 2026-08-06
**Decision:** v1 ships: two adapters (Claude Code + Codex CLI); harness compiler (rules/context/command prompts → thin linked vendor files, native pass-through sections); flow engine (sequential + parallel steps, worktree per writing step, human gates, five SDLC templates); run observatory (live traces, side-by-side parallel steps, gate screen with diffs/verdict/override, step-scoped chat, stop/edit/re-run); run history with per-run/per-vendor cost & token roll-ups. Explicitly out (README roadmap): Gemini adapter, desktop shell, visual flow canvas, regression eval suites, script-step escape hatch, headless/CI mode.
**Alternatives considered:** Single-adapter v1 (undermines the multi-vendor headline); three adapters or eval suites in v1 (delays launch, duplicates judge steps' value).
**Why:** Pass/fail launch test — the cold-clone test: a stranger with Claude and Codex subscriptions goes from `npx quorum` to a multi-vendor-reviewed, human-approved merged branch on their own repo in under 30 minutes, reading only the README. Every v1 feature must serve that test.
**Amended 2026-08-21:** script steps move into v1 (see "Deploy gate is human-locked; script steps pulled into v1").

## Backlog is files in git, no ticketing tool — 2026-08-21
**Decision:** A ticket is a folder (`backlog/T-0012-…/`) with `ticket.md` frontmatter holding `stage`, `owner`, iteration counters and history; every stage writes its artifacts as files into that folder. Two layouts: `in-repo` (default) and `central` (one backlog repo referencing many target repos). The Studio's backlog board is a view over these files.
**Alternatives considered:** Jira/Linear via MCP (external dependency, un-diffable, breaks cold-clone test); SQLite in the Studio daemon (not shareable or reviewable, not versioned with the code).
**Why:** Handoff between humans owning different stages needs only the stage field; everything is diffable, auditable and works offline; multi-repo comes free via the central layout.

## One flow per SDLC stage, chained by backlog state — 2026-08-21
**Decision:** Flows declare `consumes` and `produces` stages. A flow can only run on a ticket whose stage matches `consumes`; on success it advances the stage. The seven-stage SDLC (requirements, solutioning, qa-red, development, review, qa-final, deploy) ships as seven templates, not one flow.
**Alternatives considered:** One end-to-end mega-flow (simple to read, impossible to adjust per stage or to let different humans own stages).
**Why:** Adjustability and reuse across repos: swap a stage's models or pattern in isolation; different owners per stage; partial adoption (start with requirements only).

## Bounded backward edges in the flow engine — 2026-08-21
**Decision:** Steps and routes may declare `on_fail: goto <step | flow:name>` with a mandatory `max_iterations`, a named counter persisted in the ticket, and `on_exhausted: gate`. Cross-flow backward edges (review → development, qa-final → development/solutioning) are allowed. Exhausted loops and exceeded budgets always land on a human gate.
**Alternatives considered:** Keep v1 strictly DAG and let humans re-run manually (safe but defeats the review↔dev loop the SDLC needs); unbounded loops (two vendors arguing on the user's subscription).
**Why:** The loops are the value of review and QA stages; bounding them is what keeps them safe and affordable.

## Writer and reviewer are never the same vendor — 2026-08-21
**Decision:** Flows can set `cross_vendor: required`; the flow linter rejects a step whose reviewer/judge adapter equals the adapter that produced its input. All shipped SDLC templates set it.
**Alternatives considered:** Same-vendor self-review (cheaper, but shares blind spots and erases the product's differentiator).
**Why:** Cross-vendor critique is the headline; making it a lint makes the opinion enforceable where it matters without constraining user-authored flows.

## Solutioning emits contracts; red phase tests against contracts — 2026-08-21
**Decision:** The architect step must produce machine-checkable contracts (interfaces, schemas, stubs, migration skeletons) plus `tasks.yaml` with a `role` per task, all committed to the ticket branch. QA-red writes tests that compile against the stubs and fail on assertions. Development fans out one worktree per task by role; an `integrate` step merges branches and must reach green.
**Alternatives considered:** Tests written from the prose solution doc (fail on missing symbols, not on behaviour — meaningless red phase); single developer agent (no specialisation, no multi-model development).
**Why:** Without contracts the red→green mechanism is a hope, not a mechanism; role-tagged tasks are what make specialised multi-vendor developers possible.

## Deploy gate is human-locked; script steps pulled into v1 — 2026-08-21
**Decision:** Gate type `human-locked` cannot be set to `auto`; the deploy template uses it. `type: script` steps (previously v1 roadmap) are required by qa-red, qa-final and deploy and move into v1 scope.
**Why:** A tool that can deploy autonomously on day one would poison trust; the SDLC cannot prove red/green without running a test command.

## Cross-vendor rule refined: judges over mixed-vendor candidates are allowed — 2026-08-21
**Decision:** `cross_vendor: required` means a reviewing/judging step must see at least one input written by a vendor other than its own. Single-writer review therefore needs writer ≠ reviewer; a judge over N candidates only needs the candidates to span vendors.
**Why:** The spike's flow lint flagged the requirements template: the Head of Product (Claude) judges Claude's own candidate. With two vendors a judge necessarily shares one; strict writer≠reviewer would require a third vendor for every judge. Found by `harness lint`, 2026-08-21.

## Spike exists: quorum (engine + adapters + backlog, mock-verified) — 2026-08-21
**Decision:** A runnable Node spike (`quorum.zip`, delivered in the Cowork session of 2026-08-21) implements the engine (stage chaining, parallel, bounded loops, gates, worktrees, lint), Claude/Codex/mock adapters under one contract, and the requirements + solutioning templates. Verified end-to-end with the mock adapter (18 checks). Next: run on a real repo with real CLIs and answer the four adapter questions in `docs/ADAPTER-CONTRACT.md`; then add `fan_out` and `integrate` step types.

## Branch layout: `harness/<id>/integration` plus sibling step/task branches — 2026-08-21
**Decision:** Per ticket, the integration branch is `harness/<id>/integration`; contracts, tests and each task get sibling branches (`harness/<id>/contracts`, `…/tests`, `…/<task.id>`). Worktrees live under `.harness/worktrees/` (git-excluded). Fan-out waves merge into the integration branch between waves; task worktrees sync to it before a retry.
**Why:** Git refs are files in directories, so `harness/<id>` cannot exist alongside `harness/<id>/x`. Found by the smoke test, 2026-08-21.

## `integrate` is one generic step type used by three stages — 2026-08-21
**Decision:** `type: integrate` merges listed branches (or the fan-out's branches) into a target branch in a worktree, optionally runs `commands.test`, and asserts `expect: pass|fail`. Solutioning lands contracts with it, qa-red proves red with `expect: fail`, development proves green with `expect: pass` and `on_fail` scoped to failing tasks. Verified with the mock adapter end-to-end `draft → green` (30 checks).

## Product-agnostic; launched open source via heyruud.com; dogfooded on Ruud's SaaS portfolio — 2026-08-22
**Decision:** Quorum is a standalone open-source product, announced and distributed through heyruud.com (the GitHub repo is the source of truth; heyruud.com carries the launch post, docs entry point and updates). It is built for any repository. Ruud's own SaaS products (feedmind, flextann, every upcoming one) are the dogfood targets, never the design target: nothing product-specific lives in the Studio, its templates or its docs. Each repo carries its own `harness/` context files (`product-context.md`, `architecture.md`, `rules.md`) — those, not the Studio, hold product knowledge.
**Alternatives considered:** Internal tool first, open-source later (loses the launch moment and lets product-specific shortcuts creep in); flextann-specific pipeline (what the 2026-08-21 session briefly drifted into — reverted).
**Why:** The differentiator is multi-vendor orchestration on subscription auth for *anyone's* repo; dogfooding on several unrelated SaaS products is the proof that the templates generalise. Product-specific context files were removed from the Harness project on 2026-08-22.

## Name: Quorum — 2026-08-22
**Decision:** The product is called **Quorum** (npm: `quorum` — current package is an empty 2017 placeholder, request release or fall back to `@heyruud/quorum`; binary `quorum`). "Harness" stays as the name of the concept and the `harness/` folder, never the product.
**Alternatives considered:** Harness Studio (collides with Harness.io, a large software-delivery platform, and with the generic term "agent harness"); Sluis/Sluice/Lockkeeper (canal-lock metaphor, rejected: not pronounceable in English or too narrow); Foundry (dominant Ethereum toolkit, Palantir, Microsoft AI Foundry — unownable); Drydock (clean, but says nothing about judging and gating).
**Why:** Quorum states the differentiator in one word: nothing advances without enough agreement — between vendors, and with the human at the gate. Abstract enough to age well, one word people can spell and say. Known neighbours (ConsenSys Quorum blockchain, Quorum political software) are outside the market.
