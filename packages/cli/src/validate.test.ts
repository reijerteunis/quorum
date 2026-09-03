/**
 * Q-0091 AC-2, AC-6, AC-7, AC-8 and AC-9 for `quorum validate`.
 *
 * **The translated half of `spike/test/q0011-runs-cli.js`'s eight validate invocations**, which is
 * Q-0092's file: its `runs` half stays there and transfers with that ticket, and
 * `spike-parity.test.ts` records this one on its `binaryCarriedBy`. The scenarios reproduced are its
 * AC-14 structural mutations, its EDGE-13 annotation cases, and the six notice clauses its
 * *"the skipped-check notice leads with inapplicability"* scenario asserts.
 *
 * **The notice is asserted by its clauses and never as one string**, which is not a stylistic
 * choice: AC-9 requires the sentence to exist in exactly one file under `packages/**`, and a
 * `toBe(theWholeSentence)` here would be the second copy. The clauses are the ones
 * `contracts/Q-0011/runs-cli.contract.md:46–48` is about, and the last describe block below is what
 * keeps the count at one.
 *
 * Every fixture is built under `os.tmpdir()`. No schema here carries an `$id`: the one Ajv instance
 * caches every compiled schema by `$id` for the life of the process (Q-0045 AC-8 defect 1), so two
 * calls over one `$id` throw, and a fixture that carried one would fail for a reason that has
 * nothing to do with this command.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { findProject } from '@quorum/core';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { ERROR, SUCCESS } from './exit.js';
import { invoke, plain } from '../test/invoke.js';

/** The repository root, reached package-relatively — this file names no absolute path. */
const WORKSPACE = fileURLToPath(new URL('../../..', import.meta.url));

let dir = '';

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'quorum-cli-validate-'));
});

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

/** Write a JSON document into the fixture and answer its path. */
const put = (name: string, body: unknown): string => {
  const file = path.join(dir, name);
  fs.writeFileSync(file, typeof body === 'string' ? body : JSON.stringify(body, null, 2), 'utf8');
  return file;
};

/** A schema with no `x-quorum-contract`, so no semantic pass is selected. */
const GENERIC = { $schema: 'https://json-schema.org/draft/2020-12/schema', type: 'object', required: ['a'] };

/** Enough of the run manifest for the semantic pass to have something to disagree with. */
const RUN_MANIFEST = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  'x-quorum-contract': 'run-manifest-v1',
  required: ['status', 'steps', 'rollup'],
  properties: {
    status: { enum: ['running', 'completed', 'failed', 'aborted', 'regressed', 'exhausted', 'interrupted'] },
    started_at: { type: 'string' },
    ended_at: { type: ['string', 'null'] },
    duration_ms: { type: ['integer', 'null'] },
    steps: { type: 'array' },
    rollup: { type: 'array' },
  },
};

const CLEAN_RUN = {
  status: 'completed',
  started_at: '2026-09-03T10:00:00.000Z',
  ended_at: '2026-09-03T10:00:01.000Z',
  duration_ms: 1000,
  steps: [],
  rollup: [],
};
/** Structurally fine, and the roll-up claims a vendor no occurrence supports. */
const SEMANTICALLY_BROKEN = { ...CLEAN_RUN, rollup: [{ vendor: 'codex' }] };
/** Broken both ways, so the semantic pass is suppressed rather than merely silent. */
const STRUCTURALLY_INVALID = { ...SEMANTICALLY_BROKEN, status: 'nope' };

/** The line of `output` that is about `file` and is not its verdict — the notice, where one is due. */
const noticeFor = (output: string, file: string): string | undefined =>
  plain(output).split('\n').find((line) => line.includes(file) && !line.includes('matches') && !line.includes('violates'));

