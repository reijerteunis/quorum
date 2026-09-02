/**
 * Q-0097 AC-10 and AC-11 — a changed input cannot execute a stale artifact, and a build does not
 * depend on leftovers.
 *
 * **Why a fixture and not this workspace** (merged requirement OQ-1). AC-10 mutates a source file
 * and AC-11 removes an entry point. Doing either to this checkout is a test with a side effect on
 * the tree it is judging, which Q-0073 rejected by name; `src/build.test.ts` may write `dist/`
 * because that is gitignored output *"a repository it built itself"*, and neither of these is that.
 * So both run in a throwaway workspace, whose `build` task definition is **read out of this
 * repository's root `turbo.json`** rather than retyped — the pattern `test-command.test.ts`'s
 * `seenBy` already establishes, and for the reason its comment gives: running this repository's own
 * build instead would make the check mutate the tree it is asserting over.
 *
 * **The residue is stated rather than left to be found.** A fixture proves turbo's replay semantics
 * faithfully and proves nothing about this workspace's wiring, which is why `src/build.test.ts`
 * performs the real round trip — build, delete the emit, replay, import — against the real packages.
 *
 * **What the fixture measured that no document predicted** is in AC-11: turbo does **not** prune an
 * existing output directory, on either path. On a cache miss it runs the script over whatever is
 * there, and on a cache **hit** it extracts the cached entry *over* the existing tree. So an emitted
 * file whose source has gone survives both, and the emitting packages' build scripts remove their
 * own `dist/` before `tsc` runs for exactly that reason.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, describe, expect, test } from 'vitest';

const PACKAGE = fileURLToPath(new URL('..', import.meta.url));
const WORKSPACE = path.resolve(PACKAGE, '..', '..');

const created: string[] = [];
afterAll(() => {
  for (const dir of created.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

const read = (...parts: string[]): string => fs.readFileSync(path.join(...parts), 'utf8');

/** The `build` task exactly as this repository declares it, so the fixture cannot drift from it. */
const buildTask = (): unknown =>
  (JSON.parse(read(WORKSPACE, 'turbo.json')) as { tasks: Record<string, unknown> }).tasks.build;

/** The `build` script exactly as an emitting package declares it, likewise read rather than retyped. */
const buildScript = (): string =>
  ((JSON.parse(read(WORKSPACE, 'packages', 'shared', 'package.json')) as { scripts: Record<string, string> }).scripts).build;

const turboBin = (): string => {
  const bin = path.join(WORKSPACE, 'node_modules/.bin/turbo');
  if (!fs.existsSync(bin)) throw new Error(`corpus missing: ${bin} — install the workspace before asserting what turbo builds`);
  return bin;
};

/** The real `tsc` this workspace installs, reached by absolute path because the fixture installs nothing. */
const tscBin = (): string => {
  const bin = path.join(WORKSPACE, 'node_modules/typescript/bin/tsc');
  if (!fs.existsSync(bin)) throw new Error(`corpus missing: ${bin} — the fixture builds with this workspace's own compiler`);
  return bin;
};

const write = (file: string, body: string): void => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, body);
};

/**
 * A throwaway npm workspace with one emitting package, carrying this repository's own `build` task
 * definition and its own build script, differing only where the fixture must name an absolute `tsc`.
 *
 * @param sources the package's `src`, as `[file name, contents]`.
 */
