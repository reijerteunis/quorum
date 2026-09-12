/**
 * Q-0014 AC-1, AC-2, AC-3 — what this package depends on, why each one is here, what compiles it,
 * and that every test in it is named where the workspace's discovery guard can see it.
 *
 * It sits in `test/` rather than in `src/` because it reads the filesystem, and AC-5's subject is
 * every file under `src`. See `test/source.test.ts`'s header for the whole of that reasoning and
 * the `packages/shared/test/corpus.ts` precedent it follows.
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
import { wireMessageSchema } from '@quorum/shared';

/** This package's root: `apps/web/test/` → one level up. Nothing here climbs out of the package. */
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
  '@quorum/shared': 'the browser executes the shared wire and event schemas so incoming daemon frames are parsed rather than cast.',
  react: 'the UI framework docs/04-architecture.md:182 names; nothing here is a second choice of framework.',
  'react-dom': "React's renderer for a browser document — the half that actually mounts, and what AC-2's smoke test drives.",
  '@vitejs/plugin-react': 'teaches this package\'s Vite build to compile JSX; without it no .tsx file is transformed at all.',
  tailwindcss: 'the styling system docs/04-architecture.md:182 names, and where the palette is declared as theme tokens.',
  '@tailwindcss/vite': "Tailwind v4's Vite integration; v4 is a Vite plugin rather than a PostCSS step, so this is how it runs at all.",
  jsdom: "the document AC-2 mounts into, selected by one test file's own environment docblock rather than by configuration. Held at 29 rather than 30 because jsdom 30 declares `node: ^22.22.2 || ^24.15.0 || >=26.0.0`, which this workspace's own `engines.node` floor of 22.13.0 does not satisfy; 29's `^20.19.0 || ^22.13.0 || >=24.0.0` matches that floor exactly.",
  '@types/react': "React ships no types of its own, so this is what makes `tsc --noEmit` cover the app's components.",
  '@types/react-dom': 'the same, for the renderer half.',
  vite: "the bundler the build script runs, and the dev server vite.config.ts configures. Declared here at Q-0122 rather than left to resolve from the workspace root by directory walk: this is the package the build runs in, both plugins above take vite as a peer, and a dependency reached by walking up is one no manifest records. Held at the root's own ^8.2.2 so one version resolves.",
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
    expect(Object.keys(own.dependencies ?? {}).sort()).toStrictEqual(['@quorum/shared', 'react', 'react-dom']);
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

