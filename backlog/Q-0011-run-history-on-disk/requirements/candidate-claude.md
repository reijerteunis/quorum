# Q-0011 — Run history on disk with per-vendor roll-up

*Requirements, candidate (product-manager, claude). Ticket Q-0011, stage draft → requirements. M1.*

## Problem

A run's history currently exists only in the terminal that printed it. The durable record is one line per step in `runs.log` — `run`, `step`, `vendor`, `model`, `verdict`, `cost`, `ms` — plus a single cost figure per run in `ticket.md`'s `history`. Everything else is discarded when the process exits: the prompt that was sent, the agent's final output, the token counts, the worktree and branch the step ran in, how many times the adapter was retried, and, on a failure, anything beyond the first 200 characters of the error message.

Three consequences are already on the record. The $4.54 lost in the Q-0006 crash could not be recovered, because a step that dies takes its own accounting with it. Nobody can answer "what did this ticket cost, per vendor" — the roll-up in `ticket.md` sums only the vendors that report money, so `cost=$8.03` on Q-0006 is the Claude cost of that ticket presented as its total, and `board` has to print a disclaimer under every number. And a run that fails cannot be examined afterwards at all: the run is re-read from a text log by a regex looking for `run=(\d+)`, which is the entire audit trail.

This is also the ticket where the boundary this repository has not yet exercised falls naturally: the engine writes the history, the CLI reads it back for a human. Those are two disjoint file sets owned by two roles on two different vendors, which is what M1's definition of done asks the fan-out to demonstrate.

**Surfaces touched:** the engine (writes), the CLI (reads back), and `.quorum/` (the new files). No Studio work — the UI does not exist until M3.

## User stories

**Solo maintainer.** As a maintainer running several repositories, I want each run to leave a complete record on disk, so that when a run crashes at step four I can see what the first three steps cost me, what the fourth was sent, and what the vendor actually said before it died — without having scrollback open at the time.

**Cold-clone adopter.** As an adopter on my first ticket, I want one command that tells me what a run cost on each of my subscriptions, so that I can decide whether to run the next stage without being shown a single dollar figure that silently omits one of my two vendors.

**Adapter contributor.** As a contributor writing a Gemini adapter, I want the events and usage my adapter emits written to disk in the same shape as every other adapter's, so that I can diff my adapter's record against the reference adapter's and see exactly where mine reports nothing.

## Acceptance criteria

**AC-1 — A run directory exists before any adapter is spawned.** On starting a run, the engine creates `.quorum/runs/<run-id>/` in the repository, where `<run-id>` is `<ticket-id>-<n>` and `<n>` is the run number the engine already derives (`Q-0011-3`). If the directory already exists, the run stops before spawning any adapter, with a message naming the existing directory; it is never reused or overwritten. If it cannot be created, the run stops the same way — nothing has been billed yet, so this failure is free.

**AC-2 — `.quorum/` is excluded from git and is the only thing the run writes outside the ticket.** The run adds `.quorum/` to `.git/info/exclude` (the same mechanism that already excludes worktrees), and a completed run leaves the user's working tree otherwise untouched — verified by `git status` being unchanged apart from the ticket folder's own artifacts.

**AC-3 — The manifest is written at run start and rewritten at every terminal event.** `.quorum/runs/<run-id>/manifest.json` exists from the moment the run starts, with `status: "running"`, the ticket id, the flow name, the stage the run consumed, and the start time. It is rewritten when each step reaches a terminal state and when the run itself ends, so a manifest read while the run is live describes everything that has finished so far. A run killed with Ctrl-C or `SIGTERM` leaves a manifest whose status is `interrupted`, not `running`.

**AC-4 — Every step attempt gets its own numbered directory.** Step records live at `.quorum/runs/<run-id>/steps/<seq>-<step-id>/`, where `<seq>` is a zero-padded counter that increments once per step *attempt* in the order attempts start, and `<step-id>` has `/` and `:` replaced by `-`. A flow that traverses a backward edge and runs `developers` a second time produces two directories, and neither overwrites the other. Fan-out steps produce one directory per task per wave.

