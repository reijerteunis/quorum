# Using Quorum

*The user guide. For the design documents — product definition, pipeline spec, adapter contract,
architecture — see [docs/README.md](README.md), which is written for people building Quorum rather
than using it.*

Quorum runs coding agents against your repository along a flow you define, stopping at a human gate
whenever a person should decide. This page covers every command, what a run actually does to your
git repository, and what to do when something goes wrong.

- [Setup](#setup)
- [The model](#the-model) — harness, backlog, flows, stages
- [Commands](#commands)
- [Gates](#gates)
- [What a run does to your repository](#what-a-run-does-to-your-repository)
- [Cost](#cost)
- [Troubleshooting](#troubleshooting)

---

## Setup

Install Quorum by one of the two paths in the [README](../README.md#install), then, **from inside
the git repository you want it to work on**:

```bash
quorum init
```

That writes `harness/` — six flows, ten roles, `harness.yaml`, and the context files agents read at
run time — and an empty `backlog/`. Commit them: your harness belongs in git next to the code it
governs.

### Prove your logins before you spend anything

```bash
quorum adapters --probe
```

`quorum adapters` on its own only reports that a CLI is **installed**. `--probe` makes a real
round-trip against each vendor and tells you whether the subscription actually answers — which is
the only compatibility evidence there is. Run it before a real run; a flow that dies at step four
because a login expired has already spent steps one to three.

```
✓ claude: 2.1.236 (Claude Code)
  ✓ login verified — round-trip 8174ms, $1.6075, 305574 tokens
  · verified version = 2.1.220, installed 2.1.236 (Claude Code) — the installed CLI is newer than the record
```

That last line is a **past measurement, never a policy**: it says which CLI version the adapter was
last verified against. Nothing branches on it and no run is ever refused because of it.

### No API keys, ever

If `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` or `CODEX_API_KEY` is set, the adapter refuses:

```
✗ claude: ANTHROPIC_API_KEY is set — unset it; …runs on subscription OAuth only
```

This is deliberate and there is no flag to override it. Quorum runs on the login of a CLI you
already pay for, so an agent can never quietly bill an API account.

### Configure `harness.yaml`

The one file worth reading before your first real run:

```yaml
repo:
  base_branch: main          # what diffs compare against, and what integrate merges from
  max_diff_bytes: 200000     # a diff larger than this is truncated before it reaches an agent
commands:
  timeout_ms: 900000
  install: npm install --no-audit --no-fund --silent
  test: npm test             # what an integrate step runs to decide green
budget:
  per_run_usd: 10            # specified, NOT enforced today — see Cost
  per_ticket_usd: 60
```

**Change `commands.install` and `commands.test` to yours.** An `integrate` step runs them inside a
worktree to decide whether a change is green. If your project uses pnpm, say so here.

> If your test command goes through a caching runner, make it force execution — `pnpm turbo run test
> --force` rather than `pnpm turbo run test`. A cached pass replays a *verdict* without running
> anything, so `integrate` can report green over code it never executed.

---

## The model

### Harness

`harness/` is your development process as versioned files:

```
harness/
  harness.yaml            config: repo, commands, budgets, adapters
  rules.md                engineering rules every agent is given
  architecture.md         how your codebase is laid out
  product-context.md      what your product is and who it serves
  flows/*.yaml            six flows
  roles/*.md              ten agent personas
```

A **role** is a persona file: default adapter, default model, a write-path allow-list, and a prompt.
`developer-backend` may write `src/api/**` and nothing else; the engine enforces that, not the
agent's good intentions.

### Backlog

`backlog/` is your ticketing system, as folders:

```
backlog/T-0001-add-a-health-check-endpoint/
  ticket.md               YAML frontmatter + the intent, in prose
  runs.log                one line per run, per step, per gate answer
  requirements/           artifacts the requirements stage produced
  solution/  qa/  dev/  review/
```

Ticket ids are `<PREFIX>-nnnn`. **The prefix is yours, derived from what is already there**: a
backlog holding `PROJ-0041` allocates `PROJ-0042` with no configuration. An empty backlog allocates
`T-0001`.

### Stages, and which flow may run

A ticket's `stage:` decides what can happen to it next. Flows `consume` one stage and `produce`
another:

```
draft ──requirements──▶ requirements ──solutioning──▶ solutioned ──qa-red──▶ red
                              │                                               │
                              │                                         development
                              │                                               ▼
                              └──────────── chore ─────────▶ reviewed ◀──review── green
```

Plus `blocked` and `abandoned`, which no flow consumes.

`quorum board` prints the command for each stage, so you never have to remember which flow is next.

### Containment: where the code actually is

A stage says how far a ticket got. It does **not** say the code landed. `quorum board` answers that
separately, by asking git on every invocation:

```
Q-0039 One run at a time per ticket   owner=ruud cost=$79.52 main:contained
Q-0055 Lint requires a step id …      owner=ruud cost=$57.81 main:not-contained(+12)
T-0001 Add a health check endpoint    owner=you  cost=$0.00  main:indeterminate(no branch)
```

- `main:contained` — the branch tip is an ancestor of `main`. The work is in.
- `main:not-contained(+12)` — twelve commits are on the branch and not in `main`.
- `main:indeterminate(...)` — git could not answer, and the board says so rather than guessing.

---

## Commands

### `quorum init [dir]`

Scaffolds `harness/` and `backlog/`. It **refuses** rather than overwriting: if `harness/` already
exists it reports `<path>/harness already exists` and exits 1, changing nothing.

### `quorum adapters [--probe] [--json]`

Which agent CLIs are installed. `--probe` additionally proves each login answers, and is the check —
the bare form is a report. `--json` for scripts. Exit 0 either way, except that `--probe` exits 1 if
a login is unusable.

### `quorum ticket new "<title>" [--intent …] [--owner …] [--id …]`

Creates the next ticket. `--intent` is the prose an agent reads first — spend a sentence on it.
`--owner` defaults to your git `user.name`, or the sentinel `unknown` if git has none; it is never
guessed from your OS account. `--id` allocates an explicit id and refuses one already taken.

### `quorum board`

Every ticket by stage, with owner, cost, loop counters and containment. It also prints **push lag** —
how many commits your base branch holds that its upstream does not:

```
· push lag = main holds 7 commits that origin/main does not, as of the last fetch — they have not
  been pushed, which is the whole of what this says
```

That line may warn and never reassures: silence means only that git answered and there was nothing
to say. It is never a claim that anything was built, tested or validated anywhere.

### `quorum run <flow> <ticket> [flags]`

The command the product exists for.

| Flag | What it does |
| --- | --- |
| `--dry` | walk the flow, invoke no agent, write nothing. **Use this first.** |
| `--base <ref>` | aim the diff at another revision. Needed to review a ticket already merged, whose diff against `main` is empty. Moves the diff anchor only, never what `integrate` merges from. |
| `--adapter <name>` | override every step's adapter |
| `--gate-answer <a>` | supply a gate answer non-interactively; repeatable, consumed in order |
| `--auto` | take author-declared `auto` gates automatically. **Cannot bypass a gate the engine presents**, and never a `human-locked` one. |
| `--verbose` | stream each step's output |

**Exit codes:**

| | |
| --- | --- |
| `0` | the run completed |
| `1` | an error — a bad argument, an unmet precondition, a step that failed |
| `2` | aborted at a gate |
| `3` | **undecided** — a gate was reached and no answer was available |
| `130` | interrupted by a signal |

**3 is the interesting one.** It means nobody was there: the scripted answers ran out and stdin is
not a terminal, or stdin closed while a question was open. An undecided run moves no stage and keeps
every worktree — and alone among the non-advancing outcomes it does **not** roll the ticket branch
back, because nothing was proved wrong.

### `quorum lint`

Checks every flow: structure, step ids, loop bounds, write paths, and cross-flow edges. Run it after
editing anything in `harness/flows/`. Exit 1 if anything fails.

### `quorum validate <schema.json> <file…>`

Checks artifacts against a JSON Schema contract. Exit 1 if any file fails, having reported all of
them rather than stopping at the first.

### `quorum runs [ticket|run-id] [--json]`

Run history from `.quorum/runs/`: what ran, what it cost, how many tokens, which steps failed, and
the exact prompt and output of every agent call.

```bash
quorum runs                 # every run
quorum runs T-0001          # one ticket's runs
quorum runs T-0001-1        # one run, step by step
```

Codex steps report tokens rather than a price, and Quorum renders that as `n/a` rather than
inventing a number.

---

## Gates

A gate is where a person decides. The run stops, names the artifact, and waits.

```
■ GATE (human) PM owner approves requirements/merged.md
  inspect: /your/repo/backlog/T-0001-add-a-health-check-endpoint
  advance / abort >
```

Three answers exist, and only three:

- **`advance`** — accept and continue to the next step. It does **not** end the run.
- **`retry`** — offered where a loop can be re-entered; authorises exactly one more traversal.
- **`abort`** — end the run. Non-advancing outcomes roll the ticket branch back to where the run
  found it.

**Three kinds of gate:**

1. **Author-declared** — written into the flow. Human by default; can be set to `auto`.
2. **Engine-presented** — appears when a backward edge's bound is spent. Requires an explicit
   answer and **cannot be bypassed by `--auto`**. Where the bound is zero, nothing looped and the
   engine says so rather than reporting a loop that did not happen.
3. **`human-locked`** — can never be automated. The deploy gate is one.

### Answering without a terminal

```bash
quorum run chore T-0001 --gate-answer advance --gate-answer advance
```

Answers are consumed in order. When they run out and stdin is not a terminal, the run ends
**undecided** and exits 3 — it does not guess.

---

## What a run does to your repository

**It never writes to your working tree.** Everything happens in git worktrees:

```
.harness/worktrees/           worktrees, one per branch a run needs
harness/<ticket>/integration  the ticket's integration branch
harness/<ticket>/implement    a step's branch, beside it
.quorum/runs/<run-id>/        run history: manifest, prompts, outputs, usage
.quorum/locks/<ticket>.json   the lock a running flow holds on a ticket
```

`.harness/` and `.quorum/` are added to `.git/info/exclude` on the first real run, so neither shows
up in your `git status`. A `--dry` run creates neither, because it writes nothing at all.

**A run that finishes gives back the worktrees it took.** One that does not keeps every one of them,
because a directory a run stopped in is the thing you are about to open. **No run ever deletes a
branch** — removing a directory is reversible from its branch, and deleting the branch is not.

**One run per ticket.** A second run against the same ticket refuses and names the holder:

```
✗ run lock refused: ticket T-0001 is held by run #7 (flow chore, pid 4212 on your-mac,
  started 2026-09-09T08:00:00.000Z) — .quorum/locks/T-0001.json
```

If a run was killed with `SIGKILL` or the machine lost power, the lock outlives it. Delete the file
the message names. Quorum will not reclaim it for you: a recorded pid cannot tell *that process is
gone* from *that pid belongs to something else now*, and guessing is worse than asking.

---

## Cost

Every run prints what it spent, and `quorum runs` keeps it:

```
· run #2 completed: requirements → reviewed   cost $60.047  tokens 89906110  (+3 unpriced steps)
```

Two things to know before your first real run:

- **`budget.per_run_usd` is specified and not enforced.** It stops nothing today. Watch the number.
- **Ticket size is the dominant cost driver.** A ticket with ten acceptance criteria costs far less
  than one with thirty, because oversized tickets hit loop bounds at every stage and each retry pays
  for the whole step again. Split before you run, not after.

For scale: in this repository a small chore ticket runs $15–30, a substantial one $50–90.

---

## Troubleshooting

**`no harness/harness.yaml found`** — you are not in a project Quorum has initialised. Run
`quorum init`, or `cd` to the repository root.

**`ticket T-0001 is at stage "draft", flow "chore" consumes "requirements"`** — the flow you asked
for cannot run from where the ticket is. `quorum board` prints the right command for each stage.

**A step fails with an empty diff.** The range it compared was empty — usually because the branch is
already contained in the base. Use `--base <ref>` to aim the diff somewhere with content.

**A review step refuses because the integration branch does not exist.** `chore` diffs against
`harness/<ticket>/integration`, and only `integrate` — which runs later — creates it. Create it
before the first run:

```bash
git branch harness/T-0001/integration
```

**`login not usable`** — your CLI is installed but its subscription did not answer. Log in with that
vendor's own command and re-run `quorum adapters --probe`.

**A run died mid-flow on a vendor error.** Its worktrees are kept. The work committed so far is on
`harness/<ticket>/implement`; nothing was lost, and re-running starts a fresh round that cannot see
the previous round's reviews. Inspect the branch before deciding.

**A flow you edited is refused by `quorum board`.** It is listed with the reason rather than
silently dropped. Run `quorum lint` for the detail.

---

## Where to go next

- [CONTRIBUTING.md](../CONTRIBUTING.md) — how this repository develops itself with these flows.
- [docs/02-sdlc-pipeline-spec.md](02-sdlc-pipeline-spec.md) — every flow file, section by section, if you are writing your own.
- [docs/03-adapter-contract.md](03-adapter-contract.md) — what an adapter must implement, if you are adding a vendor.
- [docs/GLOSSARY.md](GLOSSARY.md) — the vocabulary, used exactly and worth skimming once.
