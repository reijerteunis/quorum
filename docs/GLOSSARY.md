# Glossary — Harness project

**Harness**: The complete agentic development flow of a project, from start to finish, expressed as versioned configuration — rules/CLAUDE.md, slash commands, subagents, skills, MCP servers, permissions, plus the orchestration patterns that combine agents (e.g. two coder agents + one judge, multi-model code review). Lives in the project folder (`.claude/` and friends), not in the UI's database.

**Quorum** (working name): The local web app being defined here — a visual workbench to create, maintain, execute and observe harnesses.

**Agent-agnostic**: Able to orchestrate any coding agent that ships as a headless CLI with its own subscription login (Claude Code, Codex CLI, Gemini CLI, …) via a common adapter interface. Does NOT mean direct API integration with model vendors.

**BYOS (bring your own subscriptions)**: The auth model — the Studio never stores or uses API keys; every agent runs on the OAuth login of the CLI the user already pays for.

**Canonical harness**: The single per-project source of truth (`harness/` folder): rules, architecture context, command prompts, flow files. Compiled by the Studio into vendor dialects (CLAUDE.md, AGENTS.md, GEMINI.md); vendor-unique features pass through in marked native sections.

**Gate**: The checkpoint between flow steps. Human-gated by default (user sees verdict + diffs + reasoning, then advances/re-runs/overrides); can be set to `auto` per gate in the flow file.

**Flow**: A declarative, git-versioned file in the harness describing one orchestration: ordered steps, which adapter+model runs each step, what each step receives, and the gates between steps. Example: "grill → 2 competing coders → judge → reviewer panel". Since 2026-08-21 a flow also declares the backlog stage it `consumes` and `produces`.

**Template library**: Flows that ship with the Studio as starting points, encoding the opinionated SDLC (grill, architecture, development, QA, maintenance). Users copy and adapt them; nothing is enforced.

**Adapter**: The thin integration layer that lets one CLI agent participate in the Studio: launch headless, stream events, map its output to the Studio's common trace format, stop/abort.

**Backlog**: The per-project (or central, multi-repo) folder of ticket folders in git. Replaces Jira. Its `stage` fields drive which flow can run next.

**Ticket**: One folder in the backlog: `ticket.md` (frontmatter state + intent) and per-stage artifact subfolders (requirements/, solution/, qa/, dev/, review/, deploy/).

**Stage**: The ticket's position in the SDLC state machine (draft → requirements → solutioned → red → green → reviewed → qa-passed → deployed, plus blocked/abandoned). Flows `consume` one stage and `produce` the next.

**Contract**: A machine-checkable artifact emitted by solutioning — interface, schema, stub, migration skeleton — that tests and developers code against.

**Role**: An agent persona file in `harness/roles/` with default adapter, model, write-path allow-list and prompt (product-manager, principal-architect, developer-backend, code-reviewer, …). Tasks reference roles; flows reference roles.

**Backward edge**: An `on_fail: goto` from a step/route to an earlier step or another flow, always with `max_iterations` and `on_exhausted: gate`.

**Fan-out step**: A step that expands `tasks.yaml` into N parallel worktree steps, one per task, grouped by role.

**Integrate step**: Merges the fan-out branches onto the ticket branch and runs the test suite; failure loops back to the failing tasks only.

**Cross-vendor rule**: `cross_vendor: required` — a lint guaranteeing the reviewer/judge of an artifact runs on a different adapter than its writer.

**Human-locked gate**: A gate that cannot be flipped to `auto` (deploy).

**Run history**: The durable record of one run under `.quorum/runs/`: its manifest, per-attempt
prompts and outputs, errors, usage, and per-vendor roll-up.
