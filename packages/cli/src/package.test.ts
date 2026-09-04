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

  test('declares every task turbo runs, this package being one that emits, and a Node floor consistent with the root', () => {
    // **Derived, not inlined.** This read `['lint', 'typecheck', 'test']` under the name "declares
    // the three tasks turbo runs" until Q-0097, and neither the array nor the name came from
    // `turbo.json` — so adding a fourth task left this at three, the name false, and turbo skipping
    // the package in silence if it had no script for it. That is the fail-open shape Q-0051 found in
    // `q0050.source.test.ts`, in a file whose sibling register in `test-discovery.test.ts` derives
    // its *package* half from the workspace globs: a package added later was covered and a task
    // added later was not (Q-0097 AC-13).
    //
    // Every root task and not a subset, because `@quorum/cli` is one of the three packages decision
    // 078(c) says emit. Which packages owe `build` is the register in
    // `packages/core/src/test-discovery.test.ts`; here the claim is simply that this one owes all of
    // them, so a fifth root task arrives with a subject rather than passing unnoticed.
    const tasks = Object.keys((JSON.parse(read(WORKSPACE, 'turbo.json')) as { tasks: Record<string, unknown> }).tasks);
    expect(tasks.length, 'the root turbo.json declares no task — this assertion would be vacuous').toBeGreaterThan(3);
    for (const task of tasks) {
      expect(own.scripts?.[task] ?? '', `no ${task} script`).not.toBe('');
    }
    expect(own.engines?.node).toBe(manifest(WORKSPACE).engines?.node);
  });

  test('and the derivation has a subject — the array it replaced does not see a fourth task', () => {
    // The defect exhibited rather than described: the hand-written list is shown passing over a
    // manifest with no `build` script, which is exactly the state that would make turbo skip this
    // package's build in silence while the suite reported green.
    const withoutBuild = { lint: 'eslint .', typecheck: 'tsc --noEmit', test: 'vitest run' };
    for (const task of ['lint', 'typecheck', 'test']) {
      expect(withoutBuild[task as keyof typeof withoutBuild] ?? '').not.toBe('');
    }
    expect(Object.keys((JSON.parse(read(WORKSPACE, 'turbo.json')) as { tasks: Record<string, unknown> }).tasks))
      .toContain('build');
    expect(withoutBuild, 'the fixture already declares a build script, so it discriminates nothing')
      .not.toHaveProperty('build');
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
    'tsconfig.base.json': 'package.test.ts — Q-0096 AC-1, customConditions is the typecheck half of the export map; and build.test.ts, which copies it into the isolated workspace as a root globalDependency',
    'pnpm-workspace.yaml': 'build.test.ts and end-to-end.test.ts, through the copier both share in test/workspace.ts — Q-0097 AC-8, one of the four files that make the isolated copy a workspace turbo can plan',
    '.nvmrc': 'the same copier — Q-0097 AC-8, copied into the isolated workspace because root turbo.json names it a globalDependency',
    'packages/shared': 'the same copier — Q-0097 AC-8, every tracked file under it is copied into the isolated workspace, which is what gives that copy a package to build',
    'packages/core': 'the same copier — Q-0097 AC-8, the same, and the package whose emitted artifact AC-9 imports; Q-0095 AC-2 then spawns the binary that copy builds',
    'packages/core/src/adapters/claude.ts': 'end-to-end.test.ts — Q-0095 AC-7, the variable that adapter\'s check() refuses is read out of the guard rather than spelled here, because frame.source.test.ts\'s AC-12 admits exactly one file in this package that names one',
    'packages/core/src/adapters/codex.ts': 'end-to-end.test.ts — Q-0095 AC-7, the same, for the two that one guards',
    'turbo.json': 'package.test.ts and build.test.ts — Q-0097 AC-7 and AC-13, the build task\'s shape and the tasks every package owes',
    '.gitignore': 'build.test.ts — Q-0097 AC-12, git attributes the emit to the rule that ignores it',
    'eslint.config.js': 'build.test.ts — Q-0097 AC-12, `**/dist/**` keeps emitted JavaScript unlinted',
    'vitest.shared.js': 'build.test.ts — Q-0097 AC-23, the include is still taken by reference and the emit is excluded',
    'packages/core/src/git-identity.test.ts': 'build.test.ts — Q-0097 AC-12, that walk prunes the emit directory by name',
    '.github/workflows/ci.yml': 'build.test.ts — Q-0097 AC-14, CI\'s workspace job grew no build phase',
    '.github/scripts/git-identity-sweep.sh': 'build.test.ts — Q-0097 AC-14, the sweep\'s five phases are unchanged',
    'harness/harness.yaml': 'build.test.ts — Q-0097 AC-14, commands.install and commands.test grew no build phase',
    'harness/flows': 'lint.test.ts — Q-0091 AC-5, the shipped flow directory is copied into a fixture and asserted to lint clean, which is `q0033-surface.js` S1.3; and board.test.ts — Q-0099 AC-3, the same directory copied into a fixture to prove the requirements column\'s hint is `chore` today',
    packages: 'validate.test.ts — Q-0091 AC-9, every workspace package\'s src is walked to prove the frozen skip notice has exactly one copy under packages/**',
    'spike/templates/harness': 'templates.test.ts — Q-0093 AC-4, the shipped template tree this package carries is asserted byte-identical to the spike\'s in both directions, and link 2 of that chain reads harness/flows beside it',
  };

  /**
   * Of those, the ones no other mechanism hashes, and which this package therefore declares.
   *
   * `eslint.config.js`, `vitest.shared.js`, `tsconfig.base.json` and `.nvmrc` are root
   * `globalDependencies`, hashed for every task; everything under `packages/core` and
   * `packages/shared` — the two manifests, `git-identity.test.ts`, and the tracked subtrees
   * `build.test.ts` copies into its isolated workspace — arrives through the `^test` edges the two
   * workspace dependencies create. Declaring any of them would over-declare rather than
   * under-declare, which is the same reasoning the turbo configuration's own comment carries.
   *
   * Q-0091's two are here for the opposite reason: `harness/flows` is hashed by nothing this task
   * reaches, and the per-package source glob covers the four scaffold packages `validate.test.ts`
   * walks, which no edge covers either. That glob over-declares `core` and `shared`, and the
   * alternative is a scan whose verdict can go stale behind a cache hit.
   *
   * Q-0093's one is the same shape: `spike/` is hashed by nothing here — the spike is outside the
   * workspace's dependency graph entirely — so an edited template would leave `templates.test.ts`
   * reporting byte identity from a replay of a comparison it never made.
   */
  const DECLARED = [
    '../../pnpm-lock.yaml', '../../package.json', '../../turbo.json', '../../.gitignore',
    '../../pnpm-workspace.yaml',
    '../../.github/workflows/ci.yml', '../../.github/scripts/git-identity-sweep.sh', '../../harness/harness.yaml',
    '../../harness/flows/*.yaml', '../../packages/*/src/**', '../../spike/templates/harness/**',
  ];

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
 * Evaluates `source` in a plain `node` process rooted at this package, and reports what happened —
 * `code: 'RESOLVED'` and the expression's value on success, the error's `code` and `message` on
 * failure.
 *
 * The point of spawning rather than importing is that Node knows nothing of Vitest's resolver or of
 * the `quorum-source` condition, so what it reports is a property of the published package metadata
 * and of nothing else — which is the claim AC-1 and AC-5 are about. The cwd is this package because
 * that is where the `@quorum/core` link lives: measured from the workspace root the failure is
 * "package not found", which is a different fact and the one iteration 1 of the requirement
 * transcribed by mistake (merged.md §M-5).
 */
const inPlainNode = (source: string): { code: string; message: string; value: string } => {
  // `typeof v === 'string'` rather than `String(v)`: a resolution yields a string and an `import()`
  // yields a module namespace, whose prototype is null — so `String()` on one throws a codeless
  // TypeError that the catch below would report as a failure, turning a *successful* deep import
  // into an empty `code` and quietly disarming AC-5's negative. Measured, not foreseen.
  const script = `try { const v = ${source}; console.log(JSON.stringify({ code: 'RESOLVED', message: '', value: typeof v === 'string' ? v : '' })) }`
    + ' catch (e) { console.log(JSON.stringify({ code: e.code ?? "", message: e.message, value: "" })) }';
  const out = execFileSync(process.execPath, ['--input-type=module', '-e', script], {
    cwd: PACKAGE,
    encoding: 'utf8',
  });
  return JSON.parse(out) as { code: string; message: string; value: string };
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
    // Decision 078(b) asks for "a proof that a plain `node` process, which knows no such condition,
    // gets `dist/`", and *resolution* is where an export map is read — so that is what is asserted,
    // positively and successfully, rather than an import whose execution needs a `dist/` this half
    // of the ticket does not build. `import.meta.resolve` answers from the manifest alone and does
    // not require the target to exist (measured: it returns the URL below against a tree with no
    // `packages/core/dist`), which makes this a claim about package metadata and nothing else.
    //
    // Why: an assertion on a *failed* import here would take its verdict from the checkout rather
    // than from the commit — forbidden by "A test's verdict is a property of the commit, not of the
    // checkout or the account" (2026-08-30). `dist/` is gitignored (`.gitignore:4`), and with a
    // `packages/core/dist/index.js` planted the same import returns RESOLVED, so a test requiring
    // ERR_MODULE_NOT_FOUND is red in any checkout that has ever run a build and green in a fresh
    // clone. That is Q-0072's instance shape, and it is why this reads the resolver instead.
    const result = inPlainNode("import.meta.resolve('@quorum/core')");
    expect(result.code, `resolution failed: ${result.message}`).toBe('RESOLVED');

    // The tail rather than the whole path: Node realpaths the URL when the target exists and does
    // not when it is absent, so the prefix is `packages/cli/node_modules/@quorum/core` in a clean
    // tree and `packages/core` once Q-0097 emits. Both are the same package and neither is the
    // subject; the branch of the map that was taken is.
    //
    // These two assertions are the whole test, and no negative is written beside them, because the
    // three ways of getting this wrong each fail one of them and were each demonstrated: the
    // workspace condition leaking resolves `…/src/index.ts` and fails the tail; no `exports` map at
    // all makes `import.meta.resolve` *throw*, naming Node's legacy `@quorum/core/index.js`
    // fall-through, and fails the code above. A `not.toContain('/src/')` or a `not.toMatch(/…
    // index\.js$/)` beside them could not fail once the tail holds — an assertion that cannot fail
    // is the defect this repository has recorded most often, so it is left out deliberately.
    expect(result.value.endsWith('/dist/index.js'), `resolved to ${result.value}`).toBe(true);

    // This assertion is deliberately not Q-0097's to replace: it holds unchanged once `dist/`
    // exists, because the map it reads does not move. What Q-0097 adds is that the file is there.
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
   * The twenty domain symbols, read out of `frame.source.test.ts`'s own register rather than
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
  const ERRORS = [
    'FlowError', 'GateUnansweredError', 'IntegrationError', 'ProjectExistsError', 'ProjectNotFoundError',
  ];

  test('the register it derives from has a subject', () => {
    // Without this, a regex that silently matched nothing would make every assertion below vacuous
    // — the failure "a check that skips its subject must not report success" (2026-08-25) names.
    expect(domain()).toHaveLength(21);
    expect(domain()).toContain('runFlow');
    expect(domain()).toContain('overrideAdapters');
  });

  test('the barrel exports exactly the twenty plus the four, and every one is defined', async () => {
    const barrel = (await import('@quorum/core')) as Record<string, unknown>;
    expect(Object.keys(barrel).sort()).toStrictEqual([...domain(), ...ERRORS].sort());
    for (const symbol of [...domain(), ...ERRORS]) {
      expect(barrel[symbol], `${symbol} is exported but undefined`).toBeDefined();
    }
  });

  test('Q-0091 AC-3 — both counts moved, and each new name is a command\'s need', async () => {
    // The two pins above read 13 and three until Q-0091, and each is shown red against the value it
    // replaced rather than edited to fit. Both additions are traceable to a command:
    // `quorum validate` reads its schema through `readData` before opening any artifact, and every
    // project-opening command has to be able to tell a missing project from a crash — uncaught,
    // `ProjectNotFoundError` reaches `dieOnUnexpected` and prints a Node stack where the spike
    // prints one sentence.
    expect(domain(), 'the register still holds the thirteen it held before this ticket').not.toHaveLength(13);
    expect(domain()).toContain('readData');
    expect(ERRORS, 'the error list still holds the three it held before this ticket')
      .not.toStrictEqual(['FlowError', 'GateUnansweredError', 'IntegrationError']);
    expect(ERRORS).toContain('ProjectNotFoundError');
    const barrel = (await import('@quorum/core')) as Record<string, unknown>;
    expect(typeof barrel.readData).toBe('function');
    expect(typeof barrel.ProjectNotFoundError).toBe('function');
  });

  test('Q-0092 AC-4 — the register moved again, and the six new names are the reading half of run history', async () => {
    // The pin above read 14 until this ticket, and is shown red against that value rather than
    // edited to fit — the same demonstration Q-0091 wrote one line up, for the same reason.
    expect(domain(), 'the register still holds the fourteen it held before this ticket').not.toHaveLength(14);
    const added = ['readRunsDir', 'sortRuns', 'isIncomplete', 'occurrenceSeq', 'vendorTokenTotal', 'readRun'];
    const barrel = (await import('@quorum/core')) as Record<string, unknown>;
    for (const symbol of added) {
      expect(domain(), `${symbol} is exported and the register does not name it`).toContain(symbol);
      expect(typeof barrel[symbol], `${symbol} is not a function on the barrel`).toBe('function');
    }

    // And the two names a command does not need stay off the surface. `manifestShapeError` runs
    // inside `readRunsDir`, and the CLI's ticket-id grammar is `@quorum/shared`'s `parseTicketId` —
    // publishing `TICKET_ID_PATTERN` here would make two spellings of one rule.
    for (const withheld of ['manifestShapeError', 'TICKET_ID_PATTERN', 'resolveRunDirectory']) {
      expect(Object.keys(barrel), `${withheld} is on the public surface and no command needs it`)
        .not.toContain(withheld);
    }
  });

  test('Q-0093 AC-9 — the register moved again, and the two new names are what a scaffolding command needs', async () => {
    // Both pins read 20 and four until this ticket, and each is shown red against the value it
    // replaced rather than edited to fit — the same demonstration Q-0091 and Q-0092 wrote for their
    // own additions, for the same reason.
    expect(domain(), 'the register still holds the twenty it held before this ticket').not.toHaveLength(20);
    expect(ERRORS, 'the error list still holds the four it held before this ticket')
      .not.toStrictEqual(['FlowError', 'GateUnansweredError', 'IntegrationError', 'ProjectNotFoundError']);

    const barrel = (await import('@quorum/core')) as Record<string, unknown>;
    expect(domain(), 'initProject is exported and the register does not name it').toContain('initProject');
    expect(typeof barrel.initProject, 'initProject is not a function on the barrel').toBe('function');
    expect(typeof barrel.ProjectExistsError).toBe('function');

    // And the name no command needs stays off the surface. `currentBranch` is `initProject`'s own
    // probe: no command asks git for a branch name, and a symbol reaches the barrel because a
    // command needs it — the rule Q-0092 applied when it withheld `manifestShapeError`.
    expect(Object.keys(barrel), 'currentBranch is on the public surface and no command needs it')
      .not.toContain('currentBranch');
  });

  test('Q-0099 AC-10 — two commands landed and the surface is the one it was before them', async () => {
    // The first command child of the cut that needed nothing added, which is worth asserting rather
    // than observing: Q-0091 added three names, Q-0092 six and Q-0093 two, and each of those three
    // clauses above is shown red against the count it replaced. This one is shown against the count
    // it did NOT replace — `board` and `adapters` between them reach five symbols and all five were
    // already here, so the register and the barrel are both unmoved.
    expect(domain(), 'the register grew — a command child added a symbol after all').toHaveLength(21);
    const barrel = (await import('@quorum/core')) as Record<string, unknown>;
    expect(Object.keys(barrel), 'the barrel grew with the register held still').toHaveLength(26);
    for (const symbol of ['loadProject', 'containment', 'lintFlowDirectory', 'getAdapter', 'probeAdapter']) {
      expect(domain(), `${symbol} is what the two new commands reach`).toContain(symbol);
      expect(typeof barrel[symbol], `${symbol} is not a function on the barrel`).toBe('function');
    }
    // And the type the board renders is `@quorum/shared`'s, so nothing was added there either: a
    // command child reaching for a shape declares it from the package that owns the vocabulary.
    const shared = (await import('@quorum/shared')) as Record<string, unknown>;
    expect(Object.keys(shared), 'the containment vocabulary is shared\'s').toContain('CONTAINMENT_REASONS');
  });

  test('and a type export adds no runtime key, which is why the counts above are the whole surface', async () => {
    // Q-0091 also re-exports two types by name — `ArtifactValidationResult` and `FlowFileReport`,
    // each a record a command renders. They are erased, so `Object.keys` cannot see them and the
    // identity above stays the value surface. Asserted rather than assumed, because a `type` keyword
    // dropped by accident would turn one of them into a runtime key and fail the identity with a
    // message about the wrong thing.
    const barrel = (await import('@quorum/core')) as Record<string, unknown>;
    for (const name of ['ArtifactValidationResult', 'FlowFileReport']) {
      expect(Object.keys(barrel), `${name} is exported as a value`).not.toContain(name);
    }
    const source = read(WORKSPACE, 'packages', 'core', 'src', 'index.ts');
    expect(source, 'the types are exported by name rather than wholesale').toContain('export type { FlowFileReport }');
    expect(source, 'a wildcard type export is the exports-map objection in a second form')
      .not.toMatch(/export type \*/);
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
