# Decisions — Quorum

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
**Amended 2026-08-25:** the budget half of this was never built. Nothing in the engine reads
`budget.per_run_usd` or `budget.per_ticket_usd`; a $13.86 step and a $22.27 run passed a cap of 10
untouched on Q-0035. Exhausted loops do land on a human gate, as decided; exceeded budgets do not,
because nothing measures them. See "Q-0035 accepted: a check that skips its subject must not report
success" (2026-08-25), which found it, and Q-0038, which carries it.

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

## Contracts are executable: ajv in the toolchain, `harness validate` in the flows — 2026-08-22
**Decision:** The repository can execute the contracts solutioning emits. `spike` takes two dependencies — `ajv` (JSON Schema draft 2020-12 validator) and `ajv-formats` — and gains `src/contracts.js` plus a `harness validate <schema.json> <file…>` command that exits non-zero on a violation, so a qa-red `type: script` step turns a contract into a failing test. This is deliberately **separate from** `checkAgainstSchema()` in `adapters/`, which stays minimal: that one guards vendor output and must tolerate variance between CLIs, while a contract that bends is not a contract.
**Dependency justification (engineering rules):** `ajv` is the reference JSON Schema implementation and the only serious option for draft 2020-12; `ajv-formats` because contracts use `format: date-time` and ajv ignores unknown formats by default — a contract declaring a check nobody performs is worse than one declaring nothing.
**Alternatives considered:** (a) Hand-roll a fuller validator to keep the dependency count at one — rejected: `oneOf`, `if/then`, `format` and nested `required` all appear in the contracts already emitted, and reimplementing JSON Schema is exactly the kind of work the "small, boring, proven libraries" rule exists to prevent. (b) Stop emitting JSON Schema and have solutioning produce only artifacts the repo can already check — rejected: it would trade a tractable tooling gap for a permanently weaker contract language, and the schemas the architect produced are good.
**Why:** Found by M0. Solutioning emitted seven contracts for Q-0006, of which only the YAML flow fixture was executable — the two JSON Schemas were documentation, because `spike` depended on `yaml` alone. That makes the SDLC's central mechanism a hope: qa-red is supposed to write tests that compile against contracts and fail on assertions, and it cannot fail on a schema nothing can run. The gap was invisible until a reviewer traced it, which is itself the argument for closing it before M1 rather than during.

**Verified on the real artifacts, not a fixture:** Q-0006's committed `ticket-review-state.schema.json` validates the committed Q-0006 ticket, and rejects malformed history with precise errors across `oneOf`, `if/then`, `format: date-time` and nested `required`. A note for the record: an earlier reading of that schema in this milestone called it permissive enough that an empty history entry would pass. That reading was wrong — it inspected the outer `items` object and never descended into the `oneOf` branches where the constraints live. The architect's schema was stricter than it was credited for.

## `retry` at an exhaustion gate authorises exactly one more traversal — 2026-08-22
**Decision:** Answering `retry` at an exhaustion gate sets **that loop's** counter to `max_iterations`, so the retry's own `goto` is the single authorised traversal and the next failure re-presents the gate. No other counter is touched, and the grant is recorded in `runs.log` as `gate=retry counter=<name> set=<n>`. For the shipped review flow (`max_iterations: 3`) a retry persists `3`; the traversal it triggers is the fourth and last, and a further rejection lands back on the gate.
**Alternatives considered:** (a) Persist `max_iterations - 1`, proposed by the Q-0006 round-2 review — off by one: the retry's own regression is a traversal, so the following rejection increments to `max_iterations` and regresses *again*, granting two. (b) The behaviour actually shipped, `ctx.counters = {}` — worse in two ways: it granted `max_iterations + 1` further traversals, and it wiped every counter on the ticket, so a review retry silently refunded a `qa` budget the ticket had already spent. (c) A separate `grace` field in the flow file — more explicit, but a second number to keep consistent with `max_iterations` and nothing yet needs the two to differ.
**Why:** AC-18 of Q-0006's requirement says retry "authorises exactly one more traversal", and three sources disagreed about what that meant: the requirement, `contracts/Q-0006/review-runtime.contract.md`, and the scenarios QA wrote. The engine settled it — traced against `handleFail` and `runGate`, only `max_iterations` yields exactly one. The Q-0006 reviewer caught this in round 4 and, notably, corrected its own round-2 recommendation to get there.

**Contract erratum, not a silent override.** `review-runtime.contract.md` says `max_iterations - 1`, and the contracts are frozen — every task in `tasks.yaml` forbids editing `contracts/Q-0006/**`. Letting QA's test assert `max_iterations` against a contract saying otherwise would mean a test quietly outvoting a contract, which is exactly the failure the frozen-contract rule exists to prevent. The amendment is therefore explicit: `backlog/Q-0006-…/solution/errata.md`, dated, naming the superseded clause, referenced from the ticket. Development implements the erratum; the contract file itself is corrected by whichever ticket next opens it legitimately.

## "Red for the right reason" is an engine property, not a role property — 2026-08-22
**Decision:** Q-0004's remit is retired as written. The `automation-qa` role ships unchanged; a trustworthy red phase is guaranteed by invariants in the engine, not by prompt-tuning. Four are now enforced by `integrate`: dependencies are installed in the worktree before the test command runs; a suite that could not start is rejected rather than counted as red; the ticket branch is synced to `repo.base_branch` first; and every terminal outcome — completed, regressed, failed, interrupted — is written to `runs.log` with its counters persisted.
**Alternatives considered:** Tune the QA role's prompt until its tests fail for the right reason, which is what the milestone plan assumed the work would be. Six runs on a real ticket produced no evidence the role was ever at fault, and every defect found was in the engine underneath it.
**Why:** M1's plan says "tune the automation-qa role until red is 'for the right reason'". The role never needed tuning. Six engine defects did, each of which made a false red either possible or unavoidable:

1. A worktree is a fresh checkout with no `node_modules`, so the test command died on a missing dependency — and `expect: fail` read exit 1 as proof of red. **Every ticket would have proved red this way, forever.**
2. Non-zero exit was accepted as evidence a suite ran. It is not.
3. Ticket branches never caught up with their base. Q-0006's integration branch was five commits stale, so QA worked against a tree without `ajv` or `test/run.js` and appeared to revert both.
4. Ctrl-C at a gate wrote no outcome and no counters, silently refunding the iteration budget — an undocumented route to unlimited retries.
5. `retry` cleared *every* counter on the ticket and granted `max_iterations + 1` further traversals instead of one.
6. The guard added for (2) was then defeated by its own test: a suite that asserts "a broken environment is not a red phase" prints that signature in a pass message, and the detector matched it, throwing away a genuine red phase.

The last one is the useful one to remember. A detector that reads raw output cannot distinguish a crash from a test *quoting* a crash, so it now ignores anything on a line that reports a result — a line reporting a result is proof the suite ran, and therefore cannot be proof it never started.

**Evidence the mechanism now works:** Q-0006 run 6 produced seven assertion failures named by acceptance criterion (`AC-15: lint rejects prefixed counter`, `AC-16: lint rejects max_iterations 0`, …) from two test files, against executable contracts, on a synced branch with dependencies installed. That is the red phase M1 exists to prove, and it took no change to any role.

## Ticket size is the dominant cost driver — 2026-08-22
**Decision:** A ticket should carry roughly ten independently testable acceptance criteria, and no more than about fifteen. A requirement larger than that is split before solutioning, not carried forward. The shipped `head-of-product` role — the judge that decides whether a requirement is ready — is instructed to say so and propose the split rather than approve an oversized requirement, because the cost is invisible at the requirements gate and compounds at every stage after it.
**Alternatives considered:** (a) Leave sizing to the human at the gate — it is already their call and it did not work: Q-0006's size was raised at its requirements gate, approved anyway because the document was excellent, and every later stage paid for it. The gate shows you quality, not future cost. (b) Enforce a hard cap in the flow linter — rejected: the count is a judgement about scope, not a property of the file, and a linter that fails on "16 criteria" would be gamed by merging two criteria into one sentence.
**Why:** Q-0006 shipped 30 acceptance criteria and cost roughly $24 and most of a day to reach `solutioned`, without a line of it being implemented. It hit its iteration bound at **every** stage: requirements looped once, solutioning exhausted twice and needed an out-of-band architect pass, qa-red exhausted once. Two independent reviewers, on two vendors, produced four or five blockers per round and never converged — not because either was wrong, but because 30 criteria give a careful reviewer an inexhaustible supply of real defects to find.

Every mechanism in this product behaves well at small scope and thrashes at large: bounded loops exhaust, cross-vendor review never converges, contracts accumulate contradictions faster than a round can resolve them, and the fan-out serialises because a large ticket's tasks inevitably share files. None of these are bugs. They are the design working as intended on an input it should never have been given.

The corollary for the cold-clone test: a newcomer's first ticket must be small, or their first impression of Quorum is a $20 loop that never converges. That is a README concern as much as a template one.

## Step-output validation is Quorum's contract with its own agents — 2026-08-22
**Decision:** Three validations exist and must not be confused. (1) `checkAgainstSchema` in `adapters/index.js` checks an agent's structured output against `schemaFor(step)` — the schema *Quorum itself generated from the flow file* — and may enforce it strictly: enum membership, required keys, and the couplings a flow declares, such as an `approve` verdict carrying no findings. (2) `contracts.js` validates artifacts against solutioning's contracts with ajv, fully strict. (3) Tolerance for how a vendor wraps its answer lives in `extractJson` and the adapters, which is where vendor variance actually happens. `spike/src/adapters/index.js` is therefore in scope for the ticket that changes step-output rules, and Q-0006's runtime task now owns it.
**Alternatives considered:** (a) Keep `checkAgainstSchema` minimal and move verdict/findings enforcement into the engine — defensible, but it splits one question ("does this output match what the flow asked for?") across two files and leaves the adapter layer accepting output it knows is wrong. (b) Reuse ajv for step output too — possible now that it is a dependency, but `schemaFor` emits a handful of shapes and a targeted check gives better error messages to the run that has to stop.
**Why:** The original comment on `checkAgainstSchema` reads "Not a full validator on purpose", and that rationale was vendor tolerance. It conflated two things. A vendor may legitimately wrap its answer in ways we cannot predict — that is `extractJson`'s problem. But once parsed, the object either matches the schema Quorum wrote or it does not, and accepting `verdict: "approve"` alongside a list of blockers is not tolerance, it is a routing bug: the engine advances a ticket on a verdict its own findings contradict.

