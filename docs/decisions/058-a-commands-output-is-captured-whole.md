# A command's output is captured whole, or the run stops — 2026-08-28

**Decision:** `runCommand` directs a child's stdout and stderr to **two** files in a directory
unique per invocation under `os.tmpdir()`, and builds its result from the complete files after the
child ends. There is no ceiling. The directory is removed on every exit path — clean exit, non-zero
exit, timeout and throw — following the lifecycle already shipped at
`packages/core/src/adapters/codex.ts:95,152,166` and `spike/src/adapters/codex.js:27,78,87` rather
than inventing a second one. A failure of the capture itself — a directory that cannot be created,
a file that cannot be written or read — **throws**, naming the capture as the cause.

That throw is a deliberate break in `runCommand`'s documented contract, and it is the only one.
`command.ts:52` says the function never throws; that sentence is corrected in the same change. The
two alternatives both fail: a new result field is ignored by `engine.js:1042`'s
`testsOk = r.code === 0`, and reusing `code` or `timedOut` makes an infrastructure failure
indistinguishable from a verdict. Because `engine.js`'s `backlog.log(… tests=…)` line is never
reached on a throw, the property holds **structurally** — a broken capture can never satisfy
`expect: pass` or `expect: fail`, and can never write `tests=ok` or `tests=invalid`. That is *"never
default silently"* and the mirror of *"a check that skips its subject must not report success"*
(2026-08-25).

**Two capture files, never one.** A shared file interleaves, and the composition contract depends on
the separation: `out` is stdout **only** on the success path and stdout **followed by** stderr on the
failure path. A single shared descriptor would add all of turbo's and vitest's stderr to every
*green* `integrate` run's `output.txt` and `dev/integration.md`. The existing `'OUTERR'` assertion
does not discriminate — two sequential writes land in that order either way — so the test that
separates them is `printf OUT; printf ERR >&2; printf OUT2; exit 1` → `out: 'OUTOUT2ERR'`.

**Q-0070 is executed by hand, not through a flow.** It is the third option in *"Do not drive
harness-machinery work through the harness"* (2026-08-23) — *"hand-written acceptance tests, a
smaller cut, or a stage run manually"* — and that entry's own prescription. `runCommand` is the
function `integrate` itself calls, so a flow run would drive the change through the instrument being
changed. The eleven criteria in `requirements/merged.md` are already a complete specification, and
AC-3's matrix run against the unchanged function is the red phase without the flow. The change lands
in `spike/src/fanout.js` **and** `packages/core/src/fanout/command.ts` together — the Q-0066/Q-0068
shape — or the port loses the independent witness the freeze exists to provide.

**Alternatives considered:**

**(a) Raise the ceiling** — an explicit `maxBuffer` justified in the JSDoc as a multiple of the
largest observed real output. Cheap, preserves `CommandResult` exactly, and it was the answer one of
Q-0065's two candidates gave. Rejected on the matrix below: it fixes the three benign cells and
**provably cannot reach the dangerous one**, because in that cell the bytes never leave the child and
no ceiling is involved. It moves a cliff, and a cliff that has moved is harder to find. It is also
the more expensive option in landed pins — keeping overflow possible means it must then
*distinguish* overflow from timeout, which costs a new field on `CommandResult` (both
`toStrictEqual` pins) and a changed disjunct set (`fanout.source.test.ts`'s three-disjunct
assertion). Removing the ceiling deletes the ambiguity instead: after it, `SIGKILL` can only mean a
timeout, because no output volume kills anything, and all three of those pins survive untouched.

**(b) Capture inside the worktree** rather than under `os.tmpdir()` — refused, because `commitAll`
runs `git add -A` (`fanout.ts:287`) and a capture file would be committed onto the step branch, and
*"never write to the user's working tree"* is a hard constraint. `.quorum/` is run history, not
scratch.

**(c) Report a capture failure rather than throw** — a `bytes` or `truncated` field on
`CommandResult`. Refused above: it buys nothing once nothing truncates, it is silently ignored by
the one line that decides `tests=ok`, and it costs both whole-object pins and the field count.

**(d) Route it through the chore flow** — refused by the chore role's own escape clause: *"If the
work turns out to change behaviour rather than machinery, say so: that ticket belongs in the full
pipeline, not here."* This changes an observable result, breaks a documented never-throws contract,
adds a failure mode and makes an artifact unbounded. A correct chore implementer stops and reports,
and the round is spent before a line is written.

