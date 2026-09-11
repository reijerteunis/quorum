/**
 * Q-0014 AC-5, AC-9, AC-10 — what this app's source may reach for, may name, and may colour.
 *
 * Three scans over one corpus, each in the shape `packages/shared/src/index.test.ts` already uses
 * for the same question one package down. Every needle that would otherwise match this file is
 * ASSEMBLED at run time, for the reason that file gives: the scans cover every file under `src`,
 * this one included, so a written-out needle would report the check itself and the check would be
 * weakened rather than the code fixed.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, test } from 'vitest';

/** This package's source directory, and the package root above it. */
const SOURCE = path.dirname(fileURLToPath(import.meta.url));
const PACKAGE = path.resolve(SOURCE, '..');

/** Directories that are not this package's source, whatever they contain. */
const NOT_OURS = new Set(['node_modules', 'dist', '.turbo', '.vite']);

/** Every file below `absolute`, as `[relative path, text]`. */
function filesBelow(absolute: string): [string, string][] {
  const walk = (at: string, below: string): [string, string][] =>
    fs.readdirSync(at, { withFileTypes: true }).flatMap((entry) => {
      if (NOT_OURS.has(entry.name)) return [];
      const next = below === '' ? entry.name : `${below}/${entry.name}`;
      if (entry.isDirectory()) return walk(path.join(at, entry.name), next);
      return [[next, fs.readFileSync(path.join(at, entry.name), 'utf8')] as [string, string]];
    });
  return walk(absolute, '').sort(([a], [b]) => a.localeCompare(b));
}

/** Every file under `src`, tests included. */
const sourceFiles = (): [string, string][] => filesBelow(SOURCE);

/** Every file under `src` that SHIPS — what a bundle would carry, so tests are not among them. */
const shippingFiles = (): [string, string][] =>
  sourceFiles().filter(([name]) => (name.endsWith('.ts') || name.endsWith('.tsx')) && !name.endsWith('.test.ts'));

/**
 * Every module specifier `text` imports or re-exports.
 *
 * Byte-identical in shape to `packages/shared/test/corpus.ts`'s, including the required whitespace
 * between the keyword and the quote — without it a prose string ending in the word "import" and its
 * own closing quote reads as an import statement.
 */
const importSpecifiers = (text: string): string[] =>
  [...text.matchAll(/\b(?:from|import)\s+['"]([^'"\n]+)['"]/g)].map((match) => match[1]);

describe('AC-5 — no shipping file reaches for something a browser does not have', () => {
  /** The same list `packages/shared/src/index.test.ts` uses, for the same question. */
  const BUILTINS = [
    'assert', 'buffer', 'child_process', 'crypto', 'events', 'fs', 'http', 'https', 'module', 'net',
    'os', 'path', 'process', 'readline', 'stream', 'url', 'util', 'worker_threads', 'zlib',
  ];

  /** Assembled, because this file imports two of the very things it forbids the app from importing. */
  const NODE_PREFIX = `${'node'}:`;
  const CORE_PACKAGE = `@${'quorum'}/core`;

  test('the walk finds shipping files at all', () => {
    // The positive control. Every failure mode of a walk hides files rather than inventing them, so
    // a clause that had lost its subject would report success over an empty list.
    expect(shippingFiles().length, 'the walk finds no shipping source — this scan proves nothing')
      .toBeGreaterThan(5);
    expect(shippingFiles().map(([name]) => name)).toContain('app.tsx');
  });

  test('no Node builtin, under either spelling', () => {
    for (const [name, text] of shippingFiles()) {
      for (const specifier of importSpecifiers(text)) {
        expect(specifier.startsWith(NODE_PREFIX), `${name} imports ${specifier}`).toBe(false);
        expect(BUILTINS.includes(specifier), `${name} imports ${specifier}`).toBe(false);
      }
    }
  });

  test('and no import of the engine, which is a server-side package all the way down', () => {
    // `@quorum/core` opens files, spawns processes and runs git. A browser bundle that reached it
    // would not merely be large; it would be a second implementation of the boundary
    // `04-architecture.md` draws, on the wrong side of a network.
    for (const [name, text] of shippingFiles()) {
      for (const specifier of importSpecifiers(text)) {
        expect(specifier === CORE_PACKAGE || specifier.startsWith(`${CORE_PACKAGE}/`), `${name} imports ${specifier}`)
          .toBe(false);
      }
    }
  });

  test('the clause has a subject — the same scan reports both when they are there', () => {
    const fixture = `import fs from '${NODE_PREFIX}fs';\nimport { runFlow } from '${CORE_PACKAGE}';\n`;
    expect(importSpecifiers(fixture)).toStrictEqual([`${NODE_PREFIX}fs`, CORE_PACKAGE]);
  });
});

