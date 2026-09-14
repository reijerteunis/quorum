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

/**
 * The folder `harness`, written as a path — the one spelling of the word the help may carry.
 *
 * `product-boundaries.md` permits the word for the **folder** and forbids it for the product, and a
 * slash is what tells the two apart. It read `harness\/\S+` until Q-0093, which admitted
 * `harness/harness.yaml` and refused `harness/` — so a help line naming the directory `quorum init`
 * creates would have failed a guard aimed at something else entirely. One quantifier wider; a
 * mention with no slash is still a mention, which is asserted below in both directions.
 */
const FOLDER = /harness\/\S*/g;

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
    const outsideAPath = HELP.replace(FOLDER, '');
    expect(outsideAPath.toLowerCase()).not.toContain('harness');
  });

  test('the exclusion is load-bearing — a path literal is what it is allowed to keep', () => {
    // Shown to discriminate rather than asserted: the filter removes `harness/harness.yaml` and
    // leaves a bare mention, so the clause above would fail on a help text that carried one.
    expect('see harness/harness.yaml'.replace(FOLDER, '').toLowerCase()).not.toContain('harness');
    expect('runs the harness'.replace(FOLDER, '').toLowerCase()).toContain('harness');
  });

  test('Q-0093 — and the folder written with its own trailing slash is a path too', () => {
    // The exclusion said `harness/\S+`, which admits `harness/harness.yaml` and refuses `harness/`
    // — the spelling the rule itself uses for the folder, and the one `quorum init` has to print,
    // because what it creates is that directory and not a file inside it. Widened by one quantifier
    // rather than by dropping the clause, and shown still to discriminate: a slash is what makes a
    // mention a path, so every spelling without one is still refused.
    expect('created harness/ and backlog/'.replace(FOLDER, '').toLowerCase()).not.toContain('harness');
    expect('into <dir>/harness/ and create'.replace(FOLDER, '').toLowerCase()).not.toContain('harness');
    expect('runs the harness for you'.replace(FOLDER, '').toLowerCase()).toContain('harness');
    expect('a harness, compiled'.replace(FOLDER, '').toLowerCase()).toContain('harness');
    // And the pre-Q-0093 spelling is shown to be the thing that could not admit it, so the widening
    // is a measurement rather than a preference.
    expect('created harness/ and backlog/'.replace(/harness\/\S+/g, '').toLowerCase()).toContain('harness');
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
    // Q-0099 AC-2(a): the stray name was `board` until this ticket registered it, at which point
    // `isCommand('board')` became true, the filter yielded `[]` and this demonstration could no
    // longer fail. Re-aimed at a name that is not one of the spike's eight and never will be; the
    // clause below shows the old value going vacuous rather than describing it.
    const withStray = `${HELP}\n  quorum not-a-command                    a line no dispatch table carries`;
    expect(mentioned(withStray)).toContain('not-a-command');
    expect(mentioned(withStray).filter((name) => !isCommand(name))).toStrictEqual(['not-a-command']);
  });

  test('Q-0099 AC-2(a) — and the name it replaced no longer discriminates, so nobody restores it', () => {
    // `board` is dispatched now, so a help line carrying it is extracted and then accepted: the
    // extraction still finds it, and the filter that used to report it finds nothing. Both halves,
    // because the first alone would hold over an extraction that had stopped working.
    const wasBoard = `${HELP}\n  quorum board                            kanban of tickets by stage`;
    expect(mentioned(wasBoard), 'the extraction stopped seeing the line').toContain('board');
    expect(mentioned(wasBoard).filter((name) => !isCommand(name)), 'board is unregistered again')
      .toStrictEqual([]);
  });

  test('and the usage line is not read as a command', () => {
    expect(mentioned(HELP)).not.toContain('<command>');
  });

  test('the registry is help plus the spike\'s eight plus `open`, in that order, and nothing else', () => {
    // Complete since Q-0099 and one wider since Q-0126. Until Q-0099, listing a command the frame
    // did not dispatch would have been a green tick over a subject that does not exist: it would
    // fall through AC-6's default branch to this same text and exit 0.
    const registry = ['help', 'init', 'ticket', 'board', 'run', 'lint', 'adapters', 'validate', 'runs', 'open'];
    expect([...COMMANDS]).toStrictEqual(registry);
    expect(mentioned(HELP)).toStrictEqual(registry);
  });

  test('Q-0126 AC-1 — `open` is appended last, and the value the two pins replaced is refused', () => {
    // Both pins above read nine entries until this ticket, and neither was widened to a `toContain`
    // that would accept either — the demonstration every command child before this one wrote for
    // its own addition.
    const beforeQ0126 = ['help', 'init', 'ticket', 'board', 'run', 'lint', 'adapters', 'validate', 'runs'];
    expect([...COMMANDS], 'the frame still registers only the spike\'s eight and help')
      .not.toStrictEqual(beforeQ0126);
    expect(mentioned(HELP), 'the help still lists only the spike\'s eight and help')
      .not.toStrictEqual(beforeQ0126);
    expect(isCommand('open'), 'the help lists open and the frame does not dispatch it').toBe(true);
    // Appended rather than inserted, which is the only position that changes no existing relative
    // order: every name before it took its place in `spike/bin/harness.js`'s header, and that header
    // has no `open` line to insert against.
    expect([...COMMANDS].slice(0, -1), 'appending moved one of the nine that were already there')
      .toStrictEqual(beforeQ0126);
    expect([...COMMANDS][COMMANDS.length - 1]).toBe('open');

    const line = HELP.split('\n').find((text) => text.startsWith('  quorum open')) ?? '';
    expect(line, 'the flag it takes').toContain('[--port <n>]');
    // Q-0126 AC-15: the second flag, and the help is where an operator learns the command launches
    // a browser at all. Both are asserted, because a line naming the flag without naming what it
    // turns off would document an option nobody could read a purpose into.
    expect(line, 'the flag that serves without launching').toContain('[--no-open]');
    expect(line, 'what it does — the app, the bind, the browser, and how it stops')
      .toMatch(/serve the web app on loopback, print its URL and open it; Ctrl-C stops it/);
    // AC-2's clause that no flag may move the bind: the help names no host flag and no hostname.
    expect(line, 'the help offers a way to move the bind').not.toContain('--host');
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
    // Last of the spike's eight, because `spike/bin/harness.js:10` is the last line of that header.
    // AC-1's ordering rule is the spike's own wherever it has one — and Q-0126's `open` is appended
    // after it, having no line in that header to be ordered against, so what this asserts is the
    // relative order the rule is about rather than a position that a later command can take.
    expect(mentioned(HELP).indexOf('validate')).toBeLessThan(mentioned(HELP).indexOf('runs'));
    expect(mentioned(HELP).indexOf('runs'), 'runs is no longer the last of the spike\'s eight')
      .toBe(mentioned(HELP).filter((name) => name !== 'open').length - 1);
  });

  test('Q-0093 AC-1 — `init` and `ticket` are registered, listed above `lint`, and say what they take', () => {
    // Both pins above read four entries until this ticket, and the value they replaced is refused
    // rather than widened to a `toContain` that would accept either — the demonstration Q-0091 and
    // Q-0092 each wrote for their own additions.
    expect([...COMMANDS], 'the frame still registers only the read-only commands')
      .not.toStrictEqual(['help', 'lint', 'validate', 'runs']);
    expect(mentioned(HELP), 'the help still lists only the read-only commands')
      .not.toStrictEqual(['help', 'lint', 'validate', 'runs']);
    for (const name of ['init', 'ticket']) {
      expect(isCommand(name), `the help lists ${name} and the frame does not dispatch it`).toBe(true);
    }

    const line = (name: string): string => HELP.split('\n').find((text) => text.startsWith(`  quorum ${name}`)) ?? '';
    expect(line('init'), 'the argument it takes').toContain('[dir]');
    expect(line('init'), 'what it does — both directories, from the shipped templates')
      .toMatch(/copy the shipped templates into <dir>\/harness\/ and create backlog\//);
    expect(line('ticket'), 'the arguments it takes').toContain('new "<title>"');
    expect(line('ticket'), 'the three optional flags the spike header names')
      .toMatch(/\[--intent --owner --id\]/);
    expect(line('ticket'), 'what it does — the id comes from the backlog rather than from a setting')
      .toMatch(/create a ticket at the backlog's next id/);

    // Above `lint`, because `spike/bin/harness.js:3` and `:4` precede `:7`. AC-1's ordering rule is
    // the spike's own wherever it has one, which is the same rule that put `runs` last.
    const order = mentioned(HELP);
    expect(order.indexOf('init')).toBeLessThan(order.indexOf('ticket'));
    expect(order.indexOf('ticket')).toBeLessThan(order.indexOf('lint'));
    expect(order.indexOf('help')).toBeLessThan(order.indexOf('init'));
  });

  test('Q-0094 AC-1 — `run` is registered, listed between `ticket` and `lint`, and names its flags', () => {
    // Both pins above read six entries until this ticket, and the value they replaced is refused
    // rather than widened to a `toContain` that would accept either — the demonstration Q-0091,
    // Q-0092 and Q-0093 each wrote for their own additions.
    expect([...COMMANDS], 'the frame still registers only the commands it had before this ticket')
      .not.toStrictEqual(['help', 'init', 'ticket', 'lint', 'validate', 'runs']);
    expect(mentioned(HELP), 'the help still lists only the commands it had before this ticket')
      .not.toStrictEqual(['help', 'init', 'ticket', 'lint', 'validate', 'runs']);
    expect(isCommand('run'), 'the help lists run and the frame does not dispatch it').toBe(true);

    const line = HELP.split('\n').find((text) => text.startsWith('  quorum run ')) ?? '';
    expect(line, 'the arguments it takes').toContain('<flow> <ticket>');
    expect(line, 'the six flags the spike header names, plus the two it gained since')
      .toContain('[--auto --dry --base --adapter --verbose --gate-answer]');
    expect(line, 'the exit codes a scripting maintainer reads, which no other command has')
      .toMatch(/exits 2 aborted, 3 gate unanswered/);

    // Between `ticket` and `lint`, because `spike/bin/harness.js:6` sits between `:4` and `:7`.
    // AC-1's ordering rule is the spike's own wherever it has one, which is the rule that put `runs`
    // last and `init` and `ticket` above `lint`.
    const order = mentioned(HELP);
    expect(order.indexOf('ticket')).toBeLessThan(order.indexOf('run'));
    expect(order.indexOf('run')).toBeLessThan(order.indexOf('lint'));
  });

  test('Q-0099 AC-1 — `board` and `adapters` are registered at the spike header\'s own places', () => {
    // Both pins above read seven entries until this ticket, and the value they replaced is refused
    // rather than widened to a `toContain` that would accept either — the demonstration Q-0091 to
    // Q-0094 each wrote for their own additions.
    const beforeQ0099 = ['help', 'init', 'ticket', 'run', 'lint', 'validate', 'runs'];
    expect([...COMMANDS], 'the frame still registers only the commands it had before this ticket')
      .not.toStrictEqual(beforeQ0099);
    expect(mentioned(HELP), 'the help still lists only the commands it had before this ticket')
      .not.toStrictEqual(beforeQ0099);
    for (const name of ['board', 'adapters']) {
      expect(isCommand(name), `the help lists ${name} and the frame does not dispatch it`).toBe(true);
    }

    const line = (name: string): string => HELP.split('\n').find((text) => text.startsWith(`  quorum ${name}`)) ?? '';
    expect(line('board'), 'what it shows').toMatch(/kanban of tickets by stage/);
    // The second fact on each row, glossed rather than named: the word for it is a `@quorum/core`
    // symbol, and `frame.source.test.ts`'s AC-10 partition forbids a FRAME module — which this one
    // is — from naming one at all. Measured, not anticipated: the first draft of this line used the
    // word and turned that guard red. So the help says what a reader sees and `board.ts` carries the
    // vocabulary, which is where the rendering lives anyway.
    expect(line('board'), 'and the second fact on each row').toMatch(/where each ticket's code is/);
    expect(line('adapters'), 'the two flags it takes').toContain('[--probe] [--json]');
    expect(line('adapters'), 'what it reports').toMatch(/which vendor CLIs are installed/);
    expect(line('adapters'), 'and what --probe adds on top of presence').toMatch(/--probe also proves the login/);
    // The spike header's `CLIs installed + no API keys` does not survive: the word is
    // **subscription**, per `.claude/rules/product-boundaries.md` and this file's own header. The
    // BYOS scan in `frame.source.test.ts` is NOT what forces it — its first pattern wants an
    // underscore where the spike's wording has a space — so this clause is the only thing enforcing
    // it (merged.md M-6). The pattern itself may not be quoted here, nor the word for what it hunts:
    // this file is inside that scan, which is the collision the note at the foot of it records.
    expect(line('adapters'), 'the auth model the reader is told about').toMatch(/subscription/);
    expect(HELP, 'the help offers a key as a way in').not.toMatch(/api[ _-]?key/i);

    // `board` between `ticket` and `run`, `adapters` between `lint` and `validate`, because
    // `spike/bin/harness.js:5` sits between `:4` and `:6` and `:8` between `:7` and `:9`. AC-1's
    // ordering rule is the spike's own wherever it has one.
    const order = mentioned(HELP);
    expect(order.indexOf('ticket')).toBeLessThan(order.indexOf('board'));
    expect(order.indexOf('board')).toBeLessThan(order.indexOf('run'));
    expect(order.indexOf('lint')).toBeLessThan(order.indexOf('adapters'));
    expect(order.indexOf('adapters')).toBeLessThan(order.indexOf('validate'));
  });

  test('and its line is aligned to the description column the other six share', () => {
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
    // Ten since Q-0126, nine since Q-0099, seven before it. The count is the register: a command
    // whose line is missing entirely would otherwise leave a single-column block reporting perfect
    // alignment over nine.
    expect(columns.length, 'no command lines were found — this proves nothing').toBe(10);
    expect(columns.length, 'the register still holds the seven lines it held before Q-0099').not.toBe(7);
    expect(columns.length, 'the register still holds the nine lines it held before Q-0126').not.toBe(9);
    // The column is 42 and the two new prefixes are 14 and 36, so neither forced a reflow of the
    // seven that were already there — which is what makes this a check on the addition rather than
    // on a wholesale re-indent nobody asked for. Q-0126's prefix is 26 and fits the same column.
    expect(columns[0]).toBe(42);
    // And the measurement discriminates: a line one space short reports a different column.
    const ragged = '  quorum runs [ticket|run-id] [--json]   x'.slice(2);
    expect(2 + (/ {2,}/.exec(ragged)?.index ?? 0) + (/ {2,}/.exec(ragged)?.[0].length ?? 0))
      .not.toBe(columns[0]);
  });
});

/**
 * The workspace root, which is this package's grandparent — reached package-relatively rather than
 * by climbing until something looks like a repository.
 */
const WORKSPACE = new URL('../../../', import.meta.url);

/** One repository document, read for the derived documentation check below. */
const document = (relative: string): string => fs.readFileSync(new URL(relative, WORKSPACE), 'utf8');

/**
 * The command name after `quorum`, stopping at whitespace **or at the closing backtick**.
 *
 * `[^\s`]+` rather than `\S+`, which is the spelling {@link mentioned} can use and these two cannot:
 * a help line always has a description after it, while `` `quorum board` `` ends at the code span —
 * so `\S+` reads the name as ``board` `` and the comparison fails for a document that is correct.
 * Measured on first writing rather than reasoned about.
 */
const NAME = '([^\\s`]+)';

/** The commands `README.md`'s table lists: a table row whose first cell opens with the binary. */
const inReadme = (text: string): string[] =>
  [...text.matchAll(new RegExp(`^\\| \`quorum ${NAME}`, 'gm'))].map((match) => match[1]);

/** The commands `docs/USAGE.md` documents: an `###` heading whose first token is the binary. */
const inUsage = (text: string): string[] =>
  [...text.matchAll(new RegExp(`^### \`quorum ${NAME}`, 'gm'))].map((match) => match[1]);

/**
 * The one command neither document lists, and why that is correct rather than a gap.
 *
 * `help` is what a reader of either document is *already* doing, and neither is a reference for it:
 * the README's table is what a stranger runs, and USAGE's sections are the flags and exit codes of
 * commands that take some. Named rather than filtered silently, so a second exclusion is a visible
 * act instead of a quiet widening.
 */
const UNDOCUMENTED_BY_DESIGN = ['help'];

describe('Q-0126 AC-11 — every command the frame dispatches is documented, derived rather than listed', () => {
  // **In `packages/cli` and not in `packages/shared`.** Deriving this from `COMMANDS` means reading
  // `packages/cli/src/commands.ts`, and a check in `shared` doing that would reverse the dependency
  // direction `04-architecture.md` forbids — which is the exact refusal Q-0089 met when it put both
  // trees' checks there and Q-0072's input guard reported it as an undeclared read. The two
  // documents are declared inputs of this task instead; `package.test.ts`'s `OUTSIDE` register
  // carries the reason for each.
  const expected = (): string[] => [...COMMANDS].filter((name) => !UNDOCUMENTED_BY_DESIGN.includes(name)).sort();

  test('the README table and the USAGE reference each list exactly the dispatched set', () => {
    const readme = inReadme(document('README.md'));
    const usage = inUsage(document('docs/USAGE.md'));
    expect(readme.length, 'the README table was not found — this check proves nothing').toBeGreaterThan(5);
    expect(usage.length, 'the USAGE reference was not found — this check proves nothing').toBeGreaterThan(5);
    expect(readme.sort(), 'the README table and the dispatched set disagree').toStrictEqual(expected());
    expect(usage.sort(), 'the USAGE reference and the dispatched set disagree').toStrictEqual(expected());
    // And the exclusion is load-bearing rather than defensive: without it the comparison is wrong,
    // so a later reader cannot mistake it for a filter that happens to change nothing.
    expect([...COMMANDS].sort(), 'help is documented after all, so the exclusion excuses nothing')
      .not.toStrictEqual(expected());
  });

  test('and it fires in both directions — an undocumented command fails, and so does a documented one that is gone', () => {
    // Over text rather than over the tree, because the shipped documents pass. Both halves, because
    // a check that only refused a *missing* entry would let a document go on describing a command
    // the frame had dropped — which is the direction a deletion takes.
    const table = '| `quorum init [dir]` | scaffold |\n| `quorum board` | a board |\n';
    expect(inReadme(table)).toStrictEqual(['init', 'board']);
    expect(inReadme(table), 'a command the table omits is not noticed').not.toContain('open');

    const withStray = `${table}| \`quorum teleport\` | a command nothing dispatches |\n`;
    expect(inReadme(withStray).filter((name) => !isCommand(name)), 'a documented name that is no command passes')
      .toStrictEqual(['teleport']);

    const sections = '### `quorum init [dir]`\n\ntext\n\n### `quorum open [--port <n>]`\n\ntext\n';
    expect(inUsage(sections)).toStrictEqual(['init', 'open']);
    expect(inUsage('## `quorum init`\n'), 'a heading at the wrong level is read as a section').toStrictEqual([]);
    expect(inUsage('Run `quorum init` first.\n'), 'prose naming a command is read as a section').toStrictEqual([]);
  });

  test('the command this ticket added is in both, and each says what a packed install cannot do', () => {
    // The clause that keeps the documents honest rather than merely complete. README's install
    // section claims both paths work, so a table listing a command that works on one of them is a
    // false claim by omission — `harness/product-context.md` quality pillar 7, narrowed precisely by
    // *"An optional edge says the daemon may be absent, and never why"* (2026-09-14) clause 3 rather
    // than weakened to "mostly works".
    const readme = document('README.md');
    const usage = document('docs/USAGE.md');
    expect(inReadme(readme)).toContain('open');
    expect(inUsage(usage)).toContain('open');
    for (const [where, text] of [['README.md', readme], ['docs/USAGE.md', usage]] as const) {
      expect(text, `${where} does not say the packed path lacks the daemon`).toContain('packed install');
      expect(text, `${where} does not route the question to the ticket that owns it`).toContain('Q-0124');
    }
  });
});

// AC-1's BYOS clause is asserted nowhere in this file on purpose. `frame.source.test.ts`'s
// package-wide scan already reads `commands.ts`, and therefore {@link HELP}, against every spelling
// that would mean a key had a path through the CLI — so a second check here would add nothing, and
// writing one costs this file an exemption from that scan, because a test naming those spellings
// trips it. That collision is real and was met: the first draft of this block earned exactly that
// failure. Q-0095 inherits the same problem with `smoke.js`'s BYOS assertion, where it is a finding
// rather than a duplicate (merged.md OQ-5).
