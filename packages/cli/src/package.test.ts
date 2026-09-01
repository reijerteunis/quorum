/**
 * Q-0090 AC-1 (the package is a real workspace package and the lockfile moved with it), AC-10(a)
 * (the five files this suite reads outside itself, and which two of them the task must declare) and
 * AC-9 (the `@quorum/core` dependency is declared, proven unusable, and routed to Q-0096).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, test } from 'vitest';

/** This package's own root, reached package-relatively rather than by climbing to a repository. */
const PACKAGE = fileURLToPath(new URL('..', import.meta.url));

/** The workspace root, which is this package's grandparent. AC-10(a) audits everything read below it. */
const WORKSPACE = path.resolve(PACKAGE, '..', '..');

/** As much of a manifest as these assertions read. */
interface Manifest {
  name?: string;
  private?: boolean;
  type?: string;
  bin?: Record<string, string>;
  engines?: { node?: string };
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  exports?: unknown;
  main?: unknown;
  types?: unknown;
}

const read = (...parts: string[]): string => fs.readFileSync(path.join(...parts), 'utf8');
const manifest = (dir: string): Manifest => JSON.parse(read(dir, 'package.json')) as Manifest;

describe('AC-1 — the manifest', () => {
  const own = manifest(PACKAGE);

  test('declares the two workspace dependencies and no third-party one', () => {
    expect(own.dependencies).toStrictEqual({
      '@quorum/core': 'workspace:*',
      '@quorum/shared': 'workspace:*',
    });
    // It gains nothing merely because `spike/package.json` has it: no argument-parsing library, no
    // YAML reader, no colour library. The frame preserves the spike's parser, and a library would
    // silently "fix" the two behaviours `argv.test.ts` pins (Q-0090 non-goal 13).
    expect(own.devDependencies).toBe(undefined);
  });

  test('names the binary `quorum`, and the package stays @quorum/cli', () => {
    // `quorum` is what the README will type, and `product-boundaries.md` forbids calling the
    // product a harness. The published name is Q-0029's, in M6.
    expect(Object.keys(own.bin ?? {})).toStrictEqual(['quorum']);
    expect(own.name).toBe('@quorum/cli');
    expect(own.private).toBe(true);
    expect(own.type).toBe('module');
  });

  test('and says nothing about what that key points at, which is Q-0096\'s to decide', () => {
    // Why: the executable, its extension and the output layout it sits in are Q-0096's by the gate
    // ruling of 2026-09-01 — this ticket declares the `bin` *field* and does not make it run
    // (Q-0090 AC-1, non-goal 1). So the only property asserted is that the key carries a value: a
    // suffix or a location pinned here would turn a legitimate Q-0096 choice — an extensionless
    // launcher, a `dist/` layout — into a red Q-0090 suite, which is this package constraining a
    // decision it does not own. The path in the manifest today is provisional for the same reason.
    //
    // The install was measured rather than predicted and is reported instead of pinned:
    // `pnpm install --frozen-lockfile` exits 0 with the manifest as declared and creates no shim,
    // because nothing depends on `@quorum/cli`, so pnpm is never asked to resolve the target — the
    // measured unknown AC-1 named, answered, and needing no erratum.
    expect(typeof own.bin?.quorum).toBe('string');
    expect(own.bin?.quorum).not.toBe('');
  });

  test('declares the three tasks turbo runs and a Node floor consistent with the root', () => {
    for (const task of ['lint', 'typecheck', 'test']) {
      expect(own.scripts?.[task] ?? '', `no ${task} script`).not.toBe('');
    }
    expect(own.engines?.node).toBe(manifest(WORKSPACE).engines?.node);
  });
});

describe('AC-1 — the lockfile moved in the same commit', () => {
  test('the packages/cli importer is no longer empty, and names both workspace links', () => {
    // `commands.install` runs `pnpm install --frozen-lockfile` in the integrate worktree: a
    // manifest change without a lockfile change fails the install after the implement step has
    // already been paid for (Q-0090 R-4).
    const lock = read(WORKSPACE, 'pnpm-lock.yaml');
    const importer = /\n {2}packages\/cli:\n((?: {4}.*\n|\n)*)/.exec(lock)?.[1] ?? '';
    expect(importer.trim(), 'packages/cli is still an empty importer').not.toBe('');
    expect(importer).toContain("'@quorum/core'");
    expect(importer).toContain("'@quorum/shared'");
    expect(importer).toContain('link:../core');
    expect(importer).toContain('link:../shared');
  });

  test('the extraction has a subject — an empty importer is recognised as empty', () => {
    const empty = '\n  packages/cli: {}\n\n  packages/compiler: {}\n';
    expect((/\n {2}packages\/cli:\n((?: {4}.*\n|\n)*)/.exec(empty)?.[1] ?? '').trim()).toBe('');
  });
});