describe('AC-9 — the app names no project it has not been given', () => {
  /**
   * The design brief's own fake data, assembled so this scan covers its own file.
   *
   * `docs/05-design-prompt.md` populates a mockup with three project names, and a mockup's data
   * inside a real app is a claim the product cannot back. The SaaS names are
   * `.claude/rules/product-boundaries.md`'s rule rather than a style preference: nothing in this
   * repository references a specific product except as an example name in demo data, and this app
   * has no demo data.
   */
  const FORBIDDEN_NAMES = [
    `acme${'-billing'}`,
    `heyruud${'.com'}`,
    `northwind${'-crm'}`,
    `feed${'mind'}`,
    `flex${'tann'}`,
  ];

  test('no mockup project name and no product name appears under src', () => {
    const files = sourceFiles();
    expect(files.length, 'the walk found nothing').toBeGreaterThan(1);
    for (const [name, text] of files) {
      for (const forbidden of FORBIDDEN_NAMES) {
        expect(text.includes(forbidden), `${name} names ${forbidden}`).toBe(false);
      }
    }
  });

  test('and the scan discriminates — the same needles find one when it is there', () => {
    const fixture = `const project = '${FORBIDDEN_NAMES[0]}';`;
    expect(FORBIDDEN_NAMES.filter((forbidden) => fixture.includes(forbidden))).toStrictEqual([FORBIDDEN_NAMES[0]]);
  });
});

describe('AC-10 — the palette is defined once, and no component names a colour', () => {
  /** The one file a colour may be written in. Named here, and asserted to exist and to be real. */
  const PALETTE = 'theme.css';

  /** The eleven semantic tokens: six this requirement extends the brief with, five it names. */
  const TOKENS = [
    '--color-bg', '--color-surface', '--color-border', '--color-text', '--color-muted', '--color-accent',
    '--color-running', '--color-waiting-on-human', '--color-passed', '--color-failed', '--color-idle',
  ];

  /** Assembled: this file would otherwise be the one place a colour function is written down. */
  const COLOUR_FUNCTIONS = ['rgb', 'rgba', 'hsl'].map((name) => `${name}${'('}`);

  /** A hex colour. The pattern is not itself one — `[` is in no hexadecimal digit class. */
  const HEX = /#[0-9a-f]{3,8}\b/i;

  const palette = (): string => fs.readFileSync(path.join(SOURCE, PALETTE), 'utf8');

  /** One token's declared value, read out of the palette rather than transcribed beside it. */
  const valueOf = (token: string): string => {
    const found = new RegExp(`${token}:\\s*([^;]+);`).exec(palette());
    if (!found) throw new Error(`${PALETTE} declares no ${token} — this check has lost its subject`);
    return found[1].trim();
  };

  test('the palette file exists, is not empty, and declares all eleven tokens', () => {
    expect(sourceFiles().map(([name]) => name), 'the one exempt file is not there').toContain(PALETTE);
    expect(palette().trim().length, 'the palette is empty').toBeGreaterThan(100);
    expect(TOKENS.length).toBe(11);
    for (const token of TOKENS) {
      expect(palette(), `the palette declares no ${token}`).toContain(`${token}:`);
    }
  });

  test('no other file under src names a colour', () => {
    const named = sourceFiles()
      .filter(([name]) => name !== PALETTE)
      .flatMap(([name, text]) => {
        const found = [...COLOUR_FUNCTIONS.filter((fn) => text.includes(fn))];
        if (HEX.test(text)) found.push('a hex literal');
        return found.map((what) => `${name}: ${what}`);
      });
    expect(named, 'a colour is written outside the palette').toStrictEqual([]);
  });

  test('and the clause has a subject — the same needles find each shape when it is there', () => {
    // Isolated over a fixture, so the emptiness above is an absence rather than four needles that
    // match nothing. The palette itself is the second witness: it holds hex values by design.
    const fixture = `a { color: ${COLOUR_FUNCTIONS[0]}1 2 3); border-color: ${'#'}0b0d10; }`;
    expect(COLOUR_FUNCTIONS.filter((fn) => fixture.includes(fn))).toStrictEqual([COLOUR_FUNCTIONS[0]]);
    expect(HEX.test(fixture)).toBe(true);
    expect(HEX.test(palette()), 'the palette holds no hex value, so the scan above excuses nothing').toBe(true);
  });

  test('the accent is teal and not amber, which the brief\'s own status table forces', () => {
    // `docs/05-design-prompt.md:17` offers "electric teal or amber — pick one" and then, in the same
    // paragraph, assigns waiting-on-human = amber and running = accent pulse. An amber accent puts
    // "a human must act" and "the machine is working" one animation apart. So the two tokens must
    // differ, and that is the property rather than the particular hex.
    expect(valueOf('--color-accent')).not.toBe(valueOf('--color-waiting-on-human'));
    expect(valueOf('--color-running'), 'running is not the accent, which the brief makes it')
      .toBe(valueOf('--color-accent'));
  });

  test('the background is near-black and desaturated rather than pure black', () => {
    // Assembled like every other needle here: written out, these two would be hex literals in a
    // file the scan above covers.
    const pureBlack = ['000', '000000'].map((digits) => `${'#'}${digits}`);
    const background = valueOf('--color-bg').toLowerCase();
    expect(pureBlack, 'the background is pure black').not.toContain(background);
    expect(background).toMatch(HEX);
  });

  test('and nothing decorative: no gradient, no glassmorphism', () => {
    for (const [name, text] of sourceFiles().filter(([file]) => file !== PALETTE)) {
      expect(text.includes(`gradient${'-to-'}`) || text.includes(`linear-${'gradient'}`),
        `${name} paints a decorative gradient`).toBe(false);
      expect(text.includes(`backdrop-${'blur'}`) || text.includes(`backdrop-${'filter'}`),
        `${name} reaches for glassmorphism`).toBe(false);
    }
  });
});

