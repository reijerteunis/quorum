/**
 * Q-0090 AC-7 — the help is owned data, it says Quorum, and it claims only what the frame
 * dispatches.
 */
import fs from 'node:fs';

import { describe, expect, test } from 'vitest';

import { COMMANDS, HELP, isCommand } from './commands.js';

/**
 * The module's own text, read package-relatively so this file names no repository root.
 *
 * Read at all because AC-7's third clause is about a *mechanism*: the spike builds its help by
 * opening its own source file, and asserting that this one does not needs the source.
 */
const source = (name: string): string => fs.readFileSync(new URL(`./${name}`, import.meta.url), 'utf8');

/** Command names the help mentions: an indented line whose first token is the binary. */
const mentioned = (text: string): string[] =>
  [...text.matchAll(/^ {2}quorum (\S+)/gm)].map((match) => match[1]);

describe('AC-7 — the text', () => {
  test('names the product and the usage form', () => {
    expect(HELP).toContain('Quorum');
    expect(HELP).toContain('usage: quorum <command> [options]');
    expect(HELP.trim()).not.toBe('');
  });

  test('never calls the product a harness', () => {
    // `.claude/rules/product-boundaries.md`: "harness" is the concept and the folder, "Quorum" is
    // the product. The spike's own header breaks this on every line, which is why the text is
    // rewritten here rather than transcribed. Not a fix for Q-0068, whose subject is the BYOS
    // refusal string in the adapters, and which this ticket leaves alone.
    const outsideAPath = HELP.replace(/harness\/\S+/g, '');
    expect(outsideAPath.toLowerCase()).not.toContain('harness');
  });

  test('the exclusion is load-bearing — a path literal is what it is allowed to keep', () => {
    // Shown to discriminate rather than asserted: the filter removes `harness/harness.yaml` and
    // leaves a bare mention, so the clause above would fail on a help text that carried one.
    expect('see harness/harness.yaml'.replace(/harness\/\S+/g, '').toLowerCase()).not.toContain('harness');
    expect('runs the harness'.replace(/harness\/\S+/g, '').toLowerCase()).toContain('harness');
  });
});

/**
 * An import of a module you would need to open a file with. Anchored on the import rather than on
 * the call, so a comment *describing* the spike's mechanism cannot trip it: a guard that fires on
 * text it does not execute is the same defect as one that can be talked out of firing by it
 * (Q-0079 round 1).
 */
const FILE_READER = /^import\s.*from '(node:fs|node:url|node:path)';$/m;

describe('AC-7 — the mechanism is data, not the file it lives in', () => {
  test('neither module can read its own source, because neither imports a way to', () => {
    // `spike/bin/harness.js:561` builds the help by opening the binary's own file and slicing
    // lines 1 to 10. That cannot survive an emit — emitted JavaScript carries no comment block at
    // those line numbers — so the mechanism changes here, where it costs one constant, rather than
    // inside Q-0096, where it would arrive as an unrelated surprise.
    for (const name of ['commands.ts', 'main.ts']) {
      expect(source(name), `${name} imports a filesystem reader`).not.toMatch(FILE_READER);
    }
  });

  test('the clause has a subject — this test file itself imports one', () => {
    expect(source('commands.test.ts')).toMatch(FILE_READER);
  });
});

describe('AC-7 — the help lists only commands the frame dispatches', () => {
  test('every command name in the help is registered', () => {
    const names = mentioned(HELP);
    expect(names.length, 'the help lists no command — this test proves nothing').toBeGreaterThan(0);
    for (const name of names) {
      expect(isCommand(name), `the help lists "${name}", which the frame does not dispatch`).toBe(true);
    }
  });

  test('the extraction has a subject — an unregistered line would be caught', () => {
    const withStray = `${HELP}\n  quorum board                            kanban of tickets by stage`;
    expect(mentioned(withStray)).toContain('board');
    expect(mentioned(withStray).filter((name) => !isCommand(name))).toStrictEqual(['board']);
  });

  test('and the usage line is not read as a command', () => {
    expect(mentioned(HELP)).not.toContain('<command>');
  });

  test('the registry today is the help itself, and nothing else', () => {
    // Q-0091 to Q-0094 each add their own name and line as their command lands. Listing the eight
    // the spike has would be a green tick over a subject that does not exist: each would fall
    // through AC-6's default branch to this same text and exit 0.
    expect([...COMMANDS]).toStrictEqual(['help']);
    expect(mentioned(HELP)).toStrictEqual(['help']);
  });
});
