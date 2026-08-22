# `harness runs` reader and validator contract

The reader is implemented in `spike/bin/harness.js` and reads only beneath the selected
`.quorum/runs/<run-id>/` directory. It does not repair, rewrite, or infer terminal state.

## Selection and output

- `harness runs` lists valid manifests most-recent-first; `harness runs <ticket-id>` filters by
  exact `ticket_id`; `harness runs <run-id>` selects the exact directory name. Because both forms
  occupy one positional argument, exact existing run-id match wins; otherwise a value matching a
  known ticket id is a filter, and an unknown value is an unknown-run error.
- List lines contain run id, ticket, flow, `before -> after`, status, duration, and one separately
  labelled vendor summary. Report money when non-null; otherwise report tokens and `cost=n/a`.
  Always include each vendor's unpriced-step count and never print a combined monetary total.
- Detail orders occurrences by the numeric prefix in `occurrence_dir` and includes every field
  required by AC-13 plus the relative occurrence path.
- `--json` emits exactly one JSON document and no ANSI or preceding human output. It returns the
  manifest-derived list/detail plus `incomplete` and `warnings`; event contents are not inlined.
- A missing runs root is an empty success. Unknown exact run ids fail. A malformed sibling is
  named without hiding valid manifests and makes the command fail after rendering those results.

## Incomplete artifacts

A run is incomplete when its status is `running`, it lacks a terminal time, an occurrence lacks
`events.jsonl`, or an events file has malformed JSON (including a truncated last line), a schema
violation, or non-contiguous `seq`. Name every affected relative path. Valid preceding lines may
be read; no warning may be suppressed and no terminal result may be inferred.

## Executable validation

`harness validate <schema> <file...>` keeps JSON/YAML behavior. For a `.jsonl` input it ignores
blank lines, parses and validates every other line independently, and reports all failures as
`<file>:<line>: <schema error>`. When, and only when, the loaded schema `$id` is the Q-0011 event
schema, it additionally applies the stream invariant: the first sequence is 1 and every
subsequent sequence is exactly one greater. The schema's top-level type enum produces a named
unknown-type failure without reporting the failures of every other event shape.

The command parses and compiles the schema once per invocation and reuses that same schema object
for every JSONL line and every input file. It must not re-register the same `$id` with Ajv.

When validating a Q-0011 manifest, it additionally checks invariants JSON Schema cannot express:
unique occurrence directories; status/time consistency; adapter/usage consistency; distinct
vendors in `rollup`; roll-up equality with the manifest occurrences; and `cost_usd: null` when no
occurrence for that vendor reported cost. These semantic checks use schema `$id`, not a filename,
so copied contracts behave identically. Any parse, schema, or semantic error exits 1; all inputs
valid exits 0.

Status/time consistency means `running` requires null `ended_at` and null `duration_ms`, while
every terminal run status requires non-null `ended_at` and `duration_ms`; a running occurrence
requires null `duration_ms`, while every terminal occurrence requires a non-null duration.
Adapter/usage consistency means non-adapter occurrences require null `adapter`, `model`, and
`usage`; adapter occurrences require a non-null `adapter` but may have null `model` and may have
null `usage` when failure occurred before any usage was reported.