describe('AC-7 — the schema is read once, first, and a bad one dies with its own message', () => {
  test.each([
    ['no arguments at all', () => []],
    ['a schema and no artifact', () => [put('s.json', GENERIC)]],
  ] as const)('%s dies with the usage line and exits 1', async (_label, argv) => {
    const { stdout, stderr, exitCode, hard } = await invoke(['validate', ...argv()]);
    expect(exitCode).toBe(ERROR);
    expect(hard, 'a usage failure exits hard, as the spike does').toBe(true);
    // Why: preserved verbatim, `harness` and all — the binary name in this sentence belongs to the
    // OQ-2 successor, which owns every user-facing occurrence of it at once.
    expect(plain(stderr)).toContain('usage: harness validate <schema.json> <file…>');
    expect(stdout).toBe('');
  });

  test('an unreadable schema names itself and the reason, and no artifact is opened', async () => {
    const absent = path.join(dir, 'not-there.json');
    const artifact = put('d.json', { a: 1 });
    const reads = vi.spyOn(fs, 'readFileSync');
    const { stderr, exitCode, hard } = await invoke(['validate', absent, artifact]);
    expect(exitCode).toBe(ERROR);
    expect(hard).toBe(true);
    expect(plain(stderr)).toContain(`cannot read schema ${absent}: `);
    expect(plain(stderr)).toContain('ENOENT');
    // "before any artifact is opened" as a measurement rather than as an ordering claim about the
    // source: the artifact exists and is perfectly valid, and it is never read.
    expect(reads.mock.calls.filter(([file]) => file === artifact)).toStrictEqual([]);
  });

  test('a schema that is not JSON dies the same way', async () => {
    const bad = put('s.json', '{ not json');
    const { stderr, exitCode } = await invoke(['validate', bad, put('d.json', { a: 1 })]);
    expect(exitCode).toBe(ERROR);
    expect(plain(stderr)).toContain(`cannot read schema ${bad}: `);
  });
});

describe('AC-8 — per-file outcomes, one read per artifact, and the loop that continues', () => {
  test('each artifact is read exactly once, and the schema once per call plus the first read', async () => {
    const schema = put('s.json', GENERIC);
    const first = put('a.json', { a: 1 });
    const second = put('b.json', { a: 2 });
    const reads = vi.spyOn(fs, 'readFileSync');
    await invoke(['validate', schema, first, second]);
    const counted = (file: string): number => reads.mock.calls.filter(([opened]) => opened === file).length;
    // The property Q-0037 AC-9 gave `validateArtifact` to make possible, and it is invisible in the
    // output: the CLI used to call `validateFile` and then `readData(dataFile)` again a line later,
    // so every artifact was opened twice and the two reads could disagree. Counted, not reasoned
    // about — `q0011-runs-cli.js:190` counts the same thing on the other side of the port.
    expect(counted(first), 'the artifact was read more than once').toBe(1);
    expect(counted(second)).toBe(1);
    // One read for AC-7's early check plus one per `validateArtifact` call, which is the spike's own
    // count: the schema read is inside `validateArtifact` and hoisting it is not this ticket's fix.
    expect(counted(schema)).toBe(3);
  });

  test('a clean run manifest earns a green tick, prints no notice, and exits 0', async () => {
    const schema = put('run-manifest.schema.json', RUN_MANIFEST);
    const artifact = put('manifest.json', CLEAN_RUN);
    const { stdout, exitCode, hard } = await invoke(['validate', schema, artifact]);
    expect(exitCode).toBe(SUCCESS);
    expect(hard).toBe(false);
    expect(plain(stdout)).toBe(`✓ ${artifact} matches run-manifest.schema.json\n`);
    expect(plain(stdout)).not.toContain('x-quorum-contract');
  });

  test('a semantically broken manifest prints its errors indented four spaces, and still no notice', async () => {
    const schema = put('run-manifest.schema.json', RUN_MANIFEST);
    const artifact = put('manifest.json', SEMANTICALLY_BROKEN);
    const { stdout, exitCode } = await invoke(['validate', schema, artifact]);
    expect(exitCode).toBe(ERROR);
    expect(plain(stdout)).toContain(`✗ ${artifact} violates run-manifest.schema.json:\n    rollup: vendor "codex"`);
    expect(noticeFor(stdout, artifact), 'a recognised contract prints no skip notice').toBeUndefined();
  });

  test('a structurally invalid manifest prints no notice either, the two reasons being distinct', async () => {
    // `structurally-invalid` and `unrecognised-annotation` are two shapes of "the pass did not run"
    // and only the second earns the sentence: there the contract WAS recognised and the pass was
    // suppressed because the document is malformed, so a notice claiming no contract applies would
    // be false. Pinned structurally in `packages/core/src/contracts/validate-artifact.test.ts`; this
    // is the rendering half of the same claim.
    const schema = put('run-manifest.schema.json', RUN_MANIFEST);
    const artifact = put('manifest.json', STRUCTURALLY_INVALID);
    const { stdout, exitCode } = await invoke(['validate', schema, artifact]);
    expect(exitCode).toBe(ERROR);
    expect(plain(stdout)).toContain(`✗ ${artifact} violates run-manifest.schema.json:`);
    expect(noticeFor(stdout, artifact)).toBeUndefined();
  });

  test('an unreadable artifact is a red line, counts as bad, and the loop reaches the file after it', async () => {
    const schema = put('s.json', GENERIC);
    const absent = path.join(dir, 'gone.json');
    const good = put('good.json', { a: 1 });
    const { stdout, exitCode, hard } = await invoke(['validate', schema, absent, good]);
    expect(exitCode).toBe(ERROR);
    expect(hard, 'a bad artifact must not stop the run before the later files').toBe(false);
    expect(plain(stdout)).toContain(`✗ ${absent}: `);
    expect(plain(stdout)).toContain('ENOENT');
    expect(plain(stdout), 'the loop stopped at the first failure').toContain(`✓ ${good} matches s.json`);
  });

  test('files are reported in argv order, not in any order the filesystem suggests', async () => {
    const schema = put('s.json', GENERIC);
    const one = put('one.json', { a: 1 });
    const two = put('two.json', { a: 2 });
    const { stdout } = await invoke(['validate', schema, two, one]);
    expect(plain(stdout).indexOf(two)).toBeLessThan(plain(stdout).indexOf(one));
  });
});

