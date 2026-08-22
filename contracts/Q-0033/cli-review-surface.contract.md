# Q-0033 CLI review surface contract

This is the CLI, configuration, and static-analysis interface for Q-0033. The engine
semantics remain governed by `contracts/Q-0006/review-runtime.contract.md`, with E-1 in
`backlog/Q-0006-review-flow-and-cross-flow-backward-edge/solution/errata.md` superseding
its retry-value clause.

## Configuration and init

The resolved repository configuration has these optional inputs:

| key | accepted value | default |
| --- | --- | --- |
| `repo.base_branch` | non-empty Git ref name string | `main` |
| `repo.max_diff_bytes` | integer greater than zero | `200000` |

Both shipped `harness.yaml` files explicitly contain the keys and a one-line explanatory
comment for each. `harness init [dir]` copies the template, then attempts to discover the
current branch of `dir`. If Git returns a named current branch, only
`repo.base_branch` is replaced with that name; `repo.max_diff_bytes` remains `200000` and
all other template values remain unchanged. The edit preserves the copied YAML's comments
and formatting, including the one-line comments on both `repo` keys and the existing
`commands.install` comment. An unborn HEAD whose current branch Git can name is a discovery
success. Outside Git, or for detached, unborn, or other HEAD states whose current branch Git
cannot name, discovery is best-effort: init retains `main`, exits zero, and does not expose
Git stderr.

## Whole-directory validation

There is one validation operation over the pristine `harness/flows/*.yaml` files loaded
from disk. `harness lint` invokes it and accumulates diagnostics for every offending
source flow before exiting non-zero once. `harness run` invokes the same operation before
loading the ticket, writing its folder or `runs.log`, calling an adapter, or applying an
in-memory `--adapter` override. An equivalent defect therefore has the same diagnostic
through both commands.

The operation implements every clause of
`contracts/Q-0006/review-lint.contract.md`:

- resolve each `goto: flow:<target>` to a loadable target and walk the return chain from
  the target's `produces` stage until the source flow's `consumes` stage;
- index flows by `consumes`, reject dead ends and ambiguity only when reached, and track
  `(flow, stage)` pairs so cycles and self-targets terminate with explicit diagnostics;
- require each `on_fail.max_iterations` to be an integer greater than zero and its
  `counter` to be a non-empty, unprefixed key, suggesting `review` for
  `iterations.review`; and
- in `cross_vendor: required` flows, require a parallel group of at least two same-role
  members to span at least two adapters, naming every member and the shared adapter on
  failure.

Cross-flow diagnostics name source flow, target flow, terminal stage, and implicated
flows for ambiguity or cycles. Bound diagnostics name step and field. Temporary fixtures
cover positive `review -> development` and `review -> qa-red` chains plus missing target,
dead end, reached ambiguity, cycle, and `review -> review` dying at `reviewed`; shipped
flows are never mutated to create a fixture.

## Gate-answer input

`--gate-answer advance|retry|abort` is repeatable. Parsing accumulates all occurrences of
this flag only; all other flags retain their existing last-wins behavior. The gate callback
consumes exactly one answer per encounter, in command-line order.
Values are exact words after trimming and case normalization; prefixes are not accepted.
An answer invalid for the current gate is an error rather than an implicit alternative.

When explicit answers are exhausted, an interactive TTY may be prompted. With non-TTY
stdin, or missing, empty, or invalid input, the command exits non-zero with a diagnostic
naming the gate and does not block or default. `--auto` does not provide an answer for an
engine-presented exhaustion gate of kind `human-locked`.

At that exhaustion gate, `retry` persists `iterations.review = max_iterations`, which is
`3` for the shipped limit. Q-0006 errata E-1 supersedes the frozen runtime contract's
`max_iterations - 1` / persisted `2` clause; a test expecting `2` is incorrect.

## Observable compatibility

`harness board` receives no production change. It continues to print persisted
`iterations.review` in `iter={...}` and sums a run's cost once: the exhaustion event is
zero-cost and the terminal event carries the measured cost.
