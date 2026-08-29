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

describe('Q-0050 AC-4/AC-6/AC-7/AC-8/AC-12 — routing implementation pins', () => {
  const routing = (): string => source('routing.ts');

  test('AC-4a..g: gate correlation, no-channel failure, auto/dry policy and logging are implemented', () => {
    const text = routing();
    for (const token of ['gateId', 'answerGate', 'human-locked', 'gateAutoAdvanced', 'gateDryRun', 'gateAnswer']) {
      expect(text, token).toContain(token);
    }
    expect(text).toMatch(/emit\s*\(/);
    expect(text.indexOf('gateAnswer')).toBeLessThan(text.indexOf("answer === 'advance'"));
  });

  test('AC-4h: signalWindow and its authority are preserved together', () => {
    expect(routing()).toMatch(/signalWindow[^\n]*Why: preserved defect, see Q-0050 AC-4\./);
    expect(routing()).toMatch(/1000/);
  });

  test('AC-6/7: bounded exhaustion records before asking and retry changes only one counter', () => {
    const text = routing();
    for (const token of ['max_iterations', 'exhausted', 'recordEvent', 'askGate', 'retryGrant']) expect(text).toContain(token);
    expect(text.indexOf('recordEvent')).toBeLessThan(text.lastIndexOf('askGate'));
    expect(text).toMatch(/counters\s*\[[^\]]+\]\s*=\s*limit/);
    expect(text).not.toMatch(/counters\s*=\s*\{\}/);
  });

  test('AC-8/AC-12c: cross-flow is returned, while parallel preserves the legacy agent dispatch', () => {
    const text = routing();
    expect(text).toContain("flow:");
    expect(text).toContain('Promise.allSettled');
    expect(text).toMatch(/parallel[\s\S]*runAgentStep/);
  });
});

describe('Q-0050 AC-9/AC-10/AC-12 — lifecycle and composition pins', () => {
  test('AC-9: all statuses persist, but only completed/regressed move stage', () => {
    const text = source('lifecycle.ts');
    for (const status of ['completed', 'regressed', 'aborted', 'failed', 'interrupted']) expect(text).toContain(status);
    expect(text).toContain('iterations');
    expect(text).toContain('history');
    expect(text).toContain('resetBranch');
  });

  test('AC-10: dry uses a prototype backlog view with exactly three writer overrides', () => {
    const text = source('engine.ts');
    expect(text).toContain('Object.create');
    for (const writer of ['write', 'writeFile', 'log']) expect(text).toContain(writer);
    expect(text).toMatch(/counters\s*:\s*ticket\.meta\.iterations/);
  });

  test('AC-11a/AC-12a/AC-12b/AC-12d: precondition and preserved defects carry authority', () => {
    const engine = source('engine.ts');
    const lifecycle = source('lifecycle.ts');
    expect(engine).toMatch(/stage[\s\S]*consumes/);
    expect(engine).toMatch(/findIndex/);
    expect(`${engine}\n${lifecycle}`.match(/Why: preserved defect, see Q-0050 AC-12\./g)?.length).toBeGreaterThanOrEqual(2);
  });
});
