// Q-0046 AC-6 and AC-7: the two halves of the structured tail — tolerance for how a vendor wrapped
// its answer, and strictness about whether the answer matches what Quorum asked for.
//
// They are tested together because the boundary between them is the criterion (register row 13):
// `extractJson` bends and returns `null` rather than repairing, `checkAgainstSchema` does not bend
// at all, and neither knows anything about ajv, zod or solutioning's contracts.
//
// Covers spike/test/q0006-engine.js:78-89's subject, over the same frozen contract.
import { FINDING_PATTERN } from '@quorum/shared';
import { describe, expect, test } from 'vitest';

import { checkAgainstSchema, extractJson } from './adapters.js';
import type { AdapterSchema } from './adapters.js';
import { repoFile } from '../../test/corpus.js';

/**
 * What `schemaFor` generates for a step, transcribed from spike/src/engine.js:679-692 because the
 * generator is Q-0052's and lives in a file this ticket may not import. The pattern comes from
 * `@quorum/shared` rather than from a second spelling of it.
 */
const generatedSchema = ({ writes = false, verdict }: { writes?: boolean; verdict?: string } = {}): AdapterSchema => {
  const properties: NonNullable<AdapterSchema['properties']> = { summary: { type: 'string', description: 'One paragraph: what you did and why.' } };
  const required = ['summary'];
  if (writes) {
    properties.document = { type: 'string', description: 'The full markdown document to be written to the backlog.' };
    required.push('document');
  }
  if (verdict) {
    const options = verdict.split('|');
    properties.verdict = { type: 'string', enum: options };
    properties.findings = {
      type: 'array',
      items: options.includes('changes-requested') ? { type: 'string', pattern: FINDING_PATTERN } : { type: 'string' },
      description: 'Concrete, actionable findings. Empty when the verdict is the first option.',
    };
    required.push('verdict', 'findings');
  }
  return { type: 'object', properties, required, additionalProperties: false };
};

describe('AC-6 — extractJson is the only tolerance, and it repairs nothing', () => {
  test('a fenced block is chosen over the prose around it', () => {
    expect(extractJson('Here is my answer.\n\n```json\n{"summary": "done"}\n```\n\nHope that helps.')).toStrictEqual({ summary: 'done' });
  });

  test('a bare fence, with no language, is read the same way', () => {
    expect(extractJson('prose\n```\n{"summary": "done"}\n```')).toStrictEqual({ summary: 'done' });
  });

  test('the LAST fence wins — an agent that answers twice meant the second one', () => {
    expect(extractJson('```json\n{"n": 1}\n```\nsecond thoughts:\n```json\n{"n": 2}\n```')).toStrictEqual({ n: 2 });
  });

  test('a malformed last fence falls back to an earlier valid one', () => {
    expect(extractJson('```json\n{"n": 1}\n```\n```json\n{"n": 2,\n```')).toStrictEqual({ n: 1 });
  });

  test('an unfenced object at the end of a message is found by its last newline-brace', () => {
    expect(extractJson('I could not use a fence.\n{"summary": "done"}')).toStrictEqual({ summary: 'done' });
  });

  test('an answer that is nothing but an object parses through the trimmed-text branch', () => {
    expect(extractJson('  {"summary": "done"}  ')).toStrictEqual({ summary: 'done' });
  });

  test('a JSON array comes back unchanged — this function does not decide what a valid answer is', () => {
    expect(extractJson('[1, 2]')).toStrictEqual([1, 2]);
  });

  test('prose, an empty string and nothing at all are all null, and never an empty object', () => {
    expect(extractJson('I have thought about it and decided not to answer.')).toBeNull();
    expect(extractJson('')).toBeNull();
    expect(extractJson(undefined)).toBeNull();
    expect(extractJson(null)).toBeNull();
  });

  test('a partly-parseable answer is null rather than half an object', () => {
    expect(extractJson('```json\n{"summary": "done", "verdict":\n```')).toBeNull();
  });
});

