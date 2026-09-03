// Q-0049: the criteria that are properties of the code rather than of its behaviour.
//
// "The reader never writes", "the reader does not import the writer" and "no money string can
// originate here" cannot be observed at run time, and each is exactly what a later module breaks
// silently — which is the whole reason this module lands as three files rather than as one.
import { describe, expect, test } from 'vitest';

import * as manifestModule from './manifest.js';
import * as readerModule from './reader.js';
import * as writerModule from './writer.js';
import * as barrel from '../index.js';
import { coreSourceFiles, repoFile } from '../../test/corpus.js';

/** Corpus keys are whole paths below `src`, so a same-named file elsewhere never answers for these. */
const MANIFEST_SOURCE = 'run-history/manifest.ts';
const READER_SOURCE = 'run-history/reader.ts';
const WRITER_SOURCE = 'run-history/writer.ts';

/** Every non-test source this ticket added — the corpus's own view of the module's folder. */
const moduleSources = (): [string, string][] => {
  const files = coreSourceFiles().filter(([name]) => name.startsWith('run-history/'));
  if (!files.length) throw new Error('corpus missing: packages/core/src/run-history/ holds no source file');
  return files;
};

const sourceOf = (key: string): string => {
  const found = moduleSources().find(([name]) => name === key);
  if (!found) throw new Error(`corpus missing: packages/core/src/${key} does not exist`);
  return found[1];
};

/** Every module specifier a file imports from, in source order. */
const importsOf = (text: string): string[] => [...text.matchAll(/from\s+'([^']+)'/g)].map((m) => m[1]);

/**
 * The run-history namespace written as a value rather than named in prose.
 *
 * Whitespace between the quote and the word disqualifies it: an apostrophe elsewhere in an English
 * sentence would otherwise open a "string" that runs up to a backticked citation of the same word,
 * which is how `fanout/fanout.ts` — whose comment says it writes nothing there — was first reported.
 */
