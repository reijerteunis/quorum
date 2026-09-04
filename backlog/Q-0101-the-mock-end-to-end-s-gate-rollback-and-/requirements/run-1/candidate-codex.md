# Q-0101 — The mock end-to-end's gate, rollback and register half

## Problem

The CLI's failure, gate, and rollback behavior is currently proven by the authoritative spike but is not fully covered by the shipped TypeScript test suites. A regression could therefore change how an exhausted loop stops, how a failed fan-out step preserves artifacts and cost, or how an integrate step rolls back without being detected outside `spike/test/**`.

This ticket is the failure-path half split from Q-0095. Q-0095 owns the shared spawn harness and green-chain scenarios and must land first. This ticket owns ten independent gate, failure, rollback, review, template, and parity-register scenarios. The split is by scenario independence, not by command.

The affected product surfaces are:

- CLI behavior exercised by `quorum run`.
- Harness flow and role templates shipped under `packages/cli/templates/harness/`.
- Persistent ticket and run files under `backlog/` and `.quorum/`.
- Test and parity-register code under `packages/core` and `packages/cli`.

The authoritative behavior remains the unmodified spike until cutover. This ticket must demonstrate parity without changing `spike/src/**` or weakening `spike/test/**`.

## User story

As a **maintainer**, I want the shipped CLI's failure, gate, and rollback paths covered by executable tests so that a failed or interrupted run preserves the correct work, stage, counters, cost, and diagnostic record.

As an **adapter contributor**, I want failures in fan-out and integrate steps to have stable, explicit test oracles so that changes above the adapter layer cannot silently alter cross-vendor run behavior.

As a **cold-clone adopter**, I want human gates and rollback behavior to remain safe by construction so that an automated run cannot bypass a human-locked gate or leave an abandoned merge on the ticket branch.

## Acceptance criteria

1. **Exhaustion stops at the human-locked gate with exit code 3.** On the CLI surface, a fixture flow whose loop is exhausted at a human-locked gate is run with `--auto`. The process must exit with exactly `3`; it must not traverse the gate. Its output must identify the unanswered gate and the artifacts or work retained by the run. The test must assert `exitCode === 3`, not merely a non-zero exit. This carries the behavior asserted by `spike/test/smoke.js:113–121`.

2. **An unanswered non-TTY gate remains undecided.** On the CLI and persistent-run-file surfaces, a non-TTY run that reaches a gate without an answer must record the gate as `undecided` in `runs.log`. It must not record the gate as `failed`, roll back work, advance the ticket stage, or refund the iteration already consumed. The test must assert all five outcomes from the same run. This carries `spike/test/smoke.js:259–267`.

3. **Retry grants exactly one additional traversal.** On the CLI and persistent-run-file surfaces, choosing `retry` at the requirements head-of-product gate must produce exactly three `step=head-of-product` records, record `gate=retry counter=requirements.head-of-product set=1`, and end when the loop advances one traversal beyond its configured limit. A counter belonging to an unrelated step must remain unchanged. This carries `spike/test/smoke.js:234–245`.

4. **A failed fan-out sibling fails the run without erasing valid work or cost.** On the CLI and persistent-file surfaces, when one parallel branch fails and the other succeeds:
   - the overall run fails and the ticket stage does not advance;
   - the successful branch's output remains at `requirements/run-1/candidate-codex.md`;
   - no `candidate-claude.md` exists anywhere below `requirements/`, verified by a recursive search rather than a single expected path;
   - `runs.log` records the failed step;
   - the failed step records its cost, and that cost is included in the run total; and
   - the next attempt receives a different run id.

   The scenario must use the shared spawn harness delivered by Q-0095. This carries `spike/test/smoke.js:141–162`.

5. **Both moved fan-out artifact assertions have valid red witnesses.** Before the final green verification, the chore run's durable verification record must identify two isolated mutations:
   - one mutation that prevents the expected run-scoped candidate from being written, causing the corresponding positive assertion to fail; and
   - one mutation that leaves a failed sibling's candidate anywhere below `requirements/`, causing the recursive negative assertion to fail.

   For each mutation, the record must name the test, the injected break, and the assertion that failed. A failure to start, unrelated process failure, or earlier unrelated assertion is not a valid witness. Mutations may exist only in an isolated copy or documented mutation procedure and must not be committed as product behavior.

6. **A failed integrate step restores the ticket branch and preserves the work branch.** On the CLI, git, and persistent-run-file surfaces, an `integrate` step with no `on_fail` that fails after beginning a merge must:
   - fail the run;
   - leave the ticket branch at exactly its starting SHA;
   - remove the abandoned merge state so a subsequent command starts from a clean base;
   - retain the attempted work on its own branch; and
   - record `rolled-back branch=` in `runs.log`.

   The test must inspect both branch SHAs and repository merge state. This carries `spike/test/smoke.js:359–365`.

7. **A base-sync conflict is explicit and does not consume iteration budget.** On the CLI and persistent-run-file surfaces, a base-sync conflict must fail the run, name both conflicting branches, explain that re-running the developer steps cannot resolve it, and leave the relevant iteration counter unchanged. `runs.log` must distinguish the condition with `base-conflict base=`. The same test group must retain the assertion that solutioning stdout reports the base-sync result. This carries `spike/test/smoke.js:317–319` and `:394–398`.

8. **The shipped review flow traverses both forced verdict paths.** Against the shipped `review.yaml`, tests must cover these two independent rows:
   - `MOCK_ALWAYS_FAIL` with `--gate-answer abort` exits `0`, leaves the ticket at `stage: red`, and emits wording containing `changes-requested`, `development`, or `red`; and
   - `MOCK_ALWAYS_PASS` with `--gate-answer advance` exits `0`, leaves the ticket at `stage: reviewed`, emits `approve`, and writes `review/verdict.md`.

   The scenarios may use the in-process `invoke()` path because the forcing switches do not depend on the mock counter. If placed in `run.test.ts`, they must not spawn the binary, preserving that file's stated contract. This carries S3.2 and S3.3 from `spike/test/q0033-surface.js:170–181`.

