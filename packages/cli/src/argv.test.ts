/**
 * Q-0090 AC-2 — the argv parser is `spike/bin/harness.js:25–42`, behaviour for behaviour.
 *
 * Every row here is an array handed straight to {@link parseArgv}. No verdict in this file depends
 * on the invoking shell, the terminal, git configuration, an installed vendor CLI or a directory
 * the product creates: the parser reads nothing but its argument.
 */
import { describe, expect, test } from 'vitest';

import { GATE_ANSWER, parseArgv } from './argv.js';

describe('AC-2 — the seven behaviours, each pinned on its own', () => {
  test('1 — positionals keep their order, and the first of them is the command', () => {
    const parsed = parseArgv(['run', 'review', 'Q-0090']);
    expect(parsed.cmd).toBe('run');
    expect(parsed.rest).toStrictEqual(['review', 'Q-0090']);
    expect(parsed.flags).toStrictEqual({});
    expect(parsed.gateAnswers).toStrictEqual([]);
  });

  test('1 — an empty command line yields no command and no rest', () => {
    expect(parseArgv([])).toStrictEqual({ cmd: undefined, rest: [], flags: {}, gateAnswers: [] });
  });

  test('2 — a flag takes the next token, unless that token is itself a flag', () => {
    const parsed = parseArgv(['--adapter', 'mock', '--auto', '--dry']);
    expect(parsed.flags).toStrictEqual({ adapter: 'mock', auto: true, dry: true });
    // `--auto` did not swallow `--dry`; `--dry` was re-parsed as the next flag rather than consumed.
    expect(parsed.rest).toStrictEqual([]);
  });

  test('2 — a flag with no following token at all is true', () => {
    expect(parseArgv(['--json']).flags).toStrictEqual({ json: true });
  });

  test('2 — an empty string is not a value, and becomes a positional instead', () => {
    // Why: preserved, see Q-0090 AC-2 behaviour 2. The spike's test is `args[i + 1] && …`, so a
    // falsy next token leaves the flag `true` and is re-read on the following pass as a positional.
    const parsed = parseArgv(['--base', '', 'board']);
    expect(parsed.flags).toStrictEqual({ base: true });
    expect(parsed.cmd).toBe('');
    expect(parsed.rest).toStrictEqual(['board']);
  });

  test('3 — only gate-answer accumulates, in command-line order', () => {
    const parsed = parseArgv([
      '--gate-answer', 'advance', '--adapter', 'mock',
      '--gate-answer', 'retry', '--adapter', 'claude',
      '--gate-answer', 'abort',
    ]);
    expect(parsed.flags[GATE_ANSWER]).toStrictEqual(['advance', 'retry', 'abort']);
    // The discriminating half: every other flag is last-wins, so `mock` is gone (Q-0033).
    expect(parsed.flags.adapter).toBe('claude');
  });

  test('3 — gateAnswers is a copy, so consuming it does not disturb the flag', () => {
    const parsed = parseArgv(['--gate-answer', 'advance', '--gate-answer', 'retry']);
    expect(parsed.gateAnswers).toStrictEqual(['advance', 'retry']);
    expect(parsed.gateAnswers).not.toBe(parsed.flags[GATE_ANSWER]);
  });

  test('3 — a bare --gate-answer accumulates true, and is not dropped', () => {
    expect(parseArgv(['--gate-answer', '--json']).gateAnswers).toStrictEqual([true]);
  });

  test('a valueless flag does not consume the token after it, for every member of the set', () => {
    // **The defect this closes, measured on the real commands before it was fixed**: `--json`,
    // `--verbose`, `--dry` and `--auto` each took the positional that followed them, so
    // `quorum runs --json Q-0124` listed every run with `rest` empty, and `quorum run --dry chore
    // Q-0124` lost the flow name. The operator typed a token and the parser discarded it in silence.
    //
    // Pinned per member rather than once, so the set's *effect* is checked even though its
    // membership is hand-maintained — see {@link VALUELESS}, which states that residual.
    for (const flag of ['auto', 'dry', 'help', 'json', 'no-open', 'probe', 'verbose']) {
      const parsed = parseArgv(['board', `--${flag}`, 'Q-0124']);
      expect(parsed.flags[flag], `--${flag} took a value`).toBe(true);
      expect(parsed.rest, `--${flag} swallowed the positional after it`).toStrictEqual(['Q-0124']);
    }
  });

  test('and a flag that DOES take a value still takes it, so the fix discriminates', () => {
    // The other direction, without which the clause above is satisfied by a parser that never
    // consumes anything. `--adapter`, `--base`, `--project`, `--port`, `--owner` and `--intent` all
    // carry values, and `--gate-answer` carries one and accumulates.
    for (const flag of ['adapter', 'base', 'project', 'port', 'owner', 'intent']) {
      const parsed = parseArgv(['run', `--${flag}`, 'value']);
      expect(parsed.flags[flag], `--${flag} stopped taking its value`).toBe('value');
      expect(parsed.rest, `--${flag} left its value as a positional`).toStrictEqual([]);
    }
    expect(parseArgv(['run', '--gate-answer', 'advance']).gateAnswers).toStrictEqual(['advance']);
  });

  test('4 — a single-dash token is a positional, not a flag', () => {
    // Why: preserved defect, see Q-0090 AC-2 behaviour 4. The test is `startsWith('--')` and
    // nothing else, so `-v` lands in `rest` where a well-behaved parser would read it as a flag.
    const parsed = parseArgv(['board', '-v', '-1']);
    expect(parsed.cmd).toBe('board');
    expect(parsed.rest).toStrictEqual(['-v', '-1']);
    expect(parsed.flags).toStrictEqual({});
  });

  test('5 — a bare -- is a flag named the empty string, and swallows what follows it', () => {
    // Why: preserved defect, see Q-0090 AC-2 behaviour 5. `--` terminates nothing: it slices to
    // `''` and takes `board` as its value, so the command line has no command at all.
    const parsed = parseArgv(['--', 'board', 'Q-0090']);
    expect(parsed.flags).toStrictEqual({ '': 'board' });
    expect(parsed.cmd).toBe('Q-0090');
    expect(parsed.rest).toStrictEqual([]);
  });

  test('6 — a value is the token as it was typed, and nothing is coerced to a number', () => {
    const parsed = parseArgv(['--limit', '10', '--ratio', '0.5', '--zero', '0']);
    expect(parsed.flags).toStrictEqual({ limit: '10', ratio: '0.5', zero: '0' });
    for (const value of Object.values(parsed.flags)) expect(typeof value).toBe('string');
  });

  test('7 — repeated positionals are all kept, and nothing is de-duplicated', () => {
    const parsed = parseArgv(['runs', 'Q-0090', 'Q-0090', 'Q-0090']);
    expect(parsed.rest).toStrictEqual(['Q-0090', 'Q-0090', 'Q-0090']);
  });
});

describe('AC-2 — the whole shape, on the command line the run command will be given', () => {
  test('flags, positionals and gate answers are read off one argv together', () => {
    expect(parseArgv([
      'run', 'chore', 'Q-0090', '--adapter', 'mock', '--dry',
      '--gate-answer', 'advance', '--base', 'main',
    ])).toStrictEqual({
      cmd: 'run',
      rest: ['chore', 'Q-0090'],
      flags: { adapter: 'mock', dry: true, [GATE_ANSWER]: ['advance'], base: 'main' },
      gateAnswers: ['advance'],
    });
  });
});
