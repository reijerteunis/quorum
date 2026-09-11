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

import { eventSchema } from '@quorum/shared';
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
  bin?: unknown;
}

const read = (...parts: string[]): string => fs.readFileSync(path.join(...parts), 'utf8');
const manifest = (dir: string): Manifest => JSON.parse(read(dir, 'package.json')) as Manifest;

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
  .filter((file) => !path.relative(PACKAGE, file).split(path.sep).includes('node_modules'))
  .map((file) => [path.relative(PACKAGE, file), fs.readFileSync(file, 'utf8')] as [string, string])
  .filter(([name]) => name !== path.join('src', GUARD));

describe('AC-1 — the manifest declares what it depends on and nothing more', () => {
  const own = manifest(PACKAGE);

  test('the two workspace dependencies, and no external one', () => {
    // No Hono, no node adapter, no WebSocket library: the transport is Q-0118's, and the dependency
    // decision deliberately does not ride on the half that carries the risk.
    expect(own.dependencies).toStrictEqual({
      '@quorum/core': 'workspace:*',
      '@quorum/shared': 'workspace:*',
    });
    expect(own.devDependencies).toBe(undefined);
  });

  test('both are real — the lockfile carries the package and its two links', () => {
    // Declared and resolvable are two claims. `pnpm-lock.yaml` is read through the workspace root
    // and reaches this task through the `^test` edge the two dependencies create, which is what
    // covers `packages/cli`'s reads of the same kind.
    const lock = read(WORKSPACE, 'pnpm-lock.yaml');
    expect(lock).toContain('packages/server:');
    expect(lock.slice(lock.indexOf('packages/server:'))).toContain('@quorum/core');
  });

  test('it emits nothing: no build task, no exports map, no files allow-list, no bin', () => {
    // The local distribution set is three packages and this ticket does not make it four, which is
    // what keeps `packages/cli/src/build.test.ts`'s per-package emit register unchanged.
    expect(own.scripts?.build).toBe(undefined);
    expect(own.exports).toBe(undefined);
    expect(own.main).toBe(undefined);
    expect(own.types).toBe(undefined);
    expect(own.files).toBe(undefined);
    expect(own.bin).toBe(undefined);
    expect(own.name).toBe('@quorum/server');
    expect(own.private).toBe(true);
    expect(own.type).toBe('module');
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
  const MESSAGE_READS: Record<string, string> = {
    'host.ts': 'the error a failed stream closed with, in `consume`\'s catch — an Error, never an Event',
    'refusal.ts': 'the condition `core` named, in `conditionOf` — an Error, never an Event',
  };

  test('no `.message` is read off anything but an Error, and the register names where', () => {
    const withReads = production().filter(([, text]) => /\.message\b/.test(text)).map(([file]) => file);
    expect(withReads.sort()).toStrictEqual(Object.keys(MESSAGE_READS).sort());
    for (const [file, text] of production()) {
      for (const match of text.matchAll(/(\w+)\s*\.\s*message\b/g)) {
        expect(match[1], `${file} reads .message off \`${String(match[1])}\``).toBe('error');
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

  test('the module that owns the remedy names no core symbol in composing it', () => {
    // It takes the condition as a string, which is what `packages/cli/src/fail.ts`'s `dieNoProject`
    // does and for the same reason.
    const refusal = read(SRC, 'refusal.ts');
    expect(refusal).toContain('condition: string');
    expect(refusal).toContain('NO_PROJECT_REMEDY');
  });
});

describe('AC-12 and AC-13 — a library, with no socket, no signal handler and no key path', () => {
  test('nothing in this package opens or listens on anything', () => {
    const network = [/node:net\b/, /node:http\b/, /node:https\b/, /node:tls\b/, /node:dgram\b/, /createServer\s*\(/, /\.listen\s*\(/, /\bfrom 'ws'/];
    for (const [file, text] of packageFiles()) {
      for (const pattern of network) {
        expect(pattern.test(text), `${file} matches ${String(pattern)}`).toBe(false);
      }
    }
    expect(packageFiles().length, 'the package scan found nothing').toBeGreaterThan(5);
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