describe('AC-8 — the notice, by the clauses the frozen contract is about', () => {
  /**
   * The three shapes of the one `unrecognised-annotation` outcome.
   *
   * All three are driven because the reason is named for the annotation being *unrecognised* and
   * not for it being missing, so a notice asserted over the absent case alone could go on claiming
   * absence over `unknown-v1` — which is the clause Q-0037's review round 1 added.
   */
  const SHAPES = [
    ['absent', GENERIC],
    ['unknown-v1', { ...GENERIC, 'x-quorum-contract': 'unknown-v1' }],
    ['empty', { ...GENERIC, 'x-quorum-contract': '' }],
  ] as const;

  test.each(SHAPES)('%s — the notice prints before the verdict and names the file', async (_label, schema) => {
    const schemaFile = put('other.schema.json', schema);
    const artifact = put('artifact.json', { b: 1 });
    const { stdout, exitCode } = await invoke(['validate', schemaFile, artifact]);
    expect(exitCode).toBe(ERROR);
    const lines = plain(stdout).trimEnd().split('\n');
    expect(lines[0]).toContain(artifact);
    expect(lines[0], 'the notice is the dim line, and it comes first').toContain('x-quorum-contract');
    expect(lines[1]).toContain('violates other.schema.json');
    expect(stdout, 'the notice carries the dim span the spike gives it').toContain('\x1b[2m·\x1b[0m');
  });

  test.each(SHAPES)('%s — it leads with inapplicability, names what did not run, and never claims a pass', async (_label, schema) => {
    // The six clauses `spike/test/q0011-runs-cli.js` asserts, translated. They are clauses rather
    // than the whole sentence deliberately: AC-9 keeps exactly one copy of that sentence under
    // `packages/**`, and it is `src/validate.ts`.
    const schemaFile = put('other.schema.json', schema);
    const artifact = put('artifact.json', { a: 1 });
    const { stdout } = await invoke(['validate', schemaFile, artifact]);
    const notice = noticeFor(stdout, artifact);
    expect(notice, `no notice line for ${artifact}`).toBeDefined();
    const line = notice ?? '';

    // (1) it names the file.
    expect(line).toContain(artifact);
    // (2) the lead — everything before the em dash — names the annotation that selects a pass and
    //     does not open with `run-manifest`, which reads as a check that was owed and missed.
    const lead = line.slice(0, line.indexOf('—'));
    expect(lead).toContain('x-quorum-contract');
    expect(lead.replace(artifact, '').replace(/^[^\w]*/, '')).not.toMatch(/^run-manifest/);
    // (3) it still states explicitly that no run-manifest semantic checks ran, and (4) names the one
    //     contract that is defined — which is what keeps the frozen runs-cli contract satisfied.
    expect(line).toContain('no run-manifest semantic checks ran');
    expect(line).toContain('run-manifest-v1 is the only contract defined');
    // (5) and never that anything passed: a skip is not a pass.
    expect(line).not.toMatch(/pass(ed|es)?\b/i);
    // (6) and it does not claim the annotation is absent, which is false for `unknown-v1`. This is
    //     the clause that discriminates the three shapes from one another.
    expect(line).not.toContain('no x-quorum-contract annotation');
    // (7) and it is not the superseded wording Q-0037 replaced, which E-3 rules is not a literal the
    //     implementation must contain — the words are rearranged and one of them is negated.
    expect(line).not.toContain('run-manifest semantic checks skipped');
  });
});

