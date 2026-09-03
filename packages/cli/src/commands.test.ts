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

  test('the registry is help and the three read-only commands, and nothing else', () => {
    // Q-0093, Q-0094 and Q-0099 each add their own name and line as their command lands. Listing
    // the eight the spike has would be a green tick over a subject that does not exist: each would
    // fall through AC-6's default branch to this same text and exit 0.
    expect([...COMMANDS]).toStrictEqual(['help', 'lint', 'validate', 'runs']);
    expect(mentioned(HELP)).toStrictEqual(['help', 'lint', 'validate', 'runs']);
  });

  test('and both pins moved rather than being edited to fit — the value they replaced is refused', () => {
    // Q-0091 AC-1: the two pins above read `['help']` until this ticket, and a pin that had been
    // widened to `toContain` would have accepted either. Shown discriminating in both directions —
    // the old value no longer describes the frame, and the extraction still finds the new names in
    // the help rather than only in the registry.
    expect([...COMMANDS], 'the frame still registers only help').not.toStrictEqual(['help']);
    expect(mentioned(HELP), 'the help still lists only help').not.toStrictEqual(['help']);
    for (const name of ['lint', 'validate']) {
      expect(mentioned(HELP), `${name} is registered and the help does not list it`).toContain(name);
      expect(isCommand(name), `the help lists ${name} and the frame does not dispatch it`).toBe(true);
    }
  });

  test('each new line carries what the spike header says its command takes and does', () => {
    // AC-1 asks for the *information* of `spike/bin/harness.js:6` and `:8`, rewritten rather than
    // transcribed: the arguments each takes, and what it does. The spike's own wording cannot be
    // reused, because every one of its lines opens with the binary name this one is not called.
    const line = (name: string): string => HELP.split('\n').find((text) => text.startsWith(`  quorum ${name}`)) ?? '';
    expect(line('lint')).toMatch(/lint the whole flow directory/);
    expect(line('lint'), 'what the whole-directory walk covers is what makes it worth running').toMatch(/cross-flow/);
    expect(line('validate'), 'the arguments it takes').toContain('<schema.json> <file…>');
    expect(line('validate'), 'the exit code is the contract a script step reads').toMatch(/exit 1 on failure/);
    // Their order is the spike header's: `lint` at `:6` precedes `validate` at `:8`. `help` keeps
    // the first line Q-0090 gave it, the spike's header having no such line to order it against.
    expect(mentioned(HELP).indexOf('lint')).toBeLessThan(mentioned(HELP).indexOf('validate'));
  });

  test('Q-0092 AC-1 — `runs` is registered, listed last, and says what it takes and does', () => {
    // Both pins above read three entries until this ticket, and the value they replaced is refused
    // rather than widened to a `toContain` that would accept either.
    expect([...COMMANDS], 'the frame still registers only the two read-only commands')
      .not.toStrictEqual(['help', 'lint', 'validate']);
    expect(mentioned(HELP), 'the help still lists only the two read-only commands')
      .not.toStrictEqual(['help', 'lint', 'validate']);
    expect(isCommand('runs'), 'the help lists runs and the frame does not dispatch it').toBe(true);

    const line = HELP.split('\n').find((text) => text.startsWith('  quorum runs')) ?? '';
    expect(line, 'the arguments it takes').toContain('[ticket|run-id] [--json]');
    expect(line, 'what it does — listing, the ticket filter, and one run in detail')
      .toMatch(/run history: list, filter by ticket, or show one run/);
    // Last, because `spike/bin/harness.js:10` is the last line of that header. AC-1's ordering rule
    // is the spike's own wherever it has one.
    expect(mentioned(HELP)[mentioned(HELP).length - 1]).toBe('runs');
    expect(mentioned(HELP).indexOf('validate')).toBeLessThan(mentioned(HELP).indexOf('runs'));
  });

  test('and its line is aligned to the description column the other three share', () => {
    // The help is one block of text a stranger reads, so a new line that broke the column would be
    // a visible regression no other assertion here would catch.
    const columns = HELP.split('\n')
      .filter((line) => line.startsWith('  quorum '))
      .map((line) => {
        // Past the two-space indent first, or every line would report the indent as its column.
        const gap = / {2,}/.exec(line.slice(2));
        return gap === null ? -1 : 2 + gap.index + gap[0].length;
      });
    expect(columns, 'a command line carries no description at all').not.toContain(-1);
    expect(new Set(columns).size, `the description column is ragged: ${columns.join(', ')}`).toBe(1);
    expect(columns.length, 'no command lines were found — this proves nothing').toBe(4);
    // And the measurement discriminates: a line one space short reports a different column.
    const ragged = '  quorum runs [ticket|run-id] [--json]   x'.slice(2);
    expect(2 + (/ {2,}/.exec(ragged)?.index ?? 0) + (/ {2,}/.exec(ragged)?.[0].length ?? 0))
      .not.toBe(columns[0]);
  });
});

// AC-1's BYOS clause is asserted nowhere in this file on purpose. `frame.source.test.ts`'s
// package-wide scan already reads `commands.ts`, and therefore {@link HELP}, against every spelling
// that would mean a key had a path through the CLI — so a second check here would add nothing, and
// writing one costs this file an exemption from that scan, because a test naming those spellings
// trips it. That collision is real and was met: the first draft of this block earned exactly that
// failure. Q-0095 inherits the same problem with `smoke.js`'s BYOS assertion, where it is a finding
// rather than a duplicate (merged.md OQ-5).
