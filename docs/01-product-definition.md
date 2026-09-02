# Quorum — Product Definition (v1)

*Status: definition locked after grilling session, 2026-08-06; positioning amended 2026-08-22 (launch via heyruud.com, product-agnostic, dogfood portfolio); renamed from Harness Studio to Quorum 2026-08-22; 2026-08-25 docs review — "Studio" replaced by "Quorum" throughout, and the cold-clone test now states the measured constraint that contradicts it; 2026-09-02 (Q-0098) — the cold-clone test is annotated rather than rewritten, naming its `npx quorum` as the registry path that stays Q-0029's in M6 and pointing at the two paths that work today. See DECISIONS.md for the reasoning behind every choice and GLOSSARY.md for terminology.*

## One-liner

An open-source, local-first mission control for agentic software engineering: define your development flow once as versioned files, then run it with agents from multiple vendors — competing coders, cross-vendor review panels, judges — on the subscriptions you already pay for, with a human gate between every step.

## The problem

Agentic development today is fragmented across vendor CLIs. Every project hand-maintains near-duplicate rule files (CLAUDE.md, AGENTS.md, GEMINI.md) that silently drift apart. Orchestration patterns that demonstrably raise quality — two agents implementing competing solutions with a judge, multi-model code review — require ad-hoc scripting, and there is no visual surface to define, run, observe, or intervene in such flows. Existing observability platforms (LangSmith, Langfuse, Braintrust) watch API traffic; none of them drive subscription-authenticated CLI agents, and none encode a software-engineering lifecycle.

## The product

Quorum is a local web app (one command to start, browser UI; desktop shell later) that opens any project folder and gives it four capabilities.

**1. Canonical harness.** One source of truth per project in `harness/`: rules, architecture context, product context, command prompts, flow definitions. Quorum compiles these into each vendor's dialect — the standard files (`.claude/`, `CLAUDE.md`, `AGENTS.md`, `GEMINI.md`) remain in their standard places as thin generated files that link/import the canonical sources where the vendor supports references, inlining only where it doesn't. Vendor-unique features (Claude subagents, skills) pass through in marked native sections and are never faked across vendors. Change a rule once; every agent in every flow obeys it on the next run. Product knowledge lives in these per-repo files and nowhere else — Quorum itself knows nothing about any product.

**2. Flows as versioned files.** A flow is a declarative YAML file in the harness: steps, which adapter+model runs each step, what each step receives, gates between steps. Sequential and parallel composition. Quorum is a first-class editor and runner over these files — flows are shared by committing them, not exporting app blobs. The tool imposes no methodology: Ruud's opinionated SDLC (grill → architecture → development → QA → maintenance) ships as a starter template library that users copy and adapt.

**3. Multi-vendor execution, no API keys — ever.** Each step runs a coding agent through its headless CLI (Claude Code, Codex CLI; Gemini CLI as the first community milestone), authenticated by that CLI's own subscription OAuth login. "Bring your own subscriptions" is the auth model and the headline. Every code-writing step executes in its own git worktree on its own branch; judges and reviewers receive branches and diffs as input; a run's end product is a branch or PR — the user's working tree is never touched except by an explicit approved merge.

**4. Mission control, human-gated.** A live run observatory: streamed traces per step, parallel steps side by side, per-step and per-vendor cost/token tickers. Runs pause at every gate by default — the user sees the verdict, the candidate diffs, and the reasoning, then advances, re-runs, or overrides (including picking against the judge). Individual gates can be flipped to `auto` in the flow file as trust is earned. Interactive steps (grill interviews, gate conversations, agent clarifying questions) get a step-scoped chat; free-form hacking stays in the vendor CLIs, reachable via one-click "open this worktree in your editor/terminal."

## What v1 ships

Two adapters (Claude Code, Codex CLI). The harness compiler for shared concepts. The flow engine with worktree isolation, human gates, script steps, and the SDLC templates. The run observatory with live traces, the gate screen, step-scoped chat, and stop/edit/re-run. Run history with traces and cost/token roll-ups per run and per vendor.

Explicitly out of v1, listed as roadmap in the README: Gemini adapter (designed as the "good first issue" for contributors), desktop shell (Tauri wrapper over the same UI), visual flow canvas (the form/file editor launches first), regression eval suites (judge steps are the evals for now), headless/CI mode.

## Launch test (pass/fail)

**The cold-clone test:** a stranger with Claude and Codex subscriptions, on their own repo, goes from `npx quorum` to a multi-vendor-reviewed, human-approved merged branch in under 30 minutes, reading nothing but the README. Any feature or design decision that does not serve this test is out of v1.

**What `npx quorum` names here.** The registry-resolved form, which is **M6's** and is Q-0029's to make true: every package is `"private": true` today, so typing it on a cold machine fetches a stranger's package or nothing. The shape of this test is unchanged — it is the sentence *"v1 cut and launch test"* (2026-08-06) froze — and the two paths that **do** work since Q-0098 are the workspace-local one and the locally packed one, both described in `04-architecture.md`. See *"The emit serves the binary, and no test verdict moves behind it"* (2026-09-02), clause (d).

**Measured constraint, still unresolved.** `requirements` is the cheapest of the seven stages and takes about 13 minutes (DECISIONS, 2026-08-22), so thirty minutes cannot cover the full SDLC. Either the first-run path covers one stage rather than seven, or the test's premise changes. The decision belongs before M6 writes the README and has not been taken.

## Positioning and launch

Open source on GitHub, launched and documented through heyruud.com — the launch post, the docs entry point and ongoing updates live there; the repo is the source of truth. Product-agnostic by construction: Quorum, its templates and its docs contain nothing specific to any one product. Ruud dogfoods it across his own SaaS portfolio — feedmind, flextann and every upcoming product — each repo carrying its own `harness/` context files. That the same flows generalise across unrelated products is part of the proof, and the dogfood repos are where the launch stories come from.

Differentiators, in order: (1) cross-vendor orchestration and judging of coding agents on subscription auth — no one credibly offers this; (2) canonical harness compiled to vendor dialects — cures rule drift, valuable before a single flow is run; (3) an opinionated but non-enforcing SDLC template library — the opinion transfers through templates, not constraints; (4) safety by construction — worktrees and human gates mean the tool cannot trash a repo.

## Screens (input to design validation)

Projects home (picker) · Backlog board (tickets by stage) · Harness editor (canonical sources, compile status per vendor, drift indicator) · Flow editor (form-based steps/gates) · Live run mission control (parallel trace columns, per-vendor cost tickers) · Gate screen (verdict + side-by-side diffs + advance/re-run/override) · Step chat (grill interview) · Run history (list, trace drill-down, cost roll-ups).
