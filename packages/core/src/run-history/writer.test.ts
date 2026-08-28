// Q-0049 AC-2 to AC-6, AC-9 and AC-12: what a run writes, over throwaway repositories.
//
// The engine does not exist yet, which is why every case below drives the module through its own
// API. That is not a weaker test than one driven through `runFlow`: the writer's three historical
// defects — a refusal thrown after a `start` line, a bookkeeping field on a running occurrence, a
// persistence failure that discarded billed work — are all reachable from here, and the last two
// are invisible to a fixture that only ever looks at a completed run.
//
// The independent witness is the frozen contract itself (AC-12): the semantic pass recomputes the
// roll-up as a group-then-sum where this module accumulates, so a green tick there is agreement with
// an implementation written from the schema rather than from this one.
import fs from 'node:fs';
import path from 'node:path';

import { afterAll, describe, expect, test, vi } from 'vitest';

import { initialiseRunHistory, nextRunId } from './writer.js';
import type { RunHistory, RunStart } from './writer.js';
import type { Occurrence, RunManifest, RunStatus } from './manifest.js';
import { checkRunManifestSemantics, readData, validate, validateArtifact } from '../contracts/contracts.js';
import { FlowError } from '../lint/lint.js';
import type { TicketRecord } from '../backlog/backlog.js';
import { repoRoot } from '../../test/corpus.js';
import { commitAll, git, removeTempDirs, repo, walk, write } from '../../test/repo.js';
import { withEnv } from '../../test/env.js';

afterAll(removeTempDirs);

/** The frozen contract this module's output is measured against. */
const SCHEMA_FILE = path.join(repoRoot, 'contracts/Q-0011/run-manifest.schema.json');

/** What a test collects instead of a printer, so a warning is an assertion and not a stubbed global. */
const collector = (): { warn(message: string): void; said: string[] } => {
  const said: string[] = [];
  return { warn: (message: string) => { said.push(message); }, said };
};

/** A ticket record as the backlog would hand one over, written to disk beside its folder. */
function ticketIn(repoDir: string, stage = 'requirements'): TicketRecord {
  const folder = 'Q-0049-core-run-history';
  const dir = path.join(repoDir, 'backlog', folder);
  const body = 'The manifest, occurrences and roll-ups.\n';
  const meta = {
    id: 'Q-0049', title: 'core/run-history', stage, owner: 'ruud', repos: [],
    branch: 'harness/Q-0049/integration', priority: 'normal', created: '2026-08-28',
  } as TicketRecord['meta'];
  write(path.join(dir, 'ticket.md'), `---\nid: ${meta.id}\nstage: ${stage}\n---\n${body}`);
  return { dir, folder, meta, body };
}

/** A repository with a ticket in it, and the `start` a run would hand the writer. */
function project(stage = 'requirements', run = 1): { repoDir: string; ticket: TicketRecord; start: RunStart } {
  const repoDir = repo();
  const ticket = ticketIn(repoDir, stage);
  const flowFile = path.join(repoDir, 'harness', 'flows', 'chore.yaml');
  write(flowFile, 'name: chore\n');
  return { repoDir, ticket, start: { repoDir, ticket, run, flow: 'chore', flowFile } };
}

/** The run directory a `start` will allocate. */
const runDirOf = (start: RunStart): string =>
  path.join(start.repoDir, '.quorum', 'runs', `${start.ticket.meta.id}-${start.run}`);

/** The manifest as it stands on disk, which is the only copy a reader or a crash ever sees. */
const onDisk = (history: RunHistory): RunManifest =>
  JSON.parse(fs.readFileSync(path.join(history.dir, 'manifest.json'), 'utf8')) as RunManifest;

/** The thirteen top-level keys, in the schema's own order. */
const MANIFEST_KEYS = [
  'schema_version', 'run_id', 'ticket_id', 'ticket_path', 'flow', 'flow_file', 'stage',
  'started_at', 'ended_at', 'duration_ms', 'status', 'steps', 'rollup',
];

/** The fifteen occurrence keys, sorted, so a sixteenth fails wherever it was added. */
const OCCURRENCE_KEYS = [
  'adapter', 'attempts', 'branch', 'duration_ms', 'error', 'kind', 'model', 'occurrence_dir',
  'role', 'started_at', 'status', 'step_id', 'usage', 'verdict', 'worktree',
].sort();

