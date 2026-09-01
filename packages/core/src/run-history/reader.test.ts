// Q-0049 AC-10 and AC-11: the reader's exact answers, its token arithmetic, and the guard that had
// never had a test of the clause that matters.
//
// AC-11 is the highest-value criterion in this ticket's requirement, and its reason is measured
// rather than argued: the only existing test of the confinement guard exercises five tokens that the
// STRING clauses reject on their own, so a port that deleted `realpath` and compared resolved
// strings was green in both suites. The three symlink cases below are what makes deleting it red.
import fs from 'node:fs';
import path from 'node:path';

import { afterAll, describe, expect, test } from 'vitest';

import {
  TICKET_ID_PATTERN, isIncomplete, manifestShapeError, occurrenceSeq, readRunsDir,
  resolveRunDirectory, sortRuns, vendorTokenTotal,
} from './reader.js';
import type { RunEntry } from './reader.js';
import type { RunManifest, VendorRollup } from './manifest.js';
import { removeTempDirs, tempDir, walk, write } from '../../test/repo.js';

afterAll(removeTempDirs);

/** A complete, valid manifest, so a case states only the field it is about. */
const manifest = (fields: Partial<RunManifest> = {}): RunManifest => ({
  schema_version: 1,
  run_id: 'Q-0011-1',
  ticket_id: 'Q-0011',
  ticket_path: 'backlog/Q-0011-run-history-on-disk/ticket.md',
  flow: 'development',
  flow_file: 'harness/flows/development.yaml',
  stage: { before: 'red', after: 'green' },
  started_at: '2026-08-23T10:00:00.000Z',
  ended_at: '2026-08-23T10:05:00.000Z',
  duration_ms: 300_000,
  status: 'completed',
  steps: [],
  rollup: [],
  ...fields,
});

/** A roll-up row with every measure explicit. */
const row = (fields: Partial<VendorRollup> = {}): VendorRollup => ({
  vendor: 'mock', step_count: 1, unpriced_steps: 0,
  input_tokens: null, output_tokens: null,
  cached_input_tokens: null, cache_write_input_tokens: null, cost_usd: null,
  ...fields,
});

/**
 * A runs root holding one directory per named run, each with the document it was given.
 *
 * Two levels below the temporary directory on purpose: {@link outsideOf} needs somewhere that is
 * genuinely outside the runs root and still inside the tree `removeTempDirs` deletes, because a
 * symlink fixture left in the system temporary directory is litter the next ticket inherits.
 */
function runsRootWith(entries: Record<string, unknown>): string {
  const root = path.join(tempDir('runs-'), 'quorum', 'runs');
  fs.mkdirSync(root, { recursive: true });
  for (const [runId, document] of Object.entries(entries)) {
    const dir = path.join(root, runId);
    fs.mkdirSync(dir);
    if (document !== undefined) {
      write(path.join(dir, 'manifest.json'), typeof document === 'string' ? document : JSON.stringify(document));
    }
  }
  return root;
}

/** The sandbox a runs root sits in — outside it, and still inside what `removeTempDirs` deletes. */
const outsideOf = (root: string, name: string): string => {
  const dir = path.join(path.dirname(path.dirname(root)), name);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
};

/** An entry as `readRunsDir` yields one, for the functions that take a list rather than a root. */
const entry = (runId: string, fields: Partial<RunManifest>): RunEntry =>
  ({ runId, manifestPath: `/nowhere/${runId}/manifest.json`, manifest: manifest({ run_id: runId, ...fields }) });

describe('AC-10 — the reader\'s four shape errors, byte for byte', () => {
  test('a document that is not an object', () => {
    for (const document of [null, 42, 'a string', ['a', 'list'], true]) {
      expect(manifestShapeError(document)).toBe('manifest.json is not an object');
    }
  });

  test('a missing or mistyped required string, all of them named in one sentence', () => {
    expect(manifestShapeError({})).toBe('manifest.json is missing or mistyped: run_id, ticket_id, status');
    expect(manifestShapeError({ run_id: 'Q-1', ticket_id: 'Q', status: 1 }))
      .toBe('manifest.json is missing or mistyped: status');
    expect(manifestShapeError({ run_id: 'Q-1', ticket_id: null, status: 'completed' }))
      .toBe('manifest.json is missing or mistyped: ticket_id');
  });

  test('steps and rollup, each on its own', () => {
    const usable = { run_id: 'Q-1', ticket_id: 'Q', status: 'completed', steps: [], rollup: [] };
    expect(manifestShapeError({ ...usable, steps: {} })).toBe('manifest.json steps is not an array');
    expect(manifestShapeError({ ...usable, rollup: 'none' })).toBe('manifest.json rollup is not an array');
    expect(manifestShapeError(usable)).toBeNull();
  });

  test('parsing is not validity: nothing beyond those five things is required', () => {
    // A document with the five fields and none of the other eight is usable for a listing, and full
    // conformance stays `harness validate`'s job against the frozen contract.
    expect(manifestShapeError({ run_id: 'Q-1', ticket_id: 'Q', status: 'running', steps: [], rollup: [] })).toBeNull();
  });
});

