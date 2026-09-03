/**
 * `quorum validate <schema.json> <file…>` — check artifacts against a contract, and exit 1 on the
 * first one that does not conform.
 *
 * **It is the one command with a machine consumer.** A `qa-red` `type: script` step reads its exit
 * code, which is what turns a contract violation into a red test rather than prose in a review, so
 * the status is part of the contract and not a courtesy. That is also why the aggregate verdict is
 * reported for every file rather than at the first failure: the loop continues so a red phase names
 * every artifact it is unhappy with, and only the status is collapsed to one number.
 *
 * **No project is opened, and that is measured rather than assumed.** `spike/bin/harness.js:426–461`
 * opens none, so `harness validate` runs anywhere — verified by running the spike with `--project`
 * aimed at a directory holding no `harness/harness.yaml` and watching it validate normally.
 * Requiring one here would newly break a script step run outside a checkout, which is a behaviour
 * change on the command's machine-facing surface. Why: preserved, ground rule 3.
 *
 * **The verdict goes through {@link failSoftly}** where the spike ends the case in
 * `process.exit(bad ? 1 : 0)` (`spike/bin/harness.js:460`): everything is printed by then, and the
 * soft path is what lets it finish reaching a pipe. The usage and unreadable-schema failures keep
 * {@link die}, which exits hard as the spike does. Q-0091 AC-6.
 */
import { readData, validateArtifact, type ArtifactValidationResult } from '@quorum/core';

import { c } from './colour.js';
import { die, failSoftly } from './fail.js';
import type { CommandHandler } from './main.js';

/**
 * What is printed where a schema selects no semantic pass, and the only copy of this sentence under
 * `packages/**`.
 *
 * It leads with *why* no pass applies, and says "no **recognised** annotation" rather than "no
 * annotation", because the one outcome covers an absent annotation and a present-but-unsupported
 * value alike. Both properties are deliberate and neither is this ticket's to revisit: Why:
 * preserved verbatim from the sentence Q-0037 shipped, whose own comment
 * (`spike/bin/harness.js:442–445`) records what the earlier wording did wrong.
 * `contracts/Q-0011/runs-cli.contract.md:46–48` is a frozen requirement *in prose* — that a notice
 * be printed and that a skip never read as a pass — and is satisfied by this sentence rather than
 * matched against it.
 */
const SKIPPED_NOTICE = 'no recognised x-quorum-contract annotation, so no semantic contract applies — no run-manifest semantic checks ran; they were skipped as inapplicable, and run-manifest-v1 is the only contract defined';

/**
 * Whether the outcome means no semantic contract applied at all, which is the only shape that earns
 * the notice.
 *
 * `structurally-invalid` is the other non-running shape and must stay silent: there the contract
 * *was* recognised and the pass was suppressed because the document is malformed, so the sentence
 * above would be false of it. Two distinct return shapes, and the difference is read from
 * `validateArtifact`'s value rather than recomputed from the schema.
 */
const inapplicable = (semantic: ArtifactValidationResult['semantic']): boolean =>
  !semantic.ran && semantic.reason === 'unrecognised-annotation';

/** Validate each artifact against one schema, in argv order, and fail if any of them did not. */
export const validate: CommandHandler = ({ rest }) => {
  const [schemaFile, ...dataFiles] = rest;
  // Why: preserved verbatim, including the binary name this one is not called — see the OQ-2
  // successor, which owns every user-facing occurrence of it at once rather than one per command.
  if (!schemaFile || dataFiles.length === 0) die('usage: harness validate <schema.json> <file…>');
  // Read once, here, purely so an unreadable schema dies with its own message before any artifact is
  // opened. Selection itself is `validateArtifact`'s and is annotation-driven.
  try {
    readData(schemaFile);
  } catch (error) {
    die(`cannot read schema ${schemaFile}: ${(error as Error).message}`);
  }
  let bad = 0;
  for (const file of dataFiles) {
    let result: ArtifactValidationResult;
    try {
      // Called exactly once per artifact, and every outcome below is derived from this one value:
      // the artifact is never re-read to decide whether a semantic pass applies, which is the
      // property Q-0037 AC-9 gave this function to make possible.
      result = validateArtifact(schemaFile, file);
    } catch (error) {
      console.log(`${c.red('✗')} ${file}: ${(error as Error).message}`);
      bad += 1;
      continue;
    }
    if (inapplicable(result.semantic)) console.log(`${c.dim('·')} ${file}: ${SKIPPED_NOTICE}`);
    if (result.ok) {
      console.log(`${c.green('✓')} ${file} matches ${result.schema}`);
    } else {
      bad += 1;
      console.log(`${c.red('✗')} ${file} violates ${result.schema}:\n    ${result.errors.join('\n    ')}`);
    }
  }
  if (bad) failSoftly();
};
