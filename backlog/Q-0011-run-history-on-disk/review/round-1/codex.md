# Code review findings

## major — Billed usage is lost when post-adapter processing fails

`spike/src/engine.js:239`

After an adapter returns successfully, several operations can throw before `terminalOccurrence` persists the response usage at line 260: writing declared outputs, writing verdict files, committing the worktree, or logging. The outer handler at `spike/src/engine.js:133` then marks the occurrence failed with only an `unknown` error; it does not retain `res.usage`, vendor, or attempt count. Consequently a billed call can appear with `usage: null` and be excluded from the roll-up, defeating AC-10 and the ticket’s primary accounting goal.

Recommendation: retain the adapter result on the occurrence immediately after the call returns, or wrap all post-response processing so any later failure terminalizes the occurrence with the returned usage, vendor, attempts, and an appropriate error before propagating.

## major — Adapter failures can omit the required `output.txt`

`spike/src/engine.js:223`

The failure path creates `output.txt` only when the thrown error has a non-null `raw` field. Billed failures such as the mock failure carry usage but no `raw`, leaving an adapter occurrence without `output.txt`. AC-5 requires every step directory to contain `output.txt`; this also makes the on-disk shape depend on adapter-specific error behavior.

Recommendation: always create `output.txt` for an allocated adapter occurrence, using the available raw/final text and an empty file when the adapter produced no text.

## major — Run selection permits reads outside `.quorum/runs/`

`spike/bin/harness.js:401`

The positional token is joined directly to `runsRoot`, and any resulting existing directory is accepted as an exact run. Tokens containing `..`, `/`, or absolute-path components can therefore select a directory outside `.quorum/runs/`; its `manifest.json` is parsed and, in JSON mode, echoed to stdout. This violates AC-13’s confinement to the selected run directory and turns the command into an arbitrary JSON-file disclosure mechanism.

Recommendation: require exact run selection to be a single valid run-directory basename, resolve the candidate path, and verify its parent is exactly the resolved runs root before reading it.

## major — Ticket-filtered lists succeed despite malformed run siblings

`spike/bin/harness.js:417`

The ticket-filter branch renders all collected warnings but returns without setting a non-zero exit code. Thus `harness runs Q-0011` exits 0 even when a malformed run directory was encountered and named. AC-12 and the CLI contract require malformed siblings to preserve valid output but make the command exit non-zero; only an actually empty, clean ticket filter should receive the specified successful empty result.

Recommendation: set `process.exitCode = 1` whenever `warnings.length > 0` after rendering a ticket-filtered list, matching the unfiltered list behavior.
