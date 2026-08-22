# Review runtime contract

This is the behavioural interface implemented by the spike CLI and engine. It is a test
contract, not a second implementation.

## Configuration and variables

- `harness/harness.yaml` accepts `repo.base_branch: string` and
  `repo.max_diff_bytes: positive integer`. Missing values resolve to `main` and `200000`.
- `harness init` writes the current branch as `repo.base_branch` in the generated config.
- At review run start, `{base}` is the resolved base branch and `{round}` is one plus the
  greatest integer `N` for which `review/round-N/verdict.md` exists. If none exists it is
  `1`. A directory without a verdict does not advance the number. `{iter}` is unchanged.

## Diff input

For a step with `input.diff`, the engine resolves the range and, before spawning any
adapter, verifies both the base ref and `harness/<id>/integration`. A missing base ref is
an error naming `repo.base_branch`, `harness/harness.yaml`, and the ref. The prompt embeds:

1. the complete `git diff --stat <base>...harness/<id>/integration`;
2. the patch from `git diff <base>...harness/<id>/integration`, truncated by UTF-8 byte
   length to `repo.max_diff_bytes`;
3. an explicit truncation notice when truncation occurred.

The same notice is appended to `runs.log`. Review steps remain read-only and create no
worktree or branch.

## Verdict routing and counter

On `changes-requested`, validate structured output before changing state. Increment
`iterations.review` once per accepted traversal. Counts `1`, `2`, and `3` regress to the
`consumes` stage loaded from the `flow:development` target and finish with `regressed`;
the target flow is not run. Attempt `4` persists count `4` and enters an exhaustion gate
without changing stage.

The exhaustion gate cannot be bypassed by `--auto`. Its reason includes counter `review`,
current count, limit, outstanding blocker/major findings, and `advance`, `retry`, `abort`.
An answer comes from `--gate-answer advance|retry|abort` or stdin. Missing, empty, or
invalid input is an error. `advance` continues toward `reviewed`; `retry` resets only
`iterations.review` and authorises exactly one additional traversal to the configured
target; `abort` ends with unchanged stage. The reset is logged.

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
