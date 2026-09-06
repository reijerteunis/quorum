/**
 * Q-0100 AC-4 to AC-6 — no sentence the product can print calls the binary a harness.
 *
 * `.claude/rules/product-boundaries.md`: *"'Harness' is the concept and the folder (`harness/`);
 * 'Quorum' is the product. Never call the product a harness, never call the folder quorum."*
 * `commands.test.ts` has enforced that over one constant since Q-0090 — `HELP`, with folder
 * spellings stripped, contains no `harness` — and eight printed sentences disagreed with it anyway,
 * across six modules and six of the nine commands. This generalises that file's discrimination from
 * one constant to every user-facing string the CLI can print. It does not replace it: `HELP` is
 * still asserted there, including the Q-0093 clause proving the pre-widening spelling could not
 * admit `harness/`.
 *
 * **Two scan conditions, both measured rather than chosen.**
 *
 * 1. **String literals, never comments.** 48 lines across 17 production modules of this package
 *    cite `spike/bin/harness.js` as past-tense provenance, and {@link FOLDER} strips none of them —
 *    the slash *precedes* the word there rather than following it. A guard that read comments would
 *    fire 48 times on the intended tree and demand exactly the edits Q-0103 AC-19 forbids, so
 *    reading literals only is what keeps this guard's demands legal. That is why {@link literals}
 *    skips comments with a scanner rather than matching quotes with a regular expression: in JSDoc
 *    a markdown backtick pair is indistinguishable from a template literal, so a regex would read
 *    half this repository's prose as product output.
 * 2. **Literals containing whitespace.** A path segment has none, which admits
 *    `path.join(d, 'harness', 'harness.yaml')` and `new URL('../templates/harness/', …)` with **no
 *    exemption register** — a register being the thing that goes stale (Q-0073) — and excludes the
 *    `harnessDir` identifier, which is not a literal at all.
 *
 * Its subject is this package's production modules **plus one file in `core`**: `project.ts`, whose
 * `ProjectNotFoundError` is the only sentence in `packages/core` that a user reads and that carries
 * the word (Q-0100 OQ-2). Widening to all of `core` would add every engine literal for no measured
 * subject. If a second `core` sentence appears, {@link CORE_SUBJECTS} is where it is added.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, test } from 'vitest';

/** This package's `src`, reached package-relatively so this file names no repository root. */
const SRC = fileURLToPath(new URL('.', import.meta.url));

/** The workspace root, as `validate.test.ts` reaches it for the same reason. */
const WORKSPACE = fileURLToPath(new URL('../../..', import.meta.url));

/**
 * This file, excluded because it quotes every string the scan looks for, and **derived** rather than
 * typed so that renaming it cannot leave an exclusion excusing a file that is no longer here.
 *
 * It is the only exclusion, and that is asserted below rather than stated.
 */
const GUARD = path.relative(SRC, fileURLToPath(import.meta.url));

/**
 * The files outside this package whose printed sentences are in scope, repository-relative.
 *
 * One entry, and it is a register rather than a derivation because its membership is a *judgement*
 * — which `core` sentences a user reads — where {@link production}'s is a fact about the tree.
 * Every entry is required to exist below, so a moved file fails here instead of being skipped.
 */
const CORE_SUBJECTS = ['packages/core/src/backlog/project.ts'] as const;

/**
 * The folder `harness`, written as a path — the one spelling of the word a printed string may keep.
 *
 * A slash is what tells the folder from the product. Established and demonstrated in both directions
 * in `commands.test.ts`, whose header records it reading `harness\/\S+` until Q-0093 widened it: one
 * quantifier admits `harness/harness.yaml` and refuses the bare `harness/` that `quorum init` has to
 * print. Restated here rather than imported, because no test file in this workspace imports another,
 * and demonstrated here on its own subjects so the second copy is not taken on trust.
 */
const FOLDER = /harness\/\S*/g;

