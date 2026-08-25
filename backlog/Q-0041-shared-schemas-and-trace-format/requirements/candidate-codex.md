# Q-0041 — `packages/shared`: schemas, types, and trace format

## Problem

The shapes of Quorum’s flow, ticket, role, and step output data are currently implicit in the spike. Different packages would have to infer those shapes independently, creating incompatible runtime checks and TypeScript types in the parts of the port that depend on this ticket.

The trace format has the same problem. The architecture names six vendor-neutral event variants, but does not define their payloads. If adapters, core, the CLI, run history, and the Studio adopt different interpretations, correcting the format after Q-0050 will require coordinated changes across several packages.

This ticket establishes `packages/shared` as the single source for these declarations. It is a port foundation, not an authorization to change flow behaviour or replace the existing vendor-output and artifact validators.

Surfaces touched: `harness/` file formats, `backlog/` ticket frontmatter, and the internal TypeScript API of `packages/shared`. No CLI or Studio behaviour is added.

## User story

**`maintainer`** — I want Quorum to reject structurally unreadable project files with a clear validation result while preserving the lint messages and behaviour of valid existing files, so later ports do not interpret my flow, ticket, or role differently.

**`contributor`** — I want one documented, vendor-neutral set of schemas, inferred types, events, stage values, and path conventions to import, so I can add an adapter or flow feature without recreating Quorum’s contracts or leaking vendor-specific fields downstream.

**`adopter`** — I want the flows, roles, and tickets included in a cold clone to remain valid after the port, without new configuration or migration work during first use.

## Acceptance criteria

1. **Package boundary and dependency.** `packages/shared` exports its public declarations through its package entry point and passes the repository’s strict TypeScript, lint, and Vitest checks. It imports no workspace package and has no runtime dependency other than `zod`. The solution document includes this one-line dependency justification: “Zod supplies runtime validation and inferred TypeScript types from the same declaration, preventing Quorum’s file shapes from being specified twice.”

2. **Flow schema and inferred types.** `packages/shared` exports a Zod flow schema and types inferred from that schema. The schema represents every shape used by the checked-in `harness/flows/*.yaml` files: top-level `name`, `consumes`, `produces`, `cross_vendor`, and `steps`; ordinary steps; `parallel` groups; `fan_out` with its nested `step` template; `on_fail`; `route`; gates; adapter, script, and integrate step fields; `input`; `output`; and the current scalar-or-list forms used by those fields. Tests parse every checked-in flow and its corresponding shipped template, where one exists.

3. **Structural validation boundary.** The flow schema rejects values that cannot be safely traversed as the declared structure, including a non-object flow, non-array `steps`, non-object step entries, a non-array `parallel`, a non-object `fan_out`, `input`, `output`, `on_fail`, or `route`, and fields whose primitive or collection type is incompatible with all supported forms. It does not enforce semantic rules already owned by `lintFlow`, including duplicate step ids, missing or invalid `goto` targets, loop bounds, counter naming, `on_exhausted`, verdict routing, required fan-out templates, integrate branches, diff-range policy, cross-vendor analysis, convergence, `consumes`/`produces` presence, or human-locked deploy gates. Tests prove representative malformed values reach the appropriate layer: structural failures are rejected by Zod, while one example of each existing lint rule passes structural parsing and remains available for `lintFlow` to diagnose.

4. **Compatibility and unknown fields.** Schema parsing does not silently delete fields. Unknown object keys are either preserved in the parsed result or rejected explicitly; they are never stripped. To preserve port behaviour, the flow, ticket, and role schemas accept all currently checked-in valid files and fixtures. A test compares representative parsed objects before and after validation and proves no accepted key or value was removed or defaulted. The ticket introduces no default values that were absent from the source file.

5. **Ticket schema and inferred types.** `packages/shared` exports a Zod schema and inferred type for parsed `ticket.md` frontmatter. It covers the current fields `id`, `title`, `stage`, `owner`, `repos`, `branch`, `priority`, `created`, `iterations`, and `history`. `iterations` supports the persisted counter map. `history` supports the currently persisted run outcomes, including `stage`, `run`, `flow`, `status`, `stage_before`, `stage_after`, `at`, and nullable or numeric cost data as present in existing tickets. Tests parse Q-0041 and representative historical tickets containing non-empty `iterations` and `history` without rewriting them.

