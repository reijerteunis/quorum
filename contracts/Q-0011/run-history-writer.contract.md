# Run-history writer contract

This contract defines the engine-owned persistence boundary for Q-0011. There is no persisted
event stream. Adapter `onEvent` callbacks remain live-rendering input only.

## Run lifecycle

- Before a non-dry run spawns an adapter or executes a script/integrate command, exclusively
  create `.quorum/runs/<ticket-id>-<n>/`, create `steps/`, export and call
  `ensureExcluded(repoDir, '.quorum/')` from `spike/src/git.js`, and atomically write the initial
  `manifest.json`. An existing or uncreatable run directory is fatal before billing. Dry runs
  create no run-history artifact.
- Persist only project-relative paths. Persist argv when a command record needs it, but never an
  environment object. Tests seed sentinel environment values and assert those values, and the
  switch names themselves, do not occur in artifacts; fixture values intentionally represented
  as domain data (for example `MOCK_VENDOR` becoming `usage.vendor`) are not forbidden.
- Replace `manifest.json` through one engine-owned queue: write a complete same-directory
  temporary file, fsync and close it, then rename it over the manifest. Update after each terminal
  occurrence and at run termination. Two parallel completions must both survive.
- On Ctrl-C or SIGTERM, stop new updates, mark active occurrences and the run `interrupted`, make
  the complete atomic replacement synchronously in the signal-finalisation path, and only then
  exit. The handler must not start unawaited asynchronous I/O before `process.exit`. A SIGKILL may
  leave `running`; readers report that as incomplete and never repair it.
- Failure after initialisation to persist prompt, output, or a manifest update warns with the
  affected path and continues already-billed work. The in-memory snapshot remains authoritative
  for a later replacement attempt.

## Occurrences and files

Allocate an occurrence synchronously, in start order, only when an adapter is about to spawn or a
script/integrate step is about to execute work. For integrate, the merge itself is work: an
integrate step with no install or test command still receives one occurrence and an empty
`output.txt` on successful merge. `commands.install` and the test command, when configured, are
phases of that same integrate occurrence, not separate occurrences; a failure in either phase
ends it with `kind: integrate`, `status: failed`, and error category `integrate`. Its directory is
`steps/<three-digit-seq>-<sanitised-step-id>`; sequence begins `001`, continues past `999` without
truncation, and `/` and `:` become `-`.

Gates allocate no occurrence in any mode. A fan-out parent also allocates no occurrence because it
only schedules work; each materialised fan-out task that calls the adapter receives its own
`kind: adapter` occurrence using the interpolated task step id. Backward traversal and later
fan-out waves allocate fresh occurrences and never overwrite earlier attempts.

Adapter occurrences write exact assembled prompt bytes to `prompt.txt` before spawn and write the
final agent message, or raw structured-output failure text, to `output.txt` when produced. Script
and integrate occurrences have no `prompt.txt` and always receive `output.txt`, including captured
stdout/stderr or an empty file when the command produces no text. Text is unbounded in Q-0011;
silent truncation is rejected.

Each manifest occurrence contains the schema fields. `attempts` counts adapter invocations,
including retries: it is `1` for a first-try success and the actual invocation count on success or
failure after retries; script and integrate use zero. The retry wrapper exposes that count on both
its result and thrown error instead of leaving it only in error prose.

Built-in adapters and their wrapper return one common usage shape. On success and billed failure,
the wrapper stamps `usage.vendor` from the selected adapter's own `adapter.vendor` declaration;
this is the same self-declared provenance exposed by a successful result, not an inference from an
adapter routing name. A billed throw copies its full error and accumulated usage before
propagation. `vendor`, `cached_input_tokens`, and `cache_write_input_tokens` survive accumulation
and the success/error wrapper paths. Unknown measures are null, never zero or inferred. Input
totals already include vendor-reported cache components; readers do not add them again. Output
includes vendor-reported reasoning tokens.

## Status and errors

Occurrences begin `running` and end with the existing engine outcome: `completed`, `failed`,
`aborted`, `regressed`, `exhausted`, or `interrupted`. The run uses the same terminal vocabulary.
Error categories map explicitly: adapter authentication to `auth`, retryable adapter failure to
`transient`, invalid structured output to `structured_output`, other adapter failures to
`adapter`, script and integrate failures to their same-named categories, signals to
`interrupted`, and otherwise `unknown`.

## Roll-up algorithm

Group occurrences with non-null usage by `usage.vendor`. Script and integrate occurrences and
adapter occurrences with no reported usage create no vendor row. For each vendor, `step_count`
counts included occurrences once and `unpriced_steps` counts usage objects whose `cost_usd` is
null. Sum each measure over reported values only; if none reported a measure, the result is null.
Thus a wholly token-only vendor has `cost_usd: null`. Never calculate a cross-vendor monetary
total and never write this accounting back to `ticket.md` or `runs.log`.
