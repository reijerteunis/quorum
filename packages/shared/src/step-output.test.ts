import { describe, expect, test } from 'vitest';

import { agentStepResultSchema, stepOutputDeclarationSchema } from './step-output.js';
import { importSpecifiers, repoFile, sharedSourceFiles } from '../test/corpus.js';

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
    // Q-0107 AC-13 — `re-aimed`, assertion and comment block together, in one change. The
    // FOUR-VALIDATIONS block cited `spike/src/contracts.js`, `spike/src/adapters/index.js:181`,
    // `spike/src/engine.js:679` and `spike/src/adapters/index.js:169`; this assertion pinned three
    // of the four and left `schemaFor`'s unpinned, so correcting only what was pinned would have
    // left the block half naming a deleted tree. The unit is the block.
    //
    // The other eight `spike/` citations in that file are elsewhere in it, are a mechanical sweep
    // of their own, and are deliberately untouched — the file is left mixed on purpose.
    const module = sharedSourceFiles().find(([name]) => name === 'step-output.ts');
    if (!module) throw new Error('packages/shared/src/step-output.ts is missing');
    const text = module[1];
    for (const marker of ['zod', 'checkAgainstSchema', 'ajv', 'extractJson']) {
      expect(text, `the four-validator note must name ${marker}`).toContain(marker);
    }
    // Four citations rather than three, and each is required to EXIST rather than merely to be
    // spelled: a pin naming a file nobody kept is a pin that cannot say so.
    // Path and line are separate so the path is a bare literal: `turbo-inputs.test.ts` decides
    // whether a quoted string is a repository path, and `…/adapters.ts:548` is not one.
    const cited: [string, number | null][] = [
      ['packages/core/src/contracts/contracts.ts', null],
      // Q-0067 shifted both by 68 lines, `cliVersion` having landed above them in that file. The
      // numbers move with the code they name, which is what this pin is for: a citation that stops
      // naming a declaration is exactly what it exists to catch, and it caught this one.
      ['packages/core/src/adapters/adapters.ts', 616],
      ['packages/core/src/engine/prompt.ts', 92],
      ['packages/core/src/adapters/adapters.ts', 579],
    ];
    for (const [file, line] of cited) {
      const citation = line === null ? file : `${file}:${String(line)}`;
      expect(text, `the four-validator note must cite ${citation}`).toContain(citation);
      const lines = repoFile(file).split('\n');
      if (line !== null) {
        expect(lines[line - 1], `${citation} must still be the declaration it names`)
          .toMatch(/^export function/);
      }
    }
    // The block names no path under the tree Q-0103 deletes. Scoped to the block rather than to the
    // file, because eight citations below it are a later sweep's and would fail a whole-file clause.
    const block = /FOUR VALIDATIONS EXIST[\s\S]*?Adding\n\/\/ zod must not tempt anyone to collapse them\./.exec(text);
    expect(block, 'the FOUR-VALIDATIONS block must still be findable').not.toBeNull();
    // The needle is assembled so this file carries no path under that tree of its own — the device
    // `index.test.ts:11` uses, and what keeps `packages/cli/src/spike-dependencies.test.ts` from
    // having to excuse this line as a read.
    expect(block?.[0], 'the block names no path under the tree the cutover deletes')
      .not.toContain(`${'spi'}ke/`);
  });
});