describe('AC-2 — initialisation is exclusive, ordered, and refuses by name', () => {
  test('the persisted-stage guard fires when the ticket file disagrees with the caller', () => {
    const { repoDir, ticket, start } = project('requirements');
    initialiseRunHistory(start, collector());
    // The in-memory snapshot has moved on — a backward edge, or a second process — while the file
    // still says what it said. The guard compares with the FILE, not with an earlier outcome entry.
    const stale: RunStart = { ...start, run: 2, ticket: { ...ticket, meta: { ...ticket.meta, stage: 'red' } } };
    expect(() => initialiseRunHistory(stale, collector())).toThrow(FlowError);
    expect(() => initialiseRunHistory(stale, collector())).toThrow(
      'run directory allocation refused: ticket stage conflicts with persisted run history (requirements != red)',
    );
    expect(fs.existsSync(path.join(repoDir, '.quorum', 'runs', 'Q-0049-2'))).toBe(false);
  });

  test('and it does not fire before this ticket has any persisted history at all', () => {
    const { start } = project('red');
    expect(() => initialiseRunHistory(start, collector())).not.toThrow();
  });

  test('an existing run directory is refused with the whole sentence, and the errno never leaks', () => {
    const { start } = project();
    const first = initialiseRunHistory(start, collector());
    const before = fs.readFileSync(path.join(first.dir, 'manifest.json'));

    let thrown: unknown;
    try { initialiseRunHistory(start, collector()); } catch (error) { thrown = error; }
    expect(thrown).toBeInstanceOf(FlowError);
    expect((thrown as Error).message).toBe(
      'run directory allocation refused: .quorum/runs/Q-0049-1 already exists. Run ids are allocated from runs.log, '
      + 'so a directory without a matching log line usually means an interrupted run whose runs.log was truncated or '
      + 'restored from an older copy — or a second run started within the same second. Move or delete that directory '
      + 'to re-use the id.',
    );
    expect((thrown as Error).message).not.toContain('EEXIST');
    // A refusal modifies nothing: the run that owns the directory still has its manifest, byte for byte.
    expect(fs.readFileSync(path.join(first.dir, 'manifest.json'))).toStrictEqual(before);
  });

  test('any other errno is refused by name, and no manifest is left behind', () => {
    const { start } = project();
    const runsRoot = path.join(start.repoDir, '.quorum', 'runs');
    fs.mkdirSync(runsRoot, { recursive: true });
    fs.chmodSync(runsRoot, 0o555);
    try {
      let thrown: unknown;
      try { initialiseRunHistory(start, collector()); } catch (error) { thrown = error; }
      expect(thrown).toBeInstanceOf(FlowError);
      expect((thrown as Error).message).toMatch(
        /^run directory allocation refused: could not create \.quorum\/runs\/Q-0049-1 \(.+\)$/,
      );
      expect(walk(runsRoot)).toStrictEqual([]);
    } finally {
      fs.chmodSync(runsRoot, 0o755);
    }
  });

  test('a runs root that is a FILE stops the run, and does so before the refusals do', () => {
    // Reported rather than fixed. AC-2's own numbered body binds the "could not create" sentence to
    // step 3, the run directory; step 2 is bare, so a file at `.quorum/runs` fails there and what
    // reaches the caller is the raw error rather than a FlowError sentence. Preserved (charter §2),
    // asserted so the behaviour is written down, and carried in the implement report.
    // Erratum E-1 supersedes the requirement's *Test:* sketch here and settles it this way.
    const { start } = project();
    fs.mkdirSync(path.join(start.repoDir, '.quorum'), { recursive: true });
    write(path.join(start.repoDir, '.quorum', 'runs'), 'not a directory');
    let thrown: unknown;
    try { initialiseRunHistory(start, collector()); } catch (error) { thrown = error; }
    expect(thrown).toBeInstanceOf(Error);
    expect(thrown, 'the run stops, and not with one of the three refusals').not.toBeInstanceOf(FlowError);
    expect((thrown as NodeJS.ErrnoException).code).toBe('EEXIST');
    expect(fs.existsSync(runDirOf(start))).toBe(false);
  });

  test('a first write that cannot land is fatal, and names the manifest it could not create', () => {
    // Every earlier step has a refusal of its own, so the only route to the fatal branch is a first
    // write that fails — which no fixture on a healthy filesystem produces, because the directory it
    // writes into was created by this same call a moment earlier. The write is intercepted rather
    // than the directory broken, so what is asserted is the branch and not an errno.
    const { start } = project();
    const target = path.join(runDirOf(start), 'manifest.json');
    const guard = collector();
    const openSync = vi.spyOn(fs, 'openSync').mockImplementation(() => { throw new Error('the disk went away'); });
    let thrown: unknown;
    try {
      initialiseRunHistory(start, guard);
    } catch (error) {
      thrown = error;
    } finally {
      openSync.mockRestore();
    }
    expect(thrown).toBeInstanceOf(FlowError);
    expect((thrown as Error).message).toBe(`could not initialise run history at ${target}: the disk went away`);
    // Fatal, so it throws instead of warning: a run whose history cannot be created does not start.
    expect(guard.said).toStrictEqual([]);
    expect(fs.existsSync(target)).toBe(false);
  });

  test('the relative paths in a refusal are POSIX-separated, and the message is one sentence', () => {
    const { start } = project();
    initialiseRunHistory(start, collector());
    let thrown: unknown;
    try { initialiseRunHistory(start, collector()); } catch (error) { thrown = error; }
    expect((thrown as Error).message.includes('\\'), 'a Windows separator never reaches a message').toBe(false);
    expect((thrown as Error).stack, 'FlowError, so a command prints a sentence and not a stack').toBeDefined();
    expect((thrown as Error).name).toBe('Error');
  });
});

