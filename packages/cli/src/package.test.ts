/**
 * Q-0090 AC-1 (the package is a real workspace package and the lockfile moved with it), AC-10(a)
 * (the five files this suite reads outside itself, and which two of them the task must declare).
 *
 * Q-0090's AC-9 — *"the `@quorum/core` dependency is declared, proven unusable, and routed to
 * Q-0096"* — is closed and its three assertions are replaced below by Q-0096's AC-1, AC-2 and AC-5.
 * The dependency now resolves, exports sixteen symbols, and publishes no wildcard subpath.
 */
import { execFileSync } from 'node:child_process';
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
    'packages/core/package.json': 'package.test.ts — Q-0096 AC-1 and AC-5, the conditional export map and its single "." key',
    'packages/shared/package.json': 'package.test.ts — Q-0096 AC-1, the frame\'s own dependency resolves',
    'tsconfig.base.json': 'package.test.ts — Q-0096 AC-1, customConditions is the typecheck half of the export map',
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

/**
 * Runs `source` in a plain `node` process rooted at this package, and reports what happened.
 *
 * The point of spawning rather than importing is that Node knows nothing of Vitest's resolver or of
 * the `quorum-source` condition, so what it reports is a property of the published package metadata
 * and of nothing else — which is the claim AC-1 and AC-5 are about. The cwd is this package because
 * that is where the `@quorum/core` link lives: measured from the workspace root the failure is
 * "package not found", which is a different fact and the one iteration 1 of the requirement
 * transcribed by mistake (merged.md §M-5).
 */
const inPlainNode = (source: string): { code: string; message: string } => {
  const script = `try { ${source}; console.log(JSON.stringify({ code: 'RESOLVED', message: '' })) }`
    + ' catch (e) { console.log(JSON.stringify({ code: e.code ?? "", message: e.message })) }';
  const out = execFileSync(process.execPath, ['--input-type=module', '-e', script], {
    cwd: PACKAGE,
    encoding: 'utf8',
  });
  return JSON.parse(out) as { code: string; message: string };
};

describe('Q-0096 AC-1 — @quorum/core resolves, and its entry points are declared', () => {
  test('importing it under the workspace condition resolves', async () => {
    // Q-0090 pinned the opposite here — `rejects.toThrow()`, with an `@ts-expect-error` above it —
    // and said in as many words that the assertion was designed to expire when Q-0096 opened the
    // export surface. This is its successor. The directive is gone rather than left: an unused
    // `@ts-expect-error` is itself a `tsc` error, which is the mechanism Q-0090 chose so that the
    // change could not be made quietly.
    await expect(import('@quorum/core')).resolves.toBeDefined();
  });

  test('and the manifest keys that cause it are the conditional map decision 078 ruled', () => {
    // A test cannot assert a compile success, so the cause is asserted where asserting the effect
    // would be dishonest — the same reasoning, and the same shape, as the assertion this replaces.
    const core = manifest(path.join(WORKSPACE, 'packages', 'core'));
    const entry = (core.exports as Record<string, Record<string, unknown>>)['.'];
    expect(entry, 'packages/core declares an exports map with a "." entry').toBeDefined();

    // The workspace condition resolves TypeScript source, so no verdict in this workspace moves
    // behind a build artifact; the default resolves the emitted artifact, which is what Node and a
    // packed install get. See "The emit serves the binary, and no test verdict moves behind it"
    // (2026-09-02), clauses (a) and (b).
    expect(entry['quorum-source']).toStrictEqual({ types: './src/index.ts', default: './src/index.ts' });
    expect(entry.default, 'the default condition resolves the emit, never the source').toBe('./dist/index.js');
    expect(entry.types).toBe('./dist/index.d.ts');
  });

  test('tsc is told the same condition, which is the typecheck half of the same cause', () => {
    // Was "tsconfig.base.json declares no paths" until Q-0096. `paths` is still absent and is still
    // not the mechanism: resolution goes through the export map, and `customConditions` is what
    // makes `tsc` read the same branch of it that Vitest reads. Demonstrated rather than assumed —
    // removing this key makes `pnpm turbo run typecheck` report `TS2307: Cannot find module
    // '@quorum/core'` for every file that imports it.
    const base = JSON.parse(read(WORKSPACE, 'tsconfig.base.json')) as {
      compilerOptions?: { paths?: unknown; customConditions?: string[] };
    };
    expect(base.compilerOptions?.customConditions).toStrictEqual(['quorum-source']);
    expect(base.compilerOptions?.paths, 'resolution is by export map, not by a path alias').toBe(undefined);
  });

  test('a plain node process, which knows no such condition, is sent to the emit', () => {
    // Decision 078(b) asks for exactly this proof, and it is the honest maximum for this half of
    // the ticket: `dist/` is Q-0097's to produce, so what is established here is that Node honours
    // the export map and *reaches* the declared artifact. Before this change the same import died
    // on `…/@quorum/core/index.js` — Node's legacy fall-through for a package with no `exports` at
    // all — so the failure moving to `dist/index.js` is the whole of what AC-1 delivers today.
    // It becomes `RESOLVED` at Q-0097 and this assertion is that ticket's to replace.
    const result = inPlainNode("await import('@quorum/core')");
    expect(result.code).toBe('ERR_MODULE_NOT_FOUND');
    expect(result.message).toContain('@quorum/core/dist/index.js');
    expect(result.message, 'the legacy index.js fall-through is what an absent exports map gives')
      .not.toContain('@quorum/core/index.js');
  });

  test('@quorum/shared resolves too, by the same mechanism it always did', async () => {
    // This was "by contrast @quorum/shared declares an export map" — the discriminating half of a
    // claim about a cause. The contrast is gone, because both packages now declare one; what the
    // assertion is still good for is that the frame's own dependency resolves.
    const shared = manifest(path.join(WORKSPACE, 'packages', 'shared'));
    expect(shared.exports).toBeDefined();
    await expect(import('@quorum/shared')).resolves.toBeDefined();
  });
});