/**
 * The escapes that decode to whitespace, which is the one question {@link printable} asks.
 *
 * Every other escape decodes to the character it escapes, so `\'` is an apostrophe and `\x1b` is
 * `x1b` — a fragment with no whitespace in it, and therefore not a sentence, which is what it is.
 */
const WHITESPACE_ESCAPES: Record<string, string | undefined> = { n: '\n', t: '\t', r: '\r' };

/**
 * Every string literal in `text`, with comments skipped and escape sequences consumed.
 *
 * A character scanner and not a regular expression, for the reason the header gives: the two are
 * distinguishable only by knowing whether you are inside a comment, and getting that wrong turns
 * every backticked word in a JSDoc block into product output. It is not a TypeScript parser and
 * does not claim to be — what it must get right is that a comment is not a literal, which is the
 * clause AC-5(3) demonstrates.
 *
 * **A backslash consumes the character after it, and that is a correctness property rather than a
 * nicety.** Skipping the backslash alone leaves the character behind it to be read as code, so an
 * escaped quote closes the literal it was written inside — and the cost is not the split value but
 * the **parity**: every delimiter after an odd number of them means its opposite, so the scan is
 * outside a string exactly where the file is inside one, and a sentence below is collected by
 * nobody while this file reports a clean tree. AC-5(4) pins it with the measured naive output.
 */
const literals = (text: string): string[] => {
  const found: string[] = [];
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === '/' && text[i + 1] === '/') {
      while (i < text.length && text[i] !== '\n') i += 1;
      continue;
    }
    if (ch === '/' && text[i + 1] === '*') {
      const close = text.indexOf('*/', i + 2);
      if (close < 0) return found;
      i = close + 1;
      continue;
    }
    if (ch !== '\'' && ch !== '"' && ch !== '`') continue;
    let value = '';
    i += 1;
    for (; i < text.length && text[i] !== ch; i += 1) {
      if (text[i] !== '\\') {
        value += text[i];
        continue;
      }
      i += 1;
      if (i >= text.length) break;
      value += WHITESPACE_ESCAPES[text[i]] ?? text[i];
    }
    found.push(value);
  }
  return found;
};

/** Whether a literal is one a user could read: a sentence has whitespace, a path segment has not. */
const printable = (literal: string): boolean => /\s/.test(literal);

/** What is left of a literal once every folder spelling is removed. */
const outsideAPath = (literal: string): string => literal.replace(FOLDER, '').toLowerCase();

/**
 * Every `.ts` file below this package's `src` that is not a test, as `[relative path, text]`.
 *
 * **Derived from the tree, never written down** (AC-6). `frame.source.test.ts` computes its subject
 * the same way and its header records why: `q0050.source.test.ts` mapped over six hand-written
 * names while a seventh engine file went unscanned and the suite reported green (Q-0051). A command
 * module M3 adds is covered here without anyone remembering.
 */
const production = (): [string, string][] => fs
  .readdirSync(SRC, { withFileTypes: true, recursive: true })
  .filter((entry) => entry.isFile() && entry.name.endsWith('.ts'))
  .map((entry): [string, string] => {
    const full = path.join(entry.parentPath, entry.name);
    return [path.relative(SRC, full), fs.readFileSync(full, 'utf8')];
  })
  .filter(([name]) => !name.endsWith('.test.ts') && name !== GUARD);

/** The whole subject: this package's production modules, and the `core` files that print. */
const subjects = (): [string, string][] => [
  ...production(),
  ...CORE_SUBJECTS.map((relative): [string, string] =>
    [relative, fs.readFileSync(path.join(WORKSPACE, relative), 'utf8')]),
];

