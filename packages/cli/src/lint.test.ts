/**
 * Q-0091 AC-2, AC-4, AC-5 and AC-6 for `quorum lint`.
 *
 * **The translated half of `spike/test/q0033-surface.js`'s three lint sites**, and the extraction it
 * performs is translated with it: {@link diagnostic} is that file's `flowDiagnostic` (`:38–46`),
 * which finds a file's block by its `✗ <filename>` header and takes the indented `- ` lines under
 * it. The scenarios reproduced are S1.3 (the shipped directory lints clean), S6.2–S6.10 (the
 * return-chain cases) and S9's multi-file aggregation. `spike-parity.test.ts` records the transfer
 * on `q0033-surface.js`'s row as `binaryCarriedBy`.
 *
 * Every fixture builds its own project directory under `os.tmpdir()` and never reads or writes this
 * repository, except for the shipped flow files S1.3 is about — copied in, exactly as
 * `q0033-surface.js`'s own `copyFlows` copies them. Nothing here spawns the binary: the binary's own
 * end-to-end suite is Q-0095's.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { findProject, ProjectNotFoundError } from '@quorum/core';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { ERROR, SUCCESS } from './exit.js';
import { invoke, plain } from '../test/invoke.js';

/** The repository root, reached package-relatively — this file names no absolute path. */
const WORKSPACE = fileURLToPath(new URL('../../..', import.meta.url));

/** The shipped flow directory, which S1.3 is about and which nothing here modifies. */
const SHIPPED_FLOWS = path.join(WORKSPACE, 'harness', 'flows');

let dir = '';
let cwd = '';

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'quorum-cli-lint-'));
  fs.mkdirSync(path.join(dir, 'harness', 'flows'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'harness', 'harness.yaml'), 'repo:\n  base_branch: main\n', 'utf8');
  cwd = process.cwd();
  process.chdir(dir);
});