describe('AC-7 — checkAgainstSchema reports every problem, in push order', () => {
  test('the four rules fire in order and nothing is dropped', () => {
    const problems = checkAgainstSchema({ verdict: 'approve', findings: ['x'], summary: 1, extra: 2 }, generatedSchema({ verdict: 'approve|revise' }));
    expect(problems).toStrictEqual([
      'unknown "extra"',
      '"summary" must be a non-empty string',
      'approve requires empty findings',
    ]);
  });

  test('a non-pass verdict with no findings is refused by name', () => {
    expect(checkAgainstSchema({ summary: 'x', verdict: 'revise', findings: [] }, generatedSchema({ verdict: 'approve|revise' })))
      .toStrictEqual(['revise requires findings']);
  });

  test('with three values, the second and third are treated alike — only the FIRST means pass', () => {
    const schema = generatedSchema({ verdict: 'approve|revise|reject' });
    expect(checkAgainstSchema({ summary: 'x', verdict: 'revise', findings: [] }, schema)).toStrictEqual(['revise requires findings']);
    expect(checkAgainstSchema({ summary: 'x', verdict: 'reject', findings: [] }, schema)).toStrictEqual(['reject requires findings']);
    expect(checkAgainstSchema({ summary: 'x', verdict: 'approve', findings: [] }, schema)).toStrictEqual([]);
  });

  test('a missing required key is named, one message per key', () => {
    expect(checkAgainstSchema({}, generatedSchema({ writes: true, verdict: 'approve|revise' })))
      .toStrictEqual(['missing "summary"', 'missing "document"', 'missing "verdict"', 'missing "findings"']);
  });

  test('an enum violation quotes the vocabulary and what came back instead', () => {
    expect(checkAgainstSchema({ summary: 'x', verdict: 'nope', findings: ['a'] }, generatedSchema({ verdict: 'approve|revise' })))
      .toStrictEqual(['"verdict" must be one of approve|revise, got "nope"']);
  });

  test('an answer that is not an object at all is one message and no others', () => {
    const schema = generatedSchema({ verdict: 'approve|revise' });
    for (const value of [null, [], 'a string', 42, undefined]) {
      expect(checkAgainstSchema(value, schema), JSON.stringify(value ?? null)).toStrictEqual(['output is not an object']);
    }
  });

  test('array rules: shape, bounds, and item type', () => {
    const bounded: AdapterSchema = {
      type: 'object',
      properties: { items: { type: 'array', minItems: 1, maxItems: 2, items: { type: 'string' } } },
      required: ['items'],
      additionalProperties: false,
    };
    expect(checkAgainstSchema({ items: 'not an array' }, bounded)).toStrictEqual(['"items" must be an array']);
    expect(checkAgainstSchema({ items: [] }, bounded)).toStrictEqual(['"items" needs at least 1 item(s)']);
    expect(checkAgainstSchema({ items: ['a', 'b', 'c'] }, bounded)).toStrictEqual(['"items" needs at most 2 item(s)']);
    expect(checkAgainstSchema({ items: [1] }, bounded)).toStrictEqual(['"items" items must be strings']);
    expect(checkAgainstSchema({ items: ['a'] }, bounded)).toStrictEqual([]);
  });

  test('a finding that does not carry severity and a line number is named with its own text', () => {
    expect(checkAgainstSchema({ summary: 'x', verdict: 'changes-requested', findings: ['major: no-line'] }, generatedSchema({ verdict: 'approve|changes-requested' })))
      .toStrictEqual(['"findings" item has invalid format: "major: no-line"']);
  });

  test('a string that is present but too short is a non-empty-string problem', () => {
    const schema: AdapterSchema = { type: 'object', properties: { summary: { type: 'string', minLength: 4 } }, required: ['summary'] };
    expect(checkAgainstSchema({ summary: 'abc' }, schema)).toStrictEqual(['"summary" must be a non-empty string']);
    expect(checkAgainstSchema({ summary: 'abcd' }, schema)).toStrictEqual([]);
  });

  test('an unknown key is tolerated when the schema does not close itself', () => {
    expect(checkAgainstSchema({ summary: 'x', extra: 1 }, { type: 'object', properties: { summary: { type: 'string' } }, required: ['summary'] })).toStrictEqual([]);
  });

  test('the coupling needs both a verdict vocabulary and an array of findings to fire at all', () => {
    // `findings` absent, so the pass/fail coupling has nothing to compare — the required check is
    // what catches it, and the coupling stays silent rather than guessing.
    expect(checkAgainstSchema({ summary: 'x', verdict: 'approve' }, generatedSchema({ verdict: 'approve|revise' })))
      .toStrictEqual(['missing "findings"']);
  });
});

describe('AC-7 — the frozen Q-0006 verdict clauses, over the committed contract', () => {
  /**
   * spike/test/q0006-engine.js:78-89 builds this: the generated verdict schema with `findings`
   * replaced by the frozen contract's own definition, so the assertion is made against a real
   * committed artifact rather than a fixture written to agree with the code.
   */
  const runtimeSchema = (): AdapterSchema => {
    const contract = JSON.parse(repoFile('contracts/Q-0006/review-artifacts.schema.json')) as {
      oneOf: { title?: string; properties: Record<string, unknown> }[];
    };
    const branch = contract.oneOf.find((option) => option.title === 'Verdict output');
    if (!branch) throw new Error('corpus damaged: review-artifacts.schema.json has no "Verdict output" branch');
    const generated = generatedSchema({ writes: true, verdict: 'approve|changes-requested' });
    return { ...generated, properties: { ...generated.properties, findings: branch.properties.findings as NonNullable<AdapterSchema['properties']>[string] } };
  };

  test.each([
    ['a pass verdict carrying a finding', { summary: 'x', document: 'x', verdict: 'approve', findings: ['nit: a.js:1 no'] }],
    ['a rejection carrying none', { summary: 'x', document: 'x', verdict: 'changes-requested', findings: [] }],
    ['a finding with no line number', { summary: 'x', document: 'x', verdict: 'changes-requested', findings: ['major: no-line'] }],
    ['a verdict outside the vocabulary', { summary: 'x', document: 'x', verdict: 'looks-fine', findings: ['major: a.js:1 no'] }],
    ['a document that is not a string', { summary: 'x', document: 7, verdict: 'approve', findings: [] }],
    ['an answer with a key nobody asked for', { summary: 'x', document: 'x', verdict: 'approve', findings: [], mood: 'confident' }],
  ])('refused: %s', (_label, value) => {
    expect(checkAgainstSchema(value, runtimeSchema()).length).toBeGreaterThan(0);
  });

  test('and the good answer is accepted with nothing to say about it', () => {
    expect(checkAgainstSchema({ summary: 'x', document: 'x', verdict: 'approve', findings: [] }, runtimeSchema())).toStrictEqual([]);
  });
});