describe('AC-4 — no printed string calls the product or the binary a harness', () => {
  test('every printable literal in the subject survives the folder filter with the word gone', () => {
    const offending = subjects().flatMap(([name, text]) => literals(text)
      .filter(printable)
      .filter((literal) => outsideAPath(literal).includes('harness'))
      .map((literal) => `${name}: ${literal}`));
    expect(offending, 'a printed sentence names a binary this package does not install')
      .toStrictEqual([]);
  });

  test('and the scan reaches its subject rather than collecting nothing', () => {
    // The clause that stops this being vacuous: a scanner that returned `[]` for every file would
    // satisfy the assertion above over any tree at all — *"a check that skips its subject must not
    // report success"* (2026-08-25), which is the failure this whole file exists to close and which
    // would be at its most embarrassing here. Anchored on the sentence the ticket is named for.
    const found = new Map(subjects());
    expect(literals(found.get('init.ts') ?? ''))
      .toContain('  next: quorum adapters · quorum ticket new "…" · quorum run requirements T-0001');
    expect(literals(found.get(CORE_SUBJECTS[0]) ?? ''))
      .toContain('no harness/harness.yaml found — run `quorum init` in your repo');
  });

  test('the subject is every production module and the named core files, and one exclusion', () => {
    const names = production().map(([name]) => name);
    expect(names, 'the walk found no production module, so the scan above is vacuous').not.toStrictEqual([]);
    expect(names, 'a test file is being scanned as if it were product output')
      .toStrictEqual(names.filter((name) => !name.endsWith('.test.ts')));
    expect(names, 'this file excludes itself and it is the only exclusion').not.toContain(GUARD);
    const scanned = new Set(fs.readdirSync(SRC, { recursive: true }) as string[]);
    const missing = [...scanned]
      .filter((name) => name.endsWith('.ts') && !name.endsWith('.test.ts') && name !== GUARD)
      .filter((name) => !names.includes(name));
    expect(missing, 'a production module went unscanned').toStrictEqual([]);
    for (const relative of CORE_SUBJECTS) {
      expect(fs.existsSync(path.join(WORKSPACE, relative)), `${relative} has moved`).toBe(true);
    }
  });
});