describe('AC-3 — the initial manifest is the frozen shape, relative throughout, and excludes itself', () => {
  test('exactly the thirteen keys, in the schema\'s order, with the running defaults', () => {
    const { start } = project('requirements');
    const history = initialiseRunHistory(start, collector());
    const manifest = onDisk(history);
    expect(Object.keys(manifest)).toStrictEqual(MANIFEST_KEYS);
    expect(manifest).toMatchObject({
      schema_version: 1,
      run_id: 'Q-0049-1',
      ticket_id: 'Q-0049',
      ticket_path: 'backlog/Q-0049-core-run-history/ticket.md',
      flow: 'chore',
      flow_file: 'harness/flows/chore.yaml',
      stage: { before: 'requirements', after: null },
      ended_at: null,
      duration_ms: null,
      status: 'running',
      steps: [],
      rollup: [],
    });
    expect(Date.parse(manifest.started_at)).not.toBeNaN();
    expect(history.dir).toBe(runDirOf(start));
  });

  test('every persisted path is relative, including an occurrence\'s worktree', () => {
    const { start } = project();
    const history = initialiseRunHistory(start, collector());
    history.allocate({ id: 'implement' }, 'adapter', {
      adapter: 'mock', worktree: path.join(start.repoDir, '.harness', 'worktrees', 'w'),
    });
    history.allocate({ id: 'integrate' }, 'integrate', { worktree: start.repoDir });
    history.terminal(history.manifest.steps[0], 'completed');
    const manifest = onDisk(history);
    for (const value of [manifest.ticket_path, manifest.flow_file, manifest.steps[0].worktree ?? '']) {
      expect(path.isAbsolute(value), value).toBe(false);
      expect(value.includes('\\'), value).toBe(false);
    }
    // Assembled from segments rather than written whole, so this file names no path under a root
    // the product creates — the class of literal whose meaning moves with the checkout (Q-0073).
    expect(manifest.steps[0].worktree).toBe(['.harness', 'worktrees', 'w'].join('/'));
    // The repository root is the null case, not a zero-length path — which the schema refuses.
    expect(manifest.steps[1].worktree).toBeNull();
  });

  test('the exclusion is added in a plain repository', () => {
    const { start } = project();
    initialiseRunHistory(start, collector());
    const exclude = git(start.repoDir, 'rev-parse', '--git-path', 'info/exclude');
    const file = path.isAbsolute(exclude) ? exclude : path.resolve(start.repoDir, exclude);
    expect(fs.readFileSync(file, 'utf8').split('\n')).toContain('.quorum/');
  });

  test('and in a linked worktree, where .git is a file and the exclude belongs to the primary', () => {
    // The repository shape this product itself runs in. Getting it wrong leaves a run's own history
    // in `git status` for every adopter, which is the first thing a cold clone would show.
    const { repoDir, ticket } = project();
    commitAll(repoDir, 'ticket and flow');
    const worktree = path.join(repoDir, '.harness', 'worktrees', 'harness__Q-0049__implement');
    git(repoDir, 'worktree', 'add', '-q', '-b', 'harness/Q-0049/implement', worktree);
    expect(fs.statSync(path.join(worktree, '.git')).isFile(), 'a linked worktree has a .git FILE').toBe(true);

    const before = git(worktree, 'status', '--porcelain');
    const start: RunStart = {
      repoDir: worktree,
      ticket: { ...ticket, dir: path.join(worktree, 'backlog', ticket.folder) },
      run: 1,
      flow: 'chore',
      flowFile: path.join(worktree, 'harness', 'flows', 'chore.yaml'),
    };
    const history = initialiseRunHistory(start, collector());
    expect(fs.existsSync(path.join(history.dir, 'manifest.json'))).toBe(true);
    expect(git(worktree, 'status', '--porcelain')).toBe(before);
  });

  test('no environment name or value reaches an artifact', async () => {
    // The mock contract's clause, tested with a sentinel: switch names and environment
    // representation are never copied into run-history artifacts, and the engine receives values
    // rather than an environment object. This module reads no environment variable at all, which is
    // what makes the assertion cheap and the property structural.
    const NAME = 'MOCK_Q0049_SENTINEL';
    const VALUE = 'q0049-sentinel-must-not-be-persisted';
    const { start } = project();
    await withEnv({ [NAME]: VALUE }, () => {
      const history = initialiseRunHistory(start, collector());
      const occurrence = history.allocate({ id: 'implement' }, 'adapter', { adapter: 'mock' });
      history.persist(occurrence, 'prompt.txt', 'a prompt that mentions no switch');
      history.terminal(occurrence, 'completed', { attempts: 1 });
      history.finalise('completed', 'reviewed');
      for (const entry of walk(history.dir)) {
        const file = path.join(history.dir, entry);
        if (!fs.statSync(file).isFile()) continue;
        const text = fs.readFileSync(file, 'utf8');
        expect(text.includes(NAME), `${entry} names the switch`).toBe(false);
        expect(text.includes(VALUE), `${entry} carries its value`).toBe(false);
      }
    });
  });
});

