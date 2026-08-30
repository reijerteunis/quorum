# An erratum is the last repair, not the first — 2026-08-30

**Decision:** When a bounded loop exhausts on a criterion no round can satisfy, the criterion is the
**last** thing to change. The order is: establish why it cannot be satisfied, down to the specific
mechanism; ask whether that mechanism is itself a defect — a permission, a configuration, a missing
prerequisite — and repair it if so; and only then, if the criterion is genuinely unsatisfiable by
anything the project controls, write the erratum. An erratum that amends a criterion the
environment could have met is a weakening that hides a real defect, and it leaves the defect in
place for every ticket after this one.

**An erratum written on a premise that later turns out false is withdrawn by a further entry**, in
the same file, naming what changed. It is not left standing on the grounds that it described its
own rounds accurately.

This extends *A requirement may not name a surface its flow cannot write* (2026-08-25). That rule
asks which file a step may write; the same question has other axes — which command it may run,
which evidence only a later step can produce — and all of them are questions about the environment
the requirement was written against, not about the requirement.

**Alternatives considered:** **Treating the erratum as the standard exit from an exhaustion gate.**
It is the established practice here and it is right when the blocker is a human decision no agent
can perform; it is wrong when the blocker is a misconfiguration, and the two are indistinguishable
from inside the loop, because both present as an implementer that correctly reports it cannot
comply. Rejected as a default for exactly that reason. **Fixing the environment without recording
it.** Rejected: the repair and, where one was written, the withdrawal are both part of why the
ticket cost what it cost. **Leaving the superseded erratum standing** because it was true of the
rounds it was written about — rejected on the rule Q-0050's E-7 already applied to its E-6(a): a
record saying a thing is discharged elsewhere becomes false the moment the thing is done directly.

**Why: three rounds and roughly $24 were spent on a criterion that one line of configuration made
satisfiable, and nobody looked at the configuration until round three.** Q-0038's AC-12 required
`npm install --prefix spike --no-audit --no-fund` before the spike suite could be reported green —
quoting `harness/harness.yaml`'s own `commands.install` correctly. `.claude/settings.json` granted
npm per *verb* and granted only `test`, so `install`, `ci` and even the read-only `ls` were refused.
The repository mandated a command its own permission config forbade.

Every round was correct and that is what made it expensive. The implementer reported honestly,
declined to route around a refused command with a third tool, and declined to grant itself the
permission it was blocked by — which would have meant writing outside its role to satisfy a
criterion about its own verification. The reviewer refused to approve an unmet criterion. **More
rounds buy more correct refusals**, and an erratum amending the criterion was the obvious exit. It
was taken, and it was wrong.

**The finding also looked pedantic and was not, which is the trap.** Rounds 1 and 2 argued the
substituted `pnpm` install was equivalent, round 2 checking five packages against
`spike/package-lock.json` and finding five matches. The real install reported `added 4 packages, and
changed 3`, moving `fast-uri` to **3.1.5** to match the lockfile. A pnpm install ignoring npm's
lockfile produced a genuinely different tree, exactly as the comment above `commands.install` warns.
Careful measurement reached the wrong conclusion three times; one execution settled it.

**What separated cause from cause was an experiment, not a reading.** Round 3 re-attempted the
install with the sandbox override set and was refused identically, which distinguished *a sandbox
denying the write* from *an allowlist denying the command* — two hypotheses the earlier rounds had
left merged. A refused command has more than one possible cause, and reading the refusal cannot
tell them apart; see *A check is not established by reading it* (2026-08-29).

**The cost is not only the rounds — it is the reviews that did not happen.** For three rounds the
reviewer's entire attention went to one blocking finding about the implement report's verification
section, and no round examined the change. The round after the blocker was cleared produced the
first real code review of the run and found a genuine pre-existing hazard nobody had considered
(now Q-0078). **A blocking finding crowds out review**, so an unsatisfiable criterion does not
merely burn rounds; it buys reviews that never look at the code. That is the argument for spending
the first round on *why*, rather than the third.