Found by the Q-0006 reviewer, which noted that no task owned the file the red tests needed and that approving them "narrows the DECISIONS position that checkAgainstSchema stays minimal — decide it explicitly". Round 2 approved the scenarios without the ownership question being settled, because task ownership is a solutioning artifact and the scenario gate does not look at it. **A gate only catches what it is pointed at** — worth remembering when adding gates.

## Product-level schema annotations select semantic validation — 2026-08-23
**Decision:** After ordinary JSON Schema validation, `harness validate` may select a named
product-level semantic pass through `x-quorum-contract`. The first recognised value is
`run-manifest-v1`, whose pass checks lifecycle and occurrence invariants and exactly recomputes
the per-vendor roll-up. Missing or unknown annotations explicitly report that semantic checks
were skipped; they never imply run-manifest validation. The parser and JSON Schema behaviour
remain generic, and no JSONL/event-stream capability is introduced by Q-0011.
**Alternatives considered:** Encode every invariant in JSON Schema — rejected because exact
grouped roll-up recomputation, including the distinction between an unreported `null` and a
reported zero, is not structural validation. Select checks by schema filename or `$id` — rejected
because both couple behaviour to storage location or ticket-specific identity rather than a
versioned product contract.
**Why:** A manifest can be structurally valid while disagreeing with its persisted occurrence
usage. An explicit annotation makes the extra executable contract reviewable and lets generic
schemas retain their existing behaviour.

## Every file a red test requires must be owned by exactly one task — 2026-08-23
**Decision:** A solution's `tasks.yaml` must cover, between its tasks, every file the red suite requires changed. A scenario whose only possible fix lies in a file no task owns is not a valid red test and must be rejected at the qa-red gate, not discovered by a development loop. Two consequences are binding: the architect states file ownership in each task's `description` (the only field the fan-out actually forwards), and the `automation-qa` role may not write a scenario that requires editing `spike/test/**` or any other file the development tasks are forbidden to touch — a test that development may not change can only be satisfied by qa-red itself.
**Alternatives considered:** (a) Let the development loop discover it — that is what happens today and it cannot work: the agents correctly report "my assigned scenarios pass, I have no changes to make", the integrate step fails on someone else's file, and the loop burns its whole budget. Q-0033 spent three iterations and 40 minutes this way; Q-0006 spent a solutioning round on the same thing. (b) Give every developer role write access to everything — removes the boundary that makes parallel fan-out safe, and invites two vendors to edit the same file in the same wave.
**Why:** Three failures ended Q-0033's development loop, and all three were in files neither task owned — `spike/test/smoke.js` twice and `spike/src/adapters/mock.js` once. One of them was structurally impossible: a scenario asserting that `smoke.js` contains a particular call, when every task carries "Do not modify tests". No number of iterations could close that, and nothing in the flow could tell the difference between "the agents are failing" and "the agents are being asked for something they may not do".

This is the third appearance of one pattern: a loop spending its budget on work no agent in it can perform. The other two were the base-sync conflict and the hung test command, both fixed by stopping instead of retrying. This one is caught earlier — at the gate that approves the failing suite, where the reviewer already reasons about ownership when asked.

## Tasks are small; the fan-out is the unit of parallelism, not of scope — 2026-08-23
**Decision:** A solution decomposes into many small tasks rather than a few large ones. A task should touch one coherent file set, be describable in a sentence, and be independently completable — "add `--gate-answer`", "extract the lint rules into `spike/src/lint.js`", "ship `review.yaml` and its template copy". Where tasks are genuinely independent they declare `depends_on: []` and run in one wave; serialising is a statement that they share files, and sharing files is a reason to look for a better cut.
**Alternatives considered:** Fewer, larger tasks that mirror the solution's sections — which is what Q-0006, Q-0033 and Q-0011 all produced. It reads tidily in the solution document and behaves badly in the fan-out: each agent carries the whole ticket in context, ownership is stated at a grain too coarse to check, and a single failure anywhere sends every task back round.
**Why:** Ruud's observation, 2026-08-23, after watching Q-0033's two tasks exhaust their loop: real work divides into several small pieces, and the smaller piece is also the better prompt. Both halves are true here. A tightly scoped task gives its agent a context in which almost everything is relevant, and it makes ownership gaps obvious — a task that owns nothing the failing test touches stands out immediately, where a task owning "the CLI, the lint rules and the config" does not.

The cost is more agent invocations. On subscription auth that is close to free for the vendors that report tokens only, and it buys shorter prompts, clearer ownership and genuine parallelism. Against that, the two tickets that serialised into single-vendor waves did so because their tasks were coarse enough to overlap on files — so granularity is also what makes the multi-vendor fan-out possible at all.

## A red test is a permanent acceptance test; phase-bound facts are evidence — 2026-08-23
**Decision:** Every test qa-red writes must be red before the feature exists, green once it does, and green from then on. A fact that is true only during the red phase is **evidence**, not a test: it is checked once by `prove-red`, recorded in `qa/red-integration.md`, and never persisted as an assertion. `automation-qa` applies the test before writing a scenario — *will this still pass when the feature is done?* — and `scenario-review` checks it first, before coverage or rigour, because it is the failure that costs a whole round to discover.
**Alternatives considered:** (a) Catch it in review, which is what happens today. The reviewer has caught every instance, but always on the second or third round, at roughly $7 a round — the detection works and the timing does not. (b) Lint the test file for assertions about branch state, merge-base or the absence of files the tasks will create. Narrow, and the general rule ("do not assert on the branch you are running from") is easy to state and hard to check mechanically; a linter here would give false confidence. (c) Let development delete offending tests — rejected outright: `spike/test/**` is qa-red's artifact, and a developer who can edit the tests judging it can make anything green.
**Why:** Three tickets have now produced a red that could never go green, and the class was invisible until a human traced why a loop exhausted.

- Q-0033 S11.1–S11.4 asserted that `spike/test/smoke.js` contains a particular call, while every development task carries "Do not modify tests".
- Q-0033 E8 asserts the integration branch's diff since merge-base contains only contracts and tests — exactly right during red, guaranteed false the moment the five tasks commit. It exists because an earlier review round demanded branch-cleanliness *evidence* and QA had nowhere to put evidence except an assertion.
- Q-0011 and Q-0006 both lost a development loop to tests whose only fix lay in a file no task owned, which the ownership decision of the same date addresses from the other side.

The two rules are complements. Ownership asks *can anyone fix this?*; this one asks *will the fix still hold?* A scenario needs both answers to be yes, and the second one has no owner today.

**The missing slot is part of the fix.** QA smuggled evidence into an assertion because the flow gave it no other home. `prove-red` records the merge-base diff and the branch state in `qa/red-integration.md` as evidence, and a scenario that wants to depend on that fact cites the report instead of re-deriving it.

## Do not drive harness-machinery work through the harness — 2026-08-23
**Decision:** A ticket that changes the gate, lint, test-runner or CLI machinery the flows themselves depend on is not a good candidate for the full SDLC on that same machinery. Prefer hand-written acceptance tests, a smaller cut, or a stage run manually — and if it does go through the flows, its acceptance tests must not assert on the machinery's current behaviour, only on the behaviour it will have.
**Alternatives considered:** Keep dogfooding everything uniformly, which is the honest default and produced Q-0006's and Q-0011's best findings. It stops paying when the ticket's subject is the harness's own reflexes.
**Why:** Q-0033 changes gate answering, the flow lint and the CLI that runs the suite. Its acceptance tests therefore run *through* the thing being changed, and every round produced a fresh collision between a test asserting today's behaviour and a criterion demanding tomorrow's — the smoke.js/`--gate-answer` contradiction, the branch-cleanliness assertion, the lint-output comparison. Five qa-red attempts and roughly $49 without a usable red, against Q-0006 and Q-0011 which each converged in two rounds on subject matter that sat *beside* the machinery rather than inside it.

This is not an argument against dogfooding — it is the strongest evidence for it, since the flows found their own reflexive blind spot. It is an argument for noticing when a ticket's subject is the instrument, and adjusting the method rather than paying for another round.

