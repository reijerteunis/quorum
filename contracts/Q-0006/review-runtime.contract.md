# Review runtime contract

This is the behavioural interface implemented by the spike CLI and engine. It is a test
contract, not a second implementation.

## Configuration and variables

- `harness/harness.yaml` accepts `repo.base_branch: string` and
  `repo.max_diff_bytes: positive integer`. Missing values resolve to `main` and `200000`.
- The template config contains `repo: {base_branch: main, max_diff_bytes: 200000}`.
  `harness init` replaces `base_branch` with the current branch when Git can identify
  one. Outside a repository, or on an unborn branch Git cannot identify, it keeps `main`
  and succeeds without an error.
- At review run start, `{base}` is the resolved base branch and `{round}` is one plus the
  greatest integer `N` for which `review/round-N/verdict.md` exists. If none exists it is
  `1`. A directory without a verdict does not advance the number. `{iter}` is unchanged.

## Diff input

For a step with `input.diff`, the engine resolves the range and, before spawning any
adapter, verifies both the base ref and `harness/<id>/integration`. A missing base ref is
an error naming `repo.base_branch`, `harness/harness.yaml`, and the ref. A missing
integration ref is an error naming the ticket id, the expected
`harness/<id>/integration` ref, and that review requires an integrated branch. The prompt embeds:

1. the complete `git diff --stat <base>...harness/<id>/integration`;
2. the patch from `git diff <base>...harness/<id>/integration`, truncated by UTF-8 byte
   length to `repo.max_diff_bytes`;
3. an explicit truncation notice when truncation occurred.

The same notice is appended to `runs.log`. Review steps remain read-only and create no
worktree or branch.

## Verdict routing and counter

Before any ticket-folder write or `adapter.run`, `harness run` invokes the complete
flow-directory validation in `review-lint.contract.md`, including target resolution and
the return-chain walk. Runtime target loading remains defensive but is not the first
point at which a bad target is discovered.

On `changes-requested`, validate structured output before changing state. Increment
`iterations.review` once per accepted traversal. Counts `1`, `2`, and `3` regress to the
`consumes` stage loaded from the `flow:development` target and finish with `regressed`;
the target flow is not run. The CLI reports target flow, `stage_before -> stage_after`,
current count, limit, and remaining ordinary traversals. Attempt `4` persists count `4`,
records an `exhausted` history/log event when the gate is presented, and enters an
exhaustion gate without changing stage. The later gate answer adds a second terminal
event (`completed`, `regressed`, or `aborted`) rather than replacing the exhaustion event.

The exhaustion gate cannot be bypassed by `--auto`. Its reason includes counter `review`,
current count, limit, outstanding blocker/major findings, and `advance`, `retry`, `abort`.
Answers come from repeatable `--gate-answer advance|retry|abort` flags, consumed once in
encounter order, then from stdin. Thus exhaustion `advance` and closing-gate `abort` are
expressible as two flags. If answers run out on non-TTY stdin, or input is missing,
empty, or invalid, the process exits non-zero with an error naming the gate; it never
blocks or defaults. `advance` continues toward `reviewed`; `retry` sets only
`iterations.review` to `max_iterations - 1` (persisted value `2` for the shipped limit),
then regresses to the configured target. The next accepted rejection increments to `3`
and is the one additional regression traversal; a following rejection re-presents the
gate at `4`. Other counters are unchanged and the reset is logged. `abort` ends with
unchanged stage.

## Rework sync

At the start of every development fan-out task, an existing task worktree merges
`harness/<id>/integration` before the adapter runs, including the first in-run iteration.
A conflict emits a warning naming the task and conflicting paths; it is never hidden.
Development prompt input includes optional `review/verdict.md`.

## Atomic failure rules

Invalid structured output is saved under the ticket's `.harness/` directory and produces
`failed` without stage or counter change. A parallel panel uses all-settled semantics:
successful artifacts remain, but any failed reviewer prevents verdict execution and
leaves stage and counter unchanged.

## Audit compatibility

Every terminal outcome (`completed`, `regressed`, `exhausted`, `aborted`, `failed`) is
appended to both `runs.log` and ticket `history`, with run id, flow, status, stage before,
stage after, timestamp, and cost. Existing legacy history entries shaped as
`{stage, run, flow, at, cost}` remain valid and are not rewritten. New entries also write
`stage: stage_after` as a compatibility alias. The exhaustion-presentation event has
unchanged `stage_before` and `stage_after` and `cost: 0`; the later terminal event for
the same run carries its full measured cost exactly once. `harness board` requires no production
change; its regression test asserts that persisted `iterations.review` appears in the
existing `iter={...}` output.
