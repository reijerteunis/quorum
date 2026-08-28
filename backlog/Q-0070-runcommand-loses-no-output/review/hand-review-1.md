# Q-0070 — code review, by hand

*`code-reviewer` · codex · run by hand rather than by a flow step. The flow route is unavailable
for three independent reasons, recorded below so nobody spends a round rediscovering them. Codex's
verdict and findings are transcribed verbatim in §2; §3 is the orchestrator's verification of them
and is not the reviewer's opinion.*

## 1. Why this was not `harness run review Q-0070`

1. **Stage.** `review.yaml` consumes `green`; Q-0070 is at `requirements`. The engine refuses a
   flow whose `consumes` does not match the ticket's stage.
2. **No branch.** `harness/Q-0070/*` does not exist. The ticket was implemented by hand, as
   `docs/06-development-plan.md` directs, so there is no `integration` or `implement` ref.
3. **Already contained.** `53731bc` is an ancestor of `main`, so `main...harness/Q-0070/integration`
   would be empty even if the branch existed — the case `materialiseDiff` now refuses with a named
   cause. This is M1's *"review before merging"* finding: `harness run` cannot aim a diff at
   anything but `{base}...integration`, and the `--base <ref>` flag that would fix it is still open.

Cross-vendor is satisfied the way the flow would satisfy it: the change was written on claude, the
review ran on codex.

## 2. The review, verbatim

Verdict: **revise**

major: packages/core/src/fanout/command.ts:126 The implementation cannot detect a capture file that
opens successfully but fails or runs out of space while the child writes. In that case `execSync`
may return success if the child ignores the write error, and `runCommand` returns `code: 0` with
partial output—recreating the false-green condition AC-6 forbids. Detect and surface write/flush
failures as capture errors; apply the equivalent fix at `spike/src/fanout.js:177`.

major: spike/test/q0070-capture.js:97 The spike tests cover capture-directory setup failure but omit
the required read-back failure case that exists in the core suite. This violates AC-6's minimum
coverage and AC-7's requirement for equivalent tests in both trees. Add a spike-side test that
forces capture read failure and asserts that `runCommand` throws a capture-specific error.

## 3. Verification of the two findings

**Finding 2 — confirmed, as stated.** `packages/core/src/fanout/command.test.ts:184` is
*"a capture that cannot be read back throws rather than reporting an empty command"*, asserting
`/could not read back what the command wrote/`. `spike/test/q0070-capture.js` carries only
*"a capture that cannot be created throws, and reports no verdict"* (`:97`). AC-6 requires tests
covering *"at least setup failure and read failure"* and AC-7 requires *"equivalent tests"* in both
trees; the spike suite meets neither. The fix is one test.

**Finding 1 — partly right, and over-stated as a major.** Three things the finding does not say:

- The two `fs.closeSync` calls sit in an **unguarded** `finally` in both trees
  (`command.ts:137–140`, `fanout.js:187–190`), and a deferred write error surfaces at close on the
  filesystems that defer it. There, the failure already throws and already stops the run.
- But it throws a raw `ENOSPC`, not a `captureFailure`. AC-6 requires a throw *"with a message
  naming the capture as the cause"*, so **this is a real gap** — smaller than the finding claims and
  arrived at from the other direction. Wrapping the two calls closes it.
- The case the finding actually describes — the child ignores its own write error and `close`
  reports nothing — is not generally detectable while the child owns the descriptor. There is no
  expected size to compare against. Holding it as a blocker or major would demand something no
  file-capture design delivers.

**Actionable residue:** add the spike-side read-failure test (finding 2), and wrap the two
`closeSync` calls so a reported close failure carries the capture message (finding 1's defensible
half). Both are small and both are inside AC-6's own wording.

*The structural half of AC-7 holds: `spike/src/fanout.js` and `packages/core/src/fanout/command.ts`
carry the same capture, the same disjuncts and the same comments, and landed in one commit.*
