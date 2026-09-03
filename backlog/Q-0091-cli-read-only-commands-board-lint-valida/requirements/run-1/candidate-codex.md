# Q-0091 — CLI read-only commands: board, lint, validate, adapters

## Problem

The workspace CLI does not yet expose four read-only commands that exist in the spike: `board`, `lint`, `validate`, and `adapters`. Maintainers therefore cannot inspect ticket status, lint flows, validate artifacts, or check adapter readiness through the workspace-local or locally packed `quorum` binary.

These commands are presentation layers over APIs already provided by `packages/core`. Porting them must preserve the spike’s observable command-line behavior without moving domain logic into `packages/cli`, changing files or git refs, modifying the spike witness, or fixing known defects assigned to other tickets.

Surface: CLI (`quorum`). The commands read files, repository state, installed adapter CLIs, subscription state when explicitly probed, and command arguments. They do not add or change persistent product state.

## User story

As a **maintainer**, I want to run `quorum board`, `quorum lint`, `quorum validate`, and `quorum adapters` so that I can inspect the backlog and verify flows, artifacts, and adapter readiness without changing my repository.

As a **cold-clone adopter**, I want these inspection commands to behave the same through the documented workspace-local and locally packed installation paths so that I can diagnose setup and repository problems without supplying an API key or risking changes to my working tree.

As an **adapter contributor**, I want `quorum adapters --probe` to exercise the same core adapter probe used by a real run so that readiness results test the adapter contract without vendor-specific behavior leaking into the CLI.

## Acceptance criteria

1. **CLI — command availability.** The workspace CLI recognizes `board`, `lint`, `validate`, and `adapters`; each appears in CLI help with its supported arguments and flags. The implementation delegates domain work to the existing `packages/core` exports rather than duplicating the spike’s domain helpers in `packages/cli`.

2. **CLI — read-only invariant.** For each of the four commands, automated tests record the relevant repository files and git refs before invocation and demonstrate that the command does not create, delete, or modify files and does not create, delete, or move refs. Adapter probes may execute an installed vendor CLI and make the request needed to verify its subscription, but Quorum itself persists no result.

3. **CLI — project resolution.** `board`, `lint`, and `adapters` resolve the Quorum project using the workspace CLI’s existing project-loading behavior. Their paths are derived from that resolved project rather than assumed from the process working directory. Existing `dirOf` traversal behavior is preserved, including the known Q-0059 defect.

4. **CLI — board grouping.** `quorum board` reads tickets through `Backlog`, visits stages in `STAGES` order, and prints tickets under their current stage. Empty `draft`, `requirements`, and `solutioned` stages remain visible; other empty stages are omitted. Where a loaded flow consumes a displayed stage, the stage heading identifies the corresponding `quorum run <flow> <id>` command.

5. **CLI — board ticket row.** Every displayed ticket row includes its id, title, owner, total billed cost derived from its history and formatted to two decimal places, and its iterations object. Existing row wording and ordering remain compatible with the spike surface tests.

6. **CLI — board cost qualification.** If any displayed ticket has history, the board prints the existing qualification that the total includes billed cost only where an adapter reports one and excludes steps for token-only adapters. With no ticket history, that qualification is not printed.

7. **CLI — contained branch.** When core containment reports a ticket branch as contained in the configured base branch, the ticket row contains exactly one containment token in the form `<base>:contained`. The command uses the configured base branch literally and never substitutes `main` for a different configured value.

8. **CLI — branch not contained.** When core containment reports a ticket branch as not contained, the row contains exactly one token in the form `<base>:not-contained(+N)`, where `N` is the core result’s count of commits in `base..branch`, not the symmetric-difference count.

9. **CLI — indeterminate containment.** When core containment reports an indeterminate result that should be displayed, the row contains exactly one token in the form `<base>:indeterminate(<reason>)`. If at least one row has such a token, the board prints one legend explaining that git could not answer and that indeterminate does not mean the code is missing. The board never describes containment as “merged” or “landed.”

10. **CLI — absent ticket branch.** A missing ticket branch is not annotated when the ticket stage is `draft`, `requirements`, `blocked`, or `abandoned`. It is rendered as `<base>:indeterminate(no branch)` when the stage is `solutioned`, `red`, `green`, `reviewed`, `qa-passed`, or `deployed`. A ticket with no `branch` field receives no containment token at any stage.

11. **CLI — unresolved repository state.** A missing base ref, shallow history that cannot prove ancestry, or another failed git query is rendered using the reason returned by core and never as a containment claim. Outside a git repository, or when no containment result is available for a ticket, the board still prints the ordinary board and exits successfully without exposing raw git errors.

12. **CLI — hostile and ambiguous refs.** `board` passes ticket branch values through core’s safe containment interface. An injection-shaped branch value cannot add a git option or create a file. A branch remains resolvable when a tag has the same name.

13. **CLI — empty board.** `quorum board` exits 0 for an empty backlog and does not print a fatal or indeterminate diagnostic solely because there are no tickets.