describe('AC-4 — an occurrence has exactly fifteen keys, and its start time is not one of them', () => {
  test('the fifteen, with the defaults allocation gives them', () => {
    const { start } = project();
    const history = initialiseRunHistory(start, collector());
    const occurrence = history.allocate({ id: 'implement' }, 'adapter', {
      role: 'developer-generalist', adapter: 'mock', model: 'test-model', branch: 'harness/Q-0049/implement',
    });
    expect(Object.keys(occurrence).sort()).toStrictEqual(OCCURRENCE_KEYS);
    expect(occurrence).toMatchObject({
      step_id: 'implement', occurrence_dir: 'steps/001-implement', kind: 'adapter',
      role: 'developer-generalist', adapter: 'mock', model: 'test-model',
      branch: 'harness/Q-0049/implement', worktree: null,
      duration_ms: null, attempts: 0, status: 'running', verdict: null, error: null, usage: null,
    });
    expect(fs.statSync(path.join(history.dir, 'steps', '001-implement')).isDirectory()).toBe(true);
    expect(history.manifest.steps).toStrictEqual([occurrence]);
  });

  test('a still-running occurrence on disk carries no sixteenth key', () => {
    // The defect this WeakMap exists to prevent, in the only state that exposed it. The old code
    // stamped a start time on the occurrence and deleted it just before its own write, so a
    // sibling finishing first — or a kill in that window — persisted a key the schema refuses.
    const { start } = project();
    const history = initialiseRunHistory(start, collector());
    const first = history.allocate({ id: 'one' }, 'adapter', { adapter: 'mock' });
    history.allocate({ id: 'two' }, 'adapter', { adapter: 'mock' });
    history.terminal(first, 'completed');
    const manifest = onDisk(history);
    expect(manifest.steps).toHaveLength(2);
    expect(manifest.steps[1].status).toBe('running');
    for (const step of manifest.steps) expect(Object.keys(step).sort()).toStrictEqual(OCCURRENCE_KEYS);
  });

  test('a step id containing / or : stays one path segment', () => {
    const { start } = project();
    const history = initialiseRunHistory(start, collector());
    const fanned = history.allocate({ id: 'dev:T1' }, 'adapter', { adapter: 'mock' });
    const nested = history.allocate({ id: 'a/b' }, 'script');
    expect(fanned.occurrence_dir).toBe('steps/001-dev-T1');
    expect(nested.occurrence_dir).toBe('steps/002-a-b');
    for (const occurrence of [fanned, nested]) {
      expect(fs.statSync(path.join(history.dir, occurrence.occurrence_dir)).isDirectory()).toBe(true);
    }
  });

  test('the sequence continues past 999 without truncation, one directory per occurrence', () => {
    const { start } = project();
    const history = initialiseRunHistory(start, collector());
    const dirs = new Set<string>();
    for (let i = 0; i < 1000; i++) dirs.add(history.allocate({ id: 'script' }, 'script').occurrence_dir);
    expect(dirs.size).toBe(1000);
    expect(history.manifest.steps[0].occurrence_dir).toBe('steps/001-script');
    expect(history.manifest.steps[999].occurrence_dir).toBe('steps/1000-script');
    expect(fs.readdirSync(path.join(history.dir, 'steps'))).toHaveLength(1000);
  });
});

