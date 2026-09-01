// Q-0045 AC-2, AC-3, AC-4, AC-8 and AC-10's rejection cases: the generic validator, on its own.
//
// The `$id` budget of this file is ONE. The module-level Ajv instance caches every compiled schema
// by `$id` for the life of the process (AC-8 defect 1), so a second parse of the same schema file
// collides. `contracts/Q-0006/ticket-review-state.schema.json` is therefore read and parsed exactly
// once here and the SAME object is handed to every call; the schemas the tests author carry no
// `$id` at all, which is what makes them repeatable. Vitest isolates each test file, so the sibling
// suites start from a fresh instance.
import path from 'node:path';

import YAML from 'yaml';
import { afterAll, describe, expect, test } from 'vitest';

import { readData, validate, validateFile } from './contracts.js';
import { repoFile } from '../../test/corpus.js';
import { removeTempDirs, tempDir, write } from '../../test/repo.js';

afterAll(removeTempDirs);

/** A schema and a data file in a nested throwaway directory, so basenames cannot come from a path. */
const pair = (schema: unknown, data: unknown, schemaName = 'x.schema.json', dataName = 'y.json'): [string, string] => {
  const dir = path.join(tempDir('contracts-'), 'nested', 'deeper');
  const schemaFile = path.join(dir, schemaName);
  const dataFile = path.join(dir, dataName);
  write(schemaFile, JSON.stringify(schema));
  write(dataFile, JSON.stringify(data));
  return [schemaFile, dataFile];
};

const thrown = (fn: () => unknown): Error => {
  try {
    fn();
  } catch (e) {
    return e as Error;
  }
  throw new Error('expected a throw, and nothing was thrown');
};

/**
 * The frozen Q-0006 contract, parsed once. It is a real committed artifact rather than a fixture
 * because the claim that made this validator worth adding was made about the real ones
 * ("Contracts are executable", docs/DECISIONS.md 2026-08-22).
 */
const ticketStateSchema: unknown = JSON.parse(repoFile('contracts/Q-0006/ticket-review-state.schema.json'));

/** A committed ticket's frontmatter, as `Backlog` reads it: the block between the first two `---`. */
const frontmatterOf = (file: string): Record<string, unknown> => {
  const match = /^---\n([\s\S]*?)\n---\n?/.exec(repoFile(file));
  if (!match) throw new Error(`corpus damaged: ${file} has no frontmatter block`);
  return YAML.parse(match[1]) as Record<string, unknown>;
};

/** Q-0006's own, which is the fixture most of this file spoils one field at a time. */
const q0006Frontmatter = (): Record<string, unknown> =>
  frontmatterOf('backlog/Q-0006-review-flow-and-cross-flow-backward-edge/ticket.md');

/** The same frontmatter with its history replaced, so an error path is `/history/0` whatever Q-0006 accrues. */
const withHistory = (entry: unknown): Record<string, unknown> => ({ ...q0006Frontmatter(), history: [entry] });

/** A well-formed Q-0006 terminal event, for the malformed copies below to spoil one field at a time. */
const TERMINAL_EVENT = {
  stage: 'green', run: 11, flow: 'review', status: 'exhausted',
  stage_before: 'green', stage_after: 'green', at: '2026-08-24T00:00:00.000Z', cost: 0,
};

