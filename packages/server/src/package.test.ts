/**
 * Q-0013 AC-1, AC-2, and the source-level halves of AC-3, AC-5, AC-12, AC-13 and AC-14.
 *
 * Everything here is a property of what this package *is* rather than of what a run does, which is
 * why it is one file: a scan that quotes the strings it forbids has to exclude itself, and two such
 * files would each be a hole in the other's corpus. {@link GUARD} is that exclusion, derived from
 * this file's own name so renaming it cannot leave an exemption excusing a file that is not here.
 *
 * **No file list is written down.** Both corpora derive from the tree — the production half for the
 * scans that are about modules, the whole package for the ones whose criterion names the package.
 * A hand-written list is the failure Q-0051 found in `q0050.source.test.ts`'s third list: it mapped
 * over six names, a seventh file went unscanned, and the suite reported green.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, test } from 'vitest';

import { eventSchema, WIRE_START_FIELDS } from '@quorum/shared';
import { loadFlowByName, runFlow } from '@quorum/core';
// Imported as types and used as types below, so `tsc --noEmit` — a required task, forced in CI —
// is what proves each of them reaches a consumer through the barrel rather than through a deep
// path. A runtime check cannot: a type export adds no runtime key.
import type { AnswerGate, Project, TicketRecord } from '@quorum/core';

/** This package's `src`, reached package-relatively rather than by climbing to a repository. */
const SRC = fileURLToPath(new URL('.', import.meta.url));

/** This package's root, the subject the package-wide criteria name. */
const PACKAGE = fileURLToPath(new URL('..', import.meta.url));

/** The workspace root, which is this package's grandparent — the shape `packages/cli` already uses. */
const WORKSPACE = path.resolve(PACKAGE, '..', '..');

/** This file, excluded from every scan below because it quotes what they look for. */
const GUARD = path.relative(SRC, fileURLToPath(import.meta.url));

/** As much of a manifest as these assertions read. */
interface Manifest {
  name?: string;
  private?: boolean;
  type?: string;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  exports?: unknown;
  main?: unknown;
  types?: unknown;
  files?: unknown;
  /** Declared at Q-0124, when this package became one a tarball carries. */
  license?: unknown;
  bin?: unknown;
}

const read = (...parts: string[]): string => fs.readFileSync(path.join(...parts), 'utf8');
const manifest = (dir: string): Manifest => JSON.parse(read(dir, 'package.json')) as Manifest;

/**
 * Q-0125 AC-3's invariant, **inverted by Q-0124** — *it emits and it is distributed* — as one
 * predicate, applied to the real manifest and to both hostile fixtures.
 *
 * **The name moved with the rule**, which is the half that is easy to skip: a function still called
 * `emitsAndIsNotDistributed` returning `[]` for a package five tarballs carry would be a name that
 * lies, and this file's own register would then read as evidence for the opposite of what it checks.
 * The emission half is untouched; only the three distribution clauses turned over, and `files` and
 * `license` became owed where they were forbidden. Why: *"The distribution set is five, and rejoins
 * the emitting set"* (2026-09-15), clause 3.
 *
 * **Why a function rather than two lists of assertions.** The criterion asks for the block to be
 * shown red in both directions (R-7), and a demonstration written as a second set of expectations
 * over a fixture proves nothing about the first set: it can agree with a manifest the real clauses
 * no longer examine, so deleting those clauses leaves the discriminator green — which is the failure
 * the review of run 2 iteration 1 found here. One rule, three subjects, is what closes it.
 *
 * Each problem names the **half** it belongs to, because the two are different claims and the
 * criterion turns on telling them apart: `emission:` is about producing an artifact and publishing
 * it, `distribution:` is about a tarball that does not exist. An empty list is the invariant holding.
 */
const emitsAndIsDistributed = (candidate: Manifest): string[] => [
  candidate.scripts?.build === undefined ? 'emission: it declares no build script' : '',
  candidate.exports === undefined ? 'emission: it publishes no exports map' : '',
  candidate.main !== undefined ? 'emission: a top-level main is declared beside the map' : '',
  candidate.types !== undefined ? 'emission: a top-level types is declared beside the map' : '',
  candidate.files === undefined ? 'distribution: no files allow-list, so the checkout decides the tarball' : '',
  candidate.license === undefined ? 'distribution: no licence on a package a tarball carries' : '',
  candidate.bin !== undefined ? 'distribution: a bin entry ships an executable nothing runs' : '',
  candidate.private !== true ? 'distribution: the package stopped being private' : '',
].filter((problem) => problem !== '');

/** Every `.ts` file below `src`, as `[path relative to src, text]`, derived from the tree. */
const sources = (): [string, string][] => fs
  .readdirSync(SRC, { withFileTypes: true, recursive: true })
  .filter((entry) => entry.isFile() && entry.name.endsWith('.ts'))
  .map((entry) => {
    const full = path.join(entry.parentPath, entry.name);
    return [path.relative(SRC, full), fs.readFileSync(full, 'utf8')] as [string, string];
  })
  .filter(([name]) => name !== GUARD);

/** The production half: everything below `src` that is not a test. */
const production = (): [string, string][] => sources().filter(([name]) => !name.endsWith('.test.ts'));

/**
 * Everything this package carries in any extension, for the criteria whose subject is the package.
 *
 * `vitest.config.js` and `package.json` are executable and declarative respectively, and a socket
 * or a signal handler could live in either; scanning `src/**.ts` alone would not see them. The same
 * reasoning `packages/cli/src/frame.source.test.ts` gives for its second corpus.
 */
const packageFiles = (): [string, string][] => fs
  .readdirSync(PACKAGE, { withFileTypes: true, recursive: true })
  .filter((entry) => entry.isFile())
  .map((entry) => path.join(entry.parentPath, entry.name))
  // `node_modules` because it is somebody else's code; `.turbo` because it is not code at all —
  // it holds the CAPTURED OUTPUT of previous task runs, gitignored and present only on a machine
  // that has run them. Every clause below then had a verdict that depended on whether the suite had
  // run before: AC-14's search for `testTimeout` found the word inside a log of a run that had
  // FAILED mentioning it. *"A test's verdict is a property of the commit, not of the checkout"*
  // (2026-08-30), found by the cross-vendor review of Q-0118 rather than by a red CI, because a
  // fresh clone has no `.turbo` and passes.
  .filter((file) => {
    const segments = path.relative(PACKAGE, file).split(path.sep);
    return !segments.includes('node_modules') && !segments.includes('.turbo');
  })
  .map((file) => [path.relative(PACKAGE, file), fs.readFileSync(file, 'utf8')] as [string, string])
  .filter(([name]) => name !== path.join('src', GUARD));

