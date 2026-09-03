# Q-0092 — CLI runs command and the run-history presentation layer

## Problem

The workspace CLI does not yet provide the spike’s `runs` command. A maintainer cannot list persisted run history or inspect one run through `quorum`, even though `packages/core` already provides the read-only run-history operations.

This ticket must port only the command’s selection and presentation behavior. It must not duplicate domain logic already in `packages/core`, change the persisted manifest format, or repair known defects while translating the behavior.

Surface: **CLI (`quorum`) only**. The command reads files under `.quorum/runs/`; it adds no Studio, `harness/`, or `backlog/` behavior.

## User story

As a **solo maintainer**, I want to list run history, filter it by ticket, and inspect an individual run in human-readable or JSON form, so that I can understand run status and vendor-reported usage without opening manifest files manually.

## Acceptance criteria

1. **Command registration and project resolution.** The CLI registers `quorum runs` in the existing command-dispatch table and executes it through `main(argv)`. It resolves the project through `packages/core`’s existing project-loading API, including support for the parsed `--project <directory>` flag, and reads run history from `<repoDir>/.quorum/runs`.

2. **Core owns all reading and domain decisions.** The implementation imports and uses the existing applicable APIs from `packages/core`, including `readRunsDir`, `sortRuns`, `isIncomplete`, `occurrenceSeq`, `vendorTokenTotal`, and the existing run-directory confinement and ticket-id parsing APIs. The CLI does not copy these algorithms, perform manifest repair, infer missing persisted values, or write any file.

3. **List selection.** With no positional value, `quorum runs` lists every readable manifest returned from `.quorum/runs`. Runs are ordered by `started_at` descending and then by `run_id` ascending in plain string order; for equal timestamps, `Q-0011-10` therefore precedes `Q-0011-2`.

4. **Exact run selection takes precedence.** For `quorum runs <value>`, a confined, existing directory directly inside `.quorum/runs` takes precedence over interpreting `<value>` as a ticket id. The command reads only that selected run’s `manifest.json`; malformed or missing sibling manifests do not affect detail output or its exit status.

5. **Run-directory confinement.** Detail selection accepts only one path segment whose real resolved parent is the real `.quorum/runs` directory. Empty values, `.`, `..`, nested paths, absolute paths, and symlinks resolving outside the runs root are not read. A rejected value discloses no contents from outside the runs root.

6. **Ticket filtering and unknown values.** If `<value>` does not select a run directory but matches the existing ticket-id grammar, the command lists only manifests whose `ticket_id` equals `<value>`. It does not consult `backlog/`. Zero matches on a clean history store produce the successful empty-list state. A value that selects neither a run nor a syntactically valid ticket id prints `unknown run or ticket: <value>` and fails.

7. **Store warnings and exit status.** In list or ticket-filter mode, a missing `.quorum/runs` directory is a successful empty state. An unreadable, missing, malformed, or minimally misshaped sibling manifest is named as a warning while all readable siblings are still rendered. Any such warning sets a non-zero final exit status, including when a ticket filter has zero matches. The command uses the CLI’s soft-failure path so output is not truncated.

8. **Human list header.** Each human-readable list entry shows, on one header line, `run_id`, `ticket_id`, flow, stage as `<before> -> <after>`, status, and duration. A missing stage endpoint renders as `?`; a null duration renders as `duration=n/a`; otherwise duration is milliseconds converted to seconds with one decimal place. A run is additionally labelled `(incomplete)` when its status is `running` or `ended_at` is null.

9. **Human list vendor summaries.** Beneath each list header, each roll-up row is rendered separately as `<vendor>: cost=<money> tokens=<total> unpriced_steps=<count>`. Money is `n/a` when null and otherwise uses a dollar sign and exactly three decimal places. The token total is `input_tokens + output_tokens` over non-null values and is `n/a` only when both are null. Cached-input measures remain breakdown fields and are never added to this total. No combined cross-vendor money total is rendered.

