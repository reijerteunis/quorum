// Q-0045 AC-7, AC-9 and AC-10's annotation-selection proofs: the composition, and the four line
// shapes a CLI can build from what it returns.
//
// The `$id` budget of this file is TWO, one for each real committed contract, and each is used by a
// single `validateArtifact` call (AC-8 defect 1). Every other schema here is authored by the test
// and carries no `$id`, which is what makes it repeatable — the annotation is the selector, so a
// schema that carries `x-quorum-contract: run-manifest-v1` is a run-manifest schema whoever wrote
// it, which is itself the point of AC-7's step 2.
import path from 'node:path';

import YAML from 'yaml';
import { afterAll, describe, expect, test } from 'vitest';

import { validateArtifact } from './contracts.js';
import type { ArtifactValidationResult } from './contracts.js';
import { repoFile } from '../../test/corpus.js';
import { removeTempDirs, tempDir, write } from '../../test/repo.js';

afterAll(removeTempDirs);

/** A schema and a data file on disk, returned as the pair `validateArtifact` takes. */
const pair = (schema: unknown, data: unknown, schemaName = 'contract.schema.json', dataName = 'artifact.json'): [string, string] => {
  const dir = tempDir('artifact-');
  const schemaFile = path.join(dir, schemaName);
  const dataFile = path.join(dir, dataName);
  write(schemaFile, typeof schema === 'string' ? schema : JSON.stringify(schema));
  write(dataFile, typeof data === 'string' ? data : JSON.stringify(data));
  return [schemaFile, dataFile];
};

/** Enough of the run manifest for the semantic pass to have something to disagree with. */
const RUN_MANIFEST_SCHEMA = {
  type: 'object',
  'x-quorum-contract': 'run-manifest-v1',
  required: ['status', 'steps', 'rollup'],
  properties: {
    status: { enum: ['running', 'completed', 'failed', 'aborted', 'regressed', 'exhausted', 'interrupted'] },
    started_at: { type: 'string' },
    ended_at: { type: ['string', 'null'] },
    duration_ms: { type: ['integer', 'null'] },
    steps: { type: 'array' },
    rollup: { type: 'array' },
  },
};

const GENERIC_SCHEMA = { type: 'object', required: ['a'] };
const UNKNOWN_ANNOTATION_SCHEMA = { ...GENERIC_SCHEMA, 'x-quorum-contract': 'unknown-v1' };
const EMPTY_ANNOTATION_SCHEMA = { ...GENERIC_SCHEMA, 'x-quorum-contract': '' };

const CLEAN_RUN = { status: 'completed', started_at: '2026-08-26T10:00:00.000Z', ended_at: '2026-08-26T10:00:01.000Z', duration_ms: 1000, steps: [], rollup: [] };
/** Structurally fine, and the roll-up claims a vendor no occurrence supports. */
const SEMANTICALLY_BROKEN = { ...CLEAN_RUN, rollup: [{ vendor: 'codex' }] };
/** Broken both ways: `status` is out of the enum AND the roll-up is unsupported. */
const BROKEN_BOTH_WAYS = { ...SEMANTICALLY_BROKEN, status: 'nope' };

const ROLLUP_UNSUPPORTED = 'rollup: vendor "codex" has a row but no occurrence reported its usage';

