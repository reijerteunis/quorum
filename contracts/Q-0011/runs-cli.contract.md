# `harness runs` reader and manifest validator contract

The reader lives entirely in `spike/bin/harness.js`. It resolves the repository through the
existing project-loading path and reads `.quorum/runs/`; after selecting a run it reads only that
run directory. It never repairs or infers persisted state.

## Selection and ordering

- `harness runs` lists all readable manifests. An exact existing directory `<run-id>` wins and
  selects detail. Otherwise a positional value matching the ticket-id pattern `^[A-Z]+-[0-9]{4}$`
  is a
  `ticket_id` filter using manifests only; zero matches is an empty list and exit zero, whether
  the ticket has never run or does not exist elsewhere. Any value that is neither an existing run
  directory nor syntactically a ticket id is an unknown-run error. The reader never consults
  `backlog/` to distinguish a typo from a ticket with no history.
- List order is `started_at` descending, then `run_id` ascending as a deterministic tiebreaker.
  Do not sort lexically by run number.
- A missing runs root prints the empty state and exits zero. A malformed sibling is named, valid
  siblings are still rendered, and the final exit is non-zero.

## Human and JSON output

List rows show run id, ticket, flow, stage `before -> after`, status, duration, and separately
labelled vendor summaries. A vendor with cost shows money and tokens; one without cost shows
`cost=n/a` and tokens. Every summary states `unpriced_steps`; there is no combined money total.

Detail orders attempts by the numeric occurrence prefix and shows adapter, model, status, start,
duration, verdict, usage, error, and the project-relative step-directory path. A manifest is
labelled incomplete, with its path named, when status is `running` or `ended_at` is null. No other
file is required for completeness.

`--json` emits one JSON document as all stdout, without ANSI. It contains the selected list or
manifest-derived detail plus warnings and `incomplete`; unknown ids exit non-zero.

## Executable manifest validation

Existing JSON/YAML `harness validate` parsing is unchanged. JSONL support is not added. JSON
Schema validates document structure. Semantic checks use the schema annotation
`x-quorum-contract: run-manifest-v1`, not a ticket-specific `$id` or filename, and check:

- unique occurrence directories and unique roll-up vendors;
- running/terminal timestamp and duration consistency;
- adapter versus script/integrate nullability;
- roll-up equality after grouping every non-null occurrence usage exactly as the writer contract
  specifies.

If the annotation is absent or unrecognised, print an explicit notice that run-manifest semantic
checks were skipped; a structurally valid generic JSON document may still pass, but never with a
misleading run-manifest green tick. The annotation's checks catch the AC-14 mutation where a real
token-only run's `manifest.json` roll-up `cost_usd` is changed from null to zero: recomputation
from its occurrence usage expects null and reports that vendor and field. Occurrence
`usage.cost_usd: 0` remains legal when the vendor actually reported zero.