**AC-5 — Each step directory records what was sent and what came back.** It contains `prompt.txt` (the exact assembled prompt, byte for byte), `output.txt` (the agent's final message as text, or the raw text that failed validation, whichever the step produced), and `events.jsonl`. A step that never reached the adapter — a script or integrate step — has `events.jsonl` and no `prompt.txt`.

**AC-6 — `events.jsonl` is appended as events happen and is one shape for all adapters.** One JSON object per line, each with `ts`, `seq`, `type` and a `data` object. Lines are appended as the event occurs, so `tail -f` on a live run shows progress; a truncated final line (process killed mid-write) does not make the earlier lines unreadable. Every adapter emits the same event types with the same field names — an adapter's identity appears as a *value* (`"adapter": "codex"`), never as a differently shaped event, so a reader never branches on vendor.

**AC-7 — The step record carries the fields `runs.log` drops.** For each step attempt the manifest records: step id, role, adapter, model (or `null`), branch and worktree path where one was used, start time, duration in ms, adapter retry attempts, terminal status, verdict where the step declared one, error message where it failed, and usage as `{input_tokens, output_tokens, cost_usd}` with `null` for anything the vendor did not report.

**AC-8 — A failed, exhausted or interrupted step is recorded with its usage.** A step whose adapter throws after the vendor has billed it appears in the manifest with `status: "failed"`, its error, and the usage the adapter reported before dying — the Q-0006 crash, replayed against this feature, would show its $4.54. A step interrupted at a gate appears with `status: "interrupted"`. No terminal outcome is absent from the manifest.

**AC-9 — The roll-up is per vendor and never invents money.** The manifest carries a roll-up giving, for each vendor that ran a step: number of steps, summed `cost_usd` where every step of that vendor reported one, summed input and output tokens, and the count of steps that reported no cost. A vendor that reports no cost has `cost_usd: null` — never `0`. The run-level roll-up states how many of its steps were unpriced, and no field anywhere sums money across a priced and an unpriced vendor.

**AC-10 — `harness runs [<ticket-id>]` lists runs.** With no argument it lists every run in `.quorum/runs/`, most recent first; with a ticket id it lists that ticket's runs. Each line shows run id, flow, stage transition, status, duration, and the per-vendor roll-up — money for vendors that report it, token counts for those that do not, `n/a` where a cost is unknown, never `$0.000`. Vendors are listed separately; there is no combined total.

**AC-11 — `harness runs <run-id>` shows one run, and `--json` is machine-readable.** The detail view lists each step attempt in order with its adapter, model, status, duration, usage and — where it failed — its error, plus the run's per-vendor roll-up and the paths of the step directories so a human can open the prompt or the events. `harness runs <run-id> --json` writes a single JSON document as the whole of stdout, suitable for piping, and exits non-zero if the run id does not exist.

**AC-12 — The file formats are contracts the repository can execute.** `contracts/Q-0011/run-manifest.schema.json` and `contracts/Q-0011/run-events.schema.json` are JSON Schema 2020-12 documents describing the manifest and one events line. After an end-to-end run on the mock adapter, `harness validate contracts/Q-0011/run-manifest.schema.json .quorum/runs/<run-id>/manifest.json` exits 0 on the real artifact, and exits 1 with a named error on an artifact where a required field is removed or a cost is set to `0` for an unpriced vendor.

## Non-goals

- **No change to `ticket.md` or `runs.log`.** Neither the `history` frontmatter shape nor any `runs.log` line format changes in this ticket. `contracts/Q-0006/ticket-review-state.schema.json` freezes the history shape and Q-0006 and Q-0033 are in flight over exactly those files; racing them would trade a solved problem for a merge conflict. The join needs no format change: run `3` of ticket `Q-0011` in `history` and `runs.log` is directory `Q-0011-3`.
- **No pricing of token-only vendors.** Settled 2026-08-22: Quorum reports what each vendor reports. No rate table ships, and none is read.
- **No rename of `.harness/worktrees/` to `.quorum/worktrees/`.** Real drift between the spike and the rules, scoped out of Q-0006 and Q-0033 for the same reason. This ticket writes to `.quorum/runs/`; both directories will exist until the rename ticket lands, and that is accepted.
- **No resumable runs.** Reading a manifest back to restart an interrupted run is Q-0019, in M3.
- **No UI.** No screen, no server, no WebSocket. Mission control is M3 and will read these files.
- **No per-turn transcript for vendors that do not stream one.** Claude Code runs with `--output-format json` and returns one envelope; the record will honestly show one event where Codex shows many. Changing that means changing the adapter contract, which is a different ticket.
- **No retention policy, pruning or compression.** Run directories accumulate.
- **No cost budgets or caps.** A budget line in `harness.yaml` is scheduled before M3 and will read this data; it is not built here.

## Open questions

1. **Where does the read-back code live?** *(owner: architect, at solutioning — not a blocker.)* The CLI half of this ticket belongs to the `tooling` role, whose allowed paths are `spike/bin` and `spike/test`; a reusable reader in `spike/src` would belong to `backend`. Either satisfies the acceptance criteria. The question is whether M3's UI wants a reader in core badly enough to pay for the cross-role dependency now.
2. **Should `--json` on `harness runs` print only JSON, when `adapters --json` prints JSON *after* its human output?** *(owner: architect — resolved in AC-11 as JSON-only, because a read-back command exists to be piped.)* If the divergence is unwelcome, aligning `adapters --json` is a separate, additive change and not this ticket's.
3. **Do concurrent runs on one ticket need to be prevented, or merely detected?** *(owner: maintainer — not a blocker.)* AC-1 makes a collision loud rather than silent, which is enough for a single-user local tool. A lock file is more than M1 needs.
4. **How large does a run directory get?** *(owner: architect — not a blocker.)* Prompts include the materialised git diff, already capped at 200 KB. A seven-stage ticket with backward edges could reach tens of megabytes. Worth measuring on the first real run and recording; not worth designing for yet.

## Risks

- **A step id containing `:` or `/` reaching a filesystem path.** Fan-out generates `dev:Q0011-cli`, and branch-shaped ids appear elsewhere. AC-4 requires sanitising, and the repository already has the precedent (worktree directories replace `/` with `__`). A test with a fan-out step id is the cheap guard.
- **Writing history becomes a way to lose a paid run.** If an append fails mid-run — disk full, read-only filesystem — throwing would discard work the vendor has already billed. The engine should warn loudly and continue for append failures, and only refuse outright at AC-1, before anything costs money. This is the one place the "errors are explicit" rule and the "never lose a paid run" instinct point in different directions, and the split is deliberate.
- **The roll-up gets read as a total.** Every surface that shows it must say which vendors it could see; `board` already carries that disclaimer and the new command must too. The failure mode is silent and the number looks authoritative.
- **Scope creep toward a trace viewer.** `events.jsonl` invites a renderer. This ticket writes the file and lists runs; anything that formats a live trace is M3.
- **The contract must be failable on a real artifact, not a fixture.** Q-0006's lesson was that a contract nothing can execute is documentation. AC-12 is written against the repository's own run output for that reason.

## Cross-cutting checklist

| Concern | This ticket |
| --- | --- |
| **BYOS** | No new code path touches credentials. Nothing written under `.quorum/runs/` may capture the process environment: the spawn event records the adapter's argv only. A test asserts no run artifact contains the string of any environment variable value. `check()` is unchanged and still refuses before probing. |
| **Worktree safety** | The engine writes only under `.quorum/runs/`, which AC-2 excludes from git. No flow, step or command writes to the user's working tree. Worktree and branch are *recorded*, never created differently. |
| **Gate behaviour** | Unchanged. No new gate, no gate becomes `auto`. An interrupted gate is recorded (AC-3, AC-8), which is the existing behaviour made visible rather than new behaviour. |
| **File format and schema** | Two new formats, both under `.quorum/`, both specified by JSON Schema 2020-12 under `contracts/Q-0011/` and both executable via `harness validate` (AC-12). No existing format changes. Files stay the database. |
| **Lint rules** | None added. No flow file changes; `harness lint` is untouched. |
| **Cross-vendor rule** | Not applicable to the feature, but the ticket is the M1 fan-out demonstration: the engine files (`spike/src`, `backend`, codex) and the CLI files (`spike/bin`, `spike/test`, `tooling`, claude) are genuinely disjoint, which is what makes this two roles on two vendors rather than parallel work on one. |
| **Cold-clone impact** | Neutral to positive. Writing history adds no interaction and no wait. It adds one command an adopter may never need — and gives them the answer to "what did that cost me" that they will otherwise ask on their first run and not be able to get. |
| **Tests** | The mock-adapter end-to-end suite stays green and gains coverage for the run directory, the manifest, a backward-edge second attempt, a failed step's usage, and the two `harness validate` exit codes. |
| **Docs** | `docs/04-architecture.md` gains the `.quorum/runs/` layout; `docs/GLOSSARY.md` gains **run history** if the term is used in a second file. No DECISIONS entry is needed unless open question 1 moves the reader into core. |

## Size

Twelve acceptance criteria across two surfaces, sitting inside the ten-to-fifteen band set on 2026-08-22. The scope was held there by two deliberate cuts: `ticket.md`'s history stays as it is, and nothing renders a trace. Both are separable, and both are what would have taken this ticket past twenty.
