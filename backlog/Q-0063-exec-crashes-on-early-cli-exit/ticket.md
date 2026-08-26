---
id: Q-0063
title: A CLI that exits before reading its prompt crashes the run with EPIPE
stage: reviewed
owner: ruud
repos: []
branch: harness/Q-0063/integration
priority: p1
created: 2026-08-26
iterations: {}
history: []
---
Found on 2026-08-26 while diagnosing why CI had been red on every run since 2026-08-24. It presents
as a flaky test and it is a defect in the adapter layer, on the path every real run takes.

**The defect.** `exec()` (`spike/src/adapters/claude.js:70–83`) is the shared spawn helper for
**both** shipped adapters — `claude.js:32` and `codex.js:58` both pass `stdin: prompt`. It attaches
listeners to `p.stdout`, `p.stderr` and the child object, and **none to `p.stdin`**:

    p.on('error', (e) => resolve({ code: -1, stdout, stderr: String(e) }));
    p.on('close', (code) => { … resolve({ code, stdout, stderr }); });
    if (stdin != null) p.stdin.end(stdin); else p.stdin.end();

`p.on('error')` catches **spawn** failures, not stream failures. When the child exits before
consuming stdin, the write fails with `EPIPE` on a stream that has no `'error'` listener, and Node
throws `Unhandled 'error' event` — taking down the whole process rather than failing the step.

**The race is not theoretical.** A pipe buffer is 64 KB on both Linux and macOS. Q-0043's prompts
were **54,554** chars (`implement`) and **133,057** chars (`review`), so the second one provably
cannot be written in a single pass — the writer blocks and depends on the child draining it. Every
step whose prompt exceeds 64 KB is exposed, which by now is most of them.

**What triggers it in production, and why the failure mode is the worst available.** The trigger is
*the vendor CLI exits before reading its prompt*: an expired login, a rejected model alias, an
unknown flag after a CLI update, a crash. Those are the four failures this project has already paid
to learn about. Instead of surfacing the vendor's own message, Quorum dies with a stack trace naming
`node:events` and nothing about which step, which vendor or why — the exact class M0 recorded as
*"a failure that withholds the one thing the reader needs"*, and it defeats `authError()`, which
exists at the contract layer precisely so that a dead login reads as one actionable sentence.

**Evidence.** CI job `spike (regression suite)`, run 32794141599 and every run before it back to at
least 2026-08-24. The crash lands in `q0011-run-history.js` scenario `EDGE-21`
(`test/q0011-run-history.js:185`), whose second half writes a `fake-codex` shell script that never
reads stdin, sets `adapterOverride: 'codex'`, and exits 0 immediately. Locally the write wins the
race and the suite is green; on a loaded CI runner the child wins and the process dies. **The test
is not wrong** — it is an accurate, if accidental, reproduction of a vendor CLI that ignores its
prompt, and it should keep reproducing it after the fix.

**The fix, and the two things it must not do.** Attach an `'error'` handler to `p.stdin` and treat
`EPIPE` as *the child closed its input*, resolving through the normal `close` path so the child's
own exit code, stdout and stderr are what the caller reports. It must **not** swallow the condition
silently — a prompt that was never delivered is a fact the run needs, and *"errors are explicit"*
applies. And it must **not** convert every stdin error into a step failure before `close` arrives:
the vendor may have exited 0 having read enough, and the exit code is the authority.

**Worth checking in the same pass:** `exec()` resolves rather than rejects on `p.on('error')`, so a
missing binary returns `code: -1` with the error text in `stderr`. That is deliberate and should
stay; confirm the new handler composes with it rather than racing it.

**Resolved 2026-08-26, in the spike, by hand.** Authorised by Ruud and recorded as erratum **E-2**
in `backlog/Q-0009-…/requirements/errata.md`, which also adds this ticket to `harness/port-charter.md`
§3's freeze-SHA table and obliges **Q-0047 to port the fixed `exec()`**, not the pre-fix shape — the
spike is the port's independent witness and this edits it. **It is not a freeze exemption**: §3 binds
Q-0009's fifteen tickets and the `children` list holds Q-0041–Q-0054; Q-0063 is not among them, the
same way Q-0038 and Q-0040 are not.

`p.stdin` now carries an `'error'` handler that treats `EPIPE` as *the child closed its input*,
appending one line to `stderr` and letting `close` resolve, so the child's own exit code, stdout and
stderr stay the authority. Non-`EPIPE` stream errors resolve `code: -1`, matching what `p.on('error')`
already did for spawn failures.

`spike/test/q0063-stdin-epipe.js` covers five cases: exit 0 without reading, non-zero exit reporting
its own code and message, the truncation recorded rather than swallowed, a CLI that *does* read its
prompt being unaffected, and a missing binary still resolving `-1`. **Verified red before green** —
reverted to the pre-fix source, the suite reproduces the CI crash verbatim (`write EPIPE`, unhandled
`'error'` event, process killed). Both suites green afterwards: 12 spike test files, 7 workspace
tasks with a forced run.

**Original scope note, superseded above.** `spike/src` is frozen (`harness/port-charter.md` §3). The fix lands against
`packages/core` with Q-0047 (`core/adapters` — claude and codex), which owns `exec()`. **P1 and
worth pulling forward**: it is on every run's path, it is currently the reason CI cannot be trusted,
and a red CI that everyone has learned to ignore is how the next real regression ships. If Q-0047 is
far off, this is a candidate for fixing in the spike under an explicit charter §2 exception rather
than waiting. Belongs to M2 in `docs/06-development-plan.md`.
