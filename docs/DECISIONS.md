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

## Flows never pin a vendor model name; codex runs with `--ignore-user-config` — 2026-08-22
**Decision:** No shipped flow or role pins a codex model. The codex adapter always passes `--ignore-user-config` and passes `-m` only when a flow step names a model explicitly; otherwise the CLI picks a model its own login supports. A role's default model is inherited only by steps running on that role's own adapter — never across vendors.
**Alternatives considered:** (a) Keep honouring `~/.codex/config.toml` and merely remove the dead names from templates — least invasive and respects the user's CLI setup, but any personal `model` pin silently breaks every run, and a stranger's broken pin breaks their cold-clone test with no clue why; (b) `--ignore-user-config` plus explicit `-c` re-injection of what Quorum needs — most control, but more surface to maintain against a CLI that ships weekly.
**Why:** Found by Q-0001 on 2026-08-22. Every model alias the templates shipped (`gpt-5`, `gpt-5-codex`, `gpt-5.1-codex`, `gpt-5.1`, `gpt-5.2`, `gpt-5.2-codex`) is rejected on a ChatGPT subscription with *"model is not supported when using Codex with a ChatGPT account"* — model availability differs between API keys and subscriptions, and BYOS means only the subscription set exists for us. Worse, the machine's `config.toml` pin overrode Quorum even when it passed no `-m`, so a run's behaviour depended on the developer's personal CLI config rather than on the versioned flow file. Pinning names in templates is a standing liability: they go stale, and every cold-clone adopter inherits the breakage. The same investigation found a role's `model: opus` leaking into a codex step, sending an Anthropic alias to Codex.
**Cost accepted:** MCP servers and sandbox preferences in `~/.codex/config.toml` do not apply inside a run.

## check() proves presence; only `adapters --probe` proves login — 2026-08-22
**Decision:** `check()` stays cheap: it refuses on an API key and confirms the binary runs, and it says out loud that logins are unverified. `harness adapters --probe` performs the smallest possible authenticated request per adapter and reports round-trip, cost and tokens; `--json` emits the report. Recognised auth and model-availability failures are translated into one actionable sentence by `authError()`, which lives at the contract layer so contributor adapters inherit it.
**Alternatives considered:** Make `check()` itself authenticate — honest, but it would put a paid request behind every `board`, `run` and `lint`; trust the vendors' own status commands — rejected, `codex login status` reported "Logged in using ChatGPT" while the refresh token was dead.
**Why:** Q-0001's first real run failed several seconds in on an expired Codex login that `check()` had reported ✓ minutes earlier, after the parallel Claude step had already been paid for. Two green ticks followed by a vendor stack trace is the worst possible cold-clone experience. Separating "is it installed" from "does it answer" makes the expensive check explicit and available before a real run.

## Cost and duration per stage, measured — 2026-08-22
**Decision:** Cost is recorded per step in the ticket's `runs.log` and rolled up per run into `ticket.md`'s `history`, taken from each vendor's own reporting and never estimated. Where a vendor reports no cost the roll-up is understated rather than guessed, and the tokens are recorded instead. First measurement, `requirements` on Q-0006 with real CLIs on subscription auth:

| Step | Adapter / model | Cost | Wall clock | Notes |
| --- | --- | --- | --- | --- |
| `pm-claude` | claude / opus | $2.2056 | 408s | 19 turns |
| `pm-codex` | codex / CLI default | not reported | 122s | 71600 in (38400 cached), 4218 out |
| `head-of-product` | claude / opus | $1.9407 | 363s | 13 turns |
| **run total** | | **$4.146** | **~13 min** | PMs run in parallel, so wall ≈ 408 + 363 |

An `adapters --probe` round-trip costs about $0.39 on Claude even in an empty directory, because the CLI's own system prompt and tool definitions dominate a hello-world request.