describe('AC-10 — readRunsDir survives a damaged sibling and never repairs one', () => {
  test('a missing root is two empty arrays and no warning', () => {
    expect(readRunsDir(path.join(tempDir('absent-'), 'runs'))).toStrictEqual({ runs: [], warnings: [] });
  });

  test('an empty root is the same answer', () => {
    expect(readRunsDir(runsRootWith({}))).toStrictEqual({ runs: [], warnings: [] });
  });

  test('a valid run survives a malformed one, a shapeless one and a missing one', () => {
    const root = runsRootWith({
      'Q-0011-1': manifest({ run_id: 'Q-0011-1' }),
      'Q-0011-2': '{ this is not json',
      'Q-0011-3': { nothing: 'useful' },
      'Q-0011-4': undefined,
    });
    const { runs, warnings } = readRunsDir(root);
    expect(runs.map((found) => found.runId)).toStrictEqual(['Q-0011-1']);
    expect(runs[0].manifestPath).toBe(path.join(root, 'Q-0011-1', 'manifest.json'));
    // Sorted here and not there: `readdirSync` decides the listing's order and `sortRuns` decides
    // the reported one, so asserting an unsorted order would be asserting a filesystem's habit.
    const said = new Map(warnings.map((found) => [found.runId, found.message]));
    expect([...said.keys()].sort()).toStrictEqual(['Q-0011-2', 'Q-0011-3', 'Q-0011-4']);
    expect(said.get('Q-0011-2')?.startsWith('malformed manifest.json (')).toBe(true);
    expect(said.get('Q-0011-3')).toBe('manifest.json is missing or mistyped: run_id, ticket_id, status');
    expect(said.get('Q-0011-4')).toBe('missing manifest.json');
  });

  test('only directory entries are considered', () => {
    const root = runsRootWith({ 'Q-0011-1': manifest() });
    write(path.join(root, 'notes.txt'), 'a file beside the runs');
    expect(readRunsDir(root).runs.map((found) => found.runId)).toStrictEqual(['Q-0011-1']);
    expect(readRunsDir(root).warnings).toStrictEqual([]);
  });

  test('and every reader function together writes nothing at all', () => {
    // The property the three-file split exists to make checkable: a daemon can read history without
    // linking the code that creates directories, and an incomplete run is reported as it stands.
    const root = runsRootWith({
      'Q-0011-1': manifest({ status: 'running', ended_at: null, duration_ms: null }),
      'Q-0011-2': '{ broken',
    });
    write(path.join(root, 'Q-0011-1', 'manifest.json.tmp'), '{"half":');
    const before = walk(root);
    const { runs } = readRunsDir(root);
    sortRuns(runs).forEach((found) => {
      isIncomplete(found.manifest);
      occurrenceSeq(found.manifest.steps[0]?.occurrence_dir);
      found.manifest.rollup.forEach(vendorTokenTotal);
    });
    resolveRunDirectory(root, 'Q-0011-1');
    manifestShapeError(runs[0]?.manifest);
    expect(walk(root)).toStrictEqual(before);
    expect(before, 'the stray temporary file is still there — nothing cleans one').toContain(path.join('Q-0011-1', 'manifest.json.tmp'));
  });
});