describe('AC-5 — termination is idempotent, guarantees output.txt, and re-derives the roll-up', () => {
  test('a second call changes nothing', () => {
    const { start } = project();
    const history = initialiseRunHistory(start, collector());
    const occurrence = history.allocate({ id: 'implement' }, 'adapter', { adapter: 'mock' });
    history.terminal(occurrence, 'completed', { attempts: 2 });
    const settled = { ...occurrence };
    history.terminal(occurrence, 'interrupted', { attempts: 99, error: { category: 'interrupted', message: 'received SIGINT' } });
    expect(occurrence).toStrictEqual(settled);
    expect(occurrence.status).toBe('completed');
  });

  test('fields cannot override status or duration_ms', () => {
    const { start } = project();
    const history = initialiseRunHistory(start, collector());
    const occurrence = history.allocate({ id: 'implement' }, 'adapter', { adapter: 'mock' });
    history.terminal(occurrence, 'failed', { status: 'completed', duration_ms: 999_999 });
    expect(occurrence.status).toBe('failed');
    expect(occurrence.duration_ms).not.toBe(999_999);
    expect(occurrence.duration_ms).toBeGreaterThanOrEqual(0);
  });

  test('and the key set is closed by the compiler, which is the only thing that closes it', () => {
    // AC-5's "unrepresentable in the types rather than merely observed", applied where it costs
    // nothing: `fields` is `Partial<Occurrence>`, so a caller cannot invent a key the schema refuses.
    // Stated exactly: `Object.assign` copies whatever it is handed, so the type is the guard and
    // there is no run-time filter behind it — which is why these two are assertions about the
    // declaration and are deliberately never executed.
    // @ts-expect-error `retries` is not one of the fifteen keys the schema admits (AC-4)
    const sixteenth: Partial<Occurrence> = { retries: 2 };
    // @ts-expect-error and a key of the wrong type is refused too
    const mistyped: Partial<Occurrence> = { attempts: 'three' };
    expect([sixteenth, mistyped]).toHaveLength(2);
  });

  test('output.txt is guaranteed, empty when nothing was written', () => {
    const { start } = project();
    const history = initialiseRunHistory(start, collector());
    const script = history.allocate({ id: 'lint' }, 'script');
    history.terminal(script, 'completed');
    expect(fs.readFileSync(path.join(history.dir, script.occurrence_dir, 'output.txt'), 'utf8')).toBe('');
  });

  test('and an existing output.txt is not overwritten by the guarantee', () => {
    const { start } = project();
    const history = initialiseRunHistory(start, collector());
    const occurrence = history.allocate({ id: 'implement' }, 'adapter', { adapter: 'mock' });
    history.persist(occurrence, 'output.txt', 'what the agent said');
    history.terminal(occurrence, 'completed');
    expect(fs.readFileSync(path.join(history.dir, occurrence.occurrence_dir, 'output.txt'), 'utf8')).toBe('what the agent said');
  });

  test('an occurrence whose directory has gone warns by name and still reaches the manifest', () => {
    const { start } = project();
    const guard = collector();
    const history = initialiseRunHistory(start, guard);
    const occurrence = history.allocate({ id: 'implement' }, 'adapter', { adapter: 'mock' });
    const outputPath = path.join(history.dir, occurrence.occurrence_dir, 'output.txt');
    fs.rmSync(path.join(history.dir, occurrence.occurrence_dir), { recursive: true });
    history.terminal(occurrence, 'failed', { usage: { vendor: 'mock', input_tokens: 5, output_tokens: 1, cached_input_tokens: null, cache_write_input_tokens: null, cost_usd: 0.5 } });
    expect(guard.said).toHaveLength(1);
    expect(guard.said[0].startsWith(`could not persist run history at ${outputPath}: `)).toBe(true);
    expect(onDisk(history).steps[0]).toMatchObject({ status: 'failed', usage: { cost_usd: 0.5 } });
  });

  test('and an output.txt that is a directory is left alone, silently', () => {
    // `existsSync` does not distinguish one, so the guarantee is skipped and nothing is written or
    // said. Preserved, and reported rather than fixed: this ticket ports the writer as it stands,
    // and erratum E-1 settles the requirement's *Test:* sketch — which asks for a warning the spike
    // has no path to — in charter §2's favour. The reachable warning is the test above it.
    const { start } = project();
    const guard = collector();
    const history = initialiseRunHistory(start, guard);
    const occurrence = history.allocate({ id: 'implement' }, 'adapter', { adapter: 'mock' });
    fs.mkdirSync(path.join(history.dir, occurrence.occurrence_dir, 'output.txt'));
    history.terminal(occurrence, 'completed');
    expect(guard.said).toStrictEqual([]);
    expect(onDisk(history).steps[0].status).toBe('completed');
  });

  test('the roll-up is present and correct after every terminal call', () => {
    const { start } = project();
    const history = initialiseRunHistory(start, collector());
    const one = history.allocate({ id: 'one' }, 'adapter', { adapter: 'mock' });
    history.terminal(one, 'completed', { usage: { vendor: 'a', input_tokens: 10, output_tokens: 2, cached_input_tokens: null, cache_write_input_tokens: null, cost_usd: 1 } });
    expect(onDisk(history).rollup).toStrictEqual([
      { vendor: 'a', step_count: 1, unpriced_steps: 0, input_tokens: 10, output_tokens: 2, cached_input_tokens: null, cache_write_input_tokens: null, cost_usd: 1 },
    ]);
    const two = history.allocate({ id: 'two' }, 'adapter', { adapter: 'mock' });
    history.terminal(two, 'failed', { usage: { vendor: 'b', input_tokens: 3, output_tokens: 1, cached_input_tokens: null, cache_write_input_tokens: null, cost_usd: null } });
    expect(onDisk(history).rollup.map((row) => row.vendor)).toStrictEqual(['a', 'b']);
    expect(onDisk(history).rollup[1].unpriced_steps).toBe(1);
  });

  test('an occurrence this handle did not allocate is ignored', () => {
    const { start } = project();
    const history = initialiseRunHistory(start, collector());
    const other = initialiseRunHistory({ ...start, run: 2 }, collector());
    const stranger = other.allocate({ id: 'elsewhere' }, 'script');
    history.terminal(stranger, 'completed');
    expect(stranger.status).toBe('running');
    expect(onDisk(history).steps).toStrictEqual([]);
  });
});