**Alternatives considered:** Price Codex tokens locally against a published rate table so every run shows one comparable number — rejected for now: the table goes stale silently, and on a subscription the marginal cost of a run genuinely is not a dollar figure. Q-0003 (tokens-only vs priced) stays open with this as its evidence.

**Why:** M0 requires cost per stage on the record, and a measured number changes two things. First, the roll-up in `ticket.md` is vendor-blind by construction — $4.146 is the *Claude* cost of that run, not its total, and any UI showing it must say so. Second, and more awkward: `requirements` is the cheapest of the seven stages and it took thirteen minutes. Seven stages cannot fit the cold-clone test's thirty minutes, so either the README's first-run path covers one stage rather than the full SDLC, or the test's premise changes. That is a v1 scoping decision and is deliberately not taken here — but it is now a measured constraint rather than a guess, and it should be settled before M6 writes the README.

## M0 closed: the adapters work, but nothing about them was where the risk was — 2026-08-22
**Decision:** M0 is complete. Both adapters run on subscription auth, one real ticket (Q-0006) travelled `draft → requirements → solutioned` on real Claude Code and Codex CLI, the adapter contract's verification table is filled in, and cost per stage is on the record. The spike is trusted enough to port to `packages/core` in M2. Two things found here change M1 before it starts, and are recorded as such below rather than as separate decisions.

**What the milestone was for, and what it found.** M0 existed to answer one question: can subscription-authed CLIs return structured output reliably enough to chain stages? The answer is an unambiguous yes, and it stopped being interesting almost immediately. `claude -p --json-schema` returned a 28,080-byte markdown document intact — no truncation, no escaping damage — and the trailing-JSON fallback in the adapter never fired once. The 2–4 KB worry in `docs/03-adapter-contract.md` was unfounded.

Everything expensive was somewhere else, and every one of these would have hit the first stranger who cloned the repo:

- Every Codex model alias the templates shipped (`gpt-5` in five flow steps and three roles) is **rejected on a ChatGPT subscription**. Model availability differs between API keys and subscriptions; BYOS means only the subscription set exists for us. Templates now pin no vendor model at all.
- The machine's `~/.codex/config.toml` **outranked the flow file**, applying its model pin even when Quorum passed no `-m`. A run's behaviour depended on the developer's personal CLI config rather than on the versioned flow.
- A role's default model **leaked across vendors**, sending `-m opus` to Codex.
- `check()` reported ✓ on a **login that was already dead**, and `codex login status` agreed with it. Two green ticks followed by a vendor stack trace several minutes into a paid run is the worst possible first impression.
- **Both vendors report failures on stdout, not stderr** — Codex as JSONL with the vendor's error nested inside `message`, Claude inside the JSON envelope (and it can set `is_error` while exiting 0). Reading stderr alone printed `exited 1:` and nothing, which is what made the model problem invisible for an hour.
- Claude's `usage.input_tokens` **excludes cache traffic**, under-reporting by three orders of magnitude (65 tokens against a real $0.39). Cost was always right; tokens were fiction.
- A failed step's cost was **dropped from the roll-up entirely** — one crashed review hid $4.54 of a $10.25 run. Failure is exactly when you most want to know what you spent.

**What this says about the product.** The engine's safety properties held under real failure: stages never advanced on a failed run, the user's working tree was never touched, bounded loops stopped where they were told to, and counters survived a crash. The cross-vendor thesis was demonstrated rather than asserted — in solutioning round 2 the architect widened the *shipped* starter template's backend role to Quorum's own layout, which `harness init` would have copied into every adopter's repo; the reviewer on the other vendor caught it, cited the product-agnostic decision by date, and the next round reverted it. That is the entire product in one exchange.

The multi-vendor review loop is also **expensive and does not converge**: 4 blockers, then 5, then 4 across three rounds, at roughly $3–4 and 13 minutes per reviewer pass, never reaching `approve`. What worked instead was consolidating both reviews into one input and running the architect alone — $0 and two minutes on Codex against $10 and 42 minutes for the loop, producing a draft that addressed every outstanding blocker. Reviewer rounds are for finding problems; they are a bad way to fix them.

