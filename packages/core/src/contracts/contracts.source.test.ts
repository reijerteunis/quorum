// Q-0045: the criteria that are properties of the code rather than of its behaviour.
//
// Two of them cannot be observed at run time and are exactly what a later change breaks silently.
// "The roll-up is recomputed by a second implementation" is the whole ticket, and nothing fails
// when the two converge — not a test, not `tsc`, not CI — until a writer bug ships undetected.
// "Nothing in core prints" fails nowhere either, until an escape byte reaches a browser.
import fs from 'node:fs';
import { createRequire } from 'node:module';

import { describe, expect, test } from 'vitest';

import * as contractsModule from './contracts.js';
import * as runManifestModule from './run-manifest.js';
import * as barrel from '../index.js';
import { coreSourceFiles, repoFile } from '../../test/corpus.js';

/** Corpus keys are whole paths below `src`, so a same-named file elsewhere can never answer for these. */
const CONTRACTS_SOURCE = 'contracts/contracts.ts';
const RUN_MANIFEST_SOURCE = 'contracts/run-manifest.ts';

/** Every non-test source this ticket added — the corpus's own view of the module's folder. */
const moduleSources = (): [string, string][] => {
  const files = coreSourceFiles().filter(([name]) => name.startsWith('contracts/'));
  if (!files.length) throw new Error('corpus missing: packages/core/src/contracts/ holds no source file');
  return files;
};

const sourceOf = (key: string): string => {
  const found = moduleSources().find(([name]) => name === key);
  if (!found) throw new Error(`corpus missing: packages/core/src/${key} does not exist`);
  return found[1];
};

/** Every module specifier the file imports from, in source order. */
const importsOf = (text: string): string[] =>
  [...text.matchAll(/from\s+'([^']+)'/g)].map((match) => match[1]);

describe('AC-1 — the surface, the folder, and the entry point left alone', () => {
  test('contracts.ts exports exactly the five runtime names, all of them functions', () => {
    expect(Object.keys(contractsModule).sort()).toStrictEqual([
      'checkRunManifestSemantics', 'readData', 'validate', 'validateArtifact', 'validateFile',
    ]);
    for (const value of Object.values(contractsModule)) expect(typeof value).toBe('function');
  });

  test('the folder is two files, and neither is a barrel', () => {
    expect(moduleSources().map(([name]) => name)).toStrictEqual([CONTRACTS_SOURCE, RUN_MANIFEST_SOURCE]);
  });

  test('the barrel re-exports exactly this folder\'s public contribution (Q-0096 AC-2)', () => {
    // Until Q-0096 this pinned `packages/core/src/index.ts` byte for byte, asserting that this
    // port child added no public re-export. Q-0096 opens the surface, so what survives is the half
    // still under decision: `validateArtifact` is the single-read entry point `harness validate`
    // is built on, and `validateFile` and the run-manifest pass stay in-package.
    expect([...Object.keys(contractsModule), ...Object.keys(runManifestModule)]
      .filter((symbol) => symbol in barrel).sort()).toStrictEqual(['validateArtifact']);
  });

  test('it imports node builtins, yaml, ajv, shared and its own siblings — never spike', () => {
    // Deliberately about SPECIFIERS: this package cites spike paths in comments as its evidence,
    // which is the house style, and a check that forbade the word would forbid the citations.
    const allowed = ['node:fs', 'node:path', 'yaml', 'ajv/dist/2020.js', 'ajv-formats', '@quorum/shared'];
    for (const [name, text] of moduleSources()) {
      for (const specifier of importsOf(text)) {
        expect(
          allowed.includes(specifier) || /^\.\/[a-z-]+\.js$/.test(specifier),
          `${name} imports ${specifier}`,
        ).toBe(true);
      }
      for (const line of text.split('\n').filter((l) => /^\s*(import|export)\b/.test(l) || l.includes('require('))) {
        expect(line.includes('spike'), `${name} must not reach into the spike: ${line}`).toBe(false);
      }
    }
  });

  test('no exported type is, or wraps, an ajv error object', () => {
    // A caller must never have to inspect an `ErrorObject` to read a violation; `errors` is strings.
    for (const [name, text] of moduleSources()) {
      expect(text.includes('ErrorObject'), `${name} must not surface ajv's error type`).toBe(false);
    }
  });

  test('strict TypeScript: no `any` and no suppressed diagnostic', () => {
    for (const [name, text] of moduleSources()) {
      for (const forbidden of [': any', '<any>', 'as any', '@ts-ignore', '@ts-expect-error']) {
        expect(text.includes(forbidden), `${name} must not contain ${forbidden}`).toBe(false);
      }
    }
  });

  test('core declares both dependencies, at the versions AC-1 names', () => {
    // The literals are the criterion; they are not read back from spike/package.json at run time.
    // The Q-0009 cutover deletes spike/, and a permanent test may not assert a fact this
    // repository's next landing changes ("A red test is a permanent acceptance test", 2026-08-23).
    const pkg = JSON.parse(repoFile('packages/core/package.json')) as { dependencies: Record<string, string> };
    expect(pkg.dependencies.ajv).toBe('^8.20.0');
    expect(pkg.dependencies['ajv-formats']).toBe('^3.0.1');
  });

  test('the lockfile carries an ajv 8, beside the ajv 6 that is ESLint\'s', () => {
    const lock = repoFile('pnpm-lock.yaml');
    expect(/\n {2}ajv@8\.\d+\.\d+:/.test(lock), 'pnpm-lock.yaml has no ajv@8 entry').toBe(true);
    expect(/\n {2}ajv-formats@3\.\d+\.\d+/.test(lock), 'pnpm-lock.yaml has no ajv-formats@3 entry').toBe(true);
  });
});