describe('AC-5 — the filter discriminates, in the three directions it has to and the two the scan needs', () => {
  test('(1) it removes a folder spelling and leaves a bare mention', () => {
    // `commands.test.ts` proves this over `HELP`; proved again here because this is a second copy of
    // the regex and a copy taken on trust is how two guards drift into disagreeing.
    expect(outsideAPath('see harness/harness.yaml')).not.toContain('harness');
    expect(outsideAPath('created harness/ and backlog/')).not.toContain('harness');
    expect(outsideAPath('runs the harness')).toContain('harness');
    // And the pre-Q-0093 spelling, which could not admit the bare folder — the widening restated as
    // a measurement rather than inherited as a preference.
    expect('created harness/ and backlog/'.replace(/harness\/\S+/g, '')).toContain('harness');
  });

  test('(2) a whitespace-free literal is not a subject and a sentence is', () => {
    // Why the condition is whitespace rather than a list of module names: a path segment carries
    // none, so `path.join(d, 'harness', 'harness.yaml')` needs no exemption and no register.
    expect(printable('harness')).toBe(false);
    expect(printable('harness.yaml')).toBe(false);
    expect(printable('../templates/harness/')).toBe(false);
    expect(printable('run `harness init` in your repo')).toBe(true);
    expect(outsideAPath('run `harness init` in your repo')).toContain('harness');
  });

  test('(3) a comment carrying the sentence is not a subject, and a literal carrying it is', () => {
    // The clause that keeps this guard legal. Q-0103 AC-19 forbids rewriting past-tense provenance,
    // and 48 lines across 17 modules of this package carry `spike/bin/harness.js` — which FOLDER
    // does not strip, the slash preceding the word rather than following it. A comment-reading guard
    // would fire on every one of them and demand precisely the forbidden edit.
    expect(outsideAPath('see spike/bin/harness.js:124'), 'FOLDER strips a citation it must not')
      .toContain('harness');
    const provenance = '/** Why: preserved from `spike/bin/harness.js:342`, run `harness init`. */\nconst a = 1;\n';
    expect(literals(provenance), 'a comment was read as product output').toStrictEqual([]);
    const printed = 'const a = \'run `harness init` in your repo\';\n';
    expect(literals(printed)).toStrictEqual(['run `harness init` in your repo']);
    // Both halves over one file, which is the shape a production module actually has.
    expect(literals(provenance + printed)).toStrictEqual(['run `harness init` in your repo']);
  });

  test('and a line comment does not hide the literal after it', () => {
    // The other comment form, and the one whose scan must stop at the newline rather than at the
    // next quote — a scanner that ran to end-of-file would swallow every literal below the first
    // `//` in a module and report a clean tree.
    expect(literals('// run `harness init`\nconst a = \'run `harness init` here\';\n'))
      .toStrictEqual(['run `harness init` here']);
  });

  test('(4) an escaped quote does not end the literal, and does not hide the one after it', () => {
    // A quote escaped inside its own delimiter, which is the evasion this clause closes. Consuming
    // the backslash alone leaves the quote behind it to be read as the terminator, and the damage
    // is not the split literal — it is the **parity**: every quote after an odd number of them
    // swaps its meaning, so the scan is outside a string where the file is inside one. An offending
    // sentence below is then read as code and collected by nobody, and the guard reports a clean
    // tree over a module that prints `harness`. The escape is consumed with the character it
    // escapes, so the parity never inverts.
    const escaped = 'const a = \'it\\\'s fine\';\nconst b = \'usage: harness run <flow>\';\n';
    expect(literals(escaped)).toStrictEqual(['it\'s fine', 'usage: harness run <flow>']);
    // The half that makes it load-bearing rather than cosmetic. Against a scan that consumed only
    // the backslash this file yields `['it', ';\nconst b = ', ';\n']` — measured, and the failure
    // this test showed before the scanner was fixed — in which the usage line appears in no entry
    // at all and the filters below have nothing to refuse.
    const offending = literals(escaped).filter(printable)
      .filter((literal) => outsideAPath(literal).includes('harness'));
    expect(offending).toStrictEqual(['usage: harness run <flow>']);
  });

  test('(5) a template literal is collected whole, interpolations and escapes included', () => {
    // The interpolating shapes the subject actually has: `board.ts:117` is the hint with the flow
    // name in it, and `init.ts:63` wraps the next-steps constant in a template of its own. A scan
    // stopping at an interpolation reads half of each. The expression source is kept rather than
    // evaluated — over-reading can only make the guard fire, where under-reading is what lets a
    // sentence through.
    expect(literals('const a = `→ quorum run ${next.name} <id>`;\n'))
      .toStrictEqual(['→ quorum run ${next.name} <id>']);
    // A quote inside an interpolation is content and not a delimiter, which is `init.ts:63`'s shape.
    expect(literals('const a = `${c.green(\'✓\')} harness/ created`;\n'))
      .toStrictEqual(['${c.green(\'✓\')} harness/ created']);
    // And an escaped backtick does not close the template, which is clause (4) in a third delimiter.
    expect(literals('const a = `run \\`harness init\\` in your repo`;\n'))
      .toStrictEqual(['run `harness init` in your repo']);
  });

  test('and a whitespace escape counts as whitespace, because the printed string has it', () => {
    // `printable` asks what the user sees. `\n` is a newline once printed, so a literal whose only
    // whitespace is escaped is a sentence and not a path segment; decoding it is what keeps that
    // question honest. `lint.ts:71` and `trace.ts:67` are the live subjects.
    expect(literals('const a = \'harness\\ninit\';\n')).toStrictEqual(['harness\ninit']);
    expect(printable('harness\ninit')).toBe(true);
    // Every other escape decodes to the character it escapes, which is what keeps `\x1b` a path-like
    // fragment rather than a sentence.
    expect(literals('const a = \'\\x1b[0m\';\n')).toStrictEqual(['x1b[0m']);
    expect(printable('x1b[0m')).toBe(false);
  });
});
