/**
 * Q-0090 AC-3, colour half — the six functions emit the escape sequences `spike/bin/harness.js:44`
 * emits, and the two limits that come with them are registered rather than closed.
 */
import { describe, expect, test } from 'vitest';

import { c } from './colour.js';

/** Every function, with the sequence read off the spike's single declaration line. */
const PALETTE: readonly [keyof typeof c, string][] = [
  ['dim', '\x1b[2m'],
  ['bold', '\x1b[1m'],
  ['amber', '\x1b[33m'],
  ['green', '\x1b[32m'],
  ['red', '\x1b[31m'],
  ['teal', '\x1b[36m'],
];

describe('AC-3 — the palette', () => {
  test.each(PALETTE)('c.%s opens with its own sequence and closes with the reset', (name, open) => {
    expect(c[name]('x')).toBe(`${open}x\x1b[0m`);
  });

  test('the helper is exactly these six functions', () => {
    expect(Object.keys(c).sort()).toStrictEqual(['amber', 'bold', 'dim', 'green', 'red', 'teal']);
    expect(PALETTE).toHaveLength(Object.keys(c).length);
  });

  test('each sequence is distinct, so a copied code would be caught rather than pass twice', () => {
    expect(new Set(PALETTE.map(([, open]) => open)).size).toBe(PALETTE.length);
  });

  test('an empty body still carries both sequences, and nothing is trimmed away', () => {
    expect(c.red('')).toBe('\x1b[31m\x1b[0m');
  });
});

describe('AC-3 — the two limits, reported and not fixed', () => {
  test('there is no TTY test: the escapes are emitted whether stdout is a terminal or not', () => {
    // Why: preserved, see Q-0090 AC-3. The spike writes these into a pipe or a file unchanged, and
    // a colour policy is Q-0090's non-goal 11 rather than something to invent here. Demonstrated
    // over both states this test sets itself, so the verdict is a property of the code and never of
    // the terminal the suite happens to be run from.
    const saved = process.stdout.isTTY;
    try {
      process.stdout.isTTY = false;
      expect(c.green('ok')).toBe('\x1b[32mok\x1b[0m');
      process.stdout.isTTY = true;
      expect(c.green('ok')).toBe('\x1b[32mok\x1b[0m');
    } finally {
      process.stdout.isTTY = saved;
    }
  });

  test('neither NO_COLOR nor FORCE_COLOR changes the output', () => {
    const saved = { no: process.env.NO_COLOR, force: process.env.FORCE_COLOR };
    try {
      process.env.NO_COLOR = '1';
      process.env.FORCE_COLOR = '0';
      expect(c.red('✗ ')).toBe('\x1b[31m✗ \x1b[0m');
    } finally {
      if (saved.no === undefined) delete process.env.NO_COLOR;
      else process.env.NO_COLOR = saved.no;
      if (saved.force === undefined) delete process.env.FORCE_COLOR;
      else process.env.FORCE_COLOR = saved.force;
    }
  });
});