function fixture(sources: Record<string, string>): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'q0097-build-'));
  created.push(root);
  write(path.join(root, 'package.json'), JSON.stringify({
    name: 'q0097-fixture', private: true, packageManager: 'npm@11.0.0', workspaces: ['emitter'],
  }));
  write(path.join(root, 'package-lock.json'), JSON.stringify({
    name: 'q0097-fixture', lockfileVersion: 3, requires: true,
    packages: { '': { name: 'q0097-fixture', workspaces: ['emitter'] }, emitter: {} },
  }));
  write(path.join(root, 'turbo.json'), JSON.stringify({
    $schema: 'https://turbo.build/schema.json', tasks: { build: buildTask() },
  }));
  // The shipped script with `tsc` made absolute: the fixture installs nothing, so a bare `tsc` would
  // resolve to whatever is on the machine's PATH — which is the machine deciding a verdict.
  write(path.join(root, 'emitter/package.json'), JSON.stringify({
    name: 'emitter', version: '0.0.0', private: true, type: 'module',
    scripts: { build: buildScript().replace(/(^|&&\s*)tsc\b/, `$1${JSON.stringify(tscBin())}`) },
  }));
  write(path.join(root, 'emitter/tsconfig.json'), JSON.stringify({
    compilerOptions: { target: 'es2023', module: 'nodenext', moduleResolution: 'nodenext', strict: true },
  }));
  write(path.join(root, 'emitter/tsconfig.build.json'), JSON.stringify({
    extends: './tsconfig.json',
    compilerOptions: { outDir: 'dist', rootDir: 'src', declaration: true, noEmit: false },
    include: ['src/**/*.ts'],
    exclude: ['src/**/*.test.ts'],
  }));
  for (const [name, body] of Object.entries(sources)) write(path.join(root, 'emitter/src', name), body);
  return root;
}

/** Runs the fixture's `build` through the real turbo, and reports whether the task was a cache hit. */
function build(root: string): { hit: boolean; output: string } {
  const env = { ...process.env };
  // The outer invocation of this suite is `turbo run test --force`; a leaked force would decide the
  // fixture's cache verdict instead of the fixture doing so (Q-0079).
  delete env.TURBO_FORCE;
  const output = execFileSync(turboBin(), ['run', 'build', '--dry=json'], {
    cwd: root, encoding: 'utf8', env, stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024,
  });
  const planned = (JSON.parse(output) as { tasks: { cache?: { status?: string } }[] }).tasks[0];
  const run = execFileSync(turboBin(), ['run', 'build'], {
    cwd: root, encoding: 'utf8', env, stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024,
  });
  return { hit: planned.cache?.status === 'HIT', output: run };
}

/** Imports the fixture's emitted entry point in a plain `node` process and reports what it exports. */
const valueOf = (root: string, expression: string): string => execFileSync(
  process.execPath,
  ['--input-type=module', '-e', `const m = await import(${JSON.stringify(`${path.join(root, 'emitter/dist/index.js')}`)}); console.log(String(${expression}))`],
  { cwd: root, encoding: 'utf8' },
).trim();

const emitted = (root: string): string[] => {
  const dir = path.join(root, 'emitter/dist');
  return fs.existsSync(dir) ? fs.readdirSync(dir).sort() : [];
};

describe('AC-10 — a changed input cannot execute a stale artifact', () => {
  test('a rebuilt package executes the new source, not the artifact from the old one', () => {
    // The claim is about what runs, not about what turbo reported: a miss that wrote nothing and a
    // hit that restored the previous artifact are indistinguishable from the summary alone.
    const root = fixture({ 'index.ts': "export const VALUE = 'first';\n" });
    build(root);
    expect(valueOf(root, 'm.VALUE')).toBe('first');

    write(path.join(root, 'emitter/src/index.ts'), "export const VALUE = 'second';\n");
    const second = build(root);
    expect(second.hit, 'a changed source was served from cache — the hash does not cover the source').toBe(false);
    expect(valueOf(root, 'm.VALUE'), 'the executed artifact is the one built from the previous source').toBe('second');
  }, 300_000);

  test('and a changed build configuration moves the emit too, not only a changed source', () => {
    // `tsconfig.build.json` is a tracked build-configuration input. Turning `declaration` off is a
    // change with an effect that is observable in what the build writes, which is what AC-10 asks
    // for — and it is the input a hash keyed on sources alone would miss.
    const root = fixture({ 'index.ts': "export const VALUE = 'first';\n" });
    build(root);
    expect(emitted(root)).toStrictEqual(['index.d.ts', 'index.js']);

    const config = JSON.parse(read(root, 'emitter/tsconfig.build.json')) as { compilerOptions: Record<string, unknown> };
    config.compilerOptions.declaration = false;
    write(path.join(root, 'emitter/tsconfig.build.json'), JSON.stringify(config));
    const second = build(root);
    expect(second.hit, 'a changed build configuration was served from cache').toBe(false);
    expect(emitted(root), 'the emit did not follow the configuration').toStrictEqual(['index.js']);
  }, 300_000);
});