describe('AC-10 — ordering, incompleteness, sequence numbers and token totals', () => {
  test('started_at descending, then run_id ascending in plain string order', () => {
    const older = entry('Q-0011-9', { started_at: '2026-08-23T09:00:00.000Z' });
    const ten = entry('Q-0011-10', { started_at: '2026-08-23T10:00:00.000Z' });
    const two = entry('Q-0011-2', { started_at: '2026-08-23T10:00:00.000Z' });
    // `Q-0011-10` before `Q-0011-2` is the deliberate consequence of a plain string comparison, and
    // it is what the shipped fixture asserts.
    expect(sortRuns([older, two, ten]).map((found) => found.runId)).toStrictEqual(['Q-0011-10', 'Q-0011-2', 'Q-0011-9']);
  });

  test('and it mutates neither its input nor the manifests in it', () => {
    const input = [entry('Q-0011-2', {}), entry('Q-0011-1', {})];
    const order = input.map((found) => found.runId);
    const snapshot = JSON.stringify(input.map((found) => found.manifest));
    const sorted = sortRuns(input);
    expect(sorted).not.toBe(input);
    expect(input.map((found) => found.runId)).toStrictEqual(order);
    expect(JSON.stringify(input.map((found) => found.manifest))).toBe(snapshot);
  });

  test('an incomplete run is either running or has no ended_at', () => {
    expect(isIncomplete(manifest({ status: 'running', ended_at: null, duration_ms: null }))).toBe(true);
    expect(isIncomplete(manifest({ status: 'failed', ended_at: null }))).toBe(true);
    expect(isIncomplete(manifest({ status: 'running', ended_at: '2026-08-23T10:05:00.000Z' }))).toBe(true);
    expect(isIncomplete(manifest())).toBe(false);
  });

  test('an occurrence sequence that cannot be read sorts last, not first', () => {
    expect(occurrenceSeq('steps/001-a')).toBe(1);
    expect(occurrenceSeq('steps/1000-a')).toBe(1000);
    for (const unreadable of ['notsteps/001-a', 'steps/a-1', 'steps/001', '', null, undefined]) {
      expect(occurrenceSeq(unreadable), String(unreadable)).toBe(Number.MAX_SAFE_INTEGER);
    }
    const dirs = ['steps/010-b', 'notsteps', 'steps/002-a'];
    expect([...dirs].sort((a, b) => occurrenceSeq(a) - occurrenceSeq(b)))
      .toStrictEqual(['steps/002-a', 'steps/010-b', 'notsteps']);
  });

  test('a token total is input plus output, and the cache fields are never summands', () => {
    // The adapter has already folded both cache measures into input_tokens before a manifest sees
    // one. Adding them back overstated the M0 figures by roughly 35%, and the fixture that missed it
    // left both fields null — which this one does not.
    const populated = row({ input_tokens: 12_000, output_tokens: 900, cached_input_tokens: 9000, cache_write_input_tokens: 500 });
    expect(vendorTokenTotal(populated)).toBe(12_900);
    expect(vendorTokenTotal(populated)).not.toBe(12_000 + 900 + 9000 + 500);
    expect(vendorTokenTotal(populated)).not.toBe(12_000 + 900 + 500);

    // The same fields read the other way round, deliberately adjacent to the row above so both
    // readings are covered together rather than one of them standing alone. Both totals null while
    // the cache fields are populated is a row no adapter can produce, because the fold happens
    // before a manifest sees a measure — so it is malformed, and null is the honest answer for
    // absent summands. Summing the breakdown instead would put a number that is not a token total
    // in the one place run history exists to report one. Ruled, not changed. See Q-0037 AC-7.
    const malformed = row({ input_tokens: null, output_tokens: null, cached_input_tokens: 9000, cache_write_input_tokens: 500 });
    expect(vendorTokenTotal(malformed)).toBeNull();
    expect(vendorTokenTotal(malformed)).not.toBe(9500);
  });

  test('and it is null only when both totals are', () => {
    expect(vendorTokenTotal(row())).toBeNull();
    expect(vendorTokenTotal(row({ input_tokens: 5 }))).toBe(5);
    expect(vendorTokenTotal(row({ output_tokens: 7 }))).toBe(7);
    expect(vendorTokenTotal(row({ input_tokens: 0, output_tokens: 0 }))).toBe(0);
  });
});