describe('AC-6 — atomic replacement, byte-exact artifacts, and billed work that survives a failed write', () => {
  test('the manifest is written through a same-directory temporary file and renamed', () => {
    const { start } = project();
    const history = initialiseRunHistory(start, collector());
    const text = fs.readFileSync(path.join(history.dir, 'manifest.json'), 'utf8');
    expect(text.endsWith('}\n')).toBe(true);
    expect(text).toBe(`${JSON.stringify(JSON.parse(text), null, 2)}\n`);
    expect(text.split('\n')[1].startsWith('  "')).toBe(true);
    // No temporary file survives a successful replacement.
    expect(fs.readdirSync(history.dir).filter((entry) => entry.endsWith('.tmp'))).toStrictEqual([]);
  });

  test('an artifact is the bytes it was given, whatever they are', () => {
    const { start } = project();
    const history = initialiseRunHistory(start, collector());
    const occurrence = history.allocate({ id: 'implement' }, 'adapter', { adapter: 'mock' });
    const shapes: [string, string][] = [
      ['crlf', 'one\r\ntwo\r\n'],
      ['trailing-newline', 'ends with one\n'],
      ['no-trailing-newline', 'ends without one'],
      ['lone-cr', 'a\rb'],
      ['utf8', 'héllo — naïve ✓ 🜛'],
      ['mib', 'x'.repeat(1024 * 1024)],
    ];
    for (const [name, text] of shapes) {
      history.persist(occurrence, `${name}.txt`, text);
      const written = fs.readFileSync(path.join(history.dir, occurrence.occurrence_dir, `${name}.txt`));
      expect(written.equals(Buffer.from(text, 'utf8')), name).toBe(true);
    }
  });

  test('an unwritable run directory warns by path and discards no billed work', () => {
    const { start } = project();
    const guard = collector();
    const history = initialiseRunHistory(start, guard);
    const occurrence = history.allocate({ id: 'implement' }, 'adapter', { adapter: 'mock' });
    const usage = { vendor: 'mock', input_tokens: 900, output_tokens: 100, cached_input_tokens: null, cache_write_input_tokens: null, cost_usd: 4.54 };
    fs.chmodSync(path.join(history.dir, occurrence.occurrence_dir), 0o555);
    fs.chmodSync(history.dir, 0o555);
    try {
      history.persist(occurrence, 'output.txt', 'the agent answered');
      history.terminal(occurrence, 'failed', { attempts: 3, usage, error: { category: 'adapter', message: 'the tool died' } });
      history.finalise('failed', 'requirements');
      expect(guard.said.length).toBeGreaterThanOrEqual(3);
      for (const said of guard.said) expect(said.startsWith('could not persist run history at ')).toBe(true);
    } finally {
      fs.chmodSync(history.dir, 0o755);
      fs.chmodSync(path.join(history.dir, occurrence.occurrence_dir), 0o755);
    }
    // The in-memory snapshot stays authoritative: a vendor that has billed for a step must not lose
    // the step because a disk write failed.
    expect(history.manifest.steps[0]).toMatchObject({
      status: 'failed', attempts: 3, usage, error: { category: 'adapter', message: 'the tool died' },
    });
    expect(history.manifest.status).toBe('failed');
    expect(history.manifest.rollup[0]).toMatchObject({ vendor: 'mock', step_count: 1, cost_usd: 4.54 });
  });

  test('the temporary path is fixed, so a stray is consumed by the next replacement and never read', () => {
    // What a crash between the write and the rename leaves behind, and what happens to it. The next
    // replacement reuses the same path and renames it away, so a run that continues cleans it as a
    // side effect; a run that does NOT continue leaves it there for good, which is the nit Q-0037
    // holds — nothing names or cleans a stray. Its other half is asserted on the reader, which
    // reports the manifest it finds beside one and repairs nothing.
    const { start } = project();
    const history = initialiseRunHistory(start, collector());
    const stray = path.join(history.dir, 'manifest.json.tmp');
    fs.writeFileSync(stray, '{"half":');
    const occurrence = history.allocate({ id: 'implement' }, 'adapter', { adapter: 'mock' });
    history.terminal(occurrence, 'completed');
    expect(fs.existsSync(stray), 'the next replacement renames its own temporary file over the manifest').toBe(false);
    // And the half-written bytes were never read back: the manifest is the in-memory snapshot.
    expect(onDisk(history).steps).toHaveLength(1);
    expect(onDisk(history).steps[0].step_id).toBe('implement');
  });
});