afterEach(() => {
  process.chdir(cwd);
  fs.rmSync(dir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

/** Write `files` as `<name>.yaml` into the fixture's flow directory — `q0033-surface.js`'s shape. */
const flows = (files: Record<string, string>): void => {
  const into = path.join(dir, 'harness', 'flows');
  fs.rmSync(into, { recursive: true, force: true });
  fs.mkdirSync(into, { recursive: true });
  for (const [name, body] of Object.entries(files)) fs.writeFileSync(path.join(into, `${name}.yaml`), body, 'utf8');
};

/** A minimal flow with no steps, as `q0033-surface.js`'s `basicFlow` builds one. */
const basicFlow = (name: string, consumes: string, produces: string): string =>
  `name: ${name}\nconsumes: ${consumes}\nproduces: ${produces}\nsteps: []\n`;

/**
 * A flow whose one step carries a cross-flow backward edge to `goto`.
 *
 * Written here rather than read from `contracts/Q-0006/review-flow.contract.yaml`, which is what
 * `q0033-surface.js`'s `reviewWith` does: that file is a frozen contract belonging to `core`'s lint
 * suite, and reading it would make this package's verdict depend on a document it does not own.
 * What the return-chain cases need is a step with an `on_fail: goto: flow:<name>`, and that is all
 * this builds.
 */
const reviewWith = (goto: string, maxIterations = 3): string => [
  'name: review',
  'consumes: green',
  'produces: reviewed',
  'steps:',
  '  - id: verdict',
  '    role: code-reviewer',
  '    adapter: claude',
  '    output: {verdict: approve|revise}',
  `    on_fail: {goto: "${goto}", counter: review, max_iterations: ${String(maxIterations)}, on_exhausted: gate}`,
  '',
].join('\n');

/**
 * The diagnostic block a file earned, as `spike/test/q0033-surface.js:38–46` extracts it: the
 * `✗ <filename>` header line and every indented `- ` line beneath it, ANSI stripped.
 *
 * Translated rather than replaced by a whole-output match, because the shape is the claim — a
 * renderer that printed the problems without a header, or under the wrong file, would satisfy a
 * `toContain` and fail this.
 */
const diagnostic = (output: string, filename: string): string => {
  const lines = plain(output).split('\n');
  const start = lines.findIndex((line) => new RegExp(`^[✗x]\\s+${filename.replace('.', '\\.')}$`, 'u').test(line.trim()));
  expect(start, `missing diagnostic block for ${filename}`).toBeGreaterThanOrEqual(0);
  const block = [lines[start].trim()];
  for (let i = start + 1; i < lines.length && /^\s+-\s/.test(lines[i]); i++) block.push(lines[i].trim());
  return block.join('\n');
};

describe('AC-5 — the walk is core\'s and the rendering is the CLI\'s', () => {
  test('S1.3 — the complete shipped flow directory lints clean and exits 0', async () => {
    fs.rmSync(path.join(dir, 'harness', 'flows'), { recursive: true, force: true });
    fs.cpSync(SHIPPED_FLOWS, path.join(dir, 'harness', 'flows'), { recursive: true });
    const shipped = fs.readdirSync(SHIPPED_FLOWS).filter((name) => name.endsWith('.yaml'));
    expect(shipped.length, 'the shipped directory holds no flow — this scenario proves nothing').toBeGreaterThan(4);

    const { stdout, exitCode, hard } = await invoke(['lint']);
    expect(exitCode).toBe(SUCCESS);
    expect(hard, 'a clean lint must not stop the process').toBe(false);
    for (const name of shipped) expect(plain(stdout)).toContain(`✓ ${name}`);
    expect(plain(stdout)).not.toContain('✗');
  });

  test('a clean file is a green tick and a failing one is a red cross with its problems indented', async () => {
    flows({ dead: reviewWith('flow:nowhere'), fine: basicFlow('fine', 'x', 'y') });
    const { stdout, exitCode } = await invoke(['lint']);
    expect(exitCode).toBe(ERROR);
    expect(plain(stdout)).toContain('✓ fine.yaml');
    expect(diagnostic(stdout, 'dead.yaml')).toMatch(/^✗ dead\.yaml\n- /);
    // The two-space indent, asserted on the untrimmed text: `diagnostic` trims each line exactly as
    // `q0033-surface.js`'s extraction does, so the indent is invisible to it and would be invisible
    // to every assertion in this file if it were asserted nowhere else.
    expect(plain(stdout)).toMatch(/^✗ dead\.yaml\n {2}- \S/m);
  });

  test('a multi-line lint message arrives as several bullets, because core already split it', async () => {
    // The flattening demonstrated rather than described: an unloadable flow's YAML error is one
    // string carrying three lines, and `flattenProblems` (core) turns it into three problems. The
    // CLI adds `  - ` to each — so a renderer that printed `record.problems.join()` would produce
    // one bullet here and pass every other assertion in this file.
    flows({ broken: 'name: broken\nsteps: [' });
    const { stdout, exitCode } = await invoke(['lint']);
    expect(exitCode).toBe(ERROR);
    const block = diagnostic(stdout, 'broken.yaml').split('\n');
    expect(block.length, 'the multi-line message was rendered as one bullet').toBeGreaterThan(2);
    expect(block.slice(1).every((line) => line.startsWith('- '))).toBe(true);
  });

  test('the colours are the palette\'s, written into the pipe as the spike writes them', async () => {
    // Q-0090 non-goal 11, unchanged: there is no TTY test and neither NO_COLOR nor FORCE_COLOR is
    // honoured, so the escapes are in the bytes. Asserted rather than stripped away everywhere, or
    // a renderer that had lost its colour would pass every other test in this file.
    flows({ dead: reviewWith('flow:nowhere'), fine: basicFlow('fine', 'x', 'y') });
    const { stdout } = await invoke(['lint']);
    expect(stdout).toContain('\x1b[32m✓\x1b[0m fine.yaml');
    expect(stdout).toContain('\x1b[31m✗\x1b[0m dead.yaml');
  });

  test.each([
    ['S6.3 missing', { review: reviewWith('flow:nonexistent'), development: basicFlow('development', 'red', 'green') }, /review.*nonexistent.*(missing|no such|load)/is],
    ['S6.4 unloadable', { review: reviewWith('flow:broken'), broken: 'name: broken\nsteps: [', development: basicFlow('development', 'red', 'green') }, /review[\s\S]*broken/is],
    ['S6.5 dead end', { review: reviewWith('flow:dead'), dead: basicFlow('dead', 'x', 'nowhere') }, /review.*dead.*nowhere/is],
    ['S6.6 ambiguity', { review: reviewWith('flow:a'), a: basicFlow('a', 'x', 'y'), b: basicFlow('b', 'y', 'z'), c: basicFlow('c', 'y', 'green') }, /review.*a.*y.*b.*c/is],
    ['S6.8/S6.10 cycle', { review: reviewWith('flow:a'), a: basicFlow('a', 'x', 'y'), b: basicFlow('b', 'y', 'x') }, /review.*a.*cycle/is],
    ['S6.9 self target', { review: reviewWith('flow:review') }, /review.*review.*reviewed/is],
  ] as const)('%s exits 1 and names the defect', async (_label, files, expected) => {
    flows({ ...files });
    const { stdout, exitCode } = await invoke(['lint']);
    expect(exitCode).toBe(ERROR);
    expect(plain(stdout)).toMatch(expected);
  });

  test.each([
    ['S6.2 multi-hop', { review: reviewWith('flow:qa-red'), 'qa-red': basicFlow('qa-red', 'qa', 'red'), development: basicFlow('development', 'red', 'green') }],
    ['S6.7 unreached ambiguity', { review: reviewWith('flow:development'), development: basicFlow('development', 'red', 'green'), x1: basicFlow('x1', 'unused', 'a'), x2: basicFlow('x2', 'unused', 'b') }],
  ] as const)('%s exits 0', async (_label, files) => {
    flows({ ...files });
    const { exitCode } = await invoke(['lint']);
    expect(exitCode).toBe(SUCCESS);
  });

  test('S9 — several broken files aggregate, each under its own header', async () => {
    flows({
      a: reviewWith('flow:missing'),
      b: reviewWith('flow:development', 0).replace('name: review', 'name: b'),
      development: basicFlow('development', 'red', 'green'),
    });
    const { stdout, exitCode } = await invoke(['lint']);
    expect(exitCode).toBe(ERROR);
    expect(plain(stdout)).toMatch(/missing/);
    expect(plain(stdout)).toMatch(/max_iterations/);
    // Two blocks rather than one aggregate: the extraction has to find each file's own header, so a
    // renderer that printed every problem under the first filename would fail here and nowhere else.
    expect(diagnostic(stdout, 'a.yaml')).toContain('missing');
    expect(diagnostic(stdout, 'b.yaml')).toContain('max_iterations');
    expect(plain(stdout)).toContain('✓ development.yaml');
  });

  test('an empty flow directory is clean, which is what makes `every` the right quantifier', async () => {
    const { stdout, exitCode } = await invoke(['lint']);
    expect(exitCode).toBe(SUCCESS);
    expect(stdout).toBe('');
  });
});

describe('AC-6 — the aggregate verdict reaches the process through failSoftly', () => {
  test('a failing lint sets the status and never calls process.exit', async () => {
    flows({ dead: reviewWith('flow:nowhere') });
    const { exitCode, hard, stdout } = await invoke(['lint']);
    expect(exitCode).toBe(ERROR);
    // The whole point of the divergence: the diagnostic is already printed when the status is set,
    // and `process.exit` would truncate it on a pipe. `hard` is false because `die` was never
    // reached — see fail.ts, and `fail.test.ts:203`, which pins that `failSoftly` calls no exit.
    expect(hard, 'the verdict must not stop the process').toBe(false);
    expect(plain(stdout)).toContain('✗ dead.yaml');
  });

  test('and the status is left unset on success rather than set to 0', async () => {
    // `process.exitCode = 0` and never assigning it are the same status and not the same act: the
    // frame's contract is that a command that succeeded leaves it alone (Q-0090 AC-5).
    const before = process.exitCode;
    await invoke(['lint']);
    expect(process.exitCode).toBe(before);
  });
});

describe('AC-4 — the project-not-found sentence survives the port unchanged', () => {
  /**
   * Run `body` from a directory with no project at or above it.
   *
   * `findProject` walks upwards, so "no project" is a property of the whole ancestry rather than of
   * one directory. It is asserted rather than assumed: on a machine whose temp directory sat inside
   * a checkout the fixture would find that project and every assertion below would be about
   * something else. The machine property **refuses the run** here and is never the oracle
   * (`harness/rules.md`; *"A test's verdict is a property of the commit"*, 2026-08-30).
   */
  const inAnOrphanDirectory = async (body: () => Promise<void>): Promise<void> => {
    const orphan = fs.mkdtempSync(path.join(os.tmpdir(), 'quorum-cli-orphan-'));
    const from = process.cwd();
    try {
      expect(findProject(orphan), `${orphan} sits inside a project, so this fixture is not orphaned`).toBeNull();
      process.chdir(orphan);
      await body();
    } finally {
      process.chdir(from);
      fs.rmSync(orphan, { recursive: true, force: true });
    }
  };

  test('lint from a directory with no project prints the sentence, exits 1, and shows no stack', async () => {
    await inAnOrphanDirectory(async () => {
      const { stdout, stderr, exitCode, hard } = await invoke(['lint']);
      expect(exitCode).toBe(ERROR);
      expect(hard, 'a missing project stops the command through die').toBe(true);
      expect(plain(stderr)).toContain('no harness/harness.yaml found — run `harness init` in your repo');
      expect(stdout).toBe('');
      // The regression AC-4 names: an uncaught ProjectNotFoundError reaches `dieOnUnexpected` and
      // prints a Node stack where the spike prints one sentence.
      expect(stderr).not.toMatch(/\n\s+at /);
      expect(stderr).not.toContain('ProjectNotFoundError');
    });
  });

  test('and the sentence is core\'s, not a second copy of it in this package', async () => {
    // A copy here would drift from `core`'s the day the OQ-2 successor renames the binary in it.
    // Read out of the error class rather than transcribed, and compared with what was printed.
    await inAnOrphanDirectory(async () => {
      const { stderr } = await invoke(['lint']);
      expect(plain(stderr).trim()).toBe(`✗ ${new ProjectNotFoundError().message}`);
    });
  });

  test('and --project at a directory holding no config is a different failure, as it is in the spike', async () => {
    // Not the sentence: `loadProject(dir)` with an explicit directory never consults `findProject`,
    // so an absent `harness/harness.yaml` there is an ENOENT that reaches `dieOnUnexpected` — which
    // is exactly what `spike/bin/harness.js:55` does, `flags.project ? path.resolve(flags.project)`
    // being unconditional. Pinned so the two failures are not conflated by a later widening of the
    // catch. Why: preserved, ground rule 3.
    const orphan = fs.mkdtempSync(path.join(os.tmpdir(), 'quorum-cli-noconfig-'));
    try {
      await expect(invoke(['lint', '--project', orphan])).rejects.toThrow(/ENOENT/);
    } finally {
      fs.rmSync(orphan, { recursive: true, force: true });
    }
  });

  test('a failure that is not a missing project is not swallowed as one', async () => {
    // The catch is narrowed on the error class rather than on `catch { die(…) }`, so a damaged
    // `harness.yaml` still reaches `main().catch(dieOnUnexpected)` and prints a stack, as it does in
    // the spike. Demonstrated with a `harness/` whose config is a directory, which `readFileSync`
    // refuses with EISDIR.
    const broken = fs.mkdtempSync(path.join(os.tmpdir(), 'quorum-cli-broken-'));
    fs.mkdirSync(path.join(broken, 'harness', 'harness.yaml'), { recursive: true });
    try {
      await expect(invoke(['lint', '--project', broken])).rejects.toThrow(/EISDIR|illegal operation/i);
    } finally {
      fs.rmSync(broken, { recursive: true, force: true });
    }
  });
});

describe('AC-2 — the command reads the parsed command line and never the process\'s', () => {
  test('it runs through main(argv), which is the boundary a re-parsing command would fail', async () => {
    // `process.argv` here is Vitest's, so a command reading it rather than its `ParsedArgv` would
    // see the runner's arguments and lint nothing. This test is the whole of what makes the source
    // scan in `frame.source.test.ts` a claim about behaviour rather than about text.
    flows({ fine: basicFlow('fine', 'x', 'y') });
    const { stdout, exitCode } = await invoke(['lint']);
    expect(exitCode).toBe(SUCCESS);
    expect(plain(stdout)).toBe('✓ fine.yaml\n');
  });

  test('--project reaches loadProject, so the flag the frame parsed is the one that decides', async () => {
    // Why: preserved, ground rule 3. `spike/bin/harness.js:55` reads `flags.project` *inside*
    // `loadProject`, which every call site — `lint` at `:401` among them — reaches by calling
    // `loadProject()` with no argument, so `harness lint --project <dir>` lints that project rather
    // than the working directory's. That closure is why AC-2's aside is wrong rather than the port:
    // the spike's `lint` case names no flag, so a reader checking only the case block concludes it
    // needs nothing from argv. Re-proved by execution against the spike, not inferred from the
    // source: `node spike/bin/harness.js lint --project <dir holding no harness.yaml>` exits 1 from
    // `loadProject` (`:58`), where the same flag on `validate` is ignored entirely.
    //
    // AC-2's normative half — no command re-parses the command line — is met: the value read is the
    // one the frame parsed, which is what the test above proves. What is wrong is its descriptive
    // aside that `lint` reads neither `rest` nor `flags`. An erratum correcting that aside is owed at
    // the gate; until it lands this pin is what makes the divergence a deliberate act rather than a
    // default choice, and it goes red if anyone narrows the handler to match the aside.
    const elsewhere = fs.mkdtempSync(path.join(os.tmpdir(), 'quorum-cli-elsewhere-'));
    fs.mkdirSync(path.join(elsewhere, 'harness', 'flows'), { recursive: true });
    fs.writeFileSync(path.join(elsewhere, 'harness', 'harness.yaml'), 'repo:\n  base_branch: main\n', 'utf8');
    fs.writeFileSync(path.join(elsewhere, 'harness', 'flows', 'over-there.yaml'), basicFlow('over-there', 'x', 'y'), 'utf8');
    flows({ 'in-the-cwd': basicFlow('in-the-cwd', 'x', 'y') });
    try {
      const { stdout } = await invoke(['lint', '--project', elsewhere]);
      expect(plain(stdout)).toBe('✓ over-there.yaml\n');
      expect(plain(stdout), 'the working directory decided, so the flag did nothing').not.toContain('in-the-cwd');
    } finally {
      fs.rmSync(elsewhere, { recursive: true, force: true });
    }
  });
});
