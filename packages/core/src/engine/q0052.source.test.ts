import { describe, expect, test } from 'vitest';

import { FINDING_PATTERN } from '@quorum/shared';

import { coreSourceFiles } from '../../test/corpus.js';

/**
 * Q-0052 AC-2c/AC-2d/AC-3c — the two properties the folder's two new files exist to make checkable.
 *
 * `prompt.ts` composes what an adapter is handed and can reach neither an adapter nor the write side
 * of the filesystem, so M3's server can call it to preview a step without the preview being able to
 * perform one. `steps.ts` is the only file here that invokes an adapter at all.
 *
 * Both scans are derived from the folder rather than from a list of names, for the reason Q-0051's
 * own AC-9d fix gives: a hard-coded array fails open the day a tenth file arrives.
 */
const engine = new Map(
  coreSourceFiles()
    .filter(([name]) => name.startsWith('engine/'))
    .map(([name, text]) => [name.slice('engine/'.length), text] as const),
);
const production = [...engine.keys()];
const source = (name: string): string => {
  const text = engine.get(name);
  if (text === undefined) throw new Error(`corpus missing: packages/core/src/engine/${name}`);
  return text;
};

/** Whether `text` invokes an adapter. The call, not the type — an `Adapter` import proves nothing. */
const invokesAdapter = (text: string): boolean => /\badapter\.run\s*\(/.test(text);

/** Whether `text` imports anything at all from the adapters folder, values and types alike. */
const importsAdapters = (text: string): boolean => /\bfrom\s+['"][^'"]*\.\.\/adapters\//.test(text);

/** Whether `text` calls one of the `fs` APIs that create, truncate, extend or remove a file. */
const writesFiles = (text: string): boolean =>
  /\b(?:writeFile|writeFileSync|mkdir|mkdirSync|mkdtemp|mkdtempSync|rm|rmSync|rmdir|rmdirSync|open|openSync|appendFile|appendFileSync)\s*\(/.test(text);

describe('Q-0052 AC-2c — exactly one file in this folder invokes an adapter', () => {
  test('adapter.run( appears in steps.ts and in no other engine module', () => {
    expect(production.filter((name) => invokesAdapter(source(name)))).toStrictEqual(['steps.ts']);
  });

  test('the scan has teeth: it sees the call it forbids', () => {
    // Demonstrated against the violating text before it is trusted over the folder, because a scan
    // that cannot fire reports the property it was written to check over anything at all.
    expect(invokesAdapter('  const result = await adapter.run({ prompt, schema });')).toBe(true);
    expect(invokesAdapter('import type { Adapter } from \'../adapters/adapters.js\';')).toBe(false);
  });
});

describe('Q-0052 AC-2d — prompt.ts can reach neither an adapter nor the filesystem\'s write side', () => {
  test('it imports nothing from ../adapters/, and steps.ts is where that import lives', () => {
    expect(importsAdapters(source('prompt.ts'))).toBe(false);
    // The positive control. Without it the assertion above passes just as well over a folder that
    // imports the adapters nowhere, which would say nothing about prompt.ts.
    expect(importsAdapters(source('steps.ts'))).toBe(true);
  });

  test('it calls no fs write API', () => {
    expect(writesFiles(source('prompt.ts'))).toBe(false);
  });

  test('both scans have teeth: each fires over the text it forbids', () => {
    expect(importsAdapters('import { getAdapter } from \'../adapters/adapters.js\';')).toBe(true);
    expect(importsAdapters('import type { AdapterSchema } from \'../adapters/adapters.js\';')).toBe(true);
    for (const violation of [
      'fs.writeFileSync(file, text);',
      'fs.mkdirSync(dir, { recursive: true });',
      'fs.rmSync(dir, { recursive: true });',
      'const fd = fs.openSync(target, \'w\');',
      'fs.appendFileSync(log, line);',
    ]) expect(writesFiles(violation), violation).toBe(true);
    // …and does not fire over the two reads prompt.ts genuinely performs.
    expect(writesFiles('if (fs.existsSync(file)) parts.push(fs.readFileSync(file, \'utf8\'));')).toBe(false);
  });
});

describe('Q-0052 AC-3c — the finding pattern has one spelling', () => {
  test('prompt.ts imports it and does not carry its text', () => {
    // Compared against the shared constant rather than a literal copy of it, because a literal here
    // would be the second spelling the constant exists to prevent.
    expect(source('prompt.ts')).not.toContain(FINDING_PATTERN);
    expect(source('prompt.ts')).toContain('FINDING_PATTERN');
  });
});