10. **Successful empty human list.** When a list or ticket filter has no readable matching runs, human output contains the explicit empty state `· no runs found`. Warnings, when present, are printed after that state and still cause the non-zero result required by AC-7.

11. **Human detail header and completeness.** Human detail begins with the same header representation as a list entry. If the manifest is incomplete, a separate warning contains `incomplete` and the project-relative path to its `manifest.json`. Completeness depends only on status being `running` or `ended_at` being null; no other file is inspected.

12. **Human detail occurrence ordering and fields.** Detail renders every entry in `manifest.steps`, including failed entries and entries with null usage, ordered by the numeric prefix in `occurrence_dir`; an unparseable prefix sorts after parseable prefixes. Each occurrence shows its `step_id`, the slash-normalized project-relative path `.quorum/runs/<selected-run-id>/<occurrence_dir>`, kind, adapter, model, status, `started_at`, `duration_ms`, attempts, and verdict. Applicable null values render as `n/a`. If an error exists, its category and message are shown.

13. **Occurrence usage is not a roll-up row.** A non-null occurrence usage value renders exactly one usage line containing vendor, cost, `input_tokens`, `output_tokens`, `cached_input_tokens`, and `cache_write_input_tokens`. Each of the four measures is formatted independently, with null rendered as `n/a` and never as `0`. The line does not contain `tokens=<sum>` or `unpriced_steps`. A null usage value renders as `usage: n/a`. A regression test proves a step with input `100`, output `1000`, and cache measures present displays the four measures rather than a collapsed roll-up total; the inherited `tokens=1100` assertion remains confined to roll-up presentation.

14. **JSON list output.** `quorum runs --json` and `quorum runs <ticket-id> --json` write exactly one parseable, ANSI-free JSON document to stdout with this shape: `{ "mode": "list", "runs": [...], "warnings": [...] }`. Each run contains only `run_id`, `ticket_id`, `flow`, `stage`, `status`, `started_at`, `ended_at`, `duration_ms`, derived `incomplete`, and the manifest’s `rollup` or an empty array. Each warning is the string `<run-directory>: <message>`. The ordering and exit rules from AC-3, AC-6, and AC-7 also apply.

15. **JSON detail output.** `quorum runs <run-id> --json` writes exactly one parseable, ANSI-free JSON document to stdout with this shape: `{ "mode": "detail", "run": <parsed-manifest>, "incomplete": <boolean>, "manifest_path": <project-relative-path>, "warnings": [] }`. The `run` value is the parsed manifest without presentation-derived roll-ups or mutation.

16. **Malformed selected manifest and unknown JSON errors.** If an exact selected run has an unreadable or malformed `manifest.json`, JSON mode emits one ANSI-free document `{ "error": "run \"<value>\": malformed manifest.json (<reason>)" }` and fails. An unknown value similarly emits one JSON error document and fails. Human mode sends the corresponding error, prefixed by the existing red failure marker, to stderr and fails.

17. **Presentation module contract.** The CLI presentation layer provides TypeScript equivalents of the spike behavior represented by `formatMoney`, `formatTokens`, `formatVendorSummary`, `formatOccurrenceUsage`, `statusLabel`, `runHeaderLine`, `printRunsListHuman`, `runsListJSON`, `printRunDetailHuman`, and `runDetailJSON`. Export visibility may follow the package’s established testing convention, but each behavior is covered through the command boundary; helper-only tests do not substitute for command tests.

18. **Inherited binary coverage.** Tests under `packages/cli` translate the `runs` portions of `spike/test/q0011-runs-cli.js` and `spike/test/q0011-run-history.js`, including list and filter selection, ordering, empty history, warnings, non-zero warning status, detail ordering, incomplete manifests, every occurrence, null usage, accounting presentation, JSON list/detail/warning/error modes, and read-only behavior. The Q-0037/Q-0034 regression for per-occurrence usage is also translated. Tests invoke the registered handler through `main(argv)` and do not make their verdict depend on user git configuration or pre-existing ignored files.

