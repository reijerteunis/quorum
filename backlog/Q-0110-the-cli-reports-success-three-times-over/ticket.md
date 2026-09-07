---
id: Q-0110
title: The CLI reports success three times over for a non-success
stage: reviewed
owner: ruud
repos: []
branch: harness/Q-0110/integration
priority: p2
created: 2026-09-07
iterations: {}
history: []
---
> **RULED AND SHIPPED 2026-09-08.** See *"What an exit code may claim, and the three zeros it was
> asked about"* (2026-09-08). **Two of the three below were ruled CORRECT and ratified**, so the
> body's premise — that all three are non-successes — is superseded and left as the record of what
> was assumed. **Changed:** an unknown or absent command reports `ERROR`, while `help`, `--help` and
> `-h` report success. **Ratified:** `regressed` keeps `SUCCESS`, because an exit code reports a
> run's disposition and not its verdict; bare `quorum adapters` keeps `SUCCESS`, because it is a
> report and its own last line disclaims being the gate. **Also changed, and not in the body:**
> `adapters --probe` is the check, so an unusable login now reports `ERROR`.

Three exit paths return 0 where nothing succeeded. Each is a registered preserved defect, each
names this ticket's origin in its own authority line, and the decision they share — **what may an
exit code claim** — has never been taken. Decide it once, then close all three together.

**Opened 2026-09-07, and the reason it is being opened now is the finding.** Q-0090's gate
obligation **GA-4** says, in as many words, *"open the successor for the exit table's two zeros"*.
Searched on 2026-09-07, `GA-4` appears only inside `backlog/Q-0090-…/requirements/merged.md`. No
ticket was ever created, and Q-0090 closed on 2026-09-02. That is an obligation recorded inside a
closed ticket rather than as a ticket — the shape this project has now recorded twice in one week,
the other being Q-0100's, and the shape Q-0105 avoided by opening Q-0108 and Q-0109 at its own
close.

## The three zeros, measured 2026-09-07

| # | site | what exits 0 |
| --- | --- | --- |
| 1 | `packages/cli/src/main.ts:85–92` | an **unknown or absent command** prints the help and returns |
| 2 | `packages/cli/src/exit.ts:61–63` | **`regressed`** shares `completed`'s `SUCCESS` |
| 3 | `packages/cli/src/adapters.ts:20–23` | **`quorum adapters` with both CLIs absent** |

Each carries a `Why: preserved defect` line naming its authority — Q-0090 AC-6, Q-0090 AC-4(c) and
Q-0099 AC-8(c) — and each routes here. `main.ts:83` says *"The successor is Q-0090's GA-4"*;
`exit.ts:62–63` says *"routed to Q-0090's GA-4 successor together with the unknown-command zero"*;
`adapters.ts:22` says *"the successor is Q-0090's GA-4, which carries the unknown-command zero for
the same reason"*.

**GA-4 named two of the three.** Its text is *"An unknown or absent command exits 0 (AC-6), and
`regressed` shares `completed`'s fallthrough (AC-4(c))"*. The third arrived later, routed here by a
source comment Q-0099 wrote — so **the obligation grew in the code after the instruction that
created it was written**, and reading GA-4 alone under-scopes this ticket by one. That is worth
saying out loud because it is the same failure mode one layer down: a record that stops being
complete without anyone editing it.

## Why each is not merely cosmetic

**(1)** is the one an adopter meets. `spike/bin/harness.js:560–562` was a `default:` branch that
printed usage and returned, and the port preserved it. A shell script or a CI step cannot tell *"did
the thing"* from *"did not understand you"*, so a typo in a pipeline is a silent pass.

**(2)** is the one a *run* meets. `regressed` is what a backward edge produces — the ticket's stage
moved **backwards** — and the CLI reports it as success. The mechanism that caused it is already
closed: `EXIT_CODE_FOR_STATUS` is keyed `Readonly<Record<RunTerminalEvent['status'], ExitCode>>`, so
a seventh status fails to compile rather than falling through, which is `exit.ts`'s own JSDoc saying
*"which is exactly how `regressed` came to share `completed`'s code"*. **What remains is the value,
not the shape** — and a value is exactly what a compiler cannot check.

**(3)** is the one a *cold clone* meets. `quorum adapters` on a machine with no vendor CLI installed
reports success, which is the command that exists to de-risk a paid run answering that the risk was
checked.

## The decision, which is one question with three answers

**What may an exit code claim?** The vocabulary already exists and is closed —
`SUCCESS` 0, `ERROR` 1, `ABORTED` 2, `UNDECIDED` 3, `SIGNAL` 130 (`exit.ts:15–38`), with `ExitCode`
a union so a sixth cannot be written by accident. So this is not "invent a code"; it is "choose among
five, three times", and the three answers need not be the same:

- an unmet **precondition** (no CLI installed) is not the same as
- a **misunderstood request** (unknown command), which is not the same as
- a **completed run whose outcome moved the ticket backwards** (`regressed`).

`UNDECIDED`'s own entry is the precedent for how carefully this is done here: it is *"distinct from
`ERROR` on purpose"* because somebody who supplied a word that is not an answer **was** there. The
same care is owed to each of these three.

## What it must not do

**Change one and leave the others.** They are one ticket because they are one question; closing the
loudest and leaving two behind would leave the authority lines pointing at a ticket that is done.

**Move a code without moving what reads it.** `EXIT_CODE_FOR_STATUS` is read by `run.ts`, and
`exit.test.ts` derives its key set from `@quorum/shared`'s schema rather than transcribing it —
`failure-paths.test.ts:549` is the one assertion in `packages/cli` that reads a **spawned** process's
status for a non-zero code, and it is 3. A change here is a change to a contract that is proven
across a real process boundary in exactly one place.

**Decide the colour policy.** GA-4 is explicit: *"None is opened for colour policy until a README
exists to say what a stranger sees."* That stays true.

## Non-goals

Q-0068's BYOS refusal string and `probeAdapter`'s null dereference, which are that ticket's and sit
on the same command for a different reason; the help text's content; `UNDECIDED`'s and `SIGNAL`'s
values, which are settled; and any new exit code, which the `ExitCode` union forbids by design.