describe('AC-9 — a run that started is a run that ended', () => {
  test('nextRunId takes the greater of the ticket history and runs.log, plus one', () => {
    const bare = project();
    expect(nextRunId(bare.ticket), 'no log and no history').toBe(1);

    const withHistory = project();
    withHistory.ticket.meta.history = [
      { stage: 'requirements', run: 3, flow: 'chore', at: '2026-08-28T00:00:00.000Z', cost: null },
    ] as TicketRecord['meta']['history'];
    expect(nextRunId(withHistory.ticket), 'history only').toBe(4);

    const withLog = project();
    write(path.join(withLog.ticket.dir, 'runs.log'), '2026-08-28 run=1 completed\n2026-08-28 run=7 failed\n');
    expect(nextRunId(withLog.ticket), 'log only').toBe(8);

    // The reason both are read: history gains an entry only on completion or regression, so a
    // failed run's number lives in the log alone and would otherwise be handed out twice.
    withLog.ticket.meta.history = [
      { stage: 'requirements', run: 2, flow: 'chore', at: '2026-08-28T00:00:00.000Z', cost: null },
    ] as TicketRecord['meta']['history'];
    expect(nextRunId(withLog.ticket), 'the log is ahead of the history').toBe(8);
  });

  test('finalise writes whichever of the six terminal statuses it is given, and only those six', () => {
    // The parameter is the six, not the seven: `running` beside a non-null `ended_at` is the one
    // manifest this subsystem exists to make impossible, so the compiler refuses it here rather than
    // the semantic pass reporting it once the run is over.
    // @ts-expect-error `running` is not a terminal status, and finalise is where a run ends
    const notTerminal = (history: RunHistory): void => { history.finalise('running', null); };
    expect(typeof notTerminal).toBe('function');

    const statuses: Exclude<RunStatus, 'running'>[] = ['completed', 'failed', 'aborted', 'regressed', 'exhausted', 'interrupted'];
    statuses.forEach((status, index) => {
      const { start } = project('requirements', index + 1);
      const history = initialiseRunHistory(start, collector());
      history.finalise(status, status === 'completed' ? 'reviewed' : null);
      const manifest = onDisk(history);
      expect(manifest.status, status).toBe(status);
      expect(manifest.ended_at, status).not.toBeNull();
      expect(manifest.duration_ms, status).not.toBeNull();
      expect(manifest.stage, status).toStrictEqual({
        before: 'requirements', after: status === 'completed' ? 'reviewed' : null,
      });
    });
  });

  test('duration_ms is the identity the semantic pass checks, not a second clock reading', () => {
    const { start } = project();
    const history = initialiseRunHistory(start, collector());
    history.finalise('completed', 'reviewed');
    const manifest = onDisk(history);
    expect(manifest.duration_ms).toBe(Date.parse(manifest.ended_at ?? '') - Date.parse(manifest.started_at));
    expect(checkRunManifestSemantics(manifest)).toStrictEqual([]);
  });
});

