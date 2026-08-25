# Design prompt — Quorum clickable mockup

*Paste everything below the line into Claude (a fresh chat, artifacts on) to get a clickable HTML prototype of the product for visual validation. Iterate by replying with change requests. Updated 2026-08-22: renamed to Quorum, backlog board and ticket page added, branch naming aligned with the spec. Updated 2026-08-25: no codex model is pinned, every cost figure is per vendor rather than blended, and the templates drawer lists `chore`.*

---

Build a **single-file HTML clickable prototype** (inline CSS + JS, no external assets except Google Fonts, no localStorage — in-memory state only) of a developer tool called **Quorum**. This is a design validation mockup, not a real app: everything is populated with the realistic fake data specified below, and navigation between screens must work by clicking.

## What the product is

Quorum is an open-source, local-first "mission control" for agentic software engineering. A developer opens a project folder and: (1) maintains one canonical **harness** — rules, context, command prompts, flow definitions — which the tool compiles into each AI vendor's dialect (CLAUDE.md, AGENTS.md, GEMINI.md stay in their standard places as thin generated files linking back to the canonical sources); (2) keeps a **backlog** of tickets as folders in git, each ticket moving through stages (draft → requirements → solutioned → red → green → reviewed → qa-passed → deployed); (3) defines **flows**: declarative, git-versioned orchestrations of coding agents, one per stage, e.g. "two PMs + a head-of-product judge" or "two competing coders + a judge + a review panel"; (4) **runs** flows using multiple vendors' CLI agents (Claude Code, Codex CLI) on subscription OAuth — never API keys; every code-writing step runs in its own git worktree, and the run's product is a branch/PR, never a mutated working tree; (5) watches everything live and **gates every step**: the run pauses so the human sees verdicts, diffs and reasoning, then advances, re-runs, or overrides. The name is the rule: nothing advances without a quorum — enough agreement between vendors, and the human's say.

Tone of the product: calm, precise, trustworthy. The user is a professional developer supervising a team of AI agents — not chatting with a bot.

## Aesthetic direction

Dark theme, "ground control" feel. Near-black desaturated background (not pure black), one restrained accent color (electric teal or amber — pick one, use it only for live/active states and primary actions). Inter or IBM Plex Sans for UI, JetBrains Mono for code/traces/costs. Density like Linear or Vercel's dashboard: information-rich but generous line-height, no clutter, no gradients-for-decoration, no glassmorphism. Status colors: running = accent pulse, waiting-on-human = amber, passed = green, failed = red, idle = gray. Every vendor gets a small badge (Claude = coral square, Codex = white circle, Gemini = blue diamond) shown wherever an agent appears.

## Layout skeleton (all screens)

Left rail (56px, icons): Projects, Backlog, Harness, Flows, Runs, History, Settings. Top bar: current project name ("acme-billing"), git branch, a subscriptions status cluster (Claude ✓ logged in, Codex ✓ logged in, Gemini — not installed), and a global "Run flow ▸" primary button. Main area varies per screen.

## Screens (each a route; left rail navigates)

**1. Projects home.** Grid of project cards (acme-billing, heyruud.com, northwind-crm) each showing: path, harness health ("harness in sync" or "2 vendor files drifted — recompile"), backlog summary (3 tickets waiting on a gate), last run summary, cost this week split by vendor (Claude in dollars, Codex in tokens — never summed). One "Open a folder…" card.

**2. Backlog board.** Kanban with one column per stage (draft · requirements · solutioned · red · green · reviewed · qa-passed · deployed). Each ticket card: id (`Q-0042`), title, owner, iteration counters (review 1/3), cost to date per vendor, and a "Run next flow ▸" button enabled only when a flow consumes that stage. Clicking a card opens the **ticket page**: the ticket folder rendered as tabs (Requirements — candidate-claude / candidate-codex / merged side by side; Solution — solution.md, contracts list, tasks table with role badges and dependency arrows; QA — scenarios × red/green/final matrix; Dev — integration notes; Review — rounds as columns) plus a runs.log timeline down the right edge.

**3. Harness editor.** Three-pane: left = canonical source tree (`harness/rules.md`, `architecture.md`, `product-context.md`, `roles/…`, `flows/requirements.yaml`…); center = markdown editor on `rules.md` with believable content (TypeScript strict mode, no `any`, conventional commits…); right = "Compiled targets" panel listing CLAUDE.md / AGENTS.md / GEMINI.md, each with sync state and a note "thin file — links to canonical source", plus a marked "native pass-through" section for `.claude/agents/` and skills. A "Recompile" button and a drift warning on AGENTS.md.

**4. Flow editor.** Form-based (NOT a node canvas) editor of `flows/development.yaml`: header showing `consumes: red → produces: green`; vertical list of step cards — Step 1 "developers" (fan-out from tasks.yaml by role, showing two resulting cards: backend on Codex (no model pinned — the CLI picks what the login supports), frontend on Claude Sonnet, each marked "runs in worktree"), Step 2 "integrate" (merge into `harness/Q-0042/integration`, run tests, expect pass, on fail → back to developers, max 3), gate marked "human". Right side: read-only YAML preview that mirrors the form. A "Templates" drawer listing the seven shipped SDLC flows plus `chore`: requirements, solutioning, qa-red, development, review, qa-final, deploy.

**5. Live run — mission control (the hero screen).** Header: run #42 on ticket Q-0042 "Subscription downgrade mid-cycle", flow `development`, elapsed 14:32, per-vendor cost ticker (Claude $3.84 · Codex 226k tokens, unpriced — never one blended number), stop button. Main: two side-by-side live trace columns for dev:Q-0042.1 (Codex) and dev:Q-0042.2 (Claude), each streaming believable agent events (tool calls like `Edit src/billing/plans.ts`, `Bash npm test — 34 passed`, short assistant reasoning snippets), with per-column vendor badge, model, worktree branch name (`harness/Q-0042/Q-0042.1`), token count and cost. Below: horizontal step timeline showing developers (running) → integrate (queued) → gate. One event in the Claude column is expanded showing a diff snippet.

**6. Gate screen (second hero).** Reached when a judge or integrate step finishes: verdict card "Review panel: changes requested — 2 blockers, 5 majors deduplicated from 11 findings" with the blockers listed; side-by-side diff summary (files changed, +/- lines, one expanded hunk); the judge's full reasoning in a collapsible; three actions: primary "Send back to development (round 2/3)", secondary "Advance anyway" (override, requires a one-line reason), tertiary "Re-run review with edited instructions". A small "why human gates" hint: gates can be set to auto per-step in the flow file; deploy's gate is human-locked.

**7. Step chat (interactive step).** The requirements step as a step-scoped conversation: the PM agent asks sharp questions ("What happens to an active subscription when a customer downgrades mid-cycle?"), user replies; right panel shows the requirement document being built live from answers. Clearly scoped: breadcrumb "Q-0042 ▸ requirements ▸ pm-claude".

**8. Run history.** Table of past runs: id, ticket, flow, vendors used (badges), status, duration, cost, tokens; one row expanded inline showing its step timeline and per-vendor cost split. Clicking opens the trace (reuse screen 5 in a "completed" state).

## Interactions that must work in the mockup

Left-rail navigation between all screens; backlog card → ticket page; "Run next flow" → mission control; step timeline on screen 5 clickable (integrate → opens gate screen); the three gate actions each show a plausible next state (send back → timeline loops with round counter; override → reason input appears); expanding/collapsing trace events and diffs; the Templates drawer opening.

Start on screen 5 (live run) so the first impression is the mission control.