describe('AC-2 — validate() is the same validator, configured the same way', () => {
  test('the error string is instance path, rule, and the offending key when there is one', () => {
    expect(validate({ type: 'object', properties: { a: { type: 'string' } }, required: ['a'], additionalProperties: false }, { b: 1 }))
      .toStrictEqual({
        ok: false,
        errors: ["/: must have required property 'a'", '/: must NOT have additional properties ("b")'],
      });
  });

  test('a conforming document returns ok with no errors', () => {
    expect(validate({ type: 'object', properties: { a: { type: 'string' } } }, { a: 'ok' }))
      .toStrictEqual({ ok: true, errors: [] });
  });

  test('ajv-formats is registered, not merely installed', () => {
    // Without the plugin ajv ignores an unknown format and this document passes, which would make
    // every `format: date-time` in a contract a check nobody performs.
    expect(validate({ type: 'object', properties: { at: { type: 'string', format: 'date-time' } } }, { at: 'yesterday' }))
      .toStrictEqual({ ok: false, errors: ['/at: must match format "date-time"'] });
  });

  test('strict: false — an unknown keyword is data, not an error', () => {
    // `x-quorum-contract` could not sit in a schema at all otherwise.
    expect(validate({ type: 'object', 'x-quorum-contract': 'run-manifest-v1', properties: { a: { type: 'string' } } }, { a: 'ok' }))
      .toStrictEqual({ ok: true, errors: [] });
  });

  test('allErrors: true — two independent violations arrive together', () => {
    expect(validate({ type: 'object', properties: { a: { type: 'string' }, b: { type: 'number' } } }, { a: 1, b: 'x' }))
      .toStrictEqual({ ok: false, errors: ['/a: must be string', '/b: must be number'] });
  });

  test('a schema that does not compile throws, because an authoring bug must be loud', () => {
    const error = thrown(() => validate({ type: 'object', properties: { a: { type: 'nope' } } }, {}));
    expect(error.message).toContain('schema is invalid');
  });

  test('oneOf, if/then and nested required each report the path that locates them', () => {
    // A terminal event missing `stage_before` and claiming a cost for an exhausted loop: the legacy
    // branch is refused for carrying `status`, the Q-0006 branch for both of its own defects.
    const spoiled = {
      stage: 'green', run: 11, flow: 'review', status: 'exhausted',
      stage_after: 'green', at: '2026-08-24T00:00:00.000Z', cost: 5,
    };
    expect(validate(ticketStateSchema, withHistory(spoiled))).toStrictEqual({
      ok: false,
      errors: [
        '/history/0: must NOT be valid',
        '/history/0/cost: must be equal to constant',
        '/history/0: must match "then" schema',
        "/history/0: must have required property 'stage_before'",
        '/history/0: must match exactly one schema in oneOf',
      ],
    });
  });

  test('enum and type violations report the nested path too', () => {
    expect(validate(ticketStateSchema, withHistory({ ...TERMINAL_EVENT, run: 'eleven', status: 'nope' }))).toStrictEqual({
      ok: false,
      errors: [
        '/history/0/run: must be integer',
        '/history/0/status: must be equal to one of the allowed values',
      ],
    });
  });
});

describe('AC-3 — readData reads JSON and YAML by extension, and nothing else', () => {
  const dir = () => tempDir('readdata-');

  test('.json parses as JSON', () => {
    const file = path.join(dir(), 'a.json');
    write(file, '{"a": 1}');
    expect(readData(file)).toStrictEqual({ a: 1 });
  });

  test('.yaml, .yml, .YAML and .YML all parse as YAML', () => {
    for (const name of ['a.yaml', 'a.yml', 'a.YAML', 'a.YML']) {
      const file = path.join(dir(), name);
      write(file, 'a: 1\n');
      expect(readData(file), name).toStrictEqual({ a: 1 });
    }
  });

  test('every other extension goes to JSON.parse, with no content sniffing', () => {
    const file = path.join(dir(), 'a.txt');
    write(file, 'a: 1\n');
    const error = thrown(() => readData(file));
    expect(error).toBeInstanceOf(SyntaxError);
  });

  test('a missing file propagates ENOENT, naming the path', () => {
    const file = path.join(dir(), 'absent.json');
    const error = thrown(() => readData(file)) as NodeJS.ErrnoException;
    expect(error.code).toBe('ENOENT');
    expect(error.message).toContain(file);
  });
});

