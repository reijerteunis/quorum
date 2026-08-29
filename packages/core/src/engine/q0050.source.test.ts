import { describe, expect, test } from 'vitest';

import { coreSourceFiles, repoFile } from '../../test/corpus.js';

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

/**
 * Every sentence of forty characters or more in `text`, with soft wrapping undone first.
 *
 * Paragraphs are unwrapped before sentences are split, because the corpus is markdown wrapped at
 * about a hundred columns and splitting on `\n` shreds a sentence into fragments that then fall
 * under the floor. Line fragments are kept alongside the sentences so a single copied line is
 * caught as well as a copied sentence.
 */
function corpusOf(text: string): string[] {
  const paragraphs = text.split(/\n\s*\n/).map((p) => p.replace(/\s*\n\s*/g, ' ').trim());
  const sentences = paragraphs.flatMap((p) => p.split(/(?<=[.!?])\s+/));
  const lines = text.split('\n');
  return [...new Set([...sentences, ...lines].map((t) => t.trim().replace(/\s+/g, ' ')).filter((t) => t.length >= 40))];
}

/** The first corpus sentence a comment line reproduces verbatim, or `undefined`. */
function transcribedIn(line: string, sentences: readonly string[]): string | undefined {
  const text = line.replace(/^\s*(?:\/\/|\*|\/\*\*)\s*/, '').trim().replace(/\s+/g, ' ');
  return sentences.find((sentence) => text.includes(sentence));
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

  test('AC-13d: every preserved defect is a registered site, and none transcribes a document', () => {
    // A register of identities, not a count. Q-0073's lesson — a floor passes while a site is
    // swapped out, so the register names WHICH file carries WHICH authority and pins the
    // arithmetic. A new preserved defect fails here until it is entered, and a deleted one fails
    // here too, which a `toBeGreaterThanOrEqual` cannot do in either direction.
    // EVERY `Why: preserved …` marker, not only those saying "defect". Three escaped a defect-only
    // scan — two `preserved behaviour`/`behavior`, spelled differently from each other, and one
    // `preserved design` belonging to Q-0034 — so a register pinning seven read as complete beside
    // three sites it could not see. Q-0070's lesson: a scan that cannot see the surface it bounds
    // is worse than no scan.
    const REGISTERED: Record<string, readonly string[]> = {
      'engine.ts': ['design/Q-0034', 'defect/AC-10.', 'defect/AC-12.', 'behaviour/-', 'defect/AC-12d'],
      'lifecycle.ts': ['defect/AC-10.', 'defect/AC-12.'],
      'routing.ts': ['defect/AC-4.', 'defect/AC-12.', 'behavior/-'],
    };
    const found: Record<string, string[]> = {};
    for (const name of production) {
      const hits = [...source(name).matchAll(/Why: preserved (\w+)(?:, see (?:Q-0050 )?(AC-\d+[a-z]?\.?|Q-\d+))?/g)]
        .map((m) => `${m[1]!}/${m[2] ?? '-'}`);
      if (hits.length > 0) found[name] = hits;
    }
    expect(found).toStrictEqual(REGISTERED);
    // Ten markers, of which SEVEN are this ticket's own preserved defects — exactly AC-13d's own
    // enumeration (AC-4h, AC-10c, AC-10f, AC-12a/b/c/d). Its prose says "eight"; the prose is wrong
    // and its list is right, ruled in solution/errata.md E-20.
    expect(Object.values(found).flat()).toHaveLength(10);
    expect(Object.values(found).flat().filter((m) => m.startsWith('defect/'))).toHaveLength(7);
  });

  test('AC-13d: no authority line reproduces a sentence from the decisions index or the ticket body', () => {
    // Round 5, codex: the first version of this scan split on every newline as well as on terminal
    // punctuation. The corpus files are soft-wrapped markdown, so a sentence spanning two lines was
    // shredded into fragments and the fragments under the 40-character floor were then dropped
    // entirely — measured at the time: 195 corpus entries, of which only 7 were whole sentences,
    // and 65 of 72 real sentences invisible. The scan written to close a fake-coverage finding was
    // itself ~90% blind. Paragraphs are now unwrapped before sentences are split, and the line
    // fragments are kept alongside them so a single copied line is caught too.
    const documents = [
      repoFile('docs/DECISIONS.md'),
      repoFile('backlog/Q-0050-core-engine-run-loop/ticket.md'),
    ].join('\n');
    const sentences = corpusOf(documents);
    expect(sentences.length, 'the scan needs a non-empty corpus, or it reports success over nothing').toBeGreaterThan(60);

    for (const name of production) {
      for (const line of source(name).split('\n')) {
        if (!/Why: preserved/.test(line)) continue;
        const transcribed = transcribedIn(line, sentences);
        expect(transcribed, `${name}: authority line transcribes "${String(transcribed).slice(0, 60)}…"`).toBeUndefined();
      }
    }
  });

  test('AC-13d: the scan catches a sentence that was soft-wrapped in its source', () => {
    // The fixture codex asked for, and the case the first version could not see. The sentence is
    // taken from the real corpus AS IT IS WRAPPED THERE — across two lines — and pasted onto an
    // authority line as one line, which is exactly what transcribing looks like.
    const documents = repoFile('docs/DECISIONS.md');
    const sentences = corpusOf(documents);
    // The discriminating property: a sentence that does NOT appear verbatim in the raw file. It
    // exists only because the paragraph was unwrapped — in the source its words are separated by a
    // newline and indentation, in the corpus by a single space. The first version of this fixture
    // looked for "a sentence followed by a newline", which every whole LINE also satisfies, so it
    // passed against the very builder it was written to rule out. Checked below.
    const multiLine = sentences.find((sentence) => sentence.length >= 60 && !documents.includes(sentence));
    expect(multiLine, 'the corpus must contain a sentence that is soft-wrapped in the source').toBeDefined();
    expect(documents.includes(multiLine!), 'the fixture sentence must be absent from the raw text').toBe(false);

    expect(transcribedIn(`  // Why: preserved defect, see Q-0050 AC-1. ${multiLine!}`, sentences)).toBe(multiLine);
    expect(transcribedIn('  // Why: preserved defect, see Q-0050 AC-1.', sentences)).toBeUndefined();
  });
});
