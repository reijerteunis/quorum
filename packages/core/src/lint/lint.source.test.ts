// Q-0044: the criteria that are properties of the code rather than of its behaviour.
//
// "no schema runs in front of the linter" is the whole ticket, and it is not observable at run time
// from the outside — a rewrite that types the parameter `Flow` and calls `flowSchema.parse()` at
// the top compiles, and then passes every fixture an implementer builds AS a `Flow`. It only fails
// on the objects a real YAML file produces, which is a $10 review round away. Asserted here, where
// it fails in seconds.
import { describe, expect, test } from 'vitest';

import * as lintModule from './lint.js';
import { coreSourceFiles, repoFile } from '../../test/corpus.js';

/**
 * Corpus keys are whole paths below `src`, so a same-named file in another folder can never answer
 * for this one (Q-0064).
 */
const LINT_SOURCE = 'lint/lint.ts';

const lintSource = (): string => {
  const found = coreSourceFiles().find(([name]) => name === LINT_SOURCE);
  if (!found) throw new Error(`corpus missing: packages/core/src/${LINT_SOURCE} does not exist`);
  return found[1];
};

/** Every non-test source this ticket added — the corpus's own view of the module's folder. */
const moduleSources = (): [string, string][] => {
  const files = coreSourceFiles().filter(([name]) => name.startsWith('lint/'));
  if (!files.length) throw new Error('corpus missing: packages/core/src/lint/ holds no source file');
  return files;
};

/** Every module specifier the file imports from, in source order. */
const importsOf = (text: string): string[] =>
  [...text.matchAll(/from\s+'([^']+)'/g)].map((match) => match[1]);

describe('AC-1 — the surface, and the entry point left alone', () => {
  test('exactly the six names the port declares, all of them functions or the class', () => {
    expect(Object.keys(lintModule).sort()).toStrictEqual([
      'FlowError', 'flattenSteps', 'lintDirectory', 'lintFlow', 'lintFlowDirectory', 'validateFlowDirectory',
    ]);
    for (const value of Object.values(lintModule)) expect(typeof value).toBe('function');
  });

  test('packages/core/src/index.ts is untouched, so Q-0041\'s byte pin stays green', () => {
    // This ticket adds no public re-export: every consumer it has is in-package and imports
    // ./lint/lint.js directly, exactly as src/git/ and src/backlog/ are consumed today (OQ-2).
    expect(repoFile('packages/core/src/index.ts')).toBe("export const name = '@quorum/core';\n");
  });

  test('it imports node builtins, yaml and @quorum/shared — never spike, never zod', () => {
    // Deliberately about SPECIFIERS rather than the file's text: this package cites spike paths in
    // comments as its evidence, which is the house style, and a check that forbade the word would
    // forbid the citations instead of the dependency.
    for (const [name, text] of moduleSources()) {
      for (const specifier of importsOf(text)) {
        expect(
          ['node:fs', 'node:path', 'yaml', '@quorum/shared'].includes(specifier),
          `${name} imports ${specifier}`,
        ).toBe(true);
      }
      for (const line of text.split('\n').filter((l) => /^\s*(import|export)\b/.test(l) || l.includes('require('))) {
        expect(line.includes('spike'), `${name} must not reach into the spike: ${line}`).toBe(false);
      }
    }
  });
});

describe('AC-1 — no validator stands in front of the linter', () => {
  test('the module names no flow schema and calls no zod method', () => {
    // The bare word `zod` is not forbidden — the comments name the boundary decision it comes from,
    // and that citation is the reason the rule exists. What is forbidden is reaching for one.
    for (const [name, text] of moduleSources()) {
      for (const forbidden of ['flowSchema', 'flowStepSchema', 'stepInputSchema', '.safeParse(', "from 'zod'", 'z.object', 'z.string']) {
        expect(text.includes(forbidden), `${name} must not contain ${forbidden}`).toBe(false);
      }
    }
  });

  test('the only `.parse(` in the module is YAML.parse, which AC-8 requires', () => {
    // The criterion is written as "no `.parse(`", and reading it literally would forbid the one
    // call the directory walk is specified to make. What it guards against is a SCHEMA parse, so
    // the YAML reader is removed before the assertion rather than exempted from it.
    for (const [name, text] of moduleSources()) {
      expect(text.replaceAll('YAML.parse(', '').includes('.parse('), `${name} may parse YAML and nothing else`).toBe(false);
    }
  });

  test('lintFlow takes `unknown`, not `Flow`', () => {
    const text = lintSource();
    expect(text).toContain('export function lintFlow(flow: unknown): boolean');
    expect(/lintFlow\s*\(\s*flow\s*:\s*Flow/.test(text), 'typing the parameter is how the messages get lost').toBe(false);
  });

  test('and the types it does import are types, so none of them can run', () => {
    expect(lintSource()).toContain("import type { Flow, FlowStep } from '@quorum/shared';");
  });
});

describe('AC-1 — strict TypeScript, and no second spelling of a value shared declares', () => {
  test('no `any` and no suppressed diagnostic', () => {
    for (const [name, text] of moduleSources()) {
      for (const forbidden of [': any', '<any>', 'as any', '@ts-ignore', '@ts-expect-error']) {
        expect(text.includes(forbidden), `${name} must not contain ${forbidden}`).toBe(false);
      }
    }
  });

  test('the ticket branch prefix comes from shared, and is not written out again', () => {
    const text = lintSource();
    expect(text).toContain('ticketBranchPrefix');
    expect(text.includes('harness/'), 'the branch prefix belongs to shared').toBe(false);
  });

  test('no base-branch default is spelled here — a range names `{base}`, never a branch', () => {
    for (const [name, text] of moduleSources()) {
      for (const spelling of ["'main'", '"main"', 'DEFAULT_BASE_BRANCH']) {
        expect(text.includes(spelling), `${name} must not name a base branch`).toBe(false);
      }
    }
    expect(lintSource()).toContain("const BASE_ENDPOINT = '{base}';");
  });
});

describe('AC-12 — FlowError is declared, not decorated', () => {
  test('the class body is empty: no name, no message, no captureStackTrace', () => {
    const text = lintSource();
    expect(text).toContain('export class FlowError extends Error {}');
    for (const forbidden of ['this.name', 'captureStackTrace', 'super(message']) {
      expect(text.includes(forbidden), `FlowError must not set ${forbidden}`).toBe(false);
    }
  });
});

describe('AC-3/AC-4 — the two halves of the fan-out rule are visible in the source', () => {
  test('flattenSteps does not mention a fan-out template, and diffSites does', () => {
    const text = lintSource();
    const flatten = text.slice(text.indexOf('export function flattenSteps'));
    expect(flatten.slice(0, flatten.indexOf('\n}')).includes('fan_out'), 'flattenSteps must stay shallow').toBe(false);
    const sites = text.slice(text.indexOf('function diffSites'));
    expect(sites.slice(0, sites.indexOf('\n}'))).toContain('fan_out');
  });
});