describe('Q-0096 AC-2 — the barrel exports the public API, so the trap closes rather than moves', () => {
  /**
   * The thirteen domain symbols, read out of `frame.source.test.ts`'s own register rather than
   * retyped.
   *
   * That register is the list of helpers the frame is forbidden to reimplement because they live in
   * `@quorum/core`; this test is the other side of the same claim — that they can actually be
   * imported from there. Deriving it is the point: two hand-written copies of one list is the
   * transcription defect this repository keeps paying for, and a symbol added to `DOMAIN` without
   * being exported would otherwise be caught by nothing.
   */
  const domain = (): string[] => {
    const text = read(PACKAGE, 'src', 'frame.source.test.ts');
    const block = /\nconst DOMAIN = \[([\s\S]*?)\];/.exec(text)?.[1] ?? '';
    return [...block.matchAll(/'([A-Za-z][A-Za-z0-9]*)'/g)].map((match) => match[1]);
  };

  /**
   * The three error classes, declared here because no register holds them.
   *
   * They are not domain *helpers*, so they are correctly absent from `DOMAIN` — a caller catches
   * them rather than calling them — and `frame.source.test.ts` has no reason to name them. Written
   * out with their modules so a reader can check the list against the barrel by eye.
   */
  const ERRORS = ['FlowError', 'GateUnansweredError', 'IntegrationError'];

  test('the register it derives from has a subject', () => {
    // Without this, a regex that silently matched nothing would make every assertion below vacuous
    // — the failure "a check that skips its subject must not report success" (2026-08-25) names.
    expect(domain()).toHaveLength(13);
    expect(domain()).toContain('runFlow');
    expect(domain()).toContain('overrideAdapters');
  });

  test('the barrel exports exactly the thirteen plus the three, and every one is defined', async () => {
    const barrel = (await import('@quorum/core')) as Record<string, unknown>;
    expect(Object.keys(barrel).sort()).toStrictEqual([...domain(), ...ERRORS].sort());
    for (const symbol of [...domain(), ...ERRORS]) {
      expect(barrel[symbol], `${symbol} is exported but undefined`).toBeDefined();
    }
  });
});

describe('Q-0096 AC-5 — the public surface is explicit, not a wildcard', () => {
  test('the exports map publishes "." and no subpath pattern', () => {
    // What Q-0091 to Q-0094 may import is a decision; a `./*` key defers it to whoever types an
    // import first, and every internal module becomes public by accident.
    const core = manifest(path.join(WORKSPACE, 'packages', 'core'));
    const keys = Object.keys(core.exports as Record<string, unknown>);
    expect(keys).toStrictEqual(['.']);
    expect(keys.filter((key) => key.includes('*')), 'no wildcard subpath').toStrictEqual([]);
  });

  test('and a deep import of an internal module does not resolve', () => {
    // Asserted in a plain node process because Node's own resolver is the authority on an
    // `exports` map, and because Vite refuses an unexported subpath while *transforming* the file
    // — a static `import()` of one fails the whole test file rather than rejecting a promise, so
    // there is no honest way to write this assertion in-process.
    const result = inPlainNode("await import('@quorum/core/engine/engine.js')");
    expect(result.code).toBe('ERR_PACKAGE_PATH_NOT_EXPORTED');
  });
});