6. **Role schema and inferred types.** `packages/shared` exports a Zod schema and inferred type for role-file frontmatter. It covers the current optional `adapter`, `model`, and `paths` fields, while the Markdown body remains separate from frontmatter. Tests parse every checked-in `harness/roles/*.md` file. The schema does not interpret role prose, check whether paths exist, or decide whether a model is valid for an adapter.

7. **Step output declarations and agent result.** `packages/shared` exports separately named schemas and inferred types for (a) a flow step’s `output` declaration and (b) Quorum’s parsed structured result from an agent step. The declaration covers `write`, `writes`, and `verdict`. The result covers `summary`, optional `document`, optional `verdict`, and optional `findings` without attempting to validate a dynamically generated verdict enum. Tests make the two concepts impossible to confuse by proving that a declaration is not accepted as an agent result and vice versa. Whether a particular result requires `document`, `verdict`, or `findings` remains the responsibility of the generated JSON Schema and `checkAgainstSchema`.

8. **Validation systems remain separate.** The change does not alter, wrap, remove, or replace `schemaFor`, `checkAgainstSchema`, `extractJson`, ajv, or artifact contract validation. No Zod schema in `packages/shared` attempts to consume arbitrary JSON Schema emitted by solutioning. Tests and source imports demonstrate that shared schemas validate Quorum-owned file and in-memory shapes only; vendor wrapping tolerance remains outside this package.

9. **Stages and state-machine declarations.** `packages/shared` exports `STAGES` as an immutable ordered tuple containing exactly `draft`, `requirements`, `solutioned`, `red`, `green`, `reviewed`, `qa-passed`, `deployed`, `blocked`, and `abandoned`, plus a `Stage` type derived from it and a Zod stage schema derived from the same source. No second hand-written stage list is introduced in the package. The allowed-transition representation is subject to blocking open question OQ-2.

10. **Shared constants.** `packages/shared` exports one canonical representation for the worktree root `.harness/worktrees/`, run-history root `.quorum/runs/`, the integration-branch shape `harness/<ticket-id>/integration`, and the sibling step/task branch namespace under `harness/<ticket-id>/`. Branch helpers or patterns accept a ticket id as data and do not embed a product-specific repository name. Tests cover Q-0041 examples and reject a branch outside the `harness/<ticket-id>/` namespace where the exported API claims validation.

11. **Vendor-neutral trace union.** Subject to blocking open question OQ-1, `packages/shared` exports a discriminated Zod union and its inferred `Event` type for exactly `spawn`, `tool`, `text`, `verdict`, `usage`, and `done`. Every variant uses the same discriminant key, rejects fields reserved for another variant, and contains no adapter name, vendor name, native CLI event name, or vendor-specific payload. Type-level and runtime tests prove exhaustive discrimination across all six variants and rejection of an unknown event type.

12. **No persistence or runtime integration.** No code in this ticket emits, stores, reads, streams, or renders an event. The change creates no file under `.quorum/runs/`, changes no `runs.log`, and adds no event handling to core, an adapter, the CLI, server, or Studio. Event production and streaming remain Q-0050’s responsibility.

13. **Port preservation and regression tests.** Unit tests are added with the shared declarations and cover successful parsing, each schema’s representative structural failures, preservation of unknown accepted fields, all stage values, shared constants, and all event variants once OQ-1 is resolved. Existing workspace tests remain green. No file under `spike/**` is modified. If an existing checked-in file or spike fixture contradicts the proposed schema, implementation stops and reports the mismatch as a port defect instead of changing the file or silently widening/narrowing behaviour.