describe('AC-2 — one Ajv instance, built once at module scope', () => {
  test('the module constructs Ajv exactly once, and never inside a function', () => {
    const text = sourceOf(CONTRACTS_SOURCE);
    expect(text.split('new Ajv2020(')).toHaveLength(2);
    expect(text).toContain('const ajv = addFormats(new Ajv2020({ allErrors: true, strict: false }));');
    // The call shapes, not the bare words: the comment above the instance names `removeSchema` as
    // the fix this ticket may not make, and a check that forbade the word would forbid the reason.
    for (const forbidden of ['.removeSchema(', '.addSchema(']) {
      expect(text.includes(forbidden), `the compiled-schema cache is shared on purpose: ${forbidden}`).toBe(false);
    }
  });

  test('every other source in the folder reaches for no validator of its own', () => {
    for (const [name, text] of moduleSources().filter(([key]) => key !== CONTRACTS_SOURCE)) {
      expect(text.includes('Ajv'), `${name} must not construct a second validator`).toBe(false);
    }
  });
});

describe('AC-6 — the recomputation is a second implementation, and stays one', () => {
  test('it is not exported: run-manifest.ts hands out the pass and nothing else', () => {
    expect(Object.keys(runManifestModule)).toStrictEqual(['checkRunManifestSemantics']);
  });

  test('nothing in the folder reaches for the writer\'s roll-up', () => {
    // Q-0049 ports `rollup()` from spike/src/engine.js:463 and depends on this ticket, so the
    // invitation to import one into the other is live. Two implementations agreeing is the
    // evidence; one compared against itself detects a hand-edited file and nothing else.
    // Specifiers and call shapes rather than bare words, for the same reason as above: the module
    // names `../run-history/` in a comment precisely to say that it may not import it.
    for (const [name, text] of moduleSources()) {
      for (const specifier of importsOf(text)) {
        expect(specifier.includes('run-history'), `${name} imports ${specifier}`).toBe(false);
      }
      expect(/\brollup\s*\(/.test(text), `${name} must not call a function named rollup`).toBe(false);
    }
  });

  test('the five measures come from shared rather than a second spelling', () => {
    const text = sourceOf(RUN_MANIFEST_SOURCE);
    expect(text).toContain("import { USAGE_MEASURES } from '@quorum/shared';");
    expect(text).toContain("const ROLLUP_FIELDS = ['step_count', 'unpriced_steps', ...USAGE_MEASURES] as const;");
  });
});

describe('AC-9 — nothing in core prints', () => {
  test('no escape sequence, no marker glyph, no rendered sentence', () => {
    for (const [name, text] of moduleSources()) {
      for (const forbidden of ['\\x1b', '\\u001b', '', '✓', '✗', '·', ' matches ', ' violates ', 'checks skipped']) {
        expect(text.includes(forbidden), `${name} must not contain ${JSON.stringify(forbidden)}`).toBe(false);
      }
    }
  });
});

describe('AC-11 — three validations stay distinct, and the ported ajv is the workspace\'s', () => {
  test('neither of the adapter layer\'s two functions is imported or called here', () => {
    // The module names `checkAgainstSchema` in its header to say what it is deliberately NOT, which
    // is the register row it inherits; what is forbidden is reaching for it.
    for (const [name, text] of moduleSources()) {
      for (const specifier of importsOf(text)) {
        expect(specifier.includes('adapters'), `${name} imports ${specifier}`).toBe(false);
      }
      for (const call of ['checkAgainstSchema(', 'extractJson(']) {
        expect(text.includes(call), `${name} must not call ${call}`).toBe(false);
      }
    }
  });

  test('ajv resolves from the workspace at version 8, not from the spike and not from ESLint\'s 6', () => {
    const resolved = createRequire(import.meta.url).resolve('ajv/package.json');
    const pkg = JSON.parse(fs.readFileSync(resolved, 'utf8')) as { version: string };
    expect(pkg.version.startsWith('8.'), `resolved ajv ${pkg.version} at ${resolved}`).toBe(true);
    expect(resolved.includes('spike'), 'core must not resolve ajv out of the spike\'s npm tree').toBe(false);
  });

  test('the module runs from a plain import of its source path, with no relative escape from packages/', () => {
    const result = contractsModule.validate({ type: 'object', required: ['a'] }, { a: 1 });
    expect(result).toStrictEqual({ ok: true, errors: [] });
    for (const [name, text] of moduleSources()) {
      for (const specifier of importsOf(text)) {
        expect(specifier.startsWith('../'), `${name} imports ${specifier} from outside its folder`).toBe(false);
      }
    }
  });
});