describe('AC-7 — three states, and `ran: true` is the only one that means the checks were performed', () => {
  test('recognised annotation over a clean artifact: validated, and the pass ran', () => {
    expect(validateArtifact(...pair(RUN_MANIFEST_SCHEMA, CLEAN_RUN))).toStrictEqual({
      ok: true,
      errors: [],
      schema: 'contract.schema.json',
      data: 'artifact.json',
      semantic: { contract: 'run-manifest-v1', ran: true },
    });
  });

  test('recognised annotation over a semantically broken artifact: the pass ran and refused it', () => {
    expect(validateArtifact(...pair(RUN_MANIFEST_SCHEMA, SEMANTICALLY_BROKEN))).toStrictEqual({
      ok: false,
      errors: [ROLLUP_UNSUPPORTED],
      schema: 'contract.schema.json',
      data: 'artifact.json',
      semantic: { contract: 'run-manifest-v1', ran: true },
    });
  });

  test('structurally invalid: the pass is suppressed, and says so rather than reporting nothing', () => {
    // The ordering is load-bearing rather than tidy: the pass reads `data.steps`, `s.usage.vendor`
    // and `data.rollup` with no guards, and this is what makes that safe (AC-8 defect 4).
    const result = validateArtifact(...pair(RUN_MANIFEST_SCHEMA, BROKEN_BOTH_WAYS));
    expect(result).toStrictEqual({
      ok: false,
      errors: ['/status: must be equal to one of the allowed values'],
      schema: 'contract.schema.json',
      data: 'artifact.json',
      semantic: { contract: 'run-manifest-v1', ran: false, reason: 'structurally-invalid' },
    });
    expect(result.errors).not.toContain(ROLLUP_UNSUPPORTED);
  });

  test('no annotation, an unknown one and an empty one are all the third state', () => {
    for (const [name, schema] of [
      ['none', GENERIC_SCHEMA], ['unknown-v1', UNKNOWN_ANNOTATION_SCHEMA], ['empty', EMPTY_ANNOTATION_SCHEMA],
    ] as const) {
      expect(validateArtifact(...pair(schema, { a: 1 })), name).toStrictEqual({
        ok: true,
        errors: [],
        schema: 'contract.schema.json',
        data: 'artifact.json',
        semantic: { contract: null, ran: false, reason: 'unrecognised-annotation' },
      });
      expect(validateArtifact(...pair(schema, { b: 1 })), name).toStrictEqual({
        ok: false,
        errors: ["/: must have required property 'a'"],
        schema: 'contract.schema.json',
        data: 'artifact.json',
        semantic: { contract: null, ran: false, reason: 'unrecognised-annotation' },
      });
    }
  });

  test('selection is by annotation, never by filename', () => {
    const [unannotated, data] = pair(GENERIC_SCHEMA, { a: 1 }, 'run-manifest.schema.json');
    expect(validateArtifact(unannotated, data).semantic).toStrictEqual({ contract: null, ran: false, reason: 'unrecognised-annotation' });
    const [annotated, run] = pair(RUN_MANIFEST_SCHEMA, CLEAN_RUN, 'anything-at-all.json');
    expect(validateArtifact(annotated, run).semantic).toStrictEqual({ contract: 'run-manifest-v1', ran: true });
  });

  test('it throws where validateFile throws', () => {
    const [schemaFile, dataFile] = pair(GENERIC_SCHEMA, { a: 1 });
    const absent = path.join(path.dirname(dataFile), 'absent.json');
    expect(() => validateArtifact(absent, dataFile)).toThrow(/ENOENT/);
    expect(() => validateArtifact(schemaFile, absent)).toThrow(/ENOENT/);
  });

  test('the union cannot express a fourth state', () => {
    // Each directive fails the build if the line it guards ever starts compiling, so these assert
    // the declarations rather than this run.
    // @ts-expect-error a pass that ran carries no reason (AC-7)
    const ranWithReason: ArtifactValidationResult['semantic'] = { contract: 'run-manifest-v1', ran: true, reason: 'structurally-invalid' };
    // @ts-expect-error an unrecognised annotation names no contract (AC-7)
    const unrecognisedNamed: ArtifactValidationResult['semantic'] = { contract: 'run-manifest-v1', ran: false, reason: 'unrecognised-annotation' };
    // @ts-expect-error the vocabulary has one recognised value (AC-7, and the non-goals)
    const secondContract: ArtifactValidationResult['semantic'] = { contract: 'run-manifest-v2', ran: true };
    expect([ranWithReason, unrecognisedNamed, secondContract]).toHaveLength(3);
  });
});

