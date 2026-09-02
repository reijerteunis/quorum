/**
 * The public API of `@quorum/core`.
 *
 * Sixteen symbols, and the list is a decision rather than a consequence: `packages/cli`'s four
 * command children (Q-0091 to Q-0094) import from here, and what they may reach is settled by
 * whoever adds a name to this file rather than by whoever types an import first. That is why
 * `package.json` publishes `"."` alone and no `./*` subpath — a wildcard would defer the decision
 * to the first consumer (Q-0096 AC-5).
 *
 * Thirteen of the sixteen are the domain helpers `packages/cli/src/frame.source.test.ts` already
 * names in its `DOMAIN` register — the symbols the CLI frame is forbidden to reimplement — and the
 * other three are the error classes a caller has to catch. `packages/cli/src/package.test.ts`
 * derives the surface from that register rather than transcribing it, so the two cannot drift.
 *
 * Types are deliberately not re-exported here. A command child that needs one adds it, which is an
 * ordinary edit; exporting the package's whole type surface on the chance somebody wants it is the
 * wildcard objection in a second form.
 */
export { getAdapter, probeAdapter } from './adapters/adapters.js';
export { overrideAdapters } from './adapters/override.js';
export { Backlog } from './backlog/backlog.js';
export { findProject, loadProject } from './backlog/project.js';
export { validateArtifact } from './contracts/contracts.js';
export { runFlow } from './engine/engine.js';
export { loadFlow, loadFlowByName } from './engine/loaders.js';
export { GateUnansweredError } from './engine/types.js';
export { IntegrationError } from './fanout/fanout.js';
export { containment } from './git/git.js';
export { FlowError, lintDirectory, lintFlowDirectory } from './lint/lint.js';