describe('AC-10 — loading the shell fetches nothing from a network', () => {
  /**
   * Assembled, for the reason every needle in this file is: the scan covers this file too.
   *
   * `docs/05-design-prompt.md:7` permits "no external assets except Google Fonts" and `:17` names
   * three third-party faces. This app diverges deliberately and says so in `theme.css`: that
   * document describes a single-file clickable mockup for visual validation, and Quorum is
   * local-first — a shell that fetches a font on every page load makes the product require the
   * internet and leaks a request off the machine.
   */
  const NETWORK_LITERALS = [`http:${'//'}`, `https:${'//'}`, `${'//'}fonts.`];

  test('no file in this package carries a URL or a font host', () => {
    const files = filesBelow(PACKAGE);
    expect(files.length, 'the walk found nothing').toBeGreaterThan(1);
    for (const [name, text] of files) {
      for (const literal of NETWORK_LITERALS) {
        expect(text.includes(literal), `${name} names ${literal}`).toBe(false);
      }
    }
  });

  test('the walk really covers the package rather than only its source', () => {
    // A font link belongs in `index.html` more naturally than anywhere else, so a scan that stopped
    // at `src/` would miss the likeliest place for the thing it forbids.
    expect(filesBelow(PACKAGE).map(([name]) => name)).toContain('index.html');
    expect(filesBelow(PACKAGE).map(([name]) => name)).toContain('package.json');
  });

  test('and the clause has a subject — the same needles find each shape when it is there', () => {
    // The exact thing the brief invites and this app refuses — a font link. It trips two of the
    // three needles at once, which is why both are named: a fixture asserted to trip one while
    // tripping two would be describing the scan wrongly.
    const fixture = `<link href="${NETWORK_LITERALS[1]}fonts.googleapis.com/css2" />`;
    expect(NETWORK_LITERALS.filter((literal) => fixture.includes(literal)))
      .toStrictEqual([NETWORK_LITERALS[1], NETWORK_LITERALS[2]]);
    expect(NETWORK_LITERALS.filter((literal) => `<a href="/backlog">`.includes(literal)),
      'a same-origin path trips the network scan').toStrictEqual([]);
  });

  test('the type stack is local system faces, named in the palette', () => {
    expect(palette(), 'no sans stack is declared').toContain('--font-sans:');
    expect(palette(), 'no mono stack is declared').toContain('--font-mono:');
    expect(palette(), 'the sans stack is not the system one').toContain('system-ui');
  });

  const palette = (): string => fs.readFileSync(path.join(SOURCE, 'theme.css'), 'utf8');
});
