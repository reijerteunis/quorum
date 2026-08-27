// Q-0046 AC-1, AC-2 and AC-7: the criteria that are properties of the code rather than of its
// behaviour.
//
// None of them fails at run time. "Nothing in core prints" fails nowhere until an escape byte
// reaches a browser; "no second spelling of the five measures" fails nowhere until a roll-up drifts;
// "this module does not reach for ajv" fails nowhere until two of the four validations have quietly
// become one. Each is exactly the property a later change breaks silently.
import path from 'node:path';

import { USAGE_MEASURES } from '@quorum/shared';
import { afterAll, describe, expect, test } from 'vitest';

import * as adaptersModule from './adapters.js';
import * as mockModule from './mock.js';
import { coreSourceFiles, repoFile } from '../../test/corpus.js';
import { removeTempDirs, tempDir, write } from '../../test/repo.js';

afterAll(removeTempDirs);

/** Corpus keys are whole paths below `src`, so a same-named file elsewhere can never answer for these. */
const ADAPTERS_SOURCE = 'adapters/adapters.ts';
const MOCK_SOURCE = 'adapters/mock.ts';
const EXEC_SOURCE = 'adapters/exec.ts';

/**
 * Q-0047's eight, in the order the corpus sorts them.
 *
 * The capability modules are hyphenated rather than dotted because the specifier rule below admits
 * `./claude-capabilities.js` and rejects `./claude.capabilities.js`. That is a landed assertion
 * deciding a filename, which is the cheap direction: the alternative was editing the assertion.
 */
const FOLDER = [
  ADAPTERS_SOURCE,
  'adapters/claude-capabilities.ts',
  'adapters/claude.ts',
  'adapters/codex-capabilities.ts',
  'adapters/codex.ts',
  EXEC_SOURCE,
  MOCK_SOURCE,
  'adapters/override.ts',
];

/** Every non-test source this ticket added — the corpus's own view of the module's folder. */
const moduleSources = (): [string, string][] => {
  const files = coreSourceFiles().filter(([name]) => name.startsWith('adapters/'));
  if (!files.length) throw new Error('corpus missing: packages/core/src/adapters/ holds no source file');
  return files;
};

const sourceOf = (key: string): string => {
  const found = moduleSources().find(([name]) => name === key);
  if (!found) throw new Error(`corpus missing: packages/core/src/${key} does not exist`);
  return found[1];
};

/** Every module specifier a file imports from, in source order. */
const importsOf = (text: string): string[] => [...text.matchAll(/from\s+'([^']+)'/g)].map((match) => match[1]);

describe('AC-1 — the surface, the folder, the dependencies, and the entry point left alone', () => {
  test('adapters.ts exports exactly the eight runtime names', () => {
    expect(Object.keys(adaptersModule).sort()).toStrictEqual([
      'PROBE_SCHEMA', 'authError', 'checkAgainstSchema', 'extractJson',
      'getAdapter', 'probeAdapter', 'transientError', 'withRetry',
    ]);
    // PROBE_PROMPT, TRANSIENT, AUTH_PATTERNS and RELOGIN stay module-private, as in the spike.
    expect(Object.keys(adaptersModule)).not.toContain('PROBE_PROMPT');
  });

  test('mock.ts exports exactly one', () => {
    expect(Object.keys(mockModule)).toStrictEqual(['mockAdapter']);
    // Adding a counter reset for tests would be a behaviour change (charter §2, AC-10, OQ-8).
    expect(Object.keys(mockModule)).not.toContain('resetMockCalls');
  });

  test('the folder is eight files, and none of them is a barrel', () => {
    // A `toStrictEqual` over the sorted array, and it stays one: relaxed to `toContain`, to a
    // length, to a filter or to a regex, a ninth file arrives unnoticed forever (Q-0047 AC-2).
    expect(moduleSources().map(([name]) => name)).toStrictEqual(FOLDER);
    expect(FOLDER).not.toContain('adapters/index.ts');
  });

  test('and the assertion above can fire — a ninth file in a fixture tree fails it', () => {
    // The guard is only worth its line if it is shown catching the thing it exists to catch, over
    // genuine sources rather than over a contrivance: the eight files are copied verbatim.
    const root = tempDir('adapters-ninth-');
    for (const [name, text] of moduleSources()) write(path.join(root, name), text);
    write(path.join(root, 'adapters/gemini.ts'), 'export const geminiAdapter = (): void => undefined;\n');

    const ninth = coreSourceFiles(root).filter(([name]) => name.startsWith('adapters/')).map(([name]) => name);
    expect(ninth).toHaveLength(FOLDER.length + 1);
    expect(() => expect(ninth).toStrictEqual(FOLDER)).toThrow();
  });

  test('packages/core/src/index.ts is untouched, so Q-0041\'s byte pin stays green', () => {
    expect(repoFile('packages/core/src/index.ts')).toBe("export const name = '@quorum/core';\n");
  });

  test('this ticket adds no dependency: core declares the same four it already had', () => {
    // The literals ARE the criterion — this module reaches for node builtins and `@quorum/shared`
    // and nothing else. A later child that genuinely needs a fifth dependency changes this line in
    // the same landing, which is the point of a pin rather than a defect in one.
    const pkg = JSON.parse(repoFile('packages/core/package.json')) as { dependencies: Record<string, string> };
    expect(pkg.dependencies).toStrictEqual({
      '@quorum/shared': 'workspace:*',
      ajv: '^8.20.0',
      'ajv-formats': '^3.0.1',
      yaml: '^2.9.0',
    });
  });

  test('it imports node builtins, shared and its own siblings — never the spike', () => {
    // Deliberately about SPECIFIERS: this package cites spike paths in comments as its evidence,
    // which is the house style, and a check that forbade the word would forbid the citations.
    // `node:child_process` joined the list with Q-0047: `exec.ts` cannot spawn a CLI without it,
    // and it is the only file in the folder that may reach for it — asserted just below.
    const allowed = ['node:child_process', 'node:fs', 'node:os', 'node:path', '@quorum/shared'];
    for (const [name, text] of moduleSources()) {
      for (const specifier of importsOf(text)) {
        expect(allowed.includes(specifier) || /^\.\/[a-z-]+\.js$/.test(specifier), `${name} imports ${specifier}`).toBe(true);
      }
      for (const line of text.split('\n').filter((l) => /^\s*(import|export)\b/.test(l) || l.includes('require('))) {
        expect(line.includes('spike'), `${name} must not reach into the spike: ${line}`).toBe(false);
      }
    }
  });

  test('one file spawns a process, and it is exec.ts', () => {
    for (const [name, text] of moduleSources()) {
      const isTheOnePlace = name === EXEC_SOURCE;
      for (const needle of ['node:child_process', 'spawn(']) {
        expect(text.includes(needle), `${name} ${isTheOnePlace ? 'must' : 'must not'} contain ${needle}`).toBe(isTheOnePlace);
      }
    }
  });

  test('nothing in the folder prints', () => {
    // Charter §7 puts event rendering in the CLI's residual scope. The mock's `stdout` line looks
    // like an exception and is not one: it is an event PAYLOAD handed to `onEvent`, never written
    // to a stream, which is exactly the distinction this pins.
    for (const [name, text] of moduleSources()) {
      for (const forbidden of ['console.', '\\x1b', '\\u001b', '', '✓', '✗']) {
        expect(text.includes(forbidden), `${name} must not contain ${JSON.stringify(forbidden)}`).toBe(false);
      }
    }
  });

  test('strict TypeScript: no `any` and no suppressed diagnostic', () => {
    for (const [name, text] of moduleSources()) {
      for (const forbidden of [': any', '<any>', 'as any', '@ts-ignore', '@ts-expect-error']) {
        expect(text.includes(forbidden), `${name} must not contain ${forbidden}`).toBe(false);
      }
    }
  });
});

