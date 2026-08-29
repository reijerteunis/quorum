import { describe, expect, test } from 'vitest';

import { coreSourceFiles } from '../../test/corpus.js';

// The corpus already carries every file's text, so the sources are taken from it rather than
// re-read through a templated path. That is not tidiness: a template handed to a read API is an
// indirect route under turbo-inputs.test.ts clause C1, and a route whose paths are computed has to
// be registered before the guard will accept it. Reading what the corpus already collected leaves
// no literal to register and no second way for this file to name a path.
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

describe('Q-0050 AC-1/AC-5e/AC-13c — module boundary', () => {
  test('the owned folder is exactly six documented modules with the contracted exports', () => {
    expect(production).toStrictEqual(['channel.ts', 'engine.ts', 'lifecycle.ts', 'loaders.ts', 'routing.ts', 'types.ts']);
    expect(source('engine.ts')).toMatch(/export function runFlow/);
    for (const name of production) expect(source(name), name).toMatch(/\/\*\*[\s\S]*?export /);
  });

  test('engine code prints nothing, exits nowhere, installs no signals and imports no spike', () => {
    const all = production.map(source).join('\n');
    expect(all).not.toMatch(/console\.|process\.(stdout|stderr|exit|on|once)|\u001b\[/);
    expect(all).not.toMatch(/from ['"][^'"]*spike\//);
  });

  test('core consumes the shared event contract', () => {
    expect(source('types.ts')).toContain("from '@quorum/shared'");
  });
});

describe('Q-0050 AC-4h/AC-9d/AC-12 — authorised source-shape checks', () => {
  const routing = (): string => source('routing.ts');

  test('AC-4h: signalWindow and its authority are preserved together', () => {
    expect(routing()).toMatch(/signalWindow[^\n]*Why: preserved defect, see Q-0050 AC-4\./);
    expect(routing()).toMatch(/1000/);
  });

  test('AC-9d: no engine helper resets or deletes task branches', () => {
    const all = ['channel.ts', 'engine.ts', 'lifecycle.ts', 'loaders.ts', 'routing.ts', 'types.ts'].map(source).join('\n');
    expect(all).not.toMatch(/(?:reset|delete|remove)TaskBranch/i);
  });

  test('AC-12a/b: both owned branch-head conflations carry authority', () => {
    const engine = source('engine.ts');
    const lifecycle = source('lifecycle.ts');
    expect((`${engine}\n${lifecycle}`.match(/Why: preserved defect, see Q-0050 AC-12\./g) ?? []).length).toBeGreaterThanOrEqual(2);
  });
});