describe('AC-1 — the manifest declares what it depends on and nothing more', () => {
  const own = manifest(PACKAGE);

  test('the two workspace dependencies, and the three the transport needs', () => {
    // Q-0013 asserted NO external dependency here, because the dependency decision deliberately did
    // not ride on the half that carried the risk. Q-0118 is the half that spends it, and the three
    // arrive with no decision entry: `docs/04-architecture.md` chose Hono on 2026-08-22 and
    // executing a landed document is not changing the architecture (Q-0013 OQ-3).
    //
    // Each one's justification, which `.claude/rules/engineering.md` asks for in a line:
    //   hono              — the HTTP framework that document names.
    //   @hono/node-server — its Node adapter; Hono targets a Web-standard runtime and Node is not one.
    //   @hono/node-ws     — the WebSocket half of that adapter, pinned to it by a peer range.
    //
    // Pinned exactly, and the pin is load-bearing: `@hono/node-ws@1.3.1` declares a peer on
    // `@hono/node-server@^1`, so installing the 2.x that `npm view` reports as latest leaves an
    // unmet peer. Measured on the way in rather than discovered by a user.
    expect(own.dependencies).toStrictEqual({
      '@hono/node-server': '^1.19.11',
      '@hono/node-ws': '^1.3.1',
      '@quorum/core': 'workspace:*',
      '@quorum/shared': 'workspace:*',
      hono: '^4.13.7',
    });
    expect(own.devDependencies).toBe(undefined);
  });

  test('the node adapter satisfies the WebSocket package\'s peer range, which is why it is pinned to 1.x', () => {
    // The claim above, executable. A later bump of `@hono/node-server` to 2.x reinstates the unmet
    // peer this pin exists to avoid, and would do it silently: pnpm warns and installs anyway.
    const declared = (own.dependencies ?? {})['@hono/node-server'] ?? '';
    expect(declared.startsWith('^1.'), `@hono/node-server is ${declared}, which @hono/node-ws@1 does not accept`).toBe(true);
  });

  test('both are real — the lockfile carries the package and its two links', () => {
    // Declared and resolvable are two claims. `pnpm-lock.yaml` is read through the workspace root
    // and reaches this task through the `^test` edge the two dependencies create, which is what
    // covers `packages/cli`'s reads of the same kind.
    const lock = read(WORKSPACE, 'pnpm-lock.yaml');
    expect(lock).toContain('packages/server:');
    expect(lock.slice(lock.indexOf('packages/server:'))).toContain('@quorum/core');
  });

  test('Q-0124 AC-3 — it emits and is distributed, which is the combination Q-0125 deliberately left open', () => {
    // **Two registers, not one, and since Q-0124 this package is in both.** The **emitting** set is
    // `test-discovery.test.ts`'s and is five; the local **distribution** set is `build.test.ts`'s
    // `DISTRIBUTION` and is five as well. The two staying separate registers is the point rather
    // than an oversight: they coincide today and a sixth emitter could part them again, which is
    // exactly what 093 defined *resolved* by mechanism to make cheap.
    //
    // `files` is now owed rather than forbidden, and the reason is the mirror of Q-0125's: an
    // allow-list on a package nothing packs claims a tarball that does not exist, and its **absence**
    // on one that is packed ships the working tree — Q-0098 measured 40 files against 17. `license`
    // joins it because the three packed before this carried `Apache-2.0` and this package declared
    // none, latent exactly while nothing packed it. `bin` stays forbidden: a tarball that carries
    // this package still carries no executable of its own. And `private: true` stays, because
    // `pnpm pack` does not refuse a private package — only `npm publish` does, which 078(d) still
    // refuses until Q-0029. Why: *"The distribution set is five, and rejoins the emitting set"*
    // (2026-09-15), clauses 2 and 3.
    //
    // The invariant first, so what the clauses below assert by name is the same rule the fixtures in
    // the next test are judged by rather than a parallel description of it.
    expect(emitsAndIsDistributed(own), 'the manifest stopped emitting, or stopped declaring what a tarball needs')
      .toStrictEqual([]);
    expect(own.scripts?.build, 'the package emits nothing').not.toBe(undefined);
    expect(own.exports, 'the package publishes nothing').not.toBe(undefined);
    expect(own.main, 'a top-level main is declared beside the map').toBe(undefined);
    expect(own.types, 'a top-level types is declared beside the map').toBe(undefined);
    expect(own.files, 'no files allow-list, so the checkout decides the tarball').toStrictEqual(['dist']);
    expect(own.license, 'a distributed package carries no licence').toBe('Apache-2.0');
    expect(own.bin, 'the package declares a binary').toBe(undefined);
    expect(own.name).toBe('@quorum/server');
    expect(own.private, 'the package stopped being private, which 078(d) still refuses').toBe(true);
    expect(own.type).toBe('module');
  });

  test('AC-3 — and the two halves discriminate: emitting is still not distributing', () => {
    // **Shown red in BOTH directions, which is what stops this being read as "delete the clauses
    // that now fail"** (R-7) — the same demand Q-0125 made of itself, re-aimed rather than dropped
    // when the rule turned over. The inversion above passes today by the manifest having changed, so
    // a wrong implementation of AC-3 — dropping the two assertions rather than inverting them —
    // would look identical.
    //
    // **The fixtures are run through the production invariant rather than re-described here**, which
    // is the correction the review of Q-0125 iteration 1 asked for: a fixture asserted against its
    // own freshly written fields confirms only that the fixture was written as intended, and stays
    // green over a manifest nothing examines. Each is handed to {@link emitsAndIsDistributed}, and
    // what is asserted is the exact list of problems it reports.
    const asItWas: Manifest = { ...own, scripts: { ...own.scripts }, exports: undefined };
    delete asItWas.scripts?.build;
    expect(emitsAndIsDistributed(asItWas), 'the manifest as it stood before Q-0125 passes the emission half')
      .toStrictEqual(['emission: it declares no build script', 'emission: it publishes no exports map']);

    // The manifest as Q-0125 left it: emitting, and claiming no tarball. It must fail the
    // distribution half by name, which is what says the rule turned over rather than being deleted.
    const asQ0125Left: Manifest = { ...own, files: undefined, license: undefined };
    expect(emitsAndIsDistributed(asQ0125Left), 'the pre-Q-0124 manifest passes the rule that replaced it')
      .toStrictEqual([
        'distribution: no files allow-list, so the checkout decides the tarball',
        'distribution: no licence on a package a tarball carries',
      ]);

    // And the invariant is not satisfied by every input, which is what stops the two clauses above
    // being read as "the function returns whatever was put in": a manifest that emits nothing AND
    // declares nothing a tarball needs fails both halves at once, and the halves are named
    // separately.
    const neither: Manifest = {
      ...own, scripts: { ...own.scripts }, exports: undefined, files: undefined, license: undefined,
      bin: 'x.js', private: false,
    };
    delete neither.scripts?.build;
    const both = emitsAndIsDistributed(neither);
    expect(both.filter((problem) => problem.startsWith('emission:')).length).toBe(2);
    expect(both.filter((problem) => problem.startsWith('distribution:')).length).toBe(4);
  });

  test('Q-0125 AC-1 — the exports map is the shape its two siblings declare, publishing "." alone', () => {
    // Asserted by VALUE rather than by shape, because what a plain `node` process does depends on
    // which branch it lands in: `quorum-source` is what `tsconfig.base.json`'s `customConditions`
    // and `vitest.shared.js` select, and `default` is what the built binary gets. A map whose
    // `default` named `./src/index.ts` would pass every suite here and fail the moment
    // `packages/cli/dist/quorum.js` imported it — the shape decision 093 refuses by name.
    const entry = (own.exports as Record<string, Record<string, unknown>>)['.'];
    expect(entry, 'the map declares no "." at all').not.toBe(undefined);
    expect(entry?.['quorum-source'], 'the workspace source condition is not the first branch')
      .toStrictEqual({ types: './src/index.ts', default: './src/index.ts' });
    expect(entry?.types, 'the declarations condition does not name the emit').toBe('./dist/index.d.ts');
    expect(entry?.default, 'the default condition does not name the emit').toBe('./dist/index.js');
  });

  test('AC-1 — and it publishes no subpath pattern, so no internal module is public by accident', () => {
    // The refusal `packages/cli/src/package.test.ts` already makes for `@quorum/core`: a `./*` key
    // defers what a consumer may import to whoever types one first. What this package publishes
    // stays exactly `src/index.ts`'s barrel, which `index.test.ts`'s `SURFACE` register holds.
    const keys = Object.keys(own.exports as Record<string, unknown>);
    expect(keys).toStrictEqual(['.']);
    expect(keys.filter((key) => key.includes('*')), 'no wildcard subpath').toStrictEqual([]);
  });

  test('Q-0125 AC-2 — the build script is the two `tsc` siblings\' and not the binary\'s', () => {
    // `@quorum/cli`'s appends `&& chmod +x dist/quorum.js` for a `bin` this package does not have,
    // so the agreement clause AC-2 asks for is over the four `tsconfig.build.json` files and never
    // over the scripts — that divergence is real and correct. `build.test.ts` owns the
    // configuration comparison, this owns the script.
    expect(own.scripts?.build).toMatch(/^rm -rf dist && tsc -p tsconfig\.build\.json$/);
  });

  test('no CORS middleware, header, or dependency is introduced', () => {
    const source = production().map(([, text]) => text).join('\n').toLowerCase();
    expect(source).not.toContain('cors');
    expect(JSON.stringify(own).toLowerCase()).not.toContain('cors');
  });

  test('and it declares the three tasks every package in this workspace owes', () => {
    for (const task of ['lint', 'typecheck', 'test']) {
      expect(own.scripts?.[task] ?? '', `no ${task} script`).not.toBe('');
    }
  });

  test('a value from each dependency resolves, under the workspace source condition', () => {
    // Proven by resolution rather than by the manifest saying so, and aimed at `src` because that
    // is what `quorum-source` selects — the condition `vitest.shared.js` sets and `tsconfig.base`
    // declares. A `dist` here would mean the suite was proving an emit nobody built.
    //
    // **Q-0125 AC-8(c): unchanged by that ticket, and that is the point of it.** This package now
    // emits, and these two lines are the evidence that adding an emit moved no verdict inside it —
    // the suites still resolve TypeScript source, so *"no test verdict moves behind it"* survives a
    // fifth emitter. See "A fifth package emits, and `resolved` is not a synonym for `distributed`"
    // (2026-09-12), clause 4.
    expect(typeof runFlow).toBe('function');
    expect(typeof loadFlowByName).toBe('function');
    expect(typeof eventSchema.safeParse).toBe('function');
    expect(import.meta.resolve('@quorum/core')).toContain('/packages/core/src/index.ts');
    expect(import.meta.resolve('@quorum/shared')).toContain('/packages/shared/src/index.ts');
  });
});