14. **Cross-cutting quality check.** The implementation and tests demonstrate: BYOS is not applicable and introduce no subscription-secret path or environment-variable handling; worktree safety is represented only by the canonical `.harness/worktrees/` constant and no worktree is created; gate behaviour is unchanged; file-format parsing has runtime schemas and inferred types; semantic flow checks remain in `lintFlow`; the cross-vendor rule remains a lint concern while events remain vendor-neutral; no persistent format is added; no product-specific SaaS reference is introduced; and cold-clone setup gains no command, configuration, prompt, or migration step.

## Non-goals

- Porting or changing any module owned by Q-0042 through Q-0054.
- Editing or deleting anything under `spike/**`.
- Fixing a defect or inconsistency found while examining spike behaviour.
- Adding runtime loading of flows, tickets, roles, or step results to `packages/core`.
- Changing `lintFlow` rules, messages, traversal, or their order.
- Replacing or consolidating `schemaFor`, `checkAgainstSchema`, `extractJson`, ajv, or artifact contract validation.
- Converting Zod declarations to arbitrary JSON Schema or reading solutioning’s JSON Schema with Zod.
- Emitting, persisting, replaying, rendering, or transporting the trace stream.
- Defining run manifests or the existing on-disk run-history format.
- Adding the `quorum` binary, cutover behaviour, Studio forms, or a public compatibility migration.
- Adding budget enforcement, new flow semantics, new stage transitions, or changed gate behaviour.
- Adding a Gemini adapter, multi-user support, a remote daemon, cloud sync, a plugin marketplace, visual node canvas, eval suites, or desktop shell.

## Open questions

| ID | Question | Owner | Blocking? |
| --- | --- | --- | --- |
| OQ-1 | What are the exact common envelope and payload fields, required fields, nullability rules, and terminal semantics for each of `spawn`, `tool`, `text`, `verdict`, `usage`, and `done`? `04-architecture.md` names only the variants. This must also settle whether timestamps, run/step identifiers, tool call identifiers, exit status, errors, token counts, and cost belong in the event or are supplied by the consumer. | Q-0050 architect with adapter owners | **Yes.** It changes the adapter contract and the trace format that five later tickets consume. Record the answer in an accepted erratum or decision before implementation. |
| OQ-2 | What does “the stage state machine moves here” require beyond `STAGES`, `Stage`, and stage validation? Is `shared` expected to export an allowed-transition table or predicate, and if so are chore’s `requirements → reviewed`, failure retention, and terminal `blocked`/`abandoned` transitions represented? The spike currently exports the list while the engine enforces flow `consumes`/`produces`. | Q-0041 owner and Q-0050 owner | **Yes.** Adding an unapproved transition table would create behaviour rather than port it. |
| OQ-3 | Must ticket validation accept legacy history entries that contain only a subset of the current outcome fields? Existing history predates the current shape, and rejecting it would be a migration. Identify the oldest committed shape that remains supported and add it as a fixture. | Q-0041 owner | **Yes.** It changes whether existing backlog files load after the port. |
| OQ-4 | Are top-level and nested unknown keys intentionally supported extension points, or should they be explicit errors in a later behaviour-change ticket? This requirement preserves them for the port and forbids silent stripping, but does not establish permanent extensibility. | Product owner | No for this ticket; preservation governs unless a prior decision says otherwise. |

## Risks

- An underspecified event union may appear vendor-neutral while forcing adapters to smuggle native payloads into generic fields. OQ-1 must close before the union is implemented.
- A schema that is stricter than the spike can reject existing repositories before `lintFlow` produces its established, file-oriented messages.
- A schema that is too permissive can provide misleading inferred types and move failures deeper into execution. Structural negative tests and the explicit lint boundary reduce this risk.
- Zod’s default object behaviour can strip unknown keys, causing data loss if parsed objects are later written back. AC-4 requires preservation or explicit rejection.
- Historical ticket entries may not share one complete shape. Treating current examples as the only valid history would create an undocumented migration.
- Similar names for a step’s `output` declaration and an agent’s structured result can cause the wrong schema to be imported. Separate public names and incompatibility tests are required.
- Shared branch patterns can accidentally become a second safety implementation. Actual branch and worktree enforcement remains in core; this package supplies only canonical values and pure validation helpers.