**Two findings that reach into M1.**

1. **A contract is only as good as the repo's ability to execute it.** Solutioning emitted seven contracts, and the YAML flow fixture is genuinely checkable (deep-equal via the `yaml` dependency) — but the two JSON Schemas are documentation, because `spike` depends on `yaml` alone and `checkAgainstSchema` handles required keys and enums only. qa-red cannot write a failing test against a schema nothing can run, which makes the red phase a hope rather than a mechanism. Before M1: either add a validator to `spike` with the one-line justification the engineering rules require, or stop emitting JSON Schema for contracts and emit something the repo can check. This is the milestone's deepest finding and it is not about adapters at all.
2. **Q-0006 is a poor M1 fan-out demo.** Its `tasks.yaml` is four tasks, one role, four serial waves, single vendor — because the work is inherently sequential surgery on `spike/src/engine.js`, and the architect serialized honestly rather than faking parallelism after an earlier round caught it claiming disjoint ownership it did not have. M1's done-when asks for "two roles on two vendors fan out into worktrees". Either pick a different M1 ticket with real frontend/backend separation, or amend the criterion. Deciding this before M1 starts is cheaper than discovering it mid-milestone.

**Cost of the milestone.** About $18.28 and roughly 90 minutes of agent time for one ticket through two stages, of which $10.25 bought a failed run. The per-ticket roll-up reads $8.03, because Codex reports no cost and the crashed run predates the billing fix. Two consequences: any UI showing a roll-up must say which vendors it can see, and `requirements` — the cheapest of seven stages — takes 13 minutes, so the cold-clone test's thirty-minute promise cannot cover the full SDLC. That scoping decision is still open and belongs before M6 writes the README.

**Alternatives considered:** Closing M0 without the two forward-looking findings and letting M1 discover them — rejected: both change what M1 should do on its first day, and the plan's own instruction is "if M0 or M1 surprises you, stop and rethink before M2". Re-running solutioning until the reviewer approved — rejected on evidence: three rounds showed no convergence and the loop was consuming roughly $4 per pass to generate new findings rather than close old ones.

## Codex cost is reported as tokens, never priced locally — 2026-08-22
**Decision:** Quorum reports what each vendor reports and never converts one into the other. Claude Code's `total_cost_usd` is recorded as money; Codex's token counts are recorded as tokens, with cost `null`. No rate table ships with the product. Wherever an unpriced step contributes to a roll-up, the roll-up says so — a null cost is displayed as `n/a` beside its token count, never rounded to `$0.000`, and a run or ticket total states how many of its steps had no price. Q-0003.
**Alternatives considered:** (a) Price Codex tokens against a bundled rate table so every run shows one comparable number — rejected: the table is wrong the moment a vendor changes pricing and nothing in an offline, local-first tool would notice, so the product would confidently display fabricated money; the failure is silent and the number looks authoritative, which is the worst combination. (b) Let the user supply their own rates in `harness.yaml` — deferred, not rejected: it keeps the fabrication out of the product and puts the assumption where its owner can see it, but it is configuration nobody needs before there is a budget feature to spend it on. Revisit when budget caps land before M3.
**Why:** BYOS makes the premise false, not just the arithmetic. On a subscription the marginal cost of a run genuinely is not a dollar figure — the user already paid, and what a run consumes is quota, not money. Pricing those tokens would invent a number that corresponds to nothing the user is charged. The honest asymmetry is also more useful: "Claude $3.89, Codex 226k tokens" tells a maintainer what to tune, while a blended "$6.10" hides which vendor is expensive and is wrong besides.

The cost of this decision is that no single number describes a multi-vendor run, and the product must resist inventing one — including in M3's mission control, where a cost ticker is exactly the kind of feature that would quietly paper over the gap. `docs/06-development-plan.md`'s "per-run/per-vendor cost & token roll-ups" for v1 should be read as literally per-vendor.
