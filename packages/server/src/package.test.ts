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

  test('it emits nothing: no build task, no exports map, no files allow-list, no bin', () => {
    // Two registers, not one, and this package is in neither. The **emitting** set is
    // `test-discovery.test.ts`'s and is four since Q-0122; the local **distribution** set is
    // `build.test.ts`'s `DISTRIBUTION` and is three. This comment named the second and reasoned
    // about the first, which was harmless while they were the same three packages and stopped being
    // so when `apps/web` gained a build task — see "A fourth package emits, and what it emits is
    // served rather than shipped" (2026-09-12). The assertions below are unaffected: a package that
    // emits nothing and ships nothing is out of both.
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
  test('the derived set is the twelve routes, so the register cannot silently shrink', () => {
    // An identity rather than a count (Q-0073): a count is satisfied by a route swapped for
    // another. `GET /*` is Q-0122's static route and sorts first; two are Q-0121's; the rest are
    // Q-0118's and Q-0119's, and the document named Q-0119's five as a noun list and never as
    // routes until Q-0121 — which this guard is what found, a paragraph behind the code.
    expect(registeredRoutes()).toStrictEqual([
      'GET /*',
      'GET /flows', 'GET /history', 'GET /history/:id', 'GET /project', 'GET /runs',
      'GET /runs/:id', 'GET /runs/:id/events', 'GET /tickets',
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
