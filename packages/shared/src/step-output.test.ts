import { describe, expect, test } from 'vitest';

import { agentStepResultSchema, stepOutputDeclarationSchema } from './step-output.js';
import { importSpecifiers, sharedSourceFiles } from '../test/corpus.js';

describe('AC-7 — a declaration and a result cannot be confused', () => {
  test('a step\'s output declaration: the four keys the engine reads', () => {
    const declaration = { write: 'requirements/merged.md', verdict: 'ready|needs-input' };
    expect(stepOutputDeclarationSchema.parse(declaration)).toEqual(declaration);
    const many = { writes: ['review/round-1/verdict.md', 'review/verdict.md'], verdict: 'approve|changes-requested', verdict_file: '.harness/verdict.json' };
    expect(stepOutputDeclarationSchema.parse(many)).toEqual(many);
    expect(stepOutputDeclarationSchema.parse({})).toEqual({});
  });

  test('the four shapes schemaFor can build', () => {
    const shapes = [
      { summary: 'what I did' },
      { summary: 'what I did', document: '# The document' },
      { summary: 'what I did', verdict: 'revise', findings: ['blocker: a.ts:12 wrong'] },
      { summary: 'what I did', document: '# The document', verdict: 'approve', findings: [] },
    ];
    for (const shape of shapes) expect(agentStepResultSchema.parse(shape)).toEqual(shape);
  });

  test('a declaration is not accepted as a result', () => {
    expect(agentStepResultSchema.safeParse({ write: 'requirements/merged.md' }).success).toBe(false);
    expect(agentStepResultSchema.safeParse({ writes: ['a.md'], verdict: 'approve|revise' }).success).toBe(false);
  });

  test('a result is not accepted as a declaration', () => {
    expect(stepOutputDeclarationSchema.safeParse({ summary: 's' }).success).toBe(false);
    expect(stepOutputDeclarationSchema.safeParse({ summary: 's', document: 'd', verdict: 'approve', findings: [] }).success).toBe(false);
  });

  test('a verdict without findings, or findings without a verdict, is neither shape', () => {
    // schemaFor puts both in `required` together or neither at all (spike/src/engine.js:689).
    expect(agentStepResultSchema.safeParse({ summary: 's', verdict: 'approve' }).success).toBe(false);
    expect(agentStepResultSchema.safeParse({ summary: 's', findings: [] }).success).toBe(false);
  });

  test('the result schema does not validate a step\'s verdict vocabulary or the findings pattern', () => {
    // Both belong to checkAgainstSchema, against the schema Quorum generated for THAT step.
    expect(agentStepResultSchema.safeParse({ summary: 's', verdict: 'anything-at-all', findings: ['not in the blocker/major/nit shape'] }).success).toBe(true);
  });

  test('shared imports no ajv and constructs no JSON Schema', () => {
    for (const [name, text] of sharedSourceFiles()) {
      expect(importSpecifiers(text).filter((s) => s.includes('ajv')), `${name}`).toEqual([]);
      expect(text, `${name} must not construct a JSON Schema`).not.toContain('additionalProperties');
      expect(text, `${name} must not construct a JSON Schema`).not.toContain('$schema');
    }
  });

  test('the module names all four validators and where each lives', () => {
    const module = sharedSourceFiles().find(([name]) => name === 'step-output.ts');
    if (!module) throw new Error('packages/shared/src/step-output.ts is missing');
    const text = module[1];
    for (const marker of ['zod', 'checkAgainstSchema', 'ajv', 'extractJson']) {
      expect(text, `the four-validator note must name ${marker}`).toContain(marker);
    }
    expect(text).toContain('spike/src/contracts.js');
    expect(text).toContain('spike/src/adapters/index.js:181');
    expect(text).toContain('spike/src/adapters/index.js:169');
  });
});