describe('AC-12 — the writer\'s output passes the frozen schema and the independent semantic pass', () => {
  /**
   * The run AC-12 names: two adapter occurrences on different vendors, one priced and one not, a
   * script, an integrate step, an adapter call that failed after it was billed, and a second
   * occurrence of a step id a backward edge came back to.
   */
  function synthesise(runNumber: number): RunHistory {
    const { start } = project('requirements', runNumber);
    const history = initialiseRunHistory(start, collector());

    const first = history.allocate({ id: 'implement' }, 'adapter', { role: 'developer-generalist', adapter: 'mock', model: 'a-model', branch: 'harness/Q-0049/implement' });
    history.persist(first, 'prompt.txt', 'the prompt, exactly as it was sent');
    history.persist(first, 'output.txt', 'the answer, exactly as it came back');
    history.terminal(first, 'completed', {
      attempts: 1, verdict: 'approve',
      usage: { vendor: 'priced', input_tokens: 12_000, output_tokens: 900, cached_input_tokens: 8000, cache_write_input_tokens: 400, cost_usd: 1.25 },
    });

    const review = history.allocate({ id: 'review' }, 'adapter', { role: 'code-reviewer', adapter: 'other-mock', model: null });
    history.persist(review, 'prompt.txt', 'the review prompt');
    history.terminal(review, 'completed', {
      attempts: 2, verdict: 'changes-requested',
      usage: { vendor: 'tokens-only', input_tokens: 40_000, output_tokens: 3000, cached_input_tokens: null, cache_write_input_tokens: null, cost_usd: null },
    });

    const script = history.allocate({ id: 'lint' }, 'script');
    history.terminal(script, 'completed');

    const integrate = history.allocate({ id: 'integrate' }, 'integrate', { branch: 'harness/Q-0049/integration' });
    history.terminal(integrate, 'completed');

    const billedFailure = history.allocate({ id: 'implement' }, 'adapter', { role: 'developer-generalist', adapter: 'mock', model: 'a-model' });
    history.persist(billedFailure, 'prompt.txt', 'the second attempt');
    history.terminal(billedFailure, 'failed', {
      attempts: 3,
      error: { category: 'adapter', message: 'the tool died after it had been billed' },
      usage: { vendor: 'priced', input_tokens: 800, output_tokens: 50, cached_input_tokens: null, cache_write_input_tokens: null, cost_usd: 4.54 },
    });
    return history;
  }

  test('a completed run validates structurally and semantically, against the committed contract', () => {
    // The one `validateArtifact` call this file is allowed against the real schema: the Ajv instance
    // registers the contract's `$id` for the life of the module, and a second compile throws (a
    // defect Q-0045 preserved deliberately). Every other validation below goes through `validate`
    // over the same document with that one key removed, which is not a validation rule.
    const history = synthesise(1);
    history.finalise('completed', 'reviewed');
    const manifestPath = path.join(history.dir, 'manifest.json');
    expect(validateArtifact(SCHEMA_FILE, manifestPath)).toStrictEqual({
      ok: true, errors: [], schema: 'run-manifest.schema.json', data: 'manifest.json',
      semantic: { contract: 'run-manifest-v1', ran: true },
    });
    expect(checkRunManifestSemantics(readData(manifestPath))).toStrictEqual([]);

    const manifest = onDisk(history);
    expect(manifest.steps).toHaveLength(5);
    expect(manifest.steps.filter((step) => step.step_id === 'implement')).toHaveLength(2);
    expect(new Set(manifest.steps.map((step) => step.occurrence_dir)).size).toBe(5);
    expect(manifest.rollup.map((row) => row.vendor)).toStrictEqual(['priced', 'tokens-only']);
    expect(manifest.rollup[0]).toMatchObject({ step_count: 2, unpriced_steps: 0, cost_usd: 5.79 });
    expect(manifest.rollup[1]).toMatchObject({ step_count: 1, unpriced_steps: 1, cost_usd: null });
  });

  test('and so do a failed run, an interrupted run, and the snapshot a kill leaves behind', () => {
    // The `$id` this schema carries is what a second compile refuses, so it is removed from the
    // parsed copy rather than from the file. It identifies the document and constrains nothing:
    // the control below is that the same route agrees with `validateArtifact` on the run above.
    const anonymous = { ...(readData(SCHEMA_FILE) as Record<string, unknown>) };
    expect(typeof anonymous.$id, 'the committed contract carries one').toBe('string');
    delete anonymous.$id;

    const control = synthesise(2);
    control.finalise('completed', 'reviewed');
    expect(validate(anonymous, onDisk(control))).toStrictEqual({ ok: true, errors: [] });

    const cases: [string, RunManifest][] = [];
    const failed = synthesise(3);
    failed.finalise('failed', 'requirements');
    cases.push(['failed', onDisk(failed)]);

    const interrupted = synthesise(4);
    interrupted.finalise('interrupted', 'requirements');
    cases.push(['interrupted', onDisk(interrupted)]);

    // A kill outright: the run never finalises, so the manifest on disk is the one the last terminal
    // occurrence left. Both the schema and the pass must accept it, because it is what a reader will
    // be handed and must report rather than repair.
    const killed = synthesise(5);
    cases.push(['running', onDisk(killed)]);

    for (const [name, manifest] of cases) {
      expect(manifest.status, name).toBe(name);
      expect(validate(anonymous, manifest), name).toStrictEqual({ ok: true, errors: [] });
      expect(checkRunManifestSemantics(manifest), name).toStrictEqual([]);
    }
    expect(cases[2][1].ended_at, 'the killed run is incomplete, and stays so').toBeNull();
  });
});