describe('AC-4 — validateFile keeps its signature, its return shape and its per-call schema read', () => {
  test('a valid pair returns the verdict beside both basenames, never their paths', () => {
    const [schemaFile, dataFile] = pair({ type: 'object', required: ['a'] }, { a: 1 });
    expect(validateFile(schemaFile, dataFile)).toStrictEqual({
      ok: true, errors: [], schema: 'x.schema.json', data: 'y.json',
    });
    expect(schemaFile).toContain(`${path.sep}nested${path.sep}deeper${path.sep}`);
  });

  test('an invalid pair carries the same two keys alongside its errors', () => {
    const [schemaFile, dataFile] = pair(
      { type: 'object', required: ['a'] }, { b: 1 }, 'run.schema.json', 'artifact.json',
    );
    expect(validateFile(schemaFile, dataFile)).toStrictEqual({
      ok: false,
      errors: ["/: must have required property 'a'"],
      schema: 'run.schema.json',
      data: 'artifact.json',
    });
  });

  test('an unreadable schema and an unreadable data file each throw', () => {
    const [schemaFile, dataFile] = pair({ type: 'object' }, {});
    const absent = path.join(path.dirname(dataFile), 'absent.json');
    expect((thrown(() => validateFile(absent, dataFile)) as NodeJS.ErrnoException).code).toBe('ENOENT');
    expect((thrown(() => validateFile(schemaFile, absent)) as NodeJS.ErrnoException).code).toBe('ENOENT');
  });
});

describe('AC-8 — preserved defects 3 and 5', () => {
  test('defect 3: an authoring bug and a filesystem failure are both a plain Error', () => {
    // Only the message tells them apart, which is why a caller cannot route on the type.
    const authoring = thrown(() => validate({ type: 'object', properties: { a: { type: 'nope' } } }, {}));
    expect(authoring.name).toBe('Error');
    expect((authoring as NodeJS.ErrnoException).code).toBeUndefined();
    expect(authoring.message).toContain('schema is invalid');
  });

  test('defect 5: a non-URI $id is accepted without complaint under strict: false', () => {
    expect((ticketStateSchema as { $id: string }).$id).toBe('Q-0006/ticket-review-state');
    expect(validate(ticketStateSchema, q0006Frontmatter()).ok).toBe(true);
  });
});

describe('AC-10 — the real committed artifacts are the fixtures', () => {
  test("Q-0006's committed frontmatter still satisfies Q-0006's committed contract", () => {
    expect(validate(ticketStateSchema, q0006Frontmatter())).toStrictEqual({ ok: true, errors: [] });
  });

  test('a malformed `at` in a copy of it is refused on the format alone', () => {
    expect(validate(ticketStateSchema, withHistory({ ...TERMINAL_EVENT, at: 'yesterday' }))).toStrictEqual({
      ok: false, errors: ['/history/0/at: must match format "date-time"'],
    });
  });

  test("Q-0040 — Q-0011's committed frontmatter satisfies it too, `interrupted` and all", () => {
    // The schema was frozen at Q-0006, before either `interrupted` or `undecided` existed, and the
    // engine has written `interrupted` since. So this artifact — committed, unedited, and holding
    // one at `ticket.md:122` — failed the contract that governs it, today and independently of
    // Q-0040. It is the fixture rather than a synthetic entry precisely because the divergence was
    // never hypothetical: nothing validated a real ticket against this file, which is how a frozen
    // schema and the tree it describes drift apart in silence.
    const q0011 = frontmatterOf('backlog/Q-0011-run-history-on-disk/ticket.md');
    const statuses = (q0011.history as { status?: string }[]).map((entry) => entry.status);
    expect(statuses, 'the witness is this ticket carrying one').toContain('interrupted');
    expect(validate(ticketStateSchema, q0011)).toStrictEqual({ ok: true, errors: [] });
  });

  test('Q-0040 — both statuses the erratum added are admitted, and the enum is still closed', () => {
    // Added together because they were missing for one reason — the freeze predates both — so
    // closing one and leaving the other would ship a known contradiction in a file already open.
    for (const status of ['interrupted', 'undecided']) {
      expect(validate(ticketStateSchema, withHistory({ ...TERMINAL_EVENT, status, cost: 1 })), status)
        .toStrictEqual({ ok: true, errors: [] });
    }
    // Widening is not opening: a word nothing writes is still refused, so this is an enumeration
    // rather than a `type: string` wearing one.
    expect(validate(ticketStateSchema, withHistory({ ...TERMINAL_EVENT, status: 'paused', cost: 1 })).ok).toBe(false);
  });
});
