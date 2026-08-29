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

/**
 * Every `export` whose preceding non-blank line does not close a JSDoc block, as `file:export …`.
 *
 * `export {` and `export type {` re-export a symbol documented where it is declared, and are the
 * one form excluded; everything else — function, const, class, interface, type alias — is a
 * declaration this folder owns and must document.
 */
function undocumentedExports(files: ReadonlyArray<readonly [string, string]>): string[] {
  const undocumented: string[] = [];
  for (const [name, text] of files) {
    const lines = text.split('\n');
    lines.forEach((line, index) => {
      if (!/^export (?:declare )?(?:async )?(?:function|const|class|interface|type|enum) /.test(line)) return;
      const previous = lines.slice(0, index).reverse().find((candidate) => candidate.trim() !== '');
      if (previous?.trim().endsWith('*/') !== true) undocumented.push(`${name}:${line.split('(')[0]!.trim()}`);
    });
  }
  return undocumented;
}

describe('Q-0050 AC-1/AC-5e/AC-13c — module boundary', () => {
  test('the owned folder is exactly six documented modules with the contracted exports', () => {
    expect(production).toStrictEqual(['channel.ts', 'engine.ts', 'lifecycle.ts', 'loaders.ts', 'routing.ts', 'types.ts']);
    expect(source('engine.ts')).toMatch(/export function runFlow/);
  });

  test('AC-1d — every export carries its own JSDoc, anchored on the export and not on the file', () => {
    // Anchored per export. The check used to be one `/\/\*\*[\s\S]*?export /` per FILE, which a
    // module header plus any one export satisfies whatever the other exports look like — it was
    // green over `createEventChannel`, which had none, and would have stayed green for every file
    // Q-0051 to Q-0053 add to this folder.
    expect(undocumentedExports(production.map((name) => [name, source(name)] as const))).toStrictEqual([]);
  });

  test('AC-1d — the anchored check fails over an export whose JSDoc is missing', () => {
    // Demonstrated failing before it is trusted, over the real violation it was green on:
    // `channel.ts`'s one export, rebuilt here by removing the block above it.
    const stripped = source('channel.ts').replace(/\/\*\*(?:(?!\*\/)[\s\S])*?\*\/\n(?=export function createEventChannel)/, '');
    expect(stripped).not.toBe(source('channel.ts'));
    expect(undocumentedExports([['channel.ts', stripped]])).toStrictEqual(['channel.ts:export function createEventChannel']);
  });

  test('engine code prints nothing, exits nowhere, installs no signals and imports no spike', () => {
    const all = production.map(source).join('\n');
    // Every way to subscribe, not the two names AC-5 happened to spell: `addListener`,
    // `prependListener` and `prependOnceListener` are the same subscription and passed the
    // narrower alternation. The rule — a library that exits the process cannot host M3's daemon —
    // governs every file Q-0051 to Q-0053 will add here, so it is widened while the folder is six.
    expect(all).not.toMatch(/console\.|process\.(stdout|stderr|exit|on|once|addListener|prependListener|prependOnceListener)\b|\u001b\[/);
    expect(all).not.toMatch(/from ['"][^'"]*spike\//);
  });

  test('engine.ts reaches the occurrence-event mutation through lifecycle.ts, never beside it', () => {
    // What makes lifecycle.test.ts's composed-path test a statement about the shipped wiring: the
    // capability delegates, so exactly one layer appends the history entry and the log line.
    const engineSource = source('engine.ts');
    expect(engineSource).toMatch(/recordOccurrenceEvent: \([^)]*\) => recordEvent\(context, stage, event, cost\)/);
    expect(engineSource).not.toMatch(/recordOccurrenceEvent: \([^)]*\) => \{/);
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