describe('AC-10(a) — this suite reads two repository files, and declares both', () => {
  /** Every repository path outside this package that a file under `src` opens. */
  const OUTSIDE: Record<string, string> = {
    'pnpm-lock.yaml': 'package.test.ts — AC-1, the packages/cli importer is no longer empty',
    'package.json': 'package.test.ts — AC-1, the engines.node floor matches the root\'s',
    'packages/core/package.json': 'package.test.ts — AC-9, the three absent keys',
    'packages/shared/package.json': 'package.test.ts — AC-9, the export map that makes the contrast',
    'tsconfig.base.json': 'package.test.ts — AC-9, the absent paths',
  };

  /** Of those, the ones no other mechanism hashes, and which this package therefore declares. */
  const DECLARED = ['../../pnpm-lock.yaml', '../../package.json'];

  test('the turbo task declares exactly the reads nothing else covers', () => {
    // Why: a cache hit names what the task reads (Q-0072). Three of the five above arrive by a
    // mechanism this package already declares — the two workspace manifests through the `^test`
    // edge its dependencies create, and `tsconfig.base.json` as a root globalDependency — so
    // declaring them would over-declare rather than under-declare. The other two are hashed by
    // nothing, and are named here.
    const config = read(PACKAGE, 'turbo.json');
    for (const input of DECLARED) {
      expect(config, `${input} is read and not declared`).toContain(`"${input}"`);
    }
    expect(config).toContain('"$TURBO_DEFAULT$"');
    // A package configuration declares `inputs` and nothing else, so root turbo.json stays the one
    // place `env` is decided and the merge keeps QUORUM_REAL_CLI (Q-0065).
    expect(config).not.toContain('"env"');
    expect(config).not.toContain('"outputs"');
    expect(Object.keys(OUTSIDE).length, 'the audit is empty').toBeGreaterThan(4);
  });

  test('and every path in that audit is a file that exists, so the register cannot rot', () => {
    for (const [relative, why] of Object.entries(OUTSIDE)) {
      expect(fs.existsSync(path.join(WORKSPACE, relative)), `${relative} (${why}) is not there`).toBe(true);
    }
  });
});

describe('AC-9 — @quorum/core is declared and does not resolve', () => {
  test('importing it rejects', async () => {
    // Why: this assertion is designed to expire. Q-0096 — "The workspace emits JavaScript, and
    // quorum is a runnable binary" — opens `packages/core`'s export surface, and when it does this
    // test goes red. That red means *the trap is closed*, not that something regressed: the point
    // of pinning it is that a declared dependency resolving to nothing is a trap for Q-0091, which
    // is the first sibling that imports one.
    //
    // The directive is the typecheck half of the same claim, and it expires the same way: an
    // unused `@ts-expect-error` is itself an error, so when Q-0096 opens the export surface `tsc`
    // fails here too rather than quietly starting to resolve.
    // @ts-expect-error AC-9 — @quorum/core resolves to nothing at typecheck either, which is the fact under test.
    await expect(import('@quorum/core')).rejects.toThrow();
  });

  test('and the two facts that cause it are what a fix has to change', () => {
    // A test cannot assert a compile failure, so the causes are asserted where asserting the effect
    // would be dishonest. `@quorum/core` is unresolvable at typecheck as well as at runtime.
    const core = manifest(path.join(WORKSPACE, 'packages', 'core'));
    expect(core.exports, 'packages/core declares no exports').toBe(undefined);
    expect(core.main, 'packages/core declares no main').toBe(undefined);
    expect(core.types, 'packages/core declares no types').toBe(undefined);

    const base = JSON.parse(read(WORKSPACE, 'tsconfig.base.json')) as { compilerOptions?: { paths?: unknown } };
    expect(base.compilerOptions?.paths, 'tsconfig.base.json declares no paths').toBe(undefined);
  });

  test('by contrast @quorum/shared declares an export map, so the frame can import it', async () => {
    // The discriminating half: the difference between the two packages is the export map and
    // nothing else, which is what makes AC-9's claim about a cause rather than about a symptom.
    const shared = manifest(path.join(WORKSPACE, 'packages', 'shared'));
    expect(shared.exports).toBeDefined();
    await expect(import('@quorum/shared')).resolves.toBeDefined();
  });
});
