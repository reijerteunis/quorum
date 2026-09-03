/**
 * The public API of `@quorum/core`.
 *
 * Twenty-four value symbols, and the list is a decision rather than a consequence: `packages/cli`'s
 * command children (Q-0091 to Q-0094) import from here, and what they may reach is settled by
 * whoever adds a name to this file rather than by whoever types an import first. That is why
 * `package.json` publishes `"."` alone and no `./*` subpath — a wildcard would defer the decision
 * to the first consumer (Q-0096 AC-5).
 *
 * Twenty of the twenty-four are the domain helpers `packages/cli/src/frame.source.test.ts` names in
 * its `DOMAIN` register — the symbols the CLI *frame* is forbidden to reimplement, and which each
 * command module may name only where its own command needs them — and the other four are the error
 * classes a caller has to catch. `packages/cli/src/package.test.ts` derives the surface from that
 * register rather than transcribing it, so the two cannot drift.
 *
 * **Q-0091 added three names, and each is a command's need rather than a tidy-up.** `readData` is
 * what lets `quorum validate` fail on an unreadable schema with its own message before any artifact
 * is opened; `ProjectNotFoundError` is the first error every project-opening command can hit, and
 * without it the CLI cannot tell that case from a crash and prints a Node stack where the spike
 * prints a sentence; `FlowFileReport` is the record `quorum lint` renders.
 *
 * **Q-0092 added six, which is the whole reading half of `.quorum/runs/`** — `readRunsDir`,
 * `sortRuns`, `isIncomplete`, `occurrenceSeq`, `vendorTokenTotal` and `readRun`, the five
 * `quorum runs` selects and orders with plus the single-run read that keeps a detail request off its
 * siblings. `manifestShapeError` is deliberately **not** among them: no command calls it, it runs
 * inside `readRunsDir` where it belongs, and a name is added here because a command needs it rather
 * than because its module exports it. `TICKET_ID_PATTERN` is not either — the CLI's ticket-id
 * grammar is `@quorum/shared`'s `parseTicketId`, which is the spelling the spike's own `runs` case
 * uses and the one `Backlog` allocates with, and publishing a second one here would make two.
 *
 * Types are re-exported one at a time, by name, and never wholesale — the wildcard objection in a
 * second form. A type export adds no runtime key, so the surface `package.test.ts` counts is the
 * value list above and nothing else.
 */
export { getAdapter, probeAdapter } from './adapters/adapters.js';
export { overrideAdapters } from './adapters/override.js';
export { Backlog } from './backlog/backlog.js';
export { findProject, loadProject, ProjectNotFoundError } from './backlog/project.js';
export { readData, validateArtifact } from './contracts/contracts.js';
export type { ArtifactValidationResult } from './contracts/contracts.js';
export { runFlow } from './engine/engine.js';
export { loadFlow, loadFlowByName } from './engine/loaders.js';
export { GateUnansweredError } from './engine/types.js';
export { IntegrationError } from './fanout/fanout.js';
export { containment } from './git/git.js';
export { FlowError, lintDirectory, lintFlowDirectory } from './lint/lint.js';
export type { FlowFileReport } from './lint/lint.js';
export type { Occurrence, OccurrenceUsage, RunManifest, VendorRollup } from './run-history/manifest.js';
export { isIncomplete, occurrenceSeq, readRun, readRunsDir, sortRuns, vendorTokenTotal } from './run-history/reader.js';
export type { RunEntry, RunRead, RunWarning } from './run-history/reader.js';
