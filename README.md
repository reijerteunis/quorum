# Quorum

**Local-first mission control for agentic software engineering.** Define your development flow once
as versioned files, run it with coding agents from more than one vendor — competing coders,
cross-vendor review panels, judges — on the subscriptions you already pay for, with a human gate
between every step. Nothing advances without a quorum.

```
draft ──▶ requirements ──▶ solutioned ──▶ red ──▶ green ──▶ reviewed
            │                                                  ▲
            └────────────────── chore ─────────────────────────┘
                        (machinery and config work)
```

Quorum is **product-agnostic**: nothing in this repository knows about any particular application.
It runs on your repo, against your tickets, using your flows.

> **Status: pre-alpha.** The command line works and this repository develops itself with it — every
> feature since August has been a ticket run through these flows. There is **no web UI yet**; that
> is the next milestone. See [What is not built](#what-is-not-built) before you plan around it.

## Why it exists

Coding agents are good at writing code and bad at knowing when to stop. Quorum is the part around
them: it decides which agent runs when, what each one is shown, what it is allowed to write, and who
has to say yes before anything moves forward.

Three properties it does not compromise on:

- **Bring your own subscriptions.** Quorum never handles an API key. Every agent runs on the OAuth
  login of a CLI you already pay for — Claude Code, Codex CLI. If `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`
  or `CODEX_API_KEY` is set, the adapter refuses to start rather than quietly billing you.
- **A writer never reviews its own work.** `cross_vendor: required` is a lint, not a convention: the
  reviewer of an artifact must run on a different vendor's CLI than whoever wrote it.
- **Your working tree is never written to.** Agents work in git worktrees under `.harness/worktrees/`,
  on branches beside an integration branch. A run that fails leaves your checkout exactly as it was.

## Requirements

| | |
| --- | --- |
| Node | ≥ 22.13.0 |
| pnpm | 10.x (for the workspace install path) |
| git | any recent version |
| Agent CLIs | [Claude Code](https://claude.com/claude-code) and/or [Codex CLI](https://developers.openai.com/codex/cli/), each logged in |

You need at least one agent CLI logged in. The shipped flows use two, because a cross-vendor review
panel is the point; with one vendor installed, flows that require a panel will refuse.

## Install

**`npx quorum` does not work yet, and will not until the packages are published** — every package in
this repository is `"private": true`, so the name resolves to nothing (or to a stranger's package).
These are the two paths this repository actually claims and tests.

### From the workspace

```bash
git clone https://github.com/reijerteunis/quorum.git
cd quorum
pnpm install
pnpm turbo run build
pnpm exec quorum help
```

### As a packed install, into another project

Three tarballs, installed together — `@quorum/cli` depends on the other two through `workspace:*`,
which is not resolvable outside the workspace, so installing it alone fails.

```bash
# in the quorum checkout
pnpm turbo run build
for p in shared core cli; do (cd "packages/$p" && pnpm pack --pack-destination /tmp/quorum); done

# in your own project
npm install /tmp/quorum/quorum-shared-0.0.0.tgz \
            /tmp/quorum/quorum-core-0.0.0.tgz \
            /tmp/quorum/quorum-cli-0.0.0.tgz
npx quorum help          # resolves locally, from node_modules/.bin
```

## Quickstart

From inside the git repository you want Quorum to work on:

```bash
quorum init                       # scaffold harness/ and backlog/
quorum adapters --probe           # prove your logins actually answer
quorum ticket new "Add a health check endpoint" \
  --intent "Ops needs a /health route reporting build sha and uptime."
quorum board                      # see it sitting at draft
quorum run requirements T-0001 --dry   # walk the flow, spend nothing
quorum run requirements T-0001    # the real thing — stops at a human gate
```

`quorum init` writes **20 files**: six flows, ten role definitions, `harness.yaml`, and the context
files your agents are given at run time. They are yours to edit — that is the product.

`--dry` walks the whole flow, resolves every prompt, and invokes no agent and writes nothing. Run it
first. It is the same code path as a real run, so what it reports is what would happen.

### Your first gate

A run stops and waits:

```
■ GATE (human) PM owner approves requirements/merged.md
  inspect: /your/repo/backlog/T-0001-add-a-health-check-endpoint
  advance / abort >
```

Read the artifact it names, then answer. `advance` continues, `abort` ends the run and rolls the
ticket branch back. Some gates also offer `retry`, which grants the loop one more traversal. Nothing
moves until you answer, and `--auto` cannot bypass a gate the engine presents.

## How it works

**Your harness is a folder, not a database.** `harness/` holds the flows, the roles and the context
your agents read. It is versioned in git next to the code it governs, so a change to how your team
builds software is a diff someone reviews.

**Your backlog is a folder too.** `backlog/<ID>-<slug>/` holds `ticket.md` — YAML frontmatter plus
intent — and one subfolder per stage for the artifacts that stage produced. No ticketing tool, no
sync, no export. A ticket's `stage:` is what decides which flow may run next.

**A flow is a YAML file** naming ordered steps, which adapter and role runs each one, what each step
is shown, and the gates between them. Steps can fan out into parallel worktrees, integrate back, and
loop backwards on failure with a bounded `max_iterations` — when that bound is spent, a human is
asked rather than the loop spinning.

**Six flows ship** and chain by stage:

| Flow | Consumes | Produces |
| --- | --- | --- |
| `requirements` | `draft` | `requirements` |
| `solutioning` | `requirements` | `solutioned` |
| `qa-red` | `solutioned` | `red` |
| `development` | `red` | `green` |
| `review` | `green` | `reviewed` |
| `chore` | `requirements` | `reviewed` |

`chore` is the short route for machinery and configuration — work that changes what a repository
*is* rather than what it *does*. It skips solutioning and the red phase, because a scaffold has no
behaviour a test could fail on before it exists.

## Commands

| Command | What it does |
| --- | --- |
| `quorum init [dir]` | scaffold `harness/` and `backlog/` |
| `quorum adapters [--probe]` | which agent CLIs are installed; `--probe` proves the login answers |
| `quorum ticket new "<title>"` | create a ticket at the backlog's next id |
| `quorum board` | every ticket by stage, and where its code actually is |
| `quorum run <flow> <ticket>` | run a flow; `--dry` walks it without spending anything |
| `quorum lint` | check the flow directory, including cross-flow edges |
| `quorum validate <schema> <file…>` | check artifacts against a contract |
| `quorum runs [ticket\|run-id]` | run history: cost, tokens, every step |

Full reference, including every flag and what each exit code means: **[docs/USAGE.md](docs/USAGE.md)**.

## What is not built

Stated plainly, because the roadmap reads like a product and this is pre-alpha:

- **No web UI.** Mission control, the gate screen with diffs, and the backlog board are the next
  milestone. Today everything is the terminal.
- **No published package.** `npx quorum` from the registry is not available; see [Install](#install).
- **Two of the eight flows do not exist.** `qa-final` and `deploy` — including the human-locked
  deploy gate — are specified and unwritten.
- **The full SDLC route is lightly exercised.** `solutioning`, `qa-red` and `development` have been
  run end to end on four tickets. The `requirements` → `chore` route has been run on more than fifty
  and is where the confidence is.
- **One run per ticket, and no daemon.** Runs are foreground processes; a second run against the same
  ticket refuses rather than colliding.
- **Budget caps are specified and not enforced.** `budget.per_run_usd` in `harness.yaml` stops
  nothing today. Watch the cost the run prints.

## Documentation

- **[docs/USAGE.md](docs/USAGE.md)** — the user guide: every command, the flow model, gates, worktrees, troubleshooting.
- **[CONTRIBUTING.md](CONTRIBUTING.md)** — how this repository develops itself, and how to work on it.
- **[docs/README.md](docs/README.md)** — the design documentation: product definition, pipeline spec, adapter contract, architecture, plan.
- **[docs/DECISIONS.md](docs/DECISIONS.md)** — every design decision and why, append-only. If code and a document disagree, an entry here settles it.
- **[docs/GLOSSARY.md](docs/GLOSSARY.md)** — the vocabulary, used exactly.

## Licence

[Apache License 2.0](LICENSE).

Launching via [heyruud.com](https://heyruud.com).