## Cross-flow regression uses a derived regression target — 2026-08-23
**Decision**: For `goto: flow:<target>`, the engine derives the regression stage from the target flow's declared `consumes` stage. The shipped review rejection names `flow:development`, so it moves a ticket from `green` to `red`; it does not hard-code a stage or run the target flow immediately. Whole-directory lint proves that the target exists and that its produced-stage return chain reaches the source flow's consumed stage.
**Alternatives considered**: Hard-code `red` in the review flow or engine (duplicates the development flow's contract and can drift); regress to `green` and treat review as a self-loop (leaves the ticket at a stage the development flow cannot consume); run development immediately (collapses two independently runnable, human-visible flows into hidden orchestration).
**Why**: The flow graph is the versioned source of truth. Deriving the stage keeps routing consistent with the named target and makes renamed or broken return paths detectable before a run writes the ticket or calls an adapter.

## Non-auto exhaustion gates require an explicit human or scripted answer — 2026-08-23
**Decision**: A bounded loop that exhausts presents an engine gate that `--auto` cannot bypass. A script supplies ordered, full-word `--gate-answer advance|retry|abort` values; after those are consumed, only a TTY may prompt. Missing, empty, invalid, unavailable, or disallowed answers fail without inventing a decision. This engine-presented exhaustion gate is distinct from an author-declared `human-locked` deploy gate even though both use the gate mechanism.
**Alternatives considered**: Let `--auto` advance at exhaustion (silently converts a safety bound into permission); default missing non-interactive input to `advance` (makes an absent answer indistinguishable from approval); always abort (safe but prevents an operator from granting the documented single retry or accepting the result).
**Why**: Exhaustion means the configured automation policy has run out of authority. Continuing, retrying, or aborting materially changes ticket state, so each choice must be attributable to an explicit answer and automation may never infer one.

## M1 closed: the mechanisms hold; what fails is scope, ownership and evidence — 2026-08-24
**Decision:** M1 is complete. Red is proven by a `type: integrate` step with `expect: fail` on three real tickets, a five-task fan-out across two vendors reached green in three iterations, and the review flow ran end to end — a Claude + Codex panel, a `changes-requested` verdict, and a cross-flow `goto: flow:development` that regressed a ticket from `green` back to `red`. The full circuit closed once: development → review → regression → development → green. The contracts-before-tests mechanism and multi-vendor worktree integration are retired as risks.

**What the milestone was for, and what it found.** M1 existed to test whether contracts could carry a red phase and whether two vendors could integrate work in parallel. Both answered yes, and both stopped being interesting quickly. Every expensive lesson was about something else: **how big a unit of work is, who owns which file, and whether a step's evidence actually arrived.**

**The deepest finding is the empty diff.** Q-0006's review spent $5.02 of Claude cost, plus an unpriced Codex reviewer, on a diff that did not exist — `main...harness/Q-0006/integration` resolved to nothing, because the branch had been merged into `main` hours earlier. `materialiseDiff` embedded the emptiness without noticing, and the flow would have advanced on the verdict. The panel then produced eleven substantive findings *anyway*, by reading the working tree instead of the evidence handed to it, and three of those findings were verified by hand and were real.

Both halves matter. The reviewers were right; the mechanism that was supposed to make them right was broken. And it stayed invisible **precisely because the agents compensated** — nothing downstream could distinguish evidence that was read from evidence that was never supplied. Any step whose input is technically optional because the agent has repo access carries this hazard, and the review panel will not be the last one. An empty range now fails with a named cause, and the cause is diagnosed rather than reported: *already merged into main, so there is nothing left to review*.

There is a practical corollary the milestone learned the hard way: **review before merging.** Q-0033's own branch cannot be reviewed today, because merging it was how `review.yaml` reached `main` so that Q-0006 could be reviewed at all. Getting the flow into place consumed the diff the flow needed.

**Three recurring shapes, now named.** Each was found more than once, in unrelated places:

1. *A loop spending its budget on work no agent in it can perform.* Four instances: a hung test command, a base conflict at integrate, a base conflict before fan-out, and tests whose only fix lay in a file no task owned. The remedy is identical every time — stop and name the work a human must do, rather than retrying. Two decisions of 2026-08-23 close it from both sides: every file a red test requires must be owned by exactly one task, and a red test must still be green after the feature exists.
2. *State outliving the run that created it.* Abandoned merges contaminating an integration branch, `retry` refunding counters it never spent, task branches surviving a rollback that restored the ticket branch, and two runs holding the same ticket at once. `retry` was fixed on 2026-08-22 and `finish()` now rolls the ticket branch back; the remaining two — task branches surviving a rollback, and no lock on a ticket — are open below.
3. *A failure that withholds the one thing the reader needs.* `exited 1:` with nothing after it, `could not sync base:` with no reason, unbilled failed steps, untraced interrupts, an `IntegrationError` printing a raw stack while a `FlowError` printed a sentence. All fixed, and the pattern is now the first thing to check when a run is confusing.

**Task size is what made the fan-out work.** Q-0006 serialised into single-vendor waves, because its two tasks share `spike/src/engine.js` and one depends on the other. Q-0011 did span two vendors in a single wave — two tasks, `backend` on codex and `tooling` on claude, both `depends_on: []` — but at a grain too coarse to retry independently, so a failure anywhere sent both back. Q-0033 re-cut into five small tasks ran as one wave across two vendors, reached green in three iterations, and scoped its retries to the tasks that were actually failing — and its retries scoped correctly, with finished tasks reporting "no changes" instead of inventing work. The two-roles-two-vendors criterion was not met by adding a role; it was met by making the tasks smaller.

**Cost.** About $165 in billed Claude cost across the three tickets, summed from `runs.log` — Q-0006 $33.74, Q-0011 $65.42, Q-0033 $66.06 — plus tens of millions of Codex tokens no roll-up can price. Of Q-0033's total, $40.88 went on six qa-red attempts that never produced a usable red, which is what the "do not drive harness-machinery work through the harness" decision exists to prevent next time (this supersedes the five-attempt, $49 figure recorded on 2026-08-23; the sixth attempt and a recount produced these).

One number here needs care. Q-0006's `ticket.md` roll-up reads **$22.15**, not $33.74, because four runs that failed or were interrupted never reached its `history`. `runs.log` has them. The roll-up is therefore still understating, in a different place from the failed-*step* defect M0 fixed — whole failed *runs* are missing from the per-ticket history, and every figure above is the `runs.log` sum for that reason. Any UI reading `history` inherits the same gap.

**Open, and carried into M2:**
- **The engine has no lock on a ticket.** Two runs overlapped twice tonight; the second time one run's rollback moved a branch another live run was holding. Benign both times by luck. M3's daemon makes concurrent runs normal rather than accidental, so this wants fixing before it, not after.
- **A review backward edge has no red phase.** It skips `qa-red` and lands on `development`, where `integrate --expect pass` is satisfied by a suite that was already passing. Nothing turns review findings into failing tests, so the loop's green proves the agents ran, not that they fixed anything. The three findings that mattered were checked by hand.
- **`finish()` does not roll back task branches**, so a failed run leaves work that the next run syncs into.
- **`harness run` cannot aim a diff at anything but `{base}...integration`**, which is why a merged ticket cannot be reviewed. A `--base <ref>` flag is the small fix.
- The M0 question is still open and now more urgent: **seven stages at ten-plus minutes each cannot fit the cold-clone test's thirty minutes.** It belongs before M6 writes the README.

**Alternatives considered:** Closing M1 on the three done-when criteria alone and leaving the empty-diff finding to M2 — rejected, because the finding is about whether any gate's evidence can be trusted, which is the product's core claim, and because the fix was twenty minutes. Running a second review round on Q-0033 before closing — rejected tonight: its branch is already merged, so it has no diff to review, and manufacturing one needs the `--base` flag above rather than a 2am edit to the shipped flow file.

## A chore flow for machinery and configuration work — 2026-08-24
**Decision:** The full SDLC — solutioning's contracts, qa-red's failing suite, the development fan-out — is reserved for feature work against a harness that is already stable. Machinery and configuration tickets take a shorter route: **requirements → chore → human gate**. `chore.yaml` consumes `requirements` and produces `reviewed`; it runs one implementer in its own worktree, then a cross-vendor review with a bounded revise loop back to the implementer, then an `integrate` step that merges to the ticket branch and must pass the repository's test command, then a human gate. It keeps `cross_vendor: required` and keeps every gate, and it drops only the two things a scaffold cannot supply: a contract to code against and a test that can be red before the work exists. First applied to Q-0008 (monorepo scaffold + CI); it is the default for Q-0009–Q-0012 as well, and a ticket that wants the full SDLC instead says so in its body.
**Refines:** "One flow per SDLC stage, chained by backlog state" (2026-08-21), whose "seven stages,
seven templates" this breaks in two ways: `chore` is a second flow consuming `requirements` and a second
flow producing `reviewed`, and it produces a stage three steps later rather than the next one. The
consumes/produces mechanism is unchanged; only the one-to-one mapping is.
**Refines:** "Do not drive harness-machinery work through the harness" (2026-08-23), which named the problem and prescribed only "prefer hand-written acceptance tests, a smaller cut, or a stage run manually". This entry supplies the missing third option, so the choice is no longer between the full pipeline and no pipeline at all.
**Alternatives considered:** (a) Hand-write the scaffold with no flow at all, which is what 2026-08-23 literally suggests — rejected: it is the milestone whose stated goal is "Quorum develops Quorum", and a ticket that skips the flows entirely produces no runs.log, no cost record and no gate, which is precisely the evidence M2 exists to generate. (b) Run the full SDLC anyway and let qa-red write tests against the scaffold — rejected on measured evidence: Q-0033 spent roughly $41 across six qa-red attempts without ever producing a usable red, because a red test must fail for a reason the feature will fix, and "pnpm-workspace.yaml does not exist yet" is a fact about the repository rather than a behaviour anything can assert. (c) Keep the full flow but let solutioning emit a trivial contract — rejected: a contract nothing can violate is documentation wearing a contract's clothes, and the 2026-08-22 entry on executable contracts exists to stop exactly that.
**Why:** The distinction is not ticket size, it is whether a red phase can exist. Feature work changes behaviour, so a test can fail before it and pass after — that is the whole mechanism, and contracts are what make the failure meaningful. Configuration work changes what the repository *is*: the assertion "the workspace builds" is unfalsifiable until the workspace exists, at which point it is trivially true, so a red phase over a scaffold tests the absence of a file rather than the absence of a behaviour. Q-0033 established that empirically and this entry makes it routable instead of a warning to remember.

What the chore flow deliberately keeps is as important as what it drops. Cross-vendor review survives because a scaffold is exactly the kind of artifact one vendor writes with confident defaults nobody checks — a wrong `moduleResolution` or a silently disabled strict flag propagates into every package ported after it, and it is cheaper to catch at the gate than in Q-0009. The `integrate` step survives because `expect: pass` on the real test command is the only claim worth making about a scaffold, and it is a genuine one.

**Cost accepted, and the one to watch:** a chore ticket produces no contracts, so nothing downstream can validate against its output — Q-0009's port has to trust the scaffold's shape rather than check it. That is tolerable here because the scaffold's shape is asserted by the build itself. The risk to watch is drift in the other direction: "this is just configuration" is an easy thing to say about a ticket that is quietly changing behaviour, and the first time a chore ticket ships a bug the full SDLC would have caught, this entry needs revisiting rather than the flow needing a patch.

## Erratum: M1's closing entry on Q-0006's empty diff — 2026-08-24
**Correction, not a reversal.** The entry "M1 closed: the mechanisms hold; what fails is scope, ownership and evidence" (2026-08-24) states that Q-0006's review panel was handed an empty diff *"because the branch had been merged into `main` hours earlier"*. That explanation does not hold against the repository. `git diff --stat main...harness/Q-0006/integration` reports 45 insertions across `spike/src/engine.js` and `spike/src/adapters/index.js`, and `git branch --merged main` does not list the branch. Either the branch moved after that review, or the cause recorded at the time was diagnosed wrongly and never rechecked.

**What stands unchanged.** Everything the entry concludes *from* the incident: the diff was empty, two vendors were paid $5.02 to review nothing, the flow would have advanced on the verdict, the panel's eleven findings came from reading the working tree rather than the evidence handed to it, and three of them were real. The lesson — that any step whose input is technically optional because the agent has repo access can silently lose its evidence — is untouched. Only the stated cause is wrong.

**Why it is worth correcting rather than leaving.** `materialiseDiff` hard-codes this diagnosis: an empty range throws *"is empty because `<branch>` is already merged into `<base>`, so there is nothing left to review"* whenever `merge-base --is-ancestor` succeeds, and the generic message otherwise. That is good error design and it inherited a conclusion nobody re-derived. If the cause here was something else — a rollback by `finish()`, a branch reset, a range built from the wrong ref — then the engine will keep explaining a class of failure with the one story that was written down. Q-0034 owns re-deriving it and fixing the diagnostic if it is wrong.

**Found by:** tracing why `.quorum/` was absent from the working tree on 2026-08-24. The answer turned out to be that Q-0011 was never merged either, which is Q-0034's main subject; this erratum is the by-product.

## Containment is derived from git on each board invocation, never stored — 2026-08-24
**Decision:** `harness board` answers "where is the code?" for every ticket whose `branch` frontmatter resolves to a local ref, by reading git at the moment of rendering and persisting nothing: no frontmatter field, no cache, no ref moved, every `ticket.md` byte-identical afterwards. The answer is one of three states against the configured base branch — contained, not contained with how many commits ahead, or indeterminate with a reason from a closed set (missing ref, shallow clone, git failed).

Two rules from this ticket are the product's standing rules for reading git ancestry, recorded here so nobody re-derives or "simplifies" them later:

1. **The state is selected from git's own exit codes and from nothing else.** `git merge-base --is-ancestor <branch> <base>` exits 0 → contained; exits 1 → provably not contained; any other exit → indeterminate (git failed). Exit 1 is never inferred from a failure, a timeout or an absent binary — conflating "provably not" with "could not answer" manufactures exactly the confident falsehood this ticket removes.
2. **The shallow asymmetry.** In a shallow repository (`git rev-parse --is-shallow-repository` reports `true`) an exit 0 still reports contained, because ancestry found in the history that is present is real; an exit 1 becomes indeterminate (shallow clone) with no ahead count, because history that is absent cannot disprove ancestry. A shallow clone does not fail — it answers from the history it has — so the implementation must ask rather than wait for an error.

**Alternatives considered:** A `landed:` field in `ticket.md` frontmatter — a copy of a git fact held in mutable state drifts the first time someone merges by hand, and a wrong field is worse than no field because it is believed. A stage after `deployed` — merging would become a flow-advanced transition when merging is a human act outside every flow, and `deployed` belongs to Q-0012. Computing containment once into a cache under `.quorum/` — the same drift with an extra file.
**Why:** Q-0006 and Q-0011 sat unlanded for a day while `harness board` rendered them identically to work that was on `main`; the gap surfaced only because someone went chasing a missing `.quorum/` directory. Stage and containment are different facts — a stage is the ticket's position in the state machine, containment is a relationship between two refs at the moment of reading — and the board now shows both, deriving the second fresh on every invocation so no stored value can go stale. Q-0036.

## Q-0034 closed: an unlanded branch's cost is not its merge conflict — 2026-08-24

**Decision:** Q-0034 is complete. `harness/Q-0006/integration` and `harness/Q-0011/integration` are
contained in `main`, with reconciliation records under `backlog/Q-0034-…/dev/` naming every
retained and reverted behaviour, and a fresh clone of `main` now carries the run-history feature the
docs have described since M1 and passes both CI jobs. Q-0011 was reviewed twice while still
unlanded, as its landing record required. The ticket's other two workstreams shipped as Q-0035
(open) and Q-0036 (landed the same night); Q-0037 holds the review findings that did not block.

**Alternatives considered:** Merging both branches without review, which is what "reconcile the
branches" sounds like and would have cost about twenty minutes — rejected, and the evidence is that
the two review rounds found four blockers and fourteen majors in work already marked `green`.
Re-deriving Q-0011's 48 commits as a fresh change — rejected: M1's closing entry cites several of
those SHAs, and a rebase or re-derivation rewrites evidence the record depends on.

**Why: the expensive thing about an unlanded branch is not the merge.** Both merges were, in the
end, unremarkable — Q-0006's was conflict-free by construction, and Q-0011's seven conflicted hunks
were five plain unions and two judgement calls. What cost money was everything the branches had
quietly stopped being true about:

- Q-0006's branch already contained a `PROBE_SCHEMA` fix, character for character identical to one
  rediscovered and re-paid for hours earlier the same evening. The bug had been found, fixed and
  parked in August.
- Q-0006's `input.diff` range guard demanded exactly `{base}...{integration}`. That was the review
  flow's shape when the guard was written on 2026-08-22. `chore.yaml`, decided on 2026-08-24,
  reviews `integration...implement` — so the guard landed and **broke a flow that did not exist when
  it was written**. Its companion, the run-level diff preflight, refused for a second, independent
  reason: chore's right endpoint is a branch the run itself creates, so it cannot be materialised
  before the first step. Neither is a merge conflict. Git had nothing to report.
- Q-0008 had run the chore flow successfully three hours before the landing, against a
  `materialiseDiff` that carried no guard at all. Nothing regressed; a stale branch simply arrived.

The generalisation is worth keeping: **a branch that sits accumulates semantic conflicts with
everything merged after it, and none of them appear in `git status`.** "Branches rot" understates
it — a rotting branch goes stale, whereas this one landed and actively broke something. The only
reliable detector is running the repository's own flows against the merged result, which is what a
`--dry` run did here for $0, because the `--dry`-must-not-mutate fix and Q-0006's preflight compose:
the preview now validates every diff range while being unable to write anything.

**The best review round was the one that reviewed the previous round's fixes.** Round 1 on Q-0011
returned four blockers, all closed within the hour. Round 2 returned zero blockers and fourteen
majors — and **three of the fourteen were defects in round 1's fixes**, made an hour earlier:

1. The path-traversal fix was lexical only. `path.resolve` does no filesystem work and `statSync`
   follows links, so a single-segment symlink inside `.quorum/runs/` passed every string test and
   still read a manifest anywhere on disk.
2. The AC-1 collision refusal threw after the `start` line was written and the catch rethrew without
   calling `finish()` — re-opening, in new code, the "run that started and then stopped existing"
   gap Q-0004 closed for interrupts. The comment three lines above it asserted the opposite
   invariant.
3. Its error message claimed "another run may be in flight", which `nextRunId` contradicts: ids are
   allocated from the `start` line, written before the directory exists, so a concurrent run takes
   the next id rather than colliding.

Fixes are a high-risk change class and they arrive with the least scrutiny — written under time
pressure, against a finding rather than a requirement, by someone who has just proven they
misunderstood the area. Review the fix round, not only the feature round.

**A frozen artifact can be under-specified rather than wrong.** `runs-cli.contract.md` states both
"zero matches … exit zero" (:12) and "a malformed sibling is named … and the final exit is
non-zero" (:18–19). Both apply to `harness runs Q-9999` against a store containing a corrupt
manifest; nothing said which governs. The implementation and its qa-red scenario read it one way,
both round-2 panellists read it the other, and **neither side was contradicting the contract**. That
is a different failure from Q-0006's E-1, where a contract clause was simply wrong, and it needs the
same instrument: erratum E-4 decides it for store health and re-points the scenario so both clauses
gain coverage, where before only the ambiguous case was tested. The tell for this category is that
both sides can quote the document.

**Two checks that could not answer the question they were asked.** Six branches appeared to hold
content missing from `main`, from `git diff main...<branch>` — a three-dot diff shows what a branch
added since the fork point, and keeps showing it after `main` acquires the same content by another
route. `git cherry` then reported all 25 commits absent, which is true of the *commits* and silent
about whether the *content* arrived. Only comparing the artifacts settled it: the contracts are
byte-identical on `main`, and every other file is larger and later there. This is the same error the
requirement itself made when it read `merge-tree`'s "changed in both" as "conflicts" and reported
five conflicting files where a real merge produces four. **Before trusting a git command as
evidence, state which question it answers.**

**Ticket size, working prospectively for the first time.** Q-0034's requirement came back at
seventeen criteria across three routings and the head-of-product refused it, proposing the split
that became Q-0035 and Q-0036. Q-0036, carved at that recommended size, returned **`ready` on its
first pass with zero findings** — the first first-pass approval this project has produced. The
2026-08-22 sizing decision was written from post-mortems; this is the first evidence of it
preventing the cost rather than explaining it.

**Cost.** About **$46.59** in billed Claude cost across the evening's flow runs — Q-0034's
requirements $7.19, Q-0011's two review rounds $12.60, Q-0036's four runs $26.81 — plus roughly
$3.53 on five `adapters --probe` round-trips and something over a million Codex tokens no roll-up
can price. Landing two branches, closing four blockers and thirteen majors, and shipping one feature
through the full chore flow came to roughly **$50**.

Two numbers inside that deserve naming. Q-0036's chore run reached a green `integrate` and then
**failed**, because a background process cannot answer a human gate — and `finish()` correctly rolled
the ticket branch back, discarding a merge that had just been proven green. $16.85 of completed,
reviewed, tested work became a failed run over an unanswerable prompt. Nothing was lost: the work
survived on its own branch and the merge was re-performed by hand and re-verified. But a gate that
cannot be answered turns a finished run into a failed one, and **M3's daemon must not inherit that**
— it is the difference between "the human has not decided yet" and "the run failed", which the
engine currently cannot express.

**Carried forward:**
- **Q-0035** — the empty-range diagnostic. Deliberately ordered after this ticket so `materialiseDiff`
  was not rewritten from two directions; that ordering already paid off once, when the range guard
  needed changing here.
- **Q-0037** — one major and eight nits from Q-0011's reviews, including the `runGate` timer that
  cannot be removed without editing a frozen qa-red fixture.
- **Q-0011's stage reads `red` while its code is contained in `main`,** because a review backward
  edge regressed it and nothing moved it back. Q-0036's board column now makes the contradiction
  visible rather than silent, which was the most it could honestly do; deciding what a stage means
  after a backward edge belongs to whichever ticket next opens the review flow.
- **The engine still has no lock on a ticket** (open since M1), and a non-interactive gate still has
  no way to say "undecided" rather than "failed". Both want settling before M3's daemon makes
  concurrent and unattended runs ordinary.

## The erratum is closed: the sentence was true, and it was still the wrong sentence — 2026-08-25

**Decision:** *"Erratum: M1's closing entry on Q-0006's empty diff — 2026-08-24"* is closed. The
sentence the engine printed at Q-0006's review run 10 — that `harness/Q-0006/integration` *"is
already merged into"* `main` — **was accurate at the time, in both of its claims**, to the strength
the durable record supports and no further. The ancestry fact held, and so did the historical
event: the branch had genuinely been merged into `main` by a real merge commit, 24 hours and 50
minutes before the run began. What the erratum could not reproduce on 2026-08-24 was an artefact of
the branch having moved *after* that review, not of a wrong diagnosis. M1's closing entry is
therefore right on the substance and wrong only in its interval — it says "hours earlier" where the
record says a day and an hour. The qualification is not decoration: establishing which commits the
run compared is itself an inference from committed history, and the limit of that inference is
stated below rather than glossed.

The engine's message is replaced anyway, and the reasoning is the point of this entry: it was
accurate because the common case happened to be the true one, not because it had the evidence for
what it said. Q-0035 replaces it with the evidence — both endpoints and the short SHA each
resolved to, the containment check verbatim, and that check's outcome as one of `contained`, `not
contained` or `indeterminate` — and with the vocabulary the board settled on 2026-08-24, which says
"contained" and never "merged", "landed" or "shipped".

**The evidence, transcribed rather than prescribed.** Each command is named with the question it
answers, per the lesson Q-0034 recorded as *"before trusting a git command as evidence, state which
question it answers."* Timestamps are `%cI` committer dates in `+02:00`; `runs.log` is UTC, so run
10 spans **2026-08-24 00:58:25 → 01:11:00 +02:00**.

| # | Question | Command | Answer |
| --- | --- | --- | --- |
| 1 | When did run 10 start and end? | `backlog/Q-0006-…/runs.log` | `2026-08-23T22:58:25.691Z run=10 flow=review start stage=green` … `2026-08-23T23:11:00.943Z run=10 regressed stage=green→red cost=5.023` |
| 2 | Where did `main` point during the run? | `git log -1 --format='%p' 3790c04` → `cdec5e9` | `3790c04` (`feat(backlog): Q-0006 reviewed…`, **01:15:20+02:00**) is `main`'s next commit after the run, and it has a **single** parent — so `main` stood at `cdec5e9` when it was written, four minutes after the run ended. `cdec5e9` (`merge: Q-0033 review flow surface…`) was itself committed **00:47:33+02:00**, eleven minutes before the run began. |
| 3 | Did anything commit anywhere while the run was in flight? | `git log --all --since='2026-08-24T00:58:25+02:00' --until='2026-08-24T01:11:00+02:00'` | **No output.** No ref in the repository gained a commit during the thirteen minutes of the run. |
| 4 | Where did the ticket branch point, at the closest moment committed history witnesses? | `git log -1 --format='%p' ddf907e` → `c1c5661 998f397` | `ddf907e` (`Merge branch 'harness/Q-0006/integration' into harness/Q-0006/Q0006-mock-switch`, **01:26:18+02:00**) has `998f397` as its **second** parent, and a merge's second parent is what the *named merged ref* resolved to at merge time. So fifteen minutes after the run ended, `harness/Q-0006/integration = 998f397` — a commit dated **2026-08-23T00:00:33+02:00**, twenty-five hours before the run started. |
| 5 | Is there a second witness, of a different kind? | `git log -1 --format='%p' 5b8dde2` → `998f397 ddf907e` | `5b8dde2` (`Merge branch 'harness/Q-0006/Q0006-mock-switch' into harness/Q-0006/integration`, **01:26:43+02:00**) has `998f397` as its **first** parent — where the branch itself stood immediately before that merge moved it. Two merges, twenty-five seconds apart, agreeing by two different mechanisms. |
| 6 | Did the branch move after the run? | `git log -1 --format='%p' ebf1c6e` → `998f397 6cc9da4`; `git branch -a --contains 5b8dde2` | **Yes — it moved and came back.** `5b8dde2` advanced it at 01:26:43 (run 11's integrate); `ebf1c6e` (**01:38:48+02:00**) has first parent `998f397` *again*, so the branch was rolled back in between — `finish()` discarding a failed run's merge, corroborated by `6cc9da4` (`park run 11's task branches`, 01:38:24+02:00) and by the two `…-run11-abandoned` branches that hold the discarded commits. |
| 7 | Is there a contemporaneous record of the check itself? | `git log -1 3790c04` (message body) | Written **01:15:20+02:00**, four minutes after the run ended, on `main`: *"the flow's own range — main...harness/Q-0006/integration — resolves to nothing… Verified: git diff --stat over that range returns empty, and the branch is an ancestor of main."* A committed, timestamped transcription of the same check, by the human who was there. |
| 8 | Was that tip an ancestor of that base? | `git merge-base --is-ancestor 998f397 cdec5e9` | **exit 0** — contained. The ancestry fact was true, and being a relation between two immutable commits it is re-checkable in any clone forever. |
| 9 | By what route did it become reachable? | `git rev-list --ancestry-path 998f397..cdec5e9`, oldest entry | `5d16e06`, parents `a08fbfa 998f397`, `merge: Q-0006 review-flow runtime into main [Q-0006]`, **2026-08-23T00:07:52+02:00**. A two-parent commit whose second parent is `998f397` merged it. The historical event was true as well — and this is a separate question from row 8, answered by a separate command. |
| 10 | Why could the erratum not reproduce it? | same `git log` as #6 | `ebf1c6e` (**01:38:48+02:00**) and `29ad00a` (**01:42:05+02:00**) both postdate the run's end at 01:11:00+02:00. The branch acquired a merge of `main` and the runtime task's work *after* the review, which is exactly why `git diff --stat main...harness/Q-0006/integration` reported 45 insertions when the erratum looked. |
| 11 | And today? | `git branch --merged main --list 'harness/Q-0006/*'` | lists `harness/Q-0006/integration`, and the three-dot diff is empty again — Q-0034 landed it on 2026-08-24. |

**What this proves, and the one thing it cannot.** Committed history records commits, not ref
movements. A reset that lands on a commit which already exists leaves nothing at all in the object
graph, so no command over committed history alone can exclude one during the thirteen minutes run
10 was in flight. That caution is not hypothetical here: row 6 shows the branch moving and being
rolled back within the following half-hour, which is exactly the shape of event that leaves a
first-parent chain looking undisturbed.

An earlier draft of this entry asserted that the branch *"did not move"* between 998f397's commit
date and `ebf1c6e`, deriving it from `ebf1c6e`'s first parent alone. **That was wrong on both
counts** — the branch did move, and first-parent-of-the-next-move is evidence of where a ref stood
immediately before that move, never of where it stood at some earlier moment. It was caught by the
Q-0035 chore review, and correcting it is the reason rows 3 to 7 exist.

What the durable record does support, stated at its actual strength: no commit was created anywhere
while the run was in flight (row 3); two merges of *different kinds* — one recording a merged ref's
position, one recording a merging branch's — independently witness `harness/Q-0006/integration` at
`998f397` fifteen minutes after the run ended (rows 4 and 5); that commit predates the run by
twenty-five hours; `main`'s next commit names `cdec5e9` as its only parent four minutes after the
run ended (row 2); and a commit written in those same four minutes transcribes the very check at
issue and agrees with it (row 7). **The heads run 10 compared were therefore `main = cdec5e9` and
`harness/Q-0006/integration = 998f397`, unless a ref was reset away and back inside a thirteen-minute
window that produced no commit, disturbed no later parent link, and contradicted a record written
four minutes afterwards.** Rows 8 and 9 are then facts about two fixed commits, immutable and
re-checkable forever.

Nothing above uses the reflog, which is machine-local, expires by default and does not survive a
clone. The instrument worth keeping is the pair in rows 4 and 5: **a merge's first parent is where
the merging branch stood; its second parent is where the merged-in ref resolved** — two independent
ways to recover a ref's past position from committed history, and the second one is the stronger,
because it names the ref directly. One caveat on durability: `ddf907e` and `5b8dde2` are reachable
only from `harness/Q-0006/Q0006-mock-switch-run11-abandoned` and
`harness/Q-0006/Q0006-runtime-run11-abandoned`. Both are pushed, so a clone carries them today —
but deleting those parked branches would delete this evidence, which is an argument for OQ-2's
follow-up rather than against the parking.

**Alternatives considered:** (a) Closing the erratum by asserting the ancestry fact alone — rejected,
because the erratum's whole complaint is that an ancestry fact was used to settle a question about
an event, and answering it the same way would have repeated the error while appearing to correct it.
Rows 8 and 9 are separate questions and both had to be asked. (b) Corroborating with `git reflog` —
it does agree, and it carries nothing here for the reasons above. (c) Adding the diffed SHAs to
`runs.log` or the run manifest so this is never archaeology again — genuinely worth doing and
deliberately not done here: `contracts/Q-0011/run-manifest.schema.json` is frozen, and the
frozen-contract rule says a persisted format belongs to a ticket that opens those files
legitimately. The timestamp route above removes the urgency. (d) Treating "the sentence was
accurate" as a reason to close Q-0035 unimplemented — rejected; see below.

**Why the message changed even though it was right.** Three reasons, none of which is that its
conclusion was false.

1. **It asserted more than it had.** `git merge-base --is-ancestor` establishes a relationship
   between two commits at the moment of asking. "Is already merged into" names an event, by a route
   the engine never looked for — and a merge, a cherry-pick, a hand-applied patch, a rebase and a
   branch created from base and never committed to all produce the identical exit code. Here the
   route happened to be a merge. The next time it will not be, and the engine will say it was.
2. **It named nothing a reader could check.** No SHA, no exit code, no statement of which check ran.
   Branch tips move — this one moved four times in the thirty-one minutes after the run, one of
   them a rollback to where it had already been — and a message naming no SHA cannot be re-checked
   afterwards, which is the only time anyone wants to. Establishing rows 2 to 7 above took an
   evening and then a review round, precisely because the message recorded none of it.
3. **Underneath both, a defect with a wider blast radius.** The diagnosis was a bare
   `try { … } catch { return false }`, so a missing object, a corrupt repository, a git absent from
   `PATH` and a shallow clone all rendered as the confident *"is empty — no commits to review"*.
   That is the conflation the containment decision of 2026-08-24 forbids in as many words, and
   `containment()` — written for the board the same night — already got it right. One repository
   read git ancestry two ways and the wrong one was the one that talked to the user. There is now a
   single `ancestry()` primitive in `spike/src/git.js` that both callers reach, so the rules cannot
   drift apart again. The rule reaches one step further than the first implementation of it did:
   the shallow probe is itself a git call that can fail, and reading a failed probe as "not shallow"
   would let it hand back the confident negative by the back door. `shallowState()` is therefore
   three-valued too, and an unanswered probe plus an exit 1 reports `indeterminate (shallow state
   unknown)`. Caught by the Q-0035 chore review, which is the second time this class of conflation
   has had to be closed in the same week.

**The remedy decision, and why the guard was kept.** The old message ended *"Review before merging,
or point input.diff at the merge commit"* — advice the range guard forty lines above it refuses,
since both endpoints must be the configured base or a branch under `harness/<ticket-id>/`. That was
true when it was written on Q-0006's branch and false by the time the branch landed. The guard is
**not** relaxed to match: its rule was settled by Q-0034 and is what stops a flow aiming a review at
an unrelated ref. The message is changed to agree with the guard instead. Each failure now carries
**at most one** remedy, and every remedy is one the guard would accept — "review the right endpoint
before it becomes contained in the left", or "check that the work was committed to the branch the
flow names", or for a deferred range the step that owed the branch. Deleting the remedy entirely was
considered and rejected: an adopter who hits this in their first thirty minutes needs a next move,
and being sent in a circle is worse than being told less, but being told nothing is worse than both.

**A limit stated rather than implied.** "No adapter is billed before bad evidence is found" holds
for ranges over refs that exist when the run starts, and cannot hold for a range whose endpoint the
run itself creates — `chore.yaml` reviews `integration...implement`, and the implement branch has no
emptiness to discover until the implement adapter has run and been paid for. That class gets the
earliest guarantee available instead: the producing adapter may run, the consuming one may not, and
the one failure that *can* be caught with no run at all — a malformed or out-of-class range — is
caught by a new static rule in `harness lint`. Q-0035 (OQ-1). That rule reads every `input.diff` a
flow file can hold, including the one inside a `fan_out` step's `step:` template — which
`flattenSteps` deliberately does not visit, because the template's id, role and adapter are
placeholders the other rules must not see. A static check that skips a step template is a static
check with a hole in exactly the place a run is most expensive to fail.

**Found by:** re-deriving the erratum, as Q-0034's closing entry assigned to Q-0035; and, for the
correction to the branch-position argument and the two rule gaps above, by the chore review of
Q-0035 itself.
## Q-0035 accepted: a check that skips its subject must not report success — 2026-08-25

**Decision:** Q-0035 is accepted at `reviewed`. The reviewed change is on
`harness/Q-0035/integration` (`cf12197`), both suites verified green after the merge was
re-performed by hand, and the one finding that survived the cross-vendor review is carried to
**Q-0038** rather than spent on another loop. Two rules come out of the night and are general
enough to record here rather than inside Q-0038:

1. **Skipped is not passed.** A preflight, a `--dry` run or a lint that declines to examine something
   reports that it skipped it. `harness run chore Q-0035 --dry` printed a clean four-step preview
   for a range it had deliberately not looked at, and the real run then billed **$13.86** before
   discovering the range's left endpoint did not exist. Silence must never render as a green tick.
2. **A non-interactive run authorises the first N gates it meets, not the N gates you had in
   mind.** `--gate-answer` values are consumed in order by whichever gate arrives first, and an
   engine-presented exhaustion gate is a gate. Passing one answer intended for a flow's final gate
   is therefore also an offer to accept an exhausted loop. Pass exactly as many as you would
   authorise blind, and prefer too few: the run fails, which is recoverable, instead of advancing.

**Alternatives considered:** Spending another $8–16 on a fourth `implement` + `review` pass to
close the surviving major — rejected on Q-0034 AC-2's reasoning and on the evidence of the rounds
themselves, which went three majors, three majors, one major with no blocker in any of them; the
loop was already exhausted at `chore.review = 3` against a limit of 2, and a `retry` authorises
exactly one more traversal for a message-shape change. Fixing the implementer's two red scenarios
by hand between runs — cheapest route to a completed run, rejected because it puts the
orchestrator's hand inside the artifact under review and makes authorship unreadable. Advancing
the stage without re-performing the discarded merge — rejected outright: a ticket reading
`reviewed` over a branch holding nothing is the precise failure Q-0036 shipped its containment
column to expose.

**Why: a ticket about honest diagnostics was stopped twice by dishonest ones.** Q-0035 exists
because `materialiseDiff` reported a historical event it had not verified. Its own two runs failed
because a `--dry` run reported a check it had not performed, and then because a gate could not say
what it meant. The subject matter kept reappearing in the instrument.

The expensive half. `chore.yaml` reviews `harness/{id}/integration...harness/{id}/implement`, and
the run-level preflight defers a range whole when *either* endpoint is created by an earlier step
of the same flow — one `.some()` over both endpoints at `spike/src/engine.js:108`. The right endpoint
is step-created, so nothing checked the left one, which was a pre-existing-ref-class branch that
simply did not exist. `--dry` reported the range valid. The `implement` step ran for 23 minutes and
$13.86, and `review` then failed on the missing ref. Q-0035's own AC-8 promises zero adapter
invocations for pre-existing-ref ranges and AC-9 accepts earliest-possible for deferred ones; a
range holding one of each is covered by neither. A requirement that had thought harder about this
subject than any other in the repository still had a hole in exactly this shape.

The cheap half, found independently. Round 3's reviewer, reading the diff on the other vendor,
returned one major: a deferred range names its producing step only when the *deferred* endpoint is
the unresolved one, so when the other endpoint is missing the message omits who owed what. That is
the same asymmetry from the opposite side. Worth keeping: the $13.86 route found the **timing**
half and the free route found the **diagnosis** half, and neither found both. Q-0038 owns closing
them together.

**Three things found around the flow rather than in it.** The chore flow itself performed well —
three implement passes converging to one major, an `integrate` that synced base, merged, installed
and ran the real suite green.

- **The chore flow cannot run on a ticket's first pass.** `review` diffs against the integration
  branch; `integrate`, the only step that creates it, runs after. `backlog.js:64` writes the branch
  *name* into frontmatter and nothing ever creates the ref — `spike/src/engine.js:200` says as much
  in a comment written for a different flow's ordering. Q-0008 and Q-0036 passed only because the
  branch was made by hand first: the reflog has `harness/Q-0036/integration` "Created from main" at
  23:28:46 against a run starting 23:30:38. An undocumented manual prerequisite that reads as an
  operator error, and a statically checkable flow property `harness lint` could refuse.
- **`budget.per_run_usd` does not stop anything.** It is `10`; one step spent $13.86 and one run
  spent $22.27, neither interrupted. A cap that only describes is not a cap.
- **An unanswerable gate destroyed proven-green work for the second night running.** Run 3 reached
  `integrate: tests exit 0, expected pass`, then failed at the final gate for want of an answer,
  and `finish()` rolled `harness/Q-0035/integration` back from the merge it had just made
  (`d77b632`) to `a916d07` — forty seconds after the suite went green. The rollback is right in every other case and is what
  Q-0033 added it for. What is wrong is upstream: the engine cannot express *the human has not
  decided yet* as distinct from *the run failed*, so an absent decision is indistinguishable from a
  failure and is punished like one. M1's closing entry named this as something M3's daemon must not
  inherit; it has now cost two tickets their merge on two consecutive nights, in two different
  flows. It should be fixed before M3 rather than listed again.

**Cost.** $36.66 in billed Claude cost — $13.86 for the run that found the preflight hole, $22.27
for the run that did the work, $0.53 for the probe — plus roughly 44 million Codex tokens no
roll-up can price. The ticket's own roll-up reads $39.95 because it includes the requirements run.

## The port takes the chore route, except the one child that has new behaviour — 2026-08-25

**Decision:** Q-0009's fourteen children split on one question — *can a red phase exist?* — and the
answer differs for exactly one of them.

**Thirteen take the chore flow** (`requirements → chore → human gate`): Q-0041, Q-0042, Q-0043,
Q-0044, Q-0045, Q-0046, Q-0047, Q-0048, Q-0049, Q-0051, Q-0052, Q-0053 and Q-0054. **Q-0050 alone
takes the full SDLC** (`requirements → solutioning → qa-red → development → review`), because the
event stream is the port's one authorised behaviour change and five later tickets code against its
shape. Q-0009 itself — the charter, whose criteria are all documents and configuration — takes
chore.

Three consequences are part of this decision rather than left to the children to discover:

1. **Q-0050's solutioning runs early, in parallel with Q-0041–Q-0048** — not when Q-0050's turn in
   the landing order arrives. Run order and landing order are different things, and OQ-2 requires
   the answer channel settled *while* the independent children run, since Q-0049 and Q-0051–Q-0053
   serialise behind it.
2. **Every child ports its module's unit-level tests with the module.** Q-0054 keeps the end-to-end
   regression suite — `smoke.js` and the CLI-driven files whose translation cannot be split per
   module — and no more.
3. **Q-0050 is the only child that may be routed differently, and the only one that needs a role
   table.** The chore flow runs `developer-generalist`, which already carries `packages` in its
   `paths`; `development.yaml` fans out to `developer-{role}`, and `harness/architecture.md`'s role
   table grants no role `packages/core` or `packages/shared`. AC-4 is a coherence fix for thirteen
   children and a blocker for one.

**Alternatives considered:**

**(a) All fourteen on the full SDLC.** Solutioning would emit contracts restating `spike`'s existing
behaviour plus `04-architecture.md`'s public API — a contract nothing can violate, which the
2026-08-22 executable-contracts entry exists to refuse — and `qa-red` would write a suite that
already exists in `spike/test/`, transcribed to Vitest. Q-0054 owns that transcription, so the route
would manufacture a second owner for one file set and a second answer for every frozen fixture. The
measured cost of guessing wrong here is on the record: Q-0033 spent roughly $41 across six qa-red
attempts without ever producing a usable red, on subject matter thinner than this.

**(b) All fourteen on chore, Q-0050 included.** Cheapest, tidiest, and rejected. `runFlow` becoming
`AsyncIterable<Event>` is the single behaviour change the port authorises; OQ-2's answer channel —
bidirectional generator, callback in `opts`, or out-of-band `answerGate(runId, answer)` — changes
what M3's WebSocket can do, how a run resumes after a daemon restart, and where Q-0040's "undecided"
gate lives. Handing that to one implementer in a worktree and reviewing it afterwards is how a
design nobody agreed to becomes five tickets' foundation.

**(c) A third flow — `port.yaml`.** Rejected: nothing has been learned that the two shipped routes
cannot express, and the chore entry it would amend is one day old. A flow file is cheap to write and
expensive to have been wrong about.

**(d) Q-0050's design as an out-of-band architect document rather than a solutioning run.**
Considered seriously, since OQ-2 asks only that it be *written* and settled early, and (1) above
already removes the scheduling objection to solutioning. Rejected because the flow buys three things
a document in `docs/` does not: a gate, a cross-vendor review, and contracts the five dependent
tickets can be checked against by `harness validate` rather than by reading.

**Why: the shape stops being third as soon as the question is asked per child.** Q-0009's
requirement is right that neither shipped route fits *the port* — the chore flow's rationale is
false here, and `qa-red` has nothing to write. But the chore decision's actual criterion was never
ticket size or how much configuration is involved. It is whether a red phase can exist, and that is
a property of each child, not of the set.

For thirteen the answer is no — though not for the chore entry's original reason. Its words were
*"a scaffold has no behaviour a test could fail on before it exists"*, and that is plainly false for
a ported module, which has behaviour and 3,142 lines describing it. What is true instead is the
mirror image: **the failing test already exists.** `spike/test/` is the red phase, written and paid
for months ago. Asking `automation-qa` to write it again in Vitest is transcription wearing a red
phase's clothes, and it would collide head-on with the 2026-08-23 ownership rule — two tickets
owning one file set, discovered in a development loop that cannot close.

For Q-0050 the answer is yes, and it is the only child where it is. The event stream does not exist
in `spike` — `runFlow` takes a `ui` object and prints — so there is no test to port, a test can be
written that fails now and passes later, and contracts have something to constrain that is not a
restatement of code already written. That is the mechanism working as designed, on the one input in
this ticket set that suits it.

**What makes the chore route honest here: `integrate` must examine what the child wrote.** The
configured test command is `npm test --prefix spike && pnpm turbo run test`. If a child ported a
module and left every test to Q-0054, chore's `integrate` would run both suites, pass, and report
green having examined nothing the run produced — precisely the failure recorded the same day as
*"skipped is not passed"*, arriving through a route that looks like proof. Hence consequence (2)
above. The spike half of that command is doing separate work and is worth naming: it is the freeze,
executed. A port that reaches into `spike/src/**` to make itself easier fails the step that is
supposed to bless it.

**Cost accepted.**

- **Fourteen first runs need `harness/<id>/integration` created by hand first.** The chore flow
  cannot run on a ticket's first pass — `review` diffs against a branch only `integrate` creates.
  At one ticket that is a footnote; at fourteen it is an operator procedure, and it is one forgotten
  branch away from a run that fails *after* paying its implementer, which is exactly how Q-0035 lost
  $13.86.
- **Thirteen runs produce no contracts,** so nothing downstream validates their output. The chore
  entry accepted this once for a scaffold whose shape the build asserts; here it is accepted thirteen
  times, and what asserts a port's shape instead is the tests each child brings plus Q-0054 at the
  end. If Q-0054 finds the thirteen disagree with each other, this entry is where to come back.
- **Roughly $350–550** across the children, from measured chore tickets at $26.81 and $36.66. The
  checkpoint after the first three reach `reviewed` (AC-11) is where that estimate becomes a number,
  and it is also where this routing gets its first real test.

**Found by:** Q-0009's requirements flow — run 1, `head-of-product` verdict `ready`, $8.32 — which
raised it as OQ-1, recommended this split, and correctly refused to treat it as a precondition for
its own charter. Decided at that flow's gate. Satisfies AC-1; the fourteen child bodies cite this
entry by title and date as part of the charter.

## The port preserves behaviour; one exception is authorised and everything else stops the child — 2026-08-25

**Decision:** Q-0009's fourteen children port `spike/` into `packages/core` and `packages/shared`
**preserving externally observable behaviour**, and the ported tests are the proof. Externally
observable means what a command prints and its exit code; what is written to `backlog/`,
`.quorum/` and `runs.log`, and in what format; which branches and worktrees exist and where; what
an adapter is invoked with; and when a run stops. Internal file layout, function names and module
boundaries are explicitly **not** preserved — the port is required to move several of them, because
`spike/bin/harness.js` holds domain logic that `docs/04-architecture.md` places in `core`.

**Exactly one behaviour change is authorised: `runFlow` becoming `AsyncIterable<Event>`, owned by
Q-0050.** Nothing else. A child that finds a defect, an inconsistency or an obvious improvement
while reading the spike **stops and reports it in its implementation summary**; it does not fix it
in passing. The route for a deliberate behaviour change is its own entry in this file, or a dated
erratum in the child's ticket folder naming the clause it supersedes — written and accepted
**before** it is implemented, never a silent improvement discovered in review. A child's reviewer
may treat an unregistered behaviour change as a blocker by citing this entry, without needing to
argue the merits of the change.

**The invariant register is the operative half of this policy.** Twenty-two behaviours are listed
in `harness/port-charter.md` §2 with the child that inherits each and the dated decision that
bought it. Each child names its rows among its own invariants. The register exists because "preserve
the behaviour the tests cover" is exactly wrong for the behaviours that matter here: the expensive
ones are the ones the tests under-specify. Register row 1 is the case in point — `check()` must
refuse on `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` or `CODEX_API_KEY` **before** it probes the CLI, and
a rewrite that probes first and refuses second passes every test that checks only the refusal.
Row 20 is the other shape: `finish()` does not roll back task branches, that is a known gap carried
into M2, and the port carries it forward **unfixed**.

**Alternatives considered:**

**(a) "Preserve whatever the ported tests cover", with no register.** The cheapest policy to state
and the one a reviewer cannot use. It defines the specification as its own proof, so any behaviour
the suite under-tests is unprotected precisely where protection is worth paying for — and the
register lists twenty-two of those, several found only after a run had already been paid for.
Rejected on row 1: a suite that asserts the refusal happens says nothing about whether it happens
before the probe.

**(b) Let a child fix a defect it finds, and record it in the implementation report.** Tempting,
because a port is when someone finally reads every line and the defects are real. Rejected because
it breaks the port's only proof, and breaks it invisibly: the spike's suite stays green because the
spike still has the old behaviour, and the workspace suite stays green because it was ported from a
tree that had the new one. Both green, the product wrong, and nothing in CI can see the difference.
An implementation report is not a durable record and is not read again after the gate.

**(c) Allow behaviour changes wherever `docs/04-architecture.md` and the spike already disagree.**
Rejected as an unbounded licence — the documents disagree in more places than anyone has
enumerated, and each child would decide for itself which disagreement is a mandate. Where such a
gap is real, it is a stop-and-report, and the decision is taken once rather than fourteen times.

**Why:** the port is judged by tests ported by the same process that ports the code, and Q-0054 —
the only ticket that can prove any of the others — lands last. A subtle mis-port and a
correspondingly mis-ported test agree with each other. The independent witness is the untouched
spike suite, which is why the freeze (`harness/port-charter.md` §3, enforced by CI) and this policy
are the same mechanism seen from two sides: the freeze keeps the witness from being edited, and this
keeps the port from quietly disagreeing with it. A witness that has been edited is not one, and a
proof that was rewritten to match the thing it proves is not one either.

The cost accepted is that the port lands with known defects intact, and that a child which spots a
real bug must leave it and say so. That is the right trade at fourteen tickets across several
evenings: a fix costs one ticket later, and a silent divergence costs the confidence that `core`
does what the spike did — which is the entire claim M2 is making.

**Found by:** Q-0009's merged requirement, AC-2, which specifies this policy and the register behind
it. Written as an entry rather than only as charter prose because it outlives the ticket: every
child's reviewer needs to cite it, and `harness/port-charter.md` is retired at the cutover while
this is not.

## A requirement may not name a surface its flow cannot write — 2026-08-25

**Decision:** Routing a ticket to a flow is also a statement about which surfaces its acceptance
criteria may name, and that has to be checked when the routing is decided rather than discovered by
a loop. Three rules come out of Q-0009's chore run:

1. **`backlog/` is not a writable surface for any agent step, in any flow.** `commitAll`
   (`spike/src/fanout.js:80–93`) runs `git checkout -- backlog` and `git clean -qfd -- backlog`
   before every agent step commits, reverting tracked edits and deleting additions, and reports
   what it dropped. This is deliberate and stays: an agent that can edit `ticket.md` can advance
   its own stage, mark its own run complete and refund its own counters. A criterion whose surface
   is `backlog/` is therefore work for a human commit or for the engine, never for a step.
2. **A criterion naming an unwritable surface is settled by erratum or by hand, not by iteration.**
   The revise loop cannot close it, and every round is correct to refuse.
3. **Q-0009's own routing is amended.** *"The port takes the chore route, except the one child that
   has new behaviour"* (2026-08-25, earlier the same day) routed the charter itself to chore. That
   is wrong and this entry supersedes it for Q-0009 alone: the charter's three backlog-surface
   criteria were performed by human commit, and the charter now lives at `harness/port-charter.md`
   per `backlog/Q-0009-…/requirements/errata.md` E-1. **The fourteen children are unaffected** —
   their surface is `packages/`, which `developer-generalist` may write.

**Alternatives considered:** (a) Widen `developer-generalist`'s paths to include `backlog/` —
rejected outright, and it would not have worked anyway, since the revert is in `commitAll` rather
than in any path list; the role file is advice and this is enforcement. Making the enforcement
optional hands an agent the ticket state that decides whether its own work is finished. (b) Add a
step kind authorised to write ticket bodies from a schema — plausible eventually and rejected now:
a new step kind decided under time pressure to rescue one ticket is how flow semantics get worse.
(c) Raise `max_iterations` — the loop was not failing, it was reporting; more rounds buy more
correct refusals at $8–10 each.

**Why: the fifth appearance of one pattern, in a variant the existing rules do not cover.** M1's
closing entry named *"a loop spending its budget on work no agent in it can perform"* and listed
four instances — a hung test command, a base conflict at integrate, a base conflict before fan-out,
and tests whose only fix lay in a file no task owned. Two decisions of 2026-08-23 close it from
both sides: every file a red test requires must be owned by exactly one task (*can anyone fix
this?*), and a red test must still be green once the feature exists (*will the fix still hold?*).
Both are questions about files a task owns. This one is prior to ownership: **may anyone write
here at all?** No task can own `backlog/`, so the ownership rule has nothing to catch.

Q-0009's run 2 spent **$23.25** and 27.2M Codex tokens across three implement passes and three
`revise` verdicts establishing it. Every round was right. The implementer wrote the charter to
`harness/port-charter.md`, said in its report that `backlog/` was not writable for the step and
that three criteria named it anyway, and by round 3 had stopped restating its case and instead
transcribed into the charter the exact block each of the fourteen bodies needed — so that the
authorised commit would be transcription rather than authoring. The reviewer refused the
relocation three times as unauthorised, which is also right: an implementer that may relocate a
required artifact by explaining why can relocate anything. Two correct agents, no possible move.
The cheapest detection was free and an hour earlier: reading the criteria's surfaces against the
flow's writable set when the routing was decided.

**A note on how the blind spot propagated.** The requirement's own correction section says *"on the
recommended chore route, no **child** implementer is handed a contract forbidding its target
directory"* — true of the thirteen and silent about the parent. The routing entry written hours
later repeated the check in the same shape, verifying `developer-generalist` could write `packages`
and never asking about `backlog`. A correction inherited without re-deriving what it did **not**
say is the "review the fix round, not only the feature round" lesson from Q-0034, arriving through
a document rather than through code.

**What the hand-performed `integrate` found, and why it matters.** The run died before `integrate`,
so the work looked finished and was not. Performing that step by hand turned up two real defects in
the implement branch: `harness/architecture.md`'s frontend and data rows carried their caveats
*inside* the third column (*"`packages/database` — does not exist yet"*), which `spike/test/smoke.js`
parses as a comma-separated path list and compares to the role's `paths` frontmatter — two
assertions red; and `port-freeze-guard.sh` printed two spellings of its skip phrase while its own
test asserted one. Both are exactly what `integrate` is for. The generalisation is that **a run
that fails before `integrate` leaves work in the shape of finished work**, and the branch cannot be
trusted until that step is performed by something. It is the third night running that a chore
ticket's final proof had to be re-performed by hand, which is Q-0040's argument, not a new one.

**Cost.** $23.25 for run 2, on top of $8.32 for the requirements run — $31.58 on the ticket's
roll-up — plus 27.2M Codex tokens no roll-up can price. The $23.25 bought one erratum's worth of
knowledge and two defects the integrate step would have caught for nothing.

## Zod describes structure and types; the flow lint keeps the semantics — 2026-08-25

**Decision:** `packages/shared` holds zod schemas for Quorum's own files — the flow file, `ticket.md`
frontmatter, the role file, and the two step-output shapes — and the boundary between those schemas
and `lintFlow` is drawn here, once, so that no later ticket has to decide it again. Four rules,
each checkable against a proposed new rule by reading one paragraph:

1. **Zod describes structure and types. Lint keeps every semantic rule and every message it
   produces today.** No zod issue may replace a lint message in `quorum lint`'s output, and
   consumers call `safeParse`, never `parse`, wherever a lint message is the better diagnostic.
   Zod may reject something lint also rejects; it may never add a rule lint does not have. Where
   lint owns a value — `on_exhausted` must be `gate`, an `input.diff` range's endpoints, a verdict
   must route somewhere, the two cross-vendor rules — the field is typed open and lint refuses it.
   The same rule decides a case that looks like an obvious enum and is not: a flow's `consumes` and
   `produces` are typed as plain strings, because `lint.js:124` checks only that both are present,
   so a flow naming a stage outside the ten-member list runs today and the schema may not be the
   thing that stops it. `stageSchema` is right for a ticket's own `stage` and wrong there.
2. **Where a key decides which KIND of step an object is, it stays optional even when lint requires
   it** — `integrate.branches`, `script.run`, and a `fan_out` step's `step:` template — **and the
   step schema selects its kind by `runStep`'s own dispatch and then commits to it**
   (`spike/src/engine.js:176–198`, by truthiness of `parallel`, `gate` and `fan_out`, with `type`
   separating only script from integrate). Both halves are needed and the second is the one that is
   easy to get wrong: an ordered `z.union` tries its branches in turn, so `{id: 'x', gate: 42}` —
   which the engine sends to `runGate` — fails the gate branch and is then *accepted* by the
   permissive agent branch, which keeps `gate` as an unknown key. The object ends up typed as the
   one kind the engine will never run it as, and its real structure is never checked. Selecting
   first and validating once means a malformed integrate step is still an integrate step, still
   receives lint's message about it rather than a union error naming an array index, and reports its
   own field (`steps.0.gate`) rather than every branch it is not.
3. **No field carries `.default()` or `.catch()`.** A zod default invents state the file did not
   carry, in the package thirteen tickets import, and no test would fail. `harness/rules.md` forbids
   it in as many words. The spike's fallbacks — `step.into ?? ticket.meta.branch`, `step.expect ??
   'pass'`, `step.max_turns ?? 40`, `iterations ?? {}` — stay in the engine where they are visible.
4. **Nothing is discarded.** Zod strips unknown object keys by default, which turns any
   parse-then-write path into silent data loss; every object here passes them through instead. The
   one exception is a step's `output:` block, which rejects unknown keys explicitly rather than
   dropping them, because the engine reads that block exhaustively and a key it does not know is a
   key nothing will ever act on.

**Alternatives considered:** (a) Let zod own everything it structurally can — seven of `lintFlow`'s
sixteen checks are expressible in zod (`lint.js:63, 66, 70, 75, 78, 79, 124`). Rejected on the
diagnostics: lint accumulates into an array and throws once, so a reader gets every defect in one
pass, and fourteen of the sixteen messages open with the **step id** — the token the reader greps
for in the YAML. Zod's path-based issue would say `steps[3].on_fail.max_iterations`: an index, not
an id. The one check that looks structural and is not is the `input.diff` range rule at `lint.js:83`,
which must visit a `fan_out` step's `step:` template that `flattenSteps` deliberately does not.
(b) A `.strict()` flow schema, so an unknown key is an error everywhere. Rejected by the corpus:
`loadFlow` assigns `flow.file = file` onto the parsed object *before* lint sees it
(`engine.js:15–20`) and `lint.js:127` prints that key as the flow's name — so a strict schema would
reject all six shipped flows on a key that appears in no YAML file. (c) Skip zod for flows and keep
lint as the only check — leaves thirteen later tickets each re-deriving what a flow file is from
`YAML.parse`'s return, which is the state this ticket exists to end.

**Why:** `lintFlow` is good at what it does and its value is almost entirely in its *messages*.
Adding a second validator in front of it is exactly how a project loses them — the new one runs
first, fails on a technicality, and the sixteen carefully written sentences never print. Writing the
boundary down as four rules rather than as taste is what lets a reviewer settle "does this belong to
zod or to lint?" without reopening the question, and the rules are testable: the package's own suite
asserts that every shipped flow parses with the injected key, that no `.default(` or `.catch(`
appears in the source, and that an accepted object round-trips with no key added or removed.

**Cost accepted:** the flow schema is looser than a schema written from scratch would be, and a
consumer that wants a guarantee lint already provides has to run lint. That is the right direction
of error: a schema that is too tight rejects an adopter's legal flow file in the package everything
imports, and that failure surfaces in the field.

## The event union is derived from what the product emits, and `tool` and `text` are not invented — 2026-08-25

**Decision:** `packages/shared` defines the trace/event union from the evidence of what the code
emits and prints, not from `docs/04-architecture.md:28`, which named six kinds of which one had a
producer. Two shapes, because two interfaces exist: `AdapterEvent`, what an adapter passes to
`onEvent`, carrying no identity; and `Event`, what a run emits, which is an adapter event plus the
step id the engine already supplies at `engine.js:247` (`ui.trace(step.id, e)`) or one of the
engine's own. The disposition of every candidate:

| What exists today | Where | Disposition |
| --- | --- | --- |
| `{ type: 'spawn', vendor, cmd }` | `claude.js:31`, `codex.js:52` | member, fields verbatim |
| `{ type: 'stdout', line }` | `claude.js:32`, `codex.js:60`, `mock.js:66` | member, fields verbatim |
| `{ type: 'retry', vendor, attempt, of, delayMs, reason, message }` | `adapters/index.js:109` | member, fields verbatim — emitted by the contract layer, not by any vendor |
| `ui.step(id, m)` | `bin/harness.js:66` | member `step` |
| `ui.done(id, m)` | `bin/harness.js:67` | member `done` |
| `ui.info(m)` | `bin/harness.js:64` | member `info`, no step id |
| `ui.warn(m)` | `bin/harness.js:65` | member `warn`, no step id |
| `ui.gate({kind, reason, ticketDir, retry})` — which *asks* | `bin/harness.js:74–127` | the **question** is a member; the answer channel is Q-0050's |
| `tool`, `text` (`04-architecture.md:28`) | emitted by nothing | **not added** |

**`tool` and `text` are not invented.** Producing them requires an adapter to parse vendor JSONL
into normalised events, which changes what `--verbose` prints (`bin/harness.js:69`) and enlarges
Q-0047's scope. No ticket authorises that, and *"The port preserves behaviour"* (2026-08-25) makes
it a stop-and-report rather than a design opportunity. The asymmetry decides it: widening a
discriminated union later is additive and every non-exhaustive consumer fails at `tsc`, so adding
them once a producer exists costs a type error at build time — while inventing their payloads now,
thirteen tickets deep, costs a shape five later tickets have coded against.

**Register row 22's operative reading, recorded because a child's reviewer will otherwise spend a
round on it.** `harness/port-charter.md` §2 row 22 says *"nothing downstream learns which vendor
produced an event"*. **That wording cannot be applied literally.** `spawn` and `retry` carry
`vendor` today, so removing it is a behaviour change the port does not authorise; *"Codex cost is
reported as tokens, never priced locally"* (2026-08-22) requires per-vendor roll-ups and forbids a
blended number; and `contracts/Q-0011/run-manifest.schema.json` **requires** `vendor` in both
`$defs.usage` and `$defs.vendor_rollup`, in a frozen contract. The reading is therefore: **no
vendor-specific field and no vendor branching outside an adapter; a neutral `vendor` label is
permitted and required.** The label is an open string, not an enum of the three shipped names — a
contributor's `gemini` adapter must not need `packages/shared` edited to emit an event, and an
unknown adapter name is already refused with a good message by `getAdapter`
(`adapters/index.js:29`).

**The envelope is the step id and nothing else** (Q-0041's OQ-4). Ordering, timestamps, run ids,
terminal semantics, error representation and how a gate answer travels back all belong to Q-0050,
which is why they are absent rather than sketched. Nothing in `shared` emits, persists, replays or
transports an event; `04-architecture.md:70–71` and `contracts/Q-0011/run-history-writer.contract.md:3–4`
both freeze the absence of a persisted event stream in v1.

**Alternatives considered:** (a) Implement the six documented kinds, on the grounds that the
document is the spec. Rejected: five of the six have no producer, so their payloads would be
invented, and the union would then be unable to express what the CLI prints today — the failure
would surface at Q-0050, where it is a behaviour change with five tickets queued behind it.
(b) Forbid `vendor` anywhere in the union, which is row 22 read literally. Rejected on three
independent grounds above, one of them a frozen contract. (c) One union rather than two, with the
step id optional on every member. Rejected because "optional" would be the only thing distinguishing
"an adapter did not know" from "the engine forgot", and those are different facts.

**Why:** the union is being designed at the point of maximum leverage and minimum evidence, in the
package everything imports, before anything emits it. Two documents disagreed with each other and
both disagreed with the code, so the only defensible source was the emitting lines themselves —
which is also why the package's suite asserts that those lines still read the way they are quoted
here, rather than trusting the transcription.

**Found by:** Q-0041, whose merged requirement raised the six-versus-three contradiction as AC-8 and
row 22's literal impossibility as AC-9/OQ-7.