describe('AC-9 — nothing in core prints, and the CLI\'s four lines are reproducible from what it returns', () => {
  /**
   * The renderer that belongs to the CLI, transcribed from spike/bin/harness.js:425–459 and driven
   * entirely by `validateArtifact`'s return value. It lives here, in a test, because an escape byte
   * in `core` is a bug in M4's browser and on M3's WebSocket.
   *
   * The citation is re-derived rather than carried: the range moved when Q-0037 took the semantic
   * checker out of the CLI and into spike/src/contracts.js, and again when review round 1 widened
   * the notice to cover a present-but-unsupported annotation. The notice below moved with it, and
   * this helper is only worth having while it still reproduces what the CLI prints — a copy that
   * has stopped matching its subject is a green test of a string nobody sees, which is the failure
   * this file exists to avoid rather than to commit.
   */
  const render = (file: string, result: ArtifactValidationResult): string[] => {
    const lines: string[] = [];
    if (!result.semantic.ran && result.semantic.reason === 'unrecognised-annotation') {
      lines.push(`\x1b[2m·\x1b[0m ${file}: no recognised x-quorum-contract annotation, so no semantic contract applies — no run-manifest semantic checks ran; they were skipped as inapplicable, and run-manifest-v1 is the only contract defined`);
    }
    lines.push(result.ok
      ? `\x1b[32m✓\x1b[0m ${file} matches ${result.schema}`
      : `\x1b[31m✗\x1b[0m ${file} violates ${result.schema}:\n    ${result.errors.join('\n    ')}`);
    return lines;
  };

  test('a clean run manifest prints one green line and no skip line', () => {
    const [schemaFile, dataFile] = pair(RUN_MANIFEST_SCHEMA, CLEAN_RUN, 'run-manifest.schema.json', 'manifest.json');
    expect(render(dataFile, validateArtifact(schemaFile, dataFile)))
      .toStrictEqual([`\x1b[32m✓\x1b[0m ${dataFile} matches run-manifest.schema.json`]);
  });

  test('a broken run manifest prints one red line, indented, and still no skip line', () => {
    const [schemaFile, dataFile] = pair(RUN_MANIFEST_SCHEMA, SEMANTICALLY_BROKEN, 'run-manifest.schema.json', 'manifest.json');
    expect(render(dataFile, validateArtifact(schemaFile, dataFile)))
      .toStrictEqual([`\x1b[31m✗\x1b[0m ${dataFile} violates run-manifest.schema.json:\n    ${ROLLUP_UNSUPPORTED}`]);
  });

  /**
   * All three shapes of the `unrecognised-annotation` outcome render the same line, and the two
   * that carry a value are why that line may not claim the annotation is missing: it is present and
   * merely unsupported. Q-0037 review round 1 — the CLI half of this is
   * spike/test/q0011-runs-cli.js's clause (6).
   */
  test('a generic schema prints the skip line first, then the verdict, however the annotation is unrecognised', () => {
    for (const [name, schema] of [
      ['none', GENERIC_SCHEMA], ['unknown-v1', UNKNOWN_ANNOTATION_SCHEMA], ['empty', EMPTY_ANNOTATION_SCHEMA],
    ] as const) {
      const [schemaFile, dataFile] = pair(schema, { b: 1 }, 'other.schema.json', 'artifact.json');
      expect(render(dataFile, validateArtifact(schemaFile, dataFile)), name).toStrictEqual([
        `\x1b[2m·\x1b[0m ${dataFile}: no recognised x-quorum-contract annotation, so no semantic contract applies — no run-manifest semantic checks ran; they were skipped as inapplicable, and run-manifest-v1 is the only contract defined`,
        `\x1b[31m✗\x1b[0m ${dataFile} violates other.schema.json:\n    /: must have required property 'a'`,
      ]);
    }
  });

  test('a throw prints the file and the message, and nothing core wrote', () => {
    const [schemaFile, dataFile] = pair(GENERIC_SCHEMA, { a: 1 });
    const absent = path.join(path.dirname(dataFile), 'absent.json');
    let line = '';
    try {
      validateArtifact(schemaFile, absent);
    } catch (e) {
      line = `\x1b[31m✗\x1b[0m ${absent}: ${(e as Error).message}`;
    }
    expect(line).toBe(`\x1b[31m✗\x1b[0m ${absent}: ENOENT: no such file or directory, open '${absent}'`);
  });

  test('the exit code is a property of the ok values, and core computes none of it', () => {
    const results = [
      validateArtifact(...pair(GENERIC_SCHEMA, { a: 1 })),
      validateArtifact(...pair(GENERIC_SCHEMA, { b: 1 })),
    ];
    expect(results.filter((r) => !r.ok).length ? 1 : 0).toBe(1);
    expect([validateArtifact(...pair(GENERIC_SCHEMA, { a: 1 }))].filter((r) => !r.ok).length ? 1 : 0).toBe(0);
  });
});