**(e) Route it through the full SDLC** — defensible, and it answers the red-phase argument honestly,
since a test that runs a 2 MiB-producing child genuinely fails now and passes after. Rejected because
it never engages the 2026-08-23 entry above, and Q-0033's six qa-red attempts at roughly $41 without
ever producing a usable red are the measured precedent for this kind of subject.

**Why: three of the four cells are the benign ones, and the fourth is not an overflow at all.** The
subject has been measured four times and three earlier records were wrong in three different places,
so the table below is the one re-derived at Q-0065's gate against the real `runCommand`, three runs
per cell, Node v24.15.0. A child writes 2 MiB to stdout; the variables are whether it writes
monolithically or progressively, and whether it ends naturally or calls `process.exit()`.

| 2 MiB written | ends naturally | calls `process.exit()` |
| --- | --- | --- |
| **monolithic** | `code 1`, `timedOut: true`, 1,114,112 B | **`code` = the child's own, `timedOut: false`, 65,536 B** |
| **progressive** (2048 × 1 KiB) | `code 1`, `timedOut: true`, ~1,050,000 B | `code 1`, `timedOut: true`, ~1,050,000 B |

Three cells are a genuine `maxBuffer` overflow, and they fail closed. Node kills the child with the
configured `killSignal`, which both trees set to `SIGKILL`, and `timedOut` tests that signal — so an
overflow reports a fifteen-minute timeout about a command that finished in twenty-six seconds,
`engine.js:1046` converts it to `envError`, and the reader is sent to `commands.install` to fix an
environment that was never broken. It costs a run and a diagnosis, never a merge. Q-0048's
implementer's *"the buffer defect wearing the timeout's clothes"* hypothesis holds; they named the
wrong disjunct.

The fourth cell is the one this entry exists for, and it is **not a `maxBuffer` overflow**.
`process.exit()` does not flush a piped stdout, so the child discards its own unwritten bytes and
one pipe buffer — 65,536 of 2,097,152 — is all that is ever delivered. Nothing about the result looks
unusual: the captured length is far *below* `maxBuffer`, so no length check catches it either. If
that child exits 0, `runCommand` returns `code: 0`, `integrate` writes `tests=ok`, and `expect: pass`
is satisfied by a suite whose output was thrown away. The same two children redirected to a file
deliver **2,097,152 bytes complete in both cells**, because writes to a file are synchronous on
POSIX and `process.exit()` cannot discard them.

**A third cost no earlier record names: the exit status is destroyed too.** In the overflow cells the
child is killed before it can exit, so a child that writes 2 MiB and exits 3 is reported as
`code: 1`. The defect is not only lost output — it is a lost verdict, which is worse, because a
verdict is what `integrate` reads.

This is the same class as *"The test command defeats its own cache"* (2026-08-27) and *"A green tick
names what it examined"* (2026-08-27): a green tick claiming more than it examined, arriving through
the one function every configured `commands.test` and `commands.install` runs through
(`engine.js:600`, `:1036`, `:1042`).

**Cost accepted.** `output.txt` becomes unbounded — today the 1 MiB ceiling caps it incidentally.
Measured rather than feared: the largest `output.txt` under `.quorum/runs/` is **71,318 bytes**, the
five largest cluster at 70–71 KB, and the largest run-history file of any kind is a **242,181-byte
review `prompt.txt`** that nothing bounds either, 3.4× the largest output. Total `.quorum/runs` is
16 MB. So unbounding `output.txt` is a smaller change than it reads, and the real question — whether
run history is archival or diagnostic, and whether a cap belongs on prompts first — is deliberately
left open rather than answered in passing. `testReport` (`engine.js:505–516`) already keeps 12,000
bytes of head and tail with an omission marker and is the shape to copy if a cap is wanted.

**Not decided here:** whether a *passing* command should keep discarding its stderr. It does today,
so a suite that passes with warnings loses them; the change preserves that, because altering it is
scope creep wearing a bug fix's clothes. It is now visible, written down and tested, which it was
not before.

**Found by:** Q-0065's requirements gate, which split this ticket out and drafted its body in full so
the obligation could not expire; the matrix by re-measuring against the real function rather than
against `execSync`; and the composition asymmetry, the seventh landed pin and the never-throws
contradiction by Q-0070's own requirements run, whose head-of-product refused twice — correctly —
because this entry did not yet exist and no step in that flow may write one.
