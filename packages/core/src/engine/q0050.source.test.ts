import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, test } from 'vitest';

const folder = path.dirname(new URL(import.meta.url).pathname);
const source = (name: string): string => fs.readFileSync(path.join(folder, name), 'utf8');

describe('Q-0050 AC-1/AC-5e/AC-13c — module boundary', () => {
  test('the owned folder is exactly six documented modules with the contracted exports', () => {
    const production = fs.readdirSync(folder).filter((name) => name.endsWith('.ts') && !name.includes('.test.')).sort();
    expect(production).toStrictEqual(['channel.ts', 'engine.ts', 'lifecycle.ts', 'loaders.ts', 'routing.ts', 'types.ts']);
    expect(source('engine.ts')).toMatch(/export function runFlow/);
    for (const name of production) expect(source(name), name).toMatch(/\/\*\*[\s\S]*?export /);
  });

  test('engine code prints nothing, exits nowhere, installs no signals and imports no spike', () => {
    const all = fs.readdirSync(folder).filter((name) => name.endsWith('.ts') && !name.includes('.test.'))
      .map(source).join('\n');
    expect(all).not.toMatch(/console\.|process\.(stdout|stderr|exit|on|once)|\u001b\[/);
    expect(all).not.toMatch(/from ['"][^'"]*spike\//);
  });

  test('shared remains below core in the dependency graph', () => {
    const shared = fs.readFileSync(path.resolve(folder, '../../../shared/src/events.ts'), 'utf8');
    expect(shared).not.toMatch(/@quorum\/core|packages\/core/);
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
    expect(`${engine}\n${lifecycle}`.match(/Why: preserved defect, see Q-0050 AC-12\./g)?.length).toBeGreaterThanOrEqual(2);
  });
});
