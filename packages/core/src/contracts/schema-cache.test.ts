// Q-0045 AC-8 defect 1, alone in its own file.
//
// The defect is process-global: the module-level Ajv instance registers a schema's `$id` for the
// life of the process, so once this suite has tripped it, every later read of the same contract in
// the same process throws too. Sharing a file with any other run-manifest validation would mean one
// of the two suites testing something other than what it says. Vitest isolates each test file,
// which is the only reason the sibling suites can use the same contract at all.
import path from 'node:path';

import { afterAll, expect, test } from 'vitest';

import { validateArtifact, validateFile } from './contracts.js';
import { repoFile } from '../../test/corpus.js';
import { removeTempDirs, tempDir, write } from '../../test/repo.js';

afterAll(removeTempDirs);

const dir = tempDir('id-collision-');
const schemaFile = path.join(dir, 'run-manifest.schema.json');
write(schemaFile, repoFile('contracts/Q-0011/run-manifest.schema.json'));

/** A valid, empty run — the point is that both data files are good, so only the schema is at fault. */
const run = (name: string, run_id: string): string => {
  const file = path.join(dir, name);
  write(file, JSON.stringify({
    schema_version: 1,
    run_id,
    ticket_id: 'Q-0045',
    ticket_path: 'backlog/Q-0045-core-contracts-and-manifest-semantics/ticket.md',
    flow: 'chore',
    flow_file: 'harness/flows/chore.yaml',
    stage: { before: 'requirements', after: 'reviewed' },
    started_at: '2026-08-26T10:00:00.000Z',
    ended_at: '2026-08-26T10:00:01.000Z',
    duration_ms: 1000,
    status: 'completed',
    steps: [],
    rollup: [],
  }));
  return file;
};

test('two good data files against a schema carrying an $id fail on the second', () => {
  // Reachable from the shipped CLI, which reads the schema per data file and loops the data files
  // (spike/bin/harness.js:500 against spike/src/contracts.js:38). Neither a fresh Ajv per call, nor
  // `removeSchema`, nor hoisting the read may be introduced to close it — see Q-0045 OQ-6.
  const first = run('first.json', 'Q-0045-1');
  const second = run('second.json', 'Q-0045-2');

  expect(validateFile(schemaFile, first)).toStrictEqual({
    ok: true, errors: [], schema: 'run-manifest.schema.json', data: 'first.json',
  });

  const collision = /schema with key or id "https:\/\/quorum\.local\/contracts\/run-manifest-v1\.schema\.json" already exists/;
  expect(() => validateFile(schemaFile, second)).toThrow(collision);
  // And it does not recover: the registration outlives the call that made it, which is defect 2
  // seen from the outside — the same first file now fails too, through either entry point.
  expect(() => validateFile(schemaFile, first)).toThrow(collision);
  expect(() => validateArtifact(schemaFile, first)).toThrow(collision);
});