const QUOTED_ROOT = /['"][^'"\n\s]*\.quorum/;

/** Every name a file exports, whatever kind of declaration it is — types included. */
const exportsOf = (text: string): string[] =>
  [...text.matchAll(/^export\s+(?:async\s+)?(?:const|let|var|function|class|type|interface)\s+([A-Za-z_$][\w$]*)/gm)]
    .map((m) => m[1]);

describe('AC-1 — three files, the exact surface, no dependency, and nothing narrated', () => {
  test('the folder is exactly the three files the port assigns it', () => {
    expect(moduleSources().map(([name]) => name)).toStrictEqual([MANIFEST_SOURCE, READER_SOURCE, WRITER_SOURCE]);
  });

  test('manifest.ts holds the eight types and the four pure functions, and nothing else', () => {
    expect(exportsOf(sourceOf(MANIFEST_SOURCE)).sort()).toStrictEqual([
      'ErrorCategory', 'Occurrence', 'OccurrenceKind', 'OccurrenceUsage', 'RunError', 'RunManifest',
      'RunStatus', 'VendorRollup', 'countUsage', 'errorOf', 'normaliseUsage', 'rollup',
    ]);
    // Types are erased, so the runtime surface is the four functions and no fifth.
    expect(Object.keys(manifestModule).sort()).toStrictEqual(['countUsage', 'errorOf', 'normaliseUsage', 'rollup']);
    for (const value of Object.values(manifestModule)) expect(typeof value).toBe('function');
  });

  test('writer.ts holds the two functions and the four types its signatures name', () => {
    expect(exportsOf(sourceOf(WRITER_SOURCE)).sort()).toStrictEqual([
      'OccurrenceFields', 'RunHistory', 'RunHistoryHost', 'RunStart', 'initialiseRunHistory', 'nextRunId',
    ]);
    expect(Object.keys(writerModule).sort()).toStrictEqual(['initialiseRunHistory', 'nextRunId']);
  });

  test('reader.ts holds the nine names it is assigned, and the three shapes it answers with', () => {
    expect(exportsOf(sourceOf(READER_SOURCE)).sort()).toStrictEqual([
      'RunEntry', 'RunRead', 'RunWarning', 'TICKET_ID_PATTERN', 'isIncomplete', 'manifestShapeError',
      'occurrenceSeq', 'readRun', 'readRunsDir', 'resolveRunDirectory', 'sortRuns', 'vendorTokenTotal',
    ]);
    expect(Object.keys(readerModule).sort()).toStrictEqual([
      'TICKET_ID_PATTERN', 'isIncomplete', 'manifestShapeError', 'occurrenceSeq', 'readRun',
      'readRunsDir', 'resolveRunDirectory', 'sortRuns', 'vendorTokenTotal',
    ]);
  });

  test('Q-0092 AC-3 — both spellings moved, and each is refused at the value it replaced', () => {
    // The identity above is pinned twice, once over the source text and once over the module's own
    // keys, and both are shown red against the eight-value list they held before this ticket rather
    // than edited to fit. `readRun` is the single-run read a detail request goes through, and
    // `RunRead` is the discriminated result it answers with — a type, so it adds no runtime key.
    expect(Object.keys(readerModule).sort(), 'the runtime surface still holds the eight it held before Q-0092')
      .not.toStrictEqual([
        'TICKET_ID_PATTERN', 'isIncomplete', 'manifestShapeError', 'occurrenceSeq', 'readRunsDir',
        'resolveRunDirectory', 'sortRuns', 'vendorTokenTotal',
      ]);
    expect(Object.keys(readerModule), 'a type export must add no runtime key').not.toContain('RunRead');
    expect(exportsOf(sourceOf(READER_SOURCE))).toContain('RunRead');
    expect(typeof readerModule.readRun).toBe('function');
  });

  test('the reader does not import the writer, so history can be read without linking a writer', () => {
    expect(importsOf(sourceOf(READER_SOURCE))).not.toContain('./writer.js');
    expect(importsOf(sourceOf(READER_SOURCE)).some((specifier) => specifier.includes('writer'))).toBe(false);
    // manifest.ts exists to make that possible: the types both files need live in neither of them.
    expect(importsOf(sourceOf(READER_SOURCE))).toContain('./manifest.js');
    expect(importsOf(sourceOf(WRITER_SOURCE))).toContain('./manifest.js');
  });

  test('the folder imports node builtins, shared and four siblings — and never the spike', () => {
    /** Specifiers a file may name exactly. */
    const EXACT = ['node:fs', 'node:path', '@quorum/shared', './manifest.js'];
    /**
     * And the siblings, matched by their tail rather than written as `../x/x.js` — a literal that
     * climbs out of its own package is a shape `turbo-inputs.test.ts` holds a register entry for,
     * and this list buys the same assertion without one. A specifier that resolves nowhere is
     * `tsc --noEmit`'s to refuse, not this test's.
     */
    const SIBLINGS = ['/adapters/adapters.js', '/backlog/backlog.js', '/git/git.js', '/lint/lint.js'];
    for (const [name, text] of moduleSources()) {
      for (const specifier of importsOf(text)) {
        const allowed = EXACT.includes(specifier) || SIBLINGS.some((sibling) => specifier.endsWith(sibling));
        expect(allowed, `${name} imports ${specifier}`).toBe(true);
      }
      for (const line of text.split('\n').filter((l) => /^\s*(import|export)\b/.test(l) || l.includes('require('))) {
        expect(line.includes('spike'), `${name} must not reach into the spike: ${line}`).toBe(false);
      }
    }
  });

  test('nothing in the folder narrates, exits, or handles a signal', () => {
    for (const [name, text] of moduleSources()) {
      for (const forbidden of ['console.', 'process.stdout', 'process.stderr', 'process.exit', 'process.on', 'SIGINT', 'SIGTERM', '\\x1b', '\\u001b', '']) {
        expect(text.includes(forbidden), `${name} must not contain ${JSON.stringify(forbidden)}`).toBe(false);
      }
    }
  });

  test('and no vendor is named in it, in any case — identity arrives as data', () => {
    // Vendor identity reaches this module through `usage.vendor` and through `errorOf`'s
    // `adapterName` parameter, and through nothing else. A citation in a comment breaks it too,
    // which is deliberate: "nothing downstream may learn which vendor produced an event". It is also
    // what makes "no rate table ships" structural rather than observed — a rate table is keyed by
    // vendor, and there is no vendor here to key one by.
    for (const [name, text] of moduleSources()) {
      for (const vendor of ['claude', 'codex', 'anthropic', 'openai', 'gemini']) {
        expect(new RegExp(vendor, 'i').test(text), `${name} names ${vendor}`).toBe(false);
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

  test('every exported symbol is immediately preceded by a JSDoc block', () => {
    for (const [name, text] of moduleSources()) {
      const lines = text.split('\n');
      lines.forEach((line, i) => {
        if (!line.startsWith('export ')) return;
        expect(lines[i - 1]?.trim().endsWith('*/'), `${name}:${i + 1} — ${line.slice(0, 48)} has no JSDoc`).toBe(true);
      });
    }
  });

  test('so is every field of an exported interface', () => {
    // AC-1 asks for JSDoc on "every exported symbol, interface field and non-obvious parameter", and
    // the assertion above reads `export` lines only — a field is not one. The declared type surface
    // is what a consumer of this module reads, so it is checked at the same grain as the exports.
    const fields: string[] = [];
    for (const [name, text] of moduleSources()) {
      const lines = text.split('\n');
      let open = false;
      lines.forEach((line, i) => {
        if (/^export interface \w+/.test(line)) { open = true; return; }
        if (open && line === '}') { open = false; return; }
        if (!open || !/^ {2}(?:readonly )?[A-Za-z_$][\w$]*\??[(:]/.test(line)) return;
        fields.push(`${name}:${i + 1}`);
        expect(lines[i - 1]?.trim().endsWith('*/'), `${name}:${i + 1} — ${line.trim()} has no JSDoc`).toBe(true);
      });
    }
    // The walk itself is the fragile part: an interface it failed to enter would assert nothing and
    // still report green. Fifty-six across eleven interfaces — RunError 2, OccurrenceUsage 1,
    // VendorRollup 3, Occurrence 15 and RunManifest 13 in manifest.ts; RunStart 5, RunHistoryHost 1,
    // OccurrenceFields 5 and RunHistory 6 in writer.ts; RunEntry 3 and RunWarning 2 in reader.ts.
    expect(fields.length).toBe(56);
  });

  test('the barrel re-exports exactly the six readers a command needs (Q-0092 AC-4)', () => {
    // Until Q-0096 this pinned `packages/core/src/index.ts` byte for byte; from Q-0096 to Q-0092 it
    // asserted that the folder was absent from the barrel altogether, with its own comment saying
    // *"the six readers are Q-0092's to present, and it imports them when it lands"*. This is that
    // sentence arriving. An identity rather than a `toContain`, so a seventh name is a visible act.
    expect([...Object.keys(manifestModule), ...Object.keys(readerModule), ...Object.keys(writerModule)]
      .filter((symbol) => symbol in barrel).sort()).toStrictEqual([
      'isIncomplete', 'occurrenceSeq', 'readRun', 'readRunsDir', 'sortRuns', 'vendorTokenTotal',
    ]);
  });

  test('and the writer is still absent from it in full, which is what the split was for', () => {
    // The half that stops the identity above from being read as "the folder is public now".
    // `initialiseRunHistory` and `nextRunId` are the only two ways to create a directory under
    // `.quorum/`, and a CLI presenting run history has no business reaching either.
    expect(Object.keys(writerModule).filter((symbol) => symbol in barrel)).toStrictEqual([]);
    expect(Object.keys(writerModule).length, 'the writer exports nothing — this proves nothing').toBeGreaterThan(1);
    // And the three reader names no command needs stay off it, for the reason the barrel's own
    // comment gives: a name is added because a command needs it.
    for (const withheld of ['manifestShapeError', 'resolveRunDirectory', 'TICKET_ID_PATTERN']) {
      expect(withheld in barrel, `${withheld} is public and no command calls it`).toBe(false);
      expect(Object.keys(readerModule), `${withheld} is not this module's`).toContain(withheld);
    }
  });

  test('core declares no new dependency', () => {
    const pkg = JSON.parse(repoFile('packages/core/package.json')) as { dependencies: Record<string, string> };
    expect(Object.keys(pkg.dependencies).sort()).toStrictEqual(['@quorum/shared', 'ajv', 'ajv-formats', 'yaml']);
  });
});

describe('AC-3 — the persisted vocabulary comes from shared, and no literal is re-spelled', () => {
  test('the five file and directory names are imported, never written out again', () => {
    for (const [name, text] of moduleSources()) {
      for (const literal of ["'manifest.json'", "'prompt.txt'", "'output.txt'", "'steps/'", 'padStart(3']) {
        expect(text.includes(literal), `${name} re-spells ${literal}`).toBe(false);
      }
    }
    const writer = sourceOf(WRITER_SOURCE);
    for (const constant of ['MANIFEST_FILE', 'OCCURRENCE_DIR', 'OUTPUT_FILE', 'RUNS_LOG_FILE', 'RUN_HISTORY_ROOT', 'occurrenceDirName', 'runIdOf']) {
      expect(writer, `writer.ts takes ${constant} from shared`).toContain(constant);
    }
    // `prompt.txt` has no site here at all: the artifact's name is the caller's argument, so
    // importing the constant would be an unused import rather than a use of it.
    expect(writer.includes('PROMPT_FILE'), 'the writer never names an artifact — its callers do').toBe(false);
    for (const constant of ['MANIFEST_FILE', 'OCCURRENCE_DIR']) {
      expect(sourceOf(READER_SOURCE), `reader.ts takes ${constant} from shared`).toContain(constant);
    }
  });

  test('`.quorum` is a string literal in exactly one place: the exclusion pattern', () => {
    // Quoted occurrences only. The root itself comes from `RUN_HISTORY_ROOT`, and the pattern below
    // has no constant in `shared` and does not acquire one here — it is the one place the namespace
    // is spelled, and both files name it in prose, which is a citation rather than a path.
    const quoted = moduleSources().flatMap(([name, text]) =>
      [...text.matchAll(new RegExp(QUOTED_ROOT, 'g'))].map((match) => `${name}: ${match[0]}`));
    expect(quoted).toStrictEqual([`${WRITER_SOURCE}: '.quorum`]);
    expect(sourceOf(WRITER_SOURCE)).toContain("ensureExcluded(repoDir, '.quorum/')");
  });

  test('and the five usage measures are taken from shared rather than spelled a third time', () => {
    // The constant exists because the spike spells them twice and a roll-up drifts on the second
    // copy. Neither cache measure is written out anywhere in this module — not in the types, which
    // are mapped over `USAGE_MEASURES`, and not in the arithmetic, which iterates it.
    const text = sourceOf(MANIFEST_SOURCE);
    expect(text).toContain('USAGE_MEASURES');
    for (const measure of ['cached_input_tokens', 'cache_write_input_tokens']) {
      expect([...text.matchAll(new RegExp(measure, 'g'))], measure).toHaveLength(0);
    }
  });
});

describe('AC-7 — no money can originate here, and the roll-up has no second implementation to agree with', () => {
  test('the folder holds no money formatter, no currency and no rate table', () => {
    // The structural form of "roll-ups never invent money": a `$0.000` cannot come from here because
    // no code path produces a money string at all. Row 3's rendering clause is the command line's
    // until Q-0010, and its absence from `core` is correct rather than an omission.
    for (const [name, text] of moduleSources()) {
      for (const forbidden of ['toFixed', "'$'", "'n/a'", "'cost='", 'toLocaleString', 'Intl.NumberFormat']) {
        expect(text.includes(forbidden), `${name} must not contain ${forbidden}`).toBe(false);
      }
    }
  });

  test('and neither implementation of the roll-up imports the other', () => {
    // Two independent implementations disagreeing is the whole signal AC-12 depends on; one
    // implementation compared against itself detects a hand-edited file and nothing else.
    for (const [name, text] of moduleSources()) {
      for (const specifier of importsOf(text)) {
        expect(specifier.includes('contracts'), `${name} imports ${specifier}`).toBe(false);
      }
    }
    const pass = repoFile('packages/core/src/contracts/run-manifest.ts');
    for (const specifier of importsOf(pass)) {
      expect(specifier.includes('run-history'), `run-manifest.ts imports ${specifier}`).toBe(false);
    }
    expect(pass, 'and it says so, so the next reader does not have to derive it').toContain('run-history');
  });
});

describe('AC-10 — the reader writes nothing, and it is a property of the file', () => {
  test('no filesystem write API is called in reader.ts, in any form', () => {
    const text = sourceOf(READER_SOURCE);
    const writes = [...text.matchAll(/\b(writeFile|mkdir|mkdtemp|rename|rm|rmdir|unlink|appendFile|copyFile|cp|truncate|open|chmod|symlink|link|utimes|watch)(Sync)?\s*\(/g)]
      .map((m) => m[0]);
    expect(writes).toStrictEqual([]);
    // And the write side is where it belongs: every one of those verbs the module uses is in the
    // writer, which is what makes the split a rule rather than an intention.
    expect(sourceOf(WRITER_SOURCE)).toContain('fs.writeFileSync(');
  });

  test('the writer is the only file in core that names the run-history root as a value', () => {
    // As a VALUE, not as a word: `fanout/fanout.ts` says in prose that it writes nothing under
    // `.quorum/`, which is the statement this rule makes about the rest of the package, and a check
    // that forbade the word would forbid the statement. Whitespace disqualifies, because an
    // apostrophe in that same sentence otherwise opens a "string" that runs up to the word.
    for (const [name, text] of coreSourceFiles()) {
      const namesIt = QUOTED_ROOT.test(text) || text.includes('RUN_HISTORY_ROOT');
      expect(namesIt, `${name} ${name === WRITER_SOURCE ? 'must' : 'must not'} name the run-history root`)
        .toBe(name === WRITER_SOURCE);
    }
  });
});

describe('AC-13 — the preserved behaviour names its authority on one line', () => {
  test('each deliberately strange thing cites a ticket rather than transcribing its argument', () => {
    // harness/rules.md: one line naming the authority where behaviour is counterintuitive on
    // purpose, and a pointer rather than a copy of the record.
    const citations = moduleSources().flatMap(([, text]) => [...text.matchAll(/Why: [^\n]*Q-00\d\d/g)].map((m) => m[0]));
    expect(citations.length, 'the WeakMap, the unreachable stage guard and the quadratic roll-up each carry one')
      .toBeGreaterThanOrEqual(3);
    for (const [name, text] of moduleSources()) {
      expect(text.includes('Alternatives considered'), `${name} must not transcribe a decision entry`).toBe(false);
    }
  });
});