describe('AC-6 — the verdict reaches the process through failSoftly, and die stays die', () => {
  test('a violating artifact sets the status and never calls process.exit', async () => {
    const { exitCode, hard, stdout } = await invoke(['validate', put('s.json', GENERIC), put('d.json', { b: 1 })]);
    expect(exitCode).toBe(ERROR);
    expect(hard, 'the verdict must not truncate the report it has just printed').toBe(false);
    expect(plain(stdout)).toContain('violates');
  });

  test('and a conforming one leaves the status unset rather than setting it to 0', async () => {
    const before = process.exitCode;
    const { exitCode } = await invoke(['validate', put('s.json', GENERIC), put('d.json', { a: 1 })]);
    expect(exitCode).toBe(SUCCESS);
    expect(process.exitCode).toBe(before);
  });
});

describe('AC-2 — the command reads the parsed command line and never the process\'s', () => {
  test('it runs through main(argv), and the artifacts it validates are the ones in `rest`', async () => {
    // `process.argv` here is Vitest's, so a command reading it would validate the runner's arguments.
    const { stdout, exitCode } = await invoke(['validate', put('s.json', GENERIC), put('d.json', { a: 1 })]);
    expect(exitCode).toBe(SUCCESS);
    expect(plain(stdout)).toMatch(/\n✓ .*d\.json matches s\.json\n$/);
  });

  test('and it opens no project, so a script step outside a checkout still runs', async () => {
    // Measured against the spike rather than assumed: `spike/bin/harness.js:426–461` never calls
    // `loadProject`, and running it with `--project` aimed at a directory holding no
    // `harness/harness.yaml` validates normally — re-proved by execution, where the same flag on
    // `lint` exits 1 from `loadProject` (`:58`). Requiring one here would be a behaviour change on
    // the command's machine-facing surface, where a `type: script` step reads the exit code. Why:
    // preserved, ground rule 3 — the merged requirement's AC-4 says both commands load a project,
    // which is true of `lint` and was never true of this one. An erratum limiting AC-4 to `lint` is
    // owed at the gate; until it lands this pin is what makes the divergence a deliberate act
    // rather than a default choice.
    const schema = put('s.json', GENERIC);
    const artifact = put('d.json', { a: 1 });
    const from = process.cwd();
    const orphan = fs.mkdtempSync(path.join(os.tmpdir(), 'quorum-cli-noproject-'));
    try {
      // Asserted rather than assumed, and it is what gives this test a subject: `findProject` walks
      // upwards, so on a machine whose temp directory sat inside a checkout an AC-4-literal
      // `validate` would find *that* project, succeed, and leave this test green over the very
      // behaviour change it exists to catch. The machine property refuses the run and is never the
      // oracle (`harness/rules.md`; *"A test's verdict is a property of the commit"*, 2026-08-30).
      // `lint.test.ts`'s own orphan helper has carried this assertion since it was written.
      expect(findProject(orphan), `${orphan} sits inside a project, so this fixture is not orphaned`).toBeNull();
      process.chdir(orphan);
      const { stdout, stderr, exitCode } = await invoke(['validate', schema, artifact]);
      expect(exitCode).toBe(SUCCESS);
      expect(stderr).toBe('');
      expect(plain(stdout)).toContain('matches s.json');
    } finally {
      process.chdir(from);
      fs.rmSync(orphan, { recursive: true, force: true });
    }
  });
});

