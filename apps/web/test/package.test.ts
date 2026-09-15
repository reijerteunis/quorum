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

  test('Q-0124 AC-2 — nothing is a runtime dependency, because the bundle carries what it needs', () => {
    // **This clause said the opposite until Q-0124, and the inversion is a ruling rather than a
    // tidy-up.** It read *"the two that ship to a browser are dependencies, and the build-time ones
    // are not"*, whose division was *what ends up in the bundle* — under which React is a dependency
    // because it is in there. npm's division is *what must be installed beside the tarball*, and for
    // a self-contained bundle the two select **opposite** sets: nothing has to be installed beside
    // this one, because everything it needs is already inside it.
    //
    // It is latent until distribution and not before, which is what makes it this ticket's: nothing
    // packed this package, so nothing ever acted on the declaration. Packed as it stood, a consumer
    // would have installed **7.94 MB of React that the 100 K tarball already contains**. Why: *"The
    // distribution set is five, and rejoins the emitting set"* (2026-09-15), clause 5.
    //
    // The evidence for it is the emitted bundle rather than this reasoning, and it is asserted where
    // the emit is guaranteed to exist — `packages/cli/src/build.test.ts`, which runs the build. A
    // clause here reading `dist/` would have a verdict that depended on whether anyone had built.
    const own = manifest();
    expect(Object.keys(own.dependencies ?? {}), 'a runtime dependency arrived, so the tarball now obliges an install')
      .toStrictEqual([]);
    for (const name of ['react', 'react-dom', '@quorum/shared']) {
      expect(Object.keys(own.devDependencies ?? {}), `${name} is not declared as a build-time dependency`)
        .toContain(name);
    }
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

describe('the app emits, what it emits is served, and since Q-0124 a tarball carries it', () => {
  // Why: "A fourth package emits, and what it emits is served rather than shipped" (2026-09-12) for
  // the emit, and "The distribution set is five, and rejoins the emitting set" (2026-09-15) for the
  // tarball. The first replaced the two clauses that asserted the app emitted nothing; the second
  // replaced the clause that asserted nothing packed it. *Served* is unchanged by either — it names
  // the artifact's shape, and both shapes ship now.

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

  test('Q-0124 AC-1 — it emits AND is distributed, and declares exactly what a tarball needs', () => {
    // **The two sets came apart here at Q-0122 and are joined again here.** That ticket asserted no
    // `exports`, no `files`, and routed the question to Q-0124; this is the answer. Only two of the
    // five keys move: `files`, without which a tarball ships the working tree — Q-0098 measured 40
    // files against 17 — and one `exports` entry, without which `packages/cli` cannot find the
    // bundle by package name. `main`, `types` and `bin` stay absent, because nothing imports this
    // package as a module and it carries no executable.
    //
    // `private: true` **stays**, and that is the clause most likely to be misread: `pnpm pack` does
    // not refuse a private package and only `npm publish` does, so five tarballs move nothing about
    // registry-resolved `npx quorum`, which 078(d) still refuses until Q-0029. A `license` joins
    // them because the three packed before this carried one and neither new member did — latent
    // exactly while nothing packed it. Why: *"The distribution set is five, and rejoins the emitting
    // set"* (2026-09-15), clauses 2 and 3.
    const own = JSON.parse(readPackageFile('package.json')) as Record<string, unknown>;
    expect(own.private, 'the app stopped being private, which is a publishing decision 078(d) refuses').toBe(true);
    expect(own.files, 'the app declares no files allow-list, so the checkout decides the tarball')
      .toStrictEqual(['dist']);
    expect(own.license, 'a distributed package carries no licence').toBe('Apache-2.0');
    // One named locator and no `"."`, which is the refusal `packages/cli/src/package.test.ts`
    // already makes for `@quorum/core`: a `./*` key defers what a consumer may reach to whoever
    // types one first, and a `"."` would make a 317 KB bundle importable as JavaScript.
    expect(own.exports, 'the bundle locator is not the one documented entry')
      .toStrictEqual({ './bundle': './dist/index.html' });
    for (const key of ['main', 'types', 'bin', 'engines']) {
      expect(own[key], `the app declares ${key}, which a distributed-but-unpublished package does not owe`)
        .toBeUndefined();
    }
  });

  test('Q-0124 AC-1 — and the block discriminates in both directions, so deleting a clause is not satisfying it', () => {
    // **The cheapest wrong implementation of AC-1 is deleting the two clauses that now fail**, and
    // that is indistinguishable from the right one unless the pair below is asserted: the manifest
    // as it stood before this ticket must fail the NEW rule, and the manifest as it stands must fail
    // the OLD one. One predicate over three subjects, which is the shape `packages/server`'s own
    // AC-3 block adopted after its review found a fixture asserted against itself.
    const distributed = (candidate: Record<string, unknown>): string[] => [
      candidate.private !== true ? 'the package stopped being private' : '',
      candidate.files === undefined ? 'no files allow-list, so the checkout decides the tarball' : '',
      candidate.license === undefined ? 'no licence on a package a tarball carries' : '',
      candidate.exports === undefined ? 'no locator, so nothing can find the bundle by package name' : '',
      candidate.bin !== undefined ? 'a bin entry on a package that carries no executable' : '',
    ].filter((problem) => problem !== '');

    const own = JSON.parse(readPackageFile('package.json')) as Record<string, unknown>;
    expect(distributed(own), 'the shipped manifest does not satisfy the rule this block states').toStrictEqual([]);

    // The manifest as Q-0122 left it: emitting, and claiming no tarball.
    const asItWas: Record<string, unknown> = { ...own };
    delete asItWas.files;
    delete asItWas.license;
    delete asItWas.exports;
    expect(distributed(asItWas), 'the pre-Q-0124 manifest passes the rule that replaced it')
      .toStrictEqual([
        'no files allow-list, so the checkout decides the tarball',
        'no licence on a package a tarball carries',
        'no locator, so nothing can find the bundle by package name',
      ]);
    // And the other direction, over the same predicate: the old rule refused exactly the keys the
    // new one requires, so a reader cannot take the inversion for a relaxation.
    const undistributed = (candidate: Record<string, unknown>): string[] =>
      ['exports', 'files'].filter((key) => candidate[key] !== undefined);
    expect(undistributed(own), 'the shipped manifest still satisfies the rule Q-0122 landed')
      .toStrictEqual(['exports', 'files']);
    expect(undistributed(asItWas), 'the fixture no longer reproduces what Q-0122 asserted').toStrictEqual([]);
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