describe('AC-11 — the confinement guard resolves realpath, and the symlink case is tested at last', () => {
  /** A runs root with two genuine run directories in it, each holding a manifest. */
  const twoRuns = (): string => runsRootWith({ 'Q-0011-1': manifest({ run_id: 'Q-0011-1' }), 'Q-0011-2': manifest({ run_id: 'Q-0011-2' }) });

  test('a genuine child resolves, and its own real path is what comes back', () => {
    const root = twoRuns();
    expect(resolveRunDirectory(root, 'Q-0011-1')).toBe(fs.realpathSync(path.join(root, 'Q-0011-1')));
    expect(resolveRunDirectory(root, 'Q-0011-3'), 'a child that does not exist').toBeNull();
  });

  test('the five lexical tokens are still refused', () => {
    const root = twoRuns();
    const secret = outsideOf(root, 'secret');
    write(path.join(secret, 'manifest.json'), JSON.stringify(manifest({ run_id: 'S-9999-1' })));
    for (const token of ['../secret', '.quorum/secret', secret, '..', '.']) {
      expect(resolveRunDirectory(root, token), token).toBeNull();
    }
  });

  test('a single-segment symlink pointing OUT of the runs root is refused', () => {
    // The clause with no coverage anywhere until now. `path.resolve` does no filesystem work and
    // `statSync` follows links, so this token satisfies every string test: one path segment, not
    // `.`, `..` or empty, and lexically inside the runs root. Only resolving both sides for real
    // sees through it — which is why a port that dropped `realpath` was green in both suites.
    const root = twoRuns();
    const outside = outsideOf(root, 'elsewhere');
    write(path.join(outside, 'manifest.json'), JSON.stringify(manifest({ run_id: 'X-9999-1', ticket_id: 'SECRET' })));
    fs.symlinkSync(outside, path.join(root, 'Q-0011-3'));

    // Every lexical clause passes, and the answer is still null.
    const token = 'Q-0011-3';
    expect(token).toBe(path.basename(token));
    expect(fs.statSync(path.join(root, token)).isDirectory(), 'statSync follows the link').toBe(true);
    expect(resolveRunDirectory(root, token)).toBeNull();
    // And it discloses nothing about what the link pointed at.
    expect(readRunsDir(root).runs.map((found) => found.manifest.ticket_id)).not.toContain('SECRET');
  });

  test('a single-segment symlink pointing at a SIBLING run is accepted, and resolves to it', () => {
    // Preserved behaviour, asserted so a later change to it is deliberate: the alias's real parent
    // IS the real runs root, so the guard admits it and the caller reads the sibling's manifest
    // under the alias. The listing skips it, because `withFileTypes` has lstat semantics — two
    // answers to one question, reported and not reconciled here.
    const root = twoRuns();
    fs.symlinkSync(path.join(root, 'Q-0011-2'), path.join(root, 'Q-0011-alias'));
    expect(resolveRunDirectory(root, 'Q-0011-alias')).toBe(fs.realpathSync(path.join(root, 'Q-0011-2')));
    expect(readRunsDir(root).runs.map((found) => found.runId).sort()).toStrictEqual(['Q-0011-1', 'Q-0011-2']);
  });

  test('a runs root reached through a symlink still accepts its own genuine children', () => {
    // Both sides are resolved, so aliasing the ROOT changes no answer — the over-refusal a
    // half-resolved comparison would produce, on the repository shape this product runs in.
    const root = twoRuns();
    const aliasedRoot = path.join(outsideOf(root, 'aliases'), 'runs');
    fs.symlinkSync(root, aliasedRoot);
    expect(resolveRunDirectory(aliasedRoot, 'Q-0011-1')).toBe(fs.realpathSync(path.join(root, 'Q-0011-1')));
    expect(resolveRunDirectory(aliasedRoot, '..')).toBeNull();
  });

  test('a runs root that does not exist answers null rather than throwing', () => {
    expect(resolveRunDirectory(path.join(tempDir('gone-'), 'runs'), 'Q-0011-1')).toBeNull();
  });

  test('a child that is a file, not a directory, is refused', () => {
    const root = twoRuns();
    write(path.join(root, 'Q-0011-4'), 'not a run');
    expect(resolveRunDirectory(root, 'Q-0011-4')).toBeNull();
  });

  test('TICKET_ID_PATTERN is anchored and case-sensitive', () => {
    for (const id of ['Q-0011', 'QA-0049', 'ABC-1234']) expect(TICKET_ID_PATTERN.test(id), id).toBe(true);
    for (const not of ['q-0011', 'Q-11', 'Q-00111', 'Q-0011-1', ' Q-0011', 'Q-0011 ', 'Q0011', '0011-Q']) {
      expect(TICKET_ID_PATTERN.test(not), not).toBe(false);
    }
  });
});
