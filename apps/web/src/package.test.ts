/**
 * Q-0014 AC-1, AC-3 — what this package depends on, why each one is here, and what compiles it.
 *
 * ON AC-1's INSTRUMENT, stated rather than quietly substituted. The criterion's *Test:* clause asks
 * that every declared dependency "appears in the implement report's justification list". No test
 * can read that: the report is written by the engine AFTER this step finishes, into a run-scoped
 * path under `backlog/`, which is a surface no role may write and which does not exist while the
 * suite runs. So the list is held HERE, in {@link JUSTIFICATIONS}, checked against the manifest in
 * both directions, and the implement report reproduces it — which is what the criterion's normative
 * half actually asks for, and what `packages/server/src/package.test.ts` already does for Q-0118's
 * three. A list nobody can read is not a check.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, test } from 'vitest';

/** This package's root: `apps/web/src/` → one level up. Nothing here climbs out of the package. */
const PACKAGE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** As much of a manifest as these assertions read. */
interface Manifest {
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

const readPackageFile = (relative: string): string => fs.readFileSync(path.join(PACKAGE, relative), 'utf8');

const manifest = (): Manifest => JSON.parse(readPackageFile('package.json')) as Manifest;

/**
 * One line per dependency, which `.claude/rules/engineering.md` asks for and AC-1 makes checkable.
 *
 * The set is asserted against the manifest in BOTH directions below, so a dependency added without
 * a reason fails, and a reason left behind by a dependency that has gone fails too.
 */
const JUSTIFICATIONS: Record<string, string> = {
  react: 'the UI framework docs/04-architecture.md:182 names; nothing here is a second choice of framework.',
  'react-dom': "React's renderer for a browser document — the half that actually mounts, and what AC-2's smoke test drives.",
  '@vitejs/plugin-react': 'teaches this package\'s Vite build to compile JSX; without it no .tsx file is transformed at all.',
  tailwindcss: 'the styling system docs/04-architecture.md:182 names, and where the palette is declared as theme tokens.',
  '@tailwindcss/vite': "Tailwind v4's Vite integration; v4 is a Vite plugin rather than a PostCSS step, so this is how it runs at all.",
  jsdom: "the document AC-2 mounts into, selected by one test file's own environment docblock rather than by configuration.",
  '@types/react': "React ships no types of its own, so this is what makes `tsc --noEmit` cover the app's components.",
  '@types/react-dom': 'the same, for the renderer half.',
};

/**
 * The credential literals no file here may carry, assembled so this file is not its own subject.
 *
 * The scan below covers every file in the package, this one included — which it must, since a test
 * fixture is as good a place to leak a key as a source file — so a written-out needle would report
 * the check itself and the check would be deleted rather than obeyed.
 */
const CREDENTIAL_LITERALS: string[] = [
  ...['ANTHROPIC', 'OPENAI', 'CODEX'].map((vendor) => `${vendor}_API${'_KEY'}`),
  `api${'Key'}`,
  `api${'_key'}`,
];

/** Directories that are not this package's source, whatever they contain. */
const NOT_OURS = new Set(['node_modules', 'dist', '.turbo', '.vite']);

/** Every file in the package, as `[relative path, text]`. Configuration included, per AC-1. */
function packageFiles(): [string, string][] {
  const walk = (absolute: string, below: string): [string, string][] =>
    fs.readdirSync(absolute, { withFileTypes: true }).flatMap((entry) => {
      if (NOT_OURS.has(entry.name)) return [];
      const next = below === '' ? entry.name : `${below}/${entry.name}`;
      if (entry.isDirectory()) return walk(path.join(absolute, entry.name), next);
      return [[next, fs.readFileSync(path.join(absolute, entry.name), 'utf8')] as [string, string]];
    });
  return walk(PACKAGE, '').sort(([a], [b]) => a.localeCompare(b));
}

describe('AC-1 — the manifest declares what it needs, each with a reason', () => {
  test('every declared dependency carries a justification, and every justification a dependency', () => {
    const own = manifest();
    const declared = [...Object.keys(own.dependencies ?? {}), ...Object.keys(own.devDependencies ?? {})].sort();
    expect(declared.length, 'the manifest declares nothing — this check has lost its subject').toBeGreaterThan(0);
    expect(Object.keys(JUSTIFICATIONS).sort()).toStrictEqual(declared);
    for (const [name, reason] of Object.entries(JUSTIFICATIONS)) {
      expect(reason.length, `${name} carries an empty justification`).toBeGreaterThan(20);
    }
  });

  test('the two that ship to a browser are dependencies, and the build-time ones are not', () => {
    // The division is the claim: what a bundle contains against what only builds or tests it.
    const own = manifest();
    expect(Object.keys(own.dependencies ?? {}).sort()).toStrictEqual(['react', 'react-dom']);
    expect(Object.keys(own.devDependencies ?? {})).not.toContain('react');
  });

  test('no file in this package names a credential, and the scan has a subject', () => {
    // BYOS, at the surface furthest from an adapter: the browser holds no credential, because what
    // authenticates an agent is a subscription the vendor's own CLI already owns.
    const files = packageFiles();
    expect(files.length, 'the walk found nothing — this scan proves nothing').toBeGreaterThan(1);
    expect(CREDENTIAL_LITERALS.length).toBe(5);
    for (const [name, text] of files) {
      for (const literal of CREDENTIAL_LITERALS) {
        expect(text.includes(literal), `${name} names ${literal}`).toBe(false);
      }
    }
  });

  test('and the credential scan discriminates — the same needles find one when it is there', () => {
    // An empty answer above must be an absence rather than a needle that matches nothing.
    const leak = `const client = { ${CREDENTIAL_LITERALS[3]}: process.env.${CREDENTIAL_LITERALS[0]} };`;
    expect(CREDENTIAL_LITERALS.filter((literal) => leak.includes(literal))).toHaveLength(2);
  });
});

describe('AC-3 — the compiler covers every new file, and relaxes nothing the base decides', () => {
  const tsconfig = (): { compilerOptions?: Record<string, unknown>; extends?: string } =>
    JSON.parse(readPackageFile('tsconfig.json')) as { compilerOptions?: Record<string, unknown>; extends?: string };

  test('it extends the one base and adds what a React app needs on top', () => {
    const own = tsconfig();
    expect(own.extends, 'the package stopped extending the single strict base').toBe('../../tsconfig.base.json');
    const options = own.compilerOptions ?? {};
    expect(options.jsx, 'no jsx setting, so no .tsx file compiles').toBeDefined();
    expect((options.lib as string[] | undefined)?.map((entry) => entry.toLowerCase()),
      'no DOM library, so `document` does not exist to the compiler').toContain('dom');
  });

  test('and it overrides nothing in the strict family', () => {
    // The one property the base exists to guarantee. A local `strict: false` — or any single
    // `strict*` flag turned off beside it — would leave this package compiling under different
    // rules from every other, silently.
    const options = tsconfig().compilerOptions ?? {};
    expect(options.strict, 'strict is overridden locally').toBeUndefined();
    expect(Object.keys(options).filter((key) => key.startsWith('strict')),
      'a strict-family flag is set locally').toStrictEqual([]);
  });

  test('the package still declares the three tasks every package owes', () => {
    // And no `build`: this package emits nothing, which is what keeps the emitting register at
    // three. Whether a served bundle is an emitted artifact at all is Q-0122's, with the task.
    const scripts = manifest().scripts ?? {};
    for (const task of ['lint', 'typecheck', 'test']) {
      expect(scripts[task] ?? '', `no ${task} script`).not.toBe('');
    }
    expect(scripts.build, 'this package declares a build script and emits nothing').toBeUndefined();
  });
});