14. **CLI — lint report.** `quorum lint` calls core `lintDirectory` for the resolved project’s `harness/flows` directory and renders every returned record using the established CLI report format. It does not independently parse or lint flows.

15. **CLI — lint exit status.** `quorum lint` exits 0 when the core directory report is successful and exits 1 when it is unsuccessful. The output includes successful file records and all reported diagnostic blocks, including cross-flow and cross-vendor lint failures, without silently dropping records.

16. **CLI — lint/run consistency.** For the same invalid flow directory, the diagnostic block printed by `quorum lint` matches the diagnostic block used by the CLI’s run preflight for that file.

17. **CLI — adapters default report.** `quorum adapters` checks the `claude` and `codex` adapters obtained from core using the resolved project’s adapter configuration. For each adapter, it prints either a successful installed-version line or the error returned by `adapter.check()`. One adapter’s failed check does not prevent the other adapter from being checked.

18. **CLI — adapters without probe.** Without `--probe`, the command does not call `probeAdapter`, records successful adapter checks with `login: unverified`, and prints the existing notice that presence alone does not verify subscription login and that `quorum adapters --probe` performs that verification.

19. **CLI — adapters probe.** With `--probe`, each adapter whose check succeeds is passed to core `probeAdapter` with the resolved repository directory. A successful probe prints that login was verified, its round-trip duration, and cost or token fields only when those values are present. A failed probe prints `login not usable` and the core probe error. The probe is the same core operation used to prove subscription readiness; the CLI does not implement a second probe.