9. **Shipped harness templates contain no GPT model pin.** On the harness-template surface, `packages/cli/src/templates.test.ts` must recursively inspect files under `packages/cli/templates/harness/flows` and `packages/cli/templates/harness/roles` and fail if any file matches `/^\s*model:\s*gpt-/m`. The test must have a red witness produced by adding `model: gpt-5` to a template in an isolated fixture copy. The mutation must not alter the shipped templates. Coverage in `capabilities.source.test.ts` is not a substitute because it guards a different subject.

10. **The parity register records completion without changing derived totals.** In `packages/core/src/spike-parity.test.ts`:
    - the `smoke.js` row must name both TypeScript counterpart files and explain which assertion claims each file carries;
    - its `binaryHalf` must stop naming a successor ticket;
    - the `q0033-surface.js` row must gain its sixth counterpart;
    - the two clauses corresponding to the current assertions near lines 1617 and 1694 must be inverted from matching Q-0101 to the existing completed-work shape, `.not.toMatch(/— Q-0101\b/)`;
    - all five parity totals must be re-derived from the source inventory rather than manually adjusted, and their expected values must remain unchanged; and
    - every moved register clause must first be shown red against its superseded value and then green against the completed register.

    The register must continue using `binaryCarriedBy`; no additional verdict category may be introduced.

## Non-goals

- Building or changing the spawn harness or green-chain scenarios owned by Q-0095.
- Changing any file under `spike/src/`.
- Deleting, editing, or weakening existing tests under `spike/test/**`.
- Deleting `spike/`, retiring its CI job, or retiring `harness/port-charter.md`; those belong to the cutover successor.
- Fixing defects tracked by Q-0059, Q-0060, Q-0066, or Q-0068.
- Adding or changing the user-facing `harness` wording owned by Q-0100.
- Changing production gate, retry, fan-out, integrate, or review behavior unless a parity test proves that `packages/core` differs from the authoritative spike. If parity requires a change to `spike/src/**`, implementation must stop rather than change the spike.
- Changing a file format, schema, adapter contract, or cross-vendor rule.
- Adding an API-key path, subscription setup path, dependency, daemon state, UI behavior, or public-registry installation claim.
- Multi-user support, remote daemon operation, cloud sync, a plugin marketplace, a visual flow canvas, eval suites, a Gemini adapter, or a desktop shell.

## Open questions

1. **Is Q-0095 reviewed and does its landed commit include both the shared spawn harness and the two register references re-aimed to Q-0101?** Owner: Q-0095 owner. This is a blocker for the chore run; Q-0101 must not run concurrently with Q-0095.

2. **Has `harness/Q-0101/integration` been created at the intended base SHA before the first chore run?** Owner: repository maintainer. This is a blocker because review compares against that branch and the later integrate step cannot create it in time for review.

3. **What ticket or gate action will receive a refused implementation finding while Q-0083 does not exist?** Owner: head of product. This is a blocker before implementation begins: the implement verdict has no `blocked` state, and an erratum added between review and the next implement step reaches neither step.

4. **Who will allocate the cutover successor, and what ticket id will it receive at Q-0101 close?** Owner: product owner. This does not block the parity work, but it blocks closing Q-0101 without a durable owner for deleting `spike/`, retiring its CI job, and retiring `harness/port-charter.md`.

## Risks

- **Prerequisite drift:** If Q-0095 lands without the expected spawn harness or register re-aim, Q-0101's tests and parity assertions will start from a false baseline.
- **Shared-worktree collision:** Running Q-0095 and Q-0101 concurrently can reuse a worktree and compute the same run id while Q-0039 remains unresolved.
- **False-positive artifact coverage:** A negative assertion against only one path would miss a failed sibling artifact written elsewhere below `requirements/`. The recursive assertion and mutation witness are required controls.
- **Invalid red evidence:** A process startup failure or unrelated earlier assertion could be reported as a red witness even though the intended assertion was never exercised.
- **Destructive rollback fixture:** Git rollback tests can affect the checkout if they do not build and own an isolated repository. Tests must never use the user's working tree as their mutable fixture.
- **Parity-register drift:** Manually adjusting totals or leaving a successor reference after coverage lands would make the register disagree with the actual source inventory.
- **Test environment drift:** Both suites require installed dependencies. Verification must run `pnpm install --frozen-lockfile`, `npm install --prefix spike --no-audit --no-fund`, `npm test --prefix spike`, and `pnpm turbo run test --force`; an uninstalled suite must not be reported as green.
- **Cold-clone impact:** This ticket adds regression tests only and must not add installation steps, runtime dependencies, or public-registry claims. Expected impact: none.
- **BYOS:** No new adapter authentication or subscription behavior is in scope. Tests and fixtures must not introduce an API-key path. Expected impact: none.
- **Worktree safety:** Rollback and branch tests exercise mutable git state and must do so only in repositories created by the tests. The user's working tree must remain untouched.
- **Gate behavior:** Human-locked exhaustion, undecided gates, and retry accounting are directly in scope and must retain their exact exit, stage, counter, and log semantics.
- **Files and schema:** Existing files remain the database. This ticket may assert existing `runs.log`, ticket, artifact, and verdict formats but must not change their schemas.
- **Cross-vendor rule:** No adapter selection or judging contract changes are in scope. Existing cross-vendor linting must remain green.