describe('AC-2 — what this package names from core is on core\'s barrel', () => {
  /** Every `import … from '@quorum/core'` this package's production source performs. */
  const coreImports = (): { file: string; typeOnly: boolean; names: string[] }[] => production()
    .flatMap(([file, text]) => [...text.matchAll(/import\s+(type\s+)?\{([^}]*)\}\s+from\s+'@quorum\/core'/g)]
      .map((match) => ({
        file,
        typeOnly: match[1] !== undefined,
        names: (match[2] ?? '').split(',').map((name) => name.trim()).filter(Boolean),
      })));

  test('the type names are derived from the source rather than written down here', () => {
    // Derived, so a fourth type named later is reported rather than silently inheriting a list
    // somebody remembered to extend — the lesson Q-0051's fail-open array, Q-0093's per-package
    // register and Q-0108's classifier each paid for separately.
    const named = new Set(coreImports().filter((entry) => entry.typeOnly).flatMap((entry) => entry.names));
    expect([...named].sort()).toStrictEqual(['AnswerGate', 'Project', 'TicketRecord']);
    // And those are the three the barrel gained, with `RunFlowOptions` and `RunStatus` withheld —
    // withheld with reasons is the rule working, not a gap. Read over the barrel's EXPORT
    // STATEMENTS rather than its whole text: its docblock names both withheld types, which is
    // where the reasons are, and a scan that could not tell prose from an export would refuse the
    // record of a decision for repeating the word it decided about.
    //
    // `packages/core/src/index.ts` is outside this package and owes no declaration in a
    // `packages/server/turbo.json`: `@quorum/core` is a workspace dependency, so the root `test`
    // task's `^test` edge already hashes it — the same reason `packages/cli/turbo.json` omits the
    // two manifests its own suite reads.
    const exported = read(WORKSPACE, 'packages/core/src/index.ts')
      .split('\n').filter((line) => line.startsWith('export ')).join('\n');
    expect(exported, 'the barrel read found no export lines at all').not.toBe('');
    for (const name of named) {
      expect(exported, `@quorum/core's barrel does not export ${name}`).toContain(name);
    }
    expect(exported, 'RunFlowOptions was admitted after all').not.toContain('RunFlowOptions');
    expect(exported, 'RunStatus was admitted after all').not.toContain('RunStatus');
  });

  test('and the type half is the compiler\'s: these three are used as types in this file', () => {
    // A runtime check cannot see a type export, so the proof is that this file compiles. The three
    // are used rather than merely imported, because an unused import is elided before `tsc` cares.
    const answer: AnswerGate | null = null;
    const project: Project | null = null;
    const ticket: TicketRecord | null = null;
    expect([answer, project, ticket]).toStrictEqual([null, null, null]);
  });

  test('nothing here reaches a type through `Parameters` or `ReturnType`', () => {
    // The two workarounds a consumer writes when a name is missing from the barrel. Their absence
    // is what says the export gap is closed rather than routed around.
    for (const [file, text] of sources()) {
      expect(text, `${file} reaches a type through Parameters<typeof runFlow>`).not.toContain('Parameters<typeof runFlow>');
      expect(text, `${file} reaches a type through ReturnType<typeof loadProject>`).not.toContain('ReturnType<typeof loadProject>');
    }
  });

  test('and every core import is the bare specifier — no deep path into another package', () => {
    for (const [file, text] of sources()) {
      expect(text, `${file} imports a deep path from @quorum/core`).not.toMatch(/'@quorum\/core\//);
      expect(text, `${file} imports a deep path from @quorum/shared`).not.toMatch(/'@quorum\/shared\//);
    }
  });

  test('the corpus has a subject', () => {
    expect(production().length, 'the production scan found nothing').toBeGreaterThan(3);
    expect(coreImports().length, 'nothing in this package imports from @quorum/core at all').toBeGreaterThan(1);
  });

  test('Q-0127 AC-2 — the ticket routes open no file of their own', () => {
    // Both reads a ticket page makes are `core`'s, which is *"Enforced in `core`, so the CLI and
    // M3's server inherit one rule instead of each writing a weaker one"* — `docs/GLOSSARY.md`,
    // **Confinement** — executed rather than restated. A route module that opened a file itself
    // would be a second boundary around the same folder, and a weaker one: it is `pathInside` that
    // resolves a leaf through `realpathSync`, and a `readFileSync` on a joined path does not.
    //
    // Scoped to `read.ts` deliberately. `static.ts` opens files and must: it serves a built bundle
    // out of a root the operator supplied, a different declared root with its own confinement. What
    // this clause claims is about the module that answers for a ticket folder.
    // Over the CODE and not over the prose, which is the distinction this file already draws where
    // it removed a clause for firing on a docblock explaining the decision it was checking: the
    // module's own JSDoc has to name `readFileSync` to say why it does not call one.
    const module = read(SRC, 'read.ts');
    const code = module.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    expect(code, 'read.ts imports node:fs').not.toMatch(/from '\s*node:fs'/);
    for (const opener of ['readFileSync', 'readFile(', 'openSync', 'createReadStream', 'readdirSync']) {
      expect(code.includes(opener), `read.ts opens a file itself: ${opener}`).toBe(false);
    }
    // The comment-stripping has a subject and does not eat the file: the module's own code is still
    // there to scan, and a needle inside a comment is what it removes.
    expect(code, 'the strip removed the module itself').toContain('app.get(');
    expect(code.length, 'the strip removed most of the module').toBeGreaterThan(module.length / 4);
    expect("const x = 1; /* readFileSync */".replace(/\/\*[\s\S]*?\*\//g, '').includes('readFileSync')).toBe(false);
    // …and it really does reach `core` for both of them, so the emptiness above is a delegation
    // rather than a module that reads nothing at all.
    for (const symbol of ['listTicketFiles', 'readTicketFileBytes']) {
      expect(module, `read.ts does not reach core's ${symbol}`).toContain(symbol);
    }
    // The needles discriminate, over a fixture rather than over an empty corpus.
    const hostile = "import fs from 'node:fs';\nconst text = fs.readFileSync(path.join(dir, rel), 'utf8');";
    expect(/from '\s*node:fs'/.test(hostile)).toBe(true);
    expect(hostile.includes('readFileSync')).toBe(true);
  });

  test('Q-0127 AC-7 — this package declares neither new wire shape of its own', () => {
    // A moved type with no schema is the half-measure Q-0120 had to repair, and a second
    // declaration beside a re-export is free to drift from the one a browser executes. Both shapes
    // are `@quorum/shared`'s, and this package re-exports the names.
    for (const shape of ['WireTicketDetail', 'WireTicketFile', 'WireTicketFileEntry', 'WireExcludedFiles']) {
      const offenders = packageFiles()
        .filter(([, text]) => new RegExp(`\\b(?:interface|type)\\s+${shape}\\s*[={]`).test(text))
        .map(([file]) => file);
      expect(offenders, `${shape} is declared in this package`).toStrictEqual([]);
    }
    // It re-exports two of them, so the absence above is a delegation rather than four names this
    // package never heard of.
    expect(read(SRC, 'read.ts'), 'read.ts does not re-export the detail shape').toContain('WireTicketDetail');
    expect(read(SRC, 'index.ts'), 'the barrel does not re-export the detail shape').toContain('WireTicketDetail');
    // And the needle finds a declaration when there is one.
    expect(/\b(?:interface|type)\s+WireTicketFile\s*[={]/.test('export interface WireTicketFile { rel: string }')).toBe(true);
  });
});

describe('AC-3 — run identity has one authority, and it is not an event\'s prose', () => {
  /**
   * Every `.message` read this package's production source performs, and what it reads it from.
   *
   * The register is the claim: a read appearing in a file that is not here fails, and an entry
   * naming a file with no read fails too. The mechanical half is beneath it — every receiver must
   * be `error`, so a read of an event's `message` is reported by its receiver rather than by
   * somebody noticing.
   */
  const MESSAGE_READS: Record<string, { receiver: string; why: string }> = {
    'host.ts': { receiver: 'error', why: 'the error a failed stream closed with, in `consume`\'s catch — an Error, never an Event' },
    'failures.ts': { receiver: 'error', why: 'the condition `core` named, in `conditionOf` — an Error, never an Event' },
    // Q-0119. `readRun`'s `malformed` arm carries the READER's own diagnostic, which is a field of a
    // narrowed result rather than prose from an event — so the receiver is the result. The register
    // names it rather than the rule allowing any receiver: an unregistered one still fails, which is
    // what keeps this from becoming a blanket exemption.
    'read.ts': { receiver: 'read', why: "readRun's malformed outcome, whose message is the reader's own diagnostic — a narrowed result, never an Event" },
  };

  test('no `.message` is read off anything but an Error, and the register names where', () => {
    const withReads = production().filter(([, text]) => /\.message\b/.test(text)).map(([file]) => file);
    expect(withReads.sort()).toStrictEqual(Object.keys(MESSAGE_READS).sort());
    for (const [file, text] of production()) {
      const allowed = MESSAGE_READS[file]?.receiver;
      for (const match of text.matchAll(/(\w+)\s*\.\s*message\b/g)) {
        expect(match[1], `${file} reads .message off \`${String(match[1])}\`, which its register entry does not name`).toBe(allowed);
      }
    }
  });

  test('no gateId is taken apart, and nothing names core\'s run-number allocator', () => {
    for (const [file, text] of sources()) {
      expect(text, `${file} applies a string operation to a gateId`).not.toMatch(/\bgateId\s*\./);
      expect(text, `${file} names nextRunId`).not.toContain('nextRunId');
      expect(text, `${file} parses an integer out of something`).not.toContain('parseInt');
    }
  });

  test('and the one run number this host holds is assigned from the terminal event and nowhere else', () => {
    const host = read(SRC, 'host.ts');
    const assignments = [...host.matchAll(/record\.runId\s*=\s*([^;]+);/g)].map((match) => match[1]?.trim());
    expect(assignments, 'the assignment this clause is about has gone').toStrictEqual(['event.runId']);
    // And the initial value is the admission rather than a plausible number.
    expect(host).toContain('runId: null');
  });
});

describe('AC-6 — the run\'s stream is iterated at exactly one site', () => {
  test('host.ts takes the iterator once, and `subscribe` never takes one at all', () => {
    // The behavioural half is `host.test.ts`'s — two subscribers, every event once each — and the
    // hazard is demonstrated there too, on a stream that test owns. What only the source can say is
    // that there is ONE place the run's own iterable is iterated: a `subscribe` that returned it
    // would be correct for the first watcher and throw for the second, which is the failure the
    // first watcher is least likely to reveal.
    const host = read(SRC, 'host.ts');
    const takes = host.split('[Symbol.asyncIterator]()').length - 1;
    expect(takes, `host.ts iterates the run's stream at ${takes} sites`).toBe(1);
    const subscribe = host.slice(host.indexOf('subscribe(handle)'), host.indexOf('answer(handle, envelope)'));
    expect(subscribe, 'the slice this clause reads is empty').not.toBe('');
    expect(subscribe, '`subscribe` takes an iterator of its own').not.toContain('[Symbol.asyncIterator]');
    expect(subscribe, '`subscribe` hands back something other than the fan-out').toContain('broadcast?.subscribe()');
  });
});

describe('AC-5 — the remedy exists at one site, and is not a shell imperative', () => {
  test('exactly one production module carries the remedy', () => {
    const carriers = production()
      .filter(([, text]) => text.includes('point the server at a directory holding harness/harness.yaml'))
      .map(([file]) => file);
    expect(carriers).toStrictEqual(['refusal.ts']);
  });

  test('and nothing this package can put in a response tells anybody to type a command', () => {
    // A server serves somebody who may not have a shell — the reasoning of the entry this surface
    // was ruled under. `quorum init` is the CLI's remedy and stays there.
    //
    // Over everything except the tests, because the criterion's subject is what this package
    // PRODUCES: a test asserting the imperative's absence has to quote it, and a corpus that
    // refused that would forbid checking the thing it is checking.
    const responders = packageFiles().filter(([name]) => !name.endsWith('.test.ts'));
    expect(responders.length, 'the non-test scan found nothing').toBeGreaterThan(5);
    for (const [file, text] of responders) {
      expect(text, `${file} tells a caller to run \`quorum init\``).not.toContain('quorum init');
    }
  });

  test('the module that owns the remedy names no core symbol at all', () => {
    // The clause this file used to make here was `toContain('condition: string')`, which the
    // `Refusal` interface's own FIELD satisfies — so it passed over a module that imported
    // `ProjectNotFoundError` and classified with `instanceof`, which is the violation it claimed to
    // forbid. *"A check is not established by reading it"* (2026-08-29), caught by review.
    //
    // What AC-5 requires is structural and is checked structurally: the remedy module reaches for
    // nothing of `core`'s, so it cannot classify, and classifying is what `failures.ts` is for —
    // `packages/cli`'s six `instanceof ProjectNotFoundError` call sites against one `dieNoProject`.
    const remedy = read(SRC, 'refusal.ts');
    expect(remedy, 'the remedy module imports from @quorum/core').not.toContain('@quorum/core');
    expect(remedy, 'the remedy module names a core error class').not.toContain('ProjectNotFoundError');
    // A third clause forbidding the word `instanceof` was written here and removed: it fired on the
    // module's own docblock, which explains where the `instanceof` went. A scan that cannot tell
    // prose from code refuses the record of a decision for repeating the word it decided about —
    // the reasoning AC-2's barrel clause above already gives — and it buys nothing, because a module
    // that names neither the package nor the error class has nothing to classify against.
  });

  test('and every remedy it composes takes the condition as a string', () => {
    // Over the SIGNATURES rather than the file's text, which is the difference between this clause
    // and the one it replaced: a parameter is what `dieNoProject` bounds, and an interface field
    // spelled the same way is not one.
    const remedy = read(SRC, 'refusal.ts');
    const signatures = [...remedy.matchAll(/export function (\w+)\(([^)]*)\)/g)];
    expect(signatures.length, 'the signature scan found no exported function at all').toBeGreaterThan(1);
    for (const signature of signatures) {
      expect(signature[2]?.trim(), `refusal.ts's ${String(signature[1])} does not take the condition as a string`)
        .toBe('condition: string');
    }
  });

  test('and the classification lives outside it, at one site', () => {
    const classifiers = production()
      .filter(([, text]) => text.includes('instanceof ProjectNotFoundError'))
      .map(([file]) => file);
    expect(classifiers).toStrictEqual(['failures.ts']);
  });

  test('and those clauses discriminate — they fire on the module they were written against', () => {
    // Demonstrated on the shape the review found, because the shape is gone from the tree: a remedy
    // module that imports the error class and takes the error rather than the condition.
    const hostile = [
      "import { ProjectNotFoundError } from '@quorum/core';",
      'export function refusalFor(error: unknown): Refusal {',
      '  return { condition: String(error), remedy: error instanceof ProjectNotFoundError ? R : null };',
      '}',
    ].join('\n');
    expect(hostile).toContain('@quorum/core');
    expect(hostile).toContain('ProjectNotFoundError');
    const signatures = [...hostile.matchAll(/export function (\w+)\(([^)]*)\)/g)];
    expect(signatures[0]?.[2]?.trim()).not.toBe('condition: string');
  });
});

describe('AC-12 and AC-13 — a library, with no socket, no signal handler and no key path', () => {
  test('nothing in this package hand-rolls a transport, and nothing but the tests opens a client', () => {
    // **Two corpora since Q-0122, and the split is a correction rather than a relaxation.** What
    // this clause claims is that the package implements no transport of its own — `serve.ts` opens
    // a socket THROUGH `@hono/node-server`, which is the architecture document's choice, and
    // everything below it is a library. That is a claim about production source. The whole-package
    // half stayed whole-package: a file that starts a second server, or reaches for a raw socket
    // family with no client use, is a violation wherever it sits.
    //
    // What moved is `node:http`/`node:https`, and the reason is measured: `static.test.ts` has to
    // write a request path onto the request line **unaltered**, because `fetch` builds a `URL` and
    // a `URL` resolves `..` before a byte leaves the process — so a traversal suite driven through
    // `fetch` would report every escape refused while never sending one. It needs a raw client, and
    // a client is not a listener.
    //
    // **The honest half: this clause never bound the tests in the first place.** `serve.test.ts`
    // has driven real sockets since Q-0118 and passes it only because `fetch` is a global needing
    // no import — so the corpus already failed to see what it would have called a violation, and
    // narrowing it here makes the two halves say what each is actually about.
    const HAND_ROLLED = [/node:net\b/, /node:tls\b/, /node:dgram\b/, /createServer\s*\(/, /\.listen\s*\(/, /\bfrom 'ws'/];
    const CLIENT_ONLY = [/node:http\b/, /node:https\b/];
    for (const [file, text] of packageFiles()) {
      for (const pattern of HAND_ROLLED) {
        expect(pattern.test(text), `${file} matches ${String(pattern)}`).toBe(false);
      }
    }
    for (const [file, text] of production()) {
      for (const pattern of CLIENT_ONLY) {
        expect(pattern.test(text), `production file ${file} matches ${String(pattern)}`).toBe(false);
      }
    }
    expect(packageFiles().length, 'the package scan found nothing').toBeGreaterThan(5);
    expect(production().length, 'the production scan found nothing').toBeGreaterThan(5);
  });

  test('nothing registers a process signal handler or exits the process', () => {
    for (const [file, text] of packageFiles()) {
      expect(text, `${file} registers a signal handler`).not.toMatch(/process\.(on|once|addListener)\s*\(\s*['"]SIG/);
      expect(text, `${file} exits the process`).not.toMatch(/process\.exit\s*\(/);
    }
  });

  test('and the scans discriminate — they fire on a file that does those things', () => {
    // Demonstrated rather than observed passing: a scan that matched nothing at all would satisfy
    // every clause above while proving nothing (2026-08-29).
    const hostile = "import net from 'node:net';\nprocess.on('SIGINT', () => process.exit(1));\n";
    expect(/node:net\b/.test(hostile)).toBe(true);
    expect(/process\.(on|once|addListener)\s*\(\s*['"]SIG/.test(hostile)).toBe(true);
    expect(/process\.exit\s*\(/.test(hostile)).toBe(true);
    expect(/\.listen\s*\(/.test("server.listen(3000);")).toBe(true);
    // And the half Q-0122 narrowed still fires where it now applies — a production file reaching
    // for a raw HTTP module — so what moved is the corpus and not the rule.
    expect(/node:http\b/.test("import http from 'node:http';")).toBe(true);
    // …while a second server is refused in a TEST too, which is what keeps the narrowing from
    // being a hole: the client is allowed there and the listener is not.
    expect(/createServer\s*\(/.test("const s = http.createServer(handler);")).toBe(true);
  });

  test('loading the package adds no process listener at runtime either', async () => {
    // Counted before and after rather than asserted to be zero: whatever the runner installs for
    // itself is not this package's, and a verdict that depended on it would be a property of the
    // runner. The shape `packages/cli/src/frame.source.test.ts`'s AC-4(d) block already uses — and
    // it reads the source scan's subject by running it, which the scan above cannot.
    const before = { SIGINT: process.listenerCount('SIGINT'), SIGTERM: process.listenerCount('SIGTERM') };
    await import('./index.js');
    expect({ SIGINT: process.listenerCount('SIGINT'), SIGTERM: process.listenerCount('SIGTERM') })
      .toStrictEqual(before);
  });

  test('and that count fires — a module-scope registration is exactly what it catches', () => {
    const before = { SIGINT: process.listenerCount('SIGINT'), SIGTERM: process.listenerCount('SIGTERM') };
    const stray = (): void => {};
    process.on('SIGINT', stray);
    try {
      expect({ SIGINT: process.listenerCount('SIGINT'), SIGTERM: process.listenerCount('SIGTERM') })
        .not.toStrictEqual(before);
    } finally {
      process.off('SIGINT', stray);
    }
    expect({ SIGINT: process.listenerCount('SIGINT'), SIGTERM: process.listenerCount('SIGTERM') })
      .toStrictEqual(before);
  });

  test('no path, fixture or example in this package carries an API key', () => {
    // BYOS: adapters run on the vendor CLI's own subscription login, and this package adds no path
    // of any kind. The word is `subscription`.
    for (const [file, text] of packageFiles()) {
      for (const key of ['ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'CODEX_API_KEY', 'apiKey', 'Bearer ']) {
        expect(text.includes(key), `${file} names ${key}`).toBe(false);
      }
    }
  });
});

/**
 * Every route this package registers, derived from the source rather than written down.
 *
 * `METHOD path` pairs rather than paths alone, and the method is what makes the guard able to see
 * this ticket's own work: `GET /runs` and `POST /runs` are the same path, so a path-only register
 * would report the listing as documented on the strength of a sentence about the start route
 * written in August — the guard would pass over the one route it was added for, and GO-5's red
 * demonstration would be impossible for it.
 *
 * It reads the FIRST ARGUMENT of each `app.get(` / `app.post(` call, over the production half of
 * `src`, so `serve.ts`'s WebSocket upgrade is collected with the rest. No parser: a call whose path
 * is not a quoted literal is reported rather than skipped, which fails closed the way
 * `turbo-inputs.test.ts` clause C1 does.
 */
const registeredRoutes = (): string[] => {
  const found: string[] = [];
  const unquoted: string[] = [];
  for (const [file, text] of production()) {
    for (const match of text.matchAll(/\bapp\.(get|post|put|patch|delete)\s*\(\s*([^,)]*)/g)) {
      const method = (match[1] ?? '').toUpperCase();
      const argument = (match[2] ?? '').trim();
      const literal = /^(['"])(\/[^'"]*)\1$/.exec(argument);
      if (literal) found.push(`${method} ${literal[2] ?? ''}`);
      else unquoted.push(`${file}: app.${match[1] ?? ''}(${argument})`);
    }
  }
  expect(unquoted, 'a route is registered at a path this guard cannot read, so it cannot be checked')
    .toStrictEqual([]);
  return [...new Set(found)].sort();
};

/**
 * §`packages/server` of the architecture document, sliced out rather than searched for.
 *
 * A sentence elsewhere on the page must not satisfy a claim about what this section says — the
 * hazard `packages/shared/src/docs.test.ts` names for its own slice of the same section, and it is
 * live here: the status line at the top of the document names several of these routes.
 *
 * **This read needs no declaration in `packages/server/turbo.json`, and that is measured rather
 * than assumed** (Q-0072). Q-0121 wrote one and removed it: appending a line to
 * `docs/04-architecture.md` moved this task's hash from `f03a2d8a7e5b817e` to `247ae7d079123910`
 * with no package configuration at all, because `@quorum/shared#test` declares that file for its
 * own assertions over this same section and the root `test` task's `^test` edge puts that task's
 * hash inside this one. Declaring it here would over-declare, which is the reasoning
 * `packages/cli`'s own audit gives for the reads it leaves out.
 *
 * **A configuration exists now and this read is still not in it** (Q-0122). That file declares the
 * two `apps/web` paths `static.test.ts` reads, which no `^test` edge carries — this package does
 * not depend on `@quorum/web` — and deliberately not this one. Re-measured with it in place, so the
 * claim is about today's tree rather than Q-0121's: a line appended to `docs/04-architecture.md`
 * moves the hash from `af22eee7bff15101` to `c4803a289c631250`, undeclared.
 *
 * The residual is stated rather than left to be found: **the coverage is transitive**, so it lasts
 * as long as `packages/shared` goes on reading that document. It is not fragile in practice — what
 * reads it there is `docs.test.ts`'s own block over this very section — but a change removing that
 * would take this read's hash with it, silently.
 */
const architectureSection = (): string => {
  const text = read(WORKSPACE, 'docs/04-architecture.md');
  const start = text.indexOf('### `packages/server`');
  if (start < 0) throw new Error('docs/04-architecture.md has no packages/server section — this check has lost its subject');
  const end = text.indexOf('\n### ', start + 1);
  return text.slice(start, end < 0 ? undefined : end);
};

describe('Q-0121 AC-13 — every route this package registers is named in the architecture document', () => {
  test('the derived set is the fourteen routes, so the register cannot silently shrink', () => {
    // An identity rather than a count (Q-0073): a count is satisfied by a route swapped for
    // another. `GET /*` is Q-0122's static route and sorts first; two are Q-0121's; two are
    // Q-0127's; the rest are Q-0118's and Q-0119's, and the document named Q-0119's five as a noun
    // list and never as routes until Q-0121 — which this guard is what found, a paragraph behind
    // the code.
    expect(registeredRoutes()).toStrictEqual([
      'GET /*',
      'GET /flows', 'GET /history', 'GET /history/:id', 'GET /project', 'GET /runs',
      'GET /runs/:id', 'GET /runs/:id/events', 'GET /tickets', 'GET /tickets/:id',
      'GET /tickets/:id/file',
      'POST /runs', 'POST /runs/:id/gate', 'POST /runs/:id/stop',
    ]);
  });

  test('Q-0122 — the static route is reachable by this derivation, which `app.use` would not be', () => {
    // **The measured trap, named because the requirement named it and the alternative was real.**
    // `registeredRoutes` matches `app.(get|post|put|patch|delete)` with a quoted first argument and
    // **does not match `app.use` at all** — so mounting the static handler as middleware, which is
    // the natural shape for one, would have made it invisible to the guard that holds the route set
    // against the architecture document. It is registered with `app.get('/*', …)` for that reason,
    // and this clause is what says so rather than a comment claiming it.
    expect(registeredRoutes(), 'the static route left the derived set').toContain('GET /*');
    const asMiddleware = "app.use('/*', staticHandler);";
    const seen = [...asMiddleware.matchAll(/\bapp\.(get|post|put|patch|delete)\s*\(\s*([^,)]*)/g)];
    expect(seen, 'app.use is matched after all, so this trap is closed and the comment is stale')
      .toStrictEqual([]);
    // …and the derivation does read the shape that shipped, over the real source.
    expect(read(SRC, 'static.ts'), 'the static route is no longer registered with app.get and a literal')
      .toContain("app.get('/*'");
  });

  test('and each of them appears in that document\'s own section', () => {
    // Derived rather than a string check on two sentences, so it keeps working when a later ticket
    // adds a route: the failure then names the route rather than reporting that a paragraph moved.
    const section = architectureSection();
    for (const route of registeredRoutes()) {
      expect(section, `04-architecture.md's packages/server section does not name ${route}`).toContain(`\`${route}\``);
    }
  });

  test('the slice has a subject and stops where the section does', () => {
    // Anti-vacuity, in the shape `docs.test.ts` uses: a slice running to the end of the document
    // would carry the status line and `packages/cli`'s prose and satisfy the clause above without
    // this section saying anything.
    expect(architectureSection().length, 'the section is implausibly short').toBeGreaterThan(1000);
    expect(architectureSection(), 'the slice ran past the end of the section').not.toContain('Same commands as the spike');
    expect(architectureSection(), 'the slice ran back into the status line').not.toContain('*Status:');
  });

  test('and the clause fires — a route registered without the prose is reported by name (GO-5)', () => {
    // **Shown red rather than trusted green.** A guard over documentation that has already been
    // corrected passes vacuously, so the demonstration runs the real derivation and the real
    // comparison over a hostile source: one extra route, registered and undocumented.
    const hostile = "app.get('/runs/:id/cost', (c) => c.json({}));\napp.delete('/runs/:id', (c) => c.body(null, 204));";
    const derived = [...hostile.matchAll(/\bapp\.(get|post|put|patch|delete)\s*\(\s*(['"])(\/[^'"]*)\2/g)]
      .map((match) => `${(match[1] ?? '').toUpperCase()} ${match[3] ?? ''}`);
    expect(derived, 'the derivation this demonstration runs is not the one under test')
      .toStrictEqual(['GET /runs/:id/cost', 'DELETE /runs/:id']);
    const section = architectureSection();
    for (const route of derived) {
      expect(section, `${route} is documented, so this demonstration proves nothing`).not.toContain(`\`${route}\``);
    }
    // …and a path the guard cannot read is reported rather than skipped, which is the other
    // direction: a route reached through a constant would otherwise pass unseen.
    const computed = "const RUNS = '/runs';\napp.get(RUNS, (c) => c.json({}));";
    const readable = [...computed.matchAll(/\bapp\.(get|post)\s*\(\s*([^,)]*)/g)]
      .map((match) => /^(['"])(\/[^'"]*)\1$/.exec((match[2] ?? '').trim()));
    expect(readable, 'a computed route path was read as a literal').toStrictEqual([null]);
  });
});

describe('Q-0125 AC-11 — nothing gives "no export surface" as the reason an arrangement exists', () => {
  test('the barrel keeps the arrangement and states the reason that survives', () => {
    // **The premise moved and the conclusion did not, which is why this asserts both halves.** The
    // transport docblock gave *"this package having no export surface"* as why `WireMessage`,
    // `WireRefusal` and `WireRun` live in `@quorum/shared`. That premise is false since AC-1, and
    // `.claude/rules/engineering.md` forbids a comment claiming what the code cannot back — but
    // deleting the premise and the conclusion together would reinstate the drift Q-0120 repaired,
    // a moved type with no schema. So the negative and the positive are asserted as a pair: the
    // dead reason is gone, the arrangement is still named, and the owner is still `@quorum/shared`.
    const barrel = read(SRC, 'index.ts');
    expect(barrel, 'the barrel still gives "no export surface" as a reason').not.toMatch(/no export surface/);
    expect(barrel, 'the barrel no longer names @quorum/shared as the owner of the wire shapes')
      .toMatch(/all three are now `@quorum\/shared`'s and\s+\* re-exported here/);
    expect(barrel, 'the barrel does not say why the shapes stay there now')
      .toMatch(/a moved type with\s+\* no schema is the half-measure Q-0120 had to repair/);
  });

  test('and the negative has a subject — the same needle finds the superseded wording', () => {
    // Anti-vacuity in the shape `docs.test.ts` uses: a clause refusing a sentence must be shown to
    // find it where it is written, or it is indistinguishable from one that matches nothing.
    const asItWas = 'because a browser consumes them from\n * `@quorum/shared` directly — this package having no export surface — and needs a runtime parser';
    expect(asItWas, 'the fixture no longer reproduces the wording this clause refuses').toMatch(/no export surface/);
  });

  // **No third clause reading `apps/web`'s manifest, and the omission is deliberate.** Decision 093
  // clause 5 records that the protection left behind is that register — `apps/web/test/package.test.ts`
  // holds the justifications against the declared manifest in both directions and pins
  // `dependencies` to exactly three names, so adding `@quorum/server` there fails two assertions
  // with no change from this ticket. Asserting it a second time from here would be one rule with
  // two enforcers, which is the drift this repository keeps finding — and it would add an
  // out-of-package read from the one package `turbo-inputs.test.ts` does not scan, where nothing
  // would report the missing declaration (R-5). What is owed is the document correction, and that
  // is `docs.test.ts`'s.
});

describe('Q-0130 AC-1 — the start field set is read from the vocabulary package, never written here', () => {
  test('no file in this package writes a list of the five names', () => {
    // **The register moved rather than being copied**, and this is the half that says so. Until
    // Q-0130 `http.ts` held the set as its own literal and `host.ts` as an interface; a browser
    // needing an executable builder for the same five names would have made a third, which is
    // verbatim the drift Q-0120 was opened on.
    //
    // **The subject is ONE list naming the accepted set**, not the five names anywhere in a file —
    // and the distinction is measured rather than stylistic. `startRequestOf` legitimately carries
    // three OTHER lists, each about a different rule: `flow` and `ticket` are the two that must be
    // non-empty strings, `dry` and `auto` the two that must be booleans, and `base` the one that
    // must be a string. Between them they name all five, and a scan for the names would report a
    // predicate that is not a second register at all — a guard keyed on a name rather than on the
    // behaviour, which is the family this repository records most.
    //
    // So the unit is a bracketed group, and what is forbidden is one that holds all five.
    const namesAll = (group: string): boolean =>
      WIRE_START_FIELDS.every((field) => group.includes(`'${field}'`) || group.includes(`"${field}"`));
    const lists = (text: string): string[] => [...text.matchAll(/\[[^\]]*\]/g)].map((found) => found[0]);
    for (const [file, text] of production()) {
      expect(lists(text).filter(namesAll), `${file} writes a second list of the start fields`).toStrictEqual([]);
    }
    expect(production().length, 'the production scan found nothing').toBeGreaterThan(5);
    // It discriminates, over the literal this ticket removed from `http.ts` — assembled, so this
    // file is not its own subject under the scan above — and over the three that must survive.
    const asItWas = `const START_FIELDS = new Set([${"'flow'"}, ${"'ticket'"}, 'dry', 'auto', 'base']);`;
    expect(lists(asItWas).filter(namesAll).length, 'the needle no longer finds the literal it was written against').toBe(1);
    for (const kept of ["for (const key of ['flow', 'ticket'] as const)", "for (const key of ['dry', 'auto'] as const)"]) {
      expect(lists(kept).filter(namesAll), `the needle reports the surviving predicate ${kept}`).toStrictEqual([]);
    }
  });

  test('and the route really does build its set from the tuple, so the absence is a delegation', () => {
    // A negative alone is satisfied by a package that stopped validating start bodies at all. The
    // positive half: `http.ts` names the shared tuple, and the sentence its `unknown-field` remedy
    // composes is that tuple's own order — which `http.test.ts` asserts a client actually receives.
    const route = production().find(([name]) => name === 'http.ts')?.[1] ?? '';
    expect(route, 'there is no route module — this clause has lost its subject').not.toBe('');
    expect(route, 'the route does not build its field set from the shared tuple').toContain('WIRE_START_FIELDS');
    expect([...WIRE_START_FIELDS].join(', '), 'the remedy sentence would no longer name the five in order')
      .toBe('flow, ticket, dry, auto, base');
  });
});

describe('AC-14 — this package declares no budget of its own', () => {
  test('no file sets a testTimeout, and the configuration is the shared one re-exported', () => {
    // `vitest.shared.js`'s 20 s was CHOSEN against a measured worst case, and its own comment names
    // a per-file override as how the accidental 5 s default arrived. A local one here would be the
    // regression rather than the convenience (Q-0102).
    for (const [file, text] of packageFiles()) {
      expect(text, `${file} declares a testTimeout of its own`).not.toContain('testTimeout');
    }
    expect(read(PACKAGE, 'vitest.config.js').trim()).toBe("export { default } from '../../vitest.shared.js';");
  });
});