describe('AC-11 — repeated builds do not depend on leftovers', () => {
  test('a removed source entry does not survive as an executable emitted file', () => {
    // The shape a stale artifact actually takes. `tsc` writes what its input set produces and
    // removes nothing, and turbo prunes no output directory on either path — measured, not assumed,
    // by the clause below. So the build script's own `rm -rf dist` is what makes this true.
    const root = fixture({
      'index.ts': "export { GONE } from './gone.js';\n",
      'gone.ts': "export const GONE = 'here';\n",
    });
    build(root);
    expect(emitted(root)).toContain('gone.js');

    fs.rmSync(path.join(root, 'emitter/src/gone.ts'));
    write(path.join(root, 'emitter/src/index.ts'), "export const GONE = 'inlined';\n");
    build(root);

    expect(emitted(root), 'the emitted file outlived the source it was compiled from').not.toContain('gone.js');
    expect(emitted(root)).not.toContain('gone.d.ts');
    expect(valueOf(root, 'm.GONE'), 'the old emit is still what executes').toBe('inlined');
  }, 300_000);

  test('and the same inputs produce the same paths and the same bytes, emit present or absent', () => {
    // Paths alone would not catch it: a leftover-contaminated build can produce the right file names
    // with the wrong contents, which is why the byte comparison is here.
    const root = fixture({ 'index.ts': "export const VALUE = 'first';\n" });
    build(root);
    const fromClean = Object.fromEntries(emitted(root).map((name) => [name, read(root, 'emitter/dist', name)]));

    build(root);
    const overExisting = Object.fromEntries(emitted(root).map((name) => [name, read(root, 'emitter/dist', name)]));
    expect(overExisting).toStrictEqual(fromClean);
    expect(Object.keys(fromClean).length, 'the fixture emitted nothing — this comparison is vacuous').toBeGreaterThan(0);
  }, 300_000);

  test('turbo prunes no output directory itself, which is why the build script does', () => {
    // **Registered, and the reason the `rm -rf dist` in three package manifests is load-bearing
    // rather than defensive.** Demonstrated by disabling the clean: with a bare `tsc`, the emitted
    // file whose source has gone survives the rebuild. If a later turbo starts pruning `outputs`
    // before a task runs, this assertion goes red and the clean step can be reconsidered
    // deliberately instead of being carried forever.
    const root = fixture({
      'index.ts': "export { GONE } from './gone.js';\n",
      'gone.ts': "export const GONE = 'here';\n",
    });
    const manifest = JSON.parse(read(root, 'emitter/package.json')) as { scripts: Record<string, string> };
    manifest.scripts.build = manifest.scripts.build.replace(/^rm -rf dist && /, '');
    expect(manifest.scripts.build, 'the clean step was not removed — this fixture proves nothing').not.toContain('rm -rf');
    write(path.join(root, 'emitter/package.json'), JSON.stringify(manifest));

    build(root);
    expect(emitted(root)).toContain('gone.js');
    fs.rmSync(path.join(root, 'emitter/src/gone.ts'));
    write(path.join(root, 'emitter/src/index.ts'), "export const GONE = 'inlined';\n");
    build(root);
    expect(emitted(root), 'turbo now prunes outputs on its own — the build scripts need not').toContain('gone.js');
  }, 300_000);
});