describe('Q-0120 AC-22 — browser source resolution', () => {
  test('the shared runtime value resolves through the workspace source condition', () => {
    expect(typeof wireMessageSchema.safeParse).toBe('function');
    expect(import.meta.resolve('@quorum/shared')).toContain('/packages/shared/src/index.ts');
  });
  test('Vite adds quorum-source to, rather than replacing, its client defaults', () => {
    const config = readPackageFile('vite.config.ts');
    expect(config).toContain('defaultClientConditions');
    expect(config).toContain('quorum-source');
    expect(config).toMatch(/conditions\s*:\s*\[\s*\.\.\.defaultClientConditions/);
  });

});

describe('Q-0122 — the app emits, and what it emits is served rather than shipped', () => {
  // Why: "A fourth package emits, and what it emits is served rather than shipped" (2026-09-12).
  // This block replaces the two clauses that asserted the opposite — `the app remains non-emitting`
  // here, and the `build` half of AC-3's task clause below — which were correct until that entry.

  test('it declares a build script, and one that clears its emit first', () => {
    const build = manifest().scripts?.build;
    expect(build, 'the app declares no build script, so nothing produces a bundle to serve').toBeDefined();
    // Turbo prunes an output directory on neither the miss path nor the hit path, so something in
    // the script has to, or a rebuild leaves behind whatever the current source no longer produces.
    // The three `tsc` emitters get that from `rm -rf dist &&` and nothing else; **this one gets it
    // from Vite, which empties `outDir` itself** — measured by mutation, and the reason the pin
    // below is uniformity rather than the mechanism. It is kept because a default a bundler owns is
    // a thing that can move, and because four scripts that clear their emit the same way are easier
    // to reason about than three that do and one that is fine for a different reason.
    // `build.test.ts` runs the case, over every emitter, and records the same measurement.
    expect(build, 'the clean step went, leaving the property resting on a bundler default alone').toMatch(/^rm -rf dist &&/);
  });

  test('and it emits without being distributed — no exports, files, main, types or bin', () => {
    // The two sets came apart here, which is the entry's first clause: four packages emit and three
    // are packed. Asserted on the manifest rather than left to prose, because every one of these
    // five keys is a step towards a tarball and none of them is this ticket's to add. How an
    // installation outside this workspace obtains the UI is Q-0124's, and nothing here answers it.
    const own = JSON.parse(readPackageFile('package.json')) as Record<string, unknown>;
    expect(own.private, 'the app stopped being private, which is a publishing decision 078(d) refuses').toBe(true);
    for (const key of ['exports', 'files', 'main', 'types', 'bin']) {
      expect(own[key], `the app declares ${key}, so something now resolves or packs it`).toBeUndefined();
    }
  });
});

describe('AC-2 — every test file is named where the discovery guard can see it', () => {
  /**
   * What Vitest's own include would run, transcribed as a pattern from
   * `configDefaults.include`'s `**\/*.{test,spec}.?(c|m)[jt]s?(x)`.
   *
   * It is deliberately WIDER than the suffix the clause below demands, and the gap between the two
   * is the whole subject: a `.test.tsx` here would be executed by Vitest, be invisible to
   * `testFilesIn` in `packages/core/src/test-discovery.test.ts` — which matches `.test.ts` only —
   * and be hashed by no turbo input, `packages/core/turbo.json` declaring `../../apps/*\/**\/*.test.ts`
   * and nothing wider. Running, unseen and uncached, is three ways of being outside the guards.
   * R-3 registers the alternative, which is widening `testFilesIn`; that is `packages/core`'s
   * surface, so this ticket is bounded by the naming rule instead and this is where it is enforced.
   */
  const COLLECTED_BY_VITEST = /\.(?:test|spec)\.(?:[cm]?[jt]sx?)$/;

  const testFiles = (): string[] => packageFiles().map(([name]) => name).filter((name) => COLLECTED_BY_VITEST.test(name));

  test('every test file this package holds ends .test.ts', () => {
    const found = testFiles();
    expect(found.length, 'the walk found no test file — this clause proves nothing').toBeGreaterThan(3);
    // Both directories, named: the walk must reach the browser source tree AND the one beside it,
    // or "every test file" is a claim about whichever half it happened to open.
    expect(found, 'the walk does not reach src').toContain('src/shell.test.ts');
    expect(found, 'the walk does not reach test').toContain('test/source.test.ts');
    expect(found.filter((name) => !name.endsWith('.test.ts')),
      'a test file is named so that testFilesIn and the apps turbo glob cannot see it').toStrictEqual([]);
  });

  test('and the collector is wider than the suffix, so the clause above is not a tautology', () => {
    // Without this, `COLLECTED_BY_VITEST` could be `/\.test\.ts$/` and the clause above would be
    // "every file ending .test.ts ends .test.ts" — green forever, including over the `.test.tsx`
    // it exists to refuse.
    const wouldRun = ['x.test.tsx', 'x.spec.ts', 'x.test.js', 'x.test.mts', 'x.test.ts'];
    for (const name of wouldRun) expect(COLLECTED_BY_VITEST.test(name), `${name} is not collected`).toBe(true);
    expect(wouldRun.filter((name) => name.endsWith('.test.ts')), 'the suffix excuses more than one shape')
      .toStrictEqual(['x.test.ts']);
    expect(COLLECTED_BY_VITEST.test('router.ts'), 'the collector matches a file Vitest would not run').toBe(false);
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

  test('the package declares every task the root asks of an emitting package', () => {
    // Four now rather than three: `build` joined them at Q-0122, which is what took the emitting
    // register from three entries to four. The authority for a package that emits and is not
    // packed is "A fourth package emits, and what it emits is served rather than shipped"
    // (2026-09-12); the block above asserts the not-packed half.
    const scripts = manifest().scripts ?? {};
    for (const task of ['build', 'lint', 'typecheck', 'test']) {
      expect(scripts[task] ?? '', `no ${task} script`).not.toBe('');
    }
  });
});
