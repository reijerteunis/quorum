# Q-0011 — Scope cut, superseding the round-4 review

**This supersedes `solution/review-round-4.md` for the findings it names.** The requirement was
cut on 2026-08-23 (see `requirements/merged.md` § Scope cut): `events.jsonl`, the typed event
envelope and `harness validate`'s JSONL support are gone with AC-6 and AC-7. Revise the solution
and the contracts to the reduced surface. Do not re-argue the cut, and do not carry the removed
capability forward "for later" — a contract for a file nothing writes is the thing four rounds
kept tripping over.

## Round-4 findings that are now void — delete the surface, do not fix it

- **`step_started` cannot be produced by any layer.** Gone with AC-7. Adapters keep emitting
  whatever they emit to `onEvent` for live tracing; nothing is persisted from it and no schema
  describes it.
- **Raw-independence manufactures the `seq` gap that other criteria call an error.** Gone with
  AC-6. There is no `seq` on events any more; `seq` survives only as the zero-padded directory
  prefix in AC-4.
- **Gate occurrences are undefined for auto-advanced gates.** Resolved in the requirement, not
  deferred: AC-4 now says a directory is allocated only for an attempt that spawns an adapter or
  runs a command, so gates allocate none in any mode.
- **The `--verbose` renderer migration.** Gone with AC-7. `ui.trace` is untouched by this ticket.

## Round-4 findings that still stand — close these

- **The mock contract contradicts itself on vendor.** "Switch values are never copied into
  run-history artifacts" against `HARNESS_MOCK_VENDOR` being the emitted `usage.vendor`. Scope
  the promise to the switch *names and values as environment*, and scope AC-2's assertion to
  match, or the multi-vendor roll-up tests and the no-environment test cannot both pass.
- **`kind` omits `fan_out`.** A fan-out parent is a real step with an id. Say whether it gets a
  directory — consistent with AC-4's rule that only attempts which spawn something do.
- **Manifest semantic checks keyed on a literal `$id`.** Print an explicit notice when the
  invariants are skipped rather than passing a corrupt file with a green tick, and keep a backlog
  ticket id out of a shipped product-agnostic command.
- **The Q-0033 ordering exists only in prose** while both tasks declare `depends_on: []`. State
  the fallback if Q-0033 has not landed, and name the regions of `spike/bin/harness.js` that
  actually overlap.
- **`harness runs` sort key.** Name `started_at` descending with a tiebreak; lexical order on
  `<ticket>-<n>` puts `-10` before `-9`.
- **`cost_usd: 0` mutation.** Name the artifact and the check that catches it, since `0` is legal
  on an occurrence's usage and only detectable against the roll-up.
- **`ensureExcluded`** (`spike/src/git.js`) is not exported. Say it is to be exported rather than
  implying it is already reachable.

## What must not change

The task breakdown. `q0011-engine-writer` on `backend`/codex and `q0011-cli-reader-validator` on
`tooling`/claude, both `depends_on: []` in one wave, is why this ticket exists — it is M1's
two-roles-on-two-vendors demonstration. Keep both tasks, keep them parallel, keep them on
different vendors, and keep their files disjoint. If the cut leaves the CLI half thin, move a
test to it rather than merging the halves.