describe('AC-10 — the real committed contracts select, and decline to select, the pass', () => {
  /** A verbatim copy of a committed contract, so `repoFile` still fails loudly if it is missing. */
  const committedSchema = (relative: string): string => {
    const file = path.join(tempDir('committed-'), path.basename(relative));
    write(file, repoFile(relative));
    return file;
  };

  test("Q-0011's frozen manifest contract selects the semantic pass over a constructed manifest", () => {
    const schemaFile = committedSchema('contracts/Q-0011/run-manifest.schema.json');
    const dataFile = path.join(path.dirname(schemaFile), 'manifest.json');
    write(dataFile, JSON.stringify({
      schema_version: 1,
      run_id: 'Q-0045-1',
      ticket_id: 'Q-0045',
      ticket_path: 'backlog/Q-0045-core-contracts-and-manifest-semantics/ticket.md',
      flow: 'chore',
      flow_file: 'harness/flows/chore.yaml',
      stage: { before: 'requirements', after: 'reviewed' },
      started_at: '2026-08-26T10:00:00.000Z',
      ended_at: '2026-08-26T10:00:01.000Z',
      duration_ms: 1000,
      status: 'completed',
      steps: [{
        step_id: 'implement', occurrence_dir: 'steps/001-implement', kind: 'adapter', role: 'developer-generalist',
        adapter: 'claude', model: null, branch: null, worktree: null, started_at: '2026-08-26T10:00:00.000Z',
        duration_ms: 900, attempts: 1, status: 'completed', verdict: null, error: null,
        usage: { vendor: 'claude', input_tokens: 100, output_tokens: 10, cached_input_tokens: null, cache_write_input_tokens: null, cost_usd: 1.5 },
      }],
      rollup: [{
        vendor: 'claude', step_count: 1, unpriced_steps: 0, input_tokens: 100, output_tokens: 10,
        cached_input_tokens: null, cache_write_input_tokens: null, cost_usd: 1.5,
      }],
    }));
    expect(validateArtifact(schemaFile, dataFile)).toStrictEqual({
      ok: true,
      errors: [],
      schema: 'run-manifest.schema.json',
      data: 'manifest.json',
      semantic: { contract: 'run-manifest-v1', ran: true },
    });
  });

  test("Q-0006's frozen contract validates its ticket's frontmatter and reports the pass as skipped", () => {
    const schemaFile = committedSchema('contracts/Q-0006/ticket-review-state.schema.json');
    const ticket = repoFile('backlog/Q-0006-review-flow-and-cross-flow-backward-edge/ticket.md');
    const match = /^---\n([\s\S]*?)\n---\n?/.exec(ticket);
    if (!match) throw new Error('corpus damaged: Q-0006/ticket.md has no frontmatter block');
    const dataFile = path.join(path.dirname(schemaFile), 'frontmatter.yaml');
    write(dataFile, match[1]);
    // Round-tripped through `readData`'s YAML branch, which is how a `harness validate` step would
    // reach it: a contract with no `x-quorum-contract` earns a verdict and never a semantic tick.
    expect(YAML.parse(match[1])).toBeTypeOf('object');
    expect(validateArtifact(schemaFile, dataFile)).toStrictEqual({
      ok: true,
      errors: [],
      schema: 'ticket-review-state.schema.json',
      data: 'frontmatter.yaml',
      semantic: { contract: null, ran: false, reason: 'unrecognised-annotation' },
    });
  });
});
