# Q-0079 — cross-vendor review, round 1 (hand-run on codex)

*2026-08-30. Run by hand because no flow can review this ticket: `review.yaml` consumes `green`
while the ticket is at `requirements`, `harness/Q-0079/*` does not exist, and the implementation is
already contained in `main`, so the flow's only range would be empty. Q-0070's precedent.*

**Range reviewed:** `0b87690..6adaef4` — the tripwire (`720f155`) and the oracle (`6adaef4`).
**Verdict: revise.** Five majors and one nit.

---

## Findings, as returned

- **major** `git-identity.test.ts:143` — identity is accepted from arbitrary argument text or a
  same-line comment; the scanner never verifies that both values are explicit `-c` pairs before the
  subcommand, so `git(root, 'merge', B); // user.email=x user.name=y` passes.
- **major** `git-identity.test.ts:54` — `git tag -F <file>` and `--file=<file>` create annotated tag
  objects and are absent from `TAG_WRITES`.
- **major** `git-identity.test.ts:22` — the corpus omits tests under `apps/` and root-level test
  scripts such as `.github/scripts/port-freeze-guard.test.mjs`.
- **major** `git-identity.test.ts:73` — excluding the entire tripwire file hides any real
  commit-creating call later added to it; the "load-bearing" assertion only proves fixture strings
  trigger the regex.
- **nit** `git-identity.test.ts:8` — the Q-0079 enforcer labels itself Q-0081 in its JSDoc and
  describe name, creating false ticket provenance.
- **major** `backlog/Q-0080-…/requirements/candidate-claude.md:1` — the change includes an entire
  unrelated Q-0080 requirements run.

---

## Disposition

**Five accepted and fixed** in the commit that carries this file. Each was verified against the code
before being acted on rather than taken on the reviewer's word:

1. **Accepted.** `violations()` read the invocation's own source **line** for `user.email=`, so a
   comment satisfied it. `carriesIdentity()` is now structural: both fields must appear as `-c
   key=value` pairs among the literals consumed before the subcommand, with a non-empty value.
   Three negative fixtures pin it — name missing, not `-c` pairs, empty value.
2. **Accepted.** `TAG_WRITES` gains `-F`, `-u`, `--file`, `--local-user`, and the `--flag=value`
   spellings are matched by prefix. Five new fixtures.
3. **Accepted in part.** `apps/` is now in the corpus — `apps/web` exists and a commit-creating call
   there would have been invisible while the corpus floor stayed green. `port-freeze-guard.test.mjs`
   is **not** added: it is executed by nothing, which this ticket's own requirement established and
   named as someone else's ticket, and adding an unrun file to a corpus would be the same defect in
   the other direction.
4. **Accepted.** The wholesale self-exclusion is replaced by a per-line `scan-fixture` marker. The
   file is scanned like any other, so an **unmarked** commit-creating call added to it now fails,
   and the marker's own load-bearing property is asserted.
5. **Accepted.** Three `Q-0081` references renamed to `Q-0079`. The label was written when this was
   expected to be a separate ticket; it became part of Q-0079 when it was implemented directly, and
   nothing updated the provenance.

**One rejected, and the fault is in the review input rather than the change.** The Q-0080 artifacts
are in the diff because the range I handed the reviewer, `0b87690..6adaef4`, contains `780c4ec` —
Q-0080's requirements-run commit, which landed between the decision entry and the tripwire. No
Q-0079 commit touches a Q-0080 file. Verified: `git diff --name-only 720f155^..6adaef4` names none.
The finding is correct about what it was shown and wrong about what shipped, which is a reviewer
being failed by its evidence — the hazard this repository has paid for twice (Q-0006's empty diff,
Q-0035's diagnostic).
