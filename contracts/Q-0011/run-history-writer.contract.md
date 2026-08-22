# Run-history writer contract

This behavioural contract complements the two JSON Schemas. The schemas define individual
documents and event lines; the invariants below are cross-file or state-transition rules and
therefore cannot be expressed by JSON Schema alone.

## Adapter boundary

`adapter.run(options)` retains its current result shape and receives `options.onEvent(payload)`.
Built-in adapters translate native output into `{ type, data }` payloads before calling it; an
adapter never supplies run metadata. The occurrence writer stamps `schema_version`, UTC `ts`,
and the next contiguous `seq` while serialising the append, producing an envelope that validates
against `run-events.schema.json`. Engine and readers never parse vendor-native text.
`raw` is preservation-only: removing all `raw` lines cannot change a timeline's terminal state,
usage, verdict, retries, or roll-up.

Each adapter result and thrown billed error carries the complete usage shape from the schema.
Unknown values are `null`, not zero. Retry aggregation preserves all five measures and emits a
`retry` event for every retry. The final aggregate is emitted once as `usage`; it is the usage
copied into the manifest occurrence and counted once in the roll-up.

## Writer lifecycle

- Before a non-dry run can spawn anything, create `.quorum/runs/<ticket-id>-<n>/` exclusively,
  add `.quorum/` to `.git/info/exclude` through the existing git helper, create `steps/`, and
  atomically write the initial manifest. Existing or uncreatable directories are fatal before
  billing. Dry runs do none of these writes.
- Allocate an occurrence synchronously at step-attempt start. Its directory is
  `steps/<zero-padded-seq>-<sanitised-step-id>`; replace `/` and `:` with `-`. Allocation order,
  not completion order, defines the sequence and makes parallel allocation collision-free.
- Open one append stream per `events.jsonl`. Serialize writes for that occurrence. Each complete
  UTF-8 JSON serialization plus newline is one append; event `seq` starts at 1 with no gaps.
  History append failures warn and disable further history writes for the affected artifact but
  do not cancel already-billed work.
- Write exact prompt bytes before adapter spawn and exact final/raw validation-failure text when
  available. Non-adapter occurrences always have `events.jsonl`, never have `prompt.txt`, and
  have `output.txt` only when the script, integration, or gate produced textual output. Persist
  argv only in `step_started.data.argv`; there is no `spawn` event. Never persist an environment
  object or environment value.
- Serialize manifest updates through one promise queue. Write a complete same-directory temporary
  file, fsync/close it, then rename it over `manifest.json`. Update after every terminal occurrence
  and at run termination. Store project-relative paths only.
- Signal handlers finalize the active occurrence where applicable and the run as `interrupted`.
  Run terminal status uses the existing engine outcome. A billed throw copies its full error and
  usage before propagation. Every started occurrence remains represented.

## Status and gate mapping

Manifest occurrences begin `running`. `step_completed` terminates them as `completed`,
`aborted`, `regressed`, or `exhausted`; `step_failed` terminates them as `failed` or
`interrupted`. Run status has the same terminal vocabulary plus `running`, but is a flow outcome,
not a copy of the last occurrence. A gate answer (`advance`, `retry`, or `abort`) is a successful
gate occurrence: its occurrence status is `completed` and its answer is the `verdict`; `abort`
then makes the run `aborted`. A backward-edge declaration terminates that adapter occurrence as
`regressed`. The occurrence that reaches its traversal limit terminates as `exhausted`. Ctrl-C
or SIGTERM terminates every active occurrence and the run as `interrupted`.

## Roll-up algorithm

Group terminal adapter occurrences by `usage.vendor`; exclude script, integrate, and gate
occurrences. For each vendor, `step_count` counts occurrences and `unpriced_steps` counts usage
objects whose `cost_usd` is null. Sum each numeric measure over reported values only; if no
occurrence reported that measure, the roll-up field is null. This makes an entirely unpriced
vendor's `cost_usd` null. Never produce a cross-vendor monetary total. The manifest roll-up must
equal a fresh grouping of the occurrences' final `usage` events.

## Prompt-size decision

Text events and output files are unbounded in Q-0011. Silent truncation would defeat diagnosis;
introducing a safe bound requires a new explicit truncation event and measured evidence. The
existing 200 KB materialised-diff cap still bounds that prompt component.