/**
 * Every `.ts` and `.js` file below `<root>/src` for every workspace package, as
 * `[repository-relative path, text]`.
 *
 * Derived from `pnpm-workspace.yaml`'s own `packages:` list rather than from a directory name typed
 * here, so a package added later is scanned without anyone remembering — the shape
 * `packages/core/src/test-discovery.test.ts` already uses for the same reason. The three generated
 * directories are pruned during the walk, for the reason `frame.source.test.ts`'s own list gives:
 * an emitted copy of a module carries every string its source does.
 */
const packageSources = (): [string, string][] => {
  const workspace = fs.readFileSync(path.join(WORKSPACE, 'pnpm-workspace.yaml'), 'utf8');
  const globs = [...workspace.matchAll(/^ {2}- (\S+)$/gm)].map((match) => match[1]);
  const roots = globs
    .filter((glob) => glob.startsWith('packages/'))
    .map((glob) => glob.replace(/\/\*$/, ''));
  const found: [string, string][] = [];
  const walk = (relative: string): void => {
    for (const entry of fs.readdirSync(path.join(WORKSPACE, relative), { withFileTypes: true })) {
      const below = path.join(relative, entry.name);
      if (entry.isDirectory()) {
        if (!['node_modules', '.turbo', 'dist'].includes(entry.name)) walk(below);
      } else if (entry.isFile() && /\.[cm]?[jt]s$/.test(entry.name)) {
        found.push([below, fs.readFileSync(path.join(WORKSPACE, below), 'utf8')]);
      }
    }
  };
  for (const root of roots) {
    for (const name of fs.readdirSync(path.join(WORKSPACE, root))) {
      const src = path.join(root, name, 'src');
      if (fs.existsSync(path.join(WORKSPACE, src))) walk(src);
    }
  }
  return found;
};

describe('AC-9 — the frozen sentence has exactly one copy under packages/**', () => {
  /**
   * The notice, read out of the module that owns it.
   *
   * Extracted rather than transcribed, because a literal here would be the second copy this test
   * exists to forbid — the shape `package.test.ts`'s `domain()` already uses against
   * `frame.source.test.ts`'s register.
   */
  const notice = (): string => {
    const text = fs.readFileSync(new URL('./validate.ts', import.meta.url), 'utf8');
    return /\nconst SKIPPED_NOTICE = '([^']+)';/.exec(text)?.[1] ?? '';
  };

  test('the extraction has a subject', () => {
    // Without this a regex that silently matched nothing would make the count below vacuous: every
    // file contains the empty string, so `filter` would return all of them and the identity would
    // fail confusingly rather than clearly — or, with a `length === 1` shape, pass over nothing.
    expect(notice().length, 'the constant moved and the extraction found nothing').toBeGreaterThan(120);
    expect(notice()).toContain('no run-manifest semantic checks ran');
    expect(notice()).toContain('run-manifest-v1 is the only contract defined');
  });

  test('the scan has a subject — it reaches every workspace package that has sources', () => {
    const names = packageSources().map(([name]) => name);
    expect(names).toContain(path.join('packages', 'cli', 'src', 'validate.ts'));
    expect(names).toContain(path.join('packages', 'core', 'src', 'contracts', 'contracts.ts'));
    expect(names).toContain(path.join('packages', 'shared', 'src', 'index.ts'));
    expect(new Set(names.map((name) => name.split(path.sep)[1])).size, 'only one package was walked')
      .toBeGreaterThan(3);
  });

  test('and exactly one file holds it, which is the module that prints it', () => {
    // Before this ticket there were two: `packages/core/src/contracts/validate-artifact.test.ts`
    // carried a `render` helper transcribed from the spike CLI, whose own doc comment said it was
    // "only worth having while it still reproduces what the CLI prints". Once the CLI's renderer
    // exists, that copy is a second copy of a frozen sentence in a package that may not import the
    // one that owns it — retired by replacement, not deleted (Q-0091 AC-9).
    const holders = packageSources().filter(([, text]) => text.includes(notice())).map(([name]) => name);
    expect(holders).toStrictEqual([path.join('packages', 'cli', 'src', 'validate.ts')]);
  });
});