20. **CLI — adapters BYOS refusal.** If `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, or `CODEX_API_KEY` is present, the affected adapter check refuses before checking whether its vendor CLI is installed or attempting a probe. `adapters --probe` cannot bypass this ordering. The existing refusal wording, including its current use of “Harness,” is preserved for Q-0068.

21. **CLI — adapters JSON.** With `--json`, `quorum adapters` prints a JSON object after the human-readable report with `probed` set from the presence of `--probe` and an `adapters` array containing one result per checked adapter. Check failures have `installed: false` and the error; successful unprobed checks have `installed: true`, their version, and `login: unverified`; probed checks report `login: verified` or `login: failed` and retain the core probe fields.

22. **CLI — adapter failure compatibility.** Existing spike behavior for command exit status and the known Q-0066 probe-crash defect is preserved. This ticket does not convert per-adapter failures into a new aggregate exit policy and does not catch or reinterpret the Q-0066 failure in passing.

23. **CLI — validate usage.** `quorum validate` requires one schema path followed by at least one artifact path. Missing either part prints `usage: quorum validate <schema.json> <file…>` through the CLI’s standard error path and exits non-zero.

24. **CLI — schema read ordering.** Before opening any artifact, `validate` calls core `readData` for the schema. If the schema cannot be read, it stops with `cannot read schema <path>: <reason>` and does not validate an artifact.

25. **CLI — artifact validation.** For each supplied artifact, `validate` calls core `validateArtifact(schema, artifact)` exactly once and derives structural and semantic output from that single result. It does not read the artifact a second time to select semantic checks.

26. **CLI — valid and invalid artifacts.** A successful artifact prints `<artifact> matches <schema>`. An invalid artifact prints `<artifact> violates <schema>:` followed by every core validation error. An unreadable artifact prints its path and the thrown reason, then validation continues with later artifacts.

27. **CLI — validate aggregation.** `validate` processes all supplied artifacts in argument order. It exits 0 only if every artifact is valid and readable; it exits 1 if one or more artifacts are invalid or unreadable.

28. **CLI — skipped semantic notice.** When core reports `semantic.ran: false` with reason `unrecognised-annotation`, the CLI prints a notice that distinguishes an absent or unsupported `x-quorum-contract` annotation from a failed check. The notice retains the words **“run-manifest semantic checks were skipped”**, states that no semantic checks ran, does not claim that they passed, and identifies `run-manifest-v1` as the only defined semantic contract.

29. **CLI — structurally invalid run manifest.** When a recognized run-manifest contract is structurally invalid, the CLI reports its structural errors and does not print the unrecognized-annotation skipped notice. Semantic validation remains selected and performed by core.

30. **CLI — installation-path parity.** Automated CLI tests exercise the commands through the built workspace-local binary. The existing locally packed installation test proves the emitted CLI package and its core dependencies can run outside the repository; Q-0091 must not introduce a workspace-only import or filesystem assumption that breaks that path. No output, test, or documentation claims that registry-resolved `npx quorum` is supported.

31. **Tests — transferred surface coverage.** Tests under `packages/cli` cover the applicable binary behavior inherited from `spike/test/q0033-surface.js` and all behavior from `spike/test/q0036-board-containment.js`, including exact board containment tokens, read-only assertions, lint reports, board cost and iteration compatibility, configured base branches, shallow clones, missing refs, missing branches, hostile ref input, and tag/branch name collisions. The four commands also receive direct success, failure, output, and exit-status coverage even where the inherited files do not supply a scenario.

32. **Tests — spike remains the witness.** No file under `spike/src/` or `spike/test/` is modified or deleted. The spike suite remains green until Q-0010 cutover.

33. **Tests — parity register.** `packages/core/src/spike-parity.test.ts` is updated in the same change. The entries for `q0033-surface.js` and `q0036-board-containment.js` are reclassified to name their new `packages/cli` counterparts. All pinned file line totals and classifications are re-derived from the resulting files rather than incremented by an assumed amount.

34. **Tests — required verification.** After installing both dependency sets as specified by `harness/rules.md`, `npm test --prefix spike` and `pnpm turbo run test --force` pass. The changed TypeScript also passes the workspace lint and type-check tasks with strict typing, no new deprecated API usage, no `any`, and no unjustified `@ts-ignore`.

35. **Cross-cutting — files and schema.** The commands introduce no persistent file format, schema, daemon state, or hidden cache. `validate` consumes existing JSON or YAML formats through core; JSONL support is not added.

36. **Cross-cutting — gates and worktrees.** These commands do not run a flow, create a worktree, change a gate, or alter human-gated behavior. The safety criterion for this ticket is that invocation leaves the user’s working tree, Quorum files, and refs unchanged.

37. **Cross-cutting — product scope.** CLI presentation remains product-agnostic. Vendor names appear only where the adapter inventory requires `claude` and `codex`; vendor-specific command behavior remains inside the corresponding adapter.

38. **Cross-cutting — cold-clone impact.** The commands add no installation step, configuration requirement, or required subscription beyond the vendor CLI subscriptions already needed to probe or run those adapters. Running without `--probe` does not make a subscription request.

## Non-goals

- Changing or adding domain behavior in `packages/core`.
- Modifying any file under `spike/src/` or `spike/test/`.
- Deleting spike coverage before Q-0010 cutover.
- Fixing Q-0059’s traversing `dirOf` behavior.
- Fixing Q-0060’s silent-frontmatter behavior.
- Fixing Q-0066’s adapter probe crash.
- Replacing “Harness” in the BYOS refusal; that belongs to Q-0068.
- Changing the run-manifest contract or amending files under `contracts/`.
- Adding JSONL validation or a new semantic contract annotation.
- Adding an API-key execution path, test fixture, documentation example, or fallback.
- Adding adapters beyond `claude` and `codex`.
- Adding persistence for board containment or adapter status.
- Adding `--json` output to `board`, `lint`, or `validate`.
- Changing ticket stages, histories, iterations, costs, branches, or flows from these commands.
- Porting unrelated CLI commands, including `init`, `ticket`, `run`, or `runs`.
- Supporting registry-resolved `npx quorum`; that belongs to Q-0029.
- Adding a remote daemon, cloud sync, plugin marketplace, visual node canvas, eval suite, Gemini adapter, desktop shell, or multi-user behavior.

## Open questions

1. **Coverage accounting — owner: Q-0091 engineer; non-blocking for implementation, blocking for completion.** The ticket states that `q0033-surface.js` has 446 lines and `q0036-board-containment.js` has 221 lines while describing 698 inherited lines; those figures total 667. What are the line totals in the implementation commit? The parity register must use re-derived inventory values, and the completion report must identify the source of any difference.

2. **Transferred scenario map — owner: Q-0091 engineer; blocking for completion.** Which individual scenarios in `q0033-surface.js` are assigned to Q-0091’s CLI tests, given that the source file also covers commands and assets outside this ticket? The implementation must record the scenario-to-counterpart mapping in `spike-parity.test.ts` without claiming unrelated coverage was ported.

## Risks

- Thin CLI code can still drift from the spike in exact text, ordering, conditional notices, or exit status even when core results are correct.
- A board implementation may accidentally collapse stage and containment into one state or use forbidden synonyms such as “merged” or “landed.”
- Ref lookup can become unsafe if the CLI bypasses core containment or constructs git arguments itself.
- A shallow clone or missing ref can be falsely reported as not contained, turning missing evidence into a negative claim.
- A validate implementation can read an artifact twice, select semantic checks from a filename, or describe a skipped check as passed.
- Adapter readiness can falsely appear usable if presence is treated as a verified subscription, or the BYOS refusal occurs after the CLI probe.
- Human-readable adapter output followed by JSON is intentionally not a JSON-only stream; consumers may incorrectly assume `--json` suppresses other lines if tests do not preserve the spike behavior explicitly.
- Broadly reclassifying `q0033-surface.js` could make the parity register claim that unrelated `init`, asset, or gate coverage has transferred.
- Tests that inspect the current repository’s branch state would become permanently green after branches land. Containment tests must build and control their own repositories.
- Test results can vary by machine if fixtures depend on ambient git identity, ignored directories, installed vendor CLIs, or inherited environment variables. Fixtures must set their own git identity and adapter behavior, and BYOS tests must set and restore the relevant environment explicitly.