describe('AC-2 — the vocabularies come from shared, and the contract documents itself', () => {
  test('the contract layer imports shared rather than restating it', () => {
    expect(sourceOf(ADAPTERS_SOURCE)).toContain("from '@quorum/shared'");
  });

  test('the five measures are never re-spelled here', () => {
    // `USAGE_MEASURES` exists because the spike declares the list twice, which is how a roll-up
    // drifts. Reading `usage.cost_usd` is not a second spelling; writing `'cost_usd'` is.
    const text = sourceOf(ADAPTERS_SOURCE);
    expect(text).toContain('USAGE_MEASURES');
    for (const measure of USAGE_MEASURES) {
      expect(text.includes(`'${measure}'`), `adapters.ts re-spells ${measure} as a literal`).toBe(false);
    }
  });

  test('the event type is imported, not declared a second time', () => {
    const text = sourceOf(ADAPTERS_SOURCE);
    expect(text).toContain('AdapterEvent');
    expect(text.includes("type: 'spawn'"), 'the union belongs to shared, not here').toBe(false);
  });

  test('every exported symbol carries a JSDoc block', () => {
    for (const [name, text] of moduleSources()) {
      const lines = text.split('\n');
      lines.forEach((line, index) => {
        if (!/^export\b/.test(line)) return;
        let previous = index - 1;
        while (previous >= 0 && lines[previous].trim() === '') previous -= 1;
        // A block closes with `*/` whether it spans one line or twenty.
        expect(lines[previous]?.trim().endsWith('*/'), `${name}:${index + 1} ${line} has no JSDoc block above it`).toBe(true);
      });
    }
  });
});

describe('AC-7 — the four validations stay four', () => {
  test('nothing here reaches for zod, for ajv, or for the contracts module', () => {
    // The module NAMES all three in its comments to say what it is deliberately not; what is
    // forbidden is importing one (register row 13; packages/shared/src/step-output.ts:1-26).
    for (const [name, text] of moduleSources()) {
      for (const specifier of importsOf(text)) {
        for (const forbidden of ['zod', 'ajv', 'contracts']) {
          expect(specifier.includes(forbidden), `${name} imports ${specifier}`).toBe(false);
        }
        expect(specifier.startsWith('../'), `${name} imports ${specifier} from outside its folder`).toBe(false);
      }
    }
  });

  test('and it validates through no schema object of its own', () => {
    for (const [name, text] of moduleSources()) {
      for (const forbidden of ['z.object(', 'safeParse(', 'new Ajv']) {
        expect(text.includes(forbidden), `${name} must not contain ${forbidden}`).toBe(false);
      }
    }
  });
});