19. **Parity register.** `packages/core/src/spike-parity.test.ts` is updated in the same change so both inherited files name the new `packages/cli` counterpart for their translated binary halves. `q0011-runs-cli.js` remains classified as `split`, retaining its existing library and `validate` counterparts while adding the `runs` counterpart. All pinned register identities, counts, and line totals are re-derived from the resulting repository state rather than incremented by assumption.

20. **Spike remains the witness.** No file under `spike/src/` or `spike/test/` is changed, deleted, or weakened. The workspace adds its own implementation and coverage under `packages/cli`. If parity cannot be achieved without changing the spike, implementation stops and reports the blocker.

21. **Verification.** After installing dependencies as required by `harness/rules.md`, both `npm test --prefix spike` and `pnpm turbo run test --force` pass. The TypeScript implementation is strict, introduces no `any` or unjustified `@ts-ignore`, and passes the workspace lint task without adding deprecated API use.

22. **Cross-cutting constraints.** This read-only presentation command adds no subscription-authentication path, performs no worktree or branch operation, changes no gate behavior, adds no persistent state or schema, introduces no vendor-specific knowledge outside manifest display, adds no dependency, and does not alter either supported cold-clone installation path.

## Non-goals

- Changing `packages/core` run-history semantics or moving presentation decisions into core.
- Adding, changing, validating, migrating, repairing, deleting, or terminalising run manifests.
- Reimplementing `manifestShapeError`, `readRunsDir`, `sortRuns`, `isIncomplete`, `occurrenceSeq`, `vendorTokenTotal`, run-directory confinement, or ticket-id parsing in `packages/cli`.
- Fixing the preserved disagreement where list mode silently skips a symlinked run directory that detail mode may accept when the symlink resolves to a sibling directory inside `.quorum/runs`.
- Changing the ruling that `vendorTokenTotal` returns null when both input and output totals are null even if cache fields are populated.
- Adding a combined cross-vendor money total or collapsing occurrence usage into a roll-up summary.
- Adding JSONL, alternate output formats, pagination, search, deletion, pruning, export, or live monitoring.
- Changing the run-manifest schema or the `validate` command delivered by Q-0091.
- Implementing `run`, `init`, `ticket`, `board`, `adapters`, the Studio, or any M3+ run-history surface.
- Editing or deleting spike implementation or tests before cutover.
- Adding a public-registry installation claim or changing cold-clone setup instructions.
- Addressing multi-user access, a remote daemon, cloud sync, a plugin marketplace, a visual flow canvas, eval suites, a Gemini adapter, or a desktop shell.

## Open questions

1. **Owner: Q-0092 engineer — non-blocking.** Which `packages/cli` test filename or filenames should be recorded as the binary counterparts in the parity register? Use the package’s established organization, but the chosen files must exist, be collected by the suite, and collectively cover AC-18. This does not change behavior or a file format.

No product, manifest-format, adapter-contract, or architecture question remains open. The occurrence-versus-roll-up representation and the two preserved defects are already ruled and are binding on this ticket.

## Risks

- A presentation helper may accidentally duplicate a core reader rule, allowing CLI behavior to drift from future Studio consumers.
- Reusing the roll-up formatter for an occurrence would hide cache breakdown fields, turn null measures into a misleading sum, and reintroduce the defect guarded by the inherited `tokens=1100` assertion.
- Calling `readRunsDir` before deciding whether the value selects detail would make one run unreadable because of an unrelated malformed sibling and would scale detail reads with total history size.
- Using a hard exit for list warnings could truncate valid run output that must accompany the warning.
- Applying only lexical path checks would allow a symlink to escape `.quorum/runs` and disclose an external `manifest.json` through JSON output.
- Treating cached-input measures as additional summands would double-count input already included by adapters.
- Updating parity counts by hand instead of re-deriving them could leave the register green while falsely claiming that inherited binary coverage has transferred.
- Detail mode intentionally returns the parsed manifest rather than validating its complete schema. A deeply malformed selected manifest can therefore retain spike behavior outside the listing’s minimal-shape guard; fixing that is outside this port.
